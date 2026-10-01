# Lean on the parts, round 3: balancer (new floor target)

`node design/lean/lean-sim.mjs r3` (16 s; `r3 fast` 5 s). Target from DESIGN.md "The floor player": never-melt
finishes ~20%, median 70-75%, investor 90%+, judged by median and investor first. Strain untouched.

New in the sim:
- **A real median player**: rank I, hesitation 2.3 s, states x1.1. Before, the median was the mean of the other two.
- **d1-2 at white for everyone.** Nobody has melted much yet, so only hesitation separates the players there.
- **Finish uses body-seconds^0.8 on crawl checks** (alive bodies x s, the damage proxy; honest for pack size) and kill
  time on bosses. Today reads 31/74/91 by construction. `kt` = kill-time model, `e.3` = body-s^0.3 (CURVE9's 0.3
  density elasticity), for sensitivity.
- **Depth-split packs and a second area step.** Area 2 = vent radius x1.4, dash half-width x2, Cleaver 180 deg.

All cells are never-melt / median / investor. Finish is Broke-only, as in CURVE9; the Made-it with strain is in the
last table.

## 1. Bigger packs: still no at d1-2; from d4 only +1, and HP does it better

All rows use the r1 part power (area 1, torso/legs x1.5, head/arms x1.1).

| packs | d1-2 body-s | d1-2 part kills | d4+ kill | d4+ body-s | d4+ part kills | finish bs | kt | e.3 |
|---|---|---|---|---|---|---|---|---|
| r1 pick: 4 x1.25 | 1.07/1.02/0.99 | 46/53/59 | 1.00/0.93/0.85 | 1.05/0.99/0.90 | 45/65/69 | 31/77/94 | 34/79/94 | 31/75/92 |
| +1, same total (x0.98) | 1.28/1.24/1.19 | 40/45/51 | 0.99/0.90/0.84 | 1.24/1.16/1.09 | 48/57/89 | 22/70/90 | 34/80/94 | 28/73/91 |
| +2, same total (x0.81) | 1.61/1.55/1.49 | 37/43/48 | 1.00/0.89/0.87 | 1.49/1.38/1.32 | 44/65/90 | 12/58/83 | 33/80/94 | 24/70/89 |
| +1, HP x1 | 1.32/1.30/1.27 | 39/45/50 | 0.99/0.94/0.84 | 1.24/1.22/1.09 | 47/56/88 | 22/67/90 | 34/79/94 | 28/72/91 |
| +2, HP x1 | 1.79/1.73/1.70 | 39/46/51 | 1.13/1.05/0.91 | 1.66/1.60/1.41 | 48/55/89 | 8/47/78 | 27/75/93 | 22/67/88 |
| +1 alongside x1.25 | 1.52/1.46/1.43 | 47/53/59 | 1.19/1.10/0.98 | 1.50/1.41/1.27 | 44/64/68 | 12/58/85 | 24/73/92 | 24/70/90 |
| +1 HP x1, from d4 | (pick) | (pick) | 0.99/0.94/0.84 | 1.24/1.22/1.09 | 47/56/88 | 22/69/92 | 34/79/94 | 28/73/91 |
| +2 HP x1, from d4 | (pick) | (pick) | 1.13/1.05/0.91 | 1.66/1.60/1.41 | 48/55/89 | 9/52/85 | 27/76/94 | 23/68/90 |
| +1 HP x1, from d4, area 2 | (pick) | (pick) | 0.94/0.88/0.78 | 1.19/1.17/1.03 | 49/58/89 | 25/72/93 | 38/82/95 | 29/74/92 |

- **d1-2: no.** At white, an extra body splits the same few casts. Never-melt part kills fall 46 -> 39-40% (trial line
  45%) and body-s goes to 1.3 (hpLost line: within 20%).
- **The median's part kills fall with more bodies** (65 -> 56%): at HP x1 more last hits go to the autos. Only the
  investor gains (88%: his Cleaver one-shots a 30). That is the r2 breakpoint again, not leaning.
- **The extra body costs the median 8 points of finish under body-s^0.8**, and about 2 under e.3. The verdict on bodies
  hangs on that exponent (open question). It is never better than HP: at equal floor cost, row C below loses 3 median
  points and 2 share points to row B.
- **+2 is out** under every model.

## 2. Ask 1 re-tuned: the pick is too soft now, so enemies get tougher and parts stronger

Under the new model the r1 pick gives **31/77/94**. That leaves the floor 11 points over target and the median over the
band. Grid: 350 combos (d4+ HP 1.25-2.2 x 4-5 bodies x boss 1.1-1.5 x 5 power sets), d1-2 at x1.4. 17 land in the band
with the median's d4+ kill time <= 1.10 (fodder stays fodder for him). Power: P2 = area 1, t/l x1.8, h/a x1.15;
P4 = area 2, t/l x1.8, h/a x1.2; P5 = area 2, t/l x2, h/a x1.1.

| option | finish bs (kt / e.3) | d4+ part share | boss share | d4+ part kills | d4+ kill | boss kill |
|---|---|---|---|---|---|---|
| r1 pick | 31/77/94 (34/79/94, 31/75/92) | 44/59/71 | 56/71/82 | 45/65/69 | 1.00/0.93/0.85 | 0.95/0.92/0.91 |
| r1 power, d4+ x1.5 (toughen only) | 22/72/91 | 46/62/72 | 56/71/82 | 45/66/74 | 1.16/1.04/0.98 | 0.95/0.92/0.91 |
| D: P2 (area 1), d4+ x1.65, boss x1.1 | 23/74/92 | 50/65/75 | 58/73/83 | 47/67/77 | 1.18/1.04/1.01 | 0.91/0.87/0.87 |
| **B: P4, d4+ x1.65, boss x1.3** | **20/73/92** (24/76/93, 27/74/91) | **52/68/78** | **60/74/85** | **49/70/79** | 1.12/0.95/0.91 | 1.03/0.98/0.95 |
| A: P5, d4+ x1.8, boss x1.2 | 18/72/92 | 54/68/79 | 60/74/84 | 49/68/81 | 1.22/1.01/0.95 | 0.96/0.91/0.90 |
| C: P4, d4+ 5 bodies x1.25 | 19/70/92 | 54/66/78 | 60/74/84 | 46/64/77 | 1.08/0.97/0.82 | 0.87/0.83/0.81 |

**Pick B.**
- **It leans the median hardest of any option in the band.** His d4+ part share goes 59 -> 68% and his part kills
  65 -> 70%, while his pack and boss kill times stay at today's (0.95 / 0.98).
- **Only the never-melt player feels the toughness.** His packs take 1.12, and his hulks need 6.4 close strikes instead
  of 3.9.
- **Bosses get x1.3.** With area 2 and x1.8 on the slow slots, boss x1.1 would make every boss faster than today
  (0.83-0.87).
- **A and B tie on score.** B keeps the median's packs at 0.95 where A's are 1.01. B also needs less HP, and less HP
  means less "sponge" feel.
- **D is the fallback** if area 2 crowds a phone screen in the translator's hands. It costs 3 points of median share.

**d1-2 (everyone at white): packs x1.4, 4 bodies.**
- With P4 the floor is at 1.07 kill and 1.16 body-s (within 20%). Part kills are 54/61/67: the trial line (>= 45%)
  passes with room.
- **x1.4 is a breakpoint**: the white Lens (26 x1.2 = 31) still one-shots the back body (20 x1.4 = 28). At x1.5 part
  kills drop 4 points. Don't round it up.

## 3. Strain (unchanged; reported only)

| B/S/M, strain model | pushes as today | tap push x1.25 | tap push x1.5 |
|---|---|---|---|
| r1 pick | 65/6/29 \| 22/7/72 \| 6/6/88 | 57/17/26 \| 19/18/63 \| 5/18/77 | 52/27/22 \| 17/28/55 \| 5/29/66 |
| B | 75/6/19 \| 26/7/68 \| 7/7/86 | 66/17/17 \| 23/17/59 \| 7/18/75 | 59/26/14 \| 21/28/52 \| 7/30/64 |

Stopped doesn't move with the enemies (boss fight length for the median is 0.98), only with the push rate, as in r2.

## Recommended numbers

| dial | r1 pick | **r3** |
|---|---|---|
| pack HP d1-2 | x1.25 | **x1.4** |
| pack HP d4+ (on the 1.3 bucket) | x1.25 | **x1.65** |
| bodies a pack | 4 | **4** |
| boss HP | x1.1 | **x1.3** |
| torso / legs damage | x1.5 | **x1.8** |
| head / arms damage | x1.1 | **x1.2** |
| vent radius / dash half-width / Cleaver | x1.25 / x1.5 / 160 deg | **x1.4 / x2 / 180 deg** (+ shove) |

## Open questions

1. **The body-s exponent (0.8 vs 0.3)** decides whether +1 body costs the median 8 points or 2. Log hpLost by pack
   size once.
2. **Median calibration** (hesitation 2.3, rank I) is a guess: no median run is logged.
3. **Area 2's real body counts** (the sim gives ~1.85 bodies a cast) need the translator's geometry check.
