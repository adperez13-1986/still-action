# NUMS: one raw number table for every part

His ask (3 Oct): "I was hoping that those were raw numbers and not multipliers. Multipliers work for enemies... do the raw number
table now." Today a part's real damage is def x weight's slotDmg (by home slot) x temper's rank (1 / 1.3 / 1.6) x an evolution's
dmgMul, with rounding at each step, and the same for cooldown (0.85 / 0.72), area (1.15 / 1.3), vent radius, dash width, the
cleaver's cone and shove, and the numbers inside mods (minDamage, slam damage, overrun damage, reflect damage, wallDamage,
blastDamage). Nobody can see the result.

## What to build

1. **A generator, run once:** `tools/gen-partnums.ts` computes, through the CURRENT code paths (the defaults: weight on with preset
   B, temper on), every part's numbers at rank I, II, III, plus the evolved row for parts with an evolution (Whirlwind, Rail). It
   writes `src/partnums.ts`: a plain literal table, one entry per part id, e.g.
   `'scrap-cleaver': { I: { damage: 19, cooldownMs: 1800, cone: 180, range: 2.6, shove: 1.2 }, II: {...}, III: {...}, evolved: {...} }`,
   with every field that rank, weight or evolution touches, written as numbers (no expressions, no multipliers). Kit-only parts (the
   Turret) included. After it's committed, the table is the source of truth and he edits numbers there by hand; the generator stays
   in tools/ for the record and is never run by the game.
2. **The game reads the table** wherever weight-on + temper produce a worn part's numbers today (find `asWorn` in main.ts, weight.ts
   `slotDmg` / `ventRadius` / `dashWidth` / `cleaverCone` / `cleaverShove`, temper.ts, evolutions.ts `dmgMul`). For the default game
   (weight on), the part multipliers are gone from the path: the def's numbers at a rank come from the table. Enemy multipliers
   (pack / heavy / boss HP) stay exactly as they are.
   - With the weight switch OFF (`WEIGHT=0`, the old game) keep today's path unchanged (def x temper), so those checks keep meaning.
   - Under a core, cores.ts VARIANTS still apply on top as today (they replace fields; read how they compose with weight now and
     keep the result identical).
3. **Cards show the raw numbers:** every part card (floor, take, pause) gets one small line from the table at its current rank:
   `hits 41 · every 1.8 s` (and `+ area 2.6 u` for blasts, or `reach 13 u` for bolts where useful). Words PLACEHOLDER.
4. **A check, `tools/checks/nums.mjs`:** K-NU1 every part id in PARTS (and kit-only parts) has I, II, III rows; K-NU2 for every part
   and rank, the table-driven worn def equals the old multiplier path's def field by field (keep the old path callable in the check
   only, e.g. a `legacyWorn()` in the generator); K-NU3 evolved rows equal the old evolution path; K-NU4 a card shows the table's
   damage and cooldown.

## Rules

- Fights must not change: `node tools/checks/fights.mjs compare` PASS, `WEIGHT=0` the same as before (compare against a HEAD
  capture if fights.mjs pins weight on), `node tools/checks/builds.mjs`, `arch.mjs`, `evo.mjs`, `screens.mjs`, corecheck, tsc and
  vite build all pass. Run the full set once at the end.
- No Math.random. Match the code's style. Don't commit, push or start a dev server. 1 screenshot (`nums-` prefix): a card with the
  new numbers line.
