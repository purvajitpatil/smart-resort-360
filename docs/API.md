# StaySmart — API Reference

Base URL: `/api/v1` (dev proxies: `:5173` and `:5174` forward `/api` to `:8000`).
Interactive docs: http://127.0.0.1:8000/docs

## Envelope

All responses:

```json
{ "success": true, "data": <any>, "error": null, "meta": { } }
{ "success": false, "data": null, "error": { "code": "STRING", "message": "human text", "fallback_used": false }, "meta": {} }
```

## Authentication

### `POST /auth/register`
Body: `{ "email", "password" (>=8), "full_name", "role": "GUEST"|"STAFF"|"MANAGER"|"ADMIN" }`
→ `200` `data` = `{ access_token, refresh_token, token_type, expires_in, user }`
Errors: `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR` / `INVALID_ROLE`

### `POST /auth/login`
Body: `{ "email", "password" }` → `200` same token payload
Errors: `401 INVALID_CREDENTIALS`

### `POST /auth/refresh`
Body: `{ "refresh_token" }` → `200` rotated token pair
Errors: `401 INVALID_REFRESH_TOKEN`

### `GET /auth/me`
Header: `Authorization: Bearer <access>` → `200` `data.user`
Errors: `401 UNAUTHENTICATED`, `401 TOKEN_EXPIRED`, `401 TOKEN_INVALID`, `401 ACCOUNT_DISABLED`

### `POST /auth/logout`
Header: Bearer access → `200` `data = { status: "ok" }` (stateless MVP)

## Admin (ADMIN only)

### `GET /admin/users`
→ `200` list of `{ id, email, role, active }`, `meta.count`
Errors: `401` auth, `403 FORBIDDEN`

### `GET /admin/stats`
→ `200` demo counts (users, rooms, active_stays, service_requests, pois)

## Health / diagnostics

### `GET /health`
→ `200` `{ status, demo_mode, environment, database, database_error, counts: { users, requests, rooms, itineraries, pois } }`

## Guest profile & stay

### `GET /guest/me`
Bearer → `200` `data` = `{ id, full_name, phone, email, preferences }` (profile auto-created)

### `PUT /guest/preferences`
Body: `{ interests[], budget, pace, preferred_start_time, preferred_end_time, walking_tolerance, food_preferences[], travel_group, accessibility_requirements[], preferred_activity_duration }` → `200` updated profile

### `GET /guest/stay/current`
Bearer guest → `200` active stay `{ check_in, check_out, status, room, hotel_name, hotel_city, days_remaining, checkout_today }`
Errors: `404 NO_ACTIVE_STAY`

## Service requests (guest)

### `POST /requests`
Body: `{ category, title, description?, quantity, priority }` → `200` RequestOut (code `SR-YYMMDD-NNN`, SLA set, status history seeded)
Requires an active stay; `400 NO_ACTIVE_STAY` otherwise. Department auto-assigned by category keyword.

### `GET /requests/mine`
Bearer guest → `200` `{ items: [RequestOut], total, filters }`

### `POST /requests/{code}/cancel`
Guest may cancel their own request. Errors: `404 REQUEST_NOT_FOUND`, `403 FORBIDDEN`

## Service requests (staff: STAFF / MANAGER / ADMIN)

### `GET /requests?status=&category=&priority=&search=`
→ `200` filtered list (max 200, newest first)

### `GET /requests/queue/stats`
→ `200` `{ by_status, by_priority, overdue_count, open_count }`

### `GET /requests/{code}`
→ `200` full detail incl. `history[].` Guests may view only their own; staff any. Errors: `403 FORBIDDEN`, `404`

### `PATCH /requests/{code}/assign?note=`
Assigns to the calling staff member (self-accept). `400 NO_STAFF_PROFILE` if the user has no duty row.
Valid from `PENDING`/`ASSIGNED`; `409 INVALID_TRANSITION` otherwise.

### `PATCH /requests/{code}/status` body `{ action: "start"|"complete"|"cancel", note? }`
Transition matrix:

| From \ action | assign | start | complete | cancel |
| ------------- | ------ | ----- | -------- | ------ |
| PENDING       | ✓      | ✓     |          | ✓      |
| ASSIGNED      | ✓      | ✓     | ✓        | ✓      |
| IN_PROGRESS   |        |       | ✓        | ✓      |
| COMPLETED/CANCELLED | terminal | | | |

Every transition appends a `RequestStatusHistory` row (actor, note). Completion/cancellation stamps `resolved_at`.

## Hotel operations (staff)

### `GET /hotel/overview`
→ `200` occupancy %, rooms-by-status, active stays, arrivals/departures today, open + late requests

### `GET /hotel/rooms?status=`
→ `200` `{ items: [RoomOut], count, filter }`

## Travel & recommendations

### `GET /pois?category=&q=&limit=`
Bearer → `200` `{ items: [POIOut], total, filters }` — category filter is case-insensitive.

### `GET /pois/{id}`
→ `200` POIOut · `404 POI_NOT_FOUND`

### `GET /recommendations?refresh=&category=&limit=`
Scored + explained picks. Reflects saved preferences (interests, budget, accessibility) plus the latest
`WeatherEvent` when present. `refresh=true` re-runs the engine (and persists the run);
otherwise returns the most recent persisted run. Every item carries `score`, `factors` and a
human `reason` (no invented data).

## Itinerary planner

Deterministic constraint solver over the real catalogue: great-circle travel time
(~15 km/h), real open/close hours, real weekday closures, real visit durations, guest pace/budget/
interests, and the latest `WeatherEvent` (heavy rain blocks high-sensitivity outdoor sights).
Every day also earns a real lunch stop when the window fits.

### `POST /itineraries`
Guest only. Body: `{ "start_date": "YYYY-MM-DD", "days": 1..7, "start_time": "HH:MM", "end_time": "HH:MM" }`
→ `200` `ItineraryOut`, `meta.replanned = false`.
Errors: `422 INVALID_DATE/INVALID_TIME_RANGE/INVALID_DAY_RANGE`, `403 FORBIDDEN` (non-guest),
`503 NO_HOTEL`.

### `GET /itineraries`
Guest only → `200` `{ items: [ItineraryOut], total }` (own plans, newest first).

### `GET /itineraries/{id}`
Owner guest or staff → `200` `ItineraryOut`. Errors: `403 FORBIDDEN`, `404 ITINERARY_NOT_FOUND`.

`ItineraryOut` shape:

```json
{
  "id": 1, "city": "Jaipur", "start_date": "2026-08-28", "end_date": "...",
  "start_time": "09:00", "end_time": "21:00", "status": "ACTIVE",
  "score": 5.58, "explanation": "Day 1 (...): A → B → C; Day 2 (...): ...",
  "weights": { "pace", "budget", "max_pois_per_day", "speed_kmh", "weather_considered" },
  "replanned": false,
  "days": [ { "day_index", "date", "stops": [ { "id", "position", "stop_type": "POI"|"MEAL",
      "name", "poi_id", "start_time", "end_time", "travel_minutes", "distance_km",
      "status": "PLANNED"|"LOCKED"|"COMPLETED"|"REMOVED"|"REPLACED", "reason" } ] } ]
}
```

### `POST /itineraries/{id}/replan`
Guest (own) or staff. Body:

```json
{ "event_type": "WEATHER|POI_CLOSED|TRAFFIC|DELAY|USER_CHANGE|...",
  "severity": "LOW|MEDIUM|HIGH", "message": "...",
  "affected_stop_ids": [..] | "affected_poi_ids": [..] }
```

→ `200` returns the rebuilt `ItineraryOut` with `replanned: true`; `meta` carries `{ replanned: true,
changes, disruption: { id, event_type, severity, message, affected_stop_ids, created_at } }`.
Affected stops become `REMOVED` (reason = message), affected days are rebuilt with `REPLACED`
stops where candidates remain, and a `DisruptionEvent` row is recorded. `REPLANNED` is surfaced as
the `meta.replanned` marker. Errors: `422 INVALID_DISRUPTION` (no targets), `422 NOTHING_AFFECTED`
(targets touch no stop), `404 ITINERARY_NOT_FOUND`.

### `POST /weather/capture`
Staff only. Body: `{ "condition", "temp_c", "precip_mm"?, "wind_kmh"?, "city"? }`
→ `200` new `WeatherEvent` (`source: "ingested"`). Feeds recommendations + replans.
Guest → `403 FORBIDDEN`.

## AI concierge (chat with real tool calls)

Rule-based by default (`mode: "rules"`); an OpenAI-compatible provider is used for phrasing
(`mode: "llm"`) only when configured — and even then the tools below execute against real data.
Every reply carries `tool_calls` proving what was actually done; nothing is invented.

### `POST /chat/messages`
Guest only. Body `{ "message" }` → `200` `ChatReplyOut`:

```json
{ "assistant": "Current in Jaipur: clear, 28°C.", "intent": "weather", "mode": "rules",
  "tool_calls": [ { "tool": "weather", "status": "ok", "summary": "...", "detail": {...} } ],
  "actions": ["Suggest things to do", "..."] }
```

Intents: `greeting` · `help` · `recommend` · `plan` · `replan` · `request` · `weather` · `clarify`.
Real tools: `recommend` (scored POIs), `plan` (planner create), `replan` (planner replan +
`DisruptionEvent`), `request` (creates a real `ServiceRequest`), `weather` (latest `WeatherEvent`),
`help`. A failed tool returns `status: "error"|"skipped"` in its summary — the chat never fails.

### `GET /chat/conversation`
Guest only → `200` current session with `messages[]` (`USER`/`ASSISTANT`, intent, tool chips).

### `DELETE /chat/conversation`
Guest only → clears the guest's chat history.

## Notification inbox (WhatsApp-style demo channel)

The transport is mocked and honest: rows carry `demo: true`, sends are logged, never dialled.
Event hooks create real rows on request transitions, plan creation and replanning.

### `GET /notifications`
Guest only → `{ items: [NotificationOut], total, unread }`, newest first. `channel` = `whatsapp`.
Errors: `401` auth.

### `POST /notifications/{id}/read`
Guest only (own inbox) → marks one read. Errors: `404 NOTIFICATION_NOT_FOUND`.

### `POST /notifications/read-all`
Guest only → `{ marked_read }`.

### `POST /notifications/demo/send`
Staff only. Body `{ guest_id?, series?, title, body }` → `200`. No `guest_id` targets the demo guest.
Errors: `403 FORBIDDEN`, `404 GUEST_NOT_FOUND`.

## Error codes

| Code                  | Status | Meaning                                   |
| --------------------- | ------ | ----------------------------------------- |
| `VALIDATION_ERROR`    | 422    | request payload invalid                   |
| `INVALID_ROLE`        | 422    | unknown user role                         |
| `EMAIL_EXISTS`        | 409    | email already registered                  |
| `INVALID_CREDENTIALS` | 401    | bad email/password                        |
| `INVALID_REFRESH_TOKEN`| 401   | token not a usable refresh token          |
| `UNAUTHENTICATED`     | 401    | missing bearer token                      |
| `TOKEN_EXPIRED`       | 401    | access token past `exp`                   |
| `TOKEN_INVALID`       | 401    | malformed / wrong type token              |
| `ACCOUNT_DISABLED`    | 401    | `is_active=false`                         |
| `FORBIDDEN`           | 403    | role lacks permission / not your resource |
| `NO_ACTIVE_STAY`      | 400/404| guest has no active stay                  |
| `REQUEST_NOT_FOUND`   | 404    | unknown request code                      |
| `NO_STAFF_PROFILE`    | 400    | staff user has no duty row (assign)       |
| `INVALID_TRANSITION`  | 409    | illegal status action for current state   |
| `INVALID_ACTION`      | 422    | unknown status action                     |
| `POI_NOT_FOUND`       | 404    | unknown POI id                            |
| `ITINERARY_NOT_FOUND` | 404    | unknown itinerary id                      |
| `INVALID_DATE`        | 422    | `start_date` is not `YYYY-MM-DD`          |
| `INVALID_TIME_RANGE`  | 422    | `end_time` not after `start_time`         |
| `INVALID_DAY_RANGE`   | 422    | `days` outside 1..7                       |
| `INVALID_DISRUPTION`  | 422    | replan without `affected_*` targets       |
| `NOTHING_AFFECTED`    | 422    | targets match no planned stop             |
| `NOTIFICATION_NOT_FOUND`| 404  | no such inbox message for this guest      |
| `GUEST_NOT_FOUND`     | 404    | demo-send targeted an unknown guest       |
| `RATE_LIMITED`        | 429    | per-IP limit exceeded (`Retry-After`)     |
| `BODY_TOO_LARGE`      | 413    | request too big                           |
| `ERROR`               | 404/500| fallback envelope for generic failures    |
| `INTERNAL_ERROR`      | 500    | non-debug unhandled exception             |