# Round 3: the balancer (pricing BUILD.md)

2 Oct 2026. BUILD.md §9 item 7: price the numbers left to me. Every name is PLACEHOLDER.

How to rerun (both new, both mine):
- `node design/buildlayer/build-sim.mjs r3 2500`: BUILD.md's numbers.
- `TUNE3=prop node design/buildlayer/build-sim.mjs r3 2500`: the numbers below. Add `RAMPACK=1 CORES=ram` for Ram's pack build. `r3m` prices each part alone in its slot, `r3f` prices the never-melt floor.
- `npx tsx design/buildlayer/coresim.ts --runs 20000 --share 0.5 --upfrom 7`: the hunt. It is a copy of `tools/dropsim.ts`'s live run (9 depths, pedestals off, kills x0.4, melts), plus §2.9's filter, keystones, upgrades and a core chooser. It imports `src/`, so B1's lean cut may need a one-line touch.

What the sim can't see (the rates that stand in for geometry, as env dials):
- Wake's skim rate per body: packs `Q` 0.6, bosses `QB` 1.0. BUILD-era guess was 0.4; both are shown.
- Ram's slams a shove `S` 0.4, half of them body slams.
- Backhand's whiff share 0.15.
- Tells in reach: 0.35/s on packs, 0.27/s on a boss.
- No damage taken.

Cells are kill-speed, `+%` = faster. "Own" means against that core's four whites; "today" means against today's hand + eye with four whites.

## The short answer

**At BUILD.md's numbers, a build is worth nothing on packs:**
- Wake's c3 is -2% deep and -22% boss against its own whites. Ram's c3 is -2% deep and +1% boss.
- Each core's own arms spender is worse than the white it replaces: Backhand -11%, Piston -16% deep.
- Wake's never-melt floor falls to 2-4%. The target is 20%.

There are three causes, all numeric:
1. **Scrap Cleaver is the best spender for both cores.** It is a white starter part, weight-buffed to a 180° cone, and it spends at the core's full K. Every run starts half-built, and there is nothing to hunt in arms.
2. **The reshapes are weaker than the whites they replace.** Backhand is 16 / 120° / whiffs. Frost Flare is 10 against the Lens's 26. Skate is 10.
3. **K is a boss dial, not a pack dial.** Wake K 6 → 20 moves deep packs by only 8%, because pack bodies die before their marks are cashed. Pack value comes from the spenders' own numbers.

The fix stays inside BUILD.md's frame. It is mostly numbers, plus a few small rule changes, each marked **new** in §1: `Fit.k`, Wake's skim on an unmovable body, a Piston variant under Ram, Domino's hit, Catch's trigger and spend, and `UPGRADE_FROM`. The results:
- Each core alone at rank I: -8% / -10% deep against today.
- Building wins that back: full build +22% (Wake) and +22% (Ram) deep against today.
- Melting and building stay peers on packs.
- The whole build at III lands within 10 points of today's all-III player.

## 1. Numbers to ship (for `src/cores.ts` at B2/B3)

| what | BUILD.md | ship | sim result behind it |
|---|---|---|---|
| `CORES.wake.K` | 6 | **6** | K 6/12/20 → Wake whites -13/-9/-5% deep against today: barely moves packs |
| `CORES.wake.damage` (a skim) | 4 | **6** | the floor (§3): Wake's never-melt goes 4% → 11% (whites), 18% (building) |
| **new:** a skim on a body that can't be moved (§2.6's immovable test) | x`BOSS_AUTO_MUL`, once per 1 s | **full damage, once per 0.5 s** (`bossSkim: { mul: 1, perBodyS: 0.5 }`) | Wake boss whites -25% → -8% against today (QB 1); -21% at QB 0.4 |
| `CORES.ram.K` | 8 | **8** | K 6/8/10: Piston c3 boss +20/+24/+28%, packs ±2; 8 holds |
| `CORES.ram.damage` (a shove) | 6 | **8** | Ram's never-melt 13% → 18% (building); K-M13's "takes 6" becomes 8 |
| **new** `Fit.k?` (a spender's own flat per mark; default `CORES[core].K`; the card shows `+${k} each`) | none | Scrap Cleaver `{ wake: 3, ram: 4 }` (the bridge spends at half), Backhand 10, Piston 12 | the bridge at full K is why own spenders lose (cause 1). At half, Backhand +1% deep / +12% boss over Cleaver, Piston -9% / +25% |
| Backhand (`frayed-cleaver` under Wake) | dmg 16, cone 120, cd 2600 | **dmg 18, cone 150, cd 2400, k 10**; range, behind rule kept | alone: -11% → +1% deep, +12% boss. Whiff share decides it: 5% / 15% / 30% → +10 / +4 / -2% deep |
| Skate (`frost-trail` under Wake) | dmg 10, cd 7000 | **dmg 12, cd 5500**; radius, range, travel, shove kept | alone over Kickstart: +3% → +7% deep |
| Frost Flare (`signal-flare` under Wake) | dmg 10 | **dmg 14**; marks 2, slow 0.5 / 2 s, cd 5000 kept | over the Lens: +5% deep, -10% boss (the Lens is the boss head part: a real choice) |
| Piston under Ram (**new numbers-only VARIANT**: name, line, icon unchanged) | cd 3000, +8 | **cd 2600, k 12** | Ram's boss spender: alone -9% deep / +25% boss. Cleaver stays the pack one (+10% / +1% as c3) |
| Flare, Backdraft, Kickstart, Brace, Spring Heels, Ward | today's | **unchanged** | Flare +10% deep alone. Backdraft ±2 (its pull is geometry). The guard and the vault have no offence: -10 to -28%, by design |
| `wake-burst` | at cap: round(0.6 × n × K), a core hit | **share 1.0** (18 at 3); trigger and core-hit (x0.5 boss) kept | +6% deep / -5% boss over c3 (BUILD's 0.6: +2 / -4: the ~0 of R5) |
| `wake-deep` | cap 5, life 4 | **unchanged** | +1% deep / +8% boss (QB 1); +2 / +8 at QB 0.4 |
| `ram-domino` | links 2, shove 1.0 | **new: each body a chain slams takes the core's hit (8)** (`hit: 8`) | +6% deep / -1% boss (pack build: +7 / 0). BUILD's: +4 / -1 |
| `ram-catch` | any tell in reach → a shove | **new: only a body that can't be moved** (immovable test); the caught body is slammed (`still`) and **its marks spent by the core at +K each**; `icdS` 1.0 kept | 0% deep / +10% boss (pack build: +2 / +13). BUILD's Catch is +7% deep / +2% boss: a pack keystone that beats Domino |
| `ram-wide` | 2 bodies | **unchanged** | +13% deep / -1% boss: the strongest piece in the trial, and it lands late (below) |
| `ram-rubble` | radius 1.2, dmg 4, 1 mark | **unchanged** | +5% deep / -1% boss; radius 1.5 or damage 8 move it by under 2 points |
| `wake-spray` | reach 1.5, 1 mark | **unchanged** | +4% deep / +1% boss |
| `wake-slip` | 0.25 / 1 / x1.15 | **unchanged** | +1-3% (modelled as skims x1.1: geometry, his feel) |
| **new** `UPGRADE_FROM` (the depth an upgrade is first offered) | none | **7** (after the second boss) | without it, both upgrades are taken by d4 in 100% of runs (median melt past III: d3-4). With it: both at d7 in 99% |
| `FILTER.share` | 0.45 | **0.5** (BUILD's own fail dial) | committed formed d3: Wake 67% → 70%, Ram 78% → 80% |
| `FILTER.keyWeight`, `sources` | 1, elite / Plenty / boss-blue | **unchanged** | keystone seen by d6 89-90%, taken/seen 70-71% |
| `TEMPER_FLAT` | 1 / 1.15 / 1.3, 0.92 / 0.85 | **unchanged** | peers on packs with the keystone (§2) |

## 2. The checks you asked for, at the ship numbers (BUILD.md's in brackets)

| line | Wake | Ram | pass |
|---|---|---|---|
| core alone (whites, rank I) against today, deep / boss | -8% / -8% (-13 / -25) | -10% / +1% (-14 / +7) | yes: PITCHES' "6-31% slower" |
| c3 at I against own whites, deep / boss | +14 / +7 (-2 / -22) | pack c3 (Cleaver): +10 / +1. Boss c3 (Piston): +2 / +25 (-2 / +1) | Wake yes. Ram's pack c3 is low; Domino and Wide carry it |
| c3 + keystone, its fight | Burst +20 deep, Deep +15 boss | Domino +17 deep (pack c3), Catch +35 boss | yes: the keystone band is +6-12 |
| keystones split packs / bosses | Burst +6 / -5, Deep +1 / +8 | Domino +7 / 0, Catch +2 / +13 | yes (BUILD's Catch is the wrong way round) |
| builds win it back: c3 + keystone against today, deep | +10% | +4% (pack build) | yes |
| full build (c3 + keystone + 2 upgrades) at I, against today | +22% deep | +22% deep (pack), +26% boss (boss build) | yes |
| building and melting are peers: all four III flat vs c3 + keystone, within 10 points | packs 25 vs 20: yes. Bosses 32 vs 15: **no** | packs 24 vs 17: yes. Bosses 31 vs 35: yes | flat temper holds, except Wake on a boss: Wake fears bosses |
| doing both: full build at III, flat, against today's all-III (+49% deep / +65% boss) | +43% deep | +46% deep (pack), +55% boss (boss) | yes, within 10 points |
| Wake not >= 20% faster than Ram on packs (c3) | 6.8 s | 7.3 s | yes (Wake 6% faster) |
| never-melt finish (target ~1 in 5; §3) | 11% whites / 18% building (2-4%) | 13% / 18% (13 / 15) | building yes; a never-builder no (that's DESIGN.md's "rises with synergies") |

## 3. The never-melt floor (`r3f`)

The model is lean-sim's finish model: CURVE9 Broke, HP lost ~ kill time^0.8. Today's never-melt is scaled to finish 20%. He hesitates 3.7 s and stays at rank I. "Building" means c1 at d3, c2 at d4-6 and c3 at d7-9.

| | BUILD numbers | ship, QB 1 | ship, QB 0.4 | ship, HP lost x1.1 (no planted brace) |
|---|---|---|---|---|
| Wake, whites throughout | 4% | 11% | 6% | 5% |
| Wake, building | 2% | 18% | 10% | 10% |
| Ram, whites throughout | 13% | 13% | 14% | 7% |
| Ram, building | 15% | 18% | 18% | 10% |

- The floor sits on a steep part of the curve: +10% kill time halves it. "Cores weaker than today" and "never-melt ~1 in 5" can't both hold for a player who never builds.
- The ship numbers keep it for a player who builds, which is DESIGN.md's rule: the floor rises when synergies land.
- The planted brace going with the eye (§9.5) costs about half the floor. That is the one number here I can't bound. If his d1-3 `hpLost` comes in over 130 x 1.25, the dial is pack HP d1-2 (§5.3), not the cores.
- Wake's floor hangs on QB, its boss skim rate. Log it (§5).

## 4. What's numerically wrong in BUILD.md

1. **§5.1: Scrap Cleaver at full K for both cores** (above). Fix: `Fit.k`. That changes K-M4, K-M9 and K-M26's expected numbers: Cleaver on 3 marks is 22 + 3 × 3 = 31 under Wake, not 40.
2. **§2.1: the reshapes' numbers** make Wake's build -2%. Use §1's.
3. **R2's scratch table overstates Ram on bosses.** Its "+32% boss" came from abstract cashiers at x0.75 cooldown. The real Piston at 3.0 s and +8 equals Cleaver on a boss: c3 +1%. Ram is the boss core only with Piston's k 12 / 2.6 s.
4. **§5.3 "Ram's slams land >= 0.4, else the chain is under +15%" is not what the numbers say.**
   - Against Ram's own whites, the pack chain is +14% to +20% at any S from 0.2 to 0.6.
   - S sets Ram's absolute pack speed: pack c3 + Domino against today is -3 / +1 / +5 / +8 / +9% at S 0.2 / 0.3 / 0.4 / 0.5 / 0.6.
   - K 6 → 10 moves that by 2 points at most.
   - **Pass line 0.3** (Ram's pack build about today's whites), counted on **beat shoves only**: Piston's knock slams about 1.5x as often and would mix the loadout into the geometry. 0.4 is a good result, not the floor.
   - Reachable? Headless can't tell me. K-M23's Ram bot reports it at B3: read it there before B6.
5. **§2.7 Catch** fires on every tell and pays in slams. That makes it a pack keystone (+7% deep, +2% boss) that beats Domino. Fix: restrict it and make it spend (§1).
6. **§1.5 upgrades as "the d7-9 want"**: melts come at about 16 a run, so a part reaches III by d3. Both upgrades land by d4. Fix: `UPGRADE_FROM` 7.
7. **B5 "random picker <= 25%" can't pass for Ram at any share.**
   - It is 28% with no filter at all, because 5 of Ram's 6 parts are in `STARTER_POOL`, and 2 of them (Cleaver, Kickstart) are whites from `STARTING`. Wake is 29% at share 0.5.
   - Replace it with **random <= 0.6 x committed** (Wake 29 / 70, Ram 44 / 80: pass), or count only own-spender formation (Wake 16 / 46, Ram 32 / 71).
8. **B5 "keystone taken <= 75% when seen"** measures the chooser, not the player: an empty socket always takes. In his log, use "a keystone left on the floor" instead.
9. **§2.7 / K-M10 Burst**: "11 at 3" → 18. K-M10's third skim on a wall → 6 + 18 = 24. K-M18's Catch cases change: a crowned hulk winding up no longer triggers Catch; a boss windup does, and spends.
10. **"A late want" passes in the sim for the wrong reason**: 75% of runs take a part after d6 through dropsim's whim (0.08), not by design. The design's late want is the upgrade gate.

## 5. Open, for B2-B6 logs (one field each where one is missing)

| rate | stands in for | sim guess | swings | log |
|---|---|---|---|---|
| Wake's skims per second on a boss | QB | 1.0 (0.4 shown) | Wake's floor 10 ↔ 18%; Deep's worth | `skims` on boss depths / boss `fightS` |
| Wake's skims per body per second, packs | Q | 0.6 | every Wake number | `skims.n / (awake bodies × fightS)` (needs awake body-seconds) |
| Ram's slams per beat shove, packs | S | 0.4 | Ram's pack speed ±4 points per 0.1 | `shoves` split by `why` (add `beat` / `part` counts) |
| Backhand whiffs (cast, nothing behind) | 0.15 | | Backhand +10 ↔ -2% | new: `whiffs` per slot |
| tells starting in reach of Ram, boss | 0.27/s | | Catch's worth | `shoves.caught` / boss `fightS` |
| planted brace's share of today's HP saved | x1.0-1.1 | | half the floor | today's runs, before B4: `hpLost` while `inStance` |
