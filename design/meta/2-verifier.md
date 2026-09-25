# Round 2: Verifier

## (a) The three I'd back most

1. **Balancer M1 with its grind check.** It's the same idea as my M1, but with
   the one number the meta layer hangs on: a 50% chance per level of an
   unfound part from elites, and every boss drops an unfound gold. Its rule
   that nothing unfound drops at depth 1 is what stops players throwing
   runs to farm.
2. **Translator W2 + W5, the light stops leaning, and wood underfoot.** Home
   gets warm from a grade preset, one light and a footstep swap. That's the
   most feeling per line of code in all four files.
3. **Balancer W4, the corkboard draws the run as a line.** It's a keepsake
   drawn from about 200 B of data the run already has, and it's re-rendered
   whenever it's shown. It gives the photo idea's emotional beat without the
   photo's storage problem (see b).

## (b) Much more expensive than they look

| Pitch | Hidden cost |
|---|---|
| Translator W4, the photo | **Storage.** Each thumbnail is a 20–40 KB data URL, so 60 of them is 1–2 MB in a `localStorage` that's shared with every GitHub Pages site on the origin. It would need IndexedDB, which is a second save path. Capturing the frame also needs `preserveDrawingBuffer` or a render target. |
| C-W1, the kids draw your run | **A new renderer path** (a crayon shader rendered to a texture) plus a picker for the run's "defining thing", and the same storage problem as the photo. |
| Translator W3, kids as figures; W6's asleep pose | **Authored content.** DESIGN only allows hand-work on Still's own parts, and the kit has no children in it. |
| Translator M3, the room fills | **Authored content.** It needs 20–25 domestic props, and the KayKit Dungeon kit has no rugs or plants. |
| Translator M6, the patched body | Depends on "Still visibly wearing his parts", which isn't built. It adds decal slots to the rig. |
| Translator R1, saving at every beam | **Save migration.** A run that's in progress survives a deploy, and part ids and pack tables can change under it. It needs a version check that throws away a stale run. The code is 1 evening; getting the rule right is the hard part. |
| Translator R4, exits as the map, on every level | Every level would need **2–3 exit rooms**, and the layout has one exit attach today. It's cheap only in the 28×28 boss arena. |
| Balancer W2, the test bench | It needs a second combat context: respawning enemies and no-HP flags running through `combat.ts`. Medium, not cheap. |
| Balancer R6, discards on the boss; C-R2, the authored exterior | Both are **authored content**: about 30 boss-side telegraphs, and one hand-built set. |

**Seeding:** no pitch needs it, and none should. Loot and combat use
`Math.random`.

## (c) The open disagreements

- **Kids timing.** Split presence from parts. Their *presence* has no gate:
  from the first Workshop visit, which comes after run 1 however it ended,
  they're there as traces and doorframe marks (Translator W3's alternative,
  and my W4). Only their *parts* can be gated, and that gate is the owner's
  call. Not gating presence is also the cheaper option: there's no counter.
- **Run length.** Build **6**, and make the length one constant. Six depths is
  about 25 minutes, which fits a phone and doesn't make a mid-run save
  urgent. Moving to 9 means changing that constant after a playtest, not a
  redesign. One side effect: the D7 pack rows never appear in a 6-depth run,
  so pull one mixed row into depth 5–6.
- **Wear.** **Measure before building it.** Add a dev counter for pushes and
  quiets per level, and play five runs on the phone. If Stopped comes out
  under about 10%, try quiet −1 first. That's one constant and no second
  mark on a HUD built for one bar. Wear is next only if that fails.
- **"Sit down".** **No.** The warm beam is already the voluntary way to end a
  run. Stopped should stay involuntary ("it gave what it had"), or it becomes
  a second version of Home and the two losing endings stop meaning different
  things.
- **Broken losing parts.** **No.** It breaks the rule that the save keeps
  every permanent unlock. It also needs a provisional "found" state, which
  lets a player close the tab before Still breaks to keep the part. The
  simple rule is sturdier: a part is written to the found set **the moment it's
  picked up**.

## (d) One combined pitch per topic

**Workshop: "Home, walked."** One fixed room made by the generator. Grace
fills the window, the grade eases, the floor is wood and the room tone plays
(Translator W2/W5). You arrive the way the run ended (Translator R8, C-W2, my
W3):

- **Broken:** Still is put back together on the bench.
- **Stopped:** his eye relights.
- **Home:** he walks in himself.

Three things to walk up to:

- **a wall of parts**, with bare outlines for the unfound ones (Balancer W1,
  Translator M1). Here you pick the white he starts with and turn any part to
  face the wall.
- **a corkboard** of strain-line cards (Balancer W4).
- **the beam door.**

The kids are traces plus the doorframe. **About 5 evenings:** 2 for the room,
prompts and grade; 1–2 for the three arrivals; 1 for the wall and the board;
0.5 for the traces.

**Meta: "The wall fills."** The pool starts at 12 parts and opens through
Balancer M1's unfound channel. Parts are saved at pickup. Each part carries
one line of history (Translator M4, my M2). You can turn parts to the wall
(Translator M8, my M3). There's a short list of lit doors opened once by
moments, including new node flavours (my M4, Balancer M5). No currency.
**About 4 evenings:** 1 for a versioned, namespaced save module; 1 for the
pool and the "new" card; 1 for the history line and turning parts to the wall;
1 for the doors (the first two).

**Run: "Two Assemblers and the warm beam."** Six depths. The settled "node
map between areas" goes in the arena, where the only between-areas moment
is: after the first Assembler, two cold beams with floor glyphs (area
flavours: a pack-table weighting plus a grade tint, Balancer R4 and
Translator R4) and one warm beam (Home). After the second Assembler, only
the warm beam. Optional extras: the grade drifts across the run
(C-R1, keeping warmth for Grace) and cairns at the depths where past runs
ended (Translator M7, my R4). **About 4 evenings:** 1 for the warm beam and
the third ending, 1–2 for the flavours and glyphs, 1 for resuming at a beam.

## (e) Build order

0. His answers on `CATALOG.md` come first, as HANDOVER says.
1. **The Warm Beam** (1 evening). The run gets an end, and it needs no save.
2. **The save module** plus writing the run card when the ending *starts* (1).
3. **The findable pool**, saved at pickup (1).
4. **The Workshop room**, the wall and the board (3).
5. **The three arrivals** into the Workshop (1–2).
6. **Area flavours** at the arena beams, then resuming at a beam (2–3).
7. **The strain measurement**, then Wear only if it's needed. After that:
   history lines, doors and cairns, in any order.

That's about 12–13 evenings to a complete game loop.

## Summary

1. I'd back Balancer M1 with its pace and grind check, Translator's warm light and wood floor, and Balancer's strain-line keepsake.
2. The hidden costs are photo and crayon storage (a second save path), kid figures and the filling room (authored art), mid-run save migration, and exits on every level (layout work).
3. The kids' presence has no gate; only their parts are gated, and that's the owner's call. The run is 6 depths as one constant. Measure strain before building Wear. No "Sit down". Broken never loses parts.
4. Combined: "Home, walked" (about 5 evenings), "The wall fills" (about 4), and "Two Assemblers and the warm beam" (about 4), with the node choice as beams in the boss arena.
5. Order: catalog answers, the Warm Beam, the save, the pool, the Workshop, the arrivals, area flavours and resume, then measure strain. About 12–13 evenings in all.
