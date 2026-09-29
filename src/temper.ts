import type { AbilityDef, Mod } from './abilities'

/**
 * Temper (28 Sep prototype, his ask: "after some time, I don't really care about the drops").
 * A floor part he doesn't want can be melted into the part he wears in that slot: it ranks up,
 * I -> II -> III, for this run only. Every rank hits harder and
 * comes back sooner; a blast, a shell, a lob and a swing also reach wider, so a rank is seen.
 * Inside a run Still gets stronger (DESIGN.md, Persistence, 28 Sep); between runs nothing carries.
 * A swap from a part at II or III lands at `swapRank` (design/synergy, 28 Sep): the part given up
 * melts into the new one. From a part at I it's a plain swap (29 Sep, his call: never-melt runs).
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
  /**
   * A new part taken over a worn one at II or III lands at this rank and the old one is used up
   * (over a part at I: a plain swap, the new one at I, the old one at his feet). Keeping half the rank would make swaps free; a full reset kills them by mid-run.
   */
  swapRank: 2,
}

export const ROMAN = ['', 'I', 'II', 'III'] as const

/** The shapes whose `radius` is an area he sees (a blast, a shell, a landing, a burst). */
const AREA: ReadonlySet<AbilityDef['shape']> = new Set(['nova', 'ward', 'lob', 'decoy'])

/** The shapes whose `windowMs` is a shield or a catch he holds: a rank holds it longer. */
const HELD: ReadonlySet<AbilityDef['shape']> = new Set(['ward', 'catch'])

/**
 * A part's own numbers that live in its mod, scaled the same way, so every rank does something on
 * every part (the 28 Sep audit: Patient Lens's charge clock, Frayed's widths, Clamp Toss's wall hit,
 * Skid Plates' slam, Overrun's pushed dash, Frost Trail's strip and Mirror Ward's reflection ignored rank).
 */
function temperMod(mod: Mod | undefined, dmg: number, cd: number, area: number): Mod | undefined {
  if (!mod) return mod
  const n = (x: number, k: number) => Math.round(x * k)
  const u = (x: number, k: number) => +(x * k).toFixed(2)
  switch (mod.kind) {
    case 'charge': return { ...mod, minS: u(mod.minS, cd), fullS: u(mod.fullS, cd) }
    case 'reflect': return { ...mod, damage: n(mod.damage, dmg) }
    case 'fray': return { ...mod, cones: mod.cones.map((c) => Math.min(360, n(c, area))) as unknown as readonly [number, number, number] }
    case 'toss': return { ...mod, wallDamage: n(mod.wallDamage, dmg) }
    case 'slam': return { ...mod, damage: n(mod.damage, dmg), radius: u(mod.radius, area) }
    case 'overrun': return { ...mod, damage: n(mod.damage, dmg), radius: u(mod.radius, area) }
    case 'strip': return { ...mod, width: u(mod.width, area) }
    default: return mod
  }
}

/** `base` at `rank`: the same part (same id, same runtime), its numbers scaled. Rank 1 is `base` itself. */
export function tempered(base: AbilityDef, rank: number): AbilityDef {
  const r = Math.max(1, Math.min(TEMPER.maxRank, Math.floor(rank)))
  if (r === 1) return base
  const i = r - 1
  const dmg = TEMPER.damage[i]!
  const cd = TEMPER.cooldown[i]!
  const area = TEMPER.area[i]!
  const held = HELD.has(base.shape) || base.mod?.kind === 'brace'
  return {
    ...base,
    name: `${base.name} ${ROMAN[r]}`,
    rank: r,
    damage: Math.round(base.damage * dmg),
    cooldownMs: Math.round(base.cooldownMs * cd),
    mod: temperMod(base.mod, dmg, cd, area),
    ...(AREA.has(base.shape) ? { radius: +(base.radius * area).toFixed(2) } : {}),
    ...(base.shape === 'arc' && base.cone ? { cone: Math.min(360, Math.round(base.cone * area)) } : {}),
    ...(base.blastDamage ? { blastDamage: Math.round(base.blastDamage * dmg) } : {}),
    ...(held && base.windowMs ? { windowMs: Math.round(base.windowMs * area) } : {}),
  }
}
