"""Password hashing and JWT token helpers.

Uses bcrypt directly (passlib is unmaintained and incompatible with recent
bcrypt releases) and PyJWT for tokens. Never log tokens or passwords.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import bcrypt
import jwt

from app.config import settings


class TokenError(Exception):
    """Raised when a JWT is malformed, expired or of the wrong type."""


class TokenExpiredError(TokenError):
    pass


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def _now() -> datetime:
    return datetime.now(UTC)


def _encode(payload: dict[str, Any], expires_delta: timedelta) -> str:
    body = {
        **payload,
        "iat": _now(),
        "exp": _now() + expires_delta,
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(body, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "type": "access"},
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(user_id: int) -> str:
    return _encode(
        {"sub": str(user_id), "type": "refresh"},
        timedelta(days=settings.refresh_token_expire_days),
    )


def decode_token(token: str) -> dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError("Token expired") from exc
    except jwt.PyJWTError as exc:
        raise TokenError("Invalid token") from exc
    if "sub" not in payload:
        raise TokenError("Token missing subject")
    return payload


def access_token_expires_in_seconds() -> int:
    return settings.access_token_expire_minutes * 60
