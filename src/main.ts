import './style.css'
import * as THREE from 'three'
import { createWorld, grade } from './world'
import { Still } from './still'
import { createHud } from './hud'
import { createGradePanel, apply as applyGrade } from './grade'
import { Combat, eliteLine, type Archetype, type CastResult, type EliteMod, type Pack } from './combat'
import { STARTING, PARTS, byId, type AbilityDef, type AbilityShape, type BeatKey } from './abilities'
import { SLOT_NAMES, type SlotName } from './still'
import type { Enemy, EnemyEvent } from './enemy'
import type { Assembler } from './boss'
import { RANGED } from './ranged'
import { Charger, CHARGER } from './charger'
import { Mite, BROOD, type Brood } from './swarm'
import * as sfx from './audio'
import { createCameraRig } from './camera'
import { updateMusic } from './music'
import { updateAmbience } from './ambience'
import { Loot, LOOT, dropChance, rollPart, type GroundPart } from './loot'
import { createPauseScreen } from './pause'
import { createOverlay } from './ending'
import { loadKit, setSurfaces } from './kit'
import { generateLevel, generateWalkHome, makeTerrain, key, type Box, type Breakable, type Circle, type Level, type Shrine } from './dungeon'
import type { Terrain } from './terrain'
import { Vfx, syncTells, COLD, COLD_DEEP, EMBER } from './vfx'
import { PartFx } from './partfx'
import type { PartEvent } from './parts'
import {
  RUN_DEPTHS, BOSS_EVERY, LEAN_HOME, FIRST_RUN_IN_MAZE, DAY, DEPTH_DAY, exitsAfterBoss, hourAtEnd, bossFor, areaOf,
  applyDay, dayNow, currentSat, currentGrace, fogAt, dayAt, AREAS, WALK_AREA, type HomeHour,
} from './areas'
import { createWorkshop, MARKS_MAX, type ArrivalKind, type InteractId, type Workshop } from './workshop'
import { createDrawings, HANDS, CARD_ASPECT, type Moment } from './crayon'
import { composeCard } from './cards'
import { openSave, freshTally, localDate, drawerFor, trimCards, CARD_KEEP, CARD_LINES, LEADERS_MAX, type EndingKind, type RunTally, type SaveV1 } from './save'
import { poolView, markFound, hookCandidates, facingOutWhites, toggleTurn, hang, applyHookDefault, startPart, type PoolView } from './pool'
import type { DropSource } from './loot'

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

const params = new URLSearchParams(location.search)
/** `?depth=3` starts a run there: the fastest way to the boss while tuning it. Never past the last depth. */
const DEPTH_PARAM = params.get('depth')
const START_DEPTH = Math.min(RUN_DEPTHS, Math.max(1, Number(DEPTH_PARAM) || 1))

/**
 * The save. A dev run (?depth=) reads it and never writes, so tuning at the boss
 * can't find parts or leave cards; ?save=memory does the same without a dev run.
 */
const store = openSave({ memory: DEPTH_PARAM !== null || params.get('save') === 'memory' })
const save = store.data

const world = createWorld(canvas, { arena: false })
/** The kids' drawings: captured off the canvas at each ending, kept in IndexedDB. */
const drawings = createDrawings(world.renderer)
const hud = createHud(hudRoot, {
  hinted: (id) => save.hints.includes(id),
  markHinted: (id) => {
    if (save.hints.includes(id)) return
    save.hints.push(id)
    store.write()
  },
})
createGradePanel(hudRoot, world)
const overlay = createOverlay(hudRoot)
const rig = createCameraRig(world)
const loot = new Loot(world.scene)
loot.isFound = (id) => save.found.includes(id)
const pause = createPauseScreen(hudRoot)
const vfx = new Vfx(world.scene)
/** Dev only: every onPart event, for headless checks to read back. */
const partLog: PartEvent[] = []
/** Dev only: every enemy instant, stamped with Combat's game time. */
const enemyLog: { t: number; ev: EnemyEvent }[] = []

/** Effect helpers: a point at a height, and the colours things break into. */
const at3 = (p: { x: number; z: number }, y: number) => new THREE.Vector3(p.x, y, p.z)
const RUST = new THREE.Color(0x5b3b35)
const STEEL = new THREE.Color(0x7a8592)
const STONE = new THREE.Color(0x5a5550)
const WOOD = new THREE.Color(0x6b4a30)
const JOINT_C = new THREE.Color(0x2b2426)
const PLATE_C = new THREE.Color(0x6e5a50)
/** A sleeping ram's banked fire: a thin grey wisp, "asleep, not scrap". */
const BANKED = new THREE.Color(0x4a4744)
/** The heat coming off a spent clump of mites. */
const CLUMP_SMOKE = new THREE.Color(0x3a3430)
/** Mites killed this tick: a Vent through a brood is one crunch, however many die. */
let miteKills = 0
/** The cold grit a near miss blows off Still's feet. */
const COLD_GRIT = new THREE.Color(0x55606c)
/** A ram's lane direction, on the floor. */
const aim3 = (c: Charger) => new THREE.Vector3(Math.sin(c.aim), 0, Math.cos(c.aim))

const still = new Still()
world.scene.add(still.group)

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

/** Each enemy's live windup tone. `stop(true)` cuts it dead (a broken windup); otherwise it fades. */
const windups = new Map<object, sfx.Voice>()
/** Voices that outlast a windup and follow their enemy: a ram's rush, its stun ringing. */
const loops = new Map<Enemy, sfx.Voice>()
/** At most three windups at full voice: a fourth starts 9 dB down, so a crowd of tells stays three you can hear. */
const windupGain = () => (windups.size >= 3 ? 0.355 : 1)
/**
 * The hush before the rush: while a ram is locked (405 ms), footsteps and the
 * skitter drop 6 dB, so the latch and the held rev have the room to themselves.
 */
function hush() {
  return combat.awake.some((e) => e instanceof Charger && e.locked && e.phase === 'windup') ? 0.5 : 1
}

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
  blocker: () => null,
  breach: () => [],
  tickBreaches: () => [],
  faces: () => [],
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
  onHit: (at, e) => {
    castHits++
    const pan = panOf(at)
    // cold sparks off the metal, thrown away from Still
    const away = new THREE.Vector3(at.x - still.pos.x, 0, at.z - still.pos.z)
    if (e instanceof Charger && e.stunned) {
      // into the open hatch: the core flares and rings, and the moment holds a beat longer
      sfx.hit(pan)
      sfx.hitOpen(pan, e.plated ? 1.3 : 1)
      vfx.sparks(at3(at, 1.0), COLD, 12, 6.5, away, 0.9)
      vfx.flash(e.fireboxPoint(new THREE.Vector3()), EMBER, 0.4)
      hitstop = Math.max(hitstop, 0.06)
    } else {
      // shut plate soaks it: a quieter hit and a dull one under it
      if (e instanceof Charger && e.plated) {
        sfx.hit(pan, 0.7)
        sfx.plateDull(pan)
      } else sfx.hit(pan)
      vfx.sparks(at3(at, 1.0), COLD, 8, 6.5, away, 0.9)
      hitstop = Math.max(hitstop, 0.045)
    }
    vfx.flash(at3(at, 1.0), COLD_DEEP, 0.35)
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
  onKill: (at, kind, pack, wasElite, summoned, weight) => {
    run.killed = true
    if (kind === 'boss') {
      bossDown(at)
      return
    }
    if (kind === 'swarm') {
      // a pop, not a crunch: a few rust flecks, embers, no dust. Eight of them are still one crunch.
      vfx.chunks(at3(at, 0.2), 3, RUST, 3.5, 0.08)
      vfx.sparks(at3(at, 0.25), EMBER, 5, 4)
      vfx.flash(at3(at, 0.25), EMBER, wasElite ? 0.6 : 0.35)
      sfx.pop(panOf(at), wasElite)
      miteKills++
      shake = Math.max(shake, miteKills >= 3 ? 0.12 : 0.06)
      hitstop = Math.max(hitstop, miteKills >= 3 ? 0.03 : 0.02)
      maybeDrop(at, kind, pack, wasElite, summoned, weight)
      return
    }
    sfx.kill(panOf(at))
    if (kind === 'charger') {
      // the boiler's last breath: rust, the two hatch plates thrown high, smoke rising
      vfx.chunks(at3(at, 0.8), 14, RUST, 5.5, 0.18)
      vfx.chunks(at3(at, 1.0), 2, JOINT_C, 6, 0.3)
      vfx.sparks(at3(at, 0.9), EMBER, 18, 6)
      vfx.flash(at3(at, 0.9), EMBER, 1.0)
      vfx.dust(at, 10, 1.0)
      vfx.smokePuff(at3(at, 1.0), 3)
      sfx.ramDeath(panOf(at))
      const mod = wasElite ? pack.elite?.mod : undefined
      if (mod === 'plated') vfx.chunks(at3(at, 0.8), 4, PLATE_C, 5, 0.26)
      if (mod === 'splitting') {
        // it cracks along its seam into the two that were in it
        vfx.chunks(at3(at, 0.8), 6, RUST, 5, 0.14)
        sfx.ramSplit(panOf(at))
      }
      shake = Math.max(shake, 0.3)
    } else {
      // it comes apart: chunks of its own metal, a burst of embers, a puff of grit
      vfx.chunks(at3(at, 0.8), 12, kind === 'ranged' ? STEEL : RUST, 5.5, 0.18)
      vfx.sparks(at3(at, 0.9), EMBER, 16, 6)
      vfx.flash(at3(at, 0.9), EMBER, 0.9)
      vfx.dust(at, 8, 0.8)
      shake = Math.max(shake, 0.28)
    }
    maybeDrop(at, kind, pack, wasElite, summoned, weight)
    hitstop = Math.max(hitstop, 0.08)
    rig.punch(0.035)
  },
  onEnemy: (ev) => {
    if (import.meta.env.DEV) {
      enemyLog.push({ t: combat.time, ev })
      if (enemyLog.length > 2000) enemyLog.shift()
    }
    if ('e' in ev && ev.e instanceof Charger) ramEvent(ev.e, ev)
    else packEvent(ev)
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
    if (ev.kind === 'strain') {
      // Brace: the hit flies into his cage as embers and costs strain; integrity doesn't move
      const core = still.core.getWorldPosition(new THREE.Vector3())
      for (let i = 0; i < 10; i++) {
        const a = Math.random() * Math.PI * 2
        const from = core.clone().add(new THREE.Vector3(Math.sin(a) * 0.9, 0.2, Math.cos(a) * 0.9))
        vfx.sparks(from, EMBER, 1, 4, core.clone().sub(from), 0.2)
      }
      sfx.braceConvert()
      shake = Math.max(shake, 0.2)
      // Brace: the pip leaves from Still, not a button: the hit is what spent it
      addStrain(ev.amount, screenOf(ev.at))
    }
    if (ev.kind === 'catch') {
      // the biggest moment an arms part has: the blow lands on the clamp, and he hammers back
      still.attack({ beat: 'anvil-slam', pushed: false })
      const at = at3(ev.at, 0.8)
      vfx.flash(at, COLD, 1.4)
      vfx.sparks(at, COLD, 34, 10)
      vfx.dust(ev.at, 18, 1.6, undefined, 5)
      vfx.chunks(at, 4, STEEL, 5, 0.12)
      sfx.anvilCatch()
      hitstop = Math.max(hitstop, 0.09)
      shake = Math.max(shake, 0.5)
      rig.punch(0.07)
      navigator.vibrate?.([20, 30, 40])
    }
    if (ev.kind === 'shield') {
      const at = at3(ev.at, 1.3)
      if (ev.reflected) {
        vfx.flash(at, COLD, 0.5)
        sfx.reflect()
      } else {
        // its heat broken on his cold
        vfx.sparks(at, COLD, 8, 5)
        vfx.flash(at, COLD_DEEP, 0.3)
        sfx.shieldTing()
      }
    }
    if (ev.kind === 'windowEnd') {
      // G8: it ends with a snap. A missed Anvil is small and honest: a clink and a puff off the clamp.
      if (ev.slot === 'arms') {
        sfx.anvilMiss()
        vfx.dust(still.jawL.getWorldPosition(new THREE.Vector3()), 3, 0.2, undefined, 1)
      } else {
        sfx.windowEnd()
        vfx.sparks(at3(still.pos, 1.0), COLD, 4, 2)
      }
    }
    if (ev.kind === 'land') landFx(ev.at, ev.what)
    if (ev.kind === 'bounce') {
      // a cold flash on the wall top, and sparks thrown back off it; the answer pings the same
      const at = at3(ev.at, 1.0)
      vfx.flash(at, ev.side === 'still' ? COLD : EMBER, 0.5)
      vfx.sparks(at, ev.side === 'still' ? COLD : EMBER, 8, 5, undefined, 0.6)
      vfx.chunks(at, 2, STONE, 3, 0.08)
      sfx.bounce(panOf(ev.at), ev.n)
    }
    if (ev.kind === 'breach') {
      for (const h of ev.holes) {
        if (h.kind === 'void') continue
        const c = new THREE.Vector3((h.minX + h.maxX) / 2, 0, (h.minZ + h.maxZ) / 2)
        if (ev.open) {
          // stone on both faces of what it went through
          vfx.chunks(at3(c, 0.7), 6, STONE, 4, 0.12)
          vfx.dust(c, 8, Math.max(h.maxX - h.minX, h.maxZ - h.minZ) / 2 + 0.4, undefined, 3)
          sfx.breachWall(panOf(c))
        } else {
          vfx.dust(c, 5, 0.6, undefined, 1.5)
          sfx.breachClose(panOf(c))
        }
      }
    }
    if (ev.kind === 'interrupt') {
      // its heat broken by his cold: the tell shatters, the tone cuts dead, and the moment holds
      windups.get(ev.enemy)?.stop(true)
      windups.delete(ev.enemy)
      tellBreak(ev.enemy)
      sfx.parryBreak(panOf(ev.enemy.pos))
      vfx.flash(at3(ev.enemy.pos, 1.0), COLD, 1.0)
      vfx.sparks(at3(ev.enemy.pos, 1.0), COLD, 16, 7)
      vfx.dust(ev.enemy.pos, 8, 0.6)
      hitstop = Math.max(hitstop, 0.09)
      rig.punch(0.05)
    }
    if (ev.kind === 'mark' && ev.state === 'consumed') {
      sfx.markConsumed(panOf(ev.enemy.pos))
      hitstop = Math.max(hitstop, 0.06)
    }
    if (ev.kind === 'slow' && ev.state === 'off') {
      // the frost falls off it: three pale chunks and a glass tick
      vfx.chunks(at3(ev.enemy.pos, 0.6), 3, new THREE.Color(0x9fb4c8), 2, 0.08)
      sfx.slowEnd(panOf(ev.enemy.pos))
    }
    if (ev.kind === 'throw') vfx.sparks(still.jawL.getWorldPosition(new THREE.Vector3()), COLD, 6, 4)
    if (ev.kind === 'decoy' && ev.state === 'burst') {
      // the decoy bursts and shatters into cold chunks: never Still's own breaking
      const at = at3(ev.at, 1.0)
      vfx.flash(at, COLD, 1.4)
      vfx.sparks(at, COLD, 30, 8)
      vfx.dust(ev.at, 12, 1.5, undefined, 4)
      vfx.chunks(at, 8, new THREE.Color(0x9fc0ff), 4, 0.1)
      sfx.decoyBurst(panOf(ev.at))
      shake = Math.max(shake, 0.25)
    }
    if (ev.kind === 'anchor') {
      const at = at3(ev.at, 0.5)
      if (ev.state === 'snap') vfx.sparks(at, COLD, 12, 5)
      if (ev.state === 'fade') {
        vfx.frost(at, 6, 0.3)
        sfx.anchorFade()
      }
    }
    if (ev.kind === 'cooldownStart') hud.startCooldown(ev.slot)
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
      const def = fillEmpty(taken) ?? rollPart('chaser', taken, 'crate', pool())
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
      windups.set(e, sfx.asVoice(aimed ? sfx.aim(ms, 0.55, panOf(e.pos), windupGain()) : sfx.windup(ms, panOf(e.pos), windupGain())))
      return
    }
    if (e.kind === 'charger') {
      windups.set(e, sfx.rev(ms, CHARGER.lockAt, panOf(e.pos), windupGain()))
      return
    }
    const stop = e.kind === 'ranged' ? sfx.aim(ms, RANGED.lockAt, panOf(e.pos), windupGain()) : sfx.windup(ms, panOf(e.pos), windupGain())
    windups.set(e, sfx.asVoice(stop))
  },
  onStrike: (e) => {
    windups.delete(e)
    // the rush roars on and follows the ram across the screen
    if (e.kind === 'charger') {
      if (run.phase === 'crawl') loops.set(e, sfx.rush(panOf(e.pos)))
    } else if (e.kind === 'ranged') sfx.fire(panOf(e.pos))
    else sfx.strike(panOf(e.pos))
    strikeFx(e)
  },
  onShotBlocked: (at) => {
    sfx.blocked(panOf(at))
    vfx.sparks(at3(at, 1.1), STONE.clone().lerp(new THREE.Color(1, 0.9, 0.7), 0.5), 6, 4)
  },
  onGone: (e) => {
    windups.get(e)?.stop()
    windups.delete(e)
    // a ram that dies stuck in a wall stops ringing at once
    loops.get(e)?.stop(true)
    loops.delete(e)
  },
})

/** A brood's instants (its one surge voice, the ring's pieces breaking, the bite, the end), and a Warden's seals breaking. */
function packEvent(ev: EnemyEvent) {
  switch (ev.kind) {
    case 'sealBreak':
      // you hear the ward come off: one tin tick per member, rippling outward
      ev.members.forEach((m, rank) => sfx.sealTick(panOf(m.pos), 0.03 * rank))
      break
    case 'surge': {
      if (run.phase === 'crawl') windups.set(ev.brood, sfx.chitter(ev.ms, ev.biters, panOf(ev.at), windupGain()))
      // the stamp: six embers thrown off the ring's edge
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3
        const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
        vfx.sparks(new THREE.Vector3(ev.at.x + dir.x * BROOD.ringR, 0.15, ev.at.z + dir.z * BROOD.ringR), EMBER, 1, 2, dir, 0.2)
      }
      break
    }
    case 'biterLost':
      // one jaw fewer in the chitter; the other jaws are still coming, so it isn't cut
      windups.get(ev.brood)?.lose?.()
      if (ev.why === 'parry') vfx.sparks(ev.arc, COLD, 6, 3)
      else vfx.sparks(ev.arc, EMBER, 3, 2)
      break
    case 'bite':
      sfx.snap(ev.biters, ev.hit, panOf(ev.at))
      windups.delete(ev.brood)
      break
    case 'landed':
      for (const p of ev.at) vfx.dust(p, 2, 0.25, undefined, 2)
      break
    case 'broodEnd':
      // the mind leaving: a column of embers where the last one fell
      sfx.broodEnd(panOf(ev.at))
      vfx.embers(at3(ev.at, 0.2), 12, 0.3)
      shake = Math.max(shake, 0.15)
      break
    case 'broodGone':
      windups.get(ev.brood)?.stop(true)
      windups.delete(ev.brood)
      break
  }
}

/** What a brood does between its moments: the lunge's trails, the spent clump's heat, a flung mite landing. */
const broodSmoke = new WeakMap<Brood, number>()
function broodFx(dt: number) {
  for (const b of combat.broods) {
    if (b.state === 'strike') {
      for (const m of b.biters) if (!m.dead && m.phase === 'strike' && m.t < 50) vfx.trail(m.rig.core.getWorldPosition(fxA), EMBER, 0.1)
    }
    if (b.state === 'recover' && b.L) {
      const t = (broodSmoke.get(b) ?? 0) - dt
      if (t <= 0) vfx.smokePuff(fxA.set(b.L.x, 0.2, b.L.z), 1, CLUMP_SMOKE)
      broodSmoke.set(b, t <= 0 ? 0.2 : t)
    }
    for (const m of b.mites) {
      if (!m.landed) continue
      m.landed = false
      vfx.dust(m.pos, 1, 0.2)
    }
  }
}

/**
 * Each brood is one rustling thing: mites never step. A tick rate that thickens
 * with the mites on the move, capped per brood and across broods, panned at a
 * random moving mite, and ducked under any windup so it never covers a tell.
 */
const skitterAcc = new Map<Brood, number>()
function skitter(dt: number) {
  if (run.phase !== 'crawl') return
  const awake = combat.broods.filter((b) => b.pack.state === 'awake')
  const rates = awake.map((b) => Math.min(24, 6 * Math.min(b.movingCount(), 4) * (b.queen?.quick ? 1.45 : 1)))
  const sum = rates.reduce((a, r) => a + r, 0)
  const scale = sum > 36 ? 36 / sum : 1
  const duck = windups.size > 0 ? 0.5 : 1
  const quiet = hush()
  awake.forEach((b, i) => {
    let acc = (skitterAcc.get(b) ?? 0) + rates[i]! * scale * dt
    const moving = b.mites.filter((m) => !m.dead && m.moving)
    while (acc >= 1 && moving.length) {
      acc -= 1
      const m = moving[Math.floor(Math.random() * moving.length)]!
      const d = b.nearestTo(still.pos)
      sfx.skitterTick(panOf(m.pos), Math.max(0, 1 - d / STEP_HEAR) * duck * quiet)
    }
    skitterAcc.set(b, Math.min(acc, 1))
  })
}

/** A ram's instants: the lock, the pawing, the ways a rush ends. */
function ramEvent(c: Charger, ev: EnemyEvent) {
  const pan = panOf(c.pos)
  switch (ev.kind) {
    case 'lock': {
      // the stack spits as the lane sets
      const m = c.stackMouth(new THREE.Vector3())
      vfx.embers(m, 4, 0.15)
      vfx.smokePuff(m, 1)
      rig.punch(0.01)
      break
    }
    case 'paw':
      vfx.dust(ev.at, 3, 0.3, undefined, 2)
      break
    case 'rushEnd': {
      loops.get(c)?.stop(ev.how === 'trip')
      loops.delete(c)
      if (ev.how === 'wall' || ev.how === 'caught') {
        // the Anvil's own bell has already rung: a caught ram crashes without one
        sfx.ramCrash(pan, ev.how === 'wall')
        if (run.phase === 'crawl') loops.set(c, sfx.dazed(CHARGER.stunMs, pan))
        ramImpact(c, ev.at, ev.how === 'wall')
      }
      if (ev.how === 'trip') tellBreak(c)
      break
    }
    case 'stunEnd':
      // dazed() plays its own hatch slam; a few sparks off the back as it shuts
      loops.delete(c)
      vfx.sparks(at3(c.pos, 0.9), EMBER, 4, 3)
      vfx.dust(c.pos, 2, 0.5)
      break
    case 'skid':
      sfx.skid(pan)
      break
    case 'trample':
      // shouldered aside: embers off the contact, grit off its feet
      sfx.trample(panOf(ev.at))
      vfx.sparks(at3(ev.at, 0.5), EMBER, 6, 5, ev.dir, 0.5)
      vfx.dust(ev.at, 4, 0.5)
      break
    case 'nearMiss':
      // the roar dips as it passes (a cheap Doppler), and he flinches back
      loops.get(c)?.dip?.()
      vfx.dust(still.pos, 4, 0.4, COLD_GRIT, 3)
      rig.punch(-0.015)
      break
  }
}

/** What a ram does between its moments: banked smoke, stack embers, the rush's trail, the open hatch sparking. */
interface RamFx { smoke: number; ember: number; walk: number; stun: number; frame: number; spent: number; rushed: boolean }
const ramFxState = new WeakMap<Charger, RamFx>()
const fxA = new THREE.Vector3()
const fxB = new THREE.Vector3()
function ramFx(dt: number) {
  const rams = combat.enemies.filter((e): e is Charger => e instanceof Charger)
  if (!rams.length) return
  const awake = new Set(combat.awake)
  for (const c of rams) {
    let st = ramFxState.get(c)
    if (!st) {
      st = { smoke: 0.5 + Math.random() * 2, ember: 0, walk: Math.random() * 0.8, stun: 0, frame: 0, spent: 0, rushed: false }
      ramFxState.set(c, st)
    }
    st.frame++
    const mouth = c.stackMouth(fxA)
    if (c.consumeWake()) vfx.smokePuff(mouth, 3)
    if (c.isAsleep) {
      // you can spot a sleeping ram across a room by its wisp
      if (c.pos.distanceTo(still.pos) < 20 && (st.smoke -= dt) <= 0) {
        st.smoke = 2.5 + (Math.random() * 2 - 1) * 0.8
        vfx.smokePuff(mouth, 1, BANKED)
      }
      continue
    }
    if (c.phase === 'windup' && !c.locked && (st.ember -= dt) <= 0) {
      st.ember = 0.09
      vfx.embers(mouth, 1, 0.1)
    }
    if (c.walking) {
      // one puff a stride, but two rams walking side by side don't fog the room
      if ((st.walk -= dt) <= 0) {
        st.walk = 0.8
        if (!rams.some((o) => o !== c && awake.has(o) && o.pos.distanceTo(c.pos) < 6)) vfx.smokePuff(mouth, 1)
      }
      // Quick: its flared exhaust streams embers
      if (c.elite === 'swift') vfx.embers(mouth, 1, 0.05)
    }
    if (c.rushing) {
      if (!st.rushed) st.spent = 0
      vfx.trail(mouth, EMBER, 0.22)
      // grit and hoof sparks, capped per rush so two rams can't flood the pools
      if (st.spent < 24) {
        if (st.frame % 2 === 0) {
          vfx.dust(c.rearMid(fxB), 1, 0.3, undefined, 2)
          st.spent += 1
        }
        if (st.frame % 3 === 0) {
          vfx.sparks(c.hoofMid(fxB), EMBER, 2, 4, aim3(c).negate(), 0.5)
          st.spent += 2
        }
      }
    }
    st.rushed = c.rushing
    if (c.skidding) {
      const f = c.frontMid(fxB)
      vfx.sparks(f, EMBER, 3, 5, aim3(c), 0.4)
      vfx.dust(f, 2, 0.4, undefined, 4)
    }
    if (c.stunned && (st.stun -= dt) <= 0) {
      st.stun = 0.09
      vfx.sparks(c.fireboxPoint(fxB), EMBER, 2, 3)
      for (const side of [-1, 1] as const) {
        const p = c.flankPoint(side, fxB)
        if (p) vfx.sparks(p, EMBER, 1, 3)
      }
    }
  }
}

/** The face into a wall: stone off the wall, rust off the ram, a fan of sparks thrown back along the lane. */
function ramImpact(c: Charger, at: THREE.Vector3, wall: boolean) {
  const p = at3(at, 0.4)
  const back = aim3(c).negate()
  if (wall) vfx.chunks(p, 10, STONE, 5, 0.14)
  vfx.chunks(p, 3, RUST, 4, 0.12)
  vfx.sparks(p, EMBER, 22, 8, back, 1.3)
  vfx.flash(p, EMBER, 1.3)
  vfx.dust(at, 14, 1.0, undefined, 5)
  vfx.smokePuff(c.stackMouth(new THREE.Vector3()), 2)
  shake = Math.max(shake, 0.4)
  // the first stun of the run holds a beat longer: it teaches the hatch once
  const first = !run.ramStunSeen
  run.ramStunSeen = true
  hitstop = Math.max(hitstop, first ? 0.12 : 0.07)
  rig.punch(first ? 0.04 : 0.03)
}

const partFx = new PartFx(world.scene, vfx, still, combat.parts, combat)

/** Something a part put in the air comes down. Each kind lands in its own voice. */
function landFx(at: THREE.Vector3, what: 'flare' | 'signal' | 'throw' | 'wall') {
  switch (what) {
    case 'flare':
      // the lob comes down: a small nova where it lands
      vfx.flash(at3(at, 0.4), COLD_DEEP, 1.2)
      vfx.dust(at, 10, 1.2)
      vfx.sparks(at3(at, 0.3), COLD, 16, 6)
      sfx.lobLand(panOf(at))
      shake = Math.max(shake, 0.14)
      break
    case 'signal':
      // bright, not heavy: no dust, a chime, and the marks it leaves
      vfx.flash(at3(at, 0.4), COLD, 0.8)
      vfx.sparks(at3(at, 0.3), COLD, 10, 5)
      sfx.signalLand(panOf(at))
      break
    case 'throw':
    case 'wall':
      vfx.flash(at3(at, 0.5), COLD_DEEP, 0.8)
      vfx.dust(at, 14, 1.0, undefined, 4)
      vfx.chunks(at3(at, 0.4), 4, RUST, 4, 0.12)
      if (what === 'wall') {
        vfx.sparks(at3(at, 0.8), COLD, 16, 7)
        vfx.chunks(at3(at, 0.6), 6, STONE, 5, 0.14)
        rig.punch(0.04)
      }
      sfx.throwLand(panOf(at), what === 'wall')
      shake = Math.max(shake, what === 'wall' ? 0.3 : 0.18)
      break
  }
}

/** N9: an enemy's live tell shatters into cold shards along its own outline. */
function tellBreak(e: Enemy) {
  // a mite's piece of the ring shatters through its brood (biterLost), not round its own body
  if (e instanceof Mite) return
  if (e instanceof Charger) {
    // strewn along both rails of the lane it was drawing
    const fx = Math.sin(e.aim)
    const fz = Math.cos(e.aim)
    for (let i = 0; i < 16; i++) {
      const d = Math.random() * e.lane.len
      const side = i % 2 ? e.hitHalf : -e.hitHalf
      vfx.sparks(new THREE.Vector3(e.lane.x + fx * d + fz * side, 0.2, e.lane.z + fz * d - fx * side), COLD, 1, 2)
    }
  } else if (e.kind === 'ranged') {
    // along the aim line it was drawing
    const a = e.group.rotation.y
    for (let i = 0; i < 14; i++) {
      const d = (i / 13) * 6
      vfx.sparks(new THREE.Vector3(e.pos.x + Math.sin(a) * d, 0.2, e.pos.z + Math.cos(a) * d), COLD, 1, 3)
    }
  } else {
    // round the ring it was filling
    const r = 2.4 * e.size
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
      vfx.sparks(new THREE.Vector3(e.pos.x + dir.x * r, 0.2, e.pos.z + dir.z * r), COLD, 1, 3, dir, 0.3)
    }
  }
}

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
    case 'frost': {
      // frost scraped along the whole path, a little cold dust; the strip itself is drawn from the zone
      const d = Math.hypot(to.x - still.pos.x, to.z - still.pos.z)
      for (let s = 0; s <= d; s += 0.3) {
        const k = d > 0 ? s / d : 0
        vfx.frost(new THREE.Vector3(still.pos.x + (to.x - still.pos.x) * k, 0.3, still.pos.z + (to.z - still.pos.z) * k), 1, 0.4)
      }
      vfx.dust(still.pos, 5, 0.5, new THREE.Color(0x8fa3b8), 2)
      shake = Math.max(shake, 0.12)
      break
    }
    case 'snap':
      // a fast pull, with a wake behind it
      partFx.beam(still.pos, to, 1.0, 0.25)
      shake = Math.max(shake, 0.16)
      break
    case 'rewind':
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD, 0.7)
      vfx.embers(at3(still.pos, 1.2), 8, 0.4)
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
  if (m.kind === 'snap') {
    vfx.flash(at3(still.pos, 1.0), COLD, 0.8)
    sfx.snapArrive()
    return
  }
  if (m.kind === 'rewind') {
    // the afterimage merges back into him
    vfx.gather(still.core.getWorldPosition(new THREE.Vector3()), 12, 0.8, COLD)
    sfx.rewindArrive()
    return
  }
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
  } else if (e instanceof Charger) {
    // off the mark: grit kicked back from the rear hooves, and the prow flaring
    const rear = e.rearMid(new THREE.Vector3())
    vfx.dust(rear, 12, 0.6, undefined, 5)
    vfx.sparks(at3(rear, 0.1), EMBER, 8, 6, aim3(e).negate(), 0.6)
    vfx.flash(e.prowPoint(new THREE.Vector3()), EMBER, 0.6)
    shake = Math.max(shake, 0.12)
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
/** The walk into the warm beam, before the words. The world holds while he takes it. */
const HOMING_SECONDS = 0.6

/**
 * boot until the kit is in; workshop is the room, leaving the fade out of it into
 * a run; crawl and descending as ever; broken, stopping and homing are the three
 * terminal sequences (the ending is already kept by then); ending is the words,
 * and arriving the way into the room.
 */
type Phase = 'boot' | 'workshop' | 'leaving' | 'crawl' | 'descending' | 'broken' | 'stopping' | 'homing' | 'toWalk' | 'walkHome' | 'ending' | 'arriving'

/** One depth of a run, for __runStats: the phone test measures whether Stopped is reachable at all. */
interface DepthStats { depth: number; pushes: number; quiets: number; strainIn: number; strainOut: number | null }

const run = {
  phase: 'boot' as Phase,
  /** Whose run this is: a fresh one per startRun. The save keys its card by it (the next step). */
  id: '',
  /** ?depth= runs: tuning, not a real run. From the next step, nothing of them is saved. */
  dev: false,
  /** The ending is kept at its trigger, once: the first terminal thing in a tick wins. */
  committed: false,
  ending: null as { kind: EndingKind; hour: HomeHour; cardId: string } | null,
  /** What this run did to its parts, kept at the ending (history counts runs for now). */
  tally: freshTally() as RunTally,
  depth: 1, strain: 0, t: 0, swapped: false, fought: false, quietT: 0, killed: false, ramStunSeen: false,
  stats: [] as DepthStats[],
}

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

function maybeDrop(at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean, weight: number) {
  // a side room's pack always pays out (the last kill drops if nothing else did), elites always do
  if (Math.random() >= dropChance(pack, wasElite, summoned, weight)) return
  const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
  const def = wasElite ? rollPart(kind, taken, 'elite', pool()) : fillEmpty(taken) ?? rollPart(kind, taken, 'kill', pool())
  if (!def) return
  pack.dropped = true
  loot.drop(def, at, still.pos)
  sfx.drop(def.tier, panOf(at))
}

/** What the save has found and turned, at this depth: every drop reads it. */
const pool = (): PoolView => poolView(save, run.depth)

/**
 * Still starts incomplete. While a slot is empty, most drops are a plain part for
 * one of the empty slots, so the first level is spent putting yourself together.
 * Only found whites facing out: a part turned to the wall never fills a slot.
 */
const FILL_EMPTY_CHANCE = 0.6
function fillEmpty(taken: readonly AbilityDef[], empty: readonly SlotName[] = hud.slots.filter((s) => !s.def).map((s) => s.slot)): AbilityDef | null {
  if (empty.length === 0 || Math.random() > FILL_EMPTY_CHANCE) return null
  const ids = new Set(taken.map((p) => p.id))
  const out = new Set(facingOutWhites(save))
  const options = PARTS.filter((p) => out.has(p.id) && empty.includes(p.slot) && !ids.has(p.id))
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
  // in the room, the board's card opens the look-back screen
  if (run.phase === 'workshop' && workshop.near === 'board') {
    void lookBack()
    return
  }
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
    const def = rollPart('chaser', taken, 'plenty', pool())
    if (def) {
      loot.drop(def, at, still.pos)
      sfx.drop(def.tier, 0)
    }
    overlay.banner('bargained \u00b7 strain +4')
    // a bargain can cost everything
    addStrain(4, screenOf(at))
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
    labelTmp.set(el.leader.pos.x, el.leader.labelY * el.leader.size, el.leader.pos.z).project(world.camera)
    if (Math.abs(labelTmp.x) > 1 || Math.abs(labelTmp.y) > 1) continue
    const x = (labelTmp.x * 0.5 + 0.5) * window.innerWidth
    const y = (-labelTmp.y * 0.5 + 0.5) * window.innerHeight
    html.push(`<div class="elite" style="left:${x}px;top:${y}px"><b>${el.name}</b><span>${eliteLine(el.leader.kind, el.mod)}</span></div>`)
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
  const st = run.stats[run.stats.length - 1]
  if (st) st.quiets++
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
    hud.offer(next?.def ?? null, !!next && !save.found.includes(next.def.id))
    loot.offer(next)
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
  pause.compare(current, g.def, hud.loadout, () => {
    resume()
    takePart(g)
  }, resume, !save.found.includes(g.def.id))
})

/** A swap: what the outgoing part had running ends first, and a live anchor hands on a full cooldown (R8). */
function swapIn(def: AbilityDef): AbilityDef | null {
  const anchorLive = def.slot === 'legs' && !!combat.parts.anchor
  combat.clearSlot(def.slot)
  return hud.equip(def, anchorLive ? 1 : undefined)
}

function takePart(g: GroundPart) {
  // found the moment it's taken, and saved in the same call: closing the tab can't lose it
  if (markFound(save, g.def.id)) store.write()
  carry(g.def.id)
  const old = swapIn(g.def)
  loot.remove(g)
  // an empty slot filled: nothing falls out
  // the part he gave up lands at his feet as itself
  if (old) loot.drop(old, still.pos)
  still.wear(g.def.slot, g.def)
  offered = null
  offerHeld = true
  hud.offer(null)
  loot.offer(null)
  sfx.take()
  rig.punch(0.03)
  still.group.scale.setScalar(1.12)
  navigator.vibrate?.(18)
}

// --- pause: the world stops, cooldowns included; the music keeps going, quieter ---

let paused = false
/** Dev only: the rAF loop renders and nothing steps (async checks). */
let held = false
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

/**
 * The Assembler falls: the beams open, and it leaves the best of what it was made from.
 * Before the last depth that's on and home; after the last one, home only.
 */
function bossDown(at: THREE.Vector3) {
  combat.boss = null
  hud.bossBar(null)
  for (const kind of exitsAfterBoss(run.depth)) {
    if (kind === 'cold') level?.openExit()
    else level?.openHome()
  }
  sfx.bossDown()
  shake = 1.2
  hitstop = 0.25
  rig.punch(0.12)
  navigator.vibrate?.([60, 40, 120])
  // one blue and one gold, never for the same slot
  const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
  const blue = rollPart('boss', taken, 'boss-blue', pool())
  const gold = rollPart('boss', blue ? [...taken, blue] : taken, 'boss-gold', pool(), blue?.slot)
  for (const def of [blue, gold]) if (def) loot.drop(def, at, still.pos)
  loot.dropScrap(new THREE.Vector3(at.x + 1.2, 0, at.z))
  loot.dropScrap(new THREE.Vector3(at.x - 1.2, 0, at.z))
  overlay.banner(`area ${run.depth / BOSS_EVERY} cleared`)
}

/** Build a level and put Still at its entrance. HP is whole again; strain carries. `seed` repeats a layout (resume, checks). */
function enterLevel(depth: number, o: { seed?: number } = {}) {
  level?.dispose()
  hud.bossBar(null)
  loot.clear()
  combat.reset()
  partFx.clear()
  level = generateLevel(depth, o.seed, { boss: bossFor(depth) })
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  for (const p of level.packs) combat.addPack(p.members, p.room.kind === 'side', p.elite)
  combat.breakables = level.breakables
  const boss = bossFor(depth)
  if (level.boss && boss) combat.addBoss(level.boss.x, level.boss.z, level.boss.face, boss)
  // the area's look and sound (both areas share one today; setSurfaces is a no-op until they don't)
  setSurfaces(areaOf(depth).surfaces)
  applyDay(world, DEPTH_DAY[Math.min(RUN_DEPTHS, depth)] ?? 'dusk')
  run.fought = false
  run.quietT = 0
  run.killed = false
  lastStep.clear()
  still.pos.copy(level.entrance)
  prev.copy(still.pos)
  run.depth = depth
  closeStats()
  run.stats.push({ depth, pushes: 0, quiets: 0, strainIn: run.strain, strainOut: null })
  // the card's line gets a tick where this depth began
  run.tally.marks.push(run.tally.line.length)
  overlay.banner(level.boss ? `Depth ${depth} \u00b7 something is waiting` : `Depth ${depth}`)
}

function startRun() {
  leaveRoom()
  still.reassemble()
  Object.assign(run, {
    phase: 'crawl', strain: 0, t: 0, swapped: false, ramStunSeen: false,
    id: newRunId(), dev: DEPTH_PARAM !== null, committed: false, ending: null, stats: [], tally: freshTally(),
  })
  if (!run.dev) {
    // the first night: the doorframe's marks grow from here, in calendar time
    save.firstRunAt ??= new Date().toISOString()
    // a run begun some other way than the door still settles the hook the door would have
    applyHookDefault(save)
    store.write()
  }
  loot.clear()
  // Still begins with one part: the one on the hook, else a random plain one; the rest
  // he finds. Starting deeper (?depth=) skips the levels where he'd have found them, so
  // he gets all four.
  const start = START_DEPTH > 1 ? STARTING : [byId(startPart(save))]
  for (const p of start) carry(p.id)
  // the last run's anchor or decoy goes before the new loadout arrives, so nothing carries over onto its buttons
  combat.reset()
  hud.resetLoadout(start)
  for (const slot of SLOT_NAMES) still.wear(slot, start.find((p) => p.slot === slot) ?? null)
  enterLevel(START_DEPTH)
  hud.bossBar(null)
  rig.reset()
  hud.enabled = true
  overlay.hide()
  sfx.restore()
}

/** Not crypto.randomUUID: that needs a secure context, and the phone plays over plain http on the LAN. */
function newRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** The depth being left gets its strain on the way out. */
function closeStats() {
  const st = run.stats[run.stats.length - 1]
  if (st && st.strainOut === null) st.strainOut = run.strain
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

/** A part went on Still this run: its history counts the run at the ending. */
function carry(id: string) {
  if (!run.tally.carried.includes(id)) run.tally.carried.push(id)
}

/**
 * The ending is kept the moment it's triggered (HP out, strain full, the warm beam),
 * never at the button: a tab closed during the words must still keep the run.
 * Once per run, and one write: the card, the parts' history, what can go on the
 * hook, and the ending the Workshop will replay. A dev run keeps the ending in
 * memory and nothing else.
 */
/** A world point as a share of the canvas, 0..1 across and down. */
function onCanvas(p: { x: number; y?: number; z: number }) {
  const v = new THREE.Vector3(p.x, p.y ?? 0, p.z).project(world.camera)
  return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5 }
}

/** What the kid draws of this ending, besides the frame: him, where he was, how it ended, the house, the sky. */
function momentOf(kind: EndingKind): Moment {
  const day = dayNow().key
  const night = day === 'night' || day === 'dusk'
  const house = level?.house ? onCanvas({ x: level.house.door.x - 1.2, z: level.house.door.z - 1.2 }) : undefined
  return {
    still: onCanvas(still.pos),
    pose: kind === 'broken' ? 'broken' : kind === 'stopped' ? 'slumped' : 'stand',
    house,
    sky: night ? 'moon' : 'sun',
    light: kind === 'home' && !level?.house ? 'warm' : undefined,
  }
}

/** The strain line's samples: 0-20 as one character each. */
const SAMPLE = '0123456789abcdefghijk'
/** Past this, pairs merge into their max and the step doubles: a long run still fits. */
const LINE_MAX = 192
const LINE_KEEP = 96

/**
 * §4.18. The run's strain as a line: over each window (5 s at first) the highest strain
 * is one sample. When the line gets long, neighbouring pairs merge into their max and
 * the window doubles, so a long run keeps its whole shape, just coarser.
 */
function sampleStrain(dt: number) {
  const t = run.tally
  t.win = Math.max(t.win, run.strain)
  t.winT += dt
  if (t.winT < t.lineStep) return
  pushSample(t.win)
  t.win = run.strain
  t.winT = 0
}
function pushSample(v: number) {
  const t = run.tally
  t.line += SAMPLE[Math.max(0, Math.min(20, Math.round(v)))]
  if (t.line.length >= LINE_MAX) halveLine()
}
function halveLine() {
  const t = run.tally
  let out = ''
  for (let i = 0; i < t.line.length; i += 2) {
    const a = SAMPLE.indexOf(t.line[i]!)
    const b = i + 1 < t.line.length ? SAMPLE.indexOf(t.line[i + 1]!) : a
    out += SAMPLE[Math.max(a, b)]
  }
  t.line = out
  t.lineStep *= 2
  t.marks = t.marks.map((m) => Math.floor(m / 2))
}

function commit(kind: EndingKind) {
  if (run.committed) return
  run.committed = true
  closeStats()
  // the line's last sample is the ending's own strain, then it's made to fit the card
  const t = run.tally
  pushSample(Math.max(t.win, run.strain))
  while (t.line.length > LINE_KEEP) halveLine()
  const worn = hud.slots.map((s) => s.def?.id ?? null)
  const hour = hourAtEnd(kind, run.depth)
  run.ending = { kind, hour, cardId: run.id }
  if (run.dev) {
    save.lastEnding = { kind, hour, depth: run.depth, worn, cardId: run.id, arrived: false }
    return
  }
  save.runs += 1
  const card = { id: run.id, n: save.runs, date: localDate(), end: kind, depth: run.depth, hour, by: drawerFor(save.runs), worn, line: t.line, marks: [...t.marks] }
  save.cards.push(card)
  trimCards(save)
  drawings.putCard(card)
  // what he came home wearing is found, whatever happened to the rest
  for (const id of worn) if (id) markFound(save, id)
  for (const id of run.tally.carried) {
    const h = save.history[id] ?? [0, 0, 0, 0, 0, 0]
    h[0] += 1
    save.history[id] = h
  }
  save.pendingHook = { candidates: hookCandidates(save, worn) }
  save.lastEnding = { kind, hour, depth: run.depth, worn, cardId: run.id, arrived: false }
  save.run = null
  store.write()
}

function end(kind: EndingKind) {
  run.phase = 'ending'
  // the kid draws this frame: the one under the words
  const card = save.cards.find((c) => c.id === run.ending?.cardId)
  if (!run.dev && card) drawings.request(card.id, card.by, momentOf(kind))
  overlay.show(kind, run.depth, continueHome)
  // the silence after the ending is held a moment, then the bell comes back under the words
  sfx.restore(3)
}

function stopAllWindups() {
  for (const v of windups.values()) v.stop()
  windups.clear()
  for (const v of loops.values()) v.stop()
  loops.clear()
}

function breakApart() {
  commit('broken')
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
  commit('stopped')
  run.phase = 'stopping'
  updateOffer()
  updateShrinePrompt()
  run.t = 0
  hud.enabled = false
  stopAllWindups()
  sfx.windDown(STOP_SECONDS)
}

/** Where the homing walk ends: the warm beam's centre. */
const homingTo = new THREE.Vector3()

/**
 * Into the warm beam, by choice. The world holds from this tick (combat isn't
 * updated again), so nothing can reach him once he's in the light.
 */
function beginHoming(to: THREE.Vector3) {
  commit('home')
  run.phase = 'homing'
  homingTo.set(to.x, 0, to.z)
  updateOffer()
  updateShrinePrompt()
  run.t = 0
  hud.enabled = false
  stopAllWindups()
  // the world goes soft around him rather than silent: nothing broke
  sfx.pauseDuck(true)
  sfx.homeBeam()
}

// --- home: the Workshop, between runs ---

/** Built once the kit is in, hidden during runs. */
let workshop!: Workshop
/** Seconds left of the fade in to a run leaving the room. */
let fadeInT = 0

/** The words' button: everything fades, then the room, and the way into it this ending had. */
function continueHome() {
  if (run.phase !== 'ending') return
  run.phase = 'arriving'
  run.t = 0
  run.swapped = false
  hud.enabled = false
  overlay.leave()
}

/** The room now: the run's world is put away and Still arrives the way `arrival` says (the fade in is the room's). */
function enterRoom(arrival: ArrivalKind, hour: HomeHour, worn: (string | null)[]) {
  overlay.hide()
  // the maze's banners (a depth, a quiet) never follow him in
  overlay.quiet(true)
  stopAllWindups()
  level?.dispose()
  level = null
  loot.clear()
  combat.reset()
  partFx.clear()
  combat.terrain = workshop.terrain
  loot.terrain = workshop.terrain
  offered = null
  atShrine = null
  hud.offer(null)
  hud.prompt(null)
  hud.bossBar(null)
  hud.mode('workshop')
  hud.enabled = false
  hud.setStick(0, 0)
  rig.reset()
  sfx.restore(1)
  updateDoorMarks()
  workshop.refresh(save)
  workshop.enter({ arrival, hour, worn })
  fade.style.opacity = '1'
  run.phase = arrival === 'idle' ? 'workshop' : 'arriving'
  run.swapped = true
  if (arrival === 'idle') hud.enabled = true
}

/** In the room (or fading out of it): its light, its camera, its sounds. */
const inRoom = () => run.phase === 'workshop' || run.phase === 'leaving' || (run.phase === 'arriving' && run.swapped)

/** One step of the room, and what came of it. */
function roomStep(dt: number) {
  for (const ev of workshop.update(dt, hud.moveX, hud.moveZ)) {
    if (ev.kind === 'arrived') {
      run.phase = 'workshop'
      hud.enabled = true
      // a reload from here on opens the room as it is, rather than replaying the way in
      if (save.lastEnding && !save.lastEnding.arrived) {
        save.lastEnding.arrived = true
        store.write()
      }
    }
    if (ev.kind === 'near') showCard(ev.id)
    if (ev.kind === 'door' && run.phase === 'workshop') {
      // the hook's choice is made at the door: what's hung starts the run (a dev run's save is memory only)
      applyHookDefault(save)
      store.write()
      showCard(null)
      run.phase = 'leaving'
      run.t = 0
      hud.enabled = false
      hud.prompt(null)
    }
  }
  fade.style.opacity = String(workshop.blackout)
}

/** The wall's section or the hook he's at: its chooser, and which part on it is picked. */
let chooserAt: InteractId | null = null
let chooserSel: string | null = null

/** What he's standing at: the chooser for the wall and the hook, a plain card for the rest. */
function showCard(id: InteractId | null) {
  chooserAt = id && (id === 'hook' || id.startsWith('wall:')) ? id : null
  chooserSel = null
  hud.prompt(id && !chooserAt ? workshop.promptFor(id, save) : null)
  renderChooser()
}

function renderChooser() {
  if (!chooserAt) {
    hud.chooser(null)
    return
  }
  const c = workshop.cardFor(chooserAt as 'hook' | `wall:${SlotName}`, save, chooserSel)
  chooserSel = c.selected
  hud.chooser(c)
}

hud.onChoose((id) => {
  if (!chooserAt) return
  chooserSel = id
  renderChooser()
})

/** The chooser's one action: turn a part to the wall (or back), or hang one on the hook. Saved at once. */
function chooserAction() {
  if (!chooserAt || !chooserSel || run.phase !== 'workshop') return
  const done = chooserAt === 'hook' ? hang(save, chooserSel) : toggleTurn(save, chooserSel)
  if (!done) return
  store.write()
  workshop.refresh(save)
  if (chooserAt === 'hook') sfx.plaqueTurn(0)
  renderChooser()
}
hud.onChooserAction(chooserAction)

/** "Now", for the doorframe: the clock, or a dev override. */
let nowOverride: Date | null = null
const now = () => nowOverride ?? new Date()

/**
 * §5.9. A mark a month since the first night, for each child, never fewer than
 * before (a clock set back can't take a mark away), at most MARKS_MAX.
 */
function updateDoorMarks() {
  if (!save.firstRunAt) return
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.floor((day(now()) - day(new Date(save.firstRunAt))) / 86400000)
  const n = Math.min(MARKS_MAX, Math.max(save.doorMarks, 1 + Math.floor(Math.max(0, days) / 30)))
  if (n === save.doorMarks) return
  save.doorMarks = n
  store.write()
}

/** The corkboard's look: every card, newest first, from IndexedDB when it has them. */
async function lookBack() {
  const all = (await drawings.allCards()) ?? save.cards
  const cards = [...(all.length ? all : save.cards)].reverse()
  if (!cards.length) return
  hud.enabled = false
  hud.prompt(null)
  pause.lookBack(cards.length, async (i) => {
    const card = cards[i]!
    const blob = await drawings.get(card.id)
    const bmp = blob ? await createImageBitmap(blob).catch(() => null) : null
    return composeCard(card, bmp, 512, 384)
  }, () => {
    pause.hide()
    hud.enabled = true
    if (workshop.near) showCard(workshop.near)
  })
}

/** Out of the room without the door (dev hooks, and a run started some other way). */
function leaveRoom() {
  overlay.quiet(false)
  chooserAt = null
  hud.chooser(null)
  if (!workshop?.group.visible) return
  workshop.leave()
  hud.mode('run')
  hud.prompt(null)
}

hud.onFire((def, pushed) => {
  if (run.phase !== 'crawl') return { cooldown: 'refused' }
  const r = cast(def, pushed)
  if (r.cooldown === 'refused') return r
  const st = run.stats[run.stats.length - 1]
  if (pushed && st) st.pushes++
  // the part has already landed; now it's paid for. The push that crosses the line
  // still lands at full power, then he stops.
  const cost = r.strain + (pushed ? STRAIN_PER_PUSH : 0)
  if (cost > 0) addStrain(cost, hud.buttonPoint(def.slot))
  return r
})

/**
 * The only way strain goes up: pushes, parts that cost strain, bargains. It clamps
 * at the max and starts the stop the moment strain reaches it, so every path can end the run.
 */
function addStrain(n: number, from: { x: number; y: number }) {
  if (run.phase !== 'crawl' && run.phase !== 'stopping') return
  const before = run.strain
  run.strain = Math.min(STRAIN_MAX, run.strain + n)
  // one pip per point actually spent, flying from wherever it was spent
  hud.strainPips(run.strain - before, from)
  if (run.strain >= STRAIN_MAX && run.phase === 'crawl') beginStopping()
}

/** A world point on screen, in the HUD's pixels: where a pip leaves from. */
function screenOf(p: { x: number; z: number }, y = 1.2) {
  const v = new THREE.Vector3(p.x, y, p.z).project(world.camera)
  return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight }
}

/** Parts that move Still. No freeze before them: a pause right before the move is what made the dash look like a teleport. */
const MOVES = new Set<AbilityShape>(['dash', 'hop', 'anchor', 'rewind'])

function cast(def: AbilityDef, pushed: boolean): CastResult {
  castHits = 0
  const hpBefore = combat.hp
  const r = combat.useAbility(def, {
    origin: still.pos, facing: still.facing, moveX: hud.moveX, moveZ: hud.moveZ, pushed, strain: run.strain,
  })
  if (r.cooldown === 'refused') {
    sfx.denied()
    return r
  }
  // a rewind gave integrity back: the fill is seen, not just counted
  if (combat.hp > hpBefore + 0.5) hud.healing()
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
    case 'ricochet':
      vfx.flash(lens, COLD, 0.8)
      vfx.sparks(lens, COLD, 10, 7, fwd, 0.5)
      break
    case 'through':
      // the draw into the lens, then a near-instant line with a bright head along it
      vfx.gather(lens, 10, 0.6, COLD)
      vfx.flash(lens, COLD, 1.1)
      partFx.beam(at3(still.pos, 0), ahead(def.range, 0), 0.18, 0.2, 1.0)
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
    case 'signal':
      vfx.flash(lens, COLD, 0.6)
      vfx.sparks(lens, COLD, 6, 4, new THREE.Vector3(fwd.x, 0, fwd.z), 0.6)
      break
    case 'chill':
      // an exhale, not a shove: frost at the edge, and no dust because nothing is pushed
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD, 0.6)
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2
        vfx.frost(new THREE.Vector3(still.pos.x + Math.sin(a) * def.radius, 1.2, still.pos.z + Math.cos(a) * def.radius), 1, 0.3)
      }
      break
    case 'parry':
      // a small, plain snip; a cancel is loud, and comes with its own event
      vfx.sparks(ahead(1.2), COLD, 4, 4, fwd, 0.4)
      break
    case 'toss':
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
    case 'ward':
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD_DEEP, 0.6)
      // the edge of the zone on the floor too, closing on its size
      combat.ring(still.pos, def.radius + 0.1, def.radius, 0.3, 0x8fb8e8)
      break
    case 'mirror':
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD, 0.7)
      combat.ring(still.pos, def.radius + 0.1, def.radius, 0.3, 0xdfeaff)
      break
    case 'brace':
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD_DEEP, 0.8)
      vfx.dust(still.pos, 8, 0.6, new THREE.Color(0x55606c), 3)
      break
    case 'anvil':
      vfx.flash(still.jawL.getWorldPosition(new THREE.Vector3()), COLD, 0.4)
      break
    case 'lure':
      vfx.flash(still.core.getWorldPosition(new THREE.Vector3()), COLD, 0.8)
      vfx.flash(lens, COLD, 0.5)
      break
    case 'plant':
      // the bob let go at knee height
      vfx.flash(at3(still.pos, 0.5), COLD, 0.4)
      vfx.dust(still.pos, 5, 0.4, undefined, 2)
      break
    // movement fx ride on the move event
    default:
      break
  }
  if (pushed) vfx.sparks(at3(still.pos, 1.2), EMBER, 14, 4)
}

/** Patient Lens has banked a full shot, and the button has said so once. */
let patientFull = false
let patientMotes = 0
/** The anchor was out of snap reach last frame (the tick sounds once as it crosses). */
let anchorFar = false
let beaconT = 0
/** Ricochet's ready tick is recomputed this often, not every frame. */
let bankT = 0
/** Frayed Cleaver's width tier last frame; null while it isn't on a button. */
let frayTier: number | null = null

/**
 * What the buttons show about the parts on them, every frame: how much Patient
 * Lens has banked, how wide Frayed Cleaver will swing.
 */
function partFaces(dt: number) {
  const [head, , arms] = hud.slots.map((s) => s.def)
  // LIVE: something of his is out in the world, drawn as a lit ring that drains
  for (const slot of SLOT_NAMES) hud.live(slot, combat.liveFrac(slot))
  const legs = hud.slots[3]!.def
  // Plumb Line: the button becomes the snap while the anchor is out, and dims when a snap would be refused
  if (legs?.shape === 'anchor') {
    const a = combat.parts.anchor
    hud.iconState('legs', a ? 'snap' : null)
    const far = !!a && Math.hypot(a.pos.x - still.pos.x, a.pos.z - still.pos.z) > legs.range
    hud.setClass('legs', 'far', far)
    if (far && !anchorFar) sfx.tetherFar()
    anchorFar = far
  } else {
    anchorFar = false
  }
  // Borrowed Time: the pale segment on integrity, and the afterimage where a rewind would take him
  if (legs?.shape === 'rewind') {
    hud.recentDamage(combat.history.recentDamage((legs.windowMs ?? 1500) / 1000) / 100)
    partFx.echo(hud.isReady('legs') && run.phase === 'crawl' ? combat.history.at((legs.windowMs ?? 1500) / 1000) : null)
  } else {
    hud.recentDamage(0)
    partFx.echo(null)
  }
  // the decoy calling, panned to where it stands
  const d = combat.parts.decoy
  if (d && (beaconT -= dt) <= 0) {
    beaconT = 0.75
    sfx.decoyBeacon(panOf(d.pos))
  } else if (!d) {
    beaconT = 0
  }
  // Ricochet, ready, and the nearest target is behind cover: one tick where it would bank
  if (head?.mod?.kind === 'bounce' && hud.isReady('head') && run.phase === 'crawl') {
    if ((bankT -= dt) <= 0) {
      bankT = 0.1
      partFx.bankTick(combat.bankPreview(head, still.pos))
    }
  } else {
    partFx.bankTick(null)
  }
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
    still.ctx.charge = c
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

  // the body's side of LIVE: the lure went with the decoy, the bob with the anchor.
  // Polled after the decoy was cloned, so the decoy carries the lit lure and he doesn't.
  still.setLive('torso', !!combat.parts.decoy)
  still.setLive('legs', !!combat.parts.anchor)
  if (head?.mod?.kind === 'mark') {
    let marked = false
    for (const [, st] of combat.statuses()) if (st.markT > 0) marked = true
    still.ctx.marked = marked
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
  miteKills = 0

  if (run.phase === 'ending' || run.phase === 'boot') return

  if (run.phase === 'arriving' && !run.swapped) {
    // the words and the world fade out together; then the room
    run.t += realDt
    fade.style.opacity = String(Math.min(1, run.t / DESCEND_OUT))
    if (run.t >= DESCEND_OUT) {
      const e = run.ending ?? { kind: 'broken' as const, hour: 'afternoon' as const }
      enterRoom(e.kind, e.hour, save.lastEnding?.worn ?? hud.slots.map((sl) => sl.def?.id ?? null))
    }
    return
  }
  if (run.phase === 'arriving' || run.phase === 'workshop') {
    roomStep(realDt)
    return
  }
  if (run.phase === 'leaving') {
    run.t += realDt
    roomStep(realDt)
    fade.style.opacity = String(Math.min(1, run.t / DESCEND_OUT))
    if (run.t >= DESCEND_OUT) {
      startRun()
      fadeInT = DESCEND_IN
    }
    return
  }
  if (fadeInT > 0) {
    fadeInT = Math.max(0, fadeInT - realDt)
    fade.style.opacity = String(fadeInT / DESCEND_IN)
  }

  if (run.phase === 'homing') {
    homing(realDt)
    return
  }
  if (run.phase === 'toWalk' || run.phase === 'walkHome') {
    walkStep(realDt)
    return
  }

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
    // the colour drains from the hour's, not the base's: a stop at dusk goes from dusk
    world.gradePass.uniforms.uSaturation!.value = currentSat() * (1 - ease * 0.8)
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
  loot.update(dt, still.pos)
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

  if (run.phase === 'crawl') sampleStrain(dt)

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
    const def = combat.bossDef
    hud.bossBar(awakeBoss ? { name: def?.name ?? 'The Assembler', frac: boss.hp / (def?.hp ?? BOSS_HP), overloaded: boss.overloaded, stunned: boss.stunned } : null)
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
  // and so is home, the same way
  if (run.phase === 'crawl' && level?.home && level.homeOpen && Math.hypot(still.pos.x - level.home.x, still.pos.z - level.home.z) < EXIT_RADIUS) {
    beginHoming(level.home)
    return
  }

  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
}

/**
 * The walk into the warm beam: a scripted stick that brings him to its centre just
 * as the time runs out, at whatever pace that takes. The beam brightens and Grace's
 * light swells with it. Then the words; the walk home after the last depth comes later.
 */
function homing(dt: number) {
  run.t += dt
  const k = Math.min(1, run.t / HOMING_SECONDS)
  const ease = k * k * (3 - 2 * k)
  const dx = homingTo.x - still.pos.x
  const dz = homingTo.z - still.pos.z
  const d = Math.hypot(dx, dz)
  const pace = Math.min(1, d / (still.speed * Math.max(STEP, HOMING_SECONDS - run.t)))
  still.aim = null
  still.update(dt, d > 0.02 ? (dx / d) * pace : 0, d > 0.02 ? (dz / d) * pace : 0)
  if (!still.vaulting) combat.terrain.pushOut(still.pos, BODY_RADIUS)
  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
  if (level) level.homeGlow = 1 + ease
  world.graceLight.intensity = currentGrace() * (1 + 0.4 * ease)
  if (run.t < HOMING_SECONDS) return
  // before the last depth, the words; after it, the walk home first
  if (run.depth < RUN_DEPTHS) {
    end('home')
    return
  }
  run.phase = 'toWalk'
  run.t = 0
  run.swapped = false
}

/**
 * The walk home (§6.4): the last "level", at night, with nothing in it that can hurt
 * or cost him. HUD in walk mode (the stick, nothing else), so strain can't rise.
 */
function enterWalkHome() {
  level?.dispose()
  loot.clear()
  combat.reset()
  partFx.clear()
  stopAllWindups()
  level = generateWalkHome(Math.floor(Math.random() * 1e9), AREAS.find((a) => a.id === WALK_AREA)!)
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  combat.breakables = []
  still.pos.copy(level.entrance)
  still.facing = Math.PI
  prev.copy(still.pos)
  graceLean.set(0, 0, 0)
  applyDay(world, 'night')
  hud.mode('walk')
  hud.bossBar(null)
  hud.enabled = true
  sfx.restore(1)
}

/** The fade between the last warm beam and the walk, and the walk itself. */
function walkStep(dt: number) {
  if (run.phase === 'toWalk') {
    run.t += dt
    if (!run.swapped && run.t >= DESCEND_OUT) {
      run.swapped = true
      enterWalkHome()
    }
    const out = Math.min(1, run.t / DESCEND_OUT)
    const back = run.swapped ? Math.min(1, (run.t - DESCEND_OUT) / DESCEND_IN) : 0
    fade.style.opacity = String(run.swapped ? 1 - back : out)
    if (run.swapped && back >= 1) run.phase = 'walkHome'
    if (!run.swapped) return
  }
  still.update(dt, hud.moveX, hud.moveZ)
  if (!still.vaulting) combat.terrain.pushOut(still.pos, BODY_RADIUS)
  still.group.scale.lerp(new THREE.Vector3(1, 1, 1), Math.min(1, dt * 9))
  // in at the door: the Home words (the room fades in behind them on continue)
  const h = level?.house
  if (run.phase === 'walkHome' && h && Math.hypot(still.pos.x - h.door.x, still.pos.z - h.door.z) < WALK_DOOR_R) {
    hud.enabled = false
    end('home')
  }
}
/** The house's door zone (§4.25). */
const WALK_DOOR_R = 1.3

/** Footsteps: a step sounds each time a foot lands, quieter with distance. */
const lastStep = new Map<object, number>()
const STEP_HEAR = 16
/** Enemy steps in the last 120 ms (real time): at most three, nearest first, so a crowd's feet stay a rhythm. */
const stepTimes: number[] = []
const STEP_WINDOW = 0.12
const STEPS_MAX = 3
function footsteps(now: number) {
  // his own steps into the warm beam, and at home, still land; the held world's don't
  const home = inRoom()
  if (run.phase !== 'crawl' && run.phase !== 'homing' && run.phase !== 'walkHome' && !home) return
  const k = Math.floor(still.stride / Math.PI)
  // at home the boards start at the threshold; outside it is still stone
  if (still.walking && k !== lastStep.get(still)) sfx.step('still', 0, 1, home ? (still.pos.z >= -6 ? 'wood' : 'stone') : areaOf(run.depth).footsteps)
  lastStep.set(still, k)
  if (run.phase !== 'crawl') return
  while (stepTimes.length && now - stepTimes[0]! > STEP_WINDOW) stepTimes.shift()
  const quiet = hush()
  const dist = (e: Enemy) => Math.hypot(e.pos.x - still.pos.x, e.pos.z - still.pos.z)
  for (const e of [...combat.awake].sort((a, b) => dist(a) - dist(b))) {
    const d = dist(e)
    const ek = Math.floor(e.gait / Math.PI)
    if (d <= STEP_HEAR && e.walking && ek !== lastStep.get(e) && stepTimes.length < STEPS_MAX) {
      const who = e.kind === 'chaser' ? 'hulk' : e.kind === 'ranged' ? 'tripod' : e.kind === 'charger' ? 'ram' : 'boss'
      sfx.step(who, panOf(e.pos), (1 - d / STEP_HEAR) * (e.kind === 'chaser' ? Math.min(1, e.size) : 1) * quiet)
      stepTimes.push(now)
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

  if (paused || held) {
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
  still.group.position.x = x + still.nudge.x
  still.group.position.z = z + still.nudge.z

  // Grace's light drifts a little toward the exit: the light you carry points the way.
  // Once an Assembler is down, it points home.
  if (level && run.phase === 'crawl') {
    const to = LEAN_HOME && level.home && level.homeOpen ? level.home : level.exit
    const ex = to.x - x
    const ez = to.z - z
    const d = Math.hypot(ex, ez)
    const k = Math.min(1, d / 6) * GRACE_LEAN
    graceLean.lerp(tmpLean.set(d > 0.01 ? (ex / d) * k : 0, 0, d > 0.01 ? (ez / d) * k : 0), Math.min(1, elapsed * 2))
  }
  // on the walk home the light he carries leans to the door, and becomes the one inside the house
  const walk = level?.house && (run.phase === 'walkHome' || run.phase === 'toWalk' || (run.phase === 'ending' && !!level.house))
  if (walk && level?.house) {
    const h = level.house
    const ex = h.door.x - x
    const ez = h.door.z - z
    const d = Math.hypot(ex, ez)
    const k = Math.min(1, d / 6) * GRACE_LEAN
    graceLean.lerp(tmpLean.set(d > 0.01 ? (ex / d) * k : 0, 0, d > 0.01 ? (ez / d) * k : 0), Math.min(1, elapsed * 2))
    const inside = 1 - Math.min(1, Math.max(0, (d - 2) / 10))
    const e = inside * inside * (3 - 2 * inside)
    world.graceLight.position.set(x + graceLean.x, GRACE_Y, z + graceLean.z).lerp(h.inside, e)
  }
  // in the room Grace's light is the lamp, and stays where it hangs
  const home = inRoom()
  if (!home && !walk) world.graceLight.position.set(x + graceLean.x, GRACE_Y, z + graceLean.z)
  level?.update(now)

  shake = Math.max(0, shake - elapsed * 3.2)
  const awake = combat.awake
  const fighting = run.phase === 'crawl' && awake.length > 0
  if (home) {
    // a little toward the room's middle, and halfway to what he's standing at
    camTarget.copy(workshop.focus)
    rig.hold = workshop.hold
    rig.update(elapsed, camTarget, [], true)
  } else {
    camTarget.set(x, 0, z)
    // a locked or rushing lane's end is a threat too: an 11 u lane must never end off screen
    rig.update(elapsed, camTarget, [...awake.map((e) => e.pos), ...combat.laneEnds()], !fighting)
  }
  world.camera.position.copy(camTarget).add(camOffset)
  if (shake > 0) {
    const k = shake * shake * 0.9
    world.camera.position.x += (Math.random() - 0.5) * k
    world.camera.position.z += (Math.random() - 0.5) * k
    world.camera.position.y += (Math.random() - 0.5) * k
  }
  world.camera.lookAt(camTarget)

  const area = areaOf(run.depth)
  updateAmbience(home ? 'workshop' : level?.boss ? area.ambience.boss : area.ambience.crawl)
  const bossAwake = !!combat.boss && !combat.boss.dead && awake.includes(combat.boss)
  updateMusic({
    boss: bossAwake,
    overloaded: bossAwake && combat.boss!.overloaded,
    fighting,
    calm: !fighting,
    strain: run.strain / 20,
    home,
  })
  if (!paused) clock += elapsed * 1000
  drawEliteLabels()
  partFaces(elapsed)
  hud.update(clock)
  if (!paused) {
    vfx.update(elapsed, world.camera, world.renderer.domElement.height)
    ambientFx(elapsed)
    footsteps(now)
    ramFx(elapsed)
    broodFx(elapsed)
    skitter(elapsed)
    for (const [e, v] of loops) v.pan(panOf(e.pos))
  }
  syncTells()
  combat.miteBatch.sync(world.camera, now)
  world.render()
  // straight after the render, while the drawing buffer is still there
  drawings.afterRender(world.renderer.domElement)
  requestAnimationFrame(frame)
}

/**
 * Dev only: lets a headless browser drive and read the fight without guessing
 * from pixels. Checks run synchronously inside one evaluate, so the frame loop
 * can't step the world between setup and assert.
 */
/** One fixed step for the dev hooks: the world, the HUD clock and the button faces together. */
function devTick() {
  simulate(STEP)
  clock += STEP * 1000
  partFaces(STEP)
  hud.update(clock)
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __combat: combat, __still: still, __hud: hud, __loot: loot, __level: () => level, __world: world,
    __run: run, __parts: PARTS, __partLog: partLog, __pause: pause,
    /** Advance exactly `s` seconds of game time, and the HUD clock (and the button faces) with it. No rAF, no hitstop. */
    __step: (s: number) => {
      for (let i = 0; i < Math.round(s * 60); i++) devTick()
    },
    /** Step 1/60 s until pred() is true. Returns the seconds stepped, or −1 after maxS. */
    __until: (pred: () => boolean, maxS = 5) => {
      const n = Math.round(maxS * 60)
      for (let i = 0; i <= n; i++) {
        if (pred()) return i / 60
        if (i < n) devTick()
      }
      return -1
    },
    __enemyLog: enemyLog,
    /** The crowd's mix: live windup voices, the gain a new one would get, the hush. */
    __mix: { windups, windupGain, hush },
    /** A pack from members, like addPack. awake = true wakes it at once. */
    __pack: (members: { kind: Archetype; x: number; z: number }[], awake = true, elite?: EliteMod): Pack => {
      const pack = combat.addPack(members, false, elite ? { mod: elite, name: 'Test' } : undefined)
      if (awake) combat.wake(pack)
      return pack
    },
    /** A level's packs, generated and thrown away without entering it. */
    __gen: (depth: number, seed: number) => {
      const l = generateLevel(depth, seed, { boss: bossFor(depth) })
      const out = l.packs.map((p) => ({
        room: p.room.kind, rx: p.room.rx, rz: p.room.rz, kinds: p.members.map((m) => m.kind),
        elite: p.elite?.mod ?? null, name: p.elite?.name ?? null, lesson: !!p.lesson, budget: p.budget ?? null, template: p.template ?? null,
      }))
      l.dispose()
      return out
    },
    /** The same path a tap (false) or push (true) takes after the gesture: HUD cooldown, cast, strain. */
    __fire: (slot: SlotName, pushed = false) => hud.fireSlot(slot, pushed),
    /** Put a part on its button without the ground. */
    __equip: (id: string) => {
      const def = byId(id)
      swapIn(def)
      still.wear(def.slot, def)
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
      leaveRoom()
      fadeInT = 0
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
        level.homeOpen = false
        level.homeGlow = 1
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
      Object.assign(run, { phase: 'crawl', strain: 0, t: 0, fought: false, quietT: 0, killed: false, committed: false, ending: null })
      applyDay(world, 'morning')
      fade.style.opacity = '0'
      sfx.restore()
      hud.resetLoadout(hud.loadout)
      hud.setStick(0, 0)
      hud.bossBar(null)
      hud.enabled = true
      hitstop = 0
      partLog.length = 0
      enemyLog.length = 0
    },
    /**
     * A level's whole build, generated and thrown away: every kit instance's transform per
     * mesh (in build order), the breakables, the shrines, the rooms and the solids. For
     * proving a refactor of the generator changes nothing.
     */
    __genKit: (depth: number, seed: number) => {
      const l = generateLevel(depth, seed, { boss: bossFor(depth) })
      const r = (v: number) => Math.round(v * 1e4) / 1e4
      const out = {
        meshes: l.group.children.filter((o): o is THREE.InstancedMesh => o instanceof THREE.InstancedMesh).map((m) => ({
          count: m.count, verts: m.geometry.getAttribute('position').count, m: Array.from(m.instanceMatrix.array, r).join(','),
        })),
        breakables: l.breakables.map((b) => [r(b.x), r(b.z), r(b.r)]),
        shrines: l.shrines.map((sh) => [sh.kind, r(sh.x), r(sh.z)]),
        rooms: l.rooms.map((rm) => [rm.kind, rm.ci, rm.cj, rm.rx, rm.rz]),
        boss: l.boss ? [r(l.boss.x), r(l.boss.z)] : null,
        exit: [r(l.exit.x), r(l.exit.z)], entrance: [r(l.entrance.x), r(l.entrance.z)],
      }
      l.dispose()
      return out
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
    /** A level at this depth, now. From the room, it walks out first (no door, no fade). */
    __enter: (depth: number, seed?: number) => {
      if (inRoom() || run.phase === 'arriving' || run.phase === 'ending' || run.phase === 'toWalk' || run.phase === 'walkHome') {
        leaveRoom()
        overlay.hide()
        hud.mode('run')
        Object.assign(run, { phase: 'crawl', committed: false, ending: null })
        hud.enabled = true
        fade.style.opacity = '0'
      }
      enterLevel(depth, { seed })
    },
    /** Into the room now: an arrival (default idle) at an hour, wearing what he has on. */
    __workshop: (o: { arrival?: ArrivalKind; hour?: HomeHour } = {}) => {
      enterRoom(o.arrival ?? 'idle', o.hour ?? 'afternoon', hud.slots.map((sl) => sl.def?.id ?? null))
    },
    __near: () => workshop.near,
    __hold: (on: boolean) => { held = on },
    __drawings: () => ({ available: drawings.available, pending: drawings.pending }),
    __idbKeys: () => drawings.keys(),
    __idbBlob: (id: string) => drawings.get(id).then((b) => (b ? { size: b.size, type: b.type } : null)),
    /** A stored card, composed as the board draws it (with its drawing, when there is one). */
    __cardCanvas: async (id: string, w = 256, h = 192) => {
      const card = save.cards.find((c) => c.id === id)
      if (!card) return null
      const blob = await drawings.get(id)
      const bmp = blob ? await createImageBitmap(blob).catch(() => null) : null
      return composeCard(card, bmp, w, h)
    },
    /** The crayon pass on the current frame, by a child, now (look checks). Returns a data URL. */
    __crayonNow: (by: 'yanah' | 'yuri', seed = 1, kind: EndingKind = 'home') => {
      world.render()
      const c = world.renderer.domElement
      const src = document.createElement('canvas')
      const crop = HANDS[by].crop
      const sh = Math.min(c.height * crop, (c.width * crop) / CARD_ASPECT), sw = sh * CARD_ASPECT
      src.width = 512
      src.height = Math.round((512 * sh) / sw)
      src.getContext('2d')!.drawImage(c, (c.width - sw) / 2, (c.height - sh) / 2, sw, sh, 0, 0, src.width, src.height)
      const m0 = momentOf(kind)
      const fx = sw / c.width, fy = sh / c.height
      const into = (p: { x: number; y: number }) => ({ x: (p.x - (1 - fx) / 2) / fx, y: (p.y - (1 - fy) / 2) / fy })
      const m = { ...m0, still: into(m0.still), house: m0.house ? into(m0.house) : undefined }
      return { drawn: drawings.draw(src, by, seed, m).toDataURL('image/png'), frame: src.toDataURL('image/png') }
    },
    __now: (iso: string | null) => { nowOverride = iso ? new Date(iso + (iso.length <= 10 ? 'T12:00:00' : '')) : null },
    __marks: () => {
      updateDoorMarks()
      workshop.refresh(save)
      return workshop.markCounts
    },
    /** The hour on now, and what it set. */
    __day: () => ({
      day: dayNow().key, hour: dayNow().hour, sat: world.gradePass.uniforms.uSaturation!.value, fogNear: world.fog.near, fogFar: world.fog.far,
      keyLight: world.key.intensity, grace: world.graceLight.intensity, keyColor: world.key.color.getHex(), fogColor: world.fog.color.getHex(),
    }),
    __DAY: DAY,
    __grade: grade,
    /** The grade panel's apply: the base moves, the hour goes back on top. */
    __applyGrade: () => applyGrade(world),
    __hourAtEnd: hourAtEnd,
    __fogAt: fogAt,
    __dayAt: dayAt,
    __AREAS: AREAS,
    /** Put any hour on the world now (look checks). */
    __applyDay: (k: keyof typeof DAY, hour?: HomeHour) => applyDay(world, k, hour),
    __bossFor: bossFor,
    __areaOf: (d: number) => areaOf(d).id,
    __zones: () => workshop.zones.map((z) => ({ id: z.id, anchor: z.anchor })),
    /** toggleTurn through the rules, saved and shown as the card's button would. */
    __turn: (id: string) => {
      const ok = toggleTurn(save, id)
      if (ok) {
        store.write()
        workshop.refresh(save)
        renderChooser()
      }
      return ok
    },
    /** The ChooserSpec the wall's section would show (with `sel` picked). */
    __wallCard: (slot: SlotName, sel: string | null = null) => workshop.cardFor(`wall:${slot}`, save, sel),
    __hookCard: (sel: string | null = null) => workshop.cardFor('hook', save, sel),
    /** Tap a chooser icon / press the card's action. */
    __choose: (id: string) => {
      chooserSel = id
      renderChooser()
    },
    __interact: () => chooserAction(),
    __chooser: () => (chooserAt ? workshop.cardFor(chooserAt as 'hook' | `wall:${SlotName}`, save, chooserSel) : null),
    __traces: () => workshop.traces,
    /**
     * The loot rules as the older checks call them: (from, taken, source, excludeSlot?).
     * With no pool given, every part counts as found and nothing reaches for the
     * unfound, which is exactly the draw before the pool existed. __rollMany tests the pool.
     */
    __lootRules: {
      rollPart: (from: Archetype, taken: readonly AbilityDef[], source: DropSource, excludeSlot?: SlotName, view?: PoolView) =>
        rollPart(from, taken, source, view ?? { found: new Set(PARTS.map((p) => p.id)), turned: new Set(), depth: 1 }, excludeSlot),
      dropChance,
    },
    /** A deep copy of the live save. */
    __save: () => JSON.parse(JSON.stringify(save)) as SaveV1,
    /** Merge a patch into the live save and write it; null starts a fresh one (the stored copy too). */
    __setSave: (patch: Partial<SaveV1> | null) => {
      if (patch === null) store.reset()
      else {
        Object.assign(save, patch)
        store.write()
      }
    },
    __store: () => store.mode,
    /**
     * n draws from one source at one depth through the real rollPart and the live
     * pool. source 'fill' is fillEmpty with every slot empty (only its hits count).
     */
    __rollMany: (o: { source: DropSource | 'fill'; depth: number; n: number; from?: Archetype }) => {
      const view = poolView(save, o.depth)
      const ids: Record<string, number> = {}
      let unfound = 0, got = 0
      for (let i = 0; i < o.n; i++) {
        const def = o.source === 'fill'
          ? fillEmpty([], SLOT_NAMES)
          : rollPart(o.from ?? (o.source.startsWith('boss') ? 'boss' : 'chaser'), [], o.source, view)
        if (!def) continue
        got++
        ids[def.id] = (ids[def.id] ?? 0) + 1
        if (!view.found.has(def.id)) unfound++
      }
      return { ids, unfound, got }
    },
    /** A part on the floor exactly at (x, z), flying in from just beside it. */
    __dropAt: (id: string, x: number, z: number) => {
      loot.drop(byId(id), new THREE.Vector3(x + 0.6, 0, z))
      loot.ground[loot.ground.length - 1]!.pos.set(x, 0, z)
    },
    /** The pickup card's take. */
    __take: () => {
      const g = offered
      if (g) takePart(g)
      return !!g
    },
    /** What the pickup card is offering. history arrives with "parts remember". */
    __offer: () => (offered ? { id: offered.def.id, name: offered.def.name, tag: save.found.includes(offered.def.id) ? null : 'new', history: null } : null),
    /**
     * The largest save the rules allow: every part found, all 43 of still's roster
     * met (its real ids), six leaders of the longest name the generator can make on
     * each elite page, 36 cards, a snapshot.
     */
    __fillSave: () => {
      const all = PARTS.map((p) => p.id)
      const hist = Object.fromEntries(all.map((id) => [id, [999, 6, 999, 999, 999, 999]])) as SaveV1['history']
      const line = (n: number) => 'k'.repeat(n)
      const ROSTER_IDS = [
        'wandering-drone', 'rust-guard', 'corroded-sentry', 'fracture-mite', 'iron-crawler', 'glitch-node', 'sentinel-shard', 'hollow-repeater',
        'drifting-frame', 'echo-construct', 'thermal-scanner', 'signal-jammer', 'vault-keeper', 'corrupted-overseer', 'fracture-titan',
        'the-first-warden', 'thermal-leech', 'wire-jammer', 'slag-heap', 'feedback-loop', 'phase-drone', 'furnace-tick', 'static-frame',
        'conduit-spider', 'overcharge-sentinel', 'lockdown-warden', 'meltdown-core', 'the-thermal-arbiter', 'thorn-sentinel', 'feedback-drone',
        'strain-siphon', 'overload-core', 'fracture-fragment', 'fracture-host', 'echo-shell', 'void-leech', 'strain-parasite', 'fury-core',
        'ward-pylon', 'raging-hull', 'phase-wraith', 'drain-frame', 'martyr-shell',
      ]
      const ELITE_PAGES = new Set(['vault-keeper', 'corrupted-overseer', 'fracture-titan', 'overcharge-sentinel', 'lockdown-warden', 'meltdown-core'])
      const notebook: SaveV1['notebook'] = {}
      for (const id of ROSTER_IDS) {
        notebook[id] = { f: '2026-09-25', m: 9999, k: 99999, d: 6 }
        if (ELITE_PAGES.has(id)) notebook[id]!.l = Array.from({ length: LEADERS_MAX }, () => 'Guttermother the Warden')
      }
      const cards = Array.from({ length: CARD_KEEP }, (_, i) => ({
        id: newRunId(), n: 900 + i, date: '2026-09-25', end: 'stopped' as const, depth: 6, hour: 'afternoon' as const, by: drawerFor(i + 1),
        worn: ['through-line', 'mirror-ward', 'frayed-cleaver', 'borrowed-time'],
        ...(i >= CARD_KEEP - CARD_LINES ? { line: line(96), marks: [0, 16, 32, 48, 64, 80] } : {}),
      }))
      const tally: RunTally = {
        ...freshTally(), carried: all, deepest: Object.fromEntries(all.map((id) => [id, 6])), assemblers: Object.fromEntries(all.map((id) => [id, 2])),
        line: line(191), marks: [0, 32, 64, 96, 128, 160], win: 20, winT: 4.99, pushes: 9999, quiets: 9999,
      }
      Object.assign(save, {
        firstRunAt: new Date().toISOString(), runs: 9999, found: all, turned: ['flare', 'ward', 'piston', 'skitter'], hook: 'focusing-lens',
        pendingHook: { candidates: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] }, history: hist, notebook, cards,
        lastEnding: { kind: 'stopped', hour: 'afternoon', depth: 6, worn: cards[0]!.worn, cardId: cards[0]!.id, arrived: true },
        run: {
          s: 1, build: new Date().toISOString(), id: newRunId(), startedAt: new Date().toISOString(), depth: 6, seed: 999999999,
          bossFelled: true, bossLoot: ['through-line', 'borrowed-time'], strain: 19, loadout: cards[0]!.worn, tally,
        },
        hints: all, doorMarks: 48,
      } satisfies Partial<SaveV1>)
    },
    __mode: () => run.phase,
    /** The level's beams, read off its scene: a beam that was never built is null. */
    __exits: () => {
      const beam = (name: string, at: THREE.Vector3 | null, open: boolean) =>
        level?.group.getObjectByName(name) && at ? { x: at.x, z: at.z, open } : null
      return {
        cold: level ? beam('beam:cold', level.exit, level.exitOpen) : null,
        warm: level ? beam('beam:warm', level.home, level.homeOpen) : null,
        meshes: level ? level.group.children.filter((o) => o.name.startsWith('beam:')).length : 0,
      }
    },
    __exitsAfterBoss: exitsAfterBoss,
    /** The boss takes its remaining HP through the same hit a part lands; it's buried, and onKill fires, on the next step. */
    __killBoss: () => {
      const b = combat.boss
      if (!b || b.dead) return false
      b.hit(b.hp / (b.armor * (b.stunned ? 1.5 : 1)) + 1e-6)
      return true
    },
    __strain: (n: number) => addStrain(n, { x: window.innerWidth / 2, y: window.innerHeight / 2 }),
    /**
     * An ending, the game's way, and one step so its trigger has fired on return:
     * HP to 0; strain to full; into the warm beam. Without a warm beam to walk
     * into (a crawl depth, or __arena's floor), he homes where he stands: a
     * shortcut for checks that aren't about the beam.
     */
    __end: (kind: EndingKind) => {
      if (run.phase !== 'crawl') return false
      if (kind === 'broken') {
        combat.hp = 0
        devTick()
      } else if (kind === 'stopped') {
        addStrain(STRAIN_MAX - run.strain, { x: window.innerWidth / 2, y: window.innerHeight / 2 })
      } else if (level?.home && level.group.visible) {
        level.openHome()
        still.pos.set(level.home.x, 0, level.home.z)
        devTick()
      } else {
        beginHoming(still.pos)
      }
      return true
    },
    __continue: () => overlay.press(),
    /** Per depth this run: pushes, quiets, and strain in and out. The open depth reads its strain now. */
    __runStats: () => run.stats.map((st) => ({ ...st, strainOut: st.strainOut ?? run.strain })),
  })
}

/**
 * Boot (§3.1): a dev run goes straight to its depth; the very first boot goes into
 * the maze; an ending whose way in never finished plays it again; anything else
 * opens the room as he left it. Resuming a run at its last beam comes later.
 */
void loadKit().then(() => {
  workshop = createWorkshop(world, still, vfx, drawings)
  const last = save.lastEnding
  if (DEPTH_PARAM !== null || (save.runs === 0 && FIRST_RUN_IN_MAZE)) startRun()
  else if (last && !last.arrived) enterRoom(last.kind, last.hour, last.worn)
  else enterRoom('idle', last?.hour ?? 'afternoon', last?.worn ?? [null, null, null, null])
  requestAnimationFrame(frame)
})
