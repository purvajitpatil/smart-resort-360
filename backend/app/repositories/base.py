"""Thin data access layer — business logic stays in services, SQL in repos."""

from __future__ import annotations

from typing import Any, Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.base import Base as ModelBase

ModelT = TypeVar("ModelT", bound=ModelBase)


class BaseRepo(Generic[ModelT]):
    model: type[ModelT] | None = None

    def __init__(self, db: Session, model: type[ModelT] | None = None) -> None:
        self.db = db
        self.model = model or type(self).model

    def get(self, obj_id: int) -> ModelT | None:
        return self.db.get(self.model, obj_id)

    def all(self, **filters: Any):
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        return list(self.db.scalars(stmt).all())

    def first(self, **filters: Any) -> ModelT | None:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        return self.db.scalar(stmt.limit(1))

    def count(self, **filters: Any) -> int:
        stmt = select(self.model)
        for key, value in filters.items():
            stmt = stmt.where(getattr(self.model, key) == value)
        return len(self.db.scalars(stmt).all())

    def create(self, **values: Any) -> ModelT:
        obj = self.model(**values)
        self.db.add(obj)
        self.db.flush()
        return obj

    def delete(self, obj_id: int) -> bool:
        obj = self.db.get(self.model, obj_id)
        if obj is None:
            return False
        self.db.delete(obj)
        self.db.flush()
        return True
