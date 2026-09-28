# Round 1: the balancer

28 Sep 2026. Sources: `playtest.json` (33 records; "pre" = 10 without the hand, "post" = 23 with it),
`tools/levels.json` (40 levels a depth), `src/abilities.ts`, `src/combat.ts`, `dropsim --lean all --runs 4000`.

## "Too easy", in numbers

**Free output a second** (sustained, on cooldown; AoE counts are my guess: Vent 2.5 bodies, Cleaver 1.75, Kickstart 2):

| source | single target | on a pack |
|---|---|---|
| hand, 10 / 0.62 s | 16.1 | 16.1 |
| eye planted, 8 / 0.62 s, pierces | 12.9 | 12.9 per body in line |
| Lens 26/4.2 + Vent 15/6.5 + Cleaver 18/2.6 + Kickstart 12/8 | 16.9 | ~27 |
| **hand + four whites** | **33** | **~43** |

**What arrives** (census): pack HP 77 / 73 / 108 / 135 at depths 1 / 2 / 4 / 5, with 1 / 2 / 4 / 4 buttons
lit. Contact-time kill: **3.5 / 2.5 / 2.5 / 3.1 s**. The player's power and the pack's HP grow at the
same rate, so time to kill is flat all run. A hulk's first strike lands ~1.8 s after it wakes (8 u at
4.3 u/s + 520 ms), so each hulk gets 1-2 windups before the pack is dead, and the hand breaks ~84% of
those in reach (the leanings sim). A planted Still takes 0 of 10-11 sentinel shots (headless check).

**What a push adds:** one early cast, ~26-37 damage = **0.7 s** of free output in a crawl fight, and
the break it could buy is already bought by the hand for 0 strain. At the Assembler, a push is ~2.9%
of 900 HP; 10 strain buys ~14% (8-12 s off a 56-93 s fight). Bosses can't be broken, so a push never buys defence there.

**The log agrees:**

| | pre-hand (10) | post-hand (23) |
|---|---|---|
| crawl pushes a fight | 0.47 | 0.43 |
| pushes a boss fight | 3.4 | **1.0** |
| max strain, median | 12 | **3** |
| Stopped | 1 | **0** |

The strain floor landed the same day and should *raise* strain, so the drop is if anything under-credited to
the hand. His last run: autos did a nominal **646 of the Arbiter's 900** (72%, 590 from the hand), 0 pushes;
at depth 5, 830 nominal against ~810 HP of packs fought (overkill included). Depth 5 had 30 hand breaks.

**His observation 3 is half right.** Riders fired 10 times in that run against 10 pushes; they are a
small substitute today. The hand is the big one: it is a free, un-priced push on the beat.

## The nine rules

| # | failure; same here? | verdict | evidence | precedents |
|---|---|---|---|---|
| 1 Two leanings first | Still's 4 styles, 1 supported. Yes, content spreads the same way in real time | **keep** | committed chooser forms 98% / 99%, random 22% | Hades ships every god complete; Dead Cells colour trees. Transfers |
| 2 Payoff triggered by the enemy | still-merge's board-scaled keystone. Half: here the enemy acts, but the free auto answers, so "enemy-triggered" became "free" | **rewrite** | 9-30 hand breaks a depth at 0 cost; riders excluded from pushes | Hades Doom/Deflect pay on *your* timed act against theirs |
| 3 No multipliers between parts | x9 stacking. Bounded here: 4 slots, one ability each, max chain ~x3. Already broken by Signal Flare (x2) and openings (x1.5) | **rewrite** | no power spike anywhere; TTK flat 2.5-3.5 s all run | D2 and Hades: multipliers *within a category*, capped. Transfers |
| 4 Every part has an opinion | 9 of 10 generically good. Same risk | **keep** | sim take rates 0.29-0.59 a run; the whites run high (Piston 0.59, Flare 0.56) | Hades boons, VS weapons |
| 5 No dead slot | Head/Legs overridden. Same risk | **keep** | post-hand casts head 589, legs 255, arms 227, torso 222; legs most pushed (59) | action games never have a dead dash. Cheap check |
| 6 No always-take | 78% Phase Blade. Same risk | **keep**, add a floor of 6 offers | Anvil 7/7 taken, Mirror Ward 9/12; Cracked Lens 2/19, Signal Flare 0/4 | Hades tolerates some; on 4 buttons one always-take removes a slot's choice |
| 7 One number never offence + defence | Wildfire lifesteal. **Happening now, through the autos**, which the rule was never applied to | **keep, extend** | the hand deals 10 and cancels the slam; the eye deals 8, cancels the shot, halves blows taken | Souls/Hades: poise and stagger immunity cap free interrupts |
| 8 Committing beats mixing | one dominant way. Same | **keep** | untestable while every loadout wins | Hades, D2 |
| 9 Something left to want | "coast from fight 5-6". **Happening**: floor takes a depth 3.6 / 1.5 / 0.3 / 0.67 / 0.22 (d1-d5) | **rewrite** | committed forms 98% by the Arbiter; depth 5 takes 0.22 | D2 / VS: evolutions and uniques give a late target |

**Rewrites:**
- **2.** "Every payoff is triggered by what the enemy does **and a price the player paid to meet it**:
  a position held, a button spent, or strain. A break the free autos make at no cost pays nothing
  extra." (Riders then fire on pushed breaks, the reverse of today's exclusion.)
- **3.** "At most one multiplier lands on a hit, and it comes from the enemy's state (open, marked,
  broken). Two apply: take the larger. Cap x2." It keeps the x9 impossible and allows a spike.
- **9.** "Something left to want **at depths 4-5**: each depth offers at least one pick that changes
  a button; measured as takes a depth >= 0.5 after the Assembler."

## Missing rules

1. **Demand.** "Free output (autos + parts on cooldown) clears a pack in no less than 2 of its threat
   cycles, and the free break answers at most ~30% of windups." Target: ~1 push a fight in the crawl
   (the free band), 4-6 at each boss.
2. **Price every free ready.** Anything that cancels a windup, readies a button or refunds a cooldown
   at no strain is weighed against a push (2 strain). The hand, the eye and riders all failed this unchecked.
3. **Enemies that change each other.** Every pack from depth 2 holds one body whose presence changes
   another's answer (observation 2). The Warden is a number (0.35x damage), not a changed answer.
4. **Pressure curve.** With pack HP never rising, pressure must rise in *simultaneous* windups: ~1 at
   depth 1, 2-3 at depth 5. Today it is flat.
5. **Boss check.** Autos alone deal <= 40% of a boss's HP (today 72% at the Arbiter).

## Hard constraints: flags only

- **"Deeper: never more enemy HP or damage"** (DESIGN.md, Depth). With the power curve from 1 to 4
  buttons, it is why TTK stays flat. Reads as a readability choice, but it removes one lever. His.
- **"No +X% anything"** and **"runs get wider, not stronger"** read as meta and affix rules. Applied
  inside a run they forbid any power spike, which Hades and Death Must Die rely on. Flag only.
- Telegraphs, symmetry, tiers, colour, premium: not hindering.

## Three changes, smallest first

| # | change | tied to | expected (guesses marked) |
|---|---|---|---|
| 1 | **Poise:** the hand or eye breaks a given enemy's windup at most once per 3 s (dial 2-4); pushes always break. One constant | obs 1 | hand breaks ~9-30 a depth -> ~1/3 of that (guess); crawl pushes 0.43 -> ~1 a fight; hulks land 1 slam a pack unless walked or pushed |
| 2 | **Riders fire on a pushed break**, still 4 s a part. A push that breaks gets its button back: 2 strain for two casts | obs 3 | leanings now *spend* strain; boss pushes 1 -> 3-5 (guess) |
| 3 | **One enemy that changes the answer:** a "caller" whose pack can't be broken by the autos while it stands; kill it first or push | obs 2 | one decision a pack; Stopped reachable. Model: ~10 strain at the Assembler, floor ~5, carried ~6 to the Arbiter; 7+ pushes there Stops him. Stopped ~10-20% of runs if he spends (guess) |

The Arbiter's autos share (72%) is the pass line after 1-3: under 40%, with no change to its HP.
