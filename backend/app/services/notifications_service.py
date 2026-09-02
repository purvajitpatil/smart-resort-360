"""Guest notification inbox (WhatsApp-style demo channel).

Transport is mocked and clearly labelled: ``send`` writes a real row and logs
the "message" as a demo send (``demo=True`` lives on the row). Hook call sites
run after their own ``commit``, so this service commits its own transaction.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.guest import GuestProfile
from app.models.inbox import InboxNotification
from app.schemas.concierge import NotificationOut, NotificationsOut

log = logging.getLogger("smartresort360.notifications")

_DEFAULT_CHANNEL = "whatsapp"


def _mock_send(channel: str, guest_id: int, title: str, body: str) -> None:
    """Demo transport: log instead of dialling any real messaging provider."""
    log.info("[%s → guest %s] %s — %s", channel, guest_id, title, body)


def send(
    db: Session,
    guest_id: int,
    title: str,
    body: str,
    *,
    channel: str = _DEFAULT_CHANNEL,
) -> NotificationOut:
    _mock_send(channel, guest_id, title, body)
    row = InboxNotification(guest_id=guest_id, channel=channel, title=title, body=body, demo=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _to_out(row)


def list_for(db: Session, profile: GuestProfile) -> NotificationsOut:
    rows = (
        db.query(InboxNotification)
        .filter(InboxNotification.guest_id == profile.id)
        .order_by(InboxNotification.created_at.desc(), InboxNotification.id.desc())
        .limit(50)
        .all()
    )
    items = [_to_out(r) for r in rows]
    return NotificationsOut(items=items, total=len(items), unread=sum(1 for i in items if not i.read))


def mark_read(db: Session, profile: GuestProfile, notification_id: int) -> NotificationOut:
    row = db.get(InboxNotification, notification_id)
    if row is None or row.guest_id != profile.id:
        from app.utils.responses import ApiError

        raise ApiError(404, "NOTIFICATION_NOT_FOUND", "No such notification for this guest.")
    if row.read_at is None:
        from datetime import UTC, datetime

        row.read_at = datetime.now(UTC)
        db.commit()
    return _to_out(row)


def mark_all_read(db: Session, profile: GuestProfile) -> int:
    rows = (
        db.query(InboxNotification)
        .filter(InboxNotification.guest_id == profile.id, InboxNotification.read_at.is_(None))
        .all()
    )
    from datetime import UTC, datetime

    now = datetime.now(UTC)
    for row in rows:
        row.read_at = now
    if rows:
        db.commit()
    return len(rows)


def demo_guest(db: Session) -> GuestProfile | None:
    from app.config import settings
    from app.models.auth import User

    user = db.query(User).filter(User.email == settings.demo_guest_email).first()
    if user is None:
        return None
    return db.query(GuestProfile).filter(GuestProfile.user_id == user.id).first()


def _to_out(row: InboxNotification) -> NotificationOut:
    return NotificationOut(
        id=row.id,
        channel=row.channel,
        title=row.title,
        body=row.body,
        read=row.read_at is not None,
        demo=row.demo,
        created_at=row.created_at.isoformat(timespec="seconds"),
    )
