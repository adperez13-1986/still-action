# Area III, round 1: Balancer

Systems and maths voice. Every number below is read off the code as it stands
(`CHASER`, `RANGED`, `LOBBER`, `CHARGER`, `MITE`/`BROOD`, `THIEF`, `BOSS`,
`ARBITER`, `SLAG`/`SLACK` in `hazard.ts`, `SIZE`/`CELL` and the pack
budgets in `dungeon.ts`, the part defs in `abilities.ts`). The strain numbers
come from a rough Monte Carlo in the session scratchpad (40k runs a row, the
same three players as the strain round: *watches the bar* keeps 6 back in the
crawl and 2 at bosses; *spends at bosses* keeps 4 and 0; *keeps nothing*). The
model is crude. Read it for direction and size, not to the percent.

---

## 0. Yardsticks

| thing | number | source |
|---|---|---|
| Still | 5.5 u/s, 100 HP, radius 0.42 | `still.ts`, `combat.ts` |
| Auto attack | 5 dmg every 0.62 s, range 7.6, clear shots only | `combat.ts` |
| Four whites, one target | ~25 dps if every button fires on cooldown, ~12-15 in practice | auto 8.1, Lens 6.2, Cleaver 6.9, Vent 2.3, Kickstart 1.5 |
| Dodge slack | windup − 300 − 1000 × escape ÷ 5.5, **≥ 150 ms** | `SLACK`, the Hazard INV |
| A push lands | ~430 ms after the tell (180 hold + 250 react), + d/26 s for a bolt | strain round 2 |
| Rooms (half-width) | side 6 u, main 10, hall 10 × 6, arena 14; props inside ±8.6 (main), ±12.6 (arena) | `SIZE`, `CELL` = 4 |
| Wake / leash | 8 u / 16 u | DESIGN |
| Boss rule | 900 HP, no hit > 22, no windup < 620 ms | `Boss` INV |
| Run | 4 crawls × ~4.5 min + 2 bosses × ~2 min + fades ≈ 26 min | meta balancer |

### What the strain model says before any pitch

This is the frame for every "Stopped" line below.

| setup (depth 4-6) | crawl asks / fight | boss asks | spender: strain entering 6 | spender: P(Stopped at 6 \| reached) |
|---|---|---|---|---|
| area II today (step 1 not built) | ~0.2 | Arbiter 7 heats, ~half pushed | 0.0 | **0%** |
| area II + strain steps 1-2 | 1.25 | 7 | 3.6 | 7% |
| area III crawl mechanic alone (no step 1) | 0.7 | 7 | 0.4 | 1% |
| area III + steps 1-2 | 1.75 | 5 | 6.2 | 17% |
| area III + steps 1-2 | 1.75 | 7 | 6.9 | 30% |
| area III + steps 1-2 | 1.75 | 9 | 6.3 | 40% |

Three facts to take into every pitch:

1. **No boss can Stop a Still who walks in at 0.** Seven asks answered at 60%
   is about +8 strain. Stopped at depth 6 needs strain carried in from the
   crawl.
2. **Crawl strain only carries above one push a fight.** A push costs 2 and a
   quiet refunds 2, so at 0.6 answered, a crawl needs about 1.7 asks a fight
   before the bar moves. An area mechanic on its own (≈ 0.5 asks) makes the
   push *wanted*, inside the free band, and makes nothing reachable. That is
   still worth having, because it's the owner's complaint. Stopped comes from
   step 1 plus the area, and from the boss.
3. **Boss ask count is the steep dial:** about +5 points of Stopped per extra
   ask for the spender. The watcher is at 0% in every row, which is correct:
   Stopped only happens to a player who chose to spend.

**What step 1 means here.** The code today has no "a pushed hit breaks the
wind-up". Only Parry Clamp and Clamp Toss interrupt (`combat.ts` 1333, 1453).
The grill locks and the Lobber's heat aren't built either; the free-push pips
on the strain bar are. Every pitch below says whether its push demand stands
without step 1.

---

## 1. The area

Area III sits in the afternoon to dusk, like area II (see §4). Each pitch
lists what it does to the numbers the existing enemies live on. From the area
II round's placer Monte Carlo: in a 20 u room, cover at 1 per 2 cells stuns a
ram 53% of the time and blocks a sentinel 33%; at 1 per 8 it's 33% and 9%. In
a 28 u room at 1 per 8 it's 25% and 9%.

### A1. The Line: the sidings, then the station *(changes how the level behaves)*

The railway home. Depth 4 is the goods sidings, depth 5 the station, and the
boss stands in the roundhouse. One or two straight rail lines cross the whole
level, cutting through two or three main rooms and the corridors between, and
running out into the fog at both ends. **A shunting engine runs each live line
on a timetable** (every 16-22 s, a fixed period per line, so a level has a
rhythm you learn). The rails ahead of it light ember 1.5 s before it arrives,
with a two-tone horn, and it runs 14 u/s: a strip hazard 2.6 u wide, 22 damage,
that hits **everything** on it, Still and enemies alike. Parked wagons stand
on dead sidings (a rail with a wagon on it is dead; a clear rail is live) and
are the waist-high cover. Depth 5's platforms are 5x3 halls with the live rail
along one side, more intact toward the exit, like the quarter.

| check | number | ok? |
|---|---|---|
| escape from the rail's centre | 1.3 + 0.42 = 1.72 u = 313 ms | slack 1500 − 300 − 313 = **887 ms** |
| what one pass kills | sentinel 20, Lobber 22, thief 12, mites 8; leaves a hulk at 8, a ram at 14 | "the train kills anything that shoots" |
| strip width vs rooms | 13% of a 20 u room; 22% of a 12 u hall, so in halls the rail runs along the edge | never in side rooms |
| a pass through a 20 u room | 1.4 s | |
| shove reach onto the rail | Vent 4.3, Backdraft pull 5.2 → 1.4, Hook 5.5 → 1.6, Toss throws 5.0, Piston 1.6, Skid 1.4, Kickstart 1.2 | most slots have a way |

- **One rule to stop it being free:** enemies step off lit rails unless
  they're committed (winding up, striking, rushing, recovering). Without it,
  standing by the rails lets the train clear packs for you. With it, the train
  pays out only on a hulk that commits a slam on the rails, a brood biting
  there, or something you shove or pull on in the last ~0.6 s. That's the ask.
- **Push demand (stands without step 1):** about one train a fight in a rail
  room. When a pack is by the rails and the horn sounds, the shove part you
  want is cooling ~70% of the time (Vent 6.5 s, Backdraft 6.5, Skid 8). A
  pushed Vent that puts three bodies on the strip is up to 66 damage for 2
  strain, most of a pack's 80 HP. Estimate: **+0.3-0.5 asks a fight**,
  answered often, because the payout is visible.
- **Run length:** neutral to −5% a level (trains finish fights; nothing makes
  you wait for one).
- **Stopped:** with step 1, crawl asks go from ~1.25 to ~1.75 a fight, and
  entry strain at depth 6 from ~3.6 to ~6.2 for the spender. Without step 1 it's
  inside the free band: wanted, not paid.
- **Parts:** see the bundle's parts table (§5). Backdraft Vent is the one to
  watch.
- **Fits Still:** the commute home, by rail. The lit rails are the same ember
  tell language as the ram's lane, and the engine is the boss you'll meet at
  dusk (A1 and B1 share one model), seen passing all afternoon.
- **Kit and cost: medium.** Rails, sleepers, wagons, buffers and the engine are
  primitives (0 KB), skinned with `Metal063` and `Planks023A`, which are
  already vendored. Ballast needs one ambientCG gravel set (~250 KB). Room tone:
  synthesized couplings and a far horn; rail clicks at the music's tempo. The
  horn and the lit strip are on the `Hazard` strip that already exists (the
  lance uses it). Generator work: straight lines across the layout, gaps in
  barriers where a rail crosses. **~3 evenings for the kit and generator, 1.5
  for the shunter.**

### A2. The Glasshouses: the market gardens at the edge of town *(changes how the level behaves)*

Long iron-framed glasshouses and potting sheds. **Most cover is glass: a
pane stops a body or a shot once, then shatters.** That goes for either side:
a sentinel's shot breaks your pane, your auto breaks the one it hides behind,
a ram goes through glass without a stun (only the brick piers stun it), and a
Lobber's shell breaks what it lands on. Cover starts dense and thins as a fight
goes on.

| | start of a fight | after ~8 panes break |
|---|---|---|
| cover density (glass + brick) | 1 per 2.5 cells | ~1 per 6 |
| sentinel line blocked | ~30% | ~12% |
| ram stunned | brick only, ~30% | ~28% |

- **Push demand:** a race. Once your pane goes, the sentinel has a clear line,
  so the kill you wanted in 3 s is wanted in 1. Estimate **+0.2-0.3 asks a
  fight**, mostly against sentinels, which are exactly the targets step 1 can
  already break.
- **Run length:** neutral. The first half of a fight is slower (blocked both
  ways), the second faster.
- **Stopped:** crawl ~1.5 asks with step 1, about 24% for the spender at 7 boss
  asks (between II and A1).
- **Parts:** Ricochet Lens banks off brick only (it breaks glass instead), so
  it's weaker. Ward and Mirror Ward are better: they save your panes. The
  Lobber becomes very strong here, so keep it out of this area.
- **Readability risk:** pale glass next to pale Still. The panes need to be
  grimed green-grey, not clear.
- **Cost: medium.** Breakables exist (crates break to any hit). A pane is a
  new breakable that also blocks shots and bodies, from primitives, with the
  existing chunk VFX and one grime texture (~200 KB). ~3-4 evenings.

### A3. The Sorting Office *(surprising; changes how the level behaves)*

The parcel office by the station. **Conveyor belts carry every body on them at
1.6 u/s:** Still, enemies, crates. The belts are strips across rooms, never
along the spine. What changes is the kiting maths at a belt's edge. Upstream
on a belt, Still's ground speed is 5.5 − 1.6 = 3.9, *under a hulk's 4.3* when
the hulk is off the belt, so a hulk catches him there. Downstream he's 7.1 and
nothing catches him. A ram rushing along a belt goes 19.6. Crates ride the belt
into a chute 12 u on (7.5 s): **a crate is a timed chance** (30% repair scrap
+20 HP, 10% a part).

- **Push demand (stands without step 1):** the crate leaving on the belt while
  your Lens cools. It's an HP-for-strain trade, about 6 HP of expected value
  for 2 strain (free if it's the fight's first push). That's worth it when
  hurt and not when full, which makes it a real decision between Broke and
  Stopped. Estimate **+0.2-0.3 asks a fight**.
- **Run length:** +10% if the spine crosses belts badly. Keep belts across,
  not along.
- **Parts:** Kickstart and Overrun downstream reach 8 and 11 u. Frost Trail on
  a belt is carried along (strip moves), which is odd, so the rule is that it
  isn't carried.
- **Cost: medium-big.** A velocity field on every mover and on Still, pathing
  that doesn't know about belts (enemies look dumb on them), and scrolling UVs
  on `MetalWalkway014` (already vendored). ~4 evenings.

### A4. The Reservoir *(cheap; geometry only)*

A drained reservoir basin (depth 4) and its pump house (depth 5). Depth 4's
main rooms are **7x7 cells (28 u)** with cover at 1 per 8; depth 5 is narrow
5x3 halls, dense. It's the dial I found last round, turned as far as it goes:
open rooms make rams and sentinels stronger and punish nothing.

| | 20 u room, 1/4 (today) | 28 u basin, 1/8 |
|---|---|---|
| ram lane ends in a solid (stun) | 39% | 25% |
| sentinel line blocked | 16% | 9% |
| share of the room's width under auto reach (7.6) | 76% | 54% |

- **Range checks:** two packs in a 28 u room can't both stay under the 8 u wake,
  so one pack per basin room, to keep "no chain-waking". Sentinels (fire 12)
  and Lobbers (13) cover half the basin from a corner. A ram's rushMax is 11,
  so most rushes end in the open.
- **Push demand:** none new. Step 1's sentinel asks go up a little, because
  sentinels are blocked less.
- **Run length:** fights +20-30% (more time out of auto reach), with one fewer
  pack a level, so a level is about the same.
- **Cost: cheap.** A preset, a `vast` room size, and two texture sets
  (~400 KB). ~1.5 evenings. Its weakness: no mechanic, so no identity beyond
  the look.

---

## 2. The boss (depth 6)

All keep 900 HP, ≤ 22 a hit, windups ≥ 620. Target: **~100 s and ~5 push
asks**, which puts area III's Stopped rate for the spender at ~17% against
area II's ~7% (with steps 1-2). What they test that the other two don't:

| boss | tests |
|---|---|
| Assembler | reading a big body's move at one moment; walls stop its charge |
| Arbiter | hiding in the gaps of a sweep; its heat forces pushes |
| B1 Engine | crossing a moving line of danger on a known path, and **making your own opening** with the arena |
| B2 Couplers | two bodies and the line between them; cover as a snag |
| B3 Conductor | anticipating a count instead of reacting to a tell |

### B1. The Engine, in the roundhouse

The shunter from the sidings, met at last. A low engine (2 u tall, 4 long) runs
a **loop of track at radius 9** round the roundhouse (the 28 u arena). The rails
ahead of it light 1.3 s before it arrives, so **unlit rail is always safe to
cross**. Crossing takes 3.44 u (625 ms), and the unlit rail is at least 14 u
from the engine. It hits for 22, as a hazard, so Anvil doesn't catch it. Four
**wagons stand on short spurs that cross the loop** on the diagonals. A shove
of ≥ 1.2 u rolls one across the track in 1.5 s. If the engine reaches the
crossing while the wagon's on it, it **derails: stopped 2.0 s, firebox open
×1.5**, and the wagon is smashed. That's the Assembler's wall-stun, except you
set it up and pick the spot.

| move | numbers | slack |
|---|---|---|
| the run | r 9, 11 u/s (a 5.1 s lap), lit 1.3 s ahead, 22 | 1300 − 300 − 313 = 687 |
| whistle (a steam cone inward) | 50°, 7 u, **950 ms**, 14, the inner walls block it | worst case at 4.8 u from the engine: escape 2.65 u = 481 ms → **169**. At 900 ms it's 119, too tight |
| coal (the tender lobs) | 3 shells, the Lobber's numbers: 620 + 1000 flight, r 1.6, 10 | 409 |
| phase 2 (< 55%): reverse | 600 ms judder and sparks; the lit section appears behind it | ≥ 620 to any hit |
| phase 2: uncouple | drops a wagon on the track behind it; on the next reverse it derails on it, somewhere you didn't pick | |

- **Arena:** the yard as it is. Its four low walls at ±6.5 sit inside the loop
  (their far ends at r 6.8, the strip starts at 7.7) and become the whistle's
  cover. The crates at (±3.5, ±10) sit 0.3 u off the strip's outer edge
  (10.3), so move them to r 12. The centre is safe but low-output: the engine
  is 9 u away, past auto reach (7.6), so from there only a Lens hits. Standing
  near the rail gives auto uptime of ~30% of a lap and a Cleaver pass
  (0.45 s a lap at 3.1 u), at the whistle's risk.
- **Fight length:** 5-6 derails × ~70-90 (everything in reach at ×1.5, plus a
  push) ≈ 450. The other ~450 at ~8 dps on a moving target is ~56 s. **~85-105 s.**
  Impact damage on a derail is 0, on purpose: at 40 a hit, derails were two
  thirds of the fight.
- **Push demand (stands without step 1):** a wagon rolled at the right lap
  with the shove part cooling (~2 asks), phase 2's derails at spots you have
  to reach by bolt within 2 s (~2), and one opportunistic push in a derail
  window. **~5 asks.** The dials are the wagon count and phase 2's drops. Each
  ±1 is about ±5 points of Stopped.
- **Builds:** a build with no shove (Ward, Skitter, Parry, Lens) can't roll
  wagons. It gets only phase 2's derails, for a ~130-150 s fight: slower, not
  locked out. Frost Trail laid on the loop trips it (1.2 s stop, firebox shut,
  as with the ram). Lure does nothing, as with every boss.
- **Camera:** 2 u tall on the camera side hides ~2.6 u of floor. Reuse the
  Arbiter's see-through fade.
- **Cost: medium-big.** Engine body from primitives (shared with A1's
  shunter), loop and spurs as decals, rolling wagons (a solid circle that moves
  along a line, new), the lit-track tell on `LaneTell`/`Quads`. **~4 evenings.**
- **Fallback, 1 evening:** the Assembler at depth 6 with handcar and Linesman
  adds.

### B2. The Couplers

The parked Pair, with a new line. Two machines, 450 HP each, joined by a
**coupling chain up to 10 u long that's a live strip on the floor** (halfW 0.5).
They move to put it across Still. Every ~6 s it hums 900 ms and burns for 12
(slack 433). The arena is the Arbiter's square: eight brick posts on a 7.5
ring. **Walk the chain round a post and it snags:** both bodies jerk and reel
for 1.5 s, open ×1.5. When one falls, the chain goes slack and the survivor
takes one of its partner's moves. Each also has one move of its own: a slam
(700 ms, 16) and three shots (8).

- **Tests:** a line between two moving points (the Linesman, §3, teaches it in
  the crawl), with cover as a tool that's neither shield nor stun.
- **Push demand:** a snag opens both, but they're up to 10 u apart. Melee
  reaches one; the other needs a bolt in 1.5 s, and the Lens is cooling ~60%
  of the time. ~5 snags → **~3-4 asks**. Short of the target without step 1.
- **Fight length:** ~110-130 s (damage splits across two bodies).
- **Cost: medium-big.** The `Boss` interface is one body. Two bodies plus a
  dynamic strip is new. The square and posts exist. ~4 evenings.

### B3. The Conductor *(surprising)*

The station guard: a tall automaton with a lamp and a whistle on the
concourse. **Its moves land on the boss music's count** (124 BPM, a 484 ms
beat). It has 2-beat moves (968 ms: a lamp sweep, 5.2 u, 18) and 3-beat moves
(1452 ms: the whistle's shockwave with gaps, the Assembler's wave). On beat 4
of every eighth bar (every 15.5 s) it draws breath, **open ×2 for exactly one
beat**. A four-lamp count on its chest lights beat by beat through that bar.
The visual count is the truth; the audio follows it, because Bluetooth audio
on Android runs 150-250 ms late.

- **Tests:** anticipation. You can't react to a 484 ms window (a push lands at
  430 plus delivery). You have to start the hold on beat 3, which is new for
  this game.
- **Push demand:** 7 windows a fight, only one cast lands in each, and the
  part you want there is cooling ~60% of the time. **~4-5 asks, all
  opportunity**, none needing step 1. It's the only pitch where the push is
  about timing a cast, not getting a cast early.
- **Fight length:** ~100 s. **Cost: medium-big.** `music.ts` already keeps a
  beat clock (`nextBeat`); the boss has to read it. The risk is the phone: if
  the count doesn't teach itself in one fight, it's a frustrating boss.

---

## 3. The monster set (for A1, the Line)

Area III is about 10 minutes of crawl, and depth 4 already teaches the mites.
So the budget is two new mechanics, as in area II: the shunter (A1) and **one**
new archetype. Everything else is a variant or a face.

| enemy | kind | HP | hit | windup | BE | body | tell | asks |
|---|---|---|---|---|---|---|---|---|
| **Handcar** | ram variant | 36 | 14 | 900 (495 track + 405 lock) | 1.5 | creosote-black timber, strap iron | pumps its lever; the rail ahead lights | stay off its rail |
| **Linesman** | new archetype (pair) | 16 each | 10 | 900 hum | 1 per pair | lead, matte blue-grey, brown-glaze insulator cups | the wire's strip brightens and its dust shivers | don't stand on a line between two bodies |
| **Porter** *(surprising)* | thief variant | 12 | none | none | 0 | oxidised zinc, dull, darker than the sentinel | carries a crate on its back | break the crate before the train does |
| **Sleepers** | hulk face | as hulk | as hulk | as hulk | as hulk | hulk iron | a pack asleep laid low across a dead siding, one dim ember each | nothing new |

**Handcar.** A ram bound to a rail. Its lane is always the rail, so you know
where it can hurt you, and only when is a question. Rail sections run 12 u
between buffer stops, and it always runs to the buffer (its rushMax is the
section), so **it always stuns: 100%, against the ram's 25-69%**. The catch is
that the stun is 6-12 u from you. It hits bodies on its rail for 14, its own
pack included, unless they've stepped off the lit rail.
- Slack from windup start: 900 − 300 − 204 = 396. From the lock: the ram's
  problem, unchanged.
- **Push:** its 1.2 s buffer stun (×1.5) is out of melee reach, so the Lens,
  cooling ~75% of the time, is the ask: pushed, 39. Or a pushed Hook or Toss
  that puts a hulk on the rail inside the 405 ms lock. It needs no step 1.
- **Cost: cheap,** ~1 evening (charger code, lane fixed to the rail, trample
  damage). Old roster: *Raging Hull*.

**Linesman.** Two three-legged line-poles with a live wire strung between
them, kept 4-7 u apart. They walk to lay the wire across Still. They freeze and
the wire hums 900 ms (a floor strip, halfW 0.5), then it burns 150 ms for 10.
It hurts any enemy it crosses too. Kill either pole and the wire drops dead.
- Slack: escape 0.92 u = 167 ms, so 900 − 300 − 167 = **433**.
- **Room check:** a 7 u wire is 35% of a 20 u room but 58% of a 12 u side
  room, so main rooms only. It's also the Couplers' lesson, if B2 is picked.
- **Push:** the 900 ms hum is in step 1's reliable band (470 ms spare for an
  arc or nova, a bolt from ≤ 12 u). Breaking it makes both poles reel 760 ms
  (×1.5, and a Cleaver kills a 16 HP pole). **+0.1-0.2 asks a fight, and only
  with step 1.**
- **Cost: medium,** 1.5-2 evenings (two bodies that coordinate, a strip with
  moving ends). Old roster: *Wire Jammer*. Its elite is *Many*: three poles, a
  triangle of wire.

**Porter** *(surprising)*. A thief body without a cage, carrying one of the
level's crates (never an extra one, so no new loot). When a train is due, it
runs the crate to a live rail and sets it down, and the pass smashes it and
what's in it. Break the crate while it's carried and the contents drop there.
Kill the Porter and the crate drops whole. It moves at the thief's 6 u/s with
listens (4.55 average), and it takes ~4-8 s to reach a rail. At most one a
level.
- **Push:** a Lens cooling while the crate heads for the rails. Expected
  value: 0.3 × 20 HP + 0.1 part. **~0.15 asks a fight.** Small, and the only
  push in the game that's about loot.
- **Cost: cheap,** ~1 evening (thief AI, new goal). Old roster: *Drifting
  Frame*.

**Sleepers.** A face, like the slag heap. A hulk pack asleep laid low across a
dead siding among the real sleepers, one dim ember each; they stand when the
pack wakes. It costs no mechanic and no balance.
- **Cost: ~0.5 evening.** Old roster: *Static Frame*.

The roster names are all assigned already (`notebook.ts`). Re-banding the four
above to a band `III` is data only.

---

## 4. Where it sits

| option | minutes | P(a run sees III) | new decision | Stopped (spender) | what it breaks |
|---|---|---|---|---|---|
| **Alternate:** depths 4-6 are II or III, turn about | 26 | ~30% of runs, 50% of runs that reach 4 | none | II ~7%, III ~17%, average ~12% | nothing |
| Branch: two cold beams and the warm one after the Assembler | 26 | chosen | which area | same | `exitsAfterBoss` INV (length ≤ 2, "never a third"); Grace's lean |
| Deeper: depths 7-9 past the Arbiter, optional | 26, or ~41 for those who go on | ~27% | go on at 6 | ~11% overall, most of it at 9 | "one day": 7-9 would be night, and nothing in a level reaches night today |

**My pick: the alternate,** keyed to runs that reach depth 4: the first goes
to area II as built, the next to III, and so on. A run that ends at depth 3
doesn't use up III's turn.

- **It keeps the 26 minutes exactly,** which the owner chose over my own
  earlier 9-depth, 41-minute case.
- **The branch adds a menu, not a dilemma.** Both cold beams pay the same
  loot per minute and carry the same strain. A third door at depth 3 dilutes
  the warm beam, the run's one real Growth-vs-Comfort decision, with a choice
  that has no cost. It also breaks a code INV and Grace's lean.
- **The deeper stretch is the best for Stopped.** Going on at 6 carrying 8
  strain is the purest moth-and-flame choice this game could have. But it's
  15 more minutes, the day runs into night, and while the pool fills, going
  on dominates (more finds, nothing lost), so in practice every run for ~10
  runs would be 41 minutes. That's the silent lengthening the brief rules out.
- **The alternate gives the two areas different jobs.** Area II is the HP road
  (Lobber, slag); area III is the strain road (trains, the Engine). Alternating
  means a run's second half asks a different question each time, and the
  Stopped rate over a session averages out.
- **Cost:** `PLACE_OF` and `bossFor` take a run field, `areaOf` gains `III`,
  plus one save field. ~0.5 evening. The walk home stays the quarter at night:
  off the train, through the last streets to the lit house.

---

## 5. Recommended bundle

**The alternate + A1 the Line + B1 the Engine + Handcar, Linesman, Porter and
Sleepers.** Area III runs afternoon to dusk, like II. Step 1 of the strain
work (a push breaks the wind-up it's aimed at) should ship first or with it:
without it, area III makes the push wanted, but Stopped stays near 1%.

| | numbers, spender, with steps 1-2 |
|---|---|
| crawl asks a fight, depths 4-5 | ~1.75 (II: 1.25) |
| strain entering depth 6 | ~6.2 (II: 3.6) |
| Engine asks | ~5 |
| P(Stopped at 6 \| reached) | ~17% (II: ~7%); watcher 0% |
| run length | ~26 min, unchanged |
| download | +0.3-0.5 MB (ballast, maybe a platform set; everything else primitives or vendored) |

**Parts under the bundle:**

| part | in the Line | verdict |
|---|---|---|
| Backdraft Vent | pulls a pack 5.2 u onto a lit rail: up to 22 each | **strongest here. Check pack wipes on the phone** |
| Pressure Vent, Piston, Skid Plates, Rusted Hook, Clamp Toss, Overrun, Kickstart | shove or pull onto rails; roll wagons | better |
| Frost Trail | trips the handcar and the Engine (1.2 s stop) | a weak blue gets a job |
| Brace | a 22 train hit becomes 3 strain | the HP-for-strain trade grows. It's a Stopped lever, as meant |
| Patient Lens | a full 32 × 1.5 = 48 into a 2 s derail | good |
| Ward, Mirror Ward | stop no train, shell or wire | weaker here, not useless (sentinels) |
| Lure | the shunter and the Engine ignore it | weaker, as with every boss |
| Anvil | catches the handcar (melee), not the train (hazard) | unchanged |

Nothing is made useless.

| order | step | evenings |
|---|---|---|
| 1 | alternation, the `III` area and place presets | 0.5 |
| 2 | the Line's kit and generator (rails across the layout, wagons, buffers, the station halls) | 3 |
| 3 | the shunter: horn, lit strip, engine model, enemies stepping off lit rails | 1.5 |
| 4 | Handcar, then Sleepers | 1.5 |
| 5 | Linesman | 1.5-2 |
| 6 | the Engine: loop, whistle, coal, wagons and derail, then phase 2 | 4 |
| 7 | Porter | 1 |

**About 13-14 evenings**, close to area II's 14-15. The code isn't the hard
part. The hard part is tuning the timetable and the Engine's ask count on the
Poco.

---

## 6. Open numbers for the phone

1. **The shunter's period (16-22 s).** It sets area III's asks a fight.
   Doubling the trains takes the spender from ~17% Stopped to ~45%, so this is
   the first dial.
2. **Enemies stepping off lit rails.** Off, trains clear packs for free. On,
   they pay only for commitment and shoves. Test on and off.
3. **The Engine's ask count (target 5).** Wagon count and phase 2's drops;
   ±1 ask ≈ ±5 points of Stopped.
4. **Are hops airborne to floor hazards?** If Skitter and Spring Heels clear a
   lit rail, they gain a job here, but the rule reaches slag and shells too.
5. **The horn at 1500 ms.** The slack is 887, so there's room to cut to 1200
   if the train feels like it waits for you.
