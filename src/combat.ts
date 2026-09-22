import * as THREE from 'three'
import { Chaser } from './enemy'
import { ARENA_RADIUS, type Collider } from './world'

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
}

export interface CombatEvents {
  onHit: () => void
  onPlayerHurt: (amount: number) => void
  onKill: () => void
}

export class Combat {
  hp = PLAYER_MAX_HP
  readonly enemies: Chaser[] = []

  private bolts: Bolt[] = []
  private autoTimer = 0
  private spawnTimer = 1.2
  private hurtCooldown = 0

  private readonly boltGeo = new THREE.BoxGeometry(0.16, 0.16, 0.7)
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0xffd39b })

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
          if (Math.hypot(dx, dz) < 0.8) {
            e.hit(AUTO_DAMAGE)
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
  }

  reset() {
    this.hp = PLAYER_MAX_HP
    for (const e of this.enemies) e.dispose(this.scene)
    this.enemies.length = 0
    for (const b of this.bolts) this.scene.remove(b.mesh)
    this.bolts.length = 0
    this.spawnTimer = 1.5
  }

  private nearest(from: THREE.Vector3): Chaser | null {
    let best: Chaser | null = null
    let bestDist = AUTO_RANGE
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
    this.bolts.push({ mesh, dir, life: 0.7 })
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
