/**
 * The stage C checks (design/area3/STAGE-C.md §4): `node tools/checks/stagec.mjs [K-N1a ...]` runs all of them, or the ids
 * listed. Each step adds its own checks here, on lib.mjs's `suite()`, as stageb.mjs does (C1-C4: K-N1a, K-N1b, K-N2a, K-N2b, K-N3). The baselines
 * (K-90, K-90L, K-90F) are baseline.mjs's and fights.mjs's; stage C never re-captures them.
 *
 * The short forms of STAGE-C.md §4, as queries (every one is ?save=memory and a dev run straight into a level):
 *   ENG6   the 6-depth run with the Engine flag: `enterEngine('III', 6, s)`
 *   ENG9   the 9-depth run: `enterEngine('III', 6, s)` (Line first) and `enterEngine('II', 9, s)` (Works first)
 *   ARENA  a clean test floor with the Engine on it: `__arena()`, `__spawn('boss', 9, 0, false, 'engine')` (the track round the origin)
 *   OFF, ON  stageb.mjs's: the 6-depth page, and the 9-depth page
 */
import { assert, evalJson, suite } from './lib.mjs'

const ENG6 = '?depth=1&save=memory&line=1&engine=1'
const ENG9 = '?depth=1&save=memory&roads=1&line=1&engine=1'
const ARENA = '?depth=1&save=memory&line=1&engine=1'
const OFF = '?depth=1&save=memory'
const ON = '?depth=1&save=memory&roads=1'

const { check, run } = suite()

/**
 * The in-page toolkit every check body starts with (it is source, spliced in front of the body by `inPage`).
 * `enterEngine(order, depth, seed)`: the road taken (`__run.route`), a level at `depth`, Still wearing the Scrap Cleaver, the autos, the
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
const enterEngine = (order, depth, seed) => {
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
    return { n: rows.length, armed: armed.length, movingTicks, bad, minGap: Math.min(...armed.map((r) => (r.armedAt - r.madeAt) * 1000)), minArmMs: Math.min(...rows.map((r) => r.armMs)) }
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

process.exit(await run(process.argv.slice(2)))
