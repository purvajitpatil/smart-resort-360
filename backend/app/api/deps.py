"""FastAPI dependencies: current user resolution and role-based access."""

from __future__ import annotations

from collections.abc import Callable

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.auth import User
from app.repositories.user_repo import UserRepo
from app.services import security
from app.utils.responses import ApiError

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise ApiError(401, "UNAUTHENTICATED", "Authentication required.")

    try:
        payload = security.decode_token(credentials.credentials)
    except security.TokenExpiredError:
        raise ApiError(401, "TOKEN_EXPIRED", "Your session has expired. Please sign in again.") from None
    except security.TokenError:
        raise ApiError(401, "TOKEN_INVALID", "Your session token is invalid.") from None

    if payload.get("type") != "access":
        raise ApiError(401, "TOKEN_INVALID", "Expected an access token.")

    user = UserRepo(db).get_by_id(int(payload["sub"]))
    if user is None or not user.is_active:
        raise ApiError(401, "ACCOUNT_DISABLED", "This account is disabled.")
    return user


def require_roles(*roles: str) -> Callable:
    """Return a dependency that allows only the given roles."""

    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.")
        return user

    return checker


require_guest = require_roles("GUEST")
require_staff = require_roles("STAFF", "MANAGER", "ADMIN")
require_manager = require_roles("MANAGER", "ADMIN")
require_admin = require_roles("ADMIN")
