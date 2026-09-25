# Pitches: a second boss, a second environment, more enemy variety

26 Sep 2026. Same process as the Home pitches: four voices (balancer,
translator, verifier and me), two rounds. The raw rounds are in this folder.
Nothing is built. Difficulty modifiers are deliberately left out, as you
asked.

This round converged more than the last one. Most of it is agreed, and one
real choice is left for you (area II's identity, at the bottom).

---

## What all four agree on

- **The Assembler stays at depth 3, unchanged.** Area II gets its own boss.
- **No "boss made of you"** for now. Three voices pitched one: built from
  your discards, copying your loadout, or a mirror Lantern. In round 2 all
  three pulled back. The discards version puts a hidden price on taking new
  parts; the copy cancels your build at the last fight; the mirror is an
  evil-twin cliché as the last fight before home. The mirror (the **Echo**)
  survives as a maybe, later: a rare named enemy, or a second area-II boss.
- **Area II carries at most two new mechanics.** It's about 10 minutes of
  crawl, and depth 4 already teaches the mites.
- **Two foundations come first:**
  - a `Boss` interface, because the Assembler is hardwired in a few places;
  - a shared floor **Hazard**: a patch of floor that shows a telegraph, arms
    once, and hurts Still *and* enemies alike.
  Most pitches here stand on those two.
- **The offline cache has to be fixed with it.** The service worker only
  caches what's been fetched, so a new area's art would break offline the
  first time you reach it. Precache everything on install.
- **Cut, too expensive for what they give:**
  - the Gantry (a crane that moves cover mid-fight);
  - the Viaduct with falls (enemies shoved off edges);
  - the Kiln's floor grates;
  - slow water;
  - the Ring Hulk;
  - fences that stop bodies but not shots, which can't be told from stone
    on a phone.

---

## The second boss: the Arbiter *(everyone's pick)*

A lattice lamp tower in the middle of the arena. It doesn't walk. **An ember
wedge of light sweeps the floor like a lighthouse**, stops on Still, and
fires a lance down it. You fight it by moving between cover in the gaps of
the sweep. It's the sentinel's lock at boss size, and it tests timing and
cover rather than dodging a big body.

- **The heat beam.** A lance that hits you heats one of your buttons: for a
  while it can only be fired by pushing, at +2 strain. This is the one thing
  in the game that brings **Stopped** back into reach at the end of a run
  without an enemy adding strain directly.
- **The push window.** After every lance the tower vents for 1.2 s, and
  that's when you hit it.
- **Lights out, capped.** As its HP falls, the arena darkens toward night.
  It stops at first dark, never black. Tells and enemy cores ignore the fog,
  the walls get a cold rim, and Grace's light stays as bright as ever. The
  kill lands at dusk, just as the warm beam opens.
- 900 HP like the Assembler, never above 22 per hit. About 3.5 evenings.
- **Fallback, 1 evening:** a second Assembler with ram and mite adds (the old
  plan).

**Also pitched, if you'd rather:**
- **The Pourer:** a furnace that pours slag lanes across the floor, and the
  slag sets into walls you can use against it. The arena changes instead of
  the light.
- **The Pair:** two machines at half HP each; kill one and the other takes
  over one of its moves.

---

## Enemy variety

**Agreed:**

1. **The thief** *(area I, from depth 2)*. A small machine that never
   attacks. It carries a part in a cage on its back, the only cold light on
   any enemy, and it runs. Catch it and the part drops. It never leaves the
   level, can't take a part you're standing over, and adds no new loot. Its
   pauses bring its average speed to 4.5, under Still's 5.5, so it's
   catchable. It's in area I because depths 1-2 are played in every run, so
   variety there pays most. About 2 evenings.
2. **Slag cores** *(area II)*. Some enemies leave a telegraphed burning
   puddle where they die. It arms in 0.4 s and hurts anyone standing in it,
   Still or enemy. Puddles don't chain. Where you kill something becomes a
   choice. Half an evening on the Hazard.
3. **The day moves with you** *(everywhere, 1 evening)*. The light darkens
   with how far Still has got through each level, not just by area. The
   whole day is felt, not only at the area change.

**One more for area II (pick one, or both if the area can carry it):**
- **The Lobber.** A sentinel variant that lobs shells over walls. It's
  symmetric with Still's own Flare (the parts doc promised that "any future
  enemy lobber gets the same rule"), and it's the only thing that punishes
  hiding. It needs dense cover to matter. About 1.5 evenings.
- **The slag heap.** A sleeping brood of mites that looks like a mound of six
  coals: the same mites with a new face, fitting a foundry. About 1 evening.

**Later, maybe:** **named ones from the old roster.** Each level has one named
enemy from the original Still's 43 (Rust Guard, Fracture Mite...), an existing
archetype with one small twist and a notebook page. Cap it at 12 twists to
start.

---

## The second environment: the one choice left for you

The day runs from afternoon into dusk on the road home. Three versions:

**A. The Works** *(verifier's pick)*
The Assembler's foundry: machinery beyond the edge, slag gutters, plate
floors. It turns on the unused "foundry" room tone, with a forge thumping at
half the music's tempo and plate footsteps. It reuses unvendored pieces of the
same KayKit dungeon kit (grates, gated walls, scaffolds), so there's no style
risk. It suits slag cores and the slag heap. About 3 evenings, +1-1.4 MB.

**B. The quarter where people lived** *(balancer's pick)*
The ruins of a residential quarter, getting more intact the closer you get
to home. It isn't taller: walls stay waist-high, and the intactness shows in
floors, furniture and far-side door frames. Cover is broken furniture (KayKit
Furniture Bits, CC0, same scale). It also works as a cover dial: depth 4 is
rubble with sparse cover, depth 5 is dense, which gives the Lobber something
to punish. No cot, because that's too near the kids. About 3-4 evenings.

**C. The commute** *(translator's pick, and mine)*
Both, in order: **depth 4 is the Works at the end of the shift, depth 5 is the
workers' quarter**. The Arbiter stands in the quarter's square at dusk, and
the night walk home goes through the last of the quarter to the lit house.
It's the most story for the run you already chose ("one day, the road
home"), but it's two kits (about +2 MB) and the most art work. About 5
evenings.

---

## The recommended bundle

**C (the commute)** + the **Arbiter** + the **thief** in area I + **slag
cores** + the **day moving with you** + one of **Lobber / slag heap**.

About 14-15 evenings, the download going from 3.7 MB to about 5-5.5 MB. If
that's too much, A or B alone brings it to about 12. It builds after the Home
design, because it needs the two-area run to exist.

| order | step | evenings |
|---|---|---|
| 1 | `Boss` interface, floor `Hazard`, per-area presets, precache on install | 3 |
| 2 | Area II's kit(s) and generation | 3-5 |
| 3 | Slag cores, then the Lobber or the slag heap | 1.5-2 |
| 4 | The Arbiter: wedge and lance first, then the heat beam and lights out | 3.5 |
| 5 | The day moving with you | 1 |
| 6 | The thief in area I | 2 |
