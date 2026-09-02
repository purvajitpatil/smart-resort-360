"""Hotel + stay + room contracts."""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class RoomOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    number: str
    floor: int
    room_type: str
    status: str
    capacity: int
    rate_per_night: float


class StayOut(BaseModel):
    id: int
    check_in: date
    check_out: date
    status: str
    room: RoomOut | None
    hotel_name: str
    hotel_city: str
    days_remaining: int
    checkout_today: bool


class HotelOverviewOut(BaseModel):
    hotel: str
    city: str
    total_rooms: int
    occupancy_pct: float
    rooms_by_status: dict[str, int]
    active_stays: int
    arrivals_today: int
    departures_today: int
    open_requests: int
    overdue_requests: int
