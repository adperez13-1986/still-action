# Strain, round 2: the balancer

I read all four round-1 files. The numbers here come from the same two models
as round 1 (damage inside an opening; strain over a 26-fight run). The model
assumes a part is ready 25% of the time and otherwise has a uniform random
time left on its cooldown. The Broke column is a crude hazard model, so read
Stopped and entry strain, not Broke.

## (a) Demand across the whole crawl: I was half wrong

My round-1 claim was that demand spread across the crawl can't be tuned: going
from 1.0 to 1.5 pushes a fight moves Stopped from 14% to 73%. That's true only
for a player who **doesn't watch the bar**. Rerun with the player's own
restraint in the model: *keeps back* is the strain the player won't spend past,
in the crawl / at bosses. Asks are the ones a crawl-wide "a push breaks a
wind-up" would make, with the player answering 60% of them.

| crawl asks a fight | keeps back 6/2 (watches the bar) | keeps back 4/0 (spends at bosses) | keeps nothing back |
|---|---|---|---|
| 1.0 | Stopped 0% | 17% | 19% |
| 1.5 | 0% | 44% | 50% |
| 2.5 | 0% | 82% | 91% |

The player who watches the bar is never Stopped at any ask rate. The swing
only exists for players who push without looking. So:

- **The owner is right that the ask has to be in the crawl**, where 22 of the
  26 minutes are. Boss-only demand (my round-1 D1) leaves the complaint
  standing.
- **Answered asks need to sit around 1 a fight**, the free band. A wind-up
  rule that fires on all ~9 wind-ups of a fight blows past it. One that the
  latency limits to ~1-2 a fight (see (b)) lands on it.
- **The strain bar has to be readable before a crawl-wide rule ships.** The
  waterline is how players do the regulating that makes the rule tunable. It
  was converged on by three of us (translator E1, verifier E2, my T2). It's
  part of the rule, not polish.

## (b) Which wind-ups a push can answer

The verifier counts a push as landing 430 ms after the tell: 180 ms hold plus
250 ms reaction. On top of that comes delivery time: 0 for an arc or nova, d/26
s for a bolt, 800 ms for a lob. Spare time = wind-up − 430 − delivery. Below
about 150 ms spare, it's a coin flip on a thumb.

| wind-up (from its start) | length | spare, arc/nova | reach of a pushed bolt in time |
|---|---|---|---|
| hulk slam | 520 | 90 (coin flip) | none |
| mites' ring | 550 | 120 (coin flip) | none |
| Lobber tilt | 620 | 190 | ≤ 4.9 u |
| sentinel line | 760 | 330 | ≤ 8.6 u (holds 6-10, so most of them) |
| ram, from the tracking | 900 | 470 | ≤ 12 u |
| ram, from the lock | 405 | none | none |
| Assembler, Arbiter | | can't be broken | |

**Position:** keep the 180 ms hold and the 26 u/s bolt, and let the latency
choose the targets. A push reliably breaks sentinels, Lobbers up close, and
rams read from the rails. Hulks and mites stay answered by walking. That's the
filter that keeps crawl asks near 1-2 a fight, rising with depth as ranged and
rams become common (depth 1 has one sentinel pack a level; depth 4+ has
0.85-1.35 ranged per pack). So I'd **cut the verifier's 2× pushed-bolt speed**:
it lets a pushed bolt break every sentinel in Lens range, pushing asks toward
2.5. I considered an "armed hold" that fires on release, which brings latency
to about 200 ms and makes hulks breakable. I'm rejecting it: it puts all ~9
wind-ups back in play, and it changes the gesture.

## (c) Refunds

- **Claude C-R2 (a well-read push is free): cut.** If a fraction r of pushes
  are refunded, strain only breaks even at 1/(1 − r) pushes a fight. At r =
  0.7 that's 3.3 pushes a fight sustained, so a good reader is never Stopped,
  and Stopped becomes the ending for players who read badly. That makes it a
  grade, which breaks "never a punishment". It's also a cost change, which
  the brief rules out.
- **Translator R3 (the last word): keep, with one fix.** It moves the same −2
  earlier, and that's fine as presentation. But today's 2.5 s wait is what
  stops chained rooms from each earning a quiet. If R3 does the bookkeeping on
  the blow, chaining into the next pack within 2.5 s earns a quiet that isn't
  earned today. At a guess of 10-20% chained fights, that's +3-5 quiets, or up
  to −10 strain a run. The fix: play the moment on the blow, count at 2.5 s,
  and if a pack wakes in between, the cold motes fly back.

## (d) Legibility first?

Yes, as step 0, but as instrumentation, not the fix. Translator T1 (the
recharging button drawn at .5 opacity with two ember price pips), verifier T1
(a dead tap answers, and `deadTaps` goes into `__runStats`), and the arming
ring from translator T3 add up to about half an evening. The owner designed
the push, so he knows the gesture exists, and legibility won't raise his
pushes on its own. What it gives is the number. If dead taps are above 1 a
fight, the want is there and the gesture is hiding it. If they're near zero,
his diagnosis holds and the demand in (a) and (b) is the work. Ship it together
with the first demand change so the same three phone runs measure both.

## Keep / cut

| pitch | call | why, in numbers |
|---|---|---|
| verifier R1 / Claude C-R1, a push breaks a wind-up | **keep** | the one crawl rule; latency-scoped, see (b) |
| verifier R2, a push aims at the threat | **keep** | without it a pushed Lens hits the idle hulk, not the locking sentinel |
| verifier D3, the grill's four locks | **keep, replaces my Assembler line** | P(all four land unpushed in 2.7 s) = 0.20; expected pushes to finish = 1.21. Same curve as my 100-damage line (28 / 72 / 95%), but the unlit locks *are* the ask, with no number to read |
| translator D2, the magnet's inner ring | keep | 20 damage > the 16 HP break-even; the one boss move where HP-or-strain is a thumb decision |
| translator D4, the runaway thief | keep, later | the only loss that's a thing; closing 1 u/s on foot, so the legs or Hook are the answer; about 0.5 a run, so no effect on the band |
| translator D1, a miss is an opening | cut as demand | stuck hulk: 30 HP at ×1.5 = 20; Cleaver + one auto (27 + 7.5) kills it unpushed |
| Claude C-D1, cracks for any ability hit | cut | P(no ability ready inside 1.2 s) = 0.08, so 92% of cracks cash for free |
| Claude C-D2, the caller | later | a 3 s clock is good demand, but the caller dies in 1.2 s at 25 dps, and it reopens "no chain-waking" |
| verifier D2, the linked pair | cut for now | two answers at once, at 430 ms each, is more than one thumb can do |
| verifier R3, pushed whites borrow their blue | cut | it competes with R1 for what a push means, and it spends the found-blue surprise |
| translator R1, held open; R4, reach ×1.5 | cut | R1 overlaps the four locks; R4 is always on (autopilot) and erodes Rusted Hook |
| translator R2, walls break them; verifier R4, remembered | later | both are good once R1 has taught that a push does something |
| translator T2 / verifier T2 / my T1 / Claude C-T1, the answer lights | **merge, next** | one button, ember thread, only when that cooling part can break the wind-up that lands soonest; drop Still's head turn (at 16 px/u it's too small to count on) |
| Claude C-T2, teach at the first wind-up | keep | it replaces today's hint, which fires for 2 of 30 parts |
| my R2 pushed halves; my D2 elites read buttons | demote | R1 does their job for all 30 parts. The starter swap (Patient Lens, Overrun) stays, since it's one line |
| my R3, the last push is the whole of him | the owner's call | tone, not numbers |

## Where I changed my mind

1. Crawl demand: from "can't be tuned" to "can be tuned once the bar is
   readable and the latency limits the targets".
2. The Assembler: the verifier's four locks beat my damage line on
   legibility, at the same odds.
3. My three pushed halves: R1 covers all 30 parts with one rule.
4. A correction to verifier E1: at exactly 2 pushes a fight, Still stops at
   fight 10 (depth 2), not depth 4. At 1.5 a fight he stops at fight 20
   (depth 5), and with the ~1.5 Rest shrines a run, not at all.

## Final bundle

**Step 0 (half an evening):** the recharging button redrawn with its price,
the dead tap answering and counted, the arming ring.

**Then:** **R1 + R2, a push breaks the wind-up it's aimed at** (latency-scoped,
bolts at 26), plus **the waterline**, plus **the grill's four locks**. The
answer-lights merge (T2) comes next.

Stopped reachability under this bundle (crawl asks 1.0-1.5 a fight, Assembler
6, Arbiter 7 heats and vents):

| player | Stopped | entering depth 6 |
|---|---|---|
| watches the bar (keeps back 6/2) | 0% | 2.8-6.2 |
| spends at bosses (keeps back 4/0) | 6-29% | 3.0-6.9 |
| keeps nothing back | 9-39% | 2.9-6.2 |

Stopped is reachable, it happens mostly at depths 3 and 6, and only to players
who chose to spend. Numbers to lock on the phone: `deadTaps` and `pushes` a
fight before and after R1, where the target is answered asks of 1.0-1.5 a
fight. If that goes above 2, the first dial is the sentinel's 760 ms wind-up,
not the cost.
