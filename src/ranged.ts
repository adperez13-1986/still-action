import * as THREE from 'three'
import type { Terrain } from './terrain'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell } from './vfx'
import { slide, type Enemy, type EnemyAction, type EnemyPhase } from './enemy'

/**
 * Pale steel, lighter than anything else in the room so the silhouette reads on
 * dark stone; the red lens and its halo are what you track across a room.
 */
const BODY = 0x7a8592
const JOINT = 0x3a414b
const CORE = 0xff5a3c

function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return m
}

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
  readonly radius = RANGED.bodyRadius
  readonly windupMs = RANGED.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = RANGED.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1

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
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly orb: THREE.Mesh
  private readonly halo: THREE.Sprite
  /** The tripod's legs: they rock as it walks, so it reads as stepping, not gliding. */
  private readonly legs = new THREE.Group()
  private stepping = 0
  private readonly barrel: THREE.Mesh
  private readonly coreMat: THREE.MeshBasicMaterial
  private asleep = false
  private readonly lineMat: THREE.ShaderMaterial
  private readonly fillMat: THREE.ShaderMaterial
  private readonly fill: THREE.Mesh

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A tripod sentinel: three long jointed legs, a small hub, a barrel and a red lens.
    // Reads as "points at you", not "runs at you".
    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.45, metalness: 0.55, emissive: 0x141a22 })
    this.jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })

    const legs = this.legs
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6
      const hip = new THREE.Vector3(Math.sin(a) * 0.18, 1.1, Math.cos(a) * 0.18)
      // knees high and out, like a spider's: the silhouette is all legs
      const knee = new THREE.Vector3(Math.sin(a) * 0.55, 1.32, Math.cos(a) * 0.55)
      const foot = new THREE.Vector3(Math.sin(a) * 0.78, 0.02, Math.cos(a) * 0.78)
      const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), this.jointMat)
      kneeBall.position.copy(knee)
      legs.add(rod(hip, knee, 0.085, this.mat), rod(knee, foot, 0.07, this.mat), kneeBall)
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.28, 0.38, 6), this.mat)
    hub.position.y = 1.16
    const skirt = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 6, 12), this.jointMat)
    skirt.rotation.x = Math.PI / 2
    skirt.position.y = 1.03

    this.head = new THREE.Group()
    this.head.position.y = 1.45
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE })
    this.orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.24), this.coreMat)
    // a soft halo round the lens: the one thing that reads across a room
    const haloTex = (() => {
      const c = document.createElement('canvas')
      c.width = c.height = 64
      const g = c.getContext('2d')!
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,120,80,0.9)')
      grad.addColorStop(0.35, 'rgba(255,80,50,0.35)')
      grad.addColorStop(1, 'rgba(255,60,40,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
      return new THREE.CanvasTexture(c)
    })()
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }))
    this.halo.scale.setScalar(1.1)
    this.halo.position.z = 0.1
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.26, 8), this.jointMat)
    housing.rotation.x = Math.PI / 2
    housing.position.z = -0.04
    this.barrel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.8), this.mat)
    this.barrel.position.z = 0.44
    const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.1), this.jointMat)
    muzzle.position.z = 0.84
    this.head.add(housing, this.orb, this.barrel, muzzle, this.halo)

    this.group.add(legs, hub, skirt, this.head)

    this.lineMat = tellMaterial('strip')
    const line = new THREE.Mesh(strip(0.62, RANGED.aimLength), this.lineMat)
    this.fillMat = tellMaterial('strip')
    this.fill = new THREE.Mesh(strip(0.3, RANGED.aimLength), this.fillMat)
    this.fill.position.y = 0.005
    this.fill.scale.z = 0.001
    this.tellGroup.add(line, this.fill)
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
        const sight = terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)
        if (!sight) {
          // no shot from here: go round the wall until there is one
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, RANGED.bodyRadius)
          const sd = Math.hypot(to.x - this.pos.x, to.z - this.pos.z) || 1
          mx = (to.x - this.pos.x) / sd
          mz = (to.z - this.pos.z) / sd
        } else if (dist > RANGED.preferMax) {
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
        this.pos.x += mx * RANGED.speed * this.speedMul * dt
        this.pos.z += mz * RANGED.speed * this.speedMul * dt
        this.stepping = Math.hypot(mx, mz)

        if (this.reload <= 0 && dist <= RANGED.fireRange && sight) {
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

    terrain.pushOut(this.pos, RANGED.bodyRadius)

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
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)
    this.tellGroup.rotation.y = this.aim

    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    // the lens swells as it locks, and the barrel kicks back on the shot
    this.orb.scale.setScalar(1 + (winding ? t * (this.locked ? 0.9 : 0.4) : 0))
    this.halo.scale.setScalar(1.1 + (winding ? t * (this.locked ? 1.4 : 0.6) : 0))
    this.halo.material.opacity = 1
    this.barrel.position.z = 0.44 - this.recoil * 0.22

    const back = this.recoil * 0.25
    this.group.position.set(
      this.pos.x - Math.sin(this.aim) * back,
      Math.sin(this.bob) * 0.05,
      this.pos.z - Math.cos(this.aim) * back,
    )
    this.group.rotation.y = this.aim
    this.head.position.y = 1.45 + Math.sin(this.bob * 1.3) * 0.07 + (winding ? t * 0.08 : 0)
    this.head.rotation.x = 0
    // a stepping gait: the legs rock side to side and the hub bobs with each step
    const step = this.phase === 'approach' ? this.stepping : 0
    this.legs.rotation.z = Math.sin(this.bob * 3.2) * 0.1 * step
    this.legs.rotation.x = Math.cos(this.bob * 3.2) * 0.06 * step
    this.stepping *= 0.9

    return action
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt * (this.asleep ? 1.2 : 4)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.lineMat.opacity = Math.max(0, this.lineMat.opacity - dt * 5)
    this.fillMat.opacity = Math.max(0, this.fillMat.opacity - dt * 5)
    this.aim = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)
    this.group.position.set(this.pos.x, Math.sin(this.bob) * 0.03, this.pos.z)
    this.group.rotation.y = this.aim
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    this.orb.scale.setScalar(1)
    this.halo.scale.setScalar(1.1)
    this.halo.material.opacity = this.asleep ? 0 : 1
    // asleep: the head sinks and the barrel droops
    this.head.position.y = this.asleep ? 1.3 : 1.45 + Math.sin(this.bob * 1.3) * 0.07
    this.head.rotation.x = this.asleep ? 0.45 : 0
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.4)
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? 0x2a1512 : CORE)
    if (!asleep) {
      this.flash = 1
      this.reload = RANGED.reloadMs * 0.8
    }
    this.phase = 'approach'
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    this.coreMat.dispose()
    this.jointMat.dispose()
    this.halo.material.map?.dispose()
    this.halo.material.dispose()
    this.mat.dispose()
    releaseTell(this.lineMat)
    releaseTell(this.fillMat)
  }
}
