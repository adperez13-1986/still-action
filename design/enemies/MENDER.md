# Build: the mender

28 Sep 2026. His call: "queue the mender after synergy". Why: his observation that the enemies are
"shallow and feel the same"; nothing changes what a packmate does. Source: `design/variety/PITCHES.md`
item 9 ("It mends one packmate through a cable drawn on the floor; walk through the cable to cut it,
or kill the mender first"). The translator's revive-with-a-windup version is NOT this: under pressure
(DESIGN.md Enemies) ordinary bodies have no big windups, and cutting a cable is a stick answer.

Repo: /Users/adrianperez/repos/personal/still-action. Read `HANDOVER.md` ("How to work on it", the code
map), `design/CONTEXT.md` (colour language; on screen the autos are "the close strike" / "the planted
shot"), `src/hide.ts` (every enemy body is its own metal; ember is reserved for threats: cores, eyes,
seams, tells), `src/thief.ts` (a body that doesn't attack, a good template), `src/enemy.ts`, `src/combat.ts`
`addPack` / `make`, `src/dungeon.ts` pack generation, `src/curve.ts`.

## The body

- **The mender**: a small, thin machine on stilt legs that keeps behind its pack: it holds ~7-9 u from
  Still with a packmate between them where it can, and backs off when he closes. It never attacks.
  HP about a sentinel's (20 before the depth curve; addPack's curve applies). Its own metal in `hide.ts`
  (not one already used: say which you chose); a small ember core, since it is a threat by proxy.
- **The cable**: while awake it links to one packmate (the most hurt one, a heavy first if hurt). The cable
  is drawn on the floor from the mender to the patient: a dark line with a faint ember pulse running toward
  the patient (not a bright threat colour: it can't hurt Still). The patient heals ~6 HP/s up to its max
  (a guess: about a third of the close strike's damage a second; `MENDER` constants in one table).
- **Cutting it**: Still's body crossing the cable (his circle against the segment) cuts it: the cable snaps
  with a short cold-and-ember break effect and a sound, the mender reels (1.5 s, does nothing), and it can't
  re-link for 4 s. Killing the mender ends the cable. When the patient dies, it links the next after 1 s.
  A part or auto hit on the cable does nothing: only walking through it. Walls: a cable can't pass through
  a wall (if the line is blocked it doesn't link, or unlinks).
- **Pressure**: it's an ordinary body (no telegraph). It is never an elite leader (skip it when crowning).

## Where it appears

A new archetype (e.g. `'mender'`) in the level generator: in main packs of 3+ bodies, never in side rooms
or lessons, from depth 2. Chance per such pack about d2 0.3, d4 0.35, d5 0.4; at most 2 a level; never at
depth 1 (the first depth teaches the base bodies) or boss depths. Kill weight and treasure class like the
sentinel's. The depth curve's HP applies through addPack as for any body.

## Log (per depth in `run.stats`)

`menders: { met, cut, killed, healed }` (healed = HP its cables restored).

## Verify

`npx tsc -b`, `npx tsx tools/leancheck.ts`, `npx tsx tools/statecheck.ts`, `npx vite build`. Headless with
playwright-core (in the session scratchpad
/private/tmp/claude-501/-Users-adrianperez-repos-personal/f83ea94e-55b1-4fd4-9f9f-fe95eb0ab639/scratchpad/node_modules;
Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, args
`['--use-gl=angle', '--enable-unsafe-swiftshader']`; dev server on http://localhost:5173, `?depth=N`; DEV hooks
`__arena`, `__pack`, `__spawn`, `__step`, `__stick`, `__combat`, `__run`, `__runStats`; existing scripts in the
scratchpad such as `m2.mjs`, `pressure.mjs` show the patterns). Prove: the mender links the most hurt packmate
and heals it; walking through the cable cuts it, reels the mender and blocks a re-link for 4 s; a hit on the
cable does nothing; killing the mender ends it; it relinks after its patient dies; it never attacks; it appears
at depths 2/4/5 and never at 1; logs fill. Screenshots (new filenames each time) of a linked pack and a cut:
look at them yourself; the cable must read on a 6-inch phone and nothing may be flat red or white.

Keep scripts and screenshots in the scratchpad, never the repo root. Match the surrounding code's style (short
plain comments that say why). **Do not commit or push.** Hand back: files changed, check output, screenshot
paths, and every decision the brief didn't make.
