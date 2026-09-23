import './style.css'
import * as THREE from 'three'
import { createWorld, pushOutOfColliders, ARENA_RADIUS, grade } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'
import { Combat, MELEE_PAD, type Archetype } from './combat'
import type { AbilityDef } from './abilities'
import type { Enemy } from './enemy'
import { RANGED } from './ranged'
import * as sfx from './audio'
import { createCameraRig } from './camera'
import { createOverlay, type EndingKind } from './ending'

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
const overlay = createOverlay(hudRoot)
const rig = createCameraRig(world)

const still = new Still()
world.scene.add(still.group)

sfx.unlockAudio()

/** Screen-space left/right of a world point relative to Still, for stereo panning. */
function panOf(at: THREE.Vector3) {
  const screenX = ((at.x - still.pos.x) - (at.z - still.pos.z)) * Math.SQRT1_2
  return Math.max(-1, Math.min(1, screenX / 9)) * 0.7
}

const windups = new Map<Enemy, () => void>()

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
    rig.punch(-0.03)
    navigator.vibrate?.(30)
  },
  onKill: (at) => {
    sfx.kill(panOf(at))
    hitstop = Math.max(hitstop, 0.08)
    shake = Math.max(shake, 0.28)
    rig.punch(0.035)
  },
  onDash: (x, z, ms) => {
    still.startDash(x, z, ms)
    shake = Math.max(shake, 0.18)
    rig.punch(0.03)
  },
  onShot: () => sfx.shot(0),
  onWindup: (e, ms) => {
    // once Still is stopping, the world is slowing with him; a real-time tell would lie
    if (run.phase !== 'fight' && run.phase !== 'breather') return
    const stop = e.kind === 'ranged' ? sfx.aim(ms, RANGED.lockAt, panOf(e.pos)) : sfx.windup(ms, panOf(e.pos))
    windups.set(e, stop)
  },
  onStrike: (e) => {
    windups.delete(e)
    if (e.kind === 'ranged') sfx.fire(panOf(e.pos))
    else sfx.strike(panOf(e.pos))
  },
  onShotBlocked: (at) => sfx.blocked(panOf(at)),
  onGone: (e) => {
    windups.get(e)?.()
    windups.delete(e)
  },
})

/** Dev only: lets a headless browser read the fight without guessing from pixels. */
if (import.meta.env.DEV) Object.assign(window, { __combat: combat, __world: world })

// --- the run: fights, breathers between them, and the two ways it ends ---

const STRAIN_MAX = 20
const STRAIN_PER_PUSH = 2
const STRAIN_DECAY_PER_FIGHT = 4
const BREATHER = 2.6
/** How long Still takes to stop. The sound, the zoom and the colour all run on this. */
const STOP_SECONDS = 3.4
/** How long the broken parts tumble before the cut. Short on purpose. */
const BREAK_SECONDS = 0.85

type Phase = 'fight' | 'breather' | 'broken' | 'stopping' | 'over'

const run = { phase: 'fight' as Phase, fight: 1, cleared: 0, strain: 0, t: 0 }

/**
 * 3 + n enemies. One ranged from the start, two from fight 3; never the first
 * to arrive, so every fight opens on the chaser you already know.
 */
function roster(n: number): Archetype[] {
  const size = 3 + n
  const ranged = n >= 3 ? 2 : 1
  const rest: Archetype[] = Array.from({ length: size - 1 }, (_, i) => (i < ranged ? 'ranged' : 'chaser'))
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[rest[i], rest[j]] = [rest[j]!, rest[i]!]
  }
  return ['chaser', ...rest]
}

function startRun() {
  combat.reset()
  still.reassemble()
  still.pos.set(0, 0, 0)
  prev.set(0, 0, 0)
  Object.assign(run, { phase: 'fight', fight: 1, cleared: 0, strain: 0, t: 0 })
  combat.startFight(roster(1))
  rig.reset()
  world.gradePass.uniforms.uSaturation!.value = grade.saturation
  hud.enabled = true
  overlay.hide()
  sfx.restore()
  overlay.banner('Fight 1')
}

function end(kind: EndingKind) {
  run.phase = 'over'
  overlay.show(kind, run.cleared, startRun)
}

function stopAllWindups() {
  for (const stop of windups.values()) stop()
  windups.clear()
}

function breakApart() {
  run.phase = 'broken'
  run.t = 0
  hud.enabled = false
  stopAllWindups()
  const from = combat.nearestTarget(still.pos, 99) ?? new THREE.Vector3(still.pos.x, 0, still.pos.z - 1)
  still.breakApart(from.x, from.z)
  sfx.shatter()
  navigator.vibrate?.(120)
  hitstop = 0.16
  shake = 1.1
  rig.punch(0.1)
}

function beginStopping() {
  run.phase = 'stopping'
  run.t = 0
  hud.enabled = false
  stopAllWindups()
  sfx.windDown(STOP_SECONDS)
}

hud.onFire((def, pushed) => {
  if (run.phase !== 'fight' && run.phase !== 'breather') return
  cast(def, pushed)
  if (pushed) {
    run.strain = Math.min(STRAIN_MAX, run.strain + STRAIN_PER_PUSH)
    // the push that crosses the line still lands at full power; then he stops
    if (run.strain >= STRAIN_MAX) beginStopping()
  }
})

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
  rig.punch(pushed ? 0.06 : 0.02)
}

let accumulator = 0
let last = performance.now() / 1000

const prev = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const camOffset = world.camera.position.clone()

function simulate(realDt: number) {
  prev.copy(still.pos)

  if (run.phase === 'over') return

  if (run.phase === 'broken') {
    run.t += realDt
    still.updateBroken(realDt)
    if (run.t >= BREAK_SECONDS) end('broken')
    return
  }

  // Stopping: Still and the world run down together, the eye goes out, the view
  // closes in and the colour drains. Grace's light is left alone.
  let dt = realDt
  if (run.phase === 'stopping') {
    run.t += realDt
    const k = Math.min(1, run.t / STOP_SECONDS)
    const ease = k * k * (3 - 2 * k)
    dt = realDt * (1 - ease)
    still.setSlowdown(ease)
    rig.hold = 1 + ease * 0.45
    world.gradePass.uniforms.uSaturation!.value = grade.saturation * (1 - ease * 0.8)
    if (run.t >= STOP_SECONDS + 0.5) {
      end('stopped')
      return
    }
  }

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
  hud.strain = run.strain

  if (combat.hp <= 0 && run.phase !== 'stopping') {
    breakApart()
    return
  }

  if (run.phase === 'fight' && combat.cleared) {
    run.cleared++
    run.strain = Math.max(0, run.strain - STRAIN_DECAY_PER_FIGHT)
    run.phase = 'breather'
    run.t = 0
    sfx.cleared()
    overlay.banner(`Fight ${run.fight} cleared \u00b7 strain \u2212${STRAIN_DECAY_PER_FIGHT}`)
  } else if (run.phase === 'breather') {
    run.t += dt
    if (run.t >= BREATHER) {
      run.fight++
      run.phase = 'fight'
      combat.startFight(roster(run.fight))
      hud.integrity = 1
      overlay.banner(`Fight ${run.fight}`)
    }
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
  rig.update(elapsed, camTarget, combat.enemies.map((e) => e.pos), run.phase === 'breather')
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

startRun()
requestAnimationFrame(frame)
