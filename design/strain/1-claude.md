# Round 1: Claude's pitches (the fourth voice)

One observation before the pitches. The ram's stun is already an opening:
1200 ms, damage × 1.5 (`src/charger.ts`). It doesn't ask for a push because
*anything* cashes it: the auto attack, whichever button happens to be ready. An
opening only creates demand if the thing that ready buttons and the auto can't
supply is what it pays for. So each demand pitch below says what it needs, not
just when.

## 1. Demand

**C-D1. Cracks.** Some recovers open a crack: the ram's stun, the hulk's
recover after a missed strike, the Arbiter's vent. A crack shows as a split of
ember light in the body and lasts about 1–1.2 s. Autos do nothing special to a
crack; the first *ability* hit inside it breaks the enemy (a big stagger, or an
elite loses its mod for the rest of the fight). With four cooldowns staggered
over 3–8 s, the odds that a fitting button is ready in that one second are low,
and that is exactly when a hold makes sense. It's the stun window the ram
already has, made to ask for something specific. *Cost:* cheap to medium (a
flag on existing recovers, one hit rule, one crack look per archetype).

**C-D2. The caller.** *Surprising.* One member of some packs is a caller: when
the pack wakes, it starts a visible, audible 3 s wind-up that wakes the next
pack over. Kill it or break its wind-up before it finishes. It turns the start
of a fight into a race against a clock you can see, which is the one pressure
cooldowns can't wait out. It fits the D2 crawl (packs, rooms) and costs nothing
if you handle it. *Cost:* medium (a pack role, a wind-up tell, waking a
neighbour pack, which `dungeon.ts` can already find).

## 2. Reward

**C-R1. A push breaks a wind-up.** One rule across all 30 parts: a pushed hit
interrupts a committed wind-up (the hulk's strike, the ram's lock, the Lobber's
tilt); a normal hit doesn't. It keeps the telegraph rule intact, because the
enemy still commits and Still still has to answer inside the tell. The free push
per fight stops being autopilot: you save it for the wind-up that would hurt,
which is a *when*, not a whether. *Cost:* cheap (`interrupt()` already exists on
enemies; a `pushed` flag on the hit).

**C-R2. A well-read push is free.** *Surprising.* A push that lands inside a
crack (C-D1) or breaks a wind-up (C-R1) refunds its +2. A blind push costs full.
It doesn't break "no part lowers strain": it's a rule of reading, not a part.
The risk to name: strain rises slower for a good player, so Stopped gets harder
to reach. That may be right (Stopped is for the one who overspends), but it
should be measured, not assumed. *Cost:* cheap once C-D1 or C-R1 exists.

## 3. The thought coming up

**C-T1. The button wears the tell.** When a crack or a wind-up is live and a
recharging button could answer it, that button's rim takes the enemy's own tell:
the same ember split, textured, pulsing with it. The world and the thumb share
one sign, so there's nothing new to learn and the eye doesn't have to leave the
enemy for long. *Cost:* cheap (the HUD already styles hot and push-shaped
buttons).

**C-T2. Teach at the first crack, not at the first cooldown.** Today the one-time
push hint shows the first time a part starts recharging, when there's no reason
to push. Move it to the first live crack or wind-up with a recharging button
that could answer it: a slow-motion beat (0.3×, 600 ms) and "hold". *Cost:* cheap.

## Bundle

C-D1 + C-R1 + C-T1: cracks that ask for an ability hit, pushes that break wind-ups,
and the button wearing the tell. Add C-T2 with them. C-R2 after a phone test,
with Stopped reachability measured before and after.
