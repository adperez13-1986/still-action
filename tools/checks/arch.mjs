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
      extra: Object.keys(A.FAMILY).filter((id) => ![...window.__parts, ...window.__archParts].some((p) => p.id === id)),
      // every kit part sits in a slot its own archetype's law accepts
      kit: ['brawler', 'marksman', 'summoner'].flatMap((a) => Object.entries(A.KIT[a]).filter(([slot, id]) => !A.LAW[a][slot].includes(A.FAMILY[id])).map(([slot, id]) => a + ':' + slot + ':' + id)),
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
  assertEq('the take card offers both slots, head and arms, naming what each replaces', [offer.shown, offer.slot, offer.buttons, offer.target], [true, 'Head / Arms', ['head', 'arms'], 2])
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

/** In the page: a Summoner on the arena with the autos on, Still at the origin. */
const SUMMONER = `;(() => {
  const W = window
  W.__hold(true)
  W.__arena({ auto: true })
  W.__arch('summoner')
  W.__combat.hp = 1e6
  W.__combat.autoAttack = true
})()`

const CAST = `(slot) => {
  const W = window
  const C = W.__combat
  const def = W.__hud.slots.find((s) => s.slot === slot).def
  C.useAbility(def, { origin: W.__still.pos, facing: 0, moveX: 0, moveZ: 0, pushed: false, full: C.weight, strain: 0 })
}`

check('K-AR8', RUN, async ({ page }) => {
  await evalJson(page, () => { window.__arch('summoner') })
  const s = await evalJson(page, STATE)
  assertEq('Summoner boots with its kit: a lens, Lure, Turret in the arms, Kickstart', s.worn, ['head:focusing-lens@head', 'torso:lure@torso', 'arms:turret@arms', 'legs:kickstart@legs'])
  assertEq('...no hand, no eye, no core, no Hardened', [s.hand, s.eye, s.arch, s.core, s.hardened], [false, false, 'summoner', null, 0])
  const d = await evalJson(page, `() => { ${SUMMONER}; window.__step(0.5); const C = window.__combat; return { drone: !!C.parts.drone, flag: C.drone, crowd: C.crowd } }`)
  assertEq('...the drone is out and Crowd is 3 u', [d.drone, d.flag, d.crowd], [true, true, 3])
  const gone = await evalJson(page, () => { window.__arch('marksman'); window.__step(0.2); const C = window.__combat; return [!!C.parts.drone, C.drone, C.crowd] })
  assertEq('another archetype hides the drone and turns Crowd off', gone, [false, false, 0])
  const none = await evalJson(page, () => { window.__arch(null); window.__step(0.2); const C = window.__combat; return [!!C.parts.drone, C.drone, C.crowd] })
  assertEq('no archetype: no drone, no Crowd', none, [false, false, 0])
})

check('K-AR9', RUN, async ({ page }) => {
  // an enemy pinned at `dist` from the drone (never walking, never hurt to death): how much the drone's pecks took in 2.5 s
  const peck = (dist) => evalJson(page, `(dist) => {
    ${SUMMONER}
    const W = window
    const C = W.__combat
    W.__step(1.5)
    const d = C.parts.drone.pos
    const e = W.__spawn('chaser', d.x, d.z + dist, true)
    e.hp = 1e6
    const hp0 = e.hp
    for (let i = 0; i < 150; i++) { e.pos.set(d.x, 0, d.z + dist); C.parts.drone.pos.copy(d); W.__step(1 / 60) }
    return { hit: hp0 - e.hp, hover: Math.hypot(d.x - W.__still.pos.x, d.z - W.__still.pos.z) }
  }`, dist)
  const near = await peck(4.2)
  const far = await peck(5.0)
  assert(near.hit > 0 && Math.abs(near.hit / 5.6 - Math.round(near.hit / 5.6)) < 1e-6, `a body 4.2 u from the drone is pecked, in whole hits of 0.7 x the eye's 8 (5.6): ${near.hit}`)
  assertEq('a body 5.0 u from the drone is not pecked', far.hit, 0)
  assert(near.hover > 1 && near.hover < 1.6, `the drone hovers about 1.3 u from Still: ${near.hover}`)
})

check('K-AR10', RUN, async ({ page }) => {
  const r = await evalJson(page, `() => {
    ${SUMMONER}
    const W = window
    const C = W.__combat
    const cast = ${CAST}
    cast('arms')
    const t1 = C.parts.turret
    const out = { dropped: !!t1, hp: t1.hp, life: t1.t }
    // it shoots: a body pinned 5 u off, 2 s
    const e = W.__spawn('chaser', 0, 5, true)
    e.hp = 1e6
    const hp0 = e.hp
    for (let i = 0; i < 120; i++) { e.pos.set(0, 0, 5); W.__step(1 / 60) }
    out.fired = hp0 - e.hp
    out.dealt = C.turretDealt
    // a recast moves it: still one, a new place
    W.__still.pos.set(3, 0, 0)
    cast('arms')
    out.moved = C.parts.turret !== t1 && Math.hypot(C.parts.turret.pos.x - 3, C.parts.turret.pos.z) < 0.01
    // 30 damage from enemies and it pops
    C.hurtTurret(29)
    out.at29 = !!C.parts.turret
    C.hurtTurret(1)
    out.at30 = !!C.parts.turret
    // 6 s and it expires
    cast('arms')
    const mark = C.parts.turret
    e.hp = 0
    for (let i = 0; i < 60 * 5.8; i++) W.__step(1 / 60)
    out.at58 = C.parts.turret === mark
    for (let i = 0; i < 60 * 0.4; i++) W.__step(1 / 60)
    out.at62 = !!C.parts.turret
    return out
  }`)
  assertEq('a cast drops one turret with its 30 hit points and 6 s', [r.dropped, r.hp, r.life], [true, 30, 6])
  assert(r.fired > 0 && r.fired === r.dealt, `it shoots the nearest body, at 5 u (the weight trial scales its 4): ${r.fired} (counted ${r.dealt})`)
  assertEq('a recast moves it (the old one pops, one stands)', r.moved, true)
  assertEq('29 damage leaves it standing, 30 takes it', [r.at29, r.at30], [true, false])
  assertEq('it stands at 5.8 s and is gone by 6.2 s', [r.at58, r.at62], [true, false])
})

check('K-AR11', RUN, async ({ page }) => {
  const r = await evalJson(page, `() => {
    ${SUMMONER}
    const W = window
    const C = W.__combat
    ${CAST.replace('(slot) => {', 'const cast = (slot) => {')}
    cast('arms')
    const t = C.parts.turret
    const near = W.__spawn('chaser', t.pos.x + 2, t.pos.z, true)
    const far = W.__spawn('chaser', t.pos.x + 4, t.pos.z, true)
    const p = W.__still.pos
    const out = { near: C.targetFor(near, p) === t.pos, far: C.targetFor(far, p) === p }
    // Crowd is the Summoner's: without it a turret (however it got there) draws no one
    C.crowd = 0
    out.off = C.targetFor(near, p) === p
    C.crowd = 3
    // a real fight: Still walks off, a hulk beside the turret swings at it
    const e = W.__spawn('chaser', t.pos.x + 1, t.pos.z, true)
    e.hp = 1e6
    far.hp = near.hp = 1e6
    W.__still.pos.set(14, 0, 0)
    for (let i = 0; i < 60 * 3 && C.parts.turret; i++) W.__step(1 / 60)
    out.hurt = !C.parts.turret || C.parts.turret.hp < 30
    return out
  }`)
  assertEq('Crowd: an enemy 2 u from a turret targets it, one 4 u away targets Still', [r.near, r.far], [true, true])
  assertEq('...and without Crowd the turret draws no one', r.off, true)
  assertEq('...and enemies at the turret hurt it', r.hurt, true)
})

check('K-AR12', RUN, async ({ page }) => {
  const r = await evalJson(page, () => {
    const W = window
    const A = W.__archetypes
    const seen = {}
    for (const a of [null, 'brawler', 'marksman', 'summoner']) {
      W.__arch(a)
      for (let i = 0; i < 400; i++) {
        for (const src of ['kill', 'crate', 'elite', 'plenty', 'boss-blue', 'boss-gold']) {
          const d = W.__lootRules.rollPart('chaser', [], src)
          if (d?.id === 'turret') seen[a] = (seen[a] ?? 0) + 1
        }
      }
    }
    W.__arch(null)
    return {
      seen, inPool: W.__parts.some((p) => p.id === 'turret'),
      brawler: A.slotsFor('brawler', 'turret').length, marksman: A.slotsFor('marksman', 'turret').length, summoner: A.slotsFor('summoner', 'turret'),
    }
  })
  assertEq('the Turret is in no pool, is never rolled for anyone, and the Brawler and Marksman have no slot for it', [r.seen, r.inPool, r.brawler, r.marksman], [{}, false, 0, 0])
  assertEq('...and the Summoner may wear it where the law lets a summon sit (head, torso, arms)', r.summoner, ['head', 'torso', 'arms'])
})

/** The Summoner bot: eager, Still at the origin with his HP put back each tick, to the clear or 60 s. Reports cleared, HP lost and the damage split. */
const BOT = `(scenario) => {
  const W = window
  ${SUMMONER}
  const C = W.__combat
  C.packHpMul = 1.4
  C.heavyHpMul = 1
  let parts = 0
  const was = C.events.onPartDamage
  C.events.onPartDamage = (d) => { parts += d; was?.(d) }
  const st = W.__run.stats[W.__run.stats.length - 1]
  if (scenario === 'packs') {
    W.__spawn('chaser', 0, 3.5, true); W.__spawn('chaser', 3, -2, true); W.__spawn('ranged', -5, 5, true); W.__spawn('chaser', -3, -3, true)
  } else W.__spawn('boss', 0, 7, true)
  let lost = 0, cleared = false, i = 0
  for (; i < 60 * 60; i++) {
    for (const slot of ['head', 'torso', 'arms', 'legs']) if (W.__hud.isReady(slot)) W.__fire(slot)
    C.hp = 100
    W.__still.pos.set(0, 0, 0)
    W.__step(1 / 60)
    lost += 100 - C.hp
    if (C.enemies.every((e) => e.dead)) { cleared = true; break }
  }
  const drone = st.autoDmgReal?.drone ?? 0
  const turret = C.turretDealt
  const other = Math.max(0, parts - turret)
  const all = drone + parts || 1
  return { cleared, s: +(i / 60).toFixed(1), lost: Math.round(lost), drone: Math.round(drone), turret: Math.round(turret), parts: Math.round(other), share: [drone, turret, other].map((x) => Math.round((100 * x) / all)) }
}`

check('K-AR-BOT', RUN, async ({ page }) => {
  for (const sc of ['packs', 'assembler']) {
    const r = await evalJson(page, BOT, sc)
    console.log(`INFO K-AR-BOT: Summoner bot on ${sc}: cleared ${r.cleared} in ${r.s} s, HP lost ${r.lost}, damage drone ${r.drone} / turret ${r.turret} / parts ${r.parts} (share ${r.share.join(' / ')} %)`)
  }
})

process.exit(await run(process.argv.slice(2)))
