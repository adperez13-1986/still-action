# The enemy curve over 9 depths

29 Sep 2026. For stage R of `design/area3/BOTH-ROADS.md`, decision 6a: the finish line moves to depth 9.

**FIRST PASS. These numbers are modelled, not locked.** The standing rule is not to lock a baseline on incomplete content, and a lot here is still missing:
- The Line has never been played.
- The Engine isn't built.
- Today's rows 1-6 (version B in CURVE.md) have no logged run yet. Every calibration run in `playtest.json` is on b90e736 or earlier.

The method is the one in CURVE.md, unchanged:
- HP lost at each check (one depth, or one boss) is lognormal, CV 0.5.
- He is Broke when HP lost is more than 100 + scrap.
- Each check is independent, because every depth starts at full HP.

The curve stays keyed on depth only. The road decides the place and the enemies. The depth decides the multipliers.

---

## 1. The proposed table

The current values are in brackets where a value changes.

| d | hp | dmg | budget | bigBonus | heavyHp | heavyDmg | heavies | bossHp | bossDmg |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1.0 | 1.0 | 0 | 0 | 1.0 | 1.0 | 1 | 1 | 1 |
| 2 | 1.0 | 1.0 | 0 | 0 | 1.25 | 1.0 | 1 | 1 | 1 |
| 3 | 1.0 | 1.0 | 1 | 1 | 1.0 | 1.0 | 2 | 1.0 | 1.1 |
| 4 | 1.1 | **1.2** (1.5) | 1 | 0 | 1.5 | 1.1 | 2 | 1 | 1 |
| 5 | **1.2** (1.3) | **1.25** (1.5) | 2 | 1 | **1.75** (2.0) | **1.2** (1.3) | 3 | 1 | 1 |
| 6 | 1.0 | 1.0 | 2 | 1 | 1.0 | 1.0 | 3 | **1.2** (1.3) | **1.0** (1.2) |
| 7 | 1.2 | 1.25 | 2 | 1 | 1.75 | 1.2 | 3 | 1 | 1 |
| 8 | 1.3 | 1.3 | 2 | 1 | 2.0 | 1.3 | 3 | 1 | 1 |
| 9 | 1.0 | 1.0 | 2 | 1 | 1.0 | 1.0 | 3 | 1.3 | 1.05 |
| walk (10) | 1.0 | 1.0 | 0 | 0 | 1.0 | 1.0 | **0** | 1 | 1 |

What those numbers mean in play:

| | today | proposed |
|---|---|---|
| boss HP at 6 | 1170 | 1080 |
| boss HP at 9 | (none) | 1170 |
| pressure jab at 4 / 5 / 7 / 8 | 7.5 / 7.5 / – / – | 6.0 / 6.25 / 6.25 / 6.5 |
| ram at 8 | – | 18 |
| Engine rail hit at 6 / 9 | – | 20 / 21 |

The Engine's hits stay inside SPEC's cap of 22.

**Why each change:**

| row | change | why |
|---|---|---|
| 1-3 | none | They are shared with the 6-depth run, and CURVE.md says to leave 1-2 alone. The Assembler is where never-melt runs end most often (§2); the dial for that is in §5. |
| 4, 5 `dmg` | 1.5 to 1.2 / 1.25 | The never-melt player's power is flat after depth ~3. With 9 checks instead of 6, his risk at each check from 4 on has to drop from ~18% to ~10% to keep ~1 in 3. Damage is the lever his runs confirmed: it raises HP lost without changing hits to kill. |
| 5 `hp` | 1.3 to 1.2 | HANDOVER's named first dial. With the easier curve, the median player needs 2.5 hits a hulk, against 2.66 at depth 1 (fodder stays fodder). |
| 5 heavy | 2.0 / 1.3 to 1.75 / 1.2 | Today's depth-5 heavy moves to 8, so the heavies climb 4 < 5 = 7 < 8. |
| 6 boss | 1.3 × 1.2 to 1.2 × 1.0 | Boss 6 is now the middle boss, not the last. HP × damage goes from 1.56 to 1.20, and 9 is 1.365. The two bosses are within ×1.15 of each other, and that is what keeps the two orders even (§2). |
| 7 | new, same as the new 5 | Depth 7 is always a road's first step, like 4. |
| 8 | new: today's 5, with `dmg` 1.3 | The hardest crawl depth. It carries the ordinary HP and heavies that depth 5 carries today. |
| 9 | new: 1.3 × 1.05 | The finale is the longest boss fight. `bossDmg` rises only a little, because the floor player's power is flat. |
| walk (10) | an explicit neutral row | The walk has no packs, crates or shrines, so nothing reads it. It replaces the silent fallback to depth 5. |

**Code notes (for stage R, not done here):**
- **Keep today's rows as `DEPTH_CURVE_6`, and select by run length.** If the 6-depth run shared these rows, the live game would move from 35 / 73 / 92 to 51 / 80 / 95 (the "alive after 6" column in §2).
- Budget and heavies at 1-5 are unchanged, so `__gen` d1-6 with the flag off still matches `tools/levels.json`.
- `curveAt(d)` should read `DEPTH_CURVE[d] ?? WALK`. Add a headless check that every depth from 1 to `RUN_DEPTHS` has its own row.
- Crawl trains stay at a flat 20 and never read the curve. They are a hazard of the place, not a body.
- The Engine's hazards read `bossDmg`.

## 2. The model run, both orders

**The three players:**
- **Floor**: never melts.
- **Median**: melts about 1.7 times a depth.
- **Investor**: melts everything it can.

**Measured vs guessed:**

| input | value | source |
|---|---|---|
| Floor crawl HP lost, pooled 4-5, dmg 1.0 | 57 | his runs (CURVE.md) |
| Share of crawl HP lost to ordinary bodies | 0.9 | CURVE.md A/B fit |
| Elasticity of HP lost to ordinary HP and pack size | 0.3 | guess ("density bit far less than modelled") |
| Open field / rooms cost | 1.15 / 0.85 | guess, from d1 vs d2 and d4 vs d5 (one run each) |
| Line crawl | rooms × 0.88 (trains kill bodies), + 18 flat for the floor (about one train hit), 16 for the median, 14 for the investor | **guess** |
| Scrap | +30 at 1-2, +15 in the Works, +10 on the Line (trains smash crates, which then drop nothing) | CURVE.md; the Line's figure is a guess |
| Median / investor HP lost as a share of the floor's | 4: .78 / .57, 5: .67 / .49, **7: .60 / .47, 8: .56 / .46** | 1-5 from CURVE.md; 7-8 extrapolated (the median keeps melting, the investor has plateaued) |
| Arbiter, floor, at 1 × 1 | 51.3; median / investor .60 / .46 at 6, .53 / .44 at 9 | CURVE.md B |
| Engine, floor, at 1 × 1 | 51.3 (the Arbiter's figure); median / investor .72 / .60 at 6, .65 / .57 at 9 | **guess**: it's a hazard fight, dodged the same by every player, so it separates them less |

Each cell reads floor / median / investor.

**Works first**

| d | place | HP lost | Broke % |
|---|---|---|---|
| 1 | ruin, open field | 55 / 53 / 51 | 2 / 2 / 1 |
| 2 | ruin, rooms | 20 / 18 / 15 | 0 |
| 3 | Assembler | 88 / 67 / 47 | 31 / 14 / 3 |
| 4 | the Works, open field | 70 / 55 / 40 | 10 / 4 / 1 |
| 5 | the quarter | 63 / 42 / 31 | 6 / 1 / 0 |
| 6 | Arbiter | 62 / 37 / 28 | 10 / 1 / 0 |
| 7 | the sidings | 73 / 49 / 40 | 14 / 3 / 1 |
| 8 | the station | 77 / 49 / 42 | 16 / 3 / 1 |
| 9 | Engine | 70 / 46 / 40 | 16 / 3 / 2 |
| | **alive after 6 / finish at 9** | | **51 / 80 / 95 · 31 / 74 / 91** |

**Line first**

| d | place | HP lost | Broke % |
|---|---|---|---|
| 1-3 | as above | | |
| 4 | the sidings | 64 / 52 / 40 | 8 / 3 / 1 |
| 5 | the station | 73 / 53 / 41 | 14 / 4 / 1 |
| 6 | Engine | 62 / 44 / 37 | 10 / 3 / 1 |
| 7 | the Works, open field | 85 / 51 / 40 | 19 / 3 / 1 |
| 8 | the quarter | 67 / 38 / 31 | 9 / 1 / 0 |
| 9 | Arbiter | 70 / 37 / 31 | 16 / 1 / 0 |
| | **alive after 6 / finish at 9** | | **48 / 77 / 93 · 30 / 74 / 92** |

Targets: ~1 in 3 / ~2 in 3 / nearly always. Today's 6-depth curve models 35 / 73 / 92.

**Where Broke lands (share of each player's Broke runs):**

| | Assembler | area 2 (4-6) | area 3 (7-9) |
|---|---|---|---|
| floor | 43-44% | 25-28% | 26-30% |
| median | 52% | 17-31% | 11-24% |
| investor | 37% | 10-34% | 12-38% |

The ranges run from Line-first to Works-first. The investor's early deaths come from the tails at depth 1 and the Assembler, which happen to everyone.

**Is one order harder? No.** The finish rates are within 2 points for every player, in every sensitivity:

| sensitivity | Works first | Line first |
|---|---|---|
| CV 0.35 | 44 / 88 / 99 | 43 / 88 / 99 |
| CV 0.65 | 25 / 62 / 81 | 25 / 62 / 82 |
| Engine costs ×0.7 | 36 / 76 / 93 | 33 / 75 / 92 |
| Engine costs ×1.3 | 25 / 69 / 88 | 26 / 70 / 89 |
| Engine separates players barely at all (median .85, investor .75) | 31 / 71 / 88 | 30 / 72 / 90 |
| Trains cost 0 | 39 / 78 / 93 | 36 / 79 / 93 |
| Trains cost 30 | 25 / 68 / 88 | 25 / 67 / 88 |
| Open fields cost 1.3 / 0.7 of rooms | 35 / 74 / 92 | 32 / 75 / 92 |

Why the orders stay even:
- Each road's first step lands at 4 in one order and at 7 in the other, so the places swap and the totals barely move.
- The gap between orders is roughly (Engine's cost − Arbiter's cost) × (boss multiplier at 9 − boss multiplier at 6). Keeping the 6 and 9 multipliers within ×1.15 of each other makes it small, even if the Engine turns out 30% harder than the Arbiter.
- **The by-depth lever, if one order proves harder:** narrow the gap between the boss multipliers at 6 and 9.

**What does differ by order: where the risk sits.**
- Line first puts its hot spot at **depth 7**, the Works' open field at the higher multiplier: 19%, and 24% if open fields cost what his single run suggests.
- Works first spreads the risk over 7, 8 and 9.
- If depth 7 proves to be a spike, the lever is `dmg` at 7 (a road's first step, whichever road). It also eases the sidings' lesson depth on a Works-first run.
- If trains cost more than modelled, both orders move together, and the fix belongs to the Line, not the curve: SPEC's dials `period` and `liveR`.

**Depth 5 stops being the wall: confirmed.**
- The floor's risk at 5 falls from 18% to 6-14%.
- The wall moves to 7-8 and the last boss, at 14-19%.
- **"4-6 ease a little" is refuted in size.** They ease by about a fifth:
  - `dmg` at 4-5 goes from 1.5 to 1.2-1.25;
  - the boss at 6 goes from HP × damage 1.56 to 1.20.
- This is forced, not chosen. The floor player can't grow, so nine checks at ~1 in 3 overall leave him about 10% risk per check after the Assembler.
- The median and investor grow, so for them area 3 is the easiest part of the run. That is the power fantasy, and it is intended.

## 3. What three more depths do to growth

| | floor | median | investor |
|---|---|---|---|
| Drops offered, 6 / 9 depths | ~16 / ~24 | ~22 / ~33 | ~23 / ~35 (logged 16-26 on 6) |
| Melts by 6 / by 9 | 0 / 0 | ~10 / ~15 | 18 (logged) / 22+ |
| Masteries by 6 / by 9 (max 6) | 0 / 0 | ~1-2 / ~4-6 | 6 / 6 (all 6 by depth 5-6 in his run) |
| HP lost as a share of the floor's, 4-5 vs 7-8 | 1 / 1 | .78, .67 vs .60, .56 | .57, .49 vs .47, .46 |
| Risk per check at 7-9 | 14-19% | 1-4% | 0-2% |
| Hits a hulk at 8 (2.66 at depth 1) | 3.5 | ~2.4 | ~1.5 |

For the investor, 14 melts use up everything the melts can buy: four slots taken I to III is 8 melts, plus 6 masteries.

- **Does the investor become unkillable by 7-9? Close to it, and on purpose.**
  - His combined Broke risk over 7-9 is ~3% on Works-first and ~1% on Line-first.
  - Most of it is the Engine, the fight that separates players least.
  - His finish rate is still capped at ~91-92% by the tails at depth 1 and the Assembler, which no curve past 3 can remove.
  - Late on, what keeps him honest is strain at the Engine (§4), and pace: at depth 8 his packs take as long as today's depth 5, because enemy HP is ×1.3 and his growth has stopped.
- **Flag, a design question for content rather than the curve.** The investor's growth ends around depth 5. His ~10-12 offers at 7-9 go into a finished build, and melting into it buys nothing more. Area 3 is where he wears his build, not where he builds it.
- **The median player is the one area 3 pays.** Three more depths of melts take him from 1-2 masteries to 4-6, and his HP lost ratio drops from .67 to .56. That is why his finish holds at 74% over 9 checks.
- **Does the never-melt player still get ~1 in 3?** Yes: 30-31%.
  - But 44% of his Broke runs end at the Assembler, which is ~31% of all his runs, about 5 minutes in.
  - The other ~35% of his runs end in the Broke ending at 4-9.

## 4. Strain over 9 depths (a note only; stage T changes it)

From his logs, a crawl depth ends with strain near the quiet floor (half the strain carried in), and a boss adds +2 to +12 in one fight.

Rough strain carried into each depth, for a player who pushes:

| into | Works first | Line first |
|---|---|---|
| 4 | 4-10 (the Assembler's spike, +4 kept for its second pick) | same |
| boss 6 | 2-6, then the Arbiter adds +2 to +12 | 3-7, then the Engine adds ~+10 (~5 lever pushes, SPEC's estimate) |
| 7 | 4-8 | **8-14** |
| boss 9 | 3-7, then the Engine adds ~+10, so **13-17 out** | 4-7, then the Arbiter adds +2 to +12 |

**Risks to flag:**
1. **The ratchet halves strain on every crawl depth,** so strain mostly doesn't build between bosses.
   - Nine depths add one more boss spike, not accumulation.
   - The only permanent part is the +4 kept from the Assembler's second pick.
   - This is a math problem for the invariant: the cost that should keep climbing only threatens the Stopped threshold at bosses, and hardest at the Engine.
   - The Line (braced train hits, levers) is what raises Stopped: SPEC's ~17% against ~7%.
2. **Works first: Stopped concentrates at the last boss.** The Engine's levers come on top of whatever strain the Line added at 7-8. That is soft regret after ~15 minutes, and it has to read as Still slowing down, not as a cheap loss.
3. **Line first: depth 7 is the hardest depth on both counts.** The Engine's spike carries into the open field, which is also the Broke hot spot.
   - The warm beam at 6 is the honest out. About 48% of floor runs and 77% of median runs stand at it on a Line-first run.
   - Going home there is the strategically right call at high strain.
4. **Don't touch the strain numbers here.** Stage T's first dial is the quiet floor or a Rest per area, as BOTH-ROADS says.

## 5. What his runs must show before this is locked

**In order:**
1. **Version B at 1-6 (today's rows, before stage R).** He needs 3 or more never-melt and 3 or more invested runs, with `hpLost` per depth. The model predicts the floor loses 88 at the Assembler; his b90e736 runs lost 48 and 39. If B is off, every row here moves with it.
2. **Stage R: at least 2 full runs in each order,** with the Line's trains and the stand-in boss. What he needs to log:
   - HP lost per depth at 7-8;
   - **HP lost to trains per depth, and the crates they smash**, which replaces the flat-18 guess.
   - Trains are the largest single unknown: from 0 to 30, the floor's finish moves 39 to 25.
3. **Stage C: 2 or more Engine fights by a never-melt player and 2 or more by an invested one,** with HP lost and kill time. This replaces the Engine's cost (51.3) and its guessed ratios (.72 / .60).
4. **Lock when:**
   - 5 or more never-melt runs have reached depth 7;
   - both orders have been played;
   - the floor player's mean at 7-8 is within ±15 HP of 73-77, and the median's Broke at 8 is under 1 in 10.

**The dials to turn first:**

| dial | effect of +0.1 | when to turn it |
|---|---|---|
| **`dmg` at 8** (1.3) | floor's Broke at 8 rises ~3 points; his finish falls ~1 point; median and investor barely move | Area 3's crawl, both orders. Use it if 7-9 are too soft or too hard across the board. |
| **`bossDmg` at 9** (1.05) | floor's finish falls ~2 points, median's ~1 | The last boss, whichever it is. Use it if the finale doesn't feel like the finale. |

**If the Assembler proves to be too early a death for never-melt runs,** set `bossDmg` at 3 from 1.1 to 1.0:
- the floor's risk at the Assembler goes from 31% to 24%;
- the finish rates become 34 / 77 / 92;
- 8 or 9 can then take back ~0.1.

That is his call. It changes the 6-depth run too.

The model script was a session scratch file and is not in the repo. Every input it used is in the §2 tables, so it can be rebuilt as `tools/curvesim.ts` in stage T.
