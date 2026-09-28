# Build 1: the synergy trial (chilled + marked, shatter, swap at II)

28 Sep 2026. Spec: `design/synergy/PITCHES.md` (read it, and `2-verifier.md` for the checks). His calls:
"build the synergy trial with shatter". Mastery chill: **without the slow** (the recommended option; he
didn't pick). Slammed and hauled are NOT in this build.

Repo: /Users/adrianperez/repos/personal/still-action (vanilla three.js + TS + Vite). Read `HANDOVER.md`
"How to work on it" and `design/CONTEXT.md` (colour language: Still's effects cold, never flat red/white;
on screen the autos are "the close strike" and "the planted shot", never hand / eye).

## What to build

1. **`src/states.ts`** (no three.js import): `StateId = 'chilled' | 'marked'`; `STATE` table
   `{ mul: 2, consumed: true }` for both; `stateMul(status, payer): { mul, used }`: the largest live
   state the payer's `pays` lists wins, capped at 2, and only `used` is consumed. A state records who set
   it (`by: SlotName | 'hand' | 'eye'`); a state set from the payer's own slot pays nothing; states set by
   the autos (mastery) pay any slot.
2. **Chilled is a state, separate from the slow.** Today chill == `slowT` (`applySlow`) and the rime look
   follows it. Add a chill timer + `by` on `EnemyStatus` (src/parts.ts). Chill Vent and Frost Trail set
   the slow **and** the chill; Cold Strike / Cold Shot (src/mastery.ts, `masterHit` in src/combat.ts) set
   the **chill only** (no slow). The rime shows the chill. Bosses: never slowed by anything (guard
   `applySlow` with `isBoss`), but they take chill and mark for payers.
3. **Parts** (`src/abilities.ts`): add `sets?: StateId[]`, `pays?: StateId[]` to `AbilityDef` (temper's
   `tempered()` spreads them through). Setters: Chill Vent, Frost Trail (chilled); Signal Flare (marked;
   its own hit 4 -> 12, a plain hit). Payers: Scrap Cleaver, Cracked Lens (chilled); Patient Lens, Parry
   Clamp, Overrun (marked). Card lines: a payer adds one clause in one shape, e.g.
   "On a chilled enemy: lands twice." Setter and mastery lines name what they do in the same words
   (Signal Flare: marks; "parts that pay marks hit them twice"; Cold Strike: "Every close strike chills
   what it hits."; Marking Strike/Shot likewise).
4. **`hitPart(e, damage, pushed, payer)`** in src/combat.ts: every part hit goes through it (11 sites, plus
   `runOver`, part bolts via `spawnBolt` carrying the payer on the `Bolt`). The mark's x2 moves into
   `stateMul` and is paid **only by parts whose `pays` lists marked** (today any part pays it). The autos
   (close strike, cleave, planted shot, split shots, hazards) never pay.
5. **Shatter:** a paid hit that kills passes its excess damage (damage beyond the HP it had) to the nearest
   living, awake enemy within 3 u, as a plain hit (pays nothing, never chains). Cold shatter effect.
6. **Payers aim at their state:** for bolt, lob and arc casts, among targets the part reaches now, prefer one
   carrying a state it pays, after the existing pushed-threat rule and never over a nearer enemy in a windup.
7. **A swap lands at rank II.** In `takePart` (src/main.ts), replacing a filled slot: the new part is
   `tempered(def, 2)`, `run.ranks[slot] = 2`, and the old part is used up (not dropped). Floor card and
   compare screen say it: "take · Piston II" and "Scrap Cleaver III melts in". Pedestals go through
   `takePart` too. Update `meltLabel` / ranks accordingly (a II part can be melted to III as before).
8. **The push cue:** when a pair is worn (a payer, and a setter of its state in another slot or a mastery
   that sets it), the payer's button shows the state's small glyph on its top rim, dim; it **lights while a
   push would pay** (the state is live on an enemy the payer `reaches`). A one-time caption, like the break
   caption: "hold · pay it". Keep it small and cold; the cost pips stay on the bottom rim.
9. **The pay is loud:** when a state is paid, the state breaks with its own cold effect (chill: frost bursts
   outward; mark: the existing bracket slam) and one shared cold "paid" sound; on a body that dies, the kill
   burst is enough.
10. **Floor card**: "pairs with Chill Vent" when the incoming part completes a pair with what's worn (parts
    or masteries); "ends its pair with Scrap Cleaver" when it breaks one. One spare line, in that priority.
11. **Log** (per depth in `run.stats`, see `DepthStats` in main.ts): `states: { chilled: {set, paid, expired},
    marked: {...} }`, `stateBonus`, `paidBy` (by slot and form; hand/eye must stay 0), `pushedIntoState`,
    `shatter: { n, dmg }`, `maxMul`; per run `swaps: [{ slot, from, to, rankLost }]`.
12. **`tools/statecheck.ts`** (like tools/leancheck.ts, exit 1 on failure): every STATE mul <= 2; stateMul
    cases (two states -> the larger; own slot -> 1; mastery-set -> pays any slot; cap); `pays` only on parts
    that deal damage; no part sets and pays the same state; every paid state has a setter in another slot or
    a mastery; masteries never pay.

## How to verify (before handing back)

- `npx tsc -b`, `npx tsx tools/leancheck.ts`, `npx tsx tools/statecheck.ts`, `npx vite build`.
- Headless checks with playwright-core (already installed in the session scratchpad:
  /private/tmp/claude-501/-Users-adrianperez-repos-personal/f83ea94e-55b1-4fd4-9f9f-fe95eb0ab639/scratchpad/node_modules;
  launch Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` with args
  `['--use-gl=angle', '--enable-unsafe-swiftshader']`; the dev server is on http://localhost:5173, use
  `?depth=N`; DEV hooks on `window`: `__arena`, `__pack`, `__spawn`, `__step`, `__equip`, `__combat`,
  `__run`, `__hud`, `__loot`, `__parts`, `__boss`, `__runStats`; existing scripts in that scratchpad, e.g.
  `m2.mjs`, `temper.mjs`, `mastery.mjs`, show the patterns). Prove: Signal Flare -> Patient Lens pays x2 once;
  a non-payer doesn't consume a mark; Chill Vent -> Scrap Cleaver pays x2 and consumes the chill; Cold Strike
  chills without slowing; an own-slot state pays nothing; the autos pay nothing; shatter passes excess once;
  a swap lands at II with no drop; bosses take chill (no slow) and pay.
- Screenshots (new filenames each time) of: the floor card with "pairs with", the lit rim glyph, a paid
  chill's shatter. Look at them: no flat white or red, readable at phone size.
- Put scripts and screenshots in the scratchpad, never the repo root.

**Do not commit or push.** Hand back a summary: files changed, what each check printed, screenshot paths,
and anything you decided that the spec didn't say.
