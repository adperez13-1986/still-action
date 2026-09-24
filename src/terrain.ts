/**
 * What's solid. Everything that moves or flies asks this instead of knowing the
 * shape of the level: Still, enemies, bolts, shots, dashes, drops.
 */
export interface Terrain {
  /** Push a circle out of anything solid. */
  pushOut(pos: { x: number; z: number }, radius: number): void
  /** Is this point inside something solid (grown by `pad`)? */
  blocked(x: number, z: number, pad?: number): boolean
  /** Nothing solid on the straight line between two points. */
  lineClear(ax: number, az: number, bx: number, bz: number, pad?: number): boolean
  /** How far a circle can travel from a toward b before it hits something. */
  clampMove(ax: number, az: number, bx: number, bz: number, radius: number): { x: number; z: number }
  /**
   * Where to walk next to get from a to b: b itself when the way is clear,
   * otherwise the centre of the next cell on the shortest route around the walls.
   */
  nextStep(ax: number, az: number, bx: number, bz: number, radius: number): { x: number; z: number }
}
