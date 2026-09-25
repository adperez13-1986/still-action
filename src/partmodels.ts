import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { byId, type AbilityDef, type Tier } from './abilities'
import type { SlotName } from './still'

/**
 * What each part looks like (design/parts/4-appearance.md). One model per part,
 * drawn from primitives, and the same model serves three places: worn on Still,
 * on the floor as loot, and on the Workshop's wall.
 *
 * Every slot has a frame: the pivots and the handles the poses write every
 * frame (the lens, the core, the jaws, the arm and leg pivots). A part only
 * changes the shape around them, so every pose works with any mix. An empty
 * slot draws its frame alone, in BARE: filling a slot visibly adds mass.
 *
 * Geometry is painted per vertex, merged per rigid piece and cached per part:
 * one mesh per thing that moves, one material per mesh.
 */

// --- the palette (§1.2): dark for what carries load, mid for what works, pale only where polished or frosted ---
const SHELL = 0x55616e
const DARK = 0x2c343d
const PALE = 0x8e9aa6
const RIME = 0x9fb4c8
/** Rust shown as pitting, not brown: Still is never warm. */
const PIT = 0x3b3e42
const TAG_BLUE = 0x55669a
/**
 * Brass gone grey, as bright as SHELL: another metal, never a light. (The
 * design's 0x857b66 is 1.7x SHELL's luminance; this is its hue at SHELL's.)
 */
const TAG_GOLD = 0x675f4e

/** Materials more than one copy of a part draws with. Loot and the Workshop must never dispose these. */
function shared<M extends THREE.Material>(m: M): M {
  m.userData.shared = true
  return m
}

/** Pale and cold: Grace is the only warm light. The lens, the core and every part's one light share it, so all go out together. */
export const EYE_ON = new THREE.Color(0xd6ebff)
export const EYE_OFF = new THREE.Color(0x0c1014)
export const EYE = shared(new THREE.MeshBasicMaterial({ color: EYE_ON, vertexColors: true }))
/** All steel on every part: one material, painted per vertex. Between the Lantern's two old steels (Q4). */
export const STEEL = shared(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.56, metalness: 0.5 }))
/** A frame on the body, an unfound part on the wall: dull, dark, unpowered. Ignores the paint. */
export const BARE = shared(new THREE.MeshStandardMaterial({ color: 0x15191e, roughness: 0.95, metalness: 0.1 }))
/** Glass that isn't powered: any part not on Still. Loot copies it per drop so one can light up alone. */
export const DISPLAY_EYE = shared(new THREE.MeshBasicMaterial({ color: 0x4d6781, vertexColors: true }))
/** The wall's unfound parts: an inverted hull, so the shape is there to be recognised later. */
export const OUTLINE = shared(outlineMaterial())

function outlineMaterial() {
  const m = new THREE.MeshBasicMaterial({ color: 0x3a4654, side: THREE.BackSide })
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.012;')
  }
  return m
}

// --- the frame's fixed points (§1.1). The poses write these every frame; no part may move them ---
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const O = v3(0, 0, 0)
const NECK = v3(0, 1.56, 0.1)
const STALK_TOP = v3(0.03, 0.2, 0.04)
const LENS_AT = v3(0.03, 0.32, 0.05)
/** Tilted, curious. `animate` writes it back every frame, so no part can change it. */
export const LENS_TILT = 0.18
const TORSO_AT = v3(0, 1.0, 0)
/** A little hunched, leaning into the walk. */
export const HUNCH = 0.16
const CORE_AT = v3(0, 0.28, 0)
const SHOULDER_L = v3(-0.26, 1.5, 0.04)
const ELBOW_L = v3(-0.08, -0.32, 0.08)
const HAND_L = v3(-0.05, -0.64, 0.14)
const SHOULDER_R = v3(0.26, 1.5, 0.04)
const ELBOW_R = v3(0.06, -0.28, 0.07)
/** Where the clamp's jaws rest, either side of the hand. The poses move each jaw by its origin, so a part changes the jaw's geometry, never its position. */
export const JAW_X = -0.05
export const JAW_OPEN = 0.06
const JAW_Y = HAND_L.y - 0.07
const HIP_X = 0.14
const HIP_Y = 0.98
const knee = (side: number) => v3(side * 0.02, -0.4, 0.17)
const ANKLE = v3(0, -0.8, -0.09)
const TOE = v3(0, -0.95, 0.14)
/** The kit's floor tiles top out at +0.05: anything that lies on the floor sits above it. */
const ON_FLOOR = -HIP_Y + 0.075

type G = THREE.BufferGeometry
type Paint = number | ((p: THREE.Vector3, n: THREE.Vector3) => number | THREE.Color)

const tmpC = new THREE.Color()
const tmpP = new THREE.Vector3()
const tmpN = new THREE.Vector3()

/** Non-indexed, with a colour per vertex: everything a piece is made of must merge with everything else. */
function paint(g: G, c: Paint): G {
  const out = g.index ? g.toNonIndexed() : g
  if (out !== g) g.dispose()
  const pos = out.getAttribute('position')
  const nor = out.getAttribute('normal')
  const col = new Float32Array(pos.count * 3)
  if (typeof c === 'number') tmpC.setHex(c)
  for (let i = 0; i < pos.count; i++) {
    if (typeof c !== 'number') {
      const r = c(tmpP.fromBufferAttribute(pos, i), tmpN.fromBufferAttribute(nor, i))
      if (typeof r === 'number') tmpC.setHex(r)
      else tmpC.copy(r)
    }
    col[i * 3] = tmpC.r
    col[i * 3 + 1] = tmpC.g
    col[i * 3 + 2] = tmpC.b
  }
  out.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return out
}

const UP = v3(0, 1, 0)
const qTmp = new THREE.Quaternion()
const mTmp = new THREE.Matrix4()

/** Stand a +y geometry on the segment a → b. */
function along(g: G, a: THREE.Vector3, b: THREE.Vector3): G {
  qTmp.setFromUnitVectors(UP, b.clone().sub(a).normalize())
  return g.applyMatrix4(mTmp.compose(a.clone().add(b).multiplyScalar(0.5), qTmp, v3(1, 1, 1)))
}

/**
 * A frame whose y runs along a → b and whose x stays as close to world x as it
 * can: boxes that follow a limb keep their faces square to the body.
 */
function limbBasis(a: THREE.Vector3, b: THREE.Vector3, side = v3(1, 0, 0)) {
  const y = b.clone().sub(a).normalize()
  const x = side.clone().addScaledVector(y, -side.dot(y)).normalize()
  const z = x.clone().cross(y)
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.clone().add(b).multiplyScalar(0.5))
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, c: Paint, seg = 8) {
  return paint(along(new THREE.CylinderGeometry(r, r, a.distanceTo(b), seg), a, b), c)
}

/** A joint ball. 8×6 is round at every size the camera sees it, and joints are most of a part's triangles. */
function ball(r: number, at: THREE.Vector3, c: Paint) {
  return paint(new THREE.SphereGeometry(r, 8, 6).translate(at.x, at.y, at.z), c)
}

/** A box whose long side runs a → b, `w` across (≈ x) and `d` deep. */
function slab(a: THREE.Vector3, b: THREE.Vector3, w: number, d: number, c: Paint, side?: THREE.Vector3) {
  return paint(new THREE.BoxGeometry(w, a.distanceTo(b), d).applyMatrix4(limbBasis(a, b, side)), c)
}

function box(w: number, h: number, d: number, at: THREE.Vector3, c: Paint, rx = 0, ry = 0, rz = 0) {
  return paint(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).rotateZ(rz).translate(at.x, at.y, at.z), c)
}

/** A cylinder along lens-space z: barrels, discs, drums facing forward. */
function barrel(r: number, h: number, z: number, c: Paint, seg = 16) {
  return paint(new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2).translate(0, 0, z), c)
}

/** A ring facing +z (a rim, a shroud). */
function ringZ(R: number, tube: number, at: THREE.Vector3, c: Paint, seg = 18, arc = Math.PI * 2, rz = 0) {
  return paint(new THREE.TorusGeometry(R, tube, 5, seg, arc).rotateZ(rz).translate(at.x, at.y, at.z), c)
}

/** A flat ring round the body's vertical axis (the torso's rings). */
function ringY(R: number, tube: number, y: number, c: Paint, seg = 18) {
  return paint(new THREE.TorusGeometry(R, tube, 5, seg).rotateX(Math.PI / 2).translate(0, y, 0), c)
}

function glassDisc(r: number, z: number, seg = 18) {
  return paint(new THREE.CircleGeometry(r, seg).translate(0, 0, z), 0xffffff)
}

/** A helix of `turns` round +y, from 0 to h. */
class Helix extends THREE.Curve<THREE.Vector3> {
  constructor(private readonly r: number, private readonly h: number, private readonly turns: number) {
    super()
  }
  override getPoint(t: number, out = new THREE.Vector3()) {
    const a = t * this.turns * Math.PI * 2
    return out.set(Math.cos(a) * this.r, t * this.h, Math.sin(a) * this.r)
  }
}

function helix(a: THREE.Vector3, b: THREE.Vector3, r: number, turns: number, tube: number, c: Paint, perTurn = 10, radial = 5) {
  const len = a.distanceTo(b)
  const g = new THREE.TubeGeometry(new Helix(r, len, turns), Math.round(turns * perTurn), tube, radial, false).translate(0, -len / 2, 0)
  return paint(along(g, a, b), c)
}

/**
 * The tier tag: a thin band, no emissive, always in the same place per slot so
 * they can be counted on the wall. Invisible at phone size on purpose: there, the
 * shape carries the tier.
 */
function tag(tier: Tier, at: THREE.Vector3, axis: THREE.Vector3, R: number): G[] {
  if (tier === 'white') return []
  const g = new THREE.TorusGeometry(R, 0.014, 3, 10)
  qTmp.setFromUnitVectors(v3(0, 0, 1), axis.clone().normalize())
  return [paint(g.applyMatrix4(mTmp.compose(at, qTmp, v3(1, 1, 1))), tier === 'gold' ? TAG_GOLD : TAG_BLUE)]
}

const mix = (a: number, b: number, k: number) => new THREE.Color(a).lerp(new THREE.Color(b), Math.max(0, Math.min(1, k)))

// --- the model tree: groups where things move, one merged mesh per material inside each ---

/**
 * One rigid piece and what hangs off it. `mesh` makes the node itself the mesh
 * (a jaw, the core, the glass): its handle is then the mesh, which is what the
 * poses and the effects already hold.
 */
interface Node {
  name?: string
  at?: THREE.Vector3
  rot?: readonly [number, number, number]
  steel?: G[]
  eye?: G[]
  mesh?: 'steel' | 'eye'
  kids?: Node[]
}

interface Built {
  name?: string
  at?: THREE.Vector3
  rot?: readonly [number, number, number]
  steel?: G
  eye?: G
  mesh?: 'steel' | 'eye'
  kids: Built[]
}

function merge(list: G[] | undefined): G | undefined {
  if (!list || list.length === 0) return undefined
  if (list.length === 1) return list[0]
  const g = mergeGeometries(list)
  if (!g) throw new Error('part geometry would not merge')
  for (const p of list) p.dispose()
  return g
}

function bake(n: Node): Built {
  return { name: n.name, at: n.at, rot: n.rot, mesh: n.mesh, steel: merge(n.steel), eye: merge(n.eye), kids: (n.kids ?? []).map(bake) }
}

interface Mats { steel: THREE.Material; eye: THREE.Material }

function instance(b: Built, mats: Mats): THREE.Object3D {
  let o: THREE.Object3D
  if (b.mesh === 'eye') o = eyeMesh(b.eye!, mats.eye)
  else if (b.mesh === 'steel') o = new THREE.Mesh(b.steel!, mats.steel)
  else {
    o = new THREE.Group()
    if (b.steel) o.add(new THREE.Mesh(b.steel, mats.steel))
    if (b.eye) o.add(eyeMesh(b.eye, mats.eye))
  }
  if (b.name) o.name = b.name
  if (b.at) o.position.copy(b.at)
  if (b.rot) o.rotation.set(b.rot[0], b.rot[1], b.rot[2])
  for (const k of b.kids) o.add(instance(k, mats))
  return o
}

function eyeMesh(g: G, m: THREE.Material) {
  const mesh = new THREE.Mesh(g, m)
  // a flag, not a reference: userData is JSON-copied on every clone
  mesh.userData.eye = true
  return mesh
}

// ============================================================================
// HEAD: reaches far. Neck pivot, a stalk up to the lens, one lit glass facing forward.
// ============================================================================

const STALK_DIR = STALK_TOP.clone().normalize()
/** The head's tag: a collar at the top of the stalk. */
const collar = (tier: Tier, r: number) => tag(tier, STALK_TOP.clone().multiplyScalar(0.82), STALK_DIR, r + 0.012)

function head(stalk: G[], lens: G[], glass: G[], glassAt?: THREE.Vector3, extra: Node[] = []): Node {
  return {
    name: 'head', at: NECK, steel: stalk,
    kids: [{
      name: 'lens', at: LENS_AT, rot: [0, 0, LENS_TILT], steel: lens,
      kids: [{ name: 'glass', mesh: 'eye', at: glassAt, eye: glass }, ...extra],
    }],
  }
}

/** An eye on a stick: a thin ring holding a glass that shows from behind too. No barrel. */
function frameHead(): Node {
  return head(
    [rod(O, STALK_TOP, 0.03, 0)],
    [ringZ(0.12, 0.02, O, 0, 16)],
    [paint(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 14).rotateX(Math.PI / 2), 0xffffff)],
  )
}

/** The Lantern's lens: one round barrel, a rim, the big bright disc. The family marker is the round barrel. */
function lensSteel(o: { r?: number; h?: number; rimR?: number; rimTube?: number; rim?: G } = {}) {
  const h = o.h ?? 0.17
  return [
    barrel(o.r ?? 0.2, h, 0, SHELL),
    o.rim ?? ringZ(o.rimR ?? 0.16, o.rimTube ?? 0.03, v3(0, 0, h / 2 + 0.001), DARK),
  ]
}

const STALK = () => rod(O, STALK_TOP, 0.04, DARK)

function focusingLens(): Node {
  return head([STALK()], lensSteel(), [glassDisc(0.135, 0.087)])
}

/** The bolt passes straight through, and the glass is split straight through. */
function crackedLens(): Node {
  const a = 0.6
  const d = v3(Math.cos(a), Math.sin(a), 0)
  const n = v3(-Math.sin(a), Math.cos(a), 0)
  const shift = d.clone().multiplyScalar(0.03).addScaledVector(n, 0.03)
  const upper = paint(new THREE.CircleGeometry(0.135, 12, a, Math.PI).translate(shift.x, shift.y, 0.091), 0xffffff)
  // a 50° wedge gone from the lower half: the dark barrel face shows through
  const lower = paint(new THREE.CircleGeometry(0.135, 10, a + Math.PI, Math.PI * 0.72).translate(0, 0, 0.087), 0xffffff)
  // the rim breaks where the crack leaves it
  const rim = ringZ(0.16, 0.03, v3(0, 0, 0.086), DARK, 16, Math.PI * 1.75, a + Math.PI * 0.125)
  return head([STALK(), ...collar('blue', 0.04)], lensSteel({ rim }), [upper, lower])
}

/** A deflector hinged off one side: a small mirror for banking shots. */
function ricochetLens(): Node {
  const hinge = v3(0.2, 0, 0.02)
  const yaw = -0.8
  const plate = box(0.24, 0.16, 0.02, hinge.clone().add(v3(Math.cos(-yaw) * 0.12, 0, Math.sin(-yaw) * 0.12)), PALE, 0, yaw)
  return head([STALK(), ...collar('blue', 0.04)], [...lensSteel(), plate, ball(0.03, hinge, SHELL)], [glassDisc(0.135, 0.087)])
}

/** A wide, heavy eye with an iris: the pupil opens as the charge builds. The pupil is the glass handle. */
function patientLens(): Node {
  return head(
    [STALK(), ...collar('blue', 0.04)],
    [...lensSteel({ r: 0.25, h: 0.2, rimR: 0.2, rimTube: 0.035 }), paint(new THREE.CircleGeometry(0.17, 18).translate(0, 0, 0.101), DARK)],
    [glassDisc(0.17, 0)],
    v3(0, 0, 0.103),
  )
}

/** The mortar's axis in lens space: raised 35° up and forward, so the head looks up even at rest. */
const MORTAR = v3(0, Math.sin((35 * Math.PI) / 180), Math.cos((35 * Math.PI) / 180))
const onMortar = (d: number) => MORTAR.clone().multiplyScalar(d)
/** Turns +y onto the mortar's axis, and +z onto it. */
const MORTAR_FROM_Y = (55 * Math.PI) / 180
const MORTAR_FROM_Z = (-35 * Math.PI) / 180

function mortarSteel() {
  const breech = paint(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 14).rotateX(MORTAR_FROM_Y), DARK)
  // closed at 0.27: the glass sits in the mouth, and the rim hides the wall's end
  const t = onMortar(0.135)
  const tube = paint(new THREE.CylinderGeometry(0.15, 0.15, 0.27, 14).rotateX(MORTAR_FROM_Y).translate(t.x, t.y, t.z), SHELL)
  const m = onMortar(0.3)
  const rim = paint(new THREE.TorusGeometry(0.15, 0.03, 6, 16).rotateX(MORTAR_FROM_Z).translate(m.x, m.y, m.z), DARK)
  return [breech, tube, rim]
}

function mortarGlass() {
  const g = onMortar(0.272)
  return [paint(new THREE.CircleGeometry(0.11, 16).rotateX(MORTAR_FROM_Z).translate(g.x, g.y, g.z), 0xffffff)]
}

function flare(): Node {
  return head([STALK()], mortarSteel(), mortarGlass())
}

/** The Flare mortar with a signal lamp on a thin mast. The bulb is its own mesh, so it can blink. */
function signalFlare(): Node {
  const top = onMortar(0.3).addScaledVector(v3(0, MORTAR.z, -MORTAR.y), 0.15)
  const mastTop = top.clone().add(v3(0, 0.1, 0))
  return head(
    [STALK(), ...collar('blue', 0.04)],
    [...mortarSteel(), rod(top, mastTop, 0.015, DARK, 6)],
    mortarGlass(), undefined,
    [{ name: 'blinker', mesh: 'eye', at: mastTop.clone().add(v3(0, 0.03, 0)), eye: [paint(new THREE.SphereGeometry(0.04, 8, 6), 0xffffff)] }],
  )
}

/**
 * The only straight line on Still, shaped like the beam it fires. Boss-only
 * parts use the Assembler's vocabulary: square where Still is round.
 */
function throughLine(): Node {
  const muzzle = [
    box(0.2, 0.03, 0.03, v3(0, 0.085, 0.42), SHELL), box(0.2, 0.03, 0.03, v3(0, -0.085, 0.42), SHELL),
    box(0.03, 0.2, 0.03, v3(0.085, 0, 0.42), SHELL), box(0.03, 0.2, 0.03, v3(-0.085, 0, 0.42), SHELL),
  ]
  return head(
    [slab(O, STALK_TOP, 0.07, 0.07, DARK), ...collar('gold', 0.045)],
    [
      box(0.16, 0.16, 0.52, v3(0, 0, 0.16), DARK),
      box(0.02, 0.03, 0.5, v3(0.07, 0.095, 0.16), PALE), box(0.02, 0.03, 0.5, v3(-0.07, 0.095, 0.16), PALE),
      ...muzzle,
    ],
    // the glass is a slit along the top: a lit line, pointing where he faces
    [paint(new THREE.PlaneGeometry(0.035, 0.36).rotateX(-Math.PI / 2).translate(0, 0.082, 0.22), 0xffffff)],
  )
}

/** Three small lenses in a fan, the outer two turned out at the fan's own angle, on a coiled stalk. */
function overclockedCoil(): Node {
  const steel: G[] = [box(0.44, 0.05, 0.06, v3(0, 0, -0.1), DARK)]
  const glass: G[] = []
  for (const i of [-1, 0, 1]) {
    steel.push(paint(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 12).rotateX(Math.PI / 2).rotateY(0.26 * i).translate(0.17 * i, 0, 0), SHELL))
    glass.push(paint(new THREE.CircleGeometry(0.07, 12).translate(0, 0, 0.071).rotateY(0.26 * i).translate(0.17 * i, 0, 0), 0xffffff))
  }
  return head(
    [rod(O, STALK_TOP, 0.035, DARK), helix(O, STALK_TOP, 0.06, 5, 0.014, SHELL, 9, 4), ...tag('gold', STALK_TOP.clone().multiplyScalar(0.97), STALK_DIR, 0.075)],
    steel, glass,
  )
}

// ============================================================================
// TORSO: works around Still. Both rings, the core, the hunch, a cage you can see the core through.
// ============================================================================

function torso(cage: G[], coreExtra: G[] = [], extra: Node[] = []): Node {
  return {
    name: 'torso', at: TORSO_AT, rot: [HUNCH, 0, 0], steel: cage,
    kids: [{ name: 'core', mesh: 'eye', at: CORE_AT, eye: [paint(new THREE.SphereGeometry(0.11, 10, 8), 0xffffff), ...coreExtra] }, ...extra],
  }
}

/** The tag: a thin ring just under the top ring, following the cage's slight ellipse. */
const underRing = (tier: Tier) => tag(tier, v3(0, 0.49, 0), UP, 0.235).map((g) => g.scale(1, 1, 0.9))

const barFoot = (a: number) => v3(Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15)
const barHead = (a: number) => v3(Math.cos(a) * 0.23, 0.55, Math.sin(a) * 0.2)

function ventBars(c: Paint = SHELL, n = 6, r = 0.035) {
  const out: G[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    out.push(rod(barFoot(a), barHead(a), r, c, 6))
  }
  return out
}

const rings = (c: number = DARK, tube = 0.045) => [ringY(0.23, tube, 0.55, c, 16), ringY(0.15, tube, 0, c, 12)]

/** Two rings and three thin bars: a bright core in almost nothing. */
function frameTorso(): Node {
  const bars: G[] = []
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    bars.push(rod(barFoot(a), barHead(a), 0.022, 0, 6))
  }
  return torso([...rings(0, 0.03), ...bars])
}

function pressureVent(): Node {
  return torso([...ventBars(), ...rings()])
}

/** A cage of flat slats: a small, still version of the shell it raises. The core glints through the slits. */
function wardSlats(): G[] {
  const out: G[] = []
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2
    const b = barFoot(a)
    const t = barHead(a)
    const up = t.clone().sub(b).normalize()
    const radial = v3(Math.cos(a), 0, Math.sin(a))
    const out3 = radial.addScaledVector(up, -radial.dot(up)).normalize()
    const side = up.clone().cross(out3)
    const m = new THREE.Matrix4().makeBasis(side, up, out3).setPosition(b.clone().add(t).multiplyScalar(0.5))
    out.push(paint(new THREE.BoxGeometry(0.075, b.distanceTo(t), 0.02).applyMatrix4(m), SHELL))
  }
  return out
}

function ward(): Node {
  return torso([...wardSlats(), ...rings()])
}

/** The Vent with an intake fan on its back: it draws air in, and enemies with it. The fan spins, so it's its own mesh. */
function backdraftVent(): Node {
  const at = v3(0, 0.3, -0.26)
  const blades: G[] = [paint(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8).rotateX(Math.PI / 2), SHELL)]
  for (let k = 0; k < 3; k++) {
    blades.push(paint(new THREE.BoxGeometry(0.14, 0.05, 0.012).rotateX(0.35).translate(0.11, 0, 0).rotateZ((k / 3) * Math.PI * 2), SHELL))
  }
  const struts = [-1, 1].map((s) => rod(v3(s * 0.113, 0.413, -0.26), v3(s * 0.105, 0.41, -0.162), 0.02, DARK, 6))
  return torso(
    [...ventBars(), ...rings(), ringZ(0.16, 0.025, at, DARK, 12), ...struts, ...underRing('blue')],
    [],
    [{ name: 'fan', mesh: 'steel', at, steel: blades }],
  )
}

/** The Vent frosted from the bottom up, icicles off the hip ring: cold falls. */
function chillVent(): Node {
  const icicles: G[] = []
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2
    const h = i % 2 ? 0.16 : 0.1
    icicles.push(paint(new THREE.ConeGeometry(0.03, h, 6).rotateX(Math.PI).translate(Math.cos(a) * 0.15, -0.02 - h / 2, Math.sin(a) * 0.15), RIME))
  }
  // the same bottom-up rime that climbs a slowed enemy
  const frost = (p: THREE.Vector3) => mix(RIME, SHELL, p.y / 0.35)
  return torso([...ventBars(frost), ...rings(), ...icicles, ...underRing('blue')])
}

/** The Vent cross-braced like a scaffold, front and back, so it reads from any facing. */
function brace(): Node {
  const braces: G[] = []
  for (const s of [1, -1]) {
    for (const [i, x] of [-1, 1].entries()) {
      const a = v3(x * 0.12, 0, s * (0.11 + 0.012 * i))
      const b = v3(-x * 0.12, 0.55, s * (0.216 + 0.012 * i))
      braces.push(slab(a, b, 0.05, 0.025, DARK, v3(1, 0, 0)))
    }
    braces.push(ball(0.03, v3(0, 0.275, s * 0.18), SHELL))
  }
  return torso([...ventBars(), ...rings(), ...braces, ...underRing('blue')])
}

/** Ward's slats with a convex mirror on the chest; its lit centre is part of the core, so it flashes and dims with it. */
function mirrorWard(): Node {
  const mirror = paint(new THREE.SphereGeometry(0.3, 16, 3, 0, Math.PI * 2, 0.12, 0.45).rotateX(Math.PI / 2).translate(0, 0.3, -0.09), PALE)
  return torso([...wardSlats(), ...rings(), mirror, ...underRing('blue')], [glassDisc(0.04, 0.212, 10).translate(0, 0.02, 0)])
}

/**
 * An old hurricane lantern, bulging between its rings, with an angler's lamp on
 * an arched rod over his back. The decoy appears behind him, and the lure
 * already hangs there: the model teaches where the decoy will be.
 */
function lure(): Node {
  const bars: G[] = []
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const bulge = v3(Math.cos(a) * 0.25, 0.28, Math.sin(a) * 0.25)
    bars.push(rod(barFoot(a), bulge, 0.03, SHELL, 6), rod(bulge, barHead(a), 0.03, SHELL, 6))
  }
  const curve = new THREE.CatmullRomCurve3([v3(0, 0.55, -0.2), v3(0, 0.85, -0.3), v3(0, 0.92, -0.45), v3(0, 0.8, -0.55)])
  const arch = paint(new THREE.TubeGeometry(curve, 12, 0.02, 4, false), DARK)
  // the line is part of the lamp's own mesh, painted dark (the lights take vertex colours too): one draw call, not two
  return torso([...bars, ...rings(), arch, ...underRing('gold')], [], [{
    name: 'bulb', at: v3(0, 0.8, -0.55), mesh: 'eye',
    eye: [rod(O, v3(0, -0.08, 0), 0.008, 0x080a0c, 4), paint(new THREE.SphereGeometry(0.055, 8, 6).translate(0, -0.13, 0), 0xffffff)],
  }])
}

// ============================================================================
// ARMS: close. Left clamp, right hook, always.
// ============================================================================

const FOREARM = HAND_L.clone().sub(ELBOW_L).normalize()
/** The tag: a cuff on the left wrist. */
const cuff = (tier: Tier, r: number) => tag(tier, ELBOW_L.clone().lerp(HAND_L, 0.86), FOREARM, r + 0.012)

/** A jaw is placed by its origin (the poses write its x); its shape is offset inside the geometry. */
function jaw(name: 'jawL' | 'jawR', geo: G): Node {
  return { name, mesh: 'steel', at: v3(JAW_X + (name === 'jawL' ? -JAW_OPEN : JAW_OPEN), JAW_Y, HAND_L.z), steel: [geo] }
}

/** The Lantern's jaws: their tops sit at the hand (JAW_Y + 0.08). */
const lanternJaw = () => paint(new THREE.BoxGeometry(0.05, 0.16, 0.07), SHELL)
const smallJaw = (c: number) => paint(new THREE.BoxGeometry(0.035, 0.12, 0.05).translate(0, 0.02, 0), c)

function arms(left: G[], jaws: [G, G], right: G[], extra: Node[] = []): Node {
  return {
    name: 'arms',
    kids: [
      { name: 'armL', at: SHOULDER_L, steel: left, kids: [jaw('jawL', jaws[0]), jaw('jawR', jaws[1]), ...extra] },
      { name: 'armR', at: SHOULDER_R, steel: right },
    ],
  }
}

/** The hook hangs under the right elbow, its top at the elbow ball. */
function hookRing(R: number, tube: number, c: number) {
  return paint(new THREE.TorusGeometry(R, tube, 6, 12, Math.PI * 1.3).rotateY(Math.PI / 2).translate(ELBOW_R.x, ELBOW_R.y - 0.02 - R, ELBOW_R.z), c)
}

const lanternRight = () => [rod(O, ELBOW_R, 0.05, DARK), ball(0.06, ELBOW_R, SHELL), hookRing(0.1, 0.035, SHELL)]
const lanternLeft = () => [rod(O, ELBOW_L, 0.05, DARK), rod(ELBOW_L, HAND_L, 0.045, SHELL), ball(0.06, ELBOW_L, SHELL)]

/** Thin rods, small jaws, a small hook: two thin lines. */
function frameArms(): Node {
  return arms(
    [rod(O, ELBOW_L, 0.035, 0, 6), rod(ELBOW_L, HAND_L, 0.03, 0, 6), ball(0.045, ELBOW_L, 0)],
    [smallJaw(0), smallJaw(0)],
    [rod(O, ELBOW_R, 0.035, 0, 6), ball(0.045, ELBOW_R, 0), hookRing(0.07, 0.022, 0)],
  )
}

/**
 * The blade's plane: along the forearm (s) and forward (t), with the thickness
 * across it. It's offset to the outside of the left arm, edge forward.
 */
const BLADE = (() => {
  const e1 = FOREARM.clone()
  const fwd = v3(0, 0, 1)
  const e2 = fwd.addScaledVector(e1, -fwd.dot(e1)).normalize()
  const e3 = e1.clone().cross(e2)
  return new THREE.Matrix4().makeBasis(e1, e2, e3).setPosition(ELBOW_L.clone().add(v3(-0.05, 0, 0)).addScaledVector(e2, -0.02))
})()

/** A sheet of scrap lashed along the clamp's forearm, 0.06 deep at the elbow to 0.16 at the wrist. `notches` frays its edge. */
function scrapBlade(notches = false): G[] {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.lineTo(0.34, 0)
  s.lineTo(0.34, 0.16)
  if (notches) {
    // three V cuts along the edge, which runs from (0.34, 0.16) back to (0, 0.06)
    const edge = (u: number) => new THREE.Vector2(0.34 * (1 - u), 0.16 - 0.1 * u)
    for (const u of [0.25, 0.5, 0.75]) {
      const a = edge(u - 0.07)
      const b = edge(u + 0.07)
      const m = edge(u)
      s.lineTo(a.x, a.y)
      s.lineTo(m.x, m.y - 0.04)
      s.lineTo(b.x, b.y)
    }
  }
  s.lineTo(0, 0.06)
  s.closePath()
  const blade = paint(new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false }).translate(0, 0, -0.01).applyMatrix4(BLADE), PALE)
  const rivets = [[0.09, 0.03], [0.25, 0.04]].map(([x, y]) => ball(0.022, v3(x!, y!, 0.012).applyMatrix4(BLADE), PALE))
  return [blade, ...rivets]
}

/** Loose strips off the blade's edge, fanning toward the wrist: the wider swing it grows into. */
function frayStrips(): G[] {
  const out: G[] = []
  for (const [len, s0, t0, ang] of [[0.14, 0.12, 0.1, 1.3], [0.17, 0.2, 0.12, 1.0], [0.2, 0.28, 0.145, 0.7]] as const) {
    out.push(paint(new THREE.BoxGeometry(len, 0.03, 0.015).translate(len / 2, 0, 0).rotateZ(ang).translate(s0, t0, 0).applyMatrix4(BLADE), PALE))
  }
  return out
}

function scrapCleaver(): Node {
  return arms([...lanternLeft(), ...scrapBlade()], [lanternJaw(), lanternJaw()], lanternRight())
}

/** The piston's left forearm: a fat sleeve, a polished rod, and a punch plate the jaws close in front of. */
function pistonLeft(tier: Tier): G[] {
  const sleeveEnd = ELBOW_L.clone().addScaledVector(FOREARM, 0.2)
  return [
    rod(O, ELBOW_L, 0.05, DARK), ball(0.06, ELBOW_L, SHELL),
    rod(ELBOW_L, sleeveEnd, 0.08, DARK, 10),
    rod(sleeveEnd, HAND_L, 0.035, PALE),
    rod(HAND_L.clone().addScaledVector(FOREARM, -0.02), HAND_L.clone().addScaledVector(FOREARM, 0.02), 0.09, SHELL, 12),
    ...cuff(tier, 0.035),
  ]
}

function piston(): Node {
  return arms(pistonLeft('white'), [lanternJaw(), lanternJaw()], lanternRight())
}

/** Cleaver arms whose hook has grown and hangs on a chain: for once the hook side is the long one. */
function rustedHook(): Node {
  const links: G[] = []
  for (let k = 0; k < 3; k++) {
    const g = new THREE.TorusGeometry(0.035, 0.012, 3, 8)
    if (k % 2) g.rotateY(Math.PI / 2)
    links.push(paint(g.translate(ELBOW_R.x, ELBOW_R.y - 0.055 - 0.06 * k, ELBOW_R.z), PIT))
  }
  const c = v3(0.06, -0.6, 0.07)
  // a J: from the top, down the front, round the bottom and up the back to its point
  const hook = paint(new THREE.TorusGeometry(0.15, 0.045, 6, 16, Math.PI * 1.5).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(c.x, c.y, c.z), PIT)
  const barb = paint(new THREE.ConeGeometry(0.035, 0.08, 6).translate(c.x, c.y + 0.04, c.z - 0.15), PIT)
  return arms(
    [...lanternLeft(), ...scrapBlade(), ...cuff('blue', 0.045)],
    [lanternJaw(), lanternJaw()],
    [rod(O, ELBOW_R, 0.05, DARK), ball(0.06, ELBOW_R, SHELL), ...links, hook, barb],
  )
}

/**
 * A long curved tine, 0.26 long, curving toward the other jaw at its tip. Its top
 * sits where the Lantern jaw's top was; open, the tips are 0.09 apart, and the
 * parry's shut brings them together.
 */
function crescent(inward: number): G {
  const s = new THREE.Shape()
  const pts: [number, number][] = []
  const back: [number, number][] = []
  for (let i = 0; i <= 8; i++) {
    const t = i / 8
    const c = inward * (-0.045 + 0.05 * t * t)
    const w = (0.05 - 0.03 * t) / 2
    const y = 0.08 - 0.26 * t
    pts.push([c - w, y])
    back.push([c + w, y])
  }
  const outline = [...pts, ...back.reverse()]
  s.moveTo(outline[0]![0], outline[0]![1])
  for (const [x, y] of outline.slice(1)) s.lineTo(x, y)
  s.closePath()
  return paint(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }).translate(0, 0, -0.025), SHELL)
}

function parryClamp(): Node {
  return arms([...lanternLeft(), ...scrapBlade(), ...cuff('blue', 0.045)], [crescent(1), crescent(-1)], lanternRight())
}

function frayedCleaver(): Node {
  return arms([...lanternLeft(), ...scrapBlade(true), ...frayStrips(), ...cuff('blue', 0.045)], [lanternJaw(), lanternJaw()], lanternRight())
}

/**
 * The Piston arm with a claw built to hold a body. Open, the gap is 0.18 (the
 * Lantern's is 0.07); shut, it still leaves about 0.07, as if it's holding something.
 */
function tossJaw(outward: number): G {
  const x = outward * 0.075
  const inner = x - outward * 0.045
  return merge([
    paint(new THREE.BoxGeometry(0.09, 0.28, 0.11).translate(x, -0.06, 0), SHELL),
    paint(new THREE.BoxGeometry(0.05, 0.04, 0.11).translate(inner, -0.18, 0), SHELL),
  ])!
}

function clampToss(): Node {
  return arms([...pistonLeft('blue')], [tossJaw(-1), tossJaw(1)], lanternRight())
}

/** An anvil across the wrist on a solid beam of a forearm: held overhead in the stance, brought down in the slam. */
function anvil(): Node {
  // the icon's profile in (forward, up): flat top, horn forward, waist, foot
  const p: [number, number][] = [
    [-0.16, 0.075], [0.16, 0.075], [0.16, 0.058], [0.07, 0.02], [0.04, 0.02], [0.035, -0.03],
    [0.1, -0.075], [-0.12, -0.075], [-0.055, -0.03], [-0.06, 0.02], [-0.16, 0.03],
  ]
  const s = new THREE.Shape()
  s.moveTo(p[0]![0], p[0]![1])
  for (const [a, b] of p.slice(1)) s.lineTo(a, b)
  s.closePath()
  const at = HAND_L.clone().add(v3(0, 0.06, 0.02))
  // shape x -> forward (z), shape y -> up, extrusion -> across (-x)
  const m = new THREE.Matrix4().makeBasis(v3(0, 0, 1), v3(0, 1, 0), v3(-1, 0, 0)).setPosition(at)
  // the top face is worn pale by blows
  const worn = (q: THREE.Vector3, n: THREE.Vector3) => (n.y > 0.7 && q.y > at.y + 0.07 ? PALE : SHELL)
  const head = paint(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false }).translate(0, 0, -0.06).applyMatrix4(m), worn)
  return arms(
    [
      rod(O, ELBOW_L, 0.065, DARK), ball(0.07, ELBOW_L, SHELL),
      slab(ELBOW_L, HAND_L, 0.1, 0.1, DARK),
      head, ...cuff('gold', 0.06),
    ],
    [smallJaw(SHELL), smallJaw(SHELL)],
    lanternRight(),
  )
}

// ============================================================================
// LEGS: move him. Hip pivots, the backward bird bend, feet on the floor.
// ============================================================================

/** The tag: a band on each shin, above the ankle. */
const shinBand = (tier: Tier, side: number, r: number) => tag(tier, knee(side).lerp(ANKLE, 0.8), ANKLE.clone().sub(knee(side)), r + 0.012)

function legs(leg: (side: number) => G[], extra: Node[] = []): Node {
  return {
    name: 'legs',
    kids: [
      // hinged at the hip, so the whole leg swings when he walks
      { name: 'legL', at: v3(-HIP_X, HIP_Y, 0), steel: leg(-1) },
      { name: 'legR', at: v3(HIP_X, HIP_Y, 0), steel: leg(1) },
      ...extra,
    ],
  }
}

/** Thin bird legs: two thin bent lines. */
function frameLegs(): Node {
  return legs((side) => {
    const k = knee(side)
    return [rod(O, k, 0.05, 0, 6), rod(k, ANKLE, 0.04, 0, 6), rod(ANKLE, TOE, 0.035, 0, 6), ball(0.06, k, 0), ball(0.045, ANKLE, 0)]
  })
}

function kickstartLeg(side: number): G[] {
  const k = knee(side)
  return [rod(O, k, 0.07, DARK), rod(k, ANKLE, 0.055, DARK), rod(ANKLE, TOE, 0.05, SHELL), ball(0.085, k, SHELL), ball(0.06, ANKLE, SHELL)]
}

const kickstart = () => legs(kickstartLeg)

/** Sled runners under the feet, worn pale underneath: long flat feet, twice the Lantern's. */
function skidPlates(): Node {
  const worn = (_: THREE.Vector3, n: THREE.Vector3) => (n.y < -0.5 ? PALE : SHELL)
  const nose = (25 * Math.PI) / 180
  return legs((side) => [
    ...kickstartLeg(side),
    box(0.12, 0.03, 0.34, v3(0, ON_FLOOR, 0.04), worn),
    box(0.12, 0.03, 0.08, v3(0, ON_FLOOR + 0.04 * Math.sin(nose), 0.21 + 0.04 * Math.cos(nose)), worn, -nose),
    ...shinBand('blue', side, 0.055),
  ])
}

/** Ram plates on the knees: in the ram pose the knees lead. */
function overrun(): Node {
  return legs((side) => {
    const k = knee(side)
    // the plate lies along the thigh, faced forward
    const along = k.clone().negate().normalize()
    const face = v3(0, 0, 1).addScaledVector(along, -along.z).normalize()
    const across = along.clone().cross(face)
    const at = k.clone().add(v3(0, 0, 0.07))
    const m = new THREE.Matrix4().makeBasis(across, along, face).setPosition(at)
    const buffer = paint(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8).rotateX(Math.PI / 2).translate(0, 0, 0.05).applyMatrix4(m), PALE)
    return [...kickstartLeg(side), paint(new THREE.BoxGeometry(0.17, 0.22, 0.05).applyMatrix4(m), DARK), buffer, ...shinBand('blue', side, 0.055)]
  })
}

/** A frost scraper trailing behind each heel, the thing that leaves the track. */
function frostTrail(): Node {
  return legs((side) => [...kickstartLeg(side), slab(ANKLE, v3(0, ON_FLOOR, -0.31), 0.02, 0.08, RIME), ...shinBand('blue', side, 0.055)])
}

/** Three splayed toes and a back spur: a small star at each foot. The family's marker. */
function forkedFoot(): G[] {
  const toe = TOE.clone().sub(ANKLE).normalize().multiplyScalar(0.25)
  const out = [-40, 0, 40].map((deg) => rod(ANKLE, ANKLE.clone().add(toe.clone().applyAxisAngle(UP, (deg * Math.PI) / 180)), 0.03, SHELL, 6))
  out.push(rod(ANKLE, ANKLE.clone().add(v3(0, -0.06, -0.035)), 0.025, SHELL, 6))
  return out
}

function skitter(): Node {
  return legs((side) => {
    const k = knee(side)
    return [rod(O, k, 0.06, DARK), rod(k, ANKLE, 0.04, DARK), ball(0.07, k, SHELL), ball(0.045, ANKLE, SHELL), ...forkedFoot()]
  })
}

/** Skitter's legs with coiled shins: pale, thick, striped, where every other shin is thin and dark. */
function springHeels(): Node {
  return legs((side) => {
    const k = knee(side)
    return [
      rod(O, k, 0.06, DARK), rod(k, ANKLE, 0.02, DARK, 6), helix(k, ANKLE, 0.065, 4.5, 0.02, SHELL, 6, 3),
      ball(0.07, k, SHELL), ball(0.045, ANKLE, SHELL), ...forkedFoot(), ...shinBand('blue', side, 0.075),
    ]
  })
}

/**
 * Bare frame legs in steel, and a plumb bob hanging between them at knee height:
 * the anchor he drops. The pelvis bar runs along the hips' own axis, so each
 * half rides in its leg without being seen to swing (one draw call fewer).
 */
function plumbLine(): Node {
  const pendulum: Node = {
    name: 'pendulum', at: v3(0, 0.96, 0.02),
    steel: [
      rod(O, v3(0, -0.3, 0), 0.008, PALE, 4),
      paint(new THREE.SphereGeometry(0.07, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, -0.37, 0), SHELL),
      paint(new THREE.ConeGeometry(0.07, 0.14, 10).rotateX(Math.PI).translate(0, -0.44, 0), SHELL),
    ],
    eye: [paint(new THREE.SphereGeometry(0.025, 6, 4).translate(0, -0.51, 0), 0xffffff)],
  }
  return legs((side) => {
    const k = knee(side)
    return [
      rod(O, v3(-side * HIP_X, 0, 0), 0.03, DARK),
      rod(O, k, 0.05, DARK), rod(k, ANKLE, 0.04, DARK), rod(ANKLE, TOE, 0.035, SHELL, 6),
      ball(0.06, k, SHELL), ball(0.045, ANKLE, SHELL), ...shinBand('gold', side, 0.04),
    ]
  }, [pendulum])
}

/** The Assembler's square sections, and clock wheels for knees: clockwork that runs backwards. */
function borrowedTime(): Node {
  return legs((side) => {
    const k = knee(side)
    const teeth: G[] = []
    for (let i = 0; i < 8; i++) teeth.push(paint(new THREE.BoxGeometry(0.07, 0.035, 0.03).translate(0, 0.13, 0).rotateX((i / 8) * Math.PI * 2).translate(k.x, k.y, k.z), SHELL))
    return [
      slab(O, k, 0.1, 0.08, DARK), slab(k, ANKLE, 0.08, 0.07, DARK), slab(ANKLE, TOE, 0.08, 0.05, SHELL),
      paint(new THREE.CylinderGeometry(0.12, 0.12, 0.07, 14).rotateZ(Math.PI / 2).translate(k.x, k.y, k.z), SHELL),
      paint(new THREE.TorusGeometry(0.12, 0.015, 4, 14).rotateY(Math.PI / 2).translate(k.x + side * 0.036, k.y, k.z), PALE),
      ...teeth,
      paint(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10).rotateZ(Math.PI / 2).translate(ANKLE.x, ANKLE.y, ANKLE.z), SHELL),
      ...shinBand('gold', side, 0.055),
    ]
  })
}

// ============================================================================
// The registry, the cache, the behaviours
// ============================================================================

const BUILDERS: Record<string, () => Node> = {
  'frame:head': frameHead, 'frame:torso': frameTorso, 'frame:arms': frameArms, 'frame:legs': frameLegs,
  'focusing-lens': focusingLens, 'flare': flare, 'cracked-lens': crackedLens, 'ricochet-lens': ricochetLens,
  'patient-lens': patientLens, 'signal-flare': signalFlare, 'through-line': throughLine, 'overclocked-coil': overclockedCoil,
  'pressure-vent': pressureVent, 'ward': ward, 'backdraft-vent': backdraftVent, 'chill-vent': chillVent,
  'brace': brace, 'mirror-ward': mirrorWard, 'lure': lure,
  'scrap-cleaver': scrapCleaver, 'piston': piston, 'rusted-hook': rustedHook, 'parry-clamp': parryClamp,
  'frayed-cleaver': frayedCleaver, 'clamp-toss': clampToss, 'anvil': anvil,
  'kickstart': kickstart, 'skitter': skitter, 'skid-plates': skidPlates, 'overrun': overrun,
  'frost-trail': frostTrail, 'spring-heels': springHeels, 'plumb-line': plumbLine, 'borrowed-time': borrowedTime,
}

/** Built lazily, never disposed: 34 small sets of geometry, shared by every copy (body, floor, wall, ghosts). */
const cache = new Map<string, Built>()

function built(key: string): Built {
  let b = cache.get(key)
  if (!b) {
    const make = BUILDERS[key]
    if (!make) throw new Error(`no model for part ${key}`)
    b = bake(make())
    cache.set(key, b)
  }
  return b
}

/** What the parts' idle motion reads, every tick. */
export interface PartCtx {
  /** How fast he's going, smoothed: 0 standing, 1 a full walk, more on a dash. */
  speed: number
  /** The walk phase (`Still.stride`). */
  bob: number
  /** Forward acceleration, u/s², smoothed. What a pendulum lags against. */
  accel: number
  /** Patient Lens's charge, 0..1. */
  charge: number
  /** An enemy carries his mark (Signal Flare). */
  marked: boolean
  /** The pose playing and how far through it (0..1), or null. */
  pose: string | null
  k: number
  /** A move is carrying him (a dash, a snap). */
  moving: boolean
  /** He's in pieces: idle motion stops (the fan coasts down). */
  broken: boolean
}

export interface SlotModel {
  /** At the slot's home (§1.1). */
  root: THREE.Object3D
  lens?: THREE.Group
  glass?: THREE.Mesh
  core?: THREE.Mesh
  armL?: THREE.Group
  armR?: THREE.Group
  jawL?: THREE.Mesh
  jawR?: THREE.Mesh
  legL?: THREE.Group
  legR?: THREE.Group
  /** Idle motion (§3 per part). */
  tick?(dt: number, ctx: PartCtx): void
  /** Its thing is out in the world: what's out there is missing from the body (rule 7). */
  setLive?(out: boolean): void
  /** Back to rest: a new run, a reassembly. */
  reset?(): void
}

type Behaviour = (m: SlotModel) => Pick<SlotModel, 'tick' | 'setLive' | 'reset'>

const find = <T extends THREE.Object3D>(root: THREE.Object3D, name: string) => root.getObjectByName(name) as T

/** Four parts whose idle motion says something. Everything else stands still. */
const BEHAVIOURS: Record<string, Behaviour> = {
  // the pupil opens with the charge, and pops once when it's full: the only idle that carries information
  'patient-lens': (m) => {
    const pupil = m.glass!
    let s = 0.35
    let pop = 0
    let wasFull = false
    return {
      tick(dt, ctx) {
        if (ctx.broken) return
        s += (0.35 + 0.65 * ctx.charge - s) * Math.min(1, dt * 8)
        const full = ctx.charge >= 1
        if (full && !wasFull) pop = 0.1
        wasFull = full
        pop = Math.max(0, pop - dt)
        pupil.scale.setScalar(pop > 0 ? 1.1 : s)
      },
      reset() { s = 0.35; pop = 0; wasFull = false },
    }
  },
  // blinks every 2 s; while his mark is out, at 4 Hz: the mark is out, and the body says so
  'signal-flare': (m) => {
    const bulb = find<THREE.Mesh>(m.root, 'blinker')
    let t = 0
    return {
      tick(dt, ctx) {
        if (ctx.broken) return
        t += dt
        const off = ctx.marked ? (t * 4) % 1 >= 0.5 : t % 2 < 0.12
        bulb.scale.setScalar(off ? 0.001 : 1)
      },
      reset() { t = 0 },
    }
  },
  // turns at 1 rev/s, winds up to 12 on the inhale, coasts back over a second (and down to nothing when he breaks)
  'backdraft-vent': (m) => {
    const fan = find<THREE.Mesh>(m.root, 'fan')
    let rate = 1
    return {
      tick(dt, ctx) {
        const inhale = !ctx.broken && ctx.pose === 'nova' && ctx.k < 0.3
        const target = ctx.broken ? 0 : inhale ? 12 : 1
        rate += (target - rate) * Math.min(1, dt * (inhale ? 14 : 3))
        fan.rotation.z += rate * Math.PI * 2 * dt
      },
      reset() { rate = 1 },
    }
  },
  // the lure swings behind him, lagging the walk; while the decoy is out, the light went with it
  'lure': (m) => {
    const bulb = find<THREE.Mesh>(m.root, 'bulb')
    return {
      tick(_dt, ctx) {
        if (ctx.broken) return
        bulb.rotation.x = 0.5 * Math.min(1.5, ctx.speed) + 0.15 * Math.sin(ctx.bob)
      },
      setLive(out) { bulb.visible = !out },
      reset() { bulb.visible = true },
    }
  },
  // the bob lags his acceleration on a spring; it goes at the plant's stomp and comes back on the snap's arrival
  'plumb-line': (m) => {
    const bob = find<THREE.Group>(m.root, 'pendulum')
    let a = 0
    let w = 0
    let out = false
    let hideIn = -1
    return {
      tick(dt, ctx) {
        if (ctx.broken) return
        w += (-30 * a - 5 * w + 0.12 * ctx.accel) * dt
        a = Math.max(-0.9, Math.min(0.9, a + w * dt))
        bob.rotation.x = a
        bob.rotation.z = 0.2 * Math.sin(ctx.bob) * Math.min(1, ctx.speed)
        // the plant pose stomps at k 0.4 of 0.3 s: that's when it leaves his hands
        if (hideIn >= 0 && (hideIn -= dt) < 0) bob.visible = false
        if (!out && !bob.visible && !ctx.moving) bob.visible = true
      },
      setLive(next) {
        if (next && !out) hideIn = 0.12
        if (!next) hideIn = -1
        out = next
      },
      reset() { a = w = 0; out = false; hideIn = -1; bob.visible = true },
    }
  },
}

/**
 * A slot's model: a part, or `null` for the empty slot's frame. `body` is worn
 * (lit glass, STEEL, or BARE for a frame); `display` is on the floor or the wall
 * (unpowered glass). Every call is a fresh set of objects over shared geometry.
 */
export function buildModel(slot: SlotName, id: string | null, use: 'body' | 'display'): SlotModel {
  if (id && byId(id)?.slot !== slot) throw new Error(`${id} is not a ${slot} part`)
  const mats: Mats = {
    steel: id ? STEEL : BARE,
    eye: use === 'body' ? EYE : DISPLAY_EYE,
  }
  const root = instance(built(id ?? `frame:${slot}`), mats)
  const m: SlotModel = { root }
  if (slot === 'head') {
    m.lens = find<THREE.Group>(root, 'lens')
    m.glass = find<THREE.Mesh>(root, 'glass')
  } else if (slot === 'torso') {
    m.core = find<THREE.Mesh>(root, 'core')
  } else if (slot === 'arms') {
    m.armL = find<THREE.Group>(root, 'armL')
    m.armR = find<THREE.Group>(root, 'armR')
    m.jawL = find<THREE.Mesh>(root, 'jawL')
    m.jawR = find<THREE.Mesh>(root, 'jawR')
  } else {
    m.legL = find<THREE.Group>(root, 'legL')
    m.legR = find<THREE.Group>(root, 'legR')
  }
  const b = use === 'body' && id ? BEHAVIOURS[id] : undefined
  if (b) Object.assign(m, b(m))
  return m
}

/**
 * The Workshop's (and the floor's) copy of a part, off Still. Found: steel and
 * unpowered glass. Unfound: BARE, black glass, and an outline hull, so the shape
 * is there to be recognised when it drops.
 */
export function partModel(def: AbilityDef, state: 'found' | 'unfound' = 'found'): SlotModel {
  const m = buildModel(def.slot, def.id, 'display')
  if (state === 'unfound') {
    const hulls: THREE.Mesh[] = []
    m.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      if (o.userData.eye) {
        o.material = UNFOUND_EYE
        return
      }
      o.material = BARE
      hulls.push(o)
    })
    for (const o of hulls) o.add(new THREE.Mesh(o.geometry, OUTLINE))
  }
  return m
}

const UNFOUND_EYE = shared(new THREE.MeshBasicMaterial({ color: EYE_OFF, vertexColors: true }))

/** Floor scale per slot, so every drop is about 0.6 u across, a little bigger than worn (§5). */
export const FLOOR_SCALE: Record<SlotName, number> = { head: 1.3, torso: 1.05, arms: 0.75, legs: 0.6 }
/** Wall scale: the same for every part, so relative sizes stay true (§4). */
export const WALL_SCALE = 1.25

/**
 * A model scaled and moved so it turns about its own middle rather than its
 * pivot: the floor's spinner, the pickup close-up. `half` is its half-height
 * once scaled.
 */
export function centred(root: THREE.Object3D, scale: number): { group: THREE.Group; half: number } {
  root.updateMatrixWorld(true)
  const box = new THREE.Box3().setFromObject(root)
  const inner = new THREE.Group()
  inner.add(root)
  inner.position.copy(box.getCenter(new THREE.Vector3())).negate()
  const group = new THREE.Group()
  group.scale.setScalar(scale)
  group.add(inner)
  return { group, half: ((box.max.y - box.min.y) / 2) * scale }
}

/** Triangles in a part's model, for the budget (700 a part, about 2,500 for Still). */
export function triangles(slot: SlotName, id: string | null): number {
  let n = 0
  buildModel(slot, id, 'display').root.traverse((o) => {
    if (o instanceof THREE.Mesh) n += o.geometry.getAttribute('position').count / 3
  })
  return n
}
