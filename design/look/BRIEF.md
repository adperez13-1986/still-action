# The look: brief

2 Oct 2026, his ask, verbatim: "can you also have design pass with your agent team on how to improve the overall look of the game,
including the animation of the parts? they are too basic right now.. maybe make their animations more dramatic as they get upgraded,
but hopefully not just bigger".

One round, four voices (translator, balancer, verifier, Claude), then `PITCHES.md` for him. **Design only: nothing is built until he
picks.** Keep each voice's file under ~250 lines: his weekly usage is low, and he reads the synthesis, not the rounds.

## What he said, unpacked

- **Parts' animations are too basic.** That is the first job. The overall look is the second.
- **Drama should grow with rank (temper I / II / III), but not just bigger.** Scaling radius or brightness alone is out. What else can
  rise with rank: anticipation (a wind-up before release), follow-through (what lingers after), secondary motion (debris, sparks, cloth
  of light, afterimages), timing and spacing (a snap vs a sweep), the material of the effect (glow -> molten -> fractured), sound layers,
  the camera (a nudge, a hitstop that is already there under weight), what the effect does to the world (scorch, frost on the floor,
  dust), Still's own body (pose, the core's light, the slot's mesh on his body). A rank-III cast should be recognisable as III with the
  sound off and at a glance.
- **"Not just bigger" also means not more cluttered.** A deep pack already carries rings (markfx), state glyphs, tells and windups. The
  fight must stay readable: an enemy's tell always wins over our flourish.

## What exists (read before proposing)

- `src/partfx.ts` (764 lines): every part's visual, keyed on PartEvent kinds (`src/parts.ts`). **It knows nothing about rank.** Shapes in
  `src/abilities.ts` `AbilityShape`: bolt, lob, nova, ward, decoy, arc, grab, catch, dash, hop, anchor, rewind. 30 parts, 12 shapes.
- `src/vfx.ts` (particles, shaders, motes), `src/markfx.ts` (B2/B3 mark rings: instanced, +3 draw calls), `src/partmodels.ts` (the
  parts' meshes on Still and on the Workshop wall), `src/look.ts` / `src/grade.ts` / `src/world.ts` (fog, lights, grading),
  `src/areas.ts` / `src/day.ts` (places and the day), `src/audio.ts` (synth), `src/still.ts` (the Lantern rig: four meshes).
- `src/temper.ts`: ranks I-III, melting. `src/weight.ts`: the "weight" trial (on by default): freeze on contact, the cocked pose, the
  one hitstop formula. The build layer (design/buildlayer/BUILD.md) just added cores (Wake, Ram), marks and spends, flat temper.
- DESIGN.md: the settled decisions (locked iso camera, mobile-first). HANDOVER.md "Start here": the current state.
- Earlier look findings: review caught "flat peach" looks, white rail streaks, a hit flash that washes a slammed hulk into a pale blob.

## Constraints

- **His phone** (Poco F8 Pro, mid-high Android) at 60 fps; adaptive resolution in `src/perf.ts`. Every proposal states its draw-call and
  particle cost. `?perf=1` on the live build now shows the readout, so he can measure.
- **Locked iso camera, small bodies on a phone screen**: detail below ~6 px is invisible. Silhouette, timing and colour carry; texture does not.
- **Premium, buy-once, made for the joy of it** (memory: games are for fun; no timeline). Little by little is fine.
- **Ship to main, no dark stages** (his rule): a look change goes live when reviewed, behind no flag unless it is a real trial.
- **Cold palette for Still's own effects, ember for enemies' threat** (the existing grammar: check partfx/vfx for it and keep it, or argue).

## What each voice should give

- **Translator (lead voice here):** the escalation grammar: what changes I -> II -> III per shape family (not per part), with one worked
  example in full (the Cleaver family) as timing beats (ms), and what the eye reads at a glance. The overall-look diagnosis: the three
  things that make it look "basic" today, from the code and the screenshots in design/ if any.
- **Balancer:** what rank escalation should communicate (power read vs actual power: a III that looks 3x but is x1.3 under flat temper
  lies), the clutter budget in a deep pack (how many simultaneous effects at d6-d9 densities), and the perf budget in numbers.
- **Verifier:** how it would be built in steps, the data shape (rank into partfx, a per-shape tier table), the checks (draw calls,
  particle caps, screenshots at four phone sizes, the deep-pack readability check), and the risks.
- **Claude:** my own lean, then the synthesis `PITCHES.md`: the short answer, what all agree on, the first slice worth building (one
  shape family end to end, so he can feel it before the rest), and his calls.
