# Pitches: enemy variety, and playstyles beyond kiting

26 Sep 2026. Four voices (balancer, translator, verifier, me), two rounds; raw rounds in
this folder, brief in `BRIEF.md`. Nothing built. This round converged almost completely.

---

## Why it's only kiting: the numbers

- **The free auto attack does 8.1 damage a second from 7.6 u away**, and only one part
  (Piston, 8.7) beats it. Close range pays nothing extra.
- Time has no price, moving costs no damage (everything fires while walking), and a step
  clears every threat with 118-1002 ms to spare. So standing back is always right.
- Your playtest agrees: head parts were 51% of casts, arms 25%.
- The slots stay role-locked (head ranged, torso area, arms melee, legs movement). All four
  voices agree to keep them: Still *is* a body, the wall and his model depend on it, and
  changing it breaks the most code. Playstyles come from where you stand, not the slots.

## What all four agree on

**1. The hand: the auto becomes a close strike.** When the nearest awake enemy is within
arm's reach with a clear line (range 2.9: about 3.5 u from a hulk, outside its 2.4 u slam),
the auto becomes a single-target strike: 10 damage every 0.62 s, the same rhythm as now.
- A close build does ~33 damage a second against ~16 kiting.
- The band between your reach and the hulk's slam is safe: step in during its wind-up,
  hit from there, never get hit.
- Walking at mid range keeps today's auto, so kiting still works; it just stops being the
  best answer everywhere.

**2. Show the pick.** A faint cold ring on the floor at the hand's reach. With the hulk's
ember slam disc inside it, the gap between them *is* the safe band, visible.

**3. The eye: standing still aims at the back line.** Walking, the auto and head parts aim
at the nearest. Standing still for 0.5 s, they reach 11 u and aim at leaders, shooters and
supports first (awake enemies only, so you never wake a sleeping pack). A dashed sightline
jumps to the new target and Still's lens lifts. The marksman is the one who plants his feet.

**4. Behind a pause-screen switch, with its own logging**, like the break rule, so you can
compare runs with and without it.

**5. Archetypes as tags, not bonuses.** Each part carries one or two leanings (close,
marksman, caster, keeper), shown as a glyph on the pickup card and the wall plaque, and as
"leaning close" in the compare pause when three match. **No set bonuses**: most parts fit
two styles, so a bonus for matching would switch on by accident (81% of random loadouts)
and become a stat in disguise. The archetype shows where you look back, never on the HUD.

**6. The thief runs for the elite's drop.** It hides in a barrel in the elite's room; when
the elite falls, it grabs the elite's drop and runs. No new loot, and a moment in the middle
of a fight. **Certain the first time** (depth 2), then about 1 in 3 at depths 1, 2, 4 and 5:
met in ~76% of runs, against ~10% today.

**7. Enemy families.** Each archetype gets named variants from the old roster: one prop you
can see at phone scale and one twist in behaviour. Three first. (Three names round 1 used
are already taken by notebook pages; the spec picks others.)

**8. Named champions with stacked modifiers.** First fix two bugs the verifier found (a
Plated Warden silently loses Plated; the modifier draw moves every shrine). Then 1, 2 or 3
modifiers by depth, at most one "number" modifier (Quick or Plated) each, from a longer list.
First new ones: Echoing, Molten, Grounded, and **Mirrored: the elite wears your Mirror Ward
and drops it when it dies.** Enemies wearing Still's own parts is the most Still idea of the
round. Every modifier that changes the answer shows as a body feature.

**9. One support: the mender.** It mends one packmate through a cable drawn on the floor;
walk through the cable to cut it, or kill the mender first.

**10. New parts, in order.** Grindstone (arms: its cooldown only runs while an enemy is in
reach, so the button itself shows the band) and Flywheel (torso) first: those sections each
have a free peg. Then move the 6 golds to their own shelf on the wall (no save change),
freeing pegs, then the Winch (a chain aimed with the stick). The planted lens (a summon)
after. **Masher parts wait:** with your ~0.5 s presses, rhythm-tap parts would push a
cooling button by accident.

## Cut or parked
- The auto following each arms part (it makes every arms part two abilities).
- Set bonuses for matching leanings (above).
- A cheaper strain cost for close breaks (wait for runs).
- Letting any slot carry any role (big, breaks the wall, the models and the save).
- The drone, the turret, rhythm-tap parts (later, once a style feels thin).

## Build order

| step | what | about |
|---|---|---|
| 1 | the thief runs for the elite's drop | 1 |
| 2 | the hand, the ring, the eye, behind a switch with logging | 2 |
| | *you play a few runs, switch on and off* | |
| 3 | three enemy families | 3 |
| 4 | the modifier bugs, stacked modifiers, the first four, worn parts | 3 |
| 5 | the mender | 1.5 |
| 6 | Grindstone, Flywheel, leaning tags | 1.5 |
| 7 | the gold shelf, the Winch | 1.5 |

About 13 evenings. Steps 1 and 2 are the ones you'd feel first.
