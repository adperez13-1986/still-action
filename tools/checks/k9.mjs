/**
 * The stage R checks (design/area3/STAGE-R.md §4): `node tools/checks/k9.mjs [K-9B ...]` runs all of them, or
 * the ids listed. K-90 is baseline.mjs's. Each step of the brief registers its own; an id can have several
 * parts, one per boot it needs. `ON` is the 9-depth page, `OFF` the flag-off one (§4.0).
 */
import { readFileSync } from 'node:fs'
import { REPO, assert, assertEq, evalJson, suite } from './lib.mjs'

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

process.exit(await run(process.argv.slice(2)))
