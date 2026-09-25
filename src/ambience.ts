import { ambienceContext } from './audio'
import { beatClock } from './music'

/**
 * The dungeon's room tone, under the music. Mostly synthesis, since air and
 * stone are just filtered noise, with the recorded metal hits pitched down and
 * far away for machinery working somewhere deeper.
 *
 *   room tone   a low stone hum that slowly breathes
 *   drafts      air through the corridors, in gusts
 *   drips       water, somewhere in the stereo field, in a stone room
 *   machinery   a far clank, or a chain of them, now and then
 *   foundry     boss levels only: a hum and steam, before you see it
 *
 * The Works (depth 4) is the foundry at the end of the shift: a shorter, brighter
 * iron room, the foundry hum always under it, steam, and a forge thump on every
 * second beat of the score, so the place and the music keep one time.
 *
 * The workers' quarter (depth 5, and the walk home) is open air: a short, soft reverb,
 * wind instead of drafts, no water and no machinery, a curtain flapping in the wind
 * somewhere, and now and then something far off, a door knocking or a shutter.
 *
 * And home, the Workshop: the stone goes, and a small wooden room is left with
 * a clock ticking in it and Grace's tone under everything, never ending.
 */
/** 'square': the quarter's open air round the Arbiter, and quieter still. */
export type AmbienceMood = 'crawl' | 'boss' | 'workshop' | 'works' | 'quarter' | 'square'

interface Engine {
  ctx: AudioContext
  out: AudioNode
  noise: AudioBuffer
  play: NonNullable<ReturnType<typeof ambienceContext>>['play']
  room: AudioNode
  /** The Works' iron room: shorter and brighter than the stone one. */
  worksRoom: AudioNode
  /** The quarter's open air: short and soft. */
  airRoom: AudioNode
  /** The stone hum's filter, and the drafts' band: the quarter moves both. */
  toneLp: BiquadFilterNode
  draftBp: BiquadFilterNode
  /** The stone hum: halved in the Works, where the foundry is the room tone. */
  toneGain: GainNode
  draft: GainNode
  foundry: GainNode
  /** Everything of the maze's stone: faded out at home. */
  stone: GainNode
  /** Everything of home: the clock, Grace's tone, the wooden room. */
  home: GainNode
  wood: AudioNode
  /** Rain on the Workshop's window, at night only. */
  rainBed: GainNode
  nextDrop: number
  nextTick: number
  tickN: number
  nextDrip: number
  nextClank: number
  nextGust: number
  nextSteam: number
  /** The last beat a forge thump was scheduled on. */
  thumpBeat: number
  nextCurtain: number
  nextFar: number
}

let engine: Engine | null = null
let mood: AmbienceMood = 'crawl'

/** A small stone room: short, dark reflections, generated once. `fall` is how steeply it dies (iron: 2.2, brighter). */
function stoneRoom(ctx: AudioContext, seconds: number, fall = 3.2) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, fall) * (i < 40 ? 0 : 1)
  }
  const conv = ctx.createConvolver()
  conv.buffer = buf
  return conv
}

function loopNoise(e: { ctx: AudioContext; noise: AudioBuffer }) {
  const s = e.ctx.createBufferSource()
  s.buffer = e.noise
  s.loop = true
  s.start(e.ctx.currentTime, Math.random())
  return s
}

/** A small wooden room: shorter and brighter than stone (0.6 s, a steep fall). */
function woodRoom(ctx: AudioContext) {
  const len = Math.floor(ctx.sampleRate * 0.6)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * (i < 25 ? 0 : 1)
  }
  const conv = ctx.createConvolver()
  conv.buffer = buf
  return conv
}

function build(a: NonNullable<ReturnType<typeof ambienceContext>>): Engine {
  const { ctx } = a
  // the maze's layers all run through `stone`, so home can fade them as one
  const stone = ctx.createGain()
  stone.connect(a.out)
  const out = stone
  const room = stoneRoom(ctx, 1.6)
  const wet = ctx.createGain()
  wet.gain.value = 0.7
  room.connect(wet).connect(out)
  const worksRoom = stoneRoom(ctx, 1.1, 2.2)
  const worksWet = ctx.createGain()
  worksWet.gain.value = 0.6
  worksRoom.connect(worksWet).connect(out)
  const airRoom = stoneRoom(ctx, 0.9, 4)
  const airWet = ctx.createGain()
  airWet.gain.value = 0.5
  airRoom.connect(airWet).connect(out)

  // room tone: brownish noise through a low filter that drifts
  const tone = loopNoise(a)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 260
  lp.Q.value = 0.4
  const toneGain = ctx.createGain()
  toneGain.gain.value = 0.07
  const drift = ctx.createOscillator()
  drift.frequency.value = 0.07
  const driftDepth = ctx.createGain()
  driftDepth.gain.value = 90
  drift.connect(driftDepth).connect(lp.frequency)
  drift.start()
  tone.connect(lp).connect(toneGain).connect(out)

  // drafts: a band of noise whose level is pushed around in gusts
  const air = loopNoise(a)
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 700
  bp.Q.value = 0.6
  const draft = ctx.createGain()
  draft.gain.value = 0.015
  air.connect(bp).connect(draft).connect(out)

  // foundry, for boss levels: a low saw hum, silent until the mood says so
  const foundry = ctx.createGain()
  foundry.gain.value = 0
  foundry.connect(out)
  for (const [f, g] of [[55, 0.05], [55.6, 0.04], [110, 0.02]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const flp = ctx.createBiquadFilter()
    flp.type = 'lowpass'
    flp.frequency.value = 180
    const og = ctx.createGain()
    og.gain.value = g
    o.connect(flp).connect(og).connect(foundry)
    o.start()
  }

  // home: silent until the mood says so
  const home = ctx.createGain()
  home.gain.value = 0
  home.connect(a.out)
  const wood = woodRoom(ctx)
  const woodWet = ctx.createGain()
  woodWet.gain.value = 0.5
  wood.connect(woodWet).connect(home)
  // Grace's tone: two low sines, a fifth apart, breathing slowly by a quarter
  const breath = ctx.createGain()
  breath.gain.value = 1
  breath.connect(home)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.08
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 0.25
  lfo.connect(lfoDepth).connect(breath.gain)
  lfo.start()
  for (const f of [146.83, 220.0]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = ctx.createGain()
    g.gain.value = 0.01
    o.connect(g).connect(breath)
    o.start()
  }

  // rain: a band of noise on the glass, silent until the night asks for it
  const rainBed = ctx.createGain()
  rainBed.gain.value = 0
  rainBed.connect(home)
  const rainNoise = loopNoise(a)
  const rhp = ctx.createBiquadFilter()
  rhp.type = 'highpass'
  rhp.frequency.value = 400
  const rlp = ctx.createBiquadFilter()
  rlp.type = 'lowpass'
  rlp.frequency.value = 3500
  const rg = ctx.createGain()
  rg.gain.value = 0.012
  rainNoise.connect(rhp).connect(rlp).connect(rg).connect(rainBed)

  const t = ctx.currentTime
  return {
    ...a, out: stone, room, worksRoom, airRoom, toneLp: lp, draftBp: bp, toneGain, draft, foundry, stone, home, wood, rainBed, nextDrop: t, nextTick: t + 1, tickN: 0,
    nextDrip: t + 1.5, nextClank: t + 5, nextGust: t + 2, nextSteam: t + 3, thumpBeat: -1, nextCurtain: t + 6, nextFar: t + 10,
  }
}

/** One tick of the clock, scheduled at `when`: bandpassed noise, 12 ms, the two sides of the escapement. */
function clockTick(e: Engine, when: number) {
  const { ctx } = e
  const s = ctx.createBufferSource()
  s.buffer = e.noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = e.tickN % 2 ? 1700 : 2200
  bp.Q.value = 6
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  // a narrow band keeps about a sixth of white noise's level: this lands the tick near 0.018
  g.gain.linearRampToValueAtTime(0.018 * 6, when + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.012)
  const pan = ctx.createStereoPanner()
  pan.pan.value = -0.3
  s.connect(bp).connect(g).connect(pan)
  pan.connect(e.home)
  pan.connect(e.wood)
  s.start(when, Math.random() * 0.5)
  s.stop(when + 0.03)
  e.tickN++
}

/** The reverb the mood is in: the Works' iron room, or the stone one. */
const roomOf = (e: Engine) => (mood === 'works' ? e.worksRoom : mood === 'quarter' || mood === 'square' ? e.airRoom : e.room)

function drip(e: Engine) {
  const { ctx } = e
  const t = ctx.currentTime
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.6 - 0.8
  pan.connect(roomOf(e))
  const g = ctx.createGain()
  g.connect(pan)
  const dry = ctx.createGain()
  dry.gain.value = 0.35
  g.connect(dry).connect(e.out)
  const o = ctx.createOscillator()
  o.type = 'sine'
  const f = 1100 + Math.random() * 900
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.05)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.045, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  o.connect(g)
  o.start(t)
  o.stop(t + 0.15)
}

/** Something big, working, a long way off: recorded metal, slowed, muffled, mostly echo. */
function clank(e: Engine) {
  const { ctx } = e
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 520
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.4 - 0.7
  lp.connect(pan)
  pan.connect(roomOf(e))
  const dry = ctx.createGain()
  dry.gain.value = 0.25
  pan.connect(dry).connect(e.out)
  const n = Math.random() < 0.4 ? 2 + Math.floor(Math.random() * 2) : 1
  for (let i = 0; i < n; i++) {
    setTimeout(() => e.play(i % 2 ? 'plateHeavy' : 'metalHeavy', lp, 0.22 - i * 0.04, 0.42 + Math.random() * 0.1), i * (380 + Math.random() * 300))
  }
}

function gust(e: Engine) {
  const t = e.ctx.currentTime
  // the quarter's wind blows harder than a corridor's draft
  const peak = mood === 'quarter' ? 0.05 + Math.random() * 0.04 : 0.03 + Math.random() * 0.05
  const len = 2 + Math.random() * 3
  e.draft.gain.cancelScheduledValues(t)
  e.draft.gain.setTargetAtTime(peak, t, len * 0.3)
  e.draft.gain.setTargetAtTime(0.012, t + len * 0.6, len * 0.4)
}

function steam(e: Engine) {
  const { ctx } = e
  const t = ctx.currentTime
  const s = ctx.createBufferSource()
  s.buffer = e.noise
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 2500
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.05, t + 0.15)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.2 - 0.6
  s.connect(hp).connect(g).connect(pan).connect(roomOf(e))
  s.start(t, Math.random() * 0.4)
  s.stop(t + 1.5)
}

/** A curtain flapping in a draft through an empty window: a band of noise, beaten slowly, for a few seconds. */
function curtain(e: Engine) {
  const { ctx } = e
  const t = ctx.currentTime
  const len = 2 + Math.random() * 2
  const s = ctx.createBufferSource()
  s.buffer = e.noise
  s.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1400
  bp.Q.value = 1.2
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.02, t + 0.4)
  g.gain.setValueAtTime(0.02, t + len - 0.6)
  g.gain.linearRampToValueAtTime(0.0001, t + len)
  // the flap: the level beaten at 0.4-0.9 Hz
  const flap = ctx.createGain()
  flap.gain.value = 0.5
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.4 + Math.random() * 0.5
  const depth = ctx.createGain()
  depth.gain.value = 0.5
  lfo.connect(depth).connect(flap.gain)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.4 - 0.7
  s.connect(bp).connect(flap).connect(g).connect(pan)
  pan.connect(e.out)
  pan.connect(e.airRoom)
  s.start(t, Math.random())
  lfo.start(t)
  s.stop(t + len + 0.05)
  lfo.stop(t + len + 0.05)
}

/** Something far off in the quarter: a door knocking in the wind, or a shutter creaking. */
function farOff(e: Engine) {
  const { ctx } = e
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.4 - 0.7
  lp.connect(pan)
  pan.connect(e.airRoom)
  const dry = ctx.createGain()
  dry.gain.value = 0.4
  pan.connect(dry).connect(e.out)
  if (Math.random() < 0.5) {
    lp.frequency.value = 600
    e.play('woodHeavy', lp, 0.12, 0.55)
    e.play('woodHeavy', lp, 0.1, 0.55, 0.35)
  } else {
    lp.frequency.value = 900
    e.play('plank', lp, 0.08, 0.4)
  }
}

/** The forge, somewhere past the walls, at `when`: a low sine falling, and a plate struck far off, mostly echo. */
function thump(e: Engine, when: number) {
  const { ctx } = e
  const o = ctx.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(55, when)
  o.frequency.exponentialRampToValueAtTime(38, when + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(0.1, when + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.36)
  o.connect(g).connect(e.out)
  o.start(when)
  o.stop(when + 0.4)
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 400
  lp.connect(e.worksRoom)
  e.play('plateHeavy', lp, 0.12, 0.45, Math.max(0, when - ctx.currentTime))
}

/** Every second beat of the score, a little ahead on the audio clock, never twice on one beat. */
function forge(e: Engine) {
  const clock = beatClock()
  if (!clock) return
  const now = e.ctx.currentTime
  for (let k = -1; k <= 1; k++) {
    const beat = clock.beat + k
    const at = clock.next + k * clock.len
    if (beat <= e.thumpBeat || beat % 2 !== 1 || at < now + 0.01 || at > now + 0.35) continue
    thump(e, at)
    e.thumpBeat = beat
  }
}

function tick() {
  const e = engine
  if (!e) return
  const t = e.ctx.currentTime
  if (mood === 'workshop') {
    // the clock is scheduled ahead on the audio clock, so a slow frame never makes it limp
    while (e.nextTick < t + 0.3) {
      if (e.nextTick >= t) clockTick(e, e.nextTick)
      e.nextTick += 1
    }
    // and the drops on the glass, when it rains
    while (raining && e.nextDrop < t + 0.3) {
      if (e.nextDrop >= t) droplet(e, e.nextDrop)
      e.nextDrop += 0.05 + Math.random() * 0.25
    }
    if (!raining) e.nextDrop = t
    return
  }
  e.nextTick = t + 1
  const boss = mood === 'boss'
  const works = mood === 'works'
  const air = mood === 'quarter' || mood === 'square'
  if (works) forge(e)
  if (air) {
    // open air: no water, no machinery; wind, a curtain, and something far off
    if (t >= e.nextCurtain) {
      curtain(e)
      e.nextCurtain = t + 8 + Math.random() * 8
    }
    if (t >= e.nextFar) {
      farOff(e)
      // round the Arbiter, something far off is rarer: the square is listening
      e.nextFar = t + (mood === 'square' ? 30 + Math.random() * 30 : 16 + Math.random() * 18)
    }
  } else if (t >= e.nextDrip) {
    drip(e)
    // the Works is dry: a drip now and then, far fewer than the stone
    e.nextDrip = t + (works ? 6 + Math.random() * 12 : 1.8 + Math.random() * 5)
  }
  if (!air && t >= e.nextClank) {
    clank(e)
    e.nextClank = t + (boss ? 5 : 9) + Math.random() * (boss ? 6 : 14)
  }
  if (t >= e.nextGust) {
    gust(e)
    e.nextGust = t + 6 + Math.random() * 8
  }
  if ((boss || works) && t >= e.nextSteam) {
    steam(e)
    e.nextSteam = t + 3 + Math.random() * 5
  }
}

let raining = false

/** One drop on the window: a tiny bright tick, somewhere across the glass. */
function droplet(e: Engine, when: number) {
  const { ctx } = e
  const s = ctx.createBufferSource()
  s.buffer = e.noise
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 2500 + Math.random() * 3000
  bp.Q.value = 4
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, when)
  g.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.03, when + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.02)
  const pan = ctx.createStereoPanner()
  pan.pan.value = -0.6 + Math.random() * 0.5
  s.connect(bp).connect(g).connect(pan).connect(e.rainBed)
  s.start(when, Math.random() * 0.5)
  s.stop(when + 0.04)
}

/** Rain on the Workshop's window: the night's trace. */
export function setRain(on: boolean) {
  raining = on
  if (engine) engine.rainBed.gain.setTargetAtTime(on ? 1 : 0, engine.ctx.currentTime, on ? 1.2 : 0.4)
}

/** Call every frame. Starts itself once audio runs; the mood follows the level. */
export function updateAmbience(next: AmbienceMood) {
  if (!engine) {
    const a = ambienceContext()
    if (!a) return
    engine = build(a)
    engine.rainBed.gain.value = raining ? 1 : 0
    window.setInterval(tick, 200)
  }
  if (next !== mood) {
    mood = next
    const t = engine.ctx.currentTime
    // the Works hums with the foundry at 0.6, over half the stone's tone
    engine.foundry.gain.setTargetAtTime(next === 'boss' ? 1 : next === 'works' ? 0.6 : 0, t, 1.5)
    const open = next === 'quarter' || next === 'square'
    engine.toneGain.gain.setTargetAtTime(next === 'works' || open ? 0.035 : 0.07, t, 1.5)
    // the quarter: the hum lower, and the drafts a wider, lower wind
    engine.toneLp.frequency.setTargetAtTime(open ? 180 : 260, t, 1.5)
    engine.draftBp.frequency.setTargetAtTime(open ? 450 : 700, t, 1.5)
    engine.draftBp.Q.setTargetAtTime(open ? 0.4 : 0.6, t, 1.5)
    // home: the stone fades out over about 1.2 s, and the room comes up under it
    const home = next === 'workshop'
    engine.stone.gain.setTargetAtTime(home ? 0 : 1, t, 0.4)
    engine.home.gain.setTargetAtTime(home ? 1 : 0, t, home ? 0.4 : 0.25)
  }
}
