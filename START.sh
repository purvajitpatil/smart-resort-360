#!/usr/bin/env bash
# StaySmart demo startup — run from repo root
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== StaySmart Demo Startup ==="
echo ""

# ── Backend ──────────────────────────────────────────────────────────
echo "[1/3] Starting backend API on port 8000…"
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  python3 -m venv .venv
  .venv/bin/pip install -r requirements.txt -q
fi
.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "      Backend PID: $BACKEND_PID"
sleep 2

# ── Guest app ─────────────────────────────────────────────────────────
echo "[2/3] Starting guest app on port 5173…"
cd "$ROOT/apps/guest-web"
npm install --silent 2>/dev/null
npm run dev -- --port 5173 --host &
GUEST_PID=$!
echo "      Guest PID: $GUEST_PID"

# ── Staff dashboard ───────────────────────────────────────────────────
echo "[3/3] Starting staff dashboard on port 5174…"
cd "$ROOT/apps/staff-dashboard"
npm install --silent 2>/dev/null
npm run dev -- --port 5174 --host &
STAFF_PID=$!
echo "      Staff PID: $STAFF_PID"

echo ""
echo "════════════════════════════════════════"
echo "  StaySmart is running"
echo ""
echo "  Guest app    → http://localhost:5173"
echo "  Staff dash   → http://localhost:5174"
echo "  API docs     → http://localhost:8000/docs"
echo ""
echo "  Demo accounts:"
echo "    guest@staysmart.demo     / DemoGuest!2026"
echo "    suresh@staysmart.demo    / DemoStaff!2026"
echo "    manager@staysmart.demo   / DemoManager!2026"
echo ""
echo "  Press Ctrl-C to stop all processes."
echo "════════════════════════════════════════"

trap "kill $BACKEND_PID $GUEST_PID $STAFF_PID 2>/dev/null; exit 0" INT TERM
wait
