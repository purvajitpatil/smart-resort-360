"""Inventory intelligence: track depletion and flag reorder points.

Every completed housekeeping / F&B request that mentions a consumable
(linen, towels, water, etc.) depletes the corresponding stock. The service
turns that into a living reorder signal staff can act on, instead of a
static spreadsheet count.

Keyword mapping is explicit and testable (no freeform NLP to defend).
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem
from app.models.requests import ServiceRequest

CRITICAL_FRACTION = 0.3  # quantity <= 30% of threshold counts as CRITICAL

# (keyword) -> (inventory item name substring, units consumed)
CONSUMPTION_MAP: dict[str, tuple[str, float]] = {
    "towel": ("Towel", 2.0),
    "pillow": ("Pillow", 1.0),
    "linen": ("Linen", 1.0),
    "bed sheet": ("Bed Sheet", 1.0),
    "blanket": ("Blanket", 1.0),
    "water": ("Water", 1.0),
    "coffee": ("Coffee", 2.0),
    "tea": ("Tea", 2.0),
    "shampoo": ("Shampoo", 1.0),
    "soap": ("Soap", 1.0),
    "toothbrush": ("Toothbrush", 1.0),
}


def consume_on_complete(db: Session, req: ServiceRequest) -> None:
    """Deduct inventory for a completed request and flag low stock."""
    text = f"{req.title} {req.description or ''}".lower()
    for keyword, (item_substr, amount) in CONSUMPTION_MAP.items():
        if keyword in text:
            item = (
                db.query(InventoryItem)
                .filter(
                    InventoryItem.hotel_id == req.hotel_id,
                    InventoryItem.name.ilike(f"%{item_substr}%"),
                )
                .first()
            )
            if item:
                item.quantity = max(0.0, item.quantity - amount)
                db.add(item)


def list_items(db: Session, hotel_id: int) -> list[dict]:
    rows = (
        db.query(InventoryItem)
        .filter(InventoryItem.hotel_id == hotel_id)
        .order_by(InventoryItem.category, InventoryItem.name)
        .all()
    )
    return [_to_dict(i) for i in rows]


def low_stock_alerts(db: Session, hotel_id: int) -> list[dict]:
    items = (
        db.query(InventoryItem)
        .filter(InventoryItem.hotel_id == hotel_id)
        .all()
    )
    alerts = []
    for item in items:
        if item.quantity > item.reorder_threshold:
            continue
        status = (
            "CRITICAL"
            if item.quantity <= item.reorder_threshold * CRITICAL_FRACTION
            else "LOW"
        )
        alerts.append(
            {
                **{k: v for k, v in _to_dict(item).items() if k not in {"status"}},
                "status": status,
                "reorder_quantity": item.reorder_quantity,
                "cost_per_unit": item.cost_per_unit,
            }
        )
    alerts.sort(key=lambda a: (a["status"] != "CRITICAL", a["quantity"]))
    return alerts


def _to_dict(item: InventoryItem) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "category": item.category,
        "unit": item.unit,
        "quantity": item.quantity,
        "reorder_threshold": item.reorder_threshold,
    }


__all__ = ["consume_on_complete", "list_items", "low_stock_alerts"]
