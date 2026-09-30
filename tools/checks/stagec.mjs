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

process.exit(await run(process.argv.slice(2)))
