# Round 1: the translator (how it plays in the hand)

28 Sep 2026. Numbers from `playtest.json` (11 runs dated 28 Sep, 134 fights) and the code.

## What the thumbs do today

A phone gives the player three ways to say anything: **where he stands** (stick), **when he
presses** (four buttons), **what he commits** (the hold, strain). The autos have taken two of them.
Step into the ring and the hand strikes on its own beat and breaks the hulk's slam (520 ms windup
inside a 620 ms beat). Plant and the eye picks the target, halves blows and breaks the sentinel
(760 ms). His last full run: **43 hand breaks + 9 eye breaks in 19 fights**, ~2.7 enemy strikes
cancelled per fight without a press, against 10 pushes. Casts: 4.2 a fight, head 50% of them (283
of 563), pressed because they're lit, not to answer anything. That is observation 1.

## The nine rules

| # | Can it fail the same way here? | Verdict | Evidence | Precedent |
|---|---|---|---|---|
| 1 Two leanings first | Yes, any genre | **Keep** (his) | every slot x lean covered | Hades ships each god whole |
| 2 Payoff triggered by the enemy | No: board-scaling can't happen. What happened instead: the autos produce the trigger | **Rewrite** | riders fire off auto breaks, 2.7 a fight with no press. **Cause of obs. 3** | Hades' Athena deflect, Dead Cells' parry: payoff on a *timed input* |
| 3 No multipliers between parts | Partly. Staggered cooldowns cap stacking by timing; the x9 was passive | **Rewrite** | Signal Flare's mark ("lands twice") and the x1.5 opening already break it, safely, because both are timed | VS evolutions, Hades duo boons |
| 4 Every part has an opinion | Yes | **Rewrite (sharpen)** | Pressure Vent "marksman", Kickstart "close": tags filled coverage; the press is the same either way | Dead Cells: each weapon has a sweet spot you feel |
| 5 No dead slot | Yes, worse: a dead slot is a dead thumb | **Keep** | arms 15% of casts, head 50%: watch | Hades' Cast lives because boons land on it |
| 6 No always-take | Yes: 3-choice pedestals are the 78% setup | **Keep** | 3 taken of 13 seen; too few | Hades' Athena dash |
| 7 One number never does offence and defence | Yes, and **the autos break it**: the hand is damage plus a cancelled slam; the eye is damage, a break and x0.5 blows | **Rewrite** | 43 hand breaks; 13 of 13 Arbiter fights Home. **Plausible main cause of obs. 1** | Hades and Dead Cells: attacks don't block; parry is its own button |
| 8 Committing beats mixing | Yes | **Keep** | untested in play (match off); dropsim committed 98%, random 22% | D2 skill trees |
| 9 Something left to want | Yes | **Keep** | pool 30, ~6 picks a run (guess) | Hades' boon pool |

**New wordings**
- **2.** *Every payoff is earned by answering the enemy with a choice that costs something (a push,
  a position, exposure). An event the autos produce on their own never pays.*
- **3.** *Parts never multiply each other passively. One part may set up and another pay off inside
  a window the player has to hit (a mark, an opening), capped at x2 on that hit.*
- **4.** *Every part changes where you stand or when you press. If you'd press it exactly like its
  white, it has no opinion, whatever its tag.*
- **7.** *Nothing free does both. The autos, riders and anything that fires without a press do
  offence or defence, never both. What does both costs a press, a push or a position.*

## Why the enemies feel the same (obs. 2)

In the hand, all five ask **one question: is a shape on the floor about to be where you are?**
Hulk a ring, sentinel a line, ram a lane, mites a ring laid ahead, Lobber a circle. One answer:
step out, or let the auto break it. Three things are missing:

1. **Nothing lasts.** Every shape is gone within ~1 s, so the floor never changes and where you
   stood never matters a beat later. (Hades' witches leave rings; Dead Cells' grenadiers leave fire.)
2. **Nothing changes another.** Hulk + sentinel is two separate step-outs, not one harder problem.
   Apart from the Warden, nothing protects, mends, flushes or pins for a packmate. D2's shaman
   raising Fallen makes you choose who dies first; here the eye chooses for you.
3. **Nothing answers your answer.** One move each. The band against the hulk is safe forever;
   planting against a sentinel is safe forever. Hades' enemies have 2-3 moves; Dead Cells'
   shielders make you roll behind them.

Vampire Survivors and Death Must Die can run shallow enemies because density and build power are
the game. Windups plus four cooldowns is Hades and Children of Morta, where the enemy is half the depth.

## Missing rules

- **M1, the ask.** *Every fight holds a threat the autos can't answer and a press or push can.*
  Measure: strikes cancelled without a press per fight (today ~2.7), target under 1.
- **M2, the counter-move.** *Every archetype has a second tell that punishes the answer that beats
  its first*, telegraphed like the first.
- **M3, combinations.** *From depth 2, every pack has a pair where one enemy decides where you
  stand and the other punishes it.* D5's rows already say so in comments ("the ram flushes you, the
  shell punishes hiding"); make it the rule.
- **M4, the floor remembers.** *Each area has an enemy that leaves something lasting 3-5 s* (guess).
- **M5, auto share.** *The autos carry you between presses; the parts win the fight.* Autos today
  ~60-65% of damage (a guess: 2,556 auto logged, part damage isn't, 74 casts at ~20). Log it, aim
  under 45%.

## Hard constraints (flags only, his to decide)

- **"No +X% anything", "tiers different, never stronger", and DESIGN's "deeper: never more enemy HP
  or damage"** together hold the run flat on both sides: depth 6 plays at depth 1's numbers.
  "Wider, not stronger" reads as a rule *across* runs (no grind: his); it is also flattening the
  *inside* of a run, where Hades, D2 and DMD keep their curve.
- **Telegraphed and committed** is helping. What hinders is the tuning habit "a step clears every
  threat" (DESIGN), not the constraint: overlapping tells are still fair.

## Three changes, smallest first

1. **The autos stop breaking (obs. 1).** Hand and eye keep their damage and shove; breaks go back
   to pushes and parts (Parry Clamp, Clamp Toss). A flag each in `combat.ts`. The band still pays
   (10 on the beat), but the slam becomes something to step out of or push through. Expect pushes
   up from ~0.6 a fight (77 in 134) and HP loss up; watch Broke at the Assembler, and whether
   kiting creeps back (the hand break was pass 2's fix for it).
2. **Riders fire off a pushed break (obs. 3).** A pushed break inside the hand's reach fires the
   close rider, from a planted Still the marksman one; same 4 s cap, never on the button just
   pushed. The loop: *hold a cooling button, it breaks the windup, the button beside it snaps
   full.* The rider stops replacing the push and becomes what the push buys.
3. **One counter-move each for the hulk and the sentinel (obs. 2).** The hulk lunges (a line, not
   its ring) at a Still who has held the band ~1.5 s; the sentinel steps behind cover from a
   planted Still (both numbers guesses, both with their own tell and tone). Two enemies before
   five, to learn if "it answers you" is the missing feel before building families.
