/**
 * The build layer's static checks (design/buildlayer/BUILD.md §5.2 K-M2, the data half), on the real part defs and cores.ts:
 *
 *   npx tsx tools/corecheck.ts
 *
 * Who fits which core (§5.1), the keystones and upgrades, the reshape machinery (`variant`), the mastery table that replaced the leaning tags
 * (`MASTERY_FORM` against tools/checks/baseline/leans.json), and that the core's code draws no Math.random (INV-T3's rule, extended).
 * (This file was tools/leancheck.ts until B1, 2 Oct 2026: the lean tags are gone from the defs; its two retuned-part lines are kept.)
 * Exits 1 on any failure.
 */
import { readFileSync } from 'node:fs'
import { PARTS, byId } from '../src/abilities'
import { CORE_IDS, CORES, FILTER, KEYSTONES, RESHAPES, UPGRADES, UPGRADE_FROM, UPGRADE_MAX, fitOf, markCap, markLife, variant, type CoreId, type FitRole } from '../src/cores'
import { MASTERY_FORM } from '../src/mastery'
import { rollForCore } from '../src/drops'
import { STARTER_POOL } from '../src/pool'
import type { SlotName } from '../src/still'

const SLOTS: SlotName[] = ['head', 'torso', 'arms', 'legs']
const fails: string[] = []
const check = (ok: boolean, what: string) => {
  if (!ok) fails.push(what)
}
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// --- §5.1: who fits which core ---
// `k`: a spender's own flat damage per mark (3-balancer.md §1, ship); absent, the core's K
const TABLE: Record<CoreId, Record<string, { role: FitRole; slams?: true; k?: number }>> = {
  ram: {
    piston: { role: 'spend', slams: true, k: 12 }, 'scrap-cleaver': { role: 'spend', k: 4 }, flare: { role: 'spend' },
    'backdraft-vent': { role: 'shape' }, kickstart: { role: 'shape', slams: true }, brace: { role: 'guard' },
  },
  wake: {
    'frayed-cleaver': { role: 'spend', k: 10 }, 'scrap-cleaver': { role: 'spend', k: 3 }, 'frost-trail': { role: 'spend' },
    'signal-flare': { role: 'shape' }, 'spring-heels': { role: 'shape' }, ward: { role: 'guard' },
  },
}
for (const p of PARTS) {
  for (const k of Object.keys(p.fits ?? {})) check((CORE_IDS as readonly string[]).includes(k), `${p.id}: fits key ${k} is not a core`)
  check(!('lean' in p), `${p.id}: still has a lean key`)
}
for (const c of CORE_IDS) {
  const own = PARTS.filter((p) => fitOf(p, c))
  check(own.length === 6, `${c}: ${own.length} fitting parts, want 6`)
  check(new Set(own.map((p) => p.slot)).size === 4, `${c}: its parts cover ${new Set(own.map((p) => p.slot)).size} slots, want 4`)
  for (const p of own) check(JSON.stringify(fitOf(p, c)) === JSON.stringify(TABLE[c][p.id]), `${c}: ${p.id} fits as ${JSON.stringify(fitOf(p, c))}, table says ${JSON.stringify(TABLE[c][p.id])}`)
  for (const id of Object.keys(TABLE[c])) check(!!fitOf(byId(id), c), `${c}: ${id} should fit`)
  const spenders = own.filter((p) => fitOf(p, c)!.role === 'spend')
  check(new Set(spenders.map((p) => p.slot)).size >= 2, `${c}: spenders in ${new Set(spenders.map((p) => p.slot)).size} slot(s), want 2+`)
  check(own.every((p) => !fitOf(p, c)!.slams || c === 'ram'), `${c}: only Ram's parts slam`)
  check(own.every((p) => fitOf(p, c)!.k === undefined || (fitOf(p, c)!.role === 'spend' && fitOf(p, c)!.k! > 0)), `${c}: a k on a part that is not a spender, or not above 0`)
  // the keystones and the upgrades: two a core, one for packs and one for bosses
  const keys = Object.values(KEYSTONES).filter((k) => k.core === c)
  check(keys.length === 2 && keys.some((k) => k.for === 'packs') && keys.some((k) => k.for === 'bosses'), `${c}: needs 2 keystones, one for packs and one for bosses`)
  check(Object.values(UPGRADES).filter((u) => u.core === c).length === 2, `${c}: needs 2 upgrades`)
  // the marks: a count and a life, the keystone's where it has one
  check(markCap(c, null) === CORES[c].cap && markLife(c, null) === CORES[c].lifeS, `${c}: markCap / markLife with no keystone are the core's own`)
}
for (const [id, k] of Object.entries(KEYSTONES)) check(k.id === id, `keystone ${id}: id ${k.id}`)
for (const [id, u] of Object.entries(UPGRADES)) check(u.id === id, `upgrade ${id}: id ${u.id}`)
check(markCap('wake', 'wake-deep') === 5 && markLife('wake', 'wake-deep') === 4, 'wake-deep: cap 5, life 4 s')
check(markCap('wake', 'wake-burst') === 3 && markCap('ram', 'wake-deep') === 3, 'only Wake with Deep holds more')
// the bridge: one part fits both cores (Scrap Cleaver), at most 3
const bridges = PARTS.filter((p) => CORE_IDS.every((c) => fitOf(p, c)))
check(bridges.length >= 1 && bridges.length <= 3 && bridges.some((p) => p.id === 'scrap-cleaver'), `bridges: ${bridges.map((p) => p.id).join(', ') || 'none'}, want Scrap Cleaver and at most 3`)
// plain parts. BUILD.md §5.2 says "15 of the 30 stay plain", but §5.1's own table fits 11 distinct parts (6 + 6, Scrap Cleaver in both): 19 stay plain. The table is the rule.
const plain = PARTS.filter((p) => !CORE_IDS.some((c) => fitOf(p, c)))
check(PARTS.length === 30 && plain.length === 19, `${plain.length} plain parts of ${PARTS.length}, §5.1's table makes 19 of 30`)
// Ram's six: five are starter parts, so a young save meets them (Wake's three reshapes are found-pool parts, which is why the filter ignores `found`)
check(PARTS.filter((p) => fitOf(p, 'ram') && STARTER_POOL.includes(p.id)).length === 5, 'Ram: five of its six in the starter pool')
check(['frayed-cleaver', 'frost-trail', 'signal-flare'].every((id) => !STARTER_POOL.includes(id)), 'Wake: its three reshapes are found-pool parts')

// --- the ship numbers (3-balancer.md §1), which are not BUILD.md's: pinned, so a stray BUILD.md number cannot creep back ---
check(CORES.wake.K === 6 && CORES.ram.K === 8, `K: wake ${CORES.wake.K}, ram ${CORES.ram.K}, ship 6 and 8`)
check(CORES.wake.damage === 6 && CORES.ram.damage === 8, `a skim ${CORES.wake.damage} and a shove ${CORES.ram.damage}, ship 6 and 8`)
check(CORES.wake.bossSkim.mul === 1 && CORES.wake.bossSkim.perBodyS === 0.5, 'bossSkim: full damage, once per 0.5 s')
check(CORES.wake.bite.damage === 1 && CORES.wake.bite.everyS === 0.5, `bite: ${CORES.wake.bite.damage} every ${CORES.wake.bite.everyS} s, B6b ship 1 and 0.5`)
check(CORES.wake.trail.lifeS === 1.0 && CORES.wake.trail.stepU === 0.15 && CORES.wake.trail.halfWidth === 0.25 && CORES.wake.trail.perBodyS === 1.0, 'trail: life 1.0 s, a point every 0.15 u, half-width 0.25 u, once a 1.0 s per body (B6b ship)')
check(CORES.wake.trail.max >= Math.ceil(CORES.wake.trail.lifeS * 5 / CORES.wake.trail.stepU) + 1, `trail: ${CORES.wake.trail.max} points hold a second of a 5 u/s dash`)
check(KEYSTONES['wake-burst'].share === 1.0 && KEYSTONES['ram-domino'].hit === 8 && KEYSTONES['ram-catch'].icdS === 1.0, 'Burst share 1.0, Domino hit 8, Catch icdS 1.0')
check(FILTER.share === 0.5 && FILTER.keyWeight === 1 && UPGRADE_FROM === 7, `FILTER.share ${FILTER.share}, keyWeight ${FILTER.keyWeight}, UPGRADE_FROM ${UPGRADE_FROM}, ship 0.5, 1 and 7`)
// B5: the hunt's gates and the upgrade cap (rollForCore draws nothing with no core, nor for a source the filter does not take)
check(UPGRADE_MAX === 2 && CORE_IDS.every((c) => Object.values(UPGRADES).filter((u) => u.core === c).length === UPGRADE_MAX), `UPGRADE_MAX ${UPGRADE_MAX}: each core has exactly that many upgrades`)
{
  const view = { found: new Set<string>(), turned: new Set<string>(), depth: 5 }
  const real = Math.random
  let drew = 0
  Math.random = () => { drew++; return 0.1 }
  try {
    check(rollForCore(null, 'elite', [], { socketed: null, onFloor: [] }, view) === null && drew === 0, 'rollForCore with no core returns null and draws nothing')
    for (const src of ['kill', 'crate', 'boss-gold'] as const) check(rollForCore('wake', src, [], { socketed: null, onFloor: [] }, view) === null && drew === 0, `rollForCore for ${src} returns null and draws nothing`)
    check(rollForCore('ram', 'elite', [], { socketed: null, onFloor: [] }, view) !== null, 'rollForCore for an elite with Ram worn returns something at a low roll')
  } finally {
    Math.random = real
  }
}
check(JSON.stringify(RESHAPES) === JSON.stringify({
  backhand: { base: 'frayed-cleaver', core: 'wake', damage: 18, cone: 150, cooldownMs: 2400 },
  skate: { base: 'frost-trail', core: 'wake', damage: 12, cooldownMs: 5500 },
  frostFlare: { base: 'signal-flare', core: 'wake', damage: 14, cooldownMs: 5000 },
  pistonRam: { base: 'piston', core: 'ram', cooldownMs: 2600 },
}), 'the reshapes\' ship numbers (recorded for B2 / B3)')

// --- variant: pure, memoized, idempotent, and the base part's identity ---
for (const p of PARTS) {
  check(variant(p, null) === p, `${p.id}: variant(d, null) is not d`)
  for (const c of CORE_IDS) {
    const v = variant(p, c)
    check(variant(v, c) === v, `${p.id} under ${c}: variant is not idempotent`)
    check(variant(p, c) === v, `${p.id} under ${c}: variant is not memoized`)
    check(v.id === p.id && v.slot === p.slot && v.tier === p.tier && v.drops === p.drops && v.key === p.key && v.fits === p.fits, `${p.id} under ${c}: a reshape changed id, slot, tier, drops, key or fits`)
  }
}
// B2: Wake's three reshapes (Backhand, Skate, Frost Flare) and nothing else; B3: Ram's one, Piston's numbers-only variant (cooldown 2600, name, line and icon unchanged)
const RESHAPED: Record<string, string[]> = { wake: ['frayed-cleaver', 'frost-trail', 'signal-flare'], ram: ['piston'] }
for (const c of CORE_IDS) {
  const got = PARTS.filter((p) => variant(p, c) !== p).map((p) => p.id).sort()
  check(JSON.stringify(got) === JSON.stringify(RESHAPED[c]), `reshaped under ${c}: ${got.join(', ') || 'none'}; want ${RESHAPED[c]!.join(', ') || 'none'}`)
}

{
  const base = byId('piston')
  const v = variant(base, 'ram')
  check(v.cooldownMs === RESHAPES.pistonRam.cooldownMs && v.cooldownMs === 2600, `Piston under Ram: cooldown ${v.cooldownMs}, ship 2600`)
  const same = (['name', 'line', 'icon', 'damage', 'range', 'cone', 'shove', 'shape', 'beat', 'pays'] as const).every((k) => JSON.stringify(v[k]) === JSON.stringify(base[k]))
  check(same, 'Piston under Ram: a numbers-only variant (name, line, icon, damage, range, cone, shove, shape, beat and pays are the base part\'s)')
  check(variant(base, 'wake') === base, 'Piston under Wake is the base part')
}

// --- the mastery table is what the lean tags said (leans.json, written from the defs before they were cut) ---
const leans = JSON.parse(read('./checks/baseline/leans.json')) as Record<string, 'close' | 'marksman' | null>
const mapped = Object.fromEntries(Object.entries(leans).map(([id, l]) => [id, l === 'close' ? 'hand' : l === 'marksman' ? 'eye' : null]))
check(JSON.stringify(Object.entries(MASTERY_FORM).sort()) === JSON.stringify(Object.entries(mapped).sort()), 'MASTERY_FORM is not leans.json, mapped (close: hand, marksman: eye, none: null)')
check(PARTS.every((p) => p.id in MASTERY_FORM) && Object.keys(MASTERY_FORM).length === PARTS.length, 'MASTERY_FORM does not name every part, once')

// --- source: the core's code draws no Math.random; Ram's copied numbers are combat.ts's ---
const combat = read('../src/combat.ts')
/** A method's body in combat.ts: from its first `{` to the matching one. */
function methodBody(name: string): string {
  const at = combat.indexOf(`private ${name}(`)
  if (at < 0) {
    fails.push(`combat.ts has no ${name}`)
    return ''
  }
  let depth = 0
  let i = combat.indexOf('{', at)
  const from = i
  for (; i < combat.length; i++) {
    if (combat[i] === '{') depth++
    else if (combat[i] === '}' && --depth === 0) break
  }
  return combat.slice(from, i + 1)
}
// tickCore dispatches to the cores' own ticks (Wake's skim, Ram's shove and its helpers); every one of them is the core's code
for (const name of ['tickCore', 'tickWake', 'tickRam', 'beat', 'shove', 'slamBody', 'catchScan', 'throwEnd', 'inTell', 'immovable']) check(!/Math\.random/.test(methodBody(name)), `${name}'s source draws Math.random`)
check(!/Math\.random/.test(read('../src/cores.ts')), "cores.ts's source draws Math.random")
check(new RegExp(`export const HAND = \\{ range: ${CORES.ram.reach},`).test(combat), `RAM.reach ${CORES.ram.reach} is not HAND.range`)
check(new RegExp(`const AUTO_INTERVAL = ${CORES.ram.beatS}\\b`).test(combat), `RAM.beatS ${CORES.ram.beatS} is not AUTO_INTERVAL`)

// --- the two retuned parts as agreed (kept from leancheck) ---
const flare = byId('flare')
check(flare.range === 6 && flare.travelMs === 450, 'Flare: range 6, travel 450 ms')
const piston = byId('piston')
check(piston.damage === 20 && piston.shove === 4.0, 'Piston: 20 damage, 4.0 shove')

console.log(`corecheck: ${PARTS.length} parts, ${plain.length} plain; ${CORE_IDS.map((c) => `${c} ${PARTS.filter((p) => fitOf(p, c)).map((p) => `${p.id}(${fitOf(p, c)!.role}${fitOf(p, c)!.slams ? '+slams' : ''})`).join(' ')}`).join(' | ')}`)
for (const slot of SLOTS) console.log(`  ${slot.padEnd(5)} ${CORE_IDS.map((c) => `${c} ${PARTS.filter((p) => p.slot === slot && fitOf(p, c)).map((p) => p.id).join(' ')}`).join('  |  ')}`)
if (fails.length) {
  console.log(`\nFAIL (${fails.length}):`)
  for (const f of fails) console.log(`  ${f}`)
  process.exit(1)
}
console.log('\nall pass')
