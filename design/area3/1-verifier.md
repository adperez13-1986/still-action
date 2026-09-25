# Round 1: the Verifier's pitches (area III)

Technical director's lens. I read the code before pitching: `areas.ts`,
`dungeon.ts`, `kit.ts`, `terrain`, `hazard.ts`, `boss.ts`, `arbiter.ts`,
`lobber.ts`, `thief.ts`, `enemy.ts`, `combat.ts`, `hide.ts`, `save.ts`,
`notebook.ts`, `music.ts`, `ambience.ts`, `sw.js`, `vite.config.ts`, and
`dist/`. Costs are vibe-coding evenings. The code goes fast. Tuning windups
on the Poco and getting the look right stay slow whatever the estimate says.

---

## What the code says before any pitch

1. **Every area lookup is keyed by depth.** `PLACE_OF[depth]`, `lookAt(depth)`,
   `areaOf(depth)`, `bossFor(depth)`, `DEPTH_DAY`, `DAY_SPAN`, `bandOf(depth)`
   in the notebook, `CAPS(d)`, and the lessons in `generateLevel`
   (`depth === 2` ram, `depth === 4` swarm, `depth === 4 && place.id ===
   'works'` heap, `depth === 5` Lobber). A third area, whatever the structure,
   needs a **route** axis next to depth. That's the first 1-1.5 evenings of any
   bundle, and it's the same work for a branch or an alternate.
2. **The beams have an invariant.** `ExitKind = 'cold' | 'warm'`, commented
   "INV: never a third", and `exitsAfterBoss` returns 1 or 2. A branch at the
   Assembler means three beams.
3. **The save mostly takes it.** `RunSnapshot` is passed through as stored,
   so an optional `route` field (absent means II) needs no migration. A third
   boss does: `PartHistory` is a positional tuple with the Arbiter count at
   index 6, and `RunTally` has named `assemblers` / `arbiters` fields.
   `bossDown` branches on `felled instanceof Arbiter`. That's a v2 to v3
   migration, the same shape as the v1 to v2 one, about half an evening.
4. **The download has 0.6 MB left.** `dist/` is 4,997,790 bytes. The K-H2 cap
   in `content/SPEC.md` is 5.6 MB. What things cost: an ambientCG pair at 512 px
   is 80-340 KB (Metal063 80 KB, Ground108 298 KB, Rock035 304 KB). A KayKit GLB
   is 30-150 KB. A boss is about 40-60 KB of JS. `sw.js` precaches the whole
   build at install, so area III is paid by every player on the first load,
   even players whose runs never go there. `loadKit()` loads every `PIECES`
   entry at boot, so each new piece adds boot time as well as bytes.
   **Primitives built in code and skinned with textures already vendored cost
   nothing.** That's the cheapest art route in this repo, and machines.ts has
   already proved it.
5. **A variant is cheap; a new `kind` is not.** The Lobber is
   `kind: 'ranged', variant: 'lobber'`, so its loot, budget and treasure
   follow the sentinel. A new `kind` fans out to `ELITE_MODS`, `TREASURE`,
   `KILL_WEIGHT`, `ROLE_OF`, `BE`/`kindOf`, the spawn switch and the names:
   about half an evening before any behaviour. Every enemy below is a variant.
6. **Hazards are static.** A `Hazard` is one circle or one strip that arms
   once. Anything that moves across the floor has to be a sequence of them.
   **Enemies don't avoid hazards**: nothing in `enemy.ts`, `charger.ts` or
   `swarm.ts` reads them.
7. **Terrain can grow solids, not floor.** `Circle.dead` flips a prop solid
   or open mid-fight (the Arbiter's husk does exactly this). Boxes have no such
   flag. The floor `Set` and its cached BFS fields are fixed for the level, and
   the BFS ignores props.
8. **The strain fix isn't built.** There's no pushed-hit break and no grill
   locks in `combat.ts` or `boss.ts`, only Parry's `interrupt()`. Right now the
   Arbiter's heat is the one designed push moment and the one route to
   Stopped. **A route that skips the Arbiter has to carry its own**, and every
   push pitch below works without step 1 and gets better with it.
9. **The notebook is full.** All 43 roster ids are assigned to a role, and
   only `echo-shell` is reserved. New pages either take over a blank page
   (the counts already on it come along) or the "an id from still's
   enemies.ts" rule gets relaxed. That's Adrian's call.

---

## Where area III sits

### My pick: the other road home, alternating by day

Area III replaces area II's depths 4-5 on alternate runs. Area I, the
Assembler at 3, the hours, the run length and both beams stay exactly as
they are. "Some days he goes home the other way."

- **Why not area I.** Area I is the tutorial every run plays: the one-part
  start, the ram lesson at 2, the thief. Swapping it swaps out onboarding.
- **Why not a branch, for now.** Two cold beams plus the warm one breaks
  "never a third". It also puts a second choice on top of the run's one real
  decision, at the same moment. And two cold beams look the same, so each
  would need a sign of where it goes. The code cost is nearly identical,
  though: the same `route` field, plus a second cold beam spot in the arena
  (about half an evening). If Adrian wants the choice later, it's a small
  upgrade, not a redesign.
- **Why not a deeper stretch past the Arbiter.** `hourAtEnd` gives night
  only to "home from the last depth", and `DAY_SPAN` promises nothing in a
  level reaches night: the square stops at first dark. A stretch past it
  either fights at night (making "home at night" a lie) or ends at night
  somewhere other than home. It also turns the Arbiter's warm beam, today
  "the only way out", into a quit button, and puts 35-minute runs on anyone
  who takes it.
- **The day needs no changes.** The hours are keyed by depth, so both roads
  go afternoon to dusk. Both roads meet in the quarter for the walk home
  (`WALK_PLACE` stays `'quarter'`). In the first milestone they also meet at
  the Arbiter's square, which is the 0-evening fallback for any area III boss.
- **Which run goes which way.** `routeFor(save.runs)`. Run 1 is always II, so
  the Lobber and heat lessons come first, and after that the roads alternate.
  `?route=III` for testing. The mites' lesson at depth 4 stays on both roads.

The data, since it's the load-bearing part:

```ts
export type RouteId = 'II' | 'III'
/** Depths 1-3 are the ruin on every route; only 4-6 vary. */
export const ROUTES: Record<RouteId, Record<4 | 5 | 6, PlaceId>> = {
  II:  { 4: 'works', 5: 'quarter', 6: 'quarter' },
  III: { 4: 'yard',  5: 'cutting', 6: 'quarter' }, // v0.1: the Arbiter's square; v0.2: 'roundhouse'
}
lookAt(depth, route); bossFor(depth, route); bandOf(depth, route)
RunSnapshot.route?: RouteId   // absent = 'II': no migration
RunCard.route?: RouteId       // the corkboard caption says which way home
```

While we're doing this, move the pack tables and lessons (`D4`, `D5`, `CAPS`,
the four `depth ===` lessons) into `PlaceDef.gen`. Then the next area is
data, not another round of `if` statements.

---

## The area

### A1. The Yard (surprising)

The freight yard behind the Works, at the end of the day. The ore tubs are
still running on a timetable nobody is left to keep. Rails cross the rooms.
Every 9-12 s a short rake of tubs comes out of the fog, runs across the room
and goes back into the fog. Before it comes, the rails sing, a signal lamp
beside the gap in the wall goes ember, and the lane lights for 1.1 s. The
tubs hit anything on the track, Still or enemy. Depth 4 is the sidings: one
lane across some rooms. Depth 5 is **the cutting**, where the line leaves
the yard, and some lanes run along corridors. A corridor with a lane is a
door that opens on a clock without being a door: you wait at its mouth or
you run it. **What the player does:** reads a clock that belongs to the
level, not to him or to the enemies, and uses it by shoving a hulk onto the
rails as the tubs arrive, or baiting a ram across them. **Why it fits
Still:** machines still doing their jobs for nobody, and the symmetric rule
made into a place. Nothing in the game has changed how the level behaves
before, and this changes it without touching terrain.

- **Code.** A train is 5 strip `Hazard`s, one per 4-u segment of the lane,
  each arming as the rake reaches it. Drawn = hit holds segment by segment.
  It's a new `HazardSource: 'train'`, with `hurt: 'hazard'` and `cover:
  'none'`. Rails, sleepers, tubs, buffer stops and signal posts are all
  primitives on `Metal063` and `Planks023A`, both vendored. The ballast is
  `Ground108` (vendored), or `Gravel023` if the look test asks for it. A lane
  runs across one room at a time, entering and leaving through a gap in the
  barrier into the fog. So there's no global alignment in the layout, and the
  floor edge still blocks movement at the gap. Packs never sleep on a lane.
  Trains only run in a room that is awake or has Still in it.
- **Two rules the code needs.** (1) A train books its lane lock through
  `ctx.book`, so the "committed locks 300 ms apart" rule holds against rams,
  sentinels and broods. The timetable slips by up to 300 ms, and it's
  committed once the lane shows. (2) The brood's steering treats a lit lane
  as no-go. Otherwise one train deletes a swarm and undoes the "one Vent
  can't" rule. Hulks don't dodge, which is the point.
- **Starting numbers.** Lane half-width 0.9, tell 1100 ms (the slack rule
  asks for at least 614), 12 u/s, 3 tubs, 14 damage and a 2.5 u shove along
  the track. Two trains don't kill a full hulk (28 against 30), so the yard
  can't do the fight for him.
- **Sound and light.** A rising ring in the rails, panned: a second telegraph,
  like the windup tone. Wheel clack, and a far cold whistle. The signal lamps
  are ember because they're tells. Everything else stays cold.
- **Cost:** medium. About 2 evenings for the kit and lane placement, 1.5 for
  the trains, the booking and the brood rule. **+0 to 0.25 MB.**

### A2. The Substation

The old power house that fed the Works. Cables run across the floor between
junction boxes. Every ~7 s a pulse runs along each cable as an ember bead
at walking pace, and it discharges at every junction it reaches (a circle
hazard, r 1.2). The junction boxes are breakables, so any hit from either
side breaks one: a ram rushing into it, a Lobber shell, Still's Cleaver.
Once a box is broken, everything downstream of it goes dead for the level.
**What the player does:** edits the level by choosing which circuits to
kill, and the enemies edit it too, by accident. **Why it fits Still:** the
old roster's electrical names finally have a home (Conduit Spider, Wire
Jammer, Static Frame, Feedback Loop).

- **Code.** Cables are floor decals at `DECAL_Y`. The boxes are the existing
  `Breakable`. A pulse is a sequence of circle hazards.
- **Colour risk.** Electric blue is the obvious look, and it's Still's
  colour. The pulse has to be ember, and "fire in a wire" is a little less
  natural.
- **Cost:** medium, about 3 evenings. **+0.4-0.6 MB** (`CorrugatedSteel007A`,
  `Concrete034`, and `wall_gated` is already vendored). That puts the download
  at the cap.

### A3. The Allotments

The town's gardens at the edge of the quarter, dug and then left. The cover
is raised beds (waist-high planter boxes), water butts, cold frames with no
glass, and potting sheds standing beyond the edge. Soil underfoot, wood
underfoot near the sheds, and wind in dry stalks for the room tone. Nothing
about the level behaves differently. It's a place, not a mechanic.
**Why it fits Still:** things were grown here, the way he's being built,
and it's the softest ground on the road home. **Guard:** the same rule as
the quarter's "no cot": no swing, no toy, no child-sized anything.

- **Code.** The beds are boxes skinned with `Planks023A`, the soil is
  `Ground108`, and the butts are `barrel_large`: all vendored. Beds must be
  full waist-high cover. Low beds would be the "stops bodies, not shots"
  cover that was cut because a phone can't tell it from stone.
- **Cost:** cheap, about 2 evenings. **+0 to 0.25 MB** (`Grass004` or
  `ScatteredLeaves009` if the look test wants them; both IDs were confirmed
  in the area II round). It's the budget choice if A1 doesn't land.

### Looked at and dropped

- **A cold store or ice works.** Frost and pale blue are Still's colours. A
  cold area dilutes the one read that has to stay clean.
- **The canal, or a sluice that floods.** It's slow water under another name
  (cut in the area II round). Flooding also needs a mutable floor, meaning a
  rebuilt BFS field and water-edge tells on a 6-inch screen.
- **A market whose shutters fall behind you.** Boxes can't toggle, circles
  can, so it's buildable. But it only stops backtracking, and the beam
  already does that.

---

## The boss

All three meet the `BossDef` invariants: 900 HP, at most 22 per hit, no
windup under 620 ms.

### B1. The Shunter (surprising)

A squat shunting engine in the roundhouse yard at dusk, on a rectangular
loop of track, with two sidings ending in buffer stops at the arena wall.
It can't leave the rails, so its path is always drawn. What you read is
*when* and *how fast*: the straight it's about to take lights as a lane.
- **Moves.** It runs the loop, hitting whatever is on the track (22, melee,
  so the Anvil can catch it). It stops at the coal stage and blows steam
  sideways (the Arbiter's scald). It kicks loose tubs down a siding or across
  the middle (hazard strips, the ram's lane without a body). In phase 2 it
  runs both ways, with a whistle judder before each reversal (the Arbiter's
  judder pattern).
- **The reason to push.** When it commits to a straight that ends in a
  junction, that junction's **points lever** lights ember for 1.4 s. A cast
  that lands on the lever throws it. The engine runs into the siding, hits
  the buffer and stands stunned for 1.8 s with its firebox door open (×1.5).
  A 1.4 s window against cooldowns of 2.6-6 s means the lever usually wants a
  push. Skipping the levers only makes the fight longer, the same deal as the
  grill locks. Throw it at the wrong moment and you've routed the engine into
  the siding you're standing in.
- **What it tests.** Reading a route and acting on the level instead of on
  the body. The Assembler tests position against a big body. The Arbiter tests
  sightlines and heat.
- **Why it fits Still.** A machine still doing its job at the end of the day,
  and Still beats it by throwing a switch, not by out-hitting it.
- **Code.** A track-bound mover is simple: a distance along a polyline. The
  loop is rectangular so every lane is a straight `LaneTell`. The arena is a
  new layout in the 28 u room. `pickTarget` returns an `Enemy`, so the lever
  needs a small special case: *a cast aims at a lit lever when Still is
  within 3 u of it; the auto never does.* Standing at the lever is the
  intent, and it lets head bolts throw it too. The engine is about 2.8 u tall
  and long, so on the near straight it takes the Arbiter's `seeThrough` fade.
- **Body.** Gloss lamp-black enamel chipped to bright iron at the edges. It
  gets told apart by shine: every other dark hide is matte or oily. The
  firebox is its ember core.
- **Cost:** big. About 4.5 evenings (mover and lanes 1, arena and levers 1.5,
  moves and phase 2 1, body and sound 1), plus half an evening for the save
  v3 tally. **Fallback, 0 evenings:** the Arbiter in the square, where the
  roads meet.

### B2. The Yardmaster

A signal box on four legs at the far side of the arena. It doesn't run
trains itself. It routes the yard's trains across the arena at Still, the
Signalman at boss size. While any of its four signal posts at the arena's
corners is lit, it's **sealed** (hits land at a quarter), borrowing the
Warden elite's dark-ember "sealed" look. A cast knocks a post dark (the auto
doesn't). The posts relight 6 s after the first goes dark. All four dark at
once opens the box for 4 s at ×1.5. **The reason to push:** four casts at
four corners inside 6 s, with trains crossing the ways between them.
**What it tests:** routing across the whole arena under a clock.

- **Code.** Reuses A1's trains, `summon` for relighting the posts, and the
  `sealed` look from `combat.ts`.
- **Risk.** Seal phases can feel like being told "no". A quarter damage,
  never zero, is the softest version of it.
- **Cost:** medium, about 3 evenings once A1 exists.

### B3. The Double-Header

Two small engines coupled, 450 HP each. At 55% they uncouple and work the
loop from both ends. Kill one and the other takes over its best move. Kill
the second within 6 s of the first and it never does, and that burst window
is the push demand. It tests target priority, which nothing else does.
**Honest cost:** big, about 5 evenings. `combat.boss` is a single
`Boss | null`, and the boss bar, `bossDown`, the camera threats and the
music's boss state all assume one. **Not recommended**: the refactor buys one
boss.

(The Pourer, parked from area II, still fits a foundry or the Substation
better than the Yard. Its slag walls work as circles placed dead and set
alive. Because the BFS ignores circles, enemies would press against the new
walls rather than path round them, so it would need tuning.)

---

## The monster set

All of them are variants (point 5). Area II's rule was at most two new
mechanics per area: here the trains are one and the Signalman is the other.
The Rake and the Sleepers are faces on existing rules. The Winch is parked.

| | enemy | what | body (`hide.ts`) | tell | asks | cost |
|---|---|---|---|---|---|---|
| M1 | **The Signalman** (surprising) | sentinel variant, `variant: 'signal'`. It never attacks. | **creosoted timber** with iron straps: tar-black brown wood, rough 0.9, metal 0.1, the grain streaked tall. The first body that isn't metal. | a semaphore arm swings up over 900 ms, its ember lamp rising with it | break it or kill it (22 HP, stands still) before the arm is up, or it **calls the next train early** onto the lane nearest Still (+1.1 s tell as usual). With no lane within 8 u it doesn't call. | cheap, 1 evening, needs A1 |
| M2 | **The Rake** | ram variant, `variant: 'rake'`: a ram pulling two ore tubs | the ram's olive bronze, with tubs in the Signalman's timber | the ram's rails, and at the lock the lane draws long, with two tub marks | the tubs follow the rush 250 ms and 500 ms behind as strips down the same lane: **step off sideways, never back**. Stunned on a wall, its own tubs concertina into it (12 damage to it) and the hatch stays open 1.8 s instead of 1.2. BE 2. | cheap, 1 evening |
| M3 | **The Sleepers** | a new face on the brood, like the slag heap | coal mites, unchanged | a brood asleep as a row of sleepers between the rails, the embers in the gaps | the same mites. A train passing over them never wakes them (no chain-waking); Still coming near does. | cheap, 0.5 evening |
| M4 | **The Winch** (parked) | sentinel variant, `variant: 'winch'` | **lead**: matte, soft, a warm dark grey with a brown cast, lighter than the hulk's soot | the sentinel's aim line, as a hook's line, then the hook flies | if it hooks, Still is reeled 3 u toward it over 1.2 s (the existing `pull`). Walls cut the line both ways; any cast on the winch snaps it. Winches sit across a lane from their pack, so the reel runs over the rails. | medium, 1.5 evenings |

- **The Signalman is where "a pushed hit breaks the wind-up" gets taught.** It
  doesn't walk, its windup is long and readable, and breaking it is worth a
  whole train. Without step 1 it still works: Parry Clamp breaks it, and so
  does killing it.
- **Hide check.** Timber is new ground under the rule "not pale, not cold,
  not saturated red or orange". It might sit too close to the thief's rust
  brown, so look-test it in the graded game. Lead is kept brown-grey on
  purpose: a blue-grey lead drifts toward Still.

---

## Parts: made useless or too strong

- **Better, which is good:** Pressure Vent, Piston, Backdraft Vent, Rusted
  Hook, Clamp Toss and Skid Plates. The shove parts get a job beyond "away
  from me". Chill Vent plus a train (they stay on the rails) is strong but
  situational. Parry Clamp gets the Signalman.
- **Watch:** **Lure** (T7). A decoy dropped on a lane walks the pack into the
  tubs. It's one gold and situational, so I'd leave it. **Clamp Toss** onto a
  lit lane is a sure 14. Fine at 30 HP.
- **Does nothing here, as with slag:** Ward and Mirror Ward against trains
  (`warded` stays false), and Anvil against tubs (they're a hazard). Anvil
  does catch the Shunter itself (melee).
- **Nothing is made useless.** A head-only loadout at the Shunter can still
  throw levers, because of the 3 u lever rule.

## Push demand, per pitch

The strain round found that only an opportunity with a clock shorter than
your cooldowns creates demand. A clock that belongs to the level is the
cleanest source of that, because it's never in phase with your buttons.

| pitch | where the push is wanted | about how often |
|---|---|---|
| A1 the Yard | a body on the rails 0.5 s before the tubs, and your shove part cooling | about 1 a fight at 2-3 trains a fight: inside the free band |
| M1 the Signalman | break the arm in its 900 ms | about 1 a pack that has one |
| B1 the Shunter | the lever's 1.4 s | every lap, by choice. No quiet in a boss fight, so it's a real bet: this is where Stopped lives on route III |
| B2 the Yardmaster | four corners inside 6 s | each opening |
| A2 the Substation | a box before the pulse reaches your junction | low |
| A3 the Allotments | none | none |

---

## The recommended bundle

**Area III is the other road home, alternating with area II: the Yard and
the cutting at depths 4-5, the Signalman and the Sleepers, and the Shunter
in the roundhouse at 6.** The Rake comes last. The Winch is parked.

| step | what | evenings | playable after |
|---|---|---|---|
| 0 | the `route` axis; pack tables and lessons moved into `PlaceDef.gen`; `routeFor`, `?route=III` | 1.5 | nothing yet |
| 1 | the Yard and the cutting: rails, tubs, buffers and signals from primitives; lanes per room and per corridor; gaps in the wall | 2 | **v0.1:** route III, trains off, the Arbiter at 6 |
| 2 | trains: segment hazards, timetable, `book`, the brood's no-go, sound | 1.5 | the level has its own clock |
| 3 | the Signalman, the Sleepers; room tone (music reuses area II's chords) | 1.5 | **v0.2:** the area complete, with the Arbiter at 6 |
| 4 | the Shunter, its arena and levers; save v3 (`PartHistory` index 7, tally `shunters`) | 5 | **v1.0:** route III has its own boss |
| 5 | the Rake | 1 | more variety |

**About 12-13 evenings.** The download goes from 5.0 MB to about 5.1-5.3 MB,
under the 5.6 MB cap, because nearly everything is primitives on textures
already in the repo. v0.2 is the safe place to stop: a whole second road home
for about 6.5 evenings, with the Arbiter as its boss.

**Why this one.** It's the only area pitch that changes how the level
behaves without touching terrain or pathing. The same system (the trains)
carries the area, one enemy and the boss, the way slag carried area II. It
makes push demand from the world instead of from new rules. It keeps the run
at 6 depths and 26 minutes, keeps the beam invariant, and costs almost
nothing to download.

## Open, Adrian's

1. Alternate or branch. The data is the same; a branch means a third beam.
2. Which road run 2 takes, and whether the Workshop shows which way is next.
3. The notebook pages for the Signalman, the Sleepers and the Shunter:
   take over blank old-roster pages (Signal Jammer, Conduit Spider, Iron
   Crawler, ...) or add new names.
4. Whether K-H2 stays at 5.6 MB. This bundle fits; A2 on top wouldn't.
5. Names: the Shunter, the Yard, the cutting and the roundhouse are
   placeholders.
