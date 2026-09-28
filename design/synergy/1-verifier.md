# Synergy round 1: the verifier

## What the code already gives us

- **One place to pay a state exists.** Every part hit lands in `hitPart` (combat.ts ~1021), where
  the mark's x2 lives. Eleven call sites. The autos never reach it (hand 596, cleave
  615, `eyeHit` 1565, non-part bolts 790), and neither do hazards (2423), Signal Flare's own 4 (1664)
  or Clamp Toss's wall bonus (1109). So "the autos set, parts pay" is already how the code is shaped.
- **`EnemyStatus` is a per-enemy map** (`statusFor` creates it, `tickStatus` ticks it, `bury` deletes
  it, a new level clears it). Adding a state means one field, one tick branch and one `PartEvent`.
- **Chilled is `slowT`**, already drawn on every class by `e.rime`.
- **Slammed has no hook.** Each class's update calls `terrain.pushOut`, which fixes the overlap and
  tells nobody. The only wall-contact test today is Clamp Toss's `short`. Clumped has none either.

## The states in the status system

| State | `EnemyStatus` field | Set by (code) | Ends | Consumed on pay |
|---|---|---|---|---|
| marked | `markT` (exists) | `mark()`: Signal Flare, Marking Strike/Shot | timer | yes (as today) |
| chilled | `slowT`, `slowMul` (exist), + `chillBy` | `applySlow()`: Chill Vent, Frost Trail, Cold Strike/Shot | timer | no |
| slammed | new `slamT`, `slamBy`, `slamArmT` | new `slamCheck()` after the enemy update; Clamp Toss `short` | timer (~1.5 s) | yes |
| clumped | new `clumpT`, `clumpBy` | the pull branches (Backdraft nova, Hook arc) | timer | no |

Every state keeps **`by: SlotName | 'hand' | 'eye'`**, who set it. That field makes "a synergy needs
two parts" a rule the code enforces, not a hope.

**Slammed, concretely:** `hitPart` with a `def.shove` sets `slamArmT = 0.5`. After each enemy's
update, `slamCheck(e)`: if `slamArmT > 0`, knock speed > `STAGGER_SPEED`, and
`terrain.blocked(pos + knockDir * (radius + 0.15))`, set `slamT`, zero the knock. One `blocked()` per
sliding enemy per tick. The arm matters: the close strike shoves every 0.62 s, so without it a hulk in
a corner is slammed for ever by a free auto.

## The one multiplier function

New `src/states.ts`, no `three` import, so a tool can run it:

```ts
export type StateId = 'marked' | 'slammed' | 'chilled' | 'clumped'   // order breaks ties
export const STATE: Record<StateId, { mul: number; consumed: boolean }>  // every mul <= 2
export interface Payer { slot: SlotName; pays: readonly StateId[] }      // from the def
/** The one multiplier on a part hit: the largest live state this payer may use, capped at 2. */
export function stateMul(st: EnemyStatus | undefined, payer: Payer): { mul: number; used: StateId | null }
```

- **Marked pays for any part** (the card says "your next part"); the others only for a def whose
  `pays` lists them.
- **A state set from the payer's own slot pays nothing** (`by === payer.slot`): no part pays itself.
- Largest wins, the fixed order breaks ties, `Math.min(2, mul)`, and only `used` is consumed.
- `hitPart(e, damage, pushed)` becomes `hitPart(e, damage, payer, pushed)`. Every site has the def
  in reach except `runOver` (takes numbers) and part bolts (`spawnBolt` needs `payer` on the `Bolt`;
  Mirror Ward's reflections come through it and pay as torso).

**Temper is not a hit multiplier:** it is baked into `def.damage`. Say so in rule 3 ("per hit, beyond
the def's own numbers"), or it reads as banning temper. The ceiling is **x3.2 a white** (III x1.6 ×
x2): Patient Lens pushed at III into a mark is 102 in one hit. Balancer, look at that number.

## A check for each rule

New `tools/statecheck.ts` (same form as leancheck: prints a table, exits 1 on a failure).

| Rule | Static check | Log field (per depth, `run.stats`) |
|---|---|---|
| One multiplier, cap x2 | every `STATE.mul` ≤ 2; `stateMul` table cases (two states → the larger; three → still one; a mul of 2.5 → 2) | `stateBonus`: damage added by states |
| Never from what you wear | no `Mod` kind carries a `mul`/`mult` key (a whitelist of mod keys) | none |
| Autos never pay | every `.hit(` in combat.ts outside `hitPart` sits on a line tagged `// plain hit:` (a text scan; a new untagged call fails) | `paidBy.hand` / `paidBy.eye` must stay 0 |
| Two parts per synergy | for each state: a setter and a payer exist in different slots; no def both sets and pays one state | `paid[state].crossSlot` |
| No slot without setter and payer | per slot: ≥1 setter and ≥1 payer with `drops !== 'boss'` | none |
| A payer hits | `pays` only on a def that deals damage (`damage`, `blastDamage`, or a slam, overrun or reflect mod) | none |
| Nothing free does both | masteries have `sets`, never `pays` | see flag 1 |
| Card says it | a def with `sets`/`pays` has the state's word in `line` | none |
| Changes when you press | none possible | `setToPayMs`: median gap between a state going on and a part paying it |
| Readability | none | `states[s] = { set, paid, expired }`; pass line: paid/set ≥ 0.4 where a pair is worn |
| Melt vs swap | rank stays within 1..3 after any swap rule | `worn` snapshot at each depth start (id + rank), `swaps: {slot, from, to, rankLost}` |

Pair-vs-rank pass line: with a pair worn, `stateBonus / partDmg` 0.3 to 0.6, the range of rank II to
III. Needs `partDmg` (asked for in the rules round).

**Parts that cannot be payers** (no hit): Ward, Skitter, Spring Heels, Frost Trail, Borrowed Time.
Overrun pays only pushed. Legs has four non-hitters of eight, so its payer must be Kickstart, Skid
Plates, Overrun or Plumb Line.

## Melt vs swap in code

A swap clears `run.ranks[slot]` (main.ts 1279, `swapIn` 1918). "Keep half" is one line there:
`Math.ceil(rank / 2)` gives III → II, II → I. Mastery fires on a melt into a III, so a carried II can
reach III again and teach another; `MASTERY_MAX` caps it, and `mastered` already logs it.

## Leanings

Checkable only as data: `LEAN_STATES: Record<Lean, StateId[]>`, and leancheck asserts each lean has a
setter and a payer of its states outside bosses. As flavour only, leanings stay a mastery switch.

## Three steps, smallest first

**1. The function and chilled (the plumbing, mark unchanged).** `states.ts`, `hitPart` taking a payer,
`by` fields, the `pays`/`sets` fields on `AbilityDef`, and one chilled payer in a slot other than torso
and legs. Log `states`, `stateBonus`, `paidBy`. Statecheck. Touches: `parts.ts` (`EnemyStatus`,
`PartEvent` gains `{kind:'state'}`), `combat.ts` (11 `hitPart` sites, `runOver`, `Bolt`, `spawnBolt`,
`applySlow`), `abilities.ts`, `main.ts` (stats, the consumed sound that marks already use),
`tools/statecheck.ts`. **Risk:** the `hitPart` signature, where a wrong payer on one site pays
silently. Regression line: the Signal Flare → Cleaver pair still does exactly x2.

**2. Slammed.** `slamArmT`, `slamCheck` in the enemy loop, Clamp Toss's `short` sets it, Piston sets it,
and a payer in another slot. Touches: `combat.ts` only, plus a tint (`statusTint` on 7 classes, or one
rim in `partfx.ts`). **Risks:** a Piston down a 2 u lane always slams (fine, or cap it); pack spacing (~2800) moves bodies
without the arm, so it can't slam; anchored bosses and rushing rams (`knockMul` 0) never slam: write
that into the rule.

**3. The swap rule and the pair on the card.** The carried rank if chosen (`main.ts`), and a "sets /
pays" glyph on the pickup card and compare screen against what's worn (`cards.ts`, `partsview.ts`).
**Risk:** presentation only, but it makes the choice visible, so judge the tension after this step.

## Flags

1. **Cold Strike and Cold Shot already break rule 7:** a free auto that damages and slows does both,
   and a payable chill makes it worse. Fix in data: the mastery sets chilled without the slow
   (`setChill(e, s, slow = false)`). Adrian's call.
2. **Bosses: chill is inconsistent.** `masterHit` never slows a boss, but Chill Vent's nova and Frost
   Trail's zone do (no `isBoss` guard). Pick one before bosses can be paid against.
3. **Clumped double-dips:** an area payer already hits more bodies there. No multiplier for it; its
   payoff is the extra bodies, or cut it.
4. **Area hits pay per body** (a nova, landThrow's splash). Correct, but log `stateBonus` per body
   hit, or a nova into a chilled pack reads as a pair worth four ranks.
