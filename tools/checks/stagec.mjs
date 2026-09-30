/**
 * The stage C checks (design/area3/STAGE-C.md §4): `node tools/checks/stagec.mjs [K-N1a ...]` runs all of them, or the ids
 * listed. Each step adds its own checks here, on lib.mjs's `suite()`, as stageb.mjs does (C1-C9: K-N1a, K-N1b, K-N2a, K-N2b, K-N3, K-N4-K-N8, K-N10-K-N15, K-N17, K-N18, K-N19-K-N22, K-S5, K-E9c). The baselines
 * (K-90, K-90L, K-90F) are baseline.mjs's and fights.mjs's; stage C never re-captures them.
 *
 * The short forms of STAGE-C.md §4, as queries (every one is ?save=memory and a dev run straight into a level):
 *   ENG6   the 6-depth run with the Engine flag: `enterEngine('III', 6, s)`
 *   ENG9   the 9-depth run: `enterEngine('III', 6, s)` (Line first) and `enterEngine('II', 9, s)` (Works first)
 *   ARENA  a clean test floor with the Engine on it: `__arena()`, `__spawn('boss', 9, 0, false, 'engine')` (the track round the origin)
 *   OFF, ON  stageb.mjs's: the 6-depth page, and the 9-depth page
 */
import { readFileSync } from 'node:fs'
import { REPO, assert, assertEq, evalJson, suite } from './lib.mjs'

const ENG6 = '?depth=1&save=memory&line=1&engine=1'
const ENG9 = '?depth=1&save=memory&roads=1&line=1&engine=1'
const ARENA = '?depth=1&save=memory&line=1&engine=1'
const OFF = '?depth=1&save=memory'
const ON = '?depth=1&save=memory&roads=1'

const { check, run } = suite()
/** The wagon's tub, half its length (engine.ts ENGINE.wagon.halfLen, typed again here on purpose). */
const ENGINE_WAGON_HALF = 0.95

/**
 * The in-page toolkit every check body starts with (it is source, spliced in front of the body by `inPage`).
 * `enterEngine(order, depth, seed, opts)`: (C6: the Engine's steam and cinder are off unless opts.steam, opts.cinder: see resetEngine) the road taken (`__run.route`), a level at `depth`, Still wearing the Scrap Cleaver, the autos, the
 * break rule and the eye's brace (a planted Still takes half) off; returns the Engine's level. `tick(n, before)`: n ticks of 1/60 s with Still's HP put back to 100 before each;
 * returns the HP he lost. `until(pred, maxS, before)`: seconds ticked until pred() (checked before each tick), or -1.
 * `roomOf()`: the arena's centre `c` and `away`, the unit vector from the entrance to it (the entrance axis).
 * `wake()`: Still set 7 u short of c against `away` (inside ENGINE.wakeR 16.5 of a body on the loop), stepped until the Engine runs.
 * Both need the level's `track` (C2) and the Engine (C3): before those, they throw.
 */
const HELPERS = `
const W = window, C = W.__combat
const tick = (n = 1, before) => {
  let lost = 0
  for (let i = 0; i < n; i++) {
    C.hp = 100
    if (before) before()
    W.__step(1 / 60)
    lost += 100 - C.hp
  }
  return lost
}
const until = (pred, maxS, before) => {
  const n = Math.round(maxS * 60)
  for (let i = 0; i <= n; i++) {
    if (pred()) return i / 60
    if (i < n) tick(1, before)
  }
  return -1
}
// the Engine's numbers as they load, so each level starts from them (a page is shared by every check of its query)
if (!W.__ENGINE0) {
  const E = W.__ENGINE
  W.__ENGINE0 = { range: E.steam.range, gapS: E.steam.gapS.slice(), afterMs: E.outrun.afterMs.slice(), first: E.guess.first, speed: E.speed }
}
/**
 * C6's attacks are opt-in: the lit-rail checks measure the run alone, so by default the steam's range is 0 (never in reach) and the
 * cinder never due. o.steam, o.cinder turn them on as they ship; o.blind is K-N17's before (the guess starts at 0); o.gap = [lo, hi] s.
 */
const resetEngine = (o = {}) => {
  const E = W.__ENGINE, E0 = W.__ENGINE0
  E.speed = E0.speed
  E.steam.range = o.steam ? E0.range : 0
  E.steam.gapS = (o.gap || E0.gapS).slice()
  E.outrun.afterMs = o.cinder ? E0.afterMs.slice() : [Infinity, Infinity]
  E.guess.first = o.blind ? 0 : E0.first
}
const enterEngine = (order, depth, seed, opts = {}) => {
  resetEngine(opts)
  W.__hold(true)
  W.__run.route = order
  W.__enter(depth, seed)
  W.__equip('scrap-cleaver')
  C.autoAttack = false
  C.autoTimer = 0
  C.counters = false
  C.breakRule = false
  // planted, every hit on him is halved (EYE.brace, as stageb's K-T check turns it off): the checks measure the flat hit
  C.eye = false
  W.__stick(0, 0)
  C.hp = 100
  return W.__level()
}
const roomOf = () => {
  const t = W.__track && W.__track(), e = W.__level().entrance
  if (!t) throw new Error('no track on this level')
  const dx = t.c.x - e.x, dz = t.c.z - e.z, l = Math.hypot(dx, dz)
  return { c: t.c, away: { x: dx / l, z: dz / l } }
}
const wake = (maxS = 5) => {
  const { c, away } = roomOf()
  W.__still.pos.set(c.x - away.x * 7, 0, c.z - away.z * 7)
  const s = until(() => W.__boss() && W.__boss().state === 'run', maxS)
  if (s < 0) throw new Error('the Engine did not reach run in ' + maxS + ' s of waking')
  return s
}
`

/** Run `body` (async function source's body, with the HELPERS in front and `arg` in scope) in the page; what it returns, as JSON. */
const inPage = (page, body, arg) =>
  evalJson(page, { toString: () => `async (arg) => { ${HELPERS}\n${body}\n}` }, arg)

/** K-N1b's body: the roundhouse as `generateLevel` built it, for each [order, depth, seeds]. */
async function roundhouse(page, runs) {
  const axesSeen = new Set()
  for (const [order, depth, list] of runs) {
    for (const seed of list) {
      const got = await inPage(page, `
        const level = enterEngine(arg.order, arg.depth, arg.seed)
        const t = W.__track()
        if (!t) return { bad: 'no track' }
        const exit = level.rooms.find((r) => r.kind === 'exit'), ent = level.entrance
        const dx = exit.center.x - ent.x, dz = exit.center.z - ent.z, l = Math.hypot(dx, dz)
        const T = level.terrain
        const seg = (x, z, a, b) => {
          const ex = b.x - a.x, ez = b.z - a.z, len = Math.hypot(ex, ez)
          const u = Math.max(0, Math.min(len, ((x - a.x) * ex + (z - a.z) * ez) / len))
          return Math.hypot(x - (a.x + ex / len * u), z - (a.z + ez / len * u))
        }
        const rail = (x, z) => Math.min(
          ...t.loop.map((a, i) => seg(x, z, a, t.loop[(i + 1) % t.loop.length])),
          ...t.arms.map((a) => seg(x, z, a.junction, a.buffer)),
          ...t.spurs.map((s) => seg(x, z, s.outer, s.onLoop)))
        const b = W.__level().boss
        return {
          c: t.c, exit: { x: exit.center.x, z: exit.center.z }, away: { x: dx / l, z: dz / l }, spurAxis: t.spurAxis,
          levers: ['right', 'left'].map((side) => T.blocked(t.levers[side].x, t.levers[side].z, 0.01)),
          buffers: t.arms.map((a) => T.blocked(a.buffer.x, a.buffer.z, 0.01)),
          walls: [[6.5, 0], [-6.5, 0], [0, 6.5], [0, -6.5]].map(([x, z]) => T.blocked(t.c.x + x, t.c.z + z, 0)),
          crates: level.breakables.map((k) => ({ r: k.r, d: rail(k.x, k.z) })),
          boss: b ? { x: b.x, z: b.z, fx: b.face.x - b.x, fz: b.face.z - b.z } : null,
          def: W.__combat.boss ? W.__combat.boss.def.arena : null,
        }`, { order, depth, seed })
      const why = (m) => { throw new Error(`${order} at ${depth}, seed ${seed}: ${m}`) }
      if (got.bad) why(got.bad)
      const near = (a, b, eps = 0.01) => Math.abs(a - b) <= eps
      axesSeen.add(got.spurAxis)
      if (got.def !== 'roundhouse') why(`the boss's arena is ${got.def}, not roundhouse`)
      if (!near(got.c.x, got.exit.x, 1e-9) || !near(got.c.z, got.exit.z, 1e-9)) why(`c is (${got.c.x}, ${got.c.z}), the exit room's centre (${got.exit.x}, ${got.exit.z})`)
      if (!(Math.abs(got.away.x) > 0.99 || Math.abs(got.away.z) > 0.99)) why(`the entrance is not on an axis: away (${got.away.x}, ${got.away.z})`)
      const want = Math.abs(got.away.x) > 0.5 ? 'z' : 'x'
      if (got.spurAxis !== want) why(`spurAxis is '${got.spurAxis}' with away (${got.away.x}, ${got.away.z}); across it is '${want}'`)
      if (got.levers.some((x) => !x)) why(`a lever is not solid: ${JSON.stringify(got.levers)}`)
      if (got.buffers.some((x) => !x)) why(`a buffer is not solid: ${JSON.stringify(got.buffers)}`)
      if (got.walls.some((x) => !x)) why(`an inner wall is not solid: ${JSON.stringify(got.walls)}`)
      if (got.crates.length !== 4) why(`${got.crates.length} breakables, not the roundhouse's 4`)
      for (const k of got.crates) if (k.d < 1.8 + k.r) why(`a crate (r ${k.r.toFixed(2)}) is ${k.d.toFixed(2)} from a rail, under ${(1.8 + k.r).toFixed(2)}`)
      // asleep at c + away * 9, facing along dir +1 (the Engine's own state comes with C3)
      if (!got.boss) why('no boss spot')
      if (!near(got.boss.x, got.c.x + got.away.x * 9) || !near(got.boss.z, got.c.z + got.away.z * 9)) why(`the boss spot is (${got.boss.x}, ${got.boss.z}), not c + away * 9`)
      // dir +1 by SPEC 7.2's vertex order: +x on the -z straight, +z on the +x one, -x on the +z one, -z on the -x one
      const tan = Math.abs(got.away.x) > 0.5 ? [0, Math.sign(got.away.x)] : [-Math.sign(got.away.z), 0]
      if (!near(got.boss.fx, tan[0], 1e-6) || !near(got.boss.fz, tan[1], 1e-6)) why(`it faces (${got.boss.fx}, ${got.boss.fz}), not dir +1's (${tan})`)
    }
  }
  assert(axesSeen.has('x') && axesSeen.has('z'), `only the spur axes ${[...axesSeen]} were exercised`)
}

// --- Geometry (C1) -----------------------------------------------------------------------------------------------------

// SPEC §7.2 typed out again here, on purpose: the check must not read track.ts's own table back
const SPEC72 = {
  loop: [[-6, -9], [6, -9], [9, -6], [9, 6], [6, 9], [-6, 9], [-9, 6], [-9, -6]],
  arms: [
    { side: 'right', kind: 'a', dir: 1, junction: [6, -9], buffer: [12.4, -9] },
    { side: 'right', kind: 'b', dir: -1, junction: [9, -6], buffer: [9, -12.4] },
    { side: 'left', kind: 'a', dir: 1, junction: [-6, 9], buffer: [-12.4, 9] },
    { side: 'left', kind: 'b', dir: -1, junction: [-9, 6], buffer: [-9, 12.4] },
  ],
  levers: { right: [11.3, -11.3], left: [-11.3, 11.3] },
}

check('K-N1a', ENG6, async ({ page }) => {
  for (const [cx, cz, axis] of [[0, 0, 'z'], [5, -3, 'x']]) {
    const t = await evalJson(page, ([x, z, a]) => window.__makeTrack(x, z, a), [cx, cz, axis])
    const at = (p) => [p[0] + cx, p[1] + cz]
    const near = (what, got, want, eps = 0.01) => assert(Math.abs(got - want) <= eps, `(${cx}, ${cz}, '${axis}') ${what}: ${got} is not ${want} +- ${eps}`)
    const pt = (what, got, want) => { near(what + '.x', got.x, want[0]); near(what + '.z', got.z, want[1]) }
    near('c.x', t.c.x, cx, 0); near('c.z', t.c.z, cz, 0)
    assert(t.spurAxis === axis, `(${cx}, ${cz}, '${axis}') spurAxis is '${t.spurAxis}'`)
    assert(t.loop.length === 8, `the loop has ${t.loop.length} vertices, not 8`)
    SPEC72.loop.forEach((v, i) => pt(`loop[${i}]`, t.loop[i], at(v)))
    near('loopLen', t.loopLen, 64.97, 0.05)
    // vertexS: the vertices' distances from vertex 0 along dir +1, from the shape itself
    assert(t.vertexS.length === 8 && t.vertexS[0] === 0, `vertexS is ${JSON.stringify(t.vertexS)}`)
    let s = 0
    for (let i = 0; i < 8; i++) {
      near(`vertexS[${i}]`, t.vertexS[i], s, 1e-9)
      const a = SPEC72.loop[i], b = SPEC72.loop[(i + 1) % 8]
      s += Math.hypot(b[0] - a[0], b[1] - a[1])
    }
    near('loopLen against the shape', t.loopLen, s, 1e-9)
    assert(t.arms.length === 4, `${t.arms.length} arms, not 4`)
    SPEC72.arms.forEach((want, i) => {
      const a = t.arms[i], w = `arms[${i}]`
      assert(a.side === want.side && a.kind === want.kind && a.dir === want.dir, `${w} is ${a.side} ${a.kind} dir ${a.dir}`)
      pt(w + '.junction', a.junction, at(want.junction)); pt(w + '.buffer', a.buffer, at(want.buffer))
      // the vertex it leaves from is its junction
      pt(w + '.vertex', t.loop[a.vertex], at(want.junction))
      near(w + '.len', a.len, Math.hypot(want.buffer[0] - want.junction[0], want.buffer[1] - want.junction[1]), 1e-9)
    })
    for (const side of ['right', 'left']) pt(`levers.${side}`, t.levers[side], at(SPEC72.levers[side]))
    // INV-K1: each lever is 2.3 (+- 0.01) from both its arms' centre lines, and outside their strips (halfW 1.2)
    for (const side of ['right', 'left']) {
      const L = t.levers[side]
      for (const a of t.arms.filter((x) => x.side === side)) {
        const d = a.junction.x === a.buffer.x ? Math.abs(L.x - a.junction.x) : Math.abs(L.z - a.junction.z)
        near(`INV-K1: the ${side} lever from arm ${a.kind}`, d, 2.3)
        assert(d > 1.2, `INV-K1: the ${side} lever is inside arm ${a.kind}'s strip (${d})`)
      }
    }
    // the spurs: two, on the named axis, at 13 and 9 from c
    assert(t.spurs.length === 2, `${t.spurs.length} spurs, not 2`)
    const mine = axis === 'z' ? 'z' : 'x', other = axis === 'z' ? 'x' : 'z'
    const sign = [-1, 1]
    t.spurs.forEach((sp, i) => {
      near(`spurs[${i}].outer.${other}`, sp.outer[other], t.c[other], 1e-9); near(`spurs[${i}].onLoop.${other}`, sp.onLoop[other], t.c[other], 1e-9)
      near(`spurs[${i}].outer.${mine}`, sp.outer[mine], t.c[mine] + sign[i] * 13, 1e-9); near(`spurs[${i}].onLoop.${mine}`, sp.onLoop[mine], t.c[mine] + sign[i] * 9, 1e-9)
    })
  }
})

// The seeds 1..N of the brief all give the entrance on -x (the generator's first draw, seed * 16807 / 2^31 - 1, is under 0.25 until
// seed 31,900): away (+1, 0), the 'z' spur axis. FAR adds one seed per other entrance side: 40000 away (0, +1), 80000 (-1, 0), 110000 (0, -1).
const FAR = [40000, 80000, 110000]
const seeds = (n) => [...Array(n)].map((_, i) => i + 1).concat(FAR)
check('K-N1b', ENG6, async ({ page }) => roundhouse(page, [['III', 6, seeds(20)]]))
check('K-N1b', ENG9, async ({ page }) => roundhouse(page, [['III', 6, seeds(5)], ['II', 9, seeds(5)]]))

// --- The body and the run (C3, C4) -------------------------------------------------------------------------------------

check('K-N2a', ENG6, async ({ page }) => {
  for (const seed of seeds(5)) {
    const got = await inPage(page, `
      enterEngine('III', 6, arg)
      const b0 = W.__boss(), c = W.__combat.boss
      if (!b0 || b0.kind !== 'engine') return { bad: 'the boss is ' + (b0 && b0.kind) + ', not the engine' }
      const start = { state: b0.state, dir: b0.dir, hp: b0.hp, maxHp: b0.maxHp }
      const e = W.__level().entrance, { away } = roomOf()
      const logAt = W.__enemyLog.length
      const dist = () => Math.hypot(c.pos.x - W.__still.pos.x, c.pos.z - W.__still.pos.z)
      const steps = []
      let woke = -1
      for (let k = 0; k < 600; k++) {
        W.__still.pos.set(e.x + away.x * 0.25 * k, 0, e.z + away.z * 0.25 * k)
        const d = dist()
        tick(1)
        // the tick may push him off a wall; the wake test used the position set, so that is the distance that counts
        const asleep = W.__boss().state === 'asleep'
        steps.push({ k, d, asleep })
        if (!asleep) { woke = k; break }
      }
      if (woke < 0) return { bad: 'never woke in 600 steps', steps: steps.length }
      // then he stands: the unfold, in ticks
      let ticks = 0
      while (W.__boss().state === 'unfold' && ticks < 300) { tick(1); ticks++ }
      const first = steps[steps.length - 1], early = steps.filter((x) => !x.asleep && x.d >= 16.5).length, late = steps.filter((x) => x.asleep && x.d < 16.5).length
      const whistles = W.__enemyLog.slice(logAt).filter((x) => x.ev.kind === 'engine' && x.ev.what === 'whistle').length
      return { start, wokeAt: first.d, early, late, ticks, after: W.__boss().state, whistles, moved: Math.hypot(W.__boss().x - c.pos.x, W.__boss().z - c.pos.z) }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.bad) why(got.bad)
    if (got.start.state !== 'asleep' || got.start.dir !== 1) why(`it starts ${got.start.state}, dir ${got.start.dir}`)
    if (got.start.hp !== got.start.maxHp) why(`it starts at ${got.start.hp} of ${got.start.maxHp}`)
    if (got.early) why(`it woke ${got.early} step(s) with Still 16.5 or more away`)
    if (got.late) why(`it slept on ${got.late} step(s) with Still inside 16.5`)
    if (!(got.wokeAt < 16.5 && got.wokeAt > 16.5 - 0.26)) why(`it woke with Still ${got.wokeAt.toFixed(3)} away, not on the first step inside 16.5`)
    // the unfold is 1500 ms of ticks; the wake tick is its first update (the whistle is logged in it), then `ticks` more
    const ms = (got.ticks + 1) * 1000 / 60
    if (Math.abs(ms - 1500) > 17) why(`the unfold lasted ${ms.toFixed(1)} ms, not 1500 +- 17 (${got.ticks} ticks)`)
    if (got.after !== 'run') why(`the unfold ended in '${got.after}', not 'run'`)
    if (got.whistles !== 1) why(`${got.whistles} whistle events, not 1`)
  }
})

check('K-N2b', ENG6, async ({ page }) => {
  for (const seed of seeds(5)) {
    const got = await inPage(page, `
      enterEngine('III', 6, arg)
      const { c, away } = roomOf()
      // waked as K-N2a's is: Still 7 u short of c, against the entrance axis; the wake tick is the unfold's first update
      W.__still.pos.set(c.x - away.x * 7, 0, c.z - away.z * 7)
      let n = 0
      while (W.__boss().state === 'asleep' && n++ < 30) tick(1)
      if (W.__boss().state !== 'unfold') return { bad: 'the state after the wake tick is ' + W.__boss().state }
      let ticks = 0
      while (W.__boss().state === 'unfold' && ticks < 300) { tick(1); ticks++ }
      const runAt = (ticks + 1) * 1000 / 60
      const L = W.__track().loopLen
      const b0 = W.__boss(), lap0 = b0.lap
      let windowSeen = false, moved = 0, prev = b0.s
      // one lap and a bit (5.91 s at 11 u/s): no window opens before lap 1, and it never stops
      const t0 = { x: b0.x, z: b0.z }
      let wrapped = 0
      for (let i = 0; i < 400 && W.__boss().lap < 1; i++) {
        tick(1)
        const b = W.__boss()
        if (b.window) windowSeen = true
        let d = b.s - prev
        if (d < -L / 2) d += L
        moved += d
        if (b.s < prev) wrapped++
        prev = b.s
        if (b.state !== 'run') return { bad: 'left run to ' + b.state + ' on lap ' + b.lap }
      }
      const b1 = W.__boss()
      return { runAt, state: b0.state, lap0, lap: b1.lap, windowSeen, moved, L, dir: b0.dir, path: b1.path, attack: b1.attack }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.bad) why(got.bad)
    if (Math.abs(got.runAt - 1500) > 17) why(`run came at ${got.runAt.toFixed(1)} ms, not 1500 +- 17`)
    if (got.lap0 !== 0) why(`it starts on lap ${got.lap0}`)
    if (got.windowSeen) why('a window opened before lap 1')
    if (got.dir !== 1 || got.path !== 'loop') why(`dir ${got.dir}, path ${got.path}`)
    // 11 u/s: to the end of lap 0 is one loop length (the lap turns over on a tick, so a tick's 0.183 u either side)
    if (!(Math.abs(got.moved - got.L) <= 0.25)) why(`it moved ${got.moved.toFixed(3)} u round the loop in lap 0, not ${got.L.toFixed(3)} +- 0.25`)
    if (got.lap !== 1) why(`the loop ended on lap ${got.lap}`)
  }
})

// K-N3's setup, in the page: the Engine woken (Still at c, autos off), returned from `run` on
const RUNNING = `
  enterEngine('III', 6, arg)
  const { c, away } = roomOf()
  W.__still.pos.set(c.x - away.x * 7, 0, c.z - away.z * 7)
  until(() => W.__boss() && W.__boss().state === 'run', 5)
  W.__still.pos.set(c.x, 0, c.z)
  const rot = () => W.__combat.boss.group.rotation.y
  const inStrip = (s, x, z, grow) => {
    const vx = s.bx - s.ax, vz = s.bz - s.az, len = Math.hypot(vx, vz)
    if (len < 1e-6) return false
    const along = ((x - s.ax) * vx + (z - s.az) * vz) / len, across = Math.abs((x - s.ax) * vz - (z - s.az) * vx) / len
    return along >= -1e-9 && along <= len + 1e-9 && across <= s.halfW + grow
  }
  const dmg = 20 * W.__combat.curve.bossDmg
  const loop = W.__track().loopLen
`

check('K-N3', ENG6, async ({ page }) => {
  // 1. the honest rail, over 30 s of phase 1 with Still standing at c
  for (const seed of [1, 2, 3]) {
    const got = await inPage(page, RUNNING + `
      const seen = new Map()
      const bad = []
      let prev = W.__boss(), wraps = [], ticks = 0, movingTicks = 0, lost = 0, maxLive = 0
      const t = () => W.__combat.time
      for (let i = 0; i < 1800; i++) {
        W.__still.pos.set(c.x, 0, c.z)
        lost += tick(1)
        const b = W.__boss()
        const segs = W.__engineSegs()
        maxLive = Math.max(maxLive, segs.filter((s) => !s.done).length)
        for (const s of segs) {
          let r = seen.get(s.id)
          if (!r) { r = { madeAt: s.madeAt, armMs: s.armMs, damage: s.damage, group: s.group, armedAt: null }; seen.set(s.id, r) }
          if (r.armedAt === null && s.armIn <= 1e-6) r.armedAt = t()
        }
        // its nose, every tick it moves, must be inside an armed, not-done strip of its own (grown 0.05)
        if (b.state === 'run' && prev.state === 'run') {
          movingTicks++
          const y = rot(), nx = b.x + Math.sin(y) * 1.5, nz = b.z + Math.cos(y) * 1.5
          const ok = segs.some((s) => s.source === 'train' && !s.done && s.armIn <= 1e-6 && inStrip(s.shape, nx, nz, 0.05))
          if (!ok && bad.length < 5) bad.push({ tick: i, s: b.s, nose: [nx, nz], strips: segs.filter((s) => !s.done).map((s) => [s.armIn, s.shape.ax, s.shape.az, s.shape.bx, s.shape.bz]) })
          if (b.s < prev.s) wraps.push(t())
        }
        prev = b
      }
      const rows = [...seen.values()]
      const armed = rows.filter((r) => r.armedAt !== null)
      return {
        n: rows.length, armed: armed.length, movingTicks, bad, lost, maxLive, wraps,
        minGap: Math.min(...armed.map((r) => (r.armedAt - r.madeAt) * 1000)),
        minArmMs: Math.min(...rows.map((r) => r.armMs)),
        damages: [...new Set(rows.map((r) => r.damage))], dmg,
        groups: [...new Set(rows.map((r) => r.group))].length,
        sources: [...new Set(W.__engineSegs().map((s) => s.source))],
      }`, seed)
    console.log(`INFO K-N3 seed ${seed}: ${got.n} strips made, ${got.armed} armed, ${got.groups} lap groups, up to ${got.maxLive} live at once; least made-to-armed ${got.minGap.toFixed(2)} ms, least armMs ${got.minArmMs.toFixed(2)}; ${got.movingTicks} moving ticks checked; loop start passed at ${got.wraps.map((w) => w.toFixed(2)).join(', ')}`)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.armed < 100) why(`only ${got.armed} of ${got.n} strips armed in 30 s`)
    if (got.minGap < 1300 - 1e-6) why(`a strip armed ${got.minGap.toFixed(4)} ms after it was made, under 1300`)
    if (got.minArmMs < 1300 - 1e-6) why(`a strip was given armMs ${got.minArmMs.toFixed(4)}, under 1300`)
    if (got.damages.length !== 1 || Math.abs(got.damages[0] - got.dmg) > 1e-9) why(`strip damage ${got.damages}, not 20 x bossDmg = ${got.dmg}`)
    if (got.bad.length) why(`${got.bad.length}+ tick(s) with the nose outside every armed strip; first: ${JSON.stringify(got.bad[0])}`)
    if (got.movingTicks < 1500) why(`it moved on only ${got.movingTicks} ticks`)
    if (got.lost !== 0) why(`Still standing at c lost ${got.lost} HP`)
    if (got.groups < 4) why(`${got.groups} lap groups in 30 s`)
    if (got.wraps.length < 3) why(`the loop start passed ${got.wraps.length} times`)
    for (let i = 1; i < got.wraps.length; i++) {
      const gap = got.wraps[i] - got.wraps[i - 1]
      if (Math.abs(gap - 5.91) > 0.05) why(`the loop start passed ${gap.toFixed(3)} s after the last, not 5.91 +- 0.05`)
    }
  }
  // 2. Still on unlit rail 1 u beyond the frontier, held there 0.5 s, is not hit
  const unlit = await inPage(page, RUNNING + `
    until(() => W.__boss().lap >= 0 && W.__engineSegs().length > 4, 3)
    tick(60)
    const segs = W.__engineSegs().filter((s) => !s.done)
    const last = segs[segs.length - 1].shape
    const len = Math.hypot(last.bx - last.ax, last.bz - last.az)
    const ux = (last.bx - last.ax) / len, uz = (last.bz - last.az) / len
    const px = last.bx + ux, pz = last.bz + uz
    // the frontier is where the last strip ends: a point 1 u past it, on the same straight when it has room
    let hit = 0
    for (let i = 0; i < 30; i++) { W.__still.pos.set(px, 0, pz); hit += tick(1) }
    return { hit, p: [px, pz], last }`, 1)
  if (unlit.hit !== 0) throw new Error(`Still 1 u beyond the frontier was hit for ${unlit.hit} within 0.5 s (${JSON.stringify(unlit)})`)
  // 3. Still standing on the loop ahead is hit once, for that damage, and shoved; the same lap's strips never hit him twice
  for (const ahead of [7, 11.5]) {
    const hitOnce = await inPage(page, RUNNING + `
      tick(30)
      const b = W.__boss(), t = W.__track()
      // the loop point arg.ahead u beyond the nose (dir +1)
      const at = (u) => {
        const w = ((u % loop) + loop) % loop
        let i = t.vertexS.length - 1
        while (t.vertexS[i] > w) i--
        const a = t.loop[i], q = t.loop[(i + 1) % t.loop.length], len = Math.hypot(q.x - a.x, q.z - a.z)
        const k = (w - t.vertexS[i]) / len
        return { x: a.x + (q.x - a.x) * k, z: a.z + (q.z - a.z) * k }
      }
      const p = at(b.s + 1.5 + arg)
      W.__still.pos.set(p.x, 0, p.z)
      const keys = new Set()
      let lost = 0, moved = 0, dead = 0
      for (let i = 0; i < 240; i++) {
        lost += tick(1)
        for (const h of W.__hazards()) if (h.source === 'train' && h.hit.includes('still')) keys.add(h.shape.ax.toFixed(3) + ',' + h.shape.az.toFixed(3))
        moved = Math.max(moved, Math.hypot(W.__still.pos.x - p.x, W.__still.pos.z - p.z))
      }
      return { lost, moved, hitStrips: keys.size, dmg }`, ahead)
    if (Math.abs(hitOnce.lost - hitOnce.dmg) > 1e-6) throw new Error(`Still ${ahead} u ahead of the nose lost ${hitOnce.lost} HP, not one hit of ${hitOnce.dmg}`)
    if (hitOnce.hitStrips !== 1) throw new Error(`Still ${ahead} u ahead was hit by ${hitOnce.hitStrips} strips, not 1`)
    if (!(hitOnce.moved > 1)) throw new Error(`Still ${ahead} u ahead was shoved ${hitOnce.moved.toFixed(2)} u, under 1`)
  }
})

// --- Levers (C5) -------------------------------------------------------------------------------------------------------

// The honest-rail watcher, for the checks that turn the Engine off the loop: after every tick `observe(prevState)` records when each
// strip was made and armed, and every tick its leading end moves (the nose driving, the tail backing) that end must lie in an armed,
// not-done strip of its own, grown 0.05. `honesty()` is what it saw.
const WATCH = `
  const seen = new Map(), bad = []
  let movingTicks = 0
  const observe = (prevState) => {
    const b = W.__boss(), segs = W.__engineSegs()
    for (const s of segs) {
      let r = seen.get(s.id)
      if (!r) { r = { madeAt: s.madeAt, armMs: s.armMs, armedAt: null }; seen.set(s.id, r) }
      if (r.armedAt === null && s.armIn <= 1e-6) r.armedAt = W.__combat.time
    }
    if ((b.state === 'run' || b.state === 'siding' || b.state === 'backing') && prevState === b.state) {
      movingTicks++
      const y = rot(), f = b.state === 'backing' ? -1 : 1
      const nx = b.x + Math.sin(y) * 1.5 * f, nz = b.z + Math.cos(y) * 1.5 * f
      const ok = segs.some((s) => s.source === 'train' && !s.done && s.armIn <= 1e-6 && inStrip(s.shape, nx, nz, 0.05))
      if (!ok && bad.length < 3) bad.push({ state: b.state, s: b.s, path: b.path, end: [nx, nz] })
    }
  }
  const honesty = () => {
    const rows = [...seen.values()], armed = rows.filter((r) => r.armedAt !== null)
    return { n: rows.length, armed: armed.length, movingTicks, bad, minGap: armed.reduce((m, r) => Math.min(m, (r.armedAt - r.madeAt) * 1000), Infinity), minArmMs: rows.reduce((m, r) => Math.min(m, r.armMs), Infinity) }
  }
`
const honestOk = (why, h) => {
  if (h.bad.length) why(`the leading end was outside every armed strip on a tick: ${JSON.stringify(h.bad[0])}`)
  if (h.minGap < 1300 - 1e-6) why(`a strip armed ${h.minGap.toFixed(4)} ms after it was made, under 1300`)
  if (h.minArmMs < 1300 - 1e-6) why(`a strip was given armMs ${h.minArmMs.toFixed(4)}, under 1300`)
}

check('K-N4', ENG6, async ({ page }) => {
  for (const seed of [1, 2]) {
    const got = await inPage(page, RUNNING + `
      const t = W.__track(), B = W.__BOARD, vS = (side) => t.vertexS[t.arms.find((a) => a.side === side && a.dir === 1).vertex]
      let un = 0, prevS = W.__boss().s, cur = null
      const wins = [], rows = []
      for (let i = 0; i < 60 * 70; i++) {
        tick(1)
        const b = W.__boss()
        let d = b.s - prevS; if (d < -loop / 2) d += loop
        un += d; prevS = b.s
        const bar = document.querySelector('#bossBar small')
        rows.push({ board: b.board, dom: bar ? bar.textContent : null, open: !!(b.window && b.window.open), side: b.window ? b.window.side : null })
        if (b.window && !cur) {
          const nose = un + 1.5, v = vS(b.window.side)
          const dist = (((v - (b.s + 1.5)) % loop) + loop) % loop
          cur = { i0: i, side: b.window.side, dist, junction: nose + dist, lap: b.lap }
        }
        if (!b.window && cur) { wins.push({ ...cur, ticks: i - cur.i0 }); cur = null }
        if (b.state !== 'run') return { bad: 'left run to ' + b.state }
      }
      return { wins, rows, now: B.now, right: B.right, left: B.left }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.bad) why(got.bad)
    const W = got.wins
    if (W.length < 5) why(`${W.length} windows in 70 s`)
    for (const [k, w] of W.entries()) {
      if (Math.abs(w.dist - 29.7) > 0.3) why(`window ${k} opened ${w.dist.toFixed(3)} u from its junction, not 29.7 +- 0.3`)
      const ms = w.ticks * 1000 / 60
      if (Math.abs(ms - 1400) > 17) why(`window ${k} lasted ${ms.toFixed(1)} ms, not 1400 +- 17`)
      if (w.lap < 1) why(`window ${k} opened on lap ${w.lap}`)
      if (k > 0) {
        if (w.side === W[k - 1].side) why(`windows ${k - 1} and ${k} are both ${w.side}: the sides do not alternate`)
        const gap = w.junction - W[k - 1].junction
        if (Math.abs(gap - 97.47) > 0.15) why(`window ${k}'s junction is ${gap.toFixed(3)} u after window ${k - 1}'s, not every 3rd junction (97.47)`)
      }
    }
    // the board: the words from BOARD, "now" while a window is open, else the next window's side and the whole seconds to it
    const words = { right: got.right, left: got.left }
    let dom = 0
    got.rows.forEach((r, i) => { if (r.dom !== r.board) dom++ })
    if (dom) why(`the hud's #bossBar small differed from the board on ${dom} tick(s)`)
    for (const [k, w] of W.entries()) {
      for (let i = w.i0; i < w.i0 + w.ticks; i++) {
        const want = `${words[w.side]} · ${got.now}`
        if (got.rows[i].board !== want) why(`window ${k}, tick ${i - w.i0} of it: the board reads "${got.rows[i].board}", not "${want}"`)
      }
      const from = k > 0 ? W[k - 1].i0 + W[k - 1].ticks : 0
      for (let i = Math.max(from, w.i0 - 600); i < w.i0; i++) {
        const gap = w.i0 - i
        const r = got.rows[i]
        if (gap / 60 > 9 + 1 / 60) {
          if (r.board !== '') why(`window ${k}: ${(gap / 60).toFixed(2)} s out the board reads "${r.board}", not ''`)
        } else if (gap / 60 < 9) {
          const lo = Math.max(1, Math.ceil((gap - 1) / 60 + 1e-6)), hi = Math.max(1, Math.ceil(gap / 60))
          const ok = [lo, hi].some((n) => r.board === `${words[w.side]} · ${n}`)
          if (!ok) why(`window ${k}: ${(gap / 60).toFixed(2)} s out the board reads "${r.board}", not "${words[w.side]} · ${lo}" or ${hi}`)
        }
      }
    }
    console.log(`INFO K-N4 seed ${seed}: ${W.length} windows, opened ${Math.min(...W.map((w) => w.dist)).toFixed(2)}-${Math.max(...W.map((w) => w.dist)).toFixed(2)} u out, ${[...new Set(W.map((w) => w.ticks))].map((n) => (n * 1000 / 60).toFixed(0)).join('/')} ms long, sides ${W.map((w) => w.side[0]).join('')}`)
  }
})

/** The lever's place: 2.5 u out along x from it, clear of both of its arms' strips and of the buffers. */
const NEAR_LEVER = `
  const leverPos = (side, out = 2.5) => { const l = W.__track().levers[side]; return { x: l.x + (side === 'right' ? out : -out), z: l.z } }
  const untilWindow = (maxS = 40, pin) => until(() => { const b = W.__boss(); return b && b.window && b.window.open }, maxS, pin)
`

check('K-N5', ENG6, async ({ page }) => {
  for (const [pushed, seed] of [[false, 1], [true, 2], [false, 3]]) {
    const got = await inPage(page, RUNNING + WATCH + NEAR_LEVER + `
      if (untilWindow(40) < 0) return { bad: 'no window in 40 s' }
      const side = W.__boss().window.side, t = W.__track()
      const arm = t.arms.find((a) => a.side === side && a.dir === 1)
      const p = leverPos(side)
      let state = W.__boss().state
      W.__still.pos.set(p.x, 0, p.z)
      W.__fire('arms', arg.pushed)
      const thrownAt = W.__boss().window ? W.__boss().window.thrown : null
      const timeline = [], onArm = []
      let last = null, ticksIn = 0, stop = null, hitTaken = null, backV = [], holdOk = null
      for (let i = 0; i < 60 * 12; i++) {
        W.__still.pos.set(p.x, 0, p.z)
        const prev = state
        tick(1)
        observe(prev)
        const b = W.__boss()
        state = b.state
        if (b.state !== last) { timeline.push({ state: b.state, ticks: 0, path: b.path, s: b.s, open: b.open, dir: b.dir }); last = b.state }
        timeline[timeline.length - 1].ticks++
        if (b.state === 'derailed' && stop === null) {
          stop = { s: b.s, path: b.path }
          const hp0 = W.__combat.boss.hp
          W.__combat.boss.hit(10)
          hitTaken = hp0 - W.__combat.boss.hp
          W.__combat.boss.hp = hp0
        }
        if (b.state === 'backing') backV.push(b.s)
        if (b.state === 'siding') {
          for (const s of W.__engineSegs()) {
            const sh = s.shape
            const dist = (x, z) => {
              const ex = arm.buffer.x - arm.junction.x, ez = arm.buffer.z - arm.junction.z, l = Math.hypot(ex, ez)
              return { across: Math.abs((x - arm.junction.x) * ez - (z - arm.junction.z) * ex) / l, along: ((x - arm.junction.x) * ex + (z - arm.junction.z) * ez) / l }
            }
            const a = dist(sh.ax, sh.az), c = dist(sh.bx, sh.bz)
            if (a.across < 1e-6 && c.across < 1e-6 && a.along > -1e-6 && c.along > 0.5 && !onArm.includes(s.id)) onArm.push(s.id)
          }
        }
        if (b.state === 'run' && timeline.length > 1 && timeline.some((x) => x.state === 'hold')) break
      }
      const b = W.__boss()
      return { side, arm: { len: arm.len, side: arm.side, kind: arm.kind }, thrownAt, timeline, stop, hitTaken, backV, onArm: onArm.length, dir: b.dir, honest: honesty(), pushed: arg.pushed,
        junction: arm.junction, end: { x: b.x, z: b.z }, state: b.state }`, { pushed })
    const why = (m) => { throw new Error(`seed ${seed}${pushed ? ' pushed' : ''}: ${m}`) }
    if (got.bad) why(got.bad)
    if (got.thrownAt !== true) why(`the window was not thrown after the cast (${got.thrownAt})`)
    const T = Object.fromEntries(got.timeline.map((x) => [x.state, x]))
    for (const st of ['siding', 'derailed', 'backing', 'hold']) if (!T[st]) why(`never reached ${st}: ${got.timeline.map((x) => x.state).join(' > ')}`)
    if (!got.onArm) why('no strip was laid on the arm line past the junction')
    const stopWant = got.arm.len - 0.6 - 1.5
    if (!got.stop || got.stop.path !== `${got.arm.side}-${got.arm.kind}` || Math.abs(got.stop.s - stopWant) > 0.05) why(`it stopped at ${JSON.stringify(got.stop)}, not ${stopWant.toFixed(2)} along ${got.arm.side}-${got.arm.kind}`)
    const ms = (n) => n * 1000 / 60
    if (Math.abs(ms(T.derailed.ticks) - 1600) > 17) why(`derailed lasted ${ms(T.derailed.ticks).toFixed(1)} ms, not 1600 +- 17`)
    if (!T.derailed.open) why('derailed but not open')
    if (Math.abs(got.hitTaken - 15) > 1e-6) why(`b.hit(10) took ${got.hitTaken} while open, not 15`)
    // backing at 4 u/s, to the junction
    const steps = got.backV.slice(1).map((v, i) => got.backV[i] - v)
    // every step but the last (which stops at the junction) is 4 u/s
    if (steps.slice(0, -1).some((d) => Math.abs(d - 4 / 60) > 0.004)) why(`backing steps ${steps.slice(0, 5)}, not 4/60 = ${(4 / 60).toFixed(4)}`)
    if (Math.abs(ms(T.backing.ticks) - 1000 * stopWant / 4) > 34) why(`backing lasted ${ms(T.backing.ticks).toFixed(1)} ms, not ${(1000 * stopWant / 4).toFixed(0)} for ${stopWant.toFixed(2)} u at 4 u/s`)
    if (Math.abs(ms(T.hold.ticks) - 1300) > 17) why(`hold lasted ${ms(T.hold.ticks).toFixed(1)} ms, not 1300 +- 17`)
    if (T.hold.path !== 'loop') why(`the hold is on ${T.hold.path}`)
    if (got.state !== 'run' || got.dir !== 1) why(`after the hold: ${got.state}, dir ${got.dir}`)
    honestOk(why, got.honest)
    console.log(`INFO K-N5 seed ${seed}${pushed ? ' pushed' : ''}: ${got.timeline.map((x) => `${x.state} ${ms(x.ticks).toFixed(0)}`).join(' > ')}; stop ${got.stop.s.toFixed(2)}; ${got.honest.n} strips, least made-to-armed ${got.honest.minGap.toFixed(1)} ms, ${got.honest.movingTicks} moving ticks in a strip`)
  }
})

check('K-N6', ENG6, async ({ page }) => {
  // nothing that is not a cast in reach of an open lever throws it. Each case is its own level, and a control cast follows where the
  // window is still open (so the case was not silently a refusal for another reason)
  const CASES = {
    // a cast while no window is open, close to the lever, at the very start
    early: `
      const p = leverPos('right')
      W.__still.pos.set(p.x, 0, p.z)
      W.__fire('arms')
      return { window: W.__boss().window }`,
    // the autos on, standing at the lever, then a control cast
    autos: `
      if (untilWindow(40, () => W.__still.pos.set(0, 0, 0)) < 0) return { bad: 'no window' }
      const side = W.__boss().window.side, p = leverPos(side)
      C.autoAttack = true; C.autoTimer = 0
      W.__still.pos.set(p.x, 0, p.z)
      tick(20, () => W.__still.pos.set(p.x, 0, p.z))
      const before = W.__boss().window.thrown
      C.autoAttack = false
      W.__fire('arms')
      return { before, control: W.__boss().window.thrown }`,
    // a cast from 3.2 u
    far: `
      if (untilWindow(40, () => W.__still.pos.set(0, 0, 0)) < 0) return { bad: 'no window' }
      const side = W.__boss().window.side, far = leverPos(side, 3.2), lv = W.__track().levers[side]
      W.__still.pos.set(far.x, 0, far.z)
      W.__fire('arms')
      return { before: W.__boss().window.thrown, dist: Math.hypot(far.x - lv.x, far.z - lv.z), open: W.__boss().window.open }`,
    // a cast while the run is not in the crawl (refused), then a control cast
    phase: `
      if (untilWindow(40, () => W.__still.pos.set(0, 0, 0)) < 0) return { bad: 'no window' }
      const side = W.__boss().window.side, p = leverPos(side)
      W.__still.pos.set(p.x, 0, p.z)
      const phase = W.__run.phase
      W.__run.phase = 'stopping'
      W.__fire('arms')
      const before = W.__boss().window.thrown
      W.__run.phase = phase
      W.__fire('arms')
      return { before, control: W.__boss().window.thrown }`,
  }
  for (const [name, body] of Object.entries(CASES)) {
    const got = await inPage(page, RUNNING + NEAR_LEVER + body, 1)
    const why = (m) => { throw new Error(`${name}: ${m}`) }
    if (got.bad) why(got.bad)
    if (name === 'early' && got.window) why(`a window was open at the start: ${JSON.stringify(got.window)}`)
    if (name === 'far' && (!(got.dist > 3.19) || got.before !== false || !got.open)) why(`a cast from ${got.dist.toFixed(2)} u: thrown ${got.before}, open ${got.open}`)
    if (name === 'autos' && (got.before !== false || got.control !== true)) why(`the autos ${got.before ? 'threw it' : 'did not, but the control cast then did not either'}: ${JSON.stringify(got)}`)
    if (name === 'phase' && (got.before !== false || got.control !== true)) why(`a refused cast: ${JSON.stringify(got)}`)
  }
})

check('K-N7', ENG6, async ({ page }) => {
  for (const seed of [1, 2]) {
    for (const stays of [true, false]) {
      const got = await inPage(page, RUNNING + WATCH + NEAR_LEVER + `
        if (untilWindow(40) < 0) return { bad: 'no window' }
        const side = W.__boss().window.side, t = W.__track()
        const arm = t.arms.find((a) => a.side === side && a.dir === 1)
        // on the arm's centre line 2 u short of its buffer
        const ex = (arm.buffer.x - arm.junction.x) / arm.len, ez = (arm.buffer.z - arm.junction.z) / arm.len
        const spot = { x: arm.buffer.x - ex * 2, z: arm.buffer.z - ez * 2 }
        const lv = t.levers[side]
        const toLever = Math.hypot(spot.x - lv.x, spot.z - lv.z)
        W.__still.pos.set(spot.x, 0, spot.z)
        W.__fire('arms')
        const thrown = W.__boss().window ? W.__boss().window.thrown : null
        // the first arm strip's appearance: the state turns to siding
        let lost = 0, off = 0, appeared = false, state = W.__boss().state
        const nx = -ez, nz = ex, sign = (lv.x - spot.x) * nx + (lv.z - spot.z) * nz >= 0 ? 1 : -1
        for (let i = 0; i < 60 * 9; i++) {
          if (W.__boss().state === 'siding') appeared = true
          if (appeared && !arg.stays && off < 2) {
            off = Math.min(2, off + 5.5 / 60)
            W.__still.pos.set(spot.x + nx * sign * off, 0, spot.z + nz * sign * off)
          } else if (!appeared || arg.stays) W.__still.pos.set(spot.x, 0, spot.z)
          const prev = state
          lost += tick(1)
          observe(prev); state = W.__boss().state
        }
        return { thrown, lost, toLever, dmg, honest: honesty() }`, { stays })
      const why = (m) => { throw new Error(`seed ${seed}${stays ? ' staying' : ' walking off'}: ${m}`) }
      if (got.bad) why(got.bad)
      if (got.toLever > 3.0) why(`the spot is ${got.toLever.toFixed(2)} u from the lever`)
      if (got.thrown !== true) why('the wrong throw did not throw')
      if (stays && Math.abs(got.lost - got.dmg) > 1e-6) why(`staying on the arm cost ${got.lost} HP, not one hit of ${got.dmg}`)
      if (!stays && got.lost !== 0) why(`walking 2 u off the line at the first arm strip still cost ${got.lost} HP`)
    }
  }
})

// --- Steam and the cinder (C6) -----------------------------------------------------------------------------------------

/** In the page: a strip's containment (grown by `grow`), and a point's distance to a box. */
const GEO = `
  const stripHas = (s, x, z, grow = 0) => {
    const vx = s.bx - s.ax, vz = s.bz - s.az, len = Math.hypot(vx, vz)
    if (len < 1e-6) return false
    const along = ((x - s.ax) * vx + (z - s.az) * vz) / len, across = Math.abs((x - s.ax) * vz - (z - s.az) * vx) / len
    return along >= 0 && along <= len && across <= s.halfW + grow
  }
  const boxDist = (b, x, z) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ))
`

/** K-N8's setup: the Engine of III at 6 with the steam on (the cinder off), woken and running. `arg.gap` = the steam's gap [lo, hi] s. */
const STEAMING = `
  enterEngine('III', 6, arg.seed, { steam: true, gap: arg.gap })
  const { c, away } = roomOf()
  wake()
  // the four inner walls (dungeon.ts: the yard's, unchanged in the roundhouse)
  const inner = [[-6.5, 0, 'z'], [6.5, 0, 'z'], [0, -6.5, 'x'], [0, 6.5, 'x']].map(([ox, oz, al]) => {
    const x = c.x + ox, z = c.z + oz
    return al === 'z' ? { minX: x - 0.35, maxX: x + 0.35, minZ: z - 2, maxZ: z + 2 } : { minX: x - 2, maxX: x + 2, minZ: z - 0.35, maxZ: z + 0.35 }
  })
  const B = () => W.__combat.boss
  /**
   * seconds of ticks with Still put where place(i) says before each; every steam recorded from its booking to its end: the booking's
   * conditions (range, dot against its facing, how many lit strips he stood in grown 0.42), the ticks its attack lasted with the cue and
   * phase of each, the strip when it is made, and the phase on the tick it arms. refused counts the ticks the rules turned a steam away.
   */
  const watch = (seconds, place) => {
    const steams = [], refused = { behind: 0, lit: 0 }
    let cur = null, prevAtk = 'none'
    for (let i = 0; i < seconds * 60; i++) {
      place(i)
      const yaw = B().group.rotation.y
      const pre = W.__engineSegs().filter((g) => !g.done)
      tick(1)
      const b = W.__boss(), atk = b.attack, still = W.__still.pos
      const dx = still.x - b.x, dz = still.z - b.z, d = Math.hypot(dx, dz), dot = dx * Math.sin(yaw) + dz * Math.cos(yaw)
      const post = W.__engineSegs().filter((g) => !g.done)
      const lit = pre.concat(post).filter((g) => stripHas(g.shape, still.x, still.z, 0.42)).length
      if (prevAtk === 'none' && atk === 'none' && b.state === 'run' && d <= 8) {
        if (dot < -1.5 - 0.05 && !lit) refused.behind++
        if (dot >= -1.5 + 0.05 && lit) refused.lit++
      }
      if (prevAtk === 'none' && atk === 'steamTrack') {
        cur = { i, d, dot, lit, state: b.state, windupMs: B().windupMs, ticks: 0, cues: [], phases: [], hazard: null, armPhase: null }
        steams.push(cur)
      }
      if (cur && atk !== 'none') {
        cur.ticks++
        cur.cues.push(B().cue.voice)
        cur.phases.push(B().phase)
        if (prevAtk === 'steamTrack' && atk === 'steamLock') {
          const h = W.__hazards().filter((x) => x.source === 'steam' && !x.done).pop()
          cur.hazard = h ? { shape: h.shape, armIn: h.armIn, damage: h.damage } : null
          cur.eng = { x: b.x, z: b.z }
          cur.dmgMul = b.dmgMul
        }
        if (cur.hazard && cur.armPhase === null) {
          const h = W.__hazards().filter((x) => x.source === 'steam').pop()
          if (h && h.armIn <= 1e-6) cur.armPhase = B().phase
        }
      }
      if (cur && atk === 'none') cur = null
      prevAtk = atk
    }
    return { steams, refused, inner }
  }
`

check('K-N8', ENG6, async ({ page }) => {
  const T = (body, arg) => inPage(page, GEO + STEAMING + body, arg)
  const ms = (n) => n * 1000 / 60
  // a jet booked at range must reach the point it aims at (ENGINE-N17.md 2): len >= range + leadMax
  const st = await evalJson(page, () => ({ len: window.__ENGINE.steam.len, range: window.__ENGINE.steam.range, leadMax: window.__ENGINE.steam.leadMax }))
  if (st.len < st.range + st.leadMax) throw new Error(`steam.len ${st.len} is under range ${st.range} + leadMax ${st.leadMax}: a strip booked at range stops short of the point it aims at`)
  let cutSeen = 0, uncutSeen = 0
  for (const seed of [1, 2]) {
    // A. Still at c + (0, 5), the inner wall (c + (0, 6.5)) between him and the +z straight: the natural rhythm, 100 s
    const a = await T(`return watch(100, () => W.__still.pos.set(c.x, 0, c.z + 5))`, { seed })
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (a.steams.length < 4) why(`${a.steams.length} steams in 100 s`)
    a.steams.forEach((k, n) => {
      const w = `steam ${n}`
      if (k.d > 8 + 0.2) why(`${w} began with Still ${k.d.toFixed(2)} u away, past 8`)
      if (k.dot < -1.5 - 0.05) why(`${w} began with Still behind it (dot ${k.dot.toFixed(2)} < -1.5)`)
      if (k.lit) why(`${w} began with Still inside ${k.lit} lit strip(s) grown 0.42`)
      if (k.state !== 'run') why(`${w} began in state ${k.state}`)
      if (Math.abs(ms(k.ticks) - 950) > 17) why(`${w}: the windup lasted ${ms(k.ticks).toFixed(1)} ms, not 950 (250 + 700) +- 17`)
      if (k.windupMs !== 950) why(`${w}: windupMs is ${k.windupMs}`)
      if (k.cues.some((x) => x !== 'windup')) why(`${w}: the cue was ${[...new Set(k.cues)]}, not 'windup'`)
      if (k.phases.slice(0, -1).some((x) => x !== 'windup') || k.phases[k.phases.length - 1] !== 'strike') why(`${w}: the phases were ${k.phases.join(',')}, not windup then a strike on the last`)
      if (k.armPhase !== 'strike') why(`${w}: the phase on the tick the jet armed was ${k.armPhase}, not 'strike'`)
      if (!k.hazard) why(`${w}: no steam hazard at the lock`)
      // made at the lock with armMs 700 (the tick that made it has counted one tick of it), from the engine's centre at the lock
      if (Math.abs(k.hazard.armIn + 1000 / 60 - 700) > 0.01) why(`${w}: the strip's armMs was ${(k.hazard.armIn + 1000 / 60).toFixed(3)}, not 700`)
      const sh = k.hazard.shape
      if (Math.hypot(sh.ax - k.eng.x, sh.az - k.eng.z) > 1e-6) why(`${w}: the strip starts (${sh.ax.toFixed(3)}, ${sh.az.toFixed(3)}), not at the engine's centre (${k.eng.x.toFixed(3)}, ${k.eng.z.toFixed(3)}) at the lock`)
      if (Math.abs(sh.halfW - 1.3) > 1e-9) why(`${w}: halfW ${sh.halfW}, not 1.3`)
      if (Math.abs(k.hazard.damage - 14 * k.dmgMul) > 1e-9) why(`${w}: damage ${k.hazard.damage}, not 14 x bossDmg = ${14 * k.dmgMul}`)
      const len = Math.hypot(sh.bx - sh.ax, sh.bz - sh.az)
      if (len < st.len - 0.1) {
        // cut: it ends at the first solid, 0.1 to 0.2 short of the wall's face (the march is 0.1 a step with a pad of 0.1)
        const dist = Math.min(...a.inner.map((b) => {
          return Math.hypot(Math.max(b.minX - sh.bx, 0, sh.bx - b.maxX), Math.max(b.minZ - sh.bz, 0, sh.bz - b.maxZ))
        }))
        if (!(dist <= 0.22 && dist > 0.05)) why(`${w}: cut to ${len.toFixed(2)} u but its end is ${dist.toFixed(3)} from the nearest wall, not within 0.2`)
        cutSeen++
      } else {
        if (Math.abs(len - st.len) > 0.11) why(`${w}: an uncut strip ${len.toFixed(3)} u long, not ${st.len}`)
        uncutSeen++
      }
    })
    for (let n = 1; n < a.steams.length; n++) {
      const gap = ms(a.steams[n].i - a.steams[n - 1].i)
      if (gap < 6000 - 0.1) why(`steams ${n - 1} and ${n} began ${gap.toFixed(1)} ms apart, under 6000`)
      if (gap > 9000 + 6000) why(`steams ${n - 1} and ${n} began ${gap.toFixed(1)} ms apart`)
    }
    console.log(`INFO K-N8 seed ${seed}: ${a.steams.length} steams in 100 s, gaps ${a.steams.slice(1).map((k, n) => (ms(k.i - a.steams[n].i) / 1000).toFixed(2)).join(' ')} s, windup ${[...new Set(a.steams.map((k) => ms(k.ticks).toFixed(0)))]} ms`)

    // B. gap 0: it steams whenever it may, so the rules are what turn it away. Still at the same place: the engine passes him
    const b = await T(`return watch(40, () => W.__still.pos.set(c.x, 0, c.z + 5))`, { seed, gap: [0, 0] })
    if (b.steams.length < 3) why(`with no gap only ${b.steams.length} steams in 40 s`)
    if (b.refused.behind < 5) why(`the not-behind rule turned it away on only ${b.refused.behind} ticks (the engine should pass behind him in range every lap)`)
    b.steams.forEach((k, n) => {
      if (k.dot < -1.5 - 0.05) why(`no gap, steam ${n} began with Still behind it (dot ${k.dot.toFixed(2)})`)
      if (k.lit) why(`no gap, steam ${n} began with Still in ${k.lit} lit strip(s)`)
    })
    // C. Still on its own lit rail (c + (0, 9), the +z straight): it never steams a Still it is about to run over
    const l = await T(`return watch(40, () => W.__still.pos.set(c.x, 0, c.z + 9))`, { seed, gap: [0, 0] })
    if (l.steams.length) why(`${l.steams.length} steam(s) began with Still standing on its lit rail (first: d ${l.steams[0].d.toFixed(2)}, lit ${l.steams[0].lit})`)
    if (l.refused.lit < 5) why(`the lit-path rule turned it away on only ${l.refused.lit} ticks`)
    console.log(`INFO K-N8 seed ${seed}: no gap: ${b.steams.length} steams, ${b.refused.behind} ticks refused as behind; on the rail: ${l.refused.lit} ticks refused as lit`)
  }
  if (!cutSeen) throw new Error('no steam met an inner wall in 200 s (the cut was not exercised)')
  console.log(`INFO K-N8: ${cutSeen} cut strips, ${uncutSeen} uncut`)
})

// K-N17's bots, in the page. They walk their own pos each tick (Still's velocity is the position delta), the Engine's HP put back
// (phase 1 held). camp: planted at c. circle: r 12 round c at 5.5 u/s, outside the loop. dodge: circles, and steps out of a steam strip
// or a cinder ring by the shortest way 300 ms after one exists (a player's reaction); it is hit by nothing if the escape works.
const BOTS = GEO + `
  const bot = (kind, seconds) => {
    const { c, away } = roomOf()
    const R = 12, SPD = 5.5, M = 0.5
    let th = Math.atan2(-away.z, -away.x)
    const p = kind === 'campdodge' ? { x: c.x, z: c.z } : { x: c.x + R * Math.cos(th), z: c.z + R * Math.sin(th) }
    let lost = 0, prevAtk = 'none'
    const n = { steams: 0, cinders: 0, steamHits: 0, cinderHits: 0 }
    const hitKeys = new Set()
    const inside = (h, x, z, grow) => {
      const s = h.shape
      if (s.kind === 'circle') return Math.hypot(x - s.x, z - s.z) < s.r + grow
      return stripHas(s, x, z, grow)
    }
    // the dodger reacts like a player (the slack rule's 300 ms): a threat is stepped away from once it has been on the floor 18 ticks
    const firstSeen = new Map()
    const keyOf = (h) => h.source + ':' + JSON.stringify(h.shape)
    for (let i = 0; i < seconds * 60; i++) {
      W.__combat.boss.hp = W.__combat.boss.maxHp
      const live = kind === 'dodge' || kind === 'campdodge' ? W.__hazards().filter((h) => !h.done && (h.source === 'steam' || h.source === 'shell')) : []
      for (const h of live) if (!firstSeen.has(keyOf(h))) firstSeen.set(keyOf(h), i)
      const threats = live.filter((h) => i - firstSeen.get(keyOf(h)) >= 18)
      if (kind === 'camp') { p.x = c.x; p.z = c.z }
      else if (kind === 'circle') { th += SPD / R / 60; p.x = c.x + R * Math.cos(th); p.z = c.z + R * Math.sin(th) }
      else {
        // its train strips (lit, armed or live) are never stepped into either: the dodger keeps off the rails as any player would
        const rails = W.__engineSegs().filter((g) => !g.done)
        const railed = (x, z, grow = 0) => rails.some((g) => stripHas(g.shape, x, z, grow))
        let esc = null
        for (const h of threats) {
          const s = h.shape
          // the ways out, each a unit direction and the distance it takes; the shortest that does not end on a rail
          const ways = []
          if (s.kind === 'circle') {
            if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + M) {
              // (dead centre has no radial way out: take +x)
              const d0 = Math.hypot(p.x - s.x, p.z - s.z), dx = d0 < 1e-6 ? 1 : p.x - s.x, dz = d0 < 1e-6 ? 0 : p.z - s.z, d = Math.hypot(dx, dz)
              ways.push({ x: dx / d, z: dz / d, len: s.r + M - d0 })
              ways.push({ x: -dz / d, z: dx / d, len: (s.r + M) * 1.6 }, { x: dz / d, z: -dx / d, len: (s.r + M) * 1.6 })
            }
          } else {
            const vx = s.bx - s.ax, vz = s.bz - s.az, len = Math.hypot(vx, vz), ux = vx / len, uz = vz / len
            const along = (p.x - s.ax) * ux + (p.z - s.az) * uz, cross = (p.x - s.ax) * uz - (p.z - s.az) * ux
            if (along >= -M && along <= len + M && Math.abs(cross) < s.halfW + M) {
              const side = cross >= 0 ? 1 : -1
              ways.push({ x: uz * side, z: -ux * side, len: s.halfW + M - Math.abs(cross) })
              ways.push({ x: -uz * side, z: ux * side, len: s.halfW + M + Math.abs(cross) })
              ways.push({ x: -ux, z: -uz, len: along + M }, { x: ux, z: uz, len: len - along + M })
            }
          }
          ways.sort((a, b) => a.len - b.len)
          const way = ways.find((w) => !railed(p.x + w.x * (w.len + 0.5), p.z + w.z * (w.len + 0.5), 0.3)) || ways[0]
          if (way) esc = way
        }
        if (esc) { p.x += esc.x * SPD / 60; p.z += esc.z * SPD / 60 }
        else {
          // home: on round the circle, or (the camper that dodges) back to c
          const a = Math.atan2(p.z - c.z, p.x - c.x) + 0.25
          const tx = (kind === 'campdodge' ? c.x : c.x + R * Math.cos(a)) - p.x, tz = (kind === 'campdodge' ? c.z : c.z + R * Math.sin(a)) - p.z, tl = Math.hypot(tx, tz)
          const nx = p.x + (tl > 0.1 ? tx / tl : 0) * SPD / 60, nz = p.z + (tl > 0.1 ? tz / tl : 0) * SPD / 60
          // never step into any threat, seen yet or not: wait at its edge
          if (!live.some((h) => inside(h, nx, nz, M))) { p.x = nx; p.z = nz }
        }
      }
      W.__still.pos.set(p.x, 0, p.z)
      lost += tick(1)
      const atk = W.__boss().attack
      if (prevAtk === 'none' && atk === 'steamTrack') n.steams++
      if (prevAtk === 'none' && atk === 'cinderAim') n.cinders++
      prevAtk = atk
      for (const h of W.__hazards()) {
        if ((h.source !== 'steam' && h.source !== 'shell') || !h.hit.includes('still')) continue
        const key = h.source + ':' + h.shape.kind + ':' + (h.shape.ax !== undefined ? h.shape.ax.toFixed(3) + ',' + h.shape.az.toFixed(3) : h.shape.x.toFixed(3) + ',' + h.shape.z.toFixed(3))
        if (hitKeys.has(key)) continue
        hitKeys.add(key)
        if (h.source === 'steam') n.steamHits++; else n.cinderHits++
      }
    }
    return { lost, ...n }
  }
`

/** K-N17's runs, [name, group]: what each bot lost, for the mean at the end of the last part. */
const N17 = { camp: [], circle: [], dodge: [], campdodge: [], campOff: [], circleOff: [] }
const N17CONFIGS = { ENG6: [['III', 6]], ENG9: [['III', 6], ['II', 9]] }

async function circling(page, which) {
  // a what-if without editing the code: N17_SET='{"cinder.leadS":1,"steam.len":11}' sets those ENGINE numbers for the run
  // (enterEngine resets only the range, gap, cinder timing, guess.first and speed)
  if (process.env.N17_SET) await page.evaluate((set) => { for (const [k, v] of Object.entries(set)) { const [a, b] = k.split('.'); window.__ENGINE[a][b] = v } }, JSON.parse(process.env.N17_SET))
  for (const [order, depth] of N17CONFIGS[which]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      for (const [name, kind, opts] of [
        ['camp', 'camp', { steam: true, cinder: true }], ['circle', 'circle', { steam: true, cinder: true }], ['dodge', 'dodge', { steam: true, cinder: true }],
        ['campdodge', 'campdodge', { steam: true, cinder: true }], ['campOff', 'camp', { steam: true, blind: true }], ['circleOff', 'circle', { steam: true, blind: true }],
      ]) {
        const got = await inPage(page, BOTS + `
          enterEngine(arg.order, arg.depth, arg.seed, arg.opts)
          wake()
          return bot(arg.kind, 45)`, { order, depth, seed, kind, opts })
        N17[name].push({ ...got, group: `${which} ${order}@${depth}`, seed })
        if ((name === 'dodge' || name === 'campdodge') && (got.steamHits || got.cinderHits)) {
          throw new Error(`${order} at ${depth}, seed ${seed}: the dodging bot (${name}) was hit by ${got.steamHits} steam(s) and ${got.cinderHits} cinder(s): the escape does not work`)
        }
      }
    }
  }
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1)
const N17LINE = (name, rows) => {
  const groups = [...new Set(rows.map((r) => r.group))]
  return `${name} ${mean(rows.map((r) => r.lost)).toFixed(1)} HP over ${rows.length} runs [${groups.map((g) => `${g} ${mean(rows.filter((r) => r.group === g).map((r) => r.lost)).toFixed(1)}`).join('; ')}]; ${mean(rows.map((r) => r.steams)).toFixed(1)} steams, ${mean(rows.map((r) => r.cinders)).toFixed(1)} cinders per run`
}

check('K-N17', ENG6, async ({ page }) => circling(page, 'ENG6'))
check('K-N17', ENG9, async ({ page }) => {
  await circling(page, 'ENG9')
  // the means, over every run of both queries: the camp and the circle each lose 20 HP in 45 s or more (else they are trivially dodged)
  for (const [name, rows] of Object.entries(N17)) console.log(`INFO K-N17 ${N17LINE(name, rows)}`)
  const camp = mean(N17.camp.map((r) => r.lost)), circle = mean(N17.circle.map((r) => r.lost))
  // ENGINE-N17.md 4: the circle costs 40-85 (over the floor player's budget rate, under the Arbiter's accepted range), the camp 50-95
  // (zero input is taxed, but planting is not a death inside 45 s), and moving is never the worse non-answer
  if (circle < 40 || circle > 85) throw new Error(`the circling bot lost ${circle.toFixed(1)} HP in 45 s on average, outside 40-85`)
  if (camp < 50 || camp > 95) throw new Error(`the camping bot lost ${camp.toFixed(1)} HP in 45 s on average, outside 50-95`)
  if (circle > camp) throw new Error(`the circling bot (${circle.toFixed(1)} HP) lost more than the camping one (${camp.toFixed(1)}): moving is the worse non-answer`)
})

// The cinder's period at c (camp): the time between two cinderAim starts, in each phase. A launch resets both clocks, so it is
// max(outrun.afterMs[phase], cooldownMs) + windupMs (8.12 s in phase 1 and 5.62 s in phase 2 as ENGINE stands), and phase 2 must be shorter
// (phase 2 is reached by HP below phase2At as in the game; its wagon is stopped, as a derail into one drops an aim in progress and delays the next):
// afterMs[1] going dead again (a cooldown that swallows it) would show as the two equal.
check('K-N17', ENG6, async ({ page }) => {
  const means = []
  for (const phase2 of [false, true]) {
    const got = await inPage(page, `
      enterEngine('III', 6, 1, { steam: true, cinder: true })
      wake()
      const { c } = roomOf()
      // phase 2 is reached as in the game, by HP below phaseAt (C7); phase 1's HP is held at full
      const hold = W.__combat.boss.maxHp * (arg.phase2 ? 0.5 : 1)
      const starts = []
      let prev = 'none'
      for (let i = 0; i < 90 * 60; i++) {
        W.__combat.boss.hp = hold
        W.__still.pos.set(c.x, 0, c.z)
        tick(1)
        // phase 2 has begun on that first tick; its wagon (a derail drops a cinder being aimed and holds the next) is not what is measured
        if (i === 0 && arg.phase2) W.__combat.boss.wagonIn = 1e9
        const a = W.__boss().attack
        if (prev === 'none' && a === 'cinderAim') starts.push(i)
        prev = a
      }
      return { starts, phase2: W.__combat.boss.phase2, E: { after: W.__ENGINE0.afterMs, cool: W.__ENGINE.outrun.cooldownMs, wind: W.__ENGINE.cinder.windupMs } }`, { phase2 })
    if (got.phase2 !== phase2) throw new Error(`phase 2 is ${got.phase2} after holding HP at ${phase2 ? 'half' : 'full'}`)
    const E = got.E
    if (got.starts.length < 4) throw new Error(`phase ${phase2 ? 2 : 1}: only ${got.starts.length} cinders in 90 s`)
    const want = (Math.max(E.after[phase2 ? 1 : 0], E.cool) + E.wind) / 1000
    const gaps = got.starts.slice(1).map((x, n) => (x - got.starts[n]) / 60)
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
    console.log(`INFO K-N17 cinder period at c, phase ${phase2 ? 2 : 1}: ${mean.toFixed(2)} s (${gaps.map((g) => g.toFixed(2)).join(' ')}); expected ${want.toFixed(2)}`)
    means.push(mean)
    if (Math.abs(mean - want) > 0.1) throw new Error(`the cinder period in phase ${phase2 ? 2 : 1} is ${mean.toFixed(2)} s, not ${want.toFixed(2)}`)
  }
  if (!(means[1] < means[0] - 0.5)) throw new Error(`the phase-2 cinder period (${means[1].toFixed(2)} s) is not shorter than phase 1's (${means[0].toFixed(2)} s)`)
})

// K-N18: the Engine slowed to a crawl (a stationary turret) on the test floor, so the geometry is exact: Still walks x = 3 from z = -5 at
// 5.5 u/s (it is at (9, 0), 6 away, and only books him once he is not behind it), and the steam must lead him, then learn.
const TURRET = GEO + `
  resetEngine({ steam: true, gap: [0, 0] })
  W.__ENGINE.speed = 0.001
  W.__hold(true)
  W.__arena({})
  W.__equip('scrap-cleaver')
  C.autoAttack = false; C.autoTimer = 0; C.counters = false; C.breakRule = false; C.eye = false
  W.__stick(0, 0)
  W.__still.pos.set(3, 0, -5)
  W.__spawn('boss', 9, 0, false, undefined, 'engine')
  if (until(() => W.__boss() && W.__boss().state === 'run', 5) < 0) throw new Error('the turret did not run')
  const trial = (mode) => {
    W.__still.pos.set(-8, 0, -8)
    if (until(() => W.__boss().attack === 'none', 3) < 0) throw new Error('the last steam did not end')
    tick(3)
    let z = -5, locked = null, hit = false, lost = 0
    W.__still.pos.set(3, 0, z)
    for (let i = 0; i < 60 * 5; i++) {
      if (!locked || mode === 'go') { z += 5.5 / 60; W.__still.pos.set(3, 0, z) }
      lost += tick(1)
      const b = W.__boss()
      for (const h of W.__hazards()) if (h.source === 'steam' && h.hit.includes('still')) hit = true
      if (!locked && b.attack === 'steamLock') {
        const h = W.__hazards().filter((x) => x.source === 'steam' && !x.done).pop()
        const s = W.__still.pos
        locked = { guess: b.guess, lead: { x: b.lead.x, z: b.lead.z }, still: { x: s.x, z: s.z }, shape: h && h.shape, inStrip: h ? stripHas(h.shape, s.x, s.z, 0) : null }
      }
      if (locked && b.attack === 'none') {
        return { mode, ...locked, after: b.guess, answers: b.answers.map((a) => Math.round(a * 1e6) / 1e6), hit, lost }
      }
    }
    throw new Error('a ' + mode + ' trial never finished its steam (locked ' + JSON.stringify(locked) + ')')
  }
  const out = []
  for (const mode of arg.modes) out.push(trial(mode))
  return out
`
const N18_MODES = ['go', 'stop', 'stop', 'stop', 'stop', 'go', 'go', 'go']

check('K-N18', ARENA, async ({ page }) => {
  const runs = []
  for (let rep = 0; rep < 2; rep++) runs.push(await inPage(page, TURRET, { modes: N18_MODES }))
  const t = runs[0]
  // the first lock: guess 1, walking straight on: the aim point is min(leadMax 3, 5.5 x 0.95) ahead of him, along his line
  const first = t[0]
  const ahead = Math.hypot(first.lead.x - first.still.x, first.lead.z - first.still.z)
  if (first.guess !== 1) throw new Error(`the first lock's guess was ${first.guess}, not 1`)
  // nothing in the test floor to cut it: a full 11 u strip, from the engine's centre (9, 0), 1.3 either side
  const firstLen = Math.hypot(first.shape.bx - first.shape.ax, first.shape.bz - first.shape.az)
  if (Math.abs(firstLen - 11) > 0.11 || Math.abs(first.shape.ax - 9) > 0.05 || Math.abs(first.shape.az) > 0.05) throw new Error(`the first strip is ${firstLen.toFixed(3)} u long from (${first.shape.ax.toFixed(2)}, ${first.shape.az.toFixed(2)}), not 11 from (9, 0)`)
  if (Math.abs(ahead - Math.min(3, 5.5 * 0.95)) > 0.3) throw new Error(`the first lock's aim point is ${ahead.toFixed(3)} ahead of him, not ${Math.min(3, 5.5 * 0.95)} +- 0.3`)
  if (!(first.lead.z - first.still.z > ahead - 0.3) || Math.abs(first.lead.x - first.still.x) > 0.3) throw new Error(`the first aim point (${first.lead.x.toFixed(2)}, ${first.lead.z.toFixed(2)}) is not ahead of Still (${first.still.x.toFixed(2)}, ${first.still.z.toFixed(2)}) along +z`)
  // three locks where he stops dead: the guess falls to <= 0.5 (its memory is all stopped answers) and a stopped Still is in the next strip
  if (t[3].after > 0.5) throw new Error(`after three stops the guess is ${t[3].after}, over 0.5 (answers ${JSON.stringify(t[3].answers)})`)
  if (t[3].answers.some((a) => Math.abs(a) > 1e-6)) throw new Error(`after three stops its answers are ${JSON.stringify(t[3].answers)}, not zeros`)
  const next = t[4]
  if (next.guess > 0.5) throw new Error(`the 5th lock used guess ${next.guess}`)
  if (!next.inStrip) throw new Error(`a stopped Still is not inside the next strip (${JSON.stringify(next)})`)
  if (!next.hit || next.lost <= 0) throw new Error(`a stopped Still inside the strip was not hit (lost ${next.lost}, hit ${next.hit})`)
  // the same seed, the same guesses
  if (JSON.stringify(runs[0]) !== JSON.stringify(runs[1])) throw new Error(`two runs of the same seed differ: ${runs[0].map((r) => r.guess)} vs ${runs[1].map((r) => r.guess)}`)
  console.log(`INFO K-N18: guesses used ${t.map((r) => r.guess).join(', ')}; first lead ${ahead.toFixed(2)} ahead; stopped answers ${JSON.stringify(t[3].answers)}; the 5th lock caught him standing (lost ${next.lost.toFixed(1)}); two runs identical`)
})

// --- Phase 2 (C7) ------------------------------------------------------------------------------------------------------

/**
 * In the page, phase 2 reached as in the game: the Engine's HP put below 55% and two ticks (the flag goes up on the first). `toPhase2`
 * then optionally stops the reversal clock, or the wagon's, by poking the clocks it started (the private fields, which a DEV page can reach).
 * `loopParam(x, z)`: the loop parameter nearest a point (track.ts loopS, again here); `ahead(b, x, z)`: how far along its way, in u, the point is from the nose.
 */
const PHASE2 = `
  const toPhase2 = (o = {}) => {
    const B = W.__combat.boss
    B.hp = B.maxHp * 0.5
    tick(2)
    if (!B.phase2) throw new Error('phase 2 did not begin')
    if (o.noReverse) B.reverseIn = 1e9
    if (o.noWagon) B.wagonIn = 1e9
    return B
  }
  const loopParam = (x, z) => {
    const t = W.__track()
    let best = Infinity, bs = 0
    for (let i = 0; i < t.loop.length; i++) {
      const a = t.loop[i], q = t.loop[(i + 1) % t.loop.length], ex = q.x - a.x, ez = q.z - a.z, len = Math.hypot(ex, ez)
      const u = Math.max(0, Math.min(len, ((x - a.x) * ex + (z - a.z) * ez) / len))
      const d = Math.hypot(x - (a.x + ex / len * u), z - (a.z + ez / len * u))
      if (d < best) { best = d; bs = t.vertexS[i] + u }
    }
    return bs
  }
  const aheadOf = (b, x, z) => {
    const L = W.__track().loopLen
    return ((((loopParam(x, z) - (b.s + b.dir * 1.5)) * b.dir) % L) + L) % L
  }
  const events = (from, what) => W.__enemyLog.slice(from).filter((x) => x.ev.kind === 'engine' && (!what || x.ev.what === what))
`

check('K-N10', ENG6, async ({ page }) => {
  for (const seed of [1, 2]) {
    const got = await inPage(page, RUNNING + PHASE2 + `
      const B = W.__combat.boss
      const logAt = W.__enemyLog.length
      const out = { flags: [], banners: [] }
      const banner = () => { const e = document.querySelector('#banner'); return e ? { text: e.textContent, shown: e.classList.contains('show') } : null }
      const step = (n, keep) => { for (let i = 0; i < n; i++) { W.__still.pos.set(c.x, 0, c.z); B.hp = keep(B.hp); tick(1); out.flags.push(B.justPhase2 ? 1 : 0) } }
      // 1. phase 1 for 20 s, HP exactly at the line (55% is not below it): no phase 2, no reversal, no wagon
      const line = B.maxHp * 0.55
      step(60 * 20, () => line)
      out.p1 = { phase2: B.phase2, just: out.flags.some((f) => f), events: events(logAt).map((x) => x.ev.what).filter((w) => ['phase2', 'judder', 'flip', 'wagon'].includes(w)) }
      out.flags.length = 0
      // 2. a hair below it: the flag is up for exactly one tick, the event once, the banner is the boss's words
      const t0 = W.__combat.time
      step(1, () => line - 0.01)
      out.banner1 = banner()
      step(60 * 20, (hp) => hp)
      out.flagTicks = out.flags.reduce((a, f) => a + f, 0)
      out.firstFlag = out.flags.indexOf(1)
      out.phase2 = B.phase2
      const ev = events(logAt)
      out.phase2Events = ev.filter((x) => x.ev.what === 'phase2').length
      out.copy = W.__BOSS_COPY.engine.phase2
      // the clocks start with it: the first wagon 4 s after, the first reversal 8-12 s after (when it can be, in run with no window open)
      const t1 = ev.find((x) => x.ev.what === 'phase2')
      out.t2 = t1 ? t1.t : null
      out.wagonAt = (ev.find((x) => x.ev.what === 'wagon') || {}).t
      out.judderAt = (ev.find((x) => x.ev.what === 'judder') || {}).t
      out.logKeys = Object.keys(ev[0] || {})
      return out`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.p1.phase2 || got.p1.just || got.p1.events.length) why(`with HP exactly at 55% for 20 s: phase2 ${got.p1.phase2}, just ${got.p1.just}, events ${got.p1.events}`)
    if (got.flagTicks !== 1 || got.firstFlag !== 0) why(`justPhase2 was up on ${got.flagTicks} tick(s), the first at index ${got.firstFlag}, not exactly one at the tick HP went below 55%`)
    if (!got.phase2) why('phase2 is not set')
    if (got.phase2Events !== 1) why(`${got.phase2Events} phase2 events, not 1`)
    if (!got.banner1 || got.banner1.text !== got.copy || !got.banner1.shown) why(`the banner on that tick is ${JSON.stringify(got.banner1)}, not "${got.copy}" shown`)
    if (got.wagonAt === undefined || got.judderAt === undefined) why(`in 20 s of phase 2: wagon at ${got.wagonAt}, judder at ${got.judderAt}`)
    const wagonS = got.wagonAt - got.t2, judderS = got.judderAt - got.t2
    if (Math.abs(wagonS - 4) > 0.05) why(`the first wagon came ${wagonS.toFixed(3)} s after phase 2 began, not 4.00`)
    if (judderS < 8 - 0.05) why(`the first reversal came ${judderS.toFixed(3)} s after phase 2 began, under 8`)
    console.log(`INFO K-N10 seed ${seed}: banner "${got.copy}"; the first wagon ${wagonS.toFixed(2)} s and the first reversal ${judderS.toFixed(2)} s after phase 2 began`)
  }
})

check('K-N11', ENG6, async ({ page }) => {
  for (const seed of [1, 2]) {
    // A. 200 s of reversals with Still at c: the judder, its takeBack, the flip and the hold
    const a = await inPage(page, RUNNING + WATCH + PHASE2 + `
      const B = toPhase2({ noWagon: true })
      const logAt = W.__enemyLog.length
      const revs = []
      let cur = null, after = null, prevDir = W.__boss().dir
      let winMax = 0
      for (let i = 0; i < 60 * 200; i++) {
        W.__still.pos.set(c.x, 0, c.z)
        const before = W.__engineSegs()
        const pb = W.__boss()
        tick(1); observe(pb.state)
        const b = W.__boss(), segs = W.__engineSegs()
        if (b.window) winMax = Math.max(winMax, b.window.msOpen)
        if (pb.state !== 'judder' && b.state === 'judder') {
          cur = {
            i0: i, dirBefore: pb.dir, judderTicks: 0, holdTicks: 0, bad: 0,
            unarmed: before.filter((g) => g.source === 'train' && !g.done && g.armIn > 1e-6).map((g) => g.id), maxId: Math.max(-1, ...before.map((g) => g.id)),
            keptArmed: segs.filter((g) => g.source === 'train' && !g.done && g.armIn <= 1e-6).length, madeDuring: 0, armedFromUnarmed: 0, alive: 0,
          }
          revs.push(cur)
        }
        if (cur) {
          if (b.state === 'judder') cur.judderTicks++
          // nothing it lit for the way it was going arms while it stands, nor is anything new laid
          for (const g of segs) {
            if (cur.unarmed.includes(g.id)) { cur.alive++; if (g.armIn <= 1e-6) cur.armedFromUnarmed++ }
            if (b.state === 'judder' && g.id > cur.maxId) cur.madeDuring++
          }
          if (b.state === 'hold' && pb.state !== 'judder' && cur.holdTicks === 0 && pb.state === 'hold') cur.bad++
          if (pb.state === 'judder' && b.state === 'hold') { cur.dirAfter = b.dir; cur.holdTicks = 0; cur.holdFrom = i; cur.maxIdAtFlip = Math.max(-1, ...segs.map((g) => g.id)) }
          if (b.state === 'hold' && cur.holdFrom !== undefined) cur.holdTicks++
          if (cur.holdFrom !== undefined && b.state !== 'hold') { cur.holdEnd = b.state; cur = null }
        }
      }
      return { revs: revs.map((r) => ({ ...r, unarmed: r.unarmed.length })), honest: honesty(), winMax, windows: events(logAt, 'window').length }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (a.winMax > 1400) why(`a window stayed open ${a.winMax.toFixed(0)} ms, past its 1400`)
    if (a.windows < 10) why(`only ${a.windows} windows opened in 200 s of reversals`)
    if (a.revs.length < 12) why(`${a.revs.length} reversals in 200 s of phase 2`)
    a.revs.forEach((r, n) => {
      const w = `reversal ${n}`
      // the last may be cut by the end of the 200 s
      if (r.dirAfter === undefined || r.holdEnd === undefined) return
      if (Math.abs(r.judderTicks * 1000 / 60 - 650) > 17) why(`${w}: it stood ${(r.judderTicks * 1000 / 60).toFixed(1)} ms in judder, not 650 +- 17`)
      if (r.dirAfter !== -r.dirBefore) why(`${w}: dir ${r.dirBefore} became ${r.dirAfter}`)
      if (r.holdTicks !== undefined && Math.abs(r.holdTicks * 1000 / 60 - 1300) > 17) why(`${w}: hold lasted ${(r.holdTicks * 1000 / 60).toFixed(1)} ms, not 1300 +- 17`)
      if (r.holdEnd !== 'run') why(`${w}: hold ended in '${r.holdEnd}', not run`)
      if (r.armedFromUnarmed) why(`${w}: ${r.armedFromUnarmed} strip(s) unarmed at the judder's start were armed after it`)
      if (r.alive) why(`${w}: ${r.alive} strip(s) unarmed at the judder's start were still there on later ticks (not taken back)`)
      if (r.madeDuring) why(`${w}: ${r.madeDuring} strip(s) were laid during the judder`)
      if (r.keptArmed < 1) why(`${w}: no armed strip stayed live under it (${r.keptArmed}); the ones it stands on are to stay`)
    })
    honestOk(why, a.honest)
    const dirs = a.revs.map((r) => r.dirAfter)
    for (let i = 1; i < dirs.length; i++) if (dirs[i] === dirs[i - 1]) why(`two reversals in a row both gave dir ${dirs[i]}`)
    console.log(`INFO K-N11 seed ${seed}: ${a.revs.length} reversals and ${a.windows} windows in 200 s; judder ${[...new Set(a.revs.map((r) => (r.judderTicks * 1000 / 60).toFixed(0)))]} ms, hold ${[...new Set(a.revs.filter((r) => r.holdEnd !== undefined).map((r) => (r.holdTicks * 1000 / 60).toFixed(0)))]} ms; ${a.honest.armed} strips armed, least made-to-armed ${a.honest.minGap.toFixed(2)} ms`)

    // B. a window open when a reversal comes due is not cut: it waits, and afterwards the windows go on, on the other arms
    const b = await inPage(page, RUNNING + WATCH + PHASE2 + NEAR_LEVER + `
      const B = toPhase2({ noWagon: true })
      B.reverseIn = 1e9
      if (untilWindow(40, () => W.__still.pos.set(c.x, 0, c.z)) < 0) return { bad: 'no window' }
      const dir0 = W.__boss().dir
      B.reverseIn = 0
      let openTicks = 0, msMax = 0, judderAt = -1, closedAt = -1, notRun = 0, prevS = W.__boss().state
      for (let i = 0; i < 400; i++) {
        W.__still.pos.set(c.x, 0, c.z)
        const ps = W.__boss().state
        tick(1); observe(ps)
        const bb = W.__boss()
        if (bb.window) { openTicks++; msMax = Math.max(msMax, bb.window.msOpen); if (bb.state !== 'run') notRun++ }
        else if (closedAt < 0) closedAt = i
        if (bb.state === 'judder' && judderAt < 0) judderAt = i
        if (judderAt >= 0 && bb.state === 'run') break
      }
      B.reverseIn = 1e9
      const dir1 = W.__boss().dir
      // then the next window is on the other arms: throw it, and it runs up the b arm, derails, and backs out the same way round
      if (untilWindow(40, () => W.__still.pos.set(c.x, 0, c.z)) < 0) return { bad: 'no window after the reversal' }
      const side = W.__boss().window.side
      const spot = leverPos(side)
      W.__still.pos.set(spot.x, 0, spot.z)
      W.__fire('arms')
      const thrown = W.__boss().window ? W.__boss().window.thrown : null
      const paths = new Set()
      let derailedAt = -1
      for (let i = 0; i < 60 * 14; i++) {
        W.__still.pos.set(spot.x, 0, spot.z)
        const ps = W.__boss().state
        tick(1); observe(ps)
        const bb = W.__boss()
        paths.add(bb.path)
        if (bb.state === 'derailed' && derailedAt < 0) derailedAt = i
        if (derailedAt >= 0 && bb.state === 'run') break
      }
      const bb = W.__boss()
      return { openTicks, msMax, judderAt, closedAt, notRun, dir0, dir1, side, thrown, paths: [...paths], derailedAt, dirEnd: bb.dir, stateEnd: bb.state, honest: honesty() }`, seed)
    if (b.bad) why(b.bad)
    if (b.notRun) why(`the Engine left run on ${b.notRun} tick(s) with a window open`)
    if (b.msMax < 1400 - 17) why(`the window that was open when the reversal came due ran only ${b.msMax.toFixed(1)} ms, not its 1400`)
    if (b.judderAt < b.closedAt) why(`the judder began at tick ${b.judderAt}, before the window closed at ${b.closedAt}`)
    if (b.judderAt < 0) why('the reversal never began after the window closed')
    if (b.dir1 !== -b.dir0) why(`dir ${b.dir0} became ${b.dir1}`)
    if (!b.thrown) why('the lever did not throw on the reversed road')
    if (!b.paths.includes(`${b.side}-b`)) why(`after the reversal a thrown ${b.side} lever ran it up ${b.paths}, not the b arm`)
    if (b.derailedAt < 0 || b.stateEnd !== 'run' || b.dirEnd !== b.dir1) why(`the b-arm derail: derailed at ${b.derailedAt}, ended in ${b.stateEnd} dir ${b.dirEnd}`)
    honestOk(why, b.honest)
    console.log(`INFO K-N11 seed ${seed}: a reversal due with a window open waited (${b.msMax.toFixed(0)} ms open, judder ${b.judderAt - b.closedAt} ticks after it closed); then the ${b.side} lever on dir ${b.dir1}: ${b.paths.filter((p) => p !== 'loop')}`)
  }
})

// K-N12 runs 300 s of phase 2 at three phases of the wagon clock against the window clock (firstS 4, 6.1, 8.3): a window whose junction lies past the wagon
// must not open (the horizon would never reach it), and which windows that is depends on where the two clocks meet.
check('K-N12', ENG6, async ({ page }) => {
  for (const [seed, firstS] of [[1, 4], [2, 6.1], [3, 8.3]]) {
    const a = await inPage(page, RUNNING + WATCH + PHASE2 + `
      const firstS0 = W.__ENGINE.wagon.firstS
      W.__ENGINE.wagon.firstS = ${firstS}
      const B = toPhase2({ noReverse: true })
      W.__ENGINE.wagon.firstS = firstS0
      const terrain = W.__level().terrain
      const wagons = []
      let cur = null, railMax = 0, winMax = 0
      const logAt = W.__enemyLog.length
      for (let i = 0; i < 60 * 300; i++) {
        W.__still.pos.set(c.x, 0, c.z)
        const ps = W.__boss().state
        tick(1); observe(ps)
        const b = W.__boss(), w = b.wagon
        railMax = Math.max(railMax, B.wagonTell.railMat.opacity)
        if (b.window) winMax = Math.max(winMax, b.window.msOpen)
        if (w && !cur) {
          const h = W.__hazards().filter((x) => x.source === 'wagon' && !x.done)[0]
          const sp = W.__track().spurs[w.spur]
          cur = {
            i0: i, ahead: aheadOf(b, sp.onLoop.x, sp.onLoop.z), trackWash: B.wagonTell.trackWash, stages: [w.stage], armIn0: h ? h.armIn : null, damage: h ? h.damage : null,
            dmgMul: b.dmgMul, armedTick: -1, tubVisible: B.tub.visible, dirAtPick: b.dir, sp,
          }
          wagons.push(cur)
        }
        if (cur) {
          const h = W.__hazards().filter((x) => x.source === 'wagon')[0]
          if (w) {
            if (cur.stages[cur.stages.length - 1] !== w.stage) cur.stages.push(w.stage)
            if (cur.armedTick < 0 && h && h.armIn <= 1e-6) cur.armedTick = i - cur.i0
            if (w.stage === 'settled' && !cur.settled) {
              cur.settled = { x: w.x, z: w.z, blocked: terrain.blocked(w.x, w.z, 0), i: i - cur.i0 }
            }
            if (b.frontierEnd === 'wagon') cur.endSeen = true
            cur.tubVisible = cur.tubVisible && B.tub.visible
          }
          if (b.state === 'derailed' && ps !== 'derailed') {
            const hp0 = B.hp
            B.hit(10)
            const took = hp0 - B.hp
            B.hp = hp0
            cur.derail = { open: b.open, wagonGone: !w, x: b.x, z: b.z, took, dist: cur.settled ? Math.hypot(b.x - cur.settled.x, b.z - cur.settled.z) : null,
              blockedAfter: cur.settled ? terrain.blocked(cur.settled.x, cur.settled.z, 0) : null, circlesDead: null, frontierEnd: b.frontierEnd, ticks: 0, tubVisible: B.tub.visible, dir: b.dir, i: i - cur.i0 }
          }
          if (cur.derail && b.state === 'derailed') cur.derail.ticks++
          if (cur.derail && b.state === 'run' && ps === 'derailed') { cur.derail.endState = b.state; cur.derail.dirEnd = b.dir; cur.derail.wagonNull = !b.wagon; cur = null }
        }
      }
      return { curNow: cur && { stages: cur.stages, derail: cur.derail && Object.keys(cur.derail), i0: cur.i0 }, last: { t: W.__combat.time, b: W.__boss() && W.__boss().state, hp: B.hp, alive: !B.dead }, wagons: wagons.map((w) => ({ ...w, sp: undefined })), railMax, winMax, honest: honesty(), events: events(logAt).map((x) => x.ev.what + '@' + x.t.toFixed(1)) }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    // a wagon never rolls onto a point less than 33.8 u ahead of the nose (least allowed by ENGINE.wagon: speed x (lead + tell + roll)), whether or not it was seen out
    // a window is never left open for a junction the horizon cannot reach (a wagon nearer than it, or one the horizon went past while it stood at a derail): none outlasts its 1400 ms
    if (a.winMax > 1400) why(`a window stayed open ${a.winMax.toFixed(0)} ms, past its 1400`)
    a.total = a.wagons.length
    a.wagons.forEach((w, n) => { if (w.ahead < 33.8 - 1e-6) why(`wagon ${n}: its spur meets the loop ${w.ahead.toFixed(3)} u ahead of the nose when picked, under 33.8`) })
    a.wagons = a.wagons.filter((w) => w.derail && w.derail.endState)
    if (a.wagons.length < 12) why(`${a.wagons.length} wagons in 300 s of phase 2 (${a.total} began; ${JSON.stringify(a.last)} ${JSON.stringify(a.curNow)}; events ${a.events.filter((e) => /^(wagon|wagonSettle|wagonSmash|derail|judder)@/.test(e)).join(',')})`)
    if (a.railMax !== 0) why(`the wagon's tell had rail opacity ${a.railMax} at some tick, not 0 at every stage`)
    a.wagons.forEach((w, n) => {
      const t = `wagon ${n}`
      if (!w.trackWash) why(`${t}: its LaneTell has no trackWash`)
      if (Math.abs(w.armIn0 + 1000 / 60 - 1200) > 0.01) why(`${t}: the roll hazard was made with armMs ${(w.armIn0 + 1000 / 60).toFixed(3)}, not 1200`)
      if (Math.abs((w.armedTick + 1) * 1000 / 60 - 1200) > 17) why(`${t}: the roll armed ${((w.armedTick + 1) * 1000 / 60).toFixed(1)} ms after it was made, not 1200 +- 17`)
      if (Math.abs(w.damage - 12 * w.dmgMul) > 1e-9) why(`${t}: damage ${w.damage}, not 12 x bossDmg = ${12 * w.dmgMul}`)
      if (w.stages.join() !== 'tell,roll,settled') why(`${t}: its stages were ${w.stages}, not tell, roll, settled`)
      if (!w.tubVisible) why(`${t}: its tub was not drawn at every tick of its life`)
      if (!w.settled || !w.settled.blocked) why(`${t}: nothing solid at its centre once settled (${JSON.stringify(w.settled)})`)
      if (!w.endSeen) why(`${t}: the horizon never ended at it (frontierEnd never 'wagon')`)
      const d = w.derail
      if (!d) why(`${t}: the engine never met it`)
      if (!d.open) why(`${t}: the engine was not open on meeting it`)
      if (!d.wagonGone || d.blockedAfter) why(`${t}: after the meeting the wagon is ${d.wagonGone ? 'gone' : 'still there'} and its centre ${d.blockedAfter ? 'still solid' : 'clear'}`)
      if (d.tubVisible) why(`${t}: its tub is still drawn after it was smashed`)
      if (Math.abs(d.ticks * 1000 / 60 - 1600) > 17) why(`${t}: derailed ${(d.ticks * 1000 / 60).toFixed(1)} ms, not 1600 +- 17`)
      if (Math.abs(d.took - 15) > 1e-9) why(`${t}: a hit of 10 took ${d.took} off it, not 15`)
      if (Math.abs(d.dist - (1.5 + ENGINE_WAGON_HALF)) > 0.05) why(`${t}: the engine stopped ${d.dist.toFixed(3)} u from the wagon's centre, not ${(1.5 + ENGINE_WAGON_HALF).toFixed(2)} (nose at its near face)`)
      if (d.endState !== 'run' || d.dirEnd !== d.dir) why(`${t}: after the derail: ${d.endState}, dir ${d.dirEnd} (was ${d.dir})`)
    })
    honestOk(why, a.honest)
    console.log(`INFO K-N12 seed ${seed}: ${a.wagons.length} wagons; picked ${a.wagons.length ? Math.min(...a.wagons.map((w) => w.ahead)).toFixed(1) : '-'}-${Math.max(...a.wagons.map((w) => w.ahead)).toFixed(1)} u ahead (least allowed 33.8); armed at ${[...new Set(a.wagons.map((w) => ((w.armedTick + 1) * 1000 / 60).toFixed(0)))]} ms; settled ${[...new Set(a.wagons.map((w) => (w.settled.i * 1000 / 60).toFixed(0)))]} ms after the pick; derailed ${[...new Set(a.wagons.map((w) => (w.derail.ticks * 1000 / 60).toFixed(0)))]} ms`)
  }
})

check('K-N13', ENG6, async ({ page }) => {
  // Still parked beside a window's arm, across = how far off its centre line (on the lever's side, 2 u along it from the junction), until it closes
  for (const [phase2, across, thrownBack] of [[true, 1.9, true], [true, 2.0 + 0.2, false], [false, 1.9, false]]) {
    for (const seed of [1, 2]) {
      const got = await inPage(page, RUNNING + WATCH + PHASE2 + NEAR_LEVER + `
        const P = ${JSON.stringify({ phase2, across })}
        const B = P.phase2 ? toPhase2({ noReverse: true, noWagon: true }) : W.__combat.boss
        const logAt = W.__enemyLog.length
        // off the loop's own strips as well: the point is ahead of the junction, on the lever's side, well inside the arm's length
        const hold = () => {
          const w = W.__boss().window
          if (!w) return
          const arm = W.__track().arms.find((a) => a.side === w.side && a.dir === W.__boss().dir), lv = W.__track().levers[w.side]
          const ux = (arm.buffer.x - arm.junction.x) / arm.len, uz = (arm.buffer.z - arm.junction.z) / arm.len
          const sign = ((lv.x - arm.junction.x) * uz - (lv.z - arm.junction.z) * ux) >= 0 ? 1 : -1
          W.__still.pos.set(arm.junction.x + ux * 2 + uz * sign * P.across, 0, arm.junction.z + uz * 2 - ux * sign * P.across)
        }
        const pos = () => W.__still.pos.set(c.x, 0, c.z)
        if (untilWindow(40, pos) < 0) return { bad: 'no window' }
        const side = W.__boss().window.side
        let closed = -1, state = null, path = null
        for (let i = 0; i < 300; i++) {
          hold()
          const ps = W.__boss().state
          tick(1); observe(ps)
          const b = W.__boss()
          if (!b.window && closed < 0) closed = i
          if (closed >= 0 && i >= closed + 45) { state = b.state; path = b.path; break }
        }
        const evs = events(logAt).filter((x) => x.ev.what === 'throwBack' || x.ev.what === 'throw')
        const lv = W.__world.scene.getObjectByName('lever:' + side)
        const pivot = lv && lv.getObjectByName('pivot')
        return { side, closed, state, path, evs: evs.map((x) => x.ev.what + ':' + x.ev.side), lever: pivot ? pivot.rotation.z : null, honest: honesty(), phase2: B.phase2 }`, seed)
      const why = (m) => { throw new Error(`${phase2 ? 'phase 2' : 'phase 1'}, ${across} off the arm, seed ${seed}: ${m}`) }
      if (got.bad) why(got.bad)
      if (got.phase2 !== phase2) why(`phase2 is ${got.phase2}`)
      if (thrownBack) {
        if (!['siding', 'derailed', 'backing'].includes(got.state) && got.path === 'loop') why(`the window closed unthrown with him in the arm's strip grown by 0.8 and it did not throw (state ${got.state}, path ${got.path})`)
        if (got.evs.join() !== `throwBack:${got.side}`) why(`events ${got.evs}, not one throwBack on the ${got.side}`)
        if (got.path !== `${got.side}-a` && got.state === 'run') why(`the route was ${got.path}`)
        if (!(got.lever < 0)) why(`the ${got.side} lever's pivot is at ${got.lever}, not thrown (negative)`)
      } else {
        if (got.state !== 'run' || got.path !== 'loop') why(`nothing was to be thrown, and the Engine is ${got.state} on ${got.path}`)
        if (got.evs.length) why(`events ${got.evs}`)
        if (!(got.lever > 0)) why(`the ${got.side} lever moved (pivot ${got.lever})`)
      }
      honestOk(why, got.honest)
    }
  }
  console.log('INFO K-N13: phase 2, 1.9 off the arm (inside 1.2 + 0.8): thrown back with the lever over, the arm lit as any rail; 2.2 off, or the same place in phase 1: nothing')
})

// --- Death, the husk, the run (C8) ---------------------------------------------------------------------------------------

/**
 * In the page, what a felled Engine leaves. `huskOf()`: the husk in the level's group (or null). `axisOf(h)`: its unit axis. `railDist(x, z)`: the distance to
 * the nearest rail centre line (the loop, the arms to their buffers, the spurs). `beamsAfter()`: both beams and `side` as the level places them (dungeon.ts:1918-1934:
 * the warm one at c + side x 4.5, the side with the smaller x + z, across the entrance axis).
 */
const KILLED = `
  const huskOf = () => W.__level().group.getObjectByName('engine:husk')
  const axisOf = (h) => ({ x: Math.sin(h.rotation.y), z: Math.cos(h.rotation.y) })
  const railDist = (x, z) => {
    const t = W.__track()
    const seg = (a, b) => {
      const ex = b.x - a.x, ez = b.z - a.z, len = Math.hypot(ex, ez)
      const u = Math.max(0, Math.min(len, ((x - a.x) * ex + (z - a.z) * ez) / len))
      return Math.hypot(x - (a.x + ex / len * u), z - (a.z + ez / len * u))
    }
    return Math.min(...t.loop.map((a, i) => seg(a, t.loop[(i + 1) % t.loop.length])), ...t.arms.map((a) => seg(a.junction, a.buffer)), ...t.spurs.map((sp) => seg(sp.outer, sp.onLoop)))
  }
  const sideOf = () => {
    const { away } = roomOf()
    const a = { x: away.z, z: -away.x }
    return a.x + a.z <= -a.x - a.z ? a : { x: -a.x, z: -a.z }
  }
  const wornIds = () => W.__hud.slots.map((sl) => (sl.def ? sl.def.id : null)).filter((id) => id)
`

/** The husk's colours (the hide rule): typed again here on purpose. CORE_ASLEEP (enemy.ts) and HIDES.engine's body. */
const CORE_ASLEEP_RGB = [0x2a, 0x15, 0x12]

check('K-N14', ENG6, async ({ page }) => {
  for (const seed of [1, 2, 3]) {
    const got = await inPage(page, RUNNING + KILLED + `
      W.__run.tally.engines = {}
      tick(150)
      const B = W.__combat.boss
      const b = W.__boss()
      const before = {
        armed: W.__hazards().filter((h) => h.source === 'train' && !h.done && h.armIn <= 1e-6).length,
        unarmed: W.__hazards().filter((h) => h.source === 'train' && !h.done && h.armIn > 1e-6).length,
        x: b.x, z: b.z, yaw: rot(), state: b.state,
      }
      W.__killBoss()
      tick(1)
      // the tick after the kill: nothing of its own left, lit or armed (drawn = hit: its strips are drawn by the body that is gone)
      const own = W.__hazards().filter((h) => (h.source === 'train' || h.source === 'wagon') && !h.done)
      tick(12)
      const T = W.__level().terrain
      const h = huskOf()
      const ax = h ? axisOf(h) : { x: 0, z: 0 }
      const at = (along, across) => h ? T.blocked(h.position.x + ax.x * along + ax.z * across, h.position.z + ax.z * along - ax.x * across, 0) : null
      const mats = []
      let sprites = 0, lights = 0
      if (h) h.traverse((o) => {
        if (o.isSprite) sprites++
        if (o.isLight) lights++
        if (o.material) mats.push({ type: o.material.type, color: o.material.color.getHex(), emissive: o.material.emissive ? o.material.emissive.getHex() : 0 })
      })
      const E = W.__ENGINE, H = W.__hides.engine
      const dim = (hex) => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255]
      return {
        before, ownAfter: own.length, boss: W.__boss(), bar: document.querySelector('#bossBar').classList.contains('show'),
        husk: !!h, at: h && [h.position.x, h.position.z, h.rotation.y], inScene: !!h && !!h.parent && h.parent === W.__level().group, name: h && h.name,
        centre: at(0, 0), c1: at(0.7, 0), c2: at(-0.7, 0), edgeIn: at(1.49, 0), edgeOut: at(1.51, 0), sideIn: at(0.7, 0.79), sideOut: at(0.7, 0.81), sideOut2: at(-0.7, -0.81),
        cold: W.__exits().cold, warm: W.__exits().warm, bossLoot: W.__run.bossLoot.length, felled: W.__snapshot() === null || W.__run.bossFelled,
        tally: W.__run.tally.engines, arb: W.__run.tally.arbiters, asm: W.__run.tally.assemblers, worn: wornIds(),
        ground: W.__loot.ground.map((g) => ({ x: g.pos.x, z: g.pos.z, blocked: T.blocked(g.pos.x, g.pos.z, 0.3), d: h ? Math.hypot(g.pos.x - h.position.x, g.pos.z - h.position.z) : null })),
        progress: W.__day().progress, sprites, lights, mats, body: dim(H.body).map((v) => v * E.husk.dim), joint: dim(H.joint).map((v) => v * E.husk.dim), dimK: E.husk.dim,
        eng: W.__combat.enemies.filter((e) => e.kind === 'boss').length,
      }`, seed)
    const why = (m) => { throw new Error(`seed ${seed}: ${m}`) }
    if (got.before.state !== 'run' || got.before.armed < 1) why(`killed in ${got.before.state} with ${got.before.armed} armed strips: the leftover test needs a running engine`)
    if (got.before.unarmed < 1) why('it had no strips laid ahead when it was killed (the unarmed ones are Combat\'s cancelOnDeath)')
    if (got.ownAfter !== 0) why(`${got.ownAfter} of its own strips still live one tick after it died: armed strips live and undrawn`)
    if (got.boss !== null) why(`__boss() is ${JSON.stringify(got.boss)} after the kill`)
    if (got.bar) why('the boss bar is still shown')
    if (got.eng) why(`${got.eng} boss bodies still in combat`)
    if (!got.husk || got.name !== 'engine:husk' || !got.inScene) why('no husk in the level\'s group')
    if (Math.hypot(got.at[0] - got.before.x, got.at[1] - got.before.z) > 1e-6) why(`the husk stands at ${got.at[0].toFixed(3)}, ${got.at[1].toFixed(3)}, not where it stopped (${got.before.x.toFixed(3)}, ${got.before.z.toFixed(3)})`)
    if (Math.abs(Math.atan2(Math.sin(got.at[2] - got.before.yaw), Math.cos(got.at[2] - got.before.yaw))) > 1e-6) why(`the husk faces ${got.at[2]}, the engine faced ${got.before.yaw}`)
    if (!got.centre || !got.c1 || !got.c2) why(`its centre or a circle's is not solid (${got.centre} ${got.c1} ${got.c2})`)
    if (!got.edgeIn || got.edgeOut) why(`along its axis the solid runs to ${got.edgeIn ? '' : 'less than '}1.49 and ${got.edgeOut ? 'past' : 'not past'} 1.51 (two circles r 0.8 at +-0.7 make 1.5)`)
    if (!got.sideIn || got.sideOut || got.sideOut2) why(`across a circle the solid is ${got.sideIn ? 'in' : 'not in'} at 0.79 and ${got.sideOut || got.sideOut2 ? 'still there' : 'out'} at 0.81`)
    if (got.cold !== null || !got.warm || !got.warm.open) why(`ENG6 exits after the kill: cold ${JSON.stringify(got.cold)}, warm ${JSON.stringify(got.warm)}; the 6-depth run's last boss leaves the warm alone`)
    if (got.bossLoot !== 2) why(`run.bossLoot has ${got.bossLoot}, not 2`)
    if (got.ground.length < 2) why(`${got.ground.length} drops on the floor, not 2`)
    for (const g of got.ground) if (g.blocked || g.d < 1.6) why(`a drop at ${g.x.toFixed(2)}, ${g.z.toFixed(2)} is ${g.d.toFixed(2)} u from the husk${g.blocked ? ' and inside something solid' : ''}`)
    if (JSON.stringify(Object.keys(got.tally).sort()) !== JSON.stringify([...got.worn].sort()) || Object.values(got.tally).some((n) => n !== 1)) why(`tally.engines ${JSON.stringify(got.tally)} for the worn ${got.worn}: each once`)
    if (got.progress !== 1) why(`the day's progress is ${got.progress} on the kill's tick: first dark is 1`)
    if (got.sprites || got.lights) why(`the husk has ${got.sprites} sprites and ${got.lights} lights: no glow on a dead thing`)
    for (const m of got.mats) {
      if (m.emissive) why(`a husk material is emissive (${m.emissive.toString(16)})`)
      if (m.type === 'MeshBasicMaterial') {
        const rgb = [(m.color >> 16) & 255, (m.color >> 8) & 255, m.color & 255]
        // sRGB bytes here are the linear colour's, so the compare is on the linear side: dimmer than CORE_ASLEEP in every channel
        if (rgb.some((v, i) => v > CORE_ASLEEP_RGB[i])) why(`the firebox/lamp colour ${m.color.toString(16)} is lighter than CORE_ASLEEP in a channel`)
      }
    }
    if (!(got.dimK > 0 && got.dimK <= 0.5)) why(`ENGINE.husk.dim ${got.dimK}: it should be at most the sleeping body's 0.5`)
  }
  console.log('INFO K-N14: killed running: its armed and unarmed strips are all gone one tick later; the husk stands where it stopped, along its travel, two solid circles r 0.8 at +-0.7; warm beam only; 2 drops clear of it')
})

check('K-N14', ENG6, async ({ page }) => {
  // a wagon at its death: rolling (its armed hazard ends with it), and settled (its two solids go)
  for (const stage of ['roll', 'settled']) {
    for (const seed of [1, 2]) {
      const got = await inPage(page, RUNNING + PHASE2 + `
        const B = toPhase2({ noReverse: true })
        B.wagonIn = 0
        const st = ${JSON.stringify(stage)}
        const T = W.__level().terrain
        const n = until(() => W.__boss() && W.__boss().wagon && W.__boss().wagon.stage === st, 12, () => W.__still.pos.set(c.x, 0, c.z))
        if (n < 0) return { bad: 'no wagon reached ' + st }
        const wg = W.__boss().wagon
        const pre = { x: wg.x, z: wg.z, blocked: T.blocked(wg.x, wg.z, 0), live: W.__hazards().filter((h) => h.source === 'wagon' && !h.done).length, tub: B.tub.visible, train: W.__hazards().filter((h) => h.source === 'train' && !h.done).length }
        W.__killBoss()
        tick(1)
        const post = {
          wagonHaz: W.__hazards().filter((h) => h.source === 'wagon' && !h.done).length, train: W.__hazards().filter((h) => h.source === 'train' && !h.done).length,
          wagon: B.wagon ? B.wagon.stage : null, tub: B.tub.visible, blocked: T.blocked(pre.x, pre.z, 0), onScene: !!(B.group.parent || B.worldGroup.parent || B.tellGroup.parent),
          wagonTellVisible: B.wagonTell.group.visible,
        }
        return { pre, post, dead: B.dead }`, seed)
      const why = (m) => { throw new Error(`${stage}, seed ${seed}: ${m}`) }
      if (got.bad) why(got.bad)
      if (got.pre.live !== 1 && stage === 'roll') why(`the rolling wagon had ${got.pre.live} live hazards`)
      if (stage === 'settled' && !got.pre.blocked) why('the settled wagon was not solid before the kill')
      if (!got.dead) why('not dead')
      if (got.post.wagonHaz !== 0 || got.post.train !== 0) why(`after its death: ${got.post.wagonHaz} wagon hazards and ${got.post.train} strips still live`)
      if (got.post.wagon !== null || got.post.tub) why(`after its death the wagon is ${got.post.wagon} / tub drawn ${got.post.tub}`)
      if (got.post.blocked) why('after its death the wagon\'s place is still solid')
      if (got.post.onScene) why('its groups are still in the scene')
    }
  }
  console.log('INFO K-N14: a rolling wagon and a settled one at the engine\'s death: their hazards end, the tub goes, the solids go; nothing of the wagon stays')
})

check('K-N14', ENG9, async ({ page }) => {
  // the exits by road: ENG9's III at 6 (cold + warm), II at 9 (warm alone); the husk, the drops and the tally as at 6
  for (const [order, depth, cold] of [['III', 6, true], ['II', 9, false]]) {
    for (const seed of [1, 2]) {
      const got = await inPage(page, KILLED + `
        const A = arg
        enterEngine(A.order, A.depth, A.seed)
        W.__run.tally.engines = {}
        const kind = W.__boss() && W.__boss().kind
        wake()
        tick(60)
        W.__killBoss()
        tick(12)
        const T = W.__level().terrain, h = huskOf()
        return {
          kind, boss: W.__boss(), husk: !!h, blocked: h ? T.blocked(h.position.x, h.position.z, 0) : null, cold: W.__exits().cold, warm: W.__exits().warm,
          after: W.__exitsAfterBoss(A.depth), loot: W.__run.bossLoot.length, tally: W.__run.tally.engines, worn: wornIds(), yard: W.__yardRoad(),
          ground: W.__loot.ground.filter((g) => !g.set).length, picks: W.__picks().length,
        }`, { order, depth, seed })
      const why = (m) => { throw new Error(`${order} at ${depth}, seed ${seed}: ${m}`) }
      if (got.kind !== 'engine') why(`the boss is ${got.kind}, not the engine`)
      if (got.boss !== null || !got.husk || !got.blocked) why(`after the kill: boss ${JSON.stringify(got.boss)}, husk ${got.husk}, solid ${got.blocked}`)
      if (!got.warm || !got.warm.open) why(`the warm beam is ${JSON.stringify(got.warm)}`)
      if (cold && (!got.cold || !got.cold.open)) why(`the cold beam is ${JSON.stringify(got.cold)}, open`)
      if (!cold && got.cold !== null) why(`a cold beam at the last depth: ${JSON.stringify(got.cold)}`)
      if (got.after.join() !== (cold ? 'cold,warm' : 'warm')) why(`exitsAfterBoss(${depth}) is ${got.after}`)
      if (got.loot !== 2) why(`run.bossLoot has ${got.loot}, not 2 (${got.picks} pedestal picks, ${got.ground} loose parts)`)
      if (JSON.stringify(Object.keys(got.tally).sort()) !== JSON.stringify([...got.worn].sort()) || Object.values(got.tally).some((n) => n !== 1)) why(`tally.engines ${JSON.stringify(got.tally)} for the worn ${got.worn}`)
    }
  }
  console.log('INFO K-N14: III at 6: cold + warm open, II at 9: warm alone; the husk solid, run.bossLoot 2, each worn part counted once')
})

const ENG6_N15 = ENG6 + '&x=n15'
check('K-N15', ENG6_N15, async ({ page }) => {
  const got = await inPage(page, RUNNING + `
    // a real run, not a dev one: its end commits to the (in-memory) save
    W.__run.dev = false
    W.__run.tally.engines = {}
    W.__run.tally.carried.push('scrap-cleaver')
    const worn = W.__hud.slots.map((sl) => (sl.def ? sl.def.id : null)).filter((id) => id)
    const carried = [...W.__run.tally.carried]
    tick(60)
    W.__killBoss()
    tick(12)
    const ok = W.__end('home')
    W.__step(0.2)
    const hist = W.__save().history
    const names = Object.fromEntries([...carried, 'anvil'].map((id) => [id, W.__describe(id)]))
    return { ok, worn, carried, hist, names, arb: W.__run.tally.arbiters, runs: W.__save().runs }`, 1)
  assert(got.ok, 'no ending')
  assert(got.runs === 1, `the commit wrote ${got.runs} runs`)
  assert(got.carried.length >= 2, `only ${got.carried} carried`)
  for (const id of got.carried) {
    const h = got.hist[id]
    assert(h, `no history for ${id}`)
    assert(h[7] === 1, `${id}: history[7] is ${h[7]}, not 1`)
    assert(h[6] === 0 && h[2] === 0, `${id}: it saw an Arbiter (${h[6]}) or an Assembler (${h[2]})`)
    assert(got.names[id].name.endsWith(', that saw the Engine'), `${id} is named "${got.names[id].name}", not "..., that saw the Engine"`)
  }
  assert(!/saw the/.test(got.names.anvil.name), `a part that never went through it is "${got.names.anvil.name}"`)
  console.log(`INFO K-N15: ${got.carried.join(', ')}: history[7] 1, named "${got.names[got.carried[0]].name}"`)
})

// K-N21 / K-N22's walker: a real run down its depths with the game's own descend (k9.mjs WALK, without the assertions of K-93): the road at the crossroads, a kill at each boss depth.
const WALKDOWN = `
  const walkTo = ({ order, upTo, roads }) => {
    const bad = []
    W.__run.dev = false
    W.__setSave(roads ? { roads: ['II', 'III'] } : null)
    W.__run.route = roads ? null : order
    W.__enter(1, 1)
    for (let d = 1; d < upTo; d++) {
      if (W.__run.depth !== d) { bad.push('expected depth ' + d + ', at ' + W.__run.depth); break }
      if (W.__boss()) { W.__killBoss(); W.__step(0.2) }
      if (W.__descend() !== true) { bad.push('depth ' + d + ': __descend() is not true'); break }
      const t = W.__until(() => W.__mode() === 'crawl' && (W.__run.depth === d + 1 || W.__route().atCrossroads), 8)
      if (t < 0) { bad.push('depth ' + d + ': no crawl at ' + (d + 1)); break }
      if (W.__route().atCrossroads && W.__takeRoad(order) !== order) bad.push('the road ' + order + ' was not taken')
    }
    return { bad, depth: W.__run.depth, boss: W.__boss() && W.__boss().kind }
  }
`

const beamCheck = (why, o) => {
  // both beams where dungeon.ts puts them: cold at c (the room's centre), warm at c + side x 4.5; each at least halfW + the honest margin 0.42 + 1.4 from every rail
  const need = 1.2 + 0.42 + 1.4
  if (o.cold) {
    if (!o.cold.open) why('the cold beam is not open')
    if (Math.hypot(o.cold.x - o.c.x, o.cold.z - o.c.z) > 1e-6) why(`the cold beam is at ${o.cold.x}, ${o.cold.z}, not at c (${o.c.x}, ${o.c.z})`)
    if (o.coldRail < need) why(`the cold beam is ${o.coldRail.toFixed(3)} u from a rail, under ${need}`)
  } else if (o.wantCold) why('no cold beam')
  if (!o.warm || !o.warm.open) why(`the warm beam is ${JSON.stringify(o.warm)}, open`)
  if (Math.hypot(o.warm.x - (o.c.x + o.side.x * 4.5), o.warm.z - (o.c.z + o.side.z * 4.5)) > 1e-6) why(`the warm beam is at ${o.warm.x}, ${o.warm.z}, not at c + side x 4.5 (${o.c.x + o.side.x * 4.5}, ${o.c.z + o.side.z * 4.5})`)
  if (o.warmRail < need) why(`the warm beam is ${o.warmRail.toFixed(3)} u from a rail, under ${need}`)
}

const BEAMS = `
  const beams = () => {
    const { c } = roomOf(), side = sideOf(), ex = W.__exits()
    return { c, side, cold: ex.cold, warm: ex.warm, coldRail: ex.cold ? railDist(ex.cold.x, ex.cold.z) : null, warmRail: ex.warm ? railDist(ex.warm.x, ex.warm.z) : null }
  }
  const dayNow = () => { const d = W.__day(); return { day: d.day, hour: d.hour, progress: d.progress, target: d.target, to: d.to, keyLight: d.keyLight, fogNear: d.fogNear, exposure: d.exposure } }
`

check('K-N21', ENG9, async ({ page }) => {
  // III at 6 in a 9-depth run: the cold beam (dressed to the other road) at c and the warm at c + side x 4.5; the day unchanged by the kill (the middle boss holds the light)
  for (const seed of [1, 2, 3, 4]) {
    const got = await inPage(page, KILLED + BEAMS + `
      enterEngine('III', 6, arg)
      wake()
      tick(60)
      const before = dayNow()
      W.__killBoss()
      tick(12)
      return { ...beams(), before, after: dayNow(), yard: W.__yardRoad(), route: W.__run.route }`, seed)
    const why = (m) => { throw new Error(`III at 6, seed ${seed}: ${m}`) }
    beamCheck(why, { ...got, wantCold: true })
    if (!got.yard || got.yard.route !== 'II') why(`__yardRoad() is ${JSON.stringify(got.yard)}, not the other road, II`)
    if (JSON.stringify(got.before) !== JSON.stringify(got.after)) why(`the kill moved the day: ${JSON.stringify(got.before)} -> ${JSON.stringify(got.after)}`)
  }
  // II at 9: the warm alone, and the day at first dark on the kill's tick
  for (const seed of [1, 2, 3, 4]) {
    const got = await inPage(page, KILLED + BEAMS + `
      enterEngine('II', 9, arg)
      wake()
      tick(60)
      const before = dayNow()
      W.__killBoss()
      W.__step(1 / 60)
      const onTick = dayNow()
      tick(12)
      return { ...beams(), before, onTick, boss: null }`, seed)
    const why = (m) => { throw new Error(`II at 9, seed ${seed}: ${m}`) }
    if (got.cold !== null) why(`a cold beam at the last depth: ${JSON.stringify(got.cold)}`)
    beamCheck(why, got)
    if (got.onTick.progress !== 1 || got.onTick.target !== 1 || got.onTick.to !== 'first-dark') why(`the day on the kill's tick: ${JSON.stringify(got.onTick)}, not first dark`)
    if (!(got.onTick.keyLight < got.before.keyLight)) why(`the light did not go down on the kill's tick (${got.before.keyLight} -> ${got.onTick.keyLight})`)
  }
  console.log('INFO K-N21: III at 6 (9 depths): cold at c and warm at c + side x 4.5, both >= 3.02 from every rail, yard road II, day unchanged; II at 9: warm alone, first dark on the kill tick')
})

check('K-N21', ENG6, async ({ page }) => {
  // the 6-depth run: the Engine at 6 leaves the warm beam alone and takes the day to first dark on the same tick (the Arbiter's rule)
  for (const seed of [1, 2, 3, 4]) {
    const got = await inPage(page, KILLED + BEAMS + `
      enterEngine('III', 6, arg)
      wake()
      tick(60)
      const before = dayNow()
      W.__killBoss()
      W.__step(1 / 60)
      const onTick = dayNow()
      tick(12)
      return { ...beams(), before, onTick }`, seed)
    const why = (m) => { throw new Error(`ENG6, seed ${seed}: ${m}`) }
    if (got.cold !== null) why(`a cold beam at the last depth: ${JSON.stringify(got.cold)}`)
    beamCheck(why, got)
    if (got.onTick.progress !== 1 || got.onTick.target !== 1 || got.onTick.to !== 'first-dark') why(`the day on the kill's tick: ${JSON.stringify(got.onTick)}, not first dark`)
    if (!(got.onTick.keyLight < got.before.keyLight)) why(`the light did not go down on the kill's tick (${got.before.keyLight} -> ${got.onTick.keyLight})`)
  }
})

/**
 * K-N22: a resume after the kill, on a real save. `walkTo` is the game's own walk to the Engine's depth; the kill writes the beam save; a reload rebuilds the level:
 * no boss, its husk where it slept (blocked, along the loop's straight there), the beams open, the day as the kill left it.
 */
const resumeCheck = (query, order, roads, expectDay) => check('K-N22', query, async ({ page }) => {
  const walked = await inPage(page, WALKDOWN + `return walkTo(arg)`, { order, upTo: 6, roads })
  if (walked.bad.length) throw new Error(`the walk to 6: ${walked.bad}`)
  if (walked.depth !== 6 || walked.boss !== 'engine') throw new Error(`at depth ${walked.depth} with boss ${walked.boss}, not the Engine at 6`)
  const first = await inPage(page, KILLED + BEAMS + `
    W.__killBoss(); W.__step(0.2)
    const snap = W.__snapshot()
    return { felled: snap && snap.bossFelled, depth: snap && snap.depth, exits: W.__exits(), day: dayNow(), loot: [...W.__run.bossLoot], route: W.__run.route }`)
  assert(first.felled === true, `__snapshot().bossFelled is ${first.felled} after the kill`)
  await page.reload()
  await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
  const back = await inPage(page, KILLED + BEAMS + `
    W.__step(0.1)
    const lv = W.__level(), h = huskOf(), b = lv.boss
    const T = lv.terrain
    // the loop's straight through the spot the Engine slept at: the nearest run's direction
    const t = W.__track()
    let best = Infinity, dir = null
    t.loop.forEach((a, i) => {
      const q = t.loop[(i + 1) % t.loop.length], ex = q.x - a.x, ez = q.z - a.z, len = Math.hypot(ex, ez)
      const u = Math.max(0, Math.min(len, ((b.x - a.x) * ex + (b.z - a.z) * ez) / len))
      const d = Math.hypot(b.x - (a.x + ex / len * u), b.z - (a.z + ez / len * u))
      if (d < best) { best = d; dir = { x: ex / len, z: ez / len } }
    })
    const ax = h ? axisOf(h) : { x: 0, z: 0 }
    return {
      depth: W.__run.depth, boss: W.__boss(), enemies: W.__combat.enemies.filter((e) => e.kind === 'boss').length, bar: document.querySelector('#bossBar').classList.contains('show'),
      husk: !!h, at: h && [h.position.x, h.position.z], slept: [b.x, b.z], blocked: h ? T.blocked(h.position.x, h.position.z, 0) : null,
      c1: h ? T.blocked(h.position.x + ax.x * 0.7, h.position.z + ax.z * 0.7, 0) : null, out: h ? T.blocked(h.position.x + ax.x * 1.51, h.position.z + ax.z * 1.51, 0) : null,
      parallel: h && dir ? Math.abs(ax.x * dir.z - ax.z * dir.x) : null, onLoop: best,
      exits: W.__exits(), day: dayNow(), loot: [...W.__run.bossLoot], route: W.__run.route, felled: W.__snapshot() && W.__snapshot().bossFelled, ground: W.__loot.ground.length,
      leftover: W.__hazards().filter((x) => !x.done).length,
    }`)
  const why = (m) => { throw new Error(`${query}: ${m}`) }
  if (back.depth !== 6) why(`resumed at depth ${back.depth}`)
  if (back.boss !== null || back.enemies || back.bar) why(`a boss after the reload: ${JSON.stringify(back.boss)} (${back.enemies} bodies, bar ${back.bar})`)
  if (!back.husk) why('no husk after the reload')
  if (Math.hypot(back.at[0] - back.slept[0], back.at[1] - back.slept[1]) > 1e-6) why(`the husk is at ${back.at}, not where it slept ${back.slept}`)
  if (!back.blocked || !back.c1 || back.out) why(`the husk's solid: centre ${back.blocked}, a circle ${back.c1}, 1.51 out ${back.out}`)
  if (!(back.parallel < 1e-6)) why(`the husk does not lie along the loop's straight there (cross ${back.parallel})`)
  if (JSON.stringify(back.exits) !== JSON.stringify(first.exits)) why(`the beams differ: before ${JSON.stringify(first.exits)}, after ${JSON.stringify(back.exits)}`)
  if (!back.exits.warm || !back.exits.warm.open) why('the warm beam is not open')
  if (JSON.stringify(back.day) !== JSON.stringify(first.day)) why(`the day differs: before ${JSON.stringify(first.day)}, after ${JSON.stringify(back.day)}`)
  if (expectDay === 'dark' && back.day.progress !== 1) why(`the day is ${back.day.progress}, not first dark (6 depths)`)
  if (expectDay === 'held' && back.day.progress !== 0) why(`the day is ${back.day.progress}, not held (9 depths, the middle boss)`)
  if (JSON.stringify(back.loot) !== JSON.stringify(first.loot)) why(`bossLoot ${JSON.stringify(first.loot)} -> ${JSON.stringify(back.loot)}`)
  if (back.felled !== true || back.route !== first.route) why(`snapshot felled ${back.felled}, route ${first.route} -> ${back.route}`)
  console.log(`INFO K-N22 ${query}: reloaded at 6 on ${back.route}: no boss, the husk at ${back.at.map((v) => v.toFixed(1))} (blocked, along the straight), beams ${back.exits.cold ? 'cold+' : ''}warm open, day progress ${back.day.progress}`)
})
// 9 depths: Line-first road (III at 6 holds the light); 6 depths: the Engine at 6 is the last (first dark, snapped by day.enter)
resumeCheck('?roads=1&line=1&engine=1', 'III', true, 'held')
resumeCheck('?line=1&engine=1', 'III', false, 'dark')


// --- The dressing (C9) -----------------------------------------------------------------------------------------------------

const NAMES = JSON.parse(readFileSync(REPO + 'tools/checks/baseline/names.json', 'utf8'))

/**
 * K-N19: the Engine's page (STAGE-C 2.7), unmet-only as stage B's Line pages are. Fresh: raging-hull, and the rams at 4-9 lose it (two names left);
 * raging-hull met as a ram (no `r`): echo-shell, the rams keep it; met as the Engine (`r: 'engine'`): raging-hull again. A meeting of the Engine on a non-dev
 * run writes the chosen page with r 'engine', its felling counts a kill, and the page reads 'the boss'.
 */
const PAGES = `
  const entry = (r) => ({ f: '2026-09-01', m: 1, k: 0, d: 1, ...(r ? { r } : {}) })
  const rams = () => { const o = {}; for (let d = 4; d <= 9; d++) o[d] = W.__namesFor('charger', d); return o }
  const seed = (nb) => { W.__setSave({ notebook: nb }); W.__setLinePages(true); return { page: W.__linePage('engine'), rams: rams() } }
`
check('K-N19', ENG6, async ({ page }) => {
  const got = await inPage(page, PAGES + `
    const { roleOf, ROSTER_BY_ID, WHAT } = await import('/src/notebook.ts')
    try {
      W.__setSave(null)
      W.__setLinePages(true)
      const out = { fresh: { page: W.__linePage('engine'), rams: rams() } }
      out.hullMet = seed({ 'raging-hull': entry() })
      out.hullR = seed({ 'raging-hull': entry('engine') })
      out.echoR = seed({ 'raging-hull': entry(), 'echo-shell': entry('engine') })
      W.__setSave(null)
      W.__setLinePages(true)
      out.role = roleOf(ROSTER_BY_ID.get('raging-hull')).role
      out.what = WHAT[out.role]
      // a non-dev meeting, fresh: the page is written on the wake with its role, and the felling counts
      W.__run.dev = false
      enterEngine('III', 6, 1)
      wake()
      out.met = JSON.parse(JSON.stringify(W.__notebook()['raging-hull'] ?? null))
      out.others = Object.keys(W.__notebook()).filter((id) => id !== 'raging-hull')
      W.__killBoss()
      tick(6)
      out.felled = JSON.parse(JSON.stringify(W.__notebook()['raging-hull'] ?? null))
      // raging-hull already met as a ram: the Engine is written on echo-shell, and the ram's page is left alone
      W.__setSave({ notebook: { 'raging-hull': entry() } })
      W.__setLinePages(true)
      enterEngine('III', 6, 2)
      wake()
      out.echoMet = JSON.parse(JSON.stringify({ hull: W.__notebook()['raging-hull'], echo: W.__notebook()['echo-shell'] ?? null }))
      W.__killBoss()
      tick(6)
      out.echoFelled = JSON.parse(JSON.stringify(W.__notebook()['echo-shell'] ?? null))
      return out
    } finally { W.__run.dev = true; W.__setSave(null); W.__setLinePages(true) }`)
  assertEq('fresh: the Engine takes raging-hull', got.fresh.page, 'raging-hull')
  for (let d = 4; d <= 9; d++) {
    const r = got.fresh.rams[d]
    assert(!r.includes('raging-hull') && r.length === 2, `fresh, the rams at ${d}: ${r} (want two names, raging-hull among none)`)
    assertEq(`fresh, the rams at ${d} are names.json's less raging-hull`, r, NAMES.names.charger[d].filter((id) => id !== 'raging-hull'))
  }
  assertEq('raging-hull met as a ram: the Engine takes echo-shell', got.hullMet.page, 'echo-shell')
  for (let d = 4; d <= 9; d++) assertEq(`raging-hull met as a ram keeps its place among the rams at ${d}`, got.hullMet.rams[d], NAMES.names.charger[d])
  assertEq('raging-hull met as the Engine: its page again', got.hullR.page, 'raging-hull')
  assert(got.hullR.rams[4].length === 2 && !got.hullR.rams[4].includes('raging-hull'), `raging-hull met as the Engine is still a ram: ${got.hullR.rams[4]}`)
  assertEq('echo-shell met as the Engine (raging-hull as a ram): echo-shell', got.echoR.page, 'echo-shell')
  assertEq("the page's role", got.role, 'boss')
  assertEq("the page's WHAT", got.what, 'the boss')
  assert(got.met && got.met.r === 'engine' && got.met.m === 1 && got.met.k === 0, `meeting the Engine wrote ${JSON.stringify(got.met)}, want r 'engine', m 1, k 0`)
  assert(got.others.length === 0, `meeting the Engine wrote other pages too: ${got.others}`)
  assert(got.felled && got.felled.r === 'engine' && got.felled.k === 1, `felling the Engine left ${JSON.stringify(got.felled)}, want k 1`)
  assert(got.echoMet.hull && got.echoMet.hull.r === undefined && got.echoMet.hull.m === 1, `the ram's page raging-hull was changed: ${JSON.stringify(got.echoMet.hull)}`)
  assert(got.echoMet.echo && got.echoMet.echo.r === 'engine' && got.echoMet.echo.m === 1, `with raging-hull met, the Engine wrote echo-shell as ${JSON.stringify(got.echoMet.echo)}`)
  assert(got.echoFelled && got.echoFelled.k === 1, `felling the Engine on echo-shell: ${JSON.stringify(got.echoFelled)}`)
  console.log(`INFO K-N19: fresh raging-hull (the rams 4-9 keep 2 names); hull met as a ram: echo-shell; as the Engine: raging-hull; a meeting writes ${JSON.stringify(got.met)}, felled k ${got.felled.k}`)
})
check('K-N19', OFF, async ({ page }) => {
  const got = await inPage(page, `
    const out = { page: W.__linePage('engine'), rams: {} }
    for (let d = 1; d <= 9; d++) out.rams[d] = W.__namesFor('charger', d)
    return out`)
  assertEq('OFF: no Engine page', got.page, null)
  for (let d = 1; d <= 9; d++) assertEq(`OFF: the rams at ${d} equal names.json`, got.rams[d], NAMES.names.charger[d])
})

/** K-N20's page-side helper (stageb's K-E12 MOOD, again): the mood a level reports, and the one the frame loop has passed after a few frames. */
const MOOD = `
  const settle = async (want) => {
    await new Promise((r) => setTimeout(r, 200))
    for (let i = 0; i < 150; i++) {
      if (W.__ambience() === want) return want
      await new Promise((r) => setTimeout(r, 20))
    }
    return W.__ambience()
  }
  const moodAt = async (route, depth) => {
    W.__hold(true)
    W.__run.route = route
    W.__enter(depth, 1)
    W.__step(0.5)
    const look = W.__look()
    return { route, depth, look: look.ambience, boss: !!W.__boss(), def: W.__combat.boss ? W.__combat.boss.def.kind : null, settled: await settle(look.ambience) }
  }
`
const moodCheck = (query, cases) => check('K-N20', query, async ({ page }) => {
  const got = await inPage(page, MOOD + `
    const out = []
    for (const [route, depth] of arg) out.push(await moodAt(route, depth))
    return out`, cases.map(([r, d]) => [r, d]))
  for (const [i, [route, depth, want, engine]] of cases.entries()) {
    const m = got[i]
    assert(m.look === want, `${query} ${route}${depth}: __look().ambience is ${m.look}, want ${want}`)
    assert(m.settled === want, `${query} ${route}${depth}: after __step(0.5) the frame loop passed ${m.settled}, want ${want}`)
    assert((m.def === 'engine') === engine, `${query} ${route}${depth}: the boss is ${m.def}, ${engine ? 'want the Engine' : 'want no Engine'}`)
  }
  console.log(`INFO K-N20 ${query}: ${got.map((m) => `${m.route}${m.depth} ${m.settled}`).join(', ')}`)
})
// the Engine's level: roundhouse; the Line's other levels stay 'line'; the stand-in's station (no engine flag) is 'line' whatever (stageb K-E12 holds the rest)
moodCheck(ENG6, [['III', 4, 'line', false], ['III', 5, 'line', false], ['III', 6, 'roundhouse', true]])
moodCheck(ENG9, [['III', 5, 'line', false], ['III', 6, 'roundhouse', true], ['II', 8, 'line', false], ['II', 9, 'roundhouse', true]])
moodCheck('?depth=1&save=memory&roads=1&line=1', [['III', 6, 'line', false], ['II', 9, 'line', false]])

/** In the page: the audio log's names since a mark, counted. */
const HEARD = `
  const heardSince = (at) => { const o = {}; for (const h of W.__heard.slice(at)) o[h.name] = (o[h.name] || 0) + 1; return o }
`
check('K-S5', ENG6, async ({ page }) => {
  const got = await inPage(page, HEARD + NEAR_LEVER + `
    enterEngine('III', 6, arg, { steam: true, cinder: true, gap: [1, 2] })
    const { c, away } = roomOf()
    const B = W.__combat.boss
    const rot = () => B.group.rotation.y
    const mark = W.__heard.length
    const logAt = W.__enemyLog.length
    let prevAttack = 'none', steamStarts = 0, cinderStarts = 0, runStarts = 0, wasMoving = false
    const obs = () => {
      const b = W.__boss()
      if (!b) return
      if (prevAttack === 'none' && b.attack === 'steamTrack') steamStarts++
      if (prevAttack === 'none' && b.attack === 'cinderAim') cinderStarts++
      prevAttack = b.attack
      const moving = ['run', 'siding', 'backing'].includes(b.state)
      if (moving && !wasMoving) runStarts++
      wasMoving = moving
    }
    const step = (n, before) => { for (let i = 0; i < n; i++) { tick(1, before); obs() } }
    const stepUntil = (pred, maxS, before) => { for (let i = 0; i < maxS * 60; i++) { if (pred()) return i / 60; step(1, before) } return -1 }
    const out = { at: {} }
    // 1. it wakes: one whistle, one horn, and the run loop starts
    W.__still.pos.set(c.x - away.x * 7, 0, c.z - away.z * 7)
    out.woke = stepUntil(() => W.__boss().state === 'run', 5)
    out.at.wake = heardSince(mark)
    // 2. beside its path (inside the steam's range, off the strip it lights): steams, each with its windup and its scald
    const beside = () => { const b = W.__boss(), y = rot(); W.__still.pos.set(b.x + Math.cos(y) * 4.5, 0, b.z - Math.sin(y) * 4.5) }
    out.steamed = stepUntil(() => steamStarts >= 2, 40, beside)
    // 3. at the centre out of its reach: a cinder, its lob aim and its mortar
    W.__still.pos.set(c.x, 0, c.z)
    out.lobbed = stepUntil(() => cinderStarts >= 1, 30, () => W.__still.pos.set(c.x, 0, c.z))
    // 4. two windows: at the lever, a cast throws it, and it derails
    for (let n = 0; n < 2; n++) {
      out['window' + n] = stepUntil(() => W.__boss().window && W.__boss().window.open, 60, () => W.__still.pos.set(c.x, 0, c.z))
      const side = W.__boss().window && W.__boss().window.side
      if (!side) break
      const p = leverPos(side)
      W.__still.pos.set(p.x, 0, p.z)
      W.__fire('arms')
      out['derail' + n] = stepUntil(() => W.__boss().state === 'derailed', 15, () => W.__still.pos.set(p.x, 0, p.z))
      out['run' + n] = stepUntil(() => W.__boss().state === 'run' && !W.__boss().window, 15, () => W.__still.pos.set(c.x, 0, c.z))
    }
    // 5. phase 2: a reversal (its window closed first), each with its judder
    B.hp = B.maxHp * 0.5
    B.wagonIn = 1e9
    out.judder = stepUntil(() => W.__boss().state === 'judder', 40, () => { W.__combat.boss.wagonIn = 1e9; W.__still.pos.set(c.x, 0, c.z) })
    step(80, () => W.__still.pos.set(c.x, 0, c.z))
    // 6. a loose wagon: settles on the loop, and the nose meets it and smashes it
    B.wagonIn = 0
    out.smashed = stepUntil(() => W.__enemyLog.slice(logAt).some((x) => x.ev.kind === 'engine' && x.ev.what === 'wagonSmash'), 60, () => { W.__combat.boss.reverseIn = 1e9; W.__still.pos.set(c.x, 0, c.z) })
    // a dead engine runs no longer
    W.__killBoss()
    step(20)
    const ev = (w) => W.__enemyLog.slice(logAt).filter((x) => x.ev.kind === 'engine' && x.ev.what === w).length
    return {
      ...out, heard: heardSince(mark), live: W.__heard.slice(mark).some((h) => h.live), steamStarts, cinderStarts, runStarts,
      events: { whistle: ev('whistle'), window: ev('window'), throw: ev('throw'), throwBack: ev('throwBack'), derail: ev('derail'), steam: ev('steam'), cinder: ev('cinder'), judder: ev('judder'), wagon: ev('wagon'), wagonSettle: ev('wagonSettle'), wagonSmash: ev('wagonSmash') },
    }`, 1)
  const H = got.heard, E = got.events
  const why = (m) => { throw new Error(`${m} (heard ${JSON.stringify(H)}, events ${JSON.stringify(E)}, steam starts ${got.steamStarts}, cinder starts ${got.cinderStarts}, run starts ${got.runStarts})`) }
  if (got.woke < 0) why('it did not wake')
  if (got.steamed < 0) why('no two steams in 40 s beside its path')
  if (got.lobbed < 0) why('no cinder in 30 s out of its reach')
  if (got.derail0 < 0 || got.derail1 < 0 || got.judder < 0) why(`the script fell short: derails ${got.derail0} ${got.derail1}, judder ${got.judder}`)
  const n = (k) => H[k] || 0
  if (n('horn') !== 1 || E.whistle !== 1 || (got.at.wake.horn || 0) !== 1) why(`the horn: ${n('horn')} heard (${got.at.wake.horn || 0} by the wake), ${E.whistle} whistle event(s)`)
  if (n('engineRun') < 1 || n('engineRun') !== got.runStarts) why(`engineRun heard ${n('engineRun')} times for ${got.runStarts} starts of its motion`)
  if ((got.at.wake.engineRun || 0) < 1) why('the run loop had not started when it began to run')
  if (n('pointsChime') !== E.window || E.window < 2) why(`pointsChime ${n('pointsChime')} for ${E.window} windows`)
  if (n('latch') !== E.throw + E.throwBack || E.throw < 2) why(`latch ${n('latch')} for ${E.throw} throws and ${E.throwBack} thrown back`)
  if (n('ramCrash') !== E.derail || E.derail < 2) why(`ramCrash ${n('ramCrash')} for ${E.derail} derails`)
  if (n('windup') !== got.steamStarts || n('scald') !== E.steam || E.steam < 2) why(`windup ${n('windup')} / scald ${n('scald')} for ${got.steamStarts} steam windups and ${E.steam} jets`)
  if (n('lobAim') !== got.cinderStarts || n('mortar') !== E.cinder || E.cinder < 1) why(`lobAim ${n('lobAim')} / mortar ${n('mortar')} for ${got.cinderStarts} cinder aims and ${E.cinder} launches`)
  if (n('judder') !== E.judder || E.judder < 1) why(`judder heard ${n('judder')} for ${E.judder} reversals`)
  if (got.smashed < 0 || E.wagonSettle < 1 || E.wagonSmash < 1) why(`the wagon: smashed after ${got.smashed} s, ${E.wagonSettle} settles, ${E.wagonSmash} smashes`)
  if (n('plateDull') < E.wagonSettle) why(`plateDull ${n('plateDull')} for ${E.wagonSettle} wagons settled`)
  if (n('smash') < E.wagonSmash) why(`smash ${n('smash')} for ${E.wagonSmash} wagons smashed`)
  if (n('aim') || n('rev')) why(`aim (${n('aim')}) or rev (${n('rev')}) was heard: the Engine has no sentinel's whistle or ram's engine`)
  console.log(`INFO K-S5: one fight: ${Object.entries(H).map(([k, v]) => `${k} ${v}`).join(', ')} (headless: ${got.live ? 'the audio context ran' : 'nothing audible, only asked for'})`)
})

check('K-E9c', ENG6, async ({ page }) => {
  const got = await inPage(page, RUNNING + NEAR_LEVER + `
    const L = (col) => col.getHSL({}).l
    const CORE = new (W.__combat.boss.coreMat.color.constructor)(0xff5a3c)
    const coreL = L(CORE)
    const B = W.__combat.boss
    const mats = { core: B.coreMat, lamp: B.lampMat, slitHalo: B.slitHalo, lampHalo: B.lampHalo, fireHalo: B.fireHalo, fireGlow: B.fireGlowMat }
    const max = {}, seen = {}
    for (const k of Object.keys(mats)) { max[k] = 0; seen[k] = 1 }
    let derailed = 0, doorMax = 0
    const sample = () => {
      for (const [k, m] of Object.entries(mats)) { const l = L(m.color); max[k] = Math.max(max[k], l); seen[k] = Math.min(seen[k], l) }
      if (W.__boss().state === 'derailed') derailed++
      doorMax = Math.max(doorMax, B.door)
    }
    // one derail from the lever, sampled every tick from the window to the run again
    if (untilWindow(40) < 0) return { bad: 'no window in 40 s' }
    const side = W.__boss().window.side
    const p = leverPos(side)
    for (let i = 0; i < 60; i++) { W.__still.pos.set(c.x, 0, c.z); tick(1); sample() }
    W.__still.pos.set(p.x, 0, p.z)
    W.__fire('arms')
    for (let i = 0; i < 60 * 12; i++) { W.__still.pos.set(p.x, 0, p.z); tick(1); sample() }
    // the lever ring and its disc are Still's cold, in his own shader path
    const cold = [B.ringMat.uniforms.uCold.value, B.discMat.uniforms.uCold.value]
    const enamel = W.__hides.enamel
    return { max, min: seen, coreL, derailed, doorMax, cold, coreHex: mats.core.color.getHex(), haloHex: mats.fireHalo.color.getHex(), enamel: !!enamel }`, 1)
  if (got.bad) throw new Error(got.bad)
  assert(got.derailed > 90 && got.doorMax > 0.9, `the derail lasted ${got.derailed} ticks with the door ${got.doorMax} open: the check proves nothing`)
  assert(got.max.core - got.min.core > 0.02, `the firebox's lightness never moved (${got.min.core} .. ${got.max.core}): the check proves nothing`)
  for (const [k, l] of Object.entries(got.max)) assert(l <= got.coreL + 1e-6, `INV-C1: the ${k}'s lightness went ${l.toFixed(6)}, over CORE's ${got.coreL.toFixed(6)}`)
  assertEq("the lever ring's and disc's uCold", got.cold, [1, 1])
  assert(got.enamel, 'HIDES.enamel is missing')
  console.log(`INFO K-E9c: over one derail (${got.derailed} ticks, door open ${got.doorMax.toFixed(2)}): firebox lightness ${got.min.core.toFixed(3)} .. ${got.max.core.toFixed(3)}, halo ${got.max.fireHalo.toFixed(3)}, glow ${got.max.fireGlow.toFixed(3)}, against CORE's ${got.coreL.toFixed(3)}; the ring is cold`)
})

process.exit(await run(process.argv.slice(2)))
