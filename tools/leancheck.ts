/**
 * The leanings' static checks (design/leanings/PITCHES.md, "Pass lines"), on the real part defs:
 *
 *   npx tsx tools/leancheck.ts
 *
 * One lean per part (the agreed tag list, the starting four split 2-2); every slot has a part of
 * each lean that drops outside bosses; the retuned Flare and Piston as agreed. (Riders were cut 28 Sep
 * and their code removed 2 Oct, build layer B0; the lean tags go in B1.)
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

// the retuned two
const flare = byId('flare')
check(flare.range === 6 && flare.travelMs === 450 && flare.lean === 'close', 'Flare: range 6, travel 450 ms, close')
const piston = byId('piston')
check(piston.damage === 20 && piston.shove === 4.0 && piston.lean === 'marksman', 'Piston: 20 damage, 4.0 shove, marksman')

const count = (l: Lean | undefined) => PARTS.filter((p) => p.lean === l).length
console.log(`leancheck: ${PARTS.length} parts, close ${count('close')}, marksman ${count('marksman')}, none ${count(undefined)}`)
for (const slot of SLOTS) {
  const row = (['close', 'marksman'] as const).map((l) => `${l} ${PARTS.filter((p) => p.slot === slot && p.lean === l).map((p) => p.id).join(' ')}`)
  console.log(`  ${slot.padEnd(5)} ${row.join('  |  ')}`)
}
if (fails.length) {
  console.log(`\nFAIL (${fails.length}):`)
  for (const f of fails) console.log(`  ${f}`)
  process.exit(1)
}
console.log('\nall pass')
