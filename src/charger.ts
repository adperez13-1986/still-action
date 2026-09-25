import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { haloTexture, trackingDim, tellOrder } from './vfx'
import {
  slide, statusTint, disposeBody, turn, distToSegment, PLAYER_RADIUS, BODY, JOINT, CORE, CORE_ASLEEP, SLEEP_BODY,
  type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase,
} from './enemy'
import { LaneTell, type LaneEnd } from './lane'
import type { Terrain } from './terrain'
import type { EliteMod } from './combat'

/**
 * The ram: a boiler on four piston legs that runs at you in a straight line.
 * It tracks you, locks, and rushes down a lane drawn to its true width and
 * length. The lane is the whole fight: step off it and it thunders past; put a
 * wall at your back and it buries its face in it, hatch open, for a hit that
 * lands half again as hard.
 *
 *   approach  walk into its band (3.5–8.5), back off when you crowd it
 *   windup    tracking 0–495 ms (the lane follows you), locked 495–900 (it doesn't)
 *   strike    the rush, 18 u/s, one hit, stopped by the first solid
 *   recover   a miss (900), a stun (1200, then 400), a Frost trip (1200)
 */
export const CHARGER = {
  hp: 36,
  bodyRadius: 0.6,
  speed: 3.8,
  backoffSpeed: 3.0,
  /** rad/s, walking, holding and recovering. Never while it winds up: then it faces the lane. */
  turnRate: 5,
  preferMin: 3.5,
  preferMax: 8.5,
  /** Never winds up from further out than this. */
  fireRange: 9.0,
  /** Crowded (backing off) this long, it winds up anyway: hugging it isn't a hiding place. */
  hugMs: 1000,
  windupMs: 900,
  /** 495 ms tracking, 405 ms locked. */
  lockAt: 0.55,
  rushSpeed: 18,
  /** The run's nominal length: clamp(distance + rushExtra, rushMin, rushMax). It carries on past you. */
  rushExtra: 3.5,
  rushMin: 6,
  rushMax: 11,
  /** laneHalf = radius + laneExtra: the body's own lane. */
  laneExtra: 0.1,
  /** "Can I run at you": a solid-mode line with this pad. A breach opens sight, not the floor. */
  bodyLanePad: 0.6,
  /** A rush that hasn't ended by then ends as open (a safety net, never the rule). */
  rushTimeoutMs: 1500,
  /** An open rush eases over its last skidLen, from rushSpeed down to skidSpeed: a skid you can see (133 ms). */
  skidLen: 1.5,
  skidSpeed: 6,
  /** The rush passing this close to Still without hitting him is a near miss. */
  nearMiss: 2.0,
  damage: 14,
  stunMs: 1200,
  /** Damage taken while stunned: the hatch is open. */
  stunMul: 1.5,
  stunRecoverMs: 400,
  missRecoverMs: 900,
  /** Frost Trail: a stop, not a stun. The hatch stays shut. */
  tripRecoverMs: 1200,
  /** After every recover, and on waking. */
  reloadMs: 700,
  /** Trample: a sideways shove, in slide units × the victim's knockMul. No damage. */
  trampleShove: 1.4,
  /** A victim within its radius + this of the swept segment is shouldered aside. */
  trampleReach: 0.7,
  pawMs: [80, 300] as const,
  /** Many: two halves at this size and HP. Hulks split to the same numbers. */
  splitHp: 12,
  splitSize: 0.72,
}

/** Bare iron where it hits things: the plough's lip and the tusks catch Grace's light. */
const WORN = 0x8a6a5a
/** Plated's bare plate: a shade lighter than the body. */
const PLATE = 0x6e5a50
/** The seam's flash at the lock: hot, not white. */
const LOCK_FLASH = new THREE.Color(0xffc49a)
const CORE_C = new THREE.Color(CORE)
const CORE_DIM = new THREE.Color(CORE).multiplyScalar(0.2)
const CORE_OFF = new THREE.Color(CORE_ASLEEP)
const JOINT_C = new THREE.Color(JOINT)
const SEAL_RIM = new THREE.Color(CORE).multiplyScalar(0.4)
const WHITE = new THREE.Color(0xffffff)
const GLOW = new THREE.Color(0.5, 0.42, 0.38)
/** The open firebox at the top of its pulse: hot amber, so the core reads apart from the rust around it. */
const FIRE_HOT = new THREE.Color(0xff8a3c)

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Ease-out-back: overshoots a little and settles. The hatches flying open. */
const backOut = (u: number) => 1 + 2.70158 * (u - 1) ** 3 + 1.70158 * (u - 1) ** 2
/** A 60 ms kick and a 60 ms return. The pawing hoof. */
const tri = (x: number) => (x >= 0 && x <= 60 ? x / 60 : x > 60 && x <= 120 ? 2 - x / 60 : 0)

/** A piece's geometry with its placement baked in, so pieces that share a material and a parent draw as one. */
function baked(g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, frame?: THREE.Matrix4) {
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1)))
  if (frame) g.applyMatrix4(frame)
  return g
}
function merged(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  return g
}

/** Where a stack stands on the boiler's back, leaning back. */
function stackFrame(x: number) {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, 0.38, -0.55), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.35, 0, 0)), new THREE.Vector3(1, 1, 1))
}

interface Stack { x: number; flared: boolean }

/**
 * The boiler and its stacks, merged per material. One stack is a plain ram; a
 * Quick one's flares into an exhaust; a Many has two, one for each of what it
 * will split into.
 */
function hullGeometry(stacks: Stack[]) {
  const shell = [baked(new THREE.CylinderGeometry(0.4, 0.46, 1.25, 12), 0, 0, -0.05, Math.PI / 2)]
  const joint = [
    baked(new THREE.TorusGeometry(0.45, 0.04, 6, 18), 0, 0, -0.45),
    baked(new THREE.TorusGeometry(0.45, 0.04, 6, 18), 0, 0, 0.3),
  ]
  for (const st of stacks) {
    const f = stackFrame(st.x)
    // a flare opening at the mouth: a trumpet reads as exhaust, a taper as a chimney
    if (st.flared) joint.push(baked(new THREE.CylinderGeometry(0.16, 0.08, 0.3, 10), 0, 0.15, 0, 0, f))
    else {
      joint.push(baked(new THREE.CylinderGeometry(0.08, 0.1, 0.34, 8), 0, 0.17, 0, 0, f))
      shell.push(baked(new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10), 0, 0.34, 0, 0, f))
    }
  }
  return { shell: merged(shell), joint: merged(joint) }
}

/** Eased pose: everything the body does is a target it moves toward, or snaps to. */
interface Pose { by: number; brx: number; brz: number; sx: number; sy: number; sz: number; prx: number; pry: number; gz: number; legs: number[]; splay: number }
const REST: Pose = { by: 0.55, brx: 0, brz: 0, sx: 1, sy: 1, sz: 1, prx: 0, pry: 0, gz: 0, legs: [0, 0, 0, 0], splay: 0 }

export class Charger implements Enemy {
  readonly kind = 'charger'
  get radius() { return CHARGER.bodyRadius * this.size }
  /** The body's own lane. */
  get laneHalf() { return this.radius + CHARGER.laneExtra }
  /** Where Still's centre is hit: the rails. */
  get hitHalf() { return this.laneHalf + PLAYER_RADIUS }
  readonly windupMs = CHARGER.windupMs
  /** Where an elite's name floats, before size. Long and low: under the hulk's. */
  readonly labelY = 2.0
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = CHARGER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  size = 1
  readonly height = 1.3
  rime = 0
  air = 0
  private baseKnock = 1
  /** Nothing it carries into a rush moves it: shoves, hooks and Vents all read 0 while it runs. */
  get knockMul() { return this.rushing ? 0 : this.baseKnock }
  set knockMul(v: number) { this.baseKnock = v }
  /** Plated: the plate lifts in a stun, so a stunned Plated ram takes full damage × 1.5. */
  plated = false
  /** Its elite mod, if it leads a pack: the body wears it. */
  elite: EliteMod | null = null
  /** Warded by its Warden: seams and visor go dark, with one dim rim. Set by Combat while the Warden stands. */
  sealed = false
  /** Seconds its seal still holds after the Warden fell: the lights come back in a ripple. */
  unsealT = 0

  // read by Combat, main and the checks
  locked = false
  rushing = false
  stunned = false
  tripped = false
  /** An open rush in its last skidLen: braced, sparking, slowing. */
  skidding = false
  /** The lane's direction: frozen at the lock. */
  aim = 0
  /** Where the body points. Equal to aim from the windup to the end of the rush. */
  facing = 0
  /** ms until it may wind up again. */
  reload = 0
  /** ms spent backing off. */
  hug = 0
  /** ms in the current phase. */
  t = 0
  /** ms the current recover lasts. */
  timer = 0
  /** The lane now: from the body's centre, `len` along `aim`, and how it ends. */
  readonly lane = { x: 0, z: 0, len: 0, nominal: 0, end: 'open' as LaneEnd }
  readonly rushFrom = new THREE.Vector3()
  private readonly endPt = new THREE.Vector3()
  rushLeft = 0
  hitDone = false
  /** Decided at the rush's start: only a rush that ends in the open skids. */
  private skidEase = false
  /** Which side of Still the rush's front was on last tick: the tick it crosses is the pass. */
  private passSign = 0
  /** This tick's swept segment, while rushing: Combat tramples along it. */
  sweep: { ax: number; az: number; bx: number; bz: number } | null = null
  readonly trampled = new Set<Enemy>()
  mode: 'walk' | 'back' | 'hold' = 'hold'
  private pawed = 0
  private staggered = false
  private flash = 0
  private bob = Math.random() * 10
  /** Seconds alive: breathing and pulses. */
  private life = Math.random() * 10
  private asleep = true
  /** Seconds left of the unfold on waking. */
  private wakeT = 0
  /** It woke since the run last asked (a smoke puff from the stack). */
  private woke = false
  /** The seam's white-hot flash at the lock, 1 → 0 over 100 ms. */
  private lockFlash = 0
  readonly laneTell = new LaneTell()

  // --- the rig ---
  private readonly mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.7, metalness: 0.45 })
  private readonly jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })
  private readonly wornMat = new THREE.MeshStandardMaterial({ color: WORN, roughness: 0.5, metalness: 0.6 })
  private readonly plateMat = new THREE.MeshStandardMaterial({ color: PLATE, roughness: 0.5, metalness: 0.55 })
  // its lights ignore the fog (the lights-out rule): lamp, firebox, seams and their glow
  private readonly coreMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
  private readonly fireMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
  private readonly seamMats = Array.from({ length: 5 }, () => new THREE.MeshBasicMaterial({ color: CORE, fog: false }))
  /**
   * Heat over the seam. Additive over lit rust, the halo at full strength washed the
   * whole back flat pink, seams and core included; dimmed, it stays a glow.
   */
  private readonly glowMat = new THREE.MeshBasicMaterial({
    map: haloTexture(), color: GLOW, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0, fog: false,
  })
  /** Visual offsets live here, in the facing frame, never in pos. */
  private readonly grp = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly prow = new THREE.Group()
  private readonly hatchL = new THREE.Group()
  private readonly hatchR = new THREE.Group()
  private readonly firebox: THREE.Mesh
  private readonly glow: THREE.Mesh
  private readonly hull: THREE.Mesh
  private readonly hullJoint: THREE.Mesh
  /** One per stack: where its smoke and embers leave. */
  private mouths: THREE.Object3D[] = []
  /** Plated's side plates, hinged at their top edge: they flare in a stun. */
  private flanks: THREE.Group[] = []
  /** Warden's lamp glow: a sprite, so disposeBody doesn't reach it. */
  private lampGlow: THREE.Sprite | null = null
  /** FL, FR, BL, BR. L is −x. */
  private readonly legs: THREE.Group[] = []
  private readonly pose: Pose = { ...REST, legs: [0, 0, 0, 0] }

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A rusted boiler on its side: narrow end forward, one stack at the back, a
    // plough for a face. From 38° its back is what you see, so the direction lives there.
    // the boiler itself is built by setStacks: an elite may rebuild it with other stacks
    this.hull = new THREE.Mesh(new THREE.BufferGeometry(), this.mat)
    this.hullJoint = new THREE.Mesh(new THREE.BufferGeometry(), this.jointMat)

    // the core lives under the hatch: seen only when it's stuck, and that's when to hit it
    this.firebox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.62), this.fireMat)
    // just clear of the boiler's curve, just under the shut hatch
    this.firebox.position.set(0, 0.44, -0.12)
    this.firebox.visible = false
    for (const [hatch, side] of [[this.hatchL, -1], [this.hatchR, 1]] as const) {
      hatch.position.set(side * 0.3, 0.46, -0.12)
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.045, 0.64), this.jointMat)
      plate.position.x = -side * 0.1
      hatch.add(plate)
    }

    // the spine seam: five segments that fill rear to front as it winds up, an arrow on its back
    const seams = [-0.4, -0.27, -0.14, -0.01, 0.12].map((sz, i) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.11), this.seamMats[i]!)
      m.position.set(0, 0.48, sz)
      return m
    })
    this.glow = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.0), this.glowMat)
    this.glow.rotation.x = -Math.PI / 2
    this.glow.position.set(0, 0.5, -0.14)
    this.glow.visible = false

    this.prow.position.set(0, -0.05, 0.58)
    const plough = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.52, 0.22), this.mat)
    plough.position.z = 0.12
    plough.rotation.x = -0.35
    const edge = new THREE.Mesh(merged([
      baked(new THREE.BoxGeometry(1.0, 0.08, 0.12), 0, -0.26, 0.24),
      baked(new THREE.CylinderGeometry(0.02, 0.07, 0.42, 6), -0.36, -0.08, 0.36, Math.PI / 2 - 0.2),
      baked(new THREE.CylinderGeometry(0.02, 0.07, 0.42, 6), 0.36, -0.08, 0.36, Math.PI / 2 - 0.2),
    ]), this.wornMat)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.03), this.coreMat)
    visor.position.set(0, 0.12, 0.215)
    this.prow.add(plough, edge, visor)

    this.body.position.y = 0.55
    this.body.add(this.hull, this.hullJoint, this.firebox, this.hatchL, this.hatchR, ...seams, this.glow, this.prow)
    this.setStacks([{ x: 0, flared: false }])

    for (const [lx, lz] of [[-0.36, 0.38], [0.36, 0.38], [-0.36, -0.42], [0.36, -0.42]] as const) {
      const leg = new THREE.Group()
      leg.position.set(lx, 0.42, lz)
      const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.26, 8), this.jointMat)
      thigh.position.y = -0.13
      const lower = new THREE.Mesh(merged([
        baked(new THREE.CylinderGeometry(0.08, 0.1, 0.18, 8), 0, -0.3, 0),
        baked(new THREE.BoxGeometry(0.24, 0.1, 0.28), 0, -0.37, 0.04),
      ]), this.mat)
      leg.add(thigh, lower)
      this.legs.push(leg)
      this.grp.add(leg)
    }
    this.grp.add(this.body)
    this.group.add(this.grp)
    this.tellGroup.add(this.laneTell.group)
  }

  /** Rebuild the boiler for a stack layout, and put a mouth at the top of each stack. */
  private setStacks(stacks: Stack[]) {
    const geo = hullGeometry(stacks)
    this.hull.geometry.dispose()
    this.hullJoint.geometry.dispose()
    this.hull.geometry = geo.shell
    this.hullJoint.geometry = geo.joint
    for (const m of this.mouths) this.body.remove(m.parent!)
    this.mouths = stacks.map((st) => {
      const frame = new THREE.Object3D()
      frame.applyMatrix4(stackFrame(st.x))
      const mouth = new THREE.Object3D()
      mouth.position.y = st.flared ? 0.32 : 0.37
      frame.add(mouth)
      this.body.add(frame)
      return mouth
    })
  }

  /** Each mod adds one thing to the body, so the leader reads as different before you read its name. */
  private buildEliteFeature(mod: EliteMod) {
    if (mod === 'swift') this.setStacks([{ x: 0, flared: true }])
    if (mod === 'plated') {
      // bare plates hung down its flanks and over the plough: blockier, and in a stun they flare like a pinecone
      for (const side of [-1, 1]) {
        const pivot = new THREE.Group()
        pivot.position.set(side * 0.46, 0.62, -0.05)
        pivot.add(new THREE.Mesh(merged([-0.35, 0, 0.35].map((z) => baked(new THREE.BoxGeometry(0.05, 0.3, 0.32), 0, -0.15, z))), this.plateMat))
        this.flanks.push(pivot)
        this.body.add(pivot)
      }
      const face = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.46, 0.04), this.plateMat)
      face.position.set(0, 0, 0.24)
      face.rotation.x = -0.35
      this.prow.add(face)
    }
    if (mod === 'splitting') {
      // a dark seam down its length and a stack for each half: two of them, waiting
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.96, 1.9), this.jointMat)
      band.position.set(0, 0.01, -0.05)
      this.body.add(band)
      this.setStacks([{ x: -0.18, flared: false }, { x: 0.18, flared: false }])
    }
    if (mod === 'warding') {
      // a mast with a caged lamp: the tallest light in its pack, the one to go for
      const x = 0.16
      const z = -0.42
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 6), this.jointMat)
      mast.position.set(x, 0.9, z)
      const cage = new THREE.Mesh(merged([[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => baked(new THREE.BoxGeometry(0.02, 0.2, 0.02), a! * 0.08, 0, b! * 0.08))), this.jointMat)
      cage.position.set(x, 1.45, z)
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), this.coreMat)
      lamp.position.set(x, 1.45, z)
      this.lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }))
      this.lampGlow.scale.setScalar(0.5)
      this.lampGlow.position.set(x, 1.45, z)
      this.body.add(mast, cage, lamp, this.lampGlow)
    }
  }

  get walking() { return this.phase === 'approach' && this.mode !== 'hold' && !this.staggered && !this.asleep }
  /** One step per diagonal pair. */
  get gait() { return this.bob * 1.8 }

  // --- world points for effects ---
  private at(o: THREE.Object3D, out: THREE.Vector3, x = 0, y = 0, z = 0) {
    this.group.updateMatrixWorld(true)
    return o.localToWorld(out.set(x, y, z))
  }
  hoof(i: number, out: THREE.Vector3) { return this.at(this.legs[i]!, out, 0, -0.37, 0.04) }
  stackMouth(out: THREE.Vector3, i = 0) { return this.at(this.mouths[i] ?? this.mouths[0]!, out) }
  get stacks() { return this.mouths.length }
  /** Between the front hooves: where a skid grinds. */
  frontMid(out: THREE.Vector3) { return this.at(this.grp, out, 0, 0.05, 0.38) }
  /** Under its belly: where the hooves strike sparks as it runs. */
  hoofMid(out: THREE.Vector3) { return this.at(this.grp, out, 0, 0.05, 0) }
  /** The bottom of a Plated flank: -1 left, 1 right. Null without plates. */
  flankPoint(side: -1 | 1, out: THREE.Vector3) {
    const f = this.flanks[side < 0 ? 0 : 1]
    return f ? this.at(f, out, 0, -0.3, 0) : null
  }
  get isAsleep() { return this.asleep }
  /** True once after it wakes: the run puffs the stack. */
  consumeWake() {
    const w = this.woke
    this.woke = false
    return w
  }
  fireboxPoint(out: THREE.Vector3) { return this.at(this.firebox, out) }
  prowPoint(out: THREE.Vector3) { return this.at(this.prow, out, 0, 0, 0.3) }
  /** Between the back hooves: where a rush kicks off from. */
  rearMid(out: THREE.Vector3) { return this.at(this.grp, out, 0, 0.05, -0.42) }
  laneEnd(out: THREE.Vector3) {
    return out.set(this.lane.x + Math.sin(this.aim) * this.lane.len, 0, this.lane.z + Math.cos(this.aim) * this.lane.len)
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.t += ms
    this.reload -= ms
    this.life += dt
    this.flash = Math.max(0, this.flash - dt * 6)
    this.lockFlash = Math.max(0, this.lockFlash - dt * 10)
    this.wakeT = Math.max(0, this.wakeT - dt)
    this.unsealT = Math.max(0, this.unsealT - dt)
    this.sweep = null
    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.max(0.001, Math.hypot(dx, dz))
    const toward = Math.atan2(dx, dz)
    this.staggered = slide(this.pos, this.knock, dt)
    let action: EnemyAction | null = null

    switch (this.phase) {
      case 'approach': {
        if (this.staggered) {
          this.hug = 0
          break
        }
        // solid mode, never `see`: a breach opens sight, not the floor
        const lane = terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, CHARGER.bodyLanePad)
        if (!lane || dist > CHARGER.preferMax) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
          const sx = to.x - this.pos.x
          const sz = to.z - this.pos.z
          const sd = Math.hypot(sx, sz) || 1
          // a slow reaches the walk and the back-off, never the windup or the rush
          this.pos.x += (sx / sd) * CHARGER.speed * this.speedMul * dt
          this.pos.z += (sz / sd) * CHARGER.speed * this.speedMul * dt
          this.facing = turn(this.facing, Math.atan2(sx, sz), CHARGER.turnRate * dt)
          this.mode = 'walk'
          this.hug = 0
          this.bob += dt * 5
        } else if (dist < CHARGER.preferMin) {
          const s = CHARGER.backoffSpeed * this.speedMul * dt
          const to = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x - (dx / dist) * s, this.pos.z - (dz / dist) * s, this.radius)
          this.pos.x = to.x
          this.pos.z = to.z
          this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)
          this.mode = 'back'
          // counts even pinned against a wall: that's exactly when hugging it must stop working
          this.hug += ms
          this.bob -= dt * 5
        } else {
          this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)
          this.mode = 'hold'
          this.hug = 0
        }
        const inBand = lane && dist >= CHARGER.preferMin && dist <= CHARGER.fireRange
        const hugged = lane && this.hug >= CHARGER.hugMs
        const lockMs = CHARGER.windupMs * CHARGER.lockAt
        if (this.reload <= 0 && (inBand || hugged) && ctx.tokenFree(this) && ctx.canLock(lockMs)) {
          ctx.takeToken(this)
          ctx.book(this, lockMs)
          this.phase = 'windup'
          this.t = 0
          this.locked = false
          this.hug = 0
          this.aim = toward
          this.lane.nominal = clamp(dist + CHARGER.rushExtra, CHARGER.rushMin, CHARGER.rushMax)
          this.pawed = 0
        }
        break
      }
      case 'windup': {
        const lockMs = CHARGER.windupMs * CHARGER.lockAt
        if (!this.locked) {
          this.aim = toward
          this.lane.nominal = clamp(dist + CHARGER.rushExtra, CHARGER.rushMin, CHARGER.rushMax)
        }
        this.facing = this.aim
        // every tick, tracking and locked: a shove moves the lane with the body, honestly
        this.cut(terrain)
        if (!this.locked && this.t >= lockMs) {
          this.locked = true
          this.lockFlash = 1
          ctx.emit({ kind: 'lock', e: this, end: this.laneEnd(new THREE.Vector3()) })
        }
        for (const [k, at] of CHARGER.pawMs.entries()) {
          if (this.pawed === k && this.t >= at) {
            this.pawed++
            ctx.emit({ kind: 'paw', e: this, at: this.hoof(1, new THREE.Vector3()) })
          }
        }
        if (this.t >= CHARGER.windupMs) this.startRush()
        break
      }
      case 'strike':
        action = this.rushTick(dt, terrain, ctx)
        break
      case 'recover': {
        if (this.tripped && this.t <= 250) {
          // a Frost trip spins it a real quarter turn as it goes down
          this.facing += (Math.PI / 2) * dt / 0.25
        } else if (!this.stunned && (this.timer !== CHARGER.missRecoverMs || this.t > 250)) {
          // a miss holds its braced pose 250 ms before it turns to find you
          this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)
        }
        if (this.t >= this.timer) {
          if (this.stunned) {
            this.stunned = false
            this.t = 0
            this.timer = CHARGER.stunRecoverMs
            ctx.emit({ kind: 'stunEnd', e: this })
          } else {
            this.phase = 'approach'
            this.tripped = false
            this.reload = CHARGER.reloadMs
            this.t = 0
          }
        }
        break
      }
    }

    if (!this.rushing) terrain.pushOut(this.pos, this.radius)
    this.present(dt)
    return action
  }

  /**
   * The lane preview and the rush length are one number: the nominal run, cut by
   * the first solid a body this size would meet. One step past the contact, the
   * body's circle says what it met: a Box or the void is a wall, a Circle (crate, column) a prop.
   */
  private cut(terrain: Terrain) {
    const fx = Math.sin(this.aim)
    const fz = Math.cos(this.aim)
    const want = this.lane.nominal
    const end = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + fx * want, this.pos.z + fz * want, this.radius)
    this.lane.x = this.pos.x
    this.lane.z = this.pos.z
    this.lane.len = Math.hypot(end.x - this.pos.x, end.z - this.pos.z)
    if (this.lane.len >= want - 0.05) this.lane.end = 'open'
    else {
      // what the body itself meets one step on: a wide body can hit a crate off its centreline,
      // and a box or the void anywhere in that circle makes it a wall
      this.lane.end = terrain.blocker(end.x + fx * 0.21, end.z + fz * 0.21, this.radius, false) === 'prop' ? 'prop' : 'wall'
    }
  }

  private startRush() {
    this.phase = 'strike'
    this.rushing = true
    this.t = 0
    // committed: nothing it carried in moves it now
    this.knock.set(0, 0, 0)
    this.rushFrom.copy(this.pos)
    this.rushLeft = this.lane.nominal
    this.laneEnd(this.endPt)
    this.hitDone = false
    this.trampled.clear()
    this.passSign = 0
    // decided once: a rush that ends in something stops dead, only one in the open skids
    this.skidEase = this.lane.end === 'open'
  }

  private rushTick(dt: number, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const fx = Math.sin(this.aim)
    const fz = Math.cos(this.aim)
    // the last 1.5 u of an open rush ease down to 6 u/s: long enough to see it skid.
    // It starts 2 u past where Still was at the lock, so contact timing never changes.
    const easing = this.skidEase && this.rushLeft < CHARGER.skidLen
    if (easing && !this.skidding) {
      this.skidding = true
      ctx.emit({ kind: 'skid', e: this })
    }
    const v = easing ? CHARGER.skidSpeed + (CHARGER.rushSpeed - CHARGER.skidSpeed) * (this.rushLeft / CHARGER.skidLen) : CHARGER.rushSpeed
    const step = Math.min(this.rushLeft, v * dt)
    const ax = this.pos.x
    const az = this.pos.z
    const nx = ax + fx * step
    const nz = az + fz * step
    const free = terrain.clampMove(ax, az, nx, nz, this.radius)
    const blocked = Math.hypot(free.x - nx, free.z - nz) > 0.05
    this.pos.x = free.x
    this.pos.z = free.z
    this.rushLeft -= Math.hypot(free.x - ax, free.z - az)
    this.sweep = { ax, az, bx: free.x, bz: free.z }
    // burn-off: the lane starts at the body and shrinks to what's left
    this.lane.x = free.x
    this.lane.z = free.z
    this.lane.len = Math.max(0, (this.endPt.x - free.x) * fx + (this.endPt.z - free.z) * fz)

    // it tests the real Still, never the decoy: if his feet are on the lane, he's hit. Once a rush.
    let action: EnemyAction | null = null
    const p = ctx.player
    const along = (p.x - this.rushFrom.x) * fx + (p.z - this.rushFrom.z) * fz
    if (!this.hitDone && along >= 0 && distToSegment(p.x, p.z, ax, az, free.x, free.z) <= this.hitHalf) {
      this.hitDone = true
      action = { kind: 'melee', damage: CHARGER.damage, source: this, tested: true }
    }
    // the near miss: the tick its front passes him, close, without having hit him
    const ahead = (p.x - free.x) * fx + (p.z - free.z) * fz
    const lateral = Math.abs((p.x - free.x) * fz - (p.z - free.z) * fx)
    if (!this.hitDone && this.passSign > 0 && ahead <= 0 && lateral <= CHARGER.nearMiss) ctx.emit({ kind: 'nearMiss', e: this, at: p.clone() })
    this.passSign = Math.sign(ahead)

    if (blocked) {
      const at = new THREE.Vector3(free.x + fx * this.radius, 0.4, free.z + fz * this.radius)
      this.enterStun()
      // Combat smashes a breakable at `at` before anyone else hears of it
      ctx.emit({ kind: 'rushEnd', e: this, how: 'wall', at })
    } else if (this.rushLeft <= 0.001 || this.t >= CHARGER.rushTimeoutMs) {
      this.endRush(CHARGER.missRecoverMs)
      ctx.emit({ kind: 'rushEnd', e: this, how: 'open', at: this.pos.clone() })
    }
    return action
  }

  private endRush(recoverMs: number) {
    this.rushing = false
    this.skidding = false
    this.phase = 'recover'
    this.t = 0
    this.timer = recoverMs
  }

  /** Into a wall, a crate or an Anvil: stuck, hatch open, ×1.5. Public for dev checks. */
  enterStun() {
    this.endRush(CHARGER.stunMs)
    this.stunned = true
  }

  /** Frost Trail: it goes down on the strip. A stop, not a stun: the hatch stays shut. */
  trip(): boolean {
    if (!this.rushing) return false
    this.endRush(CHARGER.tripRecoverMs)
    this.tripped = true
    this.laneTell.break()
    return true
  }

  /** The Anvil caught it: the counter already landed, now it's stuck on the clamp. */
  stopRush(): boolean {
    if (!this.rushing) return false
    this.enterStun()
    return true
  }

  /** Parry, or a grab: only a windup breaks. A rush is committed. */
  interrupt() {
    if (this.phase !== 'windup') return false
    this.phase = 'approach'
    this.t = 0
    this.locked = false
    this.reload = CHARGER.reloadMs
    this.laneTell.break()
    // the flinch: head snaps back, eased from there
    this.pose.prx = -0.2
    return true
  }

  hit(damage: number): boolean {
    const stun = this.stunned ? CHARGER.stunMul * (this.plated ? 2 : 1) : 1
    this.hp -= damage * this.armor * stun
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  setAsleep(asleep: boolean) {
    if (this.asleep && !asleep) this.woke = true
    this.asleep = asleep
    if (!asleep) {
      this.flash = 1
      // no rush on the wake frame: it unfolds first
      this.reload = CHARGER.reloadMs
      this.wakeT = 0.25
    }
    this.phase = 'approach'
    this.t = 0
    this.locked = false
    this.rushing = false
    this.skidding = false
    this.stunned = false
    this.tripped = false
  }

  setElite(mod: EliteMod) {
    this.elite = mod
    if (mod === 'plated') this.plated = true
    this.buildEliteFeature(mod)
  }

  idle(dt: number, face: THREE.Vector3) {
    this.flash = Math.max(0, this.flash - dt * 6)
    this.life += dt
    this.unsealT = Math.max(0, this.unsealT - dt)
    this.wakeT = Math.max(0, this.wakeT - dt)
    const to = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.facing = this.asleep ? to : turn(this.facing, to, CHARGER.turnRate * dt)
    // walking home, or carried in the clamp's throw
    if (!this.asleep) this.bob += dt * 5
    this.staggered = false
    this.present(dt)
  }

  // --- presentation ---

  private present(dt: number) {
    const s = this.t / 1000
    const tw = this.t
    const p = this.pose
    const tgt: Pose = { ...REST, legs: [0, 0, 0, 0] }
    // a zero-dt idle (just placed) lands on its pose instead of easing into it
    let k = dt > 0 ? Math.min(1, dt * 14) : 1
    let snap = false
    const g = this.bob * 1.8
    const stride = Math.sin(g) * 0.4
    // set straight after the easing: oscillations, pulses, the impact's spring
    const over: Partial<Record<'brx' | 'brz' | 'sx' | 'sy' | 'sz' | 'pry', number>> = {}
    const legs: (number | null)[] = [null, null, null, null]
    const walkLegs = () => { legs[0] = legs[3] = stride; legs[1] = legs[2] = -stride }
    let gx = 0
    let gy = 0
    let hatch = 0
    let fire = 1
    let heat = 0
    let glow = Math.max(0, this.glowMat.opacity - dt * 4)
    const seam: THREE.Color[] = Array.from({ length: 5 }, () => CORE_DIM)
    const skidPose = () => {
      tgt.brx = -0.18
      tgt.prx = -0.05
      tgt.legs = [-0.6, -0.6, 0.3, 0.3]
    }
    const seamFade = () => {
      const c = CORE_C.clone().lerp(CORE_DIM, Math.min(1, tw / 300))
      for (let i = 0; i < 5; i++) seam[i] = c
    }

    if (this.asleep) {
      // belly on the floor, legs folded, chin down, breathing slow
      tgt.by = 0.4
      tgt.brx = 0.06
      tgt.legs = [1.1, 1.1, -1.1, -1.1]
      tgt.prx = 0.3
      over.sy = 1 + 0.02 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * 0.3 * this.life))
      glow = 0
    } else if (this.phase === 'approach') {
      if (this.mode === 'hold') {
        over.sy = 1.01 + 0.01 * Math.sin(Math.PI * 2 * 0.8 * this.life)
      } else {
        // a trot in diagonal pairs; played backward while it backs off, head low, watching
        walkLegs()
        over.brz = Math.sin(g) * 0.04
        over.pry = Math.sin(this.bob * 0.9) * 0.05
        gy = Math.abs(Math.sin(g)) * 0.04
        if (this.mode === 'back') tgt.prx = 0.1
      }
      if (this.staggered) tgt.brx = -0.15
    } else if (this.phase === 'windup') {
      tgt.brx = 0.12
      tgt.by = 0.47
      if (!this.locked) {
        tgt.prx = 0.1
        // pawing: the front-right hoof scrapes twice; a shiver that grows toward the lock
        legs[1] = -0.6 * tri(tw - 80) - 0.6 * tri(tw - 300)
        gx = Math.sin(s * 60) * 0.01 * (tw / 495)
        for (let i = 0; i < 5; i++) seam[i] = tw >= (i + 1) * 99 ? CORE_C : CORE_DIM
        glow = 0.35 * Math.min(1, tw / 495)
      } else {
        // locked: head down, coiled, rocked back on its haunches, still but for a shiver
        snap = this.lockFlash > 0.99
        tgt.prx = 0.28
        tgt.sx = 1.02
        tgt.sy = 1.04
        tgt.sz = 0.94
        tgt.gz = -0.08
        tgt.legs = [0, 0, -0.35, -0.35]
        gx = Math.sin(Math.PI * 2 * 30 * s) * 0.012
        const c = CORE_C.clone().lerp(LOCK_FLASH, this.lockFlash)
        for (let i = 0; i < 5; i++) seam[i] = c
        glow = 0.8
      }
    } else if (this.skidding) {
      // braced: front legs dug in ahead, rear sat down, head up
      snap = true
      skidPose()
      for (let i = 0; i < 5; i++) seam[i] = CORE_C
      glow = 0.8
    } else if (this.phase === 'strike') {
      const h = Math.sin(Math.PI * 2 * 14 * s) * 0.7
      legs[0] = legs[3] = h
      legs[1] = legs[2] = -h
      tgt.brx = 0.14
      tgt.sx = 0.98
      tgt.sy = 0.97
      tgt.sz = 1.06
      tgt.prx = 0.28
      for (let i = 0; i < 5; i++) seam[i] = CORE_C
      glow = 0.8
    } else if (this.stunned) {
      // buried in the wall: squashed by the blow, head snapped up, then the hatches fly open over the core
      if (tw < 1) {
        p.brx = 0.3
        p.prx = -0.25
      }
      tgt.brx = 0.18
      tgt.prx = -0.25
      tgt.splay = 0.3
      if (s <= 0.2) {
        const e = Math.exp(-s / 0.07) * Math.cos((Math.PI * 2 * s) / 0.14)
        over.sx = 1 + 0.1 * e
        over.sy = 1 + 0.1 * e
        over.sz = 1 - 0.2 * e
      }
      // the window closing: the hatches sink over the last 400 ms
      hatch = tw > 800 ? 1.2 - (0.4 * (tw - 800)) / 400 : 1.2 * backOut(Math.min(1, s / 0.12))
      over.pry = Math.sin(s * 44) * 0.12 * Math.max(0, 1 - s / 1.2)
      fire = 1 + 0.25 * Math.sin(Math.PI * 2 * 9 * s)
      heat = 0.5 + 0.5 * Math.sin(Math.PI * 2 * 9 * s)
      glow = 0.9 * (0.5 + 0.5 * Math.sin(Math.PI * 2 * 9 * s))
      seamFade()
    } else if (this.tripped) {
      // nose dug into the frost, rear kicked up and dropping back; the hatch stays shut
      tgt.prx = 0.5
      over.brx = s < 0.3 ? 0.45 * (1 - s / 0.3) : 0
    } else if (this.timer === CHARGER.missRecoverMs) {
      // a miss: braced where it stopped, then it turns to find you and shakes its head
      if (tw < 250) {
        skidPose()
        k *= 0.5
      } else if (tw < 750) {
        this.bob += dt * 5
        walkLegs()
      } else {
        over.pry = 0.1 * Math.sin((Math.PI * 2 * (tw - 750)) / 150)
      }
      seamFade()
    }
    // after a stun (400 ms): it pulls its face out of the wall; REST already says so

    // waking: the legs unfold and the seam flickers once, rear to front
    if (!this.asleep && this.wakeT > 0) {
      const u = 1 - this.wakeT / 0.25
      tgt.by = 0.4 + 0.15 * u
      snap = true
      const folded = [1.1, 1.1, -1.1, -1.1]
      for (let i = 0; i < 4; i++) legs[i] = folded[i]! * (1 - u)
      const at = u * 250
      for (let i = 0; i < 5; i++) seam[i] = at >= i * 50 && at < i * 50 + 50 ? CORE_C : CORE_DIM
    }

    const kk = snap ? 1 : k
    for (const key of ['by', 'brx', 'brz', 'sx', 'sy', 'sz', 'prx', 'pry', 'gz', 'splay'] as const) p[key] += (tgt[key] - p[key]) * kk
    for (let i = 0; i < 4; i++) p.legs[i] = legs[i] ?? p.legs[i]! + (tgt.legs[i]! - p.legs[i]!) * kk
    for (const [key, v] of Object.entries(over) as [keyof typeof over, number][]) p[key] = v

    this.body.position.y = p.by
    this.body.rotation.set(p.brx, 0, p.brz)
    this.body.scale.set(p.sx, p.sy, p.sz)
    this.prow.rotation.set(p.prx, p.pry, 0)
    this.grp.position.set(gx, gy, p.gz)
    this.legs.forEach((leg, i) => {
      leg.rotation.x = p.legs[i]!
      // splayed in a stun: L legs out to −x, R to +x
      leg.rotation.z = (i % 2 === 0 ? -1 : 1) * p.splay
    })
    this.hatchL.rotation.z = hatch
    this.hatchR.rotation.z = -hatch
    // Plated in a stun: the flank plates flare out with the hatch, and snap shut with it
    const flare = this.stunned ? 0.6 * backOut(Math.min(1, s / 0.12)) : 0
    this.flanks.forEach((f, i) => { f.rotation.z = (i === 0 ? -1 : 1) * flare })
    this.firebox.visible = this.stunned
    this.firebox.scale.setScalar(fire)
    this.fireMat.color.copy(CORE_C).lerp(FIRE_HOT, heat)
    this.glowMat.opacity = glow
    this.glow.visible = glow > 0.01

    // colour: the seam and visor are its only lights; asleep they're banked coals
    // sealed: an iron lid on every light but one dim segment, the rim that says it's warded
    const sealed = !this.asleep && (this.sealed || this.unsealT > 0)
    this.seamMats.forEach((m, i) => m.color.copy(this.asleep ? CORE_OFF : sealed ? (i === 2 ? SEAL_RIM : JOINT_C) : seam[i]!))
    this.coreMat.color.copy(this.asleep ? CORE_OFF : sealed ? JOINT_C : CORE_C)
    this.tint()

    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))

    this.laneTell.update(dt, {
      stage: this.rushing ? 'rush' : this.phase === 'windup' && !this.asleep ? (this.locked ? 'locked' : 'tracking') : 'off',
      x: this.lane.x, z: this.lane.z, aim: this.aim, len: this.lane.len,
      coreHalf: this.laneHalf, hitHalf: this.hitHalf, bodyR: this.radius, end: this.lane.end,
      fill: this.rushing ? 1 : (this.t - CHARGER.windupMs * CHARGER.lockAt) / (CHARGER.windupMs * (1 - CHARGER.lockAt)),
      from: this.rushing ? Math.hypot(this.pos.x - this.rushFrom.x, this.pos.z - this.rushFrom.z) : 0,
      // tracking gives way to any locked tell; the whole lane sits in the crowd by how soon it lands
      dim: this.locked ? 1 : trackingDim(),
      order: tellOrder(this.rushing ? 0 : CHARGER.windupMs - this.t),
    })
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT], [this.wornMat, WORN], [this.plateMat, PLATE]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiply(SLEEP_BODY)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    // the worn edge doesn't flash: bare iron stays bare iron
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(WHITE, this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    // the lane's pieces are telegraphs: released, not just disposed
    this.tellGroup.remove(this.laneTell.group)
    this.laneTell.dispose()
    disposeBody(this.group, this.tellGroup)
    this.lampGlow?.material.dispose()
  }
}
