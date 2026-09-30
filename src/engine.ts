import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { hideMaterials, HIDES } from './hide'
import { haloTexture, type Vfx } from './vfx'
import { statusTint, CORE_ASLEEP, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'
import type { Circle } from './dungeon'
import { engineKit } from './line'
import { loopAt, loopS, type Side, type TrackArm, type TrackDef } from './track'
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
 * C3: the body, asleep and waking. It does not move yet (C4).
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
/** The headlamp, on the smokebox front, in the model's frame. */
const LAMP = { y: 0.95, z: 0.2 }
/** Where the cab's side slits are (line.ts rakeParts). */
const SLIT = { x: 0.74, y: 0.55, z: -2.2 }

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
  private readonly chimney = new THREE.Object3D()
  readonly track: TrackDef

  constructor(readonly def: BossDef, x: number, z: number, _face: THREE.Vector3, track: TrackDef) {
    this.hp = def.hp
    this.track = track
    // placed on the loop, going dir +1, facing its travel
    this.s = loopS(track, x, z)
    const at = loopAt(track, this.s)
    this.pos.set(at.x, 0, at.z)
    this.group.rotation.y = Math.atan2(at.dx, at.dz)

    // the crawl trains' engine, cloned (the shared geometry is never ours to dispose), its centre at the group's origin
    const kit = engineKit()
    const model = new THREE.Group()
    model.scale.setScalar(ENGINE.scale)
    model.position.z = (MODEL_LEN / 2) * ENGINE.scale
    const body = new THREE.Mesh(kit.engine.clone(), this.mat)
    // the cab's side slits are the core seen from the side
    const slits = new THREE.Mesh(kit.firebox.clone(), this.coreMat)
    // the firebox at the cab's back: the core, and its door hinged on the top edge (closed: the door hides it)
    const core = new THREE.Mesh(new THREE.BoxGeometry(FIREBOX.w, FIREBOX.h, 0.04), this.coreMat)
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
    model.add(body, fittings, slits, core, lens, this.doorPivot, this.chimney, ...halos, lampGlow)
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

  /** The departure board under the bar's name, or '' (BOARD's words; C5). */
  board(): string { return '' }

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
    this.flash = Math.max(0, this.flash - dt * 5)
    this.justPhase2 = false
    // it looks at Still, never the decoy: every boss ignores the lure
    this.still.copy(ctx.player)
    switch (this.state) {
      case 'unfold':
        // the whistle at 0; the firebox lights; the horizon is laid from C4 on
        if (!this.whistled) {
          this.whistled = true
          ctx.emit({ kind: 'engine', e: this, what: 'whistle', at: this.pos.clone() })
        }
        this.lit = Math.min(1, this.timer / 600)
        if (this.timer >= ENGINE.unfoldMs - 1e-6) this.go('run')
        break
      default:
        break
    }
    this.present(dt)
    return null
  }

  /** Committed ends for the camera (C6). */
  threats(_out: THREE.Vector3[]) {}

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
    // the firebox and the headlamp: a banked coal asleep, a deep red awake that flickers, and only ever dips (never lighter than CORE)
    const lit = this.asleep ? 0 : this.lit
    this.flick += dt * (FLICKER.hz + (ENGINE.flickerHz - FLICKER.hz) * (0.5 + 0.5 * Math.sin(this.bob * 1.3)))
    const dip = lit * FLICKER.depth * (0.5 + 0.5 * Math.sin(Math.PI * 2 * this.flick))
    this.coreMat.color.setHex(CORE_ASLEEP).lerp(FIRE, lit).multiplyScalar(1 - dip)
    // the lamp is steadier: a third of the dip
    this.lampMat.color.setHex(CORE_ASLEEP).lerp(FIRE, lit).multiplyScalar(1 - dip / 3)
    this.slitHalo.opacity = 0.6 * lit * (1 - dip)
    this.lampHalo.opacity = 0.5 * lit * (1 - dip / 3)
    this.doorPivot.rotation.x = this.door * 1.2
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
    for (const m of [this.mat, this.jointMat, this.coreMat, this.lampMat, this.slitHalo, this.lampHalo]) m.dispose()
  }
}
