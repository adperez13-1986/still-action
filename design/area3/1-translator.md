# Round 1: Translator (what you see, hear and do, on a 6-inch phone)

Pitches, not a spec. Each one has a name and a few sentences, then **You**
(what you see, hear and do), **Push** (what it does for the strain problem),
**Why** (why it fits Still), **Parts** (which of the 30 it makes useless or
too strong), and **Cost**. Cheap means an evening or less, medium two or
three, big more than that. *Surprising* marks ideas that no earlier document
has.

Screen scale, as in the earlier passes: a unit is about **23 px at zoom 1 and
16 px at the widest zoom (0.7)**. A landscape Poco view is about 17 u tall
and 37 u wide at zoom 1, and 53 u wide at 0.7. Every size below was checked
against 16 px/u, because that's the zoom a crowded fight is played at.

Four rules shaped every pitch. If you reject one, the pitches built on it go
with it.

1. **Dusk never warms** (unchanged from area II). The only warm things on
   screen are Grace's light and enemy embers.
2. **Silhouette first, ember second, motion third.** A new body must be
   nameable at 16 px/u with its core dark.
3. **Rule R** (from the enemies pass): *if your feet are on ember, you're
   hit.* One exception is proposed below, and it's the heart of the bundle:
   the stillness ring, where your feet on ember are safe **if they aren't
   moving**. It's flagged wherever it's used.
4. **A push demand has to come from an opportunity or from taking walking
   away.** The strain pitches showed that walking answers every threat, so
   a threat alone can't ask for a push. Every pitch here says which of the
   two it does, and how often, and most of them lean on the agreed step 1
   ("a pushed hit breaks the wind-up it's aimed at"), **which isn't built
   yet**. Where a pitch needs step 1, it says so.

---

## Topic 1: The area

Every area here comes after the Assembler at noon and runs afternoon into
dusk at depths 4 and 5, like area II, so the day doesn't change. Where it
sits is argued in Topic 4.

### A1. The old town, where the hours are rung *(surprising; my pick)*

The old part of the city, under a clock tower. Streets of cobbles, arcades
of columns, shop fronts with their shutters down, a market that packed up
hours ago. The tower stands in the fog at the top of the screen in every
room (the camera never turns, so north is always the tower), and its clock
face shows the in-game hour: the hands move as the day moves with you. **The
level behaves:** every 20 s or so the tower's bell strikes, and the stroke
rolls across the whole level as a band of lifted dust and ember on the
floor. **Anything moving when the band passes through it is hit** (8, and a
short stagger). Anything standing still, Still or enemy, lets it pass. The
town's machines know the bell. Idle and approaching enemies stop dead at the
stroke like people at a crossing, and only a committed body (a ram
mid-rush, a mite brood mid-bite, a Winder crossing the room) gets caught.

- **You:** At the start of each level, while you're still arriving, the
  tower strikes the hour: four strokes at depth 4, five at depth 5. The
  bands pass through Still harmlessly while he stands. That's the lesson,
  given before anything can hurt you. After that you hear the stroke coming:
  the bell's hum swells for about 1.5 s. You see it coming: the band enters
  from the top edge of the screen and crosses toward you at 14 u/s, so from
  the screen edge to Still is 1.3 s at zoom 1 and 1.8 s at 0.7. You feel it:
  a soft double buzz 400 ms before it reaches you. You lift your thumb off
  the stick, the band passes, and a cold shimmer runs up Still's body with a
  clean high overtone. If you were walking you get a dull clank and a jolt
  instead. The band is 1.4 u thick (22-32 px), drawn with `tellMaterial`, so
  it's textured dust, not a flat line.
- **Standing still must feel strong, not Stopped.** At the stroke Still
  plants himself: his bird legs flex, his lens lifts toward the tower, and
  his core brightens a touch. Nothing drains colour and his eye never dims.
  That's the opposite of the Stopped ending's look, deliberately.
- **Push:** *takes walking away*, for about half a second, one to two times a
  fight. At the stroke you can't step out of a sentinel's line or a hulk's
  slam ring, so a wind-up that lands during the stroke has three answers:
  cover you already stood behind, taking the hit, or a pushed hit that breaks
  it (step 1). A rough count: a stroke every 20 s, fights of 25-40 s, and a
  wind-up aimed at you inside the stroke about half the time, so roughly
  0.5-1 asks a fight. That's the free band the balancer wanted, not more. It
  also makes opportunities: bait a ram so its rush crosses the stroke, and
  the stroke stops it cold in the open (stunned and open, as if it had hit
  a wall).
- **Why:** The robot is called Still. This is the one place in the game that
  asks him to be it. It's also the day, told aloud: you hear the hour struck
  when you arrive, and the clock face is always there.
- **Mood and sound:** pigeons that burst off a ledge when a pack wakes (a
  second wake cue, and cheap), a fountain in one room, the shutters rattling
  in the draft, the bell's long hum under the music. The stroke replaces the
  music's downbeat for one bar (the music ducks and the bell *is* the
  beat). At dusk the tower's clock face is the last thing still readable in
  the fog.
- **Kit:** almost everything is vendored already: `column` and `pillar` for
  arcades, `wall_doorway` and `wall_window_open` for shop fronts on the far
  side, barrels, crates and `table_long` for market stalls, and Bricks097
  and Tiles093 for surfaces. New: one ambientCG cobblestone set for the
  streets (a `PavingStones` or `Cobblestone` set in the same 1K size, about
  200 KB with its normal map), and the tower, its clock face and the bells,
  built from primitives in the beyond like the Works' machinery. It has to
  look different from the quarter, which uses the same bricks. The cobbles,
  the arcades and the tower do that work.
- **Parts:** Legs parts move Still, so they're hit at a stroke: Kickstart,
  Skitter, Skid Plates, Overrun, Frost Trail, Spring Heels, Plumb Line's
  snap. That's a 0.5 s window every 20 s, so they're weaker for an instant,
  not useless. Ward, Mirror Ward, Brace and Anvil get better here, because
  they're how you defend without moving. Borrowed Time undoes a stroke hit
  like any other. Nothing becomes useless. **Rule:** being shoved doesn't
  count as moving. Only your own stick and Legs parts do, and the same goes
  for enemies (their own walking and rushes).
- **Cost:** medium. Kit and tower 1.5-2 evenings, the stroke 1.5 (a
  level-wide band on the shared `Hazard`, a moving check, enemies halting,
  the sound, the haptic, the arrival strokes). `impactBell_heavy` is already
  in `public/sfx`. Download about +0.2-0.3 MB.

### A2. The Line: the goods yard and the station

The other road home is the train. Depth 4 is the goods yard in the
afternoon, where freight still runs; depth 5 is the station at dusk, in the
evening rush. **The level behaves:** tracks cross the main path two to four
times a level, running edge to edge out into the fog, and low trains of ore
wagons (waist-high, so the camera is never blocked) run them on a timetable.
Every train hits everything on its track, for 22 and a hard shove clear,
Still or enemy, and while it passes it's a moving wall that stops shots both
ways. Idle enemies wait at a lit track like pedestrians. Committed ones
don't: a hulk that rears on the rails, or a ram whose lane crosses them,
is hit.

- **You:** A crossing bell (two tones, ding-ding) 2.5 s out, and the track's
  rails glowing ember from the side the train will come from. They brighten
  over the last 1.0 s, when it's committed: the ram's lane tell, reused at
  2.2 u wide (35 px at the widest zoom), which is the most readable tell in
  the game. The rails sing, a rising metallic hum panned to the train's
  side, and everything hushes for 150 ms before the engine comes out of the
  fog. Then a roar and a wagon-by-wagon clatter, a camera punch, and
  whatever was on the rails is thrown clear.
- **Push:** *an opportunity with a deadline.* Enemies step off a lit track,
  so to put a pack under a train you need a shove in the last second: a
  Pressure Vent, a Piston, a Clamp Toss, Skid Plates. If that part is
  cooling, you push it. It's the "cash the opening now" moment the strain
  pitches couldn't find in ordinary fights. With step 1 it goes further: a
  pushed hit on a hulk rearing on the rails leaves it reeling there.
- **Why:** coming home on the last train is a feeling everyone knows. The
  walk home is the best in the set: off the end of the platform and across
  the tracks at night, with no trains now. The rails that were death an hour
  ago are just cold metal, and Still steps over them.
- **Parts:** Clamp Toss becomes a star, and Lure turns into a trick (its
  decoy on the rails draws a pack onto them). Neither is broken, since
  trains come once every 12-20 s per track. Spring Heels can vault a passing
  train, which should feel wonderful (nothing else can). Frost Trail and
  Chill Vent across a track are strong. Through-Line goes through a train
  but leaves no hole (a train isn't a standing solid). Anvil doesn't catch
  a train: it's the world, not a blow.
- **Cost:** big. The rails and sleepers are primitives wearing Metal063 and
  Planks023A (both vendored), plus one ambientCG gravel set for the ballast
  (about 200 KB). The trains are primitives. Enemy AI has to wait at lit
  tracks, the generator has to lay tracks through rooms, and the hazard is
  a moving segment. About 4-5 evenings.

### A3. The park at dusk

The long way home, through the public gardens. Hedges are the waist-high
walls here (the only natural cover in the game), lawns are the open rooms,
gravel paths are the corridors, a pond is a hole in the floor you can't
cross, and a bandstand stands in the last clearing. Trees only in the
beyond, so the camera stays clear. **The level behaves, gently:** drifts of
fallen leaves lie on the lawns, and walking through them is loud. A pack
wakes at 11 u instead of 8 when you're in leaves, while the gravel keeps
it at 8. Enemies walking through leaves are loud too, so you hear a
sleeping pack's sentry shuffle before you see it. Leaves scatter where
anything walks, and they're the one soft thing in the game.

- **You:** the crunch underfoot changes from gravel to leaves; there's wind
  in the hedges and a band somewhere ahead, faint at depth 4 and nearer at
  depth 5 (it's the boss, and you hear it before you meet it). Hedges read
  as dark grey-green blocks at 16 px/u, under a cold mercury-lamp light (the
  old blue-white streetlamps, cold, not warm) that comes on in pools as dusk
  falls.
- **Push:** weak on its own. The leaves are a route choice (loud lawn or
  quiet path), not a push demand. The area's push lives in its boss, the
  Band (B2).
- **Why:** a quiet, human place at the end of the day, green in a grey city.
  If you want a nod to home, it can be Vienna's Stadtpark with its
  bandstand. That's your call.
- **Parts:** none affected.
- **Cost:** medium, and art-heavy. Hedges are boxes with a foliage texture
  (ambientCG has leaf and hedge-like sets; picked in the look test), and the
  trees and bandstand come from a CC0 nature kit (Kenney's Nature Kit or
  Quaternius, both CC0). About 3-4 evenings, +0.5-1 MB.

**Cheap fallback for any of these:** the quarter's kit with the new place's
floor, sound and beyond, and no level behaviour. About 1.5 evenings. It
would be a new look, not a new place, and I wouldn't ship area III that way.

---

## Topic 2: The boss

What the Assembler already tests: reading one big body's moves, stepping
into a safe lane, baiting a charge into a wall, and handling adds. What the
Arbiter tests: timing and cover against a sweeping gaze, a stationary
target, and heat. Every boss below is 900 HP, never hits above 22, and never
winds up under 620 ms.

### B1. The Hour: a bell in the square *(surprising; my pick, for A1)*

The tower's great bell has come down, and it hangs in a timber frame in the
middle of the tower square. It doesn't walk (it's anchored like the
Arbiter). It swings, and every swing is a stroke: the stillness band from
A1, but now a ring rolling outward from the bell's lip across the whole
arena. **You beat it by knowing when to stop.**

- **Phase 1:**
  - *The stroke.* It swings back and hangs at the top (1100 ms, with a creak
    and a swelling hum, and the double buzz 400 ms before the ring reaches
    you). The ring rolls out at 11 u/s, 1.4 u thick, and hits anything
    moving inside it for 16. Anything still is left alone. One every 6 s.
  - *The lip.* Stand within 3.5 u of the bell and the downswing clips a
    wedge on the floor (800 ms tell, 14). This one hits whether you move or
    not: it's a blow, not a sound. You can't hide at its foot.
  - *The Winders* (adds, below). Every 15 s one comes out of the tower's
    stump and runs for the frame. If it gets there it winds the bell (1.6
    s, with a ratchet you can count by ear), and the next stroke becomes a
    **peal**: three rings 700 ms apart, chasing each other out, so you have
    to stand for about 2.5 s.
  - *The opening:* after each stroke the bell hangs at the bottom still
    ringing for 1.2 s, and takes ×1.5. The bar says "ringing".
- **Phase 2 (55%):** the bell cracks. Every ring now has a silent gap of
  about 50° on the crack's side, and it's drawn as a lit lane, like the
  Assembler's wave gaps. You *can* walk, but only through the gap, and the
  crack turns with the swing, so it's somewhere new each time. Strokes come
  every 4.5 s. Two Watchers (below) wake on the square's rim, so their cones
  and the rings together make you choose where to be still.
- **The kill:** the bell swings once more and strikes one last stroke, soft
  and low. The ring carries no ember, only dust, and passes through
  everything at once. The square goes silent, the day lands at first dark
  as the Arbiter's does, and the warm beam opens. This
  ends the loudest fight in the game with its quietest moment.
- **What it tests that the others don't:** *stopping*, and answering threats
  with your buttons instead of your feet. The Assembler and the Arbiter are
  both beaten by moving well; this one is beaten by not moving at the right
  time.
- **Push:** the strongest of the three. (1) The Winder's winding is a
  wind-up in the literal sense, so step 1 breaks it with a push, and you'll
  often need to, because it arrives while your parts are cooling from the
  last opening. (2) During a peal you can't walk out of a Watcher's click or
  the lip, so they get broken or tanked. (3) Every opening comes right after
  a stroke, which is exactly when you've been standing and your cooldowns
  have been ticking. Players who kept a part back get rewarded, and the ones
  who didn't are asked to push. No quiet in a boss fight, so each push here
  is a real bet (the strain pitches' point).
- **You:** a round square 28 u across, low walls on spokes, the tower's
  stump at the top edge. The bell is 3 u tall in a 4.5 u frame. That's the
  Arbiter's occlusion risk, so it reuses the Arbiter's see-through rule when
  Still is behind it. The swing is the biggest, slowest, most readable
  motion in the game, a pendulum you can time with your eyes half closed,
  and the fight is built to be playable by ear.
- **Why:** the bell that used to ring people home from the fields at
  evening. Here it has gone wrong, too loud, and shakes the square. Beaten,
  it rings once, softly, the way it should, and you go home. The name is a
  placeholder; the notebook line is yours to write.
- **Parts:** Ward and Mirror Ward are stronger (defence while still). Legs
  parts are weaker during rings but essential between them (the gap in
  phase 2). Patient Lens fits the rhythm naturally. The boss ignores Lure.
  Nothing useless.
- **Cost:** medium-big, about 3-3.5 evenings: the anchored-boss pattern
  exists (the Arbiter), the ring reuses A1's band, the gap reuses the
  Assembler's wave lanes, and the swing is one hinge animation. The Winder
  (below) is its add.

### B2. The Band, at the bandstand *(surprising, for A3)*

Four automaton players on the park's bandstand: a bass drum, a horn, a
string player and a set of bells, 225 HP each (900 together). They play the
boss music: each member is one voice of the score. **Whoever carries the
tune attacks.** The lead passes around the band every two bars, its ember
lights, and its attack lands on the downbeat. The others only accompany. In
waltz time (one-two-three) the attack is always on "one", so the fight is
readable by ear.

- **Moves:** the drum's *pulse* (a floor ring with gaps on the one); the
  horn's *call* (it swings its bell toward you, tracks and locks like a
  sentinel, then a cone); the strings' *bow* (an ember arc drawn across the
  floor on each stroke, alternating direction); the bells' *arpeggio* (four
  lobbed shells landing in a rising line, one per note).
- **Solos:** a member that has led twice takes a solo. The music drops to it
  alone, it has a big 1.4 s wind-up, and it throws its hardest version.
  **A pushed hit breaks a solo** (step 1, applied to a band member, which
  isn't the boss's body): the player falters, the music stumbles, and it's
  open ×1.5 for 1.2 s. This is a deliberate exception to "bosses can't be
  broken", and it's where the push demand lives: once every 8-10 s, a
  wind-up that's easy to see coming.
- **Kill one and its voice leaves the music.** The survivors take over its
  attack as a second move (the parked Pair, with four players). The fight
  thins as you win, and the last player plays everything alone, fast. When
  it falls there's silence, then the park's wind, then the warm beam.
- **What it tests:** listening, and choosing a kill order that changes the
  rest of the fight. No other boss has more than one body.
- **Readability risk:** four bodies is what a 6-inch screen reads worst. The
  rule "one lead at a time" is what makes it work; if the lead ever doubles
  up, cut it.
- **Cost:** big, about 5 evenings: four bodies, and the music engine has to
  expose its bars and drop voices on cue (`music.ts` is generative, which
  helps, but its timing isn't wired to anything yet).

### B3. The Last Train, at the terminus *(for A2)*

A low locomotive with two wagons, running a loop of track around a 28 u
terminus yard, with two spurs cutting across the middle and two dead-end
sidings that end in buffer stops. The rails ahead of it glow for 1.5 s of
its travel. Anyone on the lit stretch when it arrives takes 22 and is thrown
clear. At a junction it can switch into a spur toward you: the points lamp
flips with the ram's heavy latch and the spur lights 1.4 s ahead. When it
stops at a platform it blows steam from both cylinders (an 800 ms scald).

- **The opening, and the push:** each siding has a lever. When the engine
  nears that siding's junction, a cold ring around the lever starts to close
  (about 1.1 s). Hit the lever with a part in time and the points flip: the
  engine takes the siding, hits the buffers, and is stunned for 1.7 s with
  its firebox open ×1.5. **The boss bar is a departure board**: it shows
  which slot the next two levers want ("next: ARMS · then: HEAD"), so you
  plan your cooldowns a lever ahead, and when the one it wants is cooling,
  you push it. Any cast of that slot's part near the lever counts, including
  parts that don't hit. The lever wins the aim while its ring is open.
- **Phase 2:** faster, and it sometimes reverses (judders and steams for 600
  ms first), so the lit stretch can appear behind it. A wagon uncouples at a
  junction and rolls down a spur on its own (a ram lane), then spills adds.
- **What it tests:** reading a network (where it'll be in 1.5 s) and acting
  on the world rather than the body. The Assembler asks you to *be* the
  bait; this one asks you to throw the switch.
- **Push:** a clear, planned ask every lap (7-10 s), with the slot shown in
  advance. That's the "answer is lit" idea turned into a diegetic board.
- **Cost:** big, about 4-5 evenings on top of A2's rails: a boss that moves
  on a graph, the points, the levers and the board.

---

## Topic 3: The monster set (for the old town)

The rule for this set: **one mechanic at three scales.** The stroke in the
level, the Watcher's click in a room, and the bell at the boss, the same way
the sentinel teaches the Arbiter. The other two enemies make the stillness
rule interesting instead of just adding more of it. All four stay inside
the body-equivalent budget, so deeper stays more varied, never stronger.

Body materials: the town is wood and old metal, so two new families, both
checked in the graded game and not by hex. **Walnut**: a dark clock-case
wood with a fibrous grain along one axis (the `Finish` noise stretched on y,
as the sentinel's drawn steel already is), low metalness. **Blackened
brass**: dark umber, with a dull yellow only where edges are worn. That one
has to be judged next to gold drops, because both are warm; if it reads as
loot, it goes to plain blackened steel.

### M1. The Watcher *(variant on the sentinel; new mechanic; surprising)*

A longcase clock on bird legs: a tall walnut case with one great lens where
the dial should be. **It sees only what moves.** When you're in its range it
throws an ember cone on the floor (30° either side, 10 u), tracks for 700
ms and clicks. At the click, anything moving inside the cone is shot (12).
Anything still is left alone. Walls block its view both ways, as they block
everything.

- **Asks:** stop inside the cone, step out of it before the click, get behind
  a wall, or break it (a pushed hit during the tracking). Moving after the
  click doesn't help, unlike a sentinel. That's the whole difference: the
  sentinel teaches you to move after the lock, and the Watcher teaches you
  not to.
- **At phone scale:** the cone is 10 u, 160 px at the widest zoom, the same
  kind of floor wedge as the Arbiter's gaze but a fraction of its size. The
  lens swells with the track, like the sentinel's. A Watcher's cone and a
  hulk's slam can overlap, and that's the intended dilemma: stand for the
  Watcher and eat the slam, or step for the slam and eat the click, or push
  and break one of them.
- **Tell sound:** a clock's escapement ticking faster through the track, and
  a camera-shutter click.
- Body-equivalent 1. **Cost:** medium, 1.5 evenings (sentinel base, a wedge
  tell like the Arbiter's, the moving check from A1).

### M2. Tick mites *(variant on the brood; a new face and one rule)*

The swarf mites, in blackened brass with a winding key on each back instead
of the dome. **They move only on the beat**: the whole brood hops together
on the music's beat and freezes between beats. The ring bite (the brood's
existing bite) closes on a beat too.

- **Asks:** nothing new to learn; the rhythm makes the brood predictable. On
  a phone that's a gift: eight small bodies are the hardest thing to track
  at 16 px/u, and eight bodies moving *in unison and in time* are the
  easiest version of that. They freeze at the stroke, so the bell never
  kills them. The brood's one skitter voice becomes one tick per hop.
- Body-equivalent 0.25 each, as mites. **Cost:** cheap-medium, about 1
  evening (quantising the brood's movement to the beat; `music.ts` needs to
  expose its beat clock).

### M3. The Winder *(new archetype: support)*

A small, long-armed thing in walnut and iron carrying a key as long as
itself. It never attacks. It runs to the nearest awake ally, sets the key in
its back and winds (1.6 s, a ratchet click per quarter turn, so you can hear
the countdown). A wound ally is Quick, the elite mod, for 8 s, with its
ember brighter.

- **Asks:** priority. Kill it on its way (18 HP), or break the winding. The
  winding is literally a wind-up, so step 1's rule teaches itself here
  better than anywhere: "a pushed hit breaks the wind-up" reads as a pun
  and as a rule at once. At the Hour it's the add that winds the bell into
  a peal.
- **At phone scale:** the key is the read, a long bar held out in front
  (1.2 u, about 19 px). While winding, the key turns visibly and the
  ally's ember pulses in time with the clicks.
- Body-equivalent 0.5. **Cost:** medium, 1.5 evenings.

### M4. The Pendulum *(variant on the ram; optional)*

A heavy lead bob hung from a walking iron tripod. It walks into a corridor
or a doorway, plants itself (900 ms, a breakable wind-up), and then swings
the bob across the gap on a steady rhythm, each swing drawn a beat ahead as
a lane across the corridor. It turns a corridor into a gate you time.

- **Asks:** cross between swings, fight around it, or break the plant with a
  push. Stunned against a wall, like the ram, when a Clamp Toss or a Vent
  puts it there.
- **Cost:** medium, 1.5 evenings (the lane tell exists). **Cut this one
  first** if the area feels crowded. Area II's rule was two new mechanics at
  most, and the Watcher and the Winder already are two.

**Names.** All 43 old roster names are already given to a role in
`notebook.ts`. A third band could re-home a few: "Thermal Scanner" or
"Glitch Node" for the Watcher, "Furnace Tick" for the tick mites, "Feedback
Loop" for the Winder. Or they get new names in the same voice. That's
yours, like the Hour's name and line.

**Elites:** no new mods. A Warden Watcher ("its cone seals the others'
embers") would be a readability problem, so I'd leave elites out of the
Watcher entirely.

---

## Topic 4: Where area III sits

**A branch at noon.** When the Assembler falls, the yard opens **two cold
beams and the warm one**: on by the Works, on by the old town, or home. The
run stays 6 depths and about 26 minutes, and it's still one day. Both roads
end at the lit house at night.

**Why the branch:**
- Noon is already the run's one real decision (go on or go home). This keeps
  it the only decision and makes it richer: *which way home today.* A player
  who loves the trains, or the bell, can choose it.
- An alternate (random swap) removes the choice, and a player never knows
  what the day will be. A deeper stretch past the Arbiter breaks "home at
  night": the walk home would have to come after night, the run gets longer,
  and area III turns into a harder post-game, the exact thing "deeper means
  varied, not stronger" rules out.
- Area II gets played about half the time. That's the real cost, and
  it's worth it for replays.

**How it reads on the phone:**
- Three beams in one yard is the thing to get right. Two plain cold beams
  would be identical at 16 px/u. So each cold beam is dressed for where it
  goes: the Works' stands in a `wall_gated` frame with grey soot drifting up
  it; the old town's has a faint ring of dust climbing it in time with a
  far bell. And when Still comes within 5 u, the place's name fades up in
  the depth banner's type ("the Works", "the old town"). The warm beam
  stays where it is, between them, and Grace's light still leans toward it.
- **When it opens:** the run after the Assembler first falls. That first
  time, the fork stays "on or home", which is enough to learn. From the next
  Assembler on, as it falls, a distant bell strikes twelve, and the second
  cold beam lights with the last stroke. It's the meta layer's "things open
  because a moment happened", and the first of the "doors, not upgrades"
  that were parked for later.
- **Code:** `ExitKind` has an invariant, "never a third", and `PLACE_OF` is
  keyed only by depth. Both change: the invariant becomes "one warm, at
  most two cold", and the place comes from depth *and* route. The save needs
  the route for resume, and the corkboard card's caption names it ("the old
  town, home at night").

**The walk home, per route:** through the old town at night, with the
square quiet and the stroke no longer drawn on anything. As Still reaches
the door, the tower strikes the hour behind him, and it's harmless now, only
a sound. On the Line's route (if that's chosen instead), it's the empty
tracks.

---

## Recommended bundle

**The old town (A1) + the Hour (B1) + the Watcher, tick mites and the Winder
(M1-M3), as a branch at noon.** The Pendulum waits until the three have been
played.

**Why this one:** it's the only bundle that takes walking away, and that's
the fix the strain analysis said a threat can't give. It makes step 1 matter
in every fight at a rate of about one ask a fight, not a flood, and it does
it by one rule at three scales, so depth 4 teaches depth 6 honestly. It's
the cheapest on art, since nearly every piece is vendored. It changes how
the level behaves without moving any walls. And it gives Still the one fight
in the game that's about his name.

| order | step | evenings |
|---|---|---|
| 0 | Step 1 of the strain plan (a pushed hit breaks the wind-up), if it isn't in yet: most of this bundle's push demand stands on it | 1.5 |
| 1 | The branch: two cold beams, dressed and named; route in the save; place by depth and route | 1 |
| 2 | The old town's kit, cobbles, tower and clock face; its sound | 1.5-2 |
| 3 | The stroke: the level-wide band, the moving check, enemies halting, the arrival strokes, the haptic | 1.5 |
| 4 | The Watcher | 1.5 |
| 5 | Tick mites | 1 |
| 6 | The Winder | 1.5 |
| 7 | The Hour: stroke, lip, peal, crack and gap, the last soft stroke | 3-3.5 |
| 8 | The walk home through the old town | 0.5 |

About 11-13 evenings after step 1, and the download goes up about 0.2-0.3 MB.
**Runner-up:** the Line and the Last Train (A2 + B3), if you'd rather the
push come from opportunities than from stillness. It's bigger (about 12-15
evenings) and less tied to Still, but it has the best walk home.

---

## Open questions for the phone

1. **Does lifting your thumb feel like a choice or like a trap?** The whole
   bundle stands on this. Play A1's stroke alone at depth 4 before building
   anything else. If it feels like freeze tag, widen the band's lead time
   before cutting the idea.
2. **Is the double buzz enough of a tell,** or does the stroke need a mark
   on the stick's rim, where the left thumb is looking?
3. **What does "still" mean for a resting thumb?** Proposed: the stick
   inside its dead zone. Drift on a worn stick shouldn't count as walking.
4. **Can you tell the three beams apart at the widest zoom** before the name
   fades up?
5. **Blackened brass next to a gold drop,** in Grace's light, at dusk.
6. **The first stroke caption.** The heat beam has a one-time caption (a
   placeholder). Does the first stroke that hits you need one, and if so,
   whose words? "Let it pass" is my draft, but it's yours.
