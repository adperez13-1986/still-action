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
  // W2: a crowned hulk 2 u ahead winds up, and the Cleaver breaks it twice over, each way in its own run: by a READY press (breaksBy.ready with the
  // switch on, nothing with it off: today) and by a real PUSH on the cooling button (breaksBy.pushed, on or off). The push run cools the button first
  // with a press on the empty floor
  const got = await evalJson(page, `() => {
    const out = {}
    for (const on of [true, false]) {
      for (const how of ['ready', 'push']) {
        // a fresh depth entered with the switch off (the stored one), then the weight turned on by the hook alone
        window.__enter(1, 1)
        ;(${SETUP})(on)
        ${HELPERS}
        C.pressure = false
        if (how === 'push') W.__fire('arms')
        const s0 = snap()
        const h = W.__spawn('chaser', 0, 2, true, 'plated')
        h.hp = 1e6
        let n = 0
        while (h.phase !== 'windup' && n++ < 240) tick(h)
        const wound = h.phase === 'windup'
        W.__fire('arms', how === 'push')
        const s1 = snap()
        const f = W.__runStats().at(-1)
        out[(on ? 'on' : 'off') + '/' + how] = {
          wound, broke: s1.breaks - s0.breaks, pushed: s1.breaksBy.pushed - s0.breaksBy.pushed, ready: s1.breaksBy.ready - s0.breaksBy.ready,
          pushes: s1.pushes - s0.pushes, sum: s1.breaksBy.ready + s1.breaksBy.pushed === s1.breaks, weight: s1.weight, mixed: s1.weightMixed ?? null, fields: f,
        }
      }
    }
    return out
  }`)
  const want = { 'on/ready': [1, 0, 1], 'on/push': [1, 1, 0], 'off/ready': [0, 0, 0], 'off/push': [1, 1, 0] }
  for (const [key, g] of Object.entries(got)) {
    const sw = key.split('/')[0]
    const s = shape(g.fields)
    for (const [k, ok] of Object.entries(s)) assert(ok, `${key}: the depth's stats have no good ${k}`)
    assert(g.wound, `${key}: the crowned hulk never wound up`)
    assertEq(`${key}: [breaks, breaksBy.pushed, breaksBy.ready] moved by`, [g.broke, g.pushed, g.ready], want[key])
    assertEq(`${key}: pushes moved by (only a real push counts)`, g.pushes, key.endsWith('push') ? 1 : 0)
    assertEq(`${key}: ready + pushed === breaks`, g.sum, true)
    assertEq(`${key}: the depth's weight stays the value at entry (__weight is not a level entry)`, g.weight, false)
    assertEq(`${key}: __weight is not a flip: no weightMixed`, g.mixed, null)
    // W1: the freeze counters move with the switch on (the contact and the break of a part's push), and stay 0 with it off
    if (sw === 'on') assert(g.fields.freezePartMs > 0 && g.fields.freezeAutoMs === 0, `${key}: freezePartMs should have moved and freezeAutoMs not, got ${g.fields.freezePartMs} / ${g.fields.freezeAutoMs}`)
    else assertEq(`${key}: both freeze counters stay 0`, [g.fields.freezePartMs, g.fields.freezeAutoMs], [0, 0])
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
    // a Cleaver's break: with weight on a READY press breaks a crowned windup (W2: the full effect); the break is 90 ms and the haptic is its own
    ${scene(true, `
      C.pressure = false
      const c = W.__spawn('chaser', 0, 2, true, 'plated')
      c.hp = 1e6
      let m = 0
      while (c.phase !== 'windup' && m++ < 240) tick(c)
      vib.length = 0
      const br0 = snap().breaks
      W.__fire('arms')
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
  assertEq("a ready Cleaver broke the windup", got.partBreak.broke, 1)
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

// ---- W2: full effect on ready casts (WEIGHT.md section 2.4, section 4) -------------------------------------------------------------------------

// K-L4: with weight on, a ready cast has a push's whole effect (the break rule, the threat aim, the reel, the pose and scale) and none of its cost;
// Patient Lens, Overrun and Plumb Line keep their push-only extras. Off: today. (A Plumb Line ready press with the anchor out snaps; the other half, a
// real push re-planting over a live anchor, cannot happen: the planted button is 'hold', tappable, never cooling. The negative test covers the line)
check('K-L4', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    // (a) a crowned hulk winding up 2 u ahead, then a ready Cleaver: it breaks and reels; counted as a ready break, no push, no strain. Off: it does not
    ${[true, false].map((on) => scene(on, `
      C.pressure = false
      const h = W.__spawn('chaser', 0, 2, true, 'plated')
      h.hp = 1e6
      let n = 0
      while (h.phase !== 'windup' && n++ < 240) tick(h)
      const wound = h.phase === 'windup'
      const s0 = snap(), strain0 = W.__run.strain
      W.__fire('arms')
      const s1 = snap()
      out.${on ? 'a' : 'aOff'} = { wound, broke: s1.breaks - s0.breaks, ready: s1.breaksBy.ready - s0.breaksBy.ready, pushed: s1.breaksBy.pushed - s0.breaksBy.pushed,
        pushes: s1.pushes - s0.pushes, strain: W.__run.strain - strain0, phase: h.phase }`)).join('\n')}
    // (b) an idle hulk 4 u ahead and a winding one 9 u off to the side: a ready Lens flies at the winding one. Off: ahead, into the idle one
    ${[true, false].map((on) => scene(on, `
      C.pressure = false
      const idle = W.__spawn('chaser', 0, 4, false)
      idle.hp = 1e6
      const w = W.__spawn('chaser', 5, 8, true, 'plated')
      w.hp = 1e6
      w.phase = 'windup'
      w.timer = 4000
      W.__fire('head')
      for (let i = 0; i < 60; i++) tick(w)
      out.${on ? 'b' : 'bOff'} = { idle: 1e6 - idle.hp, wound: 1e6 - w.hp }`)).join('\n')}
    // (c1) Patient Lens twice, 0.5 s apart, both ready: neither fires full; a real push on the cooling button does
    ${scene(true, `
      W.__equip('patient-lens')
      const t = wall(1e6, 0, 6)
      const dealt = () => { const d = 1e6 - t.hp; t.hp = 1e6; return d }
      W.__fire('head')
      for (let i = 0; i < 30; i++) tick(t)
      const first = dealt()
      ${READY('head')}
      W.__fire('head')
      for (let i = 0; i < 30; i++) tick(t)
      const second = dealt()
      W.__fire('head', true)
      for (let i = 0; i < 30; i++) tick(t)
      out.patient = { first, second, push: dealt() }`)}
    // (c2) Overrun: a ready one is the short step (overrun-step) and runs nothing over; a push on the cooling button is the charge and does
    ${scene(true, `
      W.__equip('overrun')
      const bodies = [3, 4.5, 6].map((z) => { const b = W.__spawn('chaser', 0, z, false); b.hp = 1e6; return b })
      const lost = () => bodies.reduce((a, b) => a + (1e6 - b.hp), 0)
      const beat = () => W.__partLog.filter((k) => k.kind === 'move').at(-1)?.beat
      W.__partLog.length = 0
      W.__fire('legs')
      for (let i = 0; i < 40; i++) tick(...bodies)
      out.overrun = { beat: beat(), lost: lost() }
      W.__partLog.length = 0
      W.__fire('legs', true)
      for (let i = 0; i < 40; i++) tick(...bodies)
      out.overrunPush = { beat: beat(), lost: lost() }`)}
    // (c3) Plumb Line: a ready press plants; a second ready press snaps (the anchor goes) and does not re-plant. A push re-plants
    ${scene(true, `
      W.__equip('plumb-line')
      const states = () => W.__partLog.filter((k) => k.kind === 'anchor').map((k) => k.state)
      W.__partLog.length = 0
      W.__fire('legs')
      const planted = !!C.parts.anchor
      W.__fire('legs')
      out.plumb = { planted, after: !!C.parts.anchor, states: states() }
      W.__partLog.length = 0
      W.__fire('legs', true)
      out.plumbPush = { after: !!C.parts.anchor, states: states() }`)}
    // (d) the pose and the scale: a ready cast stands as a push does (on); today it does not (off)
    ${[true, false].map((on) => scene(on, `
      walls(1)
      W.__fire('arms')
      out.${on ? 'd' : 'dOff'} = { pushed: W.__still.anim.pushed, scale: W.__still.group.scale.x }
      W.__fire('arms', true)
      out.${on ? 'dPush' : 'dPushOff'} = { pushed: W.__still.anim.pushed, scale: W.__still.group.scale.x }`)).join('\n')}
    // (e) Clamp Toss (a reel): a ready one breaks the windup it lifts, counted ready
    ${scene(true, `
      W.__equip('clamp-toss')
      C.pressure = false
      const h = W.__spawn('chaser', 0, 2, true, 'plated')
      h.hp = 1e6
      let n = 0
      while (h.phase !== 'windup' && n++ < 240) tick(h)
      const s0 = snap()
      W.__fire('arms')
      const s1 = snap()
      out.toss = { wound: n < 240, broke: s1.breaks - s0.breaks, ready: s1.breaksBy.ready - s0.breaksBy.ready, pushed: s1.breaksBy.pushed - s0.breaksBy.pushed }`)}
    // (f) the state a hit pays is a real push's to count: a ready Cleaver paying a chill is no "pushed into state"; a real push paying one is
    ${scene(true, `
      W.__equip('chill-vent')
      const t = wall(1e6, 0, 2)
      const paid = () => { const x = snap(); return { paid: x.paidBy.arms, pushedIn: x.pushedIntoState ?? 0 } }
      W.__fire('torso')
      const p0 = paid()
      W.__fire('arms')
      const p1 = paid()
      ${READY('torso')}
      W.__fire('torso')
      W.__fire('arms', true)
      const p2 = paid()
      out.paid = { ready: [p1.paid - p0.paid, p1.pushedIn - p0.pushedIn], push: [p2.paid - p1.paid, p2.pushedIn - p1.pushedIn] }`)}
    return out
  }`)
  assert(got.a.wound && got.aOff.wound, '(a) the crowned hulk never wound up')
  assertEq('(a) weight on: a ready Cleaver breaks the windup (breaks, ready, pushed)', [got.a.broke, got.a.ready, got.a.pushed], [1, 1, 0])
  assertEq('(a) it reels open, as a push leaves it', got.a.phase, 'recover')
  assertEq('(a) a ready cast is not a push', got.a.pushes, 0)
  assertEq('(a) and costs no strain', got.a.strain, 0)
  assertEq('(a) off: the same press does not break it', [got.aOff.broke, got.aOff.ready, got.aOff.pushed, got.aOff.phase], [0, 0, 0, 'windup'])
  assertEq('(b) weight on: the Lens flew at the winding hulk, past the idle one', [got.b.idle, got.b.wound > 0], [0, true])
  assert(got.bOff.idle > 0 && got.bOff.wound === 0, `(b) off: the Lens flies ahead into the idle hulk, got ${JSON.stringify(got.bOff)}`)
  assert(got.patient.push > 0 && got.patient.first < got.patient.push && got.patient.second < got.patient.push,
    `(c) Patient Lens: a ready shot must be weaker than a push's full one, got ${JSON.stringify(got.patient)}`)
  assert(got.patient.second < 32 && got.patient.second > 0, `(c) the second ready Patient Lens, 0.5 s on, deals under 32, got ${got.patient.second}`)
  assertEq('(c) Overrun ready plays overrun-step', got.overrun.beat, 'overrun-step')
  assertEq('(c) Overrun ready deals no run-over damage', got.overrun.lost, 0)
  assertEq('(c) the control: a pushed Overrun is the charge', got.overrunPush.beat, 'overrun-charge')
  assert(got.overrunPush.lost > 0, `(c) the control: a pushed Overrun must run something over, got ${got.overrunPush.lost}`)
  assert(got.plumb.planted, '(c) Plumb Line: the first ready press plants')
  assertEq('(c) Plumb Line: the second ready press snaps, the anchor goes', [got.plumb.after, got.plumb.states.includes('snap'), got.plumb.states.filter((x) => x === 'plant').length], [false, true, 1])
  assertEq('(c) the control: a push on the cooling button plants', [got.plumbPush.after, got.plumbPush.states.filter((x) => x === 'plant').length], [true, 1])
  assertEq('(d) weight on, a ready cast: the pushed pose and scale 1.16', [got.d.pushed, Math.abs(got.d.scale - 1.16) < 1e-6], [true, true])
  assertEq('(d) off, a ready cast: the plain pose and scale 1.08', [got.dOff.pushed, Math.abs(got.dOff.scale - 1.08) < 1e-6], [false, true])
  assertEq('(d) a real push stands the same either way', [got.dPush.pushed, got.dPushOff.pushed, Math.abs(got.dPush.scale - 1.16) < 1e-6, Math.abs(got.dPushOff.scale - 1.16) < 1e-6], [true, true, true, true])
  assertEq('(f) a ready Cleaver pays the chill and counts no push into a state: [paid, pushedIntoState]', got.paid.ready, [1, 0])
  assertEq('(f) a real push paying one counts it', got.paid.push, [1, 1])
  assert(got.toss.wound, '(e) the hulk never wound up')
  assertEq('(e) a ready Clamp Toss breaks the windup it lifts, counted ready (breaks, ready, pushed)', [got.toss.broke, got.toss.ready, got.toss.pushed], [1, 1, 0])
})

// K-L5: the push signature is a real push's alone. A ready cast under weight throws no embers, no [14,26,14]; a push throws both, on or off
check('K-L5', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    ${[true, false].map((on) => scene(on, `
      const rows = { ready: [], push: [] }
      for (const slot of ['head', 'torso', 'arms', 'legs']) {
        W.__still.pos.set(0, 0, 0)
        ${READY('head')};${READY('torso')};${READY('arms')};${READY('legs')}
        vib.length = 0
        fx()
        W.__fire(slot)
        const r = fx()
        rows.ready.push({ slot, sig: r.pushSig, vib: JSON.stringify(vib) })
        vib.length = 0
        W.__fire(slot, true)
        const p = fx()
        rows.push.push({ slot, sig: p.pushSig, vib: JSON.stringify(vib) })
      }
      out.${on ? 'on' : 'off'} = rows`)).join('\n')}
    return out
  }`)
  for (const sw of ['on', 'off']) {
    for (const r of got[sw].ready) {
      assertEq(`switch ${sw}: a ready ${r.slot} cast throws no push signature`, r.sig, 0)
      assert(!r.vib.includes('[14,26,14]'), `switch ${sw}: a ready ${r.slot} cast buzzed the push pattern: ${r.vib}`)
    }
    for (const p of got[sw].push) {
      assertEq(`switch ${sw}: a real ${p.slot} push throws the signature once`, p.sig, 1)
      assert(p.vib.includes('[14,26,14]'), `switch ${sw}: a real ${p.slot} push did not buzz [14,26,14]: ${p.vib}`)
    }
  }
})

// K-L5 (audio): a headless page runs no AudioContext, so the grind can only be read in the source: in sfx.ability every grind is guarded by `real`
// (a real push), the push voice (`big`) only changes pitch and gain, and `pushed` is no name in it at all
task('K-L5', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(HERE + '../../src/audio.ts', 'utf8')
  const start = src.indexOf('export function ability(')
  const body = src.slice(start, src.indexOf('\n}\n', start))
  assert(start > 0 && /export function ability\(beat: BeatKey, big: boolean, power = 0, real = big\)/.test(body), 'ability(beat, big, power = 0, real = big) is not the signature')
  const grinds = body.split('\n').filter((l) => /\b(smallGrind|grind)\(c, d, t/.test(l))
  assertEq('three grinds in ability(): fray-360, the rewind, the last', grinds.length, 3)
  for (const g of grinds) assert(/\breal\b/.test(g), `a grind not guarded by real: ${g.trim()}`)
  assert(!/\bpushed\b/.test(body), 'ability() still reads a name "pushed"')
  assert(/const r = big \? 0\.8 : 1/.test(body) && /const k = big \? 1\.3 : 1/.test(body), "the push voice's pitch and gain must read big")
})

// ---- W3: the Ask 1 numbers (WEIGHT.md section 2.5, section 4 K-L3) --------------------------------------------------------------------------

/**
 * The balancer's numbers as the check knows them (design/lean/3-balancer.md r3, WEIGHT.md 2.1), typed again here and not imported: a wrong
 * constant in src/weight.ts must be seen against this copy.
 */
const PRESETS = {
  B: { early: 1.4, deep: 1.65, boss: 1.3, dmg: { head: 1.2, torso: 1.8, arms: 1.2, legs: 1.8 }, vent: 1.4, dash: 2, cone: 180, shove: 1.2 },
  D: { early: 1.4, deep: 1.65, boss: 1.1, dmg: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 }, vent: 1.25, dash: 1.5, cone: 160, shove: 1.2 },
}
const VENT_IDS = ['pressure-vent', 'backdraft-vent', 'chill-vent']
const rnd = (x, k) => Math.round(x * k)
const u2 = (x, k) => +(x * k).toFixed(2)

/** A def (as JSON) with the preset's rules applied, written out from WEIGHT.md 2.1 and not from src/weight.ts. */
function expectedWeighed(def, P) {
  const out = JSON.parse(JSON.stringify(def))
  const k = P.dmg[def.slot]
  out.damage = rnd(def.damage, k)
  if (def.blastDamage !== undefined) out.blastDamage = rnd(def.blastDamage, k)
  const m = out.mod
  if (m) {
    if (m.kind === 'charge') m.minDamage = rnd(m.minDamage, k)
    if (['slam', 'overrun', 'reflect'].includes(m.kind)) m.damage = rnd(m.damage, k)
    if (m.kind === 'toss') m.wallDamage = rnd(m.wallDamage, k)
    if (m.kind === 'overrun') m.radius = u2(m.radius, P.dash)
  }
  if (VENT_IDS.includes(def.id)) out.radius = u2(def.radius, P.vent)
  if (def.shape === 'dash') out.radius = u2(def.radius, P.dash)
  if (def.id === 'scrap-cleaver') {
    out.cone = Math.min(360, rnd(def.cone, P.cone / 120))
    out.shove = P.shove
  }
  return out
}

// K-L3 (a, b): every part's numbers under both presets, at rank I and rank III, against the table written out in this file; nothing else differs;
// weighed() is idempotent, memoized, and pure
check('K-L3', RUN, async ({ page }) => {
  const got = await evalJson(page, `async () => {
    const W = window
    const wm = await import('/src/weight.ts')
    const ab = await import('/src/abilities.ts')
    const tp = await import('/src/temper.ts')
    const ids = W.__parts.map((d) => d.id)
    const out = { ids, rows: [], idem: [], pure: [] }
    for (const preset of ['B', 'D']) {
      W.__weightPreset(preset)
      for (const rank of [1, 3]) {
        for (const id of ids) {
          // the tempered def, unweighed, as the button carries it
          const def = tp.tempered(ab.byId(id), rank)
          out.rows.push({ preset, rank, id, def: JSON.parse(JSON.stringify(def)), got: W.__weighed(id, rank) })
          const before = JSON.stringify(def)
          const w = wm.weighed(def)
          out.pure.push({ preset, rank, id, same: wm.weighed(def) === w, mutated: JSON.stringify(def) !== before, moved: w !== def })
          out.idem.push({ preset, rank, id, idem: wm.weighed(w) === w })
        }
      }
    }
    W.__weightPreset('B')
    return out
  }`)
  assert(got.ids.length >= 30, `__parts lists ${got.ids.length} parts`)
  for (const r of got.rows) {
    assertEq(`(a) ${r.id} rank ${r.rank} under ${r.preset}: __weighed equals the table`, r.got, expectedWeighed(r.def, PRESETS[r.preset]))
  }
  for (const x of got.pure) {
    assert(x.same && !x.mutated && x.moved, `(b) ${x.id} rank ${x.rank} under ${x.preset}: weighed is not pure and memoized (same ${x.same}, mutated ${x.mutated})`)
  }
  for (const x of got.idem) assert(x.idem, `(b) ${x.id} rank ${x.rank} under ${x.preset}: weighed(weighed(d)) is not the same object`)
  // the named values of the brief
  const row = (preset, rank, id) => got.rows.find((r) => r.preset === preset && r.rank === rank && r.id === id)
  assertEq('Scrap Cleaver I under B: cone 180, shove 1.2', [row('B', 1, 'scrap-cleaver').got.cone, row('B', 1, 'scrap-cleaver').got.shove], [180, 1.2])
  assertEq('Scrap Cleaver I under D: cone 160', row('D', 1, 'scrap-cleaver').got.cone, 160)
  assertEq('Scrap Cleaver III under B: 120 x 1.3 = 156, then 234', [row('B', 3, 'scrap-cleaver').def.cone, row('B', 3, 'scrap-cleaver').got.cone], [156, 234])
  assertEq('Pressure Vent radius under B: 6.0 (4.3 x 1.4); D 5.4', [row('B', 1, 'pressure-vent').got.radius, row('D', 1, 'pressure-vent').got.radius], [u2(row('B', 1, 'pressure-vent').def.radius, 1.4), u2(row('B', 1, 'pressure-vent').def.radius, 1.25)])
  assertEq('Kickstart under B: run-over half-width 2.4 (the 4.8 u swath), D 1.8 (3.6)', [row('B', 1, 'kickstart').got.radius, row('D', 1, 'kickstart').got.radius], [2.4, 1.8])
  assertEq('Frayed Cleaver keeps its cones, no shove', [row('B', 1, 'frayed-cleaver').got.mod.cones, row('B', 1, 'frayed-cleaver').got.shove ?? null], [row('B', 1, 'frayed-cleaver').def.mod.cones, null])
})


// K-L3 (c, d, e): the first hit of a ready cast, the cone, the shove (fights on the arena). The page loops [name, switch, preset]: B, D, and off
const MODES = `[['B', true, 'B'], ['D', true, 'D'], ['off', false, 'B']]`

check('K-L3', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = { c: {}, d: {}, e: {} }
    for (const [name, on, p] of ${MODES}) {
      out.c[name] = {}; out.d[name] = {}; out.e[name] = {}
      // (c) the first hit of each ready cast on a wall (autos off: nothing else lands). The Kickstart's lands with the dash, the Lens's with the bolt
      ${scene('on', `
        W.__weightPreset(p)
        const t = wall(1e6, 0, 2); W.__fire('arms'); out.c[name].cleaver = 1e6 - t.hp`)}
      ${scene('on', `
        W.__weightPreset(p)
        const t = wall(1e6, 0, 2.5); W.__fire('torso'); out.c[name].vent = 1e6 - t.hp`)}
      ${scene('on', `
        W.__weightPreset(p)
        const t = wall(1e6, 0, 3); W.__fire('legs')
        for (let i = 0; i < 30; i++) { C.hp = 100; W.__step(1 / 60) }
        out.c[name].kickstart = 1e6 - t.hp`)}
      ${scene('on', `
        W.__weightPreset(p)
        const t = wall(1e6, 0, 6); W.__fire('head')
        for (let i = 0; i < 60; i++) tick(t)
        out.c[name].lens = 1e6 - t.hp`)}
      // (d) a hulk at 2 u, 85 degrees off the swing (the nearer hulk ahead takes the aim), and one at 95 degrees on the other side
      ${scene('on', `
        W.__weightPreset(p)
        const a = 85 * Math.PI / 180, b = 95 * Math.PI / 180
        const ahead = wall(1e6, 0, 1.2)
        const in85 = wall(1e6, 2 * Math.sin(a), 2 * Math.cos(a))
        const in95 = wall(1e6, -2 * Math.sin(b), 2 * Math.cos(b))
        W.__fire('arms')
        out.d[name] = { ahead: 1e6 - ahead.hp, at85: 1e6 - in85.hp, at95: 1e6 - in95.hp }
        // the shove is radial from Still, not along the swing: the struck hulk at 85 degrees keeps its bearing and moves out
        for (let i = 0; i < 6; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); W.__step(1 / 60) }
        out.d[name].bearing = Math.atan2(in85.pos.x, in85.pos.z) * 180 / Math.PI
        out.d[name].dist = Math.hypot(in85.pos.x, in85.pos.z)`)}
      // (e) the shove: a lone hulk at 2 u, 0.5 s after a ready Cleaver, how far from Still (Still held at the origin, the hulk free)
      ${scene('on', `
        W.__weightPreset(p)
        const t = wall(1e6, 0, 2)
        W.__fire('arms')
        let peak = 0
        for (let i = 0; i < 30; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); W.__step(1 / 60); peak = Math.max(peak, Math.hypot(t.pos.x, t.pos.z)) }
        out.e[name] = { at: Math.hypot(t.pos.x, t.pos.z), peak }`)}
    }
    return out
  }`)
  const want = {
    B: { cleaver: 22, vent: 27, kickstart: 22, lens: 31 },
    D: { cleaver: 21, vent: 27, kickstart: 22, lens: 30 },
    off: { cleaver: 18, vent: 15, kickstart: 12, lens: 26 },
  }
  for (const name of ['B', 'D', 'off']) assertEq(`(c) ${name}: the first hit of a ready cast`, got.c[name], want[name])
  assert(got.d.B.ahead > 0 && got.d.B.at85 > 0, `(d) B: the hulk at 85 degrees should be struck, got ${JSON.stringify(got.d.B)}`)
  assertEq('(d) B (180): 95 degrees off is outside', got.d.B.at95, 0)
  assert(got.d.D.ahead > 0, `(d) D: the aimed hulk should be struck`)
  assertEq('(d) D (160) and off (120): 85 degrees off is outside', [got.d.D.at85, got.d.off.at85], [0, 0])
  // the brief says "0.5 s after"; a hulk walks back to its 2 u standoff within 0.5 s (it is at 2.06 u by then, on or off), so the shove is read at its peak in that half second
  for (const name of ['B', 'D']) assert(got.e[name].peak >= 2.6, `(e) ${name}: the hulk's farthest from Still within 0.5 s of a ready Cleaver is ${got.e[name].peak.toFixed(2)} u, wanted >= 2.6`)
  assert(got.e.off.peak < 2.2, `(e) off: the hulk's farthest from Still is ${got.e.off.peak.toFixed(2)} u, wanted < 2.2 (no shove today)`)
  assert(Math.abs(got.d.B.bearing - 85) < 3 && got.d.B.dist > 2.4, `(d) B: the shove should be radial: the struck hulk at 85 degrees is now at ${got.d.B.bearing.toFixed(1)} degrees, ${got.d.B.dist.toFixed(2)} u out`)
})

/** In the page: the stored switch set to `on` through the pause screen's row (the one path that changes what the next level entry applies). */
const SWITCH = `(on) => { if ((localStorage.getItem('still-action.weight') === '1') !== on) (${FLIP})() }`

// K-L3 (f, g, h): level entry. Pack HP, the breakpoint, the boss (switch through the pause row, then __enter)
check('K-L3', RUN, async ({ page }) => {
  try {
    await entryChecks(page)
  } finally {
    await evalJson(page, `() => (${SWITCH})(false)`)
  }
})
async function entryChecks(page) {
  const got = await evalJson(page, `async () => {
    const W = window
    W.__run.dev = false
    const out = { packs: [], curve: {}, sentinel: [], boss: {} }
    const BASE = { chaser: 30, ranged: 20, swarm: 8, charger: 36, mender: 20 }
    const baseOf = (m) => (m.kind === 'ranged' && m.variant === 'lobber' ? 22 : BASE[m.kind])
    const take = () => {
      const lvl = W.__level()
      return {
        boss: !!lvl.boss,
        mul: W.__combat.packHpMul,
        heavy: W.__combat.heavyHpMul,
        spots: lvl.packs.map((pk) => pk.members.map((m) => [m.kind, m.variant ?? null, +m.x.toFixed(3), +m.z.toFixed(3)])),
        packs: W.__combat.packs.map((pk) => ({ elite: !!pk.elite, members: pk.members.map((m) => ({ kind: m.kind, variant: m.variant ?? null, base: baseOf(m), hp: m.hp })) })),
      }
    }
    for (const depth of [1, 2, 4, 5]) out.curve[depth] = W.__curveAt(depth).hp
    for (const preset of ['B', 'D']) {
      W.__weightPreset(preset)
      for (const depth of [1, 2, 4, 5]) {
        for (const seed of [1, 2, 3]) {
          const row = { preset, depth, seed }
          for (const on of [false, true]) {
            ;(${SWITCH})(on)
            W.__enter(depth, seed)
            row[on ? 'on' : 'off'] = take()
            row[on ? 'onWeight' : 'offWeight'] = W.__combat.weight
          }
          out.packs.push(row)
        }
      }
    }
    // (f) the breakpoint: sentinels at depth 1 (every ordinary one 28), and a white Lens that kills one
    for (const preset of ['B', 'D']) {
      W.__weightPreset(preset)
      ;(${SWITCH})(true)
      const row = { preset, level: [] }
      for (const seed of [1, 2, 3, 4, 5]) {
        W.__enter(1, seed)
        for (const pk of W.__combat.packs) pk.members.forEach((m, i) => { if (m.kind === 'ranged' && !m.variant && !(pk.elite && i === 0)) row.level.push(m.hp) })
      }
      // the Lens against a spawned sentinel at depth 1 (the spawn takes the same multiplier): one ready press, the arena, nothing else landing
      W.__enter(1, 1)
      ;(${SETUP})(true)
      W.__weightPreset(preset)
      {
        const C = W.__combat
        C.hurtPlayer = () => {}
        W.__still.facing = 0
        const sn = W.__spawn('ranged', 0, 6, true)
        row.spawned = sn.hp
        W.__fire('head')
        for (let i = 0; i < 90 && !sn.dead; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); W.__step(1 / 60) }
        row.dead = sn.dead || sn.hp <= 0
        row.left = sn.hp
      }
      out.sentinel.push(row)
    }
    // (h) the boss: depth 3 (the 6-depth run's first boss)
    for (const preset of ['B', 'D']) {
      W.__weightPreset(preset)
      for (const on of [false, true]) {
        ;(${SWITCH})(on)
        W.__enter(3, 1)
        const C = W.__combat
        const plan = W.__plan(3).boss
        const b = C.boss
        const row = { preset, on, plan: plan && plan.hp, kind: plan && plan.kind, max: b && b.maxHp, hp: b && b.hp, mul: C.packHpMul }
        if (b) {
          C.hurtPlayer = () => {}
          const pack = C.packs.find((pk) => pk.members.includes(b))
          if (pack && pack.state === 'asleep') C.wake(pack)
          row.at = {}
          for (const frac of [0.56, 0.54]) {
            W.__enter(3, 1)
            const c2 = W.__combat, b2 = c2.boss
            c2.hurtPlayer = () => {}
            const pk2 = c2.packs.find((pk) => pk.members.includes(b2))
            if (pk2 && pk2.state === 'asleep') c2.wake(pk2)
            b2.hp = frac * b2.maxHp
            for (let i = 0; i < 3; i++) { c2.hp = 100; W.__still.pos.set(0, 0, 12); W.__step(1 / 60) }
            row.at[frac] = { over: b2.overloaded, max: b2.maxHp }
          }
        }
        out.boss[preset + (on ? '/on' : '/off')] = row
      }
    }
    ;(${SWITCH})(false)
    W.__weightPreset('B')
    return out
  }`)

  // (f) the breakpoint
  for (const r of got.sentinel) {
    assert(r.level.length >= 3, `(f) ${r.preset}: only ${r.level.length} ordinary sentinels in 5 depth-1 levels`)
    assert(r.level.every((hp) => hp === 28), `(f) ${r.preset}: an ordinary sentinel at depth 1 has HP ${[...new Set(r.level)]}, wanted 28 (20 x 1.4)`)
    assertEq(`(f) ${r.preset}: a spawned sentinel at depth 1`, r.spawned, 28)
    assert(r.dead, `(f) ${r.preset}: one ready white Lens left a sentinel with ${r.left} HP`)
  }
  // (g) pack HP, the same seed on and off, depths 1 (early) and 4 (deep)
  assertEq('the 6-depth curve this check reads: d1 1, d2, d4 1.1 (R3)', [got.curve[1], got.curve[4]], [1, 1.1])
  let ordinary = 0
  for (const r of got.packs) {
    const tag = `(g) ${r.preset} depth ${r.depth} seed ${r.seed}`
    assertEq(`${tag}: the switch really was off, then on, at entry`, [r.offWeight, r.onWeight], [false, true])
    assertEq(`${tag}: the generated level (the packs' places) equals on and off`, r.on.spots, r.off.spots)
    assertEq(`${tag}: the pack roster equals on and off`, r.on.packs.map((p) => p.members.map((m) => m.kind + (m.variant ?? ''))), r.off.packs.map((p) => p.members.map((m) => m.kind + (m.variant ?? ''))))
    assert(!r.on.boss, `${tag}: a boss level (pick other depths)`)
    const k = r.depth < 4 ? PRESETS[r.preset].early : PRESETS[r.preset].deep
    assertEq(`${tag}: packHpMul on / off`, [r.on.mul, r.off.mul], [k, 1])
    assertEq(`${tag}: heavyHpMul stays 1`, [r.on.heavy, r.off.heavy], [1, 1])
    r.on.packs.forEach((pk, pi) => {
      pk.members.forEach((m, mi) => {
        const off = r.off.packs[pi].members[mi]
        if (pk.elite && mi === 0) return assertEq(`${tag}: an elite pack's leader (${m.kind}) is equal on and off`, m.hp, off.hp)
        ordinary++
        const curve = got.curve[r.depth]
        assertEq(`${tag}: ${m.kind}${m.variant ? '/' + m.variant : ''} on, one rounding of base x curve x ${k}`, m.hp, Math.round(m.base * curve * k))
        assertEq(`${tag}: ${m.kind} off, today's round(base x curve)`, off.hp, Math.round(off.base * curve))
      })
    })
  }
  assert(ordinary >= 100, `only ${ordinary} ordinary bodies were checked`)
  // (h) the boss
  for (const preset of ['B', 'D']) {
    const k = PRESETS[preset].boss
    const off = got.boss[`${preset}/off`], on = got.boss[`${preset}/on`]
    assert(on.plan > 0 && on.max !== undefined, `(h) ${preset}: no boss at depth 3 (kind ${on.kind})`)
    assertEq(`(h) ${preset} off: maxHp is bossFor's HP, untouched`, off.max, off.plan)
    assertEq(`(h) ${preset} on: maxHp is round(bossFor(3).hp x ${k})`, on.max, Math.round(on.plan * k))
    assertEq(`(h) ${preset}: the boss level's packHpMul stays 1`, on.mul, 1)
    assert(!on.at[0.56].over, `(h) ${preset}: overloaded at 0.56 x maxHp`)
    assert(on.at[0.54].over, `(h) ${preset}: not overloaded at 0.54 x maxHp`)
    assertEq(`(h) ${preset}: maxHp unchanged by the thresholds' steps`, [on.at[0.56].max, on.at[0.54].max], [on.max, on.max])
  }
}

// K-L3 (j): reaches() and wouldPay() take the hud's unweighed defs (the break hint, the push cue) and answer for the weighed ones: a body just past
// today's reach but inside the weighed one is reached with weight on, and not off
check('K-L3', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    for (const [name, on, p] of ${MODES}) {
      ${scene('on', `
        W.__weightPreset(p)
        const slotDef = (slot) => W.__hud.slots.find((x) => x.slot === slot).def
        const o = W.__still.pos
        // the Vent: a hulk 0.9 u past today's blast (the radius is the def's), inside B's 6.0 and D's 5.4 only if the room is
        const vent = slotDef('torso')
        const far = wall(1e6, 0, vent.radius + 0.5)
        const row = { ventReach: C.reaches(vent, o, far), ventR: vent.radius }
        // Kickstart: the run-over's reach is range + half-width + the body's radius
        const kick = slotDef('legs')
        const near = wall(1e6, 0, 0.5)
        near.pos.set(0, 0, kick.range + kick.radius + near.radius + 0.5)
        row.kickReach = C.reaches(kick, o, near)
        // the push cue: Overrun pays 'marked'; a marked hulk just past its charge's reach
        W.__equip('overrun')
        const over = slotDef('legs')
        const m = wall(1e6, 0, 0.5)
        m.pos.set(0, 0, over.mod.range + over.mod.radius + m.radius + 0.6)
        C.setState(m, 'marked', 5, 'head')
        row.pay = C.wouldPay(over, o)
        out[name] = row`)}
    }
    return out
  }`)
  assertEq('(j) off: the Vent does not reach a hulk 0.5 u past its blast, Kickstart not a body 0.5 u past its run-over, Overrun does not cue', [got.off.ventReach, got.off.kickReach, got.off.pay], [false, false, false])
  for (const name of ['B', 'D']) assertEq(`(j) ${name}: the weighed reach is the one asked (Vent, Kickstart, the push cue)`, [got[name].ventReach, got[name].kickReach, got[name].pay], [true, true, true])
})

// K-L3 (i), the lead's "K-L3g": the cards tell the truth. With weight on, the compare card (the pickup card is the same screen) and the loadout card show
// weighed(def)'s damage and radius; off, the def's. The text is read from the DOM, for every part, against the label rules written out here
check('K-L3', RUN, async ({ page }) => {
  try {
    await cardChecks(page)
  } finally {
    await evalJson(page, `() => (${SWITCH})(false)`)
  }
})
async function cardChecks(page) {
  const got = await evalJson(page, `async () => {
    const W = window
    const out = { rows: [], loadout: {}, vent: {} }
    const ids = W.__parts.map((d) => d.id)
    const ab = await import('/src/abilities.ts')
    const statOf = (card, label) => [...card.querySelectorAll('.stat')].map((s) => [s.querySelector('span').textContent, s.querySelector('b').textContent]).find(([l]) => l === label)?.[1]
    const readCard = (id) => {
      W.__pause.compare(null, ab.byId(id), [], () => {}, () => {})
      const cards = [...document.querySelectorAll('#pause .pcard')]
      const card = cards[cards.length - 1]
      const stats = [...card.querySelectorAll('.stat')].map((s) => [s.querySelector('span').textContent, s.querySelector('b').textContent])
      W.__pause.hide()
      return stats
    }
    for (const on of [false, true]) {
      ;(${SWITCH})(on)
      W.__weightPreset('B')
      for (const id of ids) {
        const def = JSON.parse(JSON.stringify(ab.byId(id)))
        out.rows.push({ on, id, def, w: W.__weighed(id), stats: readCard(id) })
      }
    }
    // the loadout card follows the row at once: the Vent's damage before the click, and after it
    ;(${SWITCH})(false)
    W.__pause.loadout(W.__hud.slots, () => {})
    const ventCard = () => [...document.querySelectorAll('#pause .pcard')].find((c) => c.querySelector('.pname')?.textContent.startsWith('Pressure Vent'))
    out.loadout.before = statOf(ventCard(), 'damage')
    ;[...document.querySelectorAll('#pause .rule')].find((x) => x.textContent.startsWith('weight')).click()
    out.loadout.after = statOf(ventCard(), 'damage')
    ;[...document.querySelectorAll('#pause .rule')].find((x) => x.textContent.startsWith('weight')).click()
    out.loadout.back = statOf(ventCard(), 'damage')
    W.__pause.hide()
    return out
  }`)
  // the label rules of pause.ts (damageLabel, reach), written out again
  const damageText = (d) => {
    const m = d.mod
    if (m?.kind === 'charge') return `${m.minDamage}–${d.damage}`
    if (m?.kind === 'fan') return `${d.damage} ×${m.count}`
    if (m?.kind === 'overrun') return `${d.damage} / ${m.damage} held`
    if (['ward', 'rewind', 'hop'].includes(d.shape)) return '–'
    return String(d.damage)
  }
  const REACH = { bolt: 'range', lob: 'range', nova: 'radius', ward: 'radius', decoy: 'radius', arc: 'reach', grab: 'reach', catch: 'radius', dash: 'distance', hop: 'distance', anchor: 'snap', rewind: 'rewind' }
  // the card rounds a reach to one decimal (a weighed vent's 6.02 reads 6)
  const oneDp = (x) => (typeof x === 'number' ? +x.toFixed(1) : x)
  const reachText = (d) => String(oneDp(['nova', 'ward', 'decoy', 'catch'].includes(d.shape) ? d.radius : d.shape === 'rewind' ? (d.windowMs ?? 0) / 1000 : d.range))
  let moved = 0
  for (const r of got.rows) {
    const shown = r.on ? r.w : r.def
    const stats = Object.fromEntries(r.stats)
    assertEq(`(i) ${r.id}, weight ${r.on ? 'on' : 'off'}: the card's damage text`, stats.damage, damageText(shown))
    assertEq(`(i) ${r.id}, weight ${r.on ? 'on' : 'off'}: the card's reach text (${REACH[r.def.shape]})`, stats[REACH[r.def.shape]], reachText(shown))
    if (r.on && damageText(r.w) !== damageText(r.def)) moved++
  }
  assert(moved >= 10, `(i) only ${moved} cards read different numbers with weight on`)
  const vent = (on) => got.rows.find((x) => x.on === on && x.id === 'pressure-vent')
  assertEq('(i) a torso part: Pressure Vent reads 27 on and 15 off', [Object.fromEntries(vent(true).stats).damage, Object.fromEntries(vent(false).stats).damage], [String(vent(true).w.damage), String(vent(false).def.damage)])
  assertEq('(i) the Vent card: 27 on, 15 off (the weighed def and the def)', [vent(true).w.damage, vent(false).def.damage], [27, 15])
  assertEq('(i) the loadout card follows the switch row at once: off, on, off', [got.loadout.before, got.loadout.after, got.loadout.back], ['15', '27', '15'])
}

// ---- W4: per-slot drama (WEIGHT.md §2.6, §4) ----------------------------------------------------------------------------------------------------

/**
 * In a scene: \`names(m)\` the drama names heard since \`m = W.__heard.length\` (a contact, the duck, a break's heft); \`ticks(m)\` the head's contact
 * entries with their pierce count; \`spawns()\` the particles and chunks spawned since the last read.
 */
const DRAMA = `
  const H = W.__heard
  const names = (m) => H.slice(m).map((h) => h.name).filter((n) => n.startsWith('contact:') || n === 'duck' || n === 'breakHeavy')
  const ks = (m) => H.slice(m).filter((h) => h.name === 'contact:head').map((h) => h.k)
  const spawns = () => W.__spawns()
`

// K-L11 the drama (__heard): each slot's contact is heard once, on the contact and never on a whiff; off, never. The head's tick climbs a semitone per pierce
// and only its first body flinches (the tilt is away from Still and back to nothing); a part's break has the Anvil's heft; and the drama adds no particle to a
// crowd (the spawn counts of a press are equal on and off for the arms, torso and legs; the head's is the gather's six, at the lens, and no more)
check('K-L11', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    ${[true, false].map((on) => `
    out.${on ? 'on' : 'off'} = {}
    ${scene(on, `
      ${DRAMA}
      const o = out.${on ? 'on' : 'off'}
      // arms: a Cleaver through three hulks (once), then at a hulk behind Still (a whiff: none, however long after)
      let m = H.length
      walls(3); W.__fire('arms'); o.arms = names(m)
      for (let i = 0; i < 20; i++) tick()
      o.armsAfter = names(m)
      for (const b of C.enemies) b.hp = 0
    `)}
    ${scene(on, `
      ${DRAMA}
      const o = out.${on ? 'on' : 'off'}
      wall(1e6, 0, -6)
      const m = H.length
      W.__fire('arms'); for (let i = 0; i < 20; i++) tick()
      o.whiff = names(m)
    `)}
    ${scene(on, `
      ${DRAMA}
      const o = out.${on ? 'on' : 'off'}
      // torso: a Vent through three hulks round Still: the whump and the duck, once each
      ring(3)
      const m = H.length
      W.__fire('torso'); o.torso = names(m)
      for (let i = 0; i < 20; i++) tick()
      o.torsoAfter = names(m)
    `)}
    ${scene(on, `
      ${DRAMA}
      const o = out.${on ? 'on' : 'off'}
      // head: a Lens at a hulk 8 u away: nothing on the press, nothing in flight, one tick on the step the bolt lands (the step that freezes)
      const far = wall(1e6, 0, 8)
      const m = H.length
      W.__fire('head')
      o.headPress = names(m)
      const steps = []
      for (let i = 0; i < 90; i++) { const before = names(m).length; tick(far); const f = ms(); steps.push({ named: names(m).length - before, ms: f.ms }) }
      o.headSteps = steps.map((x) => x.named)
      o.headLand = steps.findIndex((x) => x.ms > 0)
      o.headAt = steps.findIndex((x) => x.named > 0)
    `)}
    ${scene(on, `
      ${DRAMA}
      const o = out.${on ? 'on' : 'off'}
      // legs: a Kickstart through three sleeping hulks: nothing on the press or in flight, one slam on the landing step
      for (let i = 0; i < 3; i++) { const b = W.__spawn('chaser', 0, 2 + i * 1.4, false); b.hp = 1e6 }
      const m = H.length
      W.__fire('legs')
      o.legsPress = names(m)
      const steps = []
      for (let i = 0; i < 40; i++) { const before = names(m).length; C.hp = 100; W.__step(1 / 60); const f = ms(); steps.push({ named: names(m).length - before, ms: f.ms }) }
      o.legsLand = steps.findIndex((x) => x.ms > 0)
      o.legsAt = steps.findIndex((x) => x.named > 0)
      o.legsCount = steps.reduce((a, x) => a + x.named, 0)
    `)}
    `).join('\n')}
    // the pierce: a Cracked Lens down a line of three hulks (asleep, so they stand and never strike back)
    ${[true, false].map((on) => scene(on, `
      ${DRAMA}
      W.__equip('cracked-lens')
      const line = [3, 5.2, 7.4].map((z) => { const b = W.__spawn('chaser', 0, z, false); b.hp = 1e6; return b })
      const m = H.length
      const up = (b) => { const v = new b.pos.constructor(0, 1, 0).applyQuaternion(b.group.quaternion); return { x: v.x, z: v.z } }
      const tilt = (b) => Math.hypot(up(b).x, up(b).z)
      W.__fire('head')
      let peak = [0, 0, 0], order = ['', '', '']
      for (let i = 0; i < 40; i++) { C.hp = 100; W.__step(1 / 60); line.forEach((b, j) => { if (tilt(b) > peak[j]) { peak[j] = tilt(b); order[j] = b.group.rotation.order } }) }
      out.${on ? 'pierceOn' : 'pierceOff'} = { ks: ks(m), peak, order, rest: line.map((b) => [b.group.rotation.order, b.group.rotation.x, b.group.rotation.z]) }`)).join('\n')}
    // the tilt is away from Still: a hulk off to the side (3, 3), a Lens at it; the top of the body moves along the bearing out from Still
    ${scene(true, `
      ${DRAMA}
      const b = W.__spawn('chaser', 3, 3, false); b.hp = 1e6
      W.__fire('head')
      let best = null
      for (let i = 0; i < 30; i++) {
        C.hp = 100; W.__step(1 / 60)
        const v = new b.pos.constructor(0, 1, 0).applyQuaternion(b.group.quaternion)
        const away = Math.hypot(b.pos.x, b.pos.z)
        const along = (v.x * b.pos.x + v.z * b.pos.z) / away
        if (!best || along > best.along) best = { along, across: Math.abs(v.x * b.pos.z - v.z * b.pos.x) / away }
      }
      out.away = best`)}
    // the particles: a press, counted as spawned. A Cleaver through five hulks and through one, a Vent through five, a Kickstart through three, a Lens at one
    ${[true, false].map((on) => [
      ['cleaver5', 'walls(5)', 'arms', 0], ['cleaver1', 'wall(1e6, 0, 2)', 'arms', 0], ['vent5', 'ring(5)', 'torso', 0],
      ['kick3', 'for (let i = 0; i < 3; i++) { const b = W.__spawn("chaser", 0, 2 + i * 1.4, false); b.hp = 1e6 }', 'legs', 40], ['lens1', 'wall(1e6, 0, 3)', 'head', 30],
    ].map(([name, build, slot, steps]) => scene(on, `
      ${DRAMA}
      const o = (out.spawn ??= {})
      ${build}
      spawns()
      W.__fire('${slot}')
      let n = spawns()
      for (let i = 0; i < ${steps}; i++) { C.hp = 100; W.__step(1 / 60); n += spawns() }
      ;(o.${name} ??= {}).${on ? 'on' : 'off'} = n`)).join('\n')).join('\n')}
    // a part's break: the Anvil's heft
    ${[true, false].map((on) => scene(on, `
      ${DRAMA}
      C.pressure = false
      const c = W.__spawn('chaser', 0, 2, true, 'plated'); c.hp = 1e6
      let k = 0
      while (c.phase !== 'windup' && k++ < 240) tick(c)
      const m = H.length, br0 = snap().breaks
      W.__fire('arms')
      out.${on ? 'breakOn' : 'breakOff'} = { broke: snap().breaks - br0, names: names(m), shake: ms().shake }`)).join('\n')}
    return out
  }`)
  // ---- the names
  assertEq('(arms, on) a struck Cleaver: contact:arms once', got.on.arms, ['contact:arms'])
  assertEq('(arms, on) and nothing after', got.on.armsAfter, ['contact:arms'])
  assertEq('(arms, on) a whiff: nothing, then or later', got.on.whiff, [])
  assertEq('(torso, on) a struck Vent: contact:torso and the duck, once each', got.on.torso, ['contact:torso', 'duck'])
  assertEq('(torso, on) and nothing after', got.on.torsoAfter, ['contact:torso', 'duck'])
  assertEq('(head, on) a Lens: nothing on the press', got.on.headPress, [])
  assert(got.on.headLand > 0, `(head, on) the bolt never landed: ${JSON.stringify(got.on.headSteps)}`)
  assertEq('(head, on) one contact:head, on the step the bolt lands', [got.on.headAt, got.on.headSteps.reduce((a, b) => a + b, 0)], [got.on.headLand, 1])
  assertEq('(legs, on) a Kickstart: nothing on the press', got.on.legsPress, [])
  assert(got.on.legsLand > 10, `(legs, on) the landing froze on step ${got.on.legsLand}`)
  assertEq('(legs, on) one contact:legs, on the landing step', [got.on.legsAt, got.on.legsCount], [got.on.legsLand, 1])
  for (const k of ['arms', 'armsAfter', 'whiff', 'torso', 'torsoAfter', 'headPress', 'legsPress'])
    assertEq(`(off) ${k}: no contact:* and no duck, ever`, got.off[k], [])
  assertEq('(off) a Lens: nothing on any step', got.off.headSteps.every((x) => x === 0), true)
  assertEq('(off) a Kickstart: nothing on any step', got.off.legsCount, 0)
  // ---- the head: a rising tick per pierce, the first body only flinches
  assertEq('(pierce, on) the tick climbs one step per body the bolt goes through', got.pierceOn.ks, [0, 1, 2])
  assert(got.pierceOn.peak[0] > 0.15 && got.pierceOn.peak[0] < 0.18, `(pierce, on) the first body's flinch, at its fullest in the struck tick: tilt ${got.pierceOn.peak[0]}, wanted sin(0.17) = 0.169`)
  assert(got.pierceOn.peak[1] < 1e-6 && got.pierceOn.peak[2] < 1e-6, `(pierce, on) only the first body flinches: the others tilted ${got.pierceOn.peak[1]}, ${got.pierceOn.peak[2]}`)
  assertEq('(pierce, on) every body is upright, in the default order, 40 steps on', got.pierceOn.rest, [['XYZ', 0, 0], ['XYZ', 0, 0], ['XYZ', 0, 0]])
  assertEq('(pierce, off) no tick, no flinch', [got.pierceOff.ks, got.pierceOff.peak], [[], [0, 0, 0]])
  assert(got.away.along > 0.15 && got.away.along > 3 * got.away.across, `(away) the top of the body moves out from Still: along ${got.away.along}, across ${got.away.across}`)
  // ---- no new particles in a crowd
  for (const name of ['cleaver5', 'cleaver1', 'vent5', 'kick3'])
    assertEq(`(particles) ${name}: the press spawns as many with the drama as without (${JSON.stringify(got.spawn[name])})`, got.spawn[name].on, got.spawn[name].off)
  assertEq(`(particles) a Lens: the gather's six at the lens, nothing more (${JSON.stringify(got.spawn.lens1)})`, got.spawn.lens1.on - got.spawn.lens1.off, 6)
  // ---- the break
  assertEq('(break, on) a ready Cleaver breaks the windup', got.breakOn.broke, 1)
  assert(got.breakOn.names.includes('breakHeavy'), `(break, on) the Anvil's heft was not heard: ${JSON.stringify(got.breakOn.names)}`)
  assert(got.breakOn.shake >= 0.4 - 1e-9, `(break, on) a part's break shakes ${got.breakOn.shake}, wanted at least 0.4`)
  assertEq('(break, off) no heft', got.breakOff.names.includes('breakHeavy'), false)
})

// K-L13 the crowd's flash (lead's W4 review): a part that strikes n bodies at once caps each one's hit flash at 1/sqrt(n), so a crowd stays bodies
// under bloom; one body keeps today's full flash; off, every struck body flashes full
check('K-L13', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    const out = {}
    ${[true, false].map((on) => `
    ${scene(on, `
      const five = walls(5)
      W.__fire('arms')
      out.${on ? 'on5' : 'off5'} = five.map((b) => b.flash)
      for (const b of C.enemies) b.hp = 0
    `)}
    ${scene(on, `
      const one = walls(1)
      W.__fire('arms')
      out.${on ? 'on1' : 'off1'} = one.map((b) => b.flash)
    `)}`).join('')}
    return out
  }`)
  const cap = 1 / Math.sqrt(5)
  assert(got.on5.length === 5 && got.on5.every((f) => f > 0 && f <= cap + 1e-9), `(on) five struck hulks: each flash at most ${cap.toFixed(3)}, got ${JSON.stringify(got.on5)}`)
  assert(got.on1.length === 1 && got.on1[0] > cap + 0.1, `(on) one struck hulk keeps its full flash, got ${JSON.stringify(got.on1)}`)
  assert(got.off5.every((f) => f > cap + 0.1), `(off) five struck hulks flash full, as today, got ${JSON.stringify(got.off5)}`)
})

// ---- W5: the whole trial (WEIGHT.md section 4 K-L12) ----------------------------------------------------------------------------------------

/** The sim's own numbers for the same quantity (design/lean/3-balancer.md: the agreed formula's freeze share of pack time, and parts' share of it). */
const SIM = { share: '4-7%', parts: '77%' }
/** K-L12's gate: the freeze budget (share of fight time) and the part share's floor. */
const BUDGET = { share: 0.1, parts: 0.6 }

/**
 * One scripted fight, in the page (self-contained: it is sent as source): preset B, weight on, the autos on, the starting loadout, Math.random
 * seeded with mulberry32(seed) after the setup (still.wear draws it). Still stands at the origin facing +z with his HP put back each tick, as
 * fights.mjs does, so no ending triggers. The fight ends when every body is dead, or at 60 s of game time.
 * \`scenario\`: 'hulks' (three at 3 u), 'mites' (six, one brood at 5 u) or 'mixed' (a hulk at 3 u, a sentinel at 7 u, a ram at 6 u the other way).
 * \`bot\`: 'eager' casts every ready part at once; 'hesitant' casts a part 3.7 s after it was first seen ready (never-melt's hesitation).
 * Returns the freeze the weight trial added (part / auto), the game ms, the pending hitstop of every source read each tick (INFO), and who killed what.
 */
const FIGHT = `(arg) => {
  const W = window
  const mulberry32 = (a) => () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  ;(${SETUP})(true)
  const C = W.__combat
  C.autoAttack = true
  // the d1-2 entry value, as enterLevel(1) sets it with the switch on (the arena is built without one)
  C.packHpMul = 1.4
  C.heavyHpMul = 1
  const original = Math.random
  Math.random = mulberry32(arg.seed)
  try {
    const around = (n, r, a0) => Array.from({ length: n }, (_, k) => [Math.sin(a0 + (k * 2 * Math.PI) / n) * r, Math.cos(a0 + (k * 2 * Math.PI) / n) * r])
    const a0 = Math.random() * Math.PI * 2
    if (arg.scenario === 'hulks') for (const [x, z] of around(3, 3, a0)) W.__spawn('chaser', x, z, true)
    else if (arg.scenario === 'mites') W.__pack(around(6, 5, a0).map(([x, z]) => ({ kind: 'swarm', x, z })), true)
    else {
      W.__spawn('chaser', ...around(1, 3, a0)[0], true)
      W.__spawn('ranged', ...around(1, 7, a0 + 2)[0], true)
      W.__spawn('charger', ...around(1, 6, a0 + Math.PI)[0], true)
    }
    const st = W.__run.stats[W.__run.stats.length - 1]
    const was = { part: st.freezePartMs, auto: st.freezeAutoMs, kills: { ...st.kills }, ready: st.breaksBy.ready, hand: st.hand ?? 0 }
    const SLOTS = ['head', 'torso', 'arms', 'legs']
    const readySince = {}
    W.__fx()
    let all = 0, lost = 0, ticks = 0, cleared = false, casts = 0
    for (let i = 0; i < 60 * 60; i++) {
      for (const slot of SLOTS) {
        if (!W.__hud.isReady(slot)) { readySince[slot] = null; continue }
        readySince[slot] ??= C.time
        if (arg.bot === 'eager' || C.time - readySince[slot] >= 3.7 - 1e-9) { W.__fire(slot); readySince[slot] = null; casts++ }
      }
      const hp0 = 100
      C.hp = hp0
      W.__still.pos.set(0, 0, 0)
      W.__step(1 / 60)
      lost += hp0 - C.hp
      ticks++
      all += W.__fx().hitstop * 1000
      if (C.enemies.every((e) => e.dead)) { cleared = true; break }
    }
    const now = W.__run.stats[W.__run.stats.length - 1]
    return {
      part: now.freezePartMs - was.part, auto: now.freezeAutoMs - was.auto, all, gameMs: ticks * 1000 / 60, cleared, casts, lost,
      kills: { part: now.kills.part - was.kills.part, auto: now.kills.auto - was.kills.auto, other: now.kills.other - was.kills.other },
    }
  } finally {
    Math.random = original
  }
}`

// K-L12 the budget: scripted fights (3 scenarios x seeds 1-5, to the clear or 60 s) with two bots, preset B, weight on, the autos on. PASS: the freeze the trial
// adds is at most 10% of fight time (game ms + frozen ms, the sim's own denominator) for each bot, and parts own at least 60% of it. Prints both beside the sim's
check('K-L12', RUN, async ({ page }) => {
  const rows = []
  for (const bot of ['eager', 'hesitant']) {
    for (const scenario of ['hulks', 'mites', 'mixed']) {
      for (let seed = 1; seed <= 5; seed++) {
        const r = await evalJson(page, FIGHT, { bot, scenario, seed })
        rows.push({ bot, scenario, seed, ...r })
      }
    }
  }
  const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0)
  const stat = (xs) => {
    const part = sum(xs, (r) => r.part), auto = sum(xs, (r) => r.auto), game = sum(xs, (r) => r.gameMs), all = sum(xs, (r) => r.all)
    const frozen = part + auto
    return { part, auto, frozen, game, share: frozen / (game + frozen), shareOfGame: frozen / game, parts: frozen ? part / frozen : 1, all, allShare: all / (game + all), n: xs.length, uncleared: xs.filter((r) => !r.cleared).length }
  }
  const pct = (x) => (x * 100).toFixed(1) + '%'
  const line = (what, s) => `${what}: ${s.n} fights, ${(s.game / 1000).toFixed(1)} s of play + ${(s.frozen / 1000).toFixed(2)} s frozen (${s.part.toFixed(0)} part + ${s.auto.toFixed(0)} auto ms) = ${pct(s.share)} of fight time (${pct(s.shareOfGame)} of play), parts own ${pct(s.parts)}; every source read ${pct(s.allShare)}; ${s.uncleared} uncleared`
  const fails = []
  for (const bot of ['eager', 'hesitant']) {
    const mine = rows.filter((r) => r.bot === bot)
    const s = stat(mine)
    console.log(`INFO K-L12: ${line(bot + ', all', s)} (sim: ${SIM.share}, parts ${SIM.parts})`)
    for (const scenario of ['hulks', 'mites', 'mixed']) console.log(`INFO K-L12:   ${line(bot + ' / ' + scenario, stat(mine.filter((r) => r.scenario === scenario)))}`)
    if (s.share > BUDGET.share) fails.push(`${bot}: ${pct(s.share)} of fight time frozen, over ${pct(BUDGET.share)}`)
    if (s.parts < BUDGET.parts) fails.push(`${bot}: parts own ${pct(s.parts)} of the freeze, under ${pct(BUDGET.parts)}`)
  }
  assert(fails.length === 0, fails.join('; '))
})

// K-L12w the whole trial in the real levels (a report; it fails only on a throw): a generated level of each area (I the ruin at depth 2, II the Works at 4, III the
// Line at 4 on its road), the first three packs of each, seeds 1-3, one fight per pack with each bot, weight off and on. Weight on is the whole trial: the Ask 1 HP at
// entry, the full effect, the freeze. Off is today. It prints kill time, the share of kills that were parts', the freeze and what never ended (40 s)
const AREAS = [
  { area: 'I (ruin, depth 2)', depth: 2, route: 'II' },
  { area: 'II (works, depth 4)', depth: 4, route: 'II' },
  { area: 'III (the Line, depth 4)', depth: 4, route: 'III' },
]
const PACKS_EACH = 3
const AREA_FIGHT = `(arg) => {
  const W = window
  const C = W.__combat
  const mulberry32 = (a) => () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  W.__hold(true)
  ;(${SWITCH})(arg.on)
  W.__weightPreset('B')
  W.__run.route = arg.route
  for (const slot of SLOTS) C.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
  const original = Math.random
  Math.random = mulberry32(arg.seed * 131 + arg.pack)
  try {
    W.__enter(arg.depth, arg.seed)
    C.autoAttack = true
    C.autoTimer = 0
    W.__stick(0, 0)
    const lvl = W.__level()
    const spec = lvl.packs[arg.pack]
    if (!spec || !C.packs[arg.pack]) return null
    const pack = C.packs[arg.pack]
    const at = spec.room?.center ?? pack.members[0].pos
    W.__still.pos.set(at.x, 0, at.z)
    C.wake(pack)
    const st = W.__run.stats[W.__run.stats.length - 1]
    const was = { part: st.freezePartMs, auto: st.freezeAutoMs, kills: { ...st.kills } }
    const readySince = {}
    const body = pack.members.map((e) => e.kind)
    const hp = pack.members.map((e) => e.hp)
    W.__fx()
    let lost = 0, ticks = 0, cleared = false
    for (let i = 0; i < 40 * 60; i++) {
      for (const slot of SLOTS) {
        if (!W.__hud.isReady(slot)) { readySince[slot] = null; continue }
        readySince[slot] ??= C.time
        if (arg.bot === 'eager' || C.time - readySince[slot] >= 3.7 - 1e-9) { W.__fire(slot); readySince[slot] = null }
      }
      C.hp = 100
      W.__step(1 / 60)
      lost += 100 - C.hp
      ticks++
      if (pack.members.every((e) => e.dead)) { cleared = true; break }
    }
    const now = W.__run.stats[W.__run.stats.length - 1]
    return {
      body, hp, cleared, lost, s: ticks / 60,
      left: pack.members.filter((e) => !e.dead).map((e) => e.kind + ' ' + Math.hypot(e.pos.x - at.x, e.pos.z - at.z).toFixed(1) + ' u ' + Math.round(e.hp) + ' hp ' + e.phase), part: now.freezePartMs - was.part, auto: now.freezeAutoMs - was.auto,
      kills: { part: now.kills.part - was.kills.part, auto: now.kills.auto - was.kills.auto, other: now.kills.other - was.kills.other },
    }
  } finally {
    Math.random = original
  }
}`

check('K-L12w', '?depth=1&save=memory&roads=1&line=0&engine=0', async ({ page }) => {
  try {
    await wholeTrial(page)
  } finally {
    await evalJson(page, `() => (${SWITCH})(false)`)
  }
})
async function wholeTrial(page) {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
  for (const { area, depth, route } of AREAS) {
    for (const bot of ['eager', 'hesitant']) {
      const got = { off: [], on: [] }
      for (const on of [false, true]) {
        for (let seed = 1; seed <= 3; seed++) {
          for (let pack = 0; pack < PACKS_EACH; pack++) {
            const r = await evalJson(page, AREA_FIGHT, { on, bot, depth, route, seed, pack })
            if (r) got[on ? 'on' : 'off'].push(r)
          }
        }
      }
      const fmt = (rs) => {
        const kills = rs.reduce((a, r) => a + r.kills.part + r.kills.auto + r.kills.other, 0)
        const part = rs.reduce((a, r) => a + r.kills.part, 0)
        const frozen = rs.reduce((a, r) => a + r.part + r.auto, 0), play = rs.reduce((a, r) => a + r.s, 0) * 1000
        return `${rs.length} fights, kill time ${mean(rs.filter((r) => r.cleared).map((r) => r.s)).toFixed(1)} s (cleared ${rs.filter((r) => r.cleared).length}), body HP ${mean(rs.flatMap((r) => r.hp)).toFixed(1)}, HP lost ${mean(rs.map((r) => r.lost)).toFixed(1)}, part kills ${kills ? ((part / kills) * 100).toFixed(0) : '-'}% of ${kills}, frozen ${frozen ? ((frozen / (play + frozen)) * 100).toFixed(1) : '0.0'}% (${frozen.toFixed(0)} ms), never ended ${rs.filter((r) => !r.cleared).length}`
      }
      for (const side of ['off', 'on']) for (const r of got[side]) if (!r.cleared) console.log(`INFO K-L12w:   (${side}) never ended in 40 s, left: ${r.left.join(', ')}`)
      console.log(`INFO K-L12w: area ${area}, ${bot}: off ${fmt(got.off)}`)
      console.log(`INFO K-L12w: area ${area}, ${bot}: on  ${fmt(got.on)}`)
    }
  }
}

process.exit(await run(process.argv.slice(2)))
