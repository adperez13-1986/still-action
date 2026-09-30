/**
 * The bank ("follow-through") trial (design/autos/BUILD-1.md, 30 Sep): with its switch on, a part cast that fired banks 3 auto
 * beats (cap 6) and each auto beat that would fire spends one; an empty bank lets the beat pass. K-A1 (off is today's game) is
 * `node tools/checks/fights.mjs compare`, run beside this. Each check is one evaluate on the arena with the frame loop held,
 * except the taps of K-A7, which are real mouse presses on the real buttons.
 * `node tools/checks/autos.mjs [K-A2 ...]`.
 */
import { assert, assertEq, evalJson, suite } from './lib.mjs'

const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, run } = suite()

/**
 * In the page: a clean arena with Still's starting parts (lens on the head, vent on the torso, cleaver on the arms), the autos on,
 * and the trial's switch `on`. The bank is empty and every button ready.
 */
const SETUP = `(on) => {
  const W = window
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  for (const id of ['focusing-lens', 'pressure-vent', 'scrap-cleaver']) W.__equip(id)
  W.__hold(true)
  W.__arena()
  const C = W.__combat
  C.time = 0
  C.pressure = true
  C.counters = false
  C.breakRule = false
  C.autoAttack = true
  W.__stick(0, 0)
  W.__followThrough(on)
}`

/** In the page, after SETUP: the open depth's stats entry, and a copy of the numbers this check reads from it. */
const HELPERS = `
  const W = window
  const C = W.__combat
  const last = () => W.__run.stats[W.__run.stats.length - 1]
  const snap = () => JSON.parse(JSON.stringify(last()))
  /** One tick with Still and a pinned body where they were, whole: the body stays in reach and alive. */
  const tick = (pin) => { C.hp = 100; W.__still.pos.set(0, 0, 0); if (pin) { pin.pos.set(0, 0, 2); pin.knock.set(0, 0, 0) } W.__step(1 / 60) }
  /** A hulk in the hand's reach that no strike kills. */
  const anvil = () => { const e = W.__spawn('chaser', 0, 2, true); e.hp = 1e6; return e }
`

check('K-A2', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    const e = anvil()
    const a = snap()
    for (let i = 0; i < 300; i++) tick(e)
    const b = snap()
    // the control: the same five seconds with the switch off, where the autos are free
    W.__followThrough(false)
    for (let i = 0; i < 300; i++) tick(e)
    const c = snap()
    return { hand: b.hand - a.hand, real: b.autoDmgReal.hand - a.autoDmgReal.hand, bank: C.bank, empty: b.emptyBeats - a.emptyBeats, spent: b.bankBeats - a.bankBeats,
      freeHand: c.hand - b.hand, freeEmpty: c.emptyBeats - b.emptyBeats }
  }`)
  assertEq('no press, five seconds in reach: strikes', got.hand, 0)
  assertEq('no press: auto damage dealt', got.real, 0)
  assertEq('no press: beats spent', got.spent, 0)
  assert(got.empty > 0, `no press: emptyBeats should be above 0, got ${got.empty}`)
  assert(got.freeHand >= 5, `the control (switch off, same five seconds) should strike freely, got ${got.freeHand}`)
  assertEq('the control counts no empty beats', got.freeEmpty, 0)
})

check('K-A3', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    const e = anvil()
    const a = snap()
    W.__fire('arms')
    const afterPress = C.bank
    for (let i = 0; i < 360; i++) tick(e)
    const b = snap()
    return { afterPress, hand: b.hand - a.hand, real: b.autoDmgReal.hand - a.autoDmgReal.hand, spent: b.bankBeats - a.bankBeats, empty: b.emptyBeats - a.emptyBeats, bank: C.bank }
  }`)
  assertEq('one press banks 3', got.afterPress, 3)
  assertEq('one press, then nothing for six seconds: auto strikes', got.hand, 3)
  assertEq('their damage (10 a strike)', got.real, 30)
  assertEq('beats that spent', got.spent, 3)
  assert(got.empty > 0, `the beats after the third should be empty ones, got ${got.empty}`)
  assertEq('the bank ends empty', got.bank, 0)
})

check('K-A4', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    anvil()
    // three casts in one instant, three different buttons
    const banks = []
    for (const slot of ['head', 'torso', 'arms']) { W.__fire(slot); banks.push(C.bank) }
    return { banks, ready: ['head', 'torso', 'arms'].map((s) => W.__hud.isReady(s)) }
  }`)
  assertEq('all three casts fired', got.ready, [false, false, false])
  assertEq('the bank after each of three casts (3 + 3 + 3 would be 9)', got.banks, [3, 6, 6])
})

check('K-A5', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    W.__equip('plumb-line')
    anvil()
    const out = {}
    // a ready press
    W.__fire('arms')
    out.cast = C.bank
    // a push: a pushed cast on the cooling button
    C.bank = 0
    const p0 = last().pushes
    W.__fire('arms', true)
    out.push = C.bank
    out.pushes = last().pushes - p0
    // a dead tap: a tap on a cooling button does nothing
    C.bank = 0
    W.__fire('arms', false)
    out.dead = C.bank
    // a refused press: the anchor planted, then the snap out of its range
    C.bank = 0
    W.__fire('legs')
    out.plant = C.bank
    W.__still.pos.set(12, 0, 0)
    W.__fire('legs')
    out.refused = C.bank
    out.anchor = !!C.parts.anchor
    return out
  }`)
  assertEq('a ready press adds 3', got.cast, 3)
  assertEq('a push adds 3', got.push, 3)
  assertEq('the push was a push', got.pushes, 1)
  assertEq('a dead tap adds 0', got.dead, 0)
  assertEq('a planted anchor is a cast: adds 3', got.plant, 3)
  assert(got.anchor, 'the refused snap left the anchor where it was')
  assertEq('a refused press adds 0 (still 3 after the snap was denied)', got.refused, 3)
})

check('K-A6', RUN, async ({ page }) => {
  const got = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    const e = W.__spawn('chaser', 0, 2, true)
    const q0 = last().quiets
    W.__fire('arms')
    let t = W.__until(() => { C.hp = 100; return C.enemies.length === 0 }, 10)
    const atKill = C.bank
    const killed = W.__run.killed
    const fought = W.__run.fought
    // the quiet comes 2.5 s after the last awake body is gone
    const quietAt = W.__until(() => { C.hp = 100; return last().quiets > q0 }, 6)
    return { felled: t >= 0, atKill, killed, fought, quietAt, afterQuiet: C.bank, quiets: last().quiets - q0 }
  }`)
  assert(got.felled, 'the hulk never died')
  assert(got.killed && got.fought, 'the kill was not a fight to quiet')
  assert(got.atKill > 0, `the bank at the fight's last kill should be above 0, got ${got.atKill}`)
  assert(got.quietAt >= 0, 'the quiet never came')
  assertEq('quiets', got.quiets, 1)
  assertEq('the bank after the quiet', got.afterQuiet, 0)
})

check('K-A7', RUN, async ({ page }) => {
  // the fields, with the switch on and off, as the playtest file reads them (statsOut)
  const fields = await evalJson(page, `() => {
    const W = window
    const shape = () => {
      const s = W.__runStats().at(-1)
      const n = (v) => typeof v === 'number' && Number.isFinite(v)
      return {
        followThrough: typeof s.followThrough === 'boolean',
        autoDmgReal: !!s.autoDmgReal && n(s.autoDmgReal.hand) && n(s.autoDmgReal.eye),
        autoDmg: !!s.autoDmg && n(s.autoDmg.hand) && n(s.autoDmg.eye),
        kills: !!s.kills && n(s.kills.part) && n(s.kills.auto) && n(s.kills.other),
        fightS: n(s.fightS), bankBeats: n(s.bankBeats), emptyBeats: n(s.emptyBeats),
      }
    }
    const out = {}
    ;(${SETUP})(true)
    out.on = shape()
    ;(${SETUP})(false)
    out.off = shape()
    return out
  }`)
  for (const sw of ['on', 'off']) {
    for (const [k, ok] of Object.entries(fields[sw])) assert(ok, `switch ${sw}: the depth's stats have no good ${k}`)
  }

  // a boss takes half of what the autos nominally deal; a hulk takes all of it
  const boss = await evalJson(page, `() => {
    (${SETUP})(false)
    ${HELPERS}
    // the autos free (switch off), and the same strikes counted two ways
    const hulk = anvil()
    const h0 = snap()
    for (let i = 0; i < 180; i++) tick(hulk)
    const h1 = snap()
    hulk.dead = true
    W.__step(0.1)
    W.__arena()
    C.autoAttack = true
    const b0 = snap()
    const boss = W.__spawn('boss', 0, 4, true)
    boss.hp = boss.maxHp = 1e6
    for (let i = 0; i < 240; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); boss.pos.set(0, 0, 4); boss.knock.set(0, 0, 0); W.__step(1 / 60) }
    const b1 = snap()
    // the eye: Still rests 8 u off a boss, out of the hand's reach, and the planted shot does the striking
    W.__arena()
    C.autoAttack = true
    const e0 = snap()
    const far = W.__spawn('boss', 0, 8, true)
    far.hp = far.maxHp = 1e6
    for (let i = 0; i < 240; i++) { C.hp = 100; W.__still.pos.set(0, 0, 0); far.pos.set(0, 0, 8); far.knock.set(0, 0, 0); W.__step(1 / 60) }
    const e1 = snap()
    return {
      lance: { nominal: e1.autoDmg.eye - e0.autoDmg.eye, real: e1.autoDmgReal.eye - e0.autoDmgReal.eye, hand: e1.hand - e0.hand, eye: e1.eye - e0.eye },
      hulk: { hand: h1.hand - h0.hand, nominal: h1.autoDmg.hand - h0.autoDmg.hand, real: h1.autoDmgReal.hand - h0.autoDmgReal.hand },
      boss: {
        hand: b1.hand - b0.hand, nominal: b1.autoDmg.hand - b0.autoDmg.hand, real: b1.autoDmgReal.hand - b0.autoDmgReal.hand,
      },
    }
  }`)
  assert(boss.hulk.hand >= 3, `the hulk should have taken strikes, got ${boss.hulk.hand}`)
  assertEq('a hulk takes the autos whole: real == nominal', boss.hulk.real, boss.hulk.nominal)
  assert(boss.boss.hand >= 3, `the boss should have taken strikes, got ${boss.boss.hand}`)
  assert(boss.boss.nominal > 0, 'the nominal autoDmg.hand stays as it was (HAND.damage a strike)')
  assertEq('on a boss, autoDmgReal.hand is half the nominal', boss.boss.real, boss.boss.nominal * 0.5)
  assert(boss.lance.eye >= 3 && boss.lance.nominal > 0, `the planted shot should have struck the boss, got ${boss.lance.eye} lances`)
  assertEq('on a boss, the lance deals no hand strikes', boss.lance.hand, 0)
  assertEq('on a boss, autoDmgReal.eye is half the nominal', boss.lance.real, boss.lance.nominal * 0.5)

  // who dealt the killing blows: one by an auto, two by a part (the vent), one by anything else; the sum is the bodies that died
  const kills = await evalJson(page, `() => {
    (${SETUP})(true)
    ${HELPERS}
    const k0 = snap().kills
    // the auto: a hulk with exactly one strike left, and a banked beat to spend
    const a = W.__spawn('chaser', 0, 2, true)
    a.hp = 5
    C.bank = 3
    for (let i = 0; i < 40 && !a.dead; i++) tick(a)
    W.__step(0.1)
    // the part: two hulks the vent's nova finishes
    C.bank = 0
    const b = W.__spawn('chaser', 0, 3, true)
    const c = W.__spawn('chaser', 1, 1.5, true)
    b.hp = 1
    c.hp = 5
    W.__hud.resetLoadout(W.__hud.loadout)
    W.__fire('torso')
    W.__step(0.1)
    // anything else: a body that dies with no blow from Still
    const d = W.__spawn('chaser', 4, 4, true)
    d.dead = true
    W.__step(0.1)
    const k1 = snap().kills
    return { auto: k1.auto - k0.auto, part: k1.part - k0.part, other: k1.other - k0.other, left: C.enemies.length, died: [a, b, c, d].map((e) => e.dead) }
  }`)
  assertEq('four bodies died', kills.died, [true, true, true, true])
  assertEq('none left standing', kills.left, 0)
  assertEq('killing blows by an auto', kills.auto, 1)
  assertEq('killing blows by a part', kills.part, 2)
  assertEq('killing blows by anything else', kills.other, 1)
  assertEq('kills sum to the bodies that died', kills.auto + kills.part + kills.other, 4)
})

check('K-A7', RUN, async ({ page }) => {
  // leftMs: real presses on the real buttons. A ready one logs 0, a tap thrown at the cooling one logs what was left.
  await evalJson(page, `() => {
    (${SETUP})(true)
    window.__hold(false)
    window.__run.taps.length = 0
  }`)
  const button = page.locator('.btn:has(.lbl[aria-label="A"])')
  const box = await button.boundingBox()
  assert(box, 'the arms button is not on screen')
  const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const tap = async () => {
    await page.mouse.move(at.x, at.y)
    await page.mouse.down()
    await page.waitForTimeout(60)
    await page.mouse.up()
  }
  await tap()
  await page.waitForTimeout(150)
  await tap()
  await page.waitForTimeout(100)
  const taps = await evalJson(page, () => {
    window.__hold(true)
    return { taps: window.__taps().filter((t) => t.slot === 'arms'), bank: window.__combat.bank }
  })
  assertEq('two presses logged', taps.taps.length, 2)
  assertEq('the press on a ready button: leftMs', taps.taps[0].leftMs, 0)
  assertEq('the press on a ready button: result', taps.taps[0].result, 'cast')
  assert(taps.taps[1].leftMs > 0 && taps.taps[1].leftMs <= 2600, `the tap on the cooling button should log what was left (0..2600), got ${taps.taps[1].leftMs}`)
  assertEq('the tap on the cooling button: result', taps.taps[1].result, 'dead')
  assertEq('a real ready press banked 3 and the dead tap added nothing', taps.bank, 3)
})

check('K-A8', RUN, async ({ page }) => {
  const got = await evalJson(page, `async () => {
    ${HELPERS}
    const { EYE } = await import('/src/partmodels.ts')
    const eyeSum = () => EYE.color.r + EYE.color.g + EYE.color.b
    const out = {}
    for (const on of [true, false]) {
      (${SETUP})(on)
      C.autoAttack = false
      // a fight: the dim is only ever the fight's
      const e = anvil()
      for (let i = 0; i < 60; i++) tick(e)
      const empty = W.__coreLight()
      const emptyEye = eyeSum()
      W.__fire('arms')
      const justAfter = (tick(e), W.__coreLight())
      for (let i = 0; i < 30; i++) tick(e)
      const banked = W.__coreLight()
      const bankedEye = eyeSum()
      out[on ? 'on' : 'off'] = { bank: C.bank, empty, banked, justAfter, emptyEye, bankedEye }
    }
    return out
  }`)
  const { on, off } = got
  assert(on.bank > 0 && on.empty > 0, 'switch on: the bank should be banked, the core lit')
  assert(on.banked > on.empty * 1.5, `switch on: the core's light should be clearly lower with the bank empty (${on.empty}) than banked (${on.banked})`)
  assert(on.justAfter > on.empty && on.justAfter < on.banked, `switch on: the light eases back up, not a jump (${on.empty} < ${on.justAfter} < ${on.banked})`)
  assertEq('switch off: the core is the eye, bank empty', Math.abs(off.empty - off.emptyEye) < 1e-9, true)
  assertEq('switch off: the core is the eye, after a cast', Math.abs(off.banked - off.bankedEye) < 1e-9, true)
  assertEq('switch off: the core never changes with a cast', Math.abs(off.banked - off.empty) < 1e-9, true)
})

// the dim is the fight's alone: bank empty with nothing awake near (a corridor after the quiet), the core stays lit
check('K-A9', RUN, async ({ page }) => {
  const got = await evalJson(page, `async () => {
    ${HELPERS}
    const { EYE } = await import('/src/partmodels.ts')
    const eyeSum = () => EYE.color.r + EYE.color.g + EYE.color.b
    ;(${SETUP})(true)
    C.autoAttack = false
    for (let i = 0; i < 60; i++) tick(null)
    const alone = { bank: C.bank, core: W.__coreLight(), eye: eyeSum() }
    // a body past FIGHT_NEAR is no fight either
    const far = W.__spawn('chaser', 0, 12, true)
    far.hp = 1e6
    for (let i = 0; i < 60; i++) { tick(null); far.pos.set(0, 0, 12); far.knock.set(0, 0, 0) }
    return { alone, far: { core: W.__coreLight(), eye: eyeSum() } }
  }`)
  assertEq('switch on, nothing near: the bank is empty', got.alone.bank, 0)
  assertEq('switch on, bank empty, nothing near: the core is the eye', Math.abs(got.alone.core - got.alone.eye) < 1e-9, true)
  assertEq('switch on, bank empty, a body at 12 u: the core is the eye', Math.abs(got.far.core - got.far.eye) < 1e-9, true)
})

process.exit(await run(process.argv.slice(2)))
