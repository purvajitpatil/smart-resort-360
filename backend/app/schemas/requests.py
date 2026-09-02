"""Service-request contracts."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.requests import RequestPriority


class RequestCreateIn(BaseModel):
    category: str = Field(min_length=2, max_length=40)
    title: str = Field(min_length=3, max_length=160)
    description: str | None = Field(default=None, max_length=2000)
    quantity: int = Field(default=1, ge=1, le=20)
    priority: RequestPriority = RequestPriority.LOW


class StatusActionIn(BaseModel):
    action: str = Field(pattern="^(start|complete|cancel)$")
    note: str | None = Field(default=None, max_length=255)


class RateRequestIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str | None = Field(default=None, max_length=255)


class RequestHistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    from_status: str | None
    to_status: str
    actor_user_id: int | None
    note: str | None
    created_at: datetime


class RequestOut(BaseModel):
    id: int
    code: str
    category: str
    title: str
    description: str | None
    quantity: int
    priority: str
    status: str
    room_number: str | None
    guest_name: str | None
    assigned_to: str | None
    department: str | None
    sla_minutes: int | None
    sla_deadline: datetime | None
    sla_overdue: bool
    resolved_at: datetime | None
    created_at: datetime
    updated_at: datetime
    history: list[RequestHistoryOut]
    user_rating: int | None = None
    ai_created: bool = False


class RequestListOut(BaseModel):
    items: list[RequestOut]
    total: int
    filters: dict


class QueueStatsOut(BaseModel):
    by_status: dict[str, int]
    by_priority: dict[str, int]
    overdue_count: int
    open_count: int
