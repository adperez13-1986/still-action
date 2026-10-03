import './style.css'
import * as THREE from 'three'
import { createWorld, grade } from './world'
import { Still } from './still'
import { createHud, tapAnswer, type Press } from './hud'
import { createGradePanel, apply as applyGrade } from './grade'
import { createPacer, createQuality, createReadout, FRAME_S, BEHIND_CARD_S, IDLE_ROOM_S } from './perf'
import { Combat, eliteLine, PARRY, HAND, HAND_REACH, EYE, type Archetype, type BreakForm, type CastResult, type EliteMod, type Pack } from './combat'
import { STARTING, PARTS, byId, homeSlot, onSlot, type AbilityDef, type AbilityShape, type BeatKey } from './abilities'
import { SLOT_NAMES, type SlotName } from './still'
import { TEMPER, ROMAN, tempered } from './temper'
import { presetId as weightPresetId, setPreset as setWeightPreset, weighed, baseCooldownS, WEIGHT_FEEL, WEIGHT_PRESETS, type PresetId } from './weight'
import { curveAt } from './curve'
import { MASTERY, MASTERY_FORM, MASTERY_MAX, FORM_NAME, masteryOffer, type MasteryId, type MasteryForm } from './mastery'
import { CORES, CORE_IDS, CORE_LIVE, KEYSTONES, SPEND_HUD, UPGRADES, UPGRADE_FROM, UPGRADE_MAX, WORDS, fitOf, markCap, variant, type CoreId, type KeystoneDef, type KeystoneId, type UpgradeId } from './cores'
import { STATE_IDS, pairWith, paired, type StateId } from './states'
import type { Enemy, EnemyEvent } from './enemy'
import { isBoss, Assembler } from './boss'
import { Arbiter, ARBITER, arbiterHusk } from './arbiter'
import { BOARD, ENGINE, Engine, engineHusk, engineHuskCircles, engineSleepAt } from './engine'
import { DayTracker } from './day'
import type { HazardSpec } from './hazard'
import { Line, LINE, type LineEvent, type SidingDef, type Train } from './line'
import { RANGED } from './ranged'
import { LOBBER } from './lobber'
import { Signal } from './signal'
import { Thief, type ThiefEvent, type ThiefWorld } from './thief'
import { Mender } from './mender'
import { Charger, CHARGER, PLATE as RAM_PLATE } from './charger'
import { Handcar, HANDCAR, handcarSpot } from './handcar'
import { makeTrack } from './track'
import { HIDES, debrisColor } from './hide'
import { Mite, BROOD, type Brood } from './swarm'
import * as sfx from './audio'
import * as playlog from './playlog'
import { createFieldMap } from './fieldmap'
import { HandRing } from './handring'
import { Sightline } from './sightline'
import { createCameraRig } from './camera'
import { updateMusic, musicNow } from './music'
import { updateAmbience, type AmbienceMood } from './ambience'
import { ARCH_IDS, ARCH_LIVE, AUTO, FAMILY, KIT, LAW, TRAIT, WORDS as ARCH_WORDS, fitsSlot, slotsFor, type ArchetypeId } from './archetypes'
import { setDropArchetype } from './drops'
import { Loot, LOOT, dropChance, rollPart, rollForCore, rollPicks, PEDESTALS, PEDESTALS_ON, type GroundKey, type GroundPart, type PickKind, type PickSet } from './loot'
import { createPauseScreen } from './pause'
import { createOverlay } from './ending'
import { loadKit, setSurfaces, pieceData, surfaceNow, buildInstanced, PIECES, type Piece } from './kit'
import { generateCrossroads, dressRoad, labelAlpha, RoadSmoke, ROAD_LABEL, CROSSROADS, type Dressing } from './crossroads'
import { generateLevel, generateWalkHome, makeTerrain, key, squarePosts, type Box, type Breakable, type Circle, type Level, type PackSpec, type Post, type Room, type Shrine } from './dungeon'
import type { Terrain } from './terrain'
import { Vfx, syncTells, spawned as vfxSpawned, COLD, COLD_DEEP, EMBER, SLAG_DROP } from './vfx'
import { PartFx } from './partfx'
import { MarkFx } from './markfx'
import { WakeFx } from './wakefx'
import { ShoveFx } from './ramfx'
import { ThornFx } from './thornfx'
import { TetherFx } from './tetherfx'
import { CoreShow } from './coreshow'
import type { PartEvent } from './parts'
import type { NotebookPage } from './pause'
import {
  RUN_DEPTHS, BOSS_EVERY, LEAN_HOME, FIRST_RUN_IN_MAZE, DAY, exitsAfterBoss, hourAtEnd, bossFor, areaOf,
  applyDay, dayNow, currentSat, currentGrace, fogAt, dayAt, AREAS, PLACES, WALK_PLACE, ASSEMBLER_DEF, ARBITER_DEF, ENGINE_DEF, ARBITER_AT_6, lookAt, applyDayAt,
  DAY_SPAN, DAY_FX, flag, setFlags, flagsNow, roadChoice, stepOf, roadOf, openAt, otherRoad,
  type BossDef, type BossKind, type HomeHour, type PlaceDef, type RouteId,
} from './areas'
import { createWorkshop, MARKS_MAX, type ArrivalKind, type InteractId, type Workshop } from './workshop'
import { createDrawings, HANDS, CARD_ASPECT, type Moment } from './crayon'
import { composeCard, caption } from './cards'
import { openSave, freshTally, localDate, drawerFor, trimCards, CARD_KEEP, CARD_LINES, LEADERS_MAX, type EndingKind, type RunSnapshot, type RunTally, type Save } from './save'
import { poolView, markFound, hookCandidates, toggleTurn, hang, applyHookDefault, startPart, partName, historyLine, type PoolView } from './pool'
import { assignNames, elitePage, meet, addLeader, ROSTER, ROSTER_BY_ID, WHAT, BOSS_PAGE, FRAGMENT_PAGE, LOBBER_PAGE, HEAP_PAGE, THIEF_PAGE, namesFor, roleOf, linePage, linePagesActive, setLinePages, type LineRole } from './notebook'
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
/**
 * `?core=wake|ram|thorns|tether` (DEV, with `?depth=`): the run starts wearing that core (design/buildlayer/BUILD.md §2.4); it needs no switch. Without it a dev boot is bare,
 * so every suite stays bare. A `?depth=` boot never shows the pick.
 */
const CORE_PARAM: CoreId | null = DEPTH_PARAM !== null && (CORE_LIVE as readonly (string | null)[]).includes(devParam('core')) ? (devParam('core') as CoreId) : null
/** `?arch=brawler|marksman` (DEV, with `?depth=`): the run starts as that archetype, kit worn; a `?depth=` boot never shows the pick. */
const ARCH_PARAM: ArchetypeId | null = DEPTH_PARAM !== null && (ARCH_LIVE as readonly (string | null)[]).includes(devParam('arch')) ? (devParam('arch') as ArchetypeId) : null
/** `?pick=core` (DEV): the run's start offers the core pick instead of the archetype pick (the build layer's checks drive it; A4 brings cores back as sub-styles). */
const PICK_CORE = devParam('pick') === 'core'
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
// the Line's pages (INV-N1): on only where the Line can generate, so the shipped game's names never change; once, before the first assignNames
setLinePages(flag('line') || RUN_DEPTHS === 9 || ROUTE_PARAM === 'III', save.notebook)

const world = createWorld(canvas, { arena: false })
/** The kids' drawings: captured off the canvas at each ending, kept in IndexedDB. */
const drawings = createDrawings(world.renderer)
const hintStore = {
  hinted: (id: string) => save.hints.includes(id),
  markHinted: (id: string) => {
    if (save.hints.includes(id)) return
    save.hints.push(id)
    store.write()
  },
}
const hud = createHud(hudRoot, hintStore)
/** The core's number over a body and the first fight's hint (coreshow.ts). */
const coreShow = new CoreShow(hudRoot, world.camera)
const gradePanel = createGradePanel(hudRoot, world)
const overlay = createOverlay(hudRoot)
const rig = createCameraRig(world)
const loot = new Loot(world.scene)
loot.isFound = (id) => save.found.includes(id)
const pause = createPauseScreen(hudRoot)
const vfx = new Vfx(world.scene)
/** At most 60 drawn frames a second, fewer behind a card; a coarser buffer when frames run long. */
const pacer = createPacer()
const quality = createQuality(world)
/**
 * The perf readout: always in a dev build; on the live build only when the URL has `perf` (`?perf=1`, his ask of 2 Oct: the phone's frame rate with no dev server). Without the query
 * nothing is created. With it the readout starts on (the toggle in the grade panel still turns it off, and remembers).
 */
const PERF_QUERY = params.has('perf')
const readout = import.meta.env.DEV || PERF_QUERY ? createReadout(hudRoot, gradePanel, world, quality, PERF_QUERY) : null
/** Dev only: every onPart event, for headless checks to read back. */
const partLog: PartEvent[] = []
/** DEV: Ram's shoves since __shoveLog() was last called. */
const shoveLog: { t: number; i: number; slam: string | null; other: number | null; why: string; link: number; dmg: number }[] = []
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
/** Rime: the frost a chill leaves, and what it breaks into when it's paid or runs out. */
const ICE = new THREE.Color(0x9fb4c8)
/** What each body breaks into: its own metal (hide.ts). */
const HULK_C = debrisColor('hulk')
const SENTINEL_C = debrisColor('sentinel')
const LOBBER_C = debrisColor('lobber')
const SIGNAL_C = debrisColor('signal')
const HANDCAR_C = debrisColor('handcar')
const RAM_C = debrisColor('ram')
const RAM_JOINT_C = new THREE.Color(HIDES.ram.joint)
const PLATE_C = new THREE.Color(RAM_PLATE)
const MITE_C = debrisColor('mite')
const THIEF_C = debrisColor('thief')
const MENDER_C = debrisColor('mender')
function metalOf(e: Enemy | undefined): THREE.Color {
  if (!e) return HULK_C
  if (e.kind === 'ranged') return e.variant === 'lobber' ? LOBBER_C : e.variant === 'signal' ? SIGNAL_C : SENTINEL_C
  return e.kind === 'charger' ? (e.variant === 'handcar' ? HANDCAR_C : RAM_C) : e.kind === 'swarm' ? MITE_C : e.kind === 'thief' ? THIEF_C : e.kind === 'mender' ? MENDER_C : HULK_C
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
// ask the browser to keep the save (the corkboard, the doorframe) rather than clear it under pressure
try {
  void navigator.storage?.persist?.().catch(() => {})
} catch {
  // no storage manager: the save is as durable as the browser makes it
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
  add: () => {},
}
const STEP = 1 / 60
const MAX_FRAME = 0.25

/** Hit feel lives here: a few frames of frozen time and a kick to the camera. */
let hitstop = 0
let shake = 0
/** Push signatures made (the embers of a real push), counted in DEV for the weight trial's checks (__fx). */
let pushSig = 0
/** Hits landed during the cast being resolved: Piston sounds different when it connects. */
let castHits = 0

/**
 * The "weight" trial's freeze (design/lean/WEIGHT.md §2.3), the only path for the freezes it lists; every other hitstop line stays as it was.
 * Freezes less than `mergeS` of game time apart merge: the later one adds only what it has over the one already running (game time stands
 * still inside a freeze, so a freeze's start and end are the same t). `src` splits what was added in the depth's log.
 */
let freezeAt = -Infinity
let freezeLen = 0
function freeze(ms: number, src: 'part' | 'auto') {
  const t = combat.time
  const since = t - freezeAt
  const merge = since >= 0 && since < WEIGHT_FEEL.freeze.mergeS
  const add = merge ? Math.max(0, ms - freezeLen) : ms
  if (merge) hitstop += add / 1000
  else hitstop = Math.max(hitstop, ms / 1000)
  freezeLen = merge ? Math.max(freezeLen, ms) : ms
  freezeAt = t
  const st = run.stats[run.stats.length - 1]
  if (st) st[src === 'part' ? 'freezePartMs' : 'freezeAutoMs'] += add
}
/** The head's pierce count (weight, design/lean/WEIGHT.md §2.6): the tick climbs a semitone per head contact less than 0.2 s of game time after the last. */
let headAt = -Infinity
let headK = 0
/** Who dealt the killing blow of the body being buried (onFelled comes just before its onKill). */
let killBy: 'part' | 'auto' | 'other' = 'other'

/** How high each hop arcs. Flat is a dash, an arc is a hop: height is how you tell them apart. */
const HOP_H: Partial<Record<BeatKey, number>> = { skitter: 0.35, spring: 0.9 }

/** The hand's reach on the floor round Still (design/variety/PITCHES.md 2). */
const handRing = new HandRing(HAND_REACH)
world.scene.add(handRing.mesh)
/** The eye's sightline to the body it has chosen (design/variety/PITCHES.md 3). */
const sightline = new Sightline()
world.scene.add(sightline.mesh)

const combat = new Combat(world.scene, OPEN, {
  onPartDamage: (damage) => {
    const st = run.stats[run.stats.length - 1]
    if (st) st.partDmg = (st.partDmg ?? 0) + damage
  },
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
      // weight: the open hatch keeps its beat (it teaches the hatch); every other hit freezes nothing
      hitstop = Math.max(hitstop, 0.06)
    } else {
      // shut plate soaks it: a quieter hit and a dull one under it
      if (e instanceof Charger && e.plated) {
        sfx.hit(pan, 0.7)
        sfx.plateDull(pan)
      } else sfx.hit(pan)
      vfx.sparks(at3(at, 1.0), COLD, 8, 6.5, away, 0.9)
      if (!combat.weight) hitstop = Math.max(hitstop, 0.045)
    }
    vfx.flash(at3(at, 1.0), COLD_DEEP, 0.35)
    if (!combat.weight) shake = Math.max(shake, 0.1)
  },
  onPlayerHurt: (amount, _source, braced) => {
    const hurtSt = run.stats[run.stats.length - 1]
    if (hurtSt) hurtSt.hpLost = (hurtSt.hpLost ?? 0) + amount
    sfx.hurt()
    if (braced) {
      // planted, the eye took half: a cold flash over fewer embers, and he barely rocks
      sfx.braced(0)
      const st = run.stats[run.stats.length - 1]
      if (st) st.braced = (st.braced ?? 0) + 1
      vfx.sparks(at3(still.pos, 1.2), EMBER, 5, 4)
      vfx.flash(at3(still.pos, 1.2), COLD, 0.8)
      hitstop = Math.max(hitstop, 0.05)
      shake = Math.max(shake, 0.25)
      rig.punch(-0.015)
      navigator.vibrate?.(15)
      return
    }
    // a pressure body's small hit is a nick, not a blow: a crowd of them must not freeze the game
    const nick = amount <= 5
    vfx.sparks(at3(still.pos, 1.2), EMBER, nick ? 6 : 12, 5)
    vfx.flash(at3(still.pos, 1.2), EMBER, nick ? 0.35 : 0.6)
    hitstop = Math.max(hitstop, nick ? 0.025 : 0.09)
    shake = Math.max(shake, nick ? 0.2 : 0.5)
    rig.punch(nick ? -0.015 : -0.03)
    navigator.vibrate?.(nick ? 12 : 30)
  },
  onKill: (at, kind, pack, wasElite, summoned, weight, e) => {
    run.killed = true
    felled(kind, pack, wasElite, summoned, weight, pageOf(e, pack))
    if (e instanceof Mender) menderDown(e)
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
    const killShake = combat.weight && killBy === 'auto' ? WEIGHT_FEEL.autoKillShake : 1
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
      shake = Math.max(shake, 0.3 * killShake)
    } else {
      // it comes apart: chunks of its own metal, a burst of embers, a puff of grit
      vfx.chunks(at3(at, 0.8), 12, metalOf(e), 5.5, 0.18)
      vfx.sparks(at3(at, 0.9), EMBER, 16, 6)
      vfx.flash(at3(at, 0.9), EMBER, 0.9)
      vfx.dust(at, 8, 0.8)
      shake = Math.max(shake, 0.28 * killShake)
    }
    maybeDrop(at, kind, pack, wasElite, summoned, weight)
    // weight: a part's kill freezes 90 ms, an auto's 35 (and shakes half); anything else keeps 80
    if (combat.weight && killBy !== 'other') freeze(killBy === 'part' ? WEIGHT_FEEL.killMs.part : WEIGHT_FEEL.killMs.auto, killBy)
    else hitstop = Math.max(hitstop, 0.08)
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
    markFx.event(ev)
    thornFx.event(ev)
    if (ev.kind === 'thorns') thornsEvent(ev)
    tetherFx.event(ev)
    if (ev.kind === 'tether') tetherEvent(ev)
    if (ev.kind === 'mark' || ev.kind === 'markExpired' || ev.kind === 'spend' || ev.kind === 'skim' || ev.kind === 'bite' || ev.kind === 'trailFrost') coreEvent(ev)
    if (ev.kind === 'backhand') {
      const st = run.stats[run.stats.length - 1]
      if (st?.backhand) {
        st.backhand.casts++
        if (ev.whiff) st.backhand.whiffs++
      }
    }
    if (ev.kind === 'shove') {
      shoveEvent(ev)
      if (import.meta.env.DEV) shoveLog.push({ t: combat.time, i: combat.enemies.indexOf(ev.enemy), slam: ev.slam, other: ev.other ? combat.enemies.indexOf(ev.other) : null, why: ev.why, link: ev.link ?? 0, dmg: ev.dmg })
    }
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
      if (ev.parry && combat.parryCatch && combat.time - parryReadyAt >= PARRY_CATCH.capS) {
        parryReadyAt = combat.time
        parryReadyPending = true
        const st = run.stats[run.stats.length - 1]
        if (st) st.parryReadies = (st.parryReadies ?? 0) + 1
      }
      // a pressure hulk has no windup but a counter's crouch: this broke one. A caught tell (Parry, R3) is not that, and is counted apart
      if (ev.tell) {
        const c = run.stats[run.stats.length - 1]?.catches
        if (c) c[ev.enemy.kind === 'chaser' ? 'hulk' : ev.enemy.kind === 'ranged' ? 'sentinel' : 'mite']++
      } else if (ev.enemy.kind === 'chaser' && ev.enemy.pressure) {
        const lg = run.stats[run.stats.length - 1]?.lunges
        if (lg) lg.broken++
      }
      if (ev.push) {
        const st = run.stats[run.stats.length - 1]
        if (st) {
          st.breaks++
          st.breaksBy[ev.ready ? 'ready' : 'pushed']++
        }
        // a ram broken by a push reels with its hatch open: dazed, and the slam when it shuts
        const c = ev.enemy
        if (c instanceof Charger && c.stunned && run.phase === 'crawl') loops.set(c, sfx.dazed(CHARGER.reelMs, panOf(c.pos)))
      }
      breakFx(ev.enemy, ev.by)
    }
    if (ev.kind === 'state') {
      logState(ev)
      // the pay is loud: the state breaks with its own look (the mark's brackets slam in partFx) and
      // one shared cold sound. On a body that dies, the kill burst is enough.
      if (ev.state === 'paid' && !ev.killed) {
        sfx.statePaid(panOf(ev.enemy.pos))
        hitstop = Math.max(hitstop, 0.06)
        if (ev.id === 'chilled') chillBreak(ev.enemy)
      }
      if (ev.id === 'chilled' && ev.state === 'expired') {
        // the frost falls off it: three pale chunks and a glass tick
        vfx.chunks(at3(ev.enemy.pos, 0.6), 3, ICE, 2, 0.08)
        sfx.chillEnd(panOf(ev.enemy.pos))
      }
    }
    if (ev.kind === 'shatter') shatterFx(ev)
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
    const st = run.stats[run.stats.length - 1]
    if (st) st.shots++
  },
  onEye: (what) => {
    const st = run.stats[run.stats.length - 1]
    if (!st) return
    if (what === 'shot') st.eye++
    else st.eyeCasts++
  },
  onLance: (_e, broke) => {
    const st = run.stats[run.stats.length - 1]
    if (!st) return
    st.autoDmg = { hand: st.autoDmg?.hand ?? 0, eye: (st.autoDmg?.eye ?? 0) + EYE.damage, core: st.autoDmg?.core ?? 0 }
    if (broke) st.eyeBreaks = (st.eyeBreaks ?? 0) + 1
  },
  onAutoDmg: (form, damage) => {
    const st = run.stats[run.stats.length - 1]
    if (st?.autoDmgReal) st.autoDmgReal[form] += damage
  },
  onBank: (what) => {
    const st = run.stats[run.stats.length - 1]
    if (!st) return
    if (what === 'spent') st.bankBeats = (st.bankBeats ?? 0) + 1
    else st.emptyBeats = (st.emptyBeats ?? 0) + 1
  },
  onFelled: (_e, by) => {
    killBy = by
    const st = run.stats[run.stats.length - 1]
    if (st?.kills) st.kills[by]++
  },
  onContact: (ev) => {
    // weight (design/lean/WEIGHT.md §2.3): the feel of a part's strike, once per cast, sized by how many bodies and how heavy the part is
    const F = WEIGHT_FEEL
    const extra = ev.n - 1
    freeze(Math.min(F.freeze.capMs, Math.round(F.freeze.baseMs + F.freeze.perCdS * baseCooldownS(ev.def) + F.freeze.perBodyMs * extra)), 'part')
    shake = Math.max(shake, Math.min(F.contactShake[2]!, F.contactShake[0]! + F.contactShake[1]! * extra))
    rig.punch(Math.min(F.contactPunch[2]!, F.contactPunch[0]! + F.contactPunch[1]! * extra))
    navigator.vibrate?.(Math.min(F.contactHapticMs[2]!, F.contactHapticMs[0]! + F.contactHapticMs[1]! * extra))
    // a crowd struck at once flashes less per body (1/sqrt n): five hulks stay five under bloom, not one white blob (lead's review, W4)
    if (ev.n > 1) for (const b of ev.bodies) b.dimFlash?.(1 / Math.sqrt(ev.n))
    // the slot's own voice (§2.6). Sound and one body's tilt: nothing is emitted at struck bodies, so a crowd's brightness is what it was
    let k = 0
    if (ev.slot === 'head') {
      const since = combat.time - headAt
      k = since >= 0 && since < 0.2 ? headK + 1 : 0
      headK = k
      headAt = combat.time
      // the first body of a pierce rocks back from Still; the ones after it only tick
      if (k === 0) partFx.flinch(ev.first, ev.first.pos.x - still.pos.x, ev.first.pos.z - still.pos.z)
    }
    sfx.contact(ev.slot, ev.n, panOf(ev.at), k)
  },
  onTrigger: (by, e, how) => {
    // a boss can't be broken: its opening's first hit plays the break it would have been
    if (how === 'opening') {
      breakFx(e, by)
      const st = run.stats[run.stats.length - 1]
      if (st) st.openings = (st.openings ?? 0) + 1
    }
  },
  onHand: (e, broke) => {
    // melee, not a bolt: the clamp's clacks, a short knock, a few sparks off the near side, half the shot's hitstop
    const at = e.pos
    sfx.hand(panOf(at))
    still.attack({ beat: 'hand', pushed: false })
    handRing.strike()
    const toward = new THREE.Vector3(still.pos.x - at.x, 0, still.pos.z - at.z)
    const d = Math.max(1e-3, toward.length())
    const face = at3(new THREE.Vector3(at.x + (toward.x / d) * e.radius, 0, at.z + (toward.z / d) * e.radius), 0.9)
    vfx.sparks(face, COLD, 5, 4.5, toward.multiplyScalar(-1), 0.9)
    vfx.flash(face, COLD_DEEP, 0.2)
    // a broken windup holds a beat longer, like a parry
    if (!combat.weight) hitstop = Math.max(hitstop, broke ? 0.05 : 0.022)
    shake = Math.max(shake, 0.06)
    const st = run.stats[run.stats.length - 1]
    if (st) {
      st.hand++
      st.autoDmg = { hand: (st.autoDmg?.hand ?? 0) + HAND.damage, eye: st.autoDmg?.eye ?? 0, core: st.autoDmg?.core ?? 0 }
      if (broke) st.handBreaks = (st.handBreaks ?? 0) + 1
    }
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
      const def = rollPart('chaser', taken, 'crate', pool())
      if (def) {
        logDrop(floorPart(def, at, still.pos), 'crate')
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
    for (const e of pack.members) {
      if (!(e instanceof Mender) || mendersMet.has(e)) continue
      mendersMet.add(e)
      const st = mendStats()
      if (st) st.met++
    }
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
    // a pressure hulk's crouch has its own voice (the counter event), not the heavy's ratchet
    if (e.pressure) return
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
    // the Signalman's call (B4): six ratchet clicks over a low lamp hum, not the sentinel's aim whistle
    if (e.variant === 'signal') {
      windups.set(e, sfx.asVoice(sfx.semaphore(ms, panOf(e.pos), windupGain())))
      return
    }
    // the Handcar's tracking is the pump's clank at 3 Hz (B5), and its lock is heard from the lock event: never the ram's engine
    if (e instanceof Handcar) {
      windups.set(e, sfx.pump(ms, HANDCAR.lockAt, panOf(e.pos), windupGain()))
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
    // a counter's lunge leaving: air and a push off the floor, dust kicked up behind it, not the swipe's slam
    if (lunging.delete(e)) {
      sfx.lunge(panOf(e.pos))
      const back = new THREE.Vector3(still.pos.x - e.pos.x, 0, still.pos.z - e.pos.z).normalize().negate()
      vfx.dust(at3(e.pos, 0), 10, 0.9, undefined, 4)
      vfx.sparks(at3(e.pos, 0.15), EMBER, 5, 3, back, 0.5)
      return
    }
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
    } else if (e instanceof Engine) {
      // the jet is steam; the cinder is lobbed from the stack and whistles down as the Arbiter's shell does
      if (e.strikeKind === 'cinder') {
        sfx.mortar(panOf(e.pos))
        sfx.whistle(ENGINE.cinder.flightMs, panOf(e.pos))
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
      // a Sleeper rising out of the gravel: a crunch and a little dust, no ember (the Line's gravel has nothing burning in it)
      if (ev.brood.ballast) {
        sfx.gravelRise(panOf(ev.at))
        vfx.dust(ev.at, 3, 0.35, undefined, 2)
        break
      }
      // one mite out of the slag heap: a spit of embers off its coal, and a pop
      vfx.embers(at3(ev.at, 0.15), 6, 0.3)
      sfx.pop(panOf(ev.at))
      break
    case 'arbiter':
      arbiterBeat(ev)
      break
    case 'engine':
      engineBeat(ev)
      break
    case 'lock':
      // the Arbiter's aim sets with a clank of its brake (the others' locks are in their windup voices)
      if (ev.e instanceof Arbiter) sfx.servoLock(panOf(ev.e.pos))
      break
    case 'mend':
      if (ev.what === 'cut') cableCut(ev)
      break
    case 'counter':
      counterBeat(ev)
      break
    case 'call':
      // the arm is down: the voice has run its course, and a spark leaves the lamp if the Line took the call
      windups.delete(ev.e)
      if (ev.called && ev.e instanceof Signal) {
        const lamp = ev.e.lampPoint(new THREE.Vector3())
        vfx.sparks(lamp, EMBER, 6, 3, new THREE.Vector3(0, 1, 0), 0.6)
        vfx.flash(lamp, EMBER, 0.5)
      }
      break
  }
}

/** Where a lever stands, as a point. */
const leverAt = (e: Engine, side: 'right' | 'left') => new THREE.Vector3(e.track.levers[side].x, 0, e.track.levers[side].z)

/**
 * The Engine's instants (STAGE-C.md 2.9): its whistle, a lever's window, the throw, the derail (a heavy hit: the camera shakes), a
 * judder, a wagon's roll and its end. The steam and the cinder are heard from its windup cues and its strikes (onWindup, onStrike).
 */
function engineBeat(ev: Extract<EnemyEvent, { kind: 'engine' }>) {
  if (!(ev.e instanceof Engine)) return
  const pan = panOf(ev.at)
  switch (ev.what) {
    case 'whistle':
      sfx.horn(pan)
      break
    case 'window':
      // the chime comes from the lever it opens
      if (ev.side) sfx.pointsChime(panOf(leverAt(ev.e, ev.side)))
      break
    case 'throw':
    case 'throwBack':
      // the latch and the clack of the lever going over (thrown by Still's cast, or by the engine itself when he stood in the arm)
      if (ev.side) {
        const pl = panOf(leverAt(ev.e, ev.side))
        sfx.latch(pl, 1.2)
        sfx.clack(pl, 1)
      }
      break
    case 'derail':
      sfx.ramCrash(pan, false)
      shake = Math.max(shake, DERAIL_SHAKE)
      break
    case 'judder':
      sfx.judder(ev.ms ?? ENGINE.reverse.judderMs, pan)
      break
    case 'wagon':
      // the tub's wheels over the joints, three clacks over the roll (the tell first)
      for (const ms of [ENGINE.wagon.tellMs, ENGINE.wagon.tellMs + 400, ENGINE.wagon.tellMs + 800]) window.setTimeout(() => { if (run.phase === 'crawl') sfx.clack(pan, 1) }, ms)
      break
    case 'wagonSettle':
      sfx.plateDull(pan)
      break
    case 'wagonSmash':
      sfx.smash(pan)
      break
    default:
      break
  }
}

/** The camera's shake when the Engine derails (a ram's wall hit is 0.3, a train's hit on him 0.5). */
const DERAIL_SHAKE = 0.45

/** The Engine's run, a loop that follows it: on while it moves (run, up an arm, backing out), off at hold, judder, derailed and dead. */
let engineRunState: string | null = null
function engineVoice() {
  const b = combat.boss
  if (!(b instanceof Engine)) return
  const moving = !b.dead && run.phase === 'crawl' && (b.state === 'run' || b.state === 'siding' || b.state === 'backing')
  const v = loops.get(b)
  if (!moving) {
    if (v) {
      v.stop()
      loops.delete(b)
    }
    engineRunState = null
    return
  }
  const voice = v ?? sfx.engineRun(panOf(b.pos))
  if (!v) loops.set(b, voice)
  if (engineRunState !== b.state || !v) voice.speed?.(b.state === 'backing' ? ENGINE.backSpeed / ENGINE.speed : 1)
  engineRunState = b.state
}

/** Hulks whose lunge has just begun: the strike that follows this tick is the lunge, not a swipe. */
const lunging = new WeakSet<Enemy>()

/** The counter-moves' instants (COUNTERS.md): the sound, the log. The tells are the bodies' own. */
function counterBeat(ev: Extract<EnemyEvent, { kind: 'counter' }>) {
  const st = run.stats[run.stats.length - 1]
  const pan = panOf(ev.e.pos)
  switch (ev.what) {
    case 'crouch':
      if (st?.lunges) st.lunges.started++
      if (run.phase === 'crawl') windups.set(ev.e, sfx.asVoice(sfx.crouch(ev.ms ?? 350, pan, windupGain())))
      break
    case 'lunge':
      lunging.add(ev.e)
      break
    case 'lungeHit':
      if (st?.lunges) st.lunges.hit++
      break
    case 'duck':
      if (st?.ducks) st.ducks.started++
      sfx.turnAway(pan)
      break
    case 'backaway':
      if (st?.ducks) st.ducks.backed++
      sfx.turnAway(pan)
      break
    case 'peek':
      if (st?.ducks) st.ducks.peeked++
      break
  }
}

// --- the mender (mender.ts): the cable's cut, its end, the log ---

/** Menders whose pack has woken, so a pack woken twice counts once. */
const mendersMet = new WeakSet<Enemy>()
const mendStats = () => run.stats[run.stats.length - 1]?.menders

/** His body parted a cable: his cold where he crossed it, its ember whipping back both ways, and a snap. */
function cableCut(ev: Extract<EnemyEvent, { kind: 'mend' }>) {
  const st = mendStats()
  if (st) st.cut++
  const at = at3(ev.at, 0.15)
  vfx.flash(at, COLD, 0.9)
  vfx.sparks(at, COLD, 14, 5)
  combat.ring(ev.at, 0.2, 1.0, 0.25, 0x8fb8e8, true)
  // each half's ember thrown back along it as it whips home
  for (const end of [ev.from, ev.to]) {
    if (!end) continue
    const dir = new THREE.Vector3(end.x - ev.at.x, 0.35, end.z - ev.at.z).normalize()
    vfx.sparks(at, EMBER, 8, 7, dir, 0.3)
    for (let i = 1; i <= 3; i++) vfx.sparks(new THREE.Vector3().lerpVectors(ev.at, end, i / 4).setY(0.15), EMBER, 2, 2)
  }
  sfx.cableSnap(panOf(ev.at))
  shake = Math.max(shake, 0.12)
  hitstop = Math.max(hitstop, 0.03)
}

/** A mender killed: counted, its last HP logged, and a live cable goes dark in a line of embers. */
function menderDown(m: Mender) {
  const st = mendStats()
  if (st) {
    st.killed++
    st.healed += m.flush()
  }
  if (!m.patient) return
  const [a, b] = m.cableEnds()
  for (let i = 1; i <= 6; i++) vfx.embers(new THREE.Vector3().lerpVectors(a, b, i / 7).setY(0.1), 1, 0.15)
}

/** Each frame: what the cables mended goes in the log. */
function menderLog() {
  const st = mendStats()
  for (const e of combat.enemies) if (e instanceof Mender && st) st.healed += e.flush()
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
      // the stack spits as the lane sets; a Handcar has no stack: the pump latches and its seam spits (and no smoke)
      if (c instanceof Handcar) {
        sfx.latch(pan, windupGain())
        vfx.embers(c.seamPoint(new THREE.Vector3()), 4, 0.15)
        rig.punch(0.01)
        break
      }
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
  // a Handcar has no stack, no hooves and no fire to bank: none of a ram's smoke, embers or grit
  const rams = combat.enemies.filter((e): e is Charger => e instanceof Charger && !(e instanceof Handcar))
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
  if (!(c instanceof Handcar)) vfx.smokePuff(c.stackMouth(new THREE.Vector3()), 2)
  shake = Math.max(shake, 0.4)
  // the first stun of the run holds a beat longer: it teaches the hatch once
  const first = !run.ramStunSeen
  run.ramStunSeen = true
  hitstop = Math.max(hitstop, first ? 0.12 : 0.07)
  rig.punch(first ? 0.04 : 0.03)
}

const partFx = new PartFx(world.scene, vfx, still, combat.parts, combat)
/** The core's marks, drawn on the floor at the bodies' feet (markfx.ts): a few instanced draw calls, whatever the number of marked bodies. */
const markFx = new MarkFx(world.scene)
/** Wake's field round Still and the streak where he walked (wakefx.ts): two draw calls, only with Wake worn. */
const wakeFx = new WakeFx(world.scene)
/** Ram's reach ring and what a slam leaves on the floor (ramfx.ts): two draw calls, only with Ram worn. */
const shoveFx = new ShoveFx(world.scene)
/** Thorns' armed ring at his feet and Bramble Patch's patches (thornfx.ts): one draw call (the ring is markfx's second), only with Thorns worn. */
const thornFx = new ThornFx(world.scene)
/** Tether's wire and the hook glyph over its anchor (tetherfx.ts): two draw calls (the ring is markfx's third), only with Tether worn. */
const tetherFx = new TetherFx(world.scene)
/** A new level or a run's end: no rings, no field, no streak, no number. */
function clearCoreFx() {
  markFx.clear()
  wakeFx.clear()
  shoveFx.clear()
  thornFx.clear()
  tetherFx.clear()
  coreShow.clear()
}
/** His walk pace as still.ts has it (Slipstream multiplies it for a moment and only ever through this). */
const STILL_WALK = still.speed

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

/**
 * A windup broken, or a boss's opening taken as one: the tell shatters, the break's tone, and the
 * moment holds. The hand's break shatters ember, the eye's cold with a frost ring; a part's as always.
 */
function breakFx(e: Enemy, by?: BreakForm) {
  const color = by === 'hand' ? EMBER : COLD
  const at = at3(e.pos, 1.0)
  tellBreak(e, color)
  sfx.parryBreak(panOf(e.pos))
  vfx.flash(at, color, 1.0)
  vfx.sparks(at, color, 16, 7)
  if (by === 'eye') {
    vfx.frost(at3(e.pos, 0.4), 10, e.radius + 0.4)
    vfx.chunks(at, 5, new THREE.Color(0x9fc0ff), 4, 0.08)
  }
  vfx.dust(e.pos, 8, 0.6)
  if (combat.weight) {
    // weight: the hand's and the eye's break is a tick (35 ms); a part's is the Anvil's weight (90 ms and its haptic)
    if (by) freeze(WEIGHT_FEEL.breakMs.auto, 'auto')
    else {
      freeze(WEIGHT_FEEL.breakMs.part, 'part')
      navigator.vibrate?.(WEIGHT_FEEL.breakHaptic)
      // the Anvil catch's heft, minus its light: a shake and a punch, a heavy voice. No flash, no sparks beyond today's
      shake = Math.max(shake, 0.4)
      sfx.breakHeavy(panOf(e.pos))
    }
  } else hitstop = Math.max(hitstop, 0.09)
  rig.punch(combat.weight && !by ? 0.07 : 0.05)
}

/** A chill paid on a body that lives: the rime bursts off it outward, a cold ring on the floor under it. */
function chillBreak(e: Enemy) {
  const at = at3(e.pos, 0.9 * e.size)
  vfx.flash(at, COLD, 1.1)
  vfx.sparks(at, COLD, 22, 7)
  vfx.chunks(at3(e.pos, 0.7 * e.size), 10, ICE, 5, 0.12)
  vfx.frost(at, 12, e.radius + 0.6)
  combat.ring(e.pos, 0.3, e.radius + 1.6, 0.4, 0x8fb8e8, true)
}

/** Shatter: the kill's leftover flies on as ice, a cold streak from where it fell to the body it lands in. */
/** Wake's skim slash (SHOW.md item 4): `SLASH_PTS` trail points over `SLASH_LEN` u. A mark's tick is at least this many game seconds after the last one. */
const SLASH_PTS = 5
const SLASH_LEN = 1
const MARK_TICK_GAP = 0.05
let lastTickT = -Infinity

/**
 * A spend, seen (SHOW.md items 1 and 2): `+bonus` over the body, the rings breaking outward (markfx.ts reads the same event), a flash at its feet and a few ice shards, thrown the same way every
 * time (index-spread, no random). From two marks a hitstop of 0.03, on the same rule as a slam's (with weight on, combat holds its own). The first spend takes the first fight's hint away.
 */
function spendFx(ev: Extract<PartEvent, { kind: 'spend' }>) {
  const e = ev.enemy
  coreShow.spend(e.pos.x, e.labelY * e.size, e.pos.z, ev.n, ev.bonus)
  if (coreShow.hinting) coreShow.hint(null)
  vfx.flash(at3(e.pos, 0.35), COLD, 0.9 + 0.2 * Math.min(ev.n, 3))
  vfx.shards(at3(e.pos, 0.5), COLD, 4 + 2 * Math.min(ev.n, 4), 5 + Math.min(ev.n, 3), ev.n * 0.7)
  if (ev.n >= 2 && !combat.weight) hitstop = Math.max(hitstop, 0.03)
}

/**
 * The build layer's events (BUILD.md §2.9, §2.11): the log (marks made, spent, expired; spends and how soon after the first mark; Wake's skims) and the look
 * and sound. A spend drains the body's rings (markfx.ts reads the same event); marks that run out unspent fizzle, faintly.
 */
function coreEvent(ev: Extract<PartEvent, { kind: 'mark' | 'markExpired' | 'spend' | 'skim' | 'bite' | 'trailFrost' }>) {
  const st = run.stats[run.stats.length - 1]
  if (ev.kind === 'mark') {
    if (st?.marks) {
      st.marks.made += ev.added
      if (ev.by === 'core') st.marks.byCore += ev.added
      else st.marks.byPart += ev.added
    }
    // a soft cold tick, a step up the chord with the stack; a pack marked at once is one tick, not twenty
    if (ev.added > 0 && combat.time - lastTickT >= MARK_TICK_GAP) {
      lastTickT = combat.time
      sfx.markTick(ev.n, panOf(ev.enemy.pos))
    }
    return
  }
  if (ev.kind === 'markExpired') {
    if (st?.marks) st.marks.expired += ev.n
    sfx.fizzle(panOf(ev.enemy.pos))
    return
  }
  if (ev.kind === 'spend') {
    if (st?.marks && st.spends) {
      st.marks.spent += ev.n
      st.spends.hits++
      st.spends.bonus += ev.bonus
      st.spends.lag[ev.lagS <= 1 ? 0 : ev.lagS <= 2 ? 1 : ev.lagS <= 4 ? 2 : 3]++
      // Burst is the core's own hit: the autos' nominal, beside the skim's
      if (ev.payer === 'core' && st.autoDmg) st.autoDmg.core += ev.bonus
    }
    fightSpends++
    sfx.spend(ev.n, panOf(ev.enemy.pos))
    spendFx(ev)
    return
  }
  if (ev.kind === 'bite') {
    // frostbite (WAKE2.md): the log, and a tiny cold mote, no sound: the spend stays the loudest thing the core does
    if (st) {
      (st.skims ??= { n: 0, burst: 0, spray: 0, bite: 0 }).bite += ev.dmg
      if (st.autoDmg) st.autoDmg.core += ev.dmg
    }
    vfx.frost(at3(ev.enemy.pos, 0.6 * ev.enemy.size), 1, ev.enemy.radius * 0.5)
    return
  }
  if (ev.kind === 'trailFrost') {
    // the trail frosted a body: the ribbon under it brightens
    wakeFx.trailFrost(ev.x, ev.z)
    return
  }
  // a skim: Wake passed beside a body
  if (st) {
    const k = (st.skims ??= { n: 0, burst: 0, spray: 0, bite: 0 })
    k.n++
    if (ev.burst) k.burst++
    if (ev.spray) k.spray++
    if (st.autoDmg) st.autoDmg.core += CORES.wake.damage
  }
  const e = ev.enemy
  // a cold slash along the body's near side, across the line from him to it, and one frost mote; the field round him flashes
  const dx = still.pos.x - e.pos.x
  const dz = still.pos.z - e.pos.z
  const d = Math.hypot(dx, dz) || 1
  const nx = e.pos.x + (dx / d) * e.radius * 0.8
  const nz = e.pos.z + (dz / d) * e.radius * 0.8
  for (let i = 0; i < SLASH_PTS; i++) {
    const k = (i / (SLASH_PTS - 1) - 0.5) * SLASH_LEN
    // the middle is the thickest and the longest-lit
    const mid = 1 - Math.abs(2 * i / (SLASH_PTS - 1) - 1)
    vfx.trail(new THREE.Vector3(nx - (dz / d) * k, 0.5, nz + (dx / d) * k), COLD, 0.14 + 0.1 * mid, 0.22 + 0.1 * mid)
  }
  vfx.frost(new THREE.Vector3(nx, 0.5, nz), 1, 0.12)
  wakeFx.skim()
  if (ev.burst) {
    // Burst: the third ring breaks the body open, a cold pop
    vfx.flash(at3(e.pos, 0.8), COLD, 0.8)
    vfx.sparks(at3(e.pos, 0.8), COLD, 10, 5)
  }
  if (ev.spray) {
    // Spray: a cold spray line between the two bodies
    const o = ev.spray
    for (let i = 1; i <= 4; i++) {
      const k = i / 5
      vfx.trail(new THREE.Vector3(e.pos.x + (o.pos.x - e.pos.x) * k, 0.5, e.pos.z + (o.pos.z - e.pos.z) * k), COLD, 0.16, 0.4)
    }
  }
}

/**
 * Ram's shove (BUILD.md §2.6, §2.11): the log (what each shove hit: `shoves`, and `beat` for the core's own beat shoves alone, which the slam line reads), the nominal core damage, and the look
 * and sound. A shove is the hand's clack and a few cold sparks; a slam adds a dry knock and cold sparks at the contact point (combat.ts drew the cold ring). Rubble's stone is cold dust at the wall.
 */
function shoveEvent(ev: Extract<PartEvent, { kind: 'shove' }>) {
  const st = run.stats[run.stats.length - 1]
  if (st) {
    const k = (st.shoves ??= { n: 0, wall: 0, body: 0, still: 0, tell: 0, plain: 0, chained: 0, caught: 0, beat: { n: 0, wall: 0, body: 0, still: 0, tell: 0 } })
    k.n++
    if (ev.slam) k[ev.slam]++
    else k.plain++
    if (ev.why === 'chain') k.chained++
    if (ev.why === 'catch') k.caught++
    if (ev.why === 'beat') {
      k.beat.n++
      if (ev.slam) k.beat[ev.slam]++
    }
    if (st.autoDmg) st.autoDmg.core += ev.dmg
  }
  const pan = panOf(ev.enemy.pos)
  const own = ev.why === 'beat' || ev.why === 'catch'
  if (own) {
    // the core's own shove: the hand's clack and the swing, a little cold off the near face
    sfx.hand(pan)
    // the wedge of the reach ring that faces the body lights and travels out
    shoveFx.pulse(ev.enemy.pos.x - still.pos.x, ev.enemy.pos.z - still.pos.z)
    still.attack({ beat: 'hand', pushed: false })
    const toward = new THREE.Vector3(still.pos.x - ev.enemy.pos.x, 0, still.pos.z - ev.enemy.pos.z)
    const d = Math.max(1e-3, toward.length())
    const face = at3(new THREE.Vector3(ev.enemy.pos.x + (toward.x / d) * ev.enemy.radius, 0, ev.enemy.pos.z + (toward.z / d) * ev.enemy.radius), 0.9)
    vfx.sparks(face, COLD, 4, 4, toward.clone().multiplyScalar(-1), 0.9)
  }
  if (ev.slam) {
    sfx.slam(pan)
    const at = at3(ev.at, 0.7)
    vfx.sparks(at, COLD, 8, 5)
    vfx.flash(at, COLD_DEEP, 0.3)
    // a slam is the loudest thing Ram does (SHOW.md item 10b): the body's path as a steel streak, a crack where it hit, and a ring of sparks thrown the same way every time. No flash on the body itself.
    shoveFx.slammed(ev.enemy.pos.x, ev.enemy.pos.z, ev.at.x, ev.at.z)
    vfx.shards(at3(ev.at, 0.6), COLD, 12, 7, ev.at.x * 1.7 + ev.at.z)
    if (!combat.weight) hitstop = Math.max(hitstop, 0.03)
    shake = Math.max(shake, 0.12)
  }
  if (ev.rubble) {
    // Rubble: cold dust thrown at the wall, never ember-coloured
    const at = at3(ev.at, 0.5)
    vfx.frost(at, 5, 0.5)
    vfx.sparks(at, COLD, 6, 3.5)
  }
}

/**
 * Thorns (THORNS.md): the log (`thorns`: hits taken, blocks, shots, and the ones on a boss), the nominal core damage, and the look and sound: cold shards thrown from Still at the attacker along the line between them, a flash
 * on it and a barbed "tk" (a block's is bigger and deeper, with a ring of shards at his own feet and a little shake). The armed ring's flare is thornfx.ts, from the same event. A hand-spread, no random.
 */
function thornsEvent(ev: Extract<PartEvent, { kind: 'thorns' }>) {
  const st = run.stats[run.stats.length - 1]
  if (st) {
    const k = (st.thorns ??= { n: 0, hit: 0, block: 0, shot: 0, boss: 0 })
    k.n++
    if (ev.blocked) k.block++
    else if (ev.how === 'shot') k.shot++
    else k.hit++
    if (isBoss(ev.enemy)) k.boss++
    if (st.autoDmg) st.autoDmg.core += ev.dmg
  }
  sfx.thorns(ev.blocked, panOf(ev.at))
  const to = ev.enemy.pos
  const n = ev.blocked ? 7 : 5
  // a streak from his chest toward the attacker's, short of its body (a shot's owner may be far: the streak is the first 4 u of the line)
  const reach = Math.min(4, Math.max(0.5, Math.hypot(to.x - ev.at.x, to.z - ev.at.z) - ev.enemy.radius))
  for (let i = 0; i < n; i++) {
    const k = (i + 1) / n
    vfx.trail(new THREE.Vector3(ev.at.x + ev.dir.x * reach * k, 0.8 + 0.1 * Math.sin(Math.PI * k), ev.at.z + ev.dir.z * reach * k), COLD, 0.16 + 0.1 * k, 0.2 + 0.1 * k)
  }
  const mark = at3(ev.how === 'shot' ? { x: ev.at.x + ev.dir.x * reach, z: ev.at.z + ev.dir.z * reach } : to, 0.7 * ev.enemy.size)
  vfx.shards(mark, COLD, ev.blocked ? 9 : 5, ev.blocked ? 6 : 4.5, ev.at.x * 1.3 + ev.at.z)
  vfx.flash(mark, COLD, ev.blocked ? 0.9 : 0.5)
  if (ev.blocked) {
    vfx.shards(at3(ev.at, 0.5), COLD, 8, 5, ev.at.z * 1.1 + ev.at.x)
    shake = Math.max(shake, 0.1)
  }
}

/** The wire's height at a crossing (tetherfx.ts' chest height, near enough for a spark). */
const LOOK_WIRE_Y = 0.85

/**
 * Tether (CORES2.md §2): the log (`tether`: hooks, breaks, crossings, the anchors' ticks), the nominal core damage, and the look and sound. The wire itself and its flash and snap are tetherfx.ts, from the same event. A crossing is a
 * spark at the crossing point on the wire and a thin ping; a hook is a tick of cold at the anchor; a break is a dry twang. A hand-spread, no random.
 */
function tetherEvent(ev: Extract<PartEvent, { kind: 'tether' }>) {
  const st = run.stats[run.stats.length - 1]
  if (st) {
    const k = (st.tether ??= { hooks: 0, breaks: 0, crossings: 0, anchorTicks: 0 })
    if (ev.what === 'hook') k.hooks++
    else if (ev.what === 'break') k.breaks++
    else if (ev.what === 'cross') k.crossings++
    else k.anchorTicks++
    if (st.autoDmg) st.autoDmg.core += ev.dmg
  }
  const pan = panOf(ev.at)
  if (ev.what === 'hook') {
    sfx.wire('hook', pan)
    vfx.flash(at3(ev.enemy.pos, 0.7 * ev.enemy.size), COLD, 0.5)
  } else if (ev.what === 'cross') {
    sfx.wire('cross', pan)
    const at = at3(ev.at, LOOK_WIRE_Y)
    vfx.flash(at, COLD, 0.6)
    vfx.sparks(at, COLD, 5, 3.5)
    vfx.frost(at3(ev.enemy.pos, 0.5 * ev.enemy.size), 1, ev.enemy.radius * 0.5)
  } else if (ev.what === 'anchor') {
    vfx.frost(at3(ev.enemy.pos, 0.6 * ev.enemy.size), 1, ev.enemy.radius * 0.5)
  } else {
    sfx.wire('snap', pan)
    if (ev.whip) {
      // Whip: a crack down the line, cold points from where the wire was, thrown the same way every time (index-spread)
      const n = 7
      for (let i = 0; i < n; i++) {
        const k = (i + 0.5) / n
        vfx.trail(new THREE.Vector3(ev.from.x + (ev.to.x - ev.from.x) * k, LOOK_WIRE_Y, ev.from.z + (ev.to.z - ev.from.z) * k), COLD, 0.22, 0.3 + 0.1 * Math.sin(Math.PI * k))
      }
      vfx.flash(at3(ev.to, LOOK_WIRE_Y), COLD, 0.9)
    }
  }
}
function shatterFx(ev: Extract<PartEvent, { kind: 'shatter' }>) {
  const from = at3(ev.from, 0.8)
  const to = at3(ev.to, 0.9)
  const way = to.clone().sub(from)
  vfx.chunks(from, 8, ICE, 5, 0.1)
  // shards thrown down the line at it, the line itself on the floor and in the air, lingering a moment
  vfx.sparks(from, COLD, 14, Math.max(6, way.length() * 3), way, 0.35)
  partFx.beam(ev.from, ev.to, 0.22, 0.35)
  for (let k = 1; k <= 8; k++) vfx.trail(from.clone().lerp(to, k / 9), COLD_DEEP, 0.3, 0.5)
  vfx.flash(to, COLD, 0.9)
  vfx.sparks(to, COLD, 14, 6, way, 0.7)
  vfx.chunks(to, 5, ICE, 3.5, 0.09)
  sfx.iceShatter(panOf(ev.to))
  hitstop = Math.max(hitstop, 0.04)
  const st = run.stats[run.stats.length - 1]
  if (st?.shatter) {
    st.shatter.n++
    st.shatter.dmg += ev.damage
  }
}

/** One push per slot at a time, for pushedIntoState: a push that pays two bodies is still one push into a state. */
const pushSerial: Partial<Record<SlotName, number>> = {}
const pushCounted: Partial<Record<SlotName, number>> = {}
/** The slot whose push is being cast right now: its hits that land at once are the push's (a parry's say pushed: false). */
let pushing: SlotName | null = null

/**
 * The states' log (design/synergy/2-verifier.md): per depth, each state's fresh sets, pays and
 * unpaid run-outs, the bonus it added, who paid (a slot, never the hand or the eye), pushes that
 * paid one, and the largest multiplier seen.
 */
function logState(ev: Extract<PartEvent, { kind: 'state' }>) {
  const st = run.stats[run.stats.length - 1]
  if (!st?.states) return
  const s = st.states[ev.id]
  if (ev.state === 'on') s.set++
  else if (ev.state === 'expired') s.expired++
  else {
    s.paid++
    const bonus = ev.bonus ?? 0
    st.stateBonus![ev.id] += bonus
    if (ev.payer) st.paidBy![ev.payer]++
    st.maxMul = Math.max(st.maxMul ?? 1, ev.mul ?? 1)
    if ((ev.pushed || ev.payer === pushing) && ev.payer && pushCounted[ev.payer] !== pushSerial[ev.payer]) {
      pushCounted[ev.payer] = pushSerial[ev.payer]
      st.pushedIntoState = (st.pushedIntoState ?? 0) + 1
    }
  }
}

/** N9: an enemy's live tell shatters into cold shards along its own outline (ember when the hand broke it). */
function tellBreak(e: Enemy, color = COLD) {
  // a mite's piece of the ring shatters through its brood (biterLost), not round its own body
  if (e instanceof Mite) return
  if (e instanceof Charger) {
    // strewn along both rails of the lane it was drawing
    const fx = Math.sin(e.aim)
    const fz = Math.cos(e.aim)
    for (let i = 0; i < 16; i++) {
      const d = Math.random() * e.lane.len
      const side = i % 2 ? e.hitHalf : -e.hitHalf
      vfx.sparks(new THREE.Vector3(e.lane.x + fx * d + fz * side, 0.2, e.lane.z + fz * d - fx * side), color, 1, 2)
    }
  } else if (e instanceof Signal) {
    // along its arm, from the pivot to the lamp
    const from = e.pivotPoint(new THREE.Vector3())
    const to = e.lampPoint(new THREE.Vector3())
    for (let i = 0; i < 4; i++) vfx.sparks(from.clone().lerp(to, (i + 0.5) / 4), color, 1, 3)
  } else if (e.kind === 'ranged') {
    // along the aim line it was drawing
    const a = e.group.rotation.y
    for (let i = 0; i < 14; i++) {
      const d = (i / 13) * 6
      vfx.sparks(new THREE.Vector3(e.pos.x + Math.sin(a) * d, 0.2, e.pos.z + Math.cos(a) * d), color, 1, 3)
    }
  } else {
    // round the ring it was filling
    const r = 2.4 * e.size
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a))
      vfx.sparks(new THREE.Vector3(e.pos.x + dir.x * r, 0.2, e.pos.z + dir.z * r), color, 1, 3, dir, 0.3)
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
interface DepthStats {
  depth: number; fights: number; pushes: number; breaks: number; deadTaps: number; quiets: number; strainIn: number; strainOut: number | null
  /** The auto's two forms: close strikes and shots. */
  hand: number; shots: number
  /** The eye's choices: lances (every planted auto, since pass 2), and head casts it re-aimed. */
  eye: number; eyeCasts: number
  /** Windups the hand broke, and blows taken planted (halved by the eye's brace). */
  handBreaks?: number; braced?: number
  /**
   * The leanings (design/leanings/PITCHES.md): windups the eye broke; boss openings whose first hand
   * or eye hit fired a trigger; seconds planted (game time, crawl); the autos' damage by form
   * (nominal: HAND.damage a strike, EYE.damage a body the planted shot hits). Old logs also carry `riders` (fires by part id; cut 2 Oct).
   */
  eyeBreaks?: number; openings?: number; plantedS?: number
  autoDmg?: { hand: number; eye: number; core: number }
  /**
   * The follow-through trial (design/autos/BUILD-1.md), logged with the switch on or off. `followThrough`: on at this depth.
   * `autoDmgReal`: what the autos actually dealt (after a boss's half, with the hand-cleave and the eye's splits), where
   * `autoDmg` stays the nominal. `kills`: who dealt the killing blow. `fightS`: seconds with an awake body within FIGHT_NEAR
   * of Still (game time, crawl). `bankBeats`: auto beats that spent a banked one; `emptyBeats`: beats that would have fired
   * with the bank empty (always 0 with the switch off).
   */
  followThrough?: boolean
  /** The switch was flipped during this depth: its numbers are half one rule, half the other. */
  followThroughMixed?: boolean
  autoDmgReal?: { hand: number; eye: number; core: number }
  kills?: { part: number; auto: number; other: number }
  fightS?: number
  bankBeats?: number; emptyBeats?: number
  /**
   * The "weight" trial (design/lean/WEIGHT.md; the word is a PLACEHOLDER), logged with the switch on or off. `weight`: on at entry.
   * `weightMixed`: it was flipped during this depth (leave the depth out when judging). `breaksBy`: splits `breaks` by whether a real
   * push or a ready cast broke the windup (ready + pushed === breaks; ready stays 0 with the switch off). `freezeMs`: real frozen ms in
   * the crawl, all sources, measured in frame() (headless __step never runs it). `freezePartMs` / `freezeAutoMs`: what the contact
   * freeze added (after merging), by source; 0 with the switch off.
   */
  weight: boolean
  weightMixed?: true
  breaksBy: { ready: number; pushed: number }
  freezeMs: number
  freezePartMs: number
  freezeAutoMs: number
  /**
   * The "tap push" trial (design/lean/TAP-PUSH.md; PLACEHOLDER words). `tapPush`: hud.tapPush at entry. `tapPushMixed`: flipped
   * during this depth (leave it out when judging). `tapPushes`: pushes a touch made with the switch on (<= pushes; 0 off).
   * `queued` / `guarded`: touches that answered so (0 off). `queueDropped`: queues that never fired (heat, a swap, the pause,
   * the switch flipped, refused; 0 off), so free queued casts = queued - queueDropped. `strainAtBoss`: run.strain on the first
   * tick this depth's boss was awake (absent on a depth without one). Strain at a boss is now logged with the switch on or off.
   */
  tapPush: boolean
  tapPushMixed?: true
  tapPushes: number
  queued: number
  queueDropped: number
  guarded: number
  strainAtBoss?: number
  /** Seconds actually played on this depth's crawl: game time, so pauses, loot screens and the app in the background don't count. */
  playS?: number
  /** The pressure prototype on at this depth (its ordinary packs), and integrity lost here, all sources. */
  pressure?: boolean; hpLost?: number
  /**
   * The counter-moves on at this depth (COUNTERS.md), and what they did: hulk lunges begun, landed on Still and
   * broken in the crouch; sentinel ducks to cover, peeks that followed, and back-aways where there was no cover.
   */
  counters?: boolean
  lunges?: { started: number; hit: number; broken: number }
  /** Parry Clamp's caught tells (LINE-RULES R3): a pressure hulk's cock, sentinel's lens glow, mite's rear. Not `lunges.broken`. */
  catches?: { hulk: number; sentinel: number; mite: number }
  /** The parry-catch trial on at this depth, and the times a Parry snap readied Parry. */
  parryCatch?: boolean
  parryReadies?: number
  ducks?: { started: number; peeked: number; backed: number }
  /** Temper on at this depth, and parts melted into a worn one here; mastery learned here. */
  temper?: boolean; melts?: number; mastered?: string[]
  /** Parts' damage through hitPart (nominal, after a state's pay), beside `autoDmg`: the auto/part split. */
  partDmg?: number
  /**
   * Enemy states (design/synergy/2-verifier.md): per state, fresh sets, pays, and run-outs unpaid;
   * the damage pays added (nominal), by state; pays by who paid (a slot; the hand and the eye must
   * stay 0); pushes that paid one; shatters and the damage they passed on; the largest multiplier (<= 2).
   */
  states?: Record<StateId, { set: number; paid: number; expired: number }>
  stateBonus?: Record<StateId, number>
  paidBy?: Record<SlotName | MasteryForm, number>
  pushedIntoState?: number
  shatter?: { n: number; dmg: number }
  maxMul?: number
  /** Menders (mender.ts): met (their pack woke), cables cut by his body, menders killed, HP their cables restored. */
  menders?: { met: number; cut: number; killed: number; healed: number }
  /**
   * The build layer (design/buildlayer/BUILD.md §2.11), logged with the switch on or off; B1 lands the fields, B2-B5 fill them (zeros until then).
   * `core`: combat.core at entry (null: bare). `coreMixed`: only on a depth where the switch flip changed the fight (leave it out when judging).
   * `temperFlat`: the flat temper table was in force at entry. `keystone`, `upgrades`: at entry; `upgraded`: learned here. `movingS`: fight seconds with
   * the stick out. `nearBins` / `nearMovingBins`: fight seconds by distance to the nearest awake body (edges 2 / 3.5 / 6 / 11 u, 5 numbers; the second only while
   * moving). `wallS` / `closeS`: fight seconds within 2 u of a wall; and of a wall or a body. `marks`: made (the number actually added), by the core and by a
   * part, spent (by a spend or Burst) and expired unspent. `spends`: spending hits, the flat damage they added, and seconds from the stack's first mark
   * (<=1, <=2, <=4, >4). `spendsPerFight`: one number per fight closed this depth. `shoves` (Ram) and `skims` (Wake): what the core did.
   */
  core: CoreId | null
  coreMixed?: true
  temperFlat: boolean
  keystone: KeystoneId | null
  upgrades: UpgradeId[]
  upgraded?: UpgradeId[]
  movingS: number
  nearBins: number[]
  nearMovingBins: number[]
  wallS: number
  closeS: number
  marks: { made: number; byCore: number; byPart: number; spent: number; expired: number }
  spends: { hits: number; bonus: number; lag: [number, number, number, number] }
  spendsPerFight: number[]
  /** Wake's Backhand (B5, the balancer's whiff share): casts, and the ones with nothing behind him. Zeros with no Backhand worn. */
  backhand: { casts: number; whiffs: number }
  shoves?: { n: number; wall: number; body: number; still: number; tell: number; plain: number; chained: number; caught: number; beat: { n: number; wall: number; body: number; still: number; tell: number } }
  skims?: { n: number; burst: number; spray: number; bite: number }
  /** Thorns' (N3): thorns hits by how (a melee hit taken, a shot taken, one a guard stopped), and the ones on a boss. */
  thorns?: { n: number; hit: number; block: number; shot: number; boss: number }
  /** Tether's (N2): wires hooked and broken, crossings, and the anchors' ticks. */
  tether?: { hooks: number; breaks: number; crossings: number; anchorTicks: number }
}
/** One press on a filled button, for the playtest file: how long taps really last on the phone. */
interface TapLog { depth: number; slot: SlotName; ms: number; ready: boolean; result: Press['result']; leftMs: number; at: number; nbMs?: number; nbSlot?: SlotName; tp?: true }

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
  /** Every part that landed on the floor this run, and what became of it (the drop log above). */
  drops: [] as DropRec[],
  /** The break rule for this run's playtest entry: as it began, or 'mixed' once flipped mid-run. */
  breakRule: false as boolean | 'mixed',
  /** The close hand's switch for this run's playtest entry, the same way. */
  hand: true as boolean | 'mixed',
  /** The eye's switch, the same way. */
  eye: true as boolean | 'mixed',
  /** Where this fight's strain began: the free push is drawn above it. */
  water: 0,
  taps: [] as TapLog[],
  /** Seconds played walking home after the Arbiter (game time, like each depth's playS). */
  walkS: 0,
  /** ISO: when this run began (its snapshot carries it). */
  startedAt: '',
  /** This level's seed: a resume builds the same layout. */
  seed: 0,
  /** This depth's boss is down (a resume opens the beams, no boss), and what it dropped. */
  bossFelled: false,
  bossLoot: [] as string[],
  /** This crawl depth's pedestals by its exit, as they rose: a resume raises the same three. */
  picks: [] as string[],
  /** Strain the Assembler's second pick added: no quiet eases below it, for the rest of the run. */
  kept: 0,
  /** Temper's ranks this run, by slot (temper.ts): absent is I; a swap lands at TEMPER.swapRank. */
  ranks: {} as Partial<Record<SlotName, number>>,
  /** Every swap this run (design/synergy): the slot, the part given up and the one taken, and the rank given up. */
  swaps: [] as { slot: SlotName; from: string; to: string; rankLost: number }[],
  /** Mastery learned this run (mastery.ts): combat reads the same set. */
  mastery: new Set<MasteryId>(),
  /**
   * The build layer (design/buildlayer/BUILD.md §2.4): the core worn this run, its socketed keystone and learned upgrades. Null: a bare run (picked nothing,
   * begun with "builds" off, or an old snapshot). Nothing reads them but `coreActive()`. `corePick`: what the pick said (B4); once a run, in the playtest body.
   */
  core: null as CoreId | null,
  /** Who he is this run (archetypes.ts), picked at the start in the core pick's place. Null: today's game (an old save, builds off, a dev boot). With one, `core` stays null. */
  archetype: null as ArchetypeId | null,
  archPick: null as { at: 'start' | 'resume'; took: ArchetypeId } | null,
  keystone: null as KeystoneId | null,
  upgrades: [] as UpgradeId[],
  corePick: null as { at: 'start' | 'resume'; offered: CoreId[]; took: CoreId; s: number } | null,
  /**
   * The road through depths 4-6 (design/area3/SPEC.md §3). null until it's chosen: at the
   * Assembler's descend, or in the crossroads. Depths 1-3 ignore it; null reads as 'II'.
   */
  route: null as RouteId | null,
  /** This level's names (§7.2), and the ones already counted as met here. */
  names: {} as Partial<Record<Archetype, string>>,
  met: new Set<string>(),
}

/** An awake body this near Still (u, the wake radius) is a fight, for the log's `fightS`. */
const FIGHT_NEAR = 8
/**
 * The open fight's spending hits (§2.11 `spendsPerFight`) and the depth it began in. A spend between fights counts toward the next one. Each fight closes into its
 * own depth's list: when it goes quiet, when it is outrun, and when the depth closes.
 */
let fightSpends = 0
let fightSt: DepthStats | null = null
function flushFight() {
  if (fightSt) fightSt.spendsPerFight.push(fightSpends)
  fightSt = null
  fightSpends = 0
}
/** Nothing awake for this long counts as a fight cleared. */
const QUIET_SECONDS = 2.5
const QUIET_STRAIN = 2
/**
 * Strain is the run's, not each boss's: a quiet never eases below this share of what he
 * carried into the depth. Only a Rest shrine takes him under it.
 */
const QUIET_FLOOR = 0.5
/** The lowest a quiet can ease strain to on this depth, and never under what a second pick kept. */
function quietFloor() {
  const st = run.stats[run.stats.length - 1]
  return Math.max(st ? Math.floor(st.strainIn * QUIET_FLOOR) : 0, run.kept)
}
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
  const chance = dropChance(pack, wasElite, summoned, weight)
  // temper on: fewer, louder drops; an elite's and a side room's owed drop are as ever
  if (Math.random() >= (temperOn && chance < 1 ? chance * TEMPER.killPayout : chance)) return
  // any slot, empty ones too (28 Sep, his ask: "I don't like it that the drops are only for those that I already have")
  // an elite's drop is the hunt's (B5): with a core worn, half the time from the core's own pool; an elite's is owed: the thief in that pack's barrel runs for it
  if (dropMoment(at, kind, wasElite ? 'elite' : 'kill', wasElite ? pack : undefined)) pack.dropped = true
}

/**
 * A kill's, an elite's or Plenty's drop, on the floor and in the log: `rollMoment` (the hunt, for an elite or Plenty with a core worn), then the part (its fit ring from the core worn)
 * or the keystone. False when there was nothing left to drop. `owed`: an elite's pack (a part is owed to the thief; a keystone never is).
 */
function dropMoment(at: THREE.Vector3, from: Archetype, source: 'kill' | 'elite' | 'plenty', owed?: object): boolean {
  const got = rollMoment(from, [...hud.loadout, ...loot.ground.map((g) => g.def)], source)
  if (!got) return false
  if ('key' in got) {
    dropKeyAt(got.key, at, source, true)
    return true
  }
  logDrop(floorPart(got.def, at, still.pos, owed), source, got.filtered)
  sfx.drop(got.def.tier, source === 'plenty' ? 0 : panOf(at))
  return true
}

/** A part on the floor: its fit ring is decided here, from the core worn now (B5). */
function floorPart(def: AbilityDef, at: THREE.Vector3, toward?: THREE.Vector3, owed?: object): GroundPart {
  return loot.drop(def, at, toward, owed, fitOf(def, coreNow()) !== null)
}

/**
 * The hunt (BUILD.md §2.9): a moment's drop (an elite's, Plenty's, a boss's blue; `source` 'kill' is never filtered) with a core worn takes `FILTER.share` of the time one of the core's
 * own parts or keystones, else today's `rollPart`. A keystone comes back as `{ key }`. With no core nothing extra is drawn.
 */
function rollMoment(from: Archetype, taken: readonly AbilityDef[], source: DropSource, view: PoolView = pool(), keys = { socketed: run.keystone, onFloor: loot.keys.map((k) => k.key.id) }): { def: AbilityDef; filtered: boolean } | { key: KeystoneDef } | null {
  const hit = rollForCore(coreNow(), source, taken, keys, view)
  if (hit) return 'slot' in hit ? { def: hit, filtered: true } : { key: hit }
  const def = rollPart(from, taken, source, view)
  return def ? { def, filtered: false } : null
}

/** A keystone onto the floor, logged (it is a drop of its own kind: the record's `fit` is 'key', and `filtered` is the hunt's). */
function dropKeyAt(key: KeystoneDef, at: THREE.Vector3, source: DropTag, filtered: boolean, sound = true): GroundKey {
  const g = loot.dropKey(key, at, still.pos)
  logKey(g, source, filtered)
  if (sound) sfx.drop('gold', panOf(at))
  return g
}

// --- the drop log, for the playtest file: what was offered, taken and left (design/replay) ---

/**
 * Where a floor part came from. 'swap' is the part he gave up, landing at his feet (logged,
 * never counted as a drop); 'thief' a caught part whose drop wasn't logged; 'dev' a check's.
 * A pick kind (exit, plenty, gift) is a part risen on a pedestal.
 */
type DropTag = 'kill' | 'crate' | 'elite' | 'boss' | 'swap' | 'thief' | 'dev' | PickKind
/**
 * One part on the floor, from its drop to its end. offered: its card showed. end: taken
 * (worn), left (on the floor when the level ended), stolen (the thief got away with it), wall
 * (a pedestal's, gone back when another of its set was taken), or null while it's still lying there.
 */
interface DropRec {
  depth: number; id: string; source: DropTag; offered: boolean; end: 'taken' | 'left' | 'stolen' | 'wall' | 'melted' | null
  /**
   * With a core worn when it landed (absent bare): 'fits' a part that fits it, 'plain' one that doesn't, 'key' a keystone (its `id` is the keystone's; `end: 'left'` or null is a
   * keystone left on the floor). `filtered`: the hunt chose it (the filter's pool), not the ordinary roll.
   */
  fit?: 'fits' | 'plain' | 'key'
  filtered?: true
}
const PICK_TAGS: ReadonlySet<DropTag> = new Set<DropTag>(['exit', 'plenty', 'gift'])
const dropRecs = new WeakMap<GroundPart | GroundKey, DropRec>()
/** A lifted part's record, by part id, until its thief is caught (the same drop comes back down). */
const caged = new Map<string, DropRec>()

function logDrop(g: GroundPart, source: DropTag, filtered = false) {
  const rec: DropRec = { depth: run.depth, id: g.def.id, source, offered: false, end: null }
  if (coreActive()) rec.fit = fitOf(g.def, run.core) ? 'fits' : 'plain'
  if (filtered) rec.filtered = true
  run.drops.push(rec)
  dropRecs.set(g, rec)
}
function logKey(g: GroundKey, source: DropTag, filtered = false) {
  const rec: DropRec = { depth: run.depth, id: g.key.id, source, offered: false, end: null, fit: 'key' }
  if (filtered) rec.filtered = true
  run.drops.push(rec)
  dropRecs.set(g, rec)
}
function endDrop(g: GroundPart | GroundKey, end: NonNullable<DropRec['end']>) {
  const rec = dropRecs.get(g)
  if (rec && !rec.end) rec.end = end
}
/** The floor is swept (a level's end, the room, a check): whatever still lies there was left. */
function clearLoot() {
  for (const g of loot.ground) endDrop(g, 'left')
  for (const g of loot.keys) endDrop(g, 'left')
  caged.clear()
  loot.clear()
}
/**
 * Lying on the floor, swept or not: a run's end posts before the floor is swept, so its last
 * depth's parts are still null then. Offered and lying there is left; never offered, missed.
 */
const lying = (r: DropRec) => r.end === 'left' || r.end === null
/**
 * A depth's drops (a swap's part isn't one, nor a pedestal's): offered = taken + left. Its
 * pedestals apart: pedOffered risen, pedSeen walked into (the compare showed), pedTaken worn.
 */
function depthDrops(depth: number) {
  const all = run.drops.filter((r) => r.depth === depth && r.source !== 'swap')
  const rs = all.filter((r) => !PICK_TAGS.has(r.source))
  const ps = all.filter((r) => PICK_TAGS.has(r.source))
  return {
    drops: rs.length, offered: rs.filter((r) => r.offered).length, taken: rs.filter((r) => r.end === 'taken').length,
    left: rs.filter((r) => r.offered && lying(r)).length, missed: rs.filter((r) => !r.offered && lying(r)).length,
    pedOffered: ps.length, pedSeen: ps.filter((r) => r.offered).length, pedTaken: ps.filter((r) => r.end === 'taken').length,
  }
}
/** Per part this run: offered, taken, left (as depthDrops), and where each offer came from. */
function partDrops() {
  const out: Record<string, { offered: number; taken: number; left: number; from: Partial<Record<DropTag, number>> }> = {}
  for (const r of run.drops) {
    if (r.source === 'swap') continue
    const c = (out[r.id] ??= { offered: 0, taken: 0, left: 0, from: {} })
    if (r.offered) {
      c.offered++
      c.from[r.source] = (c.from[r.source] ?? 0) + 1
    }
    if (r.end === 'taken') c.taken++
    if (r.offered && lying(r)) c.left++
  }
  return out
}
/** run.stats as the playtest file and __runStats read it: the open depth's strain now, and its drops. */
const statsOut = () => run.stats.map((st) => ({
  ...st, strainOut: st.strainOut ?? run.strain, playS: Math.round(st.playS ?? 0), plantedS: Math.round(st.plantedS ?? 0), fightS: Math.round((st.fightS ?? 0) * 10) / 10, ...depthDrops(st.depth),
  ...(st.menders ? { menders: { ...st.menders, healed: Math.round(st.menders.healed) } } : {}),
  ...(st.nearBins ? { movingS: Math.round(st.movingS * 10) / 10, wallS: Math.round(st.wallS * 10) / 10, closeS: Math.round(st.closeS * 10) / 10, nearBins: st.nearBins.map((v) => Math.round(v * 10) / 10), nearMovingBins: st.nearMovingBins.map((v) => Math.round(v * 10) / 10) } : {}),
}))

/** What the save has found and turned, at this depth: every drop reads it. */
const pool = (): PoolView => poolView(save, run.depth)

// --- shrines: one bargain each ---

const SHRINE_RADIUS = 1.7

const SHRINE_TEXT = {
  rest: { title: 'Shrine of Rest', line: 'strain \u22126. Something nearby will hear it.', action: 'rest' },
  plenty: PEDESTALS_ON
    ? { title: 'Shrine of Plenty', line: `three good parts rise; the one you take costs ${PEDESTALS.plentyStrain} strain.`, action: 'raise them' }
    : { title: 'Shrine of Plenty', line: `a good part, for ${PEDESTALS.plentyStrain} strain.`, action: 'take the bargain' },
}
let atShrine: Shrine | null = null

/**
 * The warm beam beside a cold one (more of the day ahead) asks before it takes him: a brush
 * of the light on the way to the cold beam isn't a choice. The last boss's, alone, doesn't ask.
 */
const HOME_TEXT = { title: 'The warm light', line: 'go home now. the run ends here; everything is kept.', action: 'go home' }
let atHome = false

function homeAsks(): boolean {
  if (!level?.home || !level.homeOpen || !level.exitOpen || !beamArmed.home) return false
  return Math.hypot(still.pos.x - level.home.x, still.pos.z - level.home.z) < EXIT_RADIUS
}

/** The warm light's prompt, tapped: into it. */
function confirmHome() {
  if (!atHome || run.phase !== 'crawl' || !level?.home) return
  sfx.uiClick()
  atHome = false
  hud.prompt(null)
  beginHoming(level.home)
}

function updateShrinePrompt() {
  let near: Shrine | null = null
  let home = false
  if (run.phase === 'crawl' && level && !offered) {
    near = level.shrines.find((sh) => !sh.used && Math.hypot(sh.x - still.pos.x, sh.z - still.pos.z) < SHRINE_RADIUS) ?? null
    home = !near && homeAsks()
  }
  if (near !== atShrine || home !== atHome) {
    atShrine = near
    atHome = home
    hud.prompt(near ? SHRINE_TEXT[near.kind] : home ? HOME_TEXT : null)
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
  if (atHome) {
    confirmHome()
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
  } else if (PEDESTALS_ON) {
    // the bargain is a pick: three rise round the shrine, and the one he takes is paid for
    raisePicks('plenty', at, still.pos)
    overlay.banner(`take one for strain +${PEDESTALS.plentyStrain}`)
  } else {
    // the bargain as it was before pedestals: one good part on the floor, paid for at once
    dropMoment(at, 'chaser', 'plenty')
    overlay.banner(`bargained \u00b7 strain +${PEDESTALS.plentyStrain}`)
    // a bargain can cost everything
    addStrain(PEDESTALS.plentyStrain, screenOf(at))
  }
})

// --- picks on pedestals (design/replay/PITCHES.md 2): three rise, he walks into one ---


/** How far round what they stand by: the exit's beam, the Assembler's beams, a Plenty shrine. */
const PICK_RING: Record<PickKind, number> = { exit: 2.8, gift: 3.4, plenty: 2.2 }
/** How many one set gives. The gift's second costs strain that stays. */
const PICK_TAKES: Record<PickKind, number> = { exit: 1, plenty: 1, gift: 2 }

/** What the next take from this set costs, in strain. */
function pickCost(set: PickSet) {
  if (set.kind === 'plenty') return PEDESTALS.plentyStrain
  return set.kind === 'gift' && set.took > 0 ? PEDESTALS.secondStrain : 0
}

/**
 * n spots round `at`, clear of walls, props and the beams, on the sides away from `from` (the
 * way he comes in), so walking straight to a beam never walks into one.
 */
function pickSpots(at: THREE.Vector3, from: THREE.Vector3, r: number, n: number): THREE.Vector3[] {
  const toward = Math.atan2(from.x - at.x, from.z - at.z)
  const beams = level ? [level.exit, ...(level.home ? [level.home] : [])] : []
  const out: THREE.Vector3[] = []
  const t = combat.terrain
  // left, right and behind first, then between them; on the ring, then farther, then nearer; then looser
  for (const [pad, gap] of [[1, 2.5], [0.6, 2.3]] as const) {
    for (const ring of [r, r + 0.8, r - 0.6]) {
      for (const deg of [90, -90, 180, 135, -135, 115, -115, 155, -155, 70, -70]) {
        if (out.length >= n) return out
        const a = toward + (deg * Math.PI) / 180
        const p = new THREE.Vector3(at.x + Math.sin(a) * ring, 0, at.z + Math.cos(a) * ring)
        if (t.blocked(p.x, p.z, pad) || !t.lineClear(at.x + Math.sin(a) * 0.9, at.z + Math.cos(a) * 0.9, p.x, p.z, 0.3)) continue
        if (beams.some((b) => Math.hypot(b.x - p.x, b.z - p.z) < EXIT_RADIUS + 0.9)) continue
        if (out.some((q) => q.distanceTo(p) < gap)) continue
        out.push(p)
      }
    }
  }
  return out
}

/** A set rises round `at`: `ids` as they rose before (a resume), else a fresh roll. What rose, by id. */
function raisePicks(kind: PickKind, at: THREE.Vector3, from: THREE.Vector3, ids?: readonly string[]): string[] {
  const on = new Set(hud.loadout.map((d) => d.id))
  const known = new Set(PARTS.map((p) => p.id))
  const defs = ids
    ? ids.filter((id) => known.has(id) && !on.has(id) && !save.turned.includes(id)).map((id) => byId(id))
    : rollPicks(kind, hud.loadout, [...hud.loadout, ...loot.ground.map((g) => g.def)], pool())
  const spots = pickSpots(at, from, PICK_RING[kind], defs.length)
  const set: PickSet = { kind, took: 0 }
  const rose = defs.slice(0, spots.length)
  rose.forEach((def, i) => {
    logDrop(loot.raise(def, spots[i]!, set), kind)
    // the exit's rise with the level, far off; the others where he stands
    if (kind !== 'exit') sfx.drop(def.tier, panOf(spots[i]!))
  })
  return rose.map((d) => d.id)
}

/** The spine room before the exit: the way he comes to its beam. */
function exitApproach(l: Level) {
  const i = l.rooms.findIndex((r) => r.kind === 'exit')
  return (l.rooms[i - 1] ?? l.rooms[0]!).center
}

/** Walked into: the compare, with the price when there is one. */
function openPick(g: GroundPart) {
  if (!canPause() || !g.set) return
  const set = g.set
  const current = hud.loadout.find((p) => p.slot === slotsOf(g.def)[0]) ?? null
  // the loss, named where the choice is made
  const rest = loot.ground.filter((o) => o.set === set).length - 1
  const last = set.took + 1 >= PICK_TAKES[set.kind]
  const note = !rest ? undefined : last ? `the other${rest > 1 ? ' two go' : ' goes'} back to the wall` : `then one more, for strain +${PEDESTALS.secondStrain}`
  const swap = swapWords(g.def)
  openPause()
  pause.compare(current, variant(g.def, coreNow()), hud.loadout, () => {
    resume()
    takePick(g)
  }, resume, !save.found.includes(g.def.id), { tag: 'on the pedestal', cost: pickCost(set), stays: set.kind === 'gift', note, take: swap?.take, melts: swap?.melts, pair: pairWords(g.def) ?? undefined })
}

/**
 * He takes one: worn at once, and its price paid last (it can end the run). A set that has given
 * all it gives sends the rest back to the wall.
 */
function takePick(g: GroundPart) {
  const set = g.set!
  const cost = pickCost(set)
  const at = g.pos.clone()
  set.took++
  takePart(g)
  if (set.took >= PICK_TAKES[set.kind]) for (const o of loot.ground.filter((o) => o.set === set)) toWall(o)
  if (!cost) return
  if (set.kind === 'gift') run.kept += cost
  overlay.banner(set.kind === 'gift' ? `wanted more \u00b7 strain +${cost}, kept` : `bargained \u00b7 strain +${cost}`)
  // a bargain can cost everything
  addStrain(cost, screenOf(at))
}

/** Back to the wall: found (the Workshop's wall shows it from now on), and gone in a cold lift. */
function toWall(g: GroundPart) {
  if (markFound(save, g.def.id)) store.write()
  endDrop(g, 'wall')
  vfx.embers(at3(g.pos, 1.1), 14, 0.5, COLD)
  loot.remove(g)
}

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
    if (isBoss(e)) id = bossPage(e.def) ?? undefined
    else if (pack.elite?.leader === e) {
      id = elitePage(pack.elite.mod, depth)
      if (meet(save.notebook, id, depth, run.met)) wrote = true
      addLeader(save.notebook[id]!, pack.elite.name)
      continue
    } else {
      const own = pageOf(e, pack)
      // null: a Line body with no page left to take, met unwritten like the mender
      id = own === null ? undefined : own ?? run.names[e.kind]
    }
    if (!id) continue
    if (meet(save.notebook, id, depth, run.met)) {
      wrote = true
      firsts.push({ id, e })
      stampLine(id)
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

/** A boss's page: its def's, but the Engine's is a Line page, unmet-only (notebook.ts LINE_DONORS.engine); null: unwritten. */
function bossPage(def: BossDef): string | null {
  return def.kind === 'engine' && linePagesActive() ? linePage('engine') : def.roster
}

/** A body's own page when it has one whatever the level's names are: a Lobber's, a slag heap's mites', the Line's three. */
function pageOf(e: Enemy, pack: Pack): string | null | undefined {
  if (e.variant === 'lobber') return LOBBER_PAGE
  if (e.kind === 'swarm' && pack.brood?.heap) return HEAP_PAGE
  const role: LineRole | undefined = e.variant === 'signal' ? 'signal' : e.variant === 'handcar' ? 'handcar' : e.kind === 'swarm' && pack.brood?.ballast ? 'sleepers' : undefined
  // null: the Line's pages are on and every donor was met as something else, so this body is unwritten (never its level's name); off, it keeps its level's name as today
  if (role && linePagesActive()) return linePage(role)
  return undefined
}

/**
 * A Line page written for the first time is stamped with its role (`r`), so the next boot finds it again as that body's
 * (notebook.ts setLinePages) and a page he met as a sentinel is never re-labelled under him (INV-N2).
 */
function stampLine(id: string) {
  const e = save.notebook[id]
  if (!e || e.r) return
  for (const role of ['signal', 'handcar', 'sleepers', 'engine'] as const) if (linePage(role) === id) e.r = role
}

/** Felled: counted on its page, written with the next event write. Adds count for nothing. */
function felled(kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean, weight: number, own?: string | null) {
  if (run.dev || summoned) return
  let id: string | undefined
  // the boss is still combat's on the tick it's felled: bossDown clears it after
  if (kind === 'boss') id = combat.boss ? bossPage(combat.boss.def) ?? undefined : BOSS_PAGE
  else if (own && !wasElite) id = own
  // a Line body with no page: felled unwritten, like the mender
  else if (own === null && !wasElite) id = undefined
  else if (wasElite && pack.elite) id = elitePage(pack.elite.mod, run.depth)
  // a Many's halves weigh nothing and weren't summoned
  else if (weight === 0) id = FRAGMENT_PAGE
  else id = run.names[kind]
  if (wasElite && pack.elite?.mod === 'splitting') meet(save.notebook, FRAGMENT_PAGE, run.depth, run.met)
  const e = id ? save.notebook[id] : undefined
  if (e) e.k += 1
  else if (id) {
    if (meet(save.notebook, id, run.depth, run.met)) stampLine(id)
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
        name: r.name, what: WHAT[roleOf(r).role], line: r.line,
        facts: `met ${e.m} time${e.m === 1 ? '' : 's'} \u00b7 felled ${e.k} \u00b7 first met ${day(e.f)} \u00b7 deepest depth ${e.d}`,
        leaders: e.l?.length ? `led by ${e.l.join(', ')}` : null,
      }
    })
}

/** How a part card names a part and tells its past, from the save. */
const describePart = (d: AbilityDef) => ({ name: partName(save, d.id, d.name), history: historyLine(save, d.id) })
pause.setDescribe(describePart)
// weight (WEIGHT.md W3): with the switch on, every card's damage and radius are the weighed def's, the numbers the next press uses
pause.setShown((d) => (weightOn ? weighed(d) : d))

/**
 * Strain step 1 (design/strain/PITCHES.md): a push breaks the windup it lands in. Permanent
 * since 26 Sep (breaks went from 1 in 46 pushes to 8 in 20 once casts fired on the press).
 * Only the dev hook turns it off, for checks.
 */
function setBreakRule(on: boolean) {
  combat.breakRule = on
  hud.breakRule = on
}
setBreakRule(true)

/**
 * The hand and the eye (design/variety/PITCHES.md 1, 3) are the auto now: permanent since 27 Sep
 * (after pass 2 he kept both: "we don't have the auto attack now apart from the hand and the eye").
 * The pause switches are gone; only the dev hooks flip them, for checks. A run flipped logs 'mixed'.
 */
function setHand(on: boolean) {
  combat.closeHand = on
  if (run.hand !== 'mixed' && run.hand !== on && run.phase !== 'boot') run.hand = 'mixed'
}
function setEye(on: boolean) {
  combat.eye = on
  if (run.eye !== 'mixed' && run.eye !== on && run.phase !== 'boot') run.eye = 'mixed'
}
setHand(true)
setEye(true)
run.hand = combat.closeHand
run.eye = combat.eye

/**
 * The temper prototype (temper.ts): melt a floor part into the worn one, ranks I-III, and fewer
 * kill drops. A pause switch, kept per device, on by default; ranks already earned stay either way.
 */
const TEMPER_KEY = 'still-action.temper'
let temperOn = (() => {
  try {
    return localStorage.getItem(TEMPER_KEY) !== '0'
  } catch {
    return true
  }
})()
pause.setSwitch('temper', () => temperOn, (on) => {
  temperOn = on
  try {
    localStorage.setItem(TEMPER_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})

/**
 * The counter-moves (COUNTERS.md): a pressure hulk lunges at a Still who holds its band, a pressure sentinel
 * ducks to cover from a planted one. A pause switch, kept per device, on by default; it takes effect from
 * the next depth, as pressure did. Off is today's behaviour exactly.
 */
const COUNTERS_KEY = 'still-action.counters'
let countersOn = (() => {
  try {
    return localStorage.getItem(COUNTERS_KEY) !== '0'
  } catch {
    return true
  }
})()
pause.setSwitch('counters', () => countersOn, (on) => {
  countersOn = on
  try {
    localStorage.setItem(COUNTERS_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})

/**
 * The parry-catch trial (design/parry/README.md: the balancer's option B with grace 150; his call, 29 Sep). Parry Clamp
 * was a dead slot from depth 4. On, a tell may be caught up to PARRY_CATCH.graceMs after it ended, and a Parry snap that
 * catches a tell or breaks a windup (pushed or not) readies Parry, at most once per `capS` of combat time. A pause switch,
 * kept per device, on by default; it takes effect from the next depth, as counters do. Off is today's behaviour exactly.
 */
const PARRY_CATCH = { graceMs: 150, capS: 1.5 }
const PARRY_CATCH_KEY = 'still-action.parryCatch'
let parryCatchOn = (() => {
  try {
    return localStorage.getItem(PARRY_CATCH_KEY) !== '0'
  } catch {
    return true
  }
})()
pause.setSwitch('parry catch', () => parryCatchOn, (on) => {
  parryCatchOn = on
  try {
    localStorage.setItem(PARRY_CATCH_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})
/**
 * The follow-through trial (design/autos/BUILD-1.md; the bank, BANK in combat.ts). On, a part cast that fired banks auto beats and
 * each auto beat spends one: no press, no auto. A pause switch, kept per device, off by default. It takes effect at once, bank
 * empty (his ask, 30 Sep: a trial he flips mid-run shouldn't wait a depth); the depth it was flipped on is logged `followThroughMixed`,
 * to leave out when judging. The words are PLACEHOLDER (his to write). Off is today's game exactly.
 */
const FOLLOW_KEY = 'still-action.followThrough'
let followThroughOn = (() => {
  try {
    return localStorage.getItem(FOLLOW_KEY) === '1'
  } catch {
    return false
  }
})()
pause.setSwitch('follow-through', () => followThroughOn, (on) => {
  followThroughOn = on
  if (run.phase === 'crawl' && combat.followThrough !== on) {
    applyFollowThrough(on)
    const st = run.stats[run.stats.length - 1]
    if (st) st.followThroughMixed = true
  }
  try {
    localStorage.setItem(FOLLOW_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})
/** The switch's state applied to Combat, bank empty: at each level, when it's flipped mid-depth, and by the DEV hook. */
function applyFollowThrough(on: boolean) {
  combat.followThrough = on
  combat.bank = 0
}

/**
 * The "weight" trial (design/lean/WEIGHT.md; weight.ts holds every number). On, timing, drama, full effect on ready casts, part damage
 * and area take effect at once, on the next press; pack and boss HP from the next level entered. A pause switch, kept per device, on
 * by default (his call, 1 Oct, after design/lean/TRIAL-1.md). The depth it was flipped on is logged `weightMixed`, to leave out when judging. The words are PLACEHOLDER (his to write).
 * Off is today's game exactly.
 */
const WEIGHT_KEY = 'still-action.weight'
let weightOn = (() => {
  try {
    return localStorage.getItem(WEIGHT_KEY) !== '0'
  } catch {
    return true
  }
})()
pause.setSwitch('weight', () => weightOn, (on) => {
  weightOn = on
  if (run.phase === 'crawl' && combat.weight !== on) {
    applyWeight(on)
    const st = run.stats[run.stats.length - 1]
    if (st) st.weightMixed = true
  }
  try {
    localStorage.setItem(WEIGHT_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})
/**
 * The "tap push" trial (design/lean/TAP-PUSH.md; the words are PLACEHOLDER, his to write). A pause switch, kept per device, on by
 * default (his call, 1 Oct); it applies at once, at any phase (a gesture, no level boundary). The depth it was flipped on is logged `tapPushMixed`,
 * to leave out when judging. Off is today's gesture exactly.
 */
const TAP_PUSH_KEY = 'still-action.tapPush'
let tapPushOn = (() => {
  try {
    return localStorage.getItem(TAP_PUSH_KEY) !== '0'
  } catch {
    return true
  }
})()
hud.tapPush = tapPushOn
pause.setSwitch('tap push', () => tapPushOn, (on) => {
  tapPushOn = on
  if (run.phase === 'crawl' && hud.tapPush !== on) {
    const st = run.stats[run.stats.length - 1]
    if (st) st.tapPushMixed = true
  }
  hud.tapPush = on
  try {
    localStorage.setItem(TAP_PUSH_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})
/**
 * The "builds" trial (design/buildlayer/BUILD.md; the word is a PLACEHOLDER, WORDS.switch). A pause switch, kept per device, ON by default (the lead's
 * call, 2 Oct: his rule is no dark stages; it costs nothing, because no core can be worn before B4's pick and with no core the game is today's, K-M1).
 * Flipped during a crawl with a core worn, the core goes on or off at once, the worn parts are re-tempered with their cooldowns' fractions kept,
 * and the depth is logged `coreMixed`. Every effect keys on `coreActive()`, never on this switch alone.
 */
const BUILDS_KEY = 'still-action.builds'
let buildsOn = (() => {
  try {
    return localStorage.getItem(BUILDS_KEY) !== '0'
  } catch {
    return true
  }
})()
// `?core=` needs no switch: for this page, builds are on (nothing is stored)
if (CORE_PARAM) buildsOn = true
pause.setSwitch(WORDS.switch, () => buildsOn, (on) => {
  buildsOn = on
  if (run.phase === 'crawl' && run.core && (combat.core !== null) !== on) {
    applyBuilds()
    const st = run.stats[run.stats.length - 1]
    if (st) st.coreMixed = true
  }
  try {
    localStorage.setItem(BUILDS_KEY, on ? '1' : '0')
  } catch {
    // private window: it holds for this session
  }
})
/** A core is worn and the switch is on: the one gate every build effect keys on. With none worn the game is today's, flat temper included. */
const coreActive = () => buildsOn && run.core !== null
const coreNow = (): CoreId | null => (coreActive() ? run.core : null)
/** The one way main builds a worn part: its reshape under the core worn, then temper, flat while a core is on. With no core: `tempered(base, rank)`. */
const asWorn = (base: AbilityDef, rank: number, slot: SlotName = base.slot): AbilityDef => {
  const d = tempered(variant(base, coreNow()), rank, coreActive())
  // Footwork (archetypes.ts TRAIT): a Move-family part cools down faster, wherever it is worn
  const f = run.archetype === 'marksman' && FAMILY[base.id] === 'move' ? { ...d, cooldownMs: Math.round(d.cooldownMs * TRAIT.marksman.footwork.moveCd) } : d
  return onSlot(f, slot)
}
/** The slots a floor part may be taken into: its own with no archetype; with one, the slot law's, its own first. */
const slotsOf = (d: AbilityDef): SlotName[] => {
  const s = run.archetype ? slotsFor(run.archetype, d.id, d.slot) : []
  return s.length ? s : [d.slot]
}
const NO_UPGRADES: ReadonlySet<UpgradeId> = new Set()
const NO_MASTERY: ReadonlySet<MasteryId> = new Set()
/** The gate's state, written to Combat. Cheap and idempotent: at every level entry, a flip, a pick, a resume. */
function syncCore() {
  const on = coreActive()
  combat.core = coreNow()
  combat.keystone = on ? run.keystone : null
  combat.upgrades = on ? new Set(run.upgrades) : NO_UPGRADES
  combat.mastery = on ? NO_MASTERY : run.mastery // no mastery with a core
}
/**
 * `syncCore`, and when the core went on, off or changed, the worn parts again, as `asWorn` says: the button keeps its cooldown fraction (hud.equip).
 * A level entry with the core unchanged touches no button. The rank is the worn def's own, so a part tempered by a dev hook keeps it.
 */
function applyBuilds() {
  const was = combat.core
  syncCore()
  if (was === combat.core) return
  for (const sl of hud.slots) if (sl.def) hud.equip(asWorn(byId(sl.def.id), sl.def.rank ?? 1, sl.slot))
}

/** The switch's state applied to Combat: at each level, when it's flipped mid-depth, and by the DEV hook. (The freeze merge state resets here.) */
function applyWeight(on: boolean) {
  combat.weight = on
  freezeAt = -Infinity
  freezeLen = 0
  headAt = -Infinity
  headK = 0
}

/** Combat time of the last readying, and whether one is waiting for the button to have finished its cast (the cast sets the cooldown after the snap). */
let parryReadyAt = -Infinity
let parryReadyPending = false
/** Ready Parry's button now, if a catch asked (called before the HUD's clock moves). */
function flushParryReady() {
  if (!parryReadyPending) return
  parryReadyPending = false
  const def = hud.loadout.find((d) => d.id === 'parry-clamp')
  if (def) hud.ready(def.slot, 'cold')
}
/** The switch's state applied to Combat and the grace dial: at each level, and by the DEV hook. */
function applyParryCatch(on: boolean) {
  combat.parryCatch = on
  PARRY.graceMs = on ? PARRY_CATCH.graceMs : 0
  parryReadyAt = -Infinity
  parryReadyPending = false
}

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
  flushFight()
  run.quietT = 0
  run.killed = false
  // follow-through: each fight starts empty, and opens on a press
  combat.bank = 0
  const before = combat.hp
  combat.hp += (100 - combat.hp) / 2
  const from = run.strain
  run.strain = Math.max(Math.min(from, quietFloor()), from - QUIET_STRAIN)
  const eased = from - run.strain
  const st = run.stats[run.stats.length - 1]
  if (st) st.quiets++
  hud.healing()
  sfx.cleared()
  if (combat.hp > before + 0.5 || eased > 0) overlay.banner(eased > 0 ? `quiet \u00b7 strain \u2212${eased}` : 'quiet')
}

function updateOffer() {
  const open = run.phase === 'crawl'
  const under = open ? loot.under(still.pos) : null
  // after a take, the old part lands at your feet: don't offer it back until you step off
  if (!under) offerHeld = false
  const next = under && !offerHeld ? under : null
  if (next !== offered) {
    offered = next
    const rec = next && dropRecs.get(next)
    if (rec) rec.offered = true
    // a floor part shows its card; a pedestal's opens the compare as he walks in
    const card = next && !next.set ? next : null
    // under a core, the card shows the part as worn (a reshape's name, line and numbers); with none, the part itself
    const shown = card ? variant(card.def, coreNow()) : null
    hud.offer(shown, !!card && !save.found.includes(card.def.id), shown ? describePart(shown) : undefined, card ? meltLabel(card) : null,
      card ? { swap: swapWords(card.def), pair: pairWords(card.def), fit: fitWords(card.def), slots: run.archetype ? slotsOf(card.def) : undefined } : undefined)
    loot.offer(next)
    if (next?.set) openPick(next)
  }
}

hud.onTake((slot) => {
  if (offered) takePart(offered, slot)
})

// --- keystones on the floor: the socket card (BUILD.md §2.9, B5) ---

/** The keystone whose card he left: it stays shut until he steps off it (the `offerHeld` rule), and then opens again if he steps back. */
let keyHeld: GroundKey | null = null
const keyCard = (k: KeystoneDef) => ({ name: WORDS.keystone[k.id][0], line: WORDS.keystone[k.id][1], tag: WORDS.forTag[k.for] })

/** Walking within the pickup radius of a keystone not left on its card opens the socket and the world waits. Only with a core worn: a keystone is only ever dropped for it. */
function updateKeys() {
  const under = run.phase === 'crawl' && coreActive() ? loot.keyUnder(still.pos) : null
  if (!under) {
    // the hold stays while the keystone he gave up is still hopping out to land (it is not under him yet); it lifts once he is clear of it, or it is gone
    if (!keyHeld || keyHeld.fly <= 0 || !loot.keys.includes(keyHeld)) keyHeld = null
    return
  }
  if (under === keyHeld || !canPause() || under.key.core !== run.core) return
  openSocket(under)
}

function openSocket(g: GroundKey) {
  const core = run.core!
  g.seen = true
  const rec = dropRecs.get(g)
  if (rec) rec.offered = true
  sfx.uiClick()
  openPause()
  const cur = run.keystone ? KEYSTONES[run.keystone] : null
  const whom = WORDS.core[core]
  pause.socket(whom, cur && keyCard(cur), keyCard(g.key), {
    title: WORDS.socketTitle(whom), socket: WORDS.socketLabel, empty: WORDS.socketEmpty, floor: WORDS.socketFloor,
    lose: cur ? WORDS.youLose(WORDS.keystone[cur.id][0]) : null, take: WORDS.takeKey, leave: WORDS.leaveKey,
  }, () => {
    resume()
    takeKey(g)
  }, () => {
    keyHeld = g
    resume()
  })
}

/** Socket it: the one given up lands at his feet (it can be taken back on this floor), and the marks he holds come down to what the new one holds. */
function takeKey(g: GroundKey) {
  const old = run.keystone ? KEYSTONES[run.keystone] : null
  run.keystone = g.key.id
  endDrop(g, 'taken')
  loot.removeKey(g)
  applyBuilds()
  const cap = markCap(run.core!, run.keystone)
  for (const [, st] of combat.statuses()) if (st.marks.n > cap) st.marks.n = cap
  keyHeld = null
  if (old) {
    const lying = loot.dropKey(old, still.pos, undefined)
    logKey(lying, 'swap')
    keyHeld = lying
  }
  sfx.take()
  rig.punch(0.03)
  still.group.scale.setScalar(1.12)
  vfx.flash(at3(still.pos, 1.0), COLD, 0.9)
  overlay.banner(WORDS.keystone[g.key.id][0])
  navigator.vibrate?.(18)
}

/** Temper: "melt into Cleaver II" when this floor part could rank up the one he wears there, else null. */
function meltLabel(g: GroundPart): string | null {
  if (!temperOn || g.set) return null
  const into = slotsOf(g.def)[0]
  const cur = hud.loadout.find((p) => p.slot === into)
  const rank = run.ranks[into!] ?? 1
  if (!cur) return null
  if (rank < TEMPER.maxRank) return `melt into ${byId(cur.id).name} ${ROMAN[rank + 1]}`
  // with a core there is no mastery (no hand, no eye to teach): the core's upgrade takes its place (BUILD.md §2.9), from UPGRADE_FROM on, while one is left to learn
  if (coreActive()) return upgradesLeft().length ? WORDS.meltUpgrade(WORDS.core[run.core!]) : null
  // at III: melting masters the auto its lean feeds (mastery.ts)
  const form = masteryForm(cur)
  if (run.mastery.size >= MASTERY_MAX || !masteryOffer(form, run.mastery).length) return null
  return form ? `melt: master the ${FORM_NAME[form]}` : 'melt: master strike or shot'
}

/** The core's upgrades he can still be offered at a melt past III: none before depth UPGRADE_FROM (after the second boss), none past UPGRADE_MAX learned (BUILD.md §2.9, 3-balancer.md). */
function upgradesLeft(): UpgradeId[] {
  if (!coreActive() || run.depth < UPGRADE_FROM || run.upgrades.length >= UPGRADE_MAX) return []
  return (Object.keys(UPGRADES) as UpgradeId[]).filter((id) => UPGRADES[id].core === run.core && !run.upgrades.includes(id))
}

/** How a part fits the core worn, for its card (the pickup card and the compare): a spender's `spends frosted: +10 each`, a shaper's or guard's own line. Null: plain, or no core. */
function fitWords(d: AbilityDef): string | null {
  const c = coreNow()
  const f = c ? fitOf(d, c) : null
  if (!c || !f) return null
  if (f.role === 'spend') return WORDS.fits(WORDS.core[c], WORDS.spends(WORDS.mark[c], f.k ?? CORES[c].K))
  const line = WORDS.fitLineFor[c]?.[d.id] ?? (WORDS.fitLine as Record<string, string>)[d.id]
  return line ? WORDS.fits(WORDS.core[c], line) : WORDS.fitsPlain(WORDS.core[c])
}

/** Which auto a part at III feeds: close the hand, marksman the eye, no lean either (null). A table since B1 (mastery.ts MASTERY_FORM): the tags are gone from the defs. */
const masteryForm = (d: AbilityDef): MasteryForm | null => MASTERY_FORM[d.id] ?? null

pause.setLearned(() => [...run.mastery].map((id) => MASTERY[id]))
// the core under the loadout (B5): its name, the socket and the upgrades, and the run's marks and what the spends added (SHOW.md item 8). Nothing with no core worn
pause.setCore(() => {
  const c = coreNow()
  if (!c) return null
  // the run's, every depth so far: what he made, spent, and what the spends added
  let made = 0, spent = 0, bonus = 0
  for (const d of run.stats) {
    made += d.marks?.made ?? 0
    spent += d.marks?.spent ?? 0
    bonus += d.spends?.bonus ?? 0
  }
  return {
    name: WORDS.core[c],
    parts: [
      `${WORDS.socketLabel}: ${run.keystone ? WORDS.keystone[run.keystone][0] : WORDS.socketEmpty}`,
      `${WORDS.upgradesLabel}: ${run.upgrades.length ? run.upgrades.map((id) => WORDS.upgrade[id][0]).join(', ') : WORDS.none}`,
    ],
    readout: WORDS.readout(made, spent, bonus),
  }
})

/** Mastery: the floor part is melted, and he picks what the hand or the eye learns. The world waits. */
function masterWith(g: GroundPart, cur: AbilityDef) {
  const form = masteryForm(cur)
  const offer = masteryOffer(form, run.mastery)
  if (!offer.length || !canPause()) return
  if (markFound(save, g.def.id)) store.write()
  endDrop(g, 'melted')
  loot.remove(g)
  offered = null
  offerHeld = true
  hud.offer(null)
  loot.offer(null)
  sfx.take()
  vfx.embers(at3(still.pos, 0.7), 30, 1.3, COLD)
  openPause()
  const whom = form ? `the ${FORM_NAME[form]}` : 'the close strike or the planted shot'
  pause.choose(`Mastery \u00b7 ${whom}`, `${byId(cur.id).name} is at its best. What it knows goes to ${whom}.`, offer.map((id) => ({
    name: MASTERY[id].name,
    line: MASTERY[id].line,
    onPick: () => {
      run.mastery.add(id)
      const st = run.stats[run.stats.length - 1]
      if (st) {
        st.melts = (st.melts ?? 0) + 1
        ;(st.mastered ??= []).push(id)
      }
      resume()
      sfx.uiClick()
      vfx.flash(at3(still.pos, 1.0), COLD, 0.9)
      overlay.banner(MASTERY[id].name)
      navigator.vibrate?.([18, 30, 18, 30, 18])
    },
  })))
}

/** The core's upgrade (mastery's twin): the floor part is melted, and he picks what the core learns. The world waits. Nothing happens before UPGRADE_FROM or with none left (the part stays on the floor). */
function upgradeWith(g: GroundPart, cur: AbilityDef) {
  const offer = upgradesLeft()
  const core = run.core
  if (!offer.length || !core || !canPause()) return
  if (markFound(save, g.def.id)) store.write()
  endDrop(g, 'melted')
  loot.remove(g)
  offered = null
  offerHeld = true
  hud.offer(null)
  loot.offer(null)
  sfx.take()
  vfx.embers(at3(still.pos, 0.7), 30, 1.3, COLD)
  openPause()
  const whom = WORDS.core[core]
  pause.choose(WORDS.upgradeTitle(whom), WORDS.upgradeIntro(byId(cur.id).name, whom), offer.map((id) => ({
    name: WORDS.upgrade[id][0],
    line: WORDS.upgrade[id][1],
    onPick: () => {
      run.upgrades.push(id)
      applyBuilds()
      const st = run.stats[run.stats.length - 1]
      if (st) {
        st.melts = (st.melts ?? 0) + 1
        ;(st.upgraded ??= []).push(id)
      }
      resume()
      sfx.uiClick()
      vfx.flash(at3(still.pos, 1.0), COLD, 0.9)
      overlay.banner(WORDS.upgrade[id][0])
      navigator.vibrate?.([18, 30, 18, 30, 18])
    },
  })))
}

hud.onMelt(() => {
  if (offered) meltPart(offered)
})

/** Temper: the floor part is gone into the one he wears in its slot, which ranks up; its cooldown keeps its place. */
function meltPart(g: GroundPart) {
  const into = slotsOf(g.def)[0]!
  const cur = hud.loadout.find((p) => p.slot === into)
  const rank = (run.ranks[into] ?? 1) + 1
  if (!cur || g.set) return
  if (rank > TEMPER.maxRank) {
    // never mastery with a core: the core's upgrade (meltLabel offers it from UPGRADE_FROM, while one is left)
    if (coreActive()) upgradeWith(g, cur)
    else masterWith(g, cur)
    return
  }
  // melted is found: it joins the pool like a part taken
  if (markFound(save, g.def.id)) store.write()
  run.ranks[into] = rank
  endDrop(g, 'melted')
  loot.remove(g)
  hud.equip(asWorn(byId(cur.id), rank, cur.slot))
  const st = run.stats[run.stats.length - 1]
  if (st) st.melts = (st.melts ?? 0) + 1
  offered = null
  offerHeld = true
  hud.offer(null)
  loot.offer(null)
  sfx.take()
  vfx.embers(at3(still.pos, 0.7), 26, 1.2, COLD)
  vfx.flash(at3(still.pos, 1.0), COLD, 0.7)
  overlay.banner(`${byId(cur.id).name} ${ROMAN[rank]}`)
  rig.punch(0.03)
  still.group.scale.setScalar(1.12)
  navigator.vibrate?.([18, 30, 18])
}

hud.onCompare(() => {
  const g = offered
  if (!g || !canPause()) return
  sfx.uiClick()
  const into = slotsOf(g.def)[0]!
  const current = hud.loadout.find((p) => p.slot === into) ?? null
  openPause()
  const swap = swapWords(g.def)
  pause.compare(current, onSlot(variant(g.def, coreNow()), into), hud.loadout, () => {
    resume()
    takePart(g)
  }, resume, !save.found.includes(g.def.id), { take: swap?.take, melts: swap?.melts, pair: pairWords(g.def) ?? undefined, fit: fitWords(g.def) ?? undefined })
})

/** A swap: what the outgoing part had running ends first, and a live anchor hands on a full cooldown (R8). */
function swapIn(def: AbilityDef): AbilityDef | null {
  const anchorLive = combat.parts.anchor?.def.slot === def.slot
  combat.clearSlot(def.slot, def)
  return hud.equip(def, anchorLive ? 1 : undefined)
}

/**
 * A swap from a tempered part lands at II (design/synergy, temper on): the part given up melts into
 * the one taken and is used up. Null when nothing would melt: an empty slot, temper off, or a worn
 * part still at I (his call, 29 Sep: a swap never melts for him, so a never-melt run stays one; the
 * old part drops at his feet and melting it in is his choice).
 */
function swapsIn(d: AbilityDef, slot: SlotName = slotsOf(d)[0]!): AbilityDef | null {
  if (!temperOn || (run.ranks[slot] ?? 1) < TEMPER.swapRank) return null
  return hud.loadout.find((p) => p.slot === slot) ?? null
}

/** What the card and the compare say a take does: "take · Piston II", "Scrap Cleaver III melts in". Null: no swap. */
function swapWords(d: AbilityDef): { take: string; melts: string } | null {
  const cur = swapsIn(d)
  return cur ? { take: `take \u00b7 ${asWorn(d, TEMPER.swapRank).name}`, melts: `${cur.name} melts in` } : null
}

/** The card's one spare line: the pair this part makes with what's worn (parts or mastery), else the pair it ends. */
function pairWords(d: AbilityDef): string | null {
  const worn = hud.loadout
  const w = pairWith(d, worn, run.mastery)
  if (w) return `pairs with ${w}`
  const cur = worn.find((p) => p.slot === slotsOf(d)[0])
  const was = cur ? pairWith(cur, worn, run.mastery) : null
  return was ? `ends its pair with ${was}` : null
}

function takePart(g: GroundPart, into: SlotName | null = null) {
  // found the moment it's taken, and saved in the same call: closing the tab can't lose it
  if (markFound(save, g.def.id)) store.write()
  carry(g.def.id)
  saw(g.def.id)
  // the slot law: its own slot when allowed, else the first allowed; the card's second button names the other
  const slot = into && slotsOf(g.def).includes(into) ? into : slotsOf(g.def)[0]!
  const melts = swapsIn(g.def, slot)
  const worn = asWorn(g.def, melts ? TEMPER.swapRank : 1, slot)
  const old = swapIn(worn)
  if (melts) {
    // the part he gave up melts into this one: it lands at II, and nothing falls out
    run.ranks[slot] = TEMPER.swapRank
    run.swaps.push({ slot, from: melts.id, to: g.def.id, rankLost: melts.rank ?? 1 })
    vfx.embers(at3(still.pos, 0.7), 18, 1.0, COLD)
  } else {
    // an empty slot starts at I; so does a swap from a part at I, or with temper off
    delete run.ranks[slot]
  }
  endDrop(g, 'taken')
  loot.remove(g)
  // no melt (a part at I, or temper off): the part he gave up lands at his feet as itself
  if (old && !melts) logDrop(floorPart(byId(old.id), still.pos), 'swap')
  still.wear(slot, worn)
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
/** DEV: the HUD clock stands still in frame() (only __step / __until move it), so a real press meets an exact cooldown. */
let clockHeld = false
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
  pause.loadout(() => hud.slots, resume)
})

// the screen going off mid-fight shouldn't cost you the fight
document.addEventListener('visibilitychange', () => {
  if (document.hidden && canPause()) {
    openPause()
    pause.loadout(() => hud.slots, resume)
  }
})

let bossWasOpen = false

/** What the run says and plays as a boss changes (PLACEHOLDER words: Adrian's). */
const BOSS_COPY: Record<BossKind, { phase2: string; open: (pan: number) => void }> = {
  assembler: { phase2: 'the Assembler overloads', open: (pan) => sfx.clang(pan) },
  arbiter: { phase2: 'the Arbiter opens its second eye', open: (pan) => sfx.vent(pan) },
  // the Engine's words are PLACEHOLDER too; it meets only where bossFor gives ENGINE_DEF (ENGINE_ON_LINE, or a DEV ?engine=1)
  engine: { phase2: 'the Engine runs both ways', open: (pan) => sfx.clang(pan) },
}

/** __arena's posts, when it built them. */
let devPosts: { posts: Post[]; group: THREE.Group } | null = null
/** A dev check's override of ARBITER_AT_6 (null: the switch as shipped). */
let devArbiterAt6: boolean | null = null
/**
 * The ORDER (INV-O2): the road taken at the crossroads, area 2's road; not chosen yet reads as the Works'. lookAt,
 * bossFor and areaOf apply roadOf inside, so a 9-depth run's 7-9 are the other road's without this changing.
 */
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

/** The dead Engine, where it stopped: its husk on the floor, solid (two circles along its axis), a body you walk round. */
function raiseEngineHusk(x: number, z: number, yaw: number) {
  if (!level) return
  level.group.add(engineHusk(x, z, yaw))
  for (const c of engineHuskCircles(x, z, yaw)) level.terrain.add(c)
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
    // its drops land outside the footprint, toward him
    const dx = still.pos.x - at.x
    const dz = still.pos.z - at.z
    const d = Math.hypot(dx, dz) || 1
    at = new THREE.Vector3(at.x + (dx / d) * 1.9, 0, at.z + (dz / d) * 1.9)
  }
  const engine = felled instanceof Engine
  if (engine) {
    // the fire out: it stands where it stopped, along the way it faced, solid; its drops land outside it, toward him, as the Arbiter's do
    const h = felled.huskAt()
    raiseEngineHusk(h.x, h.z, h.yaw)
    const dx = still.pos.x - at.x
    const dz = still.pos.z - at.z
    const d = Math.hypot(dx, dz) || 1
    at = new THREE.Vector3(at.x + (dx / d) * 1.9, 0, at.z + (dz / d) * 1.9)
  }
  // the day goes to first dark on the same tick: a 6-depth run's Arbiter or Engine at 6, a 9-depth run's last boss at 9 (the Assembler at 6 holds its light)
  const toDark = DAY_SPAN[run.depth]?.by === 'boss' && (RUN_DEPTHS === 9 || arbiter || engine)
  if (toDark) {
    day.snap(1)
    dayApplied = 1
    applyDayAt(world, run.depth, 1)
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
  if (PEDESTALS_ON && run.depth < RUN_DEPTHS && level) {
    // a boss with more of the day to come (the Assembler): its gift is a pick, on pedestals by its beams
    run.bossLoot = raisePicks('gift', level.exit, level.entrance)
  } else {
    // the day's last: one blue and one gold, never for the same slot
    // the blue is the hunt's (B5): a keystone of the core's some of the time (it lies beside the gold, and the gold takes any slot then)
    const taken = [...hud.loadout, ...loot.ground.map((g) => g.def)]
    const got = rollMoment('boss', taken, 'boss-blue')
    const blue = got && 'def' in got ? got.def : null
    const gold = rollPart('boss', blue ? [...taken, blue] : taken, 'boss-gold', pool(), blue ? [blue.slot] : [])
    if (got && 'key' in got) dropKeyAt(got.key, at, 'boss', true)
    else if (got) logDrop(floorPart(got.def, at, still.pos), 'boss', got.filtered)
    if (gold) logDrop(floorPart(gold, at, still.pos), 'boss')
    run.bossLoot = [got && 'key' in got ? got.key.id : blue?.id, gold?.id].filter((id): id is string => !!id)
  }
  loot.dropScrap(new THREE.Vector3(at.x + 1.2, 0, at.z))
  loot.dropScrap(new THREE.Vector3(at.x - 1.2, 0, at.z))
  overlay.banner(`area ${run.depth / BOSS_EVERY} cleared`)
  // parts remember: each one worn through it saw that boss fall
  const felledBy = arbiter ? run.tally.arbiters : felled?.def.kind === 'engine' ? run.tally.engines : run.tally.assemblers
  for (const sl of hud.slots) if (sl.def) felledBy[sl.def.id] = (felledBy[sl.def.id] ?? 0) + 1
  // a beam save: a reload here comes back to the beams open and no boss, with its drops
  run.bossFelled = true
  writeSnapshot()
}

/** Parts remember the deepest depth they were worn at. */
function saw(id: string) {
  run.tally.deepest[id] = Math.max(run.tally.deepest[id] ?? 0, run.depth)
}

/** The autos are forced only while an archetype has set them, so a dev hook's flip survives runs that never had one. */
let autosForced = false

/**
 * An archetype's rules in force (archetypes.ts): the one auto it keeps (the others off), Hardened on Combat, the drop pool's law. Null is today's game: both autos, nothing else.
 * Footwork's two halves live elsewhere (the walk pace in the frame step, Move cooldowns in `asWorn`).
 */
function applyArchetype(id: ArchetypeId | null) {
  run.archetype = id
  setDropArchetype(id)
  combat.hardened = id === 'brawler' ? TRAIT.brawler.hardened : 0
  if (id || autosForced) {
    combat.closeHand = !id || AUTO[id] === 'hand'
    combat.eye = !id || AUTO[id] === 'eye'
    run.hand = combat.closeHand
    run.eye = combat.eye
  }
  autosForced = !!id
}

/** The archetype's kit is what he wears, in place of today's one-part start: every button, ready, at rank I. */
function wearKit(id: ArchetypeId) {
  const kit = KIT[id as keyof typeof KIT]
  const worn = SLOT_NAMES.map((slot) => asWorn(byId(kit[slot]), 1, slot))
  for (const d of worn) carry(d.id)
  run.ranks = {}
  combat.clearSlot(null)
  hud.resetLoadout(worn)
  SLOT_NAMES.forEach((slot, i) => still.wear(slot, worn[i]!))
}

/**
 * The archetype pick, in the core pick's place (design/archetypes/ARCHETYPES.md): the run's start, a card each, Summoner shown and "soon", nothing random. It shows once depth 1 is entered and
 * before he can move: the world waits. With an archetype `run.core` stays null (cores come back as sub-styles in A4); the core pick below stays in the code, unreachable from here.
 * `at` is how it came: 'start', or 'resume' when a reload found depth 1 with none.
 */
function offerArchetype(at: 'start' | 'resume') {
  if (!canPause()) return
  openPause()
  pause.pickArch(ARCH_WORDS.pickTitle, ARCH_WORDS.pickIntro, ARCH_IDS.map((id) => ({
    id, name: ARCH_WORDS.arch[id].name, line: ARCH_WORDS.arch[id].line, trait: ARCH_WORDS.arch[id].trait, ...(ARCH_LIVE.includes(id) ? {} : { soon: ARCH_WORDS.soon }),
  })), (picked) => {
    const id = ARCH_LIVE.find((a) => a === picked)
    if (!id || run.archetype) return
    applyArchetype(id)
    syncCore()
    wearKit(id)
    run.archPick = { at, took: id }
    resume()
    sfx.uiClick()
    writeSnapshot()
    overlay.banner(ARCH_WORDS.arch[id].name)
  })
}

/**
 * The core's pick (BUILD.md §2.8): the run's start, a card for every core (Wake, Ram, Thorns and Tether, all live since N3), no reroll and nothing random. It shows once depth 1 is entered and before he can move: the world waits
 * (openPause stops the windups; Combat's clock does not run while `paused`). `at` is how it came: 'start' at the run's beginning, 'resume' when a reload found depth 1 with no core.
 * The pick: the core is worn (`applyBuilds` re-wears the one part he has, flat and reshaped), the open depth's stats are corrected to say so (depth 1's entry was pushed before the pick
 * and nothing has been fought), and the snapshot is written with it.
 */
function offerCore(at: 'start' | 'resume') {
  if (!canPause()) return
  const t0 = performance.now()
  const offered: CoreId[] = [...CORE_IDS]
  openPause()
  pause.pickCore(WORDS.pickTitle, WORDS.pickIntro, offered.map((id) => ({ id, name: WORDS.core[id], thumb: WORDS.thumb[id], leaves: WORDS.leaves[id], spends: WORDS.spendsLine, ...(CORE_LIVE.includes(id) ? {} : { soon: WORDS.soon }) })), (picked) => {
    const id = offered.find((c) => c === picked)
    if (!id || run.core || !CORE_LIVE.includes(id)) return
    run.core = id
    run.corePick = { at, offered, took: id, s: Math.round((performance.now() - t0) / 100) / 10 }
    applyBuilds()
    const st = run.stats[run.stats.length - 1]
    if (st) {
      st.core = combat.core
      st.temperFlat = coreActive()
      st.keystone = combat.keystone
      st.upgrades = [...combat.upgrades]
    }
    resume()
    sfx.uiClick()
    writeSnapshot()
    overlay.banner(WORDS.core[id])
  })
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
    ...(run.picks.length ? { picks: [...run.picks] } : {}),
    ...(run.kept ? { kept: run.kept } : {}),
    ...(Object.keys(run.ranks).length ? { ranks: { ...run.ranks } } : {}),
    ...(run.mastery.size ? { mastery: [...run.mastery] } : {}),
    ...(run.core ? { core: run.core } : {}),
    ...(run.archetype ? { archetype: run.archetype } : {}),
    ...(run.core && run.keystone ? { keystone: run.keystone } : {}),
    ...(run.core && run.upgrades.length ? { upgrades: [...run.upgrades] } : {}),
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
  // an archetype this build knows comes back with its law; anything else resumes as today's game
  const arch = (ARCH_LIVE as readonly string[]).includes(snap.archetype ?? '') ? (snap.archetype as ArchetypeId) : null
  const loadout = SLOT_NAMES.map((slot, i) => {
    const id = snap.loadout[i]
    const def = id && known.has(id) ? byId(id) : null
    return def && (arch ? fitsSlot(arch, def.id, slot) : def.slot === slot) ? def : null
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
    phase: 'crawl', t: 0, swapped: false, ramStunSeen: false, dev: false, committed: false, ending: null, stats: [], taps: [], walkS: 0, swaps: [], core: null, keystone: null, upgrades: [], corePick: null, archPick: null,
    breakRule: combat.breakRule, hand: combat.closeHand, eye: combat.eye, drops: [], id: snap.id, startedAt: snap.startedAt, strain: Math.min(19, Math.max(0, Math.round(snap.strain) || 0)), tally, route,
  })
  run.kept = Math.min(run.strain, Math.max(0, Math.round(snap.kept ?? 0) || 0))
  // mastery and temper's ranks come back as they were earned
  run.mastery = new Set((snap.mastery ?? []).filter((id): id is MasteryId => id in MASTERY))
  // the build layer (BUILD.md §2.8): a core this build knows comes back, with the keystone and upgrades that belong to it; anything else resumes bare, and stays bare
  run.core = !arch && typeof snap.core === 'string' && (CORE_LIVE as readonly string[]).includes(snap.core) ? (snap.core as CoreId) : null
  applyArchetype(arch)
  run.keystone = run.core && typeof snap.keystone === 'string' && Object.prototype.hasOwnProperty.call(KEYSTONES, snap.keystone) && KEYSTONES[snap.keystone as KeystoneId].core === run.core ? (snap.keystone as KeystoneId) : null
  run.upgrades = run.core && Array.isArray(snap.upgrades)
    ? snap.upgrades.filter((id, i, all): id is UpgradeId => typeof id === 'string' && Object.prototype.hasOwnProperty.call(UPGRADES, id) && UPGRADES[id as UpgradeId].core === run.core && all.indexOf(id) === i)
    : []
  syncCore()
  run.ranks = {}
  SLOT_NAMES.forEach((slot, i) => {
    const r = Math.floor(snap.ranks?.[slot] ?? 1)
    const d = loadout[i]
    if (d && r > 1) run.ranks[slot] = Math.min(TEMPER.maxRank, r)
    // every part comes back as it is worn: re-tempered, and reshaped and flat while a core is on (asWorn); with none, today's tempered(d, r) / d
    if (d) loadout[i] = asWorn(d, r, slot)
  })
  // a resume starts its stats over, so it's its own entry in the playtest file, not an overwrite
  playKey = `${run.id}.${Date.now().toString(36)}`
  clearLoot()
  combat.reset()
  const worn = loadout.filter((d): d is AbilityDef => !!d)
  hud.resetLoadout(worn)
  SLOT_NAMES.forEach((slot, i) => still.wear(slot, loadout[i] ?? null))
  // §3.5: a run saved in the crossroads comes back to it, with the road still to choose
  if (snap.crossroads) enterCrossroads(snap.seed)
  else enterLevel(depth, { seed: snap.seed, bossFelled: !!snap.bossFelled && !!bossHere(depth), resume: true, picks: Array.isArray(snap.picks) ? snap.picks : undefined })
  if (run.bossFelled && level && !level.crossroads) {
    const loot0 = Array.isArray(snap.bossLoot) ? snap.bossLoot : []
    if (PEDESTALS_ON && depth < RUN_DEPTHS) run.bossLoot = raisePicks('gift', level.exit, level.entrance, loot0)
    else {
      // what it left, lying where it fell, unless he's wearing it
      const on = new Set(worn.map((d) => d.id))
      for (const id of loot0) {
        // a keystone it left (B5): back on the floor if it is this core's and not the one socketed
        if (Object.prototype.hasOwnProperty.call(KEYSTONES, id)) {
          const k = KEYSTONES[id as KeystoneId]
          if (coreActive() && k.core === run.core && run.keystone !== k.id) dropKeyAt(k, level.exit.clone(), 'boss', false, false)
          continue
        }
        if (!known.has(id) || on.has(id) || save.turned.includes(id)) continue
        logDrop(floorPart(byId(id), level.exit.clone(), still.pos), 'boss')
      }
      run.bossLoot = [...loot0]
    }
  }
  hud.bossBar(null)
  rig.reset()
  hud.mode('run')
  hud.enabled = true
  overlay.hide()
  sfx.restore()
  writeSnapshot()
  // still the run's start (depth 1, nothing fought, no core): he reloaded on the pick, or began the run with "builds" off. At depth 2 and deeper, no core means a bare run for good
  if (buildsOn && !run.core && !run.archetype && depth === 1 && !run.bossFelled && !snap.crossroads) (PICK_CORE ? offerCore : offerArchetype)('resume')
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
  // weight: the bodies' own HP multiplier too, so a train still fells what it fells today (LINE-RULES R6); off it is 1
  get bodyMul() { return combat.curve.hp * combat.packHpMul },
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
function enterLevel(depth: number, o: { seed?: number; bossFelled?: boolean; resume?: boolean; picks?: readonly string[] } = {}) {
  beamArmed.exit = true
  beamArmed.home = true
  clearYardDressing()
  roadSmokeAt = []
  level?.dispose()
  hud.bossBar(null)
  clearLoot()
  combat.reset()
  partFx.clear()
  clearCoreFx()
  run.seed = o.seed ?? Math.floor(Math.random() * 1e9)
  run.bossFelled = !!o.bossFelled
  run.bossLoot = []
  const place = lookAt(depth, routeNow(), flag('engine'))
  // the thief's first meeting is certain (G8): its page unmet
  level = generateLevel(depth, run.seed, { boss: bossHere(depth), place, thiefFirst: !save.notebook[THIEF_PAGE], open: openAt(depth, routeNow()) })
  world.scene.add(level.group)
  combat.terrain = level.terrain
  loot.terrain = level.terrain
  // the Line's own bodies and looks arrive in stage B: until then a Sleepers' brood sleeps as any brood does
  const packOfSpec = new Map<PackSpec, Pack>()
  // pressure, accepted 28 Sep ("I prefer it"): on every crawl depth an ordinary pack's hulks, sentinels
  // and mites are pressure bodies (a short cock and a jab, a short glow and a burst, a rear and a nip;
  // their hits stack); the elite pack keeps the big telegraphs as the level's heavies, and bosses keep theirs
  combat.pressure = !level.boss
  combat.counters = combat.pressure && countersOn
  applyParryCatch(parryCatchOn)
  applyFollowThrough(followThroughOn)
  applyWeight(weightOn)
  applyBuilds()
  combat.curve = curveAt(depth, RUN_DEPTHS)
  // weight (design/lean/WEIGHT.md §2.2): ordinary bodies' HP on top of the depth curve, from this level on; a boss level and the switch off stay 1
  {
    const P = WEIGHT_PRESETS[weightPresetId()]
    combat.packHpMul = combat.weight && !level.boss ? (depth < 4 ? P.packHpEarly : P.packHpDeep) : 1
    combat.heavyHpMul = combat.weight && !level.boss ? P.heavyHp : 1
  }
  const sidings = level.sidings
  for (const p of level.packs) {
    // the Lobber, the Signalman (B4) and the Handcar (B5); the Porter stays out until its step; a lesson pack's Signalman calls once on waking (R10)
    const members = p.members.map((m) => ({
      ...m,
      variant: m.variant === 'lobber' || m.variant === 'signal' || m.variant === 'handcar' ? m.variant : undefined,
      lesson: p.lesson && m.variant === 'signal' ? (true as const) : undefined,
      siding: m.siding !== undefined ? sidings![m.siding] : undefined,
    }))
    packOfSpec.set(p, combat.addPack(members, p.room.kind === 'side', p.elite, p.look))
  }
  combat.breakables = level.breakables
  // the Line's trains (design/area3/SPEC.md §5): their clock starts with the level
  if (level.lanes?.length) {
    combat.line = new Line(level, run.seed, lineHost)
    world.scene.add(combat.line.group)
  }
  const boss = bossHere(depth)
  if (level.boss && boss && !run.bossFelled) combat.addBoss(level.boss.x, level.boss.z, level.boss.face, combat.weight ? { ...boss, hp: Math.round(boss.hp * WEIGHT_PRESETS[weightPresetId()].bossHp) } : boss, level.posts, level.track)
  // G8: a thief in a barrel in its elite's room, with no pack (it never spawns carrying)
  arenaFloor = null
  const lt = level.thief
  lastThief = lt ? combat.addThief(new Thief(lt.nest.x, lt.nest.z, lt.nest, thiefWorld(), packOfSpec.get(lt.pack) ?? null)) : null
  thiefChimeT = 0
  // every crawl depth: three pedestals by the exit, the pick before he leaves (a resume raises the same three)
  run.picks = boss || !PEDESTALS_ON ? [] : raisePicks('exit', level.exit, exitApproach(level), o.picks)
  // a felled boss is never fought again: its beams are open, as they were when it fell, and a tower stands as its husk
  if (run.bossFelled) {
    for (const kind of exitsAfterBoss(depth)) kind === 'cold' ? level.openExit() : level.openHome()
    if (level.footprint && level.boss) raiseHusk(level.boss.x, level.boss.z, 0)
    // the Engine dies anywhere and a save does not know where: its husk stands where it slept, along the rails there
    else if (boss?.kind === 'engine' && level.boss && level.track) {
      const at = engineSleepAt(level.track, level.boss.x, level.boss.z)
      raiseEngineHusk(at.x, at.z, at.yaw)
    }
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
  // the day starts where this depth's span does; the last depth's boss, once down, is at first dark (a 6-depth run's is the Arbiter's square)
  day.enter(depth, run.bossFelled && (RUN_DEPTHS === 9 || boss?.kind === 'arbiter' || boss?.kind === 'engine'))
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
  run.stats.push({ depth, fights: 0, pushes: 0, breaks: 0, deadTaps: 0, quiets: 0, strainIn: run.strain, strainOut: null, hand: 0, shots: 0, eye: 0, eyeCasts: 0, handBreaks: 0, braced: 0, playS: 0, eyeBreaks: 0, openings: 0, plantedS: 0, autoDmg: { hand: 0, eye: 0, core: 0 }, pressure: combat.pressure, hpLost: 0,
    followThrough: combat.followThrough, weight: combat.weight, breaksBy: { ready: 0, pushed: 0 }, freezeMs: 0, freezePartMs: 0, freezeAutoMs: 0, tapPush: hud.tapPush, tapPushes: 0, queued: 0, queueDropped: 0, guarded: 0, autoDmgReal: { hand: 0, eye: 0, core: 0 }, kills: { part: 0, auto: 0, other: 0 }, fightS: 0, bankBeats: 0, emptyBeats: 0, temper: temperOn, melts: 0,
    counters: combat.counters, lunges: { started: 0, hit: 0, broken: 0 }, catches: { hulk: 0, sentinel: 0, mite: 0 }, parryCatch: combat.parryCatch, parryReadies: 0, ducks: { started: 0, peeked: 0, backed: 0 },
    states: Object.fromEntries(STATE_IDS.map((id) => [id, { set: 0, paid: 0, expired: 0 }])) as DepthStats['states'],
    stateBonus: Object.fromEntries(STATE_IDS.map((id) => [id, 0])) as DepthStats['stateBonus'],
    paidBy: { head: 0, torso: 0, arms: 0, legs: 0, hand: 0, eye: 0 }, pushedIntoState: 0, shatter: { n: 0, dmg: 0 }, maxMul: 1,
    menders: { met: 0, cut: 0, killed: 0, healed: 0 },
    core: combat.core, temperFlat: coreActive(), keystone: combat.keystone, upgrades: [...combat.upgrades], movingS: 0, nearBins: [0, 0, 0, 0, 0], nearMovingBins: [0, 0, 0, 0, 0], wallS: 0, closeS: 0,
    marks: { made: 0, byCore: 0, byPart: 0, spent: 0, expired: 0 }, spends: { hits: 0, bonus: 0, lag: [0, 0, 0, 0] }, spendsPerFight: [], backhand: { casts: 0, whiffs: 0 } })
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
    phase: 'crawl', strain: 0, kept: 0, ranks: {}, swaps: [], mastery: new Set<MasteryId>(), core: ARCH_PARAM ? null : CORE_PARAM, keystone: null, upgrades: [], corePick: null, archPick: null, t: 0, swapped: false, ramStunSeen: false,
    id: newRunId(), dev: DEPTH_PARAM !== null, committed: false, ending: null, stats: [], drops: [], taps: [], walkS: 0, tally: freshTally(),
    startedAt: new Date().toISOString(), breakRule: combat.breakRule, hand: combat.closeHand, eye: combat.eye, route: ROUTE_PARAM,
  })
  applyArchetype(ARCH_PARAM)
  syncCore()
  playKey = `${run.id}.${Date.now().toString(36)}`
  if (!run.dev) {
    // the first night: the doorframe's marks grow from here, in calendar time
    save.firstRunAt ??= new Date().toISOString()
    // a run begun some other way than the door still settles the hook the door would have
    applyHookDefault(save)
    store.write()
  }
  clearLoot()
  // Still begins with one part: the one on the hook, else a random plain one; the rest
  // he finds. Starting deeper (?depth=) skips the levels where he'd have found them, so
  // he gets all four.
  const start = START_DEPTH > 1 ? STARTING : [byId(startPart(save))]
  for (const p of start) carry(p.id)
  // the last run's anchor or decoy goes before the new loadout arrives, so nothing carries over onto its buttons
  combat.reset()
  if (ARCH_PARAM) {
    wearKit(ARCH_PARAM)
  } else {
    hud.resetLoadout(start.map((d) => asWorn(d, 1)))
    for (const slot of SLOT_NAMES) still.wear(slot, start.find((p) => p.slot === slot) ?? null)
  }
  enterLevel(START_DEPTH)
  hud.bossBar(null)
  rig.reset()
  hud.enabled = true
  overlay.hide()
  sfx.restore()
  writeSnapshot()
  // the pick (BUILD.md §2.8): depth 1 is entered, nothing is fought yet. A dev run never shows it (`?core=` is its way); builds off: a bare run
  if (buildsOn && !run.dev) (PICK_CORE ? offerCore : offerArchetype)('start')
}

/** Not crypto.randomUUID: that needs a secure context, and the phone plays over plain http on the LAN. */
function newRunId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

/** The depth being left gets its strain on the way out. */
function closeStats() {
  flushFight()
  const st = run.stats[run.stats.length - 1]
  if (!st || st.strainOut !== null) return
  st.strainOut = run.strain
  // a run's end posts once, from commit, when it knows how it ended
  if (!run.committed) savePlaytest()
}

/** Which entry in playtest.json this run writes: one per start or resume. */
let playKey = ''

/**
 * The phone can't open a console, so each depth's end and the run's end save the run so far:
 * on the dev server, a POST it keeps in playtest.json (one entry per run, replaced as it grows);
 * on the owner's device (`?owner` once), the same entry kept on the phone for the pause
 * screen's export (playlog.ts). Anyone else's build records nothing.
 */
function savePlaytest() {
  // the owner's phone runs only: a headless check (webdriver) never lands in his numbers
  if (!playKey || navigator.webdriver || (!import.meta.env.DEV && !owner)) return
  const body = playtestBody()
  if (owner) playlog.keep(body)
  if (import.meta.env.DEV) void fetch('/__save/playtest', { method: 'POST', body: JSON.stringify(body) }).catch(() => {})
}

/** The run so far, as the playtest file and the owner's export keep it (also a DEV hook, for K-M20: a headless run never saves one). */
function playtestBody() {
  return {
    key: playKey, id: run.id, build: __BUILD__, startedAt: run.startedAt, savedAt: new Date().toISOString(),
    dev: run.dev, end: run.ending?.kind ?? null, depth: run.depth, runDepths: RUN_DEPTHS, route: run.route, breakRule: run.breakRule, hand: run.hand, eye: run.eye,
    stats: statsOut(),
    walkS: Math.round(run.walkS),
    taps: run.taps,
    swaps: run.swaps,
    corePick: run.corePick,
    archetype: run.archetype,
    parts: partDrops(),
    drops: run.drops,
  }
}

/** The open field's map: filled in as he walks, drawn on the pause screen. */
const fieldMap = createFieldMap()
function openMap() {
  if (!level) return
  const w = Math.min(window.innerWidth - 48, 760)
  const h = Math.min(window.innerHeight - 150, 420)
  pause.map(fieldMap.draw(level, still.pos, w, h), () => pause.loadout(() => hud.slots, resume))
}
pause.setAction(() => 'map', openMap, () => !!level?.open)

/**
 * The open field's exit, when it's off screen: a faint cold chevron circling Still, pointing to it
 * (on the screen's edge it sat under the buttons). On screen the beam speaks for itself and it goes.
 */
const exitMark = document.createElement('div')
exitMark.className = 'exitmark'
hudRoot.appendChild(exitMark)
const markAt = new THREE.Vector3()
function updateExitMark() {
  const on = !!level?.open && level.exitOpen && run.phase === 'crawl' && !paused
  if (!on) {
    exitMark.classList.remove('show')
    return
  }
  markAt.set(level!.exit.x, 1, level!.exit.z).project(world.camera)
  let x = markAt.x
  let y = markAt.y
  // behind the camera the projection flips: point the other way
  if (markAt.z > 1) { x = -x; y = -y }
  if (Math.abs(x) <= 0.95 && Math.abs(y) <= 0.92 && markAt.z <= 1) {
    exitMark.classList.remove('show')
    return
  }
  // the direction on screen from Still to the exit, and the chevron that far out from him
  const w = window.innerWidth, h = window.innerHeight
  markAt.set(still.pos.x, 1, still.pos.z).project(world.camera)
  const sx = ((markAt.x + 1) / 2) * w, sy = ((1 - markAt.y) / 2) * h
  const ex = ((x + 1) / 2) * w, ey = ((1 - y) / 2) * h
  const a = Math.atan2(ey - sy, ex - sx)
  const r = Math.min(w, h) * 0.2
  exitMark.style.transform = `translate(${sx + Math.cos(a) * r}px, ${sy + Math.sin(a) * r}px) rotate(${a}rad)`
  exitMark.classList.add('show')
}

/** This device keeps its own playtest log (playlog.ts): set by `?owner`, kept per device. */
const owner = playlog.ownerFromUrl()
if (owner) pause.setAction(() => `export log <b>${playlog.readLog().length}</b>`, () => void playlog.exportLog())

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
 * The cold beam's dressing: the road it leads to, or null. After boss 6 of a 9-depth run it is always the other road,
 * with no room. Otherwise it is §3.6's fallback: only at depth 3, while the road isn't chosen, the alternate is on and
 * the Line is open, the road the alternate would give him.
 */
function yardRoad(): RouteId | null {
  if (RUN_DEPTHS === 9 && run.depth === 6) return otherRoad(run.route ?? 'II')
  if (run.depth !== 3 || run.route) return null
  if (roadChoice() !== 'alternate' || !flag('line') || !save.roads.includes('III')) return null
  return routeForAlternate()
}

/**
 * §3.6, the fallback: with no room, the Assembler's cold beam is dressed as the road it leads
 * to, with its name (the alternate's, at depth 3; and after boss 6 of a 9-depth run, always the other road). Only once it's open.
 */
function dressYardBeam() {
  clearYardDressing()
  if (!level || !level.exitOpen) return
  const route = yardRoad()
  if (!route) return
  const at = level.exit.clone()
  let railFrom: THREE.Vector3
  if (level.coldAway) {
    // in the square: the rails run out from the beam's foot, away from the tower, to the floor's edge or 14 u, whichever is
    // shorter (at least 2 u, so a rail has a length); they never cross the husk
    const away = level.coldAway
    let t = 0
    while (t < 14 && level.floor.has(key(Math.round((at.x + away.x * (t + 1)) / 4), Math.round((at.z + away.z * (t + 1)) / 4)))) t += 1
    railFrom = new THREE.Vector3(at.x + away.x * Math.max(2, t), 0, at.z + away.z * Math.max(2, t))
  } else {
    // the depth-3 yard: the Line's rails run in from past the floor's far-right edge (−z), into the beam's foot
    let z = at.z
    while (level.floor.has(key(Math.round(at.x / 4), Math.round(z / 4)))) z -= 1
    railFrom = new THREE.Vector3(at.x, 0, z - 12)
  }
  const d = dressRoad(route, at, railFrom)
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
  clearLoot()
  combat.reset()
  partFx.clear()
  clearCoreFx()
  run.seed = seed
  run.bossFelled = true
  run.bossLoot = []
  run.picks = []
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
  clearLoot()
  combat.reset()
  partFx.clear()
  clearCoreFx()
  combat.terrain = workshop.terrain
  loot.terrain = workshop.terrain
  // the room wears its own wood and stone, whatever the run was last in
  setSurfaces(PLACES.ruin.surfaces)
  offered = null
  atShrine = null
  atHome = false
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
  if (pushed) pushSerial[def.slot] = (pushSerial[def.slot] ?? 0) + 1
  pushing = pushed ? def.slot : null
  const r = cast(def, pushed)
  pushing = null
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
  run.taps.push({ depth: run.depth, slot: p.slot, ms: Math.round(p.ms), ready: p.ready, result: p.result, leftMs: p.leftMs, at: p.at, ...(p.nbMs !== undefined ? { nbMs: p.nbMs, nbSlot: p.nbSlot } : {}), ...(p.tp ? { tp: true as const } : {}) })
  if (p.result !== 'dead') return
  const st = run.stats[run.stats.length - 1]
  if (st) st.deadTaps++
  sfx.deadTap(0.35)
})

/**
 * "tap push" (design/lean/TAP-PUSH.md): the touch-down's answer, counted on the open depth and heard at once. A push's own strain is still
 * charged in onFire (`pushes` too); this adds the gesture's share. A queued cast and a ready press carry no price, so no answer for them.
 */
hud.onAnswer((a) => {
  if (run.phase !== 'crawl') return
  const st = run.stats[run.stats.length - 1]
  if (!st) return
  if (a.kind === 'push') st.tapPushes++
  else if (a.kind === 'queued') {
    st.queued++
    sfx.queued(0.35)
  } else if (a.kind === 'guarded') {
    st.guarded++
    sfx.deadTap(0.35)
  } else st.queueDropped++
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
  // weight: every ready cast has a push's whole effect (the break rule, the threat aim, the pose, pitch and scale), but none of its cost or signature.
  // `pushed` stays the real push (strain, the embers, the grind); off, `full === pushed` and nothing below differs from today
  const full = pushed || combat.weight
  const r = combat.useAbility(def, {
    origin: still.pos, facing: still.facing, moveX: hud.moveX, moveZ: hud.moveZ, pushed, full, strain: run.strain,
  })
  if (r.cooldown === 'refused') {
    sfx.denied()
    return r
  }
  // the Engine's lever: any cast that landed, with Still within reach of the open one, throws it
  if (combat.boss instanceof Engine) combat.boss.onCast(still.pos)
  // a rewind gave integrity back: the fill is seen, not just counted
  if (combat.hp > hpBefore + 0.5) hud.healing()
  // Snap the body to the target, or the swing plays sideways out of his shoulder.
  if (r.aim !== null) still.facing = r.aim
  sfx.ability(r.beat, full, r.power, pushed)
  still.attack({ beat: r.beat, pushed: full, holdS: r.holdS, power: r.power, lean: r.lean, cocked: combat.weight })
  // weight: the fx follow the numbers the cast really used (the cone, the radius)
  castFx(combat.weight ? weighed(def) : def, r, pushed)
  still.group.scale.setScalar(full ? 1.16 : 1.08)
  // weight: a head bolt draws its light in at the lens first (Through-Line has its own draw, in castFx): six motes, at Still, never at a body
  if (combat.weight && homeSlot(def) === 'head' && r.beat !== 'through') {
    vfx.gather(still.lensPoint(new THREE.Vector3()), WEIGHT_FEEL.gather.count, WEIGHT_FEEL.gather.radius, COLD)
  }
  // weight: nothing on the press. The feel comes from onContact, when something is struck (a whiff has none)
  if (!combat.weight) {
    shake = Math.max(shake, pushed ? 0.34 : 0.16)
    if (!MOVES.has(def.shape)) hitstop = Math.max(hitstop, pushed ? 0.06 : 0.035)
    rig.punch(pushed ? 0.06 : 0.02)
  }
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
  if (pushed) pushSignature()
}

/** What only a real push throws: embers off his own joints, because it costs him. (The vibration is the hud's, the grind is audio's: both real-push only.) */
function pushSignature() {
  vfx.sparks(at3(still.pos, 1.2), EMBER, 14, 4)
  if (import.meta.env.DEV) pushSig++
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
  // each face goes with the part, wherever it is worn (an archetype's slot law lets a part sit off its own slot): find it by what it does
  const wornWith = (pred: (d: AbilityDef) => boolean) => hud.slots.find((s) => s.def && pred(s.def)) as { slot: SlotName; def: AbilityDef } | undefined
  // LIVE: something of his is out in the world, drawn as a lit ring that drains
  for (const slot of SLOT_NAMES) hud.live(slot, combat.liveFrac(slot))
  const anchorOn = wornWith((d) => d.shape === 'anchor')
  // Plumb Line: the button becomes the snap while the anchor is out, and dims when a snap would be refused
  if (anchorOn) {
    const legs = anchorOn.def
    const a = combat.parts.anchor
    hud.iconState(anchorOn.slot, a ? 'snap' : null)
    const far = !!a && Math.hypot(a.pos.x - still.pos.x, a.pos.z - still.pos.z) > legs.range
    hud.setClass(anchorOn.slot, 'far', far)
    if (far && !anchorFar) sfx.tetherFar()
    anchorFar = far
  } else {
    anchorFar = false
  }
  // Borrowed Time: the pale segment on integrity, and the afterimage where a rewind would take him
  const rewindOn = wornWith((d) => d.shape === 'rewind')
  if (rewindOn) {
    const legs = rewindOn.def
    hud.recentDamage(combat.history.recentDamage((legs.windowMs ?? 1500) / 1000) / 100)
    partFx.echo(hud.isReady(rewindOn.slot) && run.phase === 'crawl' ? combat.history.at((legs.windowMs ?? 1500) / 1000) : null)
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
  const bounceOn = wornWith((p) => p.mod?.kind === 'bounce')
  if (bounceOn && hud.isReady(bounceOn.slot) && run.phase === 'crawl') {
    if ((bankT -= dt) <= 0) {
      bankT = 0.1
      partFx.bankTick(combat.bankPreview(bounceOn.def, still.pos))
    }
  } else {
    partFx.bankTick(null)
  }
  const chargeOn = wornWith((p) => p.mod?.kind === 'charge')
  if (chargeOn && chargeOn.def.mod?.kind === 'charge') {
    const m = chargeOn.def.mod
    const c = Math.min(1, Math.max(0, (combat.parts.patientSince - m.minS) / (m.fullS - m.minS)))
    hud.charge(chargeOn.slot, c)
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

  const fray = wornWith((p) => p.mod?.kind === 'fray')
  if (fray && fray.def.mod?.kind === 'fray') {
    const at = fray.def.mod.at
    const tier = run.strain < at[0] ? 0 : run.strain < at[1] ? 1 : 2
    hud.iconState(fray.slot, tier === 0 ? null : tier === 1 ? 'fray-180' : 'fray-360')
    if (frayTier !== null && tier !== frayTier) {
      // the meter, the button and the body change together, so the link teaches itself
      const up = tier > frayTier
      sfx.frayCross(up)
      hud.pulse(fray.slot)
      if (up) vfx.embers(still.jawL.getWorldPosition(new THREE.Vector3()), 8, 0.1)
    }
    frayTier = tier
  } else {
    frayTier = null
  }

  // the body's side of LIVE: the lure went with the decoy, the bob with the anchor.
  // Polled after the decoy was cloned, so the decoy carries the lit lure and he doesn't.
  for (const slot of SLOT_NAMES) still.setLive(slot, combat.parts.decoy?.def.slot === slot || combat.parts.anchor?.def.slot === slot)
  if (wornWith((p) => p.mod?.kind === 'mark')) {
    let marked = false
    for (const [, st] of combat.statuses()) if (st.marked.t > 0) marked = true
    still.ctx.marked = marked
  }
  // the push cue: a worn pair's payer shows its state's glyph, lit while a push would pay it
  const worn = hud.loadout
  for (const sl of hud.slots) {
    const d = sl.def
    const id = d?.pays?.find((s) => paired(d, s, worn, run.mastery)) ?? null
    hud.stateCue(sl.slot, id, !!d && !!id && run.phase === 'crawl' && combat.wouldPay(d, still.pos))
  }
  spendCues()
}

/**
 * The spend count on each spender's button (BUILD.md §2.9, B5): how many core marks a cast would spend now, by the cast's own target and hit test (`combat.spendCount`). At most every
 * `SPEND_HUD.refreshS` of game time, for each worn spender only; the others, and every button with no core worn, show nothing.
 */
let spendAt = -Infinity
function spendNow(d: AbilityDef): number | null {
  return combat.spendCount(d, still.pos, { x: hud.moveX, z: hud.moveZ }, still.facing, !hud.isReady(d.slot) || combat.weight, run.strain)
}
function spendCues() {
  if (!(run.phase === 'crawl' && coreActive())) {
    if (spendAt !== -Infinity) {
      for (const sl of hud.slots) hud.spendCue(sl.slot, null)
      spendAt = -Infinity
    }
    return
  }
  if (combat.time >= spendAt && combat.time - spendAt < SPEND_HUD.refreshS) return
  spendAt = combat.time
  for (const sl of hud.slots) hud.spendCue(sl.slot, sl.def && fitOf(sl.def, run.core)?.role === 'spend' ? spendNow(sl.def) : null)
}

/**
 * The first fight with a core worn says what the blue buttons are (SHOW.md item 6): one line at the top, its own hint id per core, once per save, gone after the first spend or ~8 s
 * (coreshow.ts). It waits for a fight, so it is never read in an empty room.
 */
function firstFightHint(fighting: boolean) {
  const c = coreNow()
  if (!c || !fighting || coreShow.hinting || run.phase !== 'crawl') return
  const id = `core-${c}`
  if (hintStore.hinted(id)) return
  hintStore.markHinted(id)
  coreShow.hint(WORDS.firstFight[c])
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
  // the core's follow-through dim is the fight's alone: every other phase (the room, the endings, the walk home) lights it.
  // In the crawl it's written after still.update reads it, so it stands until the next tick
  if (run.phase !== 'crawl') still.coreDim = 0
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

  // the playtest clock: only stepped time counts, so a pause or a hidden app never runs it
  if (run.phase === 'crawl') {
    const st = run.stats[run.stats.length - 1]
    if (st) {
      st.playS = (st.playS ?? 0) + realDt
      if (combat.inStance) st.plantedS = (st.plantedS ?? 0) + realDt
      if (combat.foeWithin(still.pos, FIGHT_NEAR)) {
        st.fightS = (st.fightS ?? 0) + realDt
        // the build layer's posture log (§2.11): fight seconds with the stick out, and by how far the nearest awake body's edge is (bins 2 / 3.5 / 6 / 11 u)
        if (st.nearBins && st.nearMovingBins) {
          const gap = combat.handGap(still.pos)
          const b = gap < 2 ? 0 : gap < 3.5 ? 1 : gap < 6 ? 2 : gap < 11 ? 3 : 4
          st.nearBins[b]! += realDt
          if (combat.walking) {
            st.movingS += realDt
            st.nearMovingBins[b]! += realDt
          }
          // Ram's posture: fight seconds within 2 u of a wall, and within 2 u of a wall or of the nearest awake body's edge
          const wall = combat.terrain.blocked(still.pos.x, still.pos.z, 2)
          if (wall) st.wallS += realDt
          if (wall || gap < 2) st.closeS += realDt
        }
      }
    }
    if (level?.open) fieldMap.reveal(level, still.pos)
  } else if (run.phase === 'homing' || run.phase === 'toWalk' || run.phase === 'walkHome') run.walkS += realDt

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

  // Wake's Slipstream (cores.ts): walk speed x mul while skims have banked some; STILL_WALK is his own pace, so with no core it is never anything else
  still.speed = STILL_WALK * (combat.core === 'wake' && combat.slipS > 0 ? UPGRADES['wake-slip'].mul : 1) * (run.archetype === 'marksman' ? TRAIT.marksman.footwork.speed : 1)
  still.update(dt, hud.moveX, hud.moveZ)

  // mid-vault he's over the wall, not in it
  if (!still.vaulting) combat.terrain.pushOut(still.pos, BODY_RADIUS)
  pushOffBoss()

  // planted, he faces the eye's body, unless the hand has one in reach (the hand comes first)
  const eyeAim = combat.eyeTarget && !(combat.closeHand && combat.handGap(still.pos) <= HAND_REACH) ? combat.eyeTarget.pos : null
  const target = eyeAim ?? combat.nearestTarget(still.pos, 9.5)
  still.aim = target ? Math.atan2(target.x - still.pos.x, target.z - still.pos.z) : null

  // the stick, not his position: a dash or a shove doesn't unplant him, a step does
  combat.walking = hud.moveX !== 0 || hud.moveZ !== 0
  combat.update(dt, still.pos)
  still.planted = combat.inStance
  // follow-through, bank empty in a fight: the core dims, Still waiting for a press. Between fights the quiet has
  // emptied it, and a core dim down every corridor would read as Still switched off, not waiting
  still.coreDim = combat.followThrough && combat.bank < 1 && combat.foeWithin(still.pos, FIGHT_NEAR) ? 1 : 0
  thiefFx(dt)
  menderLog()
  engineVoice()
  trackDay(dt)
  partFx.update(dt)
  loot.update(dt, still.pos)
  updateOffer()
  updateKeys()
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
      flushFight()
      fightSt = st ?? null
    }
    run.fought = true
    run.quietT = 0
  } else if (run.fought && run.phase === 'crawl') {
    run.quietT += dt
    // a fight is cleared by clearing it: outrunning a pack until it walks home is not a quiet
    if (run.quietT >= QUIET_SECONDS) {
      if (run.killed) quiet()
      else {
        run.fought = false
        flushFight()
      }
    }
  }
  // the free push, drawn while the fight is on: the quiet at its end pays QUIET_STRAIN back
  // (under the depth's floor, after a Rest, the quiet pays back only down to the floor)
  hud.freePush(run.fought && run.phase === 'crawl' ? { from: run.water, width: Math.max(0, Math.min(QUIET_STRAIN, run.water + QUIET_STRAIN - quietFloor())) } : null)

  // the boss: its bar, its second phase, and the sound of its window opening (a charge into a wall)
  const boss = combat.boss
  if (boss && !boss.dead) {
    const awakeBoss = combat.awake.includes(boss)
    const bossSt = run.stats[run.stats.length - 1]
    // the strain he brought to this boss (strainIn is the strain at level entry, not at the wake): once, on the first tick it is awake
    if (awakeBoss && bossSt && bossSt.strainAtBoss === undefined) bossSt.strainAtBoss = run.strain
    const def = boss.def
    hud.bossBar(awakeBoss ? { name: def.name, frac: boss.hp / boss.maxHp, phase2: boss.phase2, open: boss.open, openWord: def.openWord, board: boss.board?.() ?? '' } : null)
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
  // and so is home, the same way; beside a cold beam it asks first (updateShrinePrompt, the prompt's tap)
  const toHome = level?.home ? Math.hypot(still.pos.x - level.home.x, still.pos.z - level.home.z) : Infinity
  if (toHome > BEAM_REARM) beamArmed.home = true
  if (run.phase === 'crawl' && level?.home && level.homeOpen && !level.exitOpen && beamArmed.home && toHome < EXIT_RADIUS) {
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
  clearLoot()
  combat.reset()
  partFx.clear()
  clearCoreFx()
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

/** The mood the frame loop last passed to updateAmbience (DEV: __ambience). */
let moodLast: AmbienceMood = 'crawl'

/** The room tone for where he is: the place's, a boss level's own. */
function moodNow(): AmbienceMood {
  const place = placeNow()
  return level?.boss ? (bossHere(run.depth)?.arena === 'roundhouse' ? 'roundhouse' : place.ambience.boss) : place.ambience.crawl
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
      const who = e.kind === 'chaser' ? 'hulk' : e.kind === 'ranged' || e.kind === 'mender' ? 'tripod' : e.kind === 'charger' ? 'ram' : e.kind === 'thief' ? 'thief' : 'boss'
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
    lift: (g) => {
      endDrop(g, 'stolen')
      const rec = dropRecs.get(g)
      if (rec) caged.set(g.def.id, rec)
      return loot.lift(g)
    },
    still: still.pos,
    floor, rooms, beams,
    barrel: pieceData('barrel_large'),
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
    case 'burst': {
      // the barrel comes apart like any barrel, and the little body is up and over the staves, cage glinting
      combat.burst(at, 0xb89a7a)
      sfx.smash(pan)
      vfx.chunks(at3(at, 0.6), 14, WOOD, 4.5, 0.16)
      vfx.dust(at, 10, 0.7, new THREE.Color(0x6a5a48))
      vfx.sparks(at3(at, 0.9), COLD, 6, 2.5)
      sfx.thiefChime(pan)
      shake = Math.max(shake, 0.12)
      break
    }
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
        const g = floorPart(ev.def, at, still.pos)
        // the same drop, back on the floor: its record goes on, not a new one
        const rec = caged.get(ev.def.id)
        if (rec) {
          caged.delete(ev.def.id)
          rec.end = null
          dropRecs.set(g, rec)
        } else logDrop(g, 'thief')
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
  // Slipstream: a cold streak at his heels while the banked speed runs
  if (combat.core === 'wake' && combat.slipS > 0 && run.phase === 'crawl') vfx.trail(at3(still.pos, 0.18), COLD, 0.22, 0.3)
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

/**
 * How long between drawn frames right now. The world behind the pause card (or the broken ending's
 * black) can't be seen moving, and the room at rest has nothing quick in it.
 */
function drawEvery(): number {
  // a drawing is taken off the canvas: that frame, and the next, are drawn
  if (drawings.wanting) return FRAME_S
  if (paused || pause.open) return BEHIND_CARD_S
  if (run.phase === 'ending' && run.ending?.kind === 'broken') return BEHIND_CARD_S
  if (run.phase === 'workshop' && hud.moveX === 0 && hud.moveZ === 0 && clock / 1000 - roomMovedAt > ROOM_REST_S) return IDLE_ROOM_S
  return FRAME_S
}

/** The room counts as at rest this long after the last thing that moved in it (Still, the camera, the stick). */
const ROOM_REST_S = 1
let roomMovedAt = 0
const lastDrawnAt = new THREE.Vector3()
const lastDrawnCam = new THREE.Vector3()
let lastDrawn = 0
let lastEvery = 0

function frame(nowMs: number) {
  const now = nowMs / 1000
  const every = drawEvery()
  // a faster screen's extra frames: nothing stepped, nothing drawn, the time carried to the next
  if (!pacer.due(now, every)) {
    requestAnimationFrame(frame)
    return
  }
  const t0 = performance.now()
  const elapsed = Math.min(MAX_FRAME, now - last)
  last = now

  if (paused || held) {
    // frozen: render only
  } else if (hitstop > 0) {
    // the weight trial's log: the real frozen ms, all sources (headless __step never gets here)
    if (run.phase === 'crawl') {
      const st = run.stats[run.stats.length - 1]
      if (st) st.freezeMs += Math.min(hitstop, elapsed) * 1000
    }
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
  updateExitMark()

  moodLast = home ? 'workshop' : moodNow()
  updateAmbience(moodLast)
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
  if (!paused && !clockHeld) clock += elapsed * 1000
  drawEliteLabels()
  drawRoadLabels()
  partFaces(elapsed)
  flushParryReady()
  hud.update(clock)
  coreShow.update(paused ? 0 : elapsed)
  wakeFx.update(!home && run.phase === 'crawl' && !!level && coreNow() === 'wake', paused ? 0 : elapsed, x, z, combat)
  shoveFx.update(!home && run.phase === 'crawl' && !!level && coreNow() === 'ram', paused ? 0 : elapsed, x, z)
  thornFx.update(!home && run.phase === 'crawl' && !!level && coreNow() === 'thorns', paused ? 0 : elapsed, combat, x, z)
  tetherFx.update(!home && run.phase === 'crawl' && !!level && coreNow() === 'tether', paused ? 0 : elapsed, combat, x, z)
  firstFightHint(fighting)
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
  // the hand's ring: in a crawl with the switch on, waking as an awake body nears the reach
  handRing.update(paused ? 0 : elapsed, x, z, combat.handGap(still.pos), !home && run.phase === 'crawl' && combat.closeHand && combat.core === null && !!level)
  // the eye's sightline: planted in a crawl, to the body it has chosen, drawn where that body is drawn
  const seen = !home && run.phase === 'crawl' && !!level ? combat.eyeTarget : null
  sightline.update(paused ? 0 : elapsed, x, z, seen && { key: seen, x: seen.group.position.x, z: seen.group.position.z, r: seen.radius })
  syncTells()
  combat.miteBatch.sync(world.camera, now)
  combat.sleeperBatch?.sync(world.camera, now)
  markFx.draw(combat, paused ? 0 : elapsed, x, z)
  world.render()
  // straight after the render, while the drawing buffer is still there
  drawings.afterRender(world.renderer.domElement)

  // the room is at rest once nothing in it has moved for a moment
  if (run.phase !== 'workshop' || hud.moveX !== 0 || hud.moveZ !== 0 ||
    lastDrawnAt.distanceToSquared(still.group.position) > 1e-8 || lastDrawnCam.distanceToSquared(world.camera.position) > 1e-8) {
    roomMovedAt = clock / 1000
  }
  lastDrawnAt.copy(still.group.position)
  lastDrawnCam.copy(world.camera.position)
  // resolution follows how long frames take, measured only while drawing at the full rate
  if (every === FRAME_S && lastEvery === FRAME_S) quality.frame(now - lastDrawn, now, !fighting)
  else quality.reset()
  lastDrawn = now
  lastEvery = every
  readout?.frame(now, performance.now() - t0)
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
  flushParryReady()
  hud.update(clock)
}

/** DEV: a level on a road, generated for a check and thrown away (the Arbiter's switch as shipped, the Engine's as flagged). */
function genFor(depth: number, seed: number, route: RouteId, thiefFirst = false) {
  return generateLevel(depth, seed, { boss: bossFor(depth, ARBITER_AT_6, route, flag('engine')), place: lookAt(depth, route, flag('engine')), thiefFirst })
}

if (import.meta.env.DEV) {
  Object.assign(window, {
    __combat: combat, __still: still, __hud: hud, __loot: loot, __level: () => level, __world: world,
    __markFx: markFx,
    __wakeFx: wakeFx,
    __shoveFx: shoveFx,
    __thornFx: thornFx,
    __tetherFx: tetherFx,
    __coreShow: coreShow,
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
    __pack: (members: { kind: Archetype; variant?: 'lobber' | 'signal' | 'handcar'; x: number; z: number; slag?: true; lesson?: true; siding?: SidingDef }[], awake = true, elite?: EliteMod, look?: 'heap' | 'ballast'): Pack => {
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
    __genLook: (depth: number, seed: number, route: RouteId = 'II', thiefFirst = false) => {
      const l = genFor(depth, seed, route, thiefFirst)
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
        thief: l.thief ? { x: l.thief.nest.x, z: l.thief.nest.z, room: l.rooms.indexOf(l.thief.room), pack: l.packs.indexOf(l.thief.pack) } : null,
      }
      l.dispose()
      return out
    },
    /**
     * tools/dropsim.ts's levels: per depth, n generated levels as what drops from them (each
     * pack as "main|side[*=elite]: kinds", its crates and barrels, a Plenty shrine or not).
     * Returns the file's text, one level a line: refresh with copy(__census()) into tools/levels.json. `route` is the order (INV-O2);
     * the header says how many depths the run had.
     */
    __census: (n = 40, route: RouteId = 'II') => {
      const depths: Record<number, { boss: boolean; levels: { packs: string[]; crates: number; plenty: boolean }[] }> = {}
      for (let d = 1; d <= RUN_DEPTHS; d++) {
        const levels = []
        let boss = false
        for (let i = 1; i <= n; i++) {
          const l = genFor(d, i * 7919, route)
          boss = !!l.boss
          levels.push({
            packs: l.packs.map((p) => `${p.room.kind === 'side' ? 'side' : 'main'}${p.elite ? '*' : ''}: ${p.members.map((m) => m.kind).join(' ')}`),
            crates: l.breakables.length, plenty: l.shrines.some((sh) => sh.kind === 'plenty'),
          })
          l.dispose()
        }
        depths[d] = { boss, levels: boss ? [] : levels }
      }
      const body = Object.entries(depths).map(([d, v]) =>
        `  "${d}": { "boss": ${v.boss}, "levels": [${v.levels.map((l) => '\n    ' + JSON.stringify(l)).join(',')}${v.levels.length ? '\n  ' : ''}] }`)
      return `{\n "build": "${__BUILD__}", "route": "${route}", "n": ${n}, "runDepths": ${RUN_DEPTHS},\n "depths": {\n${body.join(',\n')}\n }\n}\n`
    },
    /** The same path a tap (false) or push (true) takes after the gesture: HUD cooldown, cast, strain. */
    __fire: (slot: SlotName, pushed = false) => hud.fireSlot(slot, pushed),
    /** Put a part on its button without the ground. */
    __equip: (id: string, slot?: SlotName) => {
      const def = asWorn(byId(id), 1, slot)
      swapIn(def)
      still.wear(def.slot, def)
    },
    __stick: (x: number, z: number) => hud.setStick(x, z),
    /** One enemy as its own pack of 1. awake = true wakes it at once. A boss is the variant's (default the Assembler). */
    __spawn: (kind: Archetype, x: number, z: number, awake = true, elite?: EliteMod, variant?: BossKind | 'lobber' | 'signal', lesson?: true): Enemy => {
      // a thief nests where it's spawned: in __arena's floor, or the level's
      if (kind === 'thief') return (lastThief = combat.addThief(new Thief(x, z, new THREE.Vector3(x, 0, z), thiefWorld())))
      if (kind === 'boss') {
        const defs: Record<BossKind, BossDef> = { assembler: ASSEMBLER_DEF, arbiter: ARBITER_DEF, engine: ENGINE_DEF }
        // the Arbiter stands among __arena's posts, when it built them
        // the Engine runs a track round the origin, __arena's floor being exactly the 28 u room there
        const kindOf = (variant ?? 'assembler') as BossKind
        const b = combat.addBoss(x, z, new THREE.Vector3(x, 0, z - 1), defs[kindOf], devPosts?.posts ?? [], kindOf === 'engine' ? makeTrack(0, 0, 'z') : undefined)
        if (awake) combat.wake(combat.packs[combat.packs.length - 1]!)
        return b
      }
      const pack = combat.addPack([{ kind, x, z, variant: variant === 'lobber' || variant === 'signal' ? variant : undefined, lesson }], false, elite ? { mod: elite, name: 'Test' } : undefined)
      if (awake) combat.wake(pack)
      return pack.members[0]!
    },
    /**
     * B5: a Handcar on siding i of this level, as its own pack of 1, at rail end `end` (default: the one farther from the entrance room's
     * centre, where a generated one stands); awake = true wakes it at once.
     */
    __handcar: (i = 0, end?: 'a' | 'b', awake = true): Enemy => {
      const sd = level!.sidings![i]!
      // the far one of two points is the end it stands at: pass the other rail end to pick it
      const from = end === 'a' ? { x: sd.bx, z: sd.bz } : end === 'b' ? { x: sd.ax, z: sd.az } : level!.rooms.find((r) => r.kind === 'entrance')!.center
      const sp = handcarSpot(sd, from)
      const pack = combat.addPack([{ kind: 'charger', variant: 'handcar', x: sp.x, z: sp.z, face: sp.face, siding: sd }], false)
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
      clearLoot()
      partFx.clear()
      clearCoreFx()
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
    /** B7: the page a Line body takes now (null: off, or none left), and the switch re-run against the live notebook, for the unmet-only rule. */
    __linePage: (role: LineRole) => linePage(role),
    __setLinePages: (on: boolean) => setLinePages(on, save.notebook),
    /** B7: the mood the frame loop last passed to updateAmbience, and a card's caption without a card. */
    __ambience: () => moodLast,
    __caption: (c: { date: string; end: EndingKind; depth: number; route?: RouteId }) => caption(c),
    /** B7: the hides, for the palette check (K-E9). */
    __hides: HIDES,
    __openNotebook: () => openNotebook(),
    __adds: () => combat.adds(),
    /** The Arbiter's state for checks (null for any other boss). */
    /** The thief, while there is one: its state, where it is, what it carries, its nest. */
    __thief: () => {
      const t = lastThief && (combat.enemies.includes(lastThief) || combat.nests.includes(lastThief) || lastThief.state === 'caught') ? lastThief : null
      return t ? { state: t.state, x: t.pos.x, z: t.pos.z, carrying: t.carrying?.id ?? null, nest: { x: t.nest.x, z: t.nest.z } } : null
    },
    __boss: () => {
      const b = combat.boss
      if (b instanceof Engine) {
        return {
          kind: 'engine', hp: b.hp, maxHp: b.maxHp, phase2: b.phase2, open: b.open, state: b.state, attack: b.attack, s: b.s, dir: b.dir, lap: b.lap,
          x: b.pos.x, z: b.pos.z, path: b.path === 'loop' ? 'loop' : `${b.path.side}-${b.path.kind}`,
          window: b.window ? { side: b.window.side, open: b.window.open, thrown: b.window.thrown, msOpen: b.window.msOpen } : null,
          wagon: b.wagon ? { x: b.wagon.x, z: b.wagon.z, settled: b.wagon.settled, stage: b.wagon.stage, spur: b.wagon.spur } : null,
          board: b.board(), guess: b.guess, frontier: b.frontier, frontierEnd: b.frontierEnd, dmgMul: b.dmgMul ?? 1,
          // C6: the aim point of the steam (frozen at its lock) or the cinder, the last steam line, and his last answers
          lead: { x: b.lead.x, z: b.lead.z }, jetSeg: b.jetSeg ? { ...b.jetSeg } : null, answers: [...b.answers],
        }
      }
      if (!(b instanceof Arbiter)) return b ? { kind: b.def.kind, hp: b.hp, phase2: b.phase2, open: b.open } : null
      return {
        kind: 'arbiter', hp: b.hp, phase2: b.phase2, open: b.open, state: b.state, wedges: [...b.wedges], omega: b.omega, aim: b.aim, guess: b.guess,
        cut: b.cut ? { x: b.cut.x, z: b.cut.z } : null, posts: b.posts.map((p) => ({ x: p.x, z: p.z, lances: p.lances, cracked: p.cracked, r: p.circles[0].r })),
      }
    },
    /** C5: the Engine's numbers (mutable for a check) and the board's words. */
    __ENGINE: ENGINE, __BOARD: BOARD, __BOSS_COPY: BOSS_COPY,
    /** C4: the Engine's own hazards (its lit track), with the clocks Combat keeps; [] with no Engine. */
    __engineSegs: () => (combat.boss instanceof Engine ? combat.boss.segments() : []),
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
    /** The run so far as the playtest body keeps it (`corePick` among it); a headless run never saves one, so this is how a check reads it. */
    __playtestBody: () => JSON.parse(JSON.stringify(playtestBody())),
    __hold: (on: boolean) => { held = on },
    /** The "tap push" switch, applied now (no pause screen, no log flag); returns whether it is on. */
    __tapPush: (on?: boolean) => {
      if (on !== undefined) hud.tapPush = on
      return hud.tapPush
    },
    /** A cooling state for checks: `ms` left on a slot's cooldown. */
    __cool: (slot: SlotName, ms: number) => hud.devCool(slot, ms),
    /** The pure answer table of a touch-down. */
    __tapAnswer: (input: Parameters<typeof tapAnswer>[0]) => tapAnswer(input),
    /** While on, frame() does not advance the HUD clock: only __step / __until move it. Returns whether it is held. */
    __clockHold: (on?: boolean) => {
      if (on !== undefined) clockHeld = on
      return clockHeld
    },
    /** B4: every body out of the level entered (its Line, terrain and breakables stay), for checks. */
    __emptyLevel: () => combat.clearBodies(),
    /** B4: every call of a stage-B sound, and of aim / rev, in order (a headless page's AudioContext never runs). */
    __heard: sfx.heardLog,
    /** B3 (R4): whether a body counts as committed for the Line's step-off, as Combat reads it. */
    __isCommitted: (e: Enemy) => Combat.committed(e, combat['held'].has(e)),
    /** The parry-catch trial's switch, applied now (grace 150 and the readying); returns whether it is on. */
    __parryCatch: (on?: boolean) => {
      if (on !== undefined) applyParryCatch(on)
      return combat.parryCatch
    },
    /** The follow-through trial's switch, applied now (bank emptied); returns whether it is on. */
    __followThrough: (on?: boolean) => {
      if (on !== undefined) applyFollowThrough(on)
      return combat.followThrough
    },
    /** The weight trial's switch, applied now (HP from the next level entered, as in play); returns whether it is on. */
    __weight: (on?: boolean) => {
      if (on !== undefined) applyWeight(on)
      return combat.weight
    },
    /** The active weight preset's id; sets it first when given (checks and screenshots only; nothing persists it). */
    __weightPreset: (id?: PresetId) => {
      if (id !== undefined) {
        if (!(id in WEIGHT_PRESETS)) throw new Error(`no weight preset ${id}`)
        setWeightPreset(id)
      }
      return weightPresetId()
    },
    /**
     * The "builds" switch applied now, as the pause switch's flip does it (but never logging `coreMixed`); returns whether it is on. With no core worn it changes
     * nothing (K-M1). Nothing persists it.
     */
    __builds: (on?: boolean) => {
      if (on !== undefined) {
        buildsOn = on
        applyBuilds()
      }
      return buildsOn
    },
    /** The archetype tables (archetypes.ts), for the checks: families, the law, the kit, the traits, and the slots a part may be worn in. */
    __archetypes: { FAMILY, LAW, KIT, TRAIT, slotsFor },
    /** Become an archetype now (or none), as the pick does: its kit worn, its autos and trait in force. Returns run.archetype. Dev only; the pick is the way in a real run. */
    __arch: (id: ArchetypeId | null) => {
      run.core = null
      applyArchetype(id)
      syncCore()
      if (id) wearKit(id)
      return run.archetype
    },
    /** The core pick, which the archetype pick replaced at the run's start (kept whole for A4's sub-styles). */
    __offerCore: () => offerCore('start'),
    /** Wear a core now (or none): forces "builds" on for the page, clears the keystone and the upgrades, and re-wears the loadout. Returns combat.core. */
    __core: (id: CoreId | null) => {
      run.core = id
      run.keystone = null
      run.upgrades = []
      buildsOn = true
      applyBuilds()
      return combat.core
    },
    /** Socket a keystone (or empty the socket) without the floor. */
    __keystone: (id: KeystoneId | null) => {
      run.keystone = id
      syncCore()
      return combat.keystone
    },
    /** Learn an upgrade without the melt. */
    __upgrade: (id: UpgradeId) => {
      if (!run.upgrades.includes(id)) run.upgrades.push(id)
      syncCore()
      return [...combat.upgrades]
    },
    /** Every body holding core marks: its index in __combat.enemies, its kind, where it stands, its count and seconds left. */
    __coreMarks: () => [...combat.statuses()].flatMap(([e, st]) => (st.marks.n > 0
      ? [{ i: combat.enemies.indexOf(e), kind: e.kind, x: e.pos.x, z: e.pos.z, n: st.marks.n, t: st.marks.t }]
      : [])),
    /** Ram's shove records since the last call (and empties them): `{ t, i, slam, other, why, link, dmg }`, `i` / `other` indices in __combat.enemies. */
    __shoveLog: () => shoveLog.splice(0),
    /** `n` marks on body `i` of __combat.enemies, by the core. Does nothing with no core worn. */
    __setMarks: (i: number, n: number) => {
      const e = combat.enemies[i]
      if (e) combat.addMarks(e, n, 'core')
    },
    /**
     * The button's number for a slot now (B5): `combat.spendCount` as main reads it for the button, and the cue painted at once (the span and the `spend3` / `spendcue` class), so a check
     * reads the number and the DOM from one call. Null: not a spender, or no core. `def`: count that def (a check's own, with its own `fits`) instead of the slot's.
     */
    __spendCount: (slot: SlotName, def?: AbilityDef) => {
      const d = def ?? hud.slots.find((x) => x.slot === slot)?.def
      const n = d ? spendNow(d) : null
      hud.spendCue(slot, n)
      return n
    },
    /** A keystone on the floor at (x, z), as a drop of the hunt would land (it flies in from just beside it). Returns the floor's keystones. */
    __dropKey: (id: KeystoneId, x: number, z: number) => {
      const g = dropKeyAt(KEYSTONES[id], new THREE.Vector3(x + 0.6, 0, z), 'dev', false, false)
      g.pos.set(x, 0, z)
      return loot.keys.length
    },
    /** A moment's drop at (x, z) through the real path (an elite's or Plenty's: the hunt, the record, the fit ring): false when nothing was left to drop. */
    __dropMoment: (source: 'kill' | 'elite' | 'plenty', x: number, z: number) => dropMoment(new THREE.Vector3(x, 0, z), 'chaser', source),
    /** The parts the thief can see on the floor (its world's `ground`): a keystone never is one. */
    __thiefGround: () => thiefWorld().ground().map((g) => g.def.id),
    /** The words (cores.ts WORDS), so a check compares a card with what the game says. */
    __words: WORDS,
    /** The core numbers, live: a check can set a number (the skim suites mute Wake's bite and trail marks to test the skim alone). */
    __cores: CORES,
    /** The keystones on the floor now, and the socket: `{ keys: [{ id, x, z, seen }], socket, held }`. */
    __keys: () => ({ keys: loot.keys.map((g) => ({ id: g.key.id, x: g.pos.x, z: g.pos.z, seen: g.seen, fly: g.fly })), socket: run.keystone, held: keyHeld ? keyHeld.key.id : null }),
    /** n draws of a moment's drop (an elite's, Plenty's, a boss's blue) through the real hunt, at a depth: `{ ids, keys, filtered, got }`. `taken`: part ids on Still or the floor; `socketed` / `onFloor`: keystones. */
    __rollMoment: (o: { source: DropSource; depth: number; n: number; from?: Archetype; taken?: string[]; socketed?: KeystoneId | null; onFloor?: KeystoneId[]; turned?: string[] }) => {
      const view = { ...poolView(save, o.depth), turned: new Set(o.turned ?? save.turned) }
      const taken = (o.taken ?? []).map((id) => byId(id))
      const out = { ids: {} as Record<string, number>, keys: {} as Record<string, number>, filtered: 0, got: 0 }
      for (let i = 0; i < o.n; i++) {
        const got = rollMoment(o.from ?? (o.source.startsWith('boss') ? 'boss' : 'chaser'), taken, o.source, view, { socketed: o.socketed ?? run.keystone, onFloor: o.onFloor ?? loot.keys.map((k) => k.key.id) })
        if (!got) continue
        out.got++
        if ('key' in got) {
          out.keys[got.key.id] = (out.keys[got.key.id] ?? 0) + 1
          out.filtered++
        } else {
          out.ids[got.def.id] = (out.ids[got.def.id] ?? 0) + 1
          if (got.filtered) out.filtered++
        }
      }
      return out
    },
    /** A part as the weight trial weighs it, at a rank: weighed(tempered(byId(id), rank)), as plain JSON. */
    __weighed: (id: string, rank = 1) => JSON.parse(JSON.stringify(weighed(tempered(byId(id), rank)))),
    /** A part at a rank as temper makes it, as plain JSON (K-M3); `flat` given: the build layer's table or not, else tempered(d, r) with no flag at all. */
    __tempered: (id: string, rank = 1, flat?: boolean) => JSON.parse(JSON.stringify(flat === undefined ? tempered(byId(id), rank) : tempered(byId(id), rank, flat))),
    /** __equip at a temper rank. */
    __equipRank: (id: string, rank: number, slot?: SlotName) => {
      const def = asWorn(byId(id), rank, slot)
      swapIn(def)
      still.wear(def.slot, def)
    },
    /** The feel's three counters, read and zeroed: the freeze and the shake pending, and the push signatures made since the last read. */
    __fx: () => {
      const out = { hitstop, shake, pushSig }
      hitstop = 0
      shake = 0
      pushSig = 0
      return out
    },
    /** Particles and debris chunks spawned since the last read, read and zeroed (K-L11: what a contact adds to a crowd). */
    __spawns: () => {
      const n = vfxSpawned.n
      vfxSpawned.n = 0
      return n
    },
    /** The core's drawn light: the sum of its colour's channels (follow-through dims it; off never moves it by itself). */
    __coreLight: () => {
      const c = (still.core.material as THREE.MeshBasicMaterial).color
      return c.r + c.g + c.b
    },
    /** B1 (R3): Parry Clamp's grace after a pressure tell, ms. Sets it if given (150 is the dial to try); returns it. */
    __parryGrace: (ms?: number) => {
      if (ms !== undefined) PARRY.graceMs = ms
      return PARRY.graceMs
    },
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
    /** C1: the roundhouse's track as numbers (track.ts), for the geometry check. */
    __makeTrack: makeTrack,
    /** C2: the level's track (the roundhouse only), or null. */
    __track: () => level?.track ?? null,
    __areaOf: (d: number, route: RouteId = 'II') => areaOf(d, route).id,
    /** The run's length (6, or 9 with ?roads=1), and the road helpers: a depth's step and road (the road takes the ORDER), and whether it's an open field. */
    __runDepths: RUN_DEPTHS,
    __stepOf: stepOf, __roadOf: roadOf, __openAt: openAt,
    /** The depth curve's row for this run's length (curve.ts). */
    __curveAt: (d: number) => curveAt(d, RUN_DEPTHS),
    /**
     * What a depth is, for the ORDER `order` (INV-O2: the road taken at the crossroads): step, road, place id, area id, its boss
     * as bossHere would make it (the Arbiter switch and the engine flag as they stand), open field or not, the beams a felled
     * boss opens (null where there is no boss), the day's span and the curve row.
     */
    __plan: (depth: number, order: RouteId = 'II') => {
      const d = Math.max(1, Math.min(RUN_DEPTHS, depth))
      const boss = bossFor(d, devArbiterAt6 ?? ARBITER_AT_6, order, flag('engine'))
      return {
        depth: d, step: stepOf(d), road: roadOf(d, order), place: lookAt(d, order, flag('engine')).id, area: areaOf(d, order).id,
        boss: boss && { kind: boss.kind, hp: boss.hp, adds: boss.adds, arena: boss.arena },
        open: openAt(d, order), exits: boss ? exitsAfterBoss(d) : null, span: { ...DAY_SPAN[d]! }, curve: curveAt(d, RUN_DEPTHS),
      }
    },
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
    /**
     * The Line as a level is generated (design/area3/SPEC.md §12.2), thrown away. `order` is the road taken at the crossroads
     * (INV-O2): the default is the one that puts the Line at this depth, III for 1-6 and II for 7-9 (they are the same level in a 6-depth run).
     */
    __genLine: (depth: number, seed: number, order: RouteId = depth >= 7 ? 'II' : 'III') => {
      const l = genFor(depth, seed, order)
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
    /**
     * The Line's dressing on the cold beam, read off its scene in world coordinates: each rail as a segment [x0, z0, x1, z1] (a box's
     * two ends along its length), and each sleeper's centre. Null when the beam wears the Works or nothing.
     */
    __yardRails: () => {
      if (!yardDressing || yardDressing.route !== 'III') return null
      const g = yardDressing.d.group
      g.updateMatrixWorld(true)
      const rails: number[][] = [], sleepers: number[][] = []
      const m = new THREE.Matrix4(), p = new THREE.Vector3()
      g.traverse((o) => {
        if (o instanceof THREE.InstancedMesh) {
          for (let i = 0; i < o.count; i++) {
            o.getMatrixAt(i, m)
            o.localToWorld(p.setFromMatrixPosition(m))
            sleepers.push([p.x, p.z])
          }
        } else if (o instanceof THREE.Mesh && o.geometry instanceof THREE.BoxGeometry && o.geometry.parameters.depth > 1) {
          const half = o.geometry.parameters.depth / 2
          const a = o.localToWorld(new THREE.Vector3(0, 0, -half)), b = o.localToWorld(new THREE.Vector3(0, 0, half))
          rails.push([a.x, a.z, b.x, b.z])
        }
      })
      return { rails, sleepers }
    },
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
        rollPart(from, taken, source, view ?? { found: new Set(PARTS.map((p) => p.id)), turned: new Set(), depth: 1 }, excludeSlot ? [excludeSlot] : []),
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
    /** n draws from one source at one depth through the real rollPart and the live pool. */
    __rollMany: (o: { source: DropSource; depth: number; n: number; from?: Archetype }) => {
      const view = poolView(save, o.depth)
      const ids: Record<string, number> = {}
      let unfound = 0, got = 0
      for (let i = 0; i < o.n; i++) {
        const def = rollPart(o.from ?? (o.source.startsWith('boss') ? 'boss' : 'chaser'), [], o.source, view)
        if (!def) continue
        got++
        ids[def.id] = (ids[def.id] ?? 0) + 1
        if (!view.found.has(def.id)) unfound++
      }
      return { ids, unfound, got }
    },
    /** A part on the floor exactly at (x, z), flying in from just beside it. `owed`: as an elite's drop (a thief wants it). */
    __dropAt: (id: string, x: number, z: number, owed = false) => {
      logDrop(floorPart(byId(id), new THREE.Vector3(x + 0.6, 0, z), undefined, owed ? {} : undefined), 'dev')
      loot.ground[loot.ground.length - 1]!.pos.set(x, 0, z)
    },
    /** The pickup card's take. */
    __take: (slot?: SlotName) => {
      const g = offered
      if (g) takePart(g, slot ?? null)
      return !!g
    },
    /** The parts on pedestals now: which set, where, and what the next take from its set costs. */
    __picks: () => loot.ground.filter((g) => g.set).map((g) => ({ id: g.def.id, kind: g.set!.kind, x: g.pos.x, z: g.pos.z, cost: pickCost(g.set!) })),
    /** C8: what a part is called on a card and a drop now (its name with its past, and its history line), whatever the run is doing. */
    __describe: (id: string) => {
      const d = PARTS.find((p) => p.id === id)
      return d ? describePart(d) : null
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
     * shortcut for checks that aren't about the beam. Beside a cold beam it answers
     * the warm light's prompt too.
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
        // beside a cold beam the light asks first: say yes
        if (atHome) confirmHome()
      } else {
        beginHoming(still.pos)
      }
      return true
    },
    __continue: () => overlay.press(),
    /** Per depth this run: fights, pushes, dead taps, quiets, strain in and out, and drops offered/taken/left. The open depth reads its strain now. */
    __runStats: statsOut,
    /** This run's drop log and its per-part counts, as the playtest entry has them. */
    __drops: () => ({ parts: partDrops(), log: run.drops.map((r) => ({ ...r })) }),
    /** Every press this run, down to up: ms, ready at the press, and what it did. */
    __taps: () => run.taps,
    /** The playtest POST now, as a depth's end would. */
    __savePlaytest: savePlaytest,
    /** Dev only: the break rule off or on for a check. No argument reads it. */
    /** The hand (permanent; this flips it for checks, not kept), and the run's log of it. */
    __hand: (on?: boolean) => {
      if (on !== undefined) setHand(on)
      const ring = handRing.mesh
      return {
        on: combat.closeHand, run: run.hand, stats: run.stats.map((st) => ({ depth: st.depth, hand: st.hand, shots: st.shots })),
        ring: { visible: ring.visible, opacity: (ring.material as THREE.MeshBasicMaterial).opacity, r: handRing.radius },
      }
    },
    /** The eye (permanent; this flips it for checks, not kept); the stance, its body, the line, and the run's log. */
    __eye: (on?: boolean) => {
      if (on !== undefined) setEye(on)
      const t = combat.eyeTarget
      return {
        on: combat.eye, run: run.eye, stance: combat.inStance, target: t ? combat.enemies.indexOf(t) : null,
        line: { visible: sightline.mesh.visible, opacity: (sightline.mesh.material as THREE.MeshBasicMaterial).opacity, len: sightline.mesh.scale.z },
        lift: still.planted, stalk: +still.parts.head.scale.y.toFixed(3),
        stats: run.stats.map((st) => ({ depth: st.depth, eye: st.eye, eyeCasts: st.eyeCasts, shots: st.shots, hand: st.hand })),
      }
    },
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
