/**
 * The stage A checks, ported from design/area3/SPEC.md §12.2 (design/area3/STAGE-R.md R9): K-R2, K-R3, K-X1, K-X2, K-X4,
 * K-X5, K-X6 and K-X7. Their assertions are SPEC's text. They run with the flag off (a 6-depth run) and `?line=1`, the
 * URL form of SPEC's `__flags({ line: true })`; `node tools/checks/area3.mjs [K-X1 ...]` runs all of them, or the ids listed.
 *
 * Where SPEC's setup leaves a state open, each check makes its own: a run that is not a dev run (`__run.dev = false`, so
 * a beam writes its snapshot and an ending commits, both into the memory store), a fresh save, and a road not yet chosen.
 */
import { assert, assertClose, assertEq, evalJson, suite } from './lib.mjs'

const LINE = '?depth=1&save=memory&line=1'
const { check, run } = suite()

/** In the page: a fresh save with `patch`, a non-dev run, the road unchosen. */
const PREP = `(patch) => {
  window.__run.dev = false
  window.__setSave(null)
  window.__setSave(patch)
  window.__run.route = null
}`

// --- K-R: routes (A1) ------------------------------------------------------------------------
check('K-R2', LINE, async ({ page }) => {
  const got = await evalJson(page, () => {
    const at = (route, depths) => depths.map((d) => { window.__run.route = route; window.__enter(d, 1); return window.__look().place })
    const out = { III: at('III', [4, 5, 6]), II: at('II', [4, 5, 6]) }
    window.__flags({ engine: true })
    out.IIIengine6 = at('III', [6])[0]
    window.__flags({ engine: null })
    return out
  })
  assertEq('route III, 4-6, engine off', got.III, ['sidings', 'station', 'quarter'])
  assertEq('route III at 6, engine on', got.IIIengine6, 'station')
  assertEq('route II, 4-6', got.II, ['works', 'quarter', 'quarter'])
})
check('K-R3', LINE, async ({ page }) => {
  const got = await evalJson(page, () => ({
    a: window.__bossFor(6, true, 'III', false).kind, b: window.__bossFor(6, true, 'III', true).kind,
    c: window.__bossFor(6, true, 'II', true).kind, d: window.__bossFor(6, false).kind,
  }))
  assertEq("__bossFor(6, true, 'III', false).kind", got.a, 'arbiter')
  assertEq("__bossFor(6, true, 'III', true).kind", got.b, 'engine')
  assertEq("__bossFor(6, true, 'II', true).kind", got.c, 'arbiter')
  assertEq('__bossFor(6, false).kind', got.d, 'assembler')
})

// --- K-X: the crossroads (A2, B4) --------------------------------------------------------------
/** In the page: to depth 3 with its boss down, then into the cold beam; what comes next. */
const DOWN_FROM_3 = `(roads) => {
  (${PREP})({ roads })
  window.__enter(3, 1)
  window.__killBoss()
  window.__step(0.2)
  const cold = window.__exits().cold
  if (!cold) return { bad: 'no cold beam after the kill at 3' }
  window.__still.pos.set(cold.x + 3, 0, cold.z)
  window.__step(0.1)
  window.__still.pos.set(cold.x, 0, cold.z)
  const t = window.__until(() => window.__mode() === 'crawl' && (window.__run.depth === 4 || window.__route().atCrossroads), 8)
  const r = window.__route()
  return {
    t, mode: window.__mode(), depth: window.__run.depth, route: window.__run.route, atCrossroads: r.atCrossroads,
    roads: window.__roads(), exits: window.__exits(), packs: window.__level().packs.length,
  }
}`
check('K-X1', LINE, async ({ page }) => {
  const got = await page.evaluate(`(${DOWN_FROM_3})(['II'])`)
  assert(!got.bad, got.bad)
  assert(got.t >= 0, `no crawl within 8 s (mode ${got.mode})`)
  assertEq("with roads ['II']: phase", got.mode, 'crawl')
  assertEq("with roads ['II']: depth", got.depth, 4)
  assertEq("with roads ['II']: route", got.route, 'II')
  assertEq("with roads ['II']: atCrossroads", got.atCrossroads, false)
})
check('K-X2', LINE, async ({ page }) => {
  const got = await page.evaluate(`(${DOWN_FROM_3})(['II', 'III'])`)
  assert(!got.bad, got.bad)
  assertEq("with roads ['II', 'III']: __route().atCrossroads", got.atCrossroads, true)
  assertEq('__roads() length', got.roads?.length, 2)
  assertEq('__roads() routes', got.roads.map((r) => r.route), ['II', 'III'])
  assertClose('II at', [got.roads[0].x, got.roads[0].z], [-4.6, -0.35], 1e-6)
  assertClose('III at', [got.roads[1].x, got.roads[1].z], [-0.35, -4.6], 1e-6)
  assertEq('both open', got.roads.map((r) => r.open), [true, true])
  assertEq('__exits().cold', got.exits.cold, null)
  assertEq('__exits().warm', got.exits.warm, null)
  assertEq('__level().packs.length', got.packs, 0)
})
check('K-X4', LINE, async ({ page }) => {
  const got = await page.evaluate(`(() => {
    (${PREP})({ roads: ['II', 'III'] })
    window.__crossroads()
    const took = window.__takeRoad('III')
    return {
      took, route: window.__run.route, place: window.__look().place, depth: window.__run.depth,
      lastRoad: window.__save().lastRoad, snapRoute: window.__snapshot()?.route ?? null,
    }
  })()`)
  assertEq("__takeRoad('III')", got.took, 'III')
  assertEq('run.route', got.route, 'III')
  assertEq('__look().place', got.place, 'sidings')
  assertEq('depth', got.depth, 4)
  assertEq('save.lastRoad', got.lastRoad, 'III')
  assertEq('__snapshot().route', got.snapRoute, 'III')
})
// a reload needs a real save: a fresh context, no ?depth, no ?save=memory
check('K-X5', '?line=1', async ({ page }) => {
  const before = await page.evaluate(`(() => {
    window.__setSave({ roads: ['II', 'III'] })
    // the strain comes first: the crossroads' beam save is what a reload brings back
    window.__strain(3)
    window.__crossroads()
    const snap = window.__snapshot()
    return { crossroads: snap?.crossroads, route: snap?.route, depth: snap?.depth, strain: window.__run.strain }
  })()`)
  assertEq('__snapshot().crossroads at the crossroads', before.crossroads, true)
  assertEq('__snapshot().route', before.route, null)
  assertEq('__snapshot().depth', before.depth, 3)
  await page.reload()
  await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
  const after = await page.evaluate(`(() => {
    window.__continue()
    return { atCrossroads: window.__route().atCrossroads, strain: window.__run.strain, depth: window.__run.depth }
  })()`)
  assertEq('after the reload and __continue(): atCrossroads', after.atCrossroads, true)
  assertEq('after the reload: strain', after.strain, before.strain)
  assertEq('after the reload: depth', after.depth, 3)
})
check('K-X6', LINE, async ({ page }) => {
  const got = await page.evaluate(`(() => {
    (${PREP})({ roads: ['II', 'III'], lastRoad: 'III' })
    window.__flags({ roadChoice: 'alternate' })
    window.__enter(3, 1)
    window.__killBoss()
    window.__step(0.2)
    const out = { yard: window.__yardRoad(), exits: window.__exits() }
    window.__flags({ roadChoice: null })
    return out
  })()`)
  assertEq("the Assembler's cold beam leads to", got.yard?.route ?? null, 'II')
  assertEq('its label', got.yard?.label ?? null, 'the Works')
  assert(got.exits.cold?.open === true, `the cold beam is ${JSON.stringify(got.exits.cold)}`)
})
check('K-X7', LINE, async ({ page }) => {
  const got = await page.evaluate(`(() => {
    const commit = (line) => {
      (${PREP})({ roads: ['II'] })
      if (line === false) window.__flags({ line: false })
      window.__enter(4, 1)
      window.__end('broken')
      const roads = [...window.__save().roads]
      window.__flags({ line: null })
      window.__until(() => window.__mode() === 'ending', 10)
      return roads
    }
    return { on: commit(true), off: commit(false) }
  })()`)
  assertEq("a run that reaches 4 and breaks, line on: save.roads", got.on, ['II', 'III'])
  assertEq("the same with __flags({ line: false }): save.roads", got.off, ['II'])
})

process.exit(await run(process.argv.slice(2)))
