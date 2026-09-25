# Round 2: the Verifier

## (a) The three I'd most back

1. **Live cores** (Balancer N3). It's one death event and one ring, it runs on
   the shared `Hazard` primitive, and it teaches itself, so it needs no
   lesson room. **Half an evening.** It's a sharper version of my Slag Cores:
   cover blocks the burst, and one core can set off the next.
2. **Slag Heap** (Translator V3). It's the existing brood with a new face,
   and it handles depth 5's teaching slot for free: depth 4 teaches "six dots
   are six jaws", and depth 5 hides those same dots in a mound. **1 evening.**
3. **The day moves with you** (Translator E4). The grade slides from one
   preset to the next as Still reaches further rooms, and in the boss fight
   it follows the boss's HP, so the kill lands at first dark. It's the same
   plumbing as meta step 5, plus a room index. **1 evening,** and it does
   more for "one day" than any kit.

## (b) More expensive than they look

- **The Gantry** (Balancer B3, Translator B2). The terrain changes at runtime
  in three places at once: the floor set, the wall boxes, and the instanced
  meshes. Pathing can't see a block until its cell is removed from the floor
  and the cached paths are cleared. It also needs rules for a block landing
  on Still, on an enemy, on loot on the floor, or on a sleeping pack, and
  there's an off-screen crane and chain to build. **5–6 evenings, not 2–3.**
- **The Viaduct with falls** (Balancer E-C). Today anything off the floor
  counts as a wall, so letting a shoved body fall through means an exception
  in every terrain query. It also needs a fall animation, a third lane-end
  glyph, elites climbing back, and loot left at the lip. And the 8% knockback
  overshoot has to be fixed first, which changes how Vent, Kickstart and Skid
  feel everywhere. **4–5 evenings.** The Translator's version, with no falls
  and area I seen below, is honest at medium, if the track rails stay off the
  ram's lanes.
- **The Kiln grates** (Balancer B1, and the Translator's Crucible tiles):
  - A tile at floor level hides anything drawn under it, so "glow from below"
    means using the kit's open-grate tile, or putting the decal on top.
  - 49 separate `tellMaterial` decals is 49 more draw calls on the Poco.
    One instanced mesh with a heat value per tile is a new shader.
  - A burn that hurts on every touch isn't the once-only `Hazard`. It needs a
    cooldown per body.
  - Letting Frost Trail and Chill Vent cool a grate is new part-to-arena code.
  - Each pattern needs its escape distances checked.

  **4 evenings.**
- **Claude's quarter.** The furniture is *cheap*: **KayKit Furniture Bits is
  CC0 and at the same scale** (I measured the GLBs: table 2x1x2 u, couch 3 u,
  bed 3 u, all about 1 u tall, against the dungeon's 4 u tiles and its 1.1 u
  barrier). The houses are the problem.
  - KayKit has no modular house kit. Medieval Hexagon's homes are whole
    miniature buildings, and City Builder's are modern.
  - "Roofs half on, houses almost standing" breaks the open-top, waist-high
    rule, so intact houses can only stand on the far side, in the fog.
  - A cot reads as a child's, which comes close to "nothing for Yanah or
    Yuri".

## (c) Splits

- **The self-boss.** The Echo is the cheapest to build well. Its kit is fixed
  (four whites, then four blues) and every tell already exists, so it can be
  tuned once on the phone. My Copy and the Understudy change with every
  loadout, so the combinations can't all be tested, and the Understudy needs
  all 12 shapes as enemy moves. The Echo's hidden cost is Still visibly
  wearing parts, but only for its eight parts. **Build it later, as the
  second area-II boss.** Changing its phase-2 blues to your own discards is
  the Understudy as an upgrade, with damage kept flat per shape.
- **Area II: the Works.** Use the Dungeon Remastered grates, gated walls and
  scaffold walls (the same kit, so no style risk), plus the day moving with
  you. Take one thing from the Yard: iron catwalk railings that block bodies
  but not shots, a railing rule that needs no new kit. **Move the quarter to
  the walk home**: ruined houses leading up to the one lit house, with
  Furniture Bits for cover. There's no combat there to read, so the story
  costs little.
- **The thief: the Hollow** (Translator V4), placed the Balancer's way: area
  I from depth 2, outside the pack budget, never heading toward a sleeping
  pack. It's the cheapest of the three because it spawns already carrying its
  part, so it never touches the loot floor. It can also carry an unfound
  part, which meets the meta rule that unfound parts come from moments.

## (d) One bundle: the Works at dusk

| | piece | evenings |
|---|---|---|
| base | `Boss` interface (the Assembler still passes its checks) | 1 |
| base | `Hazard` primitive | 1 |
| base | per-area plumbing (surface uniforms, kit list, grade presets; = meta step 5) and the precache list | 1.25 |
| environment | the Works: grates, gated walls, scaffold walls, kegs; `MetalPlates006`, `Metal063`, `Concrete034`, `MetalWalkway014`; steam grates; the day moving with you | 3 |
| boss | **the Arbiter, lighthouse version** (Translator B1): it stands still, so no pathing; the lance is the sentinel's line, scald is the hulk's ring, its lob is a `Hazard`; the new parts are the rotating wedge and cover that cracks for good | 3.5 |
| enemies | live cores, Slag Heap (depth 5), the Hollow (area I) | 3.5 |
| | **total** | **about 13** |

- **Download:** about 8 GLBs (about 0.3 MB) plus 4 surfaces (about
  0.95 MB), taking 3.7 MB to about **5.0 MB**. No new sound files.
- **Precache fix:** keep `loadKit()` loading everything at boot. Add a small
  Vite plugin that writes the list of files in `dist/`, have `sw.js` cache
  that list on install, and bump `CACHE`.
- **Cover density:** keep it at today's one prop per four cells. The Works'
  denser one per three is what makes the Balancer's Lobber necessary. The
  Lobber is next if the cover ever gets denser.

## (e) Build order

1. The precache list and the per-area plumbing, with area II still using
   area I's look.
2. The `Boss` interface, then re-run the Assembler checks.
3. The `Hazard` primitive, then the Works kit and steam grates.
4. Live cores, then the Slag Heap in depth 5's lesson room.
5. The Arbiter: first the wedge and the lance (the smallest fun version),
   then scald and the lob, then phase 2.
6. The day moving with you, across depths 4–6 and the boss's HP.
7. The Hollow in area I.

Fallback: if the Arbiter stalls, a second Assembler with ram and mite adds
(meta step 8) takes one evening.

## Summary

1. I back live cores, Slag Heap and the day moving with you: 2.5 evenings in all, and all three teach themselves.
2. The Gantry (5–6 evenings), the Viaduct with falls (4–5) and the Kiln grates (4) cost about double what they look. The quarter's furniture is cheap (KayKit Furniture Bits, CC0, same scale), but its houses break the open-top rule.
3. For the self-boss, the Echo is the cheapest to build well because its kit is fixed. Build it later as the second area-II boss, and keep the Understudy's discards as its upgrade.
4. Area II is the Works with the day moving with you and see-through railings. The quarter becomes the walk home. The thief is the Hollow, in area I.
5. Bundle: `Boss` + `Hazard` + plumbing, then the Works, the lighthouse Arbiter, live cores, Slag Heap and the Hollow: about 13 evenings, 3.7 to 5.0 MB, precached on install.
