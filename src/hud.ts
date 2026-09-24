import type { AbilityDef, IconState } from './abilities'
import type { CastResult } from './combat'
import { SLOT_NAMES, type SlotName } from './still'

/**
 * The ability arc. Variant A's r96 packed 62px buttons only ~43px apart, so they
 * overlapped; the reach test found a bigger arc felt the same to the thumb. Now
 * r132 with 60px buttons over a clean quarter circle: ~8px between buttons. The
 * arc's centre sits in from the corner so the end buttons stay on screen.
 */
const ARC_R = 132
const BTN = 60
const ARC_DEG = [0, 30, 60, 90]
const PAD = 34

/**
 * Line icons, one per part (its def carries the markup), drawn in the tier colour.
 * An empty slot shows the outline of the body part Still is missing instead.
 */
const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`
const SLOT_ICON: Record<SlotName, string> = {
  head: svg('<circle cx="12" cy="9" r="5"/><circle cx="12" cy="9" r="2"/><path d="M12 14v6"/>'),
  torso: svg('<path d="M7 5h10M7 19h10"/><path d="M8 5l-1 14M12 5v14M16 5l1 14"/>'),
  arms: svg('<path d="M9 3v9a4 4 0 0 0 8 0v-2"/><path d="M14 10l3 0"/>'),
  legs: svg('<path d="M9 3l3 8-4 9"/><path d="M8 20h3"/><path d="M15 3l-1 8 3 9"/><path d="M16 20h3"/>'),
}
const PUSH_HOLD_MS = 180

/** What the run tells the button after a press: start the cooldown, stay live, or nothing happened. */
export type FireResult = Pick<CastResult, 'cooldown'>

interface ButtonState {
  el: HTMLElement
  cdEl: HTMLElement
  slot: SlotName
  /** Null: nothing found for this slot yet. The button sits dark and does nothing. */
  def: AbilityDef | null
  /** Which of the part's icons is showing (Frayed's width, Plumb's snap). Null is the base icon. */
  icon: IconState | null
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
  /** One listener: the run casts the part and answers how the button should react. */
  onFire: (cb: (def: AbilityDef, pushed: boolean) => FireResult) => void
  /** The parts on Still right now; empty slots are left out. */
  readonly loadout: readonly AbilityDef[]
  /** All four slots in button order, empty ones as null. */
  readonly slots: readonly { slot: SlotName; def: AbilityDef | null }[]
  /**
   * Put a part on its slot's button and return the one it replaced, or null if the
   * slot was empty. The new part inherits the slot's cooldown as a fraction, so
   * swapping never resets anything.
   */
  equip: (def: AbilityDef) => AbilityDef | null
  /** A new run: these parts on their buttons, every other slot empty. */
  resetLoadout: (parts: readonly AbilityDef[]) => void
  /** The boss's health across the top. Null hides it. */
  bossBar: (b: { name: string; frac: number; overloaded: boolean; stunned: boolean } | null) => void
  /** A generic prompt in the card's place (shrines). Null hides it. */
  prompt: (p: { title: string; line: string; action: string } | null) => void
  onPrompt: (cb: () => void) => void
  /** The pickup card. Null hides it. */
  offer: (incoming: AbilityDef | null) => void
  onTake: (cb: () => void) => void
  onCompare: (cb: () => void) => void
  onPause: (cb: () => void) => void
  /** A slow fill on the HP meter, so a quiet's refill is seen, not just counted. */
  healing: () => void
  /**
   * LIVE: something of this part's is out in the world (a window, a decoy, an
   * anchor). A lit ring drains clockwise, 1 → 0, and the cooldown sweep hides
   * under it. Null clears it.
   */
  live: (slot: SlotName, frac: number | null) => void
  /** Swap a button to one of its part's alternate icons, or back (null). Repaints only on change. */
  iconState: (slot: SlotName, s: IconState | null) => void
  /** 0..1 into the button's `.charge` fill (Patient Lens). */
  charge: (slot: SlotName, c: number) => void
  /** A short pulse on one button: something about it just changed. */
  pulse: (slot: SlotName) => void
  /** Dev only: the path a tap (false) or a push (true) takes once the gesture is recognised. */
  fireSlot: (slot: SlotName, pushed: boolean) => void
  /** Dev only: hold the stick at a world direction (0, 0 lets go). */
  setStick: (x: number, z: number) => void
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
    <div id="bossBar"><b></b><div class="track"><i></i></div></div>
    <div id="prompt">
      <div class="info"><b class="name"></b><p class="line"></p></div>
      <div class="choices"><button type="button" class="take"></button></div>
    </div>
    <button type="button" id="pauseBtn" aria-label="pause"><i></i><i></i></button>
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

  const promptEl = root.querySelector<HTMLElement>('#prompt')!
  const promptListeners: (() => void)[] = []
  promptEl.querySelector('.take')!.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (state.enabled && promptEl.classList.contains('show')) for (const cb of promptListeners) cb()
  })

  const KEYS: Record<SlotName, string> = { head: 'H', torso: 'T', arms: 'A', legs: 'L' }
  const paint = (b: ButtonState) => {
    b.el.className = b.def ? `btn tier-${b.def.tier}` : 'btn empty'
    b.icon = null
    b.el.querySelector('.lbl')!.innerHTML = b.def ? svg(b.def.icon) : SLOT_ICON[b.slot]
    // the price of every cast, printed on the rim before you press it: ● always, ○ when it depends
    const pips = b.def?.pips
    b.el.querySelector('.pips')!.textContent = pips ? (pips.hollow ? '\u25cb' : '\u25cf').repeat(pips.n) : ''
  }
  const buttons: ButtonState[] = SLOT_NAMES.map((slot, i) => {
    const el = document.createElement('div')
    el.innerHTML = `<div class="cd"></div><div class="live"></div><span class="lbl" aria-label="${KEYS[slot]}"></span><span class="pips"></span>`
    const th = (ARC_DEG[i] ?? 0) * (Math.PI / 180)
    el.style.right = `calc(env(safe-area-inset-right, 0px) + ${PAD + ARC_R * Math.cos(th) - BTN / 2}px)`
    el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${PAD + ARC_R * Math.sin(th) - BTN / 2}px)`
    root.appendChild(el)
    const b: ButtonState = { el, cdEl: el.querySelector<HTMLElement>('.cd')!, slot, def: null, icon: null, readyAt: 0, pointerId: null, downAt: 0, pushed: false }
    paint(b)
    return b
  })

  const listeners: ((def: AbilityDef, pushed: boolean) => FireResult)[] = []

  /**
   * N8b: ticks on the strain meter where a part changes with strain (Frayed
   * Cleaver's 6 and 12), drawn only while such a part is on a button.
   */
  const drawNotches = () => {
    const at = new Set<number>()
    for (const b of buttons) if (b.def?.mod?.kind === 'fray') for (const n of b.def.mod.at) at.add(n)
    strainMeter.querySelectorAll('.notch').forEach((n) => n.remove())
    for (const n of at) {
      const tick = document.createElement('s')
      tick.className = 'notch'
      tick.style.left = `${(n / 20) * 100}%`
      strainMeter.appendChild(tick)
    }
  }
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
    if (!state.enabled || !b.def) return
    const r = listeners[0]?.(b.def, pushed) ?? { cooldown: 'start' }
    if (r.cooldown === 'refused') {
      // nothing happened, and the button says so
      b.el.classList.add('refused')
      setTimeout(() => b.el.classList.remove('refused'), 300)
      return
    }
    // a live part (a planted anchor) keeps its button ready for the second press
    b.readyAt = r.cooldown === 'hold' ? state.clock : state.clock + b.def.cooldownMs
    navigator.vibrate?.(pushed ? [14, 26, 14] : 12)
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
        if (!b.def) continue
        const left = b.readyAt - now
        const ready = left <= 0
        b.el.classList.toggle('ready', ready)
        b.cdEl.style.setProperty('--sweep', ready ? '0deg' : `${Math.min(360, (left / b.def.cooldownMs) * 360)}deg`)

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

    get loadout() { return buttons.flatMap((b) => (b.def ? [b.def] : [])) },
    get slots() { return buttons.map((b) => ({ slot: b.slot, def: b.def })) },

    equip(def) {
      const b = buttons.find((x) => x.slot === def.slot)!
      const old = b.def
      const now = state.clock
      // a filled slot keeps its cooldown fraction; a newly filled one arrives ready
      const frac = old ? Math.max(0, b.readyAt - now) / old.cooldownMs : 0
      b.def = def
      b.readyAt = now + frac * def.cooldownMs
      paint(b)
      drawNotches()
      b.el.classList.add('swapped')
      setTimeout(() => b.el.classList.remove('swapped'), 450)
      return old
    },

    resetLoadout(parts) {
      for (const b of buttons) {
        b.def = parts.find((p) => p.slot === b.slot) ?? null
        b.readyAt = 0
        paint(b)
      }
      drawNotches()
    },

    bossBar(b) {
      const el = root.querySelector<HTMLElement>('#bossBar')!
      el.classList.toggle('show', !!b)
      if (!b) return
      el.querySelector('b')!.textContent = b.stunned ? `${b.name} \u2014 stunned` : b.name
      el.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, b.frac) * 100}%`
      el.classList.toggle('overloaded', b.overloaded)
      el.classList.toggle('stunned', b.stunned)
    },

    prompt(p) {
      promptEl.classList.toggle('show', !!p)
      if (!p) return
      promptEl.querySelector('.name')!.textContent = p.title
      promptEl.querySelector('.line')!.textContent = p.line
      promptEl.querySelector('.take')!.textContent = p.action
    },
    onPrompt(cb) { promptListeners.push(cb) },

    offer(incoming) {
      offered = incoming
      // the button that would change pulses, so "which slot" needs no reading
      for (const b of buttons) b.el.classList.toggle('target', !!incoming && b.slot === incoming.slot)
      if (!incoming) {
        offerEl.classList.remove('show')
        return
      }
      const current = buttons.find((b) => b.slot === incoming.slot)!.def
      offerSlot.textContent = SLOT_LABEL[incoming.slot]
      offerName.textContent = incoming.name
      offerName.style.color = TIER_CSS[incoming.tier]
      offerLine.textContent = incoming.line
      offerReplaces.textContent = current ? `replaces ${current.name}` : `fills the empty ${SLOT_LABEL[incoming.slot]} slot`
      offerEl.classList.add('show')
    },

    onTake(cb) { takeListeners.push(cb) },
    onCompare(cb) { compareListeners.push(cb) },
    onPause(cb) { pauseListeners.push(cb) },
    healing() {
      const meter = hpFill.parentElement!
      meter.classList.add('healing')
      setTimeout(() => meter.classList.remove('healing'), 1100)
    },

    live(slot, frac) {
      const b = buttons.find((x) => x.slot === slot)!
      const on = frac !== null && !!b.def
      if (on) b.el.style.setProperty('--live', `${Math.round(frac * 360)}deg`)
      if (b.el.classList.contains('live') !== on) b.el.classList.toggle('live', on)
    },
    iconState(slot, st) {
      const b = buttons.find((x) => x.slot === slot)!
      if (!b.def || b.icon === st) return
      b.icon = st
      b.el.querySelector('.lbl')!.innerHTML = svg((st && b.def.iconStates?.[st]) ?? b.def.icon)
    },
    charge(slot, c) {
      buttons.find((x) => x.slot === slot)!.el.style.setProperty('--charge', c.toFixed(3))
    },
    pulse(slot) {
      const el = buttons.find((x) => x.slot === slot)!.el
      el.classList.remove('pulse')
      void el.offsetWidth
      el.classList.add('pulse')
      setTimeout(() => el.classList.remove('pulse'), 400)
    },

    fireSlot(slot, pushed) {
      const b = buttons.find((x) => x.slot === slot)!
      const ready = state.clock >= b.readyAt
      // as the fingers would: a tap on a cooling button does nothing, and a hold on a ready one fires as a tap
      if (!ready && !pushed) return
      fire(b, pushed && !ready)
    },
    setStick(x, z) {
      state.moveX = x
      state.moveZ = z
    },
  }
}
