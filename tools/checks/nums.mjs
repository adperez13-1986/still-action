/**
 * NUMS (design/archetypes/NUMS.md): one raw number table per part, src/partnums.ts, in place of the stack of multipliers.
 * K-NU1 every part (and the Turret) has I, II, III rows; K-NU2 the table's worn def equals the old multiplier path's, field by field (in node, and as
 * main's `asWorn` builds it in the page); K-NU3 the evolved rows equal the old evolution path; K-NU4 a card shows the table's damage and cooldown.
 * `node tools/checks/nums.mjs [K-NU1 ...]`.
 */
import { createServer } from 'vite'
import { REPO, assert, assertEq, evalJson, firstDiff, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, task, run } = suite()

/** The modules, loaded the way vite does (the .ts sources, no build). */
async function load() {
  const server = await createServer({ root: REPO, configFile: false, logLevel: 'error', server: { middlewareMode: true }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
  try {
    const gen = await server.ssrLoadModule('/tools/gen-partnums.ts')
    const weight = await server.ssrLoadModule('/src/weight.ts')
    const abil = await server.ssrLoadModule('/src/abilities.ts')
    const nums = await server.ssrLoadModule('/src/partnums.ts')
    const evo = await server.ssrLoadModule('/src/evolutions.ts')
    return { gen, weight, abil, nums, evo }
  } finally {
    await server.close()
  }
}
const clean = (d) => JSON.parse(JSON.stringify(d))

task('K-NU1', async () => {
  const { abil, nums } = await load()
  const ids = [...abil.PARTS, ...abil.ARCH_PARTS].map((p) => p.id)
  for (const id of ids) {
    const r = nums.PARTNUMS[id]
    assert(r && r.I && r.II && r.III, `${id} has no I, II, III rows`)
    for (const k of ['I', 'II', 'III']) assert(typeof r[k].damage === 'number' && typeof r[k].cooldownMs === 'number', `${id} ${k}: damage and cooldownMs are numbers`)
  }
  assertEq('no row for a part that does not exist', Object.keys(nums.PARTNUMS).filter((id) => !ids.includes(id)), [])
  assert(ids.length >= 31, `${ids.length} parts`)
})

task('K-NU2', async () => {
  const { gen, weight, abil } = await load()
  let n = 0
  for (const base of [...abil.PARTS, ...abil.ARCH_PARTS]) {
    for (const rank of [1, 2, 3]) {
      const t = weight.fromTable(base, rank, null)
      assert(t, `${base.id} ${rank}: the table gave nothing`)
      const d = firstDiff(clean(gen.legacyWorn(base, rank)), clean(t))
      if (d) throw new Error(`${base.id} rank ${rank}: ${d}`)
      n++
    }
    // weighed(base) is the table's rank I, and a table def comes back from weighed as it is
    assertEq(`${base.id}: weighed(base)`, clean(weight.weighed(base)), clean(gen.legacyWorn(base, 1)))
    const t3 = weight.fromTable(base, 2, null)
    assert(weight.weighed(t3) === t3, `${base.id}: weighed(table def) is itself`)
  }
  assert(n >= 93, `${n} part-ranks compared`)
})

task('K-NU3', async () => {
  const { gen, weight, abil, evo } = await load()
  let n = 0
  for (const id of Object.keys(evo.EVOLUTIONS)) {
    const base = abil.byId(evo.EVOLUTIONS[id].part)
    const d = firstDiff(clean(gen.legacyWorn(base, 3, id)), clean(weight.fromTable(base, 3, id)))
    if (d) throw new Error(`${id}: ${d}`)
    n++
  }
  assert(n === 2, 'two evolved rows')
})

/** In the page: every part worn at every rank as main builds it (asWorn), against the old path's def. */
check('K-NU2', RUN, async ({ page }) => {
  const r = await evalJson(page, () => {
    const W = window
    W.__hold(true)
    W.__arena()
    const out = []
    for (const p of W.__parts) {
      for (const rank of [1, 2, 3]) {
        W.__equipRank(p.id, rank, p.slot)
        const worn = W.__hud.slots.find((s) => s.slot === p.slot).def
        out.push({ id: p.id, rank, worn: JSON.parse(JSON.stringify(worn)), old: W.__weighed(p.id, rank) })
      }
    }
    return out
  })
  for (const x of r) {
    const d = firstDiff(x.old, x.worn)
    if (d) throw new Error(`worn ${x.id} rank ${x.rank}: ${d}`)
  }
  assert(r.length >= 90, `${r.length} worn parts compared in the page`)
})

check('K-NU4', RUN, async ({ page }) => {
  const { nums } = await load()
  const row = nums.PARTNUMS['scrap-cleaver'].II
  const got = await evalJson(page, () => {
    const W = window
    W.__hold(true)
    W.__arena()
    W.__equipRank('scrap-cleaver', 2, 'arms')
    W.__pause.loadout(W.__hud.slots, () => {})
    const cards = [...document.querySelectorAll('#pause .pcard')].map((c) => ({ name: c.querySelector('.pname')?.textContent, rows: c.textContent }))
    W.__dropAt('focusing-lens', W.__still.pos.x, W.__still.pos.z)
    W.__step(1.5)
    return { cards, floor: document.querySelector('#offer .nums')?.textContent }
  })
  const c = got.cards.find((x) => x.name?.startsWith('Scrap Cleaver'))
  // the pause card lists cooldown / damage rows (no summary line: it repeated them)
  assert(c?.rows?.includes(`damage${row.damage}`) && c?.rows?.includes(`cooldown${(row.cooldownMs / 1000).toFixed(1)}s`), `the pause card of Scrap Cleaver II reads the table, got "${c?.rows}"`)
  const l = nums.PARTNUMS['focusing-lens'].I
  assert(got.floor?.startsWith(`hits ${l.damage} · every ${+(l.cooldownMs / 1000).toFixed(1)} s`), `the floor card reads the table, got "${got.floor}"`)
})

await run(process.argv.slice(2))
