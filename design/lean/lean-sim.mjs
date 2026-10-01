// Lean sim (balancer, rounds 1-3). Run: node design/lean/lean-sim.mjs (r1) | ... r2 | ... r3 [fast]
// r3 env CAND='[["name",{hp1,n1,hp,n,bossHp,pow}],...]' adds candidates to the detail + strain table.
// Part A: the pack/boss Monte Carlo of design/autos/autos-sim2.mjs (same engine, same calibration: HAND_P .7,
// EYE_P .25, hesitation 3.7 s never-melt / 1.3 s investor), extended with: enemy HP multipliers (packs, bosses),
// part power as damage (per slot) or as area (more bodies per cast), and kill attribution (last hit).
// Part B: the strain economy over the 9-depth run (CURVE9 Works-first) for each push variant, crossed with the
// CURVE9 Broke model (lognormal CV .5, HP lost ~ kill time^0.8), so a run ends Broke, Stopped or Made it.
// No geometry: shove, stagger, a break's defence, hits not taken are invisible here. Say so when it matters.
const BEAT = 0.62, DT = 0.02
const PLAYERS = { floor: { rank: 0, hesit: 3.7, stateMul: 1 }, invest: { rank: 2, hesit: 1.3, stateMul: 1.25 } }
const T_DMG = [1, 1.3, 1.6], T_CD = [1, 0.85, 0.72]
// white loadout (abilities.ts): Focusing Lens 26/4.2, Pressure Vent 15/6.5, Scrap Cleaver 18/2.6, Kickstart 12/8
const BASE_PARTS = [
  { slot: 'head', dmg: 26, cd: 4.2, hits: 'priority', p2: 0 },
  { slot: 'torso', dmg: 15, cd: 6.5, hits: 'each', p: 0.6 },
  { slot: 'arms', dmg: 18, cd: 2.6, hits: 'arc', p2: 0.5 },
  { slot: 'legs', dmg: 12, cd: 8, hits: 'each', p: 0.35 },
]
const HAND_P = 0.7, EYE_P = 0.25
// round 2 (c): hitstop formulas, ms by event. kind: contact (a part cast that struck n bodies; cd its cooldown s),
// partKill, autoKill, autoHit. Live today (main.ts): cast 35 on the press hit or miss (pushed 60), each kill 80, auto beat 22.
const HS = [
  { name: 'live today', f: (k, cd, n) => ({ contact: 35, partKill: 80, autoKill: 80, autoHit: 22 })[k] },
  { name: 'balancer r1: 30+8cd cap 100', f: (k, cd, n) => k === 'contact' ? Math.min(100, 30 + 8 * cd) : ({ partKill: 80, autoKill: 80, autoHit: 22 })[k] },
  { name: 'translator r1: 50+12/body cap 100', f: (k, cd, n) => k === 'contact' ? Math.min(100, 50 + 12 * (n - 1)) : ({ partKill: 90, autoKill: 35, autoHit: 22 })[k] },
  { name: 'agreed: 30+6cd+10/body cap 100', f: (k, cd, n) => k === 'contact' ? Math.min(100, 30 + 6 * cd + 10 * (n - 1)) : ({ partKill: 90, autoKill: 35, autoHit: 0 })[k] },
  { name: 'agreed, parts only (no auto freeze)', f: (k, cd, n) => k === 'contact' ? Math.min(100, 30 + 6 * cd + 10 * (n - 1)) : ({ partKill: 90, autoKill: 0, autoHit: 0 })[k] },
  { name: 'agreed, auto beat kept at 22', f: (k, cd, n) => k === 'contact' ? Math.min(100, 30 + 6 * cd + 10 * (n - 1)) : ({ partKill: 90, autoKill: 35, autoHit: 22 })[k] },
]
let seed = 7
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

// opt: { hp, bossHp, mul: {head,torso,arms,legs}, area: bool }
function fight(who, opt, boss) {
  // round 3: opt.early = d1-2, nobody has melted much yet: every player at white (rank 0, no states), own hesitation
  const P = opt.early ? { ...PLAYERS[who], rank: 0, stateMul: 1 } : PLAYERS[who]
  const hpMul = boss ? opt.bossHp : opt.hp
  // round 2: opt.n bodies a pack (default 4: three 30s and a 20 at the back); more bodies = more 30s
  const n0 = opt.n ?? 4, pk = [...Array(n0 - 1).fill(30), 20]
  const bodies = (boss ? [900] : pk).map((hp, i) => ({ hp: hp * hpMul, back: !boss && i === n0 - 1, dead: false }))
  const parts = BASE_PARTS.map((p) => {
    const q = { ...p, cd: p.cd * T_CD[P.rank], dmg: p.dmg * T_DMG[P.rank] * P.stateMul * (opt.mul?.[p.slot] ?? 1), wait: -1 }
    // area (no blue's identity borrowed: the head gets none, so Cracked Lens keeps pierce): vent radius x1.25 and dash
    // half-width x1.5 ~ p +0.25 a body; cleaver cone 120 -> 160 ~ 2nd body .5 -> .8, a 3rd at .3
    if (opt.area) { if (q.hits === 'each') q.p = Math.min(0.95, q.p + 0.25); if (q.hits === 'arc') { q.p2 = 0.8; q.p3 = 0.3 } }
    // round 3: area 2 = vent radius x1.4, dash half-width x2, cleaver 180 deg ~ p +0.35, 2nd body .9, 3rd .45
    if (opt.area === 2) { if (q.hits === 'each') q.p = Math.min(0.95, p.p + 0.35); if (q.hits === 'arc') { q.p2 = 0.9; q.p3 = 0.45 } }
    q.t = rng() * q.cd
    return q
  })
  let t = 0, beat = 0
  const st = { t: 0, auto: 0, part: 0, kills: 0, partKills: 0, casts: 0, bs: 0, hit: 0, frz: HS.map(() => 0) }
  const hsS = HS.map(() => ({ end: -9, ms: 0 }))
  // a freeze: global (enemy timers stop too, so game time t does not move); one that starts within 200 ms of the last
  // freeze's end merges into it (only the excess over the running one is added), as Math.max(hitstop, x) does live
  const freeze = (kind, cd, n) => HS.forEach((h, i) => { const ms = h.f(kind, cd, n); if (!ms) return; const s = hsS[i]; if (t - s.end < 0.2) { const add = Math.max(0, ms - s.ms); st.frz[i] += add; s.ms = Math.max(s.ms, ms); s.end = t } else { st.frz[i] += ms; s.ms = ms; s.end = t } })
  let nHit = 0
  const alive = () => bodies.filter((b) => !b.dead)
  const hurt = (b, d, src) => {
    if (b.dead) return
    const dealt = Math.min(b.hp, d) // overkill doesn't count: share = damage that mattered
    b.hp -= d
    st[src] += dealt
    if (src === 'part') nHit++; else freeze('autoHit', 0, 1)
    if (b.hp <= 0) { b.dead = true; st.kills++; if (src === 'part') st.partKills++; freeze(src === 'part' ? 'partKill' : 'autoKill', 0, 1) }
  }
  while (alive().length && t < 600) {
    t += DT
    st.bs += alive().length * DT
    for (const p of parts) {
      p.t -= DT
      if (p.t <= 0 && p.wait < 0) p.wait = -Math.log(1 - rng()) * P.hesit * (who === 'floor' ? opt.hes ?? 1 : 1)
      if (p.wait >= 0) {
        p.wait -= DT
        if (p.wait <= 0) {
          p.wait = -1; p.t = p.cd; st.casts++
          const a = alive(); if (!a.length) break
          if (p.hits === 'priority') { const b = a.find((x) => x.back) ?? a[0]; hurt(b, p.dmg, 'part'); const n = a.find((x) => x !== b && !x.dead); if (n && rng() < p.p2) hurt(n, p.dmg, 'part') }
          else if (p.hits === 'arc') { hurt(a[0], p.dmg, 'part'); if (a[1] && rng() < p.p2) hurt(a[1], p.dmg, 'part'); if (a[2] && p.p3 && rng() < p.p3) hurt(a[2], p.dmg, 'part') }
          else for (const b of a) if (rng() < p.p) hurt(b, p.dmg, 'part')
          if (nHit) { st.hit += nHit; freeze('contact', p.cd, nHit) }
          nHit = 0
        }
      }
    }
    beat -= DT
    if (beat <= 0) {
      beat = BEAT
      const a = alive(); if (!a.length) break
      const r = rng(), form = r < HAND_P ? 'hand' : r < HAND_P + EYE_P ? 'eye' : null
      if (!form) continue
      const cand = form === 'hand' ? a.slice(0, 2) : [...a.filter((b) => b.back), ...a.filter((b) => !b.back)]
      let dmg = form === 'hand' ? 10 : 8
      if (boss) dmg *= 0.5
      hurt(cand[0], dmg, 'auto')
      if (form === 'eye' && cand[1] && rng() < 0.3) hurt(cand[1], dmg, 'auto')
    }
  }
  st.t = t
  return st
}
function measure(who, opt, boss, N) {
  const n = N ?? (boss ? 300 : 2500), acc = { t: 0, auto: 0, part: 0, kills: 0, partKills: 0, casts: 0, bs: 0, hit: 0 }, frz = HS.map(() => 0)
  for (let i = 0; i < n; i++) { const s = fight(who, opt, boss); for (const k in acc) acc[k] += s[k]; s.frz.forEach((x, j) => (frz[j] += x)) }
  for (const k in acc) acc[k] /= n
  acc.frz = frz.map((x) => x / n)
  return acc
}

// ---- finish model (CURVE9 §2, Works-first; HP lost per check floor / median / investor; scrap) ----
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
const SIG = Math.sqrt(Math.log(1.25))
const pAlive = (m, cap) => { const mu = Math.log(m) - SIG * SIG / 2; return 0.5 * (1 + erf((Math.log(cap) - mu) / (SIG * Math.SQRT2))) }
// [name, kind, crawl hp mul (1 or 1.3 bucket), scrap, lost f/m/i, boss?]
const CHECKS = [['d1', 'c1', 30, [55, 53, 51]], ['d2', 'c1', 30, [20, 18, 15]], ['d3', 'b', 0, [88, 67, 47]], ['d4', 'c13', 15, [70, 55, 40]], ['d5', 'c13', 15, [63, 42, 31]], ['d6', 'b', 0, [62, 37, 28]], ['d7', 'c13', 10, [73, 49, 40]], ['d8', 'c13', 10, [77, 49, 42]], ['d9', 'b', 0, [70, 46, 40]]]

// ---- Part A ----
const pct = (x) => `${Math.round(x * 100)}%`
const base = (o) => ({ hp: 1, bossHp: 1, mul: {}, area: false, ...o })
const OPTS = [
  ['today', base({})],
  ['HP x1.5, parts x1', base({ hp: 1.5, bossHp: 1.5 })],
  ['HP x1.5, parts x1.5', base({ hp: 1.5, bossHp: 1.5, mul: { head: 1.5, torso: 1.5, arms: 1.5, legs: 1.5 } })],
  ['HP x1.5, parts x2', base({ hp: 1.5, bossHp: 1.5, mul: { head: 2, torso: 2, arms: 2, legs: 2 } })],
  ['HP x2, parts x2', base({ hp: 2, bossHp: 2, mul: { head: 2, torso: 2, arms: 2, legs: 2 } })],
  ['HP x2, parts x2.6', base({ hp: 2, bossHp: 2, mul: { head: 2.6, torso: 2.6, arms: 2.6, legs: 2.6 } })],
  ['pack x1.5 boss x1, parts x1.5', base({ hp: 1.5, bossHp: 1, mul: { head: 1.5, torso: 1.5, arms: 1.5, legs: 1.5 } })],
  ['pack x1.5, boss x1.25, weak x2 strong x1.4', base({ hp: 1.5, bossHp: 1.25, mul: { head: 1.4, torso: 2, arms: 1.4, legs: 2 } })],
  ['pack x1.5, boss x1.25, area + weak x1.6', base({ hp: 1.5, bossHp: 1.25, area: true, mul: { head: 1.25, torso: 1.6, arms: 1.25, legs: 1.6 } })],
  ['pack x1.5, boss x1.25, area only', base({ hp: 1.5, bossHp: 1.25, area: true, mul: { head: 1.25, torso: 1.25, arms: 1.25, legs: 1.25 } })],
  ['pack x1.4, boss x1.2, area + torso/legs x1.6', base({ hp: 1.4, bossHp: 1.2, area: true, mul: { head: 1.1, torso: 1.6, arms: 1.1, legs: 1.6 } })],
  ['pack x1.6, boss x1.2, area + torso/legs x2', base({ hp: 1.6, bossHp: 1.2, area: true, mul: { head: 1.2, torso: 2, arms: 1.2, legs: 2 } })],
  ['pack x1.5, boss x1.2, area + torso/legs x1.8', base({ hp: 1.5, bossHp: 1.2, area: true, mul: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 } })],
  ['pack x1.25, boss x1.1, area + torso/legs x1.5', base({ hp: 1.25, bossHp: 1.1, area: true, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  // round 2 (b): more bodies a pack instead of / alongside HP. n = bodies (today 4: 30/30/30/20 = 110 HP).
  // n5 at HP x1 = 140 HP, the same total as 4 bodies at x1.25 (137.5). Damage taken ~ body-seconds, not kill time.
  ['n5, HP x1, parts x1', base({ n: 5 })],
  ['n5, HP x1, area + torso/legs x1.5', base({ n: 5, bossHp: 1.1, area: true, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  ['n6, HP x1, area + torso/legs x1.5', base({ n: 6, bossHp: 1.1, area: true, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  ['n5, HP x0.85, area + torso/legs x1.5', base({ n: 5, hp: 0.85, bossHp: 1.1, area: true, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  ['n5, HP x1.1, area + torso/legs x1.5', base({ n: 5, hp: 1.1, bossHp: 1.1, area: true, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  ['  same, never-melt presses 25% sooner', base({ hp: 1.25, bossHp: 1.1, area: true, hes: 0.75, mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 } })],
  ['pack x1.5 x1.8 row, never-melt 25% sooner', base({ hp: 1.5, bossHp: 1.2, area: true, hes: 0.75, mul: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 } })],
]
const BASE = {}, R3 = process.argv[2] === 'r3'
if (!R3) for (const who of ['floor', 'invest']) { BASE[who] = { c1: measure(who, base({}), false), c13: measure(who, base({ hp: 1.3 }), false), b: measure(who, base({}), true) } }
console.log('PART A. Cells never-melt / investor. pack x = pack kill time vs today (crawl HP 1.3 bucket); boss x; part share = part damage that mattered;')
console.log('part kills = last hit by a part; casts per pack fight / per boss fight; finish at 9 = never-melt / median / investor (today 31/74/91).')
const ROWS = {}
const R2 = process.argv[2] === 'r2'
const R2_OPTS = ['today', 'pack x1.25, boss x1.1, area + torso/legs x1.5', 'n5, HP x1, parts x1', 'n5, HP x1, area + torso/legs x1.5', 'n6, HP x1, area + torso/legs x1.5', 'n5, HP x0.85, area + torso/legs x1.5', 'n5, HP x1.1, area + torso/legs x1.5']
for (const [name, o] of OPTS) {
  if (R3) break
  if (R2 && !R2_OPTS.includes(name)) continue
  const row = {}
  for (const who of ['floor', 'invest']) {
    const c1 = measure(who, o, false), c13 = measure(who, { ...o, hp: o.hp * 1.3 }, false), b = measure(who, o, true)
    row[who] = { c1: c1.t / BASE[who].c1.t, c13: c13.t / BASE[who].c13.t, b: b.t / BASE[who].b.t, bs1: c1.bs / BASE[who].c1.bs, bs13: c13.bs / BASE[who].c13.bs, m13: c13, mb: b, share: c13.part / (c13.part + c13.auto), bshare: b.part / (b.part + b.auto), pk: c13.partKills / c13.kills, casts: c13.casts, bcasts: b.casts, bt: b.t, pt: c13.t }
  }
  const fin = [0, 1, 2].map((w) => CHECKS.reduce((acc, [, k, scrap, lost]) => { const x = w === 0 ? row.floor[k] : w === 2 ? row.invest[k] : (row.floor[k] + row.invest[k]) / 2; return acc * pAlive(lost[w] * x ** 0.8, 100 + scrap) }, 1))
  // the same finish model with HP lost ~ body-seconds^0.8 on the crawl checks (bosses as before): the honest one for n
  const finBS = [0, 1, 2].map((w) => CHECKS.reduce((acc, [, k, scrap, lost]) => { const kk = k === 'b' ? 'b' : k === 'c1' ? 'bs1' : 'bs13'; const x = w === 0 ? row.floor[kk] : w === 2 ? row.invest[kk] : (row.floor[kk] + row.invest[kk]) / 2; return acc * pAlive(lost[w] * x ** 0.8, 100 + scrap) }, 1))
  row.fin = fin; row.finBS = finBS; ROWS[name] = row
  const f = row.floor, v = row.invest
  console.log(`  ${name.padEnd(44)} pack ${f.c13.toFixed(2)}/${v.c13.toFixed(2)} boss ${f.b.toFixed(2)}/${v.b.toFixed(2)}  part share ${pct(f.share)}/${pct(v.share)} (boss ${pct(f.bshare)}/${pct(v.bshare)})  part kills ${pct(f.pk)}/${pct(v.pk)}  casts ${f.casts.toFixed(1)}/${v.casts.toFixed(1)} boss ${f.bcasts.toFixed(0)}/${v.bcasts.toFixed(0)} (${f.bt.toFixed(0)}/${v.bt.toFixed(0)} s)  finish ${fin.map((x) => Math.round(x * 100)).join('/')}  body-s ${f.bs13.toFixed(2)}/${v.bs13.toFixed(2)} finish(body-s) ${finBS.map((x) => Math.round(x * 100)).join('/')}`)
}

// ---- part power per second on one body (the 'weakest parts' table) ----
if (!R2 && !R3) console.log('\nOne-body DPS at white (damage / cooldown); the close strike is 10/0.62 = 16.1')
if (!R2 && !R3) for (const [n, d, cd] of [['Focusing Lens', 26, 4.2], ['Scrap Cleaver', 18, 2.6], ['Piston', 20, 3], ['Frayed Cleaver', 16, 2.6], ['Flare', 18, 4.2], ['Cracked Lens', 20, 4.6], ['Through-Line', 24, 6], ['Patient Lens (full)', 32, 7.5], ['Rusted Hook', 12, 3.2], ['Parry Clamp', 10, 3.6], ['Pressure Vent', 15, 6.5], ['Backdraft Vent', 12, 6.5], ['Chill Vent', 10, 6.5], ['Signal Flare', 12, 5], ['Lure', 18, 12], ['Skid Plates (8+10)', 18, 8], ['Kickstart', 12, 8], ['Plumb Line', 14, 9], ['Brace', 8, 9]]) process.stdout.write(`${n} ${(d / cd).toFixed(1)} · `)
console.log()

// ---- Part B: strain over the 9-depth run ----
// Per depth: fights (log runs 9-20: d1 7.6, d2 5.4, crawl 4-8 ~5.5), shrines (GUESS: Rest used 0.3 a crawl depth, Plenty
// taken 0.2), the Assembler's second pick +4 kept (GUESS 0.4). Quiet -2 per fight, floor = floor(strainIn x .5) or kept.
// Pushes today (log runs 9-20): per crawl fight 0.56 (d1) 0.5 (d2) 0.3 (d4) 0.2 (d5+); boss pushes resampled from the
// d3 log {1,4,1,1,9,7,0,0,3,0,3}; d6 and d9 the same x0.5 (log d6 {0,1,3}, d9 {0}).
// Casts (V1): per pack fight and per boss fight from Part A for the option, scaled to the log (crawl 2.3-4.6 a fight,
// Assembler 25): each player x his own sim casts / the sim's mean of the two.
const FIGHTS = [8, 5, 1, 6, 5, 1, 5, 5, 1], BOSS = [2, 5, 8], CRAWL_PUSH = [0.56, 0.5, 0, 0.3, 0.2, 0, 0.2, 0.2, 0]
const LOG_CASTS = [2.3, 2.8, 25, 4.6, 4.6, 23, 4.4, 4.4, 20]
const BOSS_PUSHES = [1, 4, 1, 1, 9, 7, 0, 0, 3, 0, 3]
const pois = (l) => { let k = 0, p = Math.exp(-l), s = p, u = rng(); while (u > s && k < 50) { k++; p *= l / k; s += p } return k }
const LOST = [[55, 53, 51], [20, 18, 15], [88, 67, 47], [70, 55, 40], [63, 42, 31], [62, 37, 28], [73, 49, 40], [77, 49, 42], [70, 46, 40]], SCRAP = [30, 30, 0, 15, 15, 0, 10, 10, 0]
const lnorm = (m) => { const mu = Math.log(m) - SIG * SIG / 2; const z = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng()); return Math.exp(mu + SIG * z) }
// v: { cast: strain per ready cast, push: strain per push, pushMul: pushes x, eager: accidental pushes a crawl depth, decay }
function run(w, v, row) {
  const who = w === 0 ? 'floor' : w === 2 ? 'invest' : row.median ? 'median' : null
  const kx = (k) => (who ? row[who][k] : (row.floor[k] + row.invest[k]) / 2)
  const castMul = (boss) => { const k = boss ? 'bcasts' : 'casts'; const m = (row.floor[k] + row.invest[k]) / 2, b0 = (ROWS.today.floor[k] + ROWS.today.invest[k]) / 2; return (who ? row[who][k] : m) / b0 }
  let s = 0, kept = 0, pushes = 0, fights = 0
  for (let d = 0; d < 9; d++) {
    const boss = BOSS.includes(d), sIn = s, floorS = () => Math.max(Math.floor(sIn * (v.keep ?? 0.5)), kept)
    if (!boss) { if (rng() < 0.2) s += 4; if (rng() < 0.3) s = Math.max(0, s - (v.rest ?? 6)) }
    if (s >= (v.cap ?? 20)) return { end: 'stopped', d, pushes, fights }
    for (let f = 0; f < FIGHTS[d]; f++) {
      fights++
      let n = boss ? BOSS_PUSHES[Math.floor(rng() * BOSS_PUSHES.length)] * (d === 2 ? 1 : 0.5) : pois(CRAWL_PUSH[d])
      { const y = n * v.pushMul; n = Math.floor(y) + (rng() < y % 1 ? 1 : 0) }
      if (!boss && v.eager) n += pois(v.eager / FIGHTS[d])
      pushes += n
      const casts = v.cast ? pois(LOG_CASTS[d] * castMul(boss) * (v.lean ?? 1)) : 0
      s += Math.max(0, n - (v.free ?? 0)) * v.push + casts * v.cast
      if (s >= (v.cap ?? 20)) return { end: 'stopped', d, pushes, fights }
      s = Math.max(Math.min(s, floorS()), s - (v.decay ?? 2))
    }
    if (d === 2 && rng() < 0.4) { s += 4; kept = Math.max(kept, 4) }
    if (s >= (v.cap ?? 20)) return { end: 'stopped', d, pushes, fights }
    const x = kx(boss ? 'b' : d < 2 ? (v.bs ? 'bs1' : 'c1') : (v.bs ? 'bs13' : 'c13'))
    if (lnorm(LOST[d][w] * x ** 0.8) > 100 + SCRAP[d]) return { end: 'broke', d, pushes, fights }
  }
  return { end: 'made', d: 9, pushes, fights }
}
const VARIANTS = [
  ['V0 today: hold to push, +2', { cast: 0, push: 2, pushMul: 1 }],
  ['V0, he pushes x2', { cast: 0, push: 2, pushMul: 2 }],
  ['V1 every cast +0.25 (today\'s flow)', { cast: 0.25, push: 0, pushMul: 0 }],
  ['V1 every cast +0.35', { cast: 0.35, push: 0, pushMul: 0 }],
  ['V1 +0.35, he leans: casts x1.3', { cast: 0.35, push: 0, pushMul: 0, lean: 1.3 }],
  ['V1 every cast +0.5', { cast: 0.5, push: 0, pushMul: 0 }],
  ['V1 every cast +1', { cast: 1, push: 0, pushMul: 0 }],
  ['V1 +1, quiet -5', { cast: 1, push: 0, pushMul: 0, decay: 5 }],
  ['V2 tap pushes +2, x1.5, eager 0.6', { cast: 0, push: 2, pushMul: 1.5, eager: 0.6 }],
  ['V2 tap pushes +2, x2, eager 0.6', { cast: 0, push: 2, pushMul: 2, eager: 0.6 }],
  ['V3 casts +0.25, tap push +3, x1.5', { cast: 0.25, push: 3, pushMul: 1.5, eager: 0.6 }],
  ['V4 tap pushes +2 (buffer), x1.5', { cast: 0, push: 2, pushMul: 1.5 }],
  ['V4 tap pushes +2 (buffer), x2', { cast: 0, push: 2, pushMul: 2 }],
  ['V4 x1.5, quiet -3', { cast: 0, push: 2, pushMul: 1.5, decay: 3 }],
  ['V4 x2, quiet -3', { cast: 0, push: 2, pushMul: 2, decay: 3 }],
]
if (!R2 && !R3) for (const optName of ['today', process.env.LEAN_OPT ?? 'pack x1.25, boss x1.1, area + torso/legs x1.5']) {
  console.log(`\nPART B (enemies: ${optName}). Broke / Stopped / Made it, never-melt | median | investor; pushes a fight (median); Stopped at the bosses`)
  for (const [name, v] of VARIANTS) {
    const out = [0, 1, 2].map((w) => { const c = { broke: 0, stopped: 0, made: 0, pushes: 0, fights: 0, sBoss: 0 }; const N = 20000; for (let i = 0; i < N; i++) { const r = run(w, v, ROWS[optName]); c[r.end]++; c.pushes += r.pushes; c.fights += r.fights; if (r.end === 'stopped' && BOSS.includes(r.d)) c.sBoss++ } return { ...c, N } })
    const cell = (c) => `${Math.round(100 * c.broke / c.N)}/${Math.round(100 * c.stopped / c.N)}/${Math.round(100 * c.made / c.N)}`
    console.log(`  ${name.padEnd(38)} ${out.map(cell).join(' | ')}   pushes/fight ${(out[1].pushes / out[1].fights).toFixed(2)}   Stopped at bosses ${pct(out[1].sBoss / Math.max(1, out[1].stopped))}`)
  }
}

// ================= ROUND 2 (node design/lean/lean-sim.mjs r2) =================
if (R2) {
  const PICK = 'pack x1.25, boss x1.1, area + torso/legs x1.5'
  const sim = (v, optName, N = 12000) => [0, 1, 2].map((w) => { const c = { broke: 0, stopped: 0, made: 0, pushes: 0, fights: 0, sBoss: 0, s3: 0, s6: 0 }; for (let i = 0; i < N; i++) { const r = run(w, v, ROWS[optName]); c[r.end]++; c.pushes += r.pushes; c.fights += r.fights; if (r.end === 'stopped') { if (BOSS.includes(r.d)) c.sBoss++; if (r.d <= 2) c.s3++; if (r.d <= 5) c.s6++ } } for (const k in c) c[k] /= N; return c })
  const cell = (c) => `${Math.round(100 * c.broke)}/${Math.round(100 * c.stopped)}/${Math.round(100 * c.made)}`
  const line = (name, out) => console.log(`  ${name.padEnd(50)} ${out.map(cell).join(' | ')}   p/f ${(out[1].pushes / out[1].fights).toFixed(2)}  Stopped by d3 ${pct(out[1].s3)} by d6 ${pct(out[1].s6)}  at bosses ${pct(out[1].sBoss / Math.max(1e-9, out[1].stopped))}`)
  console.log(`\nPART C (a): V4 strain retune, enemies = ${PICK}. Broke/Stopped/Made never-melt | median | investor`)
  const V0 = sim({ cast: 0, push: 2, pushMul: 1 }, PICK); line('V0 today (target)', V0)
  for (const m of [1.25, 1.5, 2]) {
    console.log(` pushes x${m}:`)
    line('unchanged (cap 20, quiet -2, Rest -6, keep .5)', sim({ cast: 0, push: 2, pushMul: m }, PICK))
    const grid = []
    for (const cap of [20, 22, 24, 26]) for (const decay of [2, 3]) for (const rest of [6, 8]) for (const free of [0, 1]) for (const keep of [0.5, 0.35]) {
      const v = { cast: 0, push: 2, pushMul: m, cap, decay, rest, free, keep }, out = sim(v, PICK, 5000)
      const err = Math.abs(out[1].made - V0[1].made) + 0.5 * Math.abs(out[0].made - V0[0].made) + 0.5 * Math.abs(out[2].made - V0[2].made)
      const knobs = (cap !== 20) + (decay !== 2) + (rest !== 6) + (free !== 0) + (keep !== 0.5)
      grid.push({ v, out, err, knobs, name: `cap ${cap} quiet -${decay} Rest -${rest} free ${free} keep ${keep}` })
    }
    // best per number of knobs changed, with median Stopped kept >= 8% (Stopped must stay reachable)
    for (const k of [1, 2]) { const best = grid.filter((g) => g.knobs === k && g.out[1].stopped >= 0.08).sort((a, b) => a.err - b.err).slice(0, 3); for (const g of best) line(`${k} knob: ${g.name}`, sim(g.v, PICK)) }
  }
  console.log(' single knobs at x1.5:')
  for (const [n, v] of [['cap 22', { cap: 22 }], ['cap 24', { cap: 24 }], ['quiet -3', { decay: 3 }], ['Rest -8', { rest: 8 }], ['first push a fight free', { free: 1 }], ['keep .35', { keep: 0.35 }], ['cap 24 + first push free', { cap: 24, free: 1 }]]) line(n, sim({ cast: 0, push: 2, pushMul: 1.5, ...v }, PICK))

  console.log('\nPART D (b): bodies a pack. pack = kill time vs today; body-s = alive bodies x seconds vs today (damage-taken proxy);')
  console.log('part kills; bodies a cast; finish = kill-time model | body-seconds model, never-melt/median/investor')
  for (const name of R2_OPTS) { const r = ROWS[name], f = r.floor, v = r.invest; console.log(`  ${name.padEnd(40)} pack ${f.c13.toFixed(2)}/${v.c13.toFixed(2)} (d1-2 ${f.c1.toFixed(2)}/${v.c1.toFixed(2)})  body-s ${f.bs13.toFixed(2)}/${v.bs13.toFixed(2)}  share ${pct(f.share)}/${pct(v.share)}  part kills ${pct(f.pk)}/${pct(v.pk)}  bodies a cast ${(f.m13.hit / f.m13.casts).toFixed(2)}/${(v.m13.hit / v.m13.casts).toFixed(2)}  finish ${r.fin.map((x) => Math.round(x * 100)).join('/')} | ${r.finBS.map((x) => Math.round(x * 100)).join('/')}`) }

  console.log('\nPART E (c): hitstop budget = frozen / (fight + frozen), pack (1.3 bucket) and boss, never-melt / investor; ms a pack fight')
  for (const name of ['today', PICK, 'n5, HP x1, area + torso/legs x1.5']) {
    const r = ROWS[name]; console.log(` ${name}`)
    HS.forEach((h, i) => { const fr = (m) => m.frz[i] / (m.t * 1000 + m.frz[i]); console.log(`   ${h.name.padEnd(36)} pack ${pct(fr(r.floor.m13))}/${pct(fr(r.invest.m13))} (${r.floor.m13.frz[i].toFixed(0)}/${r.invest.m13.frz[i].toFixed(0)} ms)  boss ${pct(fr(r.floor.mb))}/${pct(fr(r.invest.mb))}`) })
  }
  const ex = HS[3].f
  console.log('  agreed contact ms (cd s; bodies 1/3/5): ' + [['Cleaver', 2.6], ['Lens', 4.2], ['Vent', 6.5], ['Kickstart', 8], ['Lure', 12]].map(([n, cd]) => `${n} ${[1, 3, 5].map((b) => ex('contact', cd, b)).join('/')}`).join(' · '))
}

// ================= ROUND 3 (node design/lean/lean-sim.mjs r3) =================
// New target (DESIGN.md "The floor player", 1 Oct): never-melt finishes ~1 in 5; judge by median and investor first.
// New here: a real median player (rank I, hesitation 2.3 s, states x1.1; before, the median was the mean of the other
// two); d1-2 fights at white for everyone (opt.early); depth-split packs (d1-2: hp1/n1, d4+: hp/n); area 2.
// Finish uses body-seconds^0.8 on crawl checks (honest for pack size), kill time on bosses. Strain untouched.
if (R3) {
  PLAYERS.median = { rank: 1, hesit: 2.3, stateMul: 1.1 }
  const WHO = ['floor', 'median', 'invest'], FAST = process.argv[3] === 'fast'
  const NP = FAST ? 600 : 2000, NB = FAST ? 100 : 250
  const cache = new Map()
  const M = (who, o, boss) => { const k = JSON.stringify([who, o, boss]); if (!cache.has(k)) cache.set(k, measure(who, o, boss, boss ? NB : NP)); return cache.get(k) }
  const POW = {
    P0: { mul: {}, area: false, txt: 'parts today' },
    P1: { mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 }, area: true, txt: 'r1 pick: area 1, t/l x1.5, h/a x1.1' },
    P2: { mul: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 }, area: true, txt: 'area 1, t/l x1.8, h/a x1.15' },
    P3: { mul: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 }, area: 2, txt: 'area 2, t/l x1.5, h/a x1.1' },
    P4: { mul: { head: 1.2, torso: 1.8, arms: 1.2, legs: 1.8 }, area: 2, txt: 'area 2, t/l x1.8, h/a x1.2' },
    P5: { mul: { head: 1.1, torso: 2, arms: 1.1, legs: 2 }, area: 2, txt: 'area 2, t/l x2, h/a x1.1' },
  }
  // option: { hp1, n1 (d1-2), hp, n (d4+, x1.3 bucket on top), bossHp, pow }
  const BASEO = { hp1: 1, n1: 4, hp: 1, n: 4, bossHp: 1, pow: 'P0' }
  const rowOf = (o) => {
    o = { ...BASEO, ...o }; const P = POW[o.pow], row = {}
    for (const who of WHO) {
      const c1 = M(who, { hp: o.hp1, n: o.n1, bossHp: 1, mul: P.mul, area: P.area, early: true }, false)
      const c13 = M(who, { hp: o.hp * 1.3, n: o.n, bossHp: 1, mul: P.mul, area: P.area }, false)
      const b = M(who, { hp: 1, bossHp: o.bossHp, mul: P.mul, area: P.area }, true)
      const B1 = M(who, { hp: 1, n: 4, bossHp: 1, mul: {}, area: false, early: true }, false), B13 = M(who, { hp: 1.3, n: 4, bossHp: 1, mul: {}, area: false }, false), BB = M(who, { hp: 1, bossHp: 1, mul: {}, area: false }, true)
      row[who] = { c1: c1.t / B1.t, c13: c13.t / B13.t, b: b.t / BB.t, bs1: c1.bs / B1.bs, bs13: c13.bs / B13.bs, pk1: c1.partKills / c1.kills, pk13: c13.partKills / c13.kills, sh1: c1.part / (c1.part + c1.auto), sh13: c13.part / (c13.part + c13.auto), shb: b.part / (b.part + b.auto), bpc: c13.hit / c13.casts, t1: c1.t, t13: c13.t }
    }
    return row
  }
  const finish = (row, mode = 'bs', e = 0.8) => WHO.map((who, w) => CHECKS.reduce((acc, [, k, scrap, lost]) => { const kk = k === 'b' ? 'b' : mode === 'kt' ? k : k === 'c1' ? 'bs1' : 'bs13'; return acc * pAlive(lost[w] * row[who][kk] ** e, 100 + scrap) }, 1))
  const F = (a) => a.map((x) => Math.round(x * 100)).join('/')
  const r2 = (x) => x.toFixed(2)
  const T = (row, k) => WHO.map((w) => (k.startsWith('pk') || k.startsWith('sh') ? pct(row[w][k]) : r2(row[w][k]))).join('/')
  const desc = (o) => { o = { ...BASEO, ...o }; return `d1-2 n${o.n1} x${o.hp1} | d4+ n${o.n} x${o.hp} | boss x${o.bossHp} | ${o.pow}` }
  console.log('ROUND 3. Cells never-melt/median/investor. kill = pack kill time vs today; body-s = alive bodies x s vs today;')
  console.log('pk = part kills (last hit); share = part damage that mattered; finish bs = body-s^0.8 model (kt = kill-time model; e.3 = body-s^0.3)')
  for (const [k, P] of Object.entries(POW)) console.log(`  ${k}: ${P.txt}`)
  const show = (name, o) => {
    const r = rowOf(o), fb = finish(r), fk = finish(r, 'kt'), f3 = finish(r, 'bs', 0.3)
    console.log(`  ${name.padEnd(30)} ${desc(o).padEnd(42)}\n      d1-2: kill ${T(r, 'c1')} body-s ${T(r, 'bs1')} pk ${T(r, 'pk1')}   d4+: kill ${T(r, 'c13')} body-s ${T(r, 'bs13')} pk ${T(r, 'pk13')} share ${T(r, 'sh13')} bodies/cast ${T(r, 'bpc')}   boss ${T(r, 'b')} share ${T(r, 'shb')}\n      finish bs ${F(fb)}  kt ${F(fk)}  e.3 ${F(f3)}`)
    return { r, fb }
  }

  console.log('\n(1) Bigger packs, all with the r1 part power (P1). Same total = the pick\'s 4 x1.25 = 137.5 HP; today 110.')
  const PK = [
    ['today', { pow: 'P0' }],
    ['r1 pick: 4 bodies x1.25', { hp1: 1.25, hp: 1.25, bossHp: 1.1, pow: 'P1' }],
    ['+1 same total (x0.98)', { n1: 5, hp1: 0.98, n: 5, hp: 0.98, bossHp: 1.1, pow: 'P1' }],
    ['+2 same total (x0.81)', { n1: 6, hp1: 0.81, n: 6, hp: 0.81, bossHp: 1.1, pow: 'P1' }],
    ['+1 HP x1', { n1: 5, hp1: 1, n: 5, hp: 1, bossHp: 1.1, pow: 'P1' }],
    ['+2 HP x1', { n1: 6, hp1: 1, n: 6, hp: 1, bossHp: 1.1, pow: 'P1' }],
    ['+1 alongside x1.25', { n1: 5, hp1: 1.25, n: 5, hp: 1.25, bossHp: 1.1, pow: 'P1' }],
    ['+2 alongside x1.25', { n1: 6, hp1: 1.25, n: 6, hp: 1.25, bossHp: 1.1, pow: 'P1' }],
    ['+1 HP x1 from d4 (d1-2 pick)', { hp1: 1.25, n: 5, hp: 1, bossHp: 1.1, pow: 'P1' }],
    ['+2 HP x1 from d4 (d1-2 pick)', { hp1: 1.25, n: 6, hp: 1, bossHp: 1.1, pow: 'P1' }],
    ['+1 x1.25 from d4 (d1-2 pick)', { hp1: 1.25, n: 5, hp: 1.25, bossHp: 1.1, pow: 'P1' }],
    ['+1 HP x1 from d4, area 2', { hp1: 1.25, n: 5, hp: 1, bossHp: 1.1, pow: 'P3' }],
    ['+2 HP x1 from d4, area 2', { hp1: 1.25, n: 6, hp: 1, bossHp: 1.1, pow: 'P3' }],
  ]
  const R = {}
  for (const [n, o] of PK) R[n] = show(n, o)

  console.log('\n(2a) d1-2 alone (everyone at white). Pass lines: never-melt pk >= 45%, body-s <= 1.2 (hpLost within 20%).')
  for (const pow of ['P1', 'P3', 'P4', 'P5']) for (const [n1, hp1] of [[4, 1], [4, 1.25], [4, 1.4], [4, 1.5], [4, 1.6], [5, 1], [5, 1.1]]) {
    const r = rowOf({ hp1, n1, hp: 1.25, bossHp: 1.1, pow }), f = finish(r)
    console.log(`   ${pow} d1-2 n${n1} x${hp1}`.padEnd(24) + ` kill ${T(r, 'c1')} body-s ${T(r, 'bs1')} pk ${T(r, 'pk1')} share ${T(r, 'sh1')}  (finish with d4+ x1.25: ${F(f)})`)
  }
  console.log('\n(2b) Grid, d1-2 fixed at n4 x1.4. Band: finish (bs) never-melt 17-23, median 70-75, investor >= 90; fodder guard: median d4+ kill <= 1.10.')
  console.log('     Ranked by median+investor part share (d4+ and boss).')
  const grid = []
  for (const hp of [1.25, 1.4, 1.5, 1.65, 1.8, 2, 2.2]) for (const n of [4, 5]) for (const bossHp of [1.1, 1.2, 1.3, 1.4, 1.5]) for (const pow of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    const o = { hp1: 1.4, n1: 4, hp, n, bossHp, pow }, r = rowOf(o), f = finish(r)
    const score = (r.median.sh13 + r.invest.sh13 + r.median.shb + r.invest.shb) / 4
    grid.push({ o, r, f, score })
  }
  const inBand = (g) => g.f[0] >= 0.17 && g.f[0] <= 0.23 && g.f[1] >= 0.70 && g.f[1] <= 0.755 && g.f[2] >= 0.895
  const hit = grid.filter((g) => inBand(g) && g.r.median.c13 <= 1.10).sort((a, b) => b.score - a.score || a.o.hp - b.o.hp)
  const gl = (g) => console.log(`   ${desc(g.o).padEnd(42)} finish ${F(g.f)}  share d4+ ${T(g.r, 'sh13')} boss ${T(g.r, 'shb')}  pk d4+ ${T(g.r, 'pk13')}  kill d4+ ${T(g.r, 'c13')} body-s ${T(g.r, 'bs13')} boss ${T(g.r, 'b')}  score ${pct(g.score)}`)
  console.log(`  ${hit.length} of ${grid.length} combos in the band (${grid.filter(inBand).length} before the fodder guard). Top 8:`)
  hit.slice(0, 8).forEach(gl)
  console.log('  best in band per power level and pack size:')
  for (const p of Object.keys(POW)) for (const n of [4, 5]) { const g = hit.find((x) => x.o.pow === p && x.o.n === n); if (g) gl(g) }
  console.log('  out of band for reference (fodder guard broken or band missed), best score overall:')
  grid.filter((g) => !hit.includes(g) && g.f[2] >= 0.895 && g.f[1] >= 0.70).sort((a, b) => b.score - a.score).slice(0, 3).forEach(gl)
  // candidates for the write-up, full detail + strain
  const CAND = process.env.CAND ? JSON.parse(process.env.CAND) : []
  const SHOW = [['r1 pick', { hp1: 1.25, hp: 1.25, bossHp: 1.1, pow: 'P1' }], ...hit.slice(0, 1).map((g, i) => [`grid #${i + 1}`, g.o]), ...CAND]
  console.log('\n(3) Candidates in detail, and the strain clock (strain UNCHANGED; Broke/Stopped/Made, body-s Broke model)')
  for (const [n, o] of SHOW) {
    const { r } = show(n, o)
    const row = { floor: r.floor, median: r.median, invest: r.invest }
    for (const [vn, v] of [['pushes as today', { cast: 0, push: 2, pushMul: 1, bs: true }], ['tap push x1.25', { cast: 0, push: 2, pushMul: 1.25, bs: true }], ['tap push x1.5', { cast: 0, push: 2, pushMul: 1.5, bs: true }]]) {
      const out = [0, 1, 2].map((w) => { const c = { broke: 0, stopped: 0, made: 0 }; const N = FAST ? 3000 : 12000; for (let i = 0; i < N; i++) c[run(w, v, row).end]++; return `${Math.round(100 * c.broke / N)}/${Math.round(100 * c.stopped / N)}/${Math.round(100 * c.made / N)}` })
      console.log(`      ${vn.padEnd(16)} ${out.join(' | ')}`)
    }
  }
}
