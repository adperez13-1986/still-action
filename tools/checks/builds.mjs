/**
 * The "builds" trial's checks (design/buildlayer/BUILD.md §5.2; the word "builds" is a PLACEHOLDER, cores.ts WORDS). B1 lands K-M1 to K-M5: off is today's game
 * (K-M1), the data (K-M2, with tools/corecheck.ts), flat temper (K-M3), the marks machine (K-M4) and the switch (K-M5). Each later step adds its own ids.
 * Each check is one evaluate on the arena with the frame loop held, except K-M5's real click on the pause screen's row and the tasks that spawn other suites.
 * `node tools/checks/builds.mjs [K-M1 ...]`.
 *
 * "builds" is ON by default from B1 (the lead's call, 2 Oct): the suites boot with the key unset, so on. No core can be worn until B4's pick, and with no core the gate
 * is shut: the game is today's. A check that wants a core says so (`__core`), and every check starts by taking it off.
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { assert, assertEq, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, task, run } = suite()

const HERE = fileURLToPath(new URL('.', import.meta.url))

/**
 * In the page: a clean arena with Still's four starting parts (lens, vent, cleaver, kickstart) or `o.parts`, no core, "builds" on, the frame loop held, the autos
 * off unless `o.autos`, the break rule on, weight and tap push as the page booted them (on). Every button is ready.
 */
const SETUP = `(o = {}) => {
  const W = window
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  W.__core(null)
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of o.parts ?? ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
  W.__hold(true)
  W.__arena()
  const C = W.__combat
  delete C.hurtPlayer
  C.time = 0
  C.pressure = true
  C.counters = false
  C.breakRule = true
  C.autoAttack = !!o.autos
  W.__stick(0, 0)
  W.__fx()
  W.__partLog.length = 0
}`

/**
 * In the page, after SETUP: \`tick\` is one step with Still where he was and whole; \`secs(s)\` that many seconds of ticks; \`wall(hp, x, z)\` a pressure hulk whose HP a strike
 * doesn't end, its walk held (speedMul 0: a position read is the part's alone); \`marks(e)\` its core marks; \`idx(e)\` its index in __combat.enemies;
 * \`ev(kind)\` the part events of that kind since SETUP (plain values); \`spendsOf()\` those of the spend.
 */
const HELPERS = `
  const W = window
  const C = W.__combat
  const last = () => W.__run.stats[W.__run.stats.length - 1]
  const tick = () => { C.hp = 100; W.__still.pos.set(0, 0, 0); W.__step(1 / 60) }
  const secs = (s) => { for (let i = 0; i < Math.round(s * 60); i++) tick() }
  const wall = (hp = 1e6, x = 0, z = 2) => { const e = W.__spawn('chaser', x, z, true); e.hp = hp; e.speedMul = 0; return e }
  const marks = (e) => { const st = new Map(C.statuses()).get(e); return st ? { n: st.marks.n, t: st.marks.t, since: st.marks.since } : { n: 0, t: 0, since: 0 } }
  const idx = (e) => C.enemies.indexOf(e)
  const ev = (kind) => W.__partLog.filter((x) => x.kind === kind)
  const spendsOf = () => ev('spend').map((x) => ({ n: x.n, bonus: x.bonus, payer: x.payer, killed: x.killed }))
`

/**
 * What each suite prints on the live defaults (weight and tap push on, B0's record, 2 Oct 2026, re-taken at the start of B1 on the tree as B0 left it): its argv, every id
 * it prints, and the ids that FAIL there. K-M1 holds the suites that read the fight itself: with no core they must print the same.
 */
const RECORD = {
  'fights.mjs': { args: ['compare'], pass: ['K-90F'], fail: [] },
  'autos.mjs': { args: [], pass: ['K-A2', 'K-A3', 'K-A4', 'K-A5', 'K-A6', 'K-A7', 'K-A8', 'K-A9', 'K-A10'], fail: [] },
  'k9.mjs': {
    args: [],
    pass: ['K-9B', 'K-9B9', 'K-96a', 'K-97a', 'K-9A', 'K-92a', 'K-91', 'K-98', 'K-99', 'K-97b', 'K-96b', 'K-95a', 'K-94', 'K-93', 'K-95b', 'K-96c', 'K-9C', 'K-9D'],
    fail: [],
  },
  'lean.mjs': { args: [], pass: ['K-L1', 'K-L2', 'K-L10', 'K-L6', 'K-L7', 'K-L8', 'K-L9', 'K-L4', 'K-L5', 'K-L3', 'K-L11', 'K-L13', 'K-L12', 'K-L12w'], fail: [] },
  'tap.mjs': { args: [], pass: ['K-P1', 'K-P2', 'K-P3', 'K-P9', 'K-P4', 'K-P5', 'K-P6', 'K-P8', 'K-P10', 'K-P13', 'K-P7', 'K-P11', 'K-P12'], fail: [] },
}

/** Run one suite as a child process, the switches' env stripped (a WEIGHT=0, TAP=0 or CORE= run of this file must not change the children): its PASS / FAIL lines, in order. */
function suiteLines(file, args) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env }
    delete env.TAP
    delete env.WEIGHT
    delete env.CORE
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

/** A tsx script as a child process: its exit code and output. */
function tsx(file) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', file], { cwd: HERE + '../../' })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, out }))
  })
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// K-M1 off is today (a task, then the page part)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

// the suites that read the fight itself print what B0 left, with the switch on by default and no core worn
task('K-M1', async () => {
  // K_M1_PAGE=1: the page part alone (the suites below take about four minutes)
  if (process.env.K_M1_PAGE === '1') return
  for (const [file, rec] of Object.entries(RECORD)) {
    const lines = await suiteLines(file, rec.args)
    const got = lines.map((l) => `${l.verdict}:${l.id}`)
    const want = [...rec.pass.map((id) => `PASS:${id}`), ...rec.fail.map((id) => `FAIL:${id}`)]
    const extra = got.filter((g) => !want.includes(g))
    const missing = want.filter((w) => !got.includes(w))
    assert(extra.length === 0 && missing.length === 0, `${file} ${rec.args.join(' ')}: differs from the record: now ${extra.join(', ') || 'nothing new'}; no longer ${missing.join(', ') || 'nothing lost'}`)
    assertEq(`${file}: lines printed`, got.length, want.length)
  }
})

/**
 * One scripted 30 s fight in the page (fights.mjs's F1: three pressure hulks round Still at 3 u, seed 1, the autos on, a Scrap Cleaver at III pressed when ready, HP put
 * back each tick), under the given switch. The Cleaver at III is what a wrongly flat temper would change. Returns what the fight looked like every half second, as JSON.
 */
const F1 = `(builds) => {
  const W = window
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const r3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null)
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  W.__builds(builds)
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  W.__equipRank('scrap-cleaver', 3)
  const original = Math.random
  Math.random = mulberry32(1)
  try {
    W.__hold(true)
    W.__arena()
    const C = W.__combat
    C.time = 0
    C.pressure = true
    C.counters = false
    C.breakRule = false
    C.autoAttack = true
    W.__stick(0, 0)
    const a0 = Math.random() * Math.PI * 2
    for (let k = 0; k < 3; k++) W.__spawn('chaser', Math.sin(a0 + (k * 2 * Math.PI) / 3) * 3, Math.cos(a0 + (k * 2 * Math.PI) / 3) * 3, true)
    const ticks = []
    let lost = 0
    const hand0 = W.__runStats().at(-1).hand
    for (let i = 0; i < 30 * 60; i++) {
      C.hp = 100
      if (i % 90 === 0) W.__fire('arms')
      W.__step(1 / 60)
      lost += 100 - C.hp
      if (i % 30 === 29) ticks.push({ t: r3(C.time), lost: r3(lost), e: C.enemies.map((e) => [r3(e.pos.x), r3(e.pos.z), r3(e.hp), e.phase]) })
    }
    return { ticks, hand: W.__runStats().at(-1).hand - hand0, loadout: W.__hud.loadout.map((d) => [d.id, d.damage, d.cooldownMs]) }
  } finally {
    Math.random = original
  }
}`

// `trialDefaults`: the page boots as a fresh phone does, with no key pinned (lib.mjs pins an unset builds key to '1' like weight's and tap push's)
check('K-M1', RUN + '&trialDefaults', async ({ page }) => {
  const boot = await evalJson(page, () => ({ stored: localStorage.getItem('still-action.builds'), core: window.__combat.core, runCore: window.__run.core, builds: window.__builds() }))
  assertEq("a fresh context has the builds key unset, no core, and the switch on (the default)", boot, { stored: null, core: null, runCore: null, builds: true })
  const sha = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex')
  const a = await evalJson(page, `() => (${F1})(true)`)
  const b = await evalJson(page, `() => (${F1})(false)`)
  const c = await evalJson(page, `() => (${F1})(true)`)
  assert(a.ticks.length === 60 && a.loadout[0][1] === 29, `the scripted fight ran 30 s with the Cleaver at III on today's temper (damage ${a.loadout[0]?.[1]}, want 29)`)
  assertEq('the fight with "builds" on and no core equals the fight with it off', sha(a), sha(b))
  assertEq('...and equals itself with it switched back on', sha(a), sha(c))
  const log = await evalJson(page, () => { const s = window.__run.stats.at(-1); return { core: s.core, temperFlat: s.temperFlat } })
  assertEq('the open depth logs core null and temperFlat false', log, { core: null, temperFlat: false })
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// K-M2 the data (tools/corecheck.ts is the static half)
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

task('K-M2', async () => {
  const { code, out } = await tsx('tools/corecheck.ts')
  assert(code === 0 && /all pass/.test(out), `tools/corecheck.ts: exit ${code}: ${out.split('\n').filter((l) => /^ {2}\S/.test(l) || /FAIL/.test(l)).slice(0, 6).join(' | ')}`)
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// K-M3 flat temper
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** tempered(d, r) at B1's start (b7b4118 + B0, 0f51803): per part and rank, the first 10 hex of sha1 of [name, rank, damage, cooldownMs, radius, cone, blastDamage, windowMs, mod]. */
const TEMPER_PINNED = {
  'focusing-lens@2': 'c85515e03c', 'focusing-lens@3': 'e6b3445ae8', 'flare@2': '33bb5410ec', 'flare@3': '64f7002a9e', 'cracked-lens@2': '01743c1b9b',
  'cracked-lens@3': 'bcd739cea4', 'ricochet-lens@2': '7b438977b7', 'ricochet-lens@3': '1359260956', 'patient-lens@2': '208db9382e',
  'patient-lens@3': 'f030dd02c9', 'signal-flare@2': 'b2ea1707c0', 'signal-flare@3': '5ed7d75fc9', 'through-line@2': '77bb911953',
  'through-line@3': '7aed6a7eb6', 'overclocked-coil@2': '1981deae62', 'overclocked-coil@3': '358bcd3b9a', 'pressure-vent@2': 'b28cc74f9a',
  'pressure-vent@3': '93570eb9b6', 'ward@2': '48f7f4be9a', 'ward@3': 'e28d85cf2f', 'backdraft-vent@2': 'ce9270cd5e', 'backdraft-vent@3': '9af19e4847',
  'chill-vent@2': '368a125ebe', 'chill-vent@3': '9423affc15', 'brace@2': 'fcb51737af', 'brace@3': '963aa0dba7', 'mirror-ward@2': '8b3664d18c',
  'mirror-ward@3': 'eee8af8183', 'lure@2': 'f5134311a6', 'lure@3': 'b85503e090', 'scrap-cleaver@2': '451f0c1ebe', 'scrap-cleaver@3': 'b55e06a9dd',
  'piston@2': 'aeafd031f4', 'piston@3': '5f6f48d98b', 'rusted-hook@2': '5c87dcc62b', 'rusted-hook@3': '85d9024296', 'parry-clamp@2': '232a83ea0f',
  'parry-clamp@3': 'c2a725201e', 'frayed-cleaver@2': '825fd6812e', 'frayed-cleaver@3': '96fe737cf7', 'clamp-toss@2': '3ce87dff92',
  'clamp-toss@3': 'e9b223caa5', 'anvil@2': '0ecbe6fe17', 'anvil@3': '43806e9b01', 'kickstart@2': '5139bb6fcd', 'kickstart@3': '5f4f50ed82',
  'skitter@2': '339764bbb1', 'skitter@3': '3b192d6fe9', 'skid-plates@2': 'bd00dc5eb9', 'skid-plates@3': 'b518659ad3', 'overrun@2': '6d740f2ba8',
  'overrun@3': 'c045775d2b', 'frost-trail@2': '4c5d7c1aa9', 'frost-trail@3': '27593cb6f8', 'spring-heels@2': '632609e2b2',
  'spring-heels@3': 'c78eb8a300', 'plumb-line@2': '8b0556922a', 'plumb-line@3': 'e4c41b96d2', 'borrowed-time@2': '1777cbaffa',
  'borrowed-time@3': '6d07538f4a',
}

check('K-M3', RUN, async ({ page }) => {
  // the shipped tables (and the flat ones), as the build computes them, against a table made here from the numbers
  const TEMPER = { damage: [1, 1.3, 1.6], cooldown: [1, 0.85, 0.72], area: [1, 1.15, 1.3] }
  const FLAT = { damage: [1, 1.15, 1.3], cooldown: [1, 0.92, 0.85] }
  const AREA = new Set(['nova', 'ward', 'lob', 'decoy'])
  const HELD = new Set(['ward', 'catch'])
  const n = (x, k) => Math.round(x * k)
  const u = (x, k) => +(x * k).toFixed(2)
  const got = await evalJson(page, () => window.__parts.flatMap((p) => [2, 3].map((r) => ({
    id: p.id, r, base: window.__tempered(p.id, 1), plain: window.__tempered(p.id, r), flat: window.__tempered(p.id, r, true),
  }))))
  assertEq('every part at ranks 2 and 3', got.length, 60)
  const proj = (d) => JSON.stringify([d.name, d.rank ?? 1, d.damage, d.cooldownMs, d.radius, d.cone ?? null, d.blastDamage ?? null, d.windowMs ?? null, d.mod ?? null])
  for (const { id, r, base, plain, flat } of got) {
    const i = r - 1
    // tempered(d, r, true): damage and cooldown from FLAT, area from TEMPER.area, a mod's numbers the same way
    const want = (T) => {
      const held = HELD.has(base.shape) || base.mod?.kind === 'brace'
      const mod = base.mod
      const mm = !mod ? mod
        : mod.kind === 'charge' ? { ...mod, minS: u(mod.minS, T.cooldown[i]), fullS: u(mod.fullS, T.cooldown[i]) }
        : mod.kind === 'reflect' ? { ...mod, damage: n(mod.damage, T.damage[i]) }
        : mod.kind === 'fray' ? { ...mod, cones: mod.cones.map((c) => Math.min(360, n(c, TEMPER.area[i]))) }
        : mod.kind === 'toss' ? { ...mod, wallDamage: n(mod.wallDamage, T.damage[i]) }
        : mod.kind === 'slam' ? { ...mod, damage: n(mod.damage, T.damage[i]), radius: u(mod.radius, TEMPER.area[i]) }
        : mod.kind === 'overrun' ? { ...mod, damage: n(mod.damage, T.damage[i]), radius: u(mod.radius, TEMPER.area[i]) }
        : mod.kind === 'strip' ? { ...mod, width: u(mod.width, TEMPER.area[i]) }
        : mod
      return {
        damage: n(base.damage, T.damage[i]), cooldownMs: n(base.cooldownMs, T.cooldown[i]), mod: mm,
        radius: AREA.has(base.shape) ? u(base.radius, TEMPER.area[i]) : base.radius,
        cone: base.shape === 'arc' && base.cone ? Math.min(360, n(base.cone, TEMPER.area[i])) : base.cone,
        blastDamage: base.blastDamage ? n(base.blastDamage, T.damage[i]) : base.blastDamage,
        windowMs: held && base.windowMs ? n(base.windowMs, TEMPER.area[i]) : base.windowMs,
      }
    }
    for (const [what, d, T] of [['flat', flat, FLAT], ['plain', plain, TEMPER]]) {
      const w = want(T)
      for (const k of Object.keys(w)) assertEq(`${id} at ${r} (${what}): ${k}`, d[k] ?? null, w[k] ?? null)
    }
    assertEq(`${id} at ${r}: the same part (id, slot, runtime)`, [flat.id, flat.slot, flat.shape, flat.beat, flat.rank], [id, base.slot, base.shape, base.beat, r])
    // tempered(d, r) is B1's start, pinned
    const h = createHash('sha1').update(proj(plain)).digest('hex').slice(0, 10)
    assertEq(`${id} at ${r}: temper with no flag is the values B1 started with`, h, TEMPER_PINNED[`${id}@${r}`])
  }
  // in the page: Scrap Cleaver at III under Wake is flat (23), after the switch goes off it is today's (29), and no button is made free by the flip
  const sw = await evalJson(page, `() => {
    (${SETUP})()
    ${HELPERS}
    W.__core('wake')
    W.__equipRank('scrap-cleaver', 3)
    const arms = () => W.__hud.loadout.find((d) => d.slot === 'arms')
    const onDef = { damage: arms().damage, cooldownMs: arms().cooldownMs, name: arms().name }
    const readyBefore = W.__hud.readyIn('arms')
    W.__builds(false)
    const offDef = { damage: arms().damage, cooldownMs: arms().cooldownMs, name: arms().name }
    const readyAfter = W.__hud.readyIn('arms')
    W.__builds(true)
    const backDef = { damage: arms().damage, cooldownMs: arms().cooldownMs }
    // a cooling button keeps its fraction: cast, run 1 s, flip, and it is not ready
    W.__fire('arms')
    secs(1)
    const cool0 = W.__hud.readyIn('arms')
    const cd0 = arms().cooldownMs
    W.__builds(false)
    const cool1 = W.__hud.readyIn('arms')
    const cd1 = arms().cooldownMs
    return { onDef, offDef, backDef, readyBefore, readyAfter, cool0, cd0, cool1, cd1, flatLog: last().temperFlat }
  }`)
  assertEq('Scrap Cleaver at III under Wake: round(18 x 1.3) = 23', sw.onDef.damage, 23)
  assertEq('...and its cooldown 2600 x 0.85', sw.onDef.cooldownMs, Math.round(2600 * 0.85))
  assertEq('after "builds" goes off it is today\'s: round(18 x 1.6) = 29', sw.offDef.damage, 29)
  assertEq('...cooldown 2600 x 0.72', sw.offDef.cooldownMs, Math.round(2600 * 0.72))
  assertEq('back on: flat again', [sw.backDef.damage, sw.backDef.cooldownMs], [23, Math.round(2600 * 0.85)])
  assertEq('a ready button stays ready across the flip', [sw.readyBefore, sw.readyAfter], [0, 0])
  assert(sw.cool0 > 500 && sw.cool1 > 0, `a cooling button is not made free by the flip (${sw.cool0} ms left before, ${sw.cool1} after)`)
  assert(Math.abs(sw.cool1 / sw.cd1 - sw.cool0 / sw.cd0) < 0.002, `...it keeps its cooldown fraction (${(sw.cool0 / sw.cd0).toFixed(4)} before, ${(sw.cool1 / sw.cd1).toFixed(4)} after)`)
  assertEq('the open depth logs temperFlat as it was at entry (no core: false)', sw.flatLog, false)
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// K-M4 the marks machine
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

check('K-M4', RUN, async ({ page }) => {
  // cap and life
  const life = await evalJson(page, `() => {
    (${SETUP})()
    ${HELPERS}
    W.__core('wake')
    const e = wall()
    const i = idx(e)
    const out = []
    const t0 = C.time
    for (let k = 0; k < 4; k++) {
      W.__setMarks(i, 1)
      out.push(marks(e))
      secs(0.5)
    }
    const afterFour = marks(e)
    secs(1.5)
    const aged = marks(e)
    W.__setMarks(i, 1)
    const refreshed = marks(e)
    W.__partLog.length = 0
    secs(3.0)
    const still = marks(e)
    secs(1 / 60 + 1 / 120)
    const gone = marks(e)
    return { t0, out, afterFour, aged, refreshed, still, gone, expired: ev('markExpired').map((x) => x.n), made: ev('mark').length }
  }`)
  assertEq('1, 2, 3 marks, and a fourth: n 1, 2, 3, 3', life.out.map((m) => m.n), [1, 2, 3, 3])
  assertEq('each one refreshes t to 3.0 (the fourth too, at the cap)', life.out.map((m) => m.t), [3, 3, 3, 3])
  assertEq("since is the first one's time", life.out.map((m) => m.since), [life.t0, life.t0, life.t0, life.t0])
  assertEq('t counts down in game time: 3.0 - 1.5 - 1.5 s apart the last refresh = 3.0 - 0.5 - 1.5', [life.afterFour.t < 3, life.aged.t < life.afterFour.t, life.aged.n], [true, true, 3])
  assertEq('a mark on a stack at 3 refreshes it to 3.0', [life.refreshed.t, life.refreshed.n], [3, 3])
  assert(life.still.n === 3 && life.still.t > 0 && life.still.t < 0.05, `3.0 s on, still there, a tick from the end (t ${life.still.t})`)
  assertEq('3.0 s plus a tick: n 0, t 0', [life.gone.n, life.gone.t], [0, 0])
  assertEq('...and one markExpired, for the 3 it held', life.expired, [3])

  // the spend: a part's own k per mark (3-balancer.md §1: Scrap Cleaver 3 under Wake / 4 under Ram, Frayed 10, Piston 12), the core's K (Wake 6, Ram 8) where it has none
  const spend = await evalJson(page, `() => {
    const out = {}
    const rig = (parts, marksN, o = {}) => {
      (${SETUP})({ parts })
      ${HELPERS}
      W.__core(o.core ?? 'wake')
      if (o.rank) W.__equipRank('scrap-cleaver', o.rank)
      const e = wall(1e6, 0, o.z ?? 2)
      if (marksN) W.__setMarks(idx(e), marksN)
      if (o.chill) C.setState(e, 'chilled', 5, 'torso')
      return { e, W, C, secs, marks, ev, spendsOf, last, idx, wall }
    }
    const fire = (r, slot, s = 0.5) => { const hp = r.e.hp; window.__partLog.length = 0; r.W.__fire(slot, false); r.secs(s); return hp - r.e.hp }
    /** the same part, marks 0 and marks n, under a core: the damage dealt each way and what the spend said */
    const pair = (id, slot, core, n, s = 0.5, z = 2) => {
      let r = rig([id], 0, { core, z })
      const control = fire(r, slot, s)
      r = rig([id], n, { core, z })
      const drop = fire(r, slot, s)
      return { control, drop, extra: drop - control, marks: r.marks(r.e).n, spends: r.spendsOf() }
    }
    const cl = ['scrap-cleaver']
    let r = rig(cl, 3)
    out.cleaver3 = { drop: fire(r, 'arms'), marks: r.marks(r.e), spends: r.spendsOf() }
    r = rig(cl, 0)
    out.cleaver0 = { drop: fire(r, 'arms'), spends: r.spendsOf() }
    r = rig(['focusing-lens'], 3)
    out.lens3 = { drop: fire(r, 'head'), marks: r.marks(r.e), spends: r.spendsOf() }
    // never multiplied
    r = rig(cl, 3, { rank: 3 })
    out.cleaverIII = { name: r.W.__hud.loadout[0].name, damage: r.W.__hud.loadout[0].damage, drop: fire(r, 'arms'), spends: r.spendsOf() }
    r = rig(cl, 3, { chill: true })
    r.W.__run.stats.at(-1).maxMul = 1
    out.chilled = { drop: fire(r, 'arms'), maxMul: r.last().maxMul, spends: r.spendsOf(), paid: r.ev('state').filter((x) => x.state === 'paid').map((x) => ({ mul: x.mul, bonus: x.bonus })) }
    // each spender's own k, and the core's K where it has none
    out.ramCleaver = pair('scrap-cleaver', 'arms', 'ram', 3)
    // under Wake Frayed Cleaver is Backhand, which swings behind him: the wall is at -z
    out.frayed = pair('frayed-cleaver', 'arms', 'wake', 3, 0.5, -2)
    out.piston = pair('piston', 'arms', 'ram', 3)
    out.flare = pair('flare', 'head', 'ram', 3, 1.2)
    // a spender of the other core, a plain part and a guard spend nothing
    out.otherCore = pair('piston', 'arms', 'wake', 3)
    // shatter: a 1-HP hulk with 3 marks at the edge of the swing's reach, a wall 1 u behind it, out of the swing
    r = rig(cl, 0)
    r.e.hp = 1
    r.e.pos.set(0, 0, 3.3)
    const next = r.wall(1e6, 0, 4.3)
    r.W.__setMarks(r.idx(r.e), 3)
    const before = next.hp
    r.W.__partLog.length = 0
    r.W.__fire('arms', false)
    r.secs(0.5)
    out.shatter = { dead: r.e.dead, neighbour: before - next.hp, spends: r.spendsOf(), shatter: r.ev('shatter').map((x) => x.damage) }
    return out
  }`)
  assertEq('a Cleaver under Wake (its own k 3) on 3 marks: weighed 22 + 3 x 3 = 31', spend.cleaver3.drop, 31)
  assertEq('...it leaves n 0, and says one spend of 3 for 9', [spend.cleaver3.marks.n, spend.cleaver3.marks.t, spend.cleaver3.spends], [0, 0, [{ n: 3, bonus: 9, payer: 'arms', killed: false }]])
  assertEq('with 0 marks: 22, and no spend', [spend.cleaver0.drop, spend.cleaver0.spends], [22, []])
  assertEq('a Lens (plain) on a 3-mark body: its weighed 31, and the marks stay', [spend.lens3.drop, spend.lens3.marks.n, spend.lens3.spends], [31, 3, []])
  assertEq('Scrap Cleaver III under Wake is flat: 23', [spend.cleaverIII.name, spend.cleaverIII.damage], ['Scrap Cleaver III', 23])
  assertEq('...on 3 marks: weighed 28 + 9 = 37, not round(31 x 1.3)', spend.cleaverIII.drop, 37)
  assertEq('a chilled 3-mark body: 22 x 2 + 9 = 53', spend.chilled.drop, 53)
  assertEq("...the pay is x2 and its bonus is the Cleaver's own 22, the marks are not in it", spend.chilled.paid, [{ mul: 2, bonus: 22 }])
  assertEq('...maxMul 2, and the spend still says 3 for 9', [spend.chilled.maxMul, spend.chilled.spends], [2, [{ n: 3, bonus: 9, payer: 'arms', killed: false }]])
  const adds = (what, p, perMark) => {
    assertEq(`${what}: 3 marks add ${3 * perMark} (${perMark} each) over the same hit with none`, [p.extra, p.marks, p.spends.map((x) => [x.n, x.bonus])], [3 * perMark, 0, [[3, 3 * perMark]]])
  }
  adds('Scrap Cleaver under Ram (k 4)', spend.ramCleaver, 4)
  adds('Frayed Cleaver as Backhand under Wake, a wall behind him (k 10)', spend.frayed, 10)
  adds('Piston under Ram (k 12)', spend.piston, 12)
  adds("Flare under Ram (no k of its own: the core's K 8)", spend.flare, 8)
  assertEq('Piston under Wake (not its core\'s part): no spend, the marks stay', [spend.otherCore.extra, spend.otherCore.marks, spend.otherCore.spends], [0, 3, []])
  assertEq('the 1-HP body died on the spend', [spend.shatter.dead, spend.shatter.spends.map((s) => s.killed)], [true, [true]])
  assertEq('shatter: the kill passes min(9, 22 + 9 - 1) = 9 to the wall', [spend.shatter.neighbour, spend.shatter.shatter], [9, [9]])

  // aim: a spender throws at the most marks, not at the nearest (Flare under Ram, a lob); with no marks it is the nearest, as ever
  const aim = await evalJson(page, `() => {
    const out = {}
    for (const marked of [false, true]) {
      (${SETUP})({ parts: ['flare'] })
      ${HELPERS}
      W.__core('ram')
      const near = wall(1e6, -3, 4)
      const far = wall(1e6, 3.6, 4.2)
      if (marked) W.__setMarks(idx(far), 2)
      const h = [near.hp, far.hp]
      W.__partLog.length = 0
      W.__fire('head', false)
      secs(1.2)
      out[marked ? 'marked' : 'plain'] = { near: h[0] - near.hp, far: h[1] - far.hp, spends: spendsOf() }
    }
    return out
  }`)
  assert(aim.plain.near > 0 && aim.plain.far === 0 && aim.plain.spends.length === 0, `no marks: the Flare goes to the nearest (${JSON.stringify(aim.plain)})`)
  assert(aim.marked.far > 0 && aim.marked.near === 0, `a farther body with 2 marks takes the Flare, the nearer one is not touched (${JSON.stringify(aim.marked)})`)
  assertEq('...and its marks are spent: 2 x the core\'s K 8 (Flare has no k of its own)', aim.marked.spends, [{ n: 2, bonus: 16, payer: 'head', killed: false }])

  // B2: the same spend with marks made by real skims (three passes over one wall, 3 s of life refreshed each time), not set by the hook
  const real = await evalJson(page, `() => {
    (${SETUP})({ parts: ['scrap-cleaver'], autos: true })
    ${WAKE}
    W.__core('wake')
    zero()
    const w = body(1.2, 0)
    place(0, -1.5)
    let n3 = false
    for (let k = 0; k < 10 && !n3; k++) {
      W.__stick(0, k % 2 ? -1 : 1)
      for (let i = 0; i < 33 && !n3; i++) { C.hp = 100; W.__step(1 / 60); if (marks(w).n >= 3) n3 = true }
    }
    W.__stick(0, 0)
    const made = { n: marks(w).n, made: last().marks.made, byCore: last().marks.byCore, skims: last().skims.n }
    place(0, 0)
    pin(0, 0)
    const hp = w.hp
    W.__partLog.length = 0
    W.__fire('arms', false)
    for (let i = 0; i < 30; i++) pin(0, 0)
    return { made, drop: hp - w.hp, spends: spendsOf(), left: marks(w).n }
  }`)
  assertEq('marks made by three real skims: 3 marks, by the core, three skims logged', [real.made.n, real.made.made, real.made.byCore, real.made.skims], [3, 3, 3, 3])
  assertEq('...then Scrap Cleaver on it: weighed 22 + 3 x 3 = 31, a spend of 3 for 9, and n 0', [real.drop, real.spends, real.left], [31, [{ n: 3, bonus: 9, payer: 'arms', killed: false }], 0])

  // off: no core, __setMarks does nothing, and the same Cleaver deals 22
  const off = await evalJson(page, `() => {
    (${SETUP})({ parts: ['scrap-cleaver'] })
    ${HELPERS}
    const out = {}
    for (const mode of ['no core', 'builds off']) {
      if (mode === 'builds off') { W.__core('wake'); W.__builds(false) }
      const e = wall()
      W.__setMarks(idx(e), 3)
      const m = marks(e)
      const hp = e.hp
      W.__partLog.length = 0
      W.__fire('arms', false)
      secs(0.5)
      out[mode] = { marks: m.n, drop: hp - e.hp, spends: spendsOf(), core: C.core, events: ev('mark').length }
      e.hp = -1
      W.__hud.ready('arms', 'cold')
    }
    return out
  }`)
  assertEq('no core: __setMarks does nothing, and the Cleaver deals 22', off['no core'], { marks: 0, drop: 22, spends: [], core: null, events: 0 })
  assertEq('a core worn but "builds" off: the same', off['builds off'], { marks: 0, drop: 22, spends: [], core: null, events: 0 })
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// K-M5 the switch
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** In the page: the pause screen's builds row, clicked by the DOM; closes the pause screen. */
const FLIP = `() => {
  const W = window
  W.__pause.loadout(W.__hud.slots, () => {})
  const b = [...document.querySelectorAll('#pause .rule')].find((x) => x.textContent.startsWith('builds'))
  b.click()
  W.__pause.hide()
}`

check('K-M5', RUN + '&trialDefaults', async ({ page }) => {
  await evalJson(page, `() => { window.__run.dev = false }`)
  // the loadout screen shows one switch labelled builds; one real click flips it and localStorage follows
  await evalJson(page, `() => { (${SETUP})(); window.__pause.loadout(window.__hud.slots, () => {}) }`)
  const row = page.locator('#pause .rule', { hasText: /^builds/ })
  assertEq('the loadout screen shows one switch labelled builds', await row.count(), 1)
  assertEq('it starts on (the default: the key is unset)', [await row.locator('b').textContent(), await page.evaluate(() => localStorage.getItem('still-action.builds'))], ['on', null])
  await row.click()
  assertEq('one real click: it reads off and the stored switch is 0', [await row.locator('b').textContent(), await page.evaluate(() => localStorage.getItem('still-action.builds'))], ['off', '0'])
  await row.click()
  assertEq('a second click: on, stored 1', [await row.locator('b').textContent(), await page.evaluate(() => localStorage.getItem('still-action.builds'))], ['on', '1'])
  await evalJson(page, `() => window.__pause.hide()`)

  // with no core: a flip changes nothing in the fight, and logs no coreMixed
  const bare = await evalJson(page, `() => {
    const W = window
    W.__core(null)
    W.__enter(2, 1)
    W.__step(0.2)
    const read = () => ({ core: W.__combat.core, mixed: W.__run.stats.at(-1).coreMixed ?? null, builds: W.__builds() })
    const out = { before: read() }
    ;(${FLIP})()
    out.off = read()
    ;(${FLIP})()
    out.on = read()
    return out
  }`)
  assertEq('no core, flipped off: combat.core null before and after, no coreMixed', [bare.before.core, bare.off, bare.on.core, bare.on.mixed], [null, { core: null, mixed: null, builds: false }, null, null])

  // with a core, mid-crawl: it goes at once, the depth is mixed, the next depth is not, and two flips are one flag
  const cored = await evalJson(page, `() => {
    const W = window
    W.__core('wake')
    W.__enter(2, 1)
    W.__step(0.2)
    const st = () => W.__run.stats.at(-1)
    const read = () => ({ core: W.__combat.core, mixed: st().coreMixed ?? null, entry: st().core, builds: W.__builds(), stored: localStorage.getItem('still-action.builds') })
    const out = { start: read() }
    ;(${FLIP})()
    out.off = read()
    ;(${FLIP})()
    out.on = read()
    ;(${FLIP})()
    out.off2 = read()
    W.__enter(3, 1)
    W.__step(0.2)
    out.next = { ...read(), depth: st().depth, flat: st().temperFlat }
    ;(${FLIP})()
    out.nextOn = { ...read(), depth: st().depth }
    return out
  }`)
  assertEq('with a core, builds on: combat.core wake, nothing mixed', [cored.start.core, cored.start.mixed, cored.start.entry], ['wake', null, 'wake'])
  assertEq('flipped off mid-crawl: combat.core is null at once, the open depth is mixed, its entry value stays wake', [cored.off.core, cored.off.mixed, cored.off.entry, cored.off.stored], [null, true, 'wake', '0'])
  assertEq('flipped on again: the core is back at once, still one flag', [cored.on.core, cored.on.mixed], ['wake', true])
  assertEq('flipped a third time (off): still mixed true, no throw', [cored.off2.core, cored.off2.mixed], [null, true])
  assertEq('the next depth logs no coreMixed, core null (it was entered with the switch off), temperFlat false', [cored.next.depth, cored.next.mixed, cored.next.core, cored.next.flat], [3, null, null, false])
  assertEq('...a flip in it is mixed there, and the core is back', [cored.nextOn.core, cored.nextOn.mixed, cored.nextOn.depth], ['wake', true, 3])
  await evalJson(page, `() => { (${SETUP})() }`)
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B2: Wake. K-M6 to K-M12 and K-M30 (K-M4 has a case with real, skim-made marks too).
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * In the page, after SETUP: the helpers Wake's checks move Still with. `place(x, z)` puts him there and tells combat it was a jump (a teleport must never read as a
 * velocity, or it skims); `pin(x, z)` is one tick with him held there; `go(sx, sz, s, rec)` walks the stick that long (HP put back each tick; `rec(i)` after each tick);
 * `skims()` is the skim events since the last call as { i, t } (game time), and empties the part log; `body` is a wall; `one(phi, d, v)` is the angle test: a body `phi`
 * degrees off his heading and `d` from his centre, one tick of walking along `v`, and what that tick left on it; `spendsIdx()` the spends with the body's index.
 */
const WAKE = HELPERS + `
  // B6b: Wake's frostbite and its trail's marks are muted here, so these suites keep testing the skim alone (WAKE2.md changed Wake's combat on purpose); K-M31 / K-M32 unmute them
  const WK = W.__cores.wake
  W.__wake2 ??= { everyS: WK.bite.everyS, halfWidth: WK.trail.halfWidth }
  const isolate = (on = true) => { WK.bite.everyS = on ? 1e9 : W.__wake2.everyS; WK.trail.halfWidth = on ? -1 : W.__wake2.halfWidth }
  isolate(true)
  const zero = () => { const s = last(); s.marks = { made: 0, byCore: 0, byPart: 0, spent: 0, expired: 0 }; s.spends = { hits: 0, bonus: 0, lag: [0, 0, 0, 0] }; delete s.skims; s.autoDmg = { hand: 0, eye: 0, core: 0 }; s.autoDmgReal = { hand: 0, eye: 0, core: 0 }; s.hand = 0; s.eye = 0; s.eyeCasts = 0; s.plantedS = 0; W.__partLog.length = 0 }
  const place = (x, z) => { W.__still.pos.set(x, 0, z); C.hasPrev = false }
  const pin = (x, z) => { C.hp = 100; W.__still.pos.set(x, 0, z); W.__step(1 / 60) }
  const pinFor = (x, z, s) => { for (let i = 0; i < Math.round(s * 60); i++) pin(x, z) }
  const go = (sx, sz, s, rec) => { W.__stick(sx, sz); for (let i = 0; i < Math.round(s * 60); i++) { C.hp = 100; W.__step(1 / 60); if (rec) rec(i) } W.__stick(0, 0) }
  const skims = () => { const out = ev('skim').map((x) => ({ i: idx(x.enemy), t: C.time })); W.__partLog.length = 0; return out }
  const body = (x, z, hp = 1e6) => wall(hp, x, z)
  const drain = () => { const out = { skims: ev('skim').map((x) => ({ i: idx(x.enemy), t: C.time, burst: !!x.burst, spray: x.spray ? idx(x.spray) : null })), spends: spendsIdx() }; W.__partLog.length = 0; return out }
  const spendsIdx = () => ev('spend').map((x) => ({ i: idx(x.enemy), n: x.n, bonus: x.bonus, payer: x.payer }))
  const one = (phi, d, v = [0, 1]) => {
    W.__emptyLevel()
    W.__stick(0, 0)
    // where he will stand after the tick (one step of the stick from the origin); the body is placed from there
    const step = 5.5 / 60
    const fx = v[0] * step, fz = v[1] * step
    const n = [-v[1], v[0]]
    const a = phi * Math.PI / 180
    const e = body(fx + d * (Math.cos(a) * v[0] + Math.sin(a) * n[0]), fz + d * (Math.cos(a) * v[1] + Math.sin(a) * n[1]))
    // prevPlayer is where he stood last tick: this tick's displacement is exactly one step along the stick
    C.prevPlayer.set(0, 0, 0)
    C.hasPrev = true
    W.__still.pos.set(0, 0, 0)
    W.__partLog.length = 0
    W.__stick(v[0], v[1])
    C.hp = 100
    W.__step(1 / 60)
    W.__stick(0, 0)
    return { marks: marks(e).n, skims: skims().length, hp: 1e6 - e.hp }
  }
`

check('K-M6', RUN, async ({ page }) => {
  // standing does nothing at all: three walls at 1.2 u round Still, the stick at rest, 3 s, the autos on
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    W.__core('wake')
    zero()
    const ws = [0, 1, 2].map((k) => body(1.2 * Math.sin(k * 2.1), 1.2 * Math.cos(k * 2.1)))
    W.__partLog.length = 0
    pinFor(0, 0, 3)
    return { dmg: last().autoDmgReal, hp: ws.map((w) => 1e6 - w.hp), made: last().marks.made, mk: W.__coreMarks().length, ev: W.__partLog.length,
      hand: last().hand, eye: last().eye, eyeCasts: last().eyeCasts, skims: last().skims ?? null, nominal: last().autoDmg }
  }`)
  assertEq('3 s standing among 3 walls: core damage 0, and none from the hand or the eye', [r.dmg.core, r.dmg.hand + r.dmg.eye], [0, 0])
  assertEq('...no body took any damage, no mark was made, no event said so', [r.hp, r.made, r.mk, r.ev], [[0, 0, 0], 0, 0, 0])
  assertEq('...the hand struck 0 times, the eye shot 0 and cast 0, no skims logged, the nominal autoDmg untouched', [r.hand, r.eye, r.eyeCasts, r.skims, r.nominal], [0, 0, 0, null, { hand: 0, eye: 0, core: 0 }])
})

check('K-M7', RUN, async ({ page }) => {
  // the skim: walking past three walls set 1.2 u to the side, 1.5 u apart, marks them; back and forth, a body is skimmed at most once a second and holds at most 3
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    W.__core('wake')
    zero()
    const ws = [3, 4.5, 6].map((z) => body(1.2, z))
    place(0, 0)
    W.__partLog.length = 0
    const hp0 = ws.map((w) => w.hp)
    const times = new Map()
    let maxN = 0
    const stamp = () => { for (const s of skims()) times.set(s.i, [...(times.get(s.i) ?? []), s.t]); for (const w of ws) maxN = Math.max(maxN, marks(w).n) }
    go(0, 1, 1.5, stamp)
    const ns = ws.map((w) => marks(w).n)
    const pass = { marked: ns.filter((n) => n > 0).length, ns, hurt: ws.map((w, i) => hp0[i] - w.hp), made: last().marks.made, byCore: last().marks.byCore, sk: { ...last().skims }, nominal: last().autoDmg.core }
    for (let k = 0; k < 4; k++) go(0, k % 2 ? 1 : -1, 1, stamp)
    const gaps = [...times.values()].map((t) => t.slice(1).map((x, j) => x - t[j]))
    return { pass, gaps, n: [...times.values()].map((t) => t.length), maxN }
  }`)
  assert(r.pass.marked >= 2, `within 1.5 s of walking past, 2+ of 3 walls are marked (${r.pass.marked}: ${r.pass.ns})`)
  assertEq('the pass: one mark per skim by the core, logged', [r.pass.made, r.pass.byCore, r.pass.sk.n], [r.pass.marked, r.pass.marked, r.pass.marked])
  assertEq("...each marked body took the skim's 6, the others nothing", r.pass.hurt, r.pass.ns.map((n) => n * 6))
  assertEq('...the nominal core damage logged is 6 a skim', r.pass.nominal, r.pass.marked * 6)
  const gaps = r.gaps.flat()
  assert(gaps.length >= 3 && Math.min(...gaps) >= 0.999, `back and forth for 4 s: no body skimmed twice less than 1.0 s apart (least ${gaps.length ? Math.min(...gaps).toFixed(4) : 'none'} over ${gaps.length} gaps; skims per body ${r.n})`)
  assert(r.maxN <= 3, `no body held more than 3 marks (most ${r.maxN})`)
})

check('K-M7b', RUN, async ({ page }) => {
  // 3-balancer.md: a skim on a body that can't be moved (the Assembler: too heavy to lift) is whole (6, not the autos' boss half 3), once per 0.5 s, not 1 s
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    W.__core('wake')
    zero()
    const boss = W.__spawn('boss', 2.6, 0, true)
    boss.speedMul = 0
    place(0, -0.7)
    W.__partLog.length = 0
    const rows = []
    for (let k = 0; k < 12; k++) {
      W.__stick(0, k % 2 ? -1 : 1)
      for (let i = 0; i < 15; i++) {
        C.hp = 100
        const hp = boss.hp
        W.__step(1 / 60)
        const d = drain()
        if (d.skims.length) rows.push({ t: C.time, drop: hp - boss.hp, n: marks(boss).n })
      }
    }
    W.__stick(0, 0)
    return { rows, kind: boss.kind, knock: boss.knockMul, real: last().autoDmgReal.core, nominal: last().autoDmg.core }
  }`)
  const gaps = r.rows.slice(1).map((x, i) => x.t - r.rows[i].t)
  assertEq('the boss skims: each one deals the whole 6', [...new Set(r.rows.map((x) => x.drop))], [6])
  assert(r.rows.length >= 4 && gaps.every((g) => g >= 0.499) && gaps.some((g) => g < 0.99), `...as often as every 0.5 s, never faster (gaps ${gaps.map((g) => g.toFixed(2)).join(' ')} over ${r.rows.length} skims)`)
  assertEq('...logged as the core\'s real damage, 6 a skim', r.real, r.rows.length * 6)
})

check('K-M8', RUN, async ({ page }) => {
  // beside, not behind: straight at, straight away, the 45-degree edge, the 1.6 u edge distance
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    W.__core('wake')
    const out = {}
    const real = (name, wx, wz, sx, sz, s) => {
      W.__emptyLevel(); W.__partLog.length = 0
      const e = body(wx, wz)
      place(0, 0)
      go(sx, sz, s)
      out[name] = { marks: marks(e).n, skims: skims().length }
    }
    real('at', 0, 1.2, 0, 1, 0.5)
    real('away', 0, 1.2, 0, -1, 2)
    real('past', 1.2, 0, 0, 1, 0.5)
    const R = 0.55
    out.at1 = one(0, 1 + R)
    out.away1 = one(180, 1 + R)
    out.a44 = one(44, 1 + R)
    out.a46 = one(46, 1 + R)
    out.a90 = one(90, 1 + R)
    out.a134 = one(134, 1 + R)
    out.a136 = one(136, 1 + R)
    out.edge165 = one(90, 1.65 + R)
    out.edge155 = one(90, 1.55 + R)
    return out
  }`)
  assertEq('walking straight at a wall 1.2 u ahead for 0.5 s: 0 marks, no skim', r.at, { marks: 0, skims: 0 })
  assertEq('walking straight away from it for 2 s: 0 marks', r.away, { marks: 0, skims: 0 })
  assertEq('passing it at 90 degrees: 1 mark', r.past.marks, 1)
  assertEq('on the line to the body, toward and away, one tick: 0 and 0', [r.at1.marks, r.away1.marks], [0, 0])
  assertEq('44 degrees off the line to the body: 0; 46 degrees: 1', [r.a44.marks, r.a46.marks], [0, 1])
  assertEq('the far side of the edge: 134 degrees: 1; 136 degrees: 0', [r.a134.marks, r.a136.marks], [1, 0])
  assertEq('90 degrees: 1 mark, and the skim dealt 6', [r.a90.marks, r.a90.hp], [1, 6])
  assertEq('a body at edge distance 1.65 u: 0; at 1.55 u: 1', [r.edge165.marks, r.edge155.marks], [0, 1])
})

check('K-M9', RUN, async ({ page }) => {
  // Wake spends: marks made by skims, cashed by Scrap Cleaver (own k 3 under Wake), Skate (the core's K 6) and Backhand (own k 10)
  const r = await evalJson(page, `() => {
    const out = {}
    {
      (${SETUP})({ parts: ['scrap-cleaver'], autos: true })
      ${WAKE}
      W.__core('wake')
      const ws = [0, 1.2, 2.4].map((z) => body(1.2, z))
      place(0, -1.5)
      go(0, 1, 1.0)
      place(0, 3.5)
      pinFor(0, 3.5, 1.1)
      place(0, 3.5)
      go(0, -1, 0.35)
      const ns = ws.map((w) => marks(w).n)
      place(0, 1.2)
      pin(0, 1.2)
      const before = ws.map((w) => w.hp)
      W.__partLog.length = 0
      W.__fire('arms', false)
      for (let i = 0; i < 30; i++) pin(0, 1.2)
      out.cleaver = { ns, drop: ws.map((w, i) => before[i] - w.hp), after: ws.map((w) => marks(w).n), spends: spendsIdx().sort((a, b) => a.i - b.i).map((x) => [x.n, x.bonus]) }
    }
    {
      (${SETUP})({ parts: ['frost-trail'], autos: true })
      ${WAKE}
      W.__core('wake')
      out.skateDef = { name: W.__hud.loadout[0].name, damage: W.__hud.loadout[0].damage }
      const ws = [0, 1].map((k) => body(1.2, 2 + k * 1.6))
      place(0, -1.5)
      go(0, 1, 1.0)
      place(0, 3.5)
      pinFor(0, 3.5, 1.1)
      place(0, -1.5)
      pin(0, -1.5)
      const ns = ws.map((w) => marks(w).n)
      const before = ws.map((w) => w.hp)
      W.__partLog.length = 0
      W.__stick(0, 1)
      W.__fire('legs', false)
      const sk = [], sp = []
      for (let i = 0; i < 60; i++) { C.hp = 100; W.__step(1 / 60); const d = drain(); sk.push(...d.skims); sp.push(...d.spends) }
      W.__stick(0, 0)
      out.skate = { ns, drop: ws.map((w, i) => before[i] - w.hp), spends: ws.map((w) => sp.filter((x) => x.i === idx(w)).map((x) => [x.n, x.bonus, x.payer])), glide: ws.map((w) => sk.filter((s) => s.i === idx(w)).length) }
    }
    {
      (${SETUP})({ parts: ['frayed-cleaver'], autos: true })
      ${WAKE}
      W.__core('wake')
      const d = W.__hud.loadout[0]
      out.backDef = { name: d.name, damage: d.damage, cone: d.cone, mod: d.mod }
      const behind = body(0, -2.0)
      const ahead = body(0, 2.0)
      W.__setMarks(idx(behind), 2)
      W.__still.facing = 0
      place(0, 0)
      pin(0, 0)
      const b0 = [behind.hp, ahead.hp]
      W.__partLog.length = 0
      W.__fire('arms', false)
      for (let i = 0; i < 30; i++) pin(0, 0)
      out.backhand = { behind: b0[0] - behind.hp, ahead: b0[1] - ahead.hp, left: marks(behind).n, spends: spendsOf().map((x) => [x.n, x.bonus]), facing: W.__still.facing }
      W.__emptyLevel()
      const front = body(0, 2.0)
      W.__hud.ready('arms', 'cold')
      W.__still.facing = 0
      pin(0, 0)
      const f0 = front.hp
      W.__fire('arms', false)
      for (let i = 0; i < 30; i++) pin(0, 0)
      out.whiff = { dmg: f0 - front.hp, cooling: W.__hud.readyIn('arms') > 0 }
      W.__emptyLevel()
      const west = body(-2.0, 0)
      const east = body(2.0, 0)
      W.__hud.ready('arms', 'cold')
      W.__stick(1, 0)
      pin(0, 0)
      const w0 = [west.hp, east.hp]
      W.__fire('arms', false)
      for (let i = 0; i < 30; i++) pin(0, 0)
      out.stick = { west: w0[0] - west.hp, east: w0[1] - east.hp }
      W.__stick(0, 0)
    }
    return out
  }`)
  assert(new Set(r.cleaver.ns).size > 1 && r.cleaver.ns.every((n) => n >= 1), `the skims gave the three walls different counts (${r.cleaver.ns})`)
  assertEq('Scrap Cleaver under Wake (weighed 22, own k 3): each body drops 22 + 3 x its own marks', r.cleaver.drop, r.cleaver.ns.map((n) => 22 + n * 3))
  assertEq('...every body is at 0 marks after, and the spends say 3 each for what they held', [r.cleaver.after, r.cleaver.spends], [[0, 0, 0], r.cleaver.ns.map((n) => [n, n * 3])])
  assertEq('Skate is the reshape (12, weighed 22)', [r.skateDef.name, r.skateDef.damage], ['Skate', 12])
  // each wall: 22 (the run-over) + what it spent (the core's K 6 a mark, Skate has no k of its own) + 6 for each skim the glide itself made on it
  assertEq('...it spent on each wall at 6 a mark, once', r.skate.spends.map((s) => s.length === 1 && s[0][1] === s[0][0] * 6 && s[0][2] === 'legs'), [true, true])
  assertEq('...each body dropped 22 + its spend + 6 a glide skim', r.skate.drop, r.skate.spends.map((s, i) => 22 + s[0][1] + r.skate.glide[i] * 6))
  assert(r.skate.spends.every((s, i) => s[0][0] >= r.skate.ns[i] && r.skate.ns[i] >= 1), `...and each spend took at least the marks the walls held (${JSON.stringify(r.skate.ns)} before, spends ${JSON.stringify(r.skate.spends)})`)
  assertEq('Backhand is the reshape (18, a 150 degree arc, behind)', [r.backDef.name, r.backDef.damage, r.backDef.cone, r.backDef.mod], ['Backhand', 18, 150, { kind: 'behind' }])
  assertEq('a marked wall behind and an unmarked one ahead: the behind one is struck (weighed 22 + 2 marks x its own k 10), the one ahead is not', [r.backhand.behind, r.backhand.ahead, r.backhand.left, r.backhand.spends], [42, 0, 0, [[2, 20]]])
  assert(Math.abs(Math.abs(r.backhand.facing) - Math.PI) < 0.01, `...the swing turned him to face behind (facing ${r.backhand.facing.toFixed(2)}, behind is pi)`)
  assertEq('nothing behind: the wall ahead takes nothing, and the cooldown starts (a whiff behind)', [r.whiff.dmg, r.whiff.cooling], [0, true])
  assertEq('the stick decides what is behind: stick +x strikes the wall at -x and not the one at +x', [r.stick.west > 0, r.stick.east], [true, 0])
})

check('K-M10', RUN, async ({ page }) => {
  // Wake's keystones and upgrades
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    const boot = (keystone, upgrade) => {
      (${SETUP})({ autos: true })
      W.__core('wake')
      if (keystone) W.__keystone(keystone)
      if (upgrade) W.__upgrade(upgrade)
    }
    // a wall skimmed to and fro, tick by tick: what each skim did to it
    const trace = (keystone) => {
      boot(keystone, null)
      zero()
      const w = body(1.2, 0)
      place(0, -1.5)
      W.__partLog.length = 0
      const rows = []
      for (let k = 0; k < 8; k++) {
        W.__stick(0, k % 2 ? -1 : 1)
        for (let i = 0; i < 33; i++) {
          C.hp = 100
          const hp = w.hp
          W.__step(1 / 60)
          const d = drain()
          if (d.skims.length) rows.push({ drop: hp - w.hp, spends: d.spends.map((x) => [x.n, x.bonus, x.payer]), n: marks(w).n, t: C.time })
        }
      }
      W.__stick(0, 0)
      return { rows, sk: last().skims, spent: last().marks.spent, core: last().autoDmg.core }
    }
    out.burst = trace('wake-burst')
    out.plain = trace(null)
    // Deep: a wall holds 5 for 4.0 s, and the ring has 5 segments; without it 3 and 3.0 s
    const deep = (key) => {
      boot(key, null)
      place(0, 0)
      const w = body(1.2, 4)
      for (let k = 0; k < 6; k++) W.__setMarks(idx(w), 1)
      const m = marks(w)
      W.__markFx.draw(C, 0, 0, 0)
      const segs = W.__markFx.group.children.filter((c) => c.visible).map((c) => c.name)
      pinFor(0, 0, 3.5)
      const at35 = marks(w).n
      pinFor(0, 0, 0.5 + 1 / 60 + 1 / 120)
      return { n: m.n, t: m.t, segs, at35, gone: marks(w).n }
    }
    out.deep = deep('wake-deep')
    out.cap3 = deep(null)
    // Spray: a skim on A marks B (1.0 u behind A, further from Still) once, never C (2.0 u behind)
    const spray = (up) => {
      boot(null, up)
      zero()
      const A = body(0, 1.2), B = body(0, 2.2), Cc = body(0, 3.2)
      place(-2.5, 0)
      W.__partLog.length = 0
      go(1, 0, 1.0)
      return { a: marks(A).n, b: marks(B).n, c: marks(Cc).n, sk: last().skims, by: last().marks.byCore }
    }
    out.spray = spray('wake-spray')
    // C alone, 2.0 u behind A (nothing nearer): out of reach, so unmarked
    {
      boot(null, 'wake-spray')
      zero()
      const A = body(0, 1.2), Cc = body(0, 3.2)
      place(-2.5, 0)
      go(1, 0, 1.0)
      out.sprayFar = { a: marks(A).n, c: marks(Cc).n, sk: last().skims.spray }
    }
    out.noSpray = spray(null)
    // Slip: after one skim, walk speed x1.15 for 0.25 s; many skims bank at most 1.0 s
    const slip = (up) => {
      boot(null, up)
      const w = body(1.2, 0)
      place(0, -2)
      const dz = []
      let z0 = W.__still.pos.z
      let slipAfter = null
      W.__stick(0, 1)
      for (let i = 0; i < 70; i++) {
        C.hp = 100
        W.__step(1 / 60)
        const z = W.__still.pos.z
        dz.push(z - z0)
        z0 = z
        if (slipAfter === null && drain().skims.length) slipAfter = C.slipS
      }
      W.__stick(0, 0)
      const base = 5.5 / 60
      return { slipAfter, fast: dz.filter((d) => d > base * 1.1).length, base: dz[0] / base, top: Math.max(...dz) / base, marks: marks(w).n }
    }
    out.slip = slip('wake-slip')
    out.noSlip = slip(null)
    const bank = (up) => {
      boot(null, up)
      zero()
      const ws = []
      for (const x of [1.5, -1.5]) for (const z of [-0.7, 0, 0.7]) ws.push(body(x, z))
      C.prevPlayer.set(0, 0, 0)
      C.hasPrev = true
      W.__still.pos.set(0, 0, 0)
      W.__partLog.length = 0
      W.__stick(0, 1)
      C.hp = 100
      W.__step(1 / 60)
      W.__stick(0, 0)
      return { slipS: C.slipS, skims: last().skims?.n ?? 0, made: ws.filter((w) => marks(w).n > 0).length }
    }
    out.bank = bank('wake-slip')
    out.noBank = bank(null)
    return out
  }`)
  // Burst
  const [b1, b2, b3, b4] = r.burst.rows
  assertEq('Burst: the first two skims on a wall deal 6 each and leave 1, 2 marks', [b1.drop, b1.n, b2.drop, b2.n, b1.spends, b2.spends], [6, 1, 6, 2, [], []])
  assertEq('...the third deals 6 + round(1.0 x 3 x 6) = 24, spends the 3 as the core (18), and leaves n 0', [b3.drop, b3.spends, b3.n], [24, [[3, 18, 'core']], 0])
  assertEq('...skims.burst counts it (once in this walk), marks.spent counts the 3, the nominal core damage is 6 a skim and 18 a burst', [r.burst.sk.burst, r.burst.spent, r.burst.core], [r.burst.rows.filter((x) => x.spends.length).length, r.burst.rows.filter((x) => x.spends.length).length * 3, r.burst.sk.n * 6 + r.burst.sk.burst * 18])
  assert(r.burst.sk.burst === 1 && b4 && b4.n === 1 && b4.drop === 6, `...a fourth skim starts a new stack (n ${b4?.n}, ${b4?.drop})`)
  const p3 = r.plain.rows[2]
  assertEq('without Burst: the third skim is 6 and the wall holds 3, no spend, no burst', [p3.drop, p3.n, p3.spends, r.plain.sk.burst], [6, 3, [], 0])
  // Deep
  assertEq('Deep Frost: a wall takes 6 marks and holds 5, for 4.0 s, and the ring has 5 segments', [r.deep.n, r.deep.t, r.deep.segs.length, r.deep.segs.every((n) => n.startsWith('marks-5-'))], [5, 4, 5, true])
  assertEq('...still there at 3.5 s, gone a tick after 4.0', [r.deep.at35, r.deep.gone], [5, 0])
  assertEq('without it: 3 marks, 3.0 s, 3 segments, gone by 3.5 s', [r.cap3.n, r.cap3.t, r.cap3.segs.length, r.cap3.at35], [3, 3, 3, 0])
  // Spray
  assertEq('Spray: a skim on A marks B (1.0 u behind it, further from Still) once, and never C (2.0 u behind)', [r.spray.a, r.spray.b, r.spray.c], [1, 1, 0])
  assertEq('...logged once, and both marks are the core\'s', [r.spray.sk.spray, r.spray.by], [1, 2])
  assertEq('...and a body 2.0 u behind A with nothing nearer is out of its 1.5 u reach', [r.sprayFar.a, r.sprayFar.c, r.sprayFar.sk], [1, 0, 0])
  assertEq('without Spray: only A', [r.noSpray.a, r.noSpray.b, r.noSpray.c, r.noSpray.sk.spray], [1, 0, 0, 0])
  // Slip
  assertEq('Slip: one skim banks 0.25 s', r.slip.slipAfter, 0.25)
  assert(Math.abs(r.slip.fast - 15) <= 1 && Math.abs(r.slip.top - 1.15) < 0.005 && Math.abs(r.slip.base - 1) < 0.005, `...his walk speed is x1.15 for 0.25 s of fight time (${r.slip.fast} ticks fast of 15 +-1, x${r.slip.top.toFixed(3)} at most, x${r.slip.base.toFixed(3)} before)`)
  assert(r.bank.skims >= 4 && r.bank.slipS === 1, `${r.bank.skims} skims in one tick bank 1.0 s, not more (slipS ${r.bank.slipS})`)
  assertEq('without Slip: nothing banked, no speed-up', [r.noSlip.slipAfter, r.noSlip.fast, r.noBank.slipS], [0, 0, 0])
})

check('K-M11', RUN, async ({ page }) => {
  // the reshapes: Backhand, Skate and Frost Flare under Wake; the base parts otherwise
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    const base = (id) => JSON.parse(JSON.stringify(W.__parts.find((p) => p.id === id)))
    const worn = () => Object.fromEntries(W.__hud.loadout.map((d) => [d.id, JSON.parse(JSON.stringify(d))]))
    const ids = ['signal-flare', 'frayed-cleaver', 'frost-trail']
    out.base = Object.fromEntries(ids.map((id) => [id, base(id)]))
    ;(${SETUP})({ parts: ['signal-flare', 'pressure-vent', 'frayed-cleaver', 'frost-trail'] })
    W.__core('wake')
    out.wake = worn()
    W.__core('ram')
    out.ram = worn()
    W.__core('wake')
    W.__builds(false)
    out.off = worn()
    W.__builds(true)
    // Frost Flare's blast: 2 marks and a x0.5 slow on every body in 2.2 u (+ its radius), never the marked state
    ;(${SETUP})({ parts: ['signal-flare'] })
    W.__core('wake')
    const near = body(0, 3), mid = body(0, 5), far = body(0, 6)
    W.__partLog.length = 0
    W.__fire('head', false)
    pinFor(0, 0, 1.0)
    const st = (e) => { const s = C.statusOf(e); return s ? { marks: s.marks.n, slowT: s.slowT, slowMul: s.slowMul, marked: s.marked.t } : { marks: 0, slowT: 0, slowMul: 1, marked: 0 } }
    out.flare = { near: st(near), mid: st(mid), far: st(far), hit: [near, mid, far].map((e) => 1e6 - e.hp), made: last().marks.made, byPart: last().marks.byPart, marksEv: ev('mark').map((x) => x.by), states: ev('state').map((x) => x.id) }
    // the cards: a signal-flare on the floor under Still, the pickup card and the compare card
    const card = () => {
      W.__dropAt('signal-flare', 0, 0)
      W.__step(1.5)
      const o = { name: document.querySelector('#offer .name')?.textContent, line: document.querySelector('#offer .line')?.textContent }
      document.querySelector('#offer .compare').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      const cards = [...document.querySelectorAll('#pause .pcard')]
      const c = cards[cards.length - 1]
      const cmp = c ? { name: c.querySelector('.pname')?.textContent, line: c.querySelector('.pline')?.textContent, stats: [...c.querySelectorAll('.stat')].map((s) => s.textContent) } : null
      W.__pause.hide()
      return { pickup: o, compare: cmp }
    }
    ;(${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] })
    W.__core('wake')
    out.cardWake = card()
    W.__emptyLevel(); W.__core(null)
    ;(${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] })
    out.cardBare = card()
    return out
  }`)
  const flat = (d) => ({ id: d.id, slot: d.slot, tier: d.tier, key: d.key, drops: d.drops, fits: d.fits })
  for (const id of ['signal-flare', 'frayed-cleaver', 'frost-trail']) {
    assertEq(`${id} under Wake keeps its id, slot, tier, drops, key and fits`, flat(r.wake[id]), flat(r.base[id]))
    assertEq(`${id} under Ram is the base part, as worn (deep-equal)`, r.ram[id], r.base[id])
    assertEq(`${id} with builds off is the base part, as worn (deep-equal)`, r.off[id], r.base[id])
  }
  const pick = (d, ks) => Object.fromEntries(ks.map((k) => [k, d[k] ?? null]))
  assertEq('Backhand under Wake: an arc, 18, 150 degrees, cooldown 2400, range 3.1, mod behind, no fray, no iconStates', pick(r.wake['frayed-cleaver'], ['name', 'shape', 'damage', 'cone', 'cooldownMs', 'range', 'mod', 'iconStates']), { name: 'Backhand', shape: 'arc', damage: 18, cone: 150, cooldownMs: 2400, range: 3.1, mod: { kind: 'behind' }, iconStates: null })
  assertEq('Skate under Wake: a dash, 12, radius 1.0, range 5.6, travel 420, shove 0.6, cooldown 5500, no strip, no sets', pick(r.wake['frost-trail'], ['name', 'shape', 'damage', 'radius', 'range', 'travelMs', 'shove', 'cooldownMs', 'mod', 'sets']), { name: 'Skate', shape: 'dash', damage: 12, radius: 1, range: 5.6, travelMs: 420, shove: 0.6, cooldownMs: 5500, mod: null, sets: null })
  assertEq('Frost Flare under Wake: a lob, 14, range 11, radius 2.2, travel 800, cooldown 5000, rime 2 marks x0.5 for 2 s, no sets', pick(r.wake['signal-flare'], ['name', 'shape', 'damage', 'range', 'radius', 'travelMs', 'cooldownMs', 'mod', 'sets']), { name: 'Frost Flare', shape: 'lob', damage: 14, range: 11, radius: 2.2, travelMs: 800, cooldownMs: 5000, mod: { kind: 'rime', marks: 2, slowMul: 0.5, slowMs: 2000 }, sets: null })
  const f = r.flare
  assertEq('Frost Flare lands 2 marks and a x0.5 slow (2 s) on the bodies in 2.2 u, and not on the one past it', [f.near.marks, f.near.slowMul, f.mid.marks, f.mid.slowMul, f.far.marks, f.far.slowT], [2, 0.5, 2, 0.5, 0, 0])
  assert(f.near.slowT > 0.9 && f.near.slowT <= 2, `...the slow is 2 s from the landing (${f.near.slowT.toFixed(2)} left a second on)`)
  assertEq('...it never sets the marked state, hits the two bodies (weighed 17) and not the third, and the marks are the head slot\'s, logged by part', [[f.near.marked, f.mid.marked, f.far.marked], f.hit, f.byPart, [...new Set(f.marksEv)], f.states.filter((s) => s === 'marked')], [[0, 0, 0], [17, 17, 0], 4, ['head'], []])
  assertEq('the pickup card for signal-flare under Wake reads Frost Flare and its line', [r.cardWake.pickup.name, r.cardWake.pickup.line], ['Frost Flare', 'Frosts what it lands on, and slows it.'])
  assertEq('the compare card reads it, with the reshaped numbers (cooldown 5.0s, damage 17 weighed)', [r.cardWake.compare.name, r.cardWake.compare.line, r.cardWake.compare.stats.some((s) => s.includes('5.0s')), r.cardWake.compare.stats.some((s) => s.includes('17'))], ['Frost Flare', 'Frosts what it lands on, and slows it.', true, true])
  assertEq('with no core, both cards read Signal Flare', [r.cardBare.pickup.name, r.cardBare.compare.name, r.cardBare.compare.line], ['Signal Flare', 'Signal Flare', 'Marks enemies where it lands. Parts that pay marks hit them twice.'])
})

check('K-M12', RUN, async ({ page }) => {
  // the hand and the eye are gone: 10 s among walls (Wake: standing; Ram: at 4 u, out of reach), no stance, no brace
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    for (const core of ['wake', 'ram', null]) {
      (${SETUP})({ autos: true })
      W.__core(core)
      zero()
      const ws = [0, 1, 2].map((k) => body(4 * Math.sin(k * 2.1), 4 * Math.cos(k * 2.1)))
      const s0 = { hand: 0, eye: 0, core: 0 }, eye0 = 0, cast0 = 0, hand0 = 0
      pinFor(0, 0, 10)
      const rest = { stance: C.inStance, eyeTarget: !!C.eyeTarget }
      // a scripted 10-damage blow at rest
      W.__emptyLevel()
      delete C.hurtPlayer
      C.hurtCooldown = 0
      C.hp = 100
      C.hurtPlayer(10, 'shot')
      const lost = 100 - C.hp
      const s1 = last().autoDmgReal
      out[String(core)] = { stance: rest.stance, eyeTarget: rest.eyeTarget, lost, ad: s1.hand + s1.eye - s0.hand - s0.eye, core: s1.core - s0.core, hand: last().hand - hand0, eye: last().eye - eye0, eyeCasts: last().eyeCasts - cast0, plantedS: last().plantedS }
    }
    return out
  }`)
  for (const c of ['wake', 'ram']) {
    const x = r[c]
    assertEq(`${c}: 10 s among 3 walls: no hand damage, no eye damage, no strikes, no lances, no eye casts`, [x.ad, x.hand, x.eye, x.eyeCasts], [0, 0, 0, 0])
    assertEq(`${c}: not planted after 10 s at rest (no stance, no sightline target, no planted seconds)`, [x.stance, x.eyeTarget, x.plantedS], [false, false, 0])
    assertEq(`${c}: the brace is gone: a 10-damage blow at rest costs 10`, x.lost, 10)
  }
  assertEq('the bare control: planted at rest, the same blow costs 5', [r.null.stance, r.null.lost], [true, 5])
  assert(r.null.ad > 0 || r.null.hand > 0, `the bare control used its hand or eye (hand ${r.null.hand}, damage ${r.null.ad})`)
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B3: Ram. K-M13 to K-M19, and K-M30 for Ram's ring (K-M12 already holds Ram's hand and eye gone). Numbers: 3-balancer.md (the shove takes 8; Domino's chain bodies take 8; Catch only on a
// body that can't be moved, and spends). Every test body's walk is held (speedMul 0), so a position read is the shove's alone.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/**
 * In the page, after SETUP: Wake's helpers (`place`, `pin`, `pinFor`, `go`, `body`, `zero`) and Ram's. `arena(boxes)` is a clean floor with these wall boxes ({ minX, maxX, minZ, maxZ }),
 * the autos on, the core as it was; `hulk(x, z, o)` a pressure hulk whose HP a strike doesn't end and whose walk is held (\`o.crown\`: a crowned one, which is not pressure and winds up;
 * \`o.hp\`); \`log()\` Ram's shove records since the last call; \`sh()\` the depth's \`shoves\` as logged (zeros before the first); \`hpOf(e)\` HP taken so far; \`still(x, z)\` stands him there, a
 * jump and not a step.
 */
const RAM = WAKE + `
  const zr = () => { zero(); delete last().shoves; last().wallS = 0; last().closeS = 0 }
  const arena = (boxes = []) => {
    W.__arena({ boxes, auto: true })
    delete C.hurtPlayer
    C.time = 0
    C.pressure = true
    C.counters = false
    C.breakRule = true
    C.autoAttack = true
    // the beat is ready, as on a fresh page (reset() leaves the timer, like the hand's)
    C.autoTimer = 0
    W.__stick(0, 0)
    W.__fx()
    W.__partLog.length = 0
    W.__shoveLog()
    zr()
  }
  const hulk = (x, z, o = {}) => { const e = W.__spawn('chaser', x, z, true, o.crown ? 'plated' : undefined); e.hp = o.hp ?? 1e6; e.speedMul = 0; return e }
  const log = () => W.__shoveLog().map((r) => ({ i: r.i, slam: r.slam, other: r.other, why: r.why, link: r.link, dmg: r.dmg, t: r.t }))
  const sh = () => ({ n: 0, wall: 0, body: 0, still: 0, tell: 0, plain: 0, chained: 0, caught: 0, beat: { n: 0, wall: 0, body: 0, still: 0, tell: 0 }, ...(last().shoves ?? {}) })
  const hpOf = (e) => 1e6 - e.hp
  const still = (x, z) => place(x, z)
  const wallBox = (z, w = 12) => ({ minX: -w, maxX: w, minZ: z, maxZ: z + 1 })
`

check('K-M13', RUN, async ({ page }) => {
  // the shove: a hulk in open floor takes the core's 8, slides 1.5 u, is not marked; walking away from it shoves nothing; nothing in reach and the beat waits
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${RAM}
    W.__core('ram')
    const out = {}
    // a hulk at 2.6 u (out of its own contact, 2.05 u: a hulk touching Still is in its cock, and a body in its tell is never moved: K-M16), one beat
    arena()
    let e = hulk(0, 2.6)
    still(0, 0)
    pin(0, 0)
    out.first = { hit: hpOf(e), marks: marks(e).n, log: log(), dmgNominal: last().autoDmg.core, dmgReal: last().autoDmgReal.core, hand: last().hand, eye: last().eye }
    pinFor(0, 0, 0.5 - 1 / 60)
    out.moved = { z: e.pos.z, x: e.pos.x, marks: marks(e).n, hit: hpOf(e), sh: sh() }
    // walking straight away from it, the hulk kept 2.6 u from him: no shove in 2 s. Standing, the same hulk is shoved every beat
    for (const walk of [true, false]) {
      arena()
      e = hulk(0, 2.6)
      still(0, 0)
      if (walk) W.__stick(0, -1)
      for (let i = 0; i < 120; i++) { C.hp = 100; W.__step(1 / 60); e.pos.set(0, 0, W.__still.pos.z + 2.6); e.knock.set(0, 0, 0) }
      W.__stick(0, 0)
      // the first tick after a jump has no velocity to read (a teleport is never a step), so the beat that is ready then is not at issue: count from the second tick
      out[walk ? 'away' : 'stand'] = { shoves: log().filter((x) => x.t > 2.5 / 60).length, z: W.__still.pos.z }
    }
    // nothing in reach: the beat waits spent; a body stepping into reach is shoved on that very tick
    arena()
    e = hulk(0, 6)
    still(0, 0)
    pinFor(0, 0, 2)
    const before = log().length
    e.pos.set(0, 0, 2.6)
    const t0 = C.time
    pin(0, 0)
    const l = log()
    out.wait = { before, after: l.length, dt: l[0] ? l[0].t - t0 : null, why: l[0]?.why }
    return out
  }`)
  assertEq('a hulk at 2.6 u, one beat (tick 1): it takes the core\'s 8 and nothing else', [r.first.hit, r.first.dmgNominal, r.first.dmgReal, r.first.hand, r.first.eye], [8, 8, 8, 0, 0])
  assertEq('...no mark (a plain shove in open floor), one record, a beat, no slam', [r.first.marks, r.first.log.map((x) => [x.slam, x.why, x.link, x.dmg])], [0, [[null, 'beat', 0, 8]]])
  assert(r.moved.z >= 3.3 && Math.abs(r.moved.x) < 1e-9, `...it is 3.3 u or more from him 0.5 s later (z ${r.moved.z.toFixed(3)}, from 2.6 + 1.5 u of slide)`)
  assertEq('...still 8 taken, no mark, and shoves.plain 1 of n 1', [r.moved.hit, r.moved.marks, r.moved.sh.plain, r.moved.sh.n], [8, 0, 1, 1])
  assertEq('walking straight away from a hulk that keeps 2.6 u behind him for 2 s: no shove at what he is backing away from', r.away.shoves, 0)
  assert(r.away.z < -10, `...he did walk away (z ${r.away.z.toFixed(2)})`)
  assert(r.stand.shoves >= 3, `standing, the same hulk is shoved every beat (${r.stand.shoves} in 2 s, 0.62 s apart)`)
  assertEq('nothing in reach: no shove for 2 s; the hulk stepping into reach is shoved on that tick, by the beat', [r.wait.before, r.wait.after, r.wait.why], [0, 1, 'beat'])
  assert(r.wait.dt !== null && r.wait.dt <= 1 / 60 + 1e-6, `...the first tick it is there (${r.wait.dt})`)
})

check('K-M14', RUN, async ({ page }) => {
  // the slams: wall, body, Piston's knock, Kickstart's, and a Pressure Vent's knock, which is plain under Ram
  const r = await evalJson(page, `() => {
    const out = {}
    {
      // a hulk against a wall, Still on the far side: every beat is a wall slam, +1 a time, capped at 3
      (${SETUP})({ autos: true })
      ${RAM}
      W.__core('ram')
      // the second box stands beside him (1.3 u off), so the posture log (wallS: a wall within 2 u of Still) has something to read
      arena([wallBox(6.0), { minX: 1.3, maxX: 2.3, minZ: 1.8, maxZ: 3.0 }])
      const e = hulk(0, 5.0)
      let maxN = 0
      const t0 = C.time
      for (let i = 0; i < Math.round(12.5 * 60); i++) { pin(0, 2.4); maxN = Math.max(maxN, marks(e).n) }
      const l = log()
      out.wall = { beats: l.length, wall: l.filter((x) => x.slam === 'wall').length, maxN, n: marks(e).n, z: e.pos.z, sh: sh(), marksMade: last().marks.made, added: ev('mark').map((x) => x.added).reduce((a, b) => a + b, 0), wallS: last().wallS, closeS: last().closeS, fightS: last().fightS }
    }
    {
      // a hulk with another 1.0 u behind it on the line: a body slam, +1 each, and the second is not moved
      (${SETUP})({ autos: true })
      ${RAM}
      W.__core('ram')
      arena()
      const a = hulk(0, 2.6), b = hulk(0, 3.6)
      still(0, 0)
      pin(0, 0)
      const l = log()
      // the shove gives the second body no velocity; what then moves it is the game's own rule that awake bodies keep their two radii apart (combat.ts, after the packs):
      // the first slides into it and pushes it along, which is the world and not the shove (BUILD.md's "<= 0.05 u" did not know of it)
      const bKnock = b.knock.length()
      pinFor(0, 0, 0.5 - 1 / 60)
      out.body = { log: l.map((x) => [x.i, x.slam, x.other, x.why]), a: marks(a).n, b: marks(b).n, bKnock, bMoved: Math.abs(b.pos.z - 3.6), bx: b.pos.x, aHit: hpOf(a), bHit: hpOf(b), az: a.pos.z, idx: [idx(a), idx(b)] }
    }
    {
      // a body beside it is not a slam: the shove goes away from him, and a neighbour that stays beside the line is left alone
      (${SETUP})({ autos: true })
      ${RAM}
      W.__core('ram')
      arena()
      const a = hulk(0, 2.6), b = hulk(1.05, 2.6)
      still(0, 0)
      pin(0, 0)
      out.beside = { log: log().map((x) => [x.slam, x.other]), a: marks(a).n, b: marks(b).n }
    }
    {
      // Piston under Ram: the variant (cooldown 2600), and its 4.0 u knock from 2 u off a wall slams, after it has spent the marks the last slam left
      (${SETUP})({ parts: ['piston'], autos: false })
      ${RAM}
      W.__core('ram')
      const d = W.__hud.loadout[0]
      out.pistonDef = { name: d.name, cd: d.cooldownMs, damage: d.damage, shove: d.shove }
      arena([wallBox(5.0)])
      C.autoAttack = false
      const e = hulk(0, 2.5)
      still(0, 0)
      const rows = []
      for (let k = 0; k < 20; k++) {
        e.pos.set(0, 0, 2.5)
        e.knock.set(0, 0, 0)
        W.__hud.ready('arms', 'cold')
        W.__partLog.length = 0
        W.__shoveLog()
        const before = marks(e).n
        const hp = e.hp
        W.__fire('arms', false)
        for (let i = 0; i < 30; i++) pin(0, 0)
        rows.push({ before, slam: log().map((x) => [x.slam, x.why]), spends: spendsOf().map((x) => [x.n, x.bonus]), drop: hp - e.hp, after: marks(e).n })
      }
      out.piston = rows
      // under Wake, and with builds off: the base part (cooldown 3000), and no slam test
      for (const mode of ['wake', 'off']) {
        (${SETUP})({ parts: ['piston'] })
        W.__core(mode === 'wake' ? 'wake' : 'ram')
        if (mode === 'off') W.__builds(false)
        const d2 = W.__hud.loadout[0]
        out['piston' + mode] = { name: d2.name, cd: d2.cooldownMs }
        W.__builds(true)
      }
    }
    {
      // Kickstart through a hulk 1.2 u from a wall: the run-over knock puts it against the wall
      (${SETUP})({ parts: ['kickstart'] })
      ${RAM}
      W.__core('ram')
      arena([wallBox(4.2)])
      C.autoAttack = false
      const e = hulk(0, 3.0)
      // in its recovery (not a tell): a hulk Still runs up to is touching him, so it would be cocking its fist, and a body in its tell is never moved (K-M16)
      e.phase = 'recover'
      e.timer = 5000
      still(0, 0)
      W.__stick(0, 1)
      W.__partLog.length = 0
      W.__shoveLog()
      W.__fire('legs', false)
      for (let i = 0; i < 45; i++) { C.hp = 100; W.__step(1 / 60) }
      W.__stick(0, 0)
      out.kick = { log: log().map((x) => [x.slam, x.why]), marks: marks(e).n, hit: hpOf(e) }
    }
    {
      // a Pressure Vent's knock next to a wall is plain under Ram: pushed into the wall, no slam, no mark
      (${SETUP})({ parts: ['pressure-vent'] })
      ${RAM}
      W.__core('ram')
      arena([wallBox(2.9)])
      C.autoAttack = false
      const e = hulk(0, 2.0)
      still(0, 0)
      W.__partLog.length = 0
      W.__shoveLog()
      W.__fire('torso', false)
      for (let i = 0; i < 30; i++) pin(0, 0)
      out.vent = { shoves: log().length, marks: marks(e).n, hit: hpOf(e), z: e.pos.z }
    }
    return out
  }`)
  const w = r.wall
  assert(w.beats >= 19 && w.wall >= 16, `a hulk 1.0 u off a wall, Still on the far side: ${w.beats} beats in 12.5 s, ${w.wall} wall slams (at least 16 of 20)`)
  assertEq('...every slam adds 1, up to the cap of 3 (it never holds more), and it is still against the wall', [w.maxN, w.n, w.z > 5.3 && w.z < 5.5], [3, 3, true])
  assertEq('...the log adds up: wall + body + still + tell + plain is n, and the marks made are the added ones', [w.sh.wall + w.sh.body + w.sh.still + w.sh.tell + w.sh.plain === w.sh.n, w.marksMade === w.added], [true, true])
  assert(w.wallS > 10 && w.closeS >= w.wallS && w.fightS >= w.closeS - 0.1, `...the posture log reads it: wallS ${w.wallS} s and closeS ${w.closeS} s of ${w.fightS} fight seconds (a wall 1.3 u from Still)`)
  assertEq('a hulk with another 1.0 u behind it: one body slam, both marked once (a on the first)', [r.body.log, r.body.a, r.body.b], [[[r.body.idx[0], 'body', r.body.idx[1], 'beat']], 1, 1])
  assert(r.body.bKnock === 0 && r.body.bHit === 0 && r.body.aHit === 8 && Math.abs(r.body.bx) < 0.05, `...the second one is given no knock by the shove (${r.body.bKnock}) and takes no damage (${r.body.bHit}); the first takes the beat's 8 (${r.body.aHit})`)
  console.log(`INFO K-M14 the body slam: the second body ends ${r.body.bMoved.toFixed(2)} u on, pushed by the first (awake bodies keep their radii apart), not by the shove; the first ends at z ${r.body.az.toFixed(2)}`)
  assertEq('...so a body beside the line is not a slam, and the shove away from him is plain', [r.beside.log, r.beside.a, r.beside.b], [[[null, null]], 0, 0])
  assertEq('Piston under Ram: the variant, cooldown 2600 (the base part\'s 3000 under Wake and with builds off), name, damage and shove kept', [r.pistonDef.name, r.pistonDef.cd, r.pistonwake.cd, r.pistonoff.cd, r.pistonDef.shove, r.pistonwake.name], ['Piston', 2600, 3000, 3000, 4, 'Piston'])
  const slams = r.piston.filter((x) => x.slam.length === 1 && x.slam[0][0] === 'wall' && x.slam[0][1] === 'part').length
  assert(slams >= 16, `Piston from 2.5 u off a wall (a 4.0 u knock): ${slams} of 20 casts slam, at least 16`)
  assertEq('...each cast spends first: the 1 mark the last slam left, +12 (its own k) over the plain hit, then slams again', [r.piston.slice(1).every((x) => x.before >= 1 && x.spends.length === 1 && x.spends[0][0] === x.before && x.spends[0][1] === 12 * x.before), r.piston[0].spends], [true, []])
  assertEq('...and the knock leaves it marked again', r.piston.slice(0, 19).filter((x) => x.slam.length === 1).every((x) => x.after >= 1), true)
  assertEq('Kickstart through a hulk (in its recovery) 1.2 u from a wall: one wall slam, by the part, +1 mark', [r.kick.log, r.kick.marks], [[['wall', 'part']], 1])
  assertEq("a Pressure Vent's knock beside a wall is plain under Ram: no shove record, no mark", [r.vent.shoves, r.vent.marks], [0, 0])
})

check('K-M15', RUN, async ({ page }) => {
  // a boss can't be moved: every shove on it is a 'still' slam, and its marks are spent at the full +K
  const r = await evalJson(page, `() => {
    const out = {}
    {
      // K-M5 leaves the page a "real" run (dev false) at depth 3: put it back as a dev boot at depth 1 first
      window.__run.dev = true
      window.__enter(1, 1);
      (${SETUP})({ autos: true })
      ${RAM}
      W.__core('ram')
      arena()
      // seeded: the Assembler's attacks draw Math.random, and a blow that throws Still back is a beat the hand's retreat rule skips
      const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
      const original = Math.random
      Math.random = mulberry32(1)
      const b = W.__spawn('boss', 0, 3.2, true)
      b.speedMul = 0
      const p0 = { x: b.pos.x, z: b.pos.z }
      still(0, 0)
      // what the shove would move it by is a knock (a velocity that bleeds off): none is ever given. (Its own attacks can move it: after K-M5 left the page at depth 3 it came to move 17 u by itself in 9 s.)
      let maxN = 0, dist = 0, knock = 0
      for (let i = 0; i < Math.round(9 * 60); i++) { pin(0, 0); maxN = Math.max(maxN, marks(b).n); knock = Math.max(knock, b.knock.length()); dist = Math.max(dist, Math.hypot(b.pos.x - p0.x, b.pos.z - p0.z)) }
      Math.random = original
      const l = log()
      out.beats = { n: l.length, still: l.filter((x) => x.slam === 'still' && x.why === 'beat').length, knock, moved: dist, maxN, n3: marks(b).n, sh: sh(), kind: b.kind }
    }
    {
      // the marks spend at the full K: Flare (no k of its own: the core's 8) on a boss holding 3, and on one holding 0
      const pair = (n) => {
        (${SETUP})({ parts: ['flare'] })
        ${RAM}
        W.__core('ram')
        arena()
        C.autoAttack = false
        const b = W.__spawn('boss', 0, 4.5, true)
        b.speedMul = 0
        if (n) W.__setMarks(idx(b), n)
        const hp = b.hp
        W.__partLog.length = 0
        W.__fire('head', false)
        for (let i = 0; i < 90; i++) pin(0, 0)
        return { drop: hp - b.hp, spends: spendsOf(), left: marks(b).n }
      }
      out.s0 = pair(0)
      out.s3 = pair(3)
    }
    return out
  }`)
  assertEq(`the Assembler in reach, 9 s (10 beats or more): every shove a still slam, the boss is given no knock, marks 3 at the cap (${JSON.stringify(r.beats)})`, [r.beats.n >= 10, r.beats.still === r.beats.n, r.beats.knock === 0, r.beats.maxN, r.beats.n3], [true, true, true, 3, 3])
  assertEq('...logged as still slams (and nothing else)', [r.beats.sh.still, r.beats.sh.wall + r.beats.sh.body + r.beats.sh.tell + r.beats.sh.plain, r.beats.sh.beat.still], [r.beats.n, 0, r.beats.n])
  assertEq('the marks spend on it at the full +8 each: Flare on a boss with 3 does 24 more than with none, and leaves n 0', [r.s3.drop - r.s0.drop, r.s3.spends.map((x) => [x.n, x.bonus]), r.s3.left], [24, [[3, 24]], 0])
})

check('K-M16', RUN, async ({ page }) => {
  // a body in its tell is never moved and its tell is never touched; the blow lands as it would; a wall behind it slams it where it stands
  const r = await evalJson(page, `() => {
    const out = {}
    const run = (core, o) => {
      (${SETUP})({ autos: true })
      ${RAM}
      C.eye = false
      W.__core(core)
      arena(o.wall ? [wallBox(o.wall)] : [])
      C.pressure = !o.crown
      const e = hulk(0, o.z, { crown: o.crown })
      C.autoAttack = core === 'ram'
      still(0, 0)
      const rows = []
      const lost = []
      let hpNow = 100
      C.hp = 100
      let intr = 0
      for (let i = 0; i < 50; i++) {
        W.__still.pos.set(0, 0, 0)
        const was = C.hp
        W.__step(1 / 60)
        if (C.hp < was) lost.push([i, +(was - C.hp).toFixed(3)])
        C.hp = 100
        if (i < 14 || i % 10 === 0) rows.push({ i, z: e.pos.z, tell: e.tellIn ? e.tellIn() : null, phase: e.phase, hp: e.hp })
      }
      return { rows, lost, marks: marks(e).n, log: log().map((x) => [x.slam, x.why]), interrupts: ev('interrupt').length, hit: hpOf(e) }
    }
    out.hulkRam = run('ram', { z: 2.0 })
    out.hulkBare = run(null, { z: 2.0 })
    out.crownRam = run('ram', { z: 1.8, crown: true })
    out.crownBare = run(null, { z: 1.8, crown: true })
    out.hulkWall = run('ram', { z: 2.0, wall: 3.0 })
    out.crownWall = run('ram', { z: 1.8, crown: true, wall: 2.8 })
    return out
  }`)
  const h = r.hulkRam
  assertEq('a pressure hulk in its cock at 2.0 u: one beat shoves it and it is not moved (tick 1)', [h.log[0], Math.abs(h.rows[0].z - 2.0) < 0.05], [[null, 'beat'], true])
  assert(h.rows[0].tell !== null && h.rows[1].tell !== null && h.rows[1].tell < h.rows[0].tell, `...its tell is on, and still counts down (${h.rows[0].tell} then ${h.rows[1].tell} ms)`)
  assert(h.rows.slice(0, 11).every((q) => Math.abs(q.z - 2.0) < 0.05), `...it stays where it stood through its cock and its blow (z ${h.rows.slice(0, 11).map((q) => q.z.toFixed(2)).join(' ')})`)
  assertEq('...its blow lands on the same tick as in the no-core control, for the same HP', [h.lost.length > 0, h.lost[0]], [true, r.hulkBare.lost[0]])
  assertEq('...and the first 0.83 s of blows is the same, tick for tick', h.lost, r.hulkBare.lost)
  assertEq('...a beat on a tell that hits nothing: no mark, no interrupt', [h.marks, h.interrupts], [0, 0])
  const c = r.crownRam
  assert(c.rows.some((q) => q.phase === 'windup'), `a crowned hulk (not pressure) winds up in reach (${[...new Set(c.rows.map((q) => q.phase))]})`)
  assertEq('...not interrupted (no interrupt event), not moved while it winds up, and the blow lands as in the control', [c.interrupts, c.rows.filter((q) => q.phase === 'windup').every((q) => Math.abs(q.z - 1.8) < 0.05), c.lost.slice(0, 1)], [0, true, r.crownBare.lost.slice(0, 1)])
  for (const [what, x, z] of [['a pressure hulk in its cock', r.hulkWall, 2.0], ['a crowned windup', r.crownWall, 1.8]]) {
    assertEq(`${what} with a wall behind it: slammed where it stands ('tell'), not moved, +1 mark`, [x.log[0], Math.abs(x.rows[0].z - z) < 0.05, x.marks >= 1], [['tell', 'beat'], true, true])
  }
})

check('K-M17', RUN, async ({ page }) => {
  // the free-defence line: three pressure hulks (hp 1e6) at 2.5 u round a standing Still, seeds 1-5, 20 s each, HP put back each tick. Ram's HP lost against a core that never touches them
  // (Wake, standing: it does nothing) must be >= 0.75x; printed against today's hand and eye too
  const r = await evalJson(page, `() => {
    ${RAM}
    const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const fight = (core, seed) => {
      (${SETUP})({ autos: true })
      W.__core(core)
      W.__arena({ auto: true })
      const original = Math.random
      Math.random = mulberry32(seed)
      try {
        delete C.hurtPlayer
        C.time = 0; C.pressure = true; C.counters = false; C.breakRule = false; C.autoAttack = true
        // each fight starts from the same state: the beat ready, nothing settled (the page's earlier fights leave both)
        C.autoTimer = 0; C.stillT = 0
        W.__stick(0, 0); W.__fx(); W.__shoveLog()
        const a0 = Math.random() * Math.PI * 2
        // hulks that a strike does not end (hp 1e6, the arena's wall helper), so what is measured is the shove's defence and not Ram killing them (a Wake that stands kills nothing); they walk
        for (let k = 0; k < 3; k++) W.__spawn('chaser', Math.sin(a0 + (k * 2 * Math.PI) / 3) * 2.5, Math.cos(a0 + (k * 2 * Math.PI) / 3) * 2.5, true).hp = 1e6
        let lost = 0
        for (let i = 0; i < 20 * 60; i++) {
          C.hp = 100
          W.__still.pos.set(0, 0, 0)
          W.__step(1 / 60)
          lost += 100 - C.hp
        }
        return { lost, shoves: log().length }
      } finally { Math.random = original }
    }
    const out = { ram: [], wake: [], bare: [] }
    for (const seed of [1, 2, 3, 4, 5]) {
      out.ram.push(fight('ram', seed))
      out.wake.push(fight('wake', seed))
      out.bare.push(fight(null, seed))
    }
    return out
  }`)
  const sum = (a) => a.reduce((x, y) => x + y.lost, 0)
  const ram = sum(r.ram), wake = sum(r.wake), bare = sum(r.bare)
  const per = (a) => a.map((x) => x.lost.toFixed(0)).join(' ')
  console.log(`INFO K-M17 HP lost, 3 pressure hulks at 2.5 u round a standing Still, 20 s, seeds 1-5: Ram ${per(r.ram)} (mean ${(ram / 5).toFixed(1)}); Wake standing ${per(r.wake)} (mean ${(wake / 5).toFixed(1)}); today's hand and eye ${per(r.bare)} (mean ${(bare / 5).toFixed(1)}); Ram shoves ${r.ram.map((x) => x.shoves).join(' ')}`)
  console.log(`INFO K-M17 ratio Ram / Wake-standing = ${(ram / wake).toFixed(3)} (pass line 0.75); Ram / today's hand and eye = ${(ram / bare).toFixed(3)}; per seed ${r.ram.map((x, i) => (x.lost / r.wake[i].lost).toFixed(2)).join(' ')}`)
  assert(r.wake.every((x) => x.lost > 0) && r.ram.every((x) => x.shoves > 10), `the control took damage in every seed and Ram shoved in every one (Wake ${per(r.wake)}; Ram shoves ${r.ram.map((x) => x.shoves)})`)
  assert(ram / wake >= 0.75, `Ram's HP lost is ${(ram / wake).toFixed(3)} x a core that never touches them, under the 0.75 line: the shove is free defence (dials: RAM.shove 1.5 -> 1.2, then a body within its own strike reach is not moved)`)
})

check('K-M18', RUN, async ({ page }) => {
  // Ram's keystones and upgrades
  const r = await evalJson(page, `() => {
    ${RAM}
    const out = {}
    const boot = (parts, keystone, upgrade, boxes) => {
      (${SETUP})({ autos: true, parts })
      W.__core('ram')
      if (keystone) W.__keystone(keystone)
      if (upgrade) W.__upgrade(upgrade)
      arena(boxes ?? [])
    }
    const hits = (es) => es.map((e) => hpOf(e))
    // Domino: A is shoved into B, and B is 0.8 u from a wall (its centre; 0.25 u of slide before it stops): both body-slammed, B shoved 1.0 on into the wall and slammed again
    for (const key of ['ram-domino', null]) {
      boot(null, key, null, [wallBox(4.4)])
      const a = hulk(0, 2.6), b = hulk(0, 3.6)
      still(0, 0)
      pin(0, 0)
      const l = log()
      out[key ? 'domino' : 'plain'] = { log: l.map((x) => [x.slam, x.why, x.link, x.dmg]), idx: [idx(a), idx(b)], other: l.map((x) => x.other), marks: [marks(a).n, marks(b).n], hit: hits([a, b]) }
    }
    // the chain never passes 2 links: five in a line, 1.0 u apart, nothing behind them
    boot(null, 'ram-domino', null)
    {
      const es = [2.6, 3.6, 4.6, 5.6, 6.6].map((z) => hulk(0, z))
      still(0, 0)
      pin(0, 0)
      const l = log()
      out.chain = { log: l.map((x) => [x.slam, x.why, x.link]), marks: es.map((e) => marks(e).n), hit: hits(es), sh: sh() }
    }
    // Catch: (a) a crowned hulk (movable) starting a windup in reach is not caught; (b) a body that can't be moved (knockMul 0.05) is, once a second; the next beat is 0.62 s on
    const tellOf = (e) => { e.phase = 'windup'; e.timer = 520 }
    const calm = (e) => { e.phase = 'approach'; e.timer = 0 }
    boot(null, 'ram-catch', null)
    {
      const e = hulk(0, 6.0, { crown: true })
      still(0, 0)
      pinFor(0, 0, 0.2)
      e.pos.set(0, 0, 2.4)
      pin(0, 0)
      const had = log().length
      // the beat shoves it (a beat, not a catch) the tick it is in reach: that is the baseline; now a fresh windup while the beat is cooling
      calm(e)
      pin(0, 0)
      const t0 = C.time
      tellOf(e)
      pin(0, 0)
      out.crowned = { caught: sh().caught, why: log().map((x) => x.why), had }
    }
    boot(null, 'ram-catch', null)
    {
      const e = hulk(0, 2.6)
      e.knockMul = 0.05
      still(0, 0)
      pin(0, 0)
      // the beat took the first tick; the ones below are catches
      log()
      const rows = []
      calm(e)
      pinFor(0, 0, 0.1)
      log()
      const mark = (what) => rows.push([what, +(C.time).toFixed(3)])
      let t = C.time
      W.__setMarks(idx(e), 2)
      const hp = e.hp
      tellOf(e); pin(0, 0)
      const l1 = log()
      out.catch1 = { log: l1.map((x) => [x.slam, x.why]), t: l1[0]?.t - t, marks: marks(e).n, spends: spendsOf(), drop: hp - e.hp, lastSpend: ev('spend').at(-1) ? { n: ev('spend').at(-1).n, bonus: ev('spend').at(-1).bonus, payer: ev('spend').at(-1).payer } : null }
      const tc = l1[0]?.t ?? 0
      // the beat starts over 0.62 s after the catch (and not before)
      calm(e)
      let nextBeat = null
      for (let i = 0; i < 70 && nextBeat === null; i++) { pin(0, 0); const l = log(); if (l.length) nextBeat = { t: l[0].t - tc, why: l[0].why } }
      out.afterCatch = nextBeat
      // a second windup 0.5 s after the first: one catch only; a third 1.1 s after the first: a catch
      W.__partLog.length = 0
      log()
      const base = C.time
      const caught = []
      for (let k = 0; k < 90; k++) {
        const el = C.time - tc
        if (Math.abs(el - 0.5) < 0.009) tellOf(e)
        else if (Math.abs(el - 0.52) < 0.009) calm(e)
        else if (Math.abs(el - 1.1) < 0.009) tellOf(e)
        else if (Math.abs(el - 1.12) < 0.009) calm(e)
        pin(0, 0)
        for (const x of log()) if (x.why === 'catch') caught.push(+(x.t - tc).toFixed(3))
      }
      out.icd = caught
    }
    // a boss's windup: a real Assembler winding up in reach gets one still slam, off the beat, and its marks are spent
    boot(null, 'ram-catch', null)
    {
      // seeded: the Assembler's attacks draw Math.random
      const m32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
      const original = Math.random
      Math.random = m32(1)
      const b = W.__spawn('boss', 0, 3.2, true)
      b.speedMul = 0
      still(0, 0)
      const rows = []
      for (let i = 0; i < 12 * 60; i++) {
        pin(0, 0)
        for (const x of log()) rows.push({ why: x.why, slam: x.slam, t: x.t })
      }
      Math.random = original
      const caughts = rows.filter((x) => x.why === 'catch')
      const sp = ev('spend').filter((x) => x.payer === 'core')
      out.boss = { caught: caughts.length, slams: caughts.map((x) => x.slam), spends: sp.map((x) => [x.n, x.bonus]), tellsSeen: ev('windup').length, caughtSh: sh().caught, beats: rows.filter((x) => x.why === 'beat').length }
    }
    // Wide: two hulks in reach are both shoved each beat; one without it
    for (const up of ['ram-wide', null]) {
      boot(null, null, up)
      const a = hulk(-1.2, 2.8), b = hulk(1.2, 2.8)
      still(0, 0)
      pin(0, 0)
      const l = log()
      pinFor(0, 0, 0.4)
      out[up ? 'wide' : 'single'] = { n: l.length, who: l.map((x) => x.i).sort(), hit: hits([a, b]), away: [Math.hypot(a.pos.x + 1.2, a.pos.z - 2.8), Math.hypot(b.pos.x - 1.2, b.pos.z - 2.8)] }
    }
    // Rubble: a wall slam marks and hits (4) a hulk 1.0 u from the impact; one 1.5 u away is untouched
    for (const up of ['ram-rubble', null]) {
      boot(null, null, up, [wallBox(4.4)])
      const a = hulk(0, 3.7), n1 = hulk(1.0, 3.7), n2 = hulk(-1.5, 3.7)
      still(0, 1.0)
      pin(0, 1.0)
      out[up ? 'rubble' : 'noRubble'] = { log: log().map((x) => [x.slam, x.why, x.dmg]), a: [marks(a).n, hpOf(a)], n1: [marks(n1).n, hpOf(n1)], n2: [marks(n2).n, hpOf(n2)], events: ev('shove').map((x) => x.rubble ?? 0) }
    }
    return out
  }`)
  const d = r.domino
  assertEq('Domino: A shoved into B, B 0.8 u from a wall: A\'s beat body-slams B, B is shoved 1.0 into the wall and wall-slammed (a link), as two records', [d.log.map((x) => [x[0], x[1], x[2]]), d.other[0] === d.idx[1]], [[['body', 'beat', 0], ['wall', 'chain', 1]], true])
  assertEq('...A holds 1, B holds 2 (the body slam, the wall slam)', d.marks, [1, 2])
  assertEq('...A takes the beat\'s 8; B takes the chain\'s 8 (what a chain slams takes the core\'s hit) and nothing else', d.hit, [8, 8])
  assertEq('without Domino: the body slam is the one record, A holds 1, B holds 1, B is not hit', [r.plain.log.map((x) => [x[0], x[1]]), r.plain.marks, r.plain.hit], [[['body', 'beat']], [1, 1], [8, 0]])
  const c = r.chain
  assertEq('five in a line, 1.0 u apart: the beat and at most 2 links (3 records), the fourth is slammed by the second link and the fifth is not touched', [c.log.length, Math.max(...c.log.map((x) => x[2])), c.log.map((x) => x[1]), c.marks[4], c.hit[4]], [3, 2, ['beat', 'chain', 'chain'], 0, 0])
  assertEq('...marks 1 2 2 1 0 (each slam gives each of its two bodies one), chained 2', [c.marks, c.sh.chained], [[1, 2, 2, 1, 0], 2])
  assertEq('...damage: A 8 (the beat), B 8 and C 16 (link 1 hits B and C, link 2 hits C and D), D 8', c.hit.slice(0, 4), [8, 8, 16, 8])
  assertEq('Catch on a crowned hulk (movable) starting a windup in reach: nothing is caught', [r.crowned.caught, r.crowned.why.includes('catch')], [0, false])
  const k = r.catch1
  assertEq('Catch on a body that can\'t be moved starting a tell: a catch, off the beat, a still slam, on that tick', [k.log, k.t <= 1 / 60 + 1e-6], [[['still', 'catch']], true])
  assertEq('...its marks (2 set, +1 for the slam) are spent by the core at 8 each, whole, and gone', [k.marks, k.spends, k.lastSpend], [0, [{ n: 3, bonus: 24, payer: 'core', killed: false }], { n: 3, bonus: 24, payer: 'core' }])
  assertEq('...the catch\'s own shove hits for 8 and the spend adds the whole 24 (32 in all)', k.drop, 32)
  assert(r.afterCatch && r.afterCatch.why === 'beat' && Math.abs(r.afterCatch.t - 0.62) <= 1 / 60 + 1e-6, `the next beat is 0.62 s after the catch (${r.afterCatch && r.afterCatch.t.toFixed(3)} s, ${r.afterCatch && r.afterCatch.why})`)
  assertEq('two windups 0.5 s apart give one catch; a third 1.1 s after the first is a catch again', r.icd.map((t) => Math.round(t * 10)), [11])
  assert(r.boss.caught >= 1 && r.boss.slams.every((s) => s === 'still') && r.boss.caught === r.boss.caughtSh, `the Assembler winding up in reach: ${r.boss.caught} catches in 12 s (a boss windup gives a still slam), logged caught ${r.boss.caughtSh}`)
  assert(r.boss.spends.length >= r.boss.caught && r.boss.spends.every((s) => s[1] === s[0] * 8 && s[0] >= 1), `...and each spends the marks at 8 each (${JSON.stringify(r.boss.spends)})`)
  assertEq('Wide: two hulks in reach are both shoved by the one beat, and both slide; without it one is', [r.wide.n, r.wide.hit, r.wide.away.every((x) => x > 1), r.single.n, r.single.hit.filter((x) => x > 0).length], [2, [8, 8], true, 1, 1])
  assertEq('Rubble: a wall slam hits (4) and marks a hulk 1.0 u from the impact; the one 1.5 u away is untouched', [r.rubble.log, r.rubble.n1, r.rubble.n2, r.rubble.events], [[['wall', 'beat', 12]], [1, 4], [0, 0], [1]])
  assertEq('...the slammed one has its own mark and the 8; without Rubble neither neighbour is touched', [r.rubble.a, r.noRubble.n1, r.noRubble.n2, r.noRubble.events], [[1, 8], [0, 0], [0, 0], [0]])
})

check('K-M19', RUN, async ({ page }) => {
  // throwEnd is Clamp Toss's wall test: 30 random setups, seeded here, against the inline code it replaced
  const r = await evalJson(page, `() => {
    ${RAM}
    const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
    const rnd = mulberry32(19)
    W.__core('ram')
    const boxes = [{ minX: -6, maxX: -3, minZ: 2, maxZ: 5 }, { minX: 2, maxX: 9, minZ: -4, maxZ: -3 }, { minX: -2, maxX: 1, minZ: 7, maxZ: 8 }]
    arena(boxes)
    const e = hulk(0, 0)
    const rows = []
    let shorts = 0
    for (let k = 0; k < 30; k++) {
      e.pos.set((rnd() - 0.5) * 20, 0, (rnd() - 0.5) * 20)
      const a = rnd() * Math.PI * 2
      const dx = Math.sin(a), dz = Math.cos(a)
      const dist = rnd() * 4
      const got = C.throwEnd(e, dx, dz, dist)
      const end = C.terrain.clampMove(e.pos.x, e.pos.z, e.pos.x + dx * dist, e.pos.z + dz * dist, e.radius)
      const short = Math.hypot(end.x - e.pos.x, end.z - e.pos.z) < dist - 0.05
      if (short) shorts++
      rows.push({ k, same: got.end.x === end.x && got.end.z === end.z && got.short === short, got: [got.end.x, got.end.z, got.short], want: [end.x, end.z, short] })
    }
    return { rows, shorts, moved: e.pos.x }
  }`)
  assertEq('30 random setups: throwEnd\'s end and short equal the grab branch\'s old inline result', r.rows.filter((x) => !x.same), [])
  assert(r.shorts >= 5 && r.shorts <= 25, `...and the setups reach both sides of the wall test (${r.shorts} of 30 came up short)`)
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B4: the pick, the save, resume. K-M20 to K-M22 (K-M23, the bots, is below; Ram's half has been here since B3).
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** In the page: what the pick screen shows and what the run says about it. */
const PICK_STATE = `() => {
  const W = window
  const pause = document.querySelector('#pause')
  const st = W.__run.stats.at(-1)
  const snap = W.__snapshot()
  return {
    open: pause.classList.contains('show'),
    cards: [...pause.querySelectorAll('.core')].map((b) => b.dataset.core),
    names: [...pause.querySelectorAll('.core .pname')].map((b) => b.textContent),
    soon: [...pause.querySelectorAll('.core')].map((b) => b.disabled),
    spendLines: [...pause.querySelectorAll('.core .spends')].map((b) => b.textContent),
    buttons: pause.querySelectorAll('.actions button').length,
    core: W.__combat.core, runCore: W.__run.core, keystone: W.__run.keystone, upgrades: [...W.__run.upgrades], combatKeystone: W.__combat.keystone, combatUpgrades: [...W.__combat.upgrades],
    corePick: W.__run.corePick, time: W.__combat.time, pos: [W.__still.pos.x, W.__still.pos.z], depth: W.__run.depth, dev: W.__run.dev, phase: W.__run.phase,
    stat: st && { depth: st.depth, core: st.core, temperFlat: st.temperFlat, keystone: st.keystone, upgrades: st.upgrades },
    snap: snap && { depth: snap.depth, core: snap.core ?? null, keystone: snap.keystone ?? null, upgrades: snap.upgrades ?? null, hasCoreKey: 'core' in snap, ranks: snap.ranks ?? null },
    body: W.__playtestBody().corePick,
    ranks: { ...W.__run.ranks },
    arms: (W.__hud.loadout.find((d) => d.slot === 'arms') ?? {}).damage ?? null,
    mastery: W.__combat.mastery.size,
  }
}`

const hooksUp = (page) => page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })

// a real run, not a dev one: no ?depth=. A save in memory is past its first run only by the run it has just started: the first boot begins the run (FIRST_RUN_IN_MAZE), the door is `__run.phase = 'leaving'`
check('K-M20', '?save=memory&roads=0&line=0&engine=0&pick=core', async ({ page }) => {
  const read = () => evalJson(page, PICK_STATE)
  // the boot began a run, depth 1 is entered, and the pick is up: a card for every core (Wake, Ram, Thorns, Tether; N1 left Tether's disabled and "soon", N2 took that off, N3 put Thorns where Graze was), and no back button
  const a = await read()
  assertEq('a real run (not dev) at depth 1, no core yet', [a.dev, a.depth, a.runCore, a.core, a.phase], [false, 1, null, null, 'crawl'])
  assertEq('the pick is open with four cards: Wake, Ram, Thorns, Tether', [a.open, a.cards, a.names], [true, ['wake', 'ram', 'thorns', 'tether'], ['Wake', 'Ram', 'Thorns', 'Tether']])
  assertEq("...all four are live (none disabled, none says 'soon'): every card has the spend line", [a.soon, a.spendLines], [[false, false, false, false], ['Blue buttons spend them.', 'Blue buttons spend them.', 'Blue buttons spend them.', 'Blue buttons spend them.']])
  assertEq('...and no button but the cards: no back, no resume, no leave', [a.buttons, await page.locator('#pause button').count()], [0, 4])
  // the world waits: with the stick pushed, one real second of frames moves neither the game clock nor Still
  await evalJson(page, () => { window.__stick(1, 0) })
  await page.waitForTimeout(1000)
  const b = await read()
  await evalJson(page, () => { window.__stick(0, 0) })
  assertEq('over 1 s of real frames with the stick out: __combat.time and Still do not move', [b.time, b.pos], [a.time, a.pos])
  // a real click on Ram
  await page.locator('#pause .core[data-core="ram"]').click()
  const c = await read()
  assertEq('one real click on Ram: combat.core, the snapshot, and corePick.took say ram', [c.core, c.runCore, c.snap.core, c.corePick.took], ['ram', 'ram', 'ram', 'ram'])
  assertEq('...corePick names what was offered and how it came', [c.corePick.offered, c.corePick.at, typeof c.corePick.s, c.corePick.s >= 0], [['wake', 'ram', 'thorns', 'tether'], 'start', 'number', true])
  assertEq('...the playtest body carries it', c.body, c.corePick)
  assertEq('...the pick is closed, the open depth logs the core and the flat temper', [c.open, c.stat.depth, c.stat.core, c.stat.temperFlat], [false, 1, 'ram', true])
  assertEq('...the snapshot keeps no keystone and no upgrades (none taken)', [c.snap.keystone, c.snap.upgrades], [null, null])
  // through the door: the next run begins the same way, from a clean run (the core is not carried over), and the pick shows again
  await evalJson(page, () => { window.__run.phase = 'leaving'; window.__run.t = 0 })
  await page.waitForFunction(() => document.querySelector('#pause').classList.contains('show') && document.querySelectorAll('#pause .core').length === 4, null, { timeout: 15000 })
  const d = await read()
  assertEq('through the door into startRun: the pick shows again, no core worn, a fresh corePick', [d.open, d.cards, d.runCore, d.core, d.corePick, d.depth], [true, ['wake', 'ram', 'thorns', 'tether'], null, null, null, 1])
  await page.locator('#pause .core[data-core="wake"]').click()
  const e = await read()
  assertEq('...and Wake taken the second time', [e.core, e.snap.core, e.corePick.took, e.stat.core, e.open], ['wake', 'wake', 'wake', 'wake', false])
  // the third run: Tether's card, a real click (N2)
  await evalJson(page, () => { window.__run.phase = 'leaving'; window.__run.t = 0 })
  await page.waitForFunction(() => document.querySelector('#pause').classList.contains('show') && document.querySelectorAll('#pause .core').length === 4, null, { timeout: 15000 })
  await page.locator('#pause .core[data-core="tether"]').click()
  const tt = await read()
  assertEq("...and Tether's card taken the third time: the core, the snapshot, the log say tether", [tt.core, tt.snap.core, tt.corePick.took, tt.stat.core, tt.open], ['tether', 'tether', 'tether', 'tether', false])
  // builds off: no pick, and no core key in the snapshot
  await page.evaluate(() => localStorage.setItem('still-action.builds', '0'))
  await page.reload()
  await hooksUp(page)
  await page.waitForTimeout(400)
  const f = await read()
  assertEq('builds off: a run begins with no pick, bare', [f.open, f.cards, f.core, f.runCore, f.depth, f.dev], [false, [], null, null, 1, false])
  assertEq('...and the snapshot has no core key at all, nor a keystone or upgrades', [f.snap.hasCoreKey, f.snap.keystone, f.snap.upgrades, f.stat.core, f.stat.temperFlat], [false, null, null, null, false])
})

/** The snapshot K-M21 builds its cases from: this page's own depth-1 snapshot, with the depth, loadout and ranks a mid-run one has. */
const SNAP = `(o) => {
  const W = window
  const base = W.__snapshot()
  const snap = { ...base, depth: o.depth, seed: o.seed ?? 7, bossFelled: false, bossLoot: [], loadout: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'], route: o.depth >= 4 ? 'II' : null }
  delete snap.core; delete snap.keystone; delete snap.upgrades; delete snap.ranks; delete snap.picks; delete snap.crossroads
  if (o.ranks) snap.ranks = o.ranks
  for (const k of ['core', 'keystone', 'upgrades']) if (o[k] !== undefined) snap[k] = o[k]
  W.__setSave({ run: snap })
  return true
}`

// real localStorage (no save=memory, no ?depth=): the boot's first run writes a depth-1 snapshot, and each case replaces it and reloads, so the real resumeRun reads it
check('K-M21', '?roads=1&line=0&engine=0&resume=1&pick=core', async ({ page }) => {
  const read = () => evalJson(page, PICK_STATE)
  const resumeWith = async (o, builds) => {
    await evalJson(page, SNAP, o)
    if (builds !== undefined) await page.evaluate((b) => localStorage.setItem('still-action.builds', b), builds)
    await page.reload()
    await hooksUp(page)
    await page.waitForTimeout(300)
    return read()
  }
  await evalJson(page, () => { window.__setSave({ runs: 3 }) })
  const full = (core, keystone, upgrades) => ({ core, keystone, upgrades })
  // d2 and d5 carrying a core, a keystone, upgrades and Cleaver at III: they come back with all four, the Cleaver flat (23)
  for (const [depth, core, keystone, upgrades] of [[2, 'wake', 'wake-deep', ['wake-slip']], [5, 'ram', 'ram-domino', ['ram-wide', 'ram-rubble']]]) {
    const r = await resumeWith({ depth, core, keystone, upgrades, ranks: { arms: 3 } })
    assertEq(`d${depth}: resumes at the depth with no pick`, [r.depth, r.open, r.cards], [depth, false, []])
    assertEq(`d${depth}: the core, keystone, upgrades and the ranks come back, in the run and in combat`, [r.runCore, r.core, r.keystone, r.combatKeystone, r.upgrades, r.combatUpgrades, r.ranks], [core, core, keystone, keystone, upgrades, upgrades, { arms: 3 }])
    assertEq(`d${depth}: Scrap Cleaver at III is the flat one, 23`, r.arms, 23)
    assertEq(`d${depth}: the depth logs the core, the flat temper, the keystone and the upgrades`, r.stat, { depth, core, temperFlat: true, keystone, upgrades })
    assertEq(`d${depth}: the snapshot it wrote on resuming still carries them`, [r.snap.core, r.snap.keystone, r.snap.upgrades], [core, keystone, upgrades])
    assertEq(`d${depth}: no mastery with a core`, r.mastery, 0)
  }
  // each of these resumes bare, with no pick, the depth logging core null: an unknown core, no core at d2, an old snapshot
  for (const [what, o] of [["core 'graze' (N3 took it out for Thorns: a save made with it is bare)", { depth: 2, core: 'graze', keystone: 'graze-feint', upgrades: ['graze-riposte'], ranks: { arms: 3 } }], ["core 'sight' (a core this build does not know)", { depth: 2, core: 'sight', keystone: 'wake-deep', upgrades: ['wake-slip'], ranks: { arms: 3 } }], ['no core at depth 2 (a run begun before the layer)', { depth: 2, ranks: { arms: 3 } }]]) {
    const r = await resumeWith(o)
    assertEq(`${what}: no pick, bare, depth 2`, [r.open, r.cards, r.depth, r.runCore, r.core, r.keystone, r.upgrades], [false, [], 2, null, null, null, []])
    assertEq(`${what}: the depth logs core null and the table of today (Cleaver III is 29), and the snapshot has no core key`, [r.stat.core, r.stat.temperFlat, r.arms, r.snap.hasCoreKey], [null, false, 29, false])
  }
  // a keystone and an upgrade of the other core: dropped, the core kept
  const x = await resumeWith({ depth: 2, core: 'wake', keystone: 'ram-domino', upgrades: ['ram-wide', 'wake-slip'], ranks: { arms: 3 } })
  assertEq('a keystone of the other core is dropped, the core kept, and the upgrade of the other core with it', [x.open, x.runCore, x.keystone, x.upgrades, x.snap.keystone, x.snap.upgrades], [false, 'wake', null, ['wake-slip'], null, ['wake-slip']])
  // no core at depth 1 with builds on: the pick shows (he reloaded on it, or the run began with the switch off); the world waits; the pick is logged as a resume
  const p = await resumeWith({ depth: 1 })
  assertEq('depth 1, no core, builds on: the pick shows, four cards, nothing worn', [p.open, p.cards, p.runCore, p.core, p.depth], [true, ['wake', 'ram', 'thorns', 'tether'], null, null, 1])
  await page.waitForTimeout(700)
  const p2 = await read()
  assertEq('...and the world waits behind it', [p2.time, p2.pos], [p.time, p.pos])
  await page.locator('#pause .core[data-core="ram"]').click()
  const q = await read()
  assertEq('...taking Ram on a resume logs it as one', [q.core, q.corePick && q.corePick.at, q.corePick && q.corePick.took, q.snap.core, q.stat.core, q.stat.temperFlat, q.open], ['ram', 'resume', 'ram', 'ram', 'ram', true, false])
  // depth 1, no core, builds OFF: no pick (the run is bare, and stays so until the next run)
  const o = await resumeWith({ depth: 1 }, '0')
  assertEq('depth 1, no core, builds off: no pick, bare', [o.open, o.cards, o.core, o.runCore], [false, [], null, null])
  await page.evaluate(() => localStorage.removeItem('still-action.builds'))
})

// K-M22. A part melted past III: with a core there is no mastery (no hand and no eye to teach), and before depth 7 (UPGRADE_FROM) nothing happens at all; builds off it is the mastery card as today. The second part (B5): from depth 7 it is the core's upgrade card instead
check('K-M22', RUN, async ({ page }) => {
  const leans = JSON.parse((await import('node:fs')).readFileSync(HERE + 'baseline/leans.json', 'utf8'))
  const FORM = { close: 'close strike', marksman: 'planted shot' }
  const r = await evalJson(page, `() => {
    ${HELPERS}
    const setup = (builds) => {
      (${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'piston', 'kickstart'] })
      W.__run.mastery = new Set()
      W.__core('ram')
      W.__builds(builds)
      W.__equipRank('piston', 3)
      W.__run.ranks.arms = 3
      W.__dropAt('piston', 0, 0)
      secs(1.5)
      const melt = document.querySelector('#offer .melt')
      return { shown: document.querySelector('#offer').classList.contains('show'), meltHidden: melt.style.display === 'none', meltText: melt.textContent, ground: W.__loot.ground.length }
    }
    const out = {}
    // the pickup card's buttons act on pointerdown (a mid-fight tap lands the first time): a forced press works on the hidden melt button too
    const press = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    // a core worn, builds on: no melt label, and a melt forced anyway opens no card
    out.on = setup(true)
    press(document.querySelector('#offer .melt'))
    out.on.after = { masterCards: document.querySelectorAll('#pause .master').length, pauseOpen: document.querySelector('#pause').classList.contains('show'), combatMastery: C.mastery.size, runMastery: W.__run.mastery.size, rank: W.__run.ranks.arms, ground: W.__loot.ground.length }
    // builds off, the core still on the run: the mastery card as today
    out.off = setup(false)
    press(document.querySelector('#offer .melt'))
    out.off.cards = document.querySelectorAll('#pause .master').length
    out.off.title = document.querySelector('#pause h2')?.textContent ?? null
    document.querySelector('#pause .master').click()
    out.off.after = { runMastery: W.__run.mastery.size, combatMastery: C.mastery.size, ground: W.__loot.ground.length, rank: W.__run.ranks.arms }
    W.__builds(true)
    out.off.backOn = C.mastery.size
    return out
  }`)
  assertEq('a core worn, builds on, a floor Piston under a Piston at III: the card shows, with no melt line', [r.on.shown, r.on.meltHidden], [true, true])
  assertEq('...a melt forced anyway opens no mastery card, learns none, and leaves the floor part and the rank as they were', r.on.after, { masterCards: 0, pauseOpen: false, combatMastery: 0, runMastery: 0, rank: 3, ground: 1 })
  assertEq('builds off, the same floor: the melt line is the mastery one, its form from MASTERY_FORM (leans.json)', [r.off.shown, r.off.meltHidden, r.off.meltText], [true, false, `melt: master the ${FORM[leans.piston]}`])
  assertEq('...and the card opens with two masteries; taking one learns it (the floor part is spent)', [r.off.cards, r.off.after.runMastery, r.off.after.combatMastery, r.off.after.ground], [2, 1, 1, 0])
  assertEq('...and with the switch back on the core wears no mastery again', r.off.backOn, 0)
})

check('K-M22', RUN, async ({ page }) => {
  // B5: from depth 7 (3-balancer.md UPGRADE_FROM) a melt past III offers the core's upgrades, mastery's twin: 2 cards the first time, 1 the second, none the third
  const r = await evalJson(page, `async () => {
    ${HELPERS}
    const press = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    const out = {}
    const setup = (core, part, id) => {
      (${SETUP})({ parts: ['focusing-lens', 'pressure-vent', part, 'kickstart'] })
      W.__loot.clear()
      W.__pause.hide()
      W.__run.mastery = new Set()
      W.__run.stats.at(-1).upgraded = undefined
      W.__core(core)
      W.__equipRank(part, 3)
      W.__run.ranks.arms = 3
    }
    const floor = (id) => { W.__dropAt(id, 0, 0); secs(1.5) }
    const cardState = () => ({
      shown: document.querySelector('#offer').classList.contains('show'),
      melt: document.querySelector('#offer .melt').style.display === 'none' ? null : document.querySelector('#offer .melt').textContent,
      pause: document.querySelector('#pause').classList.contains('show'),
      title: document.querySelector('#pause h2')?.textContent ?? null,
      cards: [...document.querySelectorAll('#pause .master')].map((b) => b.querySelector('.pname').textContent),
    })
    // Ram, depth 6: the label is null and a forced melt does nothing
    setup('ram', 'piston')
    W.__run.depth = 6
    floor('piston')
    out.d6 = cardState()
    press(document.querySelector('#offer .melt'))
    out.d6.after = { pause: document.querySelector('#pause').classList.contains('show'), ground: W.__loot.ground.length, upgrades: [...W.__run.upgrades] }
    // depth 7: the label, the card with both upgrades
    W.__run.depth = 7
    W.__loot.clear()
    floor('piston')
    out.d7 = cardState()
    press(document.querySelector('#offer .melt'))
    out.d7.card = cardState()
    document.querySelector('#pause .master').click()
    out.first = { upgrades: [...W.__run.upgrades], combat: [...C.upgrades], mastery: C.mastery.size, ground: W.__loot.ground.length, pause: document.querySelector('#pause').classList.contains('show'),
      melts: last().melts, upgraded: [...(last().upgraded ?? [])] }
    // the second: one card left
    floor('piston')
    out.second0 = cardState()
    press(document.querySelector('#offer .melt'))
    out.second = cardState()
    document.querySelector('#pause .master').click()
    out.after2 = { upgrades: [...W.__run.upgrades], combat: [...C.upgrades], upgraded: [...(last().upgraded ?? [])] }
    // the third: nothing left to learn, no melt line, a forced melt does nothing and the part stays
    floor('piston')
    out.third = cardState()
    press(document.querySelector('#offer .melt'))
    out.third.after = { pause: document.querySelector('#pause').classList.contains('show'), ground: W.__loot.ground.length, upgrades: [...W.__run.upgrades] }
    // Wake: its own two
    setup('wake', 'scrap-cleaver')
    W.__run.depth = 8
    floor('scrap-cleaver')
    out.wake = cardState()
    press(document.querySelector('#offer .melt'))
    out.wake.card = cardState()
    document.querySelector('#pause .master').click()
    out.wake.after = [...W.__run.upgrades]
    W.__run.depth = 1
    return out
  }`)
  assertEq('depth 6 with Ram: the card shows with no melt line, and a melt forced anyway does nothing', [r.d6.shown, r.d6.melt, r.d6.after], [true, null, { pause: false, ground: 1, upgrades: [] }])
  assertEq('depth 7: the melt line is the core\'s upgrade, and the card opens with both of Ram\'s, titled for the core', [r.d7.melt, r.d7.card.pause, r.d7.card.title, r.d7.card.cards], ['melt: Ram upgrade', true, 'Ram · upgrade', ['Wide Shove', 'Rubble']])
  assertEq('picking one: learned in the run and in combat, the floor part spent, no mastery, the card closed, logged on the depth', [r.first.upgrades, r.first.combat, r.first.mastery, r.first.ground, r.first.pause, r.first.upgraded], [['ram-wide'], ['ram-wide'], 0, 0, false, ['ram-wide']])
  assertEq('the second melt past III: one card, the one not learned', [r.second0.melt, r.second.cards], ['melt: Ram upgrade', ['Rubble']])
  assertEq('...and both are learned after it', [r.after2.upgrades, r.after2.combat, r.after2.upgraded], [['ram-wide', 'ram-rubble'], ['ram-wide', 'ram-rubble'], ['ram-wide', 'ram-rubble']])
  assertEq('a third melt past III with both learned: no melt line, a melt forced anyway does nothing and the floor part stays', [r.third.melt, r.third.after], [null, { pause: false, ground: 1, upgrades: ['ram-wide', 'ram-rubble'] }])
  assertEq("Wake's own two at depth 8", [r.wake.melt, r.wake.card.title, r.wake.card.cards, r.wake.after], ['melt: Wake upgrade', 'Wake · upgrade', ['Spray', 'Slipstream'], ['wake-spray']])
})

// K-M23 the bots (B3 built Ram's half early for the slam line; B4 adds Wake's). Headless d1-d3 in real generated levels, seeds 1-3, each core worn in turn, the starting
// loadout, weight and tap push as booted. A fight is one pack (d1 and d2: the first 3 packs each, woken with Still in their room) or the Assembler (d3, Still 9 u from it), played to the
// clear or a cap (40 s a pack, 150 s the Assembler), HP put back each tick. Math.random is seeded. Tether's bot (N2) circles the wire's anchor (else the nearest awake body) at 5 u, the way Wake's circles at 3, and the 10 s flee bot (K-M23's last case) runs straight away from the pack. Both bots cast either as soon as a part is ready ('eager') or 3.7 s after ('hesitant',
// never-melt's hesitation). Ram's bot is the brief's: it steps toward the nearest body until it is `1.45 + radius` from it (2.0 u from a hulk) and stops there. Wake's is the brief's:
// it circles the nearest awake body at radius 3 at the stick's full 5.5 u/s (the path code of stagec's K-N17 circler, which circles a fixed point: here the point is the nearest body's
// centre, re-read each tick, and the bot aims 0.4 rad on round the circle, and goes round the other way when a wall pins it for 12 ticks: the first version, which did not, stood on a wall for 140 s of two of the three Assembler fights). PASS: each core's eager bot fells the Assembler in 2 of 3 seeds. REPORTED, not a pass
// line here: HP lost, marks spent / made, shoves (Ram; 3-balancer.md: the line is 0.3 slams on the core's BEAT shoves, Piston's and Kickstart's knocks counted apart) or skims (Wake),
// and the hesitant bot beside the eager one. Nothing is tuned to make it pass.
const CORE_BOT = `(arg) => {
  const W = window
  const C = W.__combat
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  W.__hold(true)
  W.__core(arg.core)
  for (const slot of SLOTS) C.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart']) W.__equip(id)
  const original = Math.random
  Math.random = mulberry32(arg.seed * 131 + arg.pack + arg.depth * 7)
  try {
    W.__enter(arg.depth, arg.seed)
    C.autoAttack = true
    C.autoTimer = 0
    W.__stick(0, 0)
    const lvl = W.__level()
    let pack, at
    if (arg.boss) {
      pack = C.packs.find((p) => p.members.some((m) => m.kind === 'boss'))
      if (!pack) return null
      const b = pack.members[0]
      at = null
      for (let k = 0; k < 16 && !at; k++) {
        const a = (k / 16) * Math.PI * 2
        const x = b.pos.x + Math.sin(a) * 9, z = b.pos.z + Math.cos(a) * 9
        if (!C.terrain.blocked(x, z, 0.6) && C.terrain.lineClear(x, z, b.pos.x, b.pos.z, 0.3)) at = { x, z }
      }
      if (!at) return { noSpot: true }
    } else {
      const spec = lvl.packs[arg.pack]
      pack = C.packs[arg.pack]
      if (!spec || !pack) return null
      at = spec.room?.center ?? pack.members[0].pos
    }
    W.__still.pos.set(at.x, 0, at.z)
    C.hasPrev = false
    C.wake(pack)
    const st = W.__run.stats[W.__run.stats.length - 1]
    const base = JSON.parse(JSON.stringify({ marks: st.marks, spends: st.spends, shoves: st.shoves ?? null, skims: st.skims ?? null, thorns: st.thorns ?? null, tether: st.tether ?? null, hand: st.hand ?? 0, core: st.autoDmg ? st.autoDmg.core : 0 }))
    const readySince = {}
    const body = pack.members.map((e) => e.kind)
    const hp0 = pack.members.map((e) => e.hp)
    W.__fx()
    let lost = 0, ticks = 0, cleared = false
    let cdir = 1, pinned = 0, lastP = null
    const cap = (arg.flee || arg.tenS ? 10 : arg.boss ? 150 : 40) * 60
    for (let i = 0; i < cap; i++) {
      // B5: a keystone dropped by an elite opens the socket card when walked onto, and the card is modal (the buttons are off behind it): the bot leaves it, as the hesitant player who looks at it and walks on
      if (document.querySelector('#pause .pkey')) { document.querySelector('#pause .leave').click(); W.__sockets = (W.__sockets ?? 0) + 1 }
      for (const slot of SLOTS) {
        if (!W.__hud.isReady(slot)) { readySince[slot] = null; continue }
        readySince[slot] ??= C.time
        if (arg.bot === 'eager' || C.time - readySince[slot] >= 3.7 - 1e-9) { W.__fire(slot); readySince[slot] = null }
      }
      // the bot: toward the nearest awake body, stopping 1.45 + its radius off (2.0 u from a hulk)
      let near = null, nd = Infinity
      const p = W.__still.pos
      for (const e of C.enemies) {
        if (e.dead) continue
        const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z)
        if (d < nd) { nd = d; near = e }
      }
      if (arg.flee) {
        // the flee bot (N2, Tether's cheap play): straight away from the middle of the awake bodies at the stick's full 5.5 u/s, and it stands where a wall stops it; nothing about the wire is steered
        let cx = 0, cz = 0, n = 0
        for (const e of C.enemies) if (!e.dead && C.awakeNow(e)) { cx += e.pos.x; cz += e.pos.z; n++ }
        if (n) {
          cx /= n; cz /= n
          const dx = p.x - cx, dz = p.z - cz, dd = Math.hypot(dx, dz) || 1
          W.__stick(dx / dd, dz / dd)
        } else W.__stick(0, 0)
      } else if (arg.core === 'wake' || arg.core === 'tether') {
        // Wake's bot: round the nearest AWAKE body at radius 3, 0.4 rad on round the circle from where it stands now (the stick is the full 5.5 u/s). Tether's (N2): the same path, round the wire's anchor (the nearest awake body while there is
        // none) at radius 5, so the wire is a spoke that sweeps the pack. It leaves the wire to its own hook
        const R = arg.core === 'tether' ? 5 : 3
        let aw = arg.core === 'tether' && C.wires[0].e && !C.wires[0].e.dead ? C.wires[0].e : null, ad = Infinity
        for (const e of C.enemies) {
          if (aw) break
          if (e.dead || !C.awakeNow(e)) continue
          const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z)
          if (d < ad) { ad = d; aw = e }
        }
        if (aw) {
          // pinned on a wall (the stick out and the body hardly moving for 12 ticks): go round the other way, as a player would
          if (lastP && Math.hypot(p.x - lastP.x, p.z - lastP.z) < 0.4 * 5.5 / 60) pinned++
          else pinned = 0
          if (pinned >= 12) { cdir = -cdir; pinned = 0 }
          lastP = { x: p.x, z: p.z }
          const a = Math.atan2(p.z - aw.pos.z, p.x - aw.pos.x) + 0.4 * cdir
          const dx = aw.pos.x + Math.cos(a) * R - p.x, dz = aw.pos.z + Math.sin(a) * R - p.z, dd = Math.hypot(dx, dz) || 1
          W.__stick(dx / dd, dz / dd)
        } else W.__stick(0, 0)
      } else if (near && nd > 1.45 + near.radius) W.__stick((near.pos.x - p.x) / nd, (near.pos.z - p.z) / nd)
      else W.__stick(0, 0)
      C.hp = 100
      W.__step(1 / 60)
      lost += 100 - C.hp
      ticks++
      if (pack.members.every((e) => e.dead)) { cleared = true; break }
    }
    W.__stick(0, 0)
    const now = W.__run.stats[W.__run.stats.length - 1]
    const sub = (a, b) => (typeof a === 'number' ? a - (b ?? 0) : Object.fromEntries(Object.keys(a).map((k) => [k, sub(a[k], b ? b[k] : 0)])))
    const sh = now.shoves ? sub(now.shoves, base.shoves) : null
    return {
      body, hp: hp0, cleared, lost, s: ticks / 60, boss: !!arg.boss,
      marks: sub(now.marks, base.marks), spends: { hits: now.spends.hits - base.spends.hits, bonus: now.spends.bonus - base.spends.bonus }, shoves: sh, skims: now.skims ? sub(now.skims, base.skims) : null,
      thorns: now.thorns ? sub(now.thorns, base.thorns) : null, tether: now.tether ? sub(now.tether, base.tether) : null, coreDmg: (now.autoDmg ? now.autoDmg.core : 0) - base.core,
      hand: (now.hand ?? 0) - base.hand,
    }
  } finally {
    Math.random = original
  }
}`

// its own page (an unused `bots` query key): it leaves real generated levels and a boss behind, and K-M30 counts the scene's children
check('K-M23', RUN + '&bots=1', async ({ page }) => {
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
  const sum = (xs) => xs.reduce((a, b) => a + b, 0)
  const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-')
  const felledBy = {}
  /** the bare run's rows, to set Thorns' HP lost beside (the same fights, the same loadout, no core) */
  let rowsBare = []
  for (const core of [null, 'ram', 'wake', 'thorns', 'tether']) {
    const Name = core === 'ram' ? 'Ram' : core === 'wake' ? 'Wake' : core === 'thorns' ? 'Thorns' : core === 'tether' ? 'Tether' : 'Bare'
    const rows = []
    for (const bot of ['eager', 'hesitant']) {
      for (const depth of [1, 2, 3]) {
        for (const seed of [1, 2, 3]) {
          if (depth === 3) {
            const r = await evalJson(page, CORE_BOT, { core, bot, depth, seed, pack: 0, boss: true })
            if (r) rows.push({ bot, depth, seed, ...r })
          } else {
            for (let pack = 0; pack < 3; pack++) {
              const r = await evalJson(page, CORE_BOT, { core, bot, depth, seed, pack, boss: false })
              if (r) rows.push({ bot, depth, seed, pack, ...r })
            }
          }
        }
      }
    }
    if (core === null) {
      // no core: the same fights and loadout, for Thorns' HP lost to be read against (nothing here is marked)
      rowsBare = rows
      for (const bot of ['eager', 'hesitant']) {
        const rs = rows.filter((r) => r.bot === bot)
        console.log(`INFO K-M23 Bare ${bot}: ${rs.length} fights, cleared ${rs.filter((r) => r.cleared).length}, ${f(mean(rs.map((r) => r.s)), 1)} s each, HP lost ${f(mean(rs.map((r) => r.lost)), 0)} each`)
      }
      const bb = rows.filter((r) => r.bot === 'eager' && r.depth === 3)
      console.log(`INFO K-M23 Bare eager, the Assembler: felled ${bb.filter((r) => r.cleared).length} of ${bb.length} (${bb.map((r) => `seed ${r.seed}: ${r.cleared ? f(r.s, 1) + ' s' : 'not in 150 s'}, HP lost ${f(r.lost, 0)}`).join('; ')})`)
      continue
    }
    const z = { n: 0, wall: 0, body: 0, still: 0, tell: 0, plain: 0, chained: 0, caught: 0, beat: { n: 0, wall: 0, body: 0, still: 0, tell: 0 } }
    const tot = (rs) => {
      const t = JSON.parse(JSON.stringify(z))
      for (const r of rs) if (r.shoves) {
        for (const k of ['n', 'wall', 'body', 'still', 'tell', 'plain', 'chained', 'caught']) t[k] += r.shoves[k] ?? 0
        for (const k of ['n', 'wall', 'body', 'still', 'tell']) t.beat[k] += r.shoves.beat?.[k] ?? 0
      }
      return t
    }
    for (const bot of ['eager', 'hesitant']) {
      const mine = rows.filter((r) => r.bot === bot)
      for (const [label, rs] of [['d1', mine.filter((r) => r.depth === 1)], ['d2', mine.filter((r) => r.depth === 2)], ['d3 (the Assembler)', mine.filter((r) => r.depth === 3)]]) {
        const made = sum(rs.map((r) => r.marks.made)), spent = sum(rs.map((r) => r.marks.spent))
        const head = `INFO K-M23 ${Name} ${bot} ${label}: ${rs.length} fights, cleared ${rs.filter((r) => r.cleared).length}, ${f(mean(rs.map((r) => r.s)), 1)} s each, HP lost ${f(mean(rs.map((r) => r.lost)), 0)} each (${f(sum(rs.map((r) => r.lost)), 0)} in all), marks made ${made} spent ${spent} (${f(made ? spent / made : NaN)}), spends ${sum(rs.map((r) => r.spends.hits))} for ${sum(rs.map((r) => r.spends.bonus))}`
        if (core === 'ram') {
          const t = tot(rs)
          const slams = t.wall + t.body + t.still + t.tell
          const bslams = t.beat.wall + t.beat.body + t.beat.still + t.beat.tell
          console.log(`${head}; shoves ${t.n} (beat ${t.beat.n}): wall ${t.wall} body ${t.body} still ${t.still} tell ${t.tell} plain ${t.plain}, slams per shove ${f(t.n ? slams / t.n : NaN)}, per beat shove ${f(t.beat.n ? bslams / t.beat.n : NaN)}, per beat shove without still ${f(t.beat.n ? (bslams - t.beat.still) / t.beat.n : NaN)}`)
        } else if (core === 'thorns') {
          const tn = (k) => sum(rs.map((r) => r.thorns?.[k] ?? 0))
          const secs = sum(rs.map((r) => r.s))
          console.log(`${head}; thorns ${tn('n')} (a hit taken ${tn('hit')}, a block ${tn('block')}, a shot ${tn('shot')}, on a boss ${tn('boss')}), ${f(secs ? tn('n') / secs : NaN, 3)} a second, blocks ${f(secs ? tn('block') / secs : NaN, 3)} a second, core damage ${sum(rs.map((r) => r.coreDmg ?? 0))} (${f(secs ? sum(rs.map((r) => r.coreDmg ?? 0)) / secs : NaN, 1)} a second), marks made by the core ${sum(rs.map((r) => r.marks.byCore))}, by parts ${sum(rs.map((r) => r.marks.byPart))}, expired ${sum(rs.map((r) => r.marks.expired))}`)
        } else if (core === 'tether') {
          const tt = (k) => sum(rs.map((r) => r.tether?.[k] ?? 0))
          const secs = sum(rs.map((r) => r.s))
          console.log(`${head}; hooks ${tt('hooks')}, breaks ${tt('breaks')}, crossings ${tt('crossings')} (${f(secs ? tt('crossings') / secs : NaN, 3)} a second), anchor ticks ${tt('anchorTicks')}, core damage ${sum(rs.map((r) => r.coreDmg ?? 0))} (${f(secs ? sum(rs.map((r) => r.coreDmg ?? 0)) / secs : NaN, 1)} a second), marks made by the core ${sum(rs.map((r) => r.marks.byCore))}, by parts ${sum(rs.map((r) => r.marks.byPart))}, expired ${sum(rs.map((r) => r.marks.expired))}`)
        } else {
          const sk = (k) => sum(rs.map((r) => r.skims?.[k] ?? 0))
          const secs = sum(rs.map((r) => r.s))
          console.log(`${head}; skims ${sk('n')} (burst ${sk('burst')}, spray ${sk('spray')}), ${f(secs ? sk('n') / secs : NaN)} a second, marks made by the core ${sum(rs.map((r) => r.marks.byCore))}, by parts ${sum(rs.map((r) => r.marks.byPart))}, expired ${sum(rs.map((r) => r.marks.expired))}`)
        }
      }
      if (core === 'ram') {
        // the slam line, on the pack fights (d1 and d2) and on the beat shoves alone (3-balancer.md)
        const t = tot(mine.filter((r) => r.depth < 3))
        const bg = t.beat.wall + t.beat.body + t.beat.tell + t.beat.still
        console.log(`INFO K-M23 Ram ${bot}, pack fights d1-d2: ${f(t.beat.n ? bg / t.beat.n : NaN)} slams per core beat shove over ${t.beat.n} beats (the line is >= 0.3: ${t.beat.n && bg / t.beat.n >= 0.3 ? 'met' : 'NOT met'}); wall ${t.beat.wall} body ${t.beat.body} tell ${t.beat.tell} of them, ${t.n - t.beat.n} shoves were Piston's or Kickstart's`)
      } else if (core === 'thorns') {
        const packs = mine.filter((r) => r.depth < 3)
        const made = sum(packs.map((r) => r.marks.made)), spent = sum(packs.map((r) => r.marks.spent))
        const bare = rowsBare.filter((r) => r.bot === bot && r.depth < 3)
        console.log(`INFO K-M23 Thorns ${bot}, pack fights d1-d2: marks spent / made ${f(made ? spent / made : NaN)} (${spent} of ${made}), ${sum(packs.map((r) => r.thorns?.n ?? 0))} thorns hits over ${f(sum(packs.map((r) => r.s)), 0)} s, HP lost ${f(mean(packs.map((r) => r.lost)), 0)} a fight against ${f(mean(bare.map((r) => r.lost)), 0)} bare (the same fights and loadout; ${f(mean(packs.map((r) => r.s)), 1)} s against ${f(mean(bare.map((r) => r.s)), 1)} s), cleared ${packs.filter((r) => r.cleared).length} of ${packs.length} against ${bare.filter((r) => r.cleared).length} bare`)
      } else if (core === 'tether') {
        const packs = mine.filter((r) => r.depth < 3)
        const made = sum(packs.map((r) => r.marks.made)), spent = sum(packs.map((r) => r.marks.spent))
        const tt = (k) => sum(packs.map((r) => r.tether?.[k] ?? 0))
        console.log(`INFO K-M23 Tether ${bot}, pack fights d1-d2: marks spent / made ${f(made ? spent / made : NaN)} (${spent} of ${made}), hooks ${tt('hooks')}, breaks ${tt('breaks')}, crossings ${tt('crossings')} over ${f(sum(packs.map((r) => r.s)), 0)} s, HP lost ${f(mean(packs.map((r) => r.lost)), 0)} a fight, cleared ${packs.filter((r) => r.cleared).length} of ${packs.length}`)
      } else {
        const packs = mine.filter((r) => r.depth < 3)
        const made = sum(packs.map((r) => r.marks.made)), spent = sum(packs.map((r) => r.marks.spent))
        console.log(`INFO K-M23 Wake ${bot}, pack fights d1-d2: marks spent / made ${f(made ? spent / made : NaN)} (${spent} of ${made}; the line from his runs is >= 0.5), ${sum(packs.map((r) => r.skims?.n ?? 0))} skims over ${f(sum(packs.map((r) => r.s)), 0)} s`)
      }
    }
    const boss = rows.filter((r) => r.bot === 'eager' && r.depth === 3)
    const felled = boss.filter((r) => r.cleared).length
    felledBy[core] = [felled, boss.length]
    console.log(`INFO K-M23 ${Name} eager, the Assembler: felled ${felled} of ${boss.length} (${boss.map((r) => `seed ${r.seed}: ${r.cleared ? f(r.s, 1) + ' s' : 'not in 150 s'}, HP lost ${f(r.lost, 0)}`).join('; ')})`)
    const hb = rows.filter((r) => r.bot === 'hesitant' && r.depth === 3)
    console.log(`INFO K-M23 ${Name} hesitant, the Assembler: felled ${hb.filter((r) => r.cleared).length} of ${hb.length} (${hb.map((r) => `seed ${r.seed}: ${r.cleared ? f(r.s, 1) + ' s' : 'not in 150 s'}`).join('; ')})`)
  }
  // N2: Tether's cheap play, running straight away: 10 s from each of the first three packs of d1 and d2, seeds 1-3, the same loadout and the same wire. About 0 crossings is the rule's point (K-M34 holds it kinematically)
  {
    const fl = []
    for (const depth of [1, 2]) for (const seed of [1, 2, 3]) for (let pack = 0; pack < 3; pack++) {
      const r = await evalJson(page, CORE_BOT, { core: 'tether', bot: 'eager', depth, seed, pack, boss: false, flee: true })
      if (r) fl.push(r)
    }
    const tt = (k) => sum(fl.map((r) => r.tether?.[k] ?? 0))
    console.log(`INFO K-M23 Tether flee bot (straight away from the pack, 10 s each): ${fl.length} runs, ${f(sum(fl.map((r) => r.s)), 0)} s, crossings ${tt('crossings')} (${f(sum(fl.map((r) => r.s)) ? tt('crossings') / sum(fl.map((r) => r.s)) : NaN, 3)} a second), hooks ${tt('hooks')}, breaks ${tt('breaks')}, anchor ticks ${tt('anchorTicks')}`)
    // the same runs, circling the anchor as the bot does: the figure the flee is held against
    const ci = []
    for (const depth of [1, 2]) for (const seed of [1, 2, 3]) for (let pack = 0; pack < 3; pack++) {
      const r = await evalJson(page, CORE_BOT, { core: 'tether', bot: 'eager', depth, seed, pack, boss: false, flee: false, tenS: true })
      if (r) ci.push(r)
    }
    const tc = (k) => sum(ci.map((r) => r.tether?.[k] ?? 0))
    console.log(`INFO K-M23 Tether circling bot, first 10 s of each of the same packs: ${ci.length} runs, crossings ${tc('crossings')} (${f(sum(ci.map((r) => r.s)) ? tc('crossings') / sum(ci.map((r) => r.s)) : NaN, 3)} a second), hooks ${tc('hooks')}, breaks ${tc('breaks')}`)
  }
  // Thorns (N3) and Tether (N2) are reported, not pass lines: their bots are first drafts of a player standing in the fight (the Thorns bot is Ram's walk up to the body, and no more), or circling a wire
  for (const core of ['ram', 'wake']) assert(felledBy[core][1] === 3 && felledBy[core][0] >= 2, `the eager ${core === 'ram' ? 'Ram' : 'Wake'} bot fells the Assembler in 2 of 3 seeds (${felledBy[core][0]} of ${felledBy[core][1]})`)
})


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B5: the hunt and the HUD. K-M24 to K-M29 (and K-M22's upgrade half, above). Numbers: 3-balancer.md (FILTER.share 0.5, upgrades from depth 7, Fit.k per part: Piston +12, Backhand +10,
// Scrap Cleaver +3 under Wake and +4 under Ram), which is binding over BUILD.md's where they differ (its K-M26 says Piston "+8 each"; it is +12).
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

/** In the page: a seeded Math.random (mulberry32), so a draw count is the same every run; `unseed()` gives it back. */
const SEEDED = `
  const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const realRandom = Math.random
  const seed = (n) => { Math.random = mulberry32(n) }
  const unseed = () => { Math.random = realRandom }
`

check('K-M24', RUN, async ({ page }) => {
  // the filter: 1000 draws a source with Wake worn, through the real hunt (rollForCore, then rollPart). BUILD.md says 400; at 400 a seeded draw sits 2.8 sigma from the band's edge (seed 11 gave 57.5% for boss-blue), so 1000 (4.4 sigma)
  const r = await evalJson(page, `() => {
    (${SETUP})()
    ${SEEDED}
    const W = window
    W.__core('wake')
    const out = { share: {}, kill: {} }
    const N = 1000
    try {
      for (const source of ['elite', 'plenty', 'boss-blue']) {
        seed(11)
        const x = W.__rollMoment({ source, depth: 5, n: N, socketed: null, onFloor: [], taken: [] })
        out.share[source] = { filtered: x.filtered / N, got: x.got, keys: x.keys }
      }
      for (const source of ['kill', 'crate', 'boss-gold']) {
        seed(12)
        const x = W.__rollMoment({ source, depth: 5, n: N, socketed: null, onFloor: [], taken: [] })
        out.kill[source] = { filtered: x.filtered, keys: Object.keys(x.keys).length }
      }
      // a turned part never comes; a Wake part never found can; the socketed keystone never comes, the other can
      seed(13)
      const turned = W.__rollMoment({ source: 'elite', depth: 5, n: N, socketed: null, onFloor: [], taken: [], turned: ['frost-trail'] })
      out.turned = { frost: turned.ids['frost-trail'] ?? 0, others: ['frayed-cleaver', 'spring-heels', 'signal-flare'].filter((id) => (turned.ids[id] ?? 0) > 0).length, got: turned.got }
      seed(14)
      const open = W.__rollMoment({ source: 'elite', depth: 5, n: N, socketed: null, onFloor: [], taken: [] })
      const found = W.__save().found
      out.unfound = Object.keys(open.ids).filter((id) => ['frayed-cleaver', 'frost-trail', 'spring-heels', 'signal-flare', 'ward', 'scrap-cleaver'].includes(id) && !found.includes(id))
      seed(15)
      const sock = W.__rollMoment({ source: 'elite', depth: 5, n: N, socketed: 'wake-burst', onFloor: [], taken: [] })
      out.socket = { burst: sock.keys['wake-burst'] ?? 0, deep: sock.keys['wake-deep'] ?? 0 }
      seed(16)
      const floor = W.__rollMoment({ source: 'plenty', depth: 5, n: N, socketed: 'wake-deep', onFloor: ['wake-burst'], taken: [] })
      out.both = { keys: Object.keys(floor.keys).length }
      // what is worn or lying never comes again
      seed(17)
      const worn = ['scrap-cleaver', 'frayed-cleaver', 'frost-trail', 'signal-flare', 'spring-heels']
      const rest = W.__rollMoment({ source: 'elite', depth: 5, n: N, socketed: 'wake-burst', onFloor: ['wake-deep'], taken: worn })
      out.rest = { wornAgain: worn.filter((id) => (rest.ids[id] ?? 0) > 0), ward: rest.ids['ward'] ?? 0, keys: Object.keys(rest.keys).length, filtered: rest.filtered }
      // builds off, and no core: the draws are rollPart's, on the same seeds
      const same = (setup) => {
        setup()
        return ['elite', 'plenty', 'boss-blue', 'kill'].map((source) => {
          seed(21)
          const a = W.__rollMoment({ source, depth: 5, n: 200, socketed: null, onFloor: [], taken: [] })
          seed(21)
          const b = W.__rollMany({ source, depth: 5, n: 200 })
          return a.filtered === 0 && JSON.stringify([a.ids, a.got]) === JSON.stringify([b.ids, b.got])
        })
      }
      out.noCore = same(() => W.__core(null))
      out.off = same(() => { W.__core('wake'); W.__builds(false) })
      W.__builds(true)
    } finally { unseed() }
    return out
  }`)
  for (const source of ['elite', 'plenty', 'boss-blue']) {
    const x = r.share[source]
    assert(Math.abs(x.filtered - 0.5) <= 0.07, `${source}: ${(x.filtered * 100).toFixed(1)}% of 1000 draws came from Wake's pool, want 50% +-7 (FILTER.share 0.5)`)
    assert(Object.keys(x.keys).length === 2, `${source}: both of Wake's keystones can come (${JSON.stringify(x.keys)})`)
    console.log(`INFO K-M24 ${source}: ${(x.filtered * 100).toFixed(1)}% from Wake's pool (1000 draws), keystones ${JSON.stringify(x.keys)}`)
  }
  assertEq('kill, crate and boss-gold: nothing comes from the filter, no keystone', r.kill, { kill: { filtered: 0, keys: 0 }, crate: { filtered: 0, keys: 0 }, 'boss-gold': { filtered: 0, keys: 0 } })
  assertEq("a turned part never comes (Skate's base part turned to the wall: 0 in 1000), while the others still do", [r.turned.frost, r.turned.others, r.turned.got], [0, 3, 1000])
  assert(r.unfound.length > 0, `a Wake part never found can come: ${r.unfound.join(', ') || 'none came'}`)
  assertEq('the socketed keystone never comes, the other can', [r.socket.burst, r.socket.deep > 0], [0, true])
  assertEq('with one socketed and the other lying, no keystone comes at all', r.both.keys, 0)
  assertEq('what is worn is never drawn again; with the rest lying or socketed the pool is Ward alone, and the filter still takes half the draws', [r.rest.wornAgain, r.rest.ward > 0, r.rest.keys, r.rest.filtered > 400 && r.rest.filtered < 600], [[], true, 0, true])
  assertEq("no core worn: the draws are rollPart's on the same seeds, in every source", r.noCore, [true, true, true, true])
  assertEq('builds off with a core on the run: the same', r.off, [true, true, true, true])
})

const K25_SEED = 5
check('K-M25', RUN, async ({ page }) => {
  // keystones on the floor: walked onto, the socket opens; take / leave; the one given up lies at his feet; the thief never sees one; the level's end logs it left
  const r = await evalJson(page, `async () => {
    (${SETUP})({ parts: ['focusing-lens'] })
    ${WAKE}
    ${SEEDED}
    W.__loot.clear()
    W.__pause.hide()
    W.__core('wake')
    // seeded: where the keystone he gives up lands (0.8 to 1.6 u from his feet) is then the same every run, and this seed lands it inside the pickup radius, where the hold is what keeps the card shut
    seed(${K25_SEED})
    const out = {}
    const open = () => document.querySelector('#pause').classList.contains('show') && !!document.querySelector('#pause .pkey')
    const stepN = (n) => { for (let i = 0; i < n; i++) { C.hp = 100; W.__step(1 / 60) } }
    const keys = () => W.__keys()
    const card = () => ({
      title: document.querySelector('#pause h2')?.textContent,
      cards: [...document.querySelectorAll('#pause .pcard')].map((c) => [c.querySelector('.tag')?.textContent, c.querySelector('.pname')?.textContent]),
      tags: [...document.querySelectorAll('#pause .pkey .stat span')].map((s) => s.textContent),
      lose: document.querySelector('#pause .plose')?.textContent ?? null,
      buttons: [...document.querySelectorAll('#pause .actions button')].map((b) => b.textContent),
    })
    const press = (cls) => document.querySelector('#pause .' + cls).click()
    // 1: a keystone at 2 u: not under him, then walked onto
    W.__dropKey('wake-burst', 2, 0)
    place(0, 0)
    stepN(40)
    out.far = { open: open(), keys: keys().keys.length, offer: document.querySelector('#offer').classList.contains('show') }
    place(2, 0)
    stepN(2)
    out.card1 = { open: open(), ...card() }
    // the world waits: 0.6 s of real frames (the loop held off since SETUP) move neither the game clock nor Still
    const t0 = C.time
    const p0 = W.__still.pos.x
    W.__stick(1, 0)
    W.__hold(false)
    await new Promise((r) => setTimeout(r, 600))
    W.__hold(true)
    W.__stick(0, 0)
    out.frozen = C.time === t0 && W.__still.pos.x === p0
    out.seen1 = keys().keys[0]?.seen
    press('take')
    stepN(10)
    out.take1 = { open: open(), socket: keys().socket, combat: C.keystone, floor: keys().keys.length, recs: W.__run.drops.filter((d) => d.fit === 'key').map((d) => [d.id, d.end, d.offered]) }
    // 2: a second keystone with Burst socketed: "you lose" reads; taking it drops Burst at his feet, shut while he stands there
    W.__dropKey('wake-deep', 5, 0)
    place(2, 0)
    stepN(40)
    place(5, 0)
    stepN(2)
    out.card2 = { open: open(), ...card() }
    press('take')
    stepN(45)
    const lying = keys()
    const kd = lying.keys[0] ? Math.hypot(lying.keys[0].x - 5, lying.keys[0].z) : 99
    out.take2 = { socket: lying.socket, combat: C.keystone, floor: lying.keys.map((k) => [k.id, Math.hypot(k.x - 5, k.z) < 1.7]), held: lying.held === 'wake-burst', near: kd < 1.15, open: open() }
    // away and back: the hold lifts, and the one he gave up can be taken back
    place(9, 0)
    stepN(2)
    out.away = { open: open(), held: keys().held }
    const b = keys().keys[0]
    place(b.x, b.z)
    stepN(2)
    out.back = { open: open(), ...card() }
    // 3: leave it: it stays, seen; shut while he stands on it; away and back reopens it
    press('leave')
    stepN(30)
    out.left = { open: open(), floor: keys().keys.map((k) => [k.id, k.seen]), socket: keys().socket, held: keys().held, offer: document.querySelector('#offer').classList.contains('show') }
    place(b.x + 6, b.z)
    stepN(2)
    place(b.x, b.z)
    stepN(2)
    out.reopened = open()
    press('leave')
    // the thief and the melt line never see one: no part on the floor is a keystone, and the thief's ground is empty of them
    out.thief = { ground: W.__thiefGround(), lootGround: W.__loot.ground.length, keys: W.__loot.keys.length }
    // 4: a keystone never walked onto, the level ends: every keystone record ends, the lying ones 'left' (and the one he saw but left, offered)
    W.__dropKey('wake-burst', 12, 0)
    place(0, 0)
    stepN(40)
    const lyingNow = W.__loot.keys.length
    W.__enter(2, 1)
    out.clear = { lyingNow, keysAfter: W.__loot.keys.length, recs: W.__run.drops.filter((d) => d.fit === 'key').map((d) => [d.id, d.source, d.end, d.offered]) }
    unseed()
    return out
  }`)
  assertEq('a keystone 2 u away opens nothing, shows no pickup card and no melt line', [r.far.open, r.far.keys, r.far.offer], [false, 1, false])
  assertEq("walked onto, the socket card opens: the core's name, the socket empty, Burst with its tag, take and leave", [r.card1.open, r.card1.title, r.card1.cards, r.card1.tags, r.card1.lose, r.card1.buttons], [true, 'Wake · socket', [['socket', 'empty'], ['on the floor', 'Burst']], ['for packs'], null, ['leave it', 'take it']])
  assertEq('...the world waits behind it, and the keystone is marked seen', [r.frozen, r.seen1], [true, true])
  assertEq('take: socketed (combat.keystone ran), nothing left on the floor, the card closed, the record taken and offered', [r.take1.open, r.take1.socket, r.take1.combat, r.take1.floor, r.take1.recs], [false, 'wake-burst', 'wake-burst', 0, [['wake-burst', 'taken', true]]])
  assertEq('with Burst socketed, Deep Frost\'s card shows both and "you lose: Burst"', [r.card2.open, r.card2.cards, r.card2.tags, r.card2.lose], [true, [['socket', 'Burst'], ['on the floor', 'Deep Frost']], ['for packs', 'for bosses'], 'you lose: Burst'])
  assertEq('taking it: Deep Frost is socketed, Burst lies at his feet, and the card stays shut while he stands there', [r.take2.socket, r.take2.combat, r.take2.floor, r.take2.near, r.take2.held, r.take2.open], ['wake-deep', 'wake-deep', [['wake-burst', true]], true, true, false])
  assertEq('stepped away the hold lifts; stepped back, the keystone he gave up can be taken back', [r.away.open, r.away.held, r.back.open, r.back.lose], [false, null, true, 'you lose: Deep Frost'])
  assertEq('leave: the keystone stays, seen, the socket as it was; shut while he stands on it, no pickup card; away and back reopens it', [r.left.open, r.left.floor, r.left.socket, r.left.held, r.left.offer, r.reopened], [false, [['wake-burst', true]], 'wake-deep', 'wake-burst', false, true])
  assertEq("the thief's want list holds no keystone, and the floor's part list neither (the keystones lie apart)", [r.thief.ground, r.thief.lootGround, r.thief.keys], [[], 0, 1])
  assertEq('the level ends: no keystone is left lying in the scene, and the two that were are logged left: the one he saw (offered) and the one he never walked onto (not)', [r.clear.lyingNow, r.clear.keysAfter, r.clear.recs.filter((x) => x[2] === 'left').map((x) => [x[1], x[3]]).sort()], [2, 0, [['dev', false], ['swap', true]]])
  assertEq('...and every keystone record ends (taken or left), none stays null', r.clear.recs.filter((x) => x[2] === null).length, 0)
})

check('K-M26', RUN, async ({ page }) => {
  // the cards say the fit, with a core worn (the pickup card and the compare); the floor glyph is decided at the drop; builds off, nothing new shows
  const r = await evalJson(page, `() => {
    (${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] })
    ${WAKE}
    W.__loot.clear()
    W.__pause.hide()
    const out = {}
    const fit = () => { const el = document.querySelector('#offer .fit'); return document.querySelector('#offer').classList.contains('show') && el.style.display !== 'none' ? el.textContent : null }
    const press = (sel) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    const stepN = (n) => { for (let i = 0; i < n; i++) { C.hp = 100; W.__step(1 / 60) } }
    const seen = (id) => {
      W.__loot.clear()
      W.__dropAt(id, 0, 0)
      place(0, 0)
      stepN(40)
      const card = fit()
      // the compare card: the same line
      press('#offer .compare')
      const cmp = document.querySelector('#pause .pfit')?.textContent ?? null
      const cmpOpen = document.querySelector('#pause').classList.contains('show')
      if (cmpOpen) document.querySelector('#pause .leave').click()
      return { card, cmp }
    }
    W.__core('ram')
    out.ram = { piston: seen('piston'), backdraft: seen('backdraft-vent'), kickstart: seen('kickstart'), brace: seen('brace'), flare: seen('flare'), cleaver: seen('scrap-cleaver'), lens: seen('focusing-lens') }
    W.__core('wake')
    out.wake = { cleaver: seen('scrap-cleaver'), backhand: seen('frayed-cleaver'), skate: seen('frost-trail'), flare: seen('signal-flare'), heels: seen('spring-heels'), ward: seen('ward'), lens: seen('focusing-lens'), cardName: document.querySelector('#offer .name').textContent }
    // the glyph is decided at the drop, from the core worn then
    W.__core('ram')
    W.__loot.clear()
    W.__dropAt('piston', 3, 0)
    W.__dropAt('focusing-lens', -3, 0)
    W.__dropAt('backdraft-vent', 0, 3)
    W.__core(null)
    W.__dropAt('piston', 0, -3)
    out.ring = W.__loot.ground.map((g) => [g.def.id, !!g.fitRing])
    // the drop records say so too
    out.recs = W.__run.drops.filter((d) => d.source === 'dev').slice(-4).map((d) => [d.id, d.fit ?? null])
    // builds off with the core on the run: no fit line anywhere
    W.__core('ram')
    W.__builds(false)
    out.off = { piston: seen('piston'), backdraft: seen('backdraft-vent') }
    W.__builds(true)
    W.__core(null)
    out.bare = { piston: seen('piston') }
    return out
  }`)
  assertEq('Ram: Piston, spender, +12 each (3-balancer: its own k), on the pickup card and the compare', r.ram.piston, { card: 'fits Ram · spends slammed: +12 each', cmp: 'fits Ram · spends slammed: +12 each' })
  assertEq('Ram: Backdraft, a shaper: its own line', r.ram.backdraft, { card: 'fits Ram · pulls them together, so a shove slams two', cmp: 'fits Ram · pulls them together, so a shove slams two' })
  assertEq('Ram: Kickstart (shaper), Brace (guard), Flare (spender, the core\'s +8), Scrap Cleaver (the bridge, +4)', [r.ram.kickstart.card, r.ram.brace.card, r.ram.flare.card, r.ram.cleaver.card], ['fits Ram · runs them into walls', 'fits Ram · holds your ground', 'fits Ram · spends slammed: +8 each', 'fits Ram · spends slammed: +4 each'])
  assertEq('Ram: Focusing Lens is plain: no fit line on either card', r.ram.lens, { card: null, cmp: null })
  assertEq('Wake: Scrap Cleaver +3, Backhand (the reshaped Frayed Cleaver) +10, Skate +6, Frost Flare and Spring Heels and Ward their lines, the Lens none', [r.wake.cleaver.card, r.wake.backhand.card, r.wake.skate.card, r.wake.flare.card, r.wake.heels.card, r.wake.ward.card, r.wake.lens.card],
    ['fits Wake · spends frosted: +3 each', 'fits Wake · spends frosted: +10 each', 'fits Wake · spends frosted: +6 each', 'fits Wake · frosts what will not come to you', 'fits Wake · over a wall, they string out after you', 'fits Wake · covers the pass', null])
  assertEq('...and the compare card carries the same line', [r.wake.backhand.cmp, r.wake.ward.cmp], ['fits Wake · spends frosted: +10 each', 'fits Wake · covers the pass'])
  assertEq("a part that fits has the glyph ring on the floor, a plain one none; decided at the drop (a Piston dropped with no core worn has none)", r.ring, [['piston', true], ['focusing-lens', false], ['backdraft-vent', true], ['piston', false]])
  assertEq("the drop records carry fit with a core worn ('fits' / 'plain') and none bare", r.recs, [['piston', 'fits'], ['focusing-lens', 'plain'], ['backdraft-vent', 'fits'], ['piston', null]])
  assertEq('builds off with a core on the run: no fit line on either card; bare, none', [r.off, r.bare], [{ piston: { card: null, cmp: null }, backdraft: { card: null, cmp: null } }, { piston: { card: null, cmp: null } }])
})

check('K-M27', RUN, async ({ page }) => {
  // the number is honest: five setups, each read with __spendCount, then the cast fired with no step between and its spent marks counted from the spend events
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    const nSpent = () => ev('spend').reduce((a, x) => a + x.n, 0)
    const stepN = (n) => { for (let i = 0; i < n; i++) { C.hp = 100; W.__step(1 / 60) } }
    const fresh = (parts, core) => {
      (${SETUP})({ parts, autos: false })
      W.__core(core)
      W.__loot.clear()
      W.__still.facing = 0
      W.__partLog.length = 0
    }
    const mark = (e, n) => W.__setMarks(idx(e), n)
    const btn = (slot) => document.querySelectorAll('#hud .btn')[['head', 'torso', 'arms', 'legs'].indexOf(slot)]
    const cueOf = (slot) => { const b = btn(slot); const s = b.querySelector('.spend'); return { text: s.textContent, cls: s.className, spend3: b.classList.contains('spend3'), spendcue: b.classList.contains('spendcue') } }
    // (a) a bolt: a Lens given a spend fit (a def of the check's own: no part in the pool is a bolt spender), walls holding 1, 3 and 2 in reach
    {
      fresh(['focusing-lens'], 'wake')
      const lens = { ...W.__hud.loadout[0], fits: { wake: { role: 'spend' } } }
      const a = body(-3, 3), b = body(0, 5), c = body(3, 3)
      mark(a, 1); mark(b, 3); mark(c, 2)
      const n = W.__spendCount('head', lens)
      C.useAbility(lens, { origin: W.__still.pos, facing: 0, moveX: 0, moveZ: 0, pushed: false, full: C.weight, strain: 0 })
      stepN(40)
      out.a = { n, spent: nSpent(), after: [a, b, c].map((e) => marks(e).n) }
    }
    // (b) Scrap Cleaver: 3 walls x 2 in the cone and one x 3 beyond its reach; then the cast's own re-aim: the 3 beats the 2s once it is in reach
    {
      fresh(['scrap-cleaver'], 'wake')
      const ws = [body(0, 1.5), body(-0.8, 1.4), body(0.8, 1.4)]
      const far = body(0, -5.5)
      for (const w of ws) mark(w, 2)
      mark(far, 3)
      const n = W.__spendCount('arms')
      W.__fire('arms', false)
      out.b = { n, spent: nSpent(), far: marks(far).n }
    }
    {
      fresh(['scrap-cleaver'], 'wake')
      const ws = [body(0, 1.5), body(-0.8, 1.4), body(0.8, 1.4)]
      const near = body(0, -1.6)
      for (const w of ws) mark(w, 2)
      mark(near, 3)
      const n = W.__spendCount('arms')
      W.__fire('arms', false)
      out.b2 = { n, spent: nSpent() }
    }
    // (c) Backdraft: a shaper, no number and no span
    {
      fresh(['pressure-vent', 'backdraft-vent'], 'ram')
      const w = body(0, 2)
      mark(w, 3)
      const n = W.__spendCount('torso')
      out.c = { n, ...cueOf('torso') }
    }
    // (d) Skate along the stick through 2 walls x 2, with a third marked wall off the path
    {
      fresh(['frost-trail'], 'wake')
      const a = body(0, 2), b = body(0.2, 4), off = body(3.2, 3)
      mark(a, 2); mark(b, 2); mark(off, 3)
      W.__stick(0, 1)
      const n = W.__spendCount('legs')
      W.__fire('legs', false)
      stepN(45)
      W.__stick(0, 0)
      out.d = { n, spent: nSpent(), off: marks(off).n }
    }
    // (e) Flare (Ram's spender): a blast catching 3 bodies x 1
    {
      fresh(['flare'], 'ram')
      const ws = [body(0, 6), body(0.9, 6.5), body(-0.9, 6.4)]
      const out4 = body(6, 6)
      for (const w of ws) mark(w, 1)
      const n = W.__spendCount('head')
      W.__fire('head', false)
      stepN(70)
      out.e = { n, spent: nSpent(), far: marks(out4).n }
    }
    // the button: 0 dim, 2 lit with no pulse, 3 ready pulses, 3 cooling shows the lit rim
    {
      fresh(['scrap-cleaver'], 'ram')
      const w = body(0, 1.5)
      const set = (n) => { W.__setMarks(idx(w), 3); const st = new Map(C.statuses()).get(w); st.marks.n = n; st.marks.t = n ? 3 : 0 }
      const row = []
      set(0); W.__spendCount('arms'); row.push(cueOf('arms'))
      set(2); W.__spendCount('arms'); row.push(cueOf('arms'))
      set(3); W.__spendCount('arms'); row.push(cueOf('arms'))
      W.__hud.devCool('arms', 3000); W.__spendCount('arms'); row.push(cueOf('arms'))
      W.__hud.devCool('arms', 0); W.__spendCount('arms'); row.push(cueOf('arms'))
      out.button = row
      // a 9 caps at 9: five more walls in the cone, all full
      const more = [body(-0.9, 1.9), body(0.9, 1.9), body(-1.4, 1.1), body(1.4, 1.1)]
      for (const m of more) mark(m, 3)
      set(3)
      out.nine = { n: W.__spendCount('arms'), ...cueOf('arms') }
    }
    // the refresh: with two spenders worn (Wake: Cleaver and Skate), 2 s of ticks make at most one spendCount a spender per 0.1 s of game time
    {
      fresh(['scrap-cleaver', 'frost-trail'], 'wake')
      const w = body(0, 1.5)
      mark(w, 1)
      stepN(3)
      let calls = 0
      const real = C.spendCount.bind(C)
      C.spendCount = (...a) => { calls++; return real(...a) }
      const t0 = C.time
      stepN(120)
      C.spendCount = real
      out.refresh = { calls, secs: C.time - t0 }
    }
    return out
  }`)
  assertEq('(a) a Lens given a spend fit, walls holding 1, 3 and 2: the number is 3, the bolt spends 3 (the 3-mark wall), the others keep theirs', [r.a.n, r.a.spent, r.a.after], [3, 3, [1, 0, 2]])
  assertEq('(b) Scrap Cleaver, 3 walls x 2 in the cone and one x 3 beyond its reach: 6, and 6 spent; the far one keeps its 3', [r.b.n, r.b.spent, r.b.far], [6, 6, 3])
  assertEq('(b) the cast re-aims at the most marks in reach: with the x 3 within reach behind him the swing turns to it, and the number is that swing\'s own: 3 and 3 spent', [r.b2.n, r.b2.spent], [3, 3])
  assertEq('(c) Backdraft (a shaper): null, and no digit on its button', [r.c.n, r.c.text, r.c.cls], [null, '', 'spend'])
  assertEq('(d) Skate along the stick through 2 walls x 2, a third marked wall off the path: 4, and 4 spent', [r.d.n, r.d.spent, r.d.off], [4, 4, 3])
  assertEq('(e) a Flare blast catching 3 bodies x 1: 3, and 3 spent', [r.e.n, r.e.spent, r.e.far], [3, 3, 0])
  assertEq('the button: 0 dim; 2 lit with no pulse; 3 ready pulses (spend3); 3 cooling shows the lit rim (spendcue); ready again pulses', r.button.map((x) => [x.text, x.cls.includes('dim') ? 'dim' : x.cls.includes('lit') ? 'lit' : '', x.spend3, x.spendcue]),
    [['0', 'dim', false, false], ['2', 'lit', false, false], ['3', 'lit', true, false], ['3', 'lit', false, true], ['3', 'lit', true, false]])
  assertEq('the digit stops at 9', [r.nine.n >= 9 ? 9 : r.nine.n, r.nine.text], [9, '9'])
  assert(r.refresh.calls <= 2 * (Math.ceil(r.refresh.secs / 0.1) + 1) && r.refresh.calls >= 2 * 15, `the count is refreshed at most once a spender per 0.1 s: ${r.refresh.calls} calls for 2 spenders over ${r.refresh.secs.toFixed(2)} s of game time (at most ${2 * (Math.ceil(r.refresh.secs / 0.1) + 1)}, at least ${2 * 15})`)
  console.log(`INFO K-M27 numbers: (a) ${r.a.n}/${r.a.spent}, (b) ${r.b.n}/${r.b.spent}, re-aim ${r.b2.n}/${r.b2.spent}, (d) ${r.d.n}/${r.d.spent}, (e) ${r.e.n}/${r.e.spent}; the digit ${r.nine.n} shows ${r.nine.text}; refresh ${r.refresh.calls} calls in ${r.refresh.secs.toFixed(2)} s`)
})

check('K-M28', RUN, async ({ page }) => {
  // the readout: the pause screen shows the core, the socket, the upgrades and "marked N . spent M" for the open depth, as the words say; bare, no block
  const r = await evalJson(page, `() => {
    (${SETUP})({ parts: ['scrap-cleaver'] })
    ${WAKE}
    W.__pause.hide()
    W.__equipRank('scrap-cleaver', 3)
    const out = {}
    const read = () => {
      W.__pause.loadout(() => W.__hud.slots, () => {})
      const b = document.querySelector('#pause .pcore')
      const o = b ? { name: b.querySelector('b').textContent, parts: [...b.querySelectorAll('span')].map((s) => s.textContent), readout: b.querySelector('em').textContent } : null
      W.__pause.hide()
      return o
    }
    out.bare = read()
    W.__core('wake')
    zero()
    out.first = read()
    // a scripted fight: 3 marks on a wall in reach and 2 on one out of it: a Cleaver cast spends the 3, the 2 are made and not spent
    const w = body(0, 1.5)
    const far = body(6, 1.5)
    W.__setMarks(idx(w), 3)
    W.__setMarks(idx(far), 2)
    place(0, 0)
    W.__fire('arms', false)
    for (let i = 0; i < 20; i++) { C.hp = 100; W.__step(1 / 60) }
    const st = last()
    out.stat = { made: st.marks.made, spent: st.marks.spent }
    out.fight = read()
    out.expected = W.__words.readout(st.marks.made, st.marks.spent, st.spends.bonus)
    W.__keystone('wake-burst')
    W.__upgrade('wake-spray')
    W.__upgrade('wake-slip')
    out.full = read()
    out.keyNames = [W.__words.keystone['wake-burst'][0], W.__words.upgrade['wake-spray'][0], W.__words.upgrade['wake-slip'][0]]
    // builds off with the core on the run: no block
    W.__builds(false)
    out.off = read()
    W.__builds(true)
    // flipped with the screen open: the block and the cards follow it (the stale-card fix)
    W.__pause.loadout(() => W.__hud.slots, () => {})
    const row = [...document.querySelectorAll('#pause .rule')].find((b) => b.textContent.startsWith('builds'))
    const dmg = () => document.querySelector('#pause .pcard .stat.changed b, #pause .pcard .stat b:nth-of-type(1)')?.textContent
    const cards = () => [...document.querySelectorAll('#pause .row.four .pcard .stats')].map((s) => s.textContent).join('|')
    out.open = { before: cards(), block: !!document.querySelector('#pause .pcore') }
    row.click()
    out.open.afterOff = cards()
    out.open.blockOff = !!document.querySelector('#pause .pcore')
    row.click()
    out.open.afterOn = cards()
    out.open.blockOn = !!document.querySelector('#pause .pcore')
    W.__pause.hide()
    return out
  }`)
  assertEq('no core: no core block under the loadout', r.bare, null)
  assertEq('a core, nothing made yet: its name, the socket empty, no upgrades, marked 0 spent 0', r.first, { name: 'Wake', parts: ['socket: empty', 'upgrades: none yet'], readout: 'marked 0 · spent 0 · +0 damage' })
  assert(r.stat.made === 5 && r.stat.spent === 3, `the scripted fight made 5 marks and spent 3 (${JSON.stringify(r.stat)})`)
  assertEq("after the fight the readout is WORDS.readout(made, spent, bonus) for the run (SHOW.md item 8: the Cleaver's 3 marks at +3 each)", [r.fight.readout, r.fight.readout], [r.expected, 'marked 5 · spent 3 · +9 damage'])
  assertEq('...with a keystone socketed and both upgrades learned, it names them', [r.full.parts[0], r.full.parts[1]], [`socket: ${r.keyNames[0]}`, `upgrades: ${r.keyNames[1]}, ${r.keyNames[2]}`])
  assertEq('builds off: no block even with the core on the run', r.off, null)
  assert(r.open.block && !r.open.blockOff && r.open.blockOn, `the switch flipped on the open screen takes the core block away and brings it back (${JSON.stringify([r.open.block, r.open.blockOff, r.open.blockOn])})`)
  assert(r.open.before !== r.open.afterOff && r.open.afterOn === r.open.before, `...and the open cards are drawn again from what is worn now: Scrap Cleaver reads its flat-temper numbers with builds on and today's with it off (known issue fixed)`)
})

check('K-M29', RUN, async ({ page }) => {
  // the log: every field, on and off; marks and spends add up; the drop records say fit and filtered; Backhand's whiffs
  const r = await evalJson(page, `() => {
    // a fresh depth entry: this check reads one depth's log from zero (the page's earlier checks left theirs behind)
    window.__core(null)
    window.__enter(1, 3)
    ;(${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'] })
    ${WAKE}
    ${SEEDED}
    W.__pause.hide()
    const out = {}
    const FIELDS = ['core', 'temperFlat', 'keystone', 'upgrades', 'movingS', 'nearBins', 'nearMovingBins', 'wallS', 'closeS', 'marks', 'spends', 'spendsPerFight', 'backhand']
    const has = () => FIELDS.filter((k) => !(k in last()))
    out.bare = JSON.parse(JSON.stringify({ missing: has(), core: last().core, marks: last().marks, spends: last().spends, spendsPerFight: last().spendsPerFight, backhand: last().backhand }))
    // Wake, a fight: marks made, spent, one run out unspent; the depth closes and the fight with it
    W.__core('wake')
    out.onMissing = has()
    const a = body(0, 1.5), b = body(6, 1.5)
    W.__setMarks(idx(a), 3)
    W.__setMarks(idx(b), 2)
    place(0, 0)
    for (let i = 0; i < 5; i++) { C.hp = 100; W.__step(1 / 60) }
    W.__fire('arms', false)
    for (let i = 0; i < 30; i++) { C.hp = 100; W.__step(1 / 60) }
    for (let i = 0; i < 60 * 4; i++) { C.hp = 100; W.__step(1 / 60) }
    const st = last()
    out.wake = { made: st.marks.made, spent: st.marks.spent, expired: st.marks.expired, hits: st.spends.hits, lag: st.spends.lag.reduce((x, y) => x + y, 0) }
    W.__enter(2, 1)
    const closed = W.__run.stats[W.__run.stats.length - 2]
    out.closed = { hits: closed.spends.hits, perFight: closed.spendsPerFight.reduce((x, y) => x + y, 0), fights: closed.fights, lens: closed.spendsPerFight.length, skims: closed.skims ?? null }
    // Ram: the shove record adds up
    W.__core('ram')
    ;(${SETUP})({ parts: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'], autos: true })
    W.__core('ram')
    W.__arena({ boxes: [{ minX: -12, maxX: 12, minZ: 3, maxZ: 4 }], auto: true })
    C.autoAttack = true
    C.autoTimer = 0
    delete C.hurtPlayer
    const h = W.__spawn('chaser', 0, 2, true)
    h.hp = 1e6
    h.speedMul = 0
    place(0, 0)
    for (let i = 0; i < 60 * 8; i++) { C.hp = 100; W.__step(1 / 60) }
    const sh = last().shoves
    out.ram = { n: sh?.n ?? 0, sum: sh ? sh.wall + sh.body + sh.still + sh.tell + sh.plain : 0, beat: sh ? sh.beat.n : 0 }
    // the drop records: with a core fit says, a filtered one says so (and fits); bare, none
    W.__loot.clear()
    W.__core('wake')
    seed(3)
    let any = 0
    try { for (let i = 0; i < 30; i++) if (W.__dropMoment(i % 2 ? 'elite' : 'plenty', -20 + i * 1.5, 12)) any++ } finally { unseed() }
    const recs = W.__run.drops.filter((d) => d.source === 'elite' || d.source === 'plenty')
    out.recs = { any, n: recs.length, withFit: recs.filter((d) => d.fit).length, filtered: recs.filter((d) => d.filtered).length, filteredNotFits: recs.filter((d) => d.filtered && d.fit === 'plain').length, keys: recs.filter((d) => d.fit === 'key').length, keysUnfiltered: recs.filter((d) => d.fit === 'key' && !d.filtered).length, kinds: [...new Set(recs.map((d) => d.fit))].sort() }
    W.__loot.clear()
    W.__core(null)
    const before = W.__run.drops.length
    W.__dropMoment('elite', 0, 14)
    W.__dropMoment('plenty', 2, 14)
    const bare = W.__run.drops.slice(before)
    out.bareRecs = { n: bare.length, fit: bare.filter((d) => 'fit' in d).length, filtered: bare.filter((d) => 'filtered' in d).length }
    // Backhand: a swing at nothing behind him is a whiff; with a body behind him it is not
    ;(${SETUP})({ parts: ['frayed-cleaver'], autos: false })
    W.__core('wake')
    zero()
    place(0, 0)
    W.__stick(0, 1)
    W.__fire('arms', false)
    for (let i = 0; i < 3; i++) { C.hp = 100; W.__step(1 / 60) }
    out.whiff1 = { ...last().backhand }
    const e = body(0, -1.5)
    W.__hud.devCool('arms', 0)
    for (let i = 0; i < 60; i++) { C.hp = 100; W.__step(1 / 60) }
    W.__stick(0, 1)
    place(0, 0)
    e.pos.set(0, 0, -1.5)
    W.__fire('arms', false)
    for (let i = 0; i < 3; i++) { C.hp = 100; W.__step(1 / 60) }
    W.__stick(0, 0)
    out.whiff2 = { ...last().backhand }
    return out
  }`)
  assertEq('bare: every logged field is there, as zeros', [r.bare.missing, r.bare.core, r.bare.marks, r.bare.spends, r.bare.spendsPerFight, r.bare.backhand], [[], null, { made: 0, byCore: 0, byPart: 0, spent: 0, expired: 0 }, { hits: 0, bonus: 0, lag: [0, 0, 0, 0] }, [], { casts: 0, whiffs: 0 }])
  assertEq('with a core worn: every field is there', r.onMissing, [])
  assert(r.wake.made === 5 && r.wake.spent === 3 && r.wake.expired === 2 && r.wake.spent + r.wake.expired <= r.wake.made, `marks: made 5, spent 3 by one cast, 2 run out unspent: spent + expired <= made (${JSON.stringify(r.wake)})`)
  assertEq('spends: one spending hit, in the lag bins', [r.wake.hits, r.wake.lag], [1, 1])
  assertEq('the depth closed: spends.hits equals the sum of spendsPerFight', [r.closed.hits, r.closed.perFight], [1, 1])
  assertEq('...and spendsPerFight has one number per fight closed', r.closed.lens, r.closed.fights)
  assert(r.ram.n > 0 && r.ram.sum === r.ram.n, `Ram's shoves add up: wall + body + still + tell + plain = n (${JSON.stringify(r.ram)})`)
  assertEq('drop records: every moment drop with a core carries fit (fits, plain or key); a filtered one is a fit or a key, never plain; a key is always filtered', [r.recs.n === r.recs.any, r.recs.withFit === r.recs.n, r.recs.filtered > 0, r.recs.filteredNotFits, r.recs.keysUnfiltered], [true, true, true, 0, 0])
  assert(r.recs.keys > 0, 'the thirty moment drops include a keystone (a fit "key" record)')
  assertEq('bare: the drop records carry no fit and no filtered', r.bareRecs, { n: 2, fit: 0, filtered: 0 })
  assertEq("Backhand with nothing behind him: one cast, one whiff; with a body behind him: two casts, still one whiff", [r.whiff1, r.whiff2], [{ casts: 1, whiffs: 1 }, { casts: 2, whiffs: 1 }])
})


check('K-M30', RUN, async ({ page }) => {
  // the frame budget: draw calls whatever the marked bodies, nothing created after the build, drawMarks cheap
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    const calls = () => { W.__markFx.draw(C, 0, 0, 0); W.__world.render(); return W.__world.renderer.info.render.calls }
    const children = () => W.__world.scene.children.length
    // what the marks own: their meshes' geometries and the one material, by identity (the walls' own tells come and go in the scene and are not the marks')
    const info = () => W.__markFx.group.children.map((c) => c.geometry.uuid + c.material.uuid).join()
    // Ram's run has the autos off: its slams draw floor rings of their own (combat.ring), which would come and go in the scene count; this check is about the marks'
    const run = (key, core = 'wake') => {
      (${SETUP})({ autos: core === 'wake' })
      W.__core(core)
      W.__keystone(key)
      const ws = []
      for (let k = 0; k < 40; k++) ws.push(body((k % 8 - 3.5) * 1.8, -8 + Math.floor(k / 8) * 1.8 - 6 + 10))
      calls()
      const c0 = calls()
      const kids0 = children()
      const inf0 = info()
      for (const w of ws) W.__setMarks(idx(w), key ? 5 : 3)
      const c40 = calls()
      // 10 s of churn: marks made, spent and run out, bodies and rings coming and going
      for (let s = 0; s < 10; s++) {
        for (let k = 0; k < 40; k++) if ((k + s) % 3 === 0) W.__setMarks(idx(ws[k]), 1)
        pinFor(0, 0, 1.0)
        W.__markFx.draw(C, 1 / 60, 0, 0)
      }
      const kids1 = children()
      const inf1 = info()
      for (const w of ws) W.__setMarks(idx(w), key ? 5 : 3)
      // drawMarks with 40 bodies x 3 (x 5): 1000 calls in batches of 100, the median batch's per-call time
      const per = []
      for (let b = 0; b < 10; b++) {
        const t0 = performance.now()
        for (let i = 0; i < 100; i++) W.__markFx.draw(C, 0, 0, 0)
        per.push((performance.now() - t0) / 100)
      }
      per.sort((a, b) => a - b)
      return { c0, c40, kids0, kids1, inf0, inf1, median: per[5], best: per[0], worst: per[9], drawn: W.__markFx.drawn, marked: W.__coreMarks().length }
    }
    out.plain = run(null)
    out.deep = run('wake-deep')
    out.ram = run(null, 'ram')
    out.thorns = run(null, 'thorns')
    out.tether = run(null, 'tether')
    return out
  }`)
  for (const [what, x, max] of [['3 segments', r.plain, 3], ['Deep (5 segments)', r.deep, 5], ['Ram (cracked, 3 segments)', r.ram, 3], ['Thorns (spiked ring, one instanced mesh)', r.thorns, 1], ['Tether (hooked ring, one instanced mesh)', r.tether, 1]]) {
    assertEq(`${what}: 40 marked bodies drawn`, [x.drawn, x.marked], [40, 40])
    assert(x.c40 - x.c0 <= max && x.c40 - x.c0 >= 0, `${what}: draw calls ${x.c0} with no marks, ${x.c40} with 40 marked bodies: +${x.c40 - x.c0} (at most ${max})`)
    assertEq(`${what}: the scene's child count is equal before and after 10 s of churn, and the marks' own meshes, geometries and material are the very ones made at the start`, [x.kids1, x.inf1], [x.kids0, x.inf0])
    assert(x.median <= 0.25, `${what}: drawMarks with 40 bodies, median ${x.median.toFixed(4)} ms over 1000 calls (best batch ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)}); at most 0.25`)
    console.log(`INFO K-M30 ${what}: calls ${x.c0} -> ${x.c40} (+${x.c40 - x.c0}), scene children ${x.kids0} -> ${x.kids1}, drawMarks 40 bodies median ${x.median.toFixed(4)} ms (best ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)})`)
  }
})

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// B6b (design/buildlayer/WAKE2.md): frostbite and the trail's frost. The skim suites above mute both (WAKE's isolate); these two unmute them.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

check('K-M31', RUN, async ({ page }) => {
  // frostbite: a frosted body takes 1 every 0.5 s of combat time through the auto path (a boss's half), flat in the count, never spends or marks, and stops when the marks go
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    isolate(false)
    W.__core('wake')
    zero()
    const out = {}
    const b = body(0, 6)
    place(0, 0)
    W.__setMarks(idx(b), 1)
    const hp = (e) => 1e6 - e.hp
    const t0 = C.time
    const log = []
    for (let i = 0; i < 60 * 2.9; i++) { C.hp = 100; W.__step(1 / 60); if (hp(b) > (log.at(-1)?.hp ?? 0)) log.push({ t: +(C.time - t0).toFixed(3), hp: hp(b) }) }
    out.one = { log, made: last().marks.made, spent: last().marks.spent, bite: last().skims?.bite ?? 0, nominal: last().autoDmg.core, real: last().autoDmgReal.core, n: marks(b).n }
    // after the marks ran out (3 s): no more
    const before = hp(b)
    for (let i = 0; i < 60 * 2; i++) { C.hp = 100; W.__step(1 / 60) }
    out.after = { n: marks(b).n, more: hp(b) - before, made: last().marks.made }
    // flat in the count: 3 marks bite the same 1
    const c = body(6, 6)
    place(0, 0)
    W.__setMarks(idx(c), 3)
    const c0 = hp(c)
    for (let i = 0; i < 60 * 1.01; i++) { C.hp = 100; W.__step(1 / 60) }
    out.three = hp(c) - c0
    // stops the tick the marks are spent: a cast of the cleaver on 3 marks, then no bite
    W.__emptyLevel()
    const d = body(0, 1.5)
    place(0, 0)
    W.__setMarks(idx(d), 3)
    for (let i = 0; i < 20; i++) { C.hp = 100; W.__step(1 / 60) }
    const bit = hp(d)
    W.__fire('arms', false)
    for (let i = 0; i < 40; i++) { C.hp = 100; W.__step(1 / 60) }
    const afterSpend = hp(d)
    for (let i = 0; i < 90; i++) { C.hp = 100; W.__step(1 / 60) }
    out.spent = { n: marks(d).n, drop: afterSpend - bit, laterBite: hp(d) - afterSpend, spends: spendsOf().length }
    // a boss takes the autos' half
    W.__emptyLevel()
    const boss = W.__spawn('boss', 8, 8, true)
    boss.speedMul = 0
    place(0, 0)
    W.__setMarks(idx(boss), 1)
    const h0 = boss.hp
    for (let i = 0; i < 60 * 1.01; i++) { C.hp = 100; W.__step(1 / 60) }
    out.boss = h0 - boss.hp
    return out
  }`)
  assertEq('a frosted wall: bitten 1 every 0.5 s from half a second after the mark (5 bites by 2.9 s, the marks last 3 s)', r.one.log.map((x) => [Math.round(x.t * 2) / 2, x.hp]), [[0.5, 1], [1, 2], [1.5, 3], [2, 4], [2.5, 5]])
  assertEq('...the bite never marks or spends: 1 mark made, 0 spent; logged as skims.bite 5 and in the nominal and real core damage', [r.one.made, r.one.spent, r.one.bite, r.one.nominal, r.one.real], [1, 0, 5, 5, 5])
  assertEq('...after the marks ran out: none, and no further bite', [r.after.n, r.after.more, r.after.made], [0, 0, 1])
  assertEq('3 marks bite the same 1 a half second (2 in the first second, not 6)', r.three, 2)
  assertEq('a cast that spends the marks ends the bite: 3 marks gone, the later bites 0', [r.spent.n, r.spent.laterBite, r.spent.spends], [0, 0, 1])
  assertEq("a boss takes the autos' half of the bite (0.5 x 2 in a second)", r.boss, 1)
})

check('K-M32', RUN, async ({ page }) => {
  // the trail frosts: a body whose edge is within 0.25 u of a live segment gets a mark by the core, no damage, once a second; cleared by a jump, and when Wake is off
  const r = await evalJson(page, `() => {
    (${SETUP})({ autos: true })
    ${WAKE}
    isolate(false)
    // the bite would hurt: this suite reads the mark alone
    W.__cores.wake.bite.everyS = 1e9
    W.__core('wake')
    zero()
    const out = {}
    // a trail 5 u long up the z axis, then he stops; a wall dropped beside it with its edge 0.15 u off the line, one with its edge 0.35 u off
    go(0, 1, 1)
    out.trailN = C.trailN
    const inside = body(0.55 + 0.15, 2)
    const outside = body(-(0.55 + 0.35), 3)
    W.__partLog.length = 0
    W.__step(1 / 60)
    out.inside = marks(inside).n
    out.outside = marks(outside).n
    out.ev = ev('trailFrost').length
    out.skimEv = ev('skim').length
    out.by = ev('mark').map((x) => x.by)
    out.hurt = [1e6 - inside.hp, 1e6 - outside.hp]
    // the trail has no Burst or Spray: it is a mark, nothing else; a second mark needs a second
    for (let i = 0; i < 10; i++) { C.hp = 100; W.__step(1 / 60) }
    out.again = ev('trailFrost').length
    // a jump cuts it
    place(0, 20)
    W.__step(1 / 60)
    out.cut = C.trailN
    // Ram wears no trail
    go(0, 1, 0.5)
    const had = C.trailN
    W.__core('ram')
    C.autoAttack = true
    for (let i = 0; i < 3; i++) { C.hp = 100; W.__step(1 / 60) }
    out.ram = [had > 0, C.trailN]
    return out
  }`)
  assert(r.trailN >= 20, `1 s of walking leaves a trail (${r.trailN} points, a point every 0.15 u)`)
  assertEq('a body with its edge 0.15 u off the trail is frosted (1 mark, by the core, an event), one 0.35 u off is not', [r.inside, r.outside, r.ev, r.by], [1, 0, 1, ['core']])
  assertEq('...no damage from the trail itself, and no skim (he stood still)', [r.hurt, r.skimEv], [[0, 0], 0])
  assertEq('...once a second per body: no second trail mark within 0.17 s', r.again, 1)
  assertEq('a jump (a dash or a placement) cuts the trail', r.cut, 0)
  assertEq('with Ram worn the trail is cleared and stays so', r.ram, [true, 0])
})


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// N3: Thorns (design/buildlayer/THORNS.md), in Graze's place. K-M33 the rule, one hit at a time: a melee hit that lands (8 and 2 marks to the attacker), a shot that lands (1 mark, no damage), a hit a guard stops (Ward, Mirror
// Ward, Brace, Anvil: 8 and 3 marks), Hardened (x0.85 with Thorns worn, and only then), the hits that give nothing (a wave, a hazard, no attacker, a hit folded into the hurt window), Bramble, Spite, Backlash, Bramble Patch,
// the cores that are not Thorns, and the draw calls.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

check('K-M33', RUN, async ({ page }) => {
  const r = await evalJson(page, `() => {
    ${HELPERS}
    const V = W.__still.pos.constructor
    const out = {}
    const boot = (core, o = {}) => {
      (${SETUP})({ autos: true, parts: o.parts })
      W.__core(core)
      if (o.keystone) W.__keystone(o.keystone)
      if (o.upgrade) W.__upgrade(o.upgrade)
      W.__arena()
      C.pressure = false
      C.autoAttack = false
      C.hurtCooldown = 0
      W.__still.pos.set(0, 0, 0)
      C.hasPrev = false
      W.__partLog.length = 0
      W.__step(1 / 60)
      W.__partLog.length = 0
    }
    /** a body that stays where it is, whole: speedMul 0, a million HP */
    const body = (x, z, o = {}) => { const e = W.__spawn(o.kind ?? 'chaser', x, z, true); e.hp = 1e6; e.speedMul = 0; return e }
    /** what thorns said: [how, blocked, dmg, marks, others] */
    const th = () => ev('thorns').map((x) => [x.how, x.blocked, x.dmg, x.marks, x.others])
    /** one hurtPlayer call, the hurt window open to it: HP lost, thorns said, the attacker's marks and the HP it lost */
    const hurt = (e, dmg, src, withFrom = true) => {
      C.hurtCooldown = 0
      C.hp = 100
      C.hurtPlayer(dmg, src, withFrom ? e : undefined)
      return { lost: 100 - C.hp, th: th(), marks: e ? marks(e).n : 0, dealt: e ? 1e6 - e.hp : 0 }
    }
    // --- a hit that lands: 8 and 2 marks to the attacker, and Hardened (20 -> 17, 8 -> 7), a shot, a wave and a hazard
    boot('thorns')
    let e = body(0, 2)
    out.melee = hurt(e, 20, 'melee')
    boot('thorns'); e = body(0, 2)
    out.melee8 = hurt(e, 8, 'melee')
    boot('thorns'); e = body(0, 2)
    out.min = hurt(e, 1, 'wave', false)
    boot('thorns'); e = body(0, 2)
    out.wave = hurt(e, 20, 'wave', false)
    boot('thorns'); e = body(0, 2)
    out.hazard = hurt(e, 20, 'hazard')
    boot('thorns'); e = body(0, 2)
    out.noFrom = hurt(e, 20, 'melee', false)
    // a hit folded into the hurt window (smaller than the one before) does not hurt him, so it gives nothing
    boot('thorns'); e = body(0, 2)
    hurt(e, 20, 'melee')
    C.hp = 100
    C.hurtPlayer(10, 'melee', e)
    out.folded = { lost: 100 - C.hp, th: th().length, marks: marks(e).n }
    // with no Thorns: Wake, Ram, Tether and bare take the whole 20, and nothing is given
    for (const core of ['wake', 'ram', 'tether', null]) {
      boot(core); e = body(0, 2)
      out['no_' + core] = hurt(e, 20, 'melee')
    }
    // --- a shot that lands: its owner gets 1 mark and no damage; he takes 17 of 20
    const shot = (core, lat, o = {}) => {
      boot(core, o)
      const owner = body(-9, 0, { kind: 'ranged' })
      if (o.fire) W.__fire(o.fire)
      C.fireShot(new V(-9, 0, lat), new V(1, 0, 0), 20, owner)
      let lost = 0
      for (let i = 0; i < 90; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); W.__step(1 / 60); lost += 100 - C.hp }
      return { th: th(), marks: marks(owner).n, dealt: 1e6 - owner.hp, lost, strain: ev('strain').length, shield: ev('shield').map((x) => x.reflected) }
    }
    out.shot = shot('thorns', 0.4)
    out.shotMiss = shot('thorns', 2.0)
    // --- a hit a guard stops: 8 and 3 marks. Ward (a shot), Mirror Ward (a shot, sent home), Brace (a melee hit), Anvil (a melee hit, caught)
    out.ward = shot('thorns', 0.4, { parts: ['focusing-lens', 'ward', 'scrap-cleaver', 'kickstart'], fire: 'torso' })
    out.mirror = shot('thorns', 0.4, { parts: ['focusing-lens', 'mirror-ward', 'scrap-cleaver', 'kickstart'], fire: 'torso' })
    boot('thorns', { parts: ['focusing-lens', 'brace', 'scrap-cleaver', 'kickstart'] }); W.__fire('torso'); e = body(0, 2)
    out.brace = hurt(e, 20, 'melee')
    out.braceStrain = ev('strain').length
    boot('thorns', { parts: ['focusing-lens', 'pressure-vent', 'anvil', 'kickstart'] }); W.__fire('arms'); e = body(0, 2)
    out.anvil = hurt(e, 20, 'melee')
    out.anvilCaught = ev('catch').length
    // a Ward turning a shot away, with no core: nothing is given (Wake's Ward, bare)
    out.wardWake = shot('wake', 0.4, { parts: ['focusing-lens', 'ward', 'scrap-cleaver', 'kickstart'], fire: 'torso' })
    // --- Bramble: a hit taken marks the others within 2.0 of Still, one at 1.8 and one at 6
    boot('thorns', { keystone: 'thorns-bramble' }); e = body(0, 2)
    const near = body(1.0, -1.5), far = body(6, -1.5)
    out.bramble = { ...hurt(e, 20, 'melee'), near: marks(near).n, far: marks(far).n }
    boot('thorns'); e = body(0, 2)
    const near2 = body(1.0, -1.5)
    out.noBramble = { th: hurt(e, 20, 'melee').th, near: marks(near2).n }
    // --- Spite: a hit from a body that can't be moved gives 3 marks and the core hit is x2 (and whole); without it, 2 marks and 8
    boot('thorns', { keystone: 'thorns-spite' }); e = body(0, 2); e.knockMul = 0
    out.spite = hurt(e, 20, 'melee')
    boot('thorns', { keystone: 'thorns-spite' }); e = body(0, 2)
    out.spiteMovable = hurt(e, 20, 'melee')
    boot('thorns'); e = body(0, 2); e.knockMul = 0
    out.heavy = hurt(e, 20, 'melee')
    // --- Backlash: any hit taken or blocked shoves the attacker, away from him
    boot('thorns', { upgrade: 'thorns-backlash' }); e = body(0, 2)
    hurt(e, 20, 'melee')
    out.backlash = { z: e.knock.z > 0, x: Math.abs(e.knock.x) < 1e-6 }
    boot('thorns'); e = body(0, 2)
    hurt(e, 20, 'melee')
    out.noBacklash = Math.hypot(e.knock.x, e.knock.z)
    boot('thorns', { upgrade: 'thorns-backlash', parts: ['focusing-lens', 'brace', 'scrap-cleaver', 'kickstart'] }); W.__fire('torso'); e = body(0, 2)
    hurt(e, 20, 'melee')
    out.backlashBlock = e.knock.z > 0
    // --- Bramble Patch: a hit taken leaves a patch at his feet (1.5 u, 2 s); a body entering gets 1 mark, once; one outside, none; a block leaves none
    boot('thorns', { upgrade: 'thorns-patch' }); e = body(0, 2)
    const inside = body(0.8, 0.8), outside = body(-4, 0), late = body(-6, 0)
    hurt(e, 20, 'melee')
    out.patchMade = { n: C.patches.length, at: [C.patches[0].x, C.patches[0].z] }
    // he steps off to the side (out of every strike's reach), the patch stays where it fell
    const away = (s) => { for (let i = 0; i < Math.round(s * 60); i++) { C.hp = 100; W.__still.pos.set(3.6, 0, 0); W.__step(1 / 60) } }
    W.__partLog.length = 0
    away(0.1)
    out.patchIn = { inside: marks(inside).n, outside: marks(outside).n }
    away(0.5)
    late.pos.set(-0.5, 0, 0.5)
    away(0.1)
    out.patchLate = marks(late).n
    away(0.8)
    out.patchOnce = marks(inside).n
    out.patchStill = C.patches.length
    away(0.7)
    out.patchGone = C.patches.length
    boot('thorns', { upgrade: 'thorns-patch', parts: ['focusing-lens', 'brace', 'scrap-cleaver', 'kickstart'] }); W.__fire('torso'); e = body(0, 2)
    hurt(e, 20, 'melee')
    out.patchBlocked = C.patches.length
    boot('wake', { upgrade: 'thorns-patch' }); e = body(0, 2)
    hurt(e, 20, 'melee')
    out.patchWake = C.patches.length
    // --- the draw calls: the ring is markfx's one, the armed ring and the patches thornfx's one: at most +2 over the same scene with no core
    {
      const calls = () => { W.__thornFx.update(C.core === 'thorns', 1 / 60, C, 0, 0); W.__markFx.draw(C, 0, 0, 0); W.__world.render(); return W.__world.renderer.info.render.calls }
      boot('thorns', { upgrade: 'thorns-patch' })
      const ws = []
      for (let i = 0; i < 6; i++) ws.push(body(8 + i, 8))
      for (let i = 0; i < 4; i++) { W.__still.pos.set(i * 2, 0, 0); C.lastPlayer.set(i * 2, 0, 0); C.hurtCooldown = 0; C.hurtPlayer(20, 'melee', ws[i]) }
      W.__still.pos.set(0, 0, 0)
      for (const w of ws) W.__setMarks(idx(w), 3)
      calls()
      const c1 = calls()
      const drawn = W.__thornFx.drawn, patches = C.patches.length
      const meshes = W.__world.scene.children.filter((c) => c.name === 'thorns-ring').length
      W.__core(null)
      calls()
      const c0 = calls()
      out.draw = { c0, c1, drawn, patches, meshes }
      boot('wake')
      calls()
      out.drawWake = W.__thornFx.drawn
    }
    return out
  }`)
  if (process.env.DEBUG33) console.log(JSON.stringify(r))
  // a hit that lands
  assertEq('a melee hit lands for 20: Hardened takes it to 17; the attacker takes 8 and 2 marks, and thorns says (melee, not blocked, 8, 2, 0 others)', [r.melee.lost, r.melee.dealt, r.melee.marks, r.melee.th], [17, 8, 2, [['melee', false, 8, 2, 0]]])
  assertEq('...Hardened rounds to whole points: 8 -> 7; and never below 1: a wave of 1 -> 1', [r.melee8.lost, r.min.lost], [7, 1])
  assertEq('a wave takes the armor (20 -> 17) and gives nothing; a hazard with an owner the same; a hit with no attacker the same', [[r.wave.lost, r.wave.th, r.wave.marks], [r.hazard.lost, r.hazard.th, r.hazard.marks, r.hazard.dealt], [r.noFrom.lost, r.noFrom.th]], [[17, [], 0], [17, [], 0, 0], [17, []]])
  assertEq('a hit folded into the hurt window (smaller than the last) does not hurt him and gives nothing more: no extra event, the attacker has its 2 marks', [r.folded.lost, r.folded.th, r.folded.marks], [0, 1, 2])
  assertEq('no Thorns, no armor and no barbs: Wake, Ram, Tether and bare take the whole 20 and give nothing', ['wake', 'ram', 'tether', null].map((c) => { const x = r['no_' + c]; return [x.lost, x.th, x.marks, x.dealt] }), [[20, [], 0, 0], [20, [], 0, 0], [20, [], 0, 0], [20, [], 0, 0]])
  // a shot
  assertEq('a shot that lands (20): he takes 17; its owner gets 1 mark and no damage; thorns says (shot, not blocked, 0, 1)', [r.shot.lost, r.shot.marks, r.shot.dealt, r.shot.th], [17, 1, 0, [['shot', false, 0, 1, 0]]])
  assertEq('a shot that misses him gives nothing', [r.shotMiss.lost, r.shotMiss.marks, r.shotMiss.th], [0, 0, []])
  // blocked
  assertEq('Ward stops a shot: no HP lost, the owner takes 8 and 3 marks (the block\'s), and thorns says so', [r.ward.lost, r.ward.marks, r.ward.dealt, r.ward.th, r.ward.shield], [0, 3, 8, [['shot', true, 8, 3, 0]], [false]])
  assertEq('Mirror Ward sends a shot home: no HP lost, the owner takes the 8 and 3 marks, and the reflected bolt as well (its own damage on top)', [r.mirror.lost, r.mirror.marks, r.mirror.th, r.mirror.shield, r.mirror.dealt > 8], [0, 3, [['shot', true, 8, 3, 0]], [true], true])
  assertEq('Brace turns a melee hit to strain: no HP lost, the attacker takes 8 and 3 marks', [r.brace.lost, r.braceStrain, r.brace.dealt, r.brace.marks, r.brace.th], [0, 1, 8, 3, [['melee', true, 8, 3, 0]]])
  assertEq("Anvil's catch is a block: no HP lost, the hammer lands on the attacker (30 and more), then the barbs (8 and 3 marks, after the hammer)", [r.anvil.lost, r.anvilCaught, r.anvil.dealt >= 38, r.anvil.marks, r.anvil.th], [0, 1, true, 3, [['melee', true, 8, 3, 0]]])
  assertEq('with Wake worn, a Ward turns the shot and gives nothing', [r.wardWake.lost, r.wardWake.marks, r.wardWake.dealt, r.wardWake.th], [0, 0, 0, []])
  // keystones
  assertEq('Bramble: a hit taken also gives 1 mark to the body 1.8 u off and none to the one 6 u off (others: 1); without it, none', [r.bramble.th, r.bramble.near, r.bramble.far, r.noBramble.th.map((x) => x[4]), r.noBramble.near], [[['melee', false, 8, 2, 1]], 1, 0, [0], 0])
  assertEq("Spite: a hit from a body that can't be moved gives 3 marks and the core hit x2 (16); on one that can be moved it does not change; with no Spite that body gives 2 and 8", [[r.spite.marks, r.spite.dealt, r.spite.th], [r.spiteMovable.marks, r.spiteMovable.dealt], [r.heavy.marks, r.heavy.dealt]], [[3, 16, [['melee', false, 16, 3, 0]]], [2, 8], [2, 8]])
  // upgrades
  assertEq('Backlash: a hit taken shoves the attacker away from him (along +z, none sideways), and a blocked one does too; without it, no shove', [r.backlash, r.backlashBlock, r.noBacklash], [{ z: true, x: true }, true, 0])
  assertEq('Bramble Patch: a hit taken leaves one patch where he stood (0, 0)', [r.patchMade.n, r.patchMade.at], [1, [0, 0]])
  assertEq('...a body inside gets 1 mark at once, one outside none; one that walks in later gets its 1; the first is never marked twice; the patch is still there after 1.5 s and gone after 2', [r.patchIn, r.patchLate, r.patchOnce, r.patchStill, r.patchGone], [{ inside: 1, outside: 0 }, 1, 1, 1, 0])
  assertEq('...a blocked hit leaves no patch; with Wake worn (the upgrade is not its) none', [r.patchBlocked, r.patchWake], [0, 0])
  // draw calls
  assert(r.draw.meshes === 1 && r.draw.drawn === 1 + r.draw.patches && r.draw.patches === 4 && r.drawWake === 0, `the armed ring and four patches are one mesh of ${r.draw.drawn} instances (with Wake worn: ${r.drawWake})`)
  assert(r.draw.c1 - r.draw.c0 <= 2, `Thorns at peak: draw calls ${r.draw.c0} bare, ${r.draw.c1} with the armed ring, four patches and marked bodies: +${r.draw.c1 - r.draw.c0} (at most 2: the ring, the marks' ring)`)
  console.log(`INFO K-M33 draw calls: bare ${r.draw.c0}, Thorns with four patches and marks ${r.draw.c1} (+${r.draw.c1 - r.draw.c0})`)
})


// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// N2: Tether (design/buildlayer/CORES2.md §2). K-M34 the rule: the hook (nearest, 3 to 9 u, in line of sight), the breaks, the sweep (a crossing is a FLIP of the body's side inside the segment: a body lying along the wire never flips,
// so running straight away earns nothing, and circling does), the once-per-body gap, the anchor's tick, Snag, Taut, Second Line, Whip, a lens spending the marks, and the draw calls.
// ---------------------------------------------------------------------------------------------------------------------------------------------------------------

check('K-M34', RUN, async ({ page }) => {
  const r = await evalJson(page, `() => {
    ${HELPERS}
    const out = {}
    const boot = (o = {}) => {
      (${SETUP})({ autos: true, parts: o.parts })
      W.__core('tether')
      if (o.keystone) W.__keystone(o.keystone)
      for (const u of o.upgrades ?? []) W.__upgrade(u)
      W.__arena({ boxes: o.boxes ?? [], auto: true })
      delete C.hurtPlayer
      C.time = 0
      C.pressure = false
      C.counters = false
      C.autoAttack = true
      C.autoTimer = 0
      W.__stick(0, 0)
      W.__fx()
      W.__still.pos.set(0, 0, 0)
      C.hasPrev = false
      W.__partLog.length = 0
      delete last().tether
    }
    const hulk = (x, z, hp = 1e6) => wall(hp, x, z)
    const hp = (e) => 1e6 - e.hp
    const tv = (what) => ev('tether').filter((x) => x.what === what)
    const pinTo = (x, z) => { C.hp = 100; W.__still.pos.set(x, 0, z); W.__step(1 / 60) }
    const arc = (cx, cz, rad, a0, a1, s) => { const n = Math.max(1, Math.round(s * 60)); for (let i = 1; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pinTo(cx + Math.cos(a) * rad, cz + Math.sin(a) * rad) } }
    const at = (cx, cz, rad, a) => ({ x: cx + Math.cos(a) * rad, z: cz + Math.sin(a) * rad })
    const crossings = () => tv('cross').map((x) => ({ wire: x.wire, u: +x.u.toFixed(3), dmg: x.dmg, snag: !!x.snag }))

    // --- the hook
    boot()
    let a = hulk(5, 0)
    tick()
    out.hook = { up: C.wires[0].e === a, marks: marks(a).n, hooks: tv('hook').length, second: C.wires[1].e === null }
    boot(); hulk(0, 2.0); hulk(0, -10); secs(0.3)
    out.none = { up: !!C.wires[0].e, marks: [...C.enemies].map((e) => marks(e).n) }
    boot(); hulk(0, 7); const near = hulk(4, 0); tick()
    out.nearest = C.wires[0].e === near
    boot({ boxes: [{ minX: -12, maxX: 12, minZ: 2, maxZ: 3 }] }); hulk(0, 6); secs(0.3)
    out.walled = !!C.wires[0].e
    // --- the breaks
    boot(); a = hulk(5, 0); tick(); a.hit(1e9); tick()
    const gone = tv('break').map((x) => x.why)
    const b2 = hulk(0, -6)
    let reT = null, tBreak = C.time
    for (let i = 0; i < 60 && reT === null; i++) { tick(); if (C.wires[0].e === b2) reT = C.time - tBreak }
    out.dead = { why: gone, down: C.wires[0].e === b2, rehookAfter: reT }
    boot(); a = hulk(9, 0); tick(); const up9 = C.wires[0].e === a; a.pos.set(10.5, 0, 0); tick()
    out.range = { up9, why: tv('break').map((x) => x.why), down: !C.wires[0].e }
    for (const key of [null, 'tether-taut']) {
      boot({ keystone: key })
      const boss = W.__spawn('boss', 0, 8, true); boss.speedMul = 0
      tick()
      const upB = C.wires[0].e === boss
      boss.pos.set(0, 0, 12); tick()
      out[key ? 'bossTaut' : 'bossPlain'] = { up: upB, held: C.wires[0].e === boss, why: tv('break').map((x) => x.why) }
    }
    boot({ boxes: [{ minX: 3, maxX: 4, minZ: -1, maxZ: 1 }], upgrades: ['tether-whip'] })
    a = hulk(5, 4); tick()
    const upL = C.wires[0].e === a
    a.pos.set(7, 0, 0)
    let nLos = null
    for (let i = 1; i <= 40 && nLos === null; i++) { tick(); if (!C.wires[0].e) nLos = i }
    out.los = { up: upL, ticks: nLos, why: tv('break').map((x) => x.why), whip: tv('break').map((x) => x.whip) }

    // --- the sweep. Still circles the anchor A at the middle, 5 u off; B is 3 u from it on the 20 degree spoke, so the wire crosses B once at 20 degrees; C stands on the far side of A, where the wire ends
    const PHI = Math.PI / 9
    const setup = (o = {}) => {
      boot(o)
      const A = hulk(0, 0)
      const B = hulk(Math.cos(PHI) * 3, Math.sin(PHI) * 3)
      const D = hulk(Math.cos(PHI + Math.PI) * 3, Math.sin(PHI + Math.PI) * 3)
      const s0 = at(0, 0, 5, Math.PI)
      W.__still.pos.set(s0.x, 0, s0.z); C.hasPrev = false
      pinTo(s0.x, s0.z)
      return { A, B, D }
    }
    {
      const { A, B, D } = setup()
      const first = C.wires[0].e === A
      arc(0, 0, 5, Math.PI, -Math.PI / 3, 4)
      out.circle = { first, still: C.wires[0].e === A, cross: crossings(), bMarks: marks(B).n, bHp: hp(B), dMarks: marks(D).n, dHp: hp(D), aMarks: marks(A).n, log: last().tether }
    }
    {
      // the same circle with the reach gate shut (a body's edge must be within reach of the wire): nothing
      const T = W.__cores.tether
      const reach = T.reach
      T.reach = -1
      const { B } = setup()
      arc(0, 0, 5, Math.PI, -Math.PI / 3, 4)
      T.reach = reach
      out.noReach = { cross: crossings().length, bMarks: marks(B).n }
    }
    {
      // once per body per 0.5 s: a cross, two quick re-crosses (blocked), a wait of 0.3 s, a cross again (counts)
      const { B } = setup()
      arc(0, 0, 5, Math.PI, 0.2, 3)
      const c1 = crossings().length
      const t1 = C.time
      arc(0, 0, 5, 0.2, 0.5, 0.1)
      arc(0, 0, 5, 0.5, 0.2, 0.1)
      const c2 = crossings().length
      const pause = C.time - t1
      for (let i = 0; i < 18; i++) pinTo(at(0, 0, 5, 0.2).x, at(0, 0, 5, 0.2).z)
      arc(0, 0, 5, 0.2, 0.5, 0.1)
      out.gap = { c1, c2, c3: crossings().length, sinceFirst: +(C.time - t1).toFixed(2), blockedAt: +pause.toFixed(2), bMarks: marks(B).n }
    }
    {
      // a body that follows him along the wire never flips: he walks straight away from the anchor (6 to 9 u) and two bodies keep their places in front of him, one each side of the wire
      boot(); const A = hulk(6, 0)
      const f1 = hulk(1.5, 0.5), f2 = hulk(2.4, -0.5)
      tick()
      const first = C.wires[0].e === A
      for (let i = 1; i <= 120; i++) {
        const x = -3 * (i / 120)
        f1.pos.set(x + 2.0, 0, 0.5); f2.pos.set(x + 2.8, 0, -0.5)
        pinTo(x, 0)
      }
      out.follow = { first, up: C.wires[0].e === A, cross: crossings().length, marks: [marks(f1).n, marks(f2).n], len: Math.hypot(A.pos.x - W.__still.pos.x, A.pos.z - W.__still.pos.z) }
    }
    {
      // the same two bodies, and he circles the anchor instead: both are crossed
      boot(); const A = hulk(0, 0)
      const f1 = hulk(Math.cos(0.5) * 3, Math.sin(0.5) * 3), f2 = hulk(Math.cos(1.2) * 2, Math.sin(1.2) * 2)
      const s0 = at(0, 0, 5, Math.PI); W.__still.pos.set(s0.x, 0, s0.z); C.hasPrev = false; pinTo(s0.x, s0.z)
      arc(0, 0, 5, Math.PI, 0, 4)
      out.circleTwo = { cross: crossings().length, marks: [marks(f1).n, marks(f2).n] }
    }
    // --- the anchor's tick
    boot(); a = hulk(5, 0); secs(3.1)
    out.anchor = { ticks: tv('anchor').length, dmg: tv('anchor').map((x) => x.dmg), hp: hp(a), marks: marks(a).n, log: last().tether }
    for (const key of [null, 'tether-taut']) {
      boot({ keystone: key })
      const boss = W.__spawn('boss', 0, 6, true); boss.speedMul = 0
      secs(3.1)
      out[key ? 'tautTicks' : 'plainTicks'] = tv('anchor').length
    }
    // --- Snag
    {
      const { B } = setup({ keystone: 'tether-snag' })
      B.speedMul = 1e-4
      arc(0, 0, 5, Math.PI, 0, 4)
      const slowed = B.speedMul / 1e-4
      const snag = crossings().map((x) => x.snag)
      for (let i = 0; i < 66; i++) pinTo(at(0, 0, 5, 0).x, at(0, 0, 5, 0).z)
      out.snag = { slowed: +slowed.toFixed(3), snag, after: +(B.speedMul / 1e-4).toFixed(3) }
    }
    {
      const { B } = setup()
      B.speedMul = 1e-4
      arc(0, 0, 5, Math.PI, 0, 4)
      out.noSnag = +(B.speedMul / 1e-4).toFixed(3)
    }
    // --- Whip
    for (const how of ['dead', 'range', 'none']) {
      boot({ upgrades: how === 'none' ? [] : ['tether-whip'] })
      const A = hulk(5, 0), near = hulk(2.5, 1.0), farB = hulk(2.5, 6.0)
      tick()
      if (how === 'range') A.pos.set(10.5, 0, 0)
      else A.hit(1e9)
      tick()
      out['whip_' + how] = { why: tv('break').map((x) => x.why), whip: tv('break').map((x) => x.whip), near: [marks(near).n, hp(near)], far: [marks(farB).n, hp(farB)], anchor: [marks(A).n, hp(A)] }
    }
    // --- Second Line
    {
      boot({ upgrades: ['tether-second'] })
      const A = hulk(5, 0), B = hulk(0, -6.5), Cc = hulk(-8, 0)
      tick()
      const both = [C.wires[0].e === A, C.wires[1].e === B]
      const marksBoth = [marks(A).n, marks(B).n, marks(Cc).n]
      A.hit(1e9); tick()
      const t0 = C.time
      let re = null
      for (let i = 0; i < 60 && re === null; i++) { tick(); if (C.wires[0].e === Cc) re = C.time - t0 }
      out.second = { both, marksBoth, kept: C.wires[1].e === B, reAfter: re, hooks: tv('hook').map((x) => x.wire) }
    }
    {
      boot(); hulk(5, 0); hulk(0, -6.5); secs(0.3)
      out.single = [!!C.wires[0].e, !!C.wires[1].e]
    }
    // --- a lens spends: Focusing Lens (k 5) on an anchor with 0 and with 3 marks
    for (const n of [0, 3]) {
      boot({ parts: ['focusing-lens'] })
      C.autoAttack = false
      const A = hulk(5, 0)
      W.__setMarks(idx(A), n)
      W.__partLog.length = 0
      W.__fire('head', false)
      for (let i = 0; i < 90; i++) tick()
      out['lens' + n] = { drop: hp(A), spends: spendsOf().map((x) => [x.n, x.bonus]), left: marks(A).n }
    }
    // --- no hand, no eye: a hulk in the hand's reach and one at the eye's, 3 s
    boot(); last().hand = 0; last().eye = 0; hulk(0, 1.4); hulk(0, 7); secs(3)
    out.nohand = { hand: last().hand ?? 0, eye: last().eye ?? 0 }
    // --- the draw calls: the wire, the glyph, the ring (a second wire is the same mesh)
    {
      const calls = () => { W.__tetherFx.update(true, 1 / 60, C, 0, 0); W.__markFx.draw(C, 0, 0, 0); W.__world.render(); return W.__world.renderer.info.render.calls }
      boot({ upgrades: ['tether-second'] })
      C.autoAttack = false
      const A = hulk(5, 0), B = hulk(0, -6.5)
      calls()
      const c0 = calls()
      C.autoAttack = true
      tick()
      for (let i = 0; i < 20; i++) { W.__tetherFx.update(true, 1 / 60, C, 0, 0); tick() }
      const wiresUp = [!!C.wires[0].e, !!C.wires[1].e]
      const c2 = calls()
      const drawn2 = W.__tetherFx.drawn, glyphs2 = W.__tetherFx.glyphs
      const meshes = W.__world.scene.children.filter((c) => c.name === 'tether-wire' || c.name === 'tether-glyph').length
      // one wire only
      B.hit(1e9); tick(); tick()
      for (let i = 0; i < 40; i++) { W.__tetherFx.update(true, 1 / 60, C, 0, 0); tick() }
      out.draw = { c0, c2, drawn2, drawn1: W.__tetherFx.drawn, glyphs2, glyphs1: W.__tetherFx.glyphs, wiresUp, meshes }
    }
    return out
  }`)
  if (process.env.DEBUG34) console.log(JSON.stringify(r))
  // the hook
  assertEq('the hook: the nearest awake body 3 to 9 u off in line of sight, at once; the anchor takes 1 mark; one wire without Second Line', [r.hook.up, r.hook.marks, r.hook.hooks, r.hook.second], [true, 1, 1, true])
  assertEq('...a body at 2.0 u and one at 10 u are not hooked: no wire, no marks', [r.none.up, r.none.marks], [false, [0, 0]])
  assertEq('...of two in range, the nearer', r.nearest, true)
  assertEq('...a wall in the way: no wire', r.walled, false)
  // the breaks
  assertEq('the anchor dies: the wire breaks (why dead), and the hook goes again no sooner than 0.5 s after', [r.dead.why, r.dead.down, r.dead.rehookAfter !== null && r.dead.rehookAfter >= 0.5 - 1e-6 && r.dead.rehookAfter <= 0.55], [['dead'], true, true])
  assertEq('the anchor goes past 10 u: the wire breaks (why range); it was up at 9.0 u', [r.range.up9, r.range.why, r.range.down], [true, ['range'], true])
  assertEq('a boss alone past 10 u: the wire breaks, and with Taut it holds', [r.bossPlain, r.bossTaut], [{ up: true, held: false, why: ['range'] }, { up: true, held: true, why: [] }])
  assertEq('a wall between (line of sight blocked): it breaks after 0.3 s of it (tick 18, not before) and Whip does not crack for that', [r.los.up, r.los.ticks >= 18 && r.los.ticks <= 20, r.los.why, r.los.whip], [true, true, ['los'], [0]])
  // the sweep
  assertEq('circling the anchor 5 u off, 240 degrees: the wire crosses the body on its spoke ONCE (6 damage, 1 mark, the anchor held throughout); the body past the anchor, where the wire ends, is never crossed', [r.circle.first, r.circle.still, r.circle.cross.length, r.circle.cross[0]?.dmg, r.circle.bMarks, r.circle.bHp, r.circle.dMarks, r.circle.dHp], [true, true, 1, 6, 1, 6, 0, 0])
  assert(r.circle.cross[0] && r.circle.cross[0].u > 0.1 && r.circle.cross[0].u < 0.9, `...the crossing is inside the segment (u ${r.circle.cross[0]?.u})`)
  assertEq('...and the log says: one hook, one crossing, and the anchor ticks it took (4 s, every 1.5 s)', [r.circle.log.hooks, r.circle.log.crossings, r.circle.log.anchorTicks], [1, 1, 2])
  assertEq('the reach gate: with the body\'s edge required to be -1 u off the wire, the same circle crosses nothing', [r.noReach.cross, r.noReach.bMarks], [0, 0])
  assertEq('once per body per 0.5 s: a crossing, two quick re-crosses (blocked), then 0.3 s later another that counts (and it is over 0.5 s since the first)', [r.gap.c1, r.gap.c2, r.gap.c3, r.gap.sinceFirst >= 0.5, r.gap.blockedAt < 0.5], [1, 1, 2, true, true])
  assertEq("a body that follows him along the wire never flips: he walks straight away from the anchor for 2 s with two bodies kept in front of him, one each side: 0 crossings, they gain no marks, and the wire is still up at 9 u", [r.follow.first, r.follow.up, r.follow.cross, r.follow.marks, Math.round(r.follow.len)], [true, true, 0, [0, 0], 9])
  assertEq('...the same two bodies, circled round the anchor instead: both are crossed', [r.circleTwo.cross, r.circleTwo.marks], [2, [1, 1]])
  // the anchor
  assertEq('the anchor takes 4 and 1 mark every 1.5 s: two ticks in 3.1 s, hooked 1 + 2 = 3 marks (the cap), 8 damage', [r.anchor.ticks, r.anchor.dmg, r.anchor.marks, r.anchor.hp], [2, [4, 4], 3, 8])
  assertEq('a boss alone: two ticks in 3.1 s; with Taut, every 0.75 s: four', [r.plainTicks, r.tautTicks], [2, 4])
  // Snag, Whip, Second Line
  assertEq('Snag: a crossing slows that body x0.6, for 1 s; no Snag, no slow', [r.snag.slowed, r.snag.snag, r.snag.after, r.noSnag], [0.6, [true], 1, 1])
  assertEq('Whip: an anchor that dies cracks the body 1.0 u off the line (6, 1 mark), not the one 4.0 u off', [r.whip_dead.why, r.whip_dead.whip, r.whip_dead.near, r.whip_dead.far], [['dead'], [1], [1, 6], [0, 0]])
  assertEq('...a break for range cracks the living anchor too (6 damage, and a second mark on top of the hook one); with no Whip nothing is cracked', [r.whip_range.whip, r.whip_range.anchor, r.whip_none.whip, r.whip_none.near], [[2], [2, 6], [0], [0, 0]])
  assertEq('Second Line: two wires, to the nearest and the next nearest (1 mark each, the third body none); one dies and the other holds, and its hook comes back after 0.5 s; without it one wire', [r.second.both, r.second.marksBoth, r.second.kept, r.second.reAfter >= 0.5 - 1e-6 && r.second.reAfter <= 0.55, r.single], [[true, true], [1, 1, 0], true, true, [true, false]])
  // a lens spends
  assertEq('Focusing Lens spends the snagged marks at +5 each: 3 marks on the anchor add 15, and leave none', [r.lens3.drop - r.lens0.drop, r.lens3.spends, r.lens3.left], [15, [[3, 15]], 0])
  assertEq('no hand and no eye with Tether worn: a hulk in the hand\'s reach and one at the eye\'s, 3 s, and neither was used', [r.nohand], [{ hand: 0, eye: 0 }])
  // draw calls
  assert(r.draw.wiresUp[0] && r.draw.wiresUp[1] && r.draw.glyphs2 === 2 && r.draw.glyphs1 === 1, `two wires: ${r.draw.glyphs2} glyphs, one wire: ${r.draw.glyphs1}`)
  assert(r.draw.drawn2 === 2 * r.draw.drawn1, `Second Line's wire is more vertices of the same mesh: ${r.draw.drawn2} for two wires, ${r.draw.drawn1} for one`)
  assert(r.draw.meshes === 2 && r.draw.c2 - r.draw.c0 <= 3, `Tether at peak: draw calls ${r.draw.c0} idle, ${r.draw.c2} with two wires and marks: +${r.draw.c2 - r.draw.c0} (at most 3: the wire, the glyph, the ring)`)
  console.log(`INFO K-M34 draw calls: idle ${r.draw.c0}, two wires and a marked anchor ${r.draw.c2} (+${r.draw.c2 - r.draw.c0}); the wire's vertices ${r.draw.drawn1} for one wire, ${r.draw.drawn2} for two`)
})


process.exit(await run(process.argv.slice(2)))
