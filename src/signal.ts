import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Terrain } from './terrain'
import { YAW } from './world'
import { haloTexture } from './vfx'
import { hideMaterials, HIDES } from './hide'
import { LINE, distToSpan, type LaneDef } from './line'
import { slide, statusTint, disposeBody, REEL, CORE, CORE_ASLEEP, type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'

/**
 * The Signalman (design/area3/SPEC.md §6.1, STAGE-B.md §2.4): a timber post on three short legs that stands
 * 7-11 u off and calls the trains. Not a shooter: its one act is the call.
 *
 *   approach  holds 7-11 u like a sentinel; calls a lane when its reload is done and a lane is callable
 *   windup    900 ms: its arm climbs in six ratchet clicks and the lamp swells. A place tell (R1): the autos never
 *             break it, a push, a part or a kill does. Booked, so it never lands on another lock's beat
 *   call      the arm is down: the lane is called (the Line's train starts a tell now, with its slip)
 *   recover   760 ms, then approach with the reload (7000; 3000 after a break)
 *
 * R2: it never calls a lane it stands in (the floor span, grown by 1 u past its body). R10: a lesson Signalman's first
 * call skips `laneReach` and `signalQuietS`, and it has no wake reload: it calls once on waking, at the lane nearest its home.
 */
export const SIGNAL = {
  hp: 20, bodyRadius: 0.45, height: 2.1, labelY: 2.5, speed: 3.0,
  preferMin: 7, preferMax: 11,
  windupMs: 900, callRange: 14, laneReach: 3.7,
  reloadMs: 7000, interruptedMs: 3000, recoverMs: 760,
  /** Reload at waking: a beat to see the post before its first call. NEW (the brief's number, a dial). */
  wakeMs: 2000,
  /** R2: never calls a lane whose floor span is within LINE.halfW + bodyRadius + this of it. */
  standPad: 1.0,
  /** Ratchet clicks over the windup: the arm makes one step of `stepDeg` at each. */
  clicks: 6,
  armDeg: 60,
}

/** The lamp at rest, awake: a banked coal, well under CORE. */
const LAMP_REST = new THREE.Color(CORE).multiplyScalar(0.3)
/**
 * The lamp at the top of its swell: deeper and redder than CORE, never pale (hide.ts header; the crouch's lesson,
 * enemy.ts CROUCH_HOT: a bright light orange washes out to peach under ACES + bloom). INV-C1: its HSL lightness never
 * exceeds CORE's, at any tick; the swell is in the hue and the size, the click flicker only dims.
 */
const SIGNAL_HOT = new THREE.Color(0xff3812)
/** The lamp's halo, multiplied over the halo texture: red, so the additive heart stays out of peach. */
const HALO_TINT = 0xff3812

const BODY = HIDES.signal.body
const JOINT = HIDES.signal.joint

/** The arm's fixed yaw: its plane is the screen's (the camera never turns), so the raised arm is always in profile. */
const FACE = YAW

const at = <G extends THREE.BufferGeometry>(g: G, x: number, y: number, z: number, rx = 0, rz = 0): G => {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1))
  g.applyMatrix4(m)
  return g
}

export class Signal implements Enemy {
  readonly kind = 'ranged'
  readonly variant = 'signal'
  readonly labelY = SIGNAL.labelY
  get radius() { return SIGNAL.bodyRadius * this.size }
  readonly windupMs = SIGNAL.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = SIGNAL.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  readonly height = SIGNAL.height
  rime = 0
  air = 0

  private timer = 0
  /** ms until it may wind up (it starts on the wake reload, set in setAsleep). */
  private reload = SIGNAL.wakeMs
  /** What the reload becomes when the recover ends: the full one, or the short one after a break. */
  private nextReload = SIGNAL.reloadMs
  private flash = 0
  private bob = 0
  private strafe = 1
  private strafeTimer = 1.6
  private stepping = 0
  private reel = -1
  private asleep = false
  /** Where it was placed: R10's lesson call picks the lane nearest here. */
  private readonly home: { x: number; z: number }
  /** R10: its first call is the lesson's, until it has been made. */
  private lessonLeft: boolean
  /** The lane its windup is calling, and whether this windup is the lesson's. */
  private calling: LaneDef | null = null
  private lessonCall = false
  /** The arm's angle now, rad: it climbs in the windup and falls after, so a break or a call leaves it dropping. */
  private arm = 0

  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly lampMat: THREE.MeshBasicMaterial
  private readonly lamp: THREE.Mesh
  private readonly halo: THREE.Sprite
  private readonly armPivot = new THREE.Group()
  private readonly body = new THREE.Group()
  private readonly click = new THREE.Color()

  constructor(x: number, z: number, lesson = false) {
    this.pos.set(x, 0, z)
    this.home = { x, z }
    this.lessonLeft = lesson
    this.bob = (Math.abs(x * 7.13 + z * 3.31) % 10)
    // its wake reload: a lesson Signalman calls on waking (setAsleep(false) reads this too)
    if (lesson) this.reload = 0

    const hide = hideMaterials('signal')
    this.mat = hide.mat
    this.jointMat = hide.jointMat

    // the post and its three legs, one mesh; the two iron straps, one mesh
    const timber: THREE.BufferGeometry[] = [at(new THREE.BoxGeometry(0.22, 1.5, 0.22), 0, 1.25, 0)]
    const splay = (25 * Math.PI) / 180
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const dx = Math.sin(a), dz = Math.cos(a)
      const g = new THREE.CylinderGeometry(0.05, 0.05, 0.6, 6)
      // hip at the post's foot, foot out and down: tilt the cylinder's axis to (dx sin, -cos, dz sin)
      const axis = new THREE.Vector3(dx * Math.sin(splay), -Math.cos(splay), dz * Math.sin(splay)).normalize()
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis)
      const mid = new THREE.Vector3(0, 0.56, 0).addScaledVector(axis, 0.3)
      g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)))
      timber.push(g)
    }
    const straps = [at(new THREE.BoxGeometry(0.29, 0.07, 0.29), 0, 0.95, 0), at(new THREE.BoxGeometry(0.29, 0.07, 0.29), 0, 1.6, 0)]
    const post = new THREE.Mesh(mergeGeometries(timber)!, this.mat)
    const strap = new THREE.Mesh(mergeGeometries(straps)!, this.jointMat)
    timber.forEach((g) => g.dispose())
    straps.forEach((g) => g.dispose())
    this.body.add(post, strap)

    // the semaphore arm: pivots at the post's right face, 1.0 long; the lamp case at its end, the lamp in the case's mouth
    this.armPivot.position.set(0.12, 1.8, 0)
    const bar = new THREE.Mesh(at(new THREE.BoxGeometry(1.0, 0.08, 0.06), 0.5, 0, 0), this.mat)
    const kase = new THREE.Mesh(at(new THREE.BoxGeometry(0.18, 0.18, 0.18), 1.0, 0, 0), this.jointMat)
    this.lampMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
    this.lamp = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.26), this.lampMat)
    this.lamp.name = 'lamp:signal'
    this.lamp.position.set(1.0, 0, 0)
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: HALO_TINT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }))
    this.halo.scale.setScalar(0.7)
    this.halo.position.set(1.0, 0, 0.14)
    this.armPivot.add(bar, kase, this.lamp, this.halo)
    this.group.add(this.body, this.armPivot)
    this.group.rotation.y = FACE
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor * (this.reel >= 0 ? REEL.mul : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  /** The lanes it could call now, in the call rule's order (SPEC §6.1, R2, R10): the lesson lane is the one nearest its home. */
  private callable(ctx: EnemyCtx, still: THREE.Vector3): LaneDef | null {
    const L = ctx.line
    if (!L || this.reload > 0) return null
    if (Math.hypot(still.x - this.pos.x, still.z - this.pos.z) > SIGNAL.callRange) return null
    const lit = L.lit()
    const standIn = LINE.halfW + SIGNAL.bodyRadius + SIGNAL.standPad
    const lesson = this.lessonLeft
    let best: LaneDef | null = null
    let bestD = Infinity
    for (const l of L.lanes) {
      if (lit.includes(l)) continue
      // R2: never a lane it stands in
      if (distToSpan(this.pos.x, this.pos.z, l.ax, l.az, l.bx, l.bz) <= standIn) continue
      if (!lesson) {
        if (distToSpan(still.x, still.z, l.ax, l.az, l.bx, l.bz) > SIGNAL.laneReach) continue
        if (L.nextAt(l) - L.t <= LINE.signalQuietS) continue
      }
      // nearest to Still; the lesson's is the one nearest where it stands asleep
      const d = lesson ? distToSpan(this.home.x, this.home.z, l.ax, l.az, l.bx, l.bz) : distToSpan(still.x, still.z, l.ax, l.az, l.bx, l.bz)
      if (d < bestD) {
        bestD = d
        best = l
      }
    }
    return best
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.timer -= ms
    this.reload -= ms
    this.bob += dt * 4
    this.flash = Math.max(0, this.flash - dt * 6)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.max(0.001, Math.hypot(dx, dz))
    const staggered = slide(this.pos, this.knock, dt)

    switch (this.phase) {
      case 'approach': {
        if (staggered) break
        let mx = 0
        let mz = 0
        // the sentinel's band with its own numbers; it needs no sight to call, only to get near enough to
        const sight = terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2, true)
        if (!sight) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
          const sd = Math.hypot(to.x - this.pos.x, to.z - this.pos.z) || 1
          mx = (to.x - this.pos.x) / sd
          mz = (to.z - this.pos.z) / sd
        } else if (dist > SIGNAL.preferMax) {
          mx = dx / dist
          mz = dz / dist
        } else if (dist < SIGNAL.preferMin) {
          mx = -dx / dist
          mz = -dz / dist
        } else {
          // in the band: a slow drift sideways, flipping on a fixed beat (no dice: it must read the same every time)
          this.strafeTimer -= dt
          if (this.strafeTimer <= 0) {
            this.strafe *= -1
            this.strafeTimer = 1.6
          }
          mx = (dz / dist) * this.strafe * 0.55
          mz = (-dx / dist) * this.strafe * 0.55
        }
        this.pos.x += mx * SIGNAL.speed * this.speedMul * dt
        this.pos.z += mz * SIGNAL.speed * this.speedMul * dt
        this.stepping = Math.hypot(mx, mz)

        const lane = this.callable(ctx, ctx.player)
        // every lock is booked: two never land within BOOK_GAP of each other, so it waits (still moving)
        if (lane && ctx.canLock(SIGNAL.windupMs)) {
          ctx.book(this, SIGNAL.windupMs)
          this.phase = 'windup'
          this.timer = SIGNAL.windupMs
          this.calling = lane
          this.lessonCall = this.lessonLeft
        }
        break
      }
      case 'windup': {
        if (this.timer <= 0) this.call(ctx)
        break
      }
      case 'recover': {
        if (this.timer <= 0) {
          this.phase = 'approach'
          this.reload = this.nextReload
          this.nextReload = SIGNAL.reloadMs
          this.reel = -1
        }
        break
      }
    }

    terrain.pushOut(this.pos, this.radius)
    this.present(dt)
    return null
  }

  /** The arm is down: the Line is asked for the lane. */
  private call(ctx: EnemyCtx) {
    const lane = this.calling
    this.calling = null
    if (this.lessonCall) this.lessonLeft = false
    this.lessonCall = false
    this.phase = 'recover'
    this.timer = SIGNAL.recoverMs
    this.nextReload = SIGNAL.reloadMs
    if (!lane) return
    const called = ctx.line?.call(lane) ?? false
    ctx.emit({ kind: 'call', e: this, lane: lane.id, called })
  }

  /** The windup's progress, 0..1. */
  private progress() {
    return Math.min(1, Math.max(0, 1 - this.timer / SIGNAL.windupMs))
  }

  private present(dt: number) {
    const winding = this.phase === 'windup'
    const t = winding ? this.progress() : 0
    const maxArm = (SIGNAL.armDeg * Math.PI) / 180
    let click = 0
    if (winding) {
      // six ratchet clicks: at each the arm steps a sixth of the way (a quick throw, then it holds), the lamp flashes and settles
      const k = Math.min(SIGNAL.clicks - 1e-9, t * SIGNAL.clicks)
      const n = Math.floor(k)
      const f = k - n
      this.arm = (maxArm * (n + Math.min(1, f * 4))) / SIGNAL.clicks
      click = f
    } else this.arm = Math.max(0, this.arm - dt * (maxArm / 0.3))
    this.armPivot.rotation.z = this.arm
    const hot = winding ? t : this.arm / maxArm

    // the lamp: a banked coal awake, swelling deeper and redder over the windup; each click is a flash that settles (only dims from
    // the swell's colour, so INV-C1 holds at every tick)
    let scale = 1
    if (this.asleep) this.lampMat.color.setHex(CORE_ASLEEP)
    else {
      this.click.copy(LAMP_REST).lerp(SIGNAL_HOT, hot)
      if (winding) this.click.multiplyScalar(0.6 + 0.4 * (1 - click))
      if (this.reel >= 0) {
        // reeling: a pulse between its coal and the swell, deep, never amber
        this.reel += dt * 1000
        const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * REEL.hz * (this.reel / 1000))
        this.click.copy(LAMP_REST).lerp(SIGNAL_HOT, 0.4 + 0.6 * pulse)
      }
      this.lampMat.color.copy(this.click)
      scale = 1 + 0.3 * hot * (winding ? 0.7 + 0.3 * (1 - click) : 1)
    }
    this.lamp.scale.setScalar(Math.min(1.3, scale))
    const halo = this.asleep ? 0 : 0.12 + 0.55 * hot
    this.halo.material.opacity = halo
    this.halo.scale.setScalar(0.7 + 0.6 * hot)

    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    // walking: the whole post rocks on its legs
    const step = this.phase === 'approach' ? this.stepping : 0
    this.body.rotation.z = Math.sin(this.bob * 3.2) * 0.05 * step
    this.body.rotation.x = Math.cos(this.bob * 3.2) * 0.04 * step
    this.group.position.set(this.pos.x, Math.abs(Math.sin(this.bob * 3.2)) * 0.03 * step, this.pos.z)
    this.stepping *= 0.9
  }

  idle(dt: number, _face: THREE.Vector3) {
    this.bob += dt * (this.asleep ? 1.2 : 4)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.arm = 0
    this.armPivot.rotation.z = 0
    this.lampMat.color.setHex(this.asleep ? CORE_ASLEEP : LAMP_REST.getHex())
    this.lamp.scale.setScalar(1)
    this.halo.material.opacity = this.asleep ? 0 : 0.12
    this.halo.scale.setScalar(0.7)
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    this.body.rotation.set(0, 0, 0)
    this.group.position.set(this.pos.x, 0, this.pos.z)
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.4)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  /** A push, a part or a grab in the windup: no call, and it waits `interruptedMs` (a push also reels it open). */
  interrupt(reel = false) {
    if (this.phase !== 'windup') return false
    this.calling = null
    this.lessonCall = false
    this.phase = reel ? 'recover' : 'approach'
    this.timer = reel ? SIGNAL.recoverMs : 0
    if (reel) this.reel = 0
    // otherwise it re-winds on the same tick
    this.reload = SIGNAL.interruptedMs
    this.nextReload = reel ? SIGNAL.interruptedMs : SIGNAL.reloadMs
    return true
  }

  landsIn() {
    return this.phase === 'windup' ? Math.max(0, this.timer) : null
  }

  get walking() { return this.stepping > 0.3 && this.phase === 'approach' }
  get gait() { return this.bob * 3.2 }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    if (!asleep) {
      this.flash = 1
      // a beat to see the post first; the lesson's is none: it calls on waking (R10)
      this.reload = this.lessonLeft ? 0 : SIGNAL.wakeMs
    }
    this.phase = 'approach'
    this.calling = null
    this.lessonCall = false
    this.reel = -1
    this.lampMat.color.setHex(asleep ? CORE_ASLEEP : LAMP_REST.getHex())
  }

  /** The lamp's world position (the call's spark), written into `out`. */
  lampPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true)
    return this.lamp.getWorldPosition(out)
  }

  /** The arm's pivot, world (the tell breaking along the arm). */
  pivotPoint(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrixWorld(true)
    return this.armPivot.getWorldPosition(out)
  }

  /** The lamp's colour right now, for checks (INV-C1). */
  lampColor(): THREE.Color {
    return this.lampMat.color
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    disposeBody(this.group, this.tellGroup)
    this.halo.material.dispose()
  }
}
