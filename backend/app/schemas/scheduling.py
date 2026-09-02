"""Schemas for the scheduling module — kept thin since the service returns dicts."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ShiftSlot(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    shift: str
    shift_label: str
    start: str
    end: str
    assigned: list[dict]
    needed: int
    available: int
    gap: int
    severity: str


class RosterDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: str
    day_of_week: str
    is_today: bool
    is_weekend: bool
    occupancy_pct: float
    departments: list[dict]


class RosterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    start_date: str
    end_date: str
    days: list[RosterDay]
    total_staff: int


class CoverageGap(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: str
    day_of_week: str
    department: str
    shift: str
    needed: int
    available: int
    gap: int
    severity: str
    occupancy_pct: float
    recommendation: str


class ForecastDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    date: str
    day_of_week: str
    is_weekend: bool
    predicted_occupancy_pct: float
    staffing_needed_total: int
    band: str


class SchedulingInsight(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    total_gaps: int
    critical_gaps: int
    high_gaps: int
    avg_forecast_occupancy_7d: float
    peak_day: str | None
    peak_occupancy_pct: float | None
    available: bool
