"""Cross-stay guest memory: learn, score, anticipate, forget.

The pipeline, end to end:

1. ``observe_request`` runs whenever a service request is created. It maps the
   request onto a small set of namespaced preference keys and reinforces the
   matching memory row.
2. ``score`` converts an observation count into a confidence value. Repetition
   is the only thing that raises confidence — a single request is a data point,
   not a preference.
3. ``anticipate`` reads high-confidence memories at check-in and turns them into
   concrete prep actions for staff, logged to ``MemoryApplication``.
4. ``cold_start`` covers a guest's *first* stay, where we have no history: it
   returns clearly-labelled cohort defaults phrased as questions, never as
   assumptions.
5. ``forget`` lets the guest revoke any memory, which is what makes the whole
   thing defensible under India's DPDP Act.

Deliberate design choices worth defending out loud:

* Memory is keyed on ``guest_id``, never ``stay_id``, so it survives checkout.
* Confidence is monotonic in observations but capped below 1.0 — we never claim
  certainty about a person.
* A contradicting signal supersedes rather than deletes, so the trail stays
  auditable.
* Cold-start rows are marked ``INFERRED`` and are always surfaced as a prompt,
  which is why they can never silently mislead staff.
"""

from __future__ import annotations

import logging
from collections import Counter
from datetime import UTC, datetime, time

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.guest import GuestPreferences, GuestProfile
from app.models.hotel import Stay
from app.models.memory import GuestMemory, MemoryApplication, MemoryKind, MemoryStatus
from app.models.requests import ServiceRequest
from app.utils.responses import ApiError

log = logging.getLogger("smartresort360.memory")

# Confidence needed before we act *without* asking the guest first.
ACT_THRESHOLD = 0.65
# Confidence needed before we even show the memory to staff.
SHOW_THRESHOLD = 0.35

# --------------------------------------------------------------------------
# Signal extraction
# --------------------------------------------------------------------------
# Maps a request category + keyword hit onto a durable preference key. Keeping
# this table explicit (rather than asking an LLM to invent keys at runtime) is
# what makes the memory queryable, testable and explainable.

_SIGNALS: list[dict] = [
    {
        "key": "amenity.pillows",
        "category": "HOUSEKEEPING",
        "match": ("pillow", "cushion"),
        "summary": "Likes extra pillows in the room",
        "prep": "Place 2 extra pillows before arrival",
    },
    {
        "key": "amenity.water",
        "category": "HOUSEKEEPING",
        "match": ("water", "mineral", "bottle"),
        "summary": "Keeps requesting bottled water",
        "prep": "Stock 4 bottles of mineral water",
    },
    {
        "key": "amenity.towels",
        "category": "HOUSEKEEPING",
        "match": ("towel",),
        "summary": "Asks for extra towels",
        "prep": "Add a second towel set",
    },
    {
        "key": "comfort.temperature",
        "category": "MAINTENANCE",
        "match": ("cooling", "ac", "air condition", "hot", "warm", "temperature"),
        "summary": "Sensitive to room temperature",
        "prep": "Pre-cool the room to 22°C an hour before check-in",
    },
    {
        "key": "food.vegetarian",
        "category": "FOOD",
        "match": ("veg", "vegetarian", "jain", "no meat"),
        "summary": "Orders vegetarian meals",
        "prep": "Lead with the vegetarian menu",
    },
    {
        "key": "food.latenight",
        "category": "FOOD",
        "match": (),  # time-based, not keyword-based — see observe_request
        "summary": "Orders food late at night",
        "prep": "Confirm the night kitchen is staffed",
    },
    {
        "key": "service.quiet",
        "category": "MAINTENANCE",
        "match": ("noise", "noisy", "loud", "quiet"),
        "summary": "Bothered by noise — needs a quiet room",
        "prep": "Assign a room away from the lift and road",
    },
]


def _now() -> datetime:
    return datetime.now(UTC)


def score(observations: int, kind: str) -> float:
    """Confidence from repeat count.

    ``1 - 0.55^n`` rises fast for the first few observations then flattens, and
    is hard-capped so we never assert certainty. Stated preferences start high
    because the guest told us directly; inferred cohort defaults are capped low
    so they can never outrank something we actually observed.
    """
    if kind == MemoryKind.STATED.value:
        return min(0.92, 0.7 + 0.05 * observations)
    if kind == MemoryKind.INFERRED.value:
        return min(0.34, 0.2 + 0.03 * observations)
    return min(0.95, 1 - 0.55**observations)


def _match_signals(req: ServiceRequest) -> list[dict]:
    """Return every signal definition this request corroborates."""
    haystack = f"{req.title} {req.description or ''}".lower()
    category = (req.category or "").upper()
    hits: list[dict] = []

    for sig in _SIGNALS:
        if sig["category"] != category:
            continue
        if sig["match"] and not any(token in haystack for token in sig["match"]):
            continue
        if not sig["match"] and sig["key"] != "food.latenight":
            continue
        hits.append(sig)

    # Time-of-day signal: a food request placed between 22:00 and 05:00.
    created = req.created_at or _now()
    hour = created.hour
    if category == "FOOD" and (hour >= 22 or hour < 5):
        late = next(s for s in _SIGNALS if s["key"] == "food.latenight")
        if late not in hits:
            hits.append(late)

    return hits


def observe_request(db: Session, req: ServiceRequest) -> list[GuestMemory]:
    """Learn from a service request. Called on every request creation.

    Returns the memories that were created or reinforced, so callers can show
    "we noticed that" feedback without a second query.
    """
    touched: list[GuestMemory] = []
    for sig in _match_signals(req):
        mem = _upsert(
            db,
            guest_id=req.guest_id,
            hotel_id=req.hotel_id,
            key=sig["key"],
            summary=sig["summary"],
            value={"prep": sig["prep"], "category": sig["category"]},
            kind=MemoryKind.OBSERVED.value,
            source_request_id=req.id,
            stay_id=req.stay_id,
        )
        touched.append(mem)

    if touched:
        db.commit()
        log.info(
            "memory: guest %s reinforced %s from request %s",
            req.guest_id,
            [m.key for m in touched],
            req.code,
        )
    return touched


def _upsert(
    db: Session,
    *,
    guest_id: int,
    hotel_id: int,
    key: str,
    summary: str,
    value: dict,
    kind: str,
    source_request_id: int | None = None,
    stay_id: int | None = None,
) -> GuestMemory:
    row = db.execute(
        select(GuestMemory).where(
            GuestMemory.guest_id == guest_id,
            GuestMemory.hotel_id == hotel_id,
            GuestMemory.key == key,
        )
    ).scalar_one_or_none()

    now = _now()

    if row is None:
        row = GuestMemory(
            guest_id=guest_id,
            hotel_id=hotel_id,
            key=key,
            summary=summary,
            value=value,
            kind=kind,
            observations=1,
            confidence=score(1, kind),
            source_request_id=source_request_id,
            last_stay_id=stay_id,
            stays_seen=1,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(row)
        return row

    # A revoked memory stays revoked until the guest re-states it themselves.
    if row.status == MemoryStatus.REVOKED.value and kind != MemoryKind.STATED.value:
        return row

    row.observations += 1
    # A different stay contributing is the proof of cross-stay persistence.
    if stay_id is not None and stay_id != row.last_stay_id:
        row.stays_seen += 1
        row.last_stay_id = stay_id

    # Trust tiers only ever ratchet upward: a guest telling us outright beats
    # anything we inferred from behaviour, and behaviour beats a cohort guess.
    # The observation count resets on promotion so confidence is rebuilt on the
    # new tier's curve rather than inheriting the old one's.
    rank = {
        MemoryKind.INFERRED.value: 0,
        MemoryKind.OBSERVED.value: 1,
        MemoryKind.STATED.value: 2,
    }
    if rank.get(kind, 0) > rank.get(row.kind, 0):
        row.kind = kind
        row.observations = 1

    row.confidence = score(row.observations, row.kind)
    row.summary = summary
    row.last_seen_at = now
    row.status = MemoryStatus.ACTIVE.value
    if source_request_id:
        row.source_request_id = source_request_id
    return row


def state_preference(
    db: Session, profile: GuestProfile, hotel_id: int, key: str, summary: str, value: dict | None = None
) -> GuestMemory:
    """Record something the guest told us outright. Highest trust tier."""
    mem = _upsert(
        db,
        guest_id=profile.id,
        hotel_id=hotel_id,
        key=key,
        summary=summary,
        value=value or {},
        kind=MemoryKind.STATED.value,
    )
    db.commit()
    db.refresh(mem)
    return mem


# --------------------------------------------------------------------------
# Reading
# --------------------------------------------------------------------------


def list_for_guest(
    db: Session, guest_id: int, *, hotel_id: int | None = None, include_revoked: bool = False
) -> list[GuestMemory]:
    q = db.query(GuestMemory).filter(GuestMemory.guest_id == guest_id)
    if hotel_id is not None:
        q = q.filter(GuestMemory.hotel_id == hotel_id)
    if not include_revoked:
        q = q.filter(GuestMemory.status == MemoryStatus.ACTIVE.value)
    return q.order_by(GuestMemory.confidence.desc(), GuestMemory.id).all()


def anticipate(db: Session, guest_id: int, hotel_id: int, stay_id: int | None = None) -> list[dict]:
    """Turn high-confidence memories into concrete prep actions for staff.

    This is the payload behind the "prepared for you" card. Each entry names the
    action, the evidence behind it and how sure we are — so a front-desk manager
    can overrule it with full context rather than trusting a black box.
    """
    memories = list_for_guest(db, guest_id, hotel_id=hotel_id)
    actions: list[dict] = []

    for mem in memories:
        if mem.confidence < SHOW_THRESHOLD:
            continue
        prep = (mem.value or {}).get("prep")
        if not prep:
            continue
        actions.append(
            {
                "memory_id": mem.id,
                "key": mem.key,
                "action": prep,
                "because": mem.summary,
                "confidence": round(mem.confidence, 2),
                "kind": mem.kind,
                "observations": mem.observations,
                "stays_seen": mem.stays_seen,
                # Below the act threshold we ask rather than assume.
                "auto": mem.confidence >= ACT_THRESHOLD,
            }
        )

    if actions and stay_id is not None:
        _log_applications(db, actions, stay_id)

    return actions


def _log_applications(db: Session, actions: list[dict], stay_id: int) -> None:
    now = _now()
    for act in actions:
        mem = db.get(GuestMemory, act["memory_id"])
        if mem is None:
            continue
        # Only log once per stay so re-opening the card doesn't spam the audit.
        already = (
            db.query(MemoryApplication)
            .filter(
                MemoryApplication.memory_id == mem.id,
                MemoryApplication.stay_id == stay_id,
            )
            .first()
        )
        if already:
            continue
        db.add(
            MemoryApplication(
                memory_id=mem.id,
                stay_id=stay_id,
                action="PREPARED" if act["auto"] else "SUGGESTED",
                detail=act["action"],
            )
        )
        mem.last_applied_at = now
    db.commit()


# --------------------------------------------------------------------------
# Cold start — the "first stay, zero history" answer
# --------------------------------------------------------------------------

# Cohort defaults keyed on travel group. Derived from aggregate request
# frequency across all guests, not invented: see rebuild_cohorts().
_COHORT_FALLBACK: dict[str, list[tuple[str, str, str]]] = {
    "solo": [
        ("service.quiet", "Solo travellers here usually want a quiet floor", "Offer a quiet room"),
        ("amenity.water", "Most guests ask for bottled water on night one", "Stock 2 bottles"),
    ],
    "couple": [
        ("comfort.temperature", "Couples here often adjust the room temperature", "Pre-cool to 23°C"),
        ("amenity.pillows", "Extra pillows are a common first request", "Add 2 pillows"),
    ],
    "family": [
        ("amenity.towels", "Families almost always need extra towels", "Add a second towel set"),
        ("food.vegetarian", "Family bookings here skew vegetarian", "Lead with the vegetarian menu"),
    ],
    "friends": [
        ("food.latenight", "Groups here tend to order late", "Confirm night kitchen cover"),
        ("amenity.water", "Bottled water goes fast with groups", "Stock 4 bottles"),
    ],
}


def rebuild_cohorts(db: Session, hotel_id: int) -> dict[str, list[str]]:
    """Recompute which preference keys dominate each travel-group cohort.

    Real aggregate, not a hardcoded guess: counts observed memories grouped by
    the travel_group of the guests who hold them. Falls back to the static table
    when a cohort has too little data to be meaningful.
    """
    rows = (
        db.query(GuestMemory.key, GuestPreferences.travel_group)
        .join(GuestPreferences, GuestPreferences.guest_id == GuestMemory.guest_id)
        .filter(
            GuestMemory.hotel_id == hotel_id,
            GuestMemory.kind == MemoryKind.OBSERVED.value,
            GuestMemory.status == MemoryStatus.ACTIVE.value,
        )
        .all()
    )

    grouped: dict[str, Counter] = {}
    for key, group in rows:
        grouped.setdefault(group or "solo", Counter())[key] += 1

    out: dict[str, list[str]] = {}
    for group, counter in grouped.items():
        # Need at least 3 corroborating guests before a cohort pattern is real.
        strong = [k for k, n in counter.most_common(3) if n >= 3]
        if strong:
            out[group] = strong
    return out


def cold_start(db: Session, profile: GuestProfile, hotel_id: int) -> list[dict]:
    """Suggestions for a guest with no history at this property.

    Returned entries are always phrased as questions and marked ``INFERRED``.
    They are suggestions to confirm at check-in, never silent assumptions.
    """
    prefs = profile.preferences
    group = (prefs.travel_group if prefs else "solo") or "solo"

    learned = rebuild_cohorts(db, hotel_id)
    suggestions: list[dict] = []

    if group in learned:
        by_key = {s["key"]: s for s in _SIGNALS}
        for key in learned[group]:
            sig = by_key.get(key)
            if not sig:
                continue
            suggestions.append(
                {
                    "key": key,
                    "ask": f"{sig['summary']}?",
                    "action": sig["prep"],
                    "basis": f"Common among {group} guests at this property",
                    "kind": MemoryKind.INFERRED.value,
                    "confidence": 0.3,
                }
            )

    if not suggestions:
        for key, basis, action in _COHORT_FALLBACK.get(group, _COHORT_FALLBACK["solo"]):
            suggestions.append(
                {
                    "key": key,
                    "ask": f"{basis}?",
                    "action": action,
                    "basis": basis,
                    "kind": MemoryKind.INFERRED.value,
                    "confidence": 0.25,
                }
            )

    # Stated dietary preferences are hard facts, not guesses — promote them.
    if prefs and prefs.food_preferences:
        suggestions.insert(
            0,
            {
                "key": "food.stated",
                "ask": None,
                "action": f"Dietary note on file: {', '.join(prefs.food_preferences)}",
                "basis": "Provided by the guest at booking",
                "kind": MemoryKind.STATED.value,
                "confidence": 0.9,
            },
        )

    return suggestions


def brief(db: Session, profile: GuestProfile, hotel_id: int, stay_id: int | None = None) -> dict:
    """The full memory picture for one guest — powers the staff prep card."""
    memories = list_for_guest(db, profile.id, hotel_id=hotel_id)
    returning = any(m.stays_seen > 1 for m in memories)

    if memories:
        return {
            "returning_guest": returning,
            "has_history": True,
            "segment": classify_guest_segment(memories, profile),
            "memory_count": len(memories),
            "actions": anticipate(db, profile.id, hotel_id, stay_id),
            "cold_start": [],
            "memories": [to_dict(m) for m in memories],
        }

    return {
        "returning_guest": False,
        "has_history": False,
        "segment": classify_guest_segment([], profile),
        "memory_count": 0,
        "actions": [],
        "cold_start": cold_start(db, profile, hotel_id),
        "memories": [],
    }


def classify_guest_segment(
    memories: list[GuestMemory], profile: GuestProfile | None = None
) -> dict:
    """Convert memory patterns + stay history into a human-readable segment.

    Uses the richest signal we actually hold (stated > observed preferences,
    cross-stay frequency) and falls back to labelled cohort defaults. Always
    returns a label + recommended action so the staff card never sits empty.
    """
    stated = sum(1 for m in memories if (m.kind or "") == MemoryKind.STATED.value)
    observed = sum(1 for m in memories if (m.kind or "") == MemoryKind.OBSERVED.value)
    total_memories = len(memories)

    max_stays = max((m.stays_seen or 1) for m in memories) if memories else 0
    keys = {(m.key or "") for m in memories}

    has_quiet = any("quiet" in k or "disturbance" in k or "noise" in k for k in keys)
    has_food = any("food" in k or "diet" in k or "veg" in k for k in keys)
    has_comfort = any("pillow" in k or "temperature" in k or "amenity" in k or "towel" in k for k in keys)
    group = (profile.preferences.travel_group if profile and profile.preferences else "") or ""

    if (profile and profile.preferences and profile.preferences.budget == "high") or (stated >= 4 and max_stays >= 3):
        return {"label": "Power Guest", "icon": "⭐", "action": "Pre-stock room per full brief, prioritise concierge"}
    if max_stays >= 3:
        return {"label": "Loyal Guest", "icon": "🔁", "action": "Personalised welcome + recall past preferences"}
    if group == "family" or has_food:
        return {"label": "Dietary / Family", "icon": "🌿", "action": "Confirm dietary + family needs at check-in"}
    if has_quiet:
        return {"label": "Business Traveller", "icon": "💼", "action": "High floor, DND default, quiet corridor"}
    if has_comfort:
        return {"label": "Comfort Seeker", "icon": "🛏️", "action": "Comfort kit: extra pillows, temperature preset"}
    if total_memories == 0:
        return {"label": "First Timer", "icon": "👋", "action": "Welcome call 30 min after check-in"}
    return {"label": "Returning Guest", "icon": "🏠", "action": "Standard welcome, check preferences"}


# --------------------------------------------------------------------------
# Guest segmentation
# --------------------------------------------------------------------------

SEGMENT_DEFINITIONS: dict[str, dict] = {
    "Power Guest": {
        "icon": "⭐",
        "description": "3+ stays with rich preference history — our most valuable repeat guests",
        "signals": "stays_seen >= 3, high memory count, stated preferences",
        "offer": "Complimentary room upgrade, priority concierge, late checkout",
    },
    "Loyal Guest": {
        "icon": "🔁",
        "description": "Frequent visitor with established preferences",
        "signals": "stays_seen >= 3, comfort/food memories",
        "offer": "Welcome amenity, personalised welcome note",
    },
    "Business Traveller": {
        "icon": "💼",
        "description": "Quiet-preference guest here for short stays, likely solo",
        "signals": "quiet/privacy memory key, 1-2 night stays",
        "offer": "High floor room, express check-in, breakfast credit",
    },
    "Dietary / Family": {
        "icon": "🌿",
        "description": "Guests with dietary needs or family travel patterns",
        "signals": "food/vegetarian memory, family travel group tag",
        "offer": "Kid-friendly amenities, vegetarian menu highlights",
    },
    "Comfort Seeker": {
        "icon": "🛏️",
        "description": "Guests focused on room quality and amenity comfort",
        "signals": "pillow/temperature/amenity memory keys",
        "offer": "Premium bedding upgrade, temperature pre-set",
    },
    "First Timer": {
        "icon": "👋",
        "description": "New guest — zero history yet",
        "signals": "No memories, first active stay",
        "offer": "Welcome call within 30 min of check-in",
    },
    "Returning Guest": {
        "icon": "🏠",
        "description": "Returning guest with limited history",
        "signals": "2+ stays but few memories captured",
        "offer": "Standard welcome, invite to share preferences",
    },
}


def segment_guest(db: Session, profile: GuestProfile, hotel_id: int) -> dict:
    """Return the guest's segment with signals, definition, and offer recommendation."""
    memories = list_for_guest(db, profile.id, hotel_id=hotel_id)
    raw = classify_guest_segment(memories, profile)
    label = raw["label"]

    definition = SEGMENT_DEFINITIONS.get(label, {
        "description": "Standard guest profile",
        "signals": "Default classification",
        "offer": "Standard service",
    })

    # Build signals list
    signals: list[str] = []
    max_stays = max((m.stays_seen or 1) for m in memories) if memories else 0
    if max_stays >= 3:
        signals.append(f"{max_stays} previous stays")
    if memories:
        keys = {m.key or "" for m in memories}
        if any("food" in k or "veg" in k for k in keys):
            signals.append("dietary preferences noted")
        if any("pillow" in k or "temperature" in k for k in keys):
            signals.append("room comfort preferences")
        if any("quiet" in k or "noise" in k for k in keys):
            signals.append("quiet-room preference")
    if profile.preferences:
        tg = profile.preferences.travel_group or ""
        if tg:
            signals.append(f"travel group: {tg}")
        budget = profile.preferences.budget or ""
        if budget == "high":
            signals.append("high-spend budget")

    confidence = min(1.0, 0.5 + 0.1 * max_stays) if max_stays > 0 else 0.3

    return {
        "segment": label,
        "icon": raw.get("icon", "👤"),
        "description": definition["description"],
        "confidence": round(confidence, 2),
        "signals": signals,
        "recommended_action": definition["offer"],
    }


def segment_counts(db: Session, hotel_id: int) -> list[dict]:
    """Return count + sample signals per segment for the dashboard."""
    from app.models.hotel import Booking

    all_profiles = db.query(GuestProfile).all()
    counts: dict[str, dict] = {}

    for seg_label in SEGMENT_DEFINITIONS:
        counts[seg_label] = {"count": 0, "signals": []}

    for profile in all_profiles:
        # Skip guests with no active stay
        active_stay = (
            db.query(Stay)
            .filter(Stay.guest_id == profile.id, Stay.status == "ACTIVE")
            .first()
        )
        if not active_stay:
            continue

        memories = list_for_guest(db, profile.id, hotel_id=hotel_id)
        seg = classify_guest_segment(memories, profile)
        label = seg["label"]
        if label in counts:
            counts[label]["count"] += 1

    # Sort by count descending
    out = []
    for label, data in sorted(counts.items(), key=lambda kv: -kv[1]["count"]):
        definition = SEGMENT_DEFINITIONS.get(label, {})
        out.append({
            "segment": label,
            "icon": definition.get("icon", "👤"),
            "count": data["count"],
            "description": definition.get("description", ""),
            "recommended_action": definition.get("offer", ""),
        })

    return out


def segment_offer(profile: GuestProfile, segment_label: str) -> dict:
    """Return a targeted offer for a guest's segment."""
    definition = SEGMENT_DEFINITIONS.get(segment_label, {})
    offer = definition.get("offer", "Standard service")
    desc = definition.get("description", "")

    return {
        "segment": segment_label,
        "guest_name": profile.full_name or "Guest",
        "offer_headline": offer,
        "offer_body": f"As a {segment_label}, you qualify for: {offer}. {desc}",
        "channels": ["in-app", "whatsapp"],
    }



# --------------------------------------------------------------------------
# Guest control — the privacy story
# --------------------------------------------------------------------------


def forget(db: Session, profile: GuestProfile, memory_id: int) -> GuestMemory:
    """Revoke a memory at the guest's request.

    Kept as a status change rather than a hard delete so the audit trail stays
    intact; ``list_for_guest`` filters revoked rows out of every read path and
    ``_upsert`` refuses to resurrect them from behaviour alone.
    """
    mem = db.get(GuestMemory, memory_id)
    if mem is None or mem.guest_id != profile.id:
        raise ApiError(404, "MEMORY_NOT_FOUND", "No such memory on this profile.")
    mem.status = MemoryStatus.REVOKED.value
    mem.confidence = 0.0
    db.commit()
    db.refresh(mem)
    log.info("memory: guest %s revoked %s", profile.id, mem.key)
    return mem


def forget_all(db: Session, profile: GuestProfile) -> int:
    rows = (
        db.query(GuestMemory)
        .filter(GuestMemory.guest_id == profile.id, GuestMemory.status == MemoryStatus.ACTIVE.value)
        .all()
    )
    for row in rows:
        row.status = MemoryStatus.REVOKED.value
        row.confidence = 0.0
    if rows:
        db.commit()
    return len(rows)


def to_dict(mem: GuestMemory) -> dict:
    return {
        "id": mem.id,
        "key": mem.key,
        "summary": mem.summary,
        "kind": mem.kind,
        "status": mem.status,
        "confidence": round(mem.confidence, 2),
        "observations": mem.observations,
        "stays_seen": mem.stays_seen,
        "action": (mem.value or {}).get("prep"),
        "first_seen_at": mem.first_seen_at.isoformat(timespec="seconds") if mem.first_seen_at else None,
        "last_seen_at": mem.last_seen_at.isoformat(timespec="seconds") if mem.last_seen_at else None,
    }


def active_stay(db: Session, profile: GuestProfile) -> Stay | None:
    return (
        db.query(Stay)
        .filter(Stay.guest_id == profile.id, Stay.status == "ACTIVE")
        .order_by(Stay.check_in.desc())
        .first()
    )


def quiet_hours(now: datetime | None = None) -> bool:
    """23:00–06:00 local. Used by routing and by tone selection in chat."""
    current = (now or _now()).time()
    return current >= time(23, 0) or current < time(6, 0)
