# The two leanings: what we build

28 Sep 2026. Four voices (balancer, translator, verifier, Claude), two rounds; raw rounds in this
folder, brief in `BRIEF.md`, the frame in `design/builds/LESSONS.md`. He asked for the round and
said "once you have come to an agreement, go ahead with the implementation". This is the
agreement, and the spec the build follows.

## Agreed by all four
- **One lean per part: close, marksman, or none.** Tags steer and label; they switch nothing on.
  **No set bonuses** (a random picker wears 3+ of one tag ~54% of the time, so a bonus would be
  a stat in disguise).
- **The hand and the eye never change with what you wear.**
- **Two triggers, both caused by the enemy:** the **hand break** (exists: a strike on a breakable
  windup) and the new **eye break**: a planted shot that lands on a windup the hand could break
  (`breakable(e)`) breaks it the same way (`interrupt(false)` + `interrupted`). A sentinel's 760 ms
  windup outlasts the 620 ms beat, so the eye answers shooters the way the hand answers hulks
  (sim: sentinel 74%, ram 80%, against the hand's 84% on a hulk).
- **The eye's planted shot does 8** (was 5), flat, no distance gate, no ramp (dial 7-9). Planted
  becomes ~58% of close on one target and ~equal on a line of two (it pierces). Walking at range
  is still nothing; the hand still takes anything in reach.
- **The eye aims at a breakable windup first**, then leaders, shooters, the nearest.
- **Bosses can't be broken**, so **the first hand or eye hit in each boss opening** (the Assembler
  pinned or stunned, the Arbiter venting) fires that trigger, without interrupting anything, and
  plays the break's shatter and sound. Otherwise payoffs go quiet where 5 of his 7 runs Broke.
- **Payoffs are riders on existing parts**, not new parts. A rider acts only on its own button,
  never on HP or another part, has its own cap (icd), and never fires from a break a part caused
  (Parry Clamp, Clamp Toss, a push).
- **No new parts in this trial.** The gaps close with existing ones:
  - close's head: **Flare retuned to close**: range 11 → 6, travel 800 → 450 ms, card "Lobs a burst
    onto the enemy you're fighting, over its packmates." **Signal Flare** is tagged close as it is.
  - marksman's arms: **Piston** 26 → 20 damage, shove 1.6 → 4.0 u, card "A hard, narrow punch that
    knocks one enemy far back." **Clamp Toss** as it is (at rest it already throws away from Still).
  - Backlog, each tied to a failed pass line: Glare, Grindstone, Flywheel, Kickstand.
- **The pedestal match is built now and left off** (`LEAN_MATCH = false`), because pedestals are
  the economy change on trial and the eye break + riders the combat one. It switches on after he
  has played 3 plain-pedestal runs. Rule when on: your lean is the one you wear most; a tie goes to
  your last tagged pick; one pedestal in three is drawn from it; nothing tagged worn gives one close,
  one marksman and one free.
- **Shown:** a glyph from each stance's floor mark (close: an arc of the hand's ring; marksman: a
  dashed line ending in a dot) on the card, the compare screen and the wall, **never the HUD**. Eye
  breaks shatter **cold**, hand breaks **ember**.

## Settled by the lead (where the rounds split)
1. **Four riders, not eight.** Translator and balancer: four; verifier: eight (one per lean per
   slot). Four keeps the trial readable in his play time; the verifier's other four are the second
   wave if L1 fails. Tags already give every slot a part of each lean (rule 5).
2. **The four:** **Parry Clamp** and **Backdraft Vent** on a hand break; **Patient Lens** and
   **Clamp Toss** on an eye break (balancer + verifier over Mirror Ward: arms is marksman's
   thinnest slot).
3. **A rider readies its button fully** (Patient: fully charged), capped at one fire per 4 s per
   part, and the button flashes ember (hand) or cold (eye). The translator's legibility argument
   wins over the balancer's partial cuts: a button snapping full lands under the thumb; a 2 s
   sliver of a ring doesn't. If it proves too strong, the dial is the cap, then partial cuts.
4. **Card lead-ins: "Hand break:" / "Eye break:"** (translator), not "pin" or "shootdown".
   "Hand" and "eye" name the autos; Parry's own snap doesn't read as the trigger.

## The tags
- **Close (13):** Flare (retuned), Signal Flare, Overclocked Coil, Backdraft, Brace, Scrap Cleaver,
  Rusted Hook, Parry Clamp, Frayed Cleaver, Anvil, Kickstart, Skid Plates, Overrun.
- **Marksman (16):** Focusing Lens, Cracked Lens, Ricochet Lens, Patient Lens, Through-Line,
  Pressure Vent, Ward, Chill Vent, Mirror Ward, Lure, Piston, Clamp Toss, Skitter, Frost Trail,
  Spring Heels, Plumb Line.
- **None (1):** Borrowed Time.
- The starting four split 2-2 (Focusing Lens, Pressure Vent / Scrap Cleaver, Kickstart).

## Pass lines
- **Static (`tools/leancheck.ts`):** one lean per part; every slot has a lean-tagged part of each
  lean that drops outside bosses; riders only on hand/eye, own slot, no HP or damage.
- **Headless:** one sentinel at 9 u, Still planted, no parts, 20 s: at most 1 of its shots lands.
- **Simulator (`dropsim --lean`):** formed = 3+ own tags and 1+ own rider at the Arbiter: a committed
  chooser forms >= 60% per lean, within 10 points of each other; a random picker <= 30%; no part
  picked > 2x its slot's median; every slot x lean offered >= 0.5 a run.
- **Playtest log (6+ runs, his feel asked first):** L1 each worn rider fires >= 8 a run and >= 2 per
  boss fight; eye breaks in marksman runs >= 0.5x hand breaks in close runs. L2 a part taken >= 70%
  of >= 6 offers, or 0 of 6, is reworked. L3 marksman runs: planted >= 30% of play, eye >= 35% of
  auto damage, Arbiter eye:hand >= 1:2 (today 5:60). L4 pushes and strain within 25% of today.
  L5 Broke at the Assembler <= 40% of arrivals (today 5 of 7).
- A failed rider gets a new trigger, not a bigger number.

## Build order (the verifier's)
- **A, inert:** `lean` and `rider` on `AbilityDef`, the tags, Flare and Piston numbers and cards,
  the glyphs, `leancheck`, `dropsim --lean`, log fields (hand/eye breaks, openings, planted
  seconds, auto damage by source, rider fires per part).
- **B, the combat trial:** `EYE.damage`, the eye break, eye targeting, boss openings, the trigger
  event, riders routed to worn parts with their cap, the button flash, the cold shatter.
- **C:** the match, built in `rollPicks` behind `LEAN_MATCH`, off.

Out: pin as a status, steady, the 5 u gate, Patient's planted-only clock, new parts, set bonuses.
Open for him: the notebook doesn't name "the hand" or "the eye" yet (a first-run page, his words).
