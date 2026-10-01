/**
 * The "weight" trial's checks (design/lean/WEIGHT.md §4; the word "weight" is a PLACEHOLDER). K-L1 is off-is-today: the regression suites
 * run as child processes and must print what W0 recorded. Each other check is one evaluate on the arena with the frame loop held, except
 * K-L2's real click on the pause screen's switch. `node tools/checks/lean.mjs [K-L2 ...]`.
 * Not to be confused with tools/leancheck.ts, which belongs to the leanings round.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, task, run } = suite()

const HERE = fileURLToPath(new URL('.', import.meta.url))

/**
 * In the page: a clean arena with Still's four starting parts (lens, vent, cleaver, kickstart), the frame loop held, the autos off,
 * the break rule on, the weight switch `on`, preset B, and the feel counters zeroed. Every button is ready.
 */
const SETUP = `(on) => {
  const W = window
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
  W.__hold(true)
  W.__arena()
  const C = W.__combat
  C.time = 0
  C.pressure = true
  C.counters = false
  C.breakRule = true
  C.autoAttack = false
  W.__stick(0, 0)
  W.__weight(on)
  W.__weightPreset('B')
  W.__fx()
}`

/**
 * In the page, after SETUP: \`tick\` is one step with Still and a pinned body where they were, whole; \`wall(hp)\` a hulk whose HP a strike
 * doesn't end (a pressure body at hp 1e6 unless said); \`fx()\` the feel's counters, read and zeroed (hitstop s, shake, push signatures).
 */
const HELPERS = `
  const W = window
  const C = W.__combat
  const last = () => W.__run.stats[W.__run.stats.length - 1]
  const snap = () => JSON.parse(JSON.stringify(last()))
  const tick = (pin) => { C.hp = 100; W.__still.pos.set(0, 0, 0); if (pin) { pin.pos.set(pin.pos.x, 0, pin.pos.z); pin.knock.set(0, 0, 0) } W.__step(1 / 60) }
  const wall = (hp = 1e6, x = 0, z = 2) => { const e = W.__spawn('chaser', x, z, true); e.hp = hp; return e }
  const fx = () => W.__fx()
`

/**
 * In the page: the pause screen's weight row, clicked by the DOM as K-A10 does. Returns the switch's effect. Closes the pause screen.
 */
const FLIP = `() => {
  const W = window
  W.__pause.loadout(W.__hud.slots, () => {})
  const b = [...document.querySelectorAll('#pause .rule')].find((x) => x.textContent.startsWith('weight'))
  b.click()
  W.__pause.hide()
}`

/** What W0 recorded, per suite (1 Oct 2026, before any src change): its argv, every id it prints, and the ids that FAIL there. */
const RECORD = {
  'fights.mjs': { args: ['compare'], pass: ['K-90F'], fail: [] },
  'autos.mjs': { args: [], pass: ['K-A2', 'K-A3', 'K-A4', 'K-A5', 'K-A6', 'K-A7', 'K-A8', 'K-A9', 'K-A10'], fail: [] },
  'k9.mjs': {
    args: [],
    pass: ['K-9B', 'K-9B9', 'K-96a', 'K-97a', 'K-9A', 'K-92a', 'K-91', 'K-98', 'K-99', 'K-97b', 'K-96b', 'K-95a', 'K-94', 'K-93', 'K-95b', 'K-96c', 'K-9C', 'K-9D'],
    fail: [],
  },
  // K-W3d is the known Parry finding (Parry Clamp catches 0.03 tells a fight, under 0.3): it fails today and must keep failing the same way
  'stageb.mjs': {
    args: [],
    pass: [
      'K-W3a', 'K-W3b', 'K-W3c', 'K-W3e', 'K-W3f', 'K-W3g', 'K-W3h', 'K-W3i', 'K-W8a', 'K-W8b', 'K-T13', 'K-T5', 'K-T14', 'K-T15', 'K-E1', 'K-E2', 'K-E3',
      'K-E4', 'K-E13', 'K-E14', 'K-E15', 'K-S2', 'K-E5', 'K-E6', 'K-E7', 'K-E16', 'K-S3', 'K-E8', 'K-E17', 'K-E9', 'K-E10', 'K-E12', 'K-S1', 'K-S4', 'K-Z1', 'K-E11',
    ],
    fail: ['K-W3d'],
  },
}

/** Run one suite as a child process: its PASS / FAIL lines, in order. */
function suiteLines(file, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [HERE + file, ...args], { cwd: HERE + '../../' })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', reject)
    child.on('close', () => {
      resolve(out.split('\n').flatMap((l) => {
        const m = /^(PASS|FAIL) (\S+?):?(?: |$)/.exec(l)
        return m ? [{ verdict: m[1], id: m[2], line: l }] : []
      }))
    })
  })
}

// K-L1 off is today's game: the whole regression set prints what W0 recorded (the page part is below)
task('K-L1', async () => {
  for (const [file, rec] of Object.entries(RECORD)) {
    const lines = await suiteLines(file, rec.args)
    const got = lines.map((l) => `${l.verdict}:${l.id}`)
    const want = [...rec.pass.map((id) => `PASS:${id}`), ...rec.fail.map((id) => `FAIL:${id}`)]
    const extra = got.filter((g) => !want.includes(g))
    const missing = want.filter((w) => !got.includes(w))
    assert(extra.length === 0 && missing.length === 0, `${file} ${rec.args.join(' ')}: differs from W0's record: now ${extra.join(', ') || 'nothing new'}; no longer ${missing.join(', ') || 'nothing lost'}`)
    assertEq(`${file}: lines printed`, got.length, want.length)
  }
})

// the first check of this page: a fresh context, so the switch has never been touched
check('K-L1', RUN, async ({ page }) => {
  const got = await evalJson(page, () => ({
    stored: localStorage.getItem('still-action.weight'),
    on: window.__weight(),
    logged: window.__runStats().at(-1).weight,
    packHpMul: window.__combat.packHpMul,
    heavyHpMul: window.__combat.heavyHpMul,
  }))
  assertEq('a fresh context has no stored switch', got.stored, null)
  assertEq('__weight() is false', got.on, false)
  assertEq("the open depth's log: weight", got.logged, false)
  assertEq('the HP multipliers are 1', [got.packHpMul, got.heavyHpMul], [1, 1])
})

// K-L2 the switch: a real click on the pause screen's row, at once on the next press, HP from the next level
check('K-L2', RUN, async ({ page }) => {
  try {
    await switchChecks(page)
  } finally {
    // a failing check leaves the switch off for the ones after it
    await evalJson(page, `() => {
      if (localStorage.getItem('still-action.weight') === '1') (${FLIP})()
    }`)
  }
})
async function switchChecks(page) {
  await evalJson(page, `() => {
    const W = window
    W.__run.dev = false
    W.__enter(2, 1)
    W.__weight(false)
    W.__step(0.2)
    W.__pause.loadout(W.__hud.slots, () => {})
  }`)
  const row = page.locator('#pause .rule', { hasText: /^weight/ })
  assertEq('the loadout screen shows one switch labelled weight', await row.count(), 1)
  assertEq('it starts off', (await row.locator('b').textContent()), 'off')
  const before = await evalJson(page, `() => {
    const C = window.__combat
    return { hp: C.enemies.map((e) => e.hp), n: C.enemies.length, on: C.weight, packHpMul: C.packHpMul }
  }`)
  assert(before.n > 0, 'the depth has bodies to keep their HP')
  await row.click()
  assertEq('one real click: the stored switch', await page.evaluate(() => localStorage.getItem('still-action.weight')), '1')
  assertEq('the row now reads on', (await row.locator('b').textContent()), 'on')
  const flipped = await evalJson(page, `() => {
    const W = window, C = W.__combat
    const st = W.__run.stats.at(-1)
    return { on: C.weight, mixed: st.weightMixed, entry: st.weight, hp: C.enemies.map((e) => e.hp), packHpMul: C.packHpMul }
  }`)
  assertEq('mid-crawl flip: combat.weight at once', flipped.on, true)
  assertEq('the open depth logs weightMixed', flipped.mixed, true)
  assertEq('its entry value stays what it was at entry', flipped.entry, false)
  assertEq('the bodies already on the level keep their HP', flipped.hp, before.hp)
  assertEq('the HP multiplier waits for the next level', flipped.packHpMul, 1)
  await evalJson(page, `() => window.__pause.hide()`)

  // the next depth: weight at entry, no mixed
  const next = await evalJson(page, `() => {
    const W = window
    W.__enter(3, 1)
    W.__step(0.2)
    const st = W.__run.stats.at(-1)
    return { depth: st.depth, weight: st.weight, mixed: st.weightMixed ?? null, on: W.__combat.weight }
  }`)
  assertEq('the next depth logs weight true and no weightMixed', next, { depth: 3, weight: true, mixed: null, on: true })

  // off then on in the same depth: still one weightMixed, no throw
  const flip = async () => {
    await evalJson(page, `() => window.__pause.loadout(window.__hud.slots, () => {})`)
    await row.click()
    await evalJson(page, `() => window.__pause.hide()`)
  }
  const read = () => evalJson(page, `() => { const st = window.__run.stats.at(-1); return { on: window.__combat.weight, mixed: st.weightMixed ?? null, stored: localStorage.getItem('still-action.weight') } }`)
  await flip()
  assertEq('flipped off: off now, the depth mixed', await read(), { on: false, mixed: true, stored: '0' })
  await flip()
  assertEq('flipped on again: on now, still mixed (one flag, not a count)', await read(), { on: true, mixed: true, stored: '1' })
  await flip()
  assertEq('left off for the checks after it', await read(), { on: false, mixed: true, stored: '0' })
}

// K-L10 the log, on and off: the fields, the break split's identity, and where weightMixed may appear
check('K-L10', RUN, async ({ page }) => {
  const shape = (s) => {
    const n = (v) => typeof v === 'number' && Number.isFinite(v)
    return {
      weight: typeof s.weight === 'boolean',
      breaksBy: !!s.breaksBy && n(s.breaksBy.ready) && n(s.breaksBy.pushed),
      freezeMs: n(s.freezeMs), freezePartMs: n(s.freezePartMs), freezeAutoMs: n(s.freezeAutoMs),
      kills: !!s.kills && n(s.kills.part) && n(s.kills.auto) && n(s.kills.other),
      hpLost: n(s.hpLost), breaks: n(s.breaks),
    }
  }
  const got = await evalJson(page, `() => {
    const out = {}
    for (const on of [true, false]) {
      // a fresh depth entered with the switch off (the stored one), then the weight turned on by the hook alone
      window.__enter(1, 1)
      ;(${SETUP})(on)
      ${HELPERS}
      const s0 = snap()
      // one real push-broken windup: a crowned hulk 2 u ahead winds up; the arms cast, then pushed on the cooling button
      C.pressure = false
      const h = W.__spawn('chaser', 0, 2, true, 'plated')
      h.hp = 1e6
      let n = 0
      while (h.phase !== 'windup' && n++ < 240) tick(h)
      const wound = h.phase === 'windup'
      W.__fire('arms')
      W.__fire('arms', true)
      const s1 = snap()
      const f = W.__runStats().at(-1)
      out[on ? 'on' : 'off'] = {
        wound, broke: s1.breaks - s0.breaks, pushed: s1.breaksBy.pushed - s0.breaksBy.pushed, ready: s1.breaksBy.ready - s0.breaksBy.ready,
        sum: s1.breaksBy.ready + s1.breaksBy.pushed === s1.breaks, weight: s1.weight, mixed: s1.weightMixed ?? null, fields: f,
      }
    }
    return out
  }`)
  for (const sw of ['on', 'off']) {
    const g = got[sw]
    const s = shape(g.fields)
    for (const [k, ok] of Object.entries(s)) assert(ok, `switch ${sw}: the depth's stats have no good ${k}`)
    assert(g.wound, `switch ${sw}: the crowned hulk never wound up`)
    assertEq(`switch ${sw}: the push broke one windup`, g.broke, 1)
    assertEq(`switch ${sw}: breaksBy.pushed +1`, g.pushed, 1)
    assertEq(`switch ${sw}: breaksBy.ready +0`, g.ready, 0)
    assertEq(`switch ${sw}: ready + pushed === breaks`, g.sum, true)
    assertEq(`switch ${sw}: the depth's weight stays the value at entry (__weight is not a level entry)`, g.weight, false)
    assertEq(`switch ${sw}: __weight is not a flip: no weightMixed`, g.mixed, null)
  }

  // weightMixed only on a flip depth: a flip from the pause screen marks it, the next depth is clean, and the off depth never has it
  const flip = await evalJson(page, `() => {
    const W = window
    ;(${SETUP})(false)
    W.__run.dev = false
    const from = W.__run.stats.length
    W.__enter(2, 1)
    W.__step(0.2)
    const st = () => W.__run.stats.at(-1)
    const out = { before: st().weightMixed ?? null }
    ;(${FLIP})()
    out.flipped = st().weightMixed ?? null
    out.stored = localStorage.getItem('still-action.weight')
    W.__enter(3, 1)
    W.__step(0.2)
    out.next = { weight: st().weight, mixed: st().weightMixed ?? null }
    // the depths this check entered keep their own flags
    out.history = W.__runStats().slice(from).map((s) => ({ depth: s.depth, mixed: s.weightMixed ?? null }))
    ;(${FLIP})()
    out.after = { stored: localStorage.getItem('still-action.weight'), on: W.__combat.weight }
    return out
  }`)
  assertEq('before any flip: no weightMixed', flip.before, null)
  assertEq('after the pause screen flip: weightMixed true', flip.flipped, true)
  assertEq('the click stored 1', flip.stored, '1')
  assertEq('the next depth: weight on, no weightMixed', flip.next, { weight: true, mixed: null })
  assertEq('only the flip depth is mixed', flip.history.filter((h) => h.mixed).map((h) => h.depth), [2])
  assertEq('left off', flip.after, { stored: '0', on: false })
})

process.exit(await run(process.argv.slice(2)))
