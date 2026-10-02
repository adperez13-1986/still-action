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
  assertEq('the pickup card for signal-flare under Wake reads Frost Flare and its line', [r.cardWake.pickup.name, r.cardWake.pickup.line], ['Frost Flare', 'Rimes what it lands on, and slows it.'])
  assertEq('the compare card reads it, with the reshaped numbers (cooldown 5.0s, damage 17 weighed)', [r.cardWake.compare.name, r.cardWake.compare.line, r.cardWake.compare.stats.some((s) => s.includes('5.0s')), r.cardWake.compare.stats.some((s) => s.includes('17'))], ['Frost Flare', 'Rimes what it lands on, and slows it.', true, true])
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

check('K-M30', RUN, async ({ page }) => {
  // the frame budget: draw calls whatever the marked bodies, nothing created after the build, drawMarks cheap
  const r = await evalJson(page, `() => {
    ${WAKE}
    const out = {}
    const calls = () => { W.__markFx.draw(C, 0, 0, 0); W.__world.render(); return W.__world.renderer.info.render.calls }
    const children = () => W.__world.scene.children.length
    // what the marks own: their meshes' geometries and the one material, by identity (the walls' own tells come and go in the scene and are not the marks')
    const info = () => W.__markFx.group.children.map((c) => c.geometry.uuid + c.material.uuid).join()
    const run = (key) => {
      (${SETUP})({ autos: true })
      W.__core('wake')
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
    return out
  }`)
  for (const [what, x, max] of [['3 segments', r.plain, 3], ['Deep (5 segments)', r.deep, 5]]) {
    assertEq(`${what}: 40 marked bodies drawn`, [x.drawn, x.marked], [40, 40])
    assert(x.c40 - x.c0 <= max && x.c40 - x.c0 >= 0, `${what}: draw calls ${x.c0} with no marks, ${x.c40} with 40 marked bodies: +${x.c40 - x.c0} (at most ${max})`)
    assertEq(`${what}: the scene's child count is equal before and after 10 s of churn, and the marks' own meshes, geometries and material are the very ones made at the start`, [x.kids1, x.inf1], [x.kids0, x.inf0])
    assert(x.median <= 0.25, `${what}: drawMarks with 40 bodies, median ${x.median.toFixed(4)} ms over 1000 calls (best batch ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)}); at most 0.25`)
    console.log(`INFO K-M30 ${what}: calls ${x.c0} -> ${x.c40} (+${x.c40 - x.c0}), scene children ${x.kids0} -> ${x.kids1}, drawMarks 40 bodies median ${x.median.toFixed(4)} ms (best ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)})`)
  }
})


process.exit(await run(process.argv.slice(2)))
