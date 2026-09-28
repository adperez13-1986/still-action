# Handover — 28 Sep 2026

For the next session. Read this, then `DESIGN.md` (the settled decisions), then the design
folder for whatever you're touching. Don't re-derive any of them.

## Start here (28 Sep, end of a long session)

**Where the code is.** Two layers of work are **not on `main` and not pushed**:
- branch **`pedestals`** (1a76fc2): picks on pedestals, replay step 2 (section below).
- branch **`leanings`** on top of it (1d0b3bc, f067319): the two leanings, replay step 3 (section below).
Both live in the git worktree **`/Users/adrianperez/repos/personal/still-action-pedestals`** (node_modules
is a symlink to the main checkout's). `main` (the checkout at `still-action/`, whose dev server on
:5173 feeds his phone at home) has everything up to the open fields and the design docs. The live
site (GitHub Pages) is at b5cd80f + nothing newer of the game.

**Waiting on him, first thing:** *"Should I push?"* He was asked whether to merge `leanings` (which
includes `pedestals`) into `main` and push, so he can play both on the installed app. He answered by
ending the session, so it's still open: **ask him, don't push unasked**. To do it: in the main checkout
`git merge leanings` (fast-forwardable after main's doc commits are in the branch: they are, via
4c8cba0), `npx tsc -b`, push, watch the Pages run.

**Flags he was given for his first leaning runs:** a lone sentinel facing a planted Still never gets a
shot off (the 620 ms beat beats its 760 ms windup; crowds are the real test; the dial is limiting eye
breaks); the lean glyphs are small (card top-right); rider card lines are placeholder words ("Hand
break: ready again."); nothing in the game names "the hand" or "the eye" yet (a first-run notebook
page, his words); walking into a pedestal mid-fight pauses the game; a new save's depth 1 is thin
(floor drops only for worn slots). The pedestal match (`LEAN_MATCH`) stays off until 3 pedestal runs.

**28 Sep, pushed on his word:** `leanings` merged into main and deployed; open fields no flag;
the Arbiter's outrun fix. His report: "I just run around so the revolving light does not hit me".
Cause: at 5.5 u/s Still out-turns the 40°/s sweep inside ~8 u, and the mortar only answered hiding
(outside the post ring, the posts broke the sight line so nothing built up either). Now (`ARBITER.outrun`):
4 s in range and outside every wedge, seen or not, and it judders and reverses (both phases); 6.5 s,
and the mortar lobs onto the circle he's running (`leadS` 1.0 of his turn). Headless circling with the
sweep for 45 s, damage before -> after: 5 u 54 -> 102, 6.5 u 18 -> 108, 8 u 0 -> 60, 10 u 0 -> 108
(the bot reverses on the judder's frame; a person is slower, so it's harder than that). Ask how it feels.

**28 Sep, the pressure prototype (pushed; his call after the rules round):** he questioned the
telegraph itself: "the break mechanic was born from the telegraph mechanic... to have it for all
the enemies is actually weird". The rules round (`design/rules/PITCHES.md`) is **on hold**: its
trial (poise, riders on pushed breaks) is all built on the break. Built instead, behind the pause
switch **"pressure"** (per device, on by default, takes effect from the next depth): at depths 1-2
an ordinary pack's hulks and sentinels are pressure bodies. Hulk: no ring; in contact it cocks 180 ms
and swipes 5 (`PRESSURE_HULK`, enemy.ts). Sentinel: no line or lock; a 260 ms lens glow, then a
3-shot burst of 3, each aimed afresh (`PRESSURE_SENTINEL`, ranged.ts). Their hits stack (they skip
the hurt window, `hurtPlayer(..., stack)`) and small hits get lighter feedback (a "nick"). The
hand and eye can't break them (`breakable`). The elite pack keeps the old telegraphs: the level's
heavy. Log: per depth `pressure` and `hpLost`. Headless, standing planted with the autos: 3 hulks
25 -> 30 HP lost, 5 hulks 60 -> 78 (the eye's brace halves pressure hits too; moving, they land full).
Next: his feel after 2 runs. Dials if it's flat: more bodies per pack at pressure depths, the brace
not halving nicks. If it lands, a design round on three threat kinds (pressure bodies, space-shapers,
telegraphed heavies) and the rules redone inside it.

**28 Sep, drops (his asks, pushed):** floor drops can fill empty slots again (the pedestals-only rule
is gone; he's "not feeling the benefit of the pedestals"). "After some time, I don't really care about
the drops": a drop could only ever be a sideways swap. He then set that **inside a run Still gets
stronger** (DESIGN.md Persistence and design/CONTEXT.md reworded: "wider, not stronger" is between
runs only). Built behind the pause switch **"temper"** (per device, on by default, `src/temper.ts`):
a floor part's card has **melt**: it goes into the part worn in that slot, rank I -> II -> III (damage
x1.3 / x1.6, cooldown x0.85 / x0.72, blasts, shells, lobs and swings x1.15 / x1.3 wider). A swap starts the
new part at I. Ranks show on the button (II, III), live in `run.ranks`, ride the snapshot
(`ranks`), and a tempered part is a copy of its def with the same id (`tempered()`), so combat is
untouched. Kill drops x0.4 while it's on (elites, side rooms, crates, pedestals as ever). Log: per
depth `temper`, `melts`; drop end `melted`. Next agreed: pedestals offer hand/eye mods (option 3),
after his feel on temper.

**28 Sep, riders cut, rank audit, mastery (his asks, pushed):** the four riders are gone (breaks are
rare under pressure, and a free ready sold the push; the `rider` field and its runtime stay, unused).
Temper now reaches every part's own numbers (`temperMod` in temper.ts: Patient Lens's charge clock,
Frayed's widths, Clamp Toss's wall hit, Skid Plates' slam, Overrun's pushed dash, Frost Trail's strip,
Mirror Ward's reflection; shields and catches hold longer). **Mastery** (`src/mastery.ts`, his idea:
"option 3 but after the rank III"): melting into a part at III pauses and offers one of two mods for
the auto its lean feeds (close -> hand, marksman -> eye, no lean -> either): Cold/Marking/Wide Hand,
Cold/Marking/Splitting Eye. They change what the autos do, not how hard (the autos already carry too
much). Max 6 a run, each once; saved in the snapshot (`mastery`); listed on the pause screen; log
`mastered` per depth. Pedestals unchanged: decide after his runs (he may want them gone).

**28 Sep, pressure accepted (96567ff):** no switch; every crawl depth's ordinary hulks and sentinels
are pressure bodies, and in an elite pack only the crowned leader keeps the telegraph (D2's unique and
minions). Rams, mites (brood ring) and Lobbers (landing circle) unchanged, pending his call. DESIGN.md
Enemies and design/CONTEXT.md's telegraph constraint rewritten. The 5174 dev server is stopped.

**28 Sep, enemy curve (his calls: in-run growth allowed; lift "never more enemy HP or damage"; "be
smart so that growth is not punished"; the harder target):** `src/curve.ts` `DEPTH_CURVE`, keyed on depth
only, never his loadout. Read by dungeon.ts (room budget, heavies per level), combat.addPack / crown
(ordinary HP / damage; a heavy's HP x2 x heavyHp and `dmgMul`), areas.bossFor (boss HP; boss.ts and
arbiter.ts now read `def.hp`). Modelled finish: never-melt 28%, median 74%, investor 97%
(design/scaling/CURVE.md). **Depth 5 is the wall on purpose** (ordinary HP x1.3, full room budget,
heavies x2.0 HP / x1.3 damage). First dial if the median dies at depth 5 more than 1 run in 3: ordinary
HP at 5 to x1.2. Log gains `partDmg` per depth (the auto/part split the model guessed at 65/35).
tools/levels.json regenerated.

**28 Sep, synergy trial build 1 (his calls: "build the synergy trial with shatter"; bosses take half from the
autos; the scald speeds up while hugged; mastery chill without the slow, the recommended default):**
spec `design/synergy/PITCHES.md`, build brief `design/synergy/BUILD-1.md`. `src/states.ts` (`stateMul`: one
multiplier, cap x2, a state from the payer's own slot pays nothing, mastery-set states pay any slot);
`sets` / `pays` on parts (chilled: Chill Vent, Frost Trail set; Scrap Cleaver, Cracked Lens pay. marked:
Signal Flare 12 sets; Patient Lens, Parry Clamp, Overrun pay); marks no longer paid by any part; Cold
Strike/Shot chill with no slow; bosses never slowed, but take states; shatter (a paid kill's overkill to the
nearest body within 3 u, once); paying parts aim at carriers; **a swap lands at II** (temper on; the old
part melts in); the push cue (a glyph on the payer's rim, lit when a push would pay; "hold · pay it" once);
"pairs with X" on the floor card. `tools/statecheck.ts`. Log: `states`, `stateBonus`, `paidBy` (hand/eye
must be 0), `pushedIntoState`, `shatter`, `maxMul`, `swaps`. Boss damage from the curve (`bossDmg` ->
`dmgMul` in addBoss). Pay and shatter effects need a look on the phone (headless barely draws them). Next
queued: the mender (design/variety/PITCHES.md) if he agrees. Slammed and hauled after his runs.

**28 Sep, pedestals off and the mender (his calls, pushed):** `PEDESTALS_ON = false` in main.ts: exits
raise nothing, Plenty drops one part for its 4 strain, the Assembler leaves a blue and a gold (the code stays
for a way back). **The mender** (`src/mender.ts`, brief `design/enemies/MENDER.md`): a stilt-legged support
that stands behind its pack, never attacks, and heals its most hurt packmate (a hurt heavy first) ~6 HP/s
through a cable on the floor; walking through the cable cuts it (1.5 s reel, 4 s before it relinks); hits
on the cable do nothing; killing it ends it. Depths 2/4/5 in main packs of 3+, at most 2 a level. Its own
plum-dark hide. No notebook page yet: its name is his. Log `menders { met, cut, killed, healed }`. Check on
the phone: the cable on depth 5's dark floor.

**Then, in order:**
1. His runs on pedestals + leanings (open fields now always on at depths 1 and 4, logging via `?owner`; he exports from
   the pause screen, fold in with `npx tsx tools/mergelog.ts <file>`). Ask what he felt before reading
   numbers. Check the pass lines in `design/leanings/PITCHES.md` (L1-L5) and the play time per depth
   (`playS`, `walkS`) against the 20-25 min target.
2. After 3 pedestal runs: `LEAN_MATCH` on.
3. The run grows to **both roads, 9 depths**: at the crossroads after the Assembler he picks which road
   is area 2, the other becomes area 3; open fields at the first depth of each area (1, 4, 7). Needs the
   Line's stage B (Signalman, Sleepers, Handcar; Line depth 4 as an open rail yard) and stage C (the
   Engine becomes required: each road needs its own boss), then the 9-depth restructure (endings, walk
   home, save/resume, strain/HP retune). `design/area3/` has the spec; stages in `design/area3/PITCHES.md`.
4. Backlog tied to failed pass lines: Glare, Grindstone, Flywheel, Kickstand; the verifier's other four
   riders (Signal Flare, Skid Plates, Chill Vent, Spring Heels) if L1 fails.

**Decisions he made this session (27-28 Sep), don't re-ask:**
- The hand and the eye are the only autos (switches closed); the eye's shot looks like the old shot.
- The hand doesn't strike while backing away.
- Run length target **20-25 min**; my earlier 26/41 min estimates were wrong (his runs are 8-12 min).
- **Both roads in one run** (9 depths), order chosen at the crossroads. Open fields at depths 1 and 4
  now ("it felt ok"), boss depths enclosed.
- Wayfinding for open fields: road, exit chevron around Still, pause-screen map (he raised getting lost).
- **Two leanings first** (close, marksman), from the record of what broke builds in Still and
  still-merge: `design/builds/LESSONS.md` (read it before any part or payoff work).
- The three design agents keep `model: opus` (the alias), not pinned.

**Working setup notes:** the main checkout isn't the cwd of these sessions (`repos/personal` isn't a git
repo), so worktree isolation for agents must be made by hand (`git worktree add`), as done here. Two
still-action dev servers were running on :5173 (main) and :5174; Sunhill uses `npx vite --host --port 5180`.

## The autos now (27 Sep, for reference)
Hand: 10 dmg on the 0.62 s beat within arm's reach, breaks a breakable windup, shoves 0.5 u, no strike
while backing away (`HAND.moveMin`, `HAND.retreat`). Eye: planted 0.3 s, 8 dmg on `leanings` (5 on
`main`), pierces, shoves 0.6 u, blows taken halved, aims at a breakable windup first on `leanings`.
Walking at range: no auto. Log fields: `handBreaks`, `braced`, `playS`, `walkS`, and on `leanings` the
rider/eye-break fields. Phone log: `?owner` + pause-screen export (`src/playlog.ts`).

## Picks on pedestals (replay step 2, 28 Sep)

**Built:** three parts rise on pedestals (the kit's pillar cut to 0.6 u, the part a size up
hovering over it, its tier beam and a cold pool) beside **every non-boss crawl depth's exit beam**
(left, right and behind it, never on the way in), **after a boss with more of the day to come**
(the Assembler: its gift, round its beams) and at **Plenty** (the shrine's prompt raises three;
the one taken costs +4). Walking into one opens the compare ("on the pedestal"); taking one sends
the others back to the wall (found, `toWall`); leaving keeps all three until he walks out. The
Assembler gives a **second pick for +4 strain that stays**: `run.kept`, and `quietFloor()` never
eases below it (a Rest still goes under). The Arbiter's gift stays two floor drops.
**Empty slots fill only from pedestals:** every floor part (kill, crate, elite, the Arbiter's) is
for a slot he wears (`emptySlots`), and each set puts every empty slot first, so the fourth button
lights at the Assembler (or at a Plenty he pays for). The empty-slot fill is gone.
- Code: the roll in `drops.ts` (`rollPicks`, knobs in `PEDESTALS`: each set's sources, the two
  prices); the stones in `loot.ts` (`raise`, `STONE`); the flow in `main.ts` (`raisePicks`,
  `pickSpots`, `openPick`, `takePick`, `PICK_RING`, `PICK_TAKES`). Stones are solid (`Terrain.add`).
- Rules: each pedestal its own slot, at most one never-found part a set, nothing weighted (the
  exit's roll as a kill's, Plenty's as Plenty's, the gift one boss-gold and two boss-blues). The
  leaning match (step 3) goes where `rollPicks` chooses a pedestal's slot.
- Save: optional snapshot fields `picks` (the exit set, raised again on resume) and `kept`; the
  gift rides in `bossLoot` as before (an old snapshot's blue and gold come back as two pedestals).
- Log: per depth `pedOffered` / `pedSeen` / `pedTaken`; floor counts no longer include pedestals.
  Drop tags `exit`, `plenty`, `gift`; a pedestal part sent back ends `wall`.
- Dropsim (`--second want|build|never`): a chosen build worn at the end **42% -> 67%** (57% if he
  never takes Plenty, 62% at half of them). Knob to know: exit pedestals rolled as an elite's
  instead of a kill's gives 77% (too sure, and it brings unfound parts to every exit).
- Watch on the phone: depth 1 is one button plus the hand, and with a young save its floor
  drops dry up fast (only the worn slot's other found parts can fall).

## The two leanings (replay step 3, 28 Sep, branch `leanings` on `pedestals`)

Spec: `design/leanings/PITCHES.md` (four voices, two rounds, the lead's calls); the frame is
`design/builds/LESSONS.md`. **Built:**
- **Tags:** every part is close, marksman or none (`lean` on `AbilityDef`; 13 / 16 / Borrowed Time).
  They switch nothing on; no set bonuses. **Flare** retuned close (range 6, travel 450 ms, new card),
  **Piston** marksman (20 damage, shove 4.0, "knocks one enemy far back"). Glyphs from the stance marks
  (close: an arc of the hand's ring; marksman: a dashed line and a dot, `LEAN_GLYPH`) on the pause card,
  the compare and the wall's chooser, **never the HUD** (the pickup card gets the rider's words only).
- **The eye:** its planted shot does 8 (`EYE.damage`, was 5), aims at a breakable windup first
  (`eyeRank`, head parts in the stance follow the same order), and one landing in a windup the hand
  could break breaks it (`eyeHit`): the **eye break**. Walking at range is still nothing; the hand unchanged.
- **Triggers** (`combat.ts` `trigger`, event `onTrigger(by, e, how)`): a hand break, an eye break, or on a
  boss the **first hand or eye hit in each opening** (the Assembler stunned, the Arbiter venting;
  `openingSpent`, cleared when `boss.open` goes false), which interrupts nothing. A part's break
  (Parry's snap, Clamp Toss, a push) is never a trigger.
- **Riders** (`rider` on the def; `ride()` in `main.ts`, `hud.ready`): Parry Clamp and Backdraft Vent on
  a hand break, Patient Lens (also fully charged) and Clamp Toss on an eye break. Each readies its own
  button fully, once per 4 s per part (`RIDER_ICD` in `abilities.ts`: the first dial if too strong, then
  partial cuts), never clears heat or refunds a push; a ready button (and full lens) spends no cap. The
  button flashes ember (hand) or cold (eye). Cards: "Hand break: ready again." / "Eye break: ready, and
  fully charged." (placeholder words, his to change).
- **Shatter:** hand breaks shatter ember, eye breaks cold with a frost ring (`breakFx`); a part's break as before.
- **The match, built and off:** `LEAN_MATCH = false` in `drops.ts`. On, one pedestal in three is drawn
  from his lean (`leanOf`: most worn, a tie to his last tagged pick `run.lastLean`, not kept by a resume);
  nothing tagged worn gives one close, one marksman, one free. **Turn it on after he has played 3
  plain-pedestal runs** (pedestals are the economy change on trial, eye break + riders the combat one).
- **Checks:** `npx tsx tools/leancheck.ts` (tags, slot x lean coverage, riders); `npx tsx tools/dropsim.ts
  --lean all [--match on]` (formed = 3+ own tags and 1+ own rider at the Arbiter: committed 98% each,
  random 22%; match on 100% / 26%; no part over 2x its slot median; every slot x lean offered 3.4+ a run).
  Headless: one sentinel at 9 u, planted, no parts: 1 shot landed before (it died at 2.5 s), 0 after
  (dead at 1.9 s); hardened, 6-7 of 7 landed before, 0 of 10-11 windups after (the planted beat, 620 ms,
  always lands inside its 760 ms windup: a lone sentinel is shut down; crowds are the real test).
- **Log:** per depth `eyeBreaks`, `openings`, `plantedS`, `autoDmg { hand, eye }` (nominal: 10 a strike,
  8 a body the planted shot hits), `riders { partId: fires }`; `handBreaks` as before.
- Next: he plays; ask his feel first, then the PITCHES pass lines L1-L5 (rider fires, eye vs hand breaks,
  planted share, take rates, Broke at the Assembler). A failed rider gets a new trigger, not a bigger number.
  Open for him: the notebook doesn't name "the hand" or "the eye" yet.

## Open field prototype (27 Sep)

**Why:** his fresh full runs take ~8-12 min; he wants **20-25 min with the same 2 areas / 6 depths** (he
chose 2 areas when I'd estimated 26 min for them; that estimate was wrong). Direction he set: D2 outdoor-style
**open fields at depths 1 and 4**, boss depths 3 and 6 enclosed, 2 and 5 rooms (later: longer spines).
Don't re-offer a third act.

**Built, and on for everyone since 28 Sep (the `?open` flag is gone; depths 1 and 4, `OPEN_DEPTHS` in main; never on the Line):**
`generateOpenLayout` in `dungeon.ts` (knobs in `OPEN`): a wide ragged band along a wandering 7-leg path,
the path drawn as a dirt road (the corridor's first floor; the field never uses it), 9 clearings along it
(logical rooms, the packs) and 5 pockets off the sides (side rooms), ruined wall stubs and props scattered
off the path. ~3.5x the floor, 14 packs vs 6, exit ~2x as far. Wayfinding, his worry ("easy to get lost"):
the road; a cold chevron circling Still pointing at the exit when it's off screen (`updateExitMark`; on the
screen edge it sat under the buttons); a pause-screen map that fills in as he walks (`src/fieldmap.ts`,
drawn turned to the camera). Normal levels are identical (same seeds, same numbers).

**Watch:** ~300k triangles vs ~116k (instanced meshes aren't culled per instance): check frame rate on
the F5 with the grade panel's perf readout; chunking is the fix if it drops. Then his feel: exploring or
empty field? Then depth 4, longer spines at 2 and 5, and retune strain/HP for a 20-25 min run.

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
2. ~~**Picks on pedestals**~~ (built 28 Sep, above): he plays it before step 3.
3. ~~Leaning tags~~: two leanings first (close, marksman), built 28 Sep (above), the match off until
   3 plain-pedestal runs; caster and keeper later.
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
| `abilities.ts` / `parts.ts` / `partfx.ts` / `partmodels.ts` / `pool.ts` / `drops.ts` / `loot.ts` | the 30 parts, their runtime, visuals, models, the pool, drop rules and picks, the floor loot and pedestals |
| `still.ts` / `handring.ts` / `sightline.ts` | the Lantern; the hand's ring; the eye's sightline |
| `workshop.ts` / `save.ts` / `notebook.ts` / `crayon.ts` / `ending.ts` | the Workshop, the save, the notebook, the kids' drawings, ending words |
| `hud.ts` / `pause.ts` / `style.css` / `camera.ts` | UI, pause (with switches) and compare, type, zoom |
| `vfx.ts` / `audio.ts` / `music.ts` / `ambience.ts` | particles and shaders; synth and samples; score; room tone |
| `tools/dropsim.ts` | the drop simulator (`npx tsx tools/dropsim.ts`; `--lean all` for the leanings) |
| `tools/leancheck.ts` | the leanings' static checks (`npx tsx tools/leancheck.ts`) |
