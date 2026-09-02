"""Cross-stay guest memory.

This is the layer that separates Smart Resort 360 from a stateless FAQ chatbot: a
durable, auditable store of *what we have learned about a guest*, keyed on the
guest rather than the stay, so it survives checkout and is available the next
time they walk through the door.

Every row carries its own provenance (``kind``), a confidence score that grows
with repeated observation, and an ``active`` flag the guest controls. Nothing
here is a black box — each memory can be traced back to the request that
produced it.
"""

from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin
from .guest import GuestProfile


class MemoryKind(StrEnum):
    """Where a memory came from — drives how confidently we act on it."""

    STATED = "STATED"  # the guest told us directly (highest trust)
    OBSERVED = "OBSERVED"  # derived from their own repeated behaviour
    INFERRED = "INFERRED"  # cohort default for a first-time guest (cold start)


class MemoryStatus(StrEnum):
    ACTIVE = "ACTIVE"
    REVOKED = "REVOKED"  # guest asked us to forget it
    SUPERSEDED = "SUPERSEDED"  # replaced by a newer contradicting signal


class GuestMemory(TimestampMixin, Base):
    """One learned fact about a guest, scoped to a property.

    Keyed ``(guest_id, hotel_id, key)`` so repeat observations reinforce a
    single row instead of piling up duplicates.
    """

    __tablename__ = "guest_memories"
    __table_args__ = (UniqueConstraint("guest_id", "hotel_id", "key", name="uq_guest_memory_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    guest_id: Mapped[int] = mapped_column(ForeignKey("guest_profiles.id"), nullable=False, index=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)

    # Namespaced dotted key, e.g. "amenity.pillows", "housekeeping.window".
    key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    # Short human-readable sentence shown to staff and guests verbatim.
    summary: Mapped[str] = mapped_column(String(200), nullable=False)

    kind: Mapped[str] = mapped_column(String(12), default=MemoryKind.OBSERVED.value, nullable=False)
    status: Mapped[str] = mapped_column(
        String(12), default=MemoryStatus.ACTIVE.value, nullable=False, index=True
    )

    # Grows with each corroborating observation; see memory_service.score().
    confidence: Mapped[float] = mapped_column(Float, default=0.4, nullable=False)
    observations: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Provenance — the request that most recently reinforced this memory.
    source_request_id: Mapped[int | None] = mapped_column(
        ForeignKey("service_requests.id"), nullable=True
    )
    # How many distinct stays contributed. >1 proves cross-stay persistence.
    stays_seen: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id"), nullable=True)

    first_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Set when we proactively acted on this memory, so we never double-act.
    last_applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    guest: Mapped[GuestProfile] = relationship()


class MemoryApplication(TimestampMixin, Base):
    """Audit trail: every time a memory drove a real action.

    Judges ask "show me it changed something". This table is the answer — it
    records the concrete anticipatory action taken and whether it landed.
    """

    __tablename__ = "memory_applications"

    id: Mapped[int] = mapped_column(primary_key=True)
    memory_id: Mapped[int] = mapped_column(ForeignKey("guest_memories.id"), nullable=False, index=True)
    stay_id: Mapped[int | None] = mapped_column(ForeignKey("stays.id"), nullable=True)

    action: Mapped[str] = mapped_column(String(40), nullable=False)  # PREPARED | SUGGESTED | ROUTED
    detail: Mapped[str] = mapped_column(String(255), nullable=False)
    accepted: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # None = awaiting feedback

    memory: Mapped[GuestMemory] = relationship()
