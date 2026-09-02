"""Constraint-optimized itinerary planner + disruption replanning.

Everything is deterministic and computed from real data: great-circle distances,
real open/close hours, real weekday closures, real visit durations, real guest
preferences and any recorded WeatherEvent. The planner enforces constraints and
ranks candidates with the same explainable factors the recommendation engine uses.
"""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy.orm import Session

from app.models.guest import GuestProfile
from app.models.hotel import Hotel
from app.models.travel import (
    POI,
    DisruptionEvent,
    Itinerary,
    ItineraryDay,
    ItineraryStop,
)
from app.schemas.travel import (
    DisruptionIn,
    DisruptionOut,
    ItineraryCreateIn,
    ItineraryDayOut,
    ItineraryListOut,
    ItineraryOut,
    StopOut,
)
from app.services import notifications_service, recommend_service
from app.utils.responses import ApiError

CITY = "Jaipur"
AVERAGE_SPEED_KMH = 15.0
MEAL_MINUTES = 60
END_BUFFER_MINUTES = 45
LUNCH_START = 12 * 60 + 15
LUNCH_END = 13 * 60 + 30

_PACE_MAX_POIS = {"relaxed": 3, "moderate": 4, "brisk": 5}
_PACE_MAX_GROUND_MIN = {"relaxed": 420, "moderate": 540, "brisk": 660}
_INCLEMENT_GROUND_CAP = 420

_Candidate = tuple[float, dict, list[str], POI]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return r * 2 * math.asin(math.sqrt(a))


def _to_min(value: str) -> int:
    h, m = value.split(":")
    return int(h) * 60 + int(m)


def _to_hm(mins: int) -> str:
    mins = max(0, int(mins))
    return f"{mins // 60:02d}:{mins % 60:02d}"


def _parse_date(value: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        raise ApiError(422, "INVALID_DATE", "start_date must be YYYY-MM-DD.") from None


class _PlanCtx:
    def __init__(self, db: Session, profile: GuestProfile) -> None:
        prefs = profile.preferences
        self.interests = list(prefs.interests) if prefs and prefs.interests else []
        self.budget = (getattr(prefs, "budget", "medium") or "medium").lower()
        self.accessibility = list(getattr(prefs, "accessibility_requirements", None) or [])
        self.pace = (getattr(prefs, "pace", "moderate") or "moderate").lower()
        self.max_pois = _PACE_MAX_POIS.get(self.pace, 4)
        self.max_ground = _PACE_MAX_GROUND_MIN.get(self.pace, 540)
        self.weather = recommend_service.latest_weather(db)
        self.inclement = recommend_service.weather_is_inclement(self.weather)
        if self.inclement:
            self.max_ground = min(self.max_ground, _INCLEMENT_GROUND_CAP)

    def allowed(self, poi: POI, day: date) -> bool:
        weekday = day.weekday()
        if weekday in (list(poi.closed_days) or []):
            return False
        if not self.inclement:
            return True
        factors, _, _ = recommend_service.score_poi(
            poi,
            self.interests,
            self.budget,
            self.accessibility,
            self.weather,
            True,
        )
        # rain hard-blocks high-sensitivity outdoor sights
        return not (factors["weather"] <= 0.5 and poi.weather_sensitivity == "HIGH" and poi.outdoor)


def _candidate_pool(db: Session, ctx: _PlanCtx) -> list[_Candidate]:
    pois = db.query(POI).filter(POI.city == CITY).all()
    rows: list[_Candidate] = []
    for poi in pois:
        factors, score, _ = recommend_service.score_poi(
            poi,
            ctx.interests,
            ctx.budget,
            ctx.accessibility,
            ctx.weather,
            ctx.inclement,
        )
        rows.append((score, factors, [], poi))
    rows.sort(key=lambda row: row[0], reverse=True)
    return rows


def _best_meal(candidates: list[_Candidate], used: set[int]) -> POI | None:
    for _, factors, _, poi in candidates:
        if poi.id in used:
            continue
        if poi.category.lower() == "food" and factors["weather"] >= 0.6:
            return poi
    return None


def _leg(lat: float, lng: float, poi: POI) -> tuple[int, float]:
    distance = round(_haversine_km(lat, lng, poi.lat, poi.lng), 2)
    minutes = max(5, round(distance / AVERAGE_SPEED_KMH * 60))
    return minutes, distance


def _schedule_day(
    db: Session,
    day_date: date,
    start_min: int,
    end_min: int,
    ctx: _PlanCtx,
    candidates: list[_Candidate],
    used: set[int],
    hotel: Hotel,
) -> list[dict[str, Any]]:
    stops: list[dict[str, Any]] = []
    position = 1
    cur = start_min
    loc_lat, loc_lng = hotel.lat or 26.9124, hotel.lng or 75.7873
    meal_done = False
    day_ground = 0

    for _, _fac, _, poi in candidates:
        if len(stops) >= ctx.max_pois:
            break
        if poi.id in used:
            continue
        if not ctx.allowed(poi, day_date):
            continue
        if day_ground + poi.visit_minutes > ctx.max_ground:
            continue

        if (
            not meal_done
            and len(stops) >= 1
            and LUNCH_START <= cur <= LUNCH_END
            and len(stops) + 1 < ctx.max_pois
        ):
            meal = _best_meal(candidates, used)
            if meal is not None:
                meal_travel, meal_dist = _leg(loc_lat, loc_lng, meal)
                meal_start = cur + meal_travel
                meal_end = meal_start + MEAL_MINUTES
                if meal_end <= end_min - END_BUFFER_MINUTES:
                    stops.append(
                        {
                            "position": position,
                            "stop_type": "MEAL",
                            "name": meal.name,
                            "poi_id": meal.id,
                            "start_time": _to_hm(meal_start),
                            "end_time": _to_hm(meal_end),
                            "travel_minutes": meal_travel,
                            "distance_km": meal_dist,
                            "status": "PLANNED",
                            "reason": f"Lunch break at {meal.name}",
                        }
                    )
                    used.add(meal.id)
                    position += 1
                    meal_done = True
                    cur = meal_end
                    loc_lat, loc_lng = meal.lat, meal.lng
                    day_ground += MEAL_MINUTES

        latest_start = end_min - END_BUFFER_MINUTES - poi.visit_minutes
        if cur > latest_start:
            continue
        travel_min, distance = _leg(loc_lat, loc_lng, poi)
        arrival = cur + travel_min
        if poi.open_time:
            arrival = max(arrival, _to_min(poi.open_time))
        departure = arrival + poi.visit_minutes
        if poi.close_time and departure > _to_min(poi.close_time):
            continue
        if departure > end_min:
            continue

        stops.append(
            {
                "position": position,
                "stop_type": "POI",
                "name": poi.name,
                "poi_id": poi.id,
                "start_time": _to_hm(arrival),
                "end_time": _to_hm(departure),
                "travel_minutes": travel_min,
                "distance_km": distance,
                "status": "PLANNED",
                "reason": None,
            }
        )
        used.add(poi.id)
        position += 1
        cur = departure
        loc_lat, loc_lng = poi.lat, poi.lng
        day_ground += poi.visit_minutes

    return stops


def _live_score_for(db: Session, ctx: _PlanCtx, poi_id: int) -> float:
    poi = db.get(POI, poi_id)
    if poi is None:
        return 0.0
    _, score, _ = recommend_service.score_poi(
        poi,
        ctx.interests,
        ctx.budget,
        ctx.accessibility,
        ctx.weather,
        ctx.inclement,
    )
    return score


def create(db: Session, profile: GuestProfile, hotel: Hotel, payload: ItineraryCreateIn) -> ItineraryOut:
    if not (1 <= payload.days <= 7):
        raise ApiError(422, "INVALID_DAY_RANGE", "Plan between 1 and 7 days.")
    today = date.today()
    start = max(_parse_date(payload.start_date), today)
    start_min = _to_min(payload.start_time)
    end_min = _to_min(payload.end_time)
    if start_min >= end_min:
        raise ApiError(422, "INVALID_TIME_RANGE", "end_time must be after start_time.")

    ctx = _PlanCtx(db, profile)
    candidates = _candidate_pool(db, ctx)
    used: set[int] = set()

    itinerary = Itinerary(
        guest_id=profile.id,
        hotel_id=hotel.id,
        city=CITY,
        start_date=start,
        end_date=start + timedelta(days=payload.days - 1),
        start_time=payload.start_time,
        end_time=payload.end_time,
        status="ACTIVE",
        weights={
            "pace": ctx.pace,
            "budget": ctx.budget,
            "max_pois_per_day": ctx.max_pois,
            "speed_kmh": AVERAGE_SPEED_KMH,
            "weather_considered": ctx.inclement,
        },
    )
    db.add(itinerary)
    db.flush()

    days: list[ItineraryDay] = []
    for i in range(payload.days):
        day = ItineraryDay(
            itinerary_id=itinerary.id,
            day_index=i + 1,
            date=start + timedelta(days=i),
        )
        db.add(day)
        db.flush()
        days.append(day)
        stops = _schedule_day(db, day.date, start_min, end_min, ctx, candidates, used, hotel)
        for stop in stops:
            db.add(
                ItineraryStop(
                    day_id=day.id,
                    poi_id=stop["poi_id"],
                    stop_type=stop["stop_type"],
                    name=stop["name"],
                    position=stop["position"],
                    start_time=stop["start_time"],
                    end_time=stop["end_time"],
                    travel_minutes=stop["travel_minutes"],
                    distance_km=stop["distance_km"],
                    status=stop["status"],
                    reason=stop["reason"],
                )
            )

    itinerary.score = round(_compute_score(db, ctx, itinerary), 2)
    itinerary.explanation = _explanation(db, itinerary)
    db.commit()
    _notify(
        db,
        itinerary,
        "Your Jaipur plan is ready",
        f"{payload.days}-day route planned from {itinerary.start_date}. Check it under 'Your travel plan'.",
    )
    return _to_out(db, itinerary, replanned=False)


def _days(db: Session, itinerary: Itinerary) -> list[ItineraryDay]:
    return (
        db.query(ItineraryDay)
        .filter(ItineraryDay.itinerary_id == itinerary.id)
        .order_by(ItineraryDay.day_index)
        .all()
    )


def _stops_of_day(db: Session, day: ItineraryDay) -> list[ItineraryStop]:
    return (
        db.query(ItineraryStop).filter(ItineraryStop.day_id == day.id).order_by(ItineraryStop.position).all()
    )


def _compute_score(db: Session, ctx: _PlanCtx, itinerary: Itinerary) -> float:
    total = 0.0
    for day in _days(db, itinerary):
        for stop in _stops_of_day(db, day):
            if stop.status == "REMOVED" or not stop.poi_id:
                continue
            weight = 0.75 if stop.stop_type == "MEAL" else 1.0
            total += round(_live_score_for(db, ctx, stop.poi_id) * weight, 2)
    return round(total, 2)


def _explanation(db: Session, itinerary: Itinerary, replanned: bool = False) -> str:
    parts: list[str] = []
    for day in _days(db, itinerary):
        labels = [s.name for s in _stops_of_day(db, day)]
        legs = " → ".join(labels) if labels else "free time"
        parts.append(f"Day {day.day_index} ({day.date.isoformat()}): {legs}")
    if replanned:
        parts.insert(0, "Replanned after disruption.")
    return "; ".join(parts)


def as_out(db: Session, itinerary: Itinerary, replanned: bool | None = None) -> ItineraryOut:
    return _to_out(db, itinerary, replanned)


def _to_out(db: Session, itinerary: Itinerary, replanned: bool | None = None) -> ItineraryOut:
    if replanned is None:
        has_disruption = (
            db.query(DisruptionEvent.id).filter(DisruptionEvent.itinerary_id == itinerary.id).first()
        )
        replanned = has_disruption is not None
    return ItineraryOut(
        id=itinerary.id,
        city=itinerary.city,
        start_date=itinerary.start_date.isoformat(),
        end_date=itinerary.end_date.isoformat(),
        start_time=itinerary.start_time,
        end_time=itinerary.end_time,
        status=itinerary.status,
        score=itinerary.score or 0.0,
        explanation=itinerary.explanation or "",
        weights=itinerary.weights or {},
        replanned=replanned,
        days=[
            ItineraryDayOut(
                id=d.id,
                day_index=d.day_index,
                date=d.date.isoformat(),
                stops=[
                    StopOut(
                        id=s.id,
                        position=s.position,
                        stop_type=s.stop_type,
                        name=s.name,
                        poi_id=s.poi_id,
                        start_time=s.start_time,
                        end_time=s.end_time,
                        travel_minutes=s.travel_minutes,
                        distance_km=s.distance_km,
                        status=s.status,
                        reason=s.reason,
                    )
                    for s in _stops_of_day(db, d)
                ],
            )
            for d in _days(db, itinerary)
        ],
    )


def get(db: Session, itinerary_id: int) -> Itinerary:
    itinerary = db.get(Itinerary, itinerary_id)
    if itinerary is None:
        raise ApiError(404, "ITINERARY_NOT_FOUND", f"No itinerary with id {itinerary_id}.")
    return itinerary


def list_for_guest(db: Session, profile: GuestProfile) -> ItineraryListOut:
    rows = db.query(Itinerary).filter(Itinerary.guest_id == profile.id).order_by(Itinerary.id.desc()).all()
    return ItineraryListOut(
        items=[_to_out(db, i) for i in rows],
        total=len(rows),
    )


def remove(db: Session, itinerary_id: int) -> None:
    itinerary = get(db, itinerary_id)
    for day in _days(db, itinerary):
        db.query(ItineraryStop).filter(ItineraryStop.day_id == day.id).delete()
        db.delete(day)
    db.query(DisruptionEvent).filter(DisruptionEvent.itinerary_id == itinerary.id).delete()
    db.delete(itinerary)
    db.commit()


def replan(
    db: Session,
    itinerary_id: int,
    disruption: DisruptionIn,
) -> tuple[ItineraryOut, DisruptionOut, int]:
    itinerary = get(db, itinerary_id)
    affected = set(disruption.affected_stop_ids)
    affected_pois = set(disruption.affected_poi_ids)
    if not affected and not affected_pois:
        raise ApiError(422, "INVALID_DISRUPTION", "Supply affected_stop_ids or affected_poi_ids.")

    all_stops = [s for d in _days(db, itinerary) for s in _stops_of_day(db, d)]
    targeted = (
        [s for s in all_stops if s.id in affected]
        if affected
        else [s for s in all_stops if s.poi_id in affected_pois]
    )
    if not targeted:
        raise ApiError(422, "NOTHING_AFFECTED", "The disruption does not touch any planned stop.")

    changed_day_ids = {s.day_id for s in targeted}
    affected_stop_ids = [s.id for s in targeted]
    for s in targeted:
        s.status = "REMOVED"
        s.reason = disruption.message

    db.add(
        DisruptionEvent(
            itinerary_id=itinerary.id,
            event_type=disruption.event_type,
            severity=disruption.severity,
            message=disruption.message,
            affected_stop_ids=affected_stop_ids,
            payload={"city": itinerary.city},
        )
    )

    profile = db.get(GuestProfile, itinerary.guest_id)
    hotel = db.get(Hotel, itinerary.hotel_id) or db.query(Hotel).first()
    changed = 0
    if profile is not None:
        ctx = _PlanCtx(db, profile)
        for day in _days(db, itinerary):
            if day.id in changed_day_ids:
                changed += _reschedule_day(db, day, itinerary, ctx, profile, hotel)

    itinerary.score = _compute_score(db, _PlanCtx(db, profile), itinerary) if profile else itinerary.score
    itinerary.explanation = _explanation(db, itinerary, replanned=True)
    db.commit()

    _notify(
        db,
        itinerary,
        "Your plan was replanned",
        f"{disruption.message}. Your day was rebuilt around it with {changed} change(s).",
    )

    event = (
        db.query(DisruptionEvent)
        .filter(DisruptionEvent.itinerary_id == itinerary.id)
        .order_by(DisruptionEvent.id.desc())
        .first()
    )
    return _to_out(db, itinerary, replanned=True), _to_disruption_out(event), changed + len(targeted)


def _reschedule_day(
    db: Session,
    day: ItineraryDay,
    itinerary: Itinerary,
    ctx: _PlanCtx,
    profile: GuestProfile,
    hotel: Hotel,
) -> int:
    existing = _stops_of_day(db, day)
    used_ids = {s.poi_id for s in existing if s.poi_id}
    for s in existing:
        s.status = "REMOVED"
        s.reason = "Day rebuilt after disruption"
    db.flush()

    used_elsewhere = {
        s.poi_id
        for d in _days(db, itinerary)
        if d.id != day.id
        for s in _stops_of_day(db, d)
        if s.poi_id and s.status == "PLANNED"
    }
    used = used_ids | used_elsewhere
    candidates = [c for c in _candidate_pool(db, ctx) if c[3].id not in used]

    stops = _schedule_day(
        db,
        day.date,
        _to_min(itinerary.start_time),
        _to_min(itinerary.end_time),
        ctx,
        candidates,
        set(),  # pool already excludes used; keep local schedule free
        hotel,
    )
    position = 0
    for stop in stops:
        position += 1
        db.add(
            ItineraryStop(
                day_id=day.id,
                poi_id=stop["poi_id"],
                stop_type=stop["stop_type"],
                name=stop["name"],
                position=position,
                start_time=stop["start_time"],
                end_time=stop["end_time"],
                travel_minutes=stop["travel_minutes"],
                distance_km=stop["distance_km"],
                status="REPLACED",
                reason=f"Replacement after disruption: {stop['name']}",
            )
        )
    return len(stops)


def _notify(db: Session, itinerary: Itinerary, title: str, body: str) -> None:
    if itinerary.guest_id:
        try:
            notifications_service.send(db, itinerary.guest_id, title=title, body=body)
        except Exception:  # noqa: BLE001 - a lost notification must never break the plan
            pass


def _to_disruption_out(event: DisruptionEvent | None) -> DisruptionOut:
    if event is None:
        return DisruptionOut(
            id=0, event_type="", severity="", message="", affected_stop_ids=[], created_at=""
        )
    return DisruptionOut(
        id=event.id,
        event_type=event.event_type,
        severity=event.severity,
        message=event.message,
        affected_stop_ids=event.affected_stop_ids or [],
        created_at=event.created_at.isoformat(timespec="seconds") if event.created_at else "",
    )
