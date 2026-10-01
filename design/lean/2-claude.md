# Lean on the parts, round 2: Claude

## Changed

- **Ask 1: the balancer's numbers beat my framing.** I priced "HP xk, parts xk" as the bank's tax; the sim
  agrees for the never-melt player, but its pick (packs x1.25, bosses x1.1, torso/legs x1.5, area on vent/dash/
  Cleaver) keeps his pack time at 1.00 and still moves part kills 38 -> 45%. Stronger *in kind* is where it
  lands for him, as I argued; the HP is small enough not to matter. I drop "bigger packs instead of HP" as a
  replacement; it's a second dial, and the verifier's perf/k9 cost decides whether it's worth it.
- **Ask 3: I under-read the break.** 4 breaks in 118 pushes (the autos broke 77): the push almost never does its
  one special thing, because pressure hulks never wind up. So "every cast carries the push's effects" (all three
  others' V4) is nearly free, and it is literally his ask. I move from "threat aim only" to the full V4 (break +
  threat aim + the pushed look on every ready cast; Patient Lens, Overrun, Lure, Plumb Line keep push-only extras).
- **The gesture vs the decision: both.** The verifier is right that his long presses on a cooling button already
  push. But all 30 dead taps are under 190 ms: when he taps fast on a cooling button, nothing happens, silently.
  That is the "troublesome". Tap-to-push fixes exactly those.

## Holding

- **No strain on every cast.** All four agree, and the sim settles it (V1 +0.5 a cast: median Stopped 74%).
- **The drama is the trial most likely to change his hesitation.** The translator's timing findings are the
  core: the freeze fires on the press hit or miss (main.ts:3716), damage lands while the pose is still winding
  back, and every kill (the free auto's included) gets the biggest freeze (80 ms). Fix those first; no new
  particles.

## New worry: tap-push and the strain clock

The balancer's own Part B: V4 at pushes x1.5 takes the median Made-it from 74 to 56 (Stopped 28%), quiet -3 only
back to 64. Today's economy is only safe because he rarely pushes. If tap-push works as intended, he Stops more.
That isn't automatically bad: Stopped was designed to be reachable, and was ~0% before. But it must be a choice he
sees coming, so the trial must log Stopped and pushes a fight, and the retune (quiet, cap) should be ready
before it goes live, not after his first Stopped run.

## Trial shape

Two switches, so he can tell what he's feeling: **"weight"** (drama timing + the Ask 1 numbers: both are "parts
feel stronger") and **"tap push"** (V4 + the queue near ready). Weight first: it can't hurt the never-melt
player, and it answers "lean on the parts" without touching strain.
