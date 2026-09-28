# The enemy curve by depth

28 Sep. Every multiplier is keyed on depth, never on his loadout or ranks.

## 1. Expected power by depth

**Modelled.** Tempersim (scratch) runs the real drop code over `tools/levels.json`, 20,000 runs per player: kills x0.4, floor parts for any slot, pedestals unmeltable, a swap resets rank, a melt at III is a mastery (max 6). Floor never melts; median melts half of what he could; invest melts all and never swaps a ranked part.

**Power index**, where 1.00 = four rank-I parts and no masteries:
`0.65 + 0.35 x (sum of part rank factors / 4) x (1 + 0.5 x mark) + 0.146 x cleave + 0.04 x split`.
Rank factor = damage / cooldown: I 1, II 1.53, III 2.22. Heavies and bosses drop the cleave and split terms.

**Guessed.** Autos do 65% of the damage (the log: autos alone dealt 0.5-1.0 of each level's HP, 11 levels); mark adds +50% to part damage; median melts half; full pool, every pack killed, 25% of crates smashed.

| Depth | Floor: mean rank / masteries / index | Median | Invest |
|---|---|---|---|
| 1 | I / 0 / 0.86 | I / 0 / 0.89 | I / 0 / 0.94 |
| 2 | I / 0 / 0.99 | 1.3 / 0.0 / 1.12 | 1.6 / 0.3 / 1.36 |
| 3 Assembler | I / 0 / 1.00 | 1.7 / 0.3 / 1.18 | 2.35 / 1.9 / 1.51 |
| 4 | I / 0 / 1.00 | 1.6 / 0.3 / 1.27 | 2.35 / 1.9 / 1.73 |
| 5 | I / 0 / 1.00 | 2.0 / 0.9 / 1.48 | 2.8 / 4.1 / 1.93 |
| 6 Arbiter | I / 0 / 1.00 | 2.4 / 2.1 / 1.52 | 2.96 / 5.3 / 1.80 |

Ranks and masteries on entering the depth; index is the mid-depth mean. The investor is near max by 5.

**Today already scales density**: the room budget and heavy count (1/1/2/3) make level HP 494 / 469 / 690 / 866 (x1.75 by 5) and pressure bodies per level 14.9 / 13.8 / 17.3 / 23.0. Heavies and bosses don't grow: today the investor kills a depth-5 heavy in **2.1 s** (5.0 s at depth 1) and the Arbiter in 36 s.

## 2. The curve

| | 1 | 2 | 3 Asm | 4 | 5 | 6 Arb |
|---|---|---|---|---|---|---|
| Ordinary HP | x1.0 | x1.0 | | x1.1 | x1.2 | |
| (hulk / sentinel / ram / mite / Lobber) | 30/20/36/8/22 | same | | 33/22/40/9/24 | 36/24/43/10/26 | |
| Ordinary damage | x1.0 | x1.0 | | x1.0 | x1.0 | |
| Room budget, depth term + big-room bonus | 0 + 0 | 0 + 0 | | 1 + **0** (today 1+1) | **1** + 1 (today 2+1) | |
| Heavy HP (on top of today's x2) | x1.0 (hulk 60) | x1.25 (75) | | x1.5 (90) | x1.75 (105) | |
| Heavy damage (its own telegraphed hit) | x1.0 (slam 9) | x1.0 | | x1.1 (10) | x1.2 (11) | |
| Heavies per level | 1 | 1 | | 2 | 3 | |
| Boss HP | | | x1.1 (990) | | | x1.3 (1170) |
| Boss damage | | | x1.0 | | | x1.0 |

Reasons:
- **Ordinary HP x1.2 at 5**: the median's average hit grows 11.5 to 14.6, so fodder takes the same hits. Higher only costs the floor player.
- **Ordinary damage flat**: pressure hits stack, and attrition already grows with bodies x time-to-kill.
- **Budget trim** pays for the rest: pressure bodies per level become 14.9 / 13.8 / 14.6 / 16.6. Density still grows, from 2.5 to about 3.5 bodies a pack.
- **Heavies carry the HP**: telegraphed and breakable, so it tests reading, not attrition. His growth lands on a real fight.
- **Heavy count unchanged**: each is an owed elite-odds drop (more melts). +1 at 5 is the first lever if it feels thin.
- **Bosses**: the median's fight stays about 60 s (61 / 56). Damage flat: the Assembler already broke him once (121 lost).
- **Mite 10 at 5**: still one strike; its damage is capped (`BROOD.innerMax`).

## 3. The growth test

Model (rough): damage 12 HP/s x index; HP lost 0.60 per engaged pressure-body-second (calibrated on hpLost at 1-2: 77/82/12/58), plus a heavy's slam every 8 s it lives.

| Depth | Pack TTK s (floor/med/inv) | Heavy TTK s | HP lost per pack | HP lost per level | Hulk hits (floor/med/inv) |
|---|---|---|---|---|---|
| 1 | 7.5 / 7.2 / 6.8 | 5.4 / 5.2 / 5.0 | 7.8 / 7.5 / 7.1 | 50 / 48 / 46 | 2.72 / **2.66** / 2.58 |
| 2 | 6.3 / 5.6 / 4.6 | 4.9 / 4.4 / 3.7 | 6.3 / 5.6 / 4.6 | 41 / 36 / 29 | 2.61 / 2.41 / 2.15 |
| 3 boss | 72 / 61 / 48 | | | about 61 floor | |
| 4 | 9.2 / 7.3 / 5.3 | 6.2 / 5.0 / 3.8 | 10.1 / 8.0 / 5.7 | 65 / 51 / 37 | 2.87 / 2.46 / 2.09 |
| 5 | 11.5 / 7.8 / 6.0 | 6.6 / 4.7 / 3.7 | 13.9 / 9.4 / 7.0 | 89 / 60 / 44 | 3.13 / **2.45** / 2.18 |
| 6 boss | 85 / 56 / 47 | | | about 58 floor | |

| Pass line | Result |
|---|---|
| Invest clearly faster than floor | Invest/floor pack TTK 0.92 / 0.73 / 0.58 / 0.52, bosses 0.67 / 0.55. **Depth 1 fails by construction** (nothing melted yet); passes from late depth 1. |
| Floor finishes most runs | Vs 100 + scrap (+30 at 1-2, +15 at 4-5), sd 35% (guess): P(finish) about **66%** (today 64%). Depth 5 is about 20% Broke. Marginal pass. |
| Fodder stays fodder (median) | Hulk hits 2.66 at 1, 2.45 at 5 (-8%); today 2.04 (-23%), the one-shot he feels. **Pass.** |
| HP lost rises gently | Floor 50 / 41 / 65 / 89 (today 50 / 39 / 67 / 95, pressure at 4-5 untested). Smoothed, not added to. |

A III Focusing Lens (42) still one-shots a depth-5 hulk (36): the fantasy. His heavy now takes 3.7 s, not 2.1.

## 4. Where it goes in code (not implemented)

- **New `src/curve.ts`** (no three.js, so tools import it): `DEPTH_CURVE: Record<depth, { hp, dmg, heavyHp, heavyDmg, budget, bigBonus, heavies, bossHp }>`, depths 1-7 (walk mode's 7 copies 5). Read by depth only; a `tools/leancheck.ts` assert that it never imports main, hud or save.
- **`src/dungeon.ts` ~1470**: `size = 2 + floor(rand()*2) + C.budget + (big ? C.bigBonus : 0)`. Keep the `rand()` call so seeds don't shift. **~1601**: `eliteCount = min(mainPacks.length, C.heavies)`.
- **`src/main.ts` ~2300**, where `combat.pressure` is set: also set `combat.curve = DEPTH_CURVE[depth]`.
- **`src/combat.ts` `addPack` (2500)**: non-leaders `e.hp = round(e.hp * curve.hp)`. **`crown` (2693)**: `leader.hp *= 2` becomes `round(baseHp * 2 * curve.heavyHp)`, plus `leader.dmgMul = curve.heavyDmg` (a new field beside `speedMul`, applied at the melee hit, 553, and at shot creation). Boss adds and split halves unchanged.
- **Bosses, `src/areas.ts` `bossFor` (412)**: `hp` from `bossHp`. Fix `src/boss.ts:127`, `:385` and `src/arbiter.ts:177`, which read `BOSS.hp` / `ARBITER.hp` and ignore `def.hp`.
- **Tools**: `tools/dropsim.ts` doesn't model temper (no x0.4, floor parts only for worn slots): fold tempersim in. Regenerate `tools/levels.json` (25 Sep) with `__census` after the budget change.

## 5. Open questions

1. **The auto/part damage split** (65/35 is a guess) drives every number above. Log `partDmg` per depth next to `autoDmg`.
2. **Pressure at depths 4-5 has never been played.** The model says it is the biggest load in the game. Check `hpLost` at 4-5 over 5 or more runs. If the floor player's mean is over 80 at depth 5, first set ordinary HP at 5 to x1.1 (about -6 HP a level), then trim the budget at 5 by one more.
3. **Median = melts half.** Check it against `melts` per depth once more temper runs are logged.
