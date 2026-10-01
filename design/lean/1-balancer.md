# Lean on the parts, round 1: balancer

`node design/lean/lean-sim.mjs` (6 s). Part A is the autos-sim2 pack and boss fight, unchanged and calibrated, extended with enemy HP, part power and last-hit kills. It models today at 32 / 74 / 92 against CURVE9's 31 / 74 / 91, with part kills for the never-melt player at 38% against his logged 36% (runs 18-20, d1-2, `kills`). Part B runs strain over 9 depths, crossed with CURVE9's Broke model. Today it gives 0.48 pushes a fight and 6-7% Stopped, against his 0.4-0.5 and 1 run in 9 (run 13: 9 pushes at the Assembler).

Blind to: shove, stagger, a break's defence, hits not taken, feel.

## What his log says first (runs 9-20)

| | count |
|---|---|
| ready casts / pushes / dead taps | 940 / 118 / 30 |
| windups broken by a push | **4** (3.4% of pushes) |
| windups broken by the autos (hand 31, eye 46) | 77 |
| dead taps < 0.6 s from ready (of 8 with `leftMs`) | 4 |

The push's main effect hardly happens (pressure hulks have no windup; the autos break the rest). The gesture fails 1 attempt in 5 (30 dead of 148); the decision costs more: 89% of presses are ready casts, and a push is worth half a cast. "Troublesome" is a hold that buys almost nothing.

## Ask 1, tougher + stronger: PARTLY

**Strongest reason: tougher enemies alone are a cut, and stronger damage mostly pays the investor.** The never-melt player fires about 3 parts a pack fight because he hesitates, not because of cooldowns, so part power reaches him only through those 3 casts.

Cells are never-melt / investor; finish is never-melt / median / investor.

| option | pack time | boss time | part share of damage | part kills | finish |
|---|---|---|---|---|---|
| today | 1 / 1 | 1 / 1 | 32 / 59% | 38 / 68% | 32/74/92 |
| HP ×1.5, parts ×1 | 1.40 / 1.31 | 1.49 / 1.51 | 35 / 64% | 37 / 69% | **5/39/70** |
| HP ×1.5, parts ×2 | 1.14 / 1.00 | 1.00 / 0.85 | 47 / 71% | 56 / **95%** | 25/74/93 |
| packs ×1.5, boss ×1.2, area + torso/legs ×1.8 | 1.10 / 0.89 | 0.99 / 0.93 | 48 / 74% | 45 / 72% | 27/75/94 |
| **packs ×1.25, boss ×1.1, area + torso/legs ×1.5, head/arms ×1.1** | **1.00 / 0.85** | 0.95 / 0.90 | **44 / 71%** | 45 / 71% | **34/79/95** |
| the same, never-melt pressing 25% sooner | 0.93 / 0.85 | 0.89 / 0.91 | 48 / 71% | 49 / 71% | 41/81/95 |

- **Mostly area, not damage.** Damage overkills packs and multiplies the investor's ranks and states (×2 at rank III; at damage ×2 his parts take 95% of kills). Area grows with the pack and gives the never-melt player's few casts more. The gap holds with area (32→34 / 92→95) and widens with damage (25 / 93).
- **Which bodies.** Packs take the HP (the autos win there). Bosses ×1.1 only: parts already do 50-79% there. Boss casts stay 28 / 20, so the strain clock doesn't move.
- **Weakest parts**, one-body DPS (close strike 16.1): head and arms 6.2-6.9; torso 1.5-2.3 (Vent, Chill, Backdraft, Lure); legs 1.5 (Kickstart), 0 (Skitter, Frost, Spring). The long-cooldown slots are weak, so they get ×1.5 and the area.
- **Area:** vent radius ×1.25, dash run-over half-width ×1.5 (~+0.25 bodies a cast), Scrap Cleaver 120°→160°. None on the head (a piercing white Lens wears away Cracked Lens); Frayed keeps its cones.
- **The ceiling for the never-melt player is pressing.** His kills by parts only reach ~45-49% under any power setting.

## Ask 3, every cast a push: DISAGREE with V1 and V3; AGREE with his "full effect"

**Strongest reason: under V1, strain counts presses, so leaning on the parts is what gets him Stopped.**

| variant | Broke / Stopped / Made it, never-melt \| median \| investor | pushes a fight |
|---|---|---|
| V0 today | 64/6/29 \| 24/7/69 \| 8/7/85 | 0.48 |
| V1 every cast +0.25 | 68/**0**/32 \| 25/0/75 \| 8/0/92 | – |
| V1 +0.35 | 66/8/26 \| 25/9/66 \| 8/8/84 | – |
| V1 +0.35, **he presses 30% more** | 48/48/4 \| 21/**67**/12 \| 6/74/20 | – |
| V1 +0.5 | 39/60/1 \| 18/**79**/3 \| 5/90/5 | – |
| V2 tap pushes, pushes ×1.5, plus eager taps | 48/31/21 \| 18/34/48 \| 6/34/60 | 0.86 |
| V3 = V1 +0.25 and tap push +3 | 6/94/0 \| 3/96/0 \| 1/98/1 | 0.98 |
| **V4, pushes ×1.5** | 50/27/23 \| 19/29/52 \| 7/28/65 | 0.76 |
| **V4, pushes ×1.5, quiet −3** | 56/19/25 \| 21/**20**/59 \| 7/20/73 | 0.75 |

- **V1 is a knife edge**: Stopped 0 → 9 → 79% between 0.25 and 0.5 a cast. It rises with growth (the investor reaches more bosses: 90% at +0.5). 0.35 a cast can't be drawn as pips. The only choice left is "press less": the opposite of this round's goal, and the end of "strain is a choice".
- **V3 is dead** (94-98% Stopped).
- **If every cast breaks, a windup still asks for timing:** hit it inside the window, with whatever is ready. It no longer asks for strain. It loses little, since pushes broke 4 windups in 12 runs.
- **V4 (mine), "tap pushes, near-ready queues":** a ready cast carries the break rule and threat aim (his "full effect", free). A cooling press with > 400 ms left pushes on touch-down, +2, no hold. ≤ 400 ms queues and fires free when ready, so the eager taps cost nothing (V2 charges them). Patient Lens, Overrun, Lure and Plumb Line keep push-only extras: an always-full Patient Lens is 21 DPS, 3× Focusing Lens.
- **What it breaks:** the hold, and the 120 ms grace (it becomes a 400 ms queue). The cap, the +2 and Rest stay.
- **Push rate is the unknown.** Recovering the dead taps alone is about ×1.25. At ×1.5, Stopped goes 6% → 28%. The quiet at −3 brings it back to 20%. 77-94% of Stopped lands at bosses, as designed.

## Ask 2, drama: AGREE

**Strongest reason: it is the only ask that can't hurt the never-melt player**, if it is budgeted.
- **Drama follows the cooldown**: an 8 s Kickstart fires ~7 a minute and can carry 3× a 2.6 s Cleaver's weight.
- **Hit-stop ms = 30 + 8 × cooldown s, cap 100** (Cleaver 51, Lens 64, Vent 82, dash 94). Global freeze (enemy timers stop), so balance holds; ~5% of fight time at 42.6 casts a fight-minute; merge freezes within 200 ms. A freeze in a windup adds ~70 ms of reaction: a small uncounted defence buff.

## Proposal and smallest trial

Two pause switches, applied at once. They don't interact: boss casts are unchanged, so strain is unchanged.

1. **"heavier parts"** (Ask 1): pack HP ×1.25, bosses ×1.1, torso/legs ×1.5, head/arms ×1.1, and the area numbers above.
2. **"tap push"** (V4): strain numbers untouched for the first run.

**One run to depth 3 or further.** He should notice whether the vent and the dash clear space and finish bodies, and whether pushing stopped feeling like effort.

| log field | pass |
|---|---|
| `kills.part` share at d1-2 | ≥ 45% (today 36%) |
| `hpLost` at d1-3 | within 20% of runs 9-17 |
| `deadTaps` | about 0 |
| new `queued` | counted |
| pushes a fight | 0.5-0.75. Above 0.75, set the quiet to −3 before a 9-depth run. |
