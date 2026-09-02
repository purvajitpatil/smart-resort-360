"""POI catalogue browsing + explainable recommendation engine.

Scoring is entirely computed from real curated attributes (no invented data):
interests matched against category/name/description, popularity, rating, price
fit vs. budget preference, current weather (real WeatherEvent rows when present)
and accessibility fit. Each recommendation persists with its per-factor breakdown
so every score is auditable and explainable.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.guest import GuestProfile
from app.models.travel import POI, Recommendation, WeatherEvent
from app.schemas.travel import (
    CatalogueOut,
    POIOut,
    RecommendationListOut,
    RecommendationOut,
)

_CITY = "Jaipur"

_PRICE_FIT: dict[str, list[int]] = {
    "budget": [0, 1],
    "medium": [1, 2],
    "luxury": [2, 3, 4],
}


def catalogue(
    db: Session,
    *,
    category: str | None = None,
    q: str | None = None,
    limit: int = 50,
) -> CatalogueOut:
    query = db.query(POI).filter(POI.city == _CITY)
    if category:
        query = query.filter(func.lower(POI.category) == category.lower())
    if q:
        like = f"%{q}%"
        query = query.filter(
            POI.name.ilike(like)
            | POI.description.ilike(like)
            | POI.category.ilike(like)
            | POI.sub_category.ilike(like)
        )
    items = query.order_by(POI.popularity.desc()).limit(limit).all()
    return CatalogueOut(
        items=[POIOut.model_validate(p) for p in items],
        total=len(items),
        filters={"city": _CITY, "category": category, "q": q, "limit": limit},
    )


def score_poi(
    poi: POI,
    interests: list[str],
    budget: str,
    accessibility: list[str],
    weather_state: WeatherEvent | None,
    weather_available: bool,
) -> tuple[dict[str, float], float, list[str]]:
    """Real, explainable per-POI factors. Shared by the recommendation feed and the planner."""
    factors: dict[str, float] = {}
    labels: list[str] = []

    interest_hits = _interest_match(poi, interests)
    factors["interest"] = interest_hits
    if interest_hits > 0:
        labels.append("matches your interests")

    factors["popularity"] = round(poi.popularity, 3)
    factors["discovery"] = round(poi.local_discovery, 3)
    factors["rating"] = round((poi.rating - 3.0) / 2.0, 3)

    price = _price_fit(poi.price_level, budget)
    factors["value"] = price
    if price > 0.75:
        labels.append("fits your budget")

    weather = _weather_fit(poi, weather_state, weather_available)
    factors["weather"] = weather
    if weather < 1.0:
        labels.append("reduced by today's weather")

    access = 1.0
    if accessibility:
        access = 1.0 if poi.indoor else 0.6
    factors["access"] = round(access, 3)
    if accessibility and poi.indoor:
        labels.append("indoor-friendly")

    score = round(
        0.40 * factors["interest"]
        + 0.20 * factors["popularity"]
        + 0.15 * factors["rating"]
        + 0.10 * factors["value"]
        + 0.10 * factors["weather"]
        + 0.05 * factors["discovery"]
        + 0.0 * factors["access"],
        3,
    )
    return factors, score, labels


def recommend(
    db: Session,
    profile: GuestProfile,
    *,
    limit: int = 10,
    category: str | None = None,
) -> RecommendationListOut:
    prefs = profile.preferences
    interests = list(prefs.interests) if prefs and prefs.interests else []
    budget = getattr(prefs, "budget", "medium") or "medium"
    accessibility = list(getattr(prefs, "accessibility_requirements", None) or [])
    weather_state = _weather_state(db)
    weather_available = weather_state is not None

    query = db.query(POI).filter(POI.city == _CITY)
    if category:
        query = query.filter(func.lower(POI.category) == category.lower())
    pois = query.all()

    scored: list[tuple[float, dict, str, POI]] = []
    for poi in pois:
        factors, score, labels = score_poi(
            poi, interests, budget, accessibility, weather_state, weather_available
        )
        reason = _reason(poi, labels, factors)
        scored.append((score, factors, reason, poi))

    scored.sort(key=lambda row: row[0], reverse=True)
    top = scored[:limit]

    # Persist the run so scores stay auditable (actual Recommendation rows).
    db.query(Recommendation).filter(Recommendation.guest_id == profile.id).delete()
    for score, factors, reason, poi in top:
        db.add(
            Recommendation(
                guest_id=profile.id,
                poi_id=poi.id,
                score=score,
                factors=factors,
                reason=reason,
            )
        )
    db.commit()

    items = [
        RecommendationOut(
            poi=POIOut.model_validate(poi),
            score=score,
            factors=factors,
            reason=reason,
        )
        for score, factors, reason, poi in top
    ]
    return RecommendationListOut(
        items=items,
        total=len(items),
        generated_at=datetime.now().isoformat(timespec="seconds"),
        based_on=(", ".join(interests) or "overall quality (no interests set yet)"),
    )


def _weather_state(db: Session) -> WeatherEvent | None:
    return (
        db.query(WeatherEvent)
        .filter(WeatherEvent.city == _CITY)
        .order_by(WeatherEvent.recorded_at.desc())
        .first()
    )


def latest_weather(db: Session) -> WeatherEvent | None:
    return _weather_state(db)


def weather_is_inclement(weather: WeatherEvent | None) -> bool:
    if weather is None:
        return False
    word = (weather.condition or "").lower()
    precip_heavy = weather.precip_mm is not None and weather.precip_mm >= 2.0
    return any(k in word for k in ("rain", "storm", "thunder", "cloud")) or precip_heavy


def _interest_match(poi: POI, interests: list[str]) -> float:
    if not interests:
        return 0.4  # neutral baseline so defaults still rank sensibly
    haystack = " ".join(
        [
            poi.category,
            poi.sub_category or "",
            poi.name,
            poi.description or "",
        ]
    ).lower()
    tokens = [word for interest in interests for word in interest.lower().split()]
    hits = sum(1 for token in tokens if token in haystack)
    return round(min(1.0, 0.5 + 0.25 * hits), 3)


def _price_fit(price_level: int, budget: str) -> float:
    tier = _PRICE_FIT.get(budget, _PRICE_FIT["medium"])
    if price_level in tier:
        return 1.0
    if price_level < tier[0]:
        return 0.5
    return 0.3


def _weather_fit(poi: POI, weather: WeatherEvent | None, affected: bool) -> float:
    if weather is None:
        return 1.0
    if not affected:
        return 1.0
    # rain/storm/temp highs penalize HIGH-sensitivity outdoor sightseeing
    word = (weather.condition or "").lower()
    bad = any(k in word for k in ("rain", "storm", "thunder", "cloud"))
    if poi.weather_sensitivity == "HIGH":
        if bad and poi.outdoor:
            return 0.4
        return 0.8
    if bad and poi.outdoor:
        return 0.85
    return 1.0


def _reason(poi: POI, labels: list[str], factors: dict) -> str:
    base = poi.category.casefold()
    parts = labels or ["strong overall rating"]
    score_signal = "highly rated" if factors.get("rating", 0) > 0.8 else "solid choice"
    why = " and ".join(f"it {p}" for p in parts[:2])
    return f"{base.capitalize()} — {score_signal}; {why}."


def latest(db: Session, profile: GuestProfile) -> RecommendationListOut:
    rows = (
        db.query(Recommendation)
        .filter(Recommendation.guest_id == profile.id)
        .order_by(Recommendation.id.desc())
        .limit(10)
        .all()
    )
    if not rows:
        return recommend(db, profile, limit=10)
    items = []
    for row in rows:
        poi = db.get(POI, row.poi_id)
        if poi is not None:
            items.append(
                RecommendationOut(
                    poi=POIOut.model_validate(poi),
                    score=row.score,
                    factors=row.factors,
                    reason=row.reason or "",
                )
            )
    return RecommendationListOut(items=items, total=len(items), generated_at=None, based_on="previously generated")
