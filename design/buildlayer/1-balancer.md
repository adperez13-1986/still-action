# Round 1: the balancer

1 Oct 2026. Alone, before the other voices. Numbers come from `design/buildlayer/build-sim.mjs` (node, no deps;
`node design/buildlayer/build-sim.mjs all 8000`, about a minute). Part A is a fight model in the shape of
`design/lean/lean-sim.mjs` (cooldowns, hesitation 1.8 s for a median player, weight preset B numbers, overkill not
counted, bosses take half from autos). Part B runs the offer stream of a 9-depth run against a pool. No geometry
and no damage taken in either: where that matters I say so.

Every name in this file is a PLACEHOLDER. So is every line a player would read.

## My position in five lines

1. A build is **one drive** (a new auto that replaces both the hand and the eye) **plus the parts that spend its marks**.
2. The drive must be the thing that sets up. It fires every 0.62 s. A button fires once or twice in a 5-8 s pack fight,
   so a button-to-button pair is worth -4% on packs (re-measured; the synergy round found the same).
3. **Spending is the bottleneck, not setting up.** A drive alone leaves 6-15 marks a deep pack fight. One spender uses 2-8.
   So parts that only add marks are near worthless (+0-4%); the pieces worth hunting are spenders and keystones.
4. **Today's temper beats every build.** Four parts at III is +37% on deep packs and +68% on a boss. No chain I can
   build within the rules comes close at rank I. Flatten temper, or builds stay decoration.
5. Smallest trial: **two drives** (Sight and Wake), 16 of today's 30 parts linked to one of them, temper flattened.

## 1. Why the drive has to be the setter (the maths)

His ask: parts that chain, one sets up, another cashes in. The trap is the clock.

| | fires | in a deep pack fight (~8 s) |
|---|---|---|
| a part button | every 2.6-9 s | 1-3 times |
| the drive (an auto) | every 0.62 s, when its position holds | 6-11 hits |

A setter on a button and a payer on a button meet about once a fight, often on a body that dies anyway. The old chill
pair (Chill Vent sets, Scrap Cleaver pays x2), today's autos, against four whites:

| | early pack | deep pack | heavy pack | boss |
|---|---|---|---|---|
| old chill pair | -4% | -4% | -3% | +4% |

So the setter must be the drive. The masteries already proved this by accident: Marking Strike was the strongest
thing in the game because the mark came from the auto.

## 2. The drives (the unit he commits to)

One drive a run, picked at the start from two offered. Each leaves its own mark on what it hits. Marks are flat damage
when spent (rule 3: added, never multiplied, so overkill can't make them explode), and a spend that kills passes its
unused bonus to the next body (the synergy round's shatter, kept).

| drive (PLACEHOLDER) | where Still stands | what it hits | mark: cap, life | a spend adds, per mark |
|---|---|---|---|---|
| Strike | in reach, facing one; keeps the break | one body, 10 | 3, 3 s; passes on a kill | 10 |
| Sight | planted and far; 0.3 s still to fire | a line, 9 | 2, 4 s | 14 |
| Wake | moving, at the pack's edge; nothing while still | each body brushed, 4 | 3, 3 s | 6 |
| Tether | a 3-6 u band, holding one | one body, 10 | 5, 2 s; passes on a kill | 7 |

These are four places on two axes: near or far, moving or still. That is what makes them play differently in the
hands. Strike and Sight are today's hand and eye reshaped; Wake and Tether are new.

Two numbers I set on purpose:
- **One-body drives pass their marks on a kill.** In my first pass a Strike or Tether chain was -1% to +7% on packs:
  all the marks sit on the body you are killing. Passing them on, with the other dials below, takes it to +9-23%.
- **A drive alone is weaker than today's pair of autos.** Four whites, today's hand + eye: early pack 4.5 s, deep 7.2 s,
  boss 53 s. With one drive: 4.8-5.3 s, 7.8-8.0 s, 58-73 s. The game gets a little harder by default. I think that is
  right for "hollow and easy", but it is a threat-round number.

## 3. What a chain is worth (Part A)

DPS against the same drive wearing four whites at rank I (median player). A spender is the white of its slot with
its own damage x0.9, its cooldown x0.75, and it aims at the most-marked body. c1 = one spender; c3 = two spenders and
a third linked part.

| | Strike | Sight | Wake | Tether |
|---|---|---|---|---|
| **packs (deep)** | | | | |
| one white melted to III, today's temper | +15% | +13% | +12% | +15% |
| all four III, today's temper | **+37%** | **+34%** | **+27%** | **+37%** |
| all four III, flat temper (below) | +17% | +17% | +18% | +18% |
| c1: one spender, rank I | +15% | +11% | +23% | +10% |
| c3: full chain, rank I | +23% | +21% | +27% | +18% |
| c3 at II (flat temper) | +30% | +30% | +37% | +27% |
| c3 worn off its drive (no marks) | -3% | 0% | -6% | -4% |
| **boss** | | | | |
| all four III, today's temper | **+68%** | **+74%** | **+84%** | **+69%** |
| all four III, flat temper | +31% | +34% | +40% | +32% |
| c1, rank I | +35% | +31% | +15% | +30% |
| c3, rank I | +48% | +38% | +25% | +39% |

What this says:
- **A full chain at rank I is worth about four melts to III under a flat temper.** Building and melting become peers.
  Doing both is the investor, and lands where today's all-III player is (c3 at III: +36-47% deep, +66-81% boss; today's all-III
  is +27-37% and +68-84%). The ceiling doesn't move. The way up does.
- **Under today's temper, melting wins everywhere.** This is the deckbuilder's "stat stacking is the only viable
  scaling strategy" (LESSONS), back as ranks. Every floor part can be melted, ~57 offers a run, so it is always there.
- **The first spender is most of it.** c1 is 50-85% of c3. That's good for "by d3 he knows he has one". It also means
  the third and fourth pieces must differ in kind (a keystone, a shaper), not be more spenders.
- **Builds have fears, from the numbers alone.** Marks on one body are a boss tool: Strike and Tether chains are
  +39-48% on a boss but +18-23% on packs. Marks on many bodies are a pack tool: Wake is +27% on packs, +25% on a boss,
  and its boss fight runs 73 s against 58 s for Strike, because a lone boss gives it nothing to brush. That is "what
  you're afraid of" following from the build, as his answer 2 hoped.
- **Off its drive a chain keeps 92-100% of four whites.** Weaker, never dead (rule 4).

The first numbers I tried (spender x0.8, no carry, mark values 8/11/5/5) gave chains -1% to +12% on packs: a trap. The
gap between "worthless" and "right" is mark value and spender cooldown, which is why I list them as the first dials.

### Feeders: cut as a role

A part that only adds marks (a vent that marks everything it hits) added 0-4 points over c1, at full damage. The drive
already makes more marks than buttons can spend. So the middle piece of a chain should be a **shaper**: a part that
changes *where* marked bodies are (pull them together for an area spender, pin one for Sight's line). The sim can't
price that: it is geometry. It is the translator's to show on the phone and the playtest's to measure.

### Keystones: they must change the drive, not add to a spender

| keystone kind (PLACEHOLDER) | deep pack | boss | read |
|---|---|---|---|
| carry: marks pass on a kill | +0-3 pts | -1 to +2 | built into Strike and Tether instead |
| deep: cap +2 | -1 to +2 | **+10-21** on Strike, Sight; +1-2 on the others | the boss keystone |
| echo: a spend also spends the next body | +0-6 | +0-3 | weak |
| burst: the drive spends a body when it fills it (60%) | **0 to +12** | -3 to +10 | the pack keystone; strong on Sight (cap 2), nothing on Tether (cap 5 rarely fills) |

A keystone worth under +5% is a trap unless it changes what he does. Burst works because it adds a second spender at
beat speed, which is the bottleneck. **Two keystones per drive, one pack and one boss**, so the hunt is a choice.

## 4. The pool and the hunt (Part B)

The run as it is: crawl depths 1, 2, 4, 5, 7, 8 (an exit set of three, ~2.5 floor offers, the elites, Plenty 35% of the
time), the Assembler's gift at d3, two drops at d6. Temper is on, so ordinary kills pay x0.4. That is **~57 offers a
run, 24-33 different parts seen, ~7 taken** by a committed chooser.

Three choosers: **committed** (takes parts of his drive, the keystone over all), **tier** (takes blue over white,
ignores links), **random**.

| pool (PLACEHOLDER counts) | formed d3 | chain d6 | keyed d6 | keyed d9 | own key seen by d6 | random formed d3 / chain d6 |
|---|---|---|---|---|---|---|
| trial: 30 = 2 drives x (6 + 2 keys) + 14 unlinked | 74% | 62% | 24% | 53% | 59% | 13% / 3% |
| same, drive match at the gift and Plenty | **77%** | **63%** | **34%** | **69%** | **72%** | **14% / 3%** |
| full: 40 = 4 drives x (6 + 2 keys) + 4 bridges + 4 unlinked, match | 80% | 61% | 29% | 62% | 68% | 16% / 2% |
| big: 48 = 4 x (8 + 2) + 8, match | 75% | 66% | 30% | 54% | 65% | 14% / 3% |

Formed d3: 2+ parts of his drive including a spender, walking into the Assembler. Chain d6: 3+ of his drive. Keyed:
chain plus a keystone. The gift shows one of his keystones half the time.

What this says:
- **The count that matters is parts per drive, not pool size.** Eight per drive forms ~75% by d3 whatever the pool.
  Pool size moves variety and the random picker, not formation. So content scales by drive: 8 parts each.
- **A random picker stays far below**: 13-20% formed, 2-5% chained. The tier chooser sits between (22-51%).
- **Two keystones per drive, not one.** With one, his own keystone is taken 76-81% of the times it's offered: an
  always-take inside the build (rule 6's 78% case). With two, 65-71%, and the second is a real choice.
- **Match at every exit is too much.** Matching one pedestal at every exit pushed "all four slots linked and keyed by
  d6" to 44-54%: nothing left to hunt. Match at the gift and Plenty only: 37-44%. No match: 28-32%.

### The risk I can't fix with the pool: rule 9

Even with the match held back, 28-44% of committed runs have all four slots linked by d6, and only **25-40% take
any part after d6**. With temper on, every part he leaves becomes a melt, so d7-9 is ranks. That is a want, but it is
"more of the same" (LESSONS: everything owned by fight 5, then coasting). The late want has to be designed:
- **Mastery becomes the drive's own upgrades** (melt past III, pick 1 of 2 for your drive), max 3 a run.
- **The second keystone** (pack vs boss) is a swap he makes before the Engine, not a stack.
- Pass line for the log: a part taken after d6 in at least half his runs.

## 5. How the four buttons divide

From the c1-c3 numbers: the first spender gives most of the value, the second adds 5-8 points, a third adds ~0.
So a build lives in **2-3 slots**, and **1-2 slots stay free**: defence, movement, or a part of another drive. That
makes "mixing works" true by construction (rule 8), and a free slot is not a dead slot as long as its choice matters
(rule 5 is about slots nobody wants). Per drive, every slot holds at least one of its 8 parts, so no drive has a slot
it can't use.

## 6. Keep / cut / reshape

| system | call | why, in build terms |
|---|---|---|
| four slots as buttons | keep | 2-3 carry the build, 1-2 are free; that's where mixing lives |
| the hand + the eye | reshape into drives | both on every Still flatten every build to "hit near, hit far"; one drive per run gives a position and a hole |
| leanings (close / marksman tags) | cut | a random picker wears 3+ of one tag 54% of the time; the drive replaces the tag (a part names the drive whose marks it spends) |
| riders | cut (already cut 28 Sep) | they readied a button on a break; breaks are rare under pressure packs. Burst is the same idea done by the drive |
| states (chilled, marked, x2 used up) | reshape into drive marks | x2 is a multiplier and wastes on overkill; flat per mark scales with what the drive did. A mark never slows (no free defence from an auto) |
| temper | keep, flatten | damage x1 / 1.15 / 1.3, cooldown x1 / 0.92 / 0.85 (today 1.3 / 1.6 and 0.85 / 0.72). Swap lands at II stays |
| mastery | reshape | today it hands the autos states; the drive does that from minute one. Becomes the drive's upgrades, the d7-9 want, max 3 |
| pedestals | keep | the drive match on the gift and Plenty only (above) |
| weight | keep its numbers for the trial | drives don't take the slot multipliers; packs x1.4-1.65 stay. If it gets too hard, pack HP d1-2 is the dial (TRIAL-1) |
| strain | keep (his call) | an option, not a must: a keystone costs +3 strain that no quiet takes back. Today strain at a boss is 2-6, never near Stopped; two keystones would make Stopped a price a greedy build pays |

## 7. Where I disagree

- **With "how strong you get" not being the goal.** I agree it isn't the goal, but it decides whether builds exist.
  If temper stays as it is, the best build is "melt everything", and no part design changes that. Flattening temper is
  not optional for his answer 2.
- **With rule 2 ("every payoff is triggered by the enemy"), in letter.** Marks come from Still's drive, not from what
  the enemy does. The rule guarded against payoffs scaled by your own loadout (still-merge's Aegis: stack the board, win,
  no thinking). Marks still live on enemies, last 2-4 s, and need the drive's position held (50-80% uptime in the sim),
  so "stack and stop thinking" can't happen. Strike keeps the break as its enemy-triggered piece.
- **With rule 1 ("two leanings first, fully built").** I keep its spirit: four drives designed, two built and filled
  (8 parts each) before the other two get any.
- **The floor player gets stronger.** A never-melt player who builds reaches all-III value. His 1-in-5 floor will rise.
  DESIGN.md says it rises "when synergies land", so I'm flagging it, not protecting it. The threat round re-sets it.
- **Bosses get easier for single-target builds** (Strike +48%, Tether +39% at rank I). He said the bosses are too easy
  already. That's next round's, but it should be tuned against these numbers, not today's.

## 8. The first trial

**Two drives: Sight and Wake.** Their left thumbs are opposite (one never moves, one never stops), and their value is
opposite (Sight leans boss, Wake leans pack). Strike and Sight would be today's hand and eye split, which is his
complaint. Strike is the cheapest third (it is the hand), Tether the last.

Content: 16 of the 30 parts linked, 8 per drive (3 spenders, 2 shapers, 1 guard, 2 keystones: a pack one and a boss
one). Most are today's parts retuned with "spends" on the card; the four keystones are new or reworked golds. The other
14 stay unlinked. Temper flattened. Lean tags, riders, states and the six masteries off.

Numbers to start from (PLACEHOLDER, all dials): Sight 9 a hit, cap 2, 4 s, 14 a mark; Wake 4 a brush, cap 3, 3 s,
6 a mark; spender x0.9 damage, x0.75 cooldown; spill on; burst 60%; deep +2 cap.

### Pass lines

| check | where | pass |
|---|---|---|
| a chain beats whites on packs | sim | c3 at rank I +15-30% deep, c1 +5-25% |
| melting doesn't beat building | sim | all four III (flat) within 10 pts of c3 at I, on packs and bosses |
| random picker | sim | formed d3 <= 25%, chain d6 <= 10% |
| committed | sim | formed d3 >= 70%, own keystone seen by d6 >= 60% |
| no always-take | sim + log | own keystone <= 75% of its offers; any part >= 70% of 6+ offers gets reworked |
| the drive's position holds | log | Sight planted >= 45% of fight time; Wake moving >= 70% |
| marks get spent | log | spent / made >= 50% with a spender worn; mark bonus 12-25% of damage in pack fights |
| he knows what's next | log | a linked part taken over an unlinked one >= 1.5x when both are offered |
| something left to want | log | a part taken after d6 in >= half his runs |
| the two drives differ | his feel, asked first | "they play differently in my hands", in his words |
| by d3 he has one | his feel | "by the Assembler I knew what I was looking for" |

### What the sim can and can't answer

Can: what a chain is worth against a melt, mark value and spender cooldown, how often a build forms, keystone sightings
and take rates, pool counts. Can't: anything with geometry (shapers, Wake's real brushes in a crowd, holding Tether's
band, Sight's line through a pack), damage taken (so "fear" is only offence here), whether marks read on a phone at
3 m, and whether a drive feels like a verb. Those are the translator's and his.

## Open numbers for the playtest

1. **Drive uptime.** The sim assumes Strike 70%, Sight 50%, Wake 80%, Tether 65% of beats connect. Every value in
   section 3 scales with it. The log's planted / moving share sets it.
2. **Mark value per drive** (14 / 6 for the trial). The knee between trap and right is narrow: x1.5 on mark value
   about doubled a chain's pack value in the first pass (Strike +7% to +13%, Wake +12% to +21%).
3. **Spender cooldown x0.75.** The second-biggest dial. Spending is the bottleneck, so this moves every chain.
4. **Temper's flat curve** (1.15 / 1.3). Too flat and the never-melt builder dominates; too steep and building loses.
5. **The d7-9 want.** Whether drive masteries and the second keystone keep "a part taken after d6" above half.
