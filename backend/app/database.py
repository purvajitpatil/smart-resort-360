"""Database engine, session factory and FastAPI dependency.

SQLite is the default (offline demo, no external service required).
PostgreSQL works by simply changing ``DATABASE_URL`` — the code is ORM-driven
and the same `Base` metadata is used for both.
"""

from __future__ import annotations

from collections.abc import Generator

from fastapi import Request
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import settings


def _connect_args() -> dict:
    if settings.database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


engine = create_engine(
    settings.database_url,
    connect_args=_connect_args(),
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db(request: Request) -> Generator[Session, None, None]:
    """Yield a DB session. Uses the app's factory so tests can override it."""
    factory = getattr(request.app.state, "session_local", SessionLocal)
    db: Session = factory()
    try:
        yield db
    finally:
        db.close()
