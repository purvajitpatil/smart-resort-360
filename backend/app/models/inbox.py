"""Guest notification inbox for the demo messaging channel.

The "WhatsApp-style" channel is a mocked transport: rows are recorded honestly
(as ``demo=True``) and logged, never sent over a real network. Event hooks
(service-request transitions, itinerary replans) write real rows as a side
effect, so every message corresponds to something that actually happened.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, CreatedAtMixin


class InboxNotification(CreatedAtMixin, Base):
    __tablename__ = "inbox_notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    channel: Mapped[str] = mapped_column(String(16), default="whatsapp", nullable=False)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    demo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
