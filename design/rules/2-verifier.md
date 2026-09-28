# Round 2: the verifier

## What persuaded me (verdicts changed)

- **The autos are the main free push, not the riders.** Balancer and translator: 43 hand breaks and 9 eye
  breaks in 19 fights, against 10 pushes; the autos dealt 72% of the Arbiter. The riders are the smaller
  substitute; my round 1 had it backwards.
- **Rule 7: my sustain budget is withdrawn.** I take the translator's wording instead: *nothing free does both;
  the autos, riders and anything that fires without a press do offence or defence, never both.* It's
  checkable: count strikes cancelled with no press per fight.
- **Rule 2:** the balancer's wording, "and a price the player paid to meet it". It replaces mine.
- **Rule 4:** the translator's test, "if you'd press it exactly like its white, it has no opinion". It's better
  than mine.
- **My change 1 ("prime") is withdrawn** for riders that fire on a pushed break (balancer and translator).
  That's one routing change in `trigger()`, and easier to read than a half-cooldown.

## Where I disagree

- **Claude's "a break makes the next push cost 1".** It reopens DESIGN's "no part lowers strain". Flag it to him;
  don't build it.
- **Claude's caller that wakes the next pack.** The crawl design ruled out chain-waking, and the strain round cut
  a caller. The balancer's caller (while it stands, the autos can't break its pack) doesn't reopen that.
- **Claude's rule 3 ("two may multiply, three may not").** Open x1.5 times a mark x2 already makes x3. I back the
  balancer's (take the larger, cap x2): one damage function, one unit test.

## The three fixes for the free autos

| fix | for | against | the check within 3 runs (~60 fights) |
|---|---|---|---|
| **(a) Autos never break** | Clean. The push owns the break. | It undoes pass 2's fix for kiting, and removes marksman's only trigger. The biggest change of the three. | `pushes`/`fights` >= 1.0 (today 0.49). `breaks` (pushed) a fight up. Kiting: `hand` strikes a fight must stay >= 70% of today (6.9). |
| **(b) Poise, 3 s per enemy** | One constant, reversible. Keeps the hand's feel and the anti-kiting fix. | Invisible unless shown: a hit on a poised windup needs its own dull clank, or the missed break reads as a bug. | (`handBreaks` + `eyeBreaks`)/`fights` <= 1 (today ~2.7). Pushes a fight >= 1.0. New field: `poised` (an auto hit on a windup that didn't break), so we know it fired. |
| **(c) Mine: prime, and the quiet heals 1/4** | The quiet dial raises HP pressure. | It never touches the free break, so by the balancer's numbers it can't fix observation 1. Prime is withdrawn (above). | New field needed first: `hpLost`/`hpHealed` per depth; with it, HP lost per fight by depth. Pushes a fight is the verdict. |

**My position: (b) plus riders on pushed breaks, as one combat trial.** Poise alone starves the riders
further; riders on pushed breaks alone change nothing while free breaks keep coming. Together they are one
rule: *a break you didn't pay for pays nothing* (the new rule 2).

- If (b) at 4 s (the dial's top) still logs more than 1 free break a fight, go to (a).
- The quiet at 1/4 stays his dial, to try only after (b) has been read.

**Pass lines for the trial:**
- Crawl pushes a fight >= 1.0.
- Free breaks a fight <= 1.
- Auto share of the Arbiter's HP <= 50%, from `autoDmg` (three samples: a direction, not a pass).
- Riders fire >= 2 a run where worn, now off pushes.

Three runs can't show Stopped or Broke rates. Those wait for 6+.

**Log fields to add before he plays** (about 15 lines in `playlog.ts`):
- `poised`
- `hpLost` and `hpHealed` per depth
- `partDmg` per depth, so the translator's M5 (autos under 45% of damage) is measured, not guessed.
