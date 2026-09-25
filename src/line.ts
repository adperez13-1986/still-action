import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { skin } from './kit'
import { finish, hideMaterials } from './hide'
import { CORE, CORE_ASLEEP } from './enemy'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, tellOrder, haloTexture, EMBER } from './vfx'
import { Quads } from './lane'
import type { Circle, Level, Room } from './dungeon'
import type { Hazard, HazardShape, HazardSpec } from './hazard'
import type { LockBook } from './combat'

/**
 * The Line (design/area3/SPEC.md §2.2, §4, §5): straight rail lines across rooms and corridors,
 * wall to wall into the fog, dead sidings inside rooms, and the trains that run the live lines
 * on a seeded timetable. Every piece is a primitive.
 *
 *   scheduled → (live; booked, slip ≤ 600) → coming (800) → committed (1200) → passing → gone
 */

export const LINE = {
  /** Where Still's centre is hit, either side of the lane's centre line. INV: the rail tell's wash is exactly this. */
  halfW: 1.2,
  /** Rails at ±gauge/2 from the centre line. */
  gauge: 1.0,
  /** Rails run this far past each wall gap into the fog. */
  railOut: 14,
  /** One floor cell. */
  segment: 4,
  speed: 14,
  rakeLen: 7.0,
  comingMs: 800, committedMs: 1200,
  damage: 20,
  shove: { along: 2.0, across: 1.8 },
  /** s per lane, from the rail stream. */
  period: [16, 22] as const,
  liveR: 22,
  slipStepMs: 50, slipMaxMs: 600,
  buzzR: 0.8,
  stepOff: { speed: 4.5, pad: 0.3 },
  broodPad: 1.0,
  signalQuietS: 4,
}

/** A siding: rail ends 12 u apart through a room's centre line, buffers just past them. */
export const SIDING = { half: 6, bufferAt: 6.6, bufferR: 0.6, wagonR: 0.75, wagonAt: 0.5 }

export interface LaneDef {
  id: number
  kind: 'room' | 'crossing'
  /** The floor span: a is where a +dir train enters the floor, b where it leaves. Axis-aligned; a is the smaller coordinate. */
  ax: number; az: number; bx: number; bz: number
  /** The rails' full extent, railOut past each gap. */
  outA: { x: number; z: number }; outB: { x: number; z: number }
  /** The crossed room (null for a crossing). */
  room: Room | null
  /** key(i, j) of the crossed corridor cell. */
  corridor: string | null
  /** s */
  period: number
  /** s, first scheduled tell start */
  phase: number
  /** Depth 4's first lane (lowest progress): packless, and its first train is the harmless lesson. */
  lesson: boolean
}

export interface SidingDef {
  id: number
  room: Room
  /** Rail ends (buffer faces). Axis-aligned, 12 u apart, inside the room. */
  ax: number; az: number; bx: number; bz: number
  /** The two buffers: solid circles r 0.6 just past each end. */
  buffers: [Circle, Circle]
  holds: 'handcar' | 'wagon' | 'sleepers' | 'empty'
}

/** Distance from a point to a segment. */
export function distToSpan(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az
  const l2 = dx * dx + dz * dz
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0
  return Math.hypot(x - (ax + dx * t), z - (az + dz * t))
}

// --- the pieces (§4.3): instanced, built once per level -------------------------------

/** Worn steel on the live rails; rust on the dead. INV: the siding rail never carries a tell. */
const LIVE_RAIL = 0x4b4e52
const SIDING_RAIL = 0x46362c
const RAIL = { w: 0.09, h: 0.12, sleeper: { w: 1.6, h: 0.08, d: 0.25, every: 0.8 } }
/** The floor tiles stand up to ~0.1 (DECAL_Y): the track is laid on them, not in them. */
const BED = 0.06
/** The coping at a platform's edge (the station's halls): look only, never solid. */
const COPING = { w: 0.3, h: 0.02 }
const LAMP = { post: [0.12, 1.3, 0.12] as const, lamp: 0.2, out: 1.0 }
const WAGON = { l: 1.9, h: 0.9, w: 1.5, wheelR: 0.28, top: 1.1 }
const BUFFER = { beam: [1.6, 0.45, 0.3] as const, beamY: 0.55, post: [0.2, 0.8, 0.2] as const }

interface PieceMats {
  live: THREE.MeshStandardMaterial
  dead: THREE.MeshStandardMaterial
  wood: THREE.MeshStandardMaterial
  iron: THREE.MeshStandardMaterial
  paving: THREE.MeshStandardMaterial
  lamp: THREE.MeshBasicMaterial
}
let mats: PieceMats | null = null
/** Shared by every level, never disposed: the materials, and a unit box and wheel. */
function pieceMats(): PieceMats {
  if (mats) return mats
  const live = new THREE.MeshStandardMaterial({ color: LIVE_RAIL, metalness: 0.8, roughness: 0.4 })
  // streaks along the rail: drawn steel, polished by the wheels
  finish(live, { scale: [2, 2, 18], grain: 0.18, roughVar: 0.2, tone: [1.3, 1.3, 1.32], mask: 0.62, toneRough: -0.15, toneMetal: 0.1, bump: 0.1 })
  const dead = new THREE.MeshStandardMaterial({ color: SIDING_RAIL, metalness: 0.3, roughness: 0.9 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(wood, 'wood', { gain: 0.5 })
  const iron = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(iron, 'grate', { gain: 0.45 })
  const paving = new THREE.MeshStandardMaterial({ color: 0xffffff })
  // the platform's edge stone: the floor's set, worn paler, so the edge reads
  skin(paving, 'paving', { gain: 1.6 })
  // the lamp is the lane's tell (stage A4): banked at rest, like a sleeping core. INV: emissive nothing, ever
  const lamp = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })
  mats = { live, dead, wood, iron, paving, lamp }
  return mats
}
let unitBox: THREE.BoxGeometry | null = null
let wheelGeo: THREE.CylinderGeometry | null = null

/** What buildLinePieces made, for the trains (A4) and the checks. */
export interface LinePieces {
  group: THREE.Group
  /** Lamp instance indices per lane id: [one per wall gap]. */
  lamps: Map<number, number[]>
  lampMesh: THREE.InstancedMesh | null
}

/**
 * Rails, sleepers, lamps (live lanes), rusted rails, buffers and dead wagons (sidings), and
 * the platform copings. `copings`: for each station hall lane, the side (+1/−1 across) the
 * platform is on.
 */
export function buildLinePieces(lanes: readonly LaneDef[], sidings: readonly SidingDef[], copings: ReadonlyMap<number, 1 | -1>): LinePieces {
  const m = pieceMats()
  unitBox ??= new THREE.BoxGeometry(1, 1, 1)
  wheelGeo ??= new THREE.CylinderGeometry(WAGON.wheelR, WAGON.wheelR, 0.12, 10).rotateZ(Math.PI / 2)
  const group = new THREE.Group()
  group.name = 'line'
  type Inst = { x: number; y: number; z: number; sx: number; sy: number; sz: number; yaw: number }
  const sets = new Map<string, { mat: THREE.Material; geo: THREE.BufferGeometry; list: Inst[] }>()
  const put = (name: string, mat: THREE.Material, geo: THREE.BufferGeometry, i: Inst) => {
    const s = sets.get(name) ?? { mat, geo, list: [] }
    s.list.push(i)
    sets.set(name, s)
  }
  /** A run of rail pair and sleepers between two points, along an axis. */
  const track = (ax: number, az: number, bx: number, bz: number, rail: THREE.Material, railName: string) => {
    const len = Math.hypot(bx - ax, bz - az)
    const ux = (bx - ax) / len, uz = (bz - az) / len
    const yaw = Math.atan2(ux, uz)
    const cx = (ax + bx) / 2, cz = (az + bz) / 2
    for (const side of [-1, 1]) {
      put(railName, rail, unitBox!, { x: cx + uz * side * 0.5, y: BED + RAIL.sleeper.h + RAIL.h / 2, z: cz - ux * side * 0.5, sx: RAIL.w, sy: RAIL.h, sz: len, yaw })
    }
    const n = Math.floor(len / RAIL.sleeper.every)
    const start = (len - (n - 1) * RAIL.sleeper.every) / 2
    for (let k = 0; k < n; k++) {
      const t = start + k * RAIL.sleeper.every
      put('sleeper', m.wood, unitBox!, { x: ax + ux * t, y: BED + RAIL.sleeper.h / 2, z: az + uz * t, sx: RAIL.sleeper.w, sy: RAIL.sleeper.h, sz: RAIL.sleeper.d, yaw })
    }
  }
  const lamps = new Map<number, number[]>()
  const lampAt: Inst[] = []
  for (const l of lanes) {
    track(l.outA.x, l.outA.z, l.outB.x, l.outB.z, m.live, 'rail:live')
    // a lamp at each wall gap, 1 u outside the rails, just off the floor
    const len = Math.hypot(l.bx - l.ax, l.bz - l.az)
    const ux = (l.bx - l.ax) / len, uz = (l.bz - l.az) / len
    const across = LINE.gauge / 2 + LAMP.out
    const ids: number[] = []
    for (const [ex, ez, s] of [[l.ax, l.az, -1], [l.bx, l.bz, 1]] as const) {
      const x = ex + ux * s * 0.45 + uz * across
      const z = ez + uz * s * 0.45 - ux * across
      put('lamp:post', m.iron, unitBox!, { x, y: LAMP.post[1] / 2, z, sx: LAMP.post[0], sy: LAMP.post[1], sz: LAMP.post[2], yaw: 0 })
      ids.push(lampAt.length)
      lampAt.push({ x, y: LAMP.post[1] + LAMP.lamp / 2, z, sx: LAMP.lamp, sy: LAMP.lamp, sz: LAMP.lamp, yaw: 0 })
    }
    lamps.set(l.id, ids)
    // the platform's edge
    const side = copings.get(l.id)
    if (side) {
      const off = LINE.halfW + 0.15
      put('coping', m.paving, unitBox!, {
        x: (l.ax + l.bx) / 2 + uz * side * off, y: DECAL_Y + COPING.h / 2, z: (l.az + l.bz) / 2 - ux * side * off,
        sx: COPING.w, sy: COPING.h, sz: len, yaw: Math.atan2(ux, uz),
      })
    }
  }
  for (const s of sidings) {
    track(s.ax, s.az, s.bx, s.bz, m.dead, 'rail:siding')
    const len = Math.hypot(s.bx - s.ax, s.bz - s.az)
    const ux = (s.bx - s.ax) / len, uz = (s.bz - s.az) / len
    const yaw = Math.atan2(ux, uz)
    // a buffer stop past each end: a timber beam on two iron posts, across the rails
    for (const b of s.buffers) {
      put('buffer:beam', m.wood, unitBox!, { x: b.x, y: BUFFER.beamY, z: b.z, sx: BUFFER.beam[0], sy: BUFFER.beam[1], sz: BUFFER.beam[2], yaw })
      for (const side of [-1, 1]) {
        put('buffer:post', m.iron, unitBox!, { x: b.x + uz * side * 0.55, y: BUFFER.post[1] / 2, z: b.z - ux * side * 0.55, sx: BUFFER.post[0], sy: BUFFER.post[1], sz: BUFFER.post[2], yaw })
      }
    }
    if (s.holds === 'wagon') {
      // a dead wagon at the centre: an ore tub on four wheels, the length along the rails
      const cx = (s.ax + s.bx) / 2, cz = (s.az + s.bz) / 2
      put('wagon', m.iron, unitBox!, { x: cx, y: WAGON.top - WAGON.h / 2, z: cz, sx: WAGON.w, sy: WAGON.h, sz: WAGON.l, yaw })
      for (const [al, ac] of [[-0.6, -0.62], [0.6, -0.62], [-0.6, 0.62], [0.6, 0.62]] as const) {
        put('wagon:wheel', m.iron, wheelGeo!, { x: cx + ux * al + uz * ac, y: WAGON.wheelR, z: cz + uz * al - ux * ac, sx: 1, sy: 1, sz: 1, yaw })
      }
    }
  }
  const mx = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const build = (name: string, mat: THREE.Material, geo: THREE.BufferGeometry, list: Inst[]) => {
    const inst = new THREE.InstancedMesh(geo, mat, list.length)
    inst.name = name
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.yaw)
      inst.setMatrixAt(i, mx.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.sx, p.sy, p.sz)))
    })
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    group.add(inst)
    return inst
  }
  for (const [name, s] of sets) build(name, s.mat, s.geo, s.list)
  let lampMesh: THREE.InstancedMesh | null = null
  if (lampAt.length) {
    lampMesh = build('lamp', m.lamp, unitBox, lampAt)
    const c = new THREE.Color(CORE_ASLEEP)
    for (let i = 0; i < lampAt.length; i++) lampMesh.setColorAt(i, c)
    lampMesh.instanceColor!.needsUpdate = true
  }
  return { group, lamps, lampMesh }
}

// --- trains (§5) ------------------------------------------------------------------------

export type TrainStage = 'booked' | 'coming' | 'committed' | 'passing' | 'gone'
export interface Train {
  lane: LaneDef
  /** +1 enters at a, −1 enters at b. */
  dir: 1 | -1
  /** Line time of the tell's start (after any slip). */
  t0: number
  /** Line time it was scheduled or called for; t0 − at is the slip (INV ≤ 0.6 s). */
  at: number
  /** 'booked': its moments are in the lock book and its tell hasn't started yet. */
  stage: TrainStage
  lesson: boolean
  /** One per floor segment, sharing one group: this train. */
  hazards: Hazard[]
  /** How it came: the timetable, a call (the Signalman's, a check's), or the lesson. */
  how: 'timetable' | 'call' | 'lesson'
}

/** What the run hears and feels of a train. */
export type LineEvent =
  /** t0: the rail hum starts (panned to the train's side). */
  | { kind: 'coming'; train: Train; from: THREE.Vector3 }
  /** +800: the horn; `buzz` when Still's centre was within halfW + buzzR of the floor span. */
  | { kind: 'commit'; train: Train; from: THREE.Vector3; buzz: boolean }
  /** +1850: 150 ms before the arrival, the other windup voices duck. */
  | { kind: 'duck'; train: Train }
  /** +2000: the front reaches the floor; the wheels start. */
  | { kind: 'arrive'; train: Train }
  /** The tail passed the far out point. */
  | { kind: 'gone'; train: Train }

/** What Combat gives the Line. */
export interface LineHost {
  readonly time: number
  readonly book: LockBook
  addHazard(spec: HazardSpec): Hazard
  /** A room's pack is awake. */
  roomAwake(room: Room): boolean
  /** Train strips break crates, dropping nothing. */
  smashIn(shape: HazardShape, grow: number): void
  emit(ev: LineEvent): void
}

/** The rail tell's look (§5.3): the rails and the wash, coming then committed. */
const TELL = {
  rails: [0.35, 1] as const, wash: [0.12, 0.3] as const, lamps: [0.5, 1] as const,
  /** The rail strips' half-width (0.1 wide), and how fast they sweep in: 1.5× the train. */
  railHalf: 0.05, sweep: 1.5,
  /** The halo round a lit lamp: it has to read at the widest zoom. */
  halo: 1.3, haloOpacity: [0.45, 0.85] as const,
  duckMs: 150,
}
const RAIL_TOP = BED + RAIL.sleeper.h + RAIL.h
/** The wash lies over the sleepers, so they don't cut it. */
const WASH_Y = BED + RAIL.sleeper.h + 0.006

/** The rake's pieces (§4.3). Built once, shared by every lane's rake; the origin is the front, travel along +z. */
interface RakeKit {
  engine: THREE.BufferGeometry
  wagons: THREE.BufferGeometry
  firebox: THREE.BufferGeometry
  enamel: THREE.MeshStandardMaterial
  grate: THREE.MeshStandardMaterial
  fire: THREE.MeshBasicMaterial
}
let rakeKit: RakeKit | null = null
function rakeParts(): RakeKit {
  if (rakeKit) return rakeKit
  const at = (g: THREE.BufferGeometry, x: number, y: number, z: number) => g.translate(x, y, z)
  const wheel = (x: number, z: number) => at(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12).rotateZ(Math.PI / 2), x, 0.28, z)
  // the engine, 2.6 long: boiler r 0.55 × 1.8 (top 1.4), the cab 0.8 × 1.2 × 1.4 behind it, the chimney to 1.7
  const engine = mergeGeometries([
    at(new THREE.BoxGeometry(1.3, 0.16, 2.6), 0, 0.36, -1.3),
    at(new THREE.CylinderGeometry(0.55, 0.55, 1.8, 16).rotateX(Math.PI / 2), 0, 0.85, -0.9),
    at(new THREE.BoxGeometry(1.4, 1.2, 0.8), 0, 0.8, -2.2),
    at(new THREE.CylinderGeometry(0.12, 0.14, 0.5, 10), 0, 1.45, -0.35),
    ...[-0.45, -1.25, -2.05].flatMap((z) => [wheel(-0.5, z), wheel(0.5, z)]),
  ].map((g) => g.toNonIndexed()))!
  // two ore tubs 1.9 × 0.9 × 1.5 (top 1.1), 0.3 apart behind the engine, coupled
  const tub = (z: number) => [
    at(new THREE.BoxGeometry(1.5, 0.9, 1.9), 0, 0.65, z),
    wheel(-0.5, z - 0.6), wheel(0.5, z - 0.6), wheel(-0.5, z + 0.6), wheel(0.5, z + 0.6),
    at(new THREE.BoxGeometry(0.12, 0.12, 0.34), 0, 0.4, z + 1.1),
  ]
  const wagons = mergeGeometries([...tub(-2.6 - 0.3 - 0.95), ...tub(-2.6 - 0.3 - 1.9 - 0.3 - 0.95)].map((g) => g.toNonIndexed()))!
  // the firebox: a slit 0.3 × 0.12 in each side of the cab, its ember core
  const firebox = mergeGeometries([at(new THREE.BoxGeometry(0.02, 0.12, 0.3), -0.71, 0.55, -2.2), at(new THREE.BoxGeometry(0.02, 0.12, 0.3), 0.71, 0.55, -2.2)])!
  const { mat: enamel } = hideMaterials('enamel')
  const grate = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(grate, 'grate', { gain: 0.5 })
  const fire = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
  rakeKit = { engine, wagons, firebox, enamel, grate, fire }
  return rakeKit
}

/** Only for a level built without its rail stream (never, in the generator). */
function fallbackStream(seed: number) {
  let s = Math.abs(seed) % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** One live lane's runtime: its timetable, its current train, its tell and its rake. */
interface LaneRun {
  lane: LaneDef
  len: number
  /** a → b, unit. */
  ux: number; uz: number
  mid: { x: number; z: number }
  nextAt: number
  lessonDone: boolean
  dirs: () => number
  train: Train | null
  rails: Quads
  wash: Quads
  railMat: THREE.ShaderMaterial
  washMat: THREE.ShaderMaterial
  halos: THREE.Sprite[]
  haloMat: THREE.SpriteMaterial
  lamps: number[]
  rake: THREE.Group
  ducked: boolean
}

export class Line {
  readonly lanes: readonly LaneDef[]
  readonly sidings: readonly SidingDef[]
  /** The rail tells, the lamps' halos and the rakes: added to the scene with the level. */
  readonly group = new THREE.Group()
  /** The Line's clock: game time since the level began. */
  t = 0
  private readonly runs: LaneRun[] = []
  private readonly all: Train[] = []
  private readonly lampMesh: THREE.InstancedMesh | null
  private readonly spineAt: Level['spineAt']
  private readonly lampColor = new THREE.Color()
  private litNow: LaneDef[] = []

  constructor(level: Level, seed: number, private readonly host: LineHost) {
    this.lanes = level.lanes ?? []
    this.sidings = level.sidings ?? []
    this.lampMesh = level.lamps?.mesh ?? null
    this.spineAt = level.spineAt
    this.group.name = 'trains'
    const kit = rakeParts()
    const m4 = new THREE.Matrix4()
    for (const lane of this.lanes) {
      const len = Math.hypot(lane.bx - lane.ax, lane.bz - lane.az)
      const railMat = tellMaterial('strip', 1, undefined, undefined, { plain: true })
      const washMat = tellMaterial('strip', 1, undefined, undefined, { plain: true })
      const rails = new Quads(2, railMat)
      const wash = new Quads(1, washMat)
      rails.mesh.name = 'rail-tell'
      wash.mesh.name = 'rail-wash'
      const haloMat = new THREE.SpriteMaterial({ map: haloTexture(), color: EMBER, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
      const lamps = level.lamps?.of.get(lane.id) ?? []
      const halos = lamps.map((i) => {
        const s = new THREE.Sprite(haloMat)
        this.lampMesh?.getMatrixAt(i, m4)
        s.position.setFromMatrixPosition(m4)
        s.scale.setScalar(TELL.halo)
        s.visible = false
        return s
      })
      const rake = new THREE.Group()
      rake.add(new THREE.Mesh(kit.engine, kit.enamel), new THREE.Mesh(kit.wagons, kit.grate), new THREE.Mesh(kit.firebox, kit.fire))
      rake.name = 'rake'
      rake.visible = false
      this.group.add(rails.mesh, wash.mesh, rake, ...halos)
      rails.mesh.visible = wash.mesh.visible = false
      this.runs.push({
        lane, len, ux: (lane.bx - lane.ax) / len, uz: (lane.bz - lane.az) / len, mid: { x: (lane.ax + lane.bx) / 2, z: (lane.az + lane.bz) / 2 },
        // §5.1: the lesson lane runs nothing until its lesson train
        nextAt: lane.lesson ? Infinity : lane.phase, lessonDone: !lane.lesson,
        dirs: level.railStream?.(lane.id) ?? fallbackStream(seed ^ lane.id),
        train: null, rails, wash, railMat, washMat, halos, haloMat, lamps, rake, ducked: false,
      })
    }
  }

  /** Lanes lit now (from t0 until the rake's tail leaves the floor span), as of the last tick. */
  lit(): readonly LaneDef[] {
    return this.litNow
  }
  /** Committed trains (the crowd's locked count): from the horn until the tail leaves the floor. */
  lockedCount(): number {
    let n = 0
    for (const r of this.runs) if (r.train && (r.train.stage === 'committed' || (r.train.stage === 'passing' && this.isLit(r, r.train)))) n++
    return n
  }
  /** Whether (x, z) is within `pad` of a lit lane's floor span (the brood rule's test). */
  nearLit(x: number, z: number, pad: number): boolean {
    return this.lit().some((l) => distToSpan(x, z, l.ax, l.az, l.bx, l.bz) <= pad)
  }
  nextAt(lane: LaneDef): number {
    return this.runOf(lane).nextAt
  }
  trains(): readonly Train[] {
    return this.all
  }
  /** Where a train's rake is (its middle), when it's on the rails. */
  rakeAt(train: Train, out: THREE.Vector3): THREE.Vector3 | null {
    const r = this.runs.find((x) => x.train === train)
    if (!r || train.stage === 'booked' || train.stage === 'gone') return null
    const e = this.t - train.t0
    const mid = LINE.speed * (e - ((LINE.comingMs + LINE.committedMs) / 1000 - LINE.railOut / LINE.speed)) - LINE.rakeLen / 2
    const from = this.fromOf(r, train, out)
    return out.set(from.x + r.ux * train.dir * mid, 0, from.z + r.uz * train.dir * mid)
  }
  /** Seconds since t0 for a train (negative while booked). */
  elapsed(train: Train): number {
    return this.t - train.t0
  }

  /**
   * The Signalman's call: a tell now (with slip), and the lane's schedule restarts from it.
   * Refused while the lane has a train. On the lesson lane before its lesson, it is the lesson.
   */
  call(lane: LaneDef, dir?: 1 | -1): boolean {
    const r = this.runOf(lane)
    if (r.train) return false
    const lesson = !r.lessonDone
    const tr = this.start(r, this.t, lesson ? 'lesson' : 'call', dir)
    r.lessonDone = true
    r.nextAt = tr.t0 + lane.period
    return true
  }

  tick(dt: number, still: THREE.Vector3): void {
    this.t += dt
    for (const r of this.runs) {
      // the lesson: the first tick his centre is inside its room
      if (!r.lessonDone && !r.train && r.lane.room && this.spineAt(still.x, still.z) === r.lane.room) {
        const tr = this.start(r, this.t, 'lesson')
        r.lessonDone = true
        r.nextAt = tr.t0 + r.lane.period
      }
      // the timetable: a start is skipped silently unless the lane is live
      while (r.lessonDone && this.t + 1e-9 >= r.nextAt) {
        const at = r.nextAt
        r.nextAt += r.lane.period
        if (!r.train && this.live(r, still)) this.start(r, at, 'timetable')
      }
      if (r.train) this.advance(r, r.train, dt, still)
      this.draw(r)
    }
    this.litNow = this.runs.filter((r) => r.train && this.isLit(r, r.train)).map((r) => r.lane)
  }

  dispose(): void {
    this.group.removeFromParent()
    for (const r of this.runs) {
      r.rails.dispose()
      r.wash.dispose()
      releaseTell(r.railMat)
      releaseTell(r.washMat)
      r.haloMat.dispose()
      this.setLamps(r, 0)
    }
    this.runs.length = 0
    this.litNow = []
  }

  // --- inside ---

  private runOf(lane: LaneDef): LaneRun {
    const r = this.runs.find((x) => x.lane === lane || x.lane.id === lane.id)
    if (!r) throw new Error(`no lane ${lane.id}`)
    return r
  }

  /** §5.1: Still within liveR of the floor midpoint, or the room's pack awake. */
  private live(r: LaneRun, still: THREE.Vector3): boolean {
    if (Math.hypot(still.x - r.mid.x, still.z - r.mid.z) <= LINE.liveR) return true
    return !!r.lane.room && this.host.roomAwake(r.lane.room)
  }

  private isLit(r: LaneRun, tr: Train): boolean {
    if (tr.stage === 'booked' || tr.stage === 'gone') return false
    return this.t - tr.t0 <= 2 + (r.len + LINE.rakeLen) / LINE.speed + 1e-9
  }

  /**
   * §5.2: a candidate start at `at` (≤ now) needs its commit and its arrival clear of every
   * booked lock; it slips 50 ms at a time, at most 600, then goes regardless. Both are booked.
   */
  private start(r: LaneRun, at: number, how: Train['how'], dir?: 1 | -1): Train {
    const base = (at - this.t) * 1000
    const book = this.host.book
    let slip = 0
    while (slip < LINE.slipMaxMs && !(book.canLock(base + slip + LINE.comingMs) && book.canLock(base + slip + LINE.comingMs + LINE.committedMs))) slip += LINE.slipStepMs
    const tr: Train = {
      lane: r.lane, dir: dir ?? (r.dirs() < 0.5 ? 1 : -1), t0: at + slip / 1000, at, stage: 'booked', lesson: how === 'lesson', hazards: [], how,
    }
    book.book(tr, base + slip + LINE.comingMs)
    book.book(tr, base + slip + LINE.comingMs + LINE.committedMs)
    r.train = tr
    r.ducked = false
    this.all.push(tr)
    return tr
  }

  /** Where the train comes from: its entering out point. */
  private fromOf(r: LaneRun, tr: Train, out = new THREE.Vector3()) {
    const o = tr.dir === 1 ? r.lane.outA : r.lane.outB
    return out.set(o.x, 0, o.z)
  }

  private advance(r: LaneRun, tr: Train, dt: number, still: THREE.Vector3) {
    const e = this.t - tr.t0
    if (tr.stage === 'booked' && e >= -1e-9) {
      tr.stage = 'coming'
      this.spawn(r, tr, e, dt)
      this.host.emit({ kind: 'coming', train: tr, from: this.fromOf(r, tr) })
    }
    if (tr.stage === 'coming' && e >= LINE.comingMs / 1000 - 1e-9) {
      tr.stage = 'committed'
      const buzz = distToSpan(still.x, still.z, r.lane.ax, r.lane.az, r.lane.bx, r.lane.bz) <= LINE.halfW + LINE.buzzR
      this.host.emit({ kind: 'commit', train: tr, from: this.fromOf(r, tr), buzz })
    }
    const arrive = (LINE.comingMs + LINE.committedMs) / 1000
    if (tr.stage === 'committed' && !r.ducked && e >= arrive - TELL.duckMs / 1000 - 1e-9) {
      r.ducked = true
      this.host.emit({ kind: 'duck', train: tr })
    }
    if (tr.stage === 'committed' && e >= arrive - 1e-9) {
      tr.stage = 'passing'
      this.host.emit({ kind: 'arrive', train: tr })
    }
    if (tr.stage === 'passing' && e >= arrive + (r.len + LINE.railOut + LINE.rakeLen) / LINE.speed - 1e-9) {
      tr.stage = 'gone'
      r.train = null
      this.host.emit({ kind: 'gone', train: tr })
    }
  }

  /**
   * §5.4: at t0, one strip hazard per 4-u floor segment, counted from the entering edge. Each arms
   * the tick the rake's front reaches it (2000 + 1000·4k/speed after t0) and stays live until its
   * tail has left it. A hazard made this tick loses this tick too, hence the dt.
   */
  private spawn(r: LaneRun, tr: Train, e0: number, dt: number) {
    const n = Math.max(1, Math.round(r.len / LINE.segment))
    const dx = r.ux * tr.dir, dz = r.uz * tr.dir
    const ex = tr.dir === 1 ? r.lane.ax : r.lane.bx
    const ez = tr.dir === 1 ? r.lane.az : r.lane.bz
    const sh = LINE.shove
    for (let k = 0; k < n; k++) {
      const s0 = (k * r.len) / n, s1 = ((k + 1) * r.len) / n
      const armS = (LINE.comingMs + LINE.committedMs) / 1000 + s0 / LINE.speed
      const spec: HazardSpec = {
        source: 'train',
        shape: { kind: 'strip', ax: ex + dx * s0, az: ez + dz * s0, bx: ex + dx * s1, bz: ez + dz * s1, halfW: LINE.halfW },
        armMs: 1000 * (armS - e0 + dt),
        liveMs: (1000 * (LINE.segment + LINE.rakeLen)) / LINE.speed,
        damage: tr.lesson ? 0 : LINE.damage, cover: 'none', hurt: 'hazard', quiet: true, group: tr,
        shove: tr.lesson || (sh.along === 0 && sh.across === 0) ? undefined : { dx, dz, along: sh.along, across: sh.across },
      }
      tr.hazards.push(this.host.addHazard(spec))
    }
  }

  private setLamps(r: LaneRun, k: number) {
    if (!this.lampMesh?.instanceColor) return
    this.lampColor.setHex(CORE_ASLEEP).lerp(new THREE.Color(CORE), k)
    for (const i of r.lamps) this.lampMesh.setColorAt(i, this.lampColor)
    this.lampMesh.instanceColor.needsUpdate = true
  }

  /** §5.3: the rails sweep in from the train's side and brighten at the commit; the wash lies on the floor span; the lamps. */
  private draw(r: LaneRun) {
    const tr = r.train
    if (!tr || tr.stage === 'booked') {
      if (r.rails.mesh.visible || r.halos[0]?.visible || r.rake.visible) {
        r.rails.mesh.visible = r.wash.mesh.visible = r.rake.visible = false
        for (const h of r.halos) h.visible = false
        r.railMat.opacity = r.washMat.opacity = 0
        this.setLamps(r, 0)
      }
      return
    }
    const e = this.t - tr.t0
    const committed = tr.stage !== 'coming'
    const arriveS = (LINE.comingMs + LINE.committedMs) / 1000
    // along the travel, from the entering out point: the whole rail run is railOut + len + railOut
    const total = r.len + 2 * LINE.railOut
    const front = LINE.speed * (e - (arriveS - LINE.railOut / LINE.speed))
    const tail = front - LINE.rakeLen
    const sweep = Math.min(total, TELL.sweep * LINE.speed * e)
    const from = this.fromOf(r, tr)
    const dx = r.ux * tr.dir, dz = r.uz * tr.dir
    const nx = dz, nz = -dx
    const order = tellOrder((arriveS - e) * 1000)
    // the rails: behind the tail they burn off
    const r0 = Math.max(0, tail), r1 = sweep
    if (r1 > r0 + 0.01) {
      for (const [i, side] of [[0, -1], [1, 1]] as const) {
        const ox = nx * side * (LINE.gauge / 2), oz = nz * side * (LINE.gauge / 2)
        r.rails.set(i, from.x + dx * r0 + ox, from.z + dz * r0 + oz, from.x + dx * r1 + ox, from.z + dz * r1 + oz, TELL.railHalf, RAIL_TOP + 0.004, r0 / 12)
      }
      r.railMat.opacity = TELL.rails[committed ? 1 : 0]
      r.rails.mesh.visible = true
    } else {
      r.railMat.opacity = 0
      r.rails.mesh.visible = false
    }
    // the wash: exactly halfW over the floor span, burning off behind the tail
    const w0 = Math.max(LINE.railOut, tail), w1 = LINE.railOut + r.len
    if (w1 > w0 + 0.01) {
      r.wash.set(0, from.x + dx * w0, from.z + dz * w0, from.x + dx * w1, from.z + dz * w1, LINE.halfW, WASH_Y, w0 / 12)
      r.washMat.opacity = TELL.wash[committed ? 1 : 0]
      r.wash.mesh.visible = true
    } else {
      r.washMat.opacity = 0
      r.wash.mesh.visible = false
    }
    r.rails.mesh.renderOrder = order + 0.2
    r.wash.mesh.renderOrder = order
    // the lamps: ember while the lane is lit
    const lit = this.isLit(r, tr)
    this.setLamps(r, lit ? TELL.lamps[committed ? 1 : 0] : 0)
    r.haloMat.opacity = lit ? TELL.haloOpacity[committed ? 1 : 0] : 0
    for (const h of r.halos) h.visible = lit
    // the rake: seen through the fog for its last second before the floor
    r.rake.visible = front >= 0 && tail <= total
    if (r.rake.visible) {
      r.rake.position.set(from.x + dx * front, 0, from.z + dz * front)
      r.rake.rotation.y = Math.atan2(dx, dz)
    }
  }
}
