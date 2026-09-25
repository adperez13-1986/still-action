import * as THREE from 'three'
import { buildInstanced, pieceData, skin, type Placement } from './kit'
import { PLACES, type RouteId } from './areas'
import {
  CELL, COLD_BEAM, BEAM_H, key, rng, pickFloor, buildWalls, buildBeyond, makeBeam, makeTerrain,
  type Box, type Circle, type Level, type LevelMade, type Room,
} from './dungeon'
import { hideMaterials } from './hide'
import type { Vfx } from './vfx'

/**
 * The crossroads (design/area3/SPEC.md §3): the quiet room after the Assembler, when the
 * Line is open. Two cold beams, one to the Works and one to the Line, open from the first
 * tick, with nothing that can hurt him or cost him strain. It keeps "on or home" the run's
 * only binary decision: both beams here go on. Built on the ruin's kit, like the depth it
 * follows. INV: nothing in it is ember.
 */

/** Screen right and up on the ground, as the camera (at +x +z) sees it. */
export const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize()
export const SCREEN_UP = new THREE.Vector3(-1, 0, -1).normalize()

export const CROSSROADS = {
  /** Still arrives in the near corner, facing screen-up. */
  arrive: new THREE.Vector3(2.47, 0, 2.47),
  facing: Math.atan2(SCREEN_UP.x, SCREEN_UP.z),
  /** INV: II far left, III far right; 6.0 u apart, 7.6 u from the arrival. */
  roads: [
    { route: 'II' as RouteId, at: new THREE.Vector3(-4.6, 0, -0.35), label: 'the Works' },   // PLACEHOLDER words (Adrian's)
    { route: 'III' as RouteId, at: new THREE.Vector3(-0.35, 0, -4.6), label: 'the Line' },   // PLACEHOLDER words (Adrian's)
  ],
  /** Two ruin crates, solid, never breakable. */
  crates: [[3.2, -3.2], [-3.2, 3.2]] as [number, number][],
  crateR: 0.7,
  /** The Works' frame stands this far behind its beam, along screen-up; soot rises from its top this often. */
  frameBack: 1.4,
  smokeEvery: 0.6,
  smokeColor: 0x2c2826,
  /** The Line's signal post stands this far to screen-right of its beam. */
  postSide: 1.1,
  /** Beam labels: alpha smoothstep(fadeFar, fadeNear, distance) from Still's centre. */
  fadeFar: 5,
  fadeNear: 3,
  labelY: 2.6,
}

/** The label names, by route (the alternate's dressed yard beam uses them too). */
export const ROAD_LABEL: Record<RouteId, string> = { II: CROSSROADS.roads[0]!.label, III: CROSSROADS.roads[1]!.label }

/** A road label's alpha at a distance: 0 beyond 5 u, 1 inside 3 u. */
export function labelAlpha(d: number) {
  const k = Math.min(1, Math.max(0, (CROSSROADS.fadeFar - d) / (CROSSROADS.fadeFar - CROSSROADS.fadeNear)))
  return k * k * (3 - 2 * k)
}

// --- the dressing: shared by the crossroads and the alternate's yard beam -------------

/** The siding look (§4.3): rusted rail, never lit. INV: no tell ever lands on it. */
const RUSTED_RAIL = 0x46362c
/** A signal lamp that isn't lit: dark glass, no emissive. INV: nothing in the crossroads is ember. */
const DARK_LAMP = 0x1a1614
const RAIL = { w: 0.09, h: 0.12, gauge: 1.0, sleeper: [1.6, 0.08, 0.25] as const, sleeperEvery: 0.8 }

let railMat: THREE.MeshStandardMaterial | null = null
let sleeperMat: THREE.MeshStandardMaterial | null = null
let lampMat: THREE.MeshStandardMaterial | null = null
let postMats: { mat: THREE.MeshStandardMaterial; jointMat: THREE.MeshStandardMaterial } | null = null
function materials() {
  railMat ??= new THREE.MeshStandardMaterial({ color: RUSTED_RAIL, metalness: 0.3, roughness: 0.9 })
  if (!sleeperMat) {
    sleeperMat = new THREE.MeshStandardMaterial({ color: 0x3a2e24 })
    skin(sleeperMat, 'wood', { gain: 0.45 })
  }
  lampMat ??= new THREE.MeshStandardMaterial({ color: DARK_LAMP, roughness: 0.35, metalness: 0.2, emissive: 0x000000 })
  postMats ??= hideMaterials('signal')
  return { railMat, sleeperMat: sleeperMat!, lampMat, postMats: postMats! }
}

/** What a dressing adds: meshes (its own geometry, freed on dispose), solids, and where its smoke rises. */
export interface Dressing {
  group: THREE.Group
  circles: Circle[]
  smoke: THREE.Vector3[]
  /** Kit placements (the Works' frame), for the caller's instanced build. */
  placements: Placement[]
  dispose(): void
}

/**
 * A road's dressing at a beam (§3.3). The Works: a gated frame behind it, facing the camera,
 * soot rising from its top. The Line: two rusted rails running from `railFrom` into the beam's
 * foot (and on past the floor into the fog), and a timber signal post beside it, its lamp dark.
 */
export function dressRoad(route: RouteId, at: THREE.Vector3, railFrom?: THREE.Vector3): Dressing {
  const group = new THREE.Group()
  group.name = `road:${route}`
  const circles: Circle[] = []
  const smoke: THREE.Vector3[] = []
  const placements: Placement[] = []
  const geos: THREE.BufferGeometry[] = []
  const box = (w: number, h: number, d: number) => {
    const g = new THREE.BoxGeometry(w, h, d)
    geos.push(g)
    return g
  }
  if (route === 'II') {
    const f = at.clone().addScaledVector(SCREEN_UP, CROSSROADS.frameBack)
    // its face toward the camera (+x +z): the piece's front is +z
    placements.push({ piece: 'wall_gated', x: f.x, z: f.z, rotY: Math.PI / 4 })
    smoke.push(new THREE.Vector3(f.x, pieceData('wall_gated').height, f.z))
  } else {
    const m = materials()
    // the rails: along the axis from railFrom to the foot, gauge apart
    const from = railFrom ?? at.clone().addScaledVector(SCREEN_RIGHT, 6)
    const dx = at.x - from.x, dz = at.z - from.z
    const len = Math.hypot(dx, dz)
    const ux = dx / len, uz = dz / len
    const yaw = Math.atan2(ux, uz)
    const mid = new THREE.Vector3((at.x + from.x) / 2, 0, (at.z + from.z) / 2)
    const rail = box(RAIL.w, RAIL.h, len)
    for (const side of [-1, 1]) {
      const r = new THREE.Mesh(rail, m.railMat)
      r.position.set(mid.x + uz * side * RAIL.gauge / 2, RAIL.h / 2 + 0.08, mid.z - ux * side * RAIL.gauge / 2)
      r.rotation.y = yaw
      group.add(r)
    }
    const n = Math.floor(len / RAIL.sleeperEvery)
    const sl = new THREE.InstancedMesh(box(...RAIL.sleeper), m.sleeperMat, n)
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
    const mx = new THREE.Matrix4()
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) * RAIL.sleeperEvery
      mx.compose(new THREE.Vector3(at.x - ux * t, RAIL.sleeper[1] / 2, at.z - uz * t), q, new THREE.Vector3(1, 1, 1))
      sl.setMatrixAt(i, mx)
    }
    sl.instanceMatrix.needsUpdate = true
    sl.computeBoundingSphere()
    group.add(sl)
    // the signal post, screen-right of the beam: a timber post, an arm, a lamp that isn't lit
    const p = at.clone().addScaledVector(SCREEN_RIGHT, CROSSROADS.postSide)
    const post = new THREE.Mesh(box(0.18, 2.5, 0.18), m.postMats.mat)
    post.position.set(p.x, 1.25, p.z)
    const arm = new THREE.Mesh(box(0.9, 0.12, 0.06), m.postMats.mat)
    arm.position.set(p.x + SCREEN_RIGHT.x * 0.4, 2.2, p.z + SCREEN_RIGHT.z * 0.4)
    arm.rotation.set(0, Math.atan2(-SCREEN_RIGHT.z, SCREEN_RIGHT.x), 0.5)
    const strap = new THREE.Mesh(box(0.22, 0.08, 0.22), m.postMats.jointMat)
    strap.position.set(p.x, 1.9, p.z)
    const lamp = new THREE.Mesh(box(0.24, 0.26, 0.24), m.lampMat)
    lamp.name = 'lamp:dark'
    lamp.position.set(p.x, 2.62, p.z)
    group.add(post, arm, strap, lamp)
    circles.push({ x: p.x, z: p.z, r: 0.2 })
  }
  return {
    group, circles, smoke, placements,
    dispose() {
      group.removeFromParent()
      for (const g of geos) g.dispose()
      group.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose() })
    },
  }
}

// --- the room ----------------------------------------------------------------------

/**
 * §3.2. Cells −1..1 (a 12 u square round the origin) on the ruin's kit, its walls and its
 * beyond by the same code path; two solid crates; the two road beams, open from the first
 * tick. No packs, no crates that break, no shrine, no warm beam, no lean.
 */
export type CrossroadsLevel = Level & { roads: NonNullable<Level['roads']>; crossroads: true; smoke: THREE.Vector3[] }

export function generateCrossroads(seed: number): CrossroadsLevel {
  const place = PLACES.ruin
  const kit = place.kit
  const rand = rng(seed)
  const floor = new Set<string>()
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) floor.add(key(i, j))
  const cells = [...floor].map((k) => k.split(',').map(Number) as [number, number])
  const placements: Placement[] = []
  const boxes: Box[] = []
  const circles: Circle[] = []
  const made: LevelMade = { props: [], tall: [], floors: [], edge: [], far: [] }
  for (const [i, j] of cells) {
    const piece = pickFloor(kit.floorRoom, rand())
    placements.push({ piece, x: i * CELL, z: j * CELL, rotY: Math.floor(rand() * 4) * (Math.PI / 2) })
    made.floors.push({ piece, p: 0, corridor: false })
  }
  buildWalls(cells, floor, kit, placements, boxes, circles)
  for (const [x, z] of CROSSROADS.crates) {
    placements.push({ piece: 'crates_stacked', x, z, rotY: Math.floor(rand() * 4) * (Math.PI / 2) })
    circles.push({ x, z, r: CROSSROADS.crateR })
    made.props.push({ piece: 'crates_stacked', x, z, top: pieceData('crates_stacked').height, p: 0, breakable: false, intact: false, room: 0 })
  }
  // the Line's rails run in from the fog past the far-right wall; nothing of the beyond stands on them
  const line = CROSSROADS.roads[1]!.at
  const railFrom = new THREE.Vector3(line.x, 0, -1.5 * CELL - 12)
  const onRails = (x: number, z: number) => Math.abs(x - line.x) < 2.5 && z < line.z + 1
  const { minI, maxI, minJ, maxJ, spanX, spanZ } = buildBeyond(cells, floor, rand, kit, placements, onRails, { made })
  const dressings = CROSSROADS.roads.map((r) => dressRoad(r.route, r.at, r.route === 'III' ? railFrom : undefined))
  for (const d of dressings) {
    placements.push(...d.placements)
    circles.push(...d.circles)
  }

  const group = buildInstanced(placements)
  for (const d of dressings) group.add(d.group)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x151b24 })
  skin(groundMat, 'ground')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 80, spanZ + 80), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(((minI + maxI) / 2) * CELL, -0.12, ((minJ + maxJ) / 2) * CELL)
  group.add(ground)

  // the two roads: cold beams, both on from the first tick
  const beams = CROSSROADS.roads.map((r) => {
    const b = makeBeam(COLD_BEAM, BEAM_H)
    b.group.name = `beam:road:${r.route}`
    b.group.position.copy(r.at)
    group.add(b.group)
    return b
  })

  const room: Room = { kind: 'entrance', ci: 0, cj: 0, rx: 1, rz: 1, center: new THREE.Vector3() }
  const smoke = dressings.flatMap((d) => d.smoke)
  const level: CrossroadsLevel = {
    depth: 3,
    place: place.id,
    floor,
    progressOf: () => 0,
    spineAt: () => null,
    made,
    group,
    terrain: makeTerrain(floor, boxes, circles),
    exitOpen: false,
    openExit() {},
    home: null,
    homeOpen: false,
    openHome() {},
    homeGlow: 1,
    packs: [],
    breakables: [],
    shrines: [],
    smash() {},
    rooms: [room],
    entrance: CROSSROADS.arrive.clone(),
    // unused (the lean is off): the midpoint of the two roads
    exit: new THREE.Vector3(-2.47, 0, -2.47),
    roads: CROSSROADS.roads.map((r) => ({ route: r.route, at: r.at.clone(), label: r.label })),
    crossroads: true,
    smoke,
    update(t) {
      for (const b of beams) b.update(t)
    },
    dispose() {
      group.removeFromParent()
      ground.geometry.dispose()
      groundMat.dispose()
      for (const b of beams) b.dispose()
      for (const d of dressings) d.dispose()
      for (const o of group.children) if (o instanceof THREE.InstancedMesh) o.dispose()
    },
  }
  return level
}

/** Soot from the Works' frame every 0.6 s (the crossroads, and the alternate's dressed beam). */
export class RoadSmoke {
  private t = 0
  tick(dt: number, vfx: Vfx, at: readonly THREE.Vector3[]) {
    if (!at.length) return
    this.t -= dt
    if (this.t > 0) return
    this.t = CROSSROADS.smokeEvery
    for (const p of at) vfx.smokePuff(p, 1, new THREE.Color(CROSSROADS.smokeColor))
  }
}
