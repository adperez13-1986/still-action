# Lean round 1: verifier

Read against the code on 1 Oct and his export `still-playtest-2026-10-01.json` (runs 9-17 unless stated).

## Brief corrections

1. **"Pushed bolt always full damage" (`abilities.ts:45`)** is Patient Lens's charge only (`combat.ts:1867`), not bolts in general.
2. **The break rule barely fires:** 3 breaks in 99 pushes. `breakable()` (`combat.ts:1231`) refuses a pressure body that isn't crouching, and ordinary packs are pressure. So **in practice a push adds firing off cooldown and the louder presentation, little else.**
3. **The hold isn't a hold for his thumb.** His ready presses last 214 ms (median), and 729 of 1045 last 180 ms or more. On a cooling button his normal press already pushes. Dead taps (32 across runs 9-21) are all under 190 ms.
4. **The gesture is in `src/hud.ts`** (`PUSH_HOLD_MS`, `BUFFER_MS`, `deadTap`, `fireSlot`), not on the brief's list. `playlog.ts` only stores; the fields live in `main.ts` (`DepthStats`, `TapLog`).
5. Stale comment: `combat.ts:468` says "off by default". The break rule has been on permanently since 26 Sep (`main.ts:2179`).

The rest checks out, including the 58% (57.4%).

## Ask 1: tougher and stronger. Partly agree.

Kill time is `HP·k / (A + P·m)`. With k = m = 1.5 and today's P/A of 1.38, the part share goes 58% to 67%, and kill time rises 16% for him and about 50% for a one-white-part d1. The share moves only if m > k on the bodies parts should own. **Exempt d1-2**, or the never-melt floor pays again (the bank's d1: 40% empty beats).

- **HP:** a separate `leanHp` beside `curve.hp` in `addPack` (`combat.ts:2807`) and `crown` (`:2991`). For bosses, scale the def in `bossFor` (`areas.ts:500`), never `e.hp`: the phase lines read `def.hp` (`boss.ts:392`, `arbiter.ts:444`). **Not in the curve rows:** `k9.mjs` pins CURVE9, and the trains scale with `curve.hp` (`line.ts:319`). Packs are made at level entry, so HP changes from the next level.
- **Damage:** one multiplier in `hitPart` (`combat.ts:1146`). It misses only Signal Flare's own hit (`:1902`) and the toss wall (`:1315`).
- Editing the numbers in `abilities.ts` instead re-pins K-W3a, K-W3e, K-A7 (`leftMs <= 2600`) and K-90F F6/F7/F10/F14. A multiplier behind the switch re-pins nothing.

## Ask 3: every cast a push

| | touches | breaks | verdict |
|---|---|---|---|
| **V1** | `main.ts` onFire, `hud.ts` | Plumb Line never snaps (`combat.ts:2034`: pushed always plants). Patient Lens is always full (32 every 1.5 s). Coil and Borrowed Time pay on top. **The Arbiter's heat** (`main.ts:679`) is push-only, so a hot button goes dead for 4 s. At +2 a cast (about 23 presses at d1) he is Stopped inside d1. Any rescale needs fractional strain, which breaks the save (`main.ts:2764` rounds it), the pips and the HUD brink (`ready ? 0 : 2`) | **Disagree.** Strain becomes a press meter that taxes the pressing he wants more of. "A choice" becomes "a timer" |
| **V2** | `hud.ts` pointerdown | K-A7's 'dead' tap and the "hold" captions (his words) | **Partly.** Cheap, but by correction 3 it barely changes his thumb. Risk: 3 of 8 dead taps with a logged `leftMs` were within 250 ms of ready, so they'd pay 2 strain to save 200 ms. **Widen `BUFFER_MS` to about 300 ms** |
| **V3** | both | V1's, plus a higher price | Disagree |
| **V4 (mine)** ready casts carry the push's *effects* free; a cooling tap pushes for +2 (V2 with the 300 ms buffer) | `main.ts` `cast()` only: `ctx.pushed = pushed \|\| (leanOn && !PUSH_SHAPED)`, where `PUSH_SHAPED` is charge, overrun and anchor. The real `pushed` drives strain, `pushes`, `pushedIntoState` (`main.ts:1300-1325`), the ember sparks and the vibration. **No changes in `combat.ts`** | Parry loses its free-break niche against heavies but keeps the pressure-tell catch. Elite leaders and tracking rams break to any ready cast in reach: the telegraph asks "is something ready", not "pay" | **Agree.** "Full effect, always", and strain stays the price of time, the only thing a push really buys (correction 2) |

On "troublesome": the log points at the decision and the reading (a button that looks off, a price to weigh), not the 180 ms. V4 takes away the reason to push for the effects. What is left to push for is time, which is a clean choice.

## Ask 2: drama. Agree, and half of it is written.

`cast()` (`main.ts:3711-3717`) already has the pushed presentation: pose x1.35 (`still.ts:685`), lower pitch and x1.3 gain plus the grind (`audio.ts:1186`), scale 1.16, shake 0.34, hitstop 60 ms. V4 gives it to every ready cast. Before it ships:
- **Shake only on contact** (`castHits > 0`), scaled by bodies hit. Today a whiff shakes, and a shake every few seconds hides the tells.
- **No anticipation that delays the hit:** ready casts fire on the press (settled). Move bolt and lob hitstop from the cast to impact.

Keep one recipe per slot in `castFx`. `partFx.beam` and `yank` are the reusable parts. Check frame rate with `perf.ts` in a d5 crowd.

## The trial

One pause switch, **"lean"** (placeholder), built like follow-through (`main.ts:2280`): `still-action.lean`, default off, DEV `__lean(on)`. The push and the look apply at once; HP and damage from the next level; `leanMixed` on the depth it was flipped. Bundled on purpose: the bank was too subtle to feel.

What he should notice: do the parts kill; does he still want a push; do the heavies' telegraphs still ask anything.

Log: `lean`, `leanMixed`, `fullCasts`, `breaks` split `{ready, pushed}`, `partDmg` against `autoDmgReal`, `kills.part`, and taps with `result: 'push'` and `ms < 180`.

Checks, `tools/checks/lean.mjs`, each tested once against a broken rule:
- **K-L1, off is today:** `fights.mjs compare`, `autos`, `stageb` (bar K-W3d) and `k9` pass unchanged. Pin `__lean(false)` in `fight()` and the suite setups, as `__parryCatch` is. Add `--lean-on` as INFO.
- **K-L2:** a *ready* Cleaver into a crowned leader's windup breaks it (10 lands as 15); strain and `pushes` unchanged.
- **K-L3:** a ready cast aims at the soonest breakable windup.
- **K-L4:** the exemptions: a part-charged Patient Lens is partial; Plumb Line snaps; Overrun's ready press is the step.
- **K-L5, real pointer:** a 60 ms cooling tap gives 'push', +2; a tap within 300 ms of ready gives a queued 'cast' with 0 strain; a hot button pushes on a tap.
- **K-L6:** a `__pack` hulk at d3 has 30 x curve x `leanHp`; a part hit is x m; a hand strike is still 10; a train is unchanged; the Assembler overloads at 55% of its scaled HP.
- **K-L7:** ember sparks and the `[14,26,14]` vibration only on a real push; no shake on a whiff.
