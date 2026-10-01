# Build layer, round 1: verifier

1 Oct 2026. Written alone, from the brief, the design files and the code (`src/` and `tools/` as of today).
Every name below is PLACEHOLDER. Every line of player-facing words is PLACEHOLDER.

## My position in short

- **A build is a loop: one enemy state, the thing that sets it, and the parts that cash it in.** The code already has
  this machine (`src/states.ts`: `sets`, `pays`, `stateMul`, `pairWith`, the lit rim glyph, "pairs with X" on the card).
  It is the only place in the code where two parts know about each other. Leanings are labels; nothing reads them.
- **The setter must be fast, or the loop is worth nothing on a pack.** Packs die in 4-6 s and setting parts cool 5-8 s
  (the synergy round's finding). The only fast thing in the game is the auto (a beat every 0.62 s). So the auto sets
  the state, from depth 1, and the parts pay it.
- **The auto becomes the build's root, picked early. You get one of the two, not both.** The code already runs the
  hand and the eye as two separate switches (`combat.closeHand`, `combat.eye`, dev hooks only today). A build that
  turns one off plays differently in the hands at once. That is two lines plus a pick card.
- **Trial two loops, not four:** "haul" (pull them in, fight in the middle) and "pin" (shove them onto walls, step
  back, shoot the pinned one). Both states were designed in the synergy round and never built. Both reuse verbs the
  parts already have (pull, shove). No new shapes are needed for the trial.
- **Before any of this: fix the measuring tools.** The drop simulator models a game that no longer exists (6 depths,
  pedestals on, no temper). The check suites pin "weight" and "tap push" off, so they test a game he doesn't play.

## What the code says that the brief doesn't

The brief is a little stale. These matter for every voice:

1. **Riders are cut (28 Sep).** No part has a `rider` today (`tools/leancheck.ts` `RIDERS = {}`). The field, `ride()`,
   `riderNext` and `riderLine` are still in the code, unused.
2. **Pedestals are off (28 Sep).** `PEDESTALS_ON = false` in `main.ts`. Exits raise nothing; Plenty drops one part; the
   Assembler leaves a blue and a gold on the floor. `rollPicks` and `LEAN_MATCH` are built and unreachable.
3. **Mastery is the only live payoff of a lean.** A lean decides which auto a rank-III melt teaches. That is all a tag
   does in play.
4. **`tools/dropsim.ts` is out of date.** It runs depths 1-6, always raises pedestals, and ignores temper's
   `killPayout` 0.4. Its "committed 98% formed" is the formation rate of a game that isn't live. No voice should
   quote it for this round until it is fixed.
5. **The suites pin both trials off.** `tools/checks/lib.mjs` writes `'0'` for weight and tap push when the key is
   unset, so K-90F and the rest record the old game. Only `WEIGHT=1` runs report the live one.
6. **Three layers of numbers.** A part's numbers go def -> `tempered()` -> `weighed()`. Every retune has to be read
   through all three, and the card shows the last.
7. **Parts are cheap, shapes are not.** A part on an existing shape is data, an icon, a model builder in
   `partmodels.ts` and its words. A new shape touches about ten places: the `useAbility` case, targeting (`prefer`,
   `reaches`, `wouldPay`), the pose in `still.ts`, `partfx.ts`, `audio.ts`, `partmodels.ts`, `temperMod`, `weighed`,
   the HUD, and the checks.

## 1. What is a build

**The unit is the loop's root: the auto you picked and the state it sets.** He picks it once, early. Everything after
is hunting the parts that pay it.

How he knows by depth 2-3:
- He chose it (a pick card at the end of depth 1, PLACEHOLDER words). No guessing from tags.
- His auto leaves the state on bodies every beat, so he sees it in the first fight.
- Every card says one of three things, all computed from `sets`/`pays` against what he wears (`pairWith` today):
  "pays your haul", "sets your haul" (redundant, weaker), or nothing. A part that says nothing is still playable.
- The rim glyph on a paying button lights when a push would pay (`wouldPay`, exists).

What it wants next is one rule: **a payer in each slot you don't have one in.** The card can say "your arms have no
payer" (PLACEHOLDER). That is a count, not a guess, so it is cheap and never wrong.

## 2. The pieces

**How parts relate:** set up / cash in, through states. Rules stay as built: one multiplier a hit, cap x2
(`MUL_CAP`), a state from the payer's own slot pays nothing, the autos never pay, shatter carries a paid kill's excess.

**The two trial states** (from `design/synergy/PITCHES.md`, not built):

| state (PLACEHOLDER) | set by | paid how | where Still stands |
|---|---|---|---|
| hauled | the root strike (each strike drags a step in), Backdraft Vent, Rusted Hook | **no multiplier**: an area part catches every hauled body in 1.5x its reach | in the middle, still |
| pinned (was "slammed") | the root shot (a planted shot on a body within 1 u of a wall), Piston, Pressure Vent, Clamp Toss into a wall | x2, used up; the body is held in place 1 s, no stun | close to push, then back to shoot |

**The parts, mostly existing ones re-tagged.** A first cut, for the balancer and translator to argue:

| slot | haul: sets | haul: pays | pin: sets | pin: pays |
|---|---|---|---|---|
| head | - | Flare (its lob blast) | - | Focusing Lens, Ricochet Lens (banks off the wall it's pinned to), Patient Lens |
| torso | Backdraft Vent | Brace | Pressure Vent | Lure (burst) |
| arms | Rusted Hook | Scrap Cleaver, Frayed Cleaver | Piston, Clamp Toss | - |
| legs | - | Skid Plates, Kickstart | Kickstart (its shove) | Overrun |

- Gaps a new part must fill (on an existing shape): haul has no head setter and no legs setter; pin has no arms payer.
  Three new parts, all on existing shapes (a lob that pulls, a dash that drags, a punch that pays). About 6-8 parts
  a loop is the target.
- **Kickstart is a bridge:** it can set pin and pay haul. Two or three bridges are how a mixed loadout still works.
- Chill and mark stay live as they are, but are not roots in the trial. Their parts are the "unlooped" pool.
- **Pool vs picks:** 30 parts, a run offers maybe 15. With two loops of ~7 and 16 other parts, a committed player sees
  3-4 parts of his loop a run. That may be too few to hunt; the balancer has to say. If so, the dial is the drop
  filter (below), not more parts.
- **Showing and hunting the missing piece:** `rollPart` already takes a filter (`lean`). Change it to a loop filter.
  One drop in three (elites, exits, Plenty) is drawn from his loop, the way `LEAN_MATCH` was written to do.
- **Temper stays the way a drop matters late.** A part of your loop for a slot you already fill melts in.

## 3. How you fight

The two trial builds, in the hands:

- **Haul (PLACEHOLDER).** The close strike only; the planted shot is off for the run. Each strike drags its target a
  step in. He stands in the crowd and holds still. He watches the cinch on the floor and presses an area part when
  three bodies wear it. Moving away is giving up damage.
- **Pin (PLACEHOLDER).** The planted shot only; the close strike is off for the run. A planted shot on a body near a
  wall pins it. He pushes bodies onto walls with a part, steps back, plants, and his head part pays the pinned one.
  He watches walls. Standing in the crowd does nothing: there is no free hit at his feet.

Why this answers "the same verb at two lengths": each build loses one of the two autos, so where he stands is forced
by what he picked, not chosen fight by fight. The code cost is small: the switches exist, mastery already changes what
an auto does (`run.mastery`, `masteryHit`), and `stateMul` already treats a state set by the hand or the eye as paying
any slot.

**What the four buttons are for:** setters and payers of his loop, plus one or two parts from outside it (defence,
movement). The slots keep their jobs (head far, torso around, arms close, legs move). Changing the slot count is the
most expensive change in the code (`SlotName` everywhere, the save's four-slot `worn`, the models, the HUD arc), and
nothing in his verdict asks for it.

**The risk I can't settle from the code:** turning off one auto is a cost to the floor player and brings back dead time,
which is why the autos exist. The pin build has nothing at his feet. The balancer must say whether this breaks the
~1 in 5 floor; if it does, the fallback is "the other auto stays, at half damage", which is one constant.

## 4. Keep / cut / reshape

| system | call | reason |
|---|---|---|
| four slots | keep | No build reason to change; the most expensive thing in the code to change. |
| the hand and the eye | reshape | One is the build's root, the other off for the run. The root sets the loop's state. |
| leanings (`lean` tags) | cut as tags, reuse the plumbing | Nothing reads them in play. `lean` becomes `loop`; the glyph, the drop filter and `leanOf` carry over. |
| riders | cut the code | Dead since 28 Sep. Remove `rider`, `ride()`, `riderNext`, `riderLine`, the leancheck block. Less to read. |
| states | keep, make them the spine | The only part-to-part link in the code. Add hauled and pinned. |
| shatter | keep | It is what makes a pay matter on a pack. |
| temper (ranks I-III) | keep | The only reason a late drop matters. Kill payout x0.4 must be re-checked: hunting needs offers. |
| mastery (six, after rank III) | cut in this form | Its job (an auto sets a state) moves to the root at depth 1. The III melt just caps the rank. |
| pedestals | reshape | Two moments only: the root pick after depth 1, and one loop-drawn pick at exits. The code is there. |
| weight's numbers | keep, then bake in | It is on by default. Fold its multipliers into the defs once the trial lands, delete one number layer. |
| strain | keep | His call. Not touched. |

## 5. What the code makes cheap or expensive

Cheap (data, or a few lines):
- Re-tagging parts into loops; `sets`/`pays` arrays; drop filtering by loop.
- The root as a mastery granted at depth 1 (`run.mastery` is saved in the snapshot already).
- One auto off for the run (`closeHand` / `eye`).
- The card's pair words, the lit rim glyph, the pick card (`pause.choose`, used by mastery today).
- New log fields.

Moderate:
- Pinned: knowing that a shove ended on a wall. Clamp Toss already knows (`wallDamage` on a throw cut short); a shove
  slide needs the same test.
- Hauled: an area part's hit loop also catching hauled bodies out to 1.5x reach (nova and arc paths).
- The root pick moment and its resume.

Expensive (avoid in the trial):
- Any new shape, a new auto form, a fifth button, a slot change.

Hard whatever it costs to build: the tuning (does a pay matter in a 5 s fight), and whether four state looks
(rime, brackets, a wall crack, a floor cinch) read on a 62 px button and a phone screen.

## 6. Migration risks

**Save v3.** No version bump is needed if we follow three rules:
- **Never delete or rename a part id.** `repair()` prunes unknown ids from `found`, `turned`, `hook` and `history`
  without a word. A part we cut is retired by its drop gate instead (a new `DropGate` value that never drops). The
  Workshop reads unknown ids safely (`?? null`), but his history counts would be gone.
- **New snapshot fields are optional.** `RunSnapshot.root?: string`; absent means "no root" (a run from before the
  trial resumes as today's game). Never bump `s: 1`: any other value discards the run in progress.
- **Mastery ids:** a resume keeps only ids in `MASTERY` (`id in MASTERY`). If the root is a mastery id, add new ids;
  never rename the six.
- Deploy between runs, not mid-run: a resumed run built on today's rules would get the new drop filter mid-way.

**Playtest log.** Add, per depth: `root`, `loopOffers` / `loopTaken` / `loopLeft`, `pairedAt` (first depth with a
setter and a payer worn, per run), `hauledCaught` (bodies an area part caught by haul), `pins` (set, paid, expired),
and two posture numbers: `nearS` (fight seconds with an awake body within 3 u) and `wallS` (fight seconds Still
within 4 u of a wall). `states` and `paidBy` gain two keys; the readers must tolerate that. Keep `eyeBreaks` and
`handBreaks` for comparison; drop `riders`.

**Checks.**
- `tools/leancheck.ts` becomes a loop check (below). `tools/statecheck.ts` gains hauled (`mul` 1, never multiplies)
  and pinned.
- `tools/dropsim.ts` gets 9 depths (`RUN_DEPTHS`), the live `PEDESTALS_ON`, temper's payout, the root and the loop
  filter. Until then, no formation number counts.
- `lib.mjs` pins flip to the live defaults (weight and tap push on). K-90F and K-90 re-captured once, with the diff
  reviewed, before any build-layer change, so the build layer's own diff is readable.
- `stageb` K-W3d (Parry's dead slot) already fails by design; leave it, and mark it in the stage notes.

## 7. The first trial, staged

One pause switch, "builds" (PLACEHOLDER), on by default (he plays the live game; off = today, to compare).

**B0, the tools (no game change).**
- lib.mjs pins to weight + tap push on; re-capture K-90 / K-90F; dropsim to 9 depths, live pedestals, temper payout.
- Cut the rider code.
- Done when: every suite passes on the live defaults; dropsim's offers a run and takes a run land within 25% of his
  runs 23 and 24 (read from the log); `npx tsc` clean.

**B1, the data (inert).**
- `loop` on `AbilityDef` (replacing `lean`), `hauled` and `pinned` in `StateId`, the re-tags above, the three gap parts
  as defs (existing shapes, a sibling's model for now).
- Loop check: each trial loop has a setter in at least 2 slots and a payer in at least 3; no part sets and pays the
  same state; every loop part drops outside bosses; at most 3 bridges.
- Done when: the loop check and statecheck pass; with the switch off, K-90F is byte-identical.

**B2, the states in combat.**
- Pinned on a shove or throw ending within 1 u of a wall; held 1 s; x2 used up by a payer.
- Hauled on a pull; an area payer catches hauled bodies out to 1.5x reach; no multiplier.
- New check file `tools/checks/builds.mjs`, scripted fights:
  - K-B1: Backdraft + Cleaver, 4 hulks: at least 2 hauled bodies caught per Cleaver after a pull.
  - K-B2: Piston from 2 u off a wall, 20 casts: at least 80% pin.
  - K-B3: `paidBy.hand + paidBy.eye == 0`, `maxMul <= 2`, every pay crosses slots.
  - K-B4: on a boss, pins and hauls pay (no hold on a boss: it takes the hit only).
- Done when: K-B1..B4 pass; switch off, K-90F unchanged.

**B3, the root.**
- After depth 1's exit beam, a pick of two roots (PLACEHOLDER): haul (close strike only, drags) or pin (planted shot
  only, pins near walls). Saved as `root` in the snapshot; the other auto off until the run ends.
- K-B5: resume keeps the root; K-B6: the off auto never fires; K-B7: the root strike or shot sets its state on every hit.
- Done when: K-B5..B7 pass; a headless d1-d3 run with each root finishes the Assembler.

**B4, the hunt.**
- One drop in three from elites, exits and Plenty drawn from his loop (`rollPart` filter); one loop-drawn pick at each
  non-boss exit; the card words "pays your haul" / "your arms have no payer" (PLACEHOLDER).
- dropsim with roots: a committed chooser wears 2 payers of his root by d3 >= 60%, 3 payers by d6
  >= 80%; a random picker <= 30% at d6; no part taken > 2x its slot's median; every slot offers a loop part >= 0.5 a run.
- Done when: those lines hold, and `screens.mjs` passes with the new card words at all four phone sizes.

**B5, his runs.** Feel first, then the log.

## 8. Pass lines, and what each tool can answer

**His feel, asked before the numbers:**
1. By depth 3, did you know what your build was and what it wanted?
2. Did haul and pin feel different in your hands, not just on the numbers?
3. Did you go looking for a part, and did finding it change a fight?
4. Did losing the other auto feel like a choice or like a hole?

**The log, 4+ runs, 2+ of each root:**
- `pairedAt` <= 3 in at least 3 of 4 runs.
- With a pair worn: >= 0.5 pays a pack fight, >= 1.5 a heavy; the bonus is 15-33% of the payer's damage.
- Posture differs: haul runs' `nearS` share >= 1.5x pin runs'; pin runs' `wallS` share >= 1.5x haul runs'.
- `loopTaken / loopOffers` >= 50% (he wants them), and no single part >= 70% of 6+ offers (rule 6).
- `kills.part` share d1-2 within 10 points of today's 62-79% (the build adds, it doesn't shift the load to the auto).

**The simulator can answer:** formation by depth, offer and take rates per part and slot, the random picker's rate,
dead slots, always-takes, pool vs picks.
**Headless can answer:** state rates and pay value per scripted fight, on packs and bosses; that the invariants hold.
**Neither can answer:** whether the two builds feel different, whether four state looks read on a phone, whether
hunting feels like hunting, and the floor player's real finish rate (the curve model is a guess on few runs).

## 9. Where I disagree

- **With the brief: "effort is not the constraint".** Mostly true, but each new shape multiplies the check surface
  and the tuning. The trial adds no shape on purpose. New verbs come only if he says haul and pin don't differ enough.
- **With the leanings round: "the hand and the eye never change with what you wear".** That rule kept the autos from
  becoming a set bonus. The root is picked once, not worn, so it can't stack with parts, and rule 3 (no multipliers
  between parts) still holds: the auto sets, it never pays.
- **With the synergy round's ban on a shove from a free auto** ("Heavy Shot", defence from a free auto): pin's root
  doesn't shove; it only pins a body already near a wall. A part does the shoving.
- **LESSONS rule 2 (payoffs triggered by the enemy):** a pin needs the enemy at a wall; a haul pays only on bodies you
  pulled. Both are on the enemy, so I keep the rule. Rule 1 (two first) is why the trial is two loops.
- **With him, gently:** "very few parts" is partly true, but the trial needs about three new parts, not thirty. If
  the loops land, more parts come per loop. More parts first would repeat the "archetypes on paper" failure.

## Open for round 2

1. Balancer: does one auto off for the run hold the floor (~1 in 5)? If not, the other auto at half damage?
2. Balancer: 3-4 loop parts offered a run, is that enough to hunt? What drop share from the loop?
3. Translator: do a floor cinch (hauled) and a wall crack (pinned) read at phone size next to the rime and brackets?
4. All: root picked after depth 1, or at the start? After depth 1 lets him see one fight first; at the start makes
   depth 1 part of the build.
5. All: chill and mark, kept as the unlooped pool, or folded into haul and pin?
