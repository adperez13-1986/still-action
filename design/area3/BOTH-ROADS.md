# Both roads in one run

29 Sep 2026. Reconciles `design/area3/SPEC.md` (25 Sep) with two things it doesn't know:
his 27 Sep call that a run takes **both roads** (9 depths), and what was built 25-29 Sep. This
doc doesn't replace SPEC.md. SPEC.md stays the contract for the Line's pieces (rails, trains,
the Signalman, the Handcar, Sleepers, the Engine). This doc says what moves around them.
Settled decisions (DESIGN.md, HANDOVER.md "Decisions he made") are taken as given.

Words marked PLACEHOLDER are his to rewrite.

---

## 1. The run as it would be

At the crossroads he picks which road is area 2. The other road becomes area 3. Two orders:

**Works first (W)**

| depth | place | shape | boss / beams | the day (today's table) |
|---|---|---|---|---|
| 1 | ruin | open field | exit | morning → late-morning |
| 2 | ruin | rooms | exit | late-morning → noon |
| 3 | ruin, the yard | arena | **Assembler** → cold + warm | noon (held) |
| – | the crossroads | one room | two cold beams: Works / Line | afternoon, no span |
| 4 | the Works | open field | exit | afternoon → late-afternoon |
| 5 | the quarter | rooms | exit | late-afternoon → dusk |
| 6 | the quarter, the square | arena | **Arbiter** → ? **(flag A)** | dusk → first dark, by its HP **(flag B)** |
| 7 | the sidings | rooms **(flag C)** | exit | **undefined (flag B)** |
| 8 | the station | rooms | exit | undefined |
| 9 | the roundhouse | arena | **Engine** → warm only | undefined |
| – | walk home | the quarter at night | the lit house → Home (night) | night |

**Line first (L)**

| depth | place | shape | boss / beams |
|---|---|---|---|
| 1-3, crossroads | as above | | |
| 4 | the sidings | rooms **(flag C)** | exit |
| 5 | the station | rooms | exit |
| 6 | the roundhouse | arena | **Engine** → ? **(flag A)** |
| 7 | the Works | open field | exit |
| 8 | the quarter | rooms | exit |
| 9 | the quarter, the square | arena | **Arbiter** → warm only |
| – | walk home | the quarter at night | Home (night) |

Where the existing design is silent, or wrong, at 7-9 or after a boss at 6 that isn't last:

- **A. The beams after boss 6.** `exitsAfterBoss` (areas.ts:84) is `depth < RUN_DEPTHS ?
  cold+warm : warm`. At `RUN_DEPTHS = 9` it opens **both** at 6 with no other change. The area
  III brief says "the warm beam home opens after each boss", so the docs lean yes. But two things
  break:
  - In the square, the cold beam goes at the exit room's centre (dungeon.ts:1762). That's where
    the tower's footprint is (dungeon.ts:1340), and the husk is solid after the kill. **The cold
    beam would sit inside the husk.** It needs its own spot, e.g. `c − side × 4.5`, mirroring the
    warm beam.
  - SPEC §7.2 gives the roundhouse "warm only".
- **B. The day.** `DAY_SPAN` (areas.ts:502) and the `DayTracker` (day.ts:24, 29) only cover depths
  1-6, clamped to `RUN_DEPTHS`. With `RUN_DEPTHS = 9` the clamp lets 7 through, and
  `DAY_SPAN[7]!.by` is undefined: **a TypeError on entering depth 7**. Also:
  - depth 6 is `by: 'boss'` (lights out to first dark), and `bossDown` snaps the day to first
    dark only for the Arbiter (main.ts:2343-2350). Either road's boss at 6 would then leave three
    depths to play after first dark, and "nothing in a level reaches night".
  - `DEPTH_DAY` (areas.ts:476) is unused (it's only read in the spec). `DAY_SPAN` is the live table.
- **C. Open fields.** The brief for this work says open fields at 1, 4 and 7. The code and the
  27 Sep commit say "never on the Line": `open = … && !gen.line` (dungeon.ts:1152), and
  `OPEN_DEPTHS = [1, 4]` (main.ts:84). As built, each run gets two open fields: depth 1, and
  whichever of 4 or 7 is the Works. **Ambiguous: see decision 4.**
- **D. Home at 6.** `hourAtEnd('home', d)` (areas.ts:97) is night only at `RUN_DEPTHS`, so Home at
  6 reads **afternoon** (kids awake) while the level around him is at dusk. `homing()`
  (main.ts:3874-3881) goes straight to the words below `RUN_DEPTHS`, with no walk. So Home at 6
  would be a homecoming at the wrong hour.
- **E. The night walk.** It's always the quarter at night (`WALK_PLACE`, areas.ts:342). SPEC
  §1.3 already settled "both roads walk home through the quarter", so after the Engine at 9 he
  steps from the roundhouse to the quarter. That's accepted, not new, but it's now half of all runs.
- **F. "Every ending keeps everything."** It holds. The found set, hook, history and card are
  untouched by depth count. There's a beam save at every depth and in the crossroads. The card
  caption becomes "saw depth 9" (pool.ts:162).
- **G. Named parts.** "…, that saw the Arbiter" and "…, that saw the Engine" (pool.ts:144-146).
  With both bosses in every full run, the Arbiter rule, listed first, wins every time. The Engine
  suffix would only show on a part that saw the Engine and never the Arbiter. That's a small
  words call for him, not a blocker.
- **H. The walk-home level's number.** It's `RUN_DEPTHS_WALK = 7` (dungeon.ts:2028), which is now
  a real depth. Nothing reads it but the banner, but it should become `RUN_DEPTHS + 1`.

---

## 2. What in SPEC.md is now wrong or outdated

Grouped by section. "Min change" is the smallest edit that makes the section true again.

| § | it says | why it no longer holds | min change |
|---|---|---|---|
| header | "Strain step 1 isn't in the tree" | The break rule is permanent (26 Sep): a pushed hit breaks the windup it lands in. | Say so. The Signalman's windup breaks to any push that lands, as well as `interrupt()`. |
| header | `dist/` 4,997,790 B vs the 5.6 MB cap | `dist/` on disk is **5,352,326 B**, built at HEAD 6badaf6, and the Gravel023 pair is already in. | About 248 KB of headroom. B+C's JS estimate (≈ 90-120 KB) fits, with no slack for sound files. |
| 0, 1.2.1 | "A 6-depth, 26-minute run can't grow longer", "the same 6 depths, about 26 minutes", "a second road through the same afternoon" | His runs log 9.7-11 min of play (28 Sep, `playtest.json` `playS`). The target is 20-25. He chose both roads. | The Line is area 2 *or* 3, not an alternative. Rough length: ruin ~4.5 + Works ~5.5 + Line ~5.5 ≈ **15-16 min of play**. That's the low end of the target: see §5, T. |
| 0, 1.7, 11 | The Engine is stage C, optional. "Until stage C the Line ends at the Arbiter, in the square where the roads meet" | Both roads end in one run, so the Arbiter would be fought twice. | **The Engine is required.** `ENGINE_ON_LINE = false` is no longer a live fallback. Before C, a DEV stand-in: Home's second Assembler (`adds: 'rams-mites'`, the existing `ARBITER_AT_6` fallback path) ends the Line. |
| 1.1 | `RUN_DEPTHS = 6`, and every lookup is keyed by depth | Depths 4-6 and 7-9 are each "a road's 1st/2nd/3rd depth". | Add `roadOf(depth)` and `stepOf(depth)` (below). Keep `ROUTES` keyed `4 \| 5 \| 6` as the road's own depths. |
| 1.2.3 | "Nothing stronger. No HP or damage by depth. The Engine is 900 HP. Every hit ≤ 22" | Lifted on 28 Sep: `DEPTH_CURVE` (curve.ts), with boss HP ×1.3 and damage ×1.2 at 6. Bosses take half from the autos. | "900 × `curveAt(d).bossHp`. ≤ 22 before the curve." The Engine's hazards need to read `dmgMul` like the other bosses' hurt paths do. |
| 1.4, 1.5.2, 3 | The crossroads keeps "on or home" the only binary, and both beams go *on* | That's still true at 3. The choice is now **order**, not which road. After boss 6, the cold beam goes to the other road with no room. | Keep the room. After boss 6, reuse `dressYardBeam` (main.ts:2820) to dress the cold beam as the other road. Its code exists; it's gated to depth 3 and the alternate. |
| 1.5.1, 2.1 | `ROUTES[route][4\|5\|6]`, `lookAt`/`areaOf`/`bossFor` clamp to `RUN_DEPTHS`, "the roads meet in the square" (lookAt, areas.ts:351) | For 7-9, the clamp returns 6's place, and `bossFor` gives the Arbiter/Engine only at `RUN_DEPTHS`. With 9, depth 6 would get an **Assembler** (areas.ts:420). | `stepOf(d) = d ≤ 3 ? d : ((d − 4) % 3) + 4` and `roadOf(d) = d ≤ 6 ? run.route : other(run.route)`. `lookAt` and `bossFor` read `ROUTES[roadOf(d)][stepOf(d)]`, and the road's boss at step 6. Delete the "roads meet in the square" branch. `areaOf` gains area index 3 (`AREAS` stays 2 defs, but II/III are picked by road). |
| 1.7 | `ROAD_CHOICE = 'alternate'`: the road alternates by `lastRoad` | That still makes sense, as "**the order** alternates". `routeForAlternate` (main.ts:2895) already returns the road not taken last. | Reword only. It stays the fallback. |
| 1.7 | four flags | There's no switch for the run length. | Add `BOTH_ROADS` (`flag('roads')`, `?roads=1`) and derive `RUN_DEPTHS` from it: 6 off, 9 on. Everything stays dark until his OK. |
| 2.9 | Save v3: `roads`, `lastRoad`, history tuple of 8, snapshot `route`, card `route` "taken at depth 4" | It all still works. `route` = the road at area 2, and area 3 is derived. Snapshot `depth` up to 9 fits (`resumeRun` clamps to `RUN_DEPTHS`, main.ts:2435). | **No save v4 needed.** The card writes `route: 'III'` only for Line-first (main.ts:2990). That still reads as the order. One edge: a 9-depth snapshot at 7-9 loaded by a 6-depth build clamps to 6 on the wrong road. That's acceptable for DEV, and gone once live. |
| 3.1 | The room appears "the run after the one that felled an Assembler" (`save.roads` gains `'III'`) | With both roads, a run before that would be 6 or 9 deep? | See decision 5. The recommendation keeps the gate: before the Line opens, a run goes Works → Line with no room. |
| 3.2 | The crossroads is `applyDay('afternoon')`, no span | Fine, if area 2 still starts in the afternoon. | Follow whatever decision 3 sets for depth 4's `from`. |
| 4.2, 5.1, 6.5 | Lessons at `depth === 4` (the lane lesson, Signalman/Handcar lessons, sidings `holds`, Sleepers chance `{4, 5}`, the swarm lesson). The Works' ram rooms/heap at 4, the Lobber lesson at 5 | With the Line at 7-9 or the Works at 7-9, **none of those road lessons fire**. The swarm lesson would fire on the Line at 4 but not again at 7 (correct). On a Line-first run **Lobbers never appear**: depth 8 uses `D7` (dungeon.ts:1511), which has no `L`. | Generation reads `stepOf(depth)` for every place/road rule (tables, lessons, `holds`, Sleepers, mender/thief depths, `CAPS`). It reads the real `depth` only for the curve. The swarm lesson stays "the run's depth 4 only". `D7` goes unused. |
| 6.1 | Signalman: 900 ms windup, broken by `interrupt()` (Parry Clamp, Clamp Toss) | Since 28 Sep the planted shot aims at a breakable windup first, and the close strike breaks one. A variant sentinel isn't a pressure body (combat.ts:2678, `!e.variant`), so **the autos would break every call**. | Autos never break it: in `breakable`, treat `variant: 'signal'` like the counter's crouch (a push or a part only, combat.ts:1170). This is also a job for Parry Clamp, which HANDOVER says needs one. |
| 6.2-6.5 | Pack tables, telegraphs, the brood rule | Ordinary H/S/M on the Line are already pressure bodies (combat.ts:2676-2679). G is a variant (keeps its telegraph), K is a charger (rams keep theirs, confirmed 29 Sep). G/K never lead, so the crowned-leader rule holds unchanged. Sleepers are an ordinary brood, so pressure mites that nip and **never surge**: the §5.8 brood rule only touches queen/elite broods. | No table change. Rewrite K-T5/K-T6 for pressure bodies. A pressure hulk in contact cycles cock → recover (non-`approach`, so "committed", combat.ts:1535) most of the time. **Trains will kill more of a pack than the balancer modelled.** Measure the trains' kill share headless first. Counters also apply on the Line (a lunge can carry a hulk onto a lit lane: symmetric, fine). |
| 7.2 | Roundhouse beams "per `exitsAfterBoss(6)` (warm only)" | At 6 on Line-first it's cold + warm. | Cold at `c` (inside the loop, clear of the rails), warm at `c + side × 4.5` as specced. Check neither beam is on a rail strip. |
| 7.3 death | "the day snaps to 1 whenever `DAY_SPAN[depth].by === 'boss'`" | Right idea, but `bossDown` still special-cases the Arbiter. | Generalise, as the spec says, and pick which depth is `by: 'boss'` in decision 3. |
| 7.5, 8 | Parry Clamp "breaks the Signalman's wave" | Still true, and now it's wanted. | none |
| 9 | +≤ 0.35 MB, total ≈ 5.35 MB | Total is 5.35 MB *now*, before B and C. | Re-measure after B (K-Z1). If it's tight, the first cut is sound-file-free as specced. |
| 11 | Stages A-D, "about 15 evenings", "stage B is the safe stop" | A was built in one day (25 Sep). B isn't a safe stop any more, since the Engine is required. | Replaced by §5 here. |
| 12 K-R3, K-N16 | `bossFor(6, true, 'III', false).kind === 'arbiter'` | The roads don't meet. | The Line's last step is the Engine, or the DEV stand-in Assembler. The Works' last step is the Arbiter, at 6 or 9. |
| 12 K-X1-X7 | Checks written against depth 4 | They stay valid at 3 → 4. | Add: boss 6 → cold beam → depth 7 on the other road, no room. Add both orders in `__census`. |

Also outdated, and not in SPEC: `curve.ts` covers 1-6, and `curveAt` falls back to **depth 5's
row, the wall**, for everything past it (curve.ts:43). So depths 7-8 would silently be the wall
twice more, and boss 9 gets `bossHp 1`.

---

## 3. What stage A actually built (on `main`, dark)

A1-A4 are merged (commits 14a9ee7, e86479d, d056120, c06fcae; `the-line` has nothing
unmerged). The K-R/K-X/K-G/K-T checks were run from session scratchpads. **None of them are in
the repo** (`tools/` has only dropsim, leancheck, statecheck and mergelog), so I can't re-run or
confirm them.

**Flags and routes, `src/areas.ts`:**
- `RUN_DEPTHS = 6` (16). Its comment already says "a 9-depth run is this changing to 9".
- `LINE_ENABLED` / `ENGINE_ON_LINE` / `PORTER_ENABLED` are false, and `ROAD_CHOICE = 'crossroads'` (31-37).
- `flag()` / `roadChoice()` / `setFlags()` read DEV-only overrides (56-69).
- `RouteId` (74), `ROUTES` keyed `4|5|6` (336-340), `WALK_PLACE` (342).
- `lookAt` clamps to `RUN_DEPTHS` and has the "roads meet in the square" branch (347-353).
- `areaOf` (366-369).
- `bossFor` reads the Engine/Arbiter only at `depth === RUN_DEPTHS`, else an Assembler (414-421).
- `ENGINE_DEF` (399).
- The `sidings` and `station` places are in full (281-331).
- This matches the spec. Every depth clamp and `=== RUN_DEPTHS` test here needs `stepOf` / `roadOf`.

**Crossroads, `src/crossroads.ts`:**
- `CROSSROADS` (23-46), with PLACEHOLDER labels "the Works" / "the Line" (29-30).
- `dressRoad` (94) and `generateCrossroads` (173), at depth 3.
- Matches the spec. It needs no change for 9 depths.

**Crossroads flow, `src/main.ts`:**
- `crossroadsDue` (2793), `dressYardBeam` (2820, gated to depth 3), `enterCrossroads` (2839).
- `takeRoad` (2885) sets `run.route` and `save.lastRoad`. `routeForAlternate` (2895).
- The descend swap at 3 → crossroads or `enterLevel(4)` (3683-3690).
- Resume: the crossroads snapshot (2406-2407, 2465), route inference (2437-2439).
- The card's `route` (2990) and opening `'III'` at commit (3015).
- `routeNow` / `bossHere` (2296-2298). `enterLevel` passes `lookAt(depth, routeNow(), flag('engine'))` (2581-2583).
- For 9 depths: `routeNow()` becomes `roadOf(depth)`. `dressYardBeam` extends to boss 6.

**Line runtime, `src/line.ts`:**
- `LINE` (21) and `SIDING` (46) numbers as specced. `LaneDef` / `SidingDef` (48-75).
- `buildLinePieces` (143). The `Train` stages add a `booked` stage (248) not in the spec.
- The `Line` class (371): timetable, calls, the lesson on first entry (478).
- `combat.ts` ticks it after the enemy loop and then `stepOff` (619-620). `committed` (1533), `stepOff` (1548).
- The brood hook is `nearLit` (502).
- It's depth-agnostic except the lesson flag, which `layLine` sets.

**Line generation, `src/dungeon.ts`:**
- `layLine` (998): `holds` keyed `depth === 4` (1110), lesson lane `depth === 4` (1128).
- In `generateLevel`: `open` never on the Line (1152), `layLine` (1158).
- Line pack rows `D5L` / `D5L_LANE` / `D5L_HANDCAR` (903-912), `SIGNAL_PACKS`, `SLEEPERS_CHANCE {4, 5}` (916).
- Lessons: ram `depth === 2` (1411), swarm `depth === 4` (1414), Handcar/Signalman `depth === 4` (1419-1421), Works heap `depth === 4 && works` (1431), Lobber `depth === 5 && !line` (1456).
- Table pick `depth >= 5 … depth >= 7 ? D7 : D5` (1511).
- `LINE_BODIES = { signal: false, handcar: false }` (885): rows naming G/K are generated without them, as specced for "H/S/C/M only".
- Also depth-keyed: `CAPS` (931), elites from `curveAt(depth).heavies` (1604), `THIEF.depths [1,2,4,5]` (thief.ts:40), `MENDER.chance {2,4,5}` (mender.ts:49).
- So the thief and the mender already appear on the Line at 4-5. Not in the spec. Fine, but note that the Porter was meant to be the Line's thief.
- For 9 depths: all of these read `stepOf(depth)`, and only the curve reads `depth`.

**Save, `src/save.ts`:**
- v3 (24), 8-tuple history (44), `RunCard.route` (79), snapshot `route` / `crossroads` (137-139).
- `roads` / `lastRoad` (175-177), migration 2 → 3 (202-208), `repair` (263-265), the cross-tab union of `roads` (389).
- `NAMED` has the Engine (pool.ts:146).
- Matches the spec. No change needed for 9 depths (§2).

**Not built:**
- `signal.ts`, `engine.ts`, the Handcar variant, the `ballast` look / `sleepers` hide.
- The `line` / `roundhouse` ambience (the Line uses `works` / `quarter`, areas.ts:295, 323), the notebook re-roles.
- The `roundhouse` arena (no generator case). `bossDown` isn't generalised.

**Other things 9 depths touch that aren't Line code:**
- `hourAtEnd` (areas.ts:96-102), `DAY_SPAN` / `spanOf` (502-510), `DayTracker` (day.ts:24-29).
- `DEPTH_CURVE` / `curveAt` (curve.ts:33-45).
- `OPEN_DEPTHS` (main.ts:84), `crawlBpm` slowing only at 4-5 (main.ts:3947).
- The notebook's `bandOf` (notebook.ts:87, I/II only: fine, area 3 names come from band II).
- The square's cold beam (dungeon.ts:1759-1764 vs 1340).
- `__census` looping `1..RUN_DEPTHS` on one route (main.ts:4405-4407), which feeds `tools/levels.json` and dropsim.

---

## 4. Decisions only Adrian can make

**Decided 29 Sep: he took every recommendation below** (1a warm beam after boss 6; 2a Home at 6 is a
dusk homecoming, no walk; 3a one day stretched, the last boss takes it to first dark; 4a no open field
on the Line, the Works' first depth is open wherever it falls; 5a keep the gate, Works then Line with no
room until the Line has opened; 6a the curve's finish moves to depth 9; 7 the crossroads room, the
alternate as fallback). **8: every name and word stays PLACEHOLDER until he writes it.**

1. **A warm beam after the boss at 6?**
   - (a) Yes: every boss but the last opens on + home.
   - (b) No: 6 opens cold only.
   - **Recommend (a).** It's the existing rule unchanged (`exitsAfterBoss`), and it keeps "going
     home early is a different homecoming, not a lesser one" true at every boss.
2. **What Home at 6 is.**
   - (a) A third homecoming, at dusk: window `dusk`, no walk.
   - (b) The same as Home at 3: afternoon.
   - **Recommend (a).** The level around him is at dusk, so afternoon would be a lie. `WINDOW.dusk`
     already exists.
   - The ending words (all three hours, and whether the night one differs after the Engine vs
     the Arbiter) are his: PLACEHOLDER.
3. **The day over 9 depths.**
   - (a) The same one day, stretched: area 2 afternoon → late afternoon, boss 6 held. Area 3 late
     afternoon → dusk, and the **last boss** (whichever road) takes it to first dark by its HP.
   - (b) Area 3 at night.
   - **Recommend (a).** "Nothing in a level reaches night" and "one day" both survive. It needs
     two in-between hours built with `mixPreset` (internal names, not player-facing).
   - The cost: the Arbiter's lens going out at 6 on a Works-first run brings no dark.
4. **An open field on the Line?**
   - (a) No: the Works' first depth is open wherever it falls (4 or 7), and the Line's never is.
   - (b) Design a Line field.
   - **Recommend (a).** Lanes are laid across rooms and corridors. An open field has neither, and
     the trains already give the Line its own texture. The consequence: every run has exactly two
     open fields.
5. **The run before the Line has opened.** Today `save.roads` gains `'III'` only once an
   Assembler has fallen.
   - (a) Keep the gate: until it's open, a run past 3 goes Works → Line with no room, so every
     full run is 9 deep. The room appears once the Line has been seen.
   - (b) The room from the first Assembler ever.
   - **Recommend (a).** It's the code as built. He meets the Line as new at 7, and it gets its
     lessons.
6. **The curve's finish line.** The targets (never-melt ~1 in 3, median ~2 in 3, investor nearly
   always) were set on a 6-depth finish.
   - (a) They move to depth 9.
   - (b) They stay at 6, and 7-9 are extra.
   - **Recommend (a).** Otherwise most runs die in area 3 and Home at night gets rare. It means
     depth 5 is probably no longer "the wall", and 4-6 ease a little.
7. **The crossroads, or the alternate** (still open from SPEC §1.9.1).
   - **Recommend the room.** The order is a real choice (which boss last, which road fresh). The
     alternate stays as the one-constant fallback.
8. **Names and words, all his:**
   - the Line, the Engine, the Signalman, the Handcar, Sleepers;
   - the beam labels, and whether they hint that the other road follows;
   - "area N cleared";
   - the Engine's board copy;
   - the named-part suffix order (§1 G).

---

## 5. Revised build order

Everything stays behind flags (`LINE_ENABLED`, `ENGINE_ON_LINE`, and the new `BOTH_ROADS`),
false on `main`, until his OK. DEV: `?roads=1&line=1&engine=1`. "Session" means one agent
session with review. What stays hard, however fast it's typed: tuning on the phone, the Engine
fight's feel, and whether tells read at phone size.

| stage | what | ends playable as | sessions | verify |
|---|---|---|---|---|
| **R. Nine depths** | See the list below. | **9 depths, both orders, on LAN.** The Line has trains but no bodies of its own yet, and ends in the stand-in boss. | 1.5-2 | **Headless:** `__gen` d1-6 on flag off equals `tools/levels.json`; both orders walk 1 → 9 with `__enter` / `__killBoss`; every depth has a `DAY_SPAN`; the square's cold beam is reachable; no crash at 7-9. **Phone:** his real run length on the full run (the whole reason). |
| **B. The Line's bodies** | SPEC B1-B4: the Signalman (autos don't break it), the Handcar, Sleepers (pressure mites under ballast), the `line` ambience, notebook re-roles, the hides. | The Line whole, still with the stand-in boss. | 2-3 | **Headless:** K-E1-E12 (rewritten for pressure bodies), the trains' kill share. **Phone:** the Handcar's tell is never taken for a train's, the hides against the no-flat-white/salmon rule, Sleepers' shiver visibility on the dark floor. |
| **C. The Engine** | SPEC C1-C2, now required: the roundhouse (cold + warm at 6, warm at 9), track, levers, board, derail, steam, phase 2, husk, `bossDown` generalised (the day snaps by `DAY_SPAN`, not by `instanceof Arbiter`), bosses take half from the autos, curve HP/damage on its hazards. | Both roads with their own bosses. | 3-4 | **Headless:** K-N1-N15, the slack sweep, the INV sweep. **Phone:** the lever window against his real cooldowns, whether the lit rail reads 1.3 s ahead, the fight's length (the spec's 85-100 s is a guess). This is the hardest stage. |
| **T. Tuning** | The curve 7-9 on his runs, CURVE.md method (see the list below). | The same, tuned. | 1-2, bound by his play | Mostly **phone** (his runs, then `playtest.json`). Dropsim and the curve model headless. |
| **Live** | Flip `BOTH_ROADS`, `LINE_ENABLED` and `ENGINE_ON_LINE` together, on his word. | Live. | 0.5 | K-X8 (a production build ignores DEV params), K-Z1 (dist ≤ 5.6 MB). |
| D (after) | The Porter, the station clock. | | 1 | Optional. |

**Stage R, in full:**
- `BOTH_ROADS`, with `RUN_DEPTHS` derived from it.
- `stepOf` / `roadOf` through `lookAt` / `bossFor` / `areaOf` / `generateLevel` / `routeNow`.
- `DAY_SPAN` 1-9 and `hourAtEnd`, per decisions 2-3.
- First-pass `DEPTH_CURVE` rows 7-9. Modelled only, not locked: "don't lock a baseline on
  incomplete content".
- Open field at the Works' first depth.
- The square's cold beam spot.
- The other road's dressing on the cold beam after boss 6.
- The DEV stand-in boss at the Line's end.
- `RUN_DEPTHS_WALK`.
- `__census` / `__gen` taking an order.
- The stage A checks rewritten into `tools/`, so they live in the repo this time.

**Stage T, in full:**
- Strain over 9 depths. `QUIET_FLOOR` 0.5 ratchets, and the spec already expected Stopped to
  double on the Line. The first dial is the quiet floor or a Rest per area, not strain numbers.
- The run length against 20-25 min. If it lands at ~16, the next lever is the longer spines at
  2 / 5 / 8 already on his list.
- `crawlBpm` for 7-8.

**Order rationale.** R first, because it answers the question that started all this (does 9
depths reach 20-25 min?) for about two sessions, and B and C then build into a run he's already
playing. The total is about 8-11 sessions, plus his phone time. That total rests on two things
nobody can see yet: how the Engine plays, and how the curve lands.

---

## Could not verify

- The stage A headless checks (K-R, K-X, K-G, K-T) passing. They aren't in the repo.
- That `dist/` (5,352,326 B, built 29 Sep 08:32) is exactly HEAD. It was built at HEAD's commit
  time; not rebuilt.
- How long a Line level takes to play. It has never been played by him (the flag is off), so
  the ~5.5 min per area is area II's.
