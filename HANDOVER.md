# Handover — 26 Sep 2026

For the next session. Read this, then `DESIGN.md` (the settled decisions), then the design
folder for whatever you're touching. Don't re-derive any of them.

## Start here: the owner's playtest

He's playing **three runs on the dev server** (the logs only save there): **hand only**, **eye
only**, **both** (switches on the pause screen: "close hand", "the eye"). Then he'll say which
he'd miss. Next session opens by reading `playtest.json` in the repo (git-ignored) and asking him.

What each entry now records: `hand` and `eye` (true / false / 'mixed'), per depth `fights`,
`pushes`, `breaks`, `deadTaps`, `quiets`, `strainIn/Out`, `hand` strikes, `shots`, `eye` shots,
`eyeCasts`, `drops/offered/taken/left/missed`; per part `offered/taken/left/from`; a raw `drops`
log; and every button press (`taps`: slot, ms, ready, result). Headless browsers never write it.

Then **close the switches** (keep what he'd miss, remove the switch), and start **replay step 2**
(below).

## Where it stands

Live at **https://adperez13-1986.github.io/still-action/** (every push to `main` deploys; the
service worker precaches; installable PWA). Repo public: `adperez13-1986/still-action`.
Direction for the project, in his words: *"premium quality little by little... maybe sell someday,
no obligation, no timeline."* No milestone plans or dates.

**The run:** one day, 6 depths, ~26 minutes. Area I (ruin, depths 1-2, the Assembler at 3), area II
(the Works at 4, the workers' quarter at 5, the Arbiter at 6), the walk home. Three endings (Broken,
Stopped, Home), every ending keeps everything, then the Workshop.

**The Line (area III) is merged into `main` but switched off** (`LINE_ENABLED` false; stage A of
four: the crossroads, the sidings, the station, trains). Save format is v3 (merged 26 Sep; a failed
upgrade now keeps the original save untouched). Stage B is later in the replay order.

## What changed on 26 Sep

- **Input:** ready buttons fire on the press, not the release (median press was ~0.5 s); a press
  within 120 ms of ready is a cast; hold-to-aim dropped. **The break rule is permanent** (a pushed hit
  breaks the wind-up it lands in; breaks went 1-in-46 → 8-in-20 once casts fired on press).
- **Strain floor:** a quiet never eases below half the strain carried into the depth (only Rest goes
  under), so strain is the run's resource (`QUIET_FLOOR`).
- **Saves:** a migration that throws keeps the original (`still-action.save.premigrate`) and plays in
  memory; `navigator.storage.persist()` is requested.
- **Performance** (the F5 Pro heated up): 60 fps cap, 5 fps paused/behind Broken, 30 fps in a still
  Workshop, grade merged into the output pass, adaptive pixel ratio; dev perf readout in the grade panel.
- **The thief** hides in a barrel in an elite's room and runs for the elite's drop; certain the first
  time, then 0.35 at depths 1, 2, 4, 5.
- **The hand** (switch "close hand"): within arm's reach the auto becomes a 10-dmg close strike; a
  cold ring shows the reach and the safe band against a hulk's slam.
- **The eye** (switch "the eye"): planted 0.5 s, the auto reaches 11 u and aims at leaders, then
  shooters and a carrying thief; head parts use the same order; never targets or wakes sleepers.
- **Cards** say "push" (Patient Lens, Overrun, Lure, Plumb Line); Focusing Lens aims at "your target".
- **Replay step 1:** drop counters in the playtest log, and a drop simulator on the real drop code:
  `npx tsx tools/dropsim.ts` (options at the top of the file; drop rules live in `src/drops.ts`;
  level snapshots in `tools/levels.json`, refresh with `copy(__census())`). Baseline: a chosen build
  is worn at the end in ~42% of runs; ~31 offers a run are for a filled slot and ~2 get taken.
- Engine question settled: stay on three.js/web; Godot only if phones can't hold 60 fps or consoles
  matter.

## The plan: `design/replay/PITCHES.md` (read it)

Direction (all four voices): **choices for depth, content only where it multiplies.** His play time
is the budget: one combat change and one economy change on trial at a time. His decisions: direction
yes; the +4-strain second pick at the Assembler **in**; wishes **yes** (placeholder crayon wishes
first, the kids' real drawings later); the hook-boss **on by default**.

Order:
1. ~~Counters and a drop simulator~~ (done).
2. **Picks on pedestals:** three parts on pedestals you walk into, beside each crawl level's exit beam
   (depths 1, 2, 4, 5), at the Assembler and at Plenty; the other two go back to the wall. Empty slots
   fill **only** from pedestals (the fourth button lights at the Assembler). Plus the +4-strain second
   pick at the Assembler. Tune with the simulator (target: a chosen build worn ~60%+).
3. Leaning tags (close, marksman, caster, keeper) on cards and the wall; one pedestal in three matches
   a leaning you wear.
4. Wishes on the corkboard, with save v4 (part history by name).
5. Enemy families, then the Mirrored champion (`design/variety/PITCHES.md` items 7-8).
6. A 6-rung rule ladder, with seeds.
7. The Line to stage B (`design/area3/`).
8. The maze remembers the hook (on by default).

Other design docs: `design/variety/PITCHES.md` (enemy variety and playstyles; items 1-3 and 6 built),
`design/premium/SUMMARY.md` (the gap list: top 3 fixed; settings screen, save export, first-run
welcome and slower wall-fill are next on it), `design/strain/PITCHES.md`, `design/area3/`.

## Open, his to write or tune

- Words: the Home ending ("[Adrian writes this line.]"), ending copy (`src/ending.ts`), the Wandering
  Drone's notebook line, captions "hold to push" / "hold · break it".
- Tuning by feel: `QUIET_FLOOR` 0.5, `END_ZOOM`, `ARRIVE_ZOOM`, the Arbiter (`lance.lockMs`,
  `guess.s`), the ring's opacity (`RING` in `handring.ts`), sound gains (`MACHINE`, `UI`).
- The Line: crossroads vs alternate (`ROAD_CHOICE`), the Handcar, the names.
- Patient Lens: keep, or fire on release (draw and release).

## How to work on it

- **Dev server:** `npx vite --host` in the repo; give him the LAN address (`ipconfig getifaddr en0`,
  port 5173). Start it when work resumes. **Don't edit code while he's playing on it**: Vite reloads
  the page mid-run.
- **Design:** the three design agents (balancer, translator, verifier) plus Claude as a fourth voice,
  two rounds, a synthesis `PITCHES.md` he reads, then a spec or a direct engineer brief. Then one fresh
  general-purpose engineer per step with a written brief; the lead reviews screenshots between steps
  (they catch flat looks the checks miss), commits and pushes each reviewed step. Fresh agents when
  context gets large (~400k).
- **Headless checks:** `npm i playwright-core` into the session scratchpad, launch with
  `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`. DEV hooks on
  `window` (see the big `Object.assign(window, …)` in `main.ts`): `__enter`, `__arena`, `__spawn`,
  `__step`, `__hold`, `__stick`, `__fire`, `__equip`, `__end`, `__continue`, `__killBoss`, `__gen`,
  `__runStats`, `__drops`, `__hand`, `__eye`, `__flags`, `__census`, and more. Screenshot to a new
  filename each time.
- **Commits:** he's been fine with a commit and push per reviewed step. Pushing redeploys the site.

## Code map

| File | What |
|---|---|
| `main.ts` | the run: phases, levels, loot flow, strain, quiet, endings, boss hooks, effects, DEV hooks, playtest save |
| `areas.ts` / `day.ts` / `look.ts` / `grade.ts` / `world.ts` / `perf.ts` | places, the day, the grade, fog, lights, frame pacing and adaptive resolution |
| `dungeon.ts` / `terrain.ts` / `kit.ts` / `crossroads.ts` / `line.ts` | levels, packs, arenas, the walk home, the crossroads, the Line's rails and trains |
| `combat.ts` / `hazard.ts` | enemies, packs, shots, abilities, breaks, the hand, the eye; the floor hazard |
| `enemy.ts` / `ranged.ts` / `charger.ts` / `lane.ts` / `swarm.ts` / `lobber.ts` / `thief.ts` | hulk, sentinel, ram, mites, Lobber, thief |
| `boss.ts` / `arbiter.ts` | the `Boss` interface and the Assembler; the Arbiter |
| `hide.ts` | enemy body materials |
| `abilities.ts` / `parts.ts` / `partfx.ts` / `partmodels.ts` / `pool.ts` / `drops.ts` / `loot.ts` | the 30 parts, their runtime, visuals, models, the pool, drop rules, the floor loot |
| `still.ts` / `handring.ts` / `sightline.ts` | the Lantern; the hand's ring; the eye's sightline |
| `workshop.ts` / `save.ts` / `notebook.ts` / `crayon.ts` / `ending.ts` | the Workshop, the save, the notebook, the kids' drawings, ending words |
| `hud.ts` / `pause.ts` / `style.css` / `camera.ts` | UI, pause (with switches) and compare, type, zoom |
| `vfx.ts` / `audio.ts` / `music.ts` / `ambience.ts` | particles and shaders; synth and samples; score; room tone |
| `tools/dropsim.ts` | the drop simulator (`npx tsx tools/dropsim.ts`) |
