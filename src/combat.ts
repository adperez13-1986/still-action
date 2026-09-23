import * as THREE from 'three'
import { Chaser, type Enemy } from './enemy'
import { Ranged } from './ranged'
import { ARENA_RADIUS, type Collider } from './world'
import type { AbilityDef } from './abilities'

const AUTO_RANGE = 7.6
const AUTO_INTERVAL = 0.62
const AUTO_DAMAGE = 7
const BOLT_SPEED = 26
const MAX_ENEMIES = 4
const SPAWN_INTERVAL = 2.4
const PLAYER_MAX_HP = 100
const PLAYER_RADIUS = 0.42
const SHOT_SPEED = 15
const SHOT_RADIUS = 0.3
/** A swing connects with anything whose body reaches the blade, not just its centre. */
export const MELEE_PAD = 0.6

interface Bolt {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
  radius: number
}

/** An enemy projectile. Slower than yours, and waist-high walls stop it. */
interface Shot {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
}

export type Archetype = Enemy['kind']

interface Fx {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  life: number
  max: number
  from: number
  to: number
}

export interface CombatEvents {
  onHit: (at: THREE.Vector3) => void
  onPlayerHurt: (amount: number) => void
  onKill: (at: THREE.Vector3) => void
  onDash: (x: number, z: number, ms: number) => void
  onShot: () => void
  onWindup: (e: Enemy, ms: number) => void
  onStrike: (e: Enemy) => void
  onGone: (e: Enemy) => void
  onShotBlocked: (at: THREE.Vector3) => void
}

export class Combat {
  hp = PLAYER_MAX_HP
  readonly enemies: Enemy[] = []

  private bolts: Bolt[] = []
  private shots: Shot[] = []
  private fx: Fx[] = []
  private autoTimer = 0
  private spawnTimer = 1.2
  private hurtCooldown = 0
  /** Who this fight still has to send, in order. Cleared when this and the living are both empty. */
  private roster: Archetype[] = []

  private readonly boltGeo = new THREE.BoxGeometry(0.16, 0.16, 0.7)
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0xffd39b })
  private readonly abilityBoltMat = new THREE.MeshBasicMaterial({ color: 0xfff0d0 })
  private readonly shotGeo = new THREE.SphereGeometry(SHOT_RADIUS, 10, 8)
  private readonly shotMat = new THREE.MeshBasicMaterial({ color: 0xff7a55 })

  constructor(
    private readonly scene: THREE.Scene,
    private readonly colliders: Collider[],
    private readonly events: CombatEvents,
  ) {}

  update(dt: number, player: THREE.Vector3) {
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)

    this.spawnTimer -= dt
    const next = this.roster[0]
    if (next && this.spawnTimer <= 0 && this.enemies.length < MAX_ENEMIES) {
      this.spawnTimer = SPAWN_INTERVAL
      if (this.spawn(player, next)) this.roster.shift()
    }

    // --- enemies ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!
      const before = e.phase
      const action = e.update(dt, player, this.colliders)
      if (e.phase !== before) {
        if (e.phase === 'windup') this.events.onWindup(e, e.windupMs)
        if (e.phase === 'strike') this.events.onStrike(e)
      }
      if (action?.kind === 'melee') this.hurtPlayer(action.damage)
      if (action?.kind === 'shot') this.fireShot(e.pos, action.dir, action.damage)
      if (e.dead) {
        e.dispose(this.scene)
        this.enemies.splice(i, 1)
        this.events.onKill(e.pos)
        this.events.onGone(e)
      }
    }

    // --- auto attack: nearest enemy in range, no aiming required ---
    this.autoTimer -= dt
    if (this.autoTimer <= 0) {
      // the auto attack doesn't waste itself on a wall: nearest enemy you can actually hit
      const target = this.nearest(player, AUTO_RANGE, true)
      if (target) {
        this.autoTimer = AUTO_INTERVAL
        this.shoot(player, target.pos)
        this.events.onShot()
      }
    }

    // --- bolts ---
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!
      b.mesh.position.addScaledVector(b.dir, BOLT_SPEED * dt)
      b.life -= dt

      let spent = b.life <= 0
      // same rule as enemy shots: waist-high walls stop yours too
      const wall = spent ? null : this.wallAt(b.mesh.position)
      if (wall) {
        this.events.onShotBlocked(b.mesh.position)
        this.ring(b.mesh.position, 0.2, 0.8, 0.18, 0xffd39b)
        spent = true
      }
      if (!spent) {
        for (const e of this.enemies) {
          const dx = b.mesh.position.x - e.pos.x
          const dz = b.mesh.position.z - e.pos.z
          if (Math.hypot(dx, dz) < b.radius + 0.5) {
            e.hit(b.damage)
            this.events.onHit(e.pos)
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

    // --- enemy shots ---
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!
      s.mesh.position.addScaledVector(s.dir, SHOT_SPEED * dt)
      s.life -= dt
      const p = s.mesh.position

      let spent = s.life <= 0 || Math.hypot(p.x, p.z) > ARENA_RADIUS
      if (!spent && Math.hypot(p.x - player.x, p.z - player.z) < SHOT_RADIUS + PLAYER_RADIUS) {
        this.hurtPlayer(s.damage)
        spent = true
      }
      if (!spent && this.wallAt(p)) {
        this.events.onShotBlocked(p)
        this.ring(p, 0.2, 0.9, 0.2, 0xff7a55)
        spent = true
      }
      if (spent) {
        this.scene.remove(s.mesh)
        this.shots.splice(i, 1)
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

  get cleared(): boolean {
    return this.roster.length === 0 && this.enemies.length === 0
  }

  /** HP is the fight: every fight starts whole. Strain is what carries over. */
  startFight(roster: Archetype[]) {
    this.hp = PLAYER_MAX_HP
    this.roster = [...roster]
    this.spawnTimer = 1.2
  }

  reset() {
    this.hp = PLAYER_MAX_HP
    this.roster = []
    for (const e of this.enemies) {
      e.dispose(this.scene)
      this.events.onGone(e)
    }
    this.enemies.length = 0
    for (const b of this.bolts) this.scene.remove(b.mesh)
    this.bolts.length = 0
    for (const s of this.shots) this.scene.remove(s.mesh)
    this.shots.length = 0
    for (const f of this.fx) this.scene.remove(f.mesh)
    this.fx.length = 0
    this.spawnTimer = 1.5
  }

  private hurtPlayer(damage: number) {
    if (this.hurtCooldown > 0) return
    this.hp = Math.max(0, this.hp - damage)
    this.hurtCooldown = 0.35
    this.events.onPlayerHurt(damage)
  }

  private fireShot(from: THREE.Vector3, dir: THREE.Vector3, damage: number) {
    const mesh = new THREE.Mesh(this.shotGeo, this.shotMat)
    // leaves from the barrel, not the feet
    mesh.position.set(from.x + dir.x * 0.7, 1.45, from.z + dir.z * 0.7)
    this.scene.add(mesh)
    this.shots.push({ mesh, dir, life: 20 / SHOT_SPEED, damage })
  }

  /** Projectiles of either side stop here. Slightly generous so a graze counts. */
  private wallAt(p: THREE.Vector3): Collider | null {
    for (const c of this.colliders) {
      if (Math.hypot(p.x - c.x, p.z - c.z) < c.r + 0.15) return c
    }
    return null
  }

  private clearShot(from: THREE.Vector3, to: THREE.Vector3): boolean {
    for (const c of this.colliders) {
      if (this.distToSegment(c.x, c.z, from.x, from.z, to.x, to.z) < c.r + 0.15) return false
    }
    return true
  }

  private nearest(from: THREE.Vector3, range = AUTO_RANGE, needsClearShot = false): Enemy | null {
    let best: Enemy | null = null
    let bestDist = range
    for (const e of this.enemies) {
      const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z)
      if (d < bestDist && (!needsClearShot || this.clearShot(from, e.pos))) {
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
            this.events.onHit(e.pos)
          }
        }
        this.ring(origin, 0.3, def.radius, 0.45, 0xffd39b)
        break
      }

      case 'arc': {
        // A melee swing never needs aiming — snap to whatever is closest in reach.
        // Snap reach must equal hit reach, or the blade turns toward things it can't touch.
        const snap = this.nearest(origin, def.range + MELEE_PAD)
        const aimed = snap ? Math.atan2(snap.pos.x - origin.x, snap.pos.z - origin.z) : facing
        const fx = Math.sin(aimed)
        const fz = Math.cos(aimed)
        for (const e of this.enemies) {
          const dx = e.pos.x - origin.x
          const dz = e.pos.z - origin.z
          const d = Math.hypot(dx, dz)
          if (d > def.range + MELEE_PAD) continue
          // 120-degree sweep in front
          if ((dx / d) * fx + (dz / d) * fz < 0.5) continue
          e.hit(def.damage)
          this.events.onHit(e.pos)
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
            this.events.onHit(e.pos)
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
    // The circle's rotation.z is applied before the tilt flat, so it maps to the
    // floor with z mirrored. -facing + PI/2 looked right on the x axis only.
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = facing - Math.PI / 2
    mesh.position.set(at.x, 0.07, at.z)
    this.scene.add(mesh)
    this.fx.push({ mesh, mat, life: 0.22, max: 0.22, from: 1, to: 1.15 })
  }

  private spawn(player: THREE.Vector3, kind: Archetype): boolean {
    // always arrive from the rim, never on top of you
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Math.random() * Math.PI * 2
      const r = ARENA_RADIUS - 2.4
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      if (Math.hypot(x - player.x, z - player.z) < 7) continue
      const e = kind === 'ranged' ? new Ranged(x, z) : new Chaser(x, z)
      this.scene.add(e.group, e.tellGroup)
      this.enemies.push(e)
      return true
    }
    return false
  }
}
