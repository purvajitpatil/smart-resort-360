"""Guest sentiment: rating a completed request feeds the staff summary."""

from __future__ import annotations

from tests._support import make_world, register

PAYLOAD = {"category": "Housekeeping", "title": "Extra pillows", "priority": "MEDIUM"}


def _create_and_complete(client, guest, staff) -> str:
    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    assert res.status_code == 200, res.text
    code = res.json()["data"]["code"]
    assign = client.patch(
        f"/api/v1/requests/{code}/assign",
        headers=staff["headers"],
        params={"note": "Assigning"},
    )
    assert assign.status_code == 200
    start = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "start"},
    )
    assert start.status_code == 200
    complete = client.patch(
        f"/api/v1/requests/{code}/status",
        headers=staff["headers"],
        json={"action": "complete", "note": "Delivered"},
    )
    assert complete.status_code == 200
    assert complete.json()["data"]["status"] == "COMPLETED"
    return code


def test_cannot_rate_uncompleted(client):
    guest = register(client, "s1@test.dev")
    staff = register(client, "s1staff@test.dev", role="STAFF")
    make_world(client, guest, staff)

    res = client.post("/api/v1/requests", headers=guest["headers"], json=PAYLOAD)
    code = res.json()["data"]["code"]

    rate = client.post(
        f"/api/v1/requests/mine/{code}/rate",
        headers=guest["headers"],
        json={"rating": 5},
    )
    assert rate.status_code == 409
    assert rate.json()["error"]["code"] == "NOT_COMPLETED"


def test_rate_completed_updates_summary_and_user_rating(client):
    guest = register(client, "s2@test.dev")
    staff = register(client, "s2staff@test.dev", role="STAFF")
    make_world(client, guest, staff)
    code = _create_and_complete(client, guest, staff)

    rate = client.post(
        f"/api/v1/requests/mine/{code}/rate",
        headers=guest["headers"],
        json={"rating": 4, "comment": "Handled quickly"},
    )
    assert rate.status_code == 200
    assert rate.json()["data"] == {"rated": True, "code": code, "rating": 4}

    # guest list reflects the rating
    mine = client.get("/api/v1/requests/mine", headers=guest["headers"])
    assert mine.status_code == 200
    assert mine.json()["data"]["items"][0]["user_rating"] == 4

    # staff summary picks it up
    summary = client.get("/api/v1/hotel/sentiment", headers=staff["headers"])
    assert summary.status_code == 200
    data = summary.json()["data"]
    assert data["total_rated"] == 1
    assert data["overall"] == 4.0
    assert data["by_category"][0]["category"] == "Housekeeping"
    assert data["by_category"][0]["avg"] == 4.0

    # guests cannot read the staff sentiment endpoint
    blocked = client.get("/api/v1/hotel/sentiment", headers=guest["headers"])
    assert blocked.status_code == 403


def test_rerate_overwrites_not_duplicates(client):
    guest = register(client, "s3@test.dev")
    staff = register(client, "s3staff@test.dev", role="STAFF")
    make_world(client, guest, staff)
    code = _create_and_complete(client, guest, staff)

    client.post(
        f"/api/v1/requests/mine/{code}/rate",
        headers=guest["headers"],
        json={"rating": 2},
    )
    client.post(
        f"/api/v1/requests/mine/{code}/rate",
        headers=guest["headers"],
        json={"rating": 5},
    )

    summary = client.get("/api/v1/hotel/sentiment", headers=staff["headers"])
    assert summary.json()["data"]["total_rated"] == 1
    assert summary.json()["data"]["overall"] == 5.0
