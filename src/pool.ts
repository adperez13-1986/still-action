import { PARTS, type Tier } from './abilities'
import type { DropSource } from './loot'
import type { SlotName } from './still'
import type { PartId, SaveV1 } from './save'

/**
 * The findable pool, across runs. It starts at twelve: the eight plain parts and
 * the four blues that bend the starting whites most plainly. The rest are found,
 * and only from moments (an elite, a bargain, the Assembler), never from an
 * ordinary kill or a crate, and never at depth 1, so ending a run early doesn't
 * pay. Wider, never stronger.
 */
export const STARTER_POOL: PartId[] = [
  'focusing-lens', 'flare', 'pressure-vent', 'ward', 'scrap-cleaver', 'piston', 'kickstart', 'skitter',
  'cracked-lens', 'backdraft-vent', 'rusted-hook', 'skid-plates',
]

/** Chance a drop is drawn from the unfound parts, by source. INV: 0 for kill and crate; 0 at depth < minDepth. */
export const POOL_RULES = {
  minDepth: 2,
  unfound: { kill: 0, crate: 0, elite: 0.25, plenty: 0.25, 'boss-blue': 0.25, 'boss-gold': 1 } as Record<DropSource, number>,
  /** Which tiers an unfound attempt may give. boss-gold only ever gives an unfound GOLD. */
  unfoundTiers: {
    kill: [], crate: [], elite: ['blue', 'gold'], plenty: ['blue', 'gold'], 'boss-blue': ['blue'], 'boss-gold': ['gold'],
  } as Record<DropSource, Tier[]>,
}

export interface PoolView { found: ReadonlySet<PartId>; turned: ReadonlySet<PartId>; depth: number }
export const poolView = (s: SaveV1, depth: number): PoolView => ({ found: new Set(s.found), turned: new Set(s.turned), depth })

/** A part joins the pool. True if it's newly found (the caller writes the save at once). */
export function markFound(s: SaveV1, id: PartId): boolean {
  if (s.found.includes(id)) return false
  s.found.push(id)
  return true
}

const TIER_OF = new Map(PARTS.map((p) => [p.id, p.tier]))

/**
 * What can go on the hook after an ending (§4.4): the parts he was wearing,
 * minus golds, minus turned, once each. The same for all three endings: the
 * pieces all come home. Wearing only golds leaves nothing.
 */
export function hookCandidates(s: SaveV1, worn: (PartId | null)[]): PartId[] {
  const turned = new Set(s.turned)
  const out: PartId[] = []
  for (const id of worn) {
    if (id && TIER_OF.get(id) !== 'gold' && !turned.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** Found whites that face out, optionally for one slot: what fills an empty slot, and what a run can start with. */
export function facingOutWhites(s: SaveV1, slot?: SlotName): PartId[] {
  const found = new Set(s.found)
  const turned = new Set(s.turned)
  return PARTS.filter((p) => p.tier === 'white' && found.has(p.id) && !turned.has(p.id) && (!slot || p.slot === slot)).map((p) => p.id)
}
