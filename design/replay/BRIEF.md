# Brief: where does still-action's replayability come from?

For the design agents. **A pitch round about direction, not a spec.**

## The owner's question (26 Sep)
*"How are we going to make the game deep and replayable? Are we going full on with the
roguelite aspect, that the depth is based on massive combination of choices, or we go by
content like D2 (areas, monsters, story)?"*

His frame for the project: built for fun, premium quality little by little, maybe sell
someday, no obligation and no timeline. Premium shape: buy-once, choice over grind, no
retention tricks, no stat-block affixes, deeper means more varied never stronger.

## Read first
In `/Users/adrianperez/repos/personal/still-action`: `HANDOVER.md`, `DESIGN.md`,
`design/meta/DESIGN.md` (the run, the Workshop, endings, the hook), `design/CATALOG.md`
(30 parts), `design/premium/SUMMARY.md` and `1-balancer.md` (content lifetime ~2.6 h of
distinct play; the wall fills in ~6 runs; the build is complete by depth 2; take-or-leave
loot; no difficulty ladder), `design/variety/PITCHES.md` (the hand, the eye, tags, families,
champions, the mender), `design/area3/PITCHES.md` (the Line), `design/strain/PITCHES.md`.
Code where it helps: `src/loot.ts`, `src/pool.ts`, `src/dungeon.ts`, `src/abilities.ts`,
`src/parts.ts`, `src/workshop.ts`, `src/save.ts`.

## Where it stands
A 26-minute run, 6 depths, two areas (a third, the Line, built but switched off), two bosses,
3 endings, the Workshop between runs, 30 parts in role-locked slots, parts persist into the
pool, strain as the run's resource, the hand and the eye just built. Real decisions per run
today: take or leave a drop, shrines, the warm beam. One person builds it with AI agents:
systems are cheap to build and multiply; art, tuning and hand-made content are slower.

Claude's opening view (one voice, argue with it): choices for depth, content for meaning:
systems multiply and suit how it's built; the gap is decisions per run, not areas; content
(3 areas, a boss per road, families, the Workshop, the family) gives each run character.

## What to pitch
1. **The direction:** systemic (combinatorics of choices), content (D2-style volume), or a
   specific hybrid. Argue it with this game's numbers and how it's built. What replayability
   target is realistic (hours of distinct play), and what does each direction cost to get there?
2. **The 5-8 moves that would deliver it**, ranked, each with cost (cheap / medium / big).
   Consider (not a list to adopt): choices at drops (pick one of three, trades), part
   interactions without stats, run-shaping decisions (roads, shrines, the hook, boss choice),
   enemies and champions that ask for answers, an opt-in rule ladder for mastery, seeded runs,
   the Workshop's role between runs, content cadence (areas, bosses, story).
3. **What to stop or not build** under your direction.
4. **The surprising one:** an idea none of the documents have.

Write 80-120 lines to `design/replay/1-<your role>.md`. End with your **one recommended
direction and first three moves**. Don't edit code or other files.
