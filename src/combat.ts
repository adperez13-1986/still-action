import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, TELL_CROWD, COLD, EMBER, type Vfx } from './vfx'
import { Chaser, shoveVelocity, distToSegment, PLAYER_RADIUS, KNOCK_DECAY, type Enemy, type EnemyCtx, type EnemyEvent } from './enemy'
import { Ranged } from './ranged'
import { Lobber } from './lobber'
import { Thief, THIEF, type ThiefEvent } from './thief'
import { Charger, CHARGER } from './charger'
import { Mite, Brood, MiteBatch, MITE } from './swarm'
import { KILL_WEIGHT } from './loot'
import { BOSS, isBoss, makeBoss, type Boss } from './boss'
import type { BossDef } from './areas'
import { LiveHazard, SLAG, inShape, slagArm, threatPoint, type Hazard, type HazardShape, type HazardSpec } from './hazard'
import { LINE, type Line } from './line'
import type { Room } from './dungeon'

/** §4.24: the second Assembler's adds. Live add HP never passes today's four hulks' worth (4 x 18). */
const ADDS_HP_CAP = 72
const SUMMON_RAM = { hp: 22, size: 0.85 }
const SUMMON_MITES = 6
import type { Terrain } from './terrain'
import type { Breakable, Post } from './dungeon'
/** A train strip breaks every crate its segment's strip overlaps, grown this much (§5.4). */
const TRAIN_SMASH_GROW = 0.2
import type { AbilityDef, BeatKey } from './abilities'
import type { SlotName } from './still'
import { PART, History, bankShot, type EnemyStatus, type Flip, type Held, type PartEvent, type PartRuntime, type StillMove, type Zone } from './parts'

/** A boss that never walks: spacing leaves it where it stands. */
const anchored = (e: Enemy) => isBoss(e) && e.anchored !== null

const AUTO_RANGE = 7.6
const AUTO_INTERVAL = 0.62
const AUTO_DAMAGE = 5
const PLAYER_MAX_HP = 100
const SHOT_SPEED = 15
const SHOT_RADIUS = 0.3
/** A swing connects with anything whose body reaches the blade, not just its centre. */
export const MELEE_PAD = 0.6
/**
 * The hand (design/variety/PITCHES.md 1): with the nearest awake enemy in arm's reach (the
 * arcs' own test at `range`, about 3.5 u from a hulk's centre, outside its 2.4 slam) and a
 * clear line, the auto is a close strike on that one body, on the auto's own beat.
 */
export const HAND = { range: 2.9, damage: 10 }
/** How far from Still's centre a body's edge may be for the hand to reach it: the ring's radius. */
export const HAND_REACH = HAND.range + MELEE_PAD - 0.55
/**
 * The eye (design/variety/PITCHES.md 3): no stick for `settle` s and the auto reaches `range`,
 * and it and the head parts aim at the back line: leaders, then shooters, then the nearest.
 * Awake bodies only: at 11 u, past the 8 u wake radius, anything else would shoot a pack awake.
 */
export const EYE = { settle: 0.5, range: 11 }

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
export type HurtSource = 'melee' | 'shot' | 'wave' | 'hazard'

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
  /** Fired by a push: it lands as a pushed hit, however long it flies (the break rule). */
  pushed?: boolean
  speed: number
  /** Through-Line: ignores terrain, smashing crates it passes. */
  ghost?: boolean
  /** Ricochet: reflections left, and where each one happened (the answer retraces them). */
  bouncesLeft: number
  bounces: { at: THREE.Vector3; flip: Flip }[]
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
  /** An answer shot reflects like a Ricochet bolt. */
  bouncesLeft: number
  bounced: number
}

export type Archetype = Enemy['kind']

/** The whole pack wakes at this distance from any member. */
const WAKE_RADIUS = 8
/** Past this from every member, a pack gives up and walks home. */
const LEASH_RADIUS = 16
const HOME_SPEED = 3
/** A hit this long after another is the same blow: only a bigger one gets through, and only the difference. */
const HURT_WINDOW = 0.35

/** Seconds between committed locks. Two tells never freeze on the same beat, so each can be read. */
export const BOOK_GAP = 0.3

/**
 * Every committed lock (a ram's, a sentinel's) is booked on game time. A new
 * windup may start only if its lock lands clear of every booked one: when two
 * enemies would lock together, one waits a beat. Pause, hitstop and the stop
 * freeze it like everything else.
 */
export class LockBook {
  private entries: { at: number; owner: object }[] = []
  constructor(private readonly clock: () => number) {}
  canLock(offsetMs: number) {
    const t = this.clock() + offsetMs / 1000
    return !this.entries.some((b) => Math.abs(b.at - t) < BOOK_GAP)
  }
  book(owner: object, offsetMs: number) {
    this.entries.push({ at: this.clock() + offsetMs / 1000, owner })
  }
  /** Drop an owner's future locks: interrupted, buried, gone. */
  unbook(owner: object) {
    const now = this.clock()
    this.entries = this.entries.filter((b) => b.owner !== owner || b.at < now)
  }
  prune() {
    const now = this.clock()
    this.entries = this.entries.filter((b) => b.at > now - BOOK_GAP)
  }
  clear() {
    this.entries.length = 0
  }
}

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
/** Which mods a leader of each kind may carry. A sentinel can't split: two of them is just two sentinels. */
export const ELITE_MODS: Record<Exclude<Archetype, 'boss'>, EliteMod[]> = {
  chaser: ['swift', 'plated', 'splitting', 'warding'],
  ranged: ['swift', 'plated', 'warding'],
  charger: ['swift', 'plated', 'splitting', 'warding'],
  // a swarm already is many, and a 16-HP body at half damage is a number, not a decision
  swarm: ['swift', 'warding'],
  // the thief is never crowned
  thief: [],
}
/** The line under an elite's name. A Plated ram's plate lifts in a stun, so it says so. */
export function eliteLine(kind: Archetype, mod: EliteMod): string {
  if (kind === 'charger' && mod === 'plated') return 'takes half damage, until it hits a wall'
  if (kind === 'swarm' && mod === 'swift') return 'her whole brood moves fast'
  if (kind === 'swarm' && mod === 'warding') return 'her brood takes little damage while she stands'
  return ELITE_LINE[mod]
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
  /** Members at birth. */
  size: number
  /** Summed KILL_WEIGHT at birth. A pack pays out about the same whatever it's made of: each kill rolls its share. */
  weight: number
  /** The ram holding the pack's windup/rush: two rams of one pack never run at you on the same beat. */
  token: Enemy | null
  /** Set when any member is a mite: the pack's one mind. */
  brood?: Brood
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
  /** A gap's angle, and the narrowest it gets in units, from the action that made it. */
  gapWidth: number
  minGap: number
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
  /** `e`: who was hit, when it was an enemy (a stunned ram sounds and sparks differently). */
  onHit: (at: THREE.Vector3, e?: Enemy) => void
  /** `amount`: what was actually lost. A top-up inside a hurt window reports only the difference. */
  onPlayerHurt: (amount: number, source: HurtSource) => void
  /** `summoned`: a boss add, scrap that never drops anything. `weight`: this kill's share of the pack's payout. */
  onKill: (at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean, weight: number, e: Enemy) => void
  /** An enemy's instant (a lock, a rush ending, a trample). Lasting state is polled instead. */
  onEnemy: (ev: EnemyEvent) => void
  /** A pack woke: where, and the pack (the notebook meets its names). */
  onWake: (at: THREE.Vector3, pack: Pack) => void
  /** `loot` false: a train smashed it, and it rolls nothing (§5.7). */
  onSmash: (b: Breakable, loot?: boolean) => void
  /** A boss volley leaving the cannon. */
  onVolley: (at: THREE.Vector3) => void
  onShot: () => void
  /**
   * The eye chose: an auto shot past AUTO_RANGE or at a priority body over the nearest
   * ('shot'), or a head cast at a body its usual pick wasn't ('cast').
   */
  onEye: (what: 'shot' | 'cast') => void
  /** The hand struck `e` for HAND.damage (the auto's close form). */
  onHand: (e: Enemy) => void
  onWindup: (e: Enemy, ms: number) => void
  onStrike: (e: Enemy) => void
  onGone: (e: Enemy) => void
  onShotBlocked: (at: THREE.Vector3) => void
  /** A part did something this instant. Lasting things are polled instead (parts.ts). */
  onPart: (ev: PartEvent) => void
  /** A floor hazard's instants: made, armed, done, and each body it hit. */
  /** `heat`: a heating hazard (the lance) reached Still, taken or braced: the run heats a button. */
  onHazard: (ev: { kind: 'spawn' | 'arm' | 'end' | 'heat'; h: Hazard } | { kind: 'hit'; h: Hazard; who: Enemy | 'still'; at: THREE.Vector3 }) => void
  /** The thief's instants: its first wake (a notebook meet), a part taken, a listen, the catch (main drops `def`). */
  onThief: (ev: ThiefEvent) => void
}

/** An empty thief is no target for the auto or an aimed part; a carrying one is (bolts that pass through hit it either way). */
const targetable = (e: Enemy) => !(e instanceof Thief) || e.carrying !== null

export class Combat {
  hp = PLAYER_MAX_HP
  readonly enemies: Enemy[] = []
  /** A thief still in its barrel: a prop, not an enemy. Nothing aims at it or hits it; it joins `enemies` when it bursts out. */
  readonly nests: Thief[] = []
  readonly packs: Pack[] = []
  /** This level's crates and barrels. Anything that hits one breaks it, whoever fired. */
  breakables: Breakable[] = []
  /** The boss, while one is alive. Its def says what it is, and which adds it summons. */
  boss: Boss | null = null
  /** Floor hazards: slag, shells, lances, scald. Ticked after the parts (H8). */
  private readonly live: LiveHazard[] = []
  get hazards(): readonly Hazard[] {
    return this.live
  }
  /** Every shell in the air, where it is (the run trails embers behind them). */
  *shellsInFlight(): IterableIterator<THREE.Vector3> {
    for (const h of this.live) if (h.tell.shell?.visible) yield h.tell.shell.position
  }
  /** Whether a body carries a slag core (the run drips embers from it). */
  isSlagged(e: Enemy) {
    return this.slagged.has(e)
  }
  /** Enemies a hazard killed: they never spill slag, so hazards never chain. */
  private readonly hazardKilled = new WeakSet<Enemy>()
  /** Bodies carrying a slag core: they leave a burning puddle where they die. */
  private readonly slagged = new WeakSet<Enemy>()
  private waves: Wave[] = []
  private readonly waveGeo = new THREE.BoxGeometry(0.5, 0.35, 0.28)
  // enemy light ignores the fog, like their cores (the lights-out rule)
  private readonly waveMat = new THREE.MeshBasicMaterial({ color: 0xff8a50, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
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
  /** Halves of a Many: the elite's own guaranteed drop is the payout, so they weigh 0. */
  private readonly splitBorn = new WeakSet<Enemy>()
  /** One per pack with mites. Ticked after the packs, before the enemies. */
  readonly broods: Brood[] = []
  /** Draws every mite in the level in 8 calls. */
  readonly miteBatch: MiteBatch
  private broodIndex = 0
  /** Game time, seconds. The lock book runs on it. */
  time = 0
  /** The Line's trains on this level (design/area3/SPEC.md §5), or null. Ticked after the enemies. */
  line: Line | null = null
  /** Still's own slide (train shoves only): decays by KNOCK_DECAY, moved with terrain.clampMove at PLAYER_RADIUS. */
  private readonly playerKnock = new THREE.Vector3()
  /** One hit set per hazard group (a train): a body is hit once per group. */
  private readonly groupHits = new WeakMap<object, Set<Enemy | 'still'>>()
  /** Where each enemy stood before its own move this tick, while a lane is lit: a stepping-off body's move is the step. */
  private readonly beforeMove = new Map<Enemy, { x: number; z: number }>()
  /** Which way each body is stepping off which lane (+1/−1 across its a → b), kept until it's off. */
  private readonly stepSide = new WeakMap<Enemy, { lane: object; go: number }>()
  readonly book = new LockBook(() => this.time)
  /** Still's velocity this tick, from where he was on the last one. */
  private readonly playerVel = new THREE.Vector3()
  private readonly prevPlayer = new THREE.Vector3()
  private hasPrev = false
  /** The largest hit inside the open hurt window, and whether an Anvil catch has folded its body strikes. */
  private hurtMax = 0
  private hurtCaught = false
  /** Dev checks switch it off to test a part in isolation. */
  autoAttack = true
  /** The hand's switch (pause screen, on by default): off, the auto is always the shot. */
  closeHand = true
  /** The eye's switch (pause screen, on by default): off, standing still aims like walking. */
  eye = true
  /** Main writes it each tick: the stick is out of its dead zone. A cast never touches it. */
  walking = false
  /** How long the stick has rested, s. */
  private stillT = 0
  /** The eye's body this tick (the sightline's end), or null: not in the stance, or nothing awake to see. */
  eyeTarget: Enemy | null = null
  /**
   * Strain step 1 (design/strain/PITCHES.md), behind a switch that is off by default: a pushed
   * hit that lands in a windup breaks it, and a pushed cast aims at the windup that lands soonest.
   */
  breakRule = false
  /** Marks and slows, per enemy. Deleted when the enemy is buried. */
  private readonly status = new Map<Enemy, EnemyStatus>()
  /** Enemies in the clamp's throw. While held, an enemy doesn't think. */
  private readonly held = new Map<Enemy, Held>()
  /** Floor strips (Frost Trail): they slow what stands on them, and never shove. */
  readonly zones: Zone[] = []
  /** Where Still stood and what he lost over the last 1.5 s, recorded whether or not Borrowed Time is on. */
  readonly history = new History()
  /** HP actually lost this tick, for the history. A caught or converted hit is 0. */
  private tickDamage = 0
  /** What parts have out in the world. Each window, decoy and anchor joins this as its part is built. */
  readonly parts: PartRuntime = { guard: null, anvil: null, decoy: null, anchor: null, patientSince: PATIENT_START }
  /** What every enemy's update sees beyond its target. One object, reused every call. */
  private readonly ctx: { -readonly [K in keyof EnemyCtx]: EnemyCtx[K] } = {
    player: new THREE.Vector3(),
    playerVel: this.playerVel,
    now: 0,
    canLock: (ms) => this.book.canLock(ms),
    book: (owner, ms) => this.book.book(owner, ms),
    tokenFree: (e) => {
      const h = this.packOf.get(e)?.token
      // the token frees itself when its holder leaves windup/strike: nothing has to hand it back
      return !h || h === e || h.dead || (h.phase !== 'windup' && h.phase !== 'strike')
    },
    takeToken: (e) => {
      const p = this.packOf.get(e)
      if (p) p.token = e
    },
    held: (e) => this.held.has(e),
    emit: (ev) => this.emitEnemy(ev),
    nearLit: (x, z) => !!this.line?.nearLit(x, z, LINE.halfW + LINE.broodPad),
  }

  // Still's bolts are cold light; enemy shots are embers. Both leave trails.
  private readonly boltGeo = new THREE.BoxGeometry(0.1, 0.1, 0.8)
  private readonly boltMat = new THREE.MeshBasicMaterial({ color: 0x8fb8e8, blending: THREE.AdditiveBlending, transparent: true })
  private readonly abilityBoltMat = new THREE.MeshBasicMaterial({ color: 0xeef6ff, blending: THREE.AdditiveBlending, transparent: true })
  private readonly shotGeo = new THREE.SphereGeometry(SHOT_RADIUS, 10, 8)
  private readonly shotMat = new THREE.MeshBasicMaterial({ color: 0xff8a50, blending: THREE.AdditiveBlending, transparent: true, fog: false })

  constructor(
    private readonly scene: THREE.Scene,
    /** Swapped for each level. */
    public terrain: Terrain,
    private readonly events: CombatEvents,
  ) {
    this.miteBatch = new MiteBatch(scene)
  }

  /** Enemies that are actually after you. Sleeping and homeward packs don't count. */
  get awake(): Enemy[] {
    return this.enemies.filter((e) => this.packOf.get(e)?.state === 'awake')
  }

  update(dt: number, player: THREE.Vector3) {
    this.time += dt
    // his real velocity, walls, dashes and the magnet included; a jump (a level, a rewind) isn't one
    const vx = player.x - this.prevPlayer.x
    const vz = player.z - this.prevPlayer.z
    if (!this.hasPrev || dt < 1e-4 || vx * vx + vz * vz > 4) this.playerVel.set(0, 0, 0)
    else this.playerVel.set(vx / dt, 0, vz / dt)
    this.prevPlayer.copy(player)
    this.hasPrev = true
    this.ctx.player = player
    this.ctx.now = this.time
    this.lastPlayer = player
    this.slidePlayer(player, dt)
    this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)
    this.updatePacks(player)
    this.book.prune()
    this.countTells()
    this.tickBroods(dt)
    this.tickNests(dt, player)

    // --- enemies ---
    // a lit lane: where each stood before its own move, for the step-off
    this.beforeMove.clear()
    if (this.line?.lit().length) for (const e of this.enemies) this.beforeMove.set(e, { x: e.pos.x, z: e.pos.z })
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
      this.applyZones(e)
      const h = this.held.get(e)
      if (h) {
        // in the clamp's throw: carried for a beat, then lobbed. It doesn't think.
        h.t += dt
        const k = Math.min(1, Math.max(0, (h.t - PART.throwLead) / (h.T - PART.throwLead)))
        e.pos.lerpVectors(h.from, h.to, k)
        e.knock.set(0, 0, 0)
        e.air = Math.sin(k * Math.PI)
        e.idle(dt, h.to)
        e.group.position.y = e.air * PART.throwPeak
        if (h.t >= h.T) {
          e.air = 0
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
      // a decoy draws awake enemies near it; waking, leashing and sleeping still read Still
      const target = this.targetFor(e, player)
      const before = e.phase
      const action = e.update(dt, target, this.terrain, this.ctx)
      // a mite has no windup of its own: its brood's surge is the one tell and the one sound
      if (e.phase !== before && e.kind !== 'swarm') {
        if (e.phase === 'windup') this.events.onWindup(e, e.windupMs)
        if (e.phase === 'strike') this.events.onStrike(e)
      }
      // a strike aimed at the decoy whose ring also covers Still still lands on him; a ram's
      // lane was already tested against the real Still
      if (action?.kind === 'melee') {
        const reaches = action.tested || target === player || Math.hypot(e.pos.x - player.x, e.pos.z - player.z) <= (action.reach ?? 0)
        if (reaches) this.hurtPlayer(action.damage, 'melee', action.source ?? e)
      }
      if (action?.kind === 'shot') this.fireShot(e.pos, action.dir, action.damage, e, action.bounces ?? 0)
      if (action?.kind === 'shots') {
        for (const d of action.dirs) this.fireShot(action.from, d, action.damage, e)
        this.events.onVolley(action.from)
      }
      if (action?.kind === 'wave') this.startWave(action.center, action.gaps, action.damage, action.gapWidth, action.minGap)
      if (action?.kind === 'summon' && pack) this.summon(pack, action.points, action.maxAdds)
      if (action?.kind === 'hazard') this.addHazard(action.spec)
      if (action?.kind === 'unhazard') for (const h of this.live) if (h.spec.owner === e && h.spec.source === action.source && !h.armed) this.endHazard(h)
      if (action?.kind === 'pull') this.pull = { center: action.center, strength: action.strength, t: action.seconds }
      if (e instanceof Charger && e.sweep) this.trample(e)
      if (e instanceof Thief) for (const ev of e.drain()) this.events.onThief(ev)
      if (e.dead) this.bury(i)
    }
    // the Line after the enemies: its tells start, its books close, its hazards spawn; then who steps off
    this.line?.tick(dt, player)
    this.stepOff(dt)
    this.tickParts(dt)
    this.tickHazards(dt, player)

    // --- the eye: a rested stick plants him; each tick it picks the body the sightline shows ---
    this.stillT = this.walking ? 0 : this.stillT + dt
    this.eyeTarget = this.inStance ? this.eyePick(player, EYE.range, (e) => this.clearShot(player, e.pos) && !this.screened(player, e)) : null

    // --- auto attack: nearest enemy in range, no aiming required ---
    this.autoTimer -= dt
    if (this.autoAttack && this.autoTimer <= 0) {
      const close = this.closeHand ? this.handTarget(player) : null
      // the auto never wastes itself on a wall: the hand's line is clear, and the shot takes the nearest it can hit
      // (planted, the eye's body first; with nothing awake in its reach, today's shot)
      const usual = close ? null : this.nearest(player, AUTO_RANGE, true)
      const target = close ? null : this.eyeTarget ?? usual
      if (close) {
        // no flight, no shove, no break: the same beat as the shot, twice the weight, one body
        this.autoTimer = AUTO_INTERVAL
        close.hit(HAND.damage)
        // a narrow cold sweep to its body, the arcs' own floor mark: the form reads as reach, not a bolt
        const aim = Math.atan2(close.pos.x - player.x, close.pos.z - player.z)
        this.sweep(player, aim, Math.hypot(close.pos.x - player.x, close.pos.z - player.z), 0x8fb8e8, 0.4)
        this.events.onHand(close)
      } else if (target) {
        this.autoTimer = AUTO_INTERVAL
        const d = Math.hypot(target.pos.x - player.x, target.pos.z - player.z)
        const eye = target !== usual || d > AUTO_RANGE
        // an eye shot flies to its body and a little past, never on into a sleeping room behind it
        this.shoot(player, target.pos, target === this.eyeTarget ? Math.min(0.7, (d + 1.2) / PART.boltSpeed) : 0.7)
        this.events.onShot()
        if (eye) this.events.onEye('shot')
      }
    }

    // --- bolts ---
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!
      b.life -= dt
      let spent = b.life <= 0
      // bouncing and ghost bolts move in short substeps, so a reflection lands where
      // the bank solver said and a fast ghost can't skip over a body
      const dist = b.speed * dt
      const n = b.bouncesLeft > 0 || b.ghost ? Math.max(1, Math.ceil(dist / PART.bounceSubstep)) : 1
      if (spent) b.mesh.position.addScaledVector(b.dir, dist)
      for (let k = 0; k < n && !spent; k++) {
        b.mesh.position.addScaledVector(b.dir, dist / n)
        spent = this.boltStep(b, dist / n)
      }
      this.vfx?.trail(b.mesh.position, COLD, b.trail ?? (b.radius > 0.5 ? 0.34 : 0.18))
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
        return Math.abs(d) < Math.max(w.gapWidth / 2, w.minGap / 2 / Math.max(0.5, r))
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
      s.life -= dt
      this.vfx?.trail(s.mesh.position, EMBER, 0.3)
      s.mesh.scale.setScalar(0.85 + Math.random() * 0.3)
      let spent = s.life <= 0
      const dist = SHOT_SPEED * dt
      const n = s.bouncesLeft > 0 ? Math.max(1, Math.ceil(dist / PART.bounceSubstep)) : 1
      if (spent) s.mesh.position.addScaledVector(s.dir, dist)
      for (let k = 0; k < n && !spent; k++) {
        s.mesh.position.addScaledVector(s.dir, dist / n)
        spent = this.shotStep(s, dist / n, player)
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

    // last: where he stood this tick and what he lost, for Borrowed Time
    this.history.push(player.x, player.z, this.tickDamage, dt)
    this.tickDamage = 0
  }

  /**
   * One stretch of a Still bolt's flight. Walls stop it (see mode: a breach lets it
   * through), or reflect it if it has bounces left; props always absorb it. Returns
   * true when the bolt is spent.
   */
  private boltStep(b: Bolt, step: number): boolean {
    const p = b.mesh.position
    if (b.ghost) {
      // Through-Line ignores terrain; crates it passes are smashed on the way
      for (const c of this.breakables) {
        if (!c.broken && Math.hypot(c.x - p.x, c.z - p.z) < c.r + b.radius + 0.4) this.events.onSmash(c)
      }
    } else {
      const hit = this.terrain.blocker(p.x, p.z, 0.15, true)
      if (hit === 'wall' && b.bouncesLeft > 0) {
        const at = this.reflect(p, b.dir, step)
        b.mesh.rotation.y = Math.atan2(b.dir.x, b.dir.z)
        b.bouncesLeft--
        b.bounces.push({ at: at.pos, flip: at.flip })
        this.events.onPart({ kind: 'bounce', at: at.pos.clone(), side: 'still', n: b.bounces.length })
      } else if (hit) {
        // same rule as enemy shots: waist-high walls stop yours too
        this.smashNear(p.x, p.z, 0.4)
        this.events.onShotBlocked(p)
        this.ring(p, 0.2, 0.8, 0.18, 0x8fb8e8)
        return true
      }
    }
    for (const e of this.enemies) {
      if (b.pierced?.has(e) || b.once?.has(e)) continue
      if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) >= b.radius + e.radius) continue
      if (b.part) this.hitPart(e, b.damage, b.pushed)
      else {
        e.hit(b.damage)
        this.events.onHit(e.pos, e)
      }
      // a banked bolt into a sentinel arms its answer: it shoots back down the same path
      const last = b.bounces[b.bounces.length - 1]
      if (last && e instanceof Ranged && !e.dead) e.setAnswer({ at: last.at.clone(), flip: last.flip, bounces: b.bounces.length })
      b.once?.add(e)
      if (b.pierced) {
        b.pierced.add(e)
        // n counts up along the line, so each pass can sound a step higher
        this.events.onPart({ kind: 'pierce', at: e.pos.clone(), n: b.pierced.size })
        continue
      }
      return true
    }
    return false
  }

  /** One stretch of an enemy shot's flight: the shell, Still, then the walls (see mode). True when spent. */
  private shotStep(s: Shot, step: number, player: THREE.Vector3): boolean {
    const p = s.mesh.position
    // a shell meets shots before they reach him: Ward destroys them, Mirror Ward sends them home
    const g = this.parts.guard
    if (g && g.kind !== 'brace' && Math.hypot(p.x - player.x, p.z - player.z) < g.radius) {
      if (g.kind === 'ward') {
        g.used = true
        this.events.onPart({ kind: 'shield', at: p.clone(), reflected: false })
        return true
      }
      if (g.reflectsLeft > 0) {
        g.reflectsLeft--
        g.used = true
        const o = s.owner && !s.owner.dead ? s.owner.pos : null
        const aim = o ? Math.atan2(o.x - p.x, o.z - p.z) : Math.atan2(-s.dir.x, -s.dir.z)
        // his shot now: a cold bolt, and walls stop it like any other
        this.spawnBolt(p, aim, g.reflectDamage, 0.3, 20)
        this.events.onPart({ kind: 'shield', at: p.clone(), reflected: true })
        return true
      }
    }
    if (Math.hypot(p.x - player.x, p.z - player.z) < SHOT_RADIUS + PLAYER_RADIUS) {
      this.hurtPlayer(s.damage, 'shot')
      return true
    }
    const hit = this.terrain.blocker(p.x, p.z, 0.15, true)
    if (hit === 'wall' && s.bouncesLeft > 0) {
      // the answer: the same reflection code, so it retraces the bolt to where Still fired from
      const at = this.reflect(p, s.dir, step)
      s.bouncesLeft--
      s.bounced++
      this.events.onPart({ kind: 'bounce', at: at.pos.clone(), side: 'enemy', n: s.bounced })
    } else if (hit) {
      this.smashNear(p.x, p.z, 0.4)
      this.events.onShotBlocked(p)
      this.ring(p, 0.2, 0.9, 0.2, 0xff7a55)
      return true
    }
    return false
  }

  /**
   * Reflect a projectile at `p` off the wall it has just entered. Back up to the
   * last clear point (found to within a hair), see which axis is blocked, flip
   * the direction on it. `p` and `dir` are changed in place.
   */
  private reflect(p: THREE.Vector3, dir: THREE.Vector3, step: number): { pos: THREE.Vector3; flip: Flip } {
    const bx = p.x - dir.x * step
    const bz = p.z - dir.z * step
    let lo = 0
    let hi = step
    for (let k = 0; k < 6; k++) {
      const m = (lo + hi) / 2
      if (this.terrain.blocked(bx + dir.x * m, bz + dir.z * m, 0.15, true)) hi = m
      else lo = m
    }
    const px = bx + dir.x * lo
    const pz = bz + dir.z * lo
    const hx = this.terrain.blocked(px + dir.x * step, pz, 0.15, true)
    const hz = this.terrain.blocked(px, pz + dir.z * step, 0.15, true)
    const flip: Flip = hx && !hz ? 'x' : hz && !hx ? 'z' : 'xz'
    if (flip !== 'z') dir.x = -dir.x
    if (flip !== 'x') dir.z = -dir.z
    p.set(px, p.y, pz)
    return { pos: new THREE.Vector3(px, 0, pz), flip }
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
    for (const t of this.nests) t.dispose(this.scene)
    this.nests.length = 0
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
    this.stillT = 0
    this.eyeTarget = null
    for (const h of this.live) {
      this.scene.remove(h.tell.group)
      h.tell.dispose()
    }
    this.live.length = 0
    for (const s of this.shots) this.scene.remove(s.mesh)
    this.shots.length = 0
    this.later.length = 0
    for (const b of this.broods) {
      this.emitEnemy({ kind: 'broodGone', brood: b })
      b.dispose()
    }
    this.broods.length = 0
    this.broodIndex = 0
    TELL_CROWD.locked = 0
    this.miteBatch.clear()
    this.book.clear()
    this.hasPrev = false
    this.hurtMax = 0
    this.hurtCaught = false
    for (const f of this.fx) this.scene.remove(f.mesh)
    this.fx.length = 0
    this.line?.dispose()
    this.line = null
    this.playerKnock.set(0, 0, 0)
    this.beforeMove.clear()
    this.parts.patientSince = PATIENT_START
    this.parts.guard = null
    this.parts.anvil = null
    // a new level: the decoy vanishes without bursting, and a live anchor fades (its cooldown starts)
    this.clearSlot('torso')
    this.clearSlot('legs')
    this.status.clear()
    this.held.clear()
    this.zones.length = 0
    // a rewind must never cross levels
    this.history.clear()
    this.tickDamage = 0
  }

  // --- statuses: marks and slows, the same hooks for every archetype ---

  /** Read-only, for what's drawn on bodies (badges, rime motes). */
  statusOf(e: Enemy): Readonly<EnemyStatus> | undefined {
    return this.status.get(e)
  }

  /** Where every enemy shot is right now (a breach rim flares as one passes through). */
  *shotPositions(): IterableIterator<THREE.Vector3> {
    for (const s of this.shots) yield s.mesh.position
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
  private hitPart(e: Enemy, damage: number, pushed = false): boolean {
    const st = this.status.get(e)
    let d = damage
    if (st && st.markT > 0) {
      d *= 2
      st.markT = 0
      this.events.onPart({ kind: 'mark', enemy: e, state: 'consumed' })
    }
    const killed = e.hit(d)
    this.events.onHit(e.pos, e)
    if (pushed) this.pushBreak(e)
    return killed
  }

  /** The break rule: a pushed hit that lands in a windup a push can break breaks it, and it reels open. */
  private pushBreak(e: Enemy) {
    if (this.breakRule && this.breakable(e) && e.interrupt(true)) this.interrupted(e, true)
  }

  /**
   * A windup a push could break right now: never a boss's (they only take the hit), and a
   * ram's only while it tracks. After the lock the hit can't land in time to count.
   */
  breakable(e: Enemy): boolean {
    if (e.dead || e.phase !== 'windup' || isBoss(e) || e.kind === 'thief') return false
    return !(e instanceof Charger && e.locked)
  }

  /**
   * Whether this part, pushed from `o` now, would land a hit on `e`: its reach and its line,
   * by the same tests the cast uses. The pushed aim and the break hint read it.
   */
  reaches(def: AbilityDef, o: THREE.Vector3, e: Enemy): boolean {
    const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
    const mod = def.mod
    switch (def.shape) {
      case 'bolt':
        if (d > def.range) return false
        if (mod?.kind === 'pierceAll' || this.clearShot(o, e.pos)) return true
        return mod?.kind === 'bounce' && bankShot(this.terrain, o, e.pos, mod.bankSearch, def.range) !== null
      case 'lob':
        return d <= def.range
      case 'nova':
        return def.damage > 0 && this.inBlast(o, e, def.radius) && !this.shaded(o, e)
      case 'arc':
      case 'grab':
        return this.inReach(o, e, def.range) && !this.shaded(o, e)
      case 'dash': {
        // it follows the stick, so only the distance can be known: the run-over, or the slam where it stops
        const over = mod?.kind === 'overrun' ? mod : null
        const hits = (over?.damage ?? def.damage) > 0 || mod?.kind === 'slam'
        return hits && d <= (over?.range ?? def.range) + (over?.radius ?? def.radius) + e.radius
      }
      case 'decoy': {
        // a pushed Lure bursts the decoy that's out
        const dc = this.parts.decoy
        return !!dc && this.inBlast(dc.pos, e, dc.def.radius) && !this.shaded(dc.pos, e)
      }
      default:
        return false
    }
  }

  /**
   * A pushed cast aims at the threat: of the windups a push could break that this part
   * reaches, the one that lands soonest (the tell drawn on top). Null: the usual target.
   */
  private threat(o: THREE.Vector3, def: AbilityDef): Enemy | null {
    if (!this.breakRule) return null
    let best: Enemy | null = null
    let soon = Infinity
    for (const e of this.enemies) {
      if (!targetable(e) || this.held.has(e) || !this.breakable(e)) continue
      const t = e.landsIn()
      if (t === null || t >= soon || !this.reaches(def, o, e)) continue
      best = e
      soon = t
    }
    return best
  }

  /** A thrown enemy comes down: the landing hurts it, a wall hurts it more, and the splash shoves what's near. */
  private landThrow(e: Enemy, h: Held) {
    const mod = h.def.mod?.kind === 'toss' ? h.def.mod : null
    e.group.position.y = 0
    this.hitPart(e, h.def.damage, h.pushed)
    // not doubled: the mark was used by the first hit
    if (h.short && mod && !e.dead) {
      e.hit(mod.wallDamage)
      this.events.onHit(e.pos, e)
    }
    const blast = h.def.blast ?? 0
    const to = h.to
    this.events.onPart({ kind: 'land', at: to.clone(), radius: blast, what: h.short ? 'wall' : 'throw', enemy: e })
    for (const o of this.enemies) {
      if (o === e || o.dead) continue
      if (Math.hypot(o.pos.x - to.x, o.pos.z - to.z) > blast + o.radius || !this.terrain.lineClear(to.x, to.z, o.pos.x, o.pos.z, PART.linePad)) continue
      this.hitPart(o, h.def.blastDamage ?? 0, h.pushed)
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
    if (p.decoy && (p.decoy.t -= dt) <= 0) this.burstDecoy()
    if (p.anchor && (p.anchor.t -= dt) <= 0) this.fadeAnchor()
    for (let i = this.zones.length - 1; i >= 0; i--) if ((this.zones[i]!.t -= dt) <= 0) this.zones.splice(i, 1)
    // the cover comes back
    const closed = this.terrain.tickBreaches(dt)
    if (closed.length) this.events.onPart({ kind: 'breach', holes: closed, open: false })
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
    if (slot === 'torso' && p.decoy) return Math.max(0, p.decoy.t / p.decoy.max)
    if (slot === 'arms' && p.anvil) return Math.max(0, p.anvil.t / p.anvil.max)
    if (slot === 'legs' && p.anchor) return Math.max(0, p.anchor.t / p.anchor.max)
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
    if (slot === 'torso') {
      this.endGuard()
      // a swap can't buy a free burst: the decoy just goes
      const d = this.parts.decoy
      if (d) {
        this.parts.decoy = null
        this.events.onPart({ kind: 'decoy', state: 'gone', at: d.pos.clone() })
      }
    }
    if (slot === 'arms') this.endAnvil()
    // swapping out a live anchor counts as it fading: the cooldown starts
    if (slot === 'legs') this.fadeAnchor()
  }

  /** Lure: whoever is drawn to the decoy aims at it. The Assembler is never fooled; its adds are. The thief hunts no one. */
  targetFor(e: Enemy, player: THREE.Vector3): THREE.Vector3 {
    const d = this.parts.decoy
    if (!d || e.kind === 'boss' || e.kind === 'thief') return player
    return Math.hypot(e.pos.x - d.pos.x, e.pos.z - d.pos.z) <= d.def.range ? d.pos : player
  }

  /** The decoy's time is up (or a push recast it): it bursts, shoving and hurting what it drew. */
  private burstDecoy(pushed = false) {
    const d = this.parts.decoy
    if (!d) return
    this.parts.decoy = null
    for (const e of this.enemies) {
      if (!this.inBlast(d.pos, e, d.def.radius) || this.shaded(d.pos, e)) continue
      this.hitPart(e, d.def.damage, pushed || d.pushed)
      this.shoveFrom(e, d.pos.x, d.pos.z, d.def.shove ?? 0)
    }
    for (const b of this.breakables) {
      if (!b.broken && Math.hypot(b.x - d.pos.x, b.z - d.pos.z) <= d.def.radius + b.r) this.events.onSmash(b)
    }
    this.ring(d.pos, 0.3, d.def.radius, 0.4, 0x8fb8e8)
    this.events.onPart({ kind: 'decoy', state: 'burst', at: d.pos.clone() })
  }

  /** The anchor ran out (or was swapped out, or the level ended): it goes, and the cooldown starts now. */
  private fadeAnchor() {
    const a = this.parts.anchor
    if (!a) return
    this.parts.anchor = null
    this.events.onPart({ kind: 'anchor', state: 'fade', at: a.pos.clone() })
    this.events.onPart({ kind: 'cooldownStart', slot: 'legs' })
  }

  /**
   * Frost strips slow whatever stands on them, lingering a moment after it steps
   * off. A ram rushing onto one goes down: a stop, not a stun. It runs before the
   * enemy thinks, so the rush ends on the tick its centre reaches the strip.
   */
  private applyZones(e: Enemy) {
    const z = this.zoneAt(e.pos.x, e.pos.z, e.radius * 0.5)
    if (!z) return
    if (e instanceof Charger && e.rushing && this.tripAt(e) && e.trip()) {
      this.emitEnemy({ kind: 'rushEnd', e, how: 'trip', at: e.pos.clone() })
    }
    this.applySlow(e, PART.zoneLinger, z.mul)
  }

  /** The floor strip under a point (grown by `r`), if any. */
  zoneAt(x: number, z: number, r = 0): Readonly<Zone> | null {
    for (const zn of this.zones) {
      if (distToSegment(x, z, zn.ax, zn.az, zn.bx, zn.bz) <= zn.halfW + r) return zn
    }
    return null
  }

  /** The trip test: true while an enemy is on a Frost strip. A rushing ram there falls (applyZones). */
  tripAt(e: Enemy): boolean {
    return this.zoneAt(e.pos.x, e.pos.z, e.radius * 0.5) !== null
  }

  /** Anvil: the blow that would have hit him lands on the clamp, and he hammers back. */
  private catchBlow(from?: Enemy) {
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
    // a rush caught on the clamp: the counter has landed, now it's stuck there
    if (from instanceof Charger && from.stopRush()) this.emitEnemy({ kind: 'rushEnd', e: from, how: 'caught', at: from.pos.clone() })
  }

  /**
   * Every way Still loses HP comes through here, so windows (Anvil, Brace) have one
   * place to step in. Inside a hurt window only a bigger blow gets through, and only
   * the difference: a bite can't shield him from a rush, and a window still takes
   * one hit's worth. The window never extends.
   */
  private hurtPlayer(damage: number, source: HurtSource, from?: Enemy) {
    const open = this.hurtCooldown > 0
    // after a catch, the rest of the window's body strikes fold into it
    if (open && source === 'melee' && this.hurtCaught) return
    const amount = open ? damage - this.hurtMax : damage
    if (amount <= 0) return
    if (!open) {
      this.hurtCooldown = HURT_WINDOW
      this.hurtMax = 0
      this.hurtCaught = false
    }
    this.hurtMax = Math.max(this.hurtMax, damage)
    // Anvil first: it catches body strikes only, even inside an open window
    if (source === 'melee' && this.parts.anvil) {
      this.catchBlow(from)
      this.hurtCaught = true
      return
    }
    // Brace: the hit becomes strain instead of integrity. Main adds it, so it can end the run.
    const g = this.parts.guard
    if (g?.kind === 'brace') {
      g.used = true
      this.events.onPart({ kind: 'strain', amount: Math.ceil(amount / g.perStrain), at: this.lastPlayer.clone() })
      return
    }
    const before = this.hp
    this.hp = Math.max(0, this.hp - amount)
    this.tickDamage += before - this.hp
    this.events.onPlayerHurt(amount, source)
  }

  /** The dead branch of the enemy loop: out of the scene, out of its pack, paid out. */
  private bury(i: number) {
    const e = this.enemies[i]!
    const pack = this.packOf.get(e)
    // dying in the air means no landing
    this.status.delete(e)
    this.held.delete(e)
    e.air = 0
    e.dispose(this.scene)
    this.enemies.splice(i, 1)
    this.book.unbook(e)
    // H7: its unarmed lance goes with it; shells in flight, slag and scald still resolve
    for (const h of this.live) if (h.spec.owner === e && h.spec.cancelOnDeath && !h.armed && !h.done) this.endHazard(h)
    // H6: a slag core spills, unless a hazard killed it (no chains)
    if (this.slagged.has(e) && !this.hazardKilled.has(e)) this.spillSlag(e.pos)
    // the thief has no pack, so no kill and no roll: its catch (and the part it had) is its own event
    if (e instanceof Thief) for (const ev of e.drain()) this.events.onThief(ev)
    if (pack) {
      pack.members.splice(pack.members.indexOf(e), 1)
      this.packOf.delete(e)
      if (pack.token === e) pack.token = null
      const wasElite = pack.elite?.leader === e
      if (wasElite && pack.elite!.mod === 'splitting') this.split(pack, e)
      if (wasElite && pack.elite!.mod === 'warding') this.breakSeals(pack, e)
      if (wasElite) {
        this.scene.remove(pack.elite!.aura)
        pack.elite!.aura.geometry.dispose()
        ;(pack.elite!.aura.material as THREE.Material).dispose()
      }
      const summoned = this.summoned.has(e)
      const weight = summoned || this.splitBorn.has(e) ? 0 : KILL_WEIGHT[e.kind]
      this.events.onKill(e.pos, e.kind, pack, wasElite, summoned, weight, e)
      // after its pop: the brood's end is the last thing heard
      if (e instanceof Mite) this.buryMite(e, pack)
      if (pack.members.length === 0) this.packs.splice(this.packs.indexOf(pack), 1)
    }
    this.events.onGone(e)
  }

  /** An enemy shot. Public for dev checks; `owner` is who a Mirror Ward sends it back to. */
  fireShot(from: THREE.Vector3, dir: THREE.Vector3, damage: number, owner?: Enemy, bounces = 0) {
    const mesh = new THREE.Mesh(this.shotGeo, this.shotMat)
    // leaves from the barrel, not the feet
    mesh.position.set(from.x + dir.x * 0.7, 1.45, from.z + dir.z * 0.7)
    this.scene.add(mesh)
    this.shots.push({ mesh, dir: dir.clone(), life: 20 / SHOT_SPEED, damage, owner, bouncesLeft: bounces, bounced: 0 })
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

  private smashNear(x: number, z: number, pad: number, opts: { loot?: boolean } = {}) {
    for (const b of this.breakables) {
      if (!b.broken && Math.hypot(b.x - x, b.z - z) < b.r + pad) {
        this.events.onSmash(b, opts.loot ?? true)
        return
      }
    }
  }

  /** §5.4, §5.7: a train segment arming breaks every crate whose circle overlaps its strip (grown), and each rolls nothing. */
  smashIn(shape: HazardShape, grow: number) {
    for (const b of this.breakables) if (!b.broken && inShape(shape, b.x, b.z, b.r + grow)) this.events.onSmash(b, false)
  }

  /** The Line's liveness (§5.1): a pack whose members sleep (or slept) inside this room is awake. */
  roomAwake(room: Room): boolean {
    const hx = (room.rx + 0.5) * 4, hz = (room.rz + 0.5) * 4
    return this.packs.some((p) => p.state === 'awake' && [...p.homes.values()].some((h) => Math.abs(h.x - room.center.x) <= hx && Math.abs(h.z - room.center.z) <= hz))
  }

  /** The train hit sets, for the checks: who a group (a train) has hit. */
  groupHitsOf(group: object): ReadonlySet<Enemy | 'still'> {
    return this.groupHits.get(group) ?? new Set()
  }

  /**
   * §5.8: committed bodies don't step off a lit lane. Anything past its approach, sliding,
   * held in the clamp, a ram rushing or stunned, a mite biting in a live surge, a boss, a thief.
   */
  static committed(e: Enemy, held: boolean): boolean {
    if (e.kind === 'boss' || e.kind === 'thief') return true
    if (e.phase !== 'approach' || held) return true
    if (e.knock.lengthSq() > 1.5 * 1.5) return true
    if (e instanceof Charger && (e.rushing || e.stunned)) return true
    if (e instanceof Mite && e.brood.state !== 'gather' && e.brood.biters.includes(e)) return true
    return false
  }

  /**
   * §5.8: every awake or homeward body that isn't committed and stands in a lit lane's floor
   * strip (grown by its radius and a pad) moves straight off it, toward the nearer edge (away
   * from Still on a tie), at 4.5 u/s × its speed. That step is its whole move this tick, so a
   * body walking at the lane stalls at its edge until the tail has passed.
   */
  private stepOff(dt: number) {
    const lit = this.line?.lit()
    if (!lit?.length) return
    for (const e of this.enemies) {
      if (e.dead) continue
      const st = this.packOf.get(e)?.state
      if (st !== 'awake' && st !== 'returning') continue
      if (Combat.committed(e, this.held.has(e))) continue
      for (const l of lit) {
        const grow = LINE.halfW + e.radius + LINE.stepOff.pad
        const len = Math.hypot(l.bx - l.ax, l.bz - l.az)
        const ux = (l.bx - l.ax) / len, uz = (l.bz - l.az) / len
        // across: the lane's right-hand normal, signed
        const across = (e.pos.x - l.ax) * uz - (e.pos.z - l.az) * ux
        const along = (e.pos.x - l.ax) * ux + (e.pos.z - l.az) * uz
        if (along < -e.radius || along > len + e.radius || Math.abs(across) > grow) {
          if (this.stepSide.get(e)?.lane === l) this.stepSide.delete(e)
          continue
        }
        // its own move this tick is undone: the step is the move
        const was = this.beforeMove.get(e)
        if (was) {
          e.pos.x = was.x
          e.pos.z = was.z
        }
        const a = (e.pos.x - l.ax) * uz - (e.pos.z - l.az) * ux
        let side = Math.sign(a)
        if (side === 0) {
          const p = this.lastPlayer
          side = -Math.sign((p.x - l.ax) * uz - (p.z - l.az) * ux) || 1
        }
        // the nearer edge, unless a crate or a column stops it short of it there (a lane's mouth at
        // its wall gap); then whichever way leaves the least of the strip to cross, kept until the
        // nearer edge is clear again (so it can't dither between two blocked ways)
        const leftOf = (sd: number) => {
          const need = grow - a * sd + 1e-3
          const p = this.terrain.clampMove(e.pos.x, e.pos.z, e.pos.x + uz * sd * need, e.pos.z - ux * sd * need, e.radius)
          return need - Math.hypot(p.x - e.pos.x, p.z - e.pos.z)
        }
        let go = side
        const nearLeft = leftOf(side)
        if (nearLeft <= 0.25) this.stepSide.delete(e)
        else {
          let chosen = this.stepSide.get(e)
          if (!chosen || chosen.lane !== l) {
            chosen = { lane: l, go: nearLeft <= leftOf(-side) ? side : -side }
            this.stepSide.set(e, chosen)
          }
          go = chosen.go
        }
        const want = Math.min(LINE.stepOff.speed * e.speedMul * dt, grow - a * go + 1e-3)
        if (want <= 0) break
        // boxed in (the columns either side of a wall gap): off at a slant into the room, or along
        // into the room; the first that gets at least half its step
        const toMid = Math.sign(len / 2 - (e.pos.x - l.ax) * ux - (e.pos.z - l.az) * uz) || 1
        const tries: [number, number][] = [[uz * go, -ux * go], [(uz * go + ux * toMid) * Math.SQRT1_2, (-ux * go + uz * toMid) * Math.SQRT1_2], [ux * toMid, uz * toMid]]
        let to: { x: number; z: number } | null = null
        for (const [vx, vz] of tries) {
          const p = this.terrain.clampMove(e.pos.x, e.pos.z, e.pos.x + vx * want, e.pos.z + vz * want, e.radius)
          if (Math.hypot(p.x - e.pos.x, p.z - e.pos.z) >= want * 0.5) {
            to = p
            break
          }
        }
        if (!to) {
          // stuck every way: the other side next tick
          this.stepSide.set(e, { lane: l, go: -go })
          break
        }
        e.pos.x = to.x
        e.pos.z = to.z
        break
      }
    }
  }

  /** Still's train shove: a slide that bleeds off, stopped by walls. */
  private slidePlayer(player: THREE.Vector3, dt: number) {
    const k = this.playerKnock
    if (k.lengthSq() < 1e-6) return
    const to = this.terrain.clampMove(player.x, player.z, player.x + k.x * dt, player.z + k.z * dt, PLAYER_RADIUS)
    player.x = to.x
    player.z = to.z
    k.multiplyScalar(Math.exp(-KNOCK_DECAY * dt))
    if (k.lengthSq() < 1e-4) k.set(0, 0, 0)
  }

  /**
   * A shove off a strip: `along` its direction, `across` away from its centre line toward the
   * side the body is on (on a tie, the side away from its lamps: the left of a → b).
   */
  private stripShove(sh: HazardShape, shove: NonNullable<HazardSpec['shove']>, x: number, z: number): THREE.Vector3 {
    const v = shoveVelocity(shove.dx, shove.dz, shove.along)
    if (sh.kind !== 'strip' || shove.across <= 0) return v
    const len = Math.hypot(sh.bx - sh.ax, sh.bz - sh.az) || 1
    const ux = (sh.bx - sh.ax) / len, uz = (sh.bz - sh.az) / len
    // the right-hand normal of the strip's own a → b; a lane's lamps stand on the right of its a → b
    const side = Math.sign((x - sh.ax) * uz - (z - sh.az) * ux) || (ux + uz > 0 ? -1 : 1)
    return v.add(shoveVelocity(uz * side, -ux * side, shove.across))
  }

  /** A projectile's line: see mode, so a breach lets a shot through both ways. */
  private clearShot(from: THREE.Vector3, to: THREE.Vector3): boolean {
    return this.terrain.lineClear(from.x, from.z, to.x, to.z, 0.15, true)
  }

  private nearest(from: THREE.Vector3, range = AUTO_RANGE, needsClearShot = false): Enemy | null {
    let best: Enemy | null = null
    let bestDist = range
    for (const e of this.enemies) {
      if (!targetable(e)) continue
      const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z)
      if (d < bestDist && (!needsClearShot || this.clearShot(from, e.pos))) {
        bestDist = d
        best = e
      }
    }
    return best
  }

  private shoot(from: THREE.Vector3, to: THREE.Vector3, life = 0.7) {
    const mesh = new THREE.Mesh(this.boltGeo, this.boltMat)
    mesh.position.set(from.x, 1.15, from.z)
    const dir = new THREE.Vector3(to.x - from.x, 0, to.z - from.z).normalize()
    mesh.rotation.y = Math.atan2(dir.x, dir.z)
    this.scene.add(mesh)
    this.bolts.push({ mesh, part: false, dir, life, damage: AUTO_DAMAGE, radius: 0.3, speed: PART.boltSpeed, bouncesLeft: 0, bounces: [] })
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
        if (mod?.kind === 'bounce') {
          this.ricochet(def, mod.bankSearch, ctx, r)
          break
        }
        if (mod?.kind === 'pierceAll') {
          this.throughLine(def, mod.breachMs, ctx, r)
          break
        }
        // no line needed to pick a target: walls stop the bolt, not the aim (a push aims at the threat)
        const target = (ctx.pushed && this.threat(o, def)) || this.eyeCast(o, def, this.nearest(o, def.range))
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
          this.spawnBolt(o, aim + off, damage, def.radius, def.range, { pierced: mod?.kind === 'pierce' ? new Set() : undefined, once, scale, trail, pushed: ctx.pushed })
        }
        break
      }

      case 'lob': {
        // arcs over walls onto where the target stands now: it can't miss a sleeper, it can miss a mover
        const target = (ctx.pushed && this.threat(o, def)) || this.eyeCast(o, def, this.pickTarget(o, def.range, true))
        const to = target ? new THREE.Vector3(target.pos.x, 0, target.pos.z) : this.ahead(o, ctx.facing, Math.min(def.range, PART.lobNoTarget))
        const pushed = ctx.pushed
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
                this.events.onHit(e.pos, e)
                this.mark(e, mark.ms / 1000)
                if (pushed) this.pushBreak(e)
              } else {
                this.hitPart(e, def.damage, pushed)
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
          this.hitPart(e, def.damage, ctx.pushed)
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
        if (ctx.pushed) e = this.threat(o, def) ?? e
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
        // lifted out of its swing; pushed, under the break rule, it reels once it lands
        const reel = ctx.pushed && this.breakRule && this.breakable(e)
        if (e.phase === 'windup' && e.interrupt(reel)) this.interrupted(e, reel)
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
        this.held.set(e, { from: e.pos.clone(), to, t: 0, T, short, def, pushed: ctx.pushed })
        this.events.onPart({ kind: 'throw', enemy: e, to: to.clone(), ms: T * 1000, short })
        break
      }

      case 'decoy': {
        // Lure: a pushed recast bursts the old one first; there's only ever one
        if (this.parts.decoy) this.burstDecoy(ctx.pushed)
        const dir = this.steer(ctx)
        const back = def.offset ?? 1.5
        // behind him, opposite the stick (or his facing), and never inside a wall
        const p = this.terrain.clampMove(o.x, o.z, o.x - dir.x * back, o.z - dir.z * back, PLAYER_RADIUS)
        const s = (def.windowMs ?? 3000) / 1000
        this.parts.decoy = { pos: new THREE.Vector3(p.x, 0, p.z), t: s, max: s, def, pushed: ctx.pushed }
        this.events.onPart({ kind: 'decoy', state: 'spawn', at: new THREE.Vector3(p.x, 0, p.z) })
        break
      }

      case 'anchor': {
        const a = this.parts.anchor
        if (!a || ctx.pushed) {
          // plant: the button stays tappable for the snap ('hold'), the anchor lasts a few seconds
          const s = (def.windowMs ?? 5000) / 1000
          this.parts.anchor = { pos: o.clone(), t: s, max: s, def }
          r.cooldown = 'hold'
          r.beat = 'plant'
          this.events.onPart({ kind: 'anchor', state: 'plant', at: o.clone() })
          break
        }
        // snap: refused past its range (no snap, no cooldown, no strain, the anchor stays)
        if (Math.hypot(a.pos.x - o.x, a.pos.z - o.z) > def.range) {
          r.cooldown = 'refused'
          this.events.onPart({ kind: 'anchor', state: 'denied', at: a.pos.clone() })
          break
        }
        // back along the straight line, stopping at a wall, running over what's in the way
        const end = this.terrain.clampMove(o.x, o.z, a.pos.x, a.pos.z, PLAYER_RADIUS)
        const ms = def.travelMs ?? 240
        this.runOver(o, end, def.radius, def.damage, def.shove ?? 0, ms, null, ctx.pushed)
        this.parts.anchor = null
        this.emitMove({ kind: 'snap', path: [new THREE.Vector3(end.x, 0, end.z)], ms, vault: false, lockMs: 0 }, 'snap')
        this.events.onPart({ kind: 'anchor', state: 'snap', at: a.pos.clone() })
        r.beat = 'snap'
        break
      }

      case 'rewind': {
        // Borrowed Time: back along where he stood, with the HP he lost there. Strain is its own (def.strain).
        const w = this.history.window((def.windowMs ?? 1500) / 1000)
        this.hp = Math.min(PLAYER_MAX_HP, this.hp + w.damage)
        // given back once: the same damage can never come back twice
        this.history.zero(w.slots)
        // the recorded path, oldest last; thinned so the move reads as travel, not jitter
        const path = w.points.filter((_, i) => i % 4 === 3 || i === w.points.length - 1)
        // a fresh level has nothing to go back to: no move, but it still costs its strain, honestly
        if (path.length > 0) this.emitMove({ kind: 'rewind', path, ms: def.travelMs ?? 250, vault: false, lockMs: 0 }, r.beat)
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
          if (d < snapD && targetable(e) && this.inReach(o, e, def.range) && !this.shaded(o, e)) {
            snap = e
            snapD = d
          }
        }
        // pushed: the windup that lands soonest, if the blade reaches it
        if (ctx.pushed) snap = this.threat(o, def) ?? snap
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
          this.hitPart(e, def.damage, ctx.pushed && !parry)
          if (parry) {
            // Parry Clamp: caught mid-windup, the attack breaks and it stumbles back (pushed, it reels)
            const reel = ctx.pushed && this.breakRule && this.breakable(e)
            if (!e.dead && winding && e.interrupt(reel)) {
              this.shoveFrom(e, o.x, o.z, parry.shove)
              this.interrupted(e, reel)
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
        const ex = end.x
        const ez = end.z
        // the charge throws them aside, off the path, instead of ahead of it
        this.runOver(o, end, width, damage, knock, ms, over ? dir : null, ctx.pushed)
        this.ring(o, 0.3, 1.6, 0.3, 0xbcd6ff)
        this.emitMove({ kind: 'dash', path: [new THREE.Vector3(ex, 0, ez)], ms, vault: false, lockMs: 0 }, r.beat)
        if (mod?.kind === 'strip') {
          // Frost Trail: a cold track along the path, live from the cast. It slows; it never shoves.
          const s = mod.ms / 1000
          this.zones.push({ ax: o.x, az: o.z, bx: ex, bz: ez, halfW: mod.width / 2, t: s, max: s, mul: mod.mul })
        }

        if (mod?.kind === 'slam') {
          // Skid Plates: the landing blast. Shoves, so it clears space where you stop.
          const at = new THREE.Vector3(ex, 0, ez)
          const pushed = ctx.pushed
          this.later.push({
            t: ms / 1000,
            run: () => {
              for (const e of this.enemies) {
                if (!this.inBlast(at, e, mod.radius) || this.shaded(at, e)) continue
                this.hitPart(e, mod.damage, pushed)
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

  /**
   * Ricochet Lens: with a clear line it's just a weaker Lens. Without one it takes
   * a one-wall bank found near Still, and the bolt reflects there by itself.
   * It targets awake enemies first, so a bank never wakes a second pack by accident.
   */
  private ricochet(def: AbilityDef, search: number, ctx: CastContext, r: CastResult) {
    const o = ctx.origin
    const t = (ctx.pushed && this.threat(o, def)) || this.eyeCast(o, def, this.pickTarget(o, def.range, true))
    const bank = t && !this.clearShot(o, t.pos) ? bankShot(this.terrain, o, t.pos, search, def.range) : null
    const aim = bank ? Math.atan2(bank.at.x - o.x, bank.at.z - o.z) : t ? Math.atan2(t.pos.x - o.x, t.pos.z - o.z) : ctx.facing
    // the head cants toward the bank side, so it reads "at an angle"
    r.lean = bank ? Math.sign(Math.sin(aim - ctx.facing)) || 1 : 0
    this.spawnBolt(o, aim, def.damage, def.radius, def.range, { bounces: 2, trail: 0.2, pushed: ctx.pushed })
    // you didn't pick the angle, so the whole path flashes first
    const points = bank && t
      ? [o.clone(), bank.at.clone(), t.pos.clone()]
      : [o.clone(), t ? t.pos.clone() : this.ahead(o, ctx.facing, def.range)]
    this.events.onPart({ kind: 'path', points })
  }

  /**
   * Through-Line: a ghost bolt through enemies, crates and walls, and every solid it
   * crosses opens to sight and shots for a few seconds, both ways. Awake first.
   */
  private throughLine(def: AbilityDef, breachMs: number, ctx: CastContext, r: CastResult) {
    const o = ctx.origin
    const t = (ctx.pushed && this.threat(o, def)) || this.eyeCast(o, def, this.pickTarget(o, def.range, true))
    const aim = t ? Math.atan2(t.pos.x - o.x, t.pos.z - o.z) : ctx.facing
    // he faces down the line: the draw, the beam and the recoil all run along it
    r.aim = aim
    const dir = this.spawnBolt(o, aim, def.damage, def.radius, def.range, { speed: PART.ghostSpeed, ghost: true, pierced: new Set(), pushed: ctx.pushed })
    const holes = this.terrain.breach(o.x, o.z, o.x + dir.x * def.range, o.z + dir.z * def.range, breachMs / 1000)
    this.events.onPart({ kind: 'breach', holes, open: true, seconds: breachMs / 1000 })
  }

  /**
   * The ready tick for a bank shot: where a Ricochet Lens would bounce right now,
   * or null when the nearest target has a clear line (or there's no bank).
   */
  bankPreview(def: AbilityDef, o: THREE.Vector3): THREE.Vector3 | null {
    if (def.mod?.kind !== 'bounce') return null
    const t = this.eyeHead(o, def) ?? this.pickTarget(o, def.range, true)
    if (!t || this.clearShot(o, t.pos)) return null
    return bankShot(this.terrain, o, t.pos, def.mod.bankSearch, def.range)?.at ?? null
  }

  /** One of Still's bolts, leaving from lens height. `scale` shrinks the mesh only, never the hit. */
  private spawnBolt(
    o: THREE.Vector3, aim: number, damage: number, radius: number, range: number,
    opts: { pierced?: Set<Enemy>; once?: Set<Enemy>; scale?: number; trail?: number; speed?: number; ghost?: boolean; bounces?: number; pushed?: boolean } = {},
  ) {
    const dir = new THREE.Vector3(Math.sin(aim), 0, Math.cos(aim))
    const mesh = new THREE.Mesh(this.boltGeo, this.abilityBoltMat)
    const k = opts.scale ?? 1
    mesh.scale.set(2.2 * k, 2.2 * k, 2.6 * k)
    mesh.position.set(o.x, 1.15, o.z)
    mesh.rotation.y = aim
    this.scene.add(mesh)
    const speed = opts.speed ?? PART.boltSpeed
    this.bolts.push({
      mesh, part: true, dir, life: range / speed, damage, radius, speed, pierced: opts.pierced, once: opts.once, trail: opts.trail,
      ghost: opts.ghost, bouncesLeft: opts.bounces ?? 0, bounces: [], pushed: opts.pushed,
    })
    return dir
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
      if (!targetable(e)) continue
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

  /**
   * Everything near the line from `o` to `end` gets run over at the moment Still
   * reaches it, not on the press. Knocked away from the start, or sideways off the
   * path when `sideways` is the travel direction (Overrun's charge). No line check:
   * the path is already clamped at the first wall. Crates on it break either way.
   */
  private runOver(o: THREE.Vector3, end: { x: number; z: number }, width: number, damage: number, knock: number, ms: number, sideways: { x: number; z: number } | null, pushed: boolean) {
    const sx = o.x
    const sz = o.z
    const ex = end.x
    const ez = end.z
    if (damage > 0) {
      const lenSq = (ex - sx) ** 2 + (ez - sz) ** 2
      for (const e of this.enemies) {
        if (distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > width + e.radius) continue
        const along = lenSq > 0 ? Math.max(0, Math.min(1, ((e.pos.x - sx) * (ex - sx) + (e.pos.z - sz) * (ez - sz)) / lenSq)) : 0
        // the move eases out, so the time to reach a point isn't linear in distance
        const reachT = 1 - Math.sqrt(1 - along)
        this.later.push({
          t: reachT * (ms / 1000),
          run: () => {
            if (e.dead || distToSegment(e.pos.x, e.pos.z, sx, sz, ex, ez) > width + 1.1) return
            this.hitPart(e, damage, pushed)
            if (sideways) {
              const nx = -sideways.z
              const nz = sideways.x
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
      if (!b.broken && distToSegment(b.x, b.z, sx, sz, ex, ez) <= width + b.r) this.events.onSmash(b)
    }
  }

  /** Arm reach: whatever body reaches the blade, not just its centre. */
  /** Awake: its pack is after him (a sleeper is never struck awake), or it has no pack (a carrying thief). */
  private awakeNow(e: Enemy) {
    const p = this.packOf.get(e)
    return p ? p.state === 'awake' : e instanceof Thief
  }

  /** The hand's body: the nearest awake target, if it's in arm's reach with a clear line. Else null (the shot). */
  private handTarget(o: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null
    let bestD = Infinity
    for (const e of this.enemies) {
      if (e.dead || !targetable(e) || this.held.has(e) || !this.awakeNow(e)) continue
      const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
      if (d < bestD) {
        bestD = d
        best = e
      }
    }
    return best && this.inReach(o, best, HAND.range) && !this.shaded(o, best) ? best : null
  }

  /** How far the nearest awake body's edge is from Still's centre (Infinity with none): the ring reads it. */
  handGap(o: THREE.Vector3): number {
    let best = Infinity
    for (const e of this.enemies) {
      if (e.dead || !targetable(e) || !this.awakeNow(e)) continue
      best = Math.min(best, Math.hypot(e.pos.x - o.x, e.pos.z - o.z) - e.radius)
    }
    return best
  }

  /** Planted: the stick has rested EYE.settle s with the eye's switch on. A cast doesn't lift it; a step does. */
  get inStance(): boolean {
    return this.eye && this.stillT >= EYE.settle
  }

  /** The eye's order: a pack's leader, then what shoots (a sentinel, a Lobber) or runs off with a part, then the rest. */
  private eyeRank(e: Enemy): number {
    if (this.packOf.get(e)?.elite?.leader === e) return 2
    return e.kind === 'ranged' || e instanceof Thief ? 1 : 0
  }

  /** The eye's body within `range`: awake, passing `ok`, highest rank, then nearest. Null: none. */
  private eyePick(o: THREE.Vector3, range: number, ok: (e: Enemy) => boolean): Enemy | null {
    const seen: { e: Enemy; d: number; rank: number }[] = []
    for (const e of this.enemies) {
      if (e.dead || !targetable(e) || this.held.has(e) || !this.awakeNow(e)) continue
      const d = Math.hypot(e.pos.x - o.x, e.pos.z - o.z)
      if (d <= range) seen.push({ e, d, rank: this.eyeRank(e) })
    }
    // the line tests only as far down the order as they must
    seen.sort((a, b) => b.rank - a.rank || a.d - b.d)
    return seen.find((s) => ok(s.e))?.e ?? null
  }

  /**
   * A body asleep (or walking home) across the line to `e`, which a bolt would strike first and
   * wake. Nearer than 8 u its pack would wake anyway; this is the 8-11 u room the eye opens.
   */
  private screened(o: THREE.Vector3, e: Enemy, r = SHOT_RADIUS): boolean {
    const dx = e.pos.x - o.x
    const dz = e.pos.z - o.z
    const len = Math.hypot(dx, dz) || 1
    for (const f of this.enemies) {
      if (f === e || f.dead || this.awakeNow(f)) continue
      const along = ((f.pos.x - o.x) * dx + (f.pos.z - o.z) * dz) / len
      if (along < 0 || along > len) continue
      const across = Math.abs((f.pos.x - o.x) * dz - (f.pos.z - o.z) * dx) / len
      if (across < f.radius + r) return true
    }
    return false
  }

  /** A head part's body in the stance: the eye's order among what the part itself reaches. Null: walking, or none. */
  private eyeHead(o: THREE.Vector3, def: AbilityDef): Enemy | null {
    if (!this.inStance || def.slot !== 'head') return null
    // a lob comes down from above; a bolt, even a piercing one, would strike a sleeper on the way
    return this.eyePick(o, def.range, (e) => this.reaches(def, o, e) && (def.shape === 'lob' || !this.screened(o, e, def.radius)))
  }

  /**
   * A head cast's target: the eye's, when planted and it sees one, else `usual` (today's).
   * Planted, a head cast never picks a sleeper: the stance is for fights already awake. Counts a choice that differs.
   */
  private eyeCast(o: THREE.Vector3, def: AbilityDef, usual: Enemy | null): Enemy | null {
    const t = this.eyeHead(o, def)
    if (!t) return this.inStance && def.slot === 'head' && usual && !this.awakeNow(usual) ? null : usual
    if (t !== usual) this.events.onEye('cast')
    return t
  }

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

  /** A broken windup: its booked lock goes with it, and the run hears of it (`push`: the break rule's). */
  private interrupted(e: Enemy, push = false) {
    this.book.unbook(e)
    this.events.onPart(push ? { kind: 'interrupt', enemy: e, push } : { kind: 'interrupt', enemy: e })
  }

  /** Every enemy instant passes here: Combat does its own part first (a rush into a crate breaks it), then the run's. */
  private emitEnemy(ev: EnemyEvent) {
    if (ev.kind === 'rushEnd' && ev.how === 'wall') this.smashNear(ev.at.x, ev.at.z, 0.4)
    this.events.onEnemy(ev)
  }

  /**
   * A rush shoulders aside what it runs through: sideways off the lane, no
   * damage, once each. Rams pass through each other; sleepers and the boss don't move.
   */
  private trample(c: Charger) {
    const s = c.sweep!
    const fx = Math.sin(c.aim)
    const fz = Math.cos(c.aim)
    for (const o of this.enemies) {
      if (o === c || o.dead || o.kind === 'boss' || c.trampled.has(o) || this.held.has(o)) continue
      if (o instanceof Charger && o.rushing) continue
      if (this.packOf.get(o)?.state !== 'awake') continue
      if (distToSegment(o.pos.x, o.pos.z, s.ax, s.az, s.bx, s.bz) > o.radius + CHARGER.trampleReach) continue
      const nx = -fz
      const nz = fx
      const side = Math.sign((o.pos.x - s.ax) * nx + (o.pos.z - s.az) * nz) || 1
      o.knock.addScaledVector(shoveVelocity(nx * side, nz * side, CHARGER.trampleShove), o.knockMul)
      c.trampled.add(o)
      this.emitEnemy({ kind: 'trample', e: c, victim: o, at: o.pos.clone(), dir: new THREE.Vector3(nx * side, 0, nz * side) })
    }
  }

  /**
   * Where each committed tell ends, for the camera: an 11 u lane (or the boss's 25) must
   * never end off screen, and nor must a hazard that's coming.
   */
  threatEnds(): THREE.Vector3[] {
    const out: THREE.Vector3[] = []
    for (const e of this.enemies) {
      if (!(e instanceof Charger) || this.packOf.get(e)?.state !== 'awake') continue
      if ((e.phase === 'windup' && e.locked) || e.rushing) out.push(e.laneEnd(new THREE.Vector3()))
    }
    this.boss?.threats(out)
    for (const h of this.live) if (!h.armed && !h.done && !h.spec.quiet) out.push(threatPoint(h.spec.shape, new THREE.Vector3()))
    return out
  }

  // --- floor hazards (design/content/SPEC.md §3.2) ---

  /** A floor hazard, now: it telegraphs from this tick. Public for the Arbiter, slag, and dev checks. */
  addHazard(spec: HazardSpec): Hazard {
    const h = new LiveHazard(spec)
    this.scene.add(h.tell.group)
    if (h.tell.shell) this.scene.add(h.tell.shell)
    this.live.push(h)
    h.tell.update(0, h)
    this.events.onHazard({ kind: 'spawn', h })
    return h
  }

  /** A slag core's puddle, where its body fell. If he's standing on it, the arm waits on a visible clock (§5.3). */
  private spillSlag(at: THREE.Vector3) {
    const d = Math.hypot(this.lastPlayer.x - at.x, this.lastPlayer.z - at.z)
    this.addHazard({
      source: 'slag', shape: { kind: 'circle', x: at.x, z: at.z, r: SLAG.r },
      armMs: slagArm(d), liveMs: SLAG.liveMs, damage: SLAG.damage, cover: 'none', hurt: 'hazard',
    })
  }

  /** Arm, test, hurt, fade (H8): right after the parts, so a hazard sees this tick's windows. */
  private tickHazards(dt: number, player: THREE.Vector3) {
    const ms = dt * 1000
    for (let i = this.live.length - 1; i >= 0; i--) {
      const h = this.live[i]!
      if (h.done) {
        h.fadeLeft -= ms
        h.sinceArm += ms
        h.tell.update(dt, h)
        if (h.fadeLeft <= 0) {
          this.scene.remove(h.tell.group)
          h.tell.dispose()
          this.live.splice(i, 1)
        }
        continue
      }
      if (!h.armed) {
        h.armIn -= ms
        // a hair of slack: 30 ticks of 1/60 s must arm a 500 ms hazard on the 30th
        if (h.armIn <= 1e-6) {
          h.armed = true
          // a train's segment breaks what's on the rails as the rake reaches it
          if (h.spec.source === 'train') this.smashIn(h.spec.shape, TRAIN_SMASH_GROW)
          this.events.onHazard({ kind: 'arm', h })
        }
      } else {
        h.liveLeft -= ms
        h.sinceArm += ms
      }
      if (h.armed) {
        this.hazardTest(h, player)
        if (h.liveLeft <= 1e-6) this.endHazard(h)
      }
      h.tell.update(dt, h)
    }
  }

  /** Live time over, or cancelled unarmed: it fades and is gone. */
  private endHazard(h: LiveHazard) {
    if (h.done) return
    h.done = true
    this.events.onHazard({ kind: 'end', h })
  }

  /** H2-H4: who's inside, once each. Still by his centre; an enemy by its centre grown by its radius past his. */
  private hazardTest(h: LiveHazard, player: THREE.Vector3) {
    const s = h.spec
    const sh = s.shape
    const covered = (x: number, z: number) => s.cover === 'fromCentre' && sh.kind === 'circle' && !this.terrain.lineClear(sh.x, sh.z, x, z, 0.1)
    // a group (one train) shares one hit set: a body shoved from segment to segment is hit once
    let group: Set<Enemy | 'still'> | undefined
    if (s.group) {
      group = this.groupHits.get(s.group)
      if (!group) this.groupHits.set(s.group, (group = new Set()))
    }
    if (!h.hit.has('still') && !group?.has('still') && inShape(sh, player.x, player.z) && !covered(player.x, player.z)) {
      h.hit.add('still')
      group?.add('still')
      const taken = !this.guardTakes(s, player)
      if (taken) this.hurtPlayer(s.damage, s.hurt, s.owner)
      if (s.shove) this.playerKnock.add(this.stripShove(sh, s.shove, player.x, player.z))
      this.events.onHazard({ kind: 'hit', h, who: 'still', at: player.clone() })
      // H5: warded, it never heats; taken or braced, it does
      if (taken && s.heat) this.events.onHazard({ kind: 'heat', h })
    }
    for (const e of this.enemies) {
      // H2: hazards never hurt the thief
      if (e.dead || e.kind === 'thief' || h.hit.has(e) || group?.has(e) || this.held.has(e) || (s.sparesOwner && e === s.owner)) continue
      if (!inShape(sh, e.pos.x, e.pos.z, e.radius - PLAYER_RADIUS) || covered(e.pos.x, e.pos.z)) continue
      h.hit.add(e)
      group?.add(e)
      // a rushing ram reads knockMul 0
      if (s.shove) e.knock.add(this.stripShove(sh, s.shove, e.pos.x, e.pos.z).multiplyScalar(e.knockMul))
      // not a part: it never uses a mark. A sleeper hit this way wakes its pack (hpSeen).
      // The harmless lesson train (damage 0) passes through without a flash.
      if (s.damage > 0) {
        if (e.hit(s.damage)) this.hazardKilled.add(e)
        this.events.onHit(e.pos, e)
      }
      this.events.onHazard({ kind: 'hit', h, who: e, at: e.pos.clone() })
    }
  }

  /**
   * H4: a warded hazard (the lance) meets Ward and Mirror Ward as a shot does. It
   * reaches him, so a live shell is around him by definition. True when it was taken.
   */
  private guardTakes(s: HazardSpec, player: THREE.Vector3): boolean {
    const g = this.parts.guard
    if (!s.warded || !g || g.kind === 'brace') return false
    if (g.kind === 'ward') {
      g.used = true
      this.events.onPart({ kind: 'shield', at: player.clone(), reflected: false })
      return true
    }
    if (g.reflectsLeft <= 0) return false
    g.reflectsLeft--
    g.used = true
    const o = s.owner && !s.owner.dead ? s.owner.pos : null
    const aim = o ? Math.atan2(o.x - player.x, o.z - player.z) : 0
    // back down the line at whoever fired it, its own weight (the lance's 18); walls stop it
    this.spawnBolt(player, aim, s.damage, 0.3, 20)
    this.events.onPart({ kind: 'shield', at: player.clone(), reflected: true })
    return true
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
  /** One body of any archetype but the boss. */
  private make(kind: Archetype, x: number, z: number, variant?: 'lobber'): Enemy {
    switch (kind) {
      case 'ranged': return variant === 'lobber' ? new Lobber(x, z) : new Ranged(x, z)
      case 'charger': return new Charger(x, z)
      case 'swarm': {
        const m = new Mite(x, z)
        this.miteBatch.add(m)
        return m
      }
      default: return new Chaser(x, z)
    }
  }

  /** `face`: where a member looks while it sleeps; without one the pack faces a random way together. */
  /**
   * `slag`: the member carries a slag core (area II) and spills a puddle where it dies.
   * `look: 'heap'`: its mites sleep under a slag heap (the Works).
   */
  addPack(
    members: { kind: Archetype; variant?: 'lobber'; x: number; z: number; face?: { x: number; z: number }; slag?: true }[], side: boolean,
    elite?: { mod: EliteMod; name: string }, look?: 'heap',
  ): Pack {
    const pack: Pack = {
      members: [], state: 'asleep', side, dropped: false, size: members.length, homes: new Map(), gaze: new Map(), hpSeen: 0,
      weight: members.reduce((a, m) => a + KILL_WEIGHT[m.kind], 0), token: null,
    }
    const gazeAt = Math.random() * Math.PI * 2
    for (const m of members) {
      const e = this.make(m.kind, m.x, m.z, m.variant)
      // mites never carry one: eight puddles would be noise
      if (m.slag && e.kind !== 'swarm') {
        this.slagged.add(e)
        e.setSlag?.()
      }
      this.scene.add(e.group, e.tellGroup)
      this.enemies.push(e)
      e.setAsleep(true)
      pack.members.push(e)
      pack.homes.set(e, new THREE.Vector3(m.x, 0, m.z))
      const a = gazeAt + (Math.random() - 0.5) * 1.2
      pack.gaze.set(e, m.face ? new THREE.Vector3(m.face.x, 0, m.face.z) : new THREE.Vector3(m.x + Math.sin(a), 0, m.z + Math.cos(a)))
      this.packOf.set(e, pack)
      e.idle(0, pack.gaze.get(e)!)
    }
    // mites share one mind: the brood
    const mites = pack.members.filter((e): e is Mite => e instanceof Mite)
    if (mites.length) {
      pack.brood = new Brood(pack, this.broodIndex++, this.scene)
      for (const m of mites) pack.brood.add(m)
      if (look === 'heap') pack.brood.bury(this.scene)
      this.broods.push(pack.brood)
    }
    if (elite && pack.members[0]) this.crown(pack, pack.members[0], elite.mod, elite.name)
    pack.hpSeen = this.hpOf(pack)
    this.packs.push(pack)
    return pack
  }

  /**
   * The thief (§6.1): into the enemies with no pack, so it's never awake, never wakes
   * anything, and pays nothing out. Its nest is where it was built.
   */
  addThief(t: Thief): Thief {
    this.scene.add(t.group, t.tellGroup)
    if (t.hidden) this.nests.push(t)
    else this.enemies.push(t)
    return t
  }

  /** Barrels: each thinks (it watches for its elite's drop) and is solid to Still; out of it, it's an enemy like any. */
  private tickNests(dt: number, player: THREE.Vector3) {
    for (let i = this.nests.length - 1; i >= 0; i--) {
      const t = this.nests[i]!
      t.update(dt, player, this.terrain, this.ctx)
      for (const ev of t.drain()) this.events.onThief(ev)
      if (t.hidden) {
        const dx = player.x - t.pos.x
        const dz = player.z - t.pos.z
        const d = Math.hypot(dx, dz)
        const min = THIEF.barrelR + PLAYER_RADIUS
        if (d < min && d > 1e-4) {
          const out = this.terrain.clampMove(player.x, player.z, t.pos.x + (dx / d) * min, t.pos.z + (dz / d) * min, PLAYER_RADIUS)
          player.x = out.x
          player.z = out.z
        }
        continue
      }
      this.nests.splice(i, 1)
      this.enemies.push(t)
    }
  }

  /** The area's boss, as its def says: its own pack, woken by walking into the arena, never leashed. */
  addBoss(x: number, z: number, face: THREE.Vector3, def: BossDef, posts: Post[] = []): Boss {
    const b = makeBoss(def, x, z, face, posts)
    this.scene.add(b.group, b.tellGroup, b.worldGroup)
    this.enemies.push(b)
    b.setAsleep(true)
    const pack: Pack = {
      members: [b], state: 'asleep', side: false, dropped: false, size: 1, weight: 1, token: null,
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

  private startWave(center: THREE.Vector3, gaps: number[], damage: number, gapWidth: number, minGap: number) {
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
    this.waves.push({ center: center.clone(), r: 1.4, reach, gaps, gapWidth, minGap, damage, hit: false, segs })
  }

  /** "Assemble": scrap piles become small awake hulks, up to `maxAdds`. The second Assembler builds rams and mites. */
  private summon(pack: Pack, points: THREE.Vector3[], maxAdds: number) {
    if (this.boss?.def.adds === 'rams-mites') {
      this.summonRamsMites(pack, points)
      return
    }
    const adds = pack.members.filter((e) => e.kind === 'chaser').length
    for (const p of points.slice(0, Math.max(0, maxAdds - adds))) {
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

  /** HP of every live add: the rams-and-mites summon never builds past today's four hulks' worth. */
  private addsHp() {
    return this.enemies.filter((e) => this.summoned.has(e) && !e.dead).reduce((a, e) => a + e.hp, 0)
  }

  /**
   * §4.24. One ram at the first pile (if none of its rams is standing), and at the other
   * two a brood of mites, awake, that never gives up, all of it no drops, and never
   * more than ADDS_HP_CAP of live adds.
   */
  private summonRamsMites(pack: Pack, points: THREE.Vector3[]) {
    let room = ADDS_HP_CAP - this.addsHp()
    const [p0, p1, p2] = points
    if (p0 && room >= SUMMON_RAM.hp && !this.enemies.some((e) => this.summoned.has(e) && e.kind === 'charger' && !e.dead)) {
      const c = this.make('charger', p0.x, p0.z)
      c.size = SUMMON_RAM.size
      c.hp = SUMMON_RAM.hp
      this.scene.add(c.group, c.tellGroup)
      this.enemies.push(c)
      c.setAsleep(false)
      this.summoned.add(c)
      pack.members.push(c)
      pack.homes.set(c, p0.clone())
      pack.gaze.set(c, p0.clone())
      this.packOf.set(c, pack)
      this.ring(p0, 0.3, 1.8, 0.4, 0xff7a55)
      room -= SUMMON_RAM.hp
    }
    const n = Math.min(SUMMON_MITES, Math.floor(room / MITE.hp))
    const at = [p1, p2].filter((p): p is THREE.Vector3 => !!p)
    if (n <= 0 || !at.length) return
    const members = Array.from({ length: n }, (_, i) => {
      const p = at[i % at.length]!
      const a = (i / n) * Math.PI * 2
      return { kind: 'swarm' as const, x: p.x + Math.sin(a) * 0.5, z: p.z + Math.cos(a) * 0.5 }
    })
    const brood = this.addPack(members, false)
    brood.leash = Infinity
    for (const m of brood.members) this.summoned.add(m)
    for (const p of at) this.ring(p, 0.3, 1.8, 0.4, 0xff7a55)
    this.wake(brood)
  }

  /** Dev: the boss's summon, resolved now at three piles round it. */
  summonNow() {
    const b = this.boss
    if (!b) return
    const pack = this.packOf.get(b)!
    const pts = [0, 1, 2].map((i) => new THREE.Vector3(b.pos.x + Math.sin(i * 2.1) * 4, 0, b.pos.z + Math.cos(i * 2.1) * 4))
    // the Assembler's own cap: this stands in for its summon
    this.summon(pack, pts, BOSS.summon.maxAdds)
  }

  /** Dev: the live adds. */
  adds() {
    return this.enemies.filter((e) => this.summoned.has(e) && !e.dead).map((e) => ({ kind: e.kind, hp: e.hp }))
  }

  private crown(pack: Pack, leader: Enemy, mod: EliteMod, name: string) {
    leader.size = 1.28
    leader.hp *= 2
    if (mod === 'swift') for (const e of pack.members) e.speedMul = 1.45
    if (mod === 'plated') {
      leader.armor = 0.5
      leader.knockMul = 0.3
    }
    leader.setElite?.(mod)
    if (leader instanceof Mite && pack.brood) pack.brood.queen = leader
    const aura = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.15, 32),
      new THREE.MeshBasicMaterial({ color: 0x7d98ff, transparent: true, opacity: 0.55, depthWrite: false }),
    )
    aura.rotation.x = -Math.PI / 2
    // the brood-mother's aura hugs her, so it doesn't sprawl over the biters beside her
    if (leader.kind === 'swarm') aura.scale.setScalar((leader.radius + 0.25) / 0.9)
    this.scene.add(aura)
    pack.elite = { name, mod, leader, aura }
  }

  /** "the Many": the leader falls apart into two smaller, awake copies of itself. */
  private split(pack: Pack, from: Enemy) {
    for (const side of [-1, 1]) {
      const c = this.make(from.kind, from.pos.x + side * 0.6, from.pos.z)
      c.size = CHARGER.splitSize
      c.hp = CHARGER.splitHp
      this.splitBorn.add(c)
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
    if (wasAsleep && pack.members[0]) this.events.onWake(pack.members[0].pos, pack)
  }

  private updatePacks(player: THREE.Vector3) {
    for (const pack of this.packs) {
      const el = pack.elite
      if (el && !el.leader.dead) {
        el.aura.position.set(el.leader.pos.x, DECAL_Y, el.leader.pos.z)
        // the warden shields the rest of its pack while it stands; rams and mites wear it as a lid on their lights
        if (el.mod === 'warding') {
          for (const e of pack.members) {
            e.armor = e === el.leader ? 1 : 0.35
            if (e instanceof Charger || e instanceof Mite) e.sealed = e !== el.leader
          }
        }
      } else if (el?.mod === 'warding') {
        for (const e of pack.members) {
          e.armor = 1
          if (e instanceof Charger || e instanceof Mite) e.sealed = false
        }
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
    // awake bodies don't stack on each other: each pair keeps its two radii apart.
    // A rushing ram is committed to its line, so nothing nudges it off it.
    // Nor a lunging mite: it's landing where the bite is.
    // Nor a mite still under its slag heap: it's waiting its turn, where it lay.
    const moving = this.enemies.filter((e) => this.packOf.get(e)?.state !== 'asleep' && !(e instanceof Charger && e.rushing) && !(e instanceof Mite && (e.phase === 'strike' || e.buried)))
    for (let a = 0; a < moving.length; a++) {
      for (let b = a + 1; b < moving.length; b++) {
        const p = moving[a]!.pos
        const q = moving[b]!.pos
        const dx = q.x - p.x
        const dz = q.z - p.z
        const d = Math.hypot(dx, dz)
        const min = moving[a]!.radius + moving[b]!.radius
        if (d > 0.001 && d < min) {
          // a boss that never walks is never moved: the other body takes the whole overlap
          const pa = anchored(moving[a]!)
          const pb = anchored(moving[b]!)
          if (pa && pb) continue
          const pushP = pa ? 0 : pb ? min - d : (min - d) / 2
          const pushQ = pb ? 0 : pa ? min - d : (min - d) / 2
          p.x -= (dx / d) * pushP
          p.z -= (dz / d) * pushP
          q.x += (dx / d) * pushQ
          q.z += (dz / d) * pushQ
        }
      }
    }
  }

  private walkHome(e: Enemy, pack: Pack, dt: number) {
    const home = pack.homes.get(e)!
    const d = e.pos.distanceTo(home)
    if (d < 0.05) return
    const to = this.terrain.nextStep(e.pos.x, e.pos.z, home.x, home.z, e.radius)
    const sx = to.x - e.pos.x
    const sz = to.z - e.pos.z
    const sd = Math.hypot(sx, sz) || 1
    const step = Math.min(d, HOME_SPEED * dt)
    e.pos.x += (sx / sd) * step
    e.pos.z += (sz / sd) * step
    this.terrain.pushOut(e.pos, e.radius)
  }

  /**
   * The broods, before the enemies: roles, slots, the surge. The four-biter cap
   * holds across every awake brood, so two swarms never bite harder than one.
   * The nearest brood picks first.
   */
  private tickBroods(dt: number) {
    for (const b of this.broods) {
      b.heap?.update(dt)
      if (b.pack.state !== 'awake' && b.isActive) b.reset()
    }
    const awake = this.broods.filter((b) => b.pack.state === 'awake')
    if (!awake.length) return
    const cap = { used: awake.reduce((n, b) => n + (b.isActive ? b.innerCount() : 0), 0) }
    for (const b of awake) b.seatQueen(cap, awake)
    const p = this.ctx.player
    awake.sort((a, b) => a.nearestTo(p) - b.nearestTo(p))
    for (const b of awake) {
      const bite = b.tick(dt, this.terrain, this.ctx, cap, this.parts.decoy)
      if (bite) this.hurtPlayer(bite.damage, 'melee', bite.source)
    }
  }

  /**
   * A Warden falls: its pack's seals break in a ripple outward from where it fell,
   * 30 ms a member, so you see (and hear) the ward come off.
   */
  private breakSeals(pack: Pack, warden: Enemy) {
    const members = pack.members.filter((m) => m !== warden && !m.dead)
      .sort((a, b) => a.pos.distanceTo(warden.pos) - b.pos.distanceTo(warden.pos))
    members.forEach((m, rank) => {
      if (!(m instanceof Charger || m instanceof Mite)) return
      m.sealed = false
      m.unsealT = 0.03 * rank
    })
    this.emitEnemy({ kind: 'sealBreak', from: warden.pos.clone(), members })
  }

  /** How many tells are locked this tick: a tracking tell gives way while any is. */
  private countTells() {
    let n = 0
    for (const e of this.enemies) {
      if (this.packOf.get(e)?.state !== 'awake') continue
      if (e instanceof Charger) n += (e.phase === 'windup' && e.locked) || e.rushing ? 1 : 0
      else if (e instanceof Ranged) n += e.phase === 'windup' && e.locked ? 1 : 0
      // a Lobber's shell in the air is its committed tell
      else if (e instanceof Lobber) n += e.locked ? 1 : 0
      else if (e instanceof Chaser || isBoss(e)) n += e.phase === 'windup' ? 1 : 0
    }
    for (const b of this.broods) n += b.state === 'windup' ? 1 : 0
    // a committed train is a locked tell, until its tail leaves the floor
    n += this.line?.lockedCount() ?? 0
    TELL_CROWD.locked = n
  }

  /** A mite leaves its brood; the last one takes the brood with it. */
  private buryMite(m: Mite, pack: Pack) {
    this.miteBatch.remove(m)
    const b = pack.brood
    if (!b) return
    b.remove(m)
    if (b.mites.length > 0) return
    this.emitEnemy({ kind: 'broodEnd', at: m.pos.clone() })
    this.book.unbook(b)
    this.broods.splice(this.broods.indexOf(b), 1)
    b.dispose()
    delete pack.brood
  }

}
