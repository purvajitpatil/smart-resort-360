"""Consistent API responses and errors.

Every endpoint returns::

    {"success": bool, "data": {...} | null, "error": {...} | null, "meta": {...}}

Errors use machine-readable codes so clients can branch reliably.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException


class ApiError(HTTPException):
    """Structured domain error (always serialized as the envelope below)."""

    def __init__(self, status_code: int, code: str, message: str, *, fallback_used: bool = False) -> None:
        super().__init__(
            status_code=status_code,
            detail={"code": code, "message": message, "fallback_used": fallback_used},
        )


def ok(data: Any | None = None, meta: dict | None = None) -> dict:
    return {"success": True, "data": data, "error": None, "meta": meta or {}}


def fail(detail: dict) -> dict:
    return {"success": False, "data": None, "error": detail, "meta": {}}


def error_envelope(detail: Any) -> dict:
    """Normalize a FastAPI detail (dict or list) into the error envelope shape."""
    if isinstance(detail, dict):
        error = detail
    elif isinstance(detail, list):
        joined = "; ".join(f"{e.get('loc', '')}: {e.get('msg', '')}" for e in detail)
        error = {"code": "VALIDATION_ERROR", "message": joined or "Invalid input.", "fallback_used": False}
    else:
        error = {"code": "ERROR", "message": str(detail), "fallback_used": False}
    return fail(error)
