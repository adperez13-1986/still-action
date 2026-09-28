# Round 1: the verifier (can each rule be checked, and did the record justify it)

28 Sep. Read against `main` (b596d07), `playtest.json` (33 runs), leancheck, dropsim, and the old repos' sources.

## The record, re-read at the source

- **Rule 7 is stricter than its source.** still-merge's principle 3 reads "Keep them separate, **or tie the link
  to an enemy-gated trigger** (Counter-Aegis)" (round-loop-v1/HANDOVER.md L63-66). LESSONS dropped the "or".
  Wildfire's lifesteal was cut to 0.15, not removed, and it "works". Still fixed its dominant build with a
  Counter archetype that turns blocked damage into offence (sim win rate 24% -> 96%).
- **Rule 3's failure was unbounded stacking.** The x9 is "Spark x Cascade x Junior" with no limit on how many
  relics stack. still-merge fixed it with **exclusivity tags** and a conditional, self-balancing Stillness, not
  "no multipliers" (its keystones still use x1.5). Here, four buttons cap any chain.
- **Rule 6's 78% was a run-sim bot's, not a player's**; the cause named is "pool too thin (13 actions)", fixed by
  content (13 -> 25). **Rule 5's** dead slots were weak base actions in a deckbuilder (draw, small block).
- **Missing lesson:** still-merge found its late game eased because "damage AND defense outpace the FIXED enemy
  curve". The lever was the enemy curve, not the relics. That's his observation 1, and LESSONS has no rule for it.

## How rules 2, 3 and 7 produced riders that compete with the push

1. Rule 2 needed an enemy event. The code had only `onHand(e, broke)`, so the eye break mirrored it, and
   Patient's planted clock was cut as "Still-caused" (round 2).
2. Rule 3 cut Signal Flare's break-mark as "a hidden x2" (round 2). Refunds won because they "add casts, never
   multiply" (balancer).
3. Rule 7 plus "no +X%" ruled out heal and damage windows (`leancheck`: `keys === 'act,icdMs,on'`). "One part =
   one ability" ruled out a second ability.
4. That left only the button's own clock. The translator raised the cut to a full ready "for legibility". A full
   ready is what a push sells (fire a cooling part now), minus the +2.
5. The record saw it coming: "riders ready buttons that would have been pushed" (verifier L5); "refunds must not
   starve the push" (balancer). The pass line settled on was L4 "pushes within 25% of today". But today is 0.49
   pushes a fight (108 over 220 fights, 16 hand runs), under the one push a quiet refunds. So L4 protects a
   baseline that is already failing. Stopped: 1 of 33 runs, and that was before the hand.
6. **Patient Lens is the proof in one card.** Its line is "Push it for a full shot." Its rider is "Eye break:
   ready, and fully charged." The rider gives away the part's own push. It's the only rider that fired in the
   log: 10 fires in the one full leanings run (19 fights, 10 pushes).

## The nine rules

| # | Transfers here? | Verdict | Checkable today | Evidence |
|---|---|---|---|---|
| 1 Two leanings first | yes (scope) | **keep** | static: leancheck slot x lean | passes; close/marksman each fill all 4 slots |
| 2 Enemy-triggered payoffs | half: the failure was payoffs scaling with your own state | **rewrite** | leancheck only checks `on` is hand/eye | needed a boss patch; ties every payoff to breakable windups, which locks enemies into obs 2's one shape |
| 3 No multipliers between parts | no: 4 buttons, no unbounded stack | **rewrite** | none; Signal Flare already doubles the next part's hit (`hitPart`, x2) | killed Signal Flare's rider; pushed payoffs onto the clock |
| 4 Every part has an opinion | partly | **rewrite** | no: dropsim values parts by tag (2/1/0), so it can't measure opinion | Hades/DMD run on generic-good picks; "a generic-good part is a failed part" is the slogan half |
| 5 No dead slot | yes, in a milder form | **keep** | log: presses and takes per slot | presses head 44%, legs 20%, torso 18%, arms 18% (1,062, last 16 runs): none dead |
| 6 No always-take | yes as a flag, not a trigger | **rewrite** | log L2, not the sim (tag-driven bot) | fires now and nobody acted: Anvil 7/7, Mirror Ward 9/12. Anvil is a boss gift |
| 7 One number, not offence and defence | no, as written | **rewrite** | nothing (no HP-flow field in the log) | the sustain is the world's: a quiet returns half of missing HP, full HP each depth, crates +20. His always-take (Anvil) is a counter part |
| 8 Committing beats mixing | yes | **keep, as a feel question** | no: at his volume (4-6 runs) the log can't separate committed from mixed | the sim's 98% "formed" is circular: the bot is programmed to commit |
| 9 Something left to want | yes | **keep** | the dropsim S5 check was agreed but isn't built | 26 offers a run, 30 parts |

**New wording:**
- **2.** No payoff scales with what you wear. A payoff pays for something done in the fight. Enemy states come
  first (a break, an opening, a kill in a window, a dodge through a strike), and every trigger must be reachable
  against every enemy kind and both bosses. *Check:* a headless count of trigger chances for each kind.
- **3.** At most one multiplier applies to a hit, and it comes from an enemy state (open, marked, broken), never
  from Still's loadout. *Check:* one damage-multiplier function that takes the largest, plus a unit test.
- **4.** Every part changes what you do (a verb, a stance, a timing), not only how much. It's never dead. Strong
  picks are allowed.
- **6.** A part taken >= 70% of >= 6 offers (gifts and golds excluded) gets read first: is it the maths or the
  clarity (still-merge's own question)? Rework only if runs with it play the same.
- **7.** Sustain is budgeted per fight, from the world and parts together. A part may turn defence into offence
  only through an enemy action (Anvil's catch, a parry), never passively. *Check:* `hpLost`/`hpHealed` per depth.

## Missing rules (each with its check)

- **M1 Demand:** pushes are asked for. At depths 3-6, pushes a fight >= 1.0 (today 0.49). Median strain at the
  Arbiter >= 8 (today 3). Stopped reachable by a spender.
- **M2 Payoffs never pay in the push's currency.** A rider can't hand out "fire now" or "fully charged". It can
  change what a push does. *Static:* leancheck fails `act: 'ready' | 'charge'`.
- **M3 A curve inside the run:** HP lost a fight rises by depth. The log doesn't record HP lost today; add it.
- **M4 Enemies combine:** from depth 2, each level has a pack where one kind changes another's answer. Packs are
  mixed already (census: 67-97% at depths 2-5), but only additively.

## Hard constraints: flags only, his to decide

- **"No +X% anything" / "tiers different, never stronger"**: sound against stat blocks. Stacked with rules 3 and
  7, they leave the cooldown as the only payoff currency.
- **"Runs get wider, not stronger"** is a persistence rule in DESIGN (across runs). It's being read as no power
  growth inside a run too. Worth asking him which he meant.
- **"Never more enemy HP or damage"** (DESIGN, crawl, "Depth"), plus the quiet's half heal, gives a flat curve.
  That's the likeliest root of observation 1.
- **"No part lowers strain"** closes the most direct rider that would feed the push.
- Telegraphs, symmetry, colour, premium: not hindering. "Telegraphed and committed" doesn't require the one
  four-phase enemy machine.

## Three changes, smallest first

1. **Obs 3 (1 line, then ~20).** Remove Patient Lens's rider. Add leancheck M2. Then change the other three riders
   to `act: 'prime'`: a trigger primes the button for 4 s, and a push of a primed button restarts half its
   cooldown (0.5 is a guess). Strain is still +2. *Pass:* pushes a fight with riders >= without them.
2. **Obs 1 (~10 lines, then one dial of his).** Log `hpLost` and `hpHealed` per depth. Then trial the quiet at
   1/4 of missing HP instead of 1/2 (`quiet()` in main.ts, `(100 - combat.hp) / 2`; 1/4 is a guess). *Pass:*
   M1, and Broke still mostly at the Assembler.
3. **Obs 2 (~1.5 evenings, already pitched).** The mender (variety item 9): its cable is cut by walking through,
   not a windup; under the new rule 2, cutting it is a trigger. *Check:* a mender in >= 50% of depth 4-5 levels.
