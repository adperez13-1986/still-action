# Brief: lean on the parts (tougher enemies, stronger parts, every cast a push)

1 Oct 2026. His words, after the follow-through trial (which he said "felt the same"; `design/autos/TRIAL-1.md`):

> "what if instead of focusing on the auto attack, we make the enemies tougher and improve the parts? make the
> parts animation more dramatic and think how to make them stronger so players would lean on them more. And
> sometimes I feel that it is too troublesome to trigger the push.. maybe parts usage should always just be the
> full effect including the push effect and just always incur strain? think with the game agents and come back
> to me"

**Disagree where it's earned, agree where it's earned.** Same rule as the autos round: an "agree" needs reasons as
strong as a "disagree". He asked for thinking, not a yes.

## Three asks, one goal ("players lean on the parts")

1. **Tougher enemies + stronger parts.** Leave the autos alone; raise enemy HP and part power so the parts are
   what kills things and the autos become the floor.
2. **More dramatic part animations.** Every part should look and sound like the big moment it is.
3. **No more hold-to-push.** "Too troublesome." Every part use is the full effect *including what a push adds*,
   and always costs strain.

## Where things stand (read the code; don't trust this summary over it)

- **Autos** (`src/combat.ts` HAND / EYE): close strike 10 dmg / 0.62 s beat within ~2.9 u (16 DPS on one body);
  planted shot 8 dmg piercing lance after 0.3 s still, x0.5 hits taken while planted (brace). Bosses take x0.5
  from autos. Autos break windups they can. Follow-through (the bank) is a pause switch, off by default: it stays
  as built unless this round says remove it.
- **Parts** (`src/abilities.ts`): one per slot, ~30 defs. White arms: Scrap Cleaver 18 dmg / 2.6 s, Piston 20 /
  3.0 s. Cooldowns 1.1-12 s at the ranks he carries. Ranks I-III via melts (`temper`). Masteries, riders, states
  (chilled/marked, `src/states.ts`: autos set, parts pay).
- **The push today** (DESIGN.md "Strain", `design/strain/PITCHES.md`): hold a *cooling* button 180 ms: fires now,
  +2 strain, restarts its full cooldown. A press within 120 ms of ready is a cast. What a push adds over a cast:
  **the break rule** (a pushed hit that lands in a windup breaks it; enemy reels open x1.5; bosses can't be
  broken), **the threat aim** (a pushed cast aims at the windup landing soonest), and per-part extras (pushed
  bolt always full damage `abilities.ts:45`; pushed dash numbers `:69`; pushed Lure bursts the decoy; Patient
  Lens, Overrun, Plumb Line). Some parts carry their own `strain` on every cast (`abilities.ts:152`).
  Parry catch (switch, on): Parry catches pressure tells.
- **Strain** (the run's clock): forfeits at 20 ("Stopped", the second ending: Still slowing down). -2 per fight
  cleared, never below half the strain carried into the depth; Rest shrine -6; Plenty pedestal +4. One push a
  fight is effectively free. Stopped was ~0% reachable before step 1.
- **His log, runs 9-17** (29-30 Sep, autos nominal: boss halving not counted, so autos are overstated at bosses):
  parts did **58%** of damage overall; by depth 43 / 55 / 51 / 62 / 74 / 52 / 73 / 70 / 83%. **2.6 pushes a depth**
  (~0.4 a fight; 4.3 at d1 falling to ~1 by d5). 0.6 dead taps a depth. Push hold median 311 ms; 27 of 118 held
  < 240 ms (maybe accidental: `design/autos/PITCHES.md` last section). Presses per play-minute 10 / 13 / 17 at d1-3.
  The bank trial didn't move presses at all (TRIAL-1).
- **His behaviour (balancer, round 2 of autos):** "his pace is hesitation, not cooldowns". Cheaper cooldowns
  didn't buy presses in the model.
- **Phone:** landscape, left thumb stick, right thumb over a quarter arc of four 60 px buttons. No fifth button.
- **Settled, argue only with the cost named:** telegraphs commit and a step clears them; rams/Lobbers keep
  telegraphs; never-dead-time; premium, not grind (`design/premium`); the curve (`design/scaling/CURVE9.md`, 9
  depths); Parry a dead slot from d4 (`design/parry/`). Rejected before: melee magnetism, removing autos (never-melt
  finish 31% -> 0%), a fifth button.
- **Look lessons** (HANDOVER): bright light-orange MeshBasic under ACES + bloom reads peach; go deeper/redder.
  Effects live in `src/partfx.ts` (706 lines), models in `src/partmodels.ts`, audio synthesized (`src/audio.ts`).

## The questions

**Ask 1, tougher + stronger.** Does raising enemy HP and part power (autos untouched) actually move the weight onto
the parts, or does the free floor still win on packs? What multipliers, on which bodies (packs vs pressure bodies vs
bosses), keep the 9-depth curve's kill times and finish rates? Does "stronger" mean damage, or reach / area / a
bigger effect (more bodies hit, a stagger, a real shove)? Which parts are weakest today and why? What happens to the
never-melt vs investor gap?

**Ask 3, every cast a push.** Name the variants and pick one. At least:
- **V1** every ready cast carries the push effects (break, threat aim, per-part extras) and costs strain; cooling
  buttons can't fire at all (no push gesture).
- **V2** a *tap* on a cooling button pushes at once (no hold), +2; ready casts unchanged.
- **V3** V1 + a tap on a cooling button still pushes (bigger strain).
- **V4** your own.
What does each do to strain as the run's clock (rescale: per-cast strain, decay, the 20 cap, Rest), to Stopped's
reachability, to the break rule's meaning (if every hit breaks, does a windup still ask anything?), to the accidental
taps, and to the "strain is a choice" heart of DESIGN.md? Is the trouble the gesture (180 ms hold on a sweep that
reads "off") or the decision (paying strain)? He said "troublesome": take that seriously.

**Ask 2, drama.** What would make each slot's cast land as a moment on a 6-inch phone at the game camera: anticipation,
hit-stop, screen shake, a flash, a sound with weight, the enemy reacting? A per-slot recipe, not 30 one-offs. What
already exists in partfx, what's cheap, what reads at phone size, what hurts readability in a crowd or the frame rate.

## What each voice produces (round 1)

1. **Verdict** on each ask: agree / disagree / partly, and the single strongest reason.
2. **Your proposal**, what it breaks among the settled things, each with its cost.
3. **The smallest phone trial** (a pause switch like "follow-through"/"counters", applies at once), what he should
   notice in one run, and the log field that shows it.

Balancer: model it (extend `design/autos/autos-sim2.mjs` or write `design/lean/lean-sim.mjs`) on the real numbers:
kill times, damage split, finish rates never-melt / median / investor across CURVE9, and the strain economy for each
push variant (pushes a fight, Stopped rate). Numbers, not guesses. Translator: the thumb and the feel; what each push
variant feels like mid-crowd; the drama recipe per slot with references that actually do it (Hades, Dead Cells,
Diablo Immortal, Brotato, Vampire Survivors evolutions, whatever fits). Verifier: what each touches in code (combat.ts
hitPart/pushBreak/threat, abilities, main's cast path, strain, playlog, partfx), which checks break (K-90F, K-A*,
stageb's break checks), and the check for the trial.

Under ~1,000 words. Write to `design/lean/1-<voice>.md`. Don't change code.

## Round 2

Read the other round-1 files (including `1-claude.md`). Say where you disagree and why in a sentence; change verdicts
you were persuaded on. Under ~500 words, to `design/lean/2-<voice>.md`.
