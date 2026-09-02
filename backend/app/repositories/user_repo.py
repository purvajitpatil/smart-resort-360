"""User repository — the only place that talks to the users table."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.auth import User
from app.repositories.base import BaseRepo


class UserRepo(BaseRepo[User]):
    model = User

    def __init__(self, db: Session) -> None:
        super().__init__(db)

    def get_by_email(self, email: str) -> User | None:
        return self.first(email=email.lower().strip())

    def get_by_id(self, user_id: int) -> User | None:
        return self.get(user_id)


__all__ = ["UserRepo"]
