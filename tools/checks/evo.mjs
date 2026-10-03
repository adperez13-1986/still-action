/**
 * E1 (design/archetypes/E1.md): the evolution framework, Whirlwind and Rail. With no archetype nothing here is read (`fights.mjs compare` says so for the fights; K-EV8 for masteries).
 * `node tools/checks/evo.mjs [K-EV1 ...]`.
 */
import { assert, assertEq, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, run } = suite()

/** In the page: a Brawler with Scrap Cleaver at III (and Pressure Vent worn unless `lone`), the evolve card answered. Returns the arms def's name and evo. */
const BRAWLER = `(lone) => {
  const W = window
  W.__hold(true)
  W.__arena()
  W.__arch('brawler')
  W.__combat.hp = 1e6
  if (lone) W.__equip('ward', 'torso')
  W.__equipRank('scrap-cleaver', 3, 'arms')
  W.__evolve()
}`
const MARKSMAN = `() => {
  const W = window
  W.__hold(true)
  W.__arena()
  W.__arch('marksman')
  W.__combat.hp = 1e6
  W.__equipRank('focusing-lens', 3, 'head')
  W.__evolve()
}`
/** In the page: answer the evolve card (its one key), and read the arms and head defs. */
const ON = `() => {
  const b = document.querySelector('#pause .master')
  if (b) b.click()
  const W = window
  const d = (slot) => { const x = W.__hud.slots.find((s) => s.slot === slot).def; return x ? { name: x.name, evo: x.evo ?? null, rank: x.rank ?? 1, damage: x.damage } : null }
  return { had: !!b, arms: d('arms'), head: d('head'), evolved: W.__evolved(), open: document.querySelector('#pause').classList.contains('show') }
}`
const CAST = `(slot, mx, mz) => {
  const W = window
  const C = W.__combat
  const def = W.__hud.slots.find((s) => s.slot === slot).def
  C.useAbility(def, { origin: W.__still.pos, facing: 0, moveX: mx, moveZ: mz, pushed: false, full: C.weight, strain: 0 })
  return def
}`

check('K-EV1', RUN, async ({ page }) => {
  await evalJson(page, BRAWLER)
  const card = await evalJson(page, () => ({ title: document.querySelector('#pause h2')?.textContent, name: document.querySelector('#pause .pname')?.textContent, open: document.querySelector('#pause').classList.contains('show') }))
  assertEq('a Brawler with Scrap Cleaver III and Pressure Vent worn: the world waits on a card, "Scrap Cleaver evolves", the new name on it', card, { title: 'Scrap Cleaver evolves', name: 'Whirlwind', open: true })
  const r = await evalJson(page, ON)
  assertEq('...on: Whirlwind, rank III, evolved, the card gone', [r.arms.name, r.arms.evo, r.arms.rank, r.evolved, r.open], ['Whirlwind', 'whirlwind', 3, ['scrap-cleaver'], false])
  assert(await evalJson(page, () => document.querySelector('#hud .btn.evolved') !== null), 'the button keeps a bright rim')
})

check('K-EV2', RUN, async ({ page }) => {
  await evalJson(page, BRAWLER, true)
  const r = await evalJson(page, ON)
  assertEq('no partner worn (Ward torso, Ward head): no card, no evolution', [r.had, r.evolved, r.arms.evo], [false, [], null])
  // the floor card of a part that has an evolution says what it needs, from rank I
  const fit = await evalJson(page, () => {
    const W = window
    W.__dropAt('scrap-cleaver', W.__still.pos.x, W.__still.pos.z)
    W.__step(1.5)
    const el = document.querySelector('#offer .fit')
    return { text: el.textContent, shown: el.style.display !== 'none' }
  })
  assertEq('...the floor card says `evolves with: any blast`', fit, { text: 'evolves with: any blast', shown: true })
})

check('K-EV3', RUN, async ({ page }) => {
  await evalJson(page, BRAWLER)
  await evalJson(page, ON)
  const r = await evalJson(page, () => {
    const W = window
    W.__equip('ward', 'torso')
    W.__evolve()
    const arms = W.__hud.slots.find((s) => s.slot === 'arms').def
    return { torso: W.__hud.slots.find((s) => s.slot === 'torso').def.id, evolved: W.__evolved(), evo: arms.evo ?? null }
  })
  assertEq('the partner swapped out: Whirlwind stays', r, { torso: 'ward', evolved: ['scrap-cleaver'], evo: 'whirlwind' })
})

check('K-EV4', RUN, async ({ page }) => {
  await evalJson(page, BRAWLER)
  await evalJson(page, ON)
  const r = await evalJson(page, `() => {
    const W = window
    const C = W.__combat
    const e = W.__spawn('chaser', 0, -1.5, true)
    e.hp = 1e6
    const def = (${CAST})('arms', 0, 1)
    const hp0 = 1e6
    const pin = () => e.pos.set(0, 0, -1.5)
    for (let i = 0; i < 3; i++) { pin(); W.__step(1 / 60) }
    const first = hp0 - e.hp
    for (let i = 0; i < 60; i++) { pin(); W.__step(1 / 60) }
    return { dmg: def.damage, first, total: hp0 - e.hp, moved: Math.hypot(W.__still.pos.x, W.__still.pos.z) }
  }`)
  assert(r.first > 0, `Whirlwind: one hit at once on the body behind him: ${JSON.stringify(r)}`)
  assert(Math.abs(r.total - 2 * r.first) < 1e-6, `...and a second of the same size 0.12 s on: ${r.first} then ${r.total}`)
  assert(Math.abs(r.moved - 1.5) < 0.15, `...and he is carried about 1.5 u along the stick: ${r.moved}`)
})

check('K-EV5', RUN, async ({ page }) => {
  await evalJson(page, MARKSMAN)
  const r = await evalJson(page, ON)
  assertEq('a Marksman with Focusing Lens III and Skitter evolves into Rail', [r.head.name, r.head.evo, r.evolved], ['Rail', 'rail', ['focusing-lens']])
  const hit = await evalJson(page, `() => {
    const W = window
    const es = [3, 6, 9].map((z) => { const e = W.__spawn('chaser', 0, z, true); e.hp = 1e6; return e })
    ;(${CAST})('head', 0, 0)
    for (let i = 0; i < 40; i++) { es.forEach((e, k) => e.pos.set(0, 0, [3, 6, 9][k])); W.__step(1 / 60) }
    return es.map((e) => 1e6 - e.hp > 0)
  }`)
  assertEq('Rail pierces three bodies in a line', hit, [true, true, true])
})

check('K-EV6', RUN, async ({ page }) => {
  await evalJson(page, MARKSMAN)
  await evalJson(page, ON)
  const r = await evalJson(page, () => {
    const W = window
    const C = W.__combat
    const e = W.__spawn('chaser', 0, 7, true)
    e.hp = 1e6
    W.__fire('legs')
    let shots = 0
    let was = 0
    for (let i = 0; i < 90; i++) {
      e.pos.set(0, 0, 7)
      W.__step(1 / 60)
      const n = C.bolts.filter((b) => b.payer && b.payer.evo === 'rail').length
      if (n > 0 && was === 0) shots++
      was = n
    }
    return { shots, hit: 1e6 - e.hp > 0, head: C.parts ? true : true }
  })
  assertEq('after a Skitter hop a free Rail shot fires, once, and lands', [r.shots, r.hit], [1, true])
})

check('K-EV7', RUN, async ({ page }) => {
  const melt = (partner) => evalJson(page, `(partner) => {
    const W = window
    ;(${BRAWLER})(!partner)
    const press = (el) => el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    const b = document.querySelector('#pause .master')
    if (b) b.click()
    W.__run.mastery = new Set()
    W.__run.ranks.arms = 3
    W.__dropAt('scrap-cleaver', W.__still.pos.x, W.__still.pos.z)
    W.__step(1.5)
    const m = document.querySelector('#offer .melt')
    const label = m.textContent
    press(m)
    return { label, cards: document.querySelectorAll('#pause .master').length, open: document.querySelector('#pause').classList.contains('show'), mastery: W.__run.mastery.size, ground: W.__loot.ground.length }
  }`, partner)
  assertEq('an evolved part at III: the melt line is `already evolved` and a press opens nothing', await melt(true), { label: 'already evolved', cards: 0, open: false, mastery: 0, ground: 1 })
  assertEq('no evolution yet: `nothing more to learn yet`, no mastery', await melt(false), { label: 'nothing more to learn yet', cards: 0, open: false, mastery: 0, ground: 1 })
})

check('K-EV8', RUN, async ({ page }) => {
  const r = await evalJson(page, () => {
    const W = window
    W.__hold(true)
    W.__arena()
    W.__arch(null)
    W.__equipRank('scrap-cleaver', 3, 'arms')
    W.__evolve()
    W.__run.mastery = new Set()
    W.__run.ranks.arms = 3
    W.__dropAt('scrap-cleaver', W.__still.pos.x, W.__still.pos.z)
    W.__step(1.5)
    const m = document.querySelector('#offer .melt')
    const label = m.textContent
    m.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    return { label, cards: document.querySelectorAll('#pause .master').length, evolved: W.__evolved(), evo: W.__hud.slots.find((s) => s.slot === 'arms').def.evo ?? null, fit: document.querySelector('#offer .fit').style.display }
  })
  assertEq('no archetype: the mastery melt line and two mastery cards as today, no evolution, no evolves-with line', r, { label: 'melt: master the close strike', cards: 2, evolved: [], evo: null, fit: 'none' })
})

// real localStorage (no save=memory, no ?depth=): a snapshot with the evolution in it, reloaded, so the real resumeRun reads it
check('K-EV9', '?roads=1&line=0&engine=0&resume=1', async ({ page }) => {
  await evalJson(page, () => { window.__setSave({ runs: 3 }) })
  await evalJson(page, () => {
    const W = window
    const snap = { ...W.__snapshot(), depth: 2, seed: 7, bossFelled: false, bossLoot: [], loadout: ['ward', 'pressure-vent', 'scrap-cleaver', 'kickstart'], route: null, archetype: 'brawler', ranks: { arms: 3 }, evolved: ['scrap-cleaver'] }
    delete snap.core; delete snap.keystone; delete snap.upgrades; delete snap.picks; delete snap.crossroads
    W.__setSave({ run: snap })
  })
  await page.reload()
  await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
  await page.waitForTimeout(300)
  const r = await evalJson(page, () => {
    const W = window
    const arms = W.__hud.slots.find((s) => s.slot === 'arms').def
    return { name: arms.name, evo: arms.evo ?? null, evolved: W.__evolved(), open: document.querySelector('#pause').classList.contains('show'), snap: W.__snapshot().evolved ?? null }
  })
  assertEq('an evolved part survives a save and a resume (no card again), and the snapshot writes it back', r, { name: 'Whirlwind', evo: 'whirlwind', evolved: ['scrap-cleaver'], open: false, snap: ['scrap-cleaver'] })
})

process.exit(await run(process.argv.slice(2)))
