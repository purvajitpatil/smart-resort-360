"""Hotel operations: hotels, departments, staff and rooms."""

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .auth import User
from .base import Base, TimestampMixin


class Hotel(TimestampMixin, Base):
    __tablename__ = "hotels"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    city: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=True)
    lat: Mapped[float] = mapped_column(Float, nullable=True)
    lng: Mapped[float] = mapped_column(Float, nullable=True)

    departments: Mapped[list[Department]] = relationship(back_populates="hotel")
    rooms: Mapped[list[Room]] = relationship(back_populates="hotel")


class Department(TimestampMixin, Base):
    __tablename__ = "departments"

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    color: Mapped[str] = mapped_column(String(20), nullable=True)

    hotel: Mapped[Hotel] = relationship(back_populates="departments")


class Staff(TimestampMixin, Base):
    __tablename__ = "staff"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=True)
    position: Mapped[str] = mapped_column(String(80), nullable=True)
    shift: Mapped[str] = mapped_column(String(40), default="Morning", nullable=False)

    user: Mapped[User] = relationship()


class Room(TimestampMixin, Base):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)
    number: Mapped[str] = mapped_column(String(8), index=True, nullable=False)
    floor: Mapped[int] = mapped_column(Integer, nullable=False)
    room_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="CLEAN", nullable=False, index=True)
    capacity: Mapped[int] = mapped_column(Integer, default=2, nullable=False)
    rate_per_night: Mapped[float] = mapped_column(Float, default=4500.0, nullable=False)

    hotel: Mapped[Hotel] = relationship(back_populates="rooms")


class Booking(TimestampMixin, Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=True)
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="CONFIRMED", nullable=False)


class Stay(TimestampMixin, Base):
    __tablename__ = "stays"

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), nullable=False)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=False, index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False)
    check_in: Mapped[date] = mapped_column(Date, nullable=False)
    check_out: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False, index=True)

    room: Mapped[Room] = relationship()


# Keep SQLAlchemy aware of the User FK used in Staff without unused imports warnings.
__all__ = ["Hotel", "Department", "Staff", "Room", "Booking", "Stay", "User"]
