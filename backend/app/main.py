"""FastAPI application factory.

``create_app`` builds the app so tests can supply their own session factory and
skip seeding while production boots normally. All middleware order matters: the
first ``add_middleware`` call becomes the outermost layer.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, sessionmaker
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import admin as admin_api
from app.api import auth as auth_api
from app.api import concierge as concierge_api
from app.api import guest as guest_api
from app.api import health as health_api
from app.api import hotel as hotel_api
from app.api import memory as memory_api
from app.api import planner as planner_api
from app.api import requests as requests_api
from app.api import travel as travel_api
from app.config import settings
from app.database import SessionLocal
from app.middleware import (
    BodySizeMiddleware,
    RateLimitMiddleware,
    RequestContextMiddleware,
    SecurityHeadersMiddleware,
)
from app.models import Base
from app.utils.responses import error_envelope, ok

log = logging.getLogger("smartresort360.app")


def create_app(session_factory: sessionmaker | None = None, seed_on_startup: bool | None = None) -> FastAPI:
    factory = session_factory or SessionLocal
    do_seed = settings.seed_on_startup if seed_on_startup is None else seed_on_startup

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        # In-memory SQLite ties data to a single engine/connection, so create
        # tables and seed through the same session factory the app will use.
        db: Session = factory()
        try:
            Base.metadata.create_all(db.get_bind())
            if do_seed:
                from app.seed.seed import seed_database

                counts = seed_database(db)
                log.info("Seed complete: %s", counts)
        except Exception as exc:  # noqa: BLE001 - never crash the API because of seed data
            log.exception("Database init/seed failed: %s", exc)
        finally:
            db.close()
        yield

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "Full-stack smart-stay platform: guest app, staff dashboard, "
            "constraint-optimized itineraries and an AI concierge."
        ),
        lifespan=lifespan,
        openapi_tags=[
            {"name": "auth", "description": "Registration, login, refresh and session info."},
            {"name": "admin", "description": "Admin-only demo utilities."},
            {"name": "guest", "description": "Guest profile, preferences and current stay."},
            {"name": "hotel", "description": "Staff-facing hotel overview and room state."},
            {"name": "requests", "description": "Service-request lifecycle (guest + staff)."},
            {"name": "travel", "description": "POI catalogue and explainable recommendations."},
            {"name": "planner", "description": "Optimized itineraries, replanning and weather capture."},
            {
                "name": "concierge",
                "description": "Chat concierge with real tool calls + WhatsApp-style notifications.",
            },
            {
                "name": "memory",
                "description": "Cross-stay guest memory and SLA escalation.",
            },
            {"name": "health", "description": "Liveness and diagnostics."},
        ],
    )

    app.state.session_local = factory
    app.state.settings = settings
    if settings.debug:
        logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    # Middleware: outermost first.
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(BodySizeMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers.
    app.include_router(auth_api.router, prefix=settings.api_prefix)
    app.include_router(admin_api.router, prefix=settings.api_prefix)
    app.include_router(guest_api.router, prefix=settings.api_prefix)
    app.include_router(hotel_api.router, prefix=settings.api_prefix)
    app.include_router(requests_api.router, prefix=settings.api_prefix)
    app.include_router(travel_api.router, prefix=settings.api_prefix)
    app.include_router(planner_api.router, prefix=settings.api_prefix)
    app.include_router(concierge_api.router, prefix=settings.api_prefix)
    app.include_router(memory_api.router, prefix=settings.api_prefix)
    app.include_router(health_api.router, prefix=settings.api_prefix)

    @app.get("/", tags=["health"])
    def root() -> dict:
        return ok(
            {
                "name": settings.app_name,
                "docs": "/docs",
                "health": f"{settings.api_prefix}/health",
            }
        )

    # ---- Error handlers ------------------------------------------------------------
    # Starlette's HTTPException shadows FastAPI's during MRO lookup, so both
    # classes are registered: 404/405 routing errors and our ApiError subclasses.
    @app.exception_handler(StarletteHTTPException)
    async def starlette_http_handler(_request: Request, exc: StarletteHTTPException):
        return await _json_response(status_code=exc.status_code, body=error_envelope(exc.detail))

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        return await _json_response(status_code=exc.status_code, body=error_envelope(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request: Request, exc: RequestValidationError):
        return await _json_response(status_code=422, body=error_envelope(exc.errors()))

    @app.exception_handler(Exception)
    async def unhandled_handler(_request: Request, exc: Exception):
        if settings.debug:
            raise exc
        log.exception("Unhandled error: %s", exc)
        return await _json_response(
            status_code=500,
            body={
                "success": False,
                "data": None,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": "Something went wrong.",
                    "fallback_used": False,
                },
                "meta": {},
            },
        )

    settings.require_strong_secret()
    return app


async def _json_response(status_code: int, body: object):
    from starlette.responses import JSONResponse

    return JSONResponse(status_code=status_code, content=body)


# Module-level instance for `uvicorn app.main:app`. Tests build their own via
# create_app() with an isolated session factory instead.
app = create_app()
