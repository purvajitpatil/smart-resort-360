"""Itinerary planner + disruption replanning + weather capture API."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_guest, require_staff
from app.database import get_db
from app.models.auth import User
from app.models.hotel import Hotel
from app.models.travel import WeatherEvent
from app.schemas.travel import DisruptionIn, ItineraryCreateIn, WeatherCaptureIn
from app.services import guest_service, hotel_service, planner_service
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(tags=["planner"])

GuestDep = Annotated[User, Depends(require_guest)]
StaffDep = Annotated[User, Depends(require_staff)]
AnyUserDep = Annotated[User, Depends(get_current_user)]
DbDep = Annotated[Session, Depends(get_db)]


def _guest_hotel(db: Session, profile) -> Hotel:
    stay = hotel_service.current_stay(db, profile)
    if stay is not None and stay.room and stay.room.hotel_id:
        hotel = db.get(Hotel, stay.room.hotel_id)
        if hotel is not None:
            return hotel
    hotel = db.query(Hotel).first()
    if hotel is None:
        raise ApiError(503, "NO_HOTEL", "No hotel is configured yet.")
    return hotel


def _shared_itinerary(user: User, db: Session, itinerary_id: int):
    itinerary = planner_service.get(db, itinerary_id)
    if user.role == "GUEST":
        profile = guest_service.get_or_create_profile(db, user)
        if itinerary.guest_id != profile.id:
            raise ApiError(403, "FORBIDDEN", "You can only manage your own itinerary.")
    return itinerary


@router.post("/itineraries")
def create_itinerary(
    payload: ItineraryCreateIn,
    user: GuestDep,
    db: DbDep,
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    hotel = _guest_hotel(db, profile)
    result = planner_service.create(db, profile, hotel, payload)
    return responses.ok(result.model_dump(), meta={"replanned": False})


@router.get("/itineraries")
def list_itineraries(user: GuestDep, db: DbDep) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(planner_service.list_for_guest(db, profile).model_dump())


@router.get("/itineraries/{itinerary_id}")
def get_itinerary(itinerary_id: int, user: AnyUserDep, db: DbDep) -> dict:
    itinerary = _shared_itinerary(user, db, itinerary_id)
    return responses.ok(planner_service.as_out(db, itinerary))


@router.post("/itineraries/{itinerary_id}/replan")
def replan_itinerary(
    itinerary_id: int,
    payload: DisruptionIn,
    user: AnyUserDep,
    db: DbDep,
) -> dict:
    _shared_itinerary(user, db, itinerary_id)
    itinerary_out, disruption_out, changes = planner_service.replan(db, itinerary_id, payload)
    return responses.ok(
        itinerary_out.model_dump(),
        meta={
            "replanned": True,
            "changes": changes,
            "disruption": disruption_out.model_dump(),
        },
    )


@router.delete("/itineraries/{itinerary_id}")
def delete_itinerary(itinerary_id: int, user: GuestDep, db: DbDep) -> dict:
    _shared_itinerary(user, db, itinerary_id)
    planner_service.remove(db, itinerary_id)
    return responses.ok({"deleted": itinerary_id})


@router.post("/weather/capture")
def capture_weather(payload: WeatherCaptureIn, user: StaffDep, db: DbDep) -> dict:
    event = WeatherEvent(
        city=payload.city,
        recorded_at=datetime.now(UTC),
        condition=payload.condition,
        temp_c=payload.temp_c,
        precip_mm=payload.precip_mm,
        wind_kmh=payload.wind_kmh,
        source="ingested",
    )
    db.add(event)
    db.commit()
    return responses.ok(
        {
            "id": event.id,
            "city": event.city,
            "recorded_at": event.recorded_at.isoformat(timespec="seconds"),
            "condition": event.condition,
            "temp_c": event.temp_c,
            "precip_mm": event.precip_mm,
            "wind_kmh": event.wind_kmh,
        }
    )
