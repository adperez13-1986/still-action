# Autos: where the round landed (30 Sep)

His ask: auto attack feels like Vampire Survivors / Archero; he wants something more active. "Don't blindly
agree." Files: BRIEF, 1-/2- for balancer, translator, verifier, Claude; sims `autos-sim.mjs`, `autos-sim2.mjs`.

## Where all four agree, including against him

- **Partly agree.** It is passive, and **the planted shot is Archero's rule** (stand still, it fires). The
  close strike is not: it rewards position and already stops when he backs off.
- **The cause is the auto's price, not its existence.** The free close strike (16 DPS on one body) out-damages
  every white part (7 at best). A white press is worth about two free beats, so pressing barely pays.
- **The 67% was wrong** (Claude's number). On the 2 runs that log both sides: 64% autos never-melt, 34% investor.
- **No: remove the autos (B).** Never-melt finish rate at 9 depths goes 31% to 0%. Compensating with cooldowns
  x0.35 makes a push worthless (Stopped unreachable), doubles the investor's lead, and kills all six masteries.
- **No: a fifth pressed button (C).** On a phone it gets held, and a held basic is an auto that costs the
  only thumb that presses parts. Still already has Hades's four verbs in its four slots.
- **Every earned rule costs the never-melt player 30-50% kill time**, and only pressing more buys it back
  (about 42-46 presses a fight-minute; he does at most 28). Cheaper cooldowns can't. That is the point of it
  (the game asks him to press), and it is also a harder game for the floor player.

## The split, and how it closed

| rule | backed by | for | against |
|---|---|---|---|
| **Bank ("follow-through")**: each cast or push adds 3 auto beats, cap 6; empty = no auto | balancer, verifier; Claude (changed in the end) | smallest build (one counter), only one modelled from the start; keeps masteries, riders, half the breaks; a part started 93-97% of kills | autos still spend beats on bodies he never touched (38-49% of their damage) |
| **Claim**: autos only hit bodies a part hit in the last 3 s | translator; Claude (round 2) | the only rule where a free beat never kills an unchosen body | costs the investor x1.15 he can't press back; his breaks fall to 4%; a field on every body, a rim on each |
| **Package**: planted shot stops firing, close strike x2 for two strikes after a part lands, arms cooldowns 1.4 s | translator (round 1), balancer as second trial | the only one that removes the Archero turret he named; as cheap as the bank when he presses | 0% breaks (a defence cut the model doesn't count); content work |

Claude's own time window was dropped: it's a bank counted in time, and it reads like "autos on" once he
presses every 2 s. The claim lost on the balancer's numbers: kills-with-a-part goes 93-97% (bank) to 100%
(claim), below what he can feel, for the investor's endgame.

## Recommendation

**Trial the bank first**, as one pause switch "follow-through" (words his), off by default, like "parry
catch". One never-melt run to depth 3.
- He should notice: does he fire buttons as they come up; do the quiet gaps read as Still waiting for him?
- Log first (verifier): `autoDmgReal` (after the boss half, with cleave/split), `kills {part, auto}`,
  `bankBeats`, `emptyBeats`, `fightS`, `leftMs` per press.
- Pass: 40+ presses a fight-minute, `emptyBeats` < 20% of beats, HP lost at depths 1-3 within 20% of now.
- **If he still names standing still as the problem**, trial the package (+ arms 1.4 s) second. The numbers
  don't separate the two; his reaction will.

## Found on the way: pushes that may be accidents

A press that starts on a *ready* button casts at once and can't push. On a *cooling* button, 180 ms of hold
pushes (+2 strain), and his ordinary tap lasts 214 ms (median). Of 326 pushes, 59 were held under 240 ms:
about 1 in 5, roughly 3 strain a run, plausibly taps he meant as nothing. The bank pays each push 3 beats,
which would reward that. Keep 180 ms for the trial; log `leftMs`; his call whether to look at it after.
