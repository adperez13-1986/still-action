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
 */
const BPM = 97
const BEAT = 60 / BPM
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
const OSTINATO = [1, 0, 1, 0, 1, 1, 0, 1]
const BELL_LINE = [69, 72, 74, 77, 76, 74, 81, 79, 77, 74]

export interface MusicState {
  fighting: boolean
  /** Breather or ending screen: room for the bell. */
  calm: boolean
  /** 0..1 */
  strain: number
}

interface Engine {
  ctx: AudioContext
  pulse: GainNode
  bell: GainNode
  tension: GainNode
  padOut: AudioNode
  nextBeat: number
  beat: number
  bellStep: number
}

let engine: Engine | null = null
let last = { fighting: false, calm: false, strain: -1 }

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

  return { ctx, pulse, bell, tension, padOut, nextBeat: ctx.currentTime + 0.1, beat: 0, bellStep: 0 }
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

function schedule(e: Engine, i: number, t: number) {
  const beatInBar = i % 4
  const bar = Math.floor(i / 4)
  const chord = CHORDS[Math.floor(bar / CHORD_BARS) % CHORDS.length]!
  const chordBeats = CHORD_BARS * 4

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
    // the click is what a phone speaker can actually play
    note(e, e.pulse, 'triangle', 1200, t, 0.001, 0, 0.03, 0.05)
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
    e.nextBeat += BEAT
  }
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

  const strain = Math.round(state.strain * 20) / 20
  if (state.fighting === last.fighting && state.calm === last.calm && strain === last.strain) return
  last = { fighting: state.fighting, calm: state.calm, strain }

  const t = engine.ctx.currentTime
  engine.pulse.gain.setTargetAtTime(state.fighting ? 1 : 0, t, state.fighting ? 1.2 : 0.8)
  engine.bell.gain.setTargetAtTime(state.calm ? 1 : 0.28, t, 1.5)
  // silent until strain passes 0.7 (14 of 20), then up to full at 20
  const rub = Math.max(0, (strain - 0.7) / 0.3)
  engine.tension.gain.setTargetAtTime(rub, t, 0.8)
}
