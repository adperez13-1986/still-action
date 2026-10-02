import { PARTS, type AbilityDef, type DropGate, type Tier } from './abilities'
import type { SlotName } from './still'
import type { Archetype, Pack } from './combat'
import { POOL_RULES, type PoolView } from './pool'
import { FILTER, KEYSTONES, fitOf, type CoreId, type KeystoneDef, type KeystoneId } from './cores'

/**
 * The drop rules with nothing of three.js or the page in them, so a script can run them
 * (tools/dropsim.ts). loot.ts re-exports them; the game's behaviour is exactly as before.
 *
 * D2's structure, not D2's maths. Each archetype has a treasure class that
 * leans toward certain slots; a tier roll picks white, blue or gold; the part
 * comes from whatever of that tier isn't already on Still. Tiers mean
 * "different", never "stronger".
 */
export type DropSource = 'kill' | 'crate' | 'elite' | 'plenty' | 'boss-blue' | 'boss-gold'

export const LOOT = {
  /**
   * One pack pays out about this many parts, whatever its size: each kill rolls
   * packPayout / size. Low on purpose: a phone screen buried in beams can't show telegraphs.
   */
  packPayout: 0.66,
  /** Tier odds per source. Elites and Plenty lean toward the interesting tiers; only they can give gold. */
  odds: {
    kill: { white: 0.60, blue: 0.40, gold: 0 },
    crate: { white: 0.60, blue: 0.40, gold: 0 },
    elite: { white: 0.15, blue: 0.75, gold: 0.10 },
    plenty: { white: 0.15, blue: 0.75, gold: 0.10 },
  } as Record<'kill' | 'crate' | 'elite' | 'plenty', Record<Tier, number>>,
  pickupRadius: 1.15,
  /** A crate or barrel: sometimes a part, more often a scrap of repair. */
  crateParts: 0.1,
  crateScrap: 0.3,
  scrapHeal: 20,
}

const TREASURE: Record<Archetype, Record<SlotName, number>> = {
  // chasers are all arms and torso; ranged ones are all eyes and legs; rams are legs; mites are eyes
  chaser: { head: 1, torso: 3, arms: 3, legs: 1 },
  ranged: { head: 3, torso: 1, arms: 1, legs: 3 },
  charger: { head: 2, torso: 1, arms: 1, legs: 4 },
  swarm: { head: 4, torso: 1, arms: 1, legs: 2 },
  boss: { head: 1, torso: 1, arms: 1, legs: 1 },
  // never rolled (it adds no loot, and weighs 0), but the record needs the key
  thief: { head: 1, torso: 1, arms: 1, legs: 1 },
  // the mender drops like the sentinel it's about the size of
  mender: { head: 3, torso: 1, arms: 1, legs: 3 },
}

/**
 * A kill's share of its pack's payout. A pack weighs the sum of its members at
 * birth, so a pack pays out the same whatever it's made of. Split halves and boss
 * adds weigh 0 (Combat passes 0 for them). A mite is a quarter: a
 * brood of 8 pays out like two hulks. The thief weighs nothing: it has no pack, and a catch
 * gives back only what it took. A mender weighs a sentinel's.
 */
export const KILL_WEIGHT: Record<Archetype, number> = { chaser: 1, ranged: 1, charger: 1, swarm: 0.25, boss: 1, thief: 0, mender: 1 }

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][]
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1]![0]
}

/** Which parts each source may give. A 'rare' part only comes from something rare; a 'boss' part only from a boss. */
const GATES: Record<DropSource, readonly DropGate[]> = {
  kill: ['any'], crate: ['any'], elite: ['any', 'rare'], plenty: ['any', 'rare'],
  'boss-blue': ['any', 'rare', 'boss'], 'boss-gold': ['any', 'rare', 'boss'],
}

/**
 * The chance this kill drops a part: 1 when it's owed (an elite, or a side room's
 * last kill with nothing dropped yet), 0 for a boss add or a split half, otherwise
 * this kill's weight share of the pack's payout.
 */
export function dropChance(
  pack: Pick<Pack, 'weight' | 'side' | 'dropped'> & { members: readonly unknown[] }, wasElite: boolean, summoned: boolean, weight = 1,
): number {
  if (summoned) return 0
  if (wasElite || (pack.side && pack.members.length === 0 && !pack.dropped)) return 1
  if (weight <= 0) return 0
  return (LOOT.packPayout * weight) / Math.max(1e-6, pack.weight)
}

/**
 * Null when nothing is left to find at any tier. `taken` is everything on Still
 * or on the floor; `exclude` keeps it off some slots (a boss's second drop off the first
 * one's, a floor drop off the empty ones). `fresh` false: only found parts.
 *
 * `pool` is what the save knows (§4.9). A part turned to the wall never comes.
 * A moment (an elite, a bargain, the Assembler) past the first depth sometimes
 * reaches into the parts never found, only in the tiers that moment may give;
 * everything else, and every fall-through, is drawn from the found ones exactly
 * as before.
 */
export function rollPart(
  from: Archetype, taken: readonly AbilityDef[], source: DropSource, pool: PoolView, exclude: readonly SlotName[] = [], fresh = true,
): AbilityDef | null {
  const on = new Set(taken.map((p) => p.id))
  const gates = GATES[source]
  const base = PARTS.filter((p) => !on.has(p.id) && !pool.turned.has(p.id) && gates.includes(p.drops) && !exclude.includes(p.slot))
  const wantUnfound = fresh && pool.depth >= POOL_RULES.minDepth && Math.random() < POOL_RULES.unfound[source]
  if (wantUnfound) {
    const tiers = POOL_RULES.unfoundTiers[source]
    const unfound = base.filter((p) => !pool.found.has(p.id) && tiers.includes(p.tier))
    const def = pickPart(from, unfound, source)
    if (def) return def
  }
  return pickPart(from, base.filter((p) => pool.found.has(p.id)), source)
}

/** Today's draw: tier first, falling back through the others if that tier has nothing left, then slot by treasure class. */
function pickPart(from: Archetype, pool: readonly AbilityDef[], source: DropSource): AbilityDef | null {
  if (pool.length === 0) return null
  const first: Tier = source === 'boss-blue' ? 'blue' : source === 'boss-gold' ? 'gold' : pickWeighted(LOOT.odds[source])
  const order: Tier[] = source === 'boss-gold' ? ['gold', 'blue', 'white'] : [first, 'blue', 'white', 'gold']
  for (const tier of order) {
    const tierPool = pool.filter((p) => p.tier === tier)
    if (tierPool.length === 0) continue
    const slotWeights = {} as Record<SlotName, number>
    for (const p of tierPool) slotWeights[p.slot] = TREASURE[from][p.slot]
    const slot = pickWeighted(slotWeights)
    const options = tierPool.filter((p) => p.slot === slot)
    return options[Math.floor(Math.random() * options.length)]!
  }
  return null
}

/**
 * The hunt (design/buildlayer/BUILD.md §2.9, 3-balancer.md: share 0.5). With a core worn, at an elite, Plenty or boss-blue drop (`FILTER.sources`; never gold, kills or crates),
 * `FILTER.share` of the time the drop comes from the core's own pool: every part with `fits[core]` and every keystone of that core, minus what is worn or lying
 * (`taken`), the keystone socketed or lying (`keys`), and what is turned to the wall. A part still has to be one this source may give (its `drops` gate). A keystone weighs
 * `FILTER.keyWeight` against 1 for each part. Found or not does not matter: a core's own parts are always in reach (R6). Null: no core, another source, the roll missed, or an empty
 * pool: the caller rolls `rollPart` as today. With no core nothing is drawn, so a bare run's draws are as they were.
 */
export function rollForCore(
  core: CoreId | null, source: DropSource, taken: readonly AbilityDef[], keys: { socketed: KeystoneId | null; onFloor: readonly KeystoneId[] }, pool: PoolView,
): AbilityDef | KeystoneDef | null {
  if (!core || !(FILTER.sources as readonly DropSource[]).includes(source)) return null
  if (Math.random() >= FILTER.share) return null
  const on = new Set(taken.map((p) => p.id))
  const gates = GATES[source]
  const parts = PARTS.filter((p) => fitOf(p, core) && !on.has(p.id) && !pool.turned.has(p.id) && gates.includes(p.drops))
  const keystones = (Object.values(KEYSTONES) as KeystoneDef[]).filter((k) => k.core === core && k.id !== keys.socketed && !keys.onFloor.includes(k.id))
  const total = parts.length + keystones.length * FILTER.keyWeight
  if (total <= 0) return null
  let x = Math.random() * total
  for (const p of parts) if ((x -= 1) < 0) return p
  for (const k of keystones) if ((x -= FILTER.keyWeight) < 0) return k
  return keystones[keystones.length - 1] ?? parts[parts.length - 1] ?? null
}

const SLOTS: readonly SlotName[] = ['head', 'torso', 'arms', 'legs']

/**
 * The slots he has nothing on. Pedestal sets put these first; floor parts can be for any slot
 * (28 Sep: the pedestals-only rule for empty slots is gone, at his ask).
 */
export const emptySlots = (worn: readonly AbilityDef[]): SlotName[] => SLOTS.filter((sl) => !worn.some((p) => p.slot === sl))

/**
 * Picks on pedestals (design/replay/PITCHES.md 2): three parts rise together and he takes one;
 * the others go back to the wall. Beside every non-boss crawl depth's exit beam, after a boss
 * with more of the day to come (the Assembler), and at a Plenty shrine.
 */
export type PickKind = 'exit' | 'plenty' | 'gift'
export const PEDESTALS = {
  /** What each pedestal of a set rolls as: that source's own pool and rarity rules, nothing weighted. */
  sources: {
    exit: ['kill', 'kill', 'kill'],
    plenty: ['plenty', 'plenty', 'plenty'],
    gift: ['boss-gold', 'boss-blue', 'boss-blue'],
  } as Record<PickKind, DropSource[]>,
  /** Plenty's price, paid on the take. */
  plentyStrain: 4,
  /** The gift's second pick: its price, which no quiet takes back. */
  secondStrain: 4,
}

/**
 * Pedestals are off (28 Sep, his call: "remove the pedestals"; he was "not feeling the benefit").
 * Exits raise nothing, Plenty drops one part for its strain, a boss leaves a blue and a gold on the
 * floor (never for the same slot), as before pedestals. The code stays behind this for a way back.
 * Here, not in main.ts, so the drop simulator (tools/dropsim.ts) reads the value the game does.
 */
export const PEDESTALS_ON = false

/**
 * One set: each pedestal on its own slot, every empty slot first (so a run goes from sparse to
 * whole: the fourth button lights at the Assembler), and at most one part never found among them
 * (so the wall fills no faster). Slots are drawn even, as a boss's are.
 */
export function rollPicks(
  kind: PickKind, worn: readonly AbilityDef[], taken: readonly AbilityDef[], pool: PoolView,
): AbilityDef[] {
  const out: AbilityDef[] = []
  const empty = emptySlots(worn)
  PEDESTALS.sources[kind].forEach((source) => {
    const used = out.map((p) => p.slot)
    const open = empty.filter((sl) => !used.includes(sl))
    const fresh = out.every((p) => pool.found.has(p.id))
    const all = [...taken, ...out]
    const def = (open.length ? rollPart('boss', all, source, pool, SLOTS.filter((sl) => !open.includes(sl)), fresh) : null)
      ?? rollPart('boss', all, source, pool, used, fresh)
    if (def) out.push(def)
  })
  return out
}
