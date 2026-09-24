import type * as THREE from 'three'
import type { SlotName } from './still'
import type { AbilityDef, BeatKey } from './abilities'
import type { Enemy } from './enemy'

/**
 * What parts leave out in the world, and the engine numbers that aren't any one
 * part's own. A part's own numbers live on its def in PARTS; these are the glue.
 * The 1.5 s history ring and the bank-shot solver join this file with the parts
 * that need them (Borrowed Time, Ricochet Lens).
 */

/** Engine constants: not any one part's number. */
export const PART = {
  /** lineClear pad for melee and blasts, the same test chasers use. */
  linePad: 0.2,
  /** Pressure Vent's shove: max(novaShoveMin, def.shove − novaShoveFalloff × d). */
  novaShoveMin: 2.4,
  novaShoveFalloff: 0.35,
  boltSpeed: 26,
  /** Through-Line: the whole 16 u in about 0.2 s. */
  ghostSpeed: 80,
  /** Bounce bolts move in substeps no longer than this, so the reflection point matches the bank solver. */
  bounceSubstep: 0.2,
  /** A lob with no target lands this far ahead. */
  lobNoTarget: 6,
  /** Visual peaks (N12). */
  lobPeak: 3.2,
  throwPeak: 1.5,
  /** A zone keeps an enemy slowed this long after it steps off. */
  zoneLinger: 0.25,
  /** The sentinel keeps its answer this long, waiting for its reload. */
  answerSeconds: 4,
  /** A throw carries the enemy with the clamp for this long before the lob. */
  throwLead: 0.05,
  /** History capacity in samples; 1.5 s at 60 Hz is 90, the slack covers the Stopped slowdown. */
  historyCap: 160,
}

/** What a part has out in the world. One instance, owned by Combat, cleared in reset(). */
export interface PartRuntime {
  /** Torso window. At most one, because Ward, Mirror Ward and Brace share the slot. */
  guard: {
    kind: 'ward' | 'mirror' | 'brace'
    t: number; max: number            // seconds left / total
    radius: number                    // ward/mirror shell
    reflectsLeft: number; reflectDamage: number   // mirror
    perStrain: number                 // brace
  } | null
  /** Arms window: Anvil. Closes on the first catch. */
  anvil: { t: number; max: number; def: AbilityDef } | null
  /** Torso: the Lure decoy. At most one. */
  decoy: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef } | null
  /** Legs: the Plumb Line anchor. While it lives, the legs button is tappable (cooldown 'hold'). */
  anchor: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef } | null
  /** Head: seconds since the last Patient Lens cast. Set to mod.minS on swap-in and on reset. */
  patientSince: number
}

/** Per-enemy status. Map<Enemy, EnemyStatus> in Combat; deleted when the enemy is buried. */
export interface EnemyStatus {
  markT: number      // seconds left, 0 = unmarked
  slowT: number      // seconds left, 0 = not slowed
  /** The factor applied to speedMul while slowT > 0. Divided back out on expiry: never set speedMul to 1. */
  slowMul: number
}

/** A floor strip (Frost Trail). Never shoves. */
export interface Zone { ax: number; az: number; bx: number; bz: number; halfW: number; t: number; max: number; mul: number }

/** An enemy in the clamp's throw. While held, it doesn't think. */
export interface Held { from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; short: boolean; def: AbilityDef }

export type Flip = 'x' | 'z' | 'xz'

/** How Still moves when a part moves him. Main hands it to Still. */
export interface StillMove {
  kind: 'dash' | 'hop' | 'snap' | 'rewind'
  /** Waypoints after the start, in order. A dash has one; a rewind has the recorded path. */
  path: THREE.Vector3[]
  ms: number
  /** Crosses a solid: main skips pushOut until landing. */
  vault: boolean
  /** Stick lock after landing (a vault only). */
  lockMs: number
}

export interface BreachHole {
  id: number
  kind: 'wall' | 'prop' | 'void'
  /** Wall: the box. Prop: centre and radius. Void: the cell's centre, size CELL. */
  minX: number; maxX: number; minZ: number; maxZ: number
}

/** Something happened this instant. Lasting things are polled, not evented. */
export type PartEvent =
  | { kind: 'move'; move: StillMove; beat: BeatKey }
  | { kind: 'strain'; amount: number; at: THREE.Vector3 }             // a Brace conversion
  | { kind: 'interrupt'; enemy: Enemy }                                // a windup broken (Parry, a grab)
  | { kind: 'mark'; enemy: Enemy; state: 'on' | 'consumed' | 'expired' }
  | { kind: 'slow'; enemy: Enemy; state: 'on' | 'off' }
  | { kind: 'lob'; from: THREE.Vector3; to: THREE.Vector3; ms: number; radius: number; signal: boolean }
  | { kind: 'land'; at: THREE.Vector3; radius: number; what: 'flare' | 'signal' | 'throw' | 'wall' }
  | { kind: 'throw'; enemy: Enemy; to: THREE.Vector3; ms: number; short: boolean }
  | { kind: 'path'; points: THREE.Vector3[] }                          // Ricochet's cast-time path flash
  | { kind: 'bounce'; at: THREE.Vector3; side: 'still' | 'enemy'; n: number }
  | { kind: 'pierce'; at: THREE.Vector3; n: number }                   // Cracked: one per enemy passed, n counts up
  | { kind: 'breach'; holes: BreachHole[]; open: boolean }
  | { kind: 'shield'; at: THREE.Vector3; reflected: boolean }          // a shot destroyed or turned by the shell
  | { kind: 'catch'; at: THREE.Vector3 }                               // Anvil
  | { kind: 'decoy'; state: 'spawn' | 'burst' | 'gone'; at: THREE.Vector3 }
  | { kind: 'anchor'; state: 'plant' | 'snap' | 'fade' | 'denied'; at: THREE.Vector3 }
  | { kind: 'windowEnd'; slot: SlotName; used: boolean }               // G8 end tick
  | { kind: 'cooldownStart'; slot: SlotName }                          // the anchor faded: start the HUD cooldown now
