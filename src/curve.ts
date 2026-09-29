/**
 * The enemy curve by depth (design/scaling/CURVE.md). His call, 28 Sep: once Still may grow inside a
 * run, "never more enemy HP or damage" is lifted, "but be smart so that growth is not punished". So
 * this is keyed on depth alone, never on what he wears, his ranks or his mastery: a curve set under a
 * median run's power, so every rank he earns past it is felt. Ordinary bodies rise little (fodder stays
 * fodder); heavies (an elite pack's crowned leader) and bosses carry it.
 *
 * Rows for a 6- and a 9-depth run: the 6-depth table is what the game is today; the 9-depth one is
 * design/scaling/CURVE9.md's first pass, not locked (stage T tunes it). A run reads the table of its own
 * length (`curveAt(depth, run)`), so the live 6-depth game does not move while the 9-depth one is built.
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
  /** A boss's HP, x its def's 900, and its damage on every hurt path. */
  bossHp: number
  bossDmg: number
}

/** 6 or 9 depths: areas.ts's RUN_DEPTHS. */
export type RunLength = 6 | 9

/**
 * A 6-depth run: depths 1-6; the walk home's 7 reads 5's. The harder target (his call, 28 Sep): never-melt finishes
 * ~1 in 3, median ~2 in 3, investor nearly always. Recalibrated on his runs (CURVE.md, version B, with
 * bosses taking half from the autos, `BOSS_AUTO_MUL` in combat.ts): modelled 35 / 73 / 92. Ordinary
 * damage carries depths 4-5; heavies carry the rest; bosses are growth checks, not walls.
 */
export const DEPTH_CURVE_6: Record<number, DepthCurve> = {
  1: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.0, heavyDmg: 1.0, heavies: 1, bossHp: 1, bossDmg: 1 },
  2: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.25, heavyDmg: 1.0, heavies: 1, bossHp: 1, bossDmg: 1 },
  3: { hp: 1.0, dmg: 1.0, budget: 1, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 2, bossHp: 1.0, bossDmg: 1.1 },
  4: { hp: 1.1, dmg: 1.5, budget: 1, bigBonus: 0, heavyHp: 1.5, heavyDmg: 1.1, heavies: 2, bossHp: 1, bossDmg: 1 },
  5: { hp: 1.3, dmg: 1.5, budget: 2, bigBonus: 1, heavyHp: 2.0, heavyDmg: 1.3, heavies: 3, bossHp: 1, bossDmg: 1 },
  6: { hp: 1.0, dmg: 1.0, budget: 2, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 3, bossHp: 1.3, bossDmg: 1.2 },
}

/** The walk home: nothing reads it (the walk has no bodies), but it is explicit. heavies 0. */
export const WALK_CURVE: DepthCurve = { hp: 1, dmg: 1, budget: 0, bigBonus: 0, heavyHp: 1, heavyDmg: 1, heavies: 0, bossHp: 1, bossDmg: 1 }

/**
 * A 9-depth run: CURVE9.md §1, first pass, NOT locked. Depths 1-3 are shared with the 6-depth table; 4-5 are
 * softer (damage 1.2 / 1.25, not 1.5), because a run now has nine checks, not six; 6 is the middle boss; 7 is
 * a road's first depth like 4, 8 the hardest crawl depth, 9 the longest boss fight. The curve reads the real
 * depth, never the step (a road's 7 is not its 4).
 */
export const DEPTH_CURVE_9: Record<number, DepthCurve> = {
  1: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.0, heavyDmg: 1.0, heavies: 1, bossHp: 1, bossDmg: 1 },
  2: { hp: 1.0, dmg: 1.0, budget: 0, bigBonus: 0, heavyHp: 1.25, heavyDmg: 1.0, heavies: 1, bossHp: 1, bossDmg: 1 },
  3: { hp: 1.0, dmg: 1.0, budget: 1, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 2, bossHp: 1.0, bossDmg: 1.1 },
  4: { hp: 1.1, dmg: 1.2, budget: 1, bigBonus: 0, heavyHp: 1.5, heavyDmg: 1.1, heavies: 2, bossHp: 1, bossDmg: 1 },
  5: { hp: 1.2, dmg: 1.25, budget: 2, bigBonus: 1, heavyHp: 1.75, heavyDmg: 1.2, heavies: 3, bossHp: 1, bossDmg: 1 },
  6: { hp: 1.0, dmg: 1.0, budget: 2, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 3, bossHp: 1.2, bossDmg: 1.0 },
  7: { hp: 1.2, dmg: 1.25, budget: 2, bigBonus: 1, heavyHp: 1.75, heavyDmg: 1.2, heavies: 3, bossHp: 1, bossDmg: 1 },
  8: { hp: 1.3, dmg: 1.3, budget: 2, bigBonus: 1, heavyHp: 2.0, heavyDmg: 1.3, heavies: 3, bossHp: 1, bossDmg: 1 },
  9: { hp: 1.0, dmg: 1.0, budget: 2, bigBonus: 1, heavyHp: 1.0, heavyDmg: 1.0, heavies: 3, bossHp: 1.3, bossDmg: 1.05 },
  10: WALK_CURVE,
}

/**
 * The curve at a depth, for a run of this length.
 * INV-C1: rows 1-3 are equal in both tables; budget, bigBonus and heavies are equal at 1-5, so pack generation
 *         at 1-5 is the same for both run lengths.
 * INV-C2: run 6: past the table, its last crawl depth's (the walk home is 5's). Run 9: past the table, WALK_CURVE.
 * INV-C3: the depth is the real depth, never stepOf. The run length is a required argument, so a call that forgets
 *         it does not compile.
 */
export function curveAt(depth: number, run: RunLength): DepthCurve {
  return run === 9 ? (DEPTH_CURVE_9[depth] ?? WALK_CURVE) : (DEPTH_CURVE_6[depth] ?? DEPTH_CURVE_6[5]!)
}
