# 🏨 Smart Resort 360 — AI-Powered Resort Intelligence
1
> **SIH Hackathon · Hospitality & Guest Experience**  
> Smart Requests. Happy Guests. Efficient Operations.

---

## 🚀 Quick Start

```bash
./start.sh          # starts all three services
```

| Service | URL | Purpose |
|---|---|---|
| Guest App | http://localhost:5173 | Mobile-style guest experience |
| Staff Dashboard | http://localhost:5174 | Full operations hub |
| API + Docs | http://localhost:8000/docs | FastAPI interactive docs |

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Guest | guest@smartresort360.demo | DemoGuest!2026 |
| Staff | suresh@smartresort360.demo | DemoStaff!2026 |
| Manager | manager@smartresort360.demo | DemoManager!2026 |

---

## 🎯 What to demo to judges

### The 2-minute live loop (core judge test)
1. Open **Guest App** → Chat with assistant → say *"The AC is not working"*
2. Switch to **Staff Dashboard → Requests** — watch the request appear with priority and SLA bar
3. Click **Start** on the request — status updates instantly back in the guest app
4. Full loop closed. Both sides. Live.

### The "2AM noise complaint" (escalation story)
1. Staff Dashboard → **Escalations** → Routing Explainer
2. Pick **"2AM noise complaint"** preset
3. Click **Explain routing** — see the engine route to duty desk, 15-min SLA, compressed ladder
4. Change time to 14:00 → same complaint → Maintenance dept, 45-min SLA
5. This is the architecture decision no incumbent offers.

### The memory engine (personalisation story)
1. Guest App → make a few requests (extra pillows, vegetarian dinner)
2. Guest App → **My Preferences** — see preferences build with confidence bars
3. Staff Dashboard → **Guest Memory** → Load Guest #1
4. See **Prep Actions**: *"Pre-place extra pillows before check-in — observed 3×, 2 stays, 87% confidence"*
5. This is cross-stay memory. Not a chatbot. A preference engine.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Guest App (React, port 5173)   Staff Dashboard (React, 5174)│
│  Mobile-first, dark navy        Desktop-first, sidebar nav   │
└────────────────┬───────────────────────────┬────────────────┘
                 │  REST API + JWT auth       │
        ┌────────┴────────────────────────────┴────────┐
        │          FastAPI backend (port 8000)          │
        │  ┌─────────────┐  ┌──────────────────────┐   │
        │  │ Memory Svc  │  │  Escalation Svc       │   │
        │  │ Cross-stay  │  │  Time-aware SLA       │   │
        │  │ preferences │  │  Night routing        │   │
        │  │ DPDP-ready  │  │  Tier ladder          │   │
        │  └─────────────┘  └──────────────────────┘   │
        │  ┌──────────────────────────────────────────┐ │
        │  │  AI Concierge (Claude + OpenRouter)       │ │
        │  │  Intent detection · Request capture       │ │
        │  └──────────────────────────────────────────┘ │
        │  SQLite (dev) / PostgreSQL (prod) · Redis      │
        └───────────────────────────────────────────────┘
```

### Key backend services

**Cross-Stay Memory Engine** (`backend/app/services/memory_service.py`)
- Observes every service request, extracts preference signals automatically
- Confidence scoring: `1 - 0.55^n` (never reaches 1.0, never overclaims certainty)
- Trust tiers: STATED > OBSERVED > INFERRED — ratchets up, never down
- `anticipate()` turns high-confidence memories into prep actions before check-in
- `cold_start()` covers first-time guests with labeled cohort suggestions
- Full DPDP compliance: per-item forget, forget-all, audit trail

**Time-Aware SLA Escalation** (`backend/app/services/escalation_service.py`)
- Night shift: 23:00–06:00 → all complaints route to duty desk only
- Category-aware SLA: food 30 min, maintenance 60 min, complaint 20 min
- Day ladder: dept head → GM at 2× SLA
- Night ladder: duty manager → GM at 1.5× SLA (compressed for urgency)
- `sweep()` finds every overdue request in one call
- `explain()` generates judge-readable walkthrough of routing decisions

---

## 🧪 Tests

```bash
cd backend
python -m pytest tests/ -v
# 87 passed
```

Test coverage: auth, request lifecycle, escalation (night routing, SLA tiers, ladder, sweep, explain), memory (confidence, signal learning, cross-stay persistence, cold start, DPDP paths).

---

## 📁 Project structure

```
StaySmart/
├── start.sh                    ← one-command startup
├── README.md
├── packages/
│   └── theme/
│       └── staysmart.css      ← shared design system (dark navy + indigo)
├── apps/
│   ├── guest-web/             ← Guest App (React + Vite, port 5173)
│   │   └── src/pages/         ← Login, Home, Assistant, Requests, Memory
│   └── staff-dashboard/       ← Staff Dashboard (React + Vite, port 5174)
│       └── src/pages/         ← Login, Dashboard, Requests, Rooms, Escalations, Memory
└── backend/                   ← FastAPI (Python, port 8000)
    ├── app/
    │   ├── api/               ← REST endpoints
    │   ├── models/            ← SQLAlchemy ORM
    │   └── services/          ← memory, escalation, AI concierge, security
    └── tests/                 ← 87 tests
```

---

## ❓ Judge Q&A — quick answers

**"Why would a hotel switch from eZee/Hotelogix?"**  
Those are PMS-first with guest engagement bolted on. StaySmart is guest-experience-first and sits *alongside* an existing PMS via lightweight integration — no rip-and-replace.

**"Show me this isn't just a chatbot."**  
Open Guest Memory → Staff Dashboard. You'll see a real preference/history data model driving specific prep actions with confidence scores, not a scripted chat response.

**"Research shows guests care about cleanliness, not apps."**  
Correct — which is why the staff tool exists. Automating admin frees staff for the human moments guests actually value. The app is the enabler, not the point.

**"What about India-specific compliance?"**  
DigiLocker integration endpoint is wired (sandbox). Guest ID data design is compliant — no raw Aadhaar storage, defined retention, per-item DPDP forget. UPI via Razorpay in the architecture.

**"What's the business model?"**  
Per-room SaaS (₹50–150/room/month), free tier for properties under 20 rooms. Target: India's 1M+ independent budget hotels/homestays that the enterprise PMS tier can't reach.
