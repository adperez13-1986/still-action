import { PARTS, STARTING, type Tier } from './abilities'
import type { DropSource } from './loot'
import type { SlotName } from './still'
import type { PartHistory, PartId, Save } from './save'

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
export const poolView = (s: Save, depth: number): PoolView => ({ found: new Set(s.found), turned: new Set(s.turned), depth })

/** A part joins the pool. True if it's newly found (the caller writes the save at once). */
export function markFound(s: Save, id: PartId): boolean {
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
export function hookCandidates(s: Save, worn: (PartId | null)[]): PartId[] {
  const turned = new Set(s.turned)
  const out: PartId[] = []
  for (const id of worn) {
    if (id && TIER_OF.get(id) !== 'gold' && !turned.has(id) && !out.includes(id)) out.push(id)
  }
  return out
}

/** Found whites that face out, optionally for one slot: what fills an empty slot, and what a run can start with. */
export function facingOutWhites(s: Save, slot?: SlotName): PartId[] {
  const found = new Set(s.found)
  const turned = new Set(s.turned)
  return PARTS.filter((p) => p.tier === 'white' && found.has(p.id) && !turned.has(p.id) && (!slot || p.slot === slot)).map((p) => p.id)
}

const SLOT_OF = new Map(PARTS.map((p) => [p.id, p.slot]))
const KNOWN = new Set(PARTS.map((p) => p.id))

/**
 * §4.7. Only found parts turn. Turning one back is always allowed; turning one to
 * the wall is refused if it would leave its slot with no plain part facing out
 * (with two whites a slot, at most one of them can face the wall).
 */
export function canTurn(s: Save, id: PartId): boolean {
  if (!s.found.includes(id)) return false
  if (s.turned.includes(id)) return true
  const slot = SLOT_OF.get(id)
  if (!slot) return false
  return facingOutWhites(s, slot).some((w) => w !== id)
}

/** Turn a part to the wall, or back. False if refused. Turning the hooked part takes it off the hook. */
export function toggleTurn(s: Save, id: PartId): boolean {
  if (!canTurn(s, id)) return false
  if (s.turned.includes(id)) {
    s.turned = s.turned.filter((t) => t !== id)
  } else {
    s.turned.push(id)
    if (s.hook === id) s.hook = null
  }
  return true
}

/** What the hook's card offers now: the last ending's candidates, or (with none pending) whatever already hangs. */
export function hookOffers(s: Save): PartId[] {
  if (s.pendingHook) return s.pendingHook.candidates
  return s.hook ? [s.hook] : []
}

/** "Hang it": the part must be one of the ending's candidates, and not turned. It can change any number of times. */
export function hang(s: Save, id: PartId): boolean {
  if (!s.pendingHook?.candidates.includes(id) || s.turned.includes(id)) return false
  s.hook = id
  return true
}

/**
 * At the door (§4.5): if nothing hangeable came home, the thread breaks; if the hook
 * holds something that didn't, the first candidate goes up. Then the choice is made.
 * `hook` stays set: it's the thread the next ending's default follows.
 */
export function applyHookDefault(s: Save): void {
  if (!s.pendingHook) return
  const open = s.pendingHook.candidates.filter((id) => !s.turned.includes(id))
  if (open.length === 0) s.hook = null
  else if (!s.hook || !open.includes(s.hook)) s.hook = open[0]!
  s.pendingHook = null
}

/**
 * The part a run starts with (§4.6): the hook's, if it's found, facing out and still
 * a part; otherwise a random plain starter facing out; otherwise any plain part
 * facing out, which always exists (every slot keeps one).
 */
export function startPart(s: Save): PartId {
  if (s.hook && KNOWN.has(s.hook) && s.found.includes(s.hook) && !s.turned.includes(s.hook)) return s.hook
  const out = new Set(facingOutWhites(s))
  const starters = STARTING.map((p) => p.id).filter((id) => out.has(id))
  const pool = starters.length ? starters : [...out]
  return pool[Math.floor(Math.random() * pool.length)]!
}

/** INV: every slot keeps a found white facing out. A save that breaks it (hand-edited, or an old build) is mended. */
export function keepWhites(s: Save): void {
  for (const slot of ['head', 'torso', 'arms', 'legs'] as const) {
    if (facingOutWhites(s, slot).length > 0) continue
    const white = PARTS.find((p) => p.slot === slot && p.tier === 'white' && s.turned.includes(p.id))
    if (white) s.turned = s.turned.filter((t) => t !== white.id)
  }
}

// --- parts remember (§7.1) ------------------------------------------------------------

/**
 * What a part is called once it has a past: the first rule that matches, never a
 * stat. The Arbiter, the last of the day, outranks the Assembler.
 */
export const NAMED: { test: (h: PartHistory) => boolean; suffix: string }[] = [
  { test: (h) => (h[6] ?? 0) >= 1, suffix: ', that saw the Arbiter' },
  { test: (h) => h[2] >= 2, suffix: ', that saw the Assembler twice' },
  { test: (h) => h[2] >= 1, suffix: ', that saw the Assembler' },
]

/** "Scrap Cleaver, that saw the Assembler": the name on every card and drop from then on. */
export function partName(s: Save, id: PartId, name: string): string {
  const h = s.history[id]
  const rule = h && NAMED.find((n) => n.test(h))
  return rule ? name + rule.suffix : name
}

/** "carried 4 runs, saw depth 6"; null before it has been carried through a whole run. */
export function historyLine(s: Save, id: PartId): string | null {
  const h = s.history[id]
  if (!h || h[0] <= 0) return null
  return `carried ${h[0]} run${h[0] === 1 ? '' : 's'}, saw depth ${h[1]}`
}
