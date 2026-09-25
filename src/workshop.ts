import * as THREE from 'three'
import { grade, DECAL_Y, type World } from './world'
import { buildInstanced, pieceData, doorLeaf, skin, type Placement } from './kit'
import { makeTerrain, makeLightBeam, key, type BeamStyle, type Box, type Circle } from './dungeon'
import type { Terrain } from './terrain'
import { SLOT_NAMES, type SlotName, type Still } from './still'
import { PARTS, type AbilityDef, type Tier } from './abilities'
import { partModel, centred, WALL_SCALE, DISPLAY_EYE, EYE_OFF } from './partmodels'
import { canTurn, hookOffers } from './pool'
import { presetOf, applyDay, WINDOW, GRACE_REACH, BASE_HEMI, BASE_KEY, type HomeHour } from './areas'
import type { EndingKind, PartId, SaveV1 } from './save'
import { COLD, type Vfx } from './vfx'
import * as sfx from './audio'
import { setRain } from './ambience'

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
export type PlaqueState = 'lit' | 'turned' | 'bare'
/** The card that replaces the pickup card for the wall and the hook (hud.ts). */
export interface ChooserSpec {
  title: string
  items: { id: PartId; icon: string; state: PlaqueState | 'disabled'; tier: Tier }[]
  selected: PartId | null
  /** `note`: the small line under it (hung, or why a turn is refused). */
  detail: { name: string; line: string; history: string | null; tier: Tier | null; note?: string } | null
  /** Null hides the button. */
  action: string | null
}
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
  /** Rebuild what the save shows: the wall (lit, turned, bare), what hangs on the hook, and his body under it. */
  refresh(s: SaveV1): void
  /** The chooser for the wall's section or the hook, with `selected` picked (or the default). */
  cardFor(id: 'hook' | `wall:${SlotName}`, s: SaveV1, selected: PartId | null): ChooserSpec
  /** The zones as built (the wall's sections are sized from the models): for checks. */
  readonly zones: readonly Interactable[]
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
/** The door beam: walking into it starts the next run. The doorway is narrower than the zone, so there's no way round it. */
const DOOR = { x: 4, z: -5.3, radius: 1.1 }
/**
 * How the door's beam is drawn: doorway-sized, cold, and dimmer than the lamp. The
 * maze's 9 u exit beam in this small room was the brightest thing in it; this is the
 * way out, not the centrepiece. Textured like the warm beam, in the cold.
 */
const DOOR_BEAM: BeamStyle = {
  deep: 0x3e6a9c, hot: 0x9fc0e6, radius: [0.5, 0.62], core: [0.1, 0.14], shell: 1.1, coreStrength: 1.0,
  motes: 18, moteR: 0.45, moteSize: 3.5, pool: { radius: 1.05, strength: 0.34, ripple: 0.16 },
}
const DOOR_BEAM_H = 3.6
/**
 * Grace's light, the lamp: over the bench, a step in from the window (any nearer and
 * the wall beside it burns white), and toward the wall of parts: the one place his
 * steel looks warm is under her light. It doesn't follow him here.
 */
const LAMP = new THREE.Vector3(-3.4, 3.8, -1.0)
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

/**
 * The wall of parts (design/parts/4-appearance.md §4, laid out as SPEC §5.7's sections):
 * one section per slot, left to right head, torso, arms, legs, each two parts wide
 * and four tall, whites then blues then golds. Every part hangs as worn, facing the
 * room, at one scale, so relative sizes stay true. The appearance doc's 1.25x wants
 * a wall about 9 x 4.5 u; the north wall has 7.4 x 3.9 before the door, so the whole
 * wall hangs at 0.74 of it.
 */
const WALL_S = WALL_SCALE * 0.74
const WALL_LEFT = -5.3
const WALL_TOP = 3.95
const WALL_BOTTOM = 0.05
const CELL_GAP = 0.12
const SECTION_GAP = 0.18
const TIER_RANK: Record<Tier, number> = { white: 0, blue: 1, gold: 2 }
/** Where the hook hangs, by the front door. */
const HOOK = { x: 2.4, y: 1.4 }
const FLIP_S = 0.18
/** A turned part's glass: off. */
const OFF_EYE = new THREE.MeshBasicMaterial({ color: EYE_OFF, vertexColors: true })
OFF_EYE.userData.shared = true

/** §5.6. Nearest anchor wins among the zones he's inside. The wall's four come from its layout, built with the room. */
const FIXED_ZONES: Interactable[] = [
  { id: 'hook', anchor: { x: HOOK.x, z: -4.5 }, radius: 0.8, focus: { x: HOOK.x, z: -5.5 }, zoom: 1.45 },
  { id: 'board', anchor: { x: -4.5, z: 3.9 }, radius: 1.1, focus: { x: -5.5, z: 3.9 }, zoom: 1.35 },
  // off the bench's end, where he can stand (the book lies on the bench at z 1.1)
  { id: 'notebook', anchor: { x: -3.3, z: 1.2 }, radius: 0.9, focus: { x: -4.2, z: 1.1 }, zoom: 1.3 },
  { id: 'doorframe', anchor: { x: -4.6, z: -2.4 }, radius: 0.9, focus: { x: -6, z: -3 }, zoom: 1.4 },
]

/** Where a part not yet found lives (§4.10, PLACEHOLDER copy). */
function hintFor(def: AbilityDef): string {
  if (def.drops === 'boss') return 'The Assembler carries this.'
  if (def.drops === 'rare') return 'An elite, a bargain, or the Assembler might carry this.'
  return 'An elite, a bargain, or the Assembler might carry this, past the first depth.'
}
const SLOT_LABEL: Record<SlotName, string> = { head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs' }

/** The boards: wider planks than a crate's and a darker, richer brown; the walls darker still. */
const FLOOR_WOOD = { scale: 3.2, gain: 0.62 }
const WALL_WOOD = { gain: 0.5 }

/**
 * The kids, as traces, by the hour (§5.9). Morning and noon they're out: their door
 * open on a dark room, the blocks left scattered. Afternoon they're in and awake:
 * their door pulled to as he comes home, small shoes by the front door, a tower
 * built, a pencil going. Dusk, quieter. Night, asleep: the door ajar, the blocks
 * boxed, the crayons tidied away, and rain on the window.
 */
const TRACES: Record<HomeHour, TraceSet> = {
  morning: { kidsDoor: 'open-dark', shoes: false, blocks: 'scattered', crayons: true, sounds: { steps: false, pencilEvery: null, tumble: false, rain: false } },
  noon: { kidsDoor: 'open-dark', shoes: false, blocks: 'scattered', crayons: true, sounds: { steps: false, pencilEvery: null, tumble: false, rain: false } },
  afternoon: { kidsDoor: 'swings-shut', shoes: true, blocks: 'tower', crayons: true, sounds: { steps: true, pencilEvery: [8, 15], tumble: true, rain: false } },
  dusk: { kidsDoor: 'ajar', shoes: true, blocks: 'tower', crayons: true, sounds: { steps: false, pencilEvery: [12, 20], tumble: false, rain: false } },
  night: { kidsDoor: 'ajar', shoes: true, blocks: 'boxed', crayons: false, sounds: { steps: false, pencilEvery: null, tumble: false, rain: true } },
}
const tracesFor = (hour: HomeHour): TraceSet => TRACES[hour]

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

/** The room at an hour, as a Light to ease between: the `workshop` preset with its window (areas.ts). */
function roomLight(hour: HomeHour, out = newLight()): Light {
  const d = presetOf('workshop', hour)
  out.sat = grade.saturation * d.sat
  out.vignette = grade.vignette * d.vignette
  out.exposure = grade.exposure * d.exposure
  out.fogNear = grade.fogNear * d.fog
  out.fogFar = grade.fogFar * d.fog
  out.fog.setHex(d.fogColor)
  out.bg.setHex(d.background)
  out.hemi = BASE_HEMI * d.hemi
  out.key = BASE_KEY * d.key
  out.keyColor.setHex(d.keyColor)
  out.keyPos.set(...d.keyDir)
  out.grace = grade.graceLight * d.grace
  out.graceDist = GRACE_REACH.room
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

  // --- the wall of parts: every part on its own peg, in its slot's section ---
  const wallFace = -6 + wallDepth
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.9 })
  const pegMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, roughness: 0.8 })
  const pegGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6)
  pegGeo.rotateX(Math.PI / 2)
  interface Peg { def: AbilityDef; holder: THREE.Group; found: boolean | null; state: PlaqueState | null; eyes: THREE.Mesh[]; flip: { from: number; to: number; t: number } | null }
  const pegs = new Map<PartId, Peg>()
  const sectionOf = {} as Record<SlotName, AbilityDef[]>
  const box3 = new THREE.Box3()
  const size = new THREE.Vector3()
  const measure = (def: AbilityDef) => {
    const m = partModel(def, 'found')
    m.root.updateMatrixWorld(true)
    return box3.setFromObject(m.root).getSize(size).clone()
  }
  const zones: Interactable[] = []
  const cellH = (WALL_TOP - WALL_BOTTOM) / 4
  let cursor = WALL_LEFT
  const dividers: number[] = []
  for (const slot of SLOT_NAMES) {
    const parts = PARTS.filter((p) => p.slot === slot).sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier])
    sectionOf[slot] = parts
    const sizes = parts.map(measure)
    const cellW = Math.max(...sizes.map((v) => v.x)) * WALL_S + CELL_GAP
    const x0 = cursor
    parts.forEach((def, i) => {
      const x = x0 + cellW * ((i % 2) + 0.5)
      const y = WALL_TOP - cellH * (Math.floor(i / 2) + 0.5)
      const v = sizes[i]!
      // far enough off the board that it can turn about its middle without touching it
      const zOff = (Math.max(v.x, v.z) / 2) * WALL_S + 0.05
      const holder = new THREE.Group()
      holder.name = `peg:${def.id}`
      holder.position.set(x, y, wallFace + 0.13 + zOff)
      group.add(holder)
      const peg = new THREE.Mesh(pegGeo, pegMat)
      peg.position.set(x, y + (v.y * WALL_S) / 2 - 0.02, wallFace + 0.19)
      group.add(peg)
      pegs.set(def.id, { def, holder, found: null, state: null, eyes: [], flip: null })
    })
    cursor += cellW * 2
    const cx = (x0 + cursor) / 2
    zones.push({
      id: `wall:${slot}`, anchor: { x: cx, z: -4.5 }, radius: 0,
      rect: { minX: x0 - SECTION_GAP / 2, maxX: cursor + SECTION_GAP / 2, minZ: -6, maxZ: -3.6 }, focus: { x: cx, z: -5.5 }, zoom: 1.45,
    })
    dividers.push(cursor + SECTION_GAP / 2)
    cursor += SECTION_GAP
  }
  zones.push(...FIXED_ZONES)
  const wallRight = cursor - SECTION_GAP + 0.15
  const wallLeft = WALL_LEFT - 0.15
  const boardW = wallRight - wallLeft
  const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, WALL_TOP - WALL_BOTTOM + 0.2, 0.12), woodMat())
  board.position.set((wallLeft + wallRight) / 2, (WALL_TOP + WALL_BOTTOM) / 2, wallFace + 0.07)
  group.add(board)
  const bx = (wallLeft + wallRight) / 2
  const boardH = WALL_TOP - WALL_BOTTOM + 0.3
  for (const [w, h, x, y] of [[boardW + 0.2, 0.1, bx, WALL_TOP + 0.12], [boardW + 0.2, 0.1, bx, WALL_BOTTOM - 0.08], [0.1, boardH, wallLeft - 0.05, (WALL_TOP + WALL_BOTTOM) / 2], [0.1, boardH, wallRight + 0.05, (WALL_TOP + WALL_BOTTOM) / 2]] as const) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.16), trimMat)
    t.position.set(x, y, wallFace + 0.09)
    group.add(t)
  }
  for (const x of dividers.slice(0, -1)) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, WALL_TOP - WALL_BOTTOM, 0.16), trimMat)
    t.position.set(x, (WALL_TOP + WALL_BOTTOM) / 2, wallFace + 0.09)
    group.add(t)
  }
  // the hook by the door: iron, empty until something hangs on it
  const iron = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.6 })
  const stem = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), iron)
  stem.position.set(HOOK.x, HOOK.y + 0.1, wallFace + 0.05)
  const crook = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 6, 14, Math.PI), iron)
  crook.position.set(HOOK.x, HOOK.y, wallFace + 0.14)
  // what hangs on it, as found, at the wall's scale
  const hookHolder = new THREE.Group()
  hookHolder.name = 'hook:part'
  group.add(hookHolder)
  let hookShown: PartId | null = null
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
  // shoes by the front door: two pairs, two sizes (home only while they are)
  const shoeGroup = new THREE.Group()
  traceGroup.add(shoeGroup)
  const shoeMats = [new THREE.MeshStandardMaterial({ color: 0x6a4c46, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x46566e, roughness: 0.9 })]
  ;[[0.26, 0, 0.35], [0.2, 0.34, -0.2]].forEach(([len, dx, yaw], k) => {
    for (const side of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, len!), shoeMats[k]!)
      shoe.position.set(SHOES.x + dx! + side * 0.07, 0.04, SHOES.z + side * 0.02)
      shoe.rotation.y = yaw! + side * 0.08
      shoeGroup.add(shoe)
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
  // at night they're put away: a small toy crate where the tower stood
  const toyBox = new THREE.Mesh(pieceData('box_large').geometry, pieceData('box_large').material)
  toyBox.scale.setScalar(0.42)
  toyBox.position.set(BLOCKS.x, 0, BLOCKS.z)
  toyBox.rotation.y = 0.5
  traceGroup.add(toyBox)
  /** A tower of five, a scatter left mid-game, or boxed. */
  const placeBlocks = (how: TraceSet['blocks']) => {
    toyBox.visible = how === 'boxed'
    blocks.forEach((b, i) => {
      b.visible = how !== 'boxed'
      if (how === 'tower') {
        b.position.set(BLOCKS.x + (r() - 0.5) * 0.03, 0.11 + i * 0.22, BLOCKS.z + (r() - 0.5) * 0.03)
        b.rotation.set(0, (r() - 0.5) * 0.4, 0)
      } else {
        const a = r() * Math.PI * 2
        const d = 0.25 + r() * 0.55
        b.position.set(BLOCKS.x + Math.sin(a) * d, 0.11, BLOCKS.z + Math.cos(a) * d * 0.7)
        b.rotation.set(0, r() * Math.PI, 0)
      }
    })
  }
  placeBlocks('tower')
  // crayons on a sheet of paper, left mid-drawing (tidied away at night)
  const crayonGroup = new THREE.Group()
  traceGroup.add(crayonGroup)
  // off-white and small: a white sheet this near the lamp reads as a hole in the floor
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.24), new THREE.MeshStandardMaterial({ color: 0x9d9384, roughness: 1 }))
  paper.rotation.set(-Math.PI / 2, 0, 0.3)
  paper.position.set(CRAYONS.x, DECAL_Y + 0.01, CRAYONS.z)
  crayonGroup.add(paper)
  const crayonGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.15, 6)
  ;[0x6f9bd1, 0x8a5a44, 0xd9653b, 0xf2a950].forEach((c, i) => {
    const cr = new THREE.Mesh(crayonGeo, new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }))
    cr.rotation.set(Math.PI / 2, 0, 0.4 + i * 1.3)
    cr.position.set(CRAYONS.x + 0.28 + (i % 2) * 0.1, 0.02, CRAYONS.z - 0.12 + i * 0.09)
    crayonGroup.add(cr)
  })

  // the way out: a cold beam across the front doorway
  const beam = makeLightBeam(DOOR_BEAM_H, DOOR_BEAM)
  beam.group.name = 'beam:door'
  beam.group.position.set(DOOR.x, 0, DOOR.z)
  group.add(beam.group)

  const terrain = makeTerrain(floor, boxes, circles)

  // --- state ---
  const arrival: ArrivalState = { kind: 'idle', t: 0, step: 0, done: true }
  let hour: HomeHour = 'afternoon'
  let traces = TRACES.afternoon
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
    for (const zn of zones) {
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

  // --- what the save shows: the wall, the hook, and his body under it ---
  let save: SaveV1 | null = null
  /** What he came home wearing, and what his body shows now (the hooked part lifts off onto the hook). */
  let worn: (PartId | null)[] = [null, null, null, null]
  const body: (PartId | null | undefined)[] = [undefined, undefined, undefined, undefined]

  /** A model hung at the wall's scale, about its own middle. */
  const hangModel = (holder: THREE.Group, def: AbilityDef, found: boolean): THREE.Mesh[] => {
    holder.clear()
    const m = partModel(def, found ? 'found' : 'unfound')
    const { group: g } = centred(m.root, WALL_S)
    holder.add(g)
    const eyes: THREE.Mesh[] = []
    g.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material === DISPLAY_EYE) eyes.push(o)
    })
    return eyes
  }

  /** The part on the hook, shown: hung, and (while an ending's choice is open) one of its candidates. */
  const shownOnHook = (sv: SaveV1): PartId | null => {
    const h = sv.hook
    if (!h || !sv.found.includes(h)) return null
    if (sv.pendingHook && !sv.pendingHook.candidates.includes(h)) return null
    return h
  }

  /** His body: what he came home in, with the frame where the hooked part came off. */
  function syncBody() {
    // mid-reassembly the four roots belong to the arrival
    if (still.reassembling) return
    const hooked = save ? shownOnHook(save) : null
    SLOT_NAMES.forEach((slot, i) => {
      const want = worn[i] && worn[i] !== hooked ? worn[i]! : null
      if (body[i] === want) return
      body[i] = want
      still.wear(slot, want ? PARTS.find((p) => p.id === want) ?? null : null)
    })
  }

  function refreshWall(animate: boolean) {
    if (!save) return
    for (const peg of pegs.values()) {
      const found = save.found.includes(peg.def.id)
      const state: PlaqueState = !found ? 'bare' : save.turned.includes(peg.def.id) ? 'turned' : 'lit'
      if (peg.found !== found) {
        peg.eyes = hangModel(peg.holder, peg.def, found)
        peg.found = found
      }
      const to = state === 'turned' ? Math.PI : 0
      if (animate && peg.state && peg.state !== state && state !== 'bare') {
        // a quick turn about its peg, with a knock of wood
        peg.flip = { from: peg.holder.rotation.y, to, t: 0 }
        sfx.plaqueTurn(pan(peg.holder.position.x, peg.holder.position.z))
      } else {
        peg.flip = null
        peg.holder.rotation.y = to
      }
      // turned: its glass goes dark with its face to the wall
      for (const e of peg.eyes) e.material = state === 'turned' ? OFF_EYE : DISPLAY_EYE
      peg.state = state
    }
    const h = shownOnHook(save)
    if (h !== hookShown) {
      hookShown = h
      hookHolder.clear()
      if (h) {
        const def = PARTS.find((p) => p.id === h)!
        hangModel(hookHolder, def, true)
        const v = measure(def)
        hookHolder.position.set(HOOK.x, HOOK.y - 0.08 - (v.y * WALL_S) / 2, wallFace + 0.13 + (Math.max(v.x, v.z) / 2) * WALL_S + 0.05)
      }
    }
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
      // what he came home with (the hooked part, if he's hung one before, on its hook instead)
      worn = [...o.worn]
      body.fill(undefined)
      syncBody()
      refreshWall(false)
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
        applyDay(world, 'workshop', hour)
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
      placeBlocks(traces.blocks)
      shoeGroup.visible = traces.shoes
      crayonGroup.visible = traces.crayons
      setRain(traces.sounds.rain)
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
      setRain(false)
      applyDay(world, 'morning')
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
          // the eased light lands exactly on the room's hour, and the grade panel can reapply it from here
          applyDay(world, 'workshop', hour)
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
      const zn = near ? zones.find((z) => z.id === near)! : null
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

      for (const peg of pegs.values()) {
        const f = peg.flip
        if (!f) continue
        f.t += dt
        const k = clamp01(f.t / FLIP_S)
        peg.holder.rotation.y = f.from + (f.to - f.from) * smooth(k)
        if (k >= 1) peg.flip = null
      }
      // a hang chosen mid-arrival waits for the reassembly to finish
      if (arrival.done) syncBody()

      beam.update(arrival.t)
      return ev
    },

    refresh(sv) {
      save = sv
      refreshWall(group.visible)
      syncBody()
    },

    get zones() { return zones },

    cardFor(id, sv, selected) {
      const detailOf = (def: AbilityDef, st: PlaqueState | 'disabled') => st === 'bare'
        ? { name: 'Not found yet', line: hintFor(def), history: null, tier: null }
        : { name: def.name, line: def.line, history: null, tier: def.tier }
      if (id === 'hook') {
        const offers = hookOffers(sv)
        const items = offers.map((pid) => {
          const def = PARTS.find((p) => p.id === pid)!
          return { id: pid, icon: def.icon, state: (sv.turned.includes(pid) ? 'disabled' : 'lit') as PlaqueState | 'disabled', tier: def.tier }
        })
        // PLACEHOLDER copy throughout
        if (items.length === 0) {
          return { title: 'The hook by the door', items, selected: null, detail: { name: 'Nothing to hang.', line: "He'll start with a plain part.", history: null, tier: null }, action: null }
        }
        const sel = items.find((it) => it.id === selected)?.id ?? (sv.hook && offers.includes(sv.hook) ? sv.hook : items[0]!.id)
        const it = items.find((i) => i.id === sel)!
        const def = PARTS.find((p) => p.id === sel)!
        const hung = sv.hook === sel && shownOnHook(sv) === sel
        const turned = it.state === 'disabled'
        return {
          title: 'The hook by the door', items, selected: sel,
          detail: { ...detailOf(def, 'lit'), note: hung ? 'hung \u00b7 the next run starts with it' : turned ? 'turned to the wall' : undefined },
          action: !hung && !turned && sv.pendingHook ? 'hang it' : null,
        }
      }
      const slot = id.slice(5) as SlotName
      const parts = sectionOf[slot]
      const stateOf = (def: AbilityDef): PlaqueState => !sv.found.includes(def.id) ? 'bare' : sv.turned.includes(def.id) ? 'turned' : 'lit'
      const items = parts.map((def) => ({ id: def.id, icon: def.icon, state: stateOf(def) as PlaqueState | 'disabled', tier: def.tier }))
      const found = parts.filter((d) => sv.found.includes(d.id)).length
      const sel = items.find((it) => it.id === selected)?.id ?? items.find((it) => it.state === 'lit')?.id ?? items[0]!.id
      const def = parts.find((d) => d.id === sel)!
      const st = stateOf(def)
      let action: string | null = null
      let note: string | undefined
      if (st === 'turned') action = 'turn back'
      else if (st === 'lit') {
        if (canTurn(sv, def.id)) action = 'turn to the wall'
        else note = `the last plain ${SLOT_LABEL[slot]} part stays facing out`
      }
      return { title: `${SLOT_LABEL[slot]} \u00b7 ${found} of ${parts.length} found`, items, selected: sel, detail: { ...detailOf(def, st), note }, action }
    },

    promptFor(id, s) {
      // PLACEHOLDER copy throughout: Adrian's words
      // the wall's sections and the hook have their chooser (cardFor), not a card
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
