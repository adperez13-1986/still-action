# Round 1: the verifier (feasibility, scope, checks, risks)

28 Sep. Read against `main` (ee6df5f) and the uncommitted `pedestals` worktree. Log numbers: the 10 runs
in `playtest.json` with both on (a run: 108 strikes, 16.4 hand breaks, 63 eye shots, 2.8 braced, 1.0 eye cast).

## 1. What the code gives us, and what it doesn't

- **Close has an enemy-caused event; marksman doesn't.** `onHand(e, broke)` (combat.ts L575, main.ts
  L491) says whether a strike broke a windup: a close trigger is one listener. `onEye('shot')` fires when
  the shot leaves, not when it lands. A marksman trigger needs an `eye: true` flag on the lance bolt
  (`lance()`, L1506) and a check on hit in `boltStep`: ~15 lines of new code, not a hook.
- **Rare triggers are paper**: braced blows (2.8 a run), eye casts (1.0), leader hits. Qualify at >= 8 a run.
- **Cooldowns live in the HUD** (`b.readyAt`, hud.ts L530). "Cut N s off this button" is a new
  `hud.cut(slot, ms)` (~10 lines). It changes a behaviour, not another part's number (rule 3), no HP (rule 7).
- **The pedestal seam exists.** `rollPicks` (pedestals worktree, drops.ts): "A leaning match (the next
  step) would choose a pedestal's slot here, before its roll." ~25 lines, plus `--lean` in dropsim.
- **A part is one ability.** A payoff that's a second ability breaks that; a **rider on the part's own
  button** doesn't, and touches neither `Mod`, the twelve shapes nor the save.

## 2. The tension: tags vs enemy-triggered payoffs

Both hold if **tags carry no power** and **payoffs live on single parts**. The tag steers a pedestal and
shows on the card; it switches nothing on. Four close parts and no payoff part give exactly zero; one
payoff part pays in a mixed loadout too (rule 8). Committing pays only because the other close parts make
the trigger happen more (more hand time, more breaks), never by count. **One tag per part, never two**:
two-tag parts caused the 81% accidental match and make the pedestal match ambiguous.

## 3. Data shape (`abilities.ts` only; no save change, no new shape)

```ts
export type Leaning = 'close' | 'marksman'
/** Enemy-caused only. INV: never a count of worn parts, never a Still-caused break (a Parry, a push). */
export type Trigger = 'handBreak' | 'eyeBreak'
export interface Rider { on: Trigger; cutMs?: number; charge?: true; icdMs: number; line: string }
interface AbilityDef { /* ... */ lean?: Leaning; rider?: Rider }   // one lean at most; none = neutral
```
`tools/leancheck.ts` fails if a part has two leans, a slot lacks a `drops: 'any'` part for a lean (exit
pedestals roll the 'kill' gate), or a rider names another trigger or gives HP or damage.

## 4. The kit against the gates (draft tags; the balancer owns the table)

| slot | close | marksman | neutral |
|---|---|---|---|
| head | Overclocked Coil (gold, **rare**) | Focusing, Cracked, Patient, Ricochet, Through-Line | Flare, Signal Flare |
| torso | Backdraft, Brace | Pressure Vent, Chill Vent, Mirror Ward, Lure | Ward |
| arms | Scrap Cleaver, Parry Clamp, Frayed Cleaver, Rusted Hook, Anvil | Piston, Clamp Toss | |
| legs | Kickstart, Overrun | Frost Trail, Spring Heels, Plumb Line | Skitter, Skid Plates, Borrowed Time |

- **The gate finds one dead slot: close head has zero `any` parts**, so close never sees a head at an
  exit. Cheapest fix: retune Flare to close (range 11 -> 6, travelMs 800 -> 450, "Lobs a burst onto the
  enemy you're fighting, over its packmates"), a starter white. A new part only if Flare loses itself.
- Marksman arms are **peel**: Piston and Clamp Toss send the one that reached you back out, which costs a
  close build its strikes (rule 4's opinion). No rework.
- Both leanings exist in the starter twelve (close 5 + Flare, marksman 4), so a new save can steer.

## 5. Making marksman real: the eye breaks what shoots

Mirror the hand's pass-2 fix: a planted eye shot landing on a **ranged windup** breaks it (the hand's own
`breakable(e) && e.interrupt(false)`, L568). The sentinel's 760 ms windup is longer than the 620 ms beat,
so a planted Still gets a shot into every lock (flight from 9 u is 0.35 s, so some land late). It's also
the marksman trigger. No new eye numbers; if it isn't enough, the one dial is the eye's 5 damage.
Headless: **one sentinel at 9 u, planted, no parts, 20 s: <= 1 shot lands** (measure today first).

## 6. Payoffs: four riders on existing `any` parts, two a leaning

| part | trigger | gives | icd |
|---|---|---|---|
| Parry Clamp (arms, close) | handBreak | -2 s on its own cooldown | 1.5 s |
| Backdraft Vent (torso, close) | handBreak | -2 s | 1.5 s |
| Patient Lens (head, marksman) | eyeBreak | fully charged (`patientSince = fullS`) | 3 s |
| Mirror Ward (torso, marksman) | eyeBreak | -2 s | 1.5 s |

Numbers are the balancer's. The shape is what I defend: own button, additive, icd-capped, no HP, and a
rider-caused break never fires a rider (Parry's break goes through `interrupted()`, not `onHand`).

## 7. The pedestal match

One pedestal of three draws from the lean you wear most (tie: the lean of the part taken last), after
`rollPicks`' empty-slots-first and one-unfound rules, on the first pedestal whose slot has a lean part in
its source's gate; none has, a plain roll, logged. Nothing tagged worn: three plain rolls. Nothing hidden.

## 8. Checks, with pass/fail lines

**Simulator** (`dropsim --lean close|marksman|random`, pools full and career): supply only; appeal is the log's.
- S1 a match is produced in >= 90% of sets where a lean is worn.
- S2 the lean chooser wears 3+ of one lean at the Arbiter in >= 60% of runs.
- S3 a random-pedestal chooser wears 3+ of one lean in <= 30% (commitment is chosen, not the 81% case).
- S4 every slot offers each lean >= 0.5 a run; any zero cell fails.
- S5 by the end, the lean chooser has been offered <= 70% of its lean's parts in most runs (rule 9).
**Playtest log**, new fields (ids only; tags derived offline, so retagging never breaks old logs): per
pedestal set `{depth, kind, ids, match, taken}`; `worn` at Assembler, Arbiter, end; per depth
`eyeBreaks`, `plantedS`, `riders: {id: fires}`. Over 6+ runs:
- L1 every rider fires >= 8 a run where worn; fail = rework the trigger, not the number.
- L2 a part taken >= 70% of >= 6 pedestal offers, or 0 of >= 6, gets reworked.
- L3 a slot whose pedestal takes are under half its share of offers is a systemic fix.
- L4 runs wearing 3+ marksman spend >= 30% of `playS` planted, and eye shots >= strikes.
- L5 `pushes` and `strainOut` stay within 25% of today (riders ready buttons that would have been
  pushed). Ask what he felt before reading any of it.

## 9. Risks

- **R1 Pedestals are unplayed.** The match stacks an economy change on another. Tags, leancheck and the
  sim land now (inert); the match switches on after 3 of his pedestal runs.
- **R2 Close is fed by the base kit** (16 breaks a run); `eyeBreak` needs sentinels. Read L1 per depth.
- **R3 Bosses go quiet**: never breakable, so riders sleep at both bosses, where he breaks. Open.
- **R4 A rider reads as a stat** unless the card names the enemy event.

## Recommended leaning design

- A leaning is one `lean` tag per part (close, marksman or none); tags switch nothing on.
- Payoffs are riders on single parts, fired only by `handBreak` or `eyeBreak`, acting on their own button
  (cooldown cut or charge), icd-capped, never HP, never another part's numbers.
- The eye breaks a shooter's windup: the hand's fix mirrored, marksman's base kit and its trigger.
- The hand and the eye never change with what you wear.
- Four riders first: Parry Clamp, Backdraft (close); Patient Lens, Mirror Ward (marksman).
- Close head is the one dead slot: retune Flare before adding any part. Piston and Clamp Toss are peel.
- One pedestal in three matches your most-worn lean; nothing worn, no match; a fallback is logged.
- `tools/leancheck.ts` holds the invariants; dropsim gets `--lean` and S1-S5; the log gets L1-L5 fields.
- Order: tags, checks and sim now (no play cost); the eye break and four riders as the one combat trial;
  the match after 3 pedestal runs. About 2 evenings to build; the tuning is the hard part.
