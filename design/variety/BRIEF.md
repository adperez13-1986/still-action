# Brief: enemy variety, and playstyles beyond kiting

For the design agents. **A pitch round, not a spec.** Two topics the owner raised on
26 Sep, pitched together because each shapes the other.

## The owner's words
- *"I haven't seen the thief.. and honestly, I don't feel much variety in the enemies..
  how did D2 handle this?"*
- *"There is only one playstyle, kiting.. I think any action game is supposed to have 2-3
  main archetypes, right? melee, range, magic, then there are summoners and button mashers
  (assassin of D2).. I wonder if we can have those archetypes as well considering the
  targeting that we chose."*

## Read first
In `/Users/adrianperez/repos/personal/still-action`: `HANDOVER.md`, `DESIGN.md`,
`design/CATALOG.md` (the 30 parts, the ram, the mites, elites), `design/meta/DESIGN.md`,
`design/content/DESIGN.md`, `design/strain/PITCHES.md`, `design/premium/SUMMARY.md` and
`1-balancer.md` there. Code: `src/abilities.ts` (parts as data), `src/combat.ts`
(targeting: `nearestTarget`, `pickTarget`, the push aim), `src/dungeon.ts` (pack tables by
depth, `ELITE_MODS`, the body-equivalent budget), `src/enemy.ts`, `src/ranged.ts`,
`src/charger.ts`, `src/swarm.ts`, `src/lobber.ts`, `src/thief.ts`, `src/hide.ts`. The old
deckbuilder's 43 enemies: `/Users/adrianperez/repos/personal/still/src/data/enemies.ts`
(port as data only: names, flavour).

## Facts that matter
- **Enemies today:** a fixed cast per depth (d1 hulk + sentinel; d2 + ram; d4 + mites;
  d5 + Lobber), 4 elite mods (Quick, Plated, Many, Warden), one each. The thief appears
  only at depth 2, in ~1/3 of levels, and only acts if a part lies on the floor untaken,
  so the owner has never met it.
- **Targeting:** every cast auto-aims at the nearest enemy in reach (a pushed cast aims at
  the wind-up landing soonest); the stick moves Still; dashes follow the stick. An auto
  attack (5 damage, ~7.6 u) fires on its own. **Melee magnetism (auto-lunging toward the
  enemy) was rejected by the owner; don't pitch it.**
- **Slots are role-locked:** head = ranged (bolts, lobs), torso = around-you (novas, wards,
  decoy, brace), arms = melee (arcs, grab, catch), legs = movement (dashes, hops, anchor,
  rewind). Every loadout is one of each, plus a ranged auto. Enemy strikes are telegraphed
  and committed, and stepping away always answers them. So kiting is the dominant answer,
  whatever you wear.
- The push (hold a cooling button, +2 strain) now matters: ~1 push a fight in the latest
  playtest. A pushed hit during a wind-up can break it (behind a toggle).

## Settled, don't reopen
Every threat telegraphed and committed; rules symmetric (walls block both ways); deeper
means more varied, never stronger (no HP/damage scaling); tiers mean different, not
stronger; **no stat-block affixes** (parts are behaviours, not numbers); no melee
magnetism; ember only for threats, enemy bodies per `src/hide.ts`; phone-first, landscape,
thumbs; premium shape (choice over grind). Built for fun by one person, vibe coding.

## What to pitch
**A. Enemy variety** (3+ pitches). Take what Diablo II did and translate it: rosters drawn
per area from a larger pool; families of variants (same behaviour, new name/look/twist);
champions and named uniques with **stacked** modifiers from a longer list; roles that work
together (a support that revives or shields, leaders, ranged behind melee). Also: how the
owner actually meets the thief. Say what's cheap.

**B. Playstyles** (3+ archetypes). Which archetypes this game can support under its
targeting (auto-aim, stick movement, no magnetism): e.g. a close brawler, a marksman, a
caster/area style, a summoner, a combo/button-masher. For each: what makes it *viable*
(not just possible) and *rewarding* instead of kiting-by-default; which existing parts
belong to it; what's missing. Address the structural question head on: **should slots stay
role-locked**, or should any slot be able to carry any role, or should archetypes come
from cross-slot synergies (behaviours, never stats)? What makes standing close worth it?
How does each archetype use the push?

**C. How A and B meet:** enemies or modifiers that favour different archetypes, so a run's
roster asks for a different build.

Each pitch: a name, 3-6 sentences, what the player does or sees, why it fits Still, cost
(cheap / medium / big). Mark at least one per topic "surprising". End with your **one
recommended bundle**. Don't edit code or other files.
