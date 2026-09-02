"""POI catalogue + recommendation API (guest + staff can browse)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.auth import User
from app.models.travel import POI
from app.schemas.travel import POIOut
from app.services import guest_service, recommend_service
from app.utils import responses
from app.utils.responses import ApiError

router = APIRouter(tags=["travel"])


@router.get("/pois")
def browse_pois(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
    category: str | None = None,
    q: str | None = None,
    limit: int = 50,
) -> dict:
    return responses.ok(
        recommend_service.catalogue(
            db,
            category=category,
            q=q,
            limit=min(limit, 100),
        ).model_dump()
    )


@router.get("/pois/{poi_id}")
def poi_detail(
    poi_id: int,
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    poi = db.get(POI, poi_id)
    if poi is None:
        raise ApiError(404, "POI_NOT_FOUND", f"No point of interest with id {poi_id}.")
    return responses.ok(POIOut.model_validate(poi))


@router.get("/recommendations")
def recommend(
    _user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    refresh: bool = False,
    category: str | None = None,
    limit: int = 10,
) -> dict:
    profile = guest_service.get_or_create_profile(db, _user)
    result = (
        recommend_service.recommend(db, profile, limit=min(limit, 25), category=category)
        if refresh or category
        else recommend_service.latest(db, profile)
    )
    return responses.ok(result.model_dump())
