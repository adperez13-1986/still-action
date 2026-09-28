# Brief: are the build rules helping or hindering?

28 Sep 2026. His ask, after playing pedestals + leanings:

> "what are those rules that you are quoting, like this 'no multipliers'? maybe those are from when
> we were working on other games? please re-evaluate those with the game agents and see if they are
> helping or hindering us in this ARPG/Roguelite that we are doing"

## Where the rules came from

`design/builds/LESSONS.md` (read it in full). Written 27 Sep from the records of the two earlier
Still games: **Still**, a turn-based deckbuilder, and **still-merge**, a 2048-shape roguelite. Nine
rules came out of it. **He confirmed only rule 1** ("two leanings first"); rules 2-9 were Claude's
proposals and the leanings round (`design/leanings/PITCHES.md`) treated them as settled.

The rules are under review, not the lessons. The failures in the record really happened (one
dominant build, generic-good picks, dead slots, a 78% always-take, multipliers stacking to x9,
payoffs that ignored the enemy). The question is whether each rule is the right answer to its
failure **in a real-time action roguelite on a phone**, or a turn-based answer carried over.

## What he just reported (28 Sep, his words and the log)

1. **"The game is too easy. Pushes are not required because normal attacks and normal part usage
   are enough to kill everything. The times when I die in the Assembler, it is because I was
   careless."** Log: every Arbiter fight on record (13) ended Home; his last full run pushed 17
   times over ~20 fights, strain peaked at 10 of 20.
2. **"The enemies are shallow and feel the same, just minor variations."** Every enemy is approach,
   windup, strike, recover; none changes what another does.
3. **"Leanings are all about reactivating? Then much less push/strain usage, right?"** Correct: a
   rider hands out a free ready button, which is what a push buys with strain. The leanings round
   checked riders against rules 2, 3 and 7, never against the push. Only 4 of 30 parts carry a rider.

He also noticed on 26 Sep that the game is "an ARPG layer on top of StS"; closest precedents named
then: Hades, Death Must Die, Children of Morta. Loot follows D2's structure (treasure classes,
tiers), not its maths. Those games lean on multipliers, generically strong picks and power spikes.

## Read first

- `design/CONTEXT.md` (the game, its hard constraints), `DESIGN.md`, `HANDOVER.md` (current state).
- `design/builds/LESSONS.md` (the rules), `design/leanings/PITCHES.md` (what they produced).
- `design/strain/PITCHES.md` (why pushes exist and what "demand" means), `design/variety/PITCHES.md`
  (the enemy variety diagnosis).
- `src/abilities.ts` (the 30 parts, riders), `src/combat.ts` (the hand, the eye, breaks),
  `tools/dropsim.ts` if you want numbers.

## What each voice produces (round 1)

For **each of the nine rules**:
- The failure it answers, and whether that failure can happen the same way here (real time, 4
  buttons on cooldowns, a free auto, strain as a run resource, 6 depths, pedestals).
- **Verdict: keep / rewrite / drop.** If rewrite, the new wording.
- **Evidence** it's helping or hindering now: point at a part, a number, a log line, or his three
  observations. Name any rule that plausibly caused one of them.
- What the ARPG/action-roguelite precedents (Hades, D2, Death Must Die, Children of Morta, Vampire
  Survivors, Dead Cells) do instead, and whether that transfers to a phone with 4 buttons.

Then:
- **Missing rules**: anything this genre needs that the nine don't cover (e.g. demand that makes
  the push necessary, enemy combinations, a power curve inside a run).
- **The hard constraints in `design/CONTEXT.md`.** Some are his (premium, no grind, symmetric
  rules, telegraphs, colour). Say if any read as inherited and are hindering (for example "runs
  get wider, not stronger", "no +X% anything"). **Flag only; those are his to decide.** Do not
  treat them as open.
- **Three changes you'd make first**, smallest first, each tied to one of his three observations.

Keep it under ~1,200 words. Numbers where they exist; say so when a number is a guess.

## Round 2

Read the other three round-1 files. Where you disagree, say why in a sentence. Change your
verdicts if you were persuaded, and say which. Under ~600 words.

## Out of scope

Building anything. Area III / the Line. Words that are his to write (endings, notebook).
