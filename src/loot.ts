import * as THREE from 'three'
import { DECAL_Y } from './world'
import type { AbilityDef, Tier } from './abilities'
import { centred, DISPLAY_EYE, EYE_ON, FLOOR_SCALE, partModel } from './partmodels'
import type { Terrain } from './terrain'
import { pieceData } from './kit'
import { LOOT, type PickKind } from './drops'
import type { KeystoneDef } from './cores'

// The drop rules themselves live in drops.ts, free of three.js, so tools/dropsim.ts can run them.
export { LOOT, KILL_WEIGHT, dropChance, rollPart, rollForCore, rollPicks, emptySlots, PEDESTALS, PEDESTALS_ON, type DropSource, type PickKind } from './drops'

export const TIER_COLOR: Record<Tier, number> = {
  white: 0xdfe6ee,
  blue: 0x6f8cff,
  // warm like Grace's light, so it's kept thin and rare; no light source of its own
  gold: 0xd9b36c,
}

/** Parts risen together on pedestals (drops.ts PEDESTALS): take one and the rest go back to the wall. */
export interface PickSet { kind: PickKind; /** Taken from it so far. */ took: number }

/** A pedestal: the stone stays when its part is gone, and its cold pool dims. */
interface Stone {
  group: THREE.Group
  mesh: THREE.Mesh
  pool: THREE.MeshBasicMaterial
  circle: { x: number; z: number; r: number; dead?: boolean }
  /** 0 flush with the floor .. 1 up, over STONE.riseS; `full` is its height's scale when up. */
  rise: number
  full: number
  part: GroundPart | null
}

/**
 * The stone: the kit's pillar cut down, under the barrier's reach (INV: nothing tall in a room).
 * The part on it is drawn a size up from the floor's, so it reads from the camera over the stone.
 */
const STONE = { h: 0.6, r: 0.3, riseS: 0.6, partScale: 1.3 }
/** Its cold pool: bright while a part stands on it, faint once it's empty. */
const POOL = { lit: 0.5, spent: 0.1 }
const POOL_COLOR = 0x8fd0ff

/** An angle into (−π, π]. */
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))
const ease = (k: number) => k * k * (3 - 2 * k)

export interface GroundPart {
  def: AbilityDef
  pos: THREE.Vector3
  group: THREE.Group
  /** The pop out of the enemy: counts down to landing. */
  fly: number
  from: THREE.Vector3
  bob: number
  /** The part's own model, turning about its middle inside the beam. */
  spinner: THREE.Group
  /** Its glass: dim until it's offered, then it answers him. Its own copy, so it lights alone. */
  eye: THREE.MeshBasicMaterial
  /** Half its height, so the hover never puts it through the floor. */
  half: number
  yaw: number
  /** The random spin it flies out with. */
  tumble: THREE.Vector3
  /** Counts down the small bounce after it lands. */
  settle: number
  /** 0 dim .. 1 lit, eased over OFFER_S. */
  lit: number
  /** Never found: drawn bare and unpowered, its glass stays dark. The tier shows in the beam only. */
  bare: boolean
  /** An elite's owed drop: the pack whose leader it fell from (the thief in that pack's barrel comes for it). */
  owed?: object
  /** Its card has shown: he's looked at it. Left lying after that, it was turned down, and the thief wants none of it. */
  seen: boolean
  /** Risen on a pedestal, with the rest of its set. */
  set?: PickSet
  stone?: Stone
  /** It fits the core worn when it landed (B5): a second thin cold ring on its disc that breathes slowly. Decided at the drop. A plain part has none. */
  fitRing?: THREE.Mesh
}

/**
 * A keystone on the floor (design/buildlayer/BUILD.md §2.9): a separate list from `ground`, so nothing that reads `GroundPart.def` (melts, the thief, the compare card, `partModel`)
 * ever sees one. A gold beam like a gold part's, a small cold torus turning in it, and on the disc the core's ring glyph in thirds (Wake's plain, Ram's split).
 * `seen`: the socket card has shown for it (the drop record's `offered`).
 */
export interface GroundKey {
  key: KeystoneDef
  pos: THREE.Vector3
  group: THREE.Group
  fly: number
  from: THREE.Vector3
  bob: number
  seen: boolean
  spinner: THREE.Mesh
}
/** The keystone's cold: Wake's frost-bright, Ram's steel (markfx.ts' two looks). */
const KEY_COLOR = { wake: 0x9fd8ff, ram: 0x7fa7d8, graze: 0x8fe8e0, tether: 0xbfe4f2 } as const

const FLY = 0.42
/** How long the offered part's glass takes to light. */
const OFFER_S = 0.15
const SETTLE_S = 0.3
const SPIN = 1.6

export class Loot {
  readonly ground: GroundPart[] = []
  /** Keystones lying on the floor (GroundKey): walked onto, they open the socket card. Never in `ground`. */
  readonly keys: GroundKey[] = []
  /** Repair scrap on the floor: walked over, not taken. */
  private scraps: { mesh: THREE.Mesh; pos: THREE.Vector3; bob: number }[] = []
  private readonly scrapGeo = new THREE.TorusGeometry(0.16, 0.06, 6, 10)
  private readonly scrapMat = new THREE.MeshBasicMaterial({ color: 0x9fd8c4 })
  private readonly beamGeo = new THREE.CylinderGeometry(0.07, 0.16, 5, 8, 1, true)
  private readonly discGeo = new THREE.CircleGeometry(0.55, 24)
  private readonly poolGeo = new THREE.RingGeometry(0.55, 0.85, 32)
  /** A fitting part's breathing ring, just outside its disc. */
  private readonly fitGeo = new THREE.RingGeometry(0.66, 0.76, 40)
  private readonly keyGeo = new THREE.TorusGeometry(0.2, 0.07, 8, 22)
  /** The core's glyph on a keystone's disc: three arcs of a ring (the marks' thirds), gaps between. */
  private readonly glyphGeo = [0, 1, 2].map((i) => new THREE.RingGeometry(0.4, 0.55, 14, 1, (i * 2 * Math.PI) / 3 + 0.18, (2 * Math.PI) / 3 - 0.36))
  private stones: Stone[] = []

  /** Swapped for each level, so drops never land on the far side of a wall. */
  terrain: Terrain | null = null
  /** The part the pickup card is showing: it lights up and turns to face him. */
  private offered: GroundPart | null = null
  /** What the save has found. A part not in it lands bare. */
  isFound: (id: string) => boolean = () => true

  constructor(private readonly scene: THREE.Scene) {}

  /**
   * The beam finds the part, and the model says what it is. The model is the
   * part itself (shared geometry and steel, cold, no emissive): tier colour lives
   * only in the beam and the disc.
   */
  drop(def: AbilityDef, at: THREE.Vector3, toward?: THREE.Vector3, owed?: object, fit = false): GroundPart {
    const color = TIER_COLOR[def.tier]
    const group = new THREE.Group()

    const bare = !this.isFound(def.id)
    const model = partModel(def, bare ? 'unfound' : 'found')
    const eye = DISPLAY_EYE.clone()
    // the copy must be disposable: clone() carries the shared flag over
    eye.userData = {}
    // a bare part keeps its dead glass; only a found one's lights when offered
    if (!bare) {
      model.root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.userData.eye) o.material = eye
      })
    }
    const { group: spinner, half } = centred(model.root, FLOOR_SCALE[def.slot])

    const beamMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: def.tier === 'white' ? 0.18 : 0.34,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
    const beam = new THREE.Mesh(this.beamGeo, beamMat)
    beam.position.y = 2.5

    const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3, depthWrite: false,
    }))
    disc.rotation.x = -Math.PI / 2
    disc.position.y = DECAL_Y

    group.add(spinner, beam, disc)
    // fits the core worn (decided by the caller, at the drop): a second thin cold ring that breathes, so it reads from the camera without reading
    let fitRing: THREE.Mesh | undefined
    if (fit) {
      fitRing = new THREE.Mesh(this.fitGeo, new THREE.MeshBasicMaterial({
        color: 0xa8dcff, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      }))
      fitRing.rotation.x = -Math.PI / 2
      fitRing.position.y = DECAL_Y + 0.01
      group.add(fitRing)
    }

    // land a short hop away from where it fell, never through a wall
    const a = toward
      ? Math.atan2(toward.x - at.x, toward.z - at.z) + (Math.random() - 0.5) * 1.6
      : Math.random() * Math.PI * 2
    const dist = 0.8 + Math.random() * 0.8
    const tx = at.x + Math.sin(a) * dist
    const tz = at.z + Math.cos(a) * dist
    const land = this.terrain ? this.terrain.clampMove(at.x, at.z, tx, tz, 0.35) : { x: tx, z: tz }
    const pos = new THREE.Vector3(land.x, 0, land.z)

    group.position.copy(at)
    this.scene.add(group)
    const g: GroundPart = {
      def, pos, group, fly: FLY, from: at.clone(), bob: Math.random() * 10,
      spinner, eye, half, yaw: Math.random() * Math.PI * 2, settle: 0, lit: 0, bare, owed, seen: false,
      tumble: new THREE.Vector3(Math.random() * 16 - 8, Math.random() * 10 - 5, Math.random() * 16 - 8),
      fitRing,
    }
    this.ground.push(g)
    return g
  }

  /**
   * A keystone at `at`, popping out toward `toward` like a part (a short hop, never through a wall). A gold beam, a small cold torus turning in it, and the core's glyph on the disc.
   * It is its own kind of thing: `keys`, not `ground`.
   */
  dropKey(key: KeystoneDef, at: THREE.Vector3, toward?: THREE.Vector3): GroundKey {
    const group = new THREE.Group()
    const cold = KEY_COLOR[key.core]
    const spinner = new THREE.Mesh(this.keyGeo, new THREE.MeshBasicMaterial({ color: cold }))
    spinner.position.y = 0.55
    spinner.rotation.x = Math.PI / 2.4
    const beam = new THREE.Mesh(this.beamGeo, new THREE.MeshBasicMaterial({
      color: TIER_COLOR.gold, transparent: true, opacity: 0.34, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }))
    beam.position.y = 2.5
    const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: TIER_COLOR.gold, transparent: true, opacity: 0.3, depthWrite: false }))
    disc.rotation.x = -Math.PI / 2
    disc.position.y = DECAL_Y
    // the glyph: one material for the three arcs
    const glyphMat = new THREE.MeshBasicMaterial({ color: cold, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })
    const glyph = new THREE.Group()
    for (const geo of this.glyphGeo) {
      const arc = new THREE.Mesh(geo, glyphMat)
      arc.rotation.x = -Math.PI / 2
      arc.position.y = DECAL_Y + 0.01
      glyph.add(arc)
    }
    group.add(spinner, beam, disc, glyph)
    const a = toward ? Math.atan2(toward.x - at.x, toward.z - at.z) + (Math.random() - 0.5) * 1.6 : Math.random() * Math.PI * 2
    const dist = 0.8 + Math.random() * 0.8
    const tx = at.x + Math.sin(a) * dist
    const tz = at.z + Math.cos(a) * dist
    const land = this.terrain ? this.terrain.clampMove(at.x, at.z, tx, tz, 0.35) : { x: tx, z: tz }
    const pos = new THREE.Vector3(land.x, 0, land.z)
    group.position.copy(at)
    this.scene.add(group)
    const g: GroundKey = { key, pos, group, fly: FLY, from: at.clone(), bob: Math.random() * 10, seen: false, spinner }
    this.keys.push(g)
    return g
  }

  removeKey(g: GroundKey) {
    const i = this.keys.indexOf(g)
    if (i < 0) return
    this.keys.splice(i, 1)
    this.disposeKey(g)
  }

  /** The closest landed keystone Still is standing within the pickup radius of, if any. */
  keyUnder(at: THREE.Vector3): GroundKey | null {
    let best: GroundKey | null = null
    let bestD = LOOT.pickupRadius
    for (const g of this.keys) {
      if (g.fly > 0) continue
      const d = Math.hypot(g.pos.x - at.x, g.pos.z - at.z)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    return best
  }

  /**
   * A part risen on a pedestal at `at`, one of `set`: no hop, it stands where it's put. The
   * stone is solid and rises out of the floor; the part hovers over it, its beam and disc as on
   * the floor. Walking into it opens the compare (main).
   */
  raise(def: AbilityDef, at: THREE.Vector3, set: PickSet): GroundPart {
    const g = this.drop(def, at)
    g.fly = 0
    g.pos.set(at.x, 0, at.z)
    g.group.position.copy(g.pos)
    g.set = set
    g.spinner.scale.multiplyScalar(STONE.partScale)
    g.half *= STONE.partScale
    const { geometry, material, radius, height } = pieceData('pillar')
    const mesh = new THREE.Mesh(geometry, material)
    mesh.scale.set(STONE.r / radius, 0, STONE.r / radius)
    const pool = new THREE.MeshBasicMaterial({ color: POOL_COLOR, transparent: true, opacity: POOL.lit, depthWrite: false, blending: THREE.AdditiveBlending })
    const ring = new THREE.Mesh(this.poolGeo, pool)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = DECAL_Y
    const group = new THREE.Group()
    group.position.set(at.x, 0, at.z)
    group.add(mesh, ring)
    this.scene.add(group)
    const circle = { x: at.x, z: at.z, r: STONE.r + 0.05 }
    this.terrain?.add(circle)
    const stone: Stone = { group, mesh, pool, circle, rise: 0, full: STONE.h / height, part: g }
    this.stones.push(stone)
    g.stone = stone
    return g
  }

  /** The pickup card is showing this one (or none). */
  offer(g: GroundPart | null) {
    this.offered = g
    if (g) g.seen = true
  }

  dropScrap(at: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.scrapGeo, this.scrapMat)
    const pos = new THREE.Vector3(at.x, 0, at.z)
    mesh.position.set(pos.x, 0.4, pos.z)
    this.scene.add(mesh)
    this.scraps.push({ mesh, pos, bob: Math.random() * 6 })
  }

  /** Scrap Still is standing on is picked up at once. Returns how many. */
  collectScrap(at: THREE.Vector3): number {
    let n = 0
    for (let i = this.scraps.length - 1; i >= 0; i--) {
      const s = this.scraps[i]!
      if (Math.hypot(s.pos.x - at.x, s.pos.z - at.z) < 0.95) {
        this.scene.remove(s.mesh)
        this.scraps.splice(i, 1)
        n++
      }
    }
    return n
  }

  /** `still` is where he stands: an offered part turns to face him. */
  update(dt: number, still?: THREE.Vector3) {
    for (const st of this.stones) {
      st.rise = Math.min(1, st.rise + dt / STONE.riseS)
      st.mesh.scale.y = st.full * ease(st.rise)
      const want = st.part ? POOL.lit : POOL.spent
      st.pool.opacity += (want - st.pool.opacity) * Math.min(1, dt * 4)
    }
    for (const s of this.scraps) {
      s.bob += dt * 3
      s.mesh.position.y = 0.4 + Math.sin(s.bob) * 0.08
      s.mesh.rotation.y += dt * 2
      s.mesh.rotation.x = 0.6
    }
    for (const g of this.keys) {
      g.bob += dt * 2.4
      if (g.fly > 0) {
        g.fly = Math.max(0, g.fly - dt)
        const k = 1 - g.fly / FLY
        g.group.position.lerpVectors(g.from, g.pos, k)
        g.group.position.y = Math.sin(k * Math.PI) * 1.4
      } else g.group.position.set(g.pos.x, 0, g.pos.z)
      g.spinner.rotation.z += dt * 1.8
      g.spinner.position.y = 0.55 + Math.sin(g.bob) * 0.08
    }
    for (const g of this.ground) {
      g.bob += dt * 2.4
      if (g.fitRing) {
        // it breathes: slow (about 3.7 s), the ring swelling a hair as it brightens
        const k = 0.5 + 0.5 * Math.sin(g.bob * 0.7)
        ;(g.fitRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.55 * k
        g.fitRing.scale.setScalar(1 + 0.1 * k)
      }
      const sp = g.spinner
      let bounce = 0
      if (g.fly > 0) {
        g.fly = Math.max(0, g.fly - dt)
        const k = 1 - g.fly / FLY
        g.group.position.lerpVectors(g.from, g.pos, k)
        g.group.position.y = Math.sin(k * Math.PI) * 1.4
        // a piece of the enemy flying off, tumbling
        sp.rotation.x += g.tumble.x * dt
        sp.rotation.z += g.tumble.z * dt
        g.yaw += g.tumble.y * dt
        if (g.fly <= 0) {
          g.settle = SETTLE_S
          sp.rotation.x = wrap(sp.rotation.x)
          sp.rotation.z = wrap(sp.rotation.z)
        }
      } else {
        g.group.position.set(g.pos.x, 0, g.pos.z)
        // it lands upright, with a small bounce
        const e = Math.min(1, dt * 18)
        sp.rotation.x -= sp.rotation.x * e
        sp.rotation.z -= sp.rotation.z * e
        if (g.settle > 0) {
          g.settle = Math.max(0, g.settle - dt)
          const u = 1 - g.settle / SETTLE_S
          bounce = 0.14 * Math.sin(u * Math.PI) * (1 - u)
        }
      }
      // offered, the part answers him: its glass lights, the spin stops, it turns to face him
      const on = g === this.offered && g.fly <= 0
      g.lit = Math.max(0, Math.min(1, g.lit + (on ? dt : -dt) / OFFER_S))
      g.eye.color.copy(DISPLAY_EYE.color).lerp(EYE_ON, g.lit)
      if (on && still) g.yaw += wrap(Math.atan2(still.x - g.pos.x, still.z - g.pos.z) - g.yaw) * Math.min(1, dt * 10)
      else if (g.fly <= 0) g.yaw += dt * SPIN * (1 - g.lit)
      sp.rotation.y = g.yaw
      // on a pedestal, it rides up with the stone and hovers over its top
      const base = g.stone ? STONE.h * ease(g.stone.rise) + g.half + 0.14 : Math.max(0.3, g.half + 0.14)
      sp.position.y = base + Math.sin(g.bob) * 0.08 + bounce
    }
  }

  /** The closest landed part Still is standing on, if any. */
  under(at: THREE.Vector3): GroundPart | null {
    let best: GroundPart | null = null
    let bestD = LOOT.pickupRadius
    for (const g of this.ground) {
      if (g.fly > 0) continue
      const d = Math.hypot(g.pos.x - at.x, g.pos.z - at.z)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    return best
  }

  /**
   * The thief takes it: off the floor and out of the scene, and its def goes into the
   * cage. The same def comes back down on a catch, so nothing is added or lost.
   */
  lift(g: GroundPart): AbilityDef {
    this.remove(g)
    return g.def
  }

  remove(g: GroundPart) {
    const i = this.ground.indexOf(g)
    if (i < 0) return
    this.ground.splice(i, 1)
    if (g.stone) g.stone.part = null
    this.dispose(g)
  }

  clear() {
    for (const g of this.ground) this.dispose(g)
    this.ground.length = 0
    for (const g of this.keys) this.disposeKey(g)
    this.keys.length = 0
    for (const st of this.stones) {
      this.scene.remove(st.group)
      st.pool.dispose()
      st.circle.dead = true
    }
    this.stones.length = 0
    for (const s of this.scraps) this.scene.remove(s.mesh)
    this.scraps.length = 0
  }

  /** A keystone's own materials (the geometries are the loot's, shared). */
  private disposeKey(g: GroundKey) {
    this.scene.remove(g.group)
    const own = new Set<THREE.Material>()
    g.group.traverse((o) => {
      if (o instanceof THREE.Mesh) own.add(o.material as THREE.Material)
    })
    for (const m of own) m.dispose()
  }

  /**
   * Only what this drop owns: the beam, the disc and its glass. The model's
   * geometry and steel are shared with every other copy of the part, Still's own
   * included, so disposing them would blank those too.
   */
  private dispose(g: GroundPart) {
    this.scene.remove(g.group)
    if (this.offered === g) this.offered = null
    const own = new Set<THREE.Material>()
    g.group.traverse((o) => {
      if (o instanceof THREE.Mesh && !(o.material as THREE.Material).userData.shared) own.add(o.material as THREE.Material)
    })
    for (const m of own) m.dispose()
    // a bare part's glass copy was never put on the model
    if (g.bare) g.eye.dispose()
  }
}
