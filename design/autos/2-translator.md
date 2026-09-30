# Autos, round 2: translator

## Changed verdicts

- **My follow-through package is withdrawn. I back the verifier's claim.** My x2-after-a-part is a global
  buff like the bank and the window, and the base strike under it still kills whatever is nearest. The claim is the only rule of the four where ownership is built in: a free
  beat can only finish a body one of his parts has touched.
- **The close strike at 5 is withdrawn.** The balancer's A1 (autos x0.5, never-melt finish 31% to 6%) is my
  proposal, made worse by also losing the lance. Under the claim, the autos keep
  10 / 8, breaks, shove and brace.
- **The planted shot stays, but only at claimed bodies.** Planting stops being Archero's resting state and becomes cashing in on a head
  press.
- **Heading-aim is dropped from the trial.** The claim already settles which body the strike takes.

## Which rule reads best mid-crowd

| rule | where his eyes must go | reads mid-crowd? | can a free beat kill a body he never chose? |
|---|---|---|---|
| Claim (cold rim at a body's base) | on the bodies, where they already are | yes: the rim is the promise, the cold sweep landing on it is the payment | **no** |
| Bank (3 beats per press, cap 6) | a counter on the HUD or on Still | no: nobody reads a 0-6 count while dodging | **yes**, and whiffs count, so mashing pays |
| Window (2.5 s warm after a part lands) | Still's core | fairly: a glow on Still is readable | **yes**, anything in reach while warm |
| Mine (x2 for two strikes) | the arms button or the sweep | weak | **yes** |

The bank is the best at getting presses out of the never-melt player (D3 at 35 a minute beats today). But
it pays for pressing, not for deciding, and "landed or not" invites mashing. On a cooling 60 px button, a mash held
180 ms or more becomes an accidental push (+2 strain).

## What the claim needs to land on a phone

1. **The rim must survive a crowd.** Ember bodies overlap at 38 degrees, so a thin rim at the base will be
   hidden. Make it a cold ring slightly wider than the body, fading over its last 1 s, never flashing.
2. **Show a waiting strike as waiting, not broken.** Standing at an unclaimed hulk, Still should visibly cock
   the clamp on the beat without striking. Otherwise the first fight reads as a bug.
3. **Parts are still auto-targeted, so "chose" is thin for a single-target part.** If he says "the Lens claimed the wrong one", the next change is heading-aim
   for head parts, not for the autos.

## Where I still disagree

- **With the balancer:** the finish rate isn't the only bar. D3 keeps the numbers level, but it proves he
  pressed, not that he decided. I'd rather the balancer sims the claim's never-melt finish rate before either
  switch ships. If the claim sinks him below ~20%, trim white cooldowns (x0.85, as D3 already allows) rather
  than add a bank on top.
- **With Claude:** once he presses every 2 s, a global window can't be told apart from "autos on".

Trial: the verifier's "claimed autos" switch as specified, plus `kills: { part, auto }`. Auto kills under
half is the line that tests ownership.
