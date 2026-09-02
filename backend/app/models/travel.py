"""POI catalogue and itinerary / travel-intelligence entities."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, CreatedAtMixin, TimestampMixin


class POICategory(Base):
    __tablename__ = "poi_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True, nullable=False)


class POI(TimestampMixin, Base):
    __tablename__ = "pois"

    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(60), index=True, nullable=False)
    sub_category: Mapped[str | None] = mapped_column(String(60), nullable=True)

    lat: Mapped[float] = mapped_column(Float, nullable=False)
    lng: Mapped[float] = mapped_column(Float, nullable=False)

    open_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "09:00"
    close_time: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "22:00"
    closed_days: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # [0..6] Monday=0
    visit_minutes: Mapped[int] = mapped_column(Integer, default=90, nullable=False)

    price_level: Mapped[int] = mapped_column(Integer, default=1, nullable=False)  # 0..4
    rating: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)
    family_friendly: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    vegetarian_friendly: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    indoor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    outdoor: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    weather_sensitivity: Mapped[str] = mapped_column(
        String(10), default="LOW", nullable=False
    )  # LOW/MEDIUM/HIGH
    popularity: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)  # 0..1
    local_discovery: Mapped[float] = mapped_column(Float, default=0.2, nullable=False)  # 0..1
    source: Mapped[str] = mapped_column(String(40), default="curated", nullable=False)


class Itinerary(TimestampMixin, Base):
    __tablename__ = "itineraries"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False)
    city: Mapped[str] = mapped_column(String(80), nullable=False)

    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), default="09:00", nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), default="21:00", nullable=False)

    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    weights: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)


class ItineraryDay(Base):
    __tablename__ = "itinerary_days"

    id: Mapped[int] = mapped_column(primary_key=True)
    itinerary_id: Mapped[int] = mapped_column(ForeignKey("itineraries.id"), nullable=False, index=True)
    day_index: Mapped[int] = mapped_column(Integer, nullable=False)
    date: Mapped[date] = mapped_column(Date, nullable=False)


class ItineraryStop(CreatedAtMixin, Base):
    __tablename__ = "itinerary_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    day_id: Mapped[int] = mapped_column(ForeignKey("itinerary_days.id"), nullable=False, index=True)
    poi_id: Mapped[int] = mapped_column(ForeignKey("pois.id"), nullable=True)
    stop_type: Mapped[str] = mapped_column(
        String(10), default="POI", nullable=False
    )  # POI | MEAL | HOTEL | TRAVEL
    name: Mapped[str] = mapped_column(String(160), nullable=False)

    position: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)  # "09:00"
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    travel_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    status: Mapped[str] = mapped_column(
        String(20), default="PLANNED", nullable=False
    )  # PLANNED/LOCKED/COMPLETED/REMOVED/REPLACED
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class Recommendation(CreatedAtMixin, Base):
    __tablename__ = "recommendations"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=True, index=True)
    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id"), nullable=True)
    poi_id: Mapped[int] = mapped_column(ForeignKey("pois.id"), nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    factors: Mapped[dict] = mapped_column(JSON, nullable=False)  # per-factor scores for explainability
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class WeatherEvent(CreatedAtMixin, Base):
    __tablename__ = "weather_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    city: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    condition: Mapped[str] = mapped_column(String(60), nullable=False)
    temp_c: Mapped[float] = mapped_column(Float, nullable=False)
    precip_mm: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    wind_kmh: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    source: Mapped[str] = mapped_column(String(40), default="curated", nullable=False)


class DisruptionEvent(CreatedAtMixin, Base):
    __tablename__ = "disruption_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    itinerary_id: Mapped[int] = mapped_column(ForeignKey("itineraries.id"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # WEATHER/POI_CLOSED/TRAFFIC/DELAY/USER_CHANGE/GROUP_CHANGE/TIME_CHANGE
    severity: Mapped[str] = mapped_column(String(10), default="MEDIUM", nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    affected_stop_ids: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
