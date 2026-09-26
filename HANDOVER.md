# Handover — 25 Sep 2026 (evening)

For the next session. Read this, then `DESIGN.md` (the settled decisions), then
the design folder for whatever you're touching. Don't re-derive any of them.

## Where it stands

A complete run, playable on the phone. Live at
**https://adperez13-1986.github.io/still-action/** (every push to `main`
deploys via `.github/workflows/deploy.yml`; the service worker precaches
everything, so it works offline after one load; installable as a fullscreen
landscape PWA). Repo is public: `adperez13-1986/still-action`.

**The run** (`design/meta/DESIGN.md`): one day, 6 depths, about 26 minutes.
- Area I: depths 1-2 (the ruin), the Assembler at 3. After it: the cold beam on,
  or the warm beam home.
- Area II: depth 4 the Works, depth 5 the workers' quarter, the Arbiter at 6.
  Then the walk home to the lit house at night.
- Three endings: Broken (HP), Stopped (strain 20), Home (the warm beam). Every
  ending keeps everything. After each, the Workshop (`src/workshop.ts`): the
  bench, the hook by the door, the wall of parts, the corkboard of the kids'
  drawings, the notebook, the doorframe.

**Enemies:** hulk, sentinel, ram, swarf mites (+ the brood, the slag heap), the
Lobber (sentinel variant, area II), the thief (depth 2 only, steals a floor
part), elites. Bodies each have their own metal (`src/hide.ts`); **ember is only
for threats** (cores, eyes, seams, tells). Keep new enemies on that rule.

## What happened on 25 Sep (a long day)

- Area II step 7, the thief (ceb3b07). Heat caption clamp.
- **Strain:** his diagnosis was "the thought [of pushing] never comes up". A
  4-voice pitch round (`design/strain/PITCHES.md`) agreed the problem is demand,
  not cost. Built:
  - **Step 0** (420cc8f): a cooling button shows its price, the hold draws a
    ring, a dead tap answers, the strain bar draws the free push. Starter pool
    swapped (Patient Lens and Overrun in).
  - **Step 1** (b941782), **behind a switch, OFF by default** (pause screen:
    "push breaks wind-ups"): a pushed hit breaks the wind-up it's aimed at;
    pushed casts aim at the soonest wind-up.
  - **He owes three measured runs** with the switch OFF, on the dev server (the
    numbers only save there): `playtest.json` in the repo (git-ignored), written
    by `savePlaytest` in `main.ts`. Headless browsers never write it. Read
    pushes, dead taps, breaks and tap ms per fight before building step 2
    (the Assembler's grill locks, the Lobber's heat). Then he flips the switch.
- Broken is now "sudden, then slow" (eeba3b1). All endings close in on him
  (a83ce28), and the Workshop arrival opens as a 3x close-up (00af940).
- Enemy body materials (531185e). A beam that opens under him no longer takes
  him (4253a7a).
- **The Arbiter was trivially easy** (circling dodged every lance). Now the lance
  leads a moving target from how he dodged his last three, and phase-2 shells
  chip posts (8af9f4f). Tuning knobs: `lance.lockMs`, `guess.s` in `arbiter.ts`.
- Lobber melt disc and shells, boss hydraulics/servos, UI clicks (4a1471f).
- **Area III, "the Line"** (a rail yard with timetabled trains), designed while
  he was away: `design/area3/PITCHES.md` (read this) and `SPEC.md`. Decided for
  him and flagged: a crossroads room after the Assembler picks the road; the
  Engine boss; Signalman, Handcar, Sleepers. Building behind `LINE_ENABLED`.
  STATUS: see the bottom of this file.

## Open, his to decide or write

- Area III: crossroads vs alternating roads; the Handcar; the names.
- Words: the ending copy (`src/ending.ts`), the Home ending's words, the
  Wandering Drone's notebook line, the captions "hold to push" / "hold · break
  it" (placeholders).
- Phone tuning: the Arbiter's new lead, Broken's slow-mo length, the close-up
  zooms (`END_ZOOM`, `ARRIVE_ZOOM`), the new sound gains (`MACHINE`, `UI` in
  `audio.ts`).
- Parked design: the old town under the clock (`design/area3/1-translator.md`)
  as a fourth area; elites that read your buttons; the runaway thief.
- Old: shot trails never wired (`combat.vfx`), knockback ~8% over.

## How to work on it

- **Dev server:** `npx vite --host` in the repo, then give him the LAN
  address (`ipconfig getifaddr en0`, port 5173). Start it as soon as work
  resumes; stop it when the session ends. He tests every change on his Poco.
- **Design:** the three design agents (balancer, translator, verifier) plus
  Claude as a fourth voice, two rounds, a synthesis `PITCHES.md` he reads, then
  the verifier writes `SPEC.md`. Then one fresh general-purpose engineer per
  step with a written brief, stepped with SendMessage; the lead reviews
  screenshots between steps (they catch flat looks the checks miss).
- **Tuning:** the in-game grade panel (grade, mix, zoom) saves `grade.json` /
  `mix.json` / `zoom.json` / `kit.json` (gitignored) via the dev-server endpoint.
- **Headless checks:** `npm i playwright-core` into the session scratchpad,
  launch with `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
  DEV hooks on `window` (see the big `Object.assign(window, …)` in `main.ts`):
  `__enter(d)`, `__arena`, `__spawn`, `__step`, `__fire`, `__equip`, `__end(kind)`,
  `__continue`, `__killBoss`, `__gen`, `__runStats`, `__breakRule`, and more.
  Run each check inside one synchronous `page.evaluate`. Screenshot to a new
  filename each time (the image reader caches by path).
- **Commits:** normally he says "commit" when a round feels right. On days he
  asks for work while away, commit each reviewed step; push only what's
  finished or behind a flag. Pushing redeploys the live site.

## Code map

| File | What |
|---|---|
| `main.ts` | the run: phases, levels, loot, strain, quiet, endings, boss hooks, effects wiring, DEV hooks, playtest save |
| `areas.ts` / `day.ts` / `look.ts` / `grade.ts` / `world.ts` | places and their looks, the day moving with you, the colour grade, fog, lights |
| `dungeon.ts` / `terrain.ts` / `kit.ts` | level generator, packs, arenas, the walk home; what's solid; KayKit + photo textures |
| `combat.ts` / `hazard.ts` | enemies, packs, shots, abilities, breaks; the shared floor hazard |
| `enemy.ts` / `ranged.ts` / `charger.ts` / `lane.ts` / `swarm.ts` / `lobber.ts` / `thief.ts` | hulk, sentinel, ram, mites, Lobber, thief |
| `boss.ts` / `arbiter.ts` | the `Boss` interface and the Assembler; the Arbiter |
| `hide.ts` | enemy body materials (the palette table) |
| `abilities.ts` / `parts.ts` / `partfx.ts` / `partmodels.ts` / `pool.ts` / `loot.ts` | the 30 parts, their runtime, visuals and models, the pool, drops |
| `still.ts` | the Lantern: walk, attacks, break-apart, reassembly |
| `workshop.ts` / `save.ts` / `notebook.ts` / `crayon.ts` / `ending.ts` | the Workshop, the save, the notebook, the kids' drawings, ending words |
| `hud.ts` / `pause.ts` / `style.css` / `camera.ts` | UI, pause/compare, type, dynamic zoom |
| `vfx.ts` / `audio.ts` / `music.ts` / `ambience.ts` | particles and tell/melt shaders; synth + samples; score; room tone |

## Area III build status

**Stage A done, on the branch `the-line`, not merged into `main`** (14a9ee7 A1,
e86479d A2, d056120 A3, c06fcae A4). It's dark behind `LINE_ENABLED`, but A1
moves the save to v3, which isn't behind a flag, so `main` (what deploys) stays
without it until stage B passes and he's seen it. Merging to `main` and pushing
would migrate his phone save. Work on stage B with `git checkout the-line`.
- A1: `RouteId`, the flags (`?line=1`, `?route=III`, `?crossroads=1`,
  `__flags`), save v3 (`roads`, `lastRoad`, history length 8).
- A2: the crossroads room after the Assembler (`src/crossroads.ts`), two
  labelled road beams, resume there; the alternate fallback via `ROAD_CHOICE`.
- A3: the sidings (4) and the station (5): rails, sleepers, lane lamps, wall
  gaps, gantries, sidings with buffers and dead wagons (`src/line.ts`). Line
  levels have corridors of at least 4 cells so rails can run out (a spec
  deviation, accepted). Gravel023 texture added (+262 KB, 5.27 MB total).
- A4: trains: seeded timetable, lit-rail tell with ember lamps, segment
  hazards, shove, crates smashed, the harmless lesson train, step-off, the
  brood rule, synth hum/horn/clacks.
- Checks: `scratchpad/line/a1..a4-checks.mjs` (13, 18, 10, 14, all passing);
  flags-off `__gen` byte-identical to before. The session scratchpad is
  temporary, so the spec's §12 is the source if the scripts are gone.
- The soak (25 Sep) found no regressions on either branch. Two notes for B:
  station trains can take 25-36 s to start (they wait for the room to wake);
  the Workshop's geometry count grows by 2-3 after some station visits
  (something small isn't disposed).
- **Next: stage B** (B1 Signalman, B2 Handcar, B3 Sleepers, B4 the Line's
  ambience/music), the safe stop, then turn `LINE_ENABLED` on, push, and let
  him play it. Stage C is the Engine. Use a fresh engineer per step.
