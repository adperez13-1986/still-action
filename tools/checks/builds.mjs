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

/** Run one suite as a child process, the switches' env stripped (a WEIGHT=0 or TAP=0 run of this file must not turn the children off): its PASS / FAIL lines, in order. */
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

check('K-M1', RUN, async ({ page }) => {
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
      const e = wall()
      if (marksN) W.__setMarks(idx(e), marksN)
      if (o.chill) C.setState(e, 'chilled', 5, 'torso')
      return { e, W, C, secs, marks, ev, spendsOf, last, idx, wall }
    }
    const fire = (r, slot, s = 0.5) => { const hp = r.e.hp; window.__partLog.length = 0; r.W.__fire(slot, false); r.secs(s); return hp - r.e.hp }
    /** the same part, marks 0 and marks n, under a core: the damage dealt each way and what the spend said */
    const pair = (id, slot, core, n, s = 0.5) => {
      let r = rig([id], 0, { core })
      const control = fire(r, slot, s)
      r = rig([id], n, { core })
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
    out.frayed = pair('frayed-cleaver', 'arms', 'wake', 3)
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
  adds('Frayed Cleaver under Wake (k 10)', spend.frayed, 10)
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

check('K-M5', RUN, async ({ page }) => {
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

process.exit(await run(process.argv.slice(2)))
