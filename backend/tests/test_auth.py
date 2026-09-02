"""Authentication API tests: register/login/refresh/me/logout + RBAC + rate limit."""

from __future__ import annotations

from datetime import UTC

from fastapi.testclient import TestClient

from app.config import settings
from app.middleware import rate_limiter

REGISTER_URL = "/api/v1/auth/register"
LOGIN_URL = "/api/v1/auth/login"
REFRESH_URL = "/api/v1/auth/refresh"
ME_URL = "/api/v1/auth/me"
LOGOUT_URL = "/api/v1/auth/logout"
ADMIN_USERS_URL = "/api/v1/admin/users"


def _register(
    client: TestClient,
    email: str,
    password: str = "SomePass!2026",
    name: str = "Test User",
    role: str = "GUEST",
) -> dict:
    resp = client.post(
        REGISTER_URL, json={"email": email, "password": password, "full_name": name, "role": role}
    )
    assert resp.status_code == 200
    return resp.json()["data"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_register_success(client) -> None:
    data = _register(client, "alice@example.com")
    assert data["access_token"]
    assert data["refresh_token"]
    assert data["token_type"] == "bearer"
    assert data["expires_in"] == settings.access_token_expire_minutes * 60
    assert data["user"]["email"] == "alice@example.com"
    assert data["user"]["role"] == "GUEST"
    assert data["user"]["is_active"] is True


def test_register_duplicate_email(client) -> None:
    _register(client, "bob@example.com")
    resp = client.post(
        REGISTER_URL,
        json={
            "email": "bob@example.com",
            "password": "SomePass!2026",
            "full_name": "Bob Again",
            "role": "GUEST",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["error"]["code"] == "EMAIL_EXISTS"


def test_register_weak_password_rejected(client) -> None:
    resp = client.post(
        REGISTER_URL,
        json={"email": "weak@example.com", "password": "short", "full_name": "Weak", "role": "GUEST"},
    )
    assert resp.status_code == 422
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_register_invalid_role(client) -> None:
    resp = client.post(
        REGISTER_URL,
        json={
            "email": "hacker@example.com",
            "password": "SomePass!2026",
            "full_name": "Hacker",
            "role": "SUPER_ADMIN",
        },
    )
    assert resp.status_code == 422


def test_login_bad_credentials(client) -> None:
    _register(client, "carol@example.com")
    resp = client.post(LOGIN_URL, json={"email": "carol@example.com", "password": "WrongPass!2026"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_unknown_user(client) -> None:
    resp = client.post(LOGIN_URL, json={"email": "ghost@example.com", "password": "SomePass!2026"})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_and_me(client) -> None:
    _register(client, "dave@example.com", name="Dave Rodda")
    login = client.post(LOGIN_URL, json={"email": "dave@example.com", "password": "SomePass!2026"})
    assert login.status_code == 200
    token = login.json()["data"]["access_token"]

    me = client.get(ME_URL, headers=_auth(token))
    assert me.status_code == 200
    assert me.json()["data"]["email"] == "dave@example.com"


def test_me_requires_token(client) -> None:
    resp = client.get(ME_URL)
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"

    bad = client.get(ME_URL, headers=_auth("not-a-jwt"))
    assert bad.status_code == 401
    assert bad.json()["error"]["code"] == "TOKEN_INVALID"


def test_refresh_rotates_tokens(client) -> None:
    data = _register(client, "erin@example.com")
    resp = client.post(REFRESH_URL, json={"refresh_token": data["refresh_token"]})
    assert resp.status_code == 200
    refreshed = resp.json()["data"]
    assert refreshed["access_token"] != data["access_token"]
    assert refreshed["refresh_token"] != data["refresh_token"]
    assert refreshed["user"]["id"] == data["user"]["id"]


def test_refresh_rejects_access_token_and_garbage(client) -> None:
    data = _register(client, "frank@example.com")
    garbage = client.post(REFRESH_URL, json={"refresh_token": "garbage"})
    assert garbage.status_code == 401
    assert garbage.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"

    wrong_type = client.post(REFRESH_URL, json={"refresh_token": data["access_token"]})
    assert wrong_type.status_code == 401
    assert wrong_type.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


def test_logout(client) -> None:
    data = _register(client, "grace@example.com")
    resp = client.post(LOGOUT_URL, headers=_auth(data["access_token"]))
    assert resp.status_code == 200
    assert resp.json()["data"] == {"status": "ok"}


def test_admin_endpoint_rbac(client) -> None:
    guest = _register(client, "guest@rbac.example", role="GUEST")
    staff = _register(client, "staff@rbac.example", role="STAFF")
    admin = _register(client, "admin@rbac.example", role="ADMIN")

    denied_guest = client.get(ADMIN_USERS_URL, headers=_auth(guest["access_token"]))
    assert denied_guest.status_code == 403
    assert denied_guest.json()["error"]["code"] == "FORBIDDEN"

    denied_staff = client.get(ADMIN_USERS_URL, headers=_auth(staff["access_token"]))
    assert denied_staff.status_code == 403

    allowed = client.get(ADMIN_USERS_URL, headers=_auth(admin["access_token"]))
    assert allowed.status_code == 200
    assert allowed.json()["success"] is True


def test_rate_limit_429(client) -> None:
    original = settings.rate_limit_per_minute
    settings.rate_limit_per_minute = 3
    rate_limiter.limit = 3
    rate_limiter._hits.clear()
    try:
        responses = [client.get("/api/v1/health") for _ in range(4)]
        assert [r.status_code for r in responses[:3]] == [200, 200, 200]
        assert responses[3].status_code == 429
        assert responses[3].json()["error"]["code"] == "RATE_LIMITED"
    finally:
        settings.rate_limit_per_minute = original
        rate_limiter.limit = original
        rate_limiter._hits.clear()


def test_expired_token_rejected(client) -> None:
    from datetime import datetime, timedelta

    import jwt as pyjwt

    now = datetime.now(UTC)
    expired = pyjwt.encode(
        {
            "sub": "1",
            "type": "access",
            "iat": now - timedelta(hours=1),
            "exp": now - timedelta(minutes=1),
            "jti": "expired-jti",
        },
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    resp = client.get(ME_URL, headers=_auth(expired))
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "TOKEN_EXPIRED"
