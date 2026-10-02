import type { AbilityDef } from './abilities'

/**
 * The build layer (design/buildlayer/BUILD.md): every number and every word of the "builds" trial, in one place. No three.js, so
 * tools/corecheck.ts runs it under node. A core replaces the hand and the eye; it marks bodies, and the parts that fit it spend the marks.
 * With no core worn nothing here is read: the game is today's (BUILD.md §1, K-M1).
 *
 * B1 landed the data, the switch and the machine. B2 (Wake) built Wake's skim, its three reshapes (VARIANTS), Burst, Deep Frost, Spray and Slipstream, and the
 * rings (markfx.ts); B3 (Ram) built Ram's shove and slams, Domino, Catch, Wide Shove and Rubble, Piston's variant and Ram's ring look. The pick comes in B4, the hunt and the buttons in B5. The numbers are the SHIP column of design/buildlayer/3-balancer.md §1 (the balancer's re-price of
 * BUILD.md's, which the lead made binding on 2 Oct); where that file added a number or a rule, it is marked **new** below. A rule that is B2-B5's
 * is only recorded here.
 */

export type CoreId = 'wake' | 'ram'
export const CORE_IDS: readonly CoreId[] = ['wake', 'ram']

/** A part's job for one core. spend: cashes marks on every body it hits. shape: moves bodies or holds them. guard: protects. */
export type FitRole = 'spend' | 'shape' | 'guard'
/**
 * `slams` (Ram only): this part's own knock runs Ram's slam test (§2.6).
 * `k` (a spender's, **new** in 3-balancer.md): this part's own flat damage per mark, in place of the core's K for its spend. Absent: `CORES[core].K`.
 * The bridge (Scrap Cleaver) spends at about half, so a core's own spenders are worth hunting.
 */
export interface Fit { role: FitRole; slams?: true; k?: number }

/** The two cores. INV: K is flat damage per mark, added after every multiplier (§2.2). */
export const CORES = {
  wake: {
    /** Flat damage a spend adds per mark, for a part with no `Fit.k` of its own. Sim: build-sim.mjs DRIVES.wake.K. */
    K: 6, cap: 3, lifeS: 3,
    /** A skim: an awake body whose EDGE is within `radius` of Still while he moves sideways to it (§2.5). */
    radius: 1.6, sideCos: Math.SQRT1_2, minSpeed: 1, perBodyS: 1,
    /** What a skim deals (x BOSS_AUTO_MUL on a boss, like any auto). "Wake kills nothing on its own." Ship 6 (BUILD.md: 4): the never-melt floor, 3-balancer.md §3. */
    damage: 6,
    /**
     * **new**: a skim on a body that can't be moved (§2.6's immovable test: a boss, an anchored body, knockMul < 0.1) deals full damage (x`mul`, not BOSS_AUTO_MUL),
     * once per `perBodyS` (BUILD.md: x BOSS_AUTO_MUL, once per 1 s). Wake boss whites -25% -> -8% against today. Built in B2 (combat.ts tickWake).
     */
    bossSkim: { mul: 1, perBodyS: 0.5 },
  },
  ram: {
    /** 8, not the sim's untested 6-10: the scratch run in §7 R2 (boss c1 +32%, deep c3 +15% at 0.4 slams a shove). */
    K: 8, cap: 3, lifeS: 3,
    /**
     * The shove: the nearest awake body in `reach`, every `beatS`, `shove` u x its knockMul, away from Still. `damage` is the beat's hit: ship 8 (BUILD.md: 6),
     * so K-M13's "it takes 6" is 8.
     * `reach` is HAND.range and `beatS` is AUTO_INTERVAL (combat.ts), copied here so this file stays free of three.js; corecheck holds them equal.
     */
    reach: 2.9, beatS: 0.62, shove: 1.5, damage: 8,
    /** A body ending within this of another body's edge along the shove is a body slam. `shortEps` is Clamp Toss's (combat.ts grab). */
    bodyPad: 0.1, shortEps: 0.05,
    /**
     * **A departure from BUILD.md §2.6** (reported at B3): the body test only counts a body AHEAD of the shoved one (its centre beyond the shoved one's, along the shove). BUILD.md's
     * literal test counts any body within `radius + radius + bodyPad` of the segment, which includes a neighbour touching the shoved body's side or behind it: a shove that leaves
     * its neighbour behind would still "slam" it, and Rubble (a wall slam with a body 1.0 u from the impact, K-M18) could not be built, since that body is always inside the capsule.
     * false: the literal test. K-M23's bot reports both: the slam line (0.3) is met on one and not on the other.
     */
    bodyAhead: true,
  },
} as const satisfies Record<CoreId, { K: number; cap: number; lifeS: number } & Record<string, unknown>>

export type KeystoneId = 'ram-domino' | 'ram-catch' | 'wake-burst' | 'wake-deep'
export interface KeystoneDef { id: KeystoneId; core: CoreId; for: 'packs' | 'bosses' }
export const KEYSTONES = {
  /**
   * Packs. A body shoved into another shoves that one `shove` u on; if it ends on a wall or a body it is slammed too. At most `links`.
   * **new** (3-balancer.md; built in B3): each body a Domino link slams (the body it shoves on if it slams, and the one it slams) takes the core's hit, `hit` (BUILD.md: none). +6% deep / -1% boss.
   */
  'ram-domino': { id: 'ram-domino', core: 'ram', for: 'packs', links: 2, shove: 1.0, hit: 8 },
  /**
   * Bosses. **Changed** (3-balancer.md; built in B3): the shove fires, at most once an `icdS`, the moment a body that CAN'T BE MOVED (the immovable test) starts a tell,
   * not any tell in reach (BUILD.md's was a pack keystone that beat Domino). The caught body is slammed ('still') and the core spends its marks at +K each.
   */
  'ram-catch': { id: 'ram-catch', core: 'ram', for: 'bosses', icdS: 1.0 },
  /** Packs. A skim that fills a body to its cap spends every mark at once: round(share x n x K), a core hit. Ship `share` 1.0 (BUILD.md: 0.6, ~ +0). */
  'wake-burst': { id: 'wake-burst', core: 'wake', for: 'packs', share: 1.0 },
  /** Bosses. Marks hold more and last longer: cap 5, life 4 s (the ring fills in fifths). */
  'wake-deep': { id: 'wake-deep', core: 'wake', for: 'bosses', cap: 5, lifeS: 4 },
} as const satisfies Record<KeystoneId, KeystoneDef & Record<string, unknown>>

export type UpgradeId = 'ram-wide' | 'ram-rubble' | 'wake-spray' | 'wake-slip'
/** From melting past III, at most 2 a run (one of each). Each must change what he sees on the floor, not only a number. */
export const UPGRADES = {
  /** The shove takes the nearest `bodies` in reach each beat, not one: two bodies move. */
  'ram-wide': { id: 'ram-wide', core: 'ram', bodies: 2 },
  /** A wall slam throws rubble: every other awake body within `radius` of the impact takes `damage` and `marks` mark. A dust burst at the wall. */
  'ram-rubble': { id: 'ram-rubble', core: 'ram', radius: 1.2, damage: 4, marks: 1 },
  /** A skim sprays on: the nearest other body within `reach` of the skimmed one, further from Still, is marked too. A cold spray between them. */
  'wake-spray': { id: 'wake-spray', core: 'wake', reach: 1.5, marks: 1 },
  /** Each skim adds `perSkimS` of walk speed x `mul`, up to `maxS` banked. A cold streak at his heels while it runs. */
  'wake-slip': { id: 'wake-slip', core: 'wake', perSkimS: 0.25, maxS: 1, mul: 1.15 },
} as const satisfies Record<UpgradeId, { id: UpgradeId; core: CoreId } & Record<string, unknown>>

/**
 * **new** (3-balancer.md): the depth an upgrade is first offered at a melt past III. Without it both upgrades are taken by d4 in 100% of runs (melts come ~16 a run,
 * a part reaches III by d3); with it, both at d7. B5 builds it.
 */
export const UPGRADE_FROM = 7
/** At most this many upgrades a run (each core has exactly this many, so "all learned" ends the offer). */
export const UPGRADE_MAX = 2

/** The hunt (§2.9). `sources`: the drops the filter may replace. A keystone's weight against 1 for each part, in a filtered draw. Ship `share` 0.5 (BUILD.md: 0.45). */
export const FILTER = { share: 0.5, keyWeight: 1, sources: ['elite', 'plenty', 'boss-blue'] as const }

/**
 * The reshapes' ship numbers (3-balancer.md §1), RECORDED here for B2 (Wake) and B3 (Ram) to build `VARIANTS` from (B1 reshaped nothing). Fields not listed keep the base part's or BUILD.md §2.1's (range, radius, travel, shove, the `behind` and `rime` mods). `k` is the
 * part's own per-mark damage, which lives on its `fits` (abilities.ts), not here.
 */
export const RESHAPES = {
  /** `frayed-cleaver` under Wake: an arc, no fray. BUILD.md: damage 16, cone 120, cooldown 2600. Its `fits.wake.k` is 10. */
  backhand: { base: 'frayed-cleaver', core: 'wake', damage: 18, cone: 150, cooldownMs: 2400 },
  /** `frost-trail` under Wake: a plain run-over dash. BUILD.md: damage 10, cooldown 7000. */
  skate: { base: 'frost-trail', core: 'wake', damage: 12, cooldownMs: 5500 },
  /** `signal-flare` under Wake: lobs, rimes (2 marks, x0.5 slow for 2 s). BUILD.md: damage 10. Cooldown 5000 kept. */
  frostFlare: { base: 'signal-flare', core: 'wake', damage: 14, cooldownMs: 5000 },
  /** **new**, a numbers-only VARIANT (name, line and icon unchanged): `piston` under Ram. BUILD.md: cooldown 3000. Its `fits.ram.k` is 12. */
  pistonRam: { base: 'piston', core: 'ram', cooldownMs: 2600 },
} as const

/** The look (§2.10). `minR` / `perRadius` are 0.6 / 1.75 (BUILD.md: 0.45 / 1.2): at 1.2 x the body's radius the ring sat under its feet and a third of it read, at B2's screenshots. */
export const RING = { minR: 0.6, perRadius: 1.75, gapDeg: 10, maxBodies: 48, drainS: 0.12, fadeS: 0.5 }
/** The button (§2.9). The count is refreshed at most every `refreshS` of game time, shown up to `showMax`, pulses at `pulseAt`. */
export const SPEND_HUD = { refreshS: 0.1, showMax: 9, pulseAt: 3 }

/** PLACEHOLDER, every one: Adrian's words. */
export const WORDS = {
  switch: 'builds',
  core: { wake: 'Wake', ram: 'Ram' },
  /** The pick card: the left thumb, then what it leaves on bodies (the translator's lines). */
  thumb: { wake: 'Pass beside them.', ram: 'Put them against something.' },
  leaves: { wake: 'What you pass beside is rimed.', ram: 'What hits a wall or a body is slammed.' },
  mark: { wake: 'rimed', ram: 'slammed' },
  pickTitle: 'Choose a core', pickIntro: 'One way to fight, for the whole run.',
  keystone: { 'ram-domino': ['Domino', 'A slammed body slams what it hits.'], 'ram-catch': ['Catch', 'The shove fires the moment something in reach winds up.'],
    'wake-burst': ['Burst', 'The third ring breaks the body open on its own.'], 'wake-deep': ['Deep Frost', 'Rings hold five and last longer.'] } as Record<KeystoneId, readonly [string, string]>,
  upgrade: { 'ram-wide': ['Wide Shove', 'Shoves the two nearest.'], 'ram-rubble': ['Rubble', 'A wall slam throws stone at whoever is near.'],
    'wake-spray': ['Spray', 'Rime carries to the one behind.'], 'wake-slip': ['Slipstream', 'Every pass speeds you up a little.'] } as Record<UpgradeId, readonly [string, string]>,
  /** Shapers' and guards' fit lines; a spender's is built: `spends ${mark}: +${k} each`, with `k = fit.k ?? CORES[core].K` (B5). */
  fitLine: { 'backdraft-vent': 'pulls them together, so a shove slams two', kickstart: 'runs them into walls', brace: 'holds your ground',
    'signal-flare': 'rimes what will not come to you', 'spring-heels': 'over a wall, they string out after you', ward: 'covers the pass' },
  /** The reshaped parts' names and lines, as worn under Wake (VARIANTS below); Ram's Piston is a numbers-only variant and keeps its own (B3). */
  reshape: { backhand: ['Backhand', 'A swing behind you, at what you just passed.'], skate: ['Skate', 'A slow glide through them.'], frostFlare: ['Frost Flare', 'Rimes what it lands on, and slows it.'] },
  readout: (made: number, spent: number) => `marked ${made} · spent ${spent}`,
  spendCaption: 'tap · spend them',
  /** B5, the hunt. The socket card: its title, the labels, what the floor keystone is called, the tags, "you lose", take and leave. */
  socketTitle: (core: string) => `${core} · socket`,
  socketLabel: 'socket', socketEmpty: 'empty', socketFloor: 'on the floor',
  forTag: { packs: 'for packs', bosses: 'for bosses' },
  youLose: (name: string) => `you lose: ${name}`,
  takeKey: 'take it', leaveKey: 'leave it',
  /** The upgrade at a melt past III: the melt button's label, the card's title and intro. */
  meltUpgrade: (core: string) => `melt: ${core} upgrade`,
  upgradeTitle: (core: string) => `${core} · upgrade`,
  upgradeIntro: (part: string, core: string) => `${part} is at its best. What it knows goes to ${core}.`,
  /** The pause screen's core block: the labels beside the socket and the upgrades, and "none yet". */
  upgradesLabel: 'upgrades', none: 'none yet',
  /** The fit lines: a spender's is `fits ${core} · spends ${mark}: +${k} each`; a shaper's or guard's is `fits ${core} · ${fitLine}`. */
  fits: (core: string, line: string) => `fits ${core} · ${line}`,
  /** A fitting part with no line of its own (none ship without one). */
  fitsPlain: (core: string) => `fits ${core}`,
  spends: (mark: string, k: number) => `spends ${mark}: +${k} each`,
}

/**
 * The reshapes (§2.1), applied only while that core is worn, by part id: the fields a part changes. The id, slot, tier, drops, key and `fits`
 * stay the base part's (and so does `beat`, the pose and the sound it wears). A field set to `undefined` is taken off the part. Wake's three are built from
 * RESHAPES (the ship numbers); Ram's Piston variant (B3) is numbers only. The `fits.k` of Backhand (10) lives on its base part (abilities.ts).
 */
type Over = Partial<Omit<AbilityDef, 'id' | 'slot' | 'tier' | 'drops' | 'key' | 'fits'>>
/** Frayed Cleaver's 90-degree icon, mirrored: the swing goes the other way. */
const MIRROR_ICON = (inner: string) => `<g transform="translate(24 0) scale(-1 1)">${inner}</g>`
const VARIANTS: Record<CoreId, Record<string, Over>> = {
  wake: {
    /** An arc at what is behind him (`behind`), no fray. cone / damage / cooldown: RESHAPES.backhand. Range 3.1 kept. */
    'frayed-cleaver': {
      name: WORDS.reshape.backhand[0], line: WORDS.reshape.backhand[1], mod: { kind: 'behind' }, iconStates: undefined,
      damage: RESHAPES.backhand.damage, cone: RESHAPES.backhand.cone, cooldownMs: RESHAPES.backhand.cooldownMs, range: 3.1,
      icon: MIRROR_ICON('<path d="M6.3 9.3A8 8 0 0 1 17.7 9.3"/><path d="M6.3 9.3 4.6 7.6M17.7 9.3l1.7-1.7"/><circle cx="12" cy="15" r="1.2"/>'),
    },
    /** A plain run-over dash: no strip, no chill. BUILD.md §2.1: radius 1.0, range 5.6, travel 420, shove 0.6. */
    'frost-trail': {
      name: WORDS.reshape.skate[0], line: WORDS.reshape.skate[1], mod: undefined, sets: undefined,
      damage: RESHAPES.skate.damage, cooldownMs: RESHAPES.skate.cooldownMs, radius: 1.0, range: 5.6, travelMs: 420, shove: 0.6,
    },
    /** A lob that rimes (2 marks) and slows (x0.5, 2 s) every body in the blast; never sets the `marked` state. BUILD.md §2.1: range 11, radius 2.2, travel 800. */
    'signal-flare': {
      name: WORDS.reshape.frostFlare[0], line: WORDS.reshape.frostFlare[1], mod: { kind: 'rime', marks: 2, slowMul: 0.5, slowMs: 2000 }, sets: undefined,
      damage: RESHAPES.frostFlare.damage, cooldownMs: RESHAPES.frostFlare.cooldownMs, range: 11, radius: 2.2, travelMs: 800,
    },
  },
  /** Piston under Ram: a numbers-only variant (name, line and icon unchanged), cooldown 2600 (RESHAPES.pistonRam); its `fits.ram.k` is 12 (abilities.ts). 3-balancer.md §1. */
  ram: { piston: { cooldownMs: RESHAPES.pistonRam.cooldownMs } },
}

const memo: Record<CoreId, WeakMap<AbilityDef, AbilityDef>> = { wake: new WeakMap(), ram: new WeakMap() }

/** `def` as worn under `core`: the reshaped part (VARIANTS) or `def` itself. Pure, memoized per (core, def object), idempotent. */
export function variant(def: AbilityDef, core: CoreId | null): AbilityDef {
  if (!core) return def
  const hit = memo[core].get(def)
  if (hit) return hit
  const over = VARIANTS[core][def.id]
  let out = def
  if (over) {
    const w: Record<string, unknown> = { ...def, ...over }
    for (const [k, v] of Object.entries(over)) if (v === undefined) delete w[k]
    out = w as unknown as AbilityDef
  }
  memo[core].set(def, out)
  memo[core].set(out, out)
  return out
}

/** The marks this core's every body can hold, with the socketed keystone. */
export function markCap(core: CoreId, key: KeystoneId | null): number {
  return core === 'wake' && key === 'wake-deep' ? KEYSTONES['wake-deep'].cap : CORES[core].cap
}
/** How long a mark lasts (s), with the socketed keystone. */
export function markLife(core: CoreId, key: KeystoneId | null): number {
  return core === 'wake' && key === 'wake-deep' ? KEYSTONES['wake-deep'].lifeS : CORES[core].lifeS
}

/** A part's fit for a core, or null (plain). */
export const fitOf = (def: Pick<AbilityDef, 'fits'>, core: CoreId | null): Fit | null => (core && def.fits?.[core]) || null
