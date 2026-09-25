import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, tellOrder, haloTexture, EMBER_DEEP } from './vfx'
import { Quads, UV_LEN } from './lane'
import type { Enemy } from './enemy'

/**
 * One floor rule for everything that burns the floor itself (design/content/SPEC.md
 * §3.2): a slag core's puddle, a shell's landing, a lance, a scald. It shows its
 * telegraph, arms once, stays live for a set time, and hits each body at most once,
 * Still and enemies alike. Drawn = hit: the shape on the floor is where his centre
 * is hurt. Combat owns them and ticks them on game time.
 *
 *   telegraph (armIn > 0) → armed tick → live (liveMs, each body once) → fade (300 ms) → gone
 */

export type HazardShape =
  | { kind: 'circle'; x: number; z: number; r: number }
  /** a → b is already cut at cover by whoever made it. halfW is the drawn half-width. */
  | { kind: 'strip'; ax: number; az: number; bx: number; bz: number; halfW: number }
export type HazardSource = 'slag' | 'shell' | 'lance' | 'scald'

export interface HazardSpec {
  source: HazardSource
  /** r / halfW are DRAWN and are where Still's CENTRE is hit. An enemy is hit when its centre is within r − PLAYER_RADIUS + e.radius. */
  shape: HazardShape
  /** Telegraph, ms, from creation to the arm tick. INV: ≥ 450 + 1000 × (Still's escape u) ÷ 5.5 (slag by slagArm). */
  armMs: number
  /** Live after arming, ms. Every body inside at any tick of [arm, arm + liveMs] is hit, once. 0 = the arm tick only. */
  liveMs: number
  /** INV: ≤ 22 */
  damage: number
  /** 'none': the floor itself. 'fromCentre': a clear solid-mode line from the circle's centre to the body (scald). A strip is pre-cut. */
  cover: 'none' | 'fromCentre'
  /** How Still is hurt: Anvil catches 'melee' only; Brace converts either; Ward and Mirror see only `warded`. */
  hurt: 'hazard' | 'melee'
  /** The lance only: Ward destroys it and Mirror Ward sends it back, as they do a shot. INV: false for shells and slag. */
  warded?: boolean
  /** Who made it. Its death cancels it while unarmed if `cancelOnDeath`. The owner is never spared its own hazard. */
  owner?: Enemy
  cancelOnDeath?: boolean
  /** Draw only: the owner's own tell already shows the arm clock, so the arming draw is skipped. */
  quiet?: boolean
  /** The lance only: a hit on Still (taken, or turned to strain by Brace) heats one of his buttons. */
  heat?: boolean
  /** Its maker is never hurt by it: the Arbiter's scald is its own steam. Every other hazard hurts its owner too. */
  sparesOwner?: boolean
  /** Draw only: a shell thrown from here, arcing `peak` high, landing on the arm tick. */
  flight?: { x: number; y: number; z: number; peak: number }
}

export interface Hazard {
  readonly spec: HazardSpec
  /** ms until it arms (≤ 0 once armed). */
  readonly armIn: number
  /** ms of live time left after arming. */
  readonly liveLeft: number
  /** Bodies already hit ('still' for him). INV: a body appears at most once. */
  readonly hit: ReadonlySet<Enemy | 'still'>
  readonly done: boolean
}

/** INV: the four constants the design fixes. */
export const SLAG = { r: 0.9, armMs: 400, liveMs: 1600, damage: 8 }
/** The balancer's slack rule: react, a margin, and his walk. */
export const SLACK = { reactMs: 300, slackMs: 150, walk: 5.5 }
/**
 * Slag's arm time for Still at distance d from the corpse (§5.3): the design's 400 ms
 * when he's outside the puddle; standing on it, the slack rule's time to walk off it
 * (450 at its edge, 614 at its centre), on a visible clock.
 */
export const slagArm = (d: number) =>
  d >= SLAG.r ? SLAG.armMs : SLACK.reactMs + SLACK.slackMs + (1000 * (SLAG.r - Math.max(0, d))) / SLACK.walk

/** A hazard's fade after its live time, ms. */
export const HAZARD_FADE_MS = 300
/** How long the arm flashes at full, ms. */
const ARM_FLASH_MS = 120
/** The lance's raised beam burns this much past its live time, ms. */
const BEAM_EXTRA_MS = 150
const BEAM_Y = 1.2
/**
 * A shell in flight: a dark iron ball in an ember glow. A lit ball on its own read as a
 * flat white dot against the dusk; this reads as something hot and heavy coming down.
 */
const SHELL = { r: 0.22, iron: 0x2a1512, glow: 0xff7a40, halo: 1.1 }
const shellGeo = new THREE.SphereGeometry(SHELL.r, 12, 8)
/** A burning strip's layers. The spec's whole strip at 0.95 read as a flat slab on the floor, so it's a wash under a core. */
const LIVE = { wash: 0.45, core: 0.9, rails: 0.95 }
/** Where a live puddle's heat ends: the deep ember, darker. */
const COOLED = EMBER_DEEP.clone().multiplyScalar(0.6)
/** A live slag puddle: hot slag over a dark crust, fading as it cools; its rim held so the edge stays honest. */
const MOLTEN = { hot: new THREE.Color(0xff5c12), crust: new THREE.Color(0x1a0805), opacity: [0.95, 0.6] as const, rim: 0.55 }

/**
 * Whether a centre is inside a shape as drawn, grown by `grow` (an enemy: its radius
 * past Still's). A strip is the drawn rectangle from a to b, not a capsule.
 */
export function inShape(s: HazardShape, x: number, z: number, grow = 0): boolean {
  if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) <= s.r + grow
  const vx = s.bx - s.ax
  const vz = s.bz - s.az
  const len = Math.hypot(vx, vz)
  if (len < 1e-6) return false
  const along = ((x - s.ax) * vx + (z - s.az) * vz) / len
  const across = Math.abs((x - s.ax) * vz - (z - s.az) * vx) / len
  return along >= 0 && along <= len && across <= s.halfW + grow
}

/** Where the camera should keep in frame while it's coming: a circle's centre, a strip's far end. */
export function threatPoint(s: HazardShape, out: THREE.Vector3): THREE.Vector3 {
  return s.kind === 'circle' ? out.set(s.x, 0, s.z) : out.set(s.bx, 0, s.bz)
}

/** Combat's own record of one hazard: the clocks it ticks, and the tell it draws. */
export class LiveHazard implements Hazard {
  armIn: number
  liveLeft: number
  readonly hit = new Set<Enemy | 'still'>()
  done = false
  armed = false
  /** ms since the arm tick. */
  sinceArm = 0
  fadeLeft = HAZARD_FADE_MS
  readonly tell: HazardTell

  constructor(readonly spec: HazardSpec) {
    this.armIn = spec.armMs
    this.liveLeft = spec.liveMs
    this.tell = new HazardTell(spec)
  }
}

/** Two quads, crossed along +z at beam height: the lance reads as a line of light from any side. */
function beamGeometry(len: number): THREE.BufferGeometry {
  const h = 0.06
  const u = len / UV_LEN
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([
    // upright
    0, -h, 0, 0, h, 0, 0, -h, len, 0, h, len,
    // flat
    -h, 0, 0, h, 0, 0, -h, 0, len, h, 0, len,
  ], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, u, 1, u, 0, 0, 1, 0, 0, u, 1, u], 2))
  g.setIndex([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7])
  return g
}

/**
 * A hazard's telegraph (H9): the hulk's ring-and-disc for a circle, the lane's rails
 * and filling core for a strip, all in the textured ember tell. Every material is a
 * ShaderMaterial, so none of them fog: tells read in the dark.
 */
export class HazardTell {
  readonly group = new THREE.Group()
  private readonly mats: THREE.ShaderMaterial[] = []
  private readonly meshes: THREE.Mesh[] = []
  private readonly quads: Quads[] = []
  private readonly geos: THREE.BufferGeometry[] = []
  /** Opacities when the fade began, so it runs down linearly from wherever it was. */
  private fadeFrom = new Map<THREE.ShaderMaterial, number>()
  // circle
  private ring?: THREE.Mesh
  private ringMat?: THREE.ShaderMaterial
  private disc?: THREE.Mesh
  private discMat?: THREE.ShaderMaterial
  // strip
  private len = 0
  private halfW = 0
  private railMat?: THREE.ShaderMaterial
  private coreMat?: THREE.ShaderMaterial
  private wholeMat?: THREE.ShaderMaterial
  private beamMat?: THREE.ShaderMaterial
  private core?: Quads
  private beam?: THREE.Mesh
  /** A thrown shell: world space, apart from the landing ring's group. */
  shell: THREE.Group | null = null
  private shellMats: THREE.Material[] = []

  constructor(private readonly spec: HazardSpec) {
    const s = spec.shape
    if (s.kind === 'circle') {
      this.group.position.set(s.x, DECAL_Y, s.z)
      // the ring is fixed at the real radius; the disc fills it, so its growth is the clock
      this.ringMat = this.mat(tellMaterial('radial', s.r))
      this.discMat = this.mat(tellMaterial('radial', s.r))
      const ringGeo = this.geo(new THREE.RingGeometry(Math.max(0, s.r - 0.1), s.r, 48))
      const discGeo = this.geo(new THREE.CircleGeometry(s.r, 48))
      this.ring = this.mesh(new THREE.Mesh(ringGeo, this.ringMat))
      this.disc = this.mesh(new THREE.Mesh(discGeo, this.discMat))
      for (const m of [this.ring, this.disc]) m.rotation.x = -Math.PI / 2
      this.disc.scale.setScalar(0.001)
      if (spec.flight) {
        const iron = new THREE.MeshBasicMaterial({ color: SHELL.iron, fog: false })
        const glow = new THREE.SpriteMaterial({ map: haloTexture(), color: SHELL.glow, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
        const halo = new THREE.Sprite(glow)
        halo.scale.setScalar(SHELL.halo)
        this.shellMats.push(iron, glow)
        this.shell = new THREE.Group()
        this.shell.add(halo, new THREE.Mesh(shellGeo, iron))
      }
    } else {
      const dx = s.bx - s.ax
      const dz = s.bz - s.az
      this.len = Math.hypot(dx, dz)
      this.halfW = s.halfW
      this.group.position.set(s.ax, DECAL_Y, s.az)
      this.group.rotation.y = Math.atan2(dx, dz)
      this.railMat = this.mat(tellMaterial('strip'))
      this.coreMat = this.mat(tellMaterial('strip'))
      this.wholeMat = this.mat(tellMaterial('strip'))
      // the raised line of the beam adds light; its noise still runs along it
      this.beamMat = this.mat(tellMaterial('strip'))
      this.beamMat.blending = THREE.AdditiveBlending
      const whole = new Quads(1, this.wholeMat)
      const rails = new Quads(2, this.railMat)
      this.core = new Quads(1, this.coreMat)
      const rx = Math.max(0.04, s.halfW - 0.04)
      whole.set(0, 0, 0, 0, this.len, s.halfW, 0.002)
      rails.set(0, -rx, 0, -rx, this.len, 0.04, 0.006)
      rails.set(1, rx, 0, rx, this.len, 0.04, 0.006)
      this.core.set(0, 0, 0, 0, 0.001, s.halfW * 0.6, 0.004)
      this.quads.push(whole, rails, this.core)
      for (const q of this.quads) this.mesh(q.mesh)
      this.beam = this.mesh(new THREE.Mesh(this.geo(beamGeometry(this.len)), this.beamMat))
      this.beam.position.y = BEAM_Y - DECAL_Y
      this.beam.frustumCulled = false
    }
    this.show()
  }

  private mat(m: THREE.ShaderMaterial) {
    this.mats.push(m)
    return m
  }
  private geo<G extends THREE.BufferGeometry>(g: G) {
    this.geos.push(g)
    return g
  }
  private mesh(m: THREE.Mesh) {
    this.meshes.push(m)
    this.group.add(m)
    return m
  }

  /** Where the shell is, k (0..1) of the way through its flight: a parabola peaking at `peak`. */
  shellAt(k: number, out: THREE.Vector3) {
    const f = this.spec.flight!
    const sh = this.spec.shape as { x: number; z: number }
    return out.set(f.x + (sh.x - f.x) * k, f.y * (1 - k) + 4 * f.peak * k * (1 - k), f.z + (sh.z - f.z) * k)
  }

  update(dt: number, h: LiveHazard) {
    const s = this.spec
    if (this.shell) {
      const k = Math.min(1, Math.max(0, 1 - h.armIn / Math.max(1, s.armMs)))
      this.shellAt(k, this.shell.position)
      this.shell.visible = !h.armed && !h.done
      // the glow flickers a little; the ball doesn't
      this.shell.children[0]!.scale.setScalar(SHELL.halo * (0.85 + Math.random() * 0.3))
    }
    if (h.done) {
      // from wherever each piece was, down to nothing over the fade; one that armed and
      // ended on the same tick (a shell, a scald) fades from its arm flash
      if (!this.fadeFrom.size) {
        if (h.armed && h.sinceArm < ARM_FLASH_MS) this.flash()
        for (const m of this.mats) this.fadeFrom.set(m, m.opacity)
      }
      const k = Math.max(0, h.fadeLeft / HAZARD_FADE_MS)
      for (const m of this.mats) m.opacity = (this.fadeFrom.get(m) ?? 0) * k
      this.show()
      return
    }
    const order = tellOrder(h.armIn)
    for (const m of this.meshes) m.renderOrder = order
    const fill = Math.min(1, Math.max(0, 1 - h.armIn / Math.max(1, s.armMs)))
    const flashing = h.armed && h.sinceArm < ARM_FLASH_MS
    if (s.shape.kind === 'circle') {
      const ring = this.ringMat!
      const disc = this.discMat!
      this.ring!.renderOrder = order + 0.2
      if (!h.armed) {
        ring.opacity = s.quiet ? 0 : 0.42
        disc.opacity = s.quiet ? 0 : 0.3
        this.disc!.scale.setScalar(Math.max(0.001, fill))
      } else if (flashing) {
        this.flash()
      } else {
        // Live: a molten puddle, cooling as its time runs out. Its noise runs from a near-black
        // crust up to hot slag, so it reads as metal on the floor: an ember wash at 0.7 over
        // grey plate read flat pink. The rim stays up the whole time: stepping in still hurts.
        const k = Math.min(1, Math.max(0, 1 - h.liveLeft / s.liveMs))
        disc.opacity = MOLTEN.opacity[0] + (MOLTEN.opacity[1] - MOLTEN.opacity[0]) * k
        disc.uniforms.uMolten!.value = 1
        ;(disc.uniforms.uHot!.value as THREE.Color).copy(MOLTEN.hot).lerp(COOLED, k)
        ;(disc.uniforms.uDeep!.value as THREE.Color).copy(MOLTEN.crust)
        ring.opacity = MOLTEN.rim * (1 - 0.5 * k)
        this.disc!.scale.setScalar(1)
      }
    } else {
      this.quads[0]!.mesh.renderOrder = order
      this.core!.mesh.renderOrder = order + 0.1
      this.quads[1]!.mesh.renderOrder = order + 0.2
      if (!h.armed) {
        this.railMat!.opacity = s.quiet ? 0 : 0.7
        this.coreMat!.opacity = s.quiet ? 0 : 0.5
        this.wholeMat!.opacity = 0
        this.core!.set(0, 0, 0, 0, Math.max(0.001, this.len * fill), this.halfW * 0.6, 0.004)
      } else {
        // burning: layered like a rushing lane (wash, core, rails), so its texture reads and it's never a flat slab
        const live = h.liveLeft > 0 || flashing
        if (live) this.core!.set(0, 0, 0, 0, this.len, this.halfW * 0.6, 0.004)
        for (const [m, at] of [[this.wholeMat!, LIVE.wash], [this.coreMat!, LIVE.core], [this.railMat!, LIVE.rails]] as const) {
          m.opacity = live ? at : Math.max(0, m.opacity - dt * 5)
        }
      }
      const beamOn = h.armed && h.sinceArm <= s.liveMs + BEAM_EXTRA_MS
      this.beamMat!.opacity = beamOn ? 1 : Math.max(0, this.beamMat!.opacity - dt * 6)
    }
    this.show()
  }

  /** The arm: everything at full for a beat. */
  private flash() {
    if (this.spec.shape.kind === 'circle') {
      this.ringMat!.opacity = 0.95
      this.discMat!.opacity = 0.8
      this.disc!.scale.setScalar(1)
    } else {
      this.core!.set(0, 0, 0, 0, this.len, this.halfW * 0.6, 0.004)
      this.wholeMat!.opacity = LIVE.wash
      this.coreMat!.opacity = LIVE.core
      this.railMat!.opacity = LIVE.rails
      this.beamMat!.opacity = 1
    }
  }

  /** Nothing at 0 is drawn: a finished tell costs no draw calls while it waits to go. */
  private show() {
    const lit = (m: THREE.Mesh) => (m.material as THREE.Material).opacity > 0.002
    for (const m of this.meshes) m.visible = lit(m)
  }

  dispose() {
    this.shell?.removeFromParent()
    for (const m of this.shellMats) m.dispose()
    for (const q of this.quads) q.dispose()
    for (const g of this.geos) g.dispose()
    for (const m of this.mats) releaseTell(m)
  }
}
