# Handover — 26 Sep 2026

For the next session. Read this, then `DESIGN.md` (the settled decisions). Don't
re-derive either.

## Where it stands

A playable D2-style crawl on the phone. Live at
**https://adperez13-1986.github.io/still-action/** (every push to `main`
deploys via `.github/workflows/deploy.yml`; a service worker makes it work
offline after one load; installable as a fullscreen landscape PWA via
`public/manifest.webmanifest`). Repo is public: `adperez13-1986/still-action`.

**In the game now**
- Generated levels: a main path of 5x5 rooms and halls, 2–3 small side rooms,
  KayKit barriers (waist-high), photo-textured stone, ruins beyond the edge.
- Packs asleep in rooms; wake at 8u, leash at 16u, path around walls. Quiet
  (2.5s, nothing awake) = half missing HP back, strain −2.
- Hulk (slam), tripod sentinel (aim line, shots), ram (lane rush, from depth 2),
  swarf mites (a brood that bites as one, from depth 4), elites (Quick / Plated /
  Many / Warden), crates + repair scrap, shrines (Rest / Plenty).
- The Assembler boss every 3rd depth: 6 moves, 2 phases, stun on charge into
  a wall; all its attacks respect cover. Boss music at 124 BPM.
- Still = the "Lantern" design, starts with ONE random plain part, drops fill
  empty slots. Loot: walk over → take / compare (pauses). Icon buttons.
- Effects: particles + animated textured telegraphs (Still cold steel-blue,
  enemies ember). Recorded CC0 impacts/footsteps layered under synthesis,
  synthesized ambience, generative music.
- Two endings (sudden break / strain stop), "reached depth N".

## Resolved — phone crash on rotation (25 Sep)

Chrome showed "Aw, Snap" on the Poco when turned sideways. After deploying the
180ms resize debounce and the reload-on-`webglcontextlost` guard it works; the
exact cause was never confirmed (not reproducible on desktop). If it ever comes
back, `adb` is at `~/Library/Android/sdk/platform-tools/adb`: USB debugging on,
then `adb logcat | grep -iE "chromium|gpu|crash"` while it crashes.

## Done 25-26 Sep — the part pool and the new enemies

Built overnight at his request ("go ahead and implement, write the catalog and
I will read tomorrow"). **He hasn't played it or reviewed it yet.**
`design/CATALOG.md` is his one read, with keep/cut/rename columns and a list
of what to try on the phone. His answers there come before anything else.

- 30 parts (8 white / 16 blue / 6 gold) across 12 shapes, all dropping.
  `src/abilities.ts` holds them as data; runtime state lives in `src/parts.ts`,
  lasting visuals in `src/partfx.ts`. All strain goes through `addStrain` in
  `main.ts`.
- The ram (`src/charger.ts`, lane tell in `src/lane.ts`) from depth 2, and
  swarf mites plus the brood (`src/swarm.ts`, instanced) from depth 4. Packs
  are budgeted in body-equivalents in `dungeon.ts`.
- Design passes and specs: `design/parts/1-balancer.md`, `2-translator.md`,
  `3-spec.md`, and the same for `design/enemies/`. `design/CONTEXT.md` is the
  brief the agents got.
- Open for him: shot trails (`combat.vfx` is never assigned, so Combat's
  trails don't draw; one line, left for him to see first) and knockback
  running about 8% past its number.
- Headless suites (session scratchpad, not in the repo, so rebuild them if
  needed): parts 122 checks, enemies 77, plus soaks. The DEV hooks they use
  are in `main.ts`: `__arena`, `__spawn`, `__step`, `__fire`, `__equip`,
  `__stick`, `__pack`, `__until`, `__gen`, `__mix` and others. Run every check
  inside one synchronous `page.evaluate`.

## Other open items (his to pick, none started)

Node map between areas · meta layer (found parts
join the pool across runs; the Workshop where Yanah and Yuri are) · Still
visibly wearing his parts · boss hydraulics/servo sounds, UI clicks · the
ending words (still a draft — his to write) · gold drops vs Grace's warm light.

## How to work on it

- **Dev server:** `npx vite --host` in the repo, then give him the LAN
  address (`ipconfig getifaddr en0`, port 5173). Start it as soon as work
  resumes; stop it when the session ends. He tests every change on his Poco.
- **Shortcuts:** `?depth=3` starts at the boss with all four plain parts.
  `look.html` and `lineup.html` are disposable dev pages (art look test, Still
  designs).
- **Tuning:** the in-game grade panel has sliders for grade, sound mix and
  zoom; "save values" writes `grade.json` / `mix.json` / `zoom.json` / `kit.json`
  (gitignored) via a dev-server endpoint — copy values into code by hand.
- **Headless checks:** `npm i playwright-core` into the session scratchpad,
  launch with `executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'`.
  In dev, `window.__combat`, `__still`, `__level()`, `__loot`, `__hud`,
  `__world` expose state. Screenshot to a *new* filename each time (the image
  reader caches by path).
- **Commits:** he says "commit" when a round feels right; don't commit
  unasked. Pushing redeploys the live site.

## Code map

| File | What |
|---|---|
| `main.ts` | the run: phases, levels, loot flow, pause, quiet, boss hooks, effects wiring |
| `dungeon.ts` | level generator, terrain (walls, pathing BFS), packs, elites, crates, shrines, boss arena |
| `kit.ts` | KayKit loading, triplanar photo skin, instanced drawing |
| `terrain.ts` | the one "what's solid" interface |
| `combat.ts` | enemies/packs, bolts/shots, abilities + mods, waves, pull, breakables |
| `enemy.ts` / `ranged.ts` / `boss.ts` | hulk, tripod sentinel, the Assembler (`BOSS` numbers) |
| `charger.ts` / `lane.ts` / `swarm.ts` | the ram and its lane tell, swarf mites + the brood |
| `parts.ts` / `partfx.ts` | part runtime state and constants, lasting part visuals |
| `still.ts` | the Lantern model, walk, attack animations, dash ghosts, break-apart |
| `abilities.ts` / `loot.ts` / `pause.ts` | parts + mods, drops/treasure classes, compare/loadout screens |
| `vfx.ts` | particles, debris, telegraph shader (`tellMaterial`), `DECAL_Y` in `world.ts` |
| `audio.ts` / `music.ts` / `ambience.ts` | synth voices + recorded layers, score, room tone |
| `hud.ts` / `style.css` / `ending.ts` / `camera.ts` / `grade.ts` | UI, type, endings, dynamic zoom, tuning panel |
