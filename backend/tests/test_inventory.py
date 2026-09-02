"""Inventory intelligence: reorder alerts + depletion on completion."""

from __future__ import annotations

from app.models.inventory import InventoryItem
from tests._support import _db, make_world, register


def _add_item(client, hotel_id: int, **kw) -> int:
    db = _db(client)
    try:
        item = InventoryItem(
            hotel_id=hotel_id,
            category=kw.get("category", "LINEN"),
            name=kw["name"],
            unit=kw.get("unit", "pieces"),
            quantity=kw["quantity"],
            reorder_threshold=kw.get("reorder_threshold", 10),
            reorder_quantity=kw.get("reorder_quantity", 50),
            cost_per_unit=kw.get("cost_per_unit", 0),
        )
        db.add(item)
        db.commit()
        return item.id
    finally:
        db.close()


def _create_and_complete(client, guest, staff, title: str) -> str:
    res = client.post(
        "/api/v1/requests",
        headers=guest["headers"],
        json={"category": "Housekeeping", "title": title, "priority": "MEDIUM"},
    )
    assert res.status_code == 200, res.text
    code = res.json()["data"]["code"]
    client.patch(f"/api/v1/requests/{code}/assign", headers=staff["headers"], params={"note": "ok"})
    client.patch(f"/api/v1/requests/{code}/status", headers=staff["headers"], json={"action": "start"})
    complete = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "complete", "note": "Delivered"},
    )
    assert complete.status_code == 200
    return code


def test_inventory_list_and_low_stock_alerts(client):
    guest = register(client, "i1@test.dev")
    staff = register(client, "i1staff@test.dev", role="STAFF")
    world = make_world(client, guest, staff)
    hotel_id = world["hotel_id"]

    # Bath Towel at exactly threshold -> LOW; Shampoo at 20% of threshold -> CRITICAL
    _add_item(client, hotel_id, name="Bath Towel", quantity=20, reorder_threshold=20)
    _add_item(client, hotel_id, name="Shampoo", category="AMENITY", quantity=2, reorder_threshold=10)

    res = client.get("/api/v1/hotel/inventory", headers=staff["headers"])
    assert res.status_code == 200
    names = [it["name"] for it in res.json()["data"]["items"]]
    assert "Bath Towel" in names and "Shampoo" in names

    res = client.get("/api/v1/hotel/inventory/alerts", headers=staff["headers"])
    assert res.status_code == 200
    data = res.json()["data"]
    by_name = {a["name"]: a for a in data["alerts"]}
    assert by_name["Bath Towel"]["status"] == "LOW"
    assert by_name["Shampoo"]["status"] == "CRITICAL"
    assert data["critical"] == 1
    assert data["total"] == 2


def test_inventory_staff_only(client):
    guest = register(client, "i2@test.dev")
    staff = register(client, "i2staff@test.dev", role="STAFF")
    world = make_world(client, guest, staff)
    _add_item(client, world["hotel_id"], name="Bath Towel", quantity=20, reorder_threshold=20)

    blocked = client.get("/api/v1/hotel/inventory", headers=guest["headers"])
    assert blocked.status_code == 403
    ok = client.get("/api/v1/hotel/inventory", headers=staff["headers"])
    assert ok.status_code == 200


def test_completion_depletes_matching_item(client):
    guest = register(client, "i3@test.dev")
    staff = register(client, "i3staff@test.dev", role="STAFF")
    world = make_world(client, guest, staff)
    hotel_id = world["hotel_id"]

    db = _db(client)
    try:
        from sqlalchemy.orm import Session
        item = db.query(InventoryItem).filter(InventoryItem.name == "Bath Towel").first()
        if item is None:
            item = InventoryItem(
                hotel_id=hotel_id,
                category="LINEN",
                name="Bath Towel",
                unit="pieces",
                quantity=30,
                reorder_threshold=10,
                reorder_quantity=50,
                cost_per_unit=0,
            )
            db.add(item)
            db.commit()
        item_id = item.id
    finally:
        db.close()

    _create_and_complete(client, guest, staff, "Extra towels please")

    res = client.get("/api/v1/hotel/inventory", headers=staff["headers"])
    towel = next(it for it in res.json()["data"]["items"] if it["name"] == "Bath Towel")
    assert towel["quantity"] == 28  # 30 - 2 towels
