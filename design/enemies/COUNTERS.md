# Build: the counter-moves (hulk lunge, sentinel duck)

29 Sep 2026. His call: "do the counter moves next". Source: design/rules/1-translator.md M2 and change 3,
design/rules/PITCHES.md "Next, for observation 2", design/rules/2-claude.md "Enemies". The rule (M2):
*every archetype has a second tell that punishes the answer that beats its first.* Today nothing answers
his answer: holding the close strike's band on a hulk is safe forever, and planting on a sentinel is safe
forever. Two enemies first, to learn if "it answers you" is the missing feel, before building families.

Settled since the rules round, and binding here (DESIGN.md Enemies, design/CONTEXT.md, HANDOVER.md):
- **Pressure is accepted.** Ordinary hulks, sentinels and mites are pressure bodies: **no rings or lines on
  the floor**; the body's own animation, its sound and the projectile are the tell. Their hits stack
  (`hurtPlayer(..., stack)`). So the translator's "a line" for the lunge is replaced by a body tell.
- An elite pack's crowned leader keeps the old telegraphs (the heavy); rams and Lobbers keep theirs;
  bosses keep theirs. **Counter-moves are for ordinary (pressure) hulks and sentinels only.**
- Rules are symmetric between Still and enemies (walls block shots both ways).
- Colour: ember is for threats (cores, eyes, seams, tells); bodies are metal. No flat red or white effects.
- The autos (close strike "hand", planted shot "eye") never break a pressure body. On screen they are never
  called "the hand" / "the eye".

Repo: /Users/adrianperez/repos/personal/still-action. Read first: `src/enemy.ts` (the hulk, `PRESSURE_HULK`,
its approach/cock/strike/recover and `strikePose`), `src/ranged.ts` (the sentinel, `PRESSURE_SENTINEL`, its
sight check `terrain.lineClear(..., true)`, strafe), `src/combat.ts` (`HAND`, `HAND_REACH`, `EYE`, where the eye's
planted state lives, `addPack` where `pressure` is set, `hurtPlayer`, the break path for pushes/parts,
`breakable`), `src/main.ts` (the `temper` pause switch at ~1926 as the pattern for a switch, `run.stats` per
depth at ~2561), `src/audio*` for how tones are synthesised.

## 1. The hulk's lunge (answers holding the band)

- **Trigger:** a pressure hulk tracks how long Still has stood in its **band**: within the close strike's
  reach of it (Still could hit it) but outside its own swipe reach (`PRESSURE_HULK.reach + radius`), with a
  clear line. Time accrues while in the band and drains at 2x outside it. At **1.5 s** it lunges.
- **Tell (body only):** it locks its direction at the start and crouches back for **350 ms** (lean back, arms
  low, squash: clearly bigger than the 180 ms swipe cock), its core flares ember through the crouch, and a low
  scrape/hydraulic tone starts on the crouch frame (its own sound, distinct from the swipe).
- **The lunge:** committed along the locked direction, **3.5 u in 180 ms**, stopped by terrain. Hits Still once
  if it passes within its reach: **8 damage** (the depth curve's `dmg` applies via `dmgMul` as for any body),
  shoves Still **1.2 u** along the lunge, stacks like other pressure hits. A sidestep during the crouch dodges it.
- **After:** a long **900 ms recover** (it's open: the punish), then a **4 s** cooldown before it can build again.
- **At most one hulk lunging (crouch or dash) at a time** across the whole combat, so a crowd doesn't all go.
- **Breakable by a push or a part** that breaks windups (as a heavy's windup is), **never by the autos**. The
  push gets a job here. If breaking it needs more than the existing break path, say so and stop at the
  simplest version.

## 2. The sentinel's duck (answers planting)

- **Trigger:** a pressure sentinel tracks how long Still has been **planted** (the eye's settled state) with a
  clear sight line to it. At **1.5 s** it ducks. Drains at 2x when Still is moving or out of sight.
- **Tell:** its lens dims and turns away from Still, and a short servo whirr, on the frame it breaks off.
- **The duck:** it picks a spot within **5 u** it can path to where `lineClear(spot -> Still, ..., true)` is
  blocked (cover), and moves there at **1.4x** its speed. Stays **1.2-2.0 s** (random) while Still stays
  planted. Then it **peeks**: steps to the nearest spot with sight and fires its burst at once (the lens glow
  of `PRESSURE_SENTINEL.cockMs` still plays first). If Still unplants while it hides, it goes back to its normal
  behaviour at once. No cover within 5 u: it backs away 2 u from Still instead (no duck).
- **At most half of a pack's sentinels hiding at once** (at least one may). **4 s** cooldown after a peek.
- Open fields (depths 1 and 4) have wall stubs; rooms have pillars and walls. Check it finds cover on both.

## 3. Switch and log

- A pause switch **"counters"**, per device, on by default, the `temper` switch's pattern (localStorage key
  `still-action.counters`); takes effect from the next depth like pressure did. Off = today's behaviour exactly.
- Numbers in one `COUNTER` table each (`COUNTER_HULK` in enemy.ts, `COUNTER_SENTINEL` in ranged.ts) with a
  doc comment in the house style (dated, his words where they exist).
- Log per depth in `run.stats`: `counters` (bool), `lunges { started, hit, broken }`,
  `ducks { started, peeked }`. Fold into whatever types the playlog/mergelog use so exports carry them.

## Verify

`npx tsc -b`, `npx tsx tools/leancheck.ts`, `npx tsx tools/statecheck.ts`, `npx vite build`. Headless with
playwright-core: install it into the session scratchpad
(`/private/tmp/claude-501/-Users-adrianperez-repos-personal/fda9daf9-74e8-44a8-88ff-a68d5de46c33/scratchpad`), launch
Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` via `executablePath`, args
`['--use-gl=angle', '--enable-unsafe-swiftshader']`. The dev server is already running on http://localhost:5173
(do not start or stop it); `?depth=N`; DEV hooks `__arena`, `__pack`, `__spawn`, `__step`, `__stick`, `__combat`,
`__runStats` (find them in main.ts). Headless browsers must not write playtest.json (check the existing guard holds).

Prove, with numbers:
- A hulk held in the band lunges at ~1.5 s; a Still that stands still takes it, one that sidesteps during the
  crouch doesn't; only one hulk lunges at a time with 3+ in the band; a push breaks the crouch; the autos don't.
- A planted Still with sight on a sentinel sees it duck at ~1.5 s, hide, and peek-and-burst; unplanting ends the
  hide; the half-the-pack cap holds; it finds cover in a room level and an open field (depth 1 and 4).
- HP lost standing in the band vs a hulk for 20 s, switch off vs on; same for planted vs 2 sentinels.
- Crowned heavies, rams, Lobbers, mites, bosses unchanged. A real depth 1, 2, 4 and 5 level loads with no errors.
- Screenshots: a hulk mid-crouch, a hulk mid-lunge, a sentinel behind cover. Look at them: the tells must read on
  the body, nothing on the floor, nothing flat red or white.

Keep scripts and screenshots in the scratchpad, never the repo root. Match the code's style. **Do not commit or
push.** Hand back: files changed, check output, the numbers, screenshot paths, and every decision this brief
didn't make.
