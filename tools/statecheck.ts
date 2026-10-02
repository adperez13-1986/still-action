/**
 * Enemy states' static checks (design/synergy/BUILD-1.md, 2-verifier.md), on the real defs:
 *
 *   npx tsx tools/statecheck.ts
 *
 * Every state's multiplier within the cap; stateMul's rules (the larger of two, the own slot pays
 * nothing, a mastery's pays any slot, the cap); `pays` only on parts that deal damage; no part
 * sets and pays one state; every paid state has a setter in another slot or a mastery; masteries
 * never pay; what a part sets agrees with its mod, and its card says it; temper's damage and cooldown
 * tables (src/temper.ts) are the numbers the game shipped with, and tempered() reads them (B0, 2 Oct: nothing else guarded them).
 * Exits 1 on any failure.
 */
import { PARTS, byId, type AbilityDef } from '../src/abilities'
import { MASTERY, type MasteryId } from '../src/mastery'
import { TEMPER, tempered } from '../src/temper'
import { MUL_CAP, STATE, STATE_IDS, STATE_WORD, stateMul, type StateBy, type StateId } from '../src/states'

const fails: string[] = []
const check = (ok: boolean, what: string) => {
  if (!ok) fails.push(what)
}

// the multipliers: one a hit, never above x2
for (const id of STATE_IDS) check(STATE[id].mul <= 2 && STATE[id].mul <= MUL_CAP, `${id}: x${STATE[id].mul} over the cap`)
check(MUL_CAP <= 2, `the cap is x${MUL_CAP}`)

// stateMul, case by case
const live = (by: StateBy, t = 2) => ({ t, by })
const eq = (got: { mul: number; used: StateId | null }, mul: number, used: StateId | null, what: string) =>
  check(got.mul === mul && got.used === used, `stateMul ${what}: x${got.mul} ${got.used}, want x${mul} ${used}`)
const cleaver = byId('scrap-cleaver')
const patient = byId('patient-lens')
eq(stateMul({ chilled: live('torso') }, cleaver), 2, 'chilled', 'a chill from another slot')
eq(stateMul({ chilled: live('arms') }, cleaver), 1, null, 'a chill from its own slot')
eq(stateMul({ chilled: live('hand') }, cleaver), 2, 'chilled', 'a chill from the hand')
eq(stateMul({ marked: live('eye') }, patient), 2, 'marked', 'a mark from the eye, on the head')
eq(stateMul({ marked: live('head') }, patient), 1, null, 'a mark from its own slot (the head)')
eq(stateMul({ chilled: live('torso', 0) }, cleaver), 1, null, 'a chill run out')
eq(stateMul({ marked: live('head') }, cleaver), 1, null, 'a mark on a part that pays chills')
eq(stateMul({ chilled: live('torso') }, byId('piston')), 1, null, 'a part that pays nothing')
eq(stateMul(undefined, cleaver), 1, null, 'no status')
// two states: the larger wins, and only it is used (the table is bent for the case, then put back)
const both = { slot: 'arms' as const, pays: ['chilled', 'marked'] as StateId[] }
const was = { ...STATE.marked }
STATE.marked.mul = 1.5
eq(stateMul({ chilled: live('torso'), marked: live('head') }, both), 2, 'chilled', 'two states, the larger')
STATE.marked.mul = 2.5
STATE.chilled.mul = 1.5
eq(stateMul({ chilled: live('torso'), marked: live('head') }, both), 2, 'marked', 'two states, the larger capped')
STATE.chilled.mul = 3
STATE.marked.mul = 3
eq(stateMul({ chilled: live('torso') }, cleaver), MUL_CAP, 'chilled', 'the cap')
STATE.chilled.mul = 2
Object.assign(STATE.marked, was)

// what deals damage: its own number, or its mod's (Overrun's charge, Skid Plates' slam)
const deals = (p: AbilityDef) => p.damage > 0 || (!!p.mod && 'damage' in p.mod && (p.mod as { damage: number }).damage > 0)
const MOD_SETS: Partial<Record<NonNullable<AbilityDef['mod']>['kind'], StateId>> = { mark: 'marked', slow: 'chilled', strip: 'chilled' }

for (const p of PARTS) {
  const sets = p.sets ?? []
  const pays = p.pays ?? []
  check(!pays.length || deals(p), `${p.id}: pays a state and deals no damage`)
  for (const s of pays) check(!sets.includes(s), `${p.id}: sets and pays ${s}`)
  for (const s of [...sets, ...pays]) check(STATE_IDS.includes(s), `${p.id}: ${s} is not a state`)
  // every paid state has a setter outside the payer's slot, or a mastery
  for (const s of pays) {
    const part = PARTS.some((q) => q.slot !== p.slot && q.sets?.includes(s))
    const mastery = (Object.keys(MASTERY) as MasteryId[]).some((id) => MASTERY[id].sets === s)
    check(part || mastery, `${p.id}: pays ${s}, and nothing outside the ${p.slot} sets it`)
  }
  // the mod does the setting: what it sets and what it says agree
  const bySet = p.mod ? MOD_SETS[p.mod.kind] : undefined
  check((bySet ? [bySet] : []).join() === sets.join(), `${p.id}: sets [${sets}] but its mod sets [${bySet ?? ''}]`)
  // the card says it, in one shape
  for (const s of pays) check(p.line.includes(`On a ${STATE_WORD[s].adj} enemy: lands twice.`), `${p.id}: its card doesn't say it pays ${s}`)
  for (const s of sets) check(p.line.toLowerCase().includes(STATE_WORD[s].verb), `${p.id}: its card doesn't say it ${STATE_WORD[s].verb}`)
  // temper keeps them
  const t = tempered(p, 3)
  check((t.sets ?? []).join() === sets.join() && (t.pays ?? []).join() === pays.join(), `${p.id}: temper drops sets/pays`)
}

// masteries set, never pay, and say what they set
for (const id of Object.keys(MASTERY) as MasteryId[]) {
  const m = MASTERY[id]
  check(!('pays' in m), `${id}: a mastery that pays`)
  if (m.sets) {
    check(STATE_IDS.includes(m.sets), `${id}: ${m.sets} is not a state`)
    check(m.line.includes(`${STATE_WORD[m.sets].verb} what it hits`), `${id}: its card doesn't say it ${STATE_WORD[m.sets].verb}`)
  }
}

// temper's tables, I II III. Today's: damage x1 / 1.3 / 1.6, cooldown x1 / 0.85 / 0.72 (a part's damage a second at III is x2.22). A change to them is a design
// change (the flat temper trial, design/buildlayer: 1 / 1.15 / 1.3 and 1 / 0.92 / 0.85, behind its switch): update these numbers with it, on purpose.
check(JSON.stringify(TEMPER.damage) === '[1,1.3,1.6]', `temper damage table ${JSON.stringify(TEMPER.damage)}, shipped [1,1.3,1.6]`)
check(JSON.stringify(TEMPER.cooldown) === '[1,0.85,0.72]', `temper cooldown table ${JSON.stringify(TEMPER.cooldown)}, shipped [1,0.85,0.72]`)
// and every card and mod reads them: a plain damage part at II and III, and its cooldown
{
  const cl = byId('scrap-cleaver')
  for (const [rank, dmg, cd] of [[2, 1.3, 0.85], [3, 1.6, 0.72]] as const) {
    const t = tempered(cl, rank)
    check(t.damage === Math.round(cl.damage * dmg), `Scrap Cleaver at ${rank}: damage ${t.damage}, want ${Math.round(cl.damage * dmg)}`)
    check(t.cooldownMs === Math.round(cl.cooldownMs * cd), `Scrap Cleaver at ${rank}: cooldown ${t.cooldownMs} ms, want ${Math.round(cl.cooldownMs * cd)}`)
  }
}

// the retuned setter: Signal Flare's own hit, a setter's (0.6 of the white lob's 18 or more)
check(byId('signal-flare').damage === 12, `Signal Flare: ${byId('signal-flare').damage}, agreed 12`)

console.log(`statecheck: ${STATE_IDS.map((id) => `${id} x${STATE[id].mul}${STATE[id].consumed ? ' used up' : ''}`).join(', ')}; cap x${MUL_CAP}`)
for (const s of STATE_IDS) {
  const setters = PARTS.filter((p) => p.sets?.includes(s)).map((p) => `${p.id}(${p.slot})`)
  const masteries = (Object.keys(MASTERY) as MasteryId[]).filter((id) => MASTERY[id].sets === s)
  const payers = PARTS.filter((p) => p.pays?.includes(s)).map((p) => `${p.id}(${p.slot})`)
  console.log(`  ${s.padEnd(7)} set by ${[...setters, ...masteries].join(' ')}  |  paid by ${payers.join(' ')}`)
}
if (fails.length) {
  console.log(`\nFAIL (${fails.length}):`)
  for (const f of fails) console.log(`  ${f}`)
  process.exit(1)
}
console.log('\nall pass')
