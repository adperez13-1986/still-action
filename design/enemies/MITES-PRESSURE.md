# Build: mites as pressure bodies

28 Sep 2026. His call: "make mites pressure bodies too." Pressure is accepted (DESIGN.md Enemies,
design/CONTEXT.md): ordinary bodies show only their body (a short physical tell, then the hit), no ring or
line on the floor, and their hits stack; big telegraphs stay for heavies (an elite pack's crowned leader)
and bosses. Hulks and sentinels already work this way (`PRESSURE_HULK` in src/enemy.ts,
`PRESSURE_SENTINEL` in src/ranged.ts, `pressure` set in `combat.addPack`, `hurtPlayer(..., stack)`).

Repo: /Users/adrianperez/repos/personal/still-action. Read `src/swarm.ts` in full first (the Mite, the
Brood that is the pack's one mind, the ring, the bite cap across broods), then `combat.ts` where broods
tick and their bites resolve, and `src/enemy.ts` / `src/ranged.ts` for how pressure hulks and sentinels do it.

## What to build

- **An ordinary brood (no queen) under pressure:** keep the gathering (inner ring of biters around Still, outer
  ring circling wide, refills, demotion when flung, the cross-brood cap of inner biters `BROOD.innerMax`), but
  **drop the coordinated surge and its floor ring**. Each inner mite in contact nips on its own: a very short
  body tell (~120 ms: it rears or its ember flares; body only, nothing on the floor), then a small bite if Still
  is still within reach, then a short recover; each mite on its own clock (stagger them so four don't bite on
  one frame). Bite about 3 before the depth curve (the curve's `dmg` multiplier applies as for any body via
  `dmgMul`), hits stack (`stack` in `hurtPlayer`), and small-hit feedback is the existing "nick".
  Put the numbers in one `PRESSURE_MITE` table.
- **A brood with a queen (the elite) keeps today's surge and ring**: she is the heavy.
- The hand's and the eye's breaks can't break a pressure mite (as for pressure hulks: `breakable`).
- Set `pressure` on mites in `combat.addPack` alongside hulks and sentinels (mites in an elite brood stay as
  they are). The Assembler's and the Arbiter's summoned mites (boss adds): leave them as today.
- Keep the damage roughly where it is today for a brood that has you surrounded (today: one surge of up to
  4 biters x 3 every ~1.5 s cycle); state what you set and the measured damage per second, before and after.

## Verify

`npx tsc -b`, `npx tsx tools/leancheck.ts`, `npx tsx tools/statecheck.ts`, `npx vite build`. Headless with
playwright-core (in /private/tmp/claude-501/-Users-adrianperez-repos-personal/f83ea94e-55b1-4fd4-9f9f-fe95eb0ab639/scratchpad/node_modules;
Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, args
`['--use-gl=angle', '--enable-unsafe-swiftshader']`; dev server on http://localhost:5173, `?depth=N`; DEV hooks
`__arena`, `__pack`, `__spawn`, `__step`, `__stick`, `__combat`, `__runStats`; `pressure.mjs` and `m2.mjs` in the
scratchpad show the patterns, and a `__pack` with `kind: 'swarm'` members makes a brood). Prove: an ordinary brood
bites with no floor ring and staggered nips that stack; damage per second surrounded, before vs after; an elite
brood (queen) still surges with its ring; the cap of 4 inner biters across broods holds; boss adds unchanged; a real
depth 4 and 5 level loads with no errors. Screenshots of a brood biting (look at them: body tells visible, nothing
flat red or white).

Keep scripts and screenshots in the scratchpad, never the repo root. Match the code's style. **Do not commit or
push.** Hand back: files changed, check output, the numbers, screenshot paths, and every decision the brief
didn't make.
