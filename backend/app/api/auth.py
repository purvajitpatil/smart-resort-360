"""Authentication endpoints: /auth/register, /login, /refresh, /me, /logout."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.schemas.auth import LoginIn, RefreshIn, RegisterIn, UserOut
from app.services import auth_service
from app.utils.responses import ok

log = logging.getLogger("smartresort360.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_meta() -> dict:
    return {"token_type": "bearer"}


@router.post("/register", summary="Create an account and receive tokens")
def register(payload: RegisterIn, db: Session = Depends(get_db)) -> dict:
    tokens = auth_service.register(db, payload.email, payload.password, payload.full_name, payload.role)
    return ok(tokens, _token_meta())


@router.post("/login", summary="Exchange credentials for tokens")
def login(payload: LoginIn, db: Session = Depends(get_db)) -> dict:
    tokens = auth_service.login(db, payload.email, payload.password)
    return ok(tokens, _token_meta())


@router.post("/refresh", summary="Rotate refresh token for a fresh pair")
def refresh(payload: RefreshIn, db: Session = Depends(get_db)) -> dict:
    tokens = auth_service.refresh(db, payload.refresh_token)
    return ok(tokens, _token_meta())


@router.get("/me", summary="Current authenticated user")
def me(user: User = Depends(get_current_user)) -> dict:
    return ok(UserOut.model_validate(user))


@router.post("/logout", summary="Invalidate the current session")
def logout() -> dict:
    return ok(auth_service.logout())
