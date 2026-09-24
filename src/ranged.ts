import * as THREE from 'three'
import { pushOutOfColliders, ARENA_RADIUS, type Collider } from './world'
import { slide, type Enemy, type EnemyAction, type EnemyPhase } from './enemy'

const BODY = 0x4e2438
const CORE = 0xff5a3c

export const RANGED = {
  hp: 20,
  speed: 3.4,
  bodyRadius: 0.5,
  /** Holds this band: just past auto-attack reach, so you have to go and get it. */
  preferMin: 6,
  preferMax: 10,
  /** Won't start a windup from further out than this. */
  fireRange: 12,
  windupMs: 760,
  /** Fraction of the windup spent tracking you. After it, the line freezes: that's your cue. */
  lockAt: 0.6,
  recoverMs: 520,
  reloadMs: 1500,
  damage: 8,
  aimLength: 16,
}

/** A floor strip starting at the enemy and running along local +z. */
function strip(width: number, length: number) {
  const g = new THREE.PlaneGeometry(width, length)
  g.translate(0, length / 2, 0)
  g.rotateX(Math.PI / 2)
  return g
}

/** Keeps its distance, telegraphs a line, fires down it. Walls block the shot. */
export class Ranged implements Enemy {
  readonly kind = 'ranged'
  readonly windupMs = RANGED.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = RANGED.hp
  phase: EnemyPhase = 'approach'
  dead = false

  private timer = 0
  private reload = RANGED.reloadMs * 0.6
  private flash = 0
  private recoil = 0
  private bob = Math.random() * 10
  private strafe = Math.random() < 0.5 ? 1 : -1
  private strafeTimer = 1 + Math.random() * 2
  private aim = 0
  private locked = false

  private readonly mat: THREE.MeshStandardMaterial
  private readonly head: THREE.Group
  private readonly lineMat: THREE.MeshBasicMaterial
  private readonly fillMat: THREE.MeshBasicMaterial
  private readonly fill: THREE.Mesh

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.6, metalness: 0.25 })
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1.1, 6), this.mat)
    body.position.y = 0.55

    // floating head with a barrel: reads as "points at you", not "runs at you"
    this.head = new THREE.Group()
    this.head.position.y = 1.45
    const coreMat = new THREE.MeshBasicMaterial({ color: CORE })
    const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.27), coreMat)
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.62), this.mat)
    barrel.position.z = 0.36
    this.head.add(orb, barrel)

    this.group.add(body, this.head)

    this.lineMat = new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    const line = new THREE.Mesh(strip(0.62, RANGED.aimLength), this.lineMat)
    this.fillMat = new THREE.MeshBasicMaterial({ color: CORE, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
    this.fill = new THREE.Mesh(strip(0.3, RANGED.aimLength), this.fillMat)
    this.fill.position.y = 0.005
    this.fill.scale.z = 0.001
    this.tellGroup.add(line, this.fill)
  }

  hit(damage: number): boolean {
    this.hp -= damage
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  update(dt: number, target: THREE.Vector3, colliders: Collider[]): EnemyAction | null {
    this.timer -= dt * 1000
    this.reload -= dt * 1000
    this.bob += dt * 4
    this.flash = Math.max(0, this.flash - dt * 6)
    this.recoil = Math.max(0, this.recoil - dt * 5)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.max(0.001, Math.hypot(dx, dz))
    const toward = Math.atan2(dx, dz)
    let action: EnemyAction | null = null
    const staggered = slide(this.pos, this.knock, dt)

    switch (this.phase) {
      case 'approach': {
        this.aim = toward
        if (staggered) break
        let mx = 0
        let mz = 0
        if (dist > RANGED.preferMax) {
          mx = dx / dist
          mz = dz / dist
        } else if (dist < RANGED.preferMin) {
          mx = -dx / dist
          mz = -dz / dist
        } else {
          // in the band: drift sideways so it isn't a turret
          this.strafeTimer -= dt
          if (this.strafeTimer <= 0) {
            this.strafe *= -1
            this.strafeTimer = 1.2 + Math.random() * 1.8
          }
          mx = (dz / dist) * this.strafe * 0.55
          mz = (-dx / dist) * this.strafe * 0.55
        }
        this.pos.x += mx * RANGED.speed * dt
        this.pos.z += mz * RANGED.speed * dt

        if (this.reload <= 0 && dist <= RANGED.fireRange) {
          this.phase = 'windup'
          this.timer = RANGED.windupMs
          this.locked = false
        }
        break
      }
      case 'windup': {
        const t = 1 - this.timer / RANGED.windupMs
        if (!this.locked) {
          this.aim = toward
          if (t >= RANGED.lockAt) this.locked = true
        }
        if (this.timer <= 0) {
          this.phase = 'strike'
          this.timer = 110
          this.recoil = 1
          action = {
            kind: 'shot',
            dir: new THREE.Vector3(Math.sin(this.aim), 0, Math.cos(this.aim)),
            damage: RANGED.damage,
          }
        }
        break
      }
      case 'strike': {
        if (this.timer <= 0) {
          this.phase = 'recover'
          this.timer = RANGED.recoverMs
        }
        break
      }
      case 'recover': {
        if (this.timer <= 0) {
          this.phase = 'approach'
          this.reload = RANGED.reloadMs
        }
        break
      }
    }

    pushOutOfColliders(this.pos, RANGED.bodyRadius, colliders)
    const r = Math.hypot(this.pos.x, this.pos.z)
    const limit = ARENA_RADIUS - 1.5
    if (r > limit) {
      this.pos.x = (this.pos.x / r) * limit
      this.pos.z = (this.pos.z / r) * limit
    }

    // --- presentation ---
    const winding = this.phase === 'windup'
    const t = winding ? Math.min(1, Math.max(0, 1 - this.timer / RANGED.windupMs)) : 0
    if (winding) {
      // tracking: faint and following. locked: bright and still.
      this.lineMat.opacity = this.locked ? 0.4 : 0.16
      this.fillMat.opacity = this.locked ? 0.75 : 0.35
      this.fill.scale.z = Math.max(0.001, t)
    } else if (this.phase === 'strike') {
      this.lineMat.opacity = 0.5
      this.fillMat.opacity = 0.9
      this.fill.scale.z = 1
    } else {
      this.lineMat.opacity = Math.max(0, this.lineMat.opacity - dt * 5)
      this.fillMat.opacity = Math.max(0, this.fillMat.opacity - dt * 5)
    }
    this.tellGroup.position.set(this.pos.x, 0.04, this.pos.z)
    this.tellGroup.rotation.y = this.aim

    this.group.scale.setScalar(1 + this.flash * 0.15 - this.recoil * 0.08)
    this.mat.color.setHex(BODY).lerp(new THREE.Color(0xffffff), this.flash * 0.85)
    this.mat.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)

    const back = this.recoil * 0.25
    this.group.position.set(
      this.pos.x - Math.sin(this.aim) * back,
      Math.sin(this.bob) * 0.05,
      this.pos.z - Math.cos(this.aim) * back,
    )
    this.group.rotation.y = this.aim
    this.head.position.y = 1.45 + Math.sin(this.bob * 1.3) * 0.07 + (winding ? t * 0.08 : 0)

    return action
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    this.mat.dispose()
    this.lineMat.dispose()
    this.fillMat.dispose()
  }
}
