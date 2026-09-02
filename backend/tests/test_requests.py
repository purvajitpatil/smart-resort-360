"""Service-request lifecycle: guest create/cancel/list, staff board + transitions."""

from __future__ import annotations

from tests._support import make_world, register

PAYLOAD = {"category": "Housekeeping", "title": "Extra pillows", "priority": "MEDIUM"}


def test_guest_create_requires_active_stay(client):
    guest = register(client, "r1@test.dev")
    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "NO_ACTIVE_STAY"


def test_full_lifecycle(client):
    guest = register(client, "r2@test.dev")
    staff = register(client, "r2staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    assert res.status_code == 200, res.text
    created = res.json()["data"]
    assert created["code"].startswith("SR-")
    assert created["status"] == "PENDING"
    assert created["priority"] == "MEDIUM"
    # SLA is category-aware: Housekeeping base 45 min, scaled 0.75 for MEDIUM.
    assert created["sla_minutes"] == 33
    assert created["room_number"] == "101"
    assert created["department"] == "Housekeeping"
    assert created["sla_deadline"] is not None
    assert len(created["history"]) == 1
    code = created["code"]

    mine = client.get("/api/v1/requests/mine", headers=guest["headers"])
    assert mine.status_code == 200
    assert mine.json()["data"]["total"] == 1

    board = client.get("/api/v1/requests", headers=staff["headers"])
    assert board.status_code == 200
    assert board.json()["data"]["total"] == 1

    detail = client.get(f"/api/v1/requests/{code}", headers=staff["headers"])
    assert detail.status_code == 200
    assert detail.json()["data"]["guest_name"] == "Test GUEST"

    assign = client.patch(
        f"/api/v1/requests/{code}/assign",
        headers=staff["headers"],
        params={"note": "On my way"},
    )
    assert assign.status_code == 200
    assert assign.json()["data"]["status"] == "ASSIGNED"
    assert assign.json()["data"]["assigned_to"] == "Test STAFF"

    start = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "start"},
    )
    assert start.status_code == 200
    assert start.json()["data"]["status"] == "IN_PROGRESS"

    complete = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "complete", "note": "Delivered"},
    )
    assert complete.status_code == 200
    assert complete.json()["data"]["status"] == "COMPLETED"
    assert complete.json()["data"]["resolved_at"] is not None
    assert len(complete.json()["data"]["history"]) == 4

    gone = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "start"},
    )
    assert gone.status_code == 409
    assert gone.json()["error"]["code"] == "INVALID_TRANSITION"


def test_guest_cancel_only_own_pending(client):
    guest = register(client, "r3@test.dev")
    other = register(client, "r3other@test.dev")
    staff = register(client, "r3staff@test.dev", role="STAFF")
    make_world(client, guest, staff)
    make_world(client, other)

    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    code = res.json()["data"]["code"]

    cancel = client.post(f"/api/v1/requests/{code}/cancel", headers=guest["headers"])
    assert cancel.status_code == 200
    assert cancel.json()["data"]["status"] == "CANCELLED"
    assert cancel.json()["data"]["resolved_at"] is not None

    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    code2 = res.json()["data"]["code"]
    forbidden = client.post(f"/api/v1/requests/{code2}/cancel", headers=other["headers"])
    assert forbidden.status_code == 403
    assert forbidden.json()["error"]["code"] == "FORBIDDEN"


def test_staff_list_guarded_for_guests(client):
    guest = register(client, "r4@test.dev")
    staff = register(client, "r4staff@test.dev", role="STAFF")
    make_world(client, guest, staff)
    res = client.get("/api/v1/requests", headers=guest["headers"])
    assert res.status_code == 403
    assert res.json()["error"]["code"] == "FORBIDDEN"

    stats = client.get("/api/v1/requests/queue/stats", headers=staff["headers"])
    assert stats.status_code == 200
    data = stats.json()["data"]
    assert data["open_count"] == 0


def test_staff_assign_requiring_duty_profile(client):
    guest = register(client, "r5@test.dev")
    freelancer = register(client, "r5free@test.dev", role="STAFF")
    make_world(client, guest)
    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    code = res.json()["data"]["code"]
    res = client.patch(f"/api/v1/requests/{code}/assign", headers=freelancer["headers"])
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "NO_STAFF_PROFILE"


def test_detail_guarded_to_owner_or_staff(client):
    guest = register(client, "r6@test.dev")
    other = register(client, "r6other@test.dev")
    staff = register(client, "r6staff@test.dev", role="STAFF")
    make_world(client, guest, staff)
    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    code = res.json()["data"]["code"]
    assert client.get(f"/api/v1/requests/{code}", headers=guest["headers"]).status_code == 200
    assert client.get(f"/api/v1/requests/{code}", headers=staff["headers"]).status_code == 200
    res = client.get(f"/api/v1/requests/{code}", headers=other["headers"])
    assert res.status_code == 403
