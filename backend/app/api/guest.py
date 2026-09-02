"""Guest app endpoints: profile, preferences, current stay."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.schemas.guest import PreferencesIn
from app.services import guest_service, hotel_service
from app.utils import responses

router = APIRouter(prefix="/guest", tags=["guest"])


@router.get("/me")
def me(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return responses.ok(guest_service.my_profile(db, user))


@router.put("/preferences", name="guest-update-preferences")
def update_preferences(
    payload: PreferencesIn,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    return responses.ok(guest_service.update_preferences(db, user, payload))


@router.get("/stay/current")
def current_stay(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    profile = guest_service.get_or_create_profile(db, user)
    return responses.ok(hotel_service.current_stay_out(db, profile))
