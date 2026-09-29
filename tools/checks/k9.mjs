/**
 * The stage R checks (design/area3/STAGE-R.md §4): `node tools/checks/k9.mjs [K-9B ...]` runs all of them, or
 * the ids listed. K-90 is baseline.mjs's. Each step of the brief registers its own; an id can have several
 * parts, one per boot it needs. `ON` is the 9-depth page, `OFF` the flag-off one (§4.0).
 */
import { readFileSync } from 'node:fs'
import { REPO, assert, assertClose, assertEq, evalJson, suite } from './lib.mjs'

const BASELINE = JSON.parse(readFileSync(REPO + 'tools/checks/baseline/flagoff.json', 'utf8'))

const ON = '?depth=1&save=memory&roads=1'
const OFF = '?depth=1&save=memory'
const { check, run } = suite()

// --- K-9B: the flag's plumbing (R1); K-9B9 below is its depth-9 boot, from R4 ---------------------------------------------------------
check('K-9B', ON, async ({ page }) => {
  const got = await evalJson(page, () => ({
    runDepths: window.__runDepths, roads: window.__flags().roads, roadsAfterSet: window.__flags({ roads: false }).roads,
    step: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => window.__stepOf(d)),
    roadII: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => window.__roadOf(d, 'II')),
    roadIII: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => window.__roadOf(d, 'III')),
  }))
  assertEq('ON __runDepths', got.runDepths, 9)
  assertEq('ON __flags().roads', got.roads, true)
  assertEq("ON __flags({ roads: false }).roads (INV-F1)", got.roadsAfterSet, true)
  assertEq('ON __stepOf(1..9)', got.step, [1, 2, 3, 4, 5, 6, 4, 5, 6])
  assertEq("ON __roadOf(1..9, 'II')", got.roadII, ['II', 'II', 'II', 'II', 'II', 'II', 'III', 'III', 'III'])
  assertEq("ON __roadOf(1..9, 'III')", got.roadIII, ['III', 'III', 'III', 'III', 'III', 'III', 'II', 'II', 'II'])
})
// K-9B9 (from R4): the depth-9 boot is its own id, because the place at 7-9 is R4's lookAt (lead's call, 29 Sep)
check('K-9B9', '?depth=9&roads=1&save=memory', async ({ page }) => {
  assertEq('?depth=9&roads=1 boots with __run.depth', await evalJson(page, () => window.__run.depth), 9)
})
check('K-9B', '?depth=9&save=memory', async ({ page }) => {
  const got = await evalJson(page, () => ({ depth: window.__run.depth, runDepths: window.__runDepths }))
  assertEq('?depth=9 (flag off) boots with __run.depth', got.depth, 6)
  assertEq('?depth=9 (flag off) __runDepths', got.runDepths, 6)
})
check('K-9B', OFF, async ({ page }) => {
  const got = await evalJson(page, () => ({
    runDepths: window.__runDepths, step7: window.__stepOf(7), road7: window.__roadOf(7, 'II'), open: [1, 2, 3, 4, 5, 6, 7].map((d) => window.__openAt(d, 'II')),
    openIII: [1, 2, 3, 4, 5, 6, 7].map((d) => window.__openAt(d, 'III')),
  }))
  assertEq('OFF __runDepths', got.runDepths, 6)
  assertEq('OFF __stepOf(7) (clamped)', got.step7, 6)
  assertEq("OFF __roadOf(7, 'II')", got.road7, 'II')
  assertEq("OFF __openAt(1..7, 'II')", got.open, [true, false, false, true, false, false, false])
  assertEq("OFF __openAt(1..7, 'III')", got.openIII, [true, false, false, false, false, false, false])
  // the shipped switches: BOTH_ROADS, LINE_ENABLED and ENGINE_ON_LINE all stay false on main
  const src = readFileSync(REPO + 'src/areas.ts', 'utf8')
  const count = (re) => (src.match(re) ?? []).length
  assertEq('grep -c "BOTH_ROADS = false" src/areas.ts', count(/BOTH_ROADS = false/g), 1)
  assert(count(/export const LINE_ENABLED = false/g) === 1, 'LINE_ENABLED is not = false')
  assert(count(/export const ENGINE_ON_LINE = false/g) === 1, 'ENGINE_ON_LINE is not = false')
})

// --- K-96a: the hours at the end, pure (R2) ---------------------------------------------------
check('K-96a', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    const at = (k, ds) => ds.map((d) => window.__hourAtEnd(k, d))
    return { home: at('home', [3, 6, 9]), broken: at('broken', [1, 2, 3, 4, 5, 6, 7, 8, 9]), stopped: at('stopped', [1, 2, 3, 4, 5, 6, 7, 8, 9]) }
  })
  assertEq("ON __hourAtEnd('home', 3|6|9)", got.home, ['afternoon', 'dusk', 'night'])
  const away = ['morning', 'morning', 'noon', 'afternoon', 'afternoon', 'afternoon', 'dusk', 'dusk', 'dusk']
  assertEq('ON __hourAtEnd(broken, 1..9)', got.broken, away)
  assertEq('ON __hourAtEnd(stopped, 1..9)', got.stopped, away)
  // INV-H1: home is never earlier than broken at a depth, and no hour runs backward as depth rises
  const order = ['morning', 'noon', 'afternoon', 'dusk', 'night']
  const homes = await evalJson(page, () => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => window.__hourAtEnd('home', d)))
  homes.forEach((h, i) => {
    assert(order.indexOf(h) >= order.indexOf(away[i]), `INV-H1: home at ${i + 1} (${h}) is earlier than broken (${away[i]})`)
    if (i) assert(order.indexOf(h) >= order.indexOf(homes[i - 1]), `INV-H1: home runs backward at ${i + 1}`)
  })
})
check('K-96a', OFF, async ({ page }) => {
  const got = await evalJson(page, () => {
    const out = []
    for (const k of ['broken', 'stopped', 'home']) for (let d = 0; d <= 9; d++) out.push({ k, d, hour: window.__hourAtEnd(k, d) })
    return out
  })
  assertEq('OFF __hourAtEnd vs baseline', got, BASELINE.pure.hourAtEnd)
})

// --- K-97a: the day over 9, pure (R2) ---------------------------------------------------------
const SPAN9 = {
  1: ['morning', 'late-morning', 'rooms'], 2: ['late-morning', 'noon', 'rooms'], 3: ['noon', 'noon', 'hold'],
  4: ['afternoon', 'mid-afternoon', 'rooms'], 5: ['mid-afternoon', 'late-afternoon', 'rooms'], 6: ['late-afternoon', 'late-afternoon', 'hold'],
  7: ['late-afternoon', 'early-dusk', 'rooms'], 8: ['early-dusk', 'dusk', 'rooms'], 9: ['dusk', 'first-dark', 'boss'],
}
check('K-97a', ON, async ({ page }) => {
  const got = await evalJson(page, () => ({
    span: window.__DAY_SPAN,
    join4: [window.__dayAt(4, 1), window.__dayAt(5, 0)],
    join7: [window.__dayAt(7, 1), window.__dayAt(8, 0)],
  }))
  assertEq('ON __DAY_SPAN keys', Object.keys(got.span).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9])
  for (let d = 1; d <= 9; d++) assertEq(`ON __DAY_SPAN[${d}]`, [got.span[d].from, got.span[d].to, got.span[d].by], SPAN9[d])
  for (let d = 1; d <= 8; d++) if (d !== 3) assertEq(`__DAY_SPAN[${d}].to == [${d + 1}].from`, got.span[d].to, got.span[d + 1].from)
  assertEq("rows by 'boss'", Object.keys(got.span).filter((d) => got.span[d].by === 'boss').map(Number), [9])
  assertClose('__dayAt(4, 1) vs __dayAt(5, 0)', got.join4[0], got.join4[1])
  assertClose('__dayAt(7, 1) vs __dayAt(8, 0)', got.join7[0], got.join7[1])
})

// --- K-9A: the curve and the boss's HP (R3) ---------------------------------------------------
// §2.2's rows, written out here on purpose: the check must not read the table it is checking. [hp, dmg, budget, bigBonus, heavyHp, heavyDmg, heavies, bossHp, bossDmg]
const CURVE9 = {
  1: [1.0, 1.0, 0, 0, 1.0, 1.0, 1, 1, 1], 2: [1.0, 1.0, 0, 0, 1.25, 1.0, 1, 1, 1], 3: [1.0, 1.0, 1, 1, 1.0, 1.0, 2, 1.0, 1.1],
  4: [1.1, 1.2, 1, 0, 1.5, 1.1, 2, 1, 1], 5: [1.2, 1.25, 2, 1, 1.75, 1.2, 3, 1, 1], 6: [1.0, 1.0, 2, 1, 1.0, 1.0, 3, 1.2, 1.0],
  7: [1.2, 1.25, 2, 1, 1.75, 1.2, 3, 1, 1], 8: [1.3, 1.3, 2, 1, 2.0, 1.3, 3, 1, 1], 9: [1.0, 1.0, 2, 1, 1.0, 1.0, 3, 1.3, 1.05],
  10: [1, 1, 0, 0, 1, 1, 0, 1, 1],
}
const CURVE_KEYS = ['hp', 'dmg', 'budget', 'bigBonus', 'heavyHp', 'heavyDmg', 'heavies', 'bossHp', 'bossDmg']
const rowOf = (a) => Object.fromEntries(CURVE_KEYS.map((k, i) => [k, a[i]]))
check('K-9A', ON, async ({ page }) => {
  const got = await evalJson(page, () => ({
    rows: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((d) => window.__curveAt(d)),
    boss6: window.__bossFor(6, true, 'II').hp, boss9: window.__bossFor(9, true, 'III').hp,
  }))
  for (let d = 1; d <= 10; d++) assertEq(`ON __curveAt(${d})`, got.rows[d - 1], rowOf(CURVE9[d]))
  assertEq("ON __bossFor(6, true, 'II').hp", got.boss6, 1080)
  assertEq("ON __bossFor(9, true, 'III').hp", got.boss9, 1170)
})
check('K-9A', OFF, async ({ page }) => {
  const got = await evalJson(page, () => ({
    rows: [1, 2, 3, 4, 5, 6, 7].map((d) => window.__curveAt(d)), boss6: window.__bossFor(6).hp,
  }))
  // today's rows, as the baseline's entered levels recorded them
  for (let d = 1; d <= 6; d++) assertEq(`OFF __curveAt(${d}) vs baseline`, got.rows[d - 1], BASELINE.entered.II[d].curve)
  assertEq('OFF __curveAt(7) equals row 5', got.rows[6], got.rows[4])
  assertEq('OFF __bossFor(6).hp', got.boss6, 1170)
})

process.exit(await run(process.argv.slice(2)))
