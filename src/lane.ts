import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell } from './vfx'

/**
 * A lane on the floor: what a body that runs in a straight line will cover.
 * One honest rule, whoever draws it: the rails sit exactly where Still's centre
 * starts being hit, the length is the real run (cut at the first solid), and the
 * end mark says how the run ends. Skid streaks: it stops in the open. A star:
 * it hits something, and is stuck there.
 *
 *   tracking  faint rails only, following; the far end left open
 *   locked    rails snap bright, the wash and end mark appear, the core fills
 *   rush      everything at full, burning off behind the body as it goes
 */

/**
 * The barrier's top (the KayKit barrier stands 1.1): a wall's end mark is drawn up
 * here too, so a wall that hides the floor can't hide it.
 */
export const WALL_TOP = 1.1
export type LaneEnd = 'open' | 'wall' | 'prop'

export interface LaneState {
  stage: 'off' | 'tracking' | 'locked' | 'rush'
  /** The body's centre now: the lane starts under it. */
  x: number
  z: number
  aim: number
  /** Body centre now → body centre where it stops. */
  len: number
  /** The body's own lane (radius + 0.1): the core. */
  coreHalf: number
  /** Where Still's centre is hit (coreHalf + his radius): the rails. */
  hitHalf: number
  /** For the contact point, a body's front past its centre. */
  bodyR: number
  end: LaneEnd
  /** 0..1, the locked core filling toward the rush. */
  fill: number
  /** How far along the original lane `x, z` is now, so the chevrons stay put on the floor as it burns off. */
  from: number
  /** 1, or 0.6 while another tell is locked: the tracking rails give way to what's coming. */
  dim?: number
  /** Soonest on top: the lane's base renderOrder (tellOrder). Its own pieces layer just above it. */
  order?: number
}

/**
 * How bright each piece is, locked and rushing. The rails always carry the hit
 * edge; a wide lane (the Assembler's, 3.14 across) lights its core and wash far
 * less, or it becomes a flat red slab and the texture is lost.
 */
export interface LaneLook {
  wash: [locked: number, rush: number]
  core: [locked: number, rush: number]
  cap: [locked: number, rush: number]
}
const RAM_LOOK: LaneLook = { wash: [0.18, 0.3], core: [0.55, 0.9], cap: [0.18, 0.3] }

/** Floor units per unit of strip uv: the chevrons keep one spacing whatever the length. */
export const UV_LEN = 12
/** The tracking rails stop this short of the end: the aim isn't set yet, so neither is the end. */
const OPEN_END = 0.6
const FADE = 5

/**
 * A few flat quads in one mesh, each laid along a segment. Rewritten in place when
 * the lane moves, so the tell's noise keeps its real-world grain instead of being
 * stretched by a scale.
 */
export class Quads {
  readonly mesh: THREE.Mesh
  private readonly pos: THREE.BufferAttribute
  private readonly uv: THREE.BufferAttribute

  constructor(n: number, mat: THREE.Material) {
    const g = new THREE.BufferGeometry()
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 12), 3)
    this.uv = new THREE.BufferAttribute(new Float32Array(n * 8), 2)
    this.pos.setUsage(THREE.DynamicDrawUsage)
    this.uv.setUsage(THREE.DynamicDrawUsage)
    const index: number[] = []
    for (let i = 0; i < n; i++) index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3)
    g.setAttribute('position', this.pos)
    g.setAttribute('uv', this.uv)
    g.setIndex(index)
    this.mesh = new THREE.Mesh(g, mat)
    // the vertices move every tick; a stale bounding sphere would cull it
    this.mesh.frustumCulled = false
  }

  /** Quad i from (ax, az) to (bx, bz), halfW either side, at height y. `u0` is where its chevrons start. */
  set(i: number, ax: number, az: number, bx: number, bz: number, halfW: number, y = 0, u0 = 0) {
    const len = Math.hypot(bx - ax, bz - az)
    const dx = len > 1e-6 ? (bx - ax) / len : 0
    const dz = len > 1e-6 ? (bz - az) / len : 1
    // across: the right-hand normal, so uv.x runs 0..1 from one edge to the other
    const nx = dz * halfW
    const nz = -dx * halfW
    const p = this.pos.array as Float32Array
    const q = this.uv.array as Float32Array
    const o = i * 12
    p.set([ax - nx, y, az - nz, ax + nx, y, az + nz, bx - nx, y, bz - nz, bx + nx, y, bz + nz], o)
    const u1 = u0 + len / UV_LEN
    q.set([0, u0, 1, u0, 0, u1, 1, u1], i * 8)
    this.pos.needsUpdate = true
    this.uv.needsUpdate = true
  }

  dispose() {
    this.mesh.geometry.dispose()
  }
}

export class LaneTell {
  /** World space: the owner adds it to its tellGroup, which must not move with the body. */
  readonly group = new THREE.Group()

  private readonly railMat = tellMaterial('strip')
  private readonly washMat = tellMaterial('strip')
  private readonly coreMat = tellMaterial('strip')
  private readonly capMat = tellMaterial('radial', 1)
  /** Streaks, spikes and the wall-top bar share one stamp. */
  private readonly markMat = tellMaterial('strip')
  private readonly starMat = tellMaterial('radial', 0.7)
  private readonly mats = [this.railMat, this.washMat, this.coreMat, this.capMat, this.markMat, this.starMat]

  private readonly rails = new Quads(2, this.railMat)
  private readonly wash = new Quads(1, this.washMat)
  private readonly core = new Quads(1, this.coreMat)
  private readonly streaks = new Quads(2, this.markMat)
  private readonly spikes = new Quads(6, this.markMat)
  private readonly bar = new Quads(1, this.markMat)
  private readonly cap: THREE.Mesh
  private readonly star: THREE.Mesh

  private stage: LaneState['stage'] = 'off'
  private readonly look: LaneLook
  /** Seconds since the lock stamped its end mark. */
  private stampT = 0

  constructor(look: LaneLook = RAM_LOOK) {
    this.look = look
    // the half-disc past the end: the lane's tip is as wide as the rails, rounded
    this.cap = new THREE.Mesh(new THREE.CircleGeometry(1, 16, Math.PI, Math.PI), this.capMat)
    this.cap.rotation.x = -Math.PI / 2
    // the half toward the body: a whole disc at the contact would show through past a thin wall
    this.star = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20, 0, Math.PI), this.starMat)
    this.star.rotation.x = -Math.PI / 2
    this.group.add(this.wash.mesh, this.cap, this.core.mesh, this.rails.mesh, this.star, this.streaks.mesh, this.spikes.mesh, this.bar.mesh)
    this.group.visible = false
  }

  update(dt: number, s: LaneState) {
    const was = this.stage
    this.stage = s.stage
    if (s.stage === 'off') {
      // after the rush, a recover, a stop: it fades where it was
      for (const m of this.mats) m.opacity = Math.max(0, m.opacity - dt * FADE)
      this.show()
      return
    }

    this.group.position.set(s.x, DECAL_Y, s.z)
    this.group.rotation.y = s.aim
    // layered bottom to top: the wash, the core over it, the rails and marks over both; the whole
    // lane sits in the crowd by how soon it lands
    const o = s.order ?? 0
    this.wash.mesh.renderOrder = this.cap.renderOrder = o + 0.1
    this.core.mesh.renderOrder = o + 0.2
    this.rails.mesh.renderOrder = this.star.renderOrder = o + 0.3
    for (const q of [this.streaks, this.spikes, this.bar]) q.mesh.renderOrder = o + 0.4
    const len = Math.max(0, s.len)
    const u = s.from / UV_LEN
    const tracking = s.stage === 'tracking'

    // rails: their outer edge is the hit edge
    const railLen = tracking ? Math.max(0, len - OPEN_END) : len
    const rx = s.hitHalf - 0.04
    this.rails.set(0, -rx, 0, -rx, railLen, 0.04, 0.006, u)
    this.rails.set(1, rx, 0, rx, railLen, 0.04, 0.006, u)
    this.wash.set(0, 0, 0, 0, len, s.hitHalf, 0.002, u)
    this.core.set(0, 0, 0, 0, Math.max(0.001, len * Math.min(1, Math.max(0, s.fill))), s.coreHalf, 0.004, u)
    this.cap.position.set(0, 0.002, len)
    this.cap.scale.setScalar(s.hitHalf)

    const open = s.end === 'open'
    if (open) {
      const z0 = Math.max(0, len - 1.2)
      this.streaks.set(0, -0.35, z0, -0.35, len, 0.06, 0.008)
      this.streaks.set(1, 0.35, z0, 0.35, len, 0.06, 0.008)
    } else {
      // the contact point: the body's front, against whatever stops it
      const cz = len + s.bodyR
      this.star.position.set(0, 0.008, cz)
      const spread = [-1.2, -0.72, -0.24, 0.24, 0.72, 1.2]
      spread.forEach((a, i) => {
        // splayed back from the wall toward the body
        const r = Math.PI + a
        this.spikes.set(i, 0, cz, Math.sin(r) * 0.9, cz + Math.cos(r) * 0.9, 0.03, 0.01)
      })
      // a barrier hides the floor right against it: the bar says it again on the wall's top
      this.bar.set(0, 0, cz + 0.25 - 0.06, 0, cz + 0.25 + 0.06, s.coreHalf, WALL_TOP + 0.02 - DECAL_Y)
    }

    let mark = 0
    if (tracking) {
      this.railMat.opacity = 0.3 * (s.dim ?? 1)
      this.washMat.opacity = this.coreMat.opacity = this.capMat.opacity = 0
    } else {
      // the lock frame: everything snaps at once, and the end mark stamps
      if (was === 'tracking' || was === 'off') this.stampT = 0
      else this.stampT += dt
      const rush = s.stage === 'rush'
      this.railMat.opacity = 0.7
      const at = rush ? 1 : 0
      this.washMat.opacity = this.look.wash[at]
      this.coreMat.opacity = this.look.core[at]
      this.capMat.opacity = this.look.cap[at]
      const k = this.stampT + dt
      mark = rush ? 0.9 : k < 0.04 ? (0.9 * k) / 0.04 : 0.6 + 0.3 * Math.exp(-(k - 0.04) * 5)
    }
    this.markMat.opacity = this.starMat.opacity = mark
    this.streaks.mesh.visible = open
    this.spikes.mesh.visible = this.star.visible = !open
    this.bar.mesh.visible = s.end === 'wall'
    this.show()
  }

  /** The tell breaks (a Parry, a trip): every piece goes this frame, its heat broken. */
  break() {
    for (const m of this.mats) m.opacity = 0
    this.stage = 'off'
    this.show()
  }

  dispose() {
    for (const q of [this.rails, this.wash, this.core, this.streaks, this.spikes, this.bar]) q.dispose()
    this.cap.geometry.dispose()
    this.star.geometry.dispose()
    for (const m of this.mats) releaseTell(m)
  }

  /** Nothing at 0 is drawn: an idle lane costs no draw calls. */
  private show() {
    const lit = (m: THREE.Material) => m.opacity > 0.002
    this.rails.mesh.visible = lit(this.railMat)
    this.wash.mesh.visible = lit(this.washMat)
    this.core.mesh.visible = lit(this.coreMat)
    this.cap.visible = lit(this.capMat)
    if (!lit(this.markMat)) this.streaks.mesh.visible = this.spikes.mesh.visible = this.bar.mesh.visible = this.star.visible = false
    this.group.visible = this.mats.some(lit)
  }
}
