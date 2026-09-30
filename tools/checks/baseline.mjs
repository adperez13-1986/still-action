/**
 * K-90: the flag-off baseline (design/area3/STAGE-R.md §3 R0, §4 K-90).
 *
 *   node tools/checks/baseline.mjs capture   writes tools/checks/baseline/flagoff.json
 *   node tools/checks/baseline.mjs compare   reruns it and deep-equals it against the file
 *
 * It runs against the 6-depth page, pinned with roads=0&line=0&engine=0 (the live game is 9 depths since 30 Sep),
 * so it records what the game was: 6 depths,
 * today's curve, day and generator output on both routes. `capture` was run on the untouched src/
 * before any stage R change; every later step must still `compare` PASS. The file is deterministic, so a
 * second capture is byte-identical to the first.
 *
 * design/area3/STAGE-B.md B0 splits the flag-off Line's paths (route III at depths 4-5: `LINE_PATHS`) out as K-90L: the
 * shipped game never generates the Line, and stage B's steps B4-B6 change its rows on purpose. `compare` prints PASS|FAIL
 * K-90 over every other path and PASS|FAIL K-90L over those; a K-90L fail exits 1 unless `--line-changed`. `capture-line`
 * rewrites only `LINE_PATHS` in the file (the rest stays byte-identical).
 *
 *   node tools/checks/baseline.mjs compare [--line-changed]
 *   node tools/checks/baseline.mjs capture-line
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { REPO, evalJson, firstDiff, hash, openPage, startVite } from './lib.mjs'

const FILE = REPO + 'tools/checks/baseline/flagoff.json'
const LEVELS = REPO + 'tools/levels.json'
const QUERY = '?depth=1&save=memory&roads=0&line=0&engine=0'
const ROUTES = ['II', 'III']
/** The flag-off Line: route III's generated depths 4 (sidings) and 5 (station). K-90L's, not K-90's (STAGE-B.md B0). */
const LINE_PATHS = ['gen.III.4', 'gen.III.5', 'genLookHash.III.4', 'genLookHash.III.5', 'genLineHash']

/** Everything the baseline records, from one flag-off page. */
async function collect(page) {
  const gen = {}, genLookHash = {}, genLineHash = {}
  for (const route of ROUTES) {
    gen[route] = {}
    genLookHash[route] = {}
    for (let d = 1; d <= 6; d++) {
      gen[route][d] = await evalJson(page, ({ d, route }) => {
        const out = []
        for (let s = 1; s <= 20; s++) out.push(window.__gen(d, s, route))
        return out
      }, { d, route })
      const looks = await evalJson(page, ({ d, route }) => {
        const out = []
        for (let s = 1; s <= 10; s++) out.push(window.__genLook(d, s, route))
        return out
      }, { d, route })
      genLookHash[route][d] = looks.map((l) => hash(l))
    }
  }
  for (let d = 4; d <= 5; d++) {
    const lines = await evalJson(page, ({ d }) => {
      const out = []
      for (let s = 1; s <= 10; s++) out.push(window.__genLine(d, s))
      return out
    }, { d })
    genLineHash[d] = lines.map((l) => hash(l))
  }
  const censusDepths = await evalJson(page, () => JSON.parse(window.__census(40, 'II')).depths)
  const censusDepthsHash = hash(censusDepths)
  const pure = await evalJson(page, () => {
    const bossFor = [], areaOf = [], hourAtEnd = [], exitsAfterBoss = []
    for (let d = 1; d <= 9; d++)
      for (const a6 of [true, false]) for (const r of ['II', 'III']) for (const e of [false, true])
        bossFor.push({ d, a6, r, e, boss: window.__bossFor(d, a6, r, e) })
    for (const r of ['II', 'III']) for (let d = 0; d <= 9; d++) areaOf.push({ d, r, id: window.__areaOf(d, r) })
    for (const k of ['broken', 'stopped', 'home']) for (let d = 0; d <= 9; d++) hourAtEnd.push({ k, d, hour: window.__hourAtEnd(k, d) })
    for (let d = 1; d <= 9; d++) exitsAfterBoss.push({ d, exits: window.__exitsAfterBoss(d) })
    return { bossFor, areaOf, hourAtEnd, exitsAfterBoss, daySpan: window.__DAY_SPAN }
  })
  // route, then depth, in this order: a level enters on what the last one left (bossFelled, the day), so the
  // order is part of the baseline. One evaluate per level keeps the frame loop from stepping the world between
  // the entering and the reading.
  const entered = {}
  for (const route of ROUTES) {
    entered[route] = {}
    for (let d = 1; d <= 6; d++) {
      entered[route][d] = await evalJson(page, ({ d, route }) => {
        window.__run.route = route
        window.__enter(d, 1)
        const boss = window.__boss()
        const rec = {
          look: window.__look().place, open: !!window.__level().open, curve: window.__combat.curve, day: window.__day(),
          boss: boss && { kind: boss.kind, hp: boss.hp }, exits: window.__exits(),
        }
        if (boss) {
          window.__killBoss()
          window.__step(0.2)
          rec.after = { exits: window.__exits(), yard: window.__yardRoad(), day: window.__day() }
        }
        return rec
      }, { d, route })
    }
  }
  // the census itself is for the info line only: the file keeps its hash
  return { record: { gen, genLookHash, genLineHash, censusDepthsHash, pure, entered }, censusDepths }
}

/** The file's text, or the run's, keyed the same way. */
async function withPage(fn) {
  const vite = await startVite()
  try {
    const p = await openPage(vite.url, QUERY)
    try {
      const out = await fn(p.page)
      if (p.errors.length) throw new Error(`page errors:\n${p.errors.join('\n')}`)
      return out
    } finally {
      await p.close()
    }
  } finally {
    await vite.close()
  }
}

/** Info only, never a fail: does the census equal tools/levels.json's depths (25 Sep; drift there predates stage R)? */
function levelsInfo(censusDepths) {
  const file = JSON.parse(readFileSync(LEVELS, 'utf8'))
  const d = firstDiff(censusDepths, file.depths)
  console.log(d ? `INFO levels.json: census differs from tools/levels.json depths (first difference ${d})` : 'INFO levels.json: census equals tools/levels.json depths')
}

/** A deep copy of `rec` without the `paths` (dotted, from the root). */
function without(rec, paths) {
  const out = JSON.parse(JSON.stringify(rec))
  for (const p of paths) {
    const keys = p.split('.')
    const last = keys.pop()
    let o = out
    for (const k of keys) o = o?.[k]
    if (o) delete o[last]
  }
  return out
}

/** Only the `paths` of `rec`, keyed by their dotted names. */
function pick(rec, paths) {
  const out = {}
  for (const p of paths) out[p] = p.split('.').reduce((o, k) => o?.[k], rec) ?? null
  return out
}

const mode = process.argv[2]
const lineChanged = process.argv.includes('--line-changed')
if (mode === 'capture') {
  const { record, censusDepths } = await withPage(collect)
  writeFileSync(FILE, JSON.stringify(record, null, 1) + '\n')
  console.log(`captured ${FILE}`)
  levelsInfo(censusDepths)
} else if (mode === 'capture-line') {
  const { record } = await withPage(collect)
  const file = JSON.parse(readFileSync(FILE, 'utf8'))
  for (const p of LINE_PATHS) {
    const keys = p.split('.')
    const last = keys.pop()
    const from = keys.reduce((o, k) => o[k], JSON.parse(JSON.stringify(record)))
    keys.reduce((o, k) => o[k], file)[last] = from[last]
  }
  writeFileSync(FILE, JSON.stringify(file, null, 1) + '\n')
  console.log(`captured ${LINE_PATHS.length} line paths into ${FILE} (${LINE_PATHS.join(', ')})`)
} else if (mode === 'compare') {
  const { record, censusDepths } = await withPage(collect)
  const want = JSON.parse(readFileSync(FILE, 'utf8'))
  const now = JSON.parse(JSON.stringify(record))
  levelsInfo(censusDepths)
  const d = firstDiff(without(now, LINE_PATHS), without(want, LINE_PATHS))
  const dl = firstDiff(pick(now, LINE_PATHS), pick(want, LINE_PATHS))
  console.log(d ? `FAIL K-90: ${d}` : 'PASS K-90')
  console.log(dl ? `FAIL K-90L: ${dl}${lineChanged ? ' (allowed: --line-changed)' : ''}` : 'PASS K-90L')
  if (d || (dl && !lineChanged)) process.exit(1)
} else {
  console.log('usage: node tools/checks/baseline.mjs capture|capture-line|compare [--line-changed]')
  process.exit(2)
}
