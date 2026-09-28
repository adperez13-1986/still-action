# Round 2: Claude

## What changed my mind

- **The balancer's core finding decides the shape.** A part-set state lands about once a ~4 s fight
  (setters cool 5-8 s), so a pair of parts is worth ~0 on packs and ~one rank on a heavy. A state set by
  a mastery is on every auto hit, so one payer reaches rank III. **So the autos are the main setters and
  the parts pay.** Part setters stay (Chill Vent, Signal Flare, Piston), but the system lives on mastery.
  That also answers the leanings question: a lean is which states your auto sets (the translator's point).
  I had the parts as both halves; changed.
- **Marking Strike is the strongest thing in the system** (+32% heavy, +29% boss, every part pays it).
  Narrow the mark to payer parts (balancer). Changed: I'd left marked as the universal payer.
- **"A swap lands at II" is already true** (the old part drops and can be melted in). Make it the stated
  rule and automatic, with "take: Piston II" on the card (balancer). I'd said keep the full reset; changed.
- **Clumped: no multiplier.** Its payoff is reaching every body (verifier, balancer). The translator's
  **"hauled"** is the better word and the better read (pulled by you, in the last 2 s). Taken.
- **A state from the payer's own slot pays nothing** (verifier). Taken; it's what makes a pair two parts.
- **Bosses take states for payers** (balancer), never the slow or the shove. Otherwise synergy is 0 where
  5 of his 7 Broke runs ended.

## Where I disagree

- **Translator, swapping Marking Strike and Cold Shot out.** Keep all six masteries and add the two new
  ones (Hauling Strike, Heavy Shot) to the pool: eight, still max 6 a run. Removing the strongest setter
  and the only marksman chill narrows builds. Its power problem is solved by narrowing the mark.
- **Verifier, Cold Strike breaks rule 7.** True, and the fix is right in spirit: an auto-set chill is the
  **state only** (the rime, payable), no slow. A part's chill (Chill Vent, Frost Trail) slows and chills.
  That keeps the free auto doing offence only.
- **Payoff size.** x2 for a consumed state (marked, slammed), x1.5 for a lasting one (chilled). One number
  per rule, easy to read: "lands twice" / "hits harder".

## First build step (one playable trial)

1. `src/states.ts` + `stateMul` + `hitPart(…, payer)` (verifier's plumbing); `sets` / `pays` on defs.
2. Marked narrowed to payers; Signal Flare 4 -> 12.
3. Chilled pays: Scrap Cleaver, Focusing Lens (and Cracked Lens) x1.5; mastery chill is state-only.
4. Bosses take chilled and marked for payers.
5. Swap lands at II automatically.
6. Card: "pairs with X" on the floor card; the shatter and one pay sound. Rim glyphs wait for step 2.
7. Log `states`, `stateBonus`, `paidBy` (0 for autos), `swaps`. Statecheck.

Slammed and hauled are step 2, after his runs.
