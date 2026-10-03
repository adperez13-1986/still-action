/**
 * A1 (design/archetypes/A1.md): the archetype pick's rules, the slot law and the two traits. With none picked the game is today's
 * (`node tools/checks/fights.mjs compare` says so, K-AR7 here says it for a loadout and the autos).
 * `node tools/checks/arch.mjs [K-AR2 ...]`.
 */
import { assert, assertEq, assertClose, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, run } = suite()

/** In the page: what each button wears, as `slot:id@wornSlot`, and the autos. */
const STATE = `() => {
  const W = window
  return {
    worn: W.__hud.slots.map((s) => s.def ? s.slot + ':' + s.def.id + '@' + s.def.slot : s.slot + ':-'),
    hand: W.__combat.closeHand, eye: W.__combat.eye, arch: W.__run.archetype, core: W.__run.core, hardened: W.__combat.hardened,
  }
}`

check('K-AR1', RUN, async ({ page }) => {
  const r = await evalJson(page, () => {
    const A = window.__archetypes
    const fams = ['strike', 'bolt', 'blast', 'guard', 'move', 'summon']
    return {
      missing: window.__parts.filter((p) => !A.FAMILY[p.id]).map((p) => p.id),
      bad: Object.entries(A.FAMILY).filter(([, f]) => !fams.includes(f)).map(([id]) => id),
      extra: Object.keys(A.FAMILY).filter((id) => !window.__parts.some((p) => p.id === id)),
      // every kit part sits in a slot its own archetype's law accepts
      kit: ['brawler', 'marksman'].flatMap((a) => Object.entries(A.KIT[a]).filter(([slot, id]) => !A.LAW[a][slot].includes(A.FAMILY[id])).map(([slot, id]) => a + ':' + slot + ':' + id)),
    }
  })
  assertEq('every part has a family, no stray ids, every family is one of the six, and each kit part fits its own law', r, { missing: [], bad: [], extra: [], kit: [] })
})

check('K-AR2', RUN, async ({ page }) => {
  await evalJson(page, () => { window.__arch('brawler') })
  const s = await evalJson(page, STATE)
  assertEq('Brawler boots with its kit, each part on its own slot', s.worn, ['head:ward@head', 'torso:pressure-vent@torso', 'arms:scrap-cleaver@arms', 'legs:kickstart@legs'].map((x) => x))
  assertEq('...the hand only, no eye, no core, Hardened set', [s.hand, s.eye, s.arch, s.core, s.hardened], [true, false, 'brawler', null, 0.15])
})

check('K-AR3', RUN, async ({ page }) => {
  await evalJson(page, () => { window.__arch('marksman') })
  const s = await evalJson(page, STATE)
  assertEq('Marksman boots with its kit: a lens in the head, Flare in the arms (off its own slot), Skitter, Ward', s.worn, ['head:focusing-lens@head', 'torso:ward@torso', 'arms:flare@arms', 'legs:skitter@legs'])
  assertEq('...the eye only, no hand, no core, no Hardened', [s.hand, s.eye, s.arch, s.core, s.hardened], [false, true, 'marksman', null, 0])
})

check('K-AR4', RUN, async ({ page }) => {
  await evalJson(page, () => { const W = window; W.__hold(true); W.__arena(); W.__arch('marksman') })
  // a lens on the floor under him: the card offers head and arms, and the arms take lands it there, the head keeping its lens
  const offer = await evalJson(page, () => {
    const W = window
    W.__dropAt('ricochet-lens', W.__still.pos.x, W.__still.pos.z)
    W.__step(1.5)
    const el = document.querySelector('#offer')
    return {
      shown: el.classList.contains('show'), name: el.querySelector('.name').textContent, slot: el.querySelector('.slot').textContent,
      buttons: [...el.querySelectorAll('.take')].filter((b) => b.style.display !== 'none').map((b) => b.textContent),
      replaces: el.querySelector('.replaces').textContent, target: document.querySelectorAll('#hud .target').length,
    }
  })
  assertEq('the take card offers both slots, head and arms, naming what each replaces', [offer.shown, offer.slot, offer.buttons, offer.target], [true, 'Head / Arms', ['H', 'A'], 2])
  assert(offer.replaces.includes('Head: replaces Focusing Lens') && offer.replaces.includes('Arms: replaces Flare'), `the card names both swaps: ${offer.replaces}`)
  const took = await evalJson(page, () => {
    const W = window
    const ok = W.__take('arms')
    return { ok, worn: W.__hud.slots.map((s) => s.def ? s.slot + ':' + s.def.id + '@' + s.def.slot : s.slot + ':-') }
  })
  assertEq('taking into arms: the arms hold Ricochet, the head keeps its lens, and the old Flare is on the floor', [took.ok, took.worn], [true, ['head:focusing-lens@head', 'torso:ward@torso', 'arms:ricochet-lens@arms', 'legs:skitter@legs']])
  // and it fires from the arms button: a body in front takes a bolt
  const shot = await evalJson(page, () => {
    const W = window
    const C = W.__combat
    C.eye = false
    W.__stick(0, 0)
    const e = W.__spawn('chaser', W.__still.pos.x, W.__still.pos.z - 5, false)
    const before = e.hp
    const r = W.__fire('arms')
    W.__step(1)
    return { before, after: e.hp, dead: e.dead, bolts: C.bolts.length, ready: W.__hud.isReady('arms') }
  })
  assert(shot.after < shot.before || shot.dead, `the arms button's lens hit the body: ${JSON.stringify(shot)}`)
  assertEq('...and the arms button went on cooldown', shot.ready, false)
})

check('K-AR5', RUN, async ({ page }) => {
  const r = await evalJson(page, () => {
    const W = window
    W.__arch('brawler')
    const A = W.__archetypes
    const seen = {}
    for (const source of ['kill', 'elite', 'plenty', 'boss-blue', 'boss-gold']) {
      for (let i = 0; i < 300; i++) {
        const d = W.__lootRules.rollPart('chaser', [], source)
        if (d) seen[A.FAMILY[d.id]] = (seen[A.FAMILY[d.id]] ?? 0) + 1
      }
    }
    W.__arch('marksman')
    const m = {}
    for (let i = 0; i < 300; i++) {
      const d = W.__lootRules.rollPart('chaser', [], 'kill')
      if (d) m[A.FAMILY[d.id]] = (m[A.FAMILY[d.id]] ?? 0) + 1
    }
    W.__arch(null)
    const none = {}
    for (let i = 0; i < 300; i++) {
      const d = W.__lootRules.rollPart('chaser', [], 'kill')
      if (d) none[A.FAMILY[d.id]] = (none[A.FAMILY[d.id]] ?? 0) + 1
    }
    return { brawler: Object.keys(seen).sort(), marksman: Object.keys(m).sort(), none: Object.keys(none).sort() }
  })
  assert(!r.brawler.includes('bolt') && !r.brawler.includes('summon'), `a Brawler is never offered a bolt or a summon: ${r.brawler}`)
  assert(r.brawler.includes('strike') && r.brawler.includes('blast'), `...and still sees strikes and blasts: ${r.brawler}`)
  assert(!r.marksman.includes('summon'), `a Marksman is never offered a summon: ${r.marksman}`)
  assert(r.none.includes('bolt'), `with no archetype the pool is today's, bolts and all: ${r.none}`)
})

check('K-AR6', RUN, async ({ page }) => {
  const hit = (arch) => evalJson(page, (a) => {
    const W = window
    W.__arch(a)
    W.__hold(true)
    W.__arena()
    const C = W.__combat
    C.hp = 100
    C.hurtPlayer(10, 'melee')
    const hp = C.hp
    W.__step(0.1)
    const speed = W.__still.speed
    const legs = W.__hud.slots.find((s) => s.slot === 'legs').def
    return { hp, speed, legCd: legs ? legs.cooldownMs : null }
  }, arch)
  const none = await hit(null)
  const brawler = await hit('brawler')
  const marksman = await hit('marksman')
  assertEq('no archetype: a 10 hit costs 10', none.hp, 90)
  assertClose('Hardened: the Brawler takes 8.5 of a 10 hit', brawler.hp, 91.5, 1e-6)
  assertClose('Footwork: the Marksman walks at 1.1 x', marksman.speed / none.speed, 1.1, 1e-6)
  assertClose('...and the Brawler at 1 x', brawler.speed / none.speed, 1, 1e-6)
  const skitter = await evalJson(page, () => window.__parts.find((p) => p.id === 'skitter').cooldownMs)
  const kick = await evalJson(page, () => window.__parts.find((p) => p.id === 'kickstart').cooldownMs)
  assertEq("Footwork: Skitter's cooldown is x0.75 for the Marksman, Kickstart is untouched for the Brawler", [marksman.legCd, brawler.legCd], [Math.round(skitter * 0.75), kick])
})

check('K-AR7', RUN, async ({ page }) => {
  await evalJson(page, () => { window.__arch('marksman'); window.__arch(null) })
  const s = await evalJson(page, STATE)
  assertEq('with no archetype the autos are today\'s: hand and eye, no Hardened', [s.arch, s.hand, s.eye, s.hardened], [null, true, true, 0])
  // an old snapshot (no archetype key) resumes as today's game: the loadout stays slot-true, both autos, no archetype
  const r = await evalJson(page, () => {
    const snap = window.__snapshot()
    return { has: snap ? 'archetype' in snap : null }
  })
  assert(r.has !== true, 'a run with no archetype writes no archetype key')
  // a drop with no archetype: a bolt is offered into its own slot only, one take button
  await evalJson(page, () => { const W = window; W.__hold(true); W.__arena(); W.__dropAt('ricochet-lens', W.__still.pos.x, W.__still.pos.z); W.__step(1.5) })
  const offer = await evalJson(page, () => {
    const el = document.querySelector('#offer')
    return { slot: el.querySelector('.slot').textContent, buttons: [...el.querySelectorAll('.take')].filter((b) => b.style.display !== 'none').length }
  })
  assertEq('no archetype: the card is the plain head card with one take button', [offer.slot, offer.buttons], ['Head', 1])
})

// real localStorage (no save=memory, no ?depth=): each case writes a depth-2 snapshot and reloads, so the real resumeRun reads it
const resume = async (page, patch) => {
  await evalJson(page, (patch) => {
    const W = window
    const snap = { ...W.__snapshot(), depth: 2, seed: 7, bossFelled: false, bossLoot: [], loadout: ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'], route: null, ...patch }
    delete snap.core; delete snap.keystone; delete snap.upgrades; delete snap.ranks; delete snap.picks; delete snap.crossroads
    if (patch.archetype === undefined) delete snap.archetype
    W.__setSave({ run: snap })
  }, patch)
  await page.reload()
  await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
  await page.waitForTimeout(300)
  const st = await evalJson(page, STATE)
  return { ...st, ...(await evalJson(page, () => ({ open: document.querySelector('#pause').classList.contains('show'), snap: window.__snapshot().archetype ?? null }))) }
}
check('K-AR7', '?roads=1&line=0&engine=0&resume=1', async ({ page }) => {
  await evalJson(page, () => { window.__setSave({ runs: 3 }) })
  const old = await resume(page, {})
  assertEq("an old save (no archetype) resumes as today's game: its parts on their own slots, both autos, no pick, no archetype written back", [old.worn, old.hand, old.eye, old.arch, old.open, old.snap],
    [['head:focusing-lens@head', 'torso:pressure-vent@torso', 'arms:scrap-cleaver@arms', 'legs:kickstart@legs'], true, true, null, false, null])
  const m = await resume(page, { archetype: 'marksman', loadout: ['focusing-lens', 'ward', 'ricochet-lens', 'skitter'] })
  assertEq('a Marksman snapshot resumes with a lens in the arms (off its own slot), the eye only, Hardened off, and writes the archetype back', [m.worn, m.hand, m.eye, m.arch, m.open, m.snap],
    [['head:focusing-lens@head', 'torso:ward@torso', 'arms:ricochet-lens@arms', 'legs:skitter@legs'], false, true, 'marksman', false, 'marksman'])
  // a part the law does not accept in its slot is dropped (a Brawler's legs may not hold a lens)
  const b = await resume(page, { archetype: 'brawler', loadout: ['ward', 'pressure-vent', 'scrap-cleaver', 'focusing-lens'] })
  assertEq('a Brawler snapshot with a lens in the legs resumes with that slot empty; the hand only, Hardened', [b.worn, b.hand, b.eye, b.arch, b.hardened], [['head:ward@head', 'torso:pressure-vent@torso', 'arms:scrap-cleaver@arms', 'legs:-'], true, false, 'brawler', 0.15])
})

process.exit(await run(process.argv.slice(2)))
