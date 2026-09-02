"""ASGI middleware: request-id, structured access logging, security headers,
request-size limiting and in-memory rate limiting."""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings
from app.utils.rate_limit import rate_limiter

log = logging.getLogger("smartresort360.access")


class RequestContextMiddleware:
    """Attach a request_id to every request and emit structured access logs."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = uuid.uuid4().hex
        start = time.perf_counter()

        async def send_envelope(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                headers = list(headers) + [(b"x-request-id", request_id.encode())]
                message = {**message, "headers": headers}
                log.info(
                    json.dumps(
                        {
                            "request_id": request_id,
                            "method": scope.get("method"),
                            "path": scope.get("path"),
                            "status": message.get("status"),
                            "duration_ms": round((time.perf_counter() - start) * 1000, 2),
                            "client": scope.get("client")[0] if scope.get("client") else None,
                        }
                    )
                )
            await send(message)

        scope.setdefault("state", {})["request_id"] = request_id
        await self.app(scope, receive, send_envelope)


def _client_ip(scope: Scope) -> str:
    scope_state = scope.get("state", {})
    forwarded = scope_state.get("x_forwarded_for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    client = scope.get("client")
    return client[0] if client else "unknown"


class RateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app
        rate_limiter.limit = settings.rate_limit_per_minute

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope["path"].startswith("/static"):
            await self.app(scope, receive, send)
            return

        allowed, retry_after = rate_limiter.allow(_client_ip(scope))
        if not allowed:
            body = json.dumps(
                {
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": "Too many requests. Slow down.",
                        "fallback_used": False,
                    },
                    "meta": {},
                }
            ).encode("utf-8")

            async def send_429(message: Message) -> None:
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    headers += [
                        (b"retry-after", str(retry_after).encode()),
                        (b"content-type", b"application/json"),
                    ]
                    message = {**message, "headers": headers}
                elif message["type"] == "http.response.body":
                    message = {**message, "body": body}
                await send(message)

            await send({"type": "http.response.start", "status": 429, "headers": []})
            await send({"type": "http.response.body", "body": body})
            return

        await self.app(scope, receive, send)


class SecurityHeadersMiddleware:
    """Baseline hardening headers on every response."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers += [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"strict-origin-when-cross-origin"),
                ]
                message = {**message, "headers": headers}
            await send(message)

        await self.app(scope, receive, send_headers)


class BodySizeMiddleware:
    """Reject oversized request bodies before they reach handlers."""

    def __init__(self, app: ASGIApp, max_bytes: int = settings.max_body_bytes) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        received = 0

        async def receiver() -> Message:
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_bytes:
                    raise _BodyTooLargeError()
            return message

        try:
            await self.app(scope, receiver, send)
        except _BodyTooLargeError:
            body = json.dumps(
                {
                    "success": False,
                    "data": None,
                    "error": {
                        "code": "BODY_TOO_LARGE",
                        "message": f"Request body exceeds the {self.max_bytes} byte limit.",
                        "fallback_used": False,
                    },
                    "meta": {},
                }
            ).encode("utf-8")
            await send(
                {
                    "type": "http.response.start",
                    "status": 413,
                    "headers": [(b"content-type", b"application/json")],
                }
            )
            await send({"type": "http.response.body", "body": body})


class _BodyTooLargeError(Exception):
    pass
