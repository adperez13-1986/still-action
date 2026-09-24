# Handover — 24 Sep 2026

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
- Hulk (slam), tripod sentinel (aim line, shots), elites (Quick / Plated /
  Many / Warden), crates + repair scrap, shrines (Rest / Plenty).
- The Assembler boss every 3rd depth: 6 moves, 2 phases, stun on charge into
  a wall; all its attacks respect cover. Boss music at 124 BPM.
- Still = the "Lantern" design, starts with ONE random plain part, drops fill
  empty slots. Loot: walk over → take / compare (pauses). Icon buttons.
- Effects: particles + animated textured telegraphs (Still cold steel-blue,
  enemies ember). Recorded CC0 impacts/footsteps layered under synthesis,
  synthesized ambience, generative music.
- Two endings (sudden break / strain stop), "reached depth N".

## Open bug — check first

**Chrome crashes on the Poco ("Aw, Snap": blank white page, sad face top-left)
when the phone is turned sideways**, installed or in the browser. Not
reproducible on desktop Chrome with phone emulation (heap flat 11–14MB, no GL
errors, 20 textures ~6MB — so not texture memory). Deployed as a guess:
resizes debounced 180ms, reload on `webglcontextlost` (commit after
`e1767a7`). If it still crashes: `adb` is at
`~/Library/Android/sdk/platform-tools/adb` — have him connect the Poco by USB
with USB debugging on, then `adb logcat | grep -iE "chromium|gpu|crash"` while
it crashes to get the real cause (a shader the mobile GPU rejects? OOM?).
Suspects: the kit's triplanar skin shader, the particle point sprites, the
telegraph shader. He was last seen playing fine on the LAN dev build *before*
the boss-music/windup/deploy changes.

## Next up — agreed, not started

**Design the real part pool with the three design agents** (at
`~/.claude/agents/`: `game-balancer`, `game-translator`, `game-verifier`),
run in sequence, each prompt self-contained (they start with no context):

1. **game-balancer** — ~30 parts over 4 slots × 3 tiers; sidegrades not
   upgrades; modifiers that change play (his ideas: a bolt that truly pierces
   everything, a bolt that bounces); synergy map; broken-combo hunt
   (cooldown loops, permanent CC); strain interactions; drop tables per
   archetype.
2. **game-translator** — per part: the phone read, Still's animation beat,
   VFX in the cold language, SFX concept (synth vs recorded layer), name and
   one-line card text.
3. **game-verifier** — buildable spec: data contract (`AbilityDef` + `Mod` in
   `src/abilities.ts`), exact rules and edge cases, which parts need new
   systems, build order cheapest-first.

Then consolidate, and **Adrian reviews the catalog once (keep / cut / rename)
before any code.** Keep **Yanah's and Yuri's parts out** of the agents' work —
they're his to write. Brief the agents with these constraints:

- One part = one ability, no stat blocks. Tiers mean *different*, never
  stronger (white plain, blue one twist, gold a named oddity).
- Runs get wider, not stronger. Premium/buy-once design — no grind.
- Rules are symmetric: walls block both sides; cover works against everything.
- Every threat is telegraphed and committed. Phone readability first.
- Colour language: Still's effects cold steel-blue, enemies' ember.
- Existing shapes: `bolt`, `nova`, `arc`, `dash`; existing mods: `pierce`,
  `pull`, `hook`, `slam`, `fan`. Current numbers are in `src/abilities.ts`.

## Other open items (his to pick, none started)

Charger + swarm archetypes · node map between areas · meta layer (found parts
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
| `still.ts` | the Lantern model, walk, attack animations, dash ghosts, break-apart |
| `abilities.ts` / `loot.ts` / `pause.ts` | parts + mods, drops/treasure classes, compare/loadout screens |
| `vfx.ts` | particles, debris, telegraph shader (`tellMaterial`), `DECAL_Y` in `world.ts` |
| `audio.ts` / `music.ts` / `ambience.ts` | synth voices + recorded layers, score, room tone |
| `hud.ts` / `style.css` / `ending.ts` / `camera.ts` / `grade.ts` | UI, type, endings, dynamic zoom, tuning panel |
