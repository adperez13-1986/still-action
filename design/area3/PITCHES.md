# Pitches: a third area, its boss, its monsters

25 Sep 2026, while you were away. Same process as before: four voices
(balancer, translator, verifier and me), two rounds; raw rounds in this folder,
brief in `BRIEF.md`. You asked us to be creative and decide, so the calls
below are made for you and flagged. Each has a cheap fallback.

---

## The road: the Line

Three of four voices pitched a rail yard on their own, and the fourth had it as
runner-up. **The Line** is where the city's rails come in: sidings, ballast,
dead wagons, signal gantries at depth 4; a goods station at depth 5.

**The level moves on a timetable.** On a few tracks per level, a train runs
through on a fixed, seeded schedule. Its two rails light 2.0 s before (committed
for the last 1.2 s), the rails hum, and one short buzz fires only if Still is
standing on a lane about to go. A train hits everything on the rails, Still
and enemies alike: 20-22 damage and a shove along the track. Idle enemies step
off lit rails; committed ones don't, so you can hold a pack on a track while
the train comes. Mites avoid lit lanes, or one train deletes a swarm. Each line
runs every 16-22 s, and a level's timetable is the same each visit, so it can
be learned. The first train of the area is harmless: the lesson.

It's built from the existing floor `Hazard` and primitives on textures already
vendored, so the download grows by about 0.1-0.3 MB (5.0 to 5.3 MB, under the
5.6 MB cap).

## Where it sits (decided for you): a crossroads after the Assembler

- The Assembler's yard stays exactly as it is: **on (cold) or home (warm).**
  That's still the run's one real decision.
- Choosing *on* now leads to a quiet **crossroads**: a small room with no
  enemies, no warm beam and no lean, and **two cold beams**, each dressed for
  its road. One goes to the Works and the quarter (as built) and the other to
  the Line.
- The run stays 6 depths and about 26 minutes. Both roads end at the same
  house at night.
- **Why a choice, not a rotation:** the balancer's model shows the roads cost
  different things. Area II is the HP road (Lobber, slag), and the Line is the
  strain road (trains and levers ask for pushes). A spender who reaches
  depth 6 arrives at about 3.6 strain on the Works road and about 6 on the
  Line, and is Stopped ~7% against ~17%. So the crossroads is a real choice
  about how you want the afternoon to go.
- **Why a room, not a third beam in the Assembler's yard:** a third beam next
  to "go home" would dilute the go-home decision. The code also relies on
  "never a third" beam.
- **Fallback:** alternate the roads by run (the translator's and my round-2
  pick) with the Assembler's cold beam showing which road is next. It's a
  one-line change on the same data.

## The boss: the Engine

One boss, merged from four pitches (the balancer's Engine and Shunter, the
verifier's Shunter, my Switchman, the translator's Last Train):
- **A low engine running a loop** of straights round the yard arena. Unlit
  rail is always safe. Its whistle, a cone ahead of it, is its wind-up.
- **Points levers at the arena's edge.** A lever lights every other lap, for
  1.4 s. Throw it with any *ability* cast within 3 u (never the auto) and the
  engine runs into a buffer siding: stunned 1.6 s, open ×1.5. A wrong throw
  routes it into your own siding.
- **The boss bar is a departure board.** It names which lever is next and
  when, in the game's own type, readable without looking away from the arena
  for long.
- **Phase 2:** it reverses, a wagon rolls down a spur onto the loop, and if
  you're slow it throws a lever back against you.
- The lever window is shorter than most cooldowns, so it's the fight's push
  ask: about 5 asks and 85-100 s. With strain step 1, a pushed hit on the lever
  is the natural answer.
- HP and damage stay in the existing range. It tests reading a moving map and
  timing, where the Assembler tests a body and the Arbiter tests a sweep.
- **Fallback:** the Arbiter at the end of the Line, too. That's the verifier's
  safe stopping point (the whole road, about 9 evenings).

## The monsters

1. **The Signalman.** A thin figure in creosoted timber, the first non-metal
   body. It never attacks. It waves its lamp over a track (a 900 ms wind-up),
   and that calls a train early on that track. Kill it or break the wave. It's
   the area's lesson for "a pushed hit breaks the wind-up".
2. **The Handcar.** A ram on rails. It always stuns at the buffer, 6-12 u away,
   so the rails show where it will go. Its tell has to read differently from
   a train's lit rails. The translator cut it over exactly that risk, so the
   spec has to settle it.
3. **Sleepers.** Mites asleep under the ballast, shown as a shiver in the
   gravel. Slate-dull bodies. They're cheap.
4. **Later: the Porter.** A thief-bodied machine that carries a crate onto the
   rails before the train smashes it.

---

## Parked (whole, for a fourth area)

**The old town under the clock** (translator): a bell stroke every ~20 s that
hits only what's moving; the Hour, a bell boss in the square; the Watcher, the
Winder and tick mites. It's the best single idea of the round, but on top of
trains it would be a third new mechanic in ten minutes of crawl, and its rule
("stand still") contradicts the train's ("step off"). It deserves its own
area. The Line keeps one piece of it: the station clock striking the hour, as
sound only.

Also parked: the Glasshouse, the Reservoir, the Sorting Office's conveyors,
the Couplers, the Linesman, the Conductor (moves on the music's beat).

## What you're owed a say in

- **The crossroads, or the alternate.** Either works on the same data.
- **The Handcar,** once you've seen its tell on the phone.
- **The names:** the Line, the Engine, the Signalman. They're placeholders,
  like the Arbiter was.

## Build order

The verifier's stages; the spec is `SPEC.md` in this folder.

| stage | what | about |
|---|---|---|
| A | the route field, the crossroads room, the Line's kit and generation, trains | 5 evenings |
| B | the Signalman, Sleepers, the Handcar; the Arbiter as the Line's boss | 4 evenings |
| C | the Engine, its board, save v3 | 5 evenings |
| D | the Porter; tuning | 1 evening |

Stage B is a complete road you can play from end to end. That's the safe place
to stop.
