"""Health / diagnostics endpoint. Returns DB connectivity and demo stats."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import POI, Itinerary, Room, ServiceRequest, User
from app.repositories.base import BaseRepo
from app.utils.responses import ok

router = APIRouter(tags=["health"])


@router.get("/health", summary="Service health and demo stats")
def health(db: Session = Depends(get_db)) -> dict:
    db_ok = True
    db_error = None
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - health endpoint must never 500
        db_ok = False
        db_error = str(exc)

    counts: dict = {}
    if db_ok:
        counts = {
            "users": BaseRepo(db, User).count(),
            "requests": BaseRepo(db, ServiceRequest).count(),
            "rooms": BaseRepo(db, Room).count(),
            "itineraries": BaseRepo(db, Itinerary).count(),
            "pois": BaseRepo(db, POI).count(),
        }

    return ok(
        {
            "status": "healthy" if db_ok else "degraded",
            "demo_mode": settings.demo_mode,
            "environment": settings.environment,
            "database": "available" if db_ok else "unavailable",
            "database_error": db_error,
            "counts": counts if db_ok else None,
        }
    )
