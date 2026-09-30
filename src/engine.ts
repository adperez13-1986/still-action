import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hideMaterials, HIDES } from './hide'
import { haloTexture, tellMaterial, tellOrder, releaseTell, COLD, COLD_DEEP, type Vfx } from './vfx'
import { statusTint, CORE_ASLEEP, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'
import type { Circle } from './dungeon'
import { engineKit, LINE, RAIL_TELL, RAIL_TOP, WASH_Y } from './line'
import { Quads, UV_LEN } from './lane'
import type { Hazard, HazardSpec } from './hazard'
import { loopAt, loopS, TRACK, type Side, type TrackArm, type TrackDef } from './track'
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
 *
 *   run ─(window thrown, the frontier reaches the junction)→ siding ─(centre at the stop)→ derailed 1600 → backing → hold 1300 → run
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
  /** 250 ms of aim, then 700 locked (slack 164). len/halfW/damage/gapS/range: SPEC's. */
  steam: { trackMs: 250, lockMs: 700, liveMs: 200, len: 7, halfW: 1.3, damage: 14, gapS: [6, 9] as const, range: 8, leadMax: 3.0 },
  /** The Arbiter's answer memory (arbiter.ts), for the steam's lead. `minMove`: a lock he wasn't moving through tells it nothing. */
  guess: { memory: 3, minMove: 0.8, first: 1 },
  /** The outrun rule (arbiter.ts): out of every reach this long, and the stack lobs a cinder where he'll be. */
  outrun: { afterMs: [5000, 3500] as const, cooldownMs: 5000 },
  /** The Arbiter's shell, lobbed from the chimney; `leadS` of his velocity, capped. Source 'shell'. */
  cinder: { windupMs: 620, flightMs: 1000, r: 1.6, damage: 12, leadS: 0.6, leadMax: 3.0, peak: 3.2 },
  phase2At: 0.55,
  reverse: { judderMs: 650, everyS: [8, 12] as const },
  /** SPEC's, plus `r`/`at` (line.ts SIDING.wagonR / wagonAt) and `halfLen` (its tub, line.ts WAGON.l / 2). */
  wagon: { tellMs: 1200, speed: 7, damage: 12, halfW: 1.2, everyS: 14, firstS: 4, r: 0.75, at: 0.5, halfLen: 0.95 },
  husk: { r: 0.8, at: 0.7, color: 0x202124 },
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
/** The whistle's steam: paler than the stack's smoke. */
const STEAM = new THREE.Color(0x8a9096)
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
/** The headlamp, on the smokebox front, in the model's frame. */
const LAMP = { y: 0.95, z: 0.2 }
/** Where the cab's side slits are (line.ts rakeParts). */
const SLIT = { x: 0.74, y: 0.55, z: -2.2 }

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
  /** The strip's v where it starts (the swell runs on it): travel distance in UV_LEN units. */
  v: number
  /** How fast the leading end moves over it, u/s. */
  speed: number
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
  wagon: { spur: number; x: number; z: number; settled: boolean; circles: Circle[] } | null = null
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
    this.worldGroup.add(this.horizon.wash.mesh, this.horizon.rails.mesh, this.endStar, this.disc, this.ring)

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
    const brass = mergeGeometries([
      new THREE.CylinderGeometry(0.575, 0.575, 0.07, 16).rotateX(Math.PI / 2).translate(0, 0.85, -0.5),
      new THREE.CylinderGeometry(0.575, 0.575, 0.07, 16).rotateX(Math.PI / 2).translate(0, 0.85, -1.35),
      new THREE.SphereGeometry(0.2, 12, 8).translate(0, 1.4, -1.1),
      new THREE.BoxGeometry(0.3, 0.3, 0.2).translate(0, LAMP.y, LAMP.z - 0.1),
    ].map((g) => g.toNonIndexed()))!
    const fittings = new THREE.Mesh(brass, this.jointMat)
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

  get windupMs() { return 0 }

  get cue(): BossCue { return { voice: 'none' } }

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
    if (!j) return ''
    const secs = this.secondsToOpen(j.p)
    if (secs > 9) return ''
    return `${BOARD[j.arm.side]} · ${Math.max(1, Math.ceil(secs - 1e-9))}`
  }

  /** Always false: bosses can't be broken (SPEC §1.5.8). */
  interrupt(): false {
    return false
  }

  landsIn(): number | null {
    return null
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor * (this.open ? ENGINE.openMul : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      this.state = 'dead'
      return true
    }
    return false
  }

  private go(state: EngineState) {
    this.state = state
    this.timer = 0
  }

  update(dt: number, _target: THREE.Vector3, _terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.timer += ms
    this.bob += dt
    this.lastDt = dt
    this.flash = Math.max(0, this.flash - dt * 5)
    this.justPhase2 = false
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
        this.tickWindow(dt, ctx)
        this.lay(dt, ctx)
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
          this.go('backing')
          ctx.emit({ kind: 'engine', e: this, what: 'back', at: this.pos.clone(), side: this.branch!.arm.side })
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
    this.segs = this.segs.filter((g) => !g.h.done)
    this.present(dt)
    return null
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
    const base = Math.floor(u / L) * L
    const rel = u - base
    if (this.mv === 1) {
      for (const v of vertexS) if (v > rel + 1e-9) return base + v
      return base + L
    }
    for (let i = vertexS.length - 1; i >= 0; i--) if (vertexS[i]! < rel - 1e-9) return base + vertexS[i]!
    return base - L + vertexS[vertexS.length - 1]!
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
    for (let guard = 0; guard < 32; guard++) {
      const from = this.laidTo
      if (this.layEnd !== null && mv * (from - this.layEnd) > -1e-9) break
      const ahead = mv * (from - this.leadEnd)
      if (ahead / speed + standS > ENGINE.lead + dt + LAY_HAIR) break
      if (this.window && Math.abs(from - this.winU) < 1e-6) this.decide()
      let to = from + mv * ENGINE.segment
      const edge = this.edgeBeyond(from)
      if (mv * (edge - to) < SLIVER) to = edge
      if (this.layEnd !== null && mv * (to - this.layEnd) > 0) to = this.layEnd
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
        damage: ENGINE.runDamage, cover: 'none', hurt: 'hazard', quiet: true, owner: this, sparesOwner: true, cancelOnDeath: true,
        group: this.groupObj, shove: { dx, dz, along: LINE.shove.along, across: LINE.shove.across },
      }
      this.segs.push({
        id: this.nextId++, h: ctx.addHazard(this, spec), madeAt: ctx.now, armMs, group: this.groupNo,
        ax: a.x, az: a.z, bx: b.x, bz: b.z, v: (mv * from) / UV_LEN, speed,
      })
      this.laidTo = to
    }
    this.frontier = this.laidTo
    // it stops at the buffer: the lit rail ends in the ram's end star
    if (this.branch && this.heading === 1 && this.layEnd !== null && mv * (this.laidTo - this.layEnd) > -1e-9 && this.frontierEnd !== 'buffer') {
      const p = this.at(this.layEnd), a = this.branch.arm
      this.markEnd('buffer', p.x, p.z, Math.atan2(a.buffer.x - a.junction.x, a.buffer.z - a.junction.z))
    }
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
    const pFrom = this.dir * this.origin + L
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
    this.window = { side: j.arm.side, arm: j.arm, open: true, thrown: false, msOpen: 0 }
    this.winU = j.u
    ctx.emit({ kind: 'engine', e: this, what: 'window', at: this.pos.clone(), side: j.arm.side })
  }

  /** The frontier has reached the junction: the window closes, and thrown, everything turns into the arm. */
  private decide() {
    const w = this.window!
    this.decided = this.dir * this.winU
    this.window = null
    if (!w.thrown) return
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
    if (this.dead || this.asleep || !this.started || this.segs.length === 0) return
    const p = this.at(this.laidTo)
    out.push(new THREE.Vector3(p.x, 0, p.z))
  }

  /** Smoke from the stack while it is awake. */
  dress(vfx: Vfx) {
    if (this.asleep || this.dead) return
    this.dressN++
    this.group.updateMatrixWorld(true)
    // the whistle: a burst of steam from the stack for the first 400 ms of the unfold, then its smoke
    if (this.state === 'unfold' && this.timer < 400) vfx.smokePuff(this.chimney.getWorldPosition(new THREE.Vector3()), 4, STEAM)
    else if (this.dressN % 2 === 0) vfx.smokePuff(this.chimney.getWorldPosition(new THREE.Vector3()), 1, SOOT)
  }

  strikeFx(_vfx: Vfx) {}

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
    this.group.position.set(this.pos.x, 0, this.pos.z)
    this.group.rotation.y = this.yaw()
    this.clock += dt
    this.drawHorizon()
    this.drawWindow(dt)
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
  }
}
