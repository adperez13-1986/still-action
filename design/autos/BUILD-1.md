# Build 1: the bank ("follow-through") trial

30 Sep 2026. His pick after the round (`PITCHES.md`): **the bank first**, as a pause switch, off by default.
Off must be today's game exactly. Words on screen ("follow-through") are PLACEHOLDER, his to write.

## The rule

- `combat.followThrough: boolean` (off = today). `combat.bank: number`, starts 0.
  `export const BANK = { perPress: 3, cap: 6 }` in `src/combat.ts`, next to HAND / EYE.
- **A press adds `perPress`, capped at `cap`**: any part cast that actually fired, ready or pushed, landed or not
  (a whiff must not lock him out). A buffered press counts when it fires. Refused presses and dead taps add 0.
  Find the one place every part cast goes through (the cast path in combat.ts, or main's `fire`) and add it there once.
- **Each auto beat spends 1.** In the auto block (`combat.ts` ~656-703), when the close strike or the planted
  shot / far shot *would* fire this beat: with the switch on and `bank >= 1`, spend 1 and fire exactly as today;
  with `bank < 1`, don't fire, reset `autoTimer = AUTO_INTERVAL` (the beat passes, the cadence holds), and count
  an **empty beat**. The hand-cleave's second body and the eye's splits ride on the same beat: one beat, one spend.
  A beat with no target spends nothing and isn't an empty beat.
- **The bank empties** when a level starts and when a fight ends (the quiet, `quiet()` in main.ts). Each fight
  starts empty: the fight opens on a press.
- Everything else unchanged: HAND / EYE numbers, breaks, shove, brace, masteries, riders, `BOSS_AUTO_MUL`.

## The read on screen

The translator: nobody reads a 0-6 count mid-crowd. So no number. **With the switch on and the bank empty, Still's
core dims** (its cold light down to roughly half, eased over ~150 ms; back up on the press). It should read as
Still waiting for him, not as a bug. Cold palette only. Look at it at game camera in a screenshot, both states,
and say honestly whether the difference reads; if it doesn't, make it stronger rather than adding UI.

## The switch

Built like "parry catch" (`main.ts` ~2213-2250): `pause.setSwitch('follow-through', ...)`, localStorage key
`still-action.followThrough`, **default off** (`=== '1'`), applied to Combat at each level entry (as
`applyParryCatch` is), and a DEV hook `__followThrough(on)` for checks.

## Log fields (always logged, switch on or off), per depth in `DepthStats`

- `followThrough: boolean`
- `autoDmgReal: { hand, eye }`: the damage the autos actually dealt (after `autoOn`'s boss half, with the
  hand-cleave and the eye's splits). Keep the nominal `autoDmg` as it is, so old runs still compare.
- `kills: { part, auto, other }`: which dealt the killing blow (other: hazards, walls, trains...).
- `fightS`: seconds with an awake body within 8 u of Still.
- `bankBeats` (beats that spent), `emptyBeats` (beats that would have fired but the bank was empty).
- Per tap in `run.taps`: `leftMs`, the cooldown left on that button when the press went down (0 if ready).

## Checks: new `tools/checks/autos.mjs` (K-A*), headless, localhost vite via lib.mjs

Model the setups on `tools/checks/fights.mjs` and `home.mjs`.
- **K-A1 off = today:** `node tools/checks/fights.mjs` compare still PASSES unchanged (run it; no new baseline).
- **K-A2 no press, no autos:** switch on, stand in reach of one hulk, cast nothing for 5 s: auto damage 0,
  `emptyBeats` > 0.
- **K-A3 one press, three beats:** switch on, one cast then nothing: exactly 3 auto hits, then none.
- **K-A4 cap:** three casts within one beat: bank is 6, not 9.
- **K-A5 a push adds 3** (a pushed cast on a cooling button); a dead tap and a refused press add 0.
- **K-A6 the quiet empties it:** bank > 0 at a fight's last kill, 0 after the quiet.
- **K-A7 the log:** every new field present; on a boss, `autoDmgReal.hand` is half the nominal `autoDmg.hand`
  for the same strikes; `kills` sums to the depth's kills.
- **K-A8 the core read:** with the switch on, the core's light intensity (or emissive) differs between bank 0 and
  bank > 0; with it off, it never changes from today.

## Done when

tsc and `vite build` clean; K-A1..8 PASS, each negative-tested once (break the rule, see it fail, restore);
these still pass unchanged: `fights` (compare), `baseline`, `home`, `screens`, `k9`, `area3`, `stagec`, `stageb`
(except its known K-W3d). Report every file touched, every check result verbatim, and the two core screenshots'
paths. **Do not commit.** Do not change HAND / EYE / cooldown numbers.

## As built (30 Sep, reviewed)

- Core dim 0.85, not half: half didn't read at game camera (engineer's screenshots). Even at 0.85 it's subtle
  in the full frame (the lens outshines it); the lens isn't dimmed because the eye going out already means stopping.
- Review change: the dim shows **only in a fight** (an awake body within 8 u). Between fights the quiet empties
  the bank, and a dim core down every corridor would read as Still switched off. Outside the crawl it's always lit.
  K-A9 checks both (negative-tested).
- K-A1 is `fights.mjs compare` (PASS). All suites as in "Done when"; stageb only K-W3d, as before.
- 30 Sep, his ask: the switch applies at once (bank empty), not from the next depth; that depth logs
  `followThroughMixed: true`, to leave out when judging. K-A10 (negative-tested).
