import * as THREE from 'three'

/**
 * Q16: architecture yes, content no.
 * Still is four separate parts from day one, so swapping a part later is a mesh
 * assignment rather than a rewrite.
 *
 * The Lantern: tall, thin and a little hunched. An open cage for a torso with a
 * small cold core inside, a round lens on a stalk for a head, backward-bent
 * bird legs, mismatched arms (a clamp, a hook). Picked from the lineup; every
 * rod is thicker than the lineup draft so it still reads at phone size.
 */
export type SlotName = 'head' | 'torso' | 'arms' | 'legs'
export const SLOT_NAMES: readonly SlotName[] = ['head', 'torso', 'arms', 'legs'] as const

const SHELL = new THREE.MeshStandardMaterial({ color: 0x55616e, roughness: 0.5, metalness: 0.55 })
const SHELL_DARK = new THREE.MeshStandardMaterial({ color: 0x2c343d, roughness: 0.65, metalness: 0.45 })
/** Pale and cold: Grace is the only warm light. The lens and the core share it, so both go out together. */
const EYE_ON = new THREE.Color(0xd6ebff)
const EYE_OFF = new THREE.Color(0x0c1014)
const EYE = new THREE.MeshBasicMaterial({ color: EYE_ON })

/** An unfound part: dull, dark, unpowered. The frame is there; nothing's in it yet. */
const BARE = new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.95, metalness: 0.1 })

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 8), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return m
}

function ball(r: number, mat: THREE.Material, at: THREE.Vector3) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat)
  m.position.copy(at)
  return m
}

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
  speed = 5.5
  /** Where to look when the stick is idle. Null means hold the last heading. */
  aim: number | null = null

  private bob = 0
  private legL!: THREE.Group
  private legR!: THREE.Group
  private armL!: THREE.Group
  private armR!: THREE.Group

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

  /** Found parts are lit metal; unfound ones are drawn bare. The eye and core stay lit regardless. */
  setEquipped(slot: SlotName, on: boolean) {
    this.parts[slot].traverse((o) => {
      if (!(o instanceof THREE.Mesh) || o.material === EYE) return
      const own = (o.userData.own ??= o.material) as THREE.Material
      o.material = on ? own : BARE
    })
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
    this.armL.rotation.x = -swing * 0.5
    this.armR.rotation.x = swing * 0.5

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
    const leg = (side: number) => {
      // hinged at the hip, so the whole leg swings when he walks
      const hip = new THREE.Group()
      hip.position.set(side * 0.14, 0.98, 0)
      const knee = v3(side * 0.02, -0.4, 0.17)
      const ankle = v3(0, -0.8, -0.09)
      const toe = v3(0, -0.95, 0.14)
      hip.add(
        rod(v3(0, 0, 0), knee, 0.07, SHELL_DARK),
        rod(knee, ankle, 0.055, SHELL_DARK),
        rod(ankle, toe, 0.05, SHELL),
        ball(0.085, SHELL, knee),
        ball(0.06, SHELL, ankle),
      )
      return hip
    }
    this.legL = leg(-1)
    this.legR = leg(1)
    g.add(this.legL, this.legR)
    return g
  }

  private buildTorso(): THREE.Object3D {
    // an open cage with the core inside: you can see what little is there
    const g = new THREE.Group()
    g.position.y = 1.0
    g.rotation.x = 0.16 // a little hunched, leaning into the walk
    const bars = 6
    for (let i = 0; i < bars; i++) {
      const a = (i / bars) * Math.PI * 2
      g.add(rod(v3(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15), v3(Math.cos(a) * 0.23, 0.55, Math.sin(a) * 0.2), 0.035, SHELL))
    }
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.045, 6, 18), SHELL_DARK)
    top.position.y = 0.55
    top.rotation.x = Math.PI / 2
    const bottom = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 6, 16), SHELL_DARK)
    bottom.rotation.x = Math.PI / 2
    g.add(top, bottom, ball(0.11, EYE, v3(0, 0.28, 0)))
    return g
  }

  private buildArms(): THREE.Object3D {
    const g = new THREE.Group()
    // left: long, ends in a clamp
    this.armL = new THREE.Group()
    this.armL.position.set(-0.26, 1.5, 0.04)
    const le = v3(-0.08, -0.32, 0.08)
    const lh = v3(-0.05, -0.64, 0.14)
    this.armL.add(
      rod(v3(0, 0, 0), le, 0.05, SHELL_DARK),
      rod(le, lh, 0.045, SHELL),
      ball(0.06, SHELL, le),
    )
    for (const off of [-0.06, 0.06]) {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.16, 0.07), SHELL)
      jaw.position.set(lh.x + off, lh.y - 0.07, lh.z)
      this.armL.add(jaw)
    }
    // right: shorter, a hook
    this.armR = new THREE.Group()
    this.armR.position.set(0.26, 1.5, 0.04)
    const re = v3(0.06, -0.28, 0.07)
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12, Math.PI * 1.3), SHELL)
    hook.position.set(re.x, re.y - 0.12, re.z)
    hook.rotation.y = Math.PI / 2
    this.armR.add(rod(v3(0, 0, 0), re, 0.05, SHELL_DARK), ball(0.06, SHELL, re), hook)
    g.add(this.armL, this.armR)
    return g
  }

  private buildHead(): THREE.Object3D {
    // pivots at the neck, so the head can drop when Still stops
    const g = new THREE.Group()
    g.position.set(0, 1.56, 0.1)
    g.add(rod(v3(0, 0, 0), v3(0.03, 0.2, 0.04), 0.04, SHELL_DARK))
    const lens = new THREE.Group()
    lens.position.set(0.03, 0.32, 0.05)
    lens.rotation.z = 0.18 // tilted, curious
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.17, 18), SHELL)
    body.rotation.x = Math.PI / 2
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.135, 18), EYE)
    glass.position.z = 0.087
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.03, 6, 18), SHELL_DARK)
    rim.position.z = 0.086
    lens.add(body, glass, rim)
    g.add(lens)
    return g
  }
}
