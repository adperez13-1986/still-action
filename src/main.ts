import './style.css'
import * as THREE from 'three'
import { createWorld, grade } from './world'
import { Still } from './still'
import { createHud, type Press } from './hud'
import { createGradePanel, apply as applyGrade } from './grade'
import { Combat, eliteLine, type Archetype, type CastResult, type EliteMod, type Pack } from './combat'
import { STARTING, PARTS, byId, type AbilityDef, type AbilityShape, type BeatKey } from './abilities'
import { SLOT_NAMES, type SlotName } from './still'
import type { Enemy, EnemyEvent } from './enemy'
import { isBoss, Assembler } from './boss'
import { Arbiter, ARBITER, arbiterHusk } from './arbiter'
import { DayTracker } from './day'
import type { HazardSpec } from './hazard'
import { Line, LINE, type LineEvent, type Train } from './line'
import { RANGED } from './ranged'
import { LOBBER } from './lobber'
import { Thief, type ThiefEvent, type ThiefWorld } from './thief'
import { Charger, CHARGER, PLATE as RAM_PLATE } from './charger'
import { HIDES, debrisColor } from './hide'
import { Mite, BROOD, type Brood } from './swarm'
import * as sfx from './audio'
import { createCameraRig } from './camera'
import { updateMusic, musicNow } from './music'
import { updateAmbience } from './ambience'
import { Loot, LOOT, dropChance, rollPart, type GroundPart } from './loot'
import { createPauseScreen } from './pause'
import { createOverlay } from './ending'
import { loadKit, setSurfaces, pieceData, surfaceNow, buildInstanced, PIECES, type Piece } from './kit'
import { generateCrossroads, dressRoad, labelAlpha, RoadSmoke, ROAD_LABEL, CROSSROADS, type Dressing } from './crossroads'
import { generateLevel, generateWalkHome, makeTerrain, key, squarePosts, type Box, type Breakable, type Circle, type Level, type Post, type Room, type Shrine } from './dungeon'
import type { Terrain } from './terrain'
import { Vfx, syncTells, COLD, COLD_DEEP, EMBER, SLAG_DROP } from './vfx'
import { PartFx } from './partfx'
import type { PartEvent } from './parts'
import type { NotebookPage } from './pause'
import {
  RUN_DEPTHS, BOSS_EVERY, LEAN_HOME, FIRST_RUN_IN_MAZE, DAY, exitsAfterBoss, hourAtEnd, bossFor, areaOf,
  applyDay, dayNow, currentSat, currentGrace, fogAt, dayAt, AREAS, PLACES, WALK_PLACE, ASSEMBLER_DEF, ARBITER_DEF, ENGINE_DEF, ARBITER_AT_6, lookAt, applyDayAt,
  DAY_SPAN, DAY_FX, flag, setFlags, flagsNow, roadChoice,
  type BossDef, type BossKind, type HomeHour, type PlaceDef, type RouteId,
} from './areas'
import { createWorkshop, MARKS_MAX, type ArrivalKind, type InteractId, type Workshop } from './workshop'
import { createDrawings, HANDS, CARD_ASPECT, type Moment } from './crayon'
import { composeCard } from './cards'
import { openSave, freshTally, localDate, drawerFor, trimCards, CARD_KEEP, CARD_LINES, LEADERS_MAX, type EndingKind, type RunSnapshot, type RunTally, type Save } from './save'
import { poolView, markFound, hookCandidates, facingOutWhites, toggleTurn, hang, applyHookDefault, startPart, partName, historyLine, type PoolView } from './pool'
import { assignNames, elitePage, meet, addLeader, ROSTER, ROSTER_BY_ID, WHAT, BOSS_PAGE, FRAGMENT_PAGE, LOBBER_PAGE, HEAP_PAGE, THIEF_PAGE, namesFor } from './notebook'
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
/** DEV only: a URL param as given, or null (production builds never read them). */
const devParam = (k: string): string | null => (import.meta.env.DEV ? params.get(k) : null)
/** `?route=II|III` (DEV): the run starts on that road and never sees the crossroads; with ?depth=4-6 it starts there. */
const ROUTE_PARAM: RouteId | null = devParam('route') === 'III' ? 'III' : devParam('route') === 'II' ? 'II' : null
/** `?crossroads=1` (DEV): the crossroads after the Assembler, whatever the switch and the save say. */
const CROSSROADS_PARAM = devParam('crossroads') === '1'

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
/** Still's clamp: the steel a blow on it chips. */
const STEEL = new THREE.Color(0x7a8592)
const STONE = new THREE.Color(0x5a5550)
/** The quarter's brick, for the chips off a cracking post. */
const BRICK = new THREE.Color(0x6a3a2c)
const WOOD = new THREE.Color(0x6b4a30)
/** What each body breaks into: its own metal (hide.ts). */
const HULK_C = debrisColor('hulk')
const SENTINEL_C = debrisColor('sentinel')
const LOBBER_C = debrisColor('lobber')
const RAM_C = debrisColor('ram')
const RAM_JOINT_C = new THREE.Color(HIDES.ram.joint)
const PLATE_C = new THREE.Color(RAM_PLATE)
const MITE_C = debrisColor('mite')
const THIEF_C = debrisColor('thief')
function metalOf(e: Enemy | undefined): THREE.Color {
  if (!e) return HULK_C
  if (e.kind === 'ranged') return (e as { variant?: string }).variant === 'lobber' ? LOBBER_C : SENTINEL_C
  return e.kind === 'charger' ? RAM_C : e.kind === 'swarm' ? MITE_C : e.kind === 'thief' ? THIEF_C : HULK_C
}
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
  onKill: (at, kind, pack, wasElite, summoned, weight, e) => {
    run.killed = true
    felled(kind, pack, wasElite, summoned, weight, pageOf(e, pack))
    if (kind === 'boss') {
      bossDown(at)
      return
    }
    if (kind === 'swarm') {
      // a pop, not a crunch: a few coal flecks, embers, no dust. Eight of them are still one crunch.
      vfx.chunks(at3(at, 0.2), 3, MITE_C, 3.5, 0.08)
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
      // the boiler's last breath: bronze, the two hatch plates thrown high, smoke rising
      vfx.chunks(at3(at, 0.8), 14, RAM_C, 5.5, 0.18)
      vfx.chunks(at3(at, 1.0), 2, RAM_JOINT_C, 6, 0.3)
      vfx.sparks(at3(at, 0.9), EMBER, 18, 6)
      vfx.flash(at3(at, 0.9), EMBER, 1.0)
      vfx.dust(at, 10, 1.0)
      vfx.smokePuff(at3(at, 1.0), 3)
      sfx.ramDeath(panOf(at))
      const mod = wasElite ? pack.elite?.mod : undefined
      if (mod === 'plated') vfx.chunks(at3(at, 0.8), 4, PLATE_C, 5, 0.26)
      if (mod === 'splitting') {
        // it cracks along its seam into the two that were in it
        vfx.chunks(at3(at, 0.8), 6, RAM_C, 5, 0.14)
        sfx.ramSplit(panOf(at))
      }
      shake = Math.max(shake, 0.3)
    } else {
      // it comes apart: chunks of its own metal, a burst of embers, a puff of grit
      vfx.chunks(at3(at, 0.8), 12, metalOf(e), 5.5, 0.18)
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
    if (ev.kind === 'land') landFx(ev.at, ev.what, ev.enemy)
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
      if (ev.push) {
        const st = run.stats[run.stats.length - 1]
        if (st) st.breaks++
        // a ram broken by a push reels with its hatch open: dazed, and the slam when it shuts
        const c = ev.enemy
        if (c instanceof Charger && c.stunned && run.phase === 'crawl') loops.set(c, sfx.dazed(CHARGER.reelMs, panOf(c.pos)))
      }
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
  onSmash: (b, rolls = true) => {
    level?.smash(b)
    const at = new THREE.Vector3(b.x, 0, b.z)
    combat.burst(at, 0xb89a7a)
    sfx.smash(panOf(at))
    vfx.chunks(at3(at, 0.5), 14, WOOD, 4.5, 0.16)
    vfx.dust(at, 10, 0.7, new THREE.Color(0x6a5a48))
    shake = Math.max(shake, 0.12)
    // a train-smashed crate rolls nothing (design/area3/SPEC.md §5.7)
    if (!rolls) return
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
  onWake: (at, pack) => {
    metPack(pack)
    vfx.embers(at3(at, 0.8), 14, 1.2)
    sfx.alert(panOf(at))
    rig.punch(-0.02)
  },
  onWindup: (e, ms) => {
    // once Still is stopping, the world is slowing with him; a real-time tell would lie
    if (run.phase !== 'crawl') return
    // the thief never winds up: it has no voice here
    if (e.kind === 'thief') return
    breakHint(e)
    if (isBoss(e)) {
      // the Assembler shifts its weight into every move: pressure let into its rams
      if (e instanceof Assembler) sfx.hydraulic('lift', panOf(e.pos), hush())
      // aimed moves whistle and click like the sentinel; heavy ones rise like the hulk
      const cue = e.cue
      if (cue.voice === 'aim') windups.set(e, sfx.asVoice(sfx.aim(ms, cue.lockAt, panOf(e.pos), windupGain())))
      else if (cue.voice === 'windup') windups.set(e, sfx.asVoice(sfx.windup(ms, panOf(e.pos), windupGain())))
      else if (cue.voice === 'lob') windups.set(e, sfx.asVoice(sfx.lobAim(ms, panOf(e.pos), windupGain())))
      return
    }
    if (e.kind === 'charger') {
      windups.set(e, sfx.rev(ms, CHARGER.lockAt, panOf(e.pos), windupGain()))
      return
    }
    // the Lobber's crucible creaks back as it aims; there's no line to click
    const stop = e.variant === 'lobber' ? sfx.lobAim(ms, panOf(e.pos), windupGain())
      : e.kind === 'ranged' ? sfx.aim(ms, RANGED.lockAt, panOf(e.pos), windupGain()) : sfx.windup(ms, panOf(e.pos), windupGain())
    windups.set(e, sfx.asVoice(stop))
  },
  onStrike: (e) => {
    windups.delete(e)
    // the rush roars on and follows the ram across the screen
    if (e.kind === 'charger') {
      if (run.phase === 'crawl') loops.set(e, sfx.rush(panOf(e.pos)))
    } else if (e.variant === 'lobber') {
      sfx.mortar(panOf(e.pos))
      sfx.whistle(LOBBER.flightMs, panOf(e.pos))
    } else if (e.kind === 'ranged') sfx.fire(panOf(e.pos))
    else if (e instanceof Arbiter) {
      if (e.strikeKind === 'lance') sfx.lanceFire(panOf(e.pos))
      else if (e.strikeKind === 'shell') {
        sfx.mortar(panOf(e.pos))
        sfx.whistle(ARBITER.shell.flightMs, panOf(e.pos))
      } else sfx.scald(panOf(e.pos))
    } else sfx.strike(panOf(e.pos))
    strikeFx(e)
  },
  onHazard: (ev) => {
    if (ev.kind === 'heat') {
      // the lance reached him: one button goes hot, push-only for 4 s
      const slot = pickHeat()
      if (slot) {
        hud.heat(slot, ARBITER.heat.ms)
        sfx.sizzle()
        vfx.sparks(at3(still.pos, 1.1), EMBER, 10, 3)
      }
      return
    }
    const s = ev.h.spec.shape
    const slag = ev.h.spec.source === 'slag'
    // a train hitting Still (§5.5): the ram's crash without its bell, and a harder punch
    if (ev.kind === 'hit' && ev.h.spec.source === 'train' && ev.h.spec.damage > 0) {
      if (ev.who === 'still') {
        sfx.ramCrash(panOf(ev.at), false)
        shake = Math.max(shake, 0.5)
        hitstop = Math.max(hitstop, 0.08)
        rig.punch(0.06)
      }
      vfx.sparks(at3(ev.at, 0.8), EMBER, 10, 6)
      return
    }
    if (s.kind !== 'circle') return
    if (ev.kind === 'spawn' && slag) {
      // the core breaks open where it fell
      sfx.slagSpill(panOf(at3(s, 0)))
      vfx.sparks(at3(s, 0.3), SLAG_DROP, 8, 3)
    }
    if (ev.kind !== 'arm') return
    // the arm: the floor catches; a shell comes down in stone and dust
    if (slag) sfx.slagArm(panOf(at3(s, 0)))
    if (ev.h.spec.source === 'shell') {
      sfx.shellLand(panOf(at3(s, 0)))
      vfx.dust(at3(s, 0), 18, s.r, undefined, 5)
      vfx.chunks(at3(s, 0.3), 8, STONE, 4, 0.12)
      vfx.flash(at3(s, 0.3), EMBER, 1.2)
      shake = Math.max(shake, 0.2)
    }
    vfx.embers(at3(s, 0.1), Math.round(4 + s.r * 3), s.r * 0.8)
  },
  onThief: (ev) => thiefEvent(ev),
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
      for (const m of ev.brood.biters) breakHint(m)
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
    case 'shed':
      // one mite out of the slag heap: a spit of embers off its coal, and a pop
      vfx.embers(at3(ev.at, 0.15), 6, 0.3)
      sfx.pop(panOf(ev.at))
      break
    case 'arbiter':
      arbiterBeat(ev)
      break
    case 'lock':
      // the Arbiter's aim sets with a clank of its brake (the others' locks are in their windup voices)
      if (ev.e instanceof Arbiter) sfx.servoLock(panOf(ev.e.pos))
      break
  }
}

/** The Arbiter's instants: its gaze catching, the ratchet of its sweep, a judder, a post cracking, the scald. */
function arbiterBeat(ev: Extract<EnemyEvent, { kind: 'arbiter' }>) {
  const pan = panOf(ev.at)
  switch (ev.what) {
    case 'catch':
      sfx.catchClack(pan)
      break
    case 'ratchet':
      sfx.ratchet(pan)
      break
    case 'phase2':
      sfx.judder(ARBITER.phase2.judderMs, panOf(ev.e.pos))
      shake = Math.max(shake, 0.5)
      break
    case 'judder':
      sfx.judder(ev.ms ?? ARBITER.phase2.reverseJudderMs, pan)
      break
    case 'crack':
      // chips at one and two lances; at three it breaks
      vfx.sparks(ev.at, EMBER, 8, 5)
      vfx.chunks(ev.at, (ev.ms ?? 1) >= ARBITER.phase2.crackAt ? 16 : 5, BRICK, 5, 0.14)
      if ((ev.ms ?? 1) >= ARBITER.phase2.crackAt) {
        sfx.crack(pan)
        vfx.dust(ev.at, 20, 1.6, undefined, 4)
        shake = Math.max(shake, 0.35)
      }
      break
    case 'scald':
      vfx.dust(ev.at, 26, ARBITER.scald.r, new THREE.Color(0x6f7780), 5)
      break
    case 'vent':
    case 'ventEnd':
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
/** The Arbiter's sweep is heard while it turns, following its gaze; a button cooling off is heard too. */
let whirr: sfx.Voice | null = null
function arbiterFx() {
  const b = combat.boss
  const sweeping = run.phase === 'crawl' && b instanceof Arbiter && !b.dead && combat.awake.includes(b) && b.sweeping
  if (sweeping && !whirr) whirr = sfx.whirr(panOf((b as Arbiter).gazePoint(new THREE.Vector3())))
  if (!sweeping && whirr) {
    whirr.stop()
    whirr = null
  }
  if (sweeping && whirr) {
    whirr.pan(panOf((b as Arbiter).gazePoint(tmpGaze)))
    // its servo's whine follows how fast the head is turning, 1 at the sweep's own rate
    whirr.speed?.((b as Arbiter).turnSpeed / (ARBITER.wedge.degPerS * Math.PI / 180))
  }
  for (const sl of hud.slots) {
    const hot = hud.heatLeft(sl.slot) > 0
    if (!hot && hotSlots.has(sl.slot)) sfx.cool()
    if (hot) hotSlots.add(sl.slot)
    else hotSlots.delete(sl.slot)
  }
}
const tmpGaze = new THREE.Vector3()

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

/** The face into a wall: stone off the wall, bronze off the ram, a fan of sparks thrown back along the lane. */
function ramImpact(c: Charger, at: THREE.Vector3, wall: boolean) {
  const p = at3(at, 0.4)
  const back = aim3(c).negate()
  if (wall) vfx.chunks(p, 10, STONE, 5, 0.14)
  vfx.chunks(p, 3, RAM_C, 4, 0.12)
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
function landFx(at: THREE.Vector3, what: 'flare' | 'signal' | 'throw' | 'wall', e?: Enemy) {
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
      vfx.chunks(at3(at, 0.4), 4, metalOf(e), 4, 0.12)
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
  } else if (e.variant === 'lobber') {
    // the shell leaves the crucible's mouth: a puff of smoke and sparks thrown up
    const mouth = at3(e.pos, 1.5 * e.size)
    vfx.flash(mouth, EMBER, 0.6)
    vfx.sparks(mouth, EMBER, 8, 4, new THREE.Vector3(0, 1, 0), 0.8)
    vfx.smokePuff(mouth, 3)
  } else if (e.kind === 'ranged') {
    const dir = new THREE.Vector3(still.pos.x - e.pos.x, 0, still.pos.z - e.pos.z).normalize()
    const muzzle = at3(e.pos, 1.45).addScaledVector(dir, 0.95)
    vfx.flash(muzzle, EMBER, 0.7)
    vfx.sparks(muzzle, EMBER, 9, 7, dir, 0.4)
    vfx.smokePuff(muzzle, 2)
  } else if (isBoss(e)) e.strikeFx(vfx)
}

// --- the run: a descent through generated levels, and the two ways it ends ---

const STRAIN_MAX = 20
const STRAIN_PER_PUSH = 2
/** How long Still takes to stop. The sound, the zoom and the colour all run on this. */
const STOP_SECONDS = 3.4
/**
 * Broken: sudden, then slow. The blow freezes the frame, the parts fly apart at a quarter
 * of speed with the eye going out, then time snaps back and they hit the stone for real.
 * Stopping owns the slow wind-down; this is one instant, stretched and dropped.
 */
/** Every ending's frame is a close-up of him, whatever happened: the view closes in this much. */
const END_ZOOM = 0.45
const BREAK = { freeze: 0.22, slow: 1.3, scale: 0.26, ramp: 0.2, after: 0.75 }
const BREAK_SECONDS = BREAK.slow + BREAK.ramp + BREAK.after
/** Seconds between the cold sparks each flying part sheds while time is slow. */
const BREAK_TRAIL = 0.05
let breakTrailT = 0
/** How many broken parts have hit the floor: the first lands heavy. */
let breakLanded = 0
/** The fade down to the next depth: out, swap the level, back in. */
const DESCEND_OUT = 0.45
const DESCEND_IN = 0.5
const EXIT_RADIUS = 1.4
/**
 * A beam that opens under him doesn't take him: the boss can fall with Still standing where
 * a beam lights. It waits until he's stepped this far out, so walking in is always a choice.
 */
const BEAM_REARM = EXIT_RADIUS + 0.4
const beamArmed = { exit: true, home: true }
function armBeams() {
  if (!level) return
  beamArmed.exit = Math.hypot(still.pos.x - level.exit.x, still.pos.z - level.exit.z) >= EXIT_RADIUS
  beamArmed.home = !level.home || Math.hypot(still.pos.x - level.home.x, still.pos.z - level.home.z) >= EXIT_RADIUS
}
/** The walk into the warm beam, before the words. The world holds while he takes it. */
const HOMING_SECONDS = 0.6

/**
 * boot until the kit is in; workshop is the room, leaving the fade out of it into
 * a run; crawl and descending as ever; broken, stopping and homing are the three
 * terminal sequences (the ending is already kept by then); ending is the words,
 * and arriving the way into the room.
 */
type Phase = 'boot' | 'workshop' | 'leaving' | 'crawl' | 'descending' | 'broken' | 'stopping' | 'homing' | 'toWalk' | 'walkHome' | 'ending' | 'arriving'

/**
 * One depth of a run, for __runStats: the phone test measures whether Stopped is reachable at all.
 * deadTaps: taps thrown at a cooling button. Against pushes, a fight at a time, it says whether
 * the want is there and the screen hid it, or never comes up. breaks: windups a push broke under
 * the break rule (each biter of a surge counts).
 */
interface DepthStats { depth: number; fights: number; pushes: number; breaks: number; deadTaps: number; quiets: number; strainIn: number; strainOut: number | null }
/** One press on a filled button, for the playtest file: how long taps really last on the phone. */
interface TapLog { depth: number; slot: SlotName; ms: number; ready: boolean; result: Press['result'] }

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
  /** The break rule for this run's playtest entry: as it began, or 'mixed' once flipped mid-run. */
  breakRule: false as boolean | 'mixed',
  /** Where this fight's strain began: the free push is drawn above it. */
  water: 0,
  taps: [] as TapLog[],
  /** ISO: when this run began (its snapshot carries it). */
  startedAt: '',
  /** This level's seed: a resume builds the same layout. */
  seed: 0,
  /** This depth's boss is down (a resume opens the beams, no boss), and what it dropped. */
  bossFelled: false,
  bossLoot: [] as string[],
  /**
   * The road through depths 4-6 (design/area3/SPEC.md §3). null until it's chosen: at the
   * Assembler's descend, or in the crossroads. Depths 1-3 ignore it; null reads as 'II'.
   */
  route: null as RouteId | null,
  /** This level's names (§7.2), and the ones already counted as met here. */
  names: {} as Partial<Record<Archetype, string>>,
  met: new Set<string>(),
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
  // in the room, the board's card opens the look-back screen, and the notebook's opens the book
  if (run.phase === 'workshop' && workshop.near === 'board') {
    sfx.uiClick()
    void lookBack()
    return
  }
  if (run.phase === 'workshop' && workshop.near === 'notebook') {
    sfx.uiClick()
    openNotebook()
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

/** §3.3: each road's name over its beam, faded in from 5 u to 3 u. */
const roadLabelsShown = new Set<string>()
function drawRoadLabels() {
  const want: { id: string; text: string; at: THREE.Vector3 }[] = []
  if (level?.group.visible && run.phase === 'crawl') {
    if (level.roads) for (const r of level.roads) want.push({ id: `road:${r.route}`, text: r.label, at: r.at })
    if (yardDressing) want.push({ id: `yard:${yardDressing.route}`, text: ROAD_LABEL[yardDressing.route], at: yardDressing.at })
  }
  const seen = new Set<string>()
  for (const w of want) {
    const alpha = labelAlpha(Math.hypot(still.pos.x - w.at.x, still.pos.z - w.at.z))
    labelTmp.set(w.at.x, CROSSROADS.labelY, w.at.z).project(world.camera)
    const on = alpha > 0 && Math.abs(labelTmp.x) <= 1 && Math.abs(labelTmp.y) <= 1
    const at = on ? { x: (labelTmp.x * 0.5 + 0.5) * window.innerWidth, y: (-labelTmp.y * 0.5 + 0.5) * window.innerHeight } : null
    hud.beamLabel(w.id, w.text, at, alpha)
    if (at) seen.add(w.id)
  }
  for (const id of roadLabelsShown) if (!seen.has(id)) hud.beamLabel(id, '', null, 0)
  roadLabelsShown.clear()
  for (const id of seen) roadLabelsShown.add(id)
}

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
  // a name met for the first time: over the one he met, a moment, like an elite's but muted
  const nowT = performance.now()
  for (let i = namedLabels.length - 1; i >= 0; i--) {
    const n = namedLabels[i]!
    if (nowT > n.until || n.e.dead || run.phase !== 'crawl') {
      namedLabels.splice(i, 1)
      continue
    }
    labelTmp.set(n.e.pos.x, n.e.labelY * n.e.size, n.e.pos.z).project(world.camera)
    const x = (labelTmp.x * 0.5 + 0.5) * window.innerWidth
    const y = (-labelTmp.y * 0.5 + 0.5) * window.innerHeight
    html.push(`<div class="elite named" style="left:${x}px;top:${y}px"><b>${n.text}</b></div>`)
  }
  eliteLabels.innerHTML = html.join('')
  labelsNow = [...eliteLabels.querySelectorAll('b')].map((b) => b.textContent ?? '')
}

// --- the notebook: names met in the maze (§7.2) ---

/** First-meet labels on screen: the name, over whom, until when (ms). */
const namedLabels: { text: string; e: Enemy; until: number }[] = []
/** The label texts drawn last frame (elite names and first meetings), for checks. */
let labelsNow: string[] = []
const NAMED_MS = 2200

/**
 * A pack woke: every name in it is met this level. The first time ever, the page is
 * written at once and the name floats over the member nearest him. Elites meet
 * their modifier's page, with the leader's own name added to it.
 */
function metPack(pack: Pack) {
  if (run.dev) return
  const depth = run.depth
  let wrote = false
  const firsts: { id: string; e: Enemy }[] = []
  for (const e of pack.members) {
    let id: string | undefined
    if (isBoss(e)) id = e.def.roster
    else if (pack.elite?.leader === e) {
      id = elitePage(pack.elite.mod, depth)
      if (meet(save.notebook, id, depth, run.met)) wrote = true
      addLeader(save.notebook[id]!, pack.elite.name)
      continue
    } else id = pageOf(e, pack) ?? run.names[e.kind]
    if (!id) continue
    if (meet(save.notebook, id, depth, run.met)) {
      wrote = true
      firsts.push({ id, e })
    }
  }
  // one label per name, over the member of it nearest him
  const seen = new Set<string>()
  for (const f of firsts.sort((a, b) => a.e.pos.distanceTo(still.pos) - b.e.pos.distanceTo(still.pos))) {
    if (seen.has(f.id)) continue
    seen.add(f.id)
    namedLabels.push({ text: ROSTER_BY_ID.get(f.id)!.name, e: f.e, until: performance.now() + NAMED_MS })
    sfx.pencil(panOf(f.e.pos))
  }
  if (wrote || pack.elite) store.write()
}

/** Felled: counted on its page, written with the next event write. Adds count for nothing. */
/** A body's own page when it has one whatever the level's names are: a Lobber's, a slag heap's mites'. */
function pageOf(e: Enemy, pack: Pack): string | undefined {
  if (e.variant === 'lobber') return LOBBER_PAGE
  if (e.kind === 'swarm' && pack.brood?.heap) return HEAP_PAGE
  return undefined
}

function felled(kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean, weight: number, own?: string) {
  if (run.dev || summoned) return
  let id: string | undefined
  // the boss is still combat's on the tick it's felled: bossDown clears it after
  if (kind === 'boss') id = combat.boss?.def.roster ?? BOSS_PAGE
  else if (own && !wasElite) id = own
  else if (wasElite && pack.elite) id = elitePage(pack.elite.mod, run.depth)
  // a Many's halves weigh nothing and weren't summoned
  else if (weight === 0) id = FRAGMENT_PAGE
  else id = run.names[kind]
  if (wasElite && pack.elite?.mod === 'splitting') meet(save.notebook, FRAGMENT_PAGE, run.depth, run.met)
  const e = id ? save.notebook[id] : undefined
  if (e) e.k += 1
  else if (id) {
    meet(save.notebook, id, run.depth, run.met)
    save.notebook[id]!.k += 1
  }
}

/** The notebook's pages, in the order they were first met (PLACEHOLDER words in the facts). */
function notebookPages(): NotebookPage[] {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = (f: string) => { const [, m, d] = f.split('-').map(Number); return `${d} ${MONTHS[(m ?? 1) - 1]}` }
  return Object.entries(save.notebook)
    .filter(([id]) => ROSTER_BY_ID.has(id))
    .sort((a, b) => a[1].f.localeCompare(b[1].f))
    .map(([id, e]) => {
      const r = ROSTER_BY_ID.get(id)!
      return {
        name: r.name, what: WHAT[r.role], line: r.line,
        facts: `met ${e.m} time${e.m === 1 ? '' : 's'} \u00b7 felled ${e.k} \u00b7 first met ${day(e.f)} \u00b7 deepest depth ${e.d}`,
        leaders: e.l?.length ? `led by ${e.l.join(', ')}` : null,
      }
    })
}

/** How a part card names a part and tells its past, from the save. */
const describePart = (d: AbilityDef) => ({ name: partName(save, d.id, d.name), history: historyLine(save, d.id) })
pause.setDescribe(describePart)

/**
 * Strain step 1's switch (design/strain/PITCHES.md): a push breaks the windup it lands in.
 * Off by default and kept per device, so the measured step-0 runs stay step 0 until it's
 * flipped on the pause screen. A run it's flipped in says 'mixed' in its playtest entry.
 */
const BREAK_RULE_KEY = 'still-action.breakRule'
function readBreakRule(): boolean {
  try {
    return localStorage.getItem(BREAK_RULE_KEY) === '1'
  } catch {
    return false
  }
}
function setBreakRule(on: boolean) {
  // flipped before the run has fought or pushed, the whole run is played the new way
  const untouched = run.stats.every((st) => st.fights === 0 && st.pushes === 0)
  if (run.phase === 'crawl' && run.breakRule !== on) run.breakRule = untouched ? on : 'mixed'
  combat.breakRule = on
  hud.breakRule = on
  try {
    localStorage.setItem(BREAK_RULE_KEY, on ? '1' : '0')
  } catch {
    // no storage (a private window): it holds for this session only
  }
}
combat.breakRule = hud.breakRule = readBreakRule()
pause.setBreakRule(() => combat.breakRule, setBreakRule)

/**
 * C-T2: under the break rule the push is taught at its first reason, once per save: a
 * windup starting that a cooling part on Still reaches and could break.
 */
function breakHint(e: Enemy) {
  if (!combat.breakRule || run.phase !== 'crawl' || !combat.breakable(e)) return
  for (const sl of hud.slots) {
    if (sl.def && !hud.isReady(sl.slot) && combat.reaches(sl.def, still.pos, e) && hud.breakHint(sl.slot)) return
  }
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
    hud.offer(next?.def ?? null, !!next && !save.found.includes(next.def.id), next ? describePart(next.def) : undefined)
    loot.offer(next)
  }
}

hud.onTake(() => {
  if (offered) takePart(offered)
})

hud.onCompare(() => {
  const g = offered
  if (!g || !canPause()) return
  sfx.uiClick()
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
  saw(g.def.id)
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
  sfx.uiClick()
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

let bossWasOpen = false

/** What the run says and plays as a boss changes (PLACEHOLDER words: Adrian's). */
const BOSS_COPY: Record<BossKind, { phase2: string; open: (pan: number) => void }> = {
  assembler: { phase2: 'the Assembler overloads', open: (pan) => sfx.clang(pan) },
  arbiter: { phase2: 'the Arbiter opens its second eye', open: (pan) => sfx.vent(pan) },
  // stage C; until then only a DEV ?engine=1 meets it (an Assembler under its def)
  engine: { phase2: 'the Engine runs both ways', open: (pan) => sfx.clang(pan) },
}

/** __arena's posts, when it built them. */
let devPosts: { posts: Post[]; group: THREE.Group } | null = null
/** A dev check's override of ARBITER_AT_6 (null: the switch as shipped). */
let devArbiterAt6: boolean | null = null
/** The road this run is on for looks and bosses: not chosen yet reads as the Works'. */
const routeNow = (): RouteId => run.route ?? 'II'
/** This depth's boss, through the one switch, on this run's road. */
const bossHere = (depth: number) => bossFor(depth, devArbiterAt6 ?? ARBITER_AT_6, routeNow(), flag('engine'))

/**
 * The day moves with you (§7): each level's span of the day, by the rooms he's reached, or
 * at the last depth by the Arbiter's HP (lights out, capped at first dark). Applied only
 * when what's shown moves, and never while __arena has the level put away.
 */
const day = new DayTracker()
let dayApplied = -1
function trackDay(dt: number) {
  if (!level || level.house || level.crossroads || !level.group.visible) return
  day.update(dt, level, still.pos, combat.boss)
  if (Math.abs(day.shown - dayApplied) > 1e-4) {
    dayApplied = day.shown
    applyDayAt(world, run.depth, day.shown)
  }
}

/** The fallen tower, where it stood: solid again, its footprint a husk you walk round. */
function raiseHusk(x: number, z: number, headYaw: number) {
  if (!level?.footprint) return
  level.footprint.dead = false
  level.group.add(arbiterHusk(x, z, headYaw))
}

/**
 * H5: the lance heats one button. Among the filled ones that are ready, the one with the
 * longest cooldown (the one he'd most want); else the one nearest ready; ties in slot order.
 */
function pickHeat(): SlotName | null {
  const filled = hud.slots.filter((s) => s.def)
  if (!filled.length) return null
  const ready = filled.filter((s) => hud.isReady(s.slot))
  if (ready.length) return ready.reduce((b, s) => (s.def!.cooldownMs > b.def!.cooldownMs ? s : b)).slot
  return filled.reduce((b, s) => (hud.readyIn(s.slot) < hud.readyIn(b.slot) ? s : b)).slot
}
/** Slots that were hot last frame: their cooling off is heard. */
const hotSlots = new Set<SlotName>()

/**
 * The Assembler falls: the beams open, and it leaves the best of what it was made from.
 * Before the last depth that's on and home; after the last one, home only.
 */
function bossDown(at: THREE.Vector3) {
  const felled = combat.boss
  const arbiter = felled instanceof Arbiter
  combat.boss = null
  hud.bossBar(null)
  if (arbiter) {
    // the lens goes out; the tower stands as a husk, solid; the square is at first dark
    sfx.lensOut(panOf(at))
    raiseHusk(at.x, at.z, felled.aim)
    day.snap(1)
    dayApplied = 1
    applyDayAt(world, run.depth, 1)
    // its drops land outside the footprint, toward him
    const dx = still.pos.x - at.x
    const dz = still.pos.z - at.z
    const d = Math.hypot(dx, dz) || 1
    at = new THREE.Vector3(at.x + (dx / d) * 1.9, 0, at.z + (dz / d) * 1.9)
  }
  for (const kind of exitsAfterBoss(run.depth)) {
    if (kind === 'cold') level?.openExit()
    else level?.openHome()
  }
  dressYardBeam()
  armBeams()
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
  // parts remember: each one worn through it saw that boss fall
  const felledBy = arbiter ? run.tally.arbiters : felled?.def.kind === 'engine' ? run.tally.engines : run.tally.assemblers
  for (const sl of hud.slots) if (sl.def) felledBy[sl.def.id] = (felledBy[sl.def.id] ?? 0) + 1
  // a beam save: a reload here comes back to the beams open and no boss, with its drops
  run.bossFelled = true
  run.bossLoot = [blue, gold].filter((d): d is AbilityDef => !!d).map((d) => d.id)
  writeSnapshot()
}

/** Parts remember the deepest depth they were worn at. */
function saw(id: string) {
  run.tally.deepest[id] = Math.max(run.tally.deepest[id] ?? 0, run.depth)
}

/**
 * A beam save (§4.15): the run at the start of this depth, to come back to. Never for a
 * dev run; cleared at the ending. Loot left on the floor is lost at a beam, as ever.
 */
function writeSnapshot() {
  if (run.dev || run.committed) return
  const snap: RunSnapshot = {
    s: 1, build: __BUILD__, id: run.id, startedAt: run.startedAt, depth: run.depth, seed: run.seed,
    bossFelled: run.bossFelled, bossLoot: [...run.bossLoot], strain: run.strain,
    loadout: hud.slots.map((sl) => sl.def?.id ?? null), tally: structuredClone(run.tally), route: run.route,
    ...(level?.crossroads ? { crossroads: true as const } : {}),
  }
  save.run = snap
  store.write()
}

/**
 * §4.16. A run picked up where its last beam left it, repaired rather than thrown
 * away: a part this build doesn't know (or that moved slot) leaves its slot empty,
 * the depth and strain come back inside the rules, and the tally drops what it
 * can't name. Every button comes back ready.
 */
function resumeRun(snap: RunSnapshot) {
  leaveRoom()
  still.reassemble()
  const known = new Set(PARTS.map((p) => p.id))
  const loadout = SLOT_NAMES.map((slot, i) => {
    const id = snap.loadout[i]
    const def = id && known.has(id) ? byId(id) : null
    return def && def.slot === slot ? def : null
  })
  const tally = { ...freshTally(), ...snap.tally }
  tally.carried = (tally.carried ?? []).filter((id) => known.has(id))
  for (const k of ['deepest', 'assemblers', 'arbiters', 'engines'] as const) tally[k] = Object.fromEntries(Object.entries(tally[k] ?? {}).filter(([id]) => known.has(id)))
  const depth = Math.min(RUN_DEPTHS, Math.max(1, Math.floor(snap.depth) || 1))
  // the road: a v2 snapshot (undefined) or anything unknown is the Works'; the Line only while it's on.
  // Before depth 4 an unchosen road stays unchosen, so the crossroads still comes.
  const route: RouteId | null = snap.crossroads ? null
    : snap.route === 'III' && flag('line') ? 'III' : snap.route === 'II' || depth >= 4 || snap.route === 'III' ? 'II' : null
  Object.assign(run, {
    phase: 'crawl', t: 0, swapped: false, ramStunSeen: false, dev: false, committed: false, ending: null, stats: [], taps: [],
    breakRule: combat.breakRule, id: snap.id, startedAt: snap.startedAt, strain: Math.min(19, Math.max(0, Math.round(snap.strain) || 0)), tally, route,
  })
  // a resume starts its stats over, so it's its own entry in the playtest file, not an overwrite
  playKey = `${run.id}.${Date.now().toString(36)}`
  loot.clear()
  combat.reset()
  const worn = loadout.filter((d): d is AbilityDef => !!d)
  hud.resetLoadout(worn)
  SLOT_NAMES.forEach((slot, i) => still.wear(slot, loadout[i] ?? null))
  // §3.5: a run saved in the crossroads comes back to it, with the road still to choose
  if (snap.crossroads) enterCrossroads(snap.seed)
  else enterLevel(depth, { seed: snap.seed, bossFelled: !!snap.bossFelled && !!bossHere(depth), resume: true })
  if (run.bossFelled && level && !level.crossroads) {
    // what it left, lying where it fell, unless he's wearing it
    const on = new Set(worn.map((d) => d.id))
    for (const id of snap.bossLoot ?? []) {
      if (!known.has(id) || on.has(id) || save.turned.includes(id)) continue
      loot.drop(byId(id), level.exit.clone(), still.pos)
    }
    run.bossLoot = [...(snap.bossLoot ?? [])]
  }
  hud.bossBar(null)
  rig.reset()
  hud.mode('run')
  hud.enabled = true
  overlay.hide()
  sfx.restore()
  writeSnapshot()
}

/** Each train's rail hum, while it sounds. At most two at once (§5.3). */
const hums = new Map<Train, sfx.Voice>()
/** A passing train's next wheel clack, on the Line's clock. */
const clacks = new Map<Train, number>()
/** Dev only: what each train sounded and when, on the Line's clock. */
const trainLog: { t: number; lane: number; kind: LineEvent['kind']; buzz?: boolean }[] = []
const HUMS_MAX = 2
/** The pass: a clack every 0.18 s, fading out by this distance. */
const CLACK = { every: 0.18, hear: 30 }

/** What Combat gives the Line: its clock and book, its hazards, and the run's ears. */
const lineHost = {
  get time() { return combat.time },
  get book() { return combat.book },
  addHazard: (spec: HazardSpec) => combat.addHazard(spec),
  roomAwake: (room: Room) => combat.roomAwake(room),
  smashIn: (shape: Parameters<Combat['smashIn']>[0], grow: number) => combat.smashIn(shape, grow),
  emit: (ev: LineEvent) => lineEvent(ev),
}

/** A train's instants: the hum at t0, the horn and the buzz at the commit, the duck, the wheels. */
function lineEvent(ev: LineEvent) {
  if (import.meta.env.DEV) {
    trainLog.push({ t: combat.line?.t ?? 0, lane: ev.train.lane.id, kind: ev.kind, ...(ev.kind === 'commit' ? { buzz: ev.buzz } : {}) })
    if (trainLog.length > 2000) trainLog.shift()
  }
  // once Still is stopping (or broken), the world is slowing with him: no new voices
  if (run.phase !== 'crawl') return
  switch (ev.kind) {
    case 'coming':
      if (hums.size < HUMS_MAX) hums.set(ev.train, sfx.railHum(panOf(ev.from), LINE.comingMs + LINE.committedMs))
      break
    case 'commit':
      sfx.horn(panOf(ev.from))
      // standing on the lane (or at its edge) as it commits: one short buzz
      if (ev.buzz) navigator.vibrate?.(40)
      break
    case 'duck':
      sfx.windupDip(150)
      break
    case 'arrive':
      hums.delete(ev.train)
      clacks.set(ev.train, combat.line?.t ?? 0)
      break
    case 'gone':
      hums.get(ev.train)?.stop()
      hums.delete(ev.train)
      clacks.delete(ev.train)
      break
  }
}

/** The Line the voices below belong to: a new level (or none) stops them. */
let fxLine: Line | null = null
/** The pass, heard: wheels over the joints, by how far the rake is from Still. */
function trainFx() {
  const line = combat.line
  if (line !== fxLine) {
    for (const v of hums.values()) v.stop()
    hums.clear()
    clacks.clear()
    fxLine = line
  }
  if (!line) return
  const at = new THREE.Vector3()
  for (const [tr, next] of clacks) {
    let n = next
    while (line.t >= n) {
      if (line.rakeAt(tr, at) && run.phase === 'crawl') {
        const d = Math.hypot(at.x - still.pos.x, at.z - still.pos.z)
        sfx.clack(panOf(at), Math.max(0, 1 - d / CLACK.hear))
      }
      n += CLACK.every
    }
    clacks.set(tr, n)
  }
}

/** Build a level and put Still at its entrance. HP is whole again; strain carries. `seed` repeats a layout (resume, checks). */
function enterLevel(depth: number, o: { seed?: number; bossFelled?: boolean; resume?: boolean } = {}) {
  beamArmed.exit = true
  beamArmed.home = true
  clearYardDressing()
  roadSmokeAt = []
  level?.dispose()
  hud.bossBar(null)
  loot.clear()
  combat.reset()
  partFx.clear()
  run.seed = o.seed ?? Math.floor(Math.random() * 1e9)
  run.bossFelled = !!o.bossFelled
  run.bossLoot = []
  const place = lookAt(depth, routeNow(), flag('engine'))
  level = generateLevel(depth, run.seed, { boss: bossHere(depth), place })
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  // the Line's own bodies and looks arrive in stage B: until then a Sleepers' brood sleeps as any brood does
  for (const p of level.packs) {
    const members = p.members.map((m) => ({ ...m, variant: m.variant === 'lobber' ? ('lobber' as const) : undefined }))
    combat.addPack(members, p.room.kind === 'side', p.elite, p.look === 'heap' ? 'heap' : undefined)
  }
  combat.breakables = level.breakables
  // the Line's trains (design/area3/SPEC.md §5): their clock starts with the level
  if (level.lanes?.length) {
    combat.line = new Line(level, run.seed, lineHost)
    world.scene.add(combat.line.group)
  }
  const boss = bossHere(depth)
  if (level.boss && boss && !run.bossFelled) combat.addBoss(level.boss.x, level.boss.z, level.boss.face, boss, level.posts)
  // G8: a thief in its nest, with no pack (it never spawns carrying)
  arenaFloor = null
  lastThief = level.thief ? combat.addThief(new Thief(level.thief.nest.x, level.thief.nest.z, level.thief.nest, thiefWorld())) : null
  thiefChimeT = 0
  // a felled boss is never fought again: its beams are open, as they were when it fell, and a tower stands as its husk
  if (run.bossFelled) {
    for (const kind of exitsAfterBoss(depth)) kind === 'cold' ? level.openExit() : level.openHome()
    if (level.footprint && level.boss) raiseHusk(level.boss.x, level.boss.z, 0)
  }
  if (run.bossFelled) {
    run.depth = depth
    dressYardBeam()
  }
  // this level's names (§7.2), from their own stream; nothing met here yet
  run.names = assignNames(depth, run.seed, save.notebook)
  run.met = new Set()
  namedLabels.length = 0
  // the place's look (every place wears the ruin's today; setSurfaces is a no-op until they don't)
  setSurfaces(place.surfaces)
  // the day starts where this depth's span does; the square once its tower is down is at first dark
  day.enter(depth, run.bossFelled && boss?.kind === 'arbiter')
  dayApplied = day.shown
  applyDayAt(world, depth, day.shown)
  run.fought = false
  run.quietT = 0
  run.killed = false
  lastStep.clear()
  still.pos.copy(level.entrance)
  prev.copy(still.pos)
  run.depth = depth
  closeStats()
  run.stats.push({ depth, fights: 0, pushes: 0, breaks: 0, deadTaps: 0, quiets: 0, strainIn: run.strain, strainOut: null })
  // the card's line gets a tick where this depth began (a resumed depth already has its tick)
  if (!o.resume) run.tally.marks.push(run.tally.line.length)
  // parts remember how deep they went
  for (const sl of hud.slots) if (sl.def) saw(sl.def.id)
  overlay.banner(level.boss && !run.bossFelled ? `Depth ${depth} \u00b7 something is waiting` : `Depth ${depth}`)
}

function startRun() {
  leaveRoom()
  still.reassemble()
  Object.assign(run, {
    phase: 'crawl', strain: 0, t: 0, swapped: false, ramStunSeen: false,
    id: newRunId(), dev: DEPTH_PARAM !== null, committed: false, ending: null, stats: [], taps: [], tally: freshTally(),
    startedAt: new Date().toISOString(), breakRule: combat.breakRule, route: ROUTE_PARAM,
  })
  playKey = `${run.id}.${Date.now().toString(36)}`
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
  writeSnapshot()
}

/** Not crypto.randomUUID: that needs a secure context, and the phone plays over plain http on the LAN. */
function newRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** The depth being left gets its strain on the way out. */
function closeStats() {
  const st = run.stats[run.stats.length - 1]
  if (!st || st.strainOut !== null) return
  st.strainOut = run.strain
  // a run's end posts once, from commit, when it knows how it ended
  if (!run.committed) savePlaytest()
}

/** Which entry in playtest.json this run writes: one per start or resume. */
let playKey = ''

/**
 * Dev only: the phone can't open a console, so each depth's end and the run's end POST the
 * run so far to the dev server, which keeps it in playtest.json (one entry per run, replaced
 * as it grows). A production build has no such endpoint and never tries.
 */
function savePlaytest() {
  // the owner's phone runs only: a headless check (webdriver) never lands in his numbers
  if (!import.meta.env.DEV || !playKey || navigator.webdriver) return
  const body = {
    key: playKey, id: run.id, build: __BUILD__, startedAt: run.startedAt, savedAt: new Date().toISOString(),
    dev: run.dev, end: run.ending?.kind ?? null, depth: run.depth, breakRule: run.breakRule,
    stats: run.stats.map((st) => ({ ...st, strainOut: st.strainOut ?? run.strain })),
    taps: run.taps,
  }
  void fetch('/__save/playtest', { method: 'POST', body: JSON.stringify(body) }).catch(() => {})
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

/**
 * §3.1. The crossroads comes after the Assembler when the road isn't chosen yet, the room is
 * the road choice, the Line is on, and it's open (the run after the first Assembler fell).
 * DEV ?crossroads=1 forces it (it works with the switch off, as ?route= does).
 */
function crossroadsDue(): boolean {
  if (run.route || level?.crossroads) return false
  if (CROSSROADS_PARAM) return true
  return roadChoice() === 'crossroads' && flag('line') && save.roads.includes('III')
}

/** Which roads are armed: a beam takes him only once he's been outside it (he arrives 7.6 u off both). */
const roadArmed = new Set<RouteId>()
/** Soot from the Works' frame: the crossroads', or the alternate's dressed yard beam. */
const roadSmoke = new RoadSmoke()
let roadSmokeAt: THREE.Vector3[] = []
/** The alternate's dressing on the Assembler's cold beam, and the road it names. */
let yardDressing: { route: RouteId; at: THREE.Vector3; d: Dressing; kit: THREE.Group } | null = null
function clearYardDressing() {
  if (!yardDressing) return
  yardDressing.d.dispose()
  yardDressing.kit.removeFromParent()
  for (const o of yardDressing.kit.children) if (o instanceof THREE.InstancedMesh) o.dispose()
  yardDressing = null
  roadSmokeAt = []
}

/**
 * §3.6, the fallback: with no room, the Assembler's cold beam is dressed as the road it leads
 * to, with its name. Only once it's open, only at depth 3, only while the alternate is on.
 */
function dressYardBeam() {
  clearYardDressing()
  if (!level || run.depth !== 3 || !level.exitOpen || run.route) return
  if (roadChoice() !== 'alternate' || !flag('line') || !save.roads.includes('III')) return
  const route = routeForAlternate()
  const at = level.exit.clone()
  // the Line's rails run in from past the floor's far-right edge (−z), into the beam's foot
  let z = at.z
  while (level.floor.has(key(Math.round(at.x / 4), Math.round(z / 4)))) z -= 1
  const d = dressRoad(route, at, new THREE.Vector3(at.x, 0, z - 12))
  const kitGroup = buildInstanced(d.placements)
  level.group.add(d.group, kitGroup)
  yardDressing = { route, at, d, kit: kitGroup }
  roadSmokeAt = d.smoke
}

/**
 * The crossroads now (§3.2): depth 3, its boss down, the road not chosen. HP is whole, strain
 * carries; no stats, no banner, no packs. A resume passes the room's seed.
 */
function enterCrossroads(seed = Math.floor(Math.random() * 1e9)) {
  beamArmed.exit = true
  beamArmed.home = true
  clearYardDressing()
  level?.dispose()
  hud.bossBar(null)
  loot.clear()
  combat.reset()
  partFx.clear()
  run.seed = seed
  run.bossFelled = true
  run.bossLoot = []
  run.route = null
  const room = generateCrossroads(seed)
  level = room
  world.scene.add(room.group)
  combat.terrain = room.terrain
  loot.terrain = room.terrain
  combat.breakables = []
  arenaFloor = null
  lastThief = null
  namedLabels.length = 0
  // both open from the first tick: he arrives outside both, so both are armed at once
  roadArmed.clear()
  for (const r of room.roads) if (Math.hypot(room.entrance.x - r.at.x, room.entrance.z - r.at.z) >= EXIT_RADIUS) roadArmed.add(r.route)
  roadSmokeAt = room.smoke
  setSurfaces(PLACES.ruin.surfaces)
  // the afternoon, with no span: the day doesn't move in here
  day.enter(3)
  dayApplied = day.shown
  applyDay(world, 'afternoon')
  run.fought = false
  run.quietT = 0
  run.killed = false
  lastStep.clear()
  still.pos.copy(room.entrance)
  still.facing = CROSSROADS.facing
  prev.copy(still.pos)
  graceLean.set(0, 0, 0)
  run.depth = 3
  // a quiet room: the yard's "area cleared" stays in the yard
  overlay.clearBanner()
}

/** §3.4: into a road's beam. The route is set, the save remembers it, and the swap goes to depth 4. */
function takeRoad(route: RouteId) {
  run.route = route
  if (!run.dev) save.lastRoad = route
  descend()
}

/**
 * §3.1. The road without a room: the Works, unless the fallback alternates the roads (and
 * the Line is on and open), when it's the one not taken last (the Line when none was).
 */
function routeForAlternate(): RouteId {
  if (roadChoice() !== 'alternate' || !flag('line') || !save.roads.includes('III')) return 'II'
  return save.lastRoad === 'III' ? 'II' : 'III'
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
  savePlaytest()
  if (run.dev) {
    save.lastEnding = { kind, hour, depth: run.depth, worn, cardId: run.id, arrived: false }
    return
  }
  save.runs += 1
  const card = {
    id: run.id, n: save.runs, date: localDate(), end: kind, depth: run.depth, hour, by: drawerFor(save.runs), worn, line: t.line, marks: [...t.marks],
    // the road, on a Line run only (absent is the Works')
    ...(run.route === 'III' && run.depth >= 4 ? { route: 'III' as const } : {}),
  }
  save.cards.push(card)
  trimCards(save)
  drawings.putCard(card)
  // what he came home wearing is found, whatever happened to the rest
  for (const id of worn) if (id) markFound(save, id)
  // parts remember (§7.1): every part carried this run, how deep it went, the Assemblers
  // it saw fall, and how the run ended if he came home wearing it
  const wornIds = new Set(worn.filter((id): id is string => !!id))
  const endAt = { broken: 3, stopped: 4, home: 5 } as const
  for (const id of run.tally.carried) {
    const h = save.history[id] ?? [0, 0, 0, 0, 0, 0, 0, 0]
    h[0] += 1
    h[1] = Math.max(h[1], run.tally.deepest[id] ?? run.depth)
    h[2] += run.tally.assemblers[id] ?? 0
    h[6] += run.tally.arbiters[id] ?? 0
    h[7] += run.tally.engines[id] ?? 0
    if (wornIds.has(id)) h[endAt[kind]] += 1
    save.history[id] = h
  }
  save.pendingHook = { candidates: hookCandidates(save, worn) }
  save.lastEnding = { kind, hour, depth: run.depth, worn, cardId: run.id, arrived: false }
  save.run = null
  // §3.1, opening the road: a run that felled an Assembler opens the Line, from the next run on
  if (flag('line') && (run.depth >= 4 || (run.depth === 3 && run.bossFelled)) && !save.roads.includes('III')) save.roads.push('III')
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
  sfx.slowRing(BREAK.slow + BREAK.ramp)
  navigator.vibrate?.(120)
  const at = at3(still.pos, 0.9)
  vfx.flash(at, COLD, 0.7)
  vfx.sparks(at, COLD, 34, 9)
  vfx.chunks(at, 10, COLD_GRIT, 6, 0.1)
  breakTrailT = 0
  breakLanded = 0
  hitstop = BREAK.freeze
  shake = 1.1
  rig.punch(0.12)
}

/** How fast Broken's world runs: all but stopped in the freeze, a quarter in the air, then full. */
function breakScale() {
  if (run.phase !== 'broken') return 1
  if (hitstop > 0) return 0.03
  if (run.t < BREAK.slow) return BREAK.scale
  const k = Math.min(1, (run.t - BREAK.slow) / BREAK.ramp)
  return BREAK.scale + (1 - BREAK.scale) * k * k
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
  sfx.uiClick()
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
  // the room wears its own wood and stone, whatever the run was last in
  setSurfaces(PLACES.ruin.surfaces)
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
  sfx.uiClick()
  chooserSel = id
  renderChooser()
})

/** The chooser's one action: turn a part to the wall (or back), or hang one on the hook. Saved at once. */
function chooserAction() {
  if (!chooserAt || !chooserSel || run.phase !== 'workshop') return
  const done = chooserAt === 'hook' ? hang(save, chooserSel) : toggleTurn(save, chooserSel)
  if (!done) return
  sfx.uiClick()
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

/** The notebook screen: the pages met so far, and the blank one after them. */
function openNotebook() {
  const pages = notebookPages()
  if (!pages.length) return
  hud.enabled = false
  hud.prompt(null)
  pause.notebook(pages, () => {
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

hud.onPress((p) => {
  if (run.phase !== 'crawl') return
  run.taps.push({ depth: run.depth, slot: p.slot, ms: Math.round(p.ms), ready: p.ready, result: p.result })
  if (p.result !== 'dead') return
  const st = run.stats[run.stats.length - 1]
  if (st) st.deadTaps++
  sfx.deadTap(0.35)
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
      // §3.1: down from the Assembler, the crossroads when it's due; otherwise the road is set here
      if (run.depth === 3 && crossroadsDue()) enterCrossroads()
      else {
        if (run.depth === 3 && !run.route) {
          run.route = routeForAlternate()
          if (!run.dev && roadChoice() === 'alternate' && flag('line')) save.lastRoad = run.route
        }
        enterLevel(run.depth + 1)
      }
      // a beam save: a reload comes back to the start of this depth
      writeSnapshot()
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
    const k = breakScale()
    for (const p of still.updateBroken(realDt * k)) {
      sfx.partLand(breakLanded++, panOf(p))
      vfx.chunks(p, 4, COLD_GRIT, 2.5, 0.06)
      vfx.sparks(p, COLD, 5, 3)
    }
    const air = Math.min(1, run.t / BREAK.slow)
    still.eyeOut(air)
    // the view leans in while he's in the air, and stays there under the words
    rig.hold = 1 + END_ZOOM * air * air * (3 - 2 * air)
    if (run.t < BREAK.slow) {
      breakTrailT -= realDt
      if (breakTrailT <= 0) {
        breakTrailT = BREAK_TRAIL
        for (const p of still.debrisPoints()) vfx.trail(p, COLD, 0.1, 0.35)
      }
    }
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
    rig.hold = 1 + ease * END_ZOOM
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
  pushOffBoss()

  const target = combat.nearestTarget(still.pos, 9.5)
  still.aim = target ? Math.atan2(target.x - still.pos.x, target.z - still.pos.z) : null

  combat.update(dt, still.pos)
  thiefFx(dt)
  trackDay(dt)
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
    if (!run.fought) {
      // a fight begins: its waterline is the strain it found
      run.water = run.strain
      const st = run.stats[run.stats.length - 1]
      if (st) st.fights++
    }
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
  // the free push, drawn while the fight is on: the quiet at its end pays QUIET_STRAIN back
  hud.freePush(run.fought && run.phase === 'crawl' ? { from: run.water, width: QUIET_STRAIN } : null)

  // the boss: its bar, its second phase, and the sound of its window opening (a charge into a wall)
  const boss = combat.boss
  if (boss && !boss.dead) {
    const awakeBoss = combat.awake.includes(boss)
    const def = boss.def
    hud.bossBar(awakeBoss ? { name: def.name, frac: boss.hp / boss.maxHp, phase2: boss.phase2, open: boss.open, openWord: def.openWord } : null)
    if (boss.justPhase2) {
      overlay.banner(BOSS_COPY[def.kind].phase2)
      sfx.roar()
      shake = Math.max(shake, 0.8)
      rig.punch(-0.06)
    }
    if (boss.open && !bossWasOpen) {
      BOSS_COPY[def.kind].open(panOf(boss.pos))
      shake = Math.max(shake, 0.6)
      hitstop = Math.max(hitstop, 0.12)
    }
    bossWasOpen = boss.open
  }

  // the exit is open once there's no boss standing, even with something on your heels
  const toExit = level ? Math.hypot(still.pos.x - level.exit.x, still.pos.z - level.exit.z) : Infinity
  if (toExit > BEAM_REARM) beamArmed.exit = true
  if (run.phase === 'crawl' && level && level.exitOpen && beamArmed.exit && toExit < EXIT_RADIUS) {
    descend()
    return
  }
  // and so is home, the same way
  const toHome = level?.home ? Math.hypot(still.pos.x - level.home.x, still.pos.z - level.home.z) : Infinity
  if (toHome > BEAM_REARM) beamArmed.home = true
  if (run.phase === 'crawl' && level?.home && level.homeOpen && beamArmed.home && toHome < EXIT_RADIUS) {
    beginHoming(level.home)
    return
  }
  // §3.4: the crossroads' two roads, each armed once he's outside it
  if (run.phase === 'crawl' && level?.roads) {
    for (const r of level.roads) {
      const d = Math.hypot(still.pos.x - r.at.x, still.pos.z - r.at.z)
      if (d > BEAM_REARM) roadArmed.add(r.route)
      if (roadArmed.has(r.route) && d < EXIT_RADIUS) {
        takeRoad(r.route)
        return
      }
    }
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
  // the words come next only before the last depth; after it, the walk home closes in at the door
  if (run.depth < RUN_DEPTHS) rig.hold = 1 + ease * END_ZOOM
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
  level = generateWalkHome(Math.floor(Math.random() * 1e9), PLACES[WALK_PLACE])
  setSurfaces(PLACES[WALK_PLACE].surfaces)
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
  const toDoor = h ? Math.hypot(still.pos.x - h.door.x, still.pos.z - h.door.z) : Infinity
  // the last few steps to the door, the view closes in: the words find him there
  const near = Math.min(1, Math.max(0, 1 - (toDoor - WALK_DOOR_R) / WALK_CLOSE))
  if (run.phase === 'walkHome') rig.hold = 1 + END_ZOOM * near * near * (3 - 2 * near)
  if (run.phase === 'walkHome' && h && toDoor < WALK_DOOR_R) {
    hud.enabled = false
    end('home')
  }
}
/** The house's door zone (§4.25). */
const WALK_DOOR_R = 1.3
/** How far from the door zone the view starts closing in. */
const WALK_CLOSE = 4

/** Area II's day slows the score: 97 falling to 94.5 through depth 4, and 94.5 to 92 through depth 5. */
function crawlBpm() {
  if (level?.house || inRoom()) return 97
  if (run.depth === 4) return 97 - 2.5 * day.shown
  if (run.depth === 5) return 94.5 - 2.5 * day.shown
  return 97
}

/**
 * A tall boss's head, as the ground point it hides on screen: the camera frames ground points,
 * and the Arbiter's lens 4.9 u up would sit under the boss bar without this.
 */
function tallFrame(awake: readonly Enemy[]): THREE.Vector3[] {
  const b = combat.boss
  if (!(b instanceof Arbiter) || b.dead || !awake.includes(b)) return []
  const flat = Math.hypot(camOffset.x, camOffset.z)
  const back = b.labelY * (flat / camOffset.y)
  return [new THREE.Vector3(b.pos.x - (camOffset.x / flat) * back, 0, b.pos.z - (camOffset.z / flat) * back)]
}

/** The place he's in: the depth's look, or the quarter at night on the walk home. */
function placeNow(): PlaceDef {
  return level?.house ? PLACES[WALK_PLACE] : lookAt(run.depth, routeNow(), flag('engine'))
}

/** The room tone for where he is: the place's, a boss level's own. */
function moodNow() {
  const place = placeNow()
  return level?.boss ? place.ambience.boss : place.ambience.crawl
}

/** A boss that never walks has a footprint: he's kept out of it, as out of a wall. */
function pushOffBoss() {
  const b = combat.boss
  if (!b || b.dead || b.anchored === null) return
  const dx = still.pos.x - b.pos.x
  const dz = still.pos.z - b.pos.z
  const d = Math.hypot(dx, dz)
  const min = b.anchored + BODY_RADIUS
  if (d >= min) return
  const ux = d > 1e-6 ? dx / d : 0
  const uz = d > 1e-6 ? dz / d : 1
  still.pos.x = b.pos.x + ux * min
  still.pos.z = b.pos.z + uz * min
}

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
  if (still.walking && k !== lastStep.get(still)) sfx.step('still', 0, 1, home ? (still.pos.z >= -6 ? 'wood' : 'stone') : placeNow().footsteps)
  lastStep.set(still, k)
  if (run.phase !== 'crawl') return
  while (stepTimes.length && now - stepTimes[0]! > STEP_WINDOW) stepTimes.shift()
  const quiet = hush()
  const dist = (e: Enemy) => Math.hypot(e.pos.x - still.pos.x, e.pos.z - still.pos.z)
  // the thief is never awake, but its feet are heard like anyone's
  const walkers = [...combat.awake, ...combat.enemies.filter((e) => e.kind === 'thief')]
  for (const e of walkers.sort((a, b) => dist(a) - dist(b))) {
    const d = dist(e)
    const ek = Math.floor(e.gait / Math.PI)
    if (d <= STEP_HEAR && e.walking && ek !== lastStep.get(e) && stepTimes.length < STEPS_MAX) {
      const who = e.kind === 'chaser' ? 'hulk' : e.kind === 'ranged' ? 'tripod' : e.kind === 'charger' ? 'ram' : e.kind === 'thief' ? 'thief' : 'boss'
      const loud = (1 - d / STEP_HEAR) * (e.kind === 'chaser' ? Math.min(1, e.size) : 1) * quiet
      sfx.step(who, panOf(e.pos), loud, placeNow().footsteps)
      // the Assembler's weight comes down through its rams: a hiss and a thunk under the step
      if (e instanceof Assembler) sfx.hydraulic('step', panOf(e.pos), loud)
      stepTimes.push(now)
    }
    lastStep.set(e, ek)
  }
}

// --- the thief (§6.1): its world, its instants, its chime ---

/** __arena's floor while it's up: a thief spawned there paths over it as one room. */
let arenaFloor: Set<string> | null = null
const ARENA_ROOM: Room = { kind: 'main', ci: 0, cj: 0, rx: 3, rz: 3, center: new THREE.Vector3() }

/** What the thief may see: the floor, the parts on it, where Still is, and which rooms it may run through. */
function thiefWorld(): ThiefWorld {
  const floor = arenaFloor ?? level!.floor
  const rooms = arenaFloor ? [ARENA_ROOM] : level!.rooms
  const beams = arenaFloor || !level ? [] : [level.exit, ...(level.home ? [level.home] : [])]
  const inside = (r: Room, x: number, z: number) => Math.abs(Math.round(x / 4) - r.ci) <= r.rx && Math.abs(Math.round(z / 4) - r.cj) <= r.rz
  return {
    ground: () => loot.ground,
    lift: (g) => loot.lift(g),
    still: still.pos,
    floor, rooms, beams,
    // no asleep pack in it (by where its members sleep), and never the exit room
    allowedRooms: () => rooms.filter((r) => r.kind !== 'exit' && !combat.packs.some((p) =>
      p.state === 'asleep' && p.members.some((m) => { const h = p.homes.get(m); return !!h && inside(r, h.x, h.z) }))),
  }
}

/** The level's thief, if it has one and it's still about. */
const thiefNow = () => (combat.enemies.find((e): e is Thief => e instanceof Thief && !e.dead) ?? null)
/** The last thief built, for __thief: a caught one is still reported (as caught) after it's buried. */
let lastThief: Thief | null = null

function thiefEvent(ev: ThiefEvent) {
  const at = ev.kind === 'caught' ? ev.at : ev.e.pos
  const pan = panOf(at)
  switch (ev.kind) {
    case 'wake':
      // the notebook meets it the first time it moves: its name floats over it
      if (run.dev) break
      if (meet(save.notebook, THIEF_PAGE, run.depth, run.met)) {
        namedLabels.push({ text: ROSTER_BY_ID.get(THIEF_PAGE)!.name, e: ev.e, until: performance.now() + NAMED_MS })
        sfx.pencil(pan)
        store.write()
      }
      break
    case 'take':
      // the cage snaps shut on it, and the part's glass goes cold white
      sfx.snatch(pan)
      vfx.sparks(at3(at, 0.8), COLD, 8, 3)
      vfx.flash(at3(at, 0.85), COLD_DEEP, 0.4)
      thiefChimeT = 0.25
      break
    case 'listen':
      break
    case 'caught': {
      // the cage springs open: rust off the little body, and the part it had (only that) comes back down
      sfx.cageOpen(pan)
      vfx.chunks(at3(at, 0.5), 6, THIEF_C, 3.5, 0.1)
      vfx.dust(at, 5, 0.5)
      if (ev.def) {
        vfx.flash(at3(at, 0.85), COLD, 0.8)
        vfx.sparks(at3(at, 0.85), COLD, 12, 4)
        loot.drop(ev.def, at, still.pos)
        sfx.drop(ev.def.tier, pan)
      } else vfx.sparks(at3(at, 0.5), EMBER, 6, 3)
      hitstop = Math.max(hitstop, 0.05)
      shake = Math.max(shake, 0.12)
      if (!run.dev) {
        meet(save.notebook, THIEF_PAGE, run.depth, run.met)
        save.notebook[THIEF_PAGE]!.k += 1
      }
      break
    }
  }
}

/** Seconds to the carrying thief's next chime. */
let thiefChimeT = 0
const THIEF_CHIME_S = 1.4
function thiefFx(dt: number) {
  const t = thiefNow()
  if (!t?.carrying || run.phase !== 'crawl') return
  thiefChimeT -= dt
  if (thiefChimeT > 0) return
  thiefChimeT = THIEF_CHIME_S
  sfx.thiefChime(panOf(t.pos))
}

/** Continuous effects: the boss dressing itself (smoke, sparks), hulks glowing as they wind up, slag dripping. */
let ambientT = 0
let slagT = 0
const SLAG_DRIP_S = 0.33
function ambientFx(dt: number) {
  if (level?.group.visible) roadSmoke.tick(dt, vfx, roadSmokeAt)
  ambientT -= dt
  const tick = ambientT <= 0
  if (tick) ambientT = 0.09
  const b = combat.boss
  if (b && !b.dead && tick) b.dress(vfx)
  if (tick) {
    for (const e of combat.awake) {
      if (e.kind === 'chaser' && e.phase === 'windup') vfx.embers(at3(e.pos, 1.0 * e.size), 1, 0.3)
    }
  }
  // a shell in the air trails embers, like a shot
  for (const p of combat.shellsInFlight()) vfx.trail(p, EMBER, 0.3)
  // a slag core drips while it's awake: the puddle is on the body before the kill
  slagT -= dt
  if (slagT <= 0) {
    slagT = SLAG_DRIP_S
    for (const e of combat.awake) if (combat.isSlagged(e)) vfx.drip(at3(e.pos, e.height * 0.55 * e.size))
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
  // §3.3: in the crossroads it's held: neither road is the way
  if (level?.crossroads) graceLean.set(0, 0, 0)
  else if (level && run.phase === 'crawl') {
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
    rig.update(elapsed, camTarget, [...awake.map((e) => e.pos), ...combat.threatEnds(), ...tallFrame(awake)], !fighting)
  }
  world.camera.position.copy(camTarget).add(camOffset)
  if (shake > 0) {
    const k = shake * shake * 0.9
    world.camera.position.x += (Math.random() - 0.5) * k
    world.camera.position.z += (Math.random() - 0.5) * k
    world.camera.position.y += (Math.random() - 0.5) * k
  }
  world.camera.lookAt(camTarget)

  updateAmbience(home ? 'workshop' : moodNow())
  const bossAwake = !!combat.boss && !combat.boss.dead && awake.includes(combat.boss)
  const place = placeNow()
  updateMusic({
    boss: bossAwake,
    phase2: bossAwake && combat.boss!.phase2,
    area: place.music,
    bpm: crawlBpm(),
    kit: combat.boss?.def.kind === 'arbiter' ? 'anvil' : 'drums',
    dark: day.by === 'boss' && !level?.house && !home ? day.shown : 0,
    fighting,
    calm: !fighting,
    strain: run.strain / 20,
    home,
  })
  if (!paused) clock += elapsed * 1000
  drawEliteLabels()
  drawRoadLabels()
  partFaces(elapsed)
  hud.update(clock)
  if (!paused) {
    vfx.update(elapsed * breakScale(), world.camera, world.renderer.domElement.height)
    ambientFx(elapsed)
    footsteps(now)
    ramFx(elapsed)
    arbiterFx()
    broodFx(elapsed)
    trainFx()
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

/** DEV: a level on a road, generated for a check and thrown away (the Arbiter's switch as shipped, the Engine's as flagged). */
function genFor(depth: number, seed: number, route: RouteId) {
  return generateLevel(depth, seed, { boss: bossFor(depth, ARBITER_AT_6, route, flag('engine')), place: lookAt(depth, route, flag('engine')) })
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
    /** A pack from members, like addPack (a member with `slag: true` carries a slag core). awake = true wakes it at once. */
    __pack: (members: { kind: Archetype; variant?: 'lobber'; x: number; z: number; slag?: true }[], awake = true, elite?: EliteMod, look?: 'heap'): Pack => {
      const pack = combat.addPack(members, false, elite ? { mod: elite, name: 'Test' } : undefined, look)
      if (awake) combat.wake(pack)
      return pack
    },
    /** A level's packs, generated and thrown away without entering it. */
    __gen: (depth: number, seed: number, route: RouteId = 'II') => {
      const l = genFor(depth, seed, route)
      const out = l.packs.map((p) => ({
        room: p.room.kind, rx: p.room.rx, rz: p.room.rz, kinds: p.members.map((m) => m.kind),
        elite: p.elite?.mod ?? null, name: p.elite?.name ?? null, lesson: !!p.lesson, budget: p.budget ?? null, template: p.template ?? null,
      }))
      l.dispose()
      return out
    },
    /**
     * What a level is built from, generated and thrown away: its props (top = height x scale,
     * p = the room's progress), the tall beyond (hides: its shadow falls on floor), the floor
     * pieces, and the packs as __gen has them with their slag cores and look.
     */
    __genLook: (depth: number, seed: number, route: RouteId = 'II') => {
      const l = genFor(depth, seed, route)
      const out = {
        place: l.place, props: l.made.props, tall: l.made.tall, floors: l.made.floors,
        rooms: l.rooms.map((r) => ({ kind: r.kind, rx: r.rx, rz: r.rz, p: l.progressOf(r) })),
        packs: l.packs.map((p) => ({
          room: p.room.kind, index: l.rooms.indexOf(p.room), p: l.progressOf(p.room), kinds: p.members.map((m) => m.kind),
          lobbers: p.members.map((m) => m.variant === 'lobber'), slag: p.members.map((m) => !!m.slag),
          elite: p.elite?.mod ?? null, lesson: !!p.lesson, template: p.template ?? null, look: p.look ?? null,
        })),
        edge: l.made.edge,
        far: l.made.far,
        thief: l.thief ? { x: l.thief.nest.x, z: l.thief.nest.z } : null,
      }
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
    /** One enemy as its own pack of 1. awake = true wakes it at once. A boss is the variant's (default the Assembler). */
    __spawn: (kind: Archetype, x: number, z: number, awake = true, elite?: EliteMod, variant?: BossKind | 'lobber'): Enemy => {
      // a thief nests where it's spawned: in __arena's floor, or the level's
      if (kind === 'thief') return (lastThief = combat.addThief(new Thief(x, z, new THREE.Vector3(x, 0, z), thiefWorld())))
      if (kind === 'boss') {
        const defs: Record<BossKind, BossDef> = { assembler: ASSEMBLER_DEF, arbiter: ARBITER_DEF, engine: ENGINE_DEF }
        // the Arbiter stands among __arena's posts, when it built them
        const b = combat.addBoss(x, z, new THREE.Vector3(x, 0, z - 1), defs[(variant ?? 'assembler') as BossKind], devPosts?.posts ?? [])
        if (awake) combat.wake(combat.packs[combat.packs.length - 1]!)
        return b
      }
      const pack = combat.addPack([{ kind, x, z, variant: variant === 'lobber' ? 'lobber' : undefined }], false, elite ? { mod: elite, name: 'Test' } : undefined)
      if (awake) combat.wake(pack)
      return pack.members[0]!
    },
    /**
     * A clean test floor: cells i, j in [-3, 3] (x, z in [-14, 14]) plus these solids.
     * Nothing else in the world; Still at (0, 0) facing +z, whole, unstrained, every button ready.
     */
    __arena: (o: { boxes?: Box[]; circles?: Circle[]; auto?: boolean; posts?: boolean } = {}) => {
      leaveRoom()
      fadeInT = 0
      namedLabels.length = 0
      const floor = new Set<string>()
      for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) floor.add(key(i, j))
      arenaFloor = floor
      // posts: the square's eight round (0, 0), solid and drawn, for the Arbiter's checks
      if (devPosts) world.scene.remove(devPosts.group)
      devPosts = null
      if (o.posts) {
        const posts = squarePosts(0, 0)
        const group = new THREE.Group()
        for (const p of posts) group.add(p.mesh)
        world.scene.add(group)
        devPosts = { posts, group }
      }
      const terrain = makeTerrain(floor, o.boxes ?? [], [...(o.circles ?? []), ...(devPosts?.posts.flatMap((p) => p.circles) ?? [])])
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
    __genKit: (depth: number, seed: number, route: RouteId = 'II') => {
      const l = genFor(depth, seed, route)
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
    __notebook: () => JSON.parse(JSON.stringify(save.notebook)) as Save['notebook'],
    __names: () => ({ ...run.names }),
    __labels: () => [...labelsNow],
    __roster: () => ROSTER.map((r) => ({ ...r })),
    __namesFor: (kind: Exclude<Archetype, 'boss'>, depth: number) => namesFor(kind, depth).map((r) => r.id),
    __assignNames: (depth: number, seed: number) => assignNames(depth, seed, save.notebook),
    __openNotebook: () => openNotebook(),
    __adds: () => combat.adds(),
    /** The Arbiter's state for checks (null for any other boss). */
    /** The thief, while there is one: its state, where it is, what it carries, its nest. */
    __thief: () => {
      const t = lastThief && (combat.enemies.includes(lastThief) || lastThief.state === 'caught') ? lastThief : null
      return t ? { state: t.state, x: t.pos.x, z: t.pos.z, carrying: t.carrying?.id ?? null, nest: { x: t.nest.x, z: t.nest.z } } : null
    },
    __boss: () => {
      const b = combat.boss
      if (!(b instanceof Arbiter)) return b ? { kind: b.def.kind, hp: b.hp, phase2: b.phase2, open: b.open } : null
      return {
        kind: 'arbiter', hp: b.hp, phase2: b.phase2, open: b.open, state: b.state, wedges: [...b.wedges], omega: b.omega, aim: b.aim, guess: b.guess,
        cut: b.cut ? { x: b.cut.x, z: b.cut.z } : null, posts: b.posts.map((p) => ({ x: p.x, z: p.z, lances: p.lances, cracked: p.cracked, r: p.circles[0].r })),
      }
    },
    /** Flip the Arbiter's switch for this session (false: Home's second Assembler at 6); null restores it. */
    __arbiterAt6: (on: boolean | null) => { devArbiterAt6 = on },
    /** Posts built by __arena({ posts: true }), for the checks. */
    __posts: () => devPosts?.posts ?? null,
    /** A floor hazard now, as a boss or a slag core would make one. */
    __hazard: (spec: HazardSpec) => combat.addHazard(spec),
    /** Every hazard on the floor: its clocks, and who it hit ('still', or an index into __combat.enemies). */
    __hazards: () => combat.hazards.map((h) => ({
      source: h.spec.source, shape: { ...h.spec.shape }, armIn: h.armIn, liveLeft: h.liveLeft, damage: h.spec.damage, done: h.done,
      hit: [...h.hit].map((w) => (w === 'still' ? 'still' : combat.enemies.indexOf(w))),
    })),
    /** Every kit piece, and one's loaded shape: vertex count and top (a fallback has its stand-in's). */
    __PIECES: PIECES,
    __piece: (p: Piece) => ({ verts: pieceData(p).geometry.getAttribute('position').count, height: pieceData(p).height }),
    __PLACES: PLACES,
    /** The set each surface role is wearing right now. */
    __surfaceNow: () => Object.fromEntries((['paving', 'rock', 'wood', 'ground', 'grate'] as const).map((r) => [r, surfaceNow(r)])),
    /** What the score was last asked to play (the state is taken even before audio unlocks). */
    __music: () => musicNow(),
    /** The place he's in, and what it sounds like. */
    __look: () => {
      const p = placeNow()
      return { place: p.id, surfaces: { ...p.surfaces }, ambience: moodNow(), footsteps: p.footsteps, music: p.music }
    },
    __summon: () => {
      combat.summonNow()
      return combat.adds()
    },
    __descend: () => {
      if (run.phase !== 'crawl' || !level?.exitOpen) return false
      descend()
      return true
    },
    __snapshot: () => (save.run ? JSON.parse(JSON.stringify(save.run)) : null),
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
      exposure: world.renderer.toneMappingExposure, progress: day.shown, target: day.target, depth: dayNow().depth ?? null,
      bloom: world.bloom.threshold, rim: DAY_FX.rim, from: dayNow().depth ? DAY_SPAN[dayNow().depth!]!.from : null, to: dayNow().depth ? DAY_SPAN[dayNow().depth!]!.to : null,
    }),
    __DAY: DAY,
    __DAY_SPAN: DAY_SPAN,
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
    __areaOf: (d: number, route: RouteId = 'II') => areaOf(d, route).id,
    /** Override area III's switches for this page (design/area3/SPEC.md §12.2); null restores one. Returns what they read now. */
    __flags: (o: { line?: boolean | null; engine?: boolean | null; porter?: boolean | null; roadChoice?: 'crossroads' | 'alternate' | null } = {}) => {
      setFlags(o)
      return flagsNow()
    },
    /** The road: this run's, whether he's in the crossroads, and the save's roads. */
    __route: () => ({ route: run.route, atCrossroads: !!level?.crossroads, roads: [...save.roads], lastRoad: save.lastRoad }),
    /** The crossroads' two roads, or null anywhere else. */
    __roads: () => level?.roads?.map((r) => ({ route: r.route, x: r.at.x, z: r.at.z, open: true, armed: roadArmed.has(r.route) })) ?? null,
    /** Into the crossroads now: depth 3, its boss down, the road unchosen (and its beam save). */
    __crossroads: () => {
      Object.assign(run, { phase: 'crawl', committed: false, ending: null })
      enterCrossroads()
      hud.mode('run')
      hud.enabled = true
      writeSnapshot()
    },
    /** Walk into a road's beam and step until the crawl at depth 4. Returns the route taken. */
    __takeRoad: (r: RouteId) => {
      const road = level?.roads?.find((x) => x.route === r)
      if (!road) return null
      roadArmed.add(r)
      still.pos.set(road.at.x, 0, road.at.z)
      for (let i = 0; i < 600 && !(run.phase === 'crawl' && run.depth === 4); i++) devTick()
      return run.route
    },
    /** The Line as a level is generated (design/area3/SPEC.md §12.2), thrown away. */
    __genLine: (depth: number, seed: number) => {
      const l = genFor(depth, seed, 'III')
      const r2 = (v: number) => Math.round(v * 1e4) / 1e4
      const out = {
        place: l.place,
        lanes: (l.lanes ?? []).map((ln) => ({
          id: ln.id, kind: ln.kind, ax: ln.ax, az: ln.az, bx: ln.bx, bz: ln.bz, outA: { ...ln.outA }, outB: { ...ln.outB },
          room: ln.room ? l.rooms.indexOf(ln.room) : null, corridor: ln.corridor, period: ln.period, phase: ln.phase, lesson: ln.lesson,
        })),
        sidings: (l.sidings ?? []).map((sd) => ({ id: sd.id, room: l.rooms.indexOf(sd.room), holds: sd.holds, ax: sd.ax, az: sd.az, bx: sd.bx, bz: sd.bz })),
        packs: l.packs.map((p) => ({
          room: l.rooms.indexOf(p.room), kind: p.room.kind, kinds: p.members.map((m) => m.kind), variants: p.members.map((m) => m.variant ?? null),
          at: p.members.map((m) => [r2(m.x), r2(m.z)]), slag: p.members.some((m) => m.slag), elite: p.elite?.mod ?? null, lesson: !!p.lesson,
          template: p.template ?? null, look: p.look ?? null,
        })),
        props: l.made.props.map((p) => ({ x: r2(p.x), z: r2(p.z), piece: p.piece, room: p.room })),
        breakables: l.breakables.map((b) => ({ x: r2(b.x), z: r2(b.z) })),
        shrines: l.shrines.map((sh) => ({ x: r2(sh.x), z: r2(sh.z) })),
        gaps: l.made.gaps ?? [],
        floor: [...l.floor],
        rooms: l.rooms.map((rm) => ({
          kind: rm.kind, ci: rm.ci, cj: rm.cj, rx: rm.rx, rz: rm.rz, p: l.progressOf(rm),
          lane: !!l.lanes?.some((ln) => ln.room === rm), siding: !!l.sidings?.some((sd) => sd.room === rm),
        })),
        tall: l.made.tall.map((t) => ({ what: t.what, x: r2(t.x), z: r2(t.z) })),
      }
      l.dispose()
      return out
    },
    /** The Line's constants, live (checks may override the shove). */
    __LINE: LINE,
    /** The current level's lanes, with their timetable and whether each is lit. */
    __lanes: () => {
      const line = combat.line
      if (!line) return []
      const lit = new Set(line.lit())
      return line.lanes.map((l) => ({
        id: l.id, kind: l.kind, ax: l.ax, az: l.az, bx: l.bx, bz: l.bz, period: l.period, phase: l.phase, lesson: l.lesson,
        lit: lit.has(l), nextAt: line.nextAt(l), room: l.room && level ? level.rooms.indexOf(l.room) : null,
      }))
    },
    /** The Line's clock now (s). */
    __lineT: () => combat.line?.t ?? null,
    /** A tell on a lane now, as a call (with slip). Returns t0 − now in ms, or null if refused. */
    __train: (laneId: number, dir?: 1 | -1) => {
      const line = combat.line
      const lane = line?.lanes.find((l) => l.id === laneId)
      if (!line || !lane || !line.call(lane, dir)) return null
      const tr = line.trains()[line.trains().length - 1]!
      return Math.round((tr.t0 - line.t) * 1e6) / 1e3
    },
    /** Every train this level has run: its lane, direction, stage, clocks, and whom it hit ('still' or an index into __combat.enemies). */
    __trains: () => (combat.line?.trains() ?? []).map((tr) => ({
      lane: tr.lane.id, dir: tr.dir, stage: tr.stage, t0: tr.t0, at: tr.at, lesson: tr.lesson, how: tr.how,
      hit: [...combat.groupHitsOf(tr)].map((w) => (w === 'still' ? 'still' : combat.enemies.indexOf(w))),
    })),
    __trainLog: trainLog,
    __hums: () => hums.size,
    /** The road labels showing now (text and alpha). */
    __beamLabels: () => hud.beamLabels.map((l) => ({ ...l })),
    /** The alternate's dressed yard beam: the road it names, or null. */
    __yardRoad: () => (yardDressing ? { route: yardDressing.route, label: ROAD_LABEL[yardDressing.route] } : null),
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
    __save: () => JSON.parse(JSON.stringify(save)) as Save,
    /** Merge a patch into the live save and write it; null starts a fresh one (the stored copy too). */
    __setSave: (patch: Partial<Save> | null) => {
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
    __offer: () => (offered ? { id: offered.def.id, ...describePart(offered.def), tag: save.found.includes(offered.def.id) ? null : 'new', shown: document.querySelector('#offer .name')?.textContent } : null),
    /**
     * The largest save the rules allow: every part found, all 43 of still's roster
     * met (its real ids), six leaders of the longest name the generator can make on
     * each elite page, 36 cards, a snapshot.
     */
    __fillSave: () => {
      const all = PARTS.map((p) => p.id)
      const hist = Object.fromEntries(all.map((id) => [id, [999, 6, 999, 999, 999, 999, 999, 999]])) as Save['history']
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
      const notebook: Save['notebook'] = {}
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
        ...freshTally(), carried: all, deepest: Object.fromEntries(all.map((id) => [id, 6])), assemblers: Object.fromEntries(all.map((id) => [id, 2])), arbiters: Object.fromEntries(all.map((id) => [id, 1])), engines: Object.fromEntries(all.map((id) => [id, 1])),
        line: line(191), marks: [0, 32, 64, 96, 128, 160], win: 20, winT: 4.99, pushes: 9999, quiets: 9999,
      }
      Object.assign(save, {
        firstRunAt: new Date().toISOString(), runs: 9999, found: all, turned: ['flare', 'ward', 'piston', 'skitter'], hook: 'focusing-lens',
        pendingHook: { candidates: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] }, history: hist, notebook, cards,
        lastEnding: { kind: 'stopped', hour: 'afternoon', depth: 6, worn: cards[0]!.worn, cardId: cards[0]!.id, arrived: true },
        run: {
          s: 1, build: new Date().toISOString(), id: newRunId(), startedAt: new Date().toISOString(), depth: 6, seed: 999999999,
          bossFelled: true, bossLoot: ['through-line', 'borrowed-time'], strain: 19, loadout: cards[0]!.worn, tally, route: 'III',
        },
        hints: all, doorMarks: 48, roads: ['II', 'III'], lastRoad: 'III',
      } satisfies Partial<Save>)
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
      b.hit(b.hp / (b.armor * (b.open ? 1.5 : 1)) + 1e-6)
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
    /** Per depth this run: fights, pushes, dead taps, quiets, and strain in and out. The open depth reads its strain now. */
    __runStats: () => run.stats.map((st) => ({ ...st, strainOut: st.strainOut ?? run.strain })),
    /** Every press this run, down to up: ms, ready at the press, and what it did. */
    __taps: () => run.taps,
    /** The playtest POST now, as a depth's end would. */
    __savePlaytest: savePlaytest,
    /** Strain step 1's switch, as the pause screen flips it (kept per device). No argument reads it. */
    __breakRule: (on?: boolean) => {
      if (on !== undefined) setBreakRule(on)
      return combat.breakRule
    },
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
  let discarded = false
  if (save.run && save.run.s !== 1) {
    // a run this build can't read at all: it goes, and the room says so once
    save.run = null
    store.write()
    discarded = true
  }
  if (DEPTH_PARAM !== null) startRun()
  else if (save.run) resumeRun(save.run)
  else if (save.runs === 0 && FIRST_RUN_IN_MAZE && !discarded) startRun()
  else if (last && !last.arrived) enterRoom(last.kind, last.hour, last.worn)
  else enterRoom('idle', last?.hour ?? 'afternoon', last?.worn ?? [null, null, null, null])
  // PLACEHOLDER words
  if (discarded) overlay.notice("the last run couldn't be picked up")
  requestAnimationFrame(frame)
})
