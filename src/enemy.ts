import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, tellOrder } from './vfx'
import { HIDES, hideMaterials } from './hide'
import type { Terrain } from './terrain'
import type { EliteMod } from './combat'
import type { Brood } from './swarm'
import type { HazardSource, HazardSpec } from './hazard'
import type { LaneDef } from './line'

/**
 * Every archetype is the same machine: approach, windup, strike, recover.
 * The windup is the game — everything else is scaffolding around it.
 */
export type EnemyPhase = 'approach' | 'windup' | 'strike' | 'recover'

/** What an enemy does to the world on the tick it strikes. Combat resolves it. */
export type EnemyAction =
  /**
   * `reach`: the strike's own radius around the striker. A strike aimed at something
   * else (the decoy) still lands on Still if he's inside it. Without it, only the
   * target is hit.
   */
  | {
      kind: 'melee'
      damage: number
      reach?: number
      /** Who swung. The Anvil needs it to stop a rush; the top-up and Brace ignore it. */
      source?: Enemy
      /**
       * The enemy already tested the real Still (ctx.player) and hit, so Combat skips
       * its own test. A lane aimed at the decoy still hits him if his feet are in it.
       */
      tested?: boolean
      /** A shove on Still along (dx, dz), `distance` u of slide, when it lands (the hulk's lunge). */
      shove?: { dx: number; dz: number; distance: number }
    }
  /** `bounces`: an answer shot reflects off walls this many times, retracing a banked bolt. */
  | { kind: 'shot'; dir: THREE.Vector3; damage: number; bounces?: number }
  /** A fan of shots from one point (the boss's cannon). */
  | { kind: 'shots'; from: THREE.Vector3; dirs: THREE.Vector3[]; damage: number }
  /**
   * A ring rolling outward with gaps to stand in. Angles in radians, world space. A gap
   * is `gapWidth` radians, but never narrower than `minGap` units, even close in.
   */
  | { kind: 'wave'; center: THREE.Vector3; gaps: number[]; damage: number; gapWidth: number; minGap: number }
  /** Scrap piles that become small adds, never more than `maxAdds` standing. */
  | { kind: 'summon'; points: THREE.Vector3[]; maxAdds: number }
  /** A floor hazard it placed: it telegraphs, arms once, and hurts whoever is inside (hazard.ts). */
  | { kind: 'hazard'; spec: HazardSpec }
  /** Take back its own unarmed hazards of this source (a lance cut short): they fade and never arm. */
  | { kind: 'unhazard'; source: HazardSource }
  /** Drag Still toward a point for a while. */
  | { kind: 'pull'; center: THREE.Vector3; strength: number; seconds: number }

/** A shove is a velocity that bleeds off, not a teleport: slide distance = speed / decay. */
export const KNOCK_DECAY = 9
/** Above this speed an enemy is sliding and can't advance or start a windup. */
const STAGGER_SPEED = 1.5

/** Integrates knockback. Returns true while the enemy is still sliding. */
export function slide(pos: THREE.Vector3, knock: THREE.Vector3, dt: number): boolean {
  pos.addScaledVector(knock, dt)
  knock.multiplyScalar(Math.exp(-KNOCK_DECAY * dt))
  return knock.lengthSq() > STAGGER_SPEED * STAGGER_SPEED
}

/** The velocity that slides something `distance` units along (dx, dz). */
export function shoveVelocity(dx: number, dz: number, distance: number): THREE.Vector3 {
  const len = Math.hypot(dx, dz) || 1
  return new THREE.Vector3((dx / len) * distance * KNOCK_DECAY, 0, (dz / len) * distance * KNOCK_DECAY)
}

/**
 * What every enemy's update can see beyond its target. One object, owned by
 * Combat and reused every call, so nothing here may be kept past the tick.
 */
export interface EnemyCtx {
  /** Still's centre. Never the decoy: every hit test an enemy does itself uses this. */
  readonly player: THREE.Vector3
  /** Still's velocity this tick, u/s, from the position delta. Zero on the first tick and after a jump. */
  readonly playerVel: THREE.Vector3
  /** Combat's game clock, seconds. */
  readonly now: number
  /** No booked lock within BOOK_GAP of now + offsetMs: two locks never land on top of each other. */
  canLock(offsetMs: number): boolean
  book(owner: object, offsetMs: number): void
  /** Rams: the pack's windup/rush token is free for e (nobody, e itself, or its holder is past its rush). */
  tokenFree(e: Enemy): boolean
  takeToken(e: Enemy): void
  /** In the clamp's throw. */
  held(e: Enemy): boolean
  /** How far from Still's centre a body's edge may be for the close strike to reach it (combat's HAND_REACH): a hulk's band is measured against it. */
  readonly handReach: number
  /** Planted: the stick has rested and the planted shot is on. A sentinel's duck watches it. */
  planted: boolean
  /** Counter-moves: no other hulk is in a crouch or a lunge (or e is the one), so e may start its own. */
  lungeFree(e: Enemy): boolean
  /** Counter-moves: fewer than half of e's pack's sentinels (at least one may) are hiding, so e may duck. */
  duckFree(e: Enemy): boolean
  emit(ev: EnemyEvent): void
  /** The Line's brood rule (design/area3/SPEC.md §5.8): (x, z) is within halfW + broodPad of a lit lane's floor span. */
  nearLit?(x: number, z: number): boolean
  /** B3 (R5): (x, z) is inside a lit lane's strip, grown by LINE.halfW + r + LINE.stepOff.pad. A body about to commit to a move does not start one there. */
  onLit?(x: number, z: number, r: number): boolean
  /** B4: the Line, for the Signalman. Absent on a level without lanes. Its times are the Line's clock (`t`), NOT `now`. */
  line?: SignalLine
}

/** What the Signalman may ask of the Line (line.ts's `Line` satisfies it): the lanes, which are lit, when each next runs, and a call. */
export interface SignalLine {
  readonly t: number
  readonly lanes: readonly LaneDef[]
  lit(): readonly LaneDef[]
  nextAt(lane: LaneDef): number
  call(lane: LaneDef): boolean
}

/** Instants the run dresses (sound, sparks, the log). Lasting state is polled instead. */
export type EnemyEvent =
  /** A committed aim: the ram 495 ms in (`end` = where its lane ends), the sentinel's line freezing (`end` null). */
  | { kind: 'lock'; e: Enemy; end: THREE.Vector3 | null }
  /** The ram scraping a hoof while it tracks, at 80 and 300 ms. */
  | { kind: 'paw'; e: Enemy; at: THREE.Vector3 }
  | { kind: 'rushEnd'; e: Enemy; how: 'open' | 'wall' | 'caught' | 'trip'; at: THREE.Vector3 }
  /** A rush shouldering another enemy aside. */
  | { kind: 'trample'; e: Enemy; victim: Enemy; at: THREE.Vector3; dir: THREE.Vector3 }
  /** The hatch slams: the stun window is over. */
  | { kind: 'stunEnd'; e: Enemy }
  /** An open rush enters its last 1.5 u: braced, grinding. */
  | { kind: 'skid'; e: Enemy }
  /** The rush's front passed within 2.0 of Still without hitting him. `at` is where he stood. */
  | { kind: 'nearMiss'; e: Enemy; at: THREE.Vector3 }
  /** A brood's surge starts: its ring is laid at `at` (L), with this many biters. */
  | { kind: 'surge'; brood: Brood; at: THREE.Vector3; ms: number; biters: number }
  /** A biter left the surge: killed, Parried, or flung (grabbed, or shoved out of reach). `arc` is its piece of the ring. */
  | { kind: 'biterLost'; brood: Brood; mite: Enemy; why: 'dead' | 'parry' | 'flung'; arc: THREE.Vector3 }
  /**
   * A counter-move's instants (COUNTER_HULK, COUNTER_SENTINEL): a hulk's crouch (`ms` long), its lunge and
   * the lunge landing on Still; a sentinel breaking off to cover (`duck`), backing away when there is none, and its peek.
   */
  | { kind: 'counter'; e: Enemy; what: 'crouch' | 'lunge' | 'lungeHit' | 'duck' | 'backaway' | 'peek'; ms?: number }
  /** B4: the Signalman's arm came down and its lane was called (`called` false: the Line refused, a train was already on it). */
  | { kind: 'call'; e: Enemy; lane: number; called: boolean }
  /** The 550 tick: the bite, on Still or on air. */
  | { kind: 'bite'; brood: Brood; at: THREE.Vector3; biters: number; hit: boolean }
  /** The biters touch down in the clump. */
  | { kind: 'landed'; brood: Brood; at: THREE.Vector3[] }
  /** A mite came out of its slag heap: `at` is where. */
  | { kind: 'shed'; brood: Brood; at: THREE.Vector3 }
  /** The last mite of a brood died. */
  | { kind: 'broodEnd'; at: THREE.Vector3 }
  /** A level change took a brood away: stop its voices. */
  | { kind: 'broodGone'; brood: Brood }
  /** A Warden fell: its pack's seals break, nearest first. */
  | { kind: 'sealBreak'; from: THREE.Vector3; members: Enemy[] }
  /**
   * The Arbiter's instants, for its sounds: its gaze catching Still, a ratchet of the sweep, the
   * vent opening and closing, a judder (`ms`), a post cracking, the scald going off.
   */
  | { kind: 'arbiter'; e: Enemy; what: 'catch' | 'ratchet' | 'vent' | 'ventEnd' | 'judder' | 'crack' | 'scald' | 'phase2'; at: THREE.Vector3; ms?: number }
  /**
   * A mender's cable (mender.ts): linked to `patient`, let go (its patient died, a wall, out of reach),
   * or cut by his body at `at`, the cable then running `from` its feet `to` where it reached.
   */
  | { kind: 'mend'; e: Enemy; what: 'link' | 'drop' | 'cut'; at: THREE.Vector3; patient: Enemy; from?: THREE.Vector3; to?: THREE.Vector3 }

export interface Enemy {
  /** 'thief': a body without a pack that never attacks (thief.ts). 'mender': a packmate that never attacks (mender.ts). */
  readonly kind: 'chaser' | 'ranged' | 'charger' | 'swarm' | 'boss' | 'thief' | 'mender'
  /** 'lobber' for the sentinel variant that lobs shells; loot, budget and treasure follow `kind`. */
  readonly variant?: 'lobber' | 'signal' | 'handcar'
  /** Where an elite's name floats, before size. */
  readonly labelY: number
  /**
   * Body radius for every hit check: base × size, so an elite is a bigger target
   * and a split half a smaller one. The boss is far bigger than a hulk.
   */
  readonly radius: number
  readonly group: THREE.Group
  /** Telegraphs live in world space, not under the body, so a lunge can't scale them. */
  readonly tellGroup: THREE.Group
  readonly pos: THREE.Vector3
  readonly windupMs: number
  /** Knockback velocity. Combat adds to it; the enemy slides it off. */
  readonly knock: THREE.Vector3
  hp: number
  phase: EnemyPhase
  /**
   * Pressure (accepted 28 Sep; his ask: telegraphs on every enemy "is actually weird"):
   * an ordinary hulk, sentinel or mite with no big windup, pressure instead. Set by Combat on a non-elite pack.
   */
  pressure?: boolean
  /**
   * Counter-moves (COUNTERS.md): set by Combat on a pressure hulk or sentinel while the pause switch is on.
   * Off (or absent) is today's behaviour exactly.
   */
  counters?: boolean
  /** A pressure hulk in its crouch: the one windup it has, which a push or a part breaks and the autos never do. */
  readonly crouching?: boolean
  dead: boolean
  /** Damage taken is multiplied by this. Elites and their wards change it. */
  armor: number
  speedMul: number
  /** The depth curve's damage multiplier on its hits (curve.ts): a heavy's, or an ordinary body's. Absent is 1. */
  dmgMul?: number
  /** Knockback taken is multiplied by this. */
  knockMul: number
  /** Overall scale; an elite leader stands bigger than its pack. */
  size: number
  /** Where a status badge sits: the top of the body, unscaled (Combat multiplies by size). */
  readonly height: number
  /**
   * Frost on the body, 0..1, set by Combat while it's slowed. Presentation only:
   * each class's tint lerps toward RIME with it, joints first (legs first).
   */
  rime: number
  /**
   * 0..1: how high it's been thrown, set by Combat while it's in the air. Tint
   * shades the body by it, so a hulk lifted toward Grace's light stays dark
   * metal instead of blowing out white.
   */
  air: number
  /** For footsteps: whether it's walking, and a phase that advances one PI per step. */
  readonly walking: boolean
  readonly gait: number
  hit: (damage: number) => boolean
  /**
   * Break a windup (Parry Clamp, a grab). True if one was broken: the tell goes,
   * the strike never comes, and it goes back to closing in. Something that can't
   * be interrupted (the Assembler) returns false and just takes the hit.
   * `reel` (a pushed hit, the break rule on): it reels instead, its own recover
   * with every hit ×REEL.mul, the ram's hatch language. The ram refuses a reel once locked.
   */
  interrupt: (reel?: boolean) => boolean
  /** ms until the windup running now lands (its strike, shot, launch or rush); null when none is. */
  landsIn: () => number | null
  /**
   * B1 (LINE-RULES R3). A pressure body's own tell, the one thing nothing else may break: ms until its attack lands
   * (the hulk's cock, the sentinel's lens glow, the mite's rear), else null. Absent on bodies without one.
   * INV-T1: non-null only while `pressure` is true and the body is not in a counter's crouch.
   */
  tellIn?: () => number | null
  /**
   * B1 (R3). Parry Clamp caught its tell: the attack is spent, and its own clock restarts. `now` is Combat's
   * time; `graceMs` the dial (PARRY.graceMs); `reel`: pushed under the break rule. True if it caught one.
   * INV-T2: never true while tellIn() is null, unless graceMs > 0 and its tell ended <= graceMs ago.
   * INV-T3: never consumes Math.random (the K-90F traces of every other scenario must not shift).
   */
  catchTell?: (now: number, graceMs: number, reel: boolean) => boolean
  update: (dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx) => EnemyAction | null
  /** Presentation only, no thinking: while asleep, or walking home. `face` is where to look. */
  idle: (dt: number, face: THREE.Vector3) => void
  /** Dim and dark-cored while asleep; a flash on waking. */
  setAsleep: (asleep: boolean) => void
  /** Crowning calls it after size, hp and armor are set, for a mod the body itself has to know about. */
  setElite?: (mod: EliteMod) => void
  /** Area II: it carries a slag core, molten where its core was (the tell is on the body before the kill). */
  setSlag?: () => void
  dispose: (scene: THREE.Scene) => void
}

/** Still's body radius. Lives here so an enemy that tests him itself can import it without a cycle. */
export const PLAYER_RADIUS = 0.42

/** Distance from a point to a segment, on the floor. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax
  const vz = bz - az
  const len = vx * vx + vz * vz
  const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len)) : 0
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}

/** Turn `from` toward `to` by at most `maxStep` radians, the short way round. */
export function turn(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return from + Math.max(-maxStep, Math.min(maxStep, d))
}

export const SLEEP_BODY = new THREE.Color(0.35, 0.35, 0.38)

/**
 * A windup broken by a push (strain step 1): the body reels through its own recover,
 * open like the ram's hatch, its core pulsing the firebox's hot amber.
 */
export const REEL = { mul: 1.5, hot: 0xff8a3c, hz: 9 }
const REEL_HOT = new THREE.Color(REEL.hot)
/** A reeling core's colour at `s` seconds in: the firebox's pulse between its own ember and hot amber. */
export function reelCore(out: THREE.Color, base: number, s: number) {
  return out.setHex(base).lerp(REEL_HOT, 0.5 + 0.5 * Math.sin(Math.PI * 2 * REEL.hz * s))
}

/**
 * Free everything an enemy built for itself: every mesh's geometry and material
 * under these objects. Each enemy makes its own, none are shared, so this is safe;
 * without it, every level left its enemies' geometry on the GPU.
 */
export function disposeBody(...roots: THREE.Object3D[]) {
  for (const r of roots) {
    r.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.geometry.dispose()
      const m = o.material as THREE.Material | THREE.Material[]
      for (const x of Array.isArray(m) ? m : [m]) x.dispose()
    })
  }
}

/** What frost does to iron: pale and cold. Still's colour, on their bodies (G5: statuses live on the body). */
export const RIME = new THREE.Color(0x9fb4c8)
/**
 * How far full frost takes the colour. A status stays quiet (T §3: rime climbs to
 * about a third), so the hit flash keeps its meaning.
 */
const RIME_DEPTH = 0.4

/** At the top of a throw the body is this much closer to the light: shade it back by about as much. */
const AIR_SHADE = 0.5

/**
 * What statuses and flight do to a body's colour. Frost climbs the joints first,
 * the shell half as much; a thrown body is shaded against the light it rises into.
 * Call after the base colour, before the hit flash.
 */
export function statusTint(joint: THREE.MeshStandardMaterial, shell: THREE.MeshStandardMaterial, rime: number, air: number) {
  if (rime > 0) {
    joint.color.lerp(RIME, rime * RIME_DEPTH)
    shell.color.lerp(RIME, rime * RIME_DEPTH * 0.5)
  }
  if (air > 0) {
    joint.color.multiplyScalar(1 - AIR_SHADE * air)
    shell.color.multiplyScalar(1 - AIR_SHADE * air)
  }
}
export const CORE_ASLEEP = 0x2a1512
/** A slag core: hotter, not redder, than the ember it replaces; banked while it sleeps. */
export const SLAG_CORE = 0xff8a3c
export const SLAG_CORE_ASLEEP = 0x3a1a0e

/** Soot-black cast iron (hide.ts has every body's metal). Red belongs to the threat: cores and tells. */
const BODY = HIDES.hulk.body
const JOINT = HIDES.hulk.joint
export const CORE = 0xff5a3c

function cyl(r0: number, r1: number, len: number, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), mat)
  m.position.y = y
  return m
}

export const CHASER = {
  hp: 30,
  speed: 4.3,
  bodyRadius: 0.55,
  strikeRange: 2.0,
  strikeRadius: 2.4,
  damage: 9,
  windupMs: 520,
  recoverMs: 760,
}

/**
 * The pressure hulk (accepted 28 Sep): no ring and no rear-back. In contact it cocks a fist for a
 * beat and swipes whoever is still in reach; a crowd of them is the threat, not one slam.
 * Its swipes stack with its packmates' (Combat skips the hurt window for them).
 */
export const PRESSURE_HULK = { contact: 1.5, reach: 1.9, cockMs: 180, damage: 5, recoverMs: 550 }

/**
 * The hulk's lunge (29 Sep, his call: "do the counter moves next"; design/enemies/COUNTERS.md, the
 * rules round's M2: every archetype has a second tell that punishes the answer that beats its first).
 * Holding the close strike's band on a pressure hulk was safe forever. Anywhere inside the strike's reach
 * (contact included since 29 Sep: the strike's shove meant the band alone never built), for `bandS` seconds
 * (drained `drain` times as fast outside it), and it
 * crouches back for `crouchMs` (a body tell only: no ring, its core flaring, its own scrape), locks
 * its direction, and lunges `lungeDist` u in `lungeMs`. `damage` (the depth curve's `dmg` applies) and a
 * `shove` on Still if the lunge passes within `hitReach` of him: a step to the side in the crouch dodges it.
 * Then it stands open for `recoverMs` and can't build again for `cooldownMs`. One hulk at a time
 * crouches or lunges. A push or a part breaks the crouch as a heavy's windup; the autos never do.
 * It stops where it lands on him. `hitReach` is the body's own reach (his radius, its radius and a hand),
 * not the swipe's 2.45: a lunge that reached as far as the swipe could not be sidestepped in 350 ms.
 * The crouch books its lunge (LINE-RULES R8), so it never lands within BOOK_GAP of a ram's, a sentinel's or a train's lock.
 */
export const COUNTER_HULK = {
  bandS: 1.5, drain: 2, crouchMs: 350, lungeDist: 3.5, lungeMs: 180, damage: 8, shove: 1.2, hitReach: 1.3, recoverMs: 900, cooldownMs: 4000,
}
/**
 * The core at the top of the crouch: deeper and redder than its ember, never pale (no white on a tell).
 * A lighter orange (0xff7a2e, and swelling to 1.6x) washed out to a flat peach slab under the tone
 * mapping and bloom (29 Sep screenshots); the heat reads as a flicker speeding up instead.
 */
const CROUCH_HOT = new THREE.Color(0xff3812)
/** The crouch's flicker: `hz` at the start of the crouch to `hz + hzUp` at its top, `depth` of the dip. */
const CROUCH_FLICKER = { hz: 7, hzUp: 11, depth: 0.35 }

/** The heat round a flaring core: one soft radial glow, shared by every hulk (the sentinel's lens halo, in ember). */
let flareMap: THREE.CanvasTexture | null = null
function flareTexture() {
  if (flareMap) return flareMap
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  // red at the heart, not orange: added over a lit bronze body, an orange centre went pink-peach
  grad.addColorStop(0, 'rgba(255,70,20,0.6)')
  grad.addColorStop(0.25, 'rgba(230,50,15,0.2)')
  grad.addColorStop(1, 'rgba(200,30,10,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  flareMap = new THREE.CanvasTexture(c)
  return flareMap
}

/** Closes, telegraphs a ring, strikes where the ring is. */
export class Chaser implements Enemy {
  readonly kind = 'chaser'
  readonly labelY = 2.3
  get radius() { return CHASER.bodyRadius * this.size }
  readonly windupMs = CHASER.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = CHASER.hp
  phase: EnemyPhase = 'approach'
  pressure = false
  counters = false
  /** Pressure: ms the fist has been cocked, or -1. */
  private cock = -1
  /** Combat's time at the tick the cock became a strike (PARRY's grace reads it). */
  private tellEnd = -Infinity
  /** Counter-move (COUNTER_HULK): seconds Still has stood in its band; ms left of the cooldown; the crouch, and the lunge under way. */
  private bandT = 0
  private cd = 0
  private crouch = false
  private lunge: { left: number; hit: boolean; dx: number; dz: number } | null = null
  /** The crouch or the lunge ended (or was broken): the cooldown starts. */
  private spent = false
  /** The core is lit for a counter (it's put back once). */
  private flared = false
  /** The crouch flicker's phase, in cycles. */
  private flick = 0
  /** The direction locked at the start of the crouch, radians. */
  private lock = 0
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  readonly height = 1.7
  rime = 0
  air = 0
  walking = false
  get gait() { return this.bob * 1.6 }
  get crouching() { return this.crouch }
  /** In the crouch or the dash: the one slot the whole combat gives a lunge. */
  get lunging() { return this.crouch || this.lunge !== null }
  /** B3 (R4): in a counter's crouch, its lunge, or the open recover after it: committed to it, so it never steps off a lit lane. */
  get countering() { return this.crouch || this.lunge !== null || this.spent }

  private timer = 0
  /** A broken windup: the core blinks dark for a moment. */
  private blink = 0
  /** A push broke its slam: reeling open through its recover (ms in). -1 when not. */
  private reel = -1
  private flash = 0
  private bob = Math.random() * 10
  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly core: THREE.Mesh
  private readonly coreMat: THREE.MeshBasicMaterial
  /** The glow round the core in a counter's crouch and lunge, off otherwise. */
  private readonly flare: THREE.Sprite
  /** Its core's colours, lit and asleep: a slag core swaps them. */
  private coreOn = CORE
  private coreOff = CORE_ASLEEP
  /** The hulk's rig: hinged at the hips, shoulders and legs so it can rear and slam. */
  private readonly torso = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private pose = { lean: 0, arms: 0, squash: 1 }
  private asleep = false
  /** Lives in world space, NOT under the body — the lunge must not scale the tell. */
  readonly tellGroup = new THREE.Group()
  private readonly disc: THREE.Mesh
  private readonly ring: THREE.Mesh
  private readonly ringMat: THREE.ShaderMaterial
  private readonly discMat: THREE.ShaderMaterial

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A headless hulk: broad, low, heavy fists. The core in its chest is its face.
    const hide = hideMaterials('hulk')
    this.mat = hide.mat
    this.jointMat = hide.jointMat

    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.26, 0.5, 0)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.38), this.jointMat)
      foot.position.set(0, -0.44, 0.05)
      leg.add(cyl(0.13, 0.15, 0.42, this.jointMat, -0.2), foot)
    }

    this.torso.position.y = 0.5
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), this.mat)
    chest.scale.set(1.05, 0.8, 0.85)
    chest.position.y = 0.48
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 6, 18), this.jointMat)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.3
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.5), this.mat)
    yoke.position.y = 0.84

    // cores ignore the fog (the lights-out rule): in the dark they're what you read
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
    this.core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.12), this.coreMat)
    this.core.position.set(0, 0.5, 0.4)
    this.flare = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 }))
    this.flare.position.set(0, 0.5, 0.46)
    this.flare.visible = false
    this.torso.add(chest, band, yoke, this.core, this.flare)

    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), this.mat)
      shoulder.position.set(side * 0.56, 0.78, 0)
      arm.position.set(side * 0.62, 0.74, 0)
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.3), this.mat)
      fist.position.y = -0.82
      arm.add(cyl(0.1, 0.11, 0.36, this.jointMat, -0.18), cyl(0.18, 0.13, 0.4, this.mat, -0.52), fist)
      this.torso.add(shoulder, arm)
    }

    // Outer ring is fixed at the real strike radius so the danger zone never moves.
    // The inner disc fills it over the windup, so growth reads as a clock.
    this.ringMat = tellMaterial('radial', CHASER.strikeRadius)
    const ring = new THREE.Mesh(new THREE.RingGeometry(CHASER.strikeRadius - 0.1, CHASER.strikeRadius, 48), this.ringMat)
    ring.rotation.x = -Math.PI / 2
    this.ring = ring

    this.discMat = tellMaterial('radial', CHASER.strikeRadius)
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(CHASER.strikeRadius, 48), this.discMat)
    this.disc.rotation.x = -Math.PI / 2
    this.disc.scale.setScalar(0.001)

    this.tellGroup.position.y = DECAL_Y
    this.tellGroup.add(ring, this.disc)

    this.group.add(this.legL, this.legR, this.torso)
  }

  /** Lean, raised fists and squash, eased toward a target so the slam has weight. */
  private strikePose(dt: number, target: { lean: number; arms: number; squash: number }, snap = false) {
    const k = snap ? 1 : Math.min(1, dt * 14)
    this.pose.lean += (target.lean - this.pose.lean) * k
    this.pose.arms += (target.arms - this.pose.arms) * k
    this.pose.squash += (target.squash - this.pose.squash) * k
    this.torso.rotation.x = this.pose.lean
    this.armL.rotation.x = this.pose.arms
    this.armR.rotation.x = this.pose.arms
    this.torso.scale.set(1 / Math.sqrt(this.pose.squash), this.pose.squash, 1 / Math.sqrt(this.pose.squash))
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiply(SLEEP_BODY)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  interrupt(reel = false) {
    if (this.phase !== 'windup') return false
    this.phase = reel ? 'recover' : 'approach'
    this.timer = reel ? CHASER.recoverMs : 0
    if (reel) this.reel = 0
    // a broken crouch: no lunge, and the band has to be built again after the cooldown
    if (this.crouch) {
      this.crouch = false
      this.bandT = 0
      this.cd = COUNTER_HULK.cooldownMs
    }
    // the ring goes at once: no fade, its heat broken
    this.ringMat.opacity = 0
    this.discMat.opacity = 0
    this.disc.scale.setScalar(0.001)
    this.core.scale.setScalar(1)
    this.blink = 0.2
    this.coreMat.color.setHex(this.coreOff)
    return true
  }

  landsIn() {
    return this.phase === 'windup' ? Math.max(0, this.timer) : null
  }

  /** The fist's cock (a pressure hulk's own tell), never a counter's crouch: that is a windup, and `interrupt` breaks it. */
  tellIn() {
    return this.pressure && this.cock >= 0 && !this.crouch ? Math.max(0, PRESSURE_HULK.cockMs - this.cock) : null
  }

  catchTell(now: number, graceMs: number, reel: boolean) {
    const inGrace = graceMs > 0 && now - this.tellEnd <= graceMs / 1000 && (this.phase === 'strike' || this.phase === 'recover') && !this.lunging
    if (this.tellIn() === null && !inGrace) return false
    this.cock = -1
    this.tellEnd = -Infinity
    this.phase = 'recover'
    this.timer = reel ? CHASER.recoverMs : PRESSURE_HULK.recoverMs
    if (reel) this.reel = 0
    this.blink = 0.2
    this.coreMat.color.setHex(this.coreOff)
    return true
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor * (this.reel >= 0 ? REEL.mul : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    this.timer -= dt * 1000
    this.bob += dt * 5
    if (this.blink > 0 && (this.blink -= dt) <= 0) this.coreMat.color.setHex(this.coreOn)
    this.flash = Math.max(0, this.flash - dt * 6)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    let action: EnemyAction | null = null
    const staggered = slide(this.pos, this.knock, dt)
    const counters = this.pressure && this.counters

    // counter-move: how long Still has held the band (outside the swipe, inside the close strike, a clear line)
    if (counters && !this.lunging) {
      if (this.cd > 0) {
        this.cd -= dt * 1000
        this.bandT = 0
      } else {
        // contact counts too (29 Sep, his call "A"): the close strike shoves it out of the band before 1.5 s
        // ever builds, so time anywhere inside the strike's reach is what the lunge answers
        const inBand = target === ctx.player && dist <= ctx.handReach + this.radius
          && terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)
        this.bandT = inBand ? this.bandT + dt : Math.max(0, this.bandT - dt * COUNTER_HULK.drain)
      }
    }

    switch (this.phase) {
      case 'approach': {
        if (staggered) {
          this.cock = -1
          break
        }
        if (counters && this.cock < 0 && this.bandT >= COUNTER_HULK.bandS && ctx.lungeFree(this) && ctx.canLock(COUNTER_HULK.crouchMs)
          && !ctx.onLit?.(this.pos.x, this.pos.z, this.radius)) {
          // it has been held long enough: crouch back, direction locked, and give the lunge its slot;
          // the lunge is booked like any lock (LINE-RULES R8): no canLock, no crouch, and bandT stays full to try again next tick.
          // Never on a lit strip (R5): it steps off first, and crouches from there
          ctx.book(this, COUNTER_HULK.crouchMs)
          this.phase = 'windup'
          this.crouch = true
          this.timer = COUNTER_HULK.crouchMs
          this.lock = Math.atan2(dx, dz)
          this.bandT = 0
          ctx.emit({ kind: 'counter', e: this, what: 'crouch', ms: COUNTER_HULK.crouchMs })
          break
        }
        if (this.pressure) {
          const touching = dist <= PRESSURE_HULK.contact + this.radius && terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)
          if (this.cock >= 0 || touching) {
            // the fist cocks for a beat, then swipes whoever is still in reach
            this.cock = Math.max(0, this.cock) + dt * 1000
            if (this.cock >= PRESSURE_HULK.cockMs) {
              this.cock = -1
              this.tellEnd = ctx.now
              this.phase = 'strike'
              this.timer = 90
              if (dist <= PRESSURE_HULK.reach + this.radius) action = { kind: 'melee', damage: PRESSURE_HULK.damage, reach: PRESSURE_HULK.reach + this.radius }
            }
            break
          }
        }
        // no striking through a wall, even a low one: close in until the way is clear
        if (dist > CHASER.strikeRange || !terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
          const sx = to.x - this.pos.x
          const sz = to.z - this.pos.z
          const sd = Math.hypot(sx, sz) || 1
          this.pos.x += (sx / sd) * CHASER.speed * this.speedMul * dt
          this.pos.z += (sz / sd) * CHASER.speed * this.speedMul * dt
        } else {
          this.phase = 'windup'
          this.timer = CHASER.windupMs
        }
        break
      }
      case 'windup': {
        if (this.crouch) {
          // the direction was locked at the start: a step to the side in the crouch is the dodge
          if (this.timer <= 0) {
            this.crouch = false
            this.phase = 'strike'
            this.lunge = { left: COUNTER_HULK.lungeMs, hit: false, dx: Math.sin(this.lock), dz: Math.cos(this.lock) }
            this.timer = COUNTER_HULK.lungeMs
            ctx.emit({ kind: 'counter', e: this, what: 'lunge' })
          }
          break
        }
        if (this.timer <= 0) {
          this.phase = 'strike'
          // committed: the strike lands where the ring is, whether you left or not
          if (dist <= CHASER.strikeRadius) action = { kind: 'melee', damage: CHASER.damage, reach: CHASER.strikeRadius }
          this.timer = 90
        }
        break
      }
      case 'strike': {
        const lunge = this.lunge
        if (lunge) {
          // committed along the locked direction, stopped by terrain; it hits once if it passes within reach of Still
          const ms = Math.min(dt * 1000, lunge.left)
          const step = (COUNTER_HULK.lungeDist * ms) / COUNTER_HULK.lungeMs
          const ax = this.pos.x
          const az = this.pos.z
          const to = terrain.clampMove(ax, az, ax + lunge.dx * step, az + lunge.dz * step, this.radius)
          this.pos.x = to.x
          this.pos.z = to.z
          lunge.left -= ms
          if (Math.hypot(to.x - ax - lunge.dx * step, to.z - az - lunge.dz * step) > 0.02) lunge.left = 0
          if (!lunge.hit && distToSegment(ctx.player.x, ctx.player.z, ax, az, to.x, to.z) <= COUNTER_HULK.hitReach
            && terrain.lineClear(to.x, to.z, ctx.player.x, ctx.player.z, 0.1)) {
            lunge.hit = true
            ctx.emit({ kind: 'counter', e: this, what: 'lungeHit' })
            action = {
              kind: 'melee', damage: COUNTER_HULK.damage, reach: COUNTER_HULK.hitReach, tested: true, source: this,
              shove: { dx: lunge.dx, dz: lunge.dz, distance: COUNTER_HULK.shove },
            }
          }
          // it lands on him and stops there, not through him
          if (lunge.hit && Math.hypot(ctx.player.x - to.x, ctx.player.z - to.z) <= this.radius + PLAYER_RADIUS + 0.15) lunge.left = 0
          if (lunge.left <= 0) {
            this.lunge = null
            this.phase = 'recover'
            this.timer = COUNTER_HULK.recoverMs
            this.spent = true
          }
          break
        }
        if (this.timer <= 0) {
          this.phase = 'recover'
          this.timer = this.pressure ? PRESSURE_HULK.recoverMs : CHASER.recoverMs
        }
        break
      }
      case 'recover': {
        if (this.timer <= 0) {
          this.phase = 'approach'
          if (this.spent) {
            this.spent = false
            this.cd = COUNTER_HULK.cooldownMs
            this.bandT = 0
          }
          if (this.reel >= 0) this.coreMat.color.setHex(this.coreOn)
          this.reel = -1
        }
        break
      }
    }

    terrain.pushOut(this.pos, this.radius)

    // --- presentation ---
    // a counter's crouch is the body alone: no ring on the floor
    const winding = this.phase === 'windup' && !this.crouch
    const t = winding ? Math.min(1, Math.max(0, 1 - this.timer / CHASER.windupMs)) : 0
    const crouchT = this.crouch ? Math.min(1, Math.max(0, 1 - this.timer / COUNTER_HULK.crouchMs)) : 0

    if (winding) {
      this.ringMat.opacity = 0.42
      this.discMat.opacity = 0.3
      this.disc.scale.setScalar(Math.max(0.001, t))
      // soonest on top: a slam about to land draws over a fainter tell
      this.disc.renderOrder = tellOrder(this.timer)
      this.ring.renderOrder = this.disc.renderOrder + 0.2
    } else if (this.phase === 'strike' && !this.pressure) {
      // a pressure hulk's jab is its body alone: no ring flashes on the floor
      this.ringMat.opacity = 0.95
      this.discMat.opacity = 0.8
      this.disc.scale.setScalar(1)
    } else {
      // fade out rather than snapping off
      this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
      this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    }
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)

    // winding: rear back and raise both fists. strike: slam them into the floor.
    if (winding) this.strikePose(dt, { lean: -0.32 * t, arms: -2.5 * t, squash: 1 + 0.06 * t })
    // the crouch: sunk and rearing back, fists swung low behind it, well past the swipe's cock
    else if (this.crouch) this.strikePose(dt, { lean: -0.55, arms: 0.7, squash: 1 - 0.26 * crouchT })
    // the lunge: thrown forward, fists out in front
    else if (this.lunge) this.strikePose(dt, { lean: 0.6, arms: -1.5, squash: 0.9 }, true)
    // pressure: a short cock of the fists, and a jab, not the slam
    else if (this.cock >= 0) this.strikePose(dt, { lean: -0.1, arms: -1.2 * Math.min(1, this.cock / PRESSURE_HULK.cockMs), squash: 1 })
    else if (this.phase === 'strike' && this.pressure) this.strikePose(dt, { lean: 0.22, arms: -0.9, squash: 0.95 }, true)
    else if (this.phase === 'strike') this.strikePose(dt, { lean: 0.42, arms: -0.55, squash: 0.86 }, true)
    // reeling: knocked back on its heels, fists thrown wide, the chest open
    else if (this.reel >= 0) this.strikePose(dt, { lean: -0.42, arms: -1.1, squash: 0.94 })
    else this.strikePose(dt * 0.5, { lean: 0.08, arms: 0, squash: 1 })
    this.core.scale.setScalar(1 + (winding ? t * 0.7 : 0))
    // the counter's core: swelling and running hot through the crouch, held at full through the lunge
    if (this.crouch || this.lunge) {
      const k = this.lunge ? 1 : crouchT
      this.core.scale.setScalar(1 + k * 0.3)
      // flickering faster as it builds, held steady through the lunge
      this.flick += dt * (CROUCH_FLICKER.hz + CROUCH_FLICKER.hzUp * k)
      const dip = this.lunge ? 0 : CROUCH_FLICKER.depth * (0.5 + 0.5 * Math.sin(Math.PI * 2 * this.flick))
      this.coreMat.color.setHex(this.coreOn).lerp(CROUCH_HOT, 0.3 + 0.7 * k).multiplyScalar(1 - dip)
      this.flare.visible = true
      // the lunge carries less of the glow: the body is moving, and a big soft disc would read as a flat mark
      const glow = this.lunge ? 0.5 : k
      this.flare.material.opacity = 0.8 * glow * (1 - dip)
      this.flare.scale.setScalar(0.5 + glow * 0.7)
      this.flared = true
    } else if (this.flared) {
      this.flared = false
      this.flick = 0
      this.flare.visible = false
      if (this.blink <= 0) this.coreMat.color.setHex(this.coreOn)
    }
    if (this.reel >= 0) {
      this.reel += dt * 1000
      // after the blink, the open core: swollen, pulsing hot like the ram's firebox
      if (this.blink <= 0) reelCore(this.coreMat.color, this.coreOn, this.reel / 1000)
      this.core.scale.setScalar(1.35)
    }

    const walking = this.phase === 'approach' && !staggered && this.cock < 0
    this.walking = walking
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.4 : 0
    // crouching: the legs fold under it and the whole body sinks
    this.legL.rotation.x = stride - crouchT * 0.7
    this.legR.rotation.x = -stride - crouchT * 0.7

    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    this.group.position.set(this.pos.x, walking ? Math.abs(Math.sin(this.bob * 1.6)) * 0.05 : -0.16 * crouchT, this.pos.z)
    // locked in the crouch and the lunge: it faces where it will go, whatever Still does
    this.group.rotation.y = this.crouch || this.lunge ? this.lock : Math.atan2(dx, dz)

    return action
  }

  idle(dt: number, face: THREE.Vector3) {
    // a pack that lost him or went to sleep drops any counter it had begun
    if (this.crouch || this.lunge) {
      this.crouch = false
      this.lunge = null
      this.phase = 'approach'
    }
    this.bandT = 0
    if (this.flared) {
      this.flared = false
      this.flare.visible = false
      this.coreMat.color.setHex(this.asleep ? this.coreOff : this.coreOn)
    }
    this.bob += dt * (this.asleep ? 1.5 : 5)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
    this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)
    this.group.position.set(this.pos.x, Math.sin(this.bob) * (this.asleep ? 0.02 : 0.06), this.pos.z)
    this.group.rotation.y = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    // asleep: slumped forward, fists on the floor
    this.strikePose(dt, this.asleep ? { lean: 0.38, arms: -0.2, squash: 0.95 } : { lean: 0.08, arms: 0, squash: 1 })
    const walking = !this.asleep
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.3 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride
    this.tint()
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? this.coreOff : this.coreOn)
    if (!asleep) this.flash = 1
    this.phase = 'approach'
    this.reel = -1
    this.crouch = false
    this.lunge = null
  }

  setSlag() {
    this.coreOn = SLAG_CORE
    this.coreOff = SLAG_CORE_ASLEEP
    this.coreMat.color.setHex(this.asleep ? this.coreOff : this.coreOn)
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    disposeBody(this.group, this.tellGroup)
    this.mat.dispose()
    this.jointMat.dispose()
    this.coreMat.dispose()
    this.flare.material.dispose()
    releaseTell(this.ringMat)
    releaseTell(this.discMat)
  }
}
