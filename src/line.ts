import * as THREE from 'three'
import { skin } from './kit'
import { finish } from './hide'
import { CORE_ASLEEP } from './enemy'
import { DECAL_Y } from './world'
import type { Circle, Room } from './dungeon'

/**
 * The Line (design/area3/SPEC.md §2.2, §4): straight rail lines across rooms and corridors,
 * wall to wall into the fog, and dead sidings inside rooms. This file owns the data and the
 * pieces; the trains that run the live lines come in stage A4. Every piece is a primitive.
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
