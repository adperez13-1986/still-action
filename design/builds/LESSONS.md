# Builds: what went wrong before, and the rules for still-action

27 Sep 2026. He asked, before leanings get designed: builds and archetypes are "where we started
struggling mightily in the two earlier Still games." Three searches of the old repos' notes found
the record below (quotes checked against the files). Read this before designing leanings, new parts
or payoffs.

## What the record says

**Still (the deckbuilder)**, `still/openspec/changes/`:
- One dominant build. *"Stat stacking (Strength + Amplify on Arms) is the only viable scaling
  strategy. There's no competing build identity"* (archive/2026-03-23-counter-archetype).
- Generic-good picks. *"10 cycling slot modifiers exist, 9 are generically good. Card picks are
  never meaningful"* (modifier-card-expansion).
- Dead slots. *"Head and Legs are dead slots... Players always Override them, making 2 of 4 slots
  meaningless... Every archetype converges on the same slot usage pattern. This is a systemic
  problem that content additions can't fix"* (head-legs-rework).
- Archetypes that existed on paper only. *"four emergent playstyles... but only Warm Surfer has
  meaningful content support... Players can't discover these builds because the pieces don't exist
  yet"* (archive/2026-03-07-archetype-content). The exhaust build had two defensive payoffs and no
  offence (exhaust-offense-part).
- One pick always taken. *"78% take Phase Blade, 74% take Focus Fire"* (archive/2026-04-11-action-pool-expansion).
- Nothing left to want. *"Players acquire everything by fight 5-6 and coast the rest... every run
  plays the same"* (archive/2026-04-02-growth-tree).

**still-merge**:
- Multipliers stacking into one correct answer. *"Stillness is a ~8× damage multiplier"*; with
  Spark, Cascade and Junior, ×9 (design/balancer-roadmap.md).
- Payoffs that ignore the enemy. *"A keystone's payoff must be gated by something the ENEMY does,
  not just 'bigger board'... Aegis v2 failed because everything it cared about was board-scaled →
  stack the board, win everything, no thinking"* (openspec/changes/round-loop-v1/HANDOVER.md).
- *"One resource must not do both offense AND defense"*; *"Sustain/payoff tuned too high →
  mindless"* (same file; Wildfire's lifesteal cut from 0.3 to 0.15).
- One dominant way to play flattened every variant into "samey" (the shared-board gate memo).

**still-action itself** hit the first of these already: the free auto made kiting the only
playstyle (26 Sep). The hand and the eye, and dropping the far auto, were the fix.

## The rules (proposed 27 Sep; rule 1 confirmed by him 28 Sep: "go with two leanings first")

1. **Two leanings first, fully built, before four.** Close and marksman: the hand and the eye
   already anchor them in the base kit. Each gets offence, defence and a payoff across the slots
   before caster or keeper exist. (Still shipped four heat styles with one supported.)
2. **Every payoff is triggered by the enemy.** A close part pays when the hand breaks a windup;
   a marksman part when a planted shot hits a leader. Never "+X per close part worn".
3. **No multipliers between parts.** Bonuses add or change a behaviour; they never multiply each
   other.
4. **Every part has an opinion.** Strong in its leaning, weaker off it, never dead. A generic-good
   part is a failed part.
5. **No dead slot.** Watch per-slot take rates in the playtest log and the simulator; a slot whose
   parts are always swapped out or never wanted is a systemic fix, not a content one.
6. **No always-take.** A part taken far more often than its peers when offered (the 78% case) gets
   reworked before more content lands.
7. **One number never does offence and defence.** No lifesteal-style parts that let damage pay for
   all survival; sustain stays small.
8. **Committing beats mixing, but mixing works.** A mixed loadout is playable; a committed one is
   better, by payoffs, not by stacking.
9. **Something left to want.** Pedestals plus a pool larger than one run's picks, so a run ends
   before the build is "done".

Checks that hold these: the drop simulator (formation, take rates per part and per slot), the
playtest log (offered/taken/left per part), and his feel.
