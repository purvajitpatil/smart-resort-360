"""Hotel / stay / room orchestration."""

from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.guest import GuestProfile
from app.models.hotel import Booking, Hotel, Room, Stay
from app.models.requests import RequestStatus, ServiceRequest
from app.schemas.hotel import HotelOverviewOut, RoomOut, StayOut
from app.utils.responses import ApiError

_TERMINAL = {
    RequestStatus.COMPLETED.value,
    RequestStatus.CANCELLED.value,
    RequestStatus.REJECTED.value,
}


def current_stay(db: Session, profile: GuestProfile) -> Stay | None:
    return (
        db.query(Stay)
        .filter(Stay.guest_id == profile.id, Stay.status == "ACTIVE")
        .order_by(Stay.check_in.desc())
        .first()
    )


def current_stay_out(db: Session, profile: GuestProfile) -> StayOut:
    stay = current_stay(db, profile)
    if stay is None:
        raise ApiError(404, "NO_ACTIVE_STAY", "You do not have an active stay at this hotel.")
    hotel = db.query(Hotel).filter(Hotel.id == stay.room.hotel_id).first() if stay.room else None
    today = datetime.now().date()
    return StayOut(
        id=stay.id,
        check_in=stay.check_in,
        check_out=stay.check_out,
        status=stay.status,
        room=RoomOut.model_validate(stay.room) if stay.room else None,
        hotel_name=hotel.name if hotel else "Smart Resort 360",
        hotel_city=hotel.city if hotel else "Jaipur",
        days_remaining=max((stay.check_out - today).days, 0),
        checkout_today=(stay.check_out - today).days == 0,
    )


def overview(db: Session, hotel: Hotel) -> HotelOverviewOut:
    rows = db.execute(
        select(Room.status, func.count(Room.id)).where(Room.hotel_id == hotel.id).group_by(Room.status)
    ).all()
    rooms_by_status = {status: int(count) for status, count in rows}
    total_rooms = int(sum(rooms_by_status.values()))
    occupied = rooms_by_status.get("OCCUPIED", 0)
    occupancy_pct = round(occupied / total_rooms * 100, 1) if total_rooms else 0.0

    today = date.today()
    active_stays = db.execute(select(func.count(Stay.id)).where(Stay.status == "ACTIVE")).scalar_one()
    arrivals_today = db.execute(select(func.count(Stay.id)).where(Stay.check_in == today)).scalar_one()
    departures_today = db.execute(select(func.count(Stay.id)).where(Stay.check_out == today)).scalar_one()

    open_requests = db.execute(
        select(func.count(ServiceRequest.id)).where(ServiceRequest.status.notin_(_TERMINAL))
    ).scalar_one()
    overdue = 0
    now = datetime.now()
    open = db.execute(select(ServiceRequest).where(ServiceRequest.status.notin_(_TERMINAL))).scalars().all()
    for req in open:
        if req.sla_minutes and req.created_at and now > req.created_at + timedelta(minutes=req.sla_minutes):
            overdue += 1

    return HotelOverviewOut(
        hotel=hotel.name,
        city=hotel.city,
        total_rooms=total_rooms,
        occupancy_pct=occupancy_pct,
        rooms_by_status=rooms_by_status,
        active_stays=int(active_stays),
        arrivals_today=int(arrivals_today),
        departures_today=int(departures_today),
        open_requests=int(open_requests),
        overdue_requests=int(overdue),
    )


def rooms(db: Session, hotel: Hotel, status: str | None) -> list[RoomOut]:
    query = db.query(Room).filter(Room.hotel_id == hotel.id)
    if status:
        query = query.filter(Room.status == status)
    return [RoomOut.model_validate(r) for r in query.order_by(Room.floor, Room.number).all()]


def revenue_insight(db: Session, hotel: Hotel) -> dict:
    """Rule-based revenue intelligence: ADR, occupancy and projected daily run-rate.

    Deliberately computed from data we already hold (room rates + stays) so it
    is explainable and needs no external pricing feed for the demo.
    """
    today = date.today()
    total_rooms = int(db.execute(select(func.count(Room.id)).where(Room.hotel_id == hotel.id)).scalar_one())
    occupied_rooms = int(
        db.execute(
            select(func.count(Room.id)).where(Room.hotel_id == hotel.id, Room.status == "OCCUPIED")
        ).scalar_one()
    )
    occupancy_pct = round(occupied_rooms / total_rooms * 100, 1) if total_rooms else 0.0

    adr_row = db.execute(
        select(func.avg(Room.rate_per_night)).where(Room.hotel_id == hotel.id, Room.status == "OCCUPIED")
    ).scalar_one()
    adr = round(float(adr_row), 2) if adr_row else 0.0

    active_stays = int(db.execute(select(func.count(Stay.id)).where(Stay.status == "ACTIVE")).scalar_one())
    arrivals_today = int(db.execute(select(func.count(Stay.id)).where(Stay.check_in == today)).scalar_one())
    departures_today = int(db.execute(select(func.count(Stay.id)).where(Stay.check_out == today)).scalar_one())

    upcoming = int(
        db.execute(select(func.count(Booking.id)).where(Booking.status == "CONFIRMED")).scalar_one()
    )

    return {
        "occupancy_pct": occupancy_pct,
        "occupied_rooms": occupied_rooms,
        "total_rooms": total_rooms,
        "adr": adr,
        "projected_daily_revenue": round(adr * occupied_rooms, 2),
        "active_stays": active_stays,
        "arrivals_today": arrivals_today,
        "departures_today": departures_today,
        "upcoming_bookings": upcoming,
    }


def staff_load(db: Session, hotel: Hotel) -> dict:
    """Workload signal per department: open requests needing action."""
    rows = db.execute(
        select(ServiceRequest.department_id, func.count(ServiceRequest.id))
        .where(
            ServiceRequest.hotel_id == hotel.id,
            ServiceRequest.status.notin_(_TERMINAL),
        )
        .group_by(ServiceRequest.department_id)
    ).all()

    from app.models.hotel import Department

    dept_names = {d.id: d.name for d in db.query(Department).filter(Department.hotel_id == hotel.id).all()}
    load = [
        {"department": dept_names.get(dept_id, "Unassigned"), "open_requests": int(count)}
        for dept_id, count in rows
    ]
    load.sort(key=lambda r: r["open_requests"], reverse=True)
    total_open = sum(r["open_requests"] for r in load)
    return {"by_department": load, "total_open": total_open}
