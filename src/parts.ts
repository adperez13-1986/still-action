import * as THREE from 'three'
import type { SlotName } from './still'
import type { Terrain } from './terrain'
import type { AbilityDef, BeatKey } from './abilities'
import type { Enemy } from './enemy'

/**
 * What parts leave out in the world, and the engine numbers that aren't any one
 * part's own. A part's own numbers live on its def in PARTS; these are the glue.
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
    /** It met something (a shot destroyed or turned, a hit converted): the end tick says so. */
    used: boolean
  } | null
  /** Arms window: Anvil. Closes on the first catch. */
  anvil: { t: number; max: number; def: AbilityDef } | null
  /** Torso: the Lure decoy. At most one. */
  /** `pushed`: its cast was a push, so its burst is a pushed hit (the break rule). */
  decoy: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef; pushed: boolean } | null
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
export interface Held { from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; short: boolean; def: AbilityDef; pushed: boolean }

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

/** 1.5 s of where Still stood and what he lost. A fixed ring, no allocation per tick. */
export class History {
  private readonly x = new Float32Array(PART.historyCap)
  private readonly z = new Float32Array(PART.historyCap)
  private readonly dmg = new Float32Array(PART.historyCap)
  private readonly dt = new Float32Array(PART.historyCap)
  private head = 0
  private n = 0

  push(x: number, z: number, dmg: number, dt: number) {
    this.x[this.head] = x
    this.z[this.head] = z
    this.dmg[this.head] = dmg
    this.dt[this.head] = dt
    this.head = (this.head + 1) % PART.historyCap
    this.n = Math.min(this.n + 1, PART.historyCap)
  }

  /**
   * Newest → oldest samples covering `seconds` of game time (or everything held).
   * `points` is the rewind path in travel order; `damage` is the HP lost in it; `slots` are the ring indices.
   */
  window(seconds: number): { points: THREE.Vector3[]; damage: number; slots: number[] } {
    const points: THREE.Vector3[] = []
    const slots: number[] = []
    let damage = 0
    let t = 0
    for (let k = 0; k < this.n && t < seconds; k++) {
      const i = (this.head - 1 - k + PART.historyCap) % PART.historyCap
      points.push(new THREE.Vector3(this.x[i], 0, this.z[i]))
      slots.push(i)
      damage += this.dmg[i]!
      t += this.dt[i]!
    }
    return { points, damage, slots }
  }

  /** The sample `seconds` ago (Borrowed Time's afterimage), or null if the ring is empty. */
  at(seconds: number): THREE.Vector3 | null {
    const w = this.window(seconds).points
    return w[w.length - 1] ?? null
  }

  /** HP lost in the last `seconds` (the N10 pale segment). */
  recentDamage(seconds: number): number {
    let damage = 0
    let t = 0
    for (let k = 0; k < this.n && t < seconds; k++) {
      const i = (this.head - 1 - k + PART.historyCap) % PART.historyCap
      damage += this.dmg[i]!
      t += this.dt[i]!
    }
    return damage
  }

  /** A rewind gave this damage back: it can never come back twice. */
  zero(slots: number[]) {
    for (const s of slots) this.dmg[s] = 0
  }

  clear() {
    this.head = 0
    this.n = 0
  }
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
  /** A windup broken (Parry, a grab, a push). `push`: a pushed hit broke it under the break rule, and it reels. */
  | { kind: 'interrupt'; enemy: Enemy; push?: boolean }
  | { kind: 'mark'; enemy: Enemy; state: 'on' | 'consumed' | 'expired' }
  | { kind: 'slow'; enemy: Enemy; state: 'on' | 'off' }
  | { kind: 'lob'; from: THREE.Vector3; to: THREE.Vector3; ms: number; radius: number; signal: boolean }
  | { kind: 'land'; at: THREE.Vector3; radius: number; what: 'flare' | 'signal' | 'throw' | 'wall'; enemy?: Enemy }
  | { kind: 'throw'; enemy: Enemy; to: THREE.Vector3; ms: number; short: boolean }
  | { kind: 'path'; points: THREE.Vector3[] }                          // Ricochet's cast-time path flash
  | { kind: 'bounce'; at: THREE.Vector3; side: 'still' | 'enemy'; n: number }
  | { kind: 'pierce'; at: THREE.Vector3; n: number }                   // Cracked: one per enemy passed, n counts up
  | { kind: 'breach'; holes: BreachHole[]; open: boolean; seconds?: number }
  | { kind: 'shield'; at: THREE.Vector3; reflected: boolean }          // a shot destroyed or turned by the shell
  | { kind: 'catch'; at: THREE.Vector3 }                               // Anvil
  | { kind: 'decoy'; state: 'spawn' | 'burst' | 'gone'; at: THREE.Vector3 }
  | { kind: 'anchor'; state: 'plant' | 'snap' | 'fade' | 'denied'; at: THREE.Vector3 }
  | { kind: 'windowEnd'; slot: SlotName; used: boolean }               // G8 end tick
  | { kind: 'cooldownStart'; slot: SlotName }                          // the anchor faded: start the HUD cooldown now

/**
 * One-wall bank shot. Mirror the target across each wall face near Still, aim at
 * the mirror, and keep the shortest path whose two legs are both clear.
 * Returns the bounce point on the face (offset by `pad`, where a bolt's blocked
 * test will fire) and the axis the bolt reflects on.
 */
export function bankShot(
  terrain: Terrain, o: THREE.Vector3, t: THREE.Vector3, search: number, maxPath: number, pad = 0.15,
): { at: THREE.Vector3; flip: Flip; length: number } | null {
  let best: { at: THREE.Vector3; flip: Flip; length: number } | null = null
  for (const f of terrain.faces(o.x, o.z, search)) {
    const plane = f.at + f.normal * pad
    const oSide = ((f.axis === 'x' ? o.x : o.z) - plane) * f.normal
    const tSide = ((f.axis === 'x' ? t.x : t.z) - plane) * f.normal
    if (oSide <= 0.05 || tSide <= 0.05) continue              // both must be on the face's open side
    const mx = f.axis === 'x' ? 2 * plane - t.x : t.x
    const mz = f.axis === 'z' ? 2 * plane - t.z : t.z
    const s = oSide / (oSide + tSide)                          // where o→mirror meets the plane
    const px = o.x + (mx - o.x) * s
    const pz = o.z + (mz - o.z) * s
    const along = f.axis === 'x' ? pz : px
    if (along < f.from + 0.2 || along > f.to - 0.2) continue  // off the end of the face
    const length = Math.hypot(px - o.x, pz - o.z) + Math.hypot(t.x - px, t.z - pz)
    if (length > maxPath || (best && length >= best.length)) continue
    if (!terrain.lineClear(o.x, o.z, px, pz, pad, true) || !terrain.lineClear(px, pz, t.x, t.z, pad, true)) continue
    best = { at: new THREE.Vector3(px, 0, pz), flip: f.axis, length }
  }
  return best
}
