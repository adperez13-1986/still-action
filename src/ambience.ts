import { ambienceContext } from './audio'

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
 * And home, the Workshop: the stone goes, and a small wooden room is left with
 * a clock ticking in it and Grace's tone under everything, never ending.
 */
export type AmbienceMood = 'crawl' | 'boss' | 'workshop'

interface Engine {
  ctx: AudioContext
  out: AudioNode
  noise: AudioBuffer
  play: NonNullable<ReturnType<typeof ambienceContext>>['play']
  room: AudioNode
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
}

let engine: Engine | null = null
let mood: AmbienceMood = 'crawl'

/** A small stone room: short, dark reflections, generated once. */
function stoneRoom(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2) * (i < 40 ? 0 : 1)
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
    ...a, out: stone, room, draft, foundry, stone, home, wood, rainBed, nextDrop: t, nextTick: t + 1, tickN: 0,
    nextDrip: t + 1.5, nextClank: t + 5, nextGust: t + 2, nextSteam: t + 3,
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

function drip(e: Engine) {
  const { ctx } = e
  const t = ctx.currentTime
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.6 - 0.8
  pan.connect(e.room)
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
  pan.connect(e.room)
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
  const peak = 0.03 + Math.random() * 0.05
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
  s.connect(hp).connect(g).connect(pan).connect(e.room)
  s.start(t, Math.random() * 0.4)
  s.stop(t + 1.5)
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
  if (t >= e.nextDrip) {
    drip(e)
    e.nextDrip = t + 1.8 + Math.random() * 5
  }
  if (t >= e.nextClank) {
    clank(e)
    e.nextClank = t + (boss ? 5 : 9) + Math.random() * (boss ? 6 : 14)
  }
  if (t >= e.nextGust) {
    gust(e)
    e.nextGust = t + 6 + Math.random() * 8
  }
  if (boss && t >= e.nextSteam) {
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
    engine.foundry.gain.setTargetAtTime(next === 'boss' ? 1 : 0, t, 1.5)
    // home: the stone fades out over about 1.2 s, and the room comes up under it
    const home = next === 'workshop'
    engine.stone.gain.setTargetAtTime(home ? 0 : 1, t, 0.4)
    engine.home.gain.setTargetAtTime(home ? 1 : 0, t, home ? 0.4 : 0.25)
  }
}
