import * as THREE from 'three'
import { RIM, type Piece } from './kit'
import type { RosterId } from './save'
import type { AmbienceMood } from './ambience'
import { grade, FOCUS_DEPTH, type World } from './world'
import { curveAt } from './curve'

/**
 * The run's shape: how deep it goes, where the Assemblers stand, which beams open
 * when one falls, what each area is built from, and the hour at every depth. A
 * run is two areas of three depths and one day long, from morning to a night walk
 * home, and it ends in one of three ways (design/meta/SPEC.md §2.1, §6).
 */

/** Every third depth closes an area with the Assembler. */
export const BOSS_EVERY = 3
/** Grace's light leans toward the warm beam once an Assembler falls. It nudges the one decision (Adrian's call). */
export const LEAN_HOME = true
/**
 * The first boot goes straight into the maze, as in the genesis opening: he wakes
 * alone there, and the first ending, however it goes, is the first time he's
 * brought home. False opens the Workshop first (Adrian's call).
 */
export const FIRST_RUN_IN_MAZE = true

// --- area III's switches (design/area3/SPEC.md §1.7) -------------------------------------

/**
 * The Line and its crossroads. False: no crossroads and no alternate, the route is always 'II', save.roads never
 * gains 'III'; with BOTH_ROADS the Line is still area 3 (Works first).
 */
export const LINE_ENABLED = false
/** The Engine as the Line's boss at 6. False: route III's depth 6 is the quarter's square with the Arbiter. */
export const ENGINE_ON_LINE = false
/** The Porter (stage D). */
export const PORTER_ENABLED = false
/** Both roads in one run (design/area3/BOTH-ROADS.md §4). DEV override ?roads=1. */
export const BOTH_ROADS = false
/** How the road is chosen: the crossroads room, or (the fallback) alternating by save.lastRoad. */
export const ROAD_CHOICE: 'crossroads' | 'alternate' = 'crossroads'

export type FlagName = 'line' | 'engine' | 'porter' | 'roads'
const FLAG_DEFAULT: Record<FlagName, boolean> = { line: LINE_ENABLED, engine: ENGINE_ON_LINE, porter: PORTER_ENABLED, roads: BOTH_ROADS }
/**
 * DEV overrides (a URL param or __flags); null is the constant. Production builds never
 * read them: `import.meta.env.DEV` is false there, so the constants are the whole story.
 */
const flagOverride: Record<FlagName, boolean | null> & { roadChoice: 'crossroads' | 'alternate' | null } = {
  line: null, engine: null, porter: null, roads: null, roadChoice: null,
}
if (import.meta.env.DEV && typeof location !== 'undefined') {
  const q = new URLSearchParams(location.search)
  for (const k of ['line', 'engine', 'porter', 'roads'] as const) {
    const v = q.get(k)
    if (v !== null) flagOverride[k] = v !== '0' && v !== 'false'
  }
}
/** INV: the only way code reads the switches. */
export function flag(name: FlagName): boolean {
  if (import.meta.env.DEV) return flagOverride[name] ?? FLAG_DEFAULT[name]
  return FLAG_DEFAULT[name]
}
/** ROAD_CHOICE, through the same DEV override. */
export function roadChoice(): 'crossroads' | 'alternate' {
  if (import.meta.env.DEV) return flagOverride.roadChoice ?? ROAD_CHOICE
  return ROAD_CHOICE
}
/**
 * DEV only (__flags): override for this page; null (or absent) leaves one as it is, undefined too.
 * INV-F1: never 'roads'. The run's length is fixed at load (RUN_DEPTHS), so a runtime flip could only
 * disagree with a live DayTracker and snapshot; 'roads' is set by the URL, or not at all.
 */
export function setFlags(o: Partial<Record<FlagName, boolean | null>> & { roadChoice?: 'crossroads' | 'alternate' | null }) {
  if (!import.meta.env.DEV) return
  for (const k of ['line', 'engine', 'porter', 'roadChoice'] as const) if (k in o) (flagOverride as Record<string, unknown>)[k] = o[k] ?? null
}
/** What the switches read as now, for checks. */
export const flagsNow = () => ({ line: flag('line'), engine: flag('engine'), porter: flag('porter'), roads: flag('roads'), roadChoice: roadChoice() })

/**
 * How deep a run goes: 6, or 9 with both roads. INV-F2: read once at module load, after the URL overrides
 * above, and fixed for the page's life; a production build always reads BOTH_ROADS. INV-F3: RUN_DEPTHS === 9
 * if and only if flag('roads').
 */
export const RUN_DEPTHS: 6 | 9 = flag('roads') ? 9 : 6

export const otherRoad = (r: RouteId): RouteId => (r === 'II' ? 'III' : 'II')

/** A road's own step: 1-3 are the ruin; 4/5/6 are a road's first, second and last depth. */
export type Step = 1 | 2 | 3 | 4 | 5 | 6
/**
 * INV-S1: stepOf(d) === d for every d in 1..6, whatever the run length.
 * INV-S2: stepOf(7|8|9) === 4|5|6. The depth is clamped to 1..RUN_DEPTHS first, with the clamp every
 *         depth reader uses (not floored), so in a 6-depth run 7 reads as 6.
 * Place and road rules read the step; only the curve reads the depth.
 */
export function stepOf(depth: number): Step {
  const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
  return (d <= 6 ? d : d - 3) as Step
}

/**
 * The road a depth is on. `order` is ALWAYS the road taken at the crossroads (run.route, area 2's road),
 * never the road at some depth.
 * INV-O1: clamped depth <= 6 gives order; 7..9 give otherRoad(order). In a 6-depth run, always order.
 * INV-O2: every exported function that takes a `route` param (lookAt, areaOf, bossFor, openAt) and every dev
 *         hook that takes one (__gen, __genLook, __genKit, __census, __plan) takes the ORDER and applies
 *         roadOf once, inside. Callers never pass roadOf(...) in: it would flip depths 7-9 twice.
 */
export function roadOf(depth: number, order: RouteId = 'II'): RouteId {
  const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
  return d <= 6 ? order : otherRoad(order)
}

/**
 * INV-P1: the open field is depth 1, and the Works' first step (4 on Works-first, 7 on Line-first). Never the
 *         Line's (the generator refuses one there), never a boss's: exactly two per 9-depth run.
 * INV-P2: in a 6-depth run: 1, and 4 only when order is 'II'. That equals the old OPEN_DEPTHS [1, 4] after the
 *         generator's own `!gen.line` refusal (dungeon.ts).
 */
export function openAt(depth: number, order: RouteId = 'II'): boolean {
  return depth === 1 || (depth <= RUN_DEPTHS && stepOf(depth) === 4 && roadOf(depth, order) === 'II')
}

/** INV: exactly these two. 'II' is area II as built; 'III' is the Line. */
export type RouteId = 'II' | 'III'

/** The two beams. INV: never a third. */
export type ExitKind = 'cold' | 'warm'

/**
 * INV: the only place the fork is decided. Before the last depth a fallen
 * Assembler opens both, on and home; after the last one, only home is left.
 * Length 1 or 2, members cold/warm only, whatever else changes.
 */
export function exitsAfterBoss(depth: number): ExitKind[] {
  return depth < RUN_DEPTHS ? ['cold', 'warm'] : ['warm']
}

/** The hour the Workshop window shows when he comes home. */
export type HomeHour = 'morning' | 'noon' | 'afternoon' | 'dusk' | 'night'

/**
 * §4.13. Broken or Stopped: whatever hour it happened. Home is a different homecoming by how far he got, not
 * a lesser one. A 6-depth run has two: the afternoon before the last depth, the kids awake, and night from it,
 * the kids asleep. A 9-depth run has three: the afternoon at 3, dusk at 6 (the middle boss: the day has
 * turned, the kids are still up), night at 9.
 * INV-H1: for a fixed depth, home's hour is never earlier than broken's, and no hour runs backward as depth rises.
 */
export function hourAtEnd(kind: 'broken' | 'stopped' | 'home', depth: number): HomeHour {
  if (RUN_DEPTHS === 6) {
    if (kind === 'home') return depth >= RUN_DEPTHS ? 'night' : 'afternoon'
    if (depth <= 2) return 'morning'
    if (depth === 3) return 'noon'
    if (depth <= 5) return 'afternoon'
    return 'dusk'
  }
  if (kind === 'home') return depth >= 9 ? 'night' : depth >= 6 ? 'dusk' : 'afternoon'
  if (depth <= 2) return 'morning'
  if (depth === 3) return 'noon'
  if (depth <= 6) return 'afternoon'
  return 'dusk'
}

// --- areas and places ------------------------------------------------------------------

export type AreaId = 'I' | 'II' | 'III'
/** 'grate' is the Works' walkways; the ruin maps it to its own paving. */
export type SurfaceRole = 'paving' | 'rock' | 'wood' | 'ground' | 'grate'
export type FootSurface = 'stone' | 'wood' | 'plate'
/** The room tones: ambience.ts owns the list. */
export type { AmbienceMood }
/** A depth's look (design/content/SPEC.md §2.1): area II has two, the Works and the quarter. */
export type PlaceId = 'ruin' | 'works' | 'quarter' | 'sidings' | 'station'
/** The Works' beyond: code-built machinery standing in the fog (the Works step builds them). */
export type MachineKind = 'chimney' | 'crucible' | 'press' | 'hopper' | 'gantry'

/** What a place builds with. The ruin's is exactly what the generator built before areas existed. */
export interface KitPreset {
  /** Cumulative thresholds against ONE rand() per cell, in order (keeps __gen stable). */
  floorRoom: [Piece, number][]
  floorCorridor: [Piece, number][]
  wall: Piece
  column: Piece
  /** [piece, scale], in the order a room's props are picked from. */
  cover: [Piece, number][]
  /** The ones that break: barrel, box, stack. The arena's crates are the first two. */
  breakable: Piece[]
  beyondTall: Piece[]
  /** [hidden-side rubble, the ground's scatter]. */
  beyondLow: Piece[]
  arenaCover: Piece
}

/**
 * Generator knobs area I doesn't have. INV: the ruin's reproduce today's rand() sequence
 * exactly. The Works and quarter steps read them; until then every place is the ruin's.
 */
export interface GenPreset {
  /** Props per room cell at room progress 0 and 1. ruin: [0.25, 0.25], so n = round(cells / 4) as today. */
  cover: [start: number, end: number]
  /** Min distance between props, and placement tries per room. */
  coverGap: number
  coverTries: number
  /** INV: no prop's top exceeds this; a taller piece is scaled to fit. Infinity in the ruin (its props untouched). */
  coverMaxH: number
  /** Intact cover: at room progress p a prop is drawn from here with chance p (one extra rand(), only when present). */
  intact?: [Piece, number][]
  /** Floor tables by progress band: the last band whose `from` <= p. Absent: kit.floorRoom. */
  floorBands?: { from: number; room: [Piece, number][] }[]
  /** Upright far-side pieces (door frames), only where the floor isn't hidden. Chance by nearest-room progress. */
  farSide?: { pieces: Piece[]; chance: [atP0: number, atP1: number] }
  /** Share of the beyond's tall picks that become machinery instead. */
  machines?: { kinds: MachineKind[]; share: number }
  /** Chance a body carries a slag core, by archetype. ruin: {} (never). */
  slag: Partial<Record<'chaser' | 'charger' | 'ranged', number>>
  /** Chance a main-spine room is a 5x3 hall. Absent: 0.25 (today's literal). One rand() either way. */
  hallShare?: number
  /** The Line's rails and pack rules (design/area3/SPEC.md §4, §6.5). Presence switches them on. */
  line?: LinePreset
}

/** The Line's generator knobs. */
export interface LinePreset {
  /** Live lines laid across main rooms, and across corridor cells. */
  lanes: number
  crossings: number
  /** Dead sidings inside lane-free main rooms. */
  sidings: number
  /** Station halls: a hall's lane runs along its long axis, on an outer row; halls are picked first. */
  alongHalls: boolean
}

/** Everything a depth looks, sounds and generates like. */
export interface PlaceDef {
  id: PlaceId
  kit: KitPreset
  /** Which ambientCG set skins each role. */
  surfaces: Record<SurfaceRole, string>
  ambience: { crawl: AmbienceMood; boss: AmbienceMood }
  footsteps: FootSurface
  music: 'I' | 'II'
  gen: GenPreset
}

/** Area I: the ruin, exactly as the generator built it before areas existed. */
const RUIN_KIT: KitPreset = {
  floorRoom: [['floor_tile_large_rocks', 0.14], ['floor_dirt_large', 0.22], ['floor_tile_large', 1]],
  floorCorridor: [['floor_dirt_large', 0.35], ['floor_tile_large', 1]],
  wall: 'barrier',
  column: 'column',
  cover: [['crates_stacked', 1], ['barrel_large', 0.7], ['box_large', 0.8], ['rubble_half', 0.42], ['box_stacked', 0.55], ['barrel_large', 0.7], ['box_large', 0.8]],
  breakable: ['barrel_large', 'box_large', 'box_stacked'],
  beyondTall: ['wall_broken', 'wall_broken', 'pillar', 'rubble_large', 'wall', 'barrier_column'],
  beyondLow: ['rubble_half', 'floor_dirt_large_rocky'],
  arenaCover: 'barrier_column',
}
const RUIN_SURFACES: Record<SurfaceRole, string> = { paving: 'PavingStones142', rock: 'Rock035', wood: 'Planks023A', ground: 'Ground108', grate: 'PavingStones142' }
const RUIN_GEN: GenPreset = { cover: [0.25, 0.25], coverGap: 3.2, coverTries: 40, coverMaxH: Infinity, slag: {} }

const ruin: PlaceDef = {
  id: 'ruin', kit: RUIN_KIT, surfaces: RUIN_SURFACES, ambience: { crawl: 'crawl', boss: 'boss' }, footsteps: 'stone', music: 'I', gen: RUIN_GEN,
}

/**
 * Depth 4, the Works at the end of the shift: the Assembler's foundry. Plate floors with
 * walkway grates, the same waist-high barriers skinned in sheet iron, kegs and crates for
 * cover (capped at the barrier's height), and machinery standing in the fog beyond.
 */
const works: PlaceDef = {
  id: 'works',
  kit: {
    floorRoom: [['floor_tile_big_grate', 0.14], ['floor_tile_large_rocks', 0.22], ['floor_tile_large', 1]],
    floorCorridor: [['floor_tile_big_grate', 0.6], ['floor_tile_large', 1]],
    wall: 'barrier',
    column: 'column',
    cover: [['keg', 0.65], ['crates_stacked', 1], ['barrel_large', 0.7], ['box_large', 0.8], ['keg', 0.65], ['rubble_half', 0.42]],
    breakable: ['barrel_large', 'box_large'],
    beyondTall: ['wall_gated', 'wall_scaffold', 'pillar', 'wall_broken'],
    beyondLow: ['rubble_half', 'floor_dirt_large_rocky'],
    arenaCover: 'barrier_column',
  },
  surfaces: { paving: 'MetalPlates006', rock: 'Metal063', wood: 'Metal063', ground: 'Ground108', grate: 'MetalWalkway014' },
  ambience: { crawl: 'works', boss: 'works' },
  footsteps: 'plate',
  music: 'II',
  gen: {
    cover: [0.25, 0.25], coverGap: 3.2, coverTries: 40, coverMaxH: 1.4,
    machines: { kinds: ['chimney', 'crucible', 'press', 'hopper'], share: 0.45 },
    slag: { chaser: 0.4, charger: 0.4, ranged: 0.25 },
  },
}

/**
 * Depth 5, the square at 6, and the walk home: the workers' quarter, more intact the closer
 * it gets to home. Broken furniture near the Works, whole toward the house; tile and then
 * wood underfoot; door frames still standing on the far side. "More intact" is never taller:
 * the walls stay the waist-high barrier, and every prop is capped at its reach. Cover gets
 * denser as you go (1/8 to 1/3 a cell), which is what the Lobber punishes. INV: no cot,
 * bed or toy in any list: the kids are too near.
 */
const quarter: PlaceDef = {
  id: 'quarter',
  kit: {
    floorRoom: [['floor_tile_large_rocks', 0.25], ['floor_wood_large_dark', 0.45], ['floor_tile_large', 1]],
    // the street between rooms
    floorCorridor: [['floor_dirt_large', 0.4], ['floor_tile_large_rocks', 1]],
    wall: 'barrier',
    column: 'column',
    cover: [['table_long_broken', 0.8], ['table_medium_broken', 0.9], ['chair', 0.9], ['rubble_half', 0.42], ['box_large', 0.8], ['barrel_large', 0.7]],
    // the arena's crates are the first two: a barrel and a box, as ever
    breakable: ['barrel_large', 'box_large', 'chair', 'chair_A_wood', 'cabinet_small'],
    beyondTall: ['wall_broken', 'wall', 'pillar', 'rubble_large'],
    beyondLow: ['rubble_half', 'floor_dirt_large_rocky'],
    arenaCover: 'barrier_column',
  },
  surfaces: { paving: 'Tiles093', rock: 'Bricks097', wood: 'Planks023A', ground: 'PavingStones142', grate: 'MetalWalkway014' },
  ambience: { crawl: 'quarter', boss: 'square' },
  footsteps: 'wood',
  music: 'II',
  gen: {
    cover: [0.125, 0.33], coverGap: 2.6, coverTries: 60, coverMaxH: 1.4,
    intact: [['couch', 0.9], ['cabinet_small', 1], ['cabinet_medium', 0.9], ['table_medium', 1], ['chair_A_wood', 1], ['table_long', 0.8]],
    floorBands: [
      { from: 0, room: [['floor_dirt_large_rocky', 0.3], ['floor_tile_large_rocks', 0.65], ['floor_tile_large', 1]] },
      { from: 0.34, room: [['floor_tile_large_rocks', 0.25], ['floor_wood_large_dark', 0.45], ['floor_tile_large', 1]] },
      { from: 0.67, room: [['floor_wood_large_dark', 0.45], ['floor_tile_large', 1]] },
    ],
    farSide: { pieces: ['wall_doorway', 'wall_window_open'], chance: [0.05, 0.35] },
    slag: { chaser: 0.4, charger: 0.4, ranged: 0.25 },
  },
}

/**
 * The Line (area III, design/area3/SPEC.md §4.1). Depth 4, the sidings: a goods yard, gravel
 * and broken tile underfoot, brick retaining walls, crates and barrels for cover, dead signal
 * gantries standing in the fog. Straight rails cross it wall to wall. INV: no bed, cot, crib,
 * cradle, toy, swing or pram in any list.
 * The room tone stays area II's (the Works', then the quarter's) until the Line's own lands
 * (stage B4).
 */
const sidings: PlaceDef = {
  id: 'sidings',
  kit: {
    floorRoom: [['floor_dirt_large', 0.45], ['floor_tile_large_rocks', 0.6], ['floor_tile_large', 1]],
    floorCorridor: [['floor_dirt_large', 0.6], ['floor_tile_large', 1]],
    wall: 'barrier',
    column: 'column',
    cover: [['crates_stacked', 1], ['barrel_large', 0.7], ['box_large', 0.8], ['keg', 0.65], ['rubble_half', 0.42]],
    breakable: ['barrel_large', 'box_large'],
    beyondTall: ['wall_scaffold', 'wall_gated', 'pillar', 'wall_broken'],
    beyondLow: ['rubble_half', 'floor_dirt_large_rocky'],
    arenaCover: 'barrier_column',
  },
  surfaces: { paving: 'Gravel023', rock: 'Bricks097', wood: 'Planks023A', ground: 'Ground108', grate: 'Metal063' },
  ambience: { crawl: 'works', boss: 'works' },
  footsteps: 'stone',
  music: 'II',
  gen: {
    cover: [0.25, 0.25], coverGap: 3.2, coverTries: 40, coverMaxH: 1.4, slag: {}, hallShare: 0.25,
    machines: { kinds: ['gantry'], share: 0.3 },
    line: { lanes: 2, crossings: 1, sidings: 2, alongHalls: false },
  },
}
/**
 * Depth 5 (and the roundhouse at 6, stage C): the goods station. Platform halls, each with its
 * lane along an outer row and a coping at the platform's edge; tile floors, brick walls, and
 * door frames still standing on the far side.
 */
const station: PlaceDef = {
  id: 'station',
  kit: {
    floorRoom: [['floor_tile_large', 0.7], ['floor_tile_large_rocks', 1]],
    floorCorridor: [['floor_tile_large_rocks', 0.5], ['floor_tile_large', 1]],
    wall: 'barrier',
    column: 'column',
    cover: [['crates_stacked', 1], ['box_large', 0.8], ['keg', 0.65], ['table_long', 0.8], ['barrel_large', 0.7]],
    breakable: ['barrel_large', 'box_large'],
    beyondTall: ['wall', 'wall_doorway', 'wall_window_open', 'pillar'],
    beyondLow: ['rubble_half', 'floor_dirt_large_rocky'],
    arenaCover: 'barrier_column',
  },
  surfaces: { paving: 'Tiles093', rock: 'Bricks097', wood: 'Planks023A', ground: 'Gravel023', grate: 'Metal063' },
  ambience: { crawl: 'quarter', boss: 'square' },
  footsteps: 'stone',
  music: 'II',
  gen: {
    cover: [0.2, 0.3], coverGap: 3.0, coverTries: 50, coverMaxH: 1.4, slag: {}, hallShare: 0.6,
    farSide: { pieces: ['wall_doorway', 'wall_window_open'], chance: [0.1, 0.3] },
    line: { lanes: 3, crossings: 0, sidings: 1, alongHalls: true },
  },
}

export const PLACES: Record<PlaceId, PlaceDef> = { ruin, works, quarter, sidings, station }
export const PLACE_OF: Record<number, PlaceId> = { 1: 'ruin', 2: 'ruin', 3: 'ruin', 4: 'works', 5: 'quarter', 6: 'quarter' }
/**
 * INV: depths 1-3 are 'ruin' on every route. INV: ROUTES.II equals PLACE_OF for 4-6. A road's steps 4/5/6 are
 * its first, second and last depth (stepOf). In a 6-depth run III's 6 reads ENGINE_ON_LINE (lookAt): until the
 * Engine, the roads meet in the square. In a 9-depth run they never meet: each road's last step is its own
 * place (the Line's is the station, for the stand-in and a future roundhouse alike).
 */
export const ROUTES: Record<RouteId, Record<4 | 5 | 6, PlaceId>> = {
  II: { 4: 'works', 5: 'quarter', 6: 'quarter' },
  III: { 4: 'sidings', 5: 'station', 6: 'station' },
}
/** The walk home is the last of the quarter, at night (both roads). */
export const WALK_PLACE: PlaceId = 'quarter'
/**
 * INV: the only way anything picks a look. The route defaults to 'II' (every call site that
 * predates the Line) and is the ORDER, the road taken at the crossroads: roadOf is applied once, in here
 * (INV-O2), so a caller never passes a road in. areaOf(depth, route) stays for bosses, the hour and the banner.
 * INV-L1: 9-depth, both orders: the road's steps 4/5/6 read ROUTES[road] (Works: works/quarter/quarter; Line:
 *         sidings/station/station, the stand-in and a future roundhouse both in the station kit).
 */
export function lookAt(depth: number, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): PlaceDef {
  const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
  if (d <= 3) return PLACES.ruin
  const road = roadOf(d, route), step = stepOf(d)
  // the roads meet in the square (a 6-depth run only)
  if (RUN_DEPTHS === 6 && road === 'III' && step === 6 && !engineOnLine) return PLACES.quarter
  return PLACES[ROUTES[road][step as 4 | 5 | 6]]
}

/** An area: its depths, and a look for what still asks by area (I the ruin's; II the quarter's, where it ends). */
export interface AreaDef extends Omit<PlaceDef, 'id'> {
  id: AreaId
  depths: readonly number[]
}
const areaI: AreaDef = { ...PLACES.ruin, id: 'I', depths: [1, 2, 3] }
const areaII: AreaDef = { ...PLACES.quarter, id: 'II', depths: [4, 5, 6] }
/** INV: AREAS stays two defs: I the ruin, II the Works; area III is the Line's, reached by road. */
export const AREAS: readonly AreaDef[] = [areaI, areaII]
/** Area III for bosses, the hour and the banner (its hours are area II's: DAY_SPAN is by depth). */
const areaIII: AreaDef = { ...PLACES.station, id: 'III', depths: [4, 5, 6] }
/**
 * INV-A1: AreaDef.id names the ROAD (II the Works, III the Line), not the ordinal; the ordinal is
 * ceil(depth / BOSS_EVERY) (the banner's). `route` is the ORDER (INV-O2): depths 7-9 of a 9-depth run are the other road's.
 */
export const areaOf = (depth: number, route: RouteId = 'II'): AreaDef => {
  const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
  if (d <= 3) return areaI
  return roadOf(d, route) === 'III' ? areaIII : areaII
}

// --- bosses -----------------------------------------------------------------------

export type BossKind = 'assembler' | 'arbiter' | 'engine'
/** INV: every boss is 900 HP, never hits above 22, never winds up under 620 ms. */
export interface BossDef {
  kind: BossKind
  /** Shown on the boss bar. */
  name: string
  /** 900 in each def; bossFor scales it by the depth curve (curve.ts). */
  hp: number
  adds: 'hulks' | 'rams-mites' | 'none'
  /** Its notebook page. */
  roster: RosterId
  /** The Assembler's yard of low walls and crates; the Arbiter's square of brick posts; the Engine's roundhouse (stage C). */
  arena: 'yard' | 'square' | 'roundhouse'
  /** The bar while its ×1.5 window is open. */
  openWord: string
}
/** The Assembler, as it closes area I. */
export const ASSEMBLER_DEF: BossDef = {
  kind: 'assembler', name: 'The Assembler', hp: 900, adds: 'hulks', roster: 'the-first-warden', arena: 'yard', openWord: 'stunned',
}
/** The last fight (design/content/SPEC.md §5): a lamp tower in the quarter's square. */
export const ARBITER_DEF: BossDef = {
  // PLACEHOLDER name (Adrian's)
  kind: 'arbiter', name: 'The Arbiter', hp: 900, adds: 'none', roster: 'the-thermal-arbiter', arena: 'square', openWord: 'venting',
}
/**
 * The Line's last boss (design/area3/SPEC.md §7), from stage C; until then ENGINE_ON_LINE keeps the Line's end
 * the Arbiter in a 6-depth run and the stand-in Assembler (bossFor) in a 9-depth one.
 */
export const ENGINE_DEF: BossDef = {
  // PLACEHOLDER name (Adrian's)
  kind: 'engine', name: 'The Engine', hp: 900, adds: 'none', roster: 'raging-hull', arena: 'roundhouse', openWord: 'derailed',
}
/**
 * The Arbiter is the Works' last boss (6 of a 6-depth run; 6 or 9 of a 9-depth one, by the order). False
 * restores Home's second Assembler there, with rams and mites for adds: the one-evening fallback if the
 * Arbiter doesn't land.
 */
export const ARBITER_AT_6 = true

/**
 * The only place a depth is decided to have a boss. `arbiterAt6` is the switch above
 * (dev checks flip it to test the fallback); the route is third, so C's checks still call
 * bossFor(6, false). The route is the ORDER (INV-O2); the boss of a road's last step is that road's.
 * The Engine ends the Line only with `engineOnLine`; in a 9-depth run without it, the Line ends in a STAND_IN:
 * Home's second Assembler with rams and mites, until stage C.
 * INV-B1: 6-depth: identical to before for every (depth, arbiterAt6, route, engineOnLine), including d 7-9
 *         (a depth past RUN_DEPTHS is never `last`: 9 is an Assembler with hulks).
 * INV-B2: 9-depth: exactly one Arbiter per full run, at the Works' last step; the Line's last step is the Engine
 *         (engine flag) or the stand-in.
 */
export function bossFor(depth: number, arbiterAt6 = ARBITER_AT_6, route: RouteId = 'II', engineOnLine = ENGINE_ON_LINE): BossDef | null {
  if (depth % BOSS_EVERY !== 0) return null
  // its HP by the depth curve, never by what he carries
  const hp = (d: BossDef) => Math.round(d.hp * curveAt(depth, RUN_DEPTHS).bossHp)
  // a road's last boss: 6, and 9 in a 9-depth run
  const last = stepOf(depth) === 6 && depth <= RUN_DEPTHS
  const road = roadOf(depth, route)
  if (last && road === 'III' && engineOnLine) return { ...ENGINE_DEF, hp: hp(ENGINE_DEF) }
  // STAND_IN: the Line's end until stage C
  if (last && road === 'III' && RUN_DEPTHS === 9) return { ...ASSEMBLER_DEF, hp: hp(ASSEMBLER_DEF), adds: 'rams-mites' }
  if (last && arbiterAt6) return { ...ARBITER_DEF, hp: hp(ARBITER_DEF) }
  return { ...ASSEMBLER_DEF, hp: hp(ASSEMBLER_DEF), adds: last ? 'rams-mites' : 'hulks' }
}

// --- the one day -----------------------------------------------------------------------

/** 'mid-afternoon' and 'early-dusk' are the 9-depth day's in-between hours: internal names, never shown. */
export type DayKey = 'morning' | 'late-morning' | 'noon' | 'afternoon' | 'mid-afternoon' | 'late-afternoon'
  | 'early-dusk' | 'dusk' | 'first-dark' | 'night'
/** Multipliers on `grade` (world.ts), plus the colours. morning is today's look, exactly. */
export interface DayPreset {
  /** x grade.saturation / exposure / vignette / fogNear and fogFar. */
  sat: number; exposure: number; vignette: number; fog: number
  fogColor: number; background: number
  /** x today's 1.6 and 1.15. */
  hemi: number; key: number
  keyColor: number; keyDir: [number, number, number]
  /** x grade.graceLight. */
  grace: number
  /**
   * The cold fill's sky colour. As the fill dims and Grace holds, the frame would tip
   * warm; the fill turns bluer instead, so the late hours read colder, never warmer.
   */
  hemiSky?: number
  /** x grade.bloomThreshold (default 1): the embers bloom more as the light goes. */
  bloom?: number
  /** A cold rim on the kit's vertical faces, 0..1 (default 0): cover stays a silhouette in the dark. */
  rim?: number
}
/** The fill's sky colour as world.ts builds it: morning's. */
export const BASE_HEMI_SKY = 0x53749c

/** The run's fill and key, as world.ts builds them; the presets scale these. */
export const BASE_HEMI = 1.6
export const BASE_KEY = 1.15

/**
 * §6.1. No hour has a warm key light: dusk is blue-violet, not orange. Grace is held
 * constant at every hour (the §6.1 column rose to 1.25 at night): the world darkens
 * round her, she doesn't brighten.
 */
const HOURS = {
  morning: { sat: 1.0, exposure: 1.0, vignette: 1.0, fog: 1.0, fogColor: 0x0b1018, background: 0x070a0e, hemi: 1.0, key: 1.0, keyColor: 0x8fb0da, keyDir: [-8, 14, -6], grace: 1 },
  'late-morning': { sat: 1.02, exposure: 1.02, vignette: 1.0, fog: 1.05, fogColor: 0x0c121a, background: 0x070a0e, hemi: 1.0, key: 1.08, keyColor: 0x9ab8de, keyDir: [-6, 15, -5], grace: 1 },
  noon: { sat: 1.04, exposure: 1.04, vignette: 0.95, fog: 1.1, fogColor: 0x0d131b, background: 0x080b10, hemi: 1.05, key: 1.15, keyColor: 0xa8c0e2, keyDir: [-3, 16, -3], grace: 1 },
  afternoon: { sat: 0.96, exposure: 0.96, vignette: 1.0, fog: 0.95, fogColor: 0x0c1017, background: 0x070a0e, hemi: 1.0, key: 1.0, keyColor: 0x98aad2, keyDir: [-10, 11, 2], grace: 1, hemiSky: 0x486cb8 },
  'late-afternoon': { sat: 0.9, exposure: 0.9, vignette: 1.05, fog: 0.88, fogColor: 0x0b0e17, background: 0x06090f, hemi: 1.05, key: 0.95, keyColor: 0x8e9ac4, keyDir: [-12, 8, 5], grace: 1, hemiSky: 0x4868b8, bloom: 0.94 },
  dusk: { sat: 0.82, exposure: 0.82, vignette: 1.12, fog: 0.8, fogColor: 0x090c17, background: 0x05070e, hemi: 1.1, key: 0.9, keyColor: 0x7486d2, keyDir: [-13, 5, 8], grace: 1, hemiSky: 0x3a54cc, bloom: 0.89, rim: 0.12 },
  /**
   * The Arbiter at 0 HP: the last of dusk, where lights out stops (it never reaches night in a
   * level). Darker than §4.6's ratios on Home's dusk, so the kill lands at a real first dark:
   * the fill and key most of the way down, and a colder rim on the walls to keep them read.
   * Grace x exposure is held at dusk's, so she's the one steady light while everything else goes.
   */
  'first-dark': { sat: 0.68, exposure: 0.66, vignette: 1.26, fog: 0.7, fogColor: 0x05080f, background: 0x030409, hemi: 0.58, key: 0.28, keyColor: 0x6474c4, keyDir: [-13, 3, 9], grace: 0.82 / 0.66, hemiSky: 0x3040bc, bloom: 0.86, rim: 0.35 },
  night: { sat: 0.7, exposure: 0.72, vignette: 1.25, fog: 0.7, fogColor: 0x05070d, background: 0x030409, hemi: 1.0, key: 0.55, keyColor: 0x6c7cc4, keyDir: [-6, 12, -10], grace: 1, hemiSky: 0x3448bc, bloom: 0.86, rim: 0.3 },
  // the room: its key light, its colour and Grace's lamp come by the hour (WINDOW)
  workshop: { sat: 1.18, exposure: 1.0, vignette: 0.55, fog: 2.0, fogColor: 0x0b0f16, background: 0x070a0e, hemi: 0.6, key: 1, keyColor: 0x98a8c4, keyDir: [-14, 9, 2], grace: 1.2 },
} satisfies Record<Exclude<DayKey, 'mid-afternoon' | 'early-dusk'> | 'workshop', DayPreset>
/**
 * The hours by key. The two in-between hours are the midpoints of their neighbours (mixPreset is hoisted, and
 * BASE_HEMI_SKY above is set before this runs): the 9-depth day has three more spans than the 6-depth one
 * and no hour to spare between afternoon and dusk.
 */
export const DAY: Record<DayKey | 'workshop', DayPreset> = {
  ...HOURS,
  'mid-afternoon': mixPreset(HOURS.afternoon, HOURS['late-afternoon'], 0.5),
  'early-dusk': mixPreset(HOURS['late-afternoon'], HOURS.dusk, 0.5),
}
export const DEPTH_DAY: Record<number, DayKey> = { 1: 'morning', 2: 'late-morning', 3: 'noon', 4: 'afternoon', 5: 'late-afternoon', 6: 'dusk' }

/**
 * Through the Workshop's window, by the hour (§5.3): the sky, the cold key and its
 * colour, and the lamp. Daylight is always cold; warm is only for Grace, and she
 * is held at one brightness here too. The day's key is stronger than §5.3's in the
 * morning and at noon so the hour shows on the room (the afternoon is as approved);
 * at night the lamp is nearly alone.
 */
export const WINDOW: Record<HomeHour, { sky: number; key: number; keyColor: number; grace: number }> = {
  morning: { sky: 0x9fb3cc, key: 0.75, keyColor: 0x9fb8dc, grace: 1 },
  noon: { sky: 0xc4d2e2, key: 0.9, keyColor: 0xb8c8e0, grace: 1 },
  afternoon: { sky: 0x93a3ba, key: 0.4, keyColor: 0x98a8c4, grace: 1 },
  dusk: { sky: 0x4a5670, key: 0.22, keyColor: 0x7c86a6, grace: 1 },
  night: { sky: 0x121826, key: 0.05, keyColor: 0x6c7c9e, grace: 1 },
}

/** Grace's reach: the room's lamp stops at its barriers; in the maze she carries further. */
export const GRACE_REACH = { run: 34, room: 16 }

export interface DaySpan { from: DayKey; to: DayKey; by: 'rooms' | 'boss' | 'hold' }
/**
 * The day through each depth (§7): a span from one hour to the next. Inside an area each
 * span's `to` is the next depth's `from`, so the fades join up; nothing in a level reaches
 * night. By 'rooms' the day follows the spine rooms he's reached; 'boss' follows the last
 * boss's HP (lights out, capped at first dark); 'hold' keeps it (noon, the Assembler).
 * A 6-depth run's day is this table, unchanged.
 */
const DAY_SPAN_6: Record<number, DaySpan> = {
  1: { from: 'morning', to: 'late-morning', by: 'rooms' },
  2: { from: 'late-morning', to: 'noon', by: 'rooms' },
  3: { from: 'noon', to: 'noon', by: 'hold' },
  4: { from: 'afternoon', to: 'late-afternoon', by: 'rooms' },
  5: { from: 'late-afternoon', to: 'dusk', by: 'rooms' },
  6: { from: 'dusk', to: 'first-dark', by: 'boss' },
}
/**
 * A 9-depth run's day (design/area3/BOTH-ROADS.md §1): the ruin is the morning to noon, each road's first
 * two depths are a third of the afternoon apiece, and the middle boss holds the light at late afternoon (the
 * square keeps its own light there). 7-8 carry it into dusk, and the last boss takes it to first dark by its
 * HP.
 * INV-D1: a row for every depth 1..RUN_DEPTHS.
 * INV-D2: exactly one row is by 'boss', at RUN_DEPTHS.
 * INV-D3: span[d].to === span[d+1].from for every d in 1..RUN_DEPTHS-1 except d = 3 (the crossroads is the
 *         afternoon, no span).
 */
const DAY_SPAN_9: Record<number, DaySpan> = {
  1: { from: 'morning', to: 'late-morning', by: 'rooms' },
  2: { from: 'late-morning', to: 'noon', by: 'rooms' },
  3: { from: 'noon', to: 'noon', by: 'hold' },
  4: { from: 'afternoon', to: 'mid-afternoon', by: 'rooms' },
  5: { from: 'mid-afternoon', to: 'late-afternoon', by: 'rooms' },
  6: { from: 'late-afternoon', to: 'late-afternoon', by: 'hold' },
  7: { from: 'late-afternoon', to: 'early-dusk', by: 'rooms' },
  8: { from: 'early-dusk', to: 'dusk', by: 'rooms' },
  9: { from: 'dusk', to: 'first-dark', by: 'boss' },
}
export const DAY_SPAN: Record<number, DaySpan> = RUN_DEPTHS === 9 ? DAY_SPAN_9 : DAY_SPAN_6
const spanOf = (depth: number) => DAY_SPAN[Math.max(1, Math.min(RUN_DEPTHS, depth))]!

/** The square's fog is held back past its far corner: the camera is ~40 u off, the corner ~16 u deeper. */
export const SQUARE_FOG_FAR = 58

/** The rim and the bloom, as the hour asks; kit.ts and world.ts read these. */
export const DAY_FX = { rim: 0, bloom: 1 }

/**
 * What's applied now: reapplyDay puts it back after the grade panel moves the base. `depth`
 * and `progress` when a depth's span is on (the key is its `from`, for the checks).
 */
let current: { key: DayKey | 'workshop'; hour: HomeHour; depth?: number; progress?: number } = { key: 'morning', hour: 'afternoon' }

/** The preset as it stands at an hour: the room's key, colour and lamp come from its window. */
export function presetOf(key: DayKey | 'workshop', hour: HomeHour = 'afternoon'): DayPreset {
  const d = DAY[key]
  if (key !== 'workshop') return d
  const w = WINDOW[hour]
  return { ...d, key: w.key, keyColor: w.keyColor, grace: d.grace * w.grace }
}

/** Set the world to a preset, over the tuned grade. */
export function applyPreset(world: World, d: DayPreset, room = false) {
  const u = world.gradePass.uniforms
  u.uSaturation!.value = grade.saturation * d.sat
  u.uVignette!.value = grade.vignette * d.vignette
  world.renderer.toneMappingExposure = grade.exposure * d.exposure
  const fog = fogAt(d.fog, room)
  world.fog.near = fog.near
  world.fog.far = fog.far
  world.fog.color.setHex(d.fogColor)
  ;(world.scene.background as THREE.Color).setHex(d.background)
  world.hemi.intensity = BASE_HEMI * d.hemi
  world.hemi.color.setHex(d.hemiSky ?? BASE_HEMI_SKY)
  world.key.intensity = BASE_KEY * d.key
  world.key.color.setHex(d.keyColor)
  world.key.position.set(...d.keyDir)
  world.graceLight.intensity = grade.graceLight * d.grace
  world.graceLight.distance = room ? GRACE_REACH.room : GRACE_REACH.run
  world.bloom.threshold = grade.bloomThreshold * (d.bloom ?? 1)
  DAY_FX.rim = d.rim ?? 0
  DAY_FX.bloom = d.bloom ?? 1
  RIM.uRim.value = DAY_FX.rim
}

/**
 * The fog an hour asks for. The camera is FOCUS_DEPTH (about 51 u) from Still and fog
 * is measured from the lens, so multiplying the distances as-is would fog him out by
 * dusk and black him out at night. Instead his own depth keeps morning's fog, and the
 * multiplier scales how fast the world beyond him fades: denser as the light goes.
 * Morning (1) is today's fog, exactly. The room, where it's effectively none, multiplies plainly.
 */
export function fogAt(mult: number, room = false): { near: number; far: number } {
  if (room) return { near: grade.fogNear * mult, far: grade.fogFar * mult }
  const span0 = grade.fogFar - grade.fogNear
  const atStill = (FOCUS_DEPTH - grade.fogNear) / span0
  const span = span0 * mult
  const near = FOCUS_DEPTH - atStill * span
  return { near, far: near + span }
}

/** The hour now: a depth's, the walk home's, or the room's with its window. */
export function applyDay(world: World, key: DayKey | 'workshop', hour: HomeHour = 'afternoon') {
  current = { key, hour }
  applyPreset(world, presetOf(key, hour), key === 'workshop')
}

/**
 * A depth's hour at `p` through its span (§7): the Home hours plus bloom, rim and, in the
 * square, the fog held beyond the arena so it darkens without closing in.
 */
export function applyDayAt(world: World, depth: number, p: number) {
  const k = Math.max(0, Math.min(1, p))
  current = { key: spanOf(depth).from, hour: 'afternoon', depth, progress: k }
  applyPreset(world, dayAt(depth, k))
  // the square keeps its far corner in the dark, and at 6 of a 9-depth run, where it's held at late afternoon
  if (spanOf(depth).by === 'boss' || (RUN_DEPTHS === 9 && depth === 6)) world.fog.far = Math.max(world.fog.far, SQUARE_FOG_FAR)
}

/** After the grade panel moves the base: the hour goes back on top. */
export function reapplyDay(world: World) {
  if (current.depth !== undefined) applyDayAt(world, current.depth, current.progress ?? 0)
  else applyDay(world, current.key, current.hour)
}

/** Which hour is on, for checks and the room's arrival. */
export const dayNow = () => current

/** The preset on now, lights out included. */
const presetNow = () => (current.depth !== undefined ? dayAt(current.depth, current.progress ?? 0) : presetOf(current.key, current.hour))
/** Saturation the hour asks for: Stopped drains colour from this, not from the base. */
export const currentSat = () => grade.saturation * presetNow().sat
/** Grace's intensity at this hour (constant, by design; held against the exposure as the square goes dark). */
export const currentGrace = () => grade.graceLight * presetNow().grace

/** A depth's hour at `progress01` through its span (DAY_SPAN): 0 is its own hour, as Home had it. */
export function dayAt(depth: number, progress01: number): DayPreset {
  const sp = spanOf(depth)
  return mixPreset(DAY[sp.from], DAY[sp.to], progress01)
}

/** Two presets mixed by k (colours in linear RGB). */
export function mixPreset(a: DayPreset, b: DayPreset, k01: number): DayPreset {
  const k = Math.max(0, Math.min(1, k01))
  const m = (x: number, y: number) => x + (y - x) * k
  const c = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k).getHex()
  return {
    sat: m(a.sat, b.sat), exposure: m(a.exposure, b.exposure), vignette: m(a.vignette, b.vignette), fog: m(a.fog, b.fog),
    fogColor: c(a.fogColor, b.fogColor), background: c(a.background, b.background), hemi: m(a.hemi, b.hemi), key: m(a.key, b.key),
    keyColor: c(a.keyColor, b.keyColor), keyDir: [m(a.keyDir[0], b.keyDir[0]), m(a.keyDir[1], b.keyDir[1]), m(a.keyDir[2], b.keyDir[2])], grace: m(a.grace, b.grace),
    hemiSky: c(a.hemiSky ?? BASE_HEMI_SKY, b.hemiSky ?? BASE_HEMI_SKY),
    bloom: m(a.bloom ?? 1, b.bloom ?? 1), rim: m(a.rim ?? 0, b.rim ?? 0),
  }
}
