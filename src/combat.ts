import * as THREE from 'three'
import { Chaser } from './enemy'
import { ARENA_RADIUS, type Collider } from './world'
import type { AbilityDef } from './abilities'

const AUTO_RANGE = 7.6
const AUTO_INTERVAL = 0.62
const AUTO_DAMAGE = 7
const BOLT_SPEED = 26
const MAX_ENEMIES = 4
const SPAWN_INTERVAL = 2.4
const PLAYER_MAX_HP = 100

interface Bolt {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
  radius: number
}

interface Fx {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  life: number
  max: number
  from: number
  to: number
}

export interface CombatEvents {
  onHit: () => void
  onPlayerHurt: (amount: number) => void
  onKill: () => void
  onDash: (x: number, z: number, ms: number) => void
}

export class Combat {
  hp = PLAYER_MAX_HP
  readonly enemies: Chaser[] = []

  private bolts: Bolt[] = []
  private fx: Fx[] = []
  private autoTimer = 0
  private spawnTimer = 1.2
  private hurtCooldown = 0

  private readonly boltGeo = new THREE.BoxGeometry(0.16, 0.16, 0.7)
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0xffd39b })
  private readonly abilityBoltMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0 })

  constructor(
    private readonly scene: THREE.Scene,
    private readonly colliders: Collider[],
    private readonly events: CombatEvents,
  ) {}

  update(dt: number, player: THREE.Vector3) {
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)

    this.spawnTimer -= dt
    if (this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = SPAWN_INTERVAL
      this.spawn(player)
    }

    // --- enemies ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!
      const dmg = e.update(dt, player, this.colliders)
      if (dmg > 0 && this.hurtCooldown <= 0) {
        this.hp = Math.max(0, this.hp - dmg)
        this.hurtCooldown = 0.35
        this.events.onPlayerHurt(dmg)
      }
      if (e.dead) {
        e.dispose(this.scene)
        this.enemies.splice(i, 1)
        this.events.onKill()
      }
    }

    // --- auto attack: nearest enemy in range, no aiming required ---
    this.autoTimer -= dt
    if (this.autoTimer <= 0) {
      const target = this.nearest(player)
      if (target) {
        this.autoTimer = AUTO_INTERVAL
        this.shoot(player, target.pos)
      }
    }

    // --- bolts ---
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!
      b.mesh.position.addScaledVector(b.dir, BOLT_SPEED * dt)
      b.life -= dt

      let spent = b.life <= 0
      if (!spent) {
        for (const e of this.enemies) {
          const dx = b.mesh.position.x - e.pos.x
          const dz = b.mesh.position.z - e.pos.z
          if (Math.hypot(dx, dz) < b.radius + 0.5) {
            e.hit(b.damage)
            this.events.onHit()
            spent = true
            break
          }
        }
      }
      if (spent) {
        this.scene.remove(b.mesh)
        this.bolts.splice(i, 1)
      }
    }

    // --- transient effects ---
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i]!
      f.life -= dt
      const k = 1 - Math.max(0, f.life) / f.max
      f.mesh.scale.setScalar(f.from + (f.to - f.from) * k)
      f.mat.opacity = (1 - k) * 0.85
      if (f.life <= 0) {
        this.scene.remove(f.mesh)
        f.mesh.geometry.dispose()
        f.mat.dispose()
        this.fx.splice(i, 1)
      }
    }
  }

  /** Where Still should be looking. Null when nothing is in range. */
  nearestTarget(from: THREE.Vector3, range = AUTO_RANGE): THREE.Vector3 | null {
    return this.nearest(from, range)?.pos ?? null
  }

  reset() {
    this.hp = PLAYER_MAX_HP
    for (const e of this.enemies) e.dispose(this.scene)
    this.enemies.length = 0
    for (const b of this.bolts) this.scene.remove(b.mesh)
    this.bolts.length = 0
    for (const f of this.fx) this.scene.remove(f.mesh)
    this.fx.length = 0
    this.spawnTimer = 1.5
  }

  private nearest(from: THREE.Vector3, range = AUTO_RANGE): Chaser | null {
    let best: Chaser | null = null
    let bestDist = range
    for (const e of this.enemies) {
      const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z)
      if (d < bestDist) {
        bestDist = d
        best = e
      }
    }
    return best
  }

  private shoot(from: THREE.Vector3, to: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat)
    mesh.position.set(from.x, 1.15, from.z)
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize()
    mesh.rotation.y = Math.atan2(dir.x, dir.z)
    this.scene.add(mesh)
    this.bolts.push({ mesh, dir, life: 0.7, damage: AUTO_DAMAGE, radius: 0.3 })
  }

  /** One part, one action. `shape` decides how it lands. */
  useAbility(def: AbilityDef, origin: THREE.Vector3, facing: number, moveX: number, moveZ: number) {
    switch (def.shape) {
      case 'bolt': {
        const target = this.nearest(origin, def.range)
        const dir = target
          ? new THREE.Vector3(target.pos.x - origin.x, 0, target.pos.z - origin.z).normalize()
          : new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing))
        const mesh = new THREE.Mesh(this.boltGeo, this.abilityBoltMat)
        mesh.scale.set(2.2, 2.2, 2.6)
        mesh.position.set(origin.x, 1.15, origin.z)
        mesh.rotation.y = Math.atan2(dir.x, dir.z)
        this.scene.add(mesh)
        this.bolts.push({ mesh, dir, life: def.range / BOLT_SPEED, damage: def.damage, radius: def.radius })
        break
      }

      case 'nova': {
        for (const e of this.enemies) {
          const d = Math.hypot(e.pos.x - origin.x, e.pos.z - origin.z)
          if (d <= def.radius) {
            e.hit(def.damage)
            // shove them out of your face — this is the panic button
            const k = 2.4 / Math.max(0.4, d)
            e.pos.x += (e.pos.x - origin.x) * k * 0.35
            e.pos.z += (e.pos.z - origin.z) * k * 0.35
            this.events.onHit()
          }
        }
        this.ring(origin, 0.3, def.radius, 0.45, 0xffd39b)
        break
      }

      case 'arc': {
        // A melee swing never needs aiming — snap to whatever is closest in reach.
        const snap = this.nearest(origin, def.range + 1.2)
        const aimed = snap ? Math.atan2(snap.pos.x - origin.x, snap.pos.z - origin.z) : facing
        const fx = Math.sin(aimed)
        const fz = Math.cos(aimed)
        for (const e of this.enemies) {
          const dx = e.pos.x - origin.x
          const dz = e.pos.z - origin.z
          const d = Math.hypot(dx, dz)
          if (d > def.range + 0.6) continue
          // 120-degree sweep in front
          if ((dx / d) * fx + (dz / d) * fz < 0.5) continue
          e.hit(def.damage)
          this.events.onHit()
        }
        this.sweep(origin, aimed, def.range, 0xffe0b0)
        break
      }

      case 'dash': {
        let dx = moveX
        let dz = moveZ
        if (Math.hypot(dx, dz) < 0.1) {
          dx = Math.sin(facing)
          dz = Math.cos(facing)
        }
        const m = Math.hypot(dx, dz)
        dx /= m
        dz /= m

        let ex = origin.x + dx * def.range
        let ez = origin.z + dz * def.range
        const outer = Math.hypot(ex, ez)
        const limit = ARENA_RADIUS - 1.2
        if (outer > limit) {
          ex = (ex / outer) * limit
          ez = (ez / outer) * limit
        }

        // everything near the line gets run over
        for (const e of this.enemies) {
          if (this.distToSegment(e.pos.x, e.pos.z, origin.x, origin.z, ex, ez) <= def.radius + 0.6) {
            e.hit(def.damage)
            this.events.onHit()
          }
        }
        this.ring(origin, 0.3, 1.6, 0.3, 0xbcd6ff)
        this.events.onDash(ex, ez, 190)
        break
      }
    }
  }

  private distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const vx = bx - ax
    const vz = bz - az
    const len = vx * vx + vz * vz
    const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len)) : 0
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
  }

  private ring(at: THREE.Vector3, from: number, to: number, life: number, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(at.x, 0.06, at.z)
    mesh.scale.setScalar(from)
    this.scene.add(mesh)
    this.fx.push({ mesh, mat, life, max: life, from, to })
  }

  private sweep(at: THREE.Vector3, facing: number, range: number, color: number) {
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(range, 24, -Math.PI / 3, (Math.PI * 2) / 3), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = -facing + Math.PI / 2
    mesh.position.set(at.x, 0.07, at.z)
    this.scene.add(mesh)
    this.fx.push({ mesh, mat, life: 0.22, max: 0.22, from: 1, to: 1.15 })
  }

  private spawn(player: THREE.Vector3) {
    // always arrive from the rim, never on top of you
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Math.random() * Math.PI * 2
      const r = ARENA_RADIUS - 2.4
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.hypot(x - player.x, z - player.z) < 7) continue
      const e = new Chaser(x, z)
      this.scene.add(e.group, e.tellGroup)
      this.enemies.push(e)
      return
    }
  }
}
