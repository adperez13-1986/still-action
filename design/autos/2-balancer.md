# Autos, round 2: balancer

`node design/autos/autos-sim2.mjs`: a Monte Carlo pack fight (3 hulks, 1 sentinel) on the real numbers. It is calibrated to his two logged runs: today's auto share comes out 64% / 31% against a logged 64% / 34%. Finish rates use CURVE9 with HP lost ∝ kill time^0.8. "Presses" means the never-melt player pressing sooner; his log shows ≤28 per fight-minute against a white cap of 54.

Cells: never-melt / investor.

| option | pack × (HP ×1.3) | boss × | auto dmg on bodies no part hit in 3 s | kills a part started | strikes that can break | finish, never-melt / median / investor |
|---|---|---|---|---|---|---|
| today | 1 / 1 | 1 / 1 | 76 / 84% | 70 / 90% | 100% | 31 / 74 / 91 |
| D3 bank | 1.32 / 1.09 | 1.11 / 1.02 | 49 / 63% | 93 / 97% | 49 / 55% | 14 / 62 / 89 |
| bank, 42 presses/min | 0.94 / 1.08 | 0.80 / 1.03 | 38 / 62% | 97 / 97% | 62 / 54% | 46 / 77 / 89 |
| claim 3 s | 1.52 / 1.16 | 1.15 / 1.03 | 0 / 0% | 100 / 100% | 33 / **4%** | 8 / 55 / 87 |
| claim, 46/min | 0.91 / **1.15** | 0.75 / 1.03 | 0 / 0% | 100 / 100% | 50 / 4% | 51 / 77 / 87 |
| package (translator) | 1.36 / 1.09 | 1.25 / 1.09 | 62 / 75% | 90 / 98% | 0% | 10 / 57 / 87 |
| package + arms 1.4 s, 45/min | 0.94 / 0.97 | 0.84 / 0.96 | 42 / 73% | 98 / 99% | 0% | 43 / 79 / 92 |

**Correction to round 1:** the bank costs the never-melt player ×1.32-1.44, not ×1.17. Fights last 5-7 s and the bank starts each one empty.

**What holds across all three options:**
- Every earned rule costs the never-melt player 30-50%.
- Only pressing buys it back: 42-46 presses a minute matches today.
- Cooldowns can't buy it back. His pace is hesitation, not cooldowns: claim with cooldowns ×0.3 is still ×1.06-1.15. Claude's ×0.75 compensation won't show much.
- Part damage can't either. With parts at ×10 the pack still takes ×1.1, because an earned auto waits for the first press.

**Does it matter that bank beats hit bodies he never chose?** In damage, yes: 38-49% of auto damage, against 76% today. In kills, barely: a part started 93-97% of them, against claim's 100%. A 3-4 point gap in who killed what is below what he can feel.

Zeroing that damage costs the claim the investor's endgame:
- **His autos fall to 13% of his damage.** His parts kill what they touch, so a claimed body is usually already dead.
- **His breaks fall to 4%.**
- **He can't press his way back from ×1.15.** He is already at 51 a minute.

**The translator's package with arms at 1.4 s** is as cheap as the bank. It is the only option that removes the planted-shot turret he named. But 0% breaks is a defence cut the finish model doesn't count, so its row is optimistic.

**Disagreements:**
- **Verifier:** right on attribution, but the numbers say kills, not damage, carry it. The claim costs the most (46 presses a minute, investor ×1.15).
- **Translator:** the package is sound. I'd trial it second, because of the unsized break cut.

**To the phone: D3 bank.**
- It is one switch with no content work.
- It keeps the masteries, the riders and about half the breaks.
- It needs the lowest press rate.
- **Pass:** ≥40 presses a fight-minute, and hpLost at depths 1-3 within 20% of baseline.

If he still names the planted shot, run the package + arms 1.4 s next. His reaction to the turret separates the two; the kill numbers don't.
