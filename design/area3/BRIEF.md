# Brief: a third area, its boss, and its monsters

For the design agents. **This is a pitch round, not a spec.** The owner asked
for "another area and boss and monster set" and said: *"I will let you guys be
as creative as possible."* He's away while this runs, so pitch boldly, but
say plainly what each idea costs and what it changes.

## Read first

In `/Users/adrianperez/repos/personal/still-action`:
- `DESIGN.md`, `HANDOVER.md`, `design/CATALOG.md` (the 30 parts, the ram, the
  mites, elites).
- `design/meta/DESIGN.md`: the run's shape. **One day, two areas, home at
  night, 6 depths, about 26 minutes.** Area I is depths 1–2 plus the Assembler
  at 3 (morning into noon). Area II is depths 4–5 plus the Arbiter at 6
  (afternoon into dusk). Then the night walk home. The warm beam home opens
  after each boss. Every ending keeps everything.
- `design/content/DESIGN.md` and `design/content/PITCHES.md`: how area II was
  designed (the Works, the workers' quarter, the Lobber, slag cores, the thief,
  the Arbiter), and the pitches that were cut or parked there (the Pourer, the
  Pair, the Echo, named enemies from the old roster, the Gantry, the Viaduct).
  Parked ideas are fair game.
- `design/strain/PITCHES.md`: the strain problem. Pushes are rarely wanted;
  the agreed fix is "a pushed hit breaks the wind-up it's aimed at" and boss
  openings with locks. **A new area is a chance to create push demand.** Say
  how your pitches do.
- Code, for what's cheap: `src/areas.ts` (places, looks, the day), `src/dungeon.ts`
  (generation, packs, presets, the boss arena), `src/kit.ts` (KayKit pieces with
  triplanar ambientCG textures), `src/hazard.ts` (the shared floor hazard),
  `src/boss.ts` (the `Boss` interface), `src/arbiter.ts`, `src/lobber.ts`,
  `src/thief.ts`, `src/enemy.ts`, `src/charger.ts`, `src/swarm.ts`,
  `src/hide.ts` (enemy body materials), `src/music.ts`, `src/ambience.ts`.
- The original `still` deckbuilder's 43 enemies: `still/src/data/enemies.ts`
  in `/Users/adrianperez/repos/personal/still`. They port as *data* (names,
  flavour, sector), never as behaviour.

## The one structural question: where does area III go?

The owner chose a 6-depth, ~26-minute run on purpose. Don't silently make every
run longer. Pitch where the new area sits. Options include, but aren't limited
to:
- **A branch:** after the Assembler, two cold beams, one into area II and one
  into area III. The run stays 6 depths; replays vary.
- **An alternate:** some runs swap area I or area II for area III.
- **A deeper, optional stretch:** past the Arbiter, for players who choose it,
  with its own ending placement. If you pitch this, say how it fits "one day,
  home at night", and what it does to the walk home.
Pick one in your bundle and argue for it.

## Constraints (the owner's, all settled)

- **Deeper means more varied, never stronger:** no more enemy HP or damage by
  depth. A new boss can't just be bigger numbers.
- **Every threat is telegraphed and committed; rules are symmetric** (walls
  block both ways; cover works against everything). No melee magnetism.
- **Colour language:** Still is cold, Grace is the only warm light. **Ember is
  reserved for threats** (cores, eyes, seams, tells). Enemy bodies vary by
  metal (`src/hide.ts`): iron hulk, olive-bronze ram, gunmetal sentinel,
  verdigris Lobber, coal mites, rust thief. New enemies need their own body
  material under that rule. No flat red or white effects; textured.
- **Art:** CC0 low-poly modular kits plus photo textures (KayKit and ambientCG
  are vendored). Only Still gets hand work. Enemies are built from primitives
  in code. Mind the download budget (it's a PWA that precaches everything).
- **Phone-first,** landscape, 6-inch screen, thumbs.
- **Existing parts must keep working.** Name any of the 30 that a pitch makes
  useless or too strong.
- **Nothing for Yanah or Yuri,** and nothing that puts the kids or Grace in
  danger. The family are presences, not content.
- Built for fun, by one person, vibe coding. Say what's cheap and what's big.
- Don't assume the owner has played games you cite; describe the idea itself.

## What to pitch

- **The area:** 3+ pitches. What it is in the world and the day, its kit and
  textures (real CC0 sources if you know them), layout, cover, hazards, sound,
  light. At least one should change how the level itself behaves, not only how
  it looks.
- **The boss:** 3+ pitches. What it is, its moves and phases in plain words,
  what it tests that the Assembler and Arbiter don't, its arena. It must create
  a real reason to push.
- **The monster set:** 3–5 new enemies or variants that belong to the area.
  For each, whether it's a new archetype, a variant, or a mechanic on existing
  ones; its body material; its tell; what it asks of the player.
- **Where it sits** (above).

Each pitch: a name, 3–6 sentences, what the player does or sees, why it fits
Still, and the cost (cheap / medium / big). Mark at least one per topic
"surprising". End with your **one recommended bundle**.
