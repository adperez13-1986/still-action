// Autos sim, round 2 (balancer). Run: node design/autos/autos-sim2.mjs
// A Monte Carlo pack fight: no geometry. Bodies are ordered by distance (hulks near, sentinel back).
// Each 0.62 s beat is a close-strike beat (p HAND_P), a planted beat (p EYE_P) or nothing (moving, out of reach).
// Parts fire when ready after an exponential hesitation, tuned so casts per fight-minute match his log
// (never-melt <=28, investor <=51). HAND_P / EYE_P are calibrated so TODAY's auto share matches the log
// (never-melt 64%, investor 34%). Numbers from combat.ts, abilities.ts, temper.ts.
const BEAT = 0.62, DT = 0.02, CLAIM_S = 3
const PLAYERS = {
  floor: { rank: 0, hesit: 3.7 },
  invest: { rank: 2, hesit: 1.3, stateMul: 1.25 }, // states pay x2 on some hits: ~+25% part damage (his 14:59 run)
}
const T_DMG = [1, 1.3, 1.6], T_CD = [1, 0.85, 0.72]
// white loadout: Focusing Lens, Pressure Vent, Scrap Cleaver, Kickstart
const PARTS = [
  { slot: 'head', dmg: 26, cd: 4.2, hits: 'priority' },
  { slot: 'torso', dmg: 15, cd: 6.5, hits: 'each', p: 0.6 },
  { slot: 'arms', dmg: 18, cd: 2.6, hits: 'arc' },
  { slot: 'legs', dmg: 12, cd: 8, hits: 'each', p: 0.35 },
]
const HAND_P = +(process.env.HP ?? 0.7), EYE_P = +(process.env.EP ?? 0.25)

function fight(mode, who, hpMul, rng, armsCd, cdMul = 1, boss = false, hes = null, dmgMul = 1) {
  const P = { ...PLAYERS[who], ...(hes != null && who === 'floor' ? { hesit: hes } : {}) }
  const bodies = (boss ? [900] : [30, 30, 30, 20]).map((hp, i) => ({ hp: hp * hpMul, back: !boss && i === 3, lastPart: -99, partHit: false, dead: false, by: null }))
  const parts = PARTS.map((p) => ({ ...p, cd: (p.slot === 'arms' && armsCd ? armsCd : p.cd) * T_CD[P.rank] * cdMul, dmg: p.dmg * T_DMG[P.rank] * (P.stateMul ?? 1) * dmgMul, t: 0, wait: -1 })).map((p) => ({ ...p, t: rng() * p.cd })) // carried in from the last fight
  let t = 0, beat = 0, bank = 0, boost = 0
  const st = { autoDmg: 0, partDmg: 0, autoOnUnchosen: 0, autoKills: 0, kills: 0, partStarted: 0, beats: 0, idleBeats: 0, handBeats: 0, breakBeats: 0 }
  const alive = () => bodies.filter((b) => !b.dead)
  const hurt = (b, d, src) => {
    if (b.dead) return
    b.hp -= d
    if (src === 'part') { b.lastPart = t; b.partHit = true; st.partDmg += d } else { st.autoDmg += d; if (t - b.lastPart > CLAIM_S) st.autoOnUnchosen += d }
    if (b.hp <= 0) { b.dead = true; st.kills++; if (src === 'auto') st.autoKills++; if (b.partHit) st.partStarted++ }
  }
  const claimed = (b) => t - b.lastPart <= CLAIM_S
  while (alive().length && t < 400) {
    t += DT
    for (const p of parts) {
      p.t -= DT
      if (p.t <= 0 && p.wait < 0) p.wait = -Math.log(1 - rng()) * P.hesit
      if (p.wait >= 0) { p.wait -= DT; if (p.wait <= 0) {
        p.wait = -1; p.t = p.cd
        const a = alive()
        if (!a.length) break
        let hit = false
        if (p.hits === 'priority') { const b = a.find((x) => x.back) ?? a[0]; hurt(b, p.dmg, 'part'); hit = true }
        else if (p.hits === 'arc') { hurt(a[0], p.dmg, 'part'); hit = true; if (a[1] && rng() < 0.5) hurt(a[1], p.dmg, 'part') }
        else for (const b of a) if (rng() < p.p) { hurt(b, p.dmg, 'part'); hit = true }
        if (mode === 'bank') bank = Math.min(6, bank + 3)
        if (mode.startsWith('pkg') && hit) boost = 2
      } }
    }
    beat -= DT
    if (beat <= 0) {
      beat = BEAT
      const a = alive()
      if (!a.length) break
      const r = rng()
      const form = r < HAND_P ? 'hand' : r < HAND_P + EYE_P ? 'eye' : null
      if (!form) continue
      st.beats++
      // candidates: the hand reaches the two nearest; the eye sees everyone, back line first
      let cand = form === 'hand' ? a.slice(0, 2) : [...a.filter((b) => b.back), ...a.filter((b) => !b.back)]
      if (mode === 'claim') cand = cand.filter(claimed)
      if (mode === 'bank' && bank <= 0) { st.idleBeats++; continue }
      if (mode.startsWith('pkg') && form === 'eye') { st.idleBeats++; continue }
      if (!cand.length) { st.idleBeats++; continue }
      if (mode === 'bank') bank--
      let dmg = form === 'hand' ? 10 : 8
      if (mode.startsWith('pkg')) { dmg = 5; if (boost > 0) { dmg = 10; boost-- } }
      if (form === 'hand') st.handBeats++
      if (boss) dmg *= 0.5 // BOSS_AUTO_MUL
      if (form === 'hand' && cand[0].hp > 0) st.breakBeats += mode.startsWith('pkg') ? 0 : 1
      hurt(cand[0], dmg, 'auto')
      if (form === 'eye' && cand[1] && rng() < 0.3) hurt(cand[1], dmg, 'auto') // the lance pierces
    }
  }
  st.t = t
  return st
}

// ---- The run: CURVE9 finish rates with the crawl kill-time factor above (HP lost ~ x^0.8) ----
// boss factor: one body every part hits, so claim coverage = 1 - exp(-casts/s * 3); bank as round 1; pkg analytic.
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
const SIG = Math.sqrt(Math.log(1.25))
const pAlive = (m, cap) => { const mu = Math.log(m) - SIG * SIG / 2; return 0.5 * (1 + erf((Math.log(cap) - mu) / (SIG * Math.SQRT2))) }

let seed = 7
const rng = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
function measure(mode, who, hpMul, cdMul, boss = false, hes = null, dmgMul = 1) {
  const n = boss ? 400 : 3000
  const acc = {}
  for (let i = 0; i < n; i++) { const s = fight(mode, who, hpMul, rng, mode === 'pkg14' ? 1.4 : 0, cdMul, boss, hes, dmgMul); for (const k in s) acc[k] = (acc[k] ?? 0) + s[k] }
  return acc
}
const MODES = [['today', 'today'], ['D3 bank', 'bank'], ['claim 3 s', 'claim'], ['pkg', 'pkg'], ['pkg + arms 1.4 s', 'pkg14']]
const BASE = {}
for (const who of ['floor', 'invest']) for (const h of [1, 1.3]) BASE[who + h] = measure('today', who, h, 1)
for (const who of ['floor', 'invest']) BASE[who + 'boss'] = measure('today', who, 1, 1, true)
// what restores the floor player's pack time at body HP x1: pressing sooner (less hesitation).
// Part damage can't: an earned auto waits for the first press, and x10 part damage still leaves the pack slower.
const castsPerMin = (h, arms = 2.6) => [4.2, 6.5, arms, 8].reduce((a, cd) => a + 60 / (cd + h), 0)
function search(f) { let lo = 0, hi = 1; for (let k = 0; k < 11; k++) { const m = (lo + hi) / 2; if (f(m) > 1) hi = m; else lo = m } return (lo + hi) / 2 }
const compHes = (mode) => 3.7 * search((m) => measure(mode, 'floor', 1, 1, false, 3.7 * m).t / BASE.floor1.t)
const pct = (x) => `${Math.round(x * 100)}%`
// CURVE9 Works-first, floor / investor HP lost; median = mean of the two kill-time factors
const CHECKS = [['d1', 'c1', 30, [55, 53, 51]], ['d2', 'c1', 30, [20, 18, 15]], ['Asm', 'b', 0, [88, 67, 47]], ['d4', 'c13', 15, [70, 55, 40]], ['d5', 'c13', 15, [63, 42, 31]], ['Arb', 'b', 0, [62, 37, 28]], ['d7', 'c13', 10, [73, 49, 40]], ['d8', 'c13', 10, [77, 49, 42]], ['Eng', 'b', 0, [70, 46, 40]]]
console.log('Cells floor / invest. crawl x = pack time vs today (HP x1 | x1.3); boss x; auto share (HP x1.3); auto dmg on bodies no part hit in 3 s; kills a part started; close strikes that can break vs today; finish at 9 (floor/median/invest; today 31/74/91)')
for (const [name, mode] of MODES) for (const [tag, hes, dm] of mode === 'today' ? [['', null, 1]] : (() => { const h = compHes(mode); return [['', null, 1], [` presses ${castsPerMin(h, mode === 'pkg14' ? 1.4 : 2.6).toFixed(0)}/min`, h, 1]] })()) {
  const cm = 1
  const row = {}
  for (const who of ['floor', 'invest']) {
    const a1 = measure(mode, who, 1, cm, false, hes, dm), a3 = measure(mode, who, 1.3, cm, false, hes, dm), ab = measure(mode, who, 1, cm, true, hes, dm)
    row[who] = { c1: a1.t / BASE[who + 1].t, c13: a3.t / BASE[who + 1.3].t, b: ab.t / BASE[who + 'boss'].t, share: a3.autoDmg / (a3.autoDmg + a3.partDmg), unch: a3.autoOnUnchosen / Math.max(1, a3.autoDmg), started: a3.partStarted / a3.kills, brk: (a1.breakBeats / a1.t) / (BASE[who + 1].breakBeats / BASE[who + 1].t), bshare: ab.autoDmg / (ab.autoDmg + ab.partDmg) }
  }
  const fin = [0, 1, 2].map((w) => CHECKS.reduce((acc, [, k, scrap, lost]) => { const x = w === 0 ? row.floor[k] : w === 2 ? row.invest[k] : (row.floor[k] + row.invest[k]) / 2; return acc * pAlive(lost[w] * x ** 0.8, 100 + scrap) }, 1))
  const f = row.floor, v = row.invest
  console.log(`  ${(name + tag).padEnd(30)} crawl ${f.c1.toFixed(2)}|${f.c13.toFixed(2)} / ${v.c1.toFixed(2)}|${v.c13.toFixed(2)}  boss ${f.b.toFixed(2)}/${v.b.toFixed(2)}  share ${pct(f.share)}/${pct(v.share)} (boss ${pct(f.bshare)}/${pct(v.bshare)})  unchosen ${pct(f.unch)}/${pct(v.unch)}  started ${pct(f.started)}/${pct(v.started)}  breaks ${pct(f.brk)}/${pct(v.brk)}  finish ${fin.map((x) => Math.round(x * 100)).join('/')}`)
}

