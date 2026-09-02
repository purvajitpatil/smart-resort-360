"""Service request workflow entities."""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .guest import GuestProfile
from .hotel import Department, Room, Staff


class RequestPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RequestStatus(StrEnum):
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class ServiceRequest(TimestampMixin, Base):
    __tablename__ = "service_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    stay_id: Mapped[int] = mapped_column(ForeignKey("stays.id"), nullable=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("rooms.id"), nullable=True)

    category: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    priority: Mapped[str] = mapped_column(
        String(10), default=RequestPriority.LOW.value, nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(20), default=RequestStatus.PENDING.value, nullable=False, index=True
    )

    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=True)
    assigned_staff_id: Mapped[int] = mapped_column(ForeignKey("staff.id"), nullable=True)

    ai_created: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sla_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guest: Mapped[GuestProfile] = relationship()
    room: Mapped[Room] = relationship()
    department: Mapped[Department] = relationship()
    assigned_staff: Mapped[Staff] = relationship()
    history: Mapped[list[RequestStatusHistory]] = relationship(
        back_populates="request", cascade="all, delete-orphan", order_by="RequestStatusHistory.id"
    )


class RequestStatusHistory(TimestampMixin, Base):
    __tablename__ = "request_status_history"

    id: Mapped[int] = mapped_column(primary_key=True)
    request_id: Mapped[int] = mapped_column(ForeignKey("service_requests.id"), nullable=False, index=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20), nullable=False)
    actor_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=True)
    note: Mapped[str | None] = mapped_column(String(255), nullable=True)

    request: Mapped[ServiceRequest] = relationship(back_populates="history")
