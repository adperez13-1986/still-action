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
 */
export type AmbienceMood = 'crawl' | 'boss'

interface Engine {
  ctx: AudioContext
  out: AudioNode
  noise: AudioBuffer
  play: NonNullable<ReturnType<typeof ambienceContext>>['play']
  room: AudioNode
  draft: GainNode
  foundry: GainNode
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

function build(a: NonNullable<ReturnType<typeof ambienceContext>>): Engine {
  const { ctx, out } = a
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

  const t = ctx.currentTime
  return {
    ...a, room, draft, foundry,
    nextDrip: t + 1.5, nextClank: t + 5, nextGust: t + 2, nextSteam: t + 3,
  }
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

/** Call every frame. Starts itself once audio runs; the mood follows the level. */
export function updateAmbience(next: AmbienceMood) {
  if (!engine) {
    const a = ambienceContext()
    if (!a) return
    engine = build(a)
    window.setInterval(tick, 200)
  }
  if (next !== mood) {
    mood = next
    engine.foundry.gain.setTargetAtTime(next === 'boss' ? 1 : 0, engine.ctx.currentTime, 1.5)
  }
}
