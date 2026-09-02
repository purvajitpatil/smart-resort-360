"""Dynamic pricing engine contracts."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class PricingFactorOut(BaseModel):
    multiplier: float
    label: str | None
    pct_change: float


class RateResultOut(BaseModel):
    base_rate: float
    adjusted_rate: float
    room_type: str
    check_in: str
    check_out: str
    nights: int
    occupancy_pct: float
    factors: dict[str, PricingFactorOut]
    total_pct_change: float
    reasons: list[str]


class SimulateRateIn(BaseModel):
    room_type: str
    base_rate: float = Field(gt=0)
    proposed_rate: float = Field(gt=0)
    current_occupancy_pct: float = Field(ge=0, le=100, default=70.0)


class SimulateRateOut(BaseModel):
    base_rate: float
    proposed_rate: float
    room_type: str
    current_occupancy_pct: float
    projected_occupancy_pct: float
    occupancy_change_pp: float
    revenue_impact_pct: float
    recommendation: str


class RateCalendarDayOut(BaseModel):
    date: str
    day_of_week: str
    is_weekend: bool
    occupancy_pct: float
    seasonal_label: str | None
    day_of_week_label: str
    rates_by_type: dict[str, dict]


class PricingInsightOut(BaseModel):
    model_config = ConfigDict(extra="allow")

    available: bool
    message: str | None = None
    average_occupancy_7d: float | None = None
    peak_day: str | None = None
    peak_occupancy_pct: float | None = None
    surge_days: list[str] = []
    next_7_days: list[dict] = []
