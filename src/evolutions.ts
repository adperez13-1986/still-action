import type { AbilityDef } from './abilities'
import { FAMILY, type ArchetypeId, type Family } from './archetypes'

/**
 * Evolutions (design/archetypes/EVOLUTIONS.md, E1): a part at rank III with its partner worn in ANOTHER slot becomes something else for the rest of the run,
 * a different animation and a different rule, not just bigger. Only under an archetype; with none nothing here is read. No three.js, so the checks can read it.
 * All words and numbers are PLACEHOLDER.
 */
export type EvoId = 'whirlwind' | 'rail'

export interface Evolution {
  /** The part that evolves. */
  part: string
  /** What it needs worn in another slot: that exact part, or any part of that family. */
  partner: { part?: string; family?: Family }
  name: string
  line: string
  /** The III def with this laid over it. */
  over: Partial<AbilityDef>
  /** The damage of the III def x this. */
  dmgMul: number
}

export const EVOLUTIONS: Record<EvoId, Evolution> = {
  whirlwind: {
    part: 'scrap-cleaver', partner: { family: 'blast' },
    name: 'Whirlwind', line: 'A full spin that carries you forward and hits everything around you twice.',
    over: { cone: 360, beat: 'whirl', icon: '<path d="M12 4a8 8 0 1 1-8 8"/><path d="M12 8a4 4 0 1 1-4 4"/><path d="M1.5 9.5 4 12.5l3-2.5"/>' },
    dmgMul: 1.4,
  },
  rail: {
    part: 'focusing-lens', partner: { family: 'move' },
    name: 'Rail', line: 'A beam through everything in a line. Every dash ends with a free shot.',
    over: { mod: { kind: 'pierce' }, beat: 'rail', icon: '<circle cx="4.5" cy="12" r="2.5"/><path d="M8 12h14"/><path d="M8 9.5h14M8 14.5h14" opacity=".45"/>' },
    dmgMul: 1.6,
  },
}

/** PLACEHOLDER: the numbers the cast reads. */
export const EVO_TUNE = {
  /** Whirlwind: hits per cast and the gap between them (s); the carry (u) over `carryMs`. */
  whirl: { hits: 2, gapS: 0.12, carry: 1.5, carryMs: 250 },
  /** Rail: how long the beam lingers (s) and its width (u). */
  rail: { lingerS: 0.3, width: 0.16 },
}

/** PLACEHOLDER: player-facing words. */
export const EVO_WORDS = {
  with: (e: Evolution) => `evolves with: ${e.partner.part ? e.partner.part.replace(/-/g, ' ') : e.partner.family === 'move' ? 'a move part' : `any ${e.partner.family}`}`,
  title: (from: string) => `${from} evolves`,
  on: 'on',
  already: 'already evolved',
  nothing: 'nothing more to learn yet',
  rank: (n: number) => `rank ${['', 'I', 'II', 'III'][n] ?? n} of III`,
  partner: (worn: boolean) => (worn ? 'partner worn' : 'partner missing'),
}

/** The evolution a part has, whether or not its partner is worn. */
export const evoOf = (partId: string): EvoId | null => (Object.keys(EVOLUTIONS) as EvoId[]).find((id) => EVOLUTIONS[id].part === partId) ?? null

/** Whether the partner is worn in a slot other than `partId`'s own. */
export function partnerWorn(evo: EvoId, partId: string, worn: readonly { id: string; slot: string }[]): boolean {
  const p = EVOLUTIONS[evo].partner
  const own = worn.find((w) => w.id === partId)
  return worn.some((w) => w !== own && w.slot !== own?.slot && (p.part ? w.id === p.part : !!p.family && FAMILY[w.id] === p.family))
}

/** The evolution `partId` earns with `worn` (every part worn, its slot), or null: no archetype, no evolution for it, or its partner not worn in another slot. */
export function evoFor(partId: string, worn: readonly { id: string; slot: string }[], arch: ArchetypeId | null): EvoId | null {
  const evo = arch ? evoOf(partId) : null
  return evo && partnerWorn(evo, partId, worn) ? evo : null
}

/** The part as evolved: `d` is the III def. */
export function evolved(d: AbilityDef, evo: EvoId): AbilityDef {
  const e = EVOLUTIONS[evo]
  return { ...d, ...e.over, name: e.name, line: e.line, evo, damage: Math.round(d.damage * e.dmgMul), rank: 3 }
}
