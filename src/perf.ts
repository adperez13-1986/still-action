import type { World } from './world'

/**
 * Keeping the phone cool. A 120 Hz screen asks for a frame every 8 ms; drawing each one, bloom and
 * all, cooks a phone within a run, and a throttled phone drops frames and starves the audio thread
 * (the sound cuts out). So the world is drawn at most 60 times a second, less when nothing
 * behind a card can be seen moving, and the drawing buffer gets coarser when frames run long.
 */

/** The most the world is drawn: once per 1/60 s, whatever the screen's refresh. */
export const FRAME_S = 1 / 60
/** Behind the pause card or the broken ending's black: enough to redraw after a turn of the phone. */
export const BEHIND_CARD_S = 0.2
/** The Workshop with nothing moving: its slow things (a door, a block) read fine at 30. */
export const IDLE_ROOM_S = 1 / 30
/** A frame early by less than this is still due: a 60 Hz screen's jitter must never skip one. */
const EARLY_S = 0.002

export interface Pacer {
  /** True when this display frame should be drawn, drawing at most once per `minS`. */
  due(now: number, minS: number): boolean
}

/**
 * Skips display frames that come faster than `minS`. The time owed carries over (up to one
 * frame), so a 90 Hz or 144 Hz screen still averages 60, not the next divisor down.
 */
export function createPacer(): Pacer {
  let seen = -1
  let owed = 0
  return {
    due(now, minS) {
      if (seen < 0) {
        seen = now
        return true
      }
      owed += now - seen
      seen = now
      if (owed < minS - EARLY_S) return false
      owed = Math.min(minS, Math.max(0, owed - minS))
      return true
    },
  }
}

/** Below this many drawn frames a second, for SLOW_S seconds running, the buffer steps down. */
const SLOW_FPS = 50
const SLOW_S = 3
/** At this or better for `upWait` seconds, in a calm moment, it steps back up. */
const FAST_FPS = 57
const UP_WAIT_S = 20
/** Stepping up and straight back down doubles the wait before the next try, up to this. */
const UP_WAIT_MAX_S = 300

export interface Quality {
  /** Every pixel ratio it can use, sharpest first, and which one is on. */
  readonly levels: readonly number[]
  readonly level: number
  /** A frame drawn at the full 60 target, `dt` after the last drawn one. `calm`: a sharper image may come back now. */
  frame(dt: number, now: number, calm: boolean): void
  /** A frame drawn below the 60 target on purpose (a card, the idle room): the measure starts over. */
  reset(): void
}

/**
 * Adaptive resolution: 1.5 → 1.25 → 1.0 pixels per CSS pixel when frames stay long, back up when
 * there's room. Down is at once (the heat is now); up waits for a calm moment, so the change in
 * sharpness never lands in the middle of a fight.
 */
export function createQuality(world: World): Quality {
  const levels = [world.maxPixelRatio, ...[1.25, 1].filter((l) => l < world.maxPixelRatio - 0.01)]
  let level = 0
  let winT = 0
  let winN = 0
  let slow = 0
  let fast = 0
  let upWait = UP_WAIT_S
  let lastUp = -Infinity
  const set = (i: number) => {
    level = i
    world.setPixelRatio(levels[i]!)
  }
  return {
    levels,
    get level() { return level },
    frame(dt, now, calm) {
      // a stall (the tab away, a level being built) isn't the steady cost of drawing
      if (dt > 0.25) return
      winT += dt
      winN++
      if (winT < 1) return
      const fps = winN / winT
      winT = 0
      winN = 0
      if (fps < SLOW_FPS) { slow++; fast = 0 } else if (fps >= FAST_FPS) { fast++; slow = 0 } else { slow = 0; fast = 0 }
      if (slow >= SLOW_S && level < levels.length - 1) {
        if (now - lastUp < SLOW_S + 12) upWait = Math.min(UP_WAIT_MAX_S, upWait * 2)
        slow = 0
        fast = 0
        set(level + 1)
      } else if (fast >= upWait && calm && level > 0) {
        fast = 0
        lastUp = now
        set(level - 1)
      }
    },
    reset() {
      winT = 0
      winN = 0
    },
  }
}

// --- dev only: what the phone is doing, on the phone ---

/** Web Audio sources playing now; counted only in a dev build. */
let voices = 0
if (import.meta.env.DEV && typeof AudioScheduledSourceNode !== 'undefined') {
  const count = (proto: { start: (...a: never[]) => void }) => {
    const start = proto.start
    proto.start = function (this: AudioScheduledSourceNode, ...a: never[]) {
      voices++
      this.addEventListener('ended', () => voices--, { once: true })
      return start.apply(this, a)
    }
  }
  count(AudioScheduledSourceNode.prototype)
  // a buffer source has its own start (it takes an offset)
  if (Object.prototype.hasOwnProperty.call(AudioBufferSourceNode.prototype, 'start')) count(AudioBufferSourceNode.prototype)
}

const READOUT_KEY = 'still.perfReadout'

export interface Readout {
  /** One drawn frame, and the main thread's ms on it. */
  frame(now: number, cpuMs: number): void
}

/**
 * A corner of text the owner can read on the phone (it has no console): drawn frames a second,
 * the ms between them and the main thread's share, the pixel ratio, live audio voices, draw calls.
 * Switched from the grade panel; remembered on this phone.
 */
export function createReadout(root: HTMLElement, panel: HTMLElement, world: World, quality: Quality): Readout {
  const el = document.createElement('div')
  el.id = 'perf'
  root.appendChild(el)
  let on = false
  try { on = localStorage.getItem(READOUT_KEY) === '1' } catch { /* private window: off */ }

  const toggle = document.createElement('button')
  toggle.className = 'perfToggle'
  const show = () => {
    el.style.display = on ? 'block' : 'none'
    toggle.textContent = on ? 'perf readout: on' : 'perf readout: off'
  }
  toggle.addEventListener('click', () => {
    on = !on
    try { localStorage.setItem(READOUT_KEY, on ? '1' : '0') } catch { /* not remembered */ }
    show()
  })
  panel.prepend(toggle)
  show()

  let t0 = -1
  let drawn = 0
  let cpu = 0
  let cpuMax = 0
  let calls = 0
  let tris = 0
  return {
    frame(now, cpuMs) {
      if (!on) return
      if (t0 < 0) t0 = now
      drawn++
      cpu += cpuMs
      if (cpuMs > cpuMax) cpuMax = cpuMs
      calls = world.renderer.info.render.calls
      tris = world.renderer.info.render.triangles
      const span = now - t0
      if (span < 0.5) return
      el.textContent =
        `${(drawn / span).toFixed(0)} fps  ${((span * 1000) / drawn).toFixed(1)} ms  cpu ${(cpu / drawn).toFixed(1)}/${cpuMax.toFixed(0)}\n` +
        `px ${world.pixelRatio.toFixed(2)} (${quality.level + 1}/${quality.levels.length})  voices ${voices}  calls ${calls}  tris ${(tris / 1000).toFixed(0)}k`
      t0 = now
      drawn = 0
      cpu = 0
      cpuMax = 0
    },
  }
}
