# Smart Resort 360 — Judge Demo Walkthrough

**Theme:** AI-Powered Resort Operations, Guest Experience & Revenue Intelligence
**Stack:** FastAPI + React (guest) + React (staff) · SQLite (demo) / Postgres (prod)
**Tests:** 97 passing
**Unique differentiators:** Cross-stay guest-memory engine with trust-tiered confidence, time-aware SLA escalation, and an inference layer that turns raw data into alerts, predictions, and recommendations across sentiment, predictive maintenance, inventory, revenue, and staff load.

---

## Startup

```bash
./START.sh
# or individually:
# backend:  cd backend && .venv/bin/uvicorn app.main:app --reload
# guest:    cd apps/guest-web && npm run dev -- --port 5173
# staff:    cd apps/staff-dashboard && npm run dev -- --port 5174
```

---

## Demo accounts

| Role    | Email                       | Password         |
|---------|-----------------------------|------------------|
| Guest   | guest@smartresort360.demo   | DemoGuest!2026   |
| Staff   | suresh@smartresort360.demo  | DemoStaff!2026   |
| Manager | manager@smartresort360.demo | DemoManager!2026 |

The demo guest is **Priya Sharma**, a returning "Power Guest" with 5 cross-stay memories.

---

## Recommended 8-minute judge run

### Scene 1 — Guest perspective (3 min)
**Open** `localhost:5173`, log in as Guest.

1. **Home screen** — "Ready before you asked" card shows prep actions generated from previous stays (extra pillows, vegetarian dinner, late checkout). Point out the room number in display type at the top — same information the front desk sees.

2. **AI Assistant** — Type *"I'd like mineral water and extra pillows every evening"*. The AI creates a service request **and** stores this as a `STATED` memory (highest trust). Show the quick-reply strip — the four chips are the most common requests across the dataset.

3. **My Requests** — The new request appears instantly with an SLA countdown bar (green → amber → red). When done, **tap the star rating** — it upserts into feedback and feeds the sentiment engine.

4. **My Preferences** — *You told us* (STATED), *We noticed* (OBSERVED), *We guessed* (INFERRED), each with a confidence bar. Hit **Forget all** to show DPDP compliance — gone immediately, both from the UI and the DB.

---

### Scene 2 — Staff perspective (4 min)
**Open** `localhost:5174` in a second window, log in as Staff.

5. **Overview** — Live stat cards now include **revenue**: ADR, projected daily revenue, arrivals/departures, open-across-teams — alongside occupancy, open requests, overdue, check-ins today.

6. **Requests** — Find the mineral water request. Walk *Pending → Assign → Start → Complete*. Switch back to the guest app — the guest sees the status change in real time. **"This is the full loop."**

7. **Escalations → Routing explainer**:
   - *"2AM noise complaint"* preset → **Explain routing**: priority=HIGH, department=DUTY_DESK, SLA=15min, night=true.
   - Change time to 14:00 → priority=MEDIUM, MAINTENANCE, SLA=45min, night=false.
   - **Judge Q:** "Why 15 minutes at night?" — "Noise at 2AM is a high-urgency event routed to the duty desk; the SLA ladder compresses because night staff is minimal."

8. **Resort intelligence** (the "go beyond displaying data" proof):
   - **Sentiment** — overall + per-category scores (FOOD 5.0, MAINTENANCE 3.67, HOUSEKEEPING 3.0) plus a **declining housekeeping trend** — a detected signal, not just a number.
   - **Predictive Maintenance** — MEDIUM alert "Inspect the central AC plant" from a cluster of 4 AC complaints in 7 days. *"One complaint is a request; four in a week is a systemic fault."*
   - **Inventory** — LOW items + reorder card with estimated restock cost; depletes on completed requests, reorders at a critical threshold.
   - **Guest Memory** — Load Guest #1 (Priya): prep actions, 5 memories, Power Guest segment. Confidence formula `1 - 0.55ⁿ` never hits 100% — that's a feature, not a bug.
   - **Revenue** — ADR, projected daily revenue, occupancy, arrivals/departures, staff load by department.

---

## Anticipated judge questions

**Q: How is this different from a simple request tracker?**
A: The tracker is table stakes. Every request feeds a learning loop — rating → sentiment → maintenance detection → inventory depletion → memory. On the next stay the room is prepped and the reorder/replacement is auto-suggested.

**Q: What happens when a guest says don't store my data?**
A: One tap on "Forget all" — memory rows are hard-deleted, the engine never re-surfaces them, and the audit trail is retained for compliance. Same vocabulary on both guest and staff UIs.

**Q: Can the memory engine be wrong?**
A: Yes, deliberately. Confidence is capped below 100%: INFERRED ≤ 40%, OBSERVED climb per stay, STATED override everything. The system never presents an assumption as a fact.

**Q: What's actually intelligent vs. just displaying data?**
A: Display is a number; intelligence is a *decision signal*. Examples: the AC complaint cluster → "inspect central plant" alert; inventory threshold → reorder with cost; housekeeping trend → staff-load warning; occupancy × ADR → projected daily revenue. Each maps to an actionable workflow.

**Q: How does the 2AM routing work technically?**
A: `is_night()` checks `23:00 ≤ hour < 06:00`. At night, department overrides to DUTY_DESK, SLA compresses (e.g., complaints 60m → 15m), and the escalation ladder shortens. In `escalation_service.py`, covered by tests.

**Q: What's the tech stack?**
A: FastAPI + SQLAlchemy (SQLite demo, Postgres-ready). React + Vite + Tailwind v4. Design tokens in `packages/theme/smrt-resort360.css`. Workflow automation via n8n (WhatsApp webhooks). 97 automated tests.

---

## Architecture — 60-second version

```
Guest App (React, port 5173)
  └─ JWT auth → /api/v1/
       ├─ /chat/conversation  ← AI concierge (Claude tool calls)
       ├─ /requests           ← lifecycle + tap-to-rate
       └─ /memory/mine        ← guest preference CRUD + forget

Staff Dashboard (React, port 5174)
  └─ JWT auth → /api/v1/
       ├─ /hotel/overview     ← live stats
       ├─ /hotel/revenue      ← ADR, projected revenue, arrivals/departures
       ├─ /hotel/staff-load   ← by-department workload
       ├─ /hotel/sentiment    ← category + trend scores
       ├─ /hotel/maintenance/alerts  ← systemic-fault detection
       ├─ /hotel/inventory{,/alerts} ← reorder + cost
       ├─ /ops/guests/:id/brief      ← memory + prep actions
       └─ /ops/routing/explain       ← time-aware classification

Backend Services (Python, port 8000)
  ├─ EscalationService    — time-aware priority + SLA + tier ladder
  ├─ MemoryService        — observe → score → anticipate → forget
  ├─ ConciergeService     — AI chat with tool calls
  ├─ SentimentService     — rating aggregation + trend detection
  ├─ MaintenanceService   — request-cluster → fault alerts
  ├─ InventoryService     — depletion + critical reorder
  └─ HotelService         — revenue insight + staff load
```

---

*Smart Resort 360 · Hospitality Hackathon · Built for the AI-Powered Resort Operations, Guest Experience & Revenue Intelligence problem statement*
