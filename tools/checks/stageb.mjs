/**
 * The stage B checks (design/area3/STAGE-B.md §4): `node tools/checks/stageb.mjs [K-W3a ...]` runs all of them, or the ids
 * listed. B0 registers none: each later step adds its own here, on lib.mjs's `suite()`, as k9.mjs and area3.mjs do. The fight
 * baseline (K-90F) is fights.mjs's, K-90 and K-90L are baseline.mjs's; K-E10 will read baseline/names.json.
 *
 * The short forms of STAGE-B.md §4, as queries (every one is ?save=memory and a dev run straight into a level):
 *   ARENA  a clean test floor: `__hold(true); __arena()`, Math.random seeded as fights.mjs does
 *   LINE4  the flag-off Line, sidings: `__run.route = 'III'; __enter(4, s)`; LINE5 the same at 5 (the station)
 *   ON     the 9-depth page
 */
import { suite } from './lib.mjs'

const ARENA = '?depth=1&save=memory'
const LINE = '?depth=1&save=memory&line=1'
const ON = '?depth=1&save=memory&roads=1'
const OFF = '?depth=1&save=memory'

const { run } = suite()

process.exit(await run(process.argv.slice(2)))
