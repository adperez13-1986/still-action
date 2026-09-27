# Brief: the two leanings, close and marksman

For the design agents. **A design round that ends in something we build.** Two rounds, then a
synthesis; the lead implements what the four voices agree on. Built for fun, premium, buy-once,
no stat-block affixes, "different, not stronger".

## The owner's decisions (27-28 Sep)
- **Builds are where the two earlier Still games failed "mightily".** The record and nine rules
  are in `design/builds/LESSONS.md`. Read it first; it is the frame for this round.
- **Two leanings first, fully built, before any others: close and marksman.** Caster and keeper
  wait. (Still shipped four heat playstyles with one supported.)
- **The hand and the eye are the auto now** (permanent since 27 Sep): up close the hand strikes
  (10 dmg on the 0.62 s beat, breaks a breakable windup, shoves 0.5 u; no strike while backing
  away); planted 0.3 s the eye fires (the old shot's look and 5 dmg, pierces, shoves 0.6 u, aims
  at leaders then shooters, reaches 11 u) and every blow taken is halved; walking at range, no
  auto at all. `src/combat.ts` (HAND, EYE, handTarget, retreating, lance, hurtPlayer).
- **Pedestals are being built now** (replay step 2, branch `pedestals`): three parts beside each
  crawl exit, at the Assembler (+ a second pick for +4 strain) and at Plenty; empty slots fill
  only from pedestals. Step 3 of the replay plan is "leaning tags, and one pedestal in three
  matches a leaning you wear". That step is this round, reshaped by LESSONS.md.
- The run is heading to 9 depths with both roads (the Works and the Line) and open fields at the
  first depth of each area, ~20-25 min. Don't design for a specific depth count.

## What his runs say (27 Sep, both on, latest build; `playtest.json`, 19 runs)
Strikes ~190 a run against ~95 eye shots; the Arbiter is almost all hand (60 strikes, 5 eye);
the eye mostly means the Assembler. About 1 strike in 5 breaks a windup. Blows taken planted:
3-6 a run (the brace rarely matters). Pushes 13-14 a run (was 2-5): with no far auto, parts
carry range. His words: the hand "felt like kiting but shorter range" until pass 2; the eye's
big lance "looks strong but in reality it is weak" (reverted to the old shot).
So today close is the natural pole and marksman is thin: the round must make planting worth it.

## Read first
In `/Users/adrianperez/repos/personal/still-action`: `design/builds/LESSONS.md`, `HANDOVER.md`,
`DESIGN.md`, `design/CATALOG.md` (the 30 parts, their slots and "gives up"), `design/variety/PITCHES.md`
(the hand, the eye, item 5 "archetypes as tags, not bonuses"), `design/replay/PITCHES.md`,
`design/strain/PITCHES.md`. Code where it helps: `src/abilities.ts` (part defs), `src/parts.ts`,
`src/combat.ts`, `src/drops.ts`, `src/pool.ts`, `tools/dropsim.ts`.

Note a tension to settle: variety item 5 said tags, **no set bonuses** (they switch on by accident
in 81% of random loadouts). LESSONS rule 2 says payoffs must be **triggered by the enemy**. A
likely answer is payoffs that live on individual parts and react to hand/eye events, not bonuses
for wearing N tagged parts. Argue it.

## What to pitch
1. **What a leaning is, mechanically.** Tags on the 30 parts (which are close, which marksman,
   which neutral, per slot)? Payoff parts? Does the hand or eye itself change with what you wear?
   How is it shown (card, wall, compare screen, never the HUD?).
2. **The kit per leaning, per slot.** For each of close and marksman: offence, defence, mobility
   and payoff, across head/torso/arms/legs, so neither has a dead slot (rule 5). Say which existing
   parts cover it as they are, which get reworked (name the change), and which new parts are
   needed (card line, numbers, what it gives up). Keep new parts to the fewest that close gaps.
3. **Payoffs, enemy-triggered (rule 2).** Concrete: what triggers, what it gives, numbers. No
   multipliers between parts (rule 3). No sustain that lets offence pay for defence (rule 7).
4. **Making marksman real.** Planting must be worth what it costs. What changes, with numbers?
5. **The pedestal match.** How "one pedestal in three matches a leaning you wear" works with two
   leanings and neutral parts; what happens with nothing worn yet.
6. **Guardrails as checks:** what the drop simulator and playtest log must measure (take rates
   per part and slot, always-takes, formation of a committed loadout), and the pass/fail lines.
7. **Scope.** The smallest build that ships both leanings complete, as one combat change on trial.

Write 80-120 lines to `design/leanings/1-<your role>.md`. End with your **recommended leaning
design in 8-12 bullets**. Don't edit code or any other file.
