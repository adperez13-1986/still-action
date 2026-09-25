# Pitches: making the push wanted

25 Sep 2026. Same process as the Home and content rounds: four voices
(balancer, translator, verifier and me), two rounds. The raw rounds are in this
folder, and the brief is `BRIEF.md`. Nothing is built.

This round converged hard. All four voices ended on nearly the same three
steps. Two real choices are left for you (at the bottom).

---

## Why you never push: the code agrees with you

Your instinct is correct play. Read off the code and the numbers:

- **A push is worth about half a cast.** It fires a cooling part now and then
  restarts its *full* cooldown. For 26 of the 30 parts that's all it does.
  Only Patient Lens, Overrun, Lure and Plumb Line do something different when
  pushed.
- **Enemies die inside their own openings.** A hulk's 760 ms recover already
  takes about 34 damage with no push, against 30 HP. Every "open" state (the
  ram's hatch, the Assembler's grill, the Arbiter's vent) is ×1.5 on *any* hit,
  the auto included, so an opening never asks for a particular button.
- **Walking answers every threat.** Everything was tuned so a step clears it.
  So a threat can't create demand, only an opportunity can.
- **The screen says a cooling button is off.** The cooldown sweep at .78 is how
  every phone app draws "disabled". A hold gives no feedback until it fires at
  180 ms. A tap on a cooling button is thrown away without a sound.
- **You were never taught.** The push hint fires for 2 of the 30 parts, and
  neither is in the starting twelve, so about 80% of first runs never see it.
  The only designed push moment is the Arbiter's heat, around minute 24.
- **Stopped is out of reach.** At about 0.2 pushes a fight, the balancer's run
  model gives Stopped 0%. One push a fight is free forever (a push costs 2, a
  quiet refunds 2), and most of those refunds are wasted at strain 0.

---

## What all four agree on

**Step 0. The screen tells the truth, and we measure. (about 1 evening)**
- A cooling button shows its price: two hollow ember pips on the rim, and the
  sweep eased from .78 to about .5 so the icon stays readable. It reads "costs
  2", not "off".
- A tap on a cooling button answers: a dry click and an ember arc that starts
  round the rim and pulls back. A hold draws a ring that closes over the
  180 ms, and the push fires as it closes.
- **The free push drawn on the strain bar:** two hollow pips at the tip while
  a fight is awake. Push once and they fill. The quiet empties them. A second
  push lands past them, solid, and stays. It shows what no screen says today:
  the first push of each fight costs nothing, and at strain 0 it's simply
  wasted if you don't use it.
- **Counters:** dead taps and pushes per fight in `__runStats`, plus how long
  your taps actually last on the Poco.

Then you play three runs. It isn't the fix, and all four say so. You designed
the push, so knowing it exists won't make you want it. What it gives is a
number: if dead taps are above about 1 a fight, the want is there and the
screen was hiding it. If they're near zero, your diagnosis holds, and step 1 is
the work.

**Step 1. A push breaks the wind-up it's aimed at. (about 1.5 evenings)**
- **One rule for all 30 parts:** a pushed hit that lands on an enemy during
  its wind-up breaks it. The enemy reels (its own recover, open ×1.5). A
  normal hit doesn't. Bosses can't be broken.
- **A pushed cast aims at the threat:** at the enemy whose wind-up lands
  soonest, if it's in reach, not the nearest idle one. On a phone you can't
  aim, so the rule depends on this.
- **The hint moves** to the first time a wind-up starts that a cooling part
  could break, not the first time a part recharges.
- The telegraph rule holds: the enemy still commits, and walking still works.
  The push becomes the way to *answer* a wind-up and stay in the fight.
- **What it can reach in time** (a push lands about 430 ms after you see the
  tell): sentinels reliably, Lobbers up close, rams if you read the tracking
  rails before the lock. Hulks and mites are a coin flip and stay answered by
  walking. The balancer counts that as the right filter, since it keeps the
  asks near one a fight.
- Parts: Parry Clamp stays the free break (narrowed, not useless). Overrun,
  Frayed Cleaver at 12+ and Pressure Vent get better at breaking. Nothing is
  made useless.

**Step 2. The bosses ask for the paid pushes. (about 1.5-2 evenings)**
- **The Assembler's grill locks.** When it's stunned against a wall, four small
  locks light on its boss bar, one per slot. Land a hit from each slot before
  the stun ends and the core cracks: it loses one move for the rest of the
  fight (barrage, then magnet, then sweep). With four staggered cooldowns you
  rarely have all four ready (about 20% of the time), so the unlit locks point
  straight at the buttons to push. Skipping it just means a longer fight.
- The Arbiter gets the same idea in its vent afterwards (a crack costs it the
  second wedge, then the reversals).
- **The Lobber teaches heat at depth 5:** a shell that lands heats one button
  for 3 s, the Arbiter's rule in small, learned where it's cheap.
- Boss fights have no quiet inside them, so every push there is a real bet.
  That's where strain is meant to rise.

**After that: the answer is lit.** When a wind-up starts that one cooling part
could break, that one button gets a moving ember thread *outside* its rim
(where the thumb doesn't cover it), with one short buzz. Only ever one button.
About 1 evening.

### Is Stopped reachable with this?

The balancer's model, with the whole bundle:

| how you play | Stopped | mostly at |
|---|---|---|
| you watch the bar and keep a few back | 0% | |
| you spend at the bosses | 6-29% | depths 3 and 6 |
| you keep nothing back | 9-39% | depths 3 and 6 |

So it's reachable, it only happens to a player who chose to spend, and it's
never a cascade. No strain numbers change. Quiet stays −2.

---

## Cut, with the reason

- **A well-read push is free** (mine). If most pushes are refunded, a good
  player is never Stopped, and Stopped becomes the grade for a bad one.
- **Openings on a missed slam or bite** (translator). Fodder dies in the window
  anyway, so they ask for nothing.
- **The caller** (mine). It chain-wakes a pack, which the crawl design ruled out.
- **The last push lands at ×2** (balancer). It makes Stopped something you
  choose, against "no Sit down", and it sits next to the parked "strain makes
  Still stronger".
- **Reach ×1.5 when pushed, pushed whites borrow their blue.** Always on, so
  both turn into autopilot, and both wear away the blues.
- **Two locks landing at once** (verifier). It's the thing a 6-inch screen
  reads worst, and it reopens a readability decision.

## Later, if the crawl still doesn't ask

- **Elites read your buttons** (balancer): an elite commits when the part that
  would answer it is cooling. It needs a visible tell, or it reads as cheating.
- **The runaway thief** (translator, withdrawn by its author, kept by the
  verifier): it heads for a grate, and the part in its cage is gone for the
  run. That reverses "it never leaves the level". It's your call after you've
  played the thief.
- **Pushed halves** on Parry Clamp, Mirror Ward (catches shells), Signal Flare.
- **Walls break them** (a pushed shove into a wall stuns), **a push is
  remembered** on the part's history, **the last word** (the quiet lands on a
  pushed killing blow; the same −2, only earlier).

---

## Two choices for you

**1. The gesture: hold as it is, or cock and release?**
The translator's idea. Holding a cooling button for 180 ms *cocks* it without
firing. Let go and it fires (+2). Slide off and it cancels for free. You get
ready on the first sign (the hulk rearing, the ram's rails) and fire on the
commit, so a push lands about 250 ms after the cue, not 430. Hulks and the
ram's lock become answerable, a bit like a parry.
- **For:** a break that arrives late will feel like failing, and this fixes it.
  Holding *is* straining: the push is in your thumb before it's on the meter.
- **Against** (balancer): it changes the gesture you designed, and it puts
  all ~9 wind-ups a fight back in play, which pushes the asks past the free
  band.
- **My recommendation:** build step 1 on the hold as it is, with step 0 logging
  how long your taps really last. If breaks feel late on the phone, cock and
  release is the next thing to try. (The verifier's middle option: if your taps
  are short enough, drop the hold from 180 to 140 ms.)

**2. The starting twelve: swap two parts?**
Patient Lens in for Cracked Lens, and Overrun in for Skid Plates (each pair
bends the same white). It's one line, and it takes the chance of seeing a
push-shaped part in your first run from about 20% to about 80%. It changes the
pool the Home design picked, so it's yours.

---

## Build order

| step | what | evenings |
|---|---|---|
| 0 | the price on cooling buttons, the answered tap and the hold ring, the free push on the strain bar, counters (+ the pool swap if you want it) | 1 |
| | *you play three runs* | |
| 1 | a push breaks the wind-up it aims at, the hint moved | 1.5 |
| 2 | the Assembler's grill locks, the Lobber's heat | 1.5-2 |
| 3 | the answer is lit; the Arbiter's cracks | 1.5 |

About 5-6 evenings in all. Most of the real work is tuning on the Poco.
