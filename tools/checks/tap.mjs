/**
 * The "tap push" trial's checks (design/lean/TAP-PUSH.md §4; the words "tap push" are a PLACEHOLDER). K-P1: the regression suites run as child
 * processes on the live defaults (tap push and weight both on, which the harness pins since 2 Oct, build layer B0) and must print what RECORD says
 * (the ids the clean tree printed before P0, 1 Oct, with the checks' by-design changes since), and the hold path (the switch off) is driven by real
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
    phase: W.__run.phase,
    near: el.classList.contains('near'),
    owedShown: getComputedStyle(el.querySelector('.owed')).display !== 'none',
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
/** Two animation frames: the HUD's per-frame update has run on the held clock (the classes it owns, `near`, are then current). */
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
/** Held-clock time to pass between two touches that must not see each other: the guard rolls from the last touch, 250 ms. */
const gap = (page, s = 0.26) => evalJson(page, `(s) => window.__step(s)`, s)
const step = (page, s) => evalJson(page, `(s) => window.__step(s)`, s)
const read = (page, slot) => evalJson(page, READ, slot)
const lastTap = (page) => evalJson(page, `() => window.__taps().at(-1) ?? null`)
const nVib = (r, v) => r.vib.filter((x) => JSON.stringify(x) === JSON.stringify(v)).length
const cool = (page, slot, ms) => evalJson(page, `(a) => window.__cool(a[0], a[1])`, [slot, ms])
/** Wait (real time) until the button's short-lived answer classes (kick 220 ms, nope 150 ms, refused 300 ms) have run out, so the next read is its own. */
const settle = (page, slot) =>
  page.waitForFunction((l) => {
    const el = document.querySelector('.btn:has(.lbl[aria-label="' + l + '"])')
    return !el.classList.contains('kick') && !el.classList.contains('nope') && !el.classList.contains('refused')
  }, LABEL[slot], { timeout: 3000 })

const cooldownOf = (page, slot) => evalJson(page, `(slot) => window.__hud.slots.find((s) => s.slot === slot).def.cooldownMs`, slot)

// ---- K-P1: the live game, and the hold path with the switch off ----------------------------------------------------------------------------------------------------------

/**
 * What the suites print on the live defaults (2 Oct 2026, B0; the ids are the clean tree's of 1 Oct, 5a40653): per suite, its argv, every id it prints and the ids that FAIL there.
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

/** Run one suite as a child process, the switches' env stripped (a TAP=0 or WEIGHT=0 run of this file must not turn the children off: RECORD is the live game): its PASS / FAIL lines, in order. */
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

// K-P1 (a0): a fresh phone, the harness's pin skipped: never touched means on (his call, 1 Oct, design/lean/TRIAL-1.md)
check('K-P1', RUN + '&trialDefaults', async ({ page }) => {
  const got = await evalJson(page, () => ({
    stored: localStorage.getItem('still-action.tapPush'),
    on: window.__tapPush(),
    logged: window.__runStats().at(-1).tapPush,
  }))
  assertEq('a fresh phone has no stored switch', got.stored, null)
  assertEq('__tapPush() is true by default', got.on, true)
  assertEq("the open depth's log: tapPush", got.logged, true)
})

// K-P1 (a): the first check of this page: the switch never touched but for the harness's pin (lib.mjs): '1', so on (TAP=0 in the env pins '0')
check('K-P1', RUN, async ({ page }) => {
  const off = process.env.TAP === '0'
  const got = await evalJson(page, () => ({
    stored: localStorage.getItem('still-action.tapPush'),
    on: window.__tapPush(),
    logged: window.__runStats().at(-1).tapPush,
  }))
  assertEq("the harness's pin", got.stored, off ? '0' : '1')
  assertEq(`__tapPush() is ${!off}`, got.on, !off)
  assertEq("the open depth's log: tapPush", got.logged, !off)
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
    // the page boots with tap push on (the live default, the harness's pin); this check walks the switch from OFF, as it always did, so the real click
    // turns it on: switch it off first by the same real click on the row, at the depth the page booted on, unless the env already did (TAP=0)
    await evalJson(page, `() => {
      window.__run.dev = false
      if (localStorage.getItem('still-action.tapPush') !== '0') (${FLIP})()
    }`)
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
    // tp marks an answer that came from the tap push path: every touch on a filled button with the switch on, none with it off
    for (const t of taps) assert(on ? t.tp === true : !('tp' in t), `${mode}: tp should be ${on ? 'true on every tap' : 'absent'}: ${JSON.stringify(t)}`)
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



// ---- K-P4: a push by a real touch ------------------------------------------------------------------------------------------------------

check('K-P4', RUN, async ({ page }) => {
  await setup(page, true)
  const cd = await cooldownOf(page, 'arms')
  await cool(page, 'arms', 2000)
  const pre = await read(page, 'arms')
  const p = await press(page, 'arms')
  const d = await p.read()
  assertEq('a touch on a cooling button (2000 left): strain +2 at the touch-down', d.strain, pre.strain + 2)
  assertEq('pushes +1 between down and up', d.st.pushes, pre.st.pushes + 1)
  assertEq('tapPushes +1 between down and up', d.st.tapPushes, pre.st.tapPushes + 1)
  assert(Math.abs(d.readyIn.arms - cd) <= 17, `the cooldown restarted at the touch: readyIn ${d.readyIn.arms}, wanted ~${cd} (+-17)`)
  assertEq('the push signature: vibration [14,26,14]', d.vib.at(-1), [14, 26, 14])
  assert(d.cls.includes('kick'), `the rim kicks at the touch: classes ${d.cls.join(' ')}`)
  assert(!d.cls.includes('arming'), 'a push has no ring')
  await p.step(0.5)
  const held = await p.read()
  assertEq('held a further 0.5 s: strain still +2 (no second push, no hold)', held.strain, pre.strain + 2)
  assertEq('held: one push', held.st.pushes, pre.st.pushes + 1)
  await p.up()
  const tap = await lastTap(page)
  assertEq('the up logs the push', [tap.slot, tap.result, tap.leftMs, tap.tp, tap.ready], ['arms', 'push', 2000, true, false])
  const after = await read(page, 'arms')
  assertEq('letting go does nothing more', [after.strain, after.st.pushes], [pre.strain + 2, pre.st.pushes + 1])

  // a hot button (the cooldown done, the heat on) pushes the same way
  await gap(page)
  await cool(page, 'arms', 0)
  await evalJson(page, `() => window.__hud.heat('arms', 2000)`)
  const hot0 = await read(page, 'arms')
  const hp = await press(page, 'arms')
  const h = await hp.read()
  assertEq('a hot button (2000 of heat left) pushes: strain +2', h.strain, hot0.strain + 2)
  assertEq('a hot push counts: pushes +1, tapPushes +1', [h.st.pushes, h.st.tapPushes], [hot0.st.pushes + 1, hot0.st.tapPushes + 1])
  assertEq('a hot push: the signature', h.vib.at(-1), [14, 26, 14])
  await hp.up()
  assertEq('a hot push logs push', (await lastTap(page)).result, 'push')
})

// ---- K-P5: the queue fires free --------------------------------------------------------------------------------------------------------

check('K-P5', RUN, async ({ page }) => {
  await setup(page, true)
  const cd = await cooldownOf(page, 'arms')

  // 280 left: queued (inside the window, not on its edge: a frame can re-sync the hud clock by float dust, and 300.0000001 is a push;
  // the exact edge is K-P3's, on the pure function). Released early; the ready arrives and it fires once, free
  await cool(page, 'arms', 280)
  const pre = await read(page, 'arms')
  let p = await press(page, 'arms')
  const d = await p.read()
  assertEq('queued: strain unchanged at the touch-down', d.strain, pre.strain)
  assert(d.readyIn.arms <= 300 && d.readyIn.arms > 0, `queued: nothing fired yet, readyIn ${d.readyIn.arms}`)
  assertEq('queued: pushes unchanged', d.st.pushes, pre.st.pushes)
  assert(d.cls.includes('arming') && d.cls.includes('queued'), `queued: classes arming and queued, got ${d.cls.join(' ')}`)
  assertEq('queued: the ring full (--arm 360 deg; update() may have reformatted it by the time of the read)', parseFloat(d.arm), 360)
  assert(d.heard.includes('queued'), `queued: the tick was asked for, heard ${d.heard.join(',')}`)
  assertEq('queued +1', d.st.queued, pre.st.queued + 1)
  assert(!d.cls.includes('kick'), 'a queued touch does not kick the rim')
  await p.up()
  const tap = await lastTap(page)
  assertEq('the up logs queued', [tap.result, tap.leftMs, tap.tp], ['queued', 280, true])
  const mid = await read(page, 'arms')
  assert(mid.cls.includes('queued'), 'letting go keeps the queue pending')
  assertEq('letting go fires nothing', mid.strain, pre.strain)
  // 0.32, not 0.3: 300 left is 18 ticks of the held clock to within float dust, and the 19th is the one that always sees it ready
  await step(page, 0.32)
  const fired = await read(page, 'arms')
  assert(fired.readyIn.arms > cd - 40 && fired.readyIn.arms <= cd + 1, `the queue fired once as the button readied: readyIn ${fired.readyIn.arms}, wanted ~${cd}`)
  assertEq('fired: the 12 ms buzz, once', [nVib(fired, 12), fired.vib.at(-1)], [nVib(pre, 12) + 1, 12])
  assertEq('fired: not a push (pushes +0)', fired.st.pushes, pre.st.pushes)
  assertEq('fired: free (strain unchanged)', fired.strain, pre.strain)
  assert(!fired.cls.includes('queued'), `fired: the queued class is gone, got ${fired.cls.join(' ')}`)
  await step(page, 0.3)
  const later = await read(page, 'arms')
  assertEq('fired once, not again', nVib(later, 12), nVib(pre, 12) + 1)

  // the same with the mouse held through the ready: one fire, and the up does nothing
  await gap(page)
  await cool(page, 'arms', 280)
  const pre2 = await read(page, 'arms')
  p = await press(page, 'arms')
  const q2 = await p.read()
  assert(q2.cls.includes('queued'), 'held: queued')
  await p.step(0.35)
  const f2 = await p.read()
  assertEq('held through the ready: one fire', nVib(f2, 12), nVib(pre2, 12) + 1)
  assertEq('held through the ready: free and not a push', [f2.strain, f2.st.pushes], [pre2.strain, pre2.st.pushes])
  await p.up()
  const u2 = await read(page, 'arms')
  assertEq('the up does nothing more: no second fire, strain unchanged', [nVib(u2, 12), u2.strain, u2.readyIn.arms > 0], [nVib(pre2, 12) + 1, pre2.strain, true])
  assertEq('held through the ready: logged queued', (await lastTap(page)).result, 'queued')

  // the honest price: <= 300 ms left is free to touch
  await gap(page)
  await cool(page, 'arms', 280)
  await frames(page)
  const n300 = await read(page, 'arms')
  assertEq('300 left: the button is near and the push price is hidden', [n300.near, n300.owedShown], [true, false])
  await cool(page, 'arms', 301)
  await frames(page)
  const n301 = await read(page, 'arms')
  assertEq('301 left: not near, the push price shown', [n301.near, n301.owedShown], [false, true])
  await cool(page, 'arms', 2000)
  await frames(page)
  const n2000 = await read(page, 'arms')
  assertEq('2000 left: not near, the push price shown', [n2000.near, n2000.owedShown], [false, true])
})

// ---- K-P6: the mash guard --------------------------------------------------------------------------------------------------------------

check('K-P6', RUN, async ({ page }) => {
  await setup(page, true)
  const cd = await cooldownOf(page, 'arms')

  // a ready Cleaver touched: cast. Then the guard, rolling from the last touch
  let t = await touch(page, 'arms')
  assertEq('a ready touch casts', [t.tap.result, t.tap.tp], ['cast', true])
  await step(page, 0.2)
  await settle(page, 'arms')
  const pre = await read(page, 'arms')
  assert(!pre.cls.includes('nope'), 'the button starts the guarded touch with no shake running')
  const p = await press(page, 'arms')
  const g = await p.read()
  // the answer is a "no" shake and the dry click: never the ember arc, which is the old hold's charge and would read as "keep holding"
  assert(g.cls.includes('nope'), `guarded: the button shakes "no" (class nope), classes ${g.cls.join(' ')}`)
  assert(!g.cls.includes('arming'), `guarded: no ring and no arc (a partial ring reads as a hold charging), classes ${g.cls.join(' ')}`)
  assertEq('guarded: --arm untouched (no arc was drawn)', g.arm, pre.arm)
  assert(g.heard.filter((h) => h === 'deadTap').length === pre.heard.filter((h) => h === 'deadTap').length + 1, `guarded: the dry click was asked for, heard ${g.heard.join(',')}`)
  assertEq('guarded: strain, pushes, readyIn unchanged', [g.strain, g.st.pushes, g.readyIn.arms], [pre.strain, pre.st.pushes, pre.readyIn.arms])
  assertEq('guarded +1', g.st.guarded, pre.st.guarded + 1)
  assert(!g.cls.includes('kick') && !g.cls.includes('queued'), 'a guarded touch does not kick or queue')
  // holding on does nothing more: still no ring after the clock moves on
  await p.step(0.02)
  await frames(page)
  const gh = await p.read()
  assert(!gh.cls.includes('arming') && gh.arm === pre.arm, `guarded, held on: still no ring (classes ${gh.cls.join(' ')}, --arm "${gh.arm}")`)
  await p.up()
  assertEq('the up logs guarded', [(await lastTap(page)).result, (await lastTap(page)).tp], ['guarded', true])
  // the shake is 150 ms of real time, then the class is gone
  await page.waitForTimeout(400)
  const settled = await read(page, 'arms')
  assert(!settled.cls.includes('nope') && !settled.cls.includes('arming'), `the shake ended: classes ${settled.cls.join(' ')}`)

  // the guard rolls: 50 ms after the guarded touch is still guarded (250 after the fire), 260 ms after it pushes
  await step(page, 0.05)
  t = await touch(page, 'arms')
  assertEq('50 ms after a guarded touch (250 after the fire): still guarded (it rolls)', t.tap.result, 'guarded')
  assertEq('...and it cost nothing', t.up.strain, pre.strain)
  await step(page, 0.26)
  const pre3 = await read(page, 'arms')
  t = await touch(page, 'arms')
  assertEq('260 ms after the last touch: push', t.tap.result, 'push')
  assertEq('...strain +2', t.down.strain, pre3.strain + 2)

  // a sustained mash pays once: 4 taps at 120 ms: push, guarded, guarded, guarded
  await gap(page)
  await cool(page, 'arms', 2000)
  const m0 = await read(page, 'arms')
  const results = []
  for (let i = 0; i < 4; i++) {
    if (i) await step(page, 0.12)
    results.push((await touch(page, 'arms')).tap.result)
  }
  assertEq('a mash of 4 taps at 120 ms', results, ['push', 'guarded', 'guarded', 'guarded'])
  const m1 = await read(page, 'arms')
  assertEq('the mash paid exactly once (+2), one push', [m1.strain, m1.st.pushes], [m0.strain + 2, m0.st.pushes + 1])

  // the guard also counts a fire that was not a touch: a queued fire, then a touch 100 ms after it (310 after the queue's touch)
  await gap(page)
  await cool(page, 'arms', 200)
  const q0 = await read(page, 'arms')
  await touch(page, 'arms')
  assertEq('queued at 200 left', (await lastTap(page)).result, 'queued')
  await step(page, 0.21)
  const qf = await read(page, 'arms')
  assertEq('the queue fired once', nVib(qf, 12), nVib(q0, 12) + 1)
  await step(page, 0.1)
  t = await touch(page, 'arms')
  assertEq('a touch 100 ms after a queued fire (310 after its own touch): guarded by the fire', t.tap.result, 'guarded')
  assertEq('...and it cost nothing', t.up.strain, q0.strain)

  // a pending queue touched again: guarded, the ring stays full and cold, and it fires once
  await gap(page)
  await cool(page, 'arms', 200)
  const r0 = await read(page, 'arms')
  await touch(page, 'arms')
  assertEq('queued again at 200 left', (await lastTap(page)).result, 'queued')
  await settle(page, 'arms')
  const qp = await press(page, 'arms')
  const qd = await qp.read()
  assertEq('a touch on a pending queue: the ring stays full (360 deg, whichever way update() writes it)', parseFloat(qd.arm), 360)
  assert(qd.cls.includes('queued') && qd.cls.includes('arming'), `a touch on a pending queue: still queued with its cold ring, classes ${qd.cls.join(' ')}`)
  assert(qd.cls.includes('nope'), `a touch on a pending queue: the same "no" shake, classes ${qd.cls.join(' ')}`)
  assertEq('it is guarded and counted', [qd.st.guarded, qd.st.queued], [r0.st.guarded + 1, r0.st.queued + 1])
  assertEq('...with the click, no extra arc and no price', [qd.strain, qd.st.pushes], [r0.strain, r0.st.pushes])
  await qp.up()
  assertEq('logged guarded', (await lastTap(page)).result, 'guarded')
  await step(page, 0.3)
  const qe = await read(page, 'arms')
  assertEq('the pending queue fired exactly once, free', [nVib(qe, 12), qe.strain], [nVib(r0, 12) + 1, r0.strain])
  assert(qe.readyIn.arms > cd - 150 && qe.readyIn.arms <= cd + 1, `the queue's fire restarted the cooldown: ${qe.readyIn.arms}`)
})

// ---- K-P8: strain exactly +2 a push ----------------------------------------------------------------------------------------------------

task('K-P8', async () => {
  const { readFileSync } = await import('node:fs')
  const src = readFileSync(HERE + '../../src/main.ts', 'utf8')
  for (const line of ['const STRAIN_PER_PUSH = 2', 'const STRAIN_MAX = 20', 'const QUIET_STRAIN = 2']) assert(src.includes(line), `src/main.ts no longer has "${line}"`)
})

check('K-P8', RUN, async ({ page }) => {
  await setup(page, true)
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  const log = []
  // a sequence: every touch is read at the touch-down (no step), so the strain it moved is its own
  const go = async (slot, coolMs) => {
    await gap(page)
    if (coolMs !== null) await cool(page, slot, coolMs)
    const pre = await read(page, slot)
    const p = await press(page, slot)
    const d = await p.read()
    await p.up()
    const tap = await lastTap(page)
    log.push({ slot, result: tap.result, dStrain: d.strain - pre.strain, dQuiets: d.st.quiets - pre.st.quiets })
    return d
  }
  // K-P5 and K-P6's kinds of touch: casts, queued, guarded, pushes
  await go('arms', 0)
  await go('arms', 300)
  await go('arms', 2000)
  await go('arms', 2000)
  await step(page, 0.1)
  await go('arms', null)
  await step(page, 0.05)
  await go('arms', null)
  // six more pushes on the other three parts (none costs strain of its own)
  for (const slot of ['head', 'torso', 'legs', 'head', 'torso', 'legs']) await go(slot, 2000)
  const pushes = log.filter((l) => l.result === 'push')
  assert(pushes.length >= 8, `the sequence made ${pushes.length} pushes, wanted >= 8: ${JSON.stringify(log)}`)
  for (const l of log) assertEq(`${l.slot} ${l.result}: strain moved by exactly 2 per push and nothing otherwise`, l.dStrain, l.result === 'push' ? 2 : 0)
  assertEq('quiets unchanged by any touch', log.map((l) => l.dQuiets), log.map(() => 0))
})

check('K-P8', RUN + '&p8=1', async ({ page }) => {
  // strain 18, a tap push: the push lands at 20 and then he stops, as today
  await setup(page, true)
  await cool(page, 'arms', 2000)
  await evalJson(page, `() => { window.__run.strain = 18 }`)
  const p = await press(page, 'arms')
  const d = await p.read()
  assertEq('strain 18 + a tap push: 20, the stop begun', [d.strain, d.phase], [20, 'stopping'])
  assertEq('the push still landed (pushes +1)', d.st.pushes, 1)
  await p.up()
})

// ---- K-P9 (P1): the counters -----------------------------------------------------------------------------------------------------------

check('K-P9', RUN, async ({ page }) => {
  // on: one push, one queued, one guarded (the counters are the open depth's: read as differences from before)
  await setup(page, true)
  const before = await read(page, 'arms')
  await cool(page, 'arms', 2000)
  await touch(page, 'arms')
  await cool(page, 'torso', 200)
  await touch(page, 'torso')
  await touch(page, 'torso')
  const on = await read(page, 'arms')
  const dOn = (k) => on.st[k] - before.st[k]
  assertEq('on: tapPushes 1, queued 1, guarded 1, pushes 1, queueDropped 0, deadTaps 0', ['tapPushes', 'queued', 'guarded', 'pushes', 'queueDropped', 'deadTaps'].map(dOn), [1, 1, 1, 1, 0, 0])
  const taps = await evalJson(page, `() => window.__taps()`)
  assertEq('on: push / queued / guarded', taps.map((t) => t.result), ['push', 'queued', 'guarded'])
  for (const t of taps) assertEq(`on: ${t.result} carries tp`, t.tp, true)

  // off: the same touches are a push (held 0.2 s) / dead / dead, every new counter 0, no tp
  await setup(page, false)
  const before2 = await read(page, 'arms')
  await cool(page, 'arms', 2000)
  await touch(page, 'arms', 0.2)
  await cool(page, 'torso', 200)
  await touch(page, 'torso')
  await touch(page, 'torso')
  const off = await read(page, 'arms')
  const dOff = (k) => off.st[k] - before2.st[k]
  assertEq('off: every new counter 0, deadTaps 2, pushes 1', ['tapPushes', 'queued', 'queueDropped', 'guarded', 'deadTaps', 'pushes'].map(dOff), [0, 0, 0, 0, 2, 1])
  const offTaps = await evalJson(page, `() => window.__taps()`)
  assertEq('off: push / dead / dead', offTaps.map((t) => t.result), ['push', 'dead', 'dead'])
  for (const t of offTaps) assert(!('tp' in t), `off: no tp on ${JSON.stringify(t)}`)
})

// ---- K-P10: the queue's edges ----------------------------------------------------------------------------------------------------------

check('K-P10', RUN, async ({ page }) => {
  await setup(page, true)
  const cd = await cooldownOf(page, 'arms')
  /** A fresh queue at left 200 on the Cleaver; returns the read just before the touch. */
  const queue = async () => {
    await evalJson(page, `() => window.__tapPush(true)`)
    await gap(page)
    await evalJson(page, `() => window.__hud.heat('arms', 0)`)
    await cool(page, 'arms', 200)
    const pre = await read(page, 'arms')
    await touch(page, 'arms')
    const q = await read(page, 'arms')
    assert(q.cls.includes('queued') && parseFloat(q.arm) === 360, `a fresh queue is pending: ${JSON.stringify([q.cls, q.arm, q.readyIn.arms, q.st])}`)
    return pre
  }
  const dropped = async (what, pre, act) => {
    await act()
    const r = await read(page, 'arms')
    assertEq(`${what}: queueDropped +1 at once`, r.st.queueDropped, pre.st.queueDropped + 1)
    assert(!r.cls.includes('queued'), `${what}: the queued class is gone, got ${r.cls.join(' ')}`)
    await step(page, 0.5)
    const e = await read(page, 'arms')
    assertEq(`${what}: nothing fired (no new vibration, strain unchanged)`, [e.vib.length, e.strain], [r.vib.length, pre.strain])
    assert(!e.cls.includes('arming'), `${what}: the ring is gone, got ${e.cls.join(' ')}`)
    return e
  }

  // (a) a heat lands on it
  let pre = await queue()
  const a = await dropped('(a) heat', pre, () => evalJson(page, `() => window.__hud.heat('arms', 2000)`))
  assert(a.readyIn.arms === 0, '(a) the cooldown ran out under the heat; it did not fire')

  // (b) a swap
  pre = await queue()
  await dropped('(b) swap', pre, () => evalJson(page, `() => window.__equip('piston')`))
  await evalJson(page, `() => window.__equip('scrap-cleaver')`)

  // (c) the pause opened, then resumed
  pre = await queue()
  await dropped('(c) pause', pre, async () => {
    await evalJson(page, `() => { window.__hud.enabled = false }`)
    await step(page, 0.4)
    await evalJson(page, `() => { window.__hud.enabled = true }`)
  })

  // (d) the switch flipped off
  pre = await queue()
  await dropped('(d) switch off', pre, () => evalJson(page, `() => window.__tapPush(false)`))

  // (e) a rider readies it: it fires on the next step, free
  pre = await queue()
  await evalJson(page, `() => window.__hud.ready('arms', 'cold')`)
  const e0 = await read(page, 'arms')
  assertEq('(e) a rider readying it does not drop the queue', e0.st.queueDropped, pre.st.queueDropped)
  await step(page, 0.02)
  const e1 = await read(page, 'arms')
  assert(e1.readyIn.arms > cd - 40 && e1.readyIn.arms <= cd + 1, `(e) it fired on the next step: readyIn ${e1.readyIn.arms}`)
  assertEq('(e) free: strain unchanged, not a push, one buzz', [e1.strain, e1.st.pushes, nVib(e1, 12)], [pre.strain, pre.st.pushes, nVib(pre, 12) + 1])

  // (f) heat 200 on a cooled button: queued, fires free when the heat ends
  await gap(page)
  await cool(page, 'arms', 0)
  await evalJson(page, `() => window.__hud.heat('arms', 200)`)
  const f0 = await read(page, 'arms')
  const t = await touch(page, 'arms')
  assertEq('(f) a touch in the last 300 ms of a heat queues', [t.tap.result, t.tap.leftMs], ['queued', 200])
  assertEq('(f) free to touch: strain unchanged', t.down.strain, f0.strain)
  await step(page, 0.25)
  const f1 = await read(page, 'arms')
  assert(f1.readyIn.arms > cd - 150 && f1.readyIn.arms <= cd + 1, `(f) it fired when the heat ended: readyIn ${f1.readyIn.arms}`)
  assertEq('(f) free and not a push', [f1.strain, f1.st.pushes, nVib(f1, 12)], [f0.strain, f0.st.pushes, nVib(f0, 12) + 1])
})

// ---- K-P13: the DEV path is the gesture's after ----------------------------------------------------------------------------------------

check('K-P13', RUN, async ({ page }) => {
  const results = {}
  for (const on of [false, true]) {
    await setup(page, on)
    const cd = await cooldownOf(page, 'arms')
    const fire = async (what, ms, pushed) => {
      await cool(page, 'arms', ms)
      const pre = await read(page, 'arms')
      await evalJson(page, `(a) => window.__fire('arms', a)`, pushed)
      const post = await read(page, 'arms')
      return { what, dStrain: post.strain - pre.strain, dPushes: post.st.pushes - pre.st.pushes, restarted: post.readyIn.arms > cd - 40, dVib: post.vib.length - pre.vib.length }
    }
    const out = [
      await fire('__fire on a cooling button', 2000, undefined),
      await fire('__fire(push) on a cooling button', 2000, true),
      await fire('__fire on a ready button', 0, undefined),
    ]
    assertEq(`${on ? 'on' : 'off'}: __fire on a cooling button does nothing`, out[0], { what: out[0].what, dStrain: 0, dPushes: 0, restarted: false, dVib: 0 })
    assertEq(`${on ? 'on' : 'off'}: __fire(push) pushes, +2`, [out[1].dStrain, out[1].dPushes, out[1].restarted], [2, 1, true])
    assertEq(`${on ? 'on' : 'off'}: __fire on a ready button casts`, [out[2].dStrain, out[2].dPushes, out[2].restarted], [0, 0, true])
    results[on] = out
  }
  assertEq('the DEV path gives the same results with the switch on and off', results.true, results.false)
})

// ---- K-P7: no touch is silent ----------------------------------------------------------------------------------------------------------

// 24 scripted real touches over the four buttons: every one is answered inside the touch-down, in the DOM (what the eye sees) and in the log
check('K-P7', RUN, async ({ page }) => {
  await setup(page, true)
  // Plumb Line on the legs: a ready press plants (and stays ready), then a press with Still past its 10 u range is refused by the run itself
  await evalJson(page, `() => window.__equip('plumb-line')`)
  const before = await read(page, 'arms')
  const seq = []
  /** One real touch whose answer is `want`; the DOM it must show between down and up is checked here. `pending`: a queue was already pending on the button. */
  const go = async (slot, want, o = {}) => {
    await settle(page, slot)
    const pre = await read(page, slot)
    const p = await press(page, slot)
    const d = await p.read()
    await p.up()
    const tap = await lastTap(page)
    const id = `#${seq.length + 1} ${slot} ${want}`
    assertEq(`${id}: the logged result`, tap.result, want)
    if (want === 'cast') {
      assertEq(`${id}: a new 12 ms buzz`, nVib(d, 12), nVib(pre, 12) + 1)
      if (!o.hold) assert(d.readyIn[slot] > 0, `${id}: the cooldown started, readyIn ${d.readyIn[slot]}`)
      assert(!d.cls.includes('kick') && !d.cls.includes('nope') && !d.cls.includes('queued'), `${id}: a plain cast shows no other answer, classes ${d.cls.join(' ')}`)
    } else if (want === 'push') {
      assert(d.cls.includes('kick'), `${id}: the rim kicks, classes ${d.cls.join(' ')}`)
      assertEq(`${id}: the push signature`, d.vib.at(-1), [14, 26, 14])
      assert(!d.cls.includes('arming') && !d.cls.includes('nope'), `${id}: a push has no ring and no shake, classes ${d.cls.join(' ')}`)
    } else if (want === 'queued') {
      assert(d.cls.includes('queued') && d.cls.includes('arming') && parseFloat(d.arm) === 360, `${id}: the cold full ring, classes ${d.cls.join(' ')}, --arm ${d.arm}`)
    } else if (want === 'guarded') {
      assert(d.cls.includes('nope'), `${id}: the "no" shake, classes ${d.cls.join(' ')}`)
      if (o.pending) assert(d.cls.includes('queued') && d.cls.includes('arming') && parseFloat(d.arm) === 360, `${id}: a pending queue keeps its full cold ring, classes ${d.cls.join(' ')}, --arm ${d.arm}`)
      else assert(!d.cls.includes('arming') && d.arm === pre.arm, `${id}: no ring and no arc, classes ${d.cls.join(' ')}, --arm "${d.arm}" (was "${pre.arm}")`)
      assert(d.heard.filter((h) => h === 'deadTap').length === pre.heard.filter((h) => h === 'deadTap').length + 1, `${id}: the dry click was asked for`)
    } else if (want === 'refused') {
      assert(d.cls.includes('refused'), `${id}: the refusal shake, classes ${d.cls.join(' ')}`)
      assertEq(`${id}: nothing fired (no new buzz)`, d.vib.length, pre.vib.length)
    }
    seq.push({ slot, want, got: tap.result })
    return d
  }
  const away = (x) => evalJson(page, `(x) => window.__still.pos.set(x, 0, 0)`, x)

  // all ready: four casts (the legs plant)
  await go('head', 'cast')
  await go('torso', 'cast')
  await go('arms', 'cast')
  await go('legs', 'cast', { hold: true })
  // 100 ms on, inside every fire's 250 ms: guarded
  await step(page, 0.1)
  await go('head', 'guarded')
  await go('torso', 'guarded')
  await go('arms', 'guarded')
  // clear of every guard: three pushes, and a fourth touch on one of them at once
  await gap(page)
  await go('head', 'push')
  await go('torso', 'push')
  await go('arms', 'push')
  await go('arms', 'guarded')
  // three queues (250, 200, 280 ms left), a touch on a pending one, then the queues fire
  await gap(page)
  await cool(page, 'head', 250)
  await cool(page, 'torso', 200)
  await cool(page, 'arms', 280)
  await go('head', 'queued')
  await go('torso', 'queued')
  await go('arms', 'queued')
  await go('head', 'guarded', { pending: true })
  await step(page, 0.35)
  // two ready casts, one touched again at once
  await cool(page, 'head', 0)
  await cool(page, 'arms', 0)
  await go('head', 'cast')
  await go('arms', 'cast')
  await go('arms', 'guarded')
  // a push on a cooling Vent, and a push on a cooling Lens touched again at once
  await gap(page)
  await cool(page, 'torso', 2000)
  await go('torso', 'push')
  await cool(page, 'head', 2000)
  await go('head', 'push')
  await go('head', 'guarded')
  // the run refuses three: the anchor is out and Still is 15 u from it
  await away(15)
  await go('legs', 'refused')
  await go('legs', 'refused')
  await go('legs', 'refused')
  await away(0)

  const n = (w) => seq.filter((x) => x.want === w).length
  assertEq('24 scripted touches', seq.length, 24)
  for (const w of ['cast', 'push', 'queued', 'guarded', 'refused']) assert(n(w) >= 3, `at least 3 ${w} touches, got ${n(w)}`)
  assertEq('every answer got its own reply (cast / push / queued / guarded / refused)', ['cast', 'push', 'queued', 'guarded', 'refused'].map(n), [6, 5, 3, 7, 3])
  const taps = await evalJson(page, `() => window.__taps()`)
  assertEq('every touch is logged, in order', taps.map((t) => t.result), seq.map((x) => x.want))
  for (const t of taps) assert(['cast', 'push', 'queued', 'guarded', 'refused'].includes(t.result) && t.tp === true, `a logged result outside the five answers: ${JSON.stringify(t)}`)
  const after = await read(page, 'arms')
  const d = (k) => after.st[k] - before.st[k]
  assertEq('no touch was dead', d('deadTaps'), 0)
  assertEq('the counters sum to the touches they count: tapPushes, pushes, queued, guarded', [d('tapPushes'), d('pushes'), d('queued'), d('guarded')], [n('push'), n('push'), n('queued'), n('guarded')])
  assertEq('the queues all fired: none dropped', d('queueDropped'), 0)
  assertEq('the strain is 2 a push', after.strain - before.strain, 2 * n('push'))
})

// ---- K-P11: with weight ----------------------------------------------------------------------------------------------------------------

// A crowned hulk winding up 2 u ahead (lean.mjs K-L4(a)'s setup), the four pairs of switches. A ready or queued Cleaver is a ready cast: under weight it
// has a push's whole effect (it breaks the windup) and none of its cost or signature; a tap push is the real push on either
check('K-P11', RUN, async ({ page }) => {
  /** A fresh arena, both switches set, a crowned hulk in its windup 2 u ahead (held there), the feel's counters zeroed. */
  const scene = async (weight, tap) => {
    await setup(page, tap)
    await evalJson(page, `(w) => {
      const W = window, C = W.__combat
      W.__weight(w)
      W.__weightPreset('B')
      C.pressure = false
      C.hurtPlayer = () => {}
      W.__still.facing = 0
      const h = W.__spawn('chaser', 0, 2, true, 'plated')
      h.hp = 1e6
      let n = 0
      while (h.phase !== 'windup' && n++ < 240) { C.hp = 100; W.__still.pos.set(0, 0, 0); h.pos.set(h.pos.x, 0, h.pos.z); h.knock.set(0, 0, 0); W.__step(1 / 60) }
      if (h.phase !== 'windup') throw new Error('the crowned hulk never wound up')
      h.timer = 4000
      W.__hulk = h
      W.__vib.length = 0
      W.__fx()
    }`, weight)
    return evalJson(page, `() => {
      const s = window.__runStats().at(-1)
      return { breaks: s.breaks, ready: s.breaksBy.ready, pushed: s.breaksBy.pushed, pushes: s.pushes, strain: window.__run.strain }
    }`)
  }
  const result = async (b0) => evalJson(page, `(b0) => {
    const W = window, s = W.__runStats().at(-1), f = W.__fx()
    return { broke: s.breaks - b0.breaks, ready: s.breaksBy.ready - b0.ready, pushed: s.breaksBy.pushed - b0.pushed, pushes: s.pushes - b0.pushes,
      strain: W.__run.strain - b0.strain, sig: f.pushSig, vib: W.__vib.at(-1) ?? null, phase: W.__hulk.phase }
  }`, b0)
  for (const weight of [true, false]) {
    for (const tap of [false, true]) {
      const mode = `weight ${weight ? 'on' : 'off'}, tap push ${tap ? 'on' : 'off'}`
      const free = { broke: weight ? 1 : 0, ready: weight ? 1 : 0, pushed: 0, pushes: 0, strain: 0, sig: 0, vib: 12 }
      const strip = (r) => ({ broke: r.broke, ready: r.ready, pushed: r.pushed, pushes: r.pushes, strain: r.strain, sig: r.sig, vib: r.vib })

      // a ready Cleaver pressed: a free cast, breaking the windup only under weight
      let b0 = await scene(weight, tap)
      await touch(page, 'arms')
      let r = await result(b0)
      assertEq(`${mode}: a ready Cleaver (breaks, ready, pushed, pushes, strain, pushSig, vib)`, strip(r), free)
      if (weight) assertEq(`${mode}: the hulk reels open`, r.phase, 'recover')

      // a queued Cleaver (the switch on only): fires as a ready cast, so the same
      if (tap) {
        b0 = await scene(weight, tap)
        await cool(page, 'arms', 200)
        const t = await touch(page, 'arms')
        assertEq(`${mode}: the touch queued`, t.tap.result, 'queued')
        const mid = await result(b0)
        assertEq(`${mode}: nothing fired at the touch`, [mid.broke, mid.strain, mid.vib], [0, 0, null])
        await step(page, 0.25)
        r = await result(b0)
        assertEq(`${mode}: a queued Cleaver (breaks, ready, pushed, pushes, strain, pushSig, vib)`, strip(r), free)
        if (weight) assertEq(`${mode}: the hulk reels open`, r.phase, 'recover')
        else assertEq(`${mode}: the hulk is still winding up`, r.phase, 'windup')
      }

      // a push by the gesture of the mode (a tap on, a 0.2 s hold off): the real push, breaking it either way, with its own signature and +2
      b0 = await scene(weight, tap)
      await cool(page, 'arms', 2000)
      const t = await touch(page, 'arms', tap ? 0 : 0.2)
      assertEq(`${mode}: the touch pushed`, t.tap.result, 'push')
      r = await result(b0)
      assertEq(`${mode}: a push (breaks, ready, pushed, pushes, strain, pushSig, vib)`, strip(r), { broke: 1, ready: 0, pushed: 1, pushes: 1, strain: 2, sig: 1, vib: [14, 26, 14] })
      assertEq(`${mode}: the hulk reels open`, r.phase, 'recover')
    }
  }
})

// ---- K-P12: the words ------------------------------------------------------------------------------------------------------------------

/** In the page: what the three one-time captions say when each is asked for on a fresh save (heat, break, pay), in that order. */
const WORDS = `() => {
  const W = window
  const on = (l) => [...document.querySelectorAll('.btn:has(.lbl[aria-label="' + l + '"]) .heatCaption')].map((e) => e.textContent)
  const all = () => document.querySelectorAll('.heatCaption').length
  const out = {}
  W.__hud.heat('arms', 500)
  out.heat = on('A')
  out.breakAsked = W.__hud.breakHint('torso')
  out.break = on('T')
  W.__hud.stateCue('legs', 'chilled', true)
  out.pay = on('L')
  out.total = all()
  return out
}`

const DEAD = 'hold to push'
const wordsCheck = (on) => async ({ page }) => {
  const mode = on ? 'on' : 'off'
  await setup(page, on)
  await cool(page, 'legs', 2000)
  const w = await evalJson(page, WORDS)
  const want = on ? ['hot · tap to push', 'tap · break it', 'tap · pay it'] : ['hot · hold to push', 'hold · break it', 'hold · pay it']
  assertEq(`${mode}: the heat caption (over the hot Cleaver)`, w.heat, [want[0]])
  assertEq(`${mode}: the break hint was asked for and shown`, w.breakAsked, true)
  assertEq(`${mode}: the break caption (over the Vent)`, w.break, [want[1]])
  assertEq(`${mode}: the pay caption (a lit state cue on the cooling legs)`, w.pay, [want[2]])
  assertEq(`${mode}: exactly the three captions`, w.total, 3)
  await page.waitForTimeout(2700)
  assertEq(`${mode}: they go on their own`, await page.locator('.heatCaption').count(), 0)

  if (on) {
    // every kind of touch on a cooling button: none of them shows the dead tap's caption; a hold-path press that the switch outlives does not either
    await gap(page)
    await cool(page, 'arms', 2000)
    await touch(page, 'arms')
    await touch(page, 'arms')
    await gap(page)
    await cool(page, 'torso', 200)
    await touch(page, 'torso')
    await evalJson(page, `() => window.__tapPush(false)`)
    await cool(page, 'head', 2000)
    const p = await press(page, 'head')
    await evalJson(page, `() => window.__tapPush(true)`)
    await p.step(0.06)
    await p.up()
    assertEq('on: the press begun off and let go on ends dead by the old path', (await lastTap(page)).result, 'dead')
    const caps = await page.locator('.heatCaption').allTextContents()
    assert(!caps.includes(DEAD), `on: no touch ever shows the dead tap's caption, got ${JSON.stringify(caps)}`)
  } else {
    // the control: today's dead tap shows it, once
    await cool(page, 'arms', 2000)
    const p = await press(page, 'arms')
    await p.step(0.06)
    await p.up()
    assertEq('off: a short press on a cooling button is dead', (await lastTap(page)).result, 'dead')
    assertEq('off: it shows the dead tap caption', await page.locator('.heatCaption').allTextContents(), [DEAD])
  }
}
// the second query is ignored by the game; it only tells the two pages apart
check('K-P12', RUN + '&p12=on', wordsCheck(true))
check('K-P12', RUN + '&p12=off', wordsCheck(false))

process.exit(await run(process.argv.slice(2)))
