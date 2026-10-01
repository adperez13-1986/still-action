# Lean trial 1: his first log with "weight" and "tap push" on

Log: `~/Downloads/still-playtest-2026-10-01 (1).json` (sent 1 Oct, 17:58, no words). Build 604e776 (both trials complete).
Two new runs, both **home, all 9 depths, road II**, with **weight + tap push + follow-through all on**:
- run 23 (`mupd8nrq`): flipped at d1 (d1 logs `weightMixed`/`tapPushMixed`, left out), clean d2-9.
- run 24 (`mupm99k6`): on from the start, clean d1-9.

Off = runs 18-21 (30 Sep / 1 Oct morning, follow-through only; the first runs that log `kills` and `fightS`), and runs 9-17
for `hpLost` (the brief's baseline). Two runs, so all of this is direction, not proof. Follow-through was on both sides, so it
isn't the difference; but weight and tap push were on together, so only the gesture's own fields can be laid on tap push alone.

## Weight

| line | pass | on | off | |
|---|---|---|---|---|
| `kills.part` share d1-2 | >= 45% | 62%, 67% (run 24); 79% (run 23 d2) | 19-54% (runs 18-20) | **pass**, clearly |
| `hpLost` d1-3 | within 20% of runs 9-17 | 130 (25 / 33 / 72) | 158 (43 / 17 / 99) | **pass**, at -18%: on the easy edge |
| freeze | <= 10% of fight time, parts >= 60% | 1.6-6.2 s a fight-minute (3-10%), parts ~85% | - | **pass** |
| `breaksBy` | read | ready 6, pushed 1 | - | breaks now come from plain casts |

- Fights run longer: d1 6.2 s a fight vs 3.9-4.8 off (packs x1.4 doing their job). Bosses about the same (d3 30 s both runs vs
  28-57 off; the Engine 35-38 s vs 50).
- Deep (d4-9) hpLost: run 24 530, run 23 279; off run 21 295. Run 24 was the hard one (d8 141, d5 108).
- So: tougher packs, but parts more than make up for it at d1-3. If he wants it harder, the dial is pack HP d1-2, not the parts.

## Tap push

| line | pass | on | |
|---|---|---|---|
| dead taps | ~0 | 0 (off: 1-2 a run) | **pass** |
| pushes a fight | 0.5-0.75 | d1-5 mostly 0.4-0.8; d8 1.4 (run 24) | **in the band** |
| gesture share | read | 38 of 38 pushes by tap | the hold never happened |
| `guarded` | rare outside mashes | 0 | no mashing, nothing ignored |
| `queued` / dropped | read | 6 queued, 0 dropped | 6 free casts from the queue |
| `strainAtBoss` | read | 2-6 | never near Stopped |
| neighbour pushes (nbMs < 40) | ~0 | 0 | no thumb rolls |

- Pushes land 0.3-4.5 s before ready (median ~1.5 s): deliberate pushes, not near-ready slips.
- Pushes did not rise (off d1: 0.5-0.67 a fight), so the strain worry (pushes x1.25-1.5, PITCHES) did not happen.
  The parked strain retune stays parked.
- Taps a play-minute: 18 (both runs) vs 15-17 off. A little more active, not a lot.

## What the log can't say

Every number is in range, but none of them says how it felt. Still to ask: five-body Cleaver vs jab, does the freeze read as weight
or lag, the sounds, crowding (preset B vs D), does a tap push feel intentional, does he miss the hold.
If his feel agrees, the next call is his: keep both on as the default (and retire the hold), or keep testing.
