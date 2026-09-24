import * as THREE from 'three'
import type { Terrain } from './terrain'

/**
 * Every archetype is the same machine: approach, windup, strike, recover.
 * The windup is the game — everything else is scaffolding around it.
 */
export type EnemyPhase = 'approach' | 'windup' | 'strike' | 'recover'

/** What an enemy does to the world on the tick it strikes. Combat resolves it. */
export type EnemyAction =
  | { kind: 'melee'; damage: number }
  | { kind: 'shot'; dir: THREE.Vector3; damage: number }

/** A shove is a velocity that bleeds off, not a teleport: slide distance = speed / decay. */
export const KNOCK_DECAY = 9
/** Above this speed an enemy is sliding and can't advance or start a windup. */
const STAGGER_SPEED = 1.5

/** Integrates knockback. Returns true while the enemy is still sliding. */
export function slide(pos: THREE.Vector3, knock: THREE.Vector3, dt: number): boolean {
  pos.addScaledVector(knock, dt)
  knock.multiplyScalar(Math.exp(-KNOCK_DECAY * dt))
  return knock.lengthSq() > STAGGER_SPEED * STAGGER_SPEED
}

/** The velocity that slides something `distance` units along (dx, dz). */
export function shoveVelocity(dx: number, dz: number, distance: number): THREE.Vector3 {
  const len = Math.hypot(dx, dz) || 1
  return new THREE.Vector3((dx / len) * distance * KNOCK_DECAY, 0, (dz / len) * distance * KNOCK_DECAY)
}

export interface Enemy {
  readonly kind: 'chaser' | 'ranged'
  readonly group: THREE.Group
  /** Telegraphs live in world space, not under the body, so a lunge can't scale them. */
  readonly tellGroup: THREE.Group
  readonly pos: THREE.Vector3
  readonly windupMs: number
  /** Knockback velocity. Combat adds to it; the enemy slides it off. */
  readonly knock: THREE.Vector3
  hp: number
  phase: EnemyPhase
  dead: boolean
  /** Damage taken is multiplied by this. Elites and their wards change it. */
  armor: number
  speedMul: number
  /** Knockback taken is multiplied by this. */
  knockMul: number
  /** Overall scale; an elite leader stands bigger than its pack. */
  size: number
  hit: (damage: number) => boolean
  update: (dt: number, target: THREE.Vector3, terrain: Terrain) => EnemyAction | null
  /** Presentation only, no thinking: while asleep, or walking home. `face` is where to look. */
  idle: (dt: number, face: THREE.Vector3) => void
  /** Dim and dark-cored while asleep; a flash on waking. */
  setAsleep: (asleep: boolean) => void
  dispose: (scene: THREE.Scene) => void
}

const SLEEP_BODY = new THREE.Color(0.35, 0.35, 0.38)
const CORE_ASLEEP = 0x2a1512

/** Dark rusted iron. Red belongs to the enemies: their cores and their tells. */
const BODY = 0x5b3b35
const JOINT = 0x2b2426
const CORE = 0xff5a3c

function cyl(r0: number, r1: number, len: number, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), mat)
  m.position.y = y
  return m
}

export const CHASER = {
  hp: 30,
  speed: 4.3,
  bodyRadius: 0.55,
  strikeRange: 2.0,
  strikeRadius: 2.4,
  damage: 9,
  windupMs: 520,
  recoverMs: 760,
}

/** Closes, telegraphs a ring, strikes where the ring is. */
export class Chaser implements Enemy {
  readonly kind = 'chaser'
  readonly windupMs = CHASER.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = CHASER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1

  private timer = 0
  private flash = 0
  private bob = Math.random() * 10
  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly core: THREE.Mesh
  private readonly coreMat: THREE.MeshBasicMaterial
  /** The hulk's rig: hinged at the hips, shoulders and legs so it can rear and slam. */
  private readonly torso = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private pose = { lean: 0, arms: 0, squash: 1 }
  private asleep = false
  /** Lives in world space, NOT under the body — the lunge must not scale the tell. */
  readonly tellGroup = new THREE.Group()
  private readonly disc: THREE.Mesh
  private readonly ringMat: THREE.MeshBasicMaterial
  private readonly discMat: THREE.MeshBasicMaterial

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A headless hulk: broad, low, heavy fists. The core in its chest is its face.
    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.7, metalness: 0.45 })
    this.jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })

    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.26, 0.5, 0)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.38), this.jointMat)
      foot.position.set(0, -0.44, 0.05)
      leg.add(cyl(0.13, 0.15, 0.42, this.jointMat, -0.2), foot)
    }

    this.torso.position.y = 0.5
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), this.mat)
    chest.scale.set(1.05, 0.8, 0.85)
    chest.position.y = 0.48
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 6, 18), this.jointMat)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.3
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.5), this.mat)
    yoke.position.y = 0.84

    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE })
    this.core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.12), this.coreMat)
    this.core.position.set(0, 0.5, 0.4)
    this.torso.add(chest, band, yoke, this.core)

    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), this.mat)
      shoulder.position.set(side * 0.56, 0.78, 0)
      arm.position.set(side * 0.62, 0.74, 0)
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.3), this.mat)
      fist.position.y = -0.82
      arm.add(cyl(0.1, 0.11, 0.36, this.jointMat, -0.18), cyl(0.18, 0.13, 0.4, this.mat, -0.52), fist)
      this.torso.add(shoulder, arm)
    }

    // Outer ring is fixed at the real strike radius so the danger zone never moves.
    // The inner disc fills it over the windup, so growth reads as a clock.
    this.ringMat = new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0, depthWrite: false })
    const ring = new THREE.Mesh(new THREE.RingGeometry(CHASER.strikeRadius - 0.1, CHASER.strikeRadius, 48), this.ringMat)
    ring.rotation.x = -Math.PI / 2

    this.discMat = new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0, depthWrite: false })
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(CHASER.strikeRadius, 48), this.discMat)
    this.disc.rotation.x = -Math.PI / 2
    this.disc.scale.setScalar(0.001)

    this.tellGroup.position.y = 0.03
    this.tellGroup.add(ring, this.disc)

    this.group.add(this.legL, this.legR, this.torso)
  }

  /** Lean, raised fists and squash, eased toward a target so the slam has weight. */
  private strikePose(dt: number, target: { lean: number; arms: number; squash: number }, snap = false) {
    const k = snap ? 1 : Math.min(1, dt * 14)
    this.pose.lean += (target.lean - this.pose.lean) * k
    this.pose.arms += (target.arms - this.pose.arms) * k
    this.pose.squash += (target.squash - this.pose.squash) * k
    this.torso.rotation.x = this.pose.lean
    this.armL.rotation.x = this.pose.arms
    this.armR.rotation.x = this.pose.arms
    this.torso.scale.set(1 / Math.sqrt(this.pose.squash), this.pose.squash, 1 / Math.sqrt(this.pose.squash))
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiply(SLEEP_BODY)
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
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

  update(dt: number, target: THREE.Vector3, terrain: Terrain): EnemyAction | null {
    this.timer -= dt * 1000
    this.bob += dt * 5
    this.flash = Math.max(0, this.flash - dt * 6)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    let action: EnemyAction | null = null
    const staggered = slide(this.pos, this.knock, dt)

    switch (this.phase) {
      case 'approach': {
        if (staggered) break
        // no striking through a wall, even a low one: close in until the way is clear
        if (dist > CHASER.strikeRange || !terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, CHASER.bodyRadius)
          const sx = to.x - this.pos.x
          const sz = to.z - this.pos.z
          const sd = Math.hypot(sx, sz) || 1
          this.pos.x += (sx / sd) * CHASER.speed * this.speedMul * dt
          this.pos.z += (sz / sd) * CHASER.speed * this.speedMul * dt
        } else {
          this.phase = 'windup'
          this.timer = CHASER.windupMs
        }
        break
      }
      case 'windup': {
        if (this.timer <= 0) {
          this.phase = 'strike'
          // committed: the strike lands where the ring is, whether you left or not
          if (dist <= CHASER.strikeRadius) action = { kind: 'melee', damage: CHASER.damage }
          this.timer = 90
        }
        break
      }
      case 'strike': {
        if (this.timer <= 0) {
          this.phase = 'recover'
          this.timer = CHASER.recoverMs
        }
        break
      }
      case 'recover': {
        if (this.timer <= 0) this.phase = 'approach'
        break
      }
    }

    terrain.pushOut(this.pos, CHASER.bodyRadius)

    // --- presentation ---
    const winding = this.phase === 'windup'
    const t = winding ? Math.min(1, Math.max(0, 1 - this.timer / CHASER.windupMs)) : 0

    if (winding) {
      this.ringMat.opacity = 0.42
      this.discMat.opacity = 0.3
      this.disc.scale.setScalar(Math.max(0.001, t))
    } else if (this.phase === 'strike') {
      this.ringMat.opacity = 0.95
      this.discMat.opacity = 0.8
      this.disc.scale.setScalar(1)
    } else {
      // fade out rather than snapping off
      this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
      this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    }
    this.tellGroup.position.set(this.pos.x, 0.03, this.pos.z)

    // winding: rear back and raise both fists. strike: slam them into the floor.
    if (winding) this.strikePose(dt, { lean: -0.32 * t, arms: -2.5 * t, squash: 1 + 0.06 * t })
    else if (this.phase === 'strike') this.strikePose(dt, { lean: 0.42, arms: -0.55, squash: 0.86 }, true)
    else this.strikePose(dt * 0.5, { lean: 0.08, arms: 0, squash: 1 })
    this.core.scale.setScalar(1 + (winding ? t * 0.7 : 0))

    const walking = this.phase === 'approach' && !staggered
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.4 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride

    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    this.group.position.set(this.pos.x, walking ? Math.abs(Math.sin(this.bob * 1.6)) * 0.05 : 0, this.pos.z)
    this.group.rotation.y = Math.atan2(dx, dz)

    return action
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt * (this.asleep ? 1.5 : 5)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
    this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    this.tellGroup.position.set(this.pos.x, 0.03, this.pos.z)
    this.group.position.set(this.pos.x, Math.sin(this.bob) * (this.asleep ? 0.02 : 0.06), this.pos.z)
    this.group.rotation.y = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    // asleep: slumped forward, fists on the floor
    this.strikePose(dt, this.asleep ? { lean: 0.38, arms: -0.2, squash: 0.95 } : { lean: 0.08, arms: 0, squash: 1 })
    const walking = !this.asleep
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.3 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride
    this.tint()
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? CORE_ASLEEP : CORE)
    if (!asleep) this.flash = 1
    this.phase = 'approach'
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    this.mat.dispose()
    this.jointMat.dispose()
    this.coreMat.dispose()
    this.ringMat.dispose()
    this.discMat.dispose()
  }
}
