# SPEC: Home (the Workshop, the pool, a complete run)

Written 25 Sep 2026 from `design/meta/DESIGN.md` (settled), `PITCHES.md` and
the `1-*.md` / `2-*.md` rounds, against the code at `dba490a`. Build it step by
step from §8. Each step ends playable. Nothing here edits the area II content
(`design/content/DESIGN.md`); it only leaves the seams that content needs.

Adrian's calls already made, and used here as given:

- The Home ending's words are his. `ending.ts` gets a marked placeholder (§4.14).
- Yanah and Yuri appear as **traces**: just out of frame, heard, their things
  left around. Nothing here designs their parts.
- The starting pool is 12 parts: the 8 whites, plus Cracked Lens, Backdraft
  Vent, Rusted Hook and Skid Plates.
- The warm beam opens after both Assemblers. The content step later swaps depth 6's boss.
- Every save key starts with `still-action.`. The `still.pushHint.*` keys are migrated.
- The service worker precaches a build-generated file list on install.

---

## 0. Proposal

### Why

A run has no end today. It descends until HP or strain runs out, so every
run ends in failure, which contradicts the game's only line. Nothing carries
from one run to the next, so run 10 feels like run 1. The Workshop, where
Yanah and Yuri are, doesn't exist yet.

### What changes

- A run is 6 depths in two areas, one day long. After each Assembler a warm
  beam opens. Walking into it is the third ending, **Home**. After the second
  Assembler it's the only way out, and it leads to a walk home at night to a lit house.
- All three endings arrive in the **Workshop**, a small warm room you walk
  around with the stick. The room holds the hook by the door, the wall of
  parts, the corkboard of crayon drawings, the doorframe, the notebook, and the
  cold beam in the doorway that starts the next run.
- The findable pool starts at 12 parts. Elites, Plenty and the Assembler can
  drop parts you've never found, from depth 2 on. A part joins the pool the
  moment you pick it up.
- Parts remember the runs they were on. The 43 enemy names from `still` come
  back as names and notebook pages.
- One versioned save in `localStorage`, drawings in IndexedDB, and resume at
  the last beam. The service worker precaches on install.

### Capabilities

| new | modified |
|---|---|
| `save` (versioned save, migration, memory fallback) | `run` (phases, the cap, commit, the warm beam) |
| `pool` (found, turned, hook, unfound drops) | `loot` (`rollPart` takes a pool view) |
| `areas` (run constants, `AreaDef`, day presets, `bossFor`) | `dungeon` (warm beam, kit from `AreaDef`, walk home) |
| `workshop` (room, interactions, arrivals, traces) | `ending` (third kind, continue leads home) |
| `crayon` (capture, shader, IndexedDB) | `hud` (modes, chooser card, `new` tag, hints from save) |
| `cards` (strain line, card compose) | `still` (reassembly, eye) |
| `notebook` (roster, pages, first-meet names) | `audio` / `ambience` / `music` (wood, room tone, home mix) |
| | `combat` (`onWake` gets the pack, boss adds variant) |
| | `world` / `grade` (hemi and key lights exposed, day reapplied) |
| | `sw.js`, `vite.config.ts` (precache) |

### Impact (files)

- **New:** `src/save.ts`, `src/pool.ts`, `src/areas.ts`, `src/workshop.ts`,
  `src/crayon.ts`, `src/cards.ts`, `src/notebook.ts`, `src/env.d.ts`
  (declares `__BUILD__`), and `public/sfx/footstep_wood_0..4.ogg`.
- **Modified:** `src/main.ts`, `src/ending.ts`, `src/dungeon.ts`, `src/loot.ts`,
  `src/hud.ts`, `src/pause.ts`, `src/still.ts`, `src/world.ts`, `src/grade.ts`,
  `src/ambience.ts`, `src/music.ts`, `src/audio.ts`, `src/combat.ts`,
  `src/kit.ts`, `src/style.css`, `public/sw.js`, `vite.config.ts`.
- **Optional vendoring:** KayKit pieces in `public/kaykit/` (§5.2). Every one has a fallback.

---

## 1. Design

### Context

The settled design is `design/meta/DESIGN.md`. The code runs one loop in
`main.ts`: `simulate()` switches on `run.phase` (`crawl | descending | broken |
stopping | over`). Levels come from a seeded `generateLevel(depth, seed,
{ boss })`, and loot is `Math.random`. There's no save; the only storage is
`hud.ts`'s push hints under `still.pushHint.<id>`. The service worker caches
files only as they're fetched. Its activate step deletes **every** cache on
the origin not named `still-action-v1`, and the origin
(`adperez13-1986.github.io`) is shared with Adrian's other Pages projects
(see Risk 1).

### Goals

1. A run has a shape and an end you choose: 6 depths, a warm beam, three endings.
2. Every ending comes home, keeps everything, and leaves a card.
3. Between runs the pool gets wider, never stronger: finds, turning, the hook.
4. The room is warm and the kids are present, as traces, from the first night.
5. It survives a phone: resume at a beam, a private window, a new deploy.

### Non-goals

- Area II's kits, the Arbiter, the thief, slag cores, the Lobber (the content step).
- Doors-not-upgrades, marks on Still, cairns, the node map or area flavours, Sit down, Wear.
- Yanah's and Yuri's parts. Nothing here reserves, gates or shapes them.
- Seeded loot, replays, sharing, export and import.

### The invariants this spec protects

| invariant | how it's enforced here |
|---|---|
| Three terminal states | `EndingKind = 'broken' \| 'stopped' \| 'home'`, the only union. All three end in the same flow: words, then an arrival, then the Workshop (§3). |
| The kept thing is always produced | `commit(kind)` writes the `RunCard` (its strain line is never empty) **before** the terminal phase runs. The drawing is extra and may be missing. |
| The commitment resource carries | Strain carries across depths and across a resume (the snapshot). It resets only at a new run. |
| Never trapped | Once open, an exit never closes, and no phase blocks walking to it. The walk home and the Workshop have no fail state. |
| The reward fork is binary | `ExitKind = 'cold' \| 'warm'`. `exitsAfterBoss(depth)` returns at most those two, whatever the data says (§4.2). |
| No empty save | The commit write includes the card, the history deltas, the pending hook, the found set re-asserted, and the last ending. There's no currency, by design. |

### Decisions (top 8)

1. **One save module, one key, written on events.** `still-action.save` holds
   everything except drawings. Writes happen at a pickup of a new part, the
   first meeting of a name, each beam, the commit, and Workshop actions. A
   write re-reads the stored copy first and unions the sets that only grow
   (`found`, `hints`, notebook ids), so two tabs can't drop a find. Storage
   failure never throws: the save stays in memory. *Why:* the shared origin
   and phone kills make every write a possible last write.
2. **Commit at the trigger, not at the button.** The ending is committed when
   HP hits 0, strain hits 20, or Still steps into the warm beam. The next tap
   is irrelevant. A `committed` flag makes it happen once. *Why:* a closed
   tab during the ending must still keep the run (verifier R1 flag 3).
3. **Exits are a closed type with one rule function.** `exitsAfterBoss` is the
   only place the fork is decided. There's no data table that could add a
   third beam.
4. **The Workshop is a second scene in the same world.** It's built once at
   boot and hidden during runs, with its own small `simulateWorkshop` (move,
   collide, zones, beam). `combat` is reset and not updated there. *Why:* no
   second renderer, and nothing in the fight loop has to know about the room.
5. **Traces, not figures.** Kit primitives plus synthesized sound, keyed by
   the hour. No character models.
6. **Day presets multiply `grade`.** Each hour is a set of multipliers on
   today's tuned `grade` values, and morning is exactly today's look. The
   grade panel keeps working: it tunes the base, and the hour is reapplied on
   top (§6).
7. **The crayon drawing is read from the live canvas in the same frame.**
   `drawImage(canvas)` runs right after `world.render()`, so there's no
   `preserveDrawingBuffer` and no extra render. The copy goes through a shader
   pass at 512 px wide, is encoded to WebP (JPEG fallback), and stored in
   IndexedDB under the card's id.
8. **Resume by repair, not discard.** The snapshot stores the depth, seed,
   strain, loadout and run tallies. On load, unknown part ids empty their slot
   and depth is clamped. Only a snapshot schema mismatch discards the run.
   *Why:* every deploy changes something, and throwing runs away on each one
   would make resume useless.

### Risks and trade-offs

1. **The existing `sw.js` deletes other projects' caches.** `activate` removes
   every cache key `!== 'still-action-v1'`, including JIL Austria Devotion's
   offline cache on the same origin. The fix (§4.20) only deletes
   `still-action-*` keys. Ship it in step 3 at the latest; it's worth doing
   even before.
2. **The iso door flips.** The camera sees only faces that point at +x or +z,
   so an outside door you can see means walking in heading −z, and an inside
   far-wall door means arriving heading +z. The house exterior (§6.5) and the
   Workshop's front door (§5.2) face opposite ways. The fade hides it. The
   alternative, a door in the camera-side wall, puts the 9 u beam across the room.
3. **The feel is the hard part, not the code.** That means the crayon look,
   the three arrivals, the room's light, and the words. Every number in §5 and
   §6 is a starting value for the phone.
4. **Pace is unverified.** The unfound rates (§4.9) aim for a full wall in
   about 10-12 runs. Check G7 runs a pace simulation on the real `rollPart`
   and real `__gen` elite counts. Tune the four constants, not the rules.
5. **Stopped may be unreachable in 6 depths** with quiet −2 (DESIGN flags it).
   This spec only adds `__runStats()` so the phone test can measure it. The
   quiet number is Adrian's feel test.
6. **The warm beam at depth 3 as the safe loop** (balancer). It's defended by
   the finds per minute: a full run finds more per minute. Watch it; don't gate it.
7. **KayKit filenames aren't verified locally.** The full kit isn't on disk.
   Every vendored piece in §5.2 has a fallback built from pieces already in
   `public/kaykit/`.
8. **Shared storage quota.** The origin's ~5 MB of `localStorage` is shared.
   A full save stays under 20 KB (check B11), and a quota failure falls back
   to memory (§4.17).

### Migration plan

- **No save yet** (every player today, Adrian included). The first boot is
  the first night: straight into depth 1 (§4.21).
- **Legacy keys.** Every `still.pushHint.<id> = '1'` is moved into
  `save.hints` and removed. Nothing else with a `still.` prefix is touched,
  because still-merge shares the origin.
- **Service worker.** The new SW precaches into `still-action-<hash>` and
  deletes `still-action-v1` on activate.
- **Future saves.** `SAVE_VERSION` bumps with an entry in `MIGRATIONS`. A save
  newer than the code runs read-only in memory and is never overwritten (§4.17).

### Open questions (all Adrian's)

1. The Home words (title and body), and the continue button's label (placeholder `home`).
2. Which crayon hand is Yanah's and which is Yuri's, and who draws first
   (placeholder: Yanah first, `HANDS` in §5.8).
3. The kids' starting heights on the doorframe (placeholders 1.45 u and 1.20 u).
4. 41 notebook lines ship blank (§7.4). Write them, or ask for drafts.
5. Grace's light leans toward the warm beam once an Assembler falls (default
   yes, `LEAN_HOME = true`). It nudges the one decision.
6. First-ever boot: straight into the maze (default) or into the Workshop
   (`FIRST_RUN_IN_MAZE`).
7. The copy for wall hints, captions and the Workshop cards (§4.10, §5.6).
   Placeholders are marked.
8. `grade.json` (fog 58/135, Grace 400) differs from `world.ts` (44/72, 300).
   The presets multiply whichever values end up in code.

---

## 2. Data contracts

TypeScript as it goes into the files named. Comments marked **INV** are
invariants that code and checks enforce.

### 2.1 Run constants and areas: `src/areas.ts`

```ts
import type { Piece } from './kit'
import type { RosterId } from './notebook'

/** One constant: a 9-depth run is this changing to 9, not a redesign. */
export const RUN_DEPTHS = 6
export const BOSS_EVERY = 3
/** Grace's light leans toward the warm beam once an Assembler falls. */
export const LEAN_HOME = true

export type ExitKind = 'cold' | 'warm'   // INV: never a third
/** INV: the only place the fork is decided. Length 1 or 2, members cold/warm only. */
export function exitsAfterBoss(depth: number): ExitKind[] {
  return depth < RUN_DEPTHS ? ['cold', 'warm'] : ['warm']
}

export type AreaId = 'I' | 'II'
export type SurfaceRole = 'paving' | 'rock' | 'wood' | 'ground'
export type FootSurface = 'stone' | 'wood' | 'plate'
export type AmbienceMood = 'crawl' | 'boss' | 'workshop'   // content adds 'works' | 'quarter'

/** What an area builds with. Area II starts as a copy of I; the content step replaces it. */
export interface KitPreset {
  floorRoom: [Piece, number][]       // cumulative thresholds, ONE rand() per cell (keeps __gen stable)
  floorCorridor: [Piece, number][]
  wall: Piece                        // 'barrier'
  column: Piece                      // 'column'
  cover: [Piece, number][]           // [piece, scale], today's PROPS in order
  breakable: Piece[]                 // ['barrel_large', 'box_large', 'box_stacked']
  beyondTall: Piece[]                // today's TALL
  beyondLow: Piece[]                 // ['rubble_half', 'floor_dirt_large_rocky']
  arenaCover: Piece                  // 'barrier_column'
}
export interface AreaDef {
  id: AreaId
  depths: readonly number[]
  kit: KitPreset
  /** Which ambientCG set skins each role. Today: PavingStones142, Rock035, Planks023A, Ground108. */
  surfaces: Record<SurfaceRole, string>
  ambience: { crawl: AmbienceMood; boss: AmbienceMood }
  footsteps: FootSurface
}
export const AREAS: readonly AreaDef[]   // [I (1-3), II (4-6)], II deep-equal to I except `id` and `depths`
export const areaOf = (depth: number): AreaDef =>
  AREAS[Math.min(AREAS.length, Math.ceil(Math.min(depth, RUN_DEPTHS) / BOSS_EVERY)) - 1]!
/** The walk home is built with area II's kit, at night. */
export const WALK_AREA: AreaId = 'II'

/** INV: bosses stay 900 HP. The content step adds kind 'arbiter' and swaps depth 6. */
export interface BossDef {
  kind: 'assembler'
  name: string                       // 'The Assembler', shown on the boss bar
  hp: 900
  adds: 'hulks' | 'rams-mites'
  roster: RosterId                   // its notebook page: 'the-first-warden'
}
export function bossFor(depth: number): BossDef | null {
  if (depth % BOSS_EVERY !== 0) return null
  return { kind: 'assembler', name: 'The Assembler', hp: 900, adds: depth === RUN_DEPTHS ? 'rams-mites' : 'hulks', roster: 'the-first-warden' }
}

export type DayKey = 'morning' | 'late-morning' | 'noon' | 'afternoon' | 'late-afternoon' | 'dusk' | 'night'
export type HomeHour = 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night'
/** Multipliers on `grade` (world.ts), plus the colours. morning = today's look, exactly. */
export interface DayPreset {
  sat: number; exposure: number; vignette: number; fog: number   // × grade.saturation / exposure / vignette / fogNear & fogFar
  fogColor: number; background: number
  hemi: number; key: number                                        // × today's 1.6 and 1.15
  keyColor: number; keyDir: [number, number, number]
  grace: number                                                    // × grade.graceLight
}
export const DAY: Record<DayKey | 'workshop', DayPreset>          // values in §6.1
export const DEPTH_DAY: Record<number, DayKey>                     // 1 morning … 6 dusk
export function hourAtEnd(kind: 'broken' | 'stopped' | 'home', depth: number): HomeHour  // §4.13
```

### 2.2 The save: `src/save.ts`

```ts
export const SAVE_KEY = 'still-action.save'
export const SAVE_BACKUP_KEY = 'still-action.save.corrupt'
export const PROBE_KEY = 'still-action.probe'
export const LEGACY_HINT_PREFIX = 'still.pushHint.'
export const SAVE_VERSION = 1
export const CARD_KEEP = 36     // cards kept in localStorage, newest last
export const CARD_LINES = 24    // of those, the newest this many keep their strain line
export const LEADERS_MAX = 6

export type PartId = string     // AbilityDef.id
export type RosterId = string   // an id from still's enemies.ts
export type EndingKind = 'broken' | 'stopped' | 'home'   // re-exported by ending.ts
export type Drawer = 'yanah' | 'yuri'

/** [runs carried, deepest depth, Assemblers felled while worn, worn at broken, at stopped, at home] */
export type PartHistory = [runs: number, deepest: number, assemblers: number, broken: number, stopped: number, home: number]

export interface NotebookEntry {
  f: string          // first met, local date 'yyyy-mm-dd'
  m: number          // levels met in
  k: number          // felled
  d: number          // deepest depth met at
  l?: string[]       // elites only: leader names seen (D2 names), newest last, ≤ LEADERS_MAX
}

/** The kept thing. INV: written at commit, before the terminal phase runs. */
export interface RunCard {
  id: string                  // run id; also the IndexedDB key of its drawing
  n: number                   // run number, 1-based (= save.runs at commit)
  date: string                // local 'yyyy-mm-dd' of the ending
  end: EndingKind
  depth: number               // caption only, never a headline
  hour: HomeHour
  by: Drawer                  // who drew it: alternates by n (§4.19)
  worn: (PartId | null)[]     // 4, slot order head/torso/arms/legs, at the ending
  line?: string               // strain samples '0'..'k' (0-20), ≤ 96 chars; INV: ≥ 1 char when written
  marks?: number[]            // sample index where each depth began
}

export interface LastEnding {
  kind: EndingKind; hour: HomeHour; depth: number
  worn: (PartId | null)[]
  cardId: string
  arrived: boolean            // false until the arrival finishes; a reload replays it
}

export interface RunTally {
  carried: PartId[]                    // every part equipped at any point this run
  deepest: Record<PartId, number>
  assemblers: Record<PartId, number>
  line: string; lineStep: number; marks: number[]   // strain line so far (§4.18)
  win: number; winT: number                          // the open sample window: max strain, seconds in
  pushes: number; quiets: number                     // for __runStats
}

/** The in-progress run at its last beam. INV: null whenever no run is in progress. */
export interface RunSnapshot {
  s: 1                        // snapshot schema; any other value is discarded (§4.16)
  build: string               // __BUILD__, diagnostic only
  id: string
  startedAt: string           // ISO
  depth: number               // resume at the START of this depth
  seed: number                // this depth's level seed: the same layout on resume
  bossFelled: boolean         // this depth's boss is down: resume with the beams open and no boss
  bossLoot: PartId[]          // its drops, re-dropped on resume unless worn
  strain: number
  loadout: (PartId | null)[]  // 4, slot order
  tally: RunTally
}

export interface SaveV1 {
  v: 1
  firstRunAt: string | null          // ISO; set at the first run's start; the doorframe grows from it
  runs: number                       // endings committed
  found: PartId[]                    // INV: ⊇ STARTER_POOL; only grows (except unknown-id pruning)
  turned: PartId[]                   // INV: ⊆ found; every slot keeps ≥ 1 white not in here
  hook: PartId | null                // INV: never gold, never turned, ∈ found
  pendingHook: { candidates: PartId[] } | null   // set at commit, cleared when the next run starts
  history: Record<PartId, PartHistory>
  notebook: Record<RosterId, NotebookEntry>
  cards: RunCard[]                   // newest last, ≤ CARD_KEEP (all cards also in IndexedDB)
  lastEnding: LastEnding | null
  run: RunSnapshot | null
  hints: PartId[]                    // push hints shown (was still.pushHint.*)
  doorMarks: number                  // high-water mark count: never shrinks under clock skew
}

export interface SaveStore {
  readonly data: SaveV1              // live and mutable; pure helpers in pool.ts change it
  readonly mode: 'local' | 'memory'
  /** Unions the only-growing sets with the stored copy, then writes. Never throws. No-op in memory mode. */
  write(): void
}
/** memory: true for ?save=memory, and for dev runs (?depth=). */
export function openSave(opts?: { memory?: boolean }): SaveStore
export const MIGRATIONS: Record<number, (s: any) => any>   // empty at v1; key n upgrades n → n+1
```

### 2.3 Pool rules: `src/pool.ts`

```ts
import type { DropSource } from './loot'
import type { Tier } from './abilities'

export const STARTER_POOL: PartId[] = [
  'focusing-lens', 'flare', 'pressure-vent', 'ward', 'scrap-cleaver', 'piston', 'kickstart', 'skitter',
  'cracked-lens', 'backdraft-vent', 'rusted-hook', 'skid-plates',
]
/** Chance a drop is drawn from the unfound parts, by source. INV: 0 for kill and crate; 0 at depth < minDepth. */
export const POOL_RULES = {
  minDepth: 2,
  unfound: { kill: 0, crate: 0, elite: 0.25, plenty: 0.25, 'boss-blue': 0.25, 'boss-gold': 1 } as Record<DropSource, number>,
  /** Which tiers an unfound attempt may give. boss-gold only ever gives an unfound GOLD. */
  unfoundTiers: { kill: [], crate: [], elite: ['blue', 'gold'], plenty: ['blue', 'gold'], 'boss-blue': ['blue'], 'boss-gold': ['gold'] } as Record<DropSource, Tier[]>,
}
export interface PoolView { found: ReadonlySet<PartId>; turned: ReadonlySet<PartId>; depth: number }
export const poolView = (s: SaveV1, depth: number): PoolView

export function markFound(s: SaveV1, id: PartId): boolean          // true if newly found
export function canTurn(s: SaveV1, id: PartId): boolean            // §4.7
export function toggleTurn(s: SaveV1, id: PartId): boolean         // false if refused; unhooks (§4.7)
export function hookCandidates(s: SaveV1, worn: (PartId | null)[]): PartId[]   // §4.4
export function hang(s: SaveV1, id: PartId): boolean               // id ∈ candidates, not turned
export function applyHookDefault(s: SaveV1): void                  // at the door beam (§4.5)
export function startPart(s: SaveV1): PartId                       // §4.6
export function facingOutWhites(s: SaveV1, slot?: SlotName): PartId[]
```

### 2.4 Run state (in memory): `src/main.ts`

```ts
type Phase =
  | 'boot' | 'workshop' | 'leaving'                        // the room, and fading out of it into a run
  | 'crawl' | 'descending'                                 // as today
  | 'broken' | 'stopping' | 'homing'                       // terminal sequences (already committed)
  | 'toWalk' | 'walkHome'                                  // home after the last Assembler
  | 'ending' | 'arriving'                                  // the words, then the way into the room

interface RunState {
  phase: Phase
  id: string; dev: boolean; committed: boolean
  depth: number; strain: number; t: number; swapped: boolean
  fought: boolean; quietT: number; killed: boolean; ramStunSeen: boolean   // unchanged
  seed: number                                             // this level's seed
  bossFelled: boolean; bossLoot: PartId[]
  tally: RunTally
  ending: { kind: EndingKind; hour: HomeHour; cardId: string } | null
  names: Partial<Record<Archetype, RosterId>>              // this level's names (§7.2)
}
```

### 2.5 Level additions: `src/dungeon.ts`

```ts
export interface Level {
  // …as today (exit, exitOpen, openExit stay the COLD beam)
  /** The warm beam: boss levels only; null elsewhere. Opens by exitsAfterBoss. */
  home: THREE.Vector3 | null
  homeOpen: boolean
  openHome: () => void
  /** Walk home only: the lit house's door zone and where Grace's light ends up inside it. */
  house?: { door: THREE.Vector3; inside: THREE.Vector3 }
}
export function generateLevel(depth: number, seed?: number, opts?: { boss?: BossDef | null; area?: AreaDef; bossFelled?: boolean }): Level
export function generateWalkHome(seed: number, area: AreaDef): Level     // §6.4
/** Shared beam mesh: cold 0xcfe0ff, warm 0xffb26b (Grace). */
function makeBeam(color: number, height: number): { group: THREE.Group; update(t: number): void; dispose(): void }
```

### 2.6 The Workshop's entities: `src/workshop.ts`

```ts
export type InteractId = 'wall:head' | 'wall:torso' | 'wall:arms' | 'wall:legs' | 'hook' | 'board' | 'notebook' | 'doorframe'
export interface Interactable {
  id: InteractId
  anchor: { x: number; z: number }        // nearest anchor wins when zones overlap
  radius: number
  rect?: { minX: number; maxX: number; minZ: number; maxZ: number }   // wall sections use a rect, not a radius
  focus: { x: number; z: number }         // the camera eases halfway toward this
  zoom: number                            // rig.hold while near
}
export type ArrivalKind = EndingKind | 'idle'
export interface ArrivalState { kind: ArrivalKind; t: number; step: number; done: boolean }
export type PlaqueState = 'lit' | 'turned' | 'bare'
export interface TraceSet {
  kidsDoor: 'open-dark' | 'swings-shut' | 'ajar'
  shoes: boolean                          // two small pairs by the front door
  blocks: 'scattered' | 'tower' | 'boxed'
  crayons: boolean
  sounds: { steps: boolean; pencilEvery: [number, number] | null; tumble: boolean; rain: boolean }
}
export type WorkshopEvent = { kind: 'arrived' } | { kind: 'near'; id: InteractId | null } | { kind: 'door' }
export interface Workshop {
  readonly group: THREE.Group
  readonly terrain: Terrain
  readonly beam: { x: number; z: number; radius: number }
  enter(o: { arrival: ArrivalKind; hour: HomeHour; worn: (PartId | null)[] }): void
  leave(): void
  /** One fixed step: arrival script, stick movement, collisions, zones, the beam. */
  update(dt: number, stickX: number, stickZ: number): WorkshopEvent[]
  /** Rebuild what the save shows: plaques, the hook, the board, the doorframe marks. */
  refresh(s: SaveV1): void
  readonly near: InteractId | null
  readonly traces: TraceSet
}

/** The card that replaces the pickup card for the wall and the hook (hud.ts). */
export interface ChooserSpec {
  title: string
  items: { id: PartId; icon: string; state: PlaqueState | 'disabled'; tier: Tier }[]
  selected: PartId | null
  detail: { name: string; line: string; history: string | null; tier: Tier | null } | null
  action: string | null                   // null hides the button
}
```

### 2.7 Drawings and cards: `src/crayon.ts`, `src/cards.ts`

```ts
export interface Hand { wobble: number; line: number; bands: number; hatch: number }
export const HANDS: Record<Drawer, Hand>
export const FIRST_DRAWER: Drawer = 'yanah'   // placeholder: Adrian's call
export interface Drawings {
  readonly available: boolean                  // false: no IndexedDB (private window); cards show the line alone
  request(cardId: string, by: Drawer): void    // capture the next rendered frame
  afterRender(canvas: HTMLCanvasElement): void // call right after world.render(), same rAF callback
  putCard(card: RunCard): void                 // the archive copy of every card
  get(cardId: string): Promise<Blob | null>
  allCards(): Promise<RunCard[] | null>        // null when unavailable
  readonly pending: number
}
export function drawStrainLine(ctx: CanvasRenderingContext2D, card: RunCard, box: { x: number; y: number; w: number; h: number }): void
export function composeCard(card: RunCard, drawing: ImageBitmap | null, w: number, h: number): HTMLCanvasElement
```

IndexedDB: database `still-action`, version 1, stores `drawings` (key: card
id, value: `Blob`) and `cards` (key: card id, value: `RunCard`). The name is
prefixed because IndexedDB is per origin too.

### 2.8 The notebook: `src/notebook.ts`

```ts
export type RosterRole = 'hulk' | 'sentinel' | 'ram' | 'mites' | 'elite' | 'fragment' | 'boss' | 'reserved'
export interface RosterEntry {
  id: RosterId                 // the original still id, e.g. 'rust-guard'
  name: string                 // 'Rust Guard'
  role: RosterRole
  band: 'I' | 'II' | 'any'
  mod?: EliteMod               // elites: the modifier whose page this is
  boss?: 'assembler' | 'arbiter'
  reservedFor?: string         // content step: 'the thief', 'the Lobber', …
  line: string | null          // null = ships blank for Adrian (§7.4)
}
export const ROSTER: readonly RosterEntry[]   // INV: exactly 43, ids = still's ALL_ENEMIES keys
```

---

## 3. The run flow (state machine)

### 3.1 Transitions

| from | trigger | action | to |
|---|---|---|---|
| boot | `?depth=N` present | dev run at `clamp(N, 1, RUN_DEPTHS)`, all four STARTING parts, save in memory | crawl |
| boot | `save.run` present, repairs OK (§4.16) | `resumeRun(snapshot)` | crawl |
| boot | `save.runs === 0 && FIRST_RUN_IN_MAZE` | `startRun()` | crawl |
| boot | `save.lastEnding && !save.lastEnding.arrived` | replay the arrival | arriving |
| boot | otherwise | `workshop.enter({ arrival: 'idle', hour: lastEnding?.hour ?? 'afternoon' })` | workshop |
| workshop | Still enters the door beam | `applyHookDefault`, write, fade out `DESCEND_OUT` | leaving |
| leaving | fade done | `workshop.leave()`, `startRun()`, fade in `DESCEND_IN` | crawl |
| crawl | cold beam, `exitOpen` | as today | descending |
| descending | swap moment | `enterLevel(d + 1)`, `writeSnapshot()` | crawl |
| crawl | warm beam, `homeOpen` | `commit('home')`, freeze combat | homing |
| homing | `HOMING_SECONDS`, `depth < RUN_DEPTHS` | `drawings.request()`, then `overlay.show('home')` | ending |
| homing | `HOMING_SECONDS`, `depth === RUN_DEPTHS` | fade out | toWalk |
| toWalk | swap moment | `enterWalkHome()`, fade in, night preset | walkHome |
| walkHome | Still in the house door zone | `drawings.request()`, `overlay.show('home')` | ending |
| crawl | `combat.hp <= 0` (not stopping) | `commit('broken')`, `breakApart()` | broken |
| crawl | strain reaches 20 | `commit('stopped')`, `beginStopping()` | stopping |
| broken | `t ≥ BREAK_SECONDS` | `drawings.request()`, `overlay.show('broken')` | ending |
| stopping | `t ≥ STOP_SECONDS + 0.5` | `drawings.request()`, `overlay.show('stopped')` | ending |
| ending | continue (≥ 1.2 s after show) | fade, `workshop.enter({ arrival: kind, hour })` | arriving |
| arriving | arrival done | `lastEnding.arrived = true`, write, HUD to workshop mode | workshop |
| any in-run | tab hidden (crawl only) | pause as today (not a phase) | same |

`over` is removed. Pause stays a flag, not a phase.

### 3.2 Diagram

```
             ┌───────────── boot ─────────────┐
   snapshot? │   runs==0?     lastEnding?     │ else
       ▼     ▼       ▼            ▼            ▼
   (resume) crawl ◄──────┐    arriving ──► WORKSHOP ◄─────────────┐
       └──────► │        │                 │  door beam           │
                │        └── leaving ◄─────┘                      │
                │                                                  │
  cold beam ────┤──► descending ──(enterLevel d+1, SNAPSHOT)──► crawl
                │
  hp 0 ─────────┼──► broken  ──┐
  strain 20 ────┼──► stopping ─┤  (COMMIT happens on the arrow in)
  warm beam ────┼──► homing ───┤
                │      │ d==6  │
                │      ▼       │
                │   toWalk ──► walkHome ──(house door)──┐
                │                                         ▼
                └───────────────────────────────► ending ──► arriving ──► WORKSHOP
```

### 3.3 What each phase does in `simulate()`

- **workshop / arriving:** `workshop.update(dt, hud.moveX, hud.moveZ)`
  (`moveX`/`moveZ` are 0 while `hud.enabled` is false during arrivals). No
  combat. Footsteps use wood (stone where `z < -6`).
- **leaving / descending / toWalk:** fades only, as `descending` today.
- **homing:** a scripted walk to the warm beam's centre over `HOMING_SECONDS
  = 0.6`. The beam's opacity ×2 and Grace ×1.4, eased. **Combat isn't
  updated**: the world holds, so nothing can hit him once he's in the light.
  Buttons are disabled.
- **walkHome:** `still.update`, `terrain.pushOut`, Grace's light moves along
  the path (§6.4), and the house-door check. HUD mode `walk`: stick only, no
  buttons, no meters, so strain can't rise. It can't fail.
- **ending:** render only, as `over` today.

---

## 4. Exact rules

Each rule is testable. The check that proves it is in brackets.

**4.1 Run length.** `RUN_DEPTHS = 6`, `BOSS_EVERY = 3`, so bosses are at 3
and 6. `START_DEPTH` is clamped to `[1, RUN_DEPTHS]`. The cold beam at depth
6 never opens. [A1, A6]

**4.2 The fork.** On a boss depth, `bossDown` opens exactly
`exitsAfterBoss(depth)`. On crawl depths only the cold exit exists, open from
the start. An open exit never closes, except through the dev hook `__arena`.
There's no other code path that opens a beam. [A1]

**4.3 The warm beam's place.** Take `c` as the arena centre and `away` as the
unit vector from the entrance's centre to `c` (axis-aligned). Of the two
perpendiculars `±(away.z, −away.x)`, pick `side`, the one with the smaller
`x + z` (further from the camera, so the beam's stripe falls on the void).
The warm beam goes at `c + side × 4.5`, radius `EXIT_RADIUS = 1.4`. The cold
beam stays at `c`. Once a boss is down, Grace's lean target is the warm beam
if `LEAN_HOME`. [A1]

**4.4 Hook candidates.** At commit: `worn` = the four slot ids at that tick,
in slot order. The candidates are the non-null ones, minus golds, minus
turned, deduplicated. They're the same for all three endings: "the pieces
all come home". If he wore only golds, the candidates are `[]`. [C4, C6]

**4.5 Hanging, and the default.** In the Workshop the hook card lists the
candidates. "Hang it" sets `hook = id` (it must be a candidate and not
turned). It can change any number of times until the run starts. At the door
beam, `applyHookDefault` runs: if the candidates that aren't turned are
empty, `hook = null` (the thread breaks). If `hook` isn't among them, `hook =`
the first of them. `pendingHook` is then cleared. `hook` itself stays set as
the thread for the next ending's default. [C5]

**4.6 The starting part.** In order:

1. `hook`, if non-null, found, facing out and in `PARTS`.
2. A random facing-out white from `STARTING` (Focusing Lens, Pressure Vent,
   Scrap Cleaver, Kickstart: "as today").
3. A random facing-out white of any slot. It always exists (4.7).

Run 1 has no hook, so it gets (2). [C3, C4]

**4.7 Turning parts to the wall.**

- Only found parts turn, and only in the Workshop.
- A turn is refused if it would leave that part's slot with no facing-out
  white. With 2 whites a slot, you can turn at most one of them.
- Turning the part on the hook sets `hook = null`.
- A turned pending candidate stays listed as `disabled` and comes back if
  unturned.
- A turned part never comes from any source: kill, crate, elite, Plenty,
  either boss drop, `fillEmpty`, the random start, or the boss loot
  re-dropped on resume.

[B6, C7]

**4.8 Found.**

- On every load, `found = found ∪ STARTER_POOL`, minus ids not in `PARTS`.
- A part is found **when it's taken**: `takePart`, including the compare
  screen's take. `markFound` returns true, and `store.write()` runs in the same
  call, before any animation. Walking over a part without taking it finds nothing.
- The ending never touches `found` except to re-assert worn parts.

[B7]

**4.9 Unfound drops.** `rollPart(from, taken, source, pool, excludeSlot?)`:

1. The base is `PARTS` minus taken, minus turned, filtered by the source's gate (today's `GATES`).
2. `wantUnfound = pool.depth >= POOL_RULES.minDepth && Math.random() < POOL_RULES.unfound[source]`.
3. If `wantUnfound`, try base ∖ found, restricted to `unfoundTiers[source]`,
   using today's tier-then-slot logic. If that's empty, fall through.
4. Otherwise, or on fall-through, use base ∩ found, with today's logic unchanged.
5. `fillEmpty` uses found (all whites) ∩ facing out.

The 25% rates give about 1.5 finds for a run that ends at depth 2-3 and about
4 for a full run. Golds are capped at one per Assembler kill. The target is a
full wall in about 10-12 runs [G7]. Nothing unfound drops at depth 1, and
kills and crates never drop unfound parts [B4, B5].

**4.10 How an unfound part looks.**

- On the floor its chunk uses `BARE` (dark, unpowered), with the tier colour
  on the beam only: "a bare part on the floor".
- Its pickup card and compare card carry a `new` tag.
- On the wall it's an outline with a hint, by drop gate (placeholder copy):
  - `boss`: "The Assembler carries this."
  - `rare`: "An elite, a bargain, or the Assembler might carry this."
  - `any`: "An elite, a bargain, or the Assembler might carry this, past the first depth."

[C9]

**4.11 Terminal once.** The first terminal trigger in a tick wins, and
`commit` is guarded by `run.committed`. The existing precedence stays:
`addStrain` can start stopping before `simulate` checks HP, and a stopping
Still can't break. Homing freezes combat, so it can't be followed by a
break. [A5]

**4.12 Commit.** It's one function and one write:

```
commit(kind):
  if run.committed: return;  run.committed = true
  worn   = hud.slots.map(s => s.def?.id ?? null)
  hour   = hourAtEnd(kind, run.depth)
  finish the strain line (§4.18)
  if run.dev: keep lastEnding in memory only; return
  save.runs += 1
  card = { id: run.id, n: save.runs, date: today(), end: kind, depth: run.depth, hour,
           by: drawerFor(save.runs), worn, line, marks }
  save.cards.push(card); trim (§4.19); drawings.putCard(card)
  for id in worn (non-null): markFound(save, id)
  for id in tally.carried: h = history[id] ?? [0,0,0,0,0,0]
      h[0] += 1; h[1] = max(h[1], tally.deepest[id]); h[2] += tally.assemblers[id] ?? 0
      if id in worn: h[3 + {broken:0, stopped:1, home:2}[kind]] += 1
  save.pendingHook = { candidates: hookCandidates(save, worn) }
  save.lastEnding  = { kind, hour, depth: run.depth, worn, cardId: card.id, arrived: false }
  save.run = null
  store.write()
```

[A2, A3, A4, E1]

**4.13 The hour.** Levels use `DEPTH_DAY`: 1 morning, 2 late-morning, 3
noon, 4 afternoon, 5 late-afternoon, 6 dusk. The walk home is night. The
Workshop window uses `hourAtEnd`:

| ending | depth | window |
|---|---|---|
| broken or stopped | 1-2 | morning |
| broken or stopped | 3 | noon |
| broken or stopped | 4-5 | afternoon |
| broken or stopped | 6 | dusk |
| home | < 6 | afternoon (kids awake) |
| home | 6 | night (kids asleep) |

[D3]

**4.14 The ending screen** (`ending.ts`).

- `EndingKind` gains `'home'`.
- `show(kind, onContinue)` loses `depth`. The "reached depth N" line goes
  from step 6 on, when the caption carries it (until then it stays).
- The button reads `CONTINUE = 'home'` (placeholder) and only answers 1.2 s
  after the words appear.
- `#ending.home` gets `display: grid`, a background fading to `rgba(12, 9, 6, .55)`
  over 2 s, and the words fading in over 1.6 s.

```ts
const COPY: Record<EndingKind, { title: string; body: string }> = {
  broken: { title: 'Still came apart.', body: 'All at once. That happens.' },
  stopped: { title: 'Still slowed down, and stopped.', body: 'Nothing broke. It gave what it had.' },
  // PLACEHOLDER, Adrian's words. Walking into Grace's light by choice: the third ending.
  home: { title: 'Still came home.', body: '[Adrian writes this line.]' },
}
const CONTINUE = 'home' // PLACEHOLDER label
```

**4.15 Snapshot writes.** A snapshot is written at `startRun` (depth 1), at
each descend swap (after `enterLevel`), and at `bossDown` (`bossFelled:
true`, `bossLoot` = the two ids dropped). It's never written for dev runs,
and it's cleared at commit. Loot left on the floor is lost at a beam, as
today. [G1, G2]

**4.16 Resume and repair.** If `snapshot.s !== 1`, the run is discarded,
with a one-line banner in the Workshop ("the last run couldn't be picked up",
placeholder). Otherwise:

- A loadout id not in `PARTS`, or whose slot changed, empties that slot.
- `depth` is clamped to `[1, RUN_DEPTHS]`.
- `strain` is clamped to `[0, 19]`.
- The tally drops unknown ids.
- `enterLevel(depth, { seed, bossFelled })`. With `bossFelled`, no boss is
  added, both exits open by 4.2, and `bossLoot` minus worn is dropped at the
  arena centre.
- All buttons come back ready: the same as `?depth=`, and too small to matter
  for "never stronger".

[G1-G4]

**4.17 Storage fallbacks.**

- **Probe.** At boot, `setItem(PROBE_KEY, '1')` then `removeItem`. If either
  throws, the mode is memory.
- **Corrupt JSON.** If there's no backup yet, write the raw string to
  `SAVE_BACKUP_KEY`, then start from a fresh save.
- **`v > SAVE_VERSION`** (a rollback). Use a best-effort `repair` copy in
  memory mode, and never overwrite the stored string. If repair throws, use a
  fresh save, still in memory mode.
- **Quota error on write.** The data stays in memory. The next event write
  retries (writes are rare, so there's no storm).
- **IndexedDB.** Opened with a 2 s timeout. If it's missing, errors or is
  blocked, `drawings.available = false`, cards render the strain line alone,
  and the look-back screen lists `save.cards` only.
- **Private window.** Everything above degrades to memory, and the Workshop
  works for the session: "a Workshop that forgets". Each reload is the first
  night again.

[B8-B10]

**4.18 The strain line.**

- While `phase === 'crawl'` and not paused, `win = max(win, strain)` and
  `winT += dt`.
- Every `lineStep` seconds (starting at 5), push the char `'0123456789abcdefghijk'[win]`
  and reset the window.
- `enterLevel` pushes `marks.push(line.length)`.
- If `line.length` reaches 192, halve it: each pair becomes its max,
  `lineStep` doubles, and marks are floored in half.
- At commit, push the final sample, then halve until ≤ 96 chars.
- Strain is an integer at every source (+2, +4, −2, −6, +1, Brace's `ceil`).

[E6]

**4.19 Cards.**

- `save.cards` keeps the newest `CARD_KEEP = 36`. Cards older than the
  newest `CARD_LINES = 24` lose `line` and `marks` (they're kept in IndexedDB).
- IndexedDB keeps every card and drawing forever, and the look-back screen
  reads from there when it's available.
- Who drew it: `drawerFor(n) = n % 2 === 1 ? FIRST_DRAWER : other`.
- The board shows the newest 12.

[E4, B11]

**4.20 Service worker.** See §5.10. Caches are named `still-action-<hash>`.
`activate` deletes only keys that start with `still-action-` and aren't the
current one. [H1-H3]

**4.21 First boot.** `FIRST_RUN_IN_MAZE = true`: with `save.runs === 0`, boot
goes straight into depth 1 with a random white, as in the genesis opening:
he wakes alone in the maze. The first ending, however it goes, is the first
time he's brought home. `firstRunAt` is set at that `startRun`. [C1]

**4.22 Dev runs.** `?depth=N` sets `run.dev = true`: the save is read-only in
memory (`openSave({ memory: true })`), with all four STARTING parts, no
snapshot, card, found write or notebook write. The ending still goes to the
Workshop, in memory. `?save=memory` forces memory mode without a dev run
(for tests). [G6]

**4.23 Push hints.** `hud.ts` gets `hinted(id)` and `markHinted(id)` from the
save (`save.hints`, written immediately). Legacy keys are migrated at load
(§1, Migration). [B2]

**4.24 The second Assembler's adds** (`BossDef.adds === 'rams-mites'`). Each
summon places:

- **A ram** at point 0 (hp 22, `size 0.85`, summoned, no drops), if no
  summoned ram is alive.
- **Mites** at points 1 and 2, as **one awake brood pack** (its own
  `addPack`, `leash: Infinity`, members summoned), up to the HP cap.

Mites are hp 8 each. The cap: total HP of live adds ≤ 72, today's 4 hulks ×
18. A full summon is 22 + 6 × 8 = 70. Hulk adds are unchanged at depth 3. [G5]

**4.25 The walk home can't fail.** No packs, crates or shrines. The HUD is in
`walk` mode, so there's no strain source. The house door zone has radius 1.3. [A7]

---

## 5. The Workshop scene

### 5.1 Plan

Units are world units. The floor is 3×3 cells (`i, j ∈ {−1, 0, 1}`, so `x, z
∈ [−6, 6]`), plus one stone threshold cell outside the front door, at `(1,
−2)`. The camera looks from +x,+z, so the **north** (z = −6) and **west** (x
= −6) walls are the tall back walls. The south and east edges are waist-high
`barrier`s.

```
                 N wall (tall, z=-6)                         stone threshold (4,-8)
x: -6      -4.5     -2.7     -0.9      0.9     2.4     4.0        6
   ┌────────┬────────┬────────┬────────┬───────┬──[ door ]──┐
   │ [HEAD] │[TORSO] │ [ARMS] │ [LEGS] │ hook  │   beam     │ z=-5.5  wall of parts, 4 sections
 W │                                              shoes      │
   ▌ kids' door (z -4.8..-3.2), marks on its posts           │
 w │                                                         │ E barrier
 a ▌ bench under the window (z -1.2..1.2), Grace's light     │ (waist)
 l │   ← Broken/Stopped arrival spot (-3.4, 0)       blocks  │
 l │ notebook (on bench end, z 1.1)                          │
   ▌ corkboard (z 2.6..5.2)    stool, crayons                │
   └─────────────────────────────────────────────────────────┘ z=+6
                      S barrier (waist-high)
```

### 5.2 Pieces

Floors, walls and props are instanced through `buildInstanced`, with a new
option `surface?: Partial<Record<Piece, Surface>>` so `floor_tile_large` can
wear `wood` here. Positions are the piece origins.

| thing | piece (vendor if listed) | fallback (already in `public/kaykit/`, or primitives) | where |
|---|---|---|---|
| floor, 9 cells | `floor_tile_large`, skinned `wood` (Planks023A, scale 2) | – | cell centres |
| threshold | `floor_tile_large_rocks` (paving) | – | (4, −8) |
| north wall | `wall` ×2, skinned `wood` | – | (−4, −6), (0, −6), rotY 0 |
| front door | **vendor `wall_doorway`** | `wall_pillar` at (3.0, −6) and (5.0, −6), open gap x ∈ [3.2, 4.8] | segment x = 4 |
| west wall | `wall` at z = +4, skinned `wood` | – | (−6, 4), rotY π/2 |
| window | **vendor `wall_window_open`** | `wall` plus a window: sky quad 1.8×1.4 at (−5.62, 2.3, 0) facing +x, frame of 4 boxes 0.12 thick, sill box 2.0×0.12×0.3 at y 1.55 | segment z = 0 |
| kids' door | **vendor `wall_doorway`** | `wall_pillar` at (−6, −5.0) and (−6, −3.0), gap z ∈ [−4.8, −3.2] | segment z = −4 |
| corner column | `column` | – | (−6, −6) |
| camera-side edges | `barrier` ×6, columns at (6, 6), (−6, 6), (6, −6) | – | x = 6 (z −4/0/4), z = 6 (x −4/0/4) |
| bench | **vendor `table_long`**, rotY π/2 | `box_large` ×2 at (−5.0, 0, ±0.7), scale 0.9: a crate bench | (−4.9, 0, 0) |
| stool | **vendor `stool`** | `barrel_large`, scale 0.45 | (−4.3, 0, 3.6) |
| wall of parts | primitive: board box 7.4×3.0×0.12, skinned `wood` | – | centre (−1.8, 2.1, −5.55) |
| corkboard | primitive: box 2.9×2.0×0.08, procedural cork `CanvasTexture` (base #6b5440, noise) | – | centre (−5.55, 2.2, 3.9) |
| hook by the door | primitive: stem box 0.06×0.2×0.06, torus arc r 0.12 | – | (2.4, 1.5, −5.55) |
| notebook | primitive: box 0.5×0.07×0.36, cover #3b4656, page edge #cfc8b8 | – | bench top at z 1.1 |
| kids' door panel | box 0.1×2.6×1.6, skinned `wood`, hinged at (−5.7, 0, −4.8) | – | in the gap |
| beyond | today's beyond code, extracted as `buildBeyond(floor, rand, kit)`, **low pieces only** on the camera side | – | ring round the room |

Vendoring: take each listed file from the KayKit Dungeon Remastered repo's
`Assets/gltf` (CC0). Check the exact filename in the listing, add it to
`PIECES`, and keep `public/kaykit/LICENSE.txt`. If a name isn't there, use
the fallback. The step still ships. Heights, like the bench top, come from
`pieceData(piece)` bounds × scale, never hard-coded. Collision boxes use each
wall's mesh bounds.

`public/sfx/footstep_wood_0..4.ogg` come from Kenney's Impact Sounds (CC0,
the same pack as `footstep_concrete_*`), renamed to the repo's `_n`
convention. Fallback: the `plank` sample at rate 1.8, gain 0.3.

**Terrain.** `makeTerrain(floorCells ∪ {(1,−2)}, boxes, circles)`:

- **Boxes:** the north wall with the door gap, the west wall with an
  invisible box across the kids' gap (their room is never entered), the
  barriers, and the window wall.
- **Circles:** the bench pieces (r 0.9), the stool (r 0.35), and the blocks (r 0.3).

The front door gap is 1.6 wide and the beam's radius is 1.1, so there's no
way out except through the beam.

### 5.3 Light and grade

- **Preset `workshop`** (§6.1): `sat 1.18`, `vignette 0.55`, `fog 2.0`
  (effectively none), `hemi 0.6`.
- **Grace's light is the lamp.** `world.graceLight` sits at (−4.3, 4.0, 0.0),
  just inside the window over the bench: distance 26, decay 1.6, intensity
  `grade.graceLight × 1.2 × WINDOW[hour].grace`. It doesn't lean or follow
  Still. It's the only warm light.
- **Through the window.** The key light (cold) comes from direction
  (−14, 9, 2), with colour and intensity per hour. The sky quad is unlit
  `MeshBasicMaterial` in a cold colour per hour.

| hour | sky quad | key × | key colour | Grace × |
|---|---|---|---|---|
| morning | #9fb3cc | 0.45 | #9fb8dc | 1.00 |
| noon | #c4d2e2 | 0.55 | #b8c8e0 | 0.90 |
| afternoon | #93a3ba | 0.40 | #98a8c4 | 1.00 |
| dusk | #4a5670 | 0.22 | #7c86a6 | 1.15 |
| night | #121826 | 0.08 | #6c7c9e | 1.30 |

Daylight is always cold. Warm is only for Grace.

### 5.4 Camera and HUD in the room

- **Camera.** `rig.update(elapsed, focus, [], true)` (calm zoom 1.1), with
  focus = `lerp((−0.5, 0, 0), still.pos, 0.3)`. Near an interactable, focus
  moves halfway toward its `focus` point and `rig.hold` eases to its `zoom`
  over 0.3 s.
- **HUD.** `hud.mode('workshop')` hides the four ability buttons, both
  meters, and the pause button. It keeps the stick, the prompt and chooser
  card, and the top-right chips. `hud.mode('walk')` is the same. `hud.mode('run')`
  is today's HUD.

### 5.5 The three arrivals

Each starts after a 0.6 s fade in from black. `hud.enabled = false` until it's done.

**Broken: put back together** (about 3.2 s).

1. Still's group stands at (−3.4, 0, 0), facing +x. His four parts start on
   the bench top, at bench z −0.9 / −0.3 / 0.3 / 0.9 (legs, torso, arms,
   head), each lying at a random yaw. The eye is off.
2. New `still.beginReassembly(from, { order: ['legs', 'torso', 'arms', 'head'], each: 0.42, gap: 0.18 })`.
   Each part flies from its bench transform to its home transform on an
   ease-out-cubic, arcing up 0.6 u at mid-flight.
3. On each seat: `sfx.reassembleClick(i)` and 6 cold sparks at the joint.
4. 0.4 s after the head seats, `still.setEyeLit(0 → 1)` over 0.4 s.
5. Nobody is shown doing it. It happens in Grace's light.

**Stopped: his eye comes back** (about 3.8 s).

1. Still is whole at (−3.4, 0, 0.4), facing −x (toward the window), with
   `setSlowdown(1)`.
2. Over `STOP_SECONDS = 3.4` with smoothstep: `setSlowdown(1 → 0)`, Grace
   ×0.3 → the hour's value, and saturation ×0.2 → the preset. `sfx.windUp(3.4)`
   is `windDown` mirrored (saw 18 → 180 Hz, lowpass 90 → 1600), and it
   doesn't touch the duck.
3. A 0.4 s hold, then control.

**Home: he walks in** (about 1.4 s).

1. Still starts at (4, 0, −8.2) on the threshold, facing +z. The beam is off.
2. A scripted stick of (0, +1) for 0.9 s brings him to about (4, 0, −3.2).
   Footsteps are stone until he crosses z = −6, then wood.
3. As he crosses the threshold, the grade eases from the current preset to
   `workshop` over 1.2 s. That shift is the real "you're home".
4. If the traces say `steps` (afternoon), `sfx.kidSteps(pan, 5)` runs from
   the kids' door toward him and stops just out of frame.
5. The beam lights after he's inside.

**Idle** (a boot with nothing to replay). Still stands at (−1.5, 0, 1.5),
facing −x, wearing `lastEnding.worn`.

In all four, Still wears what he came home with (`setEquipped` per worn slot).

### 5.6 Walking up to things

**Nearest wins.** Each tick, the active zone is the one whose `anchor` is
closest among those containing Still (inside `radius`, or inside `rect` for
the wall). Changes emit `near`.

| id | anchor | zone | zoom | card | action |
|---|---|---|---|---|---|
| wall:head / torso / arms / legs | (−4.5 / −2.7 / −0.9 / 0.9, −4.5) | rect x ± 0.9, z ∈ [−6, −3.6] | 1.3 | chooser: that slot's parts (§5.7) | turn to the wall / turn back / none |
| hook | (2.4, −4.5) | r 0.8 | 1.3 | chooser: candidates | hang it / none |
| board | (−4.5, 3.9) | r 1.1 | 1.35 | prompt: "The corkboard · N runs", newest caption | look (the look-back screen) |
| notebook | (−4.3, 1.2) | r 0.9 | 1.3 | prompt: "The notebook · N pages", newest page name | read (the notebook screen) |
| doorframe | (−4.6, −2.4) | r 0.9 | 1.4 | prompt: "Yanah · Yuri", "marked since {firstRunAt}" | none |
| door beam | (4.0, −5.3) | r 1.1 | – | none: walking in starts the run | – |

All the copy is placeholder. `hud.prompt` accepts `action: null`, which hides
the button. The look-back and notebook screens are new `pause.ts` modes:
reading screens in the pause layout, with ← → and close. They're the only
full screens in the room, because reading needs the room. Everything else is
a card.

### 5.7 The wall of parts

- **Sections.** Four sections, one per slot: centres at x −4.5, −2.7, −0.9,
  0.9. Each is 2 columns (x centre ± 0.36) by 4 rows (y 3.15, 2.45, 1.75,
  1.05). Parts go in catalog order: whites, then blues, then golds (Head 8,
  Torso 7, Arms 7, Legs 8).
- **Plaques.** Each is 0.55 × 0.55, textured from one 1024×512 atlas (8×4
  tiles of 128 px). Each tile rasterizes `AbilityDef.icon` into `<svg viewBox="0 0 24 24"
  fill="none" stroke="…" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">`
  through an `Image` loaded from a data URL.
  - **Lit** (found, facing out): stroke `TIER_COLOR`, emissive 0.35.
  - **Bare** (unfound): stroke #2b3138 on the `BARE` colour, no emissive.
  - **Turned:** rotated π about y, showing its back (plain dark wood). A 0.18 s
    flip plays with `sfx.plaqueTurn`.
- **The card** (`ChooserSpec`):
  - title `"{Slot} · {found} of {n} found"`
  - items: the section's parts
  - selected: the first lit one
  - detail: the name with its named suffix (§7.1), the card line, and the
    history line. A bare part shows the hint (4.10).
  - action by state:
    - lit: "turn to the wall", or `null` plus a line "the last plain {Slot}
      part stays facing out" when 4.7 refuses
    - turned: "turn back"
    - bare: `null`
- **The hook** shows the hooked part's plaque hanging under it. While
  `pendingHook` is set and `hook` isn't a candidate, it's empty.
- **The hook's card:**
  - title "The hook by the door"
  - items: the candidates (a turned one is `disabled`)
  - action: "hang it" when the selection isn't the hook; `null` once hung,
    with the line "hung · the next run starts with it"
  - with no candidates: detail "Nothing to hang. He'll start with a plain part."

### 5.8 The crayon drawing

1. **Capture.** `drawings.request(cardId, by)` sets a flag. In `frame()`,
   straight after `world.render()`, `drawings.afterRender(renderer.domElement)`
   runs `srcCtx.drawImage(canvas, 0, 0, 512, H)`, with `H = round(512 ×
   canvas.height / canvas.width)`. This happens in the same rAF callback, so
   the drawing buffer is still valid. The frames:
   - Broken: at `BREAK_SECONDS`, parts on the floor.
   - Stopped: at the end of the stop, dark and slumped.
   - Home at 3: after `HOMING_SECONDS`, in the warm beam.
   - Home at 6: at the lit house door.
2. **Shader.** On the next frame, a `CanvasTexture` of the source goes in
   with `colorSpace = NoColorSpace`: raw bytes in, raw bytes out, no
   conversions. A fullscreen quad with `CRAYON` `ShaderMaterial` renders into
   a `WebGLRenderTarget(512, H)` (RGBA8, no depth). `readRenderTargetPixels`
   copies it into an `ImageData`, flipped in Y, on the output canvas.
3. **Encode.** `toBlob('image/webp', 0.82)`. If that's null or not WebP, use
   `toBlob('image/jpeg', 0.82)`. The result is about 30-90 KB. Then IndexedDB
   `put(cardId, blob)`. Any failure means no drawing. The card still shows its line.

The `CRAYON` fragment shader (uniforms `uSrc, uTexel, uSeed, uWobble, uLine, uBands, uHatch, uPalette[8], uPaper`):

- **Wobble.** `uv += (vec2(n(uv*5.+s), n(uv*5.+s+17.)) - .5) * uWobble * uTexel`,
  with value noise and s = the card's n.
- **Flat fill.** `l` is the luminance at the wobbled uv. If `l < 0.06`, it's
  paper (kids don't colour the dark), with a sparse slate hatch. Otherwise it
  takes the nearest palette colour to `mix(vec3(l), c, 2.2)`, times
  `mix(0.8, 1.0, step(0.35, l))`, quantized to `uBands` value steps.
- **Wax.** A streaky grain `n(rot(uHatch) * gl_FragCoord.xy * vec2(0.9, 0.12))`.
  Coverage is `smoothstep(0.25, 0.6, grain + 0.35)`, and the colour is
  `mix(paper, fill, coverage)`.
- **Lines.** A Sobel filter on luminance over 1.5 px. The line strength is
  `smoothstep(uLine, uLine*1.6, |g|) * step(0.4, n(gl_FragCoord.xy*0.35 + s))`
  (broken strokes), mixed toward graphite at 0.9.
- **Paper tooth.** `*= 0.96 + 0.04 * n(gl_FragCoord.xy * 1.3)`.

The palette (sRGB): paper #eae4d6, graphite #2a2d33, slate #5d6b7c, cold blue
#6f9bd1, pale blue #b9d3ee, rust #8a5a44, ember #d9653b, Grace #f2a950.

The hands (placeholders; which is whose is Adrian's call):

- **Hand A** (neater): wobble 1.6, line 0.22, 3 bands, hatch 0.6 rad.
- **Hand B** (wobblier, thicker, fewer colours): wobble 2.8, line 0.30, 2 bands, hatch −0.4 rad.

`HANDS = { yanah: A, yuri: B }`.

**Composing a card** (`composeCard`, on a 256×192 canvas, 512×384 on the look-back screen):

- Paper background.
- The drawing, cover-fitted into the top 150 px.
- Along the bottom 42 px, `drawStrainLine`:
  - a pencil line (#4b4f57, 1.5 px) of `line` over x, with y = strain / 20
  - depth marks as 3 px ticks
  - the ending mark at the right edge:
    - broken: two offset jagged strokes
    - stopped: the line sinking into a flat dot
    - home: a 3 px dot in Grace's colour
- The caption, bottom right, in Barlow 11 px: `"25 Sep · home · depth 3"`
  (ending words `broke`, `stopped`, `home`, placeholder).

**On the corkboard.** The 12 newest cards sit as 0.6 × 0.45 quads in 4
columns × 3 rows, newest top left. Each is tilted ±4°, seeded by its id, with
a pin (a sphere, r 0.03, #7d8aa6).

### 5.9 Yanah and Yuri, as traces

Nothing here is a figure. Everything is a kit piece or a primitive, plus sound.

| hour | kids' door | shoes by the door | blocks (1.6, 0, 2.6) | crayons (−3.8, 0, 3.0) | sounds |
|---|---|---|---|---|---|
| morning / noon (out) | open, dark behind | none | scattered | yes | none, just the clock |
| afternoon (awake) | swings shut 1.5 s after arrival | yes | a tower of 5 | yes | steps on a Home arrival; `pencil` every 8-15 s from their door; one block tumble |
| dusk (awake, quieter) | ajar | yes | a tower of 5 | yes | `pencil` every 12-20 s |
| night (asleep) | ajar, dark | yes | boxed (a small crate) | no, tidied | rain on the window |

- **Blocks.** Cubes 0.22 u in muted colours (#6d7a8a, #8a8f7a, #5f6f86, #9a8a7a). None is lit.
- **Shoes.** Two pairs of small boxes at (5.3, 0, −4.4), 0.26 and 0.20 long:
  two children, two sizes.
- **Door swing.** 80° → 0° over 0.5 s, ease-in, with `sfx.doorShut(pan)`.
- **Sound.** All trace sounds pan with `panOf(kidsDoor)`. The kids never speak.
- **The doorframe marks** (on the kids' door posts, faces pointing +x):
  - Yanah's on the post at z −5.0, Yuri's on the one at z −3.0.
  - `marks = max(save.doorMarks, 1 + floor(daysSince(firstRunAt) / 30))`,
    capped at 48, then written back as the new `doorMarks`.
  - Mark k is a pencil quad (0.22 × 0.015, #3a3d44, opacity 0.8) at
    `start + k × 0.025` u, with a ±0.02 u jitter in x seeded by k.
  - Starts (placeholders): Yanah 1.45 u, Yuri 1.20 u. The step is
    exaggerated about 4× over real growth, so a month is visible on a phone.

### 5.10 Sound in the room

- **Ambience** mood `workshop` (`ambience.ts`):
  - The stone layers (room tone, drafts, drips, clanks) fade to 0 over 1.2 s.
  - Added: a **clock** (a tick every 1.0 s alternating 2.2 / 1.7 kHz
    bandpassed noise, 12 ms, gain 0.018, pan −0.3), and **Grace's tone**
    (sines at 146.83 and 220.0 Hz, gain 0.010 each, a 0.08 Hz breath of ±25%).
    It sits under everything and never ends.
  - **Rain** at night only: noise through a 400 Hz highpass and 3.5 kHz
    lowpass at gain 0.012, plus droplet ticks every 0.05-0.3 s.
  - A **wooden room** convolver: 0.6 s, decay exponent 4.
  - The room tone is synthesized. A recording from the real house is Adrian's
    option; the repo is public.
- **Music.** `updateMusic({ …, home: true })`: the pad and drone ×0.55,
  pulse, drums, drive and arp at 0, the bell at 1.
- **Footsteps.** `sfx.step(who, pan, loudness, surface)` with `'wood'` uses
  `footstep_wood` at rate 1.3, gain 0.5, plus `plank` at 0.05. The surface is
  `z < −6 ? 'stone' : 'wood'` in the Workshop, and `areaOf(depth).footsteps` in runs.
- **New voices** (`audio.ts`):
  - `windUp(s)`
  - `reassembleClick(i)`: tin at 1.4 + 0.1i, gain 0.2, plus metalLight
  - `plaqueTurn(pan)`: plank at 1.6, gain 0.25
  - `doorShut(pan)`: woodHeavy at 1.3, then tin
  - `kidSteps(pan, n)`: step at rate 2.1, gain 0.18, 110 ms apart
  - `pencil(pan)`: 3 bandpassed noise strokes at 2.5-4 kHz, 90 ms each
  - `homeBeam()`: a warm swell of two triangles at 587 and 880 Hz, 0.4 s in
    and 2 s out, gain 0.06, plus a bell sample

### 5.11 Precache on install

`vite.config.ts` adds a build-only plugin that writes the file list into `dist/sw.js`:

```ts
function precache(): Plugin {
  let outDir = 'dist'
  return {
    name: 'precache', apply: 'build',
    configResolved(c) { outDir = c.build.outDir },
    closeBundle() {
      const files: string[] = []
      const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(p) } }
      walk(outDir)
      const list = files.map((p) => relative(outDir, p).split(sep).join('/'))
        .filter((u) => u !== 'sw.js' && !u.endsWith('.map') && !u.endsWith('LICENSE.txt'))
        .sort()
        .map((u) => [u === 'index.html' ? './' : u, createHash('sha1').update(readFileSync(join(outDir, u))).digest('hex').slice(0, 10)])
      const version = createHash('sha1').update(JSON.stringify(list)).digest('hex').slice(0, 10)
      const sw = join(outDir, 'sw.js')
      const src = readFileSync(sw, 'utf8')
      if (!src.includes('/*__PRECACHE__*/[]') || !src.includes("/*__VERSION__*/'dev'")) throw new Error('sw.js tokens missing')
      writeFileSync(sw, src.replace('/*__PRECACHE__*/[]', JSON.stringify(list)).replace("/*__VERSION__*/'dev'", JSON.stringify(version)))
    },
  }
}
// and: define: { __BUILD__: JSON.stringify(new Date().toISOString()) }
```

`public/sw.js` becomes:

```js
const PRECACHE = /*__PRECACHE__*/[]
const VERSION = /*__VERSION__*/'dev'
const PREFIX = 'still-action-'
const CACHE = PREFIX + VERSION
const scope = self.registration.scope
// every build file under a key that carries its content hash: unchanged files are copied, not refetched
const keyOf = new Map(PRECACHE.map(([u, h]) => { const url = new URL(u, scope).href; return [url, `${url}?v=${h}`] }))

self.addEventListener('install', (e) => e.waitUntil((async () => {
  const cache = await caches.open(CACHE)
  for (const [url, key] of keyOf) {
    if (await cache.match(key)) continue
    const res = (await caches.match(key)) ?? (await fetch(url, { cache: 'reload' }))
    if (!res.ok) throw new Error(`precache ${url}: ${res.status}`)   // install fails; the old worker stays
    await cache.put(key, res)
  }
  await self.skipWaiting()
})()))

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // the origin is shared with other projects: only ever delete this game's caches
  for (const k of await caches.keys()) if (k.startsWith(PREFIX) && k !== CACHE) await caches.delete(k)
  await self.clients.claim()
})()))

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || !req.url.startsWith(scope)) return
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(async () => (keyOf.has(scope) && (await caches.match(keyOf.get(scope)))) || Response.error()))
    return
  }
  const key = keyOf.get(req.url.split('?')[0])
  if (key) e.respondWith(caches.match(key).then((hit) => hit ?? fetch(req)))
  else e.respondWith(fetch(req).catch(() => caches.match(req)))
})
```

The page stays network-first, so a deploy is picked up. Everything the build
contains is on the phone after the first install, including area II's future art.

---

## 6. The one day

### 6.1 Presets

These multiply `grade` in `world.ts`: the multipliers are unitless, and the
colours are hex. `fog` scales both `fogNear` and `fogFar`. `key` and `hemi`
scale today's 1.15 and 1.6. Morning is exactly today's look.

| key | where | sat | exposure | vignette | fog | fog colour | background | hemi | key | key colour | key dir | grace |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| morning | depth 1 | 1.00 | 1.00 | 1.00 | 1.00 | #0b1018 | #070a0e | 1.00 | 1.00 | #8fb0da | (−8, 14, −6) | 1.00 |
| late-morning | depth 2 | 1.02 | 1.02 | 1.00 | 1.05 | #0c121a | #070a0e | 1.00 | 1.08 | #9ab8de | (−6, 15, −5) | 1.00 |
| noon | depth 3 | 1.04 | 1.04 | 0.95 | 1.10 | #0d131b | #080b10 | 1.05 | 1.15 | #a8c0e2 | (−3, 16, −3) | 1.00 |
| afternoon | depth 4 | 0.96 | 0.98 | 1.00 | 0.95 | #0c1017 | #070a0e | 0.95 | 0.95 | #98a8c4 | (−10, 11, 2) | 1.05 |
| late-afternoon | depth 5 | 0.90 | 0.95 | 1.05 | 0.88 | #0b0e15 | #06090d | 0.88 | 0.80 | #8e98b4 | (−12, 8, 5) | 1.10 |
| dusk | depth 6 | 0.82 | 0.90 | 1.12 | 0.80 | #090c13 | #05070b | 0.75 | 0.55 | #7c86a6 | (−13, 5, 8) | 1.15 |
| night | walk home | 0.70 | 0.85 | 1.25 | 0.70 | #05070b | #030406 | 0.45 | 0.15 | #6c7c9e | (−6, 12, −10) | 1.25 |
| workshop | the room | 1.18 | 1.00 | 0.55 | 2.00 | #0b0f16 | #070a0e | 0.60 | by hour (§5.3) | by hour | (−14, 9, 2) | by hour |

No hour has a warm key light. Dusk is blue-violet, not orange.

### 6.2 Applying it

- `world.ts` exposes `hemi` and `key` (they're locals today).
- `areas.ts` gets `applyDay(world, key)` and `reapplyDay(world)`. `grade.ts`'s
  `apply()` calls `reapplyDay` at its end, so a slider moves the base and the
  hour stays on top.
- `enterLevel(d)` applies `DEPTH_DAY[d]`, the walk home applies `night`, and
  the Workshop applies `workshop` plus the hour.
- **Two existing lines change:**
  - Stopping's `grade.saturation * (1 − ease × 0.8)` becomes
    `currentSat() * (1 − ease × 0.8)`.
  - `startRun`'s reset of `uSaturation` becomes `applyDay(world, DEPTH_DAY[1])`.
- **Seam for the content step's "day moves with you":** `dayAt(depth,
  progress01)` lerps each value toward the next depth's preset by
  `progress01`. The Home build always passes 0.

### 6.3 AreaDef seam

- **Kit.** `generateLevel` reads its floors, walls, columns, cover,
  breakables and beyond from `area.kit` instead of literals. The literals move
  unchanged into `AREAS[0].kit`.
- **Determinism.** The refactor must keep the `rand()` call sequence
  byte-for-byte: one `rand()` per floor cell, compared against cumulative
  thresholds in the same order. Check A8 compares `__gen` before and after.
- **Surfaces.** `kit.ts` keeps a handle to each surface's `uAlb`/`uNrm`
  uniforms, and `setSurfaces(area.surfaces)` swaps textures only when they
  differ (a no-op in this build).
- **Ambience and footsteps.** `updateAmbience(level.boss ? area.ambience.boss
  : area.ambience.crawl)`, and footsteps use `area.footsteps`.
- **Bosses.** `bossFor(depth)` replaces `depth % BOSS_EVERY === 0`
  everywhere (`enterLevel`, `__gen`). `combat.addBoss(x, z, face, def)` takes
  the adds variant. The boss bar uses `def.name` and `def.hp`.
- `BOSS_EVERY` moves from `main.ts` to `areas.ts`.

### 6.4 The walk home level

`generateWalkHome(seed, areaOf(RUN_DEPTHS))` builds it from authored floor
cells, reusing the generator's wall, column and beyond code, with no packs,
crates or shrines:

```
start room   : 3×3 around (0,0)
path         : (-1,0) (-2,0) (-3,0) (-3,-1) (-3,-2) (-4,-2) (-5,-2) (-5,-3) (-5,-4) (-6,-4)
yard         : 3×3 around (-7,-5)            (cells i -8..-6, j -6..-4)
house        : footprint cells i -8..-6, j -9..-7 (not floor; solid)
door zone    : (-28, 0, -25), radius 1.3     (the house's south face is at z = -26)
Grace inside : (-28, 2.5, -27.5)
```

- The path heads up the screen, about 54 u, about 10 s at 5.5 u/s: short, on purpose.
- Still starts at (0, 0, 0). Floors are `floor_dirt_large` and
  `floor_tile_large_rocks`, and the beyond is kept low near the path.
- **Grace's light:** `lerp(carried, inside, smoothstep(12, 2, distToDoor))`,
  where `carried` is today's lean toward the door. One light: the one he
  carries becomes the one in the house.
- The ambience is area II's crawl mood at night. The content step later
  re-skins the path as "the last of the workers' quarter".

### 6.5 The lit house

Seen from outside, only its south and east faces show (Risk 2).

- **Walls.** `wall` ×3 on the south face (x = −32, −28, −24 at z = −26) and
  ×3 on the east face (z = −38, −34, −30 at x = −22), skinned `wood`.
- **Door** at x = −28: `wall_doorway` if vendored, otherwise two
  `wall_pillar`s and a lintel box. It's filled by a warm unlit quad
  (#ffb26b × 0.85) set 0.3 u inside, the light spilling out. A warm additive
  fan decal (like the exit pad) lies on the yard in front of it.
- **Window** at x = −24: a 1.4 × 1.2 warm unlit quad at y 1.8, with a cross
  frame of thin boxes.
- **Roof.** A dark cap box 12.6 × 0.4 × 12.6 at wall height, plus a `pillar`
  at scale 0.4 as a chimney. It's roofed, so you don't see into it; the room
  is revealed by the fade.
- **Walking in.** Entering the door zone captures the drawing (the lit house
  at night) and shows the Home words. Continue fades into the Home arrival.

---

## 7. Parts remember, and the notebook

### 7.1 Parts remember

- **Tallies** in `run.tally`, saved in the snapshot:
  - `carried` gets the id at every equip: `takePart`, the start part, and
    anything filled by `fillEmpty` and taken.
  - `deepest[id] = max(…, depth)` at each `enterLevel` for worn ids, and at
    `takePart`.
  - `assemblers[id] += 1` for each worn id at `bossDown`.
  - All of it is committed only at the ending (§4.12).
- **History line** on every part card (pickup, compare, loadout, wall):
  `carried {n} run{s}, saw depth {d}`, omitted while `runs === 0`.
- **The name suffix** on the card title, first match wins, data in `NAMED`:
  - `assemblers ≥ 2` → `", that saw the Assembler twice"`
  - `assemblers ≥ 1` → `", that saw the Assembler"`
  - The content step adds the Arbiter above these.
  - Example: *Scrap Cleaver, that saw the Assembler*.
- **The name shows on every drop from then on.** "Next time" is only when
  you first notice it. No stats change, ever.

### 7.2 Names in the maze

- **Per level.** At `enterLevel`, each archetype gets one roster name:
  `assignNames(depth, seed, notebook)` with `r = rng(seed ^ 0x9e3779b1)`.
  Candidates are `ROSTER` filtered by role (chaser → hulk, ranged → sentinel,
  charger → ram, swarm → mites) and by band (depths 1-3 → I, 4-6 → II, or
  'any'). It picks among the unmet ones, else among all of them. This is
  outside `generateLevel`, so `__gen` stays pure.
- **Elites** take their page by mod and band, and their D2 label stays as it
  is. The leader's D2 name is added to that page's `l`.
- **The halves of a Many split** are `fracture-fragment`. The boss is
  `bossFor(depth).roster`.
- **Met** means a pack woke with that archetype in it. `combat.onWake` gains
  the pack: `onWake(at, pack)`.
  - **The first time ever:** create the entry (`f` = today, `m 1`, `d` =
    depth) and write immediately. The roster name floats over the woken member
    nearest to Still for 2.2 s, in the elite label's style muted (class
    `named`, no mod line), with `sfx.pencil`.
  - **After that:** `m` goes up once per level, with no label.
- **Felled:** `k += 1` in `onKill`, written at the next event write.

### 7.3 Where the 43 go

From `/Users/adrianperez/repos/personal/still/src/data/enemies.ts` (`ALL_ENEMIES`, 43 entries):

| # | id | name | role | band | notes |
|---|---|---|---|---|---|
| 1 | wandering-drone | Wandering Drone | reserved | I | the thief (content step) |
| 2 | rust-guard | Rust Guard | hulk | I | |
| 3 | corroded-sentry | Corroded Sentry | sentinel | I | |
| 4 | fracture-mite | Fracture Mite | mites | II | |
| 5 | iron-crawler | Iron Crawler | ram | I | |
| 6 | glitch-node | Glitch Node | sentinel | I | |
| 7 | sentinel-shard | Sentinel Shard | sentinel | I | |
| 8 | hollow-repeater | Hollow Repeater | reserved | II | the Lobber (content step) |
| 9 | drifting-frame | Drifting Frame | hulk | I | |
| 10 | echo-construct | Echo Construct | hulk | I | |
| 11 | thermal-scanner | Thermal Scanner | sentinel | I | |
| 12 | signal-jammer | Signal Jammer | sentinel | I | |
| 13 | vault-keeper | Vault Keeper | elite | any | mod `plated` |
| 14 | corrupted-overseer | Corrupted Overseer | elite | II | mod `warding` |
| 15 | fracture-titan | Fracture Titan | elite | any | mod `splitting` |
| 16 | the-first-warden | The First Warden | boss | – | the Assembler, both depths. **Line ships.** |
| 17 | thermal-leech | Thermal Leech | mites | II | |
| 18 | wire-jammer | Wire Jammer | sentinel | II | |
| 19 | slag-heap | Slag Heap | reserved | II | the slag heap brood (content step) |
| 20 | feedback-loop | Feedback Loop | sentinel | II | |
| 21 | phase-drone | Phase Drone | sentinel | II | |
| 22 | furnace-tick | Furnace Tick | mites | II | |
| 23 | static-frame | Static Frame | hulk | II | |
| 24 | conduit-spider | Conduit Spider | mites | II | |
| 25 | overcharge-sentinel | Overcharge Sentinel | elite | I | mod `swift` |
| 26 | lockdown-warden | Lockdown Warden | elite | I | mod `warding` |
| 27 | meltdown-core | Meltdown Core | elite | II | mod `swift` |
| 28 | the-thermal-arbiter | The Thermal Arbiter | boss | – | the Arbiter (content step). **Line ships.** |
| 29 | thorn-sentinel | Thorn Sentinel | sentinel | I | |
| 30 | feedback-drone | Feedback Drone | sentinel | II | |
| 31 | strain-siphon | Strain Siphon | mites | II | |
| 32 | overload-core | Overload Core | ram | I | |
| 33 | fracture-fragment | Fracture Fragment | fragment | any | the halves of a Many split |
| 34 | fracture-host | Fracture Host | hulk | I | |
| 35 | echo-shell | Echo Shell | reserved | – | the Echo, later, maybe |
| 36 | void-leech | Void Leech | mites | II | |
| 37 | strain-parasite | Strain Parasite | mites | II | |
| 38 | fury-core | Fury Core | ram | II | |
| 39 | ward-pylon | Ward Pylon | sentinel | II | |
| 40 | raging-hull | Raging Hull | ram | II | |
| 41 | phase-wraith | Phase Wraith | ram | II | |
| 42 | drain-frame | Drain Frame | hulk | II | |
| 43 | martyr-shell | Martyr Shell | hulk | II | |

**Totals:** hulk 7 (I: 4, II: 3), sentinel 11 (6, 5), ram 5 (2, 3), mites 7,
elite 6, fragment 1, boss 2, reserved 4. Meetable in this build: 38 (all but
the four reserved ones and the Arbiter). Mites only appear from depth 4, so
they're all band II. The brood-mother takes the elite pages for `swift` and
`warding` in band II.

### 7.4 The notebook

- **Walking up** gives a prompt, and "read" opens the notebook screen. Pages
  are sorted by first met. Unmet names have no page. The last page says
  "Some pages are still blank." (placeholder)
- **A page:**
  - the name, in Cinzel
  - what it is: `a hulk`, `a sentinel`, `a ram`, `mites`, `an elite`, `the boss`, `pieces of one`
  - the line, or an empty ruled line when it's `null`
  - facts: `met 5 times · felled 12 · first met 25 Sep · deepest depth 5`
  - elites add `led by Rustjaw the Warden, Ashmaw the Warden`
- **Pages that ship with a line** (the only two flavour lines in the old roster):
  - `the-first-warden`: "It does not remember what it was built to protect. It only remembers the door."
  - `the-thermal-arbiter`: "It measures everything. It forgives nothing."
- **Pages that ship blank for Adrian** (41): everything else in the table,
  the four reserved ones included, so they're ready when the content arrives.
  `line: null` renders as an empty ruled line, never as "TODO".

---

## 8. Build order

Each step ends playable. The order is the design's table. Step 8 (resume) is
cheap but stays last, because the snapshot carries what steps 2-7 add (the
tallies, the strain line, the boss state).

| # | step | about | playable after | milestone |
|---|---|---|---|---|
| 1 | The warm beam, run capped at 6, the third ending (placeholder words) | 1 | a run has an end | v0.1 |
| 2 | Save module, prefixed keys, migration; the found pool (12, unfound from moments) | 1-2 | runs start to matter | v0.1 |
| 3 | The Workshop room: walkable, warm, cold-beam door; the three arrivals; traces; precache | 2-3 | coming home | v0.2 |
| 4 | The hook by the door; the wall of parts with turning | 1-2 | the choice between runs | v0.2 |
| 5 | One day: presets, `AreaDef` and `bossFor`, the window hour, the walk home, the lit house | 2 | the run's shape | v1.0 |
| 6 | Corkboard cards with strain lines; crayon drawings in IndexedDB; the doorframe | 2 | the history | v1.0 |
| 7 | Parts remember; names; the notebook | 1-2 | the past you can read | v1.0 |
| 8 | Resume at a beam; the second Assembler's adds | 1 | a phone-proof run | v1.0 |

**Step 1** (`dungeon.ts`, `main.ts`, `ending.ts`, new `areas.ts`)

- `areas.ts` gets `RUN_DEPTHS`, `BOSS_EVERY`, `ExitKind`, `exitsAfterBoss`
  and `LEAN_HOME`.
- `makeBeam` is extracted and the warm beam is added (4.3), with `home`,
  `homeOpen` and `openHome`.
- `bossDown` opens by 4.2. The `homing` phase freezes combat. `commit` is a
  stub (sets `committed`, no save). `end('home')` runs after `HOMING_SECONDS`.
  At depth 6, Home goes straight to the words (the walk comes in step 5).
- `START_DEPTH` is clamped. The ending's button still calls `startRun`.
- Dev hooks: `__mode`, `__exits`, `__exitsAfterBoss`, `__killBoss`,
  `__strain`, `__end`, `__continue`, `__runStats`.
- **Done when** A1-A6 pass.

**Step 2** (`save.ts`, `pool.ts`, `loot.ts`, `hud.ts`, `main.ts`)

- `openSave` with the probe, memory mode, corrupt backup, newer-version
  read-only, merge-on-write, and the legacy hint migration.
- `rollPart` takes a `PoolView`, following 4.9, 4.10 and `fillEmpty`.
- `markFound` plus a write in `takePart`.
- `commit` writes the card (without a line yet), history (runs only),
  `pendingHook` and `lastEnding`. `firstRunAt` is set.
- **Done when** B1-B11 pass.

**Step 3** (`workshop.ts`, `still.ts`, `audio.ts`, `ambience.ts`, `music.ts`, `hud.ts`, `ending.ts`, `sw.js`, `vite.config.ts`, `kit.ts`)

- The room (§5.1, §5.2) and its light (§5.3).
- HUD modes, and the ending's continue going to arriving.
- The three arrivals, with `beginReassembly`, `setEyeLit` and `windUp`.
- The door beam going to `leaving` then `startRun` (random white; the hook is step 4).
- The traces, static at 'afternoon' until step 5.
- The room tone, wood steps, the precache plugin and the new `sw.js`.
- **Done when** C1, C2, C8 and H1-H3 pass. The feel test is on the phone.

**Step 4** (`workshop.ts`, `hud.ts`, `pool.ts`, `main.ts`)

- The plaque atlas and wall sections, the chooser card, turning, the hook
  and hanging, the default, and `startPart`.
- **Done when** C3-C7 and C9 pass.

**Step 5** (`areas.ts`, `world.ts`, `grade.ts`, `dungeon.ts`, `main.ts`, `workshop.ts`)

- `DAY`, `applyDay`/`reapplyDay`, `AREAS`, `areaOf`, `bossFor` and `hourAtEnd`.
- The `generateLevel` kit refactor, keeping `__gen` identical.
- The window hour and the traces by hour.
- `generateWalkHome`, the lit house, and `toWalk`/`walkHome`.
- **Done when** A7, A8 and D1-D5 pass.

**Step 6** (`crayon.ts`, `cards.ts`, `workshop.ts`, `pause.ts`, `main.ts`, `ending.ts`)

- The strain line tally, the capture, the shader and IndexedDB.
- Card composing, the board, the look-back screen, the doorframe marks.
- The depth line leaves the ending screen.
- **Done when** E1-E6 pass. The crayon look is tuned on the phone.

**Step 7** (`notebook.ts`, `combat.ts`, `main.ts`, `hud.ts`, `pause.ts`)

- The tallies and history commit, `NAMED`, and the history line on cards.
- `ROSTER`, `assignNames`, `onWake(at, pack)`, the first-meet label, and the
  notebook screen.
- **Done when** F1-F5 pass.

**Step 8** (`main.ts`, `save.ts`, `combat.ts`, `boss.ts`)

- `writeSnapshot` at 4.15, the boot router, `resumeRun` with repair (4.16),
  and bossFelled resume.
- The `rams-mites` summon (4.24).
- **Done when** G1-G7 pass.

---

## 9. Acceptance

### 9.1 The five core mechanics

**The three outcomes**
- *Given* a crawl at depth 2, *when* HP reaches 0, *then* the phase is
  `broken`, a card with `end: 'broken'` is in the stored save before the
  first `broken` tick runs, and the flow reaches `ending`, then `arriving`,
  then `workshop`.
- *Given* strain 18, *when* a push costs 2, *then* the ending is `stopped`,
  by the same path.
- *Given* a fallen Assembler, *when* Still walks into the warm beam, *then*
  it's `home`, by the same path, with the Home words.

**Never trapped (the "vent" analog)**
- *Given* the Assembler down at depth 3 with 3 summoned hulks awake, *when*
  Still walks into the warm beam, *then* `homing` begins, `combat.hp` doesn't
  change afterward, and no phase between `crawl` and `workshop` accepts
  damage or strain.

**The reward fork**
- *Given* any depth 1-12, *when* `exitsAfterBoss(depth)` runs, *then* it
  returns `['cold', 'warm']` below `RUN_DEPTHS` and `['warm']` at or above it.
- *And* a boss level never has more than two beam meshes.

**The kept thing persists**
- *Given* any ending, *when* the tab is closed in its first tick (read
  `localStorage` synchronously right after the trigger), *then* the card,
  the history, `pendingHook` and `lastEnding` are all there and `run` is null.
- *And* a reload arrives in the Workshop with the card on the board.

**The game-specific mechanic: found on pickup, and the hook**
- *Given* an unfound Patient Lens on the floor at depth 2, *when* it's taken,
  *then* the stored `found` includes it at once.
- *And* at the ending it's a hook candidate.
- *And* hung on the hook, the next run starts with it on.

### 9.2 Headless checks

**Setup.** Playwright in a fresh context, against `npx vite --host` (the
preview build for H). Use `page.addInitScript` for storage pre-seeding.
Anything that steps the world runs inside one synchronous `page.evaluate`,
as HANDOVER says. Async checks (IndexedDB) call `__hold(true)` first, so the
rAF loop only renders.

**New dev hooks** (`import.meta.env.DEV`, in `main.ts`):

| hook | returns / does |
|---|---|
| `__mode()` | the current `Phase` |
| `__save()` / `__setSave(patch \| null)` / `__store()` | a deep copy / merge a patch into the live save and write (`null` = fresh) / `'local' \| 'memory'` |
| `__exits()` | `{ cold: {x, z, open} \| null, warm: {x, z, open} \| null }` |
| `__exitsAfterBoss(d)` | `ExitKind[]` |
| `__killBoss()` | deals the boss its remaining HP through combat's damage path (so `onKill` fires on the next step) |
| `__strain(n)` | `addStrain(n, center)` |
| `__end(kind)` | triggers an ending the game's way: hp 0 / strain to 20 / open warm and place Still in it |
| `__continue()` | the ending's button |
| `__descend()` | as if walking into the open cold beam |
| `__workshop({ arrival?, hour? })` | enter the room now (arrival default 'idle') |
| `__near()` / `__interact()` / `__choose(id)` | the active zone / press the card's action / tap a chooser icon |
| `__turn(id)` / `__wallCard(slot)` | `toggleTurn` through the rules / the `ChooserSpec` the wall would show |
| `__traces()` / `__day()` / `__hourAtEnd(kind, d)` | `TraceSet` / `{ day, sat, fogNear, fogFar, keyLight, grace }` / `HomeHour` |
| `__rollMany({ source, depth, n, from? })` | `{ ids: Record<PartId, number>, unfound: number }` using the live pool |
| `__dropAt(id, x, z)` / `__take()` / `__offer()` | drop a part / take the offered one / `{ id, name, tag, history } \| null` |
| `__notebook()` / `__names()` / `__labels()` | entries / this level's roster names / label texts drawn this frame |
| `__drawings()` / `__idbKeys()` / `__cardCanvas(id)` | `{ available, pending }` / `Promise<string[]>` / the composed card canvas |
| `__now(iso \| null)` / `__marks()` | override "now" / `{ yanah, yuri }` mark counts |
| `__fillSave()` | the largest save the rules allow (30 found, 43 entries, 6 leaders each, 36 cards, a snapshot) |
| `__hold(on)` | the rAF loop renders only |
| `__runStats()` | `[{ depth, pushes, quiets, strainIn, strainOut }]` |
| `__adds()` / `__summon()` | live boss adds `[{ kind, hp }]` / force and resolve a summon |

**A: the warm beam and the endings (step 1)**

- **A1.** `__enter(3); __killBoss(); __step(0.05)` → `__exits()` has cold
  and warm both open, and warm = centre + side × 4.5 (4.3). `__enter(6);
  __killBoss(); __step(0.05)` → cold is null or closed and warm is open. For
  d in 1..12, `__exitsAfterBoss(d)` has length 1-2 and is ⊆ {cold, warm}.
- **A2.** After A1 at depth 3: `const w = __exits().warm; __still.pos.set(w.x, 0,
  w.z); __step(0.02)` → `__mode() === 'homing'`, and `__save().lastEnding.kind
  === 'home'` (from step 2 on). Then `__step(0.7)` → `'ending'`.
- **A3.** `__arena(); __combat.hp = 0; __step(0.02)` → `'broken'`. Then
  `__step(1)` → `'ending'`.
- **A4.** `__arena(); __run.strain = 18; __strain(2)` → `'stopping'`. Then
  `__step(4)` → `'ending'`.
- **A5.** `__arena(); __run.strain = 18; __strain(2); __combat.hp = 0;
  __step(0.05)` → the phase is `stopping` and exactly one new card (from step 2 on).
- **A6.** Load `?depth=9` → `__run.depth === 6`. At depth 6 after
  `__killBoss`, `__level().exitOpen === false`.
- **A7** (step 5). Warm at depth 6 → `__until(() => __mode() === 'walkHome',
  3) >= 0`, `__level().packs.length === 0`, the HUD is in walk mode (no
  buttons), and `__day().day === 'night'`. Put Still at `__level().house.door`
  and `__step(0.02)` → `'ending'`.
- **A8** (step 5). A baseline of `__gen(d, s)` for d 1..6 and s 1..20, taken
  before the refactor, is deep-equal to the same calls after it.

**B: the save and the pool (step 2)**

- **B1.** Fresh context → `__save()` has `v === 1`, `found` sorted equals
  `STARTER_POOL` sorted, `turned` is `[]` and `hook` is null.
- **B2.** In the init script: `localStorage.setItem('still.pushHint.overrun', '1');
  localStorage.setItem('still.merge.keep', 'x')`. After boot, `__save().hints`
  includes `overrun`, the legacy key is gone, and `still.merge.keep` is still `'x'`.
- **B3.** After a pickup and an ending, the keys the game added to
  `localStorage` are exactly `['still-action.save']`.
- **B4.** `__rollMany({ source: s, depth: 1, n: 3000 }).unfound === 0` for
  every source. At depth 2, elite's unfound rate is in [0.21, 0.29].
- **B5.** `__rollMany({ source: 'kill' | 'crate', depth: 5, n: 3000 }).unfound === 0`.
- **B6.** `__setSave({ turned: ['cracked-lens', 'flare'] })`, then 5000 rolls
  per source at depth 5 → neither id ever drops. 2000 `fillEmpty` calls never
  give `flare`.
- **B7.** At depth 2: `__dropAt('patient-lens', 0.5, 0); __step(0.6); __take()`
  → `JSON.parse(localStorage['still-action.save']).found` includes it, read
  in the same evaluate. `__offer()` showed `tag: 'new'` before the take.
- **B8.** In the init script, `Storage.prototype.getItem`, `setItem` and
  `removeItem` throw, and `delete window.indexedDB`. Boot works (`__mode()`
  isn't 'boot' within 5 s) with 0 `pageerror` events, and `__store() ===
  'memory'`. `__end('broken')`, `__step(1)`, `__continue()` then
  `__until(workshop)` → the board prompt reads "1 runs" (placeholder copy),
  and `__drawings().available === false`.
- **B9.** Stored `'{oops'` → boots fresh, and `localStorage['still-action.save.corrupt']
  === '{oops'`.
- **B10.** Stored `{"v":99,…}` → `__store() === 'memory'`, and after an
  ending the stored string is byte-identical.
- **B11.** `__fillSave(); __setSave({})` (to write it) →
  `localStorage['still-action.save'].length < 20000`.

**C: the Workshop, the hook and the wall (steps 3-4)**

- **C1.** First boot → `'crawl'` at depth 1 (4.21). `__end('stopped');
  __step(4); __continue(); __until(() => __mode() === 'workshop', 10) >= 0`.
  The HUD has no ability buttons, and a second boot goes to `'workshop'`.
- **C2.** For each kind, `__workshop({ arrival: kind })` then
  `__until(workshop)`:
  - broken: each part's local position is within 0.01 of home, and the eye is lit
  - stopped: `__still.slowdown === 0`
  - home: `__still.pos.z > -5`
- **C3.** `__setSave({ hook: 'rusted-hook', pendingHook: null });
  __workshop(); __still.pos.set(4, 0, -5.3); __step(0.02)` →
  `__until(crawl, 3)`, `__hud.loadout.map(p => p.id)` is `['rusted-hook']`,
  and `__save().run.depth === 1` (from step 8 on).
- **C4.** An ending with only `through-line` worn
  (`__hud.resetLoadout([__parts.find((p) => p.id === 'through-line')])`)
  → `pendingHook.candidates` is `[]`. Door → the run starts with
  one white, ∈ facing-out STARTING.
- **C5.** `__setSave({ hook: 'ward', pendingHook: { candidates: ['focusing-lens', 'ward'] } })`
  → door → it starts with `ward`. With `hook: 'kickstart'` → it starts with `focusing-lens`.
- **C6.** A broken ending wearing lens, vent, cleaver and anvil (gold) →
  candidates are `['focusing-lens', 'pressure-vent', 'scrap-cleaver']`.
- **C7.** `__setSave({ turned: ['flare'] })`: `__turn('focusing-lens') === false`,
  `__turn('cracked-lens') === true`. `__setSave({ hook: 'piston' });
  __turn('piston')` → `__save().hook === null`.
- **C8.** Placing Still at each anchor in §5.6 → `__near()` is that id. At
  (1.8, 0, −4.5), `__near() === 'hook'` (nearest wins).
- **C9.** `__wallCard('head')`: `through-line` (unfound, gate `boss`) has
  state `bare`, and selecting it shows the detail line of the boss hint, with
  action `null`.

**D: one day (step 5)**

- **D1.** `__enter(d)` for d = 1..6 → `__day().day` is morning, late-morning,
  noon, afternoon, late-afternoon, dusk. `__day().fogNear` equals
  `grade.fogNear × DAY[key].fog` (± 1e-6).
- **D2.** After `grade.saturation = 0.5; apply(__world)` at depth 6, the
  uniform `uSaturation` equals 0.5 × 0.82.
- **D3.** `__hourAtEnd` matches the table in 4.13 for all 18 (kind, depth) pairs.
- **D4.** Stopped at depth 6 → at `'ending'`, `uSaturation` ≈ `grade.saturation
  × 0.82 × 0.2`.
- **D5.** `__workshop({ hour: 'night' })` → `__traces()` has kidsDoor 'ajar',
  blocks 'boxed', crayons false and rain true. At 'afternoon', kidsDoor is 'swings-shut'.

**E: cards, drawings and the doorframe (step 6)**

- **E1.** Right after `__end('stopped')`, in the same evaluate, the stored
  newest card has `end 'stopped'` and `line.length >= 1`.
- **E2.** After the ending plays, `__hold(true); await until __drawings().pending
  === 0; (await __idbKeys()).includes(cardId)`, and the blob is 10-150 KB.
- **E3.** With IndexedDB deleted (the init script), `__cardCanvas(id)` has
  non-paper pixels in the bottom 42 px band and only paper in the drawing area.
- **E4.** Four endings → `by` is yanah, yuri, yanah, yuri (with `FIRST_DRAWER = 'yanah'`).
- **E5.** `firstRunAt = '2026-09-25'`: with `__now('2026-09-25')`, `__marks()`
  is 1 each. With `__now('2027-03-25')` it's 7. After `__now('2026-10-01')`
  it's still 7.
- **E6.** After a 20-minute scripted run, the stored `line` is ≤ 96 chars,
  matches `/^[0-9a-k]+$/`, and has one mark per depth entered.

**F: parts remember and the notebook (step 7)**

- **F1.** A run wearing `scrap-cleaver` through a depth-3 boss kill, then
  `__end('home')` → `history['scrap-cleaver']` is `[1, 3, 1, 0, 0, 1]`. The
  next run: `__dropAt('scrap-cleaver', …)` → `__offer().name === 'Scrap
  Cleaver, that saw the Assembler'`, and history is `'carried 1 run, saw depth 3'`.
- **F2.** Waking a hulk pack at depth 1 → `__notebook()` gains one band-I
  hulk id, stored at once, and `__labels()` includes its name. A second
  hulk-pack wake of the same name in a later level → no label, and `m === 2`.
- **F3.** `ROSTER.length === 43`, the ids set equals the 43 ids in §7.3,
  exactly 2 lines are non-null, and every role or band combination
  `assignNames` can be asked for at depths 1-6 is non-empty.
- **F4.** A warding elite pack at depth 1 → the page is `lockdown-warden`,
  with `l` including the label's D2 name. At depth 5 it's `corrupted-overseer`.
- **F5.** `__gen(d, s)` output is unchanged by names (names live outside it; see A8).

**G: resume and the second Assembler (step 8)**

- **G1.** In a run at depth 1 with strain 6: `__descend(); __until(crawl)`
  → the stored `run.depth` is 2. `page.reload()` → `__mode() === 'crawl'`,
  `__run.depth === 2`, strain 6, the same loadout ids, and the same
  `__level().rooms` centres as before the reload.
- **G2.** At depth 3: `__killBoss(); __step(0.1)`, then reload → no boss,
  both exits open, and the two boss drops on the floor (minus any worn).
- **G3.** Stored `run` with `loadout: ['no-such-part', 'ward', null, null],
  depth: 9` → resumes at depth 6, with the loadout `[null, 'ward', null, null]`.
- **G4.** Stored `run.s = 0` → `'workshop'`, `save.run === null`, and the
  banner is shown once.
- **G5.** `__enter(6); __summon()` → `__adds()` has ≤ 1 charger, the rest
  swarm, and the HP sum is ≤ 72. `__enter(3); __summon()` → all chasers.
- **G6.** Load `?depth=3`, `__killBoss()`, take both drops, `__end('home')`
  → the stored string is byte-identical to before the load.
- **G7** (pace, not a gate). A Monte Carlo run 400 times:
  - Profile: two runs ending at depth 2, then runs alternating home-at-3 and full.
  - Per depth: elites from `__gen(d, rand)`, P(Plenty) 0.375, and the boss
    at 3 and 6, rolling through the real `rollPart` with a live `PoolView`.
  - Pass if the median number of runs to find all 30 is in [8, 14]. Tune
    `POOL_RULES` only.

**H: the service worker (step 3; preview build)**

- **H1.** A node script after `npm run build`:
  - `dist/sw.js` contains neither token.
  - The parsed `PRECACHE` covers every file in `dist/` except `sw.js`, `*.map` and `LICENSE.txt`.
  - Every hash matches the file.
- **H2.** `npx vite preview`, then:
  1. Load, and wait for `navigator.serviceWorker.ready` plus the controller.
  2. `context.setOffline(true)`, then reload.
  3. `__enter(4)` and `__workshop()`.
  4. There are 0 `requestfailed` events, and footstep_wood and every kit
     GLB report `fromServiceWorker()`.
- **H3.** Before the first load, `caches.open('jil-devotion-v1')` (in an
  earlier page on the origin). After the SW activates, it still exists, and
  `still-action-v1` is gone.

---

## 10. Out of scope

| item | why not now |
|---|---|
| Area II content (the Works, the quarter, the Arbiter, the thief, slag cores, the Lobber, the Hazard) | It's the next change. This spec only leaves `AreaDef`, `bossFor`, `dayAt` and the reserved roster pages. |
| Yanah's and Yuri's parts, and when they drop | Adrian writes them. Nothing here reserves a slot or a gate. |
| The kids as figures | Adrian chose traces. |
| Doors, not upgrades (node kinds opened by moments) | DESIGN: later. |
| Marks on Still | It needs "Still wears his parts" first. |
| Node map, Den/Hollow flavours, two cold beams with glyphs | It isn't in the settled design. The fork stays binary. |
| Sit down at a Rest shrine | DESIGN: no. Stopped stays something that happens to him. |
| Quiet −2 → −1, and Wear | A feel test on the phone. `__runStats` is the instrument. |
| Cairns where you fell | Contested, and not in the settled design. |
| The test bench | It needs a second combat context. |
| The photo instead of the drawing | The drawing *is* the frame, redrawn. One keepsake. |
| A recorded room tone | Synthesized by default. The repo is public, so a recording is Adrian's choice. |
| The Workshop following the phone's clock | Withdrawn by the translator in favour of "a run is one day". |
| Pulling a D7 pack row into depths 5-6 | The content step's call (D7 is unreachable at 6 depths). |
| Seeded loot, replays, sharing, export/import, cloud sync | No pitch needs it, and loot stays `Math.random`. |
| A different Home copy after depth 3 vs 6 | One placeholder. Adrian can split it later. |
| "The room fills" (20-25 domestic props) | Authored content. The kit has no rugs or plants. |

---

## 11. Contradictions found, and how they're resolved

1. **"start → Workshop → run" vs "run 1 has no Workshop before it"**
   (translator R8) and "home from the first night". The first boot goes
   straight into the maze, and every later boot opens the Workshop (or
   resumes). `FIRST_RUN_IN_MAZE` flips it. (4.21)
2. **"A Broken run at noon comes home to an empty afternoon room"** (PITCHES)
   vs "Broken or Stopped: whatever hour it happened" (DESIGN). DESIGN wins:
   the window shows noon. The kids are out at morning and noon, so the room
   is empty either way. (4.13)
3. **"reached depth N" on the ending screen** vs "the number goes in the
   caption, not the headline". The line leaves the ending screen once cards
   exist (step 6), and until then stays so the depth isn't lost. (4.14)
4. **"Run 1 starts with a random white, as today"** (the 4 `STARTING`
   whites) vs "a random white" once 8 whites exist and can be turned. It's
   random among facing-out `STARTING` whites, then any facing-out white. (4.6)
5. **"The hook never takes a turned part"**, but a hooked part can be turned
   afterward. Turning it unhooks it; a turned candidate is shown disabled. (4.7)
6. **The iso camera sees only +x/+z faces**, so the house's outside door and
   the room's inside door face opposite ways. Accepted, and hidden by the
   fade; a camera-side door would paint the beam over the room. (Risk 2)
7. **Choosing the starting white at the wall** (translator M2, verifier W3)
   vs the hook by the door (DESIGN). The hook wins. The wall only turns parts.
8. **The grade panel sets absolute `grade` values vs per-hour presets.**
   Presets multiply `grade`, and `apply()` reapplies the hour. Morning is
   today's look. (§6.2)
9. **`grade.json` and `world.ts` disagree** (fog 58/135 vs 44/72, Grace 400
   vs 300). Not resolved here: the presets work over whichever Adrian copies in.
10. **The service worker's activate deletes every cache on the shared
    origin.** A bug. The fix deletes only `still-action-*`. (§5.11)
11. **Content design lists "per-area presets" and "precache" as its own
    foundations.** This spec builds both (steps 3 and 5), so the content
    step's step 1 shrinks to the `Boss` interface and the `Hazard`.
12. **The second Assembler's rams-and-mites adds** (Home DESIGN) vs depth 6
    being the Arbiter (content DESIGN). Build the adds now through `bossFor`.
    The content step swaps depth 6, and the adds stay as content's documented
    one-evening fallback.
13. **"Named ones from the old roster, until the notebook exists"** (content:
    cut) vs names here. Names here are cosmetic only. The content cut was
    about *twists* on named enemies, which stay cut.
14. **Unfound rates** (balancer 50% per level from the first elite, verifier
    25% elites and Plenty, boss gold always). The 25% set is used, with the
    boss gold capped to golds. Check G7 is the arbiter.
15. **"Save when the ending starts"** (verifier) vs the design saving "at
    every beam". Both hold: a snapshot at each beam, and the commit at the
    terminal trigger. (4.12, 4.15)
16. **Buttons on the walk home would let a push Stop him** on a level that
    "has no enemies". The walk hides the buttons, so it can't fail. (4.25)
17. **Resume "at the start of the depth"** would make a player refight a
    felled Assembler. `bossDown` is itself a beam save (`bossFelled`). (4.15)
18. **"Every ending keeps everything"** vs a 20 KB `localStorage` budget with
    unbounded cards. `localStorage` keeps the newest 36, and IndexedDB keeps
    every card and drawing. Without IndexedDB, the oldest cards past 36 are
    the one thing a private or old browser can't keep. (4.19)
19. **DESIGN and HANDOVER are dated 26 Sep; today is 25 Sep.** Cosmetic, not changed.

---

## 12. Summary

- A run is 6 depths and one day, from morning to a night walk to the lit
  house. After each Assembler a warm beam opens, and the choice between cold
  and warm is a closed binary type.
- All three endings (broken, stopped, home) commit at the moment they're
  triggered. The commit is one write: a card with a strain line, the history,
  the hook's candidates, and the last ending. After the ending, each arrival
  brings Still into the Workshop its own way.
- The Workshop is a 12×12 room built from vendored kit pieces, with a
  fallback for every new piece. Grace's light is its lamp, and the kids are
  traces that change with the hour. In it are the hook by the door, the wall
  of parts (you can turn a part to face the wall, but each slot keeps one
  white facing out), crayon cards on the corkboard (stored in IndexedDB, with
  the strain line alone as the fallback), the doorframe marks growing with
  the calendar, and the notebook of the 43 names (41 pages blank for Adrian).
- The pool starts at 12. Unfound parts come from elites, Plenty and the
  Assembler, never at depth 1, and are saved the moment they're picked up.
  The save is one prefixed, versioned key with a memory fallback.
- Resume is at the last beam, repaired rather than discarded. The service
  worker precaches a hashed build list, and stops deleting other projects' caches.
- Eight steps, each ending playable, each with the headless checks that
  prove it against the existing and new dev hooks.
