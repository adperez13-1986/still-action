# Brief: a second boss, a second environment, more enemy variety

For the design agents. **This is a pitch round, not a spec.** The owner asked
to fix three things that would wear out first in replay:

1. **One boss.** Every run fights the Assembler twice (depths 3 and 6).
2. **One environment.** Both areas use the same dungeon kit and textures;
   only the light changes.
3. **Four archetypes** (hulk, sentinel, ram, swarf mites, plus elites). They
   become familiar by about run 10.

Difficulty modifiers come later. Don't pitch them.

## Read first

In `/Users/adrianperez/repos/personal/still-action`:
- `DESIGN.md`, `HANDOVER.md`, `design/CATALOG.md` (the 30 parts and the
  ram/mites).
- `design/meta/DESIGN.md`: **the settled run shape these must fit.** It's one
  day in two areas:
  - Area I is depths 1–2 plus the Assembler at 3, morning into noon.
  - Area II is depths 4–5 plus a boss at 6, afternoon into dusk.
  - Then a night walk home. The run lasts about 26 minutes.
  - The warm beam home opens after each boss.
- The code: `src/boss.ts` (the Assembler, its 6 moves in 2 phases, the `BOSS`
  numbers), `src/dungeon.ts` (level generation, the boss arena, packs by
  depth, the body-equivalent budget), `src/kit.ts` (KayKit loading with
  triplanar ambientCG photo textures), `src/world.ts` and `src/grade.ts` (fog,
  the colour grade), `src/ambience.ts` (room tone; note the unused "foundry"
  layer), `src/music.ts`, and `src/enemy.ts` / `src/charger.ts` /
  `src/swarm.ts` for how archetypes are built.
- The original `still` deckbuilder's 43 enemies: `still/src/data/enemies.ts`
  (in `/Users/adrianperez/repos/personal/still`). `DESIGN.md` says they port as
  *data* (names, flavour, sector), never as behaviour. Some of their names or
  sectors may suggest an environment or an enemy.

## Constraints (the owner's)

- **Deeper means more varied, never stronger:** no more enemy HP or damage by
  depth. A new boss can't simply be a bigger number.
- **Every threat is telegraphed and committed; rules are symmetric** (walls
  block both ways, cover works against everything). Phone-first, landscape,
  a 6-inch screen.
- **Colour language:** Still is cold, enemies are ember, Grace the only warm
  light. The owner dislikes flat red or white effects; they should be
  textured. The D2 read comes from the grade, not the models: hard
  desaturation, one warm source, heavy fog, strong vignette.
- **Art:** CC0 low-poly modular kits plus photo textures (KayKit and
  ambientCG are vendored today). Only Still gets hand work. Enemies are built
  from primitives in code, in the rusted-iron + ember-core language.
- **Existing parts must keep working.** Name any of the 30 parts a new enemy
  or boss makes useless, or makes too strong.
- It's built for fun, by one person, vibe coding. Say what's cheap and what's
  big.
- Don't assume the owner has played games you cite; describe the idea
  itself.
- Nothing for Yanah or Yuri.

## What to pitch

- **Second boss:** 3+ pitches for the area II boss at depth 6. For each: what
  it is, its moves and phases in plain words, what it teaches or tests that
  the Assembler doesn't, and what the arena looks like. At least one should
  change what the arena itself does.
- **Second environment:** 3+ pitches for area II's look and feel: what it is
  in the world, what kit or textures it would use (name real CC0 sources if
  you know them, and whether they fit the existing kit), what changes in
  layout, cover, hazards, sound and light, and how it reads as afternoon into
  dusk.
- **Enemy variety:** 3+ pitches. Say whether each is a new archetype, an
  area-specific variant of an existing one, or a mechanic layered on
  existing ones. Include at least one that belongs to area II's environment.

Each pitch: a name, 3–6 sentences, what the player does or sees, why it fits
Still, and the cost (cheap / medium / big). Mark at least one per topic
"surprising": something none of the existing documents say.
