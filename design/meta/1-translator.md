# Round 1: Translator (feel, UX, emotion)

Pitches, not a spec. Each one has a name, a few sentences, then **You** (what
the player does and sees), **Why** (why it fits Still), and **Cost** (cheap,
medium or big, for one person vibe coding). *Surprising* marks the ideas none
of the old documents had.

Two rules shaped every pitch below. If you reject a rule, the pitches built
on it fall with it.

1. **Everything that grows is keyed to showing up, never to how well you
   did.** Run count, not depth. There's no meta currency, no score and
   nothing to farm.
2. **You never earn the family.** Grace means unmerited favour. A bench where
   the kids "unlock after N runs" makes love conditional on attendance. So in
   these pitches they are home from the first time Still gets home, and what
   grows is the house around them.

---

## Topic 1: The Workshop

### W1. A room Still walks into
The Workshop is a small iso room in the same engine, with the same camera
and the same stick. It's built from dungeon-kit props (a workbench, a
shelf, a chair, a window). There are no menus. You walk up to a thing and it
responds, the way loot works now. The way out is a door, and behind it is
the same cold beam as a level exit.
- **You:** You arrive, walk about four seconds past the bench and the wall,
  and step into the beam to start a run. You can also just stand there.
- **Why:** The only verb Still has is moving, so the home uses the same verb.
  Walking to the door is "Try again?" said with your thumb.
- **Cost:** medium. A second scene, a fixed room with no generation, and a
  proximity-prompt helper.

### W2. Her light stops leaning
In the dungeon, Grace's light leans toward the exit. In the Workshop it
doesn't lean anywhere. It fills the window, lights the room, and pools around
Still. It's the only warm light in the game, and here it's the whole light.
When Still first steps in, the cold grade eases: less desaturation, a softer
vignette, less fog. That shift is the real "you're home."
- **You:** The colour changes under your thumb as you cross the threshold.
- **Why:** The warmth comes from the lighting, not from a unit or an icon,
  which is exactly what "Grace is a light, never a unit" means.
- **Cost:** cheap. A grade preset and one light.

### W3. Home from the first night
Yanah and Yuri are in the Workshop the first time Still reaches it, and every
time after. They're small figures at the bench or on the floor, with a few
idle loops each: drawing, stacking scrap, looking up when Still comes in.
They never follow him out the door, never appear in the dungeon, and have no
button. Their only reaction is to how the run ended (see R8). Their rare parts
stay yours to write. Here they are only people in a room.
- **You:** You come home and they're already there. Walk close and one of
  them looks up. That's all.
- **Why:** It's presence with no mechanical hook, so it can't be read as
  power. It also can't be earned, which keeps it grace.
- **Cost:** medium to big. Two figures that need hand-work (the kit won't
  have them), plus 3-4 idle animations each. A cheaper alternative, and a
  surprising one: **they're always just out of frame.** You hear them and see
  what they leave behind (a drawing taped to the bench, blocks on the floor,
  a door swinging shut), but never see them. This costs almost nothing. The
  risk is that it reads as absence. Try it on the phone before you pick.

### W4. The photo on the wall
The moment a run ends, the engine takes a frame from the iso camera: Still
coming apart, or sitting down, or stepping into the light. That frame is
pinned to a corkboard in the Workshop, captioned with the run number and the
parts he carried. This is the still-merge keepsake, except the game makes it
itself, and no two are alike because no two endings are.
- **You:** Walk to the board, and the newest photo tilts toward you. Tap it
  to "look back at this run": a strip of depths, what he wore at each one,
  and where strain peaked.
- **Why:** You always leave with something, and it's evidence you were there,
  not a score.
- **Cost:** cheap. Snapshot the canvas at the ending and store a small
  thumbnail.

### W5. Wood under his feet *(surprising)*
Still's footsteps change from stone to wood at the threshold. The dungeon
music and ambience drop to room tone: a clock, rain on the window, the
scratch of a pencil, a wordless hum. If you're willing, record that room tone
in your own house, a real kitchen with nobody talking. The kids never speak
in words. Grace has one sustained warm tone that sits under everything and
never ends.
- **You:** You hear home before you notice the room.
- **Why:** On a phone, sound does more for warmth than models do, and it's
  the cheapest way to make the room personal.
- **Cost:** cheap. One footstep swap, one loop, and a gain envelope on the
  music. (The repo is public, so decide what you're comfortable putting in a
  recording.)

### W6. The room keeps your time *(surprising)*
The Workshop's window follows the phone's clock: morning light, afternoon
light, a lamp in the evening. Late at night the kids are asleep on the
bench, Still's footsteps soften, and the music plays quieter. Nothing builds
up while you're away, nothing runs out, and nothing is waiting to be
collected. The light just matches your day.
- **You:** Open the game at 11pm and the house is asleep. You walk quietly
  to the door without being told to.
- **Why:** It makes the room feel lived-in without any login pressure, and
  it's honest about when you actually play.
- **Cost:** cheap to medium. Three or four lighting presets and one "asleep"
  pose each.

---

## Topic 2: Meta progression (wider, felt)

### M1. The pegboard
Every part Still has ever found hangs on a pegboard in the Workshop. Parts
you haven't found are drawn as bare outlines, the same "drawn bare" look
empty slots have in a run. Thirty pegs, grouped by slot. You see the pool
widen as a wall filling in.
- **You:** Walk up to it and the part under Still's lens shows its card. A
  new part is hanging there for the first time, still swinging a little.
- **Why:** "Wider, not stronger" has to be visible or it feels like nothing.
  A wall of silhouettes filling in is width you can see.
- **Cost:** cheap to medium. A board prop with 30 small part meshes (they
  already exist as loot) plus outlines.

### M2. Take one thing off the wall
Still still starts incomplete, with one part. But once the pegboard has
anything on it, you choose that part: walk up to any white you've found and
take it. On run 1 the wall is empty, so the part is random and Still walks
out of a dark room with whatever he was given.
- **You:** Before the door, you stop at the wall and choose, or skip it and
  get a random one.
- **Why:** Run 20 starts with a decision and run 1 doesn't. That's supported,
  not stronger: it's still one white part and three empty buttons.
- **Cost:** cheap. The rule already exists. It just needs a picker.

### M3. The room fills, Still doesn't
Take the settled "small workshop upgrade track" and put it in the house,
not the robot. Every run you finish, however it ended, adds one physical
thing to the Workshop: a rug, a second lamp, a shelf, one more drawing, a
plant, a tool rack. It's a finite list of about 20-25 things. When the list
runs out, the room is simply done.
- **You:** Run 1's room is bare boards and a window. Run 20's is full and a
  little cluttered, and you can't point to when it happened.
- **Why:** Progress you can feel, with zero power in it, keyed purely to
  showing up. It's done when it's done, so there's no treadmill.
- **Cost:** medium. It depends on assets. If the kit is thin, fall back to a
  simpler kit or cut the list to about 12 things.

### M4. Parts remember
A part's card carries its history in one small line: *carried 4 runs, came
home with it twice, was wearing it when he stopped once.* It has no effect.
It only means the Cleaver you've carried for ten runs is *your* Cleaver.
- **You:** When you compare parts on the floor, the familiar one has a
  history and the new one is blank. Swapping now costs you something you can
  read. That's the moth and the flame, done with memory instead of numbers.
- **Why:** Losing a familiar thing has to feel like a loss. History does that
  and a stat comparison can't.
- **Cost:** cheap. Counters per part id, plus a line on the compare card.

### M5. A map you learn to read
On the node map (see R4/R5), a kind of node you've never visited shows as a
blank marker. After you've been through one, it shows its icon from then on.
Run 1's map is mostly blank, and by run 6 or so you can read all of it.
- **You:** You go from guessing to planning without anything getting easier
  per fight.
- **Why:** Knowing more is the one kind of progress that makes you better
  without making Still stronger. It's the old "survive → notice → search"
  arc, carried by the map.
- **Cost:** cheap. A "seen" set per node type.

### M6. Patched, not upgraded *(surprising)*
Still's own body carries the runs. Each Broken leaves a weld seam on him.
Each Stopped leaves a scuff where he sat down. Now and then after a run, one
of the kids has added something: a painted stripe, a sticker on the cage, a
bit of string tied to the stalk. None of it changes a number. After 30 runs
he's visibly repaired, looked after and marked.
- **You:** You catch a glimpse of your own history every time the camera
  zooms in on him.
- **Why:** "Built by what it survives," shown on the body. It's also the
  kids' presence carried into the dungeon without being a unit or a power.
- **Cost:** medium. A small set of decals and props on the Lantern model,
  with a cap so it doesn't get noisy. It depends on "Still visibly wearing
  his parts" being built first.

### M7. Cairns *(surprising)*
Wherever a run ended, a small cold marker stays at that depth in later runs:
a stack of scrap, a bent lens. Levels are generated fresh, so it sits at that
depth's entrance, not in the exact room. Walking past plays one soft tone and
gives nothing. After 20 runs, the early depths are dotted with your own
past, and a new depth has none.
- **You:** At depth 4 you pass three of your own cairns. At depth 7 there are
  none, and you notice.
- **Why:** "Leave something behind for next time," from the genesis doc. It
  marks a new place as new without scoring anything.
- **Cost:** cheap. A list of the depths where runs ended, and one prop.
- **Risk:** it could read as a high-score line. Keep it a stack of scrap, and
  never a number or a "best".

### M8. Turn it to the wall
On the pegboard you can flip any found part so it faces the wall, which
takes it out of the findable pool until you flip it back. Width you control,
so run 20 isn't buried under parts you don't like.
- **You:** Walk up to it, tap, and it turns around.
- **Why:** Widening without any curation eventually dilutes the pool. This
  keeps "wider" a gift and not a chore.
- **Cost:** cheap. One flag on the pool filter.

---

## Topic 3: A complete run

### R1. Three areas, then home
One run is three areas. Each area is 2 levels chosen on the map plus the
Assembler, and after the third area comes a final walk (R3). At today's 4-5
minutes a level, that's about 35-40 minutes. The run saves at every beam, so
a phone call or a train stop never ends it. Open the app and Still is
standing at the start of the depth he'd reached.
- **You:** A run fits one evening sit-down, or three short sessions.
- **Why:** A phone session has to survive being put down. And "no win
  condition" makes every run end in failure, which contradicts the only line
  the game is about.
- **Cost:** medium. Serialising the run state is the real work. The shape
  itself is just counters.
- **Dial:** if 40 minutes is too long, cut to two areas (about 25 minutes)
  before you shorten the levels.

### R2. Enough is a door *(surprising)*
After every Assembler, the arena opens two beams: the cold one goes deeper,
and the warm one goes home. Take the warm one and the run ends as **Home**,
at that depth, with the same closing line as every other ending. Going deeper
means more parts found and a wider pool next time, and more risk of Breaking
or Stopping. After the third Assembler, the warm beam is the only door.
- **You:** You decide when enough is enough, three times a run.
- **Why:** It's the moth and the flame at the scale of the whole run, and it
  puts "that was enough" in the player's hand instead of the game's.
- **Cost:** cheap. A second exit beam and one ending kind.
- **Risk:** some players will always go home at 3. That's allowed. Watch
  whether it makes runs feel short or feel kind.

### R3. The last room has no enemies
The final area after the third Assembler is one long, quiet walk. The walls
get lower, the fog thins, Grace's light grows until it's the landscape, and
strain drains a pip every few steps. There's nothing to fight. The run ends
when you walk into the light.
- **You:** Thirty to sixty seconds of just moving, after forty minutes of
  moving under threat.
- **Why:** For this game, reaching the end means arriving, not a bigger
  boss. The last fight was the third Assembler, and the ending is rest.
- **Cost:** cheap. A generated corridor with no packs, a grade ramp, and a
  strain drain.
- **Conventional alternative:** a distinct final boss (the Assembler's
  maker). Big cost, a new moveset, and it makes the end a test. I'd leave it
  out.

### R4. The exits are the map *(surprising)*
There's no map screen. The last room of each level has two or three exit
beams side by side, and each one has a glyph on the floor in front of it
(shrine, elite, lots of side rooms, a quiet room, a swap). You choose where
to go by walking into one. A thin strip along the top edge shows the path so
far as dots.
- **You:** You read three floor glyphs and walk. It's the same action as
  every other exit, so it's legible in 30 seconds.
- **Why:** You never leave the world or the thumb stick, and never face a
  screen to parse on six inches of glass.
- **Cost:** cheap to medium. Multiple exits per level, plus glyph decals.
- **Risk:** you only see one step ahead, so there's no long-range planning.
  That could be a feature: it keeps a lost robot lost.

### R5. The strip (the conventional map)
A map screen between levels, laid out for landscape: left to right, three
lanes, about 4 steps per area, one big icon per node (at least 56px
targets). Tap a node to see a single line about it, and tap again to go.
While the next level loads, Still's small figure walks along the strip to
the node, so the loading time looks like travel.
- **You:** You plan a whole area at once and see where the elites and
  shrines sit.
- **Why:** It's the settled "node map between areas," done at phone scale.
  Pick this over R4 if planning ahead turns out to matter.
- **Cost:** medium. A UI screen, generating the graph, and the walk
  animation.

### R6. The quiet room
A node kind with no packs and no loot: a small lit room, one bench, and
strain −6 as Still sits for a moment. The cost is a whole level's worth of
parts you'll never see. On the map (or the floor glyph) it looks like a
single seat.
- **You:** At 16 strain you choose between breathing and finding parts. You
  feel both.
- **Why:** It's the vent as a sacrifice, at the scale of a run. There's
  always a visible way to breathe, and it always costs something.
- **Cost:** cheap. A tiny fixed room.

### R7. The swap
A node kind: two parts sit on plinths. To take one, you set one of yours on
the empty third plinth, and it stays there for the rest of the run. As you
walk to the exit, the camera holds on the part you left for half a second.
- **You:** You give up the Cleaver you've carried for ten runs (M4 shows the
  history) to take a gold you've never seen.
- **Why:** When a new thing costs you a familiar one, the loss happens in
  the world where you can see it, not in a stat table.
- **Cost:** cheap. It reuses the loot and compare flow.

### R8. Three ways home
Every run ends in the Workshop, and the three endings get there differently.
- **Broken:** a hard cut to black. Then the Workshop, with Still in pieces on
  the workbench and the kids beside it. He sits up, and you're in control.
- **Stopped:** Still slows, sits down where he is, and the scene stays up.
  Grace's light doesn't lean any more. It comes to him and grows until it's
  the frame. It fades slowly to the Workshop, with Still in the chair. It
  should feel like a breath out, with no sting.
- **Home:** Still walks through the warm beam, and the Workshop door opens
  from the inside. The kids look up. It's the only ending where he walks in
  on his own.

After each one, the closing line shows in Grace's warm tone (your words,
not mine), the photo is pinned (W4), and the door is four seconds' walk away.
I'd take "reached depth N" out of the headline and put it on the photo's
caption, because a number in the headline turns the run into a score.
- **Why:** All three endings are clearly different, none of them feels like
  Game Over, and all three end at home.
- **Cost:** medium. Three transition sequences and one Workshop spawn pose
  for each.

### What run 1 vs run 20 should feel like (if these land)

| | run 1 | run 20 |
|---|---|---|
| first seconds | wakes alone in the dark maze, no Workshop yet | walks out of a full, warm room past the kids |
| starting part | random, given to him | chosen off the pegboard |
| his body | bare Lantern | welds, scuffs, a sticker from Yuri |
| the map | mostly blank markers | fully readable |
| depth 1-3 | nothing | your own cairns |
| the ending | the first time he's brought home, and the first time you see the family | a photo pinned beside 19 others |

Run 1 has no Workshop before it. Still wakes in the maze, as in the genesis
doc. The first ending, however it goes, is the first time he's brought home,
and that's where the player meets the family. Every later run starts at home.

---

## Summary

1. The Workshop is a walkable iso room where the colour, the footsteps and the sound all turn warm (W1, W2, W5); Grace is the room's light, the kids are home from the first night and are never unlocked (W3), and the room follows the phone's clock (W6).
2. Every meta change is keyed to showing up, not to depth: the pegboard (M1), choosing your starting white (M2), and a room that fills while Still doesn't get stronger (M3).
3. Progress without power comes from history and knowledge: parts that remember (M4), a map you learn to read (M5), a patched body (M6), and cairns where runs ended (M7).
4. A run is three areas of 2 levels plus the Assembler, then a quiet walk into the light, about 35-40 minutes and saved at every beam; after each Assembler you choose deeper or home (R1-R3).
5. All three endings (Broken, Stopped, Home) finish in the Workshop and pin a photo taken at the moment the run ended; the number moves off the headline, and "Try again?" is the door (R8, W4).
