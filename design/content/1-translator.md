# Round 1: Translator (look, sound, feel, readability)

Pitches, not a spec. Each one has a name and a few sentences, then **You**
(what you see and hear), **Why** (why it fits Still), **Parts** (which of the
30 it makes useless or too strong), and **Cost**. Cheap means an evening or
less, medium two or three, big more than that. *Surprising* marks ideas that
none of the existing documents have.

Screen scale for every size below comes from the enemies pass. `viewHeight` is
17 u and the Poco's landscape view is about 400 CSS px tall, so a unit is
**about 23 px at zoom 1 and 16 px at the widest zoom (0.7)**.

Three rules shaped every pitch. If you reject one, the pitches built on it
go with it.

1. **Dusk never warms.** Area II gets darker and bluer, and the fog closes in.
   The sun never goes orange. The only warm things on screen stay Grace's
   light and enemy embers, so as the day goes they fill more of the screen.
   She doesn't get brighter; the day gets darker around her.
2. **Silhouette first, ember second, motion third.** A new body must be
   nameable at 16 px/u with its core dark (asleep). The ember goes where the
   danger comes from or where the opening is, never on decoration.
3. **Rule R still holds** (from the enemies pass): *if your feet are on ember,
   you're hit.* Every new tell is drawn out to where Still's centre gets hit,
   through `tellMaterial` so it's textured, never a flat red or white.

---

## Topic 1: The second boss (depth 6)

This replaces the second Assembler in `design/meta/DESIGN.md`. The Assembler
stays at depth 3 only. Every boss below is 900 HP like the Assembler: the
difference is in what it asks, not in its numbers.

What the Assembler already tests: reading one move at a time (sweep, wave,
barrage, charge), stepping into a safe lane, making a charge end in a wall,
and handling adds. The second boss should test something else.

### B1. The Arbiter (the lighthouse)
The Thermal Arbiter from the old game ("It measures everything. It forgives
nothing."). It's a tall open-lattice tower on three girder legs, like the
tripod sentinel scaled up three times, with a rotating head carrying one
great ember lens. The head turns at a steady rate and throws a wedge of
ember light across the floor. When the wedge crosses Still with a clear
line, the head **stops on him**, the lens swells, clicks at 60%, and fires a
lance down the frozen line. That's the sentinel's aim, lock and shot at boss
size, so depth 1 teaches depth 6. Behind the lens, on the back of the head,
a boiler vents open for 1.2 s after each lance: the opening is in its
shadow.
- **Moves, phase 1:** *the watch* (the wedge sweeps at about 40°/s, a full
  turn every 9 s), *the lance* (stop, 750 ms swell, click, fire), *scald* (a
  steam ring around its feet if you stand close, the hulk's ring at 3 u),
  *flare* (it lobs a shell over whatever wall you hide behind; the landing
  circle fills for 900 ms, like Still's own Flare).
- **Phase 2 (55%):** the head splits into two wedges, back to back. The
  sweep reverses on a clank, and the head judders for 400 ms first so you
  can see it coming. Any cover it has lanced three times cracks down to
  `rubble_half`, so shade runs out and you have to move.
- **You:** A round yard with eight short walls on spokes at 8 u, like a
  clock face. At dusk the wedge is the brightest thing in the arena, a faint
  wash while it sweeps (147 px wide at 12 u, zoom 1) that brightens only when
  it stops on you. The lance is 0.6 u wide (14 px, 10 px at 0.7). You hear a
  low rotating whirr whose pan follows the wedge, a ratchet tick every 10° so
  you can hear its speed, a click at the lock, and a long hiss-crack for the
  lance.
- **Teaches:** moving between cover in time with a clock. The Assembler asks
  "where is this attack?"; the Arbiter asks "when do I cross?"
- **Why:** it's a light that judges, set against Grace's light that leads.
  The wedge is drawn as a floor decal and an additive haze plane, never a
  real `THREE.Light`, so Grace stays the only warm light source.
- **Parts:** Flare and Ricochet Lens are strong here, because you can plink
  from the shade. The boss's own flare and the cracking cover are what stop
  that. Ward blocks the lance. Mirror Ward sends it back into the lens, a
  big committed moment, since you have to stand in the wedge on purpose.
  Chill Vent and Frost Trail do nothing, because it doesn't walk. Lure is
  your call: this is the one boss whose wedge could stop on the decoy.
- **Cost:** medium. It doesn't move, so there's no pathing. The lance reuses
  the sentinel's aim line and the scald reuses the hulk's ring. The new
  pieces are a rotating wedge tell and permanent holes in cover, which
  Through-Line's 4 s holes already half-build.

### B2. The Gantry (the arena changes)
The boss is a travelling crane working on the far edge of the arena, at the
top of the screen. You only see its hook block: a rusted slab with one ember
eye, hanging on a chain that rises out of frame, so it never covers the
floor. It builds and unbuilds your cover. It drops loads (a wall segment or
a crate stack) that become new cover. It lifts the cover you're hiding
behind and carries it off. It swings the empty hook across the yard like a
pendulum. After every drop or lift the hook sits on the floor for 1.4 s,
and that's when you hit it.
- **Moves, phase 1:** *drop* (the load's exact footprint glows on the floor
  and fills for 900 ms, then it lands), *lift* (claw marks close around a
  cover piece for 1.1 s, then it's gone), *swing* (a curved lane tell, the
  ram's lane bent into an arc, committed at the lock).
- **Phase 2:** loads crack when they land and throw a shockwave ring with
  gaps (the Assembler's wave, now coming from wherever the load fell). Some
  crates open into a ram, and a ram plus a freshly dropped wall is a stun you
  set up.
- **You:** The yard starts almost bare, with two walls. By the end the crane
  has laid it out differently every time. A drop's footprint is 4 u (92 px),
  the biggest tell in the game after B3's tiles. You hear a chain rattle
  (`impactMetal_light` fast), a winch whine that rises as it lifts, a thud
  with dust (`impactMining`), and a creak at the top of each swing.
- **Teaches:** cover isn't permanent. You read what the arena *will* be.
- **Why:** it's a machine that moves the maze around you, and the only verb
  you have against that is moving.
- **Parts:** Ricochet Lens and Clamp Toss get strong (more walls to bank off,
  more walls to throw adds into). Spring Heels shines. Lure, Chill Vent and
  Frost Trail are useless against the hook. Anvil shouldn't catch a falling
  load; say so on its card or in the notebook.
- **Cost:** big. Terrain has to change at runtime: walls added and removed,
  pathing rebuilt, the charge's cut recomputed. There's also a
  pendulum-shaped hazard and a chain that runs off-screen. This is the
  biggest pitch in the round.

### B3. The Crucible (the floor is the board)
Meltdown Core from the old game, promoted. It's a squat furnace sunk into
the middle of the arena, on a pivot, and it tilts to pour. Slag runs out
along the floor tiles: the arena is 7 × 7 tiles of 4 u, and the tile seams
are already visible in the kit. Each tile heats in sequence from the
furnace outward. Ember cracks creep in from its edges for 600 ms, then it
stays hot for 2.5 s. Walls stop the slag, because walls block both ways, so
a wall across a row makes shade behind it.
- **Moves, phase 1:** *pour* (the lip glows and it tilts toward a direction
  for 900 ms, then a row of tiles heats), *spit* (lobbed globs at Still, a
  real shot, so Ward works), *belch* (a close ring around the rim).
- **Phase 2:** two pours at once in an L. There's a hard cap of 45% of tiles
  hot at any moment, so there's always somewhere to stand. When it tilts,
  its mouth faces the pour: stand beside the row, not in it, and the mouth is
  open to you.
- **You:** A tile is 92 px at zoom 1 and 64 px at the widest, the clearest
  tell in the game. Each heating tile hisses, and the pitch climbs as the row
  advances, so you hear the row coming before you look. Hot tiles burn adds
  too.
- **Teaches:** space over time. It doesn't ask where the attack is. It asks
  where the floor will be safe in two seconds.
- **Why:** it keeps the ember language honest at the biggest scale: ember on
  the floor means don't stand here, and nothing else.
- **Parts:** Kickstart, Skitter and Spring Heels carry the fight. Frost Trail
  could cool a hot tile it crosses, which would be the one boss job for a
  slow part. Treat that as an option, not a default. Brace turns burns into
  strain, which is risky here. Plumb Line snaps across hot tiles, strong but
  gold. Parry, Anvil and Lure do nothing.
- **Cost:** medium. It's a 7 × 7 tile-state grid, one `tellMaterial` decal
  per tile, and a stationary body built from primitives.

### B4. The Echo *(surprising)*
Echo Construct from the old game. It's the Lantern built by the maze: Still's
own shapes (open cage torso, lens on a stalk, bird legs, clamp and hook) in
rusted iron, with **ember where Still is cold**. It stands 2.6 u to his 1.9
and is hunched, so you never mistake the two. It wears four parts, visibly,
and fights with the four white parts. Each one gets a windup Still's version
doesn't have, and every one of those windups is a tell you already know:
Lens is the sentinel's aim line, Vent is the hulk's ring, Cleaver is the
Assembler's sweep sector, Kickstart is the ram's lane.
- **Phase 2 (55%):** it swaps to blues: Ricochet (the bounce path drawn off
  a wall), Backdraft (it pulls instead of shoving), Rusted Hook (it yanks
  you), Spring Heels (it vaults the walls). The rules change halfway, into
  rules you recognise from your own pool.
- **You:** You hear your own ability sounds, an octave down and wetter, and
  your own bird-leg step, heavier. Grace's light doesn't lean toward it.
- **Teaches:** reading your kit from the other side. It's the symmetry
  promise made literal: its bolt can't cross your cover because yours can't
  cross its cover.
- **Why:** "built by what it survives" has a shadow side, a Lantern built by
  the maze instead of carried by her. It's the Assembler's mirror made into
  Still's mirror. **Honest flag:** an evil twin can read as a cliché, or as
  a fight against yourself, which may land badly. It's your call. The ending
  is also yours: it breaks apart (Still's `breakApart` in ember), or it
  slows and stops, which echoes the Stopped ending.
- **Parts:** this is the one boss you can Parry, but only its Cleaver and
  Kickstart windups, or Parry Clamp solves the fight. Lure works on it
  (it's Still-shaped and fooled). Mirror Ward returns its Lens bolt. Nothing
  becomes useless.
- **Cost:** medium. All four tells exist. The body is `still.ts` primitives,
  re-coloured. It forces "Still visibly wearing his parts" (open in
  `HANDOVER.md`), which gets built once and serves both of them.

### Side by side

| | tests | arena | new tell shape | cost |
|---|---|---|---|---|
| Assembler (today) | read one move | fixed, 4 walls | – | – |
| B1 Arbiter | time crossings | clock face, cover wears out | rotating wedge | medium |
| B2 Gantry | cover moves | built during the fight | footprint, arc lane | big |
| B3 Crucible | space over time | floor heats in rows | tile | medium |
| B4 Echo | your own kit | fixed, 4 walls | none (all reused) | medium |

**My lean:** B1 for how dusk looks (the wedge is the strongest dusk image
and needs nothing new from the arena), or B3 if you want the arena itself to
do the work. B2 is the most memorable and the most expensive.

---

## Topic 2: The second environment (depths 4–6)

### The light from afternoon into dusk (applies to every pitch)

Today's grade is one preset: exposure 1.3, saturation 0.78, vignette 0.8, fog
44–72 in `0x0b1018`, hemisphere `0x53749c`, key `0x8fb0da` at 1.15 from the
far side, Grace at 300. Area II walks it down. These are starting points to
tune on the phone, not numbers to lock.

| moment | key light | fog (near–far, colour) | exposure / sat / vignette | Grace | bloom threshold |
|---|---|---|---|---|---|
| depth 4, early afternoon | pale `0x9fb2c8`, 1.2, high | 46–74, grey `0x0e131a` | 1.25 / 0.74 / 0.8 | 300 | 0.72 |
| depth 5, late afternoon | `0x8397bd`, 0.9, lower | 40–66, `0x0c1220` | 1.1 / 0.66 / 0.9 | ~350 | 0.68 |
| depth 6, dusk | `0x6a7fb8`, 0.6, near the horizon | 34–58, blue-violet `0x0a0e1c` | 0.95 / 0.58 / 1.0 | ~410 | 0.64 |
| boss down, first dark | 0.3 | 30–52, `0x070a14` | 0.85 / 0.55 / 1.05 | ~460 | 0.62 |

- **Grace scales against exposure** (`300 × 1.3 / exposure`), so she stays
  the same brightness while everything else dims. Her share of the screen
  grows on its own.
- **Bloom threshold drops** so the ember cores bloom more as the light goes.
  At dusk the embers carry the telegraphs even harder, which is good for
  reading tells.
- **The fog is the sky.** The camera never sees the sky, so fog colour does
  the whole sunset. No orange band, no sun.
- **At the kill**, the warm beam home opens in the darkest frame of the game
  so far. That should be the run's best frame.

**Sound, the same arc:** drips thin out and wind comes up across depths 4–6.
The music keeps its D drone and key, but area II gets a darker chord loop (for
example Dm, Gm, B♭, A, where the A still refuses home). The pulse becomes a
metal tick, and the tempo drifts from 97 down to about 92 across depths 4–5,
the day slowing. **The bell (Grace's line) doesn't change with the hour.**
It's the thing that stays. The depth-6 fight keeps 124 BPM, but the kick and
snare become anvil and plate hits (`impactPlate_heavy`, `impactBell_heavy`),
so the second boss doesn't sound like the first.

### E1. The Works
Area II is the foundry floor above the dungeon, where the Assembler was
made. Its "foundry" ambience layer, which today only plays on boss levels,
becomes the whole area's room tone. Floors are iron plate and concrete.
Walls stay KayKit barriers, skinned as riveted plate. Cover is low
machinery: pipe runs, bins, casting moulds, built from primitives the way
the enemies are. Halls (5 × 3) come up more often, long casting floors that
suit rams. Chimneys and gantry silhouettes stand in the fog on the far side
only, where `hidesFloor` allows tall pieces.
- **You:** Footsteps ring on plate instead of scuffing stone (recorded
  `impactMetal_light`, pitched down, under the step). The reverb is shorter
  and brighter than the stone room. A drop forge thumps somewhere at 48.5
  BPM, exactly half the music's tempo, so the world keeps time with the
  score. Steam hisses in the stereo field. At dusk the furnaces are out and
  the works is closing for the night. Only the embers glow.
- **Kit:** ambientCG `MetalPlates`, `DiamondPlate`, `CorrugatedSteel` and
  `Concrete` families; pick exact IDs in `look.html`. They go in as new
  entries in `SURFACE_TEX` and a per-area `surfaceOf`. The triplanar photo
  skin is why any CC0 kit fits: KayKit's other packs, Kenney's City Kit
  (Industrial) for the far-side silhouettes, Poly Haven props. The skin and
  the grade flatten them into one look. Check each licence when vendoring.
- **Why:** the lineage writes itself (the Assembler's home, Sector 2's
  thermal names), and it's rusted iron everywhere. The enemies look like
  they were made here.
- **Cost:** medium. Four or five textures, a surface map per area, a handful
  of primitive props, and the room tone rebalanced.

### E2. The Drowned Floors
Lower down, water has come in, which is why everything is rusted. Every
floor holds a few centimetres of still, dark water: a low-roughness plane
at y 0.07, below `DECAL_Y`, so tells still draw on top, with a slow
procedural ripple. Grace's point light makes a warm smear across it for
free, so the one warm light is doubled and leads twice. Every footstep,
Still's and every awake enemy's, drops a small grey ripple ring. You can see
a pack moving behind a wall by its ripples before you see the pack.
- **You:** Footsteps become splashes (the existing drip voice plus a noise
  burst). Drips go from now and then to constant. The room tone is water
  lapping at stone. Afternoon water is silver, dusk water is deep blue, and
  the water carries the dusk without warming it.
- **Rules:** ripples are always cold grey, never ember, so they never read
  as a tell. Water doesn't slow anyone. A slow would devalue Chill Vent and
  Frost Trail and make every fight sluggish on a thumb.
- **Why:** the same maze, changed by time, which fits a run that is one day.
  The ripples also give you a way to read enemies over waist-high walls.
- **Kit:** the same KayKit pieces and today's textures, with the contact
  darkening band raised to a wet line on the lower 0.3 u of walls.
- **Cost:** medium. One water material, a pooled ripple decal, and a splash
  voice. It's the cheapest way to make area II look unlike area I without a
  new kit.

### E3. The Viaduct *(surprising)*
Area II is above ground: an old rail viaduct crossing over the ruins. Rooms
are platforms and stations, corridors are track spans (already one cell
wide), and side rooms are signal boxes. **The beyond is down.** Past the
railings the floor just ends, and far below in the fog lie area I's ruins,
the morning's maze, where you've been. You never need tall props on the
camera side, because nothing is there.
- **You:** For the first time the reverb goes away. It's open air, wind
  instead of drips, and your footsteps land on planks and iron with no echo.
  The sky has the most room here, so the dusk reads most strongly (fog colour
  is the sky). Long spans are ram country.
- **Readability catch:** the ram's tell is literally "rails". Track rails on
  the floor would hide it. Either leave the rails off the floor (sleepers
  only) or keep them dark, matte and low-contrast, and never along a lane's
  edge.
- **Kit:** `Planks023A` (vendored) for decks, plate for girders, barriers
  re-skinned as iron railings, and Kenney's Train Kit for carts and signals.
  Area I's ruin placements get reused at y −12 for the drop.
- **Why:** it's the only pitch where the environment says "you've come a
  long way" without a word. You can see the morning from the afternoon.
- **Rules:** keep a wall on every floor edge, as today. No falling, which
  would be a new death.
- **Cost:** medium. A layout tweak (more halls, fewer side rooms), a new
  skin set, and a "below" beyond in place of the ruins.

### E4. The day moves with you *(surprising; a light layer on any of them)*
Inside each level the grade lerps from that depth's start preset to its end
preset, keyed to the furthest main-path room Still has reached. It never
reverses, so walking back doesn't bring the afternoon back. Across depths
4–6 that makes one continuous sunset about 13 minutes long. In the boss
fight the last step is keyed to the boss's HP: the day ends with the fight,
and the kill lands at first dark with the warm beam as the brightest thing in
the game.
- **You:** You never see a change happen. You just notice the fog is closer
  than it was.
- **Why:** "the depth is the time of day" from the meta plan, done
  continuously instead of in steps.
- **Cost:** cheap. A preset lerp and a room index, most of an evening. The
  real work is tuning it on the phone so no single room looks wrong.

**My lean:** E1 with E4 on top. E2 if a new kit feels like too much. E3 if
you want area II to be the thing people remember.

---

## Topic 3: Enemy variety

### At a glance (every body, existing and pitched)

| body | silhouette class | ember is | motion signature |
|---|---|---|---|
| hulk | tall blob | chest core (the slam) | lumbers, rears |
| tripod sentinel | spider of lines | lens (the shot) | plants, swells |
| ram | long low wedge | back seam (the direction) | tracks, drops its head |
| swarf mite | dots | one dot each (the jaw) | skitters as one |
| **Rust Guard** | a moving slab | behind the slab (go round) | turns slowly to face you |
| **Conduit Spider** | above the waist line, on a column | abdomen, then the wire | perches, crawls post to post |
| **Slag Heap** | a mound | coals the mites will become | sits, then sheds |
| **The Hollow** | tall and thin, a cold box on its back | none: its light is cold | flees, stops to listen |

Every new tell is a new *shape* before it's a new size: slab edge, wire, and
a mound's dots join lane, line, ring in pieces and whole ring.

### V1. Rust Guard *(a layer on the hulk)*
A hulk carrying a door-sized plate in front of it, 1.6 u wide, riveted. From
the front you see a slab. Its core shows only from the sides and back. It
turns toward Still at 1.2 rad/s, so flanking works, and the slab blocks
everything: your bolts, and **the sentinel's shots from behind it**, so a
guard's own pack is weaker at range. Its attack is dropping the slab forward:
a 2.4 u rectangle tell, not the hulk's ring.
- **You:** Moving cover that's on their side and blocks them too. You learn
  to go round.
- **Why:** it's the symmetry rule on a body. Cover works against everything,
  including its friends.
- **Parts:** Focusing Lens and Cracked Lens are useless head-on. Ricochet,
  Flare, Rusted Hook, Backdraft, Clamp Toss and Kickstart are the answers.
  Through-Line pierces the slab and leaves a 4 s hole both ways, consistent
  with every other solid. Nothing gets too strong.
- **Cost:** cheap to medium. A moving box in `lineClear`, the slab mesh, and
  a strip tell. From depth 4, any environment.

### V2. Conduit Spider *(new archetype: the zoner)*
A small body on four long legs, clinging to the top of a wall column. The
generator already puts one at every corner and wall end. It's the only enemy
above the waist line. It strings a wire to another column across the room or
a corridor. A spark crawls along a faint line for 700 ms, then the wire goes
live for 3 s: 0.35 u wide (8 px), textured ember crackle. Anything crossing
it takes damage and a short stagger, including hulks and mites. A ram that
rushes through a live wire is stunned as if it hit a wall. It can't wire
through a wall. A perched spider can be hit by anything with a line to its
column.
- **You:** A rising zip while the spark crawls, a snap when it goes live,
  and a hum while it's live, panned between the wire's two ends, so the
  stereo width is the wire's length.
- **Why:** the roster has chase, shoot, rush and surround, but nothing that
  shapes the room. Every other enemy asks "where is it hitting?", and this
  one asks "where can I walk?"
- **Parts:** Spring Heels vaults a live wire, a new job for it. Kickstart
  through a live wire gets hit, since running over anything includes this.
  Frost Trail plus wire is a double ram trap. Nothing is useless.
- **Cost:** medium. A perch-and-hop state machine over the column list and
  a line hazard. It fits E1 (cables) and E3 (catenary posts) best.

### V3. Slag Heap *(area II variant of the swarm; belongs to E1)*
In the Works, a mite brood sleeps as a heap. It's a 1.4 u mound of slag
with six ember coals sunk into it, the **same halo dots the mites wear**,
so it teaches itself. When the pack wakes, the coals pop out one at a time
over 1.2 s and each one becomes a mite. Hit the heap during the shed and the
coals still inside go out. The mound is left as low cover.
- **You:** Depth 4 taught you six dots mean six jaws. At depth 5 a pile of
  rubble has six dots. You count before it wakes.
- **Why:** deeper means more varied: the same brood with a new face and a
  new choice (rush it, or back off and let it come).
- **Parts:** Pressure Vent and Flare into a shedding heap are strong. That's
  fine, because it rewards reading the dots. Nothing is useless.
- **Cost:** cheap. A mound mesh and a delayed spawn of the brood that
  already exists. The body budget counts it as its mites.

### V4. The Hollow *(surprising: new archetype, never attacks)*
Hollow Repeater from the old game. It's a tall, thin walker, taller than
Still at 2.3 u, with a rusted birdcage on its back. Inside the cage is a part
lit **cold**, the only cold light any enemy carries, because it's something
of Still's. It never attacks. When a pack near it wakes, it flees for the
far side of the level, stopping every 2.5 s for 0.8 s to listen. That pause
is your chance. Catch it and the part drops. If it gets past 16 u, it
settles in another room and you can find it again.
- **You:** A cold light moving away through the fog at head height. At
  16 px/u it's unmistakable. It gets a thin cold chime, a detuned high bell
  and the only cold instrument on an enemy, plus light fast feet.
- **Why:** cold means yours, and the colour language says so without a
  word. It's a moment in a run that isn't a fight. Under the meta rules it's
  also a natural source of an unfound part.
- **Parts:** Chill Vent and Frost Trail finally get a big job, slowing its
  walk. Rusted Hook yanks it back, which is the best feeling in the pitch.
  Skitter, Kickstart and Plumb Line shine. Nothing is useless.
- **Risk:** a chase can drag you into sleeping packs. It should flee only
  through cleared rooms or away from sleeping packs, never into them.
- **Cost:** medium. Flee pathing on the existing BFS toward a far point, a
  cage mesh, and an existing loot drop.

**My lean:** V1 and V3 first (cheap, and each is a new read), then V2. V4 is
the one that changes how a run feels.

---

## Summary

1. Rules for all of it: dusk never warms (it gets darker and bluer around a
   constant Grace), silhouette first and ember second, and Rule R (feet on
   ember = hit).
2. Second boss: the Arbiter (lighthouse wedge, time your crossings,
   medium), the Gantry (a crane that builds and lifts your cover, big), the
   Crucible (the floor heats in tile rows, medium), and the Echo (the
   Lantern built by the maze, surprising, all tells reused, medium).
3. Second environment: the Works (the Assembler's foundry, medium), the
   Drowned Floors (water, a doubled Grace, ripples that show packs, medium),
   the Viaduct (above ground, area I visible below, surprising, medium), and
   the day moving with you (surprising, cheap).
4. Enemies: Rust Guard (moving cover that blocks its own sentinels), Conduit
   Spider (live wires between columns), Slag Heap (a brood asleep as coals in
   rubble), and the Hollow (flees with a cold part in a cage, surprising).
5. Leans: Arbiter or Crucible, the Works with the day moving with you, and
   Rust Guard plus Slag Heap first. Watch the ram-rail clash on the Viaduct,
   the evil-twin tone of the Echo, and the Gantry's runtime terrain cost.
