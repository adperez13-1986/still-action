import './style.css'
import * as THREE from 'three'
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js'
import { createWorld, grade } from './world'
import { buildInstanced, loadKit, type Placement } from './kit'
import { PARTS, type AbilityDef } from './abilities'
import { TIER_COLOR } from './loot'
import { SLOT_NAMES, Still, type SlotName } from './still'

/**
 * DEV: every part on Still, for review. Open /parts.html.
 *
 * Four rows, one per slot: the empty slot's frame, then each part (white, blue,
 * gold) worn on a Still whose other three slots are frames, at the game's camera
 * angle. Below them, a row of mixes of four (the first is run 1: one part, three
 * frames). Beside every row, the same Stills at the size he really is at the
 * widest zoom (0.7, 16 px a unit on the phone): that strip is the 16 px test.
 * "game light" puts each one under his own Grace light and the real grade, the
 * way he's lit in a run. `?seed=` fixes the mixes. Not part of the game.
 */

const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!
const world = createWorld(canvas, { arena: false })
// every cell is lit and graded as if it were Still at the centre of the screen, where there's no vignette
world.gradePass.uniforms.uVignette!.value = 0

/** Screen units: right, and up the screen per unit of floor (the 38° pitch). */
const RIGHT = new THREE.Vector3(1, 0, -1).normalize()
const UP_FLOOR = new THREE.Vector3(-1, 0, -1).normalize()
const PITCH_SIN = Math.sin((38 * Math.PI) / 180)
const COL = 1.75
const ROW = 2.5
/** The game-size strip beside each row: packed about as close as they'd stand in a fight. */
const SMALL_COL = 0.8
const GAP = 1.2
const PER_ROW = 9
const LEFT = -(PER_ROW * (COL + SMALL_COL) + GAP) / 2
const closeX = (i: number) => LEFT + COL / 2 + i * COL
const smallX = (i: number) => LEFT + PER_ROW * COL + GAP + SMALL_COL / 2 + i * SMALL_COL
/** Where Grace's light hangs over him in a run (main.ts GRACE_Y). */
const GRACE_Y = 6
/** Px per unit on the phone at the widest zoom (design/parts/4-appearance.md §0). */
const PHONE_PX = 16

interface Cell {
  still: Still
  /** At game size, in the strip beside its row: drawn by its own camera at the phone's zoom. */
  small: boolean
  label: string
  color: string
  /** The parts it wears, for the cast button. */
  worn: AbilityDef[]
  /** Where it shows on the page's floor: its label, its patch of screen. */
  floor: THREE.Vector3
  /** Where it really stands. The same as `floor` close up; out of sight for the strip, full size, on its own floor. */
  at: THREE.Vector3
}

/** The strip's Stills stand out here, far off the page's view, a room's width apart. */
const STRIP_AT = new THREE.Vector3(0, 0, 90)
const STRIP_GAP = 7
let stripN = 0

const cells: Cell[] = []
const bySlot = (slot: SlotName) => PARTS.filter((p) => p.slot === slot)
const code = (p: AbilityDef) => `${p.key}${bySlot(p.slot).indexOf(p) + 1}`
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`

function floorAt(sx: number, sy: number) {
  return RIGHT.clone().multiplyScalar(sx).addScaledVector(UP_FLOOR, sy / PITCH_SIN)
}

/** One cell close up, and its twin at game size in the strip. */
function add(worn: AbilityDef[], i: number, sy: number, label: string, color = '#cbd7e6') {
  const out: Cell[] = []
  for (const small of [false, true]) {
    const still = new Still()
    for (const slot of SLOT_NAMES) still.wear(slot, worn.find((p) => p.slot === slot) ?? null)
    const floor = floorAt(small ? smallX(i) : closeX(i), small ? sy + 0.6 : sy)
    const n = stripN++
    const at = small ? STRIP_AT.clone().add(new THREE.Vector3((n % 12) * STRIP_GAP, 0, Math.floor(n / 12) * STRIP_GAP)) : floor
    still.pos.copy(at)
    still.facing = Math.PI / 4 + 0.35
    world.scene.add(still.group)
    const c: Cell = { still, small, label: small ? '' : label, color, worn, floor, at }
    cells.push(c)
    out.push(c)
  }
  return out
}

/** Screen height of everything: the chips, four slot rows and the mixes. */
const ROWS = 4
const HEIGHT = (ROWS + 1) * ROW + 1.4
/** The head row's feet: its heads, and the chips above them, fit under the top edge. */
const TOP = HEIGHT / 2 - 2.8

/** The grid's zoom: everything on screen at once. */
function zoom() {
  return grade.viewHeight / HEIGHT
}
/** The strip's zoom: a unit is the phone's 16 px at the widest zoom, whatever this screen's size. */
function gameZoom() {
  return (PHONE_PX * grade.viewHeight) / window.innerHeight
}

// --- the grid: a row per slot, top to bottom in body order ---
SLOT_NAMES.forEach((slot, r) => {
  const list = bySlot(slot)
  for (let i = 0; i <= list.length; i++) {
    const p = i === 0 ? null : list[i - 1]!
    add(p ? [p] : [], i, TOP - r * ROW, p ? `${code(p)} ${p.name}` : `${slot} frame`, p ? hex(TIER_COLOR[p.tier]) : '#7d8896')
  }
})

/** The mixes' strip Stills reuse the same spots on every reroll, so they keep their floor. */
const GRID_SMALL = stripN

// --- the mixes: seeded, so a screenshot can be taken again ---
let seed = Number(new URLSearchParams(location.search).get('seed')) || Math.floor(Math.random() * 1e6)
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const mixCells: Cell[] = []
function mixes() {
  for (const c of mixCells) {
    world.scene.remove(c.still.group)
    cells.splice(cells.indexOf(c), 1)
  }
  mixCells.length = 0
  stripN = GRID_SMALL
  const sets: AbilityDef[][] = []
  // the first is run 1: one plain part and three frames
  const starters = PARTS.filter((p) => p.tier === 'white')
  sets.push([starters[Math.floor(rand() * starters.length)]!])
  while (sets.length < PER_ROW) sets.push(SLOT_NAMES.map((s) => { const l = bySlot(s); return l[Math.floor(rand() * l.length)]! }))
  sets.forEach((set, i) => mixCells.push(...add(set, i, TOP - ROWS * ROW, set.map(code).join(' '))))
}

/** `?row=head` (torso, arms, legs, mixes) closes in on one row, `&col=` on one cell, `&z=` how far. */
const FOCUS_ZOOM = Number(new URLSearchParams(location.search).get('z')) || 1.75
const ORIGIN = new THREE.Vector3()
const focusRow = new URLSearchParams(location.search).get('row')
const focusIndex = focusRow === 'mixes' ? ROWS : SLOT_NAMES.indexOf(focusRow as SlotName)
const focusCol = Number(new URLSearchParams(location.search).get('col') ?? NaN)
const focus = focusRow && focusIndex >= 0 ? floorAt(Number.isNaN(focusCol) ? 0 : closeX(focusCol), TOP - focusIndex * ROW + 0.8) : null

mixes()

// --- lights: the review rig (neutral, even) or the game's (hemisphere, key, Grace over each one) ---
const gameLights = world.scene.children.filter((o) => o instanceof THREE.HemisphereLight || o instanceof THREE.DirectionalLight)
const review = new THREE.Group()
// bright enough to see every value, dim enough that no steel crosses the bloom threshold
review.add(new THREE.HemisphereLight(0xe8edf2, 0x4a5058, 1.5))
const sun = new THREE.DirectionalLight(0xffffff, 1.5)
sun.position.set(6, 12, 9)
review.add(sun)
world.scene.add(review)

// dark like the dungeon's stone, so the steel's values read the way they will in a run
const reviewFloor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 1 }))
reviewFloor.rotation.x = -Math.PI / 2
world.scene.add(reviewFloor)

let gameFloor: THREE.Group | null = null
let game = false

function setLight(on: boolean) {
  game = on
  // the review is flat and even; the game's fog is set per cell (CellsPass)
  world.scene.fog = on ? world.fog : null
  for (const l of gameLights) l.visible = on
  world.graceLight.visible = on
  review.visible = !on
  reviewFloor.visible = !on
  if (gameFloor) gameFloor.visible = on
  world.gradePass.uniforms.uSaturation!.value = on ? grade.saturation : 1
  lightChip.textContent = on ? 'game light' : 'review light'
  lightChip.classList.toggle('on', on)
}

/**
 * In a run, Grace's light hangs right over Still wherever he goes. One light
 * can't hang over forty of him, so in game light each cell is drawn on its own,
 * scissored to its patch of screen, with the light moved over it: every one is
 * lit exactly as he would be. The strip's cells are drawn the same way by a
 * second camera at the phone's zoom, CAM_DIST from them like the game's, so the
 * floor, the fog and the bloom are all at true size. Bloom and the grade then
 * run over the whole frame.
 */
class CellsPass extends Pass {
  private readonly cam = new THREE.OrthographicCamera()
  constructor() {
    super()
    this.needsSwap = false
  }
  override render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget) {
    const scene = world.scene
    const camera = world.camera
    renderer.setRenderTarget(read)
    renderer.clear()
    const W = read.width
    const H = read.height
    const px = (H * camera.zoom) / grade.viewHeight
    const ndc = new THREE.Vector3()
    const view = camera.getWorldDirection(new THREE.Vector3())
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    // in a run the camera sits this far from Still along its view: fog is measured from there
    const inGame = 40 / Math.cos((38 * Math.PI) / 180)
    const g = world.graceLight
    const cam = this.cam
    cam.copy(camera)
    cam.zoom = gameZoom()
    cam.updateProjectionMatrix()
    if (!game) {
      for (const o of cells) o.still.group.visible = !o.small
      renderer.render(scene, camera)
    }
    read.scissorTest = true
    for (const c of cells) {
      if (!game && !c.small) continue
      for (const o of cells) o.still.group.visible = o === c
      ndc.copy(c.floor).project(camera)
      const x = (ndc.x * 0.5 + 0.5) * W
      const y = (ndc.y * 0.5 + 0.5) * H
      const w = (c.small ? SMALL_COL : COL) * px
      const below = (c.small ? 0.6 : 0.5) * px
      const above = (c.small ? ROW - 0.6 : ROW - 0.5) * px
      read.scissor.set(Math.round(x - w / 2), Math.round(y - below), Math.round(w), Math.round(below + above))
      renderer.setRenderTarget(read)
      let eye: THREE.Camera = camera
      if (c.small) {
        // placed so the Still lands on its patch: where `floor` projects on the page, `at` projects here
        cam.position.copy(c.at)
          .addScaledVector(right, (-ndc.x * camera.right) / cam.zoom)
          .addScaledVector(up, (-ndc.y * camera.top) / cam.zoom)
          .addScaledVector(view, -inGame)
        cam.updateMatrixWorld()
        eye = cam
      }
      const depth = c.small ? 0 : c.floor.clone().sub(camera.position).dot(view) - inGame
      world.fog.near = grade.fogNear + depth
      world.fog.far = grade.fogFar + depth
      g.position.copy(c.at).setY(GRACE_Y)
      renderer.render(scene, eye)
    }
    read.scissorTest = false
    world.fog.near = grade.fogNear
    world.fog.far = grade.fogFar
    for (const o of cells) o.still.group.visible = true
  }
}

// swap the composer's scene render for the per-cell one
const renderPass = world.composer.passes[0]!
world.composer.removePass(renderPass)
world.composer.insertPass(new CellsPass(), 0)

// --- the chips ---
function chip(text: string, left: number, onClick: () => void) {
  const b = document.createElement('button')
  b.className = 'chip'
  b.textContent = text
  b.style.cssText = `position:absolute;top:8px;left:${left}px;pointer-events:auto;z-index:20`
  b.addEventListener('click', onClick)
  hudRoot.appendChild(b)
  return b
}
const lightChip = chip('review light', 10, () => setLight(!game))
let turning = false
let walking = false
let casting = false
const toggle = (b: HTMLButtonElement, on: boolean) => b.classList.toggle('on', on)
const turnChip = chip('turn', 120, () => toggle(turnChip, (turning = !turning)))
const walkChip = chip('walk', 180, () => toggle(walkChip, (walking = !walking)))
const castChip = chip('cast', 242, () => toggle(castChip, (casting = !casting)))
chip('new mixes', 302, () => mixes())

const labels = document.createElement('div')
labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:600 10px ui-sans-serif,system-ui;text-shadow:0 1px 3px #000'
hudRoot.appendChild(labels)

// dev hooks for the headless review
Object.assign(window, { __cells: cells, __setLight: setLight, __remix: mixes, __flags: (o: { turn?: boolean; walk?: boolean; cast?: boolean }) => {
  turning = o.turn ?? turning
  walking = o.walk ?? walking
  casting = o.cast ?? casting
} })

void loadKit().then(() => {
  // the dungeon's own paving under the whole review, for the game light
  const placements: Placement[] = []
  const laid = new Set<string>()
  const tile = (x: number, z: number) => !laid.has(`${x},${z}`) && laid.add(`${x},${z}`) && placements.push({ piece: 'floor_tile_large', x, z, rotY: (Math.abs(Math.round(x * 7 + z * 3)) % 4) * (Math.PI / 2) })
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) tile(i * 4, j * 4)
  // and under each of the strip's Stills
  for (const c of cells) if (c.small) for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) tile(Math.round(c.at.x / 4 + i) * 4, Math.round(c.at.z / 4 + j) * 4)
  gameFloor = buildInstanced(placements)
  world.scene.add(gameFloor)
  setLight(new URLSearchParams(location.search).get('light') === 'game')

  const offset = world.camera.position.clone()
  const tmp = new THREE.Vector3()
  let last = performance.now() / 1000
  let castT = 0
  let t = 0
  const loop = (ms: number) => {
    const now = ms / 1000
    const dt = Math.min(0.05, now - last)
    last = now
    t += dt
    world.camera.zoom = zoom() * (focus ? FOCUS_ZOOM : 1)
    world.camera.updateProjectionMatrix()
    world.camera.position.copy(focus ?? ORIGIN).add(offset)
    world.camera.lookAt(focus ?? ORIGIN)

    const cast = casting && (castT -= dt) <= 0
    if (cast) castT = 1.6
    for (const c of cells) {
      const s = c.still
      if (turning) s.facing += dt * 0.6
      s.ctx.charge = Math.min(1, (t * 0.25) % 1.3)
      if (cast && c.worn.length) {
        const p = c.worn[Math.floor(Math.random() * c.worn.length)]!
        s.attack({ beat: p.beat, pushed: false, holdS: ['ward', 'mirror', 'brace', 'anvil'].includes(p.beat) ? 0.5 : 0 })
      }
      s.pos.copy(c.at)
      s.update(dt, walking ? Math.sin(s.facing) * 0.9 : 0, walking ? Math.cos(s.facing) * 0.9 : 0)
      // walking in place: the legs and the bob, never the travel
      s.pos.copy(c.at)
      s.group.position.set(c.at.x, s.group.position.y, c.at.z)
    }

    labels.innerHTML = cells.filter((c) => c.label).map((c) => {
      tmp.copy(c.floor).addScaledVector(UP_FLOOR, -0.3 / PITCH_SIN).project(world.camera)
      const x = (tmp.x * 0.5 + 0.5) * window.innerWidth
      const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight
      return `<div style="position:absolute;left:${x}px;top:${y}px;transform:translateX(-50%);white-space:nowrap;color:${c.color}">${c.label}</div>`
    }).join('')

    world.render()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})
