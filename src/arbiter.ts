import * as THREE from 'three'
import { HIDES, hideMaterials, finish } from './hide'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, tellOrder, trackingDim, haloTexture, EMBER, type Vfx } from './vfx'
import { statusTint, CORE, CORE_ASLEEP, type EnemyAction, type EnemyCtx, type EnemyPhase } from './enemy'
import { Quads } from './lane'
import { pieceData } from './kit'
import type { Terrain } from './terrain'
import type { BossDef } from './areas'
import type { Boss, BossCue } from './boss'
import type { Post } from './dungeon'

/**
 * The Arbiter (design/content/SPEC.md §5): a lattice lamp tower in the middle of the
 * quarter's square. It never walks. Its gaze, an ember wedge on the floor, sweeps like
 * a lighthouse; when it crosses Still with a clear line it stops on him, tracks, locks,
 * and fires a lance down the locked line, which walls stop both ways. It aims where it
 * guesses he'll be, from how he dodged his last few lances (`guess`), so running round
 * it is no answer on its own: the strip on the floor is, read at the lock. A lance that hits
 * heats one of his buttons. After every lance the tower vents for 1.2 s: the time to
 * hit it. Hide from it and it lobs a shell; hug its base and it scalds.
 *
 *   unfold → watch ⇄ (track 360 → lock 560 → live 120 → vent 1200) | shellAim 620 | scaldWind 800
 *   phase 2 (below 55%): two wedges, reversals, and lances and shells that crack the posts
 *
 * Every tell meets the slack rule (§5.3): the lance 178 ms, the shell 409, the scald 213.
 * The wedge is a floor tell, never a real light: Grace stays the only warm light.
 */
export const ARBITER = {
  hp: 900, radius: 1.4, footprint: 1.2, height: 4.6, labelY: 4.9, phase2At: 0.55, wakeRadius: 12.5,
  /**
   * The gaze. §5.4's opacity 0.10 was for a flat wash; this one is a sweep, most of it the
   * floor showing through and its leading edge lit, so it carries more at its peak.
   */
  wedge: { halfDeg: 15, range: 15, degPerS: 40, unfoldMs: 1500, opacity: 0.55 },
  lance: { trackMs: 360, lockMs: 560, liveMs: 120, halfW: 0.45, damage: 18, turnRate: 6, reach: 20, mirrorDamage: 18 },
  /**
   * It aims where he'll be when it fires, and its guess is where one of his last three dodges
   * took him: kept going leads him fully, stopped leads him about half (his reaction's worth),
   * turned back aims at him or behind. The rails show the guess from the catch and the strip
   * commits it at the lock, so every lance has an answer on the floor; no one dodge answers
   * them all. `s` is lock to the middle of the burn; `minArc` is how far he must have been
   * moving round it at the lock for his answer to count; `maxDeg` caps the lead. `turnRate`
   * (in `lance`) is 6, not the spec's 3.5, so the aim can reach a full lead in the track.
   */
  guess: { s: 0.62, maxDeg: 60, minArc: 1.0, smoothMs: 90, memory: 3 },
  vent: { ms: 1200, damageMul: 1.5 },
  heat: { ms: 4000 },
  shell: { hideMs: [2000, 1600] as const, cooldownMs: [3500, 3000] as const, windupMs: 620, flightMs: 1000, r: 1.6, damage: 12, lead: 0.3, leadMax: 2 },
  scald: { trigger: 3.0, r: 3.2, windupMs: 800, damage: 14, cooldownMs: 2500 },
  /**
   * `shellChip`: in the second phase a shell whose blast overlaps a post chips it as a lance does
   * (landing within this much of a circle's edge; the blast is r 1.6, so it visibly covers the
   * brick), so hiding from post to post wears the cover away.
   */
  phase2: { judderMs: 600, reverseEveryMs: [4000, 7000] as const, reverseJudderMs: 400, crackAt: 3, shellChip: 1.2 },
  posts: { crackedR: 0.45, rubbleScale: 0.4 },
  /**
   * Risk 1 (§1): 4.6 u tall in the middle of the square, it hides a strip of floor behind it
   * from the fixed camera (which looks from +x +z). When Still is in that strip, the tower's
   * solid parts fade to this, so he's never lost behind it; the lattice already shows the floor.
   */
  seeThrough: { opacity: 0.3, reach: 6.2, half: 1.7 },
}

export type ArbiterState =
  | 'asleep' | 'unfold' | 'watch'
  | 'track' | 'lock' | 'live' | 'vent'
  | 'shellAim' | 'scaldWind'
  | 'judder'
  | 'dead'

/** Blackened steel, and a joint darker still; the lenses and boiler cores are its lights. */
const SHELL = HIDES.arbiter.body
const JOINTS = HIDES.arbiter.joint
/** A dead tower: its steel gone dull and dark. */
const HUSK = 0x202124
const DEG = Math.PI / 180
const COLLAR_Y = 3.7
const HEAD_Y = 4.05
/** A mortar on the collar's side, tilted 50° up: the shell leaves from its mouth. */
const MORTAR_TILT = 50 * DEG

const angleDiff = (a: number, b: number) => {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/** A rod from a to b, baked into its own geometry (for merging). */
function rodGeo(a: THREE.Vector3, b: THREE.Vector3, r: number) {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  g.applyQuaternion(q)
  const m = a.clone().add(b).multiplyScalar(0.5)
  g.translate(m.x, m.y, m.z)
  return g
}

/**
 * The open lattice: three legs of two rods each, from the base ring to the collar, braced
 * in a zig-zag. One draw, and 0.07 u thick: the floor behind it shows through.
 */
function latticeGeo() {
  const parts: THREE.BufferGeometry[] = []
  const at = (leg: number, y: number, side = 0) => {
    const a = (leg / 3) * Math.PI * 2
    const r = 1.1 + (0.45 - 1.1) * ((y - 0.3) / (COLLAR_Y - 0.3))
    // side: ±0.07 along the tangent, the leg's two rods
    return new THREE.Vector3(Math.sin(a) * r + Math.cos(a) * side, y, Math.cos(a) * r - Math.sin(a) * side)
  }
  const hs = [1.2, 2.2, 3.0, 3.5]
  for (let leg = 0; leg < 3; leg++) {
    for (const side of [-0.07, 0.07]) parts.push(rodGeo(at(leg, 0.3, side), at(leg, COLLAR_Y, side), 0.07))
    // three braces to the next leg, up one way and back the other: a zig-zag round the tower
    const next = (leg + 1) % 3
    for (let k = 0; k < 3; k++) {
      const [a, b] = k % 2 === 0 ? [leg, next] : [next, leg]
      parts.push(rodGeo(at(a, hs[k]!), at(b, hs[k + 1]!), 0.05))
    }
  }
  return mergeGeometries(parts)!
}

/** The tower's shape, lit or as a husk: the base, the lattice, the boiler, the collar and mortar, the head. */
function buildBody(mat: THREE.Material, joint: THREE.Material) {
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 8), mat)
  base.position.y = 0.15
  const lattice = new THREE.Mesh(latticeGeo(), joint)
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 12), mat)
  boiler.position.y = 2.3
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 6, 18), joint)
  collar.rotation.x = Math.PI / 2
  collar.position.y = COLLAR_Y
  const mortarPivot = new THREE.Group()
  mortarPivot.position.set(0, COLLAR_Y, 0)
  const mortar = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.7, 10), mat)
  mortar.position.set(0, 0.2, 0.6)
  mortar.rotation.x = MORTAR_TILT
  mortarPivot.add(mortar)
  const head = new THREE.Group()
  head.position.y = HEAD_Y
  const housing = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.7, 0.9), mat)
  const rim = (z: number) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.2, 14), joint)
    c.rotation.x = Math.PI / 2
    c.position.z = z
    return c
  }
  head.add(housing, rim(0.5), rim(-0.5))
  return { base, lattice, boiler, collar, mortarPivot, mortar, head }
}

export class Arbiter implements Boss {
  readonly kind = 'boss'
  readonly labelY = ARBITER.labelY
  readonly height = ARBITER.height
  readonly anchored = ARBITER.footprint
  get radius() { return ARBITER.radius * this.size }
  get maxHp() { return this.def.hp }
  readonly group = new THREE.Group()
  /** Nothing follows the body: its tells all lie in worldGroup. */
  readonly tellGroup = new THREE.Group()
  readonly worldGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  readonly knock = new THREE.Vector3()
  hp = ARBITER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  /** It never moves: every shove, pull and toss finds nothing to move. */
  knockMul = 0
  size = 1
  rime = 0
  air = 0
  readonly walking = false
  readonly gait = 0

  state: ArbiterState = 'asleep'
  /** Wedge angles (radians, world, atan2(x, z)). One in phase 1, two (θ, θ + π) in phase 2. */
  readonly wedges: number[] = []
  /** Signed rad/s; negative is clockwise seen from above. */
  omega = 0
  /** The lance's aim while it tracks and locks. */
  aim = 0
  /** The lance's end while it's locked and live. */
  cut: THREE.Vector3 | null = null
  phase2 = false
  justPhase2 = false
  /** The lead its next lance takes, as a share of where he's going: 1 leads him fully, 0 aims at him, below 0 behind. */
  guess = 1
  /** His angular speed round the tower (rad/s, the omega sense), smoothed. */
  private spin = 0
  private lockD = 0
  /** His last few answers to a lock (see judge), and the stream that picks which one it guesses. */
  private readonly answers: number[] = []
  private guessSeed = 7
  private lockBearing = 0
  private lockSpin = 0
  /** What its last strike was, for the run's sound. */
  strikeKind: 'lance' | 'shell' | 'scald' | null = null

  /** ms in the current state. */
  private timer = 0
  private judderMs = 0
  private judderFor: 'phase2' | 'reverse' = 'phase2'
  /** Which wedge caught him: it owns the lance. */
  private owner = 0
  /** He has been outside every wedge since the last lance: the next catch may come. */
  private rearmed = true
  private hiddenMs = 0
  private sinceShell = Infinity
  private sinceScald = Infinity
  private shellFlying = 0
  private reverseIn = 0
  private strikeTick = false
  private aimNext = true
  private swept = 0
  private flash = 0
  private bob = 0
  private asleep = true
  private lensLit = 0
  private backLit = 0
  private recoil = 0
  private headYaw = 0
  private hatch = 0
  private lift = 0
  private dressN = 0
  /** A seeded stream for the reversals: the same fight gives the same rhythm. */
  private seed = 1
  private readonly lead = new THREE.Vector3()
  /** Where Still was on the last update, for the see-through fade. */
  private readonly still = new THREE.Vector3(1e3, 0, 1e3)
  private fade = 1
  private readonly gazeEnd = new THREE.Vector3()

  // rig
  private readonly hide = hideMaterials('arbiter', { transparent: true })
  private readonly mat = this.hide.mat
  private readonly jointMat = this.hide.jointMat
  /** The lenses and boiler cores: its lights, which ignore the fog (the lights-out rule). */
  private readonly lensMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  private readonly backMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  private readonly coreMat = new THREE.MeshBasicMaterial({ color: CORE_ASLEEP, fog: false })
  private readonly head: THREE.Group
  private readonly lens: THREE.Mesh
  private readonly back: THREE.Mesh
  private readonly halo: THREE.Sprite
  private readonly backHalo: THREE.Sprite
  private readonly hatches: THREE.Group[] = []
  private readonly mortarPivot: THREE.Group
  private readonly base: THREE.Mesh

  // tells, in world space
  private readonly wedgeMats: THREE.ShaderMaterial[] = []
  private readonly wedgeMeshes: THREE.Mesh[] = []
  /** Tracking: two faint rails closing in on the lance's width, and a thin wash between. */
  private readonly gazeMat = tellMaterial('strip')
  private readonly gaze = new Quads(2, this.gazeMat)
  private readonly gazeWashMat = tellMaterial('strip')
  private readonly gazeWash = new Quads(1, this.gazeWashMat)
  private readonly shellRingMat = tellMaterial('radial', ARBITER.shell.r)
  private readonly shellRing: THREE.Mesh

  constructor(readonly def: BossDef, x: number, z: number, face: THREE.Vector3, readonly posts: Post[] = []) {
    this.pos.set(x, 0, z)
    const body = buildBody(this.mat, this.jointMat)
    this.base = body.base
    this.head = body.head
    this.mortarPivot = body.mortarPivot
    // three hatches round the boiler, hinged on their top edge, each with a core behind it
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 3
      const pivot = new THREE.Group()
      pivot.position.set(Math.sin(a) * 0.56, 2.55, Math.cos(a) * 0.56)
      pivot.rotation.y = a
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 0.06), this.jointMat)
      door.position.y = -0.25
      pivot.add(door)
      const core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.04), this.coreMat)
      core.position.set(Math.sin(a) * 0.53, 2.3, Math.cos(a) * 0.53)
      core.rotation.y = a
      this.hatches.push(pivot)
      this.group.add(pivot, core)
    }
    const lensGeo = new THREE.OctahedronGeometry(0.3)
    this.lens = new THREE.Mesh(lensGeo, this.lensMat)
    this.lens.position.z = 0.62
    this.back = new THREE.Mesh(lensGeo.clone(), this.backMat)
    this.back.position.z = -0.62
    const haloMat = () => new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
    this.halo = new THREE.Sprite(haloMat())
    this.halo.position.z = 0.7
    this.backHalo = new THREE.Sprite(haloMat())
    this.backHalo.position.z = -0.7
    this.head.add(this.lens, this.back, this.halo, this.backHalo)
    this.group.add(body.base, body.lattice, body.boiler, body.collar, body.mortarPivot, body.head)
    this.headYaw = Math.atan2(face.x - x, face.z - z)

    // the gaze: one wedge, and a second built dark for the second phase
    const a = ARBITER.wedge.halfDeg * DEG
    for (let i = 0; i < 2; i++) {
      const m = tellMaterial('radial', ARBITER.wedge.range)
      m.uniforms.uSweepHalf!.value = a
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(ARBITER.wedge.range, 24, Math.PI / 2 - a, a * 2), m)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.set(x, DECAL_Y, z)
      this.wedgeMats.push(m)
      this.wedgeMeshes.push(mesh)
      this.worldGroup.add(mesh)
    }
    this.worldGroup.add(this.gazeWash.mesh, this.gaze.mesh)
    this.shellRing = new THREE.Mesh(new THREE.RingGeometry(ARBITER.shell.r - 0.1, ARBITER.shell.r, 48), this.shellRingMat)
    this.shellRing.rotation.x = -Math.PI / 2
    this.worldGroup.add(this.shellRing)
    this.present(0)
  }

  /** Venting: its ×1.5 window. */
  get open() { return this.state === 'vent' }

  get windupMs() {
    return this.state === 'shellAim' ? ARBITER.shell.windupMs : this.state === 'scaldWind' ? ARBITER.scald.windupMs : ARBITER.lance.trackMs + ARBITER.lance.lockMs
  }

  get cue(): BossCue {
    if (this.state === 'track') return { voice: 'aim', lockAt: ARBITER.lance.trackMs / (ARBITER.lance.trackMs + ARBITER.lance.lockMs) }
    if (this.state === 'shellAim') return { voice: 'lob' }
    if (this.state === 'scaldWind') return { voice: 'windup' }
    return { voice: 'none' }
  }

  /** The wedge turning, for the whirr: in watch, unfolding, and while a shell is aimed. */
  get sweeping() {
    return this.state === 'watch' || this.state === 'unfold' || this.state === 'shellAim'
  }

  /** Where the first wedge's gaze is, 8 u out: the whirr follows it round the square. */
  gazePoint(out: THREE.Vector3) {
    const a = this.wedges[0] ?? this.headYaw
    return out.set(this.pos.x + Math.sin(a) * 8, 0, this.pos.z + Math.cos(a) * 8)
  }

  interrupt() {
    return false
  }

  /** Its lance to the burn, its mortar to the launch, its scald to the hiss. Never broken, only read. */
  landsIn() {
    const L = ARBITER.lance
    if (this.state === 'track') return Math.max(0, L.trackMs + L.lockMs - this.timer)
    if (this.state === 'lock') return Math.max(0, L.lockMs - this.timer)
    if (this.state === 'shellAim') return Math.max(0, ARBITER.shell.windupMs - this.timer)
    if (this.state === 'scaldWind') return Math.max(0, ARBITER.scald.windupMs - this.timer)
    return null
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor * (this.open ? ARBITER.vent.damageMul : 1)
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      this.state = 'dead'
      return true
    }
    return false
  }

  private next() {
    this.seed = (this.seed * 16807) % 2147483647
    return this.seed / 2147483647
  }

  private go(state: ArbiterState) {
    this.state = state
    this.timer = 0
  }

  update(dt: number, _target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.timer += ms
    this.bob += dt
    this.flash = Math.max(0, this.flash - dt * 5)
    this.recoil = Math.max(0, this.recoil - dt * 3.3)
    this.justPhase2 = false
    this.sinceShell += ms
    this.sinceScald += ms
    const flying = this.shellFlying > 0
    this.shellFlying = Math.max(0, this.shellFlying - ms)
    // the shell lands: in the second phase, on a post it chips the brick
    if (flying && this.shellFlying <= 0 && this.phase2 && !this.dead) this.chipPost(this.lead, ARBITER.phase2.shellChip, ctx)
    this.reverseIn -= ms
    this.strikeTick = false
    let action: EnemyAction | null = null

    // it looks at Still, never the decoy: every boss ignores the lure
    const still = ctx.player
    this.still.copy(still)
    const d = Math.hypot(still.x - this.pos.x, still.z - this.pos.z)
    const bearing = Math.atan2(still.x - this.pos.x, still.z - this.pos.z)
    const see = terrain.lineClear(this.pos.x, this.pos.z, still.x, still.z, 0.1, true)
    this.hiddenMs = see ? 0 : this.hiddenMs + ms
    // his turn round the tower, from his velocity: dθ/dt = (vx cos θ − vz sin θ) / d
    const v = ctx.playerVel
    const spinNow = d > 0.5 ? (v.x * Math.cos(bearing) - v.z * Math.sin(bearing)) / d : 0
    this.spin += (spinNow - this.spin) * Math.min(1, ms / ARBITER.guess.smoothMs)
    if (this.aimNext) {
      // the gaze starts behind him and comes round
      this.wedges.length = 0
      this.wedges.push(bearing + Math.PI)
      this.headYaw = bearing + Math.PI
      this.aimNext = false
    }

    // phase 2, once: whatever was coming is cut short, and it shakes itself open
    if (!this.phase2 && this.state !== 'asleep' && this.hp < this.def.hp * ARBITER.phase2At) {
      this.phase2 = true
      this.justPhase2 = true
      if (this.state === 'lock') action = { kind: 'unhazard', source: 'lance' }
      this.cut = null
      this.judder('phase2', ARBITER.phase2.judderMs)
      this.reverseIn = this.reverseDelay()
      this.flash = 1
      ctx.emit({ kind: 'arbiter', e: this, what: 'phase2', at: this.pos.clone() })
    }

    const hideMs = ARBITER.shell.hideMs[this.phase2 ? 1 : 0]
    const shellCd = ARBITER.shell.cooldownMs[this.phase2 ? 1 : 0]
    switch (this.state) {
      case 'unfold': {
        // the lens lights, and the sweep eases up to speed
        const k = Math.min(1, this.timer / ARBITER.wedge.unfoldMs)
        this.lensLit = Math.min(1, this.timer / 600)
        this.omega = -ARBITER.wedge.degPerS * DEG * k * k
        this.sweep(dt, ctx)
        if (k >= 1) this.go('watch')
        break
      }
      case 'watch': {
        this.omega = Math.sign(this.omega || -1) * ARBITER.wedge.degPerS * DEG
        this.sweep(dt, ctx)
        const inWedge = this.wedges.findIndex((w) => Math.abs(angleDiff(bearing, w)) <= ARBITER.wedge.halfDeg * DEG && d <= ARBITER.wedge.range)
        if (inWedge < 0) this.rearmed = true
        if (d <= ARBITER.scald.trigger && this.sinceScald >= ARBITER.scald.cooldownMs) {
          // he's at its feet: the base plate hisses, and the square around it scalds
          this.go('scaldWind')
          action = {
            kind: 'hazard',
            spec: {
              source: 'scald', shape: { kind: 'circle', x: this.pos.x, z: this.pos.z, r: ARBITER.scald.r }, armMs: ARBITER.scald.windupMs,
              liveMs: 0, damage: ARBITER.scald.damage, cover: 'fromCentre', hurt: 'melee', owner: this, sparesOwner: true,
            },
          }
        } else if (inWedge >= 0 && see && this.rearmed && ctx.canLock(ARBITER.lance.trackMs)) {
          ctx.book(this, ARBITER.lance.trackMs)
          this.owner = inWedge
          this.aim = this.wedges[inWedge]!
          this.go('track')
          ctx.emit({ kind: 'arbiter', e: this, what: 'catch', at: still.clone() })
        } else if (this.hiddenMs >= hideMs && d <= ARBITER.wedge.range && this.shellFlying <= 0 && this.sinceShell >= shellCd && ctx.canLock(ARBITER.shell.windupMs)) {
          ctx.book(this, ARBITER.shell.windupMs)
          this.go('shellAim')
          this.leadAt(ctx, terrain)
        } else if (this.phase2 && this.reverseIn <= 0) {
          this.judder('reverse', ARBITER.phase2.reverseJudderMs)
          ctx.emit({ kind: 'arbiter', e: this, what: 'judder', at: this.pos.clone(), ms: ARBITER.phase2.reverseJudderMs })
        }
        break
      }
      case 'track': {
        // the sweep stops on him, and the head turns to its guess of where he'll be, no faster than turnRate
        const turn = ARBITER.lance.turnRate * dt
        const lead = Math.max(-ARBITER.guess.maxDeg * DEG, Math.min(ARBITER.guess.maxDeg * DEG, this.spin * ARBITER.guess.s * this.guess))
        this.aim += Math.max(-turn, Math.min(turn, angleDiff(bearing + lead, this.aim)))
        this.cutAt(this.aim, terrain, this.gazeEnd)
        if (this.timer >= ARBITER.lance.trackMs) {
          // the lock: the aim freezes, and the cut is committed. Drawn = hit.
          const start = this.lanceStart(new THREE.Vector3())
          this.cut = this.cutAt(this.aim, terrain, new THREE.Vector3())
          this.rearmed = false
          this.lockD = d
          this.lockBearing = bearing
          this.lockSpin = this.spin
          this.go('lock')
          ctx.emit({ kind: 'lock', e: this, end: this.cut.clone() })
          action = {
            kind: 'hazard',
            spec: {
              source: 'lance', shape: { kind: 'strip', ax: start.x, az: start.z, bx: this.cut.x, bz: this.cut.z, halfW: ARBITER.lance.halfW },
              armMs: ARBITER.lance.lockMs, liveMs: ARBITER.lance.liveMs, damage: ARBITER.lance.damage, cover: 'none', hurt: 'hazard',
              warded: true, heat: true, owner: this, cancelOnDeath: true,
            },
          }
        }
        break
      }
      case 'lock':
        if (this.timer >= ARBITER.lance.lockMs) {
          this.go('live')
          this.strike('lance')
          this.judge(bearing)
          this.recoil = 1
          if (this.phase2 && this.cut) this.chipPost(this.cut, 0.35, ctx)
        }
        break
      case 'live':
        if (this.timer >= ARBITER.lance.liveMs) {
          this.go('vent')
          ctx.emit({ kind: 'arbiter', e: this, what: 'vent', at: this.pos.clone() })
        }
        break
      case 'vent':
        if (this.timer >= ARBITER.vent.ms) {
          // the hatches close, and the sweep picks up from where it fired
          this.cut = null
          this.wedges[this.owner] = this.aim
          if (this.wedges.length > 1) this.wedges[1 - this.owner] = this.aim + Math.PI
          this.go('watch')
          ctx.emit({ kind: 'arbiter', e: this, what: 'ventEnd', at: this.pos.clone() })
        }
        break
      case 'shellAim':
        // the sweep keeps turning while the mortar tilts after him
        this.sweep(dt, ctx)
        this.leadAt(ctx, terrain)
        if (this.timer >= ARBITER.shell.windupMs) {
          this.go('watch')
          this.strike('shell')
          this.shellFlying = ARBITER.shell.flightMs
          this.sinceShell = 0
          const from = this.mortarMouth(new THREE.Vector3())
          action = {
            kind: 'hazard',
            spec: {
              source: 'shell', shape: { kind: 'circle', x: this.lead.x, z: this.lead.z, r: ARBITER.shell.r }, armMs: ARBITER.shell.flightMs,
              liveMs: 0, damage: ARBITER.shell.damage, cover: 'none', hurt: 'hazard', owner: this,
              flight: { x: from.x, y: from.y, z: from.z, peak: 3.2 },
            },
          }
        }
        break
      case 'scaldWind':
        if (this.timer >= ARBITER.scald.windupMs) {
          this.sinceScald = 0
          this.go('watch')
          this.strike('scald')
          ctx.emit({ kind: 'arbiter', e: this, what: 'scald', at: this.pos.clone() })
        }
        break
      case 'judder':
        if (this.timer >= this.judderMs) {
          if (this.judderFor === 'phase2' && this.wedges.length < 2) this.wedges.push((this.wedges[0] ?? 0) + Math.PI)
          if (this.judderFor === 'reverse') {
            this.omega = -this.omega
            this.reverseIn = this.reverseDelay()
          }
          this.go('watch')
        }
        break
    }

    // what Combat sees of it: a windup while it aims, a strike on the tick it fires
    this.phase = this.strikeTick ? 'strike'
      : this.state === 'track' || this.state === 'lock' || this.state === 'shellAim' || this.state === 'scaldWind' ? 'windup'
        : this.state === 'vent' ? 'recover' : 'approach'
    this.present(dt)
    return action
  }

  /**
   * At the burn: how far round did his answer to the lock take him, against how far he'd have
   * gone had he kept on? Kept going is 1, stopped after his reaction about 0.5, turned back
   * about 0 or less. It remembers his last three answers, and each lance guesses one of them:
   * a habit is caught at once, and a fixed cycle of answers within a few lances. Standing, or
   * running straight at it, tells it nothing, and the guess stands.
   */
  private judge(bearing: number) {
    const would = this.lockSpin * (ARBITER.lance.lockMs / 1000)
    if (Math.abs(would) * this.lockD < ARBITER.guess.minArc) return
    this.answers.push(Math.max(-1, Math.min(1, angleDiff(bearing, this.lockBearing) / would)))
    if (this.answers.length > ARBITER.guess.memory) this.answers.shift()
    this.guessSeed = (this.guessSeed * 16807) % 2147483647
    this.guess = this.answers[Math.floor((this.guessSeed / 2147483647) * this.answers.length)]!
  }

  private strike(kind: 'lance' | 'shell' | 'scald') {
    this.strikeKind = kind
    this.strikeTick = true
  }

  private judder(why: 'phase2' | 'reverse', ms: number) {
    this.judderFor = why
    this.judderMs = ms
    this.go('judder')
  }

  private reverseDelay() {
    const [lo, hi] = ARBITER.phase2.reverseEveryMs
    return lo + (hi - lo) * this.next()
  }

  /** Every wedge turns by ω dt, with a ratchet tick every 10°. */
  private sweep(dt: number, ctx: EnemyCtx) {
    for (let i = 0; i < this.wedges.length; i++) this.wedges[i]! += this.omega * dt
    this.swept += Math.abs(this.omega * dt)
    if (this.swept >= 10 * DEG) {
      this.swept -= 10 * DEG
      ctx.emit({ kind: 'arbiter', e: this, what: 'ratchet', at: this.gazePoint(new THREE.Vector3()) })
    }
  }

  /** Where the lance starts: just outside the footprint along the aim. */
  private lanceStart(out: THREE.Vector3) {
    const r = ARBITER.footprint + 0.1
    return out.set(this.pos.x + Math.sin(this.aim) * r, 0, this.pos.z + Math.cos(this.aim) * r)
  }

  /**
   * The cut: marched out from the footprint in 0.2 u steps until the first solid in see mode
   * (a barrier, a post, a crate, the void; a breach lets it through) or 20 u. The last clear point.
   */
  private cutAt(aim: number, terrain: Terrain, out: THREE.Vector3) {
    const dx = Math.sin(aim)
    const dz = Math.cos(aim)
    const r0 = ARBITER.footprint + 0.1
    let last = r0
    for (let s = r0; s <= r0 + ARBITER.lance.reach; s += 0.2) {
      if (terrain.blocker(this.pos.x + dx * s, this.pos.z + dz * s, 0.1, true)) break
      last = s
    }
    return out.set(this.pos.x + dx * last, 0, this.pos.z + dz * last)
  }

  /** His lead point for a shell: 0.3 s of his velocity on, at most 2 u, stepped back toward the tower out of anything solid. */
  private leadAt(ctx: EnemyCtx, terrain: Terrain) {
    const s = ctx.player
    let lx = ctx.playerVel.x * ARBITER.shell.lead
    let lz = ctx.playerVel.z * ARBITER.shell.lead
    const l = Math.hypot(lx, lz)
    if (l > ARBITER.shell.leadMax) {
      lx *= ARBITER.shell.leadMax / l
      lz *= ARBITER.shell.leadMax / l
    }
    this.lead.set(s.x + lx, 0, s.z + lz)
    const bx = this.pos.x - this.lead.x
    const bz = this.pos.z - this.lead.z
    const bd = Math.hypot(bx, bz)
    for (let k = 0; k < 30 && bd > 0.01 && terrain.blocked(this.lead.x, this.lead.z, 0.01); k++) {
      this.lead.x += (bx / bd) * 0.5
      this.lead.z += (bz / bd) * 0.5
    }
  }

  private mortarMouth(out: THREE.Vector3) {
    this.group.updateMatrixWorld(true)
    return this.mortarPivot.localToWorld(out.set(0, 0.45, 0.85))
  }

  /** Phase 2: a lance that ended on a post, or a shell that landed on one, chips it; the third chip cracks it, for good. */
  private chipPost(at: THREE.Vector3, reach: number, ctx: EnemyCtx) {
    const post = this.posts.find((p) => !p.cracked && p.circles.some((c) => Math.hypot(c.x - at.x, c.z - at.z) <= c.r + reach))
    if (!post) return
    post.lances += 1
    if (post.lances >= ARBITER.phase2.crackAt) {
      post.cracked = true
      for (const c of post.circles) c.r = ARBITER.posts.crackedR
      // what's left of it: a low heap of brick, never taller than the barrier
      const rubble = pieceData('rubble_half')
      post.mesh.geometry = rubble.geometry
      post.mesh.material = rubble.material
      const s = ARBITER.posts.rubbleScale
      post.mesh.scale.setScalar(s)
      // rubble_half's footprint starts at its origin: centre it on the post
      post.mesh.position.set(post.x - Math.cos(post.mesh.rotation.y) * 2 * s, 0, post.z + Math.sin(post.mesh.rotation.y) * 2 * s)
    }
    ctx.emit({ kind: 'arbiter', e: this, what: 'crack', at: new THREE.Vector3(post.x, 0.6, post.z), ms: post.lances })
  }

  /** Committed ends for the camera: the lance's cut, a shell's landing. */
  threats(out: THREE.Vector3[]) {
    if (this.dead) return
    if (this.state === 'track') out.push(this.gazeEnd.clone())
    if ((this.state === 'lock' || this.state === 'live') && this.cut) out.push(this.cut.clone())
    if (this.state === 'shellAim') out.push(this.lead.clone())
  }

  /** Smoke from the collar; in the second phase, embers off both lenses; venting, steam at the hatches. */
  dress(vfx: Vfx) {
    if (this.asleep || this.dead) return
    this.dressN++
    this.group.updateMatrixWorld(true)
    if (this.dressN % 2 === 0) vfx.smokePuff(new THREE.Vector3(this.pos.x, COLLAR_Y + 0.3, this.pos.z), 1, SOOT)
    if (this.phase2) {
      vfx.embers(this.lens.getWorldPosition(new THREE.Vector3()), 1, 0.2)
      vfx.embers(this.back.getWorldPosition(new THREE.Vector3()), 1, 0.2)
    }
    if (this.open) for (const h of this.hatches) vfx.smokePuff(h.localToWorld(new THREE.Vector3(0, -0.2, 0.2)), 1, STEAM)
  }

  strikeFx(vfx: Vfx) {
    this.group.updateMatrixWorld(true)
    if (this.strikeKind === 'lance') {
      const at = this.lens.getWorldPosition(new THREE.Vector3())
      vfx.flash(at, EMBER, 1.4)
      const dir = new THREE.Vector3(Math.sin(this.aim), 0, Math.cos(this.aim))
      for (let i = 0; i < 14; i++) {
        const k = (i / 14) * 2
        vfx.sparks(new THREE.Vector3(this.pos.x + dir.x * (1.3 + k), 1.2, this.pos.z + dir.z * (1.3 + k)), EMBER, 1, 3)
      }
    } else if (this.strikeKind === 'scald') {
      vfx.dust(this.pos, 30, ARBITER.scald.r, STEAM, 4)
    } else if (this.strikeKind === 'shell') {
      vfx.smokePuff(this.mortarMouth(new THREE.Vector3()), 3)
    }
  }

  // --- presentation ---

  private present(dt: number) {
    const k = dt > 0 ? Math.min(1, dt * 14) : 1
    const t = this.timer
    // the head: on the gaze while it watches, after him while it tracks, frozen once it's locked
    let yaw = this.headYaw
    if (this.state === 'watch' || this.state === 'unfold' || this.state === 'shellAim') yaw = this.wedges[0] ?? yaw
    else if (this.state === 'track') yaw = this.aim
    this.headYaw = yaw
    const shake = this.state === 'judder' ? 0.05 * Math.sin(Math.PI * 2 * 25 * this.bob) : 0
    this.head.rotation.y = yaw + shake
    // the recoil pushes the head back along the aim
    this.head.position.set(-Math.sin(this.aim) * 0.2 * this.recoil, HEAD_Y, -Math.cos(this.aim) * 0.2 * this.recoil)

    // the lens: 1 in watch, swelling as it tracks, snapped to 1.5 at the lock, dim while it vents
    const lensScale = this.state === 'track' ? 1 + 0.35 * Math.min(1, t / ARBITER.lance.trackMs)
      : this.state === 'lock' || this.state === 'live' ? 1.5 : this.state === 'vent' ? 0.3 : 1
    this.lens.scale.setScalar(this.lens.scale.x + (lensScale - this.lens.scale.x) * (this.state === 'lock' ? 1 : k))
    const lit = this.asleep ? 0 : this.lensLit * (this.state === 'vent' ? 0.35 : 1)
    this.lensMat.color.setHex(CORE_ASLEEP).lerp(CORE_C, lit)
    this.halo.material.opacity = lit * (this.state === 'lock' ? 1 : 0.75)
    this.halo.scale.setScalar(1.8 * (this.state === 'lock' || this.state === 'live' ? 1.3 : 1))
    this.backLit += ((this.phase2 && !this.asleep ? 1 : 0) - this.backLit) * Math.min(1, dt * 3)
    this.backMat.color.setHex(CORE_ASLEEP).lerp(CORE_C, this.backLit)
    this.backHalo.material.opacity = this.backLit * 0.75
    this.backHalo.scale.setScalar(1.8)

    // the hatches swing open to vent, and the cores behind them beat
    const hatchTo = this.open ? 1.2 : 0
    this.hatch += (hatchTo - this.hatch) * Math.min(1, dt / 0.15)
    for (const h of this.hatches) h.rotation.x = -this.hatch
    const beat = this.open ? 1 + 0.25 * Math.sin(this.bob * 9) : 1
    this.coreMat.color.setHex(CORE_ASLEEP).lerp(CORE_C, Math.min(1, (this.asleep ? 0 : this.open ? 1 : 0.35) * beat))
    // the mortar tilts after him, and kicks at the launch
    const mTo = this.state === 'shellAim' ? Math.atan2(this.lead.x - this.pos.x, this.lead.z - this.pos.z) : this.mortarPivot.rotation.y
    this.mortarPivot.rotation.y += angleDiff(mTo, this.mortarPivot.rotation.y) * k
    // the scald: the base plate lifts and settles
    const liftTo = this.state === 'scaldWind' ? 0.04 : 0
    this.lift += (liftTo - this.lift) * k
    this.base.position.y = 0.15 + this.lift

    // the body: blackened steel, dimmed asleep, the hit flash over it
    for (const [m, base] of [[this.mat, SHELL], [this.jointMat, JOINTS]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.5)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(WHITE, this.flash * 0.5)
      m.emissive.setRGB(this.flash * 0.4, this.flash * 0.15, this.flash * 0.1)
    }
    this.group.position.set(this.pos.x, 0, this.pos.z)
    // behind it from the camera, he'd be lost: its solid parts thin out until he's clear
    const bx = this.still.x - this.pos.x
    const bz = this.still.z - this.pos.z
    const along = -(bx + bz) * Math.SQRT1_2
    const across = Math.abs(bx - bz) * Math.SQRT1_2
    const behind = along > 0 && along < ARBITER.seeThrough.reach && across < ARBITER.seeThrough.half
    this.fade += ((behind ? ARBITER.seeThrough.opacity : 1) - this.fade) * Math.min(1, dt * 8 || 1)
    for (const m of [this.mat, this.jointMat]) {
      m.opacity = this.fade
      m.depthWrite = this.fade > 0.99
    }
    // its glows thin out with it; the lens itself stays, small, so its gaze is still read
    this.halo.material.opacity *= 0.35 + 0.65 * this.fade
    this.backHalo.material.opacity *= 0.35 + 0.65 * this.fade

    // the gaze on the floor: a faint ember wash, off while it vents; fading into the lance's line as it tracks
    const order = tellOrder(this.state === 'track' ? ARBITER.lance.trackMs + ARBITER.lance.lockMs - t : 2000)
    const watching = this.state === 'watch' || this.state === 'shellAim' || this.state === 'scaldWind' || this.state === 'judder'
    const base = ARBITER.wedge.opacity * trackingDim()
    this.wedgeMeshes.forEach((mesh, i) => {
      const has = i < this.wedges.length && !this.asleep && !this.dead
      let o = 0
      if (has && this.state === 'unfold') o = base * this.lensLit
      else if (has && watching) o = base
      else if (has && this.state === 'track') o = i === this.owner ? base * (1 - Math.min(1, t / ARBITER.lance.trackMs)) : base
      const m = this.wedgeMats[i]!
      m.opacity += (o - m.opacity) * Math.min(1, dt * 12 || 1)
      mesh.visible = m.opacity > 0.002
      // a flat circle's rotation.z maps to the floor mirrored: +π puts its +y edge on the angle
      mesh.rotation.z = (this.wedges[i] ?? 0) + Math.PI
      mesh.position.set(this.pos.x, DECAL_Y, this.pos.z)
      mesh.renderOrder = order
      // its lit edge leads the way it turns (the floor's mirroring flips the sense)
      m.uniforms.uSweep!.value = this.omega > 0 ? 1 : -1
    })
    // tracking: the wedge narrows to a line down the aim, brightening as it comes
    if (this.state === 'track') {
      const s = this.lanceStart(new THREE.Vector3())
      const f = Math.min(1, t / ARBITER.lance.trackMs)
      // the rails close from the wedge's width onto the lance's hit edge
      const half = 1.4 + (ARBITER.lance.halfW - 0.04 - 1.4) * f
      const nx = Math.cos(this.aim)
      const nz = -Math.sin(this.aim)
      for (const [i, side] of [[0, -1], [1, 1]] as const) {
        this.gaze.set(i, s.x + nx * half * side, s.z + nz * half * side, this.gazeEnd.x + nx * half * side, this.gazeEnd.z + nz * half * side, 0.04, DECAL_Y + 0.004)
      }
      this.gazeWash.set(0, s.x, s.z, this.gazeEnd.x, this.gazeEnd.z, half, DECAL_Y + 0.002)
      this.gazeMat.opacity = (0.25 + 0.45 * f) * trackingDim()
      this.gazeWashMat.opacity = 0.06 + 0.1 * f
    } else {
      this.gazeMat.opacity = Math.max(0, this.gazeMat.opacity - dt * 10)
      this.gazeWashMat.opacity = Math.max(0, this.gazeWashMat.opacity - dt * 10)
    }
    this.gaze.mesh.visible = this.gazeMat.opacity > 0.002
    this.gazeWash.mesh.visible = this.gazeWashMat.opacity > 0.002
    this.gazeWash.mesh.renderOrder = order + 0.05
    this.gaze.mesh.renderOrder = order + 0.1
    // the shell's aim: a faint ring following his lead point
    this.shellRingMat.opacity = this.state === 'shellAim' ? 0.16 * trackingDim() : Math.max(0, this.shellRingMat.opacity - dt * 8)
    this.shellRing.visible = this.shellRingMat.opacity > 0.002
    this.shellRing.position.set(this.lead.x, DECAL_Y, this.lead.z)
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt
    this.flash = Math.max(0, this.flash - dt * 5)
    this.headYaw = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.present(dt)
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    if (!asleep && this.state === 'asleep') {
      this.flash = 1
      this.aimNext = true
      this.go('unfold')
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group, this.tellGroup, this.worldGroup)
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose()
    })
    for (const m of [this.mat, this.jointMat, this.lensMat, this.backMat, this.coreMat, this.halo.material, this.backHalo.material]) m.dispose()
    for (const m of this.wedgeMeshes) m.geometry.dispose()
    for (const m of this.wedgeMats) releaseTell(m)
    this.gaze.dispose()
    this.gazeWash.dispose()
    releaseTell(this.gazeMat)
    releaseTell(this.gazeWashMat)
    this.shellRing.geometry.dispose()
    releaseTell(this.shellRingMat)
  }
}

const CORE_C = new THREE.Color(CORE)
const WHITE = new THREE.Color(0xffffff)
const SOOT = new THREE.Color(0x2c2624)
const STEAM = new THREE.Color(0x6f7780)

/** A dead tower: the lattice and base dark, the head tipped forward, no lenses. Solid where its footprint was. */
export function arbiterHusk(x: number, z: number, headYaw: number): THREE.Group {
  const mat = new THREE.MeshStandardMaterial({ color: HUSK, roughness: 0.8, metalness: 0.5 })
  finish(mat, HIDES.arbiter.finish)
  const body = buildBody(mat, mat)
  const g = new THREE.Group()
  body.head.rotation.set(0.4, headYaw, 0)
  g.add(body.base, body.lattice, body.boiler, body.collar, body.mortarPivot, body.head)
  g.position.set(x, 0, z)
  g.name = 'arbiter:husk'
  return g
}
