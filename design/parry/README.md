# Parry Clamp: does it earn its slot? (29 Sep, balancer)

Why: B1 built LINE-RULES R3 (Parry catches a pressure body's own tell). K-W3d then FAILED its dead rule at depth 1
(0.03 catches/fight, autos on). The balancer measured real packs (`__genLook`, 128 per depth) at d2/4/5 and d8 (9-depth
table), counters + autos on, bot walks in and never dodges, on a snapshot of the B1+B2 tree. Script + raw output here
(`parry-depths.mjs`, run with `LIB=<snapshot>/tools/checks/lib.mjs`; `run-snap.txt`, `run-combo.txt`).

Shipped Parry vs Scrap Cleaver (catches / windup breaks / HP lost / clear time per fight):

| d | taps when ready | 250 ms reaction, grace 0 | perfect timing | (Piston) |
|---|---|---|---|---|
| 2 | 0.04 / 0.06 / +11% / +8% | 0.06 / 0.50 / +10% / +15% | 1.06 / 0.13 / -14% / -1% | -9% / -3% |
| 4 | 0.13 / 0.09 / +38% / +25% | 0.20 / 0.94 / +42% / +36% | 1.20 / 0.27 / +19% / +21% | +15% / +12% |
| 5 | 0.37 / 0.17 / +21% / +23% | 0.44 / 1.52 / +45% / +38% | 1.83 / 0.55 / +24% / +24% | +21% / +12% |
| 8 | 0.39 / 0.36 / +32% / +29% | 0.60 / 1.73 / +41% / +42% | 1.70 / 0.87 / +23% / +26% | +18% / +16% |

Verdict: dead slot from d4 under every bot, even perfect timing. With grace 0 a 250 ms thumb catches almost nothing (the
tells end first). The Cleaver also beats Piston from d4: the arms slot has a Cleaver problem too.

Dials (250 ms reaction, grace 150; HP / clear vs Cleaver at d4 / d5 / d8):

| option | HP | clear | note |
|---|---|---|---|
| grace 150 only | +35 / +23 / +25% | +23 / +22 / +26% | |
| A: cooldown 3600 -> 2200 | +18 / +17 / +5% | +16 / +14 / +10% | pays tapping as much as timing |
| B: a catch readies Parry (cap 1 per 1.5 s) | 0 / -2 / -10% | +6 / +4 / +3% | helps timing, barely helps tapping |
| C: a caught body waits 1 s longer | +25 / +15 / +18% | +24 / +20 / +23% | |
| B + C | -9 / -7 / -17% | +5 / +2 / +4% | about B |

Catches/fight with grace 150: 1.4-2.5. Balancer's recommendation (his call): **B with grace 150**. Caveats: riders were cut
28 Sep over a similar free ready (this fires 1.1-1.8 times a fight); B is very strong at d2 (-37% HP); no option makes Parry
the defensive part the target described, B makes it about Cleaver-equal for a timing player.
