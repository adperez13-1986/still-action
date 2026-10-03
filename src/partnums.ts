/**
 * Every part's real numbers, one plain row per rank (design/archetypes/NUMS.md). Edit them here, by hand: this is what the game reads for a worn part
 * with weight on and no core (weight.ts `fromTable`). A row is the part's numbers at that rank, damage in hits, cooldownMs in ms, radius / cone / shove / reach in
 * u and degrees; `mod` holds the numbers inside the part's mod (a charge's minDamage and clock, Overrun's damage and width, the Frayed cones, a slam, a reflection, a wall hit).
 * `evolved` is the rank III row once the part has evolved. A field a row leaves out is the part's own in abilities.ts.
 * First written by tools/gen-partnums.ts from the old multipliers (weight preset B, temper I / II / III, evolutions); never rerun it over hand edits.
 * A core's reshape, the Marksman's Footwork, the WEIGHT=0 game and a preset other than B still use the old path (weight.ts, temper.ts).
 * Words and numbers are PLACEHOLDER.
 */
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
  'focusing-lens': {
    I: { damage: 31, cooldownMs: 4200 },
    II: { damage: 41, cooldownMs: 3570 },
    III: { damage: 50, cooldownMs: 3024 },
    evolved: { damage: 80, cooldownMs: 3024 },
  },
  'flare': {
    I: { damage: 22, cooldownMs: 4200, radius: 2 },
    II: { damage: 28, cooldownMs: 3570, radius: 2.3 },
    III: { damage: 35, cooldownMs: 3024, radius: 2.6 },
  },
  'cracked-lens': {
    I: { damage: 24, cooldownMs: 4600 },
    II: { damage: 31, cooldownMs: 3910 },
    III: { damage: 38, cooldownMs: 3312 },
  },
  'ricochet-lens': {
    I: { damage: 22, cooldownMs: 4600 },
    II: { damage: 28, cooldownMs: 3910 },
    III: { damage: 35, cooldownMs: 3312 },
  },
  'patient-lens': {
    I: { damage: 38, cooldownMs: 1500, mod: { minDamage: 7, minS: 1.5, fullS: 7.5 } },
    II: { damage: 50, cooldownMs: 1275, mod: { minDamage: 7, minS: 1.27, fullS: 6.38 } },
    III: { damage: 61, cooldownMs: 1080, mod: { minDamage: 7, minS: 1.08, fullS: 5.4 } },
  },
  'signal-flare': {
    I: { damage: 14, cooldownMs: 5000, radius: 2.2 },
    II: { damage: 19, cooldownMs: 4250, radius: 2.53 },
    III: { damage: 23, cooldownMs: 3600, radius: 2.86 },
  },
  'through-line': {
    I: { damage: 29, cooldownMs: 6000 },
    II: { damage: 37, cooldownMs: 5100 },
    III: { damage: 46, cooldownMs: 4320 },
  },
  'overclocked-coil': {
    I: { damage: 17, cooldownMs: 1200 },
    II: { damage: 22, cooldownMs: 1020 },
    III: { damage: 26, cooldownMs: 864 },
  },
  'pressure-vent': {
    I: { damage: 27, cooldownMs: 6500, radius: 6.02 },
    II: { damage: 36, cooldownMs: 5525, radius: 6.92 },
    III: { damage: 43, cooldownMs: 4680, radius: 7.83 },
  },
  'ward': {
    I: { damage: 0, cooldownMs: 7000, radius: 1.8, windowMs: 1400 },
    II: { damage: 0, cooldownMs: 5950, radius: 2.07, windowMs: 1610 },
    III: { damage: 0, cooldownMs: 5040, radius: 2.34, windowMs: 1820 },
  },
  'backdraft-vent': {
    I: { damage: 22, cooldownMs: 6500, radius: 7.28 },
    II: { damage: 29, cooldownMs: 5525, radius: 8.37 },
    III: { damage: 34, cooldownMs: 4680, radius: 9.46 },
  },
  'chill-vent': {
    I: { damage: 18, cooldownMs: 6500, radius: 6.02 },
    II: { damage: 23, cooldownMs: 5525, radius: 6.92 },
    III: { damage: 29, cooldownMs: 4680, radius: 7.83 },
  },
  'brace': {
    I: { damage: 14, cooldownMs: 9000, radius: 2.6, windowMs: 800 },
    II: { damage: 18, cooldownMs: 7650, radius: 2.99, windowMs: 920 },
    III: { damage: 23, cooldownMs: 6480, radius: 3.38, windowMs: 1040 },
  },
  'mirror-ward': {
    I: { damage: 0, cooldownMs: 7000, radius: 1.8, windowMs: 800, mod: { damage: 14 } },
    II: { damage: 0, cooldownMs: 5950, radius: 2.07, windowMs: 920, mod: { damage: 18 } },
    III: { damage: 0, cooldownMs: 5040, radius: 2.34, windowMs: 1040, mod: { damage: 23 } },
  },
  'lure': {
    I: { damage: 32, cooldownMs: 12000, radius: 3 },
    II: { damage: 41, cooldownMs: 10200, radius: 3.45 },
    III: { damage: 52, cooldownMs: 8640, radius: 3.9 },
  },
  'scrap-cleaver': {
    I: { damage: 22, cooldownMs: 2600, cone: 180, shove: 1.2 },
    II: { damage: 28, cooldownMs: 2210, cone: 207, shove: 1.2 },
    III: { damage: 35, cooldownMs: 1872, cone: 234, shove: 1.2 },
    evolved: { damage: 49, cooldownMs: 1872, cone: 360, shove: 1.2 },
  },
  'piston': {
    I: { damage: 24, cooldownMs: 3000, cone: 40 },
    II: { damage: 31, cooldownMs: 2550, cone: 46 },
    III: { damage: 38, cooldownMs: 2160, cone: 52 },
  },
  'rusted-hook': {
    I: { damage: 14, cooldownMs: 3200, cone: 70 },
    II: { damage: 19, cooldownMs: 2720, cone: 81 },
    III: { damage: 23, cooldownMs: 2304, cone: 91 },
  },
  'parry-clamp': {
    I: { damage: 12, cooldownMs: 3600, cone: 90 },
    II: { damage: 16, cooldownMs: 3060, cone: 103 },
    III: { damage: 19, cooldownMs: 2592, cone: 117 },
  },
  'frayed-cleaver': {
    I: { damage: 19, cooldownMs: 2600, cone: 90, mod: { cones: [90, 180, 360] } },
    II: { damage: 25, cooldownMs: 2210, cone: 103, mod: { cones: [103, 207, 360] } },
    III: { damage: 31, cooldownMs: 1872, cone: 117, mod: { cones: [117, 234, 360] } },
  },
  'clamp-toss': {
    I: { damage: 17, cooldownMs: 4500, blastDamage: 17, mod: { wallDamage: 14 } },
    II: { damage: 22, cooldownMs: 3825, blastDamage: 22, mod: { wallDamage: 19 } },
    III: { damage: 26, cooldownMs: 3240, blastDamage: 26, mod: { wallDamage: 23 } },
  },
  'anvil': {
    I: { damage: 36, cooldownMs: 6000, windowMs: 900 },
    II: { damage: 47, cooldownMs: 5100, windowMs: 1035 },
    III: { damage: 58, cooldownMs: 4320, windowMs: 1170 },
  },
  'kickstart': {
    I: { damage: 22, cooldownMs: 8000, radius: 2.4 },
    II: { damage: 29, cooldownMs: 6800, radius: 2.4 },
    III: { damage: 34, cooldownMs: 5760, radius: 2.4 },
  },
  'skitter': {
    I: { damage: 0, cooldownMs: 3200 },
    II: { damage: 0, cooldownMs: 2720 },
    III: { damage: 0, cooldownMs: 2304 },
  },
  'skid-plates': {
    I: { damage: 14, cooldownMs: 8000, radius: 2.4, mod: { damage: 18, radius: 2.8 } },
    II: { damage: 18, cooldownMs: 6800, radius: 2.4, mod: { damage: 23, radius: 3.22 } },
    III: { damage: 23, cooldownMs: 5760, radius: 2.4, mod: { damage: 29, radius: 3.64 } },
  },
  'overrun': {
    I: { damage: 0, cooldownMs: 7000, mod: { damage: 40, radius: 2.8 } },
    II: { damage: 0, cooldownMs: 5950, mod: { damage: 52, radius: 3.22 } },
    III: { damage: 0, cooldownMs: 5040, mod: { damage: 63, radius: 3.64 } },
  },
  'frost-trail': {
    I: { damage: 0, cooldownMs: 8000, mod: { width: 1.4 } },
    II: { damage: 0, cooldownMs: 6800, mod: { width: 1.61 } },
    III: { damage: 0, cooldownMs: 5760, mod: { width: 1.82 } },
  },
  'spring-heels': {
    I: { damage: 0, cooldownMs: 4000 },
    II: { damage: 0, cooldownMs: 3400 },
    III: { damage: 0, cooldownMs: 2880 },
  },
  'plumb-line': {
    I: { damage: 25, cooldownMs: 9000 },
    II: { damage: 32, cooldownMs: 7650 },
    III: { damage: 40, cooldownMs: 6480 },
  },
  'borrowed-time': {
    I: { damage: 0, cooldownMs: 10000 },
    II: { damage: 0, cooldownMs: 8500 },
    III: { damage: 0, cooldownMs: 7200 },
  },
  'turret': {
    I: { damage: 5, cooldownMs: 7000 },
    II: { damage: 6, cooldownMs: 5950 },
    III: { damage: 7, cooldownMs: 5040 },
  },
}
