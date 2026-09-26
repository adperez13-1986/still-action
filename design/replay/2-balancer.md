# Round 2: Balancer

New sims of the drop code (20k runs each, full wall, the player chases one of burner / cover /
control / duel). "Chosen" means 3 parts of that build worn by the end of the run. Today: 27%.

## (a) Where pick-one-of-three happens: at the exits, not at the elites

| picks at | chosen | by the Assembler |
|---|---|---|
| today | 27% | 9% |
| boss gift (3) + Plenty (2) only | 33% | 12% |
| elites + bosses + Plenty (my round 1) | 73% | 24% |
| **boss + Plenty + a pedestal by each crawl exit (depths 1, 2, 4, 5)** | 59% | 19% |
| the same + leaning weight x2 | 85% | 39% |

Boss-only barely moves anything: the Arbiter's gift lands after the run's last fight, so
it only feeds the hook. That leaves **one** in-run pick. My elites version works on paper,
but an elite dies mid-fight and its drop already belongs to the thief (variety step 1). So,
**changed my mind:** no elite pedestals. Put three pedestals beside each crawl exit beam: you
walk into them between fights, one per depth (the translator's rule), and each has the
compare card and a ghost of the part it replaces. That's 5 in-run picks plus Plenty. The
guard stays: at most one unfound part among any three (verifier).

## (b) The fill chance and the payout cut: neither does what we said

| rule | all 4 buttons lit entering the Assembler |
|---|---|
| fill 0.6 (today) | 100% |
| fill 0.35 / 0.3 | 100% / 99% |
| payout 0.45 + fill 0.35 | 97% |

A drop for an empty slot gets taken whatever the fill roll says. Area I drops ~11 parts, and
11 random drops cover 4 slots 88% of the time, so the fill chance barely matters. To get
the translator's arc you'd need ~4 drops in area I (23%), which starves everything else. My
payout cut does its own harm: without picks, chosen builds fall 27% to 21%. **Cut both.**
Instead: **empty slots fill only from pedestals.** Floor drops offer swaps for the slots you
already have. The exit pedestals light buttons 2 and 3, and the Assembler's gift lights 4.
The arc is guaranteed, and each early pick is "which button next", a real choice. Risk:
depth 1 is 4-5 min on one button plus the hand. Judge that on the phone.

## (c) Tag weighting: a knob, off at ship

Needed only if picks stay boss-only (33% to 77%). Exit pedestals alone give 59%; target 65-80%
(always getting it is no choice). Ship tags as data for (e), weighting at x1, set from the harness.

## (d) Push the drop: cut the gesture, keep the price

The gesture breaks "hold means one thing" (settled 26 Sep) and fights the pickup card. On top
of pedestals it adds +3-4 points of agency: not worth a verb. "No currency" is about the meta;
Plenty already sells a part for +4 strain in the run, so strain as a price is precedent.

Keep it as **a second pick at the Assembler's pedestals for +4 strain that doesn't wear off**
(the quiet floor becomes max(half of entry, that 4)). Economy check against the post-floor
runs, which entered depth 6 at 11 and 6: a greedy player arrives at 15 (2 pushes from
Stopped), a saver at 6-10 (5-7 pushes). Stopped becomes something you chose to risk. It's
one rule in `quiet()`, not a second bar colour.

## (e) Why the next run starts: the hook first, the wishes riding with it

| | builds | runs owed | what it adds |
|---|---|---|---|
| the maze remembers the hook | 2 | 2 | the hook becomes a real decision; 2 bosses x 4 leanings = 8 fights instead of 2, about +1.5-2 h |
| wishes on the corkboard | 2 + drawings | 0 | ~20 open questions, ~30 runs of "why start"; wishes can point at cells players skip (a road, a rung, a build) |

**Keep both, merged at one point.** One wish per boss-and-leaning ("the Assembler wearing
your Hook"). The hook move changes balance, so it owes runs. Wishes change nothing in a
fight, so they owe none and can ship alongside any switch.

## (f) Infrastructure, and how many switches he can judge

Agree with the verifier on order: **save v4 before any boss or history change** (0.5 evening),
and **the on-device run log with export**. It replaces my move 8 and is strictly better.
Seeded days matter to me for the **headless economy harness**. Every drop number in both
my rounds is from a Python model of `loot.ts`. The harness puts them on the real code without
using his phone.

What runs can measure (80% power, two arms): Stopped 10% vs 20% needs ~200 runs an arm, and
chosen build 27% vs 60% ~30, so those come from the harness, never from him. His log gives
~75 drops offered/kept in 3 runs. Only he can judge "did I want the pick".

**Rule: at most one combat-feel switch and one economy change at a time.** House features
(wishes, cards) ride free. The hand and the eye are two combat switches, open together, so
close them first (~6 runs). Owed for the plan below: ~6 (hand, eye) + 3 (pedestals) +
2 (hook) + ~12 (6 cheap rungs) + ~6 (Line B) ≈ **29 runs, ~12.5 h of his play**. That, not
evenings, is the budget. It's also why the ladder is 6 rungs for now: 6 rungs ≈ 14 runs,
~6 h of distinct play. The thief and button-reading rungs wait.

**Also changed:** the four-state grammar becomes the verifier's **6-8 authored couplings**,
each with a headless check (designed pairs ~25 to ~33 of 337: fewer, testable). Target stays
**15-20 h** over ~40 runs.

## Final direction and first moves

**Systems for depth. Content only where it multiplies (the Line to B, bosses that answer
the hook). Order everything by his phone-minutes.** Close the hand and eye switches first.
1. **Save v4 + on-device run log** with drops offered/kept (2 evenings, 0 runs).
2. **Pedestals:** the boss gift (3), one by each crawl exit, Plenty (2), empty slots fill
   only from pedestals, a second boss pick for +4 strain that doesn't wear off (2 evenings, 3 runs).
3. **The maze remembers the hook**, with the tags; the first 8 wishes ship with it (3-4
   evenings, 2 runs). Then the seeded harness, the 6-rung ladder, the Line's stage B.
