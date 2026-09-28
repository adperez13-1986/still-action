# The enemy curve by depth

28 Sep. Every multiplier is keyed on depth, never on his loadout or ranks. **Third pass**: recalibrated from his runs on the b90e736 curve. The target is unchanged: the never-melt (floor) player finishes about 1 run in 3, the median about 2 in 3, the investor nearly always and fast. "Finish" means felling the Arbiter.

## 1. What his runs say

HP lost per depth (`playtest.json`):

| Run | Melts | 1 | 2 | Asm | 4 | 5 | Arb | End |
|---|---|---|---|---|---|---|---|---|
| 12:38 (no temper, before the curve) | none | 77 | 12 | 121 | | | | Broke at 3 |
| 13:13 (temper, before the curve; pressure off at 3-6) | 10 | 82 | 58 | 57 | 18 | 27 | 40 | Home |
| 14:59 (b90e736, investor) | 18, all 6 masteries | 21 | 9 | 39 | 32 | 22 | 14 | Home |
| 15:27 (b90e736, never-melt) | 0 | 55 | 8 | 48 | 76 | 38 | 42 | Home, strain 0 |

- **The damage-taken model was wrong at depth 5.** It predicted 140 for the floor player; he lost 38 (and 76 at depth 4, against a predicted 65). He fought 4 fights at depth 5 against about 6 packs, so side rooms are skippable. I pool depths 4-5 at **57 per level** for the floor player (investor 27).
- **The power model holds.** Never-melt: autos 64% of damage (modelled 65%). Invested: parts 66% (modelled 59%). The investor's HP lost at depths 4-5 is 0.47 of the floor player's (modelled 0.49-0.57).
- **Bosses don't separate the players.** At the Assembler and Arbiter the floor player's autos did 64% and 74% of the damage; the investor's did 30% and 49%. The close strike alone did 420-770 of the Arbiter's 1170 HP from its feet, where the scald (800 ms windup, 2.5 s cooldown, 14 damage) is the only answer.

**Recalibrated model.** On the b90e736 curve, the floor player's per-check mean HP lost is 55 / 20 / Asm 60 / 57 / 57 / Arb 42. The median and investor are derived from the power model's ratios. HP lost is lognormal with CV 0.5 (the logged spread: Assembler 39-121, depth 1 21-82). Broke when HP lost exceeds 100 plus scrap (+30 at depths 1-2, +15 at 4-5).

On today's curve this model gives **79% / 92% / 97%**, which matches "too easy".

## 2. Which levers the data points at

| Lever | Verdict |
|---|---|
| **Ordinary damage** | **Needed.** Ordinary HP is pinned by "fodder stays fodder": at depth 5, x1.3 already equals the median's hit growth. Density lengthens levels and bit far less than modelled. Damage raises HP lost without changing hits-to-kill or kill time, so the investor stays fast. **x1.5 at depths 4-5 with rule B, x2.0 without it.** |
| **Rule B: bosses take half damage from the autos** (close strike, planted shot, auto shot, and the cleave and split shares they carry); parts and pushes do full damage | **The best separator available.** Boss time-to-kill rises by 1/(1 - 0.5 x auto share): floor x1.47 at the Assembler and x1.59 at the Arbiter, investor x1.18 / x1.33. The fight lasts longer for whoever didn't grow, and standing at the Arbiter's feet stops being free. |
| **Boss HP** | Without rule B it hits every player's kill time equally. Kept as a trim only. |
| **Heavies, budget** | Unchanged from b90e736. |
| **Depths 1-2** | Leave alone. At depth 1 all three players are the same, so any risk there comes straight off the investor's finish rate. |

## 3. The two tables

Only the changes from b90e736 are shown; every other field keeps its value.

| Field | 1 | 2 | 3 Asm | 4 | 5 | 6 Arb |
|---|---|---|---|---|---|---|
| **(A) as now** | | | | | | |
| `dmg` (ordinary) | 1.0 | 1.0 | | **2.0** (jab 10, burst shot 6, ram 28) | **2.0** | |
| `bossHp` | | | 1.1 | | | **1.7** (1530) |
| **(B) with the new rule** | | | | | | |
| `dmg` (ordinary) | 1.0 | 1.0 | | **1.5** (jab 7.5, shot 4.5, bite 4.5, ram 21) | **1.5** | |
| `bossHp` | | | **1.0** (900) | | | 1.3 (1170) |
| **`bossDmg`** (new) | | | **1.1** | | | **1.2** |
| **`bossAutoMul`** (new) | | | **0.5** | | | **0.5** |

Unchanged from b90e736:

| Field | 1 | 2 | 4 | 5 |
|---|---|---|---|---|
| Ordinary HP | x1.0 | x1.0 | x1.1 | x1.3 |
| Room budget | 0+0 | 0+0 | 1+0 | 2+1 |
| Heavy HP | x1.0 | x1.25 | x1.5 | x2.0 |
| Heavy damage | x1.0 | x1.0 | x1.1 | x1.3 |
| Heavies per level | 1 | 1 | 2 | 3 |

**New fields:**
- **`bossAutoMul`**: multiplies an auto's hit when the target is a boss. It applies where the close strike (`close.hit(HAND.damage)`), the lance and auto bolts, the cleave share and split shots land. Parts, marks and pushes are untouched.
- **`bossDmg`**: multiplies every boss hurt path: melee, wave, shots, and hazards (lance, shell, scald). Without it, B gives 43 / 78 / 94.

A needs no new field.

## 4. The growth test (recalibrated)

Each cell reads floor / median / invest.

| Check | (A) HP lost | (A) Broke % | (B) HP lost | (B) Broke % |
|---|---|---|---|---|
| 1 | 55 / 53 / 51 | 2 / 2 / 1 | same | same |
| 2 | 20 / 18 / 15 | 0 | same | 0 |
| Assembler | 60 / 51 / 40 | 9 / 5 / 2 | 88 / 67 / 47 | 31 / 14 / 3 |
| 4 | 108 / 84 / 61 | 35 / 18 / 6 | 83 / 65 / 47 | 18 / 7 / 2 |
| 5 | 109 / 73 / 54 | 36 / 12 / 3 | 84 / 56 / 41 | 18 / 4 / 1 |
| Arbiter | 55 / 36 / 30 | 7 / 1 / 0 | 80 / 48 / 37 | 24 / 4 / 1 |
| **Finish** | | **34 / 67 / 88** | | **35 / 73 / 92** |
| With CV 0.35 / 0.65 | | 37/79/97 · 32/59/80 | | 42/86/99 · 32/63/84 |

Boss kill time (s), floor / median / invest (median estimated):

| | Assembler | Arbiter |
|---|---|---|
| A | 71 / 60 / 78 | 95 / 63 / 76 |
| B | 95 / 72 / 83 | 116 / 70 / 77 |

- **Growth felt past depth 1.** Invest/floor pack kill time is unchanged, since damage doesn't touch kill time: 0.73 / 0.58 / 0.52 at depths 2 / 4 / 5. Under B the investor also takes 0.87 of the floor player's time at the Assembler and 0.66 at the Arbiter; under A it is 1.10 and 0.80.
- **Fodder stays fodder.** Ordinary HP is unchanged, so the median still needs 2.66 hits per hulk at depth 5, the same as at depth 1.
- **B is the recommendation.** It hits the targets with half the damage growth of A. It spreads the floor player's risk over four checks instead of two. It keeps the investor near 92%, against A's 88%.
- **Neither version reaches "nearly always" for the investor.** The tails at depth 1 and the Assembler (2-3%) happen to everyone. Getting past 95% needs less variance, not more curve.

## 5. Open questions

1. **Depths 4-5 are one run each** (76 and 38). The pooled 57 is the anchor for the x1.5. Five or more never-melt runs would settle it.
2. **The spread (CV 0.5)** moves the investor between 84% and 99% (the CV 0.35 / 0.65 row). His skill is rising run to run: depth 1 went 77 / 82 / 55 / 21.
3. **The Arbiter's feet.** Rule B makes standing there slow, not dangerous. The scald's cooldown is a boss-design question outside the curve.

## Superseded passes

- **First pass** (depth 5: HP x1.2, budget 1+1, heavy HP x1.75, heavy damage x1.2; Assembler x1.1, Arbiter x1.3). The model gave 75 / 99 / 100.
- **Second pass**: the b90e736 curve above, which the old model put at 28 / 74 / 97. The real runs show it is about 79 / 92 / 97: the old damage-taken model overstated depth-5 losses about 3.7x.
- The power-by-depth model (tempersim, index `0.65 + 0.35 x parts x (1 + 0.5 x mark) + cleave/split`) stands. His runs confirmed its auto/part split.
