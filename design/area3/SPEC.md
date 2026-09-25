# SPEC: Area III (the Line, the crossroads, the Engine)

Written 25 Sep 2026 from `design/area3/PITCHES.md` (decided, and flagged as
decided for Adrian) and the round files beside it, against the working tree of
the same day. It extends the area II spec (`design/content/SPEC.md`, "C §x")
and the Home spec (`design/meta/SPEC.md`, "H §x"). Their contracts are
extended here and never redefined. Build from §11. Each step ends playable,
and everything new ships **dark behind flags** (§1.7) until stage B passes.

What was checked against the code, not assumed:

- **Every area lookup is keyed by depth.** That means `PLACE_OF`, `lookAt`,
  `areaOf`, `bossFor`, `DEPTH_DAY`, `DAY_SPAN`, `bandOf`, `CAPS`, and the
  lessons in `generateLevel` (`depth === 2`, `=== 4`, `=== 4 && works`,
  `=== 5`). The route is added next to depth, never instead of it.
- **Beams.** `ExitKind = 'cold' | 'warm'` ("INV: never a third").
  `exitsAfterBoss` is the only fork. `Level` has one `exit` and one `home`.
- **The save.** `repair()` rebuilds a save field by field and drops what it
  doesn't know. It accepts `PartHistory` only at length 7, and `write()`
  unions `found`, `hints` and `notebook`. `RunSnapshot` is passed through as
  stored.
- **Hazards.** A `Hazard` is a circle or a pre-cut strip. It arms once and
  hits each body once. Enemies never read hazards, and hazards never hurt
  `kind: 'thief'`. The `strip` tell always draws chevrons.
- **Terrain.** Circles can be flipped dead or alive, but can't be added after
  `makeTerrain`. Boxes can't toggle. The BFS covers floor cells only. Off-floor
  is solid for movement *and* sight.
- **Locks.** `LockBook` keeps committed locks `BOOK_GAP = 0.3` s apart.
  `canLock(ms)` / `book(owner, ms)` are relative to now.
- **Strain step 1 isn't in the tree.** Nothing here reads its switch. Area III
  calls only `Enemy.interrupt()`, which Parry Clamp and Clamp Toss already use
  and step 1 will use too.
- **The download.** `dist/` is 4,997,790 bytes against K-H2's 5.6 MB cap.

---

## 0. Proposal

### Why

Every run plays the same second half. A 6-depth, 26-minute run can't grow
longer (the owner's call), so variety has to come from a second road through
the same afternoon. The push, which is rarely wanted today (see
`design/strain/PITCHES.md`), needs an opportunity whose clock isn't the
player's cooldowns. A level with its own timetable is such a clock.

### What changes

- **A crossroads after the Assembler.** The Assembler's yard stays *on or
  home*. *On* leads to a quiet room with two cold beams, one to **the Works**
  (area II as built) and one to **the Line**. It appears from the run after
  the first Assembler has fallen.
- **The Line, depths 4-5.** A goods yard of sidings at 4, then a goods station
  at 5. Straight rail lines cross rooms and corridors, running wall to wall
  into the fog. **Trains run them on a seeded timetable.** They light 2.0 s
  ahead, hit everything on the rails for 20 with a shove, and smash crates.
  Idle enemies step off lit rails; committed ones don't. Broods won't bite on
  one. The first train of the Line is harmless.
- **Three enemies:**
  - **The Signalman** calls a train early (a 900 ms wind-up to break).
  - **The Handcar** is a ram bound to a siding that always stuns at its
    buffer.
  - **Sleepers** are mites asleep under the ballast.
  - The **Porter** comes last (stage D).
- **The Engine**, the Line's boss at 6, in a roundhouse yard. It runs a loop
  of track. Points levers send it into buffer sidings, where it's open ×1.5.
  The boss bar is a departure board. Until stage C the Line ends at the
  Arbiter, in the square where the roads meet.
- **Save v3**: the roads open, the last road taken, and the Engine in each
  part's history.

### Capabilities

| new | modified |
|---|---|
| `line` (lanes, sidings, the timetable, trains, the rail tell, step-off) | `areas` (`RouteId`, `ROUTES`, flags, `lookAt`/`bossFor` take a route, `sidings`/`station`, `ENGINE_DEF`) |
| `crossroads` (the room, its two roads, resume there) | `dungeon` (lanes, crossings, sidings, gaps, Line pack rows, `generateCrossroads`, the roundhouse arena) |
| `signal` (sentinel variant) | `charger` (the Handcar variant), `swarm` (the `ballast` look), `thief` (the Porter, stage D) |
| `engine` (the boss, its track, levers, the board) | `combat` (player shove, step-off, hazard groups, the brood rule, train smash, `Terrain.addCircle`) |
| | `hazard` (`train` / `steam` / `wagon` sources, `group`, `shove`), `vfx` (`plain` strips), `lane` (`trackWash`) |
| | `hide` (timber, lead, enamel, slate, zinc), `hud` (board, beam labels), `audio` / `ambience` |
| | `save` v3, `notebook` (five pages re-roled), `pool` (NAMED), `main` (route, crossroads, resume) |

### Impact (files)

- **New:** `src/line.ts`, `src/signal.ts`, `src/engine.ts`,
  `src/crossroads.ts`.
- **Modified:** `src/areas.ts`, `src/dungeon.ts`, `src/terrain.ts`,
  `src/combat.ts`, `src/hazard.ts`, `src/enemy.ts`, `src/charger.ts`,
  `src/swarm.ts`, `src/thief.ts` (stage D), `src/boss.ts`, `src/hide.ts`,
  `src/vfx.ts`, `src/lane.ts`, `src/hud.ts`, `src/style.css`, `src/audio.ts`,
  `src/ambience.ts`, `src/save.ts`, `src/notebook.ts`, `src/pool.ts`,
  `src/main.ts`. (`src/day.ts` is unchanged: `DAY_SPAN` is keyed by depth, and
  both roads share the same hours.)
- **Assets:**
  - one ambientCG pair, `Gravel023_Color.jpg` and `Gravel023_NormalGL.jpg`,
    into `public/textures/` (and its `LICENSE.txt` line);
  - **no GLBs and no sound files.** Every Line piece is a primitive.
- **`public/sw.js`:** unchanged. The precache list is generated.

---

## 1. Design

### 1.1 Context

A run is `RUN_DEPTHS = 6`. The ruin is at 1-3 with the Assembler at 3, then
the Works (4), the quarter (5), and the Arbiter in the square (6), then the
night walk through the quarter. `generateLevel(depth, seed, { boss, place })`
builds any depth, with `place` defaulting to `lookAt(depth)`. The descend
swap calls `enterLevel(run.depth + 1)` and then `writeSnapshot()`.
`bossDown()` opens `exitsAfterBoss(depth)`, rolls one blue and one gold,
tallies `assemblers` or `arbiters`, and for the Arbiter snaps the day to
first dark and raises its husk.

### 1.2 Goals

1. A second road through the same afternoon: the same 6 depths, about
   26 minutes, both roads ending at the same house at night.
2. The Line creates push demand from the world: a clock that's never in
   phase with the buttons. The balancer estimates +0.3-0.5 asks a fight
   without step 1, and about 1.75 a fight with it.
3. Nothing stronger. No HP or damage by depth. Every hit ≤ 22, the Engine is
   900 HP, and no boss wind-up is under 620 ms.
4. Every tell is honest (drawn = hit) and meets the slack rule
   `lockedMs − 300 − 1000 × escape ÷ 5.5 ≥ 150`.
5. **Only a train lights rails; only a body draws chevrons.** The Line's two
   rail threats can't be mistaken for each other (§6.2).
6. It fits the phone: +≤ 0.4 MB, offline from the first install, no new real
   lights.

### 1.3 Non-goals

- The old town and its bell stroke, the Watcher, the Winder, tick mites and
  the Hour (parked whole for a fourth area). Also the Glasshouse, the
  Reservoir, the Sorting Office's belts, the Couplers, the Linesman, the
  Conductor, the Rake and the Winch.
- Trains that block shots, rolling wagons that are solid while they move,
  hops that clear hazards, and a Frost Trail that trips the Engine.
- A walk home along the tracks. Both roads walk home through the quarter.
- A route-specific score. The Line uses area II's music.
- Anything for Yanah or Yuri. No lists contain bed, cot, crib, cradle, toy,
  swing or pram.

### 1.4 The invariants, and how this spec keeps them

| invariant | here |
|---|---|
| Three terminal states | Unchanged. Trains, the Engine, steam and wagons hurt through `hurtPlayer`. Nothing in area III adds strain except pushes the player chooses (`addStrain`). |
| The kept thing is always produced | `commit()` is unchanged in order. The v2 → v3 migration is lossless (§2.9), and the card gains `route`. |
| The commitment resource carries | Strain carries across the crossroads untouched. The crossroads has no quiet, because nothing dies there. |
| Never trapped | No lane crosses an entrance or exit room, and every lane leaves a room free of it (lanes run at a ±1-cell offset, never on the corridor row). Corridor crossings clear in 0.8 s every ≥ 16 s. Both crossroads beams are open from the first tick. A lever never gates an exit. Nothing disables a button. |
| The reward fork is binary | `ExitKind` and `exitsAfterBoss` are untouched. The crossroads is not an exit fork: both beams go *on*, and it has no warm beam and no lean. **INV:** `Level.roads` is non-null only on the crossroads, and length 2, one per route. |
| No empty save | Unchanged. A train-smashed crate drops nothing, but floor loot was never the kept thing. The found set, the hook and the history are untouched. |

### 1.5 Decisions (top 8)

1. **Route is an axis next to depth.** `RouteId = 'II' | 'III'`, and
   `ROUTES[route][depth]` picks the place for 4-6. Depths 1-3 ignore it.
   *Why:* every lookup stays depth-keyed, and route II reproduces today
   exactly (the checks hold area II's `__gen` baselines).
2. **The fork happens one beat later, in its own room.** *Why:* it keeps "on
   or home" the run's only binary decision and `exitsAfterBoss` untouched.
   The fallback (`ROAD_CHOICE = 'alternate'`) is one constant on the same
   data.
3. **A train is a row of 4-u strip hazards sharing one hit set** (`group`).
   Each segment arms as the rake reaches it. *Why:* drawn = hit holds segment
   by segment, the existing `Hazard` does the testing, and a shoved body is
   hit once per train.
4. **The timetable comes from the level seed, on its own stream**
   (`SALT.rail`). *Why:* the same level runs the same trains each visit
   (learnable, and exact on resume), and pack code can't shift it.
5. **Trains book the lock gap like enemies**, at their commit and at their
   arrival, slipping up to 600 ms. *Why:* two committed tells never land
   together (the crowd rule).
6. **Step-off is one pass in `Combat`**, after the enemy loop. *Why:* every
   archetype gets it without touching its AI, and "committed" has one
   definition (§5.8).
7. **Sidings and live lines never share a room**, siding rails never glow,
   and the Handcar's lane never draws rail lines. *Why:* the Handcar can't be
   confused with a train, which is the risk the translator cut it over.
8. **The Engine's opening is a place, not the body.** A points lever reads
   *any ability cast* within 3 u while it's lit. The boss itself can't be
   broken (`interrupt()` is false). *Why:* it keeps "bosses can't be broken",
   works for every loadout including head-only, and needs no targeting change.

### 1.6 Risks and trade-offs

1. **Trains could do the fight.** Mitigated by the step-off and brood rules.
   The first dial, if packs still die to trains for free, is the live radius
   (`LINE.liveR`). The second is the period.
2. **A rake emerging from a wall gap reads as a hole in the wall.** The gap is
   visual only: off-floor stays solid. If it confuses on the phone, add a
   buffer-less rail stub into the fog (look only).
3. **Stopped doubles on the Line** (the balancer: ~17% against ~7% for a
   spender who reaches 6). That's intended: the Line is the strain road. The
   first dial is the period (16-22 s).
4. **Crossing the arena for alternating levers is tight** (~32 u against a
   5.9 s lap). If it frustrates, set `ENGINE.leverEvery` to 2 laps before
   touching speeds.
5. **Five new hides near existing ones** (timber near the thief's rust, slate
   near coal). All are judged in the graded game; each has one fallback value.
6. **Save v3 ships in stage A while the Line is dark.** It's harmless: the
   new fields are empty. A rollback to a v2 build plays in memory mode and
   never overwrites (existing rule).

### 1.7 The flags (`src/areas.ts`)

| flag | default at merge | set true when | what false means |
|---|---|---|---|
| `LINE_ENABLED` | `false` | stage B's "Done when" passes on the phone | No crossroads. The route is always `'II'`. `save.roads` never gains `'III'`. `?route=` and `?crossroads=` still work in DEV builds only. |
| `ENGINE_ON_LINE` | `false` | stage C passes | Route III's depth 6 is the quarter's square with the Arbiter. |
| `PORTER_ENABLED` | `false` | stage D | No Porter is generated. |
| `ROAD_CHOICE` | `'crossroads'` | (fallback only) | `'alternate'`: no room; the road alternates by `save.lastRoad` (§3.6). |

Code reads the three flags through `flag('line' | 'engine' | 'porter')`,
which returns the DEV override (URL param or `__flags`) when one is set, and
the constant otherwise.

DEV-only URL params, ignored in production builds (`import.meta.env.DEV`):

- `?route=II|III` sets `run.route` at start and skips the crossroads;
- `?crossroads=1` forces the crossroads after the Assembler;
- `?line=1`, `?engine=1` and `?porter=1` override the three flags;
- `?depth=N` as today; with `?route=III`, depth 4-6 starts on the Line.

### 1.8 Migration plan

- **Save v2 → v3** (§2.9): every history tuple gains an 8th number (Engines
  felled while worn, 0). `roads` becomes `['II']`, `lastRoad` null, and a
  snapshot's tally gains `engines: {}`. Lossless, and run on load.
- **Baselines:** `__gen(d, s)` for d 1-6 on route II must equal the area II
  baselines (K-R1). Route III gets new baselines at the end of steps A3 and
  C1.
- **Assets:** one texture pair added; nothing deleted.

### 1.9 Open questions (Adrian's)

1. The crossroads or the alternate (`ROAD_CHOICE`). Both are built; the
   crossroads ships.
2. The names: the Line, the Engine, the Signalman, the Handcar, Sleepers, the
   board's "left points / right points", the beam labels, the card caption.
   All marked `PLACEHOLDER`.
3. The Handcar, once its tell has been seen on the phone.
4. The notebook lines for the five re-roled pages (§2.10), and whether
   re-roling old pages is acceptable at all.

---

## 2. Data contracts

TypeScript as it goes into the files named. **INV** comments are invariants
that code and checks enforce.

### 2.1 Routes, places, bosses: `src/areas.ts`

```ts
export const LINE_ENABLED = false
export const ENGINE_ON_LINE = false
export const PORTER_ENABLED = false
export const ROAD_CHOICE: 'crossroads' | 'alternate' = 'crossroads'

/** INV: exactly these two. 'II' is area II as built; 'III' is the Line. */
export type RouteId = 'II' | 'III'

export type PlaceId = 'ruin' | 'works' | 'quarter' | 'sidings' | 'station'
export type AreaId = 'I' | 'II' | 'III'
export type AmbienceMood = /* existing */ | 'line' | 'roundhouse'

/** INV: depths 1-3 are 'ruin' on every route. INV: ROUTES.II equals PLACE_OF for 4-6. */
export const ROUTES: Record<RouteId, Record<4 | 5 | 6, PlaceId>> = {
  II:  { 4: 'works', 5: 'quarter', 6: 'quarter' },
  III: { 4: 'sidings', 5: 'station', 6: 'station' },   // 6 reads ENGINE_ON_LINE, below
}

/** INV: the only way anything picks a look. route defaults to 'II' (every existing call site). */
export function lookAt(depth: number, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): PlaceDef {
  const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
  if (d <= 3) return PLACES.ruin
  if (route === 'III' && d === 6 && !engineOnLine) return PLACES.quarter   // the roads meet in the square
  return PLACES[ROUTES[route][d as 4 | 5 | 6]]
}

export type BossKind = 'assembler' | 'arbiter' | 'engine'
export interface BossDef { /* as C §2.1 */ arena: 'yard' | 'square' | 'roundhouse' }

export const ENGINE_DEF: BossDef = {
  // PLACEHOLDER name (Adrian's)
  kind: 'engine', name: 'The Engine', hp: 900, adds: 'none', roster: 'raging-hull', arena: 'roundhouse', openWord: 'derailed',
}

/** The second parameter keeps its meaning (C checks call bossFor(6, false)); the route is third. */
export function bossFor(depth: number, arbiterAt6 = ARBITER_AT_6, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): BossDef | null {
  if (depth % BOSS_EVERY !== 0) return null
  if (depth === RUN_DEPTHS && route === 'III' && engineOnLine) return ENGINE_DEF
  if (depth === RUN_DEPTHS && arbiterAt6) return ARBITER_DEF
  return { ...ASSEMBLER_DEF, adds: depth === RUN_DEPTHS ? 'rams-mites' : 'hulks' }
}

/** Area III for bosses, the hour and the banner (its hours are area II's: DAY_SPAN is by depth). */
const areaIII: AreaDef = { ...PLACES.station, id: 'III', depths: [4, 5, 6] }
export const areaOf = (depth: number, route: RouteId = 'II'): AreaDef => /* III when route 'III' and depth ≥ 4, else as today */
```

**GenPreset additions** (absent everywhere except the Line; absent reproduces
today exactly):

```ts
export interface GenPreset {
  /* ...C §2.1 */
  /** Chance a main-spine room is a 5x3 hall. Absent: 0.25 (today's literal). One rand() either way. */
  hallShare?: number
  /** The Line's rails and pack rules. Presence switches them on (§4, §6.5). */
  line?: LinePreset
}
export interface LinePreset {
  /** Live lines laid across main rooms, and across corridor cells. */
  lanes: number
  crossings: number
  /** Dead sidings inside lane-free main rooms. */
  sidings: number
  /** Station halls: a hall's lane runs along its long axis, on an outer row. */
  alongHalls: boolean
}
```

The two places (full tables in §4.1):

```ts
const sidings: PlaceDef = { id: 'sidings', /* kit, surfaces §4.1 */ ambience: { crawl: 'line', boss: 'line' }, footsteps: 'stone', music: 'II',
  gen: { cover: [0.25, 0.25], coverGap: 3.2, coverTries: 40, coverMaxH: 1.4, slag: {}, hallShare: 0.25,
         machines: { kinds: ['gantry'], share: 0.3 }, line: { lanes: 2, crossings: 1, sidings: 2, alongHalls: false } } }
const station: PlaceDef = { id: 'station', /* §4.1 */ ambience: { crawl: 'line', boss: 'roundhouse' }, footsteps: 'stone', music: 'II',
  gen: { cover: [0.2, 0.3], coverGap: 3.0, coverTries: 50, coverMaxH: 1.4, slag: {}, hallShare: 0.6,
         farSide: { pieces: ['wall_doorway', 'wall_window_open'], chance: [0.1, 0.3] }, line: { lanes: 3, crossings: 0, sidings: 1, alongHalls: true } } }
```

`MachineKind` gains `'gantry'` (§4.1). `slag: {}`: the Line has no slag cores
(area II's mechanic).

### 2.2 The Line runtime: `src/line.ts` (new)

```ts
export const LINE = {
  /** Where Still's centre is hit, either side of the lane's centre line. INV: the rail tell's wash is exactly this. */
  halfW: 1.2,
  gauge: 1.0,                      // rails at ±0.5 from the centre line
  railOut: 14,                     // rails run this far past each wall gap into the fog
  segment: 4,                      // one floor cell
  speed: 14,                       // u/s
  rakeLen: 7.0,                    // engine 2.6 + 0.3 + wagon 1.9 + 0.3 + wagon 1.9
  /** From the tell's start: 'coming' (dim) for 800, 'committed' (bright) for 1200, then the front reaches the floor. */
  comingMs: 800, committedMs: 1200,
  damage: 20,                      // INV ≤ 22
  shove: { along: 2.0, across: 1.8 },
  period: [16, 22] as const,       // s per lane, from the rail stream
  /** A lane runs trains only while Still is this close to its floor midpoint, or its room's pack is awake. */
  liveR: 22,
  slipStepMs: 50, slipMaxMs: 600,  // booking
  buzzR: 0.8,                      // Still's centre within halfW + this at the commit: one 40 ms buzz
  stepOff: { speed: 4.5, pad: 0.3 },
  broodPad: 1.0,                   // a surge whose ring centre is within halfW + this of a lit lane waits
  signalQuietS: 4,                 // a Signalman won't call a lane whose next train is sooner than this
}

export interface LaneDef {
  id: number
  kind: 'room' | 'crossing'
  /** The floor span: a is where a +dir train enters the floor, b where it leaves. Axis-aligned. */
  ax: number; az: number; bx: number; bz: number
  /** The rails' full extent, railOut past each gap. */
  outA: { x: number; z: number }; outB: { x: number; z: number }
  room: Room | null                // the crossed room (null for a crossing)
  corridor: string | null          // key(i, j) of the crossed corridor cell
  period: number                   // s
  phase: number                    // s, first scheduled tell start
  /** Depth 4's first lane (lowest progress): packless, and its first train is the harmless lesson. */
  lesson: boolean
}

export interface SidingDef {
  id: number
  room: Room
  /** Rail ends (buffer faces). Axis-aligned, 12 u apart, inside the room. */
  ax: number; az: number; bx: number; bz: number
  /** The two buffers: solid circles r 0.6 just past each end. */
  buffers: [Circle, Circle]
  holds: 'handcar' | 'wagon' | 'sleepers' | 'empty'
}

export type TrainStage = 'coming' | 'committed' | 'passing' | 'gone'
export interface Train {
  lane: LaneDef
  dir: 1 | -1                      // +1 enters at a, -1 enters at b
  t0: number                       // game time of the tell's start (after any slip)
  stage: TrainStage
  lesson: boolean
  hazards: Hazard[]                // one per floor segment, sharing one group
}

/** What Combat gives the Line. */
export interface LineHost {
  readonly time: number
  readonly book: LockBook
  addHazard(spec: HazardSpec): Hazard
  /** A room's pack is awake. */
  roomAwake(room: Room): boolean
  /** Train strips break crates, dropping nothing. */
  smashIn(shape: HazardShape, grow: number): void
}

export class Line {
  constructor(level: Level, seed: number, host: LineHost)
  readonly lanes: readonly LaneDef[]
  readonly sidings: readonly SidingDef[]
  readonly group: THREE.Group      // rails, sleepers, buffers, signal lamps, the rakes; added to the scene with the level
  /** Game time, from Combat.update, after the enemy loop. Starts tells, books, spawns hazards, moves rakes. */
  tick(dt: number, still: THREE.Vector3): void
  /** Lanes lit now (from t0 until the rake's tail leaves the floor span). */
  lit(): readonly LaneDef[]
  /** The Signalman's call: a tell now (with slip), and the lane's schedule restarts from it. False if refused. */
  call(lane: LaneDef): boolean
  /** Next scheduled tell start for a lane, game time. */
  nextAt(lane: LaneDef): number
  trains(): readonly Train[]
  dispose(): void
}
```

### 2.3 Hazards: `src/hazard.ts`

```ts
export type HazardSource = 'slag' | 'shell' | 'lance' | 'scald' | 'train' | 'steam' | 'wagon'
export interface HazardSpec {
  /* ...C §2.4 */
  /** Hazards sharing a group share one hit set: a body is hit once per group (one train, one Engine lap segment run). */
  group?: object
  /** On a hit: a slide `along` the direction (dx, dz) plus `across` away from the strip's centre line, for Still and enemies. */
  shove?: { dx: number; dz: number; along: number; across: number }
}
```

**INV:** `damage ≤ 22`. A `train` hazard is `quiet: true` (the rail tell draws
it), with `cover: 'none'` and `hurt: 'hazard'`, and it's never `warded`.

### 2.4 Combat additions: `src/combat.ts`

```ts
line: Line | null = null
/** Still's own slide (train shoves only), decays by KNOCK_DECAY, applied with terrain.clampMove at PLAYER_RADIUS. */
private readonly playerKnock = new THREE.Vector3()
private readonly groupHits = new WeakMap<object, Set<Enemy | 'still'>>()
/** §5.8: every body not committed steps off a lit lane. */
private stepOff(dt: number): void
/** §5.8. */
static committed(e: Enemy, held: boolean): boolean
```

Order in `update`: enemies loop, then `line?.tick`, then `stepOff`, then
`tickParts`, then `tickHazards`, as today. `hazardTest` skips a body already
in its group's set and adds it after a hit. `shove` is applied there: Still
through `playerKnock`, an enemy as `e.knock += shoveVelocity(...) ×
e.knockMul`.

`Terrain` (`src/terrain.ts`, and `makeTerrain`) gains:

```ts
/** Add a solid circle after the level is built (the Engine's stops and husk, a settled wagon). Bucketed like the rest; the BFS ignores it, as it ignores every prop. */
addCircle(c: Circle): void
```

### 2.5 Enemy contract: `src/enemy.ts`

```ts
readonly variant?: 'lobber' | 'signal' | 'handcar' | 'porter'
```

Loot, budget and treasure follow `kind`, as for the Lobber. **INV:** a
`signal` or `handcar` is never a pack's leader, so it's never an elite (§6.5).

### 2.6 The Engine: `src/engine.ts` (new)

```ts
export const ENGINE = {
  hp: 900, radius: 1.2, length: 2.6, width: 1.5, height: 1.5, chimneyTop: 1.9, labelY: 2.4,
  speed: 11, backSpeed: 4,          // u/s on the loop / backing out of a siding
  lead: 1.3,                        // s of track lit ahead. INV ≥ 0.62
  runDamage: 20, halfW: 1.2, segment: 2,
  unfoldMs: 1500,
  lever: { windowMs: 1400, reach: 3.0, every: 1 },   // every: laps between windows (alternating sides)
  derailMs: 1600, openMul: 1.5,
  steam: { windupMs: 950, len: 7, halfW: 1.3, damage: 14, gapS: [6, 9] as const, range: 8 },
  phase2At: 0.55,
  reverse: { judderMs: 650, everyS: [8, 12] as const },
  wagon: { tellMs: 1200, speed: 7, damage: 12, everyS: 14, firstS: 4 },
  seeThrough: { opacity: 0.35, reach: 3.0, half: 1.6 },
}
export type EngineState = 'asleep' | 'unfold' | 'run' | 'judder' | 'siding' | 'derailed' | 'backing' | 'dead'
export class Engine implements Boss {
  readonly kind = 'boss'; readonly anchored = null; knockMul = 0
  state: EngineState
  /** Path distance along the current polyline, and travel direction on the loop (+1 counter-clockwise in xz). */
  s: number; dir: 1 | -1; lap: number
  window: { side: 'left' | 'right'; open: boolean; openAt: number; closeAt: number } | null
  wagon: { x: number; z: number; settled: boolean } | null
  /** Always false: bosses can't be broken. */
  interrupt(): false
  /** From main.cast(): a successful ability cast at `at`. Throws a lit lever within reach. */
  onCast(at: THREE.Vector3): boolean
  /** Departure board text for the HUD, or ''. */
  board(): string
}
export function makeTrack(cx: number, cz: number): TrackDef   // §7.2
```

`makeBoss(def, x, z, face, posts, track?)` gains the `'engine'` case.
`Level.track?: TrackDef` carries the loop, the four turnout arms, the spurs
and the two levers.

### 2.7 Level and generation: `src/dungeon.ts`

```ts
export interface Level {
  /* ...C §2.7 */
  lanes?: LaneDef[]
  sidings?: SidingDef[]
  track?: TrackDef
  /** INV: non-null only on the crossroads, length 2, routes ['II', 'III'] in that order. */
  roads?: { route: RouteId; at: THREE.Vector3; label: string }[]
  /** The crossroads: no lean, no banner, no packs. */
  crossroads?: true
}
export interface PackSpec {
  /* ...C §2.7 */
  members: { kind: Archetype; variant?: 'lobber' | 'signal' | 'handcar' | 'porter'; x: number; z: number; face?: { x: number; z: number }; slag?: true; siding?: number }[]
  look?: 'heap' | 'ballast'
}
type Member = 'C' | 'H' | 'S' | 'L' | 'M8' | 'M6' | 'G' | 'K'   // G Signalman, K Handcar
// BE: G 1, K 1.5 (as S, C). kindOf: G → 'ranged', K → 'charger'. SHOOTERS_MAX counts G.
const SALT = { /* existing */ rail: 0x2a11 }
export function generateCrossroads(seed: number): Level      // §3.2
```

`buildWalls(..., gaps?: Set<string>)`: an edge in `gaps` (key `"i,j,dx,dz"`,
the floor cell and the open side) gets no barrier and no box. Its end
vertices count one edge fewer, so a column stands at each side of the gap.
`buildBeyond`'s existing `avoid` rejects anything within 2.5 u of a lane's
outward extension.

### 2.8 Hides: `src/hide.ts`

The rule: not pale, not cold, not saturated red or orange. Ember is only ever
a core, a seam or a tell. Every hide is judged in the graded game. The
fallback is the one value to change first.

```ts
/** The Signalman: creosoted timber, tar-black brown, grain running up the post; iron straps. The first body that isn't metal. */
signal: { body: 0x2f2620, joint: 0x1c1b1a, rough: 0.9, metal: 0.05, jointRough: 0.6, jointMetal: 0.55,
  finish: { scale: [2, 14, 2], grain: 0.22, roughVar: 0.12, tone: [0.72, 0.66, 0.6], mask: 0.6, toneRough: 0.05, toneMetal: 0, bump: 0.45 },
  jointFinish: GRAIN_ONLY },            // fallback: body 0x26221e (further from the thief's 0x4e3a31)
/** The Handcar: lead, matte, soft, a warm grey with a brown cast: lighter than the hulk's soot, duller than the sentinel. */
handcar: { body: 0x44403d, joint: 0x232120, rough: 0.7, metal: 0.55, jointRough: 0.6, jointMetal: 0.5,
  finish: { scale: [3, 3, 3], grain: 0.1, roughVar: 0.15, tone: [0.85, 0.83, 0.8], mask: 0.62, toneRough: 0.1, toneMetal: -0.1, bump: 0.15 },
  jointFinish: GRAIN_ONLY },            // fallback: body 0x3d3936
/** The Engine, and the trains' engines: gloss lamp-black enamel, chipped to iron at the edges. Told apart by its shine. */
enamel: { body: 0x141416, joint: 0x2a2826, rough: 0.22, metal: 0.1, jointRough: 0.6, jointMetal: 0.6,
  finish: { scale: [2.2, 2.2, 2.2], grain: 0.06, roughVar: 0.1, tone: [3.2, 3.2, 3.3], mask: 0.8, toneRough: 0.35, toneMetal: 0.7, bump: 0.1 },
  jointFinish: GRAIN_ONLY },            // fallback: mask 0.86 (fewer chips)
/** Sleepers: slate, dull and layered, a warm near-black (never blue-grey). */
sleepers: { body: 0x2f2e2b, joint: 0x1b1a19, rough: 0.95, metal: 0.1, jointRough: 0.65, jointMetal: 0.45,
  finish: { scale: [10, 3, 10], grain: 0.18, roughVar: 0.1, tone: [1.2, 1.18, 1.12], mask: 0.6, toneRough: -0.1, toneMetal: 0.05, bump: 0.35 },
  jointFinish: GRAIN_ONLY },            // fallback: body 0x34302b
/** The Porter (stage D): oxidised zinc, dull, crusted: darker than the sentinel, never pale. */
porter: { body: 0x55544f, joint: 0x2a2a28, rough: 0.75, metal: 0.45, jointRough: 0.6, jointMetal: 0.5,
  finish: { scale: [4, 4, 4], grain: 0.12, roughVar: 0.18, tone: [1.25, 1.25, 1.2], mask: 0.7, toneRough: 0.2, toneMetal: -0.3, bump: 0.2 },
  jointFinish: GRAIN_ONLY },            // fallback: body 0x4c4b47
```

The Sleepers' mites use a second material set in `MiteBatch`, created only
when a `ballast` brood exists. That's +8 draw calls in those levels.

### 2.9 Save v3: `src/save.ts` (extends C §2.9)

```ts
export const SAVE_VERSION = 3
/** [runs, deepest, assemblers, broken, stopped, home, arbiters, engines] */
export type PartHistory = [number, number, number, number, number, number, number, number]
export interface Save {
  v: 3
  /* ...v2 */
  /** INV: contains 'II'; only grows (unioned in write). 'III' joins at the commit of a run that felled an Assembler, while LINE_ENABLED. */
  roads: RouteId[]
  /** The road last taken at depth 4 (non-dev). The alternate fallback reads it. */
  lastRoad: RouteId | null
}
export interface RunTally { /* ...v2 */ engines: Record<PartId, number> }
export interface RunSnapshot {
  /* ...v2, s: 1 unchanged */
  /** undefined: a v2 snapshot, so route 'II'. null: not chosen yet (only with `crossroads`). */
  route?: RouteId | null
  /** Resume in the crossroads room (depth 3, its boss down). */
  crossroads?: true
}
export interface RunCard { /* ... */ route?: RouteId }   // absent: 'II'

MIGRATIONS[2] = (s) => ({
  ...s, v: 3,
  history: Object.fromEntries(Object.entries(s.history ?? {}).map(([k, h]) => [k, Array.isArray(h) ? [...h, 0] : h])),
  roads: ['II'], lastRoad: null,
  run: s.run && typeof s.run === 'object' ? { ...s.run, tally: { ...(s.run.tally ?? {}), engines: {} } } : s.run ?? null,
})
```

- **`repair()`:**
  - `h.length === 8`;
  - `roads = ['II', ...('III' in raw.roads ? ['III'] : [])]`;
  - `lastRoad` must be `'II' | 'III'`, else null;
  - `run.tally.engines ??= {}`.
- **`write()`:** also unions `roads` from the stored copy.
- **`freshSave()`:** `roads: ['II'], lastRoad: null`.
- **`freshTally()`:** `engines: {}`.
- **`main.ts` `resumeRun`:** filters `'engines'` with the other tally maps.
- **`main.ts` `commit`:** the default tuple has 8 zeros, and
  `h[7] += tally.engines[id] ?? 0`.
- **`pool.ts` `NAMED`:** gains `{ test: (h) => (h[7] ?? 0) >= 1, suffix:
  ', that saw the Engine' }`, directly after the Arbiter's rule.

### 2.10 Notebook: `src/notebook.ts`

`RosterRole` gains `'signal' | 'handcar' | 'sleepers' | 'porter'`, and
`RosterEntry.boss` gains `'engine'`. Five blank old-roster pages are re-roled.
`namesFor` then skips them by role, and every archetype keeps at least two
names in its band. A page already met under its old role keeps its counts;
that's flagged in §1.9.

| id | was | becomes | constant |
|---|---|---|---|
| `signal-jammer` | sentinel, I | `signal`, any | `SIGNAL_PAGE` |
| `iron-crawler` | ram, I | `handcar`, any | `HANDCAR_PAGE` |
| `conduit-spider` | mites, II | `sleepers`, any | `SLEEPERS_PAGE` |
| `raging-hull` | ram, II | `boss`, any, `boss: 'engine'` | `ENGINE_DEF.roster` |
| `drifting-frame` | hulk, I | `porter`, any (stage D) | `PORTER_PAGE` |

`main.ts` `pageOf` maps them: `variant 'signal'` → `SIGNAL_PAGE`, `'handcar'` →
`HANDCAR_PAGE`, `'porter'` → `PORTER_PAGE`, and a swarm whose brood is
`ballast` → `SLEEPERS_PAGE`.

### 2.11 HUD: `src/hud.ts`, `src/style.css`

- `bossBar(b)`: `b` gains `board?: string`. When it's non-empty, it's shown in
  a `<small>` under the name, in the bar's own type at 0.8×. It's never
  shown while `open` (the name reads "The Engine — derailed").
- `beamLabel(id, text, at | null, alpha)`: the elite-name label element and
  style (`drawEliteLabels`'s), placed at `(x, 2.6, z)`. It's used by the
  crossroads (§3.3) and by the alternate's dressed cold beam.

### 2.12 Tells: `src/vfx.ts`, `src/lane.ts`

- `tellMaterial(style, radius, hot, deep, opts)`: `opts.plain?: boolean`
  sets a `uPlain` uniform. When it's 1, the strip's chevron `pattern` is 0
  (noise and edge only). **INV: every rail tell is plain. No plain strip
  anywhere else.**
- `LaneTell` constructor option `trackWash?: boolean`. While tracking, it
  draws the core at 0.25 opacity (chevrons flowing toward the end) instead of
  the two rail strips. **INV: the Handcar's lane draws no rail strips at any
  stage.**

---

## 3. The road choice: the crossroads

### 3.1 When it appears

At the descend swap (`run.phase === 'descending'`, when `run.swapped` turns
true), with `run.depth === 3`:

```ts
const due = !run.route && ROAD_CHOICE === 'crossroads' && flag('line') && (save.roads.includes('III') || devParam('crossroads'))
due ? enterCrossroads() : (run.route ??= routeForAlternate(), enterLevel(4))
writeSnapshot()
```

- `routeForAlternate()` returns `'II'` unless `ROAD_CHOICE === 'alternate' &&
  flag('line') && save.roads.includes('III')`. In that case it's the road that
  isn't `save.lastRoad` (`'III'` when `lastRoad` is null).
- A run started with `?route=` already has `run.route` and never sees the
  room.
- **Opening the road.** In `commit()`, before `store.write()`:
  `if (LINE_ENABLED && !run.dev && (run.depth >= 4 || (run.depth === 3 &&
  run.bossFelled)) && !save.roads.includes('III')) save.roads.push('III')`.
  So the room first appears in the run *after* the one that felled an
  Assembler.

### 3.2 The room (`src/crossroads.ts`, `generateCrossroads(seed)`)

- **Floor:** cells i, j ∈ −1..1 (12 u square, centred at the origin), on the
  ruin's kit: `PLACES.ruin`'s floor table, walls, columns and beyond.
  `buildBeyond` runs with the same code path.
- **Props:** two ruin crates, solid and never breakable, at (3.2, −3.2) and
  (−3.2, 3.2), each r 0.7.
- **Still arrives** at (2.47, 2.47) facing screen-up (the entrance is the
  near corner).
- **Two cold beams**, `makeBeam(COLD_BEAM, BEAM_H)`, open from the first tick:

  | route | at | name | screen |
  |---|---|---|---|
  | II | (−4.60, −0.35) | `beam:road:II` | far left |
  | III | (−0.35, −4.60) | `beam:road:III` | far right |

  Screen right is world (1, 0, −1)/√2 and screen up is (−1, 0, −1)/√2 (the
  camera sits at +x +z). The beams are 6.0 u apart and 7.6 u from the
  arrival.
- **The Level fields:**
  - `crossroads: true`, `roads` as above, `exitOpen = false`, `home = null`;
  - `exit` = the midpoint (−2.47, −2.47), unused, because the lean is off;
  - `packs`, `breakables` and `shrines` empty;
  - `depth = 3`.
- **Light and sound:**
  - `applyDay(world, 'afternoon')`, with no span;
  - ambience `'crawl'`, stone footsteps;
  - the boss music stops at the descend, as it does today, and the crawl
    loop plays at 97 BPM.
- **HUD:** in run mode. Casting is allowed and harmless. Nothing adds strain.
  There's no quiet (nothing can die), and no depth banner.

### 3.3 Dressing and labels

- **The Works' beam:** a `wall_gated` piece 1.4 u behind it along screen-up,
  rotated to face the camera, as a frame. A `vfx.smokePuff(top, 1, 0x2c2826)`
  every 0.6 s rises from its top (soot).
- **The Line's beam:** two rusted rails (the siding look, §4.3) running from
  the floor's far-right edge into the beam's foot. A timber signal post
  beside it (1.1 u to screen-right), in the `signal` hide, **with its lamp
  dark**: `0x1a1614`, no emissive. **INV: nothing in the crossroads is
  ember.**
- **Labels:** `hud.beamLabel` shows "the Works" / "the Line" (PLACEHOLDER)
  over each beam. The alpha is `smoothstep(5, 3, distance)` from Still's
  centre.
- **Grace:** `graceLean` is held at (0, 0, 0) while `level.crossroads`.

### 3.4 Walking in

`simulate()`, where it tests the exit today: for each road, `toRoad >
BEAM_REARM` arms it, and `toRoad < EXIT_RADIUS` while armed takes it. Taking
it means:

1. `run.route = road.route`;
2. `save.lastRoad = road.route` (non-dev);
3. `descend()`.

The swap then calls `enterLevel(run.depth + 1)`, which is 4, because the
crossroads never changes `run.depth`.

### 3.5 Snapshot and resume

- **On entering the crossroads:** `writeSnapshot()` writes `{ depth: 3,
  bossFelled: true, route: null, crossroads: true, bossLoot: [] }`. Depth 3's
  floor loot was lost at the beam, by the existing rule.
- **Every later snapshot** carries `route: run.route`.
- **`resumeRun(snap)`:**
  - if `snap.crossroads`: restore the run as today, then `run.depth = 3`,
    `run.bossFelled = true`, `run.route = null`, `enterCrossroads()`;
  - otherwise: `run.route = snap.route === 'III' && flag('line') ? 'III' :
    'II'` (undefined is 'II'), then `enterLevel` as today.
- **`enterLevel` reads the route:** `lookAt(depth, run.route ?? 'II')` and
  `bossHere(depth) = bossFor(depth, devArbiterAt6 ?? ARBITER_AT_6, run.route
  ?? 'II', flag('engine'))`. The same goes for `placeNow`, `moodNow`, `__gen`
  (it gains a third argument, `route`), `__look` and the card.

### 3.6 The fallback (`ROAD_CHOICE = 'alternate'`)

- There's no room: the road is decided at the Assembler's descend by
  `routeForAlternate()`.
- When the Assembler falls, `bossDown` dresses the yard's cold beam as that
  road (the §3.3 dressing), with its label at 3-5 u. The warm beam and "on or
  home" are unchanged.

---

## 4. The Line: places and generation

### 4.1 What each place is made of

| | sidings (depth 4) | station (depth 5, the roundhouse at 6) |
|---|---|---|
| floorRoom | `floor_dirt_large` 0.45, `floor_tile_large_rocks` 0.6, `floor_tile_large` 1 | `floor_tile_large` 0.7, `floor_tile_large_rocks` 1 |
| floorCorridor | `floor_dirt_large` 0.6, `floor_tile_large` 1 | `floor_tile_large_rocks` 0.5, `floor_tile_large` 1 |
| wall / column | `barrier` / `column` | `barrier` / `column` |
| cover `[piece, scale]` | `crates_stacked` 1, `barrel_large` 0.7, `box_large` 0.8, `keg` 0.65, `rubble_half` 0.42 | `crates_stacked` 1, `box_large` 0.8, `keg` 0.65, `table_long` 0.8, `barrel_large` 0.7 |
| breakable | `barrel_large`, `box_large` | `barrel_large`, `box_large` |
| beyondTall | `wall_scaffold`, `wall_gated`, `pillar`, `wall_broken` (+ gantries, share 0.3) | `wall`, `wall_doorway`, `wall_window_open`, `pillar` |
| beyondLow | `rubble_half`, `floor_dirt_large_rocky` | `rubble_half`, `floor_dirt_large_rocky` |
| arenaCover | `barrier_column` | `barrier_column` |
| surfaces: paving / rock / wood / ground / grate | `Gravel023` / `Bricks097` / `Planks023A` / `Ground108` / `Metal063` | `Tiles093` / `Bricks097` / `Planks023A` / `Gravel023` / `Metal063` |
| `SURFACE_TEX` | `Gravel023: { scale: 4, gain: 0.55 }` (new). `ROLE_TEX.ground.Gravel023 = { scale: 6, gain: 0.3 }` so the station's beyond recedes | |

- **Every piece is vendored already.** The walls wear brick at both places
  (retaining walls).
- **`'gantry'`** (`machines.ts`): a primitive signal gantry. Two iron posts
  0.25 × 5 × 0.25 set 4 u apart, a beam 4.4 × 0.3 × 0.3 at 4.8, and three
  signal heads 0.4 × 0.8 × 0.3 hung from it, **all unlit (`0x1a1614`)**,
  skinned `grate`. It's beyond only, like every machine (C's G6 rules).
- **The station:** platform halls. Each hall's lane runs along one outer row,
  and a coping strip marks the platform edge: 0.3 wide, 0.02 high, skinned
  `paving`, at `lane centre ± (halfW + 0.15)` on the platform side. It's look
  only, never solid.

### 4.2 Generation: the lanes (G-L1-G-L6)

All of it draws from `rs = stream(seed, SALT.rail)` except where stated, and
runs only when `gen.line` is present. **INV: no Line code consumes the main
`rand()` in a place without `gen.line`.** The order in `generateLevel` is:
layout, then G-L1-G-L4, then floors, walls with gaps, props, arena, beyond,
packs, shrine, exits.

- **G-L1. Layout.** Unchanged, except `rand() < (gen.hallShare ?? 0.25)`
  replaces the hall literal. That's one `rand()` either way.
- **G-L2. Room lane candidates.** For each `main` room:
  - a big room (rx = rz = 2) has four candidates: the lane along x at
    `j = cj ± 1`, and along z at `i = ci ± 1`;
  - a hall has two: along its long axis, at the outer rows (offset ±1 across
    the short axis);
  - on the station (`alongHalls`), halls are picked first.
  - A candidate is **valid** when, for both of its exit edges, the
    `ceil(railOut / 4) = 4` cells continuing outward along its line hold no
    floor cell.
  - Shuffle the main rooms with `rs` (Fisher-Yates). Take the first
    `line.lanes` rooms that have a valid candidate, and pick one of their
    valid candidates with `rs`.
- **G-L3. Crossings.** Corridor cells, shuffled with `rs`. The lane crosses
  the cell perpendicular to its corridor. It's valid when the 4 cells outward
  on both sides hold no floor. Take up to `line.crossings`.
- **G-L4. Sidings.**
  - They go in main rooms with no lane, shuffled with `rs`, up to
    `line.sidings`.
  - The axis is x or z (`rs`), at offset ±1 (`rs`). A siding spans from −6 to
    +6 along its axis through the room's centre line (so it stays inside the
    room), with buffer circles r 0.6 at ±6.6.
  - `holds`, depth 4: the first siding `'handcar'`, the second `'wagon'`.
  - `holds`, depth 5: `'handcar'` if `rs() < 0.8`, else `'wagon'`.
  - The Sleepers may take an `'empty'` or `'wagon'` siding's room (§6.4).
  - **INV: no room holds both a lane and a siding.**
- **G-L5. Lane data.**
  - **Span:** the floor span runs from the room's (or the cell's) floor edge
    to the opposite edge, along the lane's centre line.
  - **Endpoints:** `a` is the edge at the smaller coordinate. `outA` and
    `outB` are `railOut` beyond each edge.
  - **Timetable:** `period = 16 + 6·rs()`, `phase = period·rs()`.
  - **Lesson:** at depth 4 only, the lane whose room has the lowest progress
    (a crossing never) is `lesson: true`.
- **G-L6. Gaps and exclusions.**
  - **Gaps:** every lane adds its two exit edges to `gaps` before
    `buildWalls`.
  - **Props** (the existing loop, main `rand()`): skip a candidate within
    `halfW + 1.0` of a lane's centre line (inside the room), or within 1.8 of
    a siding's line.
  - **Dead wagons:** a `'wagon'` siding gets one at its centre. It's a
    primitive (§4.3) and solid: two circles r 0.75 along the axis at ±0.5.
  - **The shrine:** it rejects spots within `halfW + 1.3` of a lane.
  - **The beyond:** `avoid` is true within 2.5 u of any lane's outward
    extension (its outA/outB segments beyond the walls).

**INV (K-G3):**
- no lane touches an `entrance` or `exit` room or a side room;
- no lane's floor span contains a corridor join;
- no prop or pack member (except a Handcar) stands inside `halfW + 0.8` of a
  lane or 1.4 of a siding;
- every lane's outward extension crosses no floor.

### 4.3 The pieces, as primitives (`src/line.ts`, built once per level, instanced)

| piece | geometry | material |
|---|---|---|
| live rail | box 0.09 × 0.12 × length, two at ±0.5 | worn steel: `0x4b4e52`, metal 0.8, rough 0.4, with `finish` streaks along the rail |
| siding rail | the same | rusted: `0x46362c`, metal 0.3, rough 0.9. **INV: never has a tell on it** |
| sleeper | box 1.6 × 0.08 × 0.25, every 0.8 u | skinned `wood` |
| buffer stop | timber beam 1.6 × 0.45 × 0.3 at y 0.55 on two iron posts 0.2 × 0.8 × 0.2 | `wood` / `grate` |
| dead wagon | box 1.9 × 0.9 × 1.5 on four wheels r 0.28, height 1.1 | skinned `grate` |
| lane lamp | a post 0.12 × 1.3 × 0.12 at each wall gap, 1.0 u outside the rails, with a lamp 0.2³ at its top | post `grate`. **The lamp is the tell** (§5.3): `CORE_ASLEEP` at rest, ember only while its lane is lit |

The rake is one engine plus two wagons, built once per lane and hidden until
used:
- **Engine:** boiler cylinder r 0.55 × 1.8, cab box 0.8 × 1.2 × 1.4, chimney
  r 0.12 to 1.7, in the `enamel` hide. A firebox slit 0.3 × 0.12 is its ember
  core.
- **Wagons:** 1.9 × 0.9 × 1.5 ore tubs, skinned `grate`.

Two meshes per rake (merged by material). **INV: no rake piece above 1.7
(the chimney); body tops ≤ 1.4.**

---

## 5. Trains

### 5.1 The timetable

- A lane's `k`-th scheduled tell starts at `phase + k·period`, on the Line's
  clock. The clock is `Line.t`: game time since `enterLevel`, frozen by
  pause, hitstop and the stop, like everything else.
- A scheduled start is **skipped silently** unless the lane is **live**:
  Still's centre within `liveR` (22 u) of the lane's floor midpoint, or
  `host.roomAwake(lane.room)` for a room lane.
- A Signalman's `call` makes a tell start now. The lane's next scheduled start
  becomes `t0 + period`.
- **The lesson.** The lesson lane runs no schedule until its lesson train.
  That train starts the first tick Still's centre is inside its room
  (`spineAt`). It has damage 0 for everyone, no shove, and full tell and
  sound. Afterwards the lane's schedule starts at `t0 + period`.
- **Direction.** Each train's `dir` is `rs() < 0.5 ? 1 : −1`, from a per-lane
  sub-stream (`stream(seed ^ lane.id, SALT.rail)`), so resume replays it.

### 5.2 Booking

- **At a candidate start** `t`, the train needs `book.canLock(comingMs)` and
  `book.canLock(comingMs + committedMs)` (800 and 2000, relative to `t`).
  Those are its commit and its arrival.
- **If either fails,** it retries every 50 ms, up to 600 ms. After that it
  starts regardless. Either way it books both (the owner is the train).
- **Enemies already avoid booked moments** through their own `canLock`, so
  once lit, a train is never moved.
- **INV:** a train's `t0` is at most 600 ms after its scheduled or called
  moment.

### 5.3 The tell (the rail tell; drawn = hit)

**From t0 to +800 ms, 'coming':**
- The lane's two live rails glow ember. It's a plain strip quad 0.1 wide on
  each rail top, from `outA` to `outB`.
- It sweeps in from the train's side at 1.5× train speed and holds at 0.35
  opacity.
- A plain wash quad of exactly `halfW` covers the floor span at 0.12.
- The lamps at both gaps go ember at 0.5.
- The rail hum starts (`sfx.railHum`, panned to the train's side, rising over
  2000 ms).

**From +800 to +2000 ms, 'committed':**
- The rails go to 1.0 and the wash to 0.3, and the lamps are full.
- The two-tone horn sounds at +800 (`sfx.horn`).
- If Still's centre is within `halfW + buzzR` of the lane's floor span: one
  `navigator.vibrate?.(40)`.
- For 150 ms before +2000, every other windup voice ducks by 40%, as it does
  before a ram's rush.

**From +2000 ms, 'passing':**
- The rake's front reaches the floor edge. It entered the rails at `outA` or
  `outB` at +1000, so it's seen coming through the fog for its last second.
- The wash burns off behind the rake's tail.
- `sfx.trainPass`: wheel clack every 0.18 s, from `impactMetal_light`
  samples, gain by distance.
- **'Gone'** when the tail passes the far `out` point.

- **Rules.** Only live rails ever carry a tell. Rail tells are plain (no
  chevrons) and never end in a star. `tellOrder` uses ms to the arrival, and
  `TELL_CROWD.locked` counts a committed train.
- **Hum voices:** at most two sound at once. They're separate from the three
  windup voices.

### 5.4 The hazards

At `t0`, one strip hazard per 4-u floor segment `k = 0..n−1`, counted from the
entering edge:

```ts
{ source: 'train', shape: { kind: 'strip', ax, az, bx, bz, halfW: LINE.halfW },   // segment k's own stretch of the centre line
  armMs: 2000 + (1000 * 4 * k) / LINE.speed,
  liveMs: (1000 * (LINE.segment + LINE.rakeLen)) / LINE.speed,                       // 786
  damage: lesson ? 0 : LINE.damage, cover: 'none', hurt: 'hazard', quiet: true, group: train,
  shove: lesson ? undefined : { dx, dz /* the train's travel */, along: 2.0, across: 1.8 } }
```

- **Slack.** The escape from the strip's centre is 1.2 u, which is 218 ms, so
  the slack is 2000 − 300 − 218 = **1482 ms**. Measured from the commit it's
  1200 − 518 = **682 ms**. Both clear the rule.
- **A crossing** has one segment. A room lane has 5.
- **On arm, per segment:** `host.smashIn(shape, 0.2)` breaks every breakable
  whose circle overlaps the strip. It drops nothing (§5.7).

### 5.5 Hits

- **On Still.** `hurtPlayer(20, 'hazard')` runs through the windows, as for
  slag. Brace converts it; Ward, Mirror Ward and Anvil don't touch it. Then
  `playerKnock` gets the shove:
  - `along` is in the travel direction;
  - `across` is perpendicular, toward the side his centre is on (the side
    away from the entering gap's column on a tie);
  - it's integrated like enemy knock (`KNOCK_DECAY`), clamped by
    `terrain.clampMove`.

  Presentation: `shake 0.5`, `hitstop 0.08`, `rig.punch(0.06)`, and
  `sfx.ramCrash(pan, false)`.
- **On an enemy.** `e.hit(20)`, the shove through `knockMul` (a rushing ram
  reads 0), and the normal hit flash. A hazard kill spills no slag. It's
  still a kill for the quiet and the drops (`onKill`, as for slag kills).
- **Once per body per train** (the `group`).

### 5.6 The first-train lesson

Covered in §5.1. There's no caption, and nothing else in the room: the lesson
lane's room has no pack (§6.5).

### 5.7 Crates

- A train strip breaks crates: either side's hit, the existing rule. A
  train-smashed crate rolls **no** contents. `Combat.smashNear` gains
  `opts.loot = false`.
- Props are never generated on lanes, so this only meets crates that were
  moved there: the Porter's, or a thrown one.

### 5.8 Stepping off, and broods

**`Combat.committed(e, held)`** is true when any of these holds:
- `e.phase !== 'approach'`;
- `e.knock` speed > 1.5 (sliding);
- `held`;
- `e instanceof Charger && (e.rushing || e.stunned)`;
- `e.kind === 'swarm'` and its brood lists it as a biter in a live surge;
- `e.kind === 'boss'` or `'thief'`, which never step off.

**`stepOff(dt)`**, for every enemy that is:
- not dead;
- not committed;
- in an awake or returning pack;
- inside a lit lane's floor strip grown by `e.radius + stepOff.pad`.

It moves perpendicular to the lane toward the nearer edge at `4.5 ×
e.speedMul` u/s, using `terrain.clampMove(e.radius)`, until the enemy is
outside. On a tie it moves away from Still.
- **Sleeping packs** are never placed on lanes, and the rule skips them.
- **An enemy pathing toward Still** across a lit lane stalls at its edge
  until the tail passes. That's intended: they wait at the crossing.

**The brood rule** (`swarm.ts`):
- A surge doesn't start while its ring centre `L` is within `halfW +
  broodPad` of any lit lane's floor span. It retries on the next tick.
- Biters already in a surge are committed and can be hit (max
  `BROOD.innerMax = 4` a train).
- The hanging-back mites step off like everyone else. **INV: a train kills at
  most 4 mites of one brood.**

### 5.9 Enemies and parts

Enemies path as today, and the BFS doesn't know rails. Frost Trail and Chill
Vent slow walking only, so a slowed enemy steps off slower. That's intended.

---

## 6. Enemies

### 6.1 The Signalman (`src/signal.ts`; `kind: 'ranged'`, `variant: 'signal'`)

```ts
export const SIGNAL = {
  hp: 20, bodyRadius: 0.45, height: 2.1, labelY: 2.5, speed: 3.0,
  preferMin: 7, preferMax: 11,     // from Still, like the sentinel's band
  windupMs: 900,                   // the arm rises 0° → 60°, its lamp from dim to full
  callRange: 14,                   // Still's centre within this of it
  laneReach: 3.7,                  // and within halfW + 2.5 of a lane's floor span
  reloadMs: 7000, interruptedMs: 3000, recoverMs: 760,
}
```

- **What it is.** A timber post on three short timber legs in a stilted walk,
  in the `signal` hide. A semaphore arm 1.0 long pivots at 1.8, and a lamp
  case at its end is its core (`CORE`; `CORE_ASLEEP` asleep; dim at 0.3
  awake). It never attacks.
- **How it winds up.** From `approach`, when all of these hold: its reload is
  done; `callRange` and `laneReach` are met for some lane; that lane is not
  lit; `line.nextAt(lane) − now > signalQuietS`; and `ctx.canLock(900)`. It
  books 900 and winds up for 900 ms. Then `line.call(lane)`, and it recovers
  for 760 ms.
- **The tell:**
  - the arm rising;
  - the lamp swelling to full;
  - a ratchet of 6 clicks over 900 ms (`sfx.semaphore`, the windup voice for
    this variant);
  - the called lane's own rail tell follows.
- **Slack.** Its own wind-up doesn't hurt anyone. The train it calls gives the
  §5.4 slack in full.
- **Breaking it.** `interrupt()` is true during windup. Parry Clamp, Clamp
  Toss, and step 1's pushed hit when that switch is on all go through it. A
  break means no call, the arm drops, and `interruptedMs` reload.
  Killing it during windup cancels too. **Nothing requires step 1.**
- **Movement.** It keeps its band and steps off lit lanes (§5.8). It needs no
  line of sight to call.
- **Numbers.** BE 1, loot and treasure as the sentinel, counted in
  `SHOOTERS_MAX`, and never a leader. Its page is `signal-jammer`.

### 6.2 The Handcar (`src/charger.ts`; `kind: 'charger'`, `variant: 'handcar'`)

A `Charger` constructed with `{ siding: SidingDef }`.

```ts
export const HANDCAR = {
  hp: 36, bodyRadius: 0.6, speed: 2.5,
  windupMs: 900, lockAt: 0.55,     // 495 tracking, 405 locked: the ram's
  rushSpeed: 18, damage: 14, stunMs: 1200, stunMul: 1.5, reloadMs: 1500, tripRecoverMs: 1200,
  trigger: 0.6,                    // Still's centre within hitHalf + this of the siding segment ahead
}
```

**What it is.**
- A flat deck 1.3 × 0.35 × 1.7 on four small wheels, with a see-saw pump
  lever on a post (a 1.4 bar pivoting at 1.0) and the ram's plough on the
  leading end, in the `handcar` hide.
- The ember seam runs along the lever (its core).
- It stands on its siding at one end (`±(6 − 1.0)` along the axis), facing
  the other buffer.

**Behaviour.**
- It moves only along its siding. It never leaves it, and it doesn't chase.
- From `approach` it winds up when all of these hold:
  - its reload is done;
  - Still's centre is within `hitHalf + trigger` of the siding segment
    between it and the far buffer;
  - `terrain.lineClear` holds along the siding;
  - `ctx.tokenFree` and `ctx.canLock(495)`.
- **The rush** always runs to the far buffer. The lane is cut at the buffer
  circle, so its end is `'prop'` and it always stuns (1200 ms, ×1.5). It then
  reloads, now facing back.
- **Shoves** move it only along its siding (its knock is projected onto the
  siding's axis), and it's clamped to the siding's ends.
- A rush that hits Still is `melee`, 14, so Anvil catches it. It tramples
  bodies as the ram does (sideways, no damage). Frost Trail on its siding
  trips it, as for the ram.

**Its tell, settled so it can't read as a train:**
1. **Where:** only in a room with no live lane (G-L4 INV). The siding has a
   buffer stop at both ends, inside the room, and rusted rails.
2. **What lights:** its `LaneTell` has `trackWash: true`. Tracking is a dim
   chevroned core from its body to the buffer. Locked is the full ram lane
   with the star at the buffer. **No rail strips, ever**, and the siding
   rails themselves never glow.
3. **The train's tell,** by contrast, is plain (no chevrons), wall to wall,
   with no body, on bright rails, and never has a star.
4. **Sound:** its tracking plays the pump (`sfx.pump`, a clank at 3 Hz); the
   lock plays the ram's latch; the rush plays `sfx.rush`. The train has the
   hum and the horn.

**Slack:** 900 − 300 − 1000 × 1.12 ÷ 5.5 = 396 ms, as the ram's.

**Numbers:** BE 1.5, loot as the ram, never a leader, one per siding. Its
page is `iron-crawler`.

### 6.3 Sleepers (`src/swarm.ts`, `look: 'ballast'`)

```ts
export const BALLAST = { nestR: 0.8, nestGap: 0.5, stepMs: 200, patchR: 1.3, shiverMs: [1800, 3000] as const, hideY: -0.35, riseMs: 250 }
```

- **The look.** A brood of 6 mites (M6) in the `sleepers` hide, asleep under
  a flat patch of gravel chips: 40 instanced boxes 0.12-0.2, `sleepers`
  colour, in a disc of r 1.3.
- **The shiver.** Every 1.8-3 s (seeded), the chips jitter up to 0.02 in y for
  300 ms. No ember shows while asleep.
- **Waking.** Each mite rises from `hideY` to 0 over 250 ms, 200 ms after the
  one before, by angle: the heap's stagger (C §6.4).
- **Page:** `conduit-spider`.

### 6.4 The Porter (stage D; `kind: 'thief'`, `variant: 'porter'`)

- **The body.** The thief's, without the cage, in the `porter` hide. It uses
  `THIEF` numbers except `depths` (Line 4-5 only, chance 0.5, at most one a
  level).
- **The job.** When a lane in its room starts a tell and a breakable is within
  6 u of the Porter, it lifts that crate. It carries it at the thief's speed
  to the nearest point of the lane's floor span, sets it down there (the
  crate's circle moves: dead, then `addCircle` at the new spot), and flees.
- **The rake smashes it,** with no loot (§5.7).
- **Break the crate while it's carried** and its contents roll there as
  usual. **Kill the Porter** and the crate drops whole where it stood.
- **Hazards never hurt it** (C's H2). It adds no loot and never takes floor
  parts. Its page is `drifting-frame`.

### 6.5 Pack tables on the Line

These apply when `gen.line` is present. Everything else is as C §6.5.

- **The lesson lane's room has no pack.** It's removed from `packRooms`.
- **The swarm lesson** stays at depth 4 (both roads). `pickLessonRoom` on the
  Line considers only main rooms with neither a lane nor a siding.
- **Handcar rooms:**
  - depth 4: the first handcar siding's room is `['H', 'K']`, `lesson: true`;
  - depth 5: `['H', 'H', 'K']` or `['M6', 'K']` (1:1), through `shrink`.
- **The Signalman's lesson,** depth 4: the lane room with the second-lowest
  progress, if any, is `['H', 'H', 'G']`, `lesson: true`.
- **Other lane rooms,** depth 5, pick from `D5L_LANE`: `{H, H, G}` 1,
  `{C, H, G}` 1, `{M6, G}` 1 (the brood leads), today 1.
- **Other rooms,** depth 5: `D5L` = `D5` minus every row that holds `'L'`.
  Depth 4 uses `D4` as today.
- **Caps:**
  - `CAPS` with `lobberPacks: 0` on the Line;
  - `signalPacks: 2`;
  - Handcars equal the handcar sidings.
- **Sleepers:**
  - depth 4 (after the swarm lesson): `HEAP.chance` (0.6) at a lane-free main
    room with progress greater than the lesson's, preferring a
    `'wagon'`/`'empty'` siding room (the nest sits 2.5 u off the siding);
  - depth 5: chance 0.4;
  - the template is `fill(['M6', 'H'], size, kinds)`, `look: 'ballast'`.
- **INV:**
  - `G` and `K` are never first in a template, so they never lead and are
    never elites;
  - `G` only in rooms with a lane, and `K` only on a siding;
  - no Lobbers, slag or heaps on the Line.

---

## 7. The Engine (depth 6 on the Line, stage C)

### 7.1 What it is

- A low shunting engine in the `enamel` hide, the same model as the crawl
  trains' engines at 1.15× scale. Its firebox is its core; the door opens
  when derailed, pulsing `FIRE_HOT`. It runs a loop of track round the
  roundhouse yard.
- **Unlit rail is always safe.** The rail ahead is lit `lead` = 1.3 s ahead,
  in the rail tell's look (plain, both rails, plus a wash of `halfW`).
- It has no adds. It can't be broken, slowed, tripped or shoved.
- **INV:** 900 HP, never above 22, no wind-up under 620 ms.

### 7.2 The arena (`arena: 'roundhouse'`; the 28 u room at centre c)

- **The loop:** 8 straights through these vertices (relative to c):
  (−6,−9) → (6,−9) → (9,−6) → (9,6) → (6,9) → (−6,9) → (−9,6) → (−9,−6) →
  back. The perimeter is 64.97 u, so a lap is 5.91 s at 11 u/s.
- **Turnout arms** (sidings, straight on from a chamfer's end):

  | side | arm | from | to buffer | used when |
  |---|---|---|---|---|
  | right (SE) | a | (6, −9) | (12.4, −9) | dir +1 |
  | right (SE) | b | (9, −6) | (9, −12.4) | dir −1 |
  | left (NW) | a | (−6, 9) | (−12.4, 9) | dir +1 |
  | left (NW) | b | (−9, 6) | (−9, 12.4) | dir −1 |

- **Buffers:** a solid circle r 0.6 at each arm end. The engine's derail stop
  is 1.9 u short of it, where `terrain.addCircle` makes it solid (r 1.2) while
  derailed; it's set dead after.
- **Levers:** right (11.3, −11.3), left (−11.3, 11.3). Each is a timber post
  0.15 × 1.0 × 0.15 with an iron handle, solid at r 0.3, never breakable.
  Each lever sits 2.3 u from both of its arms, outside their strips.
  "Right" and "left" are screen sides: screen-right is world (1, 0, −1).
- **Spurs** (phase 2's wagon): (0, −13) → (0, −9) and (0, 13) → (0, 9).
- **Cover:**
  - the yard's four inner walls at (±6.5, 0) and (0, ±6.5), as the
    Assembler's;
  - four crates, as breakables, at (3.2, 12.2), (−3.2, −12.2), (12.2, 3.2)
    and (−12.2, −3.2), replacing the yard's six. None sits within 1.8 of a
    rail.
- **The engine asleep:** stopped mid-straight on the straight farthest from
  the entrance, with dir +1.
- **Beams:** as the Assembler's arena, per `exitsAfterBoss(6)` (warm only). The
  warm beam is at c + side × 4.5, inside the loop.

### 7.3 Moves and phases

**Wake.** Still's centre is 1 cell inside the arena, then `unfold` (1500 ms:
a whistle, steam, no hazard), then `run`. The board lights. The first lever
window is on lap 2.

**The run, always:**
- It moves at `speed` along its path.
- As its lit horizon advances, it creates one strip per 2-u track segment
  ahead: `armMs = 1000 × distanceAhead ÷ speed`, at least 1300;
  `liveMs = 1000 × (2 + 2.6) ÷ speed`; damage 20; `source: 'train'`;
  `quiet`; one `group` per lap; shove along 2.0, across 1.8;
  `owner: engine`, `sparesOwner: true`, `cancelOnDeath: true`. The steam and
  wagon hazards carry the same three fields. Without `sparesOwner` the Engine
  would hit itself, since it stands inside its own strips.
- **Honest ahead:** when the lit path ends at a buffer or a settled wagon,
  the rail tell ends there with the ram's end star.
- **Slack:** 1300 − 300 − 218 = **782 ms**.

**Steam** (phases 1 and 2):
- Every 6-9 s (seeded), when Still's centre is within 8 u of the engine,
  outside the rail strip and not behind it.
- A 950 ms windup (the whistle rises; `cue: { voice: 'windup' }`).
- A strip from the engine's centre toward Still's position *at the windup's
  start*: length 7, `halfW` 1.3, cut at the first solid (the inner walls and
  crates block it).
- `source: 'steam'`, damage 14, `cover: 'none'` (pre-cut). The engine keeps
  moving; the jet is fixed where it was aimed.
- **Slack:** 950 − 300 − 236 = **414 ms**.

**Levers and the board** (the push ask):
- **Which lever.** Every `lever.every` laps, alternating right and left and
  starting with the side reached first on lap 2. The window is for that
  side's arm, in the current `dir`.
- **When.** It opens when the engine's path distance to that arm's
  junction is `speed × (lead + windowMs/1000)` = 29.7 u. It closes at
  `speed × lead` = 14.3 u, the moment the track beyond the junction must be
  lit.
- **The tell,** while open:
  - a **cold** dashed ring r 3.0 round the lever, exactly the reach
    (`tellMaterial('radial', 3, COLD, COLD_DEEP, { cold: true })`), with a
    sweep showing the time left;
  - a soft chime at the opening;
  - the lever itself stays dark. The ring is Still's reach, so it's
    cold (Still's colour).
- **Throwing it.** `Engine.onCast(still.pos)` is called from `main.cast()`
  after `combat.useAbility` returns anything but `'refused'`, pushed or not.
  If Still's centre is within 3.0 of the open lever, the points flip:
  - a latch (`sfx.leverThrow`), the lever animates, the ring flashes and
    closes;
  - the lit horizon beyond the junction is the arm.
  - The auto attack never reaches `onCast`.
- **The derail.** The engine runs straight into the arm, hits the buffer and
  is **derailed for 1600 ms**:
  - `open`, ×1.5 on every hit;
  - its stop circle is solid;
  - steam, and `BOSS_COPY.engine.open` (`sfx.clang`).
  - Then it **backs out** at 4 u/s to the junction, with its lit horizon
    running backward at 1.3 s ahead, and resumes the loop in the same `dir`.
- **A wrong throw:** if Still stands in the arm he routed it into, he's in its
  path. It's lit 1.3 s ahead, the same as any rail.
- **The board** (`hud.bossBar(... board)`), PLACEHOLDER copy:
  - `"right points · 4"`: seconds to the next window, ceiling, when it's
    ≤ 9 s away;
  - `"right points · now"` while open;
  - `""` otherwise.

**Phase 2** (HP < 55%; `justPhase2`; banner PLACEHOLDER "the Engine runs
both ways"):
- **Reversal.** Every 8-12 s (seeded):
  - 650 ms `judder`: sparks, the wheels scream, and its unarmed ahead-segments
    are taken back (`unhazard` of `'train'`);
  - then `dir` flips, and a new lit horizon grows ahead (1.3 s);
  - the arms in play become the `b` arms, and the board follows.
- **A loose wagon,** first 4 s into phase 2, then every 14 s, when none is on
  the loop:
  - a wagon appears at a spur's outer end (the spur farther from Still);
  - the ram's `LaneTell` lane runs down the spur for 1200 ms, ending in a
    star on the loop;
  - it rolls at 7 u/s: a strip hazard along the spur, `source: 'wagon'`,
    damage 12, `halfW` 1.2;
  - it settles centred on the loop straight (`addCircle` ×2, r 0.75, along
    the track axis).
  - The engine's lit horizon shows the star at it. When the engine reaches
    it: **derailed** in place (1600 ms, open) and the wagon smashed (its
    circles dead, chunks).
  - **Slack:** 1200 − 300 − 218 = **682 ms**.
- **The lever thrown back.** When a window closes unthrown and Still's centre
  is inside that arm's strip grown by 0.8, the engine throws it itself (the
  latch, the lever flips). The lit horizon shows the arm at once, still 1.3 s
  ahead. It then derails at the buffer as usual, open.

**Death.** The engine stops where it is. Its hull dulls to `0x202124`, and
it becomes a husk: `addCircle` ×2, r 0.8, along its axis. Then `bossDown()`,
generalised:
- the day snaps to 1 whenever `DAY_SPAN[depth].by === 'boss'`;
- the husk is by kind;
- `run.tally.engines` counts each worn part;
- loot is as for every boss (one blue, one gold).

### 7.4 Timings against the slack rule

| threat | locked (ms) | escape (u) | slack (ms) |
|---|---|---|---|
| train (from t0 / from commit) | 2000 / 1200 | 1.2 | 1482 / 682 |
| the Engine's run | 1300 | 1.2 | 782 |
| steam jet | 950 | 1.3 | 414 |
| loose wagon | 1200 | 1.2 | 682 |
| Handcar | 900 | 1.12 | 396 |

### 7.5 The Engine and the 30 parts

- **Levers take any ability cast,** so every loadout can open it; a head-only
  build included.
- **Ward and Mirror Ward:** nothing to stop (no shots).
- **Anvil:** nothing to catch (every Engine hit is a hazard).
- **Brace:** converts its hits into strain, the Stopped lever, as intended.
- **Lure** is ignored, as by every boss.
- **Frost Trail** doesn't trip it.
- **Borrowed Time** undoes a rail hit.
- **Patient Lens** fits the derail windows.
- **None is made useless.** The ask comes from the 1.4 s window against
  cooldowns of 2.6-6.5 s. The balancer estimates about 5 pushes a fight, and
  85-100 s.

---

## 8. Parts to watch (the Line)

| part | what happens | verdict and guard |
|---|---|---|
| Backdraft Vent | pulls a pack onto a lit lane in the last second: up to 20 each | strongest here. Once per body per train (`group`). Watch pack wipes on the phone |
| Pressure Vent, Piston, Skid Plates, Rusted Hook, Clamp Toss, Kickstart, Overrun | shove or pull onto a lit lane | better: the shove parts get a job. Clamp Toss onto a lit lane is a sure 20 |
| Lure | enemies go for the decoy, but step off lit lanes (§5.8) | can't feed a pack to a train. Unchanged strength |
| Chill Vent, Frost Trail | a slowed enemy steps off slower; Frost trips the Handcar | good, situational |
| Parry Clamp | breaks the Signalman's wave | better |
| Brace | a 20 train hit becomes 3 strain | the HP-for-strain trade grows: a Stopped lever, as meant |
| Ward, Mirror Ward | nothing against trains, steam or wagons (`warded` false) | weaker here, not useless (sentinels) |
| Anvil | catches the Handcar (melee), not trains | unchanged |
| Spring Heels, Skitter | **not airborne over hazards**: the centre test holds mid-hop | unchanged, and the rule for slag and shells stays one rule |
| Through-Line | no effect on rails (nothing solid to breach) | unchanged |
| Plumb Line | a snap across a lit lane can be hit mid-path (centre tested each tick) | unchanged |

---

## 9. The download budget

| added | bytes |
|---|---|
| `Gravel023` Color + NormalGL, 512 px, q 78 (ambientCG CC0, `Gravel023_1K-JPG.zip`, then `sips -Z 512`) | ≤ 230 KB |
| JS: `line.ts`, `signal.ts`, `engine.ts`, `crossroads.ts`, the Handcar, audio and HUD additions (minified) | ≈ 90-120 KB |
| GLBs, sound files | 0 |
| **total** | **≤ 0.35 MB, so about 5.35 MB** |

**Caps (K-Z1):**
- `dist/` ≤ 5,600,000 bytes;
- the files this spec adds total ≤ 400,000 bytes;
- `dist/kaykit/` gains nothing;
- `dist/textures/` gains exactly the two Gravel023 files.

GPU: one more surface, about 2.8 MB. Draw calls: rails, sleepers, buffers
and lamps are instanced (about 6 calls a level), plus 2 per visible rake.

---

## 10. State machines

### 10.1 The run (H §3, with the crossroads)

```
crawl(3, boss down) --cold beam--> descending --swap--> [due?] crossroads | crawl(4)
crossroads --road beam (II | III)--> descending --swap--> crawl(4, route set)
crawl(3, boss down) --warm beam--> homing (unchanged)
crossroads: broken/stopped unreachable (nothing hurts, nothing adds strain)
```

### 10.2 A train

`scheduled` → (live; booked, slip ≤ 600) → `coming` (800) → `committed`
(1200) → `passing` (until the tail leaves) → `gone`. A skipped start (not
live) never shows anything. Once `coming`, nothing cancels it.

### 10.3 A lever window

`closed` → (engine 29.7 u out) → `open` (1400 ms) → either `thrown` (a cast in
reach, which leads to `siding` → `derailed` 1600 → `backing` → `run`) or
`closed` (in phase 2, with Still in the arm, `thrown-back` → `siding` → ...).

### 10.4 The Engine

`asleep` → `unfold` (1500) → `run` ⇄ { steam windup 950 (in run) · `siding`
→ `derailed` → `backing` · (p2) `judder` 650 → `run` (dir flipped) · (p2)
wagon → `derailed` } → `dead`.

### 10.5 The Signalman and the Handcar

- **Signalman:** `approach` → `windup` 900 → (the call) `recover` 760 →
  `approach`, with a 7000 ms reload. `windup` → (interrupt or death) → reel,
  3000 ms reload.
- **Handcar:** `approach` (at its end) → `windup` (track 495, lock 405) →
  `strike` (rush to the far buffer) → `recover` (stun 1200) → `approach` (at
  the other end), with a 1500 ms reload.

---

## 11. Build order

Stages A-D. **Everything is behind the §1.7 flags.** Stages A and B can be
pushed to `main` with `LINE_ENABLED = false`, so the live site shows nothing
new. Setting it true is the last act of stage B.

| stage | step | what | about | playable after (DEV: `?route=III`) |
|---|---|---|---|---|
| A | A1 | route axis, flags, URL params, save v3, `bossFor` / `lookAt` / `areaOf` with route | 1 | the same game on new plumbing |
| A | A2 | the crossroads room, road beams, labels, resume there, the alternate fallback | 1 | the fork (`?crossroads=1`); III is still a copy of II |
| A | A3 | the sidings and the station: surfaces, gantries, G-L1-G-L6, rails and pieces, gaps, the coping, Line pack rows with H/S/C/M only | 1.5 | the Line's two levels, no trains |
| A | A4 | trains: timetable, booking, rail tell, `plain` strips, segment hazards, groups, shove, smash, lesson, buzz, sounds, step-off, the brood rule | 1.5 | **the Line with trains**, the Arbiter at 6 |
| B | B1 | the Signalman, its rows and lesson, `sfx.semaphore` | 1 | |
| B | B2 | the Handcar: sidings with handcars, `trackWash`, `sfx.pump`, its lesson | 1 | |
| B | B3 | Sleepers: `ballast` look, `sleepers` hide, the MiteBatch material | 0.5 | |
| B | B4 | ambience `line`, the card's route, notebook re-roles and `pageOf`, the hides judged on the phone; **then `LINE_ENABLED = true`** | 1 | **stage B: the whole road, ending at the Arbiter where the roads meet (the safe stop)** |
| C | C1 | the Engine: arena, track, run, levers, board, derail and backing, steam | 3 | |
| C | C2 | phase 2 (reversal, wagon, the lever thrown back), death and husk, `bossDown` generalised, NAMED, `ambience 'roundhouse'`; **then `ENGINE_ON_LINE = true`** | 2 | the Line has its own boss |
| D | D1 | the Porter; `PORTER_ENABLED = true` | 0.75 | |
| D | D2 | the station clock (below); tuning pass on the Poco | 0.25 | |

**About 15 evenings. Stage B is about 9.5.**

**The station clock (D2).** On entering depth 5 on the Line: after 1.5 s,
`impactBell_heavy` strikes 5 times, 2.2 s apart, panned from the beyond
(sound only). It's the hour, late afternoon. Nothing is drawn.

### Done when

- **A1:** K-R1-R6 pass. Home A1-A8, C's K-A1-A7 and the enemies/parts suites
  are unchanged. `__gen(d, s)` on route II equals C's baselines for d 1-6.
- **A2:** K-X1-X7 pass.
- **A3:** K-G1-G8 pass. Baseline `__gen(4|5, s, 'III')`.
- **A4:** K-T1-T12 pass. On the phone: a train's tell is read, and stepped
  off, from 3 u, 10 times out of 10.
- **B1-B3:** K-E1-E9 pass.
- **B4:** K-E10-E12, K-Z1 and K-S1-S4 pass. **Phone playtest,** on
  `?route=III`: three runs start to end. The Handcar's tell is never taken
  for a train's (Adrian's call, §1.9). **Then flip `LINE_ENABLED`**, and run
  K-X8.
- **C1:** K-N1-N9 pass.
- **C2:** K-N10-N15 pass. **Then flip `ENGINE_ON_LINE`**, and K-N16.
- **D1:** K-P1-P4. **D2:** K-D1.

**Fallbacks:**
- If C stalls, `ENGINE_ON_LINE = false` keeps the Arbiter at the end of the
  Line (stage B), with no loss.
- If the crossroads confuses, `ROAD_CHOICE = 'alternate'`.
- If trains overwhelm, raise `LINE.period` first.

---

## 12. Acceptance

### 12.1 The five core mechanics

**The three outcomes, on the Line**

- *Given* Still at 18 HP standing on a room lane at depth 4 (not the lesson
  lane), *when* its train arrives, *then* the phase is `broken`. A card with
  `end: 'broken', depth: 4, route: 'III'` is stored before the first `broken`
  tick.
- *Given* strain 18 at depth 5 and a Signalman winding up, *when* the player
  pushes a cooling part, *then* the ending is `stopped` by the same path.
- *Given* the boss at 6 on the Line felled (the Arbiter in stage B, the Engine
  in stage C), *when* Still walks into the warm beam, *then* it's `home`,
  through `toWalk` and the quarter's walk at night. The card has `route:
  'III'` and `hour: 'night'`.

**Never trapped: the lane and the crossroads**

- *Given* any lit lane, *then* Still can leave its strip in time: slack ≥ 682
  ms from the commit.
- *Given* the crossroads, *then* both beams are open on the first tick and
  nothing there hurts him or adds strain.
- *Given* a lever window, *then* no button, beam or movement is ever locked.

**The reward fork stays binary**

- *Given* the Assembler down at 3, *then* `__exits()` shows `cold` and `warm`
  and exactly 2 beam meshes, and `exitsAfterBoss(3)` is `['cold', 'warm']`.
  This holds on either road and in either `ROAD_CHOICE`.
- *Given* the crossroads, *then* `__exits()` shows `cold: null, warm: null`
  and `__roads()` lists exactly II and III.

**The kept thing persists across v3**

- *Given* a v2 save with 3 cards, 5 histories (length 7) and a snapshot at
  depth 5, *when* v3 code boots, *then*:
  - the cards are identical;
  - every history has length 8 ending in 0;
  - `roads` is `['II']`;
  - the snapshot resumes on route II at depth 5;
  - `v === 3`.
- *And* a part worn at an Engine kill drops next time as `"…, that saw the
  Engine"`.

**The game-specific mechanic: the train and the push**

- *Given* a hulk awake and approaching across a lit lane, *then* it steps off
  and the train passes it by.
- *Given* the same hulk shoved onto the lane 0.3 s before the arrival, *then*
  it takes 20, once.
- *Given* the Signalman winding up, *when* a Parry Clamp lands, *then* no
  train is called.

### 12.2 Headless checks

**Setup** as C §10.2: Playwright, a fresh context, `npx vite --host`, and one
synchronous `page.evaluate` per stepped check. DEV build, so the URL params
work. Unless stated, `__flags({ line: true })`.

**New hooks** (DEV only, `main.ts`):

| hook | returns / does |
|---|---|
| `__flags({ line?, engine?, porter?, roadChoice? })` | overrides §1.7 for this page |
| `__route()` | `{ route, atCrossroads, roads: save.roads, lastRoad }` |
| `__roads()` | the crossroads' `[{ route, x, z, open }]`, or null |
| `__crossroads()` | enters the crossroads now (depth 3, boss down) |
| `__takeRoad(r)` | puts Still in that road's beam and steps until `crawl(4)`; returns `run.route` |
| `__gen(d, s, route?)` | extended with the route |
| `__genLine(d, s)` | `{ lanes: LaneDef-like[], sidings: [{ holds, ax, az, bx, bz }], packs: (as __gen, + variants, look), props: [{ x, z }], gaps: string[], rooms: [{ kind, ci, cj, rx, rz, lane: boolean, siding: boolean }] }`, generated and thrown away |
| `__lanes()` | the current level's lanes: `[{ id, kind, ax, az, bx, bz, period, phase, lesson, lit, nextAt }]` |
| `__train(laneId, dir?)` | a tell now (as a call, with slip); returns `t0 − now` in ms |
| `__trains()` | `[{ lane, dir, stage, t0, lesson, hit: ('still' \| number)[] }]` |
| `__boss()` | extended for the Engine: `{ kind: 'engine', hp, phase2, open, state, s, dir, lap, x, z, window: { side, open, inMs } \| null, wagon, board }` |
| `__lever(side)` | `{ x, z, open }` |

**K-R: routes and the save (A1)**

- **K-R1.** For d 1..6 and s 1..20, `__gen(d, s)` and `__gen(d, s, 'II')` are
  deep-equal to C's baselines.
- **K-R2.** `__look()` after `__enter` on route III gives sidings at 4,
  station at 5, and at 6 quarter (engine off) or station (engine on). On
  route II: works, quarter, quarter.
- **K-R3.** `__bossFor(6, true, 'III', false).kind === 'arbiter'`,
  `__bossFor(6, true, 'III', true).kind === 'engine'`,
  `__bossFor(6, true, 'II', true).kind === 'arbiter'`, and
  `__bossFor(6, false).kind === 'assembler'`.
- **K-R4.** Migration. `__setSave` a v2 save with histories of length 7, 3
  cards and `run` at depth 5 without `route`; reload. Then:
  - `v === 3`;
  - every history has length 8, with `[7] === 0`;
  - `roads` deep-equals `['II']` and `lastRoad === null`;
  - `run.tally.engines` deep-equals `{}`;
  - the cards are byte-identical;
  - `__continue()` resumes at depth 5 on route II (`__route().route ===
    'II'`, `__look().place === 'quarter'`).
- **K-R5.** `repair` drops a history of length 7 in a v3 save, and keeps
  length 8. `roads: ['III', 'x']` repairs to `['II', 'III']`.
- **K-R6.** Two tabs: tab A writes `roads ['II', 'III']`. Tab B's next write,
  with its own `['II']`, keeps `'III'` (the union).

**K-X: the crossroads (A2, B4)**

- **K-X1.** With `roads ['II']`: `__enter(3)`, `__killBoss()`, walk into
  cold. The next phase is `crawl` at depth 4 on route II, with no crossroads.
- **K-X2.** With `roads ['II', 'III']`: the same leads to `__route().atCrossroads
  === true`, and `__roads()` has 2 entries (II at (−4.6, −0.35), III at
  (−0.35, −4.6)), both open. `__exits()` has cold null and warm null.
  `__level().packs.length === 0`.
- **K-X3.** In the crossroads: `__step(10)` with Still idle leaves strain and
  HP unchanged, and gives no quiet (`__runStats().quiets` unchanged).
  `__world` has no ember material (no material with r > 0.8 and g < 0.5,
  except Grace's).
- **K-X4.** `__takeRoad('III')` gives `run.route === 'III'`,
  `__look().place === 'sidings'`, depth 4, `save.lastRoad === 'III'`, and
  `__snapshot().route === 'III'`.
- **K-X5.** Resume. At the crossroads, `__snapshot()` has `crossroads: true,
  route: null, depth: 3`. A reload plus `__continue()` puts Still back in the
  crossroads with the same strain.
- **K-X6.** `__flags({ roadChoice: 'alternate' })` with `lastRoad: 'III'`:
  the Assembler's cold beam leads to route II (no room), and its label reads
  "the Works".
- **K-X7.** Opening: with `roads ['II']`, a run that reaches depth 4 and is
  then `__end('broken')` commits `roads ['II', 'III']`. The same run with
  `__flags({ line: false })` commits `['II']`.
- **K-X8.** (B4, flag flipped in code, not by `__flags`.) A production build
  (`vite build && vite preview`) ignores `?route=III`: `__route` is
  unavailable, and a fresh save's first run reaches depth 4 on route II.

**K-G: generation (A3)**

- **K-G1.** Over `__genLine(4, s)` for s 1..100: the lane count is 2 in
  ≥ 90 levels (never more), crossings ≤ 1, and sidings = 2 in ≥ 80 levels.
  At depth 5: lanes 3 in ≥ 80 levels, crossings 0, sidings ≤ 1.
- **K-G2.** Every lane is axis-aligned and lies at a ±1-cell offset from its
  room's centre row or column. Its span equals the room's floor extent along
  it, or 4 for a crossing.
- **K-G3.** The §4.2 INVs:
  - no lane in entrance, exit or side rooms;
  - no room with both lane and siding;
  - no prop or pack member (except `variant: 'handcar'`) within
    `halfW + 0.8` of a lane or 1.4 of a siding;
  - no floor cell along any lane's 4 outward cells.
- **K-G4.** Every lane's two exit edges are in `gaps`, and no box covers
  them. `__level().terrain.blocked` just outside a gap is still true (off
  floor).
- **K-G5.** `__genLine(4, s)` twice is deep-equal. So are its lanes' `period`
  and `phase`. Every period is in [16, 22].
- **K-G6.** Depth 4 has exactly one `lesson` lane, whose room has no pack.
  Depth 5 has none.
- **K-G7.** No Line pack holds `L` or `slag`. No `G` or `K` is first in any
  template, or elite.
- **K-G8.** `JSON.stringify(PLACES.sidings) + JSON.stringify(PLACES.station)`
  doesn't match `/bed|cot|crib|cradle|toy|swing|pram/`. Every `MachineKind
  'gantry'` material and lane lamp at rest has `emissive` 0 and a colour
  that isn't ember.

**K-T: trains (A4)**

- **K-T1.** Timing. `__enter(4, s)` on route III with Still in a non-lesson
  lane room; `__train(id)`. Then:
  - `stage` is `coming` at +0.4 s and `committed` at +1.0 s;
  - there's no damage to Still until +2.0 s;
  - standing at the lane centre, HP is −20 at the tick where segment 0 arms
    (±1 tick).
- **K-T2.** Once per train. Still at segment 0 with a shove of 0 (a test
  override) takes 20 once over the whole pass (`__trains()[0].hit` has
  `'still'` once).
- **K-T3.** The shove: after a hit, Still's centre ends outside the strip
  within 0.6 s, displaced along the travel by ≥ 1.5.
- **K-T4.** Symmetry: an awake hulk placed on the lane in `windup` takes 20
  and is shoved. A
  sentinel at 20 HP dies, and its kill counts for the quiet.
- **K-T5.** Step-off:
  - an awake hulk in `approach` placed on a lit lane leaves the strip within
    0.6 s;
  - one in `windup` stays and is hit;
  - `__combat.enemies` never has an `approach`-phase body inside a lit strip
    for more than 0.6 s.
- **K-T6.** Broods: an 8-mite brood awake round Still, who stands beside a
  lane when a train is called. No surge starts while its ring centre is within
  2.2 of the lit span. Over 20 trials, at most 4 mites die per train.
- **K-T7.** Booking: a sentinel booked to lock at +800 makes `__train` slip,
  so `t0 − now` is in (0, 600]. Across 200 random trains in a busy room,
  no two committed moments (train commits, arrivals, enemy locks) fall within
  300 ms of each other unless the slip hit 600.
- **K-T8.** Live: with Still more than 22 u from every lane and no awake
  pack, `__step(60)` shows no train. Walking into a lane room lets its trains
  run on schedule.
- **K-T9.** Determinism: the same seed and the same moves (a scripted stick
  path) give the same train `t0`s and `dir`s, including after `__continue()`.
- **K-T10.** The lesson: the first train in the lesson room does no damage
  and no shove, and has the full tell. The next train on that lane does 20.
- **K-T11.** Crates: a breakable placed on a lane (a test placement) is
  broken when its segment arms. No loot or scrap appears (`__loot().ground`
  unchanged).
- **K-T12.** Tells:
  - every rail-tell material is `tellMaterial` with `uPlain === 1`, and no
    other material has `uPlain === 1`;
  - no rail tell draws a star;
  - the buzz fires once only when Still's centre is within 2.0 of the lane
    at the commit (`navigator.vibrate` spied).

**K-E: enemies (B1-B4)**

- **K-E1.** Signalman: awake, 9 u from Still, Still 2 u from a lane whose next
  train is > 4 s away. It winds up (`phase 'windup'`); 900 ms later the lane
  is `coming`. Its `nextAt` is `t0 + period`.
- **K-E2.** It doesn't wind up when the lane is lit, or its next train is
  ≤ 4 s away, or Still is > 14 u off, or its reload is < 7 s since its last
  call.
- **K-E3.** `__equip('parry-clamp')`, cast into its windup: `interrupt()` is
  true, no train is called, and it recovers for 3000 ms. The same passes with
  strain step 1's switch off.
- **K-E4.** Killing it in windup calls no train.
- **K-E5.** Handcar:
  - with Still standing on its siding, it winds up (495 tracking, lock at
    495);
  - it rushes to the far buffer: `lane.end === 'prop'`;
  - it's stunned 1200 ms, taking ×1.5;
  - it ends at the other end, facing back.
  - Over 100 rushes, it always stuns.
- **K-E6.** The Handcar never leaves its siding: its position stays within
  0.05 of the siding line and within its ends, even when shoved (knockMul
  along-axis only).
- **K-E7.** Tell separation:
  - the Handcar's `LaneTell` has `trackWash` and draws its rail quads at
    opacity 0 at every stage;
  - siding rails never carry a tell;
  - in every generated Line level, no room holds a lane and a siding.
- **K-E8.** Sleepers: a `ballast` brood asleep has every mite at `y === hideY`
  and no visible ember. On wake, the rise times are sorted 0, 200, …, 1000.
  Its page on first meeting is `conduit-spider`.
- **K-E9.** Hides: `HIDES.signal`, `handcar`, `enamel`, `sleepers` and
  `porter` exist. None has a body colour with saturation > 0.35 and hue in
  0-40° (red-orange) or lightness > 0.45.
- **K-E10.** Pages: meeting each new body writes its page id. The five pages
  are absent from `namesFor(kind, d)` for every kind and depth, and every
  kind still has ≥ 2 names per band.
- **K-E11.** The card: a Line run's card has `route: 'III'`, and the caption
  includes the Line's PLACEHOLDER suffix.
- **K-E12.** Ambience: `__look().ambience === 'line'` at 4-5 on route III.

**K-N: the Engine (C1, C2)** (`?route=III&engine=1`, `__enter(6)`)

- **K-N1.** Geometry: the loop's vertices are exactly §7.2's (±0.01), its
  perimeter is 64.97 ± 0.05, and the levers and buffers sit at §7.2's points.
- **K-N2.** Wake: Still enters, and `state` goes `unfold` for 1500 ms, then
  `run`. No lever window on lap 1.
- **K-N3.** The run: at every tick in `run`, every armed `train` hazard of the
  Engine was created ≥ 1300 ms before it armed. Still standing on unlit rail
  1 u ahead of the lit horizon is never hit in the next 0.5 s.
- **K-N4.** A window opens at 29.7 u (±0.3) to its junction and lasts
  1400 ms (±17). The board reads `"<side> points · now"` while it's open.
- **K-N5.** Throw:
  - Still within 3.0 of the open lever, and `__fire('torso')` (any part),
    means `thrown`;
  - the lit horizon turns into the arm;
  - the engine reaches the buffer and is `derailed` 1600 ms, with `open`
    true and damage ×1.5;
  - then `backing`, then `run`, in the same `dir`.
- **K-N6.** No throw: the auto attack firing within reach throws nothing. A
  cast from 3.2 u throws nothing. A refused cast (hot, or nothing to do)
  throws nothing.
- **K-N7.** A wrong throw: Still standing in the arm when it's thrown is hit
  (20) unless he leaves within the 1.3 s lead.
- **K-N8.** Steam: a strip aimed at Still's position at the windup's start,
  cut at the inner wall when one is between them. It arms at 950 ms. Damage
  14.
- **K-N9.** INV sweep over a scripted 120 s fight: no hit above 22, no
  Engine threat locked under 620 ms, HP 900 at the start.
- **K-N10.** Phase 2 at < 55%: `justPhase2` for one tick, and the banner.
- **K-N11.** Reversal: a 650 ms judder takes back unarmed ahead-hazards
  (none arm after it). `dir` flips, and a new lit horizon appears at ≥ 1300
  ms before any arm.
- **K-N12.** Wagon: a spur lane of 1200 ms, then a roll (a `wagon` hazard,
  12). It settles on the loop, as a solid (`terrain.blocked` true at its
  centre). The engine reaching it gives `derailed` 1600 ms, and the wagon's
  circles are dead.
- **K-N13.** Thrown back: in phase 2, a window closing unthrown with Still in
  the arm's strip means the engine throws it. It isn't thrown back when he's
  outside.
- **K-N14.** Death: `__killBoss()` gives a husk (`blocked` at its centre), the
  warm beam open, `day` at 1, one blue and one gold, and
  `run.tally.engines` counting each worn part.
- **K-N15.** A commit after an Engine kill gives each worn part's history
  `[7] === 1`, and its next drop is named `", that saw the Engine"`.
- **K-N16.** With `ENGINE_ON_LINE = true` in code: `__look()` at depth 6 on
  route III is `station`, and route II's depth 6 is still the Arbiter.

**K-P: the Porter (D1)**

- **K-P1.** It appears only on the Line (depths 4-5), at most one a level.
- **K-P2.** A lane goes lit with a crate within 6 u: it carries the crate
  onto the lane, and the train breaks it with no loot.
- **K-P3.** A hit on the carried crate breaks it and rolls its contents
  there. Killing the Porter drops the crate whole.
- **K-P4.** No hazard ever hurts it.

**K-S: sound (B4)**

- **K-S1.** A train plays, in order: hum (t0), horn (+800), pass (+2000).
  At most 2 hums sound at once.
- **K-S2.** The Signalman's windup plays `semaphore`, not the sentinel's aim
  whistle.
- **K-S3.** The Handcar's tracking plays `pump`, and its lock the ram's
  latch.
- **K-S4.** No new sound file is fetched (network log).

**K-Z1 (B4, and every stage after).** The §9 caps.

**K-D1 (D2).** On entering depth 5 on the Line: 5 bell strokes, 2.2 s apart,
starting 1.5 s in. No mesh is added.

---

## 13. Out of scope

| | why |
|---|---|
| the old town, the bell stroke, the Watcher, the Winder, tick mites, the Hour | parked whole: its rule ("stand still") contradicts the train's ("step off"), and it would be a third mechanic |
| trains that block shots | toggling solids every tick for a small gain |
| rolling wagons that are solid in motion | circles can't move; a settled wagon covers the idea |
| hops over hazards | would reach slag and shells too |
| a walk home along the tracks | +1 evening, later if wanted |
| a Line score | area II's loop fits the afternoon |
| the Linesman, the Couplers, the Rake, the Winch | two-body coordination, and over the two-mechanic cap |
| a third beam in the Assembler's yard | dilutes the go-home decision; breaks `exitsAfterBoss`'s INV |

## 14. Contradictions found, and how they're resolved

1. **PITCHES has a signal lamp dressing the crossroads' Line beam, but ember
   is only for threats.** The lamp is dark (§3.3). Lane lamps are ember only
   while their lane is lit (a tell).
2. **PITCHES has the Engine's whistle as "a cone ahead of it".** Hazards are
   circles and strips, and the lit track already says "ahead". So the steam
   is a strip aimed at Still at the windup's start (§7.3).
3. **PITCHES gives trains 20-22 damage.** Set to 20 for every rail hit
   (trains and the Engine), under the 22 cap.
4. **The balancer's Engine loop is a circle of r 9.** Straight quads and
   strips make it 8 straights (§7.2).
5. **The balancer has Frost Trail tripping the Engine.** It doesn't: bosses
   are never slowed.
6. **My round 2 had the board name a slot.** PITCHES has it name the lever
   and the time. The PITCHES version is built. The slot rule is the fallback
   if the asks come in under ~3 a fight.
7. **The Handcar's lane tracking draws "rails" (the ram's LaneTell).** That's
   exactly the train's language. So `trackWash` replaces them, siding rails
   never glow, and sidings never share a room with a lane (§6.2).
8. **"Sleepers: slate-dull bodies."** Slate reads blue-grey, which is Still's
   cold. The `sleepers` hide is a warm near-black slate (§2.8).
9. **"Bosses can't be broken"** against a lever that stops the boss. The lever
   is the world's, not the boss's. `Engine.interrupt()` is false.
10. **The Signalman is "the lesson for a pushed hit breaks the wind-up"**, but
    step 1 may be off. It breaks through `interrupt()`, which Parry Clamp and
    Clamp Toss already use. Nothing in area III requires step 1.
11. **The crossroads reads "never a third beam" by spirit, not by type.** Its
    beams aren't `ExitKind`s. `Level.roads` is a separate, closed, length-2
    field, and the INV is checked (K-X2, 12.1).

## 15. Summary

1. The crossroads keeps the Assembler's fork binary and adds a second road
   one room later. The route is a new axis next to depth, and route II
   reproduces area II exactly.
2. The Line's trains are rows of existing floor hazards on a seeded,
   lock-booked timetable. Idle enemies step off and broods hold. It's built
   from primitives and one gravel texture: +≤ 0.35 MB, 5.35 MB total.
3. The Signalman calls trains, and breaking its wind-up needs only
   `interrupt()`. The Handcar is a siding-bound ram whose tell can't be taken
   for a train. Sleepers are a face on the mites.
4. The Engine runs an 8-straight loop. Levers thrown by any cast within 3 u
   derail it into buffer sidings (open ×1.5), and the boss bar is a departure
   board. The Arbiter ends the Line until stage C.
5. Four stages, about 15 evenings, all behind `LINE_ENABLED` /
   `ENGINE_ON_LINE` / `PORTER_ENABLED`. Stage B (about 9.5 evenings) is the
   safe stop: a whole road, shipped when the flag flips.
