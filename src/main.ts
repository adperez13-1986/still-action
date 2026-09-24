import './style.css'
import * as THREE from 'three'
import { createWorld, grade } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'
import { Combat, MELEE_PAD, ELITE_LINE, type Archetype, type Pack } from './combat'
import { STARTING, PARTS, type AbilityDef } from './abilities'
import { SLOT_NAMES } from './still'
import type { Enemy } from './enemy'
import { RANGED } from './ranged'
import * as sfx from './audio'
import { createCameraRig } from './camera'
import { updateMusic } from './music'
import { Loot, LOOT, rollPart, type GroundPart } from './loot'
import { createPauseScreen } from './pause'
import { createOverlay, type EndingKind } from './ending'
import { loadKit } from './kit'
import { generateLevel, type Level, type Shrine } from './dungeon'
import type { Terrain } from './terrain'

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

const world = createWorld(canvas, { arena: false })
const hud = createHud(hudRoot)
createGradePanel(hudRoot, world)
const overlay = createOverlay(hudRoot)
const rig = createCameraRig(world)
const loot = new Loot(world.scene)
const pause = createPauseScreen(hudRoot)

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
/** Grace's light hangs high for a wide, soft pool on stone (settled in the look test). */
const GRACE_Y = 6
/** How far her light drifts off Still toward the exit: the light you carry points the way. */
const GRACE_LEAN = 1.8

/** Before the first level exists: nothing is solid. */
const OPEN: Terrain = {
  pushOut: () => {},
  blocked: () => false,
  lineClear: () => true,
  clampMove: (_ax, _az, bx, bz) => ({ x: bx, z: bz }),
  nextStep: (_ax, _az, bx, bz) => ({ x: bx, z: bz }),
}
const STEP = 1 / 60
const MAX_FRAME = 0.25

/** Hit feel lives here: a few frames of frozen time and a kick to the camera. */
let hitstop = 0
let shake = 0

const combat = new Combat(world.scene, OPEN, {
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
  onKill: (at, kind, pack, wasElite) => {
    sfx.kill(panOf(at))
    maybeDrop(at, kind, pack, wasElite)
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
  onSmash: (b) => {
    level?.smash(b)
    const at = new THREE.Vector3(b.x, 0, b.z)
    combat.burst(at, 0xb89a7a)
    sfx.smash(panOf(at))
    shake = Math.max(shake, 0.12)
    const roll = Math.random()
    if (roll < LOOT.crateParts) {
      const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
      const def = fillEmpty(taken) ?? rollPart('chaser', taken)
      if (def) {
        loot.drop(def, at, still.pos)
        sfx.drop(def.tier, panOf(at))
      }
    } else if (roll < LOOT.crateParts + LOOT.crateScrap) {
      loot.dropScrap(at)
    }
  },
  onWake: (at) => {
    sfx.alert(panOf(at))
    rig.punch(-0.02)
  },
  onWindup: (e, ms) => {
    // once Still is stopping, the world is slowing with him; a real-time tell would lie
    if (run.phase !== 'crawl') return
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
if (import.meta.env.DEV) Object.assign(window, { __combat: combat, __world: world, __loot: loot, __hud: hud, __still: still, __level: () => level })

// --- the run: a descent through generated levels, and the two ways it ends ---

const STRAIN_MAX = 20
const STRAIN_PER_PUSH = 2
/** How long Still takes to stop. The sound, the zoom and the colour all run on this. */
const STOP_SECONDS = 3.4
/** How long the broken parts tumble before the cut. Short on purpose. */
const BREAK_SECONDS = 0.85
/** The fade down to the next depth: out, swap the level, back in. */
const DESCEND_OUT = 0.45
const DESCEND_IN = 0.5
const EXIT_RADIUS = 1.4

type Phase = 'crawl' | 'descending' | 'broken' | 'stopping' | 'over'

const run = { phase: 'crawl' as Phase, depth: 1, strain: 0, t: 0, swapped: false, fought: false, quietT: 0 }

/** Nothing awake for this long counts as a fight cleared. */
const QUIET_SECONDS = 2.5
const QUIET_STRAIN = 2
let level: Level | null = null

const fade = document.createElement('div')
fade.style.cssText = 'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:5'
document.body.appendChild(fade)

// --- loot: drops come from enemies, on the ground; walk over, tap take ---

/** Offered ground part, and whether the card is held off until Still steps away. */
let offered: GroundPart | null = null
let offerHeld = false

function maybeDrop(at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean) {
  // a side room's pack always pays out: the last kill drops if nothing else did
  const owed = (pack.side && pack.members.length === 0 && !pack.dropped) || wasElite
  if (!owed && Math.random() > LOOT.dropChance) return
  const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
  const def = wasElite ? rollPart(kind, taken, LOOT.eliteOdds) : fillEmpty(taken) ?? rollPart(kind, taken)
  if (!def) return
  pack.dropped = true
  loot.drop(def, at, still.pos)
  sfx.drop(def.tier, panOf(at))
}

/**
 * Still starts incomplete. While a slot is empty, most drops are a plain part for
 * one of the empty slots, so the first level is spent putting yourself together.
 */
const FILL_EMPTY_CHANCE = 0.6
function fillEmpty(taken: readonly AbilityDef[]): AbilityDef | null {
  const empty = hud.slots.filter((s) => !s.def).map((s) => s.slot)
  if (empty.length === 0 || Math.random() > FILL_EMPTY_CHANCE) return null
  const ids = new Set(taken.map((p) => p.id))
  const options = PARTS.filter((p) => p.tier === 'white' && empty.includes(p.slot) && !ids.has(p.id))
  return options[Math.floor(Math.random() * options.length)] ?? null
}

// --- shrines: one bargain each ---

const SHRINE_RADIUS = 1.7
const SHRINE_TEXT = {
  rest: { title: 'Shrine of Rest', line: 'strain \u22126. Something nearby will hear it.', action: 'rest' },
  plenty: { title: 'Shrine of Plenty', line: 'a good part, for 4 strain.', action: 'take the bargain' },
}
let atShrine: Shrine | null = null

function updateShrinePrompt() {
  let near: Shrine | null = null
  if (run.phase === 'crawl' && level && !offered) {
    near = level.shrines.find((sh) => !sh.used && Math.hypot(sh.x - still.pos.x, sh.z - still.pos.z) < SHRINE_RADIUS) ?? null
  }
  if (near !== atShrine) {
    atShrine = near
    hud.prompt(near ? SHRINE_TEXT[near.kind] : null)
  }
}

hud.onPrompt(() => {
  const sh = atShrine
  if (!sh || sh.used || run.phase !== 'crawl') return
  sh.used = true
  sh.rune.opacity = 0.12
  atShrine = null
  hud.prompt(null)
  const at = new THREE.Vector3(sh.x, 0, sh.z)
  combat.burst(at, sh.kind === 'rest' ? 0x8fd0ff : 0xc7b8ff)
  sfx.shrine()
  if (sh.kind === 'rest') {
    run.strain = Math.max(0, run.strain - 6)
    overlay.banner('rested \u00b7 strain \u22126')
    combat.wakeNearest(at)
  } else {
    const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
    const def = rollPart('chaser', taken, LOOT.eliteOdds)
    if (def) {
      loot.drop(def, at, still.pos)
      sfx.drop(def.tier, 0)
    }
    run.strain = Math.min(STRAIN_MAX, run.strain + 4)
    overlay.banner('bargained \u00b7 strain +4')
    // a bargain can cost everything
    if (run.strain >= STRAIN_MAX) beginStopping()
  }
})

// --- elite names, D2-style, floating over the leader ---

const eliteLabels = document.createElement('div')
eliteLabels.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3'
hudRoot.appendChild(eliteLabels)
const labelTmp = new THREE.Vector3()

function drawEliteLabels() {
  const html: string[] = []
  for (const p of combat.packs) {
    const el = p.elite
    if (!el || el.leader.dead || run.phase !== 'crawl') continue
    if (p.state === 'asleep' && el.leader.pos.distanceTo(still.pos) > 14) continue
    labelTmp.set(el.leader.pos.x, 2.3 * el.leader.size, el.leader.pos.z).project(world.camera)
    if (Math.abs(labelTmp.x) > 1 || Math.abs(labelTmp.y) > 1) continue
    const x = (labelTmp.x * 0.5 + 0.5) * window.innerWidth
    const y = (-labelTmp.y * 0.5 + 0.5) * window.innerHeight
    html.push(`<div class="elite" style="left:${x}px;top:${y}px"><b>${el.name}</b><span>${ELITE_LINE[el.mod]}</span></div>`)
  }
  eliteLabels.innerHTML = html.join('')
}

/** It went quiet: half of what's missing comes back, and a little strain lets go. */
function quiet() {
  run.fought = false
  run.quietT = 0
  const before = combat.hp
  combat.hp += (100 - combat.hp) / 2
  const eased = run.strain > 0
  run.strain = Math.max(0, run.strain - QUIET_STRAIN)
  hud.healing()
  sfx.cleared()
  if (combat.hp > before + 0.5 || eased) overlay.banner(eased ? `quiet \u00b7 strain \u2212${QUIET_STRAIN}` : 'quiet')
}

function updateOffer() {
  const open = run.phase === 'crawl'
  const under = open ? loot.under(still.pos) : null
  // after a take, the old part lands at your feet: don't offer it back until you step off
  if (!under) offerHeld = false
  const next = under && !offerHeld ? under : null
  if (next !== offered) {
    offered = next
    hud.offer(next?.def ?? null)
  }
}

hud.onTake(() => {
  if (offered) takePart(offered)
})

hud.onCompare(() => {
  const g = offered
  if (!g || !canPause()) return
  const current = hud.loadout.find((p) => p.slot === g.def.slot) ?? null
  openPause()
  pause.compare(current, g.def, () => {
    resume()
    takePart(g)
  }, resume)
})

function takePart(g: GroundPart) {
  const old = hud.equip(g.def)
  loot.remove(g)
  // an empty slot filled: nothing falls out
  if (old) loot.drop(old, still.pos)
  still.setEquipped(g.def.slot, true)
  offered = null
  offerHeld = true
  hud.offer(null)
  sfx.take()
  rig.punch(0.03)
  still.group.scale.setScalar(1.12)
  navigator.vibrate?.(18)
}

// --- pause: the world stops, cooldowns included; the music keeps going, quieter ---

let paused = false
/** Game time in ms. Cooldowns run on this, so pausing can't be used to wait them out. */
let clock = 0

function canPause() {
  return !paused && run.phase === 'crawl'
}

function openPause() {
  paused = true
  hud.enabled = false
  stopAllWindups()
  sfx.pauseDuck(true)
}

function resume() {
  pause.hide()
  paused = false
  hud.enabled = true
  sfx.pauseDuck(false)
}

hud.onPause(() => {
  if (!canPause()) return
  openPause()
  pause.loadout(hud.slots, resume)
})

// the screen going off mid-fight shouldn't cost you the fight
document.addEventListener('visibilitychange', () => {
  if (document.hidden && canPause()) {
    openPause()
    pause.loadout(hud.slots, resume)
  }
})

/** Build a level and put Still at its entrance. HP is whole again; strain carries. */
function enterLevel(depth: number) {
  level?.dispose()
  loot.clear()
  combat.reset()
  level = generateLevel(depth)
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  for (const p of level.packs) combat.addPack(p.members, p.room.kind === 'side', p.elite)
  combat.breakables = level.breakables
  run.fought = false
  run.quietT = 0
  still.pos.copy(level.entrance)
  prev.copy(still.pos)
  run.depth = depth
  overlay.banner(`Depth ${depth}`)
}

function startRun() {
  still.reassemble()
  Object.assign(run, { phase: 'crawl', strain: 0, t: 0, swapped: false })
  loot.clear()
  // Still begins with one random plain part; the rest he finds
  const start = STARTING[Math.floor(Math.random() * STARTING.length)]!
  hud.resetLoadout([start])
  for (const slot of SLOT_NAMES) still.setEquipped(slot, slot === start.slot)
  enterLevel(1)
  rig.reset()
  world.gradePass.uniforms.uSaturation!.value = grade.saturation
  hud.enabled = true
  overlay.hide()
  sfx.restore()
}

function descend() {
  run.phase = 'descending'
  run.t = 0
  run.swapped = false
  hud.enabled = false
  updateOffer()
  updateShrinePrompt()
  stopAllWindups()
}

function end(kind: EndingKind) {
  run.phase = 'over'
  overlay.show(kind, run.depth, startRun)
  // the silence after the ending is held a moment, then the bell comes back under the words
  sfx.restore(3)
}

function stopAllWindups() {
  for (const stop of windups.values()) stop()
  windups.clear()
}

function breakApart() {
  run.phase = 'broken'
  updateOffer()
  updateShrinePrompt()
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
  updateOffer()
  updateShrinePrompt()
  run.t = 0
  hud.enabled = false
  stopAllWindups()
  sfx.windDown(STOP_SECONDS)
}

hud.onFire((def, pushed) => {
  if (run.phase !== 'crawl') return
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
  // no freeze on a dash: a pause right before the move is what made it look like a teleport
  if (def.shape !== 'dash') hitstop = Math.max(hitstop, pushed ? 0.06 : 0.035)
  rig.punch(pushed ? 0.06 : 0.02)
}

let accumulator = 0
let last = performance.now() / 1000

const prev = new THREE.Vector3()
const camTarget = new THREE.Vector3()
const camOffset = world.camera.position.clone()
const graceLean = new THREE.Vector3()
const tmpLean = new THREE.Vector3()

function simulate(realDt: number) {
  prev.copy(still.pos)

  if (run.phase === 'over') return

  if (run.phase === 'descending') {
    run.t += realDt
    if (!run.swapped && run.t >= DESCEND_OUT) {
      run.swapped = true
      enterLevel(run.depth + 1)
    }
    const out = Math.min(1, run.t / DESCEND_OUT)
    const back = run.swapped ? Math.min(1, (run.t - DESCEND_OUT) / DESCEND_IN) : 0
    fade.style.opacity = String(run.swapped ? 1 - back : out)
    if (run.swapped && back >= 1) {
      run.phase = 'crawl'
      hud.enabled = true
    }
    return
  }

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

  combat.terrain.pushOut(still.pos, BODY_RADIUS)

  const target = combat.nearestTarget(still.pos, 9.5)
  still.aim = target ? Math.atan2(target.x - still.pos.x, target.z - still.pos.z) : null

  combat.update(dt, still.pos)
  loot.update(dt)
  updateOffer()
  updateShrinePrompt()
  const scrap = loot.collectScrap(still.pos)
  if (scrap > 0) {
    combat.hp = Math.min(100, combat.hp + scrap * LOOT.scrapHeal)
    hud.healing()
    sfx.repair()
  }
  hud.integrity = combat.hp / 100
  hud.strain = run.strain

  if (combat.hp <= 0 && run.phase !== 'stopping') {
    breakApart()
    return
  }

  if (combat.awake.length > 0) {
    run.fought = true
    run.quietT = 0
  } else if (run.fought && run.phase === 'crawl') {
    run.quietT += dt
    if (run.quietT >= QUIET_SECONDS) quiet()
  }

  // the exit is always open, even with something on your heels
  if (run.phase === 'crawl' && level && Math.hypot(still.pos.x - level.exit.x, still.pos.z - level.exit.z) < EXIT_RADIUS) {
    descend()
    return
  }

  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
}

function frame(nowMs: number) {
  const now = nowMs / 1000
  const elapsed = Math.min(MAX_FRAME, now - last)
  last = now

  if (paused) {
    // frozen: render only
  } else if (hitstop > 0) {
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

  // Grace's light drifts a little toward the exit: the light you carry points the way
  if (level && run.phase === 'crawl') {
    const ex = level.exit.x - x
    const ez = level.exit.z - z
    const d = Math.hypot(ex, ez)
    const k = Math.min(1, d / 6) * GRACE_LEAN
    graceLean.lerp(tmpLean.set(d > 0.01 ? (ex / d) * k : 0, 0, d > 0.01 ? (ez / d) * k : 0), Math.min(1, elapsed * 2))
  }
  world.graceLight.position.set(x + graceLean.x, GRACE_Y, z + graceLean.z)
  level?.update(now)

  shake = Math.max(0, shake - elapsed * 3.2)
  camTarget.set(x, 0, z)
  const awake = combat.awake
  const fighting = run.phase === 'crawl' && awake.length > 0
  rig.update(elapsed, camTarget, awake.map((e) => e.pos), !fighting)
  world.camera.position.copy(camTarget).add(camOffset)
  if (shake > 0) {
    const k = shake * shake * 0.9
    world.camera.position.x += (Math.random() - 0.5) * k
    world.camera.position.z += (Math.random() - 0.5) * k
    world.camera.position.y += (Math.random() - 0.5) * k
  }
  world.camera.lookAt(camTarget)

  updateMusic({
    fighting,
    calm: !fighting,
    strain: run.strain / 20,
  })
  if (!paused) clock += elapsed * 1000
  drawEliteLabels()
  hud.update(clock)
  world.render()
  requestAnimationFrame(frame)
}

void loadKit().then(() => {
  startRun()
  requestAnimationFrame(frame)
})
