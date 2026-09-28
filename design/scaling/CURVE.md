# The enemy curve by depth

28 Sep. Every multiplier is keyed on depth, never on his loadout or ranks. **Second pass**, for his new target: the floor player finishes about 1 run in 3, the median about 2 in 3, the investor nearly always and fast. "Finish" means felling the Arbiter.

## 1. Expected power by depth

**Modelled.** Tempersim (scratch) runs the real drop code over `tools/levels.json`, 20,000 runs per player: kills x0.4, floor parts for any slot, pedestals can't be melted, a swap resets rank, a melt at III is a mastery (max 6). Floor never melts; median melts half of what he could; invest melts all and never swaps a ranked part.

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

Ranks and masteries are counted on entering the depth; the index is the mid-depth mean.

**Today already scales density**: the room budget and heavy count (1/1/2/3) give level HP 494 / 469 / 690 / 866 (x1.75 by depth 5). Heavies and bosses don't grow: the investor kills a depth-5 heavy in 2.1 s and the Arbiter in 36 s.

## 2. The curve (second pass)

| | 1 | 2 | 3 Asm | 4 | 5 | 6 Arb |
|---|---|---|---|---|---|---|
| Ordinary HP | x1.0 | x1.0 | | x1.1 | **x1.3** | |
| (hulk / sentinel / ram / mite / Lobber) | 30/20/36/8/22 | same | | 33/22/40/9/24 | 39/26/47/10/29 | |
| Ordinary damage | x1.0 | x1.0 | | x1.0 | x1.0 | |
| Room budget: depth term + big-room bonus | 0+0 | 0+0 | | 1+0 (today 1+1) | **2+1** (today's) | |
| Heavy HP, on top of today's x2 | x1.0 (hulk 60) | x1.25 (75) | | x1.5 (90) | **x2.0** (120) | |
| Heavy damage | x1.0 (slam 9) | x1.0 | | x1.1 (10) | **x1.3** (12) | |
| Heavies per level | 1 | 1 | | 2 | 3 (unchanged) | |
| Boss HP | | | x1.1 (990) | | | x1.3 (1170) |
| Boss damage | | | x1.0 | | | x1.0 |

Depth 7 (walk mode) copies 5. No field is needed beyond `src/curve.ts`'s list. Heavies stay 3 at depth 5: every census level there has 4 main packs, but one is the Lobber lesson, which is never crowned, so a 4th heavy would clamp to 3. Heavy damage x1.3 carries that share instead.

**First pass (superseded).** Same as above except depth 5: HP x1.2, budget 1+1, heavy HP x1.75, heavy damage x1.2. Rechecked with the finish model below, it gave floor / median / invest finishing **75% / 99% / 100%**. My first-pass hand estimate had put the floor at 66%.

### Where the difficulty comes from, and why there

| Source | Share of the floor's Broke risk | Why this place |
|---|---|---|
| **Density at depth 5** (full budget, fodder x1.3) | ~90% | Depth 5 is where the players differ most: median x1.48 and invest x1.93 of the floor's power. Pressure attrition scales with time-to-kill, so it charges exactly for growth not taken. It also comes after the Assembler's home fork (`exitsAfterBoss`): a floor player who goes on has chosen the wall, so going home at 3 is a real decision. |
| **Heavies** (3 at depth 5, x2.0 HP, x1.3 damage) | small | Time and reading, not attrition: telegraphed and breakable. This is where growth is felt: the investor needs 4.3 s, the floor player 7.6 s. |
| **Bosses** (x1.1 / x1.3) | ~5% | The Assembler is where players barely differ (invest takes 0.66 of the floor's time), so making it hard kills the investor too. A harder Arbiter barely touches the median and only widens the floor-median gap. It stays the finale, and the investor's is fast (47 s). |
| **Damage** | none added to fodder | Damage multiplies every player's losses at once and makes each mistake cost more. HP turns into time, and time is what growth buys back. |

## 3. The growth test

Model (rough): damage 12 HP/s x index. HP lost is 0.60 per engaged pressure-body-second (calibrated on hpLost at depths 1-2: 77/82/12/58), plus a heavy's slam every 8 s it lives; boss HP lost is 0.85/s (Assembler) and 0.68/s (Arbiter) from the log. A check is Broke when HP lost exceeds 100 + scrap (+30 at depths 1-2, +15 at 4-5), with a spread of sd 35% (a guess).

Each cell reads floor / median / invest.

| Depth | Pack TTK s | Heavy TTK s | HP lost / pack | HP lost / level | Hulk hits | Broke % |
|---|---|---|---|---|---|---|
| 1 | 7.5 / 7.2 / 6.8 | 5.4 / 5.2 / 5.0 | 7.8 / 7.5 / 7.1 | 50 / 48 / 46 | 2.72 / **2.66** / 2.58 | 0 / 0 / 0 |
| 2 | 6.3 / 5.6 / 4.6 | 4.9 / 4.4 / 3.7 | 6.3 / 5.6 / 4.6 | 41 / 36 / 29 | 2.61 / 2.41 / 2.15 | 0 / 0 / 0 |
| 3 boss | 72 / 61 / 48 | | | 61 / 52 / 41 | | 3 / 0.4 / 0 |
| 4 | 9.2 / 7.3 / 5.3 | 6.2 / 5.0 / 3.8 | 10.1 / 8.0 / 5.7 | 65 / 51 / 37 | 2.87 / 2.46 / 2.09 | 1 / 0 / 0 |
| 5 | 15.9 / 10.7 / 8.3 | 7.6 / 5.3 / 4.3 | 21.9 / 14.7 / 10.8 | 140 / 94 / 69 | 3.39 / **2.66** / 2.37 | 70 / 26 / 3 |
| 6 boss | 85 / 56 / 47 | | | 58 / 38 / 32 | | 2 / 0 / 0 |
| **Finish** | | | | | | **28% / 74% / 97%** |

| Pass line | Result |
|---|---|
| Finish targets (33 / 67 / ~100) | **28 / 74 / 97.** This is the closest fit I found. The curve can pin two of the three. The gap between floor and median comes from temper's power gap (median x1.48 at depth 5), not from enemies: spreading the risk over more checks widens it (floor 30 costs median 80). Closing it to 33/67 is a temper change (a smaller rank II), not a curve change. |
| Invest clearly faster from depth 2 on | Invest takes 0.73 / 0.58 / 0.52 of the floor's time per pack, and 0.66 / 0.55 at the bosses. Depth 1 fails by construction: 0.92, with nothing melted yet. |
| Fodder stays fodder (median) | Hulk hits: 2.66 at depth 1, **2.66** at depth 5. |
| Damage growth modest | Fodder x1.0, heavy up to x1.2, bosses x1.0. HP lost no longer rises gently: depth 5 is the wall by design. |
| Sensitivity | With sd 25%: 23 / 81 / 100. With sd 45%: 29 / 67 / 93. |

## 4. Where it goes in code (not implemented)

- **`src/curve.ts`**: the `DEPTH_CURVE` fields are ordinary hp and damage, room budget depth term and big-room bonus, heavy hp and damage, heavies per level, and boss hp. It is read by depth only, and a `tools/leancheck.ts` assert keeps it from importing main, hud or save.
- **`src/dungeon.ts` ~1470**: `size = 2 + floor(rand()*2) + C.budget + (big ? C.bigBonus : 0)`. Keep the `rand()` call so seeds don't shift. **~1601**: `eliteCount = min(mainPacks.length, C.heavies)`. At depth 5, `heavies: 3`.
- **`src/main.ts` ~2300**: set `combat.curve = DEPTH_CURVE[depth]` next to `combat.pressure`.
- **`src/combat.ts` `addPack` (2500)**: non-leaders get `round(hp * curve.hp)`. **`crown` (2693)**: the leader gets `round(baseHp * 2 * curve.heavyHp)` and `dmgMul = curve.heavyDmg`, applied at the melee hit (553) and at shot creation. Boss adds and split halves stay unscaled.
- **Bosses**: `bossFor` (`src/areas.ts:412`) sets `hp`. Fix `src/boss.ts:127`, `:385` and `src/arbiter.ts:177`, which read `BOSS.hp` / `ARBITER.hp` instead of `def.hp`.
- **Tools**: fold tempersim into `tools/dropsim.ts`, which doesn't model temper. Regenerate `tools/levels.json` (25 Sep) with `__census`.

## 5. Open questions

1. **The auto/part damage split** (65/35 is a guess) sets every ratio above. Log `partDmg` per depth next to `autoDmg`.
2. **Depth 5 with pressure is unplayed, and it now carries almost all the risk.** Target `hpLost` at depth 5: median about 94, investor about 69. If the median dies there more than 1 time in 3, lower fodder HP at 5 to x1.2 before touching anything else.
3. **The spread** (sd 35%) decides the investor's 97%. Five or more logged runs per player type would pin it.
4. **Median = melts half.** Check it against `melts` per depth.
