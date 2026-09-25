# Area III, round 2: Balancer

I read all four round-1 files. This round assumes strain step 1 exists (a
pushed hit breaks the wind-up it's aimed at), so the crawl's baseline is ~1.25
asks a fight. My round-1 model sets the budget: crawl asks go 1.25 → 1.75 →
2.25, and a spender's P(Stopped at 6 | reached) goes ~7% → 17-30% → ~45%.
Each boss ask adds about 5 points. **Area III can afford about +0.5 crawl asks
a fight and a boss of about 5 asks.** Everything below is sized to that.

## (a) Placement: I've changed my mind. Branch, flagged for the owner

My round-1 case against the branch was that it's "a menu, not a dilemma". That
holds only if the two roads cost the same. They don't: with step 1, route III
enters depth 6 at ~6 strain for the spender against ~3.6 on route II. So the
noon fork becomes **home / the HP road (Lobber, slag) / the strain road
(trains, the Shunter)**. That's the one place the strain bar feeds a choice
before it's too late, which is Stopped as a strategy, not a fate. A player who
watches the bar is at 0% Stopped on either road, so the strain road doesn't
dominate and isn't a trap. Loot per minute is the same on both, so neither is
a farm.

- Take the translator's gate: the first time the Assembler falls it's "on or
  home" (and run 1 is always route II, the verifier's rule). From the next
  fall, three beams, each dressed and named for where it goes.
- The cost is what the verifier counted: the same `route` axis as an
  alternate, plus a second cold beam spot and the INV changed to "one warm, at
  most two cold". About +0.5 evening.
- **Flag:** the owner chose a single decision at noon. This keeps it one
  decision with three answers. If he rejects it, the alternate is the same
  data with `routeFor(save.runs)`, and nothing else is thrown away.

## (b) One train boss: **the Shunter** (placeholder name)

| part | from | why (numbers) |
|---|---|---|
| a rectangular loop, straights lit ahead | verifier (rect), all four (lit) | every straight is one `LaneTell`; ~18 × 18 u in the 28 u arena, a ~6.5 s lap at 11 u/s |
| **points levers into two buffer sidings: stun 1.6 s, firebox open ×1.5** | verifier, translator, Claude | replaces my rolling wagons, which needed moving solids. Levers are circles that flip |
| lever window **1.4 s** | verifier | a push lands at 430 ms, which leaves 970 ms of spare. **Cut Claude's 0.6 s**: 170 ms spare is a coin flip |
| **the boss bar is a departure board** ("next: ARMS · then: HEAD") | translator | the ask names a slot, like the grill locks. With the board you can hold a part back, and P(the named part is cooling) is ~0.4 |
| any cast of the named slot within 3 u of the lit lever throws it; the auto never does | translator + verifier | no build is locked out: Ward and Skitter throw it too |
| throw it wrong and the siding you stand in lights | verifier | the risk is shown, on a 1.4 s tell |
| a lever **every other lap** (~13 s), not every lap | mine | 15 laps a fight would be ~8 asks. Every other lap gives ~7 levers × 0.4 ≈ 3, plus ~1-2 pushes in stun windows: **~5 asks** |
| steam at the coal stage (the Arbiter's scald: r 3.2, 800 ms, 14) | verifier, translator | reuses code |
| phase 2: reversals with a 600 ms judder; tubs kicked down a spur as ram lanes; points thrown back toward you if a lit lever isn't taken | all three; Claude's switch-back | the switch-back is a lit lane (≥ 1.2 s), so skipping costs a dodge, never a cascade |
| run-over 22, **melee** (Anvil catches it) | verifier | it's a body, so a gold gets its moment. The crawl's trains stay hazards |

Fight: ~5 stuns × ~90 (everything ×1.5 plus a push) ≈ 450, the rest at ~8 dps
≈ 55 s. **~85-100 s.** Skipping every lever is ~150 s: slower, not lost.
**Cut:** my wagons and whistle, the Yardmaster's seal (a quarter damage reads
as "no"), the Double-Header and my Couplers (`combat.boss` is one body, ~5
evenings for one boss), my Conductor (Android audio 150-250 ms late; parked).

## (c) The bell stroke: not in the yard

It's the most Still idea in the round, and it deserves its own area. In the
yard it would be the third mechanic in ~10 minutes (trains, the Signalman, the
stroke), and area II's rule was two. The numbers: the stroke's 0.5-1 asks on
top of the trains' ~0.5 and step 1's 1.25 is **~2.25-2.75 asks a fight, ~45%+
Stopped for the spender**, past the band. It also sets two opposite rules
side by side. The stroke says stand still and the lit lane says step off, so
a stroke landing while Still is on a lit lane has no clean answer (22 or 8,
pick one). **Park the old town, the Hour, the Watcher and the Winder whole**
as the next area, where they're the only mechanic.

## (d) The monster set

| pick | from | numbers | asks |
|---|---|---|---|
| **Signalman** (the new mechanic) | verifier; Claude's flagman | 22 HP, stands still, semaphore up in 900 ms, calls the next train early onto the lane nearest Still (≤ 8 u) | the step-1 teacher: 470 ms spare for an arc or nova, a bolt from ≤ 12 u. Reliable. ~1 ask a pack that has one |
| **Handcar** (ram variant) | mine | 36 HP, 14, 900 (495 + 405), rail-bound, always runs to the buffer: **stuns 100%**, but 6-12 u away | a pushed Lens into its 1.2 s ×1.5 stun (39) |
| **Sleepers** (face) | verifier; Claude's ballast crawlers | a brood asleep between the rails; the brood treats a lit lane as no-go | nothing new. The no-go stops one train deleting 8 × 8 HP |
| Porter (optional, cut first) | mine | a thief body carrying one of the level's crates to a live rail | ~0.15 asks, the only push that's about loot |

**Withdrawn:** my Linesman (a third mechanic; Claude's coupled pair goes with
it). **Later:** the Rake (the handcar covers the ram slot), the Winch.

**Trains, merged:** 20 damage plus a 2.5 u shove along the track, so nothing
is hit twice (kills a sentinel, mites or the thief; a hulk keeps 10). Bell 2.0 s
out, committed and lit 1.2 s: halfW 1.1, escape 276 ms, **slack 624**. One
lane in about half the rooms, **every 12-16 s**, running only where a room is
awake. Idle enemies step off lit lanes and committed ones don't (my rule and
the translator's). Locks booked 300 ms apart (the verifier's). The timetable
is seeded, so a level can be learned (Claude's). **~+0.5 asks a fight.** The
period is the first dial: 9-12 s (the verifier's) is ~+1 ask, and the spender
goes to ~45% Stopped.

## Final bundle

**A branch at noon (gated, flagged) → the Yard (depth 4) and the cutting
(depth 5) with timetabled trains → the Shunter in the roundhouse, plus the
Signalman, the Handcar and the Sleepers (the Porter if time allows).**

| | route II | route III |
|---|---|---|
| crawl asks a fight | 1.25 | ~1.75 |
| boss asks | Arbiter ~7 (heats, half pushed) | Shunter ~5 |
| spender P(Stopped at 6 \| reached) | ~7% | ~17% |
| watcher | 0% | 0% |
| run length | 26 min | 26 min |

**About 13-15 evenings** (the verifier's plan plus ~1 for the fork), +0.1-0.3
MB, under the 5.6 MB cap. Safe stop: v0.2, route III with the Arbiter at 6
(~7.5 evenings).
