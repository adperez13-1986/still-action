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
  delete C.hurtPlayer
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
  const tick = (...pins) => { C.hp = 100; W.__still.pos.set(0, 0, 0); for (const pin of pins) if (pin) { pin.pos.set(pin.pos.x, 0, pin.pos.z); pin.knock.set(0, 0, 0) } W.__step(1 / 60) }
  const wall = (hp = 1e6, x = 0, z = 2) => { const e = W.__spawn('chaser', x, z, true); e.hp = hp; return e }
  const fx = () => W.__fx()
`

/**
 * In the page, after HELPERS (the timing checks): Still faces +z; \`vib\` records every navigator.vibrate call (the hud's 12 ms press buzz is one
 * of them); \`walls(n, z)\` n hulks side by side at z, inside a 100 degree fan of the Cleaver (|x| <= 1 at 2 u); \`ring(n, r)\` n hulks round Still
 * at r (the Vent). \`ms()\` is fx() as milliseconds: the freeze pending, the shake, the push signatures.
 */
const TIMING = `
  W.__still.facing = 0
  // no body hurts Still: a nick's own freeze (the game's, not the weight trial's) would sit in the numbers this check reads
  C.hurtPlayer = () => {}
  const vib = []
  navigator.vibrate = (p) => { vib.push(p); return true }
  const walls = (n, z = 2) => [0, -0.5, 0.5, -1, 1].slice(0, n).map((x) => wall(1e6, x, z))
  const ring = (n, r = 2.5) => Array.from({ length: n }, (_, i) => wall(1e6, Math.sin((i / n) * Math.PI * 2) * r, Math.cos((i / n) * Math.PI * 2) * r))
  const ms = () => { const f = fx(); return { ms: f.hitstop * 1000, shake: f.shake, sig: f.pushSig } }
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
    // W1: the freeze counters move with the switch on (the contact and the break of a part's push), and stay 0 with it off
    if (sw === 'on') assert(g.fields.freezePartMs > 0 && g.fields.freezeAutoMs === 0, `switch on: freezePartMs should have moved and freezeAutoMs not, got ${g.fields.freezePartMs} / ${g.fields.freezeAutoMs}`)
    else assertEq('switch off: both freeze counters stay 0', [g.fields.freezePartMs, g.fields.freezeAutoMs], [0, 0])
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

// ---- W1: timing (WEIGHT.md §2.3, §4) -------------------------------------------------------------------------------------------------------

/**
 * One scene of a timing check, as page source: a clean arena with the switch `on` (SETUP), the helpers, then \`body\`. Each scene is its own
 * block, so it declares what it likes; what it hands on goes through \`out\` (and \`acc\`, where a check sums across scenes).
 */
const scene = (on, body) => `{
  (${SETUP})(${on})
  ${HELPERS}
  ${TIMING}
  ${body}
}`

/** In a scene: ready the button \`slot\` again, as a ready flash does. */
const READY = (slot) => `W.__hud.ready('${slot}', 'cold')`

const near = (what, a, b) => assert(Math.abs(a - b) <= 0.5, `${what}: ${a} ms, wanted ${b}`)

// K-L6 the formula and the merge: freeze = min(100, round(30 + 6 x base cooldown s + 10 x (bodies - 1))) ms, and freezes within 0.2 s merge
check('K-L6', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = { cleaver: {}, vent: {} }
    const acc = { sums: 0, lost0: window.__run.stats.at(-1).freezePartMs }
    ${[1, 3, 5].map((n) => scene(true, `
      const read = () => { const f = ms(); acc.sums += f.ms; return f }
      walls(${n})
      W.__fire('arms')
      out.cleaver[${n}] = read().ms`) + scene(true, `
      const read = () => { const f = ms(); acc.sums += f.ms; return f }
      ring(${n})
      W.__fire('torso')
      out.vent[${n}] = read().ms`)).join('\n')}
    // a Cleaver III freezes like a rank-I one (the part's own cooldown, never the tempered one)
    ${scene(true, `
      const read = () => { const f = ms(); acc.sums += f.ms; return f }
      W.__equipRank('scrap-cleaver', 3)
      walls(1)
      W.__fire('arms')
      out.cleaver3 = read().ms`)}
    // Patient Lens (1.5 s): nothing on the press, 39 on the step the bolt lands
    ${scene(true, `
      const read = () => { const f = ms(); acc.sums += f.ms; return f }
      W.__equip('patient-lens')
      const far = wall(1e6, 0, 6)
      W.__fire('head')
      out.patientPress = read().ms
      let landed = 0
      for (let i = 0; i < 90 && !landed; i++) { tick(far); landed = read().ms }
      out.patient = landed`)}
    // the merge: a Cleaver (46), 0.1 s on the Vent (69) adds only the 23 it has over it; 0.3 s on the Cleaver is a fresh 46
    ${scene(true, `
      const read = () => { const f = ms(); acc.sums += f.ms; return f }
      const w1 = wall(1e6, 0, 2)
      W.__fire('arms')
      out.m1a = read().ms
      for (let i = 0; i < 6; i++) tick(w1)
      ${READY('torso')}
      W.__fire('torso')
      out.m1b = read().ms
      for (let i = 0; i < 18; i++) tick(w1)
      ${READY('arms')}
      W.__fire('arms')
      out.m2 = read().ms`)}
    // a Cleaver that kills a 1 HP hulk: the press (46) and the step it dies (the part kill's 90) sum to 90
    ${scene(true, `
      const one = wall(1, 0, 2)
      W.__fire('arms')
      let n = 0
      while (C.enemies.includes(one) && n++ < 10) tick(one)
      out.killed = !C.enemies.includes(one)
      out.kill = ms().ms
      acc.sums += out.kill`)}
    out.freezePartMs = window.__run.stats.at(-1).freezePartMs - acc.lost0
    out.sums = acc.sums
    return out
  }`)
  near('Cleaver, 1 body', got.cleaver[1], 46)
  near('Cleaver, 3 bodies', got.cleaver[3], 66)
  near('Cleaver, 5 bodies', got.cleaver[5], 86)
  near('Vent, 1 body', got.vent[1], 69)
  near('Vent, 3 bodies', got.vent[3], 89)
  near('Vent, 5 bodies (capped)', got.vent[5], 100)
  near('Cleaver III, 1 body', got.cleaver3, 46)
  near('Patient Lens on the press', got.patientPress, 0)
  near('Patient Lens when it lands', got.patient, 39)
  near('merge: the Cleaver', got.m1a, 46)
  near('merge: the Vent 0.1 s later adds only its excess', got.m1b, 23)
  near('merge: 0.3 s later is a fresh freeze', got.m2, 46)
  assert(got.killed, 'the 1 HP hulk never died')
  near('merge: the press then the step it dies', got.kill, 90)
  near('freezePartMs equals the sum of the freezes read', got.freezePartMs, got.sums)
})

// K-L7 the autos are quiet: no freeze from a hand strike or a lance; an auto kill 35 ms, a part kill 90; a hand break 35, a part's break 90
check('K-L7', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    // the hand on a wall, autos on: weight on, not a frozen step in 3 s; the control, switch off, freezes
    ${[true, false].map((on) => scene(on, `
      C.autoAttack = true
      const w = wall(1e6, 0, 2)
      const h0 = snap().hand
      let maxStop = 0
      for (let i = 0; i < ${on ? 180 : 60}; i++) { tick(w); maxStop = Math.max(maxStop, fx().hitstop) }
      out.${on ? 'hand' : 'handOff'} = { maxStop: maxStop * 1000, strikes: snap().hand - h0 }`)).join('\n')}
    // the eye's planted lance at a wall 8 u off
    ${scene(true, `
      C.autoAttack = true
      const far = wall(1e6, 0, 8)
      const l0 = snap().autoDmg.eye
      let maxLance = 0
      for (let i = 0; i < 240; i++) { tick(far); maxLance = Math.max(maxLance, fx().hitstop) }
      out.lance = { maxStop: maxLance * 1000, struck: snap().autoDmg.eye - l0 }`)}
    // an auto kill: a 1 HP hulk in the hand's reach
    ${scene(true, `
      C.autoAttack = true
      const a = wall(1, 0, 2)
      const k0 = snap()
      let maxKill = 0, maxShake = 0
      for (let i = 0; i < 120 && C.enemies.includes(a); i++) { tick(a); const f = ms(); maxKill = Math.max(maxKill, f.ms); maxShake = Math.max(maxShake, f.shake) }
      const k1 = snap()
      out.autoKill = { dead: !C.enemies.includes(a), maxStop: maxKill, maxShake, by: k1.kills.auto - k0.kills.auto, auto: k1.freezeAutoMs - k0.freezeAutoMs, part: k1.freezePartMs - k0.freezePartMs }`)}
    // a part kill: a Cleaver on a 1 HP hulk, autos off: the press (46) and the kill merge to 90, and the kill's shake is whole
    ${scene(true, `
      const p = wall(1, 0, 2)
      W.__fire('arms')
      let n = 0
      while (C.enemies.includes(p) && n++ < 10) tick(p)
      const f = ms()
      out.partKill = { dead: !C.enemies.includes(p), maxStop: f.ms, shake: f.shake }`)}
    // a hand break of a crowned windup: autos on, a plated hulk 2 u off winds up and the hand breaks it
    ${scene(true, `
      C.autoAttack = true
      C.pressure = false
      const h = W.__spawn('chaser', 0, 2, true, 'plated')
      h.hp = 1e6
      const b0 = snap().handBreaks
      let maxBreak = 0, broke = false
      for (let i = 0; i < 400 && !broke; i++) { tick(h); const f2 = ms(); maxBreak = Math.max(maxBreak, f2.ms); broke = snap().handBreaks > b0 }
      out.handBreak = { broke, maxStop: maxBreak }`)}
    // a Cleaver's break: pressed once, a push on the cooling button breaks the windup. The merge window is reset between the two presses
    ${scene(true, `
      C.pressure = false
      const c = W.__spawn('chaser', 0, 2, true, 'plated')
      c.hp = 1e6
      let m = 0
      while (c.phase !== 'windup' && m++ < 240) tick(c)
      W.__fire('arms')
      ms()
      W.__weight(true)
      vib.length = 0
      const br0 = snap().breaks
      W.__fire('arms', true)
      const fb = ms()
      out.partBreak = { broke: snap().breaks - br0, ms: fb.ms, vib: JSON.stringify(vib) }`)}
    return out
  }`)
  assertEq('the hand struck for three seconds', got.hand.strikes > 0, true)
  assertEq('weight on: the hand never froze a step', got.hand.maxStop, 0)
  assert(got.handOff.strikes > 0 && got.handOff.maxStop > 0, `the control (switch off) must freeze on a hand strike, got ${JSON.stringify(got.handOff)}`)
  assert(got.lance.struck > 0, 'the planted lance never struck the wall')
  assertEq('weight on: the lance never froze a step', got.lance.maxStop, 0)
  assert(got.autoKill.dead, 'the auto never killed the 1 HP hulk')
  assertEq('an auto kill is logged as an auto kill', got.autoKill.by, 1)
  near('an auto kill', got.autoKill.maxStop, 35)
  assert(got.autoKill.maxShake <= 0.14 + 1e-9 && got.autoKill.maxShake > 0, `an auto kill's shake: ${got.autoKill.maxShake}, wanted at most 0.14`)
  assert(Math.abs(got.autoKill.auto - 35) <= 0.5 && got.autoKill.part === 0, `freezeAutoMs +${got.autoKill.auto} (wanted 35), freezePartMs +${got.autoKill.part} (wanted 0)`)
  assert(got.partKill.dead, 'the Cleaver never killed the 1 HP hulk')
  near('a part kill', got.partKill.maxStop, 90)
  assert(got.partKill.shake >= 0.28 - 1e-9, `a part kill's shake: ${got.partKill.shake}, wanted at least 0.28`)
  assert(got.handBreak.broke, 'the hand never broke the crowned windup')
  near('a hand break', got.handBreak.maxStop, 35)
  assertEq("a push broke the Cleaver's windup", got.partBreak.broke, 1)
  near("a part's break", got.partBreak.ms, 90)
  assert(got.partBreak.vib.includes('[20,30,40]'), `a part's break haptic [20,30,40] not recorded: ${got.partBreak.vib}`)
})

// K-L8 no freeze on a miss (verifier r2's cases, the thresholds recomputed for the agreed formula)
check('K-L8', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    // (a) a Cleaver at a hulk 6 u BEHIND Still, and (e) the control: the same press with the switch off
    ${[true, false].map((on) => scene(on, `
      wall(1e6, 0, -6)
      W.__fire('arms')
      const f = ms()
      out.${on ? 'miss' : 'missOff'} = { ms: f.ms, shake: f.shake, vib: JSON.stringify(vib) }`)).join('\n')}
    // (b) one hulk in the arc, then three
    ${[1, 3].map((n) => scene(true, `
      walls(${n})
      W.__fire('arms')
      out.arc${n} = { ms: ms().ms, vib: JSON.stringify(vib) }`)).join('\n')}
    // (c) a Lens at a hulk 8 u away: nothing on the press, nothing while the bolt flies, 55 on the step it lands
    ${scene(true, `
      const far = wall(1e6, 0, 8)
      W.__fire('head')
      const press = ms().ms
      const steps = []
      for (let i = 0; i < 90; i++) { tick(far); steps.push(ms().ms) }
      const first = steps.findIndex((x) => x > 0)
      out.lens = { press, first, landed: steps[first], before: steps.slice(0, Math.max(0, first)).every((x) => x === 0), after: steps.slice(first + 1).every((x) => x === 0) }`)}
    // (f) the pose starts cocked with weight on, from 0 with it off; the autos' own attack never does
    ${[true, false].map((on) => scene(on, `
      W.__fire('arms')
      out.${on ? 'cockedOn' : 'cockedOff'} = { pose: W.__still.anim.pose, t: W.__still.anim.t, dur: W.__still.anim.dur }`) + scene(on, `
      W.__fire('torso')
      out.${on ? 'novaOn' : 'novaOff'} = { pose: W.__still.anim.pose, t: W.__still.anim.t, dur: W.__still.anim.dur }`) + scene(on, `
      W.__still.attack({ beat: 'shot', pushed: false })
      out.${on ? 'autoOn' : 'autoOff'} = W.__still.anim.t`)).join('\n')}
    return out
  }`)
  assertEq('(a) a Cleaver at a hulk behind: no freeze on the press', got.miss.ms, 0)
  assertEq('(a) no shake', got.miss.shake, 0)
  assertEq("(a) vibrate: only the hud's 12", got.miss.vib, '[12]')
  near('(b) one hulk in the arc', got.arc1.ms, 46)
  near('(b) three hulks in the arc', got.arc3.ms, 66)
  assertEq("(b) one hulk: the contact haptic comes on top of the hud's 12", got.arc1.vib, '[12,12]')
  assertEq('(c) a Lens at 8 u: nothing on the press', got.lens.press, 0)
  assert(got.lens.first > 0, `(c) the bolt never landed: ${JSON.stringify(got.lens)}`)
  assertEq('(c) nothing on any step before the bolt lands', got.lens.before, true)
  near('(c) the step it lands', got.lens.landed, 55)
  assertEq('(c) nothing after', got.lens.after, true)
  assert(got.missOff.ms > 0, `(e) the control: switch off, the same press must freeze (today's main.ts line), got ${got.missOff.ms} ms`)
  near("(e) the control is today's 35 ms", got.missOff.ms, 35)
  assert(Math.abs(got.cockedOn.t - 0.3 * got.cockedOn.dur) < 1e-9, `(f) weight on: the arc starts at 0.3 of its dur, got ${got.cockedOn.t} of ${got.cockedOn.dur}`)
  assert(Math.abs(got.novaOn.t - 0.25 * got.novaOn.dur) < 1e-9, `(f) weight on: the nova starts at 0.25 of its dur, got ${got.novaOn.t} of ${got.novaOn.dur}`)
  assertEq('(f) weight off: the arc starts at 0', got.cockedOff.t, 0)
  assertEq('(f) weight off: the nova starts at 0', got.novaOff.t, 0)
  assertEq("(f) the autos' attack never starts cocked", [got.autoOn, got.autoOff], [0, 0])
})

// K-L9 moves: a dash freezes at the landing and only if it struck bodies
check('K-L9', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    // bodies asleep: they stand where they are and never strike back; the dash runs them over all the same
    ${[['empty', null, 0, 27], ['three', null, 3, 27], ['hop', 'skitter', 1, 30]].map(([name, equip, n, steps]) => scene(true, `
      ${equip ? `W.__equip('${equip}')` : ''}
      for (let i = 0; i < ${n}; i++) { const b = W.__spawn('chaser', 0, 2 + i * 1.4, false); b.hp = 1e6 }
      W.__fire('legs')
      const rows = [ms().ms]
      for (let i = 0; i < ${steps}; i++) { C.hp = 100; W.__step(1 / 60); rows.push(ms().ms) }
      out.${name} = rows`)).join('\n')}
    return out
  }`)
  assert(got.empty.every((x) => x === 0), `an empty floor: expected 0 from the press to 10 steps after the landing, got ${JSON.stringify(got.empty)}`)
  assertEq('three walls: nothing on the press', got.three[0], 0)
  const land = got.three.findIndex((x) => x > 0)
  assert(land >= 15 && land <= 18, `three walls: the freeze came on step ${land}, wanted the landing, within a tick of travelMs 280 (step 17)`)
  assert(got.three.slice(0, land).every((x) => x === 0), `three walls: a freeze before the landing: ${JSON.stringify(got.three)}`)
  near('three walls: the landing', got.three[land], 98)
  assert(got.three.slice(land + 1).every((x) => x === 0), `three walls: a second freeze after the landing: ${JSON.stringify(got.three)}`)
  assert(got.hop.every((x) => x === 0), `Skitter over a wall: expected 0 throughout, got ${JSON.stringify(got.hop)}`)
})

process.exit(await run(process.argv.slice(2)))
