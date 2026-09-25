import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The dungeon's art: KayKit shapes (CC0) wearing ambientCG surfaces (CC0).
 *
 * KayKit ships flat and bright; flat colour read as clay. So every piece is
 * re-skinned with a photo texture projected in world space (triplanar — the
 * kit's UVs point into its colour atlas and can't tile), plus procedural grime
 * and contact darkening where walls meet the floor. Settled in the look test.
 *
 * Pieces are drawn instanced: a whole level is ~20 draw calls, not ~500.
 */
export const PIECES = [
  'floor_tile_large', 'floor_tile_large_rocks', 'floor_dirt_large', 'floor_dirt_large_rocky',
  'barrier', 'column', 'pillar', 'wall', 'wall_broken', 'barrier_column',
  'rubble_half', 'rubble_large', 'crates_stacked', 'barrel_large', 'box_large', 'box_stacked',
  // the Workshop
  'wall_doorway', 'wall_window_open', 'table_long', 'stool',
  // the Works
  'floor_tile_big_grate', 'keg', 'wall_gated', 'wall_scaffold',
  // the workers' quarter: what's left of its rooms, broken near the Works and whole toward home
  'table_long_broken', 'table_medium_broken', 'chair', 'floor_wood_large_dark',
  'cabinet_small', 'cabinet_medium', 'couch', 'chair_A_wood', 'table_medium',
] as const
export type Piece = (typeof PIECES)[number]

/** What a piece is skinned as. 'grate' is the Works' walkways; elsewhere it wears the paving. */
export type Surface = 'paving' | 'rock' | 'wood' | 'ground' | 'grate'
/**
 * Per ambientCG set: units per texture tile, and its gain. Keyed by set, not role, so
 * a place that swaps a role's set swaps its tiling with it.
 */
const SURFACE_TEX: Record<string, { scale: number; gain: number; tint?: [number, number, number] }> = {
  PavingStones142: { scale: 7, gain: 0.62 },
  Rock035: { scale: 3, gain: 1 },
  Planks023A: { scale: 2, gain: 0.9 },
  // the beyond should recede, not compete with the room
  Ground108: { scale: 6, gain: 0.32 },
  // The Works: plate underfoot, sheet iron on everything built, rusted walkway. The two
  // clean steels are tinted toward rust and kept dark: out of the box they read as new
  // grey paint, and the Works is the end of a long shift.
  MetalPlates006: { scale: 4, gain: 0.58, tint: [0.95, 0.84, 0.74] },
  Metal063: { scale: 3, gain: 0.6, tint: [1, 0.74, 0.58] },
  // already rust; darkened a little so a grate reads as rust, not as a warm pink patch on the plate
  MetalWalkway014: { scale: 3, gain: 0.62, tint: [0.95, 0.86, 0.8] },
  // the quarter: flagstone streets and old brick
  Tiles093: { scale: 3, gain: 0.75 },
  Bricks097: { scale: 2.5, gain: 0.85 },
}
/**
 * A set worn in a role it wasn't tuned for: the quarter's ground is the ruin's paving, and
 * the beyond has to recede as Ground108 does, not compete with the room as a floor.
 */
const ROLE_TEX: Partial<Record<Surface, Record<string, { scale: number; gain: number }>>> = {
  ground: { PavingStones142: { scale: 7, gain: 0.18 } },
}
const texOf = (role: Surface, id: string) => ({ ...SURFACE_TEX[id]!, ...ROLE_TEX[role]?.[id] })

function surfaceOf(name: string): Surface {
  if (/grate/.test(name)) return 'grate'
  if (/^floor_wood/.test(name)) return 'wood'
  if (/table|chair|stool|cabinet|couch|keg/.test(name)) return 'wood'
  if (name.startsWith('floor_dirt')) return 'ground'
  if (name.startsWith('floor')) return 'paving'
  if (/crate|box|barrel/.test(name)) return 'wood'
  return 'rock'
}

/** Which ambientCG set each role wears now, and every material's handle on it, so a place can swap them. */
const surfaceIds: Record<Surface, string> = { paving: 'PavingStones142', rock: 'Rock035', wood: 'Planks023A', ground: 'Ground108', grate: 'PavingStones142' }
interface Skinned {
  uAlb: { value: THREE.Texture }
  uNrm: { value: THREE.Texture }
  uScale: { value: number }
  uGain: { value: number }
  /** The set's colour cast (white for the ruin's). */
  uTint: { value: THREE.Color }
  /** A one-use tune (the Workshop's boards) keeps its own tiling whatever the set. */
  tuned: boolean
}
const skinned: Record<Surface, Skinned[]> = { paving: [], rock: [], wood: [], ground: [], grate: [] }

/**
 * A place's surfaces: each role whose set differs is swapped on every material wearing
 * it, with that set's tiling and gain (textures load on first use, from the SW's cache).
 */
export function setSurfaces(ids: Record<Surface, string>) {
  for (const role of Object.keys(ids) as Surface[]) {
    if (surfaceIds[role] === ids[role]) continue
    surfaceIds[role] = ids[role]
    const t = texOf(role, ids[role])
    for (const u of skinned[role]) {
      u.uAlb.value = tex(`${ids[role]}_Color`, true)
      u.uNrm.value = tex(`${ids[role]}_NormalGL`, false)
      u.uTint.value.setRGB(...(t.tint ?? [1, 1, 1]))
      if (u.tuned) continue
      u.uScale.value = 1 / t.scale
      u.uGain.value = t.gain
    }
  }
}

/** Which set a role wears now (checks, the look test). */
export const surfaceNow = (role: Surface) => surfaceIds[role]

/** Look-test values. Shared uniforms, so they can still be tuned live. */
export const SURF = {
  uGrime: { value: 0.7 },
  uContact: { value: 0.65 },
  uPhotoGain: { value: 0.85 },
  uRelief: { value: 1 },
  uCool: { value: 0.3 },
}

const texLoader = new THREE.TextureLoader()
const texCache = new Map<string, THREE.Texture>()
function tex(file: string, color: boolean) {
  let t = texCache.get(file)
  if (!t) {
    t = texLoader.load(`${import.meta.env.BASE_URL}textures/${file}.jpg`)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 4
    texCache.set(file, t)
  }
  return t
}

/**
 * Re-skin a material with its surface. Works for plain and instanced meshes.
 * `tune` overrides the surface's scale (units per texture tile) or gain for one use:
 * the Workshop's boards are wider and darker than a crate's.
 */
export function skin(m: THREE.MeshStandardMaterial, surface: Surface, tune: { scale?: number; gain?: number } = {}) {
  const set = texOf(surface, surfaceIds[surface])
  const scale = tune.scale ?? set.scale
  const gain = tune.gain ?? set.gain
  const own: Skinned = {
    uAlb: { value: tex(`${surfaceIds[surface]}_Color`, true) },
    uNrm: { value: tex(`${surfaceIds[surface]}_NormalGL`, false) },
    uScale: { value: 1 / scale },
    uGain: { value: gain },
    uTint: { value: new THREE.Color(...(set.tint ?? [1, 1, 1])) },
    tuned: tune.scale !== undefined || tune.gain !== undefined,
  }
  skinned[surface].push(own)
  m.roughness = 1
  m.metalness = 0
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SURF, { uAlb: own.uAlb, uNrm: own.uNrm, uScale: own.uScale, uGain: own.uGain, uTint: own.uTint })
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #else
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vWNrm = normalize(mat3(modelMatrix) * objectNormal);
        #endif`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform float uGrime, uContact, uPhotoGain, uRelief, uCool, uScale, uGain;
        uniform vec3 uTint;
        uniform sampler2D uAlb;
        uniform sampler2D uNrm;
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.3) + 0.15 * vnoise(p * 5.1); }
        vec3 triW() { vec3 b = pow(abs(normalize(vWNrm)), vec3(4.0)); return b / (b.x + b.y + b.z); }
        float triN(float s) {
          vec3 b = triW();
          return fbm(vWPos.yz * s) * b.x + fbm(vWPos.xz * s) * b.y + fbm(vWPos.xy * s) * b.z;
        }
        vec3 triAlb() {
          vec3 b = triW(); vec3 p = vWPos * uScale;
          return texture2D(uAlb, p.zy).rgb * b.x + texture2D(uAlb, p.xz).rgb * b.y + texture2D(uAlb, p.xy).rgb * b.z;
        }
        // whiteout-blended triplanar normal, in world space
        vec3 triNrm() {
          vec3 b = triW(); vec3 p = vWPos * uScale; vec3 n = normalize(vWNrm);
          vec3 tx = texture2D(uNrm, p.zy).xyz * 2.0 - 1.0;
          vec3 ty = texture2D(uNrm, p.xz).xyz * 2.0 - 1.0;
          vec3 tz = texture2D(uNrm, p.xy).xyz * 2.0 - 1.0;
          tx.xy *= uRelief; ty.xy *= uRelief; tz.xy *= uRelief;
          tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
          ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
          tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
          return normalize(tx.zyx * b.x + ty.xzy * b.y + tz.xyz * b.z);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        diffuseColor.rgb = triAlb() * uPhotoGain * uGain * uTint * mix(vec3(1.0), vec3(0.78, 0.88, 1.08), uCool);
        float g = triN(0.9) * 0.55 + triN(4.5) * 0.45;
        diffuseColor.rgb *= mix(1.0, 0.4 + 0.95 * g, uGrime);
        float side = 1.0 - abs(normalize(vWNrm).y);
        diffuseColor.rgb *= mix(1.0, 0.3 + 0.7 * smoothstep(0.0, 1.1, vWPos.y), uContact * side);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize((viewMatrix * vec4(triNrm(), 0.0)).xyz);`)
  }
  m.needsUpdate = true
}

export interface PieceData {
  geometry: THREE.BufferGeometry
  material: THREE.MeshStandardMaterial
  /** Footprint radius on the floor, for props that block. */
  radius: number
  /** The top of its bounds: a bench's top, a wall's height. Times its scale where placed. */
  height: number
  /** Its bounds, unscaled: collision boxes come from these, never from guessed numbers. */
  box: THREE.Box3
}

const loaded = new Map<Piece, PieceData>()
/** wall_doorway's own door leaf, kept apart from the frame (the kids' door swings on it). */
let doorLeafData: PieceData | null = null

/**
 * A piece whose file fails to load is built from this instead: another piece's shape,
 * or primitives. INV: pieceData(p) never throws for a piece in FALLBACK, so a missing
 * file never blocks boot. It's skinned as the piece's own role.
 */
export const FALLBACK: Partial<Record<Piece, Piece | (() => THREE.BufferGeometry)>> = {
  floor_tile_big_grate: 'floor_tile_large',
  keg: 'barrel_large',
  wall_gated: 'wall',
  wall_scaffold: 'wall_broken',
  table_long_broken: () => table(2, 1.1, 4, true),
  table_medium_broken: () => table(2, 0.95, 2, true),
  chair: () => chair(),
  floor_wood_large_dark: 'floor_tile_large',
  cabinet_small: () => new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
  cabinet_medium: () => new THREE.BoxGeometry(2, 1, 1).translate(0, 0.5, 0),
  couch: () => couch(),
  chair_A_wood: () => chair(),
  table_medium: () => table(2, 1, 2, false),
}

/** A fallback made of boxes, merged into one geometry. */
function boxes(parts: [w: number, h: number, d: number, x: number, y: number, z: number, rz?: number][]) {
  const g = mergeGeometries(parts.map(([w, h, d, x, y, z, rz]) => {
    const b = new THREE.BoxGeometry(w, h, d)
    if (rz) b.rotateZ(rz)
    return b.translate(x, y, z)
  }))!
  g.computeBoundingBox()
  return g
}
/** A table: a top and four legs inset 0.15 from its corners. Broken, the +x +z leg is gone and the top rolled 12 degrees. */
function table(w: number, h: number, d: number, broken: boolean) {
  const lx = w / 2 - 0.15 - 0.06
  const lz = d / 2 - 0.15 - 0.06
  const corners: [number, number][] = [[-lx, -lz], [lx, -lz], [-lx, lz], [lx, lz]]
  const legs = corners
    .filter(([x, z]) => !(broken && x > 0 && z > 0))
    .map(([x, z]): [number, number, number, number, number, number] => [0.12, h - 0.1, 0.12, x, (h - 0.1) / 2, z])
  return boxes([[w, 0.1, d, 0, h - 0.05, 0, broken ? (12 * Math.PI) / 180 : 0], ...legs])
}
function chair() {
  const legs = [[-0.29, -0.29], [0.29, -0.29], [-0.29, 0.29], [0.29, 0.29]].map(([x, z]) => [0.08, 0.46, 0.08, x!, 0.23, z!] as [number, number, number, number, number, number])
  return boxes([[0.7, 0.08, 0.7, 0, 0.5, 0], [0.7, 0.7, 0.08, 0, 0.9, -0.31], ...legs])
}
function couch() {
  return boxes([[3, 0.5, 1.5, 0, 0.25, 0], [3, 0.7, 0.3, 0, 0.85, -0.6], [0.3, 0.8, 1.5, -1.35, 0.4, 0], [0.3, 0.8, 1.5, 1.35, 0.4, 0]])
}

/** Floor pieces are one 4 u cell: a file a little off is scaled to fit at load. */
const FLOOR_SIZE = 4

function register(name: Piece, geometry: THREE.BufferGeometry, material: THREE.MeshStandardMaterial) {
  geometry.computeBoundingBox()
  let bb = geometry.boundingBox!
  const sx = bb.max.x - bb.min.x
  const sz = bb.max.z - bb.min.z
  if (name.startsWith('floor') && (Math.abs(sx - FLOOR_SIZE) > 0.2 || Math.abs(sz - FLOOR_SIZE) > 0.2)) {
    geometry.scale(FLOOR_SIZE / sx, 1, FLOOR_SIZE / sz)
    geometry.computeBoundingBox()
    bb = geometry.boundingBox!
  }
  loaded.set(name, {
    geometry,
    material,
    radius: Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) / 2,
    height: bb.max.y,
    box: bb.clone(),
  })
}

/** Stand in for a piece that didn't load, once whatever it stands in for has. */
function fallBack(name: Piece) {
  const f = FALLBACK[name]
  if (!f) throw new Error(`kit piece ${name} failed and has no fallback`)
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff })
  skin(material, surfaceOf(name))
  const geometry = typeof f === 'function' ? f() : pieceData(f).geometry.clone()
  register(name, geometry, material)
}

/** Loads every piece once. Call before building the first level. */
export async function loadKit(): Promise<void> {
  const loader = new GLTFLoader()
  const failed: Piece[] = []
  await Promise.all(PIECES.map(async (name) => {
    let scene: THREE.Group
    try {
      scene = (await loader.loadAsync(`${import.meta.env.BASE_URL}kaykit/${name}.glb`)).scene
    } catch (err) {
      console.warn(`kit: ${name} didn't load, using its fallback`, err)
      failed.push(name)
      return
    }
    let mesh: THREE.Mesh | null = null
    scene.traverse((o) => {
      // the first mesh is the piece; wall_doorway's leaf is its child, and kept separately below
      if (!mesh && o instanceof THREE.Mesh) mesh = o
    })
    const m = mesh as THREE.Mesh | null
    if (!m) throw new Error(`kit piece ${name} has no mesh`)
    m.updateWorldMatrix(true, false)
    const geometry = m.geometry.clone().applyMatrix4(m.matrixWorld)
    const material = (m.material as THREE.MeshStandardMaterial).clone()
    // Every KayKit file embeds its own copy of the colour atlas. The photo skin
    // replaces it, so never upload it: 16 unused copies is ~90MB of GPU memory,
    // which a phone doesn't have to spare.
    material.map?.dispose()
    material.map = null
    ;(m.material as THREE.MeshStandardMaterial).map?.dispose()
    skin(material, surfaceOf(name))
    register(name, geometry, material)
    if (name === 'wall_doorway') {
      const leaf = scene.getObjectByName('wall_doorway_door')
      if (leaf instanceof THREE.Mesh) {
        leaf.updateWorldMatrix(true, false)
        const g = leaf.geometry.clone().applyMatrix4(leaf.matrixWorld)
        g.computeBoundingBox()
        const lm = (leaf.material as THREE.MeshStandardMaterial).clone()
        lm.map = null
        skin(lm, 'wood')
        const lb = g.boundingBox!
        doorLeafData = { geometry: g, material: lm, radius: Math.max(lb.max.x - lb.min.x, lb.max.z - lb.min.z) / 2, height: lb.max.y, box: lb.clone() }
      }
    }
  }))
  // after the rest: a fallback can be another piece's shape
  for (const name of failed) fallBack(name)
}

/** wall_doorway's door leaf, in the doorway's own frame (null if the file had none). */
export function doorLeaf(): PieceData | null {
  return doorLeafData
}

/** A piece's material wearing a different surface: the Workshop's floor and walls are wood. One copy per pair, shared. */
const reskinned = new Map<string, THREE.MeshStandardMaterial>()
export function materialAs(name: Piece, surface: Surface, tune: { scale?: number; gain?: number } = {}): THREE.MeshStandardMaterial {
  const k = `${name}:${surface}:${tune.scale ?? ''}:${tune.gain ?? ''}`
  let m = reskinned.get(k)
  if (!m) {
    m = pieceData(name).material.clone()
    skin(m, surface, tune)
    reskinned.set(k, m)
  }
  return m
}

export function pieceData(name: Piece): PieceData {
  const p = loaded.get(name)
  if (!p) throw new Error(`kit not loaded: ${name}`)
  return p
}

export interface Placement {
  piece: Piece
  x: number
  z: number
  y?: number
  rotY?: number
  scale?: number
}

/**
 * One InstancedMesh per piece type. The shared geometry and material are never disposed.
 * `surface` re-skins chosen pieces (the Workshop's wooden floor and walls).
 */
export function buildInstanced(
  placements: readonly Placement[],
  opts: { surface?: Partial<Record<Piece, Surface>>; tune?: { scale?: number; gain?: number } } = {},
): THREE.Group {
  const group = new THREE.Group()
  const byPiece = new Map<Piece, Placement[]>()
  for (const p of placements) {
    const list = byPiece.get(p.piece) ?? []
    list.push(p)
    byPiece.set(p.piece, list)
  }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  for (const [name, list] of byPiece) {
    const { geometry } = pieceData(name)
    const surface = opts.surface?.[name]
    const material = surface ? materialAs(name, surface, opts.tune) : pieceData(name).material
    const inst = new THREE.InstancedMesh(geometry, material, list.length)
    list.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rotY ?? 0)
      pos.set(p.x, p.y ?? 0, p.z)
      scl.setScalar(p.scale ?? 1)
      inst.setMatrixAt(i, m.compose(pos, q, scl))
    })
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    group.add(inst)
  }
  return group
}
