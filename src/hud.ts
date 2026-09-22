import { ABILITIES, type AbilityDef } from './abilities'

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
  strain: number
  integrity: number
  update: (now: number) => void
  onFire: (cb: (def: AbilityDef, pushed: boolean) => void) => void
}

export function createHud(root: HTMLElement): Hud {
  root.innerHTML = `
    <div id="stickZone"></div>
    <div id="stickBase"><div id="stickKnob"></div></div>
    <div class="meter" id="strain"><i style="width:15%"></i><b>STRAIN</b></div>
    <div class="meter" id="hp"><i style="width:100%"></i><b>INTEGRITY</b></div>
  `

  const zone = root.querySelector<HTMLElement>('#stickZone')!
  const base = root.querySelector<HTMLElement>('#stickBase')!
  const knob = root.querySelector<HTMLElement>('#stickKnob')!
  const strainFill = root.querySelector<HTMLElement>('#strain i')!
  const hpFill = root.querySelector<HTMLElement>('#hp i')!

  const buttons: ButtonState[] = ABILITIES.map((def, i) => {
    const el = document.createElement('div')
    el.className = 'btn ready'
    el.innerHTML = `<div class="cd"></div><span class="lbl">${def.key}</span>`
    const th = (ARC_DEG[i] ?? 0) * (Math.PI / 180)
    el.style.right = `calc(env(safe-area-inset-right, 0px) + ${PAD + ARC_R * Math.cos(th) - BTN / 2}px)`
    el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${PAD + ARC_R * Math.sin(th) - BTN / 2}px)`
    root.appendChild(el)
    return { el, cdEl: el.querySelector<HTMLElement>('.cd')!, def, readyAt: 0, pointerId: null, downAt: 0, pushed: false }
  })

  const listeners: ((def: AbilityDef, pushed: boolean) => void)[] = []
  const state = { moveX: 0, moveZ: 0, strain: 3, integrity: 1 }

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
      b.downAt = performance.now()
      b.pushed = false
      b.el.classList.add('press')
    })
    for (const t of ['pointerup', 'pointercancel'] as const) {
      b.el.addEventListener(t, (e) => {
        if (b.pointerId !== e.pointerId) return
        b.pointerId = null
        b.el.classList.remove('press')
        if (b.pushed) return
        if (performance.now() >= b.readyAt) fire(b, false)
      })
    }
  }

  function fire(b: ButtonState, pushed: boolean) {
    b.readyAt = performance.now() + b.def.cooldownMs
    if (pushed) {
      state.strain = Math.min(20, state.strain + 2)
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

    update(now: number) {
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
      hpFill.style.width = `${Math.max(0, state.integrity * 100)}%`
    },

    onFire(cb) { listeners.push(cb) },
  }
}
