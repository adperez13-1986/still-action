import type { BeatKey, Tier } from './abilities'

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
  ambience: 0.6,
}

type Bus = 'auto' | 'hits' | 'enemy' | 'abilities' | 'music' | 'ambience'
const BUSES: Bus[] = ['auto', 'hits', 'enemy', 'abilities', 'music', 'ambience']

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
  void loadSamples(ctx)
  return ctx
}

// --- recorded layers (Kenney, CC0) ---
// Synthesis keeps the weight and the exact timing; the recordings add texture:
// metal that sounds like metal, stone like stone, wood like wood.

const SAMPLE_FILES: Record<string, [string, number]> = {
  metalLight: ['impactMetal_light', 4],
  metalMedium: ['impactMetal_medium', 4],
  metalHeavy: ['impactMetal_heavy', 4],
  plateHeavy: ['impactPlate_heavy', 3],
  punchHeavy: ['impactPunch_heavy', 3],
  softHeavy: ['impactSoft_heavy', 3],
  softMedium: ['impactSoft_medium', 3],
  mining: ['impactMining', 3],
  woodHeavy: ['impactWood_heavy', 3],
  plank: ['impactPlank_medium', 3],
  generic: ['impactGeneric_light', 3],
  bell: ['impactBell_heavy', 2],
  tin: ['impactTin_medium', 4],
  step: ['footstep_concrete', 5],
  woodStep: ['footstep_wood', 5],
}
export type SampleName = keyof typeof SAMPLE_FILES
const samples = new Map<string, AudioBuffer[]>()
/** Every recorded layer sits a touch under the synthesis. */
const SAMPLE_GAIN = 0.85

async function loadSamples(c: AudioContext) {
  await Promise.all(Object.entries(SAMPLE_FILES).map(async ([name, [file, n]]) => {
    const list: AudioBuffer[] = []
    for (let i = 0; i < n; i++) {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}sfx/${file}_${i}.ogg`)
        list.push(await c.decodeAudioData(await res.arrayBuffer()))
      } catch {
        // a missing file just means one fewer variation
      }
    }
    samples.set(name, list)
  }))
}

/**
 * One recorded hit: a random variation, a little pitch drift so repeats never
 * sound identical. `rate` below 1 is heavier, above 1 lighter.
 */
function sample(c: AudioContext, name: SampleName, dest: AudioNode, gain: number, rate = 1, when = 0) {
  const list = samples.get(name)
  if (!list || list.length === 0) return
  const src = c.createBufferSource()
  src.buffer = list[Math.floor(Math.random() * list.length)]!
  src.playbackRate.value = rate * vary(1, 0.06)
  const g = c.createGain()
  g.gain.value = gain * SAMPLE_GAIN
  src.connect(g).connect(dest)
  src.start(c.currentTime + when)
}

/** What a foot lands on. The Workshop's floor is wood; the maze is stone; the Works is plate. */
export type FootSurface = 'stone' | 'wood' | 'plate'

/** Footsteps. Who's walking sets the weight; distance sets how loud. */
export function step(who: 'still' | 'hulk' | 'tripod' | 'ram' | 'boss' | 'thief', pan: number, loudness = 1, surface: FootSurface = 'stone') {
  const c = live()
  if (!c || loudness <= 0.02) return
  const d = out(c, who === 'still' ? 'auto' : 'enemy', pan)
  switch (who) {
    case 'still':
      if (surface === 'wood') {
        // home: a hollow board under him, and the thin metal of his foot on it
        if (samples.get('woodStep')?.length) sample(c, 'woodStep', d, 0.5 * loudness, 1.3)
        else sample(c, 'plank', d, 0.3 * loudness, 1.8)
        sample(c, 'plank', d, 0.05 * loudness, 1.6)
        sample(c, 'tin', d, 0.05 * loudness, 2.2)
        break
      }
      if (surface === 'plate') {
        // iron on iron: a lighter, brighter step, and the plate ringing under it
        sample(c, 'step', d, 0.45 * loudness, 1.25)
        sample(c, 'metalLight', d, 0.16 * loudness, 1.5)
        sample(c, 'tin', d, 0.07 * loudness, 2.2)
        break
      }
      // light and a little metallic: a thin machine on stone
      sample(c, 'step', d, 0.55 * loudness, 1.35)
      sample(c, 'tin', d, 0.07 * loudness, 2.2)
      break
    case 'hulk':
      sample(c, 'step', d, 0.8 * loudness, 0.62)
      sample(c, 'softMedium', d, 0.5 * loudness, 0.7)
      break
    case 'tripod':
      sample(c, 'tin', d, 0.35 * loudness, 1.6)
      break
    case 'ram':
      // lighter than the hulk, and shod: a clink of iron under each hoof
      sample(c, 'step', d, 0.7 * loudness, 0.8)
      sample(c, 'metalLight', d, 0.12 * loudness, 0.7)
      break
    case 'boss':
      sample(c, 'softHeavy', d, 0.9 * loudness, 0.55)
      sample(c, 'metalHeavy', d, 0.2 * loudness, 0.5)
      break
    case 'thief':
      // thiefStep: four thin feet, a quick high tick; a scuttle is one sound, not four
      if (limited('thiefStep', 0.07, c.currentTime)) return
      sample(c, 'tin', d, 0.12 * loudness, 2.4)
      break
  }
  // theirs ring on plate too, and knock on boards, at half his layer
  if (who !== 'still' && surface === 'plate') sample(c, 'metalLight', d, 0.08 * loudness, 1.5)
  if (who !== 'still' && surface === 'wood') sample(c, 'plank', d, 0.15 * loudness, 1.1)
}

// --- the Lobber: a mortar tilting, the shell's whistle, its landing ---

/** The crucible tilting back to aim: a creak, and a sine rising over the windup. Cut when it's broken. */
export function lobAim(ms: number, pan: number, gain = 1): (hard?: boolean) => void {
  const c = live()
  if (!c) return () => {}
  const t = c.currentTime
  const g = c.createGain()
  g.gain.value = gain
  g.connect(out(c, 'enemy', pan))
  sample(c, 'plank', g, 0.4, 0.7)
  tone(c, g, 'sine', t, 200, 320, ms / 1000, 0.05, 0.02)
  return gate(g, c, t + ms / 1000 + 0.05)
}

/** The launch: a soft heavy thud and a low drop. */
export function mortar(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  sample(c, 'softHeavy', d, 0.6, 0.6)
  tone(c, d, 'sine', c.currentTime, 90, 40, 0.2, 0.3)
}

/** The shell in the air: a thin falling whistle, the whole flight long. */
export function whistle(ms: number, pan: number) {
  const c = live()
  if (!c) return
  tone(c, out(c, 'enemy', pan), 'sine', c.currentTime, 1400, 700, ms / 1000, 0.03, 0.05)
}

/** It lands: broken stone, and the strike's body under it. */
export function shellLand(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  sample(c, 'mining', d, 0.7, 0.8)
  tone(c, d, 'sine', c.currentTime, 110, 45, 0.25, 0.35)
  hiss(c, d, c.currentTime, 0.2, 0.12, 'lowpass', 1800, 500)
}

// --- slag: a core spilling where its body fell, and the puddle catching ---

/** A wet glop: the core breaks open on the floor. */
export function slagSpill(pan: number) {
  const c = live()
  if (!c || limited('slagSpill', 0.05, c.currentTime)) return
  const d = out(c, 'enemy', pan)
  sample(c, 'softMedium', d, 0.55, 0.7)
  tone(c, d, 'sine', c.currentTime, 120, 70, 0.18, 0.12)
}

/** The puddle arms: a hiss rising as it catches. */
export function slagArm(pan: number) {
  const c = live()
  if (!c || limited('slagArm', 0.05, c.currentTime)) return
  const d = out(c, 'enemy', pan)
  hiss(c, d, c.currentTime, 0.25, 0.22, 'bandpass', 1200, 3000, 1.4, 0.02)
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

const clampPan = (p: number) => Math.max(-1, Math.min(1, p))

function out(c: AudioContext, bus: Bus, pan = 0): AudioNode {
  const p = c.createStereoPanner()
  p.pan.value = clampPan(pan)
  p.connect(buses[bus])
  return p
}

/** At most one call per `gapS` for a name: a crowd of the same small sound becomes one. */
const lastAt = new Map<string, number>()
function limited(name: string, gapS: number, t: number) {
  const l = lastAt.get(name) ?? -Infinity
  if (t - l < gapS) return true
  lastAt.set(name, t)
  return false
}

/** A panner the caller keeps and moves: a voice that follows its source. */
function livePan(c: AudioContext, bus: Bus, pan: number) {
  const p = c.createStereoPanner()
  p.pan.value = clampPan(pan)
  p.connect(buses[bus])
  return p
}

/**
 * A voice that can be cut and can follow its source. `stop(true)` cuts it dead
 * (a broken windup: the silence is part of the parry); otherwise it fades.
 */
export interface Voice {
  stop: (hard?: boolean) => void
  pan: (p: number) => void
  /** The cheap Doppler at a rush's closest pass. */
  dip?: () => void
  /** A surge lost a biter: its jaw drops out of the flam. */
  lose?: () => void
}
/** An old stop-only voice, as a Voice. */
export const asVoice = (stop: (hard?: boolean) => void): Voice => ({ stop, pan: () => {} })

/** The stop for everything routed through `g`, until the voice would have ended anyway. */
function gate(g: GainNode, c: AudioContext, until: number) {
  return (hard = false) => {
    const now = c.currentTime
    if (now >= until) return
    g.gain.cancelScheduledValues(now)
    if (hard) g.gain.setValueAtTime(0, now)
    else g.gain.setTargetAtTime(0.0001, now, 0.01)
  }
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
  sample(c, 'metalLight', d, 0.18, 1.8)
  hiss(c, d, t, 0.025, 0.25, 'highpass', 5000, 5000, 0.7)
}

/** `gain` scales the whole hit: a plate soaks some of it. */
export function hit(pan: number, gain = 1) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  // a nova landing on four enemies is one impact, not four stacked ones
  if (t - lastHit < 0.022) return
  lastHit = t
  const d = out(c, 'hits', pan)
  const r = vary(1, 0.08)
  tone(c, d, 'sine', t, 200 * r, 50 * r, 0.11, 0.9 * gain, 0.002)
  // the recording carries the crack now; the synth noise steps back
  hiss(c, d, t, 0.05, 0.25 * gain, 'bandpass', 2200 * r, 900 * r, 1.2)
  sample(c, 'metalMedium', d, 0.8 * gain, 0.9)
  tone(c, d, 'square', t, 95 * r, 60 * r, 0.04, 0.12 * gain)
}

export function kill(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 140, 32, 0.32, 1)
  hiss(c, d, t, 0.28, 0.45, 'lowpass', 3800, 300, 0.8)
  sample(c, 'metalHeavy', d, 0.9, 0.8)
  sample(c, 'plateHeavy', d, 0.5, 0.75, 0.03)
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
  hiss(c, g, t, 0.22, 0.5, 'lowpass', 900, 200, 0.7)
  sample(c, 'punchHeavy', g, 0.9, 0.85)
  sample(c, 'metalMedium', g, 0.4, 1.3)

  duck.gain.cancelScheduledValues(t)
  duck.gain.setValueAtTime(0.35, t)
  duck.gain.linearRampToValueAtTime(1, t + 0.2)
}

/**
 * The hulk's tell, heard: a crank being wound, ratchet clicks speeding up toward
 * the slam over a low swell of pressure. Ends exactly at the strike, so you can
 * dodge a hulk you aren't looking at. Returns a stop for when it dies mid-windup.
 */
export function windup(ms: number, pan: number, gain = 1): (hard?: boolean) => void {
  const c = live()
  if (!c) return () => {}
  const t = c.currentTime
  const dur = ms / 1000
  // everything goes through one gain, so a stop silences clicks already scheduled
  const g = c.createGain()
  g.gain.value = gain
  g.connect(out(c, 'enemy', pan))

  // the pressure: low noise opening up as the blow loads
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 3
  lp.frequency.setValueAtTime(160, t)
  lp.frequency.exponentialRampToValueAtTime(900, t + dur)
  const swell = c.createGain()
  swell.gain.setValueAtTime(0.0001, t)
  swell.gain.exponentialRampToValueAtTime(0.3, t + dur)
  swell.gain.setValueAtTime(0.3, t + dur)
  swell.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03)
  s.connect(lp).connect(swell).connect(g)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.05)

  // the ratchet: clicks from ~9 a second to ~30, each a hard little tick
  let at = 0
  while (at < dur - 0.015) {
    const k = at / dur
    const f = 1500 + k * 1600
    tone(c, g, 'square', t + at, f, f * 0.6, 0.012, 0.1 + k * 0.12, 0.0008)
    hiss(c, g, t + at, 0.01, 0.12 + k * 0.1, 'bandpass', 3200, 2800, 3, 0.0008)
    at += 0.11 - k * 0.077
  }

  return (hard = false) => {
    const now = c.currentTime
    if (now >= t + dur) return
    g.gain.cancelScheduledValues(now)
    // a broken windup is cut dead, not faded: the silence is part of the parry
    if (hard) g.gain.setValueAtTime(0, now)
    else g.gain.setTargetAtTime(0.0001, now, 0.01)
  }
}

export function strike(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  hiss(c, d, t, 0.12, 0.5, 'bandpass', 900, 300, 0.9)
  tone(c, d, 'sine', t, 110, 45, 0.15, 0.8)
  // fists into stone: a heavy thud and the crack of the floor
  sample(c, 'softHeavy', d, 1, 0.7)
  sample(c, 'mining', d, 0.55, 0.8, 0.02)
}

/**
 * The tripod's tell: a soft servo whir climbing while it tracks you, then a crisp
 * recorded clack when the line freezes — the moment to move — and a short, quiet
 * capacitor whine up to the shot. Returns a stop, like windup().
 */
export function aim(ms: number, lockAt: number, pan: number, gain = 1): (hard?: boolean) => void {
  const c = live()
  if (!c) return () => {}
  const t = c.currentTime
  const dur = ms / 1000
  const lock = t + dur * lockAt
  const g = c.createGain()
  g.gain.value = gain
  const d = out(c, 'enemy', pan)
  g.connect(d)

  // servo: narrow band of noise sweeping up, with a slight motor wobble
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 9
  bp.frequency.setValueAtTime(600, t)
  bp.frequency.exponentialRampToValueAtTime(1500, lock)
  const whir = c.createGain()
  whir.gain.setValueAtTime(0.0001, t)
  whir.gain.linearRampToValueAtTime(0.5, t + 0.08)
  whir.gain.setValueAtTime(0.5, lock - 0.01)
  whir.gain.linearRampToValueAtTime(0.0001, lock + 0.02)
  s.connect(bp).connect(whir).connect(g)
  s.start(t, Math.random() * 0.5)
  s.stop(lock + 0.05)

  // the clack: the aim is set
  const clack = c.createGain()
  clack.connect(g)
  const wait = Math.max(0, lock - t)
  sample(c, 'metalLight', clack, 0.9, 2.4, wait)
  tone(c, clack, 'square', lock, 1900, 1200, 0.018, 0.14, 0.0008)

  // capacitor: a quiet, rising charge from the lock to the shot
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(1800, lock)
  o.frequency.exponentialRampToValueAtTime(3600, t + dur)
  const cap = c.createGain()
  cap.gain.setValueAtTime(0.0001, lock)
  cap.gain.exponentialRampToValueAtTime(0.06, t + dur)
  cap.gain.setValueAtTime(0.06, t + dur)
  cap.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02)
  o.connect(cap).connect(g)
  o.start(lock)
  o.stop(t + dur + 0.05)

  return (hard = false) => {
    const now = c.currentTime
    if (now >= t + dur) return
    g.gain.cancelScheduledValues(now)
    // a broken windup is cut dead, not faded: the silence is part of the parry
    if (hard) g.gain.setValueAtTime(0, now)
    else g.gain.setTargetAtTime(0.0001, now, 0.01)
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
  sample(c, 'generic', d, 0.6, 0.9)
  tone(c, d, 'sine', t, 240, 90, 0.08, 0.4)
  hiss(c, d, t, 0.06, 0.35, 'bandpass', 1400, 600, 1)
}

/** A crate or barrel giving way: dry wood, a rattle of what was in it. */
export function smash(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  sample(c, 'woodHeavy', d, 0.9, 1)
  sample(c, 'plank', d, 0.5, 1.1, 0.04)
  hiss(c, d, t, 0.16, 0.35, 'bandpass', 1600, 500, 1.4)
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
  hiss(c, d, t, 1.4, 0.6, 'lowpass', 5000, 160, 0.7)
  for (const [i, when] of [0, 0.12, 0.3, 0.55].entries()) sample(c, i % 2 ? 'plateHeavy' : 'metalHeavy', d, 0.9 - i * 0.15, 0.6 + i * 0.1, when)
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
  sample(c, 'bell', d, 1, 0.7)
  for (const f of [620, 930, 1390]) tone(c, d, 'triangle', t, f, f * 0.98, 0.9, 0.06)
  hiss(c, d, t, 0.2, 0.6, 'bandpass', 2500, 900, 1)
}

// --- the ram ---

/**
 * The ram's tell, heard: an engine revving up to the lock, a ratchet tick per seam
 * segment as its spine fills, two hoof scrapes, a heavy latch at the lock (the
 * moment the lane stops following you), then a valve hissing open toward the rush.
 * You can read a ram you aren't looking at.
 */
export function rev(ms: number, lockAt: number, pan: number, gain = 1): Voice {
  const c = live()
  if (!c) return asVoice(() => {})
  const t = c.currentTime
  const dur = ms / 1000
  const lock = t + dur * lockAt
  const p = livePan(c, 'enemy', pan)
  // everything goes through one gain, so a stop silences what's already scheduled
  const g = c.createGain()
  g.gain.value = gain
  g.connect(p)

  // the engine: a distorted saw climbing an octave to the lock, then held
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(55, t)
  o.frequency.exponentialRampToValueAtTime(110, lock)
  o.frequency.setValueAtTime(110, lock)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.Q.value = 4
  lp.frequency.setValueAtTime(250, t)
  lp.frequency.exponentialRampToValueAtTime(1100, lock)
  lp.frequency.setValueAtTime(1100, lock)
  const eg = c.createGain()
  eg.gain.setValueAtTime(0.0001, t)
  eg.gain.linearRampToValueAtTime(0.2, lock)
  eg.gain.setValueAtTime(0.2, t + dur)
  eg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03)
  // locked, it shudders: a 14 Hz tremolo on the held note
  const lfo = c.createOscillator()
  lfo.frequency.value = 14
  const depth = c.createGain()
  depth.gain.value = 0.08
  lfo.connect(depth).connect(eg.gain)
  lfo.start(lock)
  lfo.stop(t + dur)
  o.connect(distorted(c, lp))
  lp.connect(eg).connect(g)
  o.start(t)
  o.stop(t + dur + 0.05)

  // the ratchet: one tick per seam segment
  for (let i = 0; i < 5; i++) {
    const f = 900 + 120 * i
    tone(c, g, 'square', t + (i + 1) * 0.099, f, f * 0.6, 0.014, 0.12, 0.0008)
  }
  // the hoof pawing at 80 and 300 ms
  for (const at of [0.08, 0.3]) {
    hiss(c, g, t + at, 0.09, 0.25, 'bandpass', 1600, 500, 1.2)
    sample(c, 'step', g, 0.4, 0.55, at)
  }
  // the latch: the lane is set
  tone(c, g, 'square', lock, 700, 380, 0.03, 0.2, 0.0008)
  tone(c, g, 'sine', lock, 110, 70, 0.08, 0.5)
  sample(c, 'metalHeavy', g, 0.7, 1.25, lock - t)
  // the valve: a hiss opening from the lock to the rush
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.setValueAtTime(3000, lock)
  hp.frequency.exponentialRampToValueAtTime(6000, t + dur)
  const vg = c.createGain()
  vg.gain.setValueAtTime(0.0001, t)
  vg.gain.setValueAtTime(0.02, lock)
  vg.gain.linearRampToValueAtTime(0.12, t + dur)
  vg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02)
  s.connect(hp).connect(vg).connect(g)
  s.start(lock, Math.random() * 0.5)
  s.stop(t + dur + 0.04)

  return { stop: gate(g, c, t + dur), pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.03) }
}

/** The rush: a roar falling away and a run of hooves, panned live as it crosses the screen. */
export function rush(pan: number): Voice {
  const c = live()
  if (!c) return asVoice(() => {})
  const t = c.currentTime
  const p = livePan(c, 'enemy', pan)
  const g = c.createGain()
  g.connect(p)
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(110, t)
  o.frequency.exponentialRampToValueAtTime(55, t + 0.55)
  const eg = c.createGain()
  env(eg, t, 0.5, 0.003, 0.55)
  o.connect(distorted(c, eg))
  eg.connect(g)
  o.start(t)
  o.stop(t + 0.6)
  hiss(c, g, t, 0.5, 0.45, 'bandpass', 500, 1400, 1)
  sample(c, 'softHeavy', g, 0.8, 0.8)
  for (let i = 0; i < 6; i++) sample(c, 'step', g, 0.5 * 0.85 ** i, 0.6, i * 0.07)
  return {
    stop: (hard) => {
      const now = c.currentTime
      g.gain.cancelScheduledValues(now)
      if (hard) g.gain.setValueAtTime(0, now)
      else g.gain.setTargetAtTime(0.0001, now, 0.02)
    },
    pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.02),
    dip: () => {
      const now = c.currentTime
      o.frequency.cancelScheduledValues(now)
      o.frequency.setTargetAtTime(o.frequency.value * 0.85, now, 0.03)
    },
  }
}

/** A ram's face into a wall: stone and iron, and a bell of the boiler ringing (not when it's caught on the clamp). */
export function ramCrash(pan: number, bell = true) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 130, 38, 0.35, 1)
  hiss(c, d, t, 0.35, 0.6, 'lowpass', 4500, 250, 0.8)
  sample(c, 'metalHeavy', d, 1, 0.75)
  sample(c, 'mining', d, 0.7, 0.7, 0.01)
  if (bell) sample(c, 'bell', d, 0.55, 1.35)
}

/**
 * The stun: struck iron ringing, wobbling as it's dazed, and the hatch slamming
 * shut when the window closes. Cut hard if it dies inside it.
 */
export function dazed(ms: number, pan: number): Voice {
  const c = live()
  if (!c) return asVoice(() => {})
  const t = c.currentTime
  const dur = ms / 1000
  const p = livePan(c, 'enemy', pan)
  const g = c.createGain()
  g.connect(p)
  // the wobble: a 5 Hz swing on everything that rings
  const wob = c.createGain()
  wob.gain.value = 1
  const lfo = c.createOscillator()
  lfo.frequency.value = 5
  const depth = c.createGain()
  depth.gain.value = 0.5
  lfo.connect(depth).connect(wob.gain)
  lfo.start(t)
  lfo.stop(t + dur)
  wob.connect(g)
  const ring = c.createGain()
  ring.gain.setValueAtTime(0.0001, t)
  ring.gain.linearRampToValueAtTime(1, t + 0.003)
  ring.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  ring.connect(wob)
  for (const f of [1040, 1560, 2330]) {
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = vary(f, 0.01)
    const og = c.createGain()
    og.gain.value = 0.05
    o.connect(og).connect(ring)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
  // the hatch slams: the window is shut
  tone(c, g, 'square', t + dur, 1200, 700, 0.015, 0.2)
  sample(c, 'metalMedium', g, 0.5, 1.4, dur)
  return { stop: gate(g, c, t + dur + 0.05), pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.03) }
}

/** A hit into an open hatch rings: the core struck. Layered on hit(). Louder on a Plated ram, whose plates are up too. */
export function hitOpen(pan: number, gain = 1) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 1320, 1300, 0.25, 0.08 * gain)
  sample(c, 'bell', d, 0.3 * gain, 2.0)
}

/** A hit on shut plate: dull, the blocked-shot layer. Layered on a quieter hit(). */
export function plateDull(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'generic', out(c, 'hits', pan), 0.4, 0.9)
}

/** An open rush skidding to a stop: iron grinding stone. */
export function skid(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  hiss(c, d, t, 0.4, 0.35, 'bandpass', 2800, 700, 2)
  tone(c, distorted(c, d), 'square', t, 180, 90, 0.2, 0.08)
  sample(c, 'mining', d, 0.25, 1.3)
}

/** A rush shouldering a body aside: one clank, however many it tramples at once. */
export function trample(pan: number) {
  const c = live()
  if (!c || limited('trample', 0.08, c.currentTime)) return
  sample(c, 'metalMedium', out(c, 'enemy', pan), 0.4, 1.1)
}

/** A ram's last breath, over kill(): steam escaping, a dying whistle, the plates falling. A sigh, not a buzzer. */
export function ramDeath(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  hiss(c, d, t, 0.6, 0.2, 'highpass', 2500, 1200, 0.7)
  tone(c, d, 'sine', t, 1800, 600, 0.5, 0.05)
  sample(c, 'plateHeavy', d, 0.6, 0.6, 0.05)
}

/** A Many ram cracking along its seam as it comes apart. */
export function ramSplit(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'metalHeavy', out(c, 'hits', pan), 0.7, 1.1)
}

// --- the swarm: the only enemy above 3 kHz, clicks and air ---

/** One tick of a brood's rustle; the scheduler in main paces them. */
export function skitterTick(pan: number, loud: number) {
  const c = live()
  if (!c || loud <= 0.02) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  if (Math.random() < 1 / 3) sample(c, 'tin', d, 0.05 * loud, vary(3.0, 0.15))
  else {
    const f = vary(3400, 0.08)
    tone(c, d, 'square', t, f, 2200, 0.006, 0.04 * loud, 0.0005)
    hiss(c, d, t, 0.008, 0.03 * loud, 'highpass', 6000, 6000, 0.7)
  }
}

/**
 * The surge's one windup: a rising chirp at the lock, a kettle hiss, and mandible
 * clicks tightening to the bite, each click flammed once per biter. A four-jaw
 * surge sounds thicker than a one-jaw one; lose() drops a jaw.
 */
export function chitter(ms: number, biters: number, pan: number, gain = 1): Voice {
  const c = live()
  if (!c) return asVoice(() => {})
  const t = c.currentTime
  const dur = ms / 1000
  const g = c.createGain()
  g.gain.value = gain
  g.connect(out(c, 'enemy', pan))
  // the onset is its lock: rising, where the sentinel's clack falls and the ram's latch is low
  tone(c, g, 'square', t, 2600, 3400, 0.03, 0.18, 0.0008)
  sample(c, 'tin', g, 0.4, 2.4)
  const s = c.createBufferSource()
  s.buffer = noise
  s.loop = true
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 6
  bp.frequency.setValueAtTime(1800, t)
  bp.frequency.exponentialRampToValueAtTime(4800, t + dur)
  const rise = c.createGain()
  rise.gain.setValueAtTime(0.04, t)
  rise.gain.linearRampToValueAtTime(0.22, t + dur)
  rise.gain.setValueAtTime(0.0001, t + dur)
  s.connect(bp).connect(rise).connect(g)
  s.start(t, Math.random() * 0.5)
  s.stop(t + dur + 0.02)
  const flam = [0, 1, 2, 3].map((k) => {
    const fg = c.createGain()
    fg.gain.value = k < biters ? 1 : 0
    fg.connect(g)
    return fg
  })
  let at = 0
  while (at < dur - 0.01) {
    for (let k = 0; k < 4; k++) tone(c, flam[k]!, 'square', t + at + k * 0.004, 4200, 3000, 0.005, 0.07, 0.0005)
    // 70 ms tightening to 22 ms: the hulk ratchet's shape, an octave up
    at += 0.07 - 0.048 * (at / dur)
  }
  let n = biters
  return {
    stop: gate(g, c, t + dur),
    pan: () => {},
    lose: () => {
      if (n <= 0) return
      n--
      flam[n]!.gain.setValueAtTime(0, c.currentTime)
    },
  }
}

/** The 550 tick: n jaws, flammed 7 ms apart. On air, a dry hiss and the landing patter; on him, hurt() says it. */
export function snap(biters: number, hit: boolean, pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  for (let k = 0; k < biters; k++) {
    tone(c, d, 'square', t + k * 0.007, 3000, 1100, 0.02, 0.18)
    hiss(c, d, t + k * 0.007, 0.015, 0.2, 'bandpass', 3500, 3500, 3)
  }
  sample(c, 'tin', d, 0.3, 1.6)
  if (!hit) {
    hiss(c, d, t, 0.06, 0.12, 'highpass', 5000, 5000, 0.7)
    sample(c, 'softMedium', d, 0.2, 1.8, 0.15)
  }
}

let lastPop = -1
let clusterUntil = -1
const popTimes: number[] = []
/** A mite dying: a small bright pop, not kill(). Pops keep 35 ms apart; a third inside 120 ms becomes one cluster. */
export function pop(pan: number, queen = false) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  while (popTimes.length && t - popTimes[0]! > 0.12) popTimes.shift()
  popTimes.push(t)
  if (t < clusterUntil) return
  if (popTimes.length >= 3) {
    popCluster(popTimes.length, pan)
    clusterUntil = t + 0.12
    return
  }
  if (t - lastPop < 0.035) return
  lastPop = t
  // the queen: an octave down, and a plate
  const d = out(c, 'hits', pan)
  const o = queen ? 0.5 : 1
  tone(c, d, 'triangle', t, vary(1500, 0.1) * o, 700 * o, 0.06, 0.2)
  tone(c, d, 'sine', t, 260 * o, 110 * o, 0.07, 0.35)
  sample(c, 'tin', d, 0.3, vary(1.8, 0.1) * o)
  if (queen) sample(c, 'plateHeavy', d, 0.3, 1.4)
}

/** A Vent through a brood: one crunch, with a scatter of tin in it. */
function popCluster(n: number, pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  tone(c, d, 'sine', t, 180, 60, 0.15, 0.5)
  for (let i = 0; i < Math.min(n, 5); i++) sample(c, 'tin', d, 0.18, 1.6 + Math.random() * 0.8, Math.random() * 0.1)
  sample(c, 'metalMedium', d, 0.5, 1.5)
}

/** The last mite of a brood: clicks slowing and falling, an exhale, one small clear tone. The mind gone quiet; not cleared(). */
export function broodEnd(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  let at = 0
  for (let i = 0; i < 6; i++) {
    at += 0.022 + 0.0136 * i
    const f = 3400 - 400 * i
    tone(c, d, 'square', t + at, f, f * 0.7, 0.008, 0.12 - 0.016 * i, 0.0005)
  }
  hiss(c, d, t + 0.05, 0.5, 0.08, 'bandpass', 3000, 900, 1)
  tone(c, d, 'sine', t + 0.35, 660, 655, 0.25, 0.05, 0.01)
}

/** One seal breaking as a Warden falls: a small tin tick, each member a little later than the last. */
export function sealTick(pan: number, delay: number) {
  const c = live()
  if (!c) return
  sample(c, 'tin', out(c, 'enemy', pan), 0.15, 2.0, delay)
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

/** A lowpass in front of `d`, for voices that should sit low and body-heavy. */
function lowpass(c: AudioContext, d: AudioNode, hz: number): AudioNode {
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = hz
  f.connect(d)
  return f
}

/**
 * A part's voice, keyed by its beat. The ported parts borrow their shape's voice
 * until they get their own; a beat with no voice yet is silent apart from the
 * push grind. `power` is 0..1 where a beat scales (Patient Lens's charge).
 */
export function ability(beat: BeatKey, pushed: boolean, power = 0) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  const r = pushed ? 0.8 : 1
  const k = pushed ? 1.3 : 1

  switch (beat) {
    case 'through':
      // the bolt voice stretched low: the biggest thing the head does
      tone(c, d, 'sawtooth', t, 300 * r, 3200 * r, 0.1, 0.4 * k)
      tone(c, d, 'sine', t + 0.06, 3200 * r, 120 * r, 0.4, 0.5 * k)
      hiss(c, d, t, 0.2, 0.35 * k, 'highpass', 3000, 7000, 0.7)
      break
    case 'lens':
    case 'cracked':
    case 'ricochet':
      tone(c, d, 'sawtooth', t, 600 * r, 2600 * r, 0.06, 0.35 * k)
      tone(c, d, 'sine', t + 0.05, 2400 * r, 260 * r, 0.2, 0.5 * k)
      hiss(c, d, t, 0.12, 0.3 * k, 'highpass', 3000, 6000, 0.7)
      break
    case 'patient': {
      // the bolt voice, its tail stretched by the charge and dropped a third at full
      const full = power >= 0.99
      tone(c, d, 'sawtooth', t, 600 * r, 2600 * r, 0.06, (0.2 + 0.15 * power) * k)
      tone(c, d, 'sine', t + 0.05, 2400 * r, (full ? 175 : 260) * r, 0.2 + 0.15 * power, (0.3 + 0.2 * power) * k)
      hiss(c, d, t, 0.12, (0.15 + 0.15 * power) * k, 'highpass', 3000, 6000, 0.7)
      if (full) sample(c, 'metalMedium', d, 0.5, 1.2)
      break
    }
    case 'coil': {
      // three thin bolt voices a hair apart, and a little of the push grind every time
      for (let i = 0; i < 3; i++) {
        const at = t + i * 0.012
        tone(c, d, 'sawtooth', at, vary(900, 0.04) * r, 3000 * r, 0.04, 0.16 * k)
        tone(c, d, 'sine', at + 0.02, 2800 * r, 400 * r, 0.12, 0.18 * k)
      }
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 320
      bp.Q.value = 3
      bp.connect(d)
      tone(c, distorted(c, bp), 'square', t, 110, 98, 0.18, 0.15, 0.01)
      break
    }
    case 'signal':
    case 'flare':
      // a hollow thoop that rises, because it goes up. No whistle in flight: windup tones must stay clear.
      tone(c, d, 'sine', t, 380 * r, 620 * r, 0.09, 0.45 * k)
      hiss(c, d, t, 0.12, 0.35 * k, 'bandpass', 1200, 600, 1.5)
      break
    case 'vent':
    case 'backdraft':
      tone(c, d, 'sine', t, 120 * r, 38 * r, 0.42, 1 * k)
      hiss(c, d, t, 0.5, 0.7 * k, 'lowpass', 5000 * r, 250, 0.7, 0.004)
      break
    case 'chill': {
      // a softer nova, icy air, and a frost tinkle
      tone(c, d, 'sine', t, 120 * r, 60 * r, 0.4, 0.6 * k)
      hiss(c, d, t, 0.6, 0.4 * k, 'highpass', 6000, 2500, 0.7, 0.01)
      for (let i = 0; i < 6; i++) {
        const f = Math.random() < 0.5 ? 2349 : 3136
        tone(c, d, 'triangle', t + 0.05 + i * 0.05, f, f, 0.04, 0.05)
      }
      break
    }
    case 'parry':
      // a small plain snip; a cancel adds its own clang
      tone(c, d, 'square', t, 1600 * r, 900 * r, 0.03, 0.18 * k, 0.001)
      sample(c, 'metalLight', d, 0.5, 2.0)
      break
    case 'toss':
      // the bite, then a long whoosh as it goes
      sample(c, 'metalMedium', d, 0.5, 1.3)
      tone(c, d, 'square', t, 200 * r, 140 * r, 0.04, 0.2 * k, 0.001)
      hiss(c, d, t + 0.1, 0.25, 0.5 * k, 'bandpass', 400, 2000, 1.2, 0.02)
      break
    case 'ward':
      // a glassy close, with a shimmer over it
      tone(c, d, 'triangle', t, 880 * r, 660 * r, 0.1, 0.35 * k)
      tone(c, d, 'sine', t, 1320 * r, 1320 * r, 0.3, 0.1 * k)
      hiss(c, d, t, 0.2, 0.25 * k, 'bandpass', 5000, 3000, 3)
      break
    case 'mirror':
      // the shell rises instead of closing
      tone(c, d, 'triangle', t, 1320 * r, 1760 * r, 0.08, 0.3 * k)
      tone(c, d, 'sine', t, 2640 * r, 2640 * r, 0.25, 0.08 * k)
      break
    case 'brace':
      // setting his weight: a low plate and a short breath
      tone(c, lowpass(c, d, 600), 'square', t, 90 * r, 70 * r, 0.12, 0.5 * k, 0.005)
      sample(c, 'plateHeavy', d, 0.6, 0.9)
      hiss(c, d, t, 0.1, 0.3 * k, 'bandpass', 900, 500, 1.2)
      tone(c, d, 'sine', t, 110 * r, 40 * r, 0.3, 0.6 * k)
      break
    case 'anvil':
      // the clamp raised: a light clink and a faint ring-in
      sample(c, 'metalLight', d, 0.3, 0.8)
      tone(c, d, 'triangle', t, 440, 440, 0.3, 0.05)
      break
    case 'cleaver':
    case 'fray-90':
    case 'fray-180':
    case 'fray-360':
      hiss(c, d, t, 0.15, 0.9 * k, 'bandpass', 500 * r, 3800 * r, beat === 'cleaver' || beat === 'fray-90' ? 2.2 : 1.2, 0.01)
      tone(c, d, 'triangle', t + 0.08, vary(420 * r, 0.05), 380 * r, 0.18, 0.12 * k)
      // the tear grows with the strain feeding the swing: you hear it in the blade
      if (beat === 'fray-180' || beat === 'fray-360') sample(c, 'tin', d, 0.3, 0.9)
      if (beat === 'fray-360' && !pushed) smallGrind(c, d, t, 0.5)
      break
    case 'piston':
      // the whoosh only; the thunk or the pneumatic miss follows once it's known which
      hiss(c, d, t, 0.06, 0.7 * k, 'bandpass', 800 * r, 2400 * r, 2, 0.004)
      break
    case 'hook': {
      hiss(c, d, t, 0.12, 0.7 * k, 'bandpass', 700 * r, 3000 * r, 3, 0.006)
      for (let i = 0; i < 3; i++) sample(c, 'tin', d, 0.3, 1.2 + Math.random() * 0.3, 0.1 + i * 0.03)
      // the yank rises: it's coming toward you
      tone(c, lowpass(c, d, 700), 'sawtooth', t + 0.16, 90 * r, 180 * r, 0.1, 0.4 * k, 0.01)
      break
    }
    case 'kick':
    case 'skid':
      tone(c, lowpass(c, d, 900), 'sawtooth', t, 65 * r, 190 * r, 0.2, 0.6 * k, 0.01)
      hiss(c, d, t, 0.22, 0.6 * k, 'bandpass', 400, 2400, 1.4, 0.02)
      break
    case 'frost':
      // the dash voice with icy air for its hiss, and ice forming behind him
      tone(c, lowpass(c, d, 900), 'sawtooth', t, 65 * r, 190 * r, 0.2, 0.6 * k, 0.01)
      hiss(c, d, t, 0.22, 0.4 * k, 'highpass', 5000, 3000, 0.7, 0.02)
      for (let i = 0; i < 6; i++) {
        const f = 2000 + Math.random() * 1500
        tone(c, d, 'triangle', t + 0.05 + i * 0.025, f, f, 0.03, 0.04)
      }
      break
    case 'plant':
      // the bob let go: a heavy clink and a soft pluck
      sample(c, 'metalMedium', d, 0.6, 0.7)
      tone(c, d, 'sine', t, 220, 220, 0.4, 0.1)
      break
    case 'snap':
      // the dash voice turned around: pulled back, not pushing off
      tone(c, lowpass(c, d, 900), 'sawtooth', t, 190 * r, 65 * r, 0.2, 0.6 * k, 0.01)
      hiss(c, d, t, 0.2, 0.5 * k, 'bandpass', 2400, 400, 1.4, 0.01)
      break
    case 'rewind': {
      // a reverse swell against a falling hiss, and a grind every time: it always costs strain
      tone(c, d, 'sine', t, 80 * r, 400 * r, 0.25, 0.5 * k, 0.02)
      hiss(c, d, t, 0.25, 0.4 * k, 'bandpass', 3000, 500, 1.5, 0.01)
      if (!pushed) grind(c, d, t)
      break
    }
    case 'lure':
      // two of him: a doubled voice, a slow beat between them
      tone(c, d, 'sine', t, 660 * r, 660 * r, 0.4, 0.12 * k, 0.02)
      tone(c, d, 'sine', t, 663 * r, 663 * r, 0.4, 0.12 * k, 0.02)
      hiss(c, d, t, 0.15, 0.2, 'highpass', 5000, 6000, 0.7)
      break
    case 'overrun-step':
      sample(c, 'step', d, 0.5, 1.2)
      hiss(c, d, t, 0.1, 0.3, 'bandpass', 600, 1800, 1.2, 0.01)
      break
    case 'overrun-charge':
      // the dash voice, longer and lower: the loudest movement in the pool
      tone(c, lowpass(c, d, 1200), 'sawtooth', t, 50 * r, 220 * r, 0.3, 0.7 * k, 0.01)
      hiss(c, d, t, 0.32, 0.7 * k, 'bandpass', 350, 2600, 1.4, 0.02)
      break
    case 'skitter':
      // his own footstep, doubled and light
      sample(c, 'step', d, 0.5, 1.6)
      hiss(c, d, t, 0.08, 0.3, 'bandpass', 1200, 2400, 1.2, 0.005)
      break
    case 'spring':
      sample(c, 'step', d, 0.8, 1.2)
      tone(c, lowpass(c, d, 700), 'sawtooth', t, 80, 160, 0.12, 0.5, 0.005)
      break
  }

  if (pushed) grind(c, d, t)
}

/** A little of the push grind, for parts that run on strain. */
function smallGrind(c: AudioContext, d: AudioNode, t: number, gain: number) {
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 320
  bp.Q.value = 3
  bp.connect(d)
  tone(c, distorted(c, bp), 'square', t, 55, 49, 0.3, 0.5 * gain, 0.01)
}

/** Signal Flare lands: a chime rather than a thud. */
export function signalLand(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', pan)
  tone(c, d, 'triangle', t, 1760, 1760, 0.25, 0.12)
  tone(c, d, 'sine', t, 2637, 2637, 0.2, 0.1)
  hiss(c, d, t, 0.05, 0.2, 'highpass', 5000, 5000, 0.7)
}

/** A mark used: a doubled hit, two strikes 60 ms apart. You hear "twice". */
export function markConsumed(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  sample(c, 'metalLight', d, 0.6, 1.6)
  sample(c, 'metalLight', d, 0.6, 1.6, 0.06)
  tone(c, d, 'triangle', t, 1318, 1318, 0.08, 0.15)
  tone(c, d, 'triangle', t + 0.06, 1976, 1976, 0.1, 0.15)
}

/** A slow ran out: the frost falls off with a tiny glass tick. */
export function slowEnd(pan: number) {
  const c = live()
  if (!c) return
  tone(c, out(c, 'hits', pan), 'triangle', c.currentTime, 3136, 2800, 0.03, 0.06)
}

/** A windup broken by a parry: the clang of an attack that didn't happen. */
export function parryBreak(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', pan)
  sample(c, 'bell', d, 0.6, 1.6)
  tone(c, d, 'triangle', t, 1976, 1318, 0.15, 0.3)
}

/** A thrown enemy comes down; against a wall, the stone answers too. */
export function throwLand(pan: number, wall: boolean) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'hits', pan)
  sample(c, 'softHeavy', d, 0.9, 0.9)
  tone(c, d, 'sine', t, 110, 40, 0.2, 0.7)
  if (wall) {
    sample(c, 'mining', d, 0.7)
    sample(c, 'plateHeavy', d, 0.5)
  }
}

/**
 * A bounce off a wall: a ping, the second a fifth higher. The sentinel's answer
 * gets the same ping at its bounce: you hear the symmetry.
 */
export function bounce(pan: number, n: number) {
  const c = live()
  if (!c) return
  const f = n >= 2 ? 1.5 : 1
  const d = out(c, 'abilities', pan)
  sample(c, 'tin', d, 0.5, 1.8 * f)
  tone(c, d, 'triangle', c.currentTime, 2200 * f, 1600 * f, 0.05, 0.2)
}

/** Through-Line crossing a wall: stone giving way. */
export function breachWall(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', pan)
  sample(c, 'mining', d, 0.6, 1.2)
  sample(c, 'plateHeavy', d, 0.3, 1.4)
}

/** A breach closing: soft, so your ear tells you your cover is back. */
export function breachClose(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', pan)
  sample(c, 'generic', d, 0.25, 0.8)
  hiss(c, d, c.currentTime, 0.2, 0.2, 'lowpass', 800, 200, 0.7, 0.01)
}

/** The decoy calling, panned to where it stands. */
export function decoyBeacon(pan: number) {
  const c = live()
  if (!c) return
  tone(c, out(c, 'abilities', pan), 'sine', c.currentTime, 1318, 1318, 0.08, 0.06)
}

/**
 * The decoy bursts: a nova with a bell in it. Never the triangle cluster of
 * shatter(), the HP death: the decoy breaking must never sound like Still breaking.
 */
export function decoyBurst(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', pan)
  tone(c, d, 'sine', t, 120, 38, 0.42, 0.9)
  hiss(c, d, t, 0.45, 0.6, 'lowpass', 5000, 250, 0.7, 0.004)
  sample(c, 'bell', d, 0.4, 1.1)
  sample(c, 'tin', d, 0.3)
}

/** Arriving at the end of a snap: a plate landing. */
export function snapArrive() {
  const c = live()
  if (!c) return
  sample(c, 'plateHeavy', out(c, 'abilities', 0), 0.5)
}

/** Back from a rewind: a small bell as the afterimage merges into him. */
export function rewindArrive() {
  const c = live()
  if (!c) return
  sample(c, 'bell', out(c, 'abilities', 0), 0.2, 1.8)
}

/** The anchor crossed out of snap reach: one soft descending tick. */
export function tetherFar() {
  const c = live()
  if (!c) return
  tone(c, out(c, 'abilities', 0), 'triangle', c.currentTime, 880, 660, 0.05, 0.05)
}

/** The anchor faded unused: quiet. */
export function anchorFade() {
  const c = live()
  if (!c) return
  tone(c, out(c, 'abilities', 0), 'sine', c.currentTime, 440, 330, 0.2, 0.08)
}

/** A press that did nothing (a snap past reach): a soft denied tick. */
export function denied() {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  tone(c, d, 'square', c.currentTime, 220, 180, 0.05, 0.08, 0.002)
}

/**
 * A tap on a cooling button: a dry, cold latch that doesn't catch. Steel, high and
 * short, no body and no tail, under the auto so a mash never clutters the fight.
 */
export function deadTap(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  if (limited('deadTap', 0.04, t)) return
  const d = out(c, 'abilities', pan)
  hiss(c, d, t, 0.012, 0.09, 'highpass', 5200, 4200, 0.8, 0.001)
  tone(c, d, 'triangle', t, vary(2300, 0.04), 1750, 0.018, 0.035, 0.001)
}

/** A shot destroyed on the Ward: a ting. */
export function shieldTing() {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  sample(c, 'tin', d, 0.5, 1.4)
  tone(c, d, 'triangle', c.currentTime, 1760, 1200, 0.05, 0.2)
}

/** A shot turned by the Mirror Ward: it sounds like Still's bolt now, because it is. */
export function reflect() {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  sample(c, 'tin', d, 0.4, 1.9)
  tone(c, d, 'sawtooth', c.currentTime, 800, 2400, 0.05, 0.22)
}

/** A hit turned into strain by Brace. It replaces the hurt sound: it's strain, not damage. */
export function braceConvert() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  sample(c, 'bell', d, 0.35, 1.3)
  smallGrind(c, d, t, 0.6)
}

/** The Anvil catches a blow: the loudest sound any of Still's parts makes, because it's the payoff. */
export function anvilCatch() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  sample(c, 'bell', d, 1, 0.8)
  sample(c, 'metalHeavy', d, 0.8, 0.9)
  tone(c, distorted(c, d), 'sine', t, 90, 30, 0.35, 0.9, 0.004)
}

/** The Anvil's window ran out: small and honest. */
export function anvilMiss() {
  const c = live()
  if (!c) return
  sample(c, 'tin', out(c, 'abilities', 0), 0.2, 0.6)
}

/** G8: something that lasted has ended. A tick you notice without watching for it. */
export function windowEnd() {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  tone(c, d, 'triangle', c.currentTime, 1500, 1250, 0.04, 0.1)
}

/** Piston connected: a punch and a piston thunk. */
export function pistonHit() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  sample(c, 'punchHeavy', d, 0.8, 1.1)
  sample(c, 'metalMedium', d, 0.4)
  tone(c, d, 'square', t, 120, 60, 0.06, 0.35)
}

/** Piston hit nothing: the pneumatic breath of an empty stroke. */
export function pistonMiss() {
  const c = live()
  if (!c) return
  hiss(c, out(c, 'abilities', 0), c.currentTime, 0.05, 0.35, 'highpass', 4000, 4000, 0.7)
}

/** A lob coming down, panned to where it lands: a small nova. */
export function lobLand(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', pan)
  tone(c, d, 'sine', t, 160, 50, 0.22, 0.8)
  hiss(c, d, t, 0.25, 0.5, 'lowpass', 3000, 300, 0.7, 0.004)
  sample(c, 'softMedium', d, 0.5, 1.1)
  sample(c, 'metalLight', d, 0.3, 1.5)
}

/** Patient Lens reached full: one glassy tick. No charging drone, that would be clutter. */
export function patientFull() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  tone(c, d, 'sine', t, 2637, 2637, 0.12, 0.08)
  tone(c, d, 'triangle', t, 1318, 1318, 0.1, 0.1)
}

/** Strain crossed one of Frayed Cleaver's notches: a tear going up, a soft click coming down. */
export function frayCross(up: boolean) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  if (up) {
    sample(c, 'tin', d, 0.35, 0.9)
    hiss(c, d, t, 0.14, 0.35, 'bandpass', 2400, 900, 1.5, 0.004)
  } else {
    tone(c, d, 'triangle', t, 1400, 1100, 0.03, 0.15)
  }
}

/** Touching down from a hop. A vault lands heavy; a hop lands light. */
export function landing(heavy: boolean) {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  if (heavy) {
    sample(c, 'softMedium', d, 0.7)
    sample(c, 'step', d, 1, 0.9)
    sample(c, 'tin', d, 0.15, 1.4)
  } else {
    sample(c, 'step', d, 0.8, 1.4)
    sample(c, 'tin', d, 0.1, 2.2)
  }
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
 * Under Broken's slow motion: the crash's own ring, stretched. A low sine sinking and a
 * dark band of noise, both over `seconds`, past the duck like the crash. It stops dead
 * when time comes back, so the landing is heard in the clear.
 */
export function slowRing(seconds: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const g = c.createGain()
  g.gain.value = mix.hits
  g.connect(master)
  tone(c, g, 'sine', t, 62, 38, seconds, 0.5, 0.05)
  tone(c, g, 'triangle', t, 311, 262, seconds, 0.035, 0.08)
  hiss(c, g, t, seconds, 0.22, 'bandpass', 900, 220, 2.5, 0.08)
}

/** Broken: one part of him hitting the stone, at full speed again. `i` is the order they land in: the first is the heavy one. */
export function partLand(i: number, pan: number) {
  const c = live()
  if (!c) return
  const g = c.createGain()
  g.gain.value = mix.hits
  g.connect(master)
  const p = c.createStereoPanner()
  p.pan.value = clampPan(pan)
  p.connect(g)
  const heavy = i === 0
  sample(c, heavy ? 'plateHeavy' : 'metalMedium', p, heavy ? 0.9 : 0.7, heavy ? 0.9 : 1.1 + 0.08 * i)
  sample(c, 'tin', p, 0.25, 1.3 + 0.15 * i, 0.03)
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

/** For the ambience: the context, its bus, the shared noise, and the recorded layers. */
export function ambienceContext(): {
  ctx: AudioContext
  out: AudioNode
  noise: AudioBuffer
  /** `when`: seconds from now. */
  play: (name: SampleName, dest: AudioNode, gain: number, rate?: number, when?: number) => void
} | null {
  const c = live()
  return c ? { ctx: c, out: buses.ambience, noise, play: (n, d, g, r = 1, w = 0) => sample(c, n, d, g, r, w) } : null
}

/** For the music: the running context, and its bus. Null until audio is unlocked. */
export function musicContext(): { ctx: AudioContext; out: AudioNode; play: (name: SampleName, dest: AudioNode, gain: number, rate?: number, when?: number) => void } | null {
  const c = live()
  return c ? { ctx: c, out: buses.music, play: (n, d, g, r = 1, w = 0) => sample(c, n, d, g, r, w) } : null
}

// --- home: the Workshop's voices ---

/**
 * Stopped, coming back: windDown mirrored, a motor finding its pitch over the
 * whole relight. It leaves the duck alone: the room is already quiet.
 */
export function windUp(seconds: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(90, t)
  lp.frequency.exponentialRampToValueAtTime(1600, t + seconds)
  lp.connect(d)
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.setValueAtTime(18, t)
  o.frequency.exponentialRampToValueAtTime(180, t + seconds)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.2, t + seconds * 0.8)
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.4)
  o.connect(g).connect(lp)
  o.start(t)
  o.stop(t + seconds + 0.45)
}

/** Broken, put back: each part seating is a small click, a little higher each time. */
export function reassembleClick(i: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'abilities', 0)
  sample(c, 'tin', d, 0.2, 1.4 + 0.1 * i)
  sample(c, 'metalLight', d, 0.12, 1.2 + 0.1 * i)
}

/** A plaque turned on the wall of parts. */
export function plaqueTurn(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'plank', out(c, 'ambience', pan), 0.25, 1.6)
}

/** The kids' door pulled to. */
export function doorShut(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'ambience', pan)
  sample(c, 'woodHeavy', d, 0.35, 1.3)
  sample(c, 'tin', d, 0.08, 1.9, 0.06)
}

/** Small feet running off, just out of frame: n light steps, 110 ms apart. */
export function kidSteps(pan: number, n: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'ambience', pan)
  const name: SampleName = samples.get('woodStep')?.length ? 'woodStep' : 'step'
  for (let i = 0; i < n; i++) sample(c, name, d, 0.18 * (1 - i / (n + 2)), 2.1, i * 0.11)
}

/** Someone drawing in the next room: three short strokes of pencil on paper. */
export function pencil(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'ambience', pan)
  for (let i = 0; i < 3; i++) {
    const f = 2500 + Math.random() * 1500
    hiss(c, d, t + i * (0.12 + Math.random() * 0.08), 0.09, 0.02, 'bandpass', f, f * 1.1, 2.2, 0.01)
  }
}

/** The top block of a tower giving way: a small wooden knock and a roll. */
export function blockTumble(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'ambience', pan)
  sample(c, 'plank', d, 0.14, 2.4)
  sample(c, 'plank', d, 0.08, 2.8, 0.16)
}

/** Into the warm beam: a warm swell and a bell. Chosen, not ended. */
export function homeBeam() {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'abilities', 0)
  for (const f of [587, 880]) {
    const o = c.createOscillator()
    o.type = 'triangle'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.linearRampToValueAtTime(0.06, t + 0.4)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4)
    o.connect(g).connect(d)
    o.start(t)
    o.stop(t + 2.5)
  }
  sample(c, 'bell', d, 0.25, 1.5, 0.05)
}

// --- the Arbiter: its sweep, its lance, its vent, its scald, and the heat it leaves on a button ---

/** The sweep's loop: a low saw through a lowpass, beating at 3 Hz. Its pan follows the gaze. */
export function whirr(pan: number): Voice {
  const c = live()
  if (!c) return asVoice(() => {})
  const t = c.currentTime
  const p = livePan(c, 'enemy', pan)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.setTargetAtTime(0.05, t, 0.3)
  g.connect(p)
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = 70
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 400
  const trem = c.createGain()
  trem.gain.value = 0.6
  const lfo = c.createOscillator()
  lfo.frequency.value = 3
  const depth = c.createGain()
  depth.gain.value = 0.4
  lfo.connect(depth).connect(trem.gain)
  o.connect(lp).connect(trem).connect(g)
  o.start(t)
  lfo.start(t)
  return {
    stop: (hard) => {
      const now = c.currentTime
      g.gain.cancelScheduledValues(now)
      if (hard) g.gain.setValueAtTime(0, now)
      else g.gain.setTargetAtTime(0.0001, now, 0.15)
      o.stop(now + (hard ? 0.02 : 0.8))
      lfo.stop(now + (hard ? 0.02 : 0.8))
    },
    pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.05),
  }
}

/** One tick of the sweep, every 10°: tin, and a short square click. */
export function ratchet(pan: number) {
  const c = live()
  if (!c || limited('ratchet', 0.05, c.currentTime)) return
  const d = out(c, 'enemy', pan)
  sample(c, 'tin', d, 0.12, 2.0)
  tone(c, d, 'square', c.currentTime, 1900, 1900, 0.01, 0.02)
}

/** The gaze stops on him. */
export function catchClack(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'metalMedium', out(c, 'enemy', pan), 0.5, 0.8)
}

/** The lance: a hiss that cracks, a low bell, and a drop. */
export function lanceFire(pan: number) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const d = out(c, 'enemy', pan)
  hiss(c, d, t, 0.5, 0.4, 'highpass', 3000, 3000, 0.7)
  sample(c, 'bell', d, 0.3, 0.5)
  tone(c, d, 'sine', t, 180, 60, 0.25, 0.4)
}

/** The vent: steam over its whole 1.2 s, and a plate knocked open at the start. */
export function vent(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  hiss(c, d, c.currentTime, 1.2, 0.3, 'highpass', 2500, 2500, 0.7, 0.05)
  sample(c, 'plateHeavy', d, 0.5, 0.7)
}

/** A judder: tin ticking every 40 ms, then the clank. */
export function judder(ms: number, pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  for (let at = 0; at < ms / 1000; at += 0.04) sample(c, 'tin', d, 0.1, 1.4, at)
  sample(c, 'metalHeavy', d, 0.5, 0.6, ms / 1000)
}

/** The scald going off: a burst of steam. */
export function scald(pan: number) {
  const c = live()
  if (!c) return
  hiss(c, out(c, 'enemy', pan), c.currentTime, 0.4, 0.5, 'highpass', 2000, 2000, 0.7)
}

/** Heat on Still: a sizzle, and a tin tick. */
export function sizzle() {
  const c = live()
  if (!c) return
  const d = out(c, 'hits', 0)
  hiss(c, d, c.currentTime, 0.4, 0.2, 'bandpass', 4000, 4000, 2)
  sample(c, 'tin', d, 0.15, 2.6)
}

/** A button's heat ending: a soft falling hiss. */
export function cool() {
  const c = live()
  if (!c) return
  hiss(c, out(c, 'abilities', 0), c.currentTime, 0.35, 0.05, 'bandpass', 3000, 900, 1.5, 0.02)
}

/** A post cracking: broken brick, and wood giving way under it. */
export function crack(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'hits', pan)
  sample(c, 'mining', d, 0.8, 0.7)
  sample(c, 'woodHeavy', d, 0.6, 0.6, 0.03)
}

/** The Arbiter's death: its lens going out, a long falling sine and a glass tink. */
export function lensOut(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  tone(c, d, 'sine', c.currentTime, 900, 60, 1.5, 0.08, 0.01)
  sample(c, 'tin', d, 0.3, 3)
}

// --- the thief: its chime, the snatch, the cage opening ---

/** Every 1.4 s while it carries: two high sines 13 Hz apart, beating. The only cold instrument on an enemy. */
export function thiefChime(pan: number) {
  const c = live()
  if (!c) return
  const d = out(c, 'enemy', pan)
  const t = c.currentTime
  tone(c, d, 'sine', t, 2637, 2637, 0.6, 0.03, 0.004)
  tone(c, d, 'sine', t, 2650, 2650, 0.6, 0.03, 0.004)
}

/** It takes a part off the floor. */
export function snatch(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'metalLight', out(c, 'enemy', pan), 0.5, 1.6)
}

/** Caught: the cage springs open (the part's own drop sound is played with it). */
export function cageOpen(pan: number) {
  const c = live()
  if (!c) return
  sample(c, 'tin', out(c, 'enemy', pan), 0.4, 1.8)
}
