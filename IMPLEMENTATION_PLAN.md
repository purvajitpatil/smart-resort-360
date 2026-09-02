






# IMPLEMENTATION_PLAN.md

StaySmart — AI hospitality + travel operating layer. Hackathon MVP build plan.

Status of each phase is tracked by checking the checkbox when completed.

## Guiding principles (from the master spec)

- Modular monolith backend (no unnecessary microservices). `Correctness > Reliability > Architecture > Security > Demoability > Performance > UI polish`.
- No fake AI, no fake optimization, no hardcoded dashboards/itineraries. Every KPI and itinerary passes through the real pipeline.
- Provider-interface architecture: every external integration (`Places`, `Routing`, `Weather`, `LLM`, `Messaging`, `Cache`) has an interface + a working seed/mock provider + a production provider + a fallback chain (`Live -> Cache -> Curated seed`). Never let a third-party outage crash the demo.
- `DEMO_MODE=true` default → seeded/cached providers, no external keys required. `DEMO_MODE=false` → live integrations.
- **Local runtime decision**: PostgreSQL is the production target (SQLAlchemy makes it a `DATABASE_URL` switch, docker-compose provided), but the default runner uses **SQLite** so the demo runs offline with no Docker daemon/Postgres (confirmed absent on this machine).
- **Optimization decision**: OR-Tools is the *preferred* solver, but it is a large native dependency. We implement a real, tested constraint optimization engine (time-window TSP solver, objective weights, branch-and-bound default with deterministic output) behind an `OptimizerProvider` interface; an `OrToolsProvider` can be enabled when OR-Tools is installed. This satisfies "OR-Tools **or** a clearly implemented constraint optimization engine".
- Keep the legacy SPA as a visual reference at `apps/prototype-spa/`; the new product follows the specified light design system (Indigo `#4F46E5`, bg `#F8F9FC`, white cards, Inter).

## Repository layout

```
staysmart/
├── apps/
│   ├── guest-web/          React + TS + Vite  (mobile-first PWA-style)
│   ├── staff-dashboard/    React + TS + Vite  (desktop-first)
│   └── prototype-spa/      (preserved legacy reference)
├── backend/
│   ├── app/
│   │   ├── main.py  config.py  database.py
│   │   ├── api/        auth, guests, hotels, rooms, requests, itinerary, recommendations, chat, weather, analytics, demo
│   │   ├── models/     auth, hotel, guest, requests, travel, chat, payments
│   │   ├── schemas/
│   │   ├── repositories/
│   │   ├── services/   auth, security, requests, routing, weather, cache, notifications, messaging
│   │   ├── ai/         providers/, intent/, concierge (tool calling)
│   │   ├── optimization/  providers/, objective, solver, replanner
│   │   └── integrations/ places, routing, weather, llm, messaging
│   ├── seed/            seed.py + data/pois/jaipur.json
│   └── tests/
├── data/pois/           jaipur_pois.json (~60 curated POIs)
├── docs/                ARCHITECTURE.md API.md DATABASE.md SETUP.md DEMO.md
├── docker-compose.yml   postgres, redis (optional), backend
├── .env.example  README.md  .gitignore
```

## Phases

### Phase 1 — Foundation  [IN PROGRESS]
- [x] Repo restructure (legacy SPA preserved)
- [ ] FastAPI backend skeleton: config, database (SQLite default / Postgres via env), models (all core entities), schemas
- [ ] Real auth: register / login / refresh / me / logout; bcrypt hashing; JWT access+refresh; RBAC roles GUEST/STAFF/MANAGER/ADMIN
- [ ] Seed system: hotel, 40 rooms, departments, staff, demo users, guests/booking/stay, service requests, POIs from `data/pois/jaipur.json`
- [ ] `GET /health`, `/auth/*`; consistent `{success,data,error,meta}` envelope; structured error codes; rate-limit + CORS + secure headers
- [ ] Tests: `pytest` (health, auth happy/error paths, RBAC)
- [ ] Frontend scaffolds: `guest-web`, `staff-dashboard` (Vite+React+TS+Tailwind, api client, login page proving end-to-end auth, protected route shell)
- [ ] docker-compose + backend Dockerfile + `.env.example` + docs
- [ ] Verify: pytest green, uvicorn boots, register→login→me round-trip via curl, frontends build

### Phase 2 — Hotel Operations
- [ ] Service requests full workflow (create, assign, accept/start/complete/reject/escalate, status history)
- [ ] Priority engine (rule-based + staff override), SLA deadlines
- [ ] Rooms CRUD + status transitions; Guests list; Departments/Staff
- [ ] Dashboard KPIs from aggregation queries (no hardcoding)
- [ ] Requests screen: search/filter/sort/pagination/assignment; live updates (SSE)
- [ ] Notifications engine (request received/assigned/completed, itinerary changes, weather)

### Phase 3 — Travel Intelligence
- [ ] POI dataset (Jaipur ~60), full field set with real opening hours/coords
- [ ] Recommendation engine: weighted, normalized 0–1 score + stored factors (explainability)
- [ ] RoutingService: OSRM -> cache -> Haversine fallback
- [ ] OptimizerService: NativeConstraintProvider (time-window TSP, weighted objective) + OrToolsProvider (optional); distance/time/opening/duration/wait constraints; deterministic demo output
- [ ] Itinerary API: generate (POST `/itineraries/generate`) returning days/stops/score/explanation/metadata
- [ ] Optimization unit tests + the 5 critical cases

### Phase 4 — AI Concierge
- [ ] LLMProvider interface (OpenAI-compatible/Groq/OpenRouter/Anthropic) + `LocalProvider` fallback
- [ ] Intent detection -> tool calling (search_pois, get_hotel_info, get_room_status, create_service_request, get_requests, generate_itinerary, replan_itinerary, get_weather, get_booking, get_checkout_invoice)
- [ ] Grounding rules: LLM never invents statuses/prices/hours; answer derived from backend tools; safety/guardrails; answer fallback "I don't have reliable information…"
- [ ] Chat sessions + message persistence + SSE streaming

### Phase 5 — Live Replanning
- [ ] DisruptionEvent model + demo triggers (weather, closure, traffic, user/group/timing changes)
- [ ] Replanning service: lock completed stops, invalidate affected, query alternatives, re-run optimizer, build before/after diff + explanation engine
- [ ] `POST /itineraries/{id}/replan`; explanation text generated deterministically

### Phase 6 — Guest UX (guest-web)
- [ ] Home, personalization onboarding, AI Assistant, Explore (recommendations with reasons), Trip Planner, Itinerary (with "Why this plan?"), Live itinerary + disruption banner, Requests, Checkout + Payment summary, Feedback, Profile, Notifications, Settings
- [ ] Loading/error/empty states everywhere; `Optimizing your trip…` and `Re-optimizing…` states; a11y basics

### Phase 7 — Staff UX (staff-dashboard)
- [ ] Dashboard, Requests queue, Request details, Rooms, Guests, Staff, Analytics (from DB), Travel/Concierge insights, Demo Controls (trigger rain/closure/traffic), Settings

### Phase 8 — Demo Hardening
- [ ] Failure drills: no internet, API timeout, LLM timeout, invalid request, expired token, DB unavailable, empty dataset, duplicate request, invalid POI, weather event — all must fail gracefully
- [ ] Full end-to-end demo script pass (log in → personalize → generate → explain → request → staff → weather → replan → checkout → feedback), no manual DB edits
- [ ] Rattling out demo pollution (Reset demo / reseed endpoint)

### Phase 9 — Polish & Docs
- [ ] README (12 required sections), ARCHITECTURE/API/DATABASE/DEMO/SETUP docs finalized
- [ ] Optional: group consensus engine, WhatsApp provider abstraction

## Priority (if time runs short)
P0 (must work): auth, guest profile, POI dataset, recommendation engine, optimizer, AI assistant, service requests, staff request dashboard, live replanning.
P1 (should work): rooms, analytics, checkout, feedback, notifications.
P2 (nice): group voting, WhatsApp, advanced analytics, external bookings.

## Acceptance
Every P0 acceptance criterion from the master spec must be verifiable through the running app without editing the database by hand.