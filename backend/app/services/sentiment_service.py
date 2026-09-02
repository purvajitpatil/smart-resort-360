"""Guest sentiment: request-level ratings feeding a staff-facing summary.

A request is only worth rating once it's COMPLETED — a pending or in-progress
request has not been delivered, so asking for feedback then would be noise.
Ratings persist in the existing ``Feedback`` table keyed to the request, so a
re-rate simply overwrites the prior score rather than creating duplicates.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.guest import GuestProfile
from app.models.payments import Feedback
from app.models.requests import RequestStatus, ServiceRequest
from app.utils.responses import ApiError

_SENTIMENT_WINDOW_DAYS = 30


def rate_request(
    db: Session,
    profile: GuestProfile,
    code: str,
    rating: int,
    comment: str | None = None,
) -> dict:
    """Record or update a guest's rating for a completed request they own."""
    rating = max(1, min(5, rating))

    req = (
        db.query(ServiceRequest)
        .filter(
            ServiceRequest.code == code,
            ServiceRequest.guest_id == profile.id,
        )
        .first()
    )
    if req is None:
        raise ApiError(404, "REQUEST_NOT_FOUND", f"No service request with code {code!r}.")
    if req.status != RequestStatus.COMPLETED.value:
        raise ApiError(
            409,
            "NOT_COMPLETED",
            "You can only rate a request once it has been completed.",
        )

    existing = (
        db.query(Feedback)
        .filter(
            Feedback.guest_id == profile.id,
            Feedback.request_id == req.id,
        )
        .first()
    )
    if existing:
        existing.rating = rating
        existing.comment = comment or existing.comment
        existing.category = req.category
    else:
        db.add(
            Feedback(
                guest_id=profile.id,
                stay_id=req.stay_id,
                request_id=req.id,
                rating=rating,
                category=req.category,
                comment=comment,
            )
        )
    db.commit()
    return {"rated": True, "code": code, "rating": rating}


def sentiment_summary(db: Session, hotel_id: int) -> dict:
    """Aggregate ratings by category over the trailing window."""
    cutoff = datetime.now(UTC) - timedelta(days=_SENTIMENT_WINDOW_DAYS)

    rows = db.execute(
        select(
            Feedback.category,
            func.avg(Feedback.rating).label("avg_rating"),
            func.count(Feedback.id).label("rated_count"),
        )
        .where(
            Feedback.category.isnot(None),
            Feedback.created_at >= cutoff,
        )
        .group_by(Feedback.category)
    ).all()

    by_category = [
        {
            "category": cat,
            "avg": round(float(avg), 2),
            "rated": int(count),
        }
        for cat, avg, count in rows
        if avg is not None
    ]
    by_category.sort(key=lambda c: c["avg"], reverse=True)

    total_rows = db.execute(
        select(func.avg(Feedback.rating)).where(Feedback.created_at >= cutoff)
    ).scalar_one()
    total_rated = int(
        db.execute(
            select(func.count(Feedback.id)).where(Feedback.created_at >= cutoff)
        ).scalar_one()
    )

    return {
        "by_category": by_category,
        "overall": round(float(total_rows), 2) if total_rows else 0.0,
        "total_rated": total_rated,
        "window_days": _SENTIMENT_WINDOW_DAYS,
    }


def rating_distribution(db: Session, hotel_id: int) -> dict[str, int]:
    """Count of each star rating (1..5) across the window, for a histogram."""
    cutoff = datetime.now(UTC) - timedelta(days=_SENTIMENT_WINDOW_DAYS)
    rows = db.execute(
        select(Feedback.rating, func.count(Feedback.id))
        .where(Feedback.created_at >= cutoff)
        .group_by(Feedback.rating)
    ).all()
    return {str(rating): int(count) for rating, count in rows}


__all__ = ["rate_request", "sentiment_summary", "rating_distribution"]
