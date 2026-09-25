# Round 2: Balancer

## (a) The three I'd back most

1. **The verifier's `Hazard` primitive plus Slag Cores.** It's one evening,
   and it then carries the lobber's shell, the death puddles and any later
   floor tell. Puddles beat my own live cores. They don't chain, they arm in
   0.4 s, and they hit each body once. Where you kill becomes a choice, and
   the Cleaver isn't punished for killing up close. I withdraw live cores.
2. **The verifier's heat beam (B1 Arbiter).** It answers my flag #4, that
   Stopped can't happen at the end of a run. A hot button fires only by push,
   at +2 strain. Say the lance lands ~5 times in a 110 s fight and half of
   those get pushed. That's +5 strain on top of normal pushing, so a player
   entering at 10 is near the line. That puts Stopped in reach of the meta
   target (25–30% of runs) with no enemy ever adding strain directly.
3. **The translator's E4, the day moving with you.** It costs one evening and
   zero from area II's two-mechanic budget. It's variety that costs nothing
   to balance.

## (b) What breaks

| pitch | problem | fix |
|---|---|---|
| Crucible (T-B3) | 600 ms creep. The escape from a tile centre is 2.42 u = 440 ms, plus 300 ms reaction = 740 ms. A 45% cap on scattered tiles has a p99 escape of 4.5 u | a creep of ≥ 900 ms, and rows only (never scattered tiles) |
| Lobber (V-N1) | 0.8 s at r 2.0 leaves 60 ms slack | r 1.6, or 1000 ms |
| Viaduct (V-E3) | "fallen enemies drop nothing" breaks the loot rule (0.66 ÷ pack size) and hides the cost | rails, and elites don't fall. Or drop it for the translator's no-falling version |
| Lights out (C-B2) | fog that closes in hides a sentinel 10 u off at zoom 0.7 | tells and cores ignore fog (`fog: false`) |
| Named ones (C-V1) | 43 twists means 43 balance surfaces | ≤ 12, taken from the elite-mod vocabulary |
| Understudy (mine) | see (c) | withdrawn |

## (c) Positions

**The self-boss: the Echo, if any, and not in this bundle.** Discards put a
hidden price on taking a new part, which pushes play toward Comfort. The
translator's veto is right in maths terms too. The Copy ties the boss's
strength to your build, which cancels the power fantasy exactly at the last
fight. It also needs a boss version of all 30 parts, and the fallbacks make
most blues invisible. The Echo is one fixed table of eight moves, all with
tells that already exist, and a sim can test it. But it retests the
Assembler's four tells, where the Arbiter tests two new things (timing and
strain).

**The Lobber: yes, that settles it.** The parts doc's rule makes it
symmetric. It's still a sentinel variant (`kind: 'ranged'`, BE 1, no tax for
a new kind), and it keeps the verifier's line-of-sight lock, so hiding still
stops new locks. That leaves two jobs: fix the slack in (b), and have Ward's
card say it doesn't stop shells.

**Area II: the residential quarter, getting more intact.** Its identity is
material and sound, so it spends **zero** of the two-mechanic budget. "More
intact" is also the strongest number I have, cover density, turned as a dial
across the area:

| | cover | ram stun | sentinel blocked | who it favours |
|---|---|---|---|---|
| depth 4, rubble | 1 per 8 cells | ~33% | 9% | rams, sentinels, lenses |
| depth 5, roofs half on | 1 per 3 cells | ~47% | ~25% | the lobber (something to punish) |

The Works sends Still down and away from home, and it needs a hazard. The
Yard's fence bends the cover rule. The quarter is the road home.

**The thief: the Tinker's rules in the Hollow's body, in area I from depth
2.** Take the Tinker's rules: it only takes floor loot, it never leaves the
level, it heads for a side-room nest, it can't take a part Still stands over,
and it doesn't count as awake for the quiet. That adds **no** new loot and
puts a clock on the take-or-leave choice. The Hollow's 0.8 s listening pause
makes it catchable: 6 u/s carrying with a pause every 2.5 s averages 4.5,
under Still's 5.5. The Hollow's look (a cold part in a cage) reads at 16 px/u.
It goes in area I because depth 2 is played in every run, and area II's
budget is spent. My Picker's run toward a sleeping pack is dropped.

## (d) The bundle

| piece | what | evenings |
|---|---|---|
| plumbing | `Boss` interface, `Hazard`, per-area preset (meta step 5) | 3 |
| environment | **the Quarter**: furniture, plaster, tile; cover density 1/8 → 1/3; E4 day lerp | 3–4 |
| boss | **the Arbiter**: the translator's lighthouse wedge and lance, plus the verifier's heat-a-button hit; the boiler vents 1.2 s after a lance (the push window); phase 2 cracks cover | 3.5 |
| enemy 1 | **Lobber**, lesson at depth 5 in the densest room, in ~3 of area II's 12 packs | 1.5 |
| enemy 2 | **Slag Cores** on area II's hulks and rams, which teach themselves | 0.5 |
| enemy 3 | **the thief**, area I, 35% of levels from depth 2, outside the pack budget | 2 |

About **13–14 evenings**. The Assembler stays at depth 3, unchanged.

## Summary

1. Backed: the verifier's Hazard plus Slag Cores (replacing my live cores), the verifier's heat beam (it puts Stopped back in reach at the end), and the translator's day lerp (free variety).
2. Breaks: the Crucible's 600 ms creep and the Lobber's 0.8 s both fail the 150 ms slack rule, the Viaduct's no-drop falls break the loot rule, and fog must not hide tells.
3. Self-boss: the Echo if any (fixed, testable). Discards tax growth, and the Copy cancels the build at the last fight. Neither goes in this bundle.
4. The Lobber is settled by the Flare rule. The Quarter wins area II because "more intact" is a cover-density dial worth more than a hazard. The thief uses the Tinker's rules in the Hollow's body, in area I.
5. Bundle: the Quarter, the Arbiter (wedge plus heat beam), the Lobber, Slag Cores, and the thief in area I, about 13–14 evenings.
