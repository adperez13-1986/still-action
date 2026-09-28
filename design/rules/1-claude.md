# Round 1: Claude

The lessons are real; several rules answer them the way a turn-based game would. In a deckbuilder
or on a 2048 board, the maths is the whole game: a multiplier chain is a solved puzzle. In an action
game the maths is half; execution and enemy pressure carry the rest, and a spike in power is felt
through the hands, not read off a board. So rules that flatten power (3, 7, and the CONTEXT line
"runs get wider, not stronger") cost more here than they saved there.

## The nine

1. **Two leanings first.** Keep (his). It's a scope rule and it holds in any genre. But "fully
   built" hasn't happened: a leaning today is a tag plus 4 riders in 30 parts. He can't feel a lean
   he can't see.
2. **Every payoff is triggered by the enemy.** Rewrite. The failure (Aegis: "stack the board, win
   everything, no thinking") is real in action games too: Vampire Survivors is the example of
   payoffs that ignore the enemy, and it's fun for a different reason. The rule was right; how we
   used it was wrong. It became "a break hands you a ready button", which supplies what the push
   sells. **New wording:** *a payoff is caused by the enemy or by a push, and it creates a reason to
   spend, never a free substitute for spending.* Example: a hand break makes that part's next push
   cost 1 instead of 2, or a pushed cast on a broken enemy does something an unpushed one can't.
3. **No multipliers between parts.** Rewrite. still-merge's x9 came from deterministic stacking on
   a board the player fills without resistance. Hades's duo boons, D2's synergies and Dead Cells'
   combos are multipliers, and they're the moment a build "comes online". We already ship one:
   Signal Flare ("your next part hits a marked one twice"). **New wording:** *two things may
   multiply; three may not; every multiplier is conditional on an enemy state (marked, broken,
   venting) and has a visible cap.* This rule plausibly caused the flatness he reports: no part
   makes another part better, so a build is the sum of four buttons.
4. **Every part has an opinion.** Keep. It's the D2 lesson too (a white should play differently,
   not worse).
5. **No dead slot.** Keep; the sim and the log check it.
6. **No always-take.** Keep, loosened. Hades has near-always-take boons and it's fine when the take
   removes no decision. The failure was a 78% take that made the pick meaningless. Measure: a part
   taken over 70% when offered against peers of its slot gets looked at, not auto-reworked.
7. **One number never does offence and defence.** Keep, narrowed to sustain: life-leech that pays
   all survival is the real danger on a 6-depth run. Mirror Ward and Anvil already do both
   (a block that hits back) and they're some of the better parts.
8. **Committing beats mixing, but mixing works.** Keep.
9. **Something left to want.** Keep. The pool (30) and pedestals do it.

## Missing

- **Demand before supply.** No rule says a fight must ever ask for more than cooldowns give. That's
  his observation 1 in one line, and it's why the push (the game's differentiator) is optional.
  Rule: *every depth has moments that ask for more than the buttons have ready; a push is the
  answer, and skipping it costs HP or ground.* Checks: pushes per fight, and HP lost in fights with
  no pushes.
- **Enemies change each other.** Observation 2. D2's packs work because a shaman raises the fallen
  and a champion's aura buffs its pack: the answer to a pack is different from the answer to its
  members. Rule: *every area has at least two pairings where one enemy changes what another does*
  (a shield that covers a shooter, a caller that wakes a sleeper pack, a mender).
- **A power curve inside the run.** Action roguelites feel good because you get stronger while the
  enemies get harder. "Wider, not stronger" is right for the meta (premium, no grind) and may be
  wrong inside a run. **Flag for him.**

## The CONTEXT constraints

His and holding: premium, no grind, symmetric rules, telegraphs, colour, one part = one ability,
no affixes. Reads as inherited and hindering: **"runs get wider, not stronger"** (see above) and
"no +X% anything" when applied to part interactions rather than loot (a mark that doubles is a
+100%, and it's fine). **His to decide.**

## First three changes

1. **Riders spend strain instead of replacing it** (observation 3): a rider makes that part's next
   push cheaper, or unlocks a pushed-only effect. Smallest change: data on 4 parts.
2. **Demand spikes** (observation 1): one pack per depth that overlaps two windups on the same beat,
   so a ready button won't cover it and a push will. Numbers only, no new enemies.
3. **One pairing per area** (observation 2): area I a shield-bearer covering a sentinel (the eye
   can't reach, the hand must go round); area II a caller that wakes the next pack if it lives 5 s.
