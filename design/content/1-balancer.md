# Round 1: Balancer

Systems and maths voice. Pitches for the area II boss, area II's environment,
and enemy variety. Every number is checked against the code as it stands
(`BOSS`, `CHASER`, `RANGED`, `CHARGER`, `BROOD`, the part defs, `dungeon.ts`).
The room numbers come from a quick Monte Carlo in the session scratchpad (40k
samples per row, the real prop placer's rules). They're rough, but they point
the right way.

---

## 0. The yardsticks

### What the pitches are measured against

| thing | number | source |
|---|---|---|
| Still walk / HP | 5.5 u/s / 100 | `still.ts`, `combat.ts` |
| Reaction on a phone | ~300 ms | enemies pass §2.3 |
| **Dodge slack** | windup − 300 − 1000 × (escape u ÷ 5.5); **target ≥ 150 ms** | the rule every tell below is sized with |
| Still output, four whites, one target | ~25 dps if every button fires on cooldown; ~12–15 in practice | auto 8.1, Lens 6.2, Cleaver 6.9, Vent 2.3, Kickstart 1.5 |
| Assembler | 900 HP, damage 7–22 a hit, windups 620–1500 ms, ~90–120 s fight | `BOSS` |
| Boss rule for this round | **900 HP, no hit above 22, no windup under 620 ms** | "never a bigger number" |
| Vent shove | 4.2 − 0.35·d, min 2.4 u (+8% overshoot) | `PART` |
| Room half-widths | side 6 u, main 10 u, hall 10 × 6, arena 14 u | `SIZE`, `CELL` 4 |
| Pack budget (BE) at depth 4 / 5, main room | 4–5 / 5–6 | `size` formula |

### What room size and cover do to the existing enemies

| room | cover | ram lane ends in a solid (stun) | sentinel line blocked |
|---|---|---|---|
| 12 u (side) | 1 prop / 4 cells | **69%** | 18% |
| 20 u (main, today) | 1 / 4 | 39% | 16% |
| 20 u | 1 / 2 (dense) | 53% | 33% |
| 20 u | 1 / 8 (sparse) | 33% | 9% |
| 28 u | 1 / 4 | 32% | 18% |
| 28 u | 1 / 8 | 25% | 9% |

In words: **dense cover makes rams and sentinels weaker, and big open rooms
make both stronger.** An environment moves these two columns more than any
new enemy does. The 69% is why rams are already banned from side rooms.

### How much new content the run can teach

A 6-depth run has about four teaching slots: depth 1 (hulk, sentinel), depth
2 (ram), depth 4 (mites, already taken), and depth 5 (free). Area II is
about 10 minutes of crawl. **At most two new enemy mechanics fit in area II**
without it turning into a tutorial. There's also a second fact: depth 1–2 are
played in every run, and depth 6 maybe in 50–65% of them (the warm beam at
3, plus deaths). Per minute played, variety in area I pays about 1.7x what the
same variety pays in area II. One of my enemy pitches is aimed there on
purpose.

---

## 1. Second boss (depth 6)

All four keep 900 HP and the Assembler's damage band. None is a bigger
number. Each one tests something the Assembler doesn't.

### B1. The Kiln *(changes what the arena does)*

A squat furnace on four legs in the middle of a 28 u arena whose floor is 49
iron grates (one per 4 u cell) over a firebox. Its main move is the floor
itself: **Stoke** heats a *pattern* of grates (stripes, checker, ring,
quadrants). They glow up from below for 1000 ms, then burn for 1.2 s at 12 a
touch, and they hurt its own adds too. The patterns are authored, never
random: random 60% coverage leaves a p99 escape of 7 u (1.3 s), but a
pattern keeps every escape ≤ 2.4 u (440 ms, slack 260 ms). Its other moves
are **Bellows** (a 60°, 8 u cone of cinders, windup 900, 14 damage; the
cinders count as *shots*, so Ward and Mirror Ward still have a job) and
**Clinker** (3 lobs, 1100 ms flight, r 1.5, 10 damage, leaving a 3 s puddle
that slows every body 0.6x). At 55% it adds **Draw**. Every grate heats
except the 3x3 around it, and 2.4 s later it slams a r 4 ring, so the only
safe floor for that beat is the 2 u band between 4 and 6 u from its body.
After the slam its grate hangs open for 1.5 s at ×1.5 damage.

- **Player:** reads the floor and not just the body, keeps a route to cold
  iron, and at 55% steps *toward* the boss into the band.
- **Tests:** holding a position over time. The Assembler tests reading a body
  at one moment.
- **Fits:** the unused `foundry` ambience layer, the old Thermal Arbiter ("it
  measures everything"), and ember as the language of threat. It must be a
  textured glow from the grates, never flat red.
- **Parts:** Frost Trail and Chill Vent **cool a grate for 2 s** (cold beats
  heat, both ways), which lifts two weak blues into key parts. Skitter and
  Spring Heels are airborne, so they never touch a hot grate. Brace becomes
  risky, because grate ticks turn into strain. Lure is useless (bosses ignore
  it, as today).
- **Cost: medium.** The grates are `tellMaterial` decals, and the patterns
  are data. The body is new.

### B2. The First Warden

A tall gatekeeper carrying a door slab as a shield, standing where the warm
beam will open ("it does not remember what it was built to protect, only the
door"). The slab is **solid, for both sides**. It blocks Still's bolts, his
auto and his melee line, and it also blocks the Warden's own adds' shots, and
a ram add that rushes into it stuns. The slab turns at 1.2 rad/s. Still
circling at radius r turns at 5.5 / r rad/s, so **he out-turns the shield
only inside 4.6 u**, which is inside its **Bash** (6 u lunge, 2.2 u wide,
windup 800, 16 damage, slack 220). Its **Lamp** sweeps a 10 u line through
90° over 1.5 s (10 damage, cover blocks it). At radius ≤ 5.2 you outrun the
sweep, and further out you have to hide. At 55% it **Plants** the slab as a
wall for 4 s and fights around it with a lamp, and two sentinels come in
behind the planted slab.

- **Player:** gets close to get behind it, and uses the planted slab as his
  own cover.
- **Tests:** angles and patience. The Assembler tests timing.
- **Fits:** "walls block both ways" becomes the boss itself, and it guards
  the door home.
- **Parts:** Ricochet Lens, Flare, Signal Flare and Through-Line get much
  stronger (Through-Line's breach opens the slab for both sides). Focusing and
  Cracked Lens get weaker, since they only land from the flank. The auto only
  takes clear shots, so its output tracks your flank uptime: at 40% the fight
  runs ~100–130 s. Parry Clamp still can't break a boss.
- **Cost: medium.** A moving solid is new to `terrain.ts`. It shares the slab
  with enemy E2, so building one pays for both.

### B3. The Gantry

A crane that rides rails over the open-topped arena, with a cab on stilt legs
that walks the rails, one axis at a time. **Drop** puts a 2x2 u scrap block
where Still stands: its shadow grows for 1200 ms, 20 damage if you're under
it, slack 570. The blocks are solid for everyone. **Lift** takes a block
away, and cover that was there is gone. **Swing** sends the hanging load
across a 14 u arc (tell 1400 ms, 16 damage), and **a block in the arc stops
it**. In phase 2 some drops are crates that open into a ram, which then stuns
on the blocks you made. The cab lowers to reload every ~20 s and stays hittable
for 3 s at ×1.5.

- **Player:** builds his own cover map by choosing where to stand when a drop
  comes: a block behind you for the ram, a block in the swing's arc.
- **Tests:** managing cover as a resource that changes. The Assembler's
  cover never moves.
- **Fits:** a foundry machine that builds out of scrap, the Assembler's
  bigger sibling, and it's still telegraphed and committed.
- **Parts:** Ricochet (more walls to bank), Clamp Toss (more wall damage) and
  Spring Heels (vault the blocks) get stronger. Kickstart gets weaker, because
  a dash stops at the first solid. Rams stun more (the table in §0: dense
  cover means 53%).
- **Cost: medium-big.** Blocks are whole cells, so the path grid updates
  cheaply, but the crane rig and the swing are new.

### B4. The Understudy *(surprising)*

The Assembler was carrying off what Still left behind. **The depth-6 boss is
built from the parts Still swapped out this run**: the most recent discard
per slot, and the matching white where a slot has none. It fights with them
from the other side in ember, each on an enemy windup (≥ 700 ms) at a **flat
damage by shape**, not the part's own number: bolt 12, lob 14, arc 18, nova 16
with a 3 u shove, dash 20. Ward destroys Still's bolts for 1.4 s. **Its Lure
pulls Still's auto-targeting**, because the rule is symmetric. Phases come by
slot: at 55% it adds its gold, if Still dropped one. You know every range it
has, because you carried them.

- **Player:** reads a kit he has already worn. Every run's boss is different.
- **Tests:** knowing your own parts. None of the others can.
- **Fits:** "Still's mirror", as `boss.ts` already calls the Assembler.
  Runs get wider, so the boss does too. Moth and flame: what you let go comes
  back.
- **Parts:** balance is bounded by the flat per-shape damage, so any
  combination lands in the Assembler's band. Worst case is Borrowed Time and
  Anvil on its side. Suggest mapping both to a plain "catch" (a 900 ms counter
  window with a visible shell).
- **Cost: big.** It needs 12 shapes as enemy moves with ember tells. It's the
  most distinctive pitch, and the most expensive.

### The four side by side

| | tests | changes the arena | push windows / fight (× 1.5) | cheapest build |
|---|---|---|---|---|
| Assembler (today) | read a body, wall-stun bait | no | ~4 stuns × 1.7 s | – |
| B1 Kiln | position over time | **yes: the floor** | ~3 × 1.5 s (after Draw) | grates are decals |
| B2 Warden | angles, flanking | partly (the planted slab) | ~3 × 4 s (planted, from behind) | shares E2's slab |
| B3 Gantry | cover as a resource | **yes: cover moves** | ~5 × 3 s (the cab) | whole-cell blocks |
| B4 Understudy | your own kit | no | varies; bounded ~3–4 | none |

**Why push windows matter:** after depth 6 there's only the warm beam, so
strain left over is worth nothing except as the Stopped line. The last fight
is where a pushing player spends his runway. Entering at strain S₀ leaves
⌊(19 − S₀) ÷ 2⌋ pushes before Stopped. At S₀ = 10 that's 4, which is about one
per window. **A boss with no good windows makes Stopped unreachable at the
end.** All four have them, and B2's 4 s windows pull the most pushes.

---

## 2. Second environment (area II)

The kits are re-skinned triplanar and their own colours are thrown away
(`kit.ts`). So **only silhouettes have to match**, and mixing CC0 kits is
cheaper than it looks. Verify each pack's pieces before planning on one.

### E-A. The Works

The Assembler's foundry floor, which area I's ruin was the cellar of. Machinery
blocks (waist-high presses, crucibles and sumps) raise cover density to
about 1 per 3 cells. **Slag gutters** cross 40% of the main rooms: 1 u
trenches that flare every 6 s (tell 900 ms, 10 damage to every body, slack
430). **Rollers** carry crates across a room at 1 u/s, so cover moves.
Bodies never ride them, which keeps every tell honest. Afternoon is pale,
cold light through a broken roof, grading toward blue at depth 5. The gutters
look brighter as the sky dims: more threatening to look at, never stronger.
The `foundry` layer (boss-only today) becomes area II's bed, rising near
gutters.

- **Numbers:** dense cover puts the ram stun near 45% (weaker rams) and
  blocks sentinel lines ~25% of the time (weaker sentinels), so this
  environment *needs* the lobber (N1) to punish cover.
- **Kit:** KayKit Dungeon Remastered for the shell (it fits already), plus
  Kenney's Conveyor Kit (CC0) for the rollers and machine shapes, and
  ambientCG Metal / MetalPlates / CorrugatedSteel / Concrete skins (IDs to be
  picked in `look.html`).
- **Parts:** Lure gets stronger (walk a pack across a flare), and so does
  Ricochet (more walls). Kickstart gets weaker (more solids in the way).
- **Cost: medium.**

### E-B. The Drowned Yard

A flooded sluice yard: stone basins, drains and weirs. **Ankle water slows
every body's walk ×0.8** (Still 4.4, hulk 3.4, mite 3.8). Dashes, hops and
rushes are committed moves and keep full speed, so **the legs slot matters
more**. **Channels** are one cell of deep water: a new terrain kind that
blocks walking but not sight. A sentinel across a channel can see you, and
you can't walk to it. Spring Heels (4.6 u vault) clears one, and Flare and
the Lens answer it. **Frost Trail freezes a 3 s bridge** that either side can
walk. Dusk is the low sky reflected in the water, cold. Grace's light is the
only warm thing on its surface.

- **Numbers:** kiting gains 0.96 u/s on a hulk instead of 1.2, which is 20%
  slower. Mites (3.8) still can't catch Still (4.4).
- **Kit:** the same KayKit floor and barriers, a shallow water plane, and
  ambientCG Ground / mud skins.
- **Cost: medium** (a water shader and one terrain kind).

### E-C. The Viaduct *(surprising)*

The way home leaves the ruin across a broken rail viaduct over a valley full
of fog. Rooms are 20 u platforms joined by 4 u spans, with 12 u decks, and
**an unrailed edge drops anything shoved over it**. The drop kills an enemy
(it counts as a kill, and its loot lands at the lip). Still's dash stops at
the lip, and no current enemy shoves Still. **The ram's lesson inverts:** a
wall behind you stuns it, and a drop behind you ends it. The lane tell shows a
third end glyph for air. Sunset is behind the valley, and the fog below is
the plausible beyond the camera needs anyway.

- **Numbers (sim):** on a 12 u deck, Vent throws 20% of what it shoves
  over, Piston 8%, Skid 6%. That's too strong with no rails. **Rail 50% of
  the edge length** (waist barriers, which also block shoves) to cap Vent near
  10%. Elites and Plated catch the lip and climb back, stunned 1.2 s.
- **Parts:** Clamp Toss becomes a kill button at an edge. Cap it with the
  elite rule, and watch it first. Vent, Piston, Skid, Parry and Anvil get
  stronger. **Backdraft gets weaker** (it pulls enemies away from edges).
- **Fix first:** the 8% knockback overshoot in CATALOG's open list. On a
  viaduct it decides falls, so make it exact before this ships.
- **Cost: medium** (a fall animation, and void not blocking a slide).

### E-D. The Allotments

Outside at last: overgrown garden plots behind the ruin, with low dry-stone
walls, cold frames and bean poles. **Rooms are 7x5 cells (28 x 20)**, with
sparse cover (1 per 6–8 cells) and long low-sun shadows. The grade does the
work. Hard desaturation keeps the green from reading as colour, and the fog
thickens from depth 4 to 5.

- **Numbers:** the opposite of the Works. Ram stun falls to ~25% and
  sentinel lines are blocked only ~9%, so **rams and sentinels are both
  stronger with no stat change**, which is "deeper is more varied" done by
  layout alone. The lobber has nothing to punish here. Pair it with the
  shield-bearer (N2, portable cover).
- **Parts:** Focusing Lens, Cracked Lens, Patient Lens and Kickstart get
  stronger. Ricochet gets weaker (few walls to bank).
- **Kit:** KayKit Forest Nature Pack (CC0, same author and silhouette
  language as Dungeon Remastered), plus KayKit barriers for the dry-stone
  walls.
- **Cost: cheap-medium.** Bigger rooms are one entry in `SIZE`, and most of
  the work is the look.

### Layout against ability ranges

| range | u | fits a 12 u side room | 20 u main | 28 u allotment | 12 u deck (lateral) |
|---|---|---|---|---|---|
| Vent / Backdraft / Hook | 4.3 / 5.2 / 5.5 | yes | yes | yes | reaches both lips from the centre |
| Kickstart | 6.4 | hits a wall | yes | yes | stops at the lip |
| Auto | 7.6 | whole room | most of it | under a third | – |
| Sentinel band | 6–10 | squeezed | comfortable | holds 10 with room behind | – |
| Ram rush | 6–11 | 69% stun | 39% | 25–32% | falls if unrailed |
| Mite outer ring | 5.5 (11 across) | touches the walls | yes | yes | spills over the lips (mites avoid edges) |

---

## 3. Enemy variety

Every new body keeps the four-archetype HP range (8–36) and the damage range
(3–22). None is stronger. Each one punishes a habit nothing punishes today.

### N1. Slag Lobber *(new archetype; area II, the Works)*

A squat crucible on three legs that holds 8–12 u and **lobs over walls** onto
where Still will be (lead 0.3 s). The landing circle is r 1.6, with 1100 ms
flight from launch as the tell, 10 damage (slack 450). It leaves a 3 s
puddle that slows every body 0.6x, and reloads in 2.2 s. HP 22, **BE 1**.
It's the enemy mirror of Still's Flare.

- **Player:** stops camping cover and walks out of circles.
- **Why:** "behind cover" is safe against every archetype today (the habit
  matrix). This is the first thing that punishes it.
- **Parts:** Ward and Mirror Ward are **useless against it** (a lob isn't a
  shot). Flare, Signal Flare, Kickstart, Overrun and Plumb Line get stronger.
  Hook (5.5) can't reach it.
- **Pack rule:** lobbers + sentinels ≤ 2 per pack. All-ranged packs make both
  cover *and* open ground wrong, and then there's no answer.
- **Cost: medium** (an ember version of the Flare telegraph, and a new body).

### N2. Shield-bearer *(hulk variant; the Warden boss shares its slab)*

A hulk carrying a slab that is solid in front (2.2 u wide, turning at 2.5
rad/s): it blocks bolts and the auto from the front, for both sides. HP 30,
the same slam, **BE 1.25**. A sentinel behind it is safe from you, and it's
just as true that a shield-bearer between you and the sentinel shields
*you*. A ram that rushes into the slab stuns.

- **Player:** flanks, or baits the ram into it.
- **Why:** it makes Area II's open rooms (E-D) have cover that walks.
- **Parts:** Focusing and Cracked Lens are frontally useless. Ricochet,
  Flare, Clamp Toss (grab from the side) and Parry (a broken windup drops the
  slab for 1.5 s) get stronger.
- **Cost: cheap-medium** if the slab only stops projectiles (a moving arc
  test on bolts). It goes up to medium if it also blocks bodies.

### N3. Live cores *(a mechanic layered on hulks and rams; area II)*

About 40% of area II's hulks and rams carry a flickering core. **700 ms after
death it bursts**: r 2.4, 10 damage to every body with a clear line (cover
blocks it). A burst that kills another live core chains, one link every 0.7 s,
and you can see it travel. No mites (eight bursts would be noise).

- **Player:** kills from range, or pulls the pack tight and pops one.
- **Why:** it makes killing order and killing position a decision without a
  single HP change. Backdraft (pull to 1.4 u) then a Cleaver kill leaves 1.4 u
  to escape in 700 ms: slack 140, which is tight but fair.
- **Parts:** Cleaver and Frayed Cleaver get weaker (they kill inside the
  radius). Focusing Lens, Clamp Toss (throw it into its pack) and Backdraft
  get stronger. Skitter hops the burst.
- **BE:** unchanged. It's the same body.
- **Cost: cheap.** One death event, one ring tell, damage on all bodies.

### N4. Scrap Picker *(surprising; new archetype, any area from depth 2)*

A small, quick scavenger that **never attacks**. When a part lies on the
floor, mid-fight or not, it runs for it (6.2 u/s, faster than Still), picks it
up and carries it (4.0 u/s, slower than Still) toward the nearest sleeping
pack. Kill it (HP 12: one Lens, or three autos) and the part drops. It only
takes *found* parts, so nothing new is ever lost and "never leave with
nothing" holds. There's one per level at 35%, never on a boss level, and it
sits outside the pack budget.

- **Player:** chooses between the fight in front of him and the thing he
  wanted, which is running toward a pack that isn't awake yet (it wakes at 8
  u).
- **Why:** moth and flame on the loot floor, and variety at depth 1–2 where
  every run plays. None of the documents has an enemy that doesn't fight.
- **Parts:** Hook, Clamp Toss, Focusing Lens, Chill Vent and Frost Trail get
  stronger. Nothing is made useless.
- **Cost: cheap-medium** (a new small body, and one flee behaviour).

### N5. Wire pair *(new archetype; area II)*

Two spider pylons (HP 14 each, **BE 1 for the pair**) that stand ≤ 8 u apart
with a live wire between them. The wire flickers for 600 ms each time they
stop, then burns anything that crosses it: 8 damage, once per body per
second, **enemies included**. They step to keep the wire across Still's line
to him. Kill either one and the wire dies.

- **Player:** keeps the wire between himself and a hulk, and kites hulks
  through it (4 crossings kill one).
- **Why:** it's a hazard that walks, so the level changes shape mid-fight.
- **Parts:** Lure (drags the pack across the wire), Backdraft and Clamp Toss
  get stronger. Kickstart is risky, because a dash through the wire is a
  crossing.
- **Cost: medium.**

### The habit matrix, extended

| habit | today's four | N1 lobber | N2 shield | N3 live core | N4 picker | N5 wire |
|---|---|---|---|---|---|---|
| standing still | hit by all | hit | hit (slam) | – | – | – |
| **behind cover** | **safe from all** | **hit** | – | safe (cover blocks bursts) | – | – |
| shooting from the front | fine | fine | **blocked** | fine | fine | fine |
| melee kill in a crowd | fine | – | – | **burst** | – | – |
| **looting mid-fight** | **free** | – | – | – | **contested** | – |
| dashing through a pack | fine | – | stopped by the slab | – | – | **burned** |

### Pack rows for area II (budget unchanged)

| depth | row | BE | weight | note |
|---|---|---|---|---|
| 4 | M8 (lesson, existing) | 2 | lesson | |
| 4 | C + H + H | 3.5 (+fill) | 2 | existing |
| 5 | **L + H + H** | 3 (+fill) | 1 | the lobber lesson, in a covered room |
| 5 | **N2 + S + H** | 3.25 | 1 | the shield covers the sentinel, or you |
| 5 | **C + N2 + H** | 3.75 | 1 | bait the ram into the slab |
| 5 | **W + H + H** | 3 | 1 | wire pair + hulks to kite |
| 5 | M6 + L | 2.5 | 1 | rings on the floor, circles from the sky |
| 5 | today | – | 2 | |

---

## 4. Parts touched, in one table

Only the non-neutral entries. **Bold** means useless or near-useless there.

| part | stronger with | weaker or useless with |
|---|---|---|
| H1 Focusing Lens | E-D, N3, N4 | N2 (front), B2 (front) |
| H2 Flare | N1, B2, E-B (channels) | – |
| H3 Cracked Lens | E-D | N2 (front), B2 (front) |
| H4 Ricochet Lens | B2, B3, E-A, N2 | E-D (few walls) |
| H5 Patient Lens | E-D | – |
| H6 Signal Flare | B2, N1 | – |
| H7 Through-Line | B2 (breaches the slab both ways) | – |
| T1 Pressure Vent | E-C | – |
| T2 Ward | – | **N1 (lobs aren't shots)**; kept alive in B1 by Bellows' cinders |
| T3 Backdraft | N3, N5 | E-C (pulls away from edges) |
| T4 Chill Vent | B1 (cools grates), N4 | – |
| T5 Brace | – | B1 (grate ticks become strain) |
| T6 Mirror Ward | – | **N1** |
| T7 Lure | E-A (gutters), N5 | **all bosses** (unchanged rule); B4's own Lure turns on Still |
| A1 Scrap Cleaver | – | N3 |
| A4 Parry Clamp | N2 (drops the slab) | – |
| A5 Frayed Cleaver | – | N3 |
| A6 Clamp Toss | E-C (**watch: a kill button**), N2, N3, N4, B3 | – |
| L1 Kickstart | E-D, N1 | B3, E-A, N5 |
| L2 Skitter / L6 Spring Heels | B1 (airborne over grates), E-B (vault channels), B3 | – |
| L5 Frost Trail | B1 (cools grates), E-B (ice bridge), N4 | – |
| L7 Plumb Line | N1 | – |

Nothing here makes a part useless everywhere. Ward and Mirror Ward are the
only parts that lose a whole enemy (N1), and they keep sentinels, B1's
cinders and the Assembler's barrage.

---

## 5. Maths problems I'd flag now

1. **The D7 pack table is dead.** The run is capped at 6, so `D7` and
   `kinds: 4` never occur. "By depth 7 you meet packs with all four
   archetypes" (CATALOG) no longer happens. Area II's new rows should replace
   D7's role at depth 5.
2. **Two new mechanics, at most, in area II.** Depth 4 already teaches mites.
   Pick one enemy for depth 5 and one layered mechanic (N3 needs no lesson
   room: the first burst teaches itself).
3. **Ward in a boss with no shots.** B1 as first drawn had none, so Bellows
   spits cinders as shots. Every boss pitch keeps at least one move per
   torso part.
4. **Stopped at the end.** At quiet −2 most players enter depth 6 near 0–6
   strain, and the boss can't threaten Stopped. At quiet −1 (meta's feel test)
   a 5-push player arrives near 10–14, and the boss's push windows decide it.
   Settle quiet before tuning the second boss's windows.
5. **The second Assembler** (meta step 8) becomes the fallback. If no
   boss here ships, its rams-and-mites adds are still one evening.

---

## 6. The bundle I'd back

**The Works + the Kiln + the Slag Lobber + live cores**, with the Scrap Picker
in area I. They share one language (heat, ember, lobs), and one telegraph set
(the Flare lob in ember, grate decals, a burst ring). They use the idle
`foundry` layer and the old sector-2 names (Furnace Tick, Slag Heap, the
Thermal Arbiter, Meltdown Core). The dense cover weakens rams and sentinels
exactly where the lobber arrives to punish hiding. The Kiln gives Frost Trail
and Chill Vent a reason to exist. Roughly 6–9 evenings. The Viaduct is the one
I'd prototype if you want a surprise more than coherence.

---

## Summary

1. Bosses: the Kiln (the floor is the attack, arena-changing), the First Warden (a rotating solid slab, out-turned only inside 4.6 u), the Gantry (drops and lifts cover), and the Understudy (surprising: built from your own discards). All stay at 900 HP, ≤ 22 a hit.
2. Environments: the Works (dense cover, gutters, moving crates), the Drowned Yard (×0.8 walk, channels), the Viaduct (surprising: shoved bodies fall; rail 50% or Vent throws 20% off), and the Allotments (28 u rooms make rams and sentinels stronger by layout alone).
3. Enemies: the Slag Lobber (first thing to punish hiding; Ward useless against it), the shield-bearer (shares the Warden's slab), live cores (cheap death bursts), the Scrap Picker (surprising: never attacks, steals floor loot), and the wire pair. The pack rows fit today's BE budget.
4. Flags: D7 is dead in a 6-depth run, area II fits at most two new mechanics, fix the knockback overshoot before edges, and settle quiet −1 before tuning the last boss's push windows, or Stopped can't happen at the end.
5. Backed bundle: Works + Kiln + Lobber + live cores (shared ember language, ~6–9 evenings), with the Scrap Picker in area I where every run plays.
