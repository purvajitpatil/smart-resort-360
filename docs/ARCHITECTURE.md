# StaySmart — Architecture

## System overview

Full-stack, modular-monolith "smart stay" platform.

```
Browser
  guest-web (Vite+React+TS, :5173)   /   staff-dashboard (Vite+React+TS, :5174)
        │  REST /api/v1 (Bearer JWT)                │
        ▼                                          ▼
   FastAPI app  (uvicorn, :8000)
        │
   ┌────┼──────────────┬──────────────────┐
   ▼    ▼              ▼                  ▼
  Auth  Hotels ·      Travel ·         AI concierge     (live)
  ·rooms guests      POIs ·recommend    ·chat ·tools
  ·service-req      ·optimizer ·       ·disrupt/replan
  ·notifications     itinerary          ·WhatsApp-style
        │                                inbox
        ▼
  SQLAlchemy 2.0  --->  SQLite (offline demo)  |  PostgreSQL 16 (docker)
```

## Backend layering (strict)

| Layer        | Path               | Responsibility                                     |
| ------------ | ------------------ | -------------------------------------------------- |
| API (router) | `app/api/`         | HTTP verbs, auth dependencies, envelope return     |
| Service      | `app/services/`    | Business rules & orchestration, provider selection |
| Repository   | `app/repositories/`| Data access only (no business logic)               |
| Schema       | `app/schemas/`     | Pydantic request/response contracts                |
| Models       | `app/models/`      | SQLAlchemy ORM (single `Base` metadata)            |
| Seed         | `app/seed/`        | Idempotent demo data (hotel, teams, guests, POIs, demo itinerary) |

Every endpoint returns one envelope:

```json
{ "success": true, "data": {...}, "error": null, "meta": { "count": 3 } }
{ "success": false, "data": null, "error": { "code": "EMAIL_EXISTS", "message": "...", "fallback_used": false }, "meta": {} }
```

Errors use machine-readable `code` strings; `fallback_used` tells clients when a
live provider was substituted by cached/seed data (the `Live → Cache → Curated`
fallback chain).

## Middleware (inner → outer safety)

- `BodySizeMiddleware` — rejects >1 MB bodies (413)
- `SecurityHeadersMiddleware` — nosniff / frame-deny / referrer-policy
- `RateLimitMiddleware` — fixed-window, per-IP (default 240/min, 429 + `Retry-After`)
- `RequestContextMiddleware` — `X-Request-ID`, structured access logs
- CORS — origins from settings

## Auth & RBAC

- `bcrypt` for password hashing (passlib intentionally not used), `PyJWT` tokens.
- Access token 15 min, refresh token 7 days; refresh is rotated on each call.
- Stateless logout for MVP (short-lived tokens); a denylist can be added later.
- Dependencies in `app/api/deps.py`: `get_current_user`, `require_roles`, plus
  composables `require_guest|require_staff|require_manager|require_admin`.

## Provider pattern (roadmap)

External capabilities are behind per-`BaseProvider` interfaces with a fallback
chain `Live → Cache → Curated`. This satisfies the "no fake providers" rule:
in `DEMO_MODE=false` real APIs are used; in `DEMO_MODE=true` the curated/cached
fallback still returns *real curated data* (Jaipur POI catalogue, seeded events),
never invented scores or itineraries.

| Capability    | Live            | Cache                  | Curated seed                       |
| ------------- | --------------- | ---------------------- | ---------------------------------- |
| POI data      | Google Places   | DB `pois`              | `data/pois/jaipur.json`            |
| Optimizer     | OR-Tools (opt)  | last run               | deterministic engine (always real) |
| LLM concierge | OpenAI-compat   | —                      | local rules + real tool calls      |
| Weather       | OpenWeather     | last fetch             | seeded events                      |
| Messaging     | WhatsApp API    | —                      | mocked demo transport (logged)     |

## Consistency rules

- **No fake AI.** The concierge executes real business tools (recommendations,
  planner create/replan, service requests, weather) and phrases its reply from
  the *results*. `mode` is reported faithfully (`rules` vs `llm`); the inbox
  marks every row `demo: true` because the transport is mocked and logged, not
  dialled.
- **No fake data.** Scores, distances, timings and request codes all come from
  the live database and the deterministic engine.
- **Notifications are event-driven.** Service-request transitions (created /
  assigned / started / completed / cancelled), itinerary creation and replanning
  each emit a real `InboxNotification` via post-commit hooks
  (`app/services/notifications_service.py`).

## Configuration

pydantic-settings, `.env` + env vars (`backend/.env.example`). `require_strong_secret()`
refuses to boot with a weak JWT secret outside demo mode. Secrets are never committed.

## Current implementation status

Live: auth (register/login/refresh/me/logout), admin utilities, health, seed world,
guest profile + preferences + current stay, the full service-request lifecycle
(guest create/cancel, staff board, SLA, auditable status history), hotel overview
+ room state, POI catalogue, the explainable recommendation engine, the
constraint-optimized itinerary planner (`app/services/planner_service.py`),
disruption replanning + staff weather capture, and the rule-based AI concierge
with real tool calls + the WhatsApp-style notification inbox. The shared guest
and staff web apps consume all of these (guest "Concierge" chat + "Inbox";
staff "Weather & replanning" + demo channel send).

Planned: LLM phrasing provider (seam already present — `LLM_PROVIDER`,
`LLM_API_KEY`, `LLM_BASE_URL`), real WhatsApp/webhook transport, push for
live notifications.