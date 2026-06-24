# Event Timing, Overlaps & Live-Start Alerts — Truth Document

Last researched: 2026-06-24. Owner: scheduling. This is the source of truth for **how long events
run**, **how we decide two events overlap**, **how we estimate individual fight start times**, and
**how live "it's starting now" alerts should work**. Code mirrors this in `src/lib/sportTiming.ts`;
the DB can later learn refined numbers from observed event durations (see "DB learning" below).

Today-awareness rule (applies everywhere): the app and any automation must compare event times to
the **current date/time**. A passed event is never an overlap, a spotlight, or an alert candidate.

---

## 1. Why the old overlap flag was wrong

`findConflicts` assumed **every** event runs a flat **2 hours** and flagged any two events whose
2h windows touched. That's coincidentally ~right for soccer but wrong for everything else (an NFL
game runs ~3h15, a fight card ~5h, a tennis 5-setter ~4h, a baseball game ~2h40), and it gives a
single binary "OVERLAP" with no notion of *how close*. Result: a wall of pink even when events only
share a date.

We replace it with **sport-aware, tiered** overlap using the run times below.

---

## 2. Run times per sport (wall-clock, not just play time)

"Typical" = median broadcast/wall-clock length of one event of that sport, used as the overlap
window. "Hard cap" = a generous upper bound (extra time, long matches) for the *potential* tier.
Sources are official governing bodies / league length data where available.

| Sport (canonical key) | Typical | Hard cap | Notes & source |
| --- | --- | --- | --- |
| `soccer` | 115 min | 150 min | 90' play + 15' half + stoppage ≈ 1h55. Knockout (ET + pens) ≈ 2h30. (IFAB Laws of the Game; broadcast windows) |
| `basketball` | 140 min | 180 min | NBA wall-clock ≈ 2h15–2h30 incl. timeouts/half; OT longer. (NBA broadcast length) |
| `american_football` | 195 min | 240 min | NFL averages ~3h12 game length. (NFL operations game-length data) |
| `hockey` | 150 min | 195 min | NHL ≈ 2h30 (3×20 + 2 intermissions); OT/shootout longer. (NHL) |
| `baseball` | 165 min | 240 min | MLB ≈ 2h40 since the 2023 pitch clock; extra innings open-ended. (MLB pace-of-play) |
| `tennis` | 150 min | 300 min | Best-of-3 ≈ 1h30–2h30; men's Slam best-of-5 ≈ 3–4h, can exceed 5h. (ATP/Grand Slam match data) |
| `golf` | 300 min | 480 min | Not a "match" — a tournament round/coverage window is all-afternoon. Treat as all-day; overlap is low-signal (see §3.4). (PGA Tour broadcast windows) |
| `motorsport` | 120 min | 180 min | F1 race window ≈ 2h (race ≤ 2h + grid/podium). Practice ~1h, qualifying ~1h. A *weekend* spans days — overlap is per session. (FIA/F1) |
| `combat_sports` | 300 min | 360 min | A full card (prelims + main) ≈ 4–6h. Individual **bouts** are minutes — see §4 for per-fight estimation. (UFC/boxing broadcast) |
| `athletics` | 150 min | 210 min | A meet **session** ≈ 2–3h (Diamond League ~2h). Individual events are minutes. (World Athletics) |
| `olympic_sports` | 150 min | 240 min | Varies wildly by discipline; default to a session length. Refine per-sport later. |
| `cricket` | 210 min | 480 min | T20 ≈ 3–3.5h; ODI ≈ 8h; Test = multi-day. Default T20; flag format explicitly. (ICC playing conditions) |
| `rugby` | 105 min | 130 min | 80' play + half + stoppage ≈ 1h45. (World Rugby Laws) |
| `volleyball` | 110 min | 150 min | Best-of-5 sets ≈ 1h30–2h. (FIVB) |
| `handball` | 80 min | 100 min | 2×30 + half ≈ 1h15–1h20. (IHF) |
| `cycling` | 300 min | 420 min | A road stage ≈ 4–6h; classics all-day. Treat as all-day window. (UCI) |
| `snooker` | 180 min | 480 min | A session ≈ 2.5–3h; long matches/finals span sessions. (WST) |
| `darts` | 120 min | 240 min | A match ≈ 1–2h; a TV session/night ≈ 3h. (PDC) |
| `esports` | 120 min | 300 min | A Bo3 ≈ 1.5–2.5h; Bo5 longer; a tournament day is all-day. (per-title broadcasts) |

These are intentionally **wall-clock** (what blocks a viewer's evening), not regulation play time —
overlap is about "can I watch both," so timeouts/halftime/walkouts count.

---

## 3. Overlap algorithm (tiers + colors)

Each event gets a window `[start, start + typical]`. For an earlier event A and later event B,
let `gap = B.start − (A.start + typicalA)` (minutes of clear air between A's typical end and B's
start; negative means their windows intersect).

### 3.1 Tiers
- **True overlap → PINK.** Same start time, OR the windows intersect by more than a small margin
  (`gap ≤ −CLOSE_MARGIN`). You genuinely can't watch both live.
- **Potential / close → YELLOW.** The windows *just* miss or *just* clip — `−CLOSE_MARGIN < gap ≤ +CLOSE_MARGIN`.
  e.g. soccer (typical ~115') and the next event starts 110' later: gap ≈ −5' → it's ending as the
  next starts. "Close to full time," worth a heads-up but not a hard clash. This is the user's
  yellow case.
- **No conflict.** `gap > CLOSE_MARGIN` — clear separation.

`CLOSE_MARGIN` default = **20 minutes**. Tunable per sport later.

### 3.2 Pairwise, not adjacent-only
Compare every pair within the same day-ish window (a sweep line by start time, breaking once a
candidate starts after A's hard-cap end). A's tier is the **strongest** conflict it has with any
other event (pink beats yellow).

### 3.3 Cross-sport
Use **each event's own sport window** for its half of the comparison. An NBA game (140') starting
at 7:00 and a fight card (300') starting at 9:00 overlap because the card's window swallows the
basketball tail — compute against the longer of the two relevant windows for the "true" test, and
the shorter for the "potential" buffer.

### 3.4 All-day sports
Golf/cycling/Test cricket are effectively all-day. Flagging them as overlapping everything is
noise. Rule: **all-day sports never raise a hard PINK against other sports** — at most YELLOW
("on in the background"). They can still PINK against another instance of the same all-day sport.

### 3.5 Colors (visual)
- **Pink (true):** revise the current `neon-magenta` to a **retro-future / 80s neon pink** with a
  *bare-minimum* glow (a 1–2px soft outer glow at low opacity — enough to pop, not bloom).
- **Yellow (potential):** reuse the existing `flap-tbd` amber, same minimal-glow treatment.
- Badges read `OVERLAP` (pink) and `CLOSE` (yellow).

---

## 4. Fight-card per-bout time estimation (the hard one)

Fight cards publish a **card start time** and an **order**, almost never per-fight times — fights
end early (KO) or late (decision), so any estimate drifts. Our best-guess model:

- **Per-bout budget** = `scheduled_rounds × 5 min` (round length) + **break** between rounds
  (`(rounds − 1) × 1 min`) + **changeover** before the bout (walkouts + intros) ≈ **10 min**.
  - 3-round prelim ≈ 15 + 2 + 10 = **~27 min** budget.
  - 5-round main ≈ 25 + 4 + 10 = **~39 min** budget.
- **Cumulative estimate:** bout N's estimated start = card start + Σ(budgets of bouts before it).
- **Finish factor:** fights rarely go the distance — apply an expected-finish multiplier
  (≈ **0.65** of full budget for prelims, ≈ 0.8 for mains) to get a *median* estimate, and keep the
  full-budget number as the "no earlier than / no later than" band. Show a **window**, not a point
  ("~9:40–10:20 PM"), and label it estimated.
- **Live correction:** once feeds exist (§5), recompute downstream bouts from the *actual* end time
  of the fight in progress — this is what makes the estimate trustworthy.
- Store the inputs (`scheduled_rounds`, `bout_order`, `est_start_window`) on `event_bouts` (columns
  already exist) so the UI and alerts share one source.

---

## 5. Live "it's starting now" alerts (esp. fight cards)

Goal: email/push *"the fight you care about is starting — pause your movie, open the app."* Only
meaningful with a live feed.

- **Trigger source:** a live-polling worker (the unbuilt "live tier", 15–120s polling for live/
  followed events) watches in-progress fight cards and fires when the **target bout** transitions to
  live (or the previous bout ends).
- **Targeting:** users follow a fighter or "alert me for fight #X / the main event." The notification
  pipeline (`alert_preferences`, `notification_deliveries`) gains a `live_start` kind.
- **De-bounce / respect:** at most one live-start per followed bout; honor quiet hours and the
  user's channel choice (email/push). Never fire for a passed event.
- **Generalizes:** same pattern for "your race is going green," "your match is the next on court,"
  "tip-off in 5." Fight cards are just the highest-pain case.

---

## 6. DB learning (refining the numbers)

The table above is a starting prior. Over time we can learn real durations:

- When an event has both a real start and a real end (from feeds/results), log
  `actual_duration_min`.
- Periodically compute the **median actual duration per sport (and per league/format)** and store it
  as the live overlap window, falling back to the static prior when we have < N samples.
- Cricket/combat especially benefit (format variance is huge) — learn per-format windows
  (T20 vs ODI vs Test; 3-round vs 5-round).
- Keep the static priors in code as the floor so a cold DB still behaves.

---

## 7. Implementation plan (sequenced)

1. **`src/lib/sportTiming.ts`** — the run-time table above (canonical key → {typical, hardCap, allDay})
   + `overlapTier(a, b)` returning `'overlap' | 'close' | null`. *(this pass)*
2. **Upgrade `findConflicts`** → return `Map<index, 'overlap' | 'close'>`, sport-aware, pairwise. *(this pass)*
3. **Wire tiers + colors** into MatchCard / EventTicket (pink vs yellow badge + minimal-glow). *(this pass)*
4. **Fight-bout estimation** in the event detail (uses §4; columns exist). *(next)*
5. **DB learning job** — actual-duration logging + median windows. *(next, needs feeds)*
6. **Live-start alerts** — depends on the live tier + notifications `live_start` kind. *(future)*
