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

// K-M23 (Ram's half, here early for the slam line; the pick, the Wake bot and the rest are B4's). Headless d1-d3 in real generated levels, seeds 1-3, the Ram core worn, the starting
// loadout, weight and tap push as booted. A fight is one pack (d1 and d2: the first 3 packs each, woken with Still in their room) or the Assembler (d3, Still 9 u from it), played to the
// clear or a cap (40 s a pack, 150 s the Assembler), HP put back each tick. The bot is the brief's: it steps toward the nearest awake body until it is `1.45 + radius` from it (2.0 u from a
// hulk) and stops there, and it casts either as soon as a part is ready ('eager') or 3.7 s after ('hesitant', never-melt's hesitation). Math.random is seeded. PASS: the eager bot fells the
// Assembler in 2 of 3 seeds. REPORTED, not a pass line here: HP lost, marks spent / made, shoves, and slams per core shove (3-balancer.md: the line is 0.3 on the core's BEAT shoves; Piston's
// and Kickstart's knocks are counted apart). Nothing is tuned to make it pass.
const RAM_BOT = `(arg) => {
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
    const base = JSON.parse(JSON.stringify({ marks: st.marks, spends: st.spends, shoves: st.shoves ?? null, hand: st.hand ?? 0 }))
    const readySince = {}
    const body = pack.members.map((e) => e.kind)
    const hp0 = pack.members.map((e) => e.hp)
    W.__fx()
    let lost = 0, ticks = 0, cleared = false
    const cap = (arg.boss ? 150 : 40) * 60
    for (let i = 0; i < cap; i++) {
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
      if (near && nd > 1.45 + near.radius) W.__stick((near.pos.x - p.x) / nd, (near.pos.z - p.z) / nd)
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
      marks: sub(now.marks, base.marks), spends: { hits: now.spends.hits - base.spends.hits, bonus: now.spends.bonus - base.spends.bonus }, shoves: sh, skims: now.skims ?? null,
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
  const rows = []
  for (const bot of ['eager', 'hesitant']) {
    for (const depth of [1, 2, 3]) {
      for (const seed of [1, 2, 3]) {
        if (depth === 3) {
          const r = await evalJson(page, RAM_BOT, { core: 'ram', bot, depth, seed, pack: 0, boss: true })
          if (r) rows.push({ bot, depth, seed, ...r })
        } else {
          for (let pack = 0; pack < 3; pack++) {
            const r = await evalJson(page, RAM_BOT, { core: 'ram', bot, depth, seed, pack, boss: false })
            if (r) rows.push({ bot, depth, seed, pack, ...r })
          }
        }
      }
    }
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
  const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-')
  for (const bot of ['eager', 'hesitant']) {
    const mine = rows.filter((r) => r.bot === bot)
    for (const [label, rs] of [['d1', mine.filter((r) => r.depth === 1)], ['d2', mine.filter((r) => r.depth === 2)], ['d3 (the Assembler)', mine.filter((r) => r.depth === 3)]]) {
      const t = tot(rs)
      const slams = t.wall + t.body + t.still + t.tell
      const bslams = t.beat.wall + t.beat.body + t.beat.still + t.beat.tell
      const made = sum(rs.map((r) => r.marks.made)), spent = sum(rs.map((r) => r.marks.spent))
      console.log(`INFO K-M23 Ram ${bot} ${label}: ${rs.length} fights, cleared ${rs.filter((r) => r.cleared).length}, ${f(mean(rs.map((r) => r.s)), 1)} s each, HP lost ${f(mean(rs.map((r) => r.lost)), 0)} each (${f(sum(rs.map((r) => r.lost)), 0)} in all), marks made ${made} spent ${spent} (${f(made ? spent / made : NaN)}), spends ${sum(rs.map((r) => r.spends.hits))} for ${sum(rs.map((r) => r.spends.bonus))}; shoves ${t.n} (beat ${t.beat.n}): wall ${t.wall} body ${t.body} still ${t.still} tell ${t.tell} plain ${t.plain}, slams per shove ${f(t.n ? slams / t.n : NaN)}, per beat shove ${f(t.beat.n ? bslams / t.beat.n : NaN)}, per beat shove without still ${f(t.beat.n ? (bslams - t.beat.still) / t.beat.n : NaN)}`)
    }
    // the slam line, on the pack fights (d1 and d2) and on the beat shoves alone (3-balancer.md)
    const t = tot(mine.filter((r) => r.depth < 3))
    const bg = t.beat.wall + t.beat.body + t.beat.tell + t.beat.still
    console.log(`INFO K-M23 Ram ${bot}, pack fights d1-d2: ${f(t.beat.n ? bg / t.beat.n : NaN)} slams per core beat shove over ${t.beat.n} beats (the line is >= 0.3: ${t.beat.n && bg / t.beat.n >= 0.3 ? 'met' : 'NOT met'}); wall ${t.beat.wall} body ${t.beat.body} tell ${t.beat.tell} of them, ${t.n - t.beat.n} shoves were Piston's or Kickstart's`)
  }
  const boss = rows.filter((r) => r.bot === 'eager' && r.depth === 3)
  const felled = boss.filter((r) => r.cleared).length
  console.log(`INFO K-M23 Ram eager, the Assembler: felled ${felled} of ${boss.length} (${boss.map((r) => `seed ${r.seed}: ${r.cleared ? f(r.s, 1) + ' s' : 'not in 150 s'}, HP lost ${f(r.lost, 0)}`).join('; ')})`)
  const hb = rows.filter((r) => r.bot === 'hesitant' && r.depth === 3)
  console.log(`INFO K-M23 Ram hesitant, the Assembler: felled ${hb.filter((r) => r.cleared).length} of ${hb.length} (${hb.map((r) => `seed ${r.seed}: ${r.cleared ? f(r.s, 1) + ' s' : 'not in 150 s'}`).join('; ')})`)
  assert(boss.length === 3 && felled >= 2, `the eager Ram bot fells the Assembler in 2 of 3 seeds (${felled} of ${boss.length})`)
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
    return out
  }`)
  for (const [what, x, max] of [['3 segments', r.plain, 3], ['Deep (5 segments)', r.deep, 5], ['Ram (cracked, 3 segments)', r.ram, 3]]) {
    assertEq(`${what}: 40 marked bodies drawn`, [x.drawn, x.marked], [40, 40])
    assert(x.c40 - x.c0 <= max && x.c40 - x.c0 >= 0, `${what}: draw calls ${x.c0} with no marks, ${x.c40} with 40 marked bodies: +${x.c40 - x.c0} (at most ${max})`)
    assertEq(`${what}: the scene's child count is equal before and after 10 s of churn, and the marks' own meshes, geometries and material are the very ones made at the start`, [x.kids1, x.inf1], [x.kids0, x.inf0])
    assert(x.median <= 0.25, `${what}: drawMarks with 40 bodies, median ${x.median.toFixed(4)} ms over 1000 calls (best batch ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)}); at most 0.25`)
    console.log(`INFO K-M30 ${what}: calls ${x.c0} -> ${x.c40} (+${x.c40 - x.c0}), scene children ${x.kids0} -> ${x.kids1}, drawMarks 40 bodies median ${x.median.toFixed(4)} ms (best ${x.best.toFixed(4)}, worst ${x.worst.toFixed(4)})`)
  }
})


process.exit(await run(process.argv.slice(2)))
