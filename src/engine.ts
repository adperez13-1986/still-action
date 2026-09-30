import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hideMaterials, HIDES } from './hide'
import { haloTexture, tellMaterial, tellOrder, releaseTell, trackingDim, COLD, COLD_DEEP, type Vfx } from './vfx'
import { statusTint, CORE_ASLEEP, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'
import type { Circle } from './dungeon'
import { engineKit, wagonKit, LINE, RAIL_TELL, RAIL_TOP, WASH_Y } from './line'
import { LaneTell, Quads, UV_LEN, type LaneLook } from './lane'
import { inShape, type Hazard, type HazardSpec } from './hazard'
import { ARBITER } from './arbiter'
import { loopAt, loopS, TRACK, type Pt, type Side, type TrackArm, type TrackDef } from './track'
import type { Terrain } from './terrain'
import type { BossDef } from './areas'
import type { Boss, BossCue } from './boss'

/**
 * The Engine (design/area3/STAGE-C.md, SPEC §7): the Line's own boss, a lamp-black locomotive that runs a loop of track in the
 * roundhouse, lighting the rail ahead of itself 1.3 s before it arrives. Stage C builds it step by step and it is DARK: it exists
 * only where `bossFor` returns ENGINE_DEF (`ENGINE_ON_LINE`).
 *
 *   asleep → unfold 1500 → run
 *
 * C3: the body, asleep and waking. C4: the run, and the lit horizon it makes for itself: the honest rail (INV-E1), laid strip by strip
 * ahead of the nose, each made at least 1.3 s before it arms, and drawn as the Line draws a train's rails (its hazards are the drawing).
 * C5: the levers. Every third junction it passes, a window opens on that side's lever; a cast within reach throws it, the frontier turns
 * into the arm, the engine drives up to the buffer and derails (open, x1.5), backs out, stands 1.3 s with the loop lit, and runs on.
 * C6: its two attacks, overlaid on the run (it keeps moving). Steam: within 8 u of Still, off its lit path and not behind it, it tracks
 * 250 ms with the Arbiter's rails, aimed where its guess says he will be (the Arbiter's answer memory, arbiter.ts), then locks a
 * strip from where it stands at the lock; 700 ms later the jet. The cinder: out of that reach for 5 s (3.5 in phase 2) and the stack
 * lobs a shell where he'll be, the Arbiter's (source 'shell': its landing sound and dust are main's, its ring is drawn as its shell's).
 *
 * C7: phase 2, below 55% HP. The reversal: every 8-12 s, in `run` with no window open, it stands 650 ms and judders (every unarmed strip
 * of its own is taken back at the start, none is laid), turns to run the other way round, and stands 1300 ms while the loop ahead is
 * lit again (INV-E2). The loose wagon: every 14 s a tub rolls down a spur (a LaneTell down it for 1200 ms, then the roll) and settles on
 * the loop as a solid; the lit horizon ends at its near face, and the engine driving into it derails in place, open, the wagon smashed.
 * The lever thrown back: a window that closes unthrown with Still standing in that arm's strip (grown 0.8) is thrown by the engine itself.
 *
 *   run ─(window thrown, the frontier reaches the junction)→ siding ─(centre at the stop)→ derailed 1600 → backing → hold 1300 → run
 *   run ─(p2, reversal due, no window open)→ judder 650 → hold 1300 (dir flipped) → run
 *   run ─(the nose meets a settled wagon)→ derailed 1600 (in place, the wagon smashed) → run
 *   attack: none ─→ steamTrack 250 → steamLock 700 → none | none ─→ cinderAim 620 → (launch; 1000 flight) → none
 */
/** SPEC §2.6, with the brief's changes. INV: no hit above 22 before dmgMul; no windup under 620 ms. */
export const ENGINE = {
  radius: 1.2, width: 1.5, height: 1.5, labelY: 2.4,
  /** The crawl trains' engine model (line.ts engineKit) at this scale. */
  scale: 1.15,
  /** Its body along the track, 2.6 × 1.15 (the unscaled model is 2.6). The nose is pos + fwd × length / 2. */
  length: 3.0,
  /** It whistles once Still is over the near rails and inside the loop. */
  wakeR: 16.5,
  speed: 11, backSpeed: 4,
  /** s of track lit ahead. INV ≥ 0.62. Every strip is made ≥ 1000 × lead ms before it arms. */
  lead: 1.3,
  runDamage: 20, halfW: 1.2, segment: 2,
  /** The whistle at 0, the horizon laid at unfoldMs − lead. */
  unfoldMs: 1500,
  /** A window at every 3rd junction passed, so the sides alternate (the loop's right and left junctions are half a lap apart). */
  lever: { windowMs: 1400, reach: 3.0, everyJunctions: 3 },
  derailMs: 1600, openMul: 1.5,
  /**
   * 250 ms of aim, then 700 locked (slack 164). halfW/damage/gapS/range: SPEC's. `len` is range + leadMax (ENGINE-N17.md §2): a jet booked at
   * range must reach the point it aims at (K-N8 keeps len >= range + leadMax).
   */
  steam: { trackMs: 250, lockMs: 700, liveMs: 200, len: 11, halfW: 1.3, damage: 14, gapS: [6, 9] as const, range: 8, leadMax: 3.0 },
  /** The Arbiter's answer memory (arbiter.ts), for the steam's lead. `minMove`: a lock he wasn't moving through tells it nothing. */
  guess: { memory: 3, minMove: 0.8, first: 1 },
  /**
   * The outrun rule (arbiter.ts): out of every reach this long, and the stack lobs a cinder where he'll be. Phase 1 started at the Arbiter's outrun
   * clock (shellMs 6500) and was eased to 7500 so circling never costs more than camping (ENGINE-N17.md). A launch resets both clocks, so the
   * period is max(afterMs, cooldownMs) + windupMs: 8.12 s, then 5.62 s in phase 2.
   */
  outrun: { afterMs: [7500, 5000] as const, cooldownMs: 5000 },
  /** The Arbiter's shell, lobbed from the chimney; leads him by the whole flight (leadS = flightMs / 1000, as ARBITER.outrun.leadS). Source 'shell'. */
  cinder: { windupMs: 620, flightMs: 1000, r: 1.6, damage: 12, leadS: 1.0, leadMax: 5.5, peak: 3.2 },
  phase2At: 0.55,
  reverse: { judderMs: 650, everyS: [8, 12] as const },
  /**
   * SPEC's, plus `r`/`at` (line.ts SIDING.wagonR / wagonAt) and `halfLen` (its tub, line.ts WAGON.l / 2). A wagon is picked only where its
   * spur meets the loop at least speed × (lead + (tellMs + the roll) / 1000) ahead of the nose (33.8 u); `clear` keeps a reversal from
   * turning it to face a wagon it stands beside.
   */
  wagon: { tellMs: 1200, speed: 7, damage: 12, halfW: 1.2, everyS: 14, firstS: 4, r: 0.75, at: 0.5, halfLen: 0.95, clear: 6 },
  /** The lever thrown back: how far past the arm's strip (halfW) Still's centre may stand. */
  throwBack: { grow: 0.8 },
  /**
   * Two solid circles `at` either side of its centre along its axis. Its colour is HIDES.engine, `dim` of it (the asleep body is 0.5): the body
   * gone cold, no ember on it (the brief's 0x202124 is a flat grey, and the hide rule keeps every body its own metal).
   */
  husk: { r: 0.8, at: 0.7, dim: 0.42, doorAjar: 0.7 },
  seeThrough: { opacity: 0.45, reach: 3.0, half: 1.6 },
  /** The firebox while derailed: deeper and redder than CORE, flickering, never FIRE_HOT's peach. */
  fireHot: 0xff3812, flickerHz: 18,
}
/** Adrian's words: PLACEHOLDER. */
export const BOARD = { right: 'right points', left: 'left points', now: 'now' }

export type EngineState = 'asleep' | 'unfold' | 'run' | 'hold' | 'judder' | 'siding' | 'derailed' | 'backing' | 'dead'
export type EngineAttack = 'none' | 'steamTrack' | 'steamLock' | 'cinderAim'

/** The model's frame: the rake's engine has its front at the origin and runs back along −z, 2.6 long. */
const MODEL_LEN = 2.6
/** The cab's back face, and where the chimney's top stands, in that frame. */
const CAB_BACK = -2.6
const CHIMNEY = { y: 1.7, z: -0.35 }
const FIREBOX = { w: 0.34, h: 0.26, y: 0.7, door: { w: 0.44, h: 0.36 } }
const WHITE = new THREE.Color(0xffffff)
/** The firebox and the headlamp awake: deeper and redder than CORE, never pale (the crouch's lesson, enemy.ts CROUCH_HOT). */
const FIRE = new THREE.Color(ENGINE.fireHot)
/** The flicker: 7 to `flickerHz` Hz, wandering, dipping the brightness by up to `depth` and never lifting it (INV-C1). */
const FLICKER = { hz: 7, depth: 0.35 }
const SOOT = new THREE.Color(0x2c2624)
/** A smashed wagon's chunks: the tub's dark iron. */
const TUB_IRON = new THREE.Color(0x3a3836)
/** The whistle's steam, and the jet's puffs: paler than the stack's smoke, still grey (pale puffs under ACES + bloom clip to a slab). */
const STEAM = new THREE.Color(0x8a9096)
/** The steam's rails and the cinder's ring lie over the sleepers (0.14) and under the rail heads (0.26): the height of the horizon's wash. */
const ATTACK_Y = WASH_Y + 0.004
/** The steam's aim marches this far a step to its first solid (arbiter.ts cutAt marches 0.2; the jet is 2.6 wide, so a finer step). */
const CUT_STEP = 0.1
const angleDiff = (a: number, b: number) => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
/** Distance from (x, z) to the segment a-b. */
const distToSpur = (a: Pt, b: Pt, x: number, z: number) => {
  const ex = b.x - a.x, ez = b.z - a.z, l2 = ex * ex + ez * ez
  const k = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / l2))
  return Math.hypot(x - (a.x + ex * k), z - (a.z + ez * k))
}
/**
 * A strip of the lit horizon is laid when its start is within lead + one tick (+ this hair) of the nose in time: the hair keeps the
 * made-to-armed gap over 1300 ms by more than float noise, and costs the nose nothing (it arms exactly when the nose arrives).
 */
const LAY_HAIR = 0.0005
/** A strip this far from the vertex it would end at is stretched to it, so no sliver of hazard is made (still straight). */
const SLIVER = 0.4
/**
 * The horizon's look, in time. Its brightness is continuous in the time a point has left to arm: full where the engine is over it,
 * falling linearly to `far` of that at `lead` seconds out (the shader, from a per-vertex eta). The ends are the levels tuned in C4
 * for its three tiers, as fractions of the Line's committed look (RAIL_TELL.rails[1], .wash[1]).
 */
const HORIZON = {
  rails: [1, 0.7] as const, wash: [1.5, 0.85] as const,
  /** The swell running along it toward where the engine goes: how much, its length (u) and speed (u/s), on the rails and the wash. */
  swell: { rails: 0.9, wash: 0.55, len: 6, speed: 15 },
  /** Deep red, never the peach of EMBER under ACES + bloom (the firebox's colour). */
  hot: new THREE.Color(ENGINE.fireHot), deep: new THREE.Color(0x4a0c06),
  /** Capacity in strips. */
  cap: 24,
}
/** The lever's turn (about z, in its own frame): at rest leaning back, thrown over; and how fast it swings. */
const LEVER = { rest: 0.55, thrown: -0.55, rate: 12 }
/** The judder (C7): the body shudders, and its wheels throw sparks (vfx.hotSparks: deep red to orange, flickering). Metres, rad, hertz. */
const JUDDER = { shake: 0.05, yaw: 0.012, hz: 40, burst: 8, perDress: 20, turnS: 0.35 }
/** The wagon's tell is the ram's lane 4 u long: tracking (faint core) for this share of the tell, then locked and filling. */
const WAGON_TELL = { trackFrac: 0.25, coreHalf: 0.78, settleFrom: 0.7 }
/**
 * The wagon's lane, lit past the ram's (lane.ts RAM_LOOK 0.18/0.3, 0.55/0.9): it is short (4 u), lies under a siding's sleepers and rails,
 * and the ram's look left it a pale wash beside the horizon. The rails are not drawn (trackWash): the wash, core and star carry it.
 */
const WAGON_LOOK: LaneLook = { wash: [0.34, 0.44], core: [0.85, 1], cap: [0.34, 0.44] }
/** After a reversal the windows count from the nose at once (a start waits a lap first): this is the hair that keeps the nose's own place out. */
const WINDOW_EPS = 1e-6
/** The headlamp, on the smokebox front, in the model's frame. */
const LAMP = { y: 0.95, z: 0.2 }
/** Where the cab's side slits are (line.ts rakeParts). */
const SLIT = { x: 0.74, y: 0.55, z: -2.2 }

/** Brass: two bands round the boiler, the dome, and the headlamp's housing (the body's and the husk's). */
function brassGeometry(): THREE.BufferGeometry {
  return mergeGeometries([
    new THREE.CylinderGeometry(0.575, 0.575, 0.07, 16).rotateX(Math.PI / 2).translate(0, 0.85, -0.5),
    new THREE.CylinderGeometry(0.575, 0.575, 0.07, 16).rotateX(Math.PI / 2).translate(0, 0.85, -1.35),
    new THREE.SphereGeometry(0.2, 12, 8).translate(0, 1.4, -1.1),
    new THREE.BoxGeometry(0.3, 0.3, 0.2).translate(0, LAMP.y, LAMP.z - 0.1),
  ].map((g) => g.toNonIndexed()))!
}

/** One of its own hazards, and what the drawing and the checks need of it. */
interface Seg {
  id: number
  h: Hazard
  /** Combat's clock when it was made (s), and the armMs it was given. */
  madeAt: number
  armMs: number
  /** Which hit set it belongs to (a number per group, counting up). */
  group: number
  ax: number; az: number; bx: number; bz: number
  /** Path u where the strip starts. */
  u0: number
  /** The strip's v where it starts (the swell runs on it): travel distance in UV_LEN units. */
  v: number
  /** How fast the leading end moves over it, u/s. */
  speed: number
}

/** The loose wagon (C7): the public part is what the DEV hook and the checks read. */
export interface WagonState {
  spur: number
  /** Where the tub is now: the spur's outer end during the tell, rolling, then on the loop. */
  x: number; z: number
  settled: boolean
  /** Its two solid circles on the loop once settled (dead = true when smashed). */
  circles: Circle[]
  stage: 'tell' | 'roll' | 'settled'
  /** The spur: outer end, its end on the loop, length, unit direction outward to in. */
  ox: number; oz: number; lx: number; lz: number; len: number; ux: number; uz: number
  /** The spur's end on the loop as a loop parameter, and the loop's straight there (dir +1). */
  s: number; sx: number; sz: number
  /** Its roll hazard, armed at the end of the tell. */
  h: Hazard
}

/** The lit horizon's drawing: a wash and the two rails of every strip not done, one mesh each, dimming with the time left to arm. */
class Horizon {
  private readonly washMat = tellMaterial('strip', 1, HORIZON.hot, HORIZON.deep, { plain: true })
  private readonly railMat = tellMaterial('strip', 1, HORIZON.hot, HORIZON.deep, { plain: true })
  readonly wash = new Quads(HORIZON.cap, this.washMat)
  readonly rails = new Quads(HORIZON.cap * 2, this.railMat)
  private readonly washEta = new THREE.BufferAttribute(new Float32Array(HORIZON.cap * 4), 1)
  private readonly railEta = new THREE.BufferAttribute(new Float32Array(HORIZON.cap * 8), 1)

  constructor() {
    const { swell } = HORIZON
    ;(this.washMat.uniforms.uPulse!.value as THREE.Vector3).set(swell.wash, swell.len, swell.speed)
    ;(this.railMat.uniforms.uPulse!.value as THREE.Vector3).set(swell.rails, swell.len, swell.speed)
    ;(this.washMat.uniforms.uFade!.value as THREE.Vector2).set(HORIZON.wash[1] / HORIZON.wash[0], ENGINE.lead)
    ;(this.railMat.uniforms.uFade!.value as THREE.Vector2).set(HORIZON.rails[1] / HORIZON.rails[0], ENGINE.lead)
    for (const [q, a] of [[this.wash, this.washEta], [this.rails, this.railEta]] as const) {
      a.setUsage(THREE.DynamicDrawUsage)
      q.mesh.geometry.setAttribute('aEta', a)
    }
    this.wash.mesh.name = 'horizon-wash'
    this.rails.mesh.name = 'horizon-rails'
    this.wash.mesh.visible = this.rails.mesh.visible = false
  }

  /** The strips, as the Line draws a train's rail: the wash exactly halfW, rails at the gauge; `flick` dips them. */
  set(list: readonly Seg[], flick: number) {
    const n = Math.min(list.length, HORIZON.cap)
    for (let i = 0; i < n; i++) {
      const g = list[i]!
      const len = Math.hypot(g.bx - g.ax, g.bz - g.az) || 1
      const ox = ((g.bz - g.az) / len) * (LINE.gauge / 2)
      const oz = (-(g.bx - g.ax) / len) * (LINE.gauge / 2)
      this.wash.set(i, g.ax, g.az, g.bx, g.bz, ENGINE.halfW, WASH_Y, g.v)
      this.rails.set(2 * i, g.ax + ox, g.az + oz, g.bx + ox, g.bz + oz, RAIL_TELL.railHalf, RAIL_TOP + 0.004, g.v)
      this.rails.set(2 * i + 1, g.ax - ox, g.az - oz, g.bx - ox, g.bz - oz, RAIL_TELL.railHalf, RAIL_TOP + 0.004, g.v)
      // seconds until each end is reached: 0 under an armed strip, the time to arm plus the run along it otherwise
      const e0 = g.h.armIn <= 0 ? 0 : g.h.armIn / 1000
      const e1 = g.h.armIn <= 0 ? 0 : e0 + len / g.speed
      this.washEta.array.set([e0, e0, e1, e1], 4 * i)
      this.railEta.array.set([e0, e0, e1, e1, e0, e0, e1, e1], 8 * i)
    }
    this.washEta.needsUpdate = this.railEta.needsUpdate = true
    this.wash.mesh.geometry.setDrawRange(0, n * 6)
    this.rails.mesh.geometry.setDrawRange(0, n * 12)
    this.wash.mesh.visible = this.rails.mesh.visible = n > 0
    this.railMat.opacity = RAIL_TELL.rails[1] * HORIZON.rails[0] * flick
    this.washMat.opacity = RAIL_TELL.wash[1] * HORIZON.wash[0] * flick
    // the rails over the wash, as every tell is ordered
    this.wash.mesh.renderOrder = tellOrder(0)
    this.rails.mesh.renderOrder = tellOrder(0) + 0.2
  }

  dispose() {
    this.wash.dispose()
    this.rails.dispose()
    releaseTell(this.washMat)
    releaseTell(this.railMat)
  }
}

export class Engine implements Boss {
  readonly kind = 'boss'
  readonly labelY = ENGINE.labelY
  readonly height = ENGINE.height
  readonly wakeRadius = ENGINE.wakeR
  get radius() { return ENGINE.radius * this.size }
  get maxHp() { return this.def.hp }
  readonly group = new THREE.Group()
  /** Nothing follows the body: its tells all lie in worldGroup. */
  readonly tellGroup = new THREE.Group()
  readonly worldGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  readonly knock = new THREE.Vector3()
  hp = 0
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  dmgMul?: number
  /** It never gets shoved: every shove, pull and toss finds nothing to move. */
  knockMul = 0
  size = 1
  rime = 0
  air = 0
  readonly walking = false
  readonly gait = 0

  state: EngineState = 'asleep'
  attack: EngineAttack = 'none'
  /** Where it is: on the loop (s along dir +1), or on an arm (s from its junction). dir +1 is the loop's vertex order. */
  path: 'loop' | TrackArm = 'loop'
  s = 0
  dir: 1 | -1 = 1
  lap = 0
  /** Its body's centre along the path, unbounded (s is this wrapped into the loop). */
  u = 0
  window: { side: Side; arm: TrackArm; open: boolean; thrown: boolean; msOpen: number } | null = null
  wagon: WagonState | null = null
  /** The guess for the next steam: 1 leads him fully, 0 aims at him (arbiter.ts). */
  guess: number = ENGINE.guess.first
  /** Where the laid horizon ends ahead of the nose, in path u, and what ends it. */
  frontier = 0
  frontierEnd: 'open' | 'buffer' | 'wagon' = 'open'
  phase2 = false
  justPhase2 = false

  /** ms in the current state. */
  private timer = 0
  private asleep = true
  private whistled = false
  private flash = 0
  private bob = 0
  private dressN = 0
  /** How lit the firebox and the headlamp are: 0 asleep, 1 awake (they light over the first 600 ms of the unfold). */
  private lit = 0
  /** The flicker's phase, in cycles. */
  private flick = 0
  /** How far the firebox door stands open, 0..1. */
  private door = 0
  /** Where Still was on the last update, for the see-through fade. */
  private readonly still = new THREE.Vector3(1e3, 0, 1e3)
  private fade = 1

  // --- the run (C4) ---
  /** The body's centre where it began, and the nose's: laps are counted from the first, the junction count from the second. */
  private originBody = 0
  private origin = 0
  /** The horizon is laid up to here (path u): the next strip starts at it. */
  private laidTo = 0
  private started = false
  private nextId = 0
  /** Its own strips, oldest first, until they are done. */
  private segs: Seg[] = []
  /** The hit set the strips being laid belong to (Combat's `group`): a new one each lap, and on every change of path or hold. */
  private groupObj: object | null = null
  private groupLap = 0
  private groupNo = 0
  private clock = 0
  private lastDt = 1 / 60
  private readonly horizon = new Horizon()

  // --- the levers (C5) ---
  /** +1 driving forward, -1 backing out. With `dir` it makes the way its leading end moves along the path (`mv`). */
  private heading: 1 | -1 = 1
  /** The arm it has turned into (the junction's path u), or null on the loop. */
  private branch: { uJ: number; arm: TrackArm } | null = null
  /** The horizon stops here (path u): the buffer's face, or the tail's last place when backing. Null on the open loop. */
  private layEnd: number | null = null
  /** The last junction decided (thrown or not), as dir * u: the next window is for one beyond it. */
  private decided = -Infinity
  /** The open window's junction, as path u. */
  private winU = 0
  /** onCast threw the lever; the event goes out on the next update. */
  private throwEvent = false
  private searchN = 0
  private readonly levers: Record<Side, THREE.Object3D | null> = { right: null, left: null }
  private leverAng: Record<Side, number> = { right: LEVER.rest, left: LEVER.rest }
  private leverGlow: Record<Side, number> = { right: 0, left: 0 }
  /** The window's ring, in Still's cold: the lever's reach, and a disc inside it that shrinks with the time left. */
  private readonly ringMat = tellMaterial('radial', ENGINE.lever.reach, COLD, COLD_DEEP, { cold: true })
  private readonly discMat = tellMaterial('radial', ENGINE.lever.reach, COLD, COLD_DEEP, { cold: true })
  private readonly ring = new THREE.Mesh(new THREE.RingGeometry(ENGINE.lever.reach - 0.1, ENGINE.lever.reach, 64), this.ringMat)
  private readonly disc = new THREE.Mesh(new THREE.CircleGeometry(ENGINE.lever.reach, 48), this.discMat)
  /** The firebox's glow while its door stands open, seen from any side. */
  private readonly fireHalo = new THREE.SpriteMaterial({ map: haloTexture(), color: ENGINE.fireHot, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 })
  /** The end mark where the horizon stops at a buffer or a wagon (the ram's star), or null. */
  private endMark: { x: number; z: number; yaw: number } | null = null
  private readonly endMat = tellMaterial('radial', 0.7, HORIZON.hot, HORIZON.deep)
  private readonly endStar = new THREE.Mesh(new THREE.CircleGeometry(0.7, 20, 0, Math.PI), this.endMat)

  // --- steam and the cinder (C6) ---
  /** Ms in the attack. */
  private atkT = 0
  /** A seeded stream for the gaps, and the one that picks the guess: the same fight gives the same rhythm (never Math.random). */
  private seed = 1
  private guessSeed = 7
  /** His last few answers to a lock (see judge). */
  readonly answers: number[] = []
  /** Ms until the next steam may be booked. */
  private steamIn = 0
  /** Ms out of the steam's reach (awake), and ms since the last cinder launched. */
  private outMs = 0
  private sinceCinder = Infinity
  /** The steam's aim while it tracks and locks, and where it points: Still's lead point (frozen at the lock). */
  private aim = 0
  readonly lead = new THREE.Vector3()
  private readonly gazeEnd = new THREE.Vector3()
  /** Still smoothed (the Arbiter's 90 ms), so one frame's hitch does not swing the aim. */
  private readonly vel = new THREE.Vector3()
  /** Still and his velocity at the lock, for the judge at the arm. */
  private readonly lockAt = new THREE.Vector3()
  private readonly lockVel = new THREE.Vector3()
  /** The jet's hazard and its line, from the lock; and how long its puffs go on after it fires. */
  private jet: Hazard | null = null
  jetSeg: { ax: number; az: number; bx: number; bz: number } | null = null
  private jetFx = 0
  private jetFired = false
  /** The cinder in the air: for its trail. */
  private flight: { h: Hazard; from: THREE.Vector3; to: THREE.Vector3; peak: number; armMs: number } | null = null
  private strikeTick = false
  private strikeKind: 'steam' | 'cinder' | null = null
  /** The steam's tracking: two rails closing on the jet's edges and a thin wash between (the Arbiter's lance, arbiter.ts). */
  private readonly gazeMat = tellMaterial('strip')
  private readonly gaze = new Quads(2, this.gazeMat)
  private readonly gazeWashMat = tellMaterial('strip')
  private readonly gazeWash = new Quads(1, this.gazeWashMat)
  /** The cinder's aim: a faint ring following his lead point (the Arbiter's shell ring). */
  private readonly cinderRingMat = tellMaterial('radial', ENGINE.cinder.r)
  private readonly cinderRing = new THREE.Mesh(new THREE.RingGeometry(ENGINE.cinder.r - 0.1, ENGINE.cinder.r, 48), this.cinderRingMat)

  // --- phase 2 (C7) ---
  /** Ms until the next reversal is due, and until a wagon may next be picked (Infinity in phase 1). */
  private reverseIn = Infinity
  private wagonIn = Infinity
  /** Phase 2's own seeded stream (phase 1's gaps and guesses never draw from it). */
  private phaseSeed = 13
  /** After a reversal it turns on the spot: the yaw still to turn, rad, running down to 0. */
  private spin = 0
  /** Junction counting for the windows starts this far past the nose that began the run (a lap at the start, a hair after a reversal). */
  private windowWait = 0
  /** The wagon's tell: the ram's lane with no rails (trackWash), down its spur. */
  readonly wagonTell = new LaneTell(WAGON_LOOK, { hot: HORIZON.hot, deep: HORIZON.deep })
  private readonly tub: THREE.Mesh
  /** Where the last wagon was smashed, for the chunks (dress); and the judder's first-frame burst. */
  private smashAt: { x: number; z: number } | null = null
  private judderBurst = false

  private readonly hide = hideMaterials('engine', { transparent: true })
  private readonly mat = this.hide.mat
  private readonly jointMat = this.hide.jointMat
  /** The firebox core: its light, which ignores the fog (the lights-out rule). CORE at most, never brighter. */
  private readonly coreMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  private readonly lampMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  /** The soft glow round the slits and round the headlamp: red, so the additive heart stays out of peach (signal.ts). */
  private readonly slitHalo = new THREE.SpriteMaterial({ map: haloTexture(), color: ENGINE.fireHot, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 })
  private readonly lampHalo = new THREE.SpriteMaterial({ map: haloTexture(), color: ENGINE.fireHot, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0 })
  private readonly doorPivot = new THREE.Group()
  /** The firebox's core, which swells a little as the door opens. */
  private readonly firebox = new THREE.Mesh(new THREE.BoxGeometry(FIREBOX.w, FIREBOX.h, 0.04), this.coreMat)
  private readonly chimney = new THREE.Object3D()
  readonly track: TrackDef

  constructor(readonly def: BossDef, x: number, z: number, _face: THREE.Vector3, track: TrackDef) {
    this.hp = def.hp
    this.track = track
    this.windowWait = track.loopLen
    this.wagonTell.trackWash = true
    const wk = wagonKit()
    this.tub = new THREE.Mesh(wk.tub, wk.grate)
    this.tub.visible = false
    // placed on the loop, going dir +1, facing its travel
    this.s = this.u = this.originBody = loopS(track, x, z)
    const at = loopAt(track, this.s)
    this.pos.set(at.x, 0, at.z)
    this.group.rotation.y = this.yaw()
    // as the ram's star (lane.ts): laid flat, yawed with the travel; its half-disc is the half toward the body
    this.endStar.rotation.order = 'YXZ'
    this.endStar.rotation.x = -Math.PI / 2
    this.endStar.visible = false
    this.ring.rotation.x = this.disc.rotation.x = -Math.PI / 2
    this.ring.visible = this.disc.visible = false
    this.cinderRing.rotation.x = -Math.PI / 2
    this.cinderRing.visible = false
    this.worldGroup.add(this.horizon.wash.mesh, this.horizon.rails.mesh, this.endStar, this.disc, this.ring, this.gazeWash.mesh, this.gaze.mesh, this.cinderRing, this.wagonTell.group, this.tub)

    // the crawl trains' engine, cloned (the shared geometry is never ours to dispose), its centre at the group's origin
    const kit = engineKit()
    const model = new THREE.Group()
    model.scale.setScalar(ENGINE.scale)
    model.position.z = (MODEL_LEN / 2) * ENGINE.scale
    const body = new THREE.Mesh(kit.engine.clone(), this.mat)
    // the cab's side slits are the core seen from the side
    const slits = new THREE.Mesh(kit.firebox.clone(), this.coreMat)
    // the firebox at the cab's back: the core, and its door hinged on the top edge (closed: the door hides it)
    const core = this.firebox
    core.position.set(0, FIREBOX.y, CAB_BACK - 0.02)
    this.doorPivot.position.set(0, FIREBOX.y + FIREBOX.door.h / 2, CAB_BACK - 0.06)
    const door = new THREE.Mesh(new THREE.BoxGeometry(FIREBOX.door.w, FIREBOX.door.h, 0.05), this.jointMat)
    door.position.y = -FIREBOX.door.h / 2
    this.doorPivot.add(door)
    this.chimney.position.set(0, CHIMNEY.y, CHIMNEY.z)
    // brass: two bands round the boiler, the dome, and the headlamp's housing
    const fittings = new THREE.Mesh(brassGeometry(), this.jointMat)
    // the lamp's lens, in the housing's mouth
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.02), this.lampMat)
    lens.position.set(0, LAMP.y, LAMP.z + 0.005)
    const halos = [-1, 1].map((side) => {
      const h = new THREE.Sprite(this.slitHalo)
      h.position.set(side * (SLIT.x + 0.04), SLIT.y, SLIT.z)
      h.scale.setScalar(1.0 / ENGINE.scale)
      return h
    })
    const lampGlow = new THREE.Sprite(this.lampHalo)
    lampGlow.position.set(0, LAMP.y, LAMP.z + 0.1)
    lampGlow.scale.setScalar(1.3 / ENGINE.scale)
    // seen with the door open from any side: a red glow behind the cab
    const boxGlow = new THREE.Sprite(this.fireHalo)
    boxGlow.position.set(0, FIREBOX.y, CAB_BACK - 0.3)
    boxGlow.scale.setScalar(2.2 / ENGINE.scale)
    model.add(body, fittings, slits, core, lens, this.doorPivot, this.chimney, ...halos, lampGlow, boxGlow)
    this.group.add(model)
    this.present(0)
  }


  /** Derailed: its ×1.5 window. */
  get open() { return this.state === 'derailed' }

  /** Kept out of it while it stands (pushOffBoss, combat's spacing); null while it moves. */
  get anchored(): number | null {
    switch (this.state) {
      case 'asleep': case 'unfold': case 'hold': case 'judder': case 'derailed': case 'dead': return ENGINE.radius
      default: return null
    }
  }

  /** The windup Combat announces (it reads this on the tick the phase turns 'windup'): the steam's 950, or the cinder's 620. */
  get windupMs() {
    return this.attack === 'cinderAim' ? ENGINE.cinder.windupMs : ENGINE.steam.trackMs + ENGINE.steam.lockMs
  }

  get cue(): BossCue {
    if (this.attack === 'cinderAim') return { voice: 'lob' }
    if (this.attack === 'steamTrack' || this.attack === 'steamLock') return { voice: 'windup' }
    return { voice: 'none' }
  }

  /**
   * The departure board under the bar's name (BOARD's words): the open window's side and "now", else the next window's side and the
   * whole seconds until it opens when that is 9 or fewer, else ''. The estimate is by the road left at full speed, so it holds still
   * while the engine stands.
   */
  board(): string {
    if (this.dead || !this.started) return ''
    const w = this.window
    if (w?.open) return `${BOARD[w.side]} · ${BOARD.now}`
    const j = this.nextEligible()
    if (!j || this.wagonBlocks(j.u) || this.dir * (this.laidTo - j.u) > 1e-6) return ''
    const secs = this.secondsToOpen(j.p)
    if (secs > 9) return ''
    return `${BOARD[j.arm.side]} · ${Math.max(1, Math.ceil(secs - 1e-9))}`
  }

  /** Always false: bosses can't be broken (SPEC §1.5.8). */
  interrupt(): false {
    return false
  }

  /** Where it stopped and the way it faced (its travel), for its husk. `pos` is the body's centre on the rails, never the judder's shake. */
  huskAt(): { x: number; z: number; yaw: number } {
    return { x: this.pos.x, z: this.pos.z, yaw: this.yaw() }
  }

  /** The jet's arm, or the cinder's launch. */
  landsIn(): number | null {
    const st = ENGINE.steam
    if (this.attack === 'steamTrack') return Math.max(0, st.trackMs + st.lockMs - this.atkT)
    if (this.attack === 'steamLock') return Math.max(0, st.lockMs - this.atkT)
    if (this.attack === 'cinderAim') return Math.max(0, ENGINE.cinder.windupMs - this.atkT)
    return null
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor * (this.open ? ENGINE.openMul : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      this.state = 'dead'
      // a dead engine leaves no wagon standing on its loop
      this.smashWagon()
      return true
    }
    return false
  }

  private go(state: EngineState) {
    this.state = state
    this.timer = 0
  }

  update(dt: number, _target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.timer += ms
    this.strikeTick = false
    this.steamIn -= ms
    this.sinceCinder += ms
    this.jetFx = Math.max(0, this.jetFx - ms)
    this.vel.lerp(ctx.playerVel, Math.min(1, ms / ARBITER.guess.smoothMs))
    this.bob += dt
    this.lastDt = dt
    this.flash = Math.max(0, this.flash - dt * 5)
    this.justPhase2 = false
    // phase 2 (C7): below 55% for one update the flag is up, and the reversal and wagon clocks start; then they run down
    if (this.phase2) {
      this.reverseIn -= ms
      if (!this.wagon) this.wagonIn -= ms
    } else if (this.started && !this.dead && this.hp < this.maxHp * ENGINE.phase2At) this.enterPhase2(ctx)
    // it looks at Still, never the decoy: every boss ignores the lure
    this.still.copy(ctx.player)
    // a cast threw the lever since the last tick (onCast has no ctx): its event
    if (this.throwEvent) {
      this.throwEvent = false
      ctx.emit({ kind: 'engine', e: this, what: 'throw', at: this.pos.clone(), side: this.window?.side })
    }
    switch (this.state) {
      case 'unfold':
        // the whistle at 0; the firebox lights; the horizon is laid as soon as it can be honest (INV-E2): 1.3 s before it moves
        if (!this.whistled) {
          this.whistled = true
          this.begin()
          ctx.emit({ kind: 'engine', e: this, what: 'whistle', at: this.pos.clone() })
        }
        this.lit = Math.min(1, this.timer / 600)
        this.lay(dt, ctx)
        if (this.timer >= ENGINE.unfoldMs - 1e-6) this.go('run')
        break
      case 'run':
        this.advance(dt)
        // the nose has met a settled wagon: it derails where it stands, and the wagon is smashed
        if (this.meetsWagon(ctx)) break
        this.tickWindow(dt, ctx)
        this.lay(dt, ctx)
        if (this.reverseDue()) this.startJudder(ctx)
        break
      case 'judder':
        // it stands and shudders; nothing is laid. Then it turns round and stands again while the new way is lit
        if (this.timer >= ENGINE.reverse.judderMs - 1e-6) {
          this.flip(ctx)
          // the way ahead is laid in this same update, as after backing out: its first strip is then made a full `lead` before the hold ends
          this.lay(dt, ctx)
        }
        break
      case 'siding': {
        // driving up the arm it was thrown into, to where its nose meets the buffer
        this.advance(dt)
        const b = this.branch!
        const stop = b.uJ + this.dir * (b.arm.len - TRACK.bufferR - ENGINE.length / 2)
        if (this.dir * (this.u - stop) >= -1e-9) this.derail(stop, ctx)
        this.lay(dt, ctx)
        break
      }
      case 'derailed':
        // open for its window; the way back is lit in the last 1300 ms of it (INV-E2)
        this.lay(dt, ctx)
        if (this.timer >= ENGINE.derailMs - 1e-6) {
          // off an arm it backs out; derailed at a wagon it is on the loop already and runs on
          if (this.branch) {
            this.go('backing')
            ctx.emit({ kind: 'engine', e: this, what: 'back', at: this.pos.clone(), side: this.branch.arm.side })
          } else this.go('run')
        }
        break
      case 'backing': {
        this.advance(dt)
        if (this.dir * (this.u - this.branch!.uJ) <= 1e-9) this.backedOut()
        this.lay(dt, ctx)
        break
      }
      case 'hold':
        this.lay(dt, ctx)
        if (this.timer >= ENGINE.lead * 1000 - 1e-6) this.go('run')
        break
      default:
        break
    }
    this.fight(dt, terrain, ctx)
    this.wagonStep(terrain, ctx)
    this.segs = this.segs.filter((g) => !g.h.done)
    // what Combat sees of it: a windup while it aims, a strike on the tick the jet arms or the cinder leaves, recover while derailed
    this.phase = this.strikeTick ? 'strike' : this.attack !== 'none' ? 'windup' : this.state === 'derailed' ? 'recover' : 'approach'
    this.present(dt)
    return null
  }

  private next() {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  // --- steam and the cinder (C6) ---

  /** The seeded gap to the next steam, ms. */
  private gap() {
    const [lo, hi] = ENGINE.steam.gapS
    return 1000 * (lo + (hi - lo) * this.next())
  }

  /** Not inside any of its not-done strips (lit, armed or live), grown by 0.42: a Still on its rail is its train's to hit. */
  private onLitPath(x: number, z: number) {
    return this.segs.some((g) => !g.h.done && inShape(g.h.spec.shape, x, z, 0.42))
  }

  /**
   * The attacks, overlaid on the run: the steam (booked in range, off its lit path, not behind it, a gap after the last) and the cinder
   * (booked once he has been out of the steam's reach long enough). The engine keeps moving through both. A tracking aim that the state
   * no longer allows (a derail) is dropped; a lock stands, its strip is made.
   */
  private fight(dt: number, terrain: Terrain, ctx: EnemyCtx) {
    const ms = dt * 1000
    if (this.dead || !this.started) {
      this.attack = 'none'
      return
    }
    const st = ENGINE.steam
    const still = ctx.player
    const dx = still.x - this.pos.x, dz = still.z - this.pos.z
    const d = Math.hypot(dx, dz)
    // out of reach: only ever awake (this runs from the unfold on), and it resets the moment he is within it
    this.outMs = d > st.range ? this.outMs + ms : 0
    this.atkT += ms
    const may = this.state === 'run' || this.state === 'hold' || this.state === 'judder' || this.state === 'siding' || this.state === 'backing'
    if (!may && (this.attack === 'steamTrack' || this.attack === 'cinderAim')) this.attack = 'none'
    switch (this.attack) {
      case 'none': {
        if (!may) break
        const fwdX = Math.sin(this.group.rotation.y), fwdZ = Math.cos(this.group.rotation.y)
        const behind = dx * fwdX + dz * fwdZ < -ENGINE.length / 2
        if (this.steamIn <= 0 && d <= st.range && !behind && !this.onLitPath(still.x, still.z) && ctx.canLock(st.trackMs + st.lockMs)) {
          ctx.book(this, st.trackMs + st.lockMs)
          this.steamIn = this.gap()
          this.attack = 'steamTrack'
          this.atkT = 0
          this.aim = Math.atan2(dx, dz)
          this.leadFor(still, (st.trackMs + st.lockMs) / 1000 * this.guess, st.leadMax)
          this.cutAt(this.aim, terrain, this.gazeEnd)
        } else if (this.outMs >= ENGINE.outrun.afterMs[this.phase2 ? 1 : 0] && this.sinceCinder >= ENGINE.outrun.cooldownMs
          && ctx.canLock(ENGINE.cinder.windupMs)) {
          ctx.book(this, ENGINE.cinder.windupMs)
          this.attack = 'cinderAim'
          this.atkT = 0
          this.cinderLead(still, terrain)
        }
        break
      }
      case 'steamTrack': {
        // the aim swings after his lead point no faster than the Arbiter's lance, and the rails show where it is pointed now
        const left = st.trackMs + st.lockMs - this.atkT
        this.leadFor(still, (left / 1000) * this.guess, st.leadMax)
        const turn = ARBITER.lance.turnRate * dt
        const want = Math.atan2(this.lead.x - this.pos.x, this.lead.z - this.pos.z)
        this.aim += Math.max(-turn, Math.min(turn, angleDiff(want, this.aim)))
        this.cutAt(this.aim, terrain, this.gazeEnd)
        if (this.atkT >= st.trackMs - 1e-6) {
          // the lock: the aim freezes, and the strip is committed where the engine stands now. Drawn = hit.
          const ax = this.pos.x, az = this.pos.z
          this.lockAt.copy(still)
          this.lockVel.copy(this.vel)
          this.attack = 'steamLock'
          this.atkT = 0
          this.jetFired = false
          const len = Math.hypot(this.gazeEnd.x - ax, this.gazeEnd.z - az)
          this.jetSeg = { ax, az, bx: this.gazeEnd.x, bz: this.gazeEnd.z }
          // a jet with nowhere to go (it stands against a wall) is not made
          this.jet = len < 0.3 ? null : ctx.addHazard?.(this, {
            source: 'steam', shape: { kind: 'strip', ax, az, bx: this.gazeEnd.x, bz: this.gazeEnd.z, halfW: st.halfW },
            armMs: st.lockMs, liveMs: st.liveMs, damage: st.damage, cover: 'none', hurt: 'hazard',
            owner: this, sparesOwner: true, cancelOnDeath: true, raise: ATTACK_Y,
          }) ?? null
        }
        break
      }
      case 'steamLock': {
        // the jet arms on the tick its hazard does (the strike phase): Combat's onStrike, our puffs, and what he did about it is judged
        const arming = this.jet ? this.jet.armIn <= ms + 1e-6 : this.atkT >= st.lockMs - ms - 1e-6
        if (arming && !this.jetFired) {
          this.jetFired = true
          this.strikeTick = true
          this.strikeKind = 'steam'
          this.jetFx = 350
          this.judge(still)
          ctx.emit({ kind: 'engine', e: this, what: 'steam', at: this.pos.clone() })
        }
        if (this.atkT >= st.lockMs - 1e-6) {
          this.attack = 'none'
          this.jet = null
        }
        break
      }
      case 'cinderAim': {
        this.cinderLead(still, terrain)
        if (this.atkT >= ENGINE.cinder.windupMs - 1e-6) {
          const c = ENGINE.cinder
          this.group.updateMatrixWorld(true)
          const from = this.chimney.getWorldPosition(new THREE.Vector3())
          const h = ctx.addHazard?.(this, {
            source: 'shell', shape: { kind: 'circle', x: this.lead.x, z: this.lead.z, r: c.r }, armMs: c.flightMs, liveMs: 0,
            damage: c.damage, cover: 'none', hurt: 'hazard', owner: this, sparesOwner: true,
            flight: { x: from.x, y: from.y, z: from.z, peak: c.peak }, raise: ATTACK_Y,
          })
          this.flight = h ? { h, from, to: this.lead.clone(), peak: c.peak, armMs: c.flightMs } : null
          this.attack = 'none'
          this.outMs = 0
          this.sinceCinder = 0
          this.strikeTick = true
          this.strikeKind = 'cinder'
          ctx.emit({ kind: 'engine', e: this, what: 'cinder', at: from })
        }
        break
      }
    }
  }

  /** Still's lead point: his smoothed velocity for `seconds` on, at most `cap` from him. */
  private leadFor(still: THREE.Vector3, seconds: number, cap: number) {
    let lx = this.vel.x * seconds, lz = this.vel.z * seconds
    const l = Math.hypot(lx, lz)
    if (l > cap) {
      lx *= cap / l
      lz *= cap / l
    }
    this.lead.set(still.x + lx, 0, still.z + lz)
  }

  /** The cinder's landing point: `leadS` of his velocity on (at most `leadMax`), stepped back toward the engine out of anything solid. */
  private cinderLead(still: THREE.Vector3, terrain: Terrain) {
    this.leadFor(still, ENGINE.cinder.leadS, ENGINE.cinder.leadMax)
    const bx = this.pos.x - this.lead.x, bz = this.pos.z - this.lead.z, bd = Math.hypot(bx, bz)
    for (let k = 0; k < 30 && bd > 0.01 && terrain.blocked(this.lead.x, this.lead.z, 0.01); k++) {
      this.lead.x += (bx / bd) * 0.5
      this.lead.z += (bz / bd) * 0.5
    }
  }

  /** The jet's cut: marched out from the engine's centre until the first solid in see mode (a barrier, a post, a crate; a breach lets it through) or `len`. */
  private cutAt(aim: number, terrain: Terrain, out: THREE.Vector3) {
    const dx = Math.sin(aim), dz = Math.cos(aim)
    let last = 0
    for (let s = CUT_STEP; s <= ENGINE.steam.len + 1e-9; s += CUT_STEP) {
      if (terrain.blocker(this.pos.x + dx * s, this.pos.z + dz * s, 0.1, true)) break
      last = s
    }
    return out.set(this.pos.x + dx * last, 0, this.pos.z + dz * last)
  }

  /**
   * At the arm: how far did his answer to the lock take him, against how far he'd have gone had he kept on? Kept going is 1, stopped 0,
   * turned back below. It remembers his last three answers and each steam guesses one of them (the Arbiter's, arbiter.ts judge, with
   * straight lines for angles). Standing still, or barely moving, tells it nothing, and the guess stands.
   */
  private judge(still: THREE.Vector3) {
    const wx = this.lockVel.x * (ENGINE.steam.lockMs / 1000), wz = this.lockVel.z * (ENGINE.steam.lockMs / 1000)
    const w2 = wx * wx + wz * wz
    if (Math.sqrt(w2) < ENGINE.guess.minMove) return
    const mx = still.x - this.lockAt.x, mz = still.z - this.lockAt.z
    this.answers.push(Math.max(-1, Math.min(1, (mx * wx + mz * wz) / w2)))
    if (this.answers.length > ENGINE.guess.memory) this.answers.shift()
    this.guessSeed = (this.guessSeed * 16807) % 2147483647
    this.guess = this.answers[Math.floor((this.guessSeed / 2147483647) * this.answers.length)]!
  }

  // --- the path ---

  /** The point at path u: on the loop, or (once past its junction, going out) on the arm it was thrown into. */
  private at(u: number): { x: number; z: number } {
    const b = this.branch
    if (b) {
      const d = this.dir * (u - b.uJ)
      if (d > 1e-9) {
        const a = b.arm, k = d / a.len
        return { x: a.junction.x + (a.buffer.x - a.junction.x) * k, z: a.junction.z + (a.buffer.z - a.junction.z) * k }
      }
    }
    const p = loopAt(this.track, u)
    return { x: p.x, z: p.z }
  }

  /** The body's yaw along its travel: the way the path runs between a step behind it and a step ahead, so a corner turns it smoothly. */
  private yaw(): number {
    const ahead = this.at(this.u + (this.dir * ENGINE.length) / 2), back = this.at(this.u - (this.dir * ENGINE.length) / 2)
    return Math.atan2(ahead.x - back.x, ahead.z - back.z)
  }

  /** The way its leading end moves along path u: dir going forward, the other way backing out. */
  private get mv(): 1 | -1 {
    return (this.dir * this.heading) as 1 | -1
  }

  /** The nose, in path u. */
  private get nose() {
    return this.u + (this.dir * ENGINE.length) / 2
  }

  /** The leading end, in path u: the nose going forward, the tail backing out. */
  private get leadEnd() {
    return this.u + (this.mv * ENGINE.length) / 2
  }

  private get speedNow() {
    return this.heading === 1 ? ENGINE.speed : ENGINE.backSpeed
  }

  /** Milliseconds until it moves: the rest of the unfold, the derail (it backs out after it), or the hold. */
  private get standMs() {
    switch (this.state) {
      case 'unfold': return Math.max(0, ENGINE.unfoldMs - this.timer)
      case 'derailed': return Math.max(0, ENGINE.derailMs - this.timer)
      case 'hold': return Math.max(0, ENGINE.lead * 1000 - this.timer)
      default: return 0
    }
  }

  /** The first strip starts at the nose: the horizon and the laps are counted from here. */
  private begin() {
    this.started = true
    this.originBody = this.u
    this.origin = this.laidTo = this.nose
    this.frontier = this.laidTo
    this.steamIn = this.gap()
  }

  /** Drives (or backs) along the path, and works out where it is: the loop, or an arm (s from its junction). */
  private advance(dt: number) {
    this.u += this.mv * this.speedNow * dt
    this.place()
  }

  private place() {
    const p = this.at(this.u)
    this.pos.set(p.x, 0, p.z)
    const b = this.branch
    const d = b ? this.dir * (this.u - b.uJ) : -1
    if (b && d > 1e-9) {
      this.path = b.arm
      this.s = d
    } else {
      const L = this.track.loopLen
      this.path = 'loop'
      this.s = ((this.u % L) + L) % L
    }
    if (!b) this.lap = Math.floor((this.dir * (this.u - this.originBody)) / this.track.loopLen + 1e-9)
  }

  /** A new hit set for the strips laid from now: on every change of path, direction or hold. */
  private newGroup() {
    this.groupObj = null
  }

  /** The vertex boundary next beyond `u` along `mv` (path u): a strip is straight, so it ends there; on an arm, at the buffer's face. */
  private edgeBeyond(u: number): number {
    const b = this.branch
    if (b && this.mv === this.dir && this.dir * (u - b.uJ) > -1e-9) return b.uJ + this.dir * (b.arm.len - TRACK.bufferR)
    const { loopLen: L, vertexS } = this.track
    // vertices are compared as absolute places, not against `u` folded into one lap: a `u` a hair under a whole lap (float noise on a value that
    // was itself laid to a vertex) folds to the end of the lap, where no vertex is ahead, and the "next" edge came out as `u` itself: a strip of no length, laid again and again
    const k0 = Math.floor(u / L)
    if (this.mv === 1) {
      for (const k of [k0, k0 + 1]) for (const v of vertexS) if (k * L + v > u + 1e-9) return k * L + v
      return (k0 + 2) * L
    }
    for (const k of [k0, k0 - 1]) for (let i = vertexS.length - 1; i >= 0; i--) if (k * L + vertexS[i]! < u - 1e-9) return k * L + vertexS[i]!
    return (k0 - 2) * L + vertexS[vertexS.length - 1]!
  }

  /**
   * INV-E1, the honest rail. A strip is laid when its start comes within lead (+ this tick) of the leading end in time, and it arms
   * when that end arrives: armMs is the time to the start (plus the time it stands still, INV-E2, plus the tick a new hazard loses).
   * So every strip is made at least 1300 ms before it arms, and the leading end never enters a point of track that is not in one of
   * its own armed strips. Strips split at loop vertices and are at most `segment` long. A window open for the junction the frontier
   * has reached is decided here: thrown, the frontier (and the engine) turn into the arm.
   */
  private lay(dt: number, ctx: EnemyCtx) {
    if (!ctx.addHazard || !this.started || this.dead) return
    const standS = this.standMs / 1000
    const speed = this.speedNow
    const mv = this.mv
    // a settled wagon on the loop ends the horizon at its near face (C7)
    let wf = this.wagonFace()
    for (let guard = 0; guard < 32; guard++) {
      const from = this.laidTo
      if (this.layEnd !== null && mv * (from - this.layEnd) > -1e-9) break
      if (wf !== null && mv * (from - wf) > -1e-9) break
      const ahead = mv * (from - this.leadEnd)
      if (ahead / speed + standS > ENGINE.lead + dt + LAY_HAIR) break
      if (this.window && Math.abs(from - this.winU) < 1e-6) {
        this.decide(ctx)
        // turned into an arm: the wagon is on the loop, not on this road
        wf = this.wagonFace()
      }
      let to = from + mv * ENGINE.segment
      const edge = this.edgeBeyond(from)
      if (mv * (edge - to) < SLIVER) to = edge
      if (this.layEnd !== null && mv * (to - this.layEnd) > 0) to = this.layEnd
      if (wf !== null && mv * (to - wf) > 0) to = wf
      // never a strip of no length (see edgeBeyond): nothing more can be laid from here
      if (mv * (to - from) < 1e-6) break
      const a = this.at(from), b = this.at(to)
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const dx = (b.x - a.x) / len, dz = (b.z - a.z) / len
      const lap = Math.floor((this.dir * (from - this.origin) + 1e-9) / this.track.loopLen)
      if (!this.groupObj || lap !== this.groupLap) {
        this.groupObj = {}
        this.groupLap = lap
        this.groupNo++
      }
      const armMs = 1000 * (ahead / speed + standS + dt)
      const spec: HazardSpec = {
        source: 'train',
        shape: { kind: 'strip', ax: a.x, az: a.z, bx: b.x, bz: b.z, halfW: ENGINE.halfW },
        armMs, liveMs: (1000 * (len + ENGINE.length)) / speed,
        damage: ENGINE.runDamage, cover: 'none', hurt: 'hazard', quiet: true, owner: this, sparesOwner: true, cancelOnDeath: true, endOnDeath: true,
        group: this.groupObj, shove: { dx, dz, along: LINE.shove.along, across: LINE.shove.across },
      }
      this.segs.push({
        id: this.nextId++, h: ctx.addHazard(this, spec), madeAt: ctx.now, armMs, group: this.groupNo,
        ax: a.x, az: a.z, bx: b.x, bz: b.z, u0: from, v: (mv * from) / UV_LEN, speed,
      })
      this.laidTo = to
    }
    this.frontier = this.laidTo
    // it stops at the buffer, or at the wagon's near face: the lit rail ends in the ram's end star
    if (this.branch && this.heading === 1 && this.layEnd !== null && mv * (this.laidTo - this.layEnd) > -1e-9 && this.frontierEnd !== 'buffer') {
      const p = this.at(this.layEnd), a = this.branch.arm
      this.markEnd('buffer', p.x, p.z, Math.atan2(a.buffer.x - a.junction.x, a.buffer.z - a.junction.z))
    } else if (wf !== null && mv * (this.laidTo - wf) > -1e-9) {
      if (this.frontierEnd !== 'wagon') {
        const p = loopAt(this.track, wf)
        this.markEnd('wagon', p.x, p.z, Math.atan2(mv * p.dx, mv * p.dz))
      }
    } else if (this.frontierEnd === 'wagon') this.markEnd('open')
  }

  // --- the levers (C5) ---

  /** The junctions of the arms it is taken through going `dir`, as offsets in dir * u (mod the loop), ascending. */
  private junctionOffsets(): { off: number; arm: TrackArm }[] {
    const { loopLen: L, vertexS } = this.track
    return this.track.arms
      .filter((a) => a.dir === this.dir)
      .map((arm) => ({ off: this.dir === 1 ? vertexS[arm.vertex]! : (L - vertexS[arm.vertex]!) % L, arm }))
      .sort((a, b) => a.off - b.off)
  }

  /**
   * The next junction a window opens for, as dir * u: junctions are counted from the first passed once lap 1 has ended (the nose's
   * first lap is over at origin + loopLen), and every `everyJunctions`-th one is the window's. The right and left junctions of one
   * direction alternate, so an odd count alternates the sides. Nothing before the one last decided, or behind the nose.
   */
  private nextEligible(): { p: number; u: number; arm: TrackArm } | null {
    const { loopLen: L } = this.track
    const offs = this.junctionOffsets()
    const pNose = this.dir * this.nose
    const pFrom = this.dir * this.origin + this.windowWait
    const count = (hi: number) => offs.reduce((n, o) => n + Math.max(0, Math.floor((hi - o.off) / L + 1e-9) - Math.ceil((pFrom - o.off) / L - 1e-9) + 1), 0)
    for (let k = Math.floor(pNose / L) - 1; k <= Math.floor(pNose / L) + 8; k++) {
      for (const o of offs) {
        const p = o.off + k * L
        if (p <= pNose + 1e-9 || p <= this.decided + 1e-6 || p < pFrom - 1e-9) continue
        if (count(p) % ENGINE.lever.everyJunctions === 0) return { p, u: this.dir * p, arm: o.arm }
      }
    }
    return null
  }

  /** Seconds until the window for the junction at dir * u = p opens, going forward at full speed from where the nose is. */
  private secondsToOpen(p: number): number {
    const ahead = p - this.dir * this.nose
    const layAhead = ENGINE.speed * (ENGINE.lead + this.lastDt + LAY_HAIR)
    return (ahead - layAhead) / ENGINE.speed - ENGINE.lever.windowMs / 1000
  }

  /** The window opens `windowMs` before the frontier reaches its junction (where it is decided); it runs on the road, so it stops with the engine. */
  private tickWindow(dt: number, ctx: EnemyCtx) {
    const w = this.window
    if (w) {
      if (w.open) w.msOpen += dt * 1000
      return
    }
    if (this.state !== 'run' || this.heading !== 1) return
    const j = this.nextEligible()
    if (!j || this.secondsToOpen(j.p) > 1e-9) return
    // the horizon has already gone past this junction (it was laid while the engine stood, after a derail at a wagon just short of it): the window
    // could never be honest, so the junction goes by without one and the count goes on
    if (this.dir * (this.laidTo - j.u) > 1e-6) {
      this.decided = j.p
      return
    }
    // a wagon (rolling or settled) nearer than the junction stops the horizon short of it: the window would never close
    if (this.wagonBlocks(j.u)) return
    this.window = { side: j.arm.side, arm: j.arm, open: true, thrown: false, msOpen: 0 }
    this.winU = j.u
    ctx.emit({ kind: 'engine', e: this, what: 'window', at: this.pos.clone(), side: j.arm.side })
  }

  /**
   * The frontier has reached the junction: the window closes, and thrown, everything turns into the arm. In phase 2 a window that closes
   * unthrown with Still standing in that arm's strip (grown by ENGINE.throwBack.grow) is thrown by the engine itself: its frontier is at
   * the junction now, so the arm is lit as far ahead as any rail.
   */
  private decide(ctx: EnemyCtx) {
    const w = this.window!
    this.decided = this.dir * this.winU
    this.window = null
    if (!w.thrown) {
      if (!this.phase2 || !this.stillInArm(w.arm)) return
      ctx.emit({ kind: 'engine', e: this, what: 'throwBack', at: this.pos.clone(), side: w.arm.side })
    }
    this.branch = { uJ: this.winU, arm: w.arm }
    this.layEnd = this.winU + this.dir * (w.arm.len - TRACK.bufferR)
    this.newGroup()
    this.go('siding')
  }

  /** From main.cast(), after a cast that wasn't refused: throws the open lever if Still stood within reach of it. */
  onCast(at: THREE.Vector3): boolean {
    const w = this.window
    if (!w || !w.open || w.thrown || this.state !== 'run') return false
    const lv = this.track.levers[w.side]
    if (Math.hypot(at.x - lv.x, at.z - lv.z) > ENGINE.lever.reach) return false
    w.thrown = true
    this.throwEvent = true
    return true
  }

  /** Its nose has met the buffer: derailed in place (open, x1.5); the way back out is lit in the last 1300 ms of it. */
  private derail(stop: number, ctx: EnemyCtx) {
    const b = this.branch!
    this.u = stop
    this.heading = -1
    this.place()
    this.go('derailed')
    this.layEnd = b.uJ - this.dir * (ENGINE.length / 2)
    this.laidTo = this.leadEnd
    this.frontier = this.laidTo
    this.newGroup()
    this.markEnd('open')
    ctx.emit({ kind: 'engine', e: this, what: 'derail', at: this.pos.clone(), side: b.arm.side })
  }

  /** Backed to the junction: it stands 1300 ms with the loop lit ahead of it (INV-E2), then runs on, the same way round. */
  private backedOut() {
    const b = this.branch!
    this.u = b.uJ
    this.branch = null
    this.heading = 1
    this.place()
    this.layEnd = null
    this.laidTo = this.nose
    this.frontier = this.laidTo
    this.newGroup()
    this.go('hold')
  }

  // --- phase 2 (C7) ---

  /** Phase 2's seeded stream (never Math.random: the same fight gives the same rhythm). */
  private nextPhase() {
    this.phaseSeed = (this.phaseSeed * 16807) % 2147483647
    return this.phaseSeed / 2147483647
  }

  /** The seeded gap to the next reversal, ms. */
  private reverseGap() {
    const [lo, hi] = ENGINE.reverse.everyS
    return 1000 * (lo + (hi - lo) * this.nextPhase())
  }

  /** Below 55%: the flag for this one update, the event, and the reversal and wagon clocks. */
  private enterPhase2(ctx: EnemyCtx) {
    this.phase2 = true
    this.justPhase2 = true
    this.reverseIn = this.reverseGap()
    this.wagonIn = ENGINE.wagon.firstS * 1000
    ctx.emit({ kind: 'engine', e: this, what: 'phase2', at: this.pos.clone() })
  }

  /** Still's centre inside the arm's strip (junction to buffer, halfW) grown by the thrown-back reach. */
  private stillInArm(arm: TrackArm): boolean {
    const ux = (arm.buffer.x - arm.junction.x) / arm.len, uz = (arm.buffer.z - arm.junction.z) / arm.len
    const dx = this.still.x - arm.junction.x, dz = this.still.z - arm.junction.z
    const along = dx * ux + dz * uz, across = Math.abs(dx * uz - dz * ux)
    return along >= 0 && along <= arm.len && across <= ENGINE.halfW + ENGINE.throwBack.grow
  }

  /**
   * A reversal is due and may start: in `run` on the loop, no window open (one open is never cut: it waits for the window to close), no
   * steam or cinder in the air, and no wagon rolling (a settled one is fine, unless it stands beside it).
   */
  private reverseDue(): boolean {
    if (!this.phase2 || this.reverseIn > 0 || this.state !== 'run' || this.heading !== 1 || this.branch || this.window || this.attack !== 'none') return false
    const w = this.wagon
    if (!w) return true
    return w.stage === 'settled' && Math.hypot(w.x - this.pos.x, w.z - this.pos.z) >= ENGINE.wagon.clear
  }

  /**
   * The judder: it stands, and every strip of its own that has not armed is taken back (the ones it is on stay live), so nothing it lit
   * for the way it was going can arm while it stands. Nothing is laid until it has turned.
   */
  private startJudder(ctx: EnemyCtx) {
    ctx.takeBack?.(this, (h) => h.spec.source === 'train')
    this.laidTo = this.frontier = this.nose
    this.markEnd('open')
    this.go('judder')
    this.judderBurst = true
    ctx.emit({ kind: 'engine', e: this, what: 'judder', at: this.pos.clone(), ms: ENGINE.reverse.judderMs })
  }

  /** It turns round on the spot and stands `lead` while the loop the other way is lit (INV-E2); the windows count from here, on the other arms. */
  private flip(ctx: EnemyCtx) {
    this.dir = (this.dir === 1 ? -1 : 1) as 1 | -1
    this.heading = 1
    this.originBody = this.u
    this.origin = this.laidTo = this.nose
    this.frontier = this.laidTo
    this.windowWait = WINDOW_EPS
    this.decided = -Infinity
    this.window = null
    this.layEnd = null
    this.newGroup()
    this.markEnd('open')
    this.place()
    this.spin = Math.PI
    this.reverseIn = this.reverseGap()
    this.go('hold')
    ctx.emit({ kind: 'engine', e: this, what: 'flip', at: this.pos.clone() })
  }

  // --- the loose wagon (C7) ---

  /**
   * The wagon's near face, in path u: of its two ends, the one the leading end reaches first going `mv`, taken at the image of the loop
   * nearest the leading end (a tick's overshoot still finds the face it just met, not the one a lap on).
   */
  private faceNear(mv: 1 | -1, ref: number): number | null {
    const w = this.wagon
    if (!w) return null
    const L = this.track.loopLen
    const sFace = w.s - mv * ENGINE.wagon.halfLen
    const r = ref - mv
    const k = mv === 1 ? Math.ceil((r - sFace) / L - 1e-9) : Math.floor((r - sFace) / L + 1e-9)
    return sFace + k * L
  }

  /** Where the lit horizon must end, going the way it goes: a settled wagon's near face; null off the loop or with none. */
  private wagonFace(): number | null {
    const w = this.wagon
    if (!w || w.stage !== 'settled' || this.branch) return null
    return this.faceNear(this.mv, this.leadEnd)
  }

  /** A wagon (in its tell, rolling or settled) stands on the loop nearer the nose than the junction at dir * u = uJ. */
  private wagonBlocks(uJ: number): boolean {
    if (!this.wagon || this.branch) return false
    const f = this.faceNear(this.dir, this.nose)
    return f !== null && this.dir * (f - this.nose) < this.dir * (uJ - this.nose)
  }

  /** The nose has met a settled wagon: it derails where it stands (open, x1.5), the wagon smashed, and the way on is lit in the last 1300 ms of it. */
  private meetsWagon(ctx: EnemyCtx): boolean {
    const wf = this.wagonFace()
    if (wf === null || this.mv * (this.nose - wf) < -1e-9) return false
    this.u = wf - (this.dir * ENGINE.length) / 2
    this.place()
    this.go('derailed')
    this.laidTo = this.frontier = this.nose
    this.layEnd = null
    this.newGroup()
    ctx.emit({ kind: 'engine', e: this, what: 'derail', at: this.pos.clone() })
    const at = this.smashWagon()
    if (at) ctx.emit({ kind: 'engine', e: this, what: 'wagonSmash', at })
    return true
  }

  /** The wagon's life, once a tick: picked when due, its tell, the roll, settling on the loop. */
  private wagonStep(terrain: Terrain, ctx: EnemyCtx) {
    if (this.dead || !this.started) return
    const wg = this.wagon
    if (!wg) {
      const may = this.state === 'run' || this.state === 'hold'
      if (this.phase2 && this.wagonIn <= 0 && may && !this.branch && this.heading === 1 && !this.window) this.pickWagon(ctx)
      return
    }
    if (wg.stage === 'tell') {
      if (wg.h.armIn > 1e-6) return
      wg.stage = 'roll'
    }
    if (wg.stage === 'roll') {
      const k = Math.min(1, Math.max(0, 1 - wg.h.liveLeft / Math.max(1, wg.h.spec.liveMs)))
      wg.x = wg.ox + wg.ux * wg.len * k
      wg.z = wg.oz + wg.uz * wg.len * k
      if (wg.h.done || wg.h.liveLeft <= 1e-6) this.settleWagon(terrain, ctx)
    }
  }

  /**
   * When one is due and it can be honest: the spur whose end on the loop is at least speed × (lead + tell + roll) ahead of the nose (33.8 u
   * at 11 u/s) along its way, and of those the one farther from Still; none: it waits. A wagon is also never picked with a window open.
   */
  private pickWagon(ctx: EnemyCtx) {
    if (!ctx.addHazard) return
    const t = this.track, w = ENGINE.wagon, L = t.loopLen
    let best = -1, bestD = -1
    t.spurs.forEach((sp, i) => {
      const len = Math.hypot(sp.onLoop.x - sp.outer.x, sp.onLoop.z - sp.outer.z)
      const need = ENGINE.speed * (ENGINE.lead + (w.tellMs + (1000 * len) / w.speed) / 1000)
      const ahead = ((this.dir * (loopS(t, sp.onLoop.x, sp.onLoop.z) - this.nose)) % L + L) % L
      if (ahead < need) return
      const d = distToSpur(sp.outer, sp.onLoop, this.still.x, this.still.z)
      if (d > bestD) { bestD = d; best = i }
    })
    if (best < 0) return
    const sp = t.spurs[best]!
    const len = Math.hypot(sp.onLoop.x - sp.outer.x, sp.onLoop.z - sp.outer.z)
    const ux = (sp.onLoop.x - sp.outer.x) / len, uz = (sp.onLoop.z - sp.outer.z) / len
    const s = loopS(t, sp.onLoop.x, sp.onLoop.z)
    const straight = loopAt(t, s)
    // one strip down the spur, armed at the end of the tell and live for the roll; its whole drawing is the LaneTell
    const h = ctx.addHazard(this, {
      source: 'wagon', shape: { kind: 'strip', ax: sp.outer.x, az: sp.outer.z, bx: sp.onLoop.x, bz: sp.onLoop.z, halfW: w.halfW },
      armMs: w.tellMs, liveMs: (1000 * len) / w.speed, damage: w.damage, cover: 'none', hurt: 'hazard', quiet: true,
      owner: this, sparesOwner: true, cancelOnDeath: true, endOnDeath: true,
    })
    this.wagon = {
      spur: best, x: sp.outer.x, z: sp.outer.z, settled: false, circles: [], stage: 'tell',
      ox: sp.outer.x, oz: sp.outer.z, lx: sp.onLoop.x, lz: sp.onLoop.z, len, ux, uz, s, sx: straight.dx, sz: straight.dz, h,
    }
    ctx.emit({ kind: 'engine', e: this, what: 'wagon', at: new THREE.Vector3(sp.outer.x, 0, sp.outer.z) })
  }

  /** The roll is over: it stands on the loop, two solid circles along the straight, and the horizon ends at its near face. */
  private settleWagon(terrain: Terrain, ctx: EnemyCtx) {
    const wg = this.wagon!, w = ENGINE.wagon
    wg.stage = 'settled'
    wg.settled = true
    wg.x = wg.lx
    wg.z = wg.lz
    for (const sign of [-1, 1]) {
      const c: Circle = { x: wg.lx + sign * w.at * wg.sx, z: wg.lz + sign * w.at * wg.sz, r: w.r }
      terrain.add(c)
      wg.circles.push(c)
    }
    // whatever it had lit that starts past the wagon's face and has not armed is taken back (a strip that straddles the face stays: it was made in time)
    const wf = this.wagonFace()
    if (wf !== null) {
      const mv = this.mv
      ctx.takeBack?.(this, (h) => {
        const g = this.segs.find((x) => x.h === h)
        return !!g && mv * (g.u0 - wf) >= -1e-9
      })
      if (mv * (this.laidTo - wf) > 0) this.laidTo = this.frontier = wf
    }
    ctx.emit({ kind: 'engine', e: this, what: 'wagonSettle', at: new THREE.Vector3(wg.x, 0, wg.z) })
  }

  /** Gone (smashed by the engine, or with it): its circles stop being solid, and the next is 14 s off. Returns where it stood. */
  private smashWagon(): THREE.Vector3 | null {
    const wg = this.wagon
    if (!wg) return null
    for (const c of wg.circles) c.dead = true
    const at = new THREE.Vector3(wg.x, 0, wg.z)
    if (wg.stage === 'settled') this.smashAt = { x: wg.x, z: wg.z }
    this.tub.visible = false
    this.wagon = null
    this.wagonIn = ENGINE.wagon.everyS * 1000
    if (this.frontierEnd === 'wagon') this.markEnd('open')
    return at
  }

  /** For the checks (main.ts __engineSegs): its own hazards, with the clocks Combat keeps. */
  segments() {
    return this.segs.map((g) => ({
      id: g.id, madeAt: g.madeAt, armMs: g.armMs, armIn: g.h.armIn, liveLeft: g.h.liveLeft, done: g.h.done, source: g.h.spec.source,
      shape: { ...g.h.spec.shape }, damage: g.h.spec.damage, group: g.group,
    }))
  }

  /** The horizon stops here (a buffer, a settled wagon): the tell ends in the ram's end star, the half-disc toward the body. */
  markEnd(kind: 'open' | 'buffer' | 'wagon', x = 0, z = 0, yaw = 0) {
    this.frontierEnd = kind
    this.endMark = kind === 'open' ? null : { x, z, yaw }
  }

  /** Committed ends for the camera: where the lit horizon ends. */
  threats(out: THREE.Vector3[]) {
    if (this.dead || this.asleep || !this.started) return
    if (this.segs.length > 0) {
      const p = this.at(this.laidTo)
      out.push(new THREE.Vector3(p.x, 0, p.z))
    }
    // the wagon's landing on the loop while its tell runs
    if (this.wagon && this.wagon.stage !== 'settled') out.push(new THREE.Vector3(this.wagon.lx, 0, this.wagon.lz))
    // and the steam's end (tracking, then locked), the cinder's landing while it is aimed
    if (this.attack === 'steamTrack') out.push(this.gazeEnd.clone())
    else if (this.attack === 'steamLock' && this.jetSeg) out.push(new THREE.Vector3(this.jetSeg.bx, 0, this.jetSeg.bz))
    else if (this.attack === 'cinderAim') out.push(this.lead.clone())
  }

  /** Smoke from the stack while it is awake. */
  dress(vfx: Vfx) {
    if (this.asleep || this.dead) return
    this.dressN++
    this.group.updateMatrixWorld(true)
    // the whistle: a burst of steam from the stack for the first 400 ms of the unfold, then its smoke
    if (this.state === 'unfold' && this.timer < 400) vfx.smokePuff(this.chimney.getWorldPosition(new THREE.Vector3()), 4, STEAM)
    else if (this.dressN % 2 === 0) vfx.smokePuff(this.chimney.getWorldPosition(new THREE.Vector3()), 1, SOOT)
    // the judder throws sparks off the wheels; a smashed wagon flies apart
    if (this.state === 'judder') this.judderSparks(vfx)
    if (this.smashAt) {
      const at = new THREE.Vector3(this.smashAt.x, 0.5, this.smashAt.z)
      vfx.chunks(at, 16, TUB_IRON, 6, 0.16)
      vfx.dust(at, 12, 1.4, undefined, 4)
      vfx.smokePuff(at, 3)
      this.smashAt = null
    }
    // the jet goes on billowing for a beat after it fires; a cinder in the air sheds embers and a thread of smoke
    if (this.jetFx > 0 && this.jetSeg) {
      const j = this.jetSeg
      vfx.jet(j.ax, j.az, j.bx, j.bz, ENGINE.steam.halfW, 6, STEAM, 2)
    }
    const f = this.flight
    if (f && !f.h.done && f.h.armIn > 0) {
      const k = Math.min(1, Math.max(0, 1 - f.h.armIn / f.armMs))
      const at = new THREE.Vector3(f.from.x + (f.to.x - f.from.x) * k, f.from.y * (1 - k) + 4 * f.peak * k * (1 - k), f.from.z + (f.to.z - f.from.z) * k)
      vfx.embers(at, 1, 0.08, FIRE)
      if (this.dressN % 2 === 0) vfx.smokePuff(at, 1)
    } else this.flight = null
  }

  /**
   * The judder's sparks, off the wheels sideways and back (vfx.hotSparks: deep red to orange, flickering, short-lived): a burst as it
   * starts to shake, then a few from the six wheels at every dressing (about 11 a second) while it stands.
   */
  private judderSparks(vfx: Vfx) {
    const first = this.judderBurst
    this.judderBurst = false
    const n = first ? JUDDER.burst * 6 : JUDDER.perDress
    const yaw = this.group.rotation.y
    const wheels = [0.98, 0.06, -0.86]
    const at = new THREE.Vector3(), dir = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
      const side = first ? (i % 2 ? 1 : -1) : Math.random() < 0.5 ? -1 : 1
      const z = wheels[first ? i % 3 : Math.floor(Math.random() * 3)]!
      this.group.localToWorld(at.set(side * 0.66, 0.28, z))
      dir.set(Math.cos(yaw) * side, 0, -Math.sin(yaw) * side)
      vfx.hotSparks(at, 1, first ? 7 : 5.5, dir, 0.7)
    }
  }

  /** The tick the jet arms: a burst of steam down the strip. The tick the cinder leaves: the stack coughs smoke and embers. */
  strikeFx(vfx: Vfx) {
    if (this.strikeKind === 'steam' && this.jetSeg) {
      const j = this.jetSeg
      vfx.jet(j.ax, j.az, j.bx, j.bz, ENGINE.steam.halfW, 36, STEAM, 4)
    } else if (this.strikeKind === 'cinder') {
      this.group.updateMatrixWorld(true)
      const at = this.chimney.getWorldPosition(new THREE.Vector3())
      vfx.smokePuff(at, 3)
      vfx.embers(at, 6, 0.15, FIRE)
    }
  }

  // --- presentation ---

  private present(dt: number) {
    // the firebox and the headlamp: a banked coal asleep, a deep red awake that flickers, and only ever dips (never lighter than CORE).
    // Derailed, the door stands open and the flicker is quick and deep: the core swings between a deep coal and fireHot.
    const lit = this.asleep ? 0 : this.lit
    this.door += ((this.state === 'derailed' ? 1 : 0) - this.door) * Math.min(1, dt * 10)
    const wander = 0.5 + 0.5 * Math.sin(this.bob * 1.3)
    this.flick += dt * (FLICKER.hz + (ENGINE.flickerHz - FLICKER.hz) * (wander + (1 - wander) * this.door))
    const depth = FLICKER.depth + (0.65 - FLICKER.depth) * this.door
    const dip = lit * depth * (0.5 + 0.5 * Math.sin(Math.PI * 2 * this.flick))
    this.coreMat.color.setHex(CORE_ASLEEP).lerp(FIRE, lit).multiplyScalar(1 - dip)
    // the lamp is steadier: a third of the dip
    this.lampMat.color.setHex(CORE_ASLEEP).lerp(FIRE, lit).multiplyScalar(1 - dip / 3)
    this.slitHalo.opacity = 0.6 * lit * (1 - dip)
    this.lampHalo.opacity = 0.5 * lit * (1 - dip / 3)
    this.fireHalo.opacity = 0.6 * lit * this.door * (1 - dip)
    this.doorPivot.rotation.x = this.door * 1.2
    this.firebox.scale.setScalar(1 + 0.8 * this.door)
    // the body: lamp-black enamel, dimmed asleep, the hit flash over it
    for (const [m, base] of [[this.mat, HIDES.engine.body], [this.jointMat, HIDES.engine.joint]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.5)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(WHITE, this.flash * 0.5)
      m.emissive.setRGB(this.flash * 0.4, this.flash * 0.15, this.flash * 0.1)
    }
    // the judder shudders the body (the hazards and the checks read `pos`, never this); a reversal's turn runs down after it
    this.clock += dt
    const shake = this.state === 'judder' ? Math.min(1, this.timer / 120) : 0
    this.spin = Math.max(0, this.spin - (dt * Math.PI) / JUDDER.turnS)
    this.group.position.set(
      this.pos.x + shake * JUDDER.shake * Math.sin(this.clock * JUDDER.hz * 6.2832),
      0,
      this.pos.z + shake * JUDDER.shake * Math.sin(this.clock * JUDDER.hz * 5.3 + 1.3),
    )
    this.group.rotation.y = this.yaw() + this.spin + shake * JUDDER.yaw * Math.sin(this.clock * JUDDER.hz * 4.4)
    this.drawHorizon()
    this.drawWagon(dt)
    this.drawWindow(dt)
    this.drawAim(dt)
    // behind it from the camera (which looks from +x +z), he'd be lost: its solid parts thin out until he's clear
    const bx = this.still.x - this.pos.x
    const bz = this.still.z - this.pos.z
    const along = -(bx + bz) * Math.SQRT1_2
    const across = Math.abs(bx - bz) * Math.SQRT1_2
    const behind = along > 0 && along < ENGINE.seeThrough.reach && across < ENGINE.seeThrough.half
    this.fade += ((behind ? ENGINE.seeThrough.opacity : 1) - this.fade) * Math.min(1, dt * 8 || 1)
    for (const m of [this.mat, this.jointMat]) {
      m.opacity = this.fade
      m.depthWrite = this.fade > 0.99
    }
  }

  /**
   * Its drawing is its own hazards (drawn = hit): every strip not done, as the Line draws a train's rails, dimming continuously with the
   * time a point has left to arm, with a slow flicker over all of it and a swell running the way it goes.
   */
  private drawHorizon() {
    const list = !this.asleep && !this.dead ? this.segs.filter((g) => !g.h.done) : []
    // it only ever dips, like the firebox: a slow wander and a quicker shimmer
    const flick = 1 - 0.18 * (0.5 + 0.5 * Math.sin(this.clock * 2 * Math.PI * 2.3)) - 0.1 * (0.5 + 0.5 * Math.sin(this.clock * 2 * Math.PI * 7.1 + 1.7))
    this.horizon.set(list, flick)
    const e = this.endMark
    this.endStar.visible = !!e && !this.dead
    if (e) {
      this.endStar.position.set(e.x, RAIL_TOP + 0.006, e.z)
      this.endStar.rotation.y = e.yaw
      this.endMat.opacity = 0.85 * flick
      this.endStar.renderOrder = tellOrder(0) + 0.3
    }
  }

  /**
   * The steam's tracking, drawn as the Arbiter's lance is (arbiter.ts present): two faint rails closing from a wide gaze onto the
   * jet's edges and a thin wash between, brightening as the lock comes, from the engine to where it is pointed now; it gives way to
   * the hazard's own chevrons at the lock. The cinder's aim is the shell ring following his lead point.
   */
  private drawAim(dt: number) {
    const st = ENGINE.steam
    if (this.attack === 'steamTrack') {
      const f = Math.min(1, this.atkT / st.trackMs)
      const wide = st.halfW + 0.9
      const half = wide + (st.halfW - 0.04 - wide) * f
      const nx = Math.cos(this.aim), nz = -Math.sin(this.aim)
      const ax = this.pos.x, az = this.pos.z, bx = this.gazeEnd.x, bz = this.gazeEnd.z
      for (const [i, side] of [[0, -1], [1, 1]] as const) {
        this.gaze.set(i, ax + nx * half * side, az + nz * half * side, bx + nx * half * side, bz + nz * half * side, 0.04, ATTACK_Y + 0.004)
      }
      this.gazeWash.set(0, ax, az, bx, bz, half, ATTACK_Y)
      this.gazeMat.opacity = (0.25 + 0.45 * f) * trackingDim()
      this.gazeWashMat.opacity = 0.06 + 0.1 * f
    } else {
      this.gazeMat.opacity = Math.max(0, this.gazeMat.opacity - dt * 10)
      this.gazeWashMat.opacity = Math.max(0, this.gazeWashMat.opacity - dt * 10)
    }
    const order = tellOrder(this.attack === 'steamTrack' ? st.trackMs + st.lockMs - this.atkT : 2000)
    this.gaze.mesh.visible = this.gazeMat.opacity > 0.002
    this.gazeWash.mesh.visible = this.gazeWashMat.opacity > 0.002
    this.gazeWash.mesh.renderOrder = order + 0.05
    this.gaze.mesh.renderOrder = order + 0.1
    this.cinderRingMat.opacity = this.attack === 'cinderAim' ? 0.16 * trackingDim() : Math.max(0, this.cinderRingMat.opacity - dt * 8)
    this.cinderRing.visible = this.cinderRingMat.opacity > 0.002
    this.cinderRing.position.set(this.lead.x, ATTACK_Y, this.lead.z)
    this.cinderRing.renderOrder = tellOrder(this.attack === 'cinderAim' ? ENGINE.cinder.windupMs - this.atkT : 2000)
  }

  /**
   * The wagon: its tub (waiting at the spur's outer end through the tell, rolling in, then settled across the loop) and its tell, the
   * ram's lane down the spur with no rails (trackWash): faint chevrons first, then locked and filling to the roll, ending in a star on the loop.
   */
  private drawWagon(dt: number) {
    const wg = this.wagon
    const w = ENGINE.wagon
    this.tub.visible = !!wg && !this.dead
    const base = { coreHalf: WAGON_TELL.coreHalf, hitHalf: w.halfW, bodyR: 0, end: 'prop' as const }
    if (!wg) {
      this.wagonTell.update(dt, { ...base, stage: 'off', x: 0, z: 0, aim: 0, len: 0, fill: 0, from: 0 })
      return
    }
    const aim = Math.atan2(wg.ux, wg.uz)
    if (wg.stage === 'tell') {
      const f = Math.min(1, Math.max(0, 1 - wg.h.armIn / w.tellMs))
      const locked = f >= WAGON_TELL.trackFrac
      this.wagonTell.update(dt, {
        ...base, stage: locked ? 'locked' : 'tracking', x: wg.ox, z: wg.oz, aim, len: wg.len,
        fill: locked ? (f - WAGON_TELL.trackFrac) / (1 - WAGON_TELL.trackFrac) : 0, from: 0,
        dim: locked ? 1 : trackingDim(), order: tellOrder(Math.max(0, wg.h.armIn)),
      })
    } else if (wg.stage === 'roll') {
      const k = Math.min(1, Math.max(0, Math.hypot(wg.x - wg.ox, wg.z - wg.oz) / wg.len))
      this.wagonTell.update(dt, { ...base, stage: 'rush', x: wg.x, z: wg.z, aim, len: wg.len * (1 - k), fill: 1, from: wg.len * k, order: tellOrder(0) })
    } else this.wagonTell.update(dt, { ...base, stage: 'off', x: wg.x, z: wg.z, aim, len: 0, fill: 0, from: 0 })
    // over the sleepers, as the steam's and the horizon's are
    this.wagonTell.group.position.y = ATTACK_Y
    // the tub: along the spur while it rolls, turning across the loop as it comes to rest
    let yaw = aim
    if (wg.stage !== 'tell') {
      let d = angleDiff(Math.atan2(wg.sx, wg.sz), aim)
      if (d > Math.PI / 2) d -= Math.PI
      else if (d < -Math.PI / 2) d += Math.PI
      const k = wg.stage === 'settled' ? 1 : Math.min(1, Math.hypot(wg.x - wg.ox, wg.z - wg.oz) / wg.len)
      const t = Math.min(1, Math.max(0, (k - WAGON_TELL.settleFrom) / (1 - WAGON_TELL.settleFrom)))
      yaw = aim + d * t * t * (3 - 2 * t)
    }
    this.tub.position.set(wg.x, 0, wg.z)
    this.tub.rotation.y = yaw
  }

  /** The window's ring and disc on the floor, and the levers turning: the open one's knob bright, a thrown one over. */
  private drawWindow(dt: number) {
    const w = this.window
    const show = !!w && w.open && !w.thrown && !this.dead
    this.ring.visible = this.disc.visible = show
    if (show) {
      const lv = this.track.levers[w.side]
      const k = Math.min(1, w.msOpen / 150)
      const left = Math.max(0.001, 1 - w.msOpen / ENGINE.lever.windowMs)
      for (const m of [this.ring, this.disc]) {
        m.position.set(lv.x, RAIL_TOP + 0.02, lv.z)
        m.renderOrder = tellOrder(0) + 0.4
      }
      this.disc.scale.setScalar(left)
      this.ringMat.opacity = 0.9 * k
      this.discMat.opacity = 0.24 * k
    }
    const scene = this.worldGroup.parent
    for (const side of ['right', 'left'] as const) {
      let lv = this.levers[side]
      if (!lv && scene && ++this.searchN % 20 === 1) lv = this.levers[side] = scene.getObjectByName(`lever:${side}`) ?? null
      if (!lv) continue
      const thrown = (w?.side === side && w.thrown) || this.branch?.arm.side === side
      const open = w?.side === side && w.open && !w.thrown
      this.leverAng[side] += ((thrown ? LEVER.thrown : LEVER.rest) - this.leverAng[side]) * Math.min(1, dt * LEVER.rate)
      const pivot = lv.getObjectByName('pivot')
      if (pivot) pivot.rotation.z = this.leverAng[side]
      const target = open ? 0.75 + 0.25 * Math.sin(this.clock * 9) : thrown ? 0.45 : 0
      this.leverGlow[side] += (target - this.leverGlow[side]) * Math.min(1, dt * 10)
      const ud = lv.userData as { knob?: THREE.MeshStandardMaterial; halo?: THREE.SpriteMaterial }
      // blue at its brightest, never white
      if (ud.knob) ud.knob.emissiveIntensity = 0.4 + 0.6 * this.leverGlow[side]
      if (ud.halo) ud.halo.opacity = 0.3 + 0.45 * this.leverGlow[side]
    }
  }

  idle(dt: number, _face: THREE.Vector3) {
    this.bob += dt
    this.flash = Math.max(0, this.flash - dt * 5)
    this.present(dt)
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    if (!asleep && this.state === 'asleep') {
      this.flash = 1
      this.go('unfold')
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group, this.tellGroup, this.worldGroup)
    // its geometry is cloned from the trains' (line.ts engineKit), so it is this body's own to free
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    for (const m of [this.mat, this.jointMat, this.coreMat, this.lampMat, this.slitHalo, this.lampHalo, this.fireHalo]) m.dispose()
    this.horizon.dispose()
    this.ring.geometry.dispose()
    this.disc.geometry.dispose()
    releaseTell(this.ringMat)
    releaseTell(this.discMat)
    this.endStar.geometry.dispose()
    releaseTell(this.endMat)
    this.gaze.dispose()
    this.gazeWash.dispose()
    releaseTell(this.gazeMat)
    releaseTell(this.gazeWashMat)
    this.cinderRing.geometry.dispose()
    releaseTell(this.cinderRingMat)
    // the tub's geometry and material are the rake's (line.ts wagonKit): never ours to free. Its circles stop being solid.
    this.smashWagon()
    this.wagonTell.dispose()
  }
}

/** The husk's geometry and materials, built once and shared: a level frees none of them, and nothing here is ever disposed. */
let huskKit: {
  body: THREE.BufferGeometry; brass: THREE.BufferGeometry; slits: THREE.BufferGeometry; core: THREE.BufferGeometry; lens: THREE.BufferGeometry; door: THREE.BufferGeometry
  mat: THREE.Material; jointMat: THREE.Material; dark: THREE.Material
} | null = null

/**
 * The dead engine, where it stopped (main.ts bossDown, or a resume): the enamel body dimmed (HIDES.engine x ENGINE.husk.dim), the firebox and
 * the headlamp and the cab's slits dark (CORE_ASLEEP taken down again, lit by the fog like any dead thing), the firebox door hanging ajar on
 * a cold coal. No halo, no glow: the fire is out. Facing along its travel. Solid is `engineHuskCircles`'s.
 */
export function engineHusk(x: number, z: number, yaw: number): THREE.Group {
  if (!huskKit) {
    const kit = engineKit()
    const { mat, jointMat } = hideMaterials('engine')
    mat.color.setHex(HIDES.engine.body).multiplyScalar(ENGINE.husk.dim)
    jointMat.color.setHex(HIDES.engine.joint).multiplyScalar(ENGINE.husk.dim)
    huskKit = {
      body: kit.engine, brass: brassGeometry(), slits: kit.firebox, core: new THREE.BoxGeometry(FIREBOX.w, FIREBOX.h, 0.04),
      lens: new THREE.BoxGeometry(0.18, 0.18, 0.02), door: new THREE.BoxGeometry(FIREBOX.door.w, FIREBOX.door.h, 0.05),
      mat, jointMat, dark: new THREE.MeshBasicMaterial({ color: new THREE.Color(CORE_ASLEEP).multiplyScalar(0.55) }),
    }
  }
  const k = huskKit
  const model = new THREE.Group()
  model.scale.setScalar(ENGINE.scale)
  model.position.z = (MODEL_LEN / 2) * ENGINE.scale
  const core = new THREE.Mesh(k.core, k.dark)
  core.position.set(0, FIREBOX.y, CAB_BACK - 0.02)
  const lens = new THREE.Mesh(k.lens, k.dark)
  lens.position.set(0, LAMP.y, LAMP.z + 0.005)
  const pivot = new THREE.Group()
  pivot.position.set(0, FIREBOX.y + FIREBOX.door.h / 2, CAB_BACK - 0.06)
  pivot.rotation.x = ENGINE.husk.doorAjar
  const door = new THREE.Mesh(k.door, k.jointMat)
  door.position.y = -FIREBOX.door.h / 2
  pivot.add(door)
  model.add(new THREE.Mesh(k.body, k.mat), new THREE.Mesh(k.brass, k.jointMat), new THREE.Mesh(k.slits, k.dark), lens, core, pivot)
  const g = new THREE.Group()
  g.add(model)
  g.position.set(x, 0, z)
  g.rotation.y = yaw
  g.name = 'engine:husk'
  return g
}

/** The husk's two solid circles, `ENGINE.husk.at` either side of its centre along its axis. */
export function engineHuskCircles(x: number, z: number, yaw: number): Circle[] {
  const h = ENGINE.husk
  return [-1, 1].map((sign) => ({ x: x + sign * h.at * Math.sin(yaw), z: z + sign * h.at * Math.cos(yaw), r: h.r }))
}

/** Where the Engine sleeps and the way it faces: on the loop at its wake place, along the loop as the body would lie (a resume's husk). */
export function engineSleepAt(track: TrackDef, x: number, z: number): { x: number; z: number; yaw: number } {
  const s = loopS(track, x, z), at = loopAt(track, s)
  const ahead = loopAt(track, s + ENGINE.length / 2), back = loopAt(track, s - ENGINE.length / 2)
  return { x: at.x, z: at.z, yaw: Math.atan2(ahead.x - back.x, ahead.z - back.z) }
}
