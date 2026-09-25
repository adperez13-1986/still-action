import { musicContext } from './audio'

/**
 * Generative score, synthesised like everything else. Cold by default, one warm
 * voice. Layers fade in and out with the run instead of switching tracks:
 *
 *   drone + pad   always, a slow D-minor loop
 *   pulse         fights only — a muted ostinato near the auto-attack's tempo
 *   bell          Grace's line; strongest between fights and under the endings
 *   tension       a faint rub that creeps in as strain gets high
 *
 * Phone speakers can't reproduce the low end, so the bass carries overtones.
 *
 * Area II has its own loop and a metal tick for the click, and its tempo slows as
 * the day goes: depth 4 from 97, depth 5 from 94.5, 2.5 BPM over each (the run sets it).
 */
const BPM = 97
/** The Assembler's fight: same key, faster, and a drum line under everything. */
const BOSS_BPM = 124
const CHORD_BARS = 2
const LOOKAHEAD = 0.15

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

// Dm9, Bbmaj7, Gm9, Asus4: stays in the cold, never resolves home cleanly
const CHORDS = [
  { root: 50, pad: [50, 53, 57, 64] },
  { root: 46, pad: [46, 50, 53, 57] },
  { root: 43, pad: [43, 46, 50, 57] },
  { root: 45, pad: [45, 50, 52, 57] },
]
/** Area II: Dm, Gm, Bb, A7 with no third. The A still refuses home. */
const CHORDS_II = [
  { root: 50, pad: [50, 53, 57, 62] },
  { root: 43, pad: [43, 50, 53, 58] },
  { root: 46, pad: [46, 50, 53, 57] },
  { root: 45, pad: [45, 52, 55, 57] },
]
const OSTINATO = [1, 0, 1, 0, 1, 1, 0, 1]
const BELL_LINE = [69, 72, 74, 77, 76, 74, 81, 79, 77, 74]

export interface MusicState {
  /** The boss is awake: tempo up, drums, drive. Its second phase adds the arpeggio. */
  boss: boolean
  phase2: boolean
  fighting: boolean
  /** Breather or ending screen: room for the bell. */
  calm: boolean
  /** 0..1 */
  strain: number
  /** The Workshop: the pad and drone drop back, no pulse or drums, the bell alone over them. */
  home?: boolean
  /** Which loop, and the crawl's tempo (the boss's is its own). Default area I at 97. */
  area?: 'I' | 'II'
  bpm?: number
}

interface Engine {
  ctx: AudioContext
  pulse: GainNode
  drums: GainNode
  drive: GainNode
  arp: GainNode
  bell: GainNode
  tension: GainNode
  padOut: GainNode
  nextBeat: number
  beat: number
  bellStep: number
}

let engine: Engine | null = null
let last = { fighting: false, calm: false, strain: -1, boss: false, phase2: false, home: false }
let boss = false
let phase2 = false
let area: 'I' | 'II' = 'I'
let bpm = BPM
const beatLen = () => 60 / (boss ? BOSS_BPM : bpm)
let noiseBuf: AudioBuffer | null = null

function impulse(ctx: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6)
  }
  return buf
}

function build(ctx: AudioContext, out: AudioNode): Engine {
  const reverb = ctx.createConvolver()
  reverb.buffer = impulse(ctx, 3.2)
  const wet = ctx.createGain()
  wet.gain.value = 0.55
  reverb.connect(wet).connect(out)

  const layer = (gain: number, send: number) => {
    const g = ctx.createGain()
    g.gain.value = gain
    g.connect(out)
    if (send > 0) {
      const s = ctx.createGain()
      s.gain.value = send
      g.connect(s).connect(reverb)
    }
    return g
  }

  const padOut = layer(1, 0.8)
  const pulse = layer(0, 0.15)
  const drums = layer(0, 0.12)
  const drive = layer(0, 0.1)
  const arp = layer(0, 0.5)
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const nd = noiseBuf.getChannelData(0)
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
  const bell = layer(0.5, 1)
  const tension = layer(0, 0.6)

  // drone: a D pedal under everything, breathing through a slow filter
  const droneFilter = ctx.createBiquadFilter()
  droneFilter.type = 'lowpass'
  droneFilter.frequency.value = 320
  droneFilter.Q.value = 2
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0.0001
  droneGain.gain.setTargetAtTime(0.16, ctx.currentTime, 2)
  droneFilter.connect(droneGain).connect(padOut)
  for (const [n, detune] of [[38, -6], [38, 7], [45, 0], [50, -3]] as const) {
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = midi(n)
    o.detune.value = detune
    o.connect(droneFilter)
    o.start()
  }
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.045
  const lfoDepth = ctx.createGain()
  lfoDepth.gain.value = 180
  lfo.connect(lfoDepth).connect(droneFilter.frequency)
  lfo.start()

  // tension: two high sines a semitone apart, beating against each other
  for (const n of [86, 87]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = midi(n)
    const g = ctx.createGain()
    g.gain.value = 0.05
    o.connect(g).connect(tension)
    o.start()
  }

  return { ctx, pulse, drums, drive, arp, bell, tension, padOut, nextBeat: ctx.currentTime + 0.1, beat: 0, bellStep: 0 }
}

function note(
  e: Engine, dest: AudioNode, type: OscillatorType, freq: number,
  t: number, attack: number, hold: number, release: number, peak: number, cutoff = 0, detune = 0,
) {
  const o = e.ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  const g = e.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + attack)
  g.gain.setValueAtTime(peak, t + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release)
  let head: AudioNode = g
  if (cutoff > 0) {
    const f = e.ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = cutoff
    f.connect(g)
    head = f
  }
  o.connect(head)
  g.connect(dest)
  o.start(t)
  o.stop(t + attack + hold + release + 0.05)
}

/** A burst of filtered noise: hats and snares. */
function hit(e: Engine, dest: AudioNode, t: number, type: BiquadFilterType, f: number, len: number, peak: number) {
  if (!noiseBuf) return
  const s = e.ctx.createBufferSource()
  s.buffer = noiseBuf
  const filt = e.ctx.createBiquadFilter()
  filt.type = type
  filt.frequency.value = f
  filt.Q.value = 0.9
  const g = e.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(peak, t + 0.002)
  g.gain.exponentialRampToValueAtTime(0.0001, t + len)
  s.connect(filt).connect(g).connect(dest)
  s.start(t, Math.random() * 0.5)
  s.stop(t + len + 0.02)
}

/** Area II's click: a square at 2400 Hz, 12 ms, rung through a narrow band. */
function metalTick(e: Engine, t: number) {
  const o = e.ctx.createOscillator()
  o.type = 'square'
  o.frequency.value = 2400
  const f = e.ctx.createBiquadFilter()
  f.type = 'bandpass'
  f.frequency.value = 3000
  f.Q.value = 4
  const g = e.ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.06, t + 0.001)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
  o.connect(f).connect(g).connect(e.pulse)
  o.start(t)
  o.stop(t + 0.03)
}

/** The boss layer: drums, a sixteenth-note drive on the root, a stab each bar, the arpeggio. */
function scheduleBoss(e: Engine, i: number, t: number, chord: (typeof CHORDS)[number]) {
  const B = beatLen()
  const beatInBar = i % 4
  // kick on every beat, and a pickup before the bar turns
  note(e, e.drums, 'sine', 70, t, 0.002, 0.03, 0.26, 0.9)
  note(e, e.drums, 'triangle', 1400, t, 0.001, 0, 0.02, 0.1)
  if (beatInBar === 3) note(e, e.drums, 'sine', 70, t + B * 0.75, 0.002, 0.02, 0.2, 0.6)
  // snare on 2 and 4
  if (beatInBar === 1 || beatInBar === 3) {
    hit(e, e.drums, t, 'bandpass', 1900, 0.18, 0.5)
    note(e, e.drums, 'triangle', 190, t, 0.001, 0, 0.1, 0.25)
  }
  // hats in sixteenths, accents on the off-beats
  for (let k = 0; k < 4; k++) hit(e, e.drums, t + (k * B) / 4, 'highpass', 7000, 0.04, k === 2 ? 0.22 : 0.1)
  // drive: the chord root in sixteenths, jumping the octave, through grit
  const pattern = [0, 0, 12, 0]
  for (let k = 0; k < 4; k++) {
    note(e, e.drive, 'sawtooth', midi(chord.root - 12 + pattern[k]!), t + (k * B) / 4, 0.004, 0.04, 0.09, 0.11, 900)
  }
  // a heavy stab at the top of each bar
  if (beatInBar === 0) for (const n of chord.pad) note(e, e.drive, 'sawtooth', midi(n + 12), t, 0.005, 0.08, 0.3, 0.035, 2200)
  // the boss's second phase: a fast rising arpeggio over the top
  if (phase2) {
    const up = [...chord.pad, chord.pad[0]! + 12]
    for (let k = 0; k < 4; k++) note(e, e.arp, 'square', midi(up[(i * 4 + k) % up.length]! + 12), t + (k * B) / 4, 0.003, 0.02, 0.1, 0.03, 3000)
  }
}

function schedule(e: Engine, i: number, t: number) {
  const BEAT = beatLen()
  const beatInBar = i % 4
  const bar = Math.floor(i / 4)
  const loop = area === 'II' ? CHORDS_II : CHORDS
  const chord = loop[Math.floor(bar / CHORD_BARS) % loop.length]!
  const chordBeats = CHORD_BARS * 4
  if (boss) scheduleBoss(e, i, t, chord)

  // pad: each chord swells in and overlaps the next
  if (i % chordBeats === 0) {
    const len = chordBeats * BEAT
    for (const n of chord.pad) {
      note(e, e.padOut, 'sawtooth', midi(n), t, 1.8, len - 1.8, 2.6, 0.022, 1100, -7)
      note(e, e.padOut, 'triangle', midi(n), t, 1.8, len - 1.8, 2.6, 0.03, 0, 6)
    }
  }

  // pulse: eighth-note ostinato on the chord root, plus a soft kick on 1 and 3
  for (const half of [0, 0.5]) {
    const step = beatInBar * 2 + half * 2
    if (OSTINATO[step]) {
      const at = t + half * BEAT
      note(e, e.pulse, 'square', midi(chord.root), at, 0.005, 0.05, 0.16, 0.09, 700)
    }
  }
  if (beatInBar === 0 || beatInBar === 2) {
    note(e, e.pulse, 'sine', 62, t, 0.003, 0.02, 0.22, 0.5)
    // the click is what a phone speaker can actually play; in area II it's a metal tick
    if (area === 'II') metalTick(e, t)
    else note(e, e.pulse, 'triangle', 1200, t, 0.001, 0, 0.03, 0.05)
  }

  // bell: sparse, never on a grid you can count
  if (beatInBar === 0 || (beatInBar === 2 && Math.random() < 0.35)) {
    if (Math.random() < 0.62) {
      const n = BELL_LINE[e.bellStep % BELL_LINE.length]!
      e.bellStep++
      const at = t + (Math.random() < 0.3 ? BEAT / 2 : 0)
      note(e, e.bell, 'triangle', midi(n), at, 0.004, 0, 2.6, 0.07)
      note(e, e.bell, 'sine', midi(n + 12), at, 0.004, 0, 1.4, 0.025)
    }
  }
}

function tick() {
  const e = engine
  if (!e) return
  while (e.nextBeat < e.ctx.currentTime + LOOKAHEAD) {
    // a throttled tab can fall far behind; skip ahead rather than play a pile-up
    if (e.nextBeat < e.ctx.currentTime - 0.5) e.nextBeat = e.ctx.currentTime + 0.05
    schedule(e, e.beat, e.nextBeat)
    e.beat++
    e.nextBeat += beatLen()
  }
}

/**
 * The beat grid, for anything that plays in time with the score (the Works' forge
 * thump): when the next beat falls on the audio clock, how long one is, its index.
 */
export function beatClock(): { next: number; len: number; beat: number } | null {
  return engine ? { next: engine.nextBeat, len: beatLen(), beat: engine.beat } : null
}

/** Call every frame. Starts itself the first time audio is running, then only reacts to changes. */
export function updateMusic(state: MusicState) {
  if (!engine) {
    const m = musicContext()
    if (!m) return
    engine = build(m.ctx, m.out)
    window.setInterval(tick, 30)
    tick()
  }
  // the loop and the tempo change on the next beat, without restarting anything
  area = state.area ?? 'I'
  bpm = state.bpm ?? BPM

  const strain = Math.round(state.strain * 20) / 20
  if (
    state.fighting === last.fighting && state.calm === last.calm && strain === last.strain &&
    state.boss === last.boss && state.phase2 === last.phase2 && !!state.home === last.home
  ) return
  last = { fighting: state.fighting, calm: state.calm, strain, boss: state.boss, phase2: state.phase2, home: !!state.home }
  boss = state.boss
  phase2 = state.phase2

  const t = engine.ctx.currentTime
  if (state.home) {
    engine.padOut.gain.setTargetAtTime(0.55, t, 1.5)
    for (const g of [engine.pulse, engine.drums, engine.drive, engine.arp, engine.tension]) g.gain.setTargetAtTime(0, t, 0.8)
    engine.bell.gain.setTargetAtTime(1, t, 1.5)
    return
  }
  engine.padOut.gain.setTargetAtTime(1, t, 1.5)
  // the boss fight replaces the gentle pulse with its own drums and drive
  engine.pulse.gain.setTargetAtTime(state.fighting && !state.boss ? 1 : 0, t, state.fighting ? 1.2 : 0.8)
  engine.drums.gain.setTargetAtTime(state.boss ? 1 : 0, t, state.boss ? 0.4 : 1.2)
  engine.drive.gain.setTargetAtTime(state.boss ? 1 : 0, t, state.boss ? 0.6 : 1.2)
  engine.arp.gain.setTargetAtTime(state.boss && state.phase2 ? 1 : 0, t, 0.8)
  engine.bell.gain.setTargetAtTime(state.calm ? 1 : 0.28, t, 1.5)
  // silent until strain passes 0.7 (14 of 20), then up to full at 20
  const rub = Math.max(0, (strain - 0.7) / 0.3)
  engine.tension.gain.setTargetAtTime(rub, t, 0.8)
}
