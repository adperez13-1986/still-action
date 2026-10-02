// Build-layer sim (balancer, rounds 1-3). node design/buildlayer/build-sim.mjs [fight|pool|all|r2|r3|r3m|r3f] [runs]
// Round 3 (3-balancer.md, part D at the bottom): r3 = BUILD.md's cores, parts, keystones and upgrades; r3m = each fitting part alone in its slot;
// r3f = the never-melt floor. BUILD.md's numbers by default; TUNE3=prop = what 3-balancer.md ships. RAMPACK=1 CORES=ram: Ram's pack build.
// No deps, seeded. Two parts:
//   A. FIGHT: what a chain is worth against a generic part, on packs (early, deep), a heavy pack and a boss.
//      Engine in the shape of design/lean/lean-sim.mjs (cooldowns, hesitation, beats, overkill not counted),
//      plus marks: a drive (the auto that replaces the hand + eye) leaves marks on bodies; cashier parts spend
//      them for flat damage per mark (rule 3: added, never multiplied); feeder parts add marks; a cash kill
//      spills its unused bonus to the next body. No geometry, no damage taken: uptime numbers stand in for it.
//   B. POOL: the offer stream of a 9-depth run (pedestals, floor, elites, the gift, Plenty) against a pool,
//      for a committed chooser, a tier chooser (ignores links) and a random picker. Formation at d3 / d6,
//      keystone sightings, take rates per part and per slot, "done" (nothing left to want) by d6.
// Every name here is a PLACEHOLDER.
//
// Dials (env): TUNE=first|proposed (default proposed: the numbers 1-balancer.md argues for), SHORT=1 (fewer rows),
//   KSCALE, CASH_TAX, CASH_CD, FEED_TAX, FEED_N, BURST (fight); FLOOR, RARE_P, GIFT_KEY, MATCHES=0,0.5,
//   MATCH_WHERE=rare|all (the drive match at the gift and Plenty only, or at every pedestal set), POOLS=trial,full (pool).
// Both halves at defaults take ~1 min: node design/buildlayer/build-sim.mjs all 8000

const MODE = process.argv[2] ?? 'all'
const RUNS = Number(process.argv[3] ?? 20000)
let seed = 11
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pct = (x) => `${Math.round(x * 100)}%`
const exp = (m) => -Math.log(1 - rng()) * m

// ------------------------------------------------------------------ A. FIGHT
const BEAT = 0.62, DT = 0.02, HESIT = 1.8 // a median player: mean wait after ready (floor 3.7, investor 1.3)
// Drives. up = share of beats it connects (its position held); pick = who it hits; cap/life = marks per body, seconds.
// K = flat damage a cashier adds per mark spent.
const DRIVES = {
  old:    { name: 'today: hand + eye', marks: false },
  strike: { name: 'Strike (in reach, faces one)', dmg: 10, up: 0.70, pick: 'focus', cap: 3, life: 3, K: 8 },
  sight:  { name: 'Sight (planted, far, a line)', dmg: 9, up: 0.50, pick: 'line', cap: 2, life: 4, K: 11 },
  wake:   { name: 'Wake (moving, brushes many)', dmg: 4, up: 0.80, pick: 'brush', p: 0.5, cap: 3, life: 3, K: 5 },
  tether: { name: 'Tether (holds one at 3-6 u)', dmg: 10, up: 0.65, pick: 'focus', cap: 5, life: 2, K: 5 },
}
// TUNE=first: the numbers above with KSCALE 1, CASH_CD 1. TUNE=proposed (default): what this file argues for.
// One-body drives carry their marks on a kill (the next body starts marked), or their chains are boss-only.
const TUNE = process.env.TUNE ?? 'proposed'
if (TUNE === 'proposed') {
  Object.assign(DRIVES.strike, { K: 10, carry: true })
  Object.assign(DRIVES.sight, { K: 14 })
  Object.assign(DRIVES.wake, { K: 6 })
  Object.assign(DRIVES.tether, { K: 7, carry: true })
}
const TEMPER = { today: { dmg: [1, 1.3, 1.6], cd: [1, 0.85, 0.72] }, flat: { dmg: [1, 1.15, 1.3], cd: [1, 0.92, 0.85] } }
// Parts as weighed today (weight preset B): Focusing Lens 26x1.2, Pressure Vent 15x1.8 (radius x1.4), Scrap Cleaver
// 18x1.2 (180 deg), Kickstart 12x1.8 (width x2). hits: back = the bolt's priority target; all = each body w.p. p;
// arc = nearest + p2 + p3. role: cash (spends marks, x0.8 own damage), feed (adds a mark to each body hit, x0.6),
// pair-set / pair-pay = the old button-to-button chill pair (Chill Vent sets, Cleaver pays x2 used up).
const P = {
  lens: { slot: 'head', dmg: 31, cd: 4.2, hits: 'back' },
  vent: { slot: 'torso', dmg: 27, cd: 6.5, hits: 'all', p: 0.95 },
  cleaver: { slot: 'arms', dmg: 22, cd: 2.6, hits: 'arc', p2: 0.9, p3: 0.45 },
  kick: { slot: 'legs', dmg: 22, cd: 8, hits: 'all', p: 0.7 },
}
// The price of a link (env to sweep): a cashier keeps CASH_TAX of the white's damage, a feeder FEED_TAX and adds FEED_N marks.
const CASH_TAX = Number(process.env.CASH_TAX ?? 0.9), FEED_TAX = Number(process.env.FEED_TAX ?? (TUNE === 'proposed' ? 1 : 0.85)), FEED_N = Number(process.env.FEED_N ?? 1)
const BURST = Number(process.env.BURST ?? 0.6)
const KSCALE = Number(process.env.KSCALE ?? 1), CASH_CD = Number(process.env.CASH_CD ?? (TUNE === 'proposed' ? 0.75 : 1))
const cash = (b) => ({ ...P[b], dmg: P[b].dmg * CASH_TAX, cd: P[b].cd * CASH_CD, role: 'cash' })
const feed = (b) => ({ ...P[b], dmg: P[b].dmg * FEED_TAX, role: 'feed' })
const chillVent = { slot: 'torso', dmg: 18, cd: 6.5, hits: 'all', p: 0.95, role: 'pair-set' }
const payCleaver = { ...P.cleaver, role: 'pair-pay' }

function fight(drive, parts, opt) {
  const D = DRIVES[drive], boss = opt.kind === 'boss'
  const hps = boss ? [1170] : opt.kind === 'early' ? [42, 42, 42, 28] : opt.kind === 'heavy' ? [120, 64, 64, 64] : [64, 64, 64, 64, 43]
  const bodies = hps.map((hp, i) => ({ hp, back: !boss && i === hps.length - 1, m: 0, mt: 0, chill: 0, dead: false }))
  const cap = D.cap ? D.cap + (opt.deep ? 2 : 0) : 0
  const T = TEMPER[opt.temper ?? 'today']
  const ps = parts.map((p) => { const r = p.rank ?? 0; return { ...p, dmg: p.dmg * T.dmg[r], cd: p.cd * T.cd[r], t: rng() * p.cd, wait: -1, held: 0 } })
  const st = { t: 0, auto: 0, part: 0, bonus: 0, made: 0, spent: 0 }
  const alive = () => bodies.filter((b) => !b.dead)
  const mark = (b, n = 1) => { if (!cap || b.dead) return; const add = Math.min(n, cap - b.m); st.made += Math.max(0, add); b.m += Math.max(0, add); b.mt = D.life }
  const die = (b) => {
    b.dead = true
    if ((opt.carry || D.carry) && b.m > 0) { const n = alive()[0]; if (n) mark(n, b.m) }
  }
  const hurt = (b, d, src, bonus = 0) => {
    if (b.dead) return
    const total = d + bonus, dealt = Math.min(b.hp, total)
    st[src] += dealt; if (bonus) st.bonus += Math.max(0, dealt - Math.min(b.hp, d))
    const over = total - b.hp
    b.hp -= total
    if (b.hp <= 0) {
      die(b)
      const spill = Math.min(bonus, over) // a cash kill passes its unused bonus on, never its own damage
      if (spill > 0) { const n = alive()[0]; if (n) { const x = Math.min(n.hp, spill); n.hp -= spill; st.part += x; st.bonus += x; if (n.hp <= 0) die(n) } }
    }
  }
  const strike = (p, b) => {
    let bonus = 0, d = p.dmg
    if (p.role === 'cash' && b.m > 0) { bonus = opt.x2 ? (opt.x2base ? d / T.dmg[p.rank ?? 0] : d) : b.m * D.K * KSCALE; st.spent += b.m; b.m = 0 } // x2: today's STATE rule (x2, used up)
    if (p.role === 'pair-pay' && b.chill > 0) { d *= 2; b.chill = 0 }
    hurt(b, d, 'part', bonus)
    // echo key: a cash hit also spends the marks of the most-marked other body (bonus only, never the part's own damage)
    if (opt.echo && p.role === 'cash' && bonus) { const o = alive().filter((x) => x !== b && x.m > 0).sort((x, y) => y.m - x.m)[0]; if (o) { const eb = o.m * D.K * KSCALE; st.spent += o.m; o.m = 0; hurt(o, 0, 'part', eb) } }
    if (p.role === 'feed') mark(b, FEED_N)
    if (p.role === 'pair-set') b.chill = 4
  }
  let t = 0, beat = rng() * BEAT
  while (alive().length && t < (boss ? 300 : 60)) {
    t += DT
    for (const b of bodies) if (b.m > 0 && (b.mt -= DT) <= 0) b.m = 0
    for (const b of bodies) if (b.chill > 0) b.chill -= DT
    for (const p of ps) {
      p.t -= DT
      if (p.t <= 0 && p.wait < 0) p.wait = exp(HESIT)
      if (p.wait < 0) continue
      p.wait -= DT
      if (p.wait > 0) continue
      // a cashier with no marked body holds up to 1 s for one, then casts anyway
      if (p.role === 'cash' && !alive().some((b) => b.m > 0) && p.held < 1) { p.held += DT; p.wait = 0; continue }
      p.wait = -1; p.held = 0; p.t = p.cd
      let a = alive(); if (!a.length) break
      if (p.role === 'cash' && p.hits !== 'all') a = [...a].sort((x, y) => y.m - x.m)
      if (p.hits === 'back') strike(p, p.role === 'cash' ? a[0] : a.find((x) => x.back) ?? a[0])
      else if (p.hits === 'arc') { strike(p, a[0]); if (a[1] && rng() < p.p2) strike(p, a[1]); if (a[2] && rng() < p.p3) strike(p, a[2]) }
      else for (const b of a) if (rng() < p.p) strike(p, b)
    }
    if ((beat -= DT) <= 0) {
      beat = BEAT
      const a = alive(); if (!a.length) break
      const am = boss ? 0.5 : 1 // bosses take half from the autos (BOSS_AUTO_MUL)
      if (D.marks === false) { // today's hand (p .7, 10) and eye (p .25, 8, a second body .3)
        const r = rng()
        if (r < 0.7) hurt(a[0], 10 * am, 'auto')
        else if (r < 0.95) { const c = [...a.filter((b) => b.back), ...a.filter((b) => !b.back)]; hurt(c[0], 8 * am, 'auto'); if (c[1] && rng() < 0.3) hurt(c[1], 8 * am, 'auto') }
        continue
      }
      if (rng() > D.up) continue
      const hit = D.pick === 'focus' ? [a[0]] : D.pick === 'line' ? [a[0], ...(a[1] && rng() < 0.5 ? [a[1]] : []), ...(a[2] && rng() < 0.2 ? [a[2]] : [])]
        : a.filter(() => rng() < D.p)
      for (const b of hit) {
        hurt(b, D.dmg * am, 'auto'); mark(b)
        // burst key: a drive hit that fills a body to its cap spends them at once, at BURST of a cashier's rate (a spender at beat speed)
        if (opt.burst && !b.dead && b.m >= cap) { const eb = b.m * D.K * KSCALE * BURST; st.spent += b.m; b.m = 0; hurt(b, 0, 'part', eb) }
      }
    }
  }
  st.t = t
  return st
}
function measure(drive, parts, opt, n) {
  n = n ?? (opt.kind === 'boss' ? 400 : 3000)
  const acc = { t: 0, auto: 0, part: 0, bonus: 0, made: 0, spent: 0 }
  for (let i = 0; i < n; i++) { const s = fight(drive, parts, opt); for (const k in acc) acc[k] += s[k] }
  for (const k in acc) acc[k] /= n
  return acc
}

// Each drive's natural chain: where its cashiers and feeder sit (a single-target drive cashes with single-target
// parts; a drive that marks many cashes with the blast). c1 = one cashier, c2 = cashier + feeder, c3 = two cashiers + feeder.
const CHAINS = {
  strike: { c1: ['lens', 'vent', 'C:cleaver', 'kick'], c2: ['lens', 'F:vent', 'C:cleaver', 'kick'], c3: ['C:lens', 'F:vent', 'C:cleaver', 'kick'] },
  sight: { c1: ['C:lens', 'vent', 'cleaver', 'kick'], c2: ['C:lens', 'F:vent', 'cleaver', 'kick'], c3: ['C:lens', 'F:vent', 'cleaver', 'C:kick'] },
  wake: { c1: ['lens', 'C:vent', 'cleaver', 'kick'], c2: ['lens', 'C:vent', 'cleaver', 'F:kick'], c3: ['lens', 'C:vent', 'C:cleaver', 'F:kick'] },
  tether: { c1: ['lens', 'vent', 'C:cleaver', 'kick'], c2: ['C:lens', 'vent', 'C:cleaver', 'kick'], c3: ['C:lens', 'F:vent', 'C:cleaver', 'kick'] },
}
const build = (ids, rank = 0) => ids.map((x) => { const [k, b] = x.includes(':') ? x.split(':') : ['', x]; const p = k === 'C' ? cash(b) : k === 'F' ? feed(b) : { ...P[b] }; return { ...p, rank: p.rank ?? rank } })

function partA() {
  const W = [P.lens, P.vent, P.cleaver, P.kick]
  const kinds = ['early', 'deep', 'heavy', 'boss']
  const N = { early: 2000, deep: 2000, heavy: 2000, boss: 300 }
  console.log(`A. FIGHT. Median player (hesitation ${HESIT} s). cashier keeps ${CASH_TAX}, feeder ${FEED_TAX} (+${FEED_N} mark).`)
  console.log('   Cells: DPS vs the 4-whites row of that drive (+%). early = 4 bodies 42/42/42/28 (d1-2); deep = 5 x 64/43 (d5);')
  console.log('   heavy = 120 leader + 3 x 64; boss = 1170. bonus = share of all damage that came from spent marks (spill included).\n')
  const cell = (dk, parts, o, base) => kinds.map((k) => { const m = measure(dk, parts, { ...o, kind: k }, N[k]); return { k, m, g: base ? base[k] / m.t - 1 : 0 } })
  const fmt = (cs) => cs.map(({ k, g }) => `${k} ${g >= 0 ? '+' : ''}${Math.round(g * 100)}%`.padEnd(13)).join('')
  const out = {}
  for (const dk of ['strike', 'sight', 'wake', 'tether']) {
    const C = CHAINS[dk]
    const base = {}; for (const k of kinds) base[k] = measure(dk, W, { kind: k }, N[k]).t
    const rows = [
      ['one white melted to III (today)', [P.lens, P.vent, { ...P.cleaver, rank: 2 }, P.kick], {}],
      ['one white melted to III (flat)', [P.lens, P.vent, { ...P.cleaver, rank: 2 }, P.kick], { temper: 'flat' }],
      ['all four III (today)', W.map((p) => ({ ...p, rank: 2 })), {}],
      ['all four III (flat)', W.map((p) => ({ ...p, rank: 2 })), { temper: 'flat' }],
      ['c1: one cashier', build(C.c1), {}],
      ['c2: cashier + feeder', build(C.c2), {}],
      ['c3: two cashiers + feeder', build(C.c3), {}],
      ['c3 + carry key (marks pass on a kill)', build(C.c3), { carry: true }],
      ['c3 + deep key (cap +2)', build(C.c3), { deep: true }],
      ['c3 + echo key (a cash spends two bodies)', build(C.c3), { echo: true }],
      ['c3 + burst key (the drive spends at cap)', build(C.c3), { burst: true }],
      ['c1 + burst key', build(C.c1), { burst: true }],
      ['c3 all at II (flat)', build(C.c3, 1), { temper: 'flat' }],
      ['c3 all at III (flat)', build(C.c3, 2), { temper: 'flat' }],
    ].filter((r) => !process.env.SHORT || ['all four III (flat)', 'c1: one cashier', 'c2: cashier + feeder', 'c3: two cashiers + feeder', 'c3 + echo key (a cash spends two bodies)', 'c3 + burst key (the drive spends at cap)', 'c1 + burst key'].includes(r[0]))
    console.log(`  ${DRIVES[dk].name}   (whites: early ${base.early.toFixed(1)} s, deep ${base.deep.toFixed(1)} s, heavy ${base.heavy.toFixed(1)} s, boss ${base.boss.toFixed(0)} s)`)
    out[dk] = {}
    for (const [name, parts, o] of rows) {
      const cs = cell(dk, parts, o, base), dm = cs[1].m
      out[dk][name] = cs
      console.log(`    ${name.padEnd(40)} ${fmt(cs)} deep marks made ${dm.made.toFixed(1)} spent ${dm.spent.toFixed(1)}, bonus ${pct(dm.bonus / (dm.part + dm.auto))}`)
    }
    // off-build: the same chain worn with a drive that leaves none of its marks
    const off = cell('old', build(C.c3), {}, (() => { const b = {}; for (const k of kinds) b[k] = measure('old', W, { kind: k }, N[k]).t; return b })())
    console.log(`    ${'c3 worn off-build (no marks)'.padEnd(40)} ${fmt(off)}`)
  }
  console.log('\n  The old button-to-button pair (today\'s hand + eye; Chill Vent sets, Scrap Cleaver pays x2 used up):')
  const ob = {}; for (const k of kinds) ob[k] = measure('old', W, { kind: k }, N[k]).t
  console.log(`    ${'old chill pair'.padEnd(40)} ${fmt(cell('old', [P.lens, chillVent, payCleaver, P.kick], {}, ob))}`)
  console.log(`    ${'today\'s autos vs a drive (whites)'.padEnd(40)} early ${ob.early.toFixed(1)} s, deep ${ob.deep.toFixed(1)} s, boss ${ob.boss.toFixed(0)} s`)
  return out
}

// ------------------------------------------------------------------ B. POOL
// A pool: parts with slot, drive (null = neutral, [a,b] = bridge), role (cash | feed | guard | key), rare (keystones).
const SLOTS = ['head', 'torso', 'arms', 'legs']
function makePool(drives, per, bridges, neutral) {
  const pool = []
  // per drive: cash in head/arms/legs, feed in torso/legs, guard in torso, two keys (arms, torso): every slot linked
  const layout = { cash: ['head', 'arms', 'legs', 'head'], feed: ['torso', 'legs', 'head'], guard: ['torso', 'arms'], key: ['arms', 'torso', 'head'] }
  for (const d of drives) for (const role of ['cash', 'feed', 'guard', 'key']) for (let i = 0; i < per[role]; i++)
    pool.push({ id: `${d}-${role}${i}`, drive: [d], role, slot: layout[role][i % layout[role].length], rare: role === 'key' })
  for (let i = 0; i < bridges; i++) pool.push({ id: `bridge${i}`, drive: [drives[i % drives.length], drives[(i + 1) % drives.length]], role: 'cash', slot: SLOTS[(i + 2) % 4], rare: false })
  for (let i = 0; i < neutral; i++) pool.push({ id: `neutral${i}`, drive: [], role: 'plain', slot: SLOTS[i % 4], rare: i % 5 === 4 })
  return pool
}
const POOLS = {
  'trial: 30 parts, 2 drives x (6 + 2 keys), 14 plain': () => makePool(['A', 'B'], { cash: 3, feed: 2, guard: 1, key: 2 }, 0, 14),
  'trial, 1 key per drive': () => makePool(['A', 'B'], { cash: 3, feed: 2, guard: 1, key: 1 }, 0, 16),
  'full: 40 parts, 4 drives x (6 + 2 keys), 4 bridges, 4 plain': () => makePool(['A', 'B', 'C', 'D'], { cash: 3, feed: 2, guard: 1, key: 2 }, 4, 4),
  'full, small: 32 parts, 4 drives x (5 + 2 keys), 4 bridges': () => makePool(['A', 'B', 'C', 'D'], { cash: 2, feed: 2, guard: 1, key: 2 }, 4, 0),
  'full, big: 48 parts, 4 drives x (8 + 2 keys), 4 bridges, 4 plain': () => makePool(['A', 'B', 'C', 'D'], { cash: 4, feed: 3, guard: 1, key: 2 }, 4, 4),
  // round 2: the others' shapes. verifier: 2 loops x (4 payers + 3 setters), 2 bridges, 14 unlooped, no keystones.
  'verifier: 30 parts, 2 loops x (4 pay + 3 set), 2 bridges, 14 plain': () => makePool(['A', 'B'], { cash: 4, feed: 3, guard: 0, key: 0 }, 2, 14),
  // translator: 3 cores x (3 cash + 2 cover + 1 move), 6 bridges (each fits two cores), 6 plain, no keystones.
  'translator: 30 parts, 3 cores x (3 cash + 2 cover + 1 move), 6 bridges, 6 plain': () => makePool(['A', 'B', 'C'], { cash: 3, feed: 2, guard: 1, key: 0 }, 6, 6),
  // Claude: 2 cores x (8 payers/shapers), 8 plain (today's), 3 scrap parts (counted plain here), no keystones.
  'claude: 27 parts, 2 cores x (5 pay + 3 shape), 11 plain': () => makePool(['A', 'B'], { cash: 5, feed: 3, guard: 0, key: 0 }, 0, 11),
}
// The run: crawl depths 1,2,4,5,7,8; bosses 3,6,9. Per crawl depth: floor offers ~Poisson 4.5 for worn slots
// (dropsim: ~29 floor offers in 4 crawl depths of 6), elites = curve heavies (1,1,2,3,3,3), each a rare roll at 10%,
// Plenty raised 35% of crawl depths (3 pedestals, rare 10%, +4 strain), an exit set of 3 (empty slots first).
// d3: the gift (one rare-eligible + two, a second pick for +4 strain); d6: two floor drops (one rare-eligible).
// MATCH_P: share of pedestal sets with one pedestal from his drive. RARE_P: an elite's rare roll. GIFT_KEY: the gift's first
// pedestal is one of his keystones (if one is left).
// FLOOR: ordinary floor offers a crawl depth, before elites. Temper is on by default and pays ordinary kills x0.4, so ~2.5, not
// dropsim's ~5 (side rooms and crates are unchanged).
const FLOOR = Number(process.env.FLOOR ?? 2.5)
const RARE_P = Number(process.env.RARE_P ?? 0.1), GIFT_KEY = Number(process.env.GIFT_KEY ?? 0.5)
const MATCHES = (process.env.MATCHES ?? '0,0.5').split(',').map(Number)
const CRAWL = [1, 2, 4, 5, 7, 8], HEAVIES = { 1: 1, 2: 1, 4: 2, 5: 3, 7: 3, 8: 3 }
const pois = (l) => { let k = 0, p = Math.exp(-l), s = p; const u = rng(); while (u > s && k < 40) { k++; p *= l / k; s += p } return k }
// Round 2 dials (pool): PEDESTALS=0 (live today: exits raise nothing, Plenty drops one part, the gift leaves two on the floor);
// KNOW=d1 (the drive is picked after depth 1: d1 is chosen blind, as a tier chooser, and nothing matches in d1);
// FILTER=x (a share of elite and Plenty drops drawn from his drive: the verifier's one in three).
// FLOOR_ANY=1: floor parts may be for any slot (live since 28 Sep); default on when pedestals are off, off when on (round 1's model).
const PED_ON = (process.env.PEDESTALS ?? '1') !== '0', FLOOR_ANY = (process.env.FLOOR_ANY ?? (PED_ON ? '0' : '1')) === '1', KNOW = process.env.KNOW ?? 'start', FILTER = Number(process.env.FILTER ?? 0)
function run(pool, chooser, drives, match, log) {
  const drive = drives[Math.floor(rng() * drives.length)]
  const blind = () => KNOW === 'd1' && log.dep <= 1
  const worn = { head: null, torso: null, arms: null, legs: null }
  const linked = (p) => p && p.drive.includes(drive)
  const val = (p) => !p ? -1 : (chooser === 'tier' || (blind() && chooser !== 'random')) ? (p.rare ? 3 : p.role === 'plain' ? 1 : 2)
    : p.role === 'key' ? (linked(p) ? (Object.values(worn).some((w) => w && w !== p && w.role === 'key' && linked(w)) ? 0.5 : 4) : 0.5)
      : linked(p) ? 2 + (p.drive.length > 1 ? -0.3 : 0) : p.role === 'plain' ? 1 : 0.8
  const draw = (slots, rareOk, from) => {
    const on = new Set(Object.values(worn).filter(Boolean).map((p) => p.id))
    const c = (from ?? pool).filter((p) => !on.has(p.id) && slots.includes(p.slot) && (rareOk || !p.rare))
    return c.length ? c[Math.floor(rng() * c.length)] : null
  }
  const offer = (p) => { if (!p) return; log.off[p.id] = (log.off[p.id] ?? 0) + 1; if (p.role === 'key' && linked(p)) log.ownKeyOff = (log.ownKeyOff ?? 0) + 1; if (p.role === 'key' && linked(p) && log.dep < 6) log.keyBy6 = true }
  const take = (p) => { log.took[p.id] = (log.took[p.id] ?? 0) + 1; worn[p.slot] = p; if (p.role === 'key' && linked(p)) log.ownKeyTook = (log.ownKeyTook ?? 0) + 1; if (log.dep > 6) log.late = (log.late ?? 0) + 1 }
  const wornSlots = () => SLOTS.filter((s) => worn[s])
  const floor = (rareOk, filt = 0, any = FLOOR_ANY) => {
    const mine = filt > 0 && !blind() && rng() < filt ? draw(any ? SLOTS : wornSlots(), rareOk, pool.filter((q) => q.drive.includes(drive))) : null
    const p = mine ?? draw(any ? SLOTS : wornSlots(), rareOk); offer(p); if (!p) return
    if (any && !worn[p.slot]) { if (chooser !== 'random' || rng() < 0.5) take(p); return }
    const go = chooser === 'random' ? rng() < 0.5 : val(p) > val(worn[p.slot])
    if (go) take(p)
  }
  const pedestals = (n, rareOk, giftKey = false) => {
    const setMatch = !blind() && ((process.env.MATCH_WHERE ?? 'rare') !== 'rare' || rareOk) && rng() < match
    const empty = SLOTS.filter((s) => !worn[s]), set = []
    for (let i = 0; i < n; i++) {
      const used = set.map((p) => p.slot), open = empty.filter((s) => !used.includes(s))
      const slots = open.length ? open : SLOTS.filter((s) => !used.includes(s))
      const wantLink = setMatch && i === 0
      const wantKey = giftKey && i === 0
      const p = (wantKey && draw(SLOTS, true, pool.filter((q) => q.role === 'key' && q.drive.includes(drive)))) || (wantLink && draw(slots, rareOk, pool.filter((q) => q.drive.includes(drive)))) || draw(slots, rareOk && i === 0)
      if (p && !set.includes(p)) { set.push(p); offer(p) }
    }
    if (!set.length) return null
    if (chooser === 'random') { const p = set[Math.floor(rng() * set.length)]; take(p); return p }
    const best = set.map((p) => ({ p, g: (worn[p.slot] ? val(p) - val(worn[p.slot]) : 10 + val(p)) })).sort((a, b) => b.g - a.g)[0]
    if (best.g > 0) { take(best.p); return best.p }
    return null
  }
  const state = () => {
    const w = Object.values(worn).filter(Boolean), l = w.filter(linked)
    return { n: w.length, linked: l.length, cashN: l.filter((p) => p.role === 'cash').length, cash: l.some((p) => p.role === 'cash'), feed: l.some((p) => p.role === 'feed'), key: l.some((p) => p.role === 'key'), all4: l.length === 4 }
  }
  take(draw(SLOTS, false, pool.filter((p) => p.role !== 'key')))
  for (let d = 1; d <= 9; d++) {
    log.dep = d
    if (d === 3) { log.d3 = state(); if (PED_ON) pedestals(3, true, rng() < GIFT_KEY); else { floor(false, FILTER, true); floor(true, FILTER, true) } }
    if (d === 6) { log.d6 = state(); floor(false, FILTER); floor(true, FILTER) }
    if (d === 9) { log.d9 = state(); continue }
    if (!CRAWL.includes(d)) continue
    const f = pois(FLOOR)
    for (let i = 0; i < f; i++) floor(false)
    for (let i = 0; i < HEAVIES[d]; i++) floor(rng() < RARE_P, FILTER)
    if (rng() < 0.35) { if (PED_ON) pedestals(3, true); else floor(true, FILTER, true) }
    if (PED_ON) pedestals(3, false)
  }
  log.drive = drive
  return log
}
function partB() {
  console.log('\nB. POOL. 9 depths. formed d3 = 2+ parts linked to his drive incl. a cashier, entering the Assembler;')
  console.log('   chain d6 = 3+ linked incl. a cashier and a feeder at the Arbiter; keyed = chain + a keystone; done d6 = all 4 slots linked + key.\n')
  for (const [pname, mk] of Object.entries(POOLS)) {
    const pool = mk(), drives = [...new Set(pool.flatMap((p) => p.drive))]
    if (process.env.POOLS && !process.env.POOLS.split(',').some((x) => pname.startsWith(x))) continue
    console.log(`  ${pname}  (${pool.length} parts)`)
    for (const match of MATCHES) {
      for (const ch of ['committed', 'tier', 'random']) {
        const A = { a6: 0, p3: 0, p6: 0, f3: 0, c6: 0, k6: 0, k9: 0, done6: 0, keyBy6: 0, n3: 0, kOff: 0, kTook: 0, late: 0, offers: 0, seen: 0, takes: 0 }, off = {}, took = {}
        for (let r = 0; r < RUNS; r++) {
          const log = { off: {}, took: {} }
          run(pool, ch, drives, match, log)
          const s3 = log.d3, s6 = log.d6, s9 = log.d9
          A.n3 += s3.n
          if (s3.cashN >= 2) A.p3++
          if (s6.cashN >= 3) A.p6++
          if (s3.linked >= 2 && s3.cash) A.f3++
          if (s6.linked >= 3 && s6.cash && s6.feed) A.c6++
          if (s6.linked >= 3 && s6.cash && s6.feed && s6.key) A.k6++
          if (s9.linked >= 3 && s9.cash && s9.key) A.k9++
          if (s6.all4 && s6.key) A.done6++
          if (s6.all4) A.a6++
          if (log.keyBy6) A.keyBy6++
          A.offers += Object.values(log.off).reduce((a, b) => a + b, 0); A.seen += Object.keys(log.off).length; A.takes += Object.values(log.took).reduce((a, b) => a + b, 0)
          A.kOff += log.ownKeyOff ?? 0; A.kTook += log.ownKeyTook ?? 0; if (log.late) A.late++
          for (const k in log.off) off[k] = (off[k] ?? 0) + log.off[k]
          for (const k in log.took) took[k] = (took[k] ?? 0) + log.took[k]
        }
        const r = (x) => pct(x / RUNS)
        let line = `    match ${String(match).padEnd(4)} ${ch.padEnd(9)} 2 payers d3 ${r(A.p3).padStart(4)}  3 payers d6 ${r(A.p6).padStart(4)}  formed d3 ${r(A.f3).padStart(4)}  chain d6 ${r(A.c6).padStart(4)}  keyed d6 ${r(A.k6).padStart(4)}  keyed d9 ${r(A.k9).padStart(4)}  done d6 ${r(A.done6).padStart(4)}  all 4 linked d6 ${r(A.a6).padStart(4)}  own key offered by d6 ${r(A.keyBy6).padStart(4)}  parts at d3 ${(A.n3 / RUNS).toFixed(1)}  own key taken when offered ${pct(A.kTook / Math.max(1, A.kOff))}  takes a part after d6 ${r(A.late)}  offers ${(A.offers / RUNS).toFixed(0)} (distinct ${(A.seen / RUNS).toFixed(0)}), takes ${(A.takes / RUNS).toFixed(1)}`
        if (ch === 'committed' && match === MATCHES[0]) {
          // take rate when offered, per role (a committed player offered his own drive's part vs another's)
          const rate = (f) => { let o = 0, t = 0; for (const p of pool.filter(f)) { o += off[p.id] ?? 0; t += took[p.id] ?? 0 } return o ? t / o : 0 }
          line += `\n      take when offered: key ${pct(rate((p) => p.role === 'key'))}  cash ${pct(rate((p) => p.role === 'cash' && p.drive.length === 1))}  feed ${pct(rate((p) => p.role === 'feed'))}  guard ${pct(rate((p) => p.role === 'guard'))}  bridge ${pct(rate((p) => p.drive.length > 1))}  plain ${pct(rate((p) => p.role === 'plain'))}`
          const per = pool.map((p) => ({ p, r: (took[p.id] ?? 0) / RUNS }))
          const bySlot = SLOTS.map((s) => { const xs = per.filter((x) => x.p.slot === s).map((x) => x.r).sort((a, b) => a - b); const med = xs[Math.floor(xs.length / 2)]; const over = per.filter((x) => x.p.slot === s && x.r > 2 * med).length; return `${s} med ${med.toFixed(2)} over2x ${over}` })
          line += `\n      taken a run, per slot: ${bySlot.join(' | ')}`
          const linkedOffers = SLOTS.map((s) => { let o = 0; for (const p of pool.filter((q) => q.slot === s && q.drive.length)) o += off[p.id] ?? 0; return `${s} ${(o / RUNS / drives.length).toFixed(1)}` })
          line += `\n      linked offers a run per drive, by slot: ${linkedOffers.join(' ')}`
        }
        console.log(line)
      }
    }
  }
}

// ------------------------------------------------------------------ C. ROUND 2: the others' roots, priced
// node design/buildlayer/build-sim.mjs r2 [runs]. Same clock, hesitation, bodies and temper as A. A root sets a state
// (x mul, used up, today's STATE rule; or 'hauled': no mul, an area part catches every hauled body). Shatter is on: a
// paid kill passes the bonus it didn't need to the next body. No geometry: the wall share, crossing rate, windup rate
// and coverage stand in for it, and are dials (PIN_WALL, Q, W, COVER). Still no damage taken.
Object.assign(P, {
  piston: { slot: 'arms', dmg: 24, cd: 3.0, hits: 'one' },        // 20 x1.2, narrow
  flare: { slot: 'head', dmg: 22, cd: 4.2, hits: 'blast', p: 0.4 }, // 18 x1.2, lob r2
  cracked: { slot: 'head', dmg: 24, cd: 4.6, hits: 'line' },       // 20 x1.2, pierce
  overrun: { slot: 'legs', dmg: 40, cd: 7, hits: 'all', p: 0.5 },  // 22 x1.8, a charge through
})
const PIN_WALL = Number(process.env.PIN_WALL ?? 0.25), Q = Number(process.env.Q ?? 0.6), W = Number(process.env.W ?? 0.4)
const ROOTS = {
  today: { name: "today's hand + eye", kind: 'old' },
  haul: { name: 'verifier Haul (hand only, drags)', kind: 'beat', dmg: 10, up: 0.7, pick: 'focus', st: 'hauled', sp: 1, life: 2 },
  pin: { name: 'verifier Pin (eye only, pins at a wall)', kind: 'beat', dmg: 8, up: 0.5, pick: 'line', sp: PIN_WALL, life: 1.5 },
  ram: { name: 'Claude Ram (shove, slams)', kind: 'beat', dmg: 7, up: 0.7, pick: 'focus', sp: 0.4, life: 1 },
  rime: { name: 'translator Wake / Claude Trail (rime)', kind: 'wake', dmg: 3, q: Q, qBoss: 0.4, life: 2 },
  catch: { name: 'translator Breaker (catch)', kind: 'catch', dmg: 6, w: W, wBoss: 0.35, reach: 0.5, reachBoss: 0.8, plain: 5, plainCd: 1.2, plainUp: 0.7, life: 1.5 },
}
const Wt = (b) => ({ ...P[b] }), PAY = (b, mul = 2) => ({ ...P[b], role: 'pay', mul }), COV = (b) => ({ ...P[b], role: 'cover' }), SET = (b, sp) => ({ ...P[b], role: 'set', sp })
// Each root's chain, as its author named the parts (stand-ins on today's numbers where a part is new).
const CH2 = {
  haul: { c1: [Wt('lens'), Wt('vent'), COV('cleaver'), Wt('kick')], c2: [Wt('lens'), { ...SET('vent', 1), role: 'set+' }, COV('cleaver'), Wt('kick')], c3: [COV('flare'), { ...SET('vent', 1), role: 'set+' }, COV('cleaver'), COV('kick')] },
  pin: { c1: [PAY('lens'), Wt('vent'), Wt('cleaver'), Wt('kick')], c2: [PAY('lens'), SET('vent', 0.3), Wt('cleaver'), Wt('kick')], c3: [PAY('lens'), SET('vent', 0.3), SET('piston', 0.5), PAY('overrun')] },
  ram: { c1: [Wt('lens'), Wt('vent'), PAY('cleaver', 3), Wt('kick')], c2: [PAY('lens', 3), Wt('vent'), PAY('cleaver', 3), Wt('kick')], c3: [PAY('lens', 3), Wt('vent'), PAY('cleaver', 3), PAY('kick', 3)] },
  rime: { c1: [Wt('lens'), Wt('vent'), PAY('cleaver'), Wt('kick')], c2: [PAY('cracked'), Wt('vent'), PAY('cleaver'), Wt('kick')], c3: [PAY('cracked'), Wt('vent'), PAY('cleaver'), PAY('kick')] },
  catch: { c1: [Wt('lens'), Wt('vent'), PAY('piston'), Wt('kick')], c2: [PAY('flare'), Wt('vent'), PAY('piston'), Wt('kick')], c3: [PAY('flare'), Wt('vent'), PAY('piston'), PAY('overrun')] },
}
function fight2(rk, parts, opt) {
  const R = ROOTS[rk], boss = opt.kind === 'boss', cov = opt.cover ?? 1
  const hps = boss ? [1170] : opt.kind === 'early' ? [42, 42, 42, 28] : opt.kind === 'heavy' ? [120, 64, 64, 64] : [64, 64, 64, 64, 43]
  const bodies = hps.map((hp, i) => ({ hp, back: !boss && i === hps.length - 1, s: 0, dead: false, cross: -9 }))
  const T = TEMPER[opt.temper ?? 'today']
  const ps = parts.map((p) => { const r = p.rank ?? opt.rank ?? 0; return { ...p, dmg: p.dmg * T.dmg[r], cd: p.cd * T.cd[r], t: rng() * p.cd, wait: -1, held: 0 } })
  const st = { t: 0, auto: 0, part: 0, bonus: 0, made: 0, paid: 0, fk: 0, kHalf: 0, kills: 0 }
  let t = 0
  const alive = () => bodies.filter((b) => !b.dead)
  const put = (b) => { if (!b.dead) { if (b.s <= 0) st.made++; b.s = R.life ?? 1.5 } }
  const die = (b) => { b.dead = true; st.kills++; if (!st.fk) st.fk = t; b.kt = t }
  const hurt = (b, d, src, bonus = 0) => {
    if (b.dead) return
    const total = d + bonus, dealt = Math.min(b.hp, total)
    st[src] += dealt; if (bonus) st.bonus += Math.max(0, dealt - Math.min(b.hp, d))
    const over = total - b.hp; b.hp -= total
    if (b.hp <= 0) { die(b); const spill = Math.min(bonus, over); if (spill > 0) { const n = alive()[0]; if (n) { const x = Math.min(n.hp, spill); n.hp -= spill; st.part += x; st.bonus += x; if (n.hp <= 0) die(n) } } }
  }
  const hitOne = (p, b) => {
    let bonus = 0
    if (p.role === 'pay' && b.s > 0 && !opt.nopay) { bonus = p.dmg * (p.mul - 1); b.s = 0; st.paid++ }
    hurt(b, p.dmg, 'part', bonus)
    if ((p.role === 'set' || p.role === 'set+') && !opt.nopay && rng() < p.sp) put(b)
  }
  const caught = (p, b, pp) => (p.role === 'cover' && b.s > 0 && !opt.nopay) ? true : rng() < pp * cov
  while (alive().length && t < (boss ? 300 : 60)) {
    t += DT
    for (const b of bodies) if (b.s > 0) b.s -= DT
    for (const p of ps) {
      p.t -= DT
      if (p.t <= 0 && p.wait < 0) p.wait = exp(HESIT)
      if (p.wait < 0) continue
      p.wait -= DT; if (p.wait > 0) continue
      if (p.role === 'pay' && !opt.nopay && !alive().some((b) => b.s > 0) && p.held < 1) { p.held += DT; p.wait = 0; continue }
      p.wait = -1; p.held = 0; p.t = p.cd
      let a = alive(); if (!a.length) break
      if (p.role === 'pay' && !opt.nopay) a = [...a].sort((x, y) => (y.s > 0) - (x.s > 0))
      if (p.role === 'set+') for (const b of a) put(b) // Backdraft: pulls everyone in (hauls them) before it hits
      if (p.hits === 'back') hitOne(p, p.role === 'pay' && !opt.nopay ? a[0] : a.find((x) => x.back) ?? a[0])
      else if (p.hits === 'one') hitOne(p, a[0])
      else if (p.hits === 'line') { hitOne(p, a[0]); if (a[1] && rng() < 0.5) hitOne(p, a[1]); if (a[2] && rng() < 0.2) hitOne(p, a[2]) }
      else if (p.hits === 'arc') { hitOne(p, a[0]); if (a[1] && caught(p, a[1], p.p2)) hitOne(p, a[1]); if (a[2] && caught(p, a[2], p.p3)) hitOne(p, a[2]) }
      else if (p.hits === 'blast') { hitOne(p, a[0]); for (const b of a.slice(1)) if (caught(p, b, p.p)) hitOne(p, b) }
      else for (const b of a) if (caught(p, b, p.p)) hitOne(p, b)
    }
    const a = alive(); if (!a.length) break
    const am = boss ? 0.5 : 1
    if (R.kind === 'wake') {
      const q = boss ? R.qBoss : R.q
      for (const b of a) if (t - b.cross >= 1 && rng() < q * DT) { b.cross = t; hurt(b, R.dmg * am, 'auto'); if (!opt.nopay) put(b) }
    } else if (R.kind === 'catch') {
      st.snap = (st.snap ?? 0) - DT; st.plainT = (st.plainT ?? rng() * R.plainCd) - DT
      const w = boss ? R.wBoss : R.w, reach = boss ? R.reachBoss : R.reach
      for (const b of a) if (st.snap <= 0 && rng() < w * DT && rng() < reach) { st.snap = 1; hurt(b, R.dmg * am, 'auto'); if (!opt.nopay) put(b) }
      if (st.plainT <= 0) { st.plainT = R.plainCd; const n = alive()[0]; if (n && rng() < R.plainUp) hurt(n, R.plain * am, 'auto') }
    } else {
      st.beat = (st.beat ?? rng() * BEAT) - DT
      if (st.beat <= 0) {
        st.beat = BEAT
        if (R.kind === 'old') {
          const r = rng()
          if (r < 0.7) hurt(a[0], 10 * am, 'auto')
          else if (r < 0.95) { const c = [...a.filter((b) => b.back), ...a.filter((b) => !b.back)]; hurt(c[0], 8 * am, 'auto'); if (c[1] && rng() < 0.3) hurt(c[1], 8 * am, 'auto') }
        } else if (rng() < R.up) {
          const hit = R.pick === 'focus' ? [a[0]] : [a[0], ...(a[1] && rng() < 0.5 ? [a[1]] : []), ...(a[2] && rng() < 0.2 ? [a[2]] : [])]
          for (const b of hit) { hurt(b, R.dmg * am, 'auto'); if (!opt.nopay && rng() < R.sp) put(b) }
        }
      }
    }
  }
  st.t = t
  if (!boss) st.kHalf = bodies.filter((b) => b.kt <= t / 2).length / bodies.length
  return st
}
function measure2(rk, parts, opt, n) {
  n = n ?? (opt.kind === 'boss' ? 300 : 2000)
  const acc = { t: 0, auto: 0, part: 0, bonus: 0, made: 0, paid: 0, fk: 0, kHalf: 0 }
  for (let i = 0; i < n; i++) { const s = fight2(rk, parts, opt); for (const k in acc) acc[k] += s[k] }
  for (const k in acc) acc[k] /= n
  return acc
}
function partC() {
  const kinds = ['early', 'deep', 'heavy', 'boss'], W4 = [Wt('lens'), Wt('vent'), Wt('cleaver'), Wt('kick')]
  const sg = (g) => `${g >= 0 ? '+' : ''}${Math.round(g * 100)}%`
  const row = (name, rk, parts, o, base) => {
    const cs = kinds.map((k) => ({ k, m: measure2(rk, parts, { ...o, kind: k }) }))
    console.log(`    ${name.padEnd(44)} ${cs.map(({ k, m }) => `${k} ${sg(base[k] / m.t - 1)}`.padEnd(13)).join('')} deep: ${cs[1].m.paid.toFixed(1)} pays, bonus ${pct(cs[1].m.bonus / (cs[1].m.part + cs[1].m.auto))}`)
    return cs
  }
  console.log(`C. ROUND 2. The others' roots. PIN_WALL ${PIN_WALL}, Q ${Q}, W ${W}, COVER ${process.env.COVER ?? 'sim (1)'}.`)
  const todayBase = {}; for (const k of kinds) todayBase[k] = measure2('today', W4, { kind: k }).t
  console.log(`  today's hand + eye, four whites: early ${todayBase.early.toFixed(1)} s, deep ${todayBase.deep.toFixed(1)} s, heavy ${todayBase.heavy.toFixed(1)} s, boss ${todayBase.boss.toFixed(0)} s`)
  const T4 = {}; for (const k of kinds) T4[k] = measure2('today', W4.map((p) => ({ ...p, rank: 2 })), { kind: k }).t
  console.log(`  today's hand + eye, all four III (today's temper): ${kinds.map((k) => `${k} ${sg(todayBase[k] / T4[k] - 1)}`).join('  ')}\n`)
  for (const rk of Object.keys(CH2).filter((k) => !process.env.ROOTSEL || process.env.ROOTSEL.split(',').includes(k))) {
    const cov = rk === 'haul' && process.env.COVER ? { cover: Number(process.env.COVER) } : {}
    const base = {}; for (const k of kinds) base[k] = measure2(rk, W4, { kind: k, ...cov }).t
    console.log(`  ${ROOTS[rk].name}: four whites ${kinds.map((k) => `${k} ${base[k].toFixed(1)} s (${sg(todayBase[k] / base[k] - 1)} vs today)`).join(', ')}`)
    const C = CH2[rk]
    row('all four III, today\'s temper', rk, W4.map((p) => ({ ...p, rank: 2 })), cov, base)
    row('all four III, flat temper', rk, W4.map((p) => ({ ...p, rank: 2 })), { ...cov, temper: 'flat' }, base)
    for (const c of ['c1', 'c2', 'c3']) row(`${c} at rank I`, rk, C[c], cov, base)
    row('c3 worn, links off (same parts, no state)', rk, C.c3, { ...cov, nopay: true }, base)
    row('c3 at III, today\'s temper', rk, C.c3.map((p) => ({ ...p, rank: 2 })), cov, base)
    row('c3 at III, flat temper', rk, C.c3.map((p) => ({ ...p, rank: 2 })), { ...cov, temper: 'flat' }, base)
    const dm = measure2(rk, C.c3, { kind: 'deep', ...cov })
    console.log(`    c3 deep pack: first kill at ${dm.fk.toFixed(1)} of ${dm.t.toFixed(1)} s; ${pct(dm.kHalf)} of bodies dead by half-time\n`)
  }
  if (process.env.ROOTSEL) return
  // the pay rule, isolated: my drives with my spenders, flat per mark vs today's x2 used up
  console.log('  Pay rule A/B on my drives (same spenders, same marks): flat per mark vs x2 used up. Deep pack / boss, vs that drive\'s whites.')
  const Wa = [P.lens, P.vent, P.cleaver, P.kick]
  for (const dk of ['sight', 'wake', 'strike']) {
    const b = { deep: measure(dk, Wa, { kind: 'deep' }, 2000).t, boss: measure(dk, Wa, { kind: 'boss' }, 300).t }
    const g = (parts, o) => ['deep', 'boss'].map((k) => sg(b[k] / measure(dk, parts, { ...o, kind: k }, k === 'boss' ? 300 : 2000).t - 1)).join(' / ')
    const c3 = build(CHAINS[dk].c3), c3iii = build(CHAINS[dk].c3, 2)
    console.log(`    ${DRIVES[dk].name.padEnd(32)} c3 I: flat ${g(c3, {})}, x2 ${g(c3, { x2: true })}   c3 III today: flat ${g(c3iii, {})}, x2 ${g(c3iii, { x2: true })}   c3 III flat temper: flat ${g(c3iii, { temper: 'flat' })}, x2 ${g(c3iii, { temper: 'flat', x2: true })}   c3 III today, 'lands twice' at rank I damage: ${g(c3iii, { x2: true, x2base: true })}`)
  }
}

// ------------------------------------------------------------------ D. ROUND 3: BUILD.md's trial, priced
// node design/buildlayer/build-sim.mjs r3 [n]   (3-balancer.md). The real parts of BUILD.md §5.1 at their weighed rank-I numbers
// (weight preset B: head/arms x1.2, torso/legs x1.8, Cleaver 180 deg), Wake and Ram as BUILD.md §2.5-2.6 has them, flat K per
// mark, the 4 keystones and 4 upgrades of §2.7, flat temper while a core is worn. Same clock, hesitation and bodies as A.
// Geometry stands in as rates (env dials): Q / QB = Wake's skim rate per body after its 1 s lockout (packs / boss);
// S = Ram's slams a shove on packs (a boss always slams); BODY = share of slams that are body slams; UP = share of beats
// with a body in reach. No damage taken. Every name is a PLACEHOLDER.
const E3 = (k, d) => Number(process.env[k] ?? d)
const D3 = {
  K: { wake: E3('KW', 6), ram: E3('KR', 8) }, cap: 3, life: 3,
  Q: E3('Q3', 0.6), QB: E3('QB', 0.4), lock: E3('LOCK', 1), lockB: E3('LOCKB', 1), skim: E3('SKIM', 4), skimBossMul: E3('WAM', 0.5), slowQ: E3('SLOWQ', 1.5),
  S: E3('S', 0.4), BODY: E3('BODY', 0.5), UP: E3('UP', 0.7), UPB: E3('UPB', 0.75), shove: E3('SHOVE', 6),
  pullS: E3('PULLS', 0.3), pullS_T: 2.5, sPiston: E3('SPISTON', 1.5), sKick: 0.8,
  link: E3('LINK', 0.5), rubP: E3('RUBP', 0.3), wideP: E3('WIDEP', 0.6), sprayP: E3('SPRAYP', 0.5), slipQ: E3('SLIPQ', 1.1),
  tell: E3('TELL', 0.35), tellB: E3('TELLB', 0.27), bhWhiff: E3('BHWHIFF', 0.15), skateSkim: 0.3,
}
// Weighed rank-I numbers (abilities.ts x weight preset B). hits: back | one | arc (p2, p3 by nearness; marks-first for 'behind') | all (p) | blast (p).
const P3 = {
  lens: { slot: 'head', dmg: 31, cd: 4.2, hits: 'back' },
  flare: { slot: 'head', dmg: 22, cd: 4.2, hits: 'blast', p: 0.4, spend: ['ram'] },
  fflare: { slot: 'head', dmg: E3('FFD', 12), cd: E3('FFCD', 5.0), hits: 'blast', p: 0.45, rime: 2, core: 'wake' },          // Frost Flare (signal-flare under Wake)
  pvent: { slot: 'torso', dmg: 27, cd: 6.5, hits: 'all', p: 0.95 },
  ward: { slot: 'torso', dmg: 0, cd: 7, hits: 'none' },
  backdraft: { slot: 'torso', dmg: 22, cd: 6.5, hits: 'all', p: 0.95, pull: true },
  brace: { slot: 'torso', dmg: 14, cd: 9, hits: 'all', p: 0.5 },
  cleaver: { slot: 'arms', dmg: 22, cd: 2.6, hits: 'arc', p2: 0.9, p3: 0.45, spend: ['wake', 'ram'] },
  piston: { slot: 'arms', dmg: 24, cd: 3.0, hits: 'one', spend: ['ram'], knock: 'piston' },
  backhand: { slot: 'arms', dmg: E3('BHD', 19), cd: E3('BHCD', 2.6), hits: 'arc', p2: E3('BHP2', 0.6), p3: E3('BHP3', 0.25), behind: true, spend: ['wake'], core: 'wake' }, // frayed-cleaver under Wake
  kick: { slot: 'legs', dmg: 22, cd: 8.0, hits: 'all', p: 0.7, knock: 'kick' },
  skate: { slot: 'legs', dmg: E3('SKD', 18), cd: E3('SKCD', 7.0), hits: 'all', p: 0.6, spend: ['wake'], skims: true, core: 'wake' }, // frost-trail under Wake
  spring: { slot: 'legs', dmg: 0, cd: 4.0, hits: 'none' },
}
const pv = (id, o = {}) => ({ id, ...P3[id], ...o })
// Ram's Piston as a variant (PISD, PISCD); BRK = K share the bridge (Scrap Cleaver) spends at; SCD = cooldown x for a core's OWN spenders under it.
const RAMVAR = { piston: { dmg: E3('PISD', 24), cd: E3('PISCD', 3.0) } }
const BRK = E3('BRK', 1), SCD = E3('SCD', 1)
// KMAP="cleaver:3,piston:12": a spender's own flat K per mark (a Fit's k), in place of the core's K x BRK.
const KMAP = Object.fromEntries((process.env.KMAP ?? '').split(',').filter(Boolean).map((x) => { const [k, v] = x.split(':'); return [k, Number(v)] }))
const WH = ['lens', 'pvent', 'cleaver', 'kick']
// TUNE3=prop: the numbers 3-balancer.md ships (env dials still override where named). A Fit's own k (flat per mark) where it differs from the core's K.
const SHIP = process.env.TUNE3 === 'prop'
if (SHIP) {
  Object.assign(P3.cleaver, { k: { wake: E3('KCLW', 3), ram: E3('KCLR', 4) } })                       // the bridge spends at half: +3 / +4 each
  Object.assign(P3.backhand, { dmg: E3('BHD', 22), cd: E3('BHCD', 2.4), p2: E3('BHP2', 0.8), p3: E3('BHP3', 0.4), k: { wake: E3('KBH', 10) } }) // base 18, cone 150, cd 2400, +10 each
  Object.assign(P3.skate, { dmg: E3('SKD', 22), cd: E3('SKCD', 5.5) })                                // base 12, cd 5500
  Object.assign(P3.fflare, { dmg: E3('FFD', 17), rime: E3('FFR', 2) })                                 // base 14
  RAMVAR.piston = { dmg: E3('PISD', 24), cd: E3('PISCD', 2.6) }; Object.assign(P3.piston, { k: { ram: E3('KPIS', 12) } }) // Piston under Ram: cd 2600, +12 each
  // the cores: Wake's skim 6, full and every 0.5 s on a body that can't be moved; Ram's shove 8. QB 1 is the central guess for a boss (see 3-balancer).
  Object.assign(D3, { skim: E3('SKIM', 6), skimBossMul: E3('WAM', 1), lockB: E3('LOCKB', 0.5), QB: E3('QB', 1), shove: E3('SHOVE', 8) })
}
// What 3-balancer.md ships for the keystones and upgrades (the extras' "SHIP" rows).
const SHIPKEY = {
  'wake-burst': { key: 'wake-burst', share: 1 }, 'wake-deep': { key: 'wake-deep' },
  'ram-domino': { key: 'ram-domino', dhit: 8 }, 'ram-catch': { key: 'ram-catch', catch: 'bossOnly', share: 1 },
}
function fight3(core, parts, opt) {
  const boss = opt.kind === 'boss', am = boss ? 0.5 : 1, ks = opt.key ?? null, up = new Set(opt.up ?? [])
  const hps = boss ? [1170] : opt.kind === 'early' ? [42, 42, 42, 28] : opt.kind === 'heavy' ? [120, 64, 64, 64] : [64, 64, 64, 64, 43]
  const bodies = hps.map((hp, i) => ({ hp, back: !boss && i === hps.length - 1, m: 0, mt: 0, ls: -9, slow: 0, dead: false }))
  const cored = core !== 'old', K = cored ? D3.K[core] : 0
  const cap = ks === 'wake-deep' ? (opt.dcap ?? 5) : ks === 'ram-deep' && boss ? 5 : D3.cap, life = ks === 'wake-deep' ? (opt.dlife ?? 4) : D3.life
  const T = TEMPER[cored ? 'flat' : 'today']
  const ps = parts.map((p0) => {
    let p = core === 'ram' && RAMVAR[p0.id] ? { ...p0, ...RAMVAR[p0.id] } : p0
    if (cored && p.spend?.includes(core) && p.spend.length === 1) p = { ...p, cd: p.cd * SCD }
    const r = p.rank ?? opt.rank ?? 0; return { ...p, dmg: p.dmg * T.dmg[r], cd: p.cd * T.cd[r], t: rng() * p.cd * T.cd[r], wait: -1, held: 0 }
  })
  const st = { t: 0, auto: 0, part: 0, bonus: 0, made: 0, spent: 0, expired: 0, shoves: 0, slams: 0, skims: 0, bursts: 0, catches: 0 }
  let t = 0, pulled = -9, beat = rng() * BEAT, catchCd = 0
  const alive = () => bodies.filter((b) => !b.dead)
  const spends = (p) => cored && p.spend?.includes(core)
  const mark = (b, n = 1) => { if (!cored || b.dead) return; const add = Math.max(0, Math.min(n, cap - b.m)); st.made += add; b.m += add; b.mt = life }
  const hurt = (b, d, src, bonus = 0) => {
    if (b.dead) return
    const total = d + bonus, dealt = Math.min(b.hp, total)
    st[src] += dealt; if (bonus) st.bonus += Math.max(0, dealt - Math.min(b.hp, d))
    const over = total - b.hp; b.hp -= total
    if (b.hp <= 0) {
      b.dead = true
      const spill = Math.min(bonus, over) // shatter: what the marks added beyond the HP left
      if (spill > 0) { const n = alive()[0]; if (n) { const x = Math.min(n.hp, spill); n.hp -= spill; st.part += x; st.bonus += x; if (n.hp <= 0) n.dead = true } }
    }
  }
  const spendAt = (b, share, src) => { if (b.m <= 0) return; const n = b.m; st.spent += n; b.m = 0; hurt(b, 0, src, Math.round(share * n * K)) }
  // Ram: one shove's slam test. boss/anchored: always ('still'). Pulled bodies (Backdraft) slam more and mostly into each other.
  const slamTest = (b, sMul = 1) => {
    if (b.dead) return
    if (boss) { st.slams++; mark(b, ks === 'ram-deep' ? 2 : 1); return }
    const pull = t - pulled < D3.pullS_T, s = Math.min(0.95, D3.S * sMul + (pull ? D3.pullS : 0)), bodyShare = pull ? 0.8 : D3.BODY
    if (rng() >= s) return
    st.slams++
    const others = alive().filter((x) => x !== b)
    if (others.length && rng() < bodyShare) {
      let o = others[Math.floor(rng() * others.length)]; mark(b); mark(o)
      if (ks === 'ram-domino') for (let link = 0; link < 2 && o && rng() < D3.link; link++) {
        mark(o); if (opt.dhit) hurt(o, opt.dhit * am, 'auto'); const rest = alive().filter((x) => x !== o && x !== b)
        if (rest.length && rng() < D3.BODY) { const p = rest[Math.floor(rng() * rest.length)]; mark(p); if (opt.dhit) hurt(p, opt.dhit * am, 'auto'); o = p } else break
      }
    } else {
      mark(b)
      if (up.has('ram-rubble')) for (const o of others) if (rng() < D3.rubP) { hurt(o, E3('RUBD', 4) * am, 'auto'); mark(o) }
    }
  }
  const shove = (b) => { st.shoves++; slamTest(b); hurt(b, D3.shove * am, 'auto') }
  const skim = (b) => {
    if (b.dead || t - b.ls < (boss ? D3.lockB : D3.lock)) return
    b.ls = t; st.skims++
    const was = b.m
    hurt(b, D3.skim * (boss ? D3.skimBossMul : 1), 'auto'); if (b.dead) return
    mark(b, ks === 'wake-deep' && boss && opt.big ? opt.big : 1)
    const bv = opt.burst ?? 'spec'
    if (ks === 'wake-burst') {
      if (bv === 'spec' && b.m >= cap) { st.bursts++; spendAt(b, (opt.share ?? 0.6) * am, 'auto') }      // fill to cap: spend all at share (an autoHit, x0.5 on a boss)
      else if (bv === 'specfull' && b.m >= cap) { st.bursts++; spendAt(b, opt.share ?? 0.6, 'part') } // the same, full on a boss
      else if (bv === 'overflow' && was >= cap) { st.bursts++; spendAt(b, opt.share ?? 1, 'part') }   // a skim on a full body: spend all
      else if (bv === 'keep' && was >= cap) { st.bursts++; hurt(b, 0, 'part', Math.round((opt.share ?? 0.6) * cap * K)) } // a skim on a full body: bonus, marks kept
      else if (bv === 'two' && b.m >= 2) { st.bursts++; spendAt(b, opt.share ?? 1, 'part') }        // the second ring spends
      else if (bv === 'twoAuto' && b.m >= 2) { st.bursts++; spendAt(b, (opt.share ?? 1) * am, 'auto') } // the same as a core hit (x0.5 on a boss)
    }
    if (up.has('wake-spray') && rng() < D3.sprayP) { const o = alive().filter((x) => x !== b); if (o.length) mark(o[Math.floor(rng() * o.length)]) }
  }
  const strike = (p, b) => {
    if (!b || b.dead) return
    let bonus = 0
    if (spends(p) && b.m > 0) { bonus = Math.round(b.m * (KMAP[p.id] ?? p.k?.[core] ?? K * (p.spend.length > 1 ? BRK : 1))); st.spent += b.m; b.m = 0 }
    hurt(b, p.dmg, 'part', bonus)
    if (core === 'ram' && p.knock === 'piston') { st.shoves++; slamTest(b, D3.sPiston) }
    if (core === 'ram' && p.knock === 'kick') { st.shoves++; slamTest(b, D3.sKick) }
    if (core === 'wake' && p.rime) { mark(b, p.rime); b.slow = t + 2 }
  }
  while (alive().length && t < (boss ? 300 : 60)) {
    t += DT
    for (const b of bodies) if (b.m > 0 && (b.mt -= DT) <= 0) { st.expired += b.m; b.m = 0 }
    for (const p of ps) {
      p.t -= DT
      if (p.t <= 0 && p.wait < 0) p.wait = exp(opt.hes ?? HESIT)
      if (p.wait < 0) continue
      p.wait -= DT; if (p.wait > 0) continue
      if (spends(p) && !alive().some((b) => b.m > 0) && p.held < 1) { p.held += DT; p.wait = 0; continue }
      p.wait = -1; p.held = 0; p.t = p.cd
      const a = alive(); if (!a.length) break
      const byMarks = [...a].sort((x, y) => y.m - x.m)
      const lead = spends(p) ? byMarks[0] : (p.hits === 'back' ? a.find((x) => x.back) ?? a[0] : a[0])
      if (p.hits === 'none') continue
      if (p.pull && core === 'ram') pulled = t
      if (p.hits === 'back' || p.hits === 'one') strike(p, lead)
      else if (p.hits === 'arc') {
        if (p.behind && rng() < D3.bhWhiff) continue
        const rest = (p.behind ? byMarks : a).filter((x) => x !== lead), pull = core === 'ram' && t - pulled < D3.pullS_T
        strike(p, lead); if (rest[0] && rng() < p.p2) strike(p, rest[0]); if (rest[1] && rng() < (pull ? 0.8 : p.p3)) strike(p, rest[1])
      } else if (p.hits === 'blast') {
        const pull = core === 'ram' && t - pulled < D3.pullS_T
        strike(p, lead); for (const b of a) if (b !== lead && rng() < (pull ? 0.7 : p.p)) strike(p, b)
      } else for (const b of a) if (rng() < p.p) strike(p, b)
      if (p.skims && core === 'wake') for (const b of alive()) if (rng() < D3.skateSkim) skim(b)
    }
    const a = alive(); if (!a.length) break
    if (core === 'wake') {
      const q0 = (boss ? D3.QB : D3.Q) * (up.has('wake-slip') ? D3.slipQ : 1)
      for (const b of a) if (rng() < q0 * (b.slow > t ? D3.slowQ : 1) * DT) skim(b)
      continue
    }
    if (core === 'ram' && ks === 'ram-catch') {
      catchCd -= DT
      const rate = boss ? D3.tellB : D3.tell * 1.5
      if (catchCd <= 0 && (boss || opt.catch !== 'bossOnly') && rng() < rate * DT) {
        catchCd = 1; st.catches++; const b = a[0]; st.shoves++; slamTest(b, 1)
        if (opt.catch === 'spend' || ((opt.catch === 'spendBoss' || opt.catch === 'bossOnly') && boss)) spendAt(b, opt.share ?? 1, 'part')
        hurt(b, D3.shove * am, 'auto'); beat = BEAT
      }
    }
    if ((beat -= DT) <= 0) {
      beat = BEAT
      if (core === 'old') {
        const r = rng()
        if (r < 0.7) hurt(a[0], 10 * am, 'auto')
        else if (r < 0.95) { const c = [...a.filter((b) => b.back), ...a.filter((b) => !b.back)]; hurt(c[0], 8 * am, 'auto'); if (c[1] && rng() < 0.3) hurt(c[1], 8 * am, 'auto') }
        continue
      }
      if (rng() > (boss ? D3.UPB : D3.UP)) continue
      shove(a[0])
      if (up.has('ram-wide') && a[1] && rng() < D3.wideP) shove(a[1])
    }
  }
  st.t = t
  return st
}
function measure3(core, parts, opt, n) {
  n = n ?? (opt.kind === 'boss' ? 300 : 2000)
  const acc = {}
  for (let i = 0; i < n; i++) { const s = fight3(core, parts, opt); for (const k in s) acc[k] = (acc[k] ?? 0) + s[k] }
  for (const k in acc) acc[k] /= n
  return acc
}
const KINDS3 = ['early', 'deep', 'heavy', 'boss']
const sg3 = (g) => `${g >= 0 ? '+' : ''}${Math.round(g * 100)}%`
function partD() {
  const N = Number(process.argv[3] ?? 2000), NB = Math.max(150, Math.round(N / 7))
  const M = (core, parts, o = {}) => Object.fromEntries(KINDS3.map((k) => [k, measure3(core, parts, { ...o, kind: k }, k === 'boss' ? NB : N)]))
  const whites = WH.map((id) => pv(id))
  const today = M('old', whites), todayIII = M('old', whites.map((p) => ({ ...p, rank: 2 })))
  const cell = (m, base) => KINDS3.map((k) => `${k} ${sg3(base[k].t / m[k].t - 1)}`.padEnd(12)).join('')
  const info = (m) => `deep: made ${m.deep.made.toFixed(1)} spent ${m.deep.spent.toFixed(1)} expired ${m.deep.expired.toFixed(1)}, bonus ${pct(m.deep.bonus / (m.deep.part + m.deep.auto))}` +
    (m.deep.shoves ? `, slams/shove ${(m.deep.slams / m.deep.shoves).toFixed(2)}` : '') + (m.deep.bursts ? `, bursts ${m.deep.bursts.toFixed(1)}` : '') + `; boss: made ${(m.boss.made / m.boss.t).toFixed(2)}/s spent ${(m.boss.spent / m.boss.t).toFixed(2)}/s`
  console.log(`D. ROUND 3 (BUILD.md). Median player, hesitation ${HESIT} s. K wake ${D3.K.wake} ram ${D3.K.ram}; Q ${D3.Q} QB ${D3.QB}; S ${D3.S} BODY ${D3.BODY} UP ${D3.UP}.`)
  console.log(`  today's hand + eye, four whites: ${KINDS3.map((k) => `${k} ${today[k].t.toFixed(1)} s`).join(', ')}; all four III (today's temper): ${cell(todayIII, today)}\n`)
  const sel = (process.env.CORES ?? 'wake,ram').split(',')
  const B = {
    wake: {
      'whites (Cleaver spends)': [whites, {}],
      'whites, Piston for Cleaver (no spender)': [[pv('lens'), pv('pvent'), pv('piston'), pv('kick')], {}],
      'c1: Backhand': [[pv('lens'), pv('pvent'), pv('backhand'), pv('kick')], {}],
      'c1: Skate (Cleaver kept)': [[pv('lens'), pv('pvent'), pv('cleaver'), pv('skate')], {}],
      'c2: Backhand + Skate': [[pv('lens'), pv('pvent'), pv('backhand'), pv('skate')], {}],
      'c3: Backhand + Skate + Frost Flare': [[pv('fflare'), pv('pvent'), pv('backhand'), pv('skate')], {}],
      'c3, Cleaver for Backhand': [[pv('fflare'), pv('pvent'), pv('cleaver'), pv('skate')], {}],
      'c2 + Ward (torso)': [[pv('lens'), pv('ward'), pv('backhand'), pv('skate')], {}],
    },
    ram: {
      'whites (Cleaver spends, Kickstart slams)': [whites, {}],
      'whites, Lens/Vent/Hook-like plain arms (no spender)': [[pv('lens'), pv('pvent'), { ...pv('piston'), spend: [] }, { ...pv('kick'), knock: null }], {}],
      'c1: Piston': [[pv('lens'), pv('pvent'), pv('piston'), pv('kick')], {}],
      'c2: Piston + Flare': [[pv('flare'), pv('pvent'), pv('piston'), pv('kick')], {}],
      'c3: Piston + Flare + Backdraft (+ Kickstart)': [[pv('flare'), pv('backdraft'), pv('piston'), pv('kick')], {}],
      'c3, Cleaver for Piston': [[pv('flare'), pv('backdraft'), pv('cleaver'), pv('kick')], {}],
      'c2 + Brace (torso)': [[pv('flare'), pv('brace'), pv('piston'), pv('kick')], {}],
    },
  }
  const C3 = { wake: B.wake['c3: Backhand + Skate + Frost Flare'][0], ram: B.ram['c3: Piston + Flare + Backdraft (+ Kickstart)'][0] }
  const extra = {
    wake: [
      ['c3 + Burst (BUILD: fill to cap, 0.6, a core hit)', { key: 'wake-burst' }],
      ['c3 + Burst: fill to cap, 1.0, a core hit (x0.5 boss)', { key: 'wake-burst', share: 1 }],
      ['c3 + Burst "two" (2nd ring: spend all, 1.0, a core hit)', { key: 'wake-burst', burst: 'twoAuto', share: 1 }],
      ['c3 + Deep (BUILD: cap 5, life 4)', { key: 'wake-deep' }],
      ['c3 + Deep, a boss skim marks 2 (cap 5, life 4)', { key: 'wake-deep', big: 2 }],
      ['c3 + Spray', { up: ['wake-spray'] }],
      ['c3 + Slip (skims x1.1)', { up: ['wake-slip'] }],
      ['SHIP c3 + Burst', SHIPKEY['wake-burst']], ['SHIP c3 + Deep', SHIPKEY['wake-deep']],
      ['c3 + Burst 1.0 + Spray + Slip', { key: 'wake-burst', share: 1, up: ['wake-spray', 'wake-slip'] }],
      ['c3 + Deep + Spray + Slip', { key: 'wake-deep', up: ['wake-spray', 'wake-slip'] }],
    ],
    ram: [
      ['c3 + Domino (BUILD)', { key: 'ram-domino' }],
      ['c3 + Domino, a chained slam deals the core hit (8)', { key: 'ram-domino', dhit: 8 }],
      ['c3 + Catch (BUILD: an extra shove on a tell)', { key: 'ram-catch' }],
      ['c3 + Catch, spends the caught body (1.0)', { key: 'ram-catch', catch: 'spend', share: 1 }],
      ['c3 + Catch on what can\'t be moved only, spends (1.0)', { key: 'ram-catch', catch: 'bossOnly', share: 1 }],
      ['c3 + Wide', { up: ['ram-wide'] }],
      ['c3 + Rubble', { up: ['ram-rubble'] }],
      ['SHIP c3 + Domino', SHIPKEY['ram-domino']], ['SHIP c3 + Catch', SHIPKEY['ram-catch']],
      ['c3 + Domino 8 + Wide + Rubble', { key: 'ram-domino', dhit: 8, up: ['ram-wide', 'ram-rubble'] }],
      ['c3 + Catch boss + Wide + Rubble', { key: 'ram-catch', catch: 'bossOnly', share: 1, up: ['ram-wide', 'ram-rubble'] }],
    ],
  }
  // Ram's pack c3 (Scrap Cleaver in arms) carries the pack keystone and the upgrades too
  if (process.env.RAMPACK) C3.ram = B.ram['c3, Cleaver for Piston'][0]
  const out = {}
  for (const core of sel) {
    const own = M(core, whites)
    console.log(`  ${core}: whites ${KINDS3.map((k) => `${k} ${own[k].t.toFixed(1)} s`).join(', ')}  (vs today's whites: ${cell(own, today)})`)
    out[core] = { whites: own }
    const row = (name, parts, o, base = own) => { const m = M(core, parts, o); out[core][name] = m; console.log(`    ${name.padEnd(58)} ${cell(m, base)} | vs today ${cell(m, today)} | ${info(m)}`); return m }
    for (const [name, [parts, o]] of Object.entries(B[core])) row(name, parts, o)
    row('all four III, flat', whites.map((p) => ({ ...p, rank: 2 })), {})
    row('c3 at II, flat', C3[core].map((p) => ({ ...p, rank: 1 })), {})
    row('c3 at III, flat', C3[core].map((p) => ({ ...p, rank: 2 })), {})
    for (const [name, o] of extra[core]) row(name, C3[core], o)
    // the whole build: c3, the pack keystone and both upgrades, at I and at III (the investor who builds)
    const full = core === 'wake' ? { ...SHIPKEY['wake-burst'], up: ['wake-spray', 'wake-slip'] } : { ...SHIPKEY['ram-domino'], up: ['ram-wide', 'ram-rubble'] }
    row('FULL (c3 + pack keystone + 2 upgrades) at I', C3[core], full)
    row('FULL at III, flat', C3[core].map((p) => ({ ...p, rank: 2 })), full)
    console.log('')
  }
  return out
}

// node build-sim.mjs r3m [n]: each fitting part's worth alone, in its slot over the white (deep / boss vs that core's whites).
function partDm() {
  const N = Number(process.argv[3] ?? 1500), NB = Math.max(150, Math.round(N / 6))
  const M = (core, parts, o = {}) => Object.fromEntries(['deep', 'boss', 'early'].map((k) => [k, measure3(core, parts, { ...o, kind: k }, k === 'boss' ? NB : N)]))
  const whites = WH.map((id) => pv(id)), slotOf = { head: 0, torso: 1, arms: 2, legs: 3 }
  const today = M('old', whites)
  const FIT = { wake: ['backhand', 'skate', 'fflare', 'spring', 'ward', 'piston', 'lens'], ram: ['piston', 'flare', 'backdraft', 'brace', 'lens'] }
  for (const core of (process.env.CORES ?? 'wake,ram').split(',')) {
    const own = M(core, whites)
    console.log(`  ${core} whites: deep ${own.deep.t.toFixed(2)} s boss ${own.boss.t.toFixed(1)} s (vs today: deep ${sg3(today.deep.t / own.deep.t - 1)}, boss ${sg3(today.boss.t / own.boss.t - 1)}, early ${sg3(today.early.t / own.early.t - 1)})`)
    for (const id of FIT[core]) {
      const parts = whites.slice(); parts[slotOf[P3[id].slot]] = pv(id)
      const m = M(core, parts)
      console.log(`    ${id.padEnd(10)} for the ${WH[slotOf[P3[id].slot]].padEnd(8)} early ${sg3(own.early.t / m.early.t - 1).padEnd(5)} deep ${sg3(own.deep.t / m.deep.t - 1).padEnd(5)} boss ${sg3(own.boss.t / m.boss.t - 1).padEnd(5)}  spent deep ${m.deep.spent.toFixed(1)} of ${m.deep.made.toFixed(1)}`)
    }
  }
}
// node build-sim.mjs r3f [n]: the never-melt floor (DESIGN.md: ~1 in 5). lean-sim's finish model (CURVE9 Broke: lognormal, HP lost ~ kill time^0.8),
// its never-melt HP-lost row, scaled so today's never-melt finishes 20% (lean 3-balancer pick B, live). Hesitation 3.7 s, rank I throughout.
// A cored never-melt run wears whites at d1-2, c1 at the d3 boss, c2 at d4-6, c3 at d7-9 (a committed picker, BUILD's hunt), or whites throughout.
// BRACE: HP lost x this with a core (the planted brace is gone; unknown, 1.0 and 1.1 shown).
function partDf() {
  const N = Number(process.argv[3] ?? 1500), NB = Math.max(150, Math.round(N / 6)), HES = 3.7
  const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
  const SIG = Math.sqrt(Math.log(1.25)), pAlive = (m, c) => { const mu = Math.log(m) - SIG * SIG / 2; return 0.5 * (1 + erf((Math.log(c) - mu) / (SIG * Math.SQRT2))) }
  const LOST = [55, 20, 88, 70, 63, 62, 73, 77, 70], SCRAP = [30, 30, 0, 15, 15, 0, 10, 10, 0], KIND = ['early', 'early', 'boss', 'deep', 'deep', 'boss', 'deep', 'deep', 'boss']
  const fin = (lam, r) => LOST.reduce((a, l, i) => a * pAlive(lam * l * r[i] ** 0.8, 100 + SCRAP[i]), 1)
  let lo = 0.3, hi = 3; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (fin(mid, LOST.map(() => 1)) > 0.2) lo = mid; else hi = mid } const lam = lo
  const T = (core, parts, k) => measure3(core, parts, { kind: k, hes: HES }, k === 'boss' ? NB : N).t
  const whites = WH.map((id) => pv(id)), today = Object.fromEntries(['early', 'deep', 'boss'].map((k) => [k, T('old', whites, k)]))
  const builds = {
    wake: { c1: ['lens', 'pvent', 'backhand', 'kick'], c2: ['lens', 'pvent', 'backhand', 'skate'], c3: ['fflare', 'pvent', 'backhand', 'skate'] },
    ram: { c1: ['flare', 'pvent', 'cleaver', 'kick'], c2: ['flare', 'backdraft', 'cleaver', 'kick'], c3: ['flare', 'backdraft', 'piston', 'kick'] },
  }
  console.log(`r3f: never-melt finish (today 20% by construction, lambda ${lam.toFixed(3)}), hesitation ${HES} s`)
  for (const core of ['wake', 'ram']) {
    const B = builds[core], at = (ids, k) => T(core, ids.map((id) => pv(id)), k) / today[k]
    const W = Object.fromEntries(['early', 'deep', 'boss'].map((k) => [k, at(WH, k)]))
    const rw = KIND.map((k) => W[k])
    const rb = KIND.map((k, i) => i < 2 ? W[k] : at(i === 2 ? B.c1 : i < 6 ? B.c2 : B.c3, k))
    for (const [name, r] of [['whites throughout', rw], ['committed (c1 at d3, c2 d4-6, c3 d7-9)', rb]])
      console.log(`  ${core.padEnd(5)} ${name.padEnd(40)} kill time vs today ${r.map((x) => x.toFixed(2)).join(' ')}   finish ${pct(fin(lam, r))} (no-brace x1.1: ${pct(fin(lam * 1.1, r))})`)
  }
}
if (MODE === 'r3f') partDf()
if (MODE === 'r3m') partDm()
if (MODE === 'r3') partD()
if (MODE === 'r2') partC()
if (MODE === 'fight' || MODE === 'all') partA()
if (MODE === 'pool' || MODE === 'all') partB()
