/**
 * The stage R checks (design/area3/STAGE-R.md §4): `node tools/checks/k9.mjs [K-9B ...]` runs all of them, or
 * the ids listed. K-90 is baseline.mjs's. Each step of the brief registers its own; an id can have several
 * parts, one per boot it needs. `ON` is the 9-depth page, `OFF` the flag-off one (§4.0).
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { REPO, assert, assertClose, assertEq, evalJson, hash, suite } from './lib.mjs'

const BASELINE = JSON.parse(readFileSync(REPO + 'tools/checks/baseline/flagoff.json', 'utf8'))

const ON = '?depth=1&save=memory&roads=1'
const OFF = '?depth=1&save=memory'
const { check, task, run } = suite()

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

// --- K-92a: every depth has a plan (R4); the entered half (b) comes with R6 ---------------------
// depth -> [place, boss as kind/adds/hp or null, area, step], for the Works-first (W) and Line-first (L) orders
const PLAN = {
  1: [['ruin', null, 'I', 1], ['ruin', null, 'I', 1]],
  2: [['ruin', null, 'I', 2], ['ruin', null, 'I', 2]],
  3: [['ruin', 'assembler/hulks/900', 'I', 3], ['ruin', 'assembler/hulks/900', 'I', 3]],
  4: [['works', null, 'II', 4], ['sidings', null, 'III', 4]],
  5: [['quarter', null, 'II', 5], ['station', null, 'III', 5]],
  6: [['quarter', 'arbiter/none/1080', 'II', 6], ['station', 'assembler/rams-mites/1080', 'III', 6]],
  7: [['sidings', null, 'III', 4], ['works', null, 'II', 4]],
  8: [['station', null, 'III', 5], ['quarter', null, 'II', 5]],
  9: [['station', 'assembler/rams-mites/1170', 'III', 6], ['quarter', 'arbiter/none/1170', 'II', 6]],
}
/** With the engine flag, the Line's last step (the stand-in) reads engine/none at the same HP. */
const withEngine = (boss) => (boss?.startsWith('assembler/rams-mites') ? 'engine/none/' + boss.split('/')[2] : boss)
async function planCheck(page, engine) {
  const got = await evalJson(page, () => {
    const out = {}
    for (let d = 1; d <= 9; d++) out[d] = [window.__plan(d, 'II'), window.__plan(d, 'III')]
    return out
  })
  const tag = engine ? 'ON&engine=1' : 'ON'
  for (let d = 1; d <= 9; d++) {
    ;['II', 'III'].forEach((o, i) => {
      const p = got[d][i]
      const [place, boss0, area, step] = PLAN[d][i]
      const boss = engine && d > 3 ? withEngine(boss0) : boss0
      const road = d <= 6 ? o : o === 'II' ? 'III' : 'II'
      const what = `${tag} __plan(${d}, '${o}')`
      assertEq(`${what}.place`, p.place, place)
      assertEq(`${what}.boss`, p.boss && `${p.boss.kind}/${p.boss.adds}/${p.boss.hp}`, boss)
      assertEq(`${what}.area`, p.area, area)
      assertEq(`${what}.step`, p.step, step)
      assertEq(`${what}.road`, p.road, road)
    })
  }
}
check('K-92a', ON, ({ page }) => planCheck(page, false))
check('K-92a', ON + '&engine=1', ({ page }) => planCheck(page, true))
check('K-92a', OFF, async ({ page }) => {
  const got = await evalJson(page, () => ({
    W: [1, 2, 3, 4, 5, 6].map((d) => window.__plan(d, 'II').place), L: [1, 2, 3, 4, 5, 6].map((d) => window.__plan(d, 'III').place),
    boss: window.__bossFor(6, true, 'III', false).kind,
  }))
  assertEq("OFF __plan(1..6, 'II').place", got.W, ['ruin', 'ruin', 'ruin', 'works', 'quarter', 'quarter'])
  assertEq("OFF __plan(1..6, 'III').place (the roads meet)", got.L, ['ruin', 'ruin', 'ruin', 'sidings', 'station', 'quarter'])
  assertEq("OFF __bossFor(6, true, 'III', false).kind", got.boss, 'arbiter')
})

// --- K-91: the 9-depth run leaves the Works-first 1-6 alone (R5) --------------------------------
check('K-91', ON, async ({ page }) => {
  for (let d = 1; d <= 6; d++) {
    const gen = await evalJson(page, ({ d }) => Array.from({ length: 20 }, (_, i) => window.__gen(d, i + 1, 'II')), { d })
    assertEq(`ON __gen(${d}, 1..20, 'II') vs baseline`, gen, BASELINE.gen.II[d])
    const looks = await evalJson(page, ({ d }) => Array.from({ length: 10 }, (_, i) => window.__genLook(d, i + 1, 'II')), { d })
    assertEq(`ON hash(__genLook(${d}, 1..10, 'II')) vs baseline`, looks.map((l) => hash(l)), BASELINE.genLookHash.II[d])
  }
  // the Line at 1, 2, 3, 5 is the same level in both run lengths (4 loses its Sleepers; 6 is the stand-in's)
  for (const d of [1, 2, 3, 5]) {
    const gen = await evalJson(page, ({ d }) => Array.from({ length: 20 }, (_, i) => window.__gen(d, i + 1, 'III')), { d })
    assertEq(`ON __gen(${d}, 1..20, 'III') vs baseline`, gen, BASELINE.gen.III[d])
  }
  // R11: no Sleepers (the ballast brood) on the Line at the run's depth 4
  const ballast = await evalJson(page, () => {
    const out = []
    for (let s = 1; s <= 40; s++) if (window.__genLine(4, s, 'III').packs.some((p) => p.look === 'ballast')) out.push(s)
    return out
  })
  assertEq("ON __genLine(4, 1..40, 'III') seeds with a ballast pack", ballast, [])
})

// --- K-98: the Line's lessons at its first step in both orders (R5; R9, R11) -------------------
check('K-98', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    const seeds = (n) => Array.from({ length: n }, (_, i) => i + 1)
    const isSwarmLesson = (p) => p.lesson && p.kinds.length === 8 && p.kinds.every((k) => k === 'swarm')
    return {
      first: [[4, 'III'], [7, 'II']].map(([d, o]) => seeds(20).map((s) => {
        const l = window.__genLine(d, s, o)
        const lessons = l.lanes.filter((ln) => ln.lesson)
        return { place: l.place, lessons: lessons.length, packInLessonRoom: lessons.some((ln) => l.packs.some((p) => p.room === ln.room)),
          siding0: l.sidings.length ? l.sidings[0].holds : null }
      })),
      second: [[5, 'III'], [8, 'II']].map(([d, o]) => seeds(20).map((s) => {
        const l = window.__genLine(d, s, o)
        return { place: l.place, lessons: l.lanes.filter((ln) => ln.lesson).length }
      })),
      swarm: {
        w4: seeds(20).map((s) => window.__gen(4, s, 'II').some(isSwarmLesson)), l4: seeds(20).map((s) => window.__gen(4, s, 'III').some(isSwarmLesson)),
        w7: seeds(20).map((s) => window.__gen(7, s, 'II').some(isSwarmLesson)), l7: seeds(20).map((s) => window.__gen(7, s, 'III').some(isSwarmLesson)),
      },
      ballast: [[4, 'III'], [7, 'II']].map(([d, o]) => seeds(40).filter((s) => window.__genLine(d, s, o).packs.some((p) => p.look === 'ballast')).length),
      worksLineFirst: {
        lobberLesson8: seeds(20).map((s) => window.__genLook(8, s, 'III').packs.some((p) => p.lesson && p.lobbers.some(Boolean))),
        heap7: seeds(20).filter((s) => window.__genLook(7, s, 'III').packs.some((p) => p.look === 'heap')).length,
        lobbersOnLine8: seeds(20).filter((s) => window.__genLook(8, s, 'II').packs.some((p) => p.lobbers.some(Boolean))).length,
      },
    }
  })
  const n = (a) => a.filter(Boolean).length
  ;[['(4, III)', 0], ['(7, II)', 1]].forEach(([tag, i]) => {
    const rows = got.first[i]
    rows.forEach((r, s) => {
      assertEq(`__genLine${tag} seed ${s + 1} place`, r.place, 'sidings')
      assert(r.lessons <= 1, `__genLine${tag} seed ${s + 1}: ${r.lessons} lesson lanes`)
      assert(!r.packInLessonRoom, `__genLine${tag} seed ${s + 1}: a pack in the lesson lane's room`)
      assert(r.siding0 === null || r.siding0 === 'handcar', `__genLine${tag} seed ${s + 1}: sidings[0].holds is ${r.siding0}`)
    })
    assert(n(rows.map((r) => r.lessons === 1)) >= 18, `__genLine${tag}: exactly one lesson lane on only ${n(rows.map((r) => r.lessons === 1))} of 20 seeds`)
  })
  ;[['(5, III)', 0], ['(8, II)', 1]].forEach(([tag, i]) => got.second[i].forEach((r, s) => {
    assertEq(`__genLine${tag} seed ${s + 1} place`, r.place, 'station')
    assertEq(`__genLine${tag} seed ${s + 1} lesson lanes`, r.lessons, 0)
  }))
  assert(n(got.swarm.w4) >= 18, `swarm lesson in __gen(4, s, 'II') on only ${n(got.swarm.w4)} of 20 seeds`)
  assert(n(got.swarm.l4) >= 18, `swarm lesson in __gen(4, s, 'III') on only ${n(got.swarm.l4)} of 20 seeds`)
  assertEq("swarm lesson in __gen(7, s, 'II')", n(got.swarm.w7), 0)
  assertEq("swarm lesson in __gen(7, s, 'III')", n(got.swarm.l7), 0)
  assertEq("R11: seeds with a ballast pack in __genLine(4, s, 'III')", got.ballast[0], 0)
  assert(got.ballast[1] >= 1, "R11: no ballast pack in __genLine(7, s, 'II') on any of 40 seeds")
  assert(n(got.worksLineFirst.lobberLesson8) >= 18, `lobber lesson in __genLook(8, s, 'III') on only ${n(got.worksLineFirst.lobberLesson8)} of 20 seeds`)
  assert(got.worksLineFirst.heap7 >= 1, "no heap in __genLook(7, s, 'III') on any of 20 seeds")
  assertEq("seeds with a lobber in __genLook(8, s, 'II') (the Line)", got.worksLineFirst.lobbersOnLine8, 0)
})

// --- K-99: the open fields (R6) --------------------------------------------------------------
async function openDepths(page) {
  return evalJson(page, () => {
    const out = {}
    for (const o of ['II', 'III']) {
      out[o] = []
      for (let d = 1; d <= window.__runDepths; d++) {
        for (let s = 1; s <= 3; s++) {
          window.__run.route = o
          window.__enter(d, s)
          if (!!window.__level().open !== window.__openAt(d, o)) out[o].push(`d${d} s${s}: open ${!!window.__level().open}, __openAt ${window.__openAt(d, o)}`)
          if (s === 1 && window.__level().open) out[o + 'set'] = [...(out[o + 'set'] ?? []), d]
        }
      }
    }
    return out
  })
}
check('K-99', ON, async ({ page }) => {
  const got = await openDepths(page)
  assertEq("ON: entered open flag vs __openAt, order 'II'", got.II, [])
  assertEq("ON: entered open flag vs __openAt, order 'III'", got.III, [])
  assertEq("ON: open depths, Works first", got.IIset, [1, 4])
  assertEq("ON: open depths, Line first", got.IIIset, [1, 7])
})
check('K-99', OFF, async ({ page }) => {
  const got = await openDepths(page)
  assertEq("OFF: entered open flag vs __openAt, order 'II'", got.II, [])
  assertEq("OFF: entered open flag vs __openAt, order 'III'", got.III, [])
  assertEq("OFF: open depths, Works first", got.IIset, [1, 4])
  assertEq("OFF: open depths, Line first", got.IIIset, [1])
})

// --- K-97b: the day over 9, entered (R6) ------------------------------------------------------
check('K-97b', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    const out = {}
    for (const o of ['II', 'III']) {
      window.__run.route = o
      window.__enter(6, 1)
      window.__killBoss()
      window.__step(0.2)
      const six = window.__day()
      window.__enter(9, 1)
      window.__combat.boss.hp = window.__combat.boss.maxHp / 2
      window.__step(4)
      const half = window.__day()
      window.__killBoss()
      window.__step(0.2)
      const dark = window.__day()
      out[o] = { six: { progress: six.progress, from: six.from }, halfTarget: half.target, dark: { progress: dark.progress, to: dark.to } }
    }
    return out
  })
  for (const o of ['II', 'III']) {
    assertEq(`ON ${o}: depth 6 after the kill, progress`, got[o].six.progress, 0)
    assertEq(`ON ${o}: depth 6 after the kill, from`, got[o].six.from, 'late-afternoon')
    assert(Math.abs(got[o].halfTarget - 0.5) <= 0.02, `ON ${o}: depth 9 at half HP, day target ${got[o].halfTarget} is not within 0.02 of 0.5`)
    assertEq(`ON ${o}: depth 9 after the kill, progress`, got[o].dark.progress, 1)
    assertEq(`ON ${o}: depth 9 after the kill, to`, got[o].dark.to, 'first-dark')
  }
})
check('K-97b', OFF, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    return window.__day().progress
  })
  assertEq('OFF: depth 6 after the kill, progress', got, 1)
})

// --- K-96b: Home at 6 is a dusk homecoming with no walk (R6) ----------------------------------
check('K-96b', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    window.__end('home')
    const hour = window.__run.ending?.hour ?? null
    const modes = new Set()
    let reached = -1
    for (let i = 0; i <= 8 * 60; i++) {
      modes.add(window.__mode())
      if (window.__mode() === 'ending') { reached = i / 60; break }
      window.__step(1 / 60)
    }
    return { hour, reached, walked: modes.has('toWalk') || modes.has('walkHome'), modes: [...modes] }
  })
  assertEq('ON: __run.ending.hour after __end(home) at 6', got.hour, 'dusk')
  assert(got.reached >= 0, `ON: never reached 'ending' within 8 s (modes seen: ${got.modes})`)
  assert(!got.walked, `ON: a walk at 6 (modes seen: ${got.modes})`)
})

// --- K-95a: the beams by boss (R6) -------------------------------------------------------------
check('K-95a', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    const out = { exits: [3, 6, 9].map((d) => window.__exitsAfterBoss(d)) }
    for (const o of ['II', 'III']) {
      window.__run.route = o
      window.__enter(6, 1)
      window.__killBoss()
      window.__step(0.2)
      const e6 = window.__exits()
      out['six' + o] = { cold: e6.cold, warm: e6.warm, yard: window.__yardRoad() }
      window.__enter(9, 1)
      window.__killBoss()
      window.__step(0.2)
      const e9 = window.__exits()
      out['nine' + o] = { cold: e9.cold, warm: e9.warm, yard: window.__yardRoad() }
    }
    // at 3, the road not chosen yet (the save's roads are ['II']: no room, no alternate)
    window.__run.route = null
    window.__enter(3, 1)
    window.__killBoss()
    window.__step(0.2)
    out.three = window.__yardRoad()
    return out
  })
  assertEq('ON __exitsAfterBoss(3|6|9)', got.exits, [['cold', 'warm'], ['cold', 'warm'], ['warm']])
  for (const [o, other] of [['II', 'III'], ['III', 'II']]) {
    const six = got['six' + o], nine = got['nine' + o]
    assert(six.cold?.open === true && six.warm?.open === true, `ON ${o}: after the kill at 6 the beams are cold=${JSON.stringify(six.cold)} warm=${JSON.stringify(six.warm)}`)
    assertEq(`ON ${o}: __yardRoad().route after the kill at 6`, six.yard?.route ?? null, other)
    assertEq(`ON ${o}: cold beam at 9`, nine.cold, null)
    assert(nine.warm?.open === true, `ON ${o}: warm beam at 9 is ${JSON.stringify(nine.warm)}`)
    assertEq(`ON ${o}: __yardRoad() at 9`, nine.yard, null)
  }
  assertEq('ON: __yardRoad() at 3 with the road unchosen', got.three, null)
})
check('K-95a', OFF, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    return window.__yardRoad()
  })
  assertEq('OFF: __yardRoad() at 6 after the kill', got, null)
})

// --- K-94: the square's cold beam (R7) ---------------------------------------------------------
check('K-94', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    const BODY = 0.42, EXIT_R = 1.4, STEP = 0.25
    const bad = []
    for (let s = 1; s <= 20; s++) {
      window.__run.route = 'II'
      window.__enter(6, s)
      window.__killBoss()
      window.__step(0.2)
      const lv = window.__level(), ex = window.__exits(), fp = lv.footprint, terrain = window.__combat.terrain
      const why = (m) => bad.push(`seed ${s}: ${m}`)
      if (!ex.cold || !ex.cold.open) { why(`cold beam is ${JSON.stringify(ex.cold)}`); continue }
      if (!ex.warm) { why('no warm beam'); continue }
      if (fp.dead !== false) why(`footprint.dead is ${fp.dead}`)
      const dFoot = Math.hypot(ex.cold.x - fp.x, ex.cold.z - fp.z)
      if (dFoot < fp.r + EXIT_R + BODY) why(`cold is ${dFoot.toFixed(2)} from the footprint, needs ${(fp.r + EXIT_R + BODY).toFixed(2)}`)
      if (terrain.blocked(ex.cold.x, ex.cold.z, BODY)) why('cold stands on something blocked')
      const dWarm = Math.hypot(ex.cold.x - ex.warm.x, ex.cold.z - ex.warm.z)
      if (dWarm < 3.3) why(`cold is ${dWarm.toFixed(2)} from warm, needs 3.3`)
      // a 0.25 u grid over the floor's bounding box: can he walk from the entrance to within 1.0 of each beam?
      const cells = [...lv.floor].map((k) => k.split(',').map(Number))
      const xs = cells.map((c) => c[0] * 4), zs = cells.map((c) => c[1] * 4)
      const x0 = Math.min(...xs) - 2, x1 = Math.max(...xs) + 2, z0 = Math.min(...zs) - 2, z1 = Math.max(...zs) + 2
      const nx = Math.round((x1 - x0) / STEP) + 1, nz = Math.round((z1 - z0) / STEP) + 1
      const seen = new Uint8Array(nx * nz)
      const at = (i, j) => [x0 + i * STEP, z0 + j * STEP]
      const si = Math.round((lv.entrance.x - x0) / STEP), sj = Math.round((lv.entrance.z - z0) / STEP)
      const queue = [si + sj * nx]
      seen[si + sj * nx] = 1
      let cold = false, warm = false
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q] % nx, j = (queue[q] - i) / nx
        const [x, z] = at(i, j)
        if (Math.hypot(x - ex.cold.x, z - ex.cold.z) <= 1.0) cold = true
        if (Math.hypot(x - ex.warm.x, z - ex.warm.z) <= 1.0) warm = true
        if (cold && warm) break
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di, nj = j + dj
          if (ni < 0 || nj < 0 || ni >= nx || nj >= nz || seen[ni + nj * nx]) continue
          seen[ni + nj * nx] = 1
          const [px, pz] = at(ni, nj)
          if (!terrain.blocked(px, pz, BODY)) queue.push(ni + nj * nx)
        }
      }
      if (!cold) why('the cold beam cannot be reached from the entrance')
      if (!warm) why('the warm beam cannot be reached from the entrance')
      // the Line's dressing on the cold beam (after boss 6 of a 9-depth run): no rail or sleeper comes within the husk's radius + 0.5
      const yr = window.__yardRails()
      if (!yr || !yr.rails.length) { why(`no rails on the dressed cold beam (${JSON.stringify(yr)})`); continue }
      const segDist = ([x0, z0, x1, z1]) => {
        const dx = x1 - x0, dz = z1 - z0
        const t = Math.max(0, Math.min(1, ((fp.x - x0) * dx + (fp.z - z0) * dz) / (dx * dx + dz * dz)))
        return Math.hypot(x0 + dx * t - fp.x, z0 + dz * t - fp.z)
      }
      const near = Math.min(...yr.rails.map(segDist), ...yr.sleepers.map(([x, z]) => Math.hypot(x - fp.x, z - fp.z)))
      if (near < fp.r + 0.5) why(`the dressing's rails come within ${near.toFixed(2)} of the husk's centre, needs ${(fp.r + 0.5).toFixed(2)}`)
    }
    return bad
  })
  assert(got.length === 0, `ON: the square's beams over seeds 1..20, ${got.length} failures, first: ${got.slice(0, 2).join(' | ')}`)
})
check('K-94', OFF, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    return window.__exits().cold
  })
  assertEq('OFF: the cold beam at 6 after the kill', got, null)
})

// --- K-93: the run through its real transitions (R8) -------------------------------------------
/**
 * (K-93's walker.) One sync evaluate walks a run down its depths with the game's own descend: kill at a boss depth, __descend(), step until the
 * next crawl (or the crossroads). `order` 'III' expects the crossroads after 3 and takes the Line's road there. It returns what
 * it saw at each depth, and a list of problems (the caller asserts none).
 */
const WALK = ({ order, upTo, stopAt7, keepSave }) => {
  const bad = [], seen = {}
  // keepSave (K-9C): the run the boot began, on the save it wrote; no reset, no re-entering
  if (!keepSave) {
    window.__run.dev = false
    window.__setSave(null)
    if (order === 'III') window.__setSave({ roads: ['II', 'III'] })
    window.__run.route = null
    window.__enter(1, 1)
  }
  const check = (d) => {
    const look = window.__look().place, boss = window.__boss(), lv = window.__level(), snap = window.__snapshot()
    seen[d] = { place: look, boss: boss?.kind ?? null, open: !!lv.open, route: window.__run.route, snap: snap && { depth: snap.depth, route: snap.route } }
    if (d >= 2 && !(snap && snap.depth === window.__run.depth)) bad.push(`depth ${d}: snapshot ${JSON.stringify(snap && { depth: snap.depth, route: snap.route })}, __run.depth ${window.__run.depth}`)
    if (d >= 4 && snap && snap.route !== order) bad.push(`depth ${d}: snapshot route ${snap.route}, expected ${order}`)
  }
  for (let d = 1; d <= upTo; d++) {
    if (window.__run.depth !== d) { bad.push(`expected depth ${d}, at ${window.__run.depth}`); break }
    check(d)
    if (stopAt7 && d === 7) break
    if (window.__boss()) { window.__killBoss(); window.__step(0.2) }
    if (d === 9) { seen.descendAt9 = window.__descend(); break }
    if (window.__descend() !== true) { bad.push(`depth ${d}: __descend() is not true`); break }
    const t = window.__until(() => window.__mode() === 'crawl' && (window.__run.depth === d + 1 || window.__route().atCrossroads), 8)
    if (t < 0) { bad.push(`depth ${d}: no crawl at ${d + 1} within 8 s (mode ${window.__mode()})`); break }
    const cross = window.__route().atCrossroads
    if (d === 3 && order === 'III') {
      if (!cross) bad.push('after 3 on the Line-first run: no crossroads')
      if (window.__takeRoad('III') !== 'III') bad.push("__takeRoad('III') did not give 'III'")
    } else if (cross) bad.push(`after ${d}: at the crossroads`)
  }
  return { bad, seen }
}
check('K-93', ON, async ({ page }) => {
  const got = await evalJson(page, WALK, { order: 'II', upTo: 9 })
  assertEq('ON W: problems on the way down', got.bad, [])
  assertEq('ON W: __run.route at 4', got.seen[4].route, 'II')
  assertEq('ON W: place at 7 (6 to 7 directly)', got.seen[7].place, 'sidings')
  assertEq('ON W: __descend() after the kill at 9', got.seen.descendAt9, false)
})
check('K-93', ON + '&line=1', async ({ page }) => {
  const got = await evalJson(page, WALK, { order: 'III', upTo: 9 })
  assertEq('ON L: problems on the way down', got.bad, [])
  assertEq('ON L: place at 4', got.seen[4].place, 'sidings')
  assertEq('ON L: place at 7', got.seen[7].place, 'works')
  assertEq('ON L: open field at 7', got.seen[7].open, true)
  assertEq('ON L: place at 9', got.seen[9].place, 'quarter')
  assertEq('ON L: boss at 9', got.seen[9].boss, 'arbiter')
  assertEq('ON L: __descend() after the kill at 9', got.seen.descendAt9, false)
})

// --- K-95b: walked into the cold beam at 6 (R8) --------------------------------------------------
check('K-95b', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    const cold = window.__exits().cold
    if (!cold || !cold.open) return { bad: `cold is ${JSON.stringify(cold)}` }
    // 3 u from the beam, one step to arm it, then into it
    window.__still.pos.set(cold.x + 3, 0, cold.z)
    window.__step(0.1)
    window.__still.pos.set(cold.x, 0, cold.z)
    const t1 = window.__until(() => window.__mode() === 'descending', 2)
    let crossroads = false
    let arrived = -1
    for (let i = 0; i <= 8 * 60 && arrived < 0; i++) {
      if (window.__route().atCrossroads) crossroads = true
      if (window.__mode() === 'crawl' && window.__run.depth === 7) arrived = i / 60
      else window.__step(1 / 60)
    }
    return { descending: t1, arrived, crossroads, place: window.__look().place, depth: window.__run.depth }
  })
  assert(!got.bad, got.bad)
  assert(got.descending >= 0, 'never began descending within 2 s of stepping into the cold beam')
  assert(got.arrived >= 0, `no crawl at 7 within 8 s (depth ${got.depth})`)
  assertEq('atCrossroads at any step', got.crossroads, false)
  assertEq('__look().place at 7', got.place, 'sidings')
})

// --- K-96c: the night walk after the last boss (R8) ----------------------------------------------
check('K-96c', ON, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'III'
    window.__enter(9, 1)
    window.__killBoss()
    window.__step(0.2)
    window.__end('home')
    const hour = window.__run.ending?.hour ?? null
    const t = window.__until(() => window.__mode() === 'walkHome', 10)
    return { hour, walkAt: t, depth: window.__level().depth }
  })
  assertEq("ON L: __run.ending.hour after __end('home') at 9", got.hour, 'night')
  assert(got.walkAt >= 0, "never reached 'walkHome' within 10 s")
  assertEq('ON: __level().depth on the walk', got.depth, 10)
})
check('K-96c', OFF, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.route = 'II'
    window.__enter(6, 1)
    window.__killBoss()
    window.__step(0.2)
    window.__end('home')
    const t = window.__until(() => window.__mode() === 'walkHome', 10)
    return { walkAt: t, depth: window.__level().depth }
  })
  assert(got.walkAt >= 0, "OFF: never reached 'walkHome' within 10 s")
  assertEq('OFF: __level().depth on the walk', got.depth, 7)
})

// --- K-9C: a resume at 7, on a real save (R8) ----------------------------------------------------
check('K-9C', '?roads=1', async ({ page }) => {
  // a fresh context, no ?depth: the first boot is a real run, and it writes localStorage
  const got = await evalJson(page, WALK, { order: 'II', upTo: 7, stopAt7: true, keepSave: true })
  assertEq('walking W to 7: problems', got.bad, [])
  const snap = await evalJson(page, () => window.__snapshot())
  assertEq('snapshot depth at 7', snap?.depth, 7)
  assertEq("snapshot route at 7", snap?.route, 'II')
  await page.reload()
  await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
  const back = await evalJson(page, () => ({
    depth: window.__run.depth, place: window.__look().place, route: window.__route().route, lanes: window.__level().lanes?.length ?? 0,
  }))
  assertEq('after the reload: __run.depth', back.depth, 7)
  assertEq('after the reload: place', back.place, 'sidings')
  assertEq('after the reload: route', back.route, 'II')
  assert(back.lanes > 0, `after the reload: __level().lanes.length is ${back.lanes}`)
})

// --- K-9D: the build (R8) ----------------------------------------------------------------------
const distBytes = (dir) => readdirSync(dir).reduce((n, f) => {
  const p = dir + '/' + f
  return n + (statSync(p).isDirectory() ? distBytes(p) : statSync(p).size)
}, 0)
task('K-9D', async () => {
  for (const cmd of [['npx', 'tsc', '--noEmit', '-p', '.'], ['npx', 'vite', 'build']]) {
    const r = spawnSync(cmd[0], cmd.slice(1), { cwd: REPO, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`${cmd.join(' ')} exited ${r.status}: ${(r.stdout + r.stderr).slice(-400)}`)
  }
  const src = readFileSync(REPO + 'src/areas.ts', 'utf8')
  for (const name of ['BOTH_ROADS', 'LINE_ENABLED', 'ENGINE_ON_LINE']) assert(new RegExp(`export const ${name} = false`).test(src), `${name} is not = false`)
  const bytes = distBytes(REPO + 'dist')
  console.log(`INFO K-9D: dist is ${bytes} bytes (${bytes >= 5352326 ? '+' : ''}${bytes - 5352326} against BOTH-ROADS §2's 5,352,326; cap 5,600,000)`)
  assert(bytes <= 5600000, `dist is ${bytes} bytes, over the 5,600,000 cap`)
})

process.exit(await run(process.argv.slice(2)))
