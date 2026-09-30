# Stage C results (C10, the whole stage, headless)

Run on 03fb8c1 plus C10's `tools/checks/stagec.mjs` (K-N9, K-N16, K-N23 added; K-N15 made deterministic). No `src/` change. Every number below is as the checks printed it.

## Suites

| check | result | one line |
|---|---|---|
| K-90, K-90L (`baseline.mjs compare`) | PASS | unchanged |
| K-90F (`fights.mjs compare`) | PASS | unchanged |
| k9.mjs | 18 PASS | K-9D reports dist 5,433,108 |
| area3.mjs | 8 PASS | K-R2, K-R3, K-X1-K-X7 |
| home.mjs | 4 PASS | K-H1-K-H4 |
| stageb.mjs, all 37 ids, K-T13 included | 36 PASS, 1 FAIL | the FAIL is K-W3d, the known one: "Parry catches 0.03 tells per fight, under 0.3" |
| stagec.mjs | 27 PASS (24 + K-N9, K-N16, K-N23) | run three times in a row after the last edit: 27/27 each |
| K-Z1 | PASS | dist 5,433,108 B against the 5,600,000 cap; +51,242 against C0's 5,381,866 (stageb prints +77,934 against ba443ce's 5,355,174) |

## The three new checks

| check | result | one line |
|---|---|---|
| K-N9 (INV sweep) | PASS | 120 s fights, ENG6 (III@6, 1170 HP, dmgMul 1.2) and ENG9 both orders (III@6 1080 HP, dmgMul 1; II@9 1170 HP, dmgMul 1.05), seeds 1 and 2: 518-529 hazards each (train ~500, steam 9-10, shell 6, wagon 3); max damage before dmgMul 20.00; every damage exactly base x dmgMul (train 20, steam 14, shell 12, wagon 12); least armMs slack 163.6 ms (the steam) against 150; steam windup 950 ms, cinder 633 ms (declared windupMs 950 / 620); Still lost 0 (HP put back each tick). Negative-tested: runDamage 20 -> 23 FAILs "over 22"; steam lockMs 700 -> 640 FAILs "slack 103.6 ms, under 150"; lockMs 500 FAILs the 620 windup; cinder windupMs 620 -> 600 FAILs the windup |
| K-N16 (flag off) | PASS | `__flags({engine:false})`: III at 6 is `quarter` with an Arbiter; `true`: `station` with an Engine; II at 6 is `quarter` and an Arbiter either way (seeds 1-3). Negative-tested: bossFor ignoring `engineOnLine` FAILs "offIII: quarter, engine, not the arbiter" |
| K-N23 (the fight, INFO) | PASS | see below; every fight of the brief's bot killed the Engine, longest 181.9 s, under 240 |

## K-N17 (as printed)

| bot | HP lost in 45 s (15 runs each) | note |
|---|---|---|
| camp | 65.0 (ENG6 72.0; ENG9 III@6 60.0; II@9 63.0) | window 50-95 |
| circle | 60.7 (67.2; 56.0; 58.8) | window 40-85, and <= camp |
| dodge | 21.7 (24.0; 20.0; 21.0) | never hit by a cinder or a steam jet |
| camp with the new rules off | 0.0 | before |
| circle with the new rules off | 45.5 | before |

Cinder period at c: phase 1 8.13 s (expected 8.12), phase 2 5.63 s (expected 5.62).

## K-N23 (INFO), bot as the brief describes, ENG9 both orders, seeds 1..5

Same result for every seed of one order (the Engine is seeded), so three numbers, not ten.

| order | kill time | HP lost | pushes | windows seen / thrown | derails | cinders | steams | reversals | wagons | phase 2 at |
|---|---|---|---|---|---|---|---|---|---|---|
| III@6 | 150.0 s | 0 | 0 of 7 casts | 10 / 7 | 12 | 8 | 12 | 7 | 5 | 55.5 s |
| II@9 | 181.9 s | 0 | 0 of 8 casts | 12 / 8 | 15 | 10 | 14 | 8 | 6 | 58.4 s |

Mean over the ten: 165.9 s (150.0-181.9). SPEC 7.5 guessed 85-100 s and about 5 pushes: **the bot is at 1.5-1.8x the kill time, with no pushes.** The bot walks to each window's lever by the board, casts from the lever's quadrant (the arms part), punishes a derail with the autos and its head, torso and arms parts, and dodges as K-N17's dodger; it never took a hit from a train, steam, cinder or wagon. It stood on a lit but unarmed rail for at most 21 ticks at a stretch (its 18-tick reaction plus the step off), never on an armed one.

A second, greedy bot (INFO only: it spends every ready part whenever the Engine is within 6 u, so the arms part is often cooling at the next window): kill 127.2-145.5 s (mean 139.1), 3 pushes a fight (6 strain), 7 windows thrown of 8-10 seen.

## Heard-log counts, one scripted fight (K-N23, III@6, seed 1, to the kill at 150.0 s)

horn 1, engineRun 27, windup 13, scald 12, lobAim 8, mortar 8, whistle 8, pointsChime 10, latch 8, clack 8, ramCrash 12, judder 7, plateDull 5, smash 4. No `aim`, no `rev`.

They match the events: 10 windows, 7 throws by cast (latch 8 = throws + throw-backs, so one was thrown back), 12 derails, 12 jets (windup 13: one aim was dropped by a derail), 8 cinders (lobAim = mortar = whistle), 7 reversals, 5 wagons settled (plateDull 5) and 4 smashed (smash 4). The wagon's three wheel clacks are `window.setTimeout` in real time (main.ts:832), so a sim-speed fight cannot count them; clack 8 is the levers' only.

## Findings

1. K-N15 (C8's check) was flaky, about one run in four: the save's starting hook wears one of four parts by `Math.random`, and when it gave the Scrap Cleaver the check's own `carried.push('scrap-cleaver')` counted it twice ("history[7] is 2, not 1"). Fixed in the check (each part put on and carried once, Kickstart added so two are carried): 30 of 30 pass after, 5 of 25 failed before. Not a game bug.
2. The same random hook made the first K-N23 runs vary from 176 s to over 240 s. K-N9 and K-N23 now wear the game's own four starting parts (`focusing-lens`, `pressure-vent`, `scrap-cleaver`, `kickstart`), and reset `run.strain` and both 2000-entry logs before each fight (a mark taken at the cap goes stale). Results are then identical run to run.
3. The first fight on a page differs a little from the rest for the greedy bot (127.2 s against 145.5 s on III@6): state carried from the checks before it on the same page. The brief's bot is unaffected.
4. Two INFO lines vary between runs and are not checks' concern: K-N3's absolute loop-start times (a few hundredths, the HUD clock is seeded by wall time) and K-N22's husk side (the run seed).

## Not verified

- Anything by hand or on the phone (STAGE-C.md section 5).
- The kill-time gap against SPEC's guess is a bot's number: a player who uses the parts freely in the fight, or who pushes, will be faster. Adrian's phone is the check on whether 150-180 s reads as the fight he wants.
- The wagon's wheel clacks in the heard log (above).
