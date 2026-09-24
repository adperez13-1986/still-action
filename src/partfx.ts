import type * as THREE from 'three'
import type { PartEvent } from './parts'

/**
 * Persistent part visuals, drawn by reading state: shells, the decoy, the anchor
 * and its tether, mark badges, zones, breach rims, lob globs, previews. Moments
 * arrive through `event`; anything that lasts is polled in `update`, so nothing
 * leaks across levels as long as `clear` runs where `combat.reset()` does.
 *
 * Empty until a part that leaves something in the world is built.
 */
export class PartFx {
  /** Where its meshes go, once it has some. */
  constructor(readonly scene: THREE.Scene) {}

  /** One instant from Combat's onPart. */
  event(_ev: PartEvent) {}

  update(_dt: number) {}

  /** A new level or a new run: everything drawn goes. */
  clear() {}
}
