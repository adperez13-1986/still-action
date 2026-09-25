import type { ChooserSpec } from './workshop'
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
/** A dead tap's arc pulls back this fast; a second one within DEAD_TWICE_MS reaches further and holds. */
const DEAD_BACK_MS = 90
const DEAD_TWICE_MS = 500
const DEAD_HOLD_MS = 250
/** PLACEHOLDER words (Adrian's): once per save, over the first cooling button a tap is thrown at. */
const DEAD_CAPTION = 'hold to push'
/** PLACEHOLDER words (Adrian's): the one-time caption over the first button a lance ever heats. */
const HEAT_CAPTION = 'hot \u00b7 hold to push'
const HEAT_CAPTION_MS = 2400
/** PLACEHOLDER words (Adrian's): the break rule's one-time caption, over the first cooling button that could break a windup. */
const BREAK_CAPTION = 'hold \u00b7 break it'
/** Its own hint id, so a save that saw the old hints still gets this one. */
const BREAK_HINT = 'break'

/** What the run tells the button after a press: start the cooldown, stay live, or nothing happened. */
export type FireResult = Pick<CastResult, 'cooldown'>

/**
 * One press, down to up, for the playtest log. `ms` is wall time (a pause mid-press counts).
 * dead: released on a cooling button before the push fired. refused: the run said no.
 */
export interface Press { slot: SlotName; ms: number; ready: boolean; result: 'cast' | 'push' | 'dead' | 'refused' }

interface ButtonState {
  el: HTMLElement
  cdEl: HTMLElement
  slot: SlotName
  /** Null: nothing found for this slot yet. The button sits dark and does nothing. */
  def: AbilityDef | null
  /** Which of the part's icons is showing (Frayed's width, Plumb's snap). Null is the base icon. */
  icon: IconState | null
  readyAt: number
  /** Heat (the Arbiter's lance): push-only until this, whatever the cooldown says. A second timer, never a lock. */
  hotUntil: number
  hotMs: number
  pointerId: number | null
  downAt: number
  /** The press's own timestamp, for how long a tap really lasts. */
  downWall: number
  readyAtDown: boolean
  pushed: boolean
  /** The last dead tap (game ms), and the arc it drew: from this angle, held, then pulled back. */
  deadAt: number
  arc: { from: number; at: number; hold: number } | null
  /** Ready last frame: a part that just started recharging may owe its one-time push hint. */
  wasReady: boolean
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
  /** The break rule is on: the push hint waits for a breakable windup (breakHint), not a recharge. */
  breakRule: boolean
  /** `now` is game time in ms, not wall time: it stops while paused, and so do cooldowns. */
  update: (now: number) => void
  /** One listener: the run casts the part and answers how the button should react. */
  onFire: (cb: (def: AbilityDef, pushed: boolean) => FireResult) => void
  /** Every press on a filled button, once it's let go: the run counts dead taps and logs how long taps last. */
  onPress: (cb: (p: Press) => void) => void
  /** The parts on Still right now; empty slots are left out. */
  readonly loadout: readonly AbilityDef[]
  /** All four slots in button order, empty ones as null. */
  readonly slots: readonly { slot: SlotName; def: AbilityDef | null }[]
  /**
   * Put a part on its slot's button and return the one it replaced, or null if the
   * slot was empty. The new part inherits the slot's cooldown as a fraction, so
   * swapping never resets anything.
   */
  equip: (def: AbilityDef, forceFrac?: number) => AbilityDef | null
  /** Start a slot's full cooldown now (an anchor that faded). */
  startCooldown: (slot: SlotName) => void
  /** A state class on one button: 'far' dims the snap when the anchor is out of reach. */
  setClass: (slot: SlotName, cls: 'far', on: boolean) => void
  /** N10: the last moments' damage as a pale segment trailing the integrity fill, 0..1 of the bar. */
  recentDamage: (frac: number) => void
  /** A new run: these parts on their buttons, every other slot empty. */
  resetLoadout: (parts: readonly AbilityDef[]) => void
  /** The boss's health across the top. Null hides it. */
  /** `open`: its ×1.5 window, named on the bar by `openWord` ('stunned'). */
  bossBar: (b: { name: string; frac: number; phase2: boolean; open: boolean; openWord: string } | null) => void
  /**
   * A road's name over its beam (the crossroads, and the alternate's dressed yard beam):
   * the elite-name label's element and style. `at` is the screen point (px) under the name;
   * null takes the label away. `alpha` fades it with distance.
   */
  beamLabel: (id: string, text: string, at: { x: number; y: number } | null, alpha: number) => void
  /** The road labels showing now, for checks. */
  readonly beamLabels: readonly { id: string; text: string; alpha: number }[]
  /** A generic prompt in the card's place (shrines, the Workshop's things). Null hides it; a null action hides its button. */
  prompt: (p: { title: string; line: string; action: string | null } | null) => void
  /**
   * run: the fight's HUD. workshop and walk: the stick, the prompt and the chips only;
   * no ability buttons, meters or pause, so nothing there can cost strain.
   */
  mode: (m: 'run' | 'workshop' | 'walk') => void
  /** The Workshop's card for the wall and the hook: a row of parts, the one picked, one action. Null hides it. */
  chooser: (c: ChooserSpec | null) => void
  /** A part's icon tapped on the chooser. */
  onChoose: (cb: (id: string) => void) => void
  /** The chooser's action (turn to the wall, turn back, hang it). */
  onChooserAction: (cb: () => void) => void
  onPrompt: (cb: () => void) => void
  /** The pickup card. Null hides it. `fresh`: never found before, and the card says so. */
  offer: (incoming: AbilityDef | null, fresh?: boolean, past?: { name: string; history: string | null }) => void
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
  /** Whether a slot's button is ready to fire (not cooling, not hot). An empty slot is never ready. */
  isReady: (slot: SlotName) => boolean
  /** ms until a slot's cooldown is done (0 when it is): for picking what the heat takes. */
  readyIn: (slot: SlotName) => number
  /**
   * Heat a slot: push-only for `ms`. INV: never makes a push impossible (a hold past the push
   * time fires it, +2 strain), never touches an empty slot, and waiting frees it.
   */
  heat: (slot: SlotName, ms: number) => void
  /** ms of heat left (0 when cool). */
  heatLeft: (slot: SlotName) => number
  /**
   * N8: `n` strain points fly as ember pips from a screen point to the meter (at
   * most 4 drawn; the last carries the rest). The meter shows strain minus what's
   * still in the air, so the fill steps as each lands. The logic value is already
   * final: a stop starts on time.
   */
  strainPips: (n: number, from: { x: number; y: number }) => void
  /** A button's centre on screen, for pips that leave from it. */
  buttonPoint: (slot: SlotName) => { x: number; y: number }
  /**
   * The free push, drawn: while a fight is awake, a cold tick at the strain it began at and a
   * hollow segment `width` points above it, what the coming quiet pays back. Null clears both.
   */
  freePush: (w: { from: number; width: number } | null) => void
  /** 0..1 into the button's `.charge` fill (Patient Lens). */
  charge: (slot: SlotName, c: number) => void
  /** A short pulse on one button: something about it just changed. */
  pulse: (slot: SlotName) => void
  /**
   * The break rule's push hint, once per save: this cooling button could break the windup
   * that just started. The pulse and a caption over it. False if it was shown before.
   */
  breakHint: (slot: SlotName) => boolean
  /** Dev only: the path a tap (false) or a push (true) takes once the gesture is recognised. */
  fireSlot: (slot: SlotName, pushed: boolean) => void
  /** Dev only: hold the stick at a world direction (0, 0 lets go). */
  setStick: (x: number, z: number) => void
}

const TIER_CSS = { white: 'var(--tier-white)', blue: 'var(--tier-blue)', gold: 'var(--tier-gold)' }
const SLOT_LABEL = { head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs' }

/** Where the push hints are remembered: the save, so a hint is shown once per save, not per session. */
export interface HintStore {
  hinted: (id: string) => boolean
  markHinted: (id: string) => void
}

export function createHud(root: HTMLElement, hints: HintStore): Hud {
  root.innerHTML = `
    <div id="stickZone"></div>
    <div id="stickBase"><div id="stickKnob"></div></div>
    <div class="meter" id="strain"><i style="width:0%"></i><b>STRAIN</b></div>
    <div id="strainFree"><s class="water"></s></div>
    <div class="meter" id="hp"><u></u><i style="width:100%"></i><b>INTEGRITY</b></div>
    <div id="offer">
      <div class="info">
        <div class="head"><span class="slot"></span><b class="name"></b><span class="new">new</span></div>
        <p class="line"></p>
        <p class="hist"></p>
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
    <div id="chooser">
      <b class="title"></b>
      <div class="items"></div>
      <div class="detail">
        <div class="info"><b class="name"></b><p class="line"></p><p class="note"></p></div>
        <button type="button" class="act"></button>
      </div>
    </div>
    <button type="button" id="pauseBtn" aria-label="pause"><i></i><i></i></button>
  `

  // the road labels: the elite names' layer and look, made on first use
  const beamEls = new Map<string, HTMLElement>()
  let beamRoot: HTMLElement | null = null
  const beamLayer = () => {
    if (!beamRoot) {
      beamRoot = document.createElement('div')
      beamRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:3'
      root.appendChild(beamRoot)
    }
    return beamRoot
  }
  const zone = root.querySelector<HTMLElement>('#stickZone')!
  const base = root.querySelector<HTMLElement>('#stickBase')!
  const knob = root.querySelector<HTMLElement>('#stickKnob')!
  const strainMeter = root.querySelector<HTMLElement>('#strain')!
  const strainFill = strainMeter.querySelector<HTMLElement>('i')!
  /** Over the meter, not in it: the meter clips, and the segment stands a pixel proud of the bar. */
  const freeEl = root.querySelector<HTMLElement>('#strainFree')!
  const waterEl = freeEl.querySelector<HTMLElement>('.water')!
  let free: { from: number; width: number } | null = null
  let freeCells: HTMLElement[] = []
  const hpFill = root.querySelector<HTMLElement>('#hp i')!
  /** N10's pale segment: what a rewind would give back, sitting just past the fill. */
  const hpGhost = root.querySelector<HTMLElement>('#hp u')!
  let recent = 0
  const offerEl = root.querySelector<HTMLElement>('#offer')!
  const offerSlot = offerEl.querySelector<HTMLElement>('.slot')!
  const offerName = offerEl.querySelector<HTMLElement>('.name')!
  const offerLine = offerEl.querySelector<HTMLElement>('.line')!
  const offerReplaces = offerEl.querySelector<HTMLElement>('.replaces')!
  const offerNew = offerEl.querySelector<HTMLElement>('.new')!
  const offerHist = offerEl.querySelector<HTMLElement>('.hist')!
  const chooserEl = root.querySelector<HTMLElement>('#chooser')!
  const chooseListeners: ((id: string) => void)[] = []
  const chooserActListeners: (() => void)[] = []
  chooserEl.addEventListener('pointerdown', (e) => {
    const t = e.target as HTMLElement
    const item = t.closest<HTMLElement>('.item')
    if (item?.dataset.id) for (const cb of chooseListeners) cb(item.dataset.id)
    if (t.closest('.act')) for (const cb of chooserActListeners) cb()
  })
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
    // the price of every cast, printed on the rim before you press it: ● always, ○ when it depends.
    // The push's own price sits beside it, shown only while a press would push.
    const pips = b.def?.pips
    const own = pips ? `<i class="${pips.hollow ? 'h' : 'f'}"></i>`.repeat(pips.n) : ''
    b.el.querySelector('.pips')!.innerHTML = b.def ? `${own ? `<span>${own}</span>` : ''}<span class="owed"><i class="h"></i><i class="h"></i></span>` : ''
  }
  const buttons: ButtonState[] = SLOT_NAMES.map((slot, i) => {
    const el = document.createElement('div')
    el.innerHTML = `<div class="cd"></div><div class="heat"></div><div class="live"></div><div class="arm"></div><span class="lbl" aria-label="${KEYS[slot]}"></span><span class="pips"></span>`
    const th = (ARC_DEG[i] ?? 0) * (Math.PI / 180)
    el.style.right = `calc(env(safe-area-inset-right, 0px) + ${PAD + ARC_R * Math.cos(th) - BTN / 2}px)`
    el.style.bottom = `calc(env(safe-area-inset-bottom, 0px) + ${PAD + ARC_R * Math.sin(th) - BTN / 2}px)`
    root.appendChild(el)
    const b: ButtonState = { el, cdEl: el.querySelector<HTMLElement>('.cd')!, slot, def: null, icon: null, readyAt: 0, hotUntil: 0, hotMs: 0, pointerId: null, downAt: 0, downWall: 0, readyAtDown: true, pushed: false, deadAt: -Infinity, arc: null, wasReady: true }
    paint(b)
    return b
  })

  const listeners: ((def: AbilityDef, pushed: boolean) => FireResult)[] = []
  const pressListeners: ((p: Press) => void)[] = []

  /** Strain points still in the air as pips. The meter shows strain minus these. */
  let pending = 0
  const PIP_MS = 350
  const PIP_GAP_MS = 60
  const PIPS_SHOWN = 4

  /** One ember pip from a screen point to the meter's fill. When it lands, `worth` points step in. */
  function flyPip(from: { x: number; y: number }, worth: number) {
    const el = document.createElement('div')
    el.className = 'pip'
    el.style.left = `${from.x}px`
    el.style.top = `${from.y}px`
    root.appendChild(el)
    const r = strainMeter.getBoundingClientRect()
    const shown = Math.max(0, state.strain - pending)
    const tx = r.left + r.width * Math.min(1, (shown + worth) / 20)
    const ty = r.top + r.height / 2
    const land = () => {
      el.remove()
      pending = Math.max(0, pending - worth)
      // the meter takes it: a 1 px bump as the fill steps
      strainMeter.classList.remove('bump')
      void strainMeter.offsetWidth
      strainMeter.classList.add('bump')
    }
    if (!el.animate) return land()
    const a = el.animate(
      [{ transform: 'translate(-50%, -50%)' }, { transform: `translate(calc(${tx - from.x}px - 50%), calc(${ty - from.y}px - 50%))` }],
      { duration: PIP_MS, easing: 'ease-in', fill: 'forwards' },
    )
    a.onfinish = land
    a.oncancel = land
  }

  /** Once per save, a push-shaped part's pushed half pulses the first time it starts recharging. */
  const { hinted, markHinted } = hints

  /** A one-time caption over a button, kept on screen whichever edge the button sits against. */
  const caption = (b: ButtonState, text: string) => {
    const cap = document.createElement('div')
    cap.className = 'heatCaption'
    cap.textContent = text
    b.el.appendChild(cap)
    const r = cap.getBoundingClientRect()
    const shift = Math.min(0, window.innerWidth - 8 - r.right) + Math.max(0, 8 - r.left)
    if (shift) cap.style.transform = `translateX(${shift}px)`
    setTimeout(() => cap.remove(), HEAT_CAPTION_MS)
  }

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
  const state = { moveX: 0, moveZ: 0, strain: 0, integrity: 1, enabled: true, clock: 0, breakRule: false }

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
      b.downWall = e.timeStamp
      b.readyAtDown = isReadyAt(b, state.clock)
      b.pushed = false
      // the hold ring takes over from any dead-tap arc still pulling back
      b.arc = null
      b.el.classList.add('press')
    })
    for (const t of ['pointerup', 'pointercancel'] as const) {
      b.el.addEventListener(t, (e) => {
        if (b.pointerId !== e.pointerId) return
        b.pointerId = null
        b.el.classList.remove('press')
        let result: Press['result']
        if (b.pushed) result = 'push'
        else if (isReadyAt(b, state.clock)) result = fire(b, false) ? 'cast' : 'refused'
        else {
          // a tap thrown at a cooling button: never a push, but it answers
          result = 'dead'
          if (b.def && state.enabled) deadTap(b)
        }
        if (!b.def || !state.enabled) return
        const p: Press = { slot: b.slot, ms: e.timeStamp - b.downWall, ready: b.readyAtDown, result }
        for (const cb of pressListeners) cb(p)
      })
    }
  }

  /**
   * The dead tap answers: the ember arc jumps round the rim (at least as far as the hold got)
   * and pulls back. A second within 500 ms reaches two thirds and holds, the push almost there.
   */
  function deadTap(b: ButtonState) {
    const now = state.clock
    const twice = now - b.deadAt <= DEAD_TWICE_MS
    b.deadAt = now
    const held = Math.min(360, ((now - b.downAt) / PUSH_HOLD_MS) * 360)
    b.arc = { from: Math.max(held, twice ? 240 : 120), at: now, hold: twice ? DEAD_HOLD_MS : 0 }
    if (!hinted('deadtap')) {
      markHinted('deadtap')
      caption(b, DEAD_CAPTION)
    }
  }

  /** Ready: its cooldown done, and not hot. */
  const isReadyAt = (b: ButtonState, now: number) => now >= b.readyAt && now >= b.hotUntil

  /** True if it cast. */
  function fire(b: ButtonState, pushed: boolean): boolean {
    if (!state.enabled || !b.def) return false
    const r = listeners[0]?.(b.def, pushed) ?? { cooldown: 'start' }
    if (r.cooldown === 'refused') {
      // nothing happened, and the button says so
      b.el.classList.add('refused')
      setTimeout(() => b.el.classList.remove('refused'), 300)
      return false
    }
    // a live part (a planted anchor) keeps its button ready for the second press; a hot one
    // pushed out of its heat still waits the heat out before it's ready again
    b.readyAt = Math.max(r.cooldown === 'hold' ? state.clock : state.clock + b.def.cooldownMs, b.hotUntil)
    navigator.vibrate?.(pushed ? [14, 26, 14] : 12)
    return true
  }

  return {
    get moveX() { return state.moveX },
    get moveZ() { return state.moveZ },
    get strain() { return state.strain },
    set strain(v: number) { state.strain = v },
    get integrity() { return state.integrity },
    set integrity(v: number) { state.integrity = v },
    get breakRule() { return state.breakRule },
    set breakRule(v: boolean) { state.breakRule = v },
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
      let brink = false
      for (const b of buttons) {
        if (!b.def) continue
        const left = b.readyAt - now
        const ready = isReadyAt(b, now)
        // hot: an ember rim and its own sweep over the cooldown's, draining clockwise
        const hot = now < b.hotUntil
        b.el.classList.toggle('hot', hot)
        b.el.style.setProperty('--heat', hot ? `${Math.min(360, ((b.hotUntil - now) / Math.max(1, b.hotMs)) * 360)}deg` : '0deg')
        b.el.classList.toggle('ready', ready)
        b.cdEl.style.setProperty('--sweep', left <= 0 ? '0deg' : `${Math.min(360, (left / b.def.cooldownMs) * 360)}deg`)
        const pushShaped = b.def.mod?.kind === 'overrun' || b.def.mod?.kind === 'charge'
        // under the break rule the hint waits for its reason instead (breakHint)
        if (!state.breakRule && b.wasReady && !ready && pushShaped && !hinted(b.def.id)) {
          // the button telling you, once, that holding it now does something different
          markHinted(b.def.id)
          b.el.classList.add('hint')
          setTimeout(() => b.el.classList.remove('hint'), 900)
        }
        b.wasReady = ready
        // the last push is honest: it still fires, but the rim goes dim and slow instead of bright
        const cost = (ready ? 0 : 2) + (b.def.strain ?? 0)
        const last = cost > 0 && state.strain + cost >= 20
        b.el.classList.toggle('last', last)
        if (last) brink = true

        const holding = b.pointerId !== null && now - b.downAt >= PUSH_HOLD_MS
        b.el.classList.toggle('pushable', !ready && holding)
        if (!ready && holding && !b.pushed) {
          b.pushed = true
          fire(b, true)
        }

        // the hold's clock: a ring closing over PUSH_HOLD_MS, the push firing as it closes.
        // Let go early and the dead-tap arc pulls back from where it got to.
        let arm = 0
        if (b.pointerId !== null && (b.pushed || !ready)) arm = b.pushed ? 360 : Math.min(360, ((now - b.downAt) / PUSH_HOLD_MS) * 360)
        else if (b.arc) {
          const t = now - b.arc.at - b.arc.hold
          if (t < DEAD_BACK_MS) arm = b.arc.from * Math.min(1, 1 - t / DEAD_BACK_MS)
          else b.arc = null
        }
        // at 0 the angle stays where it was, so the ring fades out whole rather than snapping empty
        if (arm > 0) b.el.style.setProperty('--arm', `${arm.toFixed(1)}deg`)
        if (b.el.classList.contains('arming') !== arm > 0) b.el.classList.toggle('arming', arm > 0)
      }
      const shown = Math.max(0, state.strain - pending)
      strainFill.style.width = `${Math.min(100, (shown / 20) * 100)}%`
      strainMeter.classList.toggle('high', shown >= 14)
      // the stretch a last push would fill, outlined: a warning, never a block
      strainMeter.classList.toggle('brink', brink)
      strainMeter.style.setProperty('--brink', `${Math.max(0, 20 - state.strain) * 5}%`)
      // the free push: its cells fill as the shown strain climbs through them
      if (free) for (let i = 0; i < freeCells.length; i++) freeCells[i]!.classList.toggle('full', shown >= free.from + i + 1 - 1e-6)
      hpFill.style.width = `${Math.max(0, state.integrity * 100)}%`
      hpGhost.style.left = `${Math.max(0, state.integrity * 100)}%`
      hpGhost.style.width = `${Math.max(0, Math.min(1 - state.integrity, recent)) * 100}%`
    },

    onFire(cb) { listeners.push(cb) },
    onPress(cb) { pressListeners.push(cb) },

    get loadout() { return buttons.flatMap((b) => (b.def ? [b.def] : [])) },
    get slots() { return buttons.map((b) => ({ slot: b.slot, def: b.def })) },

    equip(def, forceFrac) {
      const b = buttons.find((x) => x.slot === def.slot)!
      const old = b.def
      const now = state.clock
      // a filled slot keeps its cooldown fraction; a newly filled one arrives ready.
      // `forceFrac` overrides it: swapping out a live anchor hands on a full cooldown, not a free button.
      const frac = forceFrac ?? (old ? Math.max(0, b.readyAt - now) / old.cooldownMs : 0)
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
        b.hotUntil = 0
        paint(b)
      }
      drawNotches()
    },

    beamLabel(id, text, at, alpha) {
      let el = beamEls.get(id)
      if (!at || alpha <= 0) {
        el?.remove()
        beamEls.delete(id)
        return
      }
      if (!el) {
        el = document.createElement('div')
        el.className = 'elite named beam'
        el.appendChild(document.createElement('b'))
        beamLayer().appendChild(el)
        beamEls.set(id, el)
      }
      el.querySelector('b')!.textContent = text
      el.style.left = `${at.x}px`
      el.style.top = `${at.y}px`
      el.style.opacity = alpha.toFixed(3)
    },
    get beamLabels() {
      return [...beamEls].map(([id, el]) => ({ id, text: el.textContent ?? '', alpha: Number(el.style.opacity) }))
    },

    bossBar(b) {
      const el = root.querySelector<HTMLElement>('#bossBar')!
      el.classList.toggle('show', !!b)
      if (!b) return
      el.querySelector('b')!.textContent = b.open ? `${b.name} \u2014 ${b.openWord}` : b.name
      el.querySelector<HTMLElement>('i')!.style.width = `${Math.max(0, b.frac) * 100}%`
      el.classList.toggle('phase2', b.phase2)
      el.classList.toggle('open', b.open)
    },

    prompt(p) {
      promptEl.classList.toggle('show', !!p)
      if (!p) return
      promptEl.querySelector('.name')!.textContent = p.title
      promptEl.querySelector('.line')!.textContent = p.line
      const act = promptEl.querySelector<HTMLElement>('.take')!
      act.textContent = p.action ?? ''
      act.style.display = p.action === null ? 'none' : ''
    },
    mode(m) {
      root.dataset.mode = m
    },
    chooser(c) {
      chooserEl.classList.toggle('show', !!c)
      if (!c) return
      chooserEl.querySelector('.title')!.textContent = c.title
      chooserEl.querySelector('.items')!.innerHTML = c.items.map((it) =>
        `<button type="button" class="item ${it.state} tier-${it.tier}${it.id === c.selected ? ' sel' : ''}" data-id="${it.id}">${svg(it.icon)}</button>`).join('')
      const d = c.detail
      const nameEl = chooserEl.querySelector<HTMLElement>('.name')!
      nameEl.textContent = d?.name ?? ''
      nameEl.style.color = d?.tier ? TIER_CSS[d.tier] : ''
      chooserEl.querySelector('.line')!.textContent = d?.line ?? ''
      chooserEl.querySelector('.note')!.textContent = [d?.history, d?.note].filter(Boolean).join(' \u00b7 ')
      const act = chooserEl.querySelector<HTMLElement>('.act')!
      act.textContent = c.action ?? ''
      act.style.display = c.action ? '' : 'none'
    },
    onChoose(cb) { chooseListeners.push(cb) },
    onChooserAction(cb) { chooserActListeners.push(cb) },
    onPrompt(cb) { promptListeners.push(cb) },

    offer(incoming, fresh = false, past) {
      offered = incoming
      offerNew.style.display = incoming && fresh ? '' : 'none'
      // the button that would change pulses, so "which slot" needs no reading
      for (const b of buttons) b.el.classList.toggle('target', !!incoming && b.slot === incoming.slot)
      if (!incoming) {
        offerEl.classList.remove('show')
        return
      }
      const current = buttons.find((b) => b.slot === incoming.slot)!.def
      offerSlot.textContent = SLOT_LABEL[incoming.slot]
      offerName.textContent = past?.name ?? incoming.name
      offerHist.textContent = past?.history ?? ''
      offerHist.style.display = past?.history ? '' : 'none'
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
    startCooldown(slot) {
      const b = buttons.find((x) => x.slot === slot)!
      if (b.def) b.readyAt = state.clock + b.def.cooldownMs
    },
    setClass(slot, cls, on) {
      const el = buttons.find((x) => x.slot === slot)!.el
      if (el.classList.contains(cls) !== on) el.classList.toggle(cls, on)
    },
    recentDamage(frac) {
      recent = frac
    },
    strainPips(n, from) {
      if (n <= 0) return
      pending += n
      const shown = Math.min(n, PIPS_SHOWN)
      for (let i = 0; i < shown; i++) {
        const worth = i === shown - 1 ? n - (shown - 1) : 1
        setTimeout(() => flyPip(from, worth), i * PIP_GAP_MS)
      }
    },
    freePush(w) {
      const next = w ? { from: w.from, width: Math.max(0, Math.min(w.width, 20 - w.from)) } : null
      if (next?.from === free?.from && next?.width === free?.width) return
      free = next
      freeEl.classList.toggle('show', !!next)
      if (!next) return
      for (const c of freeCells) c.remove()
      freeCells = Array.from({ length: Math.ceil(next.width) }, (_, i) => {
        const c = document.createElement('em')
        // a 1 px gap between cells, so it reads as two points, not a bar
        c.style.left = `calc(${((next.from + i) / 20) * 100}% + .5px)`
        c.style.width = `calc(${(Math.min(1, next.width - i) / 20) * 100}% - 1px)`
        freeEl.appendChild(c)
        return c
      })
      // strain 0: no tick, the outline alone at the bar's start
      waterEl.style.left = `${(next.from / 20) * 100}%`
      waterEl.style.display = next.from > 0 ? '' : 'none'
    },
    buttonPoint(slot) {
      const r = buttons.find((x) => x.slot === slot)!.el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    },
    isReady(slot) {
      const b = buttons.find((x) => x.slot === slot)!
      return !!b.def && isReadyAt(b, state.clock)
    },
    readyIn(slot) {
      const b = buttons.find((x) => x.slot === slot)!
      return Math.max(0, b.readyAt - state.clock)
    },
    heat(slot, ms) {
      const b = buttons.find((x) => x.slot === slot)!
      if (!b.def) return
      b.hotUntil = state.clock + ms
      b.hotMs = ms
      if (!hinted('heat')) {
        // the first heat ever: a caption over the button, once per save
        markHinted('heat')
        caption(b, HEAT_CAPTION)
      }
    },
    heatLeft(slot) {
      const b = buttons.find((x) => x.slot === slot)!
      return Math.max(0, b.hotUntil - state.clock)
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
    breakHint(slot) {
      const b = buttons.find((x) => x.slot === slot)!
      if (!b.def || hinted(BREAK_HINT)) return false
      markHinted(BREAK_HINT)
      // any part can break, so the whole button pulses, not a push-shaped icon's half
      b.el.classList.remove('pulse')
      void b.el.offsetWidth
      b.el.classList.add('pulse')
      setTimeout(() => b.el.classList.remove('pulse'), 400)
      caption(b, BREAK_CAPTION)
      return true
    },

    fireSlot(slot, pushed) {
      const b = buttons.find((x) => x.slot === slot)!
      const ready = isReadyAt(b, state.clock)
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
