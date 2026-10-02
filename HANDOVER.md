# Handover — 1 Oct 2026 (morning)

For the next session. Read this, then `DESIGN.md` (the settled decisions), then the design
folder for whatever you're touching. Don't re-derive any of them.

## Start here (2 Oct: his calls made, B0-B3 done, B4 pick next)

**If a session died here (his weekly limit may run out, 2 Oct evening):** he said "continue until all the development tasks are done,
then commit and push". Resume: if B4's diff is uncommitted, review it against BUILD.md B4 (+ `?perf=1`), rerun tsc / vite build /
corecheck / baseline + fights compare / builds.mjs / screens.mjs, look at the B4-* screenshots, commit + push. Then B5 the same way (one
Sonnet engineer, review, push). Then tell him what to try (pick cards at run start; `?perf=1`) and ask his feel first (B6).

**His calls (2 Oct):** the second core is **Ram** (beside Wake); the pick is **at run start, from two cards**. Both my recs.
Building now like stage C: the verifier writes `design/buildlayer/BUILD.md` (B0-B6, Ram in Breaker's place, run-start pick,
the lead's settlements in PITCHES); a Sonnet 5.5 engineer per step, I review every diff. **B0 (measure first)** started from
2-verifier.md section 5: suites pin the live defaults (weight + tap push on), K-90F re-captured alone, dropsim to 9 depths +
live drop rules (`PEDESTALS_ON` into drops.ts), a temper-table assertion, rider code cut. **B0 DONE + pushed**: suites boot weight + tap push ON (`WEIGHT=0`/`TAP=0` = old game); K-90F and K-90
re-captured (K-90's only change: 4 boss HPs, weight's x1.3); K-A7/K-N9/K-T15/K-E3/K-L1/K-L2/K-P1/K-P2 follow weight/tap by design;
dropsim vs runs 23-24: offers 33.4 vs 34.5, takes 7.7 vs 8.0 (two knobs fitted: `--side 0.5`, `--whim 0.08`; uncalibrated takes
fail -34%); temper tables asserted in statecheck; riders gone. Known fails untouched: K-W3d (Parry), K-90N (`names.json` stale vs
`WHAT.handcar`, no suite runs it). **The brief: `design/buildlayer/BUILD.md`** (verifier; my calls at §9's top: builds ON by
default from B1, inert until B4's pick; old runs resume bare). **Balancer r3 done (`3-balancer.md`, binding for numbers):** at the
brief's numbers a build was worth ~0 on packs (Scrap Cleaver, a white starter, was the best spender); ship numbers give a full rank-I
build +22% on deep packs, never-melt floor 18% when building (11-13% whites only); `Fit.k` per part; slam line 0.3. **B1 DONE +
pushed** (src/cores.ts with 3-balancer's numbers; `coreActive = buildsOn && run.core`; marks on EnemyStatus; spend in hitPart with
`Fit.k`; flat temper via `asWorn`; lean tags cut, mastery via `MASTERY_FORM`; "builds" row on by default, inert; checks
`node tools/checks/builds.mjs` K-M1..M5, `npx tsx tools/corecheck.ts` replaces leancheck). Known small: open pause cards keep old
numbers after a mid-crawl flip until reopened; `__spendCount`/`__shoveLog` hooks wait for B5/B3. **B2 Wake DONE +
pushed** (skim beside not behind, full skim on immovable bodies every 0.5 s, Burst/Deep/Spray/Slip, Backhand/Skate/Frost Flare as
VARIANTS, src/markfx.ts rings: normal-blended cold ring with a dark rim, +3 draw calls, read on warm and dark floors; spend/fizzle
sounds; log fields filled; K-M6..M12, K-M7b, K-M30). Still unreachable live (no pick yet). Watch at B6: Backhand turns him to the
swing (at rest the next Backhand's "behind" flips); its push hint can point at a front windup it can't hit; spend drain is a blink;
Backhand whiffs not logged (balancer wants it; add at B5). **B3 Ram DONE + pushed** (beat shove 8 / 1.5 u at the
hand's reach, retreat rule kept, a tell never moved; wall + body slams via shared `throwEnd` (K-M19: equal to the old inline test);
Domino, Catch (immovable only, spends), Wide, Rubble; Piston variant cd 2600; steel-blue notched ring; slam crack ring + sparks).
Numbers: K-M17 free defence 0.833 (line 0.75; Ram takes ~1.49x the bare game's HP in that test); K-M23 bot slams per beat shove on
packs 0.22 eager / 0.26 hesitant, under the 0.3 line (reported, not tuned; his log at B6 decides). Lead call: kept the engineer's
`bodyAhead: true` (a neighbour the shove leaves behind is not a slam; literal BUILD.md gives 0.24 / 0.47). For his feel: the hit
flash turns a slammed hulk into a pale blob (old flash); whether the ring reads "cracked". His ask for B4 (2 Oct): `?perf=1` shows the perf
readout on the live build, so the phone frame-rate number no longer needs the LAN dev server (in BUILD.md's B4).
For him (§9): 3 the core never breaks a windup or moves a body in its tell (is it still Ram?); 4 the filter ignores "found";
5 the planted brace goes with the eye. If a session dies mid-step: review the uncommitted diff against BUILD.md first.

## Start here (1 Oct, night: BUILD LAYER round DONE, awaiting his two calls)

His pick: dig into the build layer. His answers: everything open; builds change **what parts do together + how you fight**; no
reference game. **Outcome: `design/buildlayer/PITCHES.md`** (BRIEF with Corrections, 1-/2- per voice, `build-sim.mjs` with
modes fight / pool / r2). All four agree: **one core a run replaces the hand + eye** (no button), marks enemies every beat,
**parts spend the marks** (spenders, shapers, keystones; no feeders); button shows a spend count; **flatten temper** in the same
trial (today 4x III = +27-37% packs / +68-84% boss beats every build); drop filter 0.4-0.5 of elite/Plenty/gift drops from the core
(pedestals stay off); cut lean tags, rider code, mastery as is; scrap out; **measure first** (B0: suites to live defaults,
dropsim to 9 depths + live drops). Wake ("beside, not behind", anti-kiting) is in. Lead-settled: flat per mark (not x2), control =
pause switch "builds" on by default, late want = 2 keystones per core (one socket, swap) + max 2 visible core upgrades.
**His two calls:** (1) the second core: Ram (my rec) / Breaker (sim fails packs) / Sight (it's the eye); (2) pick at run start
(my rec) or after d1. Then build B0-B6 (table in PITCHES) like stage C: Sonnet engineer per step, I review every diff. Nothing built.
Note: 2-translator/2-verifier swapped trial picks with me in round 2; I took the reasons, not a re-poll.

## Start here (1 Oct, night: weight + tap push ON BY DEFAULT; his verdict on the game as a whole)

**Done + pushed:** both switches on by default (his word, after TRIAL-1): unset key = on, `'0'` = off; the switches stay on the pause
screen. The hold only runs if he turns tap push off. Checks: `lib.mjs` pins both off when the key is unset (as area III pins roads=0),
so every suite keeps its record; a query with `trialDefaults` skips the pin (K-P1 a0, K-L1 a0 assert a fresh phone boots with both on,
negative-tested against the old default). Follow-through untouched (still off by default; he had it on).
**His verdict (1 Oct), the next real work, NOT polish:** "hollow and easy"; no threat except the Assembler; the other two bosses too easy
and gimmicky; parts boring, too alike, too few; no sense of reaching a build or archetype; strike/shot leanings forced, and both are
ranged (one just shorter). He's happy with the progress but sees it is far from a real game. He called sounds/freeze/feel questions
polish for later: don't lead with them again. Data agrees: a 9-depth run is ~14.5 min of play (~1.6 min a level vs DESIGN's 4-5).
**Next:** his pick of where to start; my rec is the build layer (parts pool, archetypes, what a leaning means) before threat, since
threat is tuned against builds. Ask want-vs-should first (memory: games are for fun).

## Start here (1 Oct, evening: first log with "weight" + "tap push" read)

He sent `~/Downloads/still-playtest-2026-10-01 (1).json`, again no words. Read in **`design/lean/TRIAL-1.md`**. Two runs, both home
(9 depths, road II), weight + tap push + follow-through all on. Every log line passes: part kill share d1-2 62-79% (off 19-54%),
hpLost d1-3 -18% vs runs 9-17 (easy edge), freeze 3-10% of fight time, parts ~85% of it; tap push: 38/38 pushes by tap, 0 guarded,
0 dead, 0 thumb rolls, 0.4-0.8 pushes a fight, strain at boss 2-6. Pushes didn't rise, so the strain retune stays parked.
**Ask him first:** how it felt (the questions in the two sections below). If his feel agrees, his call: both on by default + retire
the hold, or keep testing. If he wants it harder: pack HP d1-2 is the dial, not the parts. Nothing built.

## Start here (1 Oct, night: "weight" AND "tap push" both done and live, waiting on his phone runs)

Two independent pause switches, both off by default, both built + reviewed + pushed:
- **"tap push"** (P0-P2, 2cd0e7a..0c5856c; brief `design/lean/TAP-PUSH.md`; checks `node tools/checks/tap.mjs` K-P1..P13; `TAP=1` runs
  any suite with it on). His reason (1 Oct): "the hold makes intentional pushes more difficult." On: a touch on a cooling button with
  > 300 ms left pushes on the touch-down (+2, a deep-red rim kick); <= 300 ms queues (cold ring, soft tick, fires free when ready); a
  touch within 250 ms of that button's last fire or touch is guarded (a 150 ms "no" shake + click; a mash pays once). No touch is silent.
  Captions PLACEHOLDER ('tap · break it' etc., once per save, so he likely sees none). Strain untouched (his call); watch `strainAtBoss`
  and `tapPushes` (sim: Stopped by d3 16-24% if pushes rise x1.25-1.5; the parked retune is in PITCHES). My review changes: the
  guard rolls; the guarded answer is a shake, not the ember arc (it read as a charging hold); K-P5 off the 300 ms edge (flaked).
- **"weight"**: see the section below (unchanged).
**Ask him first:** how each felt, separately if he tried them separately. Tap push: does every intentional push land; does the shake
read as "already done"; any accidental pushes (log: pushes with nbMs < 40 = thumb rolls). Then his log.
**Small known:** the first push of a session may not show its rim kick (first-cast compile hitch); the push kick is a 220 ms flash,
easy to miss. Nothing heard headless.

## Start here (1 Oct, evening: "weight" DONE and live; "tap push" P0+P1 live, P2 next)

**The "weight" trial is complete and live (W0-W5, 0620020..47036ef)**, a pause switch "weight" (PLACEHOLDER word), off by default.
Brief `design/lean/WEIGHT.md`, round outcome `design/lean/PITCHES.md`, numbers `design/lean/3-balancer.md` (preset B in
`src/weight.ts`; D = smaller-area fallback, one constant `WEIGHT_PRESET`). On: freeze only on contact (formula in WEIGHT_FEEL),
autos quiet, cocked pose; every ready cast carries the push's effects (no strain); packs x1.4 d1-2 / x1.65 d4+, boss x1.3, torso/legs
x1.8, head/arms x1.2, vent x1.4, dash x2, Cleaver 180 deg + shove; per-slot sounds; a crowd's hit flash capped 1/sqrt(n); cards show
weighed numbers. Pack/boss HP apply from the next level after flipping; that depth logs `weightMixed` (leave out when judging).
**My review fixes along the way:** dash contact cleared on level reset; card reach to one decimal; crowd flash cap (K-L13); trains
scale with the weight's pack HP (else bodies survive trains and loiter in lit strips: K-T5 under WEIGHT=1).
**Checks:** `node tools/checks/lean.mjs` (K-L1..L13, K-L12w); `WEIGHT=1 node tools/checks/<suite>.mjs` runs any suite with the trial on
(report only: baseline/fights/stagec K-N9/stageb K-T15/K-E3 differ by design). Off = today: every suite unchanged.
**Ask him first (feel before numbers):** does a five-body Cleaver feel different from a jab; does the freeze read as weight or lag;
the sounds (none ever heard); haptics; does the 180 Cleaver / big vent crowd the screen (else preset D). Then his log: `kills.part`
share d1-2 >= 45% (36% now), hpLost d1-3 within 20% of runs 9-17, `freezeMs` per fight-minute, `breaksBy`. Watch: with weight on,
trains take 28-30% of the bot's kills on the Line (21% off), and the hesitant bot's area-II kill time rose 4.9 -> 6.2 s.
**"tap push": he said build it now (1 Oct): "I didn't like the hold approach, feels like it is not working... more often than not, the hold makes intentional pushes more difficult."** Brief done: `design/lean/TAP-PUSH.md` (P0-P2, K-P1..P13 in tools/checks/tap.mjs; my change: the mash guard rolls from last fire or last touch, so a mash pays +2 once). P0 done + pushed (2cd0e7a; the switch row shows but does nothing yet). P1 (the gesture) done + pushed: the switch works now. P2 next (captions, weight combos, whole sweep) + my change: the guarded answer is a short shake + click, not the ember arc (the arc reads as a charging hold), one Sonnet engineer each, reviewed + pushed. If a session dies mid-step: review the uncommitted diff against TAP-PUSH.md before keeping it. Plan (PITCHES: tap on a cooling button pushes, 300 ms queue, 250 ms mash guard; strain
untouched by his word). Small leftovers: flinch likely invisible at game camera; card has no cone/width row.

## Start here (1 Oct, later: "weight" brief + balancer r3 running)

**His calls (1 Oct):** strain economy untouched; the never-melt target is now **~1 in 5** (DESIGN.md "The floor player",
a2aeeab: melting is how you grow; he catches up when synergies + set items land; judge rounds by median/investor first). Go on
"weight" first, and in parallel: balancer re-run (`design/lean/3-balancer.md`: bigger packs for the median, Ask 1 numbers
re-tuned for the new target) and a frame-rate measurement of bigger packs. Running: verifier writing `design/lean/WEIGHT.md`
(steps W0..Wn, checks K-L* in tools/checks/lean.mjs). If a session dies: rerun whichever of those two files is missing.
**Perf:** the in-game readout (`src/perf.ts` createReadout) is DEV-only, so the phone number needs the LAN dev server at home;
a headless draw-call count needs localhost vite (ask him first at the office). Next after both: engineer on W0, then tap push.

## Start here (1 Oct: lean round DONE, awaiting his pick)

His ask: tougher enemies + stronger parts, more dramatic parts, no hold-to-push. Round done: **`design/lean/PITCHES.md` is the
outcome** (BRIEF, 1-/2- per voice, `lean-sim.mjs`, `... r2`). In short: no strain per cast; every ready cast carries the push's
effects; a tap on a cooling button pushes (300 ms queue near ready, 250 ms mash guard); drama = freeze on contact only, autos
quieter, one hitstop formula; packs x1.25 HP, bosses x1.1, torso/legs x1.5, more area. Not bigger packs.
**His call (1 Oct): don't touch the strain economy** ("I rarely get stopped"); the balancer's retune is parked in PITCHES.
**Trial = two switches:** "weight" (no strain) and "tap push" (gesture only). My rec: build "weight" first. Awaiting his go
and order. Build like stage C: verifier brief, Sonnet 5.5 engineer, I review every diff and screenshot. Nothing built.

## Start here (1 Oct, morning: first follow-through log read)

He sent `~/Downloads/still-playtest-2026-10-01.json` (3 runs with follow-through on) but no words yet. Read in
**`design/autos/TRIAL-1.md`**. In short: the pass lines look met on the pool (42.6 presses a fight-minute, 12% empty,
HP roughly within 20%), but per play-minute he pressed **the same as with it off** (d1 10.1 vs 10.0, d2 13.0 vs 12.6;
only the d3 boss +18%). From d2 the bank never empties, so it plays like autos on; at d1 it is empty 40% of beats
(few parts to feed it). **Waiting on his feel** (did he feel any difference from d2; did the d1 gaps read as waiting or
a bug), then his pick from TRIAL-1's options: tighten (with a d1 floor), the translator's package (my lean if he felt
nothing), or keep. Nothing built today.

## Start here (30 Sep, evening: the autos round)

**His ask:** auto attack feels Vampire Survivors / Archero; he wants more active; "don't blindly agree".
Round done in `design/autos/` (BRIEF, 1-/2- per voice, sims, **PITCHES.md = the outcome**). All four: partly
agree (the planted shot IS Archero); no to removing autos (never-melt finish 31% -> 0%) and no to a fifth
button. Recommendation: trial the **bank / "follow-through"** (each press adds 3 auto beats, cap 6) as a pause
switch, log fixes first (PITCHES §Recommendation). Second trial if he still names standing still: the
translator's package. **His pick (30 Sep): the bank first. BUILT + LIVE:** pause switch "follow-through" (PLACEHOLDER words), off by default,
applies at once (his ask; the depth it was flipped on logs `followThroughMixed`: leave it out when judging). Brief + as-built notes `design/autos/BUILD-1.md`; checks `tools/checks/autos.mjs` (K-A2..A9, K-A1 =
fights compare). The core dims in a fight with the bank empty (subtle: ask if the gaps read as Still waiting or a bug).
New log fields every run: autoDmgReal, kills, fightS, bankBeats, emptyBeats, taps[].leftMs. **Next: his run with it
on; judge by PITCHES pass lines** (40+ presses a fight-minute, emptyBeats < 20%, hpLost d1-3 within 20%).
He tests on the live deploy, not the dev server. Side finding: ~1 in 5 pushes held <240 ms, maybe
accidental (PITCHES last section). My 67% auto-share figure was wrong (64% never-melt / 34% investor).

## Start here (30 Sep, 19:00, at home: screens fix live)

**His report:** paused in the final boss, resume was below the bottom edge and the pause screen couldn't scroll: no way back.
**Fixed + pushed (21a4fbf):** #pause scrolls (auto-margin centring, touch-action pan-y), actions wrap and are pinned to its bottom,
tighter cards under 520 px tall; the same fault hid take/leave on compare and close on the notebook. Pickup card under 350 px tall:
choices in a row. **New check `node tools/checks/screens.mjs`** (K-S1..12): every overlay at 4 landscape phone sizes with worst-case
content; negative-tested against the old CSS. Add any new overlay to its SCREENS table.
Reload resumes the run at the depth's last beam (save.ts), so the boss fight restarts, not the run.
Everything below from "30 Sep, late" still stands (the phone questions, his words to write).

## Start here (30 Sep, late: AREA III IS LIVE; next session is at home)

**State:** main = origin, all pushed and deployed, nothing running, nothing uncommitted. **Area III is live** on his word
("no one is playing but me, why hide it?"): LINE_ENABLED, ENGINE_ON_LINE, BOTH_ROADS = `true` (473a02f). The live game is 9 depths,
both roads (the crossroads after the first Assembler picks which is area 2), the Line (trains, Signalman, Handcar, Sleepers) and
the Engine as its boss. PORTER_ENABLED stays false (stage D not built). Save v3 covers it; no migration.
**Lesson: on this repo he doesn't want finished work hidden behind flags. He's the only player: ship reviewed steps to main.**

**First, at home:**
1. Start the dev server (`npx vite --host`) and give him the LAN address (`ipconfig getifaddr en0`, port 5173). The live URL has it
   too now (a reload picks up the new service-worker build). No URL flags needed any more.
2. **Ask how it felt before reading any numbers** (phone playtest log: `playtest.json` on the dev server, or his exported log).
3. Phone questions, in order:
   - **The Engine's kill time.** A careful scripted bot needs 150-182 s (SPEC guessed 85-100). If it drags: HP, window cadence.
   - Does the lever read at phone size? The lit horizon?
   - Does the derail land as a payoff?
   - The sounds: none has ever been heard (headless has no audio).
   - The 9-depth curve (`design/scaling/CURVE9.md`, first pass).
   - Look doubts: spark flecks may read salmon; the body's sheen; the wagon.
   - The Line bodies: stage B's phone list, `design/area3/STAGE-B.md` §5.

**The Engine, in one breath:** a locomotive on a loop in the roundhouse, lighting the rail >= 1.3 s ahead of itself. Every 3rd
junction a lever window (cold ring, board "LEFT POINTS · NOW"): a cast within 3 u throws it, and it derails in the siding (open,
x1.5). Steam leads him and is cut at walls; the cinder comes if he stays out of range (8.1 s, 5.6 s in phase 2). Phase 2 at 55%:
reversals, a loose wagon it derails on, levers thrown back on him. Death leaves a cold husk.
Docs: `design/area3/STAGE-C.md` (brief), `STAGE-C-RESULTS.md` (check table), `ENGINE-N17.md` (balancer's steam/cinder numbers).

**Checks:** `node tools/checks/{baseline,fights,k9,area3,home,stageb,stagec}.mjs` (localhost vite only). All PASS except stageb's
K-W3d (Parry a dead slot: a design finding, not a bug). Queries that mean the old 6-depth game are pinned `roads=0&line=0&engine=0`;
K-90/K-90L/K-90F still compare that page (no baseline re-captured).

**How stage C was built:** verifier brief, one Sonnet 5.5 engineer per 1-2 steps, the balancer for numbers; I read every diff, reran
the checks and looked at every screenshot. Review caught 3 flat/peach looks, a white rail streak, a latent horizon bug, and 3 checks
the brief never assigned.

**His to write (all PLACEHOLDER):** the Engine's name, openWord, phase-2 banner, BOARD words, notebook line; the Signalman / Handcar /
Sleepers names, WHAT words and lines; ROUTE_WORD.III; Parry Clamp's card line; the warm-beam card copy.
**Still open from 29 Sep:** his feel on Parry catch / the lunge / the parry-catch switch.
**Next build candidates (his pick):** tuning from his runs; stage D (the Porter); Parry's dead slot (`design/parry/`).

## Start here (30 Sep, morning: B7 + B8 done, stage B complete, all dark)

**He's at the office:** no LAN dev server (localhost-only checks were OK'd for this session). Nothing running.
**Pushed on his word (30 Sep)** through b3ee661: B7, the stage C brief, C0 + C1. All dark; live unchanged.

**His two B7 answers, taken as my recs because he said "just continue":** the Handcar gets its **own page** (not Iron Crawler,
so rams keep both band-I names), and **only unmet pages change role**. How: `LINE_DONORS` in notebook.ts (signal: signal-jammer,
thermal-scanner, glitch-node; handcar: feedback-loop, phase-drone; sleepers: conduit-spider, strain-siphon, void-leech). At boot
`setLinePages` gives each Line body the donor already stamped `r` for it, else the first donor he never met, else none (met
unwritten, like the mender). The first meeting stamps `NotebookEntry.r` (optional, no save version). If he'd rather pick the
pages himself, only LINE_DONORS changes.

**B7 also:** ambience `line` (the quarter's air + rail ticks + far buffer knocks, synthesized); card caption road word
(`ROUTE_WORD.III = 'the Line first'`, PLACEHOLDER); DEV hooks `__ambience`, `__caption`, `__linePage`, `__setLinePages`, `__hides`.
Review caught a harness bug in K-E10 (dead mites leave `pack.members`, so it counted 0 deaths; the game counted 6, correctly).

**B8 (whole stage headless), all at 7063785:**

| check | result | note |
|---|---|---|
| tsc, vite build | clean | dist 5,381,866 B (+26,692 vs ba443ce; cap 5,600,000) |
| baseline K-90, K-90L | PASS | flag-off game and flag-off Line unchanged |
| fights K-90F | PASS | combat baseline unchanged |
| k9 (18), area3 (8), home (4) | all PASS | stage R, stage A, warm beam card |
| stageb (37) | 36 PASS, K-W3d FAIL | K-W3d = Parry's dead-slot design finding, known, thresholds were for R3 alone |
| K-T13 at B8 | PASS | bot A trains 21.0 / 19.9% of kills (step 4 / 7), 2+ kills 10 / 8%, free 0; bot C earned 15.6 / 16.0%. Identical to B4-after-fix (a4bac5f); B3's numbers were double-counted, no clean B2 figure exists |

Heard-log over scripted Line levels (III-4 and III-5, seeds 1-3; scratch script, not in repo): `semaphore` fires at every
Signalman once Still stands within `laneReach` (3.7 u) of a lane (the lesson call ignores that, so it fires on waking at 4);
`pump` + `latch` once per Handcar that locks; `aim`/`rev` as before. `gravelRise` is K-E8's (6 per brood). The ambience's
`railTick`/`farShunt` never reach heardLog: headless audio never runs. **Nothing new has ever been heard: phone only.**

**Stage C, the Engine: brief done** (`design/area3/STAGE-C.md`, 5f97e5c, verifier; steps C0-C10, checks K-N*). C0 + C1 committed
(check scaffold `tools/checks/stagec.mjs`, `src/track.ts`, K-N1a PASS); C2 committed (e7d6439, the roundhouse arena, K-N1b).
Unpushed since b3ee661: ask before pushing. C3 committed (f87bff0: the Engine's body, its own hide `HIDES.engine` green-black + gunmetal after two look passes, red
flickering firebox + headlamp, whistle steam). C4 committed (3cd3076: the run at 11 u/s, the lit
horizon, every strip lit >= 1300 ms before it arms, deep red, K-N2b/K-N3). C5 committed (7a64d18: levers every 3rd junction, cold
ring + board "LEFT POINTS · NOW", derail -> open x1.5; lever rebuilt with a cold-blue knob; continuous horizon fade; cab matte, rough
0.72, no white patch). For C9's dressing: the derail is modest for the payoff moment (add steam/sparks/a stronger firebox read), and
the matte body reads flat olive in close-up. C6 committed + pushed (818f4ca: steam leads
him, cut at walls, grey puffs; the cinder lobbed after 7.5 s / 5 s out of range; balancer's `design/area3/ENGINE-N17.md` fixed the
jet's reach (len 11) and paced the cinder: camp 65, circle 60.7 HP / 45 s, dodgers never hit). C7 committed + pushed (d254083: phase 2
at 55%: reversal with a judder, the loose wagon, the lever thrown back; long runs found + fixed a latent C4 horizon bug). C8 committed + pushed (01aa7f7:
the Engine's own drawn hazards end at death, a cold husk, resume husk where it slept). C9 committed + pushed (03fb8c1: ambience,
sounds, notebook page, the look list below addressed). C10 (whole stage headless; writes the never-written K-N9, K-N16, K-N23) under way. **C9 dressing list so far:** derail too modest for the payoff (steam, sparks, stronger firebox); matte
body reads flat olive close up; bright cream streaks where the warm light catches the roundhouse rails (near flat white); the wagon
tub reads as a flat dark block and has no see-through; judder sparks small. **His standing word: push each reviewed stage-C step as it lands, through C10.** Held for C5: the lever is a 0.15 u post, invisible at game camera: it must read at
phone size. Rails are faint at game camera too (the lit rail in C4 should carry it; phone judges). **His calls (brief §9): on 30 Sep he said "go with your defaults", so every bracketed default below is DECIDED:** lever cadence (every 3rd junction, ~8.9 s, alternating sides; SPEC's "every lap alternating"
is geometrically impossible); accept leading steam (250 ms aim with the Arbiter's lead-guess, 700 ms locked) and the new
**cinder** (a lobbed ring after 5 s out of steam range, so camping inside the loop isn't safe); husk position on resume (where it
slept); the Engine's page under unmet-only (`raging-hull`, fallback `echo-shell`; his save has likely met raging-hull);
"that saw the Arbiter" outranks "that saw the Engine" in every full run. Words all PLACEHOLDER (name, openWord, phase-2 banner,
BOARD, notebook line). Contradictions the brief lists in its "differs" table (SPEC's 900 HP ignores the curve: 1080 at 6,
1170 at 9). Phone list for stage B is STAGE-B §5.

**His to write (PLACEHOLDER):** Signalman / Handcar / Sleepers names and WHAT words ('a signalman', 'a handcar', 'sleepers'),
their notebook lines, `ROUTE_WORD.III`, Parry Clamp's card line, the warm-beam card copy. Still open from 29 Sep: his feel on
Parry catch / the lunge / the switch.

## Start here (29 Sep, 16:30: stage B through B6, two whole-game changes live)

**29 Sep, 22:30 (his ask, pushed):** the warm beam now asks when a cold beam stands beside it (after a boss that isn't the
last): stepping in shows the shrine-style card "The warm light / go home"; only its tap goes home, stepping out cancels.
After the last boss it takes him as before. `__end('home')` answers the card. Check: `node tools/checks/home.mjs` (K-H1-4).
Card copy is mine, his to rewrite. The dev server was started at home this session (stop it at session end).

**Nothing is running and nothing is uncommitted.** Main = origin, all pushed. He leaves the office ~17:00 and plays at home.

**First, at home:** start the dev server (`npx vite --host`, give him the LAN address), then ask how these felt *before*
reading numbers. Live since today:
- **R3** (d7382aa): Parry Clamp catches a pressure body's own tell (hulk cock 180 ms, sentinel glow 260 ms, mite rear 120 ms).
- **R8** (736488e): a counter hulk's crouch books its lunge (never within 0.3 s of a ram/sentinel/train lock).
- **Parry-catch trial** (75bbe9e, his call): pause switch `parry catch`, on by default. On: 150 ms grace after a tell, and a
  Parry snap that catches a tell or breaks a windup readies Parry (once per 1.5 s). Off = R3 alone. Why: the balancer found
  Parry a dead slot from depth 4 even with R3 and perfect timing (`design/parry/README.md`: options A/B/C, B + grace 150 picked).
  Log fields per depth: `catches {hulk,sentinel,mite}`, `parryCatch`, `parryReadies`, `lunges`. Ask: does the free ready feel
  like skill or like a free cast (he cut the riders on 28 Sep for a similar free ready)?
- Pickup card fix (98e4121): card no longer runs off the top on a landscape phone. Ask if it reads on the Poco.

**Stage B (the Line's bodies), all dark behind the flags** (`?roads=1&line=1`). Brief: `design/area3/STAGE-B.md`. Done:
- B0 checks (`tools/checks/fights.mjs`: K-90F = 14 scripted fights x 5 seeds, the combat baseline; K-90N names; K-90L split).
- B1 R3, B2 R8 (live, above). B3 R4-R6: pressure bodies step off lit rails unless moved/countering; no crouch on a lit strip;
  trains hit bodies for 20 x curve hp.
- B4 the Signalman (`src/signal.ts`), B5 the Handcar (`src/handcar.ts`, Charger subclass on a siding), B6 Sleepers (ballast
  mites, `swarm.ts`). Phone questions: the Signalman is a thin dark post, the lamp does the reading; the Handcar's tracking tell
  is faint at phone size and its lock shares the train's red wash; the Sleepers' shiver may be invisible on a dark tile.
- K-T13 (trains' kill share) had a double-count bug, fixed: trains ~20% of kills, 8-10% multi-kill, 0 free. Translator: the
  Signalman works as designed. Held options if the phone says "the train did it": no crouch across a lit strip; recover not committed.
- Checks: `node tools/checks/{baseline,fights,k9,area3,stageb}.mjs`. All PASS except **K-W3d** (Parry's dead rule, a design
  finding; its thresholds were for R3 alone). When a step legitimately changes the Line, `baseline.mjs capture-line` re-captures
  K-90L (K-91 reads the same file). Never re-capture K-90F without reviewing the diff.

**Next: B7** (the `line` ambience, the card's route caption, notebook re-roles + `pageOf`, the hides), then **B8** (whole stage,
headless), then stage C (the Engine). **B7's notebook re-roles wait on his two answers:** (1) the Handcar's own page, or Iron
Crawler's (that leaves every ram at 1-3 named "Overload Core")? (2) may pages he has already met move, or only unmet ones?
My recs: own page; unmet only. The rest of B7 doesn't need him.

**His to write (all PLACEHOLDER):** Parry Clamp's card line (it no longer says what it does); the Signalman / Handcar /
Sleepers names, WHAT words and notebook lines; the card's route word (`ROUTE_WORD.III`).

**How it was built today:** verifier wrote the brief; a Sonnet 5.5 engineer per step (fresh one at B4 when context grew), stepped
with SendMessage; balancer (Parry) and translator (K-T13) on the design questions. I read every diff, reran every suite and
looked at every screenshot before each commit. Review caught: the Handcar's stun lever was flat peach (now deep red + flicker);
engineers' reports were accurate this time, but keep verifying.

**Side findings, not acted on:** the Scrap Cleaver beats Piston from depth 4 (the arms slot has a Cleaver problem, not only
Parry); `Combat.autoTimer` survives `reset()` (harmless so far).

## Earlier start-here (29 Sep, afternoon: stage R done, dark)

**Both roads in one run: stage R is built, pushed, and dark** (`BOTH_ROADS = false`; DEV `?roads=1`, add
`&line=1` for the crossroads room). Live is unchanged: `node tools/checks/baseline.mjs compare` (K-90) proves
flag-off equals the pre-change game. Read `design/area3/BOTH-ROADS.md` (§4: his 8 decisions, all my
recommendations, names stay PLACEHOLDER), `design/scaling/CURVE9.md` (first-pass 9-depth curve, not locked),
`design/area3/LINE-RULES.md` (translator, stage B rules R1-R11), `design/area3/STAGE-R.md` (the brief).
- How it was built (his ask): design agents for design (balancer: curve; translator: Line rules; verifier:
  the brief), a Sonnet 5.5 engineer (`model: sonnet`, confirmed `claude-sonnet-5-5`) for the code, stepped
  R0..R9 with SendMessage; I read every diff, reran every check and looked at every screenshot before each
  commit. Review caught one bug the checks missed: the square's Line dressing rails ran through the husk.
- Checks now live in the repo: `node tools/checks/k9.mjs` (K-9x, 18) and `node tools/checks/area3.mjs`
  (stage A, 8), playwright-core + system Chrome, vite forced to 127.0.0.1 (asserted). All pass at 3d9d11f.
- **His to decide before stage B:** LINE-RULES R3 (Parry Clamp catches any tell in its cone, whole game) and
  R8 (the hulk's lunge books its beat, whole game). The CURVE9 optional dial: Assembler `bossDmg` 1.1 -> 1.0
  (also moves the 6-depth game).
- **His phone, when home:** `?roads=1` on the dev server for a full 9-depth run: the real run length (the whole
  reason for 9 depths), the in-between hours, Home at 6 at dusk. The Line has trains but none of its own
  enemies yet and ends in a stand-in Assembler.
- Next: stage B (Signalman, Handcar, Sleepers, ambience, notebook) per SPEC B1-B4 + LINE-RULES, then C (the Engine).
- Cleanup still his (the permission classifier blocked me): `git worktree remove --force ../still-action-pedestals
  && git branch -d pedestals leanings`; the merged `the-line` branch (local + GitHub) can go too if he says.

## Earlier start-here (29 Sep, midday: his calls made, pushed)

**His calls: hulk trigger A, sentinel judged on the phone first.** Built and pushed with the two commits
below, so live now has the swap fix + counters. He is at the office: **no dev server while he's there**
(his ask; it was reachable on the office network). Headless checks run on a localhost-only vite, stopped after.
- Hulk: contact now counts toward the lunge (`inBand` in enemy.ts drops its lower bound). Headless, free hulk,
  close strike on, 20 s: lunges at 1.7 / 8.6 / 15.6 s (every ~7 s, not the ~5 I told him: cooldown 4 s +
  1.5 s build + waiting for the swipe cycle). Standing: 3 of 3 hit, HP lost 45 vs 48 switch off (the lunge
  replaces swipes, it doesn't add damage). Sidestepping on the crouch: 0 of 3 hit, HP lost 39.
  If it feels too rare on the phone, `cooldownMs` 4000 -> 2500 gives ~5 s.
- Sentinel: unchanged; ask whether he even noticed the duck (visibility may be the problem, not damage).
- **Sonnet's verification gaps, closed (except the sounds):** real depth 2 screenshots of the sentinel duck
  (normal / turned away with the lens dead / hidden behind a pillar / peek) read fine in a lit room. The
  peek's big salmon halo is the pressure burst glow from 28 Sep, not new. The hulk's crouch core WAS a flat
  peach slab (0xff7a2e swelling to 1.6x, washed out by ACES + bloom): now deeper red (0xff3812), swells
  1.3x, flickers 7 -> 18 Hz through the crouch, flare gradient redder. Trade-off: at the top of the crouch
  it's close to an ordinary core in colour; the tell is the pose + flicker. Ask on the phone if it reads.
  The three new sounds are still unheard.

## Earlier start-here (29 Sep, morning: he left for the office mid-decision)

**Two commits on `main`, NOT pushed** (31797bb, f087035 on top of 1c7d182). Live is still a4c11dd. Push
only on his word. The dev server was stopped: start it (`npx vite --host`, give him the LAN address).

**First thing: his two open calls on the counter-moves (below), then how his runs felt.** He hasn't played
anything from this session yet, and still hasn't reported on the 28 Sep night build.

**Done this session:**
- **Swap fix (31797bb, his report: "I cannot do a no melt run anymore").** Synergy trial 1's "a swap lands at
  II" fired from any rank, so a swap from a rank I part auto-melted. Now a swap from a part at I is a plain
  swap (new part at I, the old one drops at his feet, melting it in is his choice); from II or III it still
  lands at II and uses the old one up (`swapsIn` in main.ts, `TEMPER.swapRank`). Typechecked, not played.
  Note for the curve: "never-melt" runs logged between 3529052 and 31797bb that swapped were quietly tempered.
- **Rams and Lobbers keep their telegraphs: confirmed by him.**
- **Counter-moves (f087035), brief `design/enemies/COUNTERS.md`**, built by a Sonnet 5.5 engineer agent (his
  ask: use Sonnet 5.5 as subagent where it makes sense; he asked that its work be verified, and it was: diff
  read in full, checks rerun, screenshots looked at, the hulk timing test rerun). Pause switch **"counters"**,
  per device, on by default, from the next depth; ordinary (pressure) hulks and sentinels only.
  - Hulk (`COUNTER_HULK`, enemy.ts): 1.5 s in its band (outside its swipe, inside the close strike's reach) ->
    350 ms body-only crouch (core flares, own scrape sound) -> 3.5 u lunge in 180 ms, 8 dmg + 1.2 u shove,
    direction locked (a sidestep dodges), 900 ms open recover, 4 s cooldown, one hulk at a time. A push or
    a breaking part breaks the crouch; the autos never do (`breakable(e, auto)` in combat.ts).
  - Sentinel (`COUNTER_SENTINEL`, ranged.ts): planted in its sight 1.5 s -> lens dims, head turns away, servo
    whirr -> walks to cover within 5 u, hides 1.2-2 s, peeks and bursts; unplanting ends it; no cover ->
    backs away 2 u; at most half a pack's sentinels hide at once; 4 s cooldown.
  - Log per depth: `counters`, `lunges { started, hit, broken }`, `ducks { started, peeked, backed }`.

**The finding (why he has a decision to make): as briefed, neither counter bites.**
- **Hulk:** with a free-walking hulk and the close strike on, the band timer peaks at 0.3-0.48 s and never
  reaches 1.5 s (I reran this myself): the strike shoves it out, it walks back in and swipes every ~1.2 s.
  Pressure already made the band unsafe; the brief's premise ("the band is safe forever") predates pressure.
  The lunge only fires on a hulk that can't close, or a Still backing off in small steps.
- **Sentinel:** planted vs 2 sentinels, 20 s: HP lost 88.7 -> 79 (walls) / 90 -> 85.3 (open), Still's damage
  unchanged (~245): the other sentinel stays visible and the planted shot retargets. It eases fire, it doesn't
  punish. Cover within 5 u exists for ~43-60% of positions. On a real depth 2 level the hidden sentinel sits
  in the dark and is nearly invisible (legibility on the phone).

**His to decide (asked, not answered):**
1. **Hulk trigger. A (my recommendation):** time in contact counts toward the lunge too, so close play gets
   a beat: every ~5 s one hulk crouches, sidestep, punish its 900 ms opening. Symmetric with the sentinel
   punishing the planted shot. **B:** the lunge closes the gap on a Still holding 3-6 u, punishing range;
   with the duck, everything tilts to close.
2. **Sentinel:** make the peek meaner (peek from a new angle, or a longer burst) so hiding time costs him,
   or leave it and judge it on the phone first.

**Verification gaps left:** the agent's sentinel screenshots are weak (a stand-in orange box, and two it
listed, `sentinel-normal` / `sentinel-turning`, were never saved); the three new sounds (`crouch`, `lunge`,
`turnAway` in audio.ts) were never heard; the hulk's crouch core reads pale peach in screenshots (check on
the phone against his no-flat-white/salmon rule). Headless scripts from this session are in that session's
scratchpad (`lib.mjs`, `h1`-`h4`, `s1`-`s5`), not the repo.

**Still open from 28 Sep (unchanged):** next after counters is synergy step 2 (slammed); Parry Clamp needs a
new job; run length (both roads, 9 depths, Line stages B and C); his words (the mender's name and line, the
Home ending, `src/ending.ts`, the Wandering Drone's line, "hold · pay it").

## Previous start-here (28 Sep, night)

**Everything is on `main`, pushed and live** (last a4c11dd). No branches in flight; the old `pedestals` /
`leanings` branches and the `still-action-pedestals/` worktree are fully merged (safe to remove). The dev
server was stopped at the end of the session: start it (`npx vite --host`, give him the LAN address) when
work resumes.

**First thing: ask how his runs felt, before reading any numbers.** A lot changed since his last logged
runs (28 Sep 14:59 and 15:27 UTC in `playtest.json`): the recalibrated depth curve, bosses taking half from
the autos, the Arbiter's hug scald, the synergy trial, pedestals off, the mender, pressure mites. Then read
the log (dev-server runs land in `playtest.json` directly; phone exports fold in with
`npx tsx tools/mergelog.ts <file>`).

**The game today, in one breath.** 6 depths, open fields at 1 and 4. Ordinary hulks, sentinels and mites are
**pressure bodies** (no big windups; the crowd is the threat); an elite pack's crowned leader keeps the old
telegraphs (the heavy); rams and Lobbers keep theirs; bosses keep theirs. The autos: the **close strike**
(in reach) and the **planted shot** (standing still) — never "the hand" / "the eye" on screen. **Temper**:
melt a floor part into the worn one, ranks I-III; a swap from II or III lands at II (from I: a plain swap, the old part at his feet; 29 Sep). **Mastery**: melting into a III part
teaches the close strike (close parts) or the planted shot (marksman parts) one of six mods. **Synergy
trial 1**: chilled and marked states, set by the autos (mastery) and some parts, paid x2 by paying parts;
shatter. **Depth curve** (`src/curve.ts`): keyed on depth only; bosses take half from the autos. No riders,
no pedestals. Inside a run Still gets stronger (between runs, never).

**Pass lines to read after his runs:**
- Curve (design/scaling/CURVE.md): modelled finish never-melt 35% / median 73% / investor 92%, anchored on only
  two never-melt runs. First dial if the median dies at depth 5 more than 1 run in 3: ordinary HP at 5 to x1.2.
  The autos' share of a boss's HP (`autoDmg` vs `partDmg`) should now be well under half.
- Synergy (design/synergy/2-verifier.md): must hold exactly: `paidBy.hand + paidBy.eye == 0`, `maxMul <= 2`,
  every pay crosses slots. Directional: >= 0.5 paid a pack fight and 1 a heavy where a pair is worn; bonus
  0.15-0.33 of the payer's damage; `expired/set` < 0.8; median set-to-pay < 2.5 s; >= 0.3 pushes into a state
  a fight (crawl pushes were 0.49 a fight).
- Mender: `menders { met, cut, killed, healed }`; does he cut or kill, and does the cable read on depth 5's
  dark floor?

**Open, his to decide:**
1. ~~Rams and Lobbers keep their telegraphs~~: **confirmed by him 29 Sep.**
2. Next after his runs, in my suggested order: synergy step 2 (slammed: a part's shove into a wall pins, some
   parts pay x2) or the counter-moves (the hulk lunges at a Still who holds the band ~1.5 s; the sentinel steps
   behind cover from a planted Still), depending on what the runs show. Then hauled (step 3), named champions
   with stacked mods and the Mirrored one (design/variety/PITCHES.md 7-8).
3. Parry Clamp needs a new job (its catch-a-windup rarely fires now).
4. **Run length:** his runs are ~10 min against a 20-25 min target. The agreed route is both roads in one
   run (9 depths: at the crossroads he picks which road is area 2, the other becomes area 3), which needs the
   Line's stages B and C (`design/area3/`). The biggest item, separate from the rest.
5. Words that are his: the mender's name and notebook line (it has no page), the Home ending, `src/ending.ts`,
   the Wandering Drone's line, the new captions ("hold · pay it").

**Decisions he made (27-28 Sep), don't re-ask:**
- The close strike and planted shot are the only autos; on screen they are never "the hand" / "the eye".
- **Pressure accepted** ("I prefer it"): no floor rings or lines on ordinary bodies; the body's own animation
  and the projectile are enough.
- **Inside a run Still gets stronger**; "wider, not stronger" is between runs only. "Never more enemy HP or
  damage" is lifted: a fixed depth curve, never scaled to his loadout ("be smart so that growth is not punished").
- The harder target: never-melt finishes ~1 in 3, median ~2 in 3, investor nearly always.
- Bosses take half from the autos; the Arbiter's scald comes sooner while he hugs it.
- Temper and mastery (his idea: "option 3 but after the rank III"); riders cut; pedestals removed ("not feeling
  the benefit"); floor drops fill empty slots.
- Synergy: build it, with shatter. Mastery chill has no slow (the recommended default; he didn't pick).
- Run length target 20-25 min; both roads in one run (9 depths). Open fields at depths 1 and 4.
- The build rules were re-read (`design/rules/PITCHES.md`); several were inherited from the turn-based games and
  stricter than their sources. The rules round's trial (poise etc.) is superseded by pressure + synergy.
- The three design agents keep `model: opus` (the alias), not pinned.

**Working setup notes:** `repos/personal` isn't a git repo; the still-action checkout is. Engineer agents were
briefed with a written spec (`design/*/BUILD-*.md`, `design/enemies/*.md`), told not to commit, and reviewed
(checks + screenshots) before each push. Sunhill uses `npx vite --host --port 5180`.

## What changed on 28 Sep (in order)

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

**28 Sep, mites as pressure bodies (a4c11dd):** an ordinary brood's inner mites rear 120 ms and nip for 3
on their own clocks (`PRESSURE_MITE` in swarm.ts), no surge ring, bites stack; a queen's brood and boss adds
keep the surge. Surrounded, ~6 dps at depth 1 as before; the curve's x1.5 now reaches them at depths 4-5.
Known, untouched: an elite Quick brood surges with only its queen (1.5 dps, before this change too).


## The autos now (28 Sep, for reference)
Close strike ("hand" in code): 10 dmg on the 0.62 s beat within arm's reach, breaks a breakable windup (heavies
only now), shoves 0.5 u, no strike while backing away. Planted shot ("eye"): planted 0.3 s, 8 dmg, pierces,
shoves 0.6 u, blows taken halved, aims at a breakable windup first. Walking at range: no auto. A boss takes
`BOSS_AUTO_MUL` 0.5 of both. Mastery adds behaviour (slow-free chill, mark, cleave, split). Log fields:
`handBreaks`, `braced`, `autoDmg`, `partDmg`, `playS`, `walkS`. Phone log: `?owner` + pause-screen export.

## Picks on pedestals (replay step 2, 28 Sep) — OFF since 28 Sep (`PEDESTALS_ON`), kept for history

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

## The two leanings (replay step 3, 28 Sep) — merged; riders cut since, mastery is the payoff now

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

**The run:** one day, 6 depths, ~10 minutes of play today (target 20-25). Area I (ruin, depths 1-2, the Assembler at 3), area II
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

## The replay plan: `design/replay/PITCHES.md` (partly superseded on 28 Sep: pedestals off, riders cut; see Start here)

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
| `enemy.ts` / `ranged.ts` / `charger.ts` / `lane.ts` / `swarm.ts` / `lobber.ts` / `thief.ts` | hulk, sentinel, ram, mites, Lobber, thief (pressure variants in enemy / ranged / swarm) |
| `boss.ts` / `arbiter.ts` | the `Boss` interface and the Assembler; the Arbiter |
| `hide.ts` | enemy body materials |
| `abilities.ts` / `parts.ts` / `partfx.ts` / `partmodels.ts` / `pool.ts` / `drops.ts` / `loot.ts` | the 30 parts, their runtime, visuals, models, the pool, drop rules and picks, the floor loot and pedestals |
| `temper.ts` / `mastery.ts` / `states.ts` | ranks I-III and melting; the six masteries; enemy states and the one multiplier (`stateMul`) |
| `curve.ts` | the enemy curve by depth (`DEPTH_CURVE`) |
| `mender.ts` | the mender and its cable |
| `still.ts` / `handring.ts` / `sightline.ts` | the Lantern; the hand's ring; the eye's sightline |
| `workshop.ts` / `save.ts` / `notebook.ts` / `crayon.ts` / `ending.ts` | the Workshop, the save, the notebook, the kids' drawings, ending words |
| `hud.ts` / `pause.ts` / `style.css` / `camera.ts` | UI, pause (with switches) and compare, type, zoom |
| `vfx.ts` / `audio.ts` / `music.ts` / `ambience.ts` | particles and shaders; synth and samples; score; room tone |
| `tools/dropsim.ts` | the drop simulator, the live game since B0 (9 depths, pedestals off, kills x0.4, melts; `--road`, `--vs <log>` compares his last 2 runs; `--side 0.5` / `--whim 0.08` fitted to runs 23-24) |
| `tools/leancheck.ts` | the leanings' static checks (`npx tsx tools/leancheck.ts`) |
| `tools/statecheck.ts` | the synergy states' static checks (`npx tsx tools/statecheck.ts`) |
