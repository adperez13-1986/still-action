# Round 1: Balancer (systems and maths)

Pitches for the Workshop, meta progression and a complete run, from the
numbers side. Pitches marked **(surprising)** are ones none of the old
documents said. Every number here is a starting guess for a sim or a phone
test to move, not a claim.

## The numbers I'm building on

| thing | value today | source |
|---|---|---|
| parts | 30: 8 white, 16 blue, 6 gold (head 8, torso 7, arms 7, legs 8) | CATALOG |
| drops per crawl level | about 8 (0.66 per pack, side rooms and elites always pay) | parts/1-balancer §5 |
| tier odds, normal drop | 60% white, 40% blue, 0 gold | parts/1-balancer §5 |
| crawl level length | 4-5 min, ~6 packs | DESIGN |
| boss depth | every 3rd depth is only the Assembler's arena, ~3 min | `BOSS_EVERY = 3` |
| strain | +2 per push, +4 Plenty, −2 per quiet (needs a kill), −6 Rest, 20 = Stopped | main.ts |

## Two maths problems found while reading

1. **"Parts you find join the pool" needs a way to find what isn't in the
   pool.** If only pooled parts can drop, nothing new ever joins. So there must
   be an "unfound" channel: drops that come from outside the pool, drawn bare
   the way unfound parts already are. The rate of that channel *is* the unlock
   pace, and it's the one number the whole meta layer hangs on (M1).
2. **Strain doesn't carry yet.** Six quiets a level can take back −12, so a
   player can push 6 times a level and end every level at the strain they
   started with. Only Plenty (+4) and push-spam move it across levels. Over a
   9-depth run the middle ending is mostly unreachable, which breaks the
   lineage's three outcomes. DESIGN.md already suspects this. R5 is the fix I'd
   test first.

---

## Topic 1: The Workshop

Budget: 20-40 seconds between runs, and at most two decisions per visit. It's a
breath, not a menu.

### W1. The wall of parts

One wall of the Workshop holds a hook for every part in the game, grouped by
slot. Found parts hang there, lit cold. Unfound ones are drawn bare, the same
bare drawing Still wears for an empty slot, with one line that says where it
lives ("an elite's", "the Assembler's", "somewhere after depth 4"). The wall is
the progress bar you never see as a number: 12 of 32 hooks filled, then 19,
then all.

- **Player does:** looks, taps a part to read its card. No decision.
- **Fits because:** "wider" needs to be *seen* as wider. A full wall is the
  only honest picture of meta progress in a game with no stat track.
- **Cost:** cheap.

### W2. The test bench

A door off the Workshop opens onto one 3x3 practice room: any part you've
found on any button, one hulk and one sentinel that stand back up, no HP, no
strain, no stakes. Walk back out when you're done.

- **Player does:** tries the Ricochet Lens bank shot before betting a run on it.
- **Fits because:** with wider-not-stronger, the thing that grows across runs
  is the *player*. The bench turns every unlock into something you know how to
  use, and it cuts the mid-run compare pauses (you know the card already).
- **Cost:** cheap. The arena and spawn hooks already exist.

### W3. The hook by the door (surprising)

At every ending, whatever the ending, you pick one part Still was wearing and
hang it on a hook by the door. The next run starts with that part instead of a
random plain one. Every run hands one thing to the next, so no run is empty
and runs become a chain rather than a pile.

- **Player does:** one choice at the end of a run, from at most four parts.
- **Fits because:** "built by what it survives", literally: Still walks in
  carrying something the last run earned. It's the "no empty run" guarantee
  made mechanical.
- **Cost:** cheap.
- **What breaks:** a chosen gold every run is a head start. Rule: golds and
  boss-only parts can't go on the hook (whites and blues only, which the pool
  rules say are equal).

### W4. The corkboard draws the run as a line (surprising)

The keepsake card pinned for each run is drawn from data the run already
keeps: depth along the bottom, strain as a line climbing and falling, a tick
for every big hit, the ending as a mark at the right edge (a break, a slow
flattening, or a warm dot for Made it). Twenty runs in, the corkboard is a
range of small mountains, and you can see yourself getting further without a
single stat.

- **Player does:** reads it. Taps one to see the parts it wore.
- **Fits because:** every run leaves an artifact, and Broken and Stopped look
  different on the board without either looking like failure.
- **Cost:** cheap.

### W5. They arrive by showing up

Yanah and Yuri come into the Workshop on a run count, never on depth or wins:
Yanah after the 3rd run, Yuri after the 6th (the same rhythm as the Assembler).
Before that, their place at the bench is empty and waiting. Their two parts
join the findable pool the same moment each arrives. What they are and what
they do stays the owner's.

- **Player does:** nothing. That's the point.
- **Fits because:** the gate is attendance, not skill. A player who breaks on
  depth 1 six times still meets both kids on schedule. "You showed up" is the
  unlock condition.
- **Cost:** cheap.

---

## Topic 2: Meta progression

### M1. Found means findable (the pace dial)

The pool starts with the 8 whites and 4 easy blues, one per slot (Cracked
Lens, Backdraft Vent, Rusted Hook, Skid Plates). The other 12 blues and 6 golds
start unfound. From depth 2 on, each crawl level has a 50% chance that its
first elite drops an unfound blue; every Assembler you beat drops an unfound
gold while any remain. Pick one up and it joins the pool for good.

- **Player does:** notices a bare part on the floor and wants it.
- **Fits because:** it's the settled rule, with a number on it.
- **Cost:** cheap.

| player | reaches | new blues / run | new golds / run | runs to full pool |
|---|---|---|---|---|
| early | depth 2-4 | 0.5-1 | 0-1 | – |
| middle | depth 5-7 | 1.5-2 | 1-2 | – |
| typical path | – | – | – | **9-11 runs, ~5-6 hours** |

**Grind check:** the unlock rate per minute must be highest in *full* runs, or
players will throw early runs to farm. A run abandoned after depth 2 (~9 min)
yields 0.5 unlocks, about 18 min each. A full run (~40 min, ~2 blues + 2 golds)
is ~10 min each. Nothing drops unfound at depth 1, so suicide runs are the
slowest route. Pool is finite, so there's no treadmill once it's full.

### M2. Each ending opens a different drawer

The 18 unfound parts are split into three drawers. **Broken** opens the parts
about hits and HP (Mirror Ward, Parry Clamp, Anvil, Chill Vent, Frost Trail,
Borrowed Time). **Stopped** opens the parts about strain (Patient Lens, Frayed
Cleaver, Brace, Overrun, Overclocked Coil, Plumb Line). **Made it** opens the
rest. Each ending adds one part from its drawer to the pool, on top of M1's
finds. An empty drawer spills into the others, so no ending is ever dead.

- **Player does:** nothing new. The ending is the key.
- **Fits because:** all three outcomes are progress, and *different* progress,
  which is exactly why the two losing endings are kept different on purpose.
  Stopped stops being the lesser loss: it's the only way to meet the strain
  builds.
- **Cost:** cheap.
- **What breaks:** deliberately stopping at depth 1 to open the strain drawer.
  It's two minutes, once per part, six times total, and M1's "nothing unfound
  at depth 1" rule doesn't cover it. Gate it: an ending opens a drawer only
  from depth 3 on.

### M3. The run's crate

The door doesn't open onto the whole pool. Each run draws a crate: all 8
whites plus 2 unlocked blues per slot (8 blues). Golds still come only from
elites, the boss and Plenty, as today. The crate shows at the door, and you
can reshuffle it once.

- **Player does:** reads "this is a bolt-and-vent run" before starting; one
  optional reshuffle.
- **Fits because:** wider across runs, focused within one. The pool can grow
  to 50 without any single run getting mushier.
- **Cost:** medium.
- **Numbers:** a run has ~30 blue drops (48 normal × 0.4 + ~11 from elites).

| blues a run can drop | sightings of one named blue | P(see it) | P(see a named pair) |
|---|---|---|---|
| 4 (M1 start) | 7.5 | ~100% | ~100% |
| 8 (crate) | 3.75 | 98% | 96% |
| 16 (whole pool today) | 1.9 | 85% | 73% |
| 27 (a 50-part pool) | 1.1 | 67% | 45% |

**Answer to "does more make builds worse":** at 30 parts, barely. At 50, yes:
a two-part synergy (Frayed Cleaver + Brace) shows up in fewer than half of
runs, which is when unlocking starts to feel like losing. The crate or M4 caps
it. The bigger flatness today is elsewhere: 60% of normal drops are whites, so
each white drops ~3.6 times a run and about half of all drops are plain parts
you've already seen. Cheap fix worth testing: once a slot is filled, a white
roll for that slot becomes blue half the time. Tiers aren't power, so it's
legal.

### M4. Twenty hooks (surprising)

The pool holds at most 20 parts: the 8 whites and 12 others. Finding a 13th
non-white means choosing, on the pickup card, which one it replaces. The one
you let go hangs on the Workshop wall and can be swapped back between runs.

- **Player does:** makes a trade at the moment of a find, the way Still trades
  a part on the floor.
- **Fits because:** moth and flame at the meta layer: taking the new thing
  means putting down a familiar one. And the maths stays fixed however big the
  catalog gets: 30 blue drops ÷ 12 = 2.5 sightings per part, 92% for any one,
  85% for a pair.
- **Cost:** cheap.
- **What breaks:** a player curates the 12 strongest and never changes. Fine:
  that's a player who knows what they like, and M2/M1 keep offering new ones.

### M5. The map gets wider, not the bag (surprising)

Some unlocks aren't parts; they're kinds of places on the node map. The first
Stopped opens the Hollow (a short, quiet level with a Rest shrine). The first
Assembler beaten opens the Den (elites, no shrine). The first Made it opens
the Scrapyard (crates and barrels, few packs). Run 1's map has one kind of
node; run 10's has four.

- **Player does:** gets new decisions on the map, not new buttons.
- **Fits because:** "wider" means more choices, and route choices are the
  cheapest content in the game: rules on an existing generator, no new models.
- **Cost:** medium (the node map needs building anyway; each type is a
  handful of generator knobs).

---

## Topic 3: A complete run

### R1. Three rings of three

Nine depths: crawl, crawl, Assembler, three times. The third Assembler's
arena has no cold beam; its exit is Grace's light, and walking into it is
**Made it**. The Assembler keeps its 900 HP every time and gets more *varied*,
not stronger: ring I as built, ring II's adds are rams, ring III's adds are
mites under a Warden.

| depth | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| kind | crawl | crawl | Assembler I | crawl | crawl | Assembler II | crawl | crawl | Assembler III, then home |
| new | hulk, sentinel | ram | | mites | | | all four mixed | | |

Time: 6 crawls × 4.5 + 3 bosses × 3 + ~4 min of map and fades = **~40 min**.
About 48 normal drops plus 6 from bosses, so a full run sees most of a 30-part
pool.

- **Player does:** crawls toward a known end he can count down to.
- **Fits because:** a run needs a shape. One boss model reused three times is
  the only boss count a one-person project can afford without a treadmill.
- **Cost:** cheap (the Assembler exists; adds are existing archetypes).

### R2. Six and home

Two rings, not three: 6 depths, Assemblers at 3 and 6, Grace's light after
the second. **~26 min**, one sitting on a phone. About 32 normal drops, which
is too few to see a 30-part pool, so it pairs with M3's crate.

- **Player does:** the same run, shorter.
- **Fits because:** phone sessions are shorter than desk sessions, and a
  shorter run makes "try again?" an easy yes.
- **Cost:** cheap.

### R3. Walk home when you choose (surprising)

After the second Assembler, every exit splits in two: the cold beam (deeper)
and a warm door (home). Home is Made it, from any depth past 6. Deeper has
more unfound parts per level (M1's 50% becomes 100% past depth 6) and no end
until you Break or Stop. "Enough" becomes something the player decides.

- **Player does:** at each exit past 6, weighs one more depth against going
  home.
- **Fits because:** the game's only line is that showing up was enough. This
  makes "enough" a choice you make with your thumb, and it gives the run an
  end without an arbitrary cap.
- **Cost:** cheap.
- **What breaks:** endless depths drift toward grind. Cap unfound drops at the
  pool's remaining count; once the wall is full, deeper pays only in the
  keepsake line.

### R4. Two doors (the node map)

Between crawl depths you pick one of two nodes. **Crawl**: as today, ~8 drops,
4.5 min. **Den** (growth): 4 packs, 2 of them elite, no shrine, ~9 drops and a
0.2 gold chance, more strain. **Hollow** (comfort): 3 packs and a sure Rest,
~4 drops, 2.5 min. Six picks a run.

| always picks | drops by depth 9 | strain at the last boss | how it tends to end |
|---|---|---|---|
| Den | ~54 | high, few pushes left | Stopped at Assembler III |
| Crawl | ~48 | middle | any of the three |
| Hollow | ~24 | low | Broken earlier than expected: a thin build at Assembler II |

- **Player does:** one route choice per depth, each a real growth-or-comfort
  call.
- **Fits because:** it's the lineage's reward binary put on the map, where an
  action game has room for it.
- **Cost:** medium (the map screen), cheap per node type.

### R5. Wear: the run's clock

Split strain in two. **Strain** comes and goes as today. **Wear** is a floor
that quiets and Rest can't go below. Wear comes from growth: Plenty gives +2
wear and +2 strain (instead of +4 strain), each Den +1, each Assembler beaten
+2. By depth 9 a player has 4-16 wear, so the last boss is fought with 4-16
strain of headroom (2-8 pushes).

- **Player does:** feels the run close in. Early depths are generous; late
  ones make every push count.
- **Fits because:** it makes "strain is the run" true, and it makes Stopped
  reachable without making it punishment. Always-growth runs hit Stopped at
  the last boss; always-comfort runs don't, but they break (R4 table).
- **Cost:** cheap: one more number and a second mark on the strain bar.

### R6. The last Assembler wears your discards (surprising)

Every part Still dropped during the run (the old part left at his feet on a
swap) is gone to the Assembler. At depth 9, it fights with them: one move per
discarded slot, using the same shape Still used (a Lens bolt, a Vent shove, a
Kickstart rush), with the Assembler's windup rules. The rules are symmetric,
so this is just the rule applied to the boss.

- **Player does:** thinks about what to leave behind, because it comes back.
- **Fits because:** moth and flame: taking the new thing means the familiar
  thing is still out there. It also makes run 10's final fight different from
  run 1's without new content.
- **Cost:** big: each part needs a boss-side telegraph.

### What makes run 10 different from run 1

| | run 1 | run 10 |
|---|---|---|
| wall | 12 of 32 hooks | ~30 of 32 |
| family | empty bench | Yanah and Yuri there, their parts in the pool |
| start | one random white | the part you hung by the door |
| map | one node kind | four (M5) |
| builds | whatever falls | a crate you read at the door, or twenty hooks you chose |
| last boss | as built | wearing your discards (R6) |

None of these rows is a number going up.

### Commitment maths: making Stopped a real call

Offer **Sit down** at any Rest shrine: Still stops by choice, a Stopped ending.
Then give endings a small, honest difference: parts found this depth are kept
by Stopped and by Made it, and lost by Broken (they go back to unfound, still
drawn on the wall as "glimpsed"). Everything from earlier depths is always
kept.

Sit down when `P(break before the exit) × unfound parts carried > value of the
depths ahead`. In play that's one concrete moment: low HP, a bare part in your
slots, a Rest shrine in reach.

Target splits for a 9-depth run with Wear (sim targets, not predictions):

| player | Broken | Stopped | Made it |
|---|---|---|---|
| runs 1-3 | 65% | 25% | 10% |
| runs 4-10 | 45% | 30% | 25% |
| runs 10+ | 30% | 30% | 40% |

Stopped holds at 25-30% at every stage, so the middle ending is common, not a
rare curiosity. That's owner-flagged: it makes Broken cost a little, so it's
his call whether the difference is in what's kept or only in how it looks.

---

## Numbers that need a sim or a thumb

1. How many pushes a level players really make. If under 6, strain never
   carries without R5.
2. The unfound rate (50% per level). It sets the whole pace: 9-11 runs to a
   full wall.
3. Crawl level length at depth 7+ with all four archetypes. At 6 min instead
   of 4.5, R1 becomes 49 min and R2 is the better default.
4. Wear per Assembler (+2). At +3, even comfort runs Stop at the last boss.
5. Whether half the drops being known whites feels flat on the phone before
   any of this is built.

## Summary

1. Two maths problems first: "found joins the pool" needs an unfound-drop channel (its rate is the unlock pace), and −2 per quiet means strain barely carries today, so Stopped is mostly unreachable.
2. Workshop: a wall of parts, a test bench, a hook that hands one part to the next run, a corkboard that draws each run's strain line, and Yanah and Yuri arriving on run count (3 and 6), never on skill.
3. Meta: 12 parts at the start, ~2 finds a run, a full wall in ~9-11 runs (~5-6 h). The endings open different drawers; dilution is minor at 30 parts and real at 50, and a per-run crate or a 20-hook cap fixes it.
4. Run: 9 depths in three rings (~40 min) or 6 (~26 min). The Assembler three times, varied but never stronger; Grace's light is Made it, a two-door node map carries growth vs comfort, and Wear gives the run a clock.
5. Surprising ones: the hook by the door, twenty hooks, the map getting wider instead of the bag, walking home when you choose, and a last Assembler that fights with the parts you threw away.
