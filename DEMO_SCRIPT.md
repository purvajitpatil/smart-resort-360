# 🎤 Smart Resort 360 — Judge Demo Script

> **Total live demo time: ~6 minutes**
> Open three browser tabs before presenting: guest app (5173), staff dashboard (5174), API docs (8000/docs)

---

## Demo accounts

| Role    | Email                      | Password         |
|---------|----------------------------|------------------|
| Guest   | guest@smartresort360.demo  | DemoGuest!2026   |
| Staff   | suresh@smartresort360.demo | DemoStaff!2026   |
| Manager | manager@smartresort360.demo| DemoManager!2026 |

**Demo guest is Priya Sharma** — a returning "Power Guest" with 5 cross-stay memories.

---

## ACT 1 — The full loop (2 min)

**Say:** *"We'll start with the test every judge runs — submit a request as a guest, and show what happens on the operations side."*

1. **Guest App** (5173) → sign in as Guest
2. Tap **Chat with Assistant** → type: *"The AC in my room is not working"*
3. Show the AI reply — it's understood, categorised, routed
4. **Switch to Staff Dashboard** (5174) → sign in as Staff (suresh)
5. Click **Requests** — the AC request is at the top: priority MEDIUM, dept Maintenance, SLA bar running
6. Click **Start** → switch back to guest app — request status has changed live
7. On the **completed request, tap the star rating** → it upserts into feedback and feeds the sentiment engine

**Say:** *"Full loop — both sides, live, no mock. The rating isn't cosmetic — it feeds the sentiment + maintenance intelligence you'll see next."*

---

## ACT 2 — The 2AM escalation (1.5 min)

**Say:** *"The question every judge asks: what happens at 2AM when a guest complains about noise? Most systems don't have a different answer for 2AM versus 2PM. Ours does."*

1. Staff Dashboard → **Escalations** → scroll to **Routing Explainer**
2. Click **"2AM noise complaint"** preset (already filled)
3. Click **Explain routing** — show the result:
   - Priority: HIGH
   - Department: **DUTY_DESK** (not Maintenance, not Housekeeping — the desk that's actually staffed)
   - SLA: **15 minutes** (not 45 — compressed because it's night)
   - Engine walkthrough: steps 1–5 showing exactly why
4. Change time to **14:00** → Explain again:
   - Priority: MEDIUM, Department: Maintenance, SLA: 45 min
   - Same complaint — completely different routing

**Say:** *"Time-aware SLA. The system knows what's staffed at 2AM."*

---

## ACT 3 — The intelligence stack (the "go beyond display data" proof, 2.5 min)

**Say:** *"Displaying data is not enough — the brief says go from data to decisions. Here's how Smart Resort 360 turns raw data into alerts, predictions, and recommendations."*

1. **Sentiment page** → category scores (FOOD 5.0, MAINTENANCE 3.67, HOUSEKEEPING 3.0 → overall 3.57)
   - Point at the **declining housekeeping trend** — not a number, a detected signal
2. **Predictive Maintenance card** → click the **MEDIUM alert**
   - *"Inspect the central AC plant"* — surfaced from a cluster of 4 guest AC complaints in 7 days
   - **Say:** *"One complaint is a request. Four in a week is a systemic fault. The system tells you to fix the root cause before more guests are affected."*
3. **Inventory page** → filtered for **LOW** items → reorder card with **estimated restock cost**
   - **Say:** *"Stock depletes on completed requests and auto-reorders at a critical threshold — no spreadsheet."*
4. **Guest Memory page** → **Load brief** for Guest #1 (Priya)
   - Prep actions: *"Pre-place extra pillows," "Vegetarian dinner ready," "Late checkout preference"*
   - **Say:** *"Cross-stay memory — the room is prepped before she arrives. 5 memories, 'Power Guest' segment."*
5. **Revenue page** → ADR, projected daily revenue, occupancy, **arrivals/departures**, staff load by department
   - **Say:** *"Dynamic-revenue view — what's booked, what's coming, what's projected today."*

---

## Anticipated judge questions — live answers

| Question | One-line answer |
|---|---|
| "Why not just use eZee / a PMS?" | "They're PMS-first. We're intelligence-first, and sit alongside an existing PMS — no rip-and-replace." |
| "Show me the data model" | API docs at localhost:8000/docs → `/hotel/sentiment`, `/hotel/maintenance/alerts`, `/hotel/inventory`, `/hotel/revenue`, `/hotel/staff-load`, `/memory/mine` |
| "Where is the AI?" | Intent detection + routing for every request, sentiment aggregation, cross-stay memory scoring, and systemic-fault detection in maintenance. |
| "What about data privacy?" | Per-item DPDP forget (hard delete on "Forget all"), trust-tiered confidence, audit trail retained, cross-guest isolation tested. |
| "Business model?" | ₨50–150/room/month SaaS. Free tier under 20 rooms. India's 1M+ independent hotels are the TAM. |
| "Is it real or mock?" | Backend is live. Hit `/docs` and call any endpoint with a demo token. 97 tests pass. |
| "How do predictions differ from stats?" | "Sentiment is a score; the declining-trend alert, the AC fault cluster, and the reorder threshold are *decisions* — someone/something must act on them." |

---

## Backup plan if API is down

- Show the **built frontend** (pre-built `dist/` folders, open `index.html` directly)
- Walk through the **architecture diagram** on the poster
- Live-read the service logic: `sentiment_service.py`, `maintenance_service.py`, `inventory_service.py`, `hotel_service.py` (revenue/staff-load)
- Show test output: `pytest tests/ -v` — 97 lines of green
