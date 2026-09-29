# Stage B: the Line's bodies (build brief)

29 Sep 2026. The build brief for stage B of `design/area3/BOTH-ROADS.md` §5. A coding agent follows it
step by step (B0 to B8). The lead reviews each step against its "Done when" list. Every file:line cited
here was checked against the tree at ba443ce. **Where this brief and the older docs (SPEC.md, BOTH-ROADS.md,
LINE-RULES.md) disagree, this brief follows the code, and §7 lists each case.**

Every player-facing word stays PLACEHOLDER, because the words are Adrian's to write. Do not commit, and
do not run `npm run dev`: `vite.config.ts` sets `server.host: true`, which binds 0.0.0.0 (HANDOVER
29 Sep says no dev server on the office network). Checks start their own vite on 127.0.0.1
(`tools/checks/lib.mjs` `startVite`, which asserts it).

---

## 1. Scope

Stage B gives the Line its own bodies and dressing, and settles how trains meet pressure bodies. Two of
its rules are **whole game** (Adrian accepted them 29 Sep, ba443ce) and go first, each as its own commit,
because they change the live 6-depth game and may be pushed on their own (on his word):

- **B1 = LINE-RULES R3.** Parry Clamp catches any tell in its cone, including a pressure body's cock
  (hulk), lens glow (sentinel) and rear (mite). Its snap aims at the tell.
- **B2 = LINE-RULES R8.** A pressure hulk's counter crouch starts only if `canLock(crouchMs)`, and books it.

Everything after B2 is **dark**: it only exists where the Line generates, which the shipped game never
does (`LINE_ENABLED = false`, `BOTH_ROADS = false`, route always `'II'`, areas.ts). DEV: `?roads=1`, and
`?line=1`, and the flag-off `__run.route = 'III'` path the checks use.

- **B3** the rules for trains and pressure bodies: R4 (commitment is a telegraph), R5 (no crouch on a lit
  strip), R6 (a train hits a body for `20 × curve.hp`, Still for a flat 20).
- **B4** the Signalman (SPEC §6.1) with R1 (the autos never break it), R2, R10.
- **B5** the Handcar (SPEC §6.2) with R1.
- **B6** Sleepers (SPEC §6.3) with R7.
- **B7** the dressing: the `line` ambience, the card's route, the notebook re-roles and `pageOf`, the hides.
- **B8** the whole stage, headless: every check, both orders, the trains' kill share with bodies, `dist/`.

R9 and R11 were built in stage R (dungeon.ts:1425-1430, :1454). The Line still ends in the stand-in
Assembler (areas.ts:507, `bossFor`); the Engine is stage C.

**Out of scope, do not build:**
- Flipping `LINE_ENABLED`, `BOTH_ROADS` or `ENGINE_ON_LINE` to true. Going live is its own stage, on his word.
- The Engine, `engine.ts`, the roundhouse arena, `ambience 'roundhouse'`, the `raging-hull` re-role, NAMED's
  Engine rule, `bossDown` generalised (stage C).
- The Porter, `PORTER_ENABLED`, the `porter` hide, the `drifting-frame` re-role, the station clock (stage D).
- Tuning: the curve at 7-9, `crawlBpm`, strain over 9 depths, `LINE.period`, the 3.0 step-off dial (stage T).
  B reports numbers; it changes no tuning value that isn't written here.
- The 150 ms Parry grace: it is built as a dial and **ships at 0** (LINE-RULES open question 2, his call).
- Every name, card line, notebook line and caption word (PLACEHOLDER, §9).
- SPEC.md / BOTH-ROADS.md / LINE-RULES.md / HANDOVER.md edits. Those are the lead's.

**The bodies' state machines** (SPEC §10.5, with this brief's additions in brackets):

```
Signalman  approach ─(reload done, a callable lane, canLock 900)→ windup 900 ─(call)→ recover 760 → approach   (reload 7000)
           windup ─(a push, a part, a kill; never the autos: R1)→ approach, reload 3000
           [lesson: approach ─(woken, Still within 14 u, canLock 900)→ windup → call, once: R10]
Handcar    approach (at its end) ─(Still on the siding ahead, lineClear, token, canLock 495)→ windup (track 495, lock 405)
           → strike (rush to the far buffer) → recover (stun 1200, then 400) → approach (at the other end), reload 1500
           windup (tracking) ─(a push, a part; never the autos: R1)→ broken as the ram's
Sleepers   asleep under the gravel (still, dark) ─(pack wakes)→ each mite rises 250 ms, 200 ms apart by angle → a pressure brood
```

---

## 2. Data contracts

### 2.1 `src/enemy.ts`

```ts
// Enemy (:152). variant widens (the PackSpec's union, dungeon.ts:116, minus the Porter's):
readonly variant?: 'lobber' | 'signal' | 'handcar'
/**
 * B1 (R3). A pressure body's own tell, the one thing nothing else may break: ms until its attack lands
 * (the hulk's cock, the sentinel's lens glow, the mite's rear), else null. Absent on bodies without one.
 * INV-T1: non-null only while `pressure` is true and the body is not in a counter's crouch.
 */
tellIn?: () => number | null
/**
 * B1 (R3). Parry Clamp caught its tell: the attack is spent, and its own clock restarts. `now` is Combat's
 * time; `graceMs` the dial (PARRY.graceMs); `reel`: pushed under the break rule. True if it caught one.
 * INV-T2: never true while tellIn() is null, unless graceMs > 0 and its tell ended ≤ graceMs ago.
 * INV-T3: never consumes Math.random (the K-90F traces of every other scenario must not shift).
 */
catchTell?: (now: number, graceMs: number, reel: boolean) => boolean

// EnemyCtx (:77) gains:
/** B3 (R5): (x, z) is inside a lit lane's strip, grown by LINE.halfW + r + LINE.stepOff.pad (Combat adds the rest). */
onLit?(x: number, z: number, r: number): boolean
/** B4: the Line, for the Signalman. Absent on a level without lanes. Times are the Line's clock (`t`), NOT ctx.now. */
line?: SignalLine
export interface SignalLine {
  readonly t: number
  readonly lanes: readonly LaneDef[]          // import type from './line' (type-only: line.ts imports values from here)
  lit(): readonly LaneDef[]
  nextAt(lane: LaneDef): number
  call(lane: LaneDef): boolean
}

// EnemyEvent (:106) gains:
/** B4: the Signalman's arm came down and its lane was called (`called` false: the Line refused, a train was already on it). */
| { kind: 'call'; e: Enemy; lane: number; called: boolean }

// Chaser (:388) gains, public:
/** B3 (R4): in a counter's crouch, its lunge, or the 900 ms open recover after it (the private `spent`, :408). */
get countering(): boolean   // this.crouch || this.lunge !== null || this.spent
```

`Chaser.tellIn()`: `this.pressure && this.cock >= 0 && !this.crouch ? Math.max(0, PRESSURE_HULK.cockMs - this.cock) : null`.

### 2.2 `src/combat.ts`

```ts
/**
 * B1 (R3): Parry Clamp's grace after a pressure tell ends (LINE-RULES open question 2). The dial, OFF:
 * 150 is the value to try if the phone says catching a 120-260 ms tell is a lucky tap. Mutable only for the DEV hook.
 */
export const PARRY = { graceMs: 0 }

/** B1 (R3): the body in reach whose tell (a windup a part may break, or a pressure tell) lands soonest; null: none. */
private tellAim(o: THREE.Vector3, def: AbilityDef): Enemy | null
//   over this.enemies: targetable, !held, awakeNow, inReach(o, e, def.range), !shaded(o, e);
//   t = this.breakable(e) ? e.landsIn() : (e.tellIn?.() ?? null); the smallest non-null t wins. No breakRule test.

/** B1: `tell` — a pressure tell caught (Parry), not a windup broken. Main must not count it as a broken lunge. */
private interrupted(e: Enemy, push = false, by?: AutoForm, tell = false)      // :2410; the event gains `tell: true`

/**
 * :1169. B4 (R1): a Line body's windup is a place tell. The autos never break it; a push, a part or a kill does.
 * INV-R1: breakable(e, true) is false for every e with variant 'signal' or 'handcar'.
 */
breakable(e: Enemy, auto = false): boolean
//   first line gains: if (auto && (e.variant === 'signal' || e.variant === 'handcar')) return false

/**
 * :1534. B3 (R4): a pressure body is committed only while it's moved or in a counter-move, never by phase.
 *   after the boss/thief line:  if (e.pressure) return held || e.knock.lengthSq() > 1.5 * 1.5 || (e instanceof Chaser && e.countering)
 * Telegraphed bodies (a crowned leader, a ram, a Lobber, the Signalman) keep the phase test, as built.
 */
static committed(e: Enemy, held: boolean): boolean

/** B4: every body out, as reset() takes them (:939-978's enemies, nests, packs, broods, mite batch), but the Line, terrain and breakables stay. For checks. */
clearBodies(): void     // reset() calls it for those lines (a pure move)

// make (:2615) and addPack (:2634) members gain the Line's fields:
{ kind; variant?: 'lobber' | 'signal' | 'handcar'; x; z; face?; slag?; siding?: SidingDef; lesson?: true }
// addPack's look (:2636): 'heap' | 'ballast'
```

### 2.3 `src/hazard.ts`, `src/line.ts` (B3, R6)

```ts
// HazardSpec (hazard.ts:24) gains:
/** On an enemy, this instead of `damage` (R6: a train hits a body for LINE.damage × the depth curve's hp). INV ≤ 22 is `damage`'s, on Still. */
bodyDamage?: number
// hazardTest (combat.ts:2555-2556): `const dmg = s.bodyDamage ?? s.damage; if (dmg > 0) { if (e.hit(dmg)) ... }`

// LineHost (line.ts:280) gains:
/** The depth curve's hp for this level's bodies (combat.curve.hp). */
readonly bodyMul: number
// Line.spawn (line.ts:602): bodyDamage: tr.lesson ? 0 : LINE.damage * this.host.bodyMul   (damage stays LINE.damage: Still's flat 20)
```

### 2.4 `src/signal.ts` (new, B4)

```ts
/** SPEC §6.1 numbers, unchanged, plus wakeMs (SPEC is silent on the reload at waking) and the R2 pad. */
export const SIGNAL = {
  hp: 20, bodyRadius: 0.45, height: 2.1, labelY: 2.5, speed: 3.0,
  preferMin: 7, preferMax: 11,
  windupMs: 900, callRange: 14, laneReach: 3.7,
  reloadMs: 7000, interruptedMs: 3000, recoverMs: 760,
  /** Reload at waking: a beat to see the post before its first call. NEW (brief's number, a dial). */
  wakeMs: 2000,
  /** R2: never calls a lane whose floor span is within LINE.halfW + bodyRadius + this of it. */
  standPad: 1.0,
}
/** The lamp at the top of its swell: deeper and redder than CORE, never pale (hide.ts header; the crouch's lesson, enemy.ts:361-365). */
const SIGNAL_HOT = new THREE.Color(0xff3812)

export class Signal implements Enemy {
  readonly kind = 'ranged'
  readonly variant = 'signal'
  constructor(x: number, z: number, lesson = false)
  // the Enemy surface as Ranged has it (ranged.ts), minus shots; landsIn() = windup ? timer : null;
  // interrupt(reel): windup only → approach (or recover with reel), reload = interruptedMs, emits nothing (Combat does)
  // update(dt, target, terrain, ctx): SPEC §6.1 behaviour; the call rule below
}
```

**The call rule** (in `update`, phase `approach`; `L` = `ctx.line`, `me` = its position):
- A lane `l` is *callable* when all hold: `L` exists; `this.reload <= 0`; Still's centre within `callRange` of
  `me`; `distToSpan(Still, l) <= laneReach`; `l` not in `L.lit()`; `L.nextAt(l) - L.t > LINE.signalQuietS`;
  and (R2) `distToSpan(me, l) > LINE.halfW + bodyRadius + standPad`.
- Of the callable lanes, the nearest to Still. Then only if `ctx.canLock(windupMs)`: `ctx.book(this, windupMs)`,
  phase `windup`, timer `windupMs`, `this.calling = l`.
- **R10, the lesson.** Constructed with `lesson = true` (main passes it for a G in a `lesson` pack): its first
  call, once, skips `laneReach` and `signalQuietS`, and its wake reload is 0. The lane is the one nearest its
  home (`distToSpan`). R2 still holds. After that call it is an ordinary Signalman.
- Windup end: `called = L.call(l)`; `ctx.emit({ kind: 'call', e: this, lane: l.id, called })`; phase `recover`
  `recoverMs`, then `approach` with `reload = reloadMs`.
- Movement in `approach`: the sentinel's band (ranged.ts:275-297) with SIGNAL's numbers, no strafing jitter
  from Math.random (a fixed 1.6 s strafe flip). It needs no line of sight to call. It steps off lit lanes by
  Combat's `stepOff` (committed from windup to recover end, as built).

**The body** (SPEC §6.1): a timber post on three short legs, in `hideMaterials('signal')` (hide.ts:135).
Primitives, merged per material: post box 0.22 × 1.5 × 0.22 from y 0.5; three legs (cylinders r 0.05,
0.6 long, splayed 25°, 120° apart); two iron straps (joint material); a semaphore arm 1.0 × 0.08 × 0.06
pivoting at (0.12, 1.8, 0), 0° at rest, rising to 60° over the windup; a lamp case 0.18³ at the arm's end
holding the lamp (a `MeshBasicMaterial`, `fog: false`). Lamp colour: `CORE_ASLEEP` asleep; `CORE` × 0.3 awake;
over the windup it lerps to `SIGNAL_HOT` and flickers once per ratchet click (6 over 900 ms), scale ≤ 1.3.
**INV-C1: the lamp's HSL lightness never exceeds CORE's (0xff5a3c), at any tick.** Sizes may move by eye; the
lead judges screenshots.

### 2.5 `src/handcar.ts` (new, B5); `src/charger.ts`; `src/lane.ts`

```ts
/** SPEC §6.2, unchanged. `speed` has no use (it never walks: §7). */
export const HANDCAR = {
  hp: 36, bodyRadius: 0.6, speed: 2.5, windupMs: 900, lockAt: 0.55,
  rushSpeed: 18, damage: 14, stunMs: 1200, stunMul: 1.5, reloadMs: 1500, tripRecoverMs: 1200,
  trigger: 0.6,
  /** Where it stands: this far in from a rail end (SPEC: ±(6 − 1.0) from the siding's centre). */
  inset: 1.0,
}
/**
 * A ram bound to a siding. A subclass, so every `instanceof Charger` path (the rush, the stun, trample, trip,
 * Anvil, countTells, the break rule) is the ram's, unchanged.
 * INV-H1: its position is always within 0.05 of the siding's line and between its rail ends.
 * INV-H2: its LaneTell draws no rail quads at any stage (trackWash).
 */
export class Handcar extends Charger {
  readonly variant = 'handcar'
  constructor(siding: SidingDef, end: 'a' | 'b')
  // update(): its own approach (below); windup/strike/recover through the ram's protected helpers.
  // present(): its own rig (below) and the LaneTell with trackWash; the ram's rig is built and hidden.
  // hoof/stackMouth/frontMid/hoofMid/rearMid/prowPoint/fireboxPoint: overridden to its own points.
}
```

- **charger.ts.** Widen from `private` to `protected` only what Handcar reads or overrides: `present` (:769),
  `cut` (:572), `startRush` (:588), `rushTick` (:604), `endRush` (:657), `staggered` (:226), `flash` (:227),
  `asleep` (:231), `grp` (:261), and the timer lines at the top of `update` (:444-452) moved into a
  `protected tick(dt)` that `update` calls first. **No behaviour change to the ram**: K-90F's F8/F10 prove it.
- **Its rig.** The Charger constructor builds the ram's rig as today; Handcar's sets `this.grp.visible = false`
  and adds its own group (~15 hidden meshes, 1-2 Handcars a level: no draw calls). SPEC §6.2's body: a deck
  1.3 × 0.35 × 1.7 on four wheels r 0.18, a see-saw pump lever (a 1.4 bar on a post, pivot at 1.0) and the ram's
  plough on the leading end, in `hideMaterials('handcar')` (new, §2.8). The ember seam runs along the lever
  (`CORE`); tracking rocks the lever at 3 Hz (the pump's clank); locked, the seam deepens toward 0xff3812 and
  flickers (INV-C1 holds for it too); stunned, the lever drops and the seam pulses as `reelCore` (enemy.ts:263).
- **Where it stands** (dungeon, B5): on its siding at the rail end farther from the entrance room's centre
  (`layout.rooms.find((r) => r.kind === 'entrance')!.center`), `inset` in, facing the other end.
- **Its approach.** Knock is projected onto the siding's axis before `slide`, and after every update its
  position is clamped to the siding segment (INV-H1). It winds up when: `reload <= 0`; Still's centre is within
  `hitHalf + trigger` of the siding segment from it to the far rail end; `terrain.lineClear` from it to the far end
  (pad `CHARGER.bodyLanePad`); `ctx.tokenFree(this)`; `ctx.canLock(windupMs × lockAt)`. Then as the ram (:498-509),
  except `aim` is the siding's direction toward the far end (it never follows Still) and `lane.nominal` is the
  distance to the far rail end + 1.0, so the lane is always cut by the far buffer's circle: `end === 'prop'`.
- **After the rush** it stands at the other end; recover as the ram, then `reload = HANDCAR.reloadMs`, facing back.
- **Combat.** `anchored` (combat.ts:34) is also true for a Handcar, so separation (:2945-2966) never moves it;
  `walkHome` (:2970) returns at once for a Handcar. If any other path moves `pos` directly, clamp there too;
  K-E6 will find it.
- **lane.ts** `LaneTell` (:116) gains `trackWash = false` (a plain field, set by Handcar's constructor). When
  true: tracking draws the core at 0.25 (chevrons toward the end) and no rails; locked and rush draw wash, core,
  cap and star as the ram's; `railMat.opacity` is 0 at every stage (INV-H2).

### 2.6 `src/swarm.ts` (B6)

```ts
/** SPEC §6.3, unchanged. */
export const BALLAST = { nestR: 0.8, nestGap: 0.5, stepMs: 200, patchR: 1.3, shiverMs: [1800, 3000] as const, hideY: -0.35, riseMs: 250 }

// Mite (:249) gains:
/** Under the gravel (look 'ballast'): `buried` too (still, never nips), but drawn, at y = hideY. */
sunk = false
// Brood (:919) gains:
/** Asleep under the ballast (look 'ballast'): its patch, and the mites sunk under it. */
ballast: Ballast | null = null
ballastIn(scene: THREE.Scene): void      // as bury (:1281): mites buried + sunk, the patch built; NOT scaled to 1e-4
```

- **The patch:** 40 instanced boxes 0.12-0.2 in `HIDES.sleepers.body`, in a disc of r `patchR` round the nest's
  centre. Placement and the shiver schedule come from a local LCG seeded by the nest centre
  (`Math.round(cx * 100) * 73856093 ^ Math.round(cz * 100) * 19349663`), never Math.random. The shiver: every
  1.8-3 s the chips jitter up to 0.02 in y for 300 ms. No ember while asleep (`coreColor` already returns
  `CORE_OFF` asleep, swarm.ts:615; `haloColor` 0).
- **Waking** (`rippleWake`, :1266): a ballast branch like the heap's (:1270-1276), stagger `BALLAST.stepMs` by
  angle. When a sunk mite's delay runs out: `unbury()` (:445) and its y goes `hideY → 0` over `riseMs` (in place
  of the heap's hop); emit `shed` as the heap does (:999). The patch stays, still, for the level.
- **Drawing:** `present` (:575): scale is `1e-4` only for `buried && !sunk`; y offset while sunk/rising.
- **The hide:** a second `MiteBatch` for Sleepers, built lazily by Combat on the first ballast brood.
  `MiteBatch`'s constructor (:681) gains `hide: 'mite' | 'sleepers' = 'mite'` (SPEC §2.8: +8 draw calls in those
  levels only). Combat routes a ballast pack's mites to it in `make`.

### 2.7 `src/dungeon.ts` (B4-B6)

- `LINE_BODIES` (:890): `signal` true at B4, `handcar` true at B5. `built` (:891) then passes G and K.
- B5, the Handcar's spot: in the member loop (:1552-1578), a member with `vars[i] === 'handcar'` takes the
  spot of §2.5 and `continue`s: **no `rand()` draws** for it. `members.push` (:1581) gives it
  `siding: line.sidings.indexOf(sd)` and `face` = the far rail end.
- B6 (R7): `mainPacks` (:1613) also requires `p.look !== 'ballast'`: Sleepers are never the elite pack.

### 2.8 `src/hide.ts` (B5, B6)

SPEC §2.8's two, verbatim, after `enamel` (:148):

```ts
/** The Handcar (area III): lead, matte, soft, a warm grey with a brown cast: lighter than the hulk's soot, duller than the sentinel. Fallback: body 0x3d3936. */
handcar: { body: 0x44403d, joint: 0x232120, rough: 0.7, metal: 0.55, jointRough: 0.6, jointMetal: 0.5,
  finish: { scale: [3, 3, 3], grain: 0.1, roughVar: 0.15, tone: [0.85, 0.83, 0.8], mask: 0.62, toneRough: 0.1, toneMetal: -0.1, bump: 0.15 },
  jointFinish: GRAIN_ONLY },
/** Sleepers (area III): slate, dull and layered, a warm near-black (never blue-grey). Fallback: body 0x34302b. */
sleepers: { body: 0x2f2e2b, joint: 0x1b1a19, rough: 0.95, metal: 0.1, jointRough: 0.65, jointMetal: 0.45,
  finish: { scale: [10, 3, 10], grain: 0.18, roughVar: 0.1, tone: [1.2, 1.18, 1.12], mask: 0.6, toneRough: -0.1, toneMetal: 0.05, bump: 0.35 },
  jointFinish: GRAIN_ONLY },
```

### 2.9 `src/notebook.ts`, `main.ts` `pageOf` (B7)

```ts
// RosterRole (:15) gains 'signal' | 'handcar' | 'sleepers'. WHAT (:163) gains them: PLACEHOLDER words.
/** SPEC §2.10's first three re-roles (the Engine's and the Porter's wait for stages C and D). */
export const LINE_PAGES = { signal: 'signal-jammer', handcar: 'iron-crawler', sleepers: 'conduit-spider' } as const
/**
 * INV-N1: while off, every roster lookup is exactly today's (namesFor, WHAT, the pages' order). main sets it once at
 * boot: on when the Line can generate (flag('line') || RUN_DEPTHS === 9 || ROUTE_PARAM === 'III'), off otherwise,
 * so the shipped game's names never change (K-E10 OFF).
 */
export function setLinePages(on: boolean): void
/** A page's role and band now: the Line's role and band 'any' for a LINE_PAGES id while on; its own otherwise. */
export function roleOf(r: RosterEntry): { role: RosterRole; band: RosterEntry['band'] }
// namesFor (:105-110) and main's notebookPages (main.ts:1936, `WHAT[r.role]`) read roleOf.
export const SIGNAL_PAGE: RosterId, HANDCAR_PAGE: RosterId, SLEEPERS_PAGE: RosterId   // = LINE_PAGES' ids
```

`pageOf` (main.ts:1901-1905) gains, before its `return undefined`: `variant 'signal'` → `SIGNAL_PAGE`,
`'handcar'` → `HANDCAR_PAGE`, a swarm whose `pack.brood?.ballast` → `SLEEPERS_PAGE`.

### 2.10 The card, the ambience, the sounds (B4-B7)

```ts
// cards.ts:21. caption's Pick gains 'route'. PLACEHOLDER words, Adrian's:
const ROUTE_WORD: Record<RouteId, string | null> = { II: null, III: 'the Line first' }
//   `${d} ${MONTHS[m - 1]} · ${END_WORD[c.end]} · depth ${c.depth}` + (c.route && ROUTE_WORD[c.route] ? ` · ${ROUTE_WORD[c.route]}` : '')
// INV-K1: a card without `route` captions exactly as today.

// ambience.ts:27: AmbienceMood gains 'line'. areas.ts: sidings (:356) and station (:384) → { crawl: 'line', boss: 'line' }.

// audio.ts (DEV only, B4):
/** Every call of a stage-B sound, and of aim / rev, in order: a headless page's AudioContext never runs (live(), :273), so this is the proof a sound fired. */
export const heardLog: { name: string; live: boolean }[] = []
function heard(name: string): void      // import.meta.env.DEV only; first line of each function below, before live()
```

New sounds, synthesized Web Audio like the rest (no file, K-S4):

| fn | when | sketch (first pass; his ear decides) |
|---|---|---|
| `semaphore(ms, pan, gain): (hard?) => void` | the Signalman's windup voice | 6 ratchet clicks over `ms` (a short bandpassed noise tick each, 2.2 kHz, rising 5% per click) over a low lamp hum; stop(true) cuts dead like `crouch` (:2091) |
| `pump(ms, lockAt, pan, gain): Voice` | the Handcar's windup voice | a clank at 3 Hz (lowpassed square, 180 Hz, 40 ms) until `lockAt`, then `latch` |
| `latch(c, p, when)` (private helper) | the lock | the ram's latch, factored out of `rev` (:699) unchanged; `rev` calls it |
| `gravelRise(pan)` | a Sleeper rising (`shed` on a ballast brood) | 120 ms of highpassed noise, crunchy (a few random-gain grains) |
| ambience `railTick`, `farShunt` | the `line` mood's one-shots | a cooling rail's metallic tick (sine 2.4-3.2 kHz, 30 ms decay, 2-5 in a run, every 6-12 s); a far buffer knock (the existing `metalHeavy` sample at rate 0.35-0.4, lowpass 400 Hz, mostly air-room send, every 18-30 s, a second knock 0.6 s later 1 in 3) |

The `line` mood (ambience.ts): open air like `quarter` (`roomOf` :240 → `airRoom`; no drips, no clanks, no
foundry; the draft band and hum at the quarter's values, :502-506) with `railTick` and `farShunt` in place of
the curtain and the far-off door (:429-440).

### 2.11 DEV hooks (`src/main.ts`, inside `if (import.meta.env.DEV)`, :4370)

```ts
__parryGrace: (ms?: number) => number                     // B1: sets PARRY.graceMs if given; returns it
__isCommitted: (e: Enemy) => boolean                      // B3: Combat.committed(e, held)
__emptyLevel: () => void                                  // B4: combat.clearBodies() on the level entered
__heard: sfx.heardLog                                      // B4
__handcar: (i = 0, end?: 'a' | 'b') => Enemy              // B5: a Handcar on combat.line.sidings[i], awake
__ambience: () => AmbienceMood                             // B7: the mood the frame loop last passed to updateAmbience
__caption: (c: { date: string; end: EndingKind; depth: number; route?: RouteId }) => string   // B7
// widened: __spawn's variant (:4464) + 'signal'; __pack's look (:4391) + 'ballast'; __pack/__spawn members + lesson
```

---

## 3. Steps

Each step ends with all of these, in order:
- `npx tsc --noEmit -p .` clean; `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → PASS K-90 (and K-90L, unless the step says it changes);
- `node tools/checks/fights.mjs compare` → PASS K-90F (B1 and B2 name the scenarios allowed to differ);
- `node tools/checks/k9.mjs` and `node tools/checks/area3.mjs` → all PASS (stage R and A stay true);
- the step's own checks: `node tools/checks/stageb.mjs <ids>` → PASS.

A step that fails any of these is not done. Suggested commits (the lead's call): B0 (tools only), **B1 alone,
B2 alone** (whole game, pushable on his word), then B3-B8 in one or more commits, all dark.

**Why K-90 cannot prove B1 or B2.** K-90 (baseline.mjs) records generation, pure lookups and each level's
entered metadata (:21-86). It steps no fight. R3 and R8 change combat only, so K-90 stays PASS unchanged
through B1 and B2: that proves they touched nothing else. **K-90F (B0) is the fight baseline** that proves
"the game is unchanged except the named behaviour", and the K-W checks prove the new behaviour.

**Why K-90 does change later.** K-90 records the flag-off page's route-III depths 4-5 (`gen.III`,
`genLookHash.III`, `genLineHash`): that is the Line, a DEV-only path the shipped game never takes. B4-B6 change
it (the Signalman and the Handcar enter their rows, R7 moves the elite pick). B0 splits those paths out as K-90L.

### B0. The fight baseline, the names baseline, K-90L (no `src/` change)

- `tools/checks/fights.mjs capture|compare [--may-differ F5,F9]` → `tools/checks/baseline/fights.json`.
  One page, `?depth=1&save=memory`. First `__hold(true)` (main.ts:4638: the frame loop stops simulating).
  Each scenario runs in **one** `evaluate`: seed `Math.random` with mulberry32(seed) (restored in `finally`),
  `__arena()`, `__combat.time = 0` (combat.ts:401), set `__combat.pressure` / `__combat.counters`, spawn, then
  `__step` in 1/60 s ticks. Every 0.5 s record `{ lost: HP Still lost in the window (read before each tick's reset to 100), still: [x, z], e: [[x, z, hp, phase], ...] }`
  (numbers rounded to 1e-3), and at the end the counts by kind of `__partLog` and `__enemyLog` events. Seeds 1..5.

  | id | setup (Still at the origin, hp reset to 100 each tick so no ending triggers) | secs |
  |---|---|---|
  | F1 | 3 pressure hulks at r 3, the close strike on | 20 |
  | F2 | 2 pressure sentinels at r 7, planted (the eye on, stick at rest) | 20 |
  | F3 | a pressure brood (`__pack` 6 × swarm, awake), the close strike on | 20 |
  | F4 | 1 pressure hulk, counters on, the close strike on | 20 |
  | F5 | 1 pressure hulk with counters + 1 ram (awake, at 6 u), the close strike on | 30 |
  | F6 | Parry Clamp equipped, cast whenever its button is ready (read `__hud.slots`), vs 3 pressure hulks | 20 |
  | F7 | Parry Clamp, cast when ready, vs 1 elite hulk (`__spawn('chaser', 0, 2.2, true, 'plated')`) | 20 |
  | F8 | 1 ram at 6 u, the close strike on | 20 |
  | F9 | 1 elite sentinel (non-pressure: it books its lock) at 8 u + 1 pressure hulk with counters, the close strike on | 30 |
  | F10 | Parry Clamp, pushed (`__fire('arms', true)`) the first tick a ram at 6 u is tracking | 10 |

  `compare` deep-equals each scenario. PASS when every scenario **outside** `--may-differ` is equal; for each
  listed one it prints `INFO K-90F: Fn equal` or `INFO K-90F: Fn differs at <path>`. Exit 1 on any unlisted diff.
- `tools/checks/baseline/names.json`: from the `OFF` page, `__namesFor(kind, d).map((r) => r.id)` for kind
  chaser/ranged/charger/swarm × d 1..9, and `WHAT` as `__roster()` shows it. `stageb.mjs` K-E10 compares it.
- `baseline.mjs`: `LINE_PATHS = gen.III.4, gen.III.5, genLookHash.III.4, genLookHash.III.5, genLineHash`.
  `compare` prints `PASS|FAIL K-90` over every other path and `PASS|FAIL K-90L` over those; it exits 1 on a K-90
  fail, or on a K-90L fail without `--line-changed`. New mode `capture-line` rewrites only `LINE_PATHS` in
  `flagoff.json` (the rest byte-identical). Nothing else in baseline.mjs changes.
- `tools/checks/stageb.mjs`: the suite, on lib.mjs's `suite()`. B0 registers no checks.
- `npx vite build` at the untouched tree; record `dist/` bytes (the K-9D INFO line). BOTH-ROADS' 5,352,326 is
  older; `dist/` on disk (13:54, before 98e4121) measures 5,355,174.

**Done when:** `fights.mjs capture`, then `compare`, PASS; a second capture from a **new process** is
byte-identical (if not: report which fields drift, and round or drop them, lead's call); `baseline.mjs compare`
prints PASS K-90 and PASS K-90L; `capture-line` on the untouched tree leaves `flagoff.json` byte-identical;
`names.json` exists; the `dist/` bytes are reported.

### B1. R3: Parry Clamp catches any tell (whole game)

- **enemy.ts:** `tellIn` / `catchTell` on the interface (:219-221) per §2.1. `Chaser` (:388):
  - `tellIn()` per §2.1; `countering` getter (used from B3, harmless now).
  - `catchTell(now, graceMs, reel)`: in the tell (`tellIn() !== null`): `cock = -1`; with `reel`: phase
    `recover`, `timer = CHASER.recoverMs`, `reel = 0` (as `interrupt(true)`, :548-550); without: phase `recover`,
    `timer = PRESSURE_HULK.recoverMs`. Return true. Grace: keep `tellEnd` (ctx.now at the tick the cock became
    a strike, :629-631); if `graceMs > 0 && now - tellEnd <= graceMs / 1000 && (phase === 'strike' || phase === 'recover') && !this.lunging`,
    the same, and return true. Else false.
- **ranged.ts** `Ranged` (:77): `tellIn()` = `pressure && cock >= 0 ? PRESSURE_SENTINEL.cockMs - cock : null`.
  `catchTell`: `cock = -1`; with `reel`: phase `recover`, `timer = RANGED.recoverMs`, `reel = 0`; without:
  `reload = PRESSURE_SENTINEL.reloadMs` (1300). Grace: `tellEnd` at :308-312; inside it, also `burst = 0`.
- **swarm.ts** `Mite` (:249): `tellIn()` = `pressure && nip >= 0 ? PRESSURE_MITE.tellMs - nip : null`.
  `catchTell`: `nip = -1`, `rest = PRESSURE_MITE.cycleMs` (no jitter: INV-T3); a mite has no reel. Grace:
  `tellEnd` set in `nips` where the tell ends (:1186); inside it, the mite's dart is not undone.
- **combat.ts**, the arc case (:1972-2031):
  - after `threat` (:1994): `const tell = parry ? this.tellAim(o, def) : null`, and `snap = tell ?? threat ?? this.prefer(o, def, snap)` (:1995).
  - in the loop (:2007-2016): `const winding = e.phase === 'windup'` stays; then
    `if (parry && !e.dead) { const reel = ctx.pushed && this.breakRule; if (winding) { if (e.interrupt(reel && this.breakable(e))) { shove; this.interrupted(e, reel && this.breakable(e)) } } else if (e.catchTell?.(this.time, PARRY.graceMs, reel)) { this.shoveFrom(e, o.x, o.z, parry.shove); this.interrupted(e, reel, undefined, true) } }`.
    The windup branch is today's behaviour exactly.
  - `PARRY`, `tellAim` per §2.2; `interrupted` (:2410) gains `tell` and puts `tell: true` on the event.
- **parts.ts:181** the interrupt event gains `tell?: boolean`.
- **main.ts:**
  - the interrupt handler (:429-447): the broken-lunge count (:433-437) only when `!ev.tell`.
  - DepthStats (:1417-1422) gains `catches?: { hulk: number; sentinel: number; mite: number }`, initialised at
    :2646 beside `lunges`, and counted in the handler when `ev.tell` (by `ev.enemy.kind`).
  - hook `__parryGrace`.
- **abilities.ts:308**, Parry Clamp's `line`: unchanged text, with `// PLACEHOLDER (LINE-RULES R3): his words; this one no longer says what it does`.

**Done when:** K-90 PASS; `fights.mjs compare --may-differ F6` PASS (F6 is expected to differ; report it);
K-W3a, K-W3b, K-W3c pass; K-W3d reports its numbers and passes its two FAIL lines. Then `fights.mjs capture`
(the new game is the baseline from here), and the lead reviews the F6 diff before accepting.

### B2. R8: the crouch books its lunge (whole game)

- **enemy.ts:614**: the crouch condition gains `&& ctx.canLock(COUNTER_HULK.crouchMs)`, and its block (:615-622)
  `ctx.book(this, COUNTER_HULK.crouchMs)` first. The booked moment is the lunge's start (the crouch's end, :655).
  If canLock fails, `bandT` stays ≥ `bandS` and it tries again next tick.
- Nothing else: a broken crouch already unbooks (`interrupted` → `book.unbook`, combat.ts:2411), and so does a
  death (:1447) and a new level (`reset` → `book.clear`, :979). A hulk held by the clamp through its booked moment
  leaves a lock no lunge uses: harmless (it only delays others by BOOK_GAP).
- The COUNTER_HULK doc comment (:343-356) gains one line: "The crouch books its lunge (LINE-RULES R8), so it
  never lands within BOOK_GAP of a ram's, a sentinel's or a train's lock."

**Done when:** K-90 PASS; `fights.mjs compare --may-differ F5,F9` PASS (report which differ); K-W8a, K-W8b pass.
Then `fights.mjs capture`, lead reviews.

### B3. Trains and pressure bodies: R4, R5, R6 (dark: the Line only)

First, **before editing**, run `node tools/checks/stageb.mjs K-T13` once on the B2 tree and keep its numbers
(INFO: BOTH-ROADS §2 asks for the trains' kill share measured first).

- **R4.** `Combat.committed` (combat.ts:1534-1542) per §2.2. Update its doc comment (:1530-1533). `stepOff`
  (:1549) is unchanged. Only `stepOff` calls `committed`, and only with a lit lane, so no arena fight changes.
- **R5.** `EnemyCtx.onLit` per §2.1; Combat's ctx (:503) gains
  `onLit: (x, z, r) => !!this.line?.nearLit(x, z, LINE.halfW + r + LINE.stepOff.pad)`. The crouch condition
  (enemy.ts:614) gains `&& !ctx.onLit?.(this.pos.x, this.pos.z, this.radius)`. A lunge that carries it onto a
  lit strip stays fair (LINE-RULES R5).
- **R6.** §2.3: `HazardSpec.bodyDamage`, `hazardTest` (combat.ts:2555-2556), `LineHost.bodyMul`, `Line.spawn`
  (line.ts:602), and main's `lineHost` (:2505-2512) gains `get bodyMul() { return combat.curve.hp }`.
- hook `__isCommitted`.

**Done when:** K-90 and K-90L PASS; K-90F PASS (nothing listed); K-T5, K-T13, K-T14, K-T15 pass; the K-T13
numbers before and after are reported side by side.

### B4. The Signalman (SPEC §6.1; R1, R2, R10)

- `src/signal.ts` per §2.4.
- **combat.ts:** `breakable` R1 line (:1171) for both variants (the Handcar's is proved in B5); `make` (:2615)
  builds `new Signal(x, z, !!m.lesson)` for `variant 'signal'`; `addPack` member type (:2635); the ctx gains
  `line` (a `SignalLine` view of `this.line`, or undefined); `countTells` (:3023-3036) unchanged (its train counts
  when committed); `clearBodies` per §2.2.
- **enemy.ts:** `variant` union (:156), `SignalLine`, the `call` event (§2.1).
- **dungeon.ts:** `LINE_BODIES.signal = true` (:890).
- **main.ts:**
  - enterLevel's member map (:2601) passes `variant` through for `'lobber' | 'signal' | 'handcar'` (the Porter's
    stays out), `siding: m.siding !== undefined ? level.sidings![m.siding] : undefined`, and
    `lesson: p.lesson && m.variant === 'signal' ? true : undefined`; `addPack`'s look is `p.look` (:2602).
  - `onWindup` (:574-600): before the charger branch, `if (e.variant === 'signal') { windups.set(e, sfx.asVoice(sfx.semaphore(ms, panOf(e.pos), windupGain()))); return }`.
  - the enemy-event handler: `call` → `windups.delete(e)` and a small ember spark at the lamp; nothing if `!called`.
  - `metalOf` (:138-142): `'signal'` → `debrisColor('signal')`. `tellBreak` (:1208-1227): a Signalman's tell
    shatters along its arm (4 sparks) before the `kind === 'ranged'` branch.
  - hooks `__emptyLevel`, `__heard`, `__spawn`'s `'signal'`.
- **audio.ts:** `heardLog` / `heard` (§2.10), `semaphore`; `heard('aim')` in `aim`, `heard('rev')` in `rev`.
- The line-level K-90L changes: run `baseline.mjs compare --line-changed`, then `capture-line`, and report the
  K-90L diff (the lead checks it's the G members and the draws after them, on route III only).

**Done when:** K-90 PASS, K-90L re-captured; K-90F PASS; K-E1, K-E2, K-E3, K-E4, K-E13, K-E14, K-E15, K-S2 pass;
k9's K-91 and K-98 still pass (they read the re-captured baseline).

### B5. The Handcar (SPEC §6.2; R1)

- `src/handcar.ts`, charger.ts's protected surface, lane.ts's `trackWash`, per §2.5.
- `HIDES.handcar` (§2.8).
- **combat.ts:** `make` builds `new Handcar(m.siding!, end)` for `variant 'handcar'` (the end: the one its
  member stands at); `anchored` (:34) and `walkHome` (:2970) per §2.5.
- **dungeon.ts:** `LINE_BODIES.handcar = true`; the spot and `siding` per §2.7.
- **main.ts:** `onWindup`'s charger branch (:592-595): a Handcar gets `sfx.pump(ms, HANDCAR.lockAt, pan, gain)`,
  not `rev`. The ram's banked smoke and stack embers (`rams`, :985) skip a Handcar. `metalOf`: `'handcar'` →
  `debrisColor('handcar')`. Hook `__handcar`.
- **audio.ts:** `pump`, and `latch` factored out of `rev` (§2.10).
- K-90L re-capture as in B4.

**Done when:** K-90 PASS, K-90L re-captured; K-90F PASS (F8 and F10 are the ram's regression guard for the
charger.ts refactor); K-E5, K-E6, K-E7, K-E16, K-S3 pass.

### B6. Sleepers (SPEC §6.3; R7)

- swarm.ts per §2.6; `HIDES.sleepers` (§2.8); Combat builds the second `MiteBatch` lazily and `addPack` with
  `look === 'ballast'` calls `brood.ballastIn(scene)` (beside `bury`, combat.ts:2665); `make` puts its mites in that batch.
- dungeon.ts R7 (:1613).
- main.ts: the `shed` handler (:724) plays `sfx.gravelRise` for a ballast brood instead of the heap's shed; hook
  `__pack`'s `'ballast'`.
- K-90L re-capture as in B4 (only R7's elite pick moves generation).

**Done when:** K-90 PASS, K-90L re-captured; K-90F PASS; K-E8, K-E17 pass.

### B7. The dressing: ambience, the card, the notebook, the hides

- ambience.ts `line` mood and its one-shots; areas.ts's two places' `ambience` (§2.10).
- cards.ts caption (§2.10).
- notebook.ts per §2.9; main.ts calls `setLinePages(...)` once at boot, before the first `assignNames`;
  `pageOf` per §2.9; `notebookPages` reads `roleOf`.
- hooks `__ambience`, `__caption`.

**Done when:** K-90 and K-90L PASS; K-90F PASS; K-E9, K-E10, K-E11, K-E12, K-S1, K-S4, K-Z1 pass.

### B8. The whole stage, headless

No new game code unless a check finds a bug. Fix it in the step it belongs to, and say which. Run every suite
(baseline, fights, k9, area3, stageb). K-93 (k9.mjs) walks both orders 1 → 9 through Line levels that now have
their bodies. Rerun K-T13 with the bodies in.

**Done when:** every check passes, and the lead has a table: check → result → one line, with K-T13's numbers
at B2, B3 and B8 side by side, the `dist/` delta, and the heard-log counts per sound over one scripted Line level.

---

## 4. Acceptance checks

Setup: `tools/checks/stageb.mjs`, lib.mjs's `suite()` (one page per query group). Short forms:
- `ARENA`: `?depth=1&save=memory`, then `__hold(true); __arena()`, Math.random seeded as B0.
- `LINE4`: `?depth=1&save=memory&line=1`, then `__run.route = 'III'; __enter(4, s)` (the flag-off Line, sidings).
  `LINE5` the same at 5 (station). `ON`: `?depth=1&save=memory&roads=1`.
- "pressure hulk": `__combat.pressure = true` before `__spawn('chaser', ...)`. "counters": also `__combat.counters = true`.
- "cast": `__fire('arms')`; "pushed": `__fire('arms', true)`. Parry Clamp: `__equip('parry-clamp')`.
- Still's HP is reset to 100 each tick in any check that fights longer than 5 s.

Every check also fails on any page error.

**Whole game (B1, B2)**
- **K-W3a (a caught tell, per body).** `ARENA`, Parry Clamp.
  - Hulk: a pressure hulk at (0, 1.6). Step until `e.tellIn() !== null`. Cast. Then: `e.tellIn() === null`,
    `e.phase === 'recover'`; it moved ≥ 2.0 u from where it stood (the 2.5 shove × knockMul); Still takes no melee
    from it in the next 300 ms; it doesn't cock again for ≥ 550 ms; `__partLog` has an interrupt with `tell: true`;
    `run.stats` at this depth: `catches.hulk === 1`, `lunges.broken === 0`.
  - Sentinel: a pressure sentinel at (0, 2.0). Step until `tellIn() !== null`. Cast. No shot is fired in the next
    400 ms (`__combat` shot count unchanged); its reload ≥ 1250.
  - Mite: a pressure brood (6) round (0, 1.8). Step until a mite in the cone has `tellIn() !== null`. Cast. That
    mite bites nothing (no `bite` enemy event with it as source in 300 ms); its `rest` ≥ 1900.
  - Pushed: the hulk case with `pushed`: `phase === 'recover'`, and `e.hit(10)` then lowers its HP by 15 (REEL ×1.5).
  - A plain part is not a catch: the hulk case with Frayed Cleaver instead: `tellIn()` runs to its strike.
- **K-W3b (the snap aims at the tell).** `ARENA`, Parry Clamp. Pressure hulk A at (0, 1.6); step until
  `A.tellIn() !== null`. In the same evaluate place pressure hulk B at (0, −1.4) (nearer, not cocking) and cast
  unpushed. A is hit and caught; B's HP is unchanged.
- **K-W3c (the grace dial).** `ARENA`, Parry Clamp, the K-W3a hulk. `__parryGrace()` returns 0. Step until A's
  tell ends (tellIn non-null → null), one more tick, cast: A is hit, not caught (phase unchanged by the cast).
  `__parryGrace(150)`, repeat: caught. `__parryGrace(0)` at the end. `grep -c "graceMs: 0" src/combat.ts` is 1.
- **K-W3d (Parry's job, LINE-RULES R3's balance check).** `ARENA`, seeds 1..40. Three pressure hulks at r 3-5
  (seeded), the close strike on, the bot casts its arms part whenever ready, 60 s cap. Once with Parry Clamp,
  once with Frayed Cleaver. Report: catches per fight, HP lost and time to clear (Parry / Cleaver).
  INFO against LINE-RULES' targets (0.8-2.0 catches; 15-30% less HP lost; 20-40% longer to clear).
  **FAIL only on** "too strong" (Parry clears faster **and** loses less HP than Cleaver, over the 40) or "dead"
  (< 0.3 catches per fight).
- **K-W8a (the crouch waits for the book).** `ARENA`, counters, a pressure hulk at (0, 2.2), the close strike
  off. Book dummy locks every 100 ms from +0 to +3000 ms (`__combat.book.book({}, ms)`). Step 3 s: no `counter`
  `crouch` event. `__combat.book.clear()`, then step ≤ 3 s until a crouch: at that tick the book holds an entry
  owned by the hulk at `time + 0.35` (± 1/60).
- **K-W8b (no lunge on another lock's beat).** `ARENA`, counters, seeds 1..10, 60 s: a pressure hulk at 2.2 and
  a ram at 6, awake, Still still. Every `counter` `lunge` event is ≥ BOOK_GAP − 1/60 s from every ram `lock`
  event (`__enemyLog` times), and there are ≥ 3 lunges over the 10 (else it proves nothing: FAIL).

**Trains and pressure bodies (B3)** (`ON`; step 4 = `__run.route = 'III'; __enter(4, s)`, step 7 = route `'II'`, `__enter(7, s)`)
- **K-T5 (rewritten, R4).** Over K-T13's bot A runs: no pressure body is uncommitted (`__isCommitted`) inside a
  lit strip (grown by its radius + 0.3) for more than 0.6 s at a stretch.
- **K-T13 (the trains' kill share, LINE-RULES §2).** Seeds 1..40 at step 4 and at step 7 (an env `SEEDS` may
  shorten it while iterating; the Done-when is 40). Every room lane (`__lanes()`, `kind 'room'`): Still on the
  lane's centre at its room's middle, that room's pack woken, the close strike and the planted shot on, 30 s
  cap. A kill is the train's when the body dies on a tick a train group hits it (`__trains()` `hit`). It is
  **free** when, for the whole second before, the body's knock speed stayed ≤ 1.5, it wasn't held, it wasn't
  countering, and it was a pressure body.
  - Bot A (never dodges): train share of kills ≤ 35% and free share ≤ 10% (FAIL past them; INFO "ok" at ≤ 25% / ≤ 5%);
    trains that kill ≥ 2 bodies in one pass ≤ 2 in 10.
  - Bot B (when a lane in the room lights, steers perpendicular to the nearer edge until clear of halfW + 0.62):
    train hits on Still = 0.
  - Bot C (Clamp Toss; after the horn, stick toward the lane, cast when a body is in reach): earned share,
    INFO (15-40% ok; < 10% names the 3.0 step-off dial for stage T).
- **K-T14 (R5).** `LINE4`, `__emptyLevel()`. A counter hulk on a room lane's centre, Still 2.0 u off the strip,
  its `bandT` set to 2; `__train(lane.id)`. While `__combat.line.nearLit(hulk, halfW + r + 0.3)` it never starts
  a crouch; once clear (it steps off), it crouches within 0.5 s.
- **K-T15 (R6).** `LINE4`, `__emptyLevel()`. An asleep hulk on a room lane's centre and Still on the same lane;
  `__train(lane.id)`, step 4 s. The hulk lost `20 × __combat.curve.hp` (± 1e-6); Still lost 20. The lesson lane's
  train does 0 to both (SPEC K-T10, unchanged).

**The Signalman (B4)** (`LINE4` or `LINE5`, `__emptyLevel()`, a room lane `L` with `nextAt − t > 4`)
- **K-E1.** Still 2 u from L's span, a Signalman awake 9 u from him and clear of L (R2). Within `wakeMs` + 0.5 s it
  enters `windup`; at the windup's end a `call` event with `called: true`, and L's train `t0` within 600 ms of it
  (the slip); `L.nextAt === t0 + period`.
- **K-E2.** No windup while L is lit; or `nextAt − t ≤ 4`; or Still > 14 u from it; or Still > 3.7 u from every
  lane; or < 7 s since its last call.
- **K-E3.** Parry Clamp cast into its windup: no call, it's back in `approach`, and its next windup is ≥ 3.0 s
  later. The same with `__breakRule(false)`.
- **K-E4.** Killed in its windup: no call, no train.
- **K-E13 (R10).** `LINE4` s 1..20: the generated lesson pack (`lesson` and a `signal` member): wake it with Still
  12 u away and 6 u from every lane. It calls once (its lane: the one nearest its home) even though laneReach
  fails; afterwards, with the same geometry, it never calls again in 15 s.
- **K-E14 (R1, the autos).** Still planted 9 u off (the planted shot on), then separately a Signalman within the
  close strike's reach: through its windup it takes the autos' damage and still calls. `breakable(e, true)` is
  false in its windup; `breakable(e)` is true.
- **K-E15 (R2).** A Signalman standing inside L's strip grown by 1.0: over 20 s with every other condition met,
  it never calls L.
- **K-S2.** At its windup start the heard log has `semaphore` and no `aim`.

**The Handcar (B5)** (`LINE4` s with a handcar siding; `__emptyLevel()`, `h = __handcar(i)`)
- **K-E5.** Still standing on the siding ahead of it: it winds up (lock at 495 ms ± 1 tick); it rushes to the far
  buffer, `lane.end === 'prop'`; stunned 1200 ms, taking ×1.5; it ends at the other end, facing back. Over 100
  rushes (Still stepping on and off), every one stuns.
- **K-E6.** INV-H1 at every tick over those 100 rushes, and while shoved by Piston, Rusted Hook and Clamp Toss
  (cast at it from every side), and with a pressure hulk pressed against it.
- **K-E7.** Its LaneTell's rail quads are at opacity 0 at every stage (INV-H2); every siding rail material has no
  tell; in every `__genLine(4|5, s)` s 1..20, no room holds a lane and a siding.
- **K-E16 (R1).** Planted on its rails in its planted-shot range, and in the close strike's reach: its tracking is
  never broken by the autos (`breakable(h, true)` false while tracking); Parry Clamp cast into its tracking breaks it.
- **K-S3.** Its windup start logs `pump`, its lock logs `latch`, and no `rev`.

**Sleepers (B6)**
- **K-E8.** `LINE4`, `__pack(6 × swarm round (0, 5), false, undefined, 'ballast')`: asleep, every mite has
  `sunk`, `group.position.y === BALLAST.hideY`, `coreColor` = `CORE_OFF`, halo 0. Still walks within 8 u: the
  rise starts are 0, 200, …, 1000 ms (± 1 tick), sorted by angle; each reaches y 0 in 250 ms; `gravelRise` is
  heard 6 times. With `?line=1`, a non-dev run (`__run.dev = false`), its page on first meeting is `SLEEPERS_PAGE`.
- **K-E17 (R7).** `LINE4`/`LINE5` and `ON` step 7, s 1..40: no pack with `look 'ballast'` has an elite.

**The dressing (B7)**
- **K-E9.** `HIDES.signal`, `handcar`, `enamel`, `sleepers` exist. None has a body colour with HSL saturation
  > 0.35 and hue 0-40°, or lightness > 0.45. INV-C1 over one Signalman windup and one Handcar lock: sampled every tick.
- **K-E10.** `?line=1`: `__namesFor(kind, d)` never contains a `LINE_PAGES` id, for every kind and d 1..9; every
  kind has ≥ 2 names per band **except rams in band I** (see §9: it has 1); meeting a Signalman, a Handcar and a
  Sleepers brood on a non-dev run writes their pages. `OFF`: `__namesFor` equals `names.json` for every kind and d.
- **K-E11.** `?line=1`, a non-dev run, `__run.route = 'III'`, at depth 4, `__end('home')`: the card has
  `route: 'III'` and its caption ends in `ROUTE_WORD.III`. `__caption({ date: '2026-09-25', end: 'home', depth: 3 })`
  is `25 Sep · home · depth 3` (INV-K1).
- **K-E12.** `__look().ambience` is `{ crawl: 'line', boss: 'line' }` at the sidings and the station, both orders;
  after `__step(0.5)` in a Line level `__ambience() === 'line'`; the Works and the quarter are unchanged.
- **K-S1.** A train: `__trainLog` has coming (t0), commit (+800 ± 17), arrive (+2000 ± 17), in order; never more
  than 2 hums at once (`__hums`).
- **K-S4.** `git diff --stat ba443ce -- public/sfx` is empty, and `git ls-files public/sfx | wc -l` is 52.
- **K-Z1.** `dist/` ≤ 5,600,000 bytes; `dist/kaykit` and `dist/textures` byte-for-byte the B0 build's; report
  the delta against B0's figure (SPEC §9's ≤ 400,000 for everything area III adds).

---

## 5. What needs Adrian's phone

**Headless (all of §4):** every rule, placement, catch, booking, kill share, page, caption and invariant.

**Phone only** (`?roads=1&line=1` from one bookmarked URL; the live build for B1/B2 once pushed):
1. **R3 by eye** (LINE-RULES open question 2): can he catch a 120-260 ms cock, glow or rear on purpose, or is
   Parry a lucky tap? If lucky, the dial is `PARRY.graceMs = 150`. Does the new unpushed aim ever turn the snap
   somewhere he didn't expect?
2. **R8:** does a crouch now and then come a beat later than he expects? (It should never read as a stutter.)
3. **R4:** do hulks drifting off the rails read as "they saw it too", or as dumb? (LINE-RULES open question 3.)
4. The Signalman's post raising its arm 7-11 u away in a crowd, at phone size: is the ratchet doing all the
   work? (Open question 1.) The lamp's swell against the no-flat-white/salmon rule.
5. The Handcar's tell never taken for a train's (SPEC §1.9 Q3, his call).
6. Sleepers' shiver on the dark floor at dusk (Line at 7), and in afternoon light (Line at 4, where R11 has none).
7. The `handcar` and `sleepers` hides in the graded game (SPEC §2.8's fallbacks are the first thing to change).
8. The `line` ambience and the four new sounds, heard for the first time (none has ever been heard: headless has no audio).

---

## 6. Risks

1. **K-90F's determinism** rests on seeding Math.random and freezing the frame loop (`__hold`). Not tried yet
   (§8). If two captures differ, B0 reports the drifting fields; rounding or dropping them is the lead's call.
2. **R3 changes Parry against windups too.** The unpushed snap now turns to the windup that lands soonest
   (LINE-RULES R3: "as the pushed aim already does"), not the nearest body. F7 (one heavy) can't show it; a
   crowded fight can. That is the accepted rule, but it is a change a player may feel.
3. **R3's catches go through `interrupted`**, so they unbook, play the break's sound and hitstop (`breakFx`,
   main.ts:1107) like a broken windup. That's the intent (the silence is part of the parry), but a lot of catches
   in a crowd is a lot of hitstop: watch it on the phone.
4. **R4 makes free train kills rare, maybe too rare** (bot C's earned share). The first dial is stage T's 3.0 step
   speed, not a B change.
5. **The Handcar subclass keeps a hidden ram rig.** Cheap, but a ram effect that reads a ram-rig point and isn't
   overridden would draw in the wrong place. K-E5's run is where the lead looks at screenshots.
6. **K-90L is re-captured three times** (B4, B5, B6). Each re-capture is reviewed as a diff; a re-capture that
   touches a non-Line path is refused by the tool itself.
7. **The notebook's re-roles are gated on the Line being able to generate.** A save that met Signal Jammer,
   Iron Crawler or Conduit Spider under the old roles keeps its counts, and the page's "what" changes under it
   once the Line is live (SPEC §1.9 Q4, never answered: §9).
8. **Ram band I keeps one name** once Iron Crawler is the Handcar's (§9).
9. **K-T13 is slow**: 80 levels × 3 bots × up to 30 s of game each. Expect minutes; `SEEDS` shortens iteration only.

---

## 7. Where the code differs from the older docs, and what this brief does

| the doc says | the code / this brief |
|---|---|
| Lead's brief for B1/B2: "K-90 flag-off baseline will legitimately differ" | K-90 records no fight (baseline.mjs:21-86), so R3 and R8 leave it PASS. B0's K-90F is the fight baseline that proves "unchanged except the named behaviour". |
| STAGE-R / BOTH-ROADS: K-90 is "flag-off equals the live game" | It also records the flag-off Line (route III at 4-5), which the live game never generates. B0 splits it out as K-90L, re-captured when B4-B6 change the Line's rows. |
| LINE-RULES R3: Parry breaks "a pressure body's cock, lens glow and rear" | None of those is a phase: the cock and glow are `approach` with a private `cock` (enemy.ts:624-637, ranged.ts:304-314), the rear is the mite's `nip` (swarm.ts:1183-1207). Parry tests `e.phase === 'windup'` (combat.ts:2007). Hence `tellIn` / `catchTell`. |
| COUNTERS / main.ts:433-437 | Every interrupt of a pressure hulk counts as a broken lunge. R3's catches would inflate `lunges.broken`, so the event carries `tell`. |
| SPEC §2.10, K-E10: "every archetype keeps at least two names in its band" | Re-roling `iron-crawler` leaves rams in band I with only `overload-core` (notebook.ts:43, :70). K-E10 excepts it; §9 asks him. |
| SPEC §2.10: five re-roles in B4 | Three in B (signal, handcar, sleepers). `raging-hull` (the Engine) waits for C and `drifting-frame` (the Porter) for D: re-roling them now only removes names. |
| SPEC §2.10: re-role the roster | Re-roling changes `namesFor`, so the **live** game's names would change. Gated by `setLinePages`, off in the shipped game. |
| SPEC §2.1: station `ambience.boss: 'roundhouse'` | `'roundhouse'` is stage C. B gives both Line places `{ crawl: 'line', boss: 'line' }` (the stand-in's station at 6/9). |
| SPEC §2.7: members carry `variant`, `look: 'ballast'` | main.ts:2601-2602 strips every variant but the Lobber's and every look but `'heap'`. B4 passes them through. |
| SPEC §6.2: "a Charger constructed with `{ siding }`" | The Charger builds the ram's rig unconditionally (charger.ts:280-339) and main reads ram-rig points (`stackMouth`, `hoof`, ...). A subclass with its own rig and the ram's hidden. |
| SPEC §6.2: `HANDCAR.speed 2.5` | Nothing moves it but its rush and shoves (it "doesn't chase"). Kept for the record, unused. |
| SPEC §6.2: it "stands on its siding at one end" | Which end isn't said. The one farther from the entrance room's centre, so it rushes toward where he comes in. |
| SPEC §6.1: the Signalman winds up when "its reload is done" | The reload at waking isn't said. `wakeMs: 2000` (a dial). |
| SPEC §6.1: `line.nextAt(lane) − now > signalQuietS` | `nextAt` is on the Line's clock (`Line.t`, line.ts:377, :441), not Combat's `time`. The ctx gives the Signalman `line.t`. |
| SPEC §6.1: "the windup voice for this variant" | `onWindup` (main.ts:597-598) would give any `kind 'ranged'` the sentinel's aim whistle. B4 branches first. |
| SPEC §5.8 / LINE-RULES R4: committed is "static" | `committed` is only read by `stepOff` (combat.ts:1556), so R4 is Line-only in effect, as LINE-RULES says. |
| LINE-RULES R5: "inside a lit strip" | `Line.nearLit(x, z, pad)` (line.ts:438) exists; the strip is grown by `halfW + r + stepOff.pad`, as `stepOff` grows it (combat.ts:1558). |
| LINE-RULES R6: "a train hits a body for 20 × curve.hp" | One hazard carries one `damage` for Still and bodies (hazard.ts:33, combat.ts:2555). Hence `bodyDamage`. |
| BOTH-ROADS §2: "Rewrite K-T5/K-T6" | No K-T check is in the repo (STAGE-R R9 ported only K-R/K-X). B3 writes K-T5 and K-T13-15 fresh; K-T6 (the brood rule) needs no change: pressure broods never read `nearLit` (swarm.ts:1057, :1072). |
| SPEC §12.2 K-S: "plays `semaphore`" | Headless, `live()` is false (audio.ts:273) and every sfx returns at once. The DEV `heardLog` proves a sound fired; only the phone proves it sounds right. |
| SPEC K-E9 lists `porter` | Stage D. K-E9 covers the four that exist. |
| SPEC §2.8: Sleepers' mites use "a second material set in MiteBatch" | Kept: a second `MiteBatch` with the sleepers' hide, built only when a ballast brood exists. |

---

## 8. Could not verify

- That the fights are deterministic under a seeded Math.random and `__hold(true)` (B0's double capture is the test).
- Any sound: nothing new can be heard headless, and no stage-B sound exists yet.
- The Signalman's and the Handcar's look, and INV-C1 under ACES + bloom (K-E9 checks the numbers, not the read).
- That `dist/` at ba443ce is 5,355,174: the build on disk predates 98e4121 (a CSS change). B0 rebuilds it.
- LINE-RULES' R3 estimates (22% cocking share, 22/39/53% catch odds) and R4's step-off timings: K-W3d and K-T13 measure them.
- Whether his real save has already met Signal Jammer, Iron Crawler or Conduit Spider (§6 risk 7): the save is on his phone.
- How long K-T13 takes to run.

## 9. What Adrian must still decide or write

1. **Parry Clamp's card line** (abilities.ts:308): today's no longer says what it does (R3). PLACEHOLDER.
2. **Iron Crawler as the Handcar's page** leaves the ram one band-I name (Overload Core: every ram at depths 1-3
   would be called that). Keep it, or give the Handcar another blank page.
3. **Re-roling pages he may have met** (SPEC §1.9 Q4, never answered): acceptable, or only unmet pages?
4. **Words:** the Signalman, the Handcar, Sleepers (names); the three WHAT words; the three notebook lines; the
   card's route word (`ROUTE_WORD.III`, and whether the caption should say anything now both roads are in every run).
5. **Push B1 and B2** to live, when he's played them (HANDOVER: push only on his word).
