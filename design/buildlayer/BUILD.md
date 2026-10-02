# Builds (build brief)

2 Oct 2026. The build layer's trial: the pause switch **"builds"**, as `design/buildlayer/PITCHES.md` agreed and the lead settled
it. **The owner decided on 2 Oct: Ram is the second core, beside Wake, and the core is picked at the run's start from two cards.**
A coding agent follows this brief step by step, B1 to B6. The lead reviews each step against its "Done when" list.

- **B0** (the measuring fixes, 2-verifier.md §5) is being built now. It is not re-specced here. §3 lists what B1 onward needs from it.
- Files are cited by function name. Line numbers are approximate, from b7b4118 before B0. B0 is cutting the rider code in `main.ts`,
  `hud.ts`, `pause.ts` and `workshop.ts` right now, so lines will move. Find things by name.

**Rules for the engineer:**
- Every name and every line a player reads is a PLACEHOLDER: "builds", "core", "Wake", "Ram", "rimed", "slammed", every keystone, every
  upgrade, every card line, every caption. Adrian writes the words. Put them in the `WORDS` block of `src/cores.ts` (§2.1) and nowhere else.
- Do not commit.
- Do not start a dev server: `vite.config.ts` binds 0.0.0.0. Checks start their own vite on 127.0.0.1 (`tools/checks/lib.mjs` `startVite`).
- Do not touch:
  - strain (`STRAIN_PER_PUSH`, `STRAIN_MAX`, the quiet, Rest). That is his call;
  - the "weight" numbers (`src/weight.ts`) and the "tap push" gesture (`hud.ts` `tapAnswer`);
  - `HAND` / `EYE` / `AUTO_INTERVAL`. The core reads them and never changes them;
  - `bossFor` / `BossDef` / `curve.ts`;
  - dungeon generation;
  - `PEDESTALS_ON` (it stays false);
  - `fireSlot` / `__fire`.
- **The core's code draws no `Math.random`.** Ties break by distance, then by array order. That keeps a cored fight seeded in a check
  the same from step to step, and it keeps the enemies' own draws where K-90F expects them (INV-T3's rule, extended).

---

## 1. Scope

**"builds" on, with a core worn:**
1. **The core replaces the hand and the eye.** With a core worn there is no close strike, no planted shot, no planted brace (blows
   halved while planted), no sightline and no follow-through bank. The four buttons are unchanged.
2. **The core marks bodies.** A mark is a count (0 to the cap, 3) and a life (3 s), drawn as a ring at the body's feet, filled in thirds.
3. **Parts that fit the core spend the marks.** A spend adds **flat damage per mark**: Wake +6 each, Ram +8 each. It is never
   multiplied (by temper, weight, a state's x2 or a push). It uses the marks up. A spend that kills shatters what the marks
   added beyond the HP left.
4. **Temper is flatter**: damage 1 / 1.15 / 1.3, cooldown 1 / 0.92 / 0.85. Area stays 1 / 1.15 / 1.3.
5. **No mastery.** Melting a part past III offers one of the core's 2 upgrades instead (at most 2 a run).
6. **A keystone socket in the core** (one socket): 2 keystones per core, one for packs and one for bosses. A keystone taken swaps out
   the one in the socket.
7. **The hunt**: 0.45 of the elite, Plenty and boss-blue drops are drawn from the core's own parts and keystones. A fitting drop
   shows a glyph on the floor and a fit line on its card. A spender's button shows how many marks it would spend now.
8. **The pick**: two cards at the run's start, before depth 1's first step.

**The switch:**
- A pause switch "builds", key `still-action.builds`.
- **Default:** B1-B4 land with it **off** by default (`=== '1'` is on), so each pushed step leaves his game as it is. **The end of B5
  flips it** to on by default (unset = on, `'0'` = off), the way weight and tap push flipped on 1 Oct. Lead's call: §9.1.
- **What the switch gates:** `coreActive = buildsOn && run.core !== null`. Every effect in this brief keys on `coreActive`, never
  on `buildsOn` alone. So "builds on" with no core worn (a run begun with it off, an old snapshot, a dev boot without `&core=`) is
  today's game exactly, flat temper included.
- **It applies at once.** Flipped during a crawl, and only if the run has a core: the core goes on or off this tick, the worn parts
  are re-tempered with their clocks kept, and the depth logs `coreMixed: true`.
- **Off is today's game exactly** (K-M1): the fight record equal byte for byte, with builds off and with builds on and no core.

**Out of scope:**
- a third core (Sight is the cheap fallback), a mid-run core swap, the late second core after the Arbiter;
- scrap;
- pedestals (they stay off);
- new part models (a reshaped part wears its base part's model);
- the pick card's 2 s looping silhouette, and the "stays home" dim on the card not taken (§8);
- any threat or boss retune (that is the next round, tuned against these builds);
- HANDOVER / DESIGN / PITCHES edits (the lead's).

---

## 2. The rule, in code terms

### 2.1 `src/cores.ts` (new, B1): every number and every word of this trial

It has no three.js. It may import types from `abilities.ts`, `still.ts`, `states.ts`, and `HAND` from `combat.ts` (type-only where possible;
if importing `HAND` makes a cycle, copy `2.9` with a comment that it is `HAND.range`).

```ts
export type CoreId = 'wake' | 'ram'
export const CORE_IDS: readonly CoreId[] = ['wake', 'ram']

/** A part's job for one core. spend: cashes marks on every body it hits. shape: moves bodies or holds them. guard: protects. */
export type FitRole = 'spend' | 'shape' | 'guard'
/** `slams` (Ram only): this part's own knock runs Ram's slam test (§2.6). */
export interface Fit { role: FitRole; slams?: true }

/** The two cores. INV: K is flat damage per mark, added after every multiplier (§2.2). */
export const CORES = {
  wake: {
    /** Flat damage a spend adds per mark. Sim: build-sim.mjs DRIVES.wake.K (proposed). */
    K: 6, cap: 3, lifeS: 3,
    /** A skim: an awake body whose EDGE is within `radius` of Still while he moves sideways to it (§2.5). */
    radius: 1.6, sideCos: Math.SQRT1_2, minSpeed: 1, perBodyS: 1,
    /** What a skim deals (x BOSS_AUTO_MUL on a boss, like any auto). "Wake kills nothing on its own." */
    damage: 4,
  },
  ram: {
    /** 8, not the sim's untested 6-10: the scratch run in §7 R2 (boss c1 +32%, deep c3 +15% at 0.4 slams a shove). */
    K: 8, cap: 3, lifeS: 3,
    /** The shove: the nearest awake body in `reach` (HAND.range), every `beatS` (AUTO_INTERVAL), `shove` u x its knockMul, away from Still. */
    reach: 2.9, beatS: 0.62, shove: 1.5, damage: 6,
    /** A body ending within this of another body's edge along the shove is a body slam. `shortEps` is Clamp Toss's (combat.ts grab). */
    bodyPad: 0.1, shortEps: 0.05,
  },
} as const satisfies Record<CoreId, { K: number; cap: number; lifeS: number }>

export type KeystoneId = 'ram-domino' | 'ram-catch' | 'wake-burst' | 'wake-deep'
export interface KeystoneDef { id: KeystoneId; core: CoreId; for: 'packs' | 'bosses' }
export const KEYSTONES: Record<KeystoneId, KeystoneDef & Record<string, unknown>> = {
  /** Packs. A body shoved into another shoves that one `shove` u on; if it ends on a wall or a body it is slammed too. At most `links`. */
  'ram-domino': { id: 'ram-domino', core: 'ram', for: 'packs', links: 2, shove: 1.0 },
  /** Bosses (Breaker's catch, kept here). The shove also fires the moment something in reach starts a tell, at most once a `icdS`. */
  'ram-catch': { id: 'ram-catch', core: 'ram', for: 'bosses', icdS: 1.0 },
  /** Packs. A skim that fills a body to its cap spends every mark at once: round(share x n x K), a core hit. */
  'wake-burst': { id: 'wake-burst', core: 'wake', for: 'packs', share: 0.6 },
  /** Bosses. Marks hold more and last longer: cap 5, life 4 s (the ring fills in fifths). */
  'wake-deep': { id: 'wake-deep', core: 'wake', for: 'bosses', cap: 5, lifeS: 4 },
}

export type UpgradeId = 'ram-wide' | 'ram-rubble' | 'wake-spray' | 'wake-slip'
/** From melting past III, at most 2 a run (one of each). Each must change what he sees on the floor, not only a number. */
export const UPGRADES: Record<UpgradeId, { id: UpgradeId; core: CoreId } & Record<string, unknown>> = {
  /** The shove takes the nearest `bodies` in reach each beat, not one: two bodies move. */
  'ram-wide': { id: 'ram-wide', core: 'ram', bodies: 2 },
  /** A wall slam throws rubble: every other awake body within `radius` of the impact takes `damage` and `marks` mark. A dust burst at the wall. */
  'ram-rubble': { id: 'ram-rubble', core: 'ram', radius: 1.2, damage: 4, marks: 1 },
  /** A skim sprays on: the nearest other body within `reach` of the skimmed one, further from Still, is marked too. A cold spray between them. */
  'wake-spray': { id: 'wake-spray', core: 'wake', reach: 1.5, marks: 1 },
  /** Each skim adds `perSkimS` of walk speed x `mul`, up to `maxS` banked. A cold streak at his heels while it runs. */
  'wake-slip': { id: 'wake-slip', core: 'wake', perSkimS: 0.25, maxS: 1, mul: 1.15 },
}

/** The hunt (§2.9). `sources`: the drops the filter may replace. A keystone's weight against 1 for each part, in a filtered draw. */
export const FILTER = { share: 0.45, keyWeight: 1, sources: ['elite', 'plenty', 'boss-blue'] as const }

/** The look (§2.10). */
export const RING = { minR: 0.45, perRadius: 1.2, gapDeg: 10, maxBodies: 48, drainS: 0.12, fadeS: 0.5 }
/** The button (§2.9). The count is refreshed at most every `refreshS` of game time, shown up to `showMax`, pulses at `pulseAt`. */
export const SPEND_HUD = { refreshS: 0.1, showMax: 9, pulseAt: 3 }

/** PLACEHOLDER, every one: Adrian's words. */
export const WORDS = {
  switch: 'builds',
  core: { wake: 'Wake', ram: 'Ram' },
  /** The pick card: the left thumb, then what it leaves on bodies (the translator's lines). */
  thumb: { wake: 'Pass beside them.', ram: 'Put them against something.' },
  leaves: { wake: 'What you pass beside is rimed.', ram: 'What hits a wall or a body is slammed.' },
  mark: { wake: 'rimed', ram: 'slammed' },
  pickTitle: 'Choose a core', pickIntro: 'One way to fight, for the whole run.',
  keystone: { 'ram-domino': ['Domino', 'A slammed body slams what it hits.'], 'ram-catch': ['Catch', 'The shove fires the moment something in reach winds up.'],
    'wake-burst': ['Burst', 'The third ring breaks the body open on its own.'], 'wake-deep': ['Deep Frost', 'Rings hold five and last longer.'] },
  upgrade: { 'ram-wide': ['Wide Shove', 'Shoves the two nearest.'], 'ram-rubble': ['Rubble', 'A wall slam throws stone at whoever is near.'],
    'wake-spray': ['Spray', 'Rime carries to the one behind.'], 'wake-slip': ['Slipstream', 'Every pass speeds you up a little.'] },
  /** Shapers' and guards' fit lines; a spender's is built: `spends ${mark}: +${K} each`. */
  fitLine: { 'backdraft-vent': 'pulls them together, so a shove slams two', kickstart: 'runs them into walls', brace: 'holds your ground',
    'signal-flare': 'rimes what will not come to you', 'spring-heels': 'over a wall, they string out after you', ward: 'covers the pass' },
  readout: (made: number, spent: number) => `marked ${made} · spent ${spent}`,
  spendCaption: 'tap · spend them',
}

/** `def` as worn under `core`: the reshaped part (VARIANTS) or `def` itself. Pure, memoized per (core, def object), idempotent. */
export function variant(def: AbilityDef, core: CoreId | null): AbilityDef
/** The marks this core's every body can hold, and their life, with the socketed keystone. */
export function markCap(core: CoreId, key: KeystoneId | null): number
export function markLife(core: CoreId, key: KeystoneId | null): number
/** A part's fit for a core, or null (plain). */
export const fitOf = (def: Pick<AbilityDef, 'fits'>, core: CoreId | null): Fit | null => (core && def.fits?.[core]) || null
```

**The reshapes** (`VARIANTS`), applied only while that core is worn. The id, slot, tier, drops, key and `fits` stay the base part's.
Off, or under the other core, `variant(def, c) === def`. Numbers are PLACEHOLDER, for the balancer to price:

| base id | under | becomes (PLACEHOLDER name) | shape and numbers | new `Mod` |
|---|---|---|---|---|
| `frayed-cleaver` | wake | Backhand | arc, damage 16, range 3.1, cone 120, cooldown 2600, no fray | `{ kind: 'behind' }`: the target is the nearest body within ±75° of straight behind him (behind = against the stick, or against his facing when the stick rests); the swing centres on it. Nothing behind: a whiff behind |
| `frost-trail` | wake | Skate | dash, damage 10, radius 1.0, range 5.6, travelMs 420, shove 0.6, cooldown 7000, no strip, no `sets` | none: a plain run-over dash, slower than Kickstart |
| `signal-flare` | wake | Frost Flare | lob, damage 10, range 11, radius 2.2, travelMs 800, cooldown 5000, no `sets` | `{ kind: 'rime'; marks: 2; slowMul: 0.5; slowMs: 2000 }`: every body in the blast gets `marks` Wake marks and `applySlow(e, 2, 0.5)` |

Each variant also carries a PLACEHOLDER `line` and an `icon` (Backhand: Frayed's 90° icon mirrored; the others keep theirs).
`temperMod`'s `default` returns the two new mods as they are, which is right: neither carries a damage number.

### 2.2 The marks (B1)

**Data.** `EnemyStatus` (`parts.ts`) gains one field, set in `statusFor` (`combat.ts`):
```ts
/** Core marks (design/buildlayer/BUILD.md §2.2): a count, not a StateId. `n` 0..cap; `t` seconds left (0 with n 0);
 *  `since`: combat time the stack's first mark landed (for the log's lag). INV: n === 0 <=> t === 0. */
marks: { n: number; t: number; since: number }
```
Marks are **not** a `StateId`. The old states (`chilled`, `marked`, `STATE`, `stateMul`, `MUL_CAP` x2, `pairWith`) stay exactly as they are,
for every part that sets or pays them today, worn with or without a core.

**Combat** (`combat.ts`), new fields: `core: CoreId | null = null`, `keystone: KeystoneId | null = null`, `upgrades: ReadonlySet<UpgradeId> = new Set()`.
Main sets all three (§2.4). New methods:
- `addMarks(e, n, by: 'core' | SlotName)`: if `!this.core || e.dead` return. `m.n = min(cap, m.n + n)`; `m.t = life`; on a fresh stack
  `m.since = this.time`. Emits `onPart({ kind: 'mark', enemy: e, n: m.n, by, fresh })` with the number actually added (0 at cap: still a
  refresh, still emitted with `added: 0`).
- In `tickStatus`: `if (m.t > 0 && (m.t -= dt) <= 0)` → emit `{ kind: 'markExpired', enemy: e, n: m.n }`, then `n = 0, t = 0`.

**The spend, in `hitPart`** (the only path; every part hit passes it):
```ts
const fit = this.core && 'fits' in payer ? fitOf(payer as AbilityDef, this.core) : null
const m = st?.marks
const n = fit?.role === 'spend' && m && m.n > 0 ? m.n : 0
const bonus = n * CORES[this.core!].K          // flat, after everything: never x temper, weight, stateMul or a push
const d = damage * mul + bonus                  // `damage` arrives weighed and tempered; `mul` is today's state pay (<= MUL_CAP)
...
if (n) { lag = this.time - m.since; m.n = 0; m.t = 0; emit { kind: 'spend', enemy: e, n, bonus, payer: payer.slot, killed, lagS: lag } }
// shatter: today's rule when a state paid (excess = -e.hp); when only marks paid, what the marks added beyond the HP left
if (killed && (used || n)) this.shatter(e, used ? -e.hp : Math.min(bonus, -e.hp))
```
- `Payer` (`states.ts`) widens to `Pick<AbilityDef, 'slot' | 'pays' | 'fits'>` (optional `fits`). `MIRROR` has none: a reflected shot spends nothing.
- `maxMul` keeps logging `mul` only. A spend never raises it.
- A boss takes the full bonus. `BOSS_AUTO_MUL` is the autos' alone, and the core's own hits are autos.

**Aim.** In `prefer()`, with a core worn and `fit.role === 'spend'`: of the bodies this part reaches, the one with the **most marks**
beats `usual` (ties: the nearest). It keeps today's windup exception, and it runs after the pushed-threat rule, as today. Without a
core, `prefer()` is unchanged.

**The core never pays a state and never spends.** Its hits go through `autoHit(e, dmg, 'core')`. `AutoForm` gains `'core'`;
`onAutoDmg` logs it; `felledBy` is `'auto'`. It never calls `masterHit`, `trigger`, `onHand` or `onEye`.

### 2.3 Flat temper (B1)

`temper.ts`:
```ts
/** The build layer's flatter table (design/buildlayer/PITCHES.md): used only while a core is worn. Area is TEMPER.area in both. */
export const TEMPER_FLAT = { damage: [1, 1.15, 1.3], cooldown: [1, 0.92, 0.85] } as const
export function tempered(base: AbilityDef, rank: number, flat = false): AbilityDef   // flat picks TEMPER_FLAT's damage and cooldown
```
- An explicit parameter, not a module switch: `tempered()` stays pure. Every existing caller passes nothing and is unchanged.
- **Main has one way to build a worn def:**
  `asWorn(base, rank) = tempered(variant(base, coreNow()), rank, coreActive())`. It is used at `takePart`, `meltPart`, the swap's
  `swapRank` landing, `resumeRun` and `applyBuilds`. Grep for `tempered(` in `main.ts` after B1: every call site is `asWorn` or a DEV hook.
- `temperFlat` is logged per depth (§2.11).
- B0's temper-table assertion gains `TEMPER_FLAT` (both arrays exact) in B1.

### 2.4 The switch, `run.core`, the gate (B1)

**The switch** in `main.ts`, built like "weight" (`pause.setSwitch('weight', …)`), after tap push's:
- B1-B4: `buildsOn = localStorage.getItem(BUILDS_KEY) === '1'`. The end of B5: `!== '0'`.
- On a flip: `buildsOn = on`; if `run.phase === 'crawl' && run.core && (combat.core !== null) !== on` → `applyBuilds()` and `st.coreMixed = true`.
- `applyBuilds()`, called at every level entry (beside `applyWeight`), on a flip, at the pick and on resume:
  ```ts
  combat.core = coreActive() ? run.core : null
  combat.keystone = coreActive() ? run.keystone : null
  combat.upgrades = coreActive() ? new Set(run.upgrades) : new Set()
  combat.mastery = coreActive() ? EMPTY : run.mastery          // no mastery with a core
  for each worn slot: hud.equip(asWorn(byId(id), run.ranks[slot] ?? 1))   // equip keeps each button's cooldown fraction
  partFx / markFx: set the ring look for the core (§2.10)
  ```
- `run` gains `core: CoreId | null`, `keystone: KeystoneId | null`, `upgrades: UpgradeId[]`, and `corePick` (§2.11). `startRun` resets them.

**In `Combat.update`'s auto block:** `if (this.core) this.tickCore(dt, player) else { …today's block, untouched… }`. With a core:
- `get inStance()` returns false (`this.eye && this.core === null && this.stillT >= EYE.settle`). That one line removes the planted brace
  (`hurtPlayer`), the eye's head-part aim (`eyeAim`), the sightline and `ctx.planted` (so no sentinel ducks from a planted Still).
- `eyeTarget` is null. The follow-through bank is never spent or filled (`useAbility`'s bank line also tests `!this.core`).
- With `core === null` nothing new runs, and no new event is emitted. That is K-M1's guarantee by construction.

**Dev boot.** `?core=wake|ram` is read where `DEPTH_PARAM` is read, and only for a `?depth=` boot. It sets `run.core` at `startRun`
and needs no switch. A `?depth=` boot never shows the pick. Without `&core=` a dev boot is bare. So every existing suite stays bare.

**DEV hooks** (inside `if (import.meta.env.DEV)`):
- `__builds(on?)`: like `__weight`.
- `__core(id | null)`: sets `run.core` and calls `applyBuilds()`. It forces `buildsOn` true for the page.
- `__keystone(id | null)`, `__upgrade(id)`.
- `__coreMarks()`: `[{ i, kind, x, z, n, t }]` for every body with marks.
- `__setMarks(i, n)`: marks body `i` of `__combat.enemies`, by 'core'.
- `__spendCount(slot)`: the button's number (§2.9).
- `__shoveLog()`: Ram's per-shove records since the last call (§2.6).

### 2.5 Wake (B2)

`tickCore` with `core === 'wake'`, every tick, in the auto block's place:
```ts
const v = this.playerVel; const sp = Math.hypot(v.x, v.z)
if (sp < W.minSpeed) return                          // standing (or barely moving) does nothing at all
for (const e of this.enemies) {
  if (e.dead || !targetable(e) || this.held.has(e) || !this.awakeNow(e)) continue
  const dx = e.pos.x - p.x, dz = e.pos.z - p.z, d = Math.hypot(dx, dz) || 1
  if (d - e.radius > W.radius) continue                // edge within 1.6 u
  const cos = (v.x * dx + v.z * dz) / (sp * d)
  if (Math.abs(cos) > W.sideCos) continue              // beside, not behind: 45-135 deg only. Straight away AND straight at both mark nothing
  if (this.time - (this.lastSkim.get(e) ?? -Infinity) < W.perBodyS) continue   // once per body per second
  this.lastSkim.set(e, this.time)
  this.autoHit(e, W.damage, 'core'); this.addMarks(e, 1, 'core'); emit { kind: 'skim', enemy: e }
  // keystones and upgrades: §2.7
}
```
- `playerVel` is his real velocity (dashes included). So Skate's glide and Spring Heels' vault skim what they pass beside.
- **The kiting rule** ("beside, not behind", PITCHES): running straight away from a chaser marks nothing. Running straight at one doesn't
  either: that is the same test (`|cos|`). The pay is only for cutting across the danger.
- `lastSkim` is a `WeakMap<Enemy, number>`, cleared in `reset()`.
- **Spenders** (§4): Backhand, Skate, Scrap Cleaver. Every Wake spender is close.
- **The skim's look:** one frost mote at the body's near side (`vfx.frost(…, 1, …)`), counted against `MOTES_MAX`. The ring (§2.10) is the read.

### 2.6 Ram (B3)

`tickCore` with `core === 'ram'`, on its own beat (`this.autoTimer`, as the hand's; it waits spent until a target exists, so the first
body into reach is shoved at once):
```ts
const t = this.ramTarget(player)            // handTarget's rule at RAM.reach: nearest awake, targetable, not held, inReach, not shaded
if (!t || this.retreating(player, t)) return   // KEPT from the hand: no shove at what he is backing away from
this.autoTimer = R.beatS
this.shove(t, player, 'beat')               // with ram-wide: also the next nearest in reach (UPGRADES)
```
**`shove(e, from, why)`**, the one function for the beat, Catch, Domino and Piston/Kickstart's knocks:
1. `dir` = unit vector from Still (or the pusher) to `e`. `dist = R.shove * e.knockMul` (Piston: its def's shove; Kickstart: its run-over shove).
2. **Immovable**: `isBoss(e) || anchored(e) || e.knockMul < 0.1` (the Assembler's "too heavy to lift"). It is **slammed** (`'still'`):
   1 mark, no movement. "A boss can't be moved, so every shove on one slams."
3. **In a tell**: `e.phase === 'windup' || e.phase === 'strike' || (e.tellIn?.() ?? null) !== null`. **It is not moved, and its tell is
   not touched.** The slam test runs from where it stands (step 4 without the slide). If the test hits a wall or a body, it is slammed
   in place (`'tell'`). (Free defence rule 1, below.)
4. **The slam test.** `end = terrain.clampMove(e.pos.x, e.pos.z, e.pos.x + dir.x * dist, e.pos.z + dir.z * dist, e.radius)`. This is
   Clamp Toss's exact wall test. Extract it from the `grab` branch into `private throwEnd(e, dx, dz, dist): { end, short }`, with
   `short = moved < dist - R.shortEps`, and call it from both (K-90F proves the refactor). Then:
   - **body**: the first other awake body `o` (not held, not dead) whose centre lies within `e.radius + o.radius + R.bodyPad` of the
     segment `e.pos → end`, nearest along it. Both are slammed (`'body'`): +1 mark each. `o` is not moved (except by Domino);
   - else **wall**: `short` → slammed (`'wall'`), +1 mark;
   - else a plain shove: no mark.
5. Unless step 2 or 3 held it: `this.shoveFrom(e, from.x, from.z, raw)`, where `raw` is the distance before `knockMul` (`RAM.shove`,
   or the part's own shove). `shoveFrom` applies `knockMul` itself, so the slide is exactly the `dist` the test used.
6. The beat's hit: `autoHit(e, R.damage, 'core')` (a Piston or Kickstart knock deals its own part damage instead, through `hitPart`, so
   it spends first and then marks).
7. Emit `{ kind: 'shove', enemy: e, slam: 'wall' | 'body' | 'still' | 'tell' | null, other?, why }`, and push the same record to `__shoveLog`.

**Piston and Kickstart** (`fits.ram.slams`): with Ram worn, their own knock calls `shove(e, o, 'part')` with their distance in place of
`shoveFrom`. Piston spends the body's marks (its hit), then its 4.0 u knock may slam it again: that is how "the punched body flies into
the next one". No other part's knock runs the test (a Pressure Vent's 4.2 u shove stays a plain shove: it is not Ram's part).

**The look:** today's hand sweep (`this.sweep(player, aim, d, 0x8fb8e8, 0.4)`) for every shove. A slam adds a crack burst at the contact
point (a short cold ring, `this.ring(at, 0.2, 0.7, 0.2, COLD)`, plus 4 sparks, cold only) and a dry knock (`audio.ts` `slam()`, 400 Hz-1 kHz,
`heard('slam')`). No new emitter per body.

**The core never breaks a windup.** Today's hand breaks a breakable windup (`breakable(close, true)`). Ram's beat doesn't, and nor does
Wake. Breaking stays the job of parts and pushes. That gives the push a clear job, and it is free defence rule 1's other half.

**Free defence** (the verifier's objection: a shove every beat keeps everything off him). Four rules and a measured line:
1. **A body in its tell is never moved and never cancelled** (step 3). The blow that started lands where it was aimed. The shove can
   never be a dodge.
2. **No shove at what he is backing away from** (the hand's retreat rule, kept). Shove-and-run gives nothing.
3. **The distance is small against the walk:** 1.5 u. A hulk walks 4.3 u/s, so it is back in 0.35 s of a 0.62 s beat (translator).
4. **No brace with a core** (§2.4). Holding ground no longer halves blows.
5. **The line, headless (K-M17):** three pressure hulks round a standing Still, seeds 1-5, 20 s. HP lost with Ram must be
   **>= 0.75x** HP lost with a core that never touches them (Wake standing, which does nothing). Fail = the shove is free defence.
   The dials, in order: `RAM.shove` 1.5 → 1.2, then rule 3 widened to "a body within its own strike reach is not moved".
6. **The line, from his runs (B6):** Ram runs' `hpLost` d1-3 >= 0.75 x TRIAL-1's 130 (98).

### 2.7 Keystones and upgrades, what they do (B2 for Wake's, B3 for Ram's)

All of them read `combat.keystone` / `combat.upgrades`. The socket and the offers come in B5. Until then, `__keystone` / `__upgrade`.

| id | where in code | rule |
|---|---|---|
| `wake-burst` | `tickCore` wake, after `addMarks` | if `m.n === cap` after the skim: `dmg = round(0.6 * m.n * K)` (11 at 3), `autoHit(e, dmg, 'core')`, the marks are spent (`spend` event with `payer: 'core'`, counted in `marks.spent`), a cold pop |
| `wake-deep` | `markCap` / `markLife` | cap 5, life 4 s; the ring has 5 segments |
| `wake-spray` | after a skim on `e` | the nearest other awake body within 1.5 u of `e` and further from Still than `e`: +1 mark (`by: 'core'`), a cold spray line between them (one `vfx.trail` segment) |
| `wake-slip` | after a skim; main's movement | `combat.slipS = min(1, slipS + 0.25)`; it drains in real fight time; main multiplies Still's walk speed by 1.15 while `slipS > 0`; a cold streak at his heels (`vfx.trail` at the feet each tick while it runs) |
| `ram-domino` | `shove`, on a `'body'` slam | `o` is shoved 1.0 u along `dir` through the same test (steps 3-5); if it slams, +1 on it and its partner; at most 2 links a shove; logged `chained` |
| `ram-catch` | `Combat.update`, after the enemies | a body in `RAM.reach` whose tell starts this tick (phase → `'windup'`, or `tellIn()` null → number; a `WeakMap` of last tick's) and `time - lastCatch >= 1.0`: `shove(e, player, 'catch')` (it is in its tell, so step 3: never moved, never cancelled, slammed if something is behind it; a boss always), then `autoTimer = RAM.beatS`. Logged `caught` |
| `ram-wide` | the beat | the two nearest in reach, both shoved |
| `ram-rubble` | `shove`, on a `'wall'` slam | every other awake body within 1.2 u of `end`: `autoHit(o, 4, 'core')`, +1 mark; a dust burst (`vfx.embers` is ember-coloured: use cold dust, `vfx.frost` or grey sparks, never light orange) |

### 2.8 The pick, the save, resume (B4)

**Where it shows:** in `startRun()`, after `enterLevel(START_DEPTH)`, before he can move: if `buildsOn && !run.dev`, `offerCore('start')`.
- `offerCore` calls `openPause()` and then `pause.pickCore(cards, onPick)`. That is a new screen, built like `choose()`: two big cards side by
  side and no back button. Each card has the core's name, its `thumb` line and its `leaves` line (§2.1 WORDS). The world waits.
- `onPick(id)`: `run.core = id`, `run.corePick = { at, offered: ['wake', 'ram'], took: id, s }` (s = real seconds on the screen),
  `applyBuilds()`, `resume()`, `writeSnapshot()`, the banner `WORDS.core[id]`.
- The cards are always in the order Wake, Ram. There is no reroll and nothing random.

**The save.** No version bump (`Save.v` stays 3, `RunSnapshot.s` stays 1). `RunSnapshot` gains three optional fields:
```ts
/** The build layer (BUILD.md): the core picked at the run's start. Absent: a bare run (picked nothing, or begun with "builds" off). */
core?: string
/** The core's socket. Absent: empty. Dropped on resume unless KEYSTONES[id].core === core. */
keystone?: string
/** Core upgrades learned (UPGRADES ids). Absent: none. Filtered the same way. */
upgrades?: string[]
```
`writeSnapshot` writes each only when set, the way `mastery` and `ranks` are written. The marks, `lastSkim`, `slipS` and the beat live
in combat only: a resume starts the depth clean, as today.

**Resume (`resumeRun`):**
- `run.core = snap.core in CORES ? snap.core : null`. Keystone and upgrades are filtered to that core. Then `applyBuilds()` (so the
  loadout comes back re-tempered by `asWorn`, flat while the core is active).
- **Depth 1 with no core, builds on, boss not felled** (he reloaded on the pick screen, or the run began with the switch off):
  `offerCore('resume')`. It is still the run's start: nothing has been fought.
- **Depth >= 2 with no core** (the one run in progress on the day this ships, or a run begun with builds off): **it resumes bare and
  stays bare. No offer at the next beam.** This overturns 2-verifier §3's "offer at the next beam", for three reasons:
  - at most one such run exists;
  - its d1-dN parts were picked for the hand and the eye;
  - a mid-run core would make every "formed by the Assembler" line in its log meaningless.
  It logs `core: null`, so it is left out of the trial's numbers by construction.

**A switch flip mid-run:** §1. `coreMixed` is logged only when the flip changed the fight (the run has a core).

**Mastery off with a core:** in `meltLabel`, at III and `coreActive()`, return the upgrade label (B5) or null. Never the mastery label.
`masteryForm` reads a table (B1, §3.3), not `lean`.

**`lib.mjs` (B4):** a `CORE=wake|ram` env appends `&core=…` to every `?depth=` query, so any suite runs cored, report only (the way
`WEIGHT=0` runs the old game). A check that boots without `?depth=` (k9's K-9C) answers the pick with `__core('wake')` or a click on the
first card. Report which checks needed it.

### 2.9 The hunt and the HUD (B5)

**The drop filter** (`drops.ts`, so `tools/dropsim.ts` reads the live value; B0 moves `PEDESTALS_ON` there too):
```ts
/**
 * With a core worn: at an elite, Plenty or boss-blue drop, FILTER.share of the time the part comes from the core's own pool.
 * The pool is every part with fits[core] and every keystone of that core, minus what is worn, socketed, on the floor or turned to the
 * wall. A keystone weighs FILTER.keyWeight against 1 for each part. Found or not does not matter: a core's own parts are always in
 * reach. Null (an empty pool, or the roll missed): rollPart as today. Gold (boss-gold), kills and crates are never filtered.
 */
export function rollForCore(core: CoreId | null, source: DropSource, taken: readonly AbilityDef[], keys: { socketed: KeystoneId | null; onFloor: readonly KeystoneId[] }, pool: PoolView): AbilityDef | KeystoneDef | null
```
Main calls it at the three sites (`maybeDrop` for an elite, Plenty's drop, the boss's blue). A `KeystoneDef` result goes to `loot.dropKey`.

**Keystones on the floor** (`loot.ts`): a separate list, so nothing that reads `GroundPart.def` (melts, the thief, the compare card,
`partModel`) ever sees one.
- `Loot.keys: GroundKey[]`, holding `{ key, pos, group, fly, from, bob, seen }`.
- `dropKey(k, at, toward)`: a gold beam (TIER_COLOR.gold), a small cold torus as its model, the core's ring glyph on the disc.
- `removeKey`; `clear()` clears both lists.
- The thief never wants one. `clearLoot` logs any keystone still lying as `'left'`.

**The socket card** (`pause.socket(current, incoming, core, onTake, onLeave)`): walking within `LOOT.pickupRadius` of a keystone not yet
seen opens it, and the world waits. It shows the core's name, the socket now (or empty) → the incoming keystone, each with its words and
its `for: packs / bosses` tag, and "you lose: {current}" when one is socketed.
- **take**: `run.keystone = id`, `applyBuilds()`, and the one given up is dropped at his feet as a `GroundKey` (it can be taken back on this floor).
- **leave**: it stays, `seen`. Walking off and back reopens it (the `offerHeld` rule).
- Add the card to `screens.mjs`.

**The upgrade at III** (`meltPart` → `upgradeWith`, mastery's twin):
- With `coreActive()`, melting into a part at III, and fewer than 2 upgrades learned: `pause.choose` with the core's upgrades not yet
  learned (2 cards the first time, 1 the second), title `${WORDS.core[c]} · upgrade` (PLACEHOLDER).
- The pick: `run.upgrades.push(id)`, `applyBuilds()`, `st.melts++`, `st.upgraded = [...]`, the banner.
- At 2 learned: `meltLabel` returns null (as mastery at MASTERY_MAX).

**The cards say the fit** (with `coreActive()` only; off, nothing new shows):
- `pause.compare`'s `o` and `hud.offer`'s `o` gain `fit?: string`: `fitWords(def)`.
  - spend: `fits ${WORDS.core[c]} · spends ${WORDS.mark[c]}: +${K} each`;
  - shape / guard: `fits ${WORDS.core[c]} · ${WORDS.fitLine[id]}`;
  - plain: absent.
- The card's def is `variant(def, core)` (`pause.setShown` composes `variant` before `weighed`), so a reshaped part shows its reshaped
  name, line and numbers.
- **The floor glyph:** `loot.drop(def, at, toward, owed, fit = false)`. A fitting drop's disc gets a second thin cold ring that breathes
  slowly. A plain drop has none. The glyph is decided at the drop, from the worn core.

**The button's number** (`hud.ts`, a new rim span `.spend`, beside `.scue`; never over `.lbl` or `.pips`):
- `hud.spendCue(slot, n: number | null)`. Null hides it (not a spender, or no core).
  - n = 0: dim. n >= 1: cold-lit, the digit (9 at most).
  - n >= 3 and the button ready: the class `spend3` (a slow cold pulse).
  - n >= 3 and cooling: `spendcue` (the push cue's lit rim). The first time, a caption once per save (`WORDS.spendCaption`, a new hint key).
- Main computes n with `combat.spendCount(def, still.pos, steer)` at most every `SPEND_HUD.refreshS` of game time (not every frame), for
  each worn spender.
- **`spendCount` must be honest:** the marks the cast would spend if fired now. It uses the cast's own target and hit test:
  - **bolt, lob, grab and an arc's snap**: the target `prefer()` picks;
  - **an arc's sweep**: the cone test, extracted from the `arc` branch into `private inArc(o, aim, def, e)` and called from both (K-90F
    proves the refactor);
  - **nova**: `inBlast`;
  - **a lob's blast**: its radius at the target;
  - **a dash**: the bodies within `radius + e.radius` of the path from Still along `steer` (the stick, else facing) for `range`, the run-over the cast would do.
- K-M27 holds it to the exact number in five setups.

**The pause readout:** under the loadout, with `coreActive()`, one block:
- the core's name;
- the socket (keystone name, or "empty");
- the upgrades;
- `WORDS.readout(st.marks.made, st.marks.spent)` for the open depth.

It is a new `pause.setCore(fn)`, beside `setLearned`, which shows nothing with a core (no mastery).

**The spend's look and sound** (B2 for the look, since the rings come with Wake):
- On a spend, the body's rings drain into the hit (each segment scales to 0 over `RING.drainS`).
- `audio.ts` `spend(n)`: n short cold ticks rising a semitone each, inside 0.15 s, so a 6-spend sounds bigger than a 2-spend. `heard('spend:' + n)`.
- Marks that expire unspent: the ring fades over `RING.fadeS`, with a faint fizzle (`audio.ts` `fizzle()`, -18 dB, `heard('fizzle')`).
  Whether it helps or nags is his phone call (§9).

**Default on:** the last line of B5 flips `buildsOn` to `!== '0'`, and `lib.mjs` pins `still-action.builds` the way B0 pins weight
(unset → the live default). Bare dev boots are unaffected either way (`coreActive` needs a core).

### 2.10 The rings, and the frame budget

`src/markfx.ts` (new, B2), drawn after `partFx` each rendered frame:
- **One `InstancedMesh` per ring segment**: 3 (5 under Deep), each with `RING.maxBodies` (48) instances. One shared additive
  `MeshBasicMaterial` (`depthWrite: false`, `fog: false`) with `instanceColor` for the fade.
- Segment geometry is built once per (core, cap) at `applyBuilds`:
  - an arc of `360/cap - gapDeg` degrees;
  - **Wake** frost: a plain soft ring, inner 0.86;
  - **Ram** cracked: inner 0.8, with two notches cut in each arc's inner edge.
  - Colour COLD (Ram COLD_DEEP), never light orange.
- Each frame:
  - for every body with `marks.n > 0` (iterate `combat.statuses()`), segment i < n gets a matrix at the feet (`DECAL_Y + 0.02`, radius
    `max(RING.minR, e.radius * RING.perRadius)`);
  - the last `RING.fadeS` of life dims it through `instanceColor`;
  - set each mesh's `count`, and `instanceMatrix.needsUpdate` / `instanceColor.needsUpdate` once.
  - Draining bodies (a spend's last 0.12 s) draw in the same meshes.
  - Past 48 marked bodies, the farthest from Still go undrawn. Their marks still count.
- **Budget:**
  - draw calls added = the segment count (3, or 5), whatever the number of bodies;
  - no Mesh, geometry or material created after `applyBuilds`;
  - `drawMarks` with 40 bodies at 3 marks: median <= 0.25 ms on the check machine (a phone is ~4x slower: ~1 ms of a 16.7 ms frame);
  - `spendCount` at most 10 Hz;
  - Wake's skim loop is O(bodies) per tick, with no allocation (reuse vectors; `lastSkim` is a WeakMap).
  K-M30 pins these. The phone number is his: the perf readout (`src/perf.ts`, DEV only, LAN dev server at home) in a d5 big room,
  Wake vs bare.

### 2.11 The log (B1 adds the fields, B2-B5 fill them)

Always logged, on or off, per depth (`DepthStats`, set in `enterLevel`'s push). Reuse what exists: `fightS`, `fights`, `hpLost`,
`kills`, `autoDmg` / `autoDmgReal` (gain `core`), `states`, `paidBy`, `shatter`, `melts`, the drop records.

| field | what | for |
|---|---|---|
| `core` | `combat.core` at entry (null: bare) | reading runs apart |
| `coreMixed?` | `true` only on a depth where the switch flip changed the fight | leave the depth out |
| `temperFlat` | `coreActive()` at entry | which temper table |
| `keystone`, `upgrades` | at entry; `upgraded?` learned here | the late want |
| `movingS` | fight seconds with `combat.walking` | Wake >= 70% |
| `nearBins` | fight seconds by distance to the nearest awake body, edges 2 / 3.5 / 6 / 11 u: 5 numbers | posture |
| `nearMovingBins` | the same, only while moving | Wake's kiting line (median <= 3.5 u) |
| `wallS` | fight seconds with `terrain.blocked(x, z, 2)` | Ram's posture |
| `closeS` | fight seconds within 2 u of a wall, or with the nearest awake body within 2 u | Ram >= 50% |
| `marks` | `{ made, byCore, byPart, spent, expired }`: marks added (the number actually added, so 0 at cap counts 0), by whom; spent by spends and Burst; expired unspent | spent / made >= 50% |
| `spends` | `{ hits, bonus, lag: [<=1, <=2, <=4, >4] }`: spending hits, flat damage added, seconds from the stack's first mark | "cashed within 2 s" |
| `spendsPerFight` | one number per fight closed this depth: its spending hits (pushed when `run.fought` goes false, and at depth close) | median >= 1 a pack fight |
| `shoves?` | Ram: `{ n, wall, body, still, tell, plain, chained, caught }` | slams per shove >= 0.4 |
| `skims?` | Wake: `{ n, burst, spray }` | does the skim fire |

**Once a run** (the playtest body, beside `swaps`): `corePick: { at: 'start' | 'resume', offered, took, s } | null`.
**Each drop record** (`DropRec`): `fit?: 'fits' | 'plain' | 'key'` against the worn core (absent with none), `filtered?: true` when the
filter chose it. `partDrops()` keeps keystones under their id.

Spent / made is `marks.spent / marks.made`. Slams per shove is `(wall + body + still + tell) / n`.

---

## 3. What B1 onward needs from B0, and the starting record

### 3.1 From B0
- **The suites on live defaults** (weight and tap push on, `lib.mjs`) and **K-90F re-captured** with them. Every "K-90F equal" below
  compares against B0's new `fights.json`.
- **The rider code cut** (`rider`, `riderLine`, the hud/pause/workshop rider lines, `riders` in the log). B1 cuts `lean` from the same
  sites: start from B0's tree, not from b7b4118.
- **`PEDESTALS_ON` moved into `drops.ts`.** B5's filter sits beside it, so the drop simulator reads both.
- **`tools/dropsim.ts`**: 9 depths, the live drop rules, and its `--core` chooser. B5 adds `FILTER` and the keystones to its pool and
  reads `fits` from the real defs. If B0's `--core` chooser hard-codes a pool, B5 replaces it with `fits`.
- **The temper-table assertion.** B1 adds `TEMPER_FLAT` to it, wherever B0 put it.
- If any of these is not in the tree when B1 starts, stop and report. Don't build around it.

### 3.2 B1's first act
Before any `src/` change, run the whole regression set (§4) and record every line. That is the record "as B0 left it" that every later
step is held to.

### 3.3 The lean cut (B1)
- Before deleting anything, write `tools/checks/baseline/leans.json`: `{ [partId]: 'close' | 'marksman' | null }` from today's defs.
- `mastery.ts` gains `MASTERY_FORM: Record<PartId, MasteryForm | null>` with the same values (close → hand, marksman → eye, none → null).
  `main.ts` `masteryForm` reads it. Off, mastery is offered exactly as today.
- Cut:
  - `Lean`, `lean` on every def, `LEAN_GLYPH`;
  - `leanOf`, `LEAN_MATCH`, `rollPicks`' `lean` / `match` parameters (`LEAN_MATCH` is false, so this is dead code), `rollPart`'s `lean` parameter;
  - `run.lastLean`;
  - the `.plean` spans (`pause.ts` card, `hud.ts` chooser), `workshop.ts`' `lean:` field, and the `.plean` CSS;
  - `still.attack`'s `lean:` (main's `cast()` passes `r.lean`: check what `CastResult.lean` is first. If it is the pose's body lean,
    not the tag, it stays).
- `tools/leancheck.ts` becomes `tools/corecheck.ts` (K-M2's static half).

---

## 4. Steps

**The regression set.** Each step ends with all of it, in order:
- `npx tsc --noEmit -p .` and `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → K-90 and K-90L PASS;
- `node tools/checks/fights.mjs compare` → K-90F PASS;
- `node tools/checks/{autos,lean,tap,k9,area3,home,stagec,screens}.mjs` → as §3.2 recorded;
- `node tools/checks/stageb.mjs` → as recorded (K-W3d, the known Parry finding, may fail; the slow K-T13 only at B4 and B5);
- `npx tsx tools/corecheck.ts` and `npx tsx tools/statecheck.ts`;
- `node tools/checks/builds.mjs <ids so far>`.

Each check a step adds is negative-tested once: break its rule, see it FAIL, restore, and report it. Every step reports every file touched,
every check line verbatim, and the screenshots its row in §6 names.

### B1. Data: the switch, the gate, the marks machine, flat temper, `fits`
- **Touches:**
  - `src/cores.ts` (new: §2.1 entire; `variant` returns `def` for now, VARIANTS empty);
  - `abilities.ts` (`fits` on the parts of §5's table; the `behind` and `rime` Mod types, unused yet);
  - `parts.ts` (`EnemyStatus.marks`; the PartEvent kinds `mark`, `markExpired`, `spend`, `skim`, `shove`);
  - `states.ts` (`Payer` widened);
  - `combat.ts` (`core` / `keystone` / `upgrades`, the gate in the auto block with an empty `tickCore`, `inStance`, `addMarks`, the
    expiry, the spend in `hitPart`, `prefer`'s most-marked rule, `AutoForm 'core'`);
  - `temper.ts` (§2.3);
  - `mastery.ts` (`MASTERY_FORM`);
  - `drops.ts` (the lean cut);
  - `main.ts` (the switch, `run.core` and friends, `applyBuilds`, `asWorn`, `?core=`, the DEV hooks of §2.4, the log fields of §2.11 at
    their zero values, `coreMixed`);
  - `pause.ts`, `hud.ts`, `workshop.ts`, `style.css` (the lean cut);
  - `tools/corecheck.ts`, `tools/checks/builds.mjs` (new, on `suite()`, modelled on lean.mjs);
  - `tools/checks/baseline/leans.json`.
- `builds.mjs`:
  - `RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'`;
  - SETUP: arena, held loop, pinned loadout, `C.breakRule = true`;
  - helpers `tick`, `wall(hp)` (a hulk at hp 1e6), `core(id)`.

**Done when:** the regression set passes (K-90F equal: nothing new runs with no core); K-M1 to K-M5 PASS; `screens.mjs` PASS with the new
switch row (screenshot S12).

### B2. Wake
- **Touches:**
  - `combat.ts` (`tickCore` wake; the `behind` and `rime` mods; Burst, Deep, Spray, Slip);
  - `cores.ts` (VARIANTS for Backhand, Skate, Frost Flare);
  - `src/markfx.ts` (new: §2.10), wired in `main.ts`;
  - `audio.ts` (`spend`, `fizzle`);
  - `main.ts` (Slip's walk speed; the log's `skims`, `marks`, `spends`, `spendsPerFight`, `movingS`, the bins).

**Done when:** the regression set passes; K-M6 to K-M12 and K-M30 PASS; K-M4 PASS again (now with real Wake marks); screenshots S1, S4,
S5a (rings only), S10.

### B3. Ram
- **Touches:**
  - `combat.ts` (`tickCore` ram, `shove`, `throwEnd` extracted from `grab` and used by both, Piston's and Kickstart's knock under Ram,
    the tell rule, Domino, Catch, Wide, Rubble);
  - `markfx.ts` (the cracked look);
  - `audio.ts` (`slam`);
  - `main.ts` (`shoves`, `wallS`, `closeS`).

**Done when:**
- the regression set passes (K-90F equal proves `throwEnd`);
- K-M13 to K-M19 PASS, and **K-M17's ratio is reported with its five seeds**;
- screenshots S2, S3, S11.

### B4. The pick, the save, resume
- **Touches:**
  - `pause.ts` (`pickCore`);
  - `main.ts` (`offerCore`, `startRun`, `writeSnapshot`, `resumeRun`, `meltLabel`'s mastery gate, `corePick`);
  - `save.ts` (the three fields, their doc comments);
  - `lib.mjs` (`CORE=`);
  - `screens.mjs` (the pick screen at four sizes);
  - `builds.mjs` (the bots).

- **His ask (2 Oct): the perf readout on the live build with `?perf=1`.** `main.ts:126` builds it only under `import.meta.env.DEV`;
  make it `import.meta.env.DEV || new URLSearchParams(location.search).has('perf')`. Without the query the live game is unchanged (no
  readout, nothing created). Check what `createReadout` and `perf.ts`'s DEV-only block (line ~118) pull in, so the readout works in a
  production build without dragging in DEV-only hooks; report its frame-cost. The number he reads: Wake vs bare in a d5 big room.

**Done when:**
- the regression set passes, stageb's K-T13 included;
- K-M20 to K-M23 PASS;
- `CORE=wake` and `CORE=ram` runs of `autos`, `lean` and `stagec` are reported (report only: they differ by design);
- screenshot S6.

### B5. The hunt, the HUD, default on
- **Touches:**
  - `drops.ts` (`FILTER`, `rollForCore`);
  - `loot.ts` (`GroundKey`, `dropKey`, the fit ring);
  - `pause.ts` (`socket`, `setCore`, the `fit` line);
  - `hud.ts` (`.spend`, `spendCue`, the `fit` line on the pickup card);
  - `main.ts` (the three drop sites, the socket flow, `upgradeWith`, `spendCount` wiring, the readout, the drop records' `fit` and
    `filtered`, **the default flip**);
  - `combat.ts` (`spendCount`, `inArc` extracted);
  - `style.css`;
  - `tools/dropsim.ts` (`FILTER`, keystones, `fits`);
  - `lib.mjs` (the builds pin);
  - `screens.mjs` (the socket card, the upgrade choose, the readout, a spender button showing 9 plus the pulse, at four sizes).

**Done when:**
- the regression set passes, stageb's K-T13 included;
- K-M24 to K-M29 PASS;
- `npx tsx tools/dropsim.ts --core wake` and `--core ram`, 20000 runs each:
  - committed formed by the Assembler (2+ of the core's parts including a spender, walking into d3's boss) **>= 70%**;
  - a random picker **<= 25%**;
  - own keystone taken **<= 75%** of the times it is seen;
  - own keystone seen by d6, reported;
  - a part taken after d6, reported.
- Fail on formation: raise `FILTER.share` to 0.5 (the round's upper bound) and report. Fail on the keystone line: drop `keyWeight`.
- Screenshots S5, S7, S8, S9.

### B6. His runs
Nothing to build. The lead pushes B5, asks him for 4+ runs, 2+ with each core, and reads the log against §5.3's lines **after his feel**.
If a line fails, the lead decides, using the dials named in §7. No engineer step follows until he has.

**Check assignment** (each K-M id belongs to exactly one introducing step):

| step | checks |
|---|---|
| B1 | K-M1, K-M2, K-M3, K-M4, K-M5 |
| B2 | K-M6, K-M7, K-M8, K-M9, K-M10, K-M11, K-M12, K-M30 |
| B3 | K-M13, K-M14, K-M15, K-M16, K-M17, K-M18, K-M19 |
| B4 | K-M20, K-M21, K-M22, K-M23 |
| B5 | K-M24, K-M25, K-M26, K-M27, K-M28, K-M29 |

---

## 5. The parts, the checks, the pass lines

### 5.1 Who fits which core (`fits` on the def)

Mostly today's parts with a new job. The three reshapes are variants (§2.1), so off they are today's parts. Every other part is plain
under both cores and keeps its job.

| core | slot | part (id) | fit | its job with this core |
|---|---|---|---|---|
| Ram | arms | Piston (`piston`) | spend, slams | spends the slammed body; its 4.0 u knock runs the slam test, so the punched body flies into the next one |
| Ram | arms | Scrap Cleaver (`scrap-cleaver`) | spend | the bridge: spends every body in the swing (a crowd against a wall) |
| Ram | head | Flare (`flare`) | spend | lobs over the front body onto the most-slammed one; spends every body in its 2.0 u blast |
| Ram | torso | Backdraft Vent (`backdraft-vent`) | shape | pulls them to 1.4 u: close enough that the next shove slams two |
| Ram | legs | Kickstart (`kickstart`) | shape, slams | the run-over knock runs the slam test: puts a far one against a wall |
| Ram | torso | Brace (`brace`) | guard | holds ground while the blows come (the brace that planting used to give) |
| Ram | socket | Domino (`ram-domino`), Catch (`ram-catch`) | keystone | packs / bosses |
| Wake | arms | Backhand (`frayed-cleaver`, reshaped) | spend | a swing behind, along his path: no turn needed to cash what he just passed |
| Wake | arms | Scrap Cleaver (`scrap-cleaver`) | spend | the bridge: the turn-back swing |
| Wake | legs | Skate (`frost-trail`, reshaped) | spend | a slow glide through them: spends what it runs over, skims what it passes |
| Wake | head | Frost Flare (`signal-flare`, reshaped) | shape | rimes and slows what won't come to him (a shooter), so a skim can reach it |
| Wake | legs | Spring Heels (`spring-heels`) | shape | the vault: the pack paths round the wall and strings out into a skim lane |
| Wake | torso | Ward (`ward`) | guard | eats shots on the pass |
| Wake | socket | Burst (`wake-burst`), Deep Frost (`wake-deep`) | keystone | packs / bosses |

**What corecheck holds** (K-M2):
- 6 parts a core, over 4 slots;
- spenders in 2+ slots (Ram: arms, head; Wake: arms, legs);
- one bridge (Scrap Cleaver), at most 3;
- 2 keystones a core (one `packs`, one `bosses`) and 2 upgrades;
- 15 of the 30 parts stay plain.
- Of Ram's six, five are in `STARTER_POOL` or found early. Wake's three reshapes are found-pool parts, which is why the filter ignores
  `found` (§2.9, §9.4).

### 5.2 Acceptance checks (`tools/checks/builds.mjs`, plus `tools/corecheck.ts` for K-M2's static half)

**Setup for every check:**
- autos on (the core is the auto) unless stated;
- hulks are pressure bodies at hp 1e6 (`wall`) unless a kill is the point;
- Still at the origin facing +z;
- weight and tap push on (the live defaults);
- `__hold(true)`, so time moves only through `__step`;
- damage expectations are exact integers; times ±1 tick.

- **K-M1 off is today** (a `task`).
  - Spawn `fights.mjs compare`, `autos.mjs`, `k9.mjs`, `lean.mjs` and `tap.mjs`. Each prints what §3.2 recorded.
  - Page part:
    - a fresh context has `still-action.builds` unset and `combat.core === null`;
    - one scripted 30 s fight (F1's setup, seed 1) hashes equal with `__builds(false)` and with `__builds(true)` and no core;
    - `__run.stats.at(-1)` has `core: null` and `temperFlat: false`.
- **K-M2 the data.**
  - corecheck: §5.1's holds; every `fits` key is a `CoreId`; `MASTERY_FORM` deep-equals `leans.json` mapped; no def has a `lean` key;
    `cores.ts` and `tickCore`'s source contain no `Math.random`.
  - `variant`:
    - `variant(d, c) === d` for every non-reshaped part and both cores;
    - `variant(d, null) === d`;
    - idempotent;
    - a reshape keeps id, slot, tier, drops, fits.
- **K-M3 flat temper.**
  - For every part at ranks 2 and 3, `tempered(d, r, true)` equals a table built in the check from `TEMPER_FLAT` and `TEMPER.area`.
  - `tempered(d, r)` deep-equals the B1-start values (pinned in the check).
  - In a page with `__core('wake')` and Scrap Cleaver at III: the worn def's damage is `round(18 × 1.3) = 23`. After `__builds(false)` it
    is 29 (`round(18 × 1.6)`), and the button's `readyAt` is unchanged across the flip.
- **K-M4 the marks machine** (`__core('wake')`, autos off, `__setMarks`).
  - Cap and life:
    - three `__setMarks(i, 1)` then a fourth: n stays 3;
    - each refreshes t to 3.0;
    - `since` is the first one's time;
    - stepped 3.0 s plus a tick: n 0, one `markExpired`.
  - The spend:
    - a ready Scrap Cleaver (Wake: spend) on a `wall` with 3 marks drops its HP by `weighed 22 + 3 × 6 = 40`, and leaves n 0;
    - with 0 marks, 22;
    - a Focusing Lens (plain) on a 3-mark wall: 31 (weighed), marks still 3.
  - Never multiplied:
    - Scrap Cleaver III (flat, 23 → weighed 28) on 3 marks: 28 + 18 = 46, not round(40 × 1.3);
    - a chilled 3-mark wall (Chill Vent set, worn in torso): `22 × 2 + 18 = 62`, `maxMul` 2.
  - Shatter: a 1-HP hulk with 3 marks next to a wall at 1 u: the kill passes `min(18, 22 + 18 - 1)` = 18 to the wall.
  - Off: `__setMarks` does nothing (no core), and the same Cleaver deals 22.
- **K-M5 the switch.**
  - The loadout pause screen shows a switch labelled `builds`. One real click flips it, and localStorage follows.
  - With a core, mid-crawl:
    - `combat.core` flips at once;
    - the open depth logs `coreMixed: true`;
    - `__enter(depth + 1)` logs it absent;
    - flipped twice in a depth: one `coreMixed`, no throw.
  - With no core: a flip changes `combat.core` from null to nothing, and logs no `coreMixed`.
- **K-M6 standing does nothing** (Wake). Three walls at 1.2 u round Still. 3 s with the stick at rest: core damage 0, `marks.made` 0, and
  `autoDmg.hand + autoDmg.eye === 0`.
- **K-M7 the skim** (Wake; Still moved by `__stick` at 5 u/s).
  - Still walks a straight line past 3 walls set 1.2 u to its side, 1.5 u apart. Within 1.5 s, 2+ of them are marked.
  - Back and forth along the same line for 4 s:
    - no body gets two marks less than 1.0 s apart;
    - no body holds more than 3.
- **K-M8 beside, not behind** (Wake).
  - A wall 1.2 u ahead:
    - walking straight at it for 0.5 s: 0 marks;
    - walking straight away from it for 2 s: 0 marks;
    - passing it at 90°: 1.
  - The angle edge, by velocity: 44° off the line to the body: 0; 46°: 1.
  - A body at edge distance 1.65 u: 0; at 1.55 u: 1.
- **K-M9 Wake spends** (marks set by skims, not `__setMarks`).
  - A skim pass marks 3 walls. Then a ready Scrap Cleaver with all three in its cone: each drops by `22 + n × 6` for its own n, and
    every n is 0 after.
  - Skate through 2 marked walls: each drops by `round(10 × 1.8) + n × 6` (legs x1.8 under weight).
  - Backhand: a marked wall behind Still and an unmarked one ahead. The behind one is struck, the one ahead isn't.
- **K-M10 Wake's keystones and upgrades** (`__keystone`, `__upgrade`).
  - Burst: the third skim on a wall deals `4 + round(0.6 × 3 × 6) = 15`, and leaves n 0, with `skims.burst + 1`.
  - Deep: a wall holds 5, and a mark lives 4.0 s; the ring has 5 segments.
  - Spray: a skim on A marks B (1.0 u behind A, further from Still) once, and never C (2.0 u behind).
  - Slip: after one skim, Still's walk speed is ×1.15 for 0.25 s of fight time; four skims bank 1.0 s, not more.
  - Off (no keystone, no upgrade): none of these.
- **K-M11 the reshapes.**
  - With Wake, `__hud.loadout` shows Backhand / Skate / Frost Flare names for the three ids, with §2.1's numbers.
  - With Ram, or builds off: each deep-equals `byId(id)` (tempered as worn).
  - Frost Flare lands 2 marks and a ×0.5 slow on every body in 2.2 u, and never sets `marked` (the state).
  - The compare card for `signal-flare` shows the Frost Flare line under Wake, and Signal Flare's otherwise.
- **K-M12 the hand and the eye are gone** (Wake, then Ram).
  - 10 s among 3 walls (Ram: at 4 u, out of reach; Wake: standing): `autoDmg.hand + autoDmg.eye === 0` and `eye` lances 0.
  - `combat.inStance` false after 1 s at rest.
  - The brace is gone: a scripted 10-damage blow while at rest costs 10, not 5. Bare control: 5.
- **K-M13 the shove** (Ram). In K-M13, K-M14 and K-M18 every test body's walk is held (`speedMul = 0`), so a position read is the shove's alone.
  - A hulk (`wall`) at 2 u in open floor, one beat:
    - it takes 6;
    - it is >= 3.3 u away 0.5 s later;
    - no mark;
    - `shoves.plain + 1`.
  - Walking straight away from it: no shove for 2 s.
  - Nothing in reach: the beat waits. A body stepping into reach is shoved on that tick.
- **K-M14 the slams** (Ram).
  - A wall-hulk 0.8 u from a wall, Still on the far side: 20 beats, >= 16 wall slams, and each adds 1 (cap 3).
  - A hulk with another 1.0 u behind it on the line: a body slam, +1 on each, the second one not moved (<= 0.05 u).
  - **Piston from 2 u off a wall** (Ram worn): >= 80% of 20 casts slam. Each cast first spends the body's marks.
  - Kickstart through a hulk 1 u from a wall: a wall slam.
  - A Pressure Vent's knock next to a wall (plain under Ram): no slam.
- **K-M15 a boss** (`__spawn` the Assembler): 10 beats in reach give 10 `still` slams, and the boss moves 0. The marks spend on it at the full +8.
- **K-M16 a tell is never moved, never cancelled** (Ram).
  - A pressure hulk in its cock at 2 u, one beat:
    - its position is unchanged (<= 0.05 u);
    - `tellIn()` still counts down;
    - its blow lands on the same tick as in the no-core control, for the same HP.
  - A crowned windup (not pressure): not interrupted (no `interrupt` event), not moved.
  - Either one with a wall 1.0 u behind it: slammed in place (`tell`).
- **K-M17 not free defence** (report and pass line).
  - Three pressure hulks at 2.5 u round a standing Still, seeds 1-5, 20 s each, HP put back each tick (as K-90F does).
  - Ram vs Wake-standing (no shove at all): HP lost ratio (Ram / control) **>= 0.75** on the mean.
  - Also print it against today's hand and eye.
- **K-M18 Ram's keystones and upgrades.**
  - Domino: A shoved into B, B 0.8 u from a wall. A and B are body-slammed, B is shoved 1.0 u into the wall and wall-slammed, so B holds 2.
    The chain never passes 2 links.
  - Catch:
    - a crowned hulk starting a windup in reach is shoved off-beat on that tick, not moved, not interrupted;
    - the next beat is 0.62 s after;
    - two windups 0.5 s apart give one catch;
    - a boss windup gives a `still` slam.
  - Wide: two hulks in reach are both shoved each beat.
  - Rubble: a wall slam marks a hulk 1.0 u from the impact and deals it 4; one 1.5 u away is untouched.
- **K-M19 `throwEnd` is Clamp Toss's.** 30 random setups (seeded in the check): `throwEnd` equals the grab branch's old inline result
  (`end` and `short`). Covered once more by K-90F's Clamp Toss scenario.
- **K-M20 the pick.**
  - A boot without `?depth=` (save memory, a fresh save past its first run) with builds on, through the door into `startRun`:
    - the pick shows two cards, Wake then Ram, with no back button;
    - `__combat.time` doesn't move over 1 s of frames;
    - one real click on Ram gives `combat.core 'ram'`, `__snapshot().core 'ram'`, and `corePick.took 'ram'`.
  - Builds off: no pick, and no `core` key in the snapshot.
- **K-M21 resume.**
  - Snapshots at d2 and d5 carrying core, keystone, upgrades, ranks {arms: 3}: they resume with all four and Scrap Cleaver at flat III (23).
  - Each of these resumes bare, with no pick, the depth logging `core: null`:
    - `core: 'sight'`;
    - no `core` at d2;
    - a keystone of the other core (dropped, the core kept).
  - No `core` at d1 with builds on: the pick shows.
- **K-M22 no mastery with a core.**
  - With Ram, a floor Piston melted into a worn Piston at III: no mastery card, and `combat.mastery.size === 0`. B5: the upgrade card instead.
  - Builds off: the mastery card as today, its form from `MASTERY_FORM`.
- **K-M23 the bots** (report, plus a pass line).
  - Headless d1-d3, seeds 1-3, each core, the eager cast policy (every ready part at once):
    - Wake: a circling bot (stagec's K-N17 path code, 5.5 u/s, radius 3 round the nearest awake body);
    - Ram: a step-to-the-nearest bot that stops at 2 u.
  - PASS: each core's eager bot fells the Assembler in 2 of 3 seeds.
  - Report HP lost d1-3, `marks.spent / made`, `shoves` / `skims`, and the hesitant bot (casts 3.7 s after ready) beside it.
- **K-M24 the filter** (`__rollMany`-style, 400 draws a source, Wake worn):
  - elite, Plenty and boss-blue: the share from Wake's pool is 0.45 ± 0.07;
  - kill, crate and boss-gold: 0 from the filter (`filtered` never set);
  - a turned part never comes;
  - an unfound Wake part can come;
  - the socketed keystone never comes, the other one can;
  - builds off, or no core: equal to `rollPart` on the same seeds.
- **K-M25 keystones on the floor.**
  - A `dropKey` at 2 u. Walking onto it opens the socket card. take: socketed, `applyBuilds` ran (`combat.keystone`), the old one lies
    at his feet as a GroundKey.
  - leave: it stays. Stepping off and back reopens it.
  - The thief's want list never holds it. `clearLoot` logs it `left`. `meltLabel` never offers to melt it.
- **K-M26 the cards.**
  - With Ram: the compare card and the pickup card for Piston show `fits Ram · spends slammed: +8 each`; for Backdraft, the shaper line;
    for Focusing Lens, no fit line.
  - Builds off: no fit line anywhere.
  - A dropped Piston has the fit ring and a Lens doesn't (`__loot` reports `fit`).
- **K-M27 the number is honest.** Five setups, each read with `__spendCount(slot)`, then the cast fired with no step between and its spent
  marks counted from the `spend` events. Equal in every one:
  - (a) a Lens with walls holding 1, 3, 2 marks in reach: 3;
  - (b) Scrap Cleaver with 3 walls × 2 in the cone and one × 3 just outside it: 6;
  - (c) Backdraft (shape): null, no span;
  - (d) Skate along the stick through 2 walls × 2, with a third marked wall off the path: 4;
  - (e) a Flare blast catching 3 bodies × 1: 3.
  - The button: n 0 dim; n 2 lit, no pulse; n 3 ready → `spend3`; n 3 cooling → `spendcue`.
  - Refresh: at most one `spendCount` call per worn spender per 0.1 s of game time.
- **K-M28 the readout.** After a scripted fight, the pause screen's readout text equals `WORDS.readout(st.marks.made, st.marks.spent)`,
  and names the core, the socket and the upgrades. Bare: no block.
- **K-M29 the log** (on and off).
  - Every §2.11 field is present (zeros bare).
  - `marks.spent + marks.expired <= marks.made`.
  - `spends.hits === sum(spendsPerFight)` once the depth closes.
  - `spendsPerFight.length === fights` (closed).
  - Ram's `shoves` adds up (`wall + body + still + tell + plain === n`).
  - Drop records carry `fit` with a core and none bare. A filtered drop has `filtered: true`.
- **K-M30 the frame budget** (B2).
  - `renderer.info.render.calls` after one rendered frame (`__world` + one `renderer.render`), with 0 and then 40 marked bodies (Deep
    off): the difference is <= 3; with Deep, <= 5.
  - Scene child count equal before and after 10 s of marks churning.
  - `drawMarks` with 40 bodies × 3, timed over 1000 calls: median <= 0.25 ms.
  - Print the numbers.

### 5.3 B6's pass lines (from his runs)

**His feel, asked first** (PITCHES):
- Did Ram and Wake feel different in your hands?
- By the Assembler, what were you looking for? A pass is "something that spends slams", a fail is "something stronger".
- Did losing the hand and the eye feel like a choice or a hole?

Leave out depths with `coreMixed`, bare runs (`core: null`), and dev runs.

| line | from | pass | if it fails |
|---|---|---|---|
| Wake moves | `movingS / fightS` on Wake | >= 70% | Wake isn't the core he's playing |
| Wake isn't kiting | median of `nearMovingBins` on Wake | <= 3.5 u | kill line: rework Wake before anything else (the 26 Sep failure) |
| Wake isn't the only way | pack-depth `fightS / fights`, Wake vs Ram | Wake not >= 20% faster | kill line: Wake is the new only playstyle |
| Ram holds ground | `closeS / fightS` on Ram | >= 50% | |
| Ram's slams land | `(wall + body + still + tell) / n` in pack depths | >= 0.4 | under 0.4, Ram's full chain is under +15% on deep packs (§7 R2): the geometry failed. Dials: Backdraft's pull, `bodyPad`, shove 1.5 → 2.0 (checked against K-M17) |
| Ram isn't free defence | Ram's `hpLost` d1-3 | >= 98 (0.75 × 130) | the shove is a shield: §2.6's dials |
| spends keep up | `marks.spent / marks.made`, with a spender worn | >= 50% | spending is the bottleneck: more spenders in the pool, or K up |
| a spend a fight | median `spendsPerFight`, pack fights | >= 1 | |
| fit is wanted | taken/offered for `fit: 'fits'` vs `'plain'` | >= 1.5x | the fit line or the parts don't sell the build |
| no always-take | any part or keystone | < 70% of 6+ offers | that one gets reworked |
| a late want | a part, keystone or upgrade taken after d6 | in half his runs | the weakest part of the plan (PITCHES "Settled" 3) |
| not too hard | `hpLost` d1-3 | within 25% of TRIAL-1's 130 | pack HP d1-2 is the dial, not the cores |

---

## 6. What the engineer must screenshot and look at

Use the game camera at its fight zoom (never a debug top-down), 915 × 412 (the Poco F8 Pro in landscape), `deviceScaleFactor` 2.6, unless
the row says otherwise. Write the PNGs outside the repo. For each, write one honest line on what reads at phone size and what doesn't.

| id | step | what | look for |
|---|---|---|---|
| S1 | B2 | a Wake pass along a 5-body pack's edge, mid-pass and 0.5 s after | rings at the feet filling in thirds; frost, not pips; cold, never peach |
| S2 | B3 | Ram's wall slam: the frame of the shove, and the crack burst | does the slam read as an event, does the crack read as cracked |
| S3 | B3 | a body slam between two hulks | both rings take a third; the second body doesn't move |
| S4 | B2 | a deep pack, 20+ bodies, half of them marked | do the rings clutter or read; the draw-call number (K-M30) beside it |
| S5a / S5 | B2 / B5 | a spend: the rings draining into a Cleaver's hit; then the button showing 0, 2, 5 and the 3+ pulse, at 915 × 412 and 667 × 320 | is the digit readable at 62 px mid-fight; does the pulse read as "spend now" |
| S6 | B4 | the pick screen at the four `screens.mjs` sizes | two cards, both lines readable, no scroll needed to reach either |
| S7 | B5 | the socket card, empty and with a keystone socketed | "you lose" reads |
| S8 | B5 | a fitting drop and a plain one, side by side on the floor | is the fit ring seen from the camera, without reading |
| S9 | B5 | the pause screen with the core block and readout | fits at 667 × 320; resume reachable |
| S10 | B2 | Backhand behind Still, and Skate through a pack | does Backhand read as a swing behind; does Skate read as a glide |
| S11 | B3 | Ram on the Assembler: a few beats | every shove slams; cracks on a boss that doesn't move |
| S12 | B1 | the pause screen with the new switch row | the row fits |

Sound, haptics and the felt weight of a shove can't be judged headless. They go on his phone list (§9).

---

## 7. Risks

- **R1. Ram as free defence.** The verifier's objection. §2.6's four rules plus K-M17 headless, plus the `hpLost` line from his runs.
  If both lines pass and he still says "it plays itself", the next dial is the beat (0.62 → 0.8 s), not the shove.
- **R2. Ram's pack value is unknown, not bad.** A scratch copy of `build-sim.mjs` part A (Ram as a one-body drive, damage 6, up 0.7,
  cap 3, life 3, half of all slams body slams; flat temper only where marked):

  | slams a shove | Ram's 4 whites vs today | c1 deep / boss (K 8) | c3 deep / boss (K 8) | all four III, flat |
  |---|---|---|---|---|
  | 0.25 | -18% | +3% / +33% | +10% / +21% | +22% / +35% |
  | 0.4 | -17% | +6% / +32% | +15% / +20% | |
  | 0.6 | -18% | +11% / +33% | +20% / +21% | |

  At K 6, deep c3 was +13%; at K 10, +16%, and the boss rose to +39%. K 8 is the pick: it keeps the boss lean near Strike's and doesn't
  buy packs with bosses.
  - Ram is a boss build, as PITCHES expected. On packs it passes the +15% line only at 0.4 slams a shove, which is why that is the log line.
  - c3's boss is lower than c1's because the sim's c3 swaps the Lens for Flare: an artefact of the stand-in, not a finding.
  - The balancer should redo this in his file with the real keystones (Domino and Catch aren't priced).
- **R3. Harder by default, by more than the sim says.** The sim has every core alone slower than today's hand + eye:
  - Ram -17% on every fight type;
  - Wake -8% deep, -27% boss.
  It doesn't model the planted brace (blows halved while planted), which goes with the eye (§2.4). Ram holding ground takes full blows.
  He said "easy", so this is accepted; the threat round re-sets it. The never-melt 1 in 5 will move.
- **R4. Bosses get easier for boss builds** (Ram c1 +32%). He already finds two of three bosses too easy. The threat round tunes them
  against these builds.
- **R5. Wake's Burst may be worth nothing.** In the scratch run, Wake c3 with Burst measured +27% deep, the same as without: it competes
  with the spenders for the same marks. It still reads as an event. If his log shows it is never kept in the socket over Deep, re-price it.
- **R6. The filter ignores `found`.** Wake's three reshapes are found-pool parts. Respecting `found` would starve Wake's build on a
  young save, and his save has 24+ runs. It bends the pool's "wider, never stronger, only from moments" rule for a core's own parts.
  His call (§9.4).
- **R7. The suites test a bare Still that nobody plays once B5 flips the default.** That repeats the weight-pin mistake in miniature.
  Mitigations: `builds.mjs` tests the cored game, `CORE=` runs any suite cored (report only), and K-M23's bots run d1-d3 cored. After B6,
  the lead decides whether the baseline suites move to a cored default (§9.6).
- **R8. Old states and marks on one hit.** Scrap Cleaver still pays `chilled` x2. With Chill Vent worn beside Wake, a hit is
  `22 × 2 + n × 6`. That is additive and capped (K-M4), and it is today's pair, which measured -4%. Not a stacking hole.
- **R9. Ram shoves bodies onto lit rails.** On the Line, trains will take more kills (`kills.other`). It's emergent and probably fun.
  Watch the share; the trains' damage isn't a spend.
- **R10. The digit at 62 px.** The translator's open question. S5 judges headless; his phone decides. The fallback is the translator's
  "a ring on the rim" (fill the rim in the spend count's thirds), the same data.
- **R11. A mid-crawl flip re-tempers the worn parts.** `hud.equip` keeps each button's cooldown *fraction*, not its absolute time, so a
  flip can shorten or lengthen a cooldown in flight by up to 15%. That's harmless, and K-M3 pins that it isn't a free ready.
- **R12. Missed `prefer()` or reach sites.** `spendCount` has to use the cast's own target and hit test. Two of them are extracted
  (`inArc`, `throwEnd`), and K-90F proves both refactors. K-M27 holds the number to the cast in five setups. If a sixth shape turns out to
  lie, fix the count, not the cast.
- **R13. Frame time.** The rings are instanced (≤ 5 draw calls), and the count is throttled. The phone's real number is his, at home on
  the LAN readout.

## 8. Where this brief departs from the round's docs

- **The pick at the run's start**, from two cards (his call, 2 Oct). 2-verifier §3 had it after depth 1.
- **An old run mid-run resumes bare and stays bare.** 2-verifier §3 offered the pick at the next beam (§2.8 gives the reasons).
- **Flat temper only while a core is worn**, not with the switch alone. Without that, "builds on" with no core would be a nerfed game
  with no build, and K-M1 couldn't hold.
- **Marks are their own channel** (a count and a life on `EnemyStatus`), not a `StateId`. The old states stay, untouched. Breaker's
  `open` state is gone with Breaker.
- **The core never breaks a windup.** The translator had Ram "keep the hand's windup break". Here, breaking is the parts' and the
  push's job, and it is half of the free-defence answer.
- **Tells are never moved.** Not in any round doc; this is the concrete answer to the "free defence" objection.
- **Ram's K is 8 and Wake's is 6.** Wake's is the balancer's proposed number; Ram's comes from the scratch run (R2).
- **Wake's boss keystone is cap 5 and life 4 s.** The translator had "+2 s"; the balancer's "deep" was cap +2. This merges them, inside
  PITCHES' 2-4 s band.
- **The four upgrades are named here.** The round named one example (Ram's "shove slides the first body into a second", which is close to
  Domino, so it went to the keystone).
- **Frost Flare slows**, so a skim can reach a shooter. The translator called it a shaper and left the how open.
- **Keystones are floor items of their own, with a socket card.** No round doc said how the hunt delivers them.
- **The pick card is words only.** The translator's 2 s silhouette loop and the dim "stays home" on the card not taken are cut: they need
  an animated render on a pause screen, which is a day's work for a run-start screen he sees for two seconds.
- **The default flips at the end of B5**, not B1 (§9.1).

**Decided here** (the lead or Adrian may overturn):
- the retreat rule kept on Ram;
- immovable = boss, anchored or `knockMul < 0.1`;
- only Piston's and Kickstart's knocks run the slam test;
- the filter's sources (elite, Plenty, boss-blue; never gold);
- `keyWeight` 1;
- a keystone given up drops at his feet;
- Wake's skim measured from the body's edge;
- Slip's speed;
- the ring looks;
- the fizzle at -18 dB.

---

## 9. For the owner and the lead

**Lead's calls (2 Oct), binding over the above:**
- **1: "builds" is ON by default from B1**, not flipped at B5. His rule (memory: ship to main, no dark stages) wins. It costs
  nothing: with no core the gate is shut and the game is today's (K-90F holds), and no core can be worn until B4's pick. So B1-B3
  ship inert, B4 makes the cores playable (with live drops, no filter yet), B5 adds the hunt. Tell him at B4 that the hunt is not in.
  B5's "the default flip" is therefore already done; `lib.mjs`'s builds pin still lands at B5 (or earlier if a suite needs it).
- **2: yes**, an old run resumes bare and stays bare.
- **6: yes**, suites stay bare; decide after B6.
- **7:** the balancer re-prices in `3-balancer.md` while B1 is built; B2/B3 take his numbers into `cores.ts`.
- **7 done: `3-balancer.md` is binding for numbers** (its §1 ship column over §2.1 here; `Fit.k` per-part damage per mark from B1).
  Its line changes are accepted: Ram's slam line is **>= 0.3 slams per core shove** (not 0.4); B5's random line is **random <=
  0.6 x committed** (not <= 25%, unreachable for Ram); "keystone taken <= 75% when seen" is replaced by keystones left on the floor in
  his log; upgrades gated from depth 7; Catch only on an immovable body, spending its marks; Domino's chain bodies take the core's K.
- 3, 4, 5, 8, 9 go to him (5 accepted unless he objects).

1. **When "builds" goes on by default.** My plan: B1-B4 ship with it off (the row visible, on with a tap), and B5 flips it, so his game
   never runs a core without its hunt. His rule is "no finished work hidden". The other way is to hold the pushes and ship B1-B5 together.
   **Lead's call.**
2. **An old run resumes bare and stays bare** (no offer at the next beam). **Lead's call**, overturning 2-verifier.
3. **The core never breaks a windup, and never moves a body in its tell.** That is the free-defence answer, and it costs Ram the hand's
   old windup break. **His feel decides** whether it is still Ram.
4. **The filter ignores "found"** for a core's own parts and keystones (R6). **His call.** The other way starves Wake on a young save.
5. **The planted brace goes with the eye.** Ram holding ground takes full blows. The game is harder than the sim's -17% (R3). Accepted
   unless he says otherwise.
6. **The suites stay bare by default.** After B6, should the baseline move to a cored default? **Lead's call** (R7).
7. **Numbers for the balancer to re-price in his file:**
   - Ram K 8 (from my scratch run);
   - Wake's Burst (it measures about +0);
   - the 4 keystones and 4 upgrades (none priced);
   - the reshapes' numbers;
   - `FILTER.share` 0.45.
8. **His to write:** every word in `cores.ts` `WORDS`. The cores, the marks, the keystones, the upgrades, the fit lines, the caption,
   the readout, the switch: all PLACEHOLDER.
9. **For his phone:**
   - does the digit read at 62 px;
   - does the 3+ pulse say "spend now";
   - the fizzle: helpful or nagging;
   - does a slam feel like his push or like the game shoving for him;
   - does he find "beside, not behind" in one fight without a word on screen;
   - the rings in a deep pack;
   - the frame rate with Wake in a d5 big room (perf readout).
