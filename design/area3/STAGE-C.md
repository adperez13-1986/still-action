# Stage C: the Engine (build brief)

30 Sep 2026. The build brief for stage C of `design/area3/BOTH-ROADS.md` §5: the Line's own boss. A coding agent
follows it step by step (C0 to C10), and the lead reviews each step against its "Done when" list. Every file:line
cited here was checked against the tree at 89f6934. **Where this brief and the older docs (SPEC.md §7, BOTH-ROADS.md,
CURVE9.md, PITCHES.md) disagree, this brief follows the code, and §7 lists each case.**

Every player-facing word stays PLACEHOLDER, because the words are Adrian's to write. Do not commit, and do not run
`npm run dev`: `vite.config.ts` sets `server.host: true`, which binds 0.0.0.0 (no dev server on the office network).
Checks start their own vite on 127.0.0.1 (`tools/checks/lib.mjs` `startVite`, which asserts it).

---

## 1. Scope

The Engine replaces the stand-in Assembler at the Line's last step (areas.ts:506). It is **dark**: it exists only
where `bossFor` returns `ENGINE_DEF`, which needs `engineOnLine` (areas.ts:504), and `ENGINE_ON_LINE = false`
(areas.ts:34). DEV: `?line=1&engine=1` (a 6-depth run, the Engine at 6) or `?roads=1&line=1&engine=1` (9 depths).

**Where it sits** (bossFor, areas.ts:497-509; exitsAfterBoss, areas.ts:136; curve.ts; DAY_SPAN, areas.ts:604-633):

| run | order | depth | exits after | the day at its death | HP (900 × bossHp) | rail hit (20 × bossDmg) |
|---|---|---|---|---|---|---|
| 9 depths | Line first (`run.route 'III'`) | 6, the middle boss | cold + warm | held at late afternoon (`by: 'hold'`, :628) | 1080 | 20 |
| 9 depths | Works first (`'II'`) | 9, the last boss | warm | first dark on the kill (`by: 'boss'`, :631) | 1170 | 21 |
| 6 depths (DEV only) | `'III'` | 6 | warm | first dark (`by: 'boss'`, :610) | 1170 | 24 (the cap is before the curve) |

**What stage C builds** (SPEC §7, with this brief's changes marked NEW):
- **C0** the checks' scaffold, `tools/checks/stagec.mjs`.
- **C1** `src/track.ts`: the yard of track as pure numbers.
- **C2** the roundhouse arena in `generateLevel`, and `buildTrackPieces` in line.ts.
- **C3** `src/engine.ts`: the body, asleep and waking, and the plumbing (`makeBoss`, `addBoss`, the wake radius, DEV hooks).
- **C4** the run: moving on the loop, the lit horizon as hazards, the hold rule.
- **C5** levers, the board, the derail and backing out.
- **C6** steam that leads him (NEW: the Arbiter's guess), and the cinder when he stays out of reach (NEW: the outrun rule).
- **C7** phase 2: reversal, the loose wagon, the lever thrown back.
- **C8** death, the husk, `bossDown` generalised, resume, the tally.
- **C9** the dressing: ambience `'roundhouse'`, the sounds, the notebook page (unmet-only), the colours, see-through.
- **C10** the whole stage, headless.

**Out of scope, do not build:**
- Flipping `ENGINE_ON_LINE`, `LINE_ENABLED` or `BOTH_ROADS`. Going live is one act, on his word (BOTH-ROADS §5 "Live").
  SPEC §11's "C2 … then `ENGINE_ON_LINE = true`" and K-N16's flag flip belong there. K-9D (k9.mjs) keeps asserting all three are false.
- Removing the stand-in (areas.ts:505-506). It stays for the flag-off 9-depth DEV page until the flags flip together.
- Tuning: the curve at 6 and 9, `ENGINE` numbers beyond what is written here, strain at the Engine (stage T). C reports numbers.
- The Porter, the station clock (stage D). The named-part suffix order (pool.ts:144-146, BOTH-ROADS §1 G, his words).
- Any change to `BossDef` or `ENGINE_DEF` (areas.ts:448-478). K-90 records `__bossFor(d, a6, r, e)` for `e = true` (baseline.mjs:62-63),
  so a new field or word there moves K-90. Engine-only settings live in `ENGINE` (engine.ts).
- SPEC.md / BOTH-ROADS.md / CURVE9.md / HANDOVER.md edits. Those are the lead's.

**The Engine's state machine** (SPEC §10.4, with this brief's additions in brackets):

```
asleep ─(Still within ENGINE.wakeR 16.5)→ unfold 1500 [whistle at 0; the horizon laid at 200, so its first strip arms at 1500] → run
run ─(window thrown, the frontier reaches the junction)→ siding ─(centre at the stop)→ derailed 1600 (open ×1.5) [its backing strips laid in the last 1300]
    → backing (4 u/s to the junction) → [hold 1300: the loop horizon laid] → run, same dir
run ─(p2, every 8-12 s)→ judder 650 (stands; unarmed strips ahead taken back) ─(dir flips)→ [hold 1300] → run
run ─(p2, the frontier ends at a settled wagon; the nose meets it)→ derailed 1600 in place (the wagon smashed) [forward strips laid in the last 1300] → run
any ─(hp ≤ 0)→ dead (husk)

attack, overlaid on run / siding / backing / hold (the engine keeps moving):
none ─(Still ≤ 8 u, off its lit path, not behind; gap 6-9 s; canLock 950)→ steamTrack 250 → steamLock 700 → (the jet: 200 live) → none
none ─(out of reach ≥ 5000 ms [3500 in p2]; cooldown 5000; canLock 620)→ cinderAim 620 → (launch: 1000 flight) → none

lever window (SPEC §10.3): closed ─(the junction 29.7 u ahead on its path)→ open 1400 ─(a cast within 3.0)→ thrown
                           open ─(the junction 14.3 u ahead)→ closed | [p2, Still in the arm's strip grown 0.8] thrown back
                           [open ─(a reversal)→ cancelled, rescheduled for the new dir]
```

Combat sees (`phase`, as the Arbiter maps it, arbiter.ts:608-610): `'windup'` in steamTrack, steamLock and cinderAim;
`'strike'` on the tick the jet arms or the cinder launches; `'recover'` while derailed; `'approach'` otherwise.

---

## 2. Data contracts

### 2.1 `src/track.ts` (new, C1). Pure numbers, no three.js (tools and checks import it)

```ts
export interface Pt { x: number; z: number }
export type Side = 'right' | 'left'
/** "Right" and "left" are screen sides: screen-right is world (1, 0, -1) (SPEC §7.2). */
export interface TrackArm {
  side: Side; kind: 'a' | 'b'
  /** The loop direction it is taken from: 'a' arms with dir +1, 'b' arms with dir -1. */
  dir: 1 | -1
  /** The loop vertex it leaves from straight on (its junction), and its buffer end. */
  vertex: number; junction: Pt; buffer: Pt; len: number
}
export interface TrackDef {
  c: Pt
  /** SPEC §7.2's 8 vertices, absolute, in dir +1 order. */
  loop: Pt[]
  /** Path distance of each vertex from vertex 0 along dir +1; loopLen = 64.97 (SPEC). */
  vertexS: number[]; loopLen: number
  /** Right a, right b, left a, left b, as SPEC §7.2's table. */
  arms: TrackArm[]
  levers: Record<Side, Pt>
  /** Phase 2's two spurs: `outer` at 13 from c, `onLoop` at 9, on the axis across the entrance (NEW, §7). */
  spurs: { outer: Pt; onLoop: Pt }[]
  spurAxis: 'x' | 'z'
}
/** SPEC §7.2, relative to c. */
export const TRACK = {
  loop: [[-6, -9], [6, -9], [9, -6], [9, 6], [6, 9], [-6, 9], [-9, 6], [-9, -6]] as const,
  arms: [
    { side: 'right', kind: 'a', dir: 1, vertex: 1, buffer: [12.4, -9] },
    { side: 'right', kind: 'b', dir: -1, vertex: 2, buffer: [9, -12.4] },
    { side: 'left', kind: 'a', dir: 1, vertex: 5, buffer: [-12.4, 9] },
    { side: 'left', kind: 'b', dir: -1, vertex: 6, buffer: [-9, 12.4] },
  ] as const,
  levers: { right: [11.3, -11.3], left: [-11.3, 11.3] } as const,
  spur: { outer: 13, onLoop: 9 },
  bufferR: 0.6, leverR: 0.3,
}
export function makeTrack(cx: number, cz: number, spurAxis: 'x' | 'z'): TrackDef
/** The loop at path distance s (wrapped into [0, loopLen)): the point and the unit direction of dir +1. */
export function loopAt(t: TrackDef, s: number): { x: number; z: number; dx: number; dz: number }
/** The loop parameter nearest (x, z). */
export function loopS(t: TrackDef, x: number, z: number): number
export function armFor(t: TrackDef, side: Side, dir: 1 | -1): TrackArm
/** Distance from (x, z) to the nearest centre line of the loop, an arm or a spur. */
export function distToTrack(t: TrackDef, x: number, z: number): number
```

`spurAxis` is `'z'` when the entrance lies along x from c, else `'x'` (spurs at (0, ±13) → (0, ±9), or (±13, 0) → (±9, 0)).
**INV-K1:** each lever is 2.3 u (± 0.01) from both its arms' centre lines, and outside their strips (halfW 1.2).

### 2.2 `src/dungeon.ts` (C2)

```ts
// Level (:147) gains, beside boss/posts/footprint (:166-169):
/** The roundhouse only (arena 'roundhouse'): its track. */
track?: TrackDef
```

The roundhouse is a new branch in the arena block, **before** the yard's: `if (square) {…} else if (opts.boss?.arena === 'roundhouse') {…} else if (opts.boss) {… the yard …}`
(the yard is :1366-1395). The branch, with `c` the exit room's centre and `away` = c − entrance centre, normalised (axis-aligned):
- `track = makeTrack(c.x, c.z, Math.abs(away.x) > 0.5 ? 'z' : 'x')`.
- The yard's four inner walls, exactly as :1370-1377 (`kit.arenaCover`, the same boxes).
- SPEC §7.2's four crates as breakables at c + (3.2, 12.2), (−3.2, −12.2), (12.2, 3.2), (−12.2, −3.2), built as the yard's (:1378-1390,
  one `rand()` for the piece and one for the yaw each, as there). None of the yard's six.
- Two levers: a solid circle r `TRACK.leverR` each (`circles.push`) and a mesh (a timber post 0.15 × 1.0 × 0.15 in
  `hideMaterials('signal').mat`, an iron handle 0.06 × 0.5 × 0.06 in its `jointMat`, pivoting at the post's top). Never breakable.
  The lever meshes are named `lever:right` / `lever:left` so the Engine can find and animate them (`level.group.getObjectByName`).
- Four buffers: a solid circle r `TRACK.bufferR` at each arm's buffer end.
- `bossSpot` = the middle of the axis straight farthest along `away` (at c + away × 9), `face` = that point plus dir +1's tangent.
- The rails: `buildTrackPieces` (§2.4) over the loop's 8 straights, the 4 arms (live rail) and the 2 spurs (siding rail), and the
  4 buffers; added to `group` as `linePieces` is (:1762-1763).
- `line` stays null (:1167): the roundhouse has no lanes and no timetable. Its trains are the Engine's.
- Returned as `track` beside `boss: bossSpot` (:1820).

The beams need no change: `coldAt` (:1789) is the room's centre for anything but the square, and `home` (:1800) is c + side × 4.5,
both inside the loop (it is 9 u out on every straight). K-N21 checks both stay clear of every rail.

### 2.3 `src/boss.ts`, `src/combat.ts`, `src/enemy.ts` (C3, C4)

```ts
// boss.ts, Boss (:24-47) gains:
/** How close Still's centre must come to wake it. Absent: 12.5 (combat.ts:2816, every boss today). */
readonly wakeRadius?: number
/** The departure board under the bar's name, or ''. Absent: none. */
board?(): string

// makeBoss (:51) gains `track?: TrackDef`; its 'engine' case (:55-56) becomes:
case 'engine': return new Engine(def, x, z, face, track!)

// combat.ts, addBoss (:2805) gains `track?: TrackDef`, passed to makeBoss; its pack's wakeRadius (:2816) becomes `b.wakeRadius ?? 12.5`.
// main.ts:2766 passes level.track; __spawn's boss (main.ts:4630-4635) passes makeTrack(0, 0, 'z') for 'engine' (__arena's floor is
// exactly the 28 u room round the origin, main.ts:4663).

// enemy.ts, EnemyCtx (:78) gains:
/**
 * C4: a hazard made by `owner` now, through the same path as its 'hazard' action (combat.ts:629: owner.dmgMul applied).
 * For a body whose tell is many hazards in one tick (the Engine's lit track, its hold). Returns Combat's record.
 */
addHazard?(owner: Enemy, spec: HazardSpec): Hazard
/** C4: end `owner`'s unarmed, not-done hazards that pass `pick`, as the 'unhazard' action does (combat.ts:630). Returns how many. */
takeBack?(owner: Enemy, pick: (h: Hazard) => boolean): number

// EnemyEvent (:120) gains:
/** The Engine's instants, for its sounds and the log. `side`: the lever's. `ms`: a judder's length. */
| { kind: 'engine'; e: Enemy; what: 'whistle' | 'window' | 'throw' | 'throwBack' | 'derail' | 'back' | 'judder' | 'flip'
    | 'steam' | 'cinder' | 'wagon' | 'wagonSettle' | 'wagonSmash' | 'phase2'; at: THREE.Vector3; side?: Side; ms?: number }
```

Combat's ctx (combat.ts:483-518) gains the two, and line 629 is rewritten through one helper both use (a pure move, K-90F proves it):

```ts
/** Its hits scaled by the depth curve (curve.ts), whichever path makes the hazard. */
private scaled(e: Enemy, s: HazardSpec): HazardSpec { return e.dmgMul && e.dmgMul !== 1 ? { ...s, damage: s.damage * e.dmgMul } : s }
//   ctx.addHazard: (o, s) => this.addHazard(this.scaled(o, s))
//   ctx.takeBack:  (o, pick) => { let n = 0; for (const h of this.live) if (h.spec.owner === o && !h.armed && !h.done && pick(h)) { this.endHazard(h); n++ } return n }
//   :629            if (action?.kind === 'hazard') this.addHazard(this.scaled(e, action.spec))
```

Nothing else in combat changes. What the Engine already gets for free, and must keep: half from the autos (`autoOn`, combat.ts:69);
never slowed (:1079); never breakable (:1204); always committed (:1589); its threats framed (:2521); its unarmed hazards cancelled on
death when `cancelOnDeath` (:1499); its hazards spare it when `sparesOwner` (:2615); a group hit once (:2597-2616).

### 2.4 `src/line.ts` (C2, C3)

```ts
/** C2: rails, sleepers and buffers along any straight runs (the roundhouse's loop is diagonal at its corners). The same pieces,
 *  materials and instancing as buildLinePieces (:143); `rail` picks its live (:88 LIVE_RAIL) or siding (:89) steel. */
export function buildTrackPieces(runs: readonly { ax: number; az: number; bx: number; bz: number; rail: 'live' | 'siding' }[],
  buffers: readonly { x: number; z: number; yaw: number }[]): THREE.Group
/** C3: the crawl trains' engine (rakeParts, :316-343): its geometry and firebox slit, for the Engine to CLONE. Never dispose these. */
export function engineKit(): { engine: THREE.BufferGeometry; firebox: THREE.BufferGeometry }
/** C4: the rail tell's look (:294-302 TELL, :304 WASH_Y), exported unchanged so the Engine draws the Line's language. */
export { TELL as RAIL_TELL, WASH_Y }
```

`buildTrackPieces` may factor `track()`/`put()`/`build()` out of `buildLinePieces` (:151-170, :223-235) or copy them; either way
`buildLinePieces`'s output is unchanged (its pieces are not in any baseline, so the lead reviews the diff by eye).

### 2.5 `src/engine.ts` (new, C3-C8)

```ts
/** SPEC §2.6, with this brief's changes marked NEW. INV: no hit above 22 before dmgMul; no windup under 620 ms. */
export const ENGINE = {
  radius: 1.2, width: 1.5, height: 1.5, labelY: 2.4,
  /** The crawl trains' engine model (line.ts engineKit) at this scale. */
  scale: 1.15,
  /** NEW: its body along the track, 2.6 × 1.15 (SPEC's 2.6 is the unscaled model). The nose is pos + fwd × length/2. */
  length: 3.0,
  /** NEW: it whistles once Still is over the near rails and inside the loop (SPEC: "1 cell inside"; see §7). */
  wakeR: 16.5,
  speed: 11, backSpeed: 4,
  /** s of track lit ahead. INV ≥ 0.62. Every strip is made ≥ 1000 × lead ms before it arms. */
  lead: 1.3,
  runDamage: 20, halfW: 1.2, segment: 2,
  /** NEW: the whistle at 0, the horizon laid at unfoldMs − lead. */
  unfoldMs: 1500,
  /** NEW `everyJunctions` (SPEC's `every: 1` lap cannot alternate: §7): a window at every 3rd junction passed, so sides alternate. */
  lever: { windowMs: 1400, reach: 3.0, everyJunctions: 3 },
  derailMs: 1600, openMul: 1.5,
  /** NEW trackMs/lockMs/liveMs/leadMax: 250 ms of aim, then 700 locked (slack 164). len/halfW/damage/gapS/range: SPEC's. */
  steam: { trackMs: 250, lockMs: 700, liveMs: 200, len: 7, halfW: 1.3, damage: 14, gapS: [6, 9] as const, range: 8, leadMax: 3.0 },
  /** NEW: the Arbiter's answer memory (arbiter.ts:622-629), for the steam's lead. `minMove`: a lock he wasn't moving through tells it nothing. */
  guess: { memory: 3, minMove: 0.8, first: 1 },
  /** NEW, the outrun rule (arbiter.ts:63-69's lesson): out of every reach this long, and the stack lobs a cinder where he'll be. */
  outrun: { afterMs: [5000, 3500] as const, cooldownMs: 5000 },
  /** NEW: the Arbiter's shell (arbiter.ts:50), lobbed from the chimney; `leadS` of his velocity, capped. Source 'shell'. */
  cinder: { windupMs: 620, flightMs: 1000, r: 1.6, damage: 12, leadS: 0.6, leadMax: 3.0, peak: 3.2 },
  phase2At: 0.55,
  reverse: { judderMs: 650, everyS: [8, 12] as const },
  /** SPEC's, plus `r`/`at` (line.ts:46 SIDING.wagonR / wagonAt) and `halfLen` (its tub, line.ts:96 WAGON.l / 2). */
  wagon: { tellMs: 1200, speed: 7, damage: 12, halfW: 1.2, everyS: 14, firstS: 4, r: 0.75, at: 0.5, halfLen: 0.95 },
  husk: { r: 0.8, at: 0.7, color: 0x202124 },
  seeThrough: { opacity: 0.35, reach: 3.0, half: 1.6 },
  /** NEW: the firebox while derailed: deeper and redder than CORE, flickering (the Handcar's seam, handcar.ts:47), never FIRE_HOT's peach. */
  fireHot: 0xff3812, flickerHz: 18,
}
/** Adrian's words: PLACEHOLDER. */
export const BOARD = { right: 'right points', left: 'left points', now: 'now' }

export type EngineState = 'asleep' | 'unfold' | 'run' | 'hold' | 'judder' | 'siding' | 'derailed' | 'backing' | 'dead'
export type EngineAttack = 'none' | 'steamTrack' | 'steamLock' | 'cinderAim'

export class Engine implements Boss {
  readonly kind = 'boss'
  readonly labelY = ENGINE.labelY
  readonly height = ENGINE.height
  readonly wakeRadius = ENGINE.wakeR
  knockMul = 0
  /** NEW: Still is kept out of it while it stands (pushOffBoss, main.ts:4165; combat's spacing, combat.ts:36); null while it moves. */
  get anchored(): number | null   // ENGINE.radius in asleep | unfold | hold | judder | derailed | dead, else null
  state: EngineState
  attack: EngineAttack
  /** Where it is: on the loop (s along dir +1), or on an arm (s from its junction). dir +1 is the loop's vertex order. */
  path: 'loop' | TrackArm; s: number; dir: 1 | -1; lap: number
  window: { side: Side; arm: TrackArm; open: boolean; thrown: boolean; msOpen: number } | null
  wagon: { spur: number; x: number; z: number; settled: boolean; circles: Circle[] } | null
  /** The guess for the next steam: 1 leads him fully, 0 aims at him (arbiter.ts:207). */
  guess: number
  /** Where the laid horizon ends ahead of the nose, in path u, and what ends it. */
  frontier: number; frontierEnd: 'open' | 'buffer' | 'wagon'
  constructor(def: BossDef, x: number, z: number, face: THREE.Vector3, track: TrackDef)
  /** Always false: bosses can't be broken (SPEC §1.5.8). */
  interrupt(): false
  /** From main.cast(), after a cast that wasn't refused: throws the open lever if `at` is within ENGINE.lever.reach. */
  onCast(at: THREE.Vector3): boolean
  /** "right points · 4", "right points · now", or '' (BOARD's words). */
  board(): string
  // the rest of Boss (boss.ts:24-47) as the Arbiter has it
}
/** The dead engine, where it stopped: the model in ENGINE.husk.color, as arbiterHusk (arbiter.ts:932-942). */
export function engineHusk(x: number, z: number, yaw: number): THREE.Group
```

**The rules the class keeps** (the lead checks each in review; the checks in §4 test them):
- **INV-E1, honest rail.** A strip is laid when its start comes within `speed × (lead + dt)` of the nose, with
  `armMs = 1000 × ((start − nose) / speed + dt)` (the `dt` as line.ts:602 adds it: a hazard loses its creation tick) and
  `liveMs = 1000 × (len + length) / speed`. So every strip is made ≥ 1300 ms before it arms, and the nose never enters a point of
  track that isn't inside one of its own armed strips. Strips split at loop vertices (a strip is straight). Backing uses `backSpeed`.
- **INV-E2, the hold.** It never starts moving onto track it hasn't lit: every start from standstill (unfold, a derail's end, backing's
  end at the junction, a reversal) lays its horizon `lead` s before it moves. After unfold and a derail that time is inside the state;
  after backing and a reversal it is `hold` (1300 ms).
- **Each strip:** `source: 'train'`, `damage: runDamage`, `halfW`, `cover: 'none'`, `hurt: 'hazard'`, `quiet: true`, `owner: this`,
  `sparesOwner: true`, `cancelOnDeath: true`, `shove: { dx, dz: its travel, along: 2.0, across: 1.8 }` (LINE.shove),
  `group` = the lap's object (a new one each lap, and on every change of path, direction or hold). Made through `ctx.addHazard`.
- **Honest ahead.** The frontier stops at a buffer (the centre's stop is `arm.len − bufferR − length / 2` along the arm) or at a
  settled wagon's near face; there the tell ends in the ram's end star (a `tellMaterial('radial', 0.7)` disc, as lane.ts:126).
- **Its drawing** is its own hazards: for each not-done strip a wash quad (`halfW`, at WASH_Y) and two rail quads (± `LINE.gauge / 2`,
  `RAIL_TELL.railHalf`, at `RAIL_TOP + 0.004`), all `tellMaterial('strip', 1, undefined, undefined, { plain: true })` at
  `RAIL_TELL.rails[1]` / `wash[1]` (the Line's committed look: everything it lights is ≤ 1.3 s off). Quads capacity 16 wash + 32 rail.
- **Seeded, never Math.random** for anything that decides (the gaps, reversals, the guess pick): its own LCG as the Arbiter's
  (arbiter.ts:396-399, seed 1). Presentation (`dress`) may use Math.random, as every boss does.
- **No field or word added to `BossDef`/`ENGINE_DEF`.**

### 2.6 `src/main.ts`, `src/hud.ts`, `src/style.css` (C5, C8, C9)

```ts
// main.ts cast (:3517-3543), after the refused return (:3523-3526):
if (combat.boss instanceof Engine) combat.boss.onCast(still.pos)
// The boss bar (:3994): `board: boss.board?.() ?? ''` added to the object.
// hud.ts bossBar's type (:126) gains `board?: string`; the markup (:254) becomes
//   <div id="bossBar"><b></b><small></small><div class="track"><i></i></div></div>
// and bossBar (:712-720) sets the small's text to b.board ?? '' (it never shows while open: CSS).
// style.css after :448:
//   #bossBar small { display: block; margin: -2px 0 5px; font: 600 12px/1 var(--display); letter-spacing: .2em; color: #c9b1aa; text-shadow: 0 1px 3px #000; }
//   #bossBar small:empty, #bossBar.open small { display: none; }
```

INV-K2: with no Engine the bar is exactly today's (an empty `<small>` is `display: none`).

### 2.7 `src/notebook.ts` (C9): the Engine's page, unmet-only

```ts
// LineRole (:105) gains 'engine'. LINE_DONORS (:111-115) gains:
/**
 * The Engine's page. SPEC's raging-hull while he hasn't met it; else echo-shell, the one page the live game never assigns (role
 * 'reserved', never in namesFor), so it is unmet on every save and a boss is never unwritten. PLACEHOLDER choice: Adrian's (§9).
 */
engine: ['raging-hull', 'echo-shell'],
// roleOf (:144-147): the Engine's chosen page reads { role: 'boss', band: 'any' } (WHAT: 'the boss', as the other two bosses);
// the three bodies' pages keep their LineRole as today.
```

```ts
// main.ts: the page a boss is met and felled on (used at :1960 and :2014):
/** A boss's page: its def's, but the Engine's is a Line page, unmet-only (notebook.ts LINE_DONORS.engine); null: unwritten. */
function bossPage(def: BossDef): string | null {
  return def.kind === 'engine' && linePagesActive() ? linePage('engine') : def.roster
}
//   :1960  if (isBoss(e)) id = bossPage(e.def) ?? undefined
//   :2014  if (kind === 'boss') id = combat.boss ? bossPage(combat.boss.def) ?? undefined : BOSS_PAGE
//   stampLine (:2003-2007) loops ['signal', 'handcar', 'sleepers', 'engine']
```

`ENGINE_DEF.roster` stays `'raging-hull'` (K-90). The pages are chosen at boot (main.ts:93), which is on whenever the Engine can
appear (it needs route III, and route III needs `flag('line')`, `RUN_DEPTHS === 9` or `?route=III`), so `def.roster` is only the
fallback no page ever reaches in practice.

### 2.8 Ambience (C9)

- `AmbienceMood` (ambience.ts:30) gains `'roundhouse'`.
- **Where it comes from:** `moodNow` (main.ts:4159-4162) becomes
  `level?.boss ? (bossHere(run.depth)?.arena === 'roundhouse' ? 'roundhouse' : place.ambience.boss) : place.ambience.crawl`.
  The station's table (areas.ts:383) stays `{ crawl: 'line', boss: 'line' }` (§7: K-E12 reads it, stageb.mjs:1995-1998, and the
  flag-off stand-in stands in the station).
- **The sound** (first pass; his ear decides): the Line's open air (`'roundhouse'` joins the mood lists of `roomOf` → `airRoom`,
  ambience.ts:246, of `air`, :478, and of `open`, :562, so the tone and draft are the open ones, :563-566), `railTick` (:379) on the
  `line` mood's clock (:479-488), no `farShunt` (the engine is here), and the boss's steam one-shots (`steam`, :514: the gate becomes
  `boss || works || mood === 'roundhouse'`). No foundry, no drips, no clanks.

### 2.9 Sounds (C9)

Synthesized Web Audio like the rest; no file (K-S4). Every function below gets `heard(name)` as its first line (audio.ts:282, DEV only).

| when (engine event / cue) | sound |
|---|---|
| `whistle` (unfold starts) | `horn(pan)` (:2402), and steam from the chimney |
| running (a loop voice, as `rush`, :841, kept in `loops` and stopped at dead/hold/derail) | NEW `engineRun(pan): Voice`: chuffs at wheel rate (4.2 Hz at 11 u/s: short lowpassed noise bursts, 300 Hz) over a 55 Hz rumble; `pan` follows the body |
| `window` | NEW `pointsChime(pan)`: two cold sine partials 1320 / 1760 Hz, 5 ms attack, 600 ms decay, quiet (the ring is Still's colour, so is its sound) |
| `throw`, `throwBack` | `latch(pan, 1.2)` (:717) and `clack(pan, 1)` (:2431) |
| `derail` | `ramCrash(pan, false)` (:878); the open window's `BOSS_COPY.engine.open` (`clang`, main.ts:2432) already fires on `open` |
| `judder` | `judder(ms, pan)` (:2101) |
| steam windup (cue `'windup'`) / the jet (`steam`) | `windup` (:490) via onWindup (main.ts:601-604) / `scald(pan)` (:2110) |
| cinder windup (cue `'lob'`) / launch (`cinder`) / landing | `lobAim` (:184) / `mortar` (:197) + `whistle(flightMs)` (:206) / the 'shell' arm path already plays `shellLand` (main.ts:685-691) |
| `wagon` (its tell starts) / `wagonSettle` / `wagonSmash` | `clack` ×3 over the roll / `plateDull(pan)` (:945) / `smash(pan)` (:636) |

`BOSS_COPY.engine` (main.ts:2432) keeps its PLACEHOLDER banner. Its comment ("until then … an Assembler under its def") is updated.

### 2.10 DEV hooks (`src/main.ts`, inside `if (import.meta.env.DEV)`)

```ts
__makeTrack: makeTrack                                       // C1
__track: () => TrackDef | null                               // C2: the level's
// C3: __boss (:4780-4787) gains an Engine branch:
//   { kind: 'engine', hp, maxHp, phase2, open, state, attack, s, dir, lap, x, z, path: 'loop' | `${side}-${kind}`,
//     window: { side, open, thrown, msOpen } | null, wagon: { x, z, settled } | null, board, guess, frontier, frontierEnd, dmgMul }
__engineSegs: () => { madeAt: number; armMs: number; armIn: number; liveLeft: number; done: boolean; source: string;
                      shape: HazardShape; damage: number; group: number }[]   // C4: the Engine's own hazards (it keeps madeAt = combat time)
```

---

## 3. Steps

Each step ends with all of these, in order:
- `npx tsc --noEmit -p .` clean; `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → PASS K-90 **and** PASS K-90L (never `--line-changed` in stage C: see below);
- `node tools/checks/fights.mjs compare` → PASS K-90F (nothing listed);
- `node tools/checks/k9.mjs`, `area3.mjs`, `home.mjs` → all PASS;
- `node tools/checks/stageb.mjs` → every check PASS except K-W3d (Parry's dead-slot finding, known) and K-T13 (slow, Line-only:
  run at C10);
- the step's own checks: `node tools/checks/stagec.mjs <ids>` → PASS.

A step that fails any of these is not done. Suggested commits (the lead's call): C0 (tools only), then C1-C10 in one or more
commits, all dark.

**Why the baselines hold through stage C.** K-90 records the flag-off page: generation, the pure lookups (with
`__bossFor(…, e: true)`, baseline.mjs:62-63), and each level entered with the engine flag off (:74-94). Stage C adds a generator
branch reached only by `arena === 'roundhouse'`, which only `ENGINE_DEF` has, which only the engine flag returns. K-90L records
route III's crawl depths 4-5 (baseline.mjs:27), which stage C never touches. K-90F records arena fights with no boss. **K-90L never
legitimately re-captures in stage C**: if it moves, a `rand()` was drawn outside the roundhouse branch, or `layLine`/`buildLinePieces`
changed; find it. K-90 moves only if `BossDef`/`ENGINE_DEF` changed (don't) or a shared path did.

### C0. The checks' scaffold (no `src/` change)

- `tools/checks/stagec.mjs` on lib.mjs's `suite()`, as stageb.mjs is, with its queries (§4 setup) and an in-page toolkit:
  `enterEngine(order, depth, seed)` (`__hold(true)`, `__run.route = order`, `__enter(depth, seed)`, `__equip('scrap-cleaver')`,
  autos off, HP put back to 100 each tick), `wake()` (Still set at c − away × 7, stepped until `__boss().state === 'run'`),
  `tick`/`until` as stageb.mjs's HELPERS. C0 registers no checks.
- Run every suite at 89f6934 and record the results; `npx vite build` and record `dist/` bytes (B8's 5,381,866 is the figure to beat).

**Done when:** stagec.mjs runs (0 checks, exit 0); the suites match HANDOVER's B8 table (stageb 37/38, K-W3d the known fail); the
`dist/` bytes are reported.

### C1. The track as numbers

- `src/track.ts` per §2.1. `vertexS` and `loopLen` computed, not typed in.
- main.ts: hook `__makeTrack`.

**Done when:** the step's regression set passes; K-N1a passes.

### C2. The roundhouse arena

- dungeon.ts per §2.2 (import `makeTrack` from track.ts; `buildTrackPieces` from line.ts).
- line.ts `buildTrackPieces` per §2.4.
- main.ts: hook `__track`.
- Until C3 the level still holds the stand-in body (`makeBoss` 'engine' is an Assembler, boss.ts:55-56): that's expected.

**Done when:** the regression set passes (K-90 / K-90L unchanged proves the branch is sealed); K-N1b passes; the lead has
screenshots of one roundhouse from above (`?line=1&engine=1`, route III, depth 6), both spur axes.

### C3. The Engine's body, asleep and waking

- `src/engine.ts`: `ENGINE`, `BOARD`, the class shell per §2.5 with every Boss member (boss.ts:24-47) working: the model, `hit`
  (×`openMul` while open), `interrupt` false, `landsIn` (null until C6), `cue` (`{ voice: 'none' }` until C6), `threats`, `dress`
  (chimney smoke), `strikeFx`, `idle`, `setAsleep`, `dispose`, the `anchored` getter.
- **The body:** `engineKit()` geometry **cloned** (never the shared one: `disposeBody`, enemy.ts, disposes what it finds), group scaled
  by `ENGINE.scale`, in `hideMaterials('enamel', { transparent: true })` (hide.ts:165; the enamel hide is hide.ts:144-148). A firebox
  at the cab's back: a core box 0.34 × 0.26 in a `MeshBasicMaterial({ fog: false })` behind a hinged door (joint material).
  Core colour: `CORE_ASLEEP` asleep, `CORE` (enemy.ts:346) awake, and C5's derail colour. The body's `pos` is its centre; `group.rotation.y`
  follows its travel.
- **See-through** (SPEC §2.6 `seeThrough`, as the Arbiter's `fade`): when Still is within `reach` behind it from the camera (+x +z)
  and within `half` across, its materials ease to `opacity` 0.35.
- **Asleep and waking:** placed on the loop at `loopS(track, x, z)`, dir +1, facing its travel. Woken (Combat's `wake`, via
  `wakeRadius`), `unfold`: the `whistle` event at 0; `run` at `unfoldMs` (it doesn't move yet: C4).
- boss.ts `makeBoss` / `Boss` per §2.3; combat.ts `addBoss` per §2.3; main.ts:2766 and `__spawn` pass the track; `__boss` branch.
- line.ts `engineKit` per §2.4.

**Done when:** the regression set passes; K-N2a passes; the lead has screenshots of it asleep, unfolding, and see-through.

### C4. The run

- engine.ts: movement on the loop at `speed` (dir +1, `s`, `lap` counted at its waking point), the horizon per INV-E1/INV-E2
  (laid at unfold's 200 ms, from then on as the nose advances), the lap groups, the drawing (§2.5), the end star, `threats` (the
  frontier's end point), `engineRun` voice hookup deferred to C9.
- enemy.ts `EnemyCtx.addHazard` / `takeBack`; combat.ts ctx and `scaled` per §2.3.
- main.ts: hook `__engineSegs`.

**Done when:** the regression set passes; K-N2b, K-N3 pass; the lead has one screenshot of the lit horizon round a corner.

### C5. Levers, the board, the derail

- engine.ts: the window schedule (count junction passages of arms with the current `dir`, from the first one passed after lap 1
  ends; open at every `everyJunctions`-th; so sides alternate), open/close by path distance (29.7 / 14.3 u: `speed × (lead + windowMs/1000)`
  / `speed × lead`; while it stands the window's clock pauses), the tell (a cold dashed ring r 3.0 round the lever,
  `tellMaterial('radial', 3, COLD, COLD_DEEP, { cold: true })` with `uSweep` showing the time left, vfx.ts:545-560; the `window`
  event), `onCast`, the route into the arm, `siding` → `derailed` (open; the firebox door open, the core between a deep coal and
  `ENGINE.fireHot`, flickering at `flickerHz`, **never lighter than CORE**, INV-C1 of STAGE-B §2.4) → `backing` → `hold` → `run`;
  the lever mesh animating (`lever:<side>`); `board()`.
- main.ts `cast` hook and the bar's `board` (§2.6); hud.ts, style.css per §2.6.

**Done when:** the regression set passes; K-N4, K-N5, K-N6, K-N7 pass; the lead has screenshots of an open window (ring and board)
and a derail.

### C6. Steam and the cinder

- **Steam** (the SPEC §7.3 trigger, with this brief's aim): when `attack === 'none'`, awake and moving or holding, Still's centre within
  `steam.range` of its centre, not inside any of its not-done strips grown by 0.42, not behind it (`dot(Still − pos, fwd) ≥ −length / 2`),
  `gap` elapsed (seeded 6-9 s), and `ctx.canLock(trackMs + lockMs)`: book it, `steamTrack`. The aim follows
  `lead = Still + playerVel × (msLeft / 1000) × guess`, capped at `leadMax` from Still, turning no faster than the Arbiter's lance
  (`ARBITER.lance.turnRate` 6 rad/s, arbiter.ts:37); drawn as the Arbiter's tracking rails (`gaze`, `gazeWash`, arbiter.ts:284-286, `trackingDim`).
  At `trackMs` the lock: a strip from the engine's centre **at the lock** toward the aim, `len`, cut at the first solid in see mode
  (as `cutAt`, arbiter.ts:667-678), `halfW` 1.3, `armMs lockMs`, `liveMs`, `damage` 14, `source: 'steam'`, `cover: 'none'`, `hurt:
  'hazard'`, `owner`, `sparesOwner`, `cancelOnDeath` (not quiet: the hazard draws its own chevrons). It stays where it was cut; the
  engine moves on. `cue` `{ voice: 'windup' }`.
- **The guess** (arbiter.ts:622-629, moved from angles to straight lines): at the lock keep Still's position and velocity; at the arm,
  if `|vel| × lockMs/1000 ≥ guess.minMove`, his answer is `clamp(dot(moved, would) / |would|², −1, 1)`; keep the last `memory`; the next
  guess is one of them picked by its LCG. It starts at `guess.first` (1).
- **The cinder (the outrun rule):** `outMs` grows while it is awake and Still's centre is farther than `steam.range` from its centre,
  and resets to 0 when he comes within it or a cinder launches. At `outMs ≥ outrun.afterMs[phase2 ? 1 : 0]`, `attack === 'none'`,
  `cooldownMs` since the last, and `ctx.canLock(windupMs)`: book it, `cinderAim` (cue `{ voice: 'lob' }`): a ring r 1.6 on the floor at
  `Still + playerVel × leadS` (capped `leadMax`), stepped toward the engine out of anything solid (as `stepOut`, arbiter.ts:703-711),
  re-aimed every tick (as `leadAt`, arbiter.ts:680-701). At `windupMs`, launch from the chimney top: a circle hazard, `source: 'shell'`
  (so main's landing sound and dust, main.ts:685-691, are the Arbiter's), `armMs flightMs`, `liveMs 0`, `damage` 12, `cover: 'none'`,
  `hurt: 'hazard'`, `owner`, `flight: { x, y, z of the chimney, peak }`. It arcs over walls, as the Arbiter's shell does.
- `landsIn` (the jet's arm, the cinder's launch) and `windupMs` (950 / 620) for Combat and the windup voice.

**Done when:** the regression set passes; K-N8, K-N17, K-N18 pass, with K-N17's before/after numbers reported.

### C7. Phase 2

- At `hp < maxHp × phase2At`: `justPhase2` for one update, the `phase2` event; the reversal clock (seeded 8-12 s) and the first wagon
  (`firstS`) start.
- **Reversal:** due, and in `run` with no window open (else it waits for the window to close): `judder` 650 ms standing (sparks, the
  `judder` event); at its start `ctx.takeBack(this, h => h.spec.source === 'train')` (only unarmed ones go: the ones under and just
  ahead of it stay live); then `dir` flips, `hold` 1300 with the new horizon laid (INV-E2), `run`. The window schedule continues with
  the `b` arms (or `a` when it flips back). A window open when a reversal would start is never cut: the reversal waits.
- **The wagon:** when none is on the loop and it's due, pick the spur whose `onLoop` point is at least
  `speed × (lead + (tellMs + 1000 × 4 / wagon.speed) / 1000)` (33.8 u) ahead of the nose along its current path; of those, the one
  farther from Still; none: wait. Its tell: a `LaneTell` (lane.ts:116) with `trackWash = true` (no rail quads: §7) down the spur for
  `tellMs`, ending in a star on the loop; then it rolls at `wagon.speed`: one strip hazard along the spur, `source: 'wagon'`, `damage`
  12, `halfW` 1.2, `armMs tellMs`, `liveMs` the roll; it settles centred on `onLoop`, oriented along the loop straight: two
  `terrain.add` circles r `wagon.r` at ± `wagon.at` (terrain.ts:46). The frontier then ends at its near face (`takeBack` any unarmed
  strip past it). The engine's nose meeting it: `derailed` in place 1600 (open), the wagon smashed (circles `dead = true`, chunks,
  `wagonSmash`), then `run` (its forward strips laid in the derail's last 1300). The wagon's mesh: one tub of the rake (line.ts:329-334
  geometry, the `grate` material), no ember.
- **The lever thrown back:** at a window's close unthrown, in phase 2, with Still's centre inside that arm's strip grown by 0.8
  (`halfW + 0.8` of the arm's centre line, between junction and buffer): it throws it itself (the `throwBack` event, the lever
  animates); its frontier is at the junction then, so the arm is lit ≥ 1300 ms ahead as any rail.

**Done when:** the regression set passes; K-N10, K-N11, K-N12, K-N13 pass.

### C8. Death, the husk, `bossDown`

- engine.ts `hit` → dead: `state 'dead'`, everything unarmed of its own is cancelled by Combat (`cancelOnDeath`, combat.ts:1499).
- main.ts `bossDown` (:2488-2540): an Engine branch beside the Arbiter's (:2493-2502): `level.group.add(engineHusk(at.x, at.z, yaw))`
  and `combat.terrain.add` two circles r `husk.r` at ± `husk.at` along its axis; its drops step 1.9 u off the husk toward Still, as the
  Arbiter's do (:2497-2501). `toDark` (:2504) becomes `DAY_SPAN[run.depth]?.by === 'boss' && (RUN_DEPTHS === 9 || arbiter || engine)`.
  The tally (:2536) already counts `engines`.
- **Resume after its kill** (enterLevel, :2775-2778): the husk at `level.boss` (where it slept; the snapshot doesn't know where it died:
  §9), facing along its straight. `day.enter` (:2790) gains `|| boss?.kind === 'engine'` beside the Arbiter's test.
- The Engine's page is C9's.

**Done when:** the regression set passes; K-N14, K-N15, K-N21, K-N22 pass.

### C9. The dressing

- ambience.ts and main.ts `moodNow` per §2.8.
- audio.ts per §2.9; main.ts: an `engineBeat(ev)` beside `arbiterBeat` (:862), called from the enemy-event switch (:760-782); the
  `engineRun` loop started at `run`, stopped at `hold`/`judder`/`derailed`/`dead` and on a level change (as `rush`, main.ts:638, :703).
- notebook.ts and main.ts per §2.7. **stageb.mjs K-E10 is updated in this step** (a legitimate check change, reviewed): `pagesNow`
  (stageb.mjs:1793) reads `engine` too, and `chosen` (:1821) gains `engine: 'raging-hull'`, so "every other page stays where it was"
  (:1828) filters it out of the rams too; "off" (:1844, :1855) expects `engine: null`.
- The colours: K-E9c (§4). The lever ring is cold; the only ember is the firebox, the horizon, the steam and cinder tells, the wagon's tell.

**Done when:** the regression set passes (stageb with the updated K-E10); K-N19, K-N20, K-S5, K-E9c pass.

### C10. The whole stage, headless

No new game code unless a check finds a bug; fix it in the step it belongs to, and say which. Run every suite (baseline, fights, k9,
area3, home, stageb **with** K-T13, stagec), then K-N23 and K-Z1.

**Done when:** every check passes, and the lead has a table: check → result → one line, with K-N17's and K-N23's numbers, the `dist/`
delta against C0's figure, and the heard-log counts per sound over one scripted Engine fight.

---

## 4. Acceptance checks

Setup: `tools/checks/stagec.mjs`, lib.mjs's `suite()`. Queries:
- `ENG6`: `?depth=1&save=memory&line=1&engine=1` (6 depths): `enterEngine('III', 6, s)`.
- `ENG9`: `?depth=1&save=memory&roads=1&line=1&engine=1`: `enterEngine('III', 6, s)` (Line first) and `enterEngine('II', 9, s)` (Works first).
- `ARENA`: `?depth=1&save=memory&line=1&engine=1`, `__arena()`, `__spawn('boss', 9, 0, false, 'engine')` (the track round the origin).
- `OFF`, `ON`: stageb.mjs's.
- "Bot": Still's position set each tick (`__still.pos`), `playerVel` follows from the delta; HP put back to 100 each tick, the sum reported.
- "c", "away": the arena centre and the entrance axis (`__track().c`, and c − `__level().entrance`, normalised).

Every check also fails on any page error.

**Geometry (C1, C2)**
- **K-N1a.** `__makeTrack(0, 0, 'z')` and `(5, −3, 'x')`: the loop's vertices are SPEC §7.2's + c (± 0.01); `loopLen` 64.97 ± 0.05;
  the arms' junctions and buffers as `TRACK.arms` + c; levers as `TRACK.levers` + c; INV-K1; the spurs on the named axis.
- **K-N1b.** `ENG6` s 1..20: `__track()` exists and `c` is the exit room's centre; `spurAxis` is across `away`; `terrain.blocked` at each
  lever (pad 0.01) and each buffer; the inner walls blocked at c + (±6.5, 0), (0, ±6.5); every breakable's circle ≥ 1.8 + its r from
  every rail (`distToTrack`); the boss asleep at c + away × 9 (± 0.01), `dir` +1. `ENG9` both orders s 1..5: the same.

**The body and the run (C3, C4)**
- **K-N2a.** `ENG6` s 1..5: Still walked in along `away` from the entrance in 0.25 u steps: `state` leaves `asleep` on the first step
  with his centre within 16.5 of the body, never before; `unfold` for 1500 ms (± 17); the `whistle` event once.
- **K-N2b.** Then `run` at 1500 (± 17), and it moves; no window opens before `lap ≥ 1`.
- **K-N3.** `ENG6`, 30 s of phase 1, Still standing at c (autos off). For every Engine `'train'` hazard: `armedAt − madeAt ≥ 1300 − 1e-6`
  ms; every tick it moves, its nose point lies inside an armed, not-done strip of its own (grown 0.05); `damage === 20 × __combat.curve.bossDmg`.
  With no stop the loop start is passed every 5.91 ± 0.05 s. Separately: Still on unlit rail 1 u beyond the frontier is not hit in the
  next 0.5 s; Still standing on the loop ahead is hit once for that damage and shoved; the same lap's strips never hit him twice.

**Levers (C5)**
- **K-N4.** `ENG6`: windows open when the path distance to their junction is 29.7 ± 0.3, and last 1400 ± 17 ms when it runs through;
  they open at every 3rd junction passed, so their sides alternate; `__boss().board` is `` `${BOARD[side]} · ${BOARD.now}` `` while open,
  `` `${BOARD[side]} · ${n}` `` with n = the ceiling of the seconds to the next opening when ≤ 9, else `''` (read the words from `BOARD`,
  never literals); the hud's `#bossBar small` has that text and is hidden while open.
- **K-N5.** Still 2.5 from the open lever, outside both arm strips; `__fire('arms')`: `window.thrown`; the first strip laid past the
  junction lies on the arm's line; the centre stops at `arm.len − 0.6 − 1.5` (± 0.05) along it; `derailed` 1600 ± 17 with `open`
  true and `b.hit(10)` taking 15; then `backing` at 4 u/s to the junction, `hold` 1300 ± 17, `run` with the same `dir`. The same with
  `__fire('arms', true)` (pushed).
- **K-N6.** No throw: the autos on with the lever in reach; a cast from 3.2 u; a cast while no window is open; `__fire` while
  `__run.phase` isn't `'crawl'` (refused).
- **K-N7.** A wrong throw: Still on the arm's centre line 2 u short of its buffer (within 3.0 of the lever), `__fire('arms')`: hit for
  20 × bossDmg when he stays; a bot that walks 2 u off the line at the first arm strip's appearance: not hit.

**Steam, the cinder (C6)**
- **K-N8.** `ENG6`: a steam windup lasts 950 (250 + 700 ± 17); its strip is made at the lock with `armMs` 700, starts at the engine's
  centre at the lock, and with an inner wall between them ends at the wall (± 0.2); damage 14 × bossDmg; the cue is `'windup'`;
  consecutive steams are ≥ 6000 ms apart; none starts with Still behind it or inside its lit path.
- **K-N17 (circling at range can't trivially dodge it).** `ENG6` and `ENG9` (both orders), s 1..5, phase 1 held (boss HP put back),
  45 s each: bot **camp** stands planted at c; bot **circle** walks a circle of r 12 round c at 5.5 u/s (outside the loop, inside the
  walls). **FAIL** if either loses < 20 HP in 45 s on average ("trivially dodged"). INFO the means, and INFO the same bots with the NEW
  rules off (`guess.first = 0` and `outrun.afterMs = [Infinity, Infinity]` through the DEV-mutable `ENGINE`): the before/after, as the
  Arbiter's outrun fix was reported (HANDOVER 28 Sep: 0 → 60-108 at 8-10 u). Bot **dodge**: circles, and when a cinder ring or a steam
  strip exists it steps perpendicular out of it by the shortest way: **FAIL** if it is ever hit by a cinder or steam (the escape works).
- **K-N18 (the steam learns).** `ARENA`: Still walking a straight tangent line at 5.5 u/s within range: the first lock's aim point is
  ahead of him by `min(leadMax, 5.5 × 0.95)` ± 0.3 (guess 1). Then three locks where he stops dead at each lock: afterwards `guess`
  ≤ 0.5 and a stopped Still is inside the next strip. The same seed gives the same guesses twice (no Math.random).

**Phase 2 (C7)**
- **K-N9 (the INV sweep).** Scripted 120 s fights (a bot that throws every window it can reach, autos on, HP put back) on `ENG6` and
  `ENG9` both orders: every Engine hazard's `damage / dmgMul ≤ 22`; every windup ≥ 620; every hazard meets
  `armMs − 300 − 1000 × escape / 5.5 ≥ 150` (escape = halfW for a strip, r for a circle); HP at the start is `def.hp`
  (1170 / 1080 / 1170).
- **K-N10.** Below 55%: `justPhase2` for exactly one tick; the banner is `BOSS_COPY.engine.phase2`.
- **K-N11.** A reversal: 650 ± 17 ms standing; no Engine strip arms after the judder starts that was unarmed at its start; `dir` flips;
  `hold` 1300 ± 17 with every new strip's `armMs ≥ 1300`; a window open when it came due is not cut (the reversal waits).
- **K-N12.** A wagon: its LaneTell has `trackWash` and rail opacity 0 at every stage; its roll is a `'wagon'` hazard of 12 × bossDmg
  armed at 1200 ± 17; it settles on the loop (`terrain.blocked` at its centre); `frontierEnd === 'wagon'`; the engine meeting it is
  `derailed` 1600 in place with `open`, and after it the wagon's circles are dead. A wagon never rolls onto a point less than 33.8 u
  ahead of the nose.
- **K-N13.** Thrown back: in phase 2 a window closing unthrown with Still in the arm's strip grown by 0.8 throws it (the event, the
  route); with Still just outside it, nothing.

**Death and the run (C8)**
- **K-N14.** `__killBoss()`: a husk (`terrain.blocked` at its centre, two circles r 0.8), `__boss()` null, the bar gone; exits per
  `exitsAfterBoss` (`ENG6` warm; `ENG9` III at 6 cold + warm; II at 9 warm); `run.bossLoot.length === 2`; `run.tally.engines` counts each
  worn part once.
- **K-N15.** A non-dev commit after an Engine kill: each worn part's history `[7] === 1`, and its next drop's name ends
  `", that saw the Engine"` when it never saw an Arbiter (pool.ts:144-146's order: §9).
- **K-N16.** `ENG6`: `__flags({ engine: false })`, route III at 6: `__look().place === 'quarter'`, the boss an Arbiter; `__flags({ engine:
  true })`: `'station'` and an Engine; route II at 6: the Arbiter either way.
- **K-N21 (beams and the day, both orders).** `ENG9`: III at 6 after the kill: the cold beam at c and open, the warm open at
  c + side × 4.5, `__yardRoad().route === 'II'`, both beams ≥ 1.2 + 0.42 + 1.4 from every rail; the day unchanged by the kill
  (`__day()` before and after). II at 9: the warm alone; `__day()` at first dark on the kill's tick. `ENG6` at 6: warm alone, first dark.
- **K-N22 (resume).** A fresh context `?roads=1&line=1&engine=1` with `__setSave({ roads: ['II', 'III'] })`, K-93's walker (k9.mjs:481)
  to 6 on the Line-first road, kill, `__snapshot().bossFelled === true`, `page.reload()` (K-9C's pattern, k9.mjs:593-609): depth 6, no
  boss, the husk at `level.boss` (blocked), the beams open, the day as it was.

**The dressing (C9)**
- **K-N19 (the page, unmet-only).** `?line=1`: `__setSave(null)`: `__linePage('engine') === 'raging-hull'`, and the rams at 4-9 lose it
  from `__namesFor` (2 names left); with `raging-hull` met (no `r`): `'echo-shell'`, and the rams keep `raging-hull`; with it met as
  `r: 'engine'`: `'raging-hull'`. A non-dev Engine meeting writes that page with `r: 'engine'` and its felling counts `k`. The page's
  WHAT is `'the boss'`. `OFF`: `linePage('engine') === null`, `__namesFor` equals names.json.
- **K-N20.** `__look().ambience` and `__ambience()` after `__step(0.5)`: `'roundhouse'` in the Engine's level (`ENG6`, `ENG9` both);
  `'line'` at the stand-in's station (`?roads=1`, no engine flag), so stageb's K-E12 stays true.
- **K-S5.** Over one scripted fight (`ENG6`): the heard log has `horn` at unfold, `engineRun` while it runs, `pointsChime` per window,
  `latch` per throw, `ramCrash` per derail, `windup` + `scald` per steam, `lobAim` + `mortar` per cinder, `judder` per reversal, and no
  `aim` or `rev`.
- **K-E9c.** INV-C1 over one derail, sampled every tick: the firebox's HSL lightness never exceeds CORE's (0xff5a3c). The lever ring's
  material has `uCold === 1`. `HIDES.enamel` passes K-E9's rule (it already does).
- **K-E10 (updated, stageb.mjs).** As C9 says.

**The stage (C10)**
- **K-N23 (the fight, INFO).** `ENG9` both orders, s 1..5: a bot that walks to the next window's lever, casts when it opens (pushed when
  its part is cooling), punishes the derail with the autos and its parts, dodges cinders and steam as K-N17's dodger, and never stands on
  lit rail: kill time, HP lost, pushes, windows seen / thrown, derails, cinders, steams. INFO against SPEC §7.5's guess (85-100 s, ~5
  pushes). FAIL only past 240 s (it can't be killed as built).
- **K-Z1.** `dist/` ≤ 5,600,000 bytes; report the delta against C0's figure.

---

## 5. What needs Adrian's phone

**Headless (all of §4):** every rule, timing, placement, page, sound call and invariant.

**Phone only** (`?roads=1&line=1&engine=1`, both orders from one bookmark):
1. **The lit horizon** at 1.3 s: does a lit rail read as "it's coming here", round a corner, at phone size? (SPEC §1.6 risk.)
2. **The window against his real cooldowns:** can he reach a lever and throw it in 1.4 s, or is it always a push? Is every third
   junction (≈ 9 s at full speed, alternating sides) the right cadence? (§9.)
3. **The board** under the bar: readable without looking away? The words.
4. **Steam that leads him, and the cinder:** fair (a ring and a strip to read), or cheap? Is circling still an answer? (K-N17 says no.)
5. **The fight's length and shape** at 6 (Line first) and at 9 (the finale): does it feel like the last boss when it is?
6. **The derail** as the reward: does throwing a lever and hitting the stalled engine feel like the win it should?
7. **Phase 2:** the reversal's stand (650 + 1300 ms), the wagon's tell (chevrons, no rails), the lever thrown back.
8. **The look:** the enamel engine against the dusk, the firebox's red when derailed (not peach), the see-through, the husk.
9. **Every new sound** (none has ever been heard: headless has no audio). The `roundhouse` room tone.

---

## 6. Risks

1. **INV-E1 is the whole fight's honesty, and it's a new kind of hazard stream** (up to ~10 strips live at once, laid per tick, split
   at corners). The rectangles leave a small unlit wedge on the outside of each 45° corner (about 0.5 u): drawn = hit still holds, since
   the wash draws the same rectangles. K-N3 samples the nose every tick.
2. **One hit circle for a 3 u body.** Combat tests the Engine as a circle r 1.2 at its centre, as every boss. A strike at its nose or
   tail can miss. Watch it on the phone; the fix (a second hit point) touches Combat's targeting and is not in C.
3. **The holds are new standing time** (1.3 s after backing, 1.95 s per reversal): free damage at ×1 by design, but they lengthen the
   loop's rhythm and the board's estimates pause while it stands.
4. **The cinder is a new threat SPEC doesn't have.** It exists because SPEC's Engine never threatens a Still who stays inside the loop
   (the loop is 9-10.6 u from c, steam's range is 8). If he rejects it, K-N17 fails and circling at range is free again.
5. **The guess memory copies the Arbiter's logic** rather than sharing it (arbiter.ts stays untouched). Two copies of one idea; a later
   refactor could share it.
6. **`anchored` becomes dynamic** (a getter). Combat's spacing (combat.ts:36) and `pushOffBoss` (main.ts:4165) read it every tick, so it
   works, but "anchored" meant "never walks" before.
7. **`ctx.addHazard` is a second way to make a hazard.** It goes through the same `scaled` helper as the action, so the curve can't be
   missed; K-N3/K-N9 check `damage === base × bossDmg`.
8. **The notebook's Engine page on his real save:** with the ram pages likely met (rams have been named from band II at 4-5 since area
   II), it will be `echo-shell` on his phone, not `raging-hull` (§9).
9. **Download:** engine.ts, track.ts and the sounds are maybe 25-40 KB minified against ~218 KB of headroom (B8: 5,381,866).

---

## 7. Where the code differs from the older docs, and what this brief does

| the doc says | the code / this brief |
|---|---|
| SPEC §1.2.3, §7.1, K-N9: the Engine is 900 HP, "HP 900 at the start" | `bossFor` scales it by the curve (areas.ts:500): 1080 at 6 Line-first, 1170 at 9, 1170 in the 6-depth DEV run. K-N9 checks `def.hp`. |
| SPEC §7.4: every hit ≤ 22 | Before the curve. Bosses' hazards take `dmgMul` (combat.ts:629, :2808): 20 / 21 at 6 / 9 (CURVE9 §1), 24 in the 6-depth DEV run (DEPTH_CURVE_6[6].bossDmg 1.2). K-N9 checks `damage / dmgMul`. |
| CURVE9 §1: "The Engine's hazards read bossDmg" | True for a 'hazard' action already. The Engine's lit track needs many hazards a tick, so `ctx.addHazard` goes through the same `scaled` helper. |
| SPEC §7.2: roundhouse beams "warm only" | `exitsAfterBoss(6)` in a 9-depth run is cold + warm (areas.ts:136-138); the code's default beam spots (dungeon.ts:1789, :1800) already fit inside the loop. No change. |
| SPEC §2.1: station `ambience: { crawl: 'line', boss: 'roundhouse' }` | Stage B's K-E12 asserts the station reads `{ crawl: 'line', boss: 'line' }` (stageb.mjs:1995-1998), and the flag-off stand-in stands in the station. `moodNow` picks `'roundhouse'` by the boss's arena instead. |
| SPEC §2.4, §7.2-7.3: `Terrain.addCircle` | It's `terrain.add` (terrain.ts:46). |
| SPEC §2.6: `readonly anchored = null`, and a stop circle made solid while derailed | `anchored` is a getter: the radius while it stands (asleep, unfold, hold, judder, derailed, dead). One mechanism covers every stop, including the holds this brief adds; no terrain circles to pool. |
| SPEC §2.6: `ENGINE.length 2.6` | The model is the rake's engine (2.6, line.ts:320) at 1.15×: 3.0. The derail stop keeps SPEC's intent (the nose meets the buffer's face). |
| SPEC §7.3 / PITCHES: a lever window "every `lever.every` laps, alternating right and left" (SPEC), "every other lap" (PITCHES) | On this loop the right and left junctions of one direction are exactly half a lap apart (32.5 u). A window every lap is always the same side; alternating means every odd number of junctions. This brief: every 3rd junction (≈ 8.9 s at speed, alternating). SPEC risk 4's crossing (~32 u) then gets ~49 u of walking time. |
| SPEC §7.3: steam "toward Still's position at the windup's start" | Trivially dodged by anyone moving (he walks 5.2 u in 950 ms). NEW: 250 ms of aim with the Arbiter's lead guess, then 700 locked (slack 164). The owner's lesson from the Arbiter (HANDOVER 28 Sep). |
| SPEC §7.3: nothing reaches a Still who stays inside the loop or circles outside it | NEW: the cinder (the Arbiter's outrun rule, arbiter.ts:63-69). |
| SPEC §7.2: spurs fixed at (0, −13) → (0, −9) and (0, 13) → (0, 9) | The entrance side is random (`generateBossLayout`, dungeon.ts:363-370): on a ±z entrance a spur would run into the entrance mouth. The spurs lie on the axis across the entrance (SPEC's coordinates when the entrance is on x). |
| SPEC §7.3: wake when "Still's centre is 1 cell inside the arena" | Bosses wake by distance to their body (combat.ts:3005, radius 12.5 at :2816), which for a body on the far straight is past the centre. `Boss.wakeRadius`, 16.5: he has crossed the near rails. |
| SPEC §7.3: after a reversal "a new lit horizon grows ahead (1.3 s)" | Honest only if it stands while it's laid. INV-E2 makes that one rule for every start from standstill: unfold, a derail's end, backing's end (SPEC is silent there: it would drive onto unlit loop), a reversal. |
| SPEC §7.1: the firebox pulses `FIRE_HOT` | 0xff8a3c is the peach the hide rule forbids under ACES + bloom (hide.ts:3-9; the Handcar's stun seam was sent back for it, HANDOVER 29 Sep). Deep red 0xff3812 with a flicker, never lighter than CORE. |
| SPEC §7.3: the wagon's tell is "the ram's LaneTell" | That draws rail quads, and SPEC §1.2.5 says only a train lights rails. `trackWash = true`, as the Handcar's (lane.ts:139-144). |
| SPEC §7.3: steam, cinder: new hazard sources | Steam uses SPEC's `'steam'` (hazard.ts:21). The cinder uses `'shell'`, so main's landing sound and dust (main.ts:685-691) and the flight drawing are the Arbiter's. |
| SPEC §2.10: `raging-hull` becomes the Engine's page | The owner's B7 rule: only unmet pages move (notebook.ts:106-110). `LINE_DONORS.engine = ['raging-hull', 'echo-shell']`; `echo-shell` is never assigned (role `'reserved'`), so a boss is never unwritten. `ENGINE_DEF.roster` stays (K-90); main resolves the page. |
| SPEC §2.10: `RosterEntry.boss` gains `'engine'` | Not needed: the page's role is decided at run time (`roleOf`); the static roster stays as it is (names.json, K-E10 OFF). |
| SPEC §7.3 death: "the day snaps to 1 whenever `DAY_SPAN[depth].by === 'boss'`" | The 9-depth run already does (main.ts:2504); the 6-depth run snaps only for the Arbiter. `|| engine` there and in `day.enter` (:2790), so the Assembler fallback at 6 (`ARBITER_AT_6 = false`) stays as today. |
| SPEC §7.3: "the husk is by kind" on death | And on resume: the Arbiter's husk is raised from `level.footprint` (main.ts:2777); the Engine dies anywhere, and the snapshot has no field for it. Its husk stands where it slept (§9). |
| SPEC §11: "C2 … then flip `ENGINE_ON_LINE`", K-N16 in code | Out of scope: the flags flip together at go-live (BOTH-ROADS §5). K-N16 uses `__flags`. |
| SPEC §1.7, §11 fallbacks: "`ENGINE_ON_LINE = false` keeps the Arbiter at the end of the Line" | Only in a 6-depth run (areas.ts:419). In 9 depths it's the stand-in Assembler (areas.ts:506); BOTH-ROADS §2 already said so. |
| SPEC K-N: `?route=III&engine=1`, `__enter(6)` | The checks set `__run.route` (as stage B's do) and need `line=1` for the Line's pages; `?route=` still works in DEV (main.ts:82). |
| SPEC §2.6: `makeBoss(def, x, z, face, posts, track?)` | As SPEC, and `addBoss` gains `track` too (combat.ts:2805); `__spawn` builds one round the origin (main.ts:4630-4635). |
| SPEC §7.2: the arena is "the 28 u room" | Confirmed: `SIZE.arena` [3, 3] (dungeon.ts:29) is 7 × 7 cells of 4 u (dungeon.ts:311-315, :22). |

---

## 8. Could not verify

- How the Engine plays: none of it exists. The fight length (SPEC's 85-100 s is a guess), the push count, the Engine's cost in CURVE9
  (51.3 floor HP and its ratios are guesses), and whether 6 and 9 feel different enough. K-N23 measures a bot, not him.
- K-N17's thresholds (20 HP in 45 s) are a first pass; the Arbiter's after-numbers were 60-108 at 8-10 u.
- Any sound: nothing new can be heard headless.
- The look under ACES + bloom (K-E9c checks numbers, not the read), and whether the horizon reads at phone size.
- Whether his real save has met `raging-hull` (the save is on his phone). Likely yes: rams are named from band II at 4-5.
- That `hud.fireSlot` (hud.ts:917) always reaches `cast()` through `onFire` for K-N5/K-N6 (stage B's checks used `__fire` the same way).
- The per-frame cost of ~10 live strips and 48 quads on the Poco (should be small: the Line runs more).
- The `dist/` delta.

## 9. What Adrian must still decide or write

1. **Words (PLACEHOLDER):** the Engine's name on the bar (`ENGINE_DEF.name`; changing any `ENGINE_DEF` word re-captures K-90's `pure`
   record, reviewed); `openWord` 'derailed'; the phase-2 banner (main.ts:2432); the board's words (`BOARD`); the Engine's notebook line
   (its page's `line` is null); the ambience and sounds by ear.
2. **The Engine's page:** `raging-hull` when unmet, else `echo-shell` (reserved "for the Echo, later, maybe", notebook.ts:73). Or
   another page, or unwritten like the mender. Only `LINE_DONORS.engine` changes.
3. **The lever cadence:** every 3rd junction (default), every junction (≈ 3 s, alternating), or every 2nd (≈ 6 s, always the same side).
4. **The two NEW threats:** steam that leads him (the Arbiter's guess) and the cinder when he stays out of reach. Both exist so circling at
   range isn't free; either can go, at the cost K-N17 shows.
5. **The husk on resume** stands where the Engine slept, not where it died (a snapshot field would fix it; not worth a save change?).
6. **The named-part suffix:** with both bosses in every full run, "…, that saw the Arbiter" wins (pool.ts:144-146). Swap the order, merge,
   or leave (BOTH-ROADS §1 G).
7. **Going live:** `BOTH_ROADS`, `LINE_ENABLED` and `ENGINE_ON_LINE` together, after the phone list (§5), on his word.
