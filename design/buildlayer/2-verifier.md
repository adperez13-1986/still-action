# Build layer, round 2: verifier

1 Oct 2026. Written after reading all four round-1 files, the balancer's sim, and the code again. Every name is
PLACEHOLDER. Every line a player would read is PLACEHOLDER.

## Where I landed

- **I move on the root.** A build is a new core with no button, not one of today's autos kept alone. My haul + pin
  kept the hand or the eye as the root. That is his complaint ("one is just much shorter than the other"), cut in two.
- **I hold on the spine:** the core sets a state every beat, parts pay it, today's `sets` / `pays` / `stateMul` /
  `MUL_CAP` x2 / shatter stay the machine. Four slots stay. No new part shapes in the first trial.
- **First trial: Wake + Breaker** (the translator's pair), with two data fixes to Breaker.
- **The pick comes after depth 1,** as a card, not a pedestal.
- **New finding: the balancer's pool numbers assume pedestals that are off,** the same flaw as dropsim. In the live
  drop shape, formation falls from 74% to 54% by d3. One rare drop in two drawn from the core brings it back to 60%.

## 1. A new core: what it costs, what breaks

**Correction to my round 1.** I said "one auto off" was two lines. It isn't. With `closeHand = false`, the auto
block in `combat.ts` (about line 706) falls back to the old far shot (`AUTO_RANGE` 7.6 u) whenever he walks. So
"eye only" was never "the planted shot only". The switches are dev hooks, not a build.

**How a core goes in.** Add `core: CoreId | null` on Combat. At the top of the auto block: if a core is worn, call
`tickCore(dt, player)` and skip today's block; if null, today's code runs untouched. That keeps K-90F byte-identical
by construction, not by care. Reuse what exists, don't add a second auto timer per core:
- **Wake** is mostly built already. Frost Trail's floor strips (`zones`, a segment with a half-width and a life) are
  the wake's shape. Mastery's chill that never slows (`masterHit`, `setState(..., form)`) is the wake's effect. New:
  laying a segment as he moves, `mul` 1 (no slow), 3 damage at most once a second, and `'core'` as a third `form`.
- **Breaker** reuses reach (`handTarget`, `inReach`), the tell clocks (`tellIn`, `landsIn`) and the reel look
  (`reelCore`). New: firing on a tell's start instead of the 0.62 s beat, the 1 s cap, the `open` state, and the plain
  5-damage strike every 1.2 s (the hand's code at another interval).

**What goes away with a core, for free:** everything that reads the eye's stance. The brace (planted halves blows,
about line 1547), the head parts' eye targeting (they fall back to today's `usual`), the sightline, `plantedS`,
`eyeBreaks`. Mastery is not offered (one gate in `masteryOffer`). The follow-through bank is skipped.

| what | breaks? | why, and the fix |
|---|---|---|
| bot harness (K-L12 eager / hesitant, K-T13 bots A-C, K-N17 circle / camp) | no | they run at `?depth=1`, where Still is still bare (the pick is at d1's exit) |
| K-90F fights compare, K-90, `names.json` | no | null core runs today's block; pinned queries unchanged |
| a bot for a cored Still | missing | Wake does nothing standing, so a "stand and cast" bot measures zero. New bots: a circling one (K-N17's path code) for Wake, a step-to-nearest one for Breaker |
| the floor player | yes, on paper | CURVE9's floor uses hand + eye. A core alone is weaker (balancer: deep pack 7.8-8.0 s vs 7.2; boss 58-73 s vs 53). A never-melt player who doesn't build falls; one who builds rises. Nothing models which, until the log does |

## 2. The first trial's two: Wake + Breaker

- **Wake:** three of four voices put it in (Claude's Trail, the translator's Wake, the balancer's Wake). It is the
  furthest from today and, in code, the cheapest new core.
- **Not Sight.** It is the cheapest of all (the eye, the hand off, Marking Shot granted). But it is the eye. If one
  of the two trial builds is today's eye alone, his verdict on it says nothing new. Keep it as the cheap third: if
  Breaker fails, Sight is a day's work.
- **Not Ram or my Pin.** Both need a new physical test (a shove that ends on a wall, or on another body), a new look
  (a wall crack), and a free shove from an auto every beat is free defence, which the synergy round banned. Hold it as
  the fourth.
- **Breaker, with two fixes** (both from the code, both data shape):
  1. **The snap must not cancel a pressure tell.** INV-T1 (LINE-RULES R3) says a pressure body's own tell is the one
     thing only Parry may break, and since 28 Sep most ordinary bodies are pressure bodies. A snap that cancels it is
     a free parry every second. Fix: the snap hits and opens, and the blow still lands. It is a counter-punch, not a
     block. Parry Clamp keeps its job as the cover piece.
  2. **Open must not stack with reel.** A reeled body takes x1.5 on every hit (`enemy.ts`, `REEL.mul`), outside the
     state system. Open x2 on top is x3, over `MUL_CAP`. Fix: the snap calls `interrupt(false)` (no reel), open is a
     plain state (x2, used up), and it only borrows the reel's amber pulse as its look.
- **The pay rule for the trial: today's x2 used up, plus shatter.** The balancer prefers flat damage per mark because
  x2 wastes on overkill. Shatter already carries a paid kill's excess to the next body, and x2 is built and checked.
  One new thing at a time. Flat per mark is the dial if x2 misses the pack line. Balancer: please add a Breaker row
  to the sim (a one-body core, uptime = swings in reach a second, capped at 1).

## 3. When: after depth 1

- **The code's reason:** with the pick at d1's exit, d1 is still the bare game, and every suite that boots
  `?depth=1` keeps testing a game he really plays. Pick at the start, and every one of them tests a game nobody plays:
  the same mistake as the weight pins, made again.
- **His reason:** one fight with the old kit makes the loss felt.
- **How:** `pause.choose` at d1's exit beam (mastery uses it today). Two cores, no "stay bare": the pause switch off is
  the control. Not a pedestal: they are off, and the translator's pedestal glow moves to the floor drop's glyph.
- **Save v3, no bump.** `RunSnapshot.core?: string`. Resume keeps it only if `id in CORES`, the way mastery is
  filtered. Absent = bare. Never change `s: 1`. The pick happens before d2's snapshot, so a core is never half-chosen
  in a save. The wake and open timers live in combat only; resume starts a depth clean, as today.
- **A run in progress at deploy:** it resumes bare. If the switch is on and depth >= 2 with no core, offer the pick
  at the next beam. Flipping the switch mid-run: log `coreMixed`, the way `weightMixed` works.

## 4. Flat temper (damage 1 / 1.15 / 1.3, cooldown 1 / 0.92 / 0.85)

- **What it touches:** two arrays in `src/temper.ts`. Everything reads them through `tempered()`: the card, the
  swap at II, the mods (charge clocks, reflect, toss, slam, overrun). Area stays 1 / 1.15 / 1.3. A part's damage a
  second at III goes from x2.22 to x1.53; at II from x1.53 to x1.25. A swap landing at II is worth less.
- **Behind the trial's switch,** not global, so the switch off is still today's game.
- **The checks don't react.** K-L3 builds its expectations from `tempered()` itself; the one hard-coded rank-III
  line is the Cleaver's cone (area). `statecheck` reads only sets / pays. K-90F is all rank I. So nothing guards the
  temper numbers: add one assertion of both tables in B0.
- **The 1 in 5 floor doesn't move from temper:** he never melts. The median and the investor do. CURVE9's
  median / investor columns (HP lost .78 / .57 at d4, down to .56 / .46 at d8) were fitted with today's temper and up
  to 6 masteries. Under the switch they are void until re-fitted from 3+ logged runs. Expect the median's area-3
  growth to shrink (CURVE9 itself says his 74% finish rests on 4-6 masteries), and chains to give some back.
- **`curve.ts` and k9's curve rows don't move:** the curve is keyed on depth alone.

## 5. The measuring fixes, all in B0

1. **`tools/checks/lib.mjs`:** the init script writes `'0'` for weight and tap push when unset. Write `'1'`. Keep
   `WEIGHT=0` / `TAP=0` as the way to the old game. Flip K-L1 with it. Re-capture K-90F once with weight on, review
   the diff (it should be weight's known numbers only), commit it alone.
2. **`tools/dropsim.ts`:** re-census `tools/levels.json` for 9 depths, both roads (`__census`); depths 1-9 with
   bosses at 3, 6, 9; move `PEDESTALS_ON` out of `main.ts` into `drops.ts` so the tool reads the live value; with it
   off, Plenty is one floor part and the Assembler a blue and a gold on the floor; floor parts for any slot (live
   since 28 Sep); ordinary kills pay x0.4; an unwanted duplicate counts as a melt; a `--core` chooser.
3. **`build-sim.mjs` part B** (the balancer's file, his fix): it raises an exit set of three at every crawl depth and
   a gift pick at d3, and floor drops only for worn slots. None of that is live. I ran a scratch copy with the live
   shape (2.5 floor offers a crawl depth, any slot, rare rolls at elites and Plenty, the Assembler's two on the floor):

| live shape, trial pool | formed d3 | chain d6 | own keystone seen by d6 | taken when seen | random formed d3 |
|---|---|---|---|---|---|
| round 1 (pedestals on) | 74% | 62% | 59% | 70% | 13% |
| live, no filter | 54% | 53% | 21% | **91%** | 12% |
| live, 1 rare drop in 2 from the core | 60% | 54% | 52% | 73% | 17% |

   So the hunt needs the filter (or pedestals back, his call of 28 Sep). Without it the keystone is rare and an
   always-take. These are rough numbers from a scratch copy; the balancer should redo them in his file.

## 6. Log fields, one list

Per depth unless said. Reuse what exists: `fightS`, `plantedS`, `hpLost`, `kills`, `states` {set, paid, expired},
`paidBy`, `stateBonus`, `shatter`, `melts`, the drop records.

| field | what | for |
|---|---|---|
| `core` | the core worn this depth, or null | everyone |
| `corePick` | once a run: {depth, offered, took} | P1 |
| `coreMixed`, `temperFlat` | the switch flipped mid-run; which temper table | reading runs apart |
| `movingS` | fight seconds with the stick out of its dead zone (beside `plantedS`) | Wake >= 70-80% |
| `nearBins` | fight seconds by distance to the nearest awake body, edges 2 / 3.5 / 6 / 11 u | Breaker median <= 3.5 u |
| `wallS` | fight seconds with Still within 2 u of a wall | posture, the fourth core later |
| `setBy` | states set, by `core` or slot | marks made by the core vs parts |
| `paidLag` | paid hits by seconds from set to paid, bins 1 / 2 / 4 | "cashed within 2 s" |
| `paidPerFight` | paid hits, one number per fight | "1+ a pack fight" |
| `snaps` | {fired, capped, landedFirst} (Breaker) | does the cap bite |
| `wakeCrossed` | bodies chilled by the wake (Wake) | does the ribbon work |
| `fit` on each drop record | `fits` or `plain`, against the worn core | fit taken vs plain, rule 6 |

Spent / made is `states.paid / states.set`. Drop `riders`.

## 7. The staged trial

One pause switch, "builds" (PLACEHOLDER), on by default, off = today's game.

| stage | what | done when | checks |
|---|---|---|---|
| B0 tools | the fixes in 5; temper assertion; cut the rider code | every suite passes on live defaults; dropsim offers and takes a run within 25% of his runs 23-24 | all suites, `npx tsc` |
| B1 data | `CoreId`; `fits` on parts (replaces `lean`); `open` in `StateId`; flat temper behind the switch; the two core defs | switch off: K-90F equal | corecheck (from leancheck): 5+ fits a core over 3+ slots, a payer in 2+ slots, bridges <= 3; statecheck |
| B2 Wake | `tickCore`, wake segments, chill with no slow | K-C1..C4 pass | K-C1 standing 3 s: no core damage. K-C2 a loop round 3 hulks: 2+ chilled within 1.5 s. K-C3 Cleaver pays the core's chill, `maxMul <= 2`. K-C4 zones live <= 40 and frame time within the perf budget on the arena |
| B3 Breaker | snap on a tell's start, 1 s cap, open, plain strike | K-C5..C8 pass | K-C5 snaps <= 1 a second. K-C6 a pressure tell is never cancelled by the snap (INV-T1). K-C7 Piston on open: x2, never x3. K-C8 a boss windup: snapped and opened, no stagger |
| B4 pick + save | the card at d1's exit, `core` in the snapshot, no mastery with a core | K-C9..C12 pass; a headless d1-d3 with each core beats the Assembler (eager bot), hesitant bot HP reported | K-C9 resume at d2 and d5 keeps core and ranks. K-C10 with a core, `autoDmg.hand + eye == 0`. K-C11 an old snapshot resumes bare and gets the pick. K-C12 switch off: no `core` key |
| B5 the hunt | fit line on the card, the lit glyph, the floor-drop glyph, 1 rare drop in 2 from the core, the pause readout | dropsim `--core`: committed formed d3 >= 60%, random <= 25%, keystone taken <= 75% when seen | dropsim; `screens.mjs` at four phone sizes |
| B6 his runs | 4+ runs, 2+ each core | his feel first, then the log | the pass lines below |

**Pass lines from the log** (merged from all four): `movingS` share >= 70% on Wake; `nearBins` median <= 3.5 u on
Breaker; spent / made >= 50% with a payer worn; median `paidPerFight` >= 1 in pack fights; a fitting drop taken
1.5x a plain one, and no part >= 70% of 6+ offers; a part taken after d6 in half his runs; `hpLost` d1-3 within 25%
of TRIAL-1's 130.

**His feel, asked first:** Did Wake and Breaker feel different in your hands? By the Assembler, what were you looking
for? Did losing the hand and the eye feel like a choice or a hole?

## Open for him

1. Breaker's snap as a counter-punch (the blow still lands), not a block. Is that still Breaker to him?
2. The hunt: one rare drop in two from his core, or pedestals back for this?
3. Sight as the fallback if Breaker fails, knowing it is "the eye, alone".
