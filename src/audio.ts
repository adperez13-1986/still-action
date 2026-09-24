import type { AbilityShape, Tier } from './abilities'

/**
 * Every sound is synthesised. No files to source, no load latency, and each one
 * can be retuned in code as fast as a grade value. Swap a voice for a recorded
 * file only if synthesis can't be made to feel right.
 */
export const mix = {
  master: 0.8,
  auto: 0.35,
  hits: 0.8,
  enemy: 0.7,
  abilities: 0.8,
  music: 0.45,
}

type Bus = 'auto' | 'hits' | 'enemy' | 'abilities' | 'music'
const BUSES: Bus[] = ['auto', 'hits', 'enemy', 'abilities', 'music']

let ctx: AudioContext | null = null
let master!: GainNode
/** Everything but the hurt sound runs through here, so getting hit can punch a hole in the mix. */
let duck!: GainNode
let noise!: AudioBuffer
let crush!: Float32Array<ArrayBuffer>
const buses = {} as Record<Bus, GainNode>
let muted = false
let lastHit = 0

function ensure(): AudioContext | null {
  if (ctx) return ctx
  if (!window.AudioContext) return null
  ctx = new AudioContext({ latencyHint: 'interactive' })

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 10
  comp.ratio.value = 5
  comp.attack.value = 0.002
  comp.release.value = 0.12
  comp.connect(ctx.destination)

  master = ctx.createGain()
  master.connect(comp)
  duck = ctx.createGain()
  duck.connect(master)
  for (const b of BUSES) {
    buses[b] = ctx.createGain()
    buses[b].connect(duck)
  }

  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1

  crush = new Float32Array(1024)
  for (let i = 0; i < crush.length; i++) {
    const x = (i / (crush.length - 1)) * 2 - 1
    crush[i] = (7 * x) / (1 + 6 * Math.abs(x))
  }

  applyMix()
  return ctx
}

/** Android only lets audio start from a real gesture; keep trying until one counts. */
export function unlockAudio() {
  const unlock = () => {
    const c = ensure()
    if (c && c.state !== 'running') void c.resume()
  }
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) {
    window.addEventListener(ev, unlock, { capture: true, passive: true })
  }

  // The game loop stops with the screen, but an AudioContext doesn't: the drone
  // would hum on in your pocket. Suspend with the page, resume when it's back.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) void ctx.suspend()
    else void ctx.resume()
  })
}

export function applyMix() {
  if (!ctx) return
  master.gain.value = muted ? 0 : mix.master
  for (const b of BUSES) buses[b].gain.value = mix[b]
}

export function setMuted(m: boolean) {
  muted = m
  applyMix()
}

// --- building blocks ---

function live(): AudioContext | null {
  return ctx && ctx.state === 'running' ? ctx : null
}

function vary(v: number, amount: number) {
  return v * (1 + (Math.random() * 2 - 1) * amount)
}

function out(c: AudioContext, bus: Bus, pan = 0): AudioNode {
  const p = c.createStereoPanner()
  p.pan.value = Math.max(-1, Math.min(1, pan))
  p.connect(buses[bus])
  return p
}

function env(g: GainNode, t: number, peak: number, attack: number, decay: number) {
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone(
  c: AudioContext, dest: AudioNode, type: OscillatorType,
  t: number, f0: number, f1: number, dur: number, peak: number, attack = 0.003,
) {
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = c.createGain()
  env(g, t, peak, attack, dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + attack + dur + 0.02)
}

function hiss(
  c: AudioContext, dest: AudioNode, t: number, dur: number, peak: number,
  type: BiquadFilterType, f0: number, f1: number, q = 1, attack = 0.002,
) {
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = q
  f.frequency.setValueAtTime(f0, t)
  f.frequency.exponentialRampToValueAtTime(f1, t + dur)
  const g = c.createGain()
  env(g, t, peak, attack, dur)
  s.connect(f).connect(g).connect(dest)
  s.start(t, Math.random() * 0.5)
  s.stop(t + attack + dur + 0.02)
}

function distorted(c: AudioContext, dest: AudioNode): AudioNode {
  const w = c.createWaveShaper()
  w.curve = crush
  w.connect(dest)
  return w
}

// --- voices ---

/** The auto attack. It fires every 0.62s forever, so it must stay out of the way. */
export function shot(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'auto', pan)
  const r = vary(1, 0.06)
  tone(c, d, 'triangle', t, 1500 * r, 650 * r, 0.045, 0.5)
  hiss(c, d, t, 0.025, 0.25, 'highpass', 5000, 5000, 0.7)
}

export function hit(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  // a nova landing on four enemies is one impact, not four stacked ones
  if (t - lastHit < 0.022) return
  lastHit = t
  const d = out(c, 'hits', pan)
  const r = vary(1, 0.08)
  tone(c, d, 'sine', t, 200 * r, 50 * r, 0.11, 0.9, 0.002)
  hiss(c, d, t, 0.05, 0.55, 'bandpass', 2200 * r, 900 * r, 1.2)
  tone(c, d, 'square', t, 95 * r, 60 * r, 0.04, 0.12)
}

export function kill(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 140, 32, 0.32, 1)
  hiss(c, d, t, 0.28, 0.8, 'lowpass', 3800, 300, 0.8)
  // debris: two detuned bits of scrap ringing out just after the crunch
  tone(c, d, 'triangle', t + 0.03, vary(640, 0.1), vary(600, 0.1), 0.4, 0.14)
  tone(c, d, 'triangle', t + 0.05, vary(955, 0.1), vary(900, 0.1), 0.32, 0.1)
}

export function hurt() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  // bypasses the duck, so it's the one thing still loud while everything else dips
  const g = c.createGain()
  g.gain.value = mix.hits
  g.connect(master)
  tone(c, distorted(c, g), 'sine', t, 95, 38, 0.28, 0.9, 0.002)
  hiss(c, g, t, 0.22, 0.8, 'lowpass', 900, 200, 0.7)

  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(0.35, t)
  duck.gain.linearRampToValueAtTime(1, t + 0.2)
}

/**
 * The telegraph, heard. Rises in pitch and flutters faster as the disc fills, and
 * cuts dead at the strike, so you can dodge a chaser you aren't looking at.
 * Returns a stop for when the enemy dies mid-windup.
 */
export function windup(ms: number, pan: number): () => void {
  const c = live()
  if (!c) return () => {}
  const t = c.currentTime
  const dur = ms / 1000
  const d = out(c, 'enemy', pan)

  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(150, t)
  o.frequency.exponentialRampToValueAtTime(440, t + dur)

  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.Q.value = 6
  f.frequency.setValueAtTime(350, t)
  f.frequency.exponentialRampToValueAtTime(2600, t + dur)

  const flutter = c.createGain()
  flutter.gain.value = 0.55
  const lfo = c.createOscillator()
  lfo.frequency.setValueAtTime(7, t)
  lfo.frequency.exponentialRampToValueAtTime(24, t + dur)
  const depth = c.createGain()
  depth.gain.value = 0.45
  lfo.connect(depth).connect(flutter.gain)

  const g = c.createGain()
  g.gain.setValueAtTime(0.03, t)
  g.gain.exponentialRampToValueAtTime(0.35, t + dur)
  g.gain.setValueAtTime(0.35, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.025)

  o.connect(f).connect(flutter).connect(g).connect(d)
  o.start(t)
  lfo.start(t)
  o.stop(t + dur + 0.05)
  lfo.stop(t + dur + 0.05)

  return () => {
    const now = c.currentTime
    if (now >= t + dur) return
    g.gain.cancelScheduledValues(now)
    g.gain.setTargetAtTime(0.0001, now, 0.012)
    o.stop(now + 0.08)
    lfo.stop(now + 0.08)
  }
}

export function strike(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  hiss(c, d, t, 0.12, 0.9, 'bandpass', 900, 300, 0.9)
  tone(c, d, 'sine', t, 110, 45, 0.15, 0.8)
}

/**
 * The ranged tell. Thinner and higher than the chaser's so the two never blur:
 * a whistle that climbs while it tracks you, and a hard click when the line
 * freezes — the moment to move. Returns a stop, like windup().
 */
export function aim(ms: number, lockAt: number, pan: number): () => void {
  const c = live()
  if (!c) return () => {}
  const t = c.currentTime
  const dur = ms / 1000
  const lock = t + dur * lockAt
  const d = out(c, 'enemy', pan)

  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(700, t)
  o.frequency.exponentialRampToValueAtTime(1250, lock)
  // locked: the pitch jumps and holds, like the line freezing
  o.frequency.setValueAtTime(1500, lock)

  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.1, lock)
  g.gain.setValueAtTime(0.2, lock)
  g.gain.setValueAtTime(0.2, t + dur)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02)
  o.connect(g).connect(d)
  o.start(t)
  o.stop(t + dur + 0.05)

  const click = c.createGain()
  click.connect(d)
  hiss(c, click, lock, 0.018, 0.9, 'highpass', 3500, 3500, 0.8, 0.001)
  tone(c, click, 'square', lock, 2400, 1800, 0.02, 0.25, 0.001)

  return () => {
    const now = c.currentTime
    if (now >= t + dur) return
    g.gain.cancelScheduledValues(now)
    g.gain.setTargetAtTime(0.0001, now, 0.01)
    o.stop(now + 0.06)
    // a click that hasn't happened yet must not happen
    if (now < lock) click.gain.value = 0
  }
}

export function fire(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  tone(c, d, 'square', t, 520, 140, 0.12, 0.3)
  hiss(c, d, t, 0.08, 0.4, 'bandpass', 2600, 700, 1.5)
}

export function blocked(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 240, 90, 0.08, 0.4)
  hiss(c, d, t, 0.06, 0.35, 'bandpass', 1400, 600, 1)
}

/** A crate or barrel giving way: dry wood, a rattle of what was in it. */
export function smash(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  hiss(c, d, t, 0.16, 0.8, 'bandpass', 1600, 500, 1.4)
  tone(c, d, 'square', t, 160, 70, 0.08, 0.2)
  for (let i = 0; i < 3; i++) tone(c, d, 'triangle', t + 0.04 + i * 0.03, vary(700, 0.3), vary(500, 0.3), 0.08, 0.06)
}

/** Repair scrap taken: a soft rising two-note, green like the HP meter. */
export function repair() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  tone(c, d, 'sine', t, 523, 522, 0.2, 0.16, 0.01)
  tone(c, d, 'sine', t + 0.08, 784, 783, 0.3, 0.14, 0.01)
}

/** A shrine taken up on: low, hollow, and long. */
export function shrine() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  for (const [i, f] of [196, 294, 392].entries()) tone(c, d, 'sine', t + i * 0.12, f, f, 1.6, 0.14, 0.05)
  hiss(c, d, t, 1.2, 0.12, 'bandpass', 900, 400, 3, 0.2)
}

/** The boss going down: a long collapse of metal, then a low bell. */
export function bossDown() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', 0)
  tone(c, distorted(c, d), 'sine', t, 110, 24, 1.2, 1, 0.004)
  hiss(c, d, t, 1.4, 0.9, 'lowpass', 5000, 160, 0.7)
  for (let i = 0; i < 7; i++) tone(c, d, 'triangle', t + 0.1 + i * 0.13, vary(500 + i * 90, 0.2), vary(420, 0.2), 0.5, 0.08)
  tone(c, out(c, 'abilities', 0), 'sine', t + 1.2, 196, 195, 2.4, 0.18, 0.02)
}

/** It overloads: a rising roar, everything else ducking under it. */
export function roar() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', 0)
  tone(c, distorted(c, d), 'sawtooth', t, 70, 160, 0.9, 0.6, 0.1)
  hiss(c, d, t, 0.9, 0.5, 'bandpass', 300, 1400, 1.5, 0.1)
}

/** The charge meets a wall: a big clang, and the grill swings open. */
export function clang(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 160, 60, 0.3, 0.9)
  for (const f of [620, 930, 1390]) tone(c, d, 'triangle', t, f, f * 0.98, 0.9, 0.12)
  hiss(c, d, t, 0.2, 0.6, 'bandpass', 2500, 900, 1)
}

/** A pack noticing you: two sharp rising notes, so you know you've pulled them even off screen. */
export function alert(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  tone(c, d, 'sawtooth', t, 330, 360, 0.09, 0.22, 0.004)
  tone(c, d, 'sawtooth', t + 0.09, 494, 540, 0.14, 0.26, 0.004)
  hiss(c, d, t, 0.06, 0.2, 'bandpass', 2400, 1800, 2)
}

/** Pushing should sound like it costs something: the body grinding against itself. */
function grind(c: AudioContext, d: AudioNode, t: number) {
  const f = c.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 320
  f.Q.value = 3
  f.connect(d)
  const w = distorted(c, f)
  tone(c, w, 'square', t, 52, 46, 0.34, 0.5, 0.01)
  tone(c, w, 'square', t, 55, 49, 0.34, 0.5, 0.01)
  tone(c, d, 'sine', t + 0.04, 190, 118, 0.26, 0.2, 0.02)
}

export function ability(shape: AbilityShape, pushed: boolean) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  const r = pushed ? 0.8 : 1
  const k = pushed ? 1.3 : 1

  switch (shape) {
    case 'bolt':
      tone(c, d, 'sawtooth', t, 600 * r, 2600 * r, 0.06, 0.35 * k)
      tone(c, d, 'sine', t + 0.05, 2400 * r, 260 * r, 0.2, 0.5 * k)
      hiss(c, d, t, 0.12, 0.3 * k, 'highpass', 3000, 6000, 0.7)
      break
    case 'nova':
      tone(c, d, 'sine', t, 120 * r, 38 * r, 0.42, 1 * k)
      hiss(c, d, t, 0.5, 0.7 * k, 'lowpass', 5000 * r, 250, 0.7, 0.004)
      break
    case 'arc':
      hiss(c, d, t, 0.15, 0.9 * k, 'bandpass', 500 * r, 3800 * r, 2.2, 0.01)
      tone(c, d, 'triangle', t + 0.08, vary(420 * r, 0.05), 380 * r, 0.18, 0.12 * k)
      break
    case 'dash': {
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 900
      lp.connect(d)
      tone(c, lp, 'sawtooth', t, 65 * r, 190 * r, 0.2, 0.6 * k, 0.01)
      hiss(c, d, t, 0.22, 0.6 * k, 'bandpass', 400, 2400, 1.4, 0.02)
      break
    }
  }

  if (pushed) grind(c, d, t)
}

/**
 * A part hitting the floor. The tier is audible before you read it, the way D2's
 * drops were: white a dull clink, blue a bright two-note ping, gold a long shimmer.
 */
export function drop(tier: Tier, pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime + 0.4 // lands at the end of the hop, not when it leaves the body
  const d = out(c, 'abilities', pan)
  tone(c, d, 'triangle', t, 900, 820, 0.08, 0.25)
  hiss(c, d, t, 0.03, 0.2, 'highpass', 4000, 4000, 0.7)
  if (tier === 'blue') {
    tone(c, d, 'sine', t + 0.02, 1318, 1316, 0.45, 0.2, 0.004)
    tone(c, d, 'sine', t + 0.12, 1976, 1974, 0.6, 0.16, 0.004)
  }
  if (tier === 'gold') {
    for (const [i, f] of [587, 740, 880, 1175, 1480].entries()) {
      tone(c, d, 'triangle', t + i * 0.07, f, f, 1.4, 0.13, 0.004)
      tone(c, d, 'sine', t + i * 0.07 + 0.01, f * 2, f * 2, 0.8, 0.04, 0.004)
    }
    hiss(c, d, t, 1.2, 0.08, 'highpass', 7000, 9000, 0.5, 0.2)
  }
}

/** Taking a part: a mechanical seat-and-click, the body accepting it. */
export function take() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  tone(c, d, 'square', t, 180, 120, 0.05, 0.18, 0.002)
  hiss(c, d, t + 0.05, 0.03, 0.4, 'bandpass', 3200, 2600, 2)
  tone(c, d, 'triangle', t + 0.09, 660, 990, 0.12, 0.2, 0.004)
}

/** A fight cleared: the one warm sound in the game, and short. */
export function cleared() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  tone(c, d, 'triangle', t, 392, 390, 0.5, 0.22, 0.02)
  tone(c, d, 'triangle', t + 0.14, 587, 585, 0.7, 0.2, 0.02)
  tone(c, d, 'sine', t + 0.14, 1174, 1170, 0.5, 0.05, 0.02)
}

/** HP ending. Sudden: one crash, then nothing. */
export function shatter() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const g = c.createGain()
  g.gain.value = mix.hits
  g.connect(master)
  tone(c, distorted(c, g), 'sine', t, 130, 30, 0.5, 1, 0.002)
  hiss(c, g, t, 0.45, 1, 'lowpass', 6000, 250, 0.7)
  for (const f of [520, 780, 1130, 1490]) tone(c, g, 'triangle', t + Math.random() * 0.06, vary(f, 0.08), f * 0.9, 0.5, 0.1)

  // everything else is cut, not faded
  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(0, t)
}

/**
 * Strain ending. Still running down: a motor losing pitch over the whole stop,
 * so the sound and the slowdown finish together.
 */
export function windDown(seconds: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  // bypasses the duck: this is the one sound left while the world goes quiet
  const d = c.createGain()
  d.gain.value = mix.abilities
  d.connect(master)

  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(1600, t)
  lp.frequency.exponentialRampToValueAtTime(90, t + seconds)
  lp.connect(d)

  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(180, t)
  o.frequency.exponentialRampToValueAtTime(18, t + seconds)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.28, t + 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
  o.connect(g).connect(lp)
  o.start(t)
  o.stop(t + seconds + 0.05)

  // the rest of the world goes quiet along with him
  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(1, t)
  duck.gain.linearRampToValueAtTime(0.0001, t + seconds)
}

/** A new run: undo whatever an ending did to the mix. */
export function restore(fadeSeconds = 0) {
  if (!ctx) return
  const t = ctx.currentTime
  duck.gain.cancelScheduledValues(t)
  if (fadeSeconds <= 0) {
    duck.gain.setValueAtTime(1, t)
  } else {
    duck.gain.setValueAtTime(Math.max(0.0001, duck.gain.value), t)
    duck.gain.exponentialRampToValueAtTime(1, t + fadeSeconds)
  }
}

/** Paused: everything drops back, the music keeps breathing underneath. */
export function pauseDuck(on: boolean) {
  if (!ctx) return
  const t = ctx.currentTime
  duck.gain.cancelScheduledValues(t)
  duck.gain.setTargetAtTime(on ? 0.3 : 1, t, 0.12)
}

/** For the music: the running context, and its bus. Null until audio is unlocked. */
export function musicContext(): { ctx: AudioContext; out: AudioNode } | null {
  const c = live()
  return c ? { ctx: c, out: buses.music } : null
}
