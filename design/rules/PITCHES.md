# The build rules, re-read for an action game

28 Sep 2026. Four voices (balancer, translator, verifier, Claude), two rounds; raw files in this
folder, the brief in `BRIEF.md`. His ask: *"maybe those are from when we were working on other
games? re-evaluate those and see if they are helping or hindering us."*

## The short answer

**Mostly hindering, and not the way we thought.** The failures in LESSONS.md were real, but
several rules were stricter than what the old games actually learned (the verifier checked the
sources). still-merge's rule said "keep them separate, **or** tie the link to something the enemy
does"; LESSONS dropped the "or". Its x9 was fixed with exclusivity, not a ban on multipliers. Still's
78% always-take was a sim bot's, caused by a thin pool. And one lesson was missing entirely:
still-merge's late game got easy because the player outgrew a fixed enemy curve. **That's your
observation 1.**

**The biggest finding: the free autos break the rule "one thing never does offence and defence".**
Nobody applied that rule to the hand and the eye. The hand deals 10 and cancels the slam; the eye
deals 8, cancels the shot and halves blows. Your last full run: **43 hand breaks + 9 eye breaks in 19
fights, against 10 pushes.** Once the hand arrived, boss pushes fell from 3.4 to 1.0 a fight and
median peak strain from 12 to 3; no run has ended Stopped since. The autos did 72% of the Arbiter's
HP with no pushes. A pack dies in 2.5-3.5 s at every depth, because pack HP grows only as fast as your
buttons light up. The riders are a smaller copy of the same leak (10 fires in your leaning run).

## The nine rules, after two rounds

| # | Old rule | Verdict | New rule |
|---|---|---|---|
| 1 | Two leanings first | **keep** (yours) | unchanged |
| 2 | Every payoff triggered by the enemy | **rewrite** | A payoff is triggered by what the enemy does **and a price you paid to meet it**: a push, a position held, a press. A break the free autos make pays nothing extra. |
| 3 | No multipliers between parts | **rewrite** | **At most one multiplier on a hit**, from the enemy's state (open, marked, broken); if two apply, the larger wins; cap x2. Never from what you wear. (Signal Flare's mark already fits.) |
| 4 | Every part has an opinion | **rewrite** | Every part changes **where you stand or when you press**. If you'd press it exactly like its white, it has no opinion, whatever its tag. Strong picks are allowed. |
| 5 | No dead slot | **keep** | unchanged (presses: head 44%, legs 20%, torso 18%, arms 18%: none dead) |
| 6 | No always-take | **rewrite** | A part taken 70%+ of 6+ offers (gifts and golds excluded) gets **looked at first**: is it the maths or the card? Rework only if runs with it play the same. (Flagged now: Mirror Ward 9 of 12.) |
| 7 | One number never does offence and defence | **rewrite** | **Nothing free does both.** The autos, riders and anything that fires without a press do offence or defence. A part may turn defence into offence only through an enemy action (Anvil's catch, a parry, a pushed break). |
| 8 | Committing beats mixing | **keep** | unchanged; a feel question at your volume of play (the sim's 98% was circular: its bot is built to commit) |
| 9 | Something left to want | **keep** | plus a check: at least 0.5 takes a depth at depths 4-5 |

**New rules (the genre needs them, the old list didn't have them):**
- **Demand.** Fights ask for pushes: at least 1 push a fight in the crawl, strain at the Arbiter 8+
  (today 3). Stopped should be reachable by someone who spends.
- **Riders never sell the push.** A rider can't hand out "fire now" for free; it can reward a push.
- **Enemies change each other.** From depth 2, each level has a pack where one enemy changes the
  answer to another (D2's shaman raising the fallen, Hades' shield soldiers).
- **Enemies answer your answer.** Each archetype gets a second tell that punishes the answer that
  beats its first (the band against a hulk is safe forever today; so is planting against a sentinel).
- **A curve inside the run.** HP lost a fight should rise by depth (needs a log field first).

## What we'd build first: one combat trial

**Three of four voices agree** (translator, verifier, Claude; the balancer dissents below):

1. **Poise, 3 s per enemy.** The hand or eye breaks an enemy's windup, then that enemy is **poised**
   for 3 s: its next windup can't be broken by the autos, only by a push or a part. **With a tell:**
   the poised enemy's core rim burns hard ember, its next windup ring is drawn doubled, and an auto
   hit on it makes a dull clank instead of the shatter. The first slam of every enemy still shatters
   the way you liked; the second one inside 3 s is yours to answer.
2. **Riders fire on a pushed break** (never on the button you just pushed), 4 s cap as now. The loop:
   *hold a cooling button, it breaks the windup, the button beside it snaps full.* Leanings then cost
   strain instead of saving it (your observation 3, fixed).
3. **Patient Lens loses its rider.** Its card says "push it for a full shot"; its rider gave the full
   shot away for free.
4. **Log fields** before you play: `poised`, `hpLost` / `hpHealed` per depth, `partDmg`.

**Pass lines after 3 runs:** free breaks at most 1 a fight (today ~2.7); crawl pushes at least 1 a
fight (today 0.49); the autos' share of the Arbiter under 50% (today 72%); riders fire 2+ a run where
worn. Stopped and Broke rates need 6+ runs.

**The balancer's dissent:** make the autos **never** break (the push owns breaking). Cleaner and
easier to learn, it argues, since poise still breaks about 1 in 3 windups. The others answer: you
confirmed on 27 Sep that the break is what made you feel the hand; without it close takes 2-3 slams
a pack and kiting comes back. **Agreed fallback:** if poise at 4 s still logs more than 1 free break a
fight, go to "never break".

**Next, for observation 2 (enemies):** the **mender** (already pitched in `design/variety/`; you cut
its cable by walking through it, which changes a packmate), then the **counter-moves** for the hulk
(lunges at a Still who holds the band ~1.5 s) and the sentinel (steps behind cover from a planted
Still). Split 2-2 on the order; the mender is the bigger change to how a pack plays, the
counter-moves the cheaper one.

**Later, a dial of yours:** the quiet heals 1/4 of missing HP instead of 1/2. Not in the same trial.

Dropped in round 2: Claude's "a break makes the next push cheaper" (a strain refund, which DESIGN
rules out), Claude's pack-waking caller (chain-waking was ruled out), the verifier's "prime".

## Yours to decide

1. **The combat trial:** poise with its tell + riders on pushed breaks + Patient's rider off. Or the
   balancer's "autos never break" instead.
2. **Enemies next:** mender first, or counter-moves first.
3. **Four hard constraints all four voices flag** as inherited or read too widely (only flagged, not
   argued):
   - **"Runs get wider, not stronger"**: across runs only (no grind, which is yours), or inside a run
     too? Read inside a run, it forbids the power spike Hades and Death Must Die are built on.
   - **"Deeper: never more enemy HP or damage"** (DESIGN): with the quiet's half heal, the likeliest
     root of "too easy". The run is flat on both sides.
   - **"No +X% anything"**: for loot and stat blocks (yours, it holds), or also for how parts
     interact (a mark that doubles is a +100%)?
   - **"No part lowers strain"**: holding, but it closes the most direct way for a part to feed the push.
