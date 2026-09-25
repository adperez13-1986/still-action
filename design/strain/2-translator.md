# Round 2: Translator

I read the other three round-1 files. This one covers what I'd keep or cut
from them, where I changed my mind, the four tensions, and the final bundle.
The lens is the same: a 6-inch phone in landscape, with the right thumb on a
four-button arc.

## Where I changed my mind

- **My D1 (a miss is an opening) is not demand.** The balancer's window table
  settles it: without a push, fodder already takes 34 damage in a 760 ms
  window against 30 HP. Adding x1.5 makes waiting even cheaper. It's a feel
  idea. I'm cutting it from the bundle.
- **My R1 (held open) only matters at bosses**, since fodder dies in the
  window anyway. At bosses, the balancer's cracks and the verifier's grill
  locks do the same job better, because they give the player a target to
  hit. Cut.
- **The core reward is "a push breaks a wind-up"** (verifier R1, Claude C-R1,
  and the balancer's pushed Parry). Three voices arrived at it on their own.
  It gives the push one meaning across all 30 parts, and it lives in the
  wind-up, which is where the eyes already are. I missed it. Keep it. But it
  has a latency problem, and (b) below is how I'd fix it.
- **My E1 (the waterline) gives way to the hollow pips** (balancer T2,
  verifier E2). Their version shows the one fact mine hid: at strain 0, an
  unused refund is simply wasted.

## Keep, cut, defer (the others' pitches)

| pitch | call | why, on the phone |
|---|---|---|
| Bal. R2: pool swap (Patient Lens, Overrun into the starting 12) | **keep, first** | One line. It takes P(the hint is ever seen in run 1) from about 0.2 to about 0.8. |
| Bal. R2: pushed halves (Parry, Mirror, Signal) | defer | Pushed Parry turns into R1 anyway. Pushed Mirror catching shells is good; do it after R1. |
| Bal. D1 cracks / Ver. D3 grill locks | **keep, merged** | Four notches on the boss bar, one per slot, map straight onto the four buttons, so an unlit notch *is* the button to push. The locks are the tell; the balancer's reward (lose a move) is the payoff. Assembler first. |
| Bal. D2: elites read your buttons | defer | It's crawl demand and tunable (7 elites). It needs a visible tell (the elite's eye turns to your dark button), or the elite reads as cheating. |
| Bal. D3: heat taught at the Lobber | keep | Cheap and honest. But heat is compulsion, not want, so spread it no further than that. |
| Bal. R3: the last push is the whole of him | the owner's call | It's close to the parked "strain makes Still stronger". I lean no. The dim last push was deliberate. |
| Ver. R2: a push aims at the threat | **keep, part of R1** | Without it, a pushed Cleaver swings at the idle hulk beside you, not at the one rearing. On a phone you can't aim, so the break rule depends on this. |
| Ver. R3: pushed whites borrow their blue | cut | It erodes the blues and competes with R1 for what a push means. |
| Ver. R4: a push is remembered | defer | Lovely, but it's meta. Build it after R1 exists, and it needs a save migration. |
| Ver. D2: the linked pair | cut for now | Two locks together are exactly what a 6-inch screen reads worst. It reopens a readability decision. |
| Ver. T1 / my T3: the dead tap answers and counts | **keep, first** | The two are the same pitch. The `deadTaps` counter is what tests the owner's diagnosis. |
| Claude C-D2: the caller | defer | It's a good crawl clock, but it contradicts "No chain-waking" in `DESIGN.md`. |
| Claude C-R2: a well-read push is free | cut | See (c). |
| Claude C-T1 / Ver. T2 / my T2: the answer is lit | **keep, merged** | Details below. |
| Claude C-T2: teach at the first crack | keep, small | It moves the existing one-time hint to a moment that matters. |

**My D4 (the thief goes down a grate):** withdrawn. It reopens a settled line
in `design/content/DESIGN.md` to create demand the break rule creates for free.
If the crawl still lacks a *clock* after the bundle, D4 and Claude's caller come
back as a pair and the owner picks one.

## The four tensions

**(a) Crawl or bosses.** Both, doing different jobs. The owner's complaint is
felt in the crawl: it's 20 of the 26 minutes, and many runs never reach the
Arbiter. So the crawl has to *ask*. But its asks should be sized to the free
band, one good moment a fight, and the balancer's own table shows that zone
is flat: 0.6 pushes a fight gives 0% Stopped. The steep part (1.0 to 1.5) is
where strain builds, and that is the bosses' job: cracks there are the
*bets*, a budget you can tune. The balancer's model also assumes Poisson
pushes. A player who can see the band (the hollow pips) doesn't push at
random; they push to the edge of the band and stop. Visible pips should
shrink the variance that makes crawl demand untunable. That's a claim to
check with `__runStats`, not something I can prove from here.

**(b) 430 ms against a 405 ms lock.** As built, "a push breaks a wind-up" will
mostly feel like a buzzer: you saw it, you held, and you were late. The
verifier's table leaves 90 ms against a hulk. That breaks the invariant, since
a missed break should never feel like failing a test. The fix is in the
gesture: **cock, then release.**
- Hold a cooling button for 180 ms and it *cocks*. It doesn't fire. The rim
  closes ember, Still's cage glows, and a low grind hum loops.
- **Release fires the push** at once. The +2 is paid on release, not before.
- **Slide the thumb off the button and it uncocks, for free.**
- If the cooldown finishes while it's cocked, the pips go out, and a release
  fires it as a normal, free cast.

So the thumb *prepares* on the anticipation cue (the hulk rearing, the ram's
faint rails, the sentinel's lens swelling) and fires on the commit cue (the
ram's latch, the sentinel's click). Reaction time drops to a release, about
250 ms. Against a hulk that leaves about 270 ms, against the ram's lock about
155 ms (tight, which makes it a parry), a Lobber about 370, the mites about
300, and a sentinel about 500. The verifier's 2x bolt speed becomes
unnecessary.

The feel is right for Still. Holding *is* straining: while one button is
cocked, the right thumb can't press any other, so the price is in your hand
before it's on the meter. It also settles half of "hold means two things":
a hold on a cooling button cocks it, and a hold on a ready one is left for
aim. The one loss is a push "right now" with no threat: it takes the release
too, about 50 ms slower than today.

**(c) Refunds and Stopped.** Cut C-R2. A free push for a well-read push means
an engaged player pushes every breakable wind-up at zero cost. That is
autopilot, and it removes the bet, so Stopped becomes unreachable for exactly
the player the ending is for. My R3 (the last word) is different and safe: it
**adds no refund**. It only moves the quiet's existing −2 to the killing blow
(time at 30% for 400 ms, cold motes flying back to the meter). Net strain
doesn't change. I'd still defer it until after the bundle.

**(d) Legibility first?** Yes, as **evening zero**, not as the fix. It is the
cheapest step: the dead tap answers and counts, the cooling button shows its
price (●● on the rim, the sweep eased from .78 to .5), the hollow house pips,
and the pool swap. Then play three runs and read `deadTaps` and `pushes`. But
the owner's words ("the thought never comes up") and the balancer's 1/6 price
ratio both say legibility alone will show him something not worth doing. On
its own it can't make him want to push. The break rule has to follow.

## The answer is lit (merged T pitch, phone specifics)

The thumb pad covers the middle of a 60 px button, so nothing drawn inside the
button can be seen at the moment it matters.
- **Rim:** a 3 px ember arc drawn *outside* the button (inset −5 px, like
  the LIVE ring), circling once every 600 ms. Peripheral vision picks up
  motion, not colour.
- **One button only:** the part that could break the wind-up that lands
  soonest.
- **Buzz:** one 8 ms vibration when that button lights.
- **Still looks:** his lens stalk swings to the threat in 80 ms. That's the
  channel for the eyes, which are on Still, not on the corner.
- **Sound:** Claude's version, the button wearing the tell's own ember
  texture, carries the sound across too. The latch tick plays in the button's
  stereo position.

## Final bundle

0. **Evening zero:** the pool swap, the dead tap answers and counts, the price
   on cooling buttons, and the hollow house pips. Play three runs and read the
   counters.
1. **A push breaks a wind-up, and aims at it,** with **cock and release.**
   Verifier R1 plus R2, and my gesture. About 1.5 evenings plus phone tuning.
2. **The answer is lit:** the outer rim, the buzz, Still looks, and the tell's
   own texture. About 1 evening.

**Next:** the Assembler's grill locks with crack rewards. The boss is where
strain gets bet, so that's where Stopped becomes reachable. Then the
balancer's elites read your buttons, if the crawl still asks too rarely.

**The first phone test:** can you cock the Cleaver as a hulk rears and
release it on the slam, from rest, 8 times out of 10? If you can't, no break
rule will feel good, whatever the numbers say.
