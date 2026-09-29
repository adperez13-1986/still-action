import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Terrain } from './terrain'
import { haloTexture } from './vfx'
import { hideMaterials, finish, HIDES } from './hide'
import { RAIL_TOP, type SidingDef } from './line'
import { Charger, CHARGER } from './charger'
import { slide, turn, distToSegment, statusTint, REEL, CORE, CORE_ASLEEP, SLEEP_BODY, type EnemyAction, type EnemyCtx } from './enemy'

/**
 * The Handcar (design/area3/SPEC.md 6.2, STAGE-B.md 2.5): a rail cart with a see-saw pump lever that stands at one end of a dead
 * siding. It never walks and never follows Still: its one act is the ram's, down its own rails.
 *
 *   approach  at its end, facing the far one. Winds up when Still stands on the rails ahead of it (within hitHalf + trigger of the
 *             segment to the far end), the way is clear, the pack's token is free and a lock can be booked
 *   windup    tracking 0-495 ms, locked 495-900. The aim is the siding's own direction, so the lane is the whole siding ahead:
 *             it is always cut by the far buffer (`end === 'prop'`). A place tell (R1): the autos never break it (combat.ts
 *             `breakable`), a push, a part or a kill does, as the ram's
 *   strike    the rush to the far buffer, stopped dead: stunned 1200 (x1.5), then 400
 *   recover   it stands at the other end, turns back, reloads 1500
 *
 * A subclass of the ram, so every `instanceof Charger` path (the rush, the stun, trample, trip, Anvil, countTells, the break rule)
 * is the ram's, unchanged. The ram's rig is built by the Charger constructor and hidden; the Handcar draws its own.
 */
export const HANDCAR = {
  hp: 36, bodyRadius: 0.6,
  /** SPEC 6.2's speed: kept for the record, it has no use (it never walks: STAGE-B.md 7). */
  speed: 2.5,
  windupMs: 900, lockAt: 0.55,
  rushSpeed: 18, damage: 14, stunMs: 1200, stunMul: 1.5, reloadMs: 1500, tripRecoverMs: 1200,
  /** Still may stand this far off the rails' edge and still be ahead of it. */
  trigger: 0.6,
  /** Where it stands: this far in from a rail end (SPEC: +-(6 - 1.0) from the siding's centre). */
  inset: 1.0,
  /** The lane is cut this far past the far rail end, so the buffer's circle always meets it. */
  overrun: 1.0,
}

/** A dim seam awake: a banked coal. */
const SEAM_REST = new THREE.Color(CORE).multiplyScalar(0.3)
const SEAM_CORE = new THREE.Color(CORE)
/**
 * The seam locked: deeper and redder than CORE, never pale (hide.ts header; the crouch's lesson, enemy.ts CROUCH_HOT: a bright light
 * orange washes out to peach under ACES + bloom). INV-C1: its HSL lightness never exceeds CORE's, at any tick; every colour the seam
 * takes is CORE, this, or a mix of them and the dim rest, and the flicker only dims.
 */
const SEAM_HOT = new THREE.Color(0xff3812)
/** The stunned seam's low swing: a deep red coal (the hulk's crouch fix, 29 Sep: never the reel's amber 0xff8a3c, which washes to peach here). */
const SEAM_DEEP = new THREE.Color(0xa81c0a)
/** The halo over the lever, multiplied over the halo texture: red, so its additive heart stays out of peach. */
const HALO_TINT = 0xff3812
const BODY = HIDES.handcar.body
const JOINT = HIDES.handcar.joint
/** Bare iron where the plough meets the rails. */
const WORN = 0x5d5851
const WHITE = new THREE.Color(0xffffff)

/** Where a Handcar stands at rail end `end`: inset in along the siding. */
function standAt(sd: SidingDef, end: 'a' | 'b'): [number, number] {
  const len = Math.hypot(sd.bx - sd.ax, sd.bz - sd.az)
  const ux = (sd.bx - sd.ax) / len, uz = (sd.bz - sd.az) / len
  const s = end === 'a' ? 1 : -1
  const own = end === 'a' ? { x: sd.ax, z: sd.az } : { x: sd.bx, z: sd.bz }
  return [own.x + ux * s * HANDCAR.inset, own.z + uz * s * HANDCAR.inset]
}

/** Where a Handcar of this siding stands, and which way it looks: the rail end farther from `from` (the entrance room's centre), inset in; `face` is the far rail end. */
export function handcarSpot(sd: SidingDef, from: { x: number; z: number }): { x: number; z: number; end: 'a' | 'b'; face: { x: number; z: number } } {
  const end = Math.hypot(sd.ax - from.x, sd.az - from.z) >= Math.hypot(sd.bx - from.x, sd.bz - from.z) ? 'a' : 'b'
  const [x, z] = standAt(sd, end)
  return { x, z, end, face: end === 'a' ? { x: sd.bx, z: sd.bz } : { x: sd.ax, z: sd.az } }
}

/** Which rail end a point stands nearer: the end a member placed by `handcarSpot` stands at. */
export function handcarEnd(sd: SidingDef, x: number, z: number): 'a' | 'b' {
  return Math.hypot(x - sd.ax, z - sd.az) <= Math.hypot(x - sd.bx, z - sd.bz) ? 'a' : 'b'
}

/** A box with its placement baked in, so pieces of one material draw as one mesh. */
const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, d)
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, 0)), new THREE.Vector3(1, 1, 1)))
  return g
}
/** A cylinder whose axis runs along x (a wheel, an axle, the lever's pin). */
const roll = (r: number, len: number, x: number, y: number, z: number, seg = 10) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg)
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)))
  return g
}
const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts)!
  for (const p of parts) p.dispose()
  return g
}

export class Handcar extends Charger {
  readonly variant = 'handcar' as const
  /** The siding's unit axis (a to b), its centre and its rail length. */
  private readonly ux: number
  private readonly uz: number
  private readonly railLen: number

  // --- its rig (the ram's, in Charger, is hidden) ---
  private readonly rig = new THREE.Group()
  private readonly lever = new THREE.Group()
  private readonly cartMat: THREE.MeshStandardMaterial
  private readonly cartJoint: THREE.MeshStandardMaterial
  private readonly cartWorn: THREE.MeshStandardMaterial
  private readonly seamMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  private readonly halo: THREE.Sprite
  private readonly seamColor = new THREE.Color()
  /** Seconds it has been drawn: the pump's phase. */
  private cartT = 0
  /** The lever's angle now, rad: eased toward what its stage asks. */
  private leverRx = 0.12
  /** Whether the lock has been dressed (the seam's flash), and the seconds since. */
  private wasLocked = false
  private lockedFor = 0
  /** The stun's jolt: 0..1, springing back. */
  private jolt = 0

  private readonly siding: SidingDef

  constructor(siding: SidingDef, end: 'a' | 'b') {
    super(...standAt(siding, end))
    this.siding = siding
    this.railLen = Math.hypot(siding.bx - siding.ax, siding.bz - siding.az)
    this.ux = (siding.bx - siding.ax) / this.railLen
    this.uz = (siding.bz - siding.az) / this.railLen
    this.hp = HANDCAR.hp
    this.laneTell.trackWash = true
    // its own facing from the first frame: toward the far end
    this.facing = this.aimFor(this.farDir())
    this.aim = this.facing

    // the ram's rig, built by the Charger constructor, is hidden: this one is drawn
    this.grp.visible = false
    const hide = hideMaterials('handcar')
    this.cartMat = hide.mat
    this.cartJoint = hide.jointMat
    this.cartWorn = new THREE.MeshStandardMaterial({ color: WORN, roughness: 0.42, metalness: 0.78 })
    finish(this.cartWorn, { scale: [7, 7, 7], grain: 0.1, roughVar: 0.18, tone: [1, 1, 1], mask: 1, toneRough: 0, toneMetal: 0, bump: 0.25 })

    // the deck rides on the rails (y is measured from their top): 1.3 x 0.35 x 1.7 on four wheels, the plough on the leading end (+z)
    const deckY = 0.575
    const body = merged([
      box(1.3, 0.35, 1.7, 0, deckY, 0),
      // the two uprights the pump's pin runs through
      box(0.1, 0.4, 0.14, -0.15, 0.95, 0),
      box(0.1, 0.4, 0.14, 0.15, 0.95, 0),
      // the plough: a leaning wedge across the leading end, low
      box(1.1, 0.4, 0.16, 0, 0.36, 1.0, -0.5),
    ])
    const joint = merged([
      // wheels and axles
      roll(0.18, 0.07, -0.5, 0.18, 0.55), roll(0.18, 0.07, 0.5, 0.18, 0.55),
      roll(0.18, 0.07, -0.5, 0.18, -0.55), roll(0.18, 0.07, 0.5, 0.18, -0.55),
      roll(0.04, 1.0, 0, 0.18, 0.55, 6), roll(0.04, 1.0, 0, 0.18, -0.55, 6),
      // the deck's rim and the rear beam
      box(0.05, 0.07, 1.7, -0.625, deckY + 0.21, 0), box(0.05, 0.07, 1.7, 0.625, deckY + 0.21, 0),
      box(1.3, 0.07, 0.05, 0, deckY + 0.21, -0.825), box(1.3, 0.07, 0.05, 0, deckY + 0.21, 0.825),
      box(1.36, 0.16, 0.12, 0, 0.42, -0.9),
      // the pin
      roll(0.045, 0.44, 0, 1.05, 0, 8),
    ])
    const worn = merged([box(1.16, 0.06, 0.16, 0, 0.13, 1.12, -0.3), box(0.08, 0.34, 0.06, -0.5, 0.30, 1.12, -0.5), box(0.08, 0.34, 0.06, 0.5, 0.30, 1.12, -0.5)])
    this.rig.add(new THREE.Mesh(body, this.cartMat), new THREE.Mesh(joint, this.cartJoint), new THREE.Mesh(worn, this.cartWorn))

    // the pump: a 1.4 bar on the pin (pivot at 1.05), grips at both ends, the ember seam along its top
    const bar = new THREE.Mesh(merged([box(0.12, 0.1, 1.4, 0, 0, 0)]), this.cartMat)
    const grips = new THREE.Mesh(merged([box(0.34, 0.06, 0.07, 0, 0.04, -0.66), box(0.34, 0.06, 0.07, 0, 0.04, 0.66)]), this.cartJoint)
    const seam = new THREE.Mesh(box(0.07, 0.035, 1.22, 0, 0.07, 0), this.seamMat)
    seam.name = 'seam:handcar'
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: HALO_TINT, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }))
    this.halo.scale.setScalar(1.0)
    this.halo.position.set(0, 0.16, 0)
    this.lever.position.set(0, 1.05, 0)
    this.lever.add(bar, grips, seam, this.halo)
    this.rig.add(this.lever)
    this.rig.position.y = RAIL_TOP
    this.group.add(this.rig)
  }

  // --- where it is on its rails ---

  /** How far along the siding (a = 0, b = rail length) a point stands. */
  private along(x: number, z: number) {
    return (x - this.siding.ax) * this.ux + (z - this.siding.az) * this.uz
  }
  /** +1 when the far end is b (it stands nearer a), else -1. */
  private farDir() {
    return this.along(this.pos.x, this.pos.z) <= this.railLen / 2 ? 1 : -1
  }
  private aimFor(dir: number) {
    return Math.atan2(this.ux * dir, this.uz * dir)
  }
  private farEnd(dir: number) {
    return dir > 0 ? { x: this.siding.bx, z: this.siding.bz } : { x: this.siding.ax, z: this.siding.az }
  }

  /** INV-H1: its position stays within 0.05 of the siding's line and between its rail ends (a buffer's face is at the end, so a body's centre stops its radius short). */
  clampToSiding() {
    const r = this.radius
    const s = Math.max(r, Math.min(this.railLen - r, this.along(this.pos.x, this.pos.z)))
    this.pos.x = this.siding.ax + this.ux * s
    this.pos.z = this.siding.az + this.uz * s
  }

  // --- its thinking ---

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    this.tick(dt)
    // a shove moves it along its rails and no way else
    const along = this.knock.x * this.ux + this.knock.z * this.uz
    this.knock.set(this.ux * along, 0, this.uz * along)
    this.staggered = slide(this.pos, this.knock, dt)
    const dir = this.farDir()
    const far = this.farEnd(dir)
    let action: EnemyAction | null = null

    switch (this.phase) {
      case 'approach': {
        this.mode = 'hold'
        this.facing = turn(this.facing, this.aimFor(dir), CHARGER.turnRate * dt)
        if (this.staggered) break
        const lockMs = HANDCAR.windupMs * HANDCAR.lockAt
        // Still on the rails ahead of it (never beside its rear), the way clear to the buffer (the far stop, short of the buffer's own circle)
        const ahead = (target.x - this.pos.x) * this.ux * dir + (target.z - this.pos.z) * this.uz * dir >= 0
        const onRails = ahead && distToSegment(target.x, target.z, this.pos.x, this.pos.z, far.x, far.z) <= this.hitHalf + HANDCAR.trigger
        if (this.reload <= 0 && onRails
          && terrain.lineClear(this.pos.x, this.pos.z, far.x - this.ux * dir * 1.0, far.z - this.uz * dir * 1.0, CHARGER.bodyLanePad)
          && ctx.tokenFree(this) && ctx.canLock(lockMs)) {
          ctx.takeToken(this)
          ctx.book(this, lockMs)
          this.phase = 'windup'
          this.t = 0
          this.locked = false
          this.hug = 0
          this.aim = this.aimFor(dir)
          this.lane.nominal = this.railsTo(far) + HANDCAR.overrun
        }
        break
      }
      case 'windup': {
        const lockMs = HANDCAR.windupMs * HANDCAR.lockAt
        // it never follows Still: the aim is the siding's, the run always reaches the far buffer (a shove moves the lane with the body, honestly)
        this.aim = this.aimFor(dir)
        this.lane.nominal = this.railsTo(far) + HANDCAR.overrun
        this.facing = this.aim
        this.cut(terrain)
        if (!this.locked && this.t >= lockMs) {
          this.locked = true
          ctx.emit({ kind: 'lock', e: this, end: this.laneEnd(new THREE.Vector3()) })
        }
        if (this.t >= HANDCAR.windupMs) this.startRush()
        break
      }
      case 'strike':
        action = this.rushTick(dt, terrain, ctx)
        break
      case 'recover': {
        // held where it stopped while the hatch is open; then it turns back to face the far end again
        if (!this.stunned && !(this.tripped && this.t <= 250)) this.facing = turn(this.facing, this.aimFor(dir), CHARGER.turnRate * dt)
        if (this.t >= this.timer) {
          if (this.stunned) {
            this.stunned = false
            this.t = 0
            this.timer = CHARGER.stunRecoverMs
            ctx.emit({ kind: 'stunEnd', e: this })
          } else {
            this.phase = 'approach'
            this.tripped = false
            this.reload = HANDCAR.reloadMs
            this.t = 0
          }
        }
        break
      }
    }

    if (!this.rushing) terrain.pushOut(this.pos, this.radius)
    this.clampToSiding()
    this.present(dt)
    return action
  }

  /** How far from here to a rail end, along the siding. */
  private railsTo(end: { x: number; z: number }) {
    return Math.abs(this.along(end.x, end.z) - this.along(this.pos.x, this.pos.z))
  }

  /** Asleep, or walking home (it never does), or carried in the clamp's throw: it looks along its rails, and stays on them. */
  idle(dt: number, _face: THREE.Vector3) {
    const dir = this.farDir()
    super.idle(dt, new THREE.Vector3(this.pos.x + this.ux * dir * 10, 0, this.pos.z + this.uz * dir * 10))
    this.clampToSiding()
  }

  setAsleep(asleep: boolean) {
    super.setAsleep(asleep)
    // a beat to see it before it first tracks: the SPEC's reload is 1500, at waking too
    if (!asleep) this.reload = HANDCAR.reloadMs
    this.wasLocked = false
  }

  // --- world points for effects: its own, the ram's are hidden ---

  private rigAt(out: THREE.Vector3, x: number, y: number, z: number) {
    this.group.updateMatrixWorld(true)
    return this.rig.localToWorld(out.set(x, y, z))
  }
  hoof(i: number, out: THREE.Vector3) { return this.rigAt(out, i % 2 ? 0.5 : -0.5, 0, i < 2 ? 0.55 : -0.55) }
  stackMouth(out: THREE.Vector3, _i = 0) { return this.rigAt(out, 0, 1.2, 0) }
  frontMid(out: THREE.Vector3) { return this.rigAt(out, 0, 0.1, 0.95) }
  hoofMid(out: THREE.Vector3) { return this.rigAt(out, 0, 0.1, 0) }
  rearMid(out: THREE.Vector3) { return this.rigAt(out, 0, 0.1, -0.9) }
  prowPoint(out: THREE.Vector3) { return this.rigAt(out, 0, 0.35, 1.05) }
  fireboxPoint(out: THREE.Vector3) { return this.rigAt(out, 0, 1.1, 0) }
  /** The seam's middle: where a lock or a broken tell sparks. */
  seamPoint(out: THREE.Vector3) { return this.rigAt(out, 0, 1.12, 0) }

  // --- presentation ---

  /** The ram's hidden rig (and the group's place, and the lane's tell, with trackWash) first; then the cart's own. */
  protected present(dt: number) {
    super.present(dt)
    this.cartT += dt
    const t = this.cartT
    const s = this.t / 1000
    const tw = this.t
    const stunned = this.stunned && this.phase === 'recover'
    let rx = 0.12
    let seam: THREE.Color = SEAM_REST
    let halo = 0.1
    let shake = 0

    if (this.asleep) {
      // the lever rests on its stop, the seam a cold coal
      rx = 0.12
      seam = this.seamColor.setHex(CORE_ASLEEP)
      halo = 0
    } else if (this.phase === 'windup' && !this.locked) {
      // tracking: the pump clanks at 3 Hz, the seam pulsing with each stroke
      const stroke = Math.sin(Math.PI * 2 * 3 * t)
      rx = 0.3 * stroke
      const pulse = 0.5 + 0.5 * stroke
      seam = this.seamColor.copy(SEAM_REST).lerp(SEAM_CORE, 0.3 + 0.7 * pulse * (0.4 + 0.6 * (tw / (HANDCAR.windupMs * HANDCAR.lockAt))))
      halo = 0.18 + 0.2 * pulse
    } else if (this.phase === 'windup' || this.phase === 'strike') {
      // locked (and running): the lever thrown down and held, shivering; the seam goes deeper and redder, and flickers (it only dims)
      if (this.phase === 'windup') this.lockedFor = this.wasLocked ? this.lockedFor + dt : 0
      this.wasLocked = true
      rx = -0.36 + Math.sin(Math.PI * 2 * 30 * t) * 0.012
      const sw = Math.min(1, (this.phase === 'strike' ? 1 : this.lockedFor / 0.12))
      seam = this.seamColor.copy(SEAM_CORE).lerp(SEAM_HOT, sw)
      seam.multiplyScalar(0.78 + 0.22 * Math.sin(Math.PI * 2 * 22 * t))
      halo = 0.55
      shake = this.phase === 'strike' ? 0.012 : 0.006
    } else if (stunned) {
      // buried in the buffer, hatch open: the lever dropped to its stop, the seam pulsing as a reel does (the firebox's amber)
      this.wasLocked = false
      if (tw < 20) this.jolt = 1
      rx = -0.5 + 0.06 * Math.sin(s * 40) * Math.max(0, 1 - s / 0.6)
      // it swings between a deep coal and SEAM_HOT (never CORE's lightness), flickering at 18 Hz: textured in time, not a flat slab
      const pulse = 0.5 + 0.5 * Math.sin(Math.PI * 2 * REEL.hz * s)
      seam = this.seamColor.copy(SEAM_DEEP).lerp(SEAM_HOT, pulse)
      seam.multiplyScalar(0.72 + 0.28 * Math.sin(Math.PI * 2 * 18 * s))
      halo = 0.15 + 0.15 * pulse
    } else {
      this.wasLocked = false
      // approach, waiting: a banked coal
      rx = 0.12 + (this.staggered ? -0.1 : 0) + 0.015 * Math.sin(Math.PI * 2 * 0.8 * t)
      seam = SEAM_REST
      halo = 0.1
    }

    const k = Math.min(1, dt * 22)
    this.leverRx += (rx - this.leverRx) * (dt > 0 ? k : 1)
    this.lever.rotation.x = this.leverRx
    this.seamMat.color.copy(seam)
    this.halo.material.opacity = halo
    this.halo.scale.setScalar(0.8 + 0.5 * (this.locked || this.rushing ? 1 : 0))

    // the buffer's blow: the cart squashes and rebounds over 0.2 s
    this.jolt = Math.max(0, this.jolt - dt * 5)
    const j = this.jolt
    this.rig.scale.set(1 + 0.05 * j, 1 + 0.06 * j, 1 - 0.14 * j)
    this.rig.position.set(Math.sin(t * 90) * shake, RAIL_TOP, 0)
    this.rigTint()
  }

  /** The body's colours: its metal, dark and cold asleep, frost and flight as any body's, the hit flash whitening it. */
  private rigTint() {
    for (const [m, base] of [[this.cartMat, BODY], [this.cartJoint, JOINT], [this.cartWorn, WORN]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiply(SLEEP_BODY)
    }
    statusTint(this.cartJoint, this.cartMat, this.rime, this.air)
    // the worn edge doesn't flash: bare iron stays bare iron
    for (const m of [this.cartMat, this.cartJoint]) {
      m.color.lerp(WHITE, this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  /** The seam's colour right now, for checks (INV-C1). */
  seamColorNow(): THREE.Color {
    return this.seamMat.color
  }

  dispose(scene: THREE.Scene) {
    // the halo is a sprite: disposeBody (the meshes) doesn't reach its material
    this.halo.material.dispose()
    super.dispose(scene)
  }
}
