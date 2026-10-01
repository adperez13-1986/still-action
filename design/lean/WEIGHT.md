# Weight (build brief)

1 Oct 2026. The first trial of the "lean on the parts" round: the pause switch **"weight"**, the "weight" row of
`design/lean/PITCHES.md`'s trial table. A coding agent follows it step by step (W0 to W5). The lead reviews each step
against its "Done when" list. The Ask 1 numbers are the balancer's round-3 pick (`design/lean/3-balancer.md`, pick B).
They supersede PITCHES' x1.25 / x1.1 numbers. Every file:line below was checked against the tree on 1 Oct.

**Rules for the engineer:**
- The word "weight" is a PLACEHOLDER: Adrian writes the words.
- Do not commit.
- Do not start a dev server: `vite.config.ts` binds 0.0.0.0. Checks start their own vite on 127.0.0.1 (`tools/checks/lib.mjs` `startVite`).
- Do not touch:
  - strain (`STRAIN_PER_PUSH`, `STRAIN_MAX`, the quiet, Rest), which is his call;
  - the gesture in `hud.ts` ("tap push" is a later switch, not this brief);
  - `HAND` / `EYE`;
  - `bossFor` / `BossDef` / `curve.ts` tables, which K-90 records;
  - dungeon generation.

---

## 1. Scope

**"weight" on** changes four things, none of them strain:
1. **Timing.**
   - Freeze, shake, camera punch and contact haptics happen on contact only, never on a whiff.
   - The pose starts cocked.
   - Auto beats freeze 0 ms. Auto kills freeze 35 ms, part kills 90 ms.
   - One contact formula, global and merged.
   - Moves freeze at the landing, and only if they struck.
2. **Per-slot drama** (PITCHES' recipe):
   - arms: shove and crunch;
   - head: gather, flinch, and a rising tick per pierce;
   - torso: the held crouch as the inhale, the duck, the whump;
   - legs: the landing slam;
   - a break gets the Anvil's weight.
   - No new particles in crowds. Colours are deep reds / cold blues only, never light orange (it reads peach under ACES + bloom).
3. **Full effect on every ready cast.** A ready cast gets the break rule, the threat aim, and the pushed pose, pitch and scale.
   - Exceptions: Patient Lens, Overrun, Lure and Plumb Line keep their push-only extras.
   - The push signature (ember sparks, the push vibration, the grind) stays on a real push only.
4. **The Ask 1 numbers**: pack/boss HP, part damage by slot, the area. They live in one constants block with two presets
   (B, the default, and the fallback D).

**The switch:**
- A pause switch, off by default.
- It applies at once: timing, drama, full effect, damage and area take effect on the next press.
- Pack and boss HP apply from the next level entered.
- The depth it was flipped on logs `weightMixed: true`.
- **Off is today's game exactly** (K-L1).

**Out of scope:**
- tap push;
- any strain retune (PITCHES' parked cap 24 + free push);
- bigger packs (dropped by 3-balancer §1: no seam beyond the constants);
- HANDOVER / DESIGN / PITCHES edits (the lead's).

---

## 2. The rule, in code terms

### 2.1 `src/weight.ts` (new, W0): every number of this trial

It has no three.js. It may import from `abilities.ts`, `still.ts` (types) and `temper.ts`.

```ts
import { byId, type AbilityDef } from './abilities'
import type { SlotName } from './still'

/**
 * The Ask 1 numbers (design/lean/3-balancer.md). A balancer re-run may change any of these and nothing else.
 * HP multipliers apply on top of the depth curve, never instead of it.
 */
export interface WeightPreset {
  /**
   * Ordinary pack bodies' HP, as ONE rounding of base x curveAt(depth).hp x this (combat.ts:2807's line).
   * `packHpEarly` covers crawl depths < 4 (1-2). `packHpDeep` covers crawl depths >= 4 (4, 5 in 6 depths; 4, 5, 7, 8 in 9).
   * 3-balancer's "x1.65 on the 1.3 bucket" means this times the curve's own hp, not a replacement for it.
   * The sim modelled every d4+ depth at curve 1.3. Live, d4 is 1.1 and d5 / d7 are 1.2 in 9 depths, so those depths
   * are softer than modelled (§6 R3). Do not "correct" it here.
   */
  packHpEarly: number
  packHpDeep: number
  /** A crowned leader (the heavy, combat.ts:2991). The sim models no heavies: 1 leaves them as the curve has them. */
  heavyHp: number
  /** A boss: its def's HP after bossFor's curve, x this, one Math.round. maxHp and every phase threshold follow (they read def.hp). */
  bossHp: number
  /**
   * Part damage by slot. It applies to def.damage and to every damage number the part carries:
   *   - mod: minDamage (charge), damage (slam, overrun, reflect), wallDamage (toss);
   *   - blastDamage.
   * Each is Math.round(x * k).
   */
  slotDmg: Record<SlotName, number>
  /** Blast radius of VENTS only (Brace, Ward and Mirror Ward untouched), +(r * k).toFixed(2). */
  ventRadius: number
  /** The run-over half-width of every 'dash' (def.radius) and of Overrun's charge (mod.radius). Skid Plates' slam radius is untouched. */
  dashWidth: number
  /** Scrap Cleaver only: its cone x this (120 at rank I; a tempered cone scales too), Math.round, cap 360. Frayed Cleaver keeps its cones. */
  cleaverCone: number
  /** Scrap Cleaver only: shove in u, radial from Still (shoveFrom). It has none today. */
  cleaverShove: number
}

export const WEIGHT_PRESETS = {
  /** r3 pick B, the default: area 2. */
  B: { packHpEarly: 1.4, packHpDeep: 1.65, heavyHp: 1, bossHp: 1.3,
       slotDmg: { head: 1.2, torso: 1.8, arms: 1.2, legs: 1.8 }, ventRadius: 1.4, dashWidth: 2, cleaverCone: 180 / 120, cleaverShove: 1.2 },
  /** r3 fallback D: area 1, for when area 2 crowds the phone screen. It costs the median 3 points of part share. */
  D: { packHpEarly: 1.4, packHpDeep: 1.65, heavyHp: 1, bossHp: 1.1,
       slotDmg: { head: 1.15, torso: 1.8, arms: 1.15, legs: 1.8 }, ventRadius: 1.25, dashWidth: 1.5, cleaverCone: 160 / 120, cleaverShove: 1.2 },
  // r1 pick (lean rounds 1-2, judged against the old 1-in-3 floor), kept for the record; not selectable:
  // R1: { packHpEarly: 1.25, packHpDeep: 1.25, heavyHp: 1, bossHp: 1.1,
  //       slotDmg: { head: 1.1, torso: 1.5, arms: 1.1, legs: 1.5 }, ventRadius: 1.25, dashWidth: 1.5, cleaverCone: 160 / 120, cleaverShove: 1.2 },
} satisfies Record<string, WeightPreset>
export type PresetId = keyof typeof WEIGHT_PRESETS
/** The shipped preset. DEV `__weightPreset` flips it for checks and screenshots; nothing persists it. */
export const WEIGHT_PRESET: PresetId = 'B'

export const VENTS: readonly string[] = ['pressure-vent', 'backdraft-vent', 'chill-vent']
/** Documentation and checks: these keep their push-only extras (combat reads ctx.pushed there, §2.4). */
export const PUSH_ONLY: readonly string[] = ['patient-lens', 'overrun', 'lure', 'plumb-line']

/** The feel. The same in every preset. */
export const WEIGHT_FEEL = {
  /** contact ms = min(capMs, round(baseMs + perCdS x base cooldown s + perBodyMs x (bodies - 1))). */
  freeze: { baseMs: 30, perCdS: 6, perBodyMs: 10, capMs: 100, mergeS: 0.2 },
  killMs: { part: 90, auto: 35 },
  breakMs: { part: 90, auto: 35 },
  /** An auto kill's shake: this x today's kill shake. */
  autoKillShake: 0.5,
  /** [first body, per extra body, cap]. */
  contactShake: [0.12, 0.04, 0.34], contactPunch: [0.02, 0.01, 0.06], contactHapticMs: [12, 6, 30],
  /** The Anvil catch's pattern (main.ts:389). */
  breakHaptic: [20, 30, 40],
  /** still.ts: the pose's start, as a fraction of its dur, by Pose. Absent: 0 (today). */
  cocked: { arc: 0.3, spin: 0.3, piston: 0.3, nova: 0.25, through: 0.29, hook: 0.45 } as Partial<Record<string, number>>,
  /** The torso's duck under its whump: -4 dB for 0.25 s, then back. */
  duck: { gain: 0.63, s: 0.25 },
  /** The head's flinch on its first body: up to 0.17 rad (~10 deg) back from Still, eased out over 0.12 s. */
  flinch: { rad: 0.17, s: 0.12 },
  /** The head's gather at the lens on the press (not Through-Line: it has its own, main.ts:3741). */
  gather: { count: 6, radius: 0.4 },
}

/** The untempered cooldown, s: the part's own rank-I def from PARTS, so tempering never makes a part feel lighter. */
export function baseCooldownS(def: Pick<AbilityDef, 'id'> | null): number

/** The active preset (WEIGHT_PRESET unless DEV changed it). */
export function preset(): WeightPreset
export function setPreset(id: PresetId): void

/**
 * `def` with the active preset's Ask 1 numbers. It is pure, memoized per (preset, def object), and idempotent.
 * An output passed back returns itself (a WeakSet of outputs), so weighed(weighed(d)) === weighed(d).
 * Never touches cooldownMs, range, windowMs, strain, sets/pays.
 */
export function weighed(def: AbilityDef): AbilityDef
```

### 2.2 The switch and the log (`src/main.ts`, W0)

**The switch.**
- Built exactly like "follow-through" (`main.ts:2267-2300`): `pause.setSwitch('weight', …)` after follow-through's.
- Key `still-action.weight`, default off (`=== '1'`).
- `applyWeight(on)` sets `combat.weight = on` and resets the freeze merge state (§2.3). It is called at every level entry
  next to `applyFollowThrough` (`main.ts:2918`).
- A mid-crawl flip that changes `combat.weight` calls `applyWeight` and sets `st.weightMixed = true`.
- HP: right after `combat.curve = curveAt(…)` (`main.ts:2919`):
  `combat.packHpMul = combat.weight && !level.boss ? (depth < 4 ? P.packHpEarly : P.packHpDeep) : 1`, and
  `combat.heavyHpMul = combat.weight && !level.boss ? P.heavyHp : 1`.
- The boss: `main.ts:2938` passes `combat.weight ? { ...boss, hp: Math.round(boss.hp * P.bossHp) } : boss` to `addBoss`.
  bossFor itself never changes (K-90 records it). `__spawn`'s boss path stays unweighed.

**Combat (`combat.ts`).**
- New fields `weight = false`, `packHpMul = 1`, `heavyHpMul = 1`.
- In `addPack`, line 2807 becomes `e.hp = Math.round(e.hp * this.curve.hp * this.packHpMul)`. With 1 this is
  byte-identical to today: one rounding of the same product.
- After `crown()` (`:2810`), `if (this.heavyHpMul !== 1) leader.hp = Math.round(leader.hp * this.heavyHpMul)`.
- Boss adds (`summon`, `:2904`; `summonRamsMites` → `addPack`) are untouched, because packHpMul is 1 on a boss level.

**Log (`DepthStats`, `main.ts:1554`). Always logged, on or off. Set in the stats push at `main.ts:2977`.**
- `weight: boolean`: `combat.weight` at entry.
- `weightMixed?: true`: set only on a mid-depth flip.
- `breaksBy: { ready: number; pushed: number }`: splits `breaks`, so `ready + pushed === breaks`. Off, `ready` stays 0.
- `freezeMs: number`: real frozen ms in the crawl, all sources, measured in `frame()`'s hitstop branch (`main.ts:4572`)
  as `min(hitstop, elapsed)`. Headless `__step` never runs it, so it stays 0 there. "Freeze ms per fight-minute" is
  `freezeMs / (fightS / 60)`.
- `freezePartMs`, `freezeAutoMs: number`: what `freeze()` added (after merging), by source (§2.3). Always 0 when off.

**DEV hooks** (inside `if (import.meta.env.DEV)`):
- `__weight(on?)`: as `__followThrough`.
- `__weightPreset(id?)`: sets or returns the active preset.
- `__weighed(id, rank = 1)`: `weighed(tempered(byId(id), rank))` as JSON.
- `__equipRank(id, rank)`: `__equip` with `tempered(byId(id), rank)`.
- `__fx()`: returns `{ hitstop, shake, pushSig }` and zeroes all three. `pushSig` counts push signatures (§2.4).

### 2.3 Timing (W1)

**Contacts (`combat.ts`).** These only run when `this.weight`. Off, nothing is collected and nothing is emitted, so K-90F holds.
- **Collect.** `private struck = new Map<Payer, Set<Enemy>>()` is filled in `hitPart` (`:1142`) and at the two direct
  part hits: Signal Flare's own hit (`:1902`) and Clamp Toss's wall hit (`:1315`). One body counts once per payer.
  Shatter (`:1179`) is not a contact.
- **Flush.** At the end of `useAbility` (before `return r`, `:2224`) and at the end of `update()`, one event per payer:
  `events.onContact?.({ def: 'id' in payer ? payer as AbilityDef : null, slot: payer.slot, n, at, first })`.
  `at` and `first` are the first body struck. The flush clears the map.
- **Moves hold.** For a `dash` cast and a Plumb Line snap (both run over bodies through `this.later`, `:2368`), set
  `contactHold.set(def, this.time + ms / 1000)`. The flush skips a held payer until `this.time >= hold - 1e-9`, which is
  the landing.
  - Do not flush the hold from a `later`: the later loop runs in reverse push order (`:801`), so a later pushed after the
    hits would run before them.
  - Skid Plates' slam lands at the same t and so joins the same flush.
- New `CombatEvents.onContact?` (optional).

**`freeze(ms, src: 'part' | 'auto')` (`main.ts`, new).** This is the only path for the freezes listed below. Every other
`hitstop = Math.max(…)` stays as it is (hurts, rams, states, shatter, Broken, the boss's fall).
```ts
const t = combat.time   // game time: it stands still inside a freeze, so a freeze's start and end are the same t
const add = t - freezeAt < WEIGHT_FEEL.freeze.mergeS ? Math.max(0, ms - freezeMs) : ms
if (t - freezeAt < mergeS) hitstop += add / 1000; else hitstop = Math.max(hitstop, ms / 1000)
freezeMs = t - freezeAt < mergeS ? Math.max(freezeMs, ms) : ms; freezeAt = t
st[src === 'part' ? 'freezePartMs' : 'freezeAutoMs'] += add
```

**With `combat.weight` on:**

| where (today) | today | weight |
|---|---|---|
| `cast()` `main.ts:3715-3717`: shake, hitstop, punch on the press | 0.16/0.34, 35/60 ms, 0.02/0.06 | **none on the press** |
| `onContact` (new) | n/a | `freeze(min(100, round(30 + 6·baseCooldownS(def) + 10·(n-1))), 'part')`; shake `min(.34, .12+.04(n-1))`; `rig.punch(min(.06, .02+.01(n-1)))`; `navigator.vibrate?.(min(30, 12+6(n-1)))`; the slot's drama (§2.6) |
| `onHit` `main.ts:241-264`: every hit, part or auto | 45 ms (60 into an open hatch), shake 0.1 | sparks, flash and sound as today; **no hitstop, no shake**, except the open hatch keeps its 60 ms (rare; it teaches the hatch) |
| `onHand` `main.ts:555-556` | 22 ms (50 broke), shake 0.06 | **0 ms**; shake 0.06 stays |
| eye lance (`eyeHit` `combat.ts:1779` → onHit) | 45 ms | **0** (via onHit) |
| `onKill` `main.ts:338` (not boss, not mite) | 80 ms, shake 0.28 / 0.3 | by `onFelled`'s `by` for this body (stash it, `main.ts:530`): `'part'` → `freeze(90, 'part')`, shake as today; `'auto'` → `freeze(35, 'auto')`, shake ×0.5; `'other'` → 80 as today |
| mite kills `main.ts:306-307` | 20 / 30 ms | unchanged (the brood is meant as noise) |
| `breakFx` `main.ts:1264` | 90 ms | `by` (hand/eye) → `freeze(35, 'auto')`; a part's → `freeze(90, 'part')` + `navigator.vibrate?.([20,30,40])` |
| moves | never froze (`MOVES`, `main.ts:3693`) | only through `onContact` at the landing, only if struck |

Formula values to check against (round, then cap):
- Cleaver (2.6 s): 46 / 66 / 86 at 1 / 3 / 5 bodies.
- Lens 4.2: 55.
- Patient Lens 1.5: 39.
- Vent 6.5: 69 / 89 / 100.
- Kickstart 8: 78, and 98 at 3 bodies.
- A Cleaver III freezes 46, like a rank-I one.

**Starts cocked (`still.ts`).**
- `AttackSpec` gains `cocked?: boolean`.
- In `attack()` (`:261`): `t: a.cocked ? (WEIGHT_FEEL.cocked[p.pose] ?? 0) * dur : 0`.
- Main passes `cocked: combat.weight` from `cast()` only. The autos' and the Anvil slam's `attack` calls never pass it.
- Presentation only. The arc's first drawn frame is the smear (`:692-699`: past `k < 0.3`).
- The nova starts at the crouch's bottom (`k = 0.25`, `:709-716`). The contact freeze then holds that frame for 69-100 ms:
  that held crouch is the torso's "70 ms inhale", with no input lag. A whiff has no inhale.

### 2.4 Full effect on ready casts (W2)

`CastContext` (`combat.ts:96`) gains `full: boolean`. Main's `cast()` passes `pushed` (the real push, from the hud) and
`full = pushed || combat.weight`. Off, `full === pushed` everywhere.

**In `useAbility` and its helpers, every `ctx.pushed` becomes `ctx.full` except three**, which stay `ctx.pushed`:

| line | what | reads |
|---|---|---|
| `:1867` | Patient Lens fires full | `ctx.pushed` |
| `:2034` | Plumb Line re-plants instead of snapping | `ctx.pushed` |
| `:2160` | Overrun's charge numbers | `ctx.pushed` |
| `:1860, 1881, 1888, 1890, 1926, 1983, 1996, 2014, 2021, 2027, 2052, 2103, 2119, 2124, 2173, 2185, 2260, 2265, 2279, 2283` | threat aim, break, reel, stored push flags | `ctx.full` |

- Lure's push-only extra needs no line. Only a push can recast it while a decoy is out (its 12 s cooldown outlasts the
  3 s decoy), and `:2021` only says whether that burst breaks.
- **The real push is threaded beside `full`**, for the log only:
  - `hitPart(e, damage, pushed, payer, real = pushed)` (`:1142`): the state event's `pushed` (`:1153`, which feeds
    `pushedIntoState`) reads `real`.
  - `pushBreak(e, real)` (`:1221`).
  - `interrupted(e, push, by, tell, parry, ready = false)` (`:2532`) adds `ready: true` to the event only when it is set
    (`parts.ts:182` gains `ready?: boolean`).
  - Bolt (`:143`), Held, the decoy record, and the lob and slam closures each store `real: ctx.pushed` beside their
    `pushed: ctx.full`. `runOver` and `burstDecoy` take it as one more parameter.
  - Parry's and Clamp Toss's reel pass `ready: reel && !ctx.pushed`.
- Main's interrupt handler (`main.ts:455`): `if (ev.push) { st.breaks++; st.breaksBy[ev.ready ? 'ready' : 'pushed']++ }`.

**Look and sound in `cast()` (`main.ts:3695`):**
- `still.attack({ … pushed: full, cocked })`, which gives ×1.35 (`still.ts:685`).
- `still.group.scale.setScalar(full ? 1.16 : 1.08)`.
- `sfx.ability(r.beat, full, r.power, pushed)`.
- `castFx(shown, r, pushed)`, where `shown = combat.weight ? weighed(def) : def` (so the Cleaver's sparks and the Vent's
  dust follow the real cone and radius).

**Push signature, real push only.**
- `castFx`'s embers (`main.ts:3867`) move into `pushSignature()`, which also does `pushSig++` in DEV.
- The hud's `[14,26,14]` (`hud.ts:570`) is already the real push's. Leave hud.ts alone; the 12 ms press buzz stays.
- `audio.ts` `ability(beat, big, power, real = big)` (`:1181`): `r`/`k` read `big`. **Every grind reads `real`**:
  - the rewind's `if (!pushed)` at `:1331`;
  - fray-360's at `:1290`;
  - the final one at `:1360`.
  So Borrowed Time still grinds on every press, and a ready cast never grinds.
- Fix the stale comment at `combat.ts:468`: the break rule has been on since 26 Sep (`main.ts:2179`).

### 2.5 The Ask 1 numbers (W3)

- `combat.useAbility` starts with `if (this.weight) def = weighed(def)`.
- So do `reaches()` (`:1242`) and `wouldPay()` (`:1212`), which main calls with the hud's unweighed defs for the break hint and the
  push cue. The memo makes the internal calls free.
- Everything downstream reads the weighed def:
  - the cone and sweep (`:2089`, `:2154`);
  - the blast (`inBlast`);
  - the run-over width;
  - the stored defs of the decoy, anchor, anvil and held;
  - the mirror's `reflectDamage`.
- **Scrap Cleaver's shove:** in the arc loop (`:2112-2147`), before the Piston branch: `else if (def.id === 'scrap-cleaver' && def.shove) this.shoveFrom(e, o.x, o.z, def.shove)`.
  Radial, as the Vent and the hand shove. Off, the def has no shove, so the branch is dead.
- The breakpoint 3-balancer keeps: at d1-2, a white Lens (26 × 1.2 = 31; 30 under D) one-shots a sentinel
  (20 × 1.4 = 28). K-L3 pins it.

### 2.6 Per-slot drama (W4)

These run only from `onContact` and the press, with weight on. **There are no new emitters at struck bodies.** Today's
per-hit sparks in `onHit` are the crowd's whole particle budget. New colour is COLD / COLD_DEEP, or EMBER_DEEP → EMBER
(`vfx.ts:12-15`), never a light orange such as `0xff7a55`.
- **Sound:** a new `audio.ts` `contact(slot, n, pan, k = 0)` calls `heard('contact:' + slot)`. Keep each transient in the
  400 Hz-1 kHz band, because a phone speaker has no bass. The translator's voices:
  - arms: a crunch (`metalHeavy` at rate 0.9, dropping to 0.8 at n >= 3);
  - head: a dry "tck" (square ~2.4 kHz, 12 ms, up a semitone per pierce `k`; main counts `k` per head contact, resetting after 200 ms game time);
  - torso: a whump (sine ~420 → 180 Hz over 0.12 s plus `plateHeavy`), and the duck: `duck.gain` to 0.63 for 0.25 s, then
    back, as `hurt()` handles it (`:483-485`), with `heard('duck')`;
  - legs: a slam at the landing.
  The press keeps `sfx.ability` as the anticipation voice.
- **Arms:** the shove (§2.5) and the crunch.
- **Head:**
  - on the press, `vfx.gather(lens, 6, 0.4, COLD)` for head bolts other than Through-Line;
  - on the first body only, a flinch: `partFx.flinch(e, away)` tilts the body's group back from Still by up to 0.17 rad,
    eased out over 0.12 s, render-side;
  - each pierce's rising tick.
  - **First** check that no enemy update writes `group.rotation.x/z`. If one does, flinch a child or drop the flinch and say so.
- **Torso:** the cocked crouch held by the freeze (§2.3), the duck, the whump.
- **Legs:** the landing freeze (§2.3) and the slam, only if struck.
- **A part's break:** 90 ms and `[20,30,40]` (§2.3). `tellBreak` already puts the windup's ember out.

---

## 3. Steps

**The regression set.** Each step ends with all of it, in order:
- `npx tsc --noEmit -p .` and `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → K-90 and K-90L PASS;
- `node tools/checks/fights.mjs compare` → K-90F PASS;
- `node tools/checks/autos.mjs` → all PASS (K-A7 is registered twice, autos.mjs:167 and :271; it prints one line);
- `node tools/checks/k9.mjs`, `area3.mjs`, `home.mjs`, `stagec.mjs`, `screens.mjs` → as W0 recorded;
- `node tools/checks/stageb.mjs` → as W0 recorded (K-W3d, the known Parry finding, may fail; the slow K-T13 only at W5);
- the step's own `node tools/checks/lean.mjs <ids>`.

Each check a step adds is negative-tested once: break its rule, see it FAIL, restore, and report it. Every step reports
every file touched and every check line verbatim.

### W0. Scaffold, the switch, the log
- `tools/checks/lean.mjs` on `suite()`, modelled on autos.mjs, with:
  - `RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'`;
  - a SETUP: arena, held loop, pinned loadout, `C.breakRule = true`, `__weight(on)`, `__weightPreset('B')`, `__fx()` once to zero;
  - helpers `tick`, `wall(hp)` (a hulk whose hp a strike doesn't end), `fx()`.
- Not to be confused with `tools/leancheck.ts`, which belongs to the leanings round.
- `src/weight.ts` per §2.1, complete (`weighed` included, but not wired yet).
- §2.2 entire, except the HP multipliers' effect (the fields exist and stay 1 until W3).
- Before any `src/` change, run every suite and record the results and the `dist/` bytes.

**Done when:** the regression set passes; K-L1, K-L2, K-L10 PASS; `screens.mjs` (K-S1..12) PASS with the new switch row;
the starting record is reported.

### W1. Timing: freeze on contact
- §2.3 entire: combat's contacts, the moves hold, `freeze()`, the table, the cocked pose.

**Done when:** the regression set passes; K-L6, K-L7, K-L8, K-L9 PASS; K-L10 PASS again (freezePartMs and freezeAutoMs
now move); K-L8 is also negative-tested against the old line, with the press freeze put back under weight: case (a) must
FAIL. The lead gets the screenshots S1-S3 (§5).

### W2. Full effect on ready casts
- §2.4 entire.

**Done when:** the regression set passes; K-L4, K-L5 PASS; K-L8 and K-L10 PASS again (breaksBy.ready now moves).
Screenshot S7.

### W3. The Ask 1 numbers
- §2.5, plus §2.2's HP multipliers wired.

- **Lead's change (1 Oct): the cards tell the truth.** With weight on, every card that shows a part's numbers (the pause
  compare card `pause.ts` compare(), the pickup card, the notebook if it shows numbers) shows `weighed(def)`'s damage,
  cone and radius. He picks parts on that card; a card x1.2-1.8 off misleads the very choice this trial is about. Off: the
  def, unchanged.

**Done when:** the regression set passes; K-L3 PASS; K-L6 and K-L8 PASS again (their bodies sit inside both presets'
cones and radii). K-L3g (new): with weight on, the compare card's damage text for a torso part equals weighed(def).damage;
off, def.damage. Screenshots S4-S6 and S10, both presets, and the compare card on/off.

### W4. Per-slot drama
- §2.6 entire.

**Done when:** the regression set passes; K-L11 PASS; K-L2 through K-L10 PASS again. Screenshots S1-S9.

### W5. The whole trial, headless
- K-L12, the budget.
- Every suite in full, stageb's K-T13 included.
- `dist/` bytes against W0's.
- Every screenshot in §5, under both presets where §5 says so.

**Done when:** K-L1 through K-L12 PASS. The lead has a table (check → result → one line) with K-L12's numbers, and every
screenshot with the engineer's one honest line on what reads and what doesn't.

**Check assignment** (each K-L id belongs to exactly one introducing step):

| step | checks |
|---|---|
| W0 | K-L1, K-L2, K-L10 |
| W1 | K-L6, K-L7, K-L8, K-L9 |
| W2 | K-L4, K-L5 |
| W3 | K-L3 |
| W4 | K-L11 |
| W5 | K-L12 |

---

## 4. Acceptance checks (`tools/checks/lean.mjs`)

**Setup for every check:**
- autos off (`C.autoAttack = false`) unless stated;
- hulks are pressure bodies at hp 1e6 (`wall`) unless a kill is the point;
- Still is at the origin, facing +z;
- `fx()` is read right after `__fire` with no step between, so no auto can fire;
- every expected ms is ±0.5 ms (as seconds ±0.0005);
- preset B unless stated.

- **K-L1 off is today** (a `task`).
  - Spawn `fights.mjs compare`, `autos.mjs`, `stageb.mjs` and `k9.mjs` as child processes. Each must print what W0
    recorded: every PASS, and stageb's known fails only.
  - Page part: a fresh context has `localStorage['still-action.weight']` unset, `__weight()` false, and `__run.stats.at(-1).weight === false`.
- **K-L2 the switch.**
  - The loadout pause screen shows a switch labelled `weight`. One real click flips it on, and localStorage becomes `'1'`.
  - Flipped on mid-crawl:
    - `combat.weight` is true at once;
    - the open depth logs `weightMixed: true`;
    - the bodies already on the level keep their HP.
  - `__enter(depth + 1)`: that depth logs `weight: true` and no `weightMixed`.
  - Flipped off then on in the same depth: still one `weightMixed`, no throw.
- **K-L3 the numbers** (both presets, run through `__weightPreset`).
  - (a) For every part in `__parts`, `__weighed(id)` equals a table computed in the check from the def and §2.1's rules
    (damage and every mod damage rounded per slot; VENTS radius; dash and Overrun widths; Scrap Cleaver cone 180 under
    B, 160 under D, plus shove 1.2). Nothing else differs from the def (deep-diff). `__weighed(id, 3)` scales the
    tempered def (Scrap Cleaver III: 120 × 1.3 = 156 → 234 under B).
  - (b) Idempotent (`weighed(weighed(d))` is the same object).
  - (c) In a fight, the first hit of a ready cast on a `wall` drops its HP by: Cleaver 22, Vent 27, Kickstart 22,
    Lens 31 (D: 21, 27, 22, 30). Off: 18, 15, 12, 26.
  - (d) A hulk at 2 u, 85° off the Cleaver's facing (forced by a nearer target ahead): struck under B, not under D or off.
  - (e) The shove: a lone hulk at 2 u is ≥ 2.6 u from Still 0.5 s after a ready Cleaver. Off, < 2.2 u.
  - (f) The breakpoint at `__enter(1, s)` with weight on: every ordinary sentinel has 28 HP, and one ready white Lens
    kills one.
  - (g) Pack HP, the same seed on and off:
    - at `__enter(1, s)`, every ordinary body is `round(base × 1.4)`;
    - at `__enter(4, s)`, every ordinary body is `round(base × 1.1 × 1.65)` (the 6-depth curve's d4 hp);
    - bases from the classes: chaser 30, ranged 20, swarm 8, charger 36, lobber 22, mender 20;
    - an elite pack's leader is equal on and off;
    - the generated level (`__level()` packs' positions) is equal on and off.
  - (h) `__enter(3)`, weight on: `__boss().maxHp === round(bossFor(3).hp × 1.3)`. Awake, at hp 0.56 × maxHp it is not
    overloaded after a step; at 0.54 × maxHp it is.
- **K-L4 full effect on ready casts** (weight on; strain read before and after).
  - (a) A crowned hulk winding up 2 u ahead, then a ready Cleaver: it breaks; `breaksBy.ready +1`, `pushes +0`, strain equal.
    Off, the same press does not break it.
  - (b) An idle hulk at 4 u and a winding one at 9 u, then a ready Lens: the bolt hits the winding one.
  - (c) Exceptions:
    - Patient Lens fired twice 0.5 s apart: the second deals less than 32 × 1.2;
    - Overrun ready plays `overrun-step` and deals no run-over damage;
    - Plumb Line ready, then ready with the anchor out: it snaps (anchor gone), not re-plants.
  - (d) After a ready cast, `__still` anim `pushed === true` and `still.group.scale.x ≈ 1.16`. Off: false, 1.08.
- **K-L5 push signature** (`navigator.vibrate` stubbed to record).
  - Weight on, a ready cast: `pushSig 0`, no `[14,26,14]`.
  - A real push (`__fire(slot, true)` on a cooling button): `pushSig 1`, `[14,26,14]`.
  - Off: push → 1, ready → 0 (today).
- **K-L6 the formula and the merge.**
  - Cleaver at 1 / 3 / 5 walls (inside a 100° fan at ≤ 2.2 u, so every preset's cone covers them): 0.046 / 0.066 / 0.086.
  - Vent at 1 / 3 / 5 (≤ 3.5 u): 0.069 / 0.089 / 0.100. Patient Lens: 0.039. Cleaver III (`__equipRank`): 0.046.
  - Merge:
    - Cleaver (0.046), zero, step 0.1 s, `__hud.ready('torso')`, Vent → 0.023;
    - step 0.3 s, `__hud.ready('arms')`, Cleaver → 0.046;
    - a Cleaver that kills a 1-HP hulk: press then the step it dies sums to 0.090;
    - `freezePartMs` equals the sum read.
- **K-L7 the autos quiet** (autos on).
  - Hand strikes on a wall for 3 s, read every step: hitstop 0 throughout, `st.hand > 0`. Off: some step > 0.
  - Planted eye lance at a wall 8 u away: 0.
  - Auto kill (1-HP hulk in reach): max 0.035, shake ≤ 0.14, `freezeAutoMs +35`. Part kill: 0.090, shake ≥ 0.28.
  - Hand break of a crowned windup: 0.035. Cleaver break: 0.090 and `[20,30,40]` recorded.
- **K-L8 no freeze on a miss** (verifier r2's cases, thresholds recomputed for the agreed formula).
  - (a) Cleaver, hulk 6 u behind Still: hitstop 0, shake 0, vibrate never called with a contact length (only the hud's 12).
  - (b) One hulk in the arc: 0.046. Three: 0.066.
  - (c) Lens at a hulk 8 u away: 0 on the press, 0 on every step before the bolt lands, 0.055 on the step it lands.
  - (d) An auto kill ≤ 0.035. A part kill 0.090.
  - (e) The control, permanent: weight off, case (a) gives 0.035 (today's `main.ts:3716`). It must be > 0, proving the
    check can see the old rule.
- **K-L9 moves** (Kickstart).
  - Empty floor: 0 at the press, every step to the landing, and 10 steps after.
  - Three walls on the path: 0 at the press and on every step before the landing; on the landing step (within one tick
    of `travelMs` 280), 0.098.
  - Skitter (a hop) over a wall: 0 throughout.
- **K-L10 the log** (on and off).
  - `weight`, `breaksBy`, `freezeMs`, `freezePartMs`, `freezeAutoMs` are present.
  - `breaksBy.ready + breaksBy.pushed === breaks`; off, `ready === 0`.
  - `weightMixed` only on a flip depth.
  - `kills` and `hpLost` are still present.
- **K-L11 the drama** (`__heard`).
  - A struck Cleaver logs `contact:arms` once. A whiff logs none.
  - A struck Vent logs `contact:torso` and `duck`.
  - A Lens logs `contact:head` on the landing step only.
  - A Kickstart through walls logs `contact:legs` on the landing step only.
  - Off: no `contact:*` ever.
- **K-L12 the budget** (W5; report plus pass line).
  - Scripted fights on the arena, seeds 1-5, 60 s each:
    - three hulks at 3 u;
    - six mites;
    - a hulk, a sentinel and a ram.
  - Two bots: "eager" casts every ready part at once; "hesitant" casts 3.7 s after ready (never-melt's hesitation).
    The starting loadout, preset B.
  - Measure `(freezePartMs + freezeAutoMs) / fight ms`.
  - PASS if it is ≤ 10% for both bots and parts own ≥ 60% of it.
  - Print both bots' numbers beside the sim's 4-7% / 77%.

---

## 5. What the engineer must screenshot and look at

Use the game camera, the live iso rig at its fight zoom (never a debug top-down), with a 915 × 412 viewport
(the Poco F8 Pro in landscape), `deviceScaleFactor` 2.6. Write the PNGs outside the repo.

Take a shot right after `__fire` with the loop held: that frame is the freeze. Then step to show the after. For each,
write one honest line on what reads at phone size, and say what doesn't.

| id | what | look for |
|---|---|---|
| S1 | Cleaver at 1 hulk vs 5 hulks, the contact frame | does five read heavier than one; the sweep decal; cold sparks, no peach |
| S2 | Cleaver whiff, the press frame and 2 frames on | nothing sticks; the pose still swings |
| S3 | Cleaver, the first frame after the press, on vs off | cocked: the smear on frame 1 |
| S4 | Vent into 4 hulks, the held crouch, then the ring | B (6.0 u) and D (5.4 u): how much of a 20 u room it covers; whether the ring reads as the edge |
| S5 | Scrap Cleaver 180° (B) and 160° (D) over a pack | whether 180 reads as a swing or as a ring; the shove's spread |
| S6 | Kickstart through 3 hulks, the landing frame | B's 4.8 u swath vs D's 3.6: does it read as a dash or a wall |
| S7 | A ready cast vs a real push, both on | ready: big pose, scale, no embers; push: ember sparks in EMBER_DEEP → EMBER, not peach |
| S8 | A Cleaver breaking a crowned hulk's windup | does the break land as an event |
| S9 | A Lens on a hulk: the gather at the lens, then the flinch | does the flinch read, or is it lost at camera distance |
| S10 | The pause screen with the new row, at 915 × 412 and 667 × 320 | the row fits; resume reachable (screens.mjs proves the reach) |

Sound, haptics and the felt freeze can't be judged headless (no AudioContext runs). They go on the phone list (§7).

---

## 6. Risks

- **R1. A global freeze on every contact can feel like lag.**
  - Today it is 7-9% of pack time, and the sim puts the new rule at 4-7%.
  - K-L12 bounds the scripted case. `freezeMs` per fight-minute judges the real one.
  - The first dial is `perCdS` / `capMs` in WEIGHT_FEEL.
- **R2. Area 2 may crowd the screen.**
  - A 6.0 u vent and a 4.8 u dash swath are a big share of a 20 u room.
  - S4-S6 decide. D is one constant away (`WEIGHT_PRESET`).
- **R3. The sim's 1.3 bucket.**
  - Live d4 (curve 1.1) and d5 / d7 in 9 depths (1.2) come out softer than 3-balancer modelled: d4 is 1.82 against 2.15.
  - **Answered (3-balancer "R3 answer"):** keep x1.65, one number. The finish model is relative to each depth's own curve, so
    the live curve gives 19/72/92 (vs 20/72/92 modelled). Topping d4-7 back to 2.15 would overshoot the target (16/70/91).
- **R4. Breakpoints move with every multiplier.**
  - x1.4 was chosen so the white Lens still one-shots a sentinel (K-L3f).
  - Any change to `slotDmg.head` or `packHpEarly` must rerun it.
- **R5. Ready Parry now reels** (full effect, `:2124`).
  - Parry gets stronger only with weight on. stageb's K-W3d (Parry a dead slot) is measured with weight off and doesn't see it.
- **R6. Threat aim on every ready cast** can swing a Cleaver off the nearest body onto a windup that lands sooner.
  Intended (V4), and S1 / S8 should show it reads.
- **R7. Cards must not lie while it's on.** Overturned by the lead: the cards show weighed numbers (W3).
- **R8. Missed `ctx.pushed` sites.**
  - §2.4's table is the full list at 1 Oct.
  - `grep -n 'ctx.pushed' src/combat.ts` must return exactly the three kept lines after W2.
- **R9. Off must draw no new `Math.random`.** `audio.ts` `vary()` draws it. `contact()` and the flinch run only with
  weight on, and nothing new runs off.
- **R10. A freeze inside a windup is ~70 ms of free reaction.** It is a small defence buff the sim doesn't count
  (balancer r1).

## 7. Where this brief departs from the round's docs

- **The Ask 1 numbers** are 3-balancer's r3 pick B (packs ×1.4 / ×1.65, boss ×1.3, ×1.8 / ×1.2, area 2), not PITCHES'
  ×1.25 / ×1.1. D is the fallback. r1 is kept as a comment.
- **K-L8's thresholds:** 2-verifier's 0.05 / 0.074 / 0.045 were for the 50 + 12/body formula. The agreed formula gives
  0.046 / 0.066 / 0.055.
- **The tick and the grind are signatures.** The translator put the grind in the shared "pushed presentation". This
  brief keeps it as push-only, because the grind is the sound of strain (`audio.ts:1331`) and the brief's push
  signature must stay audible.
- **Mites, 'other' kills, the open hatch, the hud's press buzz** keep today's numbers. These are the brief's calls, not
  the round's.

**Decided here** (the lead or Adrian may overturn):
- heavies untouched (`heavyHp: 1`, not modelled);
- boss adds untouched;
- Brace isn't a vent;
- the Cleaver's shove is radial, 1.2 u (the translator's range was 0.8-1.5);
- auto breaks 35 ms;
- the contact shake / punch / haptic curves;
- moves = dash and the Plumb Line snap.

**For the phone (his):**
- does a five-body Cleaver feel different from a jab;
- the freeze's feel, and does it read as lag;
- the duck, the crunch, the tick and the slam (none has been heard);
- the haptics;
- B vs D on screen.

Log lines to judge by:
- `kills.part` share d1-2 ≥ 45% (36% now);
- `hpLost` d1-3 within 20% of runs 9-17;
- `freezeMs` per fight-minute;
- `breaksBy { ready, pushed }`;
- leave out the depths with `weightMixed`.
