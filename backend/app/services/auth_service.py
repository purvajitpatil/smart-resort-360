"""Authentication orchestration (registration, login, token refresh)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth import User, UserRole
from app.repositories.user_repo import UserRepo
from app.schemas.auth import TokenOut, UserOut
from app.services import security
from app.utils.responses import ApiError


def _token_out(db: Session, user: User) -> TokenOut:
    return TokenOut(
        access_token=security.create_access_token(user.id),
        refresh_token=security.create_refresh_token(user.id),
        expires_in=security.access_token_expires_in_seconds(),
        user=UserOut.model_validate(user),
    )


def register(db: Session, email: str, password: str, full_name: str, role: str) -> TokenOut:
    email = email.strip().lower()
    if UserRepo(db).get_by_email(email) is not None:
        raise ApiError(409, "EMAIL_EXISTS", "An account with this email already exists.")

    role = role.upper()
    if role not in {r.value for r in UserRole}:
        raise ApiError(422, "INVALID_ROLE", f"Role must be one of {[r.value for r in UserRole]}.")

    user = UserRepo(db).create(
        email=email,
        hashed_password=security.hash_password(password),
        full_name=full_name,
        role=role,
        is_active=True,
    )
    db.commit()
    return _token_out(db, user)


def login(db: Session, email: str, password: str) -> TokenOut:
    user = UserRepo(db).get_by_email(email)
    if user is None or not user.is_active or not security.verify_password(password, user.hashed_password):
        raise ApiError(401, "INVALID_CREDENTIALS", "Incorrect email or password.")
    return _token_out(db, user)


def refresh(db: Session, refresh_token: str) -> TokenOut:
    try:
        payload = security.decode_token(refresh_token)
    except security.TokenError:
        raise ApiError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired.") from None
    if payload.get("type") != "refresh":
        raise ApiError(401, "INVALID_REFRESH_TOKEN", "Expected a refresh token.")

    user = UserRepo(db).get_by_id(int(payload["sub"]))
    if user is None or not user.is_active:
        raise ApiError(401, "ACCOUNT_DISABLED", "This account is disabled.")
    return _token_out(db, user)


def logout() -> dict:
    # Stateless JWT design: tokens are short-lived so no server-side blacklist is
    # required for the MVP. A denylist store can be added without API changes.
    return {"status": "ok"}
