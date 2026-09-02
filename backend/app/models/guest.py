"""Guest profiles, preferences and group-travel entities."""

from __future__ import annotations

from sqlalchemy import JSON, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin


class GuestProfile(TimestampMixin, Base):
    __tablename__ = "guest_profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, nullable=True)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=True)
    email: Mapped[str] = mapped_column(String(255), nullable=True)

    preferences: Mapped[GuestPreferences | None] = relationship(
        back_populates="guest", uselist=False, cascade="all, delete-orphan"
    )


class GuestPreferences(TimestampMixin, Base):
    __tablename__ = "guest_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), unique=True, nullable=False)
    interests: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    budget: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    pace: Mapped[str] = mapped_column(String(20), default="moderate", nullable=False)
    preferred_start_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    preferred_end_time: Mapped[str] = mapped_column(String(5), default="21:00", nullable=False)
    walking_tolerance: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)
    food_preferences: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    travel_group: Mapped[str] = mapped_column(String(20), default="solo", nullable=False)
    accessibility_requirements: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    preferred_activity_duration: Mapped[str] = mapped_column(String(20), default="medium", nullable=False)

    guest: Mapped[GuestProfile] = relationship(back_populates="preferences")


class Group(TimestampMixin, Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    stay_id: Mapped[int] = mapped_column(ForeignKey("stays.id"), nullable=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    created_by_guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False)


class GroupMember(TimestampMixin, Base):
    __tablename__ = "group_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False)
    preferences: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class GroupVote(TimestampMixin, Base):
    __tablename__ = "group_votes"

    id: Mapped[int] = mapped_column(primary_key=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=False, index=True)
    member_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False)
    poi_id: Mapped[int] = mapped_column(ForeignKey("pois.id"), nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
