import * as THREE from 'three'
import { pushOutOfColliders, type Collider } from './world'

/**
 * One archetype: the chaser. Closes, telegraphs, strikes, recovers.
 * The windup is the game — everything else is scaffolding around it.
 */
export type ChaserPhase = 'approach' | 'windup' | 'strike' | 'recover'

const BODY = 0x8c2f28
const CORE = 0xff5a3c

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

export class Chaser {
  readonly group = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = CHASER.hp
  phase: ChaserPhase = 'approach'
  dead = false

  private timer = 0
  private flash = 0
  private bob = Math.random() * 10
  private readonly mat: THREE.MeshStandardMaterial
  private readonly core: THREE.Mesh
  /** Lives in world space, NOT under the body — the lunge must not scale the tell. */
  readonly tellGroup = new THREE.Group()
  private readonly disc: THREE.Mesh
  private readonly ringMat: THREE.MeshBasicMaterial
  private readonly discMat: THREE.MeshBasicMaterial

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.6, metalness: 0.2 })
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.35, 4), this.mat)
    body.position.y = 0.68
    body.rotation.y = Math.PI / 4

    this.core = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial({ color: CORE }),
    )
    this.core.position.y = 0.95

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

    this.group.add(body, this.core)
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

  /** Returns damage to deal to the player this tick, or 0. */
  update(dt: number, target: THREE.Vector3, colliders: Collider[]): number {
    this.timer -= dt * 1000
    this.bob += dt * 5
    this.flash = Math.max(0, this.flash - dt * 6)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    let damage = 0

    switch (this.phase) {
      case 'approach': {
        if (dist > CHASER.strikeRange) {
          this.pos.x += (dx / dist) * CHASER.speed * dt
          this.pos.z += (dz / dist) * CHASER.speed * dt
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
          if (dist <= CHASER.strikeRadius) damage = CHASER.damage
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

    pushOutOfColliders(this.pos, CHASER.bodyRadius, colliders)

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

    const lunge = this.phase === 'strike' ? 1.22 : winding ? 1 - t * 0.14 : 1
    this.group.scale.setScalar(lunge + this.flash * 0.15)
    this.mat.color.setHex(BODY).lerp(new THREE.Color(0xffffff), this.flash * 0.85)
    this.mat.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)

    this.group.position.set(this.pos.x, Math.sin(this.bob) * 0.06, this.pos.z)
    this.group.rotation.y = Math.atan2(dx, dz)
    this.core.rotation.y += dt * 3

    return damage
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    this.mat.dispose()
    this.ringMat.dispose()
    this.discMat.dispose()
  }
}
