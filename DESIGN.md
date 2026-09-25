# Still — action roguelite

Descendant of the `still` deckbuilder and `still-merge`. Same protagonist, same
emotional core: an incomplete robot assembling itself out of what it survives,
and every run ends with encouragement regardless of outcome.

Built for fun. This is not a shipping commitment, and it deliberately has no
OpenSpec — that goes in if the spike lands.

---

## Settled decisions

Worked out as a design tree over four rounds before any code. Sixteen decisions,
all confirmed.

**Controls.** Virtual twin-stick: left thumb moves, four ability buttons under the
right thumb, one per body slot. An auto basic attack fires at anything in range so
there is never dead time. Tap fires at an auto-picked target; hold aims (unbuilt).

**Camera.** Fixed 3/4 isometric, orthographic, 38°, never rotates. Dynamic zoom and
screenshake stand in for a live camera. The lock is what makes the art affordable —
every angle is known, so lighting can be baked and unseen faces never modelled.

**Run structure.** Node map between areas → open-topped modular dungeons you crawl.
Walls stay waist-to-chest height so nothing ever occludes the camera. Cost of that
choice: you always see *over* walls, so every space needs a plausible beyond.

**Enemies.** Four archetypes — chaser, ranged, charger, swarm — each an
`idle → approach → windup → strike → recover` machine. The 43 enemies in `still`
port as *data* (names, hp, drops, flavour, sector), never as behaviour; their
`Intent[]` cycles are turn-bound and dead here.

**Progression.** Four slots: Head, Torso, Arms, Legs. Each equipped part **is** one
ability with a cooldown — loot rewires your buttons. Ported from the deckbuilder's
`EquipmentDefinition`, which carried one `BodyAction` and no stat block.

**Strain.** Hold a *cooling* button to push it: fires now at full power, +2 strain.
Persists across fights, decays 4 per fight cleared, forfeits the run at 20. HP is
the fight; strain is the run. You can win every fight and still stop.

**Endings.** Two, deliberately different. HP death is sudden. Strain forfeit is
Still slowing down, and stopping.

**Persistence.** Parts you find enter the findable pool permanently. Runs get
*wider*, not stronger, plus a small workshop upgrade track. No power-creep curve —
"your first runs are bad by design" contradicts the only line this game is about.

**Family.** Grace is the one warm light in a cold palette, carried, navigated by —
not a unit. Yanah and Yuri are two rare parts that are unmistakably theirs,
protective rather than strong. The Workshop between runs is where they are.
Explicitly *not* companion entities.

**Art.** CC0 low-poly modular kits. The D2 read comes from the grade, not the
models: hard desaturation, one warm source, cold everything else, heavy fog, strong
vignette. Only Still's own parts get hand-work.

**Tech.** Vanilla three.js for the world, React above the canvas for UI once there
is UI. Fixed 60Hz timestep, interpolated render. No physics library — circles on a
plane, a grid for walls.

---

## Dungeon crawl (settled 24 Sep 2026)

Worked out in four grilling rounds after the spike. Replaces the single arena.

**Shape.** D2-style crawl: each level is generated fresh — a main path with 2–3 side
rooms, open corridors, no doors. ~6 packs, 4–5 minutes a level. Main-path rooms
5x5 cells (20 units — the first 12-unit rooms were too small for the ranged band,
the dash and the vent), a 5x3 hall now and then; side rooms, entrance and exit
stay 3x3. Corridors one 4-unit cell wide, cover scaled to room size. Rubble fades
into the fog beyond the edge; nothing tall on the camera side.

**Packs.** Groups placed in the level, asleep (dim, cores dark) until you come
within ~8 units; the whole pack wakes with a flash and an alert sound. No
chain-waking. A pack that loses you past ~16 units walks home and sleeps again.
Enemies path around walls.

**Quiet.** 2.5s with nothing awake = a fight cleared: half of missing HP back (with
a visible fill), strain −2, a chime and a small banner.

**Exit.** A cold beam, 9 units and fading as it climbs (a tall one painted a stripe
across the rooms behind it); Grace's light around Still
leans toward it. Walk in → fade → next depth, full HP, strain carries, no going
back. The exit is always open, even while chased.

**Depth.** Level 1: packs of 2–3 chasers, one ranged among them. Deeper: bigger
packs, more ranged, later archetypes by depth. Never more enemy HP or damage.

**Loot.** 0.66 ÷ pack size per kill (weighted: a mite counts 0.25), so a pack pays
about the same at every depth; side-room packs always drop. Parts stay on the floor until
you leave the level. The "next fight" button goes away.

**Camera** frames only awake enemies. **Ending** shows depth reached.

**Art.** KayKit Dungeon Remastered (CC0) for shapes — its `barrier` pieces are the
waist-high walls (`wall_half` is half-width, not half-height). Flat KayKit colour
read as clay, so every surface wears an ambientCG (CC0) photo texture projected
triplanar, plus grime and contact darkening. Only the pieces used are vendored.

### Added after the grilling (24 Sep)

- **Still is the Lantern**, picked from a lineup (`lineup.html`): open cage torso
  with a cold core, a lens on a stalk, bird legs, clamp and hook. Eye and core are
  pale cold, not amber — Grace stays the only warm light. Walk speed 5.5.
- **Enemies**: the chaser is a headless hulk that rears and slams; the ranged is
  a tripod sentinel whose lens swells as it locks.
- **Still starts incomplete**: one random plain part, three empty buttons, unfound
  parts drawn bare. While a slot is empty, 60% of drops fill one.
- **Elites** (D2 champions): a named leader, bigger, double HP, blue aura, one of
  Quick / Plated / Many / Warden. Always drops, 75% blue, 10% gold.
- **Crates and barrels** break to any hit, either side's; 10% hold a part, 30%
  repair scrap (+20 HP). This replaces "no extra healing".
- **The Assembler** closes every third depth: a 28x28 arena, six moves in two
  phases (sweep, shockwave with safe lanes, barrage, charge that stuns on a wall;
  overloaded at 55% adds assemble and magnet). Numbers in `BOSS`, `src/boss.ts`.
  `?depth=3` starts there with all four plain parts.
- **Effects** (`src/vfx.ts`): particles and animated textured telegraphs. Still's
  effects are cold steel-blue, the enemies' are embers. Floor decals sit at
  `DECAL_Y`, above the kit's tiles.
- **Shrines**, most levels: Rest (−6 strain, wakes the nearest pack) or Plenty (a
  good part for +4 strain, which can end the run).

---

## Spike scope

Answers one question: does moving Still and hitting something feel good on a phone.

**In:** one arena, movement, auto-attack, four real cooldowns, tap/hold, chaser and
ranged, strain with push-fire, HP, both endings as text, iso camera with zoom and
shake, the colour grade, three sound files.

**Out:** dungeon generation, node map, drops, inventory, Workshop, meta, family,
charger, swarm, bosses, 26 of the 30 parts.

**Judged on a phone over LAN**, against one question: do you want to press the
button again. Second criterion, equally binding: is building it still fun.

---

## Open

- **Hold means two things.** Hold-to-aim and hold-to-push are the same gesture.
  Currently resolved by state — hold on a *ready* button would aim, hold on a
  *cooling* button pushes. Only the cooling half is built. Unsettled.
- **Endings copy is draft.** Both endings work; the words in `src/ending.ts` are
  placeholders to be rewritten by hand.
- **No win condition.** Fights escalate (3 + n chasers) until one of the two endings.
  Strain decay (−4/fight) may make two pushes per fight free forever — watch it.
- **Ranged archetype built** (`src/ranged.ts`). Holds 6–10 units, just past auto
  reach; aim line tracks for 60% of a 760ms windup, then freezes and clicks. Walls
  block projectiles from both sides, and the auto attack only takes clear shots.
  Charger (the ram) and swarm (swarf mites) are built since 26 Sep; see
  `design/CATALOG.md`.
- **Audio is first-pass.** All synthesised in `src/audio.ts` (Web Audio, no files).
  "OK for now" on the phone. Levels tune live in the grade panel and save to
  `mix.json`. The windup tone is panned and cuts at the strike — it is meant to be
  a second telegraph, not decoration.
- **Dynamic zoom built** (`src/camera.ts`): frames every threat, never below 0.7,
  drifts in to 1.1 between fights, small punches on impact. Dials live in the grade
  panel and save to `zoom.json`.
- **Drops and swapping built** (`src/loot.ts`, `src/pause.ts`). D2's structure, not
  its maths: treasure classes per archetype, tiers mean *different* not stronger,
  no stat affixes. Parts drop on the ground; walk over, take or compare (pauses).
  The old part drops at your feet. Swapped-in parts inherit the cooldown fraction;
  cooldowns run on game time. While loot is on the floor the breather waits for a
  "next fight" tap. The five non-white parts are placeholders.
- **Part ideas to explore:** a bolt that really pierces everything, walls included;
  a bolt that bounces.
- **Not built:** found parts joining the pool across runs (needs the meta layer);
  Still's body showing what he's wearing.
- **Grade defaults are guesses.** Tune live in-app, hit save, values land in
  `grade.json`.

## Part pool and new enemies (built 25-26 Sep 2026)

30 parts and the ram + swarm, designed by the three design agents and built the
same night. **`design/CATALOG.md`** is the one-page read (keep / cut / rename);
`design/parts/` and `design/enemies/` hold the full passes and the specs they
were built from. Settled alongside: a quiet needs a kill; Still's melee and
blasts need a clear line; no part lowers strain; a bigger hit inside the hurt
window deals the difference.

## Numbers most worth arguing with

| | | |
|---|---|---|
| `windupMs` | 520 | the most important number in the project |
| `AUTO_INTERVAL` | 0.62s | sets the tempo of everything |
| Still speed / chaser speed | 5.5 / 4.3 | kiting should work but not trivially (was 7.4) |
| `hitstop` | 45ms / 90ms | first dial if hits feel mushy |
| Cleaver cooldown | 2.6s | may be doing so much work the others don't matter |

## Layout

Variant A, locked after a thumb-reach test on the real device: fixed stick, tight
arc, r96, 62px buttons. A and B (r118) were indistinguishable in testing, so arc
radius is not a sensitive variable — don't spend more time on it.
`proto/hud.html` is the disposable reach-test page that settled it.
