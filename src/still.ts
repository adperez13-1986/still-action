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
const EYE = new THREE.MeshBasicMaterial({ color: 0xffb26b })

export class Still {
  readonly group = new THREE.Group()
  readonly parts = {} as Record<SlotName, THREE.Object3D>

  /** World-space position on the floor plane. y is always 0. */
  readonly pos = new THREE.Vector3(0, 0, 0)
  facing = 0
  speed = 7.4

  private bob = 0
  private legL!: THREE.Mesh
  private legR!: THREE.Mesh

  constructor() {
    this.setPart('legs', this.buildLegs())
    this.setPart('torso', this.buildTorso())
    this.setPart('arms', this.buildArms())
    this.setPart('head', this.buildHead())
  }

  /** The seam that makes visible loot free later. */
  setPart(slot: SlotName, mesh: THREE.Object3D) {
    const existing = this.parts[slot]
    if (existing) this.group.remove(existing)
    this.parts[slot] = mesh
    this.group.add(mesh)
  }

  update(dt: number, moveX: number, moveZ: number) {
    const mag = Math.hypot(moveX, moveZ)

    if (mag > 0.08) {
      this.pos.x += moveX * this.speed * dt
      this.pos.z += moveZ * this.speed * dt

      // turn toward travel, shortest way round
      const target = Math.atan2(moveX, moveZ)
      let delta = target - this.facing
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      this.facing += delta * Math.min(1, dt * 16)

      this.bob += dt * mag * 13
    } else {
      this.bob += (0 - (this.bob % (Math.PI * 2))) * Math.min(1, dt * 8)
    }

    const swing = Math.sin(this.bob) * 0.45 * Math.min(1, mag)
    this.legL.rotation.x = swing
    this.legR.rotation.x = -swing

    this.group.position.set(this.pos.x, Math.abs(Math.sin(this.bob)) * 0.05 * mag, this.pos.z)
    this.group.rotation.y = this.facing
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
    const g = new THREE.Group()
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.38, 0.38), SHELL)
    skull.position.y = 1.79
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.02), EYE)
    eye.position.set(0, 1.82, 0.2)
    g.add(skull, eye)
    return g
  }
}
