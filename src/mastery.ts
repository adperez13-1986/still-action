import type { StateId } from './states'

/**
 * Mastery (28 Sep prototype, his idea: "option 3 but after the rank III"). Melting a part into one
 * already at III masters the auto its lean feeds: a close part the hand, a marksman part the eye
 * (a part with no lean, either). He picks one of two. Each changes what the auto does, not how much
 * it hits: the autos already carry too much (design/rules/PITCHES.md), so these hand work to the parts.
 * At most `MASTERY_MAX` a run, each once; between runs nothing carries.
 */
export type MasteryId = 'hand-chill' | 'hand-mark' | 'hand-cleave' | 'eye-chill' | 'eye-mark' | 'eye-split'
export type MasteryForm = 'hand' | 'eye'

/**
 * What the player reads for each form (28 Sep, his call): "the hand" and "the eye" read as the arms
 * and head slots, so on screen they are the close strike and the planted shot. Code keeps hand / eye.
 */
export const FORM_NAME: Record<MasteryForm, string> = { hand: 'close strike', eye: 'planted shot' }

/** `sets`: the state its auto's every hit sets (states.ts). A mastery never pays one. */
export const MASTERY: Record<MasteryId, { form: MasteryForm; name: string; line: string; sets?: StateId }> = {
  'hand-chill': { form: 'hand', name: 'Cold Strike', line: 'Every close strike chills what it hits.', sets: 'chilled' },
  'hand-mark': { form: 'hand', name: 'Marking Strike', line: 'Every close strike marks what it hits.', sets: 'marked' },
  'hand-cleave': { form: 'hand', name: 'Wide Strike', line: 'Every close strike also catches the next body in reach.' },
  'eye-chill': { form: 'eye', name: 'Cold Shot', line: 'Every planted shot chills what it hits.', sets: 'chilled' },
  'eye-mark': { form: 'eye', name: 'Marking Shot', line: 'Every planted shot marks what it hits.', sets: 'marked' },
  'eye-split': { form: 'eye', name: 'Splitting Shot', line: 'A planted shot that kills splits into two at the nearest bodies.' },
}

export const MASTERY_MAX = 6

/**
 * Which auto a part at III feeds: close parts the hand, marksman parts the eye, the rest (Borrowed Time) either. The build layer (B1, 2 Oct) cut the
 * leaning tags from the part defs; this table is what they said, one for one (tools/checks/baseline/leans.json, held equal by tools/corecheck.ts),
 * so mastery is offered exactly as before with "builds" off. With a core worn there is no mastery.
 */
export const MASTERY_FORM: Record<string, MasteryForm | null> = {
  'focusing-lens': 'eye',
  'flare': 'hand',
  'cracked-lens': 'eye',
  'ricochet-lens': 'eye',
  'patient-lens': 'eye',
  'signal-flare': 'hand',
  'through-line': 'eye',
  'overclocked-coil': 'hand',
  'pressure-vent': 'eye',
  'ward': 'eye',
  'backdraft-vent': 'hand',
  'chill-vent': 'eye',
  'brace': 'hand',
  'mirror-ward': 'eye',
  'lure': 'eye',
  'scrap-cleaver': 'hand',
  'piston': 'eye',
  'rusted-hook': 'hand',
  'parry-clamp': 'hand',
  'frayed-cleaver': 'hand',
  'clamp-toss': 'eye',
  'anvil': 'hand',
  'kickstart': 'hand',
  'skitter': 'eye',
  'skid-plates': 'hand',
  'overrun': 'hand',
  'frost-trail': 'eye',
  'spring-heels': 'eye',
  'plumb-line': 'eye',
  'borrowed-time': null,
}

/**
 * The numbers, in one place: a chill's length, a mark's length, the cleave's share, the split's reach and hit.
 * A mastery's chill never slows (his call, 28 Sep): a free auto may set only states that don't protect him on their own.
 */
export const MASTERY_TUNE = { chillS: 1.5, markS: 3, cleaveShare: 0.6, splitRange: 6, splitDamage: 6 }

/** Two not yet owned for `form` (both forms for a part with no lean), fewer if fewer are left. */
export function masteryOffer(form: MasteryForm | null, owned: ReadonlySet<MasteryId>): MasteryId[] {
  const left = (Object.keys(MASTERY) as MasteryId[]).filter((id) => !owned.has(id) && (!form || MASTERY[id].form === form))
  for (let i = left.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[left[i], left[j]] = [left[j]!, left[i]!]
  }
  if (!form) {
    // no lean: one of each form when both are left
    const hand = left.find((id) => MASTERY[id].form === 'hand')
    const eye = left.find((id) => MASTERY[id].form === 'eye')
    return [hand, eye].filter((x): x is MasteryId => !!x).concat(left.filter((id) => id !== hand && id !== eye)).slice(0, 2)
  }
  return left.slice(0, 2)
}
