/**
 * The enemy curve by depth (design/scaling/CURVE.md). His call, 28 Sep: once Still may grow inside a
 * run, "never more enemy HP or damage" is lifted, "but be smart so that growth is not punished". So
 * this is keyed on depth alone, never on what he wears, his ranks or his mastery: a curve set under a
 * median run's power, so every rank he earns past it is felt. Ordinary bodies rise little (fodder stays
 * fodder); heavies (an elite pack's crowned leader) and bosses carry it.
 *
 * No three.js here: tools import it.
 */
export interface DepthCurve {
  /** Ordinary bodies: HP and damage multipliers (a heavy's are below, a boss's never). */
  hp: number
  dmg: number
  /** The room budget: bodies added by depth, and again in a big room (dungeon.ts). */
  budget: number
  bigBonus: number
  /** A heavy: HP on top of the crowning's x2, and its damage. */
  heavyHp: number
  heavyDmg: number
  /** Elite packs (one crowned heavy each) on a level. */
  heavies: number
  /** A boss's HP, x its def's 900. */
  bossHp: number
}

/**
 * Depths 1-6; the walk home's 7 reads 5's. The harder target (his call, 28 Sep): never-melt finishes
 * ~1 in 3, median ~2 in 3, investor nearly always; modelled 28 / 74 / 97 (CURVE.md). Depth 5 is the
 * wall on purpose (density x HP charges for growth not taken); heavies carry the rest; bosses modest.
 */
export const DEPTH_CURVE: Record<number, DepthCurve> = {
  1: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.0, heavyDmg: 1.0, heavies: 1, bossHp: 1 },
  2: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.25, heavyDmg: 1.0, heavies: 1, bossHp: 1 },
  3: { hp: 1.0, dmg: 1.0, budget: 1, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 2, bossHp: 1.1 },
  4: { hp: 1.1, dmg: 1.0, budget: 1, bigBonus: 0, heavyHp: 1.5, heavyDmg: 1.1, heavies: 2, bossHp: 1 },
  5: { hp: 1.3, dmg: 1.0, budget: 2, bigBonus: 1, heavyHp: 2.0, heavyDmg: 1.3, heavies: 3, bossHp: 1 },
  6: { hp: 1.0, dmg: 1.0, budget: 2, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 3, bossHp: 1.3 },
}

/** The curve at a depth: past the table, its last crawl depth's (the walk home is 5's). */
export function curveAt(depth: number): DepthCurve {
  return DEPTH_CURVE[depth] ?? DEPTH_CURVE[5]!
}
