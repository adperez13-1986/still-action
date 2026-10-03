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
import { CORE_IDS, CORE_LIVE, CORES, FILTER, KEYSTONES, RESHAPES, UPGRADES, UPGRADE_FROM, UPGRADE_MAX, fitOf, markCap, markLife, variant, type CoreId, type FitRole } from '../src/cores'
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
const TABLE: Partial<Record<CoreId, Record<string, { role: FitRole; slams?: true; k?: number }>>> = {
  ram: {
    piston: { role: 'spend', slams: true, k: 12 }, 'scrap-cleaver': { role: 'spend', k: 4 }, flare: { role: 'spend' },
    'backdraft-vent': { role: 'shape' }, kickstart: { role: 'shape', slams: true }, brace: { role: 'guard' },
  },
  wake: {
    'frayed-cleaver': { role: 'spend', k: 10 }, 'scrap-cleaver': { role: 'spend', k: 3 }, 'frost-trail': { role: 'spend' },
    'signal-flare': { role: 'shape' }, 'spring-heels': { role: 'shape' }, ward: { role: 'guard' },
  },
  // N3 (THORNS.md, in Graze's place): four spenders, all of the arms slot (Piston, Parry Clamp, Anvil and the bridge), two shapers (Rusted Hook, Lure), three guards (Ward, Brace, Mirror Ward): torso and arms only
  thorns: {
    'parry-clamp': { role: 'spend', k: 10 }, anvil: { role: 'spend', k: 12 }, piston: { role: 'spend', k: 8 }, 'scrap-cleaver': { role: 'spend', k: 4 },
    'rusted-hook': { role: 'shape' }, lure: { role: 'shape' }, ward: { role: 'guard' }, brace: { role: 'guard' }, 'mirror-ward': { role: 'guard' },
  },
  // N2 (CORES2.md §2): the five lenses spend (the head slot's only job), three shapers, two guards. Lure is shared with Thorns, Rusted Hook too, and Ward with Wake and Thorns
  tether: {
    'focusing-lens': { role: 'spend', k: 5 }, 'cracked-lens': { role: 'spend', k: 8 }, 'patient-lens': { role: 'spend', k: 10 }, 'through-line': { role: 'spend', k: 8 }, 'ricochet-lens': { role: 'spend', k: 6 },
    'rusted-hook': { role: 'shape' }, lure: { role: 'shape' }, 'chill-vent': { role: 'shape' }, 'plumb-line': { role: 'guard' }, ward: { role: 'guard' },
  },
}
for (const p of PARTS) {
  for (const k of Object.keys(p.fits ?? {})) check((CORE_LIVE as readonly string[]).includes(k), `${p.id}: fits key ${k} is not a live core`)
  check(!('lean' in p), `${p.id}: still has a lean key`)
}
// the pick shows a card for every core, in order; only the live ones can be worn (Tether's is N2's)
check(JSON.stringify(CORE_IDS) === JSON.stringify(['wake', 'ram', 'thorns', 'tether']) && JSON.stringify(CORE_LIVE) === JSON.stringify(['wake', 'ram', 'thorns', 'tether']), 'the pick: wake, ram, thorns, tether; live: all four (N3)')
check(CORE_IDS.every((c) => c in CORES) && CORE_LIVE.every((c) => (CORE_IDS as readonly string[]).includes(c)), 'every core has numbers; every live core has a card')
for (const c of CORE_LIVE) {
  const own = PARTS.filter((p) => fitOf(p, c))
  // Wake and Ram have six parts, one in every slot; Thorns has nine in two slots (the torso's guards and shapers, the arms' spenders: no head or legs part, the lenses are Tether's); Tether has ten in all four, its five spenders all in the head slot
  const want = { wake: 6, ram: 6, thorns: 9, tether: 10 }[c]
  const wantSlots = c === 'thorns' ? 2 : 4
  check(own.length === want, `${c}: ${own.length} fitting parts, want ${want}`)
  check(new Set(own.map((p) => p.slot)).size === wantSlots, `${c}: its parts cover ${new Set(own.map((p) => p.slot)).size} slots, want ${wantSlots}`)
  for (const p of own) check(JSON.stringify(fitOf(p, c)) === JSON.stringify(TABLE[c]![p.id]), `${c}: ${p.id} fits as ${JSON.stringify(fitOf(p, c))}, table says ${JSON.stringify(TABLE[c]![p.id])}`)
  for (const id of Object.keys(TABLE[c]!)) check(!!fitOf(byId(id), c), `${c}: ${id} should fit`)
  const spenders = own.filter((p) => fitOf(p, c)!.role === 'spend')
  // Tether's spenders are the lenses (CORES2.md: "the first core whose spenders are the head slot"), and Thorns' are the arms' (THORNS.md: Parry Clamp, Anvil, Piston, Scrap Cleaver), so one slot by design
  const oneSlot = c === 'tether' ? 'head' : c === 'thorns' ? 'arms' : null
  check(new Set(spenders.map((p) => p.slot)).size >= (oneSlot ? 1 : 2) && (!oneSlot || spenders.every((p) => p.slot === oneSlot)), `${c}: spenders in ${new Set(spenders.map((p) => p.slot)).size} slot(s), want ${oneSlot ? `the ${oneSlot} only` : '2+'}`)
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
check(markCap('thorns', 'thorns-spite') === 3 && markLife('thorns', 'thorns-bramble') === 3, 'thorns: its keystones hold no more and last no longer')
check(markCap('wake', 'wake-burst') === 3 && markCap('ram', 'wake-deep') === 3, 'only Wake with Deep holds more')
// the bridge: one part fits Wake, Ram and Thorns (Scrap Cleaver), at most 3. Tether's own is the white Focusing Lens (k 5, under its K of 6), which no other core fits
const bridges = PARTS.filter((p) => CORE_LIVE.filter((c) => c !== 'tether').every((c) => fitOf(p, c)))
check(bridges.length >= 1 && bridges.length <= 3 && bridges.some((p) => p.id === 'scrap-cleaver'), `bridges: ${bridges.map((p) => p.id).join(', ') || 'none'}, want Scrap Cleaver and at most 3`)
check(fitOf(byId('focusing-lens'), 'tether')!.k! < CORES.tether.K && byId('focusing-lens').tier === 'white' && CORE_LIVE.filter((c) => fitOf(byId('focusing-lens'), c)).join() === 'tether', "Tether's bridge: the white Focusing Lens spends under it at k 5, below K 6, and fits no other core")
// plain parts. BUILD.md §5.2 says "15 of the 30 stay plain", but §5.1's own table fits 11 distinct parts (6 + 6, Scrap Cleaver in both): 19 stay plain. The table is the rule. Graze (N1) fit 7 more, Tether (N2) 8, and Thorns (N3) took Graze's place with Rusted Hook, Brace, Ward and Piston among them: Skitter, Overrun and Borrowed Time are plain again.
const plain = PARTS.filter((p) => !CORE_LIVE.some((c) => fitOf(p, c)))
check(PARTS.length === 30 && plain.length === 7, `${plain.length} plain parts of ${PARTS.length}, the tables make 7 of 30 (Thorns fits no leg: Skitter, Overrun and Borrowed Time are plain)`)
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
// Thorns (N3, THORNS.md): first-guess numbers, pinned so a stray edit shows
check(CORES.thorns.K === 8 && CORES.thorns.cap === 3 && CORES.thorns.lifeS === 3 && CORES.thorns.damage === 8 && CORES.thorns.marks === 2 && CORES.thorns.shotMarks === 1 && CORES.thorns.blockMarks === 3 && CORES.thorns.armor === 0.15, 'thorns: K 8, cap 3, life 3 s, damage 8, marks 2, shotMarks 1, blockMarks 3, armor 0.15')
check(CORES.thorns.blockMarks > CORES.thorns.marks && CORES.thorns.marks > CORES.thorns.shotMarks && CORES.thorns.armor > 0 && CORES.thorns.armor < 0.5, 'thorns: a block marks more than a hit, a hit more than a shot; the armor is a share below a half')
check(KEYSTONES['thorns-bramble'].radius === 2.0 && KEYSTONES['thorns-bramble'].marks === 1 && KEYSTONES['thorns-spite'].marks === 3 && KEYSTONES['thorns-spite'].mul === 2, 'Bramble: 1 mark within 2.0 u; Spite: 3 marks, the core hit x2')
check(UPGRADES['thorns-backlash'].shove === 1.5 && UPGRADES['thorns-patch'].radius === 1.5 && UPGRADES['thorns-patch'].lifeS === 2 && UPGRADES['thorns-patch'].marks === 1 && UPGRADES['thorns-patch'].max === 4, 'Backlash: 1.5 u; Bramble Patch: 1.5 u wide, 2 s, 1 mark, at most 4')
// Tether (N2, CORES2.md §2): first-guess numbers, pinned so a stray edit shows
check(CORES.tether.K === 6 && CORES.tether.cap === 3 && CORES.tether.lifeS === 3 && CORES.tether.damage === 6 && CORES.tether.minR === 3 && CORES.tether.maxR === 9 && CORES.tether.breakR === 10, 'tether: K 6, cap 3, life 3 s, damage 6, hook 3 to 9 u, breaks past 10 u')
check(CORES.tether.rehookS === 0.5 && CORES.tether.losGraceS === 0.3 && CORES.tether.reach === 0.4 && CORES.tether.perBodyS === 0.5 && CORES.tether.anchorDamage === 4 && CORES.tether.anchorEveryS === 1.5 && CORES.tether.hookMarks === 1, 'tether: rehook 0.5 s, line-of-sight grace 0.3 s, reach 0.4 u, once per body per 0.5 s, anchor 4 every 1.5 s, hook 1 mark')
check(CORES.tether.minR < CORES.tether.maxR && CORES.tether.maxR < CORES.tether.breakR, 'tether: hooks inside where it breaks (minR < maxR < breakR)')
check(KEYSTONES['tether-snag'].mul === 0.6 && KEYSTONES['tether-snag'].s === 1.0 && KEYSTONES['tether-taut'].anchorEveryS === 0.75, 'Snag: x0.6 for 1 s; Taut: the anchor ticks every 0.75 s')
check(UPGRADES['tether-second'].wires === 2 && UPGRADES['tether-whip'].reach === 1.5 && UPGRADES['tether-whip'].damage === 6 && UPGRADES['tether-whip'].marks === 1, 'Second Line: 2 wires; Whip: 1.5 u, 6 damage, 1 mark')
check(markCap('tether', 'tether-taut') === 3 && markLife('tether', 'tether-snag') === 3, 'tether: its keystones hold no more and last no longer')
check(KEYSTONES['wake-burst'].share === 1.0 && KEYSTONES['ram-domino'].hit === 8 && KEYSTONES['ram-catch'].icdS === 1.0, 'Burst share 1.0, Domino hit 8, Catch icdS 1.0')
check(FILTER.share === 0.5 && FILTER.keyWeight === 1 && UPGRADE_FROM === 7, `FILTER.share ${FILTER.share}, keyWeight ${FILTER.keyWeight}, UPGRADE_FROM ${UPGRADE_FROM}, ship 0.5, 1 and 7`)
// B5: the hunt's gates and the upgrade cap (rollForCore draws nothing with no core, nor for a source the filter does not take)
check(UPGRADE_MAX === 2 && CORE_LIVE.every((c) => Object.values(UPGRADES).filter((u) => u.core === c).length === UPGRADE_MAX), `UPGRADE_MAX ${UPGRADE_MAX}: each core has exactly that many upgrades`)
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
const RESHAPED: Record<string, string[]> = { wake: ['frayed-cleaver', 'frost-trail', 'signal-flare'], ram: ['piston'], thorns: [], tether: [] }
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
for (const name of ['tickCore', 'tickWake', 'tickRam', 'beat', 'shove', 'slamBody', 'catchScan', 'throwEnd', 'inTell', 'immovable', 'thorns', 'tickPatches', 'tickTether', 'holdWire', 'hookWire', 'breakWire', 'sweepWire']) check(!/Math\.random/.test(methodBody(name)), `${name}'s source draws Math.random`)
check(!/Math\.random/.test(read('../src/cores.ts')), "cores.ts's source draws Math.random")
// Thorns' look draws none of its own (N3: "no Math.random in new code"): thornfx.ts, and the single method that shows a thorns hit in main.ts
check(!/Math\.random/.test(read('../src/thornfx.ts')), "thornfx.ts's source draws Math.random")
check(!/Math\.random/.test(read('../src/tetherfx.ts')), "tetherfx.ts's source draws Math.random (N2)")
{
  const main = read('../src/main.ts')
  const at = main.indexOf('function thornsEvent(')
  check(at > 0 && !/Math\.random/.test(main.slice(at, main.indexOf('\n}\n', at))), "main.ts thornsEvent's source draws Math.random")
  const t = main.indexOf('function tetherEvent(')
  check(t > 0 && !/Math\.random/.test(main.slice(t, main.indexOf('\n}\n', t))), "main.ts tetherEvent's source draws Math.random")
}
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
