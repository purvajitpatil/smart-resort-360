"""POI catalogue + recommendation contracts."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class POIOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    city: str
    name: str
    description: str | None
    category: str
    sub_category: str | None
    lat: float
    lng: float
    open_time: str | None
    close_time: str | None
    closed_days: list
    visit_minutes: int
    price_level: int
    rating: float
    family_friendly: bool
    vegetarian_friendly: bool
    indoor: bool
    outdoor: bool
    weather_sensitivity: str
    popularity: float
    local_discovery: float


class CatalogueOut(BaseModel):
    items: list[POIOut]
    total: int
    filters: dict


class RecommendationOut(BaseModel):
    poi: POIOut
    score: float
    factors: dict
    reason: str


class RecommendationListOut(BaseModel):
    items: list[RecommendationOut]
    total: int
    generated_at: str | None
    based_on: str


class ItineraryCreateIn(BaseModel):
    start_date: str
    days: int = 1
    start_time: str = "09:00"
    end_time: str = "21:00"


class StopOut(BaseModel):
    id: int
    position: int
    stop_type: str
    name: str
    poi_id: int | None
    start_time: str
    end_time: str
    travel_minutes: int
    distance_km: float
    status: str
    reason: str | None


class ItineraryDayOut(BaseModel):
    id: int
    day_index: int
    date: str
    stops: list[StopOut]


class ItineraryOut(BaseModel):
    id: int
    city: str
    start_date: str
    end_date: str
    start_time: str
    end_time: str
    status: str
    score: float
    explanation: str
    weights: dict
    replanned: bool
    days: list[ItineraryDayOut]


class ItineraryListOut(BaseModel):
    items: list[ItineraryOut]
    total: int


class DisruptionIn(BaseModel):
    event_type: str = "WEATHER"
    severity: str = "MEDIUM"
    message: str
    affected_poi_ids: list[int] = []
    affected_stop_ids: list[int] = []


class WeatherCaptureIn(BaseModel):
    condition: str
    temp_c: float
    precip_mm: float = 0.0
    wind_kmh: float = 0.0
    city: str = "Jaipur"


class DisruptionOut(BaseModel):
    id: int
    event_type: str
    severity: str
    message: str
    affected_stop_ids: list
    created_at: str
