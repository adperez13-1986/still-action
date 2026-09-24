import * as THREE from 'three'

/**
 * Q16: architecture yes, content no.
 * Still is four separate meshes from day one, so swapping a part later is a mesh
 * assignment rather than a rewrite. They are all boxes today.
 */
export type SlotName = 'head' | 'torso' | 'arms' | 'legs'
export const SLOT_NAMES: readonly SlotName[] = ['head', 'torso', 'arms', 'legs'] as const

const SHELL = new THREE.MeshStandardMaterial({ color: 0x3a4b61, roughness: 0.55, metalness: 0.35 })
const SHELL_DARK = new THREE.MeshStandardMaterial({ color: 0x27333f, roughness: 0.7, metalness: 0.3 })
const EYE_ON = new THREE.Color(0xffb26b)
const EYE_OFF = new THREE.Color(0x14100c)
const EYE = new THREE.MeshBasicMaterial({ color: EYE_ON })

const GHOST_EVERY = 0.03
const GHOST_LIFE = 0.26

interface Ghost { obj: THREE.Object3D; mat: THREE.MeshBasicMaterial; life: number }

interface Debris { part: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; floor: number }

export class Still {
  readonly group = new THREE.Group()
  readonly parts = {} as Record<SlotName, THREE.Object3D>

  /** World-space position on the floor plane. y is always 0. */
  readonly pos = new THREE.Vector3(0, 0, 0)
  facing = 0
  speed = 7.4
  /** Where to look when the stick is idle. Null means hold the last heading. */
  aim: number | null = null

  private bob = 0
  private legL!: THREE.Mesh
  private legR!: THREE.Mesh

  private readonly home = new Map<THREE.Object3D, THREE.Vector3>()
  private debris: Debris[] = []

  private ghosts: Ghost[] = []
  private ghostTimer = 0

  private dashT = 0
  private dashDur = 0
  private readonly dashFrom = new THREE.Vector3()
  private readonly dashTo = new THREE.Vector3()

  constructor() {
    this.setPart('legs', this.buildLegs())
    this.setPart('torso', this.buildTorso())
    this.setPart('arms', this.buildArms())
    this.setPart('head', this.buildHead())
    for (const p of Object.values(this.parts)) this.home.set(p, p.position.clone())
  }

  /** 0 is running, 1 is stopped: the eye goes out and the head drops. */
  setSlowdown(k: number) {
    EYE.color.copy(EYE_ON).lerp(EYE_OFF, k)
    this.parts.head.rotation.x = k * 0.42
    this.parts.arms.rotation.x = k * 0.12
  }

  /** HP death. The four parts were always separate meshes; now they come apart. */
  breakApart(fromX: number, fromZ: number) {
    this.dashT = 0
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

  reassemble() {
    this.debris = []
    this.dashT = 0
    for (const p of Object.values(this.parts)) {
      p.position.copy(this.home.get(p) ?? new THREE.Vector3())
      p.rotation.set(0, 0, 0)
    }
    this.setSlowdown(0)
  }

  /** The seam that makes visible loot free later. */
  setPart(slot: SlotName, mesh: THREE.Object3D) {
    const existing = this.parts[slot]
    if (existing) this.group.remove(existing)
    this.parts[slot] = mesh
    this.group.add(mesh)
  }

  get dashing(): boolean {
    return this.dashT > 0
  }

  startDash(x: number, z: number, ms: number) {
    this.dashFrom.set(this.pos.x, 0, this.pos.z)
    this.dashTo.set(x, 0, z)
    this.dashDur = ms / 1000
    this.dashT = this.dashDur
    this.facing = Math.atan2(x - this.pos.x, z - this.pos.z)
  }

  update(dt: number, moveX: number, moveZ: number) {
    this.updateGhosts(dt)

    if (this.dashT > 0) {
      // afterimages along the path: the eye reads travel, not a teleport
      this.ghostTimer -= dt
      if (this.ghostTimer <= 0) {
        this.ghostTimer = GHOST_EVERY
        this.spawnGhost()
      }
      this.dashT = Math.max(0, this.dashT - dt)
      const k = 1 - this.dashT / this.dashDur
      const eased = 1 - (1 - k) * (1 - k)
      this.pos.x = this.dashFrom.x + (this.dashTo.x - this.dashFrom.x) * eased
      this.pos.z = this.dashFrom.z + (this.dashTo.z - this.dashFrom.z) * eased
      this.bob += dt * 22
      this.group.position.set(this.pos.x, 0.12, this.pos.z)
      this.group.rotation.y = this.facing
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

    const swing = Math.sin(this.bob) * 0.45 * Math.min(1, mag)
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing

    this.group.position.set(this.pos.x, Math.abs(Math.sin(this.bob)) * 0.05 * mag, this.pos.z)
    this.group.rotation.y = this.facing
  }

  private spawnGhost() {
    const scene = this.group.parent
    if (!scene) return
    const mat = new THREE.MeshBasicMaterial({
      color: 0x9fc0ff, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending,
    })
    const obj = this.group.clone(true)
    obj.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = mat
    })
    scene.add(obj)
    this.ghosts.push({ obj, mat, life: GHOST_LIFE })
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

  /** Shortest way round. */
  private turnToward(target: number, rate: number) {
    let delta = target - this.facing
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    this.facing += delta * Math.min(1, rate)
  }

  private buildLegs(): THREE.Object3D {
    const g = new THREE.Group()
    const geo = new THREE.BoxGeometry(0.26, 0.72, 0.26)
    geo.translate(0, -0.36, 0)

    this.legL = new THREE.Mesh(geo, SHELL_DARK)
    this.legL.position.set(-0.19, 0.78, 0)
    this.legR = new THREE.Mesh(geo, SHELL_DARK)
    this.legR.position.set(0.19, 0.78, 0)

    g.add(this.legL, this.legR)
    return g
  }

  private buildTorso(): THREE.Object3D {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.78, 0.44), SHELL)
    m.position.y = 1.2
    return m
  }

  private buildArms(): THREE.Object3D {
    const g = new THREE.Group()
    const geo = new THREE.BoxGeometry(0.2, 0.62, 0.2)
    const l = new THREE.Mesh(geo, SHELL_DARK)
    l.position.set(-0.46, 1.22, 0)
    const r = new THREE.Mesh(geo, SHELL_DARK)
    r.position.set(0.46, 1.22, 0)
    g.add(l, r)
    return g
  }

  private buildHead(): THREE.Object3D {
    // pivots at the neck, so the head can drop when Still stops
    const g = new THREE.Group()
    g.position.y = 1.6
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.38), SHELL)
    skull.position.y = 0.19
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), EYE)
    eye.position.set(0, 0.22, 0.2)
    g.add(skull, eye)
    return g
  }
}
