# Build layer: brief

1 Oct 2026. A design round: four voices (balancer, translator, verifier, Claude), two rounds, then `PITCHES.md` to him.
Round 1: each voice writes `1-<voice>.md` alone. Round 2: each reads all of round 1 and writes `2-<voice>.md`. Nothing is
built until he picks.

## Why this round

His verdict after two full runs with weight + tap push on (1 Oct; log read in `design/lean/TRIAL-1.md`), in his words:

> the overall feeling of the game is hollow and easy.. I don't really feel threatened.. the only threat in this game is
> Assembler, the 2 other bosses are too easy and gimicky.. the parts by themselves are boring and are not really that
> different from each other, and they are very few.. and there is no sense of getting to a build or archetype.. the
> leanings on strike and shot are forced, and both are just ranged attack, one is just much shorter than the other.. I am
> happy with our progress but it really shows that we are very far from a real game

He chose to dig into **the build layer first**. Threat, bosses and run length come in a later round, tuned against the
builds this round produces. Polish (sounds, freeze feel, captions) is out.

## His answers for this round (1 Oct)

1. **Scope: everything is open.** The four slots-as-abilities, the hand and eye autos, leanings, riders, states, mastery,
   melting/temper, pedestals: all on the table. Keep a piece only if you can say what it does for a build.
2. **What a build should change most: what parts do together, and how you fight.** Parts that chain: one sets something
   up, another cashes it in, and you go hunting for the missing piece. And different verbs and positioning: builds that
   play differently in the hands, not just in the numbers. ("How strong you get" and "what you're afraid of" were not
   picked: they can follow from the above, but they are not the goal.)
3. **No reference game.** Design from his verdict. Don't lean on "like Hades / like X" in what you write for him; if a
   pattern comes from a game, describe the pattern itself.

## What exists today (read the code; this is the summary)

- **Body:** four slots (head, torso, arms, legs); each worn part is one button with a cooldown (`src/parts.ts`,
  `src/abilities.ts`). Twin-stick on a phone in landscape: left thumb moves, four buttons in an arc under the right thumb
  (`DESIGN.md` Layout: r96, 62 px, thumb-tested).
- **Autos:** "the hand" (close strike, 2.9 u, 10 dmg, breaks windups) and "the eye" (planted shot, 11 u, fires after 0.3 s standing still,
  pierces, 8 dmg). Both are on every Still. His complaint: they are the same verb at two lengths.
- **30 parts** (`design/CATALOG.md`), one lean tag each: close (13), marksman (16), none (1). Tiers are "different, not
  stronger". A run sees maybe half the pool.
- **Leanings** (`design/leanings/PITCHES.md`): tags that steer and label, no set bonuses. **Riders** on four parts fire
  on a hand break or an eye break (readies the button, 4 s cap).
- **States** (`design/synergy/PITCHES.md`, live): chilled and marked, set by autos (through mastery) and some parts, paid
  x2 once by paying parts; shatter. Slammed/hauled designed, not built.
- **Melting / temper** (`src/temper.ts`): a duplicate melts into the worn part, ranks I-III. **Mastery** (`src/mastery.ts`):
  melting past III masters an auto (Cold/Marking/Wide Strike, Cold/Marking/Splitting Shot), up to 6 a run.
- **Pedestals:** a pick of parts at certain beats; the lean match is built and off.
- **Strain:** a push (now a tap on a cooling button) fires at once for +2 strain; 20 ends the run. His call: strain stays.
- **Weight** (on by default since 1 Oct): ready casts carry a push's effects, heavier part numbers, packs x1.4-1.65 HP.
- **Run:** 9 depths, two roads, three bosses (the Assembler at d3, then the Arbiter and the Engine, `src/areas.ts`). His two runs:
  both reached home, **~14.5 min of play each (~1.6 min a level; DESIGN.md says 4-5)**, parts took 62-79% of kills.

## The history to beat (`design/builds/LESSONS.md`, read it)

Both earlier Still games failed at builds: one dominant build, generic-good picks, dead slots, archetypes on paper only,
one always-take, everything owned by fight 5 and coasting, multipliers stacking into one answer, payoffs that ignore the
enemy. LESSONS' nine rules came from that. They are the starting constraints. A voice may argue to drop or change one, but
must name what failure the rule was guarding against and why it won't come back.

Also settled and still holding: premium, buy-once, no grind (`DESIGN.md`); inside a run Still gets stronger, between runs
runs get wider, not stronger; the never-melt (floor) player finishes ~1 run in 5 and rounds judge by the median and the
investor first; Yanah's and Yuri's parts are his to write (leave a place, write nothing); cold for Still, ember for enemies.

## The questions

1. **What is a build in Still?** Name the unit a player commits to (a verb? a pair of parts? an auto? a body plan?) and how
   he knows, by depth 2-3, that he has one and what it wants next.
2. **The pieces.** How parts relate (set up / cash in, or something else), how many parts, how many per run, how a build
   forms inside 9 depths, how the "missing piece" is shown and hunted, and how a mixed loadout still works.
3. **How you fight.** 2-4 builds that play differently *in the hands*: where Still stands, when he moves, what he watches.
   What replaces or reshapes the hand and the eye so the base kit doesn't flatten every build into "the same verb at two
   lengths". What the four buttons are for.
4. **Keep / cut / reshape** each existing system (slots, autos, leanings, riders, states, temper, mastery, pedestals,
   weight's numbers) with a one-line reason tied to (1)-(3).
5. **The first trial.** The smallest build that would let him feel "I'm making a build" in a run or two. Pass lines from the
   playtest log and from his feel; what the simulator can and can't answer.

## Per voice

- **Balancer:** the maths. Pool size vs picks a run; how often a committed player forms each build by d3 / d6; a random
  picker's rate (must stay well below); combo value vs a generic-good part on packs and on bosses (fights are ~4-6 s, so
  setups that need long fights are worth nothing on packs: the synergy round found this); always-take and dead-slot risks.
  A runnable sim in this folder (`build-sim.mjs`) is welcome.
- **Translator:** each build turn by turn on the phone: what the thumbs do, what the screen shows, how the player reads the
  missing piece, the card and drop UX, and what each build looks like from 3 m away. Concrete parts (name, what it does,
  what it pairs with), 6-10 per build sketch.
- **Verifier:** the build against today's code: what stays, what is cut, what migrates (save v3, log fields, checks), the
  staged trial plan with "done when" per stage and its checks, and the risks. Read the code, not only the docs.
- **Claude (lead):** the frame, a lean in round 1, the synthesis.

## Rules for the round

- Write for him. Short sentences, plain words, numbers where they matter. No emojis. Mark every name and every line of
  player-facing words PLACEHOLDER (his to write).
- Round 1 alone; don't read the other `1-*.md` files. Round 2: read all four, say where you moved and why, and where you hold.
- Say where you disagree with him or the brief, with the reason. Don't protect the floor player by default.
- Effort to build is not the constraint (it is vibe-coded); content, tuning and how it reads on a phone are.

## Corrections (found by the verifier in round 1; read before round 2)

- **Riders were cut on 28 Sep** (`src/abilities.ts`: breaks are rare under pressure, a free ready sold what the push buys).
  The field and runtime remain; nothing fires.
- **Pedestals are off** (`PEDESTALS_ON = false` in `src/main.ts`, his call on 28 Sep, 0d37d12): exits raise nothing.
- **Mastery is the only live payoff of a lean.** The lean tags themselves do nothing in play.
- **`tools/dropsim.ts` models 6 depths with pedestals on and no temper**, so its formation figures describe a game that isn't live.
- **The check suites pin weight and tap push off** (`tools/checks/lib.mjs`, 1 Oct), so they test the old defaults, not what he plays.
