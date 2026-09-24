# Context for design agents

You are designing for **Still**, a mobile-first action roguelite in three.js
(`/Users/adrianperez/repos/personal/still-action`). Read `DESIGN.md` and
`HANDOVER.md` in the repo root first — they hold settled decisions. Do not
re-open them.

## The game in one paragraph

Still is a small incomplete robot (the "Lantern": open cage torso with a cold
core, lens on a stalk, bird legs, clamp-and-hook arm) crawling generated
Diablo-2-style dungeon levels on a phone, landscape, fixed 38° isometric
orthographic camera. Left thumb: virtual stick. Right thumb: four ability
buttons, one per body slot (Head, Torso, Arms, Legs). An auto attack fires at
the nearest enemy in range so there is never dead time. Each equipped **part is
exactly one ability** with a cooldown. Loot rewires your buttons. Holding a
*cooling* button **pushes** it: it fires now at full power for +2 strain.
Strain persists across the run, −2 per fight cleared ("quiet"), −6 at a Rest
shrine, and at 20 the run ends (Still slows and stops). HP is the fight; strain
is the run.

## Hard constraints (the owner set these; they are not negotiable)

- **One part = one ability. No stat blocks, no affixes, no +X% anything.**
- **Tiers mean different, never stronger.** White = the plain ability. Blue =
  one twist on it. Gold = a named oddity that changes how you play. A gold part
  must not be strictly better than its white.
- **Runs get wider, not stronger.** Premium, buy-once design. No grind, no
  power-creep, no meta stat upgrades.
- **Rules are symmetric.** Waist-high walls block projectiles both ways; cover
  works against everything; if Still can do it to enemies, the rule should hold
  the other way where it applies.
- **Every threat is telegraphed and committed** (enemies: approach → windup →
  strike → recover). Phone readability first: a 6-inch screen, thumbs covering
  corners, many things on screen.
- **Colour language:** Still's effects cold steel-blue/white (`COLD`
  0x8fb8e8-ish, `COLD_DEEP`); enemies' effects ember orange/red. Grace (Still's
  wife-figure) is the one warm light in the game — gold loot is kept thin and
  rare because it's warm. The owner dislikes flat red/white effects: effects
  should be textured, particles + animated shader telegraphs.
- **Do not design parts for Yanah or Yuri** (the owner's children; two rare
  protective parts that are his to write). Leave them out entirely.
- **Rejected:** melee magnetism (auto-lunge toward the enemy on a swing). Do not
  propose it.

## Current code facts (read `src/abilities.ts`, `src/combat.ts`, `src/loot.ts`)

Shapes today: `bolt` (Head: projectile at nearest enemy, speed 26),
`nova` (Torso: blast around Still), `arc` (Arms: melee sweep that snaps to the
nearest target in reach), `dash` (Legs: move along the stick, run over things,
280 ms). Mods today: `pierce`, `fan`, `pull`, `hook`, `slam`.

White parts:

| part | slot | cd | dmg | range | radius |
|---|---|---|---|---|---|
| Focusing Lens (bolt) | head | 4.2s | 26 | 13 | 0.85 |
| Pressure Vent (nova, shoves out) | torso | 6.5s | 15 | – | 4.3 |
| Scrap Cleaver (arc, 120°) | arms | 2.6s | 18 | 3.1 | 1.5 |
| Kickstart (dash) | legs | 8s | 12 | 6.4 | 1.2 |

Auto attack: 5 dmg every 0.62s, range 7.6, needs a clear line. Still: 100 HP,
speed 5.5, radius 0.42. Hurt cooldown 0.35s.

Enemies:

- **Chaser (hulk)**: 30 HP, speed 4.3, strikes a ring (radius 2.4) at range
  2.0 after a 520 ms windup, 9 dmg, 760 ms recover.
- **Ranged (tripod sentinel)**: 20 HP, speed 3.4, holds 6–10 units, fires from
  ≤12, 760 ms windup (aim line tracks for 60%, then freezes), 8 dmg shot at
  speed 15, 1.5s reload.
- **Elites**: named pack leader, 2x HP, one of Quick (pack speed 1.45x),
  Plated (half damage, 0.3 knockback), Many (splits in two on death), Warden
  (pack takes 0.35x damage while it stands).
- **The Assembler** (boss, every 3rd depth): 900 HP, radius 1.6, sweep,
  shockwave with safe lanes, barrage, charge that stuns itself on a wall, then
  at 55%: summon adds, magnet pull.
- **Coming next** (not built): charger and swarm archetypes.

Levels: 5x5-cell rooms (20 units), 4-unit corridors, waist-high barriers,
~6 packs a level, packs of 2–4+ that sleep until you're within 8 units.
Crates/barrels break to any hit. Loot: 22% per kill, elites always drop.
Knockback is a sliding velocity (`shoveVelocity`), and enemies above 1.5 u/s
slide speed are staggered (can't advance or start a windup).

Enemy interface fields available to parts: `hp`, `armor` (damage multiplier),
`speedMul`, `knockMul`, `knock` (velocity), `phase`, `radius`, `size`.
