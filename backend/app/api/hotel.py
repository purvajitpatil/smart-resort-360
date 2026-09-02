"""Hotel operations API (staff-facing overview + rooms)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.database import get_db
from app.models.hotel import Hotel
from app.schemas.pricing import RateCalendarDayOut, SimulateRateIn, SimulateRateOut
from app.services import hotel_service, inventory_service, maintenance_service, pricing_service, scheduling_service, sentiment_service
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(prefix="/hotel", tags=["hotel"])


def _default_hotel(db: Session) -> Hotel:
    hotel = db.query(Hotel).first()
    if hotel is None:
        raise ApiError(503, "NO_HOTEL", "No hotel has been provisioned yet.")
    return hotel


@router.get(
    "/overview",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def overview(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(hotel_service.overview(db, _default_hotel(db)))


@router.get(
    "/rooms",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def rooms(db: Annotated[Session, Depends(get_db)], status: str | None = None) -> dict:
    items = hotel_service.rooms(db, _default_hotel(db), status)
    return responses.ok({"items": items, "count": len(items), "filter": status})


@router.get(
    "/sentiment",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def sentiment(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(sentiment_service.sentiment_summary(db, _default_hotel(db).id))


@router.get(
    "/maintenance/alerts",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def maintenance_alerts(db: Annotated[Session, Depends(get_db)]) -> dict:
    alerts = maintenance_service.pattern_sweep(db, _default_hotel(db).id)
    return responses.ok({"alerts": alerts, "total": len(alerts)})


@router.get(
    "/inventory",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def inventory(db: Annotated[Session, Depends(get_db)]) -> dict:
    hotel = _default_hotel(db)
    items = inventory_service.list_items(db, hotel.id)
    return responses.ok({"items": items, "count": len(items)})


@router.get(
    "/inventory/alerts",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def inventory_alerts(db: Annotated[Session, Depends(get_db)]) -> dict:
    alerts = inventory_service.low_stock_alerts(db, _default_hotel(db).id)
    return responses.ok(
        {"alerts": alerts, "total": len(alerts), "critical": sum(1 for a in alerts if a["status"] == "CRITICAL")}
    )


@router.get(
    "/revenue",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def revenue(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(hotel_service.revenue_insight(db, _default_hotel(db)))


@router.get(
    "/staff-load",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def staff_load(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(hotel_service.staff_load(db, _default_hotel(db)))


# ---------------------------------------------------------------------------
# Dynamic pricing engine
# ---------------------------------------------------------------------------


@router.get(
    "/rate-calendar",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def rate_calendar(db: Annotated[Session, Depends(get_db)], days: int = 14) -> dict:
    """Next-N-days rate card with the demand factors that drove each rate."""
    safe_days = max(1, min(days, 60))
    cal = pricing_service.rate_calendar(db, _default_hotel(db), days=safe_days)
    return responses.ok({"items": [RateCalendarDayOut.model_validate(d) for d in cal], "days": safe_days})


@router.post(
    "/rate-simulate",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def rate_simulate(payload: SimulateRateIn) -> dict:
    """Project occupancy + revenue impact of a proposed rate change."""
    result = pricing_service.simulate_rate(
        base_rate=payload.base_rate,
        proposed_rate=payload.proposed_rate,
        current_occupancy_pct=payload.current_occupancy_pct,
        room_type=payload.room_type,
    )
    return responses.ok(SimulateRateOut.model_validate(result))


@router.get(
    "/pricing-insight",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def pricing_insight(db: Annotated[Session, Depends(get_db)]) -> dict:
    """Top-line summary used by the daily brief and pricing dashboard."""
    return responses.ok(pricing_service.pricing_insight(db, _default_hotel(db)))


# ---------------------------------------------------------------------------
# Staff scheduling
# ---------------------------------------------------------------------------


@router.get(
    "/schedule/roster",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
    summary="7-day roster with per-shift coverage and gaps",
)
def schedule_roster(
    db: Annotated[Session, Depends(get_db)],
    start: str | None = None,
) -> dict:
    """Return a 7-day roster starting at `start` (YYYY-MM-DD, defaults to today)."""
    from datetime import date as _date

    parsed = _date.fromisoformat(start) if start else None
    return responses.ok(scheduling_service.weekly_roster(db, _default_hotel(db).id, start=parsed))


@router.get(
    "/schedule/coverage",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
    summary="Coverage gaps across the week",
)
def schedule_coverage(
    db: Annotated[Session, Depends(get_db)],
    start: str | None = None,
) -> dict:
    from datetime import date as _date

    parsed = _date.fromisoformat(start) if start else None
    gaps = scheduling_service.coverage_analysis(db, _default_hotel(db).id, start=parsed)
    return responses.ok({"items": gaps, "total": len(gaps)})


@router.get(
    "/schedule/forecast",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
    summary="Occupancy forecast with staffing recommendation",
)
def schedule_forecast(
    db: Annotated[Session, Depends(get_db)],
    days: int = 7,
) -> dict:
    return responses.ok({
        "items": scheduling_service.occupancy_forecast(db, _default_hotel(db).id, days=days),
        "days": days,
    })


@router.get(
    "/schedule/insight",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
    summary="Compact scheduling summary for the daily brief",
)
def schedule_insight(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(scheduling_service.scheduling_insight(db, _default_hotel(db).id))
