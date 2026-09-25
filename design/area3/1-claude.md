# Round 1: Claude's pitches (the fourth voice)

## Where it sits

**C-W. A branch, "the long way round".** After the Assembler, two cold beams
instead of one: the familiar way (the Works, the quarter) and the long way
round. Both are depths 4–5 plus a boss at 6, both afternoon into dusk, both end
at the same house. The run stays 6 depths and about 26 minutes; the choice is
made once, at the moment the run is most alive, and replays stop being the same
second half. The beams need one line of difference a player can read: the new
one could be tinted by its place (a tell of its own light), and the notebook
names it after the first visit. *Cost:* cheap for the fork (a second cold beam
in the Assembler's arena; `exitsAfterBoss` returns three kinds), medium for the
save (which way a run went).

## The area

**C-A1. The yard, where the line comes in.** A rail yard at the edge of the
city: ballast, sleepers, carriages dead on sidings, signal gantries. **The level
moves on a timetable:** on a few tracks per level, a runaway cart rolls through
on a fixed, visible schedule. The rails hum and a lamp on the gantry above the
track counts down in ember before it comes. A cart hits everything on the rails,
Still and enemies alike, and stops for nothing. So a track is a lane you cross
between carts, and a place to hold a pack while the cart comes. Carriages on the
sidings are cover you can walk round but never shoot through. *Surprising:* the
timetable is the same every visit to a given level seed, so a level can be
*learned*. *Cost:* medium-big: Kenney's Train Kit (CC0) for rails and wagons,
a moving hazard on the `Hazard` primitive, a new generator preset. Check the
download budget.

**C-A2. The glasshouse.** A collapsed botanical glasshouse, overgrown: iron ribs,
broken panes, beds of dead plants. Light comes down in hard shafts through the
panes that are left, and the fog is thinner under glass. Broken glass on the
floor is loud, so walking over it wakes sleeping packs (telegraphed as a
glittering strip). *Cost:* medium, mostly kit and light.

## The boss

**C-B1. The Switchman** (for the yard). A signal box on legs in the middle of a
junction arena, levers in its chest. It doesn't chase: it throws points and sends
carts down the tracks at you, one track lit at a time, then two. The arena's
junction has **levers at its edge that Still can throw too** (a hit throws one):
route a cart into the box and its shell cracks open for 1.2 s. The lever only
counts if it's thrown in the last 0.6 s before the cart passes the points, which
is shorter than most cooldowns, so the push is how you make it. Phase 2: it
switches the points back at you if you're slow, and the tracks multiply. It tests
reading a moving map and timing, which neither the Assembler (a body) nor the
Arbiter (a sweep) asks for. *Cost:* big (a new arena, carts, levers, the rig).

**C-B2. The Choir** (for the glasshouse). Three small bell-machines hung in the
glass roof, each ringing a note that makes the floor under it hum and then burst.
They ring in a sequence; learn the order and you can stand where the next note
isn't. Hit a bell while it's winding up and it rings early and cracks the next
one. *Cost:* medium.

## The monster set (the yard)

- **The coupled pair.** Two small wagons chained together: the chain between
  them is the threat, swung across you as they separate (the chain glows ember
  along its length before it pulls tight). Kill either and the other drags the
  dead one. Body: blackened steel. *Asks:* read the gap, don't stand between.
- **The flagman.** A thin figure with a lamp that never attacks. It waves the
  lamp over a track, and that calls a cart early on that track. Kill it first,
  or fight away from the rails. Body: tarred wood and iron. *Asks:* a priority
  target with a visible clock. Push demand: the wave is a 1 s wind-up worth
  breaking.
- **Ballast crawlers.** Mites that sleep under the stones between sleepers,
  shown only as a shiver in the gravel. Body: dull slate. A variant of the mites,
  cheap.
- **The porter.** A hulk variant pushing a crate ahead of it as a shield: shots
  from the front stop on the crate (symmetric cover). Flank it, or shove it onto
  a track. Body: brown-black oak and iron bands.

## Bundle

C-W (the branch) + C-A1 (the yard with its timetable) + C-B1 (the Switchman) +
the coupled pair, the flagman and ballast crawlers. It's the most "the level
does something" of anything pitched so far, it puts timing and routing where the
first two areas put cover and bodies, and the levers and the flagman give the push
a job.
