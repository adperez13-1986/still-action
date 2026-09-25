# Home: the Workshop, the pool, and a complete run

Settled 26 Sep 2026 from `PITCHES.md` (the four-voice pitch round). Adrian
picked the hook by the door, turning parts to the wall, and a run shorter than
41 minutes, and asked for the suggested bundle. Not built yet.

---

## Principles (agreed by all four voices)

- **Every ending keeps everything.** No ending costs parts, progress or
  history. The endings differ in how they look and sound, never in what you
  keep.
- **Yanah and Yuri are home from the first night.** Nothing unlocks them.
  When their two *parts* can drop is Adrian's to decide, along with what the
  parts do.
- **No currency.** Nothing is farmed or spent. Things open because a moment
  happened.
- **Wider, never stronger.** No choice between runs makes a later run
  stronger than an earlier one.

---

## A complete run: one day, two areas, home

About 26 minutes. It replaces today's endless descent.

| | depths | light | ends in |
|---|---|---|---|
| Area I | 1, 2, then the Assembler at 3 | morning into noon | two beams: cold (on) or warm (home) |
| Area II | 4, 5, then the Assembler at 6 | afternoon into dusk | the warm beam only |
| The walk home | a short authored path | night, only Grace's light | the lit house, then the Workshop |

- **The warm beam.** When an Assembler falls, a warm beam opens beside the
  cold one. Walking in is the third ending, **Home**, and it needs Adrian's
  words. After the second Assembler it's the only way out.
- **A run is one day.** Each area has its own grade and fog preset, so the
  depth *is* the time of day: no clock, no timer. The Workshop window shows
  the hour the run ended.
  - Home after the first Assembler: afternoon, the kids awake.
  - Home after the second: night, the kids asleep.
  - Broken or Stopped: whatever hour it happened.
  Going home early is a different homecoming, not a lesser one.
- **The Assembler, twice, never stronger.** Always 900 HP. The first is as it
  is today. The second's assembled adds are rams and mites instead of hulks.
- **The walk home.** The last "level" has no enemies: a short path up to a
  small lit house in the ruins (the Workshop seen from outside). Walk in and
  it fades straight into the room.
- **Saved at every beam.** Leave mid-run and you resume at the start of the
  depth you were on. The save needs a version, because a deploy can change
  parts and packs under a run in progress.

**Recommended defaults for the splits nobody settled** (change any):
- **Warm beam after the first Assembler: yes.** With only two bosses, it's the
  run's one real decision. It isn't a farm, because unfound parts come at the
  same rate per minute either way, and no ending pays more than another.
- **No "Sit down".** The warm beam is the chosen exit. Stopped stays something
  that happens to Still.
- **Quiet −2 → −1** is a feel test for the phone, not a decision. With a
  6-depth run, check whether Stopped is reachable at all before touching it.
- **Workshop room tone:** synthesized, unless Adrian wants to record his own.

---

## The Workshop: coming home

A small iso room in the same engine, and the only warm place in the game.
Grace's light is its lamp. Footsteps change from stone to wood at the
threshold. Still walks around with the stick and interacts by walking up to
things, with no menus. The way out is a cold beam in the doorway.

**Arriving, one way per ending:**
- **Broken:** Still comes in in pieces and is put back together on the bench
  (today's `breakApart`, played backwards).
- **Stopped:** whole but dim, and the room's light slowly brings his eye back
  on (today's `setSlowdown`, reversed).
- **Home:** he walks in through the door.

**In the room:**
- **The hook by the door.** At every ending you hang one part Still was
  wearing on the hook, gold excluded, and the next run starts with it on.
  - Run 1 starts with a random white, as today.
  - If he was wearing only gold, the hook takes nothing and the next run
    starts with a random white.
  - If he was Broken, he still chooses. The pieces all come home.
- **The wall of parts.** One hook per part.
  - Found parts hang lit. Unfound ones are bare outlines with a hint of where
    they live ("an Assembler carries this").
  - **Turn a part to face the wall** and it stops dropping; turn it back any
    time. Every slot keeps at least one white facing out.
  - The hook by the door never takes a turned part.
- **The corkboard.** One card per run. The card is the drawing (below), with
  the run's strain line along its bottom edge and a caption: the date, the
  ending, and the depth. The number goes in the caption, not the headline.
- **The kids' drawings.** Yanah or Yuri redraws the run's last frame in
  crayon: the engine's final frame through a crayon shader, with wobbly lines
  and flat fill. Which child drew it alternates.
- **The doorframe.** Pencil height marks for Yanah and Yuri. They grow with
  real calendar time since the first run, not with runs played.
- **The kids themselves:** present from the first night, how is still open.
  Round 1 offered two ways: figures in the room, or traces only (just out of
  frame, heard, their things left around). Traces are cheaper and need no
  character models. **Adrian's call**, like their parts.

---

## Meta progression: the wall fills

- **The pool starts at 12:** the 8 whites plus 4 blues (Cracked Lens, Backdraft
  Vent, Rusted Hook, Skid Plates, the ones that bend the four starting whites
  most plainly).
- **Unfound parts come from moments, not kills.** Elites, the Assembler and
  Plenty can drop a part you've never seen; ordinary kills and crates only drop
  found parts. Nothing unfound drops at depth 1, so ending runs early doesn't
  pay. The wall should be full in about 10-12 runs.
- **A found part joins the pool the moment you pick it up.** It's saved then,
  not at the ending, so closing the tab can't lose it or be used to keep it.
- **Parts remember.** Each part card shows a line of history ("carried 4
  runs, saw depth 6"). A part worn through an Assembler fight drops with a
  name next time: *Scrap Cleaver, that saw the Assembler*. No stats change.
- **The notebook.** A book in the Workshop. The 43 enemy names from the
  original `still` come back as the names of the enemies Still meets (a hulk
  might be a "Rust Guard", a mite a "Fracture Mite"), and each one met gets a
  page. Only a couple of the old enemies had flavour lines, so the rest are
  blank to write. **Adrian writes them, or asks for drafts.** Knowing the maze
  is the one progress that doesn't break "your first runs are bad by design".
- **Later, not now:** "doors, not upgrades" (map node kinds that open once
  from a moment) and Still's body showing marks.

---

## Save

One versioned key, `still-action.save`. Every project on
`adperez13-1986.github.io` shares one `localStorage`, so every key needs a
prefix, and the `still.pushHint.*` keys from step 7 get renamed.

- **In `localStorage`** (well under 20 KB): the found set, the turned set, the
  hook part, part histories, notebook entries, the first-run date, run cards
  (without images), and the in-progress run at its last beam.
- **In IndexedDB:** the crayon drawings (about 50-100 KB each). If IndexedDB
  isn't available, the card shows its strain line alone.
- Everything is wrapped in try/catch. A private window gets a Workshop that
  forgets.

---

## Build order (vibe-coding evenings, estimates)

| # | step | about | playable after |
|---|---|---|---|
| 1 | The warm beam, run capped at 6, third ending (placeholder words) | 1 | a run has an end |
| 2 | Save module and prefixed keys; the found pool (start at 12, unfound from moments) | 1-2 | runs start to matter |
| 3 | The Workshop room: walkable, warm, cold-beam door; the three arrivals | 2-3 | coming home |
| 4 | The hook by the door; the wall of parts with turning | 1-2 | the choice between runs |
| 5 | One day: per-area grade and fog, the window hour, the walk home to the lit house | 2 | the run's shape |
| 6 | Corkboard cards with strain lines; kids' crayon drawings (IndexedDB); the doorframe | 2 | the history |
| 7 | Parts remember; the notebook | 1-2 | the past you can read |
| 8 | Resume at a beam; the second Assembler's adds | 1 | a phone-proof run |

Roughly 11-15 evenings. The hard part isn't the code. It's the room's feel,
the three arrivals, and the words.

**Adrian's before step 1:** the Home ending's words (the other two are still
drafts too). **Before step 3:** whether the kids appear as figures or as
traces.
