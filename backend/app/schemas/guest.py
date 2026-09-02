"""Guest profile + preferences contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field


class GuestProfileOut(BaseModel):
    id: int
    full_name: str
    phone: str | None
    email: str | None
    preferences: dict


class PreferencesIn(BaseModel):
    interests: list[str] = Field(default_factory=list)
    budget: str = "medium"
    pace: str = "moderate"
    preferred_start_time: str = "09:00"
    preferred_end_time: str = "21:00"
    walking_tolerance: str = "medium"
    food_preferences: list[str] = Field(default_factory=list)
    travel_group: str = "solo"
    accessibility_requirements: list[str] = Field(default_factory=list)
    preferred_activity_duration: str = "medium"
