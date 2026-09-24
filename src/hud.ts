import { STARTING, type AbilityDef } from './abilities'

/** Variant A, locked after the reach test: fixed stick, tight arc (r96, 62px). */
const ARC_R = 96
const BTN = 62
const ARC_DEG = [8, 34, 60, 86]
const PAD = 20
const PUSH_HOLD_MS = 180


interface ButtonState {
  el: HTMLElement
  cdEl: HTMLElement
  def: AbilityDef
  readyAt: number
  pointerId: number | null
  downAt: number
  pushed: boolean
}

export interface Hud {
  /** -1..1 on each axis, already deadzoned. */
  readonly moveX: number
  readonly moveZ: number
  /** 0..20, owned by the run. */
  strain: number
  integrity: number
  /** Off once an ending starts: the stick and buttons stop answering. */
  enabled: boolean
  /** `now` is game time in ms, not wall time: it stops while paused, and so do cooldowns. */
  update: (now: number) => void
  onFire: (cb: (def: AbilityDef, pushed: boolean) => void) => void
  /** What's on the four buttons right now. */
  readonly loadout: readonly AbilityDef[]
  /**
   * Put a part on its slot's button and return the one it replaced. The new part
   * inherits the slot's cooldown as a fraction, so swapping never resets anything.
   */
  equip: (def: AbilityDef) => AbilityDef
  resetLoadout: () => void
  /** The pickup card. Null hides it. */
  offer: (incoming: AbilityDef | null) => void
  onTake: (cb: () => void) => void
  onCompare: (cb: () => void) => void
  onPause: (cb: () => void) => void
  /** The "next fight" button, shown while the breather is waiting on you. */
  ready: (show: boolean) => void
  onReady: (cb: () => void) => void
}

const TIER_CSS = { white: 'var(--tier-white)', blue: 'var(--tier-blue)', gold: 'var(--tier-gold)' }
const SLOT_LABEL = { head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs' }

export function createHud(root: HTMLElement): Hud {
  root.innerHTML = `
    <div id="stickZone"></div>
    <div id="stickBase"><div id="stickKnob"></div></div>
    <div class="meter" id="strain"><i style="width:0%"></i><b>STRAIN</b></div>
    <div class="meter" id="hp"><i style="width:100%"></i><b>INTEGRITY</b></div>
    <div id="offer">
      <div class="info">
        <div class="head"><span class="slot"></span><b class="name"></b></div>
        <p class="line"></p>
        <p class="replaces"></p>
      </div>
      <div class="choices">
        <button type="button" class="take">take</button>
        <button type="button" class="compare">compare</button>
      </div>
    </div>
    <button type="button" id="pauseBtn" aria-label="pause"><i></i><i></i></button>
    <button type="button" id="readyBtn">next fight</button>
  `

  const zone = root.querySelector<HTMLElement>('#stickZone')!
  const base = root.querySelector<HTMLElement>('#stickBase')!
  const knob = root.querySelector<HTMLElement>('#stickKnob')!
  const strainMeter = root.querySelector<HTMLElement>('#strain')!
  const strainFill = strainMeter.querySelector<HTMLElement>('i')!
  const hpFill = root.querySelector<HTMLElement>('#hp i')!
  const offerEl = root.querySelector<HTMLElement>('#offer')!
  const offerSlot = offerEl.querySelector<HTMLElement>('.slot')!
  const offerName = offerEl.querySelector<HTMLElement>('.name')!
  const offerLine = offerEl.querySelector<HTMLElement>('.line')!
  const offerReplaces = offerEl.querySelector<HTMLElement>('.replaces')!
  const takeBtn = offerEl.querySelector<HTMLElement>('.take')!
  const compareBtn = offerEl.querySelector<HTMLElement>('.compare')!
  const pauseBtn = root.querySelector<HTMLElement>('#pauseBtn')!
  const takeListeners: (() => void)[] = []
  const compareListeners: (() => void)[] = []
  const pauseListeners: (() => void)[] = []
  const readyListeners: (() => void)[] = []
  const readyBtn = root.querySelector<HTMLElement>('#readyBtn')!
  readyBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (state.enabled) for (const cb of readyListeners) cb()
  })
  let offered: AbilityDef | null = null
  // pointerdown, not click: a mid-fight tap should land the first time
  takeBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (offered && state.enabled) for (const cb of takeListeners) cb()
  })
  compareBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (offered && state.enabled) for (const cb of compareListeners) cb()
  })
  pauseBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (state.enabled) for (const cb of pauseListeners) cb()
  })

  const buttons: ButtonState[] = STARTING.map((def, i) => {
    const el = document.createElement('div')
    el.className = `btn ready tier-${def.tier}`
    el.innerHTML = `<div class="cd"></div><span class="lbl">${def.key}</span>`
    const th = (ARC_DEG[i] ?? 0) * (Math.PI / 180)
    el.style.right = `calc(env(safe-area-inset-right, 0px) + ${PAD + ARC_R * Math.cos(th) - BTN / 2}px)`
    el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${PAD + ARC_R * Math.sin(th) - BTN / 2}px)`
    root.appendChild(el)
    return { el, cdEl: el.querySelector<HTMLElement>('.cd')!, def, readyAt: 0, pointerId: null, downAt: 0, pushed: false }
  })

  const listeners: ((def: AbilityDef, pushed: boolean) => void)[] = []
  const state = { moveX: 0, moveZ: 0, strain: 0, integrity: 1, enabled: true, clock: 0 }

  // --- stick ---
  let stickPointer: number | null = null
  let originX = 0
  let originY = 0
  const MAX_THROW = 46

  zone.addEventListener('pointerdown', (e) => {
    if (stickPointer !== null) return
    stickPointer = e.pointerId
    zone.setPointerCapture(e.pointerId)
    const r = base.getBoundingClientRect()
    originX = r.left + r.width / 2
    originY = r.top + r.height / 2
    moveStick(e.clientX, e.clientY)
  })
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId === stickPointer) moveStick(e.clientX, e.clientY)
  })
  for (const t of ['pointerup', 'pointercancel'] as const) {
    zone.addEventListener(t, (e) => {
      if (e.pointerId !== stickPointer) return
      stickPointer = null
      state.moveX = 0
      state.moveZ = 0
      knob.style.transform = ''
    })
  }

  function moveStick(x: number, y: number) {
    let dx = x - originX
    let dy = y - originY
    const d = Math.hypot(dx, dy)
    if (d > MAX_THROW) {
      dx = (dx / d) * MAX_THROW
      dy = (dy / d) * MAX_THROW
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`

    if (!state.enabled) return
    const nx = dx / MAX_THROW
    const ny = dy / MAX_THROW
    const mag = Math.hypot(nx, ny)
    if (mag < 0.14) {
      state.moveX = 0
      state.moveZ = 0
      return
    }
    // screen axes -> world axes, rotated into the locked 45deg camera yaw
    const worldX = (nx + ny) * Math.SQRT1_2
    const worldZ = (ny - nx) * Math.SQRT1_2
    state.moveX = worldX
    state.moveZ = worldZ
  }

  // --- ability buttons: tap fires, holding a cooling one pushes it ---
  for (const b of buttons) {
    b.el.addEventListener('pointerdown', (e) => {
      b.el.setPointerCapture(e.pointerId)
      b.pointerId = e.pointerId
      b.downAt = state.clock
      b.pushed = false
      b.el.classList.add('press')
    })
    for (const t of ['pointerup', 'pointercancel'] as const) {
      b.el.addEventListener(t, (e) => {
        if (b.pointerId !== e.pointerId) return
        b.pointerId = null
        b.el.classList.remove('press')
        if (b.pushed) return
        if (state.clock >= b.readyAt) fire(b, false)
      })
    }
  }

  function fire(b: ButtonState, pushed: boolean) {
    if (!state.enabled) return
    b.readyAt = state.clock + b.def.cooldownMs
    if (pushed) {
      navigator.vibrate?.([14, 26, 14])
    } else {
      navigator.vibrate?.(12)
    }
    for (const cb of listeners) cb(b.def, pushed)
  }

  return {
    get moveX() { return state.moveX },
    get moveZ() { return state.moveZ },
    get strain() { return state.strain },
    set strain(v: number) { state.strain = v },
    get integrity() { return state.integrity },
    set integrity(v: number) { state.integrity = v },
    get enabled() { return state.enabled },
    set enabled(v: boolean) {
      state.enabled = v
      if (!v) {
        state.moveX = 0
        state.moveZ = 0
        knob.style.transform = ''
      }
    },

    update(now: number) {
      state.clock = now
      for (const b of buttons) {
        const left = b.readyAt - now
        const ready = left <= 0
        b.el.classList.toggle('ready', ready)
        b.cdEl.style.setProperty('--sweep', ready ? '0deg' : `${(left / b.def.cooldownMs) * 360}deg`)

        const holding = b.pointerId !== null && now - b.downAt >= PUSH_HOLD_MS
        b.el.classList.toggle('pushable', !ready && holding)
        if (!ready && holding && !b.pushed) {
          b.pushed = true
          fire(b, true)
        }
      }
      strainFill.style.width = `${Math.min(100, (state.strain / 20) * 100)}%`
      strainMeter.classList.toggle('high', state.strain >= 14)
      hpFill.style.width = `${Math.max(0, state.integrity * 100)}%`
    },

    onFire(cb) { listeners.push(cb) },

    get loadout() { return buttons.map((b) => b.def) },

    equip(def) {
      const b = buttons.find((x) => x.def.slot === def.slot)!
      const old = b.def
      const now = state.clock
      const frac = Math.max(0, b.readyAt - now) / old.cooldownMs
      b.def = def
      b.readyAt = now + frac * def.cooldownMs
      b.el.className = b.el.className.replace(/tier-\w+/, `tier-${def.tier}`)
      b.el.classList.add('swapped')
      setTimeout(() => b.el.classList.remove('swapped'), 450)
      return old
    },

    resetLoadout() {
      for (const b of buttons) {
        const start = STARTING.find((p) => p.slot === b.def.slot)!
        b.def = start
        b.readyAt = 0
        b.el.className = b.el.className.replace(/tier-\w+/, `tier-${start.tier}`)
      }
    },

    offer(incoming) {
      offered = incoming
      // the button that would change pulses, so "which slot" needs no reading
      for (const b of buttons) b.el.classList.toggle('target', !!incoming && b.def.slot === incoming.slot)
      if (!incoming) {
        offerEl.classList.remove('show')
        return
      }
      const current = buttons.find((b) => b.def.slot === incoming.slot)!.def
      offerSlot.textContent = SLOT_LABEL[incoming.slot]
      offerName.textContent = incoming.name
      offerName.style.color = TIER_CSS[incoming.tier]
      offerLine.textContent = incoming.line
      offerReplaces.textContent = `replaces ${current.name}`
      offerEl.classList.add('show')
    },

    onTake(cb) { takeListeners.push(cb) },
    onCompare(cb) { compareListeners.push(cb) },
    onPause(cb) { pauseListeners.push(cb) },
    ready(show) { readyBtn.classList.toggle('show', show) },
    onReady(cb) { readyListeners.push(cb) },
  }
}
