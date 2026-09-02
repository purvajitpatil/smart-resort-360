"""Shared test fixtures: an in-memory SQLite app with seeding disabled."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import create_app
from app.utils.rate_limit import rate_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiter() -> None:
    """Reset the shared in-memory limiter so tests don't trip it cumulatively."""
    rate_limiter._hits.clear()


@pytest.fixture()
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)
    app = create_app(session_factory=testing_session, seed_on_startup=False)
    with TestClient(app) as test_client:
        yield test_client
