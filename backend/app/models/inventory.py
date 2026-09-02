"""Housekeeping / F&B inventory that depletes as requests are fulfilled."""

from __future__ import annotations

from sqlalchemy import Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base, TimestampMixin


class InventoryItem(TimestampMixin, Base):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    hotel_id: Mapped[int] = mapped_column(ForeignKey("hotels.id"), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(40), nullable=False)  # LINEN | AMENITY | FNB
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)      # pieces | kg | litres
    quantity: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    reorder_threshold: Mapped[float] = mapped_column(Float, default=10.0, nullable=False)
    reorder_quantity: Mapped[float] = mapped_column(Float, default=50.0, nullable=False)
    cost_per_unit: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)


__all__ = ["InventoryItem"]
