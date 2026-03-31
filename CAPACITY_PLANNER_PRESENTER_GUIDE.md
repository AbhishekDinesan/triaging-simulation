# Capacity Planner Presenter Guide (10-Minute Prep)

Use this as a talk track for your demo.

## 1) What this tool is

The Capacity Planner is a **weekly capacity simulation** for pediatric service operations.

You are balancing:

- demand (arrivals),
- service capacity (clinicians x hours),
- access (waitlist/time to start),
- continuity (active caseload progression),
- and efficiency (utilization).

It is not individual appointment scheduling. It is a **system-level planning model**.

---

## 2) How to open it quickly

1. Go to **Instructor Dashboard**.
2. Set **Simulation Mode = Capacity Planning**.
3. Set **Simulation Difficulty = Easy / Medium / Hard**.
4. Switch to Student view.

You should see:

- Capacity Planning Simulation header,
- Curriculum section (technical + application chapters),
- Planning levers and weekly outcome panels.

---

## 3) The core levers (what to say)

- **Clinicians**: increases/decreases total available staffing.
- **Hours per Clinician**: expands/limits weekly service supply.
- **Protected Buffer Slots**: slack held back for resilience (reduces nominal capacity now, reduces fragility).
- **Base Arrivals / Week**: baseline demand pressure.
- **Demand Regime**:
  - `Normal`: stable arrivals.
  - `Surge`: spike during weeks 8-14.
  - `Volatile`: random week-to-week fluctuation.
- **Cadence Policy**:
  - `Weekly` (faster progression),
  - `Biweekly` (slower progression),
  - `Intensive blocks` (higher progression pressure).

---

## 4) What happens each week (mental model)

Each week the engine does this:

1. Generate arrivals (depends on demand regime + difficulty).
2. Compute available capacity:
   - nominal = clinicians x hours - buffer
   - then apply a disruption loss (difficulty-dependent).
3. Allocate capacity adaptively:
   - the model automatically shifts intake pressure based on backlog conditions.
4. Update state:
   - waitlist increases by arrivals, decreases by new starts,
   - active caseload increases by starts, decreases by completions,
   - utilization from delivered visits / available capacity.

You then observe trendlines and adjust policy.

---

## 5) Difficulty levels (what changes)

Difficulty affects both uncertainty and progression:

- **Easy**
  - lower disruptions,
  - lower volatility,
  - smaller surge multiplier,
  - faster progression.
- **Medium**
  - balanced baseline.
- **Hard**
  - higher disruptions,
  - wider volatility,
  - larger surge multiplier,
  - slower progression.

In short: hard mode makes backlog control and stability much more difficult.

---

## 5.1) Technical appendix (capacity only)

This is the exact capacity-planning difficulty logic used in the frontend simulation.

### Difficulty profiles

Each difficulty sets:

- default starting controls: clinicians, hours/clinician, arrivals, buffer
- uncertainty parameters: surge multiplier, volatility range
- disruption parameters: base disruption + jitter
- progression parameter: progress multiplier

### Weekly update equations

Let week `t` state be `(waitlist_t, active_t)`.

1. **Arrivals**
   - `normal`: `arrivals_t = baseArrivals`
   - `surge` (weeks 8-14): `arrivals_t = round(baseArrivals * surgeMultiplier)`
   - `volatile`: `arrivals_t = clamp(baseArrivals + noise, 1, 16)`, where `noise ∈ [-volatilityRange, +volatilityRange]`

2. **Available capacity**
   - `nominal_t = clinicians * hoursPerClinician - bufferSlots`
   - `disruptionRate_t = clamp(disruptionBase + centeredRandom * disruptionJitter, 0, 0.45)`
   - `available_t = max(0, nominal_t - round(nominal_t * disruptionRate_t))`

3. **Adaptive intake allocation (automatic)**
   - `waitPressure_t = waitlist_t / max(1, waitlist_t + active_t)`
   - `startShare_t = clamp(0.3 + 0.35 * waitPressure_t, 0.3, 0.65)`
   - `newStartCap_t = floor(available_t * startShare_t)`
   - `continuationCap_t = available_t - newStartCap_t`

4. **Flow**
   - `newStarts_t = min(waitlist_t + arrivals_t, newStartCap_t)`
   - `waitlist_{t+1} = max(0, waitlist_t + arrivals_t - newStarts_t)`
   - `activePool_t = active_t + newStarts_t`
   - `continuationVisits_t = min(activePool_t, continuationCap_t)`

5. **Progression**
   - base cadence discharge rate:
     - weekly: `0.12`
     - biweekly: `0.07`
     - intensive: `0.15`
   - `effectiveDischargeRate_t = baseCadenceRate * progressMultiplier`
   - `completed_t = round(activePool_t * effectiveDischargeRate_t)`
   - `active_{t+1} = max(0, activePool_t - completed_t)`

6. **Utilization**
   - `delivered_t = newStarts_t + continuationVisits_t`
   - `utilization_t = round(100 * delivered_t / available_t)` (clamped 0-100)

### Why hard mode is harder

Hard mode combines:

- higher baseline arrivals,
- larger surge/volatility,
- higher disruption loss,
- slower progression.

That increases backlog growth risk and reduces stability under the same policy.

---

## 6) How to read the outputs

- **Waitlist**: immediate access pressure.
- **Active Caseload**: ongoing service load.
- **Utilization %**: how close you are to capacity limit.
- **Completed (Total)**: throughput over the run.
- **Utilization Trend**: stability/fragility over time.
- **Recent Weekly Outcomes**: quick diagnostics for arrivals, starts, backlog, and utilization.

---

## 7) 5-minute live demo script

### Minute 0-1: Framing

"This is a system-level capacity planner. We choose staffing and policy levers, then test performance over 24 weeks under uncertainty."

### Minute 1-2: Baseline run

- Keep defaults.
- Click **Auto Play** for ~8-10 weeks.
- Point to waitlist/utilization trend.

Say: "Baseline gives us a reference operating point."

### Minute 2-3: Stress test

- Set Demand Regime = `Surge` or `Volatile`.
- Continue run.

Say: "Now we test policy robustness when demand conditions change."

### Minute 3-4: Policy response

- Increase buffer by 1-2 and/or clinicians by 1.
- Increase/decrease arrivals and change demand regime to stress test policy.

Say: "We trade off efficiency vs resilience and access."

### Minute 4-5: Difficulty comparison

- Reset.
- Switch to `Hard` difficulty.
- Run again for a few weeks.

Say: "Same policy under harder conditions gives different outcomes. This teaches robust planning, not single-scenario optimization."

---

## 8) Likely questions + answers

**Q: Is this predictive or prescriptive?**  
A: Both. It simulates outcomes under uncertainty (predictive behavior) and supports policy comparison/selection (prescriptive use).

**Q: Why include buffer if it lowers capacity?**  
A: Buffer improves resilience against disruption/volatility. It may reduce short-term utilization but prevent backlog shocks.

**Q: How are new starts handled without a manual share control?**  
A: The engine uses an adaptive intake policy that prioritizes backlog clearance more when wait pressure grows.

**Q: What is success?**  
A: Stable/declining waitlist, acceptable utilization (without persistent overstrain), and sustainable throughput.

---

## 9) One-line close

"The Capacity Planner teaches how to make robust operational decisions under uncertainty by exposing tradeoffs between access, continuity, and efficiency."
