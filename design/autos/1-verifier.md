# Autos, round 1: verifier (30 Sep)

## 1. Verdict: partly agree

He is right that something is passive, wrong about what. His log says he is not idle: 2,935 presses in 38 runs,
2,529 casts on a ready button (86%), 326 pushes, 62 dead taps (`playtest.json`). What is passive is that **the presses
don't decide the kills**: a body he never chose dies to a beat he never pressed. B and C fix a problem the log doesn't
show (too few presses); the one it shows is who gets the credit.

A caution on the 67%: `autoDmg` in `main.ts` is nominal. `onHand` adds `HAND.damage` (10) per strike even on a boss,
where `autoOn` halves it to 5, and the Wide Strike's cleave and the Splitting Shot's splits are never counted. It
overstates boss depths and understates mastery runs. Fix the logging before a trial is judged on it (section 4).

## 2. What "active" means here

In Still, active means **the kill follows a choice he made with the right thumb**: which part, when, and whether to
push it for strain. The moment that matters is "do I push the Cleaver into this hulk's cock?", and a free beat that
kills the hulk first empties it. On a 6-inch phone, more buttons or aiming only make it busier; the right thumb is
already busy on four 60 px buttons. Active should mean the four presses carry the fight and the autos finish what
they started.

## 3. Proposal: D, the claimed auto ("the autos follow the parts")

A body that a part hit in the last `CLAIM_S` (3 s) is claimed. The close strike and the planted shot only strike
claimed bodies. Nothing else changes: same beat, same forms, same brace, same breaks, same masteries. Parts are
still auto-targeted, so claiming costs no aiming. An arc or a nova claims a whole crowd. A lens claims the back line.

It keeps autos-set-states / parts-pay, mastery as temper's III payoff, and the brace, and still changes who kills.
One settled line moves, "never dead time": a fight is dead until the first part lands, at most one cooldown (Cleaver
2.6 s, lens 4.2 s). He opens every fight with a cast anyway.

What each option touches:

| option | code | breaks | settled cost |
|---|---|---|---|
| A retune | `HAND.damage`, `EYE.damage` | K-90F F1-F9 differ; curve re-model | none; but a weaker beat alone still kills unchosen bodies |
| B none | `combat.autoAttack` exists (F10-F14 already run it off) | K-W3d, K-T5/T13, K-E16, K-N5/N6 lose their premise | never dead time; the 6 masteries become dead picks, so temper's III has no payoff; the brace stays (`inStance` ignores `autoAttack`), a stance with no shot; pressure crowds and CURVE9 lose their damage floor; Parry's dead-slot problem gets worse |
| C 5th button | `hud.ts` arc layout, input routing, a held gate on `autoTimer`; `screens.mjs` layout | as B plus screens | the right thumb; "one part = one ability" gets a button that is no part |
| D claim | `EnemyStatus.claimT`, set in `hitPart`, ticked with states; a filter in `handTarget`, `eyePick` (auto path only, not `eyeCast`), `nearest` fallback; the hand ring only on a claimed body | K-W3d shifts (fewer hand breaks); checks with autos on need the switch pinned | never dead time, bounded by one cooldown |
| E aim | `handTarget` / `eyePick` read heading | nothing in K-90F: every scenario holds `__stick(0,0)`, so it is invisible there | the planted shot rests the stick, so its heading is only the last facing: E can't reach the eye |

Implementation notes for D:
- `claimT` is not a `StateId`. Don't add it to `STATE_IDS`: `stateMul`, `pairWith` and the button-rim glyphs would
  read it as payable, and `statecheck.ts` would ask for a setter.
- Set it in `hitPart` only (the one path for parts' damage). An auto's hit never claims, or it would feed itself.
- An unclaimed hulk's windup no longer breaks to the hand. That is the change working: breaks go back to the parts.
- Bosses: a part hit claims for 3 s; `BOSS_AUTO_MUL` stays; `trigger` openings fire only on claimed bosses.
- The tell: a thin cold rim at a claimed body's base (Still's colour, not an enemy tell).

## 4. The smallest phone trial

**Switch:** pause "claimed autos", following `parry catch` exactly (`main.ts` 2215-2250): kept per device in
`still-action.claim`, applied at each level like `applyParryCatch`, **default off**. Off is today's behaviour
exactly. Code: one `combat.autoClaim` boolean read in the auto block at `combat.ts` 656-703 and in `eyePick`'s auto
call at 652.

**What he should notice in one run (to depth 3):** walking into a hulk does nothing until the Cleaver lands; then
the close strike works that body. Ignored bodies stay whole. The question: did the parts feel like the killing?

**Log fields** (per depth, in `DepthStats`):
- `autoClaim: boolean`
- `autoDmgReal: { hand, eye }` from `autoOn`'s return, cleave and split included (keep the nominal `autoDmg` so old
  runs still compare)
- `kills: { part, auto }`, whichever landed the killing blow
- `idleS`: fight seconds with an awake body in hand reach and nothing to strike. This is the dead-time cost of D.

Pass lines for the trial: auto share of real damage 35-45% (was 67% nominal); auto kills under half; `idleS`
under 1.5 s a fight; `hpLost` a depth within ~20% of his depth-1-3 baseline.

**Checks:**
- `fights.mjs`: pin `C.autoClaim = false` in `fight()` next to `C.counters = false`, as `__parryCatch` is pinned.
  Then `compare` must PASS unchanged, which proves off = today.
- Add `--claim-on` as an INFO mode like `--parry-on`. Expected: F1-F9 differ and **F10-F14 equal** (autos off
  there). That equality is the proof the switch only touches the autos. If F10-F14 differ, the claim has leaked into
  part paths.
- Pin `autoClaim = false` in the setups of K-W3c/d, K-T5/T13, K-E13/14, K-E16, K-N5/N6. Otherwise a phone's
  localStorage default leaks into CI the way parry catch would have.
- `statecheck.ts` and `leancheck.ts`: unchanged, and they must still pass. That proves claim stayed out of states.
- Balancer sims TTK / HP lost at d2/d5/d8 with claim on before he plays; `CURVE9` is not retuned during the trial.

## Where I'd push back on the owner

"Auto attack is for Vampire Survivors" is half true. The **planted shot** is Archero's rule, and he's right to
suspect it. The **close strike** is not. It is a positional reward and it already stops when he retreats. If claim
fails the trial, the next cut is the eye's damage, not the hand's.
