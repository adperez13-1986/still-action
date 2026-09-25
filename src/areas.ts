/**
 * The run's shape: how deep it goes, where the Assemblers stand, and which
 * beams open when one falls. A run is two areas of three depths, one day long,
 * and it ends in one of three ways (design/meta/SPEC.md §2.1).
 *
 * The rest of §2.1 (AreaDef, bossFor, the day presets, the hour) arrives with
 * the one-day step; this is the part the warm beam needs.
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
