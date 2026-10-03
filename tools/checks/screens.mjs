/**
 * Every screen's buttons can be reached on a landscape phone (30 Sep: paused in the final boss with four
 * "..., that saw the Arbiter" parts and five mastery lines, resume sat below the bottom edge and the pause
 * screen couldn't scroll: no way back into the fight). Each screen is opened with its longest real content
 * at four landscape phone sizes, and every visible button must end up fully on screen and on top at its
 * centre, either as it stands or after scrolling a container a thumb can scroll (overflow auto/scroll,
 * touch-action not none). The page itself never scrolls (html/body are overflow hidden), so a scroll of
 * those doesn't count, and nothing may start above the top edge or past the right one.
 * B4 added the core's pick after the chooser, so the three endings are K-S11..K-S13 now (they were K-S10..K-S12). B5 adds K-S14 the socket card, K-S15 the upgrade choose, K-S16 the
 * loadout with the core block and the readout, K-S17 a spender's button showing 9 with its pulse (after the endings, so the ids above stay put).
 * `node tools/checks/screens.mjs [K-S1 ...]`.
 */
import { assert, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory'
const { check, run } = suite()

/** Landscape phones, as their browsers leave them (the Poco F8 Pro's is the first; the last is a small one with its bars showing). */
const SIZES = [[915, 412], [844, 390], [800, 360], [667, 320]]

/**
 * In the page: every visible button under `sel`, scrolled into reach the way a thumb could, then measured.
 * Returns the failures as strings (empty when every one is reachable).
 */
const REACH = `(sel) => {
  const root = document.querySelector(sel)
  if (!root) return ['no ' + sel]
  const vw = innerWidth, vh = innerHeight
  const bad = []
  let seen = 0
  const name = (b) => (b.className || b.tagName) + ' "' + (b.textContent || b.getAttribute('aria-label') || '').trim().slice(0, 30) + '"'
  const pannable = (el) => {
    const cs = getComputedStyle(el)
    return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && cs.touchAction !== 'none' && el !== document.body && el !== document.documentElement
  }
  // before any scroll: nothing starts above the top edge (a centred overflow clips both ends out of reach)
  for (const s of [root, ...root.querySelectorAll('*')]) {
    if (!s.getClientRects().length) continue
    const r = s.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    if (r.top < -1) { bad.push('starts above the top: ' + name(s) + ' at ' + Math.round(r.top)); break }
    if (r.right > vw + 1 && getComputedStyle(s).position !== 'fixed') { bad.push('past the right edge: ' + name(s) + ' to ' + Math.round(r.right)); break }
  }
  for (const b of root.querySelectorAll('button')) {
    if (!b.getClientRects().length || getComputedStyle(b).visibility === 'hidden') continue
    // the nearest scroller a thumb can move, brought to the button
    for (let el = b.parentElement; el; el = el.parentElement) {
      if (!pannable(el) || el.scrollHeight <= el.clientHeight) continue
      const r = b.getBoundingClientRect(), box = el.getBoundingClientRect()
      if (r.bottom > box.bottom) el.scrollTop += r.bottom - box.bottom + 2
      if (b.getBoundingClientRect().top < box.top) el.scrollTop -= box.top - b.getBoundingClientRect().top + 2
    }
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
    const r = b.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    seen++
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1) {
      bad.push('off screen: ' + name(b) + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round).join(',') + ']')
      continue
    }
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (!hit || (hit !== b && !b.contains(hit))) bad.push('covered: ' + name(b) + ' by ' + (hit ? hit.id || hit.className || hit.tagName : 'nothing'))
  }
  for (const el of [root, ...root.querySelectorAll('*')]) if (el.scrollTop) el.scrollTop = 0
  if (!seen) bad.push('no visible button under ' + sel)
  return bad
}`

/** In the page: the longest line in each slot, worn, with a long past (what a fourth-run gold loadout reads like). */
const WORST = `() => {
  const pick = (slot) => window.__parts.filter((p) => p.slot === slot)
    .sort((a, b) => b.line.length - a.line.length)[0]
  window.__pause.setDescribe((d) => ({ name: d.name + ' III, that saw the Arbiter', history: 'carried 17 runs, saw depth 9' }))
  window.__pause.setLearned(() => ['Cold Strike', 'Splitting Shot', 'Marking Shot', 'Cold Shot', 'Wide Strike', 'Heavy Strike']
    .map((n) => ({ name: n, line: 'Every planted shot that kills splits into two at the nearest bodies.' })))
  if (!window.__screensActs) {
    window.__screensActs = true
    window.__pause.setAction(() => 'export log <b>1234</b>', () => {})
  }
  return ['head', 'torso', 'arms', 'legs'].map((slot) => ({ slot, def: pick(slot) }))
}`

/** Each screen: how to open it (in the page, given the worst loadout), the overlay to measure, and how to close it. */
const SCREENS = {
  loadout: {
    sel: '#pause',
    open: `(slots) => window.__pause.loadout(slots, () => {})`,
  },
  compare: {
    sel: '#pause',
    open: `(slots) => window.__pause.compare(slots[0].def, slots[0].def, slots.map((s) => s.def), () => {}, () => {}, true, {
      tag: 'on a pedestal', cost: 2, stays: true, note: 'Taking it melts the one you wear into it, and the pair you had ends.',
      take: 'take \\u00b7 Patient Lens III', melts: 'Scrap Cleaver III, that saw the Assembler, melts in', pair: 'pairs with Chill Vent, and ends Marking Shot',
    })`,
  },
  mastery: {
    sel: '#pause',
    open: `() => window.__pause.choose('Mastery \\u00b7 Patient Lens III, that saw the Arbiter', 'Patient Lens is at its best. What it knows goes to Plumb Line III, that saw the Arbiter.', [
      { name: 'Splitting Shot', line: 'A planted shot that kills splits into two at the nearest bodies, and each of those chills what it hits.', onPick: () => {} },
      { name: 'Marking Shot', line: 'Every planted shot marks what it hits, and a marked body takes the next close strike twice.', onPick: () => {} },
    ])`,
  },
  corkboard: {
    sel: '#pause',
    open: `() => window.__pause.lookBack(12, async () => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; return c }, () => {})`,
  },
  notebook: {
    sel: '#pause',
    open: `() => window.__pause.notebook([{ name: 'The Arbiter, that sat in judgement', what: 'a judge of the quarter, on its high seat',
      line: 'It weighed every part I carried and found each one wanting, and still it let me by, and I do not know why.',
      facts: 'met 14 times \\u00b7 broken 9 \\u00b7 broke Still 5 \\u00b7 first at depth 6', leaders: 'led: the ram pack, the sentinels, the mites, the menders, the lobbers' }], () => {})`,
  },
  map: {
    sel: '#pause',
    open: `() => { const c = document.createElement('canvas'); c.width = Math.min(innerWidth - 48, 760); c.height = Math.min(innerHeight - 150, 420); window.__pause.map(c, () => {}) }`,
  },
  offer: {
    sel: '#offer',
    open: `(slots) => window.__hud.offer(slots[1].def, true, { name: slots[1].def.name + ' III, that saw the Arbiter', history: 'carried 17 runs, saw depth 9, broke the Engine twice' },
      'melt into Clamp Toss III', { swap: { take: 'take \\u00b7 Lure III', melts: 'Scrap Cleaver III, that saw the Assembler, melts in' }, pair: 'pairs with Chill Vent, ends Marking Shot' })`,
    close: `() => window.__hud.offer(null)`,
  },
  prompt: {
    sel: '#prompt',
    open: `() => window.__hud.prompt({ title: 'The warm light, where the cold beam stands beside it', line: 'Go home now, and the rest of the Line waits for another run. The cold beam goes on down.', action: 'go home' })`,
    close: `() => window.__hud.prompt(null)`,
  },
  chooser: {
    sel: '#chooser',
    // in the workshop, where it lives (the fight's arc is hidden there)
    open: `() => (window.__workshop(), window.__hud.chooser({ title: 'The wall \\u00b7 arms', selected: window.__parts[0].id,
      items: window.__parts.filter((p) => p.slot === 'head').map((p) => ({ id: p.id, icon: p.icon, state: 'lit', tier: p.tier })),
      detail: { name: 'Clamp Toss III, that saw the Arbiter', line: window.__parts[0].line, history: 'carried 3 runs, saw depth 9', tier: 'gold', note: 'hung on the wall since the second run', rider: 'On a windup: throws it twice as far.' },
      action: 'turn to the wall' }))`,
    close: `() => window.__hud.chooser(null)`,
  },
  // B4: the core's pick at the run's start. Two cards and no actions row, so the cards themselves are the buttons to reach; the lines are twice the length of the placeholder words
  pick: {
    sel: '#pause',
    open: `() => window.__pause.pickCore('Choose a core', 'One way to fight, for the whole run, and the only one you will have until the run is over.', [
      { id: 'wake', name: 'Wake', thumb: 'Pass beside them, and never stop, and never turn your back on the ones that come.', leaves: 'What you pass beside is frosted, and the frost holds for a while after you have gone.', spends: 'Blue buttons spend them, and the more marks on a body, the more they pay out.', },
      { id: 'ram', name: 'Ram', thumb: 'Put them against something, a wall, or another one of them, and hold them there.', leaves: 'What hits a wall or a body is slammed, and a slammed body pays what the parts that fit it spend.', spends: 'Blue buttons spend them, and the more marks on a body, the more they pay out.', },
    ], () => {})`,
  },
}

let n = 0
for (const [screen, s] of Object.entries(SCREENS)) {
  n++
  check(`K-S${n}`, RUN, async ({ page }) => {
    const fails = []
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h })
      // the resize is debounced in the game (180 ms); layout itself is immediate
      await page.waitForTimeout(250)
      const slots = await evalJson(page, WORST)
      assert(slots.every((x) => x.def), 'a slot with no part to show')
      await page.evaluate(({ f, a }) => new Function('return ' + f)()(a), { f: s.open, a: slots })
      await page.waitForTimeout(80)
      const bad = await evalJson(page, REACH, s.sel)
      await page.evaluate((f) => new Function('return ' + f)()(), s.close ?? '() => window.__pause.hide()')
      if (bad.length) fails.push(`${w}x${h}: ${bad.join('; ')}`)
    }
    assert(!fails.length, `${screen}: ${fails.join(' | ')}`)
  })
}

// the endings: one run each, ended the game's way, and its continue button in reach
const ENDS = ['broken', 'stopped', 'home']
for (const kind of ENDS) {
  n++
  check(`K-S${n}`, RUN, async ({ page }) => {
    const fails = []
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(250)
      const ok = await evalJson(page, `(kind) => { window.__run.dev = false; window.__enter(2, 1); window.__step(0.2); return window.__end(kind) || window.__run.phase + '/' + window.__mode() }`, kind)
      assert(ok === true, `${kind}: __end refused in ${ok}`)
      const t = await evalJson(page, `() => window.__until(() => window.__mode() === 'ending', 15)`)
      assert(t >= 0, `${kind}: never reached the ending`)
      await page.waitForTimeout(80)
      const bad = await evalJson(page, REACH, '#ending')
      // past its guard, and out, so the next size starts a fresh run
      await page.waitForTimeout(1600)
      await evalJson(page, `() => { window.__continue(); return window.__until(() => window.__mode() !== 'ending', 10) }`)
      if (bad.length) fails.push(`${w}x${h}: ${bad.join('; ')}`)
    }
    assert(!fails.length, `ending ${kind}: ${fails.join(' | ')}`)
  })
}

// B5: the hunt's screens, at the same four sizes. Each is opened with its longest content (twice the placeholder words), and every button must be reachable.
const B5_SCREENS = [
  // the socket card: a keystone socketed beside the one on the floor, with "you lose", and the card with an empty socket
  ['K-S14', 'socket', `() => window.__pause.socket('Wake', { name: 'Deep Frost, that holds five and lasts longer', line: 'Rings hold five and last longer, and the fifth ring breaks the body open on its own.', tag: 'for bosses' },
      { name: 'Burst, that breaks them open', line: 'The third ring breaks the body open on its own, and what it breaks passes what is left to the next.', tag: 'for packs' },
      { title: 'Wake \\u00b7 socket', socket: 'socket', empty: 'empty', floor: 'on the floor', lose: 'you lose: Deep Frost, that holds five and lasts longer', take: 'take it', leave: 'leave it' }, () => {}, () => {})`],
  ['K-S14', 'socket, empty', `() => window.__pause.socket('Ram', null, { name: 'Domino', line: 'A slammed body slams what it hits.', tag: 'for packs' },
      { title: 'Ram \\u00b7 socket', socket: 'socket', empty: 'empty', floor: 'on the floor', lose: null, take: 'take it', leave: 'leave it' }, () => {}, () => {})`],
  // the upgrade at a melt past III: the same card as mastery's, titled for the core
  ['K-S15', 'upgrade', `() => window.__pause.choose('Wake \\u00b7 upgrade', 'Scrap Cleaver III, that saw the Arbiter, is at its best. What it knows goes to Wake, and the run is the longer for it.', [
      { name: 'Slipstream, that speeds you', line: 'Every pass speeds you up a little, and a long pass a little more, for as long as you keep passing.', onPick: () => {} },
      { name: 'Spray, that carries on', line: 'Rime carries to the one behind, and to the one behind that if it stands near, and cold on cold.', onPick: () => {} },
    ])`],
  // the loadout with the core block: the name, the socket and the upgrades (long), and the readout
  ['K-S16', 'readout', `(slots) => { window.__pause.setCore(() => ({ name: 'Wake', parts: ['socket: Deep Frost, that holds five and lasts longer', 'upgrades: Slipstream, that speeds you, Spray, that carries on'], readout: 'marked 128 \\u00b7 spent 96' }))
      window.__pause.loadout(() => slots, () => {}) }`, `() => { window.__pause.setCore(() => null); window.__pause.hide() }`],
]
// their own page (an unused `b5` query key): the endings above leave the page in an ending, which would cover these
const B5_RUN = RUN + '&b5=1'
for (const [id, what, open, close] of B5_SCREENS) {
  check(id, B5_RUN, async ({ page }) => {
    const fails = []
    for (const [w, h] of SIZES) {
      await page.setViewportSize({ width: w, height: h })
      await page.waitForTimeout(250)
      const slots = await evalJson(page, WORST)
      await page.evaluate(({ f, a }) => new Function('return ' + f)()(a), { f: open, a: slots })
      await page.waitForTimeout(80)
      const bad = await evalJson(page, REACH, '#pause')
      await page.evaluate((f) => new Function('return ' + f)()(), close ?? '() => window.__pause.hide()')
      if (bad.length) fails.push(`${w}x${h}: ${bad.join('; ')}`)
    }
    assert(!fails.length, `${what}: ${fails.join(' | ')}`)
  })
}

// K-S17: a spender's button showing 9 with its pulse. The digit is a badge on the rim's upper left: inside the screen, clear of the icon, the price pips and the push cue's glyph, and clear of
// the neighbouring buttons (the arc leaves 8 px between them), at all four sizes, on all four buttons at once (the worst case); its size is the one the arc has (BTN 60)
check('K-S17', B5_RUN, async ({ page }) => {
  const fails = []
  for (const [w, h] of SIZES) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(250)
    const bad = await evalJson(page, `() => {
      const W = window
      for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
      W.__core('wake')
      for (const sl of ['head', 'torso', 'arms', 'legs']) W.__hud.spendCue(sl, 9)
      const btns = [...document.querySelectorAll('#hud .btn')]
      const vw = innerWidth, vh = innerHeight
      const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
      const out = []
      btns.forEach((b, i) => {
        const badge = b.querySelector('.spend')
        const r = badge.getBoundingClientRect()
        if (!r.width) { out.push('button ' + i + ': no badge'); return }
        if (badge.textContent !== '9') out.push('button ' + i + ': reads ' + badge.textContent)
        if (!b.classList.contains('spend3')) out.push('button ' + i + ': no pulse class')
        if (r.left < 0 || r.top < 0 || r.right > vw || r.bottom > vh) out.push('button ' + i + ': badge off screen')
        for (const sel of ['.lbl svg', '.pips', '.scue']) {
          const el = b.querySelector(sel)
          if (!el || !(el.children.length || el.textContent) ) continue
          const e = el.getBoundingClientRect()
          if (e.width && hit(r, e)) out.push('button ' + i + ': badge over ' + sel)
        }
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2
        btns.forEach((o, j) => {
          if (j === i) return
          const q = o.getBoundingClientRect()
          const d = Math.hypot(cx - (q.left + q.width / 2), cy - (q.top + q.height / 2))
          if (d < q.width / 2 + r.width / 2 - 1) out.push('button ' + i + ': badge on button ' + j)
        })
      })
      for (const sl of ['head', 'torso', 'arms', 'legs']) W.__hud.spendCue(sl, null)
      W.__core(null)
      return out
    }`)
    if (bad.length) fails.push(`${w}x${h}: ${bad.join('; ')}`)
  }
  assert(!fails.length, `spender button: ${fails.join(' | ')}`)
})

process.exit(await run(process.argv.slice(2)))
