// Autos sim (design/autos, round 1, balancer). Run: node design/autos/autos-sim.mjs
// Reads playtest.json; every other number is copied from src/ (combat.ts HAND/EYE/AUTO_INTERVAL,
// abilities.ts, temper.ts) and design/scaling/CURVE9.md (per-check HP lost, scrap, CV 0.5).
// A model, not the game: kill time scales as 1 / (a*s + p*(1-s)), where s is the auto share of damage,
// a the autos' multiplier, p the parts'. HP lost scales as killTime^EPS.
import { readFileSync } from 'node:fs'

const BEAT = 0.62
const HAND = 10, EYE = 8
const T_DMG = [1, 1.3, 1.6], T_CD = [1, 0.85, 0.72]

// ---- 1. Single-body DPS: every part vs the close strike (16.1) and the planted shot (12.9) ----
const PARTS = [
  ['Focusing Lens', 26, 4.2], ['Flare', 18, 4.2], ['Cracked Lens', 20, 4.6], ['Ricochet Lens', 18, 4.6],
  ['Patient Lens (full)', 32, 7.5], ['Overclocked Coil', 14, 1.2], ['Through-Line', 24, 6.0],
  ['Pressure Vent', 15, 6.5], ['Backdraft Vent', 12, 6.5], ['Chill Vent', 10, 6.5], ['Lure', 18, 12],
  ['Scrap Cleaver', 18, 2.6], ['Piston', 20, 3.0], ['Rusted Hook', 12, 3.2], ['Parry Clamp', 10, 3.6],
  ['Frayed Cleaver', 16, 2.6], ['Clamp Toss', 14 + 12, 4.5], ['Anvil', 30, 6.0],
  ['Kickstart', 12, 8], ['Skid Plates', 8 + 10, 8], ['Overrun (pushed)', 22, 7],
]
console.log('\n1. Single-body DPS, rank I / rank III (hand 16.1, eye 12.9)')
for (const [n, d, cd] of PARTS) {
  const i = d / cd, iii = (d * T_DMG[2]) / (cd * T_CD[2])
  console.log(`  ${n.padEnd(20)} ${i.toFixed(1).padStart(5)} ${iii.toFixed(1).padStart(5)}${iii > HAND / BEAT ? '  > hand' : ''}`)
}
console.log(`  hand ${(HAND / BEAT).toFixed(1)}  eye ${(EYE / BEAT).toFixed(1)} per body (pierces)`)

// ---- 2. The log: only runs that logged both autoDmg and partDmg are comparable ----
const log = JSON.parse(readFileSync(new URL('../../playtest.json', import.meta.url), 'utf8'))
let allA = 0, allP = 0
for (const r of log) for (const s of r.stats) {
  if (s.autoDmg) allA += Object.values(s.autoDmg).reduce((x, y) => x + y, 0)
  if (s.partDmg != null) allP += s.partDmg
}
console.log(`\n2. Log. All autoDmg ${allA} vs all partDmg ${allP.toFixed(0)}: ${(allA / (allA + allP) * 100).toFixed(0)}% (mixes ~12 runs of autos with 2 runs of parts)`)
for (const r of log) {
  if (!r.stats.some((s) => s.partDmg != null)) continue
  let A = 0, P = 0, casts = 0, beats = 0
  const row = []
  for (const s of r.stats) {
    const a = Object.values(s.autoDmg).reduce((x, y) => x + y, 0)
    A += a; P += s.partDmg
    const c = r.taps.filter((t) => t.depth === s.depth && (t.result === 'cast' || t.result === 'push')).length
    casts += c; beats += (s.hand ?? 0) + (s.eye ?? 0)
    row.push(`${s.depth}:${Math.round((a / (a + s.partDmg)) * 100)}%`)
  }
  const fightMin = (beats * BEAT) / 60
  console.log(`  ${r.startedAt.slice(5, 16)} auto share ${Math.round((A / (A + P)) * 100)}% [${row.join(' ')}]  casts ${casts}, auto beats ${beats} (>= ${fightMin.toFixed(1)} fight-min) -> <= ${(casts / fightMin).toFixed(0)} casts/fight-min, ${(P / casts).toFixed(0)} dmg/cast vs ${(A / beats).toFixed(1)} dmg/beat`)
}

// ---- 3. Players and checks (CURVE9 Works-first, today's rows) ----
// auto share per check, today, rule B in (boss autos x0.5 applied to the logged pre-B boss shares)
const halve = (s) => (0.5 * s) / (0.5 * s + (1 - s))
const CHECKS = [ // name, boss?, scrap, floor/median/investor HP lost (CURVE9 §2)
  ['d1', 0, 30, [55, 53, 51]], ['d2', 0, 30, [20, 18, 15]], ['Asm', 1, 0, [88, 67, 47]],
  ['d4', 0, 15, [70, 55, 40]], ['d5', 0, 15, [63, 42, 31]], ['Arb', 1, 0, [62, 37, 28]],
  ['d7', 0, 10, [73, 49, 40]], ['d8', 0, 10, [77, 49, 42]], ['Eng', 1, 0, [70, 46, 40]],
]
const FLOOR_S = [0.65, 0.65, halve(0.64), 0.65, 0.65, halve(0.74), 0.65, 0.65, halve(0.69)]
const INV_S = [0.47, 0.34, halve(0.30), 0.42, 0.16, halve(0.49), 0.25, 0.25, halve(0.35)]
const MED_S = FLOOR_S.map((f, i) => (f + INV_S[i]) / 2)
const SHARE = [FLOOR_S, MED_S, INV_S]
const CASTS = [25, 38, 51] // casts per fight-minute, floor / median / investor (log upper bounds; median between)
const WHO = ['floor', 'median', 'invest']

// erf-based lognormal CDF
const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y }
const CV = 0.5, SIG = Math.sqrt(Math.log(1 + CV * CV))
const pAlive = (mean, cap) => { const mu = Math.log(mean) - SIG * SIG / 2; return 0.5 * (1 + erf((Math.log(cap) - mu) / (SIG * Math.SQRT2))) }

// an option: (player index, check index) -> { a, p }
const earned = (N, w, casts = CASTS) => Math.min(1, N / (60 / (BEAT * casts[w]))) // share of today's beats a cast-armed auto keeps
const OPTIONS = {
  'A0 today': () => ({ a: 1, p: 1 }),
  'A1 autos x0.5': () => ({ a: 0.5, p: 1 }),
  'A2 autos x0.5, cds x0.7': () => ({ a: 0.5, p: 1 / 0.7 }),
  'B0 no autos': () => ({ a: 0, p: 1 }),
  'B1 no autos, cds x0.35': () => ({ a: 0, p: 1 / 0.35 }),
  'C  pressed, 75% of beats': () => ({ a: 0.75, p: 0.9 }),
  'D2 2 beats per cast': (w) => ({ a: earned(2, w), p: 1 }),
  'D3 3 beats per cast': (w) => ({ a: earned(3, w), p: 1 }),
  'D3 + white cds x0.85': (w) => ({ a: earned(3, w), p: 1 / 0.85 }),
  'D3, floor presses 35/min': (w) => ({ a: earned(3, w, [35, 38, 51]), p: 35 / 28 * (w === 0) + (w !== 0) }),
}

function run(opt, EPS) {
  const out = []
  for (let w = 0; w < 3; w++) {
    let alive = 1, crawlX = 0, bossX = 0, nc = 0, nb = 0, ias = 0, dmgShare = 0
    for (let c = 0; c < CHECKS.length; c++) {
      const [, boss, scrap, lost] = CHECKS[c]
      const s = SHARE[w][c]
      const { a, p } = OPTIONS[opt](w, c)
      const X = 1 / (a * s + p * (1 - s))
      alive *= pAlive(lost[w] * X ** EPS, 100 + scrap)
      if (boss) { bossX += X; nb++ } else { crawlX += X; nc++ }
      const autoPart = a * s, partPart = p * (1 - s)
      dmgShare += autoPart / (autoPart + partPart)
      ias += (opt.startsWith('D') ? 1 : partPart / (autoPart + partPart))
    }
    out.push({ fin: alive, crawlX: crawlX / nc, bossX: bossX / nb, autoShare: dmgShare / 9, ias: ias / 9 })
  }
  return out
}

console.log('\n3. Kill time x (crawl, boss), auto share, input-caused share, finish at 9 (EPS 0.8; 0.6 / 1.0 in brackets)')
console.log('   '.padEnd(28) + WHO.map((w) => w.padEnd(34)).join(''))
for (const opt of Object.keys(OPTIONS)) {
  const r = run(opt, 0.8), lo = run(opt, 0.6), hi = run(opt, 1.0)
  console.log('  ' + opt.padEnd(26) + r.map((x, i) => `${x.crawlX.toFixed(2)}/${x.bossX.toFixed(2)} a${(x.autoShare * 100).toFixed(0)} i${(x.ias * 100).toFixed(0)} ${(x.fin * 100).toFixed(0)}% (${(lo[i].fin * 100).toFixed(0)}-${(hi[i].fin * 100).toFixed(0)})`.padEnd(34)).join(''))
}

// ---- 4. Power spread: investor pack kill time as a share of the floor's (CURVE: 0.52 at depth 5) ----
console.log('\n4. Investor/floor pack kill time at depth 5 (today 0.52 per CURVE.md)')
for (const opt of Object.keys(OPTIONS)) {
  const f = OPTIONS[opt](0, 4), v = OPTIONS[opt](2, 4)
  // today's investor damage = 1/0.52 of the floor's; split by share
  const F = f.a * FLOOR_S[4] + f.p * (1 - FLOOR_S[4])
  const I = (1 / 0.52) * (v.a * INV_S[4] + v.p * (1 - INV_S[4]))
  console.log(`  ${opt.padEnd(26)} ${(F / I).toFixed(2)}`)
}

// ---- 5. Boss seconds (CURVE.md B kill times: Assembler 95/72/83, Arbiter 116/70/77) ----
console.log('\n5. Boss kill time, s (floor / median / invest)')
const BOSS_T = { Asm: [[95, 72, 83], 2], Arb: [[116, 70, 77], 5] }
for (const opt of Object.keys(OPTIONS)) {
  const cells = Object.entries(BOSS_T).map(([n, [t, c]]) => n + ' ' + t.map((x, w) => { const { a, p } = OPTIONS[opt](w, c); const s = SHARE[w][c]; return Math.round(x / (a * s + p * (1 - s))) }).join('/'))
  console.log(`  ${opt.padEnd(26)} ${cells.join('   ')}`)
}

// ---- 6. The push under B1: what +2 strain buys when cooldowns are x0.35 ----
console.log('\n6. A push buys the rest of a cooldown: mean wait saved (cd/2), white parts')
for (const [n, , cd] of PARTS.filter(([n]) => ['Focusing Lens', 'Pressure Vent', 'Scrap Cleaver', 'Kickstart'].includes(n)))
  console.log(`  ${n.padEnd(16)} today ${(cd / 2).toFixed(1)} s   B1 ${(cd * 0.35 / 2).toFixed(1)} s`)
