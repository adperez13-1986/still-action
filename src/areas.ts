import * as THREE from 'three'
import type { Piece } from './kit'
import { grade, FOCUS_DEPTH, type World } from './world'

/**
 * The run's shape: how deep it goes, where the Assemblers stand, which beams open
 * when one falls, what each area is built from, and the hour at every depth. A
 * run is two areas of three depths and one day long, from morning to a night walk
 * home, and it ends in one of three ways (design/meta/SPEC.md §2.1, §6).
 */

/** One constant: a 9-depth run is this changing to 9, not a redesign. */
export const RUN_DEPTHS = 6
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
 * §4.13. Broken or Stopped: whatever hour it happened. Home before the last
 * depth is the afternoon, the kids awake; home from the last depth is night,
 * the kids asleep. Going home early is a different homecoming, not a lesser one.
 */
export function hourAtEnd(kind: 'broken' | 'stopped' | 'home', depth: number): HomeHour {
  if (kind === 'home') return depth >= RUN_DEPTHS ? 'night' : 'afternoon'
  if (depth <= 2) return 'morning'
  if (depth === 3) return 'noon'
  if (depth <= 5) return 'afternoon'
  return 'dusk'
}

// --- areas --------------------------------------------------------------------------

export type AreaId = 'I' | 'II'
export type SurfaceRole = 'paving' | 'rock' | 'wood' | 'ground'
export type FootSurface = 'stone' | 'wood' | 'plate'
/** The content step adds 'works' | 'quarter'. */
export type AmbienceMood = 'crawl' | 'boss' | 'workshop'

/** What an area builds with. Area II starts as a copy of I; the content step replaces it. */
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
export interface AreaDef {
  id: AreaId
  depths: readonly number[]
  kit: KitPreset
  /** Which ambientCG set skins each role. */
  surfaces: Record<SurfaceRole, string>
  ambience: { crawl: AmbienceMood; boss: AmbienceMood }
  footsteps: FootSurface
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
const RUIN_SURFACES: Record<SurfaceRole, string> = { paving: 'PavingStones142', rock: 'Rock035', wood: 'Planks023A', ground: 'Ground108' }

const areaI: AreaDef = { id: 'I', depths: [1, 2, 3], kit: RUIN_KIT, surfaces: RUIN_SURFACES, ambience: { crawl: 'crawl', boss: 'boss' }, footsteps: 'stone' }
/** INV (for now): deep-equal to area I except its id and depths. The content step gives it its own. */
const areaII: AreaDef = { ...structuredClone(areaI), id: 'II', depths: [4, 5, 6] }
export const AREAS: readonly AreaDef[] = [areaI, areaII]
export const areaOf = (depth: number): AreaDef =>
  AREAS[Math.min(AREAS.length, Math.ceil(Math.max(1, Math.min(depth, RUN_DEPTHS)) / BOSS_EVERY)) - 1]!
/** The walk home is built with area II's kit, at night. */
export const WALK_AREA: AreaId = 'II'

// --- bosses -----------------------------------------------------------------------

/** INV: bosses stay 900 HP. The content step adds kind 'arbiter' and swaps depth 6. */
export interface BossDef {
  kind: 'assembler'
  /** Shown on the boss bar. */
  name: string
  hp: 900
  adds: 'hulks' | 'rams-mites'
  /** Its notebook page. */
  roster: string
}
/** The only place a depth is decided to have a boss. The second Assembler's adds are rams and mites (the last step). */
export function bossFor(depth: number): BossDef | null {
  if (depth % BOSS_EVERY !== 0) return null
  return { kind: 'assembler', name: 'The Assembler', hp: 900, adds: depth === RUN_DEPTHS ? 'rams-mites' : 'hulks', roster: 'the-first-warden' }
}

// --- the one day -----------------------------------------------------------------------

export type DayKey = 'morning' | 'late-morning' | 'noon' | 'afternoon' | 'late-afternoon' | 'dusk' | 'night'
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
export const DAY: Record<DayKey | 'workshop', DayPreset> = {
  morning: { sat: 1.0, exposure: 1.0, vignette: 1.0, fog: 1.0, fogColor: 0x0b1018, background: 0x070a0e, hemi: 1.0, key: 1.0, keyColor: 0x8fb0da, keyDir: [-8, 14, -6], grace: 1 },
  'late-morning': { sat: 1.02, exposure: 1.02, vignette: 1.0, fog: 1.05, fogColor: 0x0c121a, background: 0x070a0e, hemi: 1.0, key: 1.08, keyColor: 0x9ab8de, keyDir: [-6, 15, -5], grace: 1 },
  noon: { sat: 1.04, exposure: 1.04, vignette: 0.95, fog: 1.1, fogColor: 0x0d131b, background: 0x080b10, hemi: 1.05, key: 1.15, keyColor: 0xa8c0e2, keyDir: [-3, 16, -3], grace: 1 },
  afternoon: { sat: 0.96, exposure: 0.96, vignette: 1.0, fog: 0.95, fogColor: 0x0c1017, background: 0x070a0e, hemi: 1.0, key: 1.0, keyColor: 0x98aad2, keyDir: [-10, 11, 2], grace: 1, hemiSky: 0x486cb8 },
  'late-afternoon': { sat: 0.9, exposure: 0.9, vignette: 1.05, fog: 0.88, fogColor: 0x0b0e17, background: 0x06090f, hemi: 1.05, key: 0.95, keyColor: 0x8e9ac4, keyDir: [-12, 8, 5], grace: 1, hemiSky: 0x4868b8 },
  dusk: { sat: 0.82, exposure: 0.82, vignette: 1.12, fog: 0.8, fogColor: 0x090c17, background: 0x05070e, hemi: 1.1, key: 0.9, keyColor: 0x7486d2, keyDir: [-13, 5, 8], grace: 1, hemiSky: 0x3a54cc },
  night: { sat: 0.7, exposure: 0.72, vignette: 1.25, fog: 0.7, fogColor: 0x05070d, background: 0x030409, hemi: 1.0, key: 0.55, keyColor: 0x6c7cc4, keyDir: [-6, 12, -10], grace: 1, hemiSky: 0x3448bc },
  // the room: its key light, its colour and Grace's lamp come by the hour (WINDOW)
  workshop: { sat: 1.18, exposure: 1.0, vignette: 0.55, fog: 2.0, fogColor: 0x0b0f16, background: 0x070a0e, hemi: 0.6, key: 1, keyColor: 0x98a8c4, keyDir: [-14, 9, 2], grace: 1.2 },
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

/** What's applied now: reapplyDay puts it back after the grade panel moves the base. */
let current: { key: DayKey | 'workshop'; hour: HomeHour } = { key: 'morning', hour: 'afternoon' }

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

/** After the grade panel moves the base: the hour goes back on top. */
export function reapplyDay(world: World) {
  applyDay(world, current.key, current.hour)
}

/** Which hour is on, for checks and the room's arrival. */
export const dayNow = () => current

/** Saturation the hour asks for: Stopped drains colour from this, not from the base. */
export const currentSat = () => grade.saturation * presetOf(current.key, current.hour).sat
/** Grace's intensity at this hour (constant, by design). */
export const currentGrace = () => grade.graceLight * presetOf(current.key, current.hour).grace

/**
 * Seam for the content step's "day moves with you": a depth's preset leaned toward
 * the next depth's by `progress01`. The Home build always passes 0.
 */
export function dayAt(depth: number, progress01: number): DayPreset {
  const a = DAY[DEPTH_DAY[Math.max(1, Math.min(RUN_DEPTHS, depth))]!]
  const b = DAY[DEPTH_DAY[Math.min(RUN_DEPTHS, depth + 1)]!]
  const k = Math.max(0, Math.min(1, progress01))
  const m = (x: number, y: number) => x + (y - x) * k
  const c = (x: number, y: number) => new THREE.Color(x).lerp(new THREE.Color(y), k).getHex()
  return {
    sat: m(a.sat, b.sat), exposure: m(a.exposure, b.exposure), vignette: m(a.vignette, b.vignette), fog: m(a.fog, b.fog),
    fogColor: c(a.fogColor, b.fogColor), background: c(a.background, b.background), hemi: m(a.hemi, b.hemi), key: m(a.key, b.key),
    keyColor: c(a.keyColor, b.keyColor), keyDir: [m(a.keyDir[0], b.keyDir[0]), m(a.keyDir[1], b.keyDir[1]), m(a.keyDir[2], b.keyDir[2])], grace: m(a.grace, b.grace),
    hemiSky: c(a.hemiSky ?? BASE_HEMI_SKY, b.hemiSky ?? BASE_HEMI_SKY),
  }
}
