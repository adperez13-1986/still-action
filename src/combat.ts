import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, EMBER, type Vfx } from './vfx'
import { Chaser, shoveVelocity, type Enemy } from './enemy'
import { Ranged } from './ranged'
import { Assembler, BOSS } from './boss'
import type { Terrain } from './terrain'
import type { Breakable } from './dungeon'
import type { AbilityDef } from './abilities'

const AUTO_RANGE = 7.6
const AUTO_INTERVAL = 0.62
const AUTO_DAMAGE = 7
const BOLT_SPEED = 26
const PLAYER_MAX_HP = 100
const PLAYER_RADIUS = 0.42
const SHOT_SPEED = 15
const SHOT_RADIUS = 0.3
/** Long enough that the dash reads as travel, not a teleport. */
export const DASH_MS = 280
/** A swing connects with anything whose body reaches the blade, not just its centre. */
export const MELEE_PAD = 0.6

interface Bolt {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
  radius: number
  /** Piercing bolts remember who they've hit, so each enemy is hit once. */
  pierced?: Set<Enemy>
}

/** An enemy projectile. Slower than yours, and waist-high walls stop it. */
interface Shot {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
}

export type Archetype = Enemy['kind']

/** The whole pack wakes at this distance from any member. */
const WAKE_RADIUS = 8
/** Past this from every member, a pack gives up and walks home. */
const LEASH_RADIUS = 16
const HOME_SPEED = 3
const BODY_SPACING = 1.1

/**
 * D2's champions: a named leader with one modifier, standing bigger than its pack,
 * with a cold aura. Always drops, with better tier odds.
 */
export type EliteMod = 'swift' | 'plated' | 'splitting' | 'warding'
export const ELITE_TITLE: Record<EliteMod, string> = {
  swift: 'the Quick', plated: 'the Plated', splitting: 'the Many', warding: 'the Warden',
}
export const ELITE_LINE: Record<EliteMod, string> = {
  swift: 'its whole pack moves fast',
  plated: 'takes half damage, barely moves when hit',
  splitting: 'breaks into two when it falls',
  warding: 'its pack takes little damage while it stands',
}
export interface Elite {
  name: string
  mod: EliteMod
  leader: Enemy
  aura: THREE.Mesh
}

export interface Pack {
  elite?: Elite
  members: Enemy[]
  state: 'asleep' | 'awake' | 'returning'
  /** A side room's pack always pays out. */
  side: boolean
  dropped: boolean
  homes: Map<Enemy, THREE.Vector3>
  /** Where each member looks while it sleeps. */
  gaze: Map<Enemy, THREE.Vector3>
  /** Summed HP, to notice a sleeping pack being shot at. */
  hpSeen: number
  /** Overrides for the boss: it wakes from further off and never gives up. */
  wakeRadius?: number
  leash?: number
}

/** A shockwave rolling out from a slam. Gaps are safe lanes; walls don't stop it. */
interface Wave {
  center: THREE.Vector3
  r: number
  gaps: number[]
  damage: number
  hit: boolean
  segs: THREE.Mesh[]
}
const WAVE_SPEED = 9
const WAVE_MAX = 16
const WAVE_SEGS = 72

interface Fx {
  mesh: THREE.Mesh
  mat: THREE.ShaderMaterial
  life: number
  max: number
  from: number
  to: number
}

export interface CombatEvents {
  onHit: (at: THREE.Vector3) => void
  onPlayerHurt: (amount: number) => void
  onKill: (at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean) => void
  onWake: (at: THREE.Vector3) => void
  onSmash: (b: Breakable) => void
  /** A boss volley leaving the cannon. */
  onVolley: (at: THREE.Vector3) => void
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
  readonly packs: Pack[] = []
  /** This level's crates and barrels. Anything that hits one breaks it, whoever fired. */
  breakables: Breakable[] = []
  /** The boss, while one is alive. */
  boss: Assembler | null = null
  private waves: Wave[] = []
  private readonly waveGeo = new THREE.BoxGeometry(0.5, 0.35, 0.28)
  private readonly waveMat = new THREE.MeshBasicMaterial({ color: 0xff8a50, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
  /** Sparks, trails and embers. Set by the run once the scene exists. */
  vfx: Vfx | null = null
  private pull: { center: THREE.Vector3; strength: number; t: number } | null = null
  private readonly packOf = new Map<Enemy, Pack>()

  private bolts: Bolt[] = []
  private shots: Shot[] = []
  /** Effects that land a beat after the cast, on game time (so hitstop and the stop freeze them too). */
  private later: { t: number; run: () => void }[] = []
  private fx: Fx[] = []
  private autoTimer = 0
  private hurtCooldown = 0

  // Still's bolts are cold light; enemy shots are embers. Both leave trails.
  private readonly boltGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8)
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0x8fb8e8, blending: THREE.AdditiveBlending, transparent: true })
  private readonly abilityBoltMat = new THREE.MeshBasicMaterial({ color: 0xeef6ff, blending: THREE.AdditiveBlending, transparent: true })
  private readonly shotGeo = new THREE.SphereGeometry(SHOT_RADIUS, 10, 8)
  private readonly shotMat = new THREE.MeshBasicMaterial({ color: 0xff8a50, blending: THREE.AdditiveBlending, transparent: true })

  constructor(
    private readonly scene: THREE.Scene,
    /** Swapped for each level. */
    public terrain: Terrain,
    private readonly events: CombatEvents,
  ) {}

  /** Enemies that are actually after you. Sleeping and homeward packs don't count. */
  get awake(): Enemy[] {
    return this.enemies.filter((e) => this.packOf.get(e)?.state === 'awake')
  }

  update(dt: number, player: THREE.Vector3) {
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)
    this.updatePacks(player)

    // --- enemies ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!
      const pack = this.packOf.get(e)
      if (pack && pack.state !== 'awake') {
        if (pack.state === 'returning') this.walkHome(e, pack, dt)
        e.idle(dt, pack.state === 'returning' ? pack.homes.get(e)! : pack.gaze.get(e)!)
        continue
      }
      const before = e.phase
      const action = e.update(dt, player, this.terrain)
      if (e.phase !== before) {
        if (e.phase === 'windup') this.events.onWindup(e, e.windupMs)
        if (e.phase === 'strike') this.events.onStrike(e)
      }
      if (action?.kind === 'melee') this.hurtPlayer(action.damage)
      if (action?.kind === 'shot') this.fireShot(e.pos, action.dir, action.damage)
      if (action?.kind === 'shots') {
        for (const d of action.dirs) this.fireShot(action.from, d, action.damage)
        this.events.onVolley(action.from)
      }
      if (action?.kind === 'wave') this.startWave(action.center, action.gaps, action.damage)
      if (action?.kind === 'summon' && pack) this.summon(pack, action.points)
      if (action?.kind === 'pull') this.pull = { center: action.center, strength: action.strength, t: action.seconds }
      if (e.dead) {
        e.dispose(this.scene)
        this.enemies.splice(i, 1)
        if (pack) {
          pack.members.splice(pack.members.indexOf(e), 1)
          this.packOf.delete(e)
          const wasElite = pack.elite?.leader === e
          if (wasElite && pack.elite!.mod === 'splitting') this.split(pack, e)
          if (wasElite) {
            this.scene.remove(pack.elite!.aura)
            pack.elite!.aura.geometry.dispose()
            ;(pack.elite!.aura.material as THREE.Material).dispose()
          }
          this.events.onKill(e.pos, e.kind, pack, wasElite)
          if (pack.members.length === 0) this.packs.splice(this.packs.indexOf(pack), 1)
        }
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
      this.vfx?.trail(b.mesh.position, COLD, b.radius > 0.5 ? 0.34 : 0.18)

      let spent = b.life <= 0
      // same rule as enemy shots: waist-high walls stop yours too
      if (!spent && this.terrain.blocked(b.mesh.position.x, b.mesh.position.z, 0.15)) {
        this.smashNear(b.mesh.position.x, b.mesh.position.z, 0.4)
        this.events.onShotBlocked(b.mesh.position)
        this.ring(b.mesh.position, 0.2, 0.8, 0.18, 0x8fb8e8)
        spent = true
      }
      if (!spent) {
        for (const e of this.enemies) {
          if (b.pierced?.has(e)) continue
          const dx = b.mesh.position.x - e.pos.x
          const dz = b.mesh.position.z - e.pos.z
          if (Math.hypot(dx, dz) < b.radius + e.radius) {
            e.hit(b.damage)
            this.events.onHit(e.pos)
            if (b.pierced) {
              b.pierced.add(e)
              continue
            }
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

    // --- the magnet: Still is dragged toward the boss while it winds up ---
    // (player is Still's own position vector; moving it here is the pull)
    if (this.pull) {
      this.pull.t -= dt
      const dx = this.pull.center.x - player.x
      const dz = this.pull.center.z - player.z
      const d = Math.hypot(dx, dz)
      if (d > 1.8) {
        player.x += (dx / d) * this.pull.strength * dt
        player.z += (dz / d) * this.pull.strength * dt
      }
      if (this.pull.t <= 0 || !this.boss || this.boss.dead) this.pull = null
    }

    // --- shockwaves ---
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i]!
      w.r += WAVE_SPEED * dt
      const gapHalf = BOSS.wave.gapWidth / 2
      const inGap = (a: number) => w.gaps.some((g) => {
        let d = a - g
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        return Math.abs(d) < gapHalf
      })
      w.segs.forEach((m, k) => {
        const a = (k / WAVE_SEGS) * Math.PI * 2
        m.visible = !inGap(a)
        m.position.set(w.center.x + Math.sin(a) * w.r, 0.2, w.center.z + Math.cos(a) * w.r)
        m.rotation.y = a
      })
      this.waveMat.opacity = 0.85 * (1 - w.r / WAVE_MAX) + 0.15
      // embers thrown up along the front
      for (let e = 0; e < 3; e++) {
        const m = w.segs[Math.floor(Math.random() * w.segs.length)]!
        if (m.visible) this.vfx?.embers(m.position, 1, 0.2)
      }
      const pd = Math.hypot(player.x - w.center.x, player.z - w.center.z)
      if (!w.hit && Math.abs(pd - w.r) < 0.55 && !inGap(Math.atan2(player.x - w.center.x, player.z - w.center.z))) {
        w.hit = true
        this.hurtPlayer(w.damage)
      }
      if (w.r > WAVE_MAX) {
        for (const m of w.segs) this.scene.remove(m)
        this.waves.splice(i, 1)
      }
    }

    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i]!
      l.t -= dt
      if (l.t <= 0) {
        this.later.splice(i, 1)
        l.run()
      }
    }

    // --- enemy shots ---
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]!
      s.mesh.position.addScaledVector(s.dir, SHOT_SPEED * dt)
      s.life -= dt
      this.vfx?.trail(s.mesh.position, EMBER, 0.3)
      s.mesh.scale.setScalar(0.85 + Math.random() * 0.3)
      const p = s.mesh.position

      let spent = s.life <= 0
      if (!spent && Math.hypot(p.x - player.x, p.z - player.z) < SHOT_RADIUS + PLAYER_RADIUS) {
        this.hurtPlayer(s.damage)
        spent = true
      }
      if (!spent && this.terrain.blocked(p.x, p.z, 0.15)) {
        this.smashNear(p.x, p.z, 0.4)
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
      f.mat.opacity = (1 - k) * 0.95
      if (f.life <= 0) {
        this.scene.remove(f.mesh)
        f.mesh.geometry.dispose()
        releaseTell(f.mat)
        this.fx.splice(i, 1)
      }
    }
  }

  /** Where Still should be looking. Null when nothing is in range. */
  nearestTarget(from: THREE.Vector3, range = AUTO_RANGE): THREE.Vector3 | null {
    return this.nearest(from, range)?.pos ?? null
  }

  /** A new level: HP is whole again. Strain is what carries over. */
  refill() {
    this.hp = PLAYER_MAX_HP
  }

  reset() {
    this.hp = PLAYER_MAX_HP
    for (const e of this.enemies) {
      e.dispose(this.scene)
      this.events.onGone(e)
    }
    this.enemies.length = 0
    for (const p of this.packs) {
      if (!p.elite) continue
      this.scene.remove(p.elite.aura)
      p.elite.aura.geometry.dispose()
      ;(p.elite.aura.material as THREE.Material).dispose()
    }
    this.packs.length = 0
    this.packOf.clear()
    for (const b of this.bolts) this.scene.remove(b.mesh)
    this.bolts.length = 0
    for (const w of this.waves) for (const m of w.segs) this.scene.remove(m)
    this.waves.length = 0
    this.pull = null
    this.boss = null
    for (const s of this.shots) this.scene.remove(s.mesh)
    this.shots.length = 0
    this.later.length = 0
    for (const f of this.fx) this.scene.remove(f.mesh)
    this.fx.length = 0
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

  /** A burst ring at a point: for smashed crates and used shrines. */
  burst(at: THREE.Vector3, color: number) {
    this.ring(at, 0.3, 1.6, 0.35, color)
  }

  /** A shrine's price: the nearest sleeping pack hears it. */
  wakeNearest(at: THREE.Vector3) {
    let best: Pack | null = null
    let bestD = Infinity
    for (const p of this.packs) {
      if (p.state !== 'asleep' || !p.members[0]) continue
      const d = p.members[0].pos.distanceTo(at)
      if (d < bestD) {
        bestD = d
        best = p
      }
    }
    if (best) this.wake(best)
  }

  private smashNear(x: number, z: number, pad: number) {
    for (const b of this.breakables) {
      if (!b.broken && Math.hypot(b.x - x, b.z - z) < b.r + pad) {
        this.events.onSmash(b)
        return
      }
    }
  }

  private clearShot(from: THREE.Vector3, to: THREE.Vector3): boolean {
    return this.terrain.lineClear(from.x, from.z, to.x, to.z, 0.15)
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
        const aim = target
          ? Math.atan2(target.pos.x - origin.x, target.pos.z - origin.z)
          : facing
        const spread = def.mod === 'fan' ? [-0.26, 0, 0.26] : [0]
        for (const off of spread) {
          const dir = new THREE.Vector3(Math.sin(aim + off), 0, Math.cos(aim + off))
          const mesh = new THREE.Mesh(this.boltGeo, this.abilityBoltMat)
          mesh.scale.set(2.2, 2.2, 2.6)
          mesh.position.set(origin.x, 1.15, origin.z)
          mesh.rotation.y = aim + off
          this.scene.add(mesh)
          this.bolts.push({
            mesh, dir, life: def.range / BOLT_SPEED, damage: def.damage, radius: def.radius,
            pierced: def.mod === 'pierce' ? new Set() : undefined,
          })
        }
        break
      }

      case 'nova': {
        for (const e of this.enemies) {
          const d = Math.hypot(e.pos.x - origin.x, e.pos.z - origin.z)
          if (d <= def.radius + e.radius - 0.5) {
            e.hit(def.damage)
            const ox = e.pos.x - origin.x
            const oz = e.pos.z - origin.z
            if (def.mod === 'pull') {
              // drag them in, but stop short of stacking them on top of you
              e.knock.addScaledVector(shoveVelocity(-ox, -oz, Math.max(0, d - 1.4)), e.knockMul)
            } else {
              // shove them out of your face — this is the panic button. Closer flies further.
              e.knock.addScaledVector(shoveVelocity(ox, oz, Math.max(2.4, 4.2 - d * 0.35)), e.knockMul)
            }
            this.ring(e.pos, 0.2, 0.9, 0.3, 0x8fa3b8)
            this.events.onHit(e.pos)
          }
        }
        for (const b of this.breakables) {
          if (!b.broken && Math.hypot(b.x - origin.x, b.z - origin.z) <= def.radius + b.r) this.events.onSmash(b)
        }
        if (def.mod === 'pull') this.ring(origin, def.radius, 0.3, 0.45, 0xbcd6ff)
        else this.ring(origin, 0.3, def.radius, 0.45, 0x8fb8e8)
        break
      }

      case 'arc': {
        // A melee swing never needs aiming — snap to whatever is closest in reach.
        // Snap reach must equal hit reach, or the blade turns toward things it can't touch.
        const snap = this.nearest(origin, def.range + MELEE_PAD)
        const aimed = snap ? Math.atan2(snap.pos.x - origin.x, snap.pos.z - origin.z) : facing
        const fx = Math.sin(aimed)
        const fz = Math.cos(aimed)
        // the hook trades width for reach: ~80 degrees instead of 120
        const cone = def.mod === 'hook' ? 0.76 : 0.5
        for (const e of this.enemies) {
          const dx = e.pos.x - origin.x
          const dz = e.pos.z - origin.z
          const d = Math.hypot(dx, dz)
          if (d > def.range + MELEE_PAD + e.radius - 0.55) continue
          // 120-degree sweep in front
          if ((dx / d) * fx + (dz / d) * fz < cone) continue
          e.hit(def.damage)
          if (def.mod === 'hook' && d > 1.5) e.knock.addScaledVector(shoveVelocity(-dx, -dz, d - 1.3), e.knockMul)
          this.events.onHit(e.pos)
        }
        for (const b of this.breakables) {
          if (b.broken) continue
          const bx = b.x - origin.x
          const bz = b.z - origin.z
          const bd = Math.hypot(bx, bz)
          if (bd <= def.range + b.r && (bx / bd) * fx + (bz / bd) * fz >= cone) this.events.onSmash(b)
        }
        this.sweep(origin, aimed, def.range, 0x8fb8e8, Math.acos(cone) * 2)
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

        // the dash stops at the first wall, it never carries you over one
        const end = this.terrain.clampMove(origin.x, origin.z, origin.x + dx * def.range, origin.z + dz * def.range, PLAYER_RADIUS)
        const ex = end.x
        const ez = end.z

        // everything near the line gets run over — at the moment Still reaches it, not on the press
        const sx = origin.x
        const sz = origin.z
        const lenSq = (ex - sx) ** 2 + (ez - sz) ** 2
        for (const e of this.enemies) {
          if (this.distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > def.radius + e.radius) continue
          const along = lenSq > 0 ? Math.max(0, Math.min(1, ((e.pos.x - sx) * (ex - sx) + (e.pos.z - sz) * (ez - sz)) / lenSq)) : 0
          // the dash eases out, so the time to reach a point isn't linear in distance
          const reachT = 1 - Math.sqrt(1 - along)
          this.later.push({
            t: reachT * (DASH_MS / 1000),
            run: () => {
              if (e.dead || this.distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > def.radius + 1.1) return
              e.hit(def.damage)
              e.knock.addScaledVector(shoveVelocity(e.pos.x - sx, e.pos.z - sz, 1.2), e.knockMul)
              this.events.onHit(e.pos)
            },
          })
        }
        for (const b of this.breakables) {
          if (!b.broken && this.distToSegment(b.x, b.z, sx, sz, ex, ez) <= def.radius + b.r) this.events.onSmash(b)
        }
        this.ring(origin, 0.3, 1.6, 0.3, 0xbcd6ff)
        this.events.onDash(ex, ez, DASH_MS)
        if (def.mod === 'slam') {
          const at = new THREE.Vector3(ex, 0, ez)
          this.later.push({
            t: DASH_MS / 1000,
            run: () => {
              for (const e of this.enemies) {
                if (Math.hypot(e.pos.x - at.x, e.pos.z - at.z) <= 2.8) {
                  e.hit(10)
                  this.events.onHit(e.pos)
                }
              }
              this.ring(at, 0.3, 2.8, 0.35, 0x8fb8e8)
            },
          })
        }
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
    const hot = new THREE.Color(color)
    const mat = tellMaterial('radial', 1, hot, hot.clone().multiplyScalar(0.3))
    mat.opacity = 0.95
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), mat)
    mesh.rotation.x = -Math.PI / 2
    mesh.position.set(at.x, DECAL_Y, at.z)
    mesh.scale.setScalar(from)
    this.scene.add(mesh)
    this.fx.push({ mesh, mat, life, max: life, from, to })
  }

  private sweep(at: THREE.Vector3, facing: number, range: number, color: number, spread = (Math.PI * 2) / 3) {
    const hot = new THREE.Color(color)
    const mat = tellMaterial('radial', range, hot, hot.clone().multiplyScalar(0.3))
    mat.opacity = 0.9
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(range, 24, -spread / 2, spread), mat)
    // The circle's rotation.z is applied before the tilt flat, so it maps to the
    // floor with z mirrored. -facing + PI/2 looked right on the x axis only.
    mesh.rotation.x = -Math.PI / 2
    mesh.rotation.z = facing - Math.PI / 2
    mesh.position.set(at.x, DECAL_Y + 0.01, at.z)
    this.scene.add(mesh)
    this.fx.push({ mesh, mat, life: 0.22, max: 0.22, from: 1, to: 1.15 })
  }

  /** Put a sleeping pack in the level. Packs are placed, not spawned from a rim. */
  addPack(members: { kind: Archetype; x: number; z: number }[], side: boolean, elite?: { mod: EliteMod; name: string }): Pack {
    const pack: Pack = { members: [], state: 'asleep', side, dropped: false, homes: new Map(), gaze: new Map(), hpSeen: 0 }
    const look = Math.random() * Math.PI * 2
    for (const m of members) {
      const e = m.kind === 'ranged' ? new Ranged(m.x, m.z) : new Chaser(m.x, m.z)
      this.scene.add(e.group, e.tellGroup)
      this.enemies.push(e)
      e.setAsleep(true)
      pack.members.push(e)
      pack.homes.set(e, new THREE.Vector3(m.x, 0, m.z))
      const a = look + (Math.random() - 0.5) * 1.2
      pack.gaze.set(e, new THREE.Vector3(m.x + Math.sin(a), 0, m.z + Math.cos(a)))
      this.packOf.set(e, pack)
      e.idle(0, pack.gaze.get(e)!)
    }
    if (elite && pack.members[0]) this.crown(pack, pack.members[0], elite.mod, elite.name)
    pack.hpSeen = this.hpOf(pack)
    this.packs.push(pack)
    return pack
  }

  /** The area's boss: its own pack, woken by walking into the arena, never leashed. */
  addBoss(x: number, z: number, face: THREE.Vector3): Assembler {
    const b = new Assembler(x, z)
    this.scene.add(b.group, b.tellGroup, b.pileGroup)
    this.enemies.push(b)
    b.setAsleep(true)
    const pack: Pack = {
      members: [b], state: 'asleep', side: false, dropped: false,
      homes: new Map([[b as Enemy, new THREE.Vector3(x, 0, z)]]),
      gaze: new Map([[b as Enemy, face.clone()]]),
      hpSeen: b.hp, wakeRadius: 12.5, leash: Infinity,
    }
    this.packOf.set(b, pack)
    this.packs.push(pack)
    this.boss = b
    b.idle(0, face)
    return b
  }

  private startWave(center: THREE.Vector3, gaps: number[], damage: number) {
    const segs = Array.from({ length: WAVE_SEGS }, () => {
      const m = new THREE.Mesh(this.waveGeo, this.waveMat)
      this.scene.add(m)
      return m
    })
    this.waves.push({ center: center.clone(), r: 1.4, gaps, damage, hit: false, segs })
  }

  /** "Assemble": scrap piles become small awake hulks, up to a cap. */
  private summon(pack: Pack, points: THREE.Vector3[]) {
    const adds = pack.members.filter((e) => e.kind === 'chaser').length
    for (const p of points.slice(0, Math.max(0, BOSS.summon.maxAdds - adds))) {
      const c = new Chaser(p.x, p.z)
      c.size = 0.78
      c.hp = 18
      this.scene.add(c.group, c.tellGroup)
      this.enemies.push(c)
      c.setAsleep(false)
      pack.members.push(c)
      pack.homes.set(c, p.clone())
      pack.gaze.set(c, p.clone())
      this.packOf.set(c, pack)
      this.ring(p, 0.3, 1.8, 0.4, 0xff7a55)
    }
  }

  private crown(pack: Pack, leader: Enemy, mod: EliteMod, name: string) {
    leader.size = 1.28
    leader.hp *= 2
    if (mod === 'swift') for (const e of pack.members) e.speedMul = 1.45
    if (mod === 'plated') {
      leader.armor = 0.5
      leader.knockMul = 0.3
    }
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0x7d98ff, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    aura.rotation.x = -Math.PI / 2
    this.scene.add(aura)
    pack.elite = { name, mod, leader, aura }
  }

  /** "the Many": the leader falls apart into two smaller, awake hulks. */
  private split(pack: Pack, from: Enemy) {
    for (const side of [-1, 1]) {
      const c = new Chaser(from.pos.x + side * 0.6, from.pos.z)
      c.size = 0.72
      c.hp = 12
      this.scene.add(c.group, c.tellGroup)
      this.enemies.push(c)
      c.setAsleep(false)
      c.knock.set(side * 6, 0, 0)
      pack.members.push(c)
      pack.homes.set(c, from.pos.clone())
      pack.gaze.set(c, from.pos.clone())
      this.packOf.set(c, pack)
    }
  }

  private hpOf(pack: Pack) {
    return pack.members.reduce((a, e) => a + e.hp, 0)
  }

  private wake(pack: Pack) {
    if (pack.state === 'awake') return
    const wasAsleep = pack.state === 'asleep'
    pack.state = 'awake'
    for (const e of pack.members) e.setAsleep(false)
    if (wasAsleep && pack.members[0]) this.events.onWake(pack.members[0].pos)
  }

  private updatePacks(player: THREE.Vector3) {
    for (const pack of this.packs) {
      const el = pack.elite
      if (el && !el.leader.dead) {
        el.aura.position.set(el.leader.pos.x, DECAL_Y, el.leader.pos.z)
        // the warden shields the rest of its pack while it stands
        if (el.mod === 'warding') for (const e of pack.members) e.armor = e === el.leader ? 1 : 0.35
      } else if (el?.mod === 'warding') {
        for (const e of pack.members) e.armor = 1
      }
      const nearest = Math.min(...pack.members.map((e) => Math.hypot(e.pos.x - player.x, e.pos.z - player.z)))
      const hp = this.hpOf(pack)
      const shot = hp < pack.hpSeen
      pack.hpSeen = hp
      if (pack.state !== 'awake') {
        if (nearest < (pack.wakeRadius ?? WAKE_RADIUS) || shot) this.wake(pack)
      } else if (nearest > (pack.leash ?? LEASH_RADIUS)) {
        // lost you: walk home and settle
        pack.state = 'returning'
        for (const e of pack.members) e.setAsleep(false)
      }
      if (pack.state === 'returning' && pack.members.every((e) => e.pos.distanceTo(pack.homes.get(e)!) < 0.4)) {
        pack.state = 'asleep'
        for (const e of pack.members) e.setAsleep(true)
      }
    }
    // awake bodies don't stack on each other
    const moving = this.enemies.filter((e) => this.packOf.get(e)?.state !== 'asleep')
    for (let a = 0; a < moving.length; a++) {
      for (let b = a + 1; b < moving.length; b++) {
        const p = moving[a]!.pos
        const q = moving[b]!.pos
        const dx = q.x - p.x
        const dz = q.z - p.z
        const d = Math.hypot(dx, dz)
        if (d > 0.001 && d < BODY_SPACING) {
          const push = (BODY_SPACING - d) / 2
          p.x -= (dx / d) * push
          p.z -= (dz / d) * push
          q.x += (dx / d) * push
          q.z += (dz / d) * push
        }
      }
    }
  }

  private walkHome(e: Enemy, pack: Pack, dt: number) {
    const home = pack.homes.get(e)!
    const d = e.pos.distanceTo(home)
    if (d < 0.05) return
    const to = this.terrain.nextStep(e.pos.x, e.pos.z, home.x, home.z, 0.5)
    const sx = to.x - e.pos.x
    const sz = to.z - e.pos.z
    const sd = Math.hypot(sx, sz) || 1
    const step = Math.min(d, HOME_SPEED * dt)
    e.pos.x += (sx / sd) * step
    e.pos.z += (sz / sd) * step
    this.terrain.pushOut(e.pos, 0.5)
  }

}
