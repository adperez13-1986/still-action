# Strain, round 1: the balancer

Lens: systems and math. Every number below is from the code (`src/abilities.ts`,
`src/enemy.ts`, `src/charger.ts`, `src/ranged.ts`, `src/swarm.ts`,
`src/lobber.ts`, `src/boss.ts`, `src/arbiter.ts`, `src/main.ts`,
`src/pool.ts`, `src/dungeon.ts`) or from two small Monte Carlo models (window
damage, and strain over a whole run). The models' assumptions are listed where
they're used. Treat model outputs as shape, not measurement.

---

## 0. Why the thought never comes up: the numbers

The owner's instinct is correct play. Today a push is worth about a sixth of
what it costs, and even the free one is worth less than the thumb-hold.

**What a push buys today.** A push fires a cooling part now and restarts its
full cooldown. Over the rest of a fight that's worth `remaining / cooldown` of
one cast, on average **half a cast**.

| part | cast | half a cast | the same damage from the auto (5 per 0.62 s) |
|---|---|---|---|
| Focusing Lens | 26 | 13 | 1.6 s |
| Scrap Cleaver | 18 | 9 | 1.1 s |
| Pressure Vent | 15 | 7.5 | 0.9 s |
| Kickstart | 12 | 6 | 0.7 s |

**The fodder dies inside its own openings.** The four whites together do
about 25 dps. The table shows mean damage landed inside an enemy's window with
no push, and with one push. It assumes each part is ready 25% of the time and
otherwise has a uniform random time left on its cooldown.

| window | length | ×dmg | no push | 1 push | 2 pushes | target HP |
|---|---|---|---|---|---|---|
| hulk recover | 760 ms | 1 | 34 | 56 | 69 | 30 (elite 60) |
| mites' clump | 800 ms | 1 | 34 | 56 | 69 | 8 each |
| ram stun | 1200 ms | 1.5 | 64 | 95 | 112 | 36 (elite 72) |
| Arbiter vent | 1200 ms | 1.5 | 64 | 95 | 112 | 900 |
| Assembler stun | 1700 ms | 1.5 | 79 | 108 | 122 | 900 |

Fodder windows already out-damage fodder HP, and HP can't go up ("deeper
means more varied, never stronger"). Boss windows are 3-9% of the boss, so a
push adds about 3% of the boss and nothing changes.

**The exchange rate.** Brace sets the game's own price: 8 integrity = 1 strain.
A push (2 strain) has to save **16 HP** to break even. In the crawl, HP comes
back: half of what's missing at every quiet, all of it at every depth. Waiting
2 s for a cooldown against a pack doing 2-5 dps costs 4-10 HP, and the quiet
gives half of that back. So **a push in the crawl pays about 1/6 of its
price.** Only at a boss, where nothing comes back until the end, can a push
meet the rate.

**The free band.** About 6 quiets on each of depths 1, 2, 4 and 5, plus one
after each boss, gives **26 quiets a run, so 26 free pushes, about one a
minute.** At 0.2 pushes a fight, 80%+ of those refunds land on a strain of 0
and are wasted.

**Strain's memory is one depth.** Six quiets a depth can refund 12 strain. A
push above the band only carries into the next depth if it happens after the
depth's last few quiets.

**Stopped today.** Strain model: 26 fights, Poisson pushes per fight, quiet
−2, shrines as built (75% of levels, half Rest, half Plenty). The Broke column
is a crude hazard model, shown only for completeness.

| pushes a fight (sustained) | Stopped | peak strain p50 / p90 | strain entering depth 6 |
|---|---|---|---|
| 0.2 (the owner) | **0%** | 4 / 6 | 0.1 |
| 0.6 | 0% | 6 / 10 | 1.2 |
| 1.0 | 14% | 12 / 20 | 5.2 |
| 1.2 | 36% | 16 / 20 | 7.3 |
| 1.5 | 73% | 20 / 20 | 9.7 |

Adding half a push per fight moves Stopped from 14% to 73%. **Demand spread
evenly across the crawl can't be tuned**, because a small change in how often
the game asks swings the ending. Demand concentrated in fights with no refund
inside them (the bosses) can be tuned, because it's a budget: at strain s you
have `ceil((20 − s) / 2)` pushes before Still stops.

**The starting pool has no push-shaped part.** The one-time hint in
`hud.ts` only fires for `overrun` and `charge` mods: Overrun and Patient
Lens. Neither is in `STARTER_POOL` (`src/pool.ts`). Unfound blues come from
elites (25%), Plenty (25%) and the boss (25%): about 2.5 unfound blue draws a
run, and 2 of the 12 unfound blues are push-shaped. That makes **P(the hint
is ever seen in run 1) about 0.2.** The first ask most players meet is the
Arbiter's heat, at about minute 24 of 26.

**One part already makes Stopped reachable: Overclocked Coil** (+1 per cast,
1.2 s cooldown). Fired on cooldown through a 10 s fight it adds +8, or +6
after the quiet, so it stops Still in 3-4 fights. The economy works once a
part asks. Nothing else does.

---

## 1. Demand: moments that ask for a push

### D1. Cracks: boss openings with a line to reach

Each boss opening gets a damage line that has to be crossed **within that
one opening**. Cross it and the boss loses something for the rest of the
fight. The Assembler: 100 damage (after its ×1.5) inside the 1.7 s stun cracks
a stack, and each crack removes one move (barrage, then magnet, then sweep; at
most 3). The Arbiter: 90 inside the 1.2 s vent cracks a lens. The first crack
means phase 2 has one wedge instead of two, the second removes the reversals.
HP stays 900 and no hit gets bigger. Cracking only takes threats away, so
skipping it is a longer, harder fight, not a lost one.

- **The player does:** bait the charge into a wall, then either come in with
  every part saved (banking, which is free but gives up uptime before the
  opening) or spend them before and push them into the opening (+2 each).
  That's the decision the game lacks today: **bank, or spend and push.**
- **Numbers (four whites):**

  | | no push | 1 push | 2 pushes | all four banked |
  |---|---|---|---|---|
  | Assembler, line 100 in 1.7 s | 28% | 72% | 95% | 121 (cracks) |
  | Arbiter, line 90 in 1.2 s | 19% | 61% | 92% | 121 (cracks) |

  Value: the Assembler uses each move about every 12-15 s. Removing one with
  60 s left prevents 4-5 uses, at about 40% hit rate × 14-22 damage, which is
  25-45 HP. That's 1.5-3× the 16 HP break-even for one or two pushes. The
  Arbiter's second wedge about doubles phase 2's lances: roughly 6 fewer lances
  × 40% × 18 = about 43 HP, plus fewer heats.
- **Why Still:** "HP is the fight; strain is the run": this is the one place
  where the run's currency buys the fight's safety at a fair rate. Growth
  cracks everything and reaches depth 6 with less strain left. Comfort keeps
  strain and fights the whole boss.
- **Parts it changes:** Overclocked Coil becomes the Assembler's key (2 casts
  in 1.7 s = 84 × 1.5 = 126, for 2 strain, unpushed). That's fine for a rare
  gold that costs strain, but note it. Signal Flare plus a pushed Lens on a
  marked grill makes 52 × 1.5 = 78. Loadouts with no damage in the torso
  (Ward, Mirror, Lure, Anvil, Brace) or the legs (Skitter, Frost Trail, Spring
  Heels, Plumb Line, Borrowed Time) crack less. That's comfort showing up in
  the build, which is intended.
- **Cost:** medium. A per-opening damage counter on `Boss`, three move-list
  removals on the Assembler, two phase-2 switches on the Arbiter, and one crack
  effect each.

### D2. Elites read your buttons (surprising)

The symmetric rule, applied both ways: Still reads their windups, so elites
read his cooldowns. An elite ram only locks while Still's **legs** are cooling.
An elite sentinel or Lobber only locks while his **torso** is cooling. An
elite hulk only rears while his **legs** are cooling. Each waits at most 2.5 s,
then commits anyway. The lock itself is telegraphed and committed exactly as
today. Only the timing of the lock changes: it comes when your answer is dark.

- **The player does:** baits. Fire the dash on purpose, the elite commits, and
  then either walk out or push the dash. The walk-out is real. The ram's lock
  lasts 405 ms, plus d/18 s of rush: from 3.5 u that's 600 ms. After a 250 ms
  reaction, that's 1.9 u of walking at 5.5 u/s against a 1.12 u half-lane
  (`hitHalf` = 0.6 + 0.1 + 0.42). So the push is insurance, and the thought
  comes up every time: *"it's coming and my dash is down."*
- **Numbers:** elites per run are 1, 1, 2, 3 at depths 1, 2, 4, 5
  (`1 + floor((d−1)/2)`), so 7. About 3 commits each gives about 20 asks a run.
  If players push about 30% of them, that's 6 pushes, mostly inside the free
  band. The ram's rush (14) and the hulk's slam (9) are under the 16 HP
  break-even, so this is an ask players can turn down, not a tax.
- **Why Still:** no new enemy. It's the same four archetypes being
  "different, not stronger", and the rule is symmetric. The elite is where the
  crawl asks, and it happens 7 times a run.
- **Parts it changes:** Skitter (3.2 s legs) is the least exposed legs part,
  Kickstart (8 s) the most. Plumb Line's live anchor (cooldown `'hold'`)
  should count as ready, or it's always exposed. Ward and Mirror Ward are more
  exposed to elite sentinels.
- **Cost:** medium. `EnemyCtx` needs a per-slot `ready(slot)` from the HUD,
  plus one extra condition in three lock checks, only when `elite`.

### D3. Heat, taught at depth 5

A Lobber shell that lands on Still heats one button for 3 s, using the same
`hud.heat` and `pickHeat` the Arbiter already uses (4 s there). Today the heat,
the one built ask, first appears at depth 6 with a one-time caption, inside the
hardest fight. Moving the first heat to the Lobber lesson room at depth 5 lets
it be learned where it's cheap.

- **Numbers:** Lobber 10 damage, r 1.6, 1000 ms flight, reload 2400. About
  2-4 Lobbers a level at depth 5 (`lobberPacks` 3 plus the lesson) means 1-4
  heats a level, each one a push-or-wait moment of 3 s. A heated slot is always
  the longest-cooldown ready one, so waiting it out costs most of a cast.
- **Why Still:** Lobbers are the Arbiter's shells in small, and this is the
  same rule in small. It teaches the boss honestly, the way the ram teaches the
  Assembler's charge.
- **Parts it changes:** none. Mirror Ward and Ward still don't stop shells.
- **Cost:** cheap. One emit on a Lobber shell hit, and the caption moves with
  it.

*Tested and rejected: cracks on elites.* Elite HP (40-72) is about the same as
one opening's unpushed damage (34-64), so a crack would just be a kill, and
the push saves one attack (9-14 HP), under break-even. Elites ask through
timing (D2), not through burst.

---

## 2. Reward: pushed forms worth wanting

### R1. Pushed damage cracks double

A rule for every part: a pushed cast's damage counts ×2 toward a crack (D1),
and not toward HP. Outside an opening a push is exactly what it is today, so
there's nothing to do on autopilot in fodder fights. Inside an opening, one
push is what closes the gap.

- **Numbers:** at D1's lines, a single push cracks 99% of the time. That *is*
  autopilot, so R1 needs higher lines:

  | line | no push | 1 push | 2 pushes | all four banked |
  |---|---|---|---|---|
  | Assembler 130 | 0% | 63% | 93% | 121 (fails) |
  | Arbiter 120 | 4% | 72% | 100% | 121 (just) |

  With R1, banking stops working and cracks become push-only. That's the dial:
  **without R1 it's bank or push; with R1 it's push or skip.** I'd build D1
  without R1 and add R1 only if the phone shows banking crowds the push out.
- **Why Still:** the push is paid out only where the enemy has committed too.
  Committed for committed.
- **Parts it changes:** Patient Lens's pushed shot (32, then 64 toward a
  crack) becomes the best head part for cracking.
- **Cost:** cheap. One multiplier on D1's counter.

### R2. More pushed halves, and two in the starting twelve

Give three more blues a pushed half that's a *different move*, the Overrun
model, not a bigger number:

- **Parry Clamp (A4):** pushed, a 5 u lunge the way you're steering. If it
  ends within reach of a windup, it breaks it. It reaches a sentinel at 6-10 u
  and a Lobber mid-tilt. It follows the stick, so it isn't melee magnetism.
- **Mirror Ward (T6):** pushed, it also catches shells (Lobber, Arbiter).
  That's the only answer to a lob, and it's push-only.
- **Signal Flare (H6):** pushed, it lands in 150 ms instead of 800, so a mark
  can land inside an opening (a 760 ms hulk recover, a 1.2 s vent).

And swap two of the starting blues for the two push-shaped ones that bend the
same whites just as plainly: **Patient Lens for Cracked Lens** (both bend
Focusing Lens) and **Overrun for Skid Plates** (both bend Kickstart).

- **Numbers:** push-shaped parts go from 2 to 5 of 30. P(a four-slot loadout
  holds at least one, uniform by slot) goes from **0.23 to 0.52**. P(the hint
  is seen in run 1) goes from about 0.2 to about 0.8, since both now drop from
  ordinary kills from depth 1.
- **Autopilot:** each pushed half only matters against one kind of threat
  (ranged windups, shells, openings). Where that threat is missing, the push
  does nothing extra.
- **Why Still:** tiers mean *different*. The pushed half is a second button
  inside one part.
- **Parts it changes:** Ward (T2) still says "not shells", and pushed Mirror
  Ward outclasses it against Lobbers, but only for 2 strain. Parry's unpushed
  snap is unchanged. Cracked Lens and Skid Plates become found parts, which
  doesn't break them.
- **Cost:** medium for the three mods (data plus a `useAbility` branch each,
  and the hint list in `hud.ts`). The pool swap is cheap: one line in
  `pool.ts`.

### R3. The last push is the whole of him (surprising)

The push that takes strain to 20 lands at ×2, and every hit of it counts
toward a crack. If it fells a boss, Still stops in the warm beam's light: the
Stopped ending, warm. Today the last push is shown dim and slow on purpose
(`hud.ts`: "the last push is honest"). This turns it into the brightest cast
in the game.

- **Numbers:** at 18-19 strain against an Arbiter at 10% (90 HP), one ×2 Lens
  in the vent does 26 × 2 × 1.5 = 78. It's at most once a run.
- **Why it matters for the invariant:** it gives Stopped a reason to be
  *chosen*. At the threshold, spending the last of Still is the right call
  when it finishes the thing, and the ending keeps everything anyway.
- **Risk:** it's next to the parked "strain makes Still stronger". It's one
  cast, only at the line, so I'd put it to the owner as a tone question, not a
  numbers one.
- **Cost:** cheap for the ×2. Medium for a warm Stopped arrival.

---

## 3. The thought coming up

### T1. The ask: a crack ring, and the buttons that would close it

During a crack opening, the boss shows an ember ring (enemy colour) that fills
with damage dealt in the opening, with one notch at the line. Any **cooling**
button whose cast would close the remaining gap lights its existing
`pushable` rim for as long as the opening lasts. A button with no chance of
closing the gap stays dark.

- **Numbers:** 1-2 buttons light per opening, about 6 openings at the
  Assembler and 8-10 at the Arbiter, so about 15 asks a run, and none in
  fodder fights. It's the "you need 26 more and your Lens is 2 s out" moment,
  shown as one lit button.
- **Why Still:** the button is where the push lives, so that's where the ask
  should be. The ring is ember because it belongs to the enemy.
- **Cost:** cheap to medium. The `pushable` and `hint` classes exist; it needs
  one gap query to `Combat` per frame during an opening.

### T2. The free push, drawn (surprising)

The strain bar draws the next quiet's refund as a hollow two-pip segment. At
strain 0 that's a cold outline at the start of the bar. Push once and it fills;
at the quiet it empties with the chime. Push a second time and that pip lands
past the outline, solid ember, and it stays. No document says the band is
free, and nothing on screen does either.

- **Numbers:** 26 hollow segments a run. Today's player wastes 21-26 of them.
- **Autopilot:** yes, players will spend the free one without thinking. That's
  harmless: it's free by the rules already, and it teaches the 180 ms hold.
  The *second* pip is the decision, and the bar shows it differently.
- **Cost:** cheap (the HUD strain bar).

### T3. Openings are heard

Every crack opening (D1) and every heat (D3) plays one shared sound: a held
low note that lasts exactly as long as the opening and cuts dead at its close.
The windup tone is already "a second telegraph", and this is the same idea for
the other side of the cycle. You hear how long you have left, and so whether a
cooldown will make it.

- **Cost:** cheap (`audio.ts`, one voice, keyed to the opening's timer).

---

## 4. The economy, only as it serves 1-3

No cost changes. I tested "a quiet only refunds this fight's pushes". At a
sustained 1.0 push a fight it moves Stopped from 14% to 52%, because it
punishes the variance in pushes, not the choice to push. **Rejected.**

### E1. The gate room holds the elite (surprising)

Put each depth's last elite in the last main room before the exit. Strain's
memory is one depth, and the exit room is the only fight with no quiet after
it, so pushes above the band there carry into the next depth instead of being
washed out.

- **Numbers (with D2):** strain entering depth 6 goes from about 2.0 to 3.8
  for a balanced player and from 4.1 to 6.7 for an engaged one. That's 1-2
  fewer pushes at the Arbiter before Still stops.
- **Cost:** cheap (the elite pick in `dungeon.ts`).
- The exit stays open (settled). This only moves where the elite sleeps.

### Is Stopped reachable in 6 depths?

The run model: 26 fights, asks per fight (Poisson), and a player type = how
often they answer an ask (π) and how much strain they refuse to spend past
(crawl/boss). The Broke column uses a crude hazard (+2% per boss ask turned
down, +1% per elite ask turned down, on 6% / 8% bases). Read Stopped and
entry strain as the output. Broke is only there so the rows add up.

| config | player (π, keeps back) | Broke | Home | Stopped | entering d6 |
|---|---|---|---|---|---|
| today | 0.2 pushes a fight | 17% | 83% | **0%** | 0.1 |
| bundle, Arbiter 8 asks | comfort (0.3, 6/4) | 36% | 64% | 0% | 0.0 |
| | balanced (0.6, 4/0) | 29% | 71% | 0% | 0.3 |
| | engaged (0.75, 4/0) | 23% | 74% | 3% | 0.8 |
| | all-in (0.9, 0/0) | 18% | 63% | **19%** | 1.8 |
| bundle, Arbiter 10 asks | engaged | 23% | 64% | 13% | 0.8 |
| | all-in | 15% | 35% | **50%** | 1.8 |
| bundle + D2, Arbiter 8 | balanced | 31% | 62% | 7% | 2.9 |
| | engaged | 23% | 47% | **30%** | 5.0 |
| | all-in | 13% | 15% | 72% | 6.0 |

What this says:

- **Today Stopped is structurally unreachable** for the way the owner plays.
- **The Assembler never stops anyone.** Players arrive at 0-2 strain and it has
  about 6 asks (12 strain at most). Stopped lives at the Arbiter. If the owner
  wants it possible at depth 3 as well, the lever is Plenty (+4) on depth 2, not
  more asks.
- **The dial is the Arbiter's number of crack openings** (8 → 10 takes all-in
  Stopped from 19% to 50%).
- A player who keeps 2-4 strain back at the bosses is never Stopped
  (0% in every config). So Stopped only happens to players who chose to answer
  every ask. It's reachable, it's chosen, and it's never a cascade.
- **Growth vs Comfort holds:** comfort has the most Broke (36-41%) and no
  Stopped. All-in has the least Broke (13-18%) and most of the Stopped.

---

## Recommended bundle

**D1 Cracks + R2 More pushed halves (with the starter swap) + T1 The ask.**

- **D1** makes the boss the place where a push pays its price (1.5-3× the
  16 HP break-even), and puts the bank-or-push choice where it can be tuned as
  a budget.
- **R2** is the crawl half. Pushed halves that are different moves, and two of
  them in the starting twelve, take P(hint seen in run 1) from about 0.2 to
  about 0.8. The pool swap is one line: do it first, whatever else happens.
- **T1** is how the ask reaches the thumb: one lit button, only when that push
  would close the gap.

Build order: the pool swap (minutes), then D1 on the Assembler only (one
boss, one evening), then T1, then the Arbiter's cracks, then the three pushed
halves. After the Assembler, check on the phone whether pushes a run (the
`__runStats` `pushes` column) go from about 0 to 4-8. If the crawl still never
asks after R2, **D2** is next, and **E1** comes with it.

**Numbers to lock on the phone:** the two crack lines (100 / 90), the
Arbiter's openings per fight (the 8-10 dial), D2's 2.5 s wait, and whether
banking all four for a 1.7 s stun is doable with thumbs (the model assumes it
is).
