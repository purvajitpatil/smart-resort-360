"""Guest memory and SLA escalation endpoints.

Split across two audiences:

* ``/memory/*`` — the guest's own view. They can read everything we have learned
  about them and revoke any of it. This is the DPDP-friendly half.
* ``/ops/*`` — the staff view. Prep cards before arrival, live SLA state, and a
  routing explainer used to demo the 2 AM escalation path on stage.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_staff
from app.database import get_db
from app.models.auth import User
from app.models.guest import GuestProfile
from app.models.hotel import Hotel
from app.services import (
    escalation_service,
    guest_service,
    hotel_service,
    inventory_service,
    maintenance_service,
    memory_service,
    scheduling_service,
    sentiment_service,
)
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(tags=["memory"])


# ---------------------------------------------------------------------------
# Guest-facing
# ---------------------------------------------------------------------------


@router.get("/memory/mine", summary="Everything Smart Resort 360 has learned about me")
def my_memory(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    stay = memory_service.active_stay(db, profile)
    hotel_id = stay.hotel_id if stay else 1

    memories = memory_service.list_for_guest(db, profile.id, hotel_id=hotel_id)
    return responses.ok(
        {
            "items": [memory_service.to_dict(m) for m in memories],
            "total": len(memories),
            "returning_guest": any(m.stays_seen > 1 for m in memories),
        }
    )


@router.delete("/memory/mine/{memory_id}", summary="Forget one thing about me")
def forget_one(
    memory_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    mem = memory_service.forget(db, profile, memory_id)
    return responses.ok({"forgotten": memory_service.to_dict(mem)})


@router.delete("/memory/mine", summary="Forget everything about me")
def forget_everything(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    count = memory_service.forget_all(db, profile)
    return responses.ok({"forgotten": count})


@router.post("/memory/mine/state", summary="Tell Smart Resort 360 a preference directly")
def state_one(
    payload: dict,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    key = (payload.get("key") or "").strip()
    summary = (payload.get("summary") or "").strip()
    if not key or not summary:
        raise ApiError(400, "INVALID_MEMORY", "Both 'key' and 'summary' are required.")

    profile = guest_service.get_or_create_profile(db, user)
    stay = memory_service.active_stay(db, profile)
    hotel_id = stay.hotel_id if stay else 1

    mem = memory_service.state_preference(
        db, profile, hotel_id, key, summary, payload.get("value") or {}
    )
    return responses.ok(memory_service.to_dict(mem))


# ---------------------------------------------------------------------------
# Staff-facing
# ---------------------------------------------------------------------------


@router.get("/ops/guests/{guest_id}/brief", summary="Arrival prep card for one guest")
def guest_brief(
    guest_id: int,
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = db.get(GuestProfile, guest_id)
    if profile is None:
        raise ApiError(404, "GUEST_NOT_FOUND", "No such guest.")

    stay = memory_service.active_stay(db, profile)
    hotel_id = stay.hotel_id if stay else 1
    data = memory_service.brief(db, profile, hotel_id, stay.id if stay else None)
    data["guest"] = {"id": profile.id, "name": profile.full_name}
    if stay:
        data["room"] = stay.room.number if stay.room else None
    return responses.ok(data)


@router.get("/ops/escalations", summary="Every open request above escalation tier 1")
def escalations(
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
    hotel_id: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    rows = escalation_service.sweep(db, hotel_id)
    breached = [r for r in rows if r["state"] == "breached"]
    at_risk = [r for r in rows if r["state"] == "at_risk"]
    return responses.ok(
        {
            "items": rows,
            "total": len(rows),
            "breached": len(breached),
            "at_risk": len(at_risk),
            "night_shift": escalation_service.is_night(),
        }
    )


@router.get("/ops/daily-brief", summary="Actionable, explainable daily resort intelligence brief")
def daily_brief(
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Combine real operational signals into the next actions for a manager.

    This intentionally contains no LLM inference: every card links directly to
    the calculation or operational signal that produced it.
    """
    hotel = db.query(Hotel).first()
    if hotel is None:
        raise ApiError(503, "NO_HOTEL", "No hotel is configured yet.")
    overview = hotel_service.overview(db, hotel)
    revenue = hotel_service.revenue_insight(db, hotel)
    inventory = inventory_service.low_stock_alerts(db, hotel.id)
    maintenance = maintenance_service.pattern_sweep(db, hotel.id)
    sentiment = sentiment_service.sentiment_summary(db, hotel.id)
    schedule = scheduling_service.scheduling_insight(db, hotel.id)
    segments = memory_service.segment_counts(db, hotel.id)
    actions: list[dict] = []
    if overview.overdue_requests:
        actions.append({"priority": "CRITICAL", "title": f"Resolve {overview.overdue_requests} SLA-risk requests", "reason": "Open guest requests have exceeded their response deadline.", "route": "/app/escalations"})
    if maintenance:
        top = maintenance[0]
        actions.append({"priority": top["severity"], "title": f"Inspect {top['fault']}", "reason": top["alert"], "route": "/app/escalations"})
    if schedule["critical_gaps"] > 0:
        actions.append({"priority": "HIGH", "title": f"Cover {schedule['critical_gaps']} critical staffing gap(s)", "reason": f"7-day forecast shows {schedule['avg_forecast_occupancy_7d']}% avg occupancy, peak {schedule['peak_occupancy_pct']}% on {schedule['peak_day']}.", "route": "/app/schedule"})
    critical_stock = [item for item in inventory if item["status"] == "CRITICAL"]
    if critical_stock:
        actions.append({"priority": "HIGH", "title": f"Replenish {len(critical_stock)} critical stock item(s)", "reason": ", ".join(item["name"] for item in critical_stock[:3]), "route": "/app/inventory"})
    top_segment = next((s for s in segments if s["count"] > 0), None)
    if top_segment and top_segment["count"] >= 2:
        actions.append({"priority": "MEDIUM", "title": f"Activate offer for {top_segment['count']} {top_segment['segment']} guest(s)", "reason": top_segment["recommended_action"], "route": "/app/segments"})
    weak = [item for item in sentiment["by_category"] if item["avg"] < 3.8]
    if weak:
        actions.append({"priority": "MEDIUM", "title": f"Review {weak[0]['category'].title()} guest feedback", "reason": f"Average rating is {weak[0]['avg']}/5 across {weak[0]['rated']} responses.", "route": "/app/sentiment"})
    if not actions:
        actions.append({"priority": "LOW", "title": "Operations are on track", "reason": "No urgent operational signal needs intervention right now.", "route": "/app"})
    return responses.ok({"hotel": hotel.name, "generated_at": datetime.now(UTC).isoformat(timespec="seconds"), "actions": actions[:4], "signals": {"occupancy_pct": overview.occupancy_pct, "projected_daily_revenue": revenue["projected_daily_revenue"], "open_requests": overview.open_requests, "inventory_alerts": len(inventory), "scheduling_gaps": schedule["total_gaps"], "segments_covered": sum(1 for s in segments if s["count"] > 0)}})


@router.post("/ops/routing/explain", summary="Explain how a request would be routed")
def explain_routing(payload: dict, _staff: Annotated[User, Depends(require_staff)]) -> dict:
    """Dry-run the router. Powers the on-stage 2 AM walkthrough.

    Accepts an optional ISO ``at`` so the demo can show the same complaint being
    handled differently at 14:00 and at 02:00 without waiting for nightfall.
    """
    title = (payload.get("title") or "").strip()
    if not title:
        raise ApiError(400, "INVALID_REQUEST", "A 'title' is required to explain routing.")

    category = (payload.get("category") or "MAINTENANCE").upper()
    description = payload.get("description")

    at = None
    raw_at = payload.get("at")
    if raw_at:
        raw = str(raw_at).strip()
        try:
            at = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if at.tzinfo is None:
                at = at.replace(tzinfo=UTC)
        except ValueError:
            # Accept a clock time like "02:00" or "23:30" and map it to today.
            # The frontend time input sends HH:MM; a full ISO date still works.
            try:
                hours_raw, minutes_raw = raw.split(":")
                at = datetime.now(UTC).replace(
                    hour=int(hours_raw), minute=int(minutes_raw), second=0, microsecond=0
                )
            except (ValueError, TypeError):
                raise ApiError(
                    400, "INVALID_TIMESTAMP", "'at' must be an ISO-8601 timestamp or HH:MM."
                ) from None

    plan = escalation_service.classify(title, description, category, at)
    plan["walkthrough"] = escalation_service.explain(title, description, category, at)

    # Build a list of escalation steps the frontend can render as a numbered walkthrough.
    plan["steps"] = [
        (
            f"T+{r['after_minutes']}m · {r['role'].replace('_', ' ').title()} — {r['note']}"
        )
        for r in plan.get("ladder", [])
    ]
    # Top-level fields the staff UI surfaces verbatim.
    plan.setdefault("tier", 1)
    plan.setdefault("tier_role", plan.get("department", "Front Desk"))
    return responses.ok(plan)


# ---------------------------------------------------------------------------
# Guest segmentation
# ---------------------------------------------------------------------------


@router.get(
    "/ops/segments",
    dependencies=[Depends(require_staff)],
    summary="Guest segments overview",
)
def segments_overview(
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
    hotel_id: Annotated[int, Query(ge=1)] = 1,
) -> dict:
    """Count of guests per segment, with recommended actions for each."""
    counts = memory_service.segment_counts(db, hotel_id)
    total = sum(s["count"] for s in counts)
    return responses.ok({"segments": counts, "total": total})


@router.get(
    "/ops/guests/{guest_id}/segment",
    dependencies=[Depends(require_staff)],
    summary="Guest segment for one guest",
)
def guest_segment(
    guest_id: int,
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Return the segment classification for one guest with signals and offer."""
    profile = db.get(GuestProfile, guest_id)
    if profile is None:
        raise ApiError(404, "GUEST_NOT_FOUND", "No such guest.")
    stay = memory_service.active_stay(db, profile)
    hotel_id = stay.hotel_id if stay else 1
    return responses.ok(memory_service.segment_guest(db, profile, hotel_id))


@router.post(
    "/ops/segment-offer",
    dependencies=[Depends(require_staff)],
    summary="Targeted offer for a guest's segment",
)
def segment_offer(
    payload: dict,
    _staff: Annotated[User, Depends(require_staff)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    """Return a targeted offer for a guest's segment. Requires guest_id."""
    guest_id = payload.get("guest_id")
    if not guest_id:
        raise ApiError(400, "MISSING_GUEST_ID", "guest_id is required.")
    profile = db.get(GuestProfile, guest_id)
    if profile is None:
        raise ApiError(404, "GUEST_NOT_FOUND", "No such guest.")
    stay = memory_service.active_stay(db, profile)
    hotel_id = stay.hotel_id if stay else 1
    seg = memory_service.segment_guest(db, profile, hotel_id)
    return responses.ok(memory_service.segment_offer(profile, seg["segment"]))
