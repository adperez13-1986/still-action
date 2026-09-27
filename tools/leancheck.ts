/**
 * The leanings' static checks (design/leanings/PITCHES.md, "Pass lines"), on the real part defs:
 *
 *   npx tsx tools/leancheck.ts
 *
 * One lean per part (the agreed tag list, the starting four split 2-2); every slot has a part of
 * each lean that drops outside bosses; riders only on the hand or the eye, on their own button,
 * with nothing of HP or damage in them; the retuned Flare and Piston as agreed.
 * Exits 1 on any failure.
 */
import { PARTS, STARTING, byId, type Lean } from '../src/abilities'
import type { SlotName } from '../src/still'

const TAGS: Record<Lean | 'none', string[]> = {
  close: ['flare', 'signal-flare', 'overclocked-coil', 'backdraft-vent', 'brace', 'scrap-cleaver', 'rusted-hook',
    'parry-clamp', 'frayed-cleaver', 'anvil', 'kickstart', 'skid-plates', 'overrun'],
  marksman: ['focusing-lens', 'cracked-lens', 'ricochet-lens', 'patient-lens', 'through-line', 'pressure-vent', 'ward',
    'chill-vent', 'mirror-ward', 'lure', 'piston', 'clamp-toss', 'skitter', 'frost-trail', 'spring-heels', 'plumb-line'],
  none: ['borrowed-time'],
}
/** The four riders the lead settled: the trigger each answers, and what it does to its own button. */
const RIDERS: Record<string, { on: 'hand' | 'eye'; act: 'ready' | 'charge' }> = {
  'parry-clamp': { on: 'hand', act: 'ready' },
  'backdraft-vent': { on: 'hand', act: 'ready' },
  'patient-lens': { on: 'eye', act: 'charge' },
  'clamp-toss': { on: 'eye', act: 'ready' },
}
const SLOTS: SlotName[] = ['head', 'torso', 'arms', 'legs']

const fails: string[] = []
const check = (ok: boolean, what: string) => {
  if (!ok) fails.push(what)
}

// one lean per part, and the agreed list
for (const p of PARTS) {
  const want = (Object.keys(TAGS) as (Lean | 'none')[]).filter((l) => TAGS[l].includes(p.id))
  check(want.length === 1, `${p.id}: on ${want.length} lists`)
  const lean = p.lean ?? 'none'
  check(want[0] === lean, `${p.id}: tagged ${lean}, agreed ${want[0]}`)
}
for (const [lean, ids] of Object.entries(TAGS)) for (const id of ids) check(PARTS.some((p) => p.id === id), `${lean}: ${id} is not a part`)
check(STARTING.filter((p) => p.lean === 'close').length === 2 && STARTING.filter((p) => p.lean === 'marksman').length === 2, 'the starting four split 2-2')

// every slot x lean has a part that drops outside bosses
for (const slot of SLOTS) {
  for (const lean of ['close', 'marksman'] as const) {
    const n = PARTS.filter((p) => p.slot === slot && p.lean === lean && p.drops !== 'boss').length
    check(n > 0, `${slot} has no ${lean} part outside bosses`)
  }
}

// riders: the four, the hand or the eye (and the lean that trigger belongs to), their own button only
for (const p of PARTS) {
  const want = RIDERS[p.id]
  if (!p.rider) {
    check(!want, `${p.id}: its rider is missing`)
    continue
  }
  check(!!want, `${p.id}: a rider nobody agreed`)
  check(p.rider.on === 'hand' || p.rider.on === 'eye', `${p.id}: a rider on ${p.rider.on}`)
  check(p.rider.on === (p.lean === 'close' ? 'hand' : 'eye'), `${p.id}: a ${p.rider.on} rider on a ${p.lean ?? 'none'} part`)
  check(!!want && want.on === p.rider.on && want.act === p.rider.act, `${p.id}: rider ${p.rider.on}/${p.rider.act}`)
  check(p.rider.act !== 'charge' || p.mod?.kind === 'charge', `${p.id}: charges a button with nothing to charge`)
  check(p.rider.icdMs === 4000, `${p.id}: cap ${p.rider.icdMs} ms, agreed 4000`)
  // nothing but its trigger, its act and its cap: no HP, no damage, no other part
  const keys = Object.keys(p.rider).sort().join(',')
  check(keys === 'act,icdMs,on', `${p.id}: rider carries ${keys}`)
}

// the retuned two
const flare = byId('flare')
check(flare.range === 6 && flare.travelMs === 450 && flare.lean === 'close', 'Flare: range 6, travel 450 ms, close')
const piston = byId('piston')
check(piston.damage === 20 && piston.shove === 4.0 && piston.lean === 'marksman', 'Piston: 20 damage, 4.0 shove, marksman')

const count = (l: Lean | undefined) => PARTS.filter((p) => p.lean === l).length
console.log(`leancheck: ${PARTS.length} parts, close ${count('close')}, marksman ${count('marksman')}, none ${count(undefined)}, riders ${PARTS.filter((p) => p.rider).length}`)
for (const slot of SLOTS) {
  const row = (['close', 'marksman'] as const).map((l) => `${l} ${PARTS.filter((p) => p.slot === slot && p.lean === l).map((p) => p.id + (p.rider ? `(${p.rider.on})` : '')).join(' ')}`)
  console.log(`  ${slot.padEnd(5)} ${row.join('  |  ')}`)
}
if (fails.length) {
  console.log(`\nFAIL (${fails.length}):`)
  for (const f of fails) console.log(`  ${f}`)
  process.exit(1)
}
console.log('\nall pass')
