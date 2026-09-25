import type { AbilityDef, AbilityShape } from './abilities'
import type { SlotName } from './still'

/**
 * The pause screen. Two modes, one layout language:
 *   loadout  — the four parts on Still right now, and what each one does
 *   compare  — the part on the floor next to the one it would replace
 *
 * Differences are marked, never judged: a tier is "different", not "better",
 * so there is no green-good / red-bad here.
 */
const SLOT_LABEL = { head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs' }
const REACH_LABEL: Record<AbilityShape, string> = {
  bolt: 'range', lob: 'range', nova: 'radius', ward: 'radius', decoy: 'radius', arc: 'reach',
  grab: 'reach', catch: 'radius', dash: 'distance', hop: 'distance', anchor: 'snap', rewind: 'rewind',
}

/** The one distance worth comparing: a blast's size, a rewind's length, otherwise how far it goes. */
function reach(d: AbilityDef) {
  if (d.shape === 'nova' || d.shape === 'ward' || d.shape === 'decoy' || d.shape === 'catch') return d.radius
  if (d.shape === 'rewind') return (d.windowMs ?? 0) / 1000
  return d.range
}

/** What a part's damage reads as on its card: a range for the charge, a count for the fan, both halves for Overrun. */
function damageLabel(d: AbilityDef): string {
  const m = d.mod
  if (m?.kind === 'charge') return `${m.minDamage}\u2013${d.damage}`
  if (m?.kind === 'fan') return `${d.damage} \u00d7${m.count}`
  if (m?.kind === 'overrun') return `${d.damage} / ${m.damage} held`
  if (d.shape === 'ward' || d.shape === 'rewind' || d.shape === 'hop') return '\u2013'
  return String(d.damage)
}

/**
 * Anti-synergies (translator §7): one muted line under the incoming card when it
 * would work against something already on Still. Only here, where the game is paused.
 */
const CONFLICTS: { a: string; b: string; line: string }[] = [
  { a: 'lure', b: 'anvil', line: 'Your decoy will draw the blows Anvil needs to catch.' },
  { a: 'brace', b: 'anvil', line: 'Anvil catches the blow first; Brace only matters for shots.' },
  { a: 'frost-trail', b: 'backdraft-vent', line: 'The vent drags them past your cold track.' },
]

function conflictLine(incoming: AbilityDef, equipped: readonly AbilityDef[]): string | null {
  const on = new Set(equipped.filter((p) => p.slot !== incoming.slot).map((p) => p.id))
  for (const c of CONFLICTS) {
    if ((incoming.id === c.a && on.has(c.b)) || (incoming.id === c.b && on.has(c.a))) return c.line
  }
  return null
}

function stats(d: AbilityDef, other?: AbilityDef) {
  const row = (label: string, value: string, changed: boolean) =>
    `<div class="stat${changed ? ' changed' : ''}"><span>${label}</span><b>${value}</b></div>`
  return [
    row('cooldown', `${(d.cooldownMs / 1000).toFixed(1)}s`, !!other && other.cooldownMs !== d.cooldownMs),
    row('damage', damageLabel(d), !!other && damageLabel(other) !== damageLabel(d)),
    row(REACH_LABEL[d.shape], String(reach(d)), !!other && reach(other) !== reach(d)),
  ].join('')
}

/** What a part is called now, and its past (parts remember): set by main from the save. */
let describe: (d: AbilityDef) => { name: string; history: string | null } = (d) => ({ name: d.name, history: null })

function card(d: AbilityDef, tag: string, other?: AbilityDef, conflict?: string | null, fresh = false) {
  const past = describe(d)
  // the price on every cast, the same pips the button carries, so the card and the button agree
  const pips = d.pips ? ` <span class="ppips">${(d.pips.hollow ? '\u25cb' : '\u25cf').repeat(d.pips.n)}</span>` : ''
  return `
    <div class="pcard tier-${d.tier}">
      <div class="tag">${tag}${fresh ? ' <span class="new">new</span>' : ''}</div>
      <div class="pname">${past.name}${pips}</div>
      <p class="pline">${d.line}</p>
      ${past.history ? `<p class="pline phist">${past.history}</p>` : ''}
      <div class="stats">${stats(d, other)}</div>
      ${conflict ? `<p class="pconflict">${conflict}</p>` : ''}
    </div>`
}

function emptyCard(slot: SlotName, tag: string) {
  return `
    <div class="pcard empty">
      <div class="tag">${tag}</div>
      <div class="pname">nothing yet</div>
      <p class="pline">Still hasn't found a ${SLOT_LABEL[slot].toLowerCase()} part. This button does nothing until it does.</p>
    </div>`
}

export interface PauseScreen {
  readonly open: boolean
  loadout: (slots: readonly { slot: SlotName; def: AbilityDef | null }[], onResume: () => void) => void
  /** `equipped` is everything on Still, for the conflict line under the incoming card. */
  /** `fresh`: the incoming part has never been found, and its card says so. */
  compare: (
    current: AbilityDef | null, incoming: AbilityDef, equipped: readonly AbilityDef[], onTake: () => void, onLeave: () => void, fresh?: boolean,
  ) => void
  /**
   * The look-back screen: every run's card, large, newest first, with the arrows to
   * page through them and close. `render` draws card i (0 is the newest).
   */
  lookBack: (count: number, render: (i: number) => Promise<HTMLCanvasElement>, onClose: () => void) => void
  /** The notebook: its pages, one at a time, and close. */
  notebook: (pages: NotebookPage[], onClose: () => void) => void
  /** How part cards name a part and tell its past. */
  setDescribe: (fn: (d: AbilityDef) => { name: string; history: string | null }) => void
  hide: () => void
}

/** A notebook page, laid out (main builds these from the save and the roster). */
export interface NotebookPage { name: string; what: string; line: string | null; facts: string; leaders: string | null }

export function createPauseScreen(root: HTMLElement): PauseScreen {
  const el = document.createElement('div')
  el.id = 'pause'
  root.appendChild(el)
  let isOpen = false

  function show(html: string, actions: [string, string, () => void][]) {
    el.innerHTML = `${html}<div class="actions">${actions.map(([cls, label]) => `<button type="button" class="${cls}">${label}</button>`).join('')}</div>`
    for (const [cls, , cb] of actions) el.querySelector(`.${cls}`)!.addEventListener('click', cb)
    el.classList.add('show')
    isOpen = true
  }

  return {
    get open() { return isOpen },

    loadout(slots, onResume) {
      show(
        `<h2>Paused</h2><div class="row four">${slots.map((s) => (s.def ? card(s.def, SLOT_LABEL[s.slot]) : emptyCard(s.slot, SLOT_LABEL[s.slot]))).join('')}</div>`,
        [['resume', 'resume', onResume]],
      )
    },

    compare(current, incoming, equipped, onTake, onLeave, fresh = false) {
      show(
        `<h2>${SLOT_LABEL[incoming.slot]} slot</h2>
         <div class="row two">
           ${current ? card(current, 'on Still now', incoming) : emptyCard(incoming.slot, 'on Still now')}
           <div class="arrow">&rarr;</div>
           ${card(incoming, 'on the floor', current ?? undefined, conflictLine(incoming, equipped), fresh)}
         </div>`,
        [['leave', 'leave it', onLeave], ['take', 'take it', onTake]],
      )
    },

    lookBack(count, render, onClose) {
      let i = 0
      show(
        `<h2>The corkboard</h2>
         <div class="look">
           <button type="button" class="prev" aria-label="newer">&larr;</button>
           <div class="lcard"></div>
           <button type="button" class="next" aria-label="older">&rarr;</button>
         </div>
         <p class="lcount"></p>`,
        [['close', 'close', onClose]],
      )
      const slot = el.querySelector<HTMLElement>('.lcard')!
      const label = el.querySelector<HTMLElement>('.lcount')!
      const paint = async () => {
        const at = i
        label.textContent = `${count - at} of ${count}`
        const c = await render(at)
        // a page turned meanwhile: this one's too late
        if (at !== i || !isOpen) return
        slot.replaceChildren(c)
      }
      el.querySelector('.prev')!.addEventListener('click', () => {
        if (i > 0) i--
        void paint()
      })
      el.querySelector('.next')!.addEventListener('click', () => {
        if (i < count - 1) i++
        void paint()
      })
      void paint()
    },

    setDescribe(fn) {
      describe = fn
    },

    notebook(pages, onClose) {
      let i = 0
      show(
        `<h2>The notebook</h2>
         <div class="look">
           <button type="button" class="prev" aria-label="back">&larr;</button>
           <div class="npage"></div>
           <button type="button" class="next" aria-label="on">&rarr;</button>
         </div>
         <p class="lcount"></p>`,
        [['close', 'close', onClose]],
      )
      const slot = el.querySelector<HTMLElement>('.npage')!
      const label = el.querySelector<HTMLElement>('.lcount')!
      // one more page after the last: the book isn't full, and says so (PLACEHOLDER words)
      const n = pages.length + 1
      const paint = () => {
        label.textContent = `${i + 1} of ${n}`
        const p = pages[i]
        slot.innerHTML = p
          ? `<b class="nname">${p.name}</b>
             <p class="nwhat">${p.what}</p>
             ${p.line ? `<p class="nline">${p.line}</p>` : '<p class="nline blank"></p>'}
             <p class="nfacts">${p.facts}</p>
             ${p.leaders ? `<p class="nfacts">${p.leaders}</p>` : ''}`
          : '<p class="nend">Some pages are still blank.</p>'
      }
      el.querySelector('.prev')!.addEventListener('click', () => {
        if (i > 0) i--
        paint()
      })
      el.querySelector('.next')!.addEventListener('click', () => {
        if (i < n - 1) i++
        paint()
      })
      paint()
    },

    hide() {
      el.classList.remove('show')
      el.innerHTML = ''
      isOpen = false
    },
  }
}
