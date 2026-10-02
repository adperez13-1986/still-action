import type { AbilityDef, AbilityShape } from './abilities'
import type { SlotName } from './still'
import * as sfx from './audio'

/**
 * The pause screen. Two modes, one layout language:
 *   loadout  — the four parts on Still right now, and what each one does
 *   compare  — the part on the floor (or a pedestal) next to the one it would replace
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

/**
 * The part as the next press will use it, for the numbers a card shows: main sets it (the "weight" trial, WEIGHT.md W3: with it on the
 * cards show weighed(def)'s damage and radius, because he picks parts on them; off, the def unchanged).
 */
let shown: (d: AbilityDef) => AbilityDef = (d) => d

function stats(def: AbilityDef, otherDef?: AbilityDef) {
  const d = shown(def)
  const other = otherDef && shown(otherDef)
  const row = (label: string, value: string, changed: boolean) =>
    `<div class="stat${changed ? ' changed' : ''}"><span>${label}</span><b>${value}</b></div>`
  return [
    row('cooldown', `${(d.cooldownMs / 1000).toFixed(1)}s`, !!other && other.cooldownMs !== d.cooldownMs),
    row('damage', damageLabel(d), !!other && damageLabel(other) !== damageLabel(d)),
    // one decimal: a weighed radius (6.02) reads like the rest (4.3); no unweighed reach has more
    row(REACH_LABEL[d.shape], String(typeof reach(d) === 'number' ? +(reach(d) as number).toFixed(1) : reach(d)), !!other && reach(other) !== reach(d)),
  ].join('')
}

/** What a part is called now, and its past (parts remember): set by main from the save. */
let describe: (d: AbilityDef) => { name: string; history: string | null } = (d) => ({ name: d.name, history: null })
/** The playtest switches beside resume, as main hands them over: what each is called, and its state. */
const playSwitches: { label: string; read: () => boolean; write: (on: boolean) => void }[] = []
/** Mastery learned this run, for the loadout screen: set by main. */
let learned: () => { name: string; line: string }[] = () => []
/** The core block under the loadout, set by main (B5): null with no core worn. */
let coreBlock: () => CoreBlock | null = () => null
/** One-press buttons after the switches (the owner's log export), in the order main gave them. */
const playActions: { label: () => string; run: () => void; show?: () => boolean }[] = []

function card(d: AbilityDef, tag: string, other?: AbilityDef, conflict?: string | null, fresh = false, cost?: string, note?: string, cold: string[] = [], fit?: string) {
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
      ${cold.map((l) => `<p class="ppair">${l}</p>`).join('')}
      ${fit ? `<p class="pfit">${fit}</p>` : ''}
      ${conflict ? `<p class="pconflict">${conflict}</p>` : ''}
      ${cost ? `<p class="pcost">${cost}</p>` : ''}
      ${note ? `<p class="pconflict">${note}</p>` : ''}
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
  /** `slots` may be a getter: the cards are drawn from it again when a switch is flipped on the screen (a flip re-wears the parts, so the numbers a card shows change). */
  loadout: (slots: LoadoutSlots | (() => LoadoutSlots), onResume: () => void) => void
  /** `equipped` is everything on Still, for the conflict line under the incoming card. */
  /** `fresh`: the incoming part has never been found, and its card says so. */
  /**
   * `o.tag` says where it is ("on the floor" if not given); `o.cost`, its price in strain, on the card
   * and the take button; `o.stays`, no quiet takes it back; `o.note`, what taking it does to the rest.
   * A swap (design/synergy): `o.take` is the take button's words ("take · Piston II"), `o.melts` what
   * melts into it; `o.pair`, the pair it makes or ends with what's worn. `o.fit` (B5, with a core worn): how the incoming part fits it.
   */
  compare: (
    current: AbilityDef | null, incoming: AbilityDef, equipped: readonly AbilityDef[], onTake: () => void, onLeave: () => void, fresh?: boolean,
    o?: { tag?: string; cost?: number; stays?: boolean; note?: string; take?: string; melts?: string; pair?: string; fit?: string },
  ) => void
  /**
   * The keystone socket (BUILD.md §2.9, B5): walked onto, a keystone on the floor opens it and the world waits. The core's name, the socket now (or empty) beside the keystone on the floor,
   * each with its words and its packs / bosses tag, and "you lose: ..." when one is socketed. `words` carries every string (this file has none of its own); take or leave.
   */
  socket: (
    core: string, current: KeyCard | null, incoming: KeyCard,
    words: { title: string; socket: string; empty: string; floor: string; lose: string | null; take: string; leave: string },
    onTake: () => void, onLeave: () => void,
  ) => void
  /** What the loadout screen shows under the cards with a core worn: the core's name, its socket and upgrades, and the open depth's marks (words from main). Null: nothing (no core). */
  setCore: (fn: () => CoreBlock | null) => void
  /**
   * The look-back screen: every run's card, large, newest first, with the arrows to
   * page through them and close. `render` draws card i (0 is the newest).
   */
  lookBack: (count: number, render: (i: number) => Promise<HTMLCanvasElement>, onClose: () => void) => void
  /** Mastery (mastery.ts): one of two, as big cards; picking one closes it. */
  choose: (title: string, intro: string, options: { name: string; line: string; onPick: () => void }[]) => void
  /**
   * The core's pick (BUILD.md §2.8, B4): the run's start, two big cards side by side and no back button (a pick is made, not left). Each card is its core's name, then what the left
   * thumb does and what that leaves on a body (words from cores.ts WORDS, passed in: this file has no words of its own). `id` is the core's, handed back to `onPick`.
   */
  pickCore: (title: string, intro: string, cards: { id: string; name: string; thumb: string; leaves: string }[], onPick: (id: string) => void) => void
  /** What the pause screen lists under the loadout: mastery learned this run ("Cold Strike: ..."). */
  setLearned: (fn: () => { name: string; line: string }[]) => void
  /** The notebook: its pages, one at a time, and close. */
  notebook: (pages: NotebookPage[], onClose: () => void) => void
  /** Which def a card's numbers come from (the weighed one while the weight switch is on). */
  setShown: (fn: (d: AbilityDef) => AbilityDef) => void
  /** How part cards name a part and tell its past. */
  setDescribe: (fn: (d: AbilityDef) => { name: string; history: string | null }) => void
  /** A playtest switch on the loadout screen (the close hand, the eye), added or replaced by label: main reads and writes it. */
  setSwitch: (label: string, read: () => boolean, write: (on: boolean) => void) => void
  /** A one-press button on the loadout screen after the switches (the owner's log export, the map); `label` is read each time it's shown, `show` says whether it is. */
  setAction: (label: () => string, run: () => void, show?: () => boolean) => void
  /** The open field's map, drawn by main, and back to the loadout. */
  map: (canvas: HTMLCanvasElement, onBack: () => void) => void
  hide: () => void
}

/** One slot's part (or none) on the loadout screen. */
type LoadoutSlots = readonly { slot: SlotName; def: AbilityDef | null }[]
/** A keystone on the socket card: its name and line, and the tag that says what it is for. */
export interface KeyCard { name: string; line: string; tag: string }
/** The core block under the loadout (main builds it from WORDS): `name`, then `parts` (the socket, the upgrades), then the `readout` line. */
export interface CoreBlock { name: string; parts: string[]; readout: string }

/** A notebook page, laid out (main builds these from the save and the roster). */
export interface NotebookPage { name: string; what: string; line: string | null; facts: string; leaders: string | null }

/** The presses that close a screen or turn a part down. */
const BACK = ['resume', 'leave', 'close']

export function createPauseScreen(root: HTMLElement): PauseScreen {
  const el = document.createElement('div')
  el.id = 'pause'
  root.appendChild(el)
  let isOpen = false
  // every press on these screens clicks; the ones that close or leave click softer. Take has its own sound.
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (!b || b.classList.contains('take')) return
    if (BACK.some((cls) => b.classList.contains(cls))) sfx.uiBack()
    else sfx.uiClick()
  })

  function show(html: string, actions: [string, string, () => void][]) {
    el.innerHTML = `${html}<div class="actions">${actions.map(([cls, label]) => `<button type="button" class="${cls}">${label}</button>`).join('')}</div>`
    for (const [cls, , cb] of actions) el.querySelector(`.${cls}`)!.addEventListener('click', cb)
    el.classList.add('show')
    isOpen = true
  }

  return {
    get open() { return isOpen },

    loadout(slotsOrFn, onResume) {
      const read = typeof slotsOrFn === 'function' ? slotsOrFn : () => slotsOrFn
      const cardsOf = (ss: LoadoutSlots) => ss.map((s) => (s.def ? card(s.def, SLOT_LABEL[s.slot]) : emptyCard(s.slot, SLOT_LABEL[s.slot]))).join('')
      const known = learned()
      const blockOf = () => {
        const c = coreBlock()
        return c ? `<p class="pcore"><b>${c.name}</b>${c.parts.map((x) => `<span>${x}</span>`).join('')}<em>${c.readout}</em></p>` : ''
      }
      show(
        `<h2>Paused</h2><div class="row four">${cardsOf(read())}</div><div class="coreblock">${blockOf()}</div>` +
        (known.length ? `<p class="learned">${known.map((m) => `<b>${m.name}</b> ${m.line}`).join('<br>')}</p>` : ''),
        [['resume', 'resume', onResume]],
      )
      // the playtest switches, before resume in the order main gave them: one tap flips one, and it says which way it is
      const resume = el.querySelector('.actions .resume')!
      for (const rule of playSwitches) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'rule'
        const paint = () => {
          const on = rule.read()
          btn.classList.toggle('on', on)
          btn.setAttribute('aria-pressed', String(on))
          btn.innerHTML = `${rule.label} <b>${on ? 'on' : 'off'}</b>`
        }
        btn.addEventListener('click', () => {
          rule.write(!rule.read())
          paint()
          // a switch can change the numbers a card shows (weight, builds): the cards follow it, drawn from what is worn now, and so does the core block
          const row = el.querySelector('.row.four')
          if (row) row.innerHTML = cardsOf(read())
          const cb = el.querySelector('.coreblock')
          if (cb) cb.innerHTML = blockOf()
        })
        paint()
        resume.before(btn)
      }
      for (const act of playActions) {
        if (act.show && !act.show()) continue
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'rule act'
        btn.innerHTML = act.label()
        btn.addEventListener('click', () => act.run())
        resume.before(btn)
      }
    },

    compare(current, incoming, equipped, onTake, onLeave, fresh = false, o = {}) {
      const price = o.cost ? `strain +${o.cost}` : ''
      show(
        `<h2>${SLOT_LABEL[incoming.slot]} slot</h2>
         <div class="row two">
           ${current ? card(current, 'on Still now', incoming) : emptyCard(incoming.slot, 'on Still now')}
           <div class="arrow">&rarr;</div>
           ${card(incoming, o.tag ?? 'on the floor', current ?? undefined, conflictLine(incoming, equipped), fresh, price && (o.stays ? `${price}, and it stays` : price), o.note,
             [o.melts, o.pair].filter((l): l is string => !!l), o.fit)}
         </div>`,
        [['leave', 'leave it', onLeave], ['take', [o.take ?? 'take it', price].filter(Boolean).join(' \u00b7 '), onTake]],
      )
    },

    choose(title, intro, options) {
      show(
        `<h2>${title}</h2><p class="intro">${intro}</p><div class="row two">${options.map((o, i) =>
          `<button type="button" class="pcard master" data-i="${i}"><b class="pname">${o.name}</b><p>${o.line}</p></button>`).join('')}</div>`,
        [],
      )
      el.querySelectorAll<HTMLElement>('.master').forEach((b) => b.addEventListener('click', () => options[Number(b.dataset.i)]?.onPick()))
    },

    pickCore(title, intro, cards, onPick) {
      // no actions row: a pick is made, not left. The ring glyph is the mark's own look in thirds (cold; Ram's cracked), so the card shows what it will leave on a body
      show(
        `<h2>${title}</h2><p class="intro">${intro}</p><div class="row two">${cards.map((c, i) =>
          `<button type="button" class="pcard master core" data-i="${i}" data-core="${c.id}"><i class="coreglyph" aria-hidden="true"></i><b class="pname">${c.name}</b><p class="thumb">${c.thumb}</p><p class="leaves">${c.leaves}</p></button>`).join('')}</div>`,
        [],
      )
      el.querySelectorAll<HTMLElement>('.core').forEach((b) => b.addEventListener('click', () => onPick(cards[Number(b.dataset.i)]?.id ?? '')))
    },

    socket(core, current, incoming, words, onTake, onLeave) {
      const keyCard = (k: KeyCard, tag: string, extra = '') =>
        `<div class="pcard tier-gold pkey" data-core="${core}"><div class="tag">${tag}</div><div class="pname">${k.name}</div><p class="pline">${k.line}</p><div class="stats"><div class="stat"><span>${k.tag}</span></div></div>${extra}</div>`
      show(
        `<h2>${words.title}</h2>
         <div class="row two">
           ${current ? keyCard(current, words.socket) : `<div class="pcard empty"><div class="tag">${words.socket}</div><div class="pname">${words.empty}</div></div>`}
           <div class="arrow">&rarr;</div>
           ${keyCard(incoming, words.floor, words.lose ? `<p class="pconflict plose">${words.lose}</p>` : '')}
         </div>`,
        [['leave', words.leave, onLeave], ['take', words.take, onTake]],
      )
    },

    setCore(fn) {
      coreBlock = fn
    },

    setShown(fn) {
      shown = fn
    },

    setLearned(fn) {
      learned = fn
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

    setAction(label, run, show) {
      playActions.push({ label, run, show })
    },

    map(canvas, onBack) {
      show(`<h2>Map</h2><div class="fieldmap"></div>`, [['close', 'back', onBack]])
      el.querySelector('.fieldmap')!.appendChild(canvas)
    },

    setSwitch(label, read, write) {
      const i = playSwitches.findIndex((s) => s.label === label)
      if (i >= 0) playSwitches[i] = { label, read, write }
      else playSwitches.push({ label, read, write })
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
