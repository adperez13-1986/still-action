# Lean round 2: verifier

## Changed

- **One switch becomes two.** Only the push touches strain. If he Stops, he has to know which switch did it.
- **Queue near ready: 400 ms** (the balancer's), not my 300. 4 of 8 dead taps came within 0.6 s of ready.

## (a) Strain, and where to cut

**I disagree with the balancer's ×1.5.** His log supports ×1.25: the hold already fires on his normal press, so tap-push only wins back the 30 dead taps out of 148 attempts. Part B re-run on a scratch copy, heavier enemies, median player:

| V4 | Stopped | Made it |
|---|---|---|
| ×1.25 | 17% | 65 |
| ×1.25, quiet −3 | 12% | 69 |
| ×1.5 on crawl pushes, bosses ×1 | 17% | 65 |
| ×1.5 everywhere | 29% | 55 |

That's 17-29%, against 7% today and a CURVE9 median Made it of 74.

**First run: strain unchanged.** One run can't measure 17%. Keep quiet −3 ready as a constant. Log `tapPushes`, `queued` and strain on entering each boss. `strainIn`/`strainOut` per depth already exist (`main.ts:1547`).

**I disagree with Claude's split.** I'd cut along strain:

- **"weight"**: everything a ready cast does. The timing fixes, the Ask 1 numbers, and V4's free half (`ctx.pushed` on ready casts, except Patient Lens, Overrun, Lure and Plumb Line). It costs no strain. Pushes broke only 4 windups, so taking that reason to push away moves little.
- **"tap push"**: the gesture only (`hud.ts` `PUSH_HOLD_MS`, `BUFFER_MS:31`). It's the only switch that can move Stopped.

Skip the translator's neighbour guard and log the gap to the last neighbour press instead. Keep a 250 ms same-button guard.

## (b) Timing

- **Starts cocked:** in `still.ts` `attack()` (`:261`), start `a.t` at 0.3·dur, so `wind` (`:687`) is already past the draw-back. Presentation only.
- **Freeze on contact:** gate `main.ts:3714-3716` on `castHits > 0`, at 50 ms + 12 ms per extra body, capped at 100. A cast's own hits land inside `useAbility`, so the count is ready by line 3716. Bolts already freeze when they land, through `onHit` (`main.ts:260`).
- **Kills:** `onFelled` fires just before `onKill` (`combat.ts:1521`) and says `'part'` or `'auto'`. Stash it, then give a part kill 90 ms and an auto kill 35 ms (`main.ts:338`).
- **Missed by all:** every eye lance hit also freezes 45 ms (`eyeHit` `combat.ts:1779` → `onHit`). Quieting the autos needs a `part` argument on `onHit`, passed from `hitPart:1148`.

**K-L8, "no freeze on a miss".** Headless `__step` never runs hitstop down, so add a DEV `__fx()` that reads and zeroes `{ hitstop, shake }`. Read it right after `__fire`, with no step in between, so no auto can fire:

1. A Cleaver with the hulk 6 u behind Still: hitstop 0, shake unchanged.
2. One hulk in the arc: at least 0.05. Three hulks: at least 0.074.
3. A Lens at a hulk 8 u away: 0 on the press, then at least 0.045 on the step it lands.
4. An auto kill: at most 0.035. A part kill: at least 0.09.

Test it once against the old line 3716, where case 1 must fail. With "weight" off, K-L1 must still match today.

## (c) Bigger packs

It isn't `addPack`. Pack size is the room budget at `dungeon.ts:1616` (`curve.budget`, `bigBonus`), and `k9.mjs:111` pins those rows, so it would need its own offset.

- **Seeds:** more bodies means more `fill()` and placement draws, so the rooms after it change. `fights.mjs compare` and the dungeon checks would have to pin it off.
- **What it adds:** `fill()` tops up with hulks, the bodies the autos already handle. At d1-2 that's +33-50% bodies.
- **Not modelled:** the damage the extra bodies deal, and the extra scrap from each kill's `maybeDrop` (`main.ts:337`).
- **Frame rate:** there's no instancing, so draw calls grow per body. Measure with `perf.ts` in a d5 big room on the F8 Pro.

Not this trial. Pack HP ×1.25 (beside `curve.hp`, `combat.ts:2807`) costs none of that.
