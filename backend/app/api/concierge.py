"""AI concierge chat + WhatsApp-style notification inbox API."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_guest, require_staff
from app.database import get_db
from app.models.auth import User
from app.models.guest import GuestProfile
from app.schemas.concierge import ChatIn, NotificationSendIn
from app.services import concierge_service, notifications_service
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(tags=["concierge"])

GuestDep = Annotated[User, Depends(require_guest)]
StaffDep = Annotated[User, Depends(require_staff)]
AnyUserDep = Annotated[User, Depends(get_current_user)]
DbDep = Annotated[Session, Depends(get_db)]


@router.get("/chat/conversation")
def get_conversation(user: GuestDep, db: DbDep) -> dict:
    return responses.ok(concierge_service.conversation(db, user).model_dump())


@router.post("/chat/messages")
def send_message(payload: ChatIn, user: GuestDep, db: DbDep) -> dict:
    try:
        reply = concierge_service.handle(db, user, payload.resolve())
    except ValidationError as exc:  # pragma: no cover - defensive guard
        raise ApiError(422, "VALIDATION_ERROR", str(exc)) from None
    return responses.ok(reply.model_dump())


@router.delete("/chat/conversation")
def reset_conversation(user: GuestDep, db: DbDep) -> dict:
    concierge_service.reset(db, user)
    return responses.ok({"status": "reset"})


@router.get("/notifications")
def list_notifications(user: GuestDep, db: DbDep) -> dict:
    profile = _guest_profile(db, user)
    return responses.ok(notifications_service.list_for(db, profile).model_dump())


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: int, user: GuestDep, db: DbDep) -> dict:
    profile = _guest_profile(db, user)
    return responses.ok(notifications_service.mark_read(db, profile, notification_id).model_dump())


@router.post("/notifications/read-all")
def read_all_notifications(user: GuestDep, db: DbDep) -> dict:
    profile = _guest_profile(db, user)
    count = notifications_service.mark_all_read(db, profile)
    return responses.ok({"marked_read": count})


@router.post("/notifications/demo/send")
def send_demo_notification(payload: NotificationSendIn, user: StaffDep, db: DbDep) -> dict:
    profile = _demo_target_profile(db, payload.guest_id)
    if profile is None:
        raise ApiError(404, "GUEST_NOT_FOUND", "No such guest (provide a guest profile id).")
    out = notifications_service.send(
        db, profile.id, title=payload.title, body=payload.body, channel=payload.series
    )
    return responses.ok(out.model_dump())


def _guest_profile(db: Session, user: User) -> GuestProfile:
    from app.services.guest_service import get_or_create_profile

    return get_or_create_profile(db, user)


def _demo_target_profile(db: Session, guest_id: int | None) -> GuestProfile | None:
    if guest_id is not None:
        return db.get(GuestProfile, guest_id)
    return notifications_service.demo_guest(db)
