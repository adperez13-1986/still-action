# Round 1: the Verifier's pitches

Scope and buildability, and pitches too. Everything below comes from reading
the code as it stands (`boss.ts`, `dungeon.ts`, `kit.ts`, `terrain.ts`,
`enemy.ts`, `combat.ts`, `sw.js`, `public/`) and from checking what the CC0
sources ship. Estimates are in vibe-coding evenings. The code is quick to
write. What stays slow is tuning the windups on the phone and getting the
look right.

---

## What the code already gives

### For a second boss

- **Reusable as is.** Four pieces of the Assembler can be reused. The charge,
  with its `LaneTell` lane cut to the first solid and its stun on a wall. The
  ring `wave` in Combat, whose gaps work and which cover already shadows (the
  comment above `interface Wave` saying "walls don't stop it" is stale; the
  hit test checks `lineClear`). The `shots` fan. And `summon` (piles that
  become hulks in the boss's pack) plus `pull`. Moves are chosen from a
  weighted table in `choose()`, so a new boss is mostly a new table, a new
  body and one or two new moves.
- **What is wired to the Assembler.** Any second boss pays about one evening
  to unpick this:
  - `combat.boss` is typed `Assembler | null`.
  - `main.ts` casts `as Assembler` three times and reads `overloaded`,
    `stunned` and `justOverloaded`.
  - The HUD bar hardcodes the name and `BOSS_HP`, and the banner hardcodes
    "the Assembler overloads".
  - Combat's wave loop reads `BOSS.wave.gapWidth` and `minGap`.
  - `depth % BOSS_EVERY` picks the arena.

  The fix is a small `Boss` interface (name, max HP, a phase-2 flag,
  stunned, a "just changed phase" flag, `worldGroup`, `laneEnd`) and a
  `bossFor(depth)` picker. This replaces step 8 of `meta/DESIGN.md` ("the
  second Assembler's adds").
- **Tall bodies.** The camera looks from +x,+z. The Assembler is 4.2 tall and
  waits on the far side of its arena. A taller boss has to stay on the far
  side too, or it hides the floor.
- **Loot.** `rollPart('boss')` works for any boss, so Through-Line and
  Borrowed Time stay reachable.

### For enemies

- **What fits `Enemy` with no Combat changes.** Any strike that is one of the
  existing `EnemyAction`s fits: `melee` (with `reach`), `shot` (with
  `bounces`), `shots`, `wave`, `summon`, `pull`. `ctx.canLock/book` keeps
  locks 300 ms apart for free, and `emit` covers the sounds.
- **A variant** (same `kind`, a different body or numbers, passed as a
  constructor argument) costs only its own code.
- **A new `kind` pays about half an evening of plumbing** before any
  behaviour: the `kind` union, `Archetype`, and the `ELITE_MODS` record,
  which stays a type error until you choose its elite mods. On top of that:
  a `BE` letter and `kindOf` in `dungeon.ts`, the spawn switch in
  `combat.ts`, a treasure class in `loot.ts`, the `who` name in `main.ts`,
  and sounds.
- **A new action kind** (for example "a burst lands on this spot") is about
  half an evening in Combat.

### For environments: what the generator can vary cheaply

- **Room shapes.** The floor is a `Set` of cells. Pathing is a cached BFS
  over floor cells only. Removing a room's centre cell (a pit you circle), or
  cells from a corner (an L-room), takes an hour or two. Changing the floor
  mid-fight also needs `fields.clear()` exposed.
- **Solids that appear.** Props are `Circle`s with a `dead` flag that
  movement, sight and projectiles already respect, and BFS ignores props.
  Place circles dead and set them alive later, and you get new solids
  mid-fight with no terrain rebuild. Boxes have no such flag (about an hour
  to add one).
- **Cover types.** Sight and shots (`see`) are already a separate query from
  movement, because of Through-Line's breaches. A box that is always open to
  `see` would block bodies but let shots through: a railing. About an hour.
- **Props.** `PROPS` and `BREAKABLE` are file constants. Making them
  per-area is trivial.
- **Hazards: none exist.** One shared **`Hazard` primitive** would cover
  pitches in all three topics: a strip or circle on the floor that shows a
  telegraph, arms once, and hits every body inside once, Still and enemies
  alike. About one evening. **Build it once.**
- **The run cap cuts content.** The `D7` pack rows (all four archetypes)
  can't be reached now that the run ends at depth 6. Area II is depths 4 and
  5, about 12 packs a run, and depth 4's lesson room already belongs to the
  mites. A new area-II enemy gets its lesson room at depth 5 or nowhere.

### Download size and the offline cache

- **Today:** `dist/` is 3.7 MB.
  - JS: 873 KB.
  - KayKit: 1.1 MB, 27 GLBs, of which `PIECES` loads 16. The other 10 are
    never fetched.
  - Textures: 972 KB, four ambientCG surfaces at 512 px (Color + NormalGL,
    about 240 KB each).
  - Sound effects: 452 KB.
- **A new environment** adds 6–10 GLBs at 20–60 KB each (0.2–0.5 MB) and 3–4
  surfaces (0.7–1.0 MB). That's about **+1.0–1.4 MB, taking 3.7 to about
  5 MB.**
- **GPU memory:** a 512 px texture with mipmaps is about 1.4 MB, so eight
  more is about 11 MB. The Poco has room for that. `kit.ts` already throws
  away the atlas each piece embeds.
- **Swapping surfaces is cheap.** `skin()` puts the photo texture in
  per-material uniforms (`uAlb`, `uNrm`). Changing area means setting two
  uniform values per surface, with no shader recompile. `skin` just has to
  keep a handle to them.
- **The one real trap.** `sw.js` caches files as they are fetched. It never
  precaches. Today `loadKit()` fetches every piece at boot, so one load
  caches everything. If area II's pieces load lazily at depth 4, then a
  player who installs, goes offline and reaches depth 4 for the first time
  gets an area with missing art. **Keep loading everything at boot** (about
  a second more on 4G, once), or add a precache list to `sw.js` and bump
  `CACHE`.

### CC0 sources checked

All KayKit packs are CC0 (repos under `github.com/KayKit-Game-Assets`). Any
piece of the same family can be vendored, and since `kit.ts` replaces the
colour with a photo skin, only the silhouette has to fit.

- **Dungeon Remastered, not vendored yet** (the same kit, so no style risk):
  - floors: `floor_tile_big_grate`, `floor_tile_big_grate_open`,
    `floor_tile_extralarge_grates` (with `_open`), `floor_tile_big_spikes`,
    `floor_wood_large_dark`, `floor_foundation_*`
  - walls: `wall_gated`, `wall_archedwindow_gated`, the `*_scaffold` walls,
    `stairs_*`
  - props: `keg`, `barrel_small_stack`, `torch_mounted`, `chest`
- **Halloween Bits:** `fence`, `fence_broken`, `fence_pillar`, `fence_gate`,
  `arch`, `arch_gate`, `tree_dead_large/medium/small`, `path_A`–`D`, `post`,
  `lantern_standing`, `crypt`. Leave out the pumpkins, skulls and bones: they
  break the tone.
- **Space Base Bits:** `containers_A`–`D`, `cargo_*`, `structure_low`,
  `structure_tall`, `drill_structure`. The shapes are sci-fi, so use them
  only far off in the fog, as machinery.
- **Kenney Factory Kit and Conveyor Kit** (CC0): machines and belts, by a
  different artist. Try them in `look.html` before trusting them.
- **ambientCG** (CC0; IDs confirmed through its API):
  - metal: `MetalPlates006`, `MetalWalkway014`, `CorrugatedSteel007A`,
    `Metal063` (rust), `PaintedMetal004`
  - stone: `Concrete034`, `Bricks097`, `Bricks085`, `PavingStones138`
  - open-air grates and fences: `Grate001`, `Fence007A`
  - outdoor floors: `Ground037`, `Grass004`, `ScatteredLeaves009`,
    `Gravel023`, `Moss002`

---

## Topic 1: The second boss (depth 6)

### B1. The Arbiter: a fight about strain, not space

The old sector-2 boss, *The Thermal Arbiter* ("It measures everything. It
forgives nothing."), whose turns disabled a body slot. Here it's a tall,
narrow machine with one great lens. Its key move is a heat beam: the
sentinel's aim line, tracking and then freezing. If the beam lands, one of
Still's buttons heats up and goes back to *recharging* for 4 s, glowing
ember. The button is never taken away: a recharging button still fires the
way it always has, by push, for +2 strain. The beam needs a line of sight,
so cover saves the button. Its other moves are the Assembler's barrage and
sweep, copied. At 55% it heats two buttons at once, and aims through a slow
ring (the `wave`), so you pick between the ring's gap and the cover.

- **What you do:** break line of sight at the right moment, and decide
  mid-fight whether a hot button is worth 2 strain.
- **What it tests that the Assembler doesn't:** the run's resource. The
  Assembler tests HP and position. This is the one fight where Stopped is a
  real risk at the end of a run, which answers the open question in
  `meta/DESIGN.md` about whether Stopped is reachable at all.
- **Arena:** the 28u room with a grid of `wall_gated` pieces instead of the
  four barrier walls. Nothing else new.
- **Parts:** Patient Lens and Overrun get better, since heat hands them
  their push without the wait. That's fine: they still pay strain. Brace
  plus a hot button can Stop Still in the last fight, and that should be
  said somewhere the player can read it. Borrowed Time is expensive here.
  None become useless.
- **Smallest fun version:** the body, the beam that heats one button, and
  the Assembler's barrage and sweep. No phase 2.
- **Cost:** medium, **3 evenings** plus the one-evening `Boss` refactor.
  Setting a slot to recharging is one field in `parts.ts`. The beam is
  `ranged.ts`'s aim line.

### B2. The Pourer: the arena changes

A foundry ladle on four legs in a casting floor cut with channels. Its main
move tips and pours. A channel's lane lights up (the ram's `LaneTell`), slag
runs down it as a committed strike, and where it stops it sets into a
waist-high slag wall 1.5 s later. So this fight's cover is written by the
boss: every pour you dodge leaves a wall. You can hide from its barrage
behind one, or bait its charge into one (the Assembler's charge, which stuns
on slag). The charge also smashes the slag it hits, the way it already
breaks crates (`rushEnd` then `smashNear`), so the arena never settles. At
55% it pours two channels at once, one of them from the edge toward you.

- **What you do:** read a map that is being redrawn, and plan where cover
  will be before it's there.
- **What it tests that the Assembler doesn't:** a changing arena. The
  Assembler's room is the same at the end as at the start.
- **The build trick:** the channels are fixed. They replace the four
  barrier walls. Each channel's slag walls are a chain of circles placed
  `dead` and set alive when the pour ends. No terrain rebuild, no pathing
  change.
- **Colour:** the slag is ember only while it runs, drawn with the animated
  `tellMaterial`, not flat red. It cools to dark rusted iron, so Grace's
  light stays the only warm light in the room.
- **Parts:** Ricochet Lens and Clamp Toss gain walls to use, and
  Through-Line holes slag like any solid. None become useless or too strong.
- **Smallest fun version:** four fixed channels and one pour move, plus the
  existing charge and barrage.
- **Cost:** medium, **3 evenings** plus the refactor.

### B3. Hammer and Tongs: two bodies, one chain

A smith and its bellows, two smaller machines chained together. The Hammer
has the sweep and the charge. The Tongs have the barrage and the magnet. The
chain between them is a line segment that blocks shots from both sides, so
it's moving cover. When they pull it taut (telegraphed: it lifts and
glows), anything on the line is hit (`distToSegment` exists). Kill one and
the survivor overloads and takes its partner's two moves, so which one you
kill first decides what phase 2 is.

- **What you do:** split your attention, pick a target, and use or avoid
  the chain.
- **What it tests that the Assembler doesn't:** priority. The Assembler is
  one thing to watch.
- **Arena:** the existing arena, unchanged.
- **Parts:** Lure is ignored by both. Parry breaks neither. Cracked Lens
  gets strong when the two line up along the chain, which reads as a skill
  shot rather than a problem.
- **Smallest fun version:** two instances of a data-driven Assembler, each
  with half the move table, and the chain as cover only (no taut strike).
- **Cost:** medium, **3 evenings** plus the refactor. The camera already
  frames everything awake. A shared boss bar is the only new HUD.

### B4. The Copy (surprising)

A heavier Still in rusted iron with an ember core, built from the Lantern
rig in `still.ts` with other materials. It carries the *shapes* of the four
parts Still walks in with. The trick: the Assembler's four phase-1 moves are
already Still's four slots, drawn big.

| Still's slot | the Assembler move it matches |
|---|---|
| Head (a bolt) | barrage |
| Torso (a nova) | shockwave or magnet |
| Arms (an arc) | sweep |
| Legs (a dash) | charge |

So the Copy builds its move table from your loadout:
- Backdraft Vent on you: it gets the magnet.
- Ward: a 1.5 s shell that eats your bolts.
- Spring Heels: its charge vaults a low wall.
- An empty slot: it lacks that move.

The boss is different every run because your build is.

- **What you do:** fight your own kit from the other side. You know its
  timings because you know your own.
- **What it tests that the Assembler doesn't:** knowing what your parts do.
  It also turns the part pool into boss variety, which will grow as the pool
  grows.
- **Why it fits:** "built by what it survives". The Assembler builds from
  scrap. The Copy is built from you.
- **Risk:** a rusted Still at dusk may read as heavy. That's Adrian's call.
- **Parts:** it never copies gold effects. Through-Line and Borrowed Time
  map to their white. Shapes with no good boss version (decoy, anchor,
  rewind, catch) fall back to the white's move. Lure is ignored.
- **Smallest fun version:** only the four mappings that already exist in
  `boss.ts`, picked by slot. No new moves.
- **Cost:** medium, **3 evenings** plus the refactor. The ward and hop moves
  are the only new code.

---

## Topic 2: The second environment (area II)

### E1. The Foundry Floor

Area II goes down from the stone halls into the working floor where the
Assembler was built.

- **Kit:** Dungeon Remastered's big grates, gated walls, arched windows,
  scaffold walls and kegs, all the same family. Space Base's containers and
  `structure_tall` sit far off in the fog as machinery.
- **Surfaces:** `MetalPlates006` for floors, `Metal063` rust on the
  barriers, `Concrete034` columns, `MetalWalkway014` in corridors.
- **Layout:** the chance of a 5x3 hall goes from 25% to 50%, and there are
  pillar rooms: the centre cell becomes a furnace pit you fight around.
- **Cover:** kegs and containers, fewer crates.
- **Hazard:** steam grates, using the `Hazard` primitive. A grate hisses and
  fogs for 0.9 s, then vents once. It hits Still, hulks and rams alike, so
  you can lead a pack across one.
- **Sound:** the foundry layer in `ambience.ts`, now used only on boss
  levels, plays low through the whole area. The clanks come closer and more
  often.
- **Light:** afternoon lowers and lengthens the cold key light. Dusk at depth
  5 deepens the fog toward blue-violet. Grate glow is emissive texture only,
  with no point lights, so Grace stays the only warm light.

**Why it fits:** it's the Assembler's home, and the old sector 2 was
thermal (Furnace Tick, Slag Heap, Meltdown Core), so the notebook's names
come with it. **The risk:** a hot room competes with the enemies' ember. Keep
the heat dark, textured and at floor level. **Smallest fun version:** the
re-skin, the pieces and the steam grates, without the pillar rooms.
**Cost:** medium, **2 evenings** plus about 1 for per-area plumbing, which
is shared with `meta/DESIGN.md` step 5 (per-area grade and fog). About
+1.1 MB.

### E2. The Yard at Dusk (surprising: cover that stops bodies, not shots)

Area II comes up out of the maze into the open: walled yards, iron fences,
dead trees, gravel paths. That completes the day's shape. Morning is
underground, afternoon comes up into the air, dusk is in the open, and the
walk home, which is already outdoors, is night.

- **Kit:** Halloween Bits' fences, fence pillars, arch gates, dead trees and
  paths, without the pumpkins and skulls.
- **Surfaces:** `Ground037` and `ScatteredLeaves009` for floors, `Gravel023`
  for paths, `Moss002` stone. `Rock035` stays for the low stone walls.
- **The new rule:** an iron fence blocks bodies but not shots, for both
  sides (a box that is always open to `see`). A yard fenced in iron is no
  cover from a sentinel, but it still stops a ram, which stuns on it like a
  wall. Rooms mix stone (full cover) with iron (bodies only), so choosing
  where to stand becomes a read.
- **Sound:** no stone reverb (a shorter convolver). The draft layer becomes
  open wind. No drips.
- **Light:** the fog takes on a sky colour, and the dead trees fade into it
  as the beyond. The key light stays cold, and dusk comes through the grade.

**Why it fits:** Still is walking toward home. **Flag:** this bends the
letter of "cover works against everything". The argument for it: a fence
isn't cover, it's a railing, and it treats both sides the same. **Parts:**
Ricochet Lens must not bank off fences (leave them out of `faces()`). Ward
and Mirror Ward get more valuable. The ram answers still work. None become
useless. **Smallest fun version:** fences and the re-skin, with one iron
yard per level. **Cost:** medium, **2–3 evenings** plus the per-area
plumbing. About +1 MB.

### E3. The Viaduct (big)

Walkways and bridges high over the fog. Some edges have no barrier, and a
body shoved over one is gone, so a ram that misses you near an edge rushes
off it. This is the biggest change here, because it turns Pressure Vent,
Piston, Clamp Toss, Skid Plates and Backdraft into ring-out tools, all of
them too strong in open-edge rooms. Enemies that fall should drop nothing,
to hold that back. It also needs a rule for Still falling, such as landing
back where he stepped off, hurt. **Smallest fun version:** one open-edge
bridge room per level, not a whole area. **Cost:** big, **4–5 evenings**,
most of it balance.

### E4. The Same Halls, Later (the cheap one)

The same KayKit shapes in new surfaces: brick walls (`Bricks097`), moss
between the paving (`PavingStones138`), and dark wood walkways
(`floor_wood_large_dark`). Add the generator's area-II shape knobs (pillar
rooms, more halls, L-rooms), and shafts of low afternoon sun through the
broken walls, drawn with the exit beam's additive material. No new
mechanics. To be honest, this only half answers the complaint: the light
changes, and now the textures do too. **Cost:** cheap, **1 evening**, about
+0.7 MB. It's a good fallback if E1 or E2 stalls on the look.

---

## Topic 3: Enemy variety

### N1. The Lobber: an area-II variant of the sentinel

The sentinel's aim line tracks you, then freezes on a spot, and a shell
lands there 0.8 s later. It's Still's Flare (H2) from the other side. The
lock needs a line of sight, so cover works against the aim. The shell comes
over walls, though, so hiding stops new locks and moving beats a lock
already made. Its lesson is "hide, then move" where the sentinel's is
"hide".

- **Why it fits:** symmetry. Still already owns this shape.
- **Flag:** Ward and Mirror Ward don't stop a shell, because it's a burst,
  not a shot. Their cards should say so. It also bends "cover works against
  everything", because cover stops the aim, not the shell.
- **Cost:** cheap-medium, **1.5 evenings**: a `Ranged` variant plus one new
  action, which can be the `Hazard` primitive.

### N2. Slag Cores: a mechanic layered on area II's four archetypes

In the Foundry, every enemy's core is molten. When one dies it spills a
small slag puddle: the `Hazard` primitive, arming after 0.4 s and hitting
each body in it once. Kill a hulk in a corridor and the pack behind walks
through its puddle. Kill a ram on its own lane and its puddle waits for the
next one. Where you kill something becomes a choice, and it hurts enemies
as readily as Still. Mites spill one shared puddle per brood, not eight, so
the floor doesn't turn to soup. **Parts:** Backdraft Vent pulling a pack
into a fresh puddle is a good combo, not a broken one. **Cost:** cheap,
**half an evening** once the `Hazard` exists. No new `kind`.

### N3. The Ring Hulk: an area-II variant of the hulk

Area II's hulk turns the hulk's lesson around. Its slam doesn't hit where it
lands. It sends a small ring out from there (the boss's `wave`, 5u across,
with one gap), so right under it is safe and middle distance isn't. In area
I you back off a hulk. In area II you step in. It covers a different area,
not more of it, and its damage stays the same. **What fits:** it uses the
existing `wave` action once the gap numbers stop being read from `BOSS`.
**Cost:** cheap, **1 evening**.

### N4. The Tinker (surprising: a new archetype that never attacks)

A small, scuttling scrap-collector that wakes with its pack. When a part is
on the floor, it goes for it, picks it up and carries it slowly toward its
nest in a side room. Kill it and the part drops where it falls. It can't
take a part Still is standing over, and it never leaves the level, so
nothing is ever lost. For once Still is the hunter, and the "take or leave
it" choice gets a clock. It doesn't count as awake for the quiet, since it
isn't a threat. **Why it fits:** machines built out of scrap, and "parts
stay on the floor until you leave" gets a meaning. **Cost:** medium,
**2 evenings** (the new-kind tax plus a hook in `loot.ts`).

### N5. The Crate that Breathes (surprising, cheap)

One crate among many whose seams pulse ember, slowly, with its lid lifting a
finger's width in time. That breathing is its telegraph. Hit it and it
unfolds into a hulk on crate legs. It turns breaking crates from a reflex
into a read. Crates break to any hit from either side, so a ram rushing into
one wakes it too. It always drops what a crate would (a 30% repair scrap),
so being curious still pays. **Cost:** cheap, **1 evening**. It's a hulk
variant that spawns as a breakable.

---

## What I'd build, as two bundles

The two pieces of plumbing come first in either bundle, because they unlock
most of the pitches: the **`Boss` interface** (1 evening) and the **`Hazard`
primitive** (1 evening). Per-area plumbing (surface table, kit list,
grade/fog preset) is the same work as `meta/DESIGN.md` step 5.

| bundle | contents | evenings |
|---|---|---|
| **A: the Foundry** | Boss 1, Hazard 1, per-area 1, E1 2, B2 Pourer 3, N2 Slag Cores 0.5, N3 Ring Hulk 1 | about **9–10** |
| **B: the Yard at Dusk** | Boss 1, Hazard 1, per-area 1, E2 2.5, B1 Arbiter 3, N1 Lobber 1.5, N4 Tinker 2 | about **12** |

A is the tighter one: one material (slag) runs through the environment, the
boss and the enemies, and one primitive carries all three. B has the
stronger story (the day comes up into the open on the way home) and the
more novel boss.

---

Sources checked for the kits: [KayKit on itch.io](https://kaylousberg.itch.io/),
[KayKit Dungeon Remastered](https://kaylousberg.itch.io/kaykit-dungeon-remastered),
[KayKit Halloween Bits](https://kaylousberg.itch.io/halloween-bits),
[KayKit Space Base Bits](https://kaylousberg.itch.io/space-base-bits),
[KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest),
the piece lists in the `KayKit-Game-Assets` GitHub repos,
[Kenney Factory Kit](https://kenney.nl/assets/factory-kit),
[Kenney Conveyor Kit](https://kenney.nl/assets/conveyor-kit), and the
[ambientCG](https://ambientcg.com) API.

## Summary

1. Build two pieces first: a `Boss` interface (1 evening) and a shared floor `Hazard` (1 evening). Between them they unlock most of these pitches.
2. Boss: the Pourer (B2) rewrites its arena with slag walls you use against it. The Arbiter (B1) tests strain instead of space. The Copy (B4, surprising) builds its moves from your loadout, so the boss changes every run. Each is 3 evenings.
3. Environment: the Foundry (E1) reuses the unvendored Dungeon Remastered grates and gated walls. The Yard at Dusk (E2, surprising) adds iron fences that stop bodies but not shots. Either is about +1–1.4 MB, taking the download from 3.7 to about 5 MB.
4. Offline trap: `sw.js` only caches what has been fetched. Keep loading every kit piece at boot, or area II breaks offline the first time a player reaches it.
5. Enemies: Slag Cores (0.5 evening) and the Ring Hulk (1 evening) need no new kind. The Lobber bends "cover works against everything". The Tinker (surprising) never attacks and makes Still the hunter.
