import type { AbilityDef } from './abilities'

/**
 * Temper (28 Sep prototype, his ask: "after some time, I don't really care about the drops").
 * A floor part he doesn't want can be melted into the part he wears in that slot: it ranks up,
 * I -> II -> III, for this run only (a swap starts the new part at I). Every rank hits harder and
 * comes back sooner; a blast, a shell, a lob and a swing also reach wider, so a rank is seen.
 * Inside a run Still gets stronger (DESIGN.md, Persistence, 28 Sep); between runs nothing carries.
 */
export const TEMPER = {
  maxRank: 3,
  /** By rank, I II III. */
  damage: [1, 1.3, 1.6],
  cooldown: [1, 0.85, 0.72],
  area: [1, 1.15, 1.3],
  /**
   * Fewer, louder drops while temper is on: an ordinary kill's payout, as a share of today's.
   * Elites, a side room's last kill, crates and pedestals are as they were.
   */
  killPayout: 0.4,
}

export const ROMAN = ['', 'I', 'II', 'III'] as const

/** The shapes whose `radius` is an area he sees (a blast, a shell, a landing, a burst). */
const AREA: ReadonlySet<AbilityDef['shape']> = new Set(['nova', 'ward', 'lob', 'decoy'])

/** `base` at `rank`: the same part (same id, same runtime), its numbers scaled. Rank 1 is `base` itself. */
export function tempered(base: AbilityDef, rank: number): AbilityDef {
  const r = Math.max(1, Math.min(TEMPER.maxRank, Math.floor(rank)))
  if (r === 1) return base
  const i = r - 1
  return {
    ...base,
    name: `${base.name} ${ROMAN[r]}`,
    rank: r,
    damage: Math.round(base.damage * TEMPER.damage[i]!),
    cooldownMs: Math.round(base.cooldownMs * TEMPER.cooldown[i]!),
    ...(AREA.has(base.shape) ? { radius: +(base.radius * TEMPER.area[i]!).toFixed(2) } : {}),
    ...(base.shape === 'arc' && base.cone ? { cone: Math.min(360, Math.round(base.cone * TEMPER.area[i]!)) } : {}),
  }
}
