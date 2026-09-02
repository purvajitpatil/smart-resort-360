# StaySmart — Setup

## Prerequisites
- Python 3.13+ and Node 20+ (dev), or Docker + Compose (stack).
- No external services are required in `DEMO_MODE=true` (default).

## Option A — Local dev (no Docker)

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS / Linux
pip install -r requirements.txt
cp .env.example .env            # optional; demo defaults are safe
uvicorn app.main:app --reload
```

- API + docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/v1/health
- Default DB: `backend/staysmart.db` (SQLite) — created + seeded on first boot.

### 2. Web apps (separate terminals)

```bash
cd apps/guest-web && npm install && npm run dev          # http://127.0.0.1:5173
cd apps/staff-dashboard && npm install && npm run dev    # http://127.0.0.1:5174
```

Both proxy `/api` → `http://127.0.0.1:8000` during dev.

## Option B — Docker Compose (Postgres stack)

```bash
docker compose up --build          # api:8000, guest-web:5173, staff-web:5174
docker compose down                # stop
docker compose down -v             # stop + wipe pgdata
```

> Note: this machine's Docker daemon is currently offline (`docker ps` fails), so
> the compose stack has NOT been runtime-tested here — validate with
> `docker compose config --quiet`.

## Environment variables

Full list in `backend/.env.example`. Key ones:

| Variable                 | Default | Purpose                                    |
| ------------------------ | ------- | ------------------------------------------ |
| `DEMO_MODE`              | true    | seed data + curated fallbacks              |
| `DATABASE_URL`           | sqlite  | SQLite or Postgres DSN                     |
| `JWT_SECRET`             | demo    | required strong outside demo mode          |
| `ACCESS_TOKEN_EXPIRE_MINUTES` / `REFRESH_TOKEN_EXPIRE_DAYS` | 15 / 7 | token lifetimes |
| `DEMO_GUEST_PASSWORD` / `DEMO_STAFF_PASSWORD` / `DEMO_MANAGER_PASSWORD` | demo | seed account passwords |
| `CORS_ORIGINS`           | 5173/5174 | allowed web origins                        |
| `SEED_ON_STARTUP`        | true    | seed on boot                               |
| `SEED_DATA_FILE`         | empty   | POI catalogue path (set in containers)     |

## Tests & lint

```bash
cd backend
.venv\Scripts\python -m pytest                    # 17 tests
.venv\Scripts\python -m ruff check app tests
.venv\Scripts\python -m ruff format app tests
```

## Troubleshooting

- **Port 8000 busy** — stop the other process or set a custom `--port`.
- **`staysmart.db` in a bad state** — delete it; it is re-created and re-seeded on boot.
- **Rate-limited during demos** — limit is per-IP/240-min; restart clears the memory window.