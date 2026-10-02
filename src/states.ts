import type { SlotName } from './still'
import { byId, type AbilityDef } from './abilities'
import { MASTERY, type MasteryId } from './mastery'

/**
 * Enemy states (design/synergy/PITCHES.md, build 1): the autos set them through mastery, some
 * parts set them too, and parts that pay a state hit harder on a body carrying it. One
 * multiplier a hit, never above MUL_CAP, and a pay always crosses slots: a state set from the
 * payer's own slot pays nothing, so a pair is two parts, or a mastery and a part.
 * No three.js here: tools/statecheck.ts runs it under node.
 */
export type StateId = 'chilled' | 'marked'
export const STATE_IDS: readonly StateId[] = ['chilled', 'marked']

/** What a state is worth to a paying part, and whether paying uses it up. */
export const STATE: Record<StateId, { mul: number; consumed: boolean }> = {
  chilled: { mul: 2, consumed: true },
  marked: { mul: 2, consumed: true },
}

/** One multiplier a hit, never above this (beyond the part's own numbers: temper is fine). */
export const MUL_CAP = 2

/** Who set a state: a part's slot, or an auto through mastery (the hand, the eye). */
export type StateBy = SlotName | 'hand' | 'eye'

/** One state on one body: seconds left (0 = none), and who set it last. */
export interface StateMark { t: number; by: StateBy }

/** A body's states. EnemyStatus carries one of each. */
export type StateSet = { readonly [K in StateId]?: Readonly<StateMark> }

/**
 * Who pays: a part's slot and what it pays. The autos never pay. `fits` (the build layer, BUILD.md §2.2): with a core worn, a payer that
 * fits it as a spender also cashes the body's core marks. The mirror's reflected shot has none, so it spends nothing.
 */
export type Payer = Pick<AbilityDef, 'slot' | 'pays' | 'fits'>

/** The words on screen for each state, and the verb its setter's card uses. */
export const STATE_WORD: Record<StateId, { adj: string; verb: string }> = {
  chilled: { adj: 'chilled', verb: 'chills' },
  marked: { adj: 'marked', verb: 'marks' },
}

/** Each state's small glyph for a payer's button rim: a frost star, and the mark's corner brackets. */
export const STATE_GLYPH: Record<StateId, string> = {
  chilled: '<path d="M12 4v16M5.1 8l13.8 8M5.1 16l13.8-8"/>',
  marked: '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>',
}

/**
 * What a payer's hit on `status` is worth: the largest live state its `pays` lists, capped at
 * MUL_CAP, and the one state that pays (`used`, or null). A state set from the payer's own slot
 * pays nothing; one set by the hand or the eye pays any slot. Only `used` is consumed.
 */
export function stateMul(status: StateSet | undefined, payer: Payer): { mul: number; used: StateId | null } {
  let mul = 1
  let used: StateId | null = null
  for (const id of payer.pays ?? []) {
    const s = status?.[id]
    if (!s || s.t <= 0 || s.by === payer.slot) continue
    const m = Math.min(MUL_CAP, STATE[id].mul)
    if (m > mul) {
      mul = m
      used = id
    }
  }
  return { mul, used }
}

/** The states a mastery sets (its auto's every hit). None pays. */
export const masterySets = (id: MasteryId): StateId | null => MASTERY[id].sets ?? null

/** Something worn that sets `s`, outside `slot`: a part in another slot, or a mastery. Its name, or null. */
function setterOf(s: StateId, slot: SlotName, worn: readonly AbilityDef[], mastery: ReadonlySet<MasteryId>): string | null {
  const p = worn.find((w) => w.slot !== slot && w.sets?.includes(s))
  if (p) return byId(p.id).name
  for (const id of mastery) if (masterySets(id) === s) return MASTERY[id].name
  return null
}

/**
 * The pair a part would make with what's worn, as its partner's plain name, or null: a payer with a
 * setter in another slot or a mastery, or a setter with a payer in another slot. `worn` is
 * everything on Still; the part's own slot is left out (it's the one being replaced).
 */
export function pairWith(d: AbilityDef, worn: readonly AbilityDef[], mastery: ReadonlySet<MasteryId>): string | null {
  for (const s of d.pays ?? []) {
    const n = setterOf(s, d.slot, worn, mastery)
    if (n) return n
  }
  for (const s of d.sets ?? []) {
    const p = worn.find((w) => w.slot !== d.slot && w.pays?.includes(s))
    if (p) return byId(p.id).name
  }
  return null
}

/** Whether a worn payer has its pair: some state it pays is set outside its slot (a part, or a mastery). */
export function paired(d: AbilityDef, s: StateId, worn: readonly AbilityDef[], mastery: ReadonlySet<MasteryId>): boolean {
  return !!d.pays?.includes(s) && setterOf(s, d.slot, worn, mastery) !== null
}
