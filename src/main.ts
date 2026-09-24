import './style.css'
import * as THREE from 'three'
import { createWorld, grade } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel } from './grade'
import { Combat, ELITE_LINE, type Archetype, type CastResult, type EliteMod, type Pack } from './combat'
import { STARTING, PARTS, READY, byId, type AbilityDef, type AbilityShape, type BeatKey } from './abilities'
import { SLOT_NAMES, type SlotName } from './still'
import type { Enemy } from './enemy'
import type { Assembler } from './boss'
import { RANGED } from './ranged'
import * as sfx from './audio'
import { createCameraRig } from './camera'
import { updateMusic } from './music'
import { updateAmbience } from './ambience'
import { Loot, LOOT, dropChance, rollPart, type GroundPart } from './loot'
import { createPauseScreen } from './pause'
import { createOverlay, type EndingKind } from './ending'
import { loadKit } from './kit'
import { generateLevel, makeTerrain, key, type Box, type Breakable, type Circle, type Level, type Shrine } from './dungeon'
import type { Terrain } from './terrain'
import { Vfx, syncTells, COLD, COLD_DEEP, EMBER } from './vfx'
import { PartFx } from './partfx'
import type { PartEvent } from './parts'

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
const vfx = new Vfx(world.scene)
/** Dev only: every onPart event, for headless checks to read back. */
const partLog: PartEvent[] = []

/** Effect helpers: a point at a height, and the colours things break into. */
const at3 = (p: { x: number; z: number }, y: number) => new THREE.Vector3(p.x, y, p.z)
const RUST = new THREE.Color(0x5b3b35)
const STEEL = new THREE.Color(0x7a8592)
const STONE = new THREE.Color(0x5a5550)
const WOOD = new THREE.Color(0x6b4a30)

const still = new Still()
world.scene.add(still.group)
const partFx = new PartFx(world.scene, vfx, () => still.pos)

sfx.unlockAudio()

// the deployed build caches itself for offline play (the dev server doesn't)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
}

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
/** Hits landed during the cast being resolved: Piston sounds different when it connects. */
let castHits = 0

/** How high each hop arcs. Flat is a dash, an arc is a hop: height is how you tell them apart. */
const HOP_H: Partial<Record<BeatKey, number>> = { skitter: 0.35, spring: 0.9 }

const combat = new Combat(world.scene, OPEN, {
  onHit: (at) => {
    castHits++
    sfx.hit(panOf(at))
    // cold sparks off the metal, thrown away from Still
    const away = new THREE.Vector3(at.x - still.pos.x, 0, at.z - still.pos.z)
    vfx.sparks(at3(at, 1.0), COLD, 8, 6.5, away, 0.9)
    vfx.flash(at3(at, 1.0), COLD_DEEP, 0.35)
    hitstop = Math.max(hitstop, 0.045)
    shake = Math.max(shake, 0.1)
  },
  onPlayerHurt: () => {
    sfx.hurt()
    vfx.sparks(at3(still.pos, 1.2), EMBER, 12, 5)
    vfx.flash(at3(still.pos, 1.2), EMBER, 0.6)
    hitstop = Math.max(hitstop, 0.09)
    shake = Math.max(shake, 0.5)
    rig.punch(-0.03)
    navigator.vibrate?.(30)
  },
  onKill: (at, kind, pack, wasElite, summoned) => {
    run.killed = true
    if (kind === 'boss') {
      bossDown(at)
      return
    }
    sfx.kill(panOf(at))
    // it comes apart: chunks of its own metal, a burst of embers, a puff of grit
    vfx.chunks(at3(at, 0.8), 12, kind === 'ranged' ? STEEL : RUST, 5.5, 0.18)
    vfx.sparks(at3(at, 0.9), EMBER, 16, 6)
    vfx.flash(at3(at, 0.9), EMBER, 0.9)
    vfx.dust(at, 8, 0.8)
    maybeDrop(at, kind, pack, wasElite, summoned)
    hitstop = Math.max(hitstop, 0.08)
    shake = Math.max(shake, 0.28)
    rig.punch(0.035)
  },
  onPart: (ev) => {
    if (import.meta.env.DEV) {
      partLog.push(ev)
      if (partLog.length > 500) partLog.shift()
    }
    partFx.event(ev)
    if (ev.kind === 'move') {
      moveFx(ev.move.path[ev.move.path.length - 1] ?? still.pos, ev.beat)
      still.startMove({
        ...ev.move,
        hopH: ev.move.kind === 'hop' ? HOP_H[ev.beat] ?? 0.35 : 0,
        // the charge is the loudest movement in the pool; the step is deliberately modest
        ghostEvery: ev.beat === 'overrun-charge' ? 0.02 : ev.beat === 'overrun-step' ? 0.07 : undefined,
      })
    }
    if (ev.kind === 'land') {
      // the lob comes down: a small nova where it lands
      vfx.flash(at3(ev.at, 0.4), COLD_DEEP, 1.2)
      vfx.dust(ev.at, 10, 1.2)
      vfx.sparks(at3(ev.at, 0.3), COLD, 16, 6)
      sfx.lobLand(panOf(ev.at))
      shake = Math.max(shake, 0.14)
    }
  },
  onShot: () => {
    sfx.shot(0)
    still.attack({ beat: 'shot', pushed: false })
    vfx.flash(still.lensPoint(new THREE.Vector3()), COLD_DEEP, 0.25)
  },
  onSmash: (b) => {
    level?.smash(b)
    const at = new THREE.Vector3(b.x, 0, b.z)
    combat.burst(at, 0xb89a7a)
    sfx.smash(panOf(at))
    vfx.chunks(at3(at, 0.5), 14, WOOD, 4.5, 0.16)
    vfx.dust(at, 10, 0.7, new THREE.Color(0x6a5a48))
    shake = Math.max(shake, 0.12)
    const roll = Math.random()
    if (roll < LOOT.crateParts) {
      const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
      const def = fillEmpty(taken) ?? rollPart('chaser', taken, 'crate')
      if (def) {
        loot.drop(def, at, still.pos)
        sfx.drop(def.tier, panOf(at))
      }
    } else if (roll < LOOT.crateParts + LOOT.crateScrap) {
      loot.dropScrap(at)
    }
  },
  onVolley: (at) => {
    sfx.fire(panOf(at))
    const muzzle = at3(at, 2.2)
    vfx.flash(muzzle, EMBER, 1.1)
    vfx.sparks(muzzle, EMBER, 14, 7)
    vfx.smokePuff(muzzle, 3)
  },
  onWake: (at) => {
    vfx.embers(at3(at, 0.8), 14, 1.2)
    sfx.alert(panOf(at))
    rig.punch(-0.02)
  },
  onWindup: (e, ms) => {
    // once Still is stopping, the world is slowing with him; a real-time tell would lie
    if (run.phase !== 'crawl') return
    if (e.kind === 'boss') {
      // aimed moves whistle and click like the sentinel; heavy ones rise like the hulk
      const b = e as Assembler
      const aimed = b.move === 'barrage' || b.move === 'charge'
      windups.set(e, aimed ? sfx.aim(ms, 0.55, panOf(e.pos)) : sfx.windup(ms, panOf(e.pos)))
      return
    }
    const stop = e.kind === 'ranged' ? sfx.aim(ms, RANGED.lockAt, panOf(e.pos)) : sfx.windup(ms, panOf(e.pos))
    windups.set(e, stop)
  },
  onStrike: (e) => {
    windups.delete(e)
    if (e.kind === 'ranged') sfx.fire(panOf(e.pos))
    else sfx.strike(panOf(e.pos))
    strikeFx(e)
  },
  onShotBlocked: (at) => {
    sfx.blocked(panOf(at))
    vfx.sparks(at3(at, 1.1), STONE.clone().lerp(new THREE.Color(1, 0.9, 0.7), 0.5), 6, 4)
  },
  onGone: (e) => {
    windups.get(e)?.()
    windups.delete(e)
  },
})

/** Off the mark: what a move throws up as it leaves. Read before Still starts moving. */
function moveFx(to: THREE.Vector3, beat: BeatKey) {
  switch (beat) {
    case 'overrun-step':
      vfx.dust(still.pos, 4, 0.5, undefined, 3)
      break
    case 'overrun-charge':
      // the wake: a cold strip behind him the width of what he runs over
      partFx.beam(still.pos, to, 1.4, 0.3)
      vfx.dust(still.pos, 12, 0.8, undefined, 5)
      vfx.sparks(at3(still.pos, 0.4), COLD, 10, 5)
      shake = Math.max(shake, 0.24)
      rig.punch(0.04)
      break
    case 'skitter':
      vfx.dust(still.pos, 6, 0.3, undefined, 2.5)
      shake = Math.max(shake, 0.06)
      break
    case 'spring':
      vfx.dust(still.pos, 8, 0.4, undefined, 3)
      shake = Math.max(shake, 0.08)
      break
    default:
      // grit, cold sparks, and the body carried to where the part put him
      vfx.dust(still.pos, 10, 0.6, undefined, 4)
      vfx.sparks(at3(still.pos, 0.4), COLD, 8, 4)
      shake = Math.max(shake, 0.18)
      rig.punch(0.03)
  }
}

/** Touchdown: a hop lands light, a vault lands heavy with its stick lock. */
still.onLand = (m) => {
  if (m.kind !== 'hop') return
  if (m.vault) {
    vfx.dust(still.pos, 12, 0.8, undefined, 4)
    combat.ring(still.pos, 0.3, 1.0, 0.3, 0x8fa3b8)
    shake = Math.max(shake, 0.16)
    rig.punch(-0.02)
  } else {
    vfx.dust(still.pos, 8, 0.5, undefined, 3)
  }
  sfx.landing(m.vault)
}

/** What each enemy's strike throws up: grit and dust for slams, a muzzle flash for shots. */
function strikeFx(e: Enemy) {
  if (e.kind === 'chaser') {
    // both fists into the floor
    vfx.dust(e.pos, 16 * e.size, 2.2 * e.size, undefined, 5)
    vfx.chunks(at3(e.pos, 0.3), 6, STONE, 4, 0.12)
    vfx.flash(at3(e.pos, 0.3), EMBER, 0.8 * e.size)
    vfx.sparks(at3(e.pos, 0.4), EMBER, 10, 5)
  } else if (e.kind === 'ranged') {
    const dir = new THREE.Vector3(still.pos.x - e.pos.x, 0, still.pos.z - e.pos.z).normalize()
    const muzzle = at3(e.pos, 1.45).addScaledVector(dir, 0.95)
    vfx.flash(muzzle, EMBER, 0.7)
    vfx.sparks(muzzle, EMBER, 9, 7, dir, 0.4)
    vfx.smokePuff(muzzle, 2)
  } else {
    const b = e as Assembler
    if (b.move === 'sweep') {
      vfx.dust(b.pos, 22, 4.5, undefined, 6)
      vfx.sparks(at3(b.pos, 0.8), EMBER, 18, 8)
    } else if (b.move === 'wave' || b.move === 'magnet') {
      vfx.dust(b.pos, 30, 3.5, undefined, 7)
      vfx.chunks(at3(b.pos, 0.3), 14, STONE, 6, 0.18)
      vfx.flash(at3(b.pos, 0.5), EMBER, 2.2)
    }
  }
}

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

const run = { phase: 'crawl' as Phase, depth: 1, strain: 0, t: 0, swapped: false, fought: false, quietT: 0, killed: false }

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

function maybeDrop(at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean) {
  // a side room's pack always pays out (the last kill drops if nothing else did), elites always do
  if (Math.random() >= dropChance(pack, wasElite, summoned)) return
  const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
  const def = wasElite ? rollPart(kind, taken, 'elite') : fillEmpty(taken) ?? rollPart(kind, taken, 'kill')
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
  const options = PARTS.filter((p) => p.tier === 'white' && READY.has(p.id) && empty.includes(p.slot) && !ids.has(p.id))
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
  vfx.embers(at3(at, 0.5), 30, 1.2, sh.kind === 'rest' ? COLD : new THREE.Color(0xc7b8ff))
  if (sh.kind === 'rest') {
    run.strain = Math.max(0, run.strain - 6)
    overlay.banner('rested \u00b7 strain \u22126')
    combat.wakeNearest(at)
  } else {
    const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
    const def = rollPart('chaser', taken, 'plenty')
    if (def) {
      loot.drop(def, at, still.pos)
      sfx.drop(def.tier, 0)
    }
    overlay.banner('bargained \u00b7 strain +4')
    // a bargain can cost everything
    addStrain(4)
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
  vfx.embers(at3(still.pos, 0.4), 18, 0.9, COLD)
  run.fought = false
  run.quietT = 0
  run.killed = false
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
  combat.clearSlot(g.def.slot)
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

let bossWasStunned = false
const BOSS_HP = 900

/** The Assembler falls: the exit opens, and it leaves the best of what it was made from. */
function bossDown(at: THREE.Vector3) {
  combat.boss = null
  hud.bossBar(null)
  level?.openExit()
  sfx.bossDown()
  shake = 1.2
  hitstop = 0.25
  rig.punch(0.12)
  navigator.vibrate?.([60, 40, 120])
  // one blue and one gold, never for the same slot
  const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
  const blue = rollPart('boss', taken, 'boss-blue')
  const gold = rollPart('boss', blue ? [...taken, blue] : taken, 'boss-gold', blue?.slot)
  for (const def of [blue, gold]) if (def) loot.drop(def, at, still.pos)
  loot.dropScrap(new THREE.Vector3(at.x + 1.2, 0, at.z))
  loot.dropScrap(new THREE.Vector3(at.x - 1.2, 0, at.z))
  overlay.banner(`area ${run.depth / BOSS_EVERY} cleared`)
}

/** Every third depth closes an area with the Assembler. */
const BOSS_EVERY = 3

/** Build a level and put Still at its entrance. HP is whole again; strain carries. */
function enterLevel(depth: number) {
  level?.dispose()
  loot.clear()
  combat.reset()
  partFx.clear()
  level = generateLevel(depth, undefined, { boss: depth % BOSS_EVERY === 0 })
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  for (const p of level.packs) combat.addPack(p.members, p.room.kind === 'side', p.elite)
  combat.breakables = level.breakables
  if (level.boss) combat.addBoss(level.boss.x, level.boss.z, level.boss.face)
  run.fought = false
  run.quietT = 0
  run.killed = false
  lastStep.clear()
  still.pos.copy(level.entrance)
  prev.copy(still.pos)
  run.depth = depth
  overlay.banner(level.boss ? `Depth ${depth} \u00b7 something is waiting` : `Depth ${depth}`)
}

/** `?depth=3` starts a run there: the fastest way to the boss while tuning it. */
const START_DEPTH = Math.max(1, Number(new URLSearchParams(location.search).get('depth')) || 1)

function startRun() {
  still.reassemble()
  Object.assign(run, { phase: 'crawl', strain: 0, t: 0, swapped: false })
  loot.clear()
  // Still begins with one random plain part; the rest he finds. Starting deeper
  // (?depth=) skips the levels where he'd have found them, so he gets all four.
  const start = START_DEPTH > 1 ? STARTING : [STARTING[Math.floor(Math.random() * STARTING.length)]!]
  hud.resetLoadout(start)
  for (const slot of SLOT_NAMES) still.setEquipped(slot, start.some((p) => p.slot === slot))
  enterLevel(START_DEPTH)
  hud.bossBar(null)
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
  if (run.phase !== 'crawl') return { cooldown: 'refused' }
  const r = cast(def, pushed)
  if (r.cooldown === 'refused') return r
  // the part has already landed; now it's paid for. The push that crosses the line
  // still lands at full power, then he stops.
  const cost = r.strain + (pushed ? STRAIN_PER_PUSH : 0)
  if (cost > 0) addStrain(cost)
  return r
})

/**
 * The only way strain goes up: pushes, parts that cost strain, bargains. It clamps
 * at the max and starts the stop the moment strain reaches it, so every path can end the run.
 */
function addStrain(n: number) {
  if (run.phase !== 'crawl' && run.phase !== 'stopping') return
  run.strain = Math.min(STRAIN_MAX, run.strain + n)
  if (run.strain >= STRAIN_MAX && run.phase === 'crawl') beginStopping()
}

/** Parts that move Still. No freeze before them: a pause right before the move is what made the dash look like a teleport. */
const MOVES = new Set<AbilityShape>(['dash', 'hop', 'anchor', 'rewind'])

function cast(def: AbilityDef, pushed: boolean): CastResult {
  castHits = 0
  const r = combat.useAbility(def, {
    origin: still.pos, facing: still.facing, moveX: hud.moveX, moveZ: hud.moveZ, pushed, strain: run.strain,
  })
  if (r.cooldown === 'refused') return r
  // Snap the body to the target, or the swing plays sideways out of his shoulder.
  if (r.aim !== null) still.facing = r.aim
  sfx.ability(r.beat, pushed, r.power)
  still.attack({ beat: r.beat, pushed, holdS: r.holdS, power: r.power, lean: r.lean })
  castFx(def, r, pushed)
  still.group.scale.setScalar(pushed ? 1.16 : 1.08)
  shake = Math.max(shake, pushed ? 0.34 : 0.16)
  if (!MOVES.has(def.shape)) hitstop = Math.max(hitstop, pushed ? 0.06 : 0.035)
  rig.punch(pushed ? 0.06 : 0.02)
  return r
}

/**
 * Still's attacks are cold light, one recipe per beat. A pushed one also throws
 * embers off his own joints: it costs him.
 */
function castFx(def: AbilityDef, r: CastResult, pushed: boolean) {
  const lens = still.lensPoint(new THREE.Vector3())
  const fwd = new THREE.Vector3(Math.sin(still.facing), 0, Math.cos(still.facing))
  const ahead = (d: number, y = 1.0) => at3(still.pos, y).addScaledVector(fwd, d)
  switch (r.beat) {
    case 'lens':
    case 'cracked':
      vfx.flash(lens, COLD, 0.8)
      vfx.sparks(lens, COLD, 10, 7, fwd, 0.5)
      break
    case 'patient':
      // a weak shot is a twitch, a full one looks like a Focusing Lens
      vfx.flash(lens, COLD, 0.4 + 0.8 * r.power)
      vfx.sparks(lens, COLD, Math.round(4 + 12 * r.power), 7, fwd, 0.5)
      break
    case 'coil':
      // three small flashes fanned at the lens, and a few embers off the stalk: it runs on strain
      for (const off of [-0.26, 0, 0.26]) {
        const dir = new THREE.Vector3(Math.sin(still.facing + off), 0, Math.cos(still.facing + off))
        vfx.flash(lens.clone().addScaledVector(dir, 0.25), COLD, 0.35)
      }
      vfx.embers(at3(still.pos, 1.6), 4, 0.15)
      break
    case 'flare':
      vfx.flash(lens, COLD, 0.6)
      vfx.sparks(lens, COLD, 6, 4, new THREE.Vector3(fwd.x, 0, fwd.z), 0.6)
      break
    case 'piston':
      // a long thin strike inside the narrow sweep: never mistaken for the Cleaver's fan
      partFx.beam(still.pos, ahead(def.range, 0), 0.5, 0.15)
      if (castHits > 0) {
        vfx.sparks(ahead(def.range * 0.8), COLD, 12, 7, fwd, 0.3)
        vfx.flash(ahead(def.range * 0.8), COLD, 0.6)
        sfx.pistonHit()
      } else {
        sfx.pistonMiss()
      }
      break
    case 'hook':
      // a chain to everything caught, while it's hauled in
      for (const e of combat.enemies) {
        const tx = still.pos.x - e.pos.x
        const tz = still.pos.z - e.pos.z
        if (e.knock.lengthSq() > 4 && e.knock.x * tx + e.knock.z * tz > 0 && Math.hypot(tx, tz) <= def.range + 1.5) {
          partFx.yank(e)
          vfx.sparks(at3(e.pos, 1.0), COLD, 6, 5)
          vfx.dust(e.pos, 6, 0.4)
        }
      }
      break
    case 'fray-90':
    case 'fray-180':
    case 'fray-360': {
      // the swing at its width, ragged at both ends; at 12+ the fray turns ember, the heat that feeds it
      const wide = r.beat === 'fray-360' ? 2 : r.beat === 'fray-180' ? 1 : 0
      const spread = [Math.PI / 2, Math.PI, Math.PI * 2][wide]!
      const points = [7, 12, 20][wide]!
      for (let i = 0; i < points; i++) {
        const a = still.facing + (i / (points - 1) - 0.5) * spread
        const p = at3(still.pos, 1.0).add(new THREE.Vector3(Math.sin(a) * def.range * 0.8, 0, Math.cos(a) * def.range * 0.8))
        vfx.sparks(p, COLD, 2, 3, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.3)
      }
      if (wide < 2) {
        for (const side of [-1, 1]) {
          const a = still.facing + side * spread / 2
          const p = at3(still.pos, 1.0).add(new THREE.Vector3(Math.sin(a) * def.range, 0, Math.cos(a) * def.range))
          vfx.sparks(p, COLD, 3, 3)
        }
      } else {
        vfx.sparks(at3(still.pos, 1.0), EMBER, 8, 5)
      }
      break
    }
    case 'vent':
    case 'backdraft':
      vfx.flash(at3(still.pos, 1.2), COLD_DEEP, 0.9)
      vfx.sparks(at3(still.pos, 1.0), COLD, 26, 9)
      vfx.dust(still.pos, 14, def.radius * 0.6, new THREE.Color(0x55606c), 7)
      break
    case 'cleaver': {
      // sparks along the swing's arc
      for (let i = 0; i < 7; i++) {
        const a = still.facing + (i / 6 - 0.5) * 2
        const p = at3(still.pos, 1.0).add(new THREE.Vector3(Math.sin(a) * def.range * 0.8, 0, Math.cos(a) * def.range * 0.8))
        vfx.sparks(p, COLD, 2, 3, new THREE.Vector3(Math.sin(a), 0, Math.cos(a)), 0.3)
      }
      break
    }
    // movement fx ride on the move event
    default:
      break
  }
  if (pushed) vfx.sparks(at3(still.pos, 1.2), EMBER, 14, 4)
}

/** Patient Lens has banked a full shot, and the button has said so once. */
let patientFull = false
let patientMotes = 0
/** Frayed Cleaver's width tier last frame; null while it isn't on a button. */
let frayTier: number | null = null

/**
 * What the buttons show about the parts on them, every frame: how much Patient
 * Lens has banked, how wide Frayed Cleaver will swing.
 */
function partFaces(dt: number) {
  const [head, , arms] = hud.slots.map((s) => s.def)
  if (head?.mod?.kind === 'charge') {
    const m = head.mod
    const c = Math.min(1, Math.max(0, (combat.parts.patientSince - m.minS) / (m.fullS - m.minS)))
    hud.charge('head', c)
    if (c >= 1 && !patientFull) {
      // full: one glassy tick and a small ring of cold round the lens
      sfx.patientFull()
      vfx.gather(still.lensPoint(new THREE.Vector3()), 12, 0.6, COLD, 4)
    }
    patientFull = c >= 1
    if (patientFull && run.phase === 'crawl' && (patientMotes -= dt) <= 0) {
      patientMotes = 0.2
      vfx.gather(still.lensPoint(new THREE.Vector3()), 2, 0.5, COLD, 2.5)
    }
  } else {
    patientFull = false
  }

  if (arms?.mod?.kind === 'fray') {
    const at = arms.mod.at
    const tier = run.strain < at[0] ? 0 : run.strain < at[1] ? 1 : 2
    hud.iconState('arms', tier === 0 ? null : tier === 1 ? 'fray-180' : 'fray-360')
    if (frayTier !== null && tier !== frayTier) {
      // the meter, the button and the body change together, so the link teaches itself
      const up = tier > frayTier
      sfx.frayCross(up)
      hud.pulse('arms')
      if (up) vfx.embers(still.jawL.getWorldPosition(new THREE.Vector3()), 8, 0.1)
    }
    frayTier = tier
  } else {
    frayTier = null
  }
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

  // mid-vault he's over the wall, not in it
  if (!still.vaulting) combat.terrain.pushOut(still.pos, BODY_RADIUS)

  const target = combat.nearestTarget(still.pos, 9.5)
  still.aim = target ? Math.atan2(target.x - still.pos.x, target.z - still.pos.z) : null

  combat.update(dt, still.pos)
  partFx.update(dt)
  loot.update(dt)
  updateOffer()
  updateShrinePrompt()
  const scrap = loot.collectScrap(still.pos)
  if (scrap > 0) {
    vfx.embers(at3(still.pos, 0.5), 10, 0.5, new THREE.Color(0x9fd8c4))
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
    // a fight is cleared by clearing it: outrunning a pack until it walks home is not a quiet
    if (run.quietT >= QUIET_SECONDS) {
      if (run.killed) quiet()
      else run.fought = false
    }
  }

  // the boss: its bar, its overload, and the clang of a charge into a wall
  const boss = combat.boss
  if (boss && !boss.dead) {
    const awakeBoss = combat.awake.includes(boss)
    hud.bossBar(awakeBoss ? { name: 'The Assembler', frac: boss.hp / BOSS_HP, overloaded: boss.overloaded, stunned: boss.stunned } : null)
    if (boss.justOverloaded) {
      overlay.banner('the Assembler overloads')
      sfx.roar()
      shake = Math.max(shake, 0.8)
      rig.punch(-0.06)
    }
    if (boss.stunned && !bossWasStunned) {
      sfx.clang(panOf(boss.pos))
      shake = Math.max(shake, 0.6)
      hitstop = Math.max(hitstop, 0.12)
    }
    bossWasStunned = boss.stunned
  }

  // the exit is open once there's no boss standing, even with something on your heels
  if (run.phase === 'crawl' && level && level.exitOpen && Math.hypot(still.pos.x - level.exit.x, still.pos.z - level.exit.z) < EXIT_RADIUS) {
    descend()
    return
  }

  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
}

/** Footsteps: a step sounds each time a foot lands, quieter with distance. */
const lastStep = new Map<object, number>()
const STEP_HEAR = 16
function footsteps() {
  if (run.phase !== 'crawl') return
  const k = Math.floor(still.stride / Math.PI)
  if (still.walking && k !== lastStep.get(still)) sfx.step('still', 0)
  lastStep.set(still, k)
  for (const e of combat.awake) {
    const d = Math.hypot(e.pos.x - still.pos.x, e.pos.z - still.pos.z)
    if (d > STEP_HEAR) continue
    const ek = Math.floor(e.gait / Math.PI)
    if (e.walking && ek !== lastStep.get(e)) {
      const who = e.kind === 'chaser' ? 'hulk' : e.kind === 'ranged' ? 'tripod' : 'boss'
      sfx.step(who, panOf(e.pos), (1 - d / STEP_HEAR) * (e.kind === 'chaser' ? Math.min(1, e.size) : 1))
    }
    lastStep.set(e, ek)
  }
}

/** Continuous effects: the boss smoking and sparking, hulks glowing as they wind up. */
let ambientT = 0
const stackA = new THREE.Vector3()
const stackB = new THREE.Vector3()
function ambientFx(dt: number) {
  ambientT -= dt
  const tick = ambientT <= 0
  if (tick) ambientT = 0.09
  const b = combat.boss
  if (b && !b.dead && tick) {
    // the stacks smoke; overloaded, the core sheds embers; stunned, the open grill sparks
    b.group.localToWorld(stackA.set(-0.45, 3.8, -0.55))
    b.group.localToWorld(stackB.set(0.4, 3.5, -0.55))
    vfx.smokePuff(Math.random() < 0.5 ? stackA : stackB, 1, b.overloaded ? new THREE.Color(0x3a2a24) : undefined)
    if (b.overloaded) vfx.embers(at3(b.pos, 1.8), 2, 1.2)
    if (b.stunned) vfx.sparks(b.group.localToWorld(new THREE.Vector3(0, 1.75, 1.1)), EMBER, 3, 4)
    if (b.move === 'charge' && b.phase === 'strike') vfx.dust(b.pos, 3, 1.5, undefined, 2)
  }
  if (tick) {
    for (const e of combat.awake) {
      if (e.kind === 'chaser' && e.phase === 'windup') vfx.embers(at3(e.pos, 1.0 * e.size), 1, 0.3)
    }
  }
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

  updateAmbience(level?.boss ? 'boss' : 'crawl')
  const bossAwake = !!combat.boss && !combat.boss.dead && awake.includes(combat.boss)
  updateMusic({
    boss: bossAwake,
    overloaded: bossAwake && combat.boss!.overloaded,
    fighting,
    calm: !fighting,
    strain: run.strain / 20,
  })
  if (!paused) clock += elapsed * 1000
  drawEliteLabels()
  partFaces(elapsed)
  hud.update(clock)
  if (!paused) {
    vfx.update(elapsed, world.camera, world.renderer.domElement.height)
    ambientFx(elapsed)
    footsteps()
  }
  syncTells()
  world.render()
  requestAnimationFrame(frame)
}

/**
 * Dev only: lets a headless browser drive and read the fight without guessing
 * from pixels. Checks run synchronously inside one evaluate, so the frame loop
 * can't step the world between setup and assert.
 */
if (import.meta.env.DEV) {
  Object.assign(window, {
    __combat: combat, __still: still, __hud: hud, __loot: loot, __level: () => level, __world: world,
    __run: run, __parts: PARTS, __partLog: partLog,
    /** Advance exactly `s` seconds of game time, and the HUD clock (and the button faces) with it. No rAF, no hitstop. */
    __step: (s: number) => {
      for (let i = 0; i < Math.round(s * 60); i++) {
        simulate(STEP)
        clock += STEP * 1000
        partFaces(STEP)
        hud.update(clock)
      }
    },
    /** The same path a tap (false) or push (true) takes after the gesture: HUD cooldown, cast, strain. */
    __fire: (slot: SlotName, pushed = false) => hud.fireSlot(slot, pushed),
    /** Put a part on its button without the ground. */
    __equip: (id: string) => {
      const def = byId(id)
      combat.clearSlot(def.slot)
      hud.equip(def)
      still.setEquipped(def.slot, true)
    },
    __stick: (x: number, z: number) => hud.setStick(x, z),
    /** One enemy as its own pack of 1. awake = true wakes it at once. */
    __spawn: (kind: Archetype, x: number, z: number, awake = true, elite?: EliteMod): Enemy => {
      if (kind === 'boss') {
        const b = combat.addBoss(x, z, new THREE.Vector3(x, 0, z - 1))
        if (awake) combat.wake(combat.packs[combat.packs.length - 1]!)
        return b
      }
      const pack = combat.addPack([{ kind, x, z }], false, elite ? { mod: elite, name: 'Test' } : undefined)
      if (awake) combat.wake(pack)
      return pack.members[0]!
    },
    /**
     * A clean test floor: cells i, j in [-3, 3] (x, z in [-14, 14]) plus these solids.
     * Nothing else in the world; Still at (0, 0) facing +z, whole, unstrained, every button ready.
     */
    __arena: (o: { boxes?: Box[]; circles?: Circle[]; auto?: boolean } = {}) => {
      const floor = new Set<string>()
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) floor.add(key(i, j))
      const terrain = makeTerrain(floor, o.boxes ?? [], o.circles ?? [])
      combat.reset()
      loot.clear()
      partFx.clear()
      combat.terrain = terrain
      loot.terrain = terrain
      combat.breakables = []
      combat.autoAttack = o.auto ?? false
      // the real level stays loaded for its smash() and its look, but can't be walked out of
      if (level) {
        level.exitOpen = false
        level.group.visible = false
      }
      pause.hide()
      paused = false
      overlay.hide()
      still.reassemble()
      still.pos.set(0, 0, 0)
      still.facing = 0
      prev.copy(still.pos)
      combat.hp = 100
      Object.assign(run, { phase: 'crawl', strain: 0, fought: false, quietT: 0, killed: false })
      hud.resetLoadout(hud.loadout)
      hud.setStick(0, 0)
      hud.bossBar(null)
      hud.enabled = true
      hitstop = 0
      partLog.length = 0
    },
    /** A breakable with a stand-in mesh. It isn't solid: only hits find it. */
    __crate: (x: number, z: number): Breakable => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: WOOD }))
      mesh.position.set(x, 0.4, z)
      world.scene.add(mesh)
      const circle = { x, z, r: 0.45 }
      const b: Breakable = { mesh, x, z, r: 0.45, circle, broken: false }
      combat.breakables.push(b)
      return b
    },
    __enter: enterLevel,
    __lootRules: { rollPart, dropChance },
  })
}

void loadKit().then(() => {
  startRun()
  requestAnimationFrame(frame)
})
