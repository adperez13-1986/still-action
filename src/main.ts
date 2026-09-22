import './style.css'
import * as THREE from 'three'
import { createWorld, ARENA_RADIUS } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'

const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!

const world = createWorld(canvas)
const hud = createHud(hudRoot)
createGradePanel(hudRoot, world)

const still = new Still()
world.scene.add(still.group)

hud.onFire((slot, pushed) => {
  // Session one: nothing shoots yet. The tell is enough to judge the feel of the press.
  console.log(`${slot.name}${pushed ? ' (pushed)' : ''}`)
  still.group.scale.setScalar(pushed ? 1.14 : 1.07)
})

// --- fixed 60Hz simulation, interpolated render ---
const STEP = 1 / 60
const MAX_FRAME = 0.25
let accumulator = 0
let last = performance.now() / 1000

const prev = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const camOffset = world.camera.position.clone()

function simulate(dt: number) {
  prev.copy(still.pos)
  still.update(dt, hud.moveX, hud.moveZ)

  // arena bounds — circles on a plane, no physics engine
  const d = Math.hypot(still.pos.x, still.pos.z)
  const limit = ARENA_RADIUS - 1.2
  if (d > limit) {
    still.pos.x = (still.pos.x / d) * limit
    still.pos.z = (still.pos.z / d) * limit
  }

  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
}

function frame(nowMs: number) {
  const now = nowMs / 1000
  accumulator += Math.min(MAX_FRAME, now - last)
  last = now

  while (accumulator >= STEP) {
    simulate(STEP)
    accumulator -= STEP
  }

  // render between sim ticks so movement stays smooth above 60Hz
  const alpha = accumulator / STEP
  const x = prev.x + (still.pos.x - prev.x) * alpha
  const z = prev.z + (still.pos.z - prev.z) * alpha
  still.group.position.x = x
  still.group.position.z = z

  world.graceLight.position.set(x, 1.7, z)

  camTarget.set(x, 0, z)
  world.camera.position.copy(camTarget).add(camOffset)
  world.camera.lookAt(camTarget)

  hud.update(nowMs)
  world.render()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
