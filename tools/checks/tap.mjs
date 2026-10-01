/**
 * The "tap push" trial's checks (design/lean/TAP-PUSH.md §4; the words "tap push" are a PLACEHOLDER). K-P1 is off-is-today: the regression
 * suites run as child processes and must print what the clean tree printed before P0 (RECORD below), and the hold path is driven by real
 * presses. Every press here is a real mouse press through the HUD (page.mouse on the real button), with the HUD clock held (`__clockHold`) so
 * it moves only by `__step`; the answer is read in an evaluate between `mouse.down` and `mouse.up`, with no step between.
 * `node tools/checks/tap.mjs [K-P3 ...]`.
 */
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, task, run } = suite()

const HERE = fileURLToPath(new URL('.', import.meta.url))

/**
 * In the page: a clean arena with Still's four starting parts (lens, vent, cleaver, kickstart; none costs strain of its own), the frame loop
 * held and the HUD clock held, the autos off, the "tap push" switch `on` (the hook), strain 0, `navigator.vibrate` recorded in `window.__vib`,
 * `__heard` and the tap log emptied. Every button is ready.
 */
const SETUP = `(on) => {
  const W = window
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
  for (const s of W.__hud.slots) if (!s.def || s.def.strain) throw new Error('the starting part on ' + s.slot + ' is missing or costs strain of its own')
  W.__hold(true)
  W.__clockHold(true)
  W.__arena()
  const C = W.__combat
  delete C.hurtPlayer
  C.time = 0
  C.pressure = true
  C.counters = false
  C.breakRule = true
  C.autoAttack = false
  W.__stick(0, 0)
  W.__tapPush(on)
  W.__run.strain = 0
  window.__vib = []
  navigator.vibrate = (p) => { window.__vib.push(p); return true }
  W.__heard.length = 0
  W.__run.taps.length = 0
}`

const LABEL = { head: 'H', torso: 'T', arms: 'A', legs: 'L' }

/**
 * In the page: what a press can see of itself at this moment (no step, no wait): the button's classes and ring angle, the strain, every
 * slot's cooldown left, the vibrations, the sounds asked for, the open depth's counters and how many taps are logged.
 */
const READ = `(slot) => {
  const W = window
  const el = document.querySelector('.btn:has(.lbl[aria-label="' + ({ head: 'H', torso: 'T', arms: 'A', legs: 'L' })[slot] + '"])')
  const st = W.__runStats().at(-1)
  return {
    cls: [...el.classList],
    arm: el.style.getPropertyValue('--arm'),
    strain: W.__run.strain,
    readyIn: Object.fromEntries(['head', 'torso', 'arms', 'legs'].map((s) => [s, W.__hud.readyIn(s)])),
    vib: [...window.__vib],
    heard: W.__heard.map((h) => h.name),
    st: { pushes: st.pushes, deadTaps: st.deadTaps, quiets: st.quiets, tapPush: st.tapPush, tapPushes: st.tapPushes, queued: st.queued, queueDropped: st.queueDropped, guarded: st.guarded },
    taps: W.__run.taps.length,
  }
}`

/**
 * A real press on a slot's button: `down` already happened. `read()` is the READ between down and up; `step(s)` moves the held clock (and the
 * world) by s seconds with the mouse still down; `up()` lets go and reads again.
 */
async function press(page, slot) {
  const box = await page.locator(`.btn:has(.lbl[aria-label="${LABEL[slot]}"])`).boundingBox()
  assert(box, `the ${slot} button is not on screen`)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  return {
    read: () => evalJson(page, READ, slot),
    step: (s) => evalJson(page, `(s) => window.__step(s)`, s),
    up: async () => {
      await page.mouse.up()
      return evalJson(page, READ, slot)
    },
  }
}

/** A whole touch: down, read, then `holdS` seconds of held clock if asked, then up. Returns the reads and the tap the up logged. */
async function touch(page, slot, holdS = 0) {
  const p = await press(page, slot)
  const down = await p.read()
  if (holdS) await p.step(holdS)
  const held = holdS ? await p.read() : null
  const up = await p.up()
  const tap = await evalJson(page, `() => window.__taps().at(-1) ?? null`)
  return { down, held, up, tap }
}

const setup = (page, on) => evalJson(page, `() => (${SETUP})(${on})`)
const cool = (page, slot, ms) => evalJson(page, `(a) => window.__cool(a[0], a[1])`, [slot, ms])
const cooldownOf = (page, slot) => evalJson(page, `(slot) => window.__hud.slots.find((s) => s.slot === slot).def.cooldownMs`, slot)

// ---- K-P1: off is today's game ----------------------------------------------------------------------------------------------------------

/**
 * What the clean tree printed before P0 (1 Oct 2026, tree at 5a40653): per suite, its argv, every id it prints and the ids that FAIL there.
 * K-W3d is the known Parry finding: it fails today and must keep failing the same way. dist/ then was 1,314,275 bytes of JS (1,314.28 kB, gzip 389.85 kB).
 */
const LEAN_IDS = ['K-L2', 'K-L10', 'K-L6', 'K-L7', 'K-L8', 'K-L9', 'K-L4', 'K-L5', 'K-L3', 'K-L11', 'K-L13', 'K-L12', 'K-L12w']
const RECORD = {
  'baseline.mjs': { args: ['compare'], pass: ['K-90', 'K-90L'], fail: [] },
  'fights.mjs': { args: ['compare'], pass: ['K-90F'], fail: [] },
  'autos.mjs': { args: [], pass: ['K-A2', 'K-A3', 'K-A4', 'K-A5', 'K-A6', 'K-A7', 'K-A8', 'K-A9', 'K-A10'], fail: [] },
  'area3.mjs': { args: [], pass: ['K-R2', 'K-R3', 'K-X1', 'K-X2', 'K-X4', 'K-X5', 'K-X6', 'K-X7'], fail: [] },
  'home.mjs': { args: [], pass: ['K-H1', 'K-H2', 'K-H3', 'K-H4'], fail: [] },
  'screens.mjs': { args: [], pass: ['K-S1', 'K-S2', 'K-S3', 'K-S4', 'K-S5', 'K-S6', 'K-S7', 'K-S8', 'K-S9', 'K-S10', 'K-S11', 'K-S12'], fail: [] },
  'stagec.mjs': {
    args: [],
    pass: [
      'K-N1a', 'K-N1b', 'K-N2a', 'K-N2b', 'K-N3', 'K-N4', 'K-N5', 'K-N6', 'K-N7', 'K-N8', 'K-N17', 'K-N18', 'K-N10', 'K-N11', 'K-N12', 'K-N13', 'K-N14', 'K-N15',
      'K-N21', 'K-N22', 'K-N19', 'K-N20', 'K-S5', 'K-E9c', 'K-N9', 'K-N16', 'K-N23',
    ],
    fail: [],
  },
  'stageb.mjs': {
    args: [],
    pass: [
      'K-W3a', 'K-W3b', 'K-W3c', 'K-W3e', 'K-W3f', 'K-W3g', 'K-W3h', 'K-W3i', 'K-W8a', 'K-W8b', 'K-T13', 'K-T5', 'K-T14', 'K-T15', 'K-E1', 'K-E2', 'K-E3',
      'K-E4', 'K-E13', 'K-E14', 'K-E15', 'K-S2', 'K-E5', 'K-E6', 'K-E7', 'K-E16', 'K-S3', 'K-E8', 'K-E17', 'K-E9', 'K-E10', 'K-E12', 'K-S1', 'K-S4', 'K-Z1', 'K-E11',
    ],
    fail: ['K-W3d'],
  },
  'k9.mjs': {
    args: [],
    pass: ['K-9B', 'K-9B9', 'K-96a', 'K-97a', 'K-9A', 'K-92a', 'K-91', 'K-98', 'K-99', 'K-97b', 'K-96b', 'K-95a', 'K-94', 'K-93', 'K-95b', 'K-96c', 'K-9C', 'K-9D'],
    fail: [],
  },
  // lean.mjs without K-L1: K-L1's own children are the suites above, and its page part is the weight switch's
  'lean.mjs': { args: LEAN_IDS, pass: LEAN_IDS, fail: [] },
}

/** Run one suite as a child process, the switches' env stripped (a TAP=1 or WEIGHT=1 run of this file must not turn the children on): its PASS / FAIL lines, in order. */
function suiteLines(file, args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.TAP
    delete env.WEIGHT
    const child = spawn(process.execPath, [HERE + file, ...args], { cwd: HERE + '../../', env })
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

// K-P1 task: the whole regression set prints what the clean tree recorded
task('K-P1', async () => {
  // NO_SUITES=1 skips the children: for negative-testing the page parts below without two minutes of suites each time
  if (process.env.NO_SUITES === '1') return
  for (const [file, rec] of Object.entries(RECORD)) {
    const lines = await suiteLines(file, rec.args)
    const got = lines.map((l) => `${l.verdict}:${l.id}`)
    const want = [...rec.pass.map((id) => `PASS:${id}`), ...rec.fail.map((id) => `FAIL:${id}`)]
    const extra = got.filter((g) => !want.includes(g))
    const missing = want.filter((w) => !got.includes(w))
    assert(extra.length === 0 && missing.length === 0, `${file} ${rec.args.join(' ')}: differs from the clean tree's record: now ${extra.join(', ') || 'nothing new'}; no longer ${missing.join(', ') || 'nothing lost'}`)
    assertEq(`${file}: lines printed`, got.length, want.length)
  }
})

// K-P1 (a): the first check of this page, a fresh context: the switch has never been touched
check('K-P1', RUN, async ({ page }) => {
  const got = await evalJson(page, () => ({
    stored: localStorage.getItem('still-action.tapPush'),
    on: window.__tapPush(),
    logged: window.__runStats().at(-1).tapPush,
  }))
  assertEq('a fresh context has no stored switch', got.stored, null)
  assertEq('__tapPush() is false', got.on, false)
  assertEq("the open depth's log: tapPush", got.logged, false)
})

// K-P1 (b): the switch off, the hold path by real presses: today's gesture, line for line
check('K-P1', RUN, async ({ page }) => {
  await setup(page, false)
  const cd = await cooldownOf(page, 'arms')

  // a cooling Cleaver, held: nothing at 100 ms, the push at 200 ms (>= 180), and not twice
  await cool(page, 'arms', 2000)
  let p = await press(page, 'arms')
  const r0 = await p.read()
  await p.step(0.1)
  const r1 = await p.read()
  assertEq('held 100 ms on a cooling button: strain unchanged', r1.strain, r0.strain)
  assertEq('held 100 ms: no push yet', r1.st.pushes, r0.st.pushes)
  await p.step(0.1)
  const r2 = await p.read()
  assertEq('held 200 ms (>= 180): strain +2', r2.strain, r0.strain + 2)
  assertEq('held 200 ms: one push', r2.st.pushes, r0.st.pushes + 1)
  await p.step(0.3)
  const r3 = await p.read()
  assertEq('held a further 300 ms: no second push', [r3.strain, r3.st.pushes], [r2.strain, r2.st.pushes])
  await p.up()
  let tap = await evalJson(page, `() => window.__taps().at(-1)`)
  assertEq('the up logs a push', [tap.slot, tap.result, tap.ready], ['arms', 'push', false])
  assert(tap.leftMs === 2000, `the push's leftMs is ${tap.leftMs}, not 2000`)

  // a 0.06 s press on a cooling button: dead
  await cool(page, 'arms', 2000)
  p = await press(page, 'arms')
  const pre = await p.read()
  await p.step(0.06)
  await p.up()
  const post = await evalJson(page, READ, 'arms')
  tap = await evalJson(page, `() => window.__taps().at(-1)`)
  assertEq('a 0.06 s press on a cooling button logs dead', tap.result, 'dead')
  assertEq('deadTaps +1', post.st.deadTaps, pre.st.deadTaps + 1)
  assertEq('strain unchanged by the dead tap', post.strain, pre.strain)

  // 100 ms left, held through the ready: buffered, it casts when it comes up and the cooldown restarts
  await cool(page, 'arms', 100)
  p = await press(page, 'arms')
  const b0 = await p.read()
  await p.step(0.12)
  const b1 = await p.read()
  await p.up()
  tap = await evalJson(page, `() => window.__taps().at(-1)`)
  assertEq('a buffered press logs a cast', tap.result, 'cast')
  assertEq('strain unchanged by a cast', b1.strain, b0.strain)
  assertEq('no push counted', b1.st.pushes, b0.st.pushes)
  assert(b1.readyIn.arms > cd - 40 && b1.readyIn.arms <= cd, `the cooldown restarted: readyIn ${b1.readyIn.arms}, wanted ~${cd}`)

  // a ready press: the cast at down
  await cool(page, 'arms', 0)
  p = await press(page, 'arms')
  const c0 = await p.read()
  assert(c0.readyIn.arms > cd - 40, `a ready press casts at down: readyIn ${c0.readyIn.arms}, wanted ~${cd}`)
  assertEq('a ready press: the 12 ms buzz', c0.vib.at(-1), 12)
  await p.up()
  tap = await evalJson(page, `() => window.__taps().at(-1)`)
  assertEq('a ready press logs a cast', [tap.result, tap.ready, tap.leftMs], ['cast', true, 0])
})

// ---- K-P2: the switch --------------------------------------------------------------------------------------------------------------------

/** In the page: the pause screen's tap push row, clicked by the DOM (K-L2 does this for weight). Closes the pause screen. */
const FLIP = `() => {
  const W = window
  W.__pause.loadout(W.__hud.slots, () => {})
  const b = [...document.querySelectorAll('#pause .rule')].find((x) => x.textContent.startsWith('tap push'))
  b.click()
  W.__pause.hide()
}`

check('K-P2', RUN, async ({ page }) => {
  try {
    await switchChecks(page)
  } finally {
    // a failing check leaves the switch off for the ones after it
    await evalJson(page, `() => {
      if (localStorage.getItem('still-action.tapPush') === '1') (${FLIP})()
      window.__tapPush(false)
    }`)
  }
})
async function switchChecks(page) {
  const read = () => evalJson(page, `() => {
    const W = window, st = W.__run.stats.at(-1)
    return { on: W.__tapPush(), mixed: st.tapPushMixed ?? null, entry: st.tapPush, stored: localStorage.getItem('still-action.tapPush'), phase: W.__run.phase }
  }`)
  const flip = async () => {
    await evalJson(page, `() => window.__pause.loadout(window.__hud.slots, () => {})`)
    await row.click()
    await evalJson(page, `() => window.__pause.hide()`)
  }
  await evalJson(page, `() => {
    const W = window
    W.__run.dev = false
    W.__enter(2, 1)
    W.__tapPush(false)
    W.__step(0.2)
    W.__pause.loadout(W.__hud.slots, () => {})
  }`)
  const row = page.locator('#pause .rule', { hasText: /^tap push/ })
  assertEq('the loadout screen shows one switch labelled tap push', await row.count(), 1)
  assertEq('it starts off', await row.locator('b').textContent(), 'off')
  assertEq('the open depth is a crawl', (await read()).phase, 'crawl')
  await row.click()
  assertEq('one real click: the stored switch', await page.evaluate(() => localStorage.getItem('still-action.tapPush')), '1')
  assertEq('the row now reads on', await row.locator('b').textContent(), 'on')
  const flipped = await read()
  assertEq('mid-crawl flip: __hud.tapPush at once', flipped.on, true)
  assertEq('the open depth logs tapPushMixed', flipped.mixed, true)
  assertEq('its entry value stays what it was at entry', flipped.entry, false)
  await evalJson(page, `() => window.__pause.hide()`)

  // the next depth: tapPush at entry, no mixed
  const next = await evalJson(page, `() => {
    const W = window
    W.__enter(3, 1)
    W.__step(0.2)
    const st = W.__run.stats.at(-1)
    return { depth: st.depth, tapPush: st.tapPush, mixed: st.tapPushMixed ?? null, on: W.__tapPush() }
  }`)
  assertEq('the next depth logs tapPush true and no tapPushMixed', next, { depth: 3, tapPush: true, mixed: null, on: true })

  // off then on in the same depth: still one tapPushMixed, no throw
  await flip()
  const s1 = await read()
  assertEq('flipped off: off now, the depth mixed', [s1.on, s1.mixed, s1.stored], [false, true, '0'])
  await flip()
  const s2 = await read()
  assertEq('flipped on again: on now, still mixed (one flag, not a count)', [s2.on, s2.mixed, s2.stored], [true, true, '1'])
  await flip()
  const s3 = await read()
  assertEq('left off', [s3.on, s3.mixed, s3.stored], [false, true, '0'])

  // outside a crawl: no tapPushMixed on the depth it was open at
  await evalJson(page, `() => {
    const W = window
    W.__enter(2, 1)
    W.__step(0.2)
    W.__workshop()
  }`)
  const out0 = await read()
  assert(out0.phase !== 'crawl', `the workshop is not a crawl: phase ${out0.phase}`)
  await flip()
  const out1 = await read()
  assertEq('flipped on outside a crawl: on, stored, and no tapPushMixed', [out1.on, out1.stored, out1.mixed], [true, '1', null])
  await flip()
  const out2 = await read()
  assertEq('flipped off outside a crawl: still no tapPushMixed', [out2.on, out2.stored, out2.mixed], [false, '0', null])
}

// ---- K-P3: the answer table --------------------------------------------------------------------------------------------------------------

check('K-P3', RUN, async ({ page }) => {
  // sinceFireMs / sinceTouchMs of 1e9 stand for "long ago"
  const far = 1e9
  const ans = (t) => evalJson(page, `(t) => window.__tapAnswer(t)`, { ready: false, leftMs: 2000, sinceFireMs: far, sinceTouchMs: far, queued: false, ...t })
  const want = async (what, t, a) => assertEq(what, await ans(t), a)
  // a ready press is always a cast: the guard and the queue never touch it
  await want('ready', { ready: true }, 'cast')
  await want('ready, left 0', { ready: true, leftMs: 0 }, 'cast')
  await want('ready, just fired', { ready: true, sinceFireMs: 0 }, 'cast')
  await want('ready, just touched', { ready: true, sinceTouchMs: 0 }, 'cast')
  await want('ready, queued', { ready: true, queued: true }, 'cast')
  await want('ready, everything', { ready: true, leftMs: 5, sinceFireMs: 0, sinceTouchMs: 0, queued: true }, 'cast')
  // the queue window: 300 queues, 300.01 pushes
  await want('left 300', { leftMs: 300 }, 'queued')
  await want('left 300.01', { leftMs: 300.01 }, 'push')
  await want('left 0.5', { leftMs: 0.5 }, 'queued')
  await want('left 2000', { leftMs: 2000 }, 'push')
  // the mash guard: 249.99 since the last fire guards, 250 does not
  await want('since fire 249.99', { sinceFireMs: 249.99 }, 'guarded')
  await want('since fire 250, left 2000', { sinceFireMs: 250, leftMs: 2000 }, 'push')
  await want('since fire 0', { sinceFireMs: 0 }, 'guarded')
  // the guard rolls (the lead's change, R3): the same, from the last touch
  await want('since touch 249.99', { sinceTouchMs: 249.99 }, 'guarded')
  await want('since touch 250, left 2000', { sinceTouchMs: 250, leftMs: 2000 }, 'push')
  await want('since touch 0', { sinceTouchMs: 0 }, 'guarded')
  await want('since fire 250, since touch 249.99', { sinceFireMs: 250, sinceTouchMs: 249.99 }, 'guarded')
  await want('since fire 249.99, since touch 250', { sinceFireMs: 249.99, sinceTouchMs: 250 }, 'guarded')
  await want('both 250', { sinceFireMs: 250, sinceTouchMs: 250 }, 'push')
  await want('since touch 249.99 in the queue window', { leftMs: 100, sinceTouchMs: 249.99 }, 'guarded')
  // a pending queue guards the next touch
  await want('queued, left 100', { queued: true, leftMs: 100 }, 'guarded')
  await want('queued, left 2000', { queued: true }, 'guarded')
})

// ---- K-P9: the log (P0: shape, neighbour, strainAtBoss) ---------------------------------------------------------------------------------

check('K-P9', RUN, async ({ page }) => {
  for (const on of [false, true]) {
    const mode = on ? 'on' : 'off'
    // a fresh depth: the fields, all 0
    const fresh = await evalJson(page, `(on) => {
      const W = window
      W.__run.dev = false
      W.__tapPush(on)
      W.__enter(2, 1)
      W.__step(0.2)
      const s = W.__runStats().at(-1)
      const n = (v) => typeof v === 'number' && Number.isFinite(v)
      return { tapPush: s.tapPush, counters: [s.tapPushes, s.queued, s.queueDropped, s.guarded], finite: [s.tapPushes, s.queued, s.queueDropped, s.guarded].every(n), mixed: s.tapPushMixed ?? null, hasBossKey: 'strainAtBoss' in s }
    }`, on)
    assertEq(`${mode}: a fresh depth logs tapPush`, fresh.tapPush, on)
    assertEq(`${mode}: tapPushes, queued, queueDropped, guarded all 0`, fresh.counters, [0, 0, 0, 0])
    assertEq(`${mode}: no tapPushMixed on a fresh depth`, fresh.mixed, null)
    assertEq(`${mode}: no strainAtBoss on a depth with no boss`, fresh.hasBossKey, false)

    // the neighbour log: arms then torso ~80 ms apart; a 1100 ms gap; the same slot twice. Bare down/up with no evaluate between, so the gap is the wait
    const at = {}
    for (const slot of ['arms', 'torso']) {
      const box = await page.locator(`.btn:has(.lbl[aria-label="${LABEL[slot]}"])`).boundingBox()
      assert(box, `the ${slot} button is not on screen`)
      at[slot] = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    }
    const quick = async (slot) => {
      await page.mouse.move(at[slot].x, at[slot].y)
      await page.mouse.down()
      await page.mouse.up()
    }
    // the first cast of a part in a page compiles its effects and takes a few hundred ms: cast each once, then start again
    await setup(page, on)
    await quick('arms')
    await quick('torso')
    await setup(page, on)
    await page.waitForTimeout(1100)
    await quick('arms')
    await page.waitForTimeout(60)
    await quick('torso')
    await page.waitForTimeout(1100)
    await quick('arms')
    await quick('arms')
    const taps = await evalJson(page, `() => window.__taps()`)
    assertEq(`${mode}: four taps logged`, taps.length, 4)
    for (const t of taps) assert(typeof t.at === 'number' && Number.isFinite(t.at), `${mode}: a tap has no 'at': ${JSON.stringify(t)}`)
    assertEq(`${mode}: torso's tap names the arms as its neighbour`, taps[1].nbSlot, 'arms')
    assert(taps[1].nbMs >= 40 && taps[1].nbMs <= 250, `${mode}: torso's nbMs ${taps[1].nbMs} is not in 40..250`)
    assert(!('nbMs' in taps[2]) && !('nbSlot' in taps[2]), `${mode}: a 1100 ms gap should carry no nbMs: ${JSON.stringify(taps[2])}`)
    assert(!('nbMs' in taps[3]) && !('nbSlot' in taps[3]), `${mode}: the same slot twice should carry no nbMs: ${JSON.stringify(taps[3])}`)
    assert(!('nbMs' in taps[0]), `${mode}: the first press after a 1100 ms wait should carry no nbMs: ${JSON.stringify(taps[0])}`)
    for (const t of taps) assert(!('tp' in t), `${mode}: no tap carries tp before the gesture is wired: ${JSON.stringify(t)}`)
  }

  // strainAtBoss: the strain on the first tick the boss is awake, once
  const boss = await evalJson(page, `() => {
    const W = window, C = W.__combat
    W.__tapPush(false)
    W.__hold(true)
    W.__enter(3, 1)
    W.__run.strain = 7
    W.__step(0.2)
    const out = { asleep: 'strainAtBoss' in W.__runStats().at(-1) }
    if (!C.boss) throw new Error('depth 3 has no boss')
    C.wake(C.packOf.get(C.boss))
    out.awake = C.awake.includes(C.boss)
    W.__step(0.1)
    out.first = W.__runStats().at(-1).strainAtBoss
    W.__run.strain = 9
    W.__step(0.1)
    out.second = W.__runStats().at(-1).strainAtBoss
    W.__run.strain = 0
    W.__enter(2, 1)
    W.__step(0.1)
    out.next = 'strainAtBoss' in W.__runStats().at(-1)
    return out
  }`)
  assertEq('strainAtBoss: absent while the boss sleeps', boss.asleep, false)
  assertEq('the boss is awake after the wake', boss.awake, true)
  assertEq('strainAtBoss: the strain on the first awake tick', boss.first, 7)
  assertEq('strainAtBoss: strain 9 later, still the first', boss.second, 7)
  assertEq('a depth without a boss has no strainAtBoss key', boss.next, false)
})

process.exit(await run(process.argv.slice(2)))
