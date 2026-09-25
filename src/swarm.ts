import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, haloTexture, tellOrder } from './vfx'
import {
  slide, disposeBody, PLAYER_RADIUS, BODY, JOINT, CORE, CORE_ASLEEP, SLEEP_BODY, RIME,
  type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase,
} from './enemy'
import type { Terrain } from './terrain'
import type { EliteMod, Pack } from './combat'

/**
 * The swarm: swarf mites, small iron ticks with an ember on their backs, and the
 * brood, the one mind of a pack of them. The brood keeps four biters circling
 * close and the rest circling wide, and when enough of the close ones have a line
 * it rings the floor where Still is going and bites there, all at once. One ring,
 * one bite: however many mites there are, it's one thing to read.
 *
 *   gather   inner ring at 1.8, outer at 5.5, turning opposite ways
 *   windup   550 ms: a ring at L (where he'll be), in as many pieces as there are biters
 *   strike   150 ms lunge; the bite is decided on the 550 tick
 *   recover  800 ms: the biters sit in a clump. The punish window.
 */
export const MITE = {
  hp: 8,
  bodyRadius: 0.3,
  speed: 4.8,
  /** Beyond this (or with no line to the target) it streams with nextStep instead of taking its slot. */
  farDist: 6,
  streamPad: 0.3,
}

export const BROOD = {
  /** Biters around Still, summed over every awake brood: the swarm's damage cap doesn't grow with swarms. */
  innerMax: 4,
  perBrood: 4,
  innerR: 1.8,
  /** Beyond every nova's reach (Vent 4.1, Backdraft 5.0): only the inner four are ever exposed at once. */
  outerR: 5.5,
  /** rad/s. Two rings turning opposite ways read as two rings, not a cloud. */
  spinIn: 0.5,
  spinOut: -0.3,
  /** An outer mite takes an empty inner slot after this. */
  refillMs: 500,
  /** Inner mites this close to the target, with a line, may surge. */
  surgeRange: 2.6,
  need: 3,
  windupMs: 550,
  /** The ring is laid where he'll be: his velocity × this, at most leadMax from him. */
  lead: 0.45,
  leadMax: 2.5,
  /** Still's centre within this of L on the 550 tick is bitten. */
  ringR: 1.0,
  /** A biter further than this from L leaves the surge. */
  biteReach: 2.8,
  /** Per biter, one melee: 3 / 6 / 9 / 12. */
  bite: 3,
  strikeMs: 150,
  lungeMax: 2.8,
  /** Biters land this far from L, each on its own side: a clump, not a pile. */
  clumpR: 0.45,
  recoverMs: 800,
  regroupMs: 500,
  /** An inner mite flung (sliding) further than this from the target drops to the outer ring. */
  demoteDist: 4.0,
  /** Asleep, a nest: mites this far apart within nestR of the spot. */
  nestR: 1.4,
  nestGap: 0.6,
  wakeRippleMs: 150,
  /** Each brood's cores beat together, out of step with other broods: + heartStep × (index mod 3). */
  heartHz: 1.1,
  heartStep: 0.25,
  packSolo: 8,
  packMixed: 6,
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
/** Radians of ring a mite walks toward its slot at a time: the chord stays near the ring. */
const ORBIT_STEP = 0.35

type Rig = Record<'body' | 'shell' | 'belly' | 'core' | 'halo' | 'jawL' | 'jawR' | 'legsL' | 'legsR', THREE.Object3D>
type Role = 'outer' | 'inner' | 'surge' | 'spent'

const CORE_C = new THREE.Color(CORE)
const CORE_OFF = new THREE.Color(CORE_ASLEEP)
/** A surging core runs from ember to this over the 550 ms: hot, never white. */
const SURGE_HOT = new THREE.Color(0xffc890)
const HALO_C = new THREE.Color(0xff7850)
const HALO = 0.4
const WHITE = new THREE.Color(0xffffff)
/**
 * A dome faces straight up into Grace's light, where the hulk's sides turn away
 * from it: at the hulk's red-brown a mite tone-mapped to a pink beetle. Matte, and
 * most of the way to the joints' neutral iron, it's dark metal, and the ember on
 * its back is what you see and count.
 */
const BODY_C = new THREE.Color(BODY).lerp(new THREE.Color(JOINT), 0.75)
const JOINT_C = new THREE.Color(JOINT)

/**
 * One mite. It's a whole Enemy (autos, bolts, parts and marks work per body), but
 * it doesn't think: the brood gives it a role and a slot and sets its phases.
 * Its group is a rig of empty nodes; the MiteBatch draws every mite in 8 calls.
 */
export class Mite implements Enemy {
  readonly kind = 'swarm'
  get radius() { return MITE.bodyRadius * this.size }
  readonly labelY = 1.1
  readonly height = 0.35
  readonly windupMs = BROOD.windupMs
  readonly group = new THREE.Group()
  /** Empty: the brood draws the ring. */
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  readonly knock = new THREE.Vector3()
  hp = MITE.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  rime = 0
  air = 0
  /** Mites never step: the brood's skitter stream is their sound. */
  readonly walking = false
  readonly gait = 0
  brood!: Brood
  role: Role = 'outer'
  /** ms waited for an inner slot. */
  refill = 0
  readonly slot = new THREE.Vector3()
  staggered = false
  queen = false
  /** A Quick queen: her whole brood is fast (speedMul), and she scuttles faster. */
  quick = false
  /** ms in the current phase. */
  t = 0
  readonly lungeFrom = new THREE.Vector3()
  readonly lungeTo = new THREE.Vector3()
  flash = 0
  private bob = Math.random() * 10
  readonly seed = Math.random()
  asleep = true
  /** ms until its core lights, on waking: the ripple out from the nest's centre. */
  wakeDelay = 0
  /** It just stopped sliding: the run puffs one dust. */
  landed = false
  /** Walking this tick (the skitter counts these). */
  moving = false
  face = 0
  /** A broken surge: the core goes dark for a moment. */
  blinkT = 0
  /** Warded by its Warden: an iron lid over its ember. Set by Combat while the Warden stands. */
  sealed = false
  /** Seconds its seal still holds after the Warden fell: the lights come back in a ripple. */
  unsealT = 0
  /** The brood-mother's own body: a lit sac, a ridge of spines, and a glow. Null for the rest. */
  private extras: { sac: THREE.Mesh; sacMat: THREE.MeshBasicMaterial; spineMat: THREE.MeshStandardMaterial; glow: THREE.Sprite } | null = null
  /** Seconds alive, for breathing and the jaws' flutter. */
  private life = Math.random() * 10
  readonly rig: Rig
  private readonly waypoint = new THREE.Vector3()
  private readonly pose = { y: 0.12, rx: 0, sx: 1, sy: 1, sz: 1, jaw: 0.25, legs: 0 }

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)
    const node = (px: number, py: number, pz: number) => {
      const o = new THREE.Object3D()
      o.position.set(px, py, pz)
      return o
    }
    const body = node(0, 0.12, 0)
    this.rig = {
      body,
      shell: node(0, 0, 0),
      belly: node(0, -0.02, 0),
      core: node(0, 0.155, -0.04),
      halo: node(0, 0.2, -0.04),
      jawL: node(-0.07, 0, 0.3),
      jawR: node(0.07, 0, 0.3),
      legsL: node(-0.18, 0, 0),
      legsR: node(0.18, 0, 0),
    }
    const r = this.rig
    body.add(r.shell, r.belly, r.core, r.halo, r.jawL, r.jawR, r.legsL, r.legsR)
    this.group.add(body)
  }

  update(dt: number, _target: THREE.Vector3, terrain: Terrain, _ctx: EnemyCtx): EnemyAction | null {
    this.t += dt * 1000
    this.life += dt
    this.flash = Math.max(0, this.flash - dt * 6)
    this.wakeDelay = Math.max(0, this.wakeDelay - dt * 1000)
    this.blinkT = Math.max(0, this.blinkT - dt)
    this.unsealT = Math.max(0, this.unsealT - dt)
    const wasSliding = this.staggered
    this.staggered = slide(this.pos, this.knock, dt)
    if (wasSliding && !this.staggered) this.landed = true
    // the brood's target, never the per-enemy one: one mind picks Still or the decoy for all of them
    const T = this.brood.T
    this.moving = false
    if (this.phase === 'approach' && !this.staggered) {
      const dT = dist(T, this.pos)
      const far = dT > MITE.farDist || !terrain.lineClear(this.pos.x, this.pos.z, T.x, T.z, MITE.streamPad)
      // in orbit it walks round its ring to the slot, never across: a chord through the middle
      // would carry the outer ring through a Vent's reach
      const goal = far ? T : this.arcToward(T)
      const to = far || !terrain.lineClear(this.pos.x, this.pos.z, goal.x, goal.z, this.radius)
        ? terrain.nextStep(this.pos.x, this.pos.z, goal.x, goal.z, this.radius)
        : goal
      const sx = to.x - this.pos.x
      const sz = to.z - this.pos.z
      const sd = Math.hypot(sx, sz)
      if (sd > 0.001) {
        // a slow reaches the scuttle, never the crouch or the lunge
        const s = Math.min(sd, MITE.speed * this.speedMul * dt)
        this.pos.x += (sx / sd) * s
        this.pos.z += (sz / sd) * s
      }
      this.moving = sd > 0.05
      // streaming, it faces where it goes; orbiting, it crab-walks facing him
      this.face = far ? Math.atan2(sx, sz) : Math.atan2(T.x - this.pos.x, T.z - this.pos.z)
    }
    if (this.phase === 'strike') {
      // ease-out quartic: most of the distance in the first 50 ms, so the bodies land with the bite
      const k = Math.min(1, this.t / BROOD.strikeMs)
      this.pos.lerpVectors(this.lungeFrom, this.lungeTo, 1 - (1 - k) ** 4)
    }
    terrain.pushOut(this.pos, this.radius)
    this.present(dt)
    return null
  }

  /**
   * A waypoint ORBIT_STEP of arc ahead. It sits out at R / cos(step): always
   * chasing a point on the ring itself would spiral it in to R·cos(step).
   */
  private arcToward(T: THREE.Vector3) {
    const aNow = Math.atan2(this.pos.x - T.x, this.pos.z - T.z)
    const aSlot = Math.atan2(this.slot.x - T.x, this.slot.z - T.z)
    let da = aSlot - aNow
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    if (Math.abs(da) <= ORBIT_STEP) return this.slot
    const a = aNow + Math.sign(da) * ORBIT_STEP
    const R = dist(this.slot, T) / Math.cos(ORBIT_STEP)
    return this.waypoint.set(T.x + Math.sin(a) * R, 0, T.z + Math.cos(a) * R)
  }

  /** Parry, or a grab: a crouching biter leaves the surge. The brood notices on its next tick. */
  interrupt() {
    if (this.phase !== 'windup') return false
    this.phase = 'approach'
    this.role = 'inner'
    this.t = 0
    this.blinkT = 0.2
    return true
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.phase = 'approach'
    this.t = 0
    if (!asleep) this.flash = 1
  }

  /**
   * The brood-mother: Combat has made her bigger, and she always takes a biter's seat.
   * A raised sac with its own ember (never her brood's roles), three spines on her
   * ridge, and a glow: in the spent clump she's the bright one, so she's the target.
   */
  setElite(mod: EliteMod) {
    this.queen = true
    this.quick = mod === 'swift'
    const sacMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
    const sac = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), sacMat)
    sac.position.set(0, 0.08, -0.3)
    sac.scale.z = 1.35
    const spineMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })
    const spines = new THREE.Mesh(mergeGeometries([-0.1, 0.02, 0.14].map((z) => new THREE.ConeGeometry(0.03, 0.12, 5).translate(0, 0.17, z)))!, spineMat)
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }))
    glow.position.copy(sac.position)
    this.rig.body.add(sac, spines, glow)
    this.extras = { sac, sacMat, spineMat, glow }
    // Quick: longer legs, and she scuttles faster (the bob)
    if (this.quick) this.rig.legsL.scale.x = this.rig.legsR.scale.x = 1.3
  }

  idle(dt: number, face: THREE.Vector3) {
    this.life += dt
    this.unsealT = Math.max(0, this.unsealT - dt)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.moving = !this.asleep
    this.face = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.present(dt)
  }

  // --- presentation: the rig the batch copies ---

  private present(dt: number) {
    const r = this.rig
    const p = this.pose
    const s = this.t / 1000
    const k = dt > 0 ? Math.min(1, dt * 14) : 1
    this.bob += dt * 12 * (this.queen && this.quick ? 1.3 : 1)
    const g = this.bob * (this.queen && this.quick ? 2.6 : 2)
    const tgt = { y: 0.12, rx: 0, sx: 1, sy: 1, sz: 1, jaw: 0.25, legs: 0 }
    let legsL: number | null = null
    let tremble = 0
    let hop = 0
    let sy: number | null = null
    let yaw = this.face
    let snapJaw = false

    if (this.asleep) {
      // tucked in the nest, breathing out of step with the rest
      tgt.y = 0.06
      tgt.legs = 0.6
      sy = 1 + 0.04 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * 0.4 * this.life + this.seed * 6.28))
    } else if (this.phase === 'approach') {
      if (this.moving) {
        legsL = Math.sin(g) * 0.35
        tgt.y = 0.12 + Math.abs(Math.sin(g)) * 0.02
      }
      yaw += 0.06 * Math.sin(this.bob * 0.7 + this.seed * 6.28)
      tgt.jaw = 0.25 + 0.1 * Math.sin(Math.PI * 2 * 6 * this.life)
    } else if (this.phase === 'windup') {
      const L = this.brood.L
      if (L) yaw = this.face = Math.atan2(L.x - this.pos.x, L.z - this.pos.z)
      if (this.t >= 80) {
        // the crouch: rear up, jaws wide, legs splayed flat, trembling
        tgt.y = this.t >= 450 ? 0.06 : 0.08
        tgt.sx = tgt.sz = 1.1
        tgt.sy = this.t >= 450 ? 0.68 : 0.75
        tgt.rx = -0.3
        tgt.jaw = 0.55
        tgt.legs = -0.3
        tremble = Math.sin(Math.PI * 2 * 40 * s) * 0.01
      }
    } else if (this.phase === 'strike') {
      const u = Math.min(1, this.t / BROOD.strikeMs)
      hop = 4 * 0.35 * u * (1 - u)
      tgt.rx = 0.4
      tgt.jaw = this.t >= 50 ? 0.05 : 0.55
      snapJaw = this.t >= 50
    } else if (this.phase === 'recover') {
      // the clump, panting: flattened, jaws shut, still
      sy = 0.8 + 0.03 * Math.sin(Math.PI * 2 * 3 * s)
      tgt.jaw = 0.05
    }

    p.y += (tgt.y - p.y) * k
    p.sx += (tgt.sx - p.sx) * k
    p.sy += (tgt.sy - p.sy) * k
    p.sz += (tgt.sz - p.sz) * k
    p.jaw = snapJaw ? tgt.jaw : p.jaw + (tgt.jaw - p.jaw) * k
    p.legs += (tgt.legs - p.legs) * k
    // flung: a tumble, one turn over the slide, and it rights itself when it lands
    if (this.staggered) p.rx += dt * 18
    else {
      // back on its feet the short way round
      p.rx = Math.atan2(Math.sin(p.rx), Math.cos(p.rx))
      p.rx += (tgt.rx - p.rx) * k
    }

    r.body.position.set(tremble, p.y, 0)
    r.body.rotation.x = p.rx
    r.body.scale.set(p.sx, sy ?? p.sy, p.sz)
    r.jawL.rotation.y = -p.jaw
    r.jawR.rotation.y = p.jaw
    r.legsL.rotation.z = legsL ?? p.legs
    r.legsR.rotation.z = legsL !== null ? -legsL : -p.legs
    this.group.position.set(this.pos.x, hop, this.pos.z)
    this.group.rotation.y = yaw
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.presentQueen()
  }

  /** Her sac beats with the brood at double depth, swells through the crouch and lets go at the lunge. */
  private presentQueen() {
    const x = this.extras
    if (!x) return
    const swell = this.phase === 'windup' ? 1 + 0.25 * Math.min(1, this.t / BROOD.windupMs) : 1
    x.sac.scale.set(swell, swell, 1.35 * swell)
    const beat = this.phase === 'recover' ? 1 : 0.7 + 0.3 * Math.sin(Math.PI * 2 * (this.brood?.heartHz ?? BROOD.heartHz) * this.life)
    if (this.asleep || this.wakeDelay > 0) x.sacMat.color.copy(CORE_OFF)
    else x.sacMat.color.copy(CORE_C).multiplyScalar(beat)
    x.glow.material.opacity = this.asleep ? 0 : 0.9 * beat
    x.glow.scale.setScalar(0.8 * swell)
    x.spineMat.color.copy(this.jointColor(new THREE.Color()))
  }

  /** Sealed by a standing Warden, or its seal still breaking: the ember is lidded. */
  get isSealed() { return this.sealed || this.unsealT > 0 }

  /** Shell colour: rust, dimmed asleep, frosted, shaded in the air, and the hit flash over it all. */
  shellColor(out: THREE.Color) {
    out.copy(BODY_C)
    if (this.asleep) out.multiply(SLEEP_BODY)
    if (this.rime > 0) out.lerp(RIME, this.rime * 0.2)
    if (this.air > 0) out.multiplyScalar(1 - 0.5 * this.air)
    return out.lerp(WHITE, this.flash * 0.85)
  }

  jointColor(out: THREE.Color) {
    out.copy(JOINT_C)
    if (this.asleep) out.multiply(SLEEP_BODY)
    if (this.rime > 0) out.lerp(RIME, this.rime * 0.4)
    if (this.air > 0) out.multiplyScalar(1 - 0.5 * this.air)
    return out
  }

  /** The ember on its back says its role: bright close in, dim far out, hot in a surge, spent after. */
  coreColor(out: THREE.Color, clock: number) {
    if (this.asleep || this.wakeDelay > 0 || this.blinkT > 0) return out.copy(CORE_OFF)
    // an iron lid over the dot: the pack visibly has one light left, and it's the Warden
    if (this.isSealed) return out.copy(JOINT_C)
    const hb = 0.85 + 0.15 * Math.sin(Math.PI * 2 * this.brood.heartHz * clock)
    const surging = this.phase === 'windup'
    if (surging) out.copy(CORE_C).lerp(SURGE_HOT, Math.min(1, this.t / BROOD.windupMs))
    else out.copy(CORE_C).multiplyScalar(this.phase === 'recover' ? 0.3 : this.role === 'outer' ? 0.55 : 1)
    return out.multiplyScalar(hb)
  }

  /** Additive, so its colour is its brightness. 0 while dark. */
  haloColor(out: THREE.Color) {
    if (this.asleep || this.wakeDelay > 0 || this.blinkT > 0 || this.isSealed) return out.setRGB(0, 0, 0)
    const k = this.phase === 'windup' ? 0.9 + 0.1 * Math.min(1, this.t / BROOD.windupMs)
      : this.phase === 'recover' ? 0.15 : this.role === 'outer' ? 0.45 : 0.9
    return out.copy(HALO_C).multiplyScalar(k)
  }

  /** Smaller than the mite (0.54 across): at T's 0.55 the additive glow washed the whole dome ember. */
  get haloScale() {
    return this.phase === 'windup' ? HALO + 0.25 * Math.min(1, this.t / BROOD.windupMs) : HALO
  }

  dispose(scene: THREE.Scene) {
    // the batch draws the body; only the brood-mother's extras are her own
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    disposeBody(this.group)
    this.extras?.glow.material.dispose()
  }
}

// --- the batch: every mite in the level in 8 draw calls ---

function legsGeometry(side: -1 | 1) {
  return mergeGeometries([-0.13, 0, 0.13].map((z, i) => {
    const g = new THREE.BoxGeometry(0.2, 0.03, 0.035)
    g.translate(side * 0.1, 0, 0)
    g.rotateY(-side * [0.35, 0, -0.35][i]!)
    g.translate(0, 0, z)
    // tilted so the outer tips reach the floor
    g.rotateZ(side * -0.5)
    return g
  }))!
}

type Part = 'shell' | 'belly' | 'jawL' | 'jawR' | 'legsL' | 'legsR' | 'core'

/**
 * Draws every mite. Each part is one InstancedMesh; a mite's rig nodes give the
 * matrices, and flash, sleep, frost and role are per-instance colours.
 */
export class MiteBatch {
  static readonly capacity = 32
  private readonly live: Mite[] = []
  private readonly parts: Record<Part, THREE.InstancedMesh>
  private readonly halo: THREE.InstancedMesh
  private readonly meshes: THREE.InstancedMesh[]
  private readonly mtx = new THREE.Matrix4()
  private readonly v = new THREE.Vector3()
  private readonly sc = new THREE.Vector3()
  private readonly c = new THREE.Color()

  constructor(scene: THREE.Scene) {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.3 })
    const jointMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, metalness: 0.5 })
    // cores and halos ignore the fog (the lights-out rule)
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
    const haloMat = new THREE.MeshBasicMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false })
    const shell = new THREE.SphereGeometry(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2)
    shell.scale(1, 0.62, 1.2)
    const jaw = new THREE.BoxGeometry(0.045, 0.04, 0.15)
    jaw.translate(0, 0, 0.07)
    const core = new THREE.SphereGeometry(0.075, 8, 6)
    core.scale(1, 0.6, 1.3)
    const make = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.InstancedMesh(g, m, MiteBatch.capacity)
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      mesh.frustumCulled = false
      mesh.count = 0
      mesh.visible = false
      for (let i = 0; i < MiteBatch.capacity; i++) mesh.setColorAt(i, WHITE)
      scene.add(mesh)
      return mesh
    }
    this.parts = {
      shell: make(shell, shellMat),
      belly: make(new THREE.CylinderGeometry(0.25, 0.21, 0.07, 8), jointMat),
      jawL: make(jaw, jointMat),
      jawR: make(jaw, jointMat),
      legsL: make(legsGeometry(-1), jointMat),
      legsR: make(legsGeometry(1), jointMat),
      core: make(core, coreMat),
    }
    this.halo = make(new THREE.PlaneGeometry(1, 1), haloMat)
    this.halo.renderOrder = 5
    this.meshes = [...Object.values(this.parts), this.halo]
  }

  add(m: Mite) {
    if (!this.live.includes(m)) this.live.push(m)
  }
  remove(m: Mite) {
    const i = this.live.indexOf(m)
    if (i >= 0) this.live.splice(i, 1)
  }
  clear() {
    this.live.length = 0
    this.sync()
  }

  /** Copy every mite's rig into the instances. Once a frame, before the render. */
  sync(camera?: THREE.Camera, clock = 0) {
    let i = 0
    for (const m of this.live) {
      if (i >= MiteBatch.capacity) break
      m.group.updateMatrixWorld(true)
      for (const part of Object.keys(this.parts) as Part[]) this.parts[part].setMatrixAt(i, m.rig[part].matrixWorld)
      // the halo is a billboard: only its position comes from the rig
      m.rig.halo.getWorldPosition(this.v)
      this.mtx.compose(this.v, camera ? camera.quaternion : new THREE.Quaternion(), this.sc.setScalar(m.haloScale * m.size))
      this.halo.setMatrixAt(i, this.mtx)
      this.parts.shell.setColorAt(i, m.shellColor(this.c))
      m.jointColor(this.c)
      for (const part of ['belly', 'jawL', 'jawR', 'legsL', 'legsR'] as const) this.parts[part].setColorAt(i, this.c)
      this.parts.core.setColorAt(i, m.coreColor(this.c, clock))
      this.halo.setColorAt(i, m.haloColor(this.c))
      i++
    }
    for (const mesh of this.meshes) {
      mesh.count = i
      mesh.visible = i > 0
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
  }
}

// --- the bite ring ---

/** One arc per biter: 2π/n less a gap, so the ring comes in as many pieces as there are jaws. */
const ARC_GEO = [1, 2, 3, 4].map((n) => {
  const arc = (Math.PI * 2) / n - 0.35
  return new THREE.RingGeometry(0.88, 1.0, 10, 1, -arc / 2, arc)
})
const DISC_GEO = new THREE.CircleGeometry(1.0, 32)

/**
 * The brood's one tell, on the floor at L. Its pieces point at the biters coming
 * from each side; a biter lost takes its piece with it, so the shape is always
 * the damage. It never shrinks: a closing ring is Still's grammar.
 */
export class BiteRing {
  readonly group = new THREE.Group()
  private readonly arcMat = tellMaterial('radial', 1.0)
  private readonly discMat = tellMaterial('radial', 1.0)
  private readonly arcs: THREE.Mesh[]
  private readonly disc: THREE.Mesh
  private owners: (Mite | null)[] = []
  private bearings: number[] = []
  private readonly at = new THREE.Vector3()
  private stampT = 0
  private struck = false

  constructor(private readonly scene: THREE.Scene) {
    this.arcs = Array.from({ length: 4 }, () => {
      const m = new THREE.Mesh(ARC_GEO[3]!, this.arcMat)
      m.rotation.x = -Math.PI / 2
      m.renderOrder = 2
      return m
    })
    this.disc = new THREE.Mesh(DISC_GEO, this.discMat)
    this.disc.rotation.x = -Math.PI / 2
    this.disc.renderOrder = 1
    this.group.add(this.disc, ...this.arcs)
    this.group.visible = false
    scene.add(this.group)
  }

  /** The surge's first tick: the ring is fixed at L from here, and its arcs stamp. */
  show(L: THREE.Vector3, biters: Mite[]) {
    this.at.copy(L)
    this.group.position.set(L.x, DECAL_Y, L.z)
    this.group.visible = true
    const n = biters.length
    // pieces evenly apart, handed out in bearing order and turned to sit as near each jaw as they can:
    // biters that come in from one side would otherwise merge their arcs, and the count is the read
    const real = biters.map((m) => Math.atan2(m.pos.x - L.x, m.pos.z - L.z))
    const order = [...real.keys()].sort((a, b) => real[a]! - real[b]!)
    const step = (Math.PI * 2) / Math.max(1, n)
    let sx = 0
    let sz = 0
    order.forEach((j, k) => {
      sx += Math.sin(real[j]! - k * step)
      sz += Math.cos(real[j]! - k * step)
    })
    const a0 = Math.atan2(sx, sz)
    this.owners = order.map((j) => biters[j]!)
    this.bearings = order.map((_, k) => a0 + k * step)
    this.arcs.forEach((a, i) => {
      a.visible = i < n
      a.geometry = ARC_GEO[Math.max(0, n - 1)]!
      // a flat circle's rotation.z maps to the floor mirrored: this puts its middle on the bearing
      a.rotation.z = (this.bearings[i] ?? 0) - Math.PI / 2
    })
    this.disc.scale.setScalar(0.001)
    this.stampT = 0
    this.struck = false
  }

  lose(m: Mite) {
    const i = this.owners.indexOf(m)
    if (i < 0) return
    this.arcs[i]!.visible = false
    this.owners[i] = null
  }

  /** Where that biter's arc is: its shards scatter from here. */
  arcPoint(m: Mite): THREE.Vector3 {
    const i = this.owners.indexOf(m)
    const b = i >= 0 ? this.bearings[i]! : Math.atan2(m.pos.x - this.at.x, m.pos.z - this.at.z)
    return new THREE.Vector3(this.at.x + Math.sin(b), 0.15, this.at.z + Math.cos(b))
  }

  strike() {
    this.struck = true
    this.arcMat.opacity = 0.95
    this.discMat.opacity = 0.8
    this.disc.scale.setScalar(1)
  }

  hide() {
    this.arcMat.opacity = 0
    this.discMat.opacity = 0
    this.group.visible = false
  }

  update(dt: number, state: Brood['state'], k: number, order = 0) {
    if (!this.group.visible) return
    // soonest on top: a bite about to land draws over a fainter tell
    this.disc.renderOrder = order
    for (const a of this.arcs) a.renderOrder = order + 0.2
    if (state === 'windup') {
      // the stamp: 0 → 0.9 in 50 ms, settling to 0.7 (it lies in the light at his feet, the brightest
      // floor in the room); the disc fills like the hulk's clock
      this.stampT += dt
      this.arcMat.opacity = this.stampT < 0.05 ? (0.9 * this.stampT) / 0.05 : 0.7 + 0.2 * Math.exp(-(this.stampT - 0.05) * 8)
      this.discMat.opacity = 0.3
      this.disc.scale.setScalar(Math.max(0.001, k))
    } else if (state === 'strike' && this.struck) {
      // held bright through the lunge
    } else {
      this.arcMat.opacity = Math.max(0, this.arcMat.opacity - dt * 4)
      this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
      if (this.arcMat.opacity <= 0 && this.discMat.opacity <= 0) this.group.visible = false
    }
  }

  get visible() {
    return this.group.visible
  }

  dispose() {
    this.scene.remove(this.group)
    releaseTell(this.arcMat)
    releaseTell(this.discMat)
  }
}

// --- the brood ---

type Bite = Extract<EnemyAction, { kind: 'melee' }>
type Decoy = { pos: THREE.Vector3; def: { range: number } } | null

/**
 * The swarm's one mind, one per pack that has mites. Combat ticks it after the
 * packs and before the enemies. It owns the roles, the slots, the surge and the
 * ring, and returns the bite for Combat to resolve.
 */
export class Brood {
  readonly mites: Mite[] = []
  queen: Mite | null = null
  state: 'gather' | 'windup' | 'strike' | 'recover' = 'gather'
  /** ms left in the state. */
  timer = 0
  L: THREE.Vector3 | null = null
  biters: Mite[] = []
  /** Still, or the decoy. */
  readonly T = new THREE.Vector3()
  decoyed = false
  readonly ring: BiteRing
  readonly heartHz: number
  /** Ticked since its last reset: the first awake tick starts from scratch. */
  private active = false

  constructor(readonly pack: Pack, readonly index: number, scene: THREE.Scene) {
    this.ring = new BiteRing(scene)
    this.heartHz = BROOD.heartHz + BROOD.heartStep * (index % 3)
  }

  add(m: Mite) {
    this.mites.push(m)
    m.brood = this
  }
  remove(m: Mite) {
    const i = this.mites.indexOf(m)
    if (i >= 0) this.mites.splice(i, 1)
    if (this.queen === m) this.queen = null
    const b = this.biters.indexOf(m)
    // a biter buried before the brood looked: the ring loses its arc next tick (it's dead)
    if (b >= 0 && !m.dead) this.biters.splice(b, 1)
  }
  get isActive() { return this.active }
  innerCount() { return this.mites.filter((m) => !m.dead && m.role !== 'outer').length }
  movingCount() { return this.mites.filter((m) => !m.dead && m.phase === 'approach' && m.moving).length }
  nearestTo(p: THREE.Vector3) {
    let best = Infinity
    for (const m of this.mites) if (!m.dead) best = Math.min(best, dist(m.pos, p))
    return best
  }

  /** Leaving 'awake', waking, a new level: everyone to the outer ring, no surge, no ring. */
  reset() {
    for (const m of this.mites) {
      m.role = 'outer'
      m.refill = 0
      if (!m.dead) m.phase = 'approach'
    }
    this.state = 'gather'
    this.timer = 0
    this.L = null
    this.biters = []
    this.ring.hide()
    this.active = false
  }

  /** The queen always bites: she takes an inner seat at once, from the farthest orbiting mite of any brood if she must. */
  seatQueen(cap: { used: number }, awake: Brood[]) {
    const q = this.queen
    if (!q || q.dead || q.role !== 'outer' || !this.active) return
    if (cap.used >= BROOD.innerMax) {
      const victim = awake.flatMap((b) => b.mites)
        .filter((m) => !m.dead && !m.queen && m.role === 'inner' && m.phase === 'approach')
        .sort((a, b) => dist(b.pos, b.brood.T) - dist(a.pos, a.brood.T))[0]
      // everyone's mid-surge: she waits a tick
      if (!victim) return
      victim.role = 'outer'
      victim.refill = 0
      cap.used--
    }
    q.role = 'inner'
    q.refill = 0
    cap.used++
  }

  tick(dt: number, terrain: Terrain, ctx: EnemyCtx, cap: { used: number }, decoy: Decoy): Bite | null {
    if (!this.active) {
      // the first tick awake: roles from scratch, and the cores light out from the nest
      this.reset()
      this.active = true
      this.rippleWake()
    }
    const ms = dt * 1000
    const alive = this.mites.filter((m) => !m.dead && !ctx.held(m))
    if (!alive.length) {
      // the last of them is in the clamp's throw (or dying): whatever surge was on is over
      if (this.state !== 'gather') {
        for (const m of this.biters) {
          ctx.emit({ kind: 'biterLost', brood: this, mite: m, why: m.dead ? 'dead' : 'flung', arc: this.ring.arcPoint(m) })
          if (!m.dead) {
            m.phase = 'approach'
            m.role = 'inner'
          }
        }
        this.biters = []
        this.L = null
        this.ring.hide()
        this.state = 'gather'
        this.timer = BROOD.regroupMs
      }
      return null
    }

    // 1. one target for all of them: the decoy if any of them is in its range, else Still
    this.decoyed = !!decoy && alive.some((m) => dist(m.pos, decoy.pos) <= decoy.def.range)
    this.T.copy(this.decoyed ? decoy!.pos : ctx.player)
    const dT = (m: Mite) => dist(m.pos, this.T)

    // 2. the flung drop to the outer ring; never the queen, never a biter mid-surge
    for (const m of alive) {
      if (m.role === 'inner' && m !== this.queen && m.phase === 'approach' && m.staggered && dT(m) > BROOD.demoteDist) {
        m.role = 'outer'
        m.refill = 0
        cap.used--
      }
    }

    // 3. promotion: nearest first, after refillMs, inside both caps
    const innerN = alive.filter((m) => m.role !== 'outer').length
    const room = Math.min(Math.min(BROOD.perBrood, alive.length) - innerN, BROOD.innerMax - cap.used)
    const cands = alive.filter((m) => m.role === 'outer').sort((a, b) => dT(a) - dT(b))
    cands.forEach((m, k) => {
      if (k >= room) {
        m.refill = 0
        return
      }
      m.refill += ms
      if (m.refill >= BROOD.refillMs && cap.used < BROOD.innerMax) {
        m.role = 'inner'
        m.refill = 0
        cap.used++
      }
    })

    // 4. slots by bearing, so nobody crosses the middle (through a Vent) to reach one
    this.place(alive.filter((m) => m.role === 'inner' && m.phase === 'approach'), BROOD.innerR, BROOD.spinIn * dt, terrain)
    this.place(alive.filter((m) => m.role === 'outer'), BROOD.outerR, BROOD.spinOut * dt, terrain)

    // 5. the surge
    this.timer -= ms
    let bite: Bite | null = null
    switch (this.state) {
      case 'gather': {
        if (this.timer > 0) break
        const inner = alive.filter((m) => m.role !== 'outer')
        const near = inner
          .filter((m) => m.phase === 'approach' && !m.staggered && dT(m) <= BROOD.surgeRange && terrain.lineClear(m.pos.x, m.pos.z, this.T.x, this.T.z, 0.2))
          .sort((a, b) => dT(a) - dT(b))
        const need = Math.min(BROOD.need, inner.length)
        // its ring is fixed from the start, so its lock is now: booked like any other
        if (near.length === 0 || near.length < need || !ctx.canLock(0)) break
        ctx.book(this, 0)
        let biters = near.slice(0, 4)
        if (this.queen && near.includes(this.queen) && !biters.includes(this.queen)) biters = [...biters.slice(0, 3), this.queen]
        this.L = this.lead(terrain, ctx)
        this.biters = biters
        for (const m of biters) {
          m.phase = 'windup'
          m.role = 'surge'
          m.t = 0
        }
        this.state = 'windup'
        this.timer = BROOD.windupMs
        this.ring.show(this.L, biters)
        ctx.emit({ kind: 'surge', brood: this, at: this.L.clone(), ms: BROOD.windupMs, biters: biters.length })
        break
      }
      case 'windup': {
        const L = this.L!
        for (let i = this.biters.length - 1; i >= 0; i--) {
          const m = this.biters[i]!
          const why = m.dead ? 'dead' : ctx.held(m) ? 'flung' : m.phase !== 'windup' ? 'parry' : dist(m.pos, L) > BROOD.biteReach ? 'flung' : null
          if (!why) continue
          // its piece of the ring goes with it: the shape is always the damage
          const arc = this.ring.arcPoint(m)
          this.ring.lose(m)
          this.biters.splice(i, 1)
          if (!m.dead && m.phase === 'windup') {
            m.phase = 'approach'
            m.role = 'inner'
          }
          ctx.emit({ kind: 'biterLost', brood: this, mite: m, why, arc })
        }
        if (this.biters.length === 0) {
          this.ring.hide()
          this.state = 'gather'
          this.timer = BROOD.regroupMs
          this.L = null
          break
        }
        if (this.timer > 0) break
        // decided on this tick only: each biter still in it with a line to L, and his centre in the ring
        const live = this.biters.filter((m) => terrain.lineClear(m.pos.x, m.pos.z, L.x, L.z, 0.2))
        const n = Math.min(4, live.length)
        const hit = n > 0 && dist(ctx.player, L) <= BROOD.ringR
        ctx.emit({ kind: 'bite', brood: this, at: L.clone(), biters: n, hit })
        if (hit) bite = { kind: 'melee', damage: BROOD.bite * n, source: live[0], tested: true }
        for (const m of this.biters) {
          // each lands on its own side of L: a clump you can cleave
          const bx = m.pos.x - L.x
          const bz = m.pos.z - L.z
          const bd = Math.hypot(bx, bz) || 1
          let tx = L.x + (bx / bd) * BROOD.clumpR
          let tz = L.z + (bz / bd) * BROOD.clumpR
          const ld = Math.hypot(tx - m.pos.x, tz - m.pos.z)
          if (ld > BROOD.lungeMax) {
            tx = m.pos.x + ((tx - m.pos.x) / ld) * BROOD.lungeMax
            tz = m.pos.z + ((tz - m.pos.z) / ld) * BROOD.lungeMax
          }
          const to = terrain.clampMove(m.pos.x, m.pos.z, tx, tz, m.radius)
          m.lungeFrom.copy(m.pos)
          m.lungeTo.set(to.x, 0, to.z)
          m.phase = 'strike'
          m.t = 0
        }
        this.ring.strike()
        this.state = 'strike'
        this.timer = BROOD.strikeMs
        break
      }
      case 'strike': {
        if (this.timer > 0) break
        for (const m of this.biters) {
          if (m.dead) continue
          m.phase = 'recover'
          m.role = 'spent'
          m.t = 0
        }
        ctx.emit({ kind: 'landed', brood: this, at: this.biters.filter((m) => !m.dead).map((m) => m.pos.clone()) })
        this.state = 'recover'
        this.timer = BROOD.recoverMs
        break
      }
      case 'recover': {
        if (this.timer > 0) break
        // the cores flick back in one frame
        for (const m of this.biters) {
          if (m.dead) continue
          m.phase = 'approach'
          m.role = 'inner'
          m.t = 0
        }
        this.biters = []
        this.L = null
        this.state = 'gather'
        this.timer = BROOD.regroupMs
        break
      }
    }
    const toBite = this.state === 'windup' ? Math.max(0, this.timer) : 0
    this.ring.update(dt, this.state, this.state === 'windup' ? 1 - toBite / BROOD.windupMs : 1, tellOrder(toBite))
    return bite
  }

  /** Where the ring goes: where he's heading, 0.45 s on, never more than 2.5 u out, never in a wall. No lead on a decoy. */
  private lead(terrain: Terrain, ctx: EnemyCtx): THREE.Vector3 {
    if (this.decoyed) return this.T.clone()
    let lx = this.T.x + ctx.playerVel.x * BROOD.lead
    let lz = this.T.z + ctx.playerVel.z * BROOD.lead
    const d = Math.hypot(lx - this.T.x, lz - this.T.z)
    if (d > BROOD.leadMax) {
      lx = this.T.x + ((lx - this.T.x) / d) * BROOD.leadMax
      lz = this.T.z + ((lz - this.T.z) / d) * BROOD.leadMax
    }
    const c = terrain.clampMove(this.T.x, this.T.z, lx, lz, PLAYER_RADIUS)
    const L = new THREE.Vector3(c.x, 0, c.z)
    terrain.pushOut(L, PLAYER_RADIUS)
    return L
  }

  /** Slots round the target, handed out in bearing order and turning; a slot in a wall is pulled in toward the target. */
  private place(list: Mite[], R: number, spin: number, terrain: Terrain) {
    if (!list.length) return
    const bearing = (m: Mite) => Math.atan2(m.pos.x - this.T.x, m.pos.z - this.T.z)
    list.sort((a, b) => bearing(a) - bearing(b))
    const a0 = bearing(list[0]!) + spin
    list.forEach((m, i) => {
      const a = a0 + (i * Math.PI * 2) / list.length
      m.slot.set(this.T.x + Math.sin(a) * R, 0, this.T.z + Math.cos(a) * R)
      if (terrain.blocked(m.slot.x, m.slot.z, m.radius)) {
        const c = terrain.clampMove(this.T.x, this.T.z, m.slot.x, m.slot.z, m.radius)
        m.slot.set(c.x, 0, c.z)
      }
    })
  }

  /** Cores light from the nest's centre outward: the first sign there's one mind. */
  private rippleWake() {
    const homes = this.mites.map((m) => this.pack.homes.get(m) ?? m.pos)
    const cx = homes.reduce((a, h) => a + h.x, 0) / Math.max(1, homes.length)
    const cz = homes.reduce((a, h) => a + h.z, 0) / Math.max(1, homes.length)
    for (const m of this.mites) m.wakeDelay = BROOD.wakeRippleMs * Math.min(1, Math.hypot(m.pos.x - cx, m.pos.z - cz) / BROOD.nestR)
  }

  dispose() {
    this.ring.dispose()
  }
}
