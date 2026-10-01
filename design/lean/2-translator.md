# Lean, round 2: translator

## (a) Gesture or decision: I was half wrong

I said the 180 ms hold was the friction and read his 311 ms push median as "holding to make sure". The verifier's numbers show otherwise: his ready presses run 207 ms anyway, so a deliberate press on a cooling button already pushes. **I drop "the hold is the trouble."**

The gesture still matters, in a different place. He has two thumb modes:
- **The deliberate press.** This already works.
- **The flick.** This dies silently: all 30 dead taps were under 190 ms. He flicks when it's urgent (a windup closing, a crowd on him), so the gesture fails exactly at the moment that matters.

The other half is the balancer's: when a push does land, it buys almost nothing he can see (3.4% breaks). So "troublesome" means a flick that does nothing, and a push that does little when it works.

**Rule for the trial: no touch on a part button is ever silent.** Within one frame, every touch is one of:
- a cast;
- a push (ember sparks and a vibration);
- queued (the ring snaps full, a soft tick);
- guarded (the dead-tap arc and a click).

## (b) What the push buys

V4 answers his "full effect" literally: everything a push adds rides on every ready cast. The break is rare, though, so what he will *feel* as "full" is the pushed presentation that `cast()` already has (pose x1.35, lower pitch, the grind, scale 1.16), now on every ready cast.

**The push buys time, and only time.** A push fires now for +2. I wouldn't invent a push-only bonus to make it worth more. Time is the clean choice, and the price chip on a cooling button can say it plainly.

To keep a push recognisable when every cast looks pushed:
- **Ember sparks and the vibration only on a real push** (verifier's K-L7).
- **Breaks:** when one happens, it gets the Anvil's weight, so a rare event lands as an event.

The felt "full effect" on pressure hulks, the bodies that never wind up, belongs to Ask 1: the Cleaver's 160 deg cone plus a 0.8-1.5 u shove. That is not a push power.

## (c) One hitstop formula

**hitstop ms = 30 + 8 x base cooldown s + 10 x (bodies hit - 1), cap 100.**
- **On contact only.** Nothing on a whiff. Bolts and lobs freeze at impact.
- **Global freeze**, as the balancer has it. Stick input is held through the freeze, never dropped.
- **Merging:** freezes within 200 ms merge by **max, not sum**.
- **Base cooldown** means the white def's, so tempering a part never makes it feel lighter.

| part | 1 body | 3 bodies |
|---|---|---|
| Cleaver | 51 | 71 |
| Lens | 64 | – |
| Vent | 82 | 100 |
| Kickstart | 94 | 100 |

The body term mostly lifts the short-cooldown arms, which is where the crowd needs to be felt. The long slots hit the cap anyway.

**Autos:**
- Beat hitstop 22 to 0 (Claude's call).
- Auto kills 35 ms at half shake.
- Part kills 90 ms.

## (d) Near-ready guard: the verifier's 300 ms buffer

**I pick the verifier's 300 ms buffer, with a visible queued state.**

I disagree with the balancer's 400 ms in one sentence: a tap with 400 ms left is usually aimed at a tell that lands sooner, so the queue fires it late, for free, at the wrong moment, and he should be the one choosing to pay 2 for now.

My 250 ms guard was never a near-ready guard; it is a **post-fire double-tap guard**:
- **What it ignores:** a cooling tap within 250 ms of that button's own fire.
- **Why it stays:** under tap-push, a mashed Cleaver would otherwise fire twice and charge 2.
- **The 40 ms neighbour guard: dropped.** Log neighbour-roll pushes instead, and add it back only if they show up.

## Where I still disagree

- **With Claude, on order.** "Weight" should go first, as he says, but the ember price chip and the strain-brink warning have to be live before "tap push" ships. At V4 x1.5 the balancer has Stopped at 20-28%, and Stopped must be seen coming, never a surprise.
- **With nobody on V1.** All four voices reject strain on every cast.

## Log additions

- `taps {cast, push, queued, guarded}` with `ms` and `leftMs`
- `neighbourPush`
- `hitstopMs` per fight-minute (budget about 5%)
