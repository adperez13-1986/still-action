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
const LINE4 = LINE

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
  W.__parryCatch(false) // the trial's switch is on by default in the page; the checks of R3 alone are of the game with it off
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
        if (arg.catchOn) W.__parryCatch(true)
        else W.__parryGrace(arg.grace ?? 0)
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
      } finally { W.__parryGrace(0); W.__parryCatch(false); end() }
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
  // the parry-catch trial (switch on: grace 150 and a catch readies Parry): the same fights, INFO only (the thresholds were for R3 alone)
  const onParry = await fights('parry-clamp', true, 60, { catchOn: true })
  const onSolo = await fights('parry-clamp', false, 20, { catchOn: true })
  const op = mean(onParry.map((r) => r.catches)), oh = mean(onParry.map((r) => r.lost)), ot = mean(cleared(onParry))
  console.log(`INFO K-W3d (parry catch ON): Parry ${op.toFixed(2)} catches/fight, ${mean(onParry.map((r) => r.cocks)).toFixed(2)} cocks/fight; ${onParry.filter((r) => r.clear < 0).length} of 40 uncleared`)
  console.log(`INFO K-W3d (parry catch ON): HP lost Parry ${oh.toFixed(2)} vs Cleaver ${hc.toFixed(2)}: Parry ${signed(1 - oh / hc)} less; time to clear ${ot.toFixed(2)} s vs ${tc.toFixed(2)} s: Parry ${signed(ot / tc - 1)} longer`)
  console.log(`INFO K-W3d (parry catch ON): autos off, 20 s: ${mean(onSolo.map((r) => r.catches)).toFixed(2)} catches/fight of ${mean(onSolo.map((r) => r.cocks)).toFixed(2)} cocks (was ${sc.toFixed(2)} of ${sk.toFixed(2)} with it off)`)
  assert(cp >= 0.3, `dead: Parry catches ${cp.toFixed(2)} tells per fight, under 0.3`)
  assert(!(tp < tc && hp < hc), `too strong: Parry clears faster (${tp.toFixed(2)} s vs ${tc.toFixed(2)} s) and loses less HP (${hp.toFixed(2)} vs ${hc.toFixed(2)}) than Cleaver`)
})

// --- The parry-catch trial (design/parry/README.md: option B + grace 150), behind the pause switch `parry catch` ------------------
/**
 * In-page for K-W3e..h: a pressure hulk at (0, 1.6) that has begun its cock. `catchAt(on, pushed)`: the switch as given, Parry cast into it,
 * one tick for the readying to land (main readies the button on the frame after the cast: the cast sets the cooldown after the snap).
 */
const PARRY_KIT = `
  const cocking = (y = 1.6) => { const e = W.__spawn('chaser', 0, y, true); return until(() => e.tellIn() !== null, 3) < 0 ? null : e }
  const stats = () => stat()
  const ready = () => W.__hud.readyIn('arms')
`

check('K-W3e', ARENA, async ({ page }) => {
  const one = (on, pushed) => inPage(page, `
    ${PARRY_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryCatch(arg.on)
      if (arg.pushed) { C.breakRule = true; W.__fire('arms') } // a whiff first: only a cooling button takes a push
      const e = cocking()
      if (!e) return { bad: 'the hulk never cocked' }
      const before = ready(), r0 = stats().parryReadies
      W.__fire('arms', arg.pushed)
      const afterCast = ready()
      tick(1)
      return { before, afterCast, afterTick: ready(), readies: stats().parryReadies - r0, caught: tellEvents().length, sw: stats().parryCatch, grace: W.__parryGrace() }
    } finally { end() }`, { on, pushed })
  for (const pushed of [false, true]) {
    const yes = await one(true, pushed)
    bad(yes)
    assert(yes.caught === 1, `switch on${pushed ? ', pushed' : ''}: ${yes.caught} caught tell(s), not 1`)
    assert(yes.afterCast > 3000 && yes.afterTick === 0, `switch on${pushed ? ', pushed' : ''}: readyIn ${yes.afterCast} right after the cast (want ~3600) and ${yes.afterTick} one tick later (want 0)`)
    assert(yes.readies === 1 && yes.grace === 150, `switch on: parryReadies +${yes.readies}, grace ${yes.grace} (want +1, 150)`)
  }
  // a windup broken (a crowned leader's heavy, unpushed) readies too
  const heavy = await inPage(page, `
    ${PARRY_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryCatch(true)
      const e = W.__spawn('chaser', 0, 2.2, true, 'plated')
      if (until(() => e.phase === 'windup', 4) < 0) return { bad: 'the heavy never wound up' }
      const r0 = stats().parryReadies
      W.__partLog.length = 0
      W.__fire('arms')
      const interrupts = W.__partLog.filter((x) => x.kind === 'interrupt' && x.parry === true && x.tell !== true).length
      tick(1)
      return { interrupts, afterTick: ready(), readies: stats().parryReadies - r0 }
    } finally { end() }`)
  bad(heavy)
  assert(heavy.interrupts === 1 && heavy.afterTick === 0 && heavy.readies === 1, `a broken windup: ${JSON.stringify(heavy)}, want one parry interrupt, ready, +1`)
  const dt = yes0(await one(true, false))
  console.log(`INFO K-W3e: caught tell: readyIn ${dt.afterCast.toFixed(0)} ms at the cast, ${dt.afterTick} one tick later; a broken heavy windup readies too; stats.parryCatch ${dt.sw}`)
})
const yes0 = (x) => x

check('K-W3f', ARENA, async ({ page }) => {
  // two catches `wait` ticks apart (the button is readied by the first, so the second is Parry's again); wait 0 means as soon as hulk B cocks
  const run = (waitS) => inPage(page, `
    ${PARRY_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryCatch(true)
      const first = cocking()
      if (!first) return { bad: 'hulk A never cocked' }
      const base = stats().parryReadies
      const t0 = C.time
      W.__fire('arms')
      tick(1)
      const r1 = ready(), n1 = stats().parryReadies - base
      tick(Math.round(arg * 60))
      const second = cocking(1.6)
      if (!second) return { bad: 'hulk B never cocked' }
      const gap = C.time - t0
      W.__fire('arms')
      tick(1)
      return { r1, n1, gap, r2: ready(), n2: stats().parryReadies - base, caught: tellEvents().length }
    } finally { end() }`, waitS)
  const tight = await run(0), late = await run(1.5)
  bad(tight); bad(late)
  assert(tight.n1 === 1 && tight.r1 === 0, `first catch: parryReadies ${tight.n1}, readyIn ${tight.r1} (want 1, 0)`)
  assert(tight.gap < 1.5 && tight.caught === 2, `the second catch came ${tight.gap.toFixed(2)} s after the first (${tight.caught} caught tells): not inside 1.5 s, the check proves nothing`)
  assert(tight.n2 === 1 && tight.r2 > 3000, `second catch ${tight.gap.toFixed(2)} s after the first: parryReadies ${tight.n2} (want 1), readyIn ${tight.r2} (want ~3600, no ready)`)
  assert(late.gap >= 1.5 && late.caught === 2, `the late catch came ${late.gap.toFixed(2)} s after the first (${late.caught} caught tells)`)
  assert(late.n2 === 2 && late.r2 === 0, `catch ${late.gap.toFixed(2)} s after the first: parryReadies ${late.n2} (want 2), readyIn ${late.r2} (want 0)`)
  console.log(`INFO K-W3f: a second catch ${tight.gap.toFixed(2)} s after the first: no ready (parryReadies 1); one ${late.gap.toFixed(2)} s after: ready (parryReadies 2)`)
})

check('K-W3g', ARENA, async ({ page }) => {
  const once = (on) => inPage(page, `
    ${PARRY_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryCatch(arg)
      const e = W.__spawn('chaser', 0, 1.6, true)
      if (until(() => e.tellIn() !== null, 3) < 0) return { bad: 'the hulk never cocked' }
      if (until(() => e.tellIn() === null, 1) < 0) return { bad: 'its tell never ended' }
      tick(5) // its tell ended 6 ticks (100 ms) before the cast lands
      const before = e.phase
      W.__partLog.length = 0
      W.__fire('arms')
      return { before, after: e.phase, caught: tellEvents().length, grace: W.__parryGrace() }
    } finally { end() }`, on)
  const on = await once(true), off = await once(false)
  bad(on); bad(off)
  assert(on.caught === 1 && on.after === 'recover', `switch on: a tell that ended 100 ms ago: ${JSON.stringify(on)}, want caught`)
  assert(off.caught === 0 && off.before === off.after, `switch off: a tell that ended 100 ms ago: ${JSON.stringify(off)}, want not caught, phase unchanged`)
  assert(on.grace === 150 && off.grace === 0, `grace ${on.grace} on and ${off.grace} off, want 150 and 0`)
})

check('K-W3h', ARENA, async ({ page }) => {
  const got = await inPage(page, `
    ${PARRY_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      W.__parryCatch(false)
      const e = cocking()
      if (!e) return { bad: 'the hulk never cocked' }
      const r0 = stats().parryReadies
      W.__fire('arms')
      tick(3)
      return { caught: tellEvents().length, ready: ready(), readies: stats().parryReadies - r0, sw: stats().parryCatch }
    } finally { end() }`)
  bad(got)
  assert(got.caught === 1, `switch off: R3 still catches (${got.caught} caught tells, want 1)`)
  assert(got.ready > 3000 && got.readies === 0, `switch off: readyIn ${got.ready} (want ~3600, no ready), parryReadies ${got.readies} (want 0)`)
})

check('K-W3i', ARENA + '&trial=switch', async ({ page }) => {
  const KEY = 'still-action.parryCatch'
  const read = () => evalJson(page, () => ({ on: window.__parryCatch(), grace: window.__parryGrace(), stat: window.__run.stats[window.__run.stats.length - 1] }))
  const boot = await read()
  assert(boot.on === true && boot.grace === 150, `default: switch ${boot.on}, grace ${boot.grace} (want on, 150)`)
  assert(boot.stat.parryCatch === true && boot.stat.parryReadies === 0, `default DepthStats: ${JSON.stringify({ c: boot.stat.parryCatch, r: boot.stat.parryReadies })}`)
  try {
    await page.evaluate((k) => localStorage.setItem(k, '0'), KEY)
    await page.reload()
    await page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
    const off = await read()
    assert(off.on === false && off.grace === 0 && off.stat.parryCatch === false, `stored off: switch ${off.on}, grace ${off.grace}, stats ${off.stat.parryCatch} (want off, 0, false)`)
    // and a new level applies whatever is stored: turn it back on in the store, the level in hand keeps its state until the next enter
    await page.evaluate((k) => localStorage.setItem(k, '1'), KEY)
    assert((await read()).on === false, 'the switch changed mid-level')
  } finally {
    await page.evaluate((k) => localStorage.removeItem(k), KEY)
  }
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

// --- Trains and pressure bodies (B3): R4, R5, R6 (dark: the Line only) ---------------------------------------------------
const SEEDS = Number(process.env.SEEDS) || 40
const TRAINS = process.env.TRAINS === undefined ? 100 : Number(process.env.TRAINS)

/**
 * K-T13's trial, in the page (STAGE-B.md §4): every room lane of one generated level, one fight per lane. `arg`:
 * { depth, seed, bot: 'A' | 'B' | 'C' }. Still on the lane's centre at its room's middle, that room's pack woken, the close strike
 * and the planted shot on, 30 s cap (it ends early once nothing awake is left to kill). A kill is the train's when the body dies on a
 * tick a train group hit it and the hazard's own damage killed it; it is FREE when, for the whole second before, the body's knock speed
 * stayed <= 1.5, it wasn't held, it wasn't countering, and it was a pressure body. Also the longest a pressure body stood uncommitted
 * (`__isCommitted`, when the hook exists) inside a lit strip grown by its radius + 0.3 (K-T5).
 * Bot A never moves. Bot B, when a lane lights, steers perpendicular to the nearer edge until clear of halfW + 0.62.
 * Bot C (Clamp Toss): after the horn, sticks toward the lane and casts when a body is in reach.
 */
const T13_BODY = `
  const P = W.__LINE
  // the floor strip as Combat.stepOff reads it: across within \`half\`, along the span grown by \`pad\`
  const inStrip = (x, z, l, half, pad = 0) => {
    const len = Math.hypot(l.bx - l.ax, l.bz - l.az), ux = (l.bx - l.ax) / len, uz = (l.bz - l.az) / len
    const across = (x - l.ax) * uz - (z - l.az) * ux, along = (x - l.ax) * ux + (z - l.az) * uz
    return { in: along >= -pad && along <= len + pad && Math.abs(across) <= half, across, ux, uz, len }
  }
  const out = { trainsRun: 0, lanes: 0, kills: 0, trainKills: 0, freeKills: 0, byTrain: [], stillHits: 0, maxUncommitted: 0, noHook: typeof W.__isCommitted !== 'function', ticks: 0 }
  W.__hold(true)
  W.__run.route = arg.depth === 4 ? 'III' : 'II'
  W.__enter(arg.depth, arg.seed)
  const all = W.__lanes().filter((l) => l.kind === 'room' && l.room !== null).map((l) => l.id)
  for (let li = 0; li < all.length; li++) {
    const endRandom = (() => {
      W.__hold(true)
      const SLOTS = ['head', 'torso', 'arms', 'legs']
      for (const slot of SLOTS) C.clearSlot(slot)
      W.__hud.resetLoadout([])
      for (const slot of SLOTS) W.__still.wear(slot, null)
      W.__equip('scrap-cleaver')
      const original = Math.random
      Math.random = mulberry32(arg.seed * 131 + li)
      return () => { Math.random = original }
    })()
    try {
      W.__run.route = arg.depth === 4 ? 'III' : 'II'
      W.__enter(arg.depth, arg.seed)
      if (arg.bot === 'C') W.__equip('clamp-toss')
      C.autoAttack = true
      C.autoTimer = 0
      C.mastery = new Set()
      W.__stick(0, 0)
      const lane = W.__lanes().find((l) => l.id === all[li])
      const lvl = W.__level()
      const pi = lvl.packs.findIndex((pk) => lvl.rooms.indexOf(pk.room) === lane.room)
      if (pi < 0 || lane.lesson) continue
      out.lanes++
      C.wake(C.packs[pi])
      W.__still.pos.set((lane.ax + lane.bx) / 2, 0, (lane.az + lane.bz) / 2)
      const streak = new Map(), uncommitted = new Map()
      const hitStill = new Set()
      const line = C.line
      for (let i = 0; i < 1800; i++) {
        C.hp = 100
        const lit = line.lit()
        const sp = W.__still.pos
        if (arg.bot === 'B') {
          let sx = 0, sz = 0
          for (const l of lit) {
            const g = inStrip(sp.x, sp.z, l, P.halfW + 0.62 + 0.05)
            if (g.in) {
              const side = Math.sign(g.across) || 1
              sx += g.uz * side
              sz += -g.ux * side
            }
          }
          const n = Math.hypot(sx, sz)
          W.__stick(n ? sx / n : 0, n ? sz / n : 0)
        } else if (arg.bot === 'C') {
          const horned = W.__trains().some((t) => t.stage === 'committed' || t.stage === 'passing')
          if (horned && lit.length) {
            const l = lit[0], g = inStrip(sp.x, sp.z, l, 1e9)
            const side = -Math.sign(g.across) || 1
            const n = Math.abs(g.across) > 0.3 ? 1 : 0
            W.__stick(n * g.uz * side, n * -g.ux * side)
            if (C.enemies.some((e) => !e.dead && Math.hypot(e.pos.x - sp.x, e.pos.z - sp.z) <= 2.9)) W.__fire('arms')
          } else W.__stick(0, 0)
        }
        const before = C.enemies.filter((e) => !e.dead) // a body dead since last tick is still listed for a tick: counted once, not twice
        const ok0 = new Map(before.map((e) => [e, streak.get(e) ?? 0]))
        W.__step(1 / 60)
        out.ticks++
        for (const e of before) {
          if (!e.dead) continue
          out.kills++
          const tr = line.trains().find((t) => C.groupHitsOf(t).has(e))
          if (tr && C.hazardKilled.has(e)) {
            out.trainKills++
            const k = out.byTrain.find((b) => b.tr === tr)
            if (k) k.n++; else out.byTrain.push({ tr, n: 1 })
            if (e.pressure && (ok0.get(e) ?? 0) >= 60) out.freeKills++
          }
        }
        for (const t of line.trains()) if (C.groupHitsOf(t).has('still')) hitStill.add(t)
        const litNow = line.lit()
        for (const e of C.enemies) {
          if (e.dead) continue
          const counter = e.countering ?? (e.crouch || e.lunge !== null || e.spent || false)
          const okNow = !!e.pressure && Math.hypot(e.knock.x, e.knock.z) <= 1.5 && !C.held.has(e) && !counter
          streak.set(e, okNow ? (streak.get(e) ?? 0) + 1 : 0)
          if (e.pressure && !out.noHook) {
            const inside = litNow.some((l) => inStrip(e.pos.x, e.pos.z, l, P.halfW + e.radius + 0.3, e.radius).in)
            const u = inside && !W.__isCommitted(e) ? (uncommitted.get(e) ?? 0) + 1 / 60 : 0
            uncommitted.set(e, u)
            if (u > out.maxUncommitted) out.maxUncommitted = u
          }
        }
        if (i > 120 && !C.enemies.some((e) => !e.dead && C.packs.some((pk) => pk.state === 'awake' && pk.members.includes(e)))) break
      }
      out.stillHits += hitStill.size
      out.trainsRun += line.trains().filter((t) => t.stage === 'passing' || t.stage === 'gone').length
    } finally { endRandom() }
  }
  out.byTrain = out.byTrain.map((b) => b.n)
  return out`

/** K-T13's whole sweep for a bot, cached per page (K-T5 reads bot A's). */
const t13Cache = new Map()
const t13 = (page, bot) => {
  if (!t13Cache.has(bot)) {
    t13Cache.set(bot, (async () => {
      const rows = []
      for (const depth of [4, 7]) {
        const row = { depth, seeds: 0, trainsRun: 0, lanes: 0, kills: 0, trainKills: 0, freeKills: 0, byTrain: [], stillHits: 0, maxUncommitted: 0, noHook: false }
        // at least SEEDS levels, and on until TRAINS trains have run (a lane fight ends when its bodies die: about 1 train in 4)
        for (let seed = 1; seed <= SEEDS || (row.trainsRun < TRAINS && seed <= 4000); seed++) {
          row.seeds = seed
          const r = await inPage(page, T13_BODY, { depth, seed, bot })
          for (const k of ['trainsRun', 'lanes', 'kills', 'trainKills', 'freeKills', 'stillHits']) row[k] += r[k]
          row.byTrain.push(...r.byTrain)
          row.maxUncommitted = Math.max(row.maxUncommitted, r.maxUncommitted)
          row.noHook ||= r.noHook
        }
        rows.push(row)
      }
      return rows
    })())
  }
  return t13Cache.get(bot)
}

check('K-T13', ON, async ({ page }) => {
  const pct = (a, b) => (b ? (100 * a) / b : 0)
  const fails = []
  for (const bot of ['A', 'B', 'C']) {
    for (const r of await t13(page, bot)) {
      const share = pct(r.trainKills, r.kills), free = pct(r.freeKills, r.kills)
      const multi = pct(r.byTrain.filter((n) => n >= 2).length, r.trainsRun)
      const step = r.depth === 4 ? 'step 4' : 'step 7'
      const line = `bot ${bot}, ${step}: ${r.seeds} seeds, ${r.lanes} lane fights, ${r.kills} kills; trains ${r.trainKills} (${share.toFixed(1)}%), free ${r.freeKills} (${free.toFixed(1)}%), earned ${pct(r.trainKills - r.freeKills, r.kills).toFixed(1)}%; ${r.byTrain.filter((n) => n >= 2).length} of ${r.trainsRun} trains that ran killed 2+ (${multi.toFixed(0)}%); hits on Still ${r.stillHits}`
      if (bot === 'A') {
        console.log(`INFO K-T13: ${line} (train share ${share <= 25 ? 'ok' : share <= 35 ? 'over 25' : 'OVER 35'}, free ${free <= 5 ? 'ok' : free <= 10 ? 'over 5' : 'OVER 10'})`)
        if (share > 35) fails.push(`bot A ${step}: trains took ${share.toFixed(1)}% of kills, over 35%`)
        if (free > 10) fails.push(`bot A ${step}: free train kills are ${free.toFixed(1)}% of kills, over 10%`)
        if (multi > 20) fails.push(`bot A ${step}: ${multi.toFixed(0)}% of the trains that ran killed 2+ bodies, over 20%`)
      } else if (bot === 'B') {
        console.log(`INFO K-T13: ${line}`)
        if (r.stillHits > 0) fails.push(`bot B ${step}: a train hit Still ${r.stillHits} time(s)`)
      } else console.log(`INFO K-T13: ${line} (earned ${pct(r.trainKills - r.freeKills, r.kills) >= 15 ? 'ok' : pct(r.trainKills - r.freeKills, r.kills) < 10 ? 'under 10: names the 3.0 step-off dial (stage T)' : 'low'})`)
    }
  }
  assert((await t13(page, 'A')).every((r) => r.lanes > 0), 'no lane fights ran: the check proves nothing')
  assert(fails.length === 0, fails.join('; '))
})

// K-T5's discriminating case: a pressure hulk in its jab (strike) or recover on a lit strip is committed by the OLD rule (phase != approach)
// and stays on; by R4 it has no windup, so it steps off. A crowned leader (an elite hulk) and a ram in a windup are telegraphs and stay.
check('K-T5', LINE, async ({ page }) => {
  const got = await inPage(page, `
    ${LINE_LEVEL}
    const end = begin(1)
    try {
      const lane = line(4, 1)
      if (!lane) return { bad: 'no room lane on this seed' }
      const P = W.__LINE
      const vertical = Math.abs(lane.ax - lane.bx) < 0.01
      const mx = (lane.ax + lane.bx) / 2, mz = (lane.az + lane.bz) / 2
      const along = (d) => vertical ? [mx, mz + d] : [mx + d, mz]
      // Still well clear of the lane (and of the sleepers' wake), the bodies spread along the strip
      W.__still.pos.set(vertical ? mx + 9 : mx, 0, vertical ? mz : mz + 9)
      C.pressure = true
      C.counters = false
      const spawn = (kind, d, elite) => { const [x, z] = along(d); return W.__spawn(kind, x, z, true, elite) }
      const jab = spawn('chaser', -6), rec = spawn('chaser', -2), leader = spawn('chaser', 2, 'plated'), ram = spawn('charger', 6)
      jab.phase = 'strike'; jab.timer = 60000
      rec.phase = 'recover'; rec.timer = 60000
      leader.phase = 'windup'; leader.timer = 60000
      ram.phase = 'windup'; ram.timer = 60000
      const across = (e) => Math.abs(vertical ? e.pos.x - mx : e.pos.z - mz)
      const start = [jab, rec, leader, ram].map((e) => [e.pos.x, e.pos.z])
      const committed = () => [jab, rec, leader, ram].map((e) => W.__isCommitted(e))
      W.__train(lane.id)
      if (until(() => C.line.lit().length > 0, 1) < 0) return { bad: 'the lane never lit' }
      const c0 = committed()
      // the ram may end its own windup (no clear lane to its target): what matters is that the step-off never moved it while it was one
      let ramWindupMoved = 0
      for (let i = 0; i < 60; i++) {
        const wasWinding = ram.phase === 'windup', p0 = [ram.pos.x, ram.pos.z]
        tick(1)
        if (wasWinding && ram.phase === 'windup') ramWindupMoved = Math.max(ramWindupMoved, Math.hypot(ram.pos.x - p0[0], ram.pos.z - p0[1]))
      }
      const grown = (e) => P.halfW + e.radius + 0.3
      return {
        c0, c1: committed(), grown: [jab, rec, leader, ram].map(grown),
        across: [jab, rec, leader, ram].map(across),
        moved: [jab, rec, leader, ram].map((e, i) => Math.hypot(e.pos.x - start[i][0], e.pos.z - start[i][1])),
        phases: [jab, rec, leader, ram].map((e) => e.phase), ramWindupMoved,
      }
    } finally { end() }`)
  bad(got)
  const names = ['pressure hulk in its jab', 'pressure hulk in its recover', 'crowned leader in a windup', 'ram in a windup']
  assert(got.c0[0] === false && got.c0[1] === false, `R4: ${names.filter((_, i) => i < 2 && got.c0[i]).join(', ')} counts as committed (__isCommitted)`)
  assert(got.c0[2] === true && got.c0[3] === true, `a telegraph is not committed: ${names.filter((_, i) => i > 1 && !got.c0[i]).join(', ')}`)
  for (const i of [0, 1]) assert(got.across[i] > got.grown[i], `the ${names[i]} is still on the lit strip after 1 s (${got.across[i].toFixed(2)} u off the centre line, strip ${got.grown[i].toFixed(2)})`)
  assert(got.moved[2] < 0.05 && got.across[2] < got.grown[2], `the ${names[2]} left the lit strip (moved ${got.moved[2].toFixed(2)} u)`)
  assert(got.ramWindupMoved < 0.05, `the step-off moved the ${names[3]} by ${got.ramWindupMoved.toFixed(2)} u in a tick`)
  console.log(`INFO K-T5: after 1 s of a lit lane: the jab stepped ${got.moved[0].toFixed(2)} u and the recover ${got.moved[1].toFixed(2)} u off the strip; the leader (${got.moved[2].toFixed(2)} u) and the ram never moved in its windup (${got.ramWindupMoved.toFixed(2)} u) stayed`)
})

check('K-T5', ON, async ({ page }) => {
  const rows = await t13(page, 'A')
  assert(!rows.some((r) => r.noHook), 'no __isCommitted hook')
  const worst = Math.max(...rows.map((r) => r.maxUncommitted))
  console.log(`INFO K-T5: the longest a pressure body stood uncommitted inside a lit strip, over bot A's runs: ${worst.toFixed(3)} s`)
  assert(worst <= 0.6 + 1e-9, `a pressure body stood uncommitted in a lit strip for ${worst.toFixed(3)} s, over 0.6`)
})

/** In the page: the flag-off Line at `depth`, a room lane with nothing on it, the level's bodies killed (B4's `__emptyLevel` does not exist yet). */
const LINE_LEVEL = `
  const line = (depth, seed) => {
    W.__hold(true)
    W.__run.route = 'III'
    W.__enter(depth, seed)
    C.autoAttack = false
    C.counters = true
    for (const e of [...C.enemies]) e.hit(1e9)
    W.__step(0.2)
    const lane = W.__lanes().find((l) => l.kind === 'room' && !l.lesson && l.nextAt - W.__lineT() > 4)
    return lane
  }`

check('K-T14', LINE, async ({ page }) => {
  const got = await inPage(page, `
    ${LINE_LEVEL}
    const end = begin(1)
    try {
      const lane = line(4, 1)
      if (!lane) return { bad: 'no room lane on this seed' }
      const P = W.__LINE
      const vertical = Math.abs(lane.ax - lane.bx) < 0.01
      const mx = (lane.ax + lane.bx) / 2, mz = (lane.az + lane.bz) / 2
      // Still 3.6 u off the strip's edge (the brief's 2.0 puts him inside the hulk's swipe when it leaves, and it cocks, then recovers 0.55 s
      // before it can crouch); the hulk on the lane, a step toward him so it leaves by the near edge, 2.4 u from him: in his band, not touching
      const off = P.halfW + 3.6
      W.__still.pos.set(vertical ? mx + off : mx, 0, vertical ? mz : mz + off)
      C.pressure = true
      C.counters = true
      const h = W.__spawn('chaser', vertical ? mx + 0.3 : mx, vertical ? mz : mz + 0.3, true)
      W.__train(lane.id)
      if (until(() => C.line.lit().length > 0, 1) < 0) return { bad: 'the lane never lit' }
      h.bandT = 2
      // the train's own booked locks (R8) would hold a crouch off too, and this check is about the strip: clear the book
      C.book.clear()
      const near = () => C.line.nearLit(h.pos.x, h.pos.z, P.halfW + h.radius + 0.3)
      W.__enemyLog.length = 0
      let crouchWhileNear = 0, tNear = 0, crouchAt = -1, clearAt = -1
      for (let i = 0; i < 180; i++) {
        C.hp = 100
        const nearBefore = near()
        if (nearBefore) h.bandT = Math.max(h.bandT, 2) // the band is built the whole time it stands on the strip
        if (!nearBefore && clearAt < 0) clearAt = i
        W.__step(1 / 60)
        const crouched = W.__enemyLog.some((x) => x.ev.kind === 'counter' && x.ev.what === 'crouch')
        if (nearBefore) tNear++
        if (crouched) { if (nearBefore) crouchWhileNear++; crouchAt = i; break }
      }
      return { crouchWhileNear, tNear, crouchAt, clearAt, crouchDelay: crouchAt >= 0 && clearAt >= 0 ? (crouchAt - clearAt + 1) / 60 : null }
    } finally { end() }`)
  bad(got)
  assert(got.crouchWhileNear === 0, `the hulk started a crouch on a lit strip (after ${got.tNear} ticks near it)`)
  assert(got.crouchAt >= 0 && got.clearAt >= 0, `the hulk never crouched once clear (${JSON.stringify(got)})`)
  assert(got.crouchDelay <= 0.5 + 1 / 60, `the hulk crouched ${got.crouchDelay.toFixed(3)} s after it cleared the strip, over 0.5`)
  console.log(`INFO K-T14: it stayed off the crouch for ${got.tNear} ticks on the strip, stepped clear at tick ${got.clearAt}, crouched ${got.crouchDelay.toFixed(3)} s after`)
})

check('K-T15', LINE, async ({ page }) => {
  const got = await inPage(page, `
    ${LINE_LEVEL}
    const end = begin(1)
    try {
      const lane = line(4, 1)
      if (!lane) return { bad: 'no room lane on this seed' }
      const mx = (lane.ax + lane.bx) / 2, mz = (lane.az + lane.bz) / 2
      // Still on the same lane, 2 u in from its end and 8 u along it from the sleeper: closer, it wakes, and an awake body steps off the strip
      W.__still.pos.set(lane.ax + (lane.bx - lane.ax) * 0.1, 0, lane.az + (lane.bz - lane.az) * 0.1)
      C.pressure = true
      C.counters = false
      C.eye = false // planted, every hit on him is halved (EYE.brace): not the flat 20 the rule is about
      const h = W.__spawn('chaser', mx, mz, false)
      const hp0 = h.hp, c0 = C.hp, mul = C.curve.hp
      W.__train(lane.id)
      let stillLost = 0
      for (let i = 0; i < 240; i++) { const before = C.hp; W.__step(1 / 60); stillLost += before - C.hp; C.hp = 100 }
      return { bodyLost: hp0 - h.hp, stillLost, mul, hp0 }
    } finally { C.eye = true; end() }`)
  bad(got)
  assert(Math.abs(got.bodyLost - 20 * got.mul) <= 1e-6, `the hulk lost ${got.bodyLost}, not 20 x curve.hp (${20 * got.mul})`)
  assert(Math.abs(got.stillLost - 20) <= 1e-6, `Still lost ${got.stillLost}, not a flat 20`)
  // the lesson lane's train does 0 to both
  const lesson = await inPage(page, `
    ${LINE_LEVEL}
    const end = begin(1)
    try {
      W.__hold(true)
      W.__run.route = 'III'
      W.__enter(4, 1)
      C.autoAttack = false
      for (const e of [...C.enemies]) e.hit(1e9)
      W.__step(0.2)
      const lane = W.__lanes().find((l) => l.lesson)
      if (!lane) return { bad: 'no lesson lane on seed 1' }
      const mx = (lane.ax + lane.bx) / 2, mz = (lane.az + lane.bz) / 2
      W.__still.pos.set(lane.ax + (lane.bx - lane.ax) * 0.1, 0, lane.az + (lane.bz - lane.az) * 0.1)
      C.pressure = true
      C.eye = false
      const h = W.__spawn('chaser', mx, mz, false)
      const hp0 = h.hp
      W.__train(lane.id)
      let stillLost = 0
      for (let i = 0; i < 240; i++) { const before = C.hp; W.__step(1 / 60); stillLost += before - C.hp; C.hp = 100 }
      return { bodyLost: hp0 - h.hp, stillLost, lesson: W.__trains()[0]?.lesson }
    } finally { C.eye = true; end() }`)
  bad(lesson)
  assert(lesson.lesson === true && lesson.bodyLost === 0 && lesson.stillLost === 0, `the lesson train did ${JSON.stringify(lesson)}, not 0 to both`)
  console.log(`INFO K-T15: the hulk lost ${got.bodyLost.toFixed(2)} (20 x ${got.mul}), Still lost ${got.stillLost}; the lesson train 0 and 0`)
})

// --- The Signalman (B4): SPEC 6.1, R1, R2, R10 --------------------------------------------------------------------------------
/**
 * In-page kit for the Signalman's checks (STAGE-B.md section 4: "LINE4, __emptyLevel(), a room lane L with nextAt - t > 4").
 * `rig(depth, seed, o)`: the flag-off Line at `depth`, every body out (`__emptyLevel`), a room lane L (not the lesson lane) whose schedule is
 * pushed 30 s out, and where things go: `still` is o.stillOff from L's span (default 2), `sig` o.sigD from Still, at least o.sigSpan from L
 * (R2 wants 2.65), `near` is Still 2 u off L on the same side. Still is never within 3.7 u of another lane (so L is the one it could call)
 * unless o.anyLane. Null when this seed has no such placement. `withRig(o, fn)` tries seeds 1..16. `spawnSig` puts an awake Signalman
 * (reload 0, no wake reload: the wake reload has its own check) where the rig says; `pin` holds Still (and a pinned Signalman) still.
 */
const SIG_KIT = `
  const dspan = (x, z, l) => {
    const dx = l.bx - l.ax, dz = l.bz - l.az, l2 = dx * dx + dz * dz
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - l.ax) * dx + (z - l.az) * dz) / l2)) : 0
    return Math.hypot(x - (l.ax + dx * t), z - (l.az + dz * t))
  }
  const rig = (depth, seed, o = {}) => {
    W.__hold(true)
    W.__run.route = 'III'
    W.__enter(depth, seed)
    W.__emptyLevel()
    C.autoAttack = false
    C.counters = false
    const lanes = W.__lanes()
    const T = W.__level().terrain
    for (const lane of lanes.filter((l) => l.kind === 'room' && !l.lesson && l.room !== null)) {
      const len = Math.hypot(lane.bx - lane.ax, lane.bz - lane.az)
      const ux = (lane.bx - lane.ax) / len, uz = (lane.bz - lane.az) / len, nx = -uz, nz = ux
      const mx = (lane.ax + lane.bx) / 2, mz = (lane.az + lane.bz) / 2
      for (const along of [0, 2, -2, 4, -4]) for (const s of [1, -1]) {
        const at = (off) => ({ x: mx + ux * along + nx * s * off, z: mz + uz * along + nz * s * off })
        const still = at(o.stillOff ?? 2), near = at(2)
        if (T.blocked(still.x, still.z, 0.5) || T.blocked(near.x, near.z, 0.5)) continue
        if (!o.anyLane && lanes.some((l) => l.id !== lane.id && (dspan(still.x, still.z, l) < 4.2 || dspan(near.x, near.z, l) < 4.2))) continue
        for (let a = 0; a < 360; a += 10) {
          const sig = { x: still.x + Math.cos(a * Math.PI / 180) * (o.sigD ?? 9), z: still.z + Math.sin(a * Math.PI / 180) * (o.sigD ?? 9) }
          if (T.blocked(sig.x, sig.z, 0.7) || dspan(sig.x, sig.z, lane) < (o.sigSpan ?? 2.9)) continue
          if (!T.lineClear(sig.x, sig.z, still.x, still.z, 0.2, true)) continue
          C.line.runOf(C.line.lanes.find((l) => l.id === lane.id)).nextAt = C.line.t + 30
          return { lane, still, near, sig, mx, mz, nx: nx * s, nz: nz * s, seed, T }
        }
      }
    }
    return null
  }
  const withRig = (o, fn) => {
    for (let seed = 1; seed <= 16; seed++) { const r = rig(4, seed, o); if (r) return fn(r) }
    return { bad: 'no seed 1..16 has a placement for ' + JSON.stringify(o) }
  }
  const spawnSig = (r, lesson) => {
    W.__still.pos.set(r.still.x, 0, r.still.z)
    W.__stick(0, 0)
    const s = W.__spawn('ranged', r.sig.x, 0 + r.sig.z, true, undefined, 'signal', lesson)
    s.reload = lesson ? s.reload : 0
    return s
  }
  const calls = () => W.__enemyLog.filter((x) => x.ev.kind === 'call')
  const laneOf = (id) => W.__lanes().find((l) => l.id === id)
`
check('K-E1', LINE4, async ({ page }) => {
  const got = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 9 }, (r) => {
        const s = W.__spawn('ranged', r.sig.x, r.sig.z, true, undefined, 'signal')
        W.__still.pos.set(r.still.x, 0, r.still.z)
        const pin = () => W.__still.pos.set(r.still.x, 0, r.still.z)
        const reload0 = s.reload
        W.__enemyLog.length = 0
        const w1 = until(() => s.phase === 'windup', 2.6, pin)
        if (w1 < 0) return { bad: 'no windup in 2.6 s (reload ' + s.reload + ', dist ' + dist(s.pos, W.__still.pos).toFixed(2) + ')' }
        const bookMine = C.book.entries.filter((b) => b.owner === s).map((b) => b.at - C.time)
        const c1 = until(() => calls().length > 0, 1.2, pin)
        if (c1 < 0) return { bad: 'no call within 1.2 s of the windup' }
        const ev = calls()[0].ev
        const lineT = W.__lineT()
        const trains = W.__trains()
        const tr = trains[trains.length - 1]
        const lane = laneOf(r.lane.id)
        // the next windup: a call restarts its reload at 7 s, after the 760 ms recover
        const w2 = until(() => s.phase === 'windup', 12, pin)
        return { w1, reload0, windup: c1, called: ev.called, lane: ev.lane, laneWant: r.lane.id, slip: tr ? tr.t0 - (lineT - 1 / 60) : null, ntrains: trains.length,
          nextAt: lane.nextAt, t0: tr ? tr.t0 : null, period: lane.period, dSig: dist(s.pos, W.__still.pos), bookMine, w2, seed: r.seed }
      })
    } finally { end() }`)
  bad(got)
  assert(got.w1 >= 1.9 && got.w1 <= 2.6, `its first windup came ${got.w1.toFixed(2)} s after waking (wakeMs 2000, allowed 1.9-2.6)`)
  assert(got.called === true && got.lane === got.laneWant, `the call event: called ${got.called}, lane ${got.lane}, wanted ${got.laneWant}`)
  assert(got.ntrains === 1 && got.slip !== null && got.slip >= -1 / 60 && got.slip <= 0.6 + 2 / 60, `L's train t0 is ${got.slip === null ? 'missing' : got.slip.toFixed(3)} s after the call (want 0-0.6), ${got.ntrains} train(s)`)
  assert(Math.abs(got.nextAt - (got.t0 + got.period)) < 1e-6, `L.nextAt ${got.nextAt} is not t0 + period (${got.t0 + got.period})`)
  assert(got.bookMine.length === 1 && Math.abs(got.bookMine[0] - 0.9) <= 2 / 60, `its book entry is ${JSON.stringify(got.bookMine)} s ahead at the windup's start, not [0.9]`)
  assert(got.w2 >= 7.0, `its next windup came ${got.w2.toFixed(2)} s after its call, under the 7 s reload`)
  console.log(`INFO K-E1: seed ${got.seed}: windup ${got.w1.toFixed(2)} s after waking, call ${got.windup.toFixed(2)} s later, train t0 +${(got.slip * 1000).toFixed(0)} ms, next windup ${got.w2.toFixed(2)} s after the call`)
})

check('K-E2', LINE4, async ({ page }) => {
  const got = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      const rows = []
      const out = withRig({ stillOff: 6, sigD: 8, sigSpan: 3.5 }, (r) => {
        const s = W.__spawn('ranged', r.sig.x, r.sig.z, true, undefined, 'signal')
        const at = { still: { ...r.still }, sig: { ...r.sig } }
        const pin = () => { W.__still.pos.set(at.still.x, 0, at.still.z); s.pos.set(at.sig.x, 0, at.sig.z) }
        const L = C.line.lanes.find((l) => l.id === r.lane.id)
        const run = C.line.runOf(L)
        // one trial: reset it, apply the setup, step up to secs and say whether a windup began
        const trial = (name, setup, secs, want) => {
          if (s.phase === 'windup') s.interrupt(false)
          C.book.clear()
          s.phase = 'approach'; s.reload = 0
          run.nextAt = C.line.t + 30
          setup()
          const t = until(() => s.phase === 'windup', secs, pin)
          rows.push({ name, want, windup: t >= 0, at: t })
        }
        // R: a lane not lit, nextAt far, Still within 14 u and 2 u off L: the base (near), then each rule broken alone and mended
        const goNear = () => { at.still = { ...r.near } }
        goNear()
        trial('control', () => {}, 1.5, true)
        // (1) L lit: a train on it now (held from winding up until it is lit, so the trial starts at the lit moment)
        if (s.phase === 'windup') s.interrupt(false)
        C.book.clear(); s.phase = 'approach'
        W.__train(L.id)
        const lit = until(() => C.line.lit().some((l) => l.id === L.id), 3, () => { pin(); s.reload = 1e9 })
        if (lit < 0) return { bad: 'L never lit after a call' }
        s.reload = 0
        const litT = until(() => s.phase === 'windup', 2.0, pin)
        rows.push({ name: 'lit', want: false, windup: litT >= 0, at: litT })
        // and mended: the train gone, it winds up again
        if (s.phase === 'windup') s.interrupt(false)
        const gone = until(() => C.line.lit().length === 0 && C.line.trains().every((t) => t.stage === 'gone'), 8, () => { pin(); s.reload = 1e9 })
        if (gone < 0) return { bad: 'the train never left' }
        trial('lit-mended', () => { run.nextAt = C.line.t + 30 }, 1.5, true)
        // (2) nextAt - t <= 4
        trial('quiet', () => { run.nextAt = C.line.t + 3.5 }, 1.0, false)
        trial('quiet-mended', () => { run.nextAt = C.line.t + 30 }, 1.5, true)
        // (3) Still > 14 u from it
        const far = (() => { for (let a = 0; a < 360; a += 10) { const x = at.still.x + Math.cos(a * Math.PI / 180) * 16, z = at.still.z + Math.sin(a * Math.PI / 180) * 16; if (!r.T.blocked(x, z, 0.7) && Math.hypot(x - r.mx, z - r.mz) > 0) return { x, z } } return null })()
        const sigWas = { ...at.sig }
        if (far) at.sig = far
        trial('far', () => {}, 1.0, false)
        at.sig = sigWas
        trial('far-mended', () => {}, 1.5, true)
        // (4) Still > 3.7 u from every lane (6 u off L)
        at.still = { ...r.still }
        trial('reach', () => {}, 1.5, false)
        goNear()
        trial('reach-mended', () => {}, 1.5, true)
        return { rows, hadFar: !!far, dFar: 16 }
      })
      return out
    } finally { end() }`)
  bad(got)
  assert(got.hadFar, 'no spot 16 u from Still for the far case')
  for (const row of got.rows) {
    if (row.want === null) continue
    assert(row.windup === row.want, `${row.name}: ${row.windup ? 'it wound up (at ' + row.at.toFixed(2) + ' s)' : 'it never wound up'}, expected ${row.want ? 'a windup' : 'none'}`)
  }
  console.log(`INFO K-E2: ${got.rows.map((r) => `${r.name} ${r.windup ? 'winds up' : 'no windup'}`).join('; ')}`)
})

check('K-E3', LINE4, async ({ page }) => {
  const one = (label, breakRule, pushed) => inPage(page, `
    ${SIG_KIT}
    const end = begin(1, 'parry-clamp')
    try {
      return withRig({ stillOff: 2, sigD: 2.0, sigSpan: 3.0 }, (r) => {
        C.breakRule = ${breakRule}
        if (${pushed}) W.__fire('arms') // a whiff first: only a cooling button takes a push
        const s = W.__spawn('ranged', r.sig.x, r.sig.z, true, undefined, 'signal')
        s.reload = 0
        s.hp = 200 // the cast (10) and the reeling hit (15) must not kill it: a dead body never winds up again
        W.__still.pos.set(r.still.x, 0, r.still.z)
        const pin = () => { W.__still.pos.set(r.still.x, 0, r.still.z); s.pos.set(r.sig.x, 0, r.sig.z) }
        W.__enemyLog.length = 0
        if (until(() => s.phase === 'windup', 2, pin) < 0) return { bad: 'no windup in 2 s' }
        W.__partLog.length = 0
        const hp0 = s.hp
        W.__fire('arms', ${pushed})
        const now = { phase: s.phase, reload: s.reload, interrupts: W.__partLog.filter((x) => x.kind === 'interrupt' && x.enemy === s).length, hurt: hp0 - s.hp }
        const h1 = s.hp
        if (${pushed}) s.hit(10)
        const reelHit = h1 - s.hp
        const again = until(() => s.phase === 'windup', 6, pin)
        return { ...now, calls: calls().length, again, reelHit, trains: W.__trains().length }
      })
    } finally { end() }`)
  for (const [label, rule, pushed] of [['break rule on, unpushed', true, false], ['break rule off (__breakRule(false))', false, false], ['break rule on, pushed', true, true]]) {
    const got = await one(label, rule, pushed)
    bad(got)
    assert(got.interrupts === 1 && got.hurt > 0, `${label}: ${got.interrupts} interrupt event(s), hurt ${got.hurt}`)
    assert(got.phase === (pushed ? 'recover' : 'approach'), `${label}: the Signalman is in ${got.phase} after the cast`)
    assert(got.calls === 0 && got.trains === 0, `${label}: it called anyway (${got.calls} call event(s), ${got.trains} train(s))`)
    assert(got.again >= 3.0 - 1 / 60 - 1e-9, `${label}: its next windup came ${got.again < 0 ? 'never' : got.again.toFixed(3) + ' s'} after the cast, under 3.0`)
    if (pushed) assert(Math.abs(got.reelHit - 15) < 1e-9, `${label}: a hit of 10 on the reeling Signalman took ${got.reelHit}, not 15`)
    console.log(`INFO K-E3: ${label}: back in ${got.phase}, next windup ${got.again.toFixed(2)} s later`)
  }
})

check('K-E4', LINE4, async ({ page }) => {
  const got = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 9 }, (r) => {
        const s = spawnSig(r)
        const pin = () => W.__still.pos.set(r.still.x, 0, r.still.z)
        W.__enemyLog.length = 0
        if (until(() => s.phase === 'windup', 2, pin) < 0) return { bad: 'no windup in 2 s' }
        tick(20, pin)
        s.hit(1e6)
        tick(120, pin)
        return { dead: s.dead, calls: calls().length, trains: W.__trains().length, gone: !C.enemies.includes(s), booked: C.book.entries.filter((b) => b.owner === s).length }
      })
    } finally { end() }`)
  bad(got)
  assert(got.dead && got.gone, 'the Signalman is not dead and gone')
  assert(got.calls === 0 && got.trains === 0, `killed in its windup, it still called (${got.calls} call event(s), ${got.trains} train(s))`)
  assert(got.booked === 0, `${got.booked} book entries still owned by the dead Signalman`)
})

check('K-E13', LINE4, async ({ page }) => {
  const rows = await inPage(page, `
    ${SIG_KIT}
    const rows = []
    for (let seed = 1; seed <= 20; seed++) {
      const end = begin(seed)
      try {
        W.__hold(true); W.__run.route = 'III'; W.__enter(4, seed)
        C.autoAttack = false; C.counters = false
        for (const e of C.enemies) e.counters = false
        const lvl = W.__level(), T = lvl.terrain
        const pi = lvl.packs.findIndex((pk) => pk.lesson && pk.members.some((m) => m.variant === 'signal'))
        if (pi < 0) { rows.push({ seed, bad: 'no lesson pack with a Signalman' }); continue }
        const pack = C.packs[pi]
        const sig = pack.members.find((e) => e.variant === 'signal')
        const home = { x: sig.pos.x, z: sig.pos.z }
        const lanes = W.__lanes()
        let still = null
        for (let a = 0; a < 360 && !still; a += 5) {
          const x = home.x + Math.cos(a * Math.PI / 180) * 12, z = home.z + Math.sin(a * Math.PI / 180) * 12
          if (!T.blocked(x, z, 0.5) && lanes.every((l) => dspan(x, z, l) >= 6)) still = { x, z }
        }
        if (!still) { rows.push({ seed, skipped: true }); continue }
        const pin = () => W.__still.pos.set(still.x, 0, still.z)
        pin()
        W.__stick(0, 0)
        C.wake(pack)
        W.__enemyLog.length = 0
        let expect = null, first = -1, quiet = false
        for (let i = 0; i < 6 * 60 && first < 0; i++) {
          C.hp = 100
          pin()
          const was = sig.phase
          W.__step(1 / 60)
          if (was !== 'windup' && sig.phase === 'windup') {
            const lit = C.line.lit(), st = C.line.lanes.filter((l) => !lit.includes(l) && dspan(sig.pos.x, sig.pos.z, l) > 1.2 + 0.45 + 1.0)
            st.sort((a, b) => dspan(home.x, home.z, a) - dspan(home.x, home.z, b))
            expect = st[0] ? st[0].id : null
            quiet = st[0] ? W.__lanes().find((l) => l.id === st[0].id).nextAt - W.__lineT() <= 4 : false
          }
          if (calls().length) first = i / 60
        }
        if (first < 0) { rows.push({ seed, bad: 'no call in 6 s (phase ' + sig.phase + ', reload ' + sig.reload + ', dist ' + dist(sig.pos, W.__still.pos).toFixed(1) + ')' }); continue }
        const ev = calls()[0].ev
        const reach = Math.min(...lanes.map((l) => dspan(still.x, still.z, l)))
        // then 15 s of the same geometry: an ordinary Signalman, and Still 6 u from every lane
        W.__enemyLog.length = 0
        for (let i = 0; i < 15 * 60; i++) { C.hp = 100; pin(); W.__step(1 / 60) }
        const again = calls().length
        rows.push({ seed, first, lane: ev.lane, expect, called: ev.called, quiet, reach, again, lessonLane: lanes.find((l) => l.id === ev.lane).lesson })
      } finally { end() }
    }
    return rows`)
  const ran = rows.filter((r) => !r.skipped && !r.bad)
  const bads = rows.filter((r) => r.bad)
  assert(bads.length === 0, bads.map((r) => `seed ${r.seed}: ${r.bad}`).join('; '))
  assert(ran.length >= 5, `only ${ran.length} of 20 seeds had a placement 12 u from the Signalman and 6 u from every lane: the check proves too little`)
  for (const r of ran) {
    assert(r.reach >= 6 - 1e-9, `seed ${r.seed}: Still was ${r.reach.toFixed(2)} u from a lane (want >= 6): laneReach would have failed the ordinary rule`)
    assert(r.lane === r.expect, `seed ${r.seed}: it called lane ${r.lane}, the one nearest its home is ${r.expect}`)
    assert(r.again === 0, `seed ${r.seed}: it called ${r.again} more time(s) in 15 s of the same geometry`)
  }
  console.log(`INFO K-E13: ${ran.length} of 20 seeds tested (${rows.filter((r) => r.skipped).length} without a placement); first call ${Math.min(...ran.map((r) => r.first)).toFixed(2)}-${Math.max(...ran.map((r) => r.first)).toFixed(2)} s after waking; ${ran.filter((r) => r.called).length} taken by the Line, ${ran.filter((r) => !r.called).length} refused (a train already on it); signalQuietS skipped on ${ran.filter((r) => r.quiet).length} of them`)
})

check('K-E14', LINE4, async ({ page }) => {
  // planted: 9 u off, the planted shot on (the hand can't reach), then the close strike on a Signalman 2 u away
  const planted = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 9 }, (r) => {
        const s = spawnSig(r)
        s.reload = 1e9
        s.hp = 500
        C.autoAttack = true
        C.eye = true
        const pin = () => W.__still.pos.set(r.still.x, 0, r.still.z)
        if (until(() => C.inStance, 2, pin) < 0) return { bad: 'never planted' }
        if (until(() => C.eyeTarget === s, 1, pin) < 0) return { bad: 'the eye never picked the Signalman (target ' + (C.eyeTarget ? C.eyeTarget.kind : 'none') + ')' }
        s.reload = 0
        const hp0 = s.hp
        W.__partLog.length = 0; W.__enemyLog.length = 0
        if (until(() => s.phase === 'windup', 1.5, pin) < 0) return { bad: 'no windup' }
        const auto = C.breakable(s, true), part = C.breakable(s)
        if (until(() => calls().length > 0, 1.2, pin) < 0) return { bad: 'no call: phase ' + s.phase }
        return { auto, part, lost: hp0 - s.hp, called: calls()[0].ev.called, interrupts: W.__partLog.filter((x) => x.kind === 'interrupt' && x.enemy === s).length }
      })
    } finally { end() }`)
  bad(planted)
  const close = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 2.0, sigSpan: 3.0 }, (r) => {
        const s = spawnSig(r)
        s.hp = 500
        C.autoAttack = true
        C.closeHand = true
        const pin = () => { W.__still.pos.set(r.still.x, 0, r.still.z); s.pos.set(r.sig.x, 0, r.sig.z) }
        const hp0 = s.hp
        W.__partLog.length = 0; W.__enemyLog.length = 0
        if (until(() => s.phase === 'windup', 2, pin) < 0) return { bad: 'no windup' }
        const auto = C.breakable(s, true), part = C.breakable(s)
        const hpAtWindup = s.hp
        if (until(() => calls().length > 0, 1.2, pin) < 0) return { bad: 'no call: phase ' + s.phase }
        return { auto, part, lost: hpAtWindup - s.hp, before: hp0 - hpAtWindup, called: calls()[0].ev.called, interrupts: W.__partLog.filter((x) => x.kind === 'interrupt' && x.enemy === s).length }
      })
    } finally { end() }`)
  bad(close)
  for (const [name, g] of [['planted shot', planted], ['close strike', close]]) {
    assert(g.auto === false && g.part === true, `${name}: breakable(e, true) ${g.auto}, breakable(e) ${g.part} in its windup (want false, true)`)
    assert(g.lost > 0, `${name}: the Signalman took no damage through its windup`)
    assert(g.interrupts === 0 && g.called === true, `${name}: interrupts ${g.interrupts}, call taken ${g.called}: the autos broke the call`)
  }
  console.log(`INFO K-E14: planted shot cost it ${planted.lost.toFixed(1)} hp through the windup, close strike ${close.lost.toFixed(1)} hp; both calls stood`)
})

check('K-E15', LINE4, async ({ page }) => {
  const got = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 9 }, (r) => {
        const s = spawnSig(r)
        const L = C.line.lanes.find((l) => l.id === r.lane.id)
        const pinStill = () => W.__still.pos.set(r.still.x, 0, r.still.z)
        const onSide = (d) => ({ x: r.mx - r.nx * d, z: r.mz - r.nz * d })
        const rows = []
        const at = (label, d, secs) => {
          if (s.phase === 'windup') s.interrupt(false)
          C.book.clear(); s.phase = 'approach'; s.reload = 0
          C.line.runOf(L).nextAt = C.line.t + 30
          const p = onSide(d)
          const t = until(() => s.phase === 'windup', secs, () => { pinStill(); s.pos.set(p.x, 0, p.z); s.reload = 0 })
          rows.push({ label, d, windup: t >= 0, at: t, calls: calls().length })
        }
        W.__enemyLog.length = 0
        at('on the lane', 0, 20)
        at('inside, 1.0 short', 2.15, 3)
        at('just inside the grown strip', 2.6, 3)
        at('just outside it', 2.7, 3)
        at('well clear', 4, 3)
        return { rows, span: 1.2 + 0.45 + 1.0 }
      })
    } finally { end() }`)
  bad(got)
  const want = { 'on the lane': false, 'inside, 1.0 short': false, 'just inside the grown strip': false, 'just outside it': true, 'well clear': true }
  for (const row of got.rows) assert(row.windup === want[row.label], `${row.label} (${row.d.toFixed(2)} u from the span, R2 line at ${got.span.toFixed(2)}): ${row.windup ? 'it wound up' : 'it never wound up'}, expected ${want[row.label] ? 'a windup' : 'none'}`)
  console.log(`INFO K-E15: R2 at ${got.span.toFixed(2)} u; ${got.rows.map((r) => `${r.d.toFixed(2)} u ${r.windup ? 'calls' : 'never calls'}`).join(', ')}`)
})

check('K-S2', LINE4, async ({ page }) => {
  const got = await inPage(page, `
    ${SIG_KIT}
    const end = begin(1)
    try {
      return withRig({ stillOff: 2, sigD: 9 }, (r) => {
        const s = spawnSig(r)
        const pin = () => W.__still.pos.set(r.still.x, 0, r.still.z)
        W.__heard.length = 0
        const before = W.__heard.map((h) => h.name)
        if (until(() => s.phase === 'windup', 2, pin) < 0) return { bad: 'no windup in 2 s' }
        const atWindup = W.__heard.map((h) => h.name)
        tick(70, pin)
        return { before, atWindup, after: W.__heard.map((h) => h.name), live: W.__heard.map((h) => h.live) }
      })
    } finally { end() }`)
  bad(got)
  assert(got.before.length === 0, `the heard log was not empty before the windup: ${got.before}`)
  assert(got.atWindup.filter((n) => n === 'semaphore').length === 1, `at its windup start the heard log is [${got.atWindup}], not one semaphore`)
  assert(!got.after.includes('aim'), `the heard log has aim: [${got.after}]`)
  console.log(`INFO K-S2: heard at its windup start: [${got.atWindup}] (live ${got.live}); headless, so nothing was audible`)
})

process.exit(await run(process.argv.slice(2)))
