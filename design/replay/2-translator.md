# Round 2: translator

All four agree on the core (systems for depth, the Line to stage B, no fourth area or Engine
yet, fill ~0.3-0.35). Left to settle: how each system feels in the hand, and the order.

## Where I changed my mind

- **Pick-one-of-three at bosses only, to "at moments, when the quiet comes".** The balancer's
  sim (chosen build 28% to 74% at ~9 moments, only 24% with the boss alone) outweighs my
  worry, and that worry can be fixed in how it's drawn (below).
- **"The same day again" goes down the list.** The verifier found only the layout is seeded
  (152 `Math.random` sites), and the balancer counts ~0 distinct hours for one player. It
  comes back later as the retry button for the ladder, not as its own feature.
- **Order by his play-minutes, not evenings** (the verifier): a move that owes no tuning
  runs goes ahead of one that owes five.

## (a) Where pick-one-of-three happens

**Elites, bosses and Plenty (the balancer's ~9), with one rule: the pedestals rise at the
quiet.** An elite dies mid-fight, often with its pack awake. If three parts appear right
there, you either ignore them or stop to compare, and both break the fight. So the elite
leaves an ember glint where it fell. When the quiet chimes, three pedestals rise from that
spot, you walk into one, and the other two go dark and draw their line back to the wall.
That's ~9 picks a run, about one every 3 minutes. Every depth gets its decision, and no
fight is interrupted. Keep the verifier's guard: at most one unfound part among the three.
Also `packPayout` 0.66 to ~0.45, so fewer loose floor drops compete with the pedestals.

## (b) Tag-weighted drops: steering or the game deciding?

Hidden weighting reads as luck when unnoticed and as the game deciding when noticed ("why
is it all lenses?"). Either way it isn't felt as the player's choice, which is what the sim
is paying for. Make it visible, in one place: **at each pedestal moment, one of the three
leans your way, its glyph matching your worn parts.** Floor drops stay unweighted, so
surprise lives on the floor. One guaranteed match per three is about the balancer's x2-3,
with no hidden multiplier, and you can see you could have followed it. The player's own
steering tool is already built (turning parts to the wall): point to it the first time a
pedestal group has no match.

## (c) Push the drop

The gesture reuse is the right idea: the same hold, the same ring, the same +2. Three fixes
for the thumb:
- **Only on pedestals, never on floor parts.** A floor part gives a take prompt the moment
  you step on it, and a thumb still pressing from the fight would reroll by accident.
- **A longer hold than a push:** ~600 ms, with the ring going round the pedestal, not the
  button. Rerolling is a decision made at rest, not a reflex.
- **No second kind of strain.** The balancer's "want strain, quiet-proof" is a second colour
  on a bar you already can't read mid-fight. Draw it as the **floor line lifting by 2**: the
  pencil line quiets can't go below moves up and stays up until a Rest shrine. It's the
  same rule and the same number, on the one line already drawn, and it reads as "I raised
  my own floor."
A currency? Inside a run, yes, and fine: nothing piles up, carries over or farms; "no
currency" was about the meta. The risk is Stopped reading as a punishment for greed, so its
card must look as kind whether you strained for parts or for pushes.

## (d) Wishes, or the maze remembers the hook

**Both, in order, and the maze goes on the ladder.** The verifier's move is the better
mastery hook: it makes the hook a decision, and it's cheap. But by default it turns the one
thing you carry from home against you, and to a new player that reads as the game spiting
what they love, which is moth and flame backwards. As a rung ("the maze remembers", marked
on the card as weather), it's a dare the player chose. Wishes are the better reason to
start run 20 for most players, because they ask "go and see" rather than "do better", they
come from the family, and they cost no tuning runs: a wish works as soon as it gets
noticed. Wishes carry discovery (runs 1-15); the maze carries mastery (the ladder).

## (e) What he plays next, before anything is built

Both switches are on by default right now (`closeHand`, `eye`). **Three runs, ~80 minutes:**

| run | close hand | the eye | watch for |
|---|---|---|---|
| 1 | on | off | arms share of casts (was 25%); did you step in during wind-ups |
| 2 | off | on | head share (was 51%); did you plant on purpose |
| 3 | on | on | does either get in the way of the other |

Then the **miss test**: turn each off for one depth and write one line on the reMarkable
about which you missed. Keep that one; cut or rework the other. The switches are already
logged, so no code. Save v4 and the run log can be built meanwhile: they cost no play.

## Keep / cut

- **Keep:** fill ~0.35; pedestals at the quiet with one leaning your way; push the drop, as
  the floor line lifting; wishes; weather as the ladder, with the maze as a rung; the four
  states (marked, chilled, pinned, pulled), each shown on the body; save v4 and the log first.
- **Cut or defer:** hidden leaning weight on floor drops; a second strain colour; seeded
  days as a feature; the maze remembering by default; anything new behind a third switch.

## Final direction and first moves

**Choices in the run, questions in the house, and play-minutes as the budget.** Pedestals
give a run its decisions, wishes give run 20 its question, and weather gives mastery a place.

0. **Play:** the three switch runs and the miss test. No code.
1. **Save v4 and the device run log** (2 evenings, 0 runs), so the picks get measured.
2. **Pedestals at the quiet** at elites, bosses and Plenty, with fill down to 0.35,
   `packPayout` down to 0.45, one pedestal leaning your way and at most one unfound (1.5
   evenings, 2 runs).
3. **Wishes, the first 8 sights** (2 evenings, 0 tuning runs, plus the drawings). Then push
   the drop, then the weather.
