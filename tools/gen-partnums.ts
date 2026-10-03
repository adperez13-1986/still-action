/**
 * Writes src/partnums.ts (design/archetypes/NUMS.md): every part's numbers at rank I, II, III (and the evolved row), computed once through the multiplier path
 * the game used to run (weight preset B, temper on, evolutions on): `legacyWorn`. After it is committed, src/partnums.ts is the table he edits by hand and
 * this file is only the record; the game never runs it. tools/checks/nums.mjs imports `legacyWorn` and `buildTable` to prove the table still equals that path.
 *
 *   npx tsx tools/gen-partnums.ts
 */
import { writeFileSync } from 'node:fs'
import { ARCH_PARTS, PARTS, type AbilityDef } from '../src/abilities'
import { evolved, evoOf, type EvoId } from '../src/evolutions'
import { tempered } from '../src/temper'
import { weighMultipliers } from '../src/weight'

/** The part as the old game wore it with no core and weight on: weigh(evolved(tempered(def, 3)) or tempered(def, rank)). */
export function legacyWorn(base: AbilityDef, rank: number, evo: EvoId | null = null): AbilityDef {
  return weighMultipliers(evo ? evolved(tempered(base, 3), evo) : tempered(base, rank))
}

const TOP = ['radius', 'cone', 'shove', 'windowMs', 'blastDamage'] as const
type Row = Record<string, unknown>

const ALL = [...PARTS, ...ARCH_PARTS]

/** The fields a part's ranks, weight or evolution touch. */
function fieldsOf(base: AbilityDef) {
  const top = new Set<string>(['damage', 'cooldownMs'])
  const mod = new Set<string>()
  const variants = [legacyWorn(base, 1), legacyWorn(base, 2), legacyWorn(base, 3), ...(evoOf(base.id) ? [legacyWorn(base, 3, evoOf(base.id))] : [])]
  for (const v of variants) {
    for (const k of TOP) if (v[k] !== base[k]) top.add(k)
    if (v.mod && base.mod && v.mod.kind === base.mod.kind) {
      for (const [k, x] of Object.entries(v.mod)) if (k !== 'kind' && JSON.stringify(x) !== JSON.stringify((base.mod as unknown as Row)[k])) mod.add(k)
    }
  }
  return { top, mod }
}

function rowOf(v: AbilityDef, base: AbilityDef, f: ReturnType<typeof fieldsOf>): Row {
  const r: Row = {}
  for (const k of ['damage', 'cooldownMs', ...TOP]) if (f.top.has(k)) r[k] = (v as unknown as Row)[k]
  if (f.mod.size && v.mod && base.mod && v.mod.kind === base.mod.kind) {
    const m: Row = {}
    for (const k of f.mod) m[k] = (v.mod as unknown as Row)[k]
    r.mod = m
  }
  return r
}

export function buildTable(): Record<string, Record<string, Row>> {
  const out: Record<string, Record<string, Row>> = {}
  for (const base of ALL) {
    const f = fieldsOf(base)
    const e = evoOf(base.id)
    out[base.id] = {
      I: rowOf(legacyWorn(base, 1), base, f),
      II: rowOf(legacyWorn(base, 2), base, f),
      III: rowOf(legacyWorn(base, 3), base, f),
      ...(e ? { evolved: rowOf(legacyWorn(base, 3, e), base, f) } : {}),
    }
  }
  return out
}

const lit = (x: unknown): string =>
  Array.isArray(x) ? `[${x.join(', ')}]` : x && typeof x === 'object' ? `{ ${Object.entries(x).map(([k, v]) => `${k}: ${lit(v)}`).join(', ')} }` : String(x)

if (process.argv[1]?.endsWith('gen-partnums.ts')) {
  const t = buildTable()
  const body = Object.entries(t)
    .map(([id, rows]) => `  '${id}': {\n${Object.entries(rows).map(([k, r]) => `    ${k}: ${lit(r)},`).join('\n')}\n  },`)
    .join('\n')
  const head = `/**
 * Every part's real numbers, one plain row per rank (design/archetypes/NUMS.md). Edit them here, by hand: this is what the game reads for a worn part
 * with weight on and no core (weight.ts \`fromTable\`). A row is the part's numbers at that rank, damage in hits, cooldownMs in ms, radius / cone / shove / reach in
 * u and degrees; \`mod\` holds the numbers inside the part's mod (a charge's minDamage and clock, Overrun's damage and width, the Frayed cones, a slam, a reflection, a wall hit).
 * \`evolved\` is the rank III row once the part has evolved. A field a row leaves out is the part's own in abilities.ts.
 * First written by tools/gen-partnums.ts from the old multipliers (weight preset B, temper I / II / III, evolutions); never rerun it over hand edits.
 * A core's reshape, the Marksman's Footwork, the WEIGHT=0 game and a preset other than B still use the old path (weight.ts, temper.ts).
 * Words and numbers are PLACEHOLDER.
 */`
  const src = `${head}
export interface PartRow {
  damage: number
  cooldownMs: number
  radius?: number
  cone?: number
  shove?: number
  windowMs?: number
  blastDamage?: number
  mod?: Record<string, number | readonly number[]>
}
export type PartRows = { I: PartRow; II: PartRow; III: PartRow; evolved?: PartRow }

export const PARTNUMS: Record<string, PartRows> = {
${body}
}
`
  writeFileSync(new URL('../src/partnums.ts', import.meta.url), src)
  console.log(`partnums: ${Object.keys(t).length} parts`)
}
