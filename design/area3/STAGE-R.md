# Stage R: nine depths (build brief)

29 Sep 2026. The build brief for stage R of `design/area3/BOTH-ROADS.md` §5. A coding agent follows it
step by step (R0 to R9). The lead reviews each step against its "Done when" list. Every file:line cited
here was checked against the tree at 4e2d0a1. **Where this brief and BOTH-ROADS disagree, this brief
follows the code, and §7 lists each case.**

Every player-facing word stays PLACEHOLDER, because the words are Adrian's to write. Do not commit, and
do not run `npm run dev`: `vite.config.ts` sets `server.host: true`, which binds 0.0.0.0 (HANDOVER
29 Sep says no dev server on the office network). Checks start their own vite on 127.0.0.1 (§4.0).

---

## 1. Scope

Stage R adds one new DEV flag, `BOTH_ROADS` (`?roads=1`). With the flag on, a run is 9 depths: the
ruin (1-3), then the road chosen at the crossroads (4-6), then the other road (7-9), then the walk home.
With the flag off, the game is exactly what's live today: 6 depths, today's curve, today's day, and
today's `__gen` output for depths 1-6 on both routes. With the flag on:

- the Line has trains but no bodies of its own, and it ends in a DEV stand-in boss: Home's second
  Assembler, with `adds: 'rams-mites'`;
- boss 6 opens a cold beam and a warm beam, and the cold beam is dressed as the other road;
- boss 9 opens a warm beam only;
- Home at 6 is a dusk homecoming with no walk;
- one day stretches over the 9 depths, and the last boss takes it to first dark by its HP;
- the Works' first depth, 4 or 7, is an open field. The Line never gets one;
- the curve is CURVE9's first-pass 9-depth table.

The whole point is to hand Adrian a 9-depth run on his phone, so he can measure its length.

**Out of scope (stage B / C / T / Live), do not build:**
- LINE-RULES R1-R8 and R10 (the Signalman's break rule, Parry Clamp catching tells, `committed` for
  pressure bodies, the no-crouch-on-lit-strip rule, train damage × `curveAt(d).hp`, Sleepers never
  elite, the crouch booking its lunge, the lesson call on waking). Only **R9** and **R11** are in R.
- `signal.ts`, the Handcar variant, `LINE_BODIES` flips, the `ballast` look, the `sleepers` hide, the
  `line` / `roundhouse` ambience, the notebook re-roles (B).
- `engine.ts`, the roundhouse arena, and the Engine's hazards reading `bossDmg` (C). `ENGINE_ON_LINE`
  stays false.
- `crawlBpm` at 7-8 (main.ts:3947), strain over 9 depths, `QUIET_FLOOR`, tuning the curve, and
  `tools/curvesim.ts` (T).
- dropsim over 9 depths. **`tools/levels.json` is not touched**: dropsim assumes depths 1-6 of road II.
- The named-part suffix order (pool.ts:144-146), and every name, label and ending word.
- Flipping any flag to true on main (Live). `LINE_ENABLED`, `ENGINE_ON_LINE` and `BOTH_ROADS` all stay
  `false`.
- SPEC.md / BOTH-ROADS.md / HANDOVER.md edits. Those are the lead's.

**The run with the flag on** (the phases are as today; only the transitions below are new):

```
d1 ─cold→ d2 ─cold→ d3[Assembler] ─cold→ (crossroads room | straight to d4) → d4 ─→ d5 ─→ d6[boss A]
d6[boss A] ─cold (dressed as the other road)→ d7 ─→ d8 ─→ d9[boss B] ─warm→ homing → toWalk → walkHome(10) → ending(home, night)
d3 ─warm→ homing → ending(home, afternoon)      d6 ─warm→ homing → ending(home, dusk)   (no walk)
any depth: HP 0 → ending(broken) · strain full → ending(stopped)   (hour by hourAtEnd, unchanged flow)
```

There is never a crossroads room between areas 2 and 3. The room at 3 appears only when
`crossroadsDue()` (main.ts:2793) says so, and that needs `flag('line')` **and** `save.roads` containing
`'III'`. Otherwise the order is Works then Line.

**Decision: `BOTH_ROADS` on with `LINE_ENABLED` off.** `BOTH_ROADS` alone gives 9 depths, and the
Line is area 3 on every run. The order is always Works then Line, because with `flag('line')` off
three things never happen: the room never appears, the alternate never picks the Line, and
`save.roads` never gains `'III'` (main.ts:3015). With the flag on, `flag('line')` no longer means
"the Line exists". It means "the Line can come first".

- `?roads=1`: every run is Works then Line.
- `?roads=1&line=1`: the stage-A gate plus the room. That means Works then Line until an Assembler
  has fallen, then the room from the next run on.

Why: the Line has to generate for BOTH_ROADS to mean anything, and this needs no new state.

---

## 2. Data contracts

### 2.1 `src/areas.ts`

```ts
// --- replaces RUN_DEPTHS at :15-16 (moved below flag(); see "where" notes) ---

/** Both roads in one run (design/area3/BOTH-ROADS.md §4). DEV override ?roads=1. */
export const BOTH_ROADS = false                                     // next to LINE_ENABLED (:31)

export type FlagName = 'line' | 'engine' | 'porter' | 'roads'       // :39
const FLAG_DEFAULT: Record<FlagName, boolean> =                     // :40
  { line: LINE_ENABLED, engine: ENGINE_ON_LINE, porter: PORTER_ENABLED, roads: BOTH_ROADS }
// flagOverride (:45-47) gains `roads: null`; the URL loop (:50) reads ['line','engine','porter','roads'].
// INV-F1: setFlags (:66-69) never touches 'roads'. Its loop stays ['line','engine','porter','roadChoice'].
// flagsNow (:71) gains `roads: flag('roads')`.

/**
 * INV-F2: 6 or 9, fixed for the page's life. It is read once at module load, after the URL overrides
 * (:48-54). A production build always reads BOTH_ROADS. INV-F3: RUN_DEPTHS === 9 ⇔ flag('roads').
 */
export const RUN_DEPTHS: 6 | 9 = flag('roads') ? 9 : 6              // place directly after flag() (:56-59)

export const otherRoad = (r: RouteId): RouteId => (r === 'II' ? 'III' : 'II')

/** A road's own step: 1-3 are the ruin; 4/5/6 are a road's first, second and last depth. */
export type Step = 1 | 2 | 3 | 4 | 5 | 6
/**
 * INV-S1: stepOf(d) === d for every d in 1..6, whatever the run length.
 * INV-S2: stepOf(7|8|9) === 4|5|6. The depth is clamped to 1..RUN_DEPTHS first,
 *         with today's clamp expression (Math.max(1, Math.min(RUN_DEPTHS, depth))), not floored.
 */
export function stepOf(depth: number): Step

/**
 * The road a depth is on. `order` is ALWAYS the road taken at the crossroads (run.route, area 2's
 * road), never the road at some depth.
 * INV-O1: clamped depth <= 6 → order; 7..9 → otherRoad(order). In a 6-depth run, always order.
 * INV-O2: every exported function that takes a `route` param (lookAt, areaOf, bossFor, openAt) and
 *         every dev hook that takes one (__gen, __genLook, __genKit, __census, __plan) takes the ORDER
 *         and applies roadOf once, inside. Callers never pass roadOf(...) in.
 */
export function roadOf(depth: number, order: RouteId = 'II'): RouteId

/**
 * INV-P1: the open field is depth 1, and the Works' first step (4 on Works-first, 7 on Line-first).
 *         Never the Line's, never a boss's: exactly two per 9-depth run.
 * INV-P2: in a 6-depth run: 1, and 4 only when order is 'II'. That equals today's OPEN_DEPTHS [1, 4]
 *         after the generator's own `!gen.line` refusal (dungeon.ts:1152).
 */
export function openAt(depth: number, order: RouteId = 'II'): boolean
//   = depth === 1 || (depth <= RUN_DEPTHS && stepOf(depth) === 4 && roadOf(depth, order) === 'II')

/**
 * :84, body unchanged: `depth < RUN_DEPTHS ? ['cold','warm'] : ['warm']`.
 * INV-E1: length 1 or 2, members cold/warm only; 'warm' is in every result (home is open after every boss).
 * INV-E2: 9-depth: 3 → [cold,warm], 6 → [cold,warm], 9 → [warm]. 6-depth: 3 → [cold,warm], 6 → [warm].
 */
export function exitsAfterBoss(depth: number): ExitKind[]

/**
 * :96. 6-depth: today's body, verbatim, inside `if (RUN_DEPTHS === 6) { ... }`.
 * 9-depth:
 *   home:            depth >= 9 → 'night'; depth >= 6 → 'dusk'; else 'afternoon'
 *   broken/stopped:  <= 2 'morning'; 3 'noon'; <= 6 'afternoon'; else 'dusk'
 * INV-H1: for a fixed depth, home's hour is never earlier than broken's. No hour runs backward as depth rises.
 */
export function hourAtEnd(kind: 'broken' | 'stopped' | 'home', depth: number): HomeHour

/**
 * :347. The place at a depth.
 *   d = today's clamp; d <= 3 → ruin
 *   road = roadOf(d, route), step = stepOf(d)
 *   if (RUN_DEPTHS === 6 && road === 'III' && step === 6 && !engineOnLine) return PLACES.quarter  // 6-depth only: the roads meet in the square (today's :351)
 *   return PLACES[ROUTES[road][step as 4 | 5 | 6]]
 * INV-L1: 9-depth, both orders: the road's steps 4/5/6 read ROUTES[road] (Works: works/quarter/quarter;
 *         Line: sidings/station/station, the stand-in and a future roundhouse both in the station kit).
 */
export function lookAt(depth: number, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): PlaceDef

/**
 * :366. d = today's clamp; d <= 3 → areaI; else roadOf(d, route) === 'III' ? areaIII : areaII.
 * INV-A1: AreaDef.id names the ROAD (II Works, III Line), not the ordinal. The ordinal is ceil(depth / 3)
 *         (main.ts:2383's banner). AREAS stays two defs.
 */
export const areaOf: (depth: number, route?: RouteId) => AreaDef

/**
 * :414. Signature unchanged; `route` is the order.
 *   if (depth % BOSS_EVERY !== 0) return null
 *   hp(def) = Math.round(def.hp * curveAt(depth, RUN_DEPTHS).bossHp)
 *   last = stepOf(depth) === 6 && depth <= RUN_DEPTHS        // a road's last boss: 6, and 9 in a 9-depth run
 *   road = roadOf(depth, route)
 *   if (last && road === 'III' && engineOnLine)  → { ...ENGINE_DEF, hp }
 *   if (last && road === 'III' && RUN_DEPTHS === 9) → { ...ASSEMBLER_DEF, hp, adds: 'rams-mites' }   // STAND_IN: the Line's end until stage C
 *   if (last && arbiterAt6)                      → { ...ARBITER_DEF, hp }   // arbiterAt6 now means "the Works' last boss"
 *   return { ...ASSEMBLER_DEF, hp, adds: last ? 'rams-mites' : 'hulks' }
 * INV-B1: 6-depth: identical to today for every (depth, arbiterAt6, route, engineOnLine), including d 7-9
 *         (depth > RUN_DEPTHS is never `last`: 9 → Assembler 'hulks', as today).
 * INV-B2: 9-depth: exactly one Arbiter per full run, at the Works' last step; the Line's last step is the
 *         Engine (engine flag) or the stand-in.
 */
export function bossFor(depth: number, arbiterAt6 = ARBITER_AT_6, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): BossDef | null

// --- the day ---
export type DayKey = 'morning' | 'late-morning' | 'noon' | 'afternoon' | 'mid-afternoon' | 'late-afternoon'
  | 'early-dusk' | 'dusk' | 'first-dark' | 'night'   // mid-afternoon, early-dusk: internal names, never shown

// :458: today's literal is renamed HOURS (same entries, same order), typed with
//   `satisfies Record<Exclude<DayKey, 'mid-afternoon' | 'early-dusk'> | 'workshop', DayPreset>`, then:
export const DAY: Record<DayKey | 'workshop', DayPreset> = {
  ...HOURS,
  'mid-afternoon': mixPreset(HOURS.afternoon, HOURS['late-afternoon'], 0.5),
  'early-dusk': mixPreset(HOURS['late-afternoon'], HOURS.dusk, 0.5),
}
// (mixPreset is a hoisted function declaration; BASE_HEMI_SKY at :447 is initialised before :458.)

export interface DaySpan { from: DayKey; to: DayKey; by: 'rooms' | 'boss' | 'hold' }
const DAY_SPAN_6: Record<number, DaySpan> = { /* today's :503-508, verbatim */ }
const DAY_SPAN_9: Record<number, DaySpan> = {
  1: { from: 'morning',        to: 'late-morning',   by: 'rooms' },
  2: { from: 'late-morning',   to: 'noon',           by: 'rooms' },
  3: { from: 'noon',           to: 'noon',           by: 'hold'  },
  4: { from: 'afternoon',      to: 'mid-afternoon',  by: 'rooms' },
  5: { from: 'mid-afternoon',  to: 'late-afternoon', by: 'rooms' },
  6: { from: 'late-afternoon', to: 'late-afternoon', by: 'hold'  },
  7: { from: 'late-afternoon', to: 'early-dusk',     by: 'rooms' },
  8: { from: 'early-dusk',     to: 'dusk',           by: 'rooms' },
  9: { from: 'dusk',           to: 'first-dark',     by: 'boss'  },
}
/**
 * INV-D1: a row for every depth 1..RUN_DEPTHS.
 * INV-D2: exactly one row is by 'boss', at RUN_DEPTHS.
 * INV-D3: span[d].to === span[d+1].from for every d in 1..RUN_DEPTHS-1 except d = 3 (the crossroads is
 *         the afternoon, no span).
 */
export const DAY_SPAN: Record<number, DaySpan> = RUN_DEPTHS === 9 ? DAY_SPAN_9 : DAY_SPAN_6
```

`DEPTH_DAY` (:476) and `PLACE_OF` (:334) stay as they are. Neither is read.

### 2.2 `src/curve.ts`

```ts
export type RunLength = 6 | 9
/** Today's rows 1-6, verbatim (renamed from DEPTH_CURVE; nothing imports that name). */
export const DEPTH_CURVE_6: Record<number, DepthCurve>
/** The walk home: nothing reads it, but it's explicit. heavies 0. */
export const WALK_CURVE: DepthCurve = { hp: 1, dmg: 1, budget: 0, bigBonus: 0, heavyHp: 1, heavyDmg: 1, heavies: 0, bossHp: 1, bossDmg: 1 }
/** CURVE9.md §1, first pass, NOT locked. */
export const DEPTH_CURVE_9: Record<number, DepthCurve> = {
  1: { hp: 1.0, dmg: 1.0,  budget: 0, bigBonus: 0, heavyHp: 1.0,  heavyDmg: 1.0, heavies: 1, bossHp: 1,   bossDmg: 1 },
  2: { hp: 1.0, dmg: 1.0,  budget: 0, bigBonus: 0, heavyHp: 1.25, heavyDmg: 1.0, heavies: 1, bossHp: 1,   bossDmg: 1 },
  3: { hp: 1.0, dmg: 1.0,  budget: 1, bigBonus: 1, heavyHp: 1.0,  heavyDmg: 1.0, heavies: 2, bossHp: 1.0, bossDmg: 1.1 },
  4: { hp: 1.1, dmg: 1.2,  budget: 1, bigBonus: 0, heavyHp: 1.5,  heavyDmg: 1.1, heavies: 2, bossHp: 1,   bossDmg: 1 },
  5: { hp: 1.2, dmg: 1.25, budget: 2, bigBonus: 1, heavyHp: 1.75, heavyDmg: 1.2, heavies: 3, bossHp: 1,   bossDmg: 1 },
  6: { hp: 1.0, dmg: 1.0,  budget: 2, bigBonus: 1, heavyHp: 1.0,  heavyDmg: 1.0, heavies: 3, bossHp: 1.2, bossDmg: 1.0 },
  7: { hp: 1.2, dmg: 1.25, budget: 2, bigBonus: 1, heavyHp: 1.75, heavyDmg: 1.2, heavies: 3, bossHp: 1,   bossDmg: 1 },
  8: { hp: 1.3, dmg: 1.3,  budget: 2, bigBonus: 1, heavyHp: 2.0,  heavyDmg: 1.3, heavies: 3, bossHp: 1,   bossDmg: 1 },
  9: { hp: 1.0, dmg: 1.0,  budget: 2, bigBonus: 1, heavyHp: 1.0,  heavyDmg: 1.0, heavies: 3, bossHp: 1.3, bossDmg: 1.05 },
  10: WALK_CURVE,
}
/**
 * INV-C1: rows 1-3 are equal in both tables. budget, bigBonus and heavies are equal at 1-5, so pack
 *         generation at 1-5 is the same for both run lengths.
 * INV-C2: run 6: DEPTH_CURVE_6[d] ?? DEPTH_CURVE_6[5] (today's fallback, unchanged).
 *         run 9: DEPTH_CURVE_9[d] ?? WALK_CURVE.
 * INV-C3: the curve reads the real depth, never stepOf. The run length is a required argument, so tsc
 *         finds every call site.
 */
export function curveAt(depth: number, run: RunLength): DepthCurve
```

Call sites to update: areas.ts:417 (`RUN_DEPTHS`); dungeon.ts:1472 (twice) and :1604 (`RUN_DEPTHS`,
imported from areas); main.ts:2594 (`RUN_DEPTHS`); and combat.ts:454, which becomes `curveAt(1, 6)`
with the comment "row 1 is shared (INV-C1)". combat.ts must not import areas. Crawl trains stay a flat
20 (line.ts, untouched).

### 2.3 `src/dungeon.ts`

```ts
// :8 import gains RUN_DEPTHS, stepOf.
// :2028
const RUN_DEPTHS_WALK = RUN_DEPTHS + 1   // INV-W1: 7 in a 6-depth run (today), 10 in a 9-depth run
// generateLevel, first line after `const place = ...` (:1147):
const step: number = stepOf(depth)       // typed number so it indexes Record<number, …> without casts
```

The rule inside `generateLevel` (R9): **place and road rules read `step`. Only the curve reads `depth`.
The swarm lesson and the ram lesson read `depth`.** The full list is in R5.

### 2.4 `src/main.ts`

```ts
// :83-84 OPEN_DEPTHS: deleted. enterLevel (:2583) passes `open: openAt(depth, routeNow())`.
// :2296 routeNow stays, re-documented: "the ORDER (INV-O2): not chosen yet reads as the Works'".
/** The cold beam's dressing: the road it leads to, or null. */
function yardRoad(): RouteId | null
//   RUN_DEPTHS === 9 && run.depth === 6 → otherRoad(run.route ?? 'II')          // after boss 6: always the other road, no room
//   else today's gate (:2821-2822): depth 3, no route yet, alternate on, line on, Line open → routeForAlternate()
//   else null
```

DEV hooks, added inside the `if (import.meta.env.DEV)` block (:4342):

```ts
__runDepths: RUN_DEPTHS,
__stepOf: stepOf, __roadOf: roadOf, __openAt: openAt,
__curveAt: (d: number) => curveAt(d, RUN_DEPTHS),
__plan: (depth: number, order: RouteId = 'II') => {
  // step, road, place id, area id, boss { kind, hp, adds, arena } | null, open, exits, span, curve.
  // It uses devArbiterAt6 ?? ARBITER_AT_6 and flag('engine'), like bossHere.
},
__genLine: (depth: number, seed: number, order?: RouteId) => ...   // default: depth >= 7 ? 'II' : 'III' (the order that puts the Line here)
__census: (n = 40, route: RouteId = 'II') => ...                   // loops 1..RUN_DEPTHS (already); the header gains "runDepths": N after "n"
```

`savePlaytest` (:2716-2725): the body gains `runDepths: RUN_DEPTHS, route: run.route`. This is
additive, and it lets stage T split his logs by run length and order.

### 2.5 Save

No new save fields and no v4. `RunSnapshot.depth` goes up to 9, and `route` is the order.
`resumeRun` already clamps to `RUN_DEPTHS` (main.ts:2435), and its route inference (:2438-2439) is
correct for the order. `RunCard.route: 'III'` still means "Line first" (:2990). `save.roads` gains
`'III'` exactly as today (:3015). See §6 for flag-flip resumes.

---

## 3. Steps

Each step ends with all of these, in order:
- `npx tsc --noEmit -p .` clean;
- `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → PASS (K-90);
- the step's own checks: `node tools/checks/k9.mjs <ids>` → PASS.

A step that breaks K-90 is not done, whatever else passes. With the flag on, depths past a later step's
scope may still crash mid-way (e.g. entering 7 before R2). That's expected until R8.

### R0. The check harness and the flag-off baseline (no `src/` change)

- `npm i -D playwright-core@1.63.0`. It downloads no browser; checks use the system Chrome. This is the
  only `package.json` / `package-lock.json` change in stage R.
- `tools/checks/lib.mjs`:
  - `REPO`: the repo root, from `import.meta.url`.
  - `startVite()`: `createServer({ root: REPO, configFile: REPO + 'vite.config.ts', server: { host: '127.0.0.1', port: 5199, strictPort: false }, logLevel: 'error' })`, then `listen()`. It **asserts** `server.resolvedUrls.local[0]` starts with `http://127.0.0.1` and `server.resolvedUrls.network.length === 0`; if not, it closes and throws. Returns `{ url, close }`. Every script closes it in `finally`.
  - `openPage(url, query)`: a new browser context per call, launched with `chromium.launch({ executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] })`. It collects `pageerror` and console `error` into `errors`, and waits for `() => typeof window.__enter === 'function' && window.__level && window.__level()` (60 s). Returns `{ page, errors, close }`.
  - `hash(v)`: sha1 hex of `JSON.stringify(v)`.
  - `suite()`: `check(id, query, fn)` registers a check. `run(argvIds)` runs the checks (all, or the listed ids), groups them by query so each group gets one page, prints `PASS K-9x` or `FAIL K-9x: <first mismatch>`, treats any `errors` on a page as a FAIL of every check on it, and exits 1 on any fail.
- Every check URL carries `save=memory` except K-9C's. Every one carries `depth=1` (a dev run straight into a level) except K-9C's.
- `tools/checks/baseline.mjs capture|compare`, flag off (`?depth=1&save=memory`, no other params). It
  records, and `capture` writes `tools/checks/baseline/flagoff.json`:
  - `gen[route][d]`: `__gen(d, s, route)` for route II/III, d 1..6, s 1..20 (full JSON).
  - `genLookHash[route][d]`: `hash(__genLook(d, s, route))`, d 1..6, s 1..10.
  - `genLineHash[d]`: `hash(__genLine(d, s))`, d 4..5, s 1..10.
  - `censusDepthsHash`: `hash(JSON.parse(__census(40, 'II')).depths)`.
  - `pure`: `__bossFor(d, a6, r, e)` for d 1..9 × a6 {true,false} × r {II,III} × e {false,true}; `__areaOf(d, r)` for d 0..9; `__hourAtEnd(k, d)` for k × d 0..9; `__exitsAfterBoss(d)` for d 1..9; `__DAY_SPAN`.
  - `entered[route][d]`, for route II/III and d 1..6, in that order. Set `window.__run.route = route`, then `__enter(d, 1)`, then record `{ look: __look().place, open: !!__level().open, curve: __combat.curve, day: __day(), boss: __boss() && { kind, hp }, exits: __exits() }`. At boss depths, then `__killBoss(); __step(0.2)` and record `after: { exits: __exits(), yard: __yardRoad(), day: __day() }`.
  - `compare` reruns this and deep-equals it against the file, printing the first differing path.
  - Separately, as **info only** (never a fail), it prints whether `censusDepths` equals `tools/levels.json`'s `depths`. That file is from 25 Sep, and drift there predates stage R.
- `tools/checks/k9.mjs`: the suite. R0 registers no checks. Later steps add theirs.

**Done when:**
- `capture` then `compare` PASS on the untouched `src/`;
- a second `capture` gives a byte-identical file (it's deterministic);
- `lsof -iTCP -sTCP:LISTEN -n -P | grep 5199` shows only 127.0.0.1 while a script runs;
- `flagoff.json` is committed-ready under `tools/checks/baseline/`;
- the levels.json info line is reported to the lead.

### R1. The flag, the run length, the road helpers (`src/areas.ts`, hooks)

- areas.ts:
  - `BOTH_ROADS` next to `LINE_ENABLED` (:31).
  - `FlagName`, `FLAG_DEFAULT`, `flagOverride`, the URL loop and `flagsNow` per §2.1 (:39-71).
  - `setFlags` unchanged (INV-F1).
  - Delete `RUN_DEPTHS` at :15-16. Re-declare it after `flag()` (:59) as `export const RUN_DEPTHS: 6 | 9 = flag('roads') ? 9 : 6`, and move its doc comment.
  - Add `otherRoad`, `Step`, `stepOf`, `roadOf`, `openAt` (§2.1) directly below it.
  - Update `LINE_ENABLED`'s comment: "false: no crossroads and no alternate; with BOTH_ROADS the Line is still area 3 (Works first)".
- **Import sites of `RUN_DEPTHS`:** none change their import (the name stays). Its use sites, re-read for a value of 9:
  - main.ts:76 (`START_DEPTH`: `?depth=9` works with `roads=1`);
  - :2370 and :2469 (dead while `PEDESTALS_ON = false`, :1627);
  - :2435 (resume clamp);
  - :3874, :3877 (homing: below 9 is words, 9 is the walk; nothing to change);
  - :4407 (census);
  - day.ts:24;
  - areas.ts :85, :97, :348, :367, :418-420, :510 (rewritten in R2-R4).
- main.ts hooks: `__runDepths`, `__stepOf`, `__roadOf`, `__openAt` (§2.4). `__flags` (:4664) needs no type change. It returns `flagsNow()`, which now includes `roads`.

**Done when:** K-90, K-9B pass.

### R2. The day and the hour (`src/areas.ts`)

- `DayKey` (:425), `HOURS` / `DAY` (:458-475), `DaySpan`, `DAY_SPAN_6` / `DAY_SPAN_9` / `DAY_SPAN` (:496-509) per §2.1. `spanOf` (:510) is unchanged; it reads the selected table.
- `hourAtEnd` (:96-102) per §2.1. Update the comment at :91-95 to name the three homecomings (afternoon / dusk / night).
- `applyDayAt` (:586): hold the fog back when `spanOf(depth).by === 'boss' || (RUN_DEPTHS === 9 && depth === 6)`. That way the square keeps its far corner at 6, where the span is 'hold'. (The stand-in's yard at 6 gets it too, which is harmless.)
- day.ts: no code change. `enter` (:23-26) clamps to `RUN_DEPTHS` and reads `DAY_SPAN`. Update the comment at :5-12 ("at the last depth the last boss's HP").

**Done when:** K-90, and K-97a and K-96a (the pure halves) pass.

### R3. The curve (`src/curve.ts` and its call sites)

- curve.ts:27-45 per §2.2. Update the header comment: "rows for a 6- and a 9-depth run; 9 is CURVE9.md's first pass, not locked".
- Call sites per §2.2: areas.ts:417, dungeon.ts:1472 (both `curveAt`), dungeon.ts:1604, main.ts:2594, combat.ts:454.
- main.ts hook `__curveAt`.

**Done when:** K-90 and K-9A pass. `grep -n "curveAt(" src` shows every call with two arguments.

### R4. Places, areas, bosses, and the stand-in (`src/areas.ts`, hook)

- `lookAt` (:347-353), `areaOf` (:366-369) and `bossFor` (:414-421) per §2.1.
- Comments to update: ROUTES (:338, "the roads meet only in a 6-depth run"); `ARBITER_AT_6` (:403-407, "the Works' last boss"); `ENGINE_DEF` (:398).
- main.ts hook `__plan` (§2.4). `routeNow` / `bossHere` / `placeNow` (:2296-2298, :3967-3969) need **no change** (INV-O2). Only re-document `routeNow`.

**Done when:** K-90 and K-92a (the `__plan` tables) pass.

### R5. Generation by step (`src/dungeon.ts`, hooks)

In `generateLevel` add `const step: number = stepOf(depth)` after :1147, then:

| line | today | becomes |
|---|---|---|
| 1158 | `layLine(layout, progress.of, gen.line, depth, seed)` | pass `step`; rename `layLine`'s param `depth` → `step` (:998) |
| 1110, 1123, 1128 | `depth === 4` (holds, lesson lane) | `step === 4` |
| 1411 | `depth === 2` (ram lesson) | unchanged |
| 1414 | `depth === 4` (swarm lesson) | **unchanged**: the run's depth 4 only (R9) |
| 1419, 1420 | `line && depth === 4` (Handcar, Signalman lessons) | `line && step === 4` |
| 1425 | `depth === 4` (the ram rooms) | `step === 4` |
| 1432 | `depth === 4 && place.id === 'works'` (heap) | `step === 4 && place.id === 'works'` |
| 1445, 1449, 1452 | `SLEEPERS_CHANCE[depth]`, `depth !== 4` | `const sleepersChance = RUN_DEPTHS === 9 && depth === 4 ? undefined : SLEEPERS_CHANCE[step]` (R11: no Sleepers on the Line at the run's depth 4); use it in both reads; `depth !== 4` → `step !== 4` |
| 1456 | `depth === 5 && !line` (Lobber lesson) | `step === 5 && !line` |
| 1463 | `CAPS(depth)` (twice) | `CAPS(step)` |
| 1473-1475 | `depth === 1`, `0.3 * depth`, `depth >= 4` | unchanged (same value for 7-9: `min(0.85, …)` saturates) |
| 1509, 1510 | `depth >= 5` | `step >= 5` |
| 1511 | `depth >= 7 ? D7 : D5` | `step >= 7 ? D7 : D5` (D7 is kept, unused; comment it "stage T") |
| 1604 | `curveAt(depth, RUN_DEPTHS).heavies` | unchanged (real depth) |
| 1635 | `THIEF.depths.includes(depth)` | `THIEF.depths.includes(step)` (`depth >= 2` unchanged) |
| 1671 | `MENDER.chance[depth]` | `MENDER.chance[step]` |
| 1759 | `exitsAfterBoss(depth)` | unchanged (real depth) |
| 2027-2028 | `RUN_DEPTHS_WALK = 7` | `= RUN_DEPTHS + 1` (INV-W1); comment "the walk is past the last depth" |

- Update the comments at :914-916 (SLEEPERS_CHANCE "by step") and :926-930 (CAPS "by step").
- main.ts: `__genLine` gets its `order` param (:4690-4691); `__census` gets its header field (:4423).
- `genFor` (:4338-4340) is **unchanged**. It never passed `open`, so census and `__gen` levels at 1/4/7 are room layouts. That predates R, and changing it would break K-90.

**Done when:** K-90, K-91 and K-98 pass.

### R6. The run flow (`src/main.ts`)

- Delete `OPEN_DEPTHS` (:83-84). enterLevel :2583 passes `open: openAt(depth, routeNow())`. Import `openAt`, `otherRoad`, `stepOf`, `roadOf` in the areas import (:47-52).
- `bossDown` (:2341):
  - keep `if (arbiter) { lensOut; raiseHusk; drops shifted out of the footprint }` (:2346-2358) without the three day lines (:2350-2352);
  - after it, `const toDark = DAY_SPAN[run.depth]?.by === 'boss' && (RUN_DEPTHS === 9 || arbiter)`;
  - `if (toDark) { day.snap(1); dayApplied = 1; applyDayAt(world, run.depth, 1) }`.
  - Result: 6-depth behaves exactly as today (only the Arbiter at 6 snaps). 9-depth: the last boss of either road snaps at 9, and the Arbiter at 6 doesn't.
- `enterLevel` :2630: `day.enter(depth, run.bossFelled && (RUN_DEPTHS === 9 || boss?.kind === 'arbiter'))`.
- `dressYardBeam` (:2819-2832):
  - replace the two gate lines (:2821-2822) and `const route = routeForAlternate()` (:2823) with `if (!level || !level.exitOpen) return; const route = yardRoad(); if (!route) return`;
  - add `yardRoad()` (§2.4) beside it;
  - update the doc comment (:2815-2818): "the Assembler's cold beam under the alternate; and after boss 6 of a 9-depth run, always the other road".
- `savePlaytest` (:2716): add `runDepths`, `route` (§2.4).
- Verified, no change: the descend swap (:3683-3690: only depth 3 reaches the crossroads branch, so 6 → `enterLevel(7)`); `homing` (:3874-3881: 6 < 9 → the words, no walk); `commit` (:2979, :2990, :3015); `resumeRun` (:2435-2439); `crossroadsDue` (:2793-2797); `routeForAlternate` (:2895-2898).

**Done when:** K-90; K-99; K-97b; K-96b; K-95a.

### R7. The square's cold beam (`src/dungeon.ts`)

- In the exits block (:1756-1780):
  - hoist `c`, `away`, `a`, `side` (:1771-1774) above the cold beam;
  - `const coldAt = cold && square ? c.clone().addScaledVector(side, -WARM_OFFSET) : exitRoom.center.clone()`;
  - set `cold.group.position` from `coldAt`;
  - in the returned level, `exit: coldAt.clone()` (:1826).
- `square` is already in scope (:1183), and no `rand()` is involved.
- Result: the cold beam mirrors the warm one across the tower, 4.5 u from the centre, inside the posts' 7.5 ring.
- 6-depth: the square builds no cold beam, so `exit` stays the centre (K-90 holds).

**Done when:** K-90 and K-94 pass.

### R8. The whole run, headless

No new game code unless a check finds a bug. Fix the bug in the step it belongs to, and say which.
Register K-93, K-95b, K-96c, K-9C and K-9D, then run the full suite, `node tools/checks/k9.mjs`, and
the baseline compare.

**Done when:** every K-9x passes, the flag-off `dist/` size is recorded, and the lead has a table:
check → result → one line.

### R9. The stage-A checks, in the repo (`tools/checks/area3.mjs`)

Port K-R2, K-R3, K-X1, K-X2, K-X4, K-X5, K-X6 and K-X7 from SPEC §12.2, as written there, flag off
with `?line=1` (the 6-depth run). Use the same lib. Where SPEC's check reads `__takeRoad` / `__roads`,
use those hooks as they are. Their assertions are SPEC's text; don't re-derive them.

**Done when:** they pass on the finished tree, and a note lists any that can't pass as written (for
the lead, not "fixed").

---

## 4. Acceptance checks

Setup (§4.0): lib.mjs as R0; each id is one entry in `tools/checks/k9.mjs`. Short forms:
- `W` means order `'II'` (Works first); `L` means order `'III'` (Line first).
- "enter (d, s, o)" means `window.__run.route = o; __enter(d, s)`.
- "kill" means `__killBoss(); __step(0.2)`.
- `ON` means `?depth=1&save=memory&roads=1`; `OFF` means `?depth=1&save=memory`.

Every check also fails on any page error.

- **K-90 (flag off, unchanged).** `baseline.mjs compare` deep-equals `flagoff.json`.
- **K-91 (9-depth leaves 1-6 of Works-first alone).** `ON`:
  - `__gen(d, s, 'II')` deep-equals `flagoff.gen.II[d]`, and `hash(__genLook(d, s, 'II'))` equals `flagoff.genLookHash.II[d]`, for d 1..6, s per baseline;
  - `__gen(d, s, 'III')` equals the baseline for d 1, 2, 3, 5;
  - `__genLine(4, s, 'III').packs` has no `look === 'ballast'` for s 1..40 (R11).
- **K-92 (every depth has a plan and enters).** `ON`, and `ON&engine=1`.
  - **a (pure):** `__plan(d, o)` for d 1..9 × {W, L} matches this table:

    | d | W place | W boss (kind/adds/hp) | W area | L place | L boss | L area | step |
    |---|---|---|---|---|---|---|---|
    | 1-2 | ruin | null | I | ruin | null | I | d |
    | 3 | ruin | assembler/hulks/900 | I | ruin | assembler/hulks/900 | I | 3 |
    | 4 | works | null | II | sidings | null | III | 4 |
    | 5 | quarter | null | II | station | null | III | 5 |
    | 6 | quarter | arbiter/none/1080 | II | station | assembler/rams-mites/1080 | III | 6 |
    | 7 | sidings | null | III | works | null | II | 4 |
    | 8 | station | null | III | quarter | null | II | 5 |
    | 9 | station | assembler/rams-mites/1170 | III | quarter | arbiter/none/1170 | II | 6 |

    With `engine=1`, the two stand-in cells read `engine/none` (same hp). `road` is `o` for 1-6 and
    the other road for 7-9.
  - **b (entered):** for s 1..3, d 1..9, both orders, enter (d, s, o), and check:
    - it doesn't throw;
    - `__look().place` and `__boss()?.kind` match the table;
    - `__day().depth === d` and `__day().from === __DAY_SPAN[d].from`;
    - `__combat.curve` deep-equals `__curveAt(d)`.
  - **`OFF`:** `__plan(d, o)` for d 1..6 gives W works/quarter/quarter and L sidings/station/quarter (the roads meet), and `__bossFor(6, true, 'III', false).kind === 'arbiter'`.
- **K-93 (the run through its real transitions).** `ON`. `__run.dev = false` after boot, so beam saves write to the memory store. From `__enter(1, 1)`, loop over depths:
  - at a boss depth, kill;
  - `__descend() === true`;
  - `__until(() => __mode() === 'crawl' && (__run.depth === d + 1 || __route().atCrossroads), 8) >= 0`.
  - **W, fresh save (roads ['II']):**
    - `__route().atCrossroads` is never true;
    - at 4, `__run.route === 'II'`;
    - 6 → 7 directly, with `__look().place === 'sidings'`;
    - at 9, after the kill, `__descend() === false`.
  - **L:** `ON&line=1`, with `__setSave({ roads: ['II', 'III'] })` before `__enter(1, 1)`:
    - after 3, `atCrossroads === true`;
    - `__takeRoad('III') === 'III'`;
    - 4 is sidings;
    - 6 → 7 with no room, 7 is works and `__level().open === true`;
    - 9 is quarter with an Arbiter.
  - Both orders: at every depth ≥ 2, `__snapshot()` has `depth === __run.depth` and `route === o` (from 4 on).
- **K-94 (the square's cold beam).** `ON`, W, s 1..20. Enter (6, s, 'II'), then kill. Then:
  - `__exits().cold` is non-null and open, and `__level().footprint.dead === false`;
  - `hypot(cold − footprint) ≥ footprint.r + 1.4 + 0.42` (EXIT_RADIUS main.ts:1369, BODY_RADIUS :192);
  - `!__combat.terrain.blocked(cold.x, cold.z, 0.42)`;
  - `hypot(cold − warm) ≥ 3.3`;
  - BFS: a 0.25 u grid over the floor's bounding box (the `__level().floor` keys × 4), where a cell is passable when `!blocked(x, z, 0.42)`. It must reach a cell within 1.0 of cold from `__level().entrance`, and likewise of warm.
  - `OFF`: at 6 after the kill, `__exits().cold === null`.
- **K-95 (the beams by boss).** `ON`.
  - **a:**
    - `__exitsAfterBoss(3|6|9)` is `[cold,warm] | [cold,warm] | [warm]`;
    - after a kill at 6, both orders: cold and warm are open, and `__yardRoad().route` is the other road (L → `'II'`, W → `'III'`);
    - at 9 after a kill: cold is null, warm is open, and `__yardRoad() === null`;
    - at 3 (roads ['II'], crossroads choice): `__yardRoad() === null`;
    - `OFF`: at 6 after a kill, `__yardRoad() === null`.
  - **b (walked in):** W at 6 after the kill:
    - put Still 3 u from cold and `__step(0.1)` (this arms it);
    - set `__still.pos` to cold;
    - `__until(() => __mode() === 'descending', 2) >= 0`;
    - then `__until(crawl && depth 7, 8) >= 0`, with `atCrossroads` false at every step and `__look().place === 'sidings'`.
- **K-96 (the hours and the walk).**
  - **a (pure):**
    - `ON`:
      - `__hourAtEnd('home', 3|6|9)` is afternoon|dusk|night;
      - broken and stopped: d 1-2 morning, 3 noon, 4-6 afternoon, 7-9 dusk.
    - `OFF`: equals the baseline.
  - **b:** `ON`, W at 6 after a kill:
    - `__end('home')`, then `__run.ending.hour === 'dusk'`;
    - step to `__mode() === 'ending'` (≤ 8 s), with `__mode()` never `'toWalk'` or `'walkHome'`.
  - **c:** `ON`, L at 9 after a kill:
    - `__end('home')`, then `__run.ending.hour === 'night'`;
    - `__until(() => __mode() === 'walkHome', 10) >= 0`;
    - `__level().depth === 10`.
    - `OFF`: at 6, the same gives `__level().depth === 7`.
- **K-97 (the day over 9).**
  - **a (pure):** `ON`:
    - `__DAY_SPAN` has rows 1..9 matching §2.1;
    - for d in 1..8, d ≠ 3: `__DAY_SPAN[d].to === __DAY_SPAN[d+1].from`;
    - `__dayAt(4, 1)` deep-equals `__dayAt(5, 0)`, and `__dayAt(7, 1)` deep-equals `__dayAt(8, 0)` (numbers within 1e-9);
    - exactly one row is `by: 'boss'`, the 9th.
  - **b:** `ON`, both orders:
    - enter 6 and kill: `__day().progress === 0` and `from === 'late-afternoon'`;
    - enter 9, then `__combat.boss.hp = __combat.boss.maxHp / 2; __step(4)`: `__day().target` is within 0.02 of 0.5;
    - then kill: `__day().progress === 1` and `to === 'first-dark'`.
    - `OFF`: at 6 the same gives progress 1 after the kill (the baseline).
- **K-98 (R9, R11: the Line's lessons at its first depth in both orders).** `ON`, s 1..20 unless stated.
  - `__genLine(4, s, 'III')` and `__genLine(7, s, 'II')`:
    - `place === 'sidings'`;
    - at most one lane has `lesson`, and exactly one on ≥ 18 of 20 seeds (it needs a room lane);
    - no pack's room is that lane's room;
    - if a siding exists, `sidings[0].holds === 'handcar'`.
  - `__genLine(5, s, 'III')` and `__genLine(8, s, 'II')`: `place === 'station'` and no lane `lesson`.
  - The swarm lesson (a `lesson` pack whose `kinds` are 8× swarm):
    - present in `__gen(4, s, 'II')` and `__gen(4, s, 'III')` for ≥ 18 of 20 seeds;
    - absent in `__gen(7, s, 'II')` and `__gen(7, s, 'III')` for all seeds.
  - R11 over s 1..40:
    - `__genLine(4, s, 'III')` has no `look === 'ballast'`;
    - `__genLine(7, s, 'II')` has one on ≥ 1 seed.
  - The Works on a Line-first run:
    - `__genLook(8, s, 'III')` has a `lesson` pack with a lobber on ≥ 18 of 20 seeds;
    - `__genLook(7, s, 'III')` has a `look === 'heap'` on ≥ 1 seed;
    - `__genLook(8, s, 'II')` (the Line) has no lobber at all.
- **K-99 (open fields).** `ON`, both orders, d 1..9, s 1..3: enter, and `!!__level().open === __openAt(d, o)`. That's true at exactly {1, 4} for W and {1, 7} for L. `OFF`: {1, 4} on W, {1} on L (the baseline).
- **K-9A (the curve and boss HP).**
  - `ON`: `__curveAt(d)` deep-equals §2.2's rows for d 1..10 (10 is `WALK_CURVE`, heavies 0).
  - `OFF`: `__curveAt(d)` for d 1..6 equals today's rows, and `__curveAt(7)` equals row 5.
  - `ON`: `__bossFor(6, true, 'II').hp === 1080` and `__bossFor(9, true, 'III').hp === 1170`.
  - `OFF`: `__bossFor(6).hp === 1170`.
- **K-9B (flag plumbing).**
  - `ON`: `__runDepths === 9`, `__flags().roads === true`, and `__flags({ roads: false }).roads === true` (INV-F1).
  - `?depth=9&roads=1&save=memory` boots with `__run.depth === 9`.
  - `?depth=9&save=memory` boots with `__run.depth === 6` and `__runDepths === 6`.
  - `__stepOf(1..9)` is `[1,2,3,4,5,6,4,5,6]`; `__roadOf(d, 'II')` is II for 1-6 and III for 7-9, and the mirror for 'III'.
  - `OFF`: `__stepOf(7) === 6` (clamped) and `__roadOf(7, 'II') === 'II'`.
  - `grep -c BOTH_ROADS\ =\ false src/areas.ts` is 1, and `LINE_ENABLED` / `ENGINE_ON_LINE` are still `= false`.
- **K-9C (a resume at 7, a real save).** `?roads=1`, a fresh context (empty localStorage; the first boot goes into the maze, not a dev run).
  - Walk W to depth 7 as K-93 does, then `__snapshot()` has `depth 7` and `route 'II'`.
  - `page.reload()`. Boot resumes from `save.run` (main.ts:4962).
  - Then `__run.depth === 7`, `__look().place === 'sidings'`, `__route().route === 'II'`, and `__level().lanes.length > 0`.
- **K-9D (the build).**
  - `npx tsc --noEmit -p .` and `npx vite build` exit 0 with the flag at its shipped value (false).
  - The `dist/` total in bytes is recorded against 5,352,326 (BOTH-ROADS §2) and must stay ≤ the 5.6 MB cap as K-Z1 measures it. Report the delta.

---

## 5. What needs Adrian's phone

**Headless (all of §4).** Every table, transition, beam, hour, day span, curve row, lesson placement,
save and resume, and the flag-off equality.

**Phone only** (`?roads=1`, and later `?roads=1&line=1`, from one bookmarked URL; see §6):
1. **Run length, per order.** This is the reason stage R exists. At least 2 full runs each way. The
   `playtest.json` entries now carry `runDepths` and `route`, and `playS` summed per run is the
   number (target 20-25 min, modelled ~15-16).
2. How 7-9 feel under CURVE9's first pass: the floor's HP lost at 7-8, and where Broke lands (CURVE9 §5.2).
3. Trains at 7 after a whole Works area, and whether the Line's lessons still read at late afternoon
   into early dusk (LINE-RULES §5, open item 5).
4. The square at 6 in late-afternoon light. The Arbiter's lens goes out with no dark (accepted, decision
   3a). The cold beam's spot at −side reads as the way on, and its stripe doesn't cross the room. The Line
   dressing's rails run across the square.
5. Home at 6: a dusk homecoming out of a late-afternoon level. Does the hour jump read as "the walk home
   took a while", or as a lie? (Open question 2.)
6. Whether the stretched day reads as moving (the two new in-between hours), with no slow-down in the
   score at 7-8 (`crawlBpm`, stage T).
7. The stand-in Assembler as the Line's end: whether it's acceptable as a placeholder for his runs. Its
   bar says "The Assembler".
8. The walk home from the station or roundhouse into the quarter at night (BOTH-ROADS §1 E).

---

## 6. Risks

1. **A resume across a flag flip.** A 9-depth snapshot at 7-9, loaded without `?roads=1`, clamps to
   depth 6 (main.ts:2435), and it may land on the wrong road with the boss standing. A 6-depth snapshot
   at 6, loaded with `?roads=1`, turns the Arbiter into the middle boss (HP 1170 → 1080), with warm
   **and** cold. Nothing is lost, since found parts, history and cards are untouched. Mitigation: one
   bookmarked URL on the phone. No save field is added. This is DEV-only, and it's gone when the flag
   ships, because a live 6-depth snapshot at ≤ 6 is a valid 9-depth snapshot.
2. **`?roads=1` writes his real save.** No `?depth=` means not a dev run (main.ts:2659). The effects:
   cards read "saw depth 9", `history[1]` goes up to 9, and `notebook.d` goes up to 9. That's harmless
   in 6-depth, and intended, because his runs count. `save.roads` gains `'III'` only with `line=1`.
3. **`route` means the order (INV-O2).** Passing `roadOf(...)` into lookAt/bossFor/areaOf double-flips
   depths 7-9. K-92 catches it. BOTH-ROADS §3 says `routeNow()` "becomes `roadOf(depth)`"; this brief
   doesn't do that, deliberately (§7).
4. **`RUN_DEPTHS` is fixed at load.** `__flags({ roads })` does nothing (INV-F1), so checks must set
   it by URL. A getter was rejected. It would let a runtime flip change the run's length mid-run, under
   a live DayTracker and snapshot, and it would touch every use site for no gain, since DEV overrides
   only come from the URL at load.
5. **The curve differs by run length.** With the flag on, 4-6 are easier than live (CURVE9 §2). Any
   playtest numbers must be split by `runDepths` before being compared against CURVE.md.
6. **`genFor` / `__census` never build open fields** (a gap older than R). dropsim's d1/d4 levels are
   room layouts. Stage T owns this, and it must not be "fixed" in R, because K-90 would break.
7. **A new devDependency** (`playwright-core`). If the lead declines it, lib.mjs resolves it from
   `process.env.PLAYWRIGHT_CORE` (an absolute path) instead. The rest is unchanged.
8. **The stand-in is an Assembler in the station kit, with no rails** (boss levels build none,
   dungeon.ts:1158). It counts in `tally.assemblers`, not `engines` (main.ts:2385), so parts will read
   "saw the Assembler" for the Line's end until stage C.
9. **The dress-up at 6 goes on the square.** `dressRoad`'s rails run −z from the cold beam's foot
   (main.ts:2825-2827) and may cross a post or the furniture visually. They're not solid. This is a phone check.
10. **The gate.** BOTH-ROADS §4.5 reads both "the code as built" (the Line opens once an Assembler has
    fallen, main.ts:3015) and "the room appears once the Line has been seen". Under 9 depths these
    differ: after his first Assembler kill, the room can appear before he has ever reached 7. This
    brief keeps the code's gate (decision 5a, "the code as built"). The one-line alternative is under
    open question 1.

**Open questions (for the lead or Adrian, not blockers):**
1. The gate: "opened" (keep `run.depth >= 4 || felled at 3`) or "seen" (`run.depth >= 7 ||
   (run.route === 'III' && run.depth >= 4)` when `RUN_DEPTHS === 9`)?
2. Home at 6 is dusk while the level is late afternoon. Keep it (decision 2a as written), or make Home at 6
   `afternoon`?
3. The square's cold beam at `c − side × 4.5`, which leans toward the camera, or at `c + away × 4.5`,
   the far side of the tower?
4. Should a bossless Works at 7 on a Line-first run bring back the swarm lesson? R9 says no. That means
   a Line-first player meets mites on the Line at 4 and never gets the open-room swarm lesson at all.

---

## 7. Where the code differs from BOTH-ROADS, and what this brief does

| BOTH-ROADS says | the code / this brief |
|---|---|
| §3: "`routeNow()` becomes `roadOf(depth)`" | `lookAt` / `bossFor` / `areaOf` apply `roadOf` inside, so `routeNow()` stays the order. Converting it too would flip 7-9 twice. |
| §2 1.5.1: "Delete the 'roads meet in the square' branch" | It's kept, gated on `RUN_DEPTHS === 6`. Flag off must be unchanged, and SPEC K-R3 still asserts it. |
| §5 stage C: "`bossDown` generalised" | Part of it is needed in R. The stand-in at 9 must take the day to first dark, and the Arbiter at 6 must not. It's generalised only under `RUN_DEPTHS === 9` (R6). |
| §1 table: depth 6 is "dusk → first dark, by its HP" | Decision 3a replaces it: 6 is held at late afternoon, and 9 goes dusk → first dark. |
| §1 G / main.ts:2370: the gift at boss 6 | `PEDESTALS_ON = false` (main.ts:1627). Every boss drops blue + gold today. The `depth < RUN_DEPTHS` gift branch only matters if pedestals come back. |
| §2 row 4.2: "`SLEEPERS_CHANCE` by step" | Yes, and R11 zeroes it only at the run's depth 4 under `RUN_DEPTHS === 9`, so the flag-off Line at 4 keeps its Sleepers (K-90). |
| §3 "checks … not in the repo" | Also, `playwright-core` isn't in `package.json`, and `npx vite` binds 0.0.0.0 by config. R0 handles both. |
| CURVE9: "`curveAt(d)` should read `DEPTH_CURVE[d] ?? WALK`" | For the 9-depth table only. The 6-depth `curveAt(7)` keeps today's fallback to row 5 (INV-C2), so flag off is byte-identical. |
