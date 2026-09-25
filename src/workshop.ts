import * as THREE from 'three'
import { grade, DECAL_Y, type World } from './world'
import { buildInstanced, pieceData, doorLeaf, skin, type Placement } from './kit'
import { makeTerrain, makeBeam, key, COLD_BEAM, BEAM_H, type Box, type Circle } from './dungeon'
import type { Terrain } from './terrain'
import { SLOT_NAMES, type SlotName, type Still } from './still'
import { PARTS } from './abilities'
import type { HomeHour } from './areas'
import type { EndingKind, PartId, SaveV1 } from './save'
import { COLD, type Vfx } from './vfx'
import * as sfx from './audio'

/**
 * Home: the Workshop. A small iso room in the same engine, built once at boot and
 * hidden during runs, and the only warm place in the game. Grace's light is its
 * lamp. Still walks it with the stick and interacts by walking up to things;
 * the way out is the cold beam in the doorway.
 *
 * The camera looks from +x,+z, so the north (z = -6) and west (x = -6) walls are
 * the tall back walls, and the south and east edges are waist-high barriers.
 * Yanah and Yuri are here from the first night, as traces only: their door,
 * their shoes, their blocks and crayons, and what you hear of them. Never figures.
 *
 * Every number here is a starting value for the phone (design/meta/SPEC.md §5).
 */

export type InteractId = 'wall:head' | 'wall:torso' | 'wall:arms' | 'wall:legs' | 'hook' | 'board' | 'notebook' | 'doorframe'
export interface Interactable {
  id: InteractId
  /** Nearest anchor wins when zones overlap. */
  anchor: { x: number; z: number }
  radius: number
  /** Wall sections use a rect, not a radius. */
  rect?: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** The camera eases halfway toward this. */
  focus: { x: number; z: number }
  /** rig.hold while near. */
  zoom: number
}
export type ArrivalKind = EndingKind | 'idle'
export interface ArrivalState { kind: ArrivalKind; t: number; step: number; done: boolean }
export interface TraceSet {
  kidsDoor: 'open-dark' | 'swings-shut' | 'ajar'
  /** Two small pairs by the front door. */
  shoes: boolean
  blocks: 'scattered' | 'tower' | 'boxed'
  crayons: boolean
  sounds: { steps: boolean; pencilEvery: [number, number] | null; tumble: boolean; rain: boolean }
}
export type WorkshopEvent =
  | { kind: 'arrived' }
  | { kind: 'near'; id: InteractId | null }
  | { kind: 'door' }
  /** Broken's reassembly: a part seated (the click and sparks are played here; main may add more). */
  | { kind: 'seat'; slot: SlotName }

export interface Workshop {
  readonly group: THREE.Group
  readonly terrain: Terrain
  readonly beam: { x: number; z: number; radius: number }
  enter(o: { arrival: ArrivalKind; hour: HomeHour; worn: (PartId | null)[] }): void
  leave(): void
  /** One fixed step: arrival script, stick movement, collisions, zones, the beam. */
  update(dt: number, stickX: number, stickZ: number): WorkshopEvent[]
  /** Rebuild what the save shows. Step 3: the prompts read it; plaques, cards and marks come later. */
  refresh(s: SaveV1): void
  readonly near: InteractId | null
  readonly traces: TraceSet
  readonly arrival: ArrivalState
  /** 1 is black, 0 is clear: the fade in from black that every arrival starts with. */
  readonly blackout: number
  /** Where the camera looks, and its hold, eased. */
  readonly focus: THREE.Vector3
  readonly hold: number
  /** The card for what he's standing at (PLACEHOLDER copy, Adrian's). */
  promptFor(id: InteractId, s: SaveV1): { title: string; line: string; action: string | null }
}

// --- the plan -------------------------------------------------------------------

const BODY_R = 0.42
/** The fade in from black before any arrival starts. */
const FADE_IN = 0.6
/** The door beam: walking into it starts the next run. The doorway is narrower than the beam, so there's no way round it. */
const DOOR = { x: 4, z: -5.3, radius: 1.1 }
/**
 * Grace's light, the lamp: over the bench, a step in from the window (any nearer and
 * the wall beside it burns white). It doesn't follow him here.
 */
const LAMP = new THREE.Vector3(-3.4, 3.8, 0.3)
const BENCH = { x: -4.6, z: 0, scale: 0.8 }
const STOOL = { x: -4.9, z: 2.4 }
/**
 * The kids' corner, by the corkboard. The camera only sees faces that point +x/+z,
 * and the lamp lights those only on things west of it: anywhere east, the tower is a black post.
 */
const BLOCKS = { x: -4.6, z: 4.9 }
const CRAYONS = { x: -3.8, z: 3.0 }
const SHOES = { x: 5.3, z: -4.4 }
/** The kids' door, in the west wall: their room is never entered. */
const KIDS_DOOR = { x: -6, z: -4 }

/** Arrivals (§5.5). */
const SPOT = {
  broken: { x: -3.35, z: 0, facing: Math.PI / 2 },
  stopped: { x: -3.35, z: 0.4, facing: -Math.PI / 2 },
  home: { x: 4, z: -8.2, facing: 0 },
  idle: { x: -1.5, z: 1.5, facing: -Math.PI / 2 },
}
const REASSEMBLY = { order: ['legs', 'torso', 'arms', 'head'] as SlotName[], each: 0.42, gap: 0.18 }
/** Where each part lies on the bench top, along it (legs, torso, arms, head). */
const BENCH_Z: Record<SlotName, number> = { legs: -0.9, torso: -0.3, arms: 0.3, head: 0.9 }
const STOP_SECONDS = 3.4
const HOME_WALK = 0.9
/** Home: the grade eases from the run's to the room's over this, from the threshold. */
const HOME_EASE = 1.2

/** §5.6. Nearest anchor wins among the zones he's inside. */
const ZONES: Interactable[] = [
  ...(['head', 'torso', 'arms', 'legs'] as const).map((slot, i): Interactable => {
    const x = -4.5 + i * 1.8
    return { id: `wall:${slot}`, anchor: { x, z: -4.5 }, radius: 0, rect: { minX: x - 0.9, maxX: x + 0.9, minZ: -6, maxZ: -3.6 }, focus: { x, z: -5.5 }, zoom: 1.3 }
  }),
  { id: 'hook', anchor: { x: 2.4, z: -4.5 }, radius: 0.8, focus: { x: 2.4, z: -5.5 }, zoom: 1.3 },
  { id: 'board', anchor: { x: -4.5, z: 3.9 }, radius: 1.1, focus: { x: -5.5, z: 3.9 }, zoom: 1.35 },
  // off the bench's end, where he can stand (the book lies on the bench at z 1.1)
  { id: 'notebook', anchor: { x: -3.3, z: 1.2 }, radius: 0.9, focus: { x: -4.2, z: 1.1 }, zoom: 1.3 },
  { id: 'doorframe', anchor: { x: -4.6, z: -2.4 }, radius: 0.9, focus: { x: -6, z: -3 }, zoom: 1.4 },
]

/** The room's grade (§6.1, `workshop`): multipliers on the tuned grade. Morning in the maze is 1 on all of them. */
const ROOM = { sat: 1.18, exposure: 1, vignette: 0.55, fog: 2, fogColor: 0x0b0f16, background: 0x070a0e, hemi: 0.6, keyPos: [-14, 9, 2] as const }
/** Through the window, by the hour (§5.3). Daylight is always cold; warm is only for Grace. */
const WINDOW: Record<HomeHour, { sky: number; key: number; keyColor: number; grace: number }> = {
  morning: { sky: 0x9fb3cc, key: 0.45, keyColor: 0x9fb8dc, grace: 1.0 },
  noon: { sky: 0xc4d2e2, key: 0.55, keyColor: 0xb8c8e0, grace: 0.9 },
  afternoon: { sky: 0x93a3ba, key: 0.4, keyColor: 0x98a8c4, grace: 1.0 },
  dusk: { sky: 0x4a5670, key: 0.22, keyColor: 0x7c86a6, grace: 1.15 },
  night: { sky: 0x121826, key: 0.08, keyColor: 0x6c7c9e, grace: 1.3 },
}
/** The maze's own light, as world.ts builds it: what leaving the room puts back. */
const RUN = { hemi: 1.6, key: 1.15, keyColor: 0x8fb0da, keyPos: [-8, 14, -6] as const, fogColor: 0x0b1018, background: 0x070a0e, graceDist: 34 }
/** Short enough that her light stops at the barriers: the ruins outside stay cold and dark. */
const ROOM_GRACE_DIST = 16
/** The boards: wider planks than a crate's and a darker, richer brown; the walls darker still. */
const FLOOR_WOOD = { scale: 3.2, gain: 0.62 }
const WALL_WOOD = { gain: 0.5 }

/** The kids, as traces. Static at the afternoon until the one-day step gives each hour its own. */
const AFTERNOON: TraceSet = {
  kidsDoor: 'swings-shut', shoes: true, blocks: 'tower', crayons: true,
  sounds: { steps: true, pencilEvery: [8, 15], tumble: true, rain: false },
}
const tracesFor = (_hour: HomeHour): TraceSet => AFTERNOON

// --- light -----------------------------------------------------------------------

interface Light {
  sat: number; vignette: number; exposure: number; fogNear: number; fogFar: number
  fog: THREE.Color; bg: THREE.Color; hemi: number; key: number; keyColor: THREE.Color; keyPos: THREE.Vector3
  grace: number; graceDist: number
}
const newLight = (): Light => ({
  sat: 0, vignette: 0, exposure: 0, fogNear: 0, fogFar: 0, fog: new THREE.Color(), bg: new THREE.Color(),
  hemi: 0, key: 0, keyColor: new THREE.Color(), keyPos: new THREE.Vector3(), grace: 0, graceDist: 0,
})

function roomLight(hour: HomeHour, out = newLight()): Light {
  const w = WINDOW[hour]
  out.sat = grade.saturation * ROOM.sat
  out.vignette = grade.vignette * ROOM.vignette
  out.exposure = grade.exposure * ROOM.exposure
  out.fogNear = grade.fogNear * ROOM.fog
  out.fogFar = grade.fogFar * ROOM.fog
  out.fog.setHex(ROOM.fogColor)
  out.bg.setHex(ROOM.background)
  out.hemi = RUN.hemi * ROOM.hemi
  out.key = RUN.key * w.key
  out.keyColor.setHex(w.keyColor)
  out.keyPos.set(...ROOM.keyPos)
  out.grace = grade.graceLight * 1.2 * w.grace
  out.graceDist = ROOM_GRACE_DIST
  return out
}

/** The maze's look (morning, as tuned): what the run is lit by when he walks out. */
export function runLight(out = newLight()): Light {
  out.sat = grade.saturation
  out.vignette = grade.vignette
  out.exposure = grade.exposure
  out.fogNear = grade.fogNear
  out.fogFar = grade.fogFar
  out.fog.setHex(RUN.fogColor)
  out.bg.setHex(RUN.background)
  out.hemi = RUN.hemi
  out.key = RUN.key
  out.keyColor.setHex(RUN.keyColor)
  out.keyPos.set(...RUN.keyPos)
  out.grace = grade.graceLight
  out.graceDist = RUN.graceDist
  return out
}

function captureLight(world: World, out = newLight()): Light {
  const u = world.gradePass.uniforms
  out.sat = u.uSaturation!.value
  out.vignette = u.uVignette!.value
  out.exposure = world.renderer.toneMappingExposure
  out.fogNear = world.fog.near
  out.fogFar = world.fog.far
  out.fog.copy(world.fog.color)
  out.bg.copy(world.scene.background as THREE.Color)
  out.hemi = world.hemi.intensity
  out.key = world.key.intensity
  out.keyColor.copy(world.key.color)
  out.keyPos.copy(world.key.position)
  out.grace = world.graceLight.intensity
  out.graceDist = world.graceLight.distance
  return out
}

function mixLight(a: Light, b: Light, k: number, out: Light): Light {
  const m = (x: number, y: number) => x + (y - x) * k
  out.sat = m(a.sat, b.sat)
  out.vignette = m(a.vignette, b.vignette)
  out.exposure = m(a.exposure, b.exposure)
  out.fogNear = m(a.fogNear, b.fogNear)
  out.fogFar = m(a.fogFar, b.fogFar)
  out.fog.copy(a.fog).lerp(b.fog, k)
  out.bg.copy(a.bg).lerp(b.bg, k)
  out.hemi = m(a.hemi, b.hemi)
  out.key = m(a.key, b.key)
  out.keyColor.copy(a.keyColor).lerp(b.keyColor, k)
  out.keyPos.copy(a.keyPos).lerp(b.keyPos, k)
  out.grace = m(a.grace, b.grace)
  out.graceDist = m(a.graceDist, b.graceDist)
  return out
}

export function applyLight(world: World, l: Light) {
  const u = world.gradePass.uniforms
  u.uSaturation!.value = l.sat
  u.uVignette!.value = l.vignette
  world.renderer.toneMappingExposure = l.exposure
  world.fog.near = l.fogNear
  world.fog.far = l.fogFar
  world.fog.color.copy(l.fog)
  ;(world.scene.background as THREE.Color).copy(l.bg)
  world.hemi.intensity = l.hemi
  world.key.intensity = l.key
  world.key.color.copy(l.keyColor)
  world.key.position.copy(l.keyPos)
  world.graceLight.intensity = l.grace
  world.graceLight.distance = l.graceDist
}

// --- small things ------------------------------------------------------------------

const smooth = (k: number) => k * k * (3 - 2 * k)
const clamp01 = (k: number) => Math.max(0, Math.min(1, k))

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Cork: a warm brown with darker specks and pale grit, drawn once. */
function corkTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = '#6b5440'
  g.fillRect(0, 0, 256, 256)
  const r = rng(71)
  for (let i = 0; i < 2600; i++) {
    const v = r()
    g.fillStyle = v < 0.6 ? `rgba(40, 28, 18, ${0.25 + r() * 0.35})` : `rgba(170, 140, 104, ${0.2 + r() * 0.3})`
    g.fillRect(r() * 256, r() * 256, 1 + r() * 2.2, 1 + r() * 2.2)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1.4, 1)
  return t
}

const woodMat = () => {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(m, 'wood')
  return m
}

// --- the room ----------------------------------------------------------------------

export function createWorkshop(world: World, still: Still, vfx: Vfx): Workshop {
  const group = new THREE.Group()
  group.visible = false
  group.name = 'workshop'
  world.scene.add(group)

  const placements: Placement[] = []
  const boxes: Box[] = []
  const circles: Circle[] = []
  const r = rng(20260926)
  const quarter = () => Math.floor(r() * 4) * (Math.PI / 2)

  // floor: nine cells of boards (one flat deck: the kit's tiles have a stone relief), and a stone threshold outside
  const floor = new Set<string>()
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) floor.add(key(i, j))
  floor.add(key(1, -2))
  placements.push({ piece: 'floor_tile_large_rocks', x: 4, z: -8, rotY: quarter() })
  const deckMat = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(deckMat, 'wood', FLOOR_WOOD)
  const deck = new THREE.Mesh(new THREE.BoxGeometry(12, 0.2, 12), deckMat)
  deck.position.set(0, -0.1, 0)
  group.add(deck)

  // the tall back walls: north with the front door, west with the kids' door and the window
  const wallDepth = pieceData('wall').box.max.z
  placements.push({ piece: 'wall', x: -4, z: -6 }, { piece: 'wall', x: 0, z: -6 }, { piece: 'wall_doorway', x: 4, z: -6 })
  placements.push(
    { piece: 'wall_doorway', x: KIDS_DOOR.x, z: KIDS_DOOR.z, rotY: Math.PI / 2 },
    { piece: 'wall_window_open', x: -6, z: 0, rotY: Math.PI / 2 },
    { piece: 'wall', x: -6, z: 4, rotY: Math.PI / 2 },
  )
  // a full-height pillar closes the back corner where the two walls meet
  placements.push({ piece: 'pillar', x: -6, z: -6 })
  // the doorway's opening is its door leaf's width
  const leaf = doorLeaf()
  const doorHalf = leaf ? (leaf.box.max.x - leaf.box.min.x) / 2 : 0.8
  boxes.push(
    { minX: -6.5, maxX: DOOR.x - doorHalf, minZ: -6 - wallDepth, maxZ: -6 + wallDepth },
    { minX: DOOR.x + doorHalf, maxX: 6.5, minZ: -6 - wallDepth, maxZ: -6 + wallDepth },
    // the west wall is solid all along: their room is never entered
    { minX: -6 - wallDepth, maxX: -6 + wallDepth, minZ: -6.5, maxZ: 6.5 },
  )

  // the camera-side edges: waist-high barriers, so nothing hides the room
  const bh = pieceData('barrier').box.max.z
  for (const z of [-4, 0, 4]) placements.push({ piece: 'barrier', x: 6, z, rotY: Math.PI / 2 })
  for (const x of [-4, 0, 4]) placements.push({ piece: 'barrier', x, z: 6 })
  boxes.push({ minX: 6 - bh, maxX: 6 + bh, minZ: -6, maxZ: 6 }, { minX: -6, maxX: 6, minZ: 6 - bh, maxZ: 6 + bh })
  for (const [x, z] of [[6, 6], [-6, 6], [6, -6]] as const) {
    placements.push({ piece: 'column', x, z })
    circles.push({ x, z, r: 0.45 })
  }
  // the threshold outside is only reached through the door
  boxes.push(
    { minX: 1.5, maxX: 2 + 0.05, minZ: -10.5, maxZ: -6 },
    { minX: 6 - 0.05, maxX: 6.5, minZ: -10.5, maxZ: -6 },
    { minX: 1.5, maxX: 6.5, minZ: -10.5, maxZ: -10 },
  )

  // the bench under the window, laid along the wall, and the stool by the corkboard
  const bench = pieceData('table_long')
  placements.push({ piece: 'table_long', x: BENCH.x, z: BENCH.z, scale: BENCH.scale })
  boxes.push({
    minX: BENCH.x + bench.box.min.x * BENCH.scale, maxX: BENCH.x + bench.box.max.x * BENCH.scale,
    minZ: BENCH.z + bench.box.min.z * BENCH.scale, maxZ: BENCH.z + bench.box.max.z * BENCH.scale,
  })
  const benchTop = bench.height * BENCH.scale
  placements.push({ piece: 'stool', x: STOOL.x, z: STOOL.z, rotY: 0.4 })
  circles.push({ x: STOOL.x, z: STOOL.z, r: pieceData('stool').radius * 0.9 })

  // the beyond: the ruins go on past the barriers; tall only where they can't hide the room
  const inRoom = (x: number, z: number) => x > -7.5 && x < 7.5 && z > -11 && z < 7.5
  const hidesRoom = (x: number, z: number) => {
    for (let s = 0; s <= 8; s += 0.75) {
      for (const side of [-1.8, 0, 1.8]) {
        const px = x - s * Math.SQRT1_2 + side * Math.SQRT1_2
        const pz = z - s * Math.SQRT1_2 - side * Math.SQRT1_2
        if (inRoom(px, pz)) return true
      }
    }
    return false
  }
  const TALL = ['wall_broken', 'wall_broken', 'pillar', 'rubble_large', 'barrier_column'] as const
  for (let n = 0; n < 150; n++) {
    const x = -40 + r() * 76
    const z = -44 + r() * 76
    if (inRoom(x, z) || (Math.abs(x) < 11 && z > -14 && z < 11 && r() < 0.6)) continue
    if (hidesRoom(x, z)) {
      placements.push({ piece: r() < 0.5 ? 'rubble_half' : 'floor_dirt_large_rocky', x, z, rotY: r() * 6.3, y: -2.4 - r() * 0.6, scale: 0.8 + r() * 0.4 })
    } else {
      placements.push({ piece: TALL[Math.floor(r() * TALL.length)]!, x, z, rotY: r() * 6.3, y: -r() * 1.6, scale: 0.8 + r() * 0.5 })
    }
  }
  for (let n = 0; n < 40; n++) {
    const x = -40 + r() * 76
    const z = -44 + r() * 76
    if (inRoom(x, z)) continue
    placements.push({ piece: 'floor_dirt_large_rocky', x, z, rotY: r() * 6.3, y: -0.08 })
  }

  group.add(buildInstanced(placements, { surface: { wall: 'wood', wall_doorway: 'wood', wall_window_open: 'wood' }, tune: WALL_WOOD }))
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x151b24 })
  skin(groundMat, 'ground')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(0, -0.12, -4)
  group.add(ground)

  // behind the window: the sky, unlit, cold by the hour. The wall's opening frames it.
  const skyMat = new THREE.MeshBasicMaterial({ color: WINDOW.afternoon.sky, fog: false })
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), skyMat)
  sky.rotation.y = Math.PI / 2
  sky.position.set(-6 - wallDepth - 0.08, 2, 0)
  group.add(sky)
  // behind the kids' door: their room, dark
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.2), new THREE.MeshBasicMaterial({ color: 0x030405, fog: false }))
  dark.rotation.y = Math.PI / 2
  dark.position.set(-6 - wallDepth - 0.08, 1.6, KIDS_DOOR.z)
  group.add(dark)

  // the kids' door itself: wall_doorway's own leaf, on a hinge at the post nearer the room's middle
  const kidsHinge = new THREE.Group()
  if (leaf) {
    const frame = new THREE.Group()
    frame.position.set(KIDS_DOOR.x, 0, KIDS_DOOR.z)
    frame.rotation.y = Math.PI / 2
    kidsHinge.position.set(leaf.box.min.x + 0.02, 0, 0)
    const panel = new THREE.Mesh(leaf.geometry.clone().translate(-leaf.box.min.x - 0.02, 0, 0), leaf.material)
    kidsHinge.add(panel)
    frame.add(kidsHinge)
    group.add(frame)
  }

  // the wall of parts: a board of planks for the four sections (the plaques come with the hook step)
  const board = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.0, 0.12), woodMat())
  const wallFace = -6 + wallDepth
  board.position.set(-1.8, 2.1, wallFace + 0.07)
  group.add(board)
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 })
  for (const [w, h, x, y] of [[7.6, 0.1, -1.8, 3.65], [7.6, 0.1, -1.8, 0.55], [0.1, 3.2, -5.55, 2.1], [0.1, 3.2, 1.95, 2.1], [0.06, 2.9, -3.6, 2.1], [0.06, 2.9, -1.8, 2.1], [0.06, 2.9, 0, 2.1]] as const) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), trimMat)
    t.position.set(x, y, wallFace + 0.09)
    group.add(t)
  }
  // the hook by the door: iron, empty until something hangs on it
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 })
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), iron)
  stem.position.set(2.4, 1.5, wallFace + 0.05)
  const crook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 14, Math.PI), iron)
  crook.position.set(2.4, 1.4, wallFace + 0.14)
  crook.rotation.set(Math.PI / 2, 0, Math.PI)
  group.add(stem, crook)

  // the corkboard on the west wall, by the stool
  const cork = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.0, 2.9), new THREE.MeshStandardMaterial({ map: corkTexture(), roughness: 1 }))
  cork.position.set(-6 + wallDepth + 0.05, 2.2, 3.9)
  group.add(cork)
  for (const [h, d, y, z] of [[0.08, 3.06, 3.23, 3.9], [0.08, 3.06, 1.17, 3.9], [2.1, 0.08, 2.2, 2.37], [2.1, 0.08, 2.2, 5.43]] as const) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, h, d), trimMat)
    t.position.set(-6 + wallDepth + 0.06, y, z)
    group.add(t)
  }

  // the notebook, lying on the bench's end
  const cover = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.36), new THREE.MeshStandardMaterial({ color: 0x3b4656, roughness: 0.85 }))
  cover.position.set(-4.2, benchTop + 0.035, 1.1)
  cover.rotation.y = 0.25
  const pages = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.05, 0.33), new THREE.MeshStandardMaterial({ color: 0xcfc8b8, roughness: 0.95 }))
  pages.position.set(0.01, 0.005, 0)
  cover.add(pages)
  group.add(cover)

  // --- the kids' things ---
  const traceGroup = new THREE.Group()
  group.add(traceGroup)
  // shoes by the front door: two pairs, two sizes
  const shoeMats = [new THREE.MeshStandardMaterial({ color: 0x6a4c46, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x46566e, roughness: 0.9 })]
  ;[[0.26, 0, 0.35], [0.2, 0.34, -0.2]].forEach(([len, dx, yaw], k) => {
    for (const side of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, len!), shoeMats[k]!)
      shoe.position.set(SHOES.x + dx! + side * 0.07, 0.04, SHOES.z + side * 0.02)
      shoe.rotation.y = yaw! + side * 0.08
      traceGroup.add(shoe)
    }
  })
  // blocks: a tower of five, the colours muted, none of them lit
  // the spec's muted four, a shade lighter: in this light the darker ones went black
  const BLOCK_COLORS = [0x8391a3, 0xa3a890, 0x7888a0, 0xb3a392]
  const blockGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22)
  const blocks = Array.from({ length: 5 }, (_, i) => {
    const b = new THREE.Mesh(blockGeo, new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[i % 4], roughness: 0.8 }))
    traceGroup.add(b)
    return b
  })
  circles.push({ x: BLOCKS.x, z: BLOCKS.z, r: 0.3 })
  const stackBlocks = () => {
    blocks.forEach((b, i) => {
      b.position.set(BLOCKS.x + (r() - 0.5) * 0.03, 0.11 + i * 0.22, BLOCKS.z + (r() - 0.5) * 0.03)
      b.rotation.set(0, (r() - 0.5) * 0.4, 0)
    })
  }
  stackBlocks()
  // crayons on a sheet of paper, left mid-drawing
  // off-white and small: a white sheet this near the lamp reads as a hole in the floor
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({ color: 0x9d9384, roughness: 1 }))
  paper.rotation.set(-Math.PI / 2, 0, 0.3)
  paper.position.set(CRAYONS.x, DECAL_Y + 0.01, CRAYONS.z)
  traceGroup.add(paper)
  const crayonGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.15, 6)
  ;[0x6f9bd1, 0x8a5a44, 0xd9653b, 0xf2a950].forEach((c, i) => {
    const cr = new THREE.Mesh(crayonGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }))
    cr.rotation.set(Math.PI / 2, 0, 0.4 + i * 1.3)
    cr.position.set(CRAYONS.x + 0.28 + (i % 2) * 0.1, 0.02, CRAYONS.z - 0.12 + i * 0.09)
    traceGroup.add(cr)
  })

  // the way out: a cold beam across the front doorway
  const beam = makeBeam(COLD_BEAM, BEAM_H)
  beam.group.position.set(DOOR.x, 0, DOOR.z)
  group.add(beam.group)

  const terrain = makeTerrain(floor, boxes, circles)

  // --- state ---
  const arrival: ArrivalState = { kind: 'idle', t: 0, step: 0, done: true }
  let hour: HomeHour = 'afternoon'
  let traces = AFTERNOON
  let near: InteractId | null = null
  let leaving = false
  let blackout = 1
  const focus = new THREE.Vector3(-0.5, 0, 0)
  let hold = 1
  const from = newLight()
  const room = newLight()
  const lit = newLight()
  // the kids' door, and the one-off things that happen in the room
  let doorAngle = 0
  let doorSwingT = -1
  let pencilT = 0
  let tumbleT = -1
  let tumbling: { b: THREE.Mesh; t: number; v: THREE.Vector3; spin: number } | null = null
  let stepsDone = false
  let eyeT = -1
  let windUpDone = false
  let crossedAt = -1

  /** Stopped's room: Grace at 0.3 and the colour at 0.2 of the room's, coming up as k goes 0 to 1. */
  function dimmed(k: number): Light {
    mixLight(room, room, 0, lit)
    lit.grace = room.grace * (0.3 + 0.7 * k)
    lit.sat = room.sat * (0.2 + 0.8 * k)
    return lit
  }

  const pan = (x: number, z: number) => {
    const sx = ((x - still.pos.x) - (z - still.pos.z)) * Math.SQRT1_2
    return Math.max(-1, Math.min(1, sx / 9)) * 0.7
  }
  const kidsPan = () => pan(KIDS_DOOR.x, KIDS_DOOR.z)

  function place(kind: ArrivalKind) {
    const s = SPOT[kind]
    still.pos.set(s.x, 0, s.z)
    still.facing = s.facing
    still.aim = null
  }

  function zoneAt(x: number, z: number): Interactable | null {
    let best: Interactable | null = null
    let bestD = Infinity
    for (const zn of ZONES) {
      const inside = zn.rect
        ? x >= zn.rect.minX && x <= zn.rect.maxX && z >= zn.rect.minZ && z <= zn.rect.maxZ
        : Math.hypot(x - zn.anchor.x, z - zn.anchor.z) <= zn.radius
      if (!inside) continue
      const d = Math.hypot(x - zn.anchor.x, z - zn.anchor.z)
      if (d < bestD) {
        bestD = d
        best = zn
      }
    }
    return best
  }

  const ws: Workshop = {
    group,
    terrain,
    beam: { x: DOOR.x, z: DOOR.z, radius: DOOR.radius },
    get near() { return near },
    get traces() { return traces },
    get arrival() { return arrival },
    get blackout() { return blackout },
    focus,
    get hold() { return hold },

    enter(o) {
      group.visible = true
      hour = o.hour
      traces = tracesFor(o.hour)
      Object.assign(arrival, { kind: o.arrival, t: 0, step: 0, done: false })
      near = null
      leaving = false
      blackout = 1
      skyMat.color.setHex(WINDOW[hour].sky)
      // what he came home with
      o.worn.forEach((id, i) => {
        const def = id ? PARTS.find((p) => p.id === id) ?? null : null
        still.wear(SLOT_NAMES[i]!, def)
      })
      place(o.arrival)
      // the light: Home walks in from the run's; the others open on the room's
      captureLight(world, from)
      roomLight(hour, room)
      world.graceLight.position.copy(LAMP)
      if (o.arrival === 'home') {
        applyLight(world, from)
      } else if (o.arrival === 'stopped') {
        applyLight(world, dimmed(0))
      } else {
        applyLight(world, room)
      }
      if (o.arrival === 'broken') {
        still.reassemble()
        const spots = {} as Record<SlotName, { at: THREE.Vector3; yaw: number }>
        for (const slot of SLOT_NAMES) spots[slot] = { at: new THREE.Vector3(BENCH.x + 0.2, benchTop, BENCH.z + BENCH_Z[slot]), yaw: Math.random() * Math.PI * 2 }
        still.beginReassembly(spots, REASSEMBLY)
      } else if (o.arrival === 'stopped') {
        still.reassemble()
        still.setSlowdown(1)
      } else {
        still.reassemble()
      }
      eyeT = -1
      windUpDone = false
      crossedAt = -1
      // the traces start over
      beam.group.visible = o.arrival !== 'home'
      doorAngle = traces.kidsDoor === 'swings-shut' || traces.kidsDoor === 'open-dark' ? 1.4 : traces.kidsDoor === 'ajar' ? 0.35 : 0
      kidsHinge.rotation.y = doorAngle
      doorSwingT = traces.kidsDoor === 'swings-shut' ? 1.5 : -1
      stackBlocks()
      tumbling = null
      tumbleT = traces.sounds.tumble ? 6 + Math.random() * 8 : -1
      const pe = traces.sounds.pencilEvery
      pencilT = pe ? pe[0] + Math.random() * (pe[1] - pe[0]) : -1
      stepsDone = !traces.sounds.steps
      focus.set(-0.5, 0, 0).lerp(still.pos, 0.3)
      hold = 1
      still.group.position.set(still.pos.x, 0, still.pos.z)
      still.group.rotation.y = still.facing
      if (o.arrival === 'idle') arrival.done = true
    },

    leave() {
      group.visible = false
      near = null
      applyLight(world, runLight(lit))
    },

    update(dt, stickX, stickZ) {
      const ev: WorkshopEvent[] = []
      arrival.t += dt
      blackout = 1 - clamp01(arrival.t / FADE_IN)
      const t = arrival.t - FADE_IN
      const kind = arrival.kind

      // --- the arrival's script ---
      let moveX = 0
      let moveZ = 0
      if (!arrival.done && t >= 0) {
        if (kind === 'broken') {
          for (const slot of still.updateReassembly(dt)) {
            const i = REASSEMBLY.order.indexOf(slot)
            sfx.reassembleClick(i)
            vfx.sparks(still.parts[slot].getWorldPosition(new THREE.Vector3()), COLD, 6, 3)
            ev.push({ kind: 'seat', slot })
          }
          // his eye comes on last, a beat after the head seats, in Grace's light
          if (!still.reassembling && eyeT < 0) eyeT = t
          if (eyeT >= 0) {
            const k = clamp01((t - eyeT - 0.4) / 0.4)
            still.setEyeLit(smooth(k))
            if (k >= 1) arrival.done = true
          }
        } else if (kind === 'stopped') {
          if (!windUpDone) {
            windUpDone = true
            sfx.windUp(STOP_SECONDS)
          }
          // his eye comes back as the room's light and colour do, together
          const k = smooth(clamp01(t / STOP_SECONDS))
          still.setSlowdown(1 - k)
          applyLight(world, dimmed(k))
          if (t >= STOP_SECONDS + 0.4) arrival.done = true
        } else if (kind === 'home') {
          if (t < HOME_WALK) moveZ = 1
          // the threshold: from here the room's light comes up round him. That shift is the "you're home".
          const inside = still.pos.z > -6
          if (inside && arrival.step === 0) {
            arrival.step = 1
            crossedAt = t
          }
          if (crossedAt >= 0) applyLight(world, mixLight(from, room, smooth(clamp01((t - crossedAt) / HOME_EASE)), lit))
          if (inside && !stepsDone) {
            stepsDone = true
            sfx.kidSteps(kidsPan(), 5)
          }
          // the door's beam lights behind him once he's in
          if (t >= HOME_WALK + 0.2) beam.group.visible = true
          if (crossedAt >= 0 && t - crossedAt >= HOME_EASE) arrival.done = true
        }
        if (arrival.done) {
          if (kind === 'stopped') applyLight(world, room)
          ev.push({ kind: 'arrived' })
        }
      }
      if (arrival.done) {
        moveX = stickX
        moveZ = stickZ
      }

      // --- him ---
      if (!still.reassembling) {
        still.update(dt, moveX, moveZ)
        if (!still.vaulting) terrain.pushOut(still.pos, BODY_R)
      }

      // --- what he's standing at, and the door ---
      if (arrival.done) {
        const zn = zoneAt(still.pos.x, still.pos.z)
        const id = zn?.id ?? null
        if (id !== near) {
          near = id
          ev.push({ kind: 'near', id })
        }
        if (!leaving && beam.group.visible && Math.hypot(still.pos.x - DOOR.x, still.pos.z - DOOR.z) < DOOR.radius) {
          leaving = true
          ev.push({ kind: 'door' })
        }
      }

      // --- the camera: a little toward the room's middle, and toward what he's at ---
      const zn = near ? ZONES.find((z) => z.id === near)! : null
      const fx = -0.5 + (still.pos.x + 0.5) * 0.3
      const fz = still.pos.z * 0.3
      const tx = zn ? fx + (zn.focus.x - fx) * 0.5 : fx
      const tz = zn ? fz + (zn.focus.z - fz) * 0.5 : fz
      const e = 1 - Math.exp(-dt / 0.3)
      focus.x += (tx - focus.x) * e
      focus.z += (tz - focus.z) * e
      hold += ((zn?.zoom ?? 1) - hold) * e

      // --- the traces ---
      const since = arrival.t - FADE_IN
      if (doorSwingT >= 0 && since >= doorSwingT) {
        // pulled to from their side: 80 degrees to shut over half a second, ease-in
        const k = clamp01((since - doorSwingT) / 0.5)
        kidsHinge.rotation.y = doorAngle * (1 - k * k)
        if (k >= 1) {
          doorSwingT = -1
          sfx.doorShut(kidsPan())
        }
      }
      if (pencilT >= 0 && since >= pencilT) {
        sfx.pencil(kidsPan())
        const pe = traces.sounds.pencilEvery!
        pencilT = since + pe[0] + Math.random() * (pe[1] - pe[0])
      }
      if (tumbleT >= 0 && since >= tumbleT) {
        tumbleT = -1
        const top = blocks[blocks.length - 1]!
        const a = Math.random() * Math.PI * 2
        tumbling = { b: top, t: 0, v: new THREE.Vector3(Math.sin(a) * 0.9, 0.6, Math.cos(a) * 0.9), spin: (Math.random() - 0.5) * 12 }
        sfx.blockTumble(pan(BLOCKS.x, BLOCKS.z))
      }
      if (tumbling) {
        const tb = tumbling
        tb.t += dt
        tb.v.y -= 9.8 * dt
        tb.b.position.addScaledVector(tb.v, dt)
        tb.b.rotation.x += tb.spin * dt
        tb.b.rotation.z += tb.spin * 0.6 * dt
        if (tb.b.position.y <= 0.11) {
          tb.b.position.y = 0.11
          // it lands on a face
          tb.b.rotation.x = Math.round(tb.b.rotation.x / (Math.PI / 2)) * (Math.PI / 2)
          tb.b.rotation.z = Math.round(tb.b.rotation.z / (Math.PI / 2)) * (Math.PI / 2)
          tumbling = null
        }
      }

      beam.update(arrival.t)
      return ev
    },

    refresh(_s) {
      // plaques, the hook's plaque, cards and marks arrive with their steps; the prompts read the save live
    },

    promptFor(id, s) {
      // PLACEHOLDER copy throughout: Adrian's words
      if (id.startsWith('wall:')) {
        const slot = id.slice(5) as SlotName
        const all = PARTS.filter((p) => p.slot === slot)
        const found = all.filter((p) => s.found.includes(p.id))
        const label = slot[0]!.toUpperCase() + slot.slice(1)
        return { title: `${label} · ${found.length} of ${all.length} found`, line: found.map((p) => p.name).join(', '), action: null }
      }
      if (id === 'hook') return { title: 'The hook by the door', line: 'Nothing hangs here yet.', action: null }
      if (id === 'board') {
        const last = s.cards[s.cards.length - 1]
        return { title: `The corkboard · ${s.runs} runs`, line: last ? caption(last) : 'Nothing pinned up yet.', action: null }
      }
      if (id === 'notebook') {
        const n = Object.keys(s.notebook).length
        return { title: `The notebook · ${n} pages`, line: n ? 'Some pages are still blank.' : 'Every page is still blank.', action: null }
      }
      const since = s.firstRunAt ? new Date(s.firstRunAt) : null
      return { title: 'Yanah · Yuri', line: since ? `marked since ${since.getDate()} ${MONTHS[since.getMonth()]}` : 'not marked yet', action: null }
    },
  }
  return ws
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const END_WORD: Record<EndingKind, string> = { broken: 'broke', stopped: 'stopped', home: 'home' }
/** "25 Sep · home · depth 3": the number goes in the caption, never the headline (PLACEHOLDER words). */
function caption(c: { date: string; end: EndingKind; depth: number }) {
  const [, m, d] = c.date.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} · ${END_WORD[c.end]} · depth ${c.depth}`
}
