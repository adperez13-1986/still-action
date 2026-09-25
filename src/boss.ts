import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, tellOrder, COLD, COLD_DEEP, EMBER, type Vfx } from './vfx'
import { slide, statusTint, disposeBody, distToSegment, type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'
import { LaneTell, type LaneEnd } from './lane'
import type { Terrain } from './terrain'
import type { BossDef } from './areas'
import type { Post } from './dungeon'
import { Arbiter } from './arbiter'

/** The current windup's sound shape: heavy moves rise like the hulk, aimed ones whistle and click like the sentinel. */
export type BossCue =
  | { voice: 'windup' }
  | { voice: 'aim'; lockAt: number }
  /** A mortar tilting (the Arbiter's shell). */
  | { voice: 'lob' }
  | { voice: 'none' }

/**
 * What the run and Combat know of a boss, whichever it is (design/content/SPEC.md §2.2).
 * INV: every boss is 900 HP, never deals more than 22 in one hit, never winds up under 620 ms.
 */
export interface Boss extends Enemy {
  readonly kind: 'boss'
  readonly def: BossDef
  /** = def.hp */
  readonly maxHp: number
  /** Below 55%. INV: once true, never false. */
  readonly phase2: boolean
  /** True for exactly the one update in which phase2 turned true. */
  readonly justPhase2: boolean
  /** Its ×1.5 window (the Assembler stunned, grill open). hit() applies the ×1.5 itself. */
  readonly open: boolean
  /** World-space telegraphs that don't follow the body (piles, lanes). Added to the scene with it. */
  readonly worldGroup: THREE.Group
  /** Footprint radius when it never walks: spacing never moves it, and Still is pushed out of it. null when it walks. */
  readonly anchored: number | null
  /** The current windup's sound shape. Read on the tick its phase becomes 'windup'. */
  readonly cue: BossCue
  /** Committed tell ends for the camera: the charge lane's end. */
  threats(out: THREE.Vector3[]): void
  /** Presentation only, about 11 times a second: smoke, sparks, steam. */
  dress(vfx: Vfx): void
  /** Presentation only, on the tick its phase becomes 'strike'. */
  strikeFx(vfx: Vfx): void
}
export const isBoss = (e: Enemy): e is Boss => e.kind === 'boss'

/** The one place a boss is built from its def. The Arbiter stands among the square's posts, and cracks them. */
export function makeBoss(def: BossDef, x: number, z: number, face: THREE.Vector3, posts: Post[] = []): Boss {
  switch (def.kind) {
    case 'assembler': return new Assembler(def, x, z)
    case 'arbiter': return new Arbiter(def, x, z, face, posts)
  }
}

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
  /**
   * The lane is drawn and hit honestly, like the ram's: the core is its body's
   * width, the rails where Still's centre is hit (1.57 either side), once a charge.
   */
  charge: { windupMs: 950, lockAt: 0.55, speed: 21, coreHalf: 1.15, hitHalf: 1.57, reach: 30, damage: 22, stunMs: 1700 },
  summon: { windupMs: 1250, count: 3, maxAdds: 4 },
  magnet: { windupMs: 1500, strength: 3.3, radius: 3.6, damage: 20 },
}

export type BossMove = 'sweep' | 'wave' | 'barrage' | 'charge' | 'summon' | 'magnet'

const BODY = 0x4a3a36
const JOINT = 0x221c1e
const CORE = 0xff5a3c
const STONE = new THREE.Color(0x5a5550)
const SOOT = new THREE.Color(0x3a2a24)
const at3 = (p: { x: number; z: number }, y: number) => new THREE.Vector3(p.x, y, p.z)

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


export class Assembler implements Boss {
  readonly kind = 'boss'
  readonly anchored = null
  readonly labelY = 2.3
  get radius() { return BOSS.radius * this.size }
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
  readonly height = 4.2
  rime = 0
  air = 0

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
  /** The charge's aim is set: the lane stops following. Read by the camera and the checks. */
  locked = false
  private last: BossMove | null = null
  private chain = false
  private volleysLeft = 0
  private volleyTimer = 0
  private gaps: number[] = []
  private summonPoints: THREE.Vector3[] = []
  /** The charge's cut: from the body to the first solid, the same number drawn and run. */
  private laneLen = 0
  private laneKind: LaneEnd = 'open'
  private readonly chargeFrom = new THREE.Vector3()
  private readonly chargeEnd = new THREE.Vector3()
  private chargeHit = false
  /** How far the charge may still run: its full reach, not the drawn cut, so a lane cut by a wall always ends in it. */
  private chargeLeft = 0
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
  /** Its lane is 3.14 wide and up to 27 long: lit like the ram's it was a flat slab, so the core and wash stay low. */
  readonly laneTell = new LaneTell({ wash: [0.07, 0.1], core: [0.26, 0.4], cap: [0.1, 0.14] })
  /** World-space telegraphs, apart from the tell group that follows the body: the piles and the lane. */
  private readonly worldTells = new THREE.Group()
  private readonly magnetDisc: THREE.Mesh
  private readonly magnetRing: THREE.Mesh
  private readonly piles = new THREE.Group()
  private readonly tells: THREE.ShaderMaterial[] = []

  constructor(readonly def: BossDef, x: number, z: number) {
    this.pos.set(x, 0, z)
    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.7, metalness: 0.5 })
    this.jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })
    // cores ignore the fog: at first dark the lights are what's left of a machine
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })

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

    this.tellGroup.add(this.sector, this.sectorEdge, this.lanes, this.fan, this.magnetDisc, this.magnetRing)
    this.worldTells.add(this.piles, this.laneTell.group)
    this.tellGroup.position.y = DECAL_Y
  }

  /** Where the summoned piles glow and the charge lane lies: world space, apart from the tell group. */
  get worldGroup() {
    return this.worldTells
  }

  // --- as a Boss: getters over its own fields, so nothing it does changes ---
  get maxHp() { return this.def.hp }
  get phase2() { return this.overloaded }
  get justPhase2() { return this.justOverloaded }
  get open() { return this.stunned }
  get cue(): BossCue {
    return this.move === 'barrage' || this.move === 'charge' ? { voice: 'aim', lockAt: BOSS.charge.lockAt } : { voice: 'windup' }
  }

  /** The charge's lane end, once it's committed: it runs the length of the arena. */
  threats(out: THREE.Vector3[]) {
    if (this.dead || this.move !== 'charge' || this.stunned) return
    if ((this.phase === 'windup' && this.locked) || this.phase === 'strike') out.push(this.laneEnd(new THREE.Vector3()))
  }

  /** The stacks smoke; overloaded, the core sheds embers; stunned, the open grill sparks. */
  dress(vfx: Vfx) {
    const stack = Math.random() < 0.5 ? new THREE.Vector3(-0.45, 3.8, -0.55) : new THREE.Vector3(0.4, 3.5, -0.55)
    vfx.smokePuff(this.group.localToWorld(stack), 1, this.overloaded ? SOOT : undefined)
    if (this.overloaded) vfx.embers(at3(this.pos, 1.8), 2, 1.2)
    if (this.stunned) vfx.sparks(this.group.localToWorld(new THREE.Vector3(0, 1.75, 1.1)), EMBER, 3, 4)
    if (this.move === 'charge' && this.phase === 'strike') vfx.dust(this.pos, 3, 1.5, undefined, 2)
  }

  /** The hammer's sweep throws sparks; a slam or the magnet's pull lands in dust and rubble. */
  strikeFx(vfx: Vfx) {
    if (this.move === 'sweep') {
      vfx.dust(this.pos, 22, 4.5, undefined, 6)
      vfx.sparks(at3(this.pos, 0.8), EMBER, 18, 8)
    } else if (this.move === 'wave' || this.move === 'magnet') {
      vfx.dust(this.pos, 30, 3.5, undefined, 7)
      vfx.chunks(at3(this.pos, 0.3), 14, STONE, 6, 0.18)
      vfx.flash(at3(this.pos, 0.5), EMBER, 2.2)
    }
  }

  /** Where the charge's lane ends now. */
  laneEnd(out: THREE.Vector3) {
    return out.set(this.pos.x + Math.sin(this.aim) * this.laneLen, 0, this.pos.z + Math.cos(this.aim) * this.laneLen)
  }

  /** Nothing breaks the Assembler's windups: a Parry lands its damage and nothing else. */
  interrupt() {
    return false
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

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
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
            // a slow reaches the walk and nothing else: every windup, strike and the charge keep full speed
            const sp = BOSS.speed * (this.overloaded ? 1.25 : 1) * this.speedMul
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
          action = this.strike(dt, target, terrain, ctx)
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
    if (this.move === 'charge') {
      if (!this.locked) {
        this.aim = toward
        this.facing = toward
        if (t >= BOSS.charge.lockAt) this.locked = true
      }
      // every tick, tracking and locked: the lane is drawn to where the charge really stops
      this.cut(terrain)
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
        return { kind: 'wave', center: this.pos.clone(), gaps: [...this.gaps], damage: BOSS.wave.damage, gapWidth: BOSS.wave.gapWidth, minGap: BOSS.wave.minGap }
      case 'barrage':
        this.volleysLeft = BOSS.barrage.volleys
        this.volleyTimer = 0
        this.timer = 99999
        return null
      case 'charge': {
        this.timer = 99999
        this.chargeFrom.copy(this.pos)
        this.laneEnd(this.chargeEnd)
        this.chargeHit = false
        this.chargeLeft = BOSS.charge.reach
        return null
      }
      case 'summon':
        this.timer = 400
        return { kind: 'summon', points: this.summonPoints.map((p) => p.clone()), maxAdds: BOSS.summon.maxAdds }
      case 'magnet':
        this.timer = 260
        return target.distanceTo(this.pos) <= BOSS.magnet.radius + 0.4 && this.inSight(target, terrain)
          ? { kind: 'melee', damage: BOSS.magnet.damage }
          : null
    }
    return null
  }

  private pulled = false

  private strike(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
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
      const fx = Math.sin(this.aim)
      const fz = Math.cos(this.aim)
      const step = BOSS.charge.speed * dt
      const ax = this.pos.x
      const az = this.pos.z
      const nx = ax + fx * step
      const nz = az + fz * step
      const free = terrain.clampMove(ax, az, nx, nz, this.radius)
      const blocked = Math.hypot(free.x - nx, free.z - nz) > 0.05
      this.pos.x = free.x
      this.pos.z = free.z
      this.chargeLeft -= Math.hypot(free.x - ax, free.z - az)
      // burn-off: the lane shrinks to what's left in front of it
      this.laneLen = Math.max(0, (this.chargeEnd.x - free.x) * fx + (this.chargeEnd.z - free.z) * fz)
      // swept, once a charge: his centre within the rails of this tick's run, not behind where it started
      const along = (target.x - this.chargeFrom.x) * fx + (target.z - this.chargeFrom.z) * fz
      const hitYou = !this.chargeHit && along >= 0 && distToSegment(target.x, target.z, ax, az, free.x, free.z) <= BOSS.charge.hitHalf
      if (hitYou) this.chargeHit = true
      // like the ram, a charge into a crate breaks it on the way to being stuck there
      if (blocked) ctx.emit({ kind: 'rushEnd', e: this, how: 'wall', at: new THREE.Vector3(free.x + fx * this.radius, 0.4, free.z + fz * this.radius) })
      if (blocked || this.chargeLeft < 0.5) {
        // into the wall: stunned, grill open
        this.stunned = blocked
        this.stunTimer = BOSS.charge.stunMs
        this.flash = 1
        if (!blocked) this.endMove()
        else this.move = 'charge'
      }
      return hitYou ? { kind: 'melee', damage: BOSS.charge.damage, source: this, tested: true } : null
    }

    if (this.timer <= 0) this.endMove()
    return null
  }

  /** The charge's lane: its full reach, cut by the first solid a body this big would meet. */
  private cut(terrain: Terrain) {
    const fx = Math.sin(this.aim)
    const fz = Math.cos(this.aim)
    const want = BOSS.charge.reach
    const end = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + fx * want, this.pos.z + fz * want, this.radius)
    this.laneLen = Math.hypot(end.x - this.pos.x, end.z - this.pos.z)
    if (this.laneLen >= want - 0.05) this.laneKind = 'open'
    else {
      // what the body itself meets one step on: a wide body can hit a crate off its centreline,
      // and a box or the void anywhere in that circle makes it a wall
      this.laneKind = terrain.blocker(end.x + fx * 0.21, end.z + fz * 0.21, this.radius, false) === 'prop' ? 'prop' : 'wall'
    }
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
    // soonest on top: its tells sit in the crowd by how soon they land
    const order = tellOrder(winding ? this.timer : 0)
    this.tellGroup.traverse((o) => { o.renderOrder = order })
    this.piles.traverse((o) => { o.renderOrder = order })
    this.sector.visible = this.sectorEdge.visible = this.move === 'sweep'
    this.lanes.visible = this.move === 'wave'
    this.fan.visible = this.move === 'barrage'
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
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.6)
      m.emissive.setRGB(this.flash * 0.5 + (this.overloaded ? 0.08 : 0), this.flash * 0.2, this.flash * 0.15)
    }

    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.04))

    const charging = this.move === 'charge' && !this.asleep
    const lock = BOSS.charge.lockAt
    this.laneTell.update(dt, {
      stage: charging && winding ? (this.locked ? 'locked' : 'tracking') : charging && striking && !this.stunned ? 'rush' : 'off',
      x: this.pos.x, z: this.pos.z, aim: this.aim, len: this.laneLen,
      coreHalf: BOSS.charge.coreHalf, hitHalf: BOSS.charge.hitHalf, bodyR: this.radius, end: this.laneKind,
      fill: striking ? 1 : (t - lock) / (1 - lock),
      order,
      from: striking ? Math.hypot(this.pos.x - this.chargeFrom.x, this.pos.z - this.chargeFrom.z) : 0,
    })
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
    scene.remove(this.group, this.tellGroup, this.worldTells)
    this.worldTells.remove(this.laneTell.group)
    this.laneTell.dispose()
    disposeBody(this.group, this.tellGroup, this.worldTells)
    for (const m of [this.mat, this.jointMat, this.coreMat]) m.dispose()
    for (const m of this.tells) releaseTell(m)
  }
}
