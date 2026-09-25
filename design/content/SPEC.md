# SPEC: Area II (the commute, the Arbiter, more variety)

Written 25 Sep 2026 from `design/content/DESIGN.md` (settled), `PITCHES.md`
and the `1-*.md` / `2-*.md` rounds, against the code at `dafc55f` and the Home
spec (`design/meta/SPEC.md`), which is **built first**. Build this from §9.
Each step ends playable. Where this spec says "Home §x", it means that spec,
whose contracts are extended here and never redefined.

What was checked for this pass, not assumed:

- **KayKit filenames and sizes**, from the two repos' git trees
  (`KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0` and
  `KayKit-Furniture-Bits-1.0`, branch `main`). Bounding boxes were read from
  each file's `POSITION` accessors. Every piece still has a fallback (§4.2).
- **ambientCG IDs**, through its v2 API. All five exist.
- **The slack rule**, for every new tell (§5.4, §6). The balancer's rule is
  `slack = lockedMs − 300 − 1000 × escape ÷ 5.5`, with a target of ≥ 150 ms.
  Any new floor escape gets at least 900 ms.

---

## 0. Proposal

### Why

Every run fights the Assembler twice, walks one kit in two lights, and meets
four archetypes that are familiar by run 10. Home gives the run its shape (one
day, two areas, a night walk). Area II is the half of that day that has no
content yet.

### What changes

- **Depth 4 is the Works** at the end of the shift: plate floors, walkways,
  machinery in the fog, the foundry room tone and forge thump, and plate
  footsteps. Its mites sleep as **slag heaps**.
- **Depth 5 is the workers' quarter.** Broken furniture near the entrance,
  intact near the exit, tile and wood floors, door frames standing on the far
  side, and wood underfoot. Cover gets denser as you go, which the **Lobber**
  punishes.
- **Depth 6 is the Arbiter**, a lattice lamp tower in the quarter's square.
  Its ember wedge sweeps the floor, stops on Still, and fires a lance that
  walls block both ways. A lance that hits **heats** a button. After every
  lance the tower **vents** for 1.2 s. The light goes down with its HP, and
  stops at first dark.
- **The thief** can appear from depth 2. It takes a part off the floor and
  runs with it in a cold-lit cage.
- **Slag cores**: some area II enemies leave a burning puddle where they die.
- **The day moves with you.** The grade follows how far Still has got through
  each level, and in the Arbiter's fight it follows the boss's HP.
- **Foundations:** a `Boss` interface in place of the hardwired Assembler, and
  one floor `Hazard` primitive that carries slag, shells, lances and scald.

### Capabilities

| new | modified |
|---|---|
| `boss` interface (`Boss`, `makeBoss`) | `boss.ts` (the Assembler implements `Boss`) |
| `hazard` (`Hazard`, `HazardTell`, `SLAG`) | `combat` (hazards, boss-generic, the thief, variants, slag spill) |
| `arbiter` (the tower, its rig, the square's posts) | `areas` (`PlaceDef`, `lookAt`, `DAY_SPAN`, `first-dark`, `BossDef.kind 'arbiter'`) |
| `lobber` (sentinel variant) | `dungeon` (gen presets, progress, cover density, far side, heaps, square arena, thief nest, pack rows) |
| `thief` (never attacks) | `kit` (new pieces, fallbacks, `grate` role, `setSurfaces`, rim) |
| `day` progress (`DayTracker`) | `hud` (heat, boss bar), `swarm` (heap look), `loot` (`lift`) |
| | `audio` / `ambience` / `music` (plate, works, quarter, square, area II loop, anvil kit) |
| | `save` v2 (Arbiter tallies), `notebook` (four reserved pages go live) |

### Impact (files)

- **New:** `src/hazard.ts`, `src/arbiter.ts`, `src/lobber.ts`, `src/thief.ts`,
  `src/day.ts`, `src/machines.ts` (the Works' beyond primitives).
- **Modified:** `src/boss.ts`, `src/combat.ts`, `src/enemy.ts`, `src/dungeon.ts`,
  `src/kit.ts`, `src/areas.ts`, `src/main.ts`, `src/hud.ts`, `src/style.css`,
  `src/swarm.ts`, `src/loot.ts`, `src/audio.ts`, `src/ambience.ts`,
  `src/music.ts`, `src/world.ts`, `src/save.ts`, `src/notebook.ts`,
  `src/abilities.ts` (two card lines).
- **Assets:** 13 GLBs into `public/kaykit/`, 5 texture pairs into
  `public/textures/`, both `LICENSE.txt` files updated. **No new sound
  files.** Unused GLBs are deleted (§4.7).
- **`public/sw.js`:** unchanged from Home §5.11. Its activate step deletes only
  `still-action-*` keys. The build list picks up the new files by itself.

---

## 1. Design

### Context

After Home, a run is `RUN_DEPTHS = 6` with `bossFor(depth)` at 3 and 6, and
`areaOf(depth)` returns `AREAS[1]` for 4–6. `AREAS[1]` is a copy of area I.
`dayAt(depth, progress01)` exists and is always passed 0. `combat.boss` is
`Assembler | null`, and `main.ts` casts to `Assembler` in four places (the
windup voice, strike fx, ambient fx, the bar). Combat's wave loop reads
`BOSS.wave`, and `summon` reads `BOSS.summon.maxAdds`. Nothing on the floor
hurts anything by itself. `loadKit()` loads every piece at boot, and the SW
precaches the whole build (Home §5.11).

### Goals

1. Area II looks, sounds and plays unlike area I, with at most two new
   mechanics to learn (slag cores, the Lobber).
2. The last fight tests timing, cover and strain. The Assembler tests reading
   a body.
3. Nothing is stronger. There's no HP or damage by depth, the boss stays at 900
   HP, no hit is above 22, and no windup is under 620 ms.
4. Every tell is honest. Drawn = hit, walls block both ways, and every new tell
   meets the slack rule.
5. It stays inside the phone: about +1.4 MB, offline from the first install,
   and no new real lights.

### Non-goals

- The Gantry, the Viaduct, the Kiln's grates, slow water, the Ring Hulk, fences
  that stop bodies and not shots, and the Works' gutters, rollers and steam
  grates.
- Any boss made of you (the Echo), and named twists on old roster enemies.
- Difficulty modifiers.
- Anything for Yanah or Yuri. There's no cot, bed or toy in any list.

### The invariants, and how this spec keeps them

| invariant | here |
|---|---|
| Three terminal states | Unchanged. Nothing new ends a run; the lance kills through `hurtPlayer`, and heat reaches Stopped only through pushes, which go through `addStrain`. |
| The kept thing is always produced | Unchanged. `commit()` runs at the trigger (Home §4.12). The save v2 migration (§2.9) keeps every v1 card. |
| The commitment resource carries | Strain carries. Heat never adds strain by itself: only a push that the player chooses does. |
| Never trapped | Heat never takes a button away. A hot button always fires by push, and waiting 4 s frees it. The vent is a window, not a lock. No hazard spawns on a closed exit. The thief never stands in a beam. |
| The reward fork is binary | `exitsAfterBoss(6)` stays `['warm']`. The Arbiter's arena builds no cold beam mesh. |
| No empty save | Unchanged. The thief can only take a floor part, and floor parts at a beam were already lost by the existing rule. |

### Decisions (top 8)

1. **`Boss` is an `Enemy` plus six fields.** Those are `def`, `phase2`,
   `justPhase2`, `open`, `anchored` and `threats()`, plus two presentation
   hooks. The Assembler gets them as getters over its own fields, so its
   behaviour is untouched. *Why:* main and combat only need these, and the
   Assembler checks stay green.
2. **One `Hazard` primitive, owned by Combat.** It shows a telegraph, arms
   once, stays live for a set time, and hits each body at most once. It hurts
   Still and enemies alike, and a hazard kill never spills another hazard.
   Shapes are a circle or a pre-cut strip. *Why:* slag, the Lobber's shell,
   the Arbiter's lance, shell and scald are all one rule, so they read alike.
3. **Per-depth *places* under the Home areas.** `PlaceDef` carries the look,
   sound and generator knobs. `lookAt(depth)` picks one ('ruin', 'works',
   'quarter'), and `AreaDef` keeps its role for bosses and the hour. *Why:*
   area II has two looks, and Home's `AreaDef` has one.
4. **Area I's generator stays byte-identical.** Every area II knob has an
   area I value that reproduces today's `rand()` sequence. New randomness
   (slag, the thief) draws from separate seeded streams. *Why:* Home check A8.
5. **The lance is a light: walls block it both ways in see mode.** A
   Through-Line breach lets it through, as it lets shots through. Ward and
   Mirror Ward treat it as a shot. Shells are not shots. *Why:* symmetry, and
   every torso part keeps a job in the last fight.
6. **Heat is a second timer on the button (`hotUntil`), not a cooldown.**
   The button is ready only when both are done, and a push always fires. *Why:*
   "push-only for N s" is exact, and it's shown on the HUD by itself.
7. **Lights out is the day tracker's last span**, dusk → first dark, driven by
   boss HP. Tells are already fog-free, cores become fog-free, walls get a
   cold rim, and Grace × exposure is held constant. *Why:* one mechanism for
   "the day moves with you" and "lights out".
8. **The thief is a body without a pack.** It isn't in `combat.awake`, so it
   never counts for the quiet, the music or the camera. It only ever takes a
   floor part, and a catch gives that part back. *Why:* it adds no loot and
   can't be farmed.

### Risks and trade-offs

1. **The Arbiter stands in the middle of the square, 4.6 u tall.** At the
   38° pitch it covers up to 5.9 u of floor behind it (toward −x −z). It's an
   open lattice (legs and braces 0.07 u thick), so the floor shows through.
   Check K-D12 measures it. The fallback is to put it 3 u toward the far side
   of the arena.
2. **The slag puddle's 0.4 s arm fails the slack rule for anyone standing on
   the corpse.** It's resolved by the extension rule (§5.3). Watch for "unfair
   puddle" in the playtest before touching the 0.4.
3. **Precache grows by about 1.4 MB.** The first install on 4G gets slower
   once. The budget check (K-H2) caps the total at 5.6 MB.
4. **Tuning is the hard part.** Wedge speed, heat time, the vent length, cover
   density and the thief's pauses are one constant each. Their values here are
   starting points for the Poco.
5. **Lights out on a phone in sunlight.** First dark is exposure × 0.86 with
   the fog held beyond the arena. If the square can't be read outdoors, raise
   `first-dark.exposure` (one number) before touching anything else.
6. **Furniture Bits ships as `.gltf` + `.bin` + png**, not `.glb`. Converting
   is one command (§4.2), and each file carries a 15 KB atlas that the kit
   throws away at load.
7. **The Assembler at depth 6 disappears from normal play.** The Home "rams
   and mites" adds become dead code behind `ARBITER_AT_6`. They're kept as the
   one-evening fallback.

### Migration plan

- **Save v1 → v2** (§2.9): each `PartHistory` gains a 7th number (Arbiters
  felled while worn, 0), and a v1 snapshot gets `tally.arbiters = {}`. It's
  lossless, and runs on load before anything reads the save.
- **`__gen` baselines:** depths 1–3 must equal Home's baseline (A8). Depths
  4–6 get a new baseline, taken at the end of step 3 and again at step 5.
- **Assets:** unused GLBs are deleted in step 2 (§4.7). The SW needs no
  change, because its list is generated.

### Open questions (Adrian's)

1. The Arbiter's bar name ("The Arbiter") and the phase-2 banner ("the Arbiter
   opens its second eye"). Both are placeholders.
2. Whether the thief appears at depths 4–5 too (default yes; `THIEF.depths`,
   see contradiction 12).
3. The notebook lines for the four pages that go live (Wandering Drone, Hollow
   Repeater, Slag Heap; the Thermal Arbiter's line ships).
4. The heat caption's copy ("hot · hold to push").

---

## 2. Data contracts

TypeScript as it goes into the files named. Comments marked **INV** are
invariants that code and checks enforce.

### 2.1 Places, bosses, the day: `src/areas.ts` (extends Home §2.1)

```ts
export type SurfaceRole = 'paving' | 'rock' | 'wood' | 'ground' | 'grate'   // + 'grate'
export type AmbienceMood = 'crawl' | 'boss' | 'workshop' | 'works' | 'quarter' | 'square'
export type PlaceId = 'ruin' | 'works' | 'quarter'
export type MachineKind = 'chimney' | 'crucible' | 'press' | 'hopper'

/** Generator knobs that area I doesn't have. INV: PLACES.ruin.gen reproduces today's rand() sequence exactly. */
export interface GenPreset {
  /** Props per room cell at room progress 0 and 1. ruin: [0.25, 0.25], so n = round(cells / 4) as today. */
  cover: [start: number, end: number]
  coverGap: number                 // min distance between props (today 3.2)
  coverTries: number               // placement tries per room (today 40)
  /** INV: no prop's top exceeds this; a taller piece is scaled down to fit (walls always waist-high). */
  coverMaxH: number                // 1.4 in area II; Infinity in the ruin (area I's props untouched)
  /**
   * Intact cover. At room progress p a prop is drawn from `intact` with chance p,
   * else from kit.cover. It costs one extra rand() per prop, only when present (area II).
   */
  intact?: [Piece, number][]
  /** Floor tables by progress band (first band whose `from` ≤ p, searched from the end). Absent: kit.floorRoom. */
  floorBands?: { from: number; room: [Piece, number][] }[]
  /** Upright far-side pieces (door frames). Only where !hidesFloor. Chance per beyond sample, by nearest-room progress. */
  farSide?: { pieces: Piece[]; chance: [atP0: number, atP1: number] }
  /** Share of the beyond's TALL picks that become code-built machinery instead (the Works). */
  machines?: { kinds: MachineKind[]; share: number }
  /** Chance a body carries a slag core, by archetype. ruin: {} (never). */
  slag: Partial<Record<'chaser' | 'charger' | 'ranged', number>>
}

/** Everything a depth looks, sounds and generates like. */
export interface PlaceDef {
  id: PlaceId
  kit: KitPreset                               // Home §2.1, unchanged shape
  surfaces: Record<SurfaceRole, string>        // ambientCG id per role
  ambience: { crawl: AmbienceMood; boss: AmbienceMood }
  footsteps: FootSurface                       // 'stone' | 'wood' | 'plate'
  music: 'I' | 'II'
  gen: GenPreset
}
export const PLACES: Record<PlaceId, PlaceDef>              // values in §4
export const PLACE_OF: Record<number, PlaceId> = { 1: 'ruin', 2: 'ruin', 3: 'ruin', 4: 'works', 5: 'quarter', 6: 'quarter' }
export const WALK_PLACE: PlaceId = 'quarter'
/** INV: the only way anything picks a look. areaOf(depth) stays for bosses, the hour, the banner. */
export const lookAt = (depth: number): PlaceDef =>
  PLACES[PLACE_OF[Math.max(1, Math.min(RUN_DEPTHS, depth))]!]
// AREAS[0] = { ...PLACES.ruin fields, id: 'I', depths: [1,2,3] }; AREAS[1] = { ...PLACES.quarter fields, id: 'II', depths: [4,5,6] }

export type BossKind = 'assembler' | 'arbiter'
/** INV: hp 900; no hit above 22; no windup under 620 ms (checked per boss, K-A3 / K-D1). */
export interface BossDef {
  kind: BossKind
  name: string                                 // bar name
  hp: 900
  adds: 'hulks' | 'rams-mites' | 'none'
  roster: RosterId                             // 'the-first-warden' | 'the-thermal-arbiter'
  arena: 'yard' | 'square'
  openWord: string                             // the bar while open: 'stunned' | 'venting'
}
/** false restores Home's second Assembler (rams-mites) at depth 6: the one-evening fallback. */
export const ARBITER_AT_6 = true
export const ARBITER_DEF: BossDef = {
  kind: 'arbiter', name: 'The Arbiter', hp: 900, adds: 'none', roster: 'the-thermal-arbiter', arena: 'square', openWord: 'venting',
}
export function bossFor(depth: number): BossDef | null {
  if (depth % BOSS_EVERY !== 0) return null
  if (depth === RUN_DEPTHS && ARBITER_AT_6) return ARBITER_DEF
  return { kind: 'assembler', name: 'The Assembler', hp: 900, adds: depth === RUN_DEPTHS ? 'rams-mites' : 'hulks',
           roster: 'the-first-warden', arena: 'yard', openWord: 'stunned' }
}

export type DayKey = 'morning' | 'late-morning' | 'noon' | 'afternoon' | 'late-afternoon' | 'dusk' | 'first-dark' | 'night'
export interface DayPreset {
  // …Home §2.1 fields unchanged…
  /** × grade.bloomThreshold (default 1): embers bloom more as the light goes. */
  bloom?: number
  /** Cold rim on vertical kit faces, 0..1 (default 0): cover stays a silhouette in the dark. */
  rim?: number
}
/** INV: each span's `to` is the next depth's `from` inside an area; nothing reaches 'night' in a level. */
export const DAY_SPAN: Record<number, { from: DayKey; to: DayKey; by: 'rooms' | 'boss' | 'hold' }> = {
  1: { from: 'morning', to: 'late-morning', by: 'rooms' },
  2: { from: 'late-morning', to: 'noon', by: 'rooms' },
  3: { from: 'noon', to: 'noon', by: 'hold' },
  4: { from: 'afternoon', to: 'late-afternoon', by: 'rooms' },
  5: { from: 'late-afternoon', to: 'dusk', by: 'rooms' },
  6: { from: 'dusk', to: 'first-dark', by: 'boss' },
}
/** Home's seam, now real: DAY_SPAN[depth] mixed at p (colours in linear RGB, keyDir normalised). */
export function dayAt(depth: number, p: number): DayPreset
```

### 2.2 The boss: `src/boss.ts`

```ts
import type { Vfx } from './vfx'

export type BossCue =
  | { voice: 'windup' }                        // heavy: sfx.windup
  | { voice: 'aim'; lockAt: number }           // aimed: sfx.aim, clicks at lockAt of the windup
  | { voice: 'lob' }                           // a mortar tilting: sfx.lobAim
  | { voice: 'none' }

/** INV: every boss is 900 HP, never deals > 22 in one hit, never winds up < 620 ms. */
export interface Boss extends Enemy {
  readonly kind: 'boss'
  readonly def: BossDef
  readonly maxHp: number                       // = def.hp
  /** Below 55%. INV: once true, never false. */
  readonly phase2: boolean
  /** True for exactly the one update in which phase2 turned true. */
  readonly justPhase2: boolean
  /** Its ×1.5 window: the Assembler stunned (grill open), the Arbiter venting. hit() applies the ×1.5 itself. */
  readonly open: boolean
  /** World-space telegraphs that don't follow the body (piles, lanes, the wedge). Added to the scene by addBoss. */
  readonly worldGroup: THREE.Group
  /** Footprint radius when it never walks (Arbiter 1.2): spacing never moves it; main pushes Still out of it. null when it walks. */
  readonly anchored: number | null
  /** The current windup's sound shape. Read on the tick phase becomes 'windup'. */
  readonly cue: BossCue
  /** Committed tell ends for the camera: the charge lane's end, the lance's cut end, a shell's landing. */
  threats(out: THREE.Vector3[]): void
  /** Presentation only, called by main about 11 times a second: smoke, sparks, steam. */
  dress(vfx: Vfx): void
  /** Presentation only, on the tick phase becomes 'strike'. */
  strikeFx(vfx: Vfx): void
}
export const isBoss = (e: Enemy): e is Boss => e.kind === 'boss'
export function makeBoss(def: BossDef, x: number, z: number, face: THREE.Vector3): Boss   // 'assembler' | 'arbiter'
```

**The Assembler as a `Boss`** (no behaviour change):

- `def` comes from the constructor.
- `phase2 = overloaded`, `justPhase2 = justOverloaded`, `open = stunned`.
- `anchored = null`.
- `cue`: `aim` with `lockAt 0.55` for barrage and charge, else `windup`.
- `threats` pushes `laneEnd` under the old `laneEnds()` rule.
- `dress` and `strikeFx` are the bodies of main's `ambientFx` boss branch and
  `strikeFx` boss branch, moved as they are.
- The wave action carries `gapWidth: BOSS.wave.gapWidth, minGap: BOSS.wave.minGap`.
- The summon action carries `maxAdds: BOSS.summon.maxAdds`.

### 2.3 Enemy contract additions: `src/enemy.ts`

```ts
export interface Enemy {
  readonly kind: 'chaser' | 'ranged' | 'charger' | 'swarm' | 'boss' | 'thief'   // + 'thief'
  /** 'lobber' for the sentinel variant; undefined otherwise. Loot, BE letter and treasure follow `kind`. */
  readonly variant?: 'lobber'
  // …unchanged…
}
export type EnemyAction =
  | /* …melee, shot, shots, pull unchanged… */
  | { kind: 'wave'; center: THREE.Vector3; gaps: number[]; damage: number; gapWidth: number; minGap: number }
  | { kind: 'summon'; points: THREE.Vector3[]; maxAdds: number }
  /** A floor hazard, placed by the enemy (a Lobber's shell, the Arbiter's lance, shell and scald). */
  | { kind: 'hazard'; spec: HazardSpec }
```

The new-kind tax for `'thief'`:

- `ELITE_MODS.thief = []`, and it's never crowned.
- `KILL_WEIGHT.thief = 0`.
- `TREASURE.thief = { head: 1, torso: 1, arms: 1, legs: 1 }`. It's never
  rolled, but the record needs the key.
- The `who` name in main's footstep and `onWindup` switches is `'thief'`.

### 2.4 The hazard: `src/hazard.ts`

```ts
export type HazardShape =
  | { kind: 'circle'; x: number; z: number; r: number }
  /** a → b is already cut at cover by whoever made it. halfW is the drawn half-width. */
  | { kind: 'strip'; ax: number; az: number; bx: number; bz: number; halfW: number }
export type HazardSource = 'slag' | 'shell' | 'lance' | 'scald'

export interface HazardSpec {
  source: HazardSource
  /** r / halfW are DRAWN and are where Still's CENTRE is hit (rule R). An enemy is hit when its centre is within r − PLAYER_RADIUS + e.radius. */
  shape: HazardShape
  /** Telegraph, ms, from creation to the arm tick. INV: ≥ 450 + 1000 × (Still's escape u) ÷ 5.5 for every source (slag by §5.3's extension). */
  armMs: number
  /** Live after arming, ms. Every body inside at any tick of [arm, arm + liveMs] is hit, once. 0 = the arm tick only. */
  liveMs: number
  damage: number                               // INV: ≤ 22
  /** 'none': the floor itself. 'fromCentre': a clear solid-mode line from the circle's centre to the body (scald). A strip is pre-cut. */
  cover: 'none' | 'fromCentre'
  /** How Still is hurt: Anvil catches 'melee' only; Brace converts all; Ward/Mirror see only `warded`. */
  hurt: 'hazard' | 'melee'
  /** The lance only: Ward destroys it and Mirror Ward reflects it, like a shot. INV: false for shells and slag. */
  warded?: boolean
  /** The lance only: a hit on Still (taken or converted by Brace) heats one button. */
  heat?: boolean
  /** Who made it. Its death cancels it if unarmed and `cancelOnDeath`. The owner is never spared its own hazard. */
  owner?: Enemy
  cancelOnDeath?: boolean                      // the lance: true. shells, slag, scald: false
  /** Draw only: the owner's own tell already shows the arm clock (the lance's rails come from the Arbiter). */
  quiet?: boolean
}

export interface Hazard {
  readonly spec: HazardSpec
  /** ms until it arms (≤ 0 once armed). */
  readonly armIn: number
  /** ms of live time left after arming. */
  readonly liveLeft: number
  /** Bodies already hit ('still' for him). INV: a body appears at most once. */
  readonly hit: ReadonlySet<Enemy | 'still'>
  readonly done: boolean
}

/** INV: the four constants the design fixes. */
export const SLAG = { r: 0.9, armMs: 400, liveMs: 1600, damage: 8 }
export const SLACK = { reactMs: 300, slackMs: 150, walk: 5.5 }
/** Slag's arm time for Still at distance d from the corpse (§5.3). */
export const slagArm = (d: number) => Math.max(SLAG.armMs, SLACK.reactMs + SLACK.slackMs + (1000 * Math.max(0, SLAG.r - d)) / SLACK.walk)
```

**Combat** gains:

```ts
readonly hazards: Hazard[]
addHazard(spec: HazardSpec): Hazard           // public: the Arbiter, slag spill, dev checks
/** Enemies a hazard killed: they never spill slag (no chains). */
private readonly hazardKilled = new WeakSet<Enemy>()
```

`CombatEvents` gains:

```ts
onHazard: (ev: { kind: 'spawn' | 'arm' | 'end'; h: Hazard } | { kind: 'hit'; h: Hazard; who: Enemy | 'still'; at: THREE.Vector3 }) => void
onThief: (ev: ThiefEvent) => void
```

`HurtSource` gains `'hazard'`.

### 2.5 The Arbiter: `src/arbiter.ts`

```ts
export const ARBITER = {
  hp: 900, radius: 1.4, footprint: 1.2, height: 4.6, labelY: 4.9, phase2At: 0.55, wakeRadius: 12.5,
  wedge: { halfDeg: 15, range: 15, degPerS: 40, unfoldMs: 1500 },
  lance: { trackMs: 360, lockMs: 560, liveMs: 120, halfW: 0.45, damage: 18, turnRate: 3.5, reach: 20, mirrorDamage: 18 },
  vent: { ms: 1200, damageMul: 1.5 },
  heat: { ms: 4000 },
  shell: { hideMs: [2000, 1600], cooldownMs: [3500, 3000], windupMs: 620, flightMs: 1000, r: 1.6, damage: 12, lead: 0.3, leadMax: 2 },
  scald: { trigger: 3.0, r: 3.2, windupMs: 800, damage: 14, cooldownMs: 2500 },
  phase2: { judderMs: 600, reverseEveryMs: [4000, 7000], reverseJudderMs: 400, crackAt: 3 },
  posts: { count: 8, ring: 7.5, offsetDeg: 22.5, circleR: 0.75, spread: 0.8, crackedR: 0.45 },
}

export type ArbiterState =
  | 'asleep' | 'unfold' | 'watch'              // sweeping
  | 'track' | 'lock' | 'live' | 'vent'         // the lance and its window
  | 'shellAim' | 'scaldWind'                   // windups that don't stop the sweep (shell) / do (scald)
  | 'judder'                                   // phase-2 change, or a reversal coming
  | 'dead'

/** One crackable cover post in the square: two circles side by side (terrain props). */
export interface Post { circles: [Circle, Circle]; mesh: THREE.Mesh; lances: number; cracked: boolean; x: number; z: number }

export class Arbiter implements Boss {
  readonly kind = 'boss'
  state: ArbiterState
  /** Wedge angles (radians, world, atan2(x, z) convention). One in phase 1, two (θ, θ + π) in phase 2. */
  readonly wedges: number[]
  omega: number                                // signed rad/s
  aim: number                                  // lance aim while track/lock
  cut: THREE.Vector3 | null                    // the lance's end while lock/live
  constructor(def: BossDef, x: number, z: number, face: THREE.Vector3, posts: Post[])
}
/** A dead tower: dark lattice, head tilted. Built by main in bossDown and added to level.group. */
export function arbiterHusk(x: number, z: number, headYaw: number): THREE.Group
```

### 2.6 The Lobber and the thief: `src/lobber.ts`, `src/thief.ts`

```ts
export const LOBBER = {
  hp: 22, speed: 3.2, bodyRadius: 0.5, height: 1.5, labelY: 2.0,
  preferMin: 8, preferMax: 12, fireRange: 13,
  windupMs: 620, flightMs: 1000, r: 1.6, damage: 10, lead: 0.3, leadMax: 2.0, arcPeak: 3.2,
  recoverMs: 500, reloadMs: 2400,
}
export class Lobber implements Enemy { readonly kind = 'ranged'; readonly variant = 'lobber' /* … */ }

export const THIEF = {
  depths: [2, 4, 5] as readonly number[],      // never a boss level, never the walk
  chance: 0.35,
  hp: 12, bodyRadius: 0.35, height: 1.1, labelY: 1.4,
  speed: 6.0,                                  // empty and carrying
  runMs: 2500, listenMs: 800,                  // carrying: a listen pause every 2.5 s of running → average 4.55 u/s
  catchR: 1.1,                                 // centre distance for a tackle while it carries
  guardR: 1.5,                                 // it can't take a part while Still's centre is this close to it
  noticeMs: 600,                               // after a part lands, before it goes for it
  fleeR: 7,                                    // settled with a part: Still this close makes it run again
  waitRing: [5, 7] as const,                   // where it hovers while a part is guarded
  cageScale: 0.35,
}
export type ThiefState = 'dormant' | 'fetch' | 'wait' | 'carry' | 'listen' | 'settled' | 'caught'
export type ThiefEvent =
  | { kind: 'wake'; e: Thief } | { kind: 'take'; e: Thief; def: AbilityDef } | { kind: 'listen'; e: Thief }
  | { kind: 'caught'; e: Thief; def: AbilityDef | null; at: THREE.Vector3; how: 'tackle' | 'hp' }
export interface ThiefWorld {
  ground: () => readonly GroundPart[]          // loot.ground
  lift: (g: GroundPart) => AbilityDef          // loot.lift
  still: THREE.Vector3
  /** Rooms it may flee to or through: no asleep pack in them, not the exit room. Recomputed on wake/death events. */
  allowedRooms: () => readonly Room[]
  floor: ReadonlySet<string>
}
export class Thief implements Enemy {
  readonly kind = 'thief'
  state: ThiefState
  carrying: AbilityDef | null                  // INV: only ever a def that was on loot.ground this level
  constructor(x: number, z: number, nest: THREE.Vector3, world: ThiefWorld)
}
```

### 2.7 Level and packs: `src/dungeon.ts` (extends Home §2.5)

```ts
type Member = 'C' | 'H' | 'S' | 'L' | 'M8' | 'M6'           // + 'L' (Lobber)
const BE: Record<Member, number> = { C: 1.5, H: 1, S: 1, L: 1, M8: 2, M6: 1.5 }

export interface PackSpec {
  // …Home/enemies spec fields…
  members: { kind: Archetype; variant?: 'lobber'; slag?: true; x: number; z: number; face?: { x: number; z: number } }[]
  /** 'heap': a Works brood asleep as a slag heap (§6.4). */
  look?: 'heap'
}
export interface Level {
  // …Home fields…
  place: PlaceId
  /** The layout's floor cells (key(i, j)), for the thief's own pathing. */
  floor: ReadonlySet<string>
  /** 0..1 for a room: its spine index ÷ (MAIN_ROOMS − 1); side rooms take the nearest spine room's. */
  progressOf: (room: Room) => number
  /** The spine room containing (x, z), or null (corridors, side rooms, outside). */
  spineAt: (x: number, z: number) => Room | null
  /** The thief's nest when this level rolled one. */
  thief?: { nest: THREE.Vector3; room: Room }
  /** The square only: its posts, and the tower's footprint (dead until the tower falls). */
  posts?: Post[]
  footprint?: Circle
}
export function generateLevel(depth: number, seed?: number, opts?: { boss?: BossDef | null; area?: AreaDef; place?: PlaceDef; bossFelled?: boolean }): Level
/** Separate seeded streams: area I's main sequence never sees them. */
const stream = (seed: number, salt: number) => rng((seed ^ salt) >>> 0 || 1)   // SALT.slag 0x51a6, SALT.thief 0x7417, SALT.heap 0x4ea9, SALT.far 0xfa51
```

### 2.8 Kit: `src/kit.ts`

```ts
export const PIECES = [ /* today's 16 */, /* Home's */ 'wall_doorway', 'wall_window_open', 'table_long', 'stool',
  // the Works
  'floor_tile_big_grate', 'keg', 'wall_gated', 'wall_scaffold',
  // the quarter
  'table_long_broken', 'table_medium_broken', 'chair', 'floor_wood_large_dark',
  'cabinet_small', 'cabinet_medium', 'couch', 'chair_A_wood', 'table_medium',
] as const
/** A piece whose file fails to load uses this instead. INV: pieceData(p) never throws for a piece in FALLBACK. */
export const FALLBACK: Partial<Record<Piece, Piece | (() => THREE.BufferGeometry)>>
export interface PieceData { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; radius: number; height: number /* bbox y max */ }
/** Swap each role's photo texture (uAlb, uNrm, uScale, uGain) where it differs. Textures load on first use. */
export function setSurfaces(s: Record<SurfaceRole, string>): void
/** Shared with SURF: the cold rim on vertical faces (DayPreset.rim) and its colour. */
export const RIM = { uRim: { value: 0 }, uRimColor: { value: new THREE.Color(0x6f9bd0) } }
```

### 2.9 Save v2: `src/save.ts` (extends Home §2.2)

```ts
export const SAVE_VERSION = 2
/** [runs, deepest, Assemblers felled worn, broken, stopped, home, Arbiters felled worn] */
export type PartHistory = [runs: number, deepest: number, assemblers: number, broken: number, stopped: number, home: number, arbiters: number]
export interface RunTally { /* …Home… */ arbiters: Record<PartId, number> }
export const MIGRATIONS = {
  1: (s: SaveV1) => ({
    ...s, v: 2,
    history: Object.fromEntries(Object.entries(s.history).map(([k, h]) => [k, [...h, 0]])),
    run: s.run ? { ...s.run, tally: { ...s.run.tally, arbiters: {} } } : null,
  }),
}
```

The snapshot schema stays `s: 1`. Repair (Home §4.16) adds `tally.arbiters ??= {}`.
`bossDown` counts `assemblers` or `arbiters` by `def.kind`. `NAMED` gains, above
the Assembler rules: `arbiters ≥ 1 → ", that saw the Arbiter"`.

### 2.10 HUD: `src/hud.ts`

```ts
interface ButtonState { /* … */ hotUntil: number; hotMs: number }
export interface Hud {
  // …
  /** Heat a slot: push-only for `ms`. INV: never makes a push impossible; never touches an empty slot. */
  heat: (slot: SlotName, ms: number) => void
  /** ms of heat left (0 when cool). */
  heatLeft: (slot: SlotName) => number
  bossBar: (b: { name: string; frac: number; phase2: boolean; open: boolean; openWord: string } | null) => void
}
```

Ready becomes `clock >= readyAt && clock >= hotUntil`. `fire()` sets
`readyAt = max(clock + cooldownMs, hotUntil)`. Everything else is unchanged:
a hold on a not-ready button past `PUSH_HOLD_MS` pushes, and `last` counts +2
for a hot button.

---

## 3. Foundations

### 3.1 The `Boss` refactor, file by file

| where | today | becomes |
|---|---|---|
| `combat.boss` | `Assembler \| null` | `Boss \| null` |
| `combat.addBoss(x, z, face)` | `new Assembler` | `addBoss(x, z, face, def)`: `makeBoss(def, …)`. The pack keeps `wakeRadius 12.5, leash Infinity`. The scene adds `group, tellGroup, worldGroup`. |
| wave loop | `BOSS.wave.gapWidth / minGap` | the `Wave` record's own `gapWidth / minGap`, from the action |
| `summon` | `BOSS.summon.maxAdds` | `action.maxAdds` (Home §4.24's variant logic unchanged) |
| `countTells` | `e instanceof Assembler` | `isBoss(e) && e.phase === 'windup'`, plus `e instanceof Lobber && e.locked` |
| `laneEnds()` | chargers + the Assembler's charge | renamed `threatEnds()`: chargers, then `boss?.threats(out)`, then every unarmed non-quiet hazard's centre (circle) or end (strip) |
| spacing (`updatePacks`) | pushes both bodies | when one is `anchored`, only the other moves, by the full overlap |
| `targetFor` | `e.kind === 'boss'` ignores the decoy | unchanged. INV: no boss ever targets the decoy |
| `main.onWindup` | `as Assembler`, `b.move` | `switch (b.cue.voice)`: windup → `sfx.windup`; aim → `sfx.aim(ms, lockAt)`; lob → `sfx.lobAim(ms)` |
| `main.strikeFx` / `ambientFx` | Assembler branches | `b.strikeFx(vfx)` / `b.dress(vfx)` |
| the bar | `'The Assembler'`, `BOSS_HP` | `{ name: def.name, frac: hp / maxHp, phase2, open, openWord: def.openWord }` |
| the phase-2 banner | `'the Assembler overloads'` | `BOSS_COPY[def.kind].phase2` ('the Assembler overloads' / 'the Arbiter opens its second eye', placeholder) |
| the open sound | `sfx.clang` on stunned | `BOSS_COPY[def.kind].open`: `sfx.clang` / `sfx.vent` |
| still pushOut | terrain only | then, if `combat.boss?.anchored`, push Still's centre to `≥ anchored + BODY_RADIUS` from the boss |
| music | `overloaded` | `phase2`, plus `kit: def.kind === 'arbiter' ? 'anvil' : 'drums'` (§4.5) |

**Done when** the Assembler's existing checks (enemies spec §10, parts spec
§7, and Home A1–A6 and G5) pass unchanged, with depth 6 still an Assembler
(`ARBITER_AT_6 = false` until step 4).

### 3.2 The `Hazard` rules

**H1. Life.** Created at `t = 0`. It arms on the first tick where `armIn ≤ 0`.
It's live from that tick until `liveLeft ≤ 0`, then it fades for 300 ms and
is removed. `done` is true from the start of the fade.

**H2. Who it hits.**

- It hits Still, and every enemy in `combat.enemies` that isn't held (in the
  clamp's throw), isn't `kind === 'thief'`, and isn't dead.
- Sleepers are hit: `hpSeen` wakes their pack, as any hit does.
- The owner isn't spared. A Lobber's shell landing on itself hurts it.
- **Still:** his centre is inside the shape as drawn.
  - circle: `dist ≤ r`
  - strip: `distToSegment ≤ halfW`, and `along ≥ 0`
- **Enemy:** the same test, grown by `e.radius − PLAYER_RADIUS`.
- `cover: 'fromCentre'` also needs `terrain.lineClear(cx, cz, x, z, 0.1)`
  (solid mode, as the wave).

**H3. Once.** A body in `hit` is never hit again by this hazard. For
`liveMs > 0`, the test runs every tick of the live window, so walking into a
lit puddle hurts once.

**H4. Damage.**

- Still: `hurtPlayer(damage, spec.hurt, owner)`.
  - Anvil catches `'melee'` only (scald).
  - Brace converts any of them (`ceil(amount / 8)` strain).
  - The 0.35 s hurt window and the top-up apply as for any hit.
- If `spec.warded` and a ward/mirror guard is live (the shot rule's 1.8
  radius is moot: the lance reaches him, so the guard is by definition
  around him):
  - **Ward:** `guard.used = true`, the hit is void, and there's no heat.
  - **Mirror** with `reflectsLeft > 0`: `reflectsLeft--`, and the hit is void.
    Then `spawnBolt(still, angle(still → owner), LANCE.mirrorDamage, 0.3, 20)`
    fires with `part: true`, and walls stop it.
- Enemy: `e.hit(damage)` and `onHit(e.pos, e)`. It's not `hitPart`: a hazard
  isn't a part, so it never consumes a mark. If that hit kills it,
  `hazardKilled.add(e)`.

**H5. Heat.** If `spec.heat` and Still was hit, taken or converted (not
warded), then `events.onPart({ kind: 'heat' })` fires, and main calls
`hud.heat(pickHeat(), ARBITER.heat.ms)`. `pickHeat()` picks:

1. Among filled slots that are ready, the one with the largest
   `def.cooldownMs`.
2. Else, the filled slot with the smallest `readyAt`.
3. Ties go in slot order: head, torso, arms, legs.

**H6. No chains.** In `bury(e)`, a slag core spills only if
`!hazardKilled.has(e)`. Nothing else ever creates a hazard from a hazard.

**H7. Owner death.** When the owner dies, its unarmed hazards with
`cancelOnDeath` are removed with the fade and never arm. Shells in flight
still land. Slag and scald always resolve.

**H8. Tick order.** `Combat.update` runs `tickHazards(dt, player)` right
after `tickParts(dt)`. It arms, tests, deals damage, then fades. An enemy
killed there is buried at the top of the next tick, as any kill between ticks
is.

**H9. The tell** (`HazardTell`, one per hazard, released on removal):

- **Circle, arming:** a fixed ember ring at `r` (a 0.1 band,
  `tellMaterial('radial', r)`, opacity 0.42), and a disc that fills with
  `scale = 1 − armIn / armMs` (opacity 0.3), exactly the hulk's look.
- **Circle at the arm:** 0.95 / 0.8 for 120 ms.
- **Slag, live:** a molten puddle. The disc holds at 0.7 while its `uHot`
  lerps `EMBER → EMBER_DEEP × 0.6` and its opacity falls 0.7 → 0.35 over
  `liveMs`. It's textured and never flat.
- **Strip, arming:** two rails at `±(halfW − 0.04)` (0.04 wide, opacity 0.7)
  and a core `halfW × 0.6` filling along the length. It uses `LaneTell`'s
  `Quads`, so the noise keeps its world grain.
- **Strip, live:** the whole strip at 0.95, plus a raised beam line: a box
  `0.12 × 0.12 × len` at y 1.2, `MeshBasicMaterial` EMBER, additive,
  `fog: false`, for `liveMs + 150` ms.
- `renderOrder = tellOrder(armIn)`, so the soonest is on top. `quiet: true`
  skips the arming draw (the owner draws it).
- **INV:** every hazard material has `fog === false` (ShaderMaterial's default,
  and set explicitly on the beam).

### 3.3 Per-place plumbing

- Everything that built a level from `areaOf(d).kit / surfaces / ambience /
  footsteps` switches to `lookAt(d)`:
  - `enterLevel` passes `place: lookAt(d)` to `generateLevel`;
  - it calls `setSurfaces(lookAt(d).surfaces)` during the descend fade;
  - `updateAmbience(level.boss ? place.ambience.boss : place.ambience.crawl)`;
  - footsteps use `place.footsteps`;
  - music uses `place.music`.
- The walk home uses `PLACES[WALK_PLACE]`.
- **Fog-free cores (the lights-out rule, set everywhere):** `fog: false` on
  - every enemy core `MeshBasicMaterial` (Chaser, Ranged, Charger, the
    Assembler, the Lobber, the Arbiter's lenses and boiler cores);
  - the sentinel's halo `SpriteMaterial`;
  - the MiteBatch core and halo materials;
  - the thief's cage light.

  Tells are ShaderMaterials, whose `fog` is already false. Check K-A6 walks the
  scene.

---

## 4. The Works (depth 4) and the workers' quarter (depth 5, the square, the walk)

### 4.1 What each place is made of

| | ruin (1–3) | works (4) | quarter (5, 6, walk) |
|---|---|---|---|
| surfaces paving / rock / wood / ground / grate | PavingStones142 / Rock035 / Planks023A / Ground108 / PavingStones142 | **MetalPlates006** / **Metal063** / Metal063 / Ground108 / **MetalWalkway014** | **Tiles093** / **Bricks097** / Planks023A / PavingStones142 / MetalWalkway014 |
| room floors | today's | band 0: `floor_tile_big_grate` 0.14, `floor_tile_large_rocks` 0.22, `floor_tile_large` 1 | band 0 (p < 0.34): `floor_dirt_large_rocky` 0.3, `floor_tile_large_rocks` 0.65, `floor_tile_large` 1 · band 0.34: `floor_tile_large_rocks` 0.25, `floor_wood_large_dark` 0.45, `floor_tile_large` 1 · band 0.67: `floor_wood_large_dark` 0.45, `floor_tile_large` 1 |
| corridor floors | today's | `floor_tile_big_grate` 0.6, `floor_tile_large` 1 | `floor_dirt_large` 0.4, `floor_tile_large_rocks` 1 (the street) |
| wall / column / arena cover | barrier / column / barrier_column | same pieces, skinned plate | same pieces, skinned brick |
| cover (broken) [piece, scale] | today's `PROPS` | `keg` 0.65, `crates_stacked` 1, `barrel_large` 0.7, `box_large` 0.8, `keg` 0.65, `rubble_half` 0.42 | `table_long_broken` 0.8, `table_medium_broken` 0.9, `chair` 0.9, `rubble_half` 0.42, `box_large` 0.8, `barrel_large` 0.7 |
| cover (intact) | – | – | `couch` 0.9, `cabinet_small` 1, `cabinet_medium` 0.9, `table_medium` 1, `chair_A_wood` 1, `table_long` 0.8 |
| breakable | barrel_large, box_large, box_stacked | barrel_large, box_large | chair, chair_A_wood, box_large, barrel_large, cabinet_small |
| cover density `gen.cover` | [0.25, 0.25] | [0.25, 0.25] | **[0.125, 0.33]** |
| `coverGap / coverTries` | 3.2 / 40 | 3.2 / 40 | 2.6 / 60 |
| beyond tall | today's `TALL` | `wall_gated`, `wall_scaffold`, `pillar`, `wall_broken`, plus machines (share 0.45: chimney, crucible, press, hopper) | `wall_broken`, `wall`, `pillar`, `rubble_large` |
| far side | – | – | `wall_doorway`, `wall_window_open`; chance [0.05, 0.35] |
| slag chance | {} | chaser 0.4, charger 0.4, ranged 0.25 | chaser 0.4, charger 0.4, ranged 0.25 |
| ambience crawl / boss | crawl / boss | works / works | quarter / square |
| footsteps | stone | plate | wood |
| music | I | II | II |

In the ruin, `gen.floorBands` and `gen.intact` are absent, so the kit tables
run as today.

**INV (checked, K-B4):** no list in `PLACES.works` or `PLACES.quarter`
contains a name matching `/bed|cot|crib|cradle|toy/`.

### 4.2 Pieces to vendor, and their fallbacks

**Dungeon Remastered** (CC0). Download from
`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/main/addons/kaykit_dungeon_remastered/Assets/gltf/<file>`
and save as `public/kaykit/<piece>.glb` (drop the `.gltf` in the middle, as
the vendored ones are named).

| piece | file | bytes | bbox (x × y × z) | fallback |
|---|---|---|---|---|
| `floor_tile_big_grate` | `floor_tile_big_grate.gltf.glb` | 36,296 | 4 × 1.05 × 4 (top at 0.05) | `floor_tile_large` geometry, skinned `grate` |
| `keg` | `keg.gltf.glb` | 59,912 | 1.8 × 2.05 × 2.0 | `barrel_large` geometry |
| `wall_gated` | `wall_gated.gltf.glb` | 46,364 | 4 × 4 × 1 | `wall` |
| `wall_scaffold` | `wall_scaffold.gltf.glb` | 59,436 | 4 × 4 × 1 | `wall_broken` |
| `table_long_broken` | `table_long_broken.gltf.glb` | 55,192 | 2.4 × 1.27 × 4.4 | primitive table 2 × 1.1 × 4, one leg gone, top rolled 12° |
| `table_medium_broken` | `table_medium_broken.gltf.glb` | 35,184 | 2.3 × 0.97 × 2.4 | primitive table 2 × 0.95 × 2, one leg gone, top rolled 12° |
| `chair` | `chair.gltf.glb` | 36,252 | 0.75 × 1.23 × 0.76 | primitive chair |
| `floor_wood_large_dark` | `floor_wood_large_dark.gltf.glb` | 35,616 | 4 × 0.15 × 4 | `floor_tile_large` geometry, skinned `wood` |
| Home's `wall_doorway`, `wall_window_open`, `table_long`, `stool` | Home §5.2 (vendored there) | – | 4 × 4 × 1 / 2 × 1 × 4 | Home's own fallbacks (the pillar pair; the crate bench; a barrel) |

**Furniture Bits** (CC0). It ships `.gltf` + `.bin` + a shared png. Convert
each one with:

```
npx --yes gltf-pipeline@4 -i <name>.gltf -o public/kaykit/<name>.glb
```

That embeds the bin and the 15.6 KB atlas, which the kit discards at load
anyway. Source:
`https://raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Furniture-Bits-1.0/main/addons/kaykit_furniture_bits/Assets/gltf/<name>.gltf`
(+ `.bin`, + `furniturebits_texture.png`).

| piece | bin bytes (≈ glb) | bbox | fallback |
|---|---|---|---|
| `cabinet_small` | 19,468 (≈ 38 KB) | 1 × 1 × 1 | box 1 × 1 × 1 |
| `cabinet_medium` | 23,304 (≈ 42 KB) | 2 × 1 × 1 | box 2 × 1 × 1 |
| `couch` | 21,416 (≈ 41 KB) | 3 × 1.22 × 1.6 | seat box 3 × 0.5 × 1.5 at y 0.25; back 3 × 0.7 × 0.3 at (0, 0.85, −0.6); arms 0.3 × 0.8 × 1.5 at x ±1.35 |
| `chair_A_wood` | 16,504 (≈ 36 KB) | 0.76 × 1.26 × 0.84 | primitive chair |
| `table_medium` | 9,328 (≈ 28 KB) | 2 × 1 × 2 | primitive table 2 × 1 × 2 |

**Primitives, exactly** (built once in `kit.ts` and merged into one geometry
each, with `computeBoundingBox`):

- **Table** `(w, h, d)`: top `w × 0.1 × d` at `y = h − 0.05`, four legs
  `0.12 × (h − 0.1) × 0.12` inset 0.15 from the corners. *Broken:* drop the
  +x +z leg and rotate the top 12° about z.
- **Chair:** seat `0.7 × 0.08 × 0.7` at y 0.5, back `0.7 × 0.7 × 0.08` at
  `(0, 0.9, −0.31)`, four legs `0.08 × 0.46 × 0.08`.

**Loading rule.** `loadKit()` loads each piece with its own try/catch. On a
failure it logs one `console.warn`, builds the fallback, and registers it
under the piece's name. It then skins it with the piece's own role, so a
missing file never blocks boot, and the SW only precaches files that exist.
`surfaceOf` gains these rules, checked first:

- `/grate/` → `grate`
- `/^floor_wood/` → `wood`
- `/table|chair|stool|cabinet|couch|keg/` → `wood`

Floor pieces whose bbox isn't 4 ± 0.2 in x and z are scaled to 4 at load.

### 4.3 Surfaces (ambientCG, CC0)

For each one:

1. Download `https://ambientcg.com/get?file=<ID>_1K-JPG.zip`.
2. Take `<ID>_1K-JPG_Color.jpg` and `<ID>_1K-JPG_NormalGL.jpg`.
3. Resize to 512 with `sips -Z 512 -s format jpeg -s formatOptions 78 <in> --out public/textures/<ID>_Color.jpg`
   (and `_NormalGL`).

Target ≤ 200 KB a pair, hard cap 260 KB. Add each ID to
`public/textures/LICENSE.txt`.

| ID | role | where | `SURFACE_TEX` (scale, gain), start values |
|---|---|---|---|
| MetalPlates006 | paving | Works floors | 4, 0.70 |
| Metal063 | rock, wood | Works walls, columns, kegs, crates, machines | 3, 0.90 |
| MetalWalkway014 | grate | Works grates and corridors | 3, 0.80 |
| Tiles093 | paving | quarter floors, the square | 3, 0.75 |
| Bricks097 | rock | quarter walls, columns, posts, frames | 2.5, 0.85 |

`SURFACE_TEX` becomes keyed by ambientCG ID. `setSurfaces` sets, per
material, `uAlb`, `uNrm`, `uScale = 1 / scale` and `uGain` from its role's ID.
Textures load lazily on the first `setSurfaces` that names them, which happens
during the descend fade into depth 4. They're in the SW cache, so this works
offline. Pick-and-compare happens in `look.html`: swap an ID there, never in
the spec.

### 4.4 Generator changes (`generateLevel`, area II only unless stated)

**G1. Progress.**

- `spine = layout.rooms.slice(0, MAIN_ROOMS)` (entrance, 4 main, exit, in
  order).
- A spine room's progress is `index / 5`.
- A side room takes the progress of the spine room whose centre is nearest
  (ties go to the lower index).
- A floor cell takes the progress of the room containing it, or, for
  corridor cells, of the nearest room centre.
- There's no rand(). It's exposed as `level.progressOf`.

**G2. Floors.** Still one `rand()` per cell, against `floorBands` at the
cell's progress. Corridors use `kit.floorCorridor`.

**G3. Cover count.**
`n = round(cellsIn × lerp(gen.cover[0], gen.cover[1], p)) + floor(rand() × 2)`.
For the ruin, `round(cellsIn × 0.25) === round(cellsIn / 4)` for every
`cellsIn` the generator makes (9, 15, 25), so the sequence is unchanged. The
quarter's 5×5 rooms get:

| room progress | 0.2 | 0.4 | 0.6 | 0.8 |
|---|---|---|---|---|
| props | 4–5 | 5–6 | 6–7 | 7–8 |

Placement uses `coverGap` and `coverTries`. The centre-lane rule (`|ox|,
|oz| ≥ 2.4`) is kept everywhere, so the corridor lanes stay open.

**G4. Cover pick.**

- If `gen.intact`: `pick(rand() < p ? gen.intact : kit.cover)`. That's one
  extra `rand()`.
- Otherwise `pick(kit.cover)` as today.
- Then `scale = min(scale, gen.coverMaxH / pieceData(piece).height)`.
- **INV:** in area II every prop's top ≤ 1.4, and the barrier is 1.1. The
  ruin's `coverMaxH` is Infinity, so area I's props are untouched.
- Walls stay the barrier on every floor edge, in every place.

**G5. Far side** (quarter). In the beyond loop, for a sample that is `!nearFloor(x, z, 0)`,
`nearFloor(x, z, 2)` and `!hidesFloor(x, z)`, with a separate stream
`stream(seed, SALT.far)`:

- chance `lerp(farSide.chance, p of the nearest room)` → place `pick(farSide.pieces)`;
- upright: `y 0`, `rotY` snapped to face the nearest floor cell;
- scale 1.

It never goes on the camera side (hidesFloor) and never within one cell of
floor, so no frame stands on a wall edge.

**G6. Machines** (Works). Of the beyond's TALL picks, `share` become a
machine primitive from `src/machines.ts`, still only where `!hidesFloor`:

- **chimney:** cylinder r 1.1, h 9–13, 8 segments, with a ring lip;
- **crucible:** cylinder r 1.7 → 1.3, h 2.6, with a dark disc inset 0.2 at the top;
- **press:** box 3 × 3.8 × 2.4, with a head box 3.4 × 0.8 × 2.8 at y 3.2;
- **hopper:** an inverted cone r 1.8, h 2, on four legs 0.25 × 3 × 0.25.

They're instanced per kind, skinned `rock`, and sunk `y −rand() × 1.6` like
the ruins. Machines are silhouettes in the fog: no lights, no ember.

**G7. Slag flags.**

- For each non-lesson, non-elite-leader pack member of kind chaser, charger
  or ranged (not `lobber`), `stream(seed, SALT.slag)() < gen.slag[kind]`
  sets `slag: true`.
- Elite leaders never carry one: their guaranteed drop mustn't sit in a
  puddle.
- The stream is drawn after all packs and elites are placed, in pack order,
  then member order.

**G8. The thief.**

- If `depth ∈ THIEF.depths`, the level isn't a boss level, and it has ≥ 1
  side room, roll `stream(seed, SALT.thief)() < THIEF.chance`.
- On a hit, the nest is the side room with the highest progress (ties go to
  the first).
- `level.thief = { nest: room.center + (0.9, 0, 0.9) clamped clear, room }`.

**G9. The square** (the boss arena when `boss.arena === 'square'`). The
layout is today's `generateBossLayout` (an entrance, a corridor of 2, and a
7×7 arena). Instead of the yard's four walls and crates:

- **Posts:** for `k = 0..7`, at angle `a = k × 45° + 22.5°`, centre
  `P = c + 7.5 × (sin a, cos a)`, tangent `t = (cos a, −sin a)`.
  - two circles at `P ± 0.8 t`, r 0.75;
  - mesh `barrier`, scale (0.75 along its length, 1, 1), `rotY = a + π/2`,
    skinned `rock` (brick);
  - these posts are separate meshes, not instanced, so they can crack.
- **Footprint:** a Circle at `c`, r 1.2, `dead: true`, returned as
  `level.footprint`.
- **Furniture:** four intact pieces in the arena corners (±11, ±11), solid,
  not breakable.
- **Boss spot:** `bossSpot = { x: c.x, z: c.z, face: entrance.center }`.
- **Floors:** `floor_tile_large` 0.8, `floor_tile_large_rocks` 1 (the
  square's paving, Tiles093).
- The beyond is the quarter's, far-side frames included, at `p = 1`.

**G10. The walk home** (Home §6.4) uses `PLACES.quarter` at `p = 1`:

- floors from band 0.67;
- far-side frames at chance 0.35;
- 4 intact furniture props: 2 in the start room at `(±3, 0, 3)`, 2 in the
  yard at `(−31, 0, −17)` and `(−25, 0, −21)`. They're solid and never
  breakable. Nothing can fail there anyway.

**G11. The pack rows** are §6.5.

### 4.5 Sound and music

**Footsteps** (`sfx.step(who, pan, loudness, surface)`, Home §5.10):

- `'plate'`: `step` at rate 1.25, gain 0.45 × loudness, plus `metalLight` at
  rate 1.5, gain 0.16 × loudness. Still keeps his `tin` 0.07 on top.
- `'wood'`: as Home.
- Enemies' steps take the same surface layer at half gain.

**Room tones** (`ambience.ts`; each mood sets layer gains with
`setTargetAtTime(…, 1.5)`):

| layer | works | quarter | square |
|---|---|---|---|
| reverb | a second convolver, 1.1 s, decay exponent 2.2 (shorter, brighter) | a third, 0.9 s, exponent 4 (open air) | as quarter |
| room tone | the **foundry** layer (saw 55 / 55.6 / 110 Hz, lowpass 180) at gain 0.6, plus stone tone ×0.5 | stone tone ×0.5, lowpass 180 | as quarter |
| steam | `steam()` every 3–8 s | – | – |
| forge thump | on every 2nd music beat (48.5 BPM at 97): sine 55 → 38 Hz over 0.35 s, gain 0.10, plus `plateHeavy` at rate 0.45 through lowpass 400, gain 0.12, into the reverb | – | – |
| drips | every 6–18 s (×0.3 rate) | none | none |
| clanks | as crawl | none | none |
| drafts | as crawl | **wind**: bandpass 450 Q 0.4, gusts to 0.05–0.09 | as quarter |
| curtain in a draft | – | every 8–16 s for 2–4 s: noise bandpass 1400 Q 1.2, amplitude-modulated at 0.4–0.9 Hz ("flap"), gain 0.02, random pan ±0.7 | as quarter |
| something far off | – | every 16–34 s, one of: a door knocking in the wind (`woodHeavy` ×2, rate 0.55, lowpass 600, 0.35 s apart, gain 0.12), or a shutter creak (`plank` rate 0.4, lowpass 900, gain 0.08) | every 30–60 s, same |

For the forge thump's tempo lock, `music.ts` exports
`beatClock(): { next: number; len: number; beat: number } | null`, and
ambience schedules the thump on odd beats at `next` (lookahead 0.2 s).

**Music** (`music.ts`):

- `MusicState` gains `area: 'I' | 'II'`, `bpm: number` and
  `kit: 'drums' | 'anvil'`.
- Area II's chord loop:
  `CHORDS_II = [{ root: 50, pad: [50, 53, 57, 62] }, { root: 43, pad: [43, 50, 53, 58] }, { root: 46, pad: [46, 50, 53, 57] }, { root: 45, pad: [45, 52, 55, 57] }]`
  That's Dm, Gm, B♭, A7 with no third: the A still refuses home.
- **Pulse (area II):** the square ostinato stays, and the 1200 Hz click becomes
  a metal tick: a square at 2400 Hz, 12 ms, through bandpass 3000 Q 4, gain
  0.06.
- **Tempo:** depth 4: `97 − 2.5 × p`; depth 5: `94.5 − 2.5 × p` (`p` from the
  day tracker, §7). The day slows.
- **Boss II (`kit: 'anvil'`, 124 BPM):**
  - the kick becomes `plateHeavy` at rate 0.55, gain 0.5, plus the 70 Hz sine
    at 0.6;
  - the snare becomes `bell` at rate 0.8, gain 0.25, plus the noise snare at
    0.3;
  - the drive and stab are unchanged;
  - phase 2 adds the arpeggio (the `overloaded` rule);
  - the pad's lowpass follows lights out: `1100 − 400 × p`.
- `musicContext()` gains `play(name, dest, gain, rate)` (as `ambienceContext`
  has).
- **The bell (Grace's line) is unchanged everywhere.**

**New voices** (`audio.ts`; every gain × `mix` bus, every one panned):

| voice | what |
|---|---|
| `whirr(pan)` → `Voice` | the Arbiter's sweep loop: saw 70 Hz, lowpass 400, 3 Hz tremolo, gain 0.05; `pan()` follows the wedge's point at 8 u |
| `ratchet(pan)` | one tick every 10° of sweep: `tin` rate 2.0, gain 0.12, plus square 1.9 kHz for 10 ms |
| `catchClack(pan)` | the wedge stops on him: `metalMedium` rate 0.8, gain 0.5 |
| `lanceFire(pan)` | the hiss-crack: highpass-3 kHz noise, 0.5 s decay, gain 0.4; `bell` rate 0.5, gain 0.3; sine 180 → 60 over 0.25 s |
| `vent(pan)` | steam: highpass-2500 noise over 1.2 s, gain 0.3; `plateHeavy` rate 0.7 at the start |
| `judder(ms, pan)` | `tin` rate 1.4 every 40 ms for ms, then `metalHeavy` rate 0.6 (the clank) |
| `lobAim(ms, pan)` → stop | the mortar tilting: a creak (`plank` rate 0.7) and a rising sine 200 → 320 over ms |
| `mortar(pan)` | launch: `softHeavy` rate 0.6, sine 90 → 40 over 0.2 s |
| `whistle(ms, pan)` | the shell in flight: sine 1400 → 700 over ms, gain 0.03 |
| `shellLand(pan)` | `mining` rate 0.8, plus the `strike` body |
| `scaldWind` | `sfx.windup` (reused) |
| `scald(pan)` | a steam burst: highpass-2 kHz noise 0.4 s, gain 0.5 |
| `sizzle()` | heat on Still: bandpass-4 kHz noise 0.4 s, gain 0.2, plus `tin` rate 2.6; `cool()` a soft falling hiss at heat's end |
| `slagSpill(pan)` / `slagArm(pan)` | a wet glop (`softMedium` rate 0.7) / a hiss up (bandpass 1.2 → 3 kHz, 0.25 s) |
| `thiefChime(pan)` | every 1.4 s while it carries: sines at 2637 and 2650 Hz, 0.6 s decay, gain 0.03 (the only cold instrument on an enemy) |
| `thiefStep(pan)` | `tin` rate 2.4, gain 0.12 |
| `snatch(pan)` / `cageOpen(pan)` | `metalLight` rate 1.6 / `tin` rate 1.8, plus the drop's own sound |
| `crack(pan)` | a post cracks: `mining` rate 0.7, gain 0.8, plus `woodHeavy` rate 0.6 |
| `lensOut(pan)` | the Arbiter's death: sine 900 → 60 over 1.5 s, gain 0.08, plus a glass tink (`tin` rate 3) |

### 4.6 The grade, per depth (the Home table, extended)

These multiply `grade` (Home §6.1). The rows for 4, 5, 6 and night are Home's
own values. Only **first dark** and the two new columns are new.

| key | where | sat | exposure | vignette | fog | fog colour | background | hemi | key | key colour | key dir | grace | bloom | rim |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| afternoon | depth 4 start | 0.96 | 0.98 | 1.00 | 0.95 | #0c1017 | #070a0e | 0.95 | 0.95 | #98a8c4 | (−10, 11, 2) | 1.05 | 1.00 | 0 |
| late-afternoon | 4 end = 5 start | 0.90 | 0.95 | 1.05 | 0.88 | #0b0e15 | #06090d | 0.88 | 0.80 | #8e98b4 | (−12, 8, 5) | 1.10 | 0.94 | 0 |
| dusk | 5 end = 6 start | 0.82 | 0.90 | 1.12 | 0.80 | #090c13 | #05070b | 0.75 | 0.55 | #7c86a6 | (−13, 5, 8) | 1.15 | 0.89 | 0.12 |
| **first-dark** | the Arbiter at 0 HP | 0.74 | 0.86 | 1.20 | 0.74 | #070a10 | #04060a | 0.55 | 0.30 | #6f7a9c | (−13, 3, 9) | **1.20** | 0.86 | 0.35 |
| night | walk home | 0.70 | 0.85 | 1.25 | 0.70 | #05070b | #030406 | 0.45 | 0.15 | #6c7c9e | (−6, 12, −10) | 1.25 | 0.86 | 0.30 |

Rows morning through noon and workshop get `bloom 1, rim 0`.

- **Grace constant:** `grace(first-dark) = grace(dusk) × exposure(dusk) / exposure(first-dark) = 1.15 × 0.90 / 0.86 = 1.2035`,
  which rounds to 1.20. Check K-E4 holds `grace × exposure` within 2% across
  the dusk → first-dark span.
- **The fog held beyond the arena:** on depth 6 only, after the preset,
  `fog.far = max(fog.far, 58)`. The camera sits 40 u from the focus, and the
  arena's far corner is `0.79 × 14√2 ≈ 15.6` u deeper, so 58 keeps the square
  readable.
- **Rim:** `RIM.uRim.value = preset.rim`. In the skin shader, after
  `#include <emissivemap_fragment>`:
  `totalEmissiveRadiance += uRimColor * uRim * side * pow(1.0 - max(0.0, dot(normalize(vWNrm), normalize(cameraPosition - vWPos))), 3.0);`
  where `side` is the existing vertical-face factor, so floors never rim.
- **Bloom:** `world.bloom.threshold = grade.bloomThreshold × preset.bloom`.
- Dusk is blue-violet, never orange. No preset has a warm key.

### 4.7 The download budget

Measured today: `dist/` is 3.6 MB. Home adds about 0.3 MB (its four pieces
and five wood steps).

| added by this spec | bytes |
|---|---|
| 13 GLBs (§4.2: 4 Works, 4 dungeon quarter, 5 furniture) | ≈ 550 KB |
| 5 texture pairs at ≤ 200 KB | ≤ 1.00 MB |
| JS (hazard, arbiter, lobber, thief, day, machines) | ≈ 60 KB |
| **deleted:** GLBs in `public/kaykit/` that no `PIECES` entry or fallback names (`barrier_colum_half`, `barrier_corner`, `barrier_half`, `floor_foundation_front`, `floor_tile_small`, `floor_tile_small_broken_A`, `floor_tile_small_weeds_A`, `wall_half`, `wall_half_endcap`, and `wall_pillar` if Home vendored `wall_doorway`) | −250 to −305 KB |
| **net** | **≈ +1.35 MB → about 5.25 MB** |

**Caps (K-H2):** `dist/` ≤ 5.6 MB. The files this spec adds total ≤ 1.7 MB.
Every GLB in `dist/kaykit/` is named by `PIECES`. GPU memory: 5 more surfaces,
about 14 MB, loaded only on reaching depth 4.

---

## 5. The Arbiter

### 5.1 What it is

A lattice lamp tower standing at the centre of the quarter's square. It never
walks (`anchored = 1.2`, `knockMul 0`). It sweeps an ember wedge across the
floor like a lighthouse, and when the wedge crosses Still with a clear line it
stops on him, tracks him, locks, and fires a lance down the locked line. After
every lance it vents for 1.2 s, which is the time to hit it (×1.5, and the
time to push). As its HP falls, the square darkens to first dark.

### 5.2 Moves and phases

**Wake.** Its pack wakes at 12.5 u. Still, coming out of the corridor, is
then about 1.5 u inside the arena.

- `unfold` lasts 1500 ms: the lens lights (CORE_ASLEEP → CORE over 600 ms),
  and the wedge fades in at `θ0 = bearing(Still) + π`.
- Over those 1500 ms, `|omega|` eases from 0 to 40°/s (ease-in quad),
  clockwise (`omega < 0`).
- The first catch comes about 4.5 s after the wake at the earliest, time
  enough to reach a post (5 u, 0.9 s).

**Phase 1 (hp ≥ 495):**

| state | what happens | leaves when |
|---|---|---|
| **watch** | Each wedge turns by `omega × dt`. The wedge is `±15°`, range 15. Its floor decal is a faint wash (opacity 0.10, `trackingDim()` applies). `whirr` and a `ratchet` every 10°. | **catch**: for some wedge, Still's bearing is within 15° of its centre, `dist ≤ 15`, `lineClear(pos, still, 0.1, see = true)`, the wedge is **re-armed** (Still has been outside every wedge at some tick since the last lance ended), no lance is in progress, and `canLock(360)`. Then `book(this, 360)`, `catchClack`, → track. Or **shell** (below). Or **scald** (below). |
| **track** (360 ms) | The sweep stops. The head turns toward Still at ≤ 3.5 rad/s (aim). The wedge narrows to a line along aim, brightening 0.10 → 0.5. The lens swells 1 → 1.35. Voice: `cue = aim, lockAt 360/920`. | at 360 ms → **lock** |
| **lock** (560 ms) | Aim freezes. The cut: march from `pos + dir × (1.2 + 0.1)` in 0.2 u steps until `terrain.blocker(x, z, 0.1, true)` or 20 u; `cut` = the last clear point. `addHazard({ source: 'lance', shape: strip(start → cut, halfW 0.45), armMs: 560, liveMs: 120, damage: 18, cover: 'none', hurt: 'hazard', warded: true, heat: true, owner: this, cancelOnDeath: true })`. The strip's rails show at full; the lens snaps to 1.5 with a halo flare (the lock click). | arms → **live** |
| **live** (120 ms) | The beam burns (H9). `lanceFire`. In phase 2, if the cut ended on a post circle, `post.lances += 1`. | → **vent** |
| **vent** (1200 ms) | `open = true`: `hit()` takes ×1.5. The wedge is off. The three boiler hatches swing open (1.2 rad over 150 ms) and show their cores; steam puffs from each hatch every 90 ms; `vent` sound. The bar reads "The Arbiter — venting". | at 1200 ms: hatches close (150 ms), the sweep resumes from `aim` in the current direction → **watch** |

**Shell** (a windup that doesn't stop the sweep). In watch only, if:

- Still has had **no** see-mode line from the tower for ≥ `hideMs` (2000;
  1600 in phase 2) in a row,
- he's within 15 u,
- no shell of its own is in flight,
- ≥ `cooldownMs` (3500; 3000 in phase 2) have passed since the last launch,
- and `canLock(620)` holds,

then `book(this, 620)` and → **shellAim**:

- **Aim (620 ms):** a mortar on the collar tilts toward Still. A faint ring
  (r 1.6, opacity 0.16 × trackingDim) follows
  `L = still + clamp(vel × 0.3, 2)`, stepped back toward the tower 0.5 u at a
  time while `blocked(L, 0.01)`. The sweep keeps turning.
- **Launch:** `L` freezes. `addHazard({ source: 'shell', circle(L, 1.6), armMs: 1000, liveMs: 0, damage: 12, cover: 'none', hurt: 'hazard', owner })`.
  A shell sphere (r 0.22, MeshBasic 0xff8a50, `fog: false`, with an ember
  trail) flies a parabola peaking at 3.2 u, landing at arm. `mortar` and
  `whistle(1000)` play. It goes straight back to **watch**.
- A shell needs no line. It's the Flare rule, and it's what stops Still
  camping behind a post.

**Scald** (the answer to hugging the base). In watch only, if:

- Still is within 3.0 u of the centre,
- ≥ 2500 ms have passed since the last scald,
- and it isn't venting,

then → **scaldWind** (800 ms, `cue = windup`). The sweep stops. The base
plate hisses, and a ring tell at r 3.2 fills.
`addHazard({ source: 'scald', circle(pos, 3.2), armMs: 800, liveMs: 0, damage: 14, cover: 'fromCentre', hurt: 'melee', owner })`.
At the arm there's a steam burst, then → **watch**.

**Phase 2** (the first update with `hp < 495`):

1. `justPhase2`. Any track or lock in progress is cancelled (its hazard is
   removed with the fade; no vent). → **judder** for 600 ms: the head shakes
   ±3° at 25 Hz, `judder(600)`. The back lens ignites with a flash. The
   banner shows.
2. It resumes with **two wedges**, at `θ` and `θ + π`, same speed.
3. **Reversal:** every `U(4000, 7000)` ms, when in watch (not tracking,
   locked, live, venting or aiming a shell), → **judder** for 400 ms, then
   `omega = −omega`. The reversal is never a strike. The lance's own slack is
   unchanged.
4. **Cracking:** a post whose `lances` reaches 3 cracks, for good.
   - Both circles shrink to r 0.45; they stay solid.
   - The mesh swaps to `rubble_half` at scale 0.8.
   - `crack()` plays, with `vfx.chunks` and dust.
   - At `lances` 1 and 2 it's sparks and chunks only.
5. Shells: `hideMs 1600`, `cooldownMs 3000`.
6. There's still only **one lance at a time**. The first wedge to catch owns
   it.

**Death.**

- The lens goes out (`lensOut`), and the boss is buried as any boss.
- `bossDown`:
  - adds `arbiterHusk(x, z, headYaw)` to `level.group`, and sets
    `level.footprint.dead = false`, so the husk is solid;
  - drops at `pos + unit(still − pos) × 1.9` (outside the footprint);
  - sets the day tracker to `p = 1` (first dark) on the same tick;
  - opens the warm beam by `exitsAfterBoss(6)` (Home §4.3: `c + side × 4.5`).
- An unarmed lance is cancelled (H7). Shells in flight still land, less than
  a second away.

### 5.3 Timings against the slack rule

`slack = lockedMs − 300 − 1000 × escape ÷ 5.5`, target ≥ 150 ms. "Escape" is
the worst case: from the centre of what's drawn to its edge.

| tell | windup (≥ 620) | locked part | worst escape | slack |
|---|---|---|---|---|
| lance | 920 (track 360 + lock 560) | 560 | 0.45 (strip half) → 82 ms | **178** |
| shell (Arbiter and Lobber) | 620 aim + 1000 flight | 1000 (from launch) | 1.6 (r) → 291 ms | **409** |
| scald | 800 | 800 (fixed ring) | from the footprint edge (1.2 + 0.42 = 1.62) to 3.2 → 1.58 u → 287 ms | **213** |
| slag puddle | – (a death, not a windup) | `slagArm(d)` | 0.9 − d | **150** by construction (§5.3 rule) |
| reversal / phase-2 judder | 400 / 600 | not a strike | – | – |
| vent | – | a window, 1200 | – | – |

**The slag extension rule.**

- At the spill, `armMs = slagArm(d)`, where `d` is Still's distance to the
  corpse.
- If he's outside the puddle (`d ≥ 0.9`), it's the design's 400 ms.
- If he's standing on it, it's `450 + 1000 × (0.9 − d)/5.5`, at most 614 ms.
- The fill runs on that clock, so the tell stays honest.

**Hits are ≤ 22:** lance 18, shell 12, scald 14, mirrored lance 18.
**Windups are ≥ 620:** 920 / 620 / 800.

### 5.4 The wedge is a floor tell, not a light

- The wedge is a `CircleGeometry(15, 24, …)` sector of ±15° using
  `tellMaterial('radial', 15)` (ember, textured, animated). It lies at
  `DECAL_Y` in `worldGroup`.
- There's one mesh per wedge, and a second is built dark at construction for
  phase 2.
- Opacity: watch 0.10 (× `trackingDim()`), track 0.10 → 0.5, off in vent.
- **INV:** the Arbiter adds no `THREE.Light` to the scene (K-D10). Grace stays
  the only warm light. Its lenses are `MeshBasicMaterial`, `fog: false`, and a
  halo sprite (additive, `fog: false`) at scale 1.8.

### 5.5 The lance: walls block it both ways

- **Its reach:** the cut stops at the first solid in see mode, so a waist-high
  barrier, a post, a crate or the void all stop it. A Through-Line breach
  open at the lock lets it through, exactly as it lets a sentinel's shot
  through.
- **Its sight:** the catch needs a see-mode `lineClear`. Still hidden behind a
  post (the post shadows ±11.7° at the ring, and the wedge is ±15°) is never
  caught.
- **His shots:** walls stop Still's bolts as they always did, so from behind
  a post he can't hit it either, except with lobs (Flare, Signal Flare) and
  Ricochet banks, which are the design's intended answers.
- **Committed:** the cut is fixed at the lock. A breach that opens or closes
  after the lock changes nothing, because drawn = hit.
- **The strip hurts bodies alike.** An add wouldn't be spared, but the Arbiter
  has none. A thrown or held body is skipped (H2).

### 5.6 The heat beam

A lance that hits Still, whether taken or converted by Brace, heats one
button (H5) for `ARBITER.heat.ms = 4000`.

- **The button:** push-only while `now < hotUntil`. A tap does nothing (it
  isn't ready). A hold past 180 ms fires it with `pushed = true`: +2 strain,
  plus the part's own. A push fire sets `readyAt = max(now + cooldown, hotUntil)`.
- **On the HUD:** `.slot.hot`:
  - an ember rim (box-shadow `0 0 0 2px #ff6a3a` over the tier ring), textured
    by a CSS noise background at 30%;
  - its own sweep, `--heat = heatLeft / 4000 × 360deg`, drawn over the
    cooldown sweep in ember, draining clockwise;
  - the icon tinted 30% ember.
  - The existing `last` rule already shows a push that would Stop him.
  - When heat ends: `cool()` and a 150 ms fade.
- **First heat ever:** the caption "hot · hold to push" (placeholder) floats
  over the button for 2.4 s. It's stored as `save.hints` id `'heat'` (Home
  §4.23).
- **Never trapped:** a hot button always fires by push, and waiting 4 s frees
  it. Heat never adds strain by itself.

### 5.7 The model, rig and animation

Everything is primitives in the rusted-iron + ember-core language: shell
`0x4a3a36`, joints `0x221c1e`. There are five meshes, merged where rigid.

| part | geometry | notes |
|---|---|---|
| base plate | octagonal cylinder r 1.3, h 0.3 | the footprint; statusTint |
| lattice (merged, one draw) | 3 legs: each is 2 rods r 0.07, 0.14 apart, from the base ring (r 1.1, y 0.3) to the collar (r 0.45, y 3.7), plus 9 braces (rods r 0.05) zig-zagging between adjacent legs at y 1.2, 2.2, 3.0 | open: the floor shows through |
| boiler | cylinder r 0.55, h 1.0 at y 1.8–2.8, with 3 hatches (box 0.36 × 0.5 × 0.06) at 120°, each hinged on its top edge; a core box `0.26 × 0.34 × 0.04` behind each (MeshBasic CORE, `fog: false`) | the vent opens all three, so it reads from any side |
| collar | torus r 0.5, tube 0.08, at y 3.7; a mortar tube (cylinder r 0.18, h 0.7) on its side, tilted 50° | the shell comes from here |
| head (rotates about y) | housing box 1.1 × 0.7 × 0.9 at y 4.05; front lens: cylinder r 0.42, depth 0.2, plus an octahedron glass r 0.3 (MeshBasic CORE, `fog: false`) and a halo sprite; back lens: the same, dark (`CORE_ASLEEP`) until phase 2 | height 4.6 overall |

**Poses** (eased with `k = min(1, dt × 14)` unless snapped):

- **head yaw:** the wedge angle in watch. It follows `aim` in track, and is
  frozen in lock, live and vent. Judder adds `0.05 × sin(2π × 25 t)`.
- **lens:** 1 in watch, 1 → 1.35 in track, snapped to 1.5 at lock; 0.3 in
  vent (dim); 1 after.
- **fire:** the head recoils 0.2 u along `−aim` in 80 ms, then back over 300 ms.
- **hatches:** open by 1.2 rad in vent. The cores pulse
  `1 + 0.25 sin(t × 9)` (the Assembler's open-grill beat).
- **shell aim:** the mortar tilts toward L, and recoils 0.1 u at the launch.
- **scald:** the base plate lifts 0.04 u and settles.
- **asleep:** the head faces the entrance, and the lens and cores are
  `CORE_ASLEEP`. Wake flashes the body (`flash = 1`).
- **`dress(vfx)`** (11 Hz): a smoke puff from the collar every other call;
  in phase 2, embers from both lenses; in vent, steam at the hatches.
- **`strikeFx`:** lance, a flash at the lens and 14 sparks along the first
  2 u; scald, dust r 3.2; shell, smoke at the mortar.
- **Husk:** the lattice and base in `0x2a2224`, the head tilted `rotation.x = 0.4`,
  no lenses.

Its fixed draw count is 6 (base, lattice, boiler, collar and mortar, head,
lenses), plus the halos, 2 wedges and a hazard. The Assembler's is about 30.

### 5.8 Its interplay with the 30 parts

| part | rule |
|---|---|
| **Lure** (T7) | The Arbiter ignores the decoy, as every boss does (`targetFor`). The wedge tests Still only. The burst still hits the tower (18, ×1.5 in vent). There are no adds, so Lure is weak here, by design (contradiction 17). |
| **Ward** (T2) | The lance counts as a shot: Ward destroys it, with no damage and no heat. Shells and scald aren't stopped (card line §6.3). Its value is to raise it at the lock. |
| **Mirror Ward** (T6) | The lance is reflected: a cold bolt from Still to the tower, 18 damage, which lands inside the vent (×1.5 = 27) if it flies clean. Walls stop it. It uses one of its 6 reflects. The "big committed moment" is standing in the wedge on purpose. |
| **Anvil** (A7) | It catches scald (`hurt: 'melee'`): the 30 counter lands on the tower. It never catches the lance, shells or slag (`'hazard'`). |
| **Parry Clamp** (A4) | `interrupt()` returns false, as for the Assembler. It takes the 10, and nothing breaks. |
| **Through-Line** (H7) | Its 4 s breach opens cover both ways: its bolt reaches the tower through a post, and a lance locked while the breach is open passes through it too. That's symmetric and honest (the rails show the long cut). |
| **Brace** (T5) | It converts a lance to `ceil(18/8) = 3` strain, **and the heat still applies**. With a hot button that's a real Stopped risk at the end of the run, which is the design's point. Scald → 2, shell → 2. |
| Flare, Signal Flare | They lob over posts: the intended plink from shade. |
| Ricochet Lens | It banks around posts. A banked hit arms nothing (it isn't a sentinel). |
| Clamp Toss, Rusted Hook, Piston, Vent, Backdraft | `knockMul 0`, so no displacement. Toss deals its 14 (the boss rule). |
| Chill Vent, Frost Trail | They slow the walk only, so nothing (it doesn't walk). Rime still tints it. |
| Borrowed Time | It rewinds HP, not heat. |
| Patient Lens, Overrun | A hot slot hands them a push without the wait. They still pay +2. |

---

## 6. Enemies

### 6.1 The thief (from depth 2)

**What it is.** A small machine, 1.1 u tall, that never attacks.

- Its body is a low rusted beetle on four thin legs (box 0.6 × 0.3 × 0.8 on
  rods r 0.04), with one dim ember eye (MeshBasic `0x6a2a1c`, `fog: false`).
- A birdcage rides on its back: six bars (r 0.02, h 0.5) on a ring r 0.22,
  capped by a ring and a hook.
- While it carries, the found part rides inside at scale 0.35. It's
  `buildModel(def.slot, def.id, 'display')` (appearance §2.1), with every
  material under it swapped to one `MeshBasicMaterial` `0xcfe4ff` × 0.9
  (`fog: false`), plus a cold halo sprite (scale 1.2, additive, `fog: false`).
  That's the **only cold light on any enemy**.
- The model's geometry is cached and shared (never disposed). The thief
  disposes only its own cold material and halo.

**Behaviour (`ThiefState`):**

| state | does | leaves when |
|---|---|---|
| **dormant** | It sits in its nest, looking at the room's centre, eye dim. It isn't targetable by the auto or aimed parts (§6.1 targeting). | a ground part has been landed for ≥ 600 ms and isn't guarded → **fetch** (`onThief wake` the first time: a notebook meet) |
| **fetch** | It runs at 6.0 u/s along its own BFS (floor ∖ cells of rooms not in `allowedRooms`, its own room always allowed) to the nearest unguarded part (by BFS). | it reaches `≤ 0.6` of the part and the part is still unguarded → `lift(g)`, **carry**, `snatch`. If the part becomes guarded → **wait**. If the part is taken → back to dormant at the nest. |
| **wait** | It hovers on a point 5–7 u from the part, away from Still, and faces the part. | guard lifted → fetch; part taken → dormant (walks home) |
| **carry** | It runs at 6.0 to the **refuge**: the allowed room whose centre has the largest BFS distance from Still, recomputed each time it enters this state. Every 2500 ms of running → **listen**. `thiefChime` every 1.4 s; the cage is lit. | it reaches the refuge's centre (≤ 0.8) → **settled** |
| **listen** | It stops for 800 ms, head up (an ear-tilt pose). | → carry |
| **settled** | It sits with the part lit. | Still within 7 u → **carry** (after one 400 ms listen) |
| **caught** | `dead = true`. `loot.drop(carrying, pos, still.pos)`, `cageOpen`, `onThief caught`. | buried; nothing else drops |

Average carrying speed: `6.0 × 2.5 / 3.3 = 4.55` u/s, under Still's 5.5.
From 6 u behind he closes the gap in about 6.3 s. A Chill Vent or Frost Trail
slow halves its walk (speedMul), as for any enemy.

**Catch rules:**

1. **Tackle:** while `carrying`, Still's centre within 1.1 of its centre →
   caught (`how: 'tackle'`).
2. **HP:** it has 12 HP (three autos, one Lens), and any damage counts. A
   Clamp Toss landing kills it. At 0 → caught (`how: 'hp'`).
3. While **dormant or waiting** (empty), a kill drops nothing. It had nothing.
4. The Hook yanks it (`knockMul 1`). Parry can't interrupt it (it never winds
   up; `interrupt()` returns false).

**Safety rules (INV):**

1. It **never attacks**: its update never returns an action.
2. It **never leaves the level**. Its BFS is over `level.floor`, and it never
   targets the exit room or stands within `EXIT_RADIUS + 1` of either beam.
3. It **can't take a part Still is standing over**: a part is guarded while
   Still's centre is within 1.5 of it. That's larger than `pickupRadius`
   1.15, so a part whose card is showing is always guarded.
4. It **never runs through a room with an asleep pack**. `allowedRooms`
   excludes them, and its BFS treats their cells as walls. If the only way
   is blocked, it settles where it is.
5. It's **not in `combat.awake`**, so it doesn't count for the quiet,
   `fighting`, the music or the camera. It has no pack, so it never wakes a
   pack.
6. **Hazards never hurt it** (H2), and mites, rams and Lure ignore it.
7. It **never appears on a boss level or the walk home**.

**Loot rules (INV):**

1. It adds no loot. `carrying` only ever holds a def lifted from
   `loot.ground` this level. It never spawns carrying.
2. It carries **at most one** part, and ignores others while carrying.
3. A catch drops **that** part (the same def, its `new` tag intact). Found is
   still marked only when Still takes it (Home §4.8).
4. If Still leaves the level with a part caged, that part is lost, exactly as
   a part left on the floor at a beam is (Home §4.15).
5. `KILL_WEIGHT.thief = 0`, so no roll ever happens for it.

**Targeting.** `Combat.nearest` and `pickTarget` skip a thief unless it's
`carrying`. Bolts that pass through it hit it either way.

**Notebook.** `wandering-drone` (Home §7.3 #1) becomes role `'thief'`:

- met on its first `wake`;
- felled on `caught`;
- the first-meet name floats over it.

**Spawn.** `level.thief` (G8). `enterLevel` builds
`new Thief(nest.x, nest.z, nest, world)` and adds it to `combat.enemies` with
no pack. `loot.lift(g)` removes `g` from `ground` and the scene, and returns
its def.

### 6.2 Slag cores (area II)

A body with `slag: true` (G7) wears a molten core.

- The core colour is `0xff8a3c` instead of `CORE` (asleep: `0x3a1a0e`, not
  `CORE_ASLEEP`), which reads hotter, not redder.
- Main's `ambientFx` drips 1 ember from it every 0.33 s while it's awake.
  The tell is on the body before the kill.

**The spill.** In `bury(e)`, if `slagged(e) && !hazardKilled.has(e)`:
`addHazard({ source: 'slag', circle(e.pos, SLAG.r = 0.9), armMs: slagArm(dist(still, e.pos)), liveMs: 1600, damage: 8, cover: 'none', hurt: 'hazard' })`.
`slagSpill` plays at the spill and `slagArm` at the arm.

- It hurts Still and enemies alike, and hits each once (H3). A kill by it
  never spills again (H6).
- **Loot:** a drop from that kill lands 0.8–1.6 u from the corpse (the
  existing hop). It can be taken from outside the puddle (`pickupRadius`
  1.15 > 0.9), or after 2 s.
- **No mites carry slag cores**, so eight puddles never happen. No leaders,
  lessons or bosses do either.

### 6.3 The Lobber (sentinel variant, lesson at depth 5)

**What it is.** A squat crucible on three legs, 1.5 u tall:

- the sentinel's tripod rod builder, with knees at 0.9 and feet splayed at
  0.9 u;
- a body: cylinder r 0.42 → 0.3, h 0.5, open at the top;
- inside the lip, a molten disc (MeshBasic CORE, `fog: false`) with a halo.
  That's its face and its tell.

`kind: 'ranged'`, `variant: 'lobber'`, BE 1, treasure and `KILL_WEIGHT` as a
sentinel. Its elite mods are the sentinel's (Quick, Plated, Warden).

**Behaviour:**

- **approach:** it holds 8–12 u:
  - beyond 12 → `nextStep` toward;
  - under 8 → it backs off (straight away, `clampMove`);
  - in the band it strafes like the sentinel.
- **No line of sight is needed to fire** (the Flare rule). The conditions:
  `reload ≤ 0 && dist ≤ 13 && canLock(620)` → `book(this, 620)`, → windup.
- **windup (620 ms):** the crucible tilts back 0.5 rad, and the disc swells
  1 → 1.4. A faint ring (r 1.6, opacity 0.16 × trackingDim) follows
  `L = target + clamp(vel × 0.3, 2.0)`, stepped back toward the Lobber while
  `blocked(L, 0.01)`. `cue`: `lobAim`.
- **launch (lock):** `L` freezes, and it returns
  `{ kind: 'hazard', spec: { source: 'shell', circle(L, 1.6), armMs: 1000, liveMs: 0, damage: 10, cover: 'none', hurt: 'hazard', owner: this } }`.
  The shell sphere flies a parabola peaking at 3.2 u. `mortar` and
  `whistle` play. `locked = true` for the TELL_CROWD count. Then recover
  (500 ms), and `reload = 2400` from the launch.
- `interrupt()` (Parry, a grab) works in windup only: the ring goes, and
  `reload = 1500`. Once launched, the shell is committed.
- Lure: it aims at the decoy when drawn (`targetFor`), so its shell lands
  among whatever the decoy drew.

**Slack:** 1000 − 300 − 291 = 409 ms from the launch. It fits the balancer's
fix (r 1.6 and 1000 ms).

**Card lines** (`abilities.ts`):

- Ward: "A brief shield that destroys enemy shots. Not shells."
- Mirror Ward: "A brief shield that sends enemy shots back at whoever fired
  them. Not shells."

**Notebook:** `hollow-repeater` becomes role `'lobber'` (Home §7.3 #8).

### 6.4 The slag heap (a look for the Works' mites)

A pack with `look: 'heap'` (G11) is a normal `M6` brood. Only its sleep and
wake look different. There's no new rule.

- **Asleep:**
  - the nest spot uses `nestR 0.8, nestGap 0.5`;
  - the MiteBatch hides its mites (scale 0);
  - a **mound** sits at the nest centre: a sphere r 1.0 scaled y 0.55,
    skinned `rock` (Metal063), not solid;
  - on it, **six coals**, one per mite: spheres r 0.09, MeshBasic
    `0x3a1a0e` → `0x7a2a14` at 0.3 Hz, `fog: false`, placed at each mite's
    position lifted onto the mound's surface. They're the same count and the
    same dots the mites wear awake.
- **Waking (the shed):** the brood's `rippleWake` sets
  `wakeDelay = HEAP.stepMs (200) × rank`, rank 0..5 by angle round the
  centre, so the last emerges at 1000 ms.
  - Each mite becomes visible at its coal as its delay ends, with a 0.3 u hop
    (`vfx.embers`, `pop`), and its coal goes out.
  - The mound slumps to scale y 0.2 over 1200 ms and stays as a dark,
    non-solid lump for the level.
- Mites with `wakeDelay > 0` already don't act (the existing rule), so the
  shed is the tell. Budget: BE 1.5 (M6). **Notebook:** `slag-heap` becomes
  role `'heap'`.

### 6.5 Pack tables, depths 4–5

The budget is unchanged: `B = 2 + floor(rand × 2) + floor((d − 1)/2) + (big && d > 2 ? 1 : 0)`.
That's main 4–5 / side 3–4 at depth 4, and main 5–6 / side 4–5 at depth 5.

`CAPS`:

- d ≤ 4: `{ chargerPacks 2, swarmPacks **2**, chargersPerPack 1, kinds 2, lobberPacks **0** }`
- d 5–6: `{ chargerPacks 3, swarmPacks 2, chargersPerPack 2, kinds 3, lobberPacks **3** }`

The Lobber counts as kind `ranged` for the kinds cap.

**Pack rule (INV):** lobbers + sentinels ≤ 2 bodies per pack.

**Depth 4, the Works:**

| room | template | BE | weight / rule |
|---|---|---|---|
| lesson (a full 5×5 main) | `M8` (open nest, **not** a heap: the lesson reads first) | 2 | as today |
| 1–2 mains | `C+H+H` / `C+H+S`, filled with H | 3.5 / 3.5 (+fill) | 2 / 1, as today |
| **the heap** (one room with progress > the lesson's, main first, else a side; `stream(seed, SALT.heap)() < 0.6`) | `M6+H`, filled with H under kinds 2, `look: 'heap'` | 2.5 (+fill to B) | – |
| the rest | today's H/S generator | B | – |

**Depth 5, the quarter:**

| room | template | BE | weight / rule |
|---|---|---|---|
| **lesson** (the main room with the highest progress, full 5×5, else a hall) | `L+H+H`, not filled, never elite | 3 | always |
| every other room | weighted pick from D5 below, under the caps and `BE ≤ B + 1`, then filled with H under kinds 3 | – | – |

| D5 row | BE | weight | note |
|---|---|---|---|
| `M8+S` | 3 | 1 | the screen (existing) |
| `C+C+H` | 4 | 1 | bulls (existing) |
| `C+H+H+S` | 4.5 | 1 | existing |
| `M6+H+H` | 3.5 | 1 | existing |
| **`L+H+H`** | 3 | 1 | circles over the furniture (after the lesson) |
| **`M6+L`** | 2.5 | 1 | rings on the floor, circles from the sky |
| **`C+H+L`** | 3.5 | 1 | the ram flushes you, the shell punishes hiding |
| today | B | 2 | existing |

- Rows with `C` are never in side rooms (existing).
- Rows with `L` are refused once `lobberPacks` is reached.
- `D7` stays in the file and stays unreachable (enemies spec §8.2; the run
  ends at 6).
- Slag flags (G7) are drawn after this, on every non-lesson, non-leader
  hulk, ram and sentinel.

---

## 7. The day moves with you (`src/day.ts`)

```ts
export class DayTracker {
  /** Target progress, 0..1, never decreasing within a level. */
  target = 0
  /** What's drawn: eases toward target (0.4/s rooms, 1.5/s boss). */
  shown = 0
  enter(depth: number): void           // target = shown = 0 (bossFelled resume at 6: 1)
  /** rooms: the spine room containing Still; boss: 1 − hp/maxHp; hold: 0. */
  update(dt: number, depth: number, level: Level, still: THREE.Vector3, boss: Boss | null): void
  snap(p: number): void                // bossDown at 6: target = shown = 1
}
```

- **Rooms (depths 1, 2, 4, 5):** `target = max(target, level.progressOf(level.spineAt(still)))`.
  Side rooms and corridors don't advance it, and walking back never lowers it.
- **The boss at 6:** `target = 1 − hp / maxHp`. It follows HP both ways, but
  HP only falls, so it's monotonic. It holds at 1 after the kill.
- **Depth 3 holds noon.** The sun's high point; the Assembler's arena is two rooms.
- **Easing** is on game time only (it runs inside `simulate`, so pause and
  hitstop hold it): `shown += (target − shown) × min(1, dt × rate)`.
- **Applying:** each frame where `|shown − last| > 1e-4`, run
  `applyDayMix(world, dayAt(depth, shown))`. That sets the Home fields plus
  bloom, rim and the fog clamp. `reapplyDay` (the grade panel) uses the
  current mix.
- **Music** reads `shown` for the area II tempo (§4.5) and the Arbiter's pad
  cutoff.
- At a room step of 0.2 with a 0.4/s ease, each change takes about 5 s. You
  never see it happen; you notice the fog is closer.

---

## 8. State machines

### 8.1 The run (Home §3, unchanged)

No new phase, and no new terminal state:

- The Arbiter's lance breaks Still through `hurtPlayer` (→ `broken`).
- Heat reaches Stopped only through a chosen push (→ `stopping`).
- The kill opens the warm beam (→ `homing` → `toWalk` → `walkHome`).
- All three commit at the trigger, and all three arrive in the Workshop.

### 8.2 The Arbiter

| from | trigger | to |
|---|---|---|
| asleep | its pack wakes (12.5 u) | unfold |
| unfold | 1500 ms | watch |
| watch | catch (§5.2: in a wedge, ≤ 15 u, see-line clear, re-armed, `canLock(360)`) | track |
| watch | hidden ≥ hideMs, ≤ 15 u, no shell up, cooldown done, `canLock(620)` | shellAim |
| watch | Still ≤ 3.0 u, scald cooldown done | scaldWind |
| watch (phase 2) | reversal timer | judder (400) |
| track | 360 ms | lock (lance hazard created) |
| lock | hazard arms (560 ms) | live |
| live | 120 ms | vent |
| vent | 1200 ms | watch (sweep resumes at aim) |
| shellAim | 620 ms (launch: shell hazard) | watch |
| scaldWind | 800 ms (arm: scald hazard) | watch |
| judder | 400 ms (reversal: omega = −omega) / 600 ms (phase 2: two wedges) | watch |
| any but dead | first update with hp < 495 | judder (600), cancelling track and lock |
| any | hp ≤ 0 | dead (buried; husk; warm beam) |

```
 asleep ─wake─► unfold ─1.5s─► WATCH ◄─────────────────────────────┐
                                 │  │  │  │ (p2) reversal            │
                   catch+sight ──┘  │  │  └──► judder ──────────────┤
                  hidden ≥ hideMs ──┘  │                             │
                         hug ≤ 3 u ────┘                             │
   track ─360─► lock ─560─► live ─120─► VENT ─1200─────────────────►│
   shellAim ─620 (launch)──────────────────────────────────────────►│
   scaldWind ─800 (arm)────────────────────────────────────────────►┘
   hp < 55% (once) ─► judder 600 ─► two wedges, reversals, cracking
```

### 8.3 The Lobber

approach → (reload ≤ 0, ≤ 13 u, `canLock(620)`) → windup (tracking ring)
→ 620 ms: launch → strike (1 tick) → recover 500 → approach.
`interrupt` in windup → approach with `reload = 1500`.

### 8.4 The thief

```
dormant ─part landed ≥600ms, unguarded─► fetch ─reached, unguarded─► carry ⇄ listen (every 2.5 s, 0.8 s)
   ▲                                        │ guarded ▲ unguarded          │ at refuge
   └──── part taken ◄─── wait ◄─────────────┘         └────── settled ◄────┘
                                                        Still ≤ 7 u ─► listen 400 ─► carry
 any carrying state ─ tackle (≤ 1.1) or hp 0 ─► caught (part drops)
 dormant / wait ─ hp 0 ─► caught (nothing drops)
```

### 8.5 A hazard

`telegraph (armIn > 0) ─► armed tick (hits inside) ─► live (liveMs, each body once) ─► fade (300 ms) ─► removed`;
`telegraph ─ owner dead && cancelOnDeath ─► fade`.

---

## 9. Build order

Each step ends playable. The verifier's order, with the thief last. About 14
evenings.

| # | step | about | playable after | milestone |
|---|---|---|---|---|
| 1 | Foundations: the `Boss` interface (Assembler behind it), the `Hazard` primitive with dev spawning, `PlaceDef` / `lookAt` with the Works and the quarter still copies of the ruin, fog-free cores | 2 | the same game, on new plumbing | v0.1 |
| 2 | The Works: vendoring, 3 surfaces, gen presets (floors, machines), works room tone, plate steps, the area II music loop and tempo, slag cores, the slag heap | 3 | depth 4 looks, sounds and burns differently | v0.1 |
| 3 | The quarter: furniture, 2 surfaces, progress, density gradient, far-side frames, the walk re-skinned, the quarter tone and wood steps, the Lobber and its lesson, the D5 rows, card lines | 3 | depth 5 and the walk home | v0.2 |
| 4 | The Arbiter, phase 1: the square, the posts, the tower rig, the wedge, lance, vent, shell, scald, heat and its HUD; `ARBITER_AT_6 = true` | 3 | a new last fight | v0.2 |
| 5 | The Arbiter, phase 2: two wedges, reversals, cracking, the anvil kit, the husk, save v2 and NAMED | 1.5 | the whole fight | v1.0 |
| 6 | The day moves with you: `DayTracker`, `dayAt` spans, first dark, rim, bloom, the fog clamp, Grace held constant | 1 | the whole day, down to first dark | v1.0 |
| 7 | The thief: body, cage, BFS, states, safety, loot, notebook page | 2 | area I's variety | v1.0 |

**Step 1** (`boss.ts`, `combat.ts`, `enemy.ts`, `hazard.ts`, `areas.ts`,
`main.ts`, `hud.ts`, every class with a core)

- `Boss`, `isBoss` and `makeBoss`. The Assembler getters, the wave and summon
  action fields, and the §3.1 table.
- `Hazard`: its tick, tell, events, `HurtSource 'hazard'`, and `__hazard` /
  `__hazards`.
- `PLACES` with `works` and `quarter` equal to `ruin` except `id`.
  `lookAt` and its call sites.
- `fog: false` on cores.
- **Done when** K-A1–A7 pass, plus Home A1–A8 and G5 and the enemies/parts
  suites unchanged.

**Step 2** (`kit.ts`, `dungeon.ts`, `machines.ts`, `ambience.ts`, `audio.ts`,
`music.ts`, `swarm.ts`, `combat.ts`, assets)

- The 4 Works GLBs, 3 surfaces, `FALLBACK`, `setSurfaces`, the `grate` role.
- G1–G3 and G6–G7 for the Works, and CAPS(4) swarm 2.
- The heap (G11, §6.4) and slag (§6.2).
- The works mood, plate steps, and area II music. Delete unused GLBs.
- **Done when** K-B1–B8 pass. Re-baseline `__gen(4, s)`.

**Step 3** (`kit.ts`, `dungeon.ts`, `lobber.ts`, `combat.ts`, `abilities.ts`,
`ambience.ts`, `notebook.ts`, assets)

- 9 quarter GLBs, 2 surfaces, G3–G5 for the quarter, and G10.
- The Lobber, the D5 rows and caps, and the lesson.
- The quarter mood.
- **Done when** K-C1–C9 pass. Re-baseline `__gen(5, s)`.

**Step 4** (`arbiter.ts`, `dungeon.ts` G9, `hud.ts`, `style.css`, `main.ts`,
`audio.ts`, `ambience.ts` square)

- **Done when** K-D1–D10 and K-D12 pass, and Home A1/A7 still pass with the
  Arbiter at 6.

**Step 5** (`arbiter.ts`, `music.ts`, `save.ts`, `main.ts` commit and `NAMED`)

- **Done when** K-D11, K-D13–D15 and K-I1–I3 pass.

**Step 6** (`day.ts`, `areas.ts`, `world.ts`, `kit.ts` rim, `main.ts`)

- **Done when** K-E1–E6 pass, and Home D1–D4 pass with the tracker at 0.

**Step 7** (`thief.ts`, `dungeon.ts` G8, `combat.ts`, `loot.ts`, `main.ts`,
`notebook.ts`, `audio.ts`)

- **Done when** K-F1–F10 pass, and Home A8 still passes for depths 1–3.

**MVP staging.**

- **v0.1** (steps 1–2): the plumbing, and depth 4 as the Works with slag and
  heaps.
- **v0.2** (steps 3–4): the quarter, the Lobber, and the Arbiter's first
  phase. The run is complete with its new boss.
- **v1.0** (steps 5–7): the Arbiter's second phase, lights out and the day,
  and the thief.

**Fallback.** If step 4 stalls, `ARBITER_AT_6 = false` restores Home's second
Assembler with rams and mites. That's one evening, and already built.

---

## 10. Acceptance

### 10.1 The five core mechanics

**The three outcomes, in the new last fight**

- *Given* the Arbiter awake at depth 6 and Still at 18 HP in the open, *when*
  a lance lands (18), *then* the phase is `broken`, and a card with
  `end: 'broken', depth: 6, hour: 'dusk'` is stored before the first
  `broken` tick.
- *Given* strain 18 and a hot head button, *when* the player pushes it, *then*
  the ending is `stopped`, by the same path.
- *Given* the Arbiter felled, *when* Still walks into the warm beam, *then*
  it's `home`, through `toWalk` and `walkHome` on the quarter's kit at night.

**Never trapped (the vent analog): heat can't lock a button**

- *Given* a hot slot, *when* it's tapped, *then* nothing fires.
- *And* when it's held 200 ms, *then* it fires with +2 strain.
- *And* when nothing is pressed for 4 s, *then* `isReady` is true again (if
  its own cooldown is done).
- *And* in no Arbiter state is Still's movement or any push blocked.

**The reward fork**

- *Given* depth 6 with the Arbiter down, *then* `__exits()` has `warm` open
  and `cold` null. The level has exactly one beam mesh visible, and
  `exitsAfterBoss(6)` is `['warm']`.

**The kept thing persists across the save change**

- *Given* a v1 save with 3 cards and history, *when* v2 code boots, *then*
  the cards are identical, every history tuple has length 7 ending in 0,
  and `v === 2`.
- *And* an ending wearing a part at the Arbiter's kill gives it
  `", that saw the Arbiter"` on its next drop.

**The game-specific mechanic: the lance and cover**

- *Given* Still behind a post (the post between him and the tower), *when*
  the wedge passes over him, *then* no lock happens.
- *Given* he's in the open, *when* it locks, *then* the lance's cut ends at
  the first solid. A lance aimed at a spot behind a post stops at the post,
  and his own bolt from that spot toward the tower is also stopped by it.

### 10.2 Headless checks

**Setup** as Home §9.2: Playwright, fresh context, `npx vite --host`, one
synchronous `page.evaluate` per stepped check.

**Hooks used:**

- existing: `__arena`, `__spawn`, `__step`, `__fire`, `__equip`, `__stick`,
  `__combat`, `__still`, `__hud`, `__level()`, `__gen`, `__pack`, `__until`,
  `__enter`, `__run`, `__world`, `__parts`, `__crate`;
- Home: `__mode`, `__save`, `__setSave`, `__exits`, `__exitsAfterBoss`,
  `__killBoss`, `__strain`, `__end`, `__continue`, `__day`, `__dropAt`,
  `__take`, `__offer`, `__notebook`, `__labels`, `__runStats`, `__hold`.

**New hooks** (DEV only, `main.ts`):

| hook | returns / does |
|---|---|
| `__spawn(kind, x, z, awake?, elite?, variant?)` | extended: `variant: 'lobber'`; `kind: 'thief'` (nest = spawn point); `kind: 'boss'` with `variant: 'assembler' \| 'arbiter'` (the square's posts are built by `__arena({ posts: true })`) |
| `__arena({ boxes?, circles?, auto?, posts? })` | extended: `posts: true` adds the 8 posts round (0, 0) and returns them |
| `__hazard(spec)` / `__hazards()` | add one / `[{ source, shape, armIn, liveLeft, damage, hit: ('still' \| number)[] }]` (enemy = index in `__combat.enemies`) |
| `__boss()` | `{ kind, hp, phase2, open, state, wedges: number[], omega, aim, cut: {x, z} \| null, posts: { x, z, lances, cracked }[] } \| null` |
| `__thief()` | `{ state, x, z, carrying: PartId \| null, nest: { x, z } } \| null` |
| `__look()` | `{ place, surfaces, ambience, footsteps, music }` |
| `__genLook(d, s)` | `{ props: { piece, x, z, top, p, breakable }[], tall: { what, x, z, hides }[], floors: { piece, p }[], packs: (as __gen, + slag counts, look), thief: { x, z } \| null }`, generated and thrown away |
| `__day()` | extended with `{ progress, from, to, exposure, bloom, rim }` |

**K-A: foundations (step 1)**

- **K-A1.** `__enter(3)`, then:
  - `__combat.boss.def.kind === 'assembler'`;
  - `phase2 === false`, `open === false`, `anchored === null`;
  - after `__combat.boss.hit(900 × 0.5)` and `__step(0.05)`,
    `phase2 === true`.
  - The enemies spec's Assembler checks (10.x) pass unchanged.
- **K-A2.** Hazard: `__arena()`, a hulk at (3, 0) (`__spawn('chaser', 3, 0, false)`),
  `__hazard({ source: 'slag', shape: circle(0, 0, 3.6), armMs: 500, liveMs: 0, damage: 8, cover: 'none', hurt: 'hazard' })`,
  then:
  - `__step(0.45)` → `__combat.hp === 100`;
  - `__step(0.1)` → HP 92, and the hulk's HP 22;
  - `__step(1)` → no further damage to either;
  - the hulk's pack is awake.
- **K-A3.** Live and once: `__arena(); __still.pos.set(3, 0, 0)`, then a
  circle at (0, 0), r 1, `armMs 100`, `liveMs 1000`. `__step(0.2)` → no hit. Walk him in:
  `__still.pos.set(0, 0, 0); __step(0.05)` → one hit. `__step(0.8)` → still
  one hit.
- **K-A4.** Cover: a scald-like circle r 4, `cover: 'fromCentre'`, with a
  box between the centre and Still at (3, 0) → no hit on Still. The same with
  `cover: 'none'` → a hit.
- **K-A5.** No chains:
  - a slag-cored hulk killed by a hazard spills nothing
    (`__hazards().length` returns to 0);
  - killed by a bolt (`__equip('focusing-lens'); __fire('head')`), it spills
    exactly one.
- **K-A6.** Fog:
  - after `__enter(4)`, walking `__world.scene` finds every material whose
    colour is CORE-ish (r > 0.8, g < 0.5) or that is a tell ShaderMaterial,
    and every one has `fog === false`;
  - `__world.scene` holds no `THREE.Light` except the hemisphere, the key and
    Grace's.
- **K-A7.** `__look()` at depths 1–6 gives places ruin ×3, works, quarter,
  quarter. `__gen(d, s)` for d 1..3 and s 1..20 is deep-equal to Home's A8
  baseline.

**K-B: the Works (step 2)**

- **K-B1.** Every piece in `PIECES` resolves:
  `pieceData(p).geometry.attributes.position.count > 0`. With the fetch for
  `keg.glb` intercepted to 404 (a Playwright route), boot still reaches
  `crawl`, and `pieceData('keg')` has the barrel's vertex count.
- **K-B2.** `__genLook(4, s)` for s 1..50:
  - every `props[i].top ≤ 1.45`;
  - every `tall[i]` has `hides === false`;
  - no floor piece outside the Works table;
  - machines are present in ≥ 45 of 50.
- **K-B3.** Walls waist-high: in `__genLook(4, s)` and `(5, s)`, every
  placement within 0.5 u of a floor edge is `barrier` or `column`.
- **K-B4.** No cot: `JSON.stringify(PLACES.works) + JSON.stringify(PLACES.quarter)`
  doesn't match `/bed|cot|crib|cradle|toy/`.
- **K-B5.** Slag rate: over `__gen(4, s)` for s 1..200, the share of
  eligible hulks with `slag` is in [0.35, 0.45], and it's 0 on mites,
  leaders and lessons.
- **K-B6.** Slag arm:
  - a slag hulk killed at (2, 0) with Still at (0, 0) → a hazard with
    `armIn` ≈ 400;
  - killed with Still at its centre → `armIn` ≈ 614 (± 17);
  - either way the hazard hits Still only if he's inside at arm.
- **K-B7.** The heap:
  - over `__gen(4, s)` for s 1..100, a heap pack appears in [50, 70];
  - every heap room's progress is > the lesson room's;
  - no level has more than 2 swarm packs.
  - `__pack([...6 mites], true)` with `look: 'heap'` → the mites'
    `wakeDelay` values sorted are 0, 200, …, 1000.
- **K-B8.** Sound and look at depth 4: `__look().ambience === 'works'`,
  `footsteps === 'plate'`, `music === 'II'`. `__day().day === 'afternoon'`.

**K-C: the quarter and the Lobber (step 3)**

- **K-C1.** Density rises: over `__genLook(5, s)` for s 1..100, the mean
  props per main 5×5 room at p 0.2 is < 5, at p 0.8 is > 6.5, and the
  correlation of p with props is > 0.6.
- **K-C2.** Intact rises: the share of `intact` pieces among props at
  p ≥ 0.6 is > 2× the share at p ≤ 0.4.
- **K-C3.** Far side: every far-side piece has `hides === false`, is ≥ 1
  cell from floor, and their count per level at p ≥ 0.6 exceeds that at
  p ≤ 0.4.
- **K-C4.** The lesson: every `__gen(5, s)` for s 1..100 has exactly one
  `lesson` pack with template `L+H+H`, in the room of highest progress among
  full mains (or a hall). No pack has lobbers + sentinels > 2. No level has
  more than 3 lobber packs. There are no lobbers at depth 4.
- **K-C5.** Over walls:
  - `__arena({ boxes: [a wall between] })`, a Lobber at (0, −10), Still at
    (0, 0). Wait until it launches (`__hazards()` has a shell).
  - The shell's circle centre is within 0.1 of `still + vel × 0.3`.
  - `armIn` = 1000 ± 17 at the launch.
  - Still standing still is hit for 10.
- **K-C6.** Moving beats it: the same setup, but at the launch Still walks
  +x for 0.4 s (2.2 u) → no hit.
- **K-C7.** Ward: with Ward's window up at the arm, the shell still hits.
  With a sentinel's shot, Ward still destroys it (the parts check T-W
  unchanged).
- **K-C8.** Lock book: a Lobber and a sentinel waking together never lock
  within 300 ms of each other over 60 s (`__enemyLog` lock events).
- **K-C9.** At depth 5: `__look()` is quarter / quarter / wood / II. During
  the walk home (Home A7), `__look().place === 'quarter'` and
  `__day().day === 'night'`.

**K-D: the Arbiter (steps 4–5)**

Setup: `__arena({ posts: true })`, then
`const b = __spawn('boss', 0, 0, true, undefined, 'arbiter')`.

- **K-D1. Numbers.** `b.hp === 900`. Every hazard it creates over a 120 s
  scripted fight (Still circling at r 10) has `damage ≤ 22`. Every windup
  it starts (onWindup ms) is ≥ 620.
- **K-D2. Unfold and first catch.** From the wake, no lock event fires for
  ≥ 4.0 s with Still standing in the open at (0, 12).
- **K-D3. Catch, track, lock, fire.** Still at (0, 10) in the open:
  - `__until(() => __boss().state === 'track', 12) >= 0`;
  - then `state === 'lock'` 0.36 s later (± 1 tick);
  - `__hazards()` has a lance strip whose end is within 0.2 of the arena
    wall or 20 u;
  - 0.56 s later the lance arms;
  - Still, not moving, takes 18.
- **K-D4. Slack.** The same, but Still stands for 300 ms after the lock (the
  reaction), then walks perpendicular to the lance. At the arm (560 ms) he
  has walked 0.26 s × 5.5 = 1.43 u > 0.45: no hit.
- **K-D5. Walls both ways.**
  - Still at the ring behind post 0 (`P0 + 1.5 × radial`): over 20 s the
    wedge passes him at least twice, and `state` never becomes `track`.
  - A lance forced at him (dev `b.aim = angle; b.state = 'lock'`) has its
    cut within 0.3 of the post's circle.
  - `__fire('head')` with Focusing Lens from there: the bolt is blocked
    (`onShotBlocked`), and the tower's HP is unchanged.
- **K-D6. The vent window.**
  - Right after a live phase, `__boss().open === true` for 1.2 s (± 1 tick);
  - `b.hit(10)` during it removes 15;
  - after it, 10.
  - The wedge is off (no catch) during it.
- **K-D7. Heat.** After a lance hits:
  - exactly one slot has `__hud.heatLeft(slot)` in (3900, 4000], and it's
    the ready slot with the largest cooldown;
  - `__fire(slot, false)` does nothing (no cast in `__partLog`);
  - `__fire(slot, true)` casts, and strain goes up by 2 + the part's own;
  - after `__step(4.1)`, `heatLeft === 0`.
- **K-D8. Ward, Mirror, Brace, Anvil.**
  - Ward up at the arm → no damage, no heat.
  - Mirror up → no damage, no heat, one bolt spawned toward the tower, and
    the tower loses 27 when it lands in the vent.
  - Brace up → strain +3, HP unchanged, heat applied.
  - Anvil up at a scald arm → HP unchanged, and the tower loses 30. At a
    lance → the lance's 18 lands.
- **K-D9. Shell and scald.**
  - Still hidden behind a post for 2.1 s → a shell hazard (r 1.6,
    `armIn ≈ 1000`) lands at his lead point.
  - Still at (2.0, 0) → `scaldWind`, then a hazard r 3.2 arming 0.8 s later.
    Still stepping to (3.8, 0) within 0.45 s of the windup's start isn't hit.
- **K-D10. No lights.** The scene's `THREE.Light` count is the same before
  and after the spawn.
- **K-D11. Phase 2.**
  - After `b.hit(420)`: in the next update `justPhase2`, then
    `state === 'judder'` for 0.6 s, then `wedges.length === 2` with a
    difference of π.
  - Over 30 s, `omega` changes sign ≥ 4 times, each preceded by 0.4 s of
    `judder`.
  - Any track in progress at the change is cancelled with no damage.
- **K-D12. The floor shows.** In a 1280×720 render with Still at the far
  side behind the tower (`(−6, 0, −6)`), sampling a 20×20 px box on Still's
  screen position finds ≥ 50% of pixels within 20% of the same box rendered
  with the tower hidden. (It's a readability floor, not a pixel test of
  art.)
- **K-D13. Cracking.**
  - Phase 2, three lances forced into post 3's circle → `posts[3].cracked`,
    and its circles have r 0.45.
  - A lance aimed through where it stood now reaches further.
  - Phase 1 lances never add to `lances`.
- **K-D14. Death.**
  - `__killBoss()`: `__day().progress === 1` on the same tick.
  - `__exits().warm.open`.
  - `__level().footprint.dead === false`.
  - Both drops lie ≥ 1.9 from the centre.
  - An unarmed lance at the kill never arms.
  - The music kit was `'anvil'` while it was awake.
- **K-D15. Save.**
  - Wearing `scrap-cleaver` through the Arbiter's kill, then `__end('home')`
    → `history['scrap-cleaver'][6] === 1`.
  - The next `__dropAt('scrap-cleaver', …)` → `__offer().name` ends with
    `", that saw the Arbiter"`.

**K-E: the day (step 6)**

- **K-E1.** `__enter(5)`:
  - `__day().progress === 0`;
  - placing Still in spine rooms 1 → 4 and stepping 8 s each makes progress
    rise to about 0.8, never decreasing;
  - walking back to room 1 leaves it;
  - a side room doesn't move it.
- **K-E2.** Depth 3: progress stays 0, and `__day().day === 'noon'`
  throughout.
- **K-E3.** Depth 6:
  - after `b.hit(450)` and `__step(3)`, `__day().progress` ≈ 0.5 (± 0.03);
  - `exposure` ≈ `lerp(0.90, 0.86, 0.5) × grade.exposure`;
  - at the kill it's 1, and `__day().fogFar ≥ 58`.
- **K-E4.** Grace constant: across p = 0, 0.25, 0.5, 0.75, 1 at depth 6,
  `grace × exposure` varies < 2%.
- **K-E5.** Continuity: `dayAt(4, 1)` deep-equals `dayAt(5, 0)`, and
  `dayAt(5, 1)` deep-equals `dayAt(6, 0)`. No level ever reaches `night`.
- **K-E6.** Rim and bloom: at depth 6 with p = 1, `RIM.uRim.value === 0.35`,
  and `__world.bloom.threshold` ≈ `grade.bloomThreshold × 0.86`.

**K-F: the thief (step 7)**

Setup: `__enter(2)` on a seed with a thief (or `__spawn('thief', −8, 8)`), all
packs removed.

- **K-F1. Fetch.**
  - `__dropAt('ward', 0, 0)` with Still at (10, 0).
  - After 0.6 s, `__thief().state === 'fetch'`.
  - It reaches the part and `carrying === 'ward'`.
  - `__level()` loot no longer has it.
- **K-F2. Guard.** The same, but Still at (0.8, 0) → the state becomes
  `wait`, and after 5 s it has never carried. `__take()` works as normal.
- **K-F3. Average speed.** Carrying over 13.2 s of unobstructed running, the
  distance ÷ time is in [4.4, 4.7], and `listen` happens every 2.5 s for 0.8.
- **K-F4. Tackle.** Still within 1.1 while it carries → `state === 'caught'`,
  and a `ward` lies on the floor within 1.6 of where it was.
  `__offer().tag` is unchanged from before the theft.
- **K-F5. Shot.** Three autos (`__combat.autoAttack = true`) on a carrying
  thief → caught, and the part drops. An empty dormant thief is never
  auto-targeted in 10 s beside Still.
- **K-F6. Never leaves.** Over 200 random seeds of `__gen(2|4|5, s)` with a
  thief, simulating 30 s of carrying from random Still positions, it's always
  on `level.floor`, and never within 2.4 of either beam.
- **K-F7. Asleep packs.** With an asleep pack in the refuge-candidate room,
  its path never enters that room's cells.
- **K-F8. Quiet.** A carrying thief alone on the level: `combat.awake` is
  empty, and `run.quietT` advances as if no one were awake.
- **K-F9. Rate.** Over `__genLook(d, s)` for d ∈ {2, 4, 5} and s 1..300, the
  levels with a thief are in [0.28, 0.42] of those with a side room. Never at
  3 or 6.
- **K-F10. No loot.** Over 50 scripted thefts and catches, `loot.ground`'s
  ids before the theft equal the ids after the catch. No catch ever rolls
  `rollPart`.

**K-H: offline and budget**

- **K-H1.** Home H1 and H2 pass with the new files. `__enter(4)`,
  `__enter(5)` and `__enter(6)` offline give 0 `requestfailed`, and every new
  GLB and texture reports `fromServiceWorker()`. `sw.js`'s activate still
  deletes only `still-action-*` keys (Home H3).
- **K-H2.** After `npm run build`:
  - `du -sb dist` ≤ 5.6 MB;
  - the files added by this spec total ≤ 1.7 MB;
  - every `dist/kaykit/*.glb` is in `PIECES`;
  - every `public/textures/*_Color.jpg` has a `_NormalGL` twin, and each pair
    is ≤ 260 KB.

**K-I: save v2 (step 5)**

- **K-I1.** A stored v1 save (Home's `__fillSave()` shape, `v: 1`) → after
  boot, `v === 2`, cards byte-equal, each history tuple is v1's plus `[0]`.
- **K-I2.** A stored v1 snapshot resumes (Home G1), and
  `__run.tally.arbiters` is `{}`.
- **K-I3.** A stored `v: 3` save → memory mode, and the stored string is
  unchanged after an ending (Home B10's rule).

---

## 11. Out of scope

| item | why not now |
|---|---|
| The Gantry, the Viaduct with falls, the Kiln's grates, slow water, the Ring Hulk, body-only fences | Cut in DESIGN: too expensive for what they give, or they misread on a phone. |
| The Works' gutters, rollers and steam grates | They'd be a third area II mechanic; the budget is two (slag, the Lobber). |
| The Echo, or any boss made of you | DESIGN: maybe later, as a rare named enemy. |
| Named twists on the old roster | DESIGN: cut until the notebook exists; the names stay cosmetic (Home §7). |
| Adds for the Arbiter | Nothing asked for them, and they'd crowd the dark. Home's rams-mites stays the fallback. |
| Lure drawing the wedge | It breaks "bosses ignore the decoy". |
| A real light for the wedge, lance or cage | Grace stays the only warm light, and real lights cost shader recompiles. |
| The mound left as cover, coals put out by hits | They'd make the heap a new mechanic; DESIGN says it's a face. |
| Slag on mites | Eight puddles are noise (balancer). |
| The Lobber's slow puddle | Hazards arm once; a slow is a second rule. |
| Rugs, pictures, lamps, beds in the quarter | Rugs cost a surface for little; pictures imply people; lamps are warm; beds are too near the kids. |
| Difficulty modifiers | The owner asked for none this round. |
| Recorded room tones | Synthesised, as Home's. |
| A sim CLI for the Arbiter's push windows | Worth doing, but separate. `__runStats` measures Stopped at 6 on the phone. |

---

## 12. Contradictions found, and how they're resolved

1. **The translator's absolute grade table** (exposure 1.25…0.85) vs Home's
   multipliers. Home's `DAY` wins, because it's built first. This adds only
   `first-dark`, plus `bloom` and `rim`. (§4.6)
2. **"The kill lands at dusk"** vs "stops at first dark". The kill lands on
   first dark, the last of dusk: `DAY_SPAN[6]` ends there and `bossDown`
   snaps to it. (§7)
3. **Home's `dayAt` lerps "toward the next depth's preset"**, which would take
   depth 6 to night and depth 3 to afternoon. It's replaced by `DAY_SPAN`:
   3 holds noon, and 6 ends at first dark. (§2.1)
4. **"The Works' mites sleep as a heap"** vs the depth-4 lesson brood, which
   must be read, and `CAPS(4).swarmPacks = 1`. The lesson stays an open M8,
   the heap is a second brood after it, and the cap goes to 2. (§6.5)
5. **The translator's heap** (hitting it puts coals out; the mound stays as
   cover) vs DESIGN's "a new face, not a new mechanic". Both are cut. The
   shed is the existing wake ripple, stretched. (§6.4)
6. **Slag's 0.4 s arm** vs the 150 ms slack rule for someone standing on the
   corpse. The 0.4 is kept, and the arm extends only for Still inside it, on
   a visible clock. (§5.3)
7. **One shared puddle per brood** (verifier R1) vs "eight bursts are noise"
   (balancer). No mite carries a slag core. (§6.2)
8. **The Lobber's line-of-sight lock** (verifier R1, balancer R2) vs "the
   same rule as Still's Flare" and "the only thing that punishes hiding".
   There's no line needed, only range. Hiding doesn't stop it; moving does.
   (§6.3)
9. **The Lobber's slow puddle** (balancer R1) vs the Hazard's "arms once".
   The shell is impact only. (§6.3)
10. **Shells hurting enemies** (the Hazard is symmetric) vs Still's Flare
    hurting only enemies. The Hazard rule wins for enemy shells. Still's
    Flare is a part, not a hazard, and is untouched.
11. **The thief is "a small machine"** (DESIGN) vs the Hollow, 2.3 u tall
    (translator). DESIGN wins: 1.1 u.
12. **"The thief (area I, from depth 2)."** Read as "introduced at depth 2":
    eligible at 2, 4 and 5. The literal reading, depth 2 only, is one
    constant (`THIEF.depths = [2]`). Open question 2.
13. **The thief's three sources:** the Picker runs toward a sleeping pack;
    the Tinker goes to a nest; the Hollow spawns carrying (possibly unfound).
    DESIGN's "adds no new loot, only ever a found part" picks the Tinker's
    floor-only rule. It never spawns carrying, and never runs through a
    sleeping pack (translator's own risk note). (§6.1)
14. **"Kill it"** (balancer, verifier) vs **"catch it"** (DESIGN, translator).
    Both count: a tackle or HP 0. (§6.1)
15. **A tall boss must wait on the far side** (verifier R1) vs "the tower in
    the middle of the square" (DESIGN). It's the middle, as an open lattice.
    Check K-D12 guards it, and the fallback is to shift it 3 u to the far
    side. (Risk 1)
16. **The translator's additive haze plane** for the wedge vs "a floor tell,
    not a real light". It's floor only. (§5.4)
17. **Lure:** "the wedge could stop on the decoy" (translator) vs every boss
    ignoring the decoy (parts spec). The invariant wins. (§5.8)
18. **Ward and Mirror Ward in a fight with no shots** (balancer: "every boss
    keeps a move per torso part") vs the lance being a Hazard. The lance is a
    shot for Ward and Mirror only (`warded`). Shells are not. (§3.2 H4)
19. **The Arbiter's phase 2:**
    - verifier: heat two buttons plus a slow ring;
    - translator: a split wedge, reversals, cracked cover;
    - balancer: "phase 2 cracks cover".

    The translator's version is taken, with cracking. Heat stays one button,
    so Stopped stays in reach without being the only threat. (§5.2)
20. **The translator's 750 ms lance swell** vs an instant beam's slack. It's
    360 track + 560 lock = 920 ms, slack 178. (§5.3)
21. **The translator's scald "at 3 u"** in the hulk's ring timing (520 ms)
    vs slack from the footprint's edge. It's 800 ms at r 3.2, slack 213.
    (§5.3)
22. **Home §4.24 builds rams-and-mites adds** for the Assembler at 6, and
    DESIGN makes 6 the Arbiter. The adds stay behind `ARBITER_AT_6` as the
    fallback. (Risk 7)
23. **The Hollow Repeater's name:** the translator used it for the thief, and
    Home's roster gave it to the Lobber (Wandering Drone to the thief). Home
    wins. (§6.1, §6.3)
24. **Verifier R2 moves the quarter to the walk home only** vs DESIGN (depth
    5, the square and the walk). DESIGN wins.
25. **Balancer R2's density dial** (depth 4 at 1/8, depth 5 at 1/3) vs
    depth 4 being the Works. The Works keeps today's 1/4 (verifier R2). The
    quarter's rooms run from 1/8 to 1/3 through depth 5. (§4.4 G3)
26. **Home's `NAMED`** says "the content step adds the Arbiter above these",
    but v1's `PartHistory` can't tell the bosses apart. Save v2 adds the
    count, with a lossless migration. (§2.9)
27. **Home's `AmbienceMood` comment** says content adds `'works' | 'quarter'`.
    The square needs `'square'` too.
28. **"Machinery beyond the edge"** vs "walls always waist-high". Machines
    stand only where `hidesFloor` is false, as today's tall ruins do. (§4.4
    G6)
29. **The Home spec's four `SurfaceRole`s** vs the Works' walkways. One role
    is added (`grate`). Area I maps it to its own paving. (§2.1)
30. **KayKit's `shelves` and `shelf_B_large`** are wall-mounted (they start
    at y 0.75, or are 0.3 thick). They're left out, and waist-high cover
    comes from tables, chairs, cabinets and couches. (§4.2)
31. **The `keg` is 2.05 u tall**, over the waist rule. It's scaled by the
    `coverMaxH` rule to 0.65 (top 1.33). (§4.4 G4)
32. **A thief in reach of the auto** would be shot while harmless. The auto
    and aimed parts skip an empty thief; only a carrying one is a target.
    (§6.1)

---

## 13. Summary

- **Foundations:** a `Boss` interface puts the Assembler behind six fields
  and two presentation hooks, and one `Hazard` primitive (telegraph, arm once,
  live window, each body once, no chains, symmetric) carries slag, shells,
  lances and scald. Per-depth `PlaceDef`s under Home's areas give area II two
  looks while area I's generator stays byte-identical.
- **The Works and the quarter:** 13 real KayKit files (named, sized and
  measured from the repos), each with a primitive or existing-piece fallback.
  Five ambientCG surfaces, and cover that rises from 1/8 to 1/3 through the
  quarter with every prop capped at waist height. Door frames stand on the
  far side only, and nothing is a bed. There are room tones, footsteps and an
  area II loop that slows with the day. About +1.35 MB, to about 5.25 MB,
  precached.
- **The Arbiter:** a 900 HP lattice tower whose floor-drawn wedge catches
  Still, tracks for 360 ms, locks for 560, and fires an 18 lance that walls
  block both ways (slack 178). It vents for 1.2 s at ×1.5, and a hit heats a
  button to push-only for 4 s, shown on the HUD. Shells punish hiding and
  scald punishes hugging. Phase 2 adds two wedges, reversals and cracking
  posts. It interplays with Lure, Ward, Mirror, Anvil, Parry, Through-Line and
  Brace by stated rules.
- **Enemies:** the thief takes only floor parts, averages 4.55 u/s, is caught
  by tackle or HP, and never leaves or wakes anything. Slag cores arm in
  0.4 s, with an honest extension when Still is on the corpse. The Lobber
  lobs over walls (r 1.6, 1000 ms, slack 409) and is taught at depth 5 in
  the densest room. The heap is a face on the mites. The pack rows for
  depths 4–5 fit the unchanged budget.
- **The day** follows room progress, holds noon at 3, and follows boss HP
  down to a capped first dark, with Grace × exposure held constant.
  Seven steps, each playable. The checks are named against the existing and
  Home hooks plus eight small new ones, and 32 contradictions are resolved.
