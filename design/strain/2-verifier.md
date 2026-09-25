# Round 2: the Verifier

I read the other three round-1 files and checked their claims against the
code. Costs are in vibe-coding evenings.

## Claims checked

- **Confirmed.** Everyone's code facts hold:
  - the translator's arc (`ARC_R = 132`; `DESIGN.md`'s "r96" is out of date),
    the `.78` cooldown sweep, and the 0.93 press scale as the only hold feedback;
  - the balancer's `STARTER_POOL` (Cracked Lens and Skid Plates in it, no
    push-shaped part), the elite count `1 + floor((d−1)/2)`, the ram's
    `hitHalf`, and Brace's 8:1;
  - Claude's "anything cashes the ram's stun".
- **Balancer D3 is as cheap as claimed.** The Lobber heat needs `heat: true`
  on the shell's `Hazard`. `main.ts` `onHazard` reads `ARBITER.heat.ms`, so the
  duration has to come from the source.
- **Translator D1 (a miss is an opening) creates no demand on its own.** With
  the balancer's table, a stuck hulk takes 34 on average with no push (the
  Cleaver's 27 plus one auto at ×1.5) against 30 HP. It makes fights easier,
  and still doesn't ask for a particular button, the same problem as my
  finding 2.
- **The translator's magnet (D2) is already nearly unwalkable.** Walking at 5.5
  against a 3.3 pull nets 2.2 u/s. Over 1.5 s that's 3.3 u against r3.6, so
  only the outer 0.3 u is walkable today. The pitch is mostly the second ring.
- **One correction to the balancer's exchange-rate argument.** "A push saves 9–14
  HP against a break-even of 16" only holds *above* the band. The first push each
  fight is paid for by a refund that the balancer's own numbers show is wasted
  80% of the time. Its real price is zero, so any positive value should be
  taken. The owner doesn't take it for two reasons: the value is half a cast,
  and nothing shows that the push is free.

## Cut

- **C-D2 the caller.** It chain-wakes a pack, and `DESIGN.md` (crawl) settled
  "No chain-waking".
- **Balancer R3 (the last push as the whole of him).** It makes Stopped a
  choice. `meta/DESIGN.md` settled "No 'Sit down'. Stopped stays something that
  happens to Still." It also sits right next to the parked "strain makes Still
  stronger".
- **C-R2 (a well-read push is free).** It turns the cost down, and the owner
  says cost isn't the problem. A good reader could push without limit, which
  drops strain out of the run for exactly the players who engage. See (c).
- **Translator R4 (reach ×1.5), and my R3 (borrow the blue).** Both are
  always-on, so both run on autopilot and wear away the blues (Rusted Hook,
  Spring Heels, and all 8 bends).
- **My D2 (the linked pair).** It's the only pitch that reopens a readability
  decision, and D-cracks at the bosses does its job more cheaply.
- **My D3 (four locks).** The balancer's cracks (D1) is the same idea with a
  sim behind it and no need for four presses with one thumb. I take the
  balancer's version.
- **Translator R1 (held open).** It stacks with cracks and would make them
  trivial. Pick one opening reward; cracks is the one with numbers.

## Keep

- **Everyone's legibility fixes:** translator T1 (a cooling button that isn't
  dead, with 2 hollow ember pips) and T3 (the dead tap answers, the hold gets a
  180 ms clock ring), which merges with my T1. The waterline (translator E1),
  the free push drawn (balancer T2) and my E2 are one pitch in three voices.
  Build the translator's tick with the balancer's hollow pips.
- **The balancer's starter swap:** Patient Lens for Cracked Lens, Overrun for
  Skid Plates. It's one line. It changes the pool the meta design picked, so
  it's the owner's call.
- **C-R1 = my R1 (a push breaks).** Two voices got there independently. Claude's
  C-T2 (teach at the first breakable windup, not the first cooldown) replaces
  the hint trigger in `hud.ts`.
- **Later:** translator D4 (the runaway) is the best crawl demand anyone
  pitched. It's the only stake the quiet doesn't refund: a part you can see
  leaving. It's cheap, but it reverses "It never leaves the level" (content
  DESIGN, not on the brief's settled list), so the owner has to decide.
  Balancer D2 (elites read your buttons) comes after it.

## Where I changed my mind

**The ram.** In round 1 I compared the 430 ms push to the 405 ms lock, and that
mixed up two different answers. *Breaking* the ram after the lock is
impossible: the hit has to land within 405 ms. *Leaving* the lane isn't: the
rush still has to travel (d/18 s). From 3.5 u that's about 600 ms in total. A
pushed dash needs 430 ms, plus about 50 ms to cross the 1.12 u half-lane, so it
lands with about 120 ms to spare. A pushed leg answers the ram from any
distance over about 1.4 u.

## Positions on the four tensions

**(a) Crawl or bosses.** The owner is right about where the complaint lives,
because the crawl is about 90% of the run. The balancer is right that asks
*above the band* can't be spread over the crawl: Stopped goes from 14% to 73%
between 1.0 and 1.5 pushes a fight. But that model pushes blind. In its own
second model, a player who holds 2–4 strain back is never Stopped. Split it:
- **The crawl asks for the free push.** R1 breaks, D4 later, about one a fight,
  and paid for by the refund.
- **The bosses ask for the paid ones.** Balancer D1 cracks, where it works as a
  budget.
- **The waterline** is what lets the player keep themselves inside the band.

**(b) What a push can answer.** A push lands about 430 ms after the tell (180
ms hold plus a 250 ms reaction).

| enemy | break (R1) in time? | leave in time? |
|---|---|---|
| hulk 520 | barely (90 ms): arcs and novas only | walking always works |
| sentinel 760 | yes: arcs, novas, a bolt within 8.6 u | walking after the freeze |
| ram 900 | only from the tracking, never after the lock | yes, with a pushed leg over 1.4 u |
| Lobber 620 + 1000 flight | 190 ms: instant parts | yes: 1000 ms of flight |
| mites 550 | 120 ms: a nova or an arc, per biter | yes |

Change no windup. `windupMs` is "the most important number", and the
telegraph rule has to stay. Two changes that keep the rule:
- **Make the ram's tracking readable.** The rails are faint on purpose, and
  catalog Q4 already asks about them. That's a tell change, not a timing change.
- **Measure before touching the hold.** Log how long pointers stay down on the
  Poco. If 95% of real taps are under 110 ms, drop `PUSH_HOLD_MS` from 180 to
  140. That doubles the hulk's margin, and taps still don't push by accident.
  Otherwise, leave it at 180.

Pushed bolts at 2× speed (from my R1) still stand.

**(c) Refunds.** C-R2 makes Stopped *harder* to reach: the balancer's model
already puts the owner at 0%, and a refund can only lower that. Cut it.
Translator R3 (the last word) isn't a refund. It fires the quiet on the blow
instead of 2.5 s later, and the −2 is the same. It has no effect on Stopped.
It's a cheap bit of feel for later.

**(d) Legibility first, as its own step: yes.** It's cheap, it changes no
rules, and it's the control for everything else. One caution: the owner
designed the push, so legibility alone may not move his numbers. That's still
a result. If pushes stay about 0 with the price, the clock and the waterline
all visible, the missing piece is value, not knowledge, which confirms his
diagnosis.

## Final bundle, in three steps

| step | what | cost | the test on the phone |
|---|---|---|---|
| 0 | legibility: cooling pips and a lighter sweep, the dead-tap answer and the 180 ms clock ring, the waterline with hollow pips, the starter swap (if the owner agrees), `deadTaps` and a tap-duration log beside `pushes` in `__runStats` | 1 evening | 3 runs: pushes a fight and dead taps a fight, against today's baseline of about 0.2 |
| 1 | R1 a push breaks (pushed bolts 2×, the reel at ×1.5), R2 a push aims at the soonest windup, C-T2 the hint at the first breakable windup | 1.5 evenings | pushes a fight near 1, and Stopped still unreached |
| 2 | balancer D1 cracks on the Assembler, then the Arbiter; balancer D3 the Lobber heat at depth 5 | 1.5–2 evenings | pushes at bosses; how many Arbiter openings Stopped takes (8 vs 10) |

That's about 4–4.5 evenings in all. Most of the real cost is tuning on the
Poco, not code. Step 1 is the one that matters, but step 0 goes first because
its numbers show whether step 1 worked.
