"""Service-request API: guest create/cancel/list, staff queue/detail/board."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.database import get_db
from app.models.auth import User
from app.schemas.requests import RateRequestIn, RequestCreateIn, StatusActionIn
from app.services import guest_service, requests_service, sentiment_service
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("")
def create(
    payload: RequestCreateIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(requests_service.create(db, profile, payload))


@router.get("/mine")
def mine(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(requests_service.list_for_guest(db, profile))


@router.post("/{code}/cancel")
def cancel_mine(
    code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(requests_service.cancel_for_guest(db, profile, code))


@router.post("/mine/{code}/rate")
def rate_mine(
    code: str,
    payload: RateRequestIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(
        sentiment_service.rate_request(db, profile, code, payload.rating, payload.comment)
    )


@router.get(
    "/queue/stats",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def queue_stats(db: Annotated[Session, Depends(get_db)]) -> dict:
    return responses.ok(requests_service.queue_stats(db))


@router.get(
    "",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def list_staff(
    db: Annotated[Session, Depends(get_db)],
    status: str | None = None,
    category: str | None = None,
    priority: str | None = None,
    search: str | None = None,
) -> dict:
    return responses.ok(
        requests_service.list_for_staff(
            db,
            status=status,
            category=category,
            priority=priority,
            search=search,
        )
    )


@router.get("/{code}")
def detail(
    code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    req = requests_service.get_request_row(db, code)
    if user.role not in {"STAFF", "MANAGER", "ADMIN"}:
        own = guest_service.get_or_create_profile(db, user)
        if req.guest_id != own.id:
            raise ApiError(403, "FORBIDDEN", "This request does not belong to you.")
    return responses.ok(requests_service.get_by_code(db, code))


@router.patch(
    "/{code}/assign",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def assign(
    code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    note: str | None = None,
    payload: dict | None = None,
) -> dict:
    # Accept the note from either a query param or the request body for flexibility.
    body_note = (payload or {}).get("note") if payload else None
    final_note = note or body_note
    return responses.ok(requests_service.assign(db, user, code, final_note))


@router.patch(
    "/{code}/status",
    dependencies=[Depends(require_roles("STAFF", "MANAGER", "ADMIN"))],
)
def transition(
    code: str,
    payload: StatusActionIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return responses.ok(requests_service.transition(db, user, code, payload.action, payload.note))
