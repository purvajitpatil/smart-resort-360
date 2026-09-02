"""Admin / system endpoints (ADMIN-only). Useful for RBAC demos and resetting."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_admin
from app.database import get_db
from app.models import POI, Room, ServiceRequest, Stay, User
from app.models.auth import User as AuthUser
from app.utils.responses import ok

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users", summary="List users (admin only)")
def list_users(db: Session = Depends(get_db), _: AuthUser = Depends(require_admin)) -> dict:
    users = [
        {"id": u.id, "email": u.email, "role": u.role, "active": u.is_active} for u in db.query(User).all()
    ]
    return ok(users, {"count": len(users)})


@router.get("/stats", summary="Demo statistics (admin only)")
def stats(db: Session = Depends(get_db), _: AuthUser = Depends(require_admin)) -> dict:
    return ok(
        {
            "users": db.query(User).count(),
            "rooms": db.query(Room).count(),
            "active_stays": db.query(Stay).filter(Stay.status == "ACTIVE").count(),
            "service_requests": db.query(ServiceRequest).count(),
            "pois": db.query(POI).count(),
        }
    )
