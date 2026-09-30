# Brief: should the auto attack go?

30 Sep 2026. His words: "I am having 2nd thoughts now about auto attack.. I feel like auto attack is more
for vampire survivors and archero type games, I actually want to have something more active? convene with
the game agents and discuss if they agree or not, don't blindly agree please."

**He asked for disagreement where it's earned.** A verdict of "agree" needs reasons as strong as one of
"disagree". Do not agree because he asked; do not disagree to look independent.

## Where things stand (read the code: `src/combat.ts` HAND / EYE, `src/mastery.ts`, `src/states.ts`)

- **Two autos, one beat** (0.62 s), picked by what he does, never by a button:
  - **The close strike** ("the hand"): nearest awake body within 2.9 u + pad and a clear line: 10 dmg,
    shoves 0.5 u, breaks a windup it can. Stops while he backs away (27 Sep: "while I am running away the
    hand is still hitting").
  - **The planted shot** ("the eye"): no stick for 0.3 s: a piercing lance, 8 dmg, range 11, shove 0.6,
    aims at leaders then shooters; while planted every hit on him is x0.5 (brace).
    Note: "attack only while standing still" is Archero's own rule.
  - **Bosses take half** from autos (`BOSS_AUTO_MUL` 0.5, 28 Sep: the free close strike did up to 770 of
    the Arbiter's 1170 while he stood at its feet).
- **The four buttons**: one part per slot, cooldowns 1.1-12 s at the ranks he carries; hold a cooling
  button to push (+2 strain). Tap aims at an auto-picked target; hold-to-aim was never built.
- **What leans on the autos** (settled, but this brief may argue to change them, naming the cost):
  "never dead time" (DESIGN.md, Controls); leanings are which auto a part teaches; **mastery** teaches the
  autos a state (Cold Strike chills, Marking Shot marks...); **synergy** is "the autos set states, parts
  pay"; pressure bodies (hulks, sentinels, mites in crowds) are balanced against a free damage floor; the
  depth curve (`design/scaling/CURVE.md`, `CURVE9.md`) was tuned with autos in; Parry is a dead slot from
  depth 4 (`design/parry/README.md`).
- **His log** (38 runs, 25-28 Sep, nothing from the 9-depth game yet): autos did **67%** of all damage
  (hand 8,430, eye 4,664, parts 6,405); by depth 73 / 78 / 72 / 66 / 48 / 75%. About **59 presses per
  minute** of fight time, so he is not idle; the parts are just not what kills things.
- **Correction (after round 1, balancer + verifier, checked against the log):** the 67% above is wrong.
  `partDmg` is only logged since 28 Sep, so it set 9 runs of autos against 2 runs of parts. The 2 runs that
  log both: **64%** autos in his never-melt run (0 melts), **34%** in his investor run (18 melts). Both
  sides are nominal: `autoDmg.hand` adds HAND.damage even on a boss that takes half (main.ts:546), and
  cleave/split damage isn't counted.
- **Phone**: landscape, left thumb on the stick (left 46% of the screen), right thumb over a quarter arc
  of four 60 px buttons. A fifth button, or a hold on the right half, costs that thumb.
- **Rejected before**: melee magnetism (auto-lunge on a swing). Do not propose it.

## The question

Is the auto attack what makes this feel passive, and if so what replaces it? What does "more active"
mean in this game: pressing more, deciding more, aiming, committing to a swing, timing? Options to weigh
(add your own, drop any):

- **A. Keep it**, maybe retuned so parts carry (e.g. autos ~30% of damage, not 67%).
- **B. No basic attack**: the four parts are the whole offence (shorter cooldowns, MOBA-style).
- **C. A pressed basic**: a fifth, larger button (Diablo Immortal, Soul Knight), tap or hold, auto-targeted,
  maybe a combo string or a rooted swing that a dash cancels (Hades).
- **D. An earned auto**: it only fires off what he does (after a part lands, on a state, on a beat he
  keeps).
- **E. Aim**: the stick's heading picks the target or direction of the basic.

## What each voice produces (round 1)

1. **Verdict**: agree / disagree / partly with his read, and the single strongest reason.
2. **What "active" should mean here**, in one paragraph, tied to this game (strain, pressure crowds,
   parts as the build, a 6-inch phone), not to genre in general.
3. **Your proposal** and what it breaks among the settled things above, each with its cost.
4. **The smallest phone trial**: a pause switch like "counters" / "parry catch" (both live), what it
   changes, what he should notice in one run, and the log field that would show it.

Balancer: time-to-kill for a pack and a boss with autos off / weakened / pressed, the damage split, what
the curve and pressure crowds do, what cooldowns would have to become; model or sim, not guesses.
Translator: the thumbs, what a pressed or earned attack feels like mid-crowd on a phone, how the genre
references actually play (Archero, Vampire Survivors, Hades, Diablo Immortal, Soul Knight), and whether
the planted shot is already the Archero feel he dislikes. Verifier: what each option touches in the code
(combat.ts, mastery, states, riders, parry catch, playlog), which checks break (K-90F's combat baseline),
and the check for the trial.

Under ~1,000 words. Write to `design/autos/1-<voice>.md`. Don't change code.

## Round 2

Read the other round-1 files (including `1-claude.md`). Say where you disagree and why in a sentence;
change verdicts you were persuaded on. Under ~500 words, to `design/autos/2-<voice>.md`.
