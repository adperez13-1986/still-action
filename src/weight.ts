import { byId, type AbilityDef, type Mod } from './abilities'
import type { SlotName } from './still'

/**
 * The "weight" trial (design/lean/WEIGHT.md; the word is a PLACEHOLDER, Adrian writes the words): every number of it.
 * No three.js here. Nothing in this file runs unless the pause switch is on, except `preset()` and `baseCooldownS()`
 * being importable.
 */

/**
 * The Ask 1 numbers (design/lean/3-balancer.md). A balancer re-run may change any of these and nothing else.
 * HP multipliers apply on top of the depth curve, never instead of it.
 */
export interface WeightPreset {
  /**
   * Ordinary pack bodies' HP, as ONE rounding of base x curveAt(depth).hp x this (combat.ts addPack's line).
   * `packHpEarly` covers crawl depths < 4 (1-2). `packHpDeep` covers crawl depths >= 4 (4, 5 in 6 depths; 4, 5, 7, 8 in 9).
   * 3-balancer's "x1.65 on the 1.3 bucket" means this times the curve's own hp, not a replacement for it.
   * The sim modelled every d4+ depth at curve 1.3. Live, d4 is 1.1 and d5 / d7 are 1.2 in 9 depths, so those depths
   * are softer than modelled (WEIGHT.md R3). Do not "correct" it here.
   */
  packHpEarly: number
  packHpDeep: number
  /** A crowned leader (the heavy). The sim models no heavies: 1 leaves them as the curve has them. */
  heavyHp: number
  /** A boss: its def's HP after bossFor's curve, x this, one Math.round. maxHp and every phase threshold follow (they read def.hp). */
  bossHp: number
  /**
   * Part damage by slot. It applies to def.damage and to every damage number the part carries:
   *   - mod: minDamage (charge), damage (slam, overrun, reflect), wallDamage (toss);
   *   - blastDamage.
   * Each is Math.round(x * k).
   */
  slotDmg: Record<SlotName, number>
  /** Blast radius of VENTS only (Brace, Ward and Mirror Ward untouched), +(r * k).toFixed(2). */
  ventRadius: number
  /** The run-over half-width of every 'dash' (def.radius) and of Overrun's charge (mod.radius). Skid Plates' slam radius is untouched. */
  dashWidth: number
  /** Scrap Cleaver only: its cone x this (120 at rank I; a tempered cone scales too), Math.round, cap 360. Frayed Cleaver keeps its cones. */
  cleaverCone: number
  /** Scrap Cleaver only: shove in u, radial from Still (shoveFrom). It has none today. */
  cleaverShove: number
}

export const WEIGHT_PRESETS = {
  /** r3 pick B, the default: area 2. */
  B: { packHpEarly: 1.4, packHpDeep: 1.65, heavyHp: 1, bossHp: 1.3,
       slotDmg: { head: 1.2, torso: 1.8, arms: 1.2, legs: 1.8 }, ventRadius: 1.4, dashWidth: 2, cleaverCone: 180 / 120, cleaverShove: 1.2 },
  /** r3 fallback D: area 1, for when area 2 crowds the phone screen. It costs the median 3 points of part share. */
  D: { packHpEarly: 1.4, packHpDeep: 1.65, heavyHp: 1, bossHp: 1.1,
       slotDmg: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 }, ventRadius: 1.25, dashWidth: 1.5, cleaverCone: 160 / 120, cleaverShove: 1.2 },
  // r1 pick (lean rounds 1-2, judged against the old 1-in-3 floor), kept for the record; not selectable:
  // R1: { packHpEarly: 1.25, packHpDeep: 1.25, heavyHp: 1, bossHp: 1.1,
  //       slotDmg: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 }, ventRadius: 1.25, dashWidth: 1.5, cleaverCone: 160 / 120, cleaverShove: 1.2 },
} satisfies Record<string, WeightPreset>
export type PresetId = keyof typeof WEIGHT_PRESETS
/** The shipped preset. DEV `__weightPreset` flips it for checks and screenshots; nothing persists it. */
export const WEIGHT_PRESET: PresetId = 'B'

export const VENTS: readonly string[] = ['pressure-vent', 'backdraft-vent', 'chill-vent']
/** Documentation and checks: these keep their push-only extras (combat reads ctx.pushed there, WEIGHT.md §2.4). */
export const PUSH_ONLY: readonly string[] = ['patient-lens', 'overrun', 'lure', 'plumb-line']

/** The feel. The same in every preset. */
export const WEIGHT_FEEL = {
  /** contact ms = min(capMs, round(baseMs + perCdS x base cooldown s + perBodyMs x (bodies - 1))). */
  freeze: { baseMs: 30, perCdS: 6, perBodyMs: 10, capMs: 100, mergeS: 0.2 },
  killMs: { part: 90, auto: 35 },
  breakMs: { part: 90, auto: 35 },
  /** An auto kill's shake: this x today's kill shake. */
  autoKillShake: 0.5,
  /** [first body, per extra body, cap]. */
  contactShake: [0.12, 0.04, 0.34], contactPunch: [0.02, 0.01, 0.06], contactHapticMs: [12, 6, 30],
  /** The Anvil catch's pattern (main.ts). */
  breakHaptic: [20, 30, 40],
  /** still.ts: the pose's start, as a fraction of its dur, by Pose. Absent: 0 (today). */
  cocked: { arc: 0.3, spin: 0.3, piston: 0.3, nova: 0.25, through: 0.29, hook: 0.45 } as Partial<Record<string, number>>,
  /** The torso's duck under its whump: -4 dB for 0.25 s, then back. */
  duck: { gain: 0.63, s: 0.25 },
  /** The head's flinch on its first body: up to 0.17 rad (~10 deg) back from Still, eased out over 0.12 s. */
  flinch: { rad: 0.17, s: 0.12 },
  /** The head's gather at the lens on the press (not Through-Line: it has its own). */
  gather: { count: 6, radius: 0.4 },
}

/** The untempered cooldown, s: the part's own rank-I def from PARTS, so tempering never makes a part feel lighter. A null payer (the hand, the eye) has none: 0. */
export function baseCooldownS(def: Pick<AbilityDef, 'id'> | null): number {
  if (!def) return 0
  const own = byId(def.id)
  return own ? own.cooldownMs / 1000 : 0
}

let active: PresetId = WEIGHT_PRESET

/** The active preset (WEIGHT_PRESET unless DEV changed it). */
export function preset(): WeightPreset {
  return WEIGHT_PRESETS[active]
}
export function setPreset(id: PresetId): void {
  if (id in WEIGHT_PRESETS) active = id
}
export function presetId(): PresetId {
  return active
}

const n = (x: number, k: number) => Math.round(x * k)
const u = (x: number, k: number) => +(x * k).toFixed(2)

/** A mod's numbers under the preset: damage by slot, Overrun's charge width. Nothing else of a mod moves. */
function weighMod(mod: Mod | undefined, P: WeightPreset, dmg: number): Mod | undefined {
  if (!mod) return mod
  switch (mod.kind) {
    case 'charge': return { ...mod, minDamage: n(mod.minDamage, dmg) }
    case 'reflect': return { ...mod, damage: n(mod.damage, dmg) }
    case 'toss': return { ...mod, wallDamage: n(mod.wallDamage, dmg) }
    case 'slam': return { ...mod, damage: n(mod.damage, dmg) }
    case 'overrun': return { ...mod, damage: n(mod.damage, dmg), radius: u(mod.radius, P.dashWidth) }
    default: return mod
  }
}

/** Every def this module has made: weighed(weighed(d)) is weighed(d). */
const outputs = new WeakSet<AbilityDef>()
/** Per preset, the memo: input def object -> its weighed twin. */
const memo = new Map<PresetId, WeakMap<AbilityDef, AbilityDef>>()

/**
 * `def` with the active preset's Ask 1 numbers. It is pure, memoized per (preset, def object), and idempotent.
 * An output passed back returns itself (a WeakSet of outputs), so weighed(weighed(d)) === weighed(d).
 * Never touches cooldownMs, range, windowMs, strain, sets/pays.
 */
export function weighed(def: AbilityDef): AbilityDef {
  if (outputs.has(def)) return def
  let byDef = memo.get(active)
  if (!byDef) memo.set(active, (byDef = new WeakMap()))
  const hit = byDef.get(def)
  if (hit) return hit
  const P = WEIGHT_PRESETS[active]
  const dmg = P.slotDmg[def.slot]
  const out: AbilityDef = { ...def, damage: n(def.damage, dmg), mod: weighMod(def.mod, P, dmg) }
  if (!def.mod) delete out.mod
  if (def.blastDamage !== undefined) out.blastDamage = n(def.blastDamage, dmg)
  if (VENTS.includes(def.id)) out.radius = u(def.radius, P.ventRadius)
  if (def.shape === 'dash') out.radius = u(def.radius, P.dashWidth)
  if (def.id === 'scrap-cleaver') {
    if (def.cone !== undefined) out.cone = Math.min(360, n(def.cone, P.cleaverCone))
    out.shove = P.cleaverShove
  }
  outputs.add(out)
  byDef.set(def, out)
  return out
}
