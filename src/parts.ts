import * as THREE from 'three'
import type { SlotName } from './still'
import type { Terrain } from './terrain'
import type { AbilityDef, BeatKey } from './abilities'
import type { Enemy } from './enemy'
import type { StateBy, StateId, StateMark } from './states'

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
  /** A Frost strip keeps an enemy chilled this long after it steps off: the rime outlasts the slow. */
  stripChill: 1.5,
  /** Shatter: a paid kill's excess reaches the nearest awake body whose edge is this close to where it fell. */
  shatterReach: 3,
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
    /** The slot it is worn in (an archetype's slot law lets a guard sit in the head): where its ring and end tick show. */
    by: SlotName
  } | null
  /** Arms window: Anvil. Closes on the first catch. */
  anvil: { t: number; max: number; def: AbilityDef } | null
  /** Torso: the Lure decoy. At most one. */
  /** `pushed`: its cast was a push (or a ready cast under "weight"), so its burst is a pushed hit (the break rule). `real`: a real push, for the log. */
  decoy: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef; pushed: boolean; real: boolean } | null
  /** Arms: the Summoner's Turret. At most one; `hp` is what enemies still have to deal it, `aim` the way its barrel turns, `next` the game time of its next shot. */
  turret: { pos: THREE.Vector3; t: number; max: number; hp: number; maxHp: number; aim: number; next: number; def: AbilityDef } | null
  /** The Summoner's drone: where it hovers (null with no archetype or another). `aim` is the way it last pecked. */
  drone: { pos: THREE.Vector3; aim: number } | null
  /** Legs: the Plumb Line anchor. While it lives, the legs button is tappable (cooldown 'hold'). */
  anchor: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef } | null
  /** Head: seconds since the last Patient Lens cast. Set to mod.minS on swap-in and on reset. */
  patientSince: number
}

/**
 * Per-enemy status. Map<Enemy, EnemyStatus> in Combat; deleted when the enemy is buried.
 * The states (states.ts) are apart from the slow: Chill Vent and Frost Trail set both, the
 * masteries the chill alone. The rime shows the chill.
 */
export interface EnemyStatus {
  chilled: StateMark
  marked: StateMark
  /**
   * Core marks (design/buildlayer/BUILD.md §2.2): a count, not a StateId. `n` 0..cap; `t` seconds left (0 with n 0);
   * `since`: combat time the stack's first mark landed (for the log's lag). INV: n === 0 <=> t === 0.
   */
  marks: { n: number; t: number; since: number }
  /** Wake's frostbite (B6b): combat seconds since the last bite on this body while it holds marks; 0 with none. */
  bite: number
  slowT: number      // seconds left, 0 = not slowed
  /** The factor applied to speedMul while slowT > 0. Divided back out on expiry: never set speedMul to 1. */
  slowMul: number
}

/** A floor strip (Frost Trail). Never shoves. */
export interface Zone { ax: number; az: number; bx: number; bz: number; halfW: number; t: number; max: number; mul: number; by: SlotName }

/** An enemy in the clamp's throw. While held, it doesn't think. */
export interface Held { from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; short: boolean; def: AbilityDef; pushed: boolean; real: boolean }

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
  /**
   * A windup broken (Parry, a grab, a push, the hand, the eye). `push`: a pushed hit broke it under the
   * break rule, and it reels. `by`: the hand's strike or the eye's planted shot broke it (a trigger).
   * `tell`: Parry Clamp caught a pressure body's own tell (a cock, a lens glow, a rear), not a windup (LINE-RULES R3).
   * `ready`: with `push`, the push effect came from a ready cast under the "weight" trial, not a real push (set only then).
   */
  | { kind: 'interrupt'; enemy: Enemy; push?: boolean; by?: 'hand' | 'eye'; tell?: boolean; parry?: boolean; ready?: boolean }
  /**
   * A state set fresh on a body ('on', not a refresh), paid by a part's hit, or run out unpaid.
   * A pay says who set it, which slot paid, whether a push did, whether the hit killed, its
   * multiplier and the damage it added.
   */
  | { kind: 'state'; id: StateId; enemy: Enemy; state: 'on' | 'paid' | 'expired'; by: StateBy; payer?: SlotName; pushed?: boolean; killed?: boolean; mul?: number; bonus?: number }
  /**
   * Core marks (BUILD.md §2.2), only with a core worn. `mark`: marks landed on a body; `n` is its count after, `added` the number actually added
   * (0 at the cap: still a refresh), `fresh` a first mark on a body holding none. `markExpired`: the stack ran out unspent (`n` it held).
   * `spend`: a part, or Burst (`payer: 'core'`), cashed `n` marks for `bonus` flat damage; `lagS`: seconds since the stack's first mark.
   */
  | { kind: 'mark'; enemy: Enemy; n: number; added: number; by: 'core' | SlotName; fresh: boolean }
  | { kind: 'markExpired'; enemy: Enemy; n: number }
  | { kind: 'spend'; enemy: Enemy; n: number; bonus: number; payer: 'core' | SlotName; killed: boolean; lagS: number }
  /** Wake's skim (B2): a body passed beside. `burst`: the skim filled it to the cap and Burst spent the marks (its `spend` event comes first); `spray`: the body Spray marked too. */
  | { kind: 'skim'; enemy: Enemy; burst?: true; spray?: Enemy }
  /** Wake's frostbite (B6b): a frosted body took `dmg` (what it really took, a boss's half included). */
  | { kind: 'bite'; enemy: Enemy; dmg: number }
  /** Wake's trail frosted a body (B6b): (x, z) is the nearest point of the trail to it, where the ribbon flashes. */
  | { kind: 'trailFrost'; enemy: Enemy; x: number; z: number }
  /**
   * Thorns (N3, THORNS.md): a hit landed on him or was stopped. `how`: an enemy's melee hit or its shot; `blocked`: a guard stopped it (the barbs are the heavier). `dmg`: the core hit the attacker took (what it really took; 0 for
   * a shot that landed); `marks`: marks it was given; `others`: bodies Bramble marked besides. `at`: where he stood; `dir`: the unit heading from him to the attacker.
   */
  | { kind: 'thorns'; enemy: Enemy; how: 'melee' | 'shot'; blocked: boolean; dmg: number; marks: number; others: number; at: THREE.Vector3; dir: THREE.Vector3 }
  /**
   * Tether's wire (N2, CORES2.md §2): `what` is a 'hook' (the wire is up, `enemy` its anchor), a 'cross' (a body's side of the wire flipped inside it: `at` is the crossing point on the wire, `u` how far along it from
   * Still, 0 to 1, `dmg` the core hit, `snag` the slow Snag set), an 'anchor' tick (`dmg`) or a 'break' (`why`; `whip`: the bodies Whip cracked, `dmg` the sum they took). `wire` is its index (0, or 1 with Second Line);
   * `from` and `to` are Still's end and the anchor's, as they stood.
   */
  | { kind: 'tether'; what: 'hook' | 'cross' | 'anchor' | 'break'; wire: number; enemy: Enemy; from: THREE.Vector3; to: THREE.Vector3; at: THREE.Vector3; u: number; dmg: number; why?: 'dead' | 'range' | 'los'; whip?: number; snag?: boolean }
  /** Backhand's cast (B5): a swing behind him; `whiff`: there was nothing behind (the balancer's whiff share). Only with Wake worn. */
  | { kind: 'backhand'; whiff: boolean }
  /**
   * Ram's shove (B3): `slam` says what the body hit, or null for a plain shove; `other` is the body it hit; `why` the source. `at`: the contact point (a wall's face,
   * the gap between two bodies, a body's near face when it can't be moved); `dmg`: the nominal core damage the shove dealt (the beat's, a chain link's, Rubble's);
   * `rubble`: bodies Rubble threw stone at; `link`: how deep in a Domino chain (0 for the shove itself).
   */
  | { kind: 'shove'; enemy: Enemy; slam: 'wall' | 'body' | 'still' | 'tell' | null; other?: Enemy; why: 'beat' | 'part' | 'catch' | 'chain'; at: THREE.Vector3; dmg: number; rubble?: number; link?: number }
  /** A paid kill's excess, passed on to the nearest body as a plain hit. */
  | { kind: 'shatter'; from: THREE.Vector3; to: THREE.Vector3; enemy: Enemy; damage: number }
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
  | { kind: 'turret'; state: 'drop' | 'pop' | 'gone' | 'fire'; at: THREE.Vector3; aim?: number }
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
