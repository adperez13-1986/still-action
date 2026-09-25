import * as THREE from 'three'
import { HIDES, hideMaterials } from './hide'
import type { Terrain } from './terrain'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, trackingDim, tellOrder, haloTexture, meltMaterial } from './vfx'
import { rod } from './ranged'
import {
  slide, statusTint, disposeBody, reelCore, REEL, CORE, CORE_ASLEEP,
  type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase,
} from './enemy'

/**
 * The Lobber (design/content/SPEC.md §6.3): a sentinel variant, a squat crucible on
 * three legs that lobs shells over walls, by the same rule as Still's Flare. It
 * needs no line, only range, so hiding doesn't stop it: moving does. Its shell is a
 * floor hazard (a ring r 1.6 that fills for the 1000 ms flight), so the landing is
 * drawn = hit, and the slack is 1000 − 300 − 291 = 409 ms from the launch.
 *
 *   approach  holds 8-12 u: closes, backs off, or strafes in the band
 *   windup    620 ms: tilts back, the molten disc swells, a faint ring follows his lead point
 *   launch    the ring freezes; the shell flies; recover 500, reload 2400 from the launch
 */
export const LOBBER = {
  hp: 22, speed: 3.2, bodyRadius: 0.5, height: 1.5, labelY: 2.0,
  preferMin: 8, preferMax: 12, fireRange: 13,
  windupMs: 620, flightMs: 1000, r: 1.6, damage: 10, lead: 0.3, leadMax: 2.0, arcPeak: 3.2,
  recoverMs: 500, reloadMs: 2400,
  /** A Parry or a grab in the windup: the ring goes, and it waits this long. */
  interruptReloadMs: 1500,
}

/** A cast crucible of tarnished copper, gone to dark verdigris: the sentinel's tripod in another metal. */
const BODY = HIDES.lobber.body
const JOINT = HIDES.lobber.joint
/** Where the shell leaves from: the crucible's mouth. */
const MOUTH_Y = 1.45
/** The glow over the melt: ember-tinted, and faint enough that the melt's texture shows through it. */
const HALO = { color: 0xff8a3c, idle: 0.22, swell: 0.55 }

export class Lobber implements Enemy {
  readonly kind = 'ranged'
  readonly variant = 'lobber'
  readonly labelY = LOBBER.labelY
  get radius() { return LOBBER.bodyRadius * this.size }
  readonly windupMs = LOBBER.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  /** World space: the tracking ring, laid at the lead point. */
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = LOBBER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  readonly height = LOBBER.height
  rime = 0
  air = 0
  /** Its shell is in the air: committed. Read by Combat for the crowd of tells. */
  locked = false
  get walking() { return this.stepping > 0.3 && this.phase === 'approach' }
  get gait() { return this.bob * 3 }

  private timer = 0
  private reload = LOBBER.reloadMs * 0.5
  /** ms its shell has left to fly: `locked` while it's up. */
  private flying = 0
  private flash = 0
  private bob = Math.random() * 10
  private stepping = 0
  private strafe = Math.random() < 0.5 ? 1 : -1
  private strafeTimer = 1 + Math.random() * 2
  private facing = 0
  private asleep = false
  private recoil = 0
  /** A push broke its aim: reeling open through its recover (ms in). -1 when not. */
  private reel = -1
  /** Where the shell will land: tracking in the windup, frozen at the launch. */
  readonly lead = new THREE.Vector3()

  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  /** The melt's heat: lit, banked asleep, pulsing while it reels. Its disc's shader reads it. */
  private readonly coreColor = new THREE.Color(CORE)
  private readonly coreMat: THREE.ShaderMaterial
  private readonly pot = new THREE.Group()
  private readonly disc: THREE.Mesh
  private readonly halo: THREE.Sprite
  private readonly legs = new THREE.Group()
  private readonly ringMat: THREE.ShaderMaterial
  private readonly ring: THREE.Mesh

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)
    const hide = hideMaterials('lobber')
    this.mat = hide.mat
    this.jointMat = hide.jointMat

    // the sentinel's tripod, squatter: knees at 0.9, feet splayed 0.9 out
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const hip = new THREE.Vector3(Math.sin(a) * 0.22, 1.0, Math.cos(a) * 0.22)
      const knee = new THREE.Vector3(Math.sin(a) * 0.6, 0.9, Math.cos(a) * 0.6)
      const foot = new THREE.Vector3(Math.sin(a) * 0.9, 0.02, Math.cos(a) * 0.9)
      const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), this.jointMat)
      kneeBall.position.copy(knee)
      this.legs.add(rod(hip, knee, 0.08, this.mat), rod(knee, foot, 0.07, this.mat), kneeBall)
    }

    // the crucible: open at the top, a molten disc inside its lip is its face and its tell
    this.pot.position.y = 1.0
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.3, 0.5, 12, 1, true), this.mat)
    shell.position.y = 0.25
    shell.material.side = THREE.DoubleSide
    const base = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), this.jointMat)
    base.rotation.x = Math.PI / 2
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 16), this.jointMat)
    lip.rotation.x = Math.PI / 2
    lip.position.y = 0.5
    // molten metal, not a flat light: a churning core under drifting crust, slag at the rim.
    // Unfogged, by the lights-out rule.
    this.coreMat = meltMaterial(0.36, this.coreColor)
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(0.36, 32), this.coreMat)
    this.disc.rotation.x = -Math.PI / 2
    this.disc.position.y = 0.42
    // tinted down to ember and kept faint: the shared halo at full, added over the melt, washed it salmon
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTexture(), color: HALO.color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }))
    this.halo.scale.setScalar(0.7)
    this.halo.material.opacity = HALO.idle
    this.halo.position.y = 0.55
    this.pot.add(shell, base, lip, this.disc, this.halo)
    this.group.add(this.legs, this.pot)

    // the tracking ring: faint, following his lead point until it freezes into the shell's own ring
    this.ringMat = tellMaterial('radial', LOBBER.r)
    this.ring = new THREE.Mesh(new THREE.RingGeometry(LOBBER.r - 0.1, LOBBER.r, 48), this.ringMat)
    this.ring.rotation.x = -Math.PI / 2
    this.tellGroup.add(this.ring)
    this.tellGroup.position.y = DECAL_Y
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

  /** In the windup only: the ring goes, and the shell never comes. Once it's launched, it's committed. */
  interrupt(reel = false) {
    if (this.phase !== 'windup') return false
    this.phase = reel ? 'recover' : 'approach'
    this.timer = reel ? LOBBER.recoverMs : 0
    if (reel) this.reel = 0
    this.reload = LOBBER.interruptReloadMs
    this.ringMat.opacity = 0
    return true
  }

  /** Until the launch: once the shell is up, it's the floor's and nothing breaks it. */
  landsIn() {
    return this.phase === 'windup' ? Math.max(0, this.timer) : null
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.timer -= ms
    this.reload -= ms
    this.flying = Math.max(0, this.flying - ms)
    this.locked = this.flying > 0
    this.bob += dt * 4
    this.flash = Math.max(0, this.flash - dt * 6)
    this.recoil = Math.max(0, this.recoil - dt * 5)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.max(0.001, Math.hypot(dx, dz))
    this.facing = Math.atan2(dx, dz)
    let action: EnemyAction | null = null
    const staggered = slide(this.pos, this.knock, dt)

    switch (this.phase) {
      case 'approach': {
        if (staggered) break
        let mx = 0
        let mz = 0
        if (dist > LOBBER.preferMax) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
          const sd = Math.hypot(to.x - this.pos.x, to.z - this.pos.z) || 1
          mx = (to.x - this.pos.x) / sd
          mz = (to.z - this.pos.z) / sd
        } else if (dist < LOBBER.preferMin) {
          // straight away, stopping at a wall (clampMove below)
          mx = -dx / dist
          mz = -dz / dist
        } else {
          this.strafeTimer -= dt
          if (this.strafeTimer <= 0) {
            this.strafe *= -1
            this.strafeTimer = 1.2 + Math.random() * 1.8
          }
          mx = (dz / dist) * this.strafe * 0.55
          mz = (-dx / dist) * this.strafe * 0.55
        }
        const sp = LOBBER.speed * this.speedMul * dt
        const to = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + mx * sp, this.pos.z + mz * sp, this.radius)
        this.pos.x = to.x
        this.pos.z = to.z
        this.stepping = Math.hypot(mx, mz)
        // no line needed: the Flare's rule. Its lock is the launch, booked like every other.
        if (this.reload <= 0 && dist <= LOBBER.fireRange && ctx.canLock(LOBBER.windupMs)) {
          ctx.book(this, LOBBER.windupMs)
          this.phase = 'windup'
          this.timer = LOBBER.windupMs
          this.aimAt(target, ctx, terrain)
        }
        break
      }
      case 'windup': {
        this.aimAt(target, ctx, terrain)
        if (this.timer <= 0) {
          // the launch: L freezes, and the shell is the floor's now
          this.phase = 'strike'
          this.timer = 1000 / 60
          this.flying = LOBBER.flightMs
          this.locked = true
          this.recoil = 1
          this.reload = LOBBER.reloadMs
          ctx.emit({ kind: 'lock', e: this, end: this.lead.clone() })
          action = {
            kind: 'hazard',
            spec: {
              source: 'shell', shape: { kind: 'circle', x: this.lead.x, z: this.lead.z, r: LOBBER.r },
              armMs: LOBBER.flightMs, liveMs: 0, damage: LOBBER.damage, cover: 'none', hurt: 'hazard', owner: this,
              flight: { x: this.pos.x, y: MOUTH_Y * this.size, z: this.pos.z, peak: LOBBER.arcPeak },
            },
          }
        }
        break
      }
      case 'strike':
        if (this.timer <= 0) {
          this.phase = 'recover'
          this.timer = LOBBER.recoverMs
        }
        break
      case 'recover':
        if (this.timer <= 0) {
          this.phase = 'approach'
          if (this.reel >= 0) this.coreColor.setHex(CORE)
          this.reel = -1
        }
        break
    }
    terrain.pushOut(this.pos, this.radius)
    this.present(dt)
    return action
  }

  /**
   * Where he'll be: his velocity × 0.3 s on, at most 2 u, stepped back toward it 0.5 u at a
   * time while that's inside something. A decoy doesn't move, so it's aimed at as it stands.
   */
  private aimAt(target: THREE.Vector3, ctx: EnemyCtx, terrain: Terrain) {
    const onStill = target === ctx.player
    let lx = onStill ? ctx.playerVel.x * LOBBER.lead : 0
    let lz = onStill ? ctx.playerVel.z * LOBBER.lead : 0
    const l = Math.hypot(lx, lz)
    if (l > LOBBER.leadMax) {
      lx *= LOBBER.leadMax / l
      lz *= LOBBER.leadMax / l
    }
    this.lead.set(target.x + lx, 0, target.z + lz)
    const bx = this.pos.x - this.lead.x
    const bz = this.pos.z - this.lead.z
    const bd = Math.hypot(bx, bz)
    for (let k = 0; k < 24 && bd > 0.01 && terrain.blocked(this.lead.x, this.lead.z, 0.01); k++) {
      this.lead.x += (bx / bd) * 0.5
      this.lead.z += (bz / bd) * 0.5
    }
  }

  private present(dt: number) {
    const winding = this.phase === 'windup'
    const t = winding ? Math.min(1, Math.max(0, 1 - this.timer / LOBBER.windupMs)) : 0
    // the ring: faint while it follows (fainter while another tell is locked); it goes at the launch,
    // where the shell's own ring takes over
    this.ringMat.opacity = winding ? 0.16 * trackingDim() : Math.max(0, this.ringMat.opacity - dt * 8)
    this.ring.renderOrder = tellOrder(winding ? this.timer + LOBBER.flightMs : 0)
    this.tellGroup.position.set(this.lead.x, DECAL_Y, this.lead.z)
    this.ring.visible = this.ringMat.opacity > 0.002

    // tilted back toward him as it aims, the disc swelling; a kick at the launch
    const tilt = winding ? 0.5 * t : this.recoil * 0.3
    this.pot.rotation.x = -tilt
    this.disc.scale.setScalar(1 + (winding ? 0.4 * t : 0))
    this.coreMat.uniforms.uSwell!.value = winding ? t : 0
    if (this.reel >= 0) {
      // reeling: the crucible knocked over toward its lip, the melt open and pulsing hot
      this.reel += dt * 1000
      this.pot.rotation.x = 0.45
      reelCore(this.coreColor, CORE, this.reel / 1000)
      this.disc.scale.setScalar(1.25)
      this.coreMat.uniforms.uSwell!.value = 0.6
    }
    this.halo.scale.setScalar(0.7 + (winding ? 0.5 * t : 0))
    this.halo.material.opacity = this.asleep ? 0 : HALO.idle + (winding ? (HALO.swell - HALO.idle) * t : 0)
    this.pot.position.y = 1.0 - this.recoil * 0.08

    const step = this.phase === 'approach' ? this.stepping : 0
    this.legs.rotation.z = Math.sin(this.bob * 3) * 0.08 * step
    this.stepping *= 0.9
    this.group.position.set(this.pos.x, Math.sin(this.bob) * 0.03, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt * (this.asleep ? 1.2 : 4)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 8)
    this.ring.visible = this.ringMat.opacity > 0.002
    this.facing = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.group.position.set(this.pos.x, Math.sin(this.bob) * 0.02, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    // asleep: sunk on its knees, the pot tipped forward
    this.pot.rotation.x = this.asleep ? 0.35 : 0
    this.pot.position.y = this.asleep ? 0.85 : 1.0
    this.halo.material.opacity = this.asleep ? 0 : HALO.idle
    this.tint()
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.45)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreColor.setHex(asleep ? CORE_ASLEEP : CORE)
    if (!asleep) {
      this.flash = 1
      this.reload = LOBBER.reloadMs * 0.5
    }
    this.phase = 'approach'
    this.reel = -1
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group, this.tellGroup)
    this.tellGroup.remove(this.ring)
    this.ring.geometry.dispose()
    releaseTell(this.ringMat)
    disposeBody(this.group)
    this.halo.material.dispose()
  }
}
