import './style.css'
import * as THREE from 'three'
import { createWorld, pushOutOfColliders, ARENA_RADIUS } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'
import { Combat } from './combat'

const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!

const world = createWorld(canvas)
const hud = createHud(hudRoot)
createGradePanel(hudRoot, world)

const still = new Still()
world.scene.add(still.group)

const BODY_RADIUS = 0.42
const STEP = 1 / 60
const MAX_FRAME = 0.25

/** Hit feel lives here: a few frames of frozen time and a kick to the camera. */
let hitstop = 0
let shake = 0

const combat = new Combat(world.scene, world.colliders, {
  onHit: () => {
    hitstop = Math.max(hitstop, 0.045)
    shake = Math.max(shake, 0.1)
  },
  onPlayerHurt: () => {
    hitstop = Math.max(hitstop, 0.09)
    shake = Math.max(shake, 0.5)
    navigator.vibrate?.(30)
  },
  onKill: () => {
    hitstop = Math.max(hitstop, 0.08)
    shake = Math.max(shake, 0.28)
  },
})

hud.onFire((slot, pushed) => {
  // Session three wires these to real actions. For now the press is its own tell.
  console.log(`${slot.name}${pushed ? ' (pushed)' : ''}`)
  still.group.scale.setScalar(pushed ? 1.14 : 1.07)
})

let accumulator = 0
let last = performance.now() / 1000

const prev = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const camOffset = world.camera.position.clone()

function simulate(dt: number) {
  prev.copy(still.pos)
  still.update(dt, hud.moveX, hud.moveZ)

  const d = Math.hypot(still.pos.x, still.pos.z)
  const limit = ARENA_RADIUS - 1.2
  if (d > limit) {
    still.pos.x = (still.pos.x / d) * limit
    still.pos.z = (still.pos.z / d) * limit
  }
  pushOutOfColliders(still.pos, BODY_RADIUS, world.colliders)

  combat.update(dt, still.pos)
  hud.integrity = combat.hp / 100

  if (combat.hp <= 0) {
    combat.reset()
    still.pos.set(0, 0, 0)
    shake = 0.9
  }

  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
}

function frame(nowMs: number) {
  const now = nowMs / 1000
  const elapsed = Math.min(MAX_FRAME, now - last)
  last = now

  if (hitstop > 0) {
    hitstop -= elapsed
  } else {
    accumulator += elapsed
    while (accumulator >= STEP) {
      simulate(STEP)
      accumulator -= STEP
    }
  }

  const alpha = accumulator / STEP
  const x = prev.x + (still.pos.x - prev.x) * alpha
  const z = prev.z + (still.pos.z - prev.z) * alpha
  still.group.position.x = x
  still.group.position.z = z

  world.graceLight.position.set(x, 4.6, z)

  shake = Math.max(0, shake - elapsed * 3.2)
  camTarget.set(x, 0, z)
  world.camera.position.copy(camTarget).add(camOffset)
  if (shake > 0) {
    const k = shake * shake * 0.9
    world.camera.position.x += (Math.random() - 0.5) * k
    world.camera.position.z += (Math.random() - 0.5) * k
    world.camera.position.y += (Math.random() - 0.5) * k
  }
  world.camera.lookAt(camTarget)

  hud.update(nowMs)
  world.render()
  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)
