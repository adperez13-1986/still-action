import * as THREE from 'three'
import { STARTING, type AbilityDef, type BeatKey } from './abilities'
import type { StillMove } from './parts'
import { buildModel, EYE, EYE_OFF, EYE_ON, HUNCH, JAW_OPEN, JAW_X, LENS_TILT, type PartCtx, type SlotModel } from './partmodels'

/**
 * Q16: architecture yes, content no.
 * Still is four separate parts from day one, so swapping a part is a model swap
 * rather than a rewrite. Each part's model lives in `partmodels.ts`: frame +
 * shell, where the frame holds every handle the poses below write.
 *
 * The Lantern: tall, thin and a little hunched. An open cage for a torso with a
 * small cold core inside, a round lens on a stalk for a head, backward-bent
 * bird legs, mismatched arms (a clamp, a hook). Picked from the lineup.
 */
export type SlotName = 'head' | 'torso' | 'arms' | 'legs'
export const SLOT_NAMES: readonly SlotName[] = ['head', 'torso', 'arms', 'legs'] as const

/** A piece's rest transform, recorded when it's worn: reassembly puts every piece back, not just the four roots. */
interface Rest { p: THREE.Vector3; q: THREE.Quaternion; s: THREE.Vector3 }

const GHOST_EVERY = 0.03
const GHOST_LIFE = 0.26

interface Ghost { obj: THREE.Object3D; mat: THREE.MeshBasicMaterial; life: number }

interface Debris { part: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; floor: number }

/** One cast's body: which beat, and the few numbers some beats scale by. */
export interface AttackSpec {
  beat: BeatKey | 'shot' | 'anvil-slam'
  pushed: boolean
  /** Seconds to hold the pose at its peak (stances). */
  holdS?: number
  /** 0..1 where a beat scales (Patient Lens). */
  power?: number
  /** −1 / 0 / +1: which way the head cants (Ricochet bank). */
  lean?: number
}

/** The bodies built so far. Every beat plays one of them; a new part adds its own. */
type Pose =
  | 'shot' | 'bolt' | 'patient' | 'coil' | 'flare' | 'nova'
  | 'arc' | 'spin' | 'piston' | 'hook'
  | 'dash' | 'step' | 'ram' | 'hop' | 'spring'
  | 'ward' | 'brace' | 'mirror' | 'anvil' | 'anvil-slam'
  | 'signal' | 'chill' | 'parry' | 'toss'
  | 'ricochet' | 'through'
  | 'lure' | 'frost' | 'plant' | 'snap' | 'rewind'

/**
 * Beat -> pose and duration. The ported parts borrow their shape's pose until
 * they get their own (Cracked Lens kicks like the Lens, Backdraft bursts like the Vent).
 * `yaw` scales a swing's twist (the narrow fray is a smaller Cleaver).
 */
const POSES: Partial<Record<AttackSpec['beat'], { pose: Pose; dur: number; yaw?: number }>> = {
  shot: { pose: 'shot', dur: 0.14 },
  lens: { pose: 'bolt', dur: 0.3 },
  cracked: { pose: 'bolt', dur: 0.3 },
  ricochet: { pose: 'ricochet', dur: 0.3 },
  through: { pose: 'through', dur: 0.42 },
  // stretched by the charge at the press: 0.26 s weak, 0.40 s full
  patient: { pose: 'patient', dur: 0.26 },
  coil: { pose: 'coil', dur: 0.22 },
  flare: { pose: 'flare', dur: 0.34 },
  signal: { pose: 'signal', dur: 0.3 },
  chill: { pose: 'chill', dur: 0.42 },
  parry: { pose: 'parry', dur: 0.26 },
  toss: { pose: 'toss', dur: 0.4 },
  vent: { pose: 'nova', dur: 0.42 },
  backdraft: { pose: 'nova', dur: 0.42 },
  cleaver: { pose: 'arc', dur: 0.34 },
  'fray-90': { pose: 'arc', dur: 0.3, yaw: 0.7 },
  'fray-180': { pose: 'arc', dur: 0.34 },
  'fray-360': { pose: 'spin', dur: 0.4 },
  piston: { pose: 'piston', dur: 0.28 },
  hook: { pose: 'hook', dur: 0.36 },
  kick: { pose: 'dash', dur: 0.3 },
  skid: { pose: 'dash', dur: 0.3 },
  'overrun-step': { pose: 'step', dur: 0.22 },
  'overrun-charge': { pose: 'ram', dur: 0.3 },
  skitter: { pose: 'hop', dur: 0.26 },
  spring: { pose: 'spring', dur: 0.4 },
  frost: { pose: 'frost', dur: 0.3 },
  plant: { pose: 'plant', dur: 0.3 },
  snap: { pose: 'snap', dur: 0.24 },
  rewind: { pose: 'rewind', dur: 0.3 },
  lure: { pose: 'lure', dur: 0.35 },
  // stances: the rise, then held for the window (holdS), then a 0.1 s release
  ward: { pose: 'ward', dur: 0.35 },
  brace: { pose: 'brace', dur: 0.4 },
  mirror: { pose: 'mirror', dur: 0.3 },
  anvil: { pose: 'anvil', dur: 0.3 },
  'anvil-slam': { pose: 'anvil-slam', dur: 0.3 },
}

/** A stance lets go over this long once its window is done. */
const RELEASE_S = 0.1

/** A move in progress: the path, how long it takes, and how high it arcs. */
interface Move {
  from: THREE.Vector3
  path: THREE.Vector3[]
  /** Cumulative length at each waypoint, so the ease runs over the whole path. */
  at: number[]
  total: number
  T: number
  t: number
  hopH: number
  dash: boolean
  vault: boolean
  lockMs: number
  ghostEvery: number
  src: StillMove
}

export class Still {
  readonly group = new THREE.Group()
  readonly parts = {} as Record<SlotName, THREE.Object3D>

  /** World-space position on the floor plane. y is always 0. */
  readonly pos = new THREE.Vector3(0, 0, 0)
  facing = 0
  speed = 5.5
  /** Where to look when the stick is idle. Null means hold the last heading. */
  aim: number | null = null

  private bob = 0
  private legL!: THREE.Group
  private legR!: THREE.Group
  private armL!: THREE.Group
  private armR!: THREE.Group
  /** Rig handles the beats reach for: the lens inside the head, the core in the cage, the clamp's jaws. */
  lens!: THREE.Group
  core!: THREE.Mesh
  jawL!: THREE.Mesh
  jawR!: THREE.Mesh
  /** A pose's own lift (a crouch, a squash), added over the walk bob and any hop. */
  private lift = 0

  /** What each slot wears right now: a part's model or the frame. */
  readonly models = {} as Record<SlotName, SlotModel>
  /** Bumped on every wear: anything that copied his body (Borrowed Time's echo) rebuilds when it changes. */
  version = 0
  private readonly rest = new Map<THREE.Object3D, Rest>()
  /** What the parts' idle motion reads. main writes `charge` and `marked`; `update` the rest. */
  readonly ctx: PartCtx = { speed: 0, bob: 0, accel: 0, charge: 0, marked: false, pose: null, k: 0, moving: false, broken: false }
  private fwdSpeed = 0
  private debris: Debris[] = []

  private ghosts: Ghost[] = []
  /** The attack being played: which pose, and how far through it (seconds). */
  private anim: { pose: Pose; t: number; dur: number; hold: number; pushed: boolean; power: number; yaw: number; lean: number } | null = null
  /** A visual recoil of the whole body, backwards along facing (Through-Line). Never moves `pos`. */
  private recoil = 0
  /** Where the body is drawn relative to `pos`: the render adds this after interpolating. */
  readonly nudge = new THREE.Vector3()
  private eyeFlash = 0
  private slowdown = 0
  /** 0 is the eye dark, 1 lit: Broken's homecoming lights it last. */
  private eyeLit = 1
  /** Broken, being put back: where each part lies, and how far the order has got. */
  private assembly: {
    order: SlotName[]; each: number; gap: number; t: number; seated: number
    from: Map<SlotName, { p: THREE.Vector3; q: THREE.Quaternion }>
  } | null = null
  private ghostTimer = 0

  private move: Move | null = null
  /** After a vault he lands heavy: the stick reads as idle until this runs out. */
  private lockT = 0
  /** Called on the tick a move arrives, for landing dust and sound. */
  onLand: ((m: StillMove) => void) | null = null

  /** The Lantern, whole: the four plain parts. A run starts him with one and three frames (`wear`). */
  constructor() {
    for (const slot of ['legs', 'torso', 'arms', 'head'] as const) this.wear(slot, STARTING.find((p) => p.slot === slot) ?? null)
  }

  /**
   * Put a part on (or `null`: the empty slot's frame). The model replaces the
   * slot's piece, the pose handles are rebound to it, and its rest pose is
   * recorded, so a part picked up mid-run reassembles where it belongs.
   */
  wear(slot: SlotName, def: AbilityDef | null) {
    const old = this.models[slot]
    if (old) {
      old.root.traverse((o) => this.rest.delete(o))
      this.debris = this.debris.filter((d) => d.part !== old.root)
    }
    const m = buildModel(slot, def?.id ?? null, 'body')
    this.models[slot] = m
    this.setPart(slot, m.root)
    if (m.lens) this.lens = m.lens
    if (m.core) this.core = m.core
    if (m.armL && m.armR && m.jawL && m.jawR) {
      this.armL = m.armL
      this.armR = m.armR
      this.jawL = m.jawL
      this.jawR = m.jawR
    }
    if (m.legL && m.legR) {
      this.legL = m.legL
      this.legR = m.legR
    }
    m.root.traverse((o) => this.rest.set(o, { p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone() }))
    // a stopping Still stays stopping: the new head drops as far as the old one had
    if (slot === 'head') m.root.rotation.x = this.slowdown * 0.42
    if (slot === 'arms') m.root.rotation.x = this.slowdown * 0.12
    this.version++
  }

  /** Its thing is out in the world (Lure's decoy, Plumb Line's anchor): the body shows it missing. */
  setLive(slot: SlotName, out: boolean) {
    this.models[slot].setLive?.(out)
  }

  /**
   * Play an attack. Each part's ability has a body to go with it: the cleaver
   * winds back and swings across, the lens recoils, the vent bursts the cage
   * open, the dash leans in. Pushed casts play bigger.
   */
  attack(a: AttackSpec) {
    const shot = a.beat === 'shot'
    // the auto attack never interrupts a real attack
    if (shot && this.anim && this.anim.pose !== 'shot') {
      this.eyeFlash = Math.max(this.eyeFlash, 0.5)
      return
    }
    this.eyeFlash = shot ? 0.5 : 1
    const p = POSES[a.beat]
    const power = a.power ?? 0
    const dur = p?.pose === 'patient' ? p.dur + 0.14 * power : p?.dur ?? 0
    // a beat with no body yet still lights the eye
    this.anim = p ? { pose: p.pose, t: 0, dur, hold: a.holdS ?? 0, pushed: a.pushed, power, yaw: p.yaw ?? 1, lean: a.lean ?? 0 } : null
  }

  /** 0 is running, 1 is stopped: the eye goes out and the head drops. */
  setSlowdown(k: number) {
    this.slowdown = k
    EYE.color.copy(EYE_ON).lerp(EYE_OFF, k)
    this.parts.head.rotation.x = k * 0.42
    this.parts.arms.rotation.x = k * 0.12
  }

  /** HP death. The four parts were always separate meshes; now they come apart. */
  breakApart(fromX: number, fromZ: number) {
    this.move = null
    this.lockT = 0
    const away = Math.atan2(this.pos.x - fromX, this.pos.z - fromZ)
    this.group.updateMatrixWorld(true)
    const box = new THREE.Box3()
    this.debris = Object.values(this.parts).map((part) => {
      // each part rests where its own centre meets the floor, not where its origin does
      const centreY = box.setFromObject(part).getCenter(new THREE.Vector3()).y - this.group.position.y
      const floor = part.position.y - centreY + 0.14
      const a = away + (Math.random() - 0.5) * 2.2
      const v = 2.5 + Math.random() * 3
      return {
        part,
        vel: new THREE.Vector3(Math.sin(a - this.facing) * v, 3 + Math.random() * 3.5, Math.cos(a - this.facing) * v),
        spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, Math.random() * 12 - 6),
        floor,
      }
    })
  }

  updateBroken(dt: number) {
    // idle motion freezes where it is; only the fan coasts down
    this.ctx.broken = true
    for (const m of Object.values(this.models)) m.tick?.(dt, this.ctx)
    for (const d of this.debris) {
      d.vel.y -= 22 * dt
      d.part.position.addScaledVector(d.vel, dt)
      if (d.part.position.y < d.floor) {
        d.part.position.y = d.floor
        d.vel.multiplyScalar(0.35)
        d.vel.y = Math.abs(d.vel.y) * 0.3
        d.spin.multiplyScalar(0.5)
      }
      d.part.rotation.x += d.spin.x * dt
      d.part.rotation.y += d.spin.y * dt
      d.part.rotation.z += d.spin.z * dt
    }
  }

  /** Every piece back at its rest pose: the four roots, and everything a pose or an idle had moved inside them. */
  reassemble() {
    this.debris = []
    this.move = null
    this.lockT = 0
    this.anim = null
    this.lift = 0
    this.recoil = 0
    this.ctx.broken = false
    for (const [o, r] of this.rest) {
      o.position.copy(r.p)
      o.quaternion.copy(r.q)
      o.scale.copy(r.s)
    }
    for (const m of Object.values(this.models)) m.reset?.()
    this.assembly = null
    this.eyeLit = 1
    this.setSlowdown(0)
  }

  /** The eye's light on its own, 0..1: the last thing to come back after he's put together. */
  setEyeLit(k: number) {
    this.eyeLit = k
    EYE.color.copy(EYE_OFF).lerp(EYE_ON, k)
  }

  get reassembling(): boolean {
    return this.assembly !== null
  }

  /**
   * Broken, played backwards. Each part starts lying where `from` says (a point on
   * a surface, world space, and a yaw), and flies to its seat in `order`: an ease
   * out, arcing up at mid-flight. Drive it with `updateReassembly`; `update` is
   * not called meanwhile, so nothing else writes the four roots.
   */
  beginReassembly(from: Record<SlotName, { at: THREE.Vector3; yaw: number }>, o: { order: SlotName[]; each: number; gap: number }) {
    this.reassemble()
    this.setEyeLit(0)
    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.set(0, this.facing, 0)
    this.group.updateMatrixWorld(true)
    const toLocal = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -this.facing)
    const box = new THREE.Box3()
    const c = new THREE.Vector3()
    const lying = new Map<SlotName, { p: THREE.Vector3; q: THREE.Quaternion }>()
    for (const slot of SLOT_NAMES) {
      const part = this.parts[slot]
      const spot = from[slot]
      // on its side at the given yaw (in world terms), then moved so its bounds sit on the surface at the spot
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, spot.yaw - this.facing, 0, 'YXZ'))
      part.quaternion.copy(q)
      part.updateMatrixWorld(true)
      box.setFromObject(part)
      box.getCenter(c)
      const d = new THREE.Vector3(spot.at.x - c.x, spot.at.y - box.min.y, spot.at.z - c.z).applyQuaternion(toLocal)
      part.position.add(d)
      lying.set(slot, { p: part.position.clone(), q })
    }
    this.assembly = { order: o.order, each: o.each, gap: o.gap, t: 0, seated: 0, from: lying }
  }

  /** One step of the reassembly. Returns the slots that seated this step (a click and sparks each). */
  updateReassembly(dt: number): SlotName[] {
    const a = this.assembly
    if (!a) return []
    a.t += dt
    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.set(0, this.facing, 0)
    const seated: SlotName[] = []
    a.order.forEach((slot, i) => {
      const part = this.parts[slot]
      const home = this.rest.get(part)!
      const from = a.from.get(slot)!
      const k = Math.min(1, Math.max(0, (a.t - i * (a.each + a.gap)) / a.each))
      const e = 1 - Math.pow(1 - k, 3)
      part.position.lerpVectors(from.p, home.p, e)
      part.position.y += 0.6 * Math.sin(Math.PI * e)
      part.quaternion.slerpQuaternions(from.q, home.q, e)
      if (k >= 1 && i >= a.seated) {
        a.seated = i + 1
        seated.push(slot)
      }
    })
    if (a.seated >= a.order.length) {
      for (const slot of a.order) {
        const r = this.rest.get(this.parts[slot])!
        this.parts[slot].position.copy(r.p)
        this.parts[slot].quaternion.copy(r.q)
      }
      this.assembly = null
    }
    return seated
  }

  /** The seam that makes visible loot free later. */
  setPart(slot: SlotName, mesh: THREE.Object3D) {
    const existing = this.parts[slot]
    if (existing) this.group.remove(existing)
    this.parts[slot] = mesh
    this.group.add(mesh)
  }

  /** A part is moving him: a dash, a hop, and later a snap or a rewind. */
  get moving(): boolean {
    return this.move !== null
  }

  /** True from a vault's takeoff until it lands: the run doesn't push him out of the wall he's clearing. */
  get vaulting(): boolean {
    return !!this.move?.vault
  }

  /**
   * Carry him along a path over `ms`, easing out (fast off the mark, settling
   * in). `hopH` above zero makes it a hop: a parabola over the whole flight.
   */
  startMove(m: StillMove & { hopH: number; ghostEvery?: number }) {
    const from = new THREE.Vector3(this.pos.x, 0, this.pos.z)
    const at: number[] = []
    let total = 0
    let prev = from
    for (const p of m.path) {
      total += Math.hypot(p.x - prev.x, p.z - prev.z)
      at.push(total)
      prev = p
    }
    // he faces where he's going, except on a rewind: that one pulls him backwards, still looking ahead
    const first = m.path[0]
    if (m.kind !== 'rewind' && first && Math.hypot(first.x - from.x, first.z - from.z) > 0.01) this.facing = Math.atan2(first.x - from.x, first.z - from.z)
    this.move = {
      from, path: m.path.map((p) => new THREE.Vector3(p.x, 0, p.z)), at, total, T: Math.max(0.001, m.ms / 1000), t: 0,
      hopH: m.hopH, dash: m.kind === 'dash', vault: m.vault, lockMs: m.lockMs, ghostEvery: m.ghostEvery ?? GHOST_EVERY, src: m,
    }
    this.ghostTimer = 0
  }

  update(dt: number, moveX: number, moveZ: number) {
    const x = this.pos.x
    const z = this.pos.z
    this.drive(dt, moveX, moveZ)
    this.tickParts(dt, x, z)
  }

  /** The parts' idle motion, from how he actually moved this tick. */
  private tickParts(dt: number, x: number, z: number) {
    const c = this.ctx
    c.broken = false
    if (dt > 1e-6) {
      const vx = (this.pos.x - x) / dt
      const vz = (this.pos.z - z) / dt
      const fwd = vx * Math.sin(this.facing) + vz * Math.cos(this.facing)
      c.accel += ((fwd - this.fwdSpeed) / dt - c.accel) * Math.min(1, dt * 12)
      this.fwdSpeed = fwd
      c.speed += (Math.hypot(vx, vz) / this.speed - c.speed) * Math.min(1, dt * 6)
    }
    c.bob = this.bob
    c.pose = this.anim?.pose ?? null
    c.k = this.anim ? Math.min(1, this.anim.t / this.anim.dur) : 0
    c.moving = this.move !== null
    for (const m of Object.values(this.models)) m.tick?.(dt, c)
  }

  private drive(dt: number, moveX: number, moveZ: number) {
    this.updateGhosts(dt)

    if (this.lockT > 0) {
      this.lockT = Math.max(0, this.lockT - dt)
      moveX = 0
      moveZ = 0
    }

    const m = this.move
    if (m) {
      // afterimages along the path: the eye reads travel, not a teleport
      this.ghostTimer -= dt
      if (this.ghostTimer <= 0) {
        this.ghostTimer = m.ghostEvery
        this.spawnGhost()
      }
      m.t = Math.min(m.T, m.t + dt)
      const k = m.t / m.T
      this.placeOnPath(m, (1 - (1 - k) * (1 - k)) * m.total)
      // a rewind un-walks: the bob runs backwards, so the legs play the walk in reverse
      const back = m.src.kind === 'rewind'
      this.bob += dt * (back ? -13 : 22)
      this.parts.torso.rotation.x = HUNCH
      if (back) {
        const swing = Math.sin(this.bob) * 0.45
        this.legL.rotation.x = swing
        this.legR.rotation.x = -swing
      } else if (m.dash) {
        // leaning into the dash, legs tucked; the short step leans half as far
        const lean = this.anim?.pose === 'step' ? 0.5 : 1
        this.parts.torso.rotation.x = 0.16 + 0.4 * lean
        this.parts.head.rotation.x = 0.3 * lean
        this.legL.rotation.x = -0.7 * lean
        this.legR.rotation.x = 0.5 * lean
      } else {
        this.legL.rotation.x = 0
        this.legR.rotation.x = 0
      }
      this.animate(dt)
      // flat is a dash, an arc is a hop: height is how you tell them apart
      const y = m.dash ? 0.12 : 4 * m.hopH * k * (1 - k)
      this.nudge.set(0, 0, 0)
      this.group.position.set(this.pos.x, y + this.lift, this.pos.z)
      this.group.rotation.y = this.facing
      if (m.t >= m.T) {
        this.move = null
        if (m.vault) this.lockT = m.lockMs / 1000
        this.onLand?.(m.src)
      }
      return
    }

    const mag = Math.hypot(moveX, moveZ)

    if (mag > 0.08) {
      this.pos.x += moveX * this.speed * dt
      this.pos.z += moveZ * this.speed * dt

      this.turnToward(Math.atan2(moveX, moveZ), dt * 16)

      this.bob += dt * mag * 13
    } else {
      if (this.aim !== null) this.turnToward(this.aim, dt * 9)
      this.bob += (0 - (this.bob % (Math.PI * 2))) * Math.min(1, dt * 8)
    }

    this.walking = mag > 0.08
    const swing = Math.sin(this.bob) * 0.45 * Math.min(1, mag)
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing
    this.armL.rotation.x = -swing * 0.5
    this.armR.rotation.x = swing * 0.5
    this.parts.torso.rotation.x = HUNCH
    this.animate(dt)

    this.nudge.set(-Math.sin(this.facing) * this.recoil, 0, -Math.cos(this.facing) * this.recoil)
    this.group.position.set(this.pos.x + this.nudge.x, Math.abs(Math.sin(this.bob)) * 0.05 * mag + this.lift, this.pos.z + this.nudge.z)
    this.group.rotation.y = this.facing
  }

  /** Put him `d` along the move's path. */
  private placeOnPath(m: Move, d: number) {
    let a = m.from
    let start = 0
    for (let i = 0; i < m.path.length; i++) {
      const b = m.path[i]!
      const end = m.at[i]!
      if (d <= end || i === m.path.length - 1) {
        const f = end > start ? Math.min(1, (d - start) / (end - start)) : 1
        this.pos.x = a.x + (b.x - a.x) * f
        this.pos.z = a.z + (b.z - a.z) * f
        return
      }
      a = b
      start = end
    }
  }

  private spawnGhost() {
    const scene = this.group.parent
    if (!scene) return
    const { obj, mat } = this.makeGhost(0.45)
    scene.add(obj)
    this.ghosts.push({ obj, mat, life: GHOST_LIFE })
  }

  /**
   * A cold copy of him in his pose right now: the decoy (N7), Borrowed Time's echo,
   * the dash afterimages. The caller adds it to the scene and owns it (dispose `mat`).
   */
  makeGhost(opacity: number): { obj: THREE.Object3D; mat: THREE.MeshBasicMaterial } {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fc0ff, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const obj = this.group.clone(true)
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = mat
    })
    return { obj, mat }
  }

  private updateGhosts(dt: number) {
    for (let i = this.ghosts.length - 1; i >= 0; i--) {
      const g = this.ghosts[i]!
      g.life -= dt
      g.mat.opacity = Math.max(0, (g.life / GHOST_LIFE) * 0.45)
      if (g.life <= 0) {
        g.obj.removeFromParent()
        g.mat.dispose()
        this.ghosts.splice(i, 1)
      }
    }
  }

  /** Layer the current attack over the walk. Resets every part it touched each frame. */
  private animate(dt: number) {
    const torso = this.parts.torso
    const head = this.parts.head
    torso.rotation.y = 0
    torso.scale.setScalar(1)
    this.armL.rotation.z = 0
    this.armR.rotation.z = 0
    this.armL.rotation.y = 0
    if (this.slowdown <= 0) head.rotation.x = 0
    head.rotation.y = 0
    head.rotation.z = 0
    head.position.z = 0.1
    this.lens.rotation.z = LENS_TILT
    this.lift = 0
    this.recoil = 0
    this.jawL.position.x = JAW_X - JAW_OPEN
    this.jawR.position.x = JAW_X + JAW_OPEN

    // landing heavy after a vault: knees buckled, head down, for as long as the stick is locked
    if (this.lockT > 0) {
      this.lift = -0.12
      torso.rotation.x = 0.16 + 0.35
      head.rotation.x = 0.2
      this.legL.rotation.x = 0.45
      this.legR.rotation.x = 0.45
    }

    this.eyeFlash = Math.max(0, this.eyeFlash - dt * 5)
    if (this.slowdown <= 0) EYE.color.copy(EYE_ON).lerp(new THREE.Color(0xffffff), this.eyeFlash).lerp(EYE_OFF, 1 - this.eyeLit)

    const a = this.anim
    if (!a) return
    a.t += dt
    const k = Math.min(1, a.t / a.dur)
    // a stance: rises over the beat, stays for the window, then lets go
    const stance = a.hold > 0
      ? (a.t < a.dur ? 1 - Math.pow(1 - k, 2) : Math.max(0, Math.min(1, 1 - (a.t - a.dur - a.hold) / RELEASE_S)))
      : 1 - Math.pow(1 - k, 2)
    const big = a.pushed ? 1.35 : 1
    // a quick wind-up then a fast release reads as weight
    const wind = Math.min(1, k / 0.3)
    const release = k < 0.3 ? 0 : (k - 0.3) / 0.7
    const settle = 1 - release

    switch (a.pose) {
      case 'arc': {
        // clamp arm winds back and up, the cage twists, then it all whips across
        const yaw = k < 0.3 ? 0.75 * wind : 0.75 - 1.75 * Math.sin((release * Math.PI) / 2)
        torso.rotation.y = yaw * a.yaw * big * (k < 0.3 ? 1 : settle + 0.3)
        this.armL.rotation.x = (k < 0.3 ? -1.7 * wind : -1.7 + 1.5 * release) * big
        this.armL.rotation.z = (k < 0.3 ? -0.5 * wind : -0.5 + 1.1 * release) * big
        this.armR.rotation.x = -0.4 * (1 - k)
        break
      }
      case 'bolt': {
        // the lens kicks back and up with the shot, the body rocks after it
        const kick = Math.pow(1 - k, 2)
        head.rotation.x = -0.45 * kick * big
        head.position.z = 0.1 - 0.12 * kick * big
        torso.rotation.x = 0.16 - 0.18 * kick * big
        break
      }
      case 'nova': {
        // crouch into the cage, then burst it open with the arms flung wide
        const burst = k < 0.25 ? -0.12 * (k / 0.25) : Math.sin(((k - 0.25) / 0.75) * Math.PI) * 0.4 * big
        torso.scale.setScalar(1 + burst)
        this.armL.rotation.z = -Math.max(0, burst) * 3
        this.armR.rotation.z = Math.max(0, burst) * 3
        torso.rotation.x = 0.16 + (k < 0.25 ? 0.2 * (k / 0.25) : 0.2 * (1 - k))
        break
      }
      case 'patient': {
        // the kick grows with what was banked; a full shot plants a foot and rocks back
        const kick = Math.pow(1 - k, 2) * (0.2 + 0.5 * a.power) * big
        head.rotation.x = -kick
        head.position.z = 0.1 - 0.27 * kick
        torso.rotation.x = 0.16 - 0.4 * kick
        if (a.power >= 0.99) {
          this.legR.rotation.x = 0.35 * (1 - k)
          torso.rotation.x -= 0.05 * (1 - k)
        }
        break
      }
      case 'ricochet': {
        // the Lens kick, with the head canted toward the bank: it reads "at an angle"
        const kick = Math.pow(1 - k, 2)
        head.rotation.x = -0.4 * kick * big
        head.rotation.z = -0.25 * a.lean * Math.sin(Math.min(1, k * 1.5) * Math.PI)
        torso.rotation.x = 0.16 - 0.15 * kick * big
        break
      }
      case 'through': {
        // a draw (0.12 s): the lens pulls in, the legs brace; then the release, and the whole body recoils
        const draw = Math.min(1, a.t / 0.12)
        const fire = a.t < 0.12 ? 0 : Math.pow(1 - Math.min(1, (a.t - 0.12) / (a.dur - 0.12)), 2)
        head.position.z = 0.1 - 0.06 * (a.t < 0.12 ? draw : fire)
        this.legL.rotation.x = 0.25 * (a.t < 0.12 ? draw : fire)
        this.legR.rotation.x = -0.25 * (a.t < 0.12 ? draw : fire)
        head.rotation.x = -0.55 * fire * big
        torso.rotation.x = 0.16 - 0.16 * fire
        this.recoil = 0.15 * fire * big
        break
      }
      case 'lure': {
        // he leaves something behind: the cage opens, the lens flares, he dips his head and settles smaller
        const e = Math.sin(k * Math.PI)
        torso.scale.setScalar(1 + 0.2 * e)
        head.rotation.x = 0.3 * e
        this.lift = -0.04 * e
        break
      }
      case 'frost':
        // the dash lean, with the trailing leg dragging, scraping frost
        this.legR.rotation.x = 0.4
        this.armL.rotation.x = 0.9 * (1 - k)
        this.armR.rotation.x = 0.9 * (1 - k)
        break
      case 'plant': {
        // the clamp drops the bob, jaws opening, as he stomps
        const drop = Math.min(1, k / 0.5)
        this.armL.rotation.x = -0.8 * (1 - drop)
        const open = JAW_OPEN * 0.6 * drop * (1 - k)
        this.jawL.position.x = JAW_X - JAW_OPEN - open
        this.jawR.position.x = JAW_X + JAW_OPEN + open
        this.legR.rotation.x = k < 0.4 ? -0.5 * (k / 0.4) : -0.5 * (1 - (k - 0.4) / 0.6)
        this.lift = k > 0.4 && k < 0.7 ? -0.05 : 0
        break
      }
      case 'snap':
        // pitched forward toward the anchor, arms trailing; a squash on arrival
        torso.rotation.x = 0.16 + (0.5 - 0.16) * (k < 0.8 ? 1 : (1 - k) / 0.2)
        this.armL.rotation.x = this.armR.rotation.x = 1.0 * (k < 0.8 ? 1 : (1 - k) / 0.2)
        this.lift = k > 0.85 ? -0.05 : 0
        break
      case 'rewind': {
        // yanked from the chest: arching back, arms trailing forward
        const e = k < 0.8 ? 1 : (1 - k) / 0.2
        head.rotation.x = -0.4 * e
        torso.rotation.x = 0.16 - 0.2 * e
        this.armL.rotation.x = this.armR.rotation.x = -0.6 * e
        break
      }
      case 'coil': {
        // a short kick, and the lens shivers like a coil let go
        head.rotation.x = -0.3 * Math.pow(1 - k, 2) * big
        if (a.t < 0.15) this.lens.rotation.z = 0.18 + 0.08 * Math.sin(a.t * Math.PI * 2 * 30)
        break
      }
      case 'flare':
      case 'signal': {
        // a lob lifts the lens where a bolt kicks it back: look up, crouch into the toss, release
        // (Signal Flare adds a flick of the lens on the release: it signals)
        if (a.pose === 'signal' && k >= 0.3) this.lens.rotation.z = 0.18 + 0.35 * Math.sin(Math.min(1, release * 2.5) * Math.PI)
        const up = k < 0.3 ? wind : settle
        head.rotation.x = -0.7 * up * big
        this.lift = -0.06 * (k < 0.3 ? wind : settle)
        this.legL.rotation.x = this.legR.rotation.x = 0.2 * (k < 0.3 ? wind : settle)
        torso.rotation.x = 0.16 - 0.14 * Math.sin(release * Math.PI)
        break
      }
      case 'spin': {
        // the widest fray: a full turn, arms flung out, legs planted
        torso.rotation.y = k < 0.3 ? -0.4 * wind : -0.4 + (Math.PI * 2 + 0.4) * (1 - Math.pow(1 - release, 2))
        const out = Math.sin(k * Math.PI) * big
        this.armL.rotation.z = -0.9 * out
        this.armR.rotation.z = 0.9 * out
        this.legL.rotation.x = this.legR.rotation.x = 0
        break
      }
      case 'piston': {
        // straight, no lunge: elbow back and the cage coils, then the arm goes dead straight
        const ext = k < 0.3 ? 0 : Math.min(1, (k - 0.3) / 0.2)
        const back = Math.max(0, (k - 0.6) / 0.4)
        const hold = 1 - back
        this.armL.rotation.x = (k < 0.3 ? 0.6 * wind : 0.6 - 2.2 * ext) * hold * big
        torso.rotation.y = (k < 0.3 ? 0.35 * wind : 0.35 - 0.55 * ext) * hold
        torso.rotation.x = 0.16 + 0.2 * ext * hold
        const shut = 0.04 * ext * hold
        this.jawL.position.x = JAW_X - JAW_OPEN + shut
        this.jawR.position.x = JAW_X + JAW_OPEN - shut
        break
      }
      case 'hook': {
        // the only swing the hook arm leads: reach out long, then haul back
        const reach = Math.min(1, k / 0.45)
        const yank = k < 0.45 ? 0 : (k - 0.45) / 0.55
        this.armR.rotation.x = (k < 0.45 ? -0.3 - 1.5 * reach : -1.8 + 2.2 * yank) * big
        const haul = Math.sin(yank * Math.PI)
        torso.rotation.x = 0.16 - 0.1 * haul
        torso.rotation.y = -0.25 * haul
        break
      }
      case 'dash':
        this.armL.rotation.x = 0.9 * (1 - k)
        this.armR.rotation.x = 0.9 * (1 - k)
        break
      case 'step':
        this.armL.rotation.x = 0.45 * (1 - k)
        this.armR.rotation.x = 0.45 * (1 - k)
        break
      case 'ram': {
        // the charge: head down, cage forward, arms swept back
        const r = k < 0.2 ? k / 0.2 : k > 0.8 ? (1 - k) / 0.2 : 1
        head.rotation.x = 0.5 * r
        torso.rotation.x = 0.16 + (0.7 - 0.16) * r
        this.armL.rotation.x = this.armR.rotation.x = 1.2 * r
        break
      }
      case 'hop':
      case 'spring': {
        // crouch, spring with the legs tucked and the arms up for balance, land with a squash
        const deep = a.pose === 'spring'
        const crouch = deep ? 0.06 : 0.04
        const land = a.dur - (deep ? 0.08 : 0.05)
        if (a.t < crouch) {
          this.lift = deep ? -0.1 : -0.06
          this.legL.rotation.x = this.legR.rotation.x = deep ? 0.45 : 0.3
        } else if (a.t < land) {
          this.legL.rotation.x = deep ? -0.9 : -0.6
          this.legR.rotation.x = deep ? -0.7 : -0.4
          this.armL.rotation.z = -(deep ? 0.4 : 0.3)
          this.armR.rotation.z = deep ? 0.4 : 0.3
        } else if (this.lockT <= 0) {
          this.lift = deep ? -0.08 : -0.04
        }
        break
      }
      case 'ward': {
        // the cage pulls in, both arms come up and cross in front, the head ducks
        const e = stance
        torso.scale.setScalar(1 - 0.1 * e)
        this.armL.rotation.x = this.armR.rotation.x = -0.6 * e
        this.armL.rotation.z = 0.5 * e
        this.armR.rotation.z = -0.5 * e
        head.rotation.x = 0.2 * e
        break
      }
      case 'mirror': {
        // the opposite of Ward: arms flung open, the chest presented
        const e = stance
        torso.scale.setScalar(1 + 0.1 * e)
        this.armL.rotation.z = -0.6 * e
        this.armR.rotation.z = 0.6 * e
        break
      }
      case 'brace': {
        // planted, leaning into a wind: legs spread, low, arms down and out, head down
        const e = stance
        this.legL.rotation.x = 0.3 * e
        this.legR.rotation.x = -0.3 * e
        this.lift = -0.08 * e
        torso.rotation.x = 0.16 + 0.35 * e
        this.armL.rotation.z = -0.4 * e
        this.armR.rotation.z = 0.4 * e
        head.rotation.x = 0.25 * e
        break
      }
      case 'anvil': {
        // the clamp raised overhead, legs spread, waiting for the blow
        const e = stance
        this.armL.rotation.x = -2.6 * e
        torso.rotation.x = 0.16 - 0.1 * e
        this.legL.rotation.x = 0.3 * e
        this.legR.rotation.x = -0.3 * e
        break
      }
      case 'anvil-slam': {
        // caught: the clamp comes down hard (in 0.08 s), the cage swells, he drops into it
        const down = Math.min(1, a.t / 0.08)
        const back = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6
        this.armL.rotation.x = (-2.6 + 2.3 * down) * back
        torso.rotation.x = 0.16 + 0.4 * down * back
        this.lift = -0.08 * down * back
        torso.scale.setScalar(1 + 0.15 * down * back)
        break
      }
      case 'chill': {
        // the nova as an exhale: the cage swells and holds, the head tips back, the arms stay low
        const swell = k < 0.25 ? k / 0.25 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4
        torso.scale.setScalar(1 + 0.25 * swell * big)
        head.rotation.x = -0.25 * swell
        this.armL.rotation.z = -0.6 * swell
        this.armR.rotation.z = 0.6 * swell
        break
      }
      case 'parry': {
        // a bite: the clamp snaps out and the jaws slam shut, the cage turning into it
        const snap = Math.min(1, a.t / 0.08)
        const back = k < 0.5 ? 1 : 1 - (k - 0.5) / 0.5
        this.armL.rotation.x = (-0.4 - 0.9 * snap) * back * big
        torso.rotation.y = 0.3 * snap * back
        const shut = JAW_OPEN * 0.9 * snap * back
        this.jawL.position.x = JAW_X - JAW_OPEN + shut
        this.jawR.position.x = JAW_X + JAW_OPEN - shut
        break
      }
      case 'toss': {
        // grab with the jaws shut, wind away from the throw, then up and over
        const grab = Math.min(1, a.t / 0.12)
        const toss = a.t < 0.12 ? 0 : Math.min(1, (a.t - 0.12) / 0.28)
        const back = k > 0.85 ? (1 - k) / 0.15 : 1
        this.armL.rotation.x = (-1.4 * grab - 1.0 * toss) * back * big
        torso.rotation.y = (a.t < 0.12 ? -0.6 * grab : -0.6 + 1.8 * toss) * back
        const shut = JAW_OPEN * 0.9 * grab * back
        this.jawL.position.x = JAW_X - JAW_OPEN + shut
        this.jawR.position.x = JAW_X + JAW_OPEN - shut
        break
      }
      case 'shot':
        head.position.z = 0.1 - 0.05 * (1 - k)
        break
    }
    if (a.t >= a.dur + (a.hold > 0 ? a.hold + RELEASE_S : 0)) this.anim = null
  }

  /** For footsteps: one PI per step while he's walking. */
  get stride() { return this.bob }
  walking = false

  /** The lens, in world space: where Still's bolts leave from. */
  lensPoint(out: THREE.Vector3) {
    return this.parts.head.getWorldPosition(out).add(new THREE.Vector3(Math.sin(this.facing) * 0.25, 0.32, Math.cos(this.facing) * 0.25))
  }

  /** Shortest way round. */
  private turnToward(target: number, rate: number) {
    let delta = target - this.facing
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    this.facing += delta * Math.min(1, rate)
  }
}
