import './style.css'
import * as THREE from 'three'
import { createWorld, pushOutOfColliders, ARENA_RADIUS } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'
import { Combat, MELEE_PAD } from './combat'
import type { AbilityDef } from './abilities'
import type { Chaser } from './enemy'
import * as sfx from './audio'

const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!
const rotateEl = document.querySelector<HTMLElement>('#rotate')!

/** The orientation media query is unreliable in fullscreen on Android; measure instead. */
function checkOrientation() {
  rotateEl.classList.toggle('show', window.innerHeight > window.innerWidth)
}
checkOrientation()
window.addEventListener('resize', checkOrientation)
window.addEventListener('orientationchange', checkOrientation)

const world = createWorld(canvas)
const hud = createHud(hudRoot)
createGradePanel(hudRoot, world)

const still = new Still()
world.scene.add(still.group)

sfx.unlockAudio()

/** Screen-space left/right of a world point relative to Still, for stereo panning. */
function panOf(at: THREE.Vector3) {
  const screenX = ((at.x - still.pos.x) - (at.z - still.pos.z)) * Math.SQRT1_2
  return Math.max(-1, Math.min(1, screenX / 9)) * 0.7
}

const windups = new Map<Chaser, () => void>()

const BODY_RADIUS = 0.42
const STEP = 1 / 60
const MAX_FRAME = 0.25

/** Hit feel lives here: a few frames of frozen time and a kick to the camera. */
let hitstop = 0
let shake = 0

const combat = new Combat(world.scene, world.colliders, {
  onHit: (at) => {
    sfx.hit(panOf(at))
    hitstop = Math.max(hitstop, 0.045)
    shake = Math.max(shake, 0.1)
  },
  onPlayerHurt: () => {
    sfx.hurt()
    hitstop = Math.max(hitstop, 0.09)
    shake = Math.max(shake, 0.5)
    navigator.vibrate?.(30)
  },
  onKill: (at) => {
    sfx.kill(panOf(at))
    hitstop = Math.max(hitstop, 0.08)
    shake = Math.max(shake, 0.28)
  },
  onDash: (x, z, ms) => {
    still.startDash(x, z, ms)
    shake = Math.max(shake, 0.18)
  },
  onShot: () => sfx.shot(0),
  onWindup: (e, ms) => windups.set(e, sfx.windup(ms, panOf(e.pos))),
  onStrike: (e) => {
    windups.delete(e)
    sfx.strike(panOf(e.pos))
  },
  onGone: (e) => {
    windups.get(e)?.()
    windups.delete(e)
  },
})

hud.onFire((def, pushed) => cast(def, pushed))

function cast(def: AbilityDef, pushed: boolean) {
  // Snap the body to the target, or the swing plays sideways out of his shoulder.
  // Nothing in reach: still face the nearest threat, never the way you're running.
  if (def.shape === 'arc') {
    const snap = combat.nearestTarget(still.pos, def.range + MELEE_PAD) ?? combat.nearestTarget(still.pos, 9.5)
    if (snap) still.facing = Math.atan2(snap.x - still.pos.x, snap.z - still.pos.z)
  }
  combat.useAbility(def, still.pos, still.facing, hud.moveX, hud.moveZ)
  sfx.ability(def.shape, pushed)
  still.group.scale.setScalar(pushed ? 1.16 : 1.08)
  shake = Math.max(shake, pushed ? 0.34 : 0.16)
  hitstop = Math.max(hitstop, pushed ? 0.06 : 0.035)
}

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


  const target = combat.nearestTarget(still.pos, 9.5)
  still.aim = target ? Math.atan2(target.x - still.pos.x, target.z - still.pos.z) : null

  combat.update(dt, still.pos)
  hud.integrity = combat.hp / 100

  if (combat.hp <= 0) {
    sfx.down()
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
