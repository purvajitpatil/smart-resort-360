# 🎬 Smart Resort 360 — The Story & Pitching Script

> **Hackathon:** SIH · AI-Powered Resort Operations, Guest Experience & Revenue Intelligence
> **Tagline:** *"Data that runs the resort. Memory that runs itself."*

---

## PART 1 — THE STORY (why this exists)

### The world we walk into

A modern resort runs on **three engines at once** — operations, guest experience, revenue.
But today each engine has its own dashboard, its own logbook, its own spreadsheet.

A manager has:

| Silo | Lives in |
|---|---|
| Room occupancy & housekeeping | PMS |
| Maintenance | Paper registers + WhatsApp |
| Inventory | Excel |
| Guest requests & feedback | WhatsApp / front-desk slips |
| Pricing & revenue | Booking.com extranet + guesswork |
| Guest preferences | Nobody's memory |

So the manager asks simple questions and gets **no answer**:
> "Is a 2AM noise complaint a 45-minute job or a 15-minute emergency?"
> "Is this AC problem a room fault or a building fault?"
> "Should I reorder before it's too late?"
> "How do I make Ms. Sharma feel like home — not like a first-time walk-in?"

**Nobody is answering these questions because the data isn't joined.**
That joining — that inference from data to *decision* — is what this problem statement is really asking for. And it's exactly what Smart Resort 360 builds.

---

### The story in one sentence

> **One guest request — a single tap — should ripple through the whole resort:**
> routing, staffing, inventory, maintenance, memory, and tomorrow's revenue —
> automatically, in real time, and explainable to a human.

That's the loop we built. Follow it:

```
Guest requests  →  AI routing (time-aware SLA)  →  Staff action
      ↑                                                  ↓
  done & rated  ←  Guest sees live status        ←  completion
      ↓
 sentiment + maintenance + inventory signals
      ↓
      far better next stay  (memory → prep → delight)
```

### The characters in the story

- **Priya Sharma** — a *Power Guest* (returning visitor). The hotel remembers her:
  two stays, five preferences, one trust-tiered memory file. She checks in
  and the room is already right. **She never had to ask.**
- **Suresh**, Housekeeping Lead — sees the un-routed chaos collapsing into one
  queue with priorities, SLA bars and staff-load, instead of 40 WhatsApp chats.
- **The Duty Manager at 2AM** — the hero of our most profitable product moment:
  a noise complaint arrives, and the engine knows the front desk isn't staffed,
  so it routes to **DUTY_DESK, 15-minute SLA, compressed ladder**. Not 45 minutes.
  Not Maintenance. *The team that is actually awake.*

---

## PART 2 — THE PITCH (90 seconds)

> **Say this out loud. Pause at the bolded lines.**

---

"Every resort runs on three engines — **operations, guest experience, and revenue**.
Fifty rooms, a dozen dashboards, and a manager who has to be three people at once."

**Beat.** *"We built the fourth thing: an intelligence layer that joins all three."*

"Smart Resort 360 watches one request move through the whole system —
routed by **time-aware AI** to the team that's actually staffed, with an SLA
that knows 2AM is not 2PM, tracked live in a staff dashboard, completed,
**rated by the guest**, and from that rating the system's sentiment engine
already knows housekeeping quality is declining before the manager does."

**Beat.** *"And it remembers."*

"The memory engine observes every request across stays, scores its own confidence
honestly — **it can never claim 100% certainty** — and preps the room before a
returning guest walks in. It predicts the AC fault cluster before the fourth
complaint. It reorders stock at the critical threshold with the restock cost.
It turns occupancy into projected revenue."

**Beat.** *"No black boxes. Every alert carries the exact data and rule that
produced it — so a manager can act, or overrule, in seconds."*

"One request ties the whole resort together — **data → decision → action → a
guest who feels remembered.** That's Smart Resort 360. 98 tests pass. Built to run
offline with zero external dependencies. Live right now on this machine."

---

## PART 3 — THE LIVE DEMO SCRIPT (6–7 minutes)

> **Before you begin:** three browser tabs open —
> Guest app `:5173` · Staff dashboard `:5174` · API docs `:8000/docs`
> Log in as **Guest** (Priya) and **Staff** (Suresh) in advance where possible.

---

### ACT 1 — "The full loop" (2 min)

**Narrate:** *"The test every judge runs — submit a request as a guest, watch it
happen on operations."*

1. Guest app → **AI Assistant** → type: `"The AC in my room is not working"`
2. Point at the reply: *it understood → categorised → routed.*
   If the AI ran a tool, mention the **"Routed to Maintenance — In progress"** chip.
3. Switch to **Staff dashboard → Requests** → the AC request is at the top:
   **HIGH priority · Maintenance · SLA bar running.**
4. Click **Start** → flip back to guest app → status changed **live** on both sides.
5. Tap **star rating** (3 or 4) → *"that rating just fed the sentiment engine —
   we'll see it pay off next."*

**Payoff line:** *"One request, both sides, live. Nothing mocked."*

---

### ACT 2 — "The 2AM problem" (1.5 min)

**Narrate:** *"Every judge asks: what happens at 2AM? To most systems, 2AM and
2PM are the same hour. To a resort they're opposite worlds."*

1. Staff → **Escalations → Routing Explainer**
2. Click **"2AM noise complaint"** preset → **Explain routing** →
   - **HIGH** priority · **DUTY_DESK** · **15-min SLA** · compressed ladder
3. Now change time to **14:00** → Explain again →
   - **MEDIUM** · **Maintenance** · **45-min SLA**
4. *"Same complaint. Different routing. Because the system knows what's staffed
   at 2AM — the roadmap even shortens at night when there are fewer people."*

**Payoff line:** *"That's a decision, not a dashboard."*

---

### ACT 3 — "Beyond displaying data" (2.5 min)

**Narrate:** *"The brief says: go past data, to alerts, predictions, actions. Here
are four that every resort manager would pay for."*

1. **Predictive Maintenance** → click the **MEDIUM alert** —
   *"Inspect the central AC plant"*.
   - *"One AC complaint is a request. Four in seven days is a **systemic fault**.
     The engine tells you to fix the root cause before guest five complains."*
2. **Sentiment** → category scores + the **declining housekeeping trend** —
   *"That trend line is a detected signal. The front desk learns before the
     bad TripAdvisor review lands."*
3. **Inventory** → **LOW/CRITICAL** items with **restock cost** —
   *"Stock depletes down on every completed request and auto-flagged at the
     threshold. No spreadsheet, no guess."*
4. **Guest Memory** → Load **Priya's brief** →
   - Prep actions, 5 memories, **Power Guest** segment, confidence bars.
   - **Show the trust tiers:** *You told us · We noticed · We guessed.*
   - **Show "Forget all"** (or one item): *"DPDP one-tap compliance. Hard delete.
     The audit trail stays for compliance — the memory doesn't."*

**Payoff line:** *"Five different decision signals, all live, all explainable."*

---

### If time is short — the *minimum viable demo*

Only 3 minutes? Do exactly this:

1. Chat: *"AC not working"* (10s) → Staff board shows it (20s) → **Start** (10s)
2. Escalations → 2AM vs 2PM explainer (30s)
3. Maintenance alert "Inspect central AC plant" (20s)
4. Guest Memory → Priya → prep actions + "Forget all" (30s)
5. Close with the one-liner + *"98 tests pass."*

---

## PART 4 — JUDGE BATTLE CARDS (Q&A)

| The question | The answer (short, then one deep cut) |
|---|---|
| **"This is just a request tracker."** | *"The tracker is table stakes. The value is the loop: a rating becomes a trend, a cluster becomes a maintenance alert, a completed request depletes stock and triggers a reorder, and every preference accumulates into memory that preps the next stay."* |
| **"Where is the actual AI?"** | *"Four engines: time-aware SLA routing, honest-confidence memory scoring, systemic-fault detection in maintenance, and trend detection in sentiment. Each converts data into a decision signal. Plus an intent-driven concierge that actually executes tool calls."* |
| **"How is this different from a chatbot?"** | *"The chatbot can't stock a linen room or predict a chiller fault. That's infrastructure. Open Guest Memory — it's a real preference model with confidence scoring, not a canned reply."* |
| **"Why not buy eZee / a PMS / Sabre?"** | *"They're PMS-first, or enterprise-priced. We're intelligence-first and sit **alongside** an existing PMS via lightweight API integration — no rip-and-replace. Same reason · new layer."* |
| **"Can the memory be wrong?"** | *"Yes — and it says so. Confidence is capped: INFERRED ≤ 40%, OBSERVED climbs per stay, STATED overrides. `1 - 0.55ⁿ` never hits 100%. By design."* |
| **"Show me the data is real, not hardcoded."** | *"Live API at :8000/docs. Login as demo staff, call `/hotel/revenue`, `/hotel/maintenance/alerts`, `/hotel/inventory`, `/memory/mine` — every figure comes from the database pipeline. 98 automated tests."* |
| **"Data privacy?"** | *"DPDP-aligned: per-item and one-tap forget, hard delete, audit trail retained, confidence tiers instead of false certainty, cross-guest isolation tested."* |
| **"Business model / market?"** | *"₹50–150/room/month SaaS, ₹ free tier under 20 rooms. India has 1M+ independent hotels/homestays the enterprise tiers can't reach. Edge: predictive maintenance and retention for the budget-to-mid segment."* |
| **"What's the moat?"** | *"The memory data model. It compounds — every stay makes the next stay better. A competitor can build a dashboard in a month; a memory graph with trust tiers takes trust you can't demo-fake."* |
| **"What would you build next?"** | *"Dynamic pricing that consumes these same signals, WhatsApp-native staff operations, and offline→online sync for resort connectivity dead zones."* |

---

## PART 5 — NUMBERS CHEAT SHEET (memorise the bold ones)

- **98 automated tests passing**, 13 suites
- **40 rooms**, 4 floors, 4 room tiers (Deluxe ₹4,500 / ₹4,800 · Family ₹6,500 · Suite ₹9,500)
- **6 departments** with live staff load (Housekeeping, F&B, Maintenance, Front Desk, Concierge, Wellness)
- **57 curated Jaipur POIs**, real hours + coords, haversine-routing engine
- **4 AC complaints in 7 days** → predictive-maintenance alert "inspect central plant"
- **Sentiment:** FOOD 5.0 · MAINTENANCE 3.67 · HOUSEKEEPING 3.0 → **declining trend detected**
- **10 inventory items** seeded at/below reorder threshold (Bed Linen, Shampoo, Coffee CRITICAL)
- **5 cross-stay memories**, "Power Guest" segment, 3 trust tiers
- **2AM noise complaint:** HIGH / DUTY_DESK / 15 min vs **14:00:** MEDIUM / MAINTENANCE / 45 min
- Revenue: **ADR, projected daily revenue, arrivals/departures** — computed from live data
- Stack: **FastAPI · React 19 · Tailwind v4 · SQLite→Postgres-ready** — offline demo, zero external keys

---

## PART 6 — THE OPENING & CLOSING LINES

### 60-second cold open (memorable)

> *"A manager at a 60-room resort has three dashboards, two logbooks, and one
> very good memory of what guests liked last summer. **We built the memory.**
> Smart Resort 360 is the intelligence layer that joins operations, guest
> experience, and revenue — and turns a single guest request into five
> coordinated actions across the resort. Here's the 60-second proof."*

### 10-second close (if you only remember one thing)

> *"One request ties the whole resort together — **data → decision → action →
> a guest who feels remembered.** Ask me anything; it's all live."*

---

*Smart Resort 360 · SIH Hospitality Track · Built on FastAPI + React · 98 tests · Zero fake data*