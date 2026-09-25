import type { BreachHole } from './parts'

/** One flat face of a wall piece, for bank shots: which axis it faces along, where, and how far it runs. */
export interface WallFace {
  /** 'x': the face is a plane of constant x (it faces along x). 'z' likewise. */
  axis: 'x' | 'z'
  at: number
  /** Which way the face looks: its open side. */
  normal: 1 | -1
  /** The face's extent along the other axis. */
  from: number
  to: number
}

/**
 * What's solid. Everything that moves or flies asks this instead of knowing the
 * shape of the level: Still, enemies, bolts, shots, dashes, drops.
 *
 * `see` is sight and projectiles only. A breach (Through-Line) opens a wall to
 * `see` queries for a few seconds, both ways. Movement and pathing never pass
 * `see`, so no body ever walks, dashes or is thrown through a breach.
 */
export interface Terrain {
  /** Push a circle out of anything solid. */
  pushOut(pos: { x: number; z: number }, radius: number): void
  /** Is this point inside something solid (grown by `pad`)? */
  blocked(x: number, z: number, pad?: number, see?: boolean): boolean
  /** Nothing solid on the straight line between two points. */
  lineClear(ax: number, az: number, bx: number, bz: number, pad?: number, see?: boolean): boolean
  /** What this point is inside: a wall (a barrier, or off the floor), a prop (a column, a crate), or nothing. */
  blocker(x: number, z: number, pad: number, see: boolean): 'wall' | 'prop' | null
  /** How far a circle can travel from a toward b before it hits something. */
  clampMove(ax: number, az: number, bx: number, bz: number, radius: number): { x: number; z: number }
  /**
   * Where to walk next to get from a to b: b itself when the way is clear,
   * otherwise the centre of the next cell on the shortest route around the walls.
   */
  nextStep(ax: number, az: number, bx: number, bz: number, radius: number): { x: number; z: number }
  /** Every solid piece and void cell the segment crosses stops blocking sight and projectiles for `seconds`. Returns the new holes. */
  breach(ax: number, az: number, bx: number, bz: number, seconds: number): BreachHole[]
  /** Advance breaches. Returns the holes that closed this tick. */
  tickBreaches(dt: number): BreachHole[]
  /** The faces of every unbreached wall piece within `r` of a point. Props are round and have none. */
  faces(x: number, z: number, r: number): WallFace[]
}
