# Round 2: the Verifier

I read all four round-1 files and checked what matters against the code. I'm
assuming step 1 (a pushed hit breaks the wind-up) exists. Costs are
vibe-coding evenings.

## (a) Placement: a branch that keeps the rule, via a crossroads

**What "never a third" protects:** the Assembler's fork, *on or home*, as the
run's one binary decision, with Grace leaning home. In code, `exitsAfterBoss`
is the only place the fork is decided, over a closed type (`meta/SPEC.md`
decision 3), and `Level`'s single `exit`/`home`, `beamArmed`, the walk-in
checks, the lean and resume are all written for two. A three-beam yard
(translator, Claude) breaks both.

**Forking one beat later keeps it.** The yard stays *on or home*. The cold
beam leads to **a crossroads**: a quiet 3x3 room with no enemies and two cold
beams dressed by place (the Works' in a `wall_gated` frame with soot, the
Line's with a signal lamp and rails), with the place's name fading up as
Still nears. There's no warm beam and no lean, because this isn't the
growth/comfort fork.
- **When it opens:** once an Assembler has fallen in an earlier run; until
  then it's skipped. The balancer's "menu, not a dilemma" is true and fine:
  the roads ask different questions (the HP road and the strain road).
- **Cost:** about 1 evening over the `route` axis: a tiny generator like
  `generateWalkHome`, plus `RunSnapshot.route: RouteId | null` (null resumes
  at the crossroads). Still 6 depths and about 26 minutes.
- **Flagged: chosen for Adrian.** The fallback is my round-1 alternate, a
  one-line `routeFor(save.runs)` on the same data.

## (b) One train boss: the Engine

- **Kept:** one low engine on a loop, from all four. The loop is **8
  straights** (a cut-corner rectangle), because `Quads` and `Hazard` strips
  are straight; the balancer's circle needs a curved hazard. The lit track
  1.3 s ahead is the tell, and unlit rail is safe.
- **The opening:** a **points lever** (translator, Claude, me). The engine
  hits the siding's buffer and stands 1.8 s with its firebox open ×1.5. A
  cast within 3 u throws it, never the auto.
- **The ask:** the translator's **departure board** names the slot the next
  lever wants: the grill lock made diegetic, and about 5 asks. Fall back to
  "any cast" if it frustrates.
- **Moves:** the balancer's whistle cone (950 ms, inner walls as cover); in
  phase 2, a 600 ms judder before each reversal, and an uncoupled wagon down
  a spur. No adds.
- **Cut:** shoved rolling wagons (a new moving solid, and it locks out builds
  with no shove), the signal-box body, the coal lobs.
- **Body and cost:** gloss black enamel chipped to iron, with the Arbiter's
  see-through fade. 4.5 evenings plus 0.5 for save v3 (`PartHistory` index 7).
  Fallback: the Arbiter.

## (c) The bell stroke on top of trains: no

The bytes are cheap (`impactBell_heavy` is vendored, and `beatClock()`
exists), but the stroke hits what *moves* while a `Hazard` hits what's
*inside*: that's a new hazard kind and a halt override in every archetype. On
a lit rail it contradicts the train, and it's a third level-wide clock over
the two-mechanic cap. **Keep** the station clock striking the hour on
arrival, as sound only (0.25 evening). **Park the stillness set whole**
(stroke, Watcher, Hour) for its own area: it's the most *Still* idea here.

## (d) Monsters: three, plus one later

- **Signalman** (me, which is Claude's Flagman): a sentinel variant that never
  attacks; its 900 ms semaphore windup calls the train early. Creosoted
  timber. It's the cleanest step-1 lesson.
- **Handcar** (balancer): a ram variant on a 12 u siding between buffers. It
  always stuns, far off, so a pushed Lens is the ask. Lead, a matte
  grey-brown. It teaches the Engine's buffer stun at depth 4, and it replaces
  my Rake.
- **Ballast mites** (me, Claude): a face on the brood. Coal, 0.5 evening.
- **Later:** the Porter (balancer), a thief variant in oxidised zinc.
- **Cut:** the Linesman, the coupled pair, the Rake (two-body coordination),
  the shield Porter (directional cover is a new rule), the Winch.

## Where I changed my mind

1. From the alternate to the crossroads.
2. **Idle enemies step off lit rails; committed ones don't** (balancer,
   translator), or the train does the fight. One nudge in `Combat`, about an
   hour.
3. **A period per line of 16-22 s, 2-3 lines a level.** My 9-12 s a room
   doubled the trains, taking the spender's Stopped from ~17% to ~45%.
4. **Depth 5 is the station.** Trains don't block shots. The timetable comes
   from the level seed (Claude).

Also cut, against the code: Kenney's Train Kit (primitives are 0 KB), the
Sorting Office (a velocity field on every mover), the Reservoir, the Couplers,
the Band and the Double-Header (`combat.boss` is one `Boss | null`), the
Conductor (Bluetooth lag), and the glasshouse (pale glass next to Still).

## Final bundle

**Crossroads + the Line (goods yard at 4, station at 5) + trains + Signalman +
Handcar + ballast mites + the Engine at 6.**

| # | step | ev | playable after |
|---|---|---|---|
| 0 | `route` axis; pack tables and lessons into `PlaceDef.gen`; crossroads; `?route=III` | 2.5 | the fork |
| 1 | yard and station kits: primitives, one gravel set, lines per room and corridor | 2.5 | |
| 2 | trains: segmented strips, lit rails, horn, `book`, step-off, sound | 1.5 | **A:** road III, Arbiter at 6 |
| 3 | Signalman, Handcar, ballast mites | 2.5 | **B (safe stop):** the whole road, with the Arbiter where the roads meet |
| 4 | the Engine, levers, board; save v3 | 5 | v1.0 |
| 5 | Porter; station clock | 1.25 | |

**About 15 evenings, 5.0 to about 5.3 MB** (the cap is 5.6). Stop B is about
9 evenings, with nothing half-built.

## What the spec must settle

1. `ROUTES`, and the crossroads' layout, opening moment and resume; the route
   on the card; the v3 migration.
2. Trains: period, tell (1.1-2.5 s), half-width (0.9-1.3), damage (I'd set
   18), shove; segmented strips or a moving kind; booking against the 300 ms
   rule; "committed" per archetype.
3. The Engine's geometry, the lever's `pickTarget` case, the board's slot
   rule, the ask count. Whether hops clear hazards (I'd say no).
4. Hides in the graded game (timber, lead, enamel, zinc); notebook band `III`;
   music; the walk home (the quarter, or the empty tracks for +1 evening).
5. Parts to watch: Lure on the rails, Backdraft's pack wipes, Clamp Toss.
