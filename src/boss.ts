import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, COLD_DEEP } from './vfx'
import { slide, type Enemy, type EnemyAction, type EnemyPhase } from './enemy'
import type { Terrain } from './terrain'

/**
 * The Assembler: a foundry machine that builds things out of scrap — Still's
 * mirror. Closes each area. Every move is telegraphed and committed, like the
 * chaser's strike: nothing lands that you couldn't have read.
 *
 *   phase 1  sweep · shockwave · barrage · charge
 *   phase 2  (below 55%) + assemble · magnet; faster recovery, moves chain
 *
 * A charge that ends in a wall stuns it: the grill opens and the core takes more.
 */
export const BOSS = {
  hp: 900,
  radius: 1.6,
  speed: 2.4,
  overloadAt: 0.55,
  recoverMs: [1000, 560] as const,
  sweep: { windupMs: 720, range: 5.2, halfAngle: 1.3, damage: 18 },
  // gaps ~50 degrees, and never narrower than MIN_GAP units even close to the boss
  wave: { windupMs: 900, gaps: 3, gapWidth: 0.88, minGap: 2.2, damage: 14 },
  barrage: { windupMs: 620, volleys: 3, between: 330, spread: 0.55, damage: 7 },
  charge: { windupMs: 950, lockAt: 0.55, speed: 21, width: 2.3, damage: 22, stunMs: 1700 },
  summon: { windupMs: 1250, count: 3, maxAdds: 4 },
  magnet: { windupMs: 1500, strength: 3.3, radius: 3.6, damage: 20 },
}

export type BossMove = 'sweep' | 'wave' | 'barrage' | 'charge' | 'summon' | 'magnet'

const BODY = 0x4a3a36
const JOINT = 0x221c1e
const CORE = 0xff5a3c

function cyl(r0: number, r1: number, len: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 12), mat)
}
function box(w: number, h: number, d: number, mat: THREE.Material) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
}
/** A floor strip starting at the origin and running along local +z. */
function strip(width: number, length: number) {
  const g = new THREE.PlaneGeometry(width, length)
  g.translate(0, length / 2, 0)
  g.rotateX(Math.PI / 2)
  return g
}


export class Assembler implements Enemy {
  readonly kind = 'boss'
  readonly radius = BOSS.radius
  /** The current move's windup, so its sound runs exactly as long as its tell. */
  get windupMs() {
    return this.windupTotal
  }
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  readonly knock = new THREE.Vector3()
  hp = BOSS.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 0.05
  size = 1

  /** What it's doing right now, for sounds and the HUD. */
  move: BossMove | null = null
  overloaded = false
  stunned = false
  /** Set on the tick it overloads, so the run can mark the moment. */
  justOverloaded = false
  walking = false
  get gait() { return this.bob * 2.2 }

  private timer = 0
  private flash = 0
  private bob = 0
  private asleep = false
  private facing = 0
  private aim = 0
  private locked = false
  private last: BossMove | null = null
  private chain = false
  private volleysLeft = 0
  private volleyTimer = 0
  private gaps: number[] = []
  private summonPoints: THREE.Vector3[] = []
  private chargeTo = new THREE.Vector3()
  private stunTimer = 0
  private pose = { lean: 0, hammer: 0, sweepYaw: 0, recoil: 0, squash: 1 }

  // rig
  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly coreMat: THREE.MeshBasicMaterial
  private readonly torso = new THREE.Group()
  private readonly hammerArm = new THREE.Group()
  private readonly cannonArm = new THREE.Group()
  private readonly grill = new THREE.Group()
  private readonly core: THREE.Mesh
  private readonly legs: THREE.Group[] = []

  // telegraphs
  private readonly sector: THREE.Mesh
  private readonly sectorEdge: THREE.Mesh
  private readonly lanes = new THREE.Group()
  private readonly fan = new THREE.Group()
  private readonly lane: THREE.Mesh
  private readonly magnetDisc: THREE.Mesh
  private readonly magnetRing: THREE.Mesh
  private readonly piles = new THREE.Group()
  private readonly tells: THREE.ShaderMaterial[] = []

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)
    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.7, metalness: 0.5 })
    this.jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE })

    // four stubby legs
    for (const [lx, lz] of [[-0.95, 0.7], [0.95, 0.7], [-0.95, -0.7], [0.95, -0.7]] as const) {
      const leg = new THREE.Group()
      leg.position.set(lx, 0.95, lz)
      const shin = cyl(0.3, 0.34, 0.85, this.jointMat)
      shin.position.y = -0.45
      const foot = box(0.6, 0.18, 0.7, this.mat)
      foot.position.set(0, -0.86, 0.05)
      leg.add(shin, foot)
      this.legs.push(leg)
      this.group.add(leg)
    }

    // the hull, smokestacks, and the furnace behind its grill
    this.torso.position.y = 0.95
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1.15, 18, 12), this.mat)
    hull.scale.set(1.15, 0.78, 0.95)
    hull.position.y = 0.8
    const deck = box(2.2, 0.22, 1.5, this.jointMat)
    deck.position.y = 1.45
    this.torso.add(hull, deck)
    for (const [sx, h] of [[-0.45, 1.3], [0.4, 1.0]] as const) {
      const stack = cyl(0.2, 0.26, h, this.jointMat)
      stack.position.set(sx, 1.5 + h / 2, -0.55)
      const lip = cyl(0.27, 0.27, 0.1, this.mat)
      lip.position.set(sx, 1.5 + h, -0.55)
      this.torso.add(stack, lip)
    }
    this.core = box(0.8, 0.55, 0.14, this.coreMat)
    this.core.position.set(0, 0.8, 1.02)
    for (const gy of [-0.18, 0, 0.18]) {
      const bar = box(0.92, 0.07, 0.08, this.jointMat)
      bar.position.set(0, 0.8 + gy, 1.1)
      this.grill.add(bar)
    }
    this.torso.add(this.core, this.grill)

    // hammer arm (right) and cannon arm (left), hinged at the shoulders
    this.hammerArm.position.set(1.35, 1.25, 0.25)
    const upper = cyl(0.2, 0.24, 1.1, this.jointMat)
    upper.position.y = -0.5
    const hammer = box(0.85, 0.6, 0.6, this.mat)
    hammer.position.set(0, -1.15, 0.1)
    this.hammerArm.add(upper, hammer)
    this.cannonArm.position.set(-1.35, 1.2, 0.25)
    const barrel = cyl(0.2, 0.24, 1.3, this.mat)
    barrel.rotation.x = Math.PI / 2
    barrel.position.z = 0.55
    const muzzle = cyl(0.3, 0.3, 0.14, this.jointMat)
    muzzle.rotation.x = Math.PI / 2
    muzzle.position.z = 1.2
    this.cannonArm.add(barrel, muzzle)
    this.torso.add(this.hammerArm, this.cannonArm)
    this.group.add(this.torso)

    // --- telegraphs, in world space ---
    const sweepMat = tellMaterial('radial', BOSS.sweep.range)
    const edgeMat = tellMaterial('radial', BOSS.sweep.range)
    this.tells.push(sweepMat, edgeMat)
    const a = BOSS.sweep.halfAngle
    this.sector = new THREE.Mesh(new THREE.CircleGeometry(BOSS.sweep.range, 32, Math.PI / 2 - a, a * 2), sweepMat)
    this.sector.rotation.x = -Math.PI / 2
    this.sectorEdge = new THREE.Mesh(new THREE.RingGeometry(BOSS.sweep.range - 0.12, BOSS.sweep.range, 32, 1, Math.PI / 2 - a, a * 2), edgeMat)
    this.sectorEdge.rotation.x = -Math.PI / 2

    // shockwave: the gaps are shown as lit lanes, where the ring won't be
    // safe lanes are cold, like Still's own light: "stand here"
    const laneMat = tellMaterial('radial', 15, COLD, COLD_DEEP)
    this.tells.push(laneMat)
    for (let i = 0; i < BOSS.wave.gaps; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(15, 12, Math.PI / 2 - BOSS.wave.gapWidth / 2, BOSS.wave.gapWidth), laneMat)
      m.rotation.x = -Math.PI / 2
      this.lanes.add(m)
    }

    const fanMat = tellMaterial('strip')
    this.tells.push(fanMat)
    for (let i = 0; i < 5; i++) this.fan.add(new THREE.Mesh(strip(0.22, 16), fanMat))

    const laneTell = tellMaterial('strip')
    this.tells.push(laneTell)
    this.lane = new THREE.Mesh(strip(BOSS.charge.width, 30), laneTell)

    const magMat = tellMaterial('radial', BOSS.magnet.radius)
    const magRingMat = tellMaterial('radial', 1)
    this.tells.push(magMat, magRingMat)
    this.magnetDisc = new THREE.Mesh(new THREE.CircleGeometry(BOSS.magnet.radius, 40), magMat)
    this.magnetDisc.rotation.x = -Math.PI / 2
    this.magnetRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), magRingMat)
    this.magnetRing.rotation.x = -Math.PI / 2

    const pileMat = tellMaterial('radial', 0.9)
    this.tells.push(pileMat)
    for (let i = 0; i < BOSS.summon.count; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), pileMat)
      m.rotation.x = -Math.PI / 2
      this.piles.add(m)
    }

    this.tellGroup.add(this.sector, this.sectorEdge, this.lanes, this.fan, this.lane, this.magnetDisc, this.magnetRing)
    this.tellGroup.position.y = DECAL_Y
  }

  /** Where the summoned piles glow: world space, so they live apart from the tell group. */
  get pileGroup() {
    return this.piles
  }

  hit(damage: number): boolean {
    // stunned, the open grill lets hits into the core
    this.hp -= damage * this.armor * (this.stunned ? 1.5 : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain): EnemyAction | null {
    this.timer -= dt * 1000
    this.bob += dt * 3
    this.flash = Math.max(0, this.flash - dt * 5)
    this.justOverloaded = false
    slide(this.pos, this.knock, dt)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.max(0.001, Math.hypot(dx, dz))
    const toward = Math.atan2(dx, dz)
    let action: EnemyAction | null = null

    // --- overload: once, at 55% ---
    if (!this.overloaded && this.hp < BOSS.hp * BOSS.overloadAt) {
      this.overloaded = true
      this.justOverloaded = true
      this.stunned = false
      this.move = null
      this.phase = 'recover'
      this.timer = 1300
      this.flash = 1
      this.coreMat.color.setHex(0xff7a3c)
    }

    if (this.stunned) {
      this.stunTimer -= dt * 1000
      if (this.stunTimer <= 0) {
        this.stunned = false
        this.phase = 'recover'
        this.timer = BOSS.recoverMs[this.overloaded ? 1 : 0]
      }
    } else {
      switch (this.phase) {
        case 'approach': {
          this.facing = this.turn(this.facing, toward, dt * 3)
          if (dist > 5.5) {
            const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
            const sx = to.x - this.pos.x
            const sz = to.z - this.pos.z
            const sd = Math.hypot(sx, sz) || 1
            const sp = BOSS.speed * (this.overloaded ? 1.25 : 1)
            this.pos.x += (sx / sd) * sp * dt
            this.pos.z += (sz / sd) * sp * dt
          }
          if (this.timer <= 0) this.begin(this.choose(dist), target, toward)
          break
        }
        case 'windup':
          action = this.windup(dt, target, toward, terrain)
          break
        case 'strike':
          action = this.strike(dt, target, terrain)
          break
        case 'recover':
          if (this.timer <= 0) {
            this.move = null
            this.phase = 'approach'
            // overloaded, it sometimes goes straight into the next move
            this.timer = this.chain ? 0 : 250
          }
          break
      }
    }

    terrain.pushOut(this.pos, this.radius)
    this.present(dt, dist)
    return action
  }

  private turn(from: number, to: number, rate: number) {
    let d = to - from
    while (d > Math.PI) d -= Math.PI * 2
    while (d < -Math.PI) d += Math.PI * 2
    return from + d * Math.min(1, rate)
  }

  private choose(dist: number): BossMove {
    const options: [BossMove, number][] = [
      ['sweep', dist < 6 ? 5 : 0.5],
      ['wave', 2.5],
      ['barrage', dist > 5 ? 3.5 : 1],
      ['charge', dist > 6 ? 3.5 : 1.2],
    ]
    if (this.overloaded) {
      options.push(['summon', 1.6], ['magnet', dist < 9 ? 2.6 : 1])
    }
    const weighted = options.filter(([m]) => m !== this.last)
    let r = Math.random() * weighted.reduce((s, [, w]) => s + w, 0)
    for (const [m, w] of weighted) {
      r -= w
      if (r <= 0) return m
    }
    return weighted[0]![0]
  }

  private begin(move: BossMove, target: THREE.Vector3, toward: number) {
    this.move = move
    this.last = move
    this.phase = 'windup'
    this.locked = false
    this.aim = toward
    this.facing = toward
    this.chain = this.overloaded && Math.random() < 0.4
    this.pulled = false
    const speed = this.overloaded ? 0.85 : 1
    const ms = { sweep: BOSS.sweep.windupMs, wave: BOSS.wave.windupMs, barrage: BOSS.barrage.windupMs, charge: BOSS.charge.windupMs, summon: BOSS.summon.windupMs, magnet: BOSS.magnet.windupMs }[move]
    this.timer = ms * speed
    this.windupTotal = this.timer
    if (move === 'wave') {
      // three lanes, one always roughly toward you so there's a readable way out
      const base = toward + (Math.random() - 0.5) * 1.2
      this.gaps = Array.from({ length: BOSS.wave.gaps }, (_, i) => base + (i * Math.PI * 2) / BOSS.wave.gaps)
    }
    if (move === 'summon') {
      this.summonPoints = Array.from({ length: BOSS.summon.count }, (_, i) => {
        const a = toward + Math.PI + (i - 1) * 1.1
        return new THREE.Vector3(this.pos.x + Math.sin(a) * 6.5, 0, this.pos.z + Math.cos(a) * 6.5)
      })
    }
    void target
  }

  private windupTotal = 1

  private windup(_dt: number, target: THREE.Vector3, toward: number, terrain: Terrain): EnemyAction | null {
    const t = 1 - Math.max(0, this.timer) / this.windupTotal
    if (this.move === 'charge' && !this.locked) {
      this.aim = toward
      this.facing = toward
      if (t >= BOSS.charge.lockAt) this.locked = true
    }
    if (this.move === 'barrage') {
      this.aim = toward
      this.facing = toward
    }
    // the magnet drags you in for the whole windup, starting now
    if (this.move === 'magnet' && !this.pulled) {
      this.pulled = true
      return { kind: 'pull', center: this.pos.clone(), strength: BOSS.magnet.strength, seconds: Math.max(0.2, (this.windupTotal - 150) / 1000) }
    }
    if (this.timer > 0) return null

    this.phase = 'strike'
    switch (this.move) {
      case 'sweep':
        this.timer = 220
        // cover works against the hammer too: it needs a clear line to you
        return this.inSweep(target) && this.inSight(target, terrain) ? { kind: 'melee', damage: BOSS.sweep.damage } : null
      case 'wave':
        this.timer = 300
        return { kind: 'wave', center: this.pos.clone(), gaps: [...this.gaps], damage: BOSS.wave.damage }
      case 'barrage':
        this.volleysLeft = BOSS.barrage.volleys
        this.volleyTimer = 0
        this.timer = 99999
        return null
      case 'charge': {
        this.timer = 99999
        this.chargeTo.set(this.pos.x + Math.sin(this.aim) * 30, 0, this.pos.z + Math.cos(this.aim) * 30)
        return null
      }
      case 'summon':
        this.timer = 400
        return { kind: 'summon', points: this.summonPoints.map((p) => p.clone()) }
      case 'magnet':
        this.timer = 260
        return target.distanceTo(this.pos) <= BOSS.magnet.radius + 0.4 && this.inSight(target, terrain)
          ? { kind: 'melee', damage: BOSS.magnet.damage }
          : null
    }
    return null
  }

  private pulled = false

  private strike(dt: number, target: THREE.Vector3, terrain: Terrain): EnemyAction | null {
    if (this.move === 'barrage') {
      this.volleyTimer -= dt * 1000
      if (this.volleyTimer <= 0 && this.volleysLeft > 0) {
        this.volleysLeft--
        this.volleyTimer = BOSS.barrage.between
        this.pose.recoil = 1
        this.aim = Math.atan2(target.x - this.pos.x, target.z - this.pos.z)
        this.facing = this.aim
        const dirs = [-2, -1, 0, 1, 2].map((k) => {
          const a = this.aim + (k * BOSS.barrage.spread) / 2
          return new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        })
        const from = new THREE.Vector3(
          this.pos.x + Math.sin(this.aim) * 1.4 - Math.cos(this.aim) * 1.3,
          0,
          this.pos.z + Math.cos(this.aim) * 1.4 + Math.sin(this.aim) * 1.3,
        )
        if (this.volleysLeft === 0) this.endMove()
        return { kind: 'shots', from, dirs, damage: BOSS.barrage.damage }
      }
      return null
    }

    if (this.move === 'charge') {
      const step = BOSS.charge.speed * dt
      const nx = this.pos.x + Math.sin(this.aim) * step
      const nz = this.pos.z + Math.cos(this.aim) * step
      const free = terrain.clampMove(this.pos.x, this.pos.z, nx, nz, this.radius)
      const blocked = Math.hypot(free.x - nx, free.z - nz) > 0.05
      this.pos.x = free.x
      this.pos.z = free.z
      const hitYou = Math.hypot(target.x - this.pos.x, target.z - this.pos.z) < this.radius + 0.5
      if (blocked || this.pos.distanceTo(this.chargeTo) < 0.5) {
        // into the wall: stunned, grill open
        this.stunned = blocked
        this.stunTimer = BOSS.charge.stunMs
        this.flash = 1
        if (!blocked) this.endMove()
        else this.move = 'charge'
      }
      return hitYou ? { kind: 'melee', damage: BOSS.charge.damage } : null
    }

    if (this.timer <= 0) this.endMove()
    return null
  }

  private endMove() {
    this.phase = 'recover'
    this.timer = BOSS.recoverMs[this.overloaded ? 1 : 0]
  }

  /** Walls and crates are cover for everything it does, not just the barrage. */
  private inSight(target: THREE.Vector3, terrain: Terrain) {
    return terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.1)
  }

  private inSweep(target: THREE.Vector3) {
    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const d = Math.hypot(dx, dz)
    if (d > BOSS.sweep.range + 0.4) return false
    let da = Math.atan2(dx, dz) - this.aim
    while (da > Math.PI) da -= Math.PI * 2
    while (da < -Math.PI) da += Math.PI * 2
    return Math.abs(da) <= BOSS.sweep.halfAngle
  }

  // --- presentation ---

  private present(dt: number, dist: number) {
    const winding = this.phase === 'windup'
    const striking = this.phase === 'strike'
    const t = winding ? 1 - Math.max(0, this.timer) / this.windupTotal : 0
    for (const m of this.tells) m.opacity = Math.max(0, m.opacity - dt * 5)

    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)
    this.tellGroup.rotation.y = 0
    this.sector.visible = this.sectorEdge.visible = this.move === 'sweep'
    this.lanes.visible = this.move === 'wave'
    this.fan.visible = this.move === 'barrage'
    this.lane.visible = this.move === 'charge'
    this.magnetDisc.visible = this.magnetRing.visible = this.move === 'magnet'
    this.piles.visible = this.move === 'summon'

    const target = { lean: 0.05, hammer: 0, sweepYaw: 0, recoil: this.pose.recoil * 0.85, squash: 1 }
    switch (this.move) {
      case 'sweep': {
        // a flat circle's rotation.z maps to the floor mirrored: +PI puts its +y edge on `aim`
        this.sector.rotation.z = this.aim + Math.PI
        this.sectorEdge.rotation.z = this.aim + Math.PI
        this.sector.scale.setScalar(Math.max(0.001, winding ? t : 1))
        ;(this.sector.material as THREE.MeshBasicMaterial).opacity = winding ? 0.28 : striking ? 0.75 : 0
        ;(this.sectorEdge.material as THREE.MeshBasicMaterial).opacity = winding || striking ? 0.6 : 0
        target.hammer = winding ? -1.5 * t : striking ? -1.4 : 0
        target.sweepYaw = winding ? -0.9 * t : striking ? 0.9 : 0
        break
      }
      case 'wave': {
        this.gaps.forEach((g, i) => {
          const lane = this.lanes.children[i] as THREE.Mesh
          lane.rotation.z = g + Math.PI
        })
        const laneMat = (this.lanes.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
        laneMat.opacity = winding ? 0.08 + 0.14 * t : 0
        target.hammer = winding ? -2.6 * t : -0.4
        target.lean = winding ? -0.2 * t : 0.3
        target.squash = striking ? 0.88 : 1
        break
      }
      case 'barrage': {
        this.fan.children.forEach((c, i) => {
          c.rotation.y = this.aim + ((i - 2) * BOSS.barrage.spread) / 2
        })
        const fanMat = (this.fan.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
        fanMat.opacity = winding ? 0.1 + 0.25 * t : striking ? 0.18 : 0
        break
      }
      case 'charge': {
        this.lane.rotation.y = this.aim
        const m = this.lane.material as THREE.MeshBasicMaterial
        m.opacity = winding ? (this.locked ? 0.4 : 0.14) : 0
        target.lean = winding ? 0.35 * t : 0.45
        target.hammer = winding ? -0.6 : -0.3
        break
      }
      case 'magnet': {
        const disc = this.magnetDisc.material as THREE.MeshBasicMaterial
        disc.opacity = winding ? 0.12 + 0.3 * t : striking ? 0.8 : 0
        this.magnetDisc.scale.setScalar(Math.max(0.001, winding ? t : 1))
        // rings drawing inward: the pull, made visible
        const k = 1 - ((this.bob * 1.4) % 1)
        this.magnetRing.scale.setScalar(2 + k * 7)
        ;(this.magnetRing.material as THREE.MeshBasicMaterial).opacity = winding ? 0.35 * (1 - k) + 0.05 : 0
        target.hammer = winding ? -2.4 * t : -0.3
        target.squash = striking ? 0.85 : 1
        break
      }
      case 'summon': {
        this.piles.children.forEach((p, i) => {
          const pt = this.summonPoints[i]
          if (pt) p.position.set(pt.x, DECAL_Y, pt.z)
          p.scale.setScalar(0.5 + t * 0.7)
        })
        const pm = (this.piles.children[0] as THREE.Mesh).material as THREE.MeshBasicMaterial
        pm.opacity = winding ? 0.2 + 0.5 * t : 0
        target.lean = -0.15
        break
      }
    }
    if (this.stunned) {
      target.lean = 0.5
      target.hammer = 0.3
      target.squash = 0.93
    }

    const k = Math.min(1, dt * (striking ? 22 : 10))
    for (const key of ['lean', 'hammer', 'sweepYaw', 'squash'] as const) this.pose[key] += (target[key] - this.pose[key]) * k
    this.pose.recoil = Math.max(0, this.pose.recoil - dt * 6)

    this.torso.rotation.x = this.pose.lean
    this.torso.rotation.y = this.pose.sweepYaw
    this.hammerArm.rotation.x = this.pose.hammer
    this.cannonArm.position.z = 0.25 - this.pose.recoil * 0.35
    this.torso.scale.set(1 / Math.sqrt(this.pose.squash), this.pose.squash, 1 / Math.sqrt(this.pose.squash))

    // stunned: the grill swings open and the core pulses — hit it now
    this.grill.visible = !this.stunned
    const pulse = this.stunned ? 1 + Math.sin(this.bob * 9) * 0.25 : 1 + (winding ? t * 0.3 : 0)
    this.core.scale.setScalar(pulse)

    const walking = this.phase === 'approach' && dist > 5.5
    this.walking = walking
    this.legs.forEach((leg, i) => {
      leg.rotation.x = walking ? Math.sin(this.bob * 2.2 + (i % 2) * Math.PI) * 0.3 : 0
    })

    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.45)
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.6)
      m.emissive.setRGB(this.flash * 0.5 + (this.overloaded ? 0.08 : 0), this.flash * 0.2, this.flash * 0.15)
    }

    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.04))
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt
    this.facing = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.present(dt, 0)
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? 0x2a1512 : this.overloaded ? 0xff7a3c : CORE)
    if (!asleep) {
      this.flash = 1
      this.phase = 'recover'
      this.timer = 900
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group, this.tellGroup, this.piles)
    for (const m of [this.mat, this.jointMat, this.coreMat]) m.dispose()
    for (const m of this.tells) releaseTell(m)
  }
}
