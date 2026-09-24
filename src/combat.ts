import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, EMBER, type Vfx } from './vfx'
import { Chaser, shoveVelocity, type Enemy } from './enemy'
import { Ranged } from './ranged'
import { Assembler, BOSS } from './boss'
import type { Terrain } from './terrain'
import type { Breakable } from './dungeon'
import type { AbilityDef, BeatKey } from './abilities'
import type { SlotName } from './still'
import { PART, type EnemyStatus, type Held, type PartEvent, type PartRuntime, type StillMove } from './parts'

const AUTO_RANGE = 7.6
const AUTO_INTERVAL = 0.62
const AUTO_DAMAGE = 5
const PLAYER_MAX_HP = 100
const PLAYER_RADIUS = 0.42
const SHOT_SPEED = 15
const SHOT_RADIUS = 0.3
/** A swing connects with anything whose body reaches the blade, not just its centre. */
export const MELEE_PAD = 0.6

/** What a cast knows about the moment it was pressed. */
export interface CastContext {
  origin: THREE.Vector3      // Still's live position; clone anything you store
  facing: number
  moveX: number; moveZ: number
  pushed: boolean
  /** Run strain at the moment of the press (Frayed Cleaver reads it). */
  strain: number
}

/** What a cast did, for the HUD, the strain meter and Still's body. */
export interface CastResult {
  /**
   * 'start'   the HUD starts the full cooldown now (almost everything)
   * 'hold'    the part is live and waits for a second press; the button stays tappable (Plumb plant)
   * 'refused' nothing happened: no cooldown, no strain, no push cost, no beat (Plumb snap past 10 u)
   */
  cooldown: 'start' | 'hold' | 'refused'
  /** The part's own strain for this cast (def.strain). Main adds +2 on top if pushed. */
  strain: number
  /** Face this way for the beat (arcs, grabs), or null to leave facing alone. */
  aim: number | null
  beat: BeatKey
  /** 0..1 where a beat scales (Patient Lens charge); 0 otherwise. */
  power: number
  /** Seconds to hold the pose at k = 1 (stances: Ward, Mirror, Brace, Anvil). */
  holdS: number
  /** −1 / 0 / +1: which side the head cants (Ricochet bank). */
  lean: number
}

/** Who hurt Still: Anvil catches melee only, and the sound can tell them apart. */
export type HurtSource = 'melee' | 'shot' | 'wave'

interface Bolt {
  mesh: THREE.Mesh
  /** A part's bolt (it consumes marks); false for the auto attack. */
  part: boolean
  dir: THREE.Vector3
  life: number
  damage: number
  radius: number
  /** Piercing bolts remember who they've hit, so each enemy is hit once. */
  pierced?: Set<Enemy>
  /** A volley's shared memory (Coil): skip anyone a sibling already hit, stop on a new one. */
  once?: Set<Enemy>
  /** Trail size; defaults to the bolt's weight class. */
  trail?: number
}

/** Where Patient Lens sits after a swap or a new level: ready, but with nothing banked. */
const PATIENT_START = 1.5

/** An enemy projectile. Slower than yours, and waist-high walls stop it. */
interface Shot {
  mesh: THREE.Mesh
  dir: THREE.Vector3
  life: number
  damage: number
  /** Who fired it: a Mirror Ward sends it back there. */
  owner?: Enemy
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
  /** Members at birth. A pack pays out about the same whatever its size, so each kill rolls 1/size of it. */
  size: number
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
  /** Per segment: how far out the ring gets before cover stops it. */
  reach: number[]
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
  onPlayerHurt: (amount: number, source: HurtSource) => void
  /** `summoned`: a boss add, scrap that never drops anything. */
  onKill: (at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean) => void
  onWake: (at: THREE.Vector3) => void
  onSmash: (b: Breakable) => void
  /** A boss volley leaving the cannon. */
  onVolley: (at: THREE.Vector3) => void
  onShot: () => void
  onWindup: (e: Enemy, ms: number) => void
  onStrike: (e: Enemy) => void
  onGone: (e: Enemy) => void
  onShotBlocked: (at: THREE.Vector3) => void
  /** A part did something this instant. Lasting things are polled instead (parts.ts). */
  onPart: (ev: PartEvent) => void
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
  /** Where Still was on the last update: windows answer a hit there. */
  private lastPlayer = new THREE.Vector3()
  /** Boss adds: scrap, so they never roll drops. */
  private readonly summoned = new WeakSet<Enemy>()
  /** Dev checks switch it off to test a part in isolation. */
  autoAttack = true
  /** Marks and slows, per enemy. Deleted when the enemy is buried. */
  private readonly status = new Map<Enemy, EnemyStatus>()
  /** Enemies in the clamp's throw. While held, an enemy doesn't think. */
  private readonly held = new Map<Enemy, Held>()
  /** What parts have out in the world. Each window, decoy and anchor joins this as its part is built. */
  readonly parts: PartRuntime = { guard: null, anvil: null, decoy: null, anchor: null, patientSince: PATIENT_START }

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
    this.lastPlayer = player
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)
    this.updatePacks(player)

    // --- enemies ---
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]!
      // killed between ticks (a cast, a bolt): buried before it can act, so a hulk
      // killed mid-windup never lands its slam
      if (e.dead) {
        this.bury(i)
        continue
      }
      // statuses tick for everyone, sleepers included
      const st = this.status.get(e)
      if (st) this.tickStatus(e, st, dt)
      const h = this.held.get(e)
      if (h) {
        // in the clamp's throw: carried for a beat, then lobbed. It doesn't think.
        h.t += dt
        const k = Math.min(1, Math.max(0, (h.t - PART.throwLead) / (h.T - PART.throwLead)))
        e.pos.lerpVectors(h.from, h.to, k)
        e.knock.set(0, 0, 0)
        e.idle(dt, h.to)
        e.group.position.y = Math.sin(k * Math.PI) * PART.throwPeak
        if (h.t >= h.T) {
          this.held.delete(e)
          this.landThrow(e, h)
        }
        continue
      }
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
      if (action?.kind === 'melee') this.hurtPlayer(action.damage, 'melee')
      if (action?.kind === 'shot') this.fireShot(e.pos, action.dir, action.damage, e)
      if (action?.kind === 'shots') {
        for (const d of action.dirs) this.fireShot(action.from, d, action.damage, e)
        this.events.onVolley(action.from)
      }
      if (action?.kind === 'wave') this.startWave(action.center, action.gaps, action.damage)
      if (action?.kind === 'summon' && pack) this.summon(pack, action.points)
      if (action?.kind === 'pull') this.pull = { center: action.center, strength: action.strength, t: action.seconds }
      if (e.dead) this.bury(i)
    }
    this.tickParts(dt)

    // --- auto attack: nearest enemy in range, no aiming required ---
    this.autoTimer -= dt
    if (this.autoAttack && this.autoTimer <= 0) {
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
      b.mesh.position.addScaledVector(b.dir, PART.boltSpeed * dt)
      b.life -= dt
      this.vfx?.trail(b.mesh.position, COLD, b.trail ?? (b.radius > 0.5 ? 0.34 : 0.18))

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
          if (b.pierced?.has(e) || b.once?.has(e)) continue
          const dx = b.mesh.position.x - e.pos.x
          const dz = b.mesh.position.z - e.pos.z
          if (Math.hypot(dx, dz) < b.radius + e.radius) {
            if (b.part) this.hitPart(e, b.damage)
            else {
              e.hit(b.damage)
              this.events.onHit(e.pos)
            }
            b.once?.add(e)
            if (b.pierced) {
              b.pierced.add(e)
              // n counts up along the line, so each pass can sound a step higher
              this.events.onPart({ kind: 'pierce', at: e.pos.clone(), n: b.pierced.size })
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
      // a gap is ~50 degrees, but never narrower than minGap units, even close in
      const inGap = (a: number, r: number) => w.gaps.some((g) => {
        let d = a - g
        while (d > Math.PI) d -= Math.PI * 2
        while (d < -Math.PI) d += Math.PI * 2
        return Math.abs(d) < Math.max(BOSS.wave.gapWidth / 2, BOSS.wave.minGap / 2 / Math.max(0.5, r))
      })
      w.segs.forEach((m, k) => {
        const a = (k / WAVE_SEGS) * Math.PI * 2
        // behind cover the ring is gone: you can see the shadow where you'd be safe
        m.visible = !inGap(a, w.r) && w.r < w.reach[k]!
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
      const shadowed = !this.terrain.lineClear(w.center.x, w.center.z, player.x, player.z, 0.1)
      if (!w.hit && Math.abs(pd - w.r) < 0.55 && !shadowed && !inGap(Math.atan2(player.x - w.center.x, player.z - w.center.z), pd)) {
        w.hit = true
        this.hurtPlayer(w.damage, 'wave')
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
      // a shell meets shots before they reach him: Ward destroys them, Mirror Ward sends them home
      const g = this.parts.guard
      if (!spent && g && g.kind !== 'brace' && Math.hypot(p.x - player.x, p.z - player.z) < g.radius) {
        if (g.kind === 'ward') {
          g.used = true
          this.events.onPart({ kind: 'shield', at: p.clone(), reflected: false })
          spent = true
        } else if (g.reflectsLeft > 0) {
          g.reflectsLeft--
          g.used = true
          const o = s.owner && !s.owner.dead ? s.owner.pos : null
          const aim = o ? Math.atan2(o.x - p.x, o.z - p.z) : Math.atan2(-s.dir.x, -s.dir.z)
          // his shot now: a cold bolt, and walls stop it like any other
          this.spawnBolt(p, aim, g.reflectDamage, 0.3, 20)
          this.events.onPart({ kind: 'shield', at: p.clone(), reflected: true })
          spent = true
        }
      }
      if (!spent && Math.hypot(p.x - player.x, p.z - player.z) < SHOT_RADIUS + PLAYER_RADIUS) {
        this.hurtPlayer(s.damage, 'shot')
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
    this.parts.patientSince = PATIENT_START
    this.parts.guard = null
    this.parts.anvil = null
    this.status.clear()
    this.held.clear()
  }

  // --- statuses: marks and slows, the same hooks for every archetype ---

  /** Read-only, for what's drawn on bodies (badges, rime motes). */
  statusOf(e: Enemy): Readonly<EnemyStatus> | undefined {
    return this.status.get(e)
  }

  /** Every enemy carrying a status right now. */
  statuses(): IterableIterator<[Enemy, Readonly<EnemyStatus>]> {
    return this.status.entries()
  }

  private statusFor(e: Enemy): EnemyStatus {
    let st = this.status.get(e)
    if (!st) {
      st = { markT: 0, slowT: 0, slowMul: 1 }
      this.status.set(e, st)
    }
    return st
  }

  /** Signal Flare's mark: the next hit from a part lands twice. Refreshes, never stacks. Public for dev checks. */
  mark(e: Enemy, seconds: number) {
    const st = this.statusFor(e)
    st.markT = Math.max(st.markT, seconds)
    this.events.onPart({ kind: 'mark', enemy: e, state: 'on' })
  }

  /**
   * A slow multiplies speedMul and the restore divides it back out: store and
   * divide, so Quick (1.45) × 0.5 comes back to exactly 1.45. Refreshes, never stacks.
   * It only touches speedMul, which every archetype reads only in its walk.
   */
  applySlow(e: Enemy, seconds: number, mul: number) {
    const st = this.statusFor(e)
    if (st.slowT <= 0) {
      e.speedMul *= mul
      st.slowMul = mul
      this.events.onPart({ kind: 'slow', enemy: e, state: 'on' })
    }
    st.slowT = Math.max(st.slowT, seconds)
  }

  private tickStatus(e: Enemy, st: EnemyStatus, dt: number) {
    if (st.markT > 0 && (st.markT -= dt) <= 0) {
      st.markT = 0
      this.events.onPart({ kind: 'mark', enemy: e, state: 'expired' })
    }
    if (st.slowT > 0 && (st.slowT -= dt) <= 0) {
      st.slowT = 0
      e.speedMul /= st.slowMul
      st.slowMul = 1
      this.events.onPart({ kind: 'slow', enemy: e, state: 'off' })
    }
    // frost climbs while it's slowed and recedes after (presentation, read by each class's tint)
    e.rime = st.slowT > 0 ? Math.min(1, e.rime + dt * 3) : Math.max(0, e.rime - dt * 2)
  }

  /**
   * Every part hit comes through here, so a mark is used by the next part that
   * lands, whichever it is. The auto attack and Signal Flare's own 4 don't come
   * through here. A mark doubles damage only: shoves come from the def, never from this.
   */
  private hitPart(e: Enemy, damage: number): boolean {
    const st = this.status.get(e)
    let d = damage
    if (st && st.markT > 0) {
      d *= 2
      st.markT = 0
      this.events.onPart({ kind: 'mark', enemy: e, state: 'consumed' })
    }
    const killed = e.hit(d)
    this.events.onHit(e.pos)
    return killed
  }

  /** A thrown enemy comes down: the landing hurts it, a wall hurts it more, and the splash shoves what's near. */
  private landThrow(e: Enemy, h: Held) {
    const mod = h.def.mod?.kind === 'toss' ? h.def.mod : null
    e.group.position.y = 0
    this.hitPart(e, h.def.damage)
    // not doubled: the mark was used by the first hit
    if (h.short && mod && !e.dead) {
      e.hit(mod.wallDamage)
      this.events.onHit(e.pos)
    }
    const blast = h.def.blast ?? 0
    const to = h.to
    this.events.onPart({ kind: 'land', at: to.clone(), radius: blast, what: h.short ? 'wall' : 'throw' })
    for (const o of this.enemies) {
      if (o === e || o.dead) continue
      if (Math.hypot(o.pos.x - to.x, o.pos.z - to.z) > blast + o.radius || !this.terrain.lineClear(to.x, to.z, o.pos.x, o.pos.z, PART.linePad)) continue
      this.hitPart(o, h.def.blastDamage ?? 0)
      this.shoveFrom(o, to.x, to.z, mod?.splashShove ?? 0)
    }
    for (const b of this.breakables) {
      if (!b.broken && Math.hypot(b.x - to.x, b.z - to.z) <= blast + b.r) this.events.onSmash(b)
    }
    this.ring(to, 0.3, blast, 0.3, 0x8fb8e8)
  }

  /** Part timers, on game time: pause, hitstop and the stop freeze them the way they freeze enemies. */
  private tickParts(dt: number) {
    const p = this.parts
    p.patientSince += dt
    if (p.guard && (p.guard.t -= dt) <= 0) this.endGuard()
    if (p.anvil && (p.anvil.t -= dt) <= 0) this.endAnvil()
  }

  /** G8: a window ends with a small tick, and says whether it met anything. */
  private endGuard() {
    const g = this.parts.guard
    if (!g) return
    this.parts.guard = null
    this.events.onPart({ kind: 'windowEnd', slot: 'torso', used: g.used })
  }

  /** The Anvil ran out without a blow to catch. A catch closes it without this. */
  private endAnvil() {
    if (!this.parts.anvil) return
    this.parts.anvil = null
    this.events.onPart({ kind: 'windowEnd', slot: 'arms', used: false })
  }

  /** How much of a slot's window is left, 1 → 0, for the button's LIVE ring. Null when nothing is out. */
  liveFrac(slot: SlotName): number | null {
    const p = this.parts
    if (slot === 'torso' && p.guard) return Math.max(0, p.guard.t / p.guard.max)
    if (slot === 'arms' && p.anvil) return Math.max(0, p.anvil.t / p.anvil.max)
    return null
  }

  /**
   * A part is leaving its slot (a swap). Whatever it had running in Still's own
   * body ends here; things already out in the world finish on their own.
   */
  clearSlot(slot: SlotName) {
    // a swapped-in Patient Lens starts ready but uncharged, so a swap can't bank a full shot
    if (slot === 'head') this.parts.patientSince = PATIENT_START
    // a window ends quietly, as if it ran out
    if (slot === 'torso') this.endGuard()
    if (slot === 'arms') this.endAnvil()
  }

  /** Anvil: the blow that would have hit him lands on the clamp, and he hammers back. */
  private catchBlow() {
    const a = this.parts.anvil
    if (!a) return
    this.parts.anvil = null
    const at = this.lastPlayer.clone()
    this.events.onPart({ kind: 'catch', at })
    for (const e of this.enemies) {
      if (!this.inBlast(at, e, a.def.radius) || this.shaded(at, e)) continue
      this.hitPart(e, a.def.damage)
      this.shoveFrom(e, at.x, at.z, a.def.shove ?? 0)
    }
    for (const b of this.breakables) {
      if (!b.broken && Math.hypot(b.x - at.x, b.z - at.z) <= a.def.radius + b.r) this.events.onSmash(b)
    }
    this.ring(at, 0.3, a.def.radius, 0.35, 0x8fb8e8)
  }

  /** Every way Still loses HP comes through here, so windows (Anvil, Brace) have one place to step in. */
  private hurtPlayer(damage: number, source: HurtSource) {
    if (this.hurtCooldown > 0) return
    // Anvil first: it catches body strikes only, and a catch folds simultaneous strikes into one
    if (source === 'melee' && this.parts.anvil) {
      this.hurtCooldown = 0.35
      this.catchBlow()
      return
    }
    // Brace: the hit becomes strain instead of integrity. Main adds it, so it can end the run.
    const g = this.parts.guard
    if (g?.kind === 'brace') {
      this.hurtCooldown = 0.35
      g.used = true
      this.events.onPart({ kind: 'strain', amount: Math.ceil(damage / g.perStrain), at: this.lastPlayer.clone() })
      return
    }
    this.hp = Math.max(0, this.hp - damage)
    this.hurtCooldown = 0.35
    this.events.onPlayerHurt(damage, source)
  }

  /** The dead branch of the enemy loop: out of the scene, out of its pack, paid out. */
  private bury(i: number) {
    const e = this.enemies[i]!
    const pack = this.packOf.get(e)
    // dying in the air means no landing
    this.status.delete(e)
    this.held.delete(e)
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
      this.events.onKill(e.pos, e.kind, pack, wasElite, this.summoned.has(e))
      if (pack.members.length === 0) this.packs.splice(this.packs.indexOf(pack), 1)
    }
    this.events.onGone(e)
  }

  /** An enemy shot. Public for dev checks; `owner` is who a Mirror Ward sends it back to. */
  fireShot(from: THREE.Vector3, dir: THREE.Vector3, damage: number, owner?: Enemy) {
    const mesh = new THREE.Mesh(this.shotGeo, this.shotMat)
    // leaves from the barrel, not the feet
    mesh.position.set(from.x + dir.x * 0.7, 1.45, from.z + dir.z * 0.7)
    this.scene.add(mesh)
    this.shots.push({ mesh, dir, life: 20 / SHOT_SPEED, damage, owner })
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
    this.bolts.push({ mesh, part: false, dir, life: 0.7, damage: AUTO_DAMAGE, radius: 0.3 })
  }

  /**
   * One part, one action. `shape` decides how it lands, the def's numbers decide
   * how hard, and the mod bends it one way. Returns what the HUD and the body need.
   */
  useAbility(def: AbilityDef, ctx: CastContext): CastResult {
    const o = ctx.origin
    const mod = def.mod
    const r: CastResult = { cooldown: 'start', strain: def.strain ?? 0, aim: null, beat: def.beat, power: 0, holdS: 0, lean: 0 }

    switch (def.shape) {
      case 'bolt': {
        // no line needed to pick a target: walls stop the bolt, not the aim
        const target = this.nearest(o, def.range)
        const aim = target ? Math.atan2(target.pos.x - o.x, target.pos.z - o.z) : ctx.facing
        let damage = def.damage
        let scale = 1
        let trail: number | undefined
        if (mod?.kind === 'charge') {
          // Patient Lens: what it banked since the last shot. A push always fires full.
          const c = ctx.pushed ? 1 : Math.min(1, Math.max(0, (this.parts.patientSince - mod.minS) / (mod.fullS - mod.minS)))
          damage = mod.minDamage + (def.damage - mod.minDamage) * c
          // the hit stays the full 0.85; only the look says how much is in it
          scale = (0.3 + (0.85 - 0.3) * c) / 0.85
          trail = 0.14 + 0.2 * c
          r.power = c
          this.parts.patientSince = 0
        }
        const fan = mod?.kind === 'fan' ? mod : null
        const spread = fan ? Array.from({ length: fan.count }, (_, k) => (k - (fan.count - 1) / 2) * fan.spreadRad) : [0]
        // a volley shares one memory, so each enemy takes at most one of its bolts
        const once = fan ? new Set<Enemy>() : undefined
        if (fan) trail = 0.16
        for (const off of spread) {
          this.spawnBolt(o, aim + off, damage, def.radius, def.range, { pierced: mod?.kind === 'pierce' ? new Set() : undefined, once, scale, trail })
        }
        break
      }

      case 'lob': {
        // arcs over walls onto where the target stands now: it can't miss a sleeper, it can miss a mover
        const target = this.pickTarget(o, def.range, true)
        const to = target ? new THREE.Vector3(target.pos.x, 0, target.pos.z) : this.ahead(o, ctx.facing, Math.min(def.range, PART.lobNoTarget))
        const ms = def.travelMs ?? 800
        const mark = mod?.kind === 'mark' ? mod : null
        this.events.onPart({ kind: 'lob', from: o.clone(), to: to.clone(), ms, radius: def.radius, signal: !!mark })
        this.later.push({
          t: ms / 1000,
          run: () => {
            // no line check: it came down from above
            for (const e of this.enemies) {
              if (Math.hypot(e.pos.x - to.x, e.pos.z - to.z) > def.radius + e.radius) continue
              if (mark) {
                // Signal Flare: its own 4 is a plain hit, so it never uses up the mark it leaves
                e.hit(def.damage)
                this.events.onHit(e.pos)
                this.mark(e, mark.ms / 1000)
              } else {
                this.hitPart(e, def.damage)
              }
            }
            for (const b of this.breakables) {
              if (!b.broken && Math.hypot(b.x - to.x, b.z - to.z) <= def.radius + b.r) this.events.onSmash(b)
            }
            this.ring(to, 0.3, def.radius, 0.35, 0x8fb8e8)
            this.events.onPart({ kind: 'land', at: to.clone(), radius: def.radius, what: mark ? 'signal' : 'flare' })
          },
        })
        break
      }

      case 'nova': {
        const pull = mod?.kind === 'pull' ? mod : null
        for (const e of this.enemies) {
          // a blast doesn't go through the wall you're hiding behind, either way
          if (!this.inBlast(o, e, def.radius) || this.shaded(o, e)) continue
          const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
          this.hitPart(e, def.damage)
          // Chill Vent: slows the walk, never a windup or a strike
          if (mod?.kind === 'slow') this.applySlow(e, mod.ms / 1000, mod.mul)
          const ox = e.pos.x - o.x
          const oz = e.pos.z - o.z
          if (pull) {
            // drag them in, but stop short of stacking them on top of you
            e.knock.addScaledVector(shoveVelocity(-ox, -oz, Math.max(0, d - pull.to)), e.knockMul)
          } else if (def.shove) {
            // shove them out of your face: this is the panic button. Closer flies further.
            this.shoveFrom(e, o.x, o.z, Math.max(PART.novaShoveMin, def.shove - PART.novaShoveFalloff * d))
          }
          this.ring(e.pos, 0.2, 0.9, 0.3, 0x8fa3b8)
        }
        // crates are hit without the line check: anything that touches one breaks it
        for (const b of this.breakables) {
          if (!b.broken && Math.hypot(b.x - o.x, b.z - o.z) <= def.radius + b.r) this.events.onSmash(b)
        }
        if (pull) this.ring(o, def.radius, 0.3, 0.45, 0xbcd6ff)
        // the frost ring grows slower, and in his cold variant
        else if (mod?.kind === 'slow') this.ring(o, 0.3, def.radius, 0.55, 0x8fb8e8, true)
        else this.ring(o, 0.3, def.radius, 0.45, 0x8fb8e8)
        if (mod?.kind === 'brace') {
          // then, for a moment, hits cost strain instead of integrity (a push reopens it at full)
          const s = (def.windowMs ?? 800) / 1000
          this.parts.guard = { kind: 'brace', t: s, max: s, radius: def.radius, reflectsLeft: 0, reflectDamage: 0, perStrain: mod.perStrain, used: false }
          r.holdS = s
        }
        break
      }

      case 'ward': {
        // a shell that meets shots in the shot loop; melee, waves and pulls go straight through it
        const s = (def.windowMs ?? 1400) / 1000
        const reflect = mod?.kind === 'reflect' ? mod : null
        this.parts.guard = {
          kind: reflect ? 'mirror' : 'ward', t: s, max: s, radius: def.radius,
          reflectsLeft: reflect?.max ?? 0, reflectDamage: reflect?.damage ?? 0, perStrain: 0, used: false,
        }
        r.holdS = s
        break
      }

      case 'grab': {
        // Clamp Toss: the nearest thing the clamp can reach and touch, thrown the way you're steering
        let e: Enemy | null = null
        let best = Infinity
        for (const c of this.enemies) {
          const d = Math.hypot(c.pos.x - o.x, c.pos.z - o.z)
          if (d < best && !this.held.has(c) && this.inReach(o, c, def.range) && !this.shaded(o, c)) {
            e = c
            best = d
          }
        }
        if (!e) {
          // a whiff: the clamp snaps shut on nothing, and the cooldown still starts
          this.sweep(o, ctx.facing, def.range, 0x8fb8e8, Math.PI / 2)
          break
        }
        r.aim = Math.atan2(e.pos.x - o.x, e.pos.z - o.z)
        // too heavy to lift (the Assembler): it just takes the bite
        if (e.knockMul < 0.1) {
          this.hitPart(e, def.damage)
          break
        }
        // lifted out of its swing
        if (e.phase === 'windup' && e.interrupt()) this.events.onPart({ kind: 'interrupt', enemy: e })
        const m = Math.hypot(ctx.moveX, ctx.moveZ)
        let dx = m >= 0.1 ? ctx.moveX / m : e.pos.x - o.x
        let dz = m >= 0.1 ? ctx.moveZ / m : e.pos.z - o.z
        const dm = Math.hypot(dx, dz)
        if (dm < 1e-6) {
          dx = Math.sin(ctx.facing)
          dz = Math.cos(ctx.facing)
        } else {
          dx /= dm
          dz /= dm
        }
        const dist = (def.shove ?? 0) * e.knockMul
        const end = this.terrain.clampMove(e.pos.x, e.pos.z, e.pos.x + dx * dist, e.pos.z + dz * dist, e.radius)
        const to = new THREE.Vector3(end.x, 0, end.z)
        const short = Math.hypot(end.x - e.pos.x, end.z - e.pos.z) < dist - 0.05
        const T = (def.travelMs ?? 350) / 1000
        this.held.set(e, { from: e.pos.clone(), to, t: 0, T, short, def })
        this.events.onPart({ kind: 'throw', enemy: e, to: to.clone(), ms: T * 1000, short })
        break
      }

      case 'catch': {
        // Anvil: the next body strike inside the window is caught (hurtPlayer), then countered
        const s = (def.windowMs ?? 900) / 1000
        this.parts.anvil = { t: s, max: s, def }
        r.holdS = s
        break
      }

      case 'arc': {
        // Frayed Cleaver: the strain at the press picks the width
        const fray = mod?.kind === 'fray' ? mod : null
        const tier = fray ? (ctx.strain < fray.at[0] ? 0 : ctx.strain < fray.at[1] ? 1 : 2) : 0
        const coneDeg = fray ? fray.cones[tier]! : def.cone ?? 120
        if (fray) r.beat = (['fray-90', 'fray-180', 'fray-360'] as const)[tier]!
        const hook = mod?.kind === 'hook' ? mod : null
        const parry = mod?.kind === 'parry' ? mod : null
        const coneCos = coneDeg >= 360 ? -1.01 : Math.cos((coneDeg * Math.PI) / 360)
        // A melee swing never needs aiming: snap to the nearest thing the blade can
        // actually touch. Snap reach equals hit reach, or the blade turns toward
        // things it can't reach. Nothing in reach: still face the nearest threat.
        let snap: Enemy | null = null
        let snapD = Infinity
        for (const e of this.enemies) {
          const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
          if (d < snapD && this.inReach(o, e, def.range) && !this.shaded(o, e)) {
            snap = e
            snapD = d
          }
        }
        const face = snap ?? this.nearest(o, 9.5)
        const aimed = face ? Math.atan2(face.pos.x - o.x, face.pos.z - o.z) : ctx.facing
        r.aim = aimed
        const fx = Math.sin(aimed)
        const fz = Math.cos(aimed)
        for (const e of this.enemies) {
          if (!this.inReach(o, e, def.range)) continue
          const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
          if (d > 0.001 && ((e.pos.x - o.x) / d) * fx + ((e.pos.z - o.z) / d) * fz < coneCos) continue
          // behind a wall: no spark, no sound. The swing visibly fails to reach it.
          if (this.shaded(o, e)) continue
          const winding = e.phase === 'windup'
          this.hitPart(e, def.damage)
          if (parry) {
            // Parry Clamp: caught mid-windup, the attack breaks and it stumbles back
            if (!e.dead && winding && e.interrupt()) {
              this.shoveFrom(e, o.x, o.z, parry.shove)
              this.events.onPart({ kind: 'interrupt', enemy: e })
            }
          } else if (hook) {
            // Rusted Hook: yanked to a point just in front of Still, not onto him
            const vx = o.x + fx * hook.to - e.pos.x
            const vz = o.z + fz * hook.to - e.pos.z
            const v = Math.hypot(vx, vz)
            if (v > 0.2) e.knock.addScaledVector(shoveVelocity(vx, vz, v), e.knockMul)
          } else if (def.shove) {
            // Piston: straight along the jab, not away from Still, so it drives one enemy back in a line
            e.knock.addScaledVector(shoveVelocity(fx, fz, def.shove), e.knockMul)
          }
        }
        for (const b of this.breakables) {
          if (b.broken) continue
          const bx = b.x - o.x
          const bz = b.z - o.z
          const bd = Math.hypot(bx, bz)
          if (bd <= def.range + b.r && (bd < 0.001 || (bx / bd) * fx + (bz / bd) * fz >= coneCos)) this.events.onSmash(b)
        }
        this.sweep(o, aimed, def.range, 0x8fb8e8, (coneDeg * Math.PI) / 180)
        break
      }

      case 'dash': {
        // Overrun: a push swaps the short step for the charge's own numbers
        const over = mod?.kind === 'overrun' && ctx.pushed ? mod : null
        if (mod?.kind === 'overrun') r.beat = over ? 'overrun-charge' : 'overrun-step'
        const range = over?.range ?? def.range
        const damage = over?.damage ?? def.damage
        const width = over?.radius ?? def.radius
        const knock = over?.shove ?? def.shove ?? 0
        const ms = over?.travelMs ?? def.travelMs ?? 280
        const dir = this.steer(ctx)
        // the dash stops at the first wall, it never carries you over one
        const end = this.terrain.clampMove(o.x, o.z, o.x + dir.x * range, o.z + dir.z * range, PLAYER_RADIUS)
        const sx = o.x
        const sz = o.z
        const ex = end.x
        const ez = end.z

        // everything near the line gets run over, at the moment Still reaches it, not on the press
        if (damage > 0) {
          const lenSq = (ex - sx) ** 2 + (ez - sz) ** 2
          // the charge throws them aside, off the path, instead of ahead of it
          const nx = -dir.z
          const nz = dir.x
          for (const e of this.enemies) {
            if (this.distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > width + e.radius) continue
            const along = lenSq > 0 ? Math.max(0, Math.min(1, ((e.pos.x - sx) * (ex - sx) + (e.pos.z - sz) * (ez - sz)) / lenSq)) : 0
            // the dash eases out, so the time to reach a point isn't linear in distance
            const reachT = 1 - Math.sqrt(1 - along)
            this.later.push({
              t: reachT * (ms / 1000),
              run: () => {
                if (e.dead || this.distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > width + 1.1) return
                this.hitPart(e, damage)
                if (over) {
                  const side = Math.sign((e.pos.x - sx) * nx + (e.pos.z - sz) * nz) || 1
                  e.knock.addScaledVector(shoveVelocity(nx * side, nz * side, knock), e.knockMul)
                } else {
                  this.shoveFrom(e, sx, sz, knock)
                }
              },
            })
          }
        }
        for (const b of this.breakables) {
          if (!b.broken && this.distToSegment(b.x, b.z, sx, sz, ex, ez) <= width + b.r) this.events.onSmash(b)
        }
        this.ring(o, 0.3, 1.6, 0.3, 0xbcd6ff)
        this.emitMove({ kind: 'dash', path: [new THREE.Vector3(ex, 0, ez)], ms, vault: false, lockMs: 0 }, r.beat)

        if (mod?.kind === 'slam') {
          // Skid Plates: the landing blast. Shoves, so it clears space where you stop.
          const at = new THREE.Vector3(ex, 0, ez)
          this.later.push({
            t: ms / 1000,
            run: () => {
              for (const e of this.enemies) {
                if (!this.inBlast(at, e, mod.radius) || this.shaded(at, e)) continue
                this.hitPart(e, mod.damage)
                this.shoveFrom(e, at.x, at.z, mod.shove)
              }
              this.ring(at, 0.3, mod.radius, 0.35, 0x8fb8e8)
            },
          })
        }
        break
      }

      case 'hop': {
        // airborne, no damage: hopping over a hulk is just a hop, enemies aren't terrain
        const dir = this.steer(ctx)
        const ms = def.travelMs ?? 180
        let to = this.terrain.clampMove(o.x, o.z, o.x + dir.x * def.range, o.z + dir.z * def.range, PLAYER_RADIUS)
        let vault = false
        const vaulting = mod?.kind === 'vault' ? mod : null
        if (vaulting && Math.hypot(to.x - o.x, to.z - o.z) < def.range - 0.05) {
          // Spring Heels: stretch up to maxRange for the first clear landing past the obstacle
          const land = this.vaultLanding(o, dir, to, def.range, vaulting.maxRange)
          if (land) {
            to = land
            vault = true
          }
        }
        this.emitMove({
          kind: 'hop', path: [new THREE.Vector3(to.x, 0, to.z)], ms, vault, lockMs: vault && vaulting ? vaulting.lockMs : 0,
        }, r.beat)
        break
      }
    }
    return r
  }

  /**
   * Where a vault lands, or null. It clears exactly one obstacle: the stretch from
   * where the plain hop stopped to the landing must hold one unbroken solid run.
   * Two walls with a gap between are refused, and off the floor is always solid,
   * so there's no vaulting out of the level.
   */
  private vaultLanding(o: THREE.Vector3, dir: { x: number; z: number }, stop: { x: number; z: number }, from: number, to: number) {
    for (let s = from; s <= to + 1e-6; s += 0.1) {
      const px = o.x + dir.x * s
      const pz = o.z + dir.z * s
      if (this.terrain.blocked(px, pz, PLAYER_RADIUS)) continue
      const len = Math.hypot(px - stop.x, pz - stop.z)
      const n = Math.max(1, Math.ceil(len / 0.1))
      let runs = 0
      let inside = false
      for (let i = 0; i <= n; i++) {
        const t = i / n
        const solid = this.terrain.blocked(stop.x + (px - stop.x) * t, stop.z + (pz - stop.z) * t, 0.001)
        if (solid && !inside) runs++
        inside = solid
      }
      return runs === 1 ? { x: px, z: pz } : null
    }
    return null
  }

  /** One of Still's bolts, leaving from lens height. `scale` shrinks the mesh only, never the hit. */
  private spawnBolt(
    o: THREE.Vector3, aim: number, damage: number, radius: number, range: number,
    opts: { pierced?: Set<Enemy>; once?: Set<Enemy>; scale?: number; trail?: number } = {},
  ) {
    const dir = new THREE.Vector3(Math.sin(aim), 0, Math.cos(aim))
    const mesh = new THREE.Mesh(this.boltGeo, this.abilityBoltMat)
    const k = opts.scale ?? 1
    mesh.scale.set(2.2 * k, 2.2 * k, 2.6 * k)
    mesh.position.set(o.x, 1.15, o.z)
    mesh.rotation.y = aim
    this.scene.add(mesh)
    this.bolts.push({ mesh, part: true, dir, life: range / PART.boltSpeed, damage, radius, pierced: opts.pierced, once: opts.once, trail: opts.trail })
  }

  /**
   * Nearest within range. With awakeFirst, anything awake beats anything that isn't:
   * a part that reaches without a clear line must never wake a second pack by accident.
   */
  private pickTarget(o: THREE.Vector3, range: number, awakeFirst: boolean): Enemy | null {
    let best: Enemy | null = null
    let bestD = Infinity
    let bestAwake = false
    for (const e of this.enemies) {
      const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
      if (d > range) continue
      const awake = awakeFirst && this.packOf.get(e)?.state === 'awake'
      if ((awake && !bestAwake) || (awake === bestAwake && d < bestD)) {
        best = e
        bestD = d
        bestAwake = awake
      }
    }
    return best
  }

  /** A point ahead of Still that isn't inside anything: stepped back toward him until it's clear. */
  private ahead(o: THREE.Vector3, facing: number, dist: number): THREE.Vector3 {
    for (let d = dist; d > 0; d -= 0.5) {
      const p = new THREE.Vector3(o.x + Math.sin(facing) * d, 0, o.z + Math.cos(facing) * d)
      if (!this.terrain.blocked(p.x, p.z, 0.01)) return p
    }
    return o.clone()
  }

  /** Arm reach: whatever body reaches the blade, not just its centre. */
  private inReach(o: THREE.Vector3, e: Enemy, range: number) {
    return Math.hypot(e.pos.x - o.x, e.pos.z - o.z) <= range + MELEE_PAD + e.radius - 0.55
  }

  /** Blast reach: the nova's own test, body included. */
  private inBlast(c: THREE.Vector3, e: Enemy, radius: number) {
    return Math.hypot(e.pos.x - c.x, e.pos.z - c.z) <= radius + e.radius - 0.5
  }

  /** Melee and blasts need a clear line, the same test a hulk uses before it swings. */
  private shaded(a: THREE.Vector3, e: Enemy) {
    return !this.terrain.lineClear(a.x, a.z, e.pos.x, e.pos.z, PART.linePad)
  }

  /** The stick's direction, or where he's facing when the stick is idle. A unit vector. */
  private steer(ctx: CastContext): { x: number; z: number } {
    const m = Math.hypot(ctx.moveX, ctx.moveZ)
    if (m < 0.1) return { x: Math.sin(ctx.facing), z: Math.cos(ctx.facing) }
    return { x: ctx.moveX / m, z: ctx.moveZ / m }
  }

  /** Shove away from a point by `dist` units of slide, scaled by how hard the enemy is to move. */
  private shoveFrom(e: Enemy, cx: number, cz: number, dist: number) {
    e.knock.addScaledVector(shoveVelocity(e.pos.x - cx, e.pos.z - cz, dist), e.knockMul)
  }

  /** A part moving Still: main hands it to his body. */
  private emitMove(move: StillMove, beat: BeatKey) {
    this.events.onPart({ kind: 'move', move, beat })
  }

  private distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const vx = bx - ax
    const vz = bz - az
    const len = vx * vx + vz * vz
    const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len)) : 0
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
  }

  /** A floor ring that grows from `from` to `to` over `life`: blasts, landings, impacts. */
  ring(at: THREE.Vector3, from: number, to: number, life: number, color: number, cold = false) {
    const hot = new THREE.Color(color)
    const mat = tellMaterial('radial', 1, hot, hot.clone().multiplyScalar(0.3), { cold })
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
    const pack: Pack = { members: [], state: 'asleep', side, dropped: false, size: members.length, homes: new Map(), gaze: new Map(), hpSeen: 0 }
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
      members: [b], state: 'asleep', side: false, dropped: false, size: 1,
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
    // march out along each segment's line once, to find where cover cuts it off
    const reach = Array.from({ length: WAVE_SEGS }, (_, k) => {
      const a = (k / WAVE_SEGS) * Math.PI * 2
      for (let r = 1.8; r < WAVE_MAX; r += 0.4) {
        if (this.terrain.blocked(center.x + Math.sin(a) * r, center.z + Math.cos(a) * r, 0.1)) return r
      }
      return WAVE_MAX
    })
    this.waves.push({ center: center.clone(), r: 1.4, reach, gaps, damage, hit: false, segs })
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
      this.summoned.add(c)
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

  /** The whole pack at once: there is no chain-waking. */
  wake(pack: Pack) {
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
