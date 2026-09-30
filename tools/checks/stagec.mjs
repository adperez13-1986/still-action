/**
 * The stage C checks (design/area3/STAGE-C.md §4): `node tools/checks/stagec.mjs [K-N1a ...]` runs all of them, or the ids
 * listed. C0 registers none: each later step adds its own here, on lib.mjs's `suite()`, as stageb.mjs does. The baselines
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
 * `enterEngine(order, depth, seed)`: the road taken (`__run.route`), a level at `depth`, Still wearing the Scrap Cleaver, the autos and
 * the break rule off; returns the Engine's level. `tick(n, before)`: n ticks of 1/60 s with Still's HP put back to 100 before each;
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

process.exit(await run(process.argv.slice(2)))
