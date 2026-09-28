/**
 * Mastery (28 Sep prototype, his idea: "option 3 but after the rank III"). Melting a part into one
 * already at III masters the auto its lean feeds: a close part the hand, a marksman part the eye
 * (a part with no lean, either). He picks one of two. Each changes what the auto does, not how much
 * it hits: the autos already carry too much (design/rules/PITCHES.md), so these hand work to the parts.
 * At most `MASTERY_MAX` a run, each once; between runs nothing carries.
 */
export type MasteryId = 'hand-chill' | 'hand-mark' | 'hand-cleave' | 'eye-chill' | 'eye-mark' | 'eye-split'
export type MasteryForm = 'hand' | 'eye'

export const MASTERY: Record<MasteryId, { form: MasteryForm; name: string; line: string }> = {
  'hand-chill': { form: 'hand', name: 'Cold Hand', line: 'Every strike slows what it hits for a moment.' },
  'hand-mark': { form: 'hand', name: 'Marking Hand', line: 'Every strike marks what it hits: your next part hits it twice.' },
  'hand-cleave': { form: 'hand', name: 'Wide Hand', line: 'Every strike also catches the next body in reach.' },
  'eye-chill': { form: 'eye', name: 'Cold Eye', line: 'Every planted shot slows what it hits for a moment.' },
  'eye-mark': { form: 'eye', name: 'Marking Eye', line: 'Every planted shot marks what it hits: your next part hits it twice.' },
  'eye-split': { form: 'eye', name: 'Splitting Eye', line: 'A planted shot that kills splits into two at the nearest bodies.' },
}

export const MASTERY_MAX = 6

/** The numbers, in one place: a slow's length and pace, a mark's length, the cleave's share, the split's reach and hit. */
export const MASTERY_TUNE = { chillS: 1.5, chillMul: 0.6, markS: 3, cleaveShare: 0.6, splitRange: 6, splitDamage: 6 }

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
