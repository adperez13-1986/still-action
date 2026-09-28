# Round 2: the balancer

28 Sep 2026. New numbers come from the same scratch sim (calibration B, depth 5).

## Positions

| Question | Verdict | Why |
|---|---|---|
| Hauled vs clumped | **Hauled** (changed) | It's set by the pull, so there's no distance test and he can see it. It's what my sim already modelled. |
| Clumped gets no multiplier | **Agree** (changed; I had Vent x1.5) | An area part already hits more bodies in a clump, so a multiplier would pay twice. The payoff is reach: it hits every hauled body. No "hits harder". |
| A state set from the payer's own slot pays nothing | **Agree** | It makes "two parts per synergy" something the code checks. A state set by the hand or eye pays any slot: that's the mastery-into-pair route. |
| Hauling Strike, Heavy Shot | **Agree, if marked pays only payers** | Marking Shot stays, and with every part paying it's still the strongest thing in the game (+29% on a boss). Heavy Shot needs the verifier's arm, or a planted shot into a corner keeps the enemy slammed forever. Hauling Strike is rank III value on one area payer, right for something a III melt teaches. |
| x2 vs x1.5 | **x2, used up** | Payers catch a state 0.2-0.9 times a fight, so using it up costs little. On a heavy: used-up x2 +9%, lasting x2 +10%, lasting x1.5 +6%. On packs all three are 0%. Same value, and only the used-up one makes a bang. |
| The x3.2 ceiling (Patient III, pushed, marked: 102) | **Accept** | It costs two parts, a III melt and 2 strain, once every 5 s at best. It one-shots a heavy (the fantasy CURVE wants) and does 9% of the Arbiter. |
| Swap: II, the translator's "full reset or II", Claude's full reset | **Lands at II; the old part is used up** | The full reset isn't real: the dropped old part can be melted into the new one, so a swap already ends at II. A true full reset (+6-10%) loses from rank II up. `ceil(rank/2)` with the drop kept goes III → II → III, a free swap. |

## Making pairs pay on packs

A pair adds 0-6% on packs, for three reasons: overkill on 24-36 HP bodies, setter cooldowns longer than a ~4 s fight, and payers that hit one body. A bigger multiplier can't help; x2 is the cap and the extra is wasted. What works is moving damage across bodies:

| Pack payoff | Pack | Heavy |
|---|---|---|
| Used-up x2 only | 0% | +9% |
| **Shatter: a paid kill passes its excess to the nearest body within 3 u** | **+15%** | +9% |
| Shatter, but only to bodies in the same state | +7% | +9% |
| Hauled reach (area payer) | +6% | 0% |

Shatter isn't a multiplier and never pays twice, so rule 3 holds. On packs it's worth about Cleaver II→III (+15% vs +18%). Pairs then win on packs, and ranks win on heavies and bosses: each choice has a place.

Two supports:
- **Pairs are openers.** Setters are up when a pack wakes, so the combo is setter then payer. Don't lengthen setter cooldowns.
- **The push is the pack lever.** Pushing into the state with shatter gives +15-24%, and the two-pair player pays strain for it (Stopped).
