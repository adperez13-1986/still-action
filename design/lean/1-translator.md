# Lean, round 1: translator (thumb, feel, drama)

## Verdicts

| ask | verdict | strongest reason |
|---|---|---|
| 1 tougher + stronger | **partly** | Nobody reads a damage number on a 6-inch screen. "Stronger" has to be visible: more bodies hit, a shove, a stagger. Extra HP belongs on crowds, where an arc hitting five bodies beats a strike hitting one. |
| 2 drama | **agree; fix the timing first, add particles last** | The code puts the weight in the wrong place (below). |
| 3 every cast a push | **partly: yes to the effects, no to strain on every cast** | The trouble is that one button means two things. A cost on every press would make his hesitation worse. |

## Gesture or decision?

**The gesture.** One button means two things, depending on a state he has to look down to check. Mid-crowd, a push takes four reads: is it ready (the sweep), is it worth 2 (the meter), a 180 ms hold with no feedback for the first 100, and which body it will hit (unknowable). All the while the windup is closing, and his only pressing thumb is stuck. The push lands about 430 ms after the tell.

The log agrees. He makes 10-17 presses a play-minute but only about 3 a depth on cooling buttons (2.6 pushes + 0.6 dead taps), and his median hold is 311 ms, almost double what's needed. Holding long to make sure it takes is what friction looks like. The price is light by comparison: a push a fight is free, and he knows it.

## The variants mid-crowd

| | feel | accidents | strain as a choice |
|---|---|---|---|
| V1 ready casts push and cost; cooling buttons dead | an ember pip flies to the meter on every press, 10-17 times a minute. The meter turns into a timer; **every press says "this costs"**. A hesitation tax | none | gone: strain becomes ammo, and Stopped means "pressed too much" |
| V2 a tap on a cooling button pushes | clean. The push lands about 250 ms after the tell, so hulks become answerable | **high**: a mash catches a cooling neighbour for +2 | kept |
| V3 V1 + V2 | everything costs, and mashing costs more | high | gone |
| **V4: ready = full push effect, free; a cooling tap = push +2, guarded** | every press is the big version. Cooling reads "faster costs 2" | guarded | **kept, and clearer: he only ever pays for speed** |

**V4:**
- A ready cast gets the break rule, the threat aim and every per-part pushed extra. It costs only the part's own `def.strain`.
- A tap on a cooling button fires at once for +2 and restarts the full cooldown. No hold.
- **Mash guard:** these are ignored, with the existing dead-tap arc and click:
  - a cooling tap within 250 ms of that button's last fire;
  - a tap starting within 40 ms of a press on a neighbouring button.
- **A windup still asks something:** is a part ready and in reach? If not, pay 2 or step. The question is about cooldowns he can see, not a hidden gesture.

**Where I disagree with him.** Strain on every cast turns the clock into a mana bar and trains the opposite of leaning on the parts. If he insists, put the cost on the fight (say +1 for a fight with 6+ casts), paid at the quiet, never under his thumb.

**What V4 breaks:**
- The break's price: breaks rise and hulks come into reach. The balancer's lever is break-resistant elite leaders; bosses stay unbreakable.
- Parry's niche, already settled as a dead slot from d4.
- Stageb's break checks (the verifier's call).

## Drama: what the code does now

1. **The hit lands before the swing.** `useAbility` deals damage on the press, then the pose spends its first 30% winding *back* (`still.ts:687`). The sparks lead the clamp by about 100 ms.
2. **The freeze is on the press, not the contact.** `cast()` freezes 35/60 ms whether anything is hit or not (`main.ts:3716`). A whiff feels sticky; five bodies freeze for 45 ms, the same as one (`onHit` is flat).
3. **The free floor owns the kill.** Every kill gets 80 ms, 0.28 shake and a punch, auto or part (`main.ts:338`).
4. **The cast sound plays on the press,** so a miss sounds like a hit. Only Piston splits the two (`pistonHit`/`pistonMiss`): that's the template.
5. **A phone speaker has no bass.** Weight comes from a 400 Hz-1 kHz transient and the vibration motor, and `vibrate` only fires for hurts and the Anvil.
6. **The Cleaver, the most-pressed part, shoves nobody** (no `shove`, `abilities.ts:289`).

## Per-slot recipe

**Shared:**
- Nothing fires on a miss.
- Contact freeze: 50 ms, +12 ms per extra body, capped at 100.
- Kills: a part kill 90 ms; **an auto kill 35 ms, at half the shake**.
- Each struck body's flash lasts 2x as long as an auto's.
- Haptic: 12 ms, +6 per extra body, capped at 30.
- No new particles in crowds: a cold flash on embers reads, more sparks don't.

| slot | anticipation (no input lag) | contact + enemy reaction | sound | reference |
|---|---|---|---|---|
| **Arms** | the pose **starts cocked**; frame 1 is the smear | the freeze on the swing's arrival; bodies shoved 0.8-1.5 u along it, reeling 120 ms | the clank on the press; a crunch on contact, a step lower at 3+ bodies | Hades heavy attacks; Dead Cells Broadsword |
| **Head** | `vfx.gather` at the lens, 2 frames | the freeze on the first body only; a flinch back of ~10 deg; each pierce adds a rising tick | a zip, then a dry "tck" | Hades Cast's lodge; Diablo Immortal skill impacts |
| **Torso** | a 70 ms inhale: the cage pulls in, **everything else ducks 4 dB** | a ring runs out to the radius (`combat.ring`); everything inside is shoved and flashes at once | a low whump in the duck | Diablo II/III Frost Nova; Hades' music duck under a Call |
| **Legs** | none (MOVES stay unfrozen, settled) | the freeze at the landing, only if it struck; bodies passed through spin | a skid, then a slam on a hit | Hades dash-strike |
| **Push / break** | joint sparks in **EMBER_DEEP to EMBER**, never light orange (it goes peach) | a break gets the Anvil catch's weight: 90 ms, vibrate `[20,30,40]`; **the windup's ember goes out** | the grind, then a crack | Sekiro's posture snap, small |

Hitstop and haptics cost no frames. The ring and the duck are cheap.

## Smallest phone trial

Two pause switches that apply at once, so he can flip them mid-fight:

1. **"weight"**: the recipe's timing only. Freeze on contact, lighter auto kills, contact sound and haptics, the pose starting cocked, a shove on the Cleaver.
2. **"every cast"**: V4 with the mash guard.

What he should notice: does a five-body Cleaver feel different from a jab; does he ever think about the hold again. Pass for "every cast": presses a play-minute up 25% at d1-3 (from 10 / 13 / 17).

**Log:**
- `pushes` per fight
- `guarded` (taps the mash guard ignored)
- `breaks {ready, pushed}`
- `kills {part, auto}`
- presses a play-minute
- `taps.leftMs`
