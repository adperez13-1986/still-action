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
import { readFileSync } from 'node:fs'
import { REPO, assert, evalJson, suite } from './lib.mjs'

const ARENA = '?depth=1&save=memory'
const LINE = '?depth=1&save=memory&line=1'
const ON = '?depth=1&save=memory&roads=1'
const OFF = '?depth=1&save=memory'

const { check, run } = suite()

/**
 * The in-page toolkit every check body starts with (it is source, spliced in front of the body by `inPage`).
 * `begin(seed, part)`: a clean arena, Still at the origin wearing the Scrap Cleaver, or `part` on his arms; pressure on,
 * counters, the break rule and the autos OFF; Math.random seeded (the loadout is pinned BEFORE the seed, as fights.mjs does,
 * because still.wear draws Math.random by what it takes off). Returns the function that gives Math.random back.
 * `tick(n, before)`: n ticks of 1/60 s with Still's HP put back to 100 before each; returns the HP he lost.
 * `until(pred, maxS)`: seconds ticked until pred() (checked before each tick), or -1.
 */
const HELPERS = `
const W = window, C = W.__combat
const mulberry32 = (a) => () => {
  a |= 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const begin = (seed, part) => {
  W.__hold(true)
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  for (const slot of SLOTS) C.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  W.__equip('scrap-cleaver')
  const original = Math.random
  Math.random = mulberry32(seed)
  W.__arena()
  C.time = 0
  C.pressure = true
  C.counters = false
  C.breakRule = false
  C.autoAttack = false
  C.autoTimer = 0 // private, and reset() leaves it: a fight cut short mid-beat would hand the next one a delayed first strike
  C.mastery = new Set() // the hand and the eye learn in a fight (combat.masterHit) and reset() leaves it: an earlier fight's must not carry over
  W.__stick(0, 0)
  if (part) W.__equip(part)
  return () => { Math.random = original }
}
const tick = (n = 1, before) => {
  let lost = 0
  for (let i = 0; i < n; i++) {
    C.hp = 100
    if (before) before()
    W.__step(1 / 60)
    lost += 100 - C.hp
  }
  return lost
}
const until = (pred, maxS, before) => {
  const n = Math.round(maxS * 60)
  for (let i = 0; i <= n; i++) {
    if (pred()) return i / 60
    if (i < n) tick(1, before)
  }
  return -1
}
const stat = () => W.__run.stats[W.__run.stats.length - 1]
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const tellEvents = () => W.__partLog.filter((ev) => ev.kind === 'interrupt' && ev.tell === true)
`

/** Run `body` (async function source's body, with the HELPERS in front and `arg` in scope) in the page; what it returns, as JSON. */
const inPage = (page, body, arg) =>
  evalJson(page, { toString: () => `async (arg) => { ${HELPERS}\n${body}\n}` }, arg)

// --- Whole game (B1): R3, Parry Clamp catches any tell -----------------------------------------------------------------
const bad = (got) => { if (got.bad) throw new Error(got.bad) }

check('K-W3a', ARENA, async ({ page }) => {
  // the hulk: a pressure hulk at (0, 1.6), Parry Clamp, the autos off
  const hulk = await inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      const e = W.__spawn('chaser', 0, 1.6, true)
      if (until(() => e.tellIn() !== null, 3) < 0) return { bad: 'the hulk never cocked in 3 s' }
      const at = { x: e.pos.x, z: e.pos.z }, st = stat(), c0 = st.catches.hulk, b0 = st.lunges.broken
      W.__partLog.length = 0
      W.__fire('arms')
      const now = { tellIn: e.tellIn(), phase: e.phase, tellEvents: tellEvents().length }
      const lost = tick(18)
      const moved = dist(e.pos, at)
      const cockAfter = 18 / 60 + until(() => e.tellIn() !== null, 4, () => {})
      return { ...now, lost, moved, cockAfter, catches: stat().catches.hulk - c0, broken: stat().lunges.broken - b0 }
    } finally { end() }`)
  bad(hulk)
  assert(hulk.tellIn === null, `the hulk's tellIn is ${hulk.tellIn} after the cast, not null`)
  assert(hulk.phase === 'recover', `the caught hulk is in ${hulk.phase}, not recover`)
  assert(hulk.moved >= 2.0, `the caught hulk moved ${hulk.moved.toFixed(2)} u, under 2.0`)
  assert(hulk.lost === 0, `Still lost ${hulk.lost} HP to the hulk in 300 ms after the catch`)
  assert(hulk.cockAfter >= 0.55, `the caught hulk cocked again after ${hulk.cockAfter.toFixed(3)} s, under 0.55`)
  assert(hulk.tellEvents === 1, `${hulk.tellEvents} interrupt events with tell: true, not 1`)
  assert(hulk.catches === 1 && hulk.broken === 0, `stats: catches.hulk +${hulk.catches}, lunges.broken +${hulk.broken} (want +1, +0)`)
  console.log(`INFO K-W3a: hulk caught: moved ${hulk.moved.toFixed(2)} u, cocked again ${hulk.cockAfter.toFixed(3)} s later, autos off`)

  // the sentinel: pinned at (0, 2.0) (it would back away out of reach of the snap before its glow began)
  const sent = await inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      const e = W.__spawn('ranged', 0, 2.0, true)
      const pin = () => e.pos.set(0, 0, 2.0)
      if (until(() => e.tellIn() !== null, 12, pin) < 0) return { bad: 'the sentinel never glowed in 12 s' }
      let shots = 0
      const fire = C.fireShot
      C.fireShot = function (...a) { shots++; return fire.apply(this, a) }
      try {
        W.__fire('arms')
        const now = { tellIn: e.tellIn(), reload: e.reload }
        tick(24, pin)
        return { ...now, shots }
      } finally { delete C.fireShot }
    } finally { end() }`)
  bad(sent)
  assert(sent.tellIn === null, `the sentinel's tellIn is ${sent.tellIn} after the cast`)
  assert(sent.shots === 0, `the caught sentinel fired ${sent.shots} shot(s) in 400 ms`)
  assert(sent.reload >= 1250, `the caught sentinel's reload is ${sent.reload}, under 1250`)

  // the mite: a pressure brood of 6 round (0, 1.8)
  const mite = await inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      const members = Array.from({ length: 6 }, (_, k) => ({ kind: 'swarm', x: Math.sin(k * Math.PI / 3) * 1.8, z: Math.cos(k * Math.PI / 3) * 1.8 }))
      W.__pack(members, true)
      const mites = C.enemies.filter((e) => e.kind === 'swarm')
      let caught = null
      if (until(() => { caught = mites.find((m) => m.tellIn() !== null) ?? null; return caught !== null }, 8) < 0) return { bad: 'no mite reared in 8 s' }
      const m = caught
      m.hp = 100 // Parry's own hit (10) kills a depth-1 mite (8 hp), and a dead body is not caught: the check wants the catch
      W.__fire('arms')
      const now = { tellIn: m.tellIn(), rest: m.rest, nip: m.nip }
      tick(18)
      return { ...now, phase: m.phase, nipAfter: m.nip, tellEvents: tellEvents().length }
    } finally { end() }`)
  bad(mite)
  assert(mite.tellIn === null && mite.nip === -1, `the caught mite still rears (tellIn ${mite.tellIn}, nip ${mite.nip})`)
  assert(mite.rest >= 1900, `the caught mite's rest is ${mite.rest}, under 1900`)
  assert(mite.phase !== 'strike' && mite.nipAfter === -1, `the caught mite went on to nip (phase ${mite.phase}, nip ${mite.nipAfter}) within 300 ms`)
  assert(mite.tellEvents === 1, `${mite.tellEvents} tell interrupts for the mite, not 1`)

  // pushed: the button must be cooling for a push to be one (hud.fireSlot: `pushed && !ready`), so a whiff comes first
  const pushed = await inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      C.breakRule = true
      W.__fire('arms')
      const e = W.__spawn('chaser', 0, 1.6, true)
      const t = until(() => e.tellIn() !== null, 3)
      if (t < 0) return { bad: 'the hulk never cocked in 3 s' }
      W.__partLog.length = 0
      W.__fire('arms', true)
      const ev = W.__partLog.find((x) => x.kind === 'interrupt')
      const now = { phase: e.phase, push: ev?.push === true, tell: ev?.tell === true, t }
      const h0 = e.hp
      e.hit(10)
      return { ...now, hpLost: h0 - e.hp }
    } finally { end() }`)
  bad(pushed)
  assert(pushed.push && pushed.tell, `the pushed catch's event: push ${pushed.push}, tell ${pushed.tell}`)
  assert(pushed.phase === 'recover', `the pushed hulk is in ${pushed.phase}, not recover`)
  assert(Math.abs(pushed.hpLost - 15) < 1e-9, `a hit of 10 on the reeling hulk took ${pushed.hpLost}, not 15 (REEL x1.5)`)

  // a plain part is not a catch: Frayed Cleaver into the same cock
  const cleaver = await inPage(page, `
    const end = begin(1, 'frayed-cleaver')
    try {
      const e = W.__spawn('chaser', 0, 1.6, true)
      if (until(() => e.tellIn() !== null, 3) < 0) return { bad: 'the hulk never cocked in 3 s' }
      W.__partLog.length = 0
      W.__fire('arms')
      const stillCocking = e.tellIn() !== null
      const s = until(() => e.phase === 'strike', 0.6)
      return { stillCocking, struck: s >= 0, interrupts: W.__partLog.filter((x) => x.kind === 'interrupt').length }
    } finally { end() }`)
  bad(cleaver)
  assert(cleaver.stillCocking && cleaver.struck && cleaver.interrupts === 0, `Frayed Cleaver caught it: ${JSON.stringify(cleaver)}`)
})

check('K-W3b', ARENA, async ({ page }) => {
  const got = await inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      const a = W.__spawn('chaser', 0, 1.6, true)
      if (until(() => a.tellIn() !== null, 3) < 0) return { bad: 'hulk A never cocked in 3 s' }
      const b = W.__spawn('chaser', 0, -1.4, true)
      const hpB = b.hp, hpA = a.hp
      W.__partLog.length = 0
      W.__fire('arms')
      return { aHit: hpA - a.hp, aCaught: a.tellIn() === null && a.phase === 'recover', bHit: hpB - b.hp, bPhase: b.phase }
    } finally { end() }`)
  bad(got)
  assert(got.aHit > 0 && got.aCaught, `A (cocking) was not hit and caught: ${JSON.stringify(got)}`)
  assert(got.bHit === 0, `B (nearer, not cocking) lost ${got.bHit} HP: the snap went to the nearest body, not the tell`)
})

check('K-W3c', ARENA, async ({ page }) => {
  const once = (grace) => inPage(page, `
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryGrace(arg)
      const e = W.__spawn('chaser', 0, 1.6, true)
      if (until(() => e.tellIn() !== null, 3) < 0) return { bad: 'the hulk never cocked in 3 s' }
      if (until(() => e.tellIn() === null, 1) < 0) return { bad: 'its tell never ended' }
      tick(1)
      const before = e.phase, hp = e.hp
      W.__partLog.length = 0
      W.__fire('arms')
      return { before, after: e.phase, hit: hp - e.hp, caught: tellEvents().length, grace: W.__parryGrace() }
    } finally { W.__parryGrace(0); end() }`, grace)
  const off = await once(0)
  bad(off)
  assert(off.grace === 0, `__parryGrace() returns ${off.grace} at rest, not 0`)
  assert(off.hit > 0 && off.caught === 0 && off.before === off.after, `grace 0: one tick after the tell it was ${JSON.stringify(off)}, want hit, not caught, phase unchanged`)
  const on = await once(150)
  bad(on)
  assert(on.caught === 1 && on.after === 'recover', `grace 150: one tick after the tell it was ${JSON.stringify(on)}, want caught`)
  const back = await inPage(page, `return W.__parryGrace()`)
  assert(back === 0, `__parryGrace ends at ${back}, not 0`)
  const n = (readFileSync(REPO + 'src/combat.ts', 'utf8').match(/graceMs: 0/g) ?? []).length
  assert(n === 1, `grep -c "graceMs: 0" src/combat.ts is ${n}, not 1`)
})

check('K-W3d', ARENA, async ({ page }) => {
  // one fight: three pressure hulks at r 3-5 (seeded), the bot casts its arms whenever ready and a hulk is within 3.0 u; 60 s cap (autos on) or `cap` s (off)
  const fights = (part, auto, cap, o = {}) => inPage(page, `
    const out = []
    for (let seed = 1; seed <= 40; seed++) {
      const end = begin(seed, arg.part)
      try {
        W.__parryGrace(arg.grace ?? 0)
        C.autoAttack = arg.auto
        const hulks = Array.from({ length: 3 }, () => { const r = 3 + Math.random() * 2, a = Math.random() * Math.PI * 2; return W.__spawn('chaser', Math.sin(a) * r, Math.cos(a) * r, true) })
        const c0 = stat().catches.hulk
        const was = hulks.map(() => false)
        let cocks = 0, lost = 0, clear = -1
        for (let i = 1; i <= arg.cap * 60; i++) {
          // ready AND a body within 3.0 u of him: a cast into an empty arena is not a player's, and would spend Parry's 3.6 s at t = 0
          if (arg.everyTick || hulks.some((h) => !h.dead && dist(h.pos, W.__still.pos) <= 3.0)) W.__fire('arms')
          lost += tick(1)
          hulks.forEach((h, k) => { const on = !h.dead && h.tellIn() !== null; if (on && !was[k]) cocks++; was[k] = on })
          if (clear < 0 && hulks.every((h) => h.dead)) { clear = i / 60; if (arg.auto) break }
        }
        out.push({ seed, catches: stat().catches.hulk - c0, cocks, lost, clear })
      } finally { W.__parryGrace(0); end() }
    }
    return out`, { part, auto, cap, ...o })
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
  const cleared = (rows) => rows.map((r) => (r.clear < 0 ? 60 : r.clear))
  const parry = await fights('parry-clamp', true, 60)
  const cleaver = await fights('frayed-cleaver', true, 60)
  const cp = mean(parry.map((r) => r.catches)), hp = mean(parry.map((r) => r.lost)), hc = mean(cleaver.map((r) => r.lost))
  const tp = mean(cleared(parry)), tc = mean(cleared(cleaver))
  const signed = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`
  const lessHp = (1 - hp / hc) * 100, longer = (tp / tc - 1) * 100
  console.log(`INFO K-W3d: Parry ${cp.toFixed(2)} catches/fight (target 0.8-2.0), ${mean(parry.map((r) => r.cocks)).toFixed(2)} cocks/fight; ${parry.filter((r) => r.clear < 0).length} of 40 uncleared`)
  console.log(`INFO K-W3d: HP lost Parry ${hp.toFixed(2)} vs Cleaver ${hc.toFixed(2)}: Parry ${signed(1 - hp / hc)} less (target +15 to +30%)`)
  console.log(`INFO K-W3d: time to clear Parry ${tp.toFixed(2)} s vs Cleaver ${tc.toFixed(2)} s: Parry ${signed(tp / tc - 1)} longer (target +20 to +40%)`)
  // the same fights with the autos off, 20 s: what Parry alone catches, not hidden behind a close strike that kills a hulk in 1.3 s
  const solo = await fights('parry-clamp', false, 20)
  const sc = mean(solo.map((r) => r.catches)), sk = mean(solo.map((r) => r.cocks))
  console.log(`INFO K-W3d: autos off, Parry alone, 20 s: ${sc.toFixed(2)} catches/fight of ${sk.toFixed(2)} cocks (${(100 * sc / sk).toFixed(0)}% of cocks caught)`)
  // for the lead: the literal "whenever ready" bot (a cast every tick the button is ready, in reach or not), and the grace dial at 150
  const literal = await fights('parry-clamp', true, 60, { everyTick: true })
  const graced = await fights('parry-clamp', true, 60, { grace: 150 })
  console.log(`INFO K-W3d: Parry catches/fight, autos on: ${mean(literal.map((r) => r.catches)).toFixed(2)} casting every ready tick anywhere, ${mean(graced.map((r) => r.catches)).toFixed(2)} with __parryGrace(150) (shipped 0)`)
  assert(cp >= 0.3, `dead: Parry catches ${cp.toFixed(2)} tells per fight, under 0.3`)
  assert(!(tp < tc && hp < hc), `too strong: Parry clears faster (${tp.toFixed(2)} s vs ${tc.toFixed(2)} s) and loses less HP (${hp.toFixed(2)} vs ${hc.toFixed(2)}) than Cleaver`)
})

// --- Whole game (B2): R8, the crouch books its lunge -----------------------------------------------------------------------
check('K-W8a', ARENA, async ({ page }) => {
  const got = await inPage(page, `
    const end = begin(1)
    try {
      C.counters = true
      const e = W.__spawn('chaser', 0, 2.2, true)
      // dummy locks every 100 ms from +0 to +3000 ms: no 0.3 s window is free of a booked moment
      for (let ms = 0; ms <= 3000; ms += 100) C.book.book({}, ms)
      W.__enemyLog.length = 0
      tick(180)
      const crouchedBooked = W.__enemyLog.filter((x) => x.ev.kind === 'counter' && x.ev.what === 'crouch').length
      C.book.clear()
      const t0 = C.time
      let entry = null
      const s = until(() => W.__enemyLog.some((x) => x.ev.kind === 'counter' && x.ev.what === 'crouch'), 3)
      if (s < 0) return { crouchedBooked, bad: 'no crouch within 3 s once the book was cleared' }
      const mine = C.book.entries.filter((b) => b.owner === e)
      return { crouchedBooked, owners: mine.length, at: mine[0] ? mine[0].at - C.time : null, now: C.time, s }
    } finally { end() }`)
  bad(got)
  assert(got.crouchedBooked === 0, `${got.crouchedBooked} crouch event(s) while every 0.3 s window was booked`)
  assert(got.owners === 1, `${got.owners} book entries owned by the hulk at the crouch, not 1`)
  assert(Math.abs(got.at - 0.35) <= 1 / 60 + 1e-9, `the hulk's booked lunge is ${got.at.toFixed(4)} s after the crouch tick, not 0.35 (+-1/60)`)
  console.log(`INFO K-W8a: the crouch began ${got.s.toFixed(2)} s after the book cleared; its lunge booked ${got.at.toFixed(3)} s ahead`)
})

check('K-W8b', ARENA, async ({ page }) => {
  const got = await inPage(page, `
    const rows = []
    for (let seed = 1; seed <= 10; seed++) {
      const end = begin(seed)
      try {
        C.counters = true
        W.__spawn('chaser', 0, 2.2, true)
        W.__spawn('charger', 0, 6, true)
        W.__enemyLog.length = 0
        tick(3600)
        const log = W.__enemyLog
        const lunges = log.filter((x) => x.ev.kind === 'counter' && x.ev.what === 'lunge').map((x) => x.t)
        const locks = log.filter((x) => x.ev.kind === 'lock' && x.ev.e.kind === 'charger').map((x) => x.t)
        let gap = Infinity
        for (const a of lunges) for (const b of locks) gap = Math.min(gap, Math.abs(a - b))
        rows.push({ seed, lunges: lunges.length, locks: locks.length, gap })
      } finally { end() }
    }
    return rows`)
  const lunges = got.reduce((n, r) => n + r.lunges, 0), locks = got.reduce((n, r) => n + r.locks, 0)
  const gap = Math.min(...got.map((r) => r.gap === null ? Infinity : r.gap))
  assert(lunges >= 3, `only ${lunges} lunge(s) over the 10 seeds: the check proves nothing`)
  assert(gap >= 0.3 - 1 / 60 - 1e-9, `a lunge came ${gap.toFixed(4)} s from a ram's lock (BOOK_GAP 0.3)`)
  console.log(`INFO K-W8b: ${lunges} lunges and ${locks} ram locks over 10 x 60 s; the closest lunge to a ram lock was ${Number.isFinite(gap) ? gap.toFixed(3) + ' s' : 'n/a'}`)
})

process.exit(await run(process.argv.slice(2)))
