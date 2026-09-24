# Parts pool: buildable spec (Verifier pass)

Pass 3 of 3. The mechanics and numbers come from `1-balancer.md` (called **B**
here), and the names, card lines, reads, beats, VFX, SFX and icons come from
`2-translator.md` (**T**). Both are settled. This document says how to build
them against the code as it stands in `src/`. Where this doc and B or T
disagree, **this doc wins**, and §0.3 lists each place that happens.

Reading order for the engineer: §0 (decisions), §1 (types and `PARTS`), §2
(`useAbility` and strain), §3 (new systems), §4 (per-part rules), §5
(presentation hooks), §6 (build order), §7 (acceptance checks). §8 is out of
scope.

---

## 0. Proposal and decisions

### 0.1 Why / what changes

**Why.** The pool is nine placeholders. The designed pool has 30 parts across
12 shapes, and it needs seven small engine systems that don't exist yet.

**What changes.**
- `AbilityDef` becomes a data-complete part: shape, an optional typed `Mod`
  carrying the twist's own numbers, a few optional knobs, the drop gate, the
  beat key, the icon, and the strain pips.
- `Combat.useAbility` takes a context (`pushed`, `strain`) and returns a
  `CastResult` (cooldown handling, the part's own strain cost, aim, beat).
- `main.ts` applies all strain through one `addStrain()`, so every path can
  reach Stopped.
- New systems: enemy status (mark, slow), windup interrupt, target override
  (decoy), ground zones, bounce + bank solver + answer shot, terrain breach,
  two-press part state, 1.5 s history, held (thrown) enemies.
- Drop tables: 0.66 ÷ pack size per kill, tier odds per source, gating.

**Capabilities.** New: 22 parts, the LIVE button face, strain pips, and a
per-part icon. Modified: the four starting whites (the line rule), Rusted Hook,
Skid Plates, Overclocked Coil, and loot.

**Impact (files).**

| file | change |
|---|---|
| `src/abilities.ts` | new types, the 30-part `PARTS`, `STARTING`, `READY`, `byId` |
| `src/parts.ts` | **new**: `PartRuntime`, `EnemyStatus`, `Zone`, `Held`, `History`, `bankShot`, `PART` constants, `PartEvent`, `StillMove` |
| `src/partfx.ts` | **new**: persistent part visuals, drawn by reading state (shell, decoy, anchor/tether, echo, badges, zones, breach rims, lob globs, beams, previews) |
| `src/combat.ts` | `useAbility`, bolt/shot loops (bounce, ghost, once, owner), `hurtPlayer(source)`, statuses, zones, held, decoy override, dead-first enemy loop, `clearSlot`, `reset`, events |
| `src/enemy.ts` | `interrupt()`, `rime`, `melee.reach`, `shot.bounces` |
| `src/ranged.ts` | `interrupt()`, the answer shot and its bent strip, `rime` |
| `src/boss.ts` | `interrupt()` returns false, walk speed × `speedMul`, `rime` |
| `src/terrain.ts` | `see` flag on `blocked`/`lineClear`, `blocker`, `breach`, `tickBreaches`, `faces` |
| `src/dungeon.ts` | those terrain methods, solid ids, instance mapping, `Level.fadeSolid`, export `makeTerrain` |
| `src/kit.ts` | `buildInstanced` names each `InstancedMesh` after its piece |
| `src/main.ts` | `onFire` result, `addStrain`, `cast`, `castFx`, `onPart` handler, per-frame HUD part state, vault `pushOut` skip, drop flow, dev hooks |
| `src/hud.ts`, `src/style.css` | icons from the def, LIVE ring, fire result, `startCooldown`, pips, notches, warning, charge fill, icon states, refused shake, recent-damage ghost |
| `src/still.ts` | `attack(spec)` by beat, rig handles (R1), `startMove`, vault flag, stick lock, `makeGhost` |
| `src/vfx.ts` | cold tell variant (N1), `trail(life)`, `gather` (N11), `frost` (N4a) |
| `src/audio.ts` | `ability(beat, pushed, power)`, event voices, hard-cut windup stop |
| `src/loot.ts` | odds per source, gating, `rollPart(from, taken, source, excludeSlot?)` |
| `src/pause.ts` | labels for the new shapes, damage label, pips on the card, conflict line |

### 0.2 Top decisions

1. **One part = one def. Each twist carries its own numbers in `Mod`.** `Mod`
   is a discriminated union (`{ kind: 'mark'; ms: 4000 }`), so every number the
   balancer set lives in `PARTS` and nowhere else. Engine constants that aren't
   a part's own (line pad, falloff, peak heights) go in `PART` in `parts.ts`.
   *Why:* numbers stay data, and behaviour stays code.
2. **Game time for everything a part owns.** Windows, decoys, anchors, zones,
   breaches, marks, slows, throws, the history and the Patient charge all tick
   on `combat.update(dt)`. So pause, hitstop and the Stopped slowdown freeze or
   slow them exactly as they do enemies. Only HUD cooldowns stay on the HUD
   clock, as today.
3. **State is polled; moments are events.** Anything that lasts
   (`combat.parts`, `statusOf`, zones, breaches) is drawn each frame by the new
   `PartFx`, which reads it. Anything instantaneous (a bounce, a catch, a
   cancel, a mark consumed) goes out as a single `onPart(PartEvent)` event.
   *Why:* one channel, and no persistent visuals leak across levels (`PartFx.clear()`
   runs where `combat.reset()` runs).
4. **All strain goes through `main.addStrain()`.** Push, Coil, Borrowed Time,
   Brace conversions and Plenty all use it. It clamps to 20, sends the pips,
   and calls `beginStopping()` the moment strain reaches 20. The part always
   resolves first. *Why:* one place that can end the run.
5. **Stopped beats Broke when both happen on one tick.** `beginStopping()`
   sets the phase inside `combat.update`, and the existing
   `hp <= 0 && phase !== 'stopping'` check then skips the break. This realises
   B's "Brace turns a Broke into a Stopped".
6. **Dead enemies never act.** The enemy loop checks `e.dead` *before*
   `e.update` and buries the enemy there. Today a hulk killed mid-windup by an
   ability cast between ticks still runs one `update` and can strike. With
   Parry, Anvil and bursts killing things inside the tick, this becomes a
   visible bug.
7. **Breach is per solid piece, not per 4-u grid cell.** A "cell" is one wall
   piece (a `Box`: one barrier segment, or an arena cover wall), one prop or
   column (`Circle`), or one void grid cell the line crosses. A breach makes
   that piece stop blocking in `see` mode only. *Why:* a whole-grid-cell flag
   would also open a corner cell's *other* wall.
8. **`see` mode is opt-in, per call site.** `blocked`/`lineClear` gain
   `see = false`. It's true only for projectiles and sight: Still's bolts, enemy
   shots, the auto attack's clear-shot test, the sentinel's sight, and the bank
   solver. Melee (arcs, novas, chaser windup, boss sweep and magnet), the
   shockwave, movement and pathing stay solid. Bodies never pass through a
   breach.

### 0.3 Contradictions resolved

| # | where | B says | T / code says | resolution |
|---|---|---|---|---|
| R1 | window cooldowns (Ward, Mirror, Brace, Anvil, Lure) | uptime = window ÷ cd, so the cooldown counts **from the press** | "the cooldown sweep starts when LIVE ends" | Keep B's timing. The HUD shows the LIVE ring for the window, then the dark sweep for whatever is left (it starts part-drained). T's read survives, and B's numbers are unchanged. **Plumb Line is the exception**: its cooldown really starts at the snap or the fade (B). |
| R2 | Rusted Hook reach | "5.5 + 0.6 pad + body reaches 6.6" | the code's reach is `range + MELEE_PAD + r − 0.55` = 6.05 against a sentinel | Keep the code's formula for every arm part (the Cleaver's feel was tuned on it). The requirement B cares about, reaching the 6.0 inner edge of the sentinel band, still holds at 6.05. Range stays 5.5. Watch it in play. |
| R3 | targets without line of sight | only Through-Line is "awake first" (owner decision) | T flag 3 | Extend it to **every part that reaches an enemy without a clear line**: Flare, Signal Flare and Ricochet's bank target. Same reason (never wake a second pack by accident), and it changes no number. |
| R4 | Lure spawn | at Still's feet | T flag 2 | Owner: 1.5 u behind Still, opposite the stick (or opposite facing when idle), clamped by walls with `clampMove`. The distance is `offset: 1.5` on the def. |
| R5 | Overrun charge | pushed only | T flag 1 recommends hold-on-ready | Owner: push-while-cooling only. The charge always follows a step. The card already says so. |
| R6 | Patient Lens bolt size | "radius 0.85" | T: "visual size scales 0.3 → 0.85" | The hit radius stays 0.85. Only the mesh scales with charge. |
| R7 | Plumb Line out-of-range press | "snaps beyond 10 u fail" | T: "keeps the anchor (spec must confirm)" | Confirmed: the press is **refused**. No snap, no cooldown, no strain, the anchor stays, and the button shakes and gives a denied tick. |
| R8 | Plumb Line swapped out mid-anchor | – | the HUD's cooldown-fraction rule would give the incoming part a free ready button | Swapping out a live anchor counts as the anchor fading. The incoming part inherits a **full** cooldown fraction (1.0). |
| R9 | Lure pushed while a decoy is live | – | T: "a push reopens the window" | The live decoy **bursts now** (a normal burst), then the new one spawns. There is only ever one decoy. |
| R10 | a part swapped out mid-window | – | – | The window ends quietly (G8 expire tick). A Lure decoy vanishes **without** bursting, so a swap can't buy a free 18. Throws, lobs, moves, zones, marks, slows and breaches are world state and finish normally. |
| R11 | Borrowed Time used twice in 1.5 s (a push inside the window) | "restores damage taken" | – | The damage a rewind restores is zeroed in the history, so the same damage can't come back twice. |
| R12 | boss adds and drops | "0.66 ÷ pack size" | the boss pack's size is 1 | Summoned adds never roll drops (they're scrap). Split halves ("the Many") roll normally against the pack's creation size. |
| R13 | `STARTING` | – | `PARTS.filter(white)` would now return eight whites | `STARTING` is the four original whites by id. The random first part is picked from those four. `fillEmpty` still offers any white. |
| R14 | card text | code placeholders | T | T's card lines everywhere (Skid Plates, Rusted Hook and Coil change). |
| R15 | Chill Vent on the boss | B names only the Frost strip (walk 2.4 → 1.2) | the boss walk ignores `speedMul` today | The boss walk multiplies by `speedMul`, so both slows work on it. Its charge (a rush) and all its windups are untouched. |
| R16 | which cover Through-Line opens | "wall cells" | inside rooms, cover is mostly props (circles); barriers face the void | Every solid the line crosses is breached: barrier boxes, props, columns and void cells. Breakables are **smashed** instead. Without this, "shoot through the cover you're crouched behind" never happens in a normal room. |

### 0.4 Protected rules (from CONTEXT, B and the owner)

- One part = one ability. No stats, no affixes.
- No part reduces strain. The only relief is a quiet (−2) or Rest (−6).
- **The quiet farm is already closed** in `main.ts`: a quiet needs a kill
  since the last quiet (`run.killed`). Nothing in this spec touches it. Kills of
  summoned adds and split halves count as kills, which is correct.
- No knock source repeats faster than 0.4 s without pushing, and no zone shoves
  (the Frost strip only slows).
- Arcs, novas, the Lure burst, the Skid slam, the Anvil counter, the Brace and
  Chill blasts and the Clamp Toss splash all need `lineClear(origin, target,
  PART.linePad = 0.2)` in **solid** mode for each enemy. Breakables are hit
  without the line check.
- The Assembler: `knockMul 0.05` scales every shove, yank and throw. It can't
  be grabbed (`knockMul < 0.1`), can't be interrupted, and ignores the decoy
  (its adds obey). Marks, slows and damage apply to it.
- Every run ends in one of the two endings (`broken`, `stopped`). This spec adds
  no third terminal state and no path that skips `end()`.

---

## 1. Data contract

### 1.1 `src/abilities.ts`

```ts
import type { SlotName } from './still'

/** A code path. Twelve of them; everything else is data. */
export type AbilityShape =
  | 'bolt'   // a projectile at a target (Lens family)
  | 'lob'    // lands `travelMs` later at a snapshot point, arcs over walls (Flare family)
  | 'nova'   // a blast around Still (Vent family, Brace)
  | 'ward'   // a shell around Still for `windowMs` that meets enemy shots (Ward, Mirror Ward)
  | 'decoy'  // a cold copy of Still that draws enemies, then bursts (Lure)
  | 'arc'    // a melee sweep that snaps to the nearest reachable target (Cleaver family, Piston)
  | 'grab'   // take the nearest enemy and throw it (Clamp Toss)
  | 'catch'  // a window that negates the next body strike and counters (Anvil)
  | 'dash'   // travel along the stick, running over things (Kickstart family)
  | 'hop'    // a short airborne travel, no damage (Skitter, Spring Heels)
  | 'anchor' // press 1 plants, press 2 snaps back (Plumb Line)
  | 'rewind' // back along the recorded path (Borrowed Time)

export type Tier = 'white' | 'blue' | 'gold'

/** Where a part may drop. 'rare' = elite, boss, Plenty. 'boss' = boss only. */
export type DropGate = 'any' | 'rare' | 'boss'

/**
 * One behaviour change, with its own numbers. A white has no mod. A blue has
 * exactly one. A gold's oddity is its shape, its mod, or both. Durations are ms,
 * distances are world units, cones are degrees.
 */
export type Mod =
  /** bolt: passes through every enemy (each once). Walls still stop it. */
  | { kind: 'pierce' }
  /** bolt: passes through enemies, crates and walls. Every solid crossed is breached for `breachMs` (both sides). */
  | { kind: 'pierceAll'; breachMs: number }
  /** bolt: reflects off walls up to `bounces` times. With no clear line, it takes a one-wall bank found within `bankSearch` of Still. */
  | { kind: 'bounce'; bounces: number; bankSearch: number }
  /** bolt: damage rises linearly from `minDamage` at `minS` to def.damage at `fullS` since the last cast. A pushed shot is always def.damage. */
  | { kind: 'charge'; minDamage: number; minS: number; fullS: number }
  /** bolt: `count` bolts spread `spreadRad` apart. An enemy takes at most one per cast. */
  | { kind: 'fan'; count: number; spreadRad: number }
  /** lob: everything caught is marked for `ms`. The next hit from another part on a marked enemy lands twice. */
  | { kind: 'mark'; ms: number }
  /** nova: drags enemies in, stopping `to` u from Still. */
  | { kind: 'pull'; to: number }
  /** nova: walk speed × `mul` for `ms`. Refreshes, never stacks, never touches a windup, strike or rush. */
  | { kind: 'slow'; mul: number; ms: number }
  /** nova: then for def.windowMs every hit becomes ceil(damage / perStrain) strain instead of HP. */
  | { kind: 'brace'; perStrain: number }
  /** ward: shots reaching the shell fly back at their shooter as Still's bolts, at most `max` per cast. */
  | { kind: 'reflect'; max: number; damage: number }
  /** arc: yanks every enemy hit to `to` u in front of Still. */
  | { kind: 'hook'; to: number }
  /** arc: an enemy hit during its windup has the windup cancelled and is shoved `shove` u. */
  | { kind: 'parry'; shove: number }
  /** arc: the cone follows strain. cones[0] below at[0], cones[1] below at[1], cones[2] from at[1] up. */
  | { kind: 'fray'; at: readonly [number, number]; cones: readonly [number, number, number] }
  /** grab: the landing splash shoves `splashShove`. A throw cut short by a solid adds `wallDamage` to the thrown enemy. */
  | { kind: 'toss'; splashShove: number; wallDamage: number }
  /** dash: ends in a blast at the landing point. */
  | { kind: 'slam'; radius: number; damage: number; shove: number }
  /** dash: pushed, these numbers replace the def's. Unpushed, the def's own (a short step). */
  | { kind: 'overrun'; range: number; damage: number; radius: number; shove: number; travelMs: number }
  /** dash: leaves a floor strip along the path that slows whatever stands on it. */
  | { kind: 'strip'; width: number; ms: number; mul: number }
  /** hop: may clear exactly one obstacle by stretching up to `maxRange`. A vault locks the stick for `lockMs` on landing. */
  | { kind: 'vault'; maxRange: number; lockMs: number }

/**
 * A cast's presentation identity: the pose, the voice and the castFx recipe all
 * key on it. A part's default is `def.beat`. useAbility picks the variants
 * (fray width, overrun half, plant/snap).
 */
export type BeatKey =
  | 'lens' | 'flare' | 'cracked' | 'ricochet' | 'patient' | 'signal' | 'through' | 'coil'
  | 'vent' | 'ward' | 'backdraft' | 'chill' | 'brace' | 'mirror' | 'lure'
  | 'cleaver' | 'piston' | 'hook' | 'parry' | 'fray-90' | 'fray-180' | 'fray-360' | 'toss' | 'anvil'
  | 'kick' | 'skitter' | 'skid' | 'overrun-step' | 'overrun-charge' | 'frost' | 'spring' | 'plant' | 'snap' | 'rewind'

/** Alternate icon markups the HUD swaps in by state. The base state is `icon`. */
export type IconState = 'fray-180' | 'fray-360' | 'snap'

export interface AbilityDef {
  id: string
  slot: SlotName
  /** H / T / A / L, filled by `part()`. */
  key: string
  name: string
  tier: Tier
  /** The pickup card's one line (T §6). */
  line: string
  shape: AbilityShape
  mod?: Mod
  cooldownMs: number
  /**
   * bolt/lob/arc/grab/dash (run-over)/anchor (run-over): damage per hit.
   * nova: blast. decoy: burst. catch: counter. charge mod: the full-charge value.
   */
  damage: number
  /**
   * bolt: flight distance (life = range / speed); for bounce, the path length.
   * lob: target search. arc/grab: reach (see `inReach`). dash/hop: travel.
   * decoy: draw radius. anchor: the longest snap. Unused elsewhere (0).
   */
  range: number
  /**
   * bolt: hit radius. lob: landing blast. nova: blast. ward: shell. decoy: burst.
   * catch: counter radius. dash/anchor: run-over half-width. Unused elsewhere (0).
   */
  radius: number
  /** arc: full cone width, degrees. */
  cone?: number
  /**
   * The shove this part applies, in u of slide (× knockMul). nova: the max of the
   * falloff (PART.novaShoveMin floor). arc: along the swing's aim. dash/anchor:
   * run-over knock. decoy/catch: away from the centre. grab: the throw distance.
   */
  shove?: number
  /** ward/catch/nova-brace: window. decoy: life. anchor: anchor life. rewind: history length. */
  windowMs?: number
  /** lob flight, grab flight, dash/hop/snap/rewind travel. */
  travelMs?: number
  /** decoy: how far behind Still it's placed. */
  offset?: number
  /** grab: splash radius. */
  blast?: number
  /** grab: splash damage. */
  blastDamage?: number
  /** Strain this part costs on every cast, pushed or not (a push adds its own +2 on top). */
  strain?: number
  drops: DropGate
  beat: BeatKey
  /** SVG inner markup, 24×24, stroke 2, round caps (T §6). Classes `push` / `charge` are styled by button state. */
  icon: string
  iconStates?: Partial<Record<IconState, string>>
  /** Ember dots on the button's lower rim: the price on every cast. */
  pips?: { n: number; hollow?: boolean }
}
```

### 1.2 The `PARTS` literal (paste into `src/abilities.ts`)

```ts
const KEYS: Record<SlotName, string> = { head: 'H', torso: 'T', arms: 'A', legs: 'L' }

function part(p: Omit<AbilityDef, 'key' | 'drops'> & { drops?: DropGate }): AbilityDef {
  return { drops: 'any', ...p, key: KEYS[p.slot] }
}

const I = {
  vent: '<circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/>',
  cleaver: '<path d="M4 19C6 10 12 5 20 4"/><path d="M8 20.5c2.5-6 6.5-9.5 12-10.5" opacity=".55"/>',
}

export const PARTS: AbilityDef[] = [
  // ---------------- HEAD: reaches far ----------------
  part({
    id: 'focusing-lens', slot: 'head', name: 'Focusing Lens', tier: 'white', beat: 'lens',
    line: 'A heavy bolt at the nearest enemy.',
    shape: 'bolt', cooldownMs: 4200, damage: 26, range: 13, radius: 0.85,
    icon: '<circle cx="7" cy="12" r="3.5"/><path d="M11.5 12H21"/><path d="M17 8.5 21 12l-4 3.5"/>',
  }),
  part({
    id: 'flare', slot: 'head', name: 'Flare', tier: 'white', beat: 'flare',
    line: 'Lobs a burst over walls onto where the enemy was standing.',
    shape: 'lob', cooldownMs: 4200, damage: 18, range: 11, radius: 2.0, travelMs: 800,
    icon: '<path d="M3.5 18C5.5 6 13.5 4 17.5 14"/><ellipse cx="17.5" cy="18" rx="4" ry="1.8"/>',
  }),
  part({
    id: 'cracked-lens', slot: 'head', name: 'Cracked Lens', tier: 'blue', beat: 'cracked',
    line: 'The bolt passes through every enemy it hits. Walls still stop it.',
    shape: 'bolt', mod: { kind: 'pierce' }, cooldownMs: 4600, damage: 20, range: 15, radius: 0.7,
    icon: '<circle cx="6" cy="12" r="3.5"/><path d="M5 8.8 6.5 11 5 13"/><path d="M10.5 12H22"/><path d="M14.5 8.5v7M18.5 8.5v7"/>',
  }),
  part({
    id: 'ricochet-lens', slot: 'head', name: 'Ricochet Lens', tier: 'blue', beat: 'ricochet',
    line: 'A bolt that bounces off walls to reach enemies behind cover.',
    shape: 'bolt', mod: { kind: 'bounce', bounces: 2, bankSearch: 8 }, cooldownMs: 4600, damage: 18, range: 20, radius: 0.7,
    icon: '<circle cx="5" cy="5.5" r="2.5"/><path d="M7 8l5.5 11L18 8"/><path d="M15.2 8.6 18 8l.6 2.8"/><path d="M8 20.5h9"/>',
  }),
  part({
    id: 'patient-lens', slot: 'head', name: 'Patient Lens', tier: 'blue', beat: 'patient',
    line: 'Hits harder the longer you wait. Held while it recharges, it fires full.',
    shape: 'bolt', mod: { kind: 'charge', minDamage: 6, minS: 1.5, fullS: 7.5 }, cooldownMs: 1500, damage: 32, range: 13, radius: 0.85,
    icon: '<circle cx="8.5" cy="12" r="5.5"/><circle cx="8.5" cy="12" r="2.2" fill="currentColor" stroke="none" class="charge"/><path d="M16 12h1M19.5 12h2.5"/>',
  }),
  part({
    id: 'signal-flare', slot: 'head', name: 'Signal Flare', tier: 'blue', beat: 'signal',
    line: 'Marks enemies where it lands. Your next part hits a marked one twice.',
    shape: 'lob', mod: { kind: 'mark', ms: 4000 }, cooldownMs: 5000, damage: 4, range: 11, radius: 2.2, travelMs: 800,
    icon: '<path d="M3 19C4.5 8 11 5 15.5 11"/><path d="M13 15v-2h2M19 13h2v2M13 19v2h2M21 19v2h-2"/>',
  }),
  part({
    id: 'through-line', slot: 'head', name: 'Through-Line', tier: 'gold', beat: 'through', drops: 'boss',
    line: 'A bolt through enemies and walls. The holes it leaves let shots through both ways.',
    shape: 'bolt', mod: { kind: 'pierceAll', breachMs: 4000 }, cooldownMs: 6000, damage: 24, range: 16, radius: 0.6,
    icon: '<path d="M2 12h18"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M10 3.5v5M14 3.5v5M10 15.5v5M14 15.5v5"/>',
  }),
  part({
    id: 'overclocked-coil', slot: 'head', name: 'Overclocked Coil', tier: 'gold', beat: 'coil', drops: 'rare',
    line: 'Three bolts at once, ready fast, but every shot adds strain.',
    shape: 'bolt', mod: { kind: 'fan', count: 3, spreadRad: 0.26 }, cooldownMs: 1200, damage: 14, range: 12, radius: 0.6,
    strain: 1, pips: { n: 1 },
    icon: '<path d="M2 9l2 6 2-6 2 6"/><path d="M11 12h10M10.5 10 20 5.5M10.5 14l9.5 4.5"/>',
  }),

  // ---------------- TORSO: works around Still ----------------
  part({
    id: 'pressure-vent', slot: 'torso', name: 'Pressure Vent', tier: 'white', beat: 'vent',
    line: 'A blast around you that shoves enemies away.',
    shape: 'nova', cooldownMs: 6500, damage: 15, range: 0, radius: 4.3, shove: 4.2,
    icon: I.vent,
  }),
  part({
    id: 'ward', slot: 'torso', name: 'Ward', tier: 'white', beat: 'ward',
    line: 'A brief shield that destroys enemy shots.',
    shape: 'ward', cooldownMs: 7000, damage: 0, range: 0, radius: 1.8, windowMs: 1400,
    icon: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="4.2 2.5"/><circle cx="12" cy="12" r="2.5"/>',
  }),
  part({
    id: 'backdraft-vent', slot: 'torso', name: 'Backdraft Vent', tier: 'blue', beat: 'backdraft',
    line: 'The blast drags enemies in instead of out.',
    shape: 'nova', mod: { kind: 'pull', to: 1.4 }, cooldownMs: 6500, damage: 12, range: 0, radius: 5.2,
    icon: '<circle cx="12" cy="12" r="2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><path d="M10 5.5l2 2 2-2M10 18.5l2-2 2 2M5.5 10l2 2-2 2M18.5 10l-2 2 2 2"/>',
  }),
  part({
    id: 'chill-vent', slot: 'torso', name: 'Chill Vent', tier: 'blue', beat: 'chill',
    line: 'A cold blast that makes enemies walk slowly for a while.',
    shape: 'nova', mod: { kind: 'slow', mul: 0.5, ms: 3000 }, cooldownMs: 6500, damage: 10, range: 0, radius: 4.3,
    icon: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  }),
  part({
    id: 'brace', slot: 'torso', name: 'Brace', tier: 'blue', beat: 'brace',
    line: 'For a moment, hits cost you strain instead of integrity.',
    shape: 'nova', mod: { kind: 'brace', perStrain: 8 }, cooldownMs: 9000, damage: 8, range: 0, radius: 2.6, windowMs: 800,
    pips: { n: 1, hollow: true },
    icon: '<path d="M12 2.5v8"/><path d="M8.5 7 12 10.5 15.5 7"/><path d="M4 14h16"/><path d="M6.5 18h11M9.5 21.5h5"/>',
  }),
  part({
    id: 'mirror-ward', slot: 'torso', name: 'Mirror Ward', tier: 'blue', beat: 'mirror',
    line: 'A brief shield that sends enemy shots back at whoever fired them.',
    shape: 'ward', mod: { kind: 'reflect', max: 6, damage: 8 }, cooldownMs: 7000, damage: 0, range: 0, radius: 1.8, windowMs: 800,
    icon: '<path d="M16 3.5a9 9 0 0 1 0 17"/><path d="M3 5.5 13.5 12 3 18.5"/><path d="M4.7 15.1 3 18.5h3.8"/>',
  }),
  part({
    id: 'lure', slot: 'torso', name: 'Lure', tier: 'gold', beat: 'lure', drops: 'rare',
    line: 'Leaves a decoy of you that enemies go after, until it bursts.',
    shape: 'decoy', cooldownMs: 12000, damage: 18, range: 12, radius: 3.0, windowMs: 3000, shove: 1.6, offset: 1.5,
    icon: '<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5V11"/><path d="M8.5 11h7l-1 8.5h-5z"/><path d="M4.5 9a8 8 0 0 0 0 7M19.5 9a8 8 0 0 1 0 7"/>',
  }),

  // ---------------- ARMS: close ----------------
  part({
    id: 'scrap-cleaver', slot: 'arms', name: 'Scrap Cleaver', tier: 'white', beat: 'cleaver',
    line: 'A wide swing at whatever is closest.',
    shape: 'arc', cooldownMs: 2600, damage: 18, range: 3.1, radius: 0, cone: 120,
    icon: I.cleaver,
  }),
  part({
    id: 'piston', slot: 'arms', name: 'Piston', tier: 'white', beat: 'piston',
    line: 'A hard, narrow punch that knocks one enemy back.',
    shape: 'arc', cooldownMs: 3000, damage: 26, range: 3.4, radius: 0, cone: 40, shove: 1.6,
    icon: '<path d="M3 12h9"/><path d="M12 7.5v9"/><path d="M15 12h6"/><path d="M18 9l3 3-3 3"/><path d="M3 8.5h3M3 15.5h3"/>',
  }),
  part({
    id: 'rusted-hook', slot: 'arms', name: 'Rusted Hook', tier: 'blue', beat: 'hook',
    line: 'A long, narrow swing that yanks enemies to you.',
    shape: 'arc', mod: { kind: 'hook', to: 1.6 }, cooldownMs: 3200, damage: 12, range: 5.5, radius: 0, cone: 70,
    icon: '<path d="M4 12h13"/><path d="M17 12a3 3 0 1 0 3-3"/><path d="M7.5 8.5 4 12l3.5 3.5"/>',
  }),
  part({
    id: 'parry-clamp', slot: 'arms', name: 'Parry Clamp', tier: 'blue', beat: 'parry',
    line: 'A quick snap. Catch an enemy winding up and it breaks the attack.',
    shape: 'arc', mod: { kind: 'parry', shove: 2.5 }, cooldownMs: 3600, damage: 10, range: 2.6, radius: 0, cone: 90,
    icon: '<path d="M3 6c4.5 0 7.5 2 8.5 6M3 18c4.5 0 7.5-2 8.5-6"/><path d="M15 8.5l6 7M21 8.5l-6 7"/>',
  }),
  part({
    id: 'frayed-cleaver', slot: 'arms', name: 'Frayed Cleaver', tier: 'blue', beat: 'fray-90',
    line: 'A swing that grows wider the more strained you are.',
    shape: 'arc', mod: { kind: 'fray', at: [6, 12], cones: [90, 180, 360] }, cooldownMs: 2600, damage: 16, range: 3.1, radius: 0, cone: 90,
    icon: '<path d="M6.3 9.3A8 8 0 0 1 17.7 9.3"/><path d="M6.3 9.3 4.6 7.6M17.7 9.3l1.7-1.7"/><circle cx="12" cy="15" r="1.2"/>',
    iconStates: {
      'fray-180': '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M4 15H2M20 15h2"/><circle cx="12" cy="15" r="1.2"/>',
      'fray-360': '<circle cx="12" cy="12.5" r="8"/><path d="M6.3 6.8 4.9 5.4M17.7 6.8l1.4-1.4M6.3 18.2l-1.4 1.4M17.7 18.2l1.4 1.4"/><circle cx="12" cy="12.5" r="1.2"/>',
    },
  }),
  part({
    id: 'clamp-toss', slot: 'arms', name: 'Clamp Toss', tier: 'blue', beat: 'toss',
    line: "Grabs the nearest enemy and throws it the way you're steering.",
    shape: 'grab', mod: { kind: 'toss', splashShove: 1.2, wallDamage: 12 }, cooldownMs: 4500, damage: 14, range: 2.4, radius: 0,
    shove: 5.0, blast: 1.2, blastDamage: 14, travelMs: 350,
    icon: '<path d="M3 21v-3.5l2-2M9 21v-3.5l-2-2"/><path d="M6 13C7 6.5 13 3.5 20 5"/><path d="M17.5 2.5 20 5l-2.5 2.5"/>',
  }),
  part({
    id: 'anvil', slot: 'arms', name: 'Anvil', tier: 'gold', beat: 'anvil', drops: 'rare',
    line: 'Catches the next blow that would hit you and hammers back. Shots get through.',
    shape: 'catch', cooldownMs: 6000, damage: 30, range: 0, radius: 3.0, windowMs: 900, shove: 2.0,
    icon: '<path d="M3 7h15.5c0 2.5-2 4-5 4h-.5v3.5h2.5l1.5 4.5H7l1.5-4.5H11V11H8C5 11 3 9.5 3 7z"/><path d="M19.5 3.5 21 2M21 5.5h1.5"/>',
  }),

  // ---------------- LEGS: move him ----------------
  part({
    id: 'kickstart', slot: 'legs', name: 'Kickstart', tier: 'white', beat: 'kick',
    line: 'Dash, running over anything in the way.',
    shape: 'dash', cooldownMs: 8000, damage: 12, range: 6.4, radius: 1.2, shove: 1.2, travelMs: 280,
    icon: '<path d="M4 6l6 6-6 6"/><path d="M12 6l6 6-6 6"/>',
  }),
  part({
    id: 'skitter', slot: 'legs', name: 'Skitter', tier: 'white', beat: 'skitter',
    line: "A quick little hop the way you're steering.",
    shape: 'hop', cooldownMs: 3200, damage: 0, range: 3.4, radius: 0, travelMs: 180,
    icon: '<path d="M4 18c2.5-7 9.5-7 12 0"/><path d="M13.3 16.3 16 18l1.4-2.8"/><path d="M3 21h4M14 21h4"/>',
  }),
  part({
    id: 'skid-plates', slot: 'legs', name: 'Skid Plates', tier: 'blue', beat: 'skid',
    line: 'The dash ends in a blast that shoves enemies away.',
    shape: 'dash', mod: { kind: 'slam', radius: 2.8, damage: 10, shove: 1.4 }, cooldownMs: 8000, damage: 8, range: 5.6, radius: 1.2, shove: 1.2, travelMs: 280,
    icon: '<path d="M3 6.5l5 5.5-5 5.5M9.5 6.5l5 5.5-5 5.5"/><path d="M19.5 6.5V9M19.5 15v2.5M22.5 12H20M21.6 9.9l-1.1 1.1M21.6 14.1l-1.1-1.1"/>',
  }),
  part({
    id: 'overrun', slot: 'legs', name: 'Overrun', tier: 'blue', beat: 'overrun-step',
    line: 'A short step. Held while it recharges, a long charge that hits.',
    shape: 'dash', mod: { kind: 'overrun', range: 9, damage: 22, radius: 1.4, shove: 2.4, travelMs: 300 },
    cooldownMs: 7000, damage: 0, range: 4.0, radius: 0, travelMs: 220,
    icon: '<path d="M3 7l5 5-5 5"/><path class="push" d="M11 12h9M17 8l4 4-4 4"/>',
  }),
  part({
    id: 'frost-trail', slot: 'legs', name: 'Frost Trail', tier: 'blue', beat: 'frost',
    line: 'A dash that leaves a cold track that slows enemies on it.',
    shape: 'dash', mod: { kind: 'strip', width: 1.4, ms: 3000, mul: 0.5 }, cooldownMs: 8000, damage: 0, range: 6.4, radius: 0, travelMs: 280,
    icon: '<path d="M4 3.5l4 4-4 4M11 3.5l4 4-4 4"/><path d="M2.5 17.5h19"/><path d="M5.5 15v5M10 15v5M14.5 15v5M19 15v5"/>',
  }),
  part({
    id: 'spring-heels', slot: 'legs', name: 'Spring Heels', tier: 'blue', beat: 'spring',
    line: 'A hop that clears a low wall, landing heavy on the far side.',
    shape: 'hop', mod: { kind: 'vault', maxRange: 4.6, lockMs: 300 }, cooldownMs: 4000, damage: 0, range: 3.4, radius: 0, travelMs: 300,
    icon: '<path d="M3 20C5 9 15 9 17 20"/><path d="M8.5 20.5v-4h4v4"/><path d="M14.4 18.3 17 20l1.6-2.7"/>',
  }),
  part({
    id: 'plumb-line', slot: 'legs', name: 'Plumb Line', tier: 'gold', beat: 'plant', drops: 'rare',
    line: 'Drop an anchor, then press again to snap back to it.',
    shape: 'anchor', cooldownMs: 9000, damage: 14, range: 10, radius: 1.0, shove: 1.2, windowMs: 5000, travelMs: 240,
    icon: '<path d="M12 2.5v8" stroke-dasharray="2 2.5"/><path d="M7.5 11.5h9L12 21z"/>',
    iconStates: { snap: '<path d="M21 12H10" stroke-dasharray="2 2.5"/><path d="M13 8.5 9.5 12l3.5 3.5"/><path d="M2.5 8h6L5.5 14z"/>' },
  }),
  part({
    id: 'borrowed-time', slot: 'legs', name: 'Borrowed Time', tier: 'gold', beat: 'rewind', drops: 'boss',
    line: 'Rewinds you a moment and undoes the hits you took. Adds strain.',
    shape: 'rewind', cooldownMs: 10000, damage: 0, range: 0, radius: 0, windowMs: 1500, travelMs: 250,
    strain: 2, pips: { n: 2 },
    icon: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5"/><circle cx="12" cy="12" r="1.5"/>',
  }),
]

export const byId = (id: string): AbilityDef => PARTS.find((p) => p.id === id)!

/** The kit `?depth=` hands out, and the pool the random first part comes from. */
export const STARTING: AbilityDef[] = ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'].map(byId)

/**
 * Parts whose code is in. Only these drop. Each build step (§6) adds its ids;
 * at step 6 it's every id, and the set can be deleted.
 */
export const READY = new Set<string>([/* §6 */])
```

Count: head 8, torso 7, arms 7, legs 8 = 30. White 8, blue 16, gold 6. Boss-only:
Through-Line, Borrowed Time. Rare: Coil, Lure, Anvil, Plumb Line.

### 1.3 `src/parts.ts` (new): runtime state and engine constants

```ts
import * as THREE from 'three'
import type { SlotName } from './still'
import type { AbilityDef, BeatKey } from './abilities'
import type { Enemy } from './enemy'
import type { Terrain } from './terrain'

/** Engine constants: not any one part's number. */
export const PART = {
  /** lineClear pad for melee and blasts, the same test chasers use. */
  linePad: 0.2,
  /** Pressure Vent's shove: max(novaShoveMin, def.shove − novaShoveFalloff × d). */
  novaShoveMin: 2.4,
  novaShoveFalloff: 0.35,
  boltSpeed: 26,
  /** Through-Line: the whole 16 u in about 0.2 s. */
  ghostSpeed: 80,
  /** Bounce bolts move in substeps no longer than this, so the reflection point matches the bank solver. */
  bounceSubstep: 0.2,
  /** A lob with no target lands this far ahead. */
  lobNoTarget: 6,
  /** Visual peaks (N12). */
  lobPeak: 3.2,
  throwPeak: 1.5,
  /** A zone keeps an enemy slowed this long after it steps off. */
  zoneLinger: 0.25,
  /** The sentinel keeps its answer this long, waiting for its reload. */
  answerSeconds: 4,
  /** A throw carries the enemy with the clamp for this long before the lob. */
  throwLead: 0.05,
  /** History capacity in samples; 1.5 s at 60 Hz is 90, the slack covers the Stopped slowdown. */
  historyCap: 160,
}

/** What a part has out in the world. One instance, owned by Combat, cleared in reset(). */
export interface PartRuntime {
  /** Torso window. At most one, because Ward, Mirror Ward and Brace share the slot. */
  guard: {
    kind: 'ward' | 'mirror' | 'brace'
    t: number; max: number            // seconds left / total
    radius: number                    // ward/mirror shell
    reflectsLeft: number; reflectDamage: number   // mirror
    perStrain: number                 // brace
  } | null
  /** Arms window: Anvil. Closes on the first catch. */
  anvil: { t: number; max: number; def: AbilityDef } | null
  /** Torso: the Lure decoy. At most one. */
  decoy: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef } | null
  /** Legs: the Plumb Line anchor. While it lives, the legs button is tappable (cooldown 'hold'). */
  anchor: { pos: THREE.Vector3; t: number; max: number; def: AbilityDef } | null
  /** Head: seconds since the last Patient Lens cast. Set to mod.minS on swap-in and on reset. */
  patientSince: number
}

/** Per-enemy status. Map<Enemy, EnemyStatus> in Combat; deleted when the enemy is buried. */
export interface EnemyStatus {
  markT: number      // seconds left, 0 = unmarked
  slowT: number      // seconds left, 0 = not slowed
  /** The factor applied to speedMul while slowT > 0. Divided back out on expiry: never set speedMul to 1. */
  slowMul: number
}

/** A floor strip (Frost Trail). Never shoves. */
export interface Zone { ax: number; az: number; bx: number; bz: number; halfW: number; t: number; max: number; mul: number }

/** An enemy in the clamp's throw. While held, it doesn't think. */
export interface Held { from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; short: boolean; def: AbilityDef }

export type Flip = 'x' | 'z' | 'xz'

/** How Still moves when a part moves him. Main hands it to still.startMove(). */
export interface StillMove {
  kind: 'dash' | 'hop' | 'snap' | 'rewind'
  /** Waypoints after the start, in order. A dash has one; a rewind has the recorded path. */
  path: THREE.Vector3[]
  ms: number
  /** Crosses a solid: main skips pushOut until landing. */
  vault: boolean
  /** Stick lock after landing (a vault only). */
  lockMs: number
}

/** Something happened this instant. Lasting things are polled, not evented. */
export type PartEvent =
  | { kind: 'move'; move: StillMove; beat: BeatKey }
  | { kind: 'strain'; amount: number; at: THREE.Vector3 }             // a Brace conversion
  | { kind: 'interrupt'; enemy: Enemy }                                // a windup broken (Parry, a grab)
  | { kind: 'mark'; enemy: Enemy; state: 'on' | 'consumed' | 'expired' }
  | { kind: 'slow'; enemy: Enemy; state: 'on' | 'off' }
  | { kind: 'lob'; from: THREE.Vector3; to: THREE.Vector3; ms: number; radius: number; signal: boolean }
  | { kind: 'land'; at: THREE.Vector3; radius: number; what: 'flare' | 'signal' | 'throw' | 'wall' }
  | { kind: 'throw'; enemy: Enemy; to: THREE.Vector3; ms: number; short: boolean }
  | { kind: 'path'; points: THREE.Vector3[] }                          // Ricochet's cast-time path flash
  | { kind: 'bounce'; at: THREE.Vector3; side: 'still' | 'enemy'; n: number }
  | { kind: 'pierce'; at: THREE.Vector3; n: number }                   // Cracked: one per enemy passed, n counts up
  | { kind: 'breach'; holes: BreachHole[]; open: boolean }
  | { kind: 'shield'; at: THREE.Vector3; reflected: boolean }          // a shot destroyed or turned by the shell
  | { kind: 'catch'; at: THREE.Vector3 }                               // Anvil
  | { kind: 'decoy'; state: 'spawn' | 'burst' | 'gone'; at: THREE.Vector3 }
  | { kind: 'anchor'; state: 'plant' | 'snap' | 'fade' | 'denied'; at: THREE.Vector3 }
  | { kind: 'windowEnd'; slot: SlotName; used: boolean }               // G8 end tick
  | { kind: 'cooldownStart'; slot: SlotName }                          // the anchor faded: start the HUD cooldown now

export interface BreachHole {
  id: number
  kind: 'wall' | 'prop' | 'void'
  /** Wall: the box. Prop: centre and radius. Void: the cell's centre, size CELL. */
  minX: number; maxX: number; minZ: number; maxZ: number
}

/** 1.5 s of where Still stood and what he lost. A fixed ring, no allocation per tick. */
export class History {
  private readonly x = new Float32Array(PART.historyCap)
  private readonly z = new Float32Array(PART.historyCap)
  private readonly dmg = new Float32Array(PART.historyCap)
  private readonly dt = new Float32Array(PART.historyCap)
  private head = 0
  private n = 0
  push(x: number, z: number, dmg: number, dt: number) { /* write at head, head = (head+1) % cap, n = min(n+1, cap) */ }
  /**
   * Newest → oldest samples covering `seconds` of game time (or everything held).
   * `points` is the rewind path in travel order; `damage` is the HP lost in it; `slots` are the ring indices.
   */
  window(seconds: number): { points: THREE.Vector3[]; damage: number; slots: number[] } { /* walk back summing dt */ }
  /** The sample `seconds` ago (Borrowed Time's afterimage), or null if the ring is empty. */
  at(seconds: number): THREE.Vector3 | null { /* same walk, return the last point */ }
  /** HP lost in the last `seconds` (the N10 pale segment). */
  recentDamage(seconds: number): number { /* same walk, sum dmg */ }
  zero(slots: number[]) { for (const s of slots) this.dmg[s] = 0 }
  clear() { this.head = 0; this.n = 0 }
}

/**
 * One-wall bank shot. Mirror the target across each wall face near Still, aim at
 * the mirror, and keep the shortest path whose two legs are both clear.
 * Returns the bounce point on the face (offset by `pad`, where a bolt's blocked
 * test will fire) and the axis the bolt reflects on.
 */
export function bankShot(
  terrain: Terrain, o: THREE.Vector3, t: THREE.Vector3, search: number, maxPath: number, pad = 0.15,
): { at: THREE.Vector3; flip: Flip; length: number } | null {
  let best: { at: THREE.Vector3; flip: Flip; length: number } | null = null
  for (const f of terrain.faces(o.x, o.z, search)) {
    const plane = f.at + f.normal * pad
    const oSide = ((f.axis === 'x' ? o.x : o.z) - plane) * f.normal
    const tSide = ((f.axis === 'x' ? t.x : t.z) - plane) * f.normal
    if (oSide <= 0.05 || tSide <= 0.05) continue              // both must be on the face's open side
    const mx = f.axis === 'x' ? 2 * plane - t.x : t.x
    const mz = f.axis === 'z' ? 2 * plane - t.z : t.z
    const s = oSide / (oSide + tSide)                          // where o→mirror meets the plane
    const px = o.x + (mx - o.x) * s
    const pz = o.z + (mz - o.z) * s
    const along = f.axis === 'x' ? pz : px
    if (along < f.from + 0.2 || along > f.to - 0.2) continue  // off the end of the face
    const length = Math.hypot(px - o.x, pz - o.z) + Math.hypot(t.x - px, t.z - pz)
    if (length > maxPath || (best && length >= best.length)) continue
    if (!terrain.lineClear(o.x, o.z, px, pz, pad, true) || !terrain.lineClear(px, pz, t.x, t.z, pad, true)) continue
    best = { at: new THREE.Vector3(px, 0, pz), flip: f.axis, length }
  }
  return best
}
```

### 1.4 Where each piece of runtime state lives

| state | owner | field | lifetime | reset by |
|---|---|---|---|---|
| Ward / Mirror / Brace window | Combat | `parts.guard` | `windowMs`, game time | expiry, `clearSlot('torso')`, `reset()` |
| Anvil window | Combat | `parts.anvil` | 0.9 s or the first catch | expiry, catch, `clearSlot('arms')`, `reset()` |
| Lure decoy | Combat | `parts.decoy` | 3 s, then burst | burst, `clearSlot` (no burst), `reset()` (no burst) |
| Plumb anchor | Combat | `parts.anchor` | 5 s | snap, fade, `clearSlot`, `reset()` (each emits `cooldownStart` except the snap) |
| Patient charge | Combat | `parts.patientSince` | grows with dt | cast (→ 0), `clearSlot('head')` / `reset()` (→ minS) |
| marks, slows | Combat | `status: Map<Enemy, EnemyStatus>` | per status | expiry, bury, `reset()` |
| thrown enemies | Combat | `held: Map<Enemy, Held>` | `travelMs` | landing, bury, `reset()` |
| Frost strips | Combat | `zones: Zone[]` | 3 s | expiry, `reset()` |
| breaches | Terrain (per level) | inside `makeTerrain` | 4 s | `tickBreaches`, a new level (a new terrain) |
| sentinel answer | Ranged | `answer` | 4 s or fired | fire, interrupt, expiry, dispose |
| history | Combat | `history: History` | rolling 1.5 s | `reset()` (a level change must never rewind across levels) |
| summoned adds | Combat | `summoned: WeakSet<Enemy>` | enemy life | – |
| pack size at birth | Pack | `size: number` | pack life | – |
| cooldowns | HUD | `ButtonState.readyAt` | HUD clock | unchanged (swap keeps the fraction; R8) |
| LIVE ring, icon state, charge fill | HUD (display only) | set each frame by main from Combat | – | – |
| Still move / vault / stick lock | Still | `move`, `vaulting`, `lockT` | travel + lock | `reassemble()`, a new move |

---

## 2. `useAbility`, the fire path, and strain

### 2.1 Signature

```ts
export interface CastContext {
  origin: THREE.Vector3      // Still's live position; clone anything you store
  facing: number
  moveX: number; moveZ: number
  pushed: boolean
  /** Run strain at the moment of the press (Frayed Cleaver reads it). */
  strain: number
}

export interface CastResult {
  /**
   * 'start'   the HUD starts the full cooldown now (almost everything)
   * 'hold'    the part is live and waits for a second press; the button stays tappable (Plumb plant)
   * 'refused' nothing happened: no cooldown, no strain, no push cost, no beat (Plumb snap past 10 u)
   */
  cooldown: 'start' | 'hold' | 'refused'
  /** The part's own strain for this cast (def.strain). Main adds +2 on top if pushed. */
  strain: number
  /** Face this way for the beat (arcs, grabs), or null to leave facing alone. */
  aim: number | null
  beat: BeatKey
  /** 0..1 where a beat scales (Patient Lens charge); 0 otherwise. */
  power: number
  /** Seconds to hold the pose at k = 1 (stances: Ward, Mirror, Brace, Anvil). */
  holdS: number
  /** −1 / 0 / +1: which side the head cants (Ricochet bank). */
  lean: number
}

// Combat
useAbility(def: AbilityDef, ctx: CastContext): CastResult
```

### 2.2 HUD fire path (`hud.ts`)

```ts
export type FireResult = Pick<CastResult, 'cooldown'>
onFire: (cb: (def: AbilityDef, pushed: boolean) => FireResult) => void

function fire(b: ButtonState, pushed: boolean) {
  if (!state.enabled || !b.def) return
  const r = listeners[0]?.(b.def, pushed) ?? { cooldown: 'start' }
  if (r.cooldown === 'refused') {
    b.el.classList.add('refused')                         // 0.3 s shake (CSS)
    setTimeout(() => b.el.classList.remove('refused'), 300)
    return
  }
  b.readyAt = r.cooldown === 'hold' ? state.clock : state.clock + b.def.cooldownMs
  navigator.vibrate?.(pushed ? [14, 26, 14] : 12)
}
```

The press rules don't change. A tap on a ready button fires on release. A hold
of 180 ms on a *cooling* button pushes. A `'hold'` result leaves the button
ready, so a hold during a live anchor can't push. It fires on release as a tap,
which is T's rule.

New HUD methods: `startCooldown(slot)` sets `readyAt = clock + cd`, and
`equip(def, forceFrac?: number)` (R8 passes 1). Dev only: `fireSlot(slot,
pushed)` calls `fire()`, and `setStick(x, z)` overrides `moveX`/`moveZ`.

### 2.3 `main.ts`: cast and strain

```ts
hud.onFire((def, pushed) => {
  if (run.phase !== 'crawl') return { cooldown: 'refused' }
  const r = cast(def, pushed)
  if (r.cooldown === 'refused') return r
  // the part has already landed; now it's paid for
  const cost = r.strain + (pushed ? STRAIN_PER_PUSH : 0)
  if (cost > 0) addStrain(cost, hud.buttonPoint(def.slot))
  return r
})

/** The only way strain goes up. Pips fly, the meter steps, and 20 starts the stop. */
function addStrain(n: number, from: { x: number; y: number }) {
  if (run.phase !== 'crawl' && run.phase !== 'stopping') return
  run.strain = Math.min(STRAIN_MAX, run.strain + n)
  hud.strainPips(n, from)
  if (run.strain >= STRAIN_MAX && run.phase === 'crawl') beginStopping()
}

function cast(def: AbilityDef, pushed: boolean): CastResult {
  const r = combat.useAbility(def, {
    origin: still.pos, facing: still.facing, moveX: hud.moveX, moveZ: hud.moveZ, pushed, strain: run.strain,
  })
  if (r.cooldown === 'refused') { sfx.denied(); return r }
  if (r.aim !== null) still.facing = r.aim            // replaces the old arc-only snap block in cast()
  sfx.ability(r.beat, pushed, r.power)
  still.attack({ beat: r.beat, pushed, holdS: r.holdS, power: r.power, lean: r.lean })
  castFx(def, r, pushed)
  still.group.scale.setScalar(pushed ? 1.16 : 1.08)
  shake = Math.max(shake, pushed ? 0.34 : 0.16)
  if (!MOVES.has(def.shape)) hitstop = Math.max(hitstop, pushed ? 0.06 : 0.035)   // MOVES = dash, hop, anchor, rewind
  rig.punch(pushed ? 0.06 : 0.02)
  return r
}
```

**Exactly how extra strain lands:**

| source | when | amount | path |
|---|---|---|---|
| push | after the cast resolves | +2 | `onFire` → `addStrain` |
| Overclocked Coil | every cast | +1 (a pushed cast is +3 total) | `r.strain = def.strain` → `addStrain` |
| Borrowed Time | every cast | +2 (a pushed cast is +4 total, four pips) | `r.strain = def.strain` → `addStrain` |
| Brace conversion | during the 0.8 s window, per hit that clears the 0.35 s hurt cooldown | `ceil(damage / 8)` | `hurtPlayer` → `onPart({kind:'strain'})` → `addStrain(n, screenOf(at))` |
| Plenty shrine | on use | +4 | replace the inline `run.strain = …; if ≥ 20 beginStopping()` with `addStrain(4, screenOf(shrine))` |

Every path clamps to 20 and calls `beginStopping()` on the tick it reaches 20.
Because `addStrain` runs after the cast, the part that crosses 20 still lands
(B §7, the existing push rule). A Brace conversion that crosses 20 runs inside
`combat.update`, so `run.phase` is `'stopping'` before `simulate` checks HP, and
the tick can't Break (decision 5).

---

## 3. New systems (each specced once)

### 3.1 Enemy status: mark and slow

In Combat: `private status = new Map<Enemy, EnemyStatus>()`,
`statusOf(e)` (read-only, for PartFx), and `statusFor(e)` (creates one).

```ts
mark(e: Enemy, seconds: number) {
  const st = this.statusFor(e)
  st.markT = Math.max(st.markT, seconds)                 // refresh, no stacking
  this.events.onPart({ kind: 'mark', enemy: e, state: 'on' })
}

/** Store and divide: the restore can never undo Quick (1.45 × 0.5 → 1.45). */
applySlow(e: Enemy, seconds: number, mul: number) {
  const st = this.statusFor(e)
  if (st.slowT <= 0) { e.speedMul *= mul; st.slowMul = mul; this.events.onPart({ kind: 'slow', enemy: e, state: 'on' }) }
  st.slowT = Math.max(st.slowT, seconds)                 // refresh, never stack
}

tickStatus(e: Enemy, st: EnemyStatus, dt: number) {
  if (st.markT > 0 && (st.markT -= dt) <= 0) { st.markT = 0; this.events.onPart({ kind: 'mark', enemy: e, state: 'expired' }) }
  if (st.slowT > 0 && (st.slowT -= dt) <= 0) { st.slowT = 0; e.speedMul /= st.slowMul; this.events.onPart({ kind: 'slow', enemy: e, state: 'off' }) }
  e.rime = st.slowT > 0 ? Math.min(1, e.rime + dt * 3) : Math.max(0, e.rime - dt * 2)   // presentation, read in tint()
}

/** Every part hit goes through here. The auto and Signal Flare's own 4 don't. */
hitPart(e: Enemy, damage: number): boolean {
  const st = this.status.get(e)
  let d = damage
  if (st && st.markT > 0) { d *= 2; st.markT = 0; this.events.onPart({ kind: 'mark', enemy: e, state: 'consumed' }) }
  const killed = e.hit(d)
  this.events.onHit(e.pos)
  return killed
}
```

- A slow only changes `speedMul`. Chaser and Ranged read `speedMul` only in
  `approach`, and after the R15 change the boss reads it only in its walk. So a
  slow never touches a windup, strike, recover or rush, and nothing else is
  needed for that rule.
- `knockMul` is never touched by a slow (B #5).
- Marks double *damage only*. Knockback, yanks and throws are applied from the
  def's numbers, never from the doubled damage.
- `status` is ticked for every enemy, asleep ones included, at the top of the
  enemy loop (§3.10).
- `Enemy` gains `rime: number` (0..1). Each class's `tint()` lerps `jointMat`
  toward `0x9fb4c8` by `rime` and `mat` by `rime × 0.5` (N4b, legs first).

### 3.2 Windup interrupt

`Enemy` gains `interrupt(): boolean`. It returns true if a windup was broken.

```ts
// Chaser
interrupt() {
  if (this.phase !== 'windup') return false
  this.phase = 'approach'; this.timer = 0
  this.ringMat.opacity = 0; this.discMat.opacity = 0; this.disc.scale.setScalar(0.001)
  this.core.scale.setScalar(1)
  return true
}
// Ranged
interrupt() {
  if (this.phase !== 'windup') return false
  this.phase = 'approach'; this.timer = 0; this.locked = false
  this.reload = RANGED.reloadMs                     // otherwise it re-winds on the same tick
  this.lineMat.opacity = 0; this.fillMat.opacity = 0; this.fill.scale.z = 0.001
  this.answer = null
  return true
}
// Assembler
interrupt() { return false }
```

Combat emits `onPart({ kind: 'interrupt', enemy })`. `main` stops the tone:

```ts
case 'interrupt':
  windups.get(ev.enemy)?.(true); windups.delete(ev.enemy)     // hard cut
  tellBreak(ev.enemy)                                         // N9: 14 COLD sparks on the tell's outline
  sfx.parryBreak(panOf(ev.enemy.pos)); hitstop = Math.max(hitstop, 0.09)
```

`audio.windup`/`aim` return `(hard = false) => void`. When `hard` is true it
does `g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(0, now)`
instead of the 10 ms fade. `onGone` keeps the fade.

### 3.3 Target override (Lure)

In the enemy loop, awake branch only:

```ts
private targetFor(e: Enemy, player: THREE.Vector3): THREE.Vector3 {
  const d = this.parts.decoy
  if (!d || e.kind === 'boss') return player
  return Math.hypot(e.pos.x - d.pos.x, e.pos.z - d.pos.z) <= d.def.range ? d.pos : player
}
```

- `EnemyAction` melee gains `reach?: number`. The Chaser returns
  `{ kind: 'melee', damage, reach: CHASER.strikeRadius }`.
- Resolving it: `if (target === player || dist(e, player) <= (action.reach ?? 0)) hurtPlayer(action.damage, 'melee')`.
  A strike aimed at the decoy whose ring also covers Still still hurts him (B).
- A sentinel aiming at the decoy fires a normal shot. It hits whatever is in
  its path, Still included.
- Leash, wake and sleep keep reading `player`. The decoy never wakes or holds a
  pack.
- The boss is never overridden. Its summoned adds are Chasers, so they obey.

### 3.4 Ground zones (Frost Trail)

`zones: Zone[]` in Combat. They tick in `tickParts`. Each tick, for every
enemy:

```ts
for (const z of this.zones) {
  if (distToSegment(e.pos.x, e.pos.z, z.ax, z.az, z.bx, z.bz) <= z.halfW + e.radius * 0.5) {
    this.applySlow(e, PART.zoneLinger, z.mul)
    break
  }
}
```

A zone never shoves. The boss is slowed (its walk) and never tripped. The
charger trip hook is out of scope (§8).

### 3.5 Bounce, the bank solver, and the answer shot

**Terrain additions:** `blocker(x, z, pad, see): 'wall' | 'prop' | null`
('wall' is a `Box` or off-floor, 'prop' is a `Circle`), and
`faces(x, z, r): WallFace[]`.

```ts
export interface WallFace { axis: 'x' | 'z'; at: number; normal: 1 | -1; from: number; to: number }
```

`faces` returns the four faces of each un-breached `Box` whose nearest point is
within `r`. Circles have no faces.

**Bolt reflection** (bolts with `bouncesLeft`, and shots with `bouncesLeft`). A
bounce bolt moves in substeps of ≤ `PART.bounceSubstep`. At each substep:

```ts
const hit = this.terrain.blocker(p.x, p.z, 0.15, true)
if (hit === 'wall' && b.bouncesLeft > 0) {
  const px = p.x - b.dir.x * step, pz = p.z - b.dir.z * step          // last clear point
  const hx = this.terrain.blocked(px + b.dir.x * step, pz, 0.15, true)
  const hz = this.terrain.blocked(px, pz + b.dir.z * step, 0.15, true)
  const flip: Flip = hx && !hz ? 'x' : hz && !hx ? 'z' : 'xz'
  if (flip !== 'z') b.dir.x = -b.dir.x
  if (flip !== 'x') b.dir.z = -b.dir.z
  p.set(px, p.y, pz); b.mesh.rotation.y = Math.atan2(b.dir.x, b.dir.z)
  b.bouncesLeft--; b.bounces.push({ at: p.clone(), flip })
  this.events.onPart({ kind: 'bounce', at: p.clone(), side: 'still', n: b.bounces.length })
} else if (hit) { /* existing: smashNear, onShotBlocked, ring, spent */ }
```

Props (circles) absorb a bolt, so they never bounce it. Breakables smash, as
today.

**Bank solver:** `bankShot()` in §1.3. It's used at cast time and, throttled to
every 0.1 s, for the ready-state wall tick (T H4).

**The answer.** When a Still bolt with `bounces.length > 0` hits a live
`Ranged`:

```ts
const last = b.bounces[b.bounces.length - 1]!                // the bounce nearest the sentinel
;(e as Ranged).setAnswer({ at: last.at.clone(), flip: last.flip, bounces: b.bounces.length })
```

Ranged:

```ts
private answer: { at: THREE.Vector3; flip: Flip; bounces: number; t: number } | null = null
setAnswer(a) { this.answer = { ...a, t: PART.answerSeconds } }
// update(): tick answer.t; null at 0
// approach: answer takes precedence over sight, range and band
if (this.answer && this.reload <= 0) {
  this.phase = 'windup'; this.timer = RANGED.windupMs
  this.aim = Math.atan2(this.answer.at.x - this.pos.x, this.answer.at.z - this.pos.z)
  this.locked = true                                   // no tracking: it aims at the bounce, not at you
  this.answering = true
}
// windup end: action = { kind: 'shot', dir, damage: RANGED.damage, bounces: this.answer.bounces }; this.answer = null; this.answering = false
```

Combat fires it: `fireShot(e.pos, action.dir, action.damage, e, action.bounces ?? 0)`.
Because the shot reflects with the same code, it retraces the bolt's path to
where Still fired from. The right play is bank, then move (B).

**The bent aim strip.** Ranged adds `bendLine`/`bendFill` (the same
`strip(0.62|0.3, 16)` meshes) and an ember `tick` box (0.12 × 0.12 × 0.12), all
children of `tellGroup`. While answering:

- the main `line`/`fill` scale their z by `leg1 / 16`, where `leg1 = |at − pos|`;
- `bendLine`/`bendFill` sit at local `(0, 0.004, leg1)` with
  `rotation.y = reflAim − aim`, where `reflAim` is `−aim` for flip x,
  `π − aim` for flip z, and `aim + π` for xz;
- the `tick` sits at local `(0, 0.9, leg1)` (wall-top height).

They're hidden otherwise. The bend draws only the first bend, which is enough of
a read.

### 3.6 Terrain breach

**Interface (`terrain.ts`):**

```ts
blocked(x: number, z: number, pad?: number, see?: boolean): boolean
lineClear(ax: number, az: number, bx: number, bz: number, pad?: number, see?: boolean): boolean
blocker(x: number, z: number, pad: number, see: boolean): 'wall' | 'prop' | null
/** Every solid piece and void cell the segment crosses stops blocking sight and projectiles for `seconds`. Returns the new holes. */
breach(ax: number, az: number, bx: number, bz: number, seconds: number): BreachHole[]
/** Advance breaches. Returns the holes that closed this tick. */
tickBreaches(dt: number): BreachHole[]
faces(x: number, z: number, r: number): WallFace[]
```

`main.ts` `OPEN` gets stubs (`breach: () => []`, `tickBreaches: () => []`,
`faces: () => []`, `blocker: () => null`).

**Implementation (`dungeon.ts` `makeTerrain`):** give `Box` and `Circle` an
`id` (and, for barriers, `inst?: { piece: Piece; index: number }`).

```ts
const breached = new Map<Box | Circle, number>()      // seconds left
const voidBreach = new Map<string, number>()          // off-floor cell key → seconds left
const hits = (x, z, r, see = false) => {
  if (!onFloor(x, z) && !(see && voidBreach.has(key(cellOf(x), cellOf(z))))) return true
  for (const b of near(boxIndex, x, z)) { if (see && breached.has(b)) continue; /* existing */ }
  for (const c of near(circleIndex, x, z)) { if (c.dead || (see && breached.has(c))) continue; /* existing */ }
  return false
}
breach(ax, az, bx, bz, s) {
  // sample every 0.2 u: each box or live circle containing the sample (pad 0.15) → breached.set(max);
  // each off-floor sample → voidBreach.set(max). Return the ones that weren't already open.
}
```

`blocked`, `lineClear` and `blocker` pass `see` through. `pushOut`,
`clampMove` and `nextStep` (and its private `clear`) never pass it, so
**movement and pathing never honour a breach**.

**Call sites set to `see = true`:** the Still bolt loop, the enemy shot loop,
`Combat.clearShot` (the auto, the Lens's line check, Ricochet),
`Ranged.update`'s `sight`, and `bankShot`. **Stay solid:** Chaser windup, boss
`inSight` (sweep, magnet), the shockwave shadow and reach, every arc/nova/burst
line check, dash/hop/snap/throw clamps, and loot placement.

**Visuals (N6):** Combat emits `breach` open and closed. PartFx draws a cold rim
per wall hole, and a cold ring at the base per prop hole (void holes get
nothing). The rim burns shorter over 4 s, flickers in the last second, and
flares ember for 0.1 s whenever an enemy shot or a live aim strip crosses its
hole. `level.fadeSolid(id, on)` hides that barrier's instance (matrix scale 0)
and adds a clone mesh of the piece at opacity 0.3. It restores on close. This
needs `buildInstanced` to set `inst.name = piece`, and dungeon to record each
barrier box's `index` within its piece. The fade is optional polish; the rule
works without it.

### 3.7 Two-press part state (Plumb Line)

The state machine lives in `useAbility` and `tickParts`. The HUD sees it only
through `CastResult.cooldown` and `startCooldown`.

```
                tap (ready)                     tap, dist ≤ 10
   READY ───────────────────▶ ANCHORED ─────────────────────▶ COOLING ──(9 s)──▶ READY
     ▲        result 'hold'   (button ready,    result 'start'   ▲
     │                         LIVE draining)                    │
     │                              │ tap, dist > 10              │
     │                              ├──▶ ANCHORED (refused, shake, anchor kept)
     │                              │ 5 s elapse                   │
     │                              └──▶ event cooldownStart ──────┘
     │                                                             │
     └────────── hold ≥ 180 ms on COOLING: plant now, +2 ◀─────────┘ (result 'hold' → ANCHORED)
```

Swapping out while ANCHORED emits `cooldownStart`. The incoming part inherits
fraction 1.0 (R8).

### 3.8 The 1.5 s history ring buffer

`History` in §1.3. Combat owns `history`. At the end of `update()`:
`this.history.push(player.x, player.z, this.tickDamage, dt); this.tickDamage = 0`.
`hurtPlayer` adds the HP it actually removes to `tickDamage` (0 for a negated or
converted hit). `reset()` clears it. It records whether or not Borrowed Time is
equipped, so a Borrowed Time picked up mid-fight works at once.

### 3.9 Held (thrown) enemies

`held: Map<Enemy, Held>`. In the enemy loop, before the pack-state branch:

```ts
const h = this.held.get(e)
if (h) {
  h.t += dt
  const k = Math.min(1, Math.max(0, (h.t - PART.throwLead) / (h.T - PART.throwLead)))
  e.pos.lerpVectors(h.from, h.to, k)
  e.knock.set(0, 0, 0)
  e.idle(dt, h.to)                                      // presentation only: it doesn't think
  e.group.position.y = Math.sin(k * Math.PI) * PART.throwPeak   // N12
  if (h.t >= h.T) { this.held.delete(e); this.landThrow(e, h) }
  continue
}
```

### 3.10 The enemy loop, in full order

```ts
for (let i = this.enemies.length - 1; i >= 0; i--) {
  const e = this.enemies[i]!
  if (e.dead) { this.bury(i); continue }                  // decision 6
  const st = this.status.get(e); if (st) this.tickStatus(e, st, dt)
  this.applyZones(e)
  if (/* held */) { ...; continue }                       // §3.9
  const pack = this.packOf.get(e)
  if (pack && pack.state !== 'awake') { /* existing sleep/return */ continue }
  const target = this.targetFor(e, player)                // §3.3
  const before = e.phase
  const action = e.update(dt, target, this.terrain)
  /* existing phase events */
  if (action?.kind === 'melee' && (target === player || dist(e, player) <= (action.reach ?? 0))) this.hurtPlayer(action.damage, 'melee')
  if (action?.kind === 'shot') this.fireShot(e.pos, action.dir, action.damage, e, action.bounces ?? 0)
  if (action?.kind === 'shots') { for (const d of action.dirs) this.fireShot(action.from, d, action.damage, e); this.events.onVolley(action.from) }
  /* wave, summon (adds go into this.summoned), pull: existing */
  if (e.dead) this.bury(i)
}
```

`bury(i)` is the existing dead branch, plus `status.delete(e)`,
`held.delete(e)`, and passing `summoned.has(e)` to `onKill`. After the enemy
loop: `tickParts(dt)` (guard, anvil, decoy, anchor, patient, zones, and
`terrain.tickBreaches`), then the auto, the bolts, the pull, the waves,
`later`, the shots and the fx (existing order), and finally the history push.

### 3.11 `hurtPlayer`

```ts
private hurtPlayer(damage: number, source: 'melee' | 'shot' | 'wave') {
  if (this.hurtCooldown > 0) return
  if (source === 'melee' && this.parts.anvil) { this.catchBlow(); this.hurtCooldown = 0.35; return }   // Anvil first
  const g = this.parts.guard
  if (g?.kind === 'brace') {
    this.hurtCooldown = 0.35
    this.events.onPart({ kind: 'strain', amount: Math.ceil(damage / g.perStrain), at: this.lastPlayer.clone() })
    return
  }
  this.hp = Math.max(0, this.hp - damage)
  this.tickDamage += damage
  this.hurtCooldown = 0.35
  this.events.onPlayerHurt(damage)
}
```

Callers: chaser and boss melee → `'melee'`, the shot loop → `'shot'`, the wave
→ `'wave'`. `lastPlayer` is the `player` vector Combat was last updated with.

### 3.12 Drop tables (`loot.ts`, `main.ts`)

```ts
export type DropSource = 'kill' | 'crate' | 'elite' | 'plenty' | 'boss-blue' | 'boss-gold'
export const LOOT = {
  /** One pack pays out about this many parts, whatever its size. */
  packPayout: 0.66,
  odds: {
    kill:   { white: 0.60, blue: 0.40, gold: 0 },
    crate:  { white: 0.60, blue: 0.40, gold: 0 },
    elite:  { white: 0.15, blue: 0.75, gold: 0.10 },
    plenty: { white: 0.15, blue: 0.75, gold: 0.10 },
  } as Record<'kill' | 'crate' | 'elite' | 'plenty', Record<Tier, number>>,
  pickupRadius: 1.15, crateParts: 0.1, crateScrap: 0.3, scrapHeal: 20,
}
const GATES: Record<DropSource, DropGate[]> = {
  kill: ['any'], crate: ['any'], elite: ['any', 'rare'], plenty: ['any', 'rare'],
  'boss-blue': ['any', 'rare', 'boss'], 'boss-gold': ['any', 'rare', 'boss'],
}
export function rollPart(from: Archetype, taken: readonly AbilityDef[], source: DropSource, excludeSlot?: SlotName): AbilityDef | null {
  // pool = READY ∩ not taken ∩ gate ∩ slot !== excludeSlot
  // first tier: boss-blue → 'blue', boss-gold → 'gold', else pickWeighted(LOOT.odds[source])
  // fallback order: [first, 'blue', 'white', 'gold'] (boss-gold: gold, blue, white), then the existing slot-weighted pick
}
```

- `Pack` gains `size` (members at `addPack`/`addBoss`). `onKill` gains
  `summoned: boolean`.
- `export function dropChance(pack, wasElite, summoned): number` in `loot.ts`:
  0 if `summoned`; 1 if owed (the existing side-room last kill, or an elite);
  otherwise `LOOT.packPayout / pack.size`. `maybeDrop` rolls
  `Math.random() < dropChance(…)`. Elites use `'elite'`, everyone else `'kill'`.
- Crate: `'crate'`. Plenty: `'plenty'`. `bossDown`: `const blue = rollPart('boss', taken, 'boss-blue')`,
  then `rollPart('boss', [...taken, blue], 'boss-gold', blue?.slot)`.
- `TREASURE` is unchanged (the charger/swarm rows come with those archetypes).

---

## 4. Per-part rules

Shared helpers in Combat:

```ts
/** Arm reach: the code's existing formula (R2). */
inReach(o, e, range) { return Math.hypot(e.pos.x - o.x, e.pos.z - o.z) <= range + MELEE_PAD + e.radius - 0.55 }
/** Blast reach: the existing nova formula. */
inBlast(c, e, radius) { return Math.hypot(e.pos.x - c.x, e.pos.z - c.z) <= radius + e.radius - 0.5 }
/** Solid line for melee and blasts. */
shaded(a, e) { return !this.terrain.lineClear(a.x, a.z, e.pos.x, e.pos.z, PART.linePad) }
/** Nearest within range. awakeFirst: any awake enemy beats any non-awake one; then distance. */
pickTarget(o, range, awakeFirst: boolean): Enemy | null
/** Stick direction, or facing when the stick is idle (|stick| < 0.1). Unit vector. */
steer(ctx): { x: number; z: number }
/** Shove e away from (cx, cz) by `dist` × knockMul. */
shoveFrom(e, cx, cz, dist) { e.knock.addScaledVector(shoveVelocity(e.pos.x - cx, e.pos.z - cz, dist), e.knockMul) }
spawnBolt(opts: { from, dir, damage, radius, range, speed?, part, pierced?, once?, ghost?, bounces?, scale? }): Bolt
```

`Bolt` becomes:

```ts
interface Bolt {
  mesh: THREE.Mesh; dir: THREE.Vector3; life: number; damage: number; radius: number; speed: number
  part: boolean                            // consumes marks (hitPart); false for the auto
  pierced?: Set<Enemy>                     // pierce / pierceAll: hit each once, keep going
  once?: Set<Enemy>                        // Coil: shared by the volley; skip anyone in it, stop on a new hit
  ghost?: boolean                          // Through-Line: ignores terrain; smashes breakables it passes within radius + 0.4
  bouncesLeft: number                      // 0 = no bounce
  bounces: { at: THREE.Vector3; flip: Flip }[]
}
```

`Shot` gains `owner?: Enemy` and `bouncesLeft: number`, and
`fireShot(from, dir, damage, owner?, bounces = 0)`.

### 4.1 HEAD

**Focusing Lens** (bolt). `t = nearest(o, 13)` (no line needed; walls stop the
bolt), `aim = t ? angle(o→t) : facing`. `spawnBolt({damage 26, radius 0.85,
range 13, part: true})`. Unchanged apart from `part: true`.

**Flare** (lob).
1. `t = pickTarget(o, 11, awakeFirst)`.
2. `to = t ? t.pos.clone() : ahead(o, facing, min(11, PART.lobNoTarget))`.
   `ahead` steps back 0.5 u at a time toward `o` while `blocked(p, 0.01)`, so
   it never lands inside a solid or the void.
3. Emit `lob {from: o, to, ms: 800, radius: 2.0, signal: false}`.
4. `later(0.8)`: for each enemy with `dist(e, to) ≤ 2.0 + e.radius`,
   `hitPart(e, 18)`. **No line check** (it arced over the wall). Smash
   breakables within `2.0 + b.r`. Emit `land {what: 'flare'}`.
- Edges: it can't miss a sleeper that doesn't move. Against a hidden sentinel,
  18 < 20 (B #9). On the boss the reach is 2.0 + 1.6.

**Cracked Lens** (bolt, pierce). As the Lens, with `pierced: new Set()`. Each
pass emits `pierce {at, n}` with n = 1, 2, 3… (for the rising pitch). Walls stop
it.

**Ricochet Lens** (bolt, bounce).
1. `t = pickTarget(o, 20, awakeFirst)`.
2. If `t` and `!lineClear(o, t, 0.15, see)`, then
   `bank = bankShot(terrain, o, t.pos, 8, 20)`.
3. `aim = bank ? angle(o→bank.at) : t ? angle(o→t) : facing`.
   `r.lean = bank ? sign(sin(aim − facing)) || 1 : 0`.
4. `spawnBolt({damage 18, radius 0.7, range 20, part, bounces: 2})`.
5. Emit `path {points: bank ? [o, bank.at, t.pos] : [o, t?.pos ?? ahead(o, facing, 20)]}`.
- The bolt stops on its first enemy. A banked hit on a `Ranged` arms its answer
  (§3.5). A banked hit on a hulk or the boss arms nothing, because only
  sentinels shoot.
- A second bounce can happen naturally. `bounces.length` feeds the answer's
  bounce count.
- With a clear line it's just a weaker Lens (B).

**Patient Lens** (bolt, charge).
1. `c = ctx.pushed ? 1 : clamp01((parts.patientSince − 1.5) / 6)`,
   `dmg = 6 + 26c`, `r.power = c`.
2. Set `parts.patientSince = 0`.
3. Target and aim as the Lens. `spawnBolt({damage: dmg, radius 0.85, range 13,
   part, scale: lerp(0.3, 0.85, c) / 0.85})`.
- The HUD cooldown of 1.5 s is the "can't fire before 1.5 s unless pushed" rule.
  A push inside it fires at 32 (B #18).
- `clearSlot('head')` (a swap) and `reset()` set `patientSince = 1.5` (B #17).
- Pause and hitstop don't charge it (game time).

**Signal Flare** (lob, mark). As Flare with `range 11`, `radius 2.2`,
`signal: true`. At landing, for each enemy in `2.2 + e.radius`:
`e.hit(4); onHit(e.pos); mark(e, 4)`. It uses a plain `hit`, so its own 4 never
consumes a mark (B). Emit `land {what: 'signal'}`.
- Consumption is `hitPart` (§3.1). The auto uses `e.hit`, so it never consumes.
- Every part hit consumes: bolts (`part: true`), a reflected Mirror bolt, dash
  and snap run-overs, novas, bursts, the Anvil counter, the throw landing
  (splash and wall damage after the first hit are not doubled), and the Lure
  burst.
- Coil: the first bolt that lands consumes it.
- Marks work on the boss.

**Through-Line** (bolt, pierceAll).
1. `t = pickTarget(o, 16, awakeFirst: true)` (owner decision).
   `aim = t ? angle : facing`.
2. `spawnBolt({damage 24, radius 0.6, range 16, speed: PART.ghostSpeed, part,
   pierced: new Set(), ghost: true})`.
3. `holes = terrain.breach(o.x, o.z, o.x + dir.x·16, o.z + dir.z·16, 4)`, then
   emit `breach {holes, open: true}`.
- It hits every enemy on the line once. Breakables on the line are smashed.
- Both sides: see §3.6 for the call-site list.
- Sleeping packs are woken by the damage, as usual (B #11). The quiet farm is
  already closed.

**Overclocked Coil** (bolt, fan).
1. `t = nearest(o, 12)`, `aim` as the Lens.
2. `once = new Set()`. For each k in 0..2: `off = (k − 1) × 0.26`,
   `spawnBolt({damage 14, radius 0.6, range 12, part, once})`.
3. `r.strain = 1`.
- In the bolt loop, `once` bolts skip any enemy already in `once`, and add and
  stop on a new one (B #3). The ±0.26 rad spread is kept from the code.
- At strain 19, a tap fires and then Stops (B #19). The warning is §5.3.

### 4.2 TORSO

**Pressure Vent** (nova). For each enemy with `inBlast(o, e, 4.3) &&
!shaded(o, e)`: `hitPart(e, 15)`, then
`shoveFrom(e, o, max(2.4, 4.2 − 0.35d))`, plus the existing grey hit ring.
Breakables within `4.3 + b.r` smash (no line check).

**Ward** (ward).
`parts.guard = {kind: 'ward', t: 1.4, max: 1.4, radius: 1.8, reflectsLeft: 0, …}`.
`r.holdS = 1.4`.
- **In the shot loop**, before the player-contact test: if a guard of kind ward
  or mirror is live and `dist(shot, player) < guard.radius`, then:
  - ward: remove the shot and emit `shield {reflected: false}`;
  - mirror with `reflectsLeft > 0`: see Mirror Ward.
- It does nothing to melee, waves or pulls.
- A push during the window reopens it at full (same code path).
- At expiry, emit `windowEnd {slot: 'torso', used: shotsDestroyed > 0}`.

**Backdraft Vent** (nova, pull). As the Vent, but for each hit:
`e.knock += shoveVelocity(−ox, −oz, max(0, d − 1.4)) × knockMul` (the existing
code). Damage 12, radius 5.2, line check.

**Chill Vent** (nova, slow). As the Vent without the shove:
`hitPart(e, 10); applySlow(e, 3, 0.5)`. Line check. The ring life is 0.55
(presentation).

**Brace** (nova, brace).
1. Blast: `inBlast(o, e, 2.6) && !shaded` → `hitPart(e, 8)`, no shove.
2. `parts.guard = {kind: 'brace', t: 0.8, max: 0.8, perStrain: 8, …}`,
   `r.holdS = 0.8`.
- Conversion is in §3.11. `ceil(8/8) = 1` for a shot, `ceil(9/8) = 2` for a
  slam, 3 for the charge's 22.
- The hurt cooldown gates conversions exactly as it gates damage.
- A converted hit that reaches 20 Stops Still (decision 5).
- It never lowers strain.
- Converted hits record 0 damage in the history, so a rewind won't "restore"
  them (B #16).

**Mirror Ward** (ward, reflect).
`guard = {kind: 'mirror', t: 0.8, max: 0.8, radius: 1.8, reflectsLeft: 6, reflectDamage: 8}`,
`r.holdS = 0.8`. In the shot loop, when a shot reaches 1.8 and
`reflectsLeft > 0`:
1. `reflectsLeft--`.
2. `dir = s.owner && !s.owner.dead ? unit(owner.pos − shot.pos) : −s.dir`.
3. `spawnBolt({from: shot.pos, dir, damage 8, radius 0.3, range 20, part: true})`.
   Walls stop it (see mode).
4. Remove the shot and emit `shield {reflected: true}`.
- After 6 reflections, shots pass the shell untouched (B #12).
- Reflected bolts pass through a breach, which makes the Through-Line + Mirror
  combo (B) work.

**Lure** (decoy).
1. If `parts.decoy` exists (a pushed recast), `burstDecoy()` first (R9).
2. `dir = steer(ctx)`. `p = clampMove(o.x, o.z, o.x − dir.x·1.5, o.z − dir.z·1.5, PLAYER_RADIUS)`.
3. `parts.decoy = {pos: V3(p), t: 3, max: 3, def}`. Emit `decoy spawn`.
- The draw is §3.3: awake non-boss enemies within 12 of the decoy, evaluated
  every tick.
- `burstDecoy()` runs at `t ≤ 0`. For each enemy with
  `inBlast(decoy, e, 3.0) && !shaded(decoy, e)`: `hitPart(e, 18)`,
  `shoveFrom(e, decoy, 1.6)`. The boss is damaged but never drawn. Breakables
  in `3.0 + b.r` smash. Then `parts.decoy = null` and emit `decoy burst`.
- `clearSlot('torso')` and `reset()` null it without bursting (R10). Emit
  `decoy gone`.
- Anti-synergy with Anvil (the decoy takes the strikes) is shown on the compare
  screen (§5.5).

### 4.3 ARMS

The shared arc routine:

```ts
const coneDeg = mod?.kind === 'fray'
  ? (ctx.strain < mod.at[0] ? mod.cones[0] : ctx.strain < mod.at[1] ? mod.cones[1] : mod.cones[2])
  : def.cone!
const coneCos = coneDeg >= 360 ? -1.01 : Math.cos((coneDeg * Math.PI) / 360)
// snap: nearest enemy in reach that the blade can actually touch
const snap = nearest of enemies with inReach(o, e, def.range) && !shaded(o, e)
const face = snap ?? this.nearest(o, 9.5)                  // nothing in reach: still face the nearest threat
const aimed = face ? angle(o→face) : ctx.facing
r.aim = aimed
const fx = Math.sin(aimed), fz = Math.cos(aimed)
for (const e of this.enemies) {
  if (!inReach(o, e, def.range)) continue
  const d = dist(o, e); if (d > 0.001 && ((e.pos.x - o.x) / d) * fx + ((e.pos.z - o.z) / d) * fz < coneCos) continue
  if (shaded(o, e)) continue                               // T: no spark, no sound through a wall
  const winding = e.phase === 'windup'
  this.hitPart(e, def.damage)
  /* per-part effect below */
}
/* breakables: the existing cone test, no line check */
this.sweep(o, aimed, def.range, 0x8fb8e8, (coneDeg * Math.PI) / 180)
```

**Scrap Cleaver:** 18, reach 3.1, 120°. No effect beyond the hit.

**Piston:** 26, reach 3.4, 40°. Effect:
`e.knock += shoveVelocity(fx, fz, 1.6) × knockMul` (along the jab, not
radial). Plated: 0.48 u. Boss: 0.08 u.

**Rusted Hook:** 12, reach 5.5, 70°. The line is required (the shared rule
covers it). Effect: `P = o + (fx, fz)·1.6`, `v = P − e.pos`; if `|v| > 0.2`,
`e.knock += shoveVelocity(v.x, v.z, |v|) × knockMul`. Plated: 30% of the way.
Boss: 5%.

**Parry Clamp:** 10, reach 2.6, 90°. Effect: if `!e.dead && winding &&
e.interrupt()`, then `shoveFrom(e, o, 2.5)` and emit `interrupt`.
- The boss's `interrupt()` returns false, so it takes the 10 and nothing else
  (B #6).
- An enemy not winding up gets the 10 and no shove.
- A sleeping enemy is never winding up.
- A Plated elite's windup is broken, but the shove is only 0.75 u.

**Frayed Cleaver:** 16, reach 3.1. The cone is picked from `ctx.strain` at the
press: 90° below 6, 180° from 6 to 11, 360° from 12. `r.beat = 'fray-90' |
'fray-180' | 'fray-360'`. At 360° the aim is irrelevant, but `r.aim` still
faces the snap.

**Clamp Toss** (grab).
1. `e = nearest with inReach(o, e, 2.4) && !shaded(o, e) && !held.has(e)`.
2. None: a whiff. A small `sweep(2.4, 90°)` plays, and the cooldown starts.
3. `r.aim = angle(o→e)`.
4. If `e.knockMul < 0.1` (the boss): `hitPart(e, 14)`, done (B).
5. If `e.phase === 'windup'` and `e.interrupt()`, emit `interrupt` (it's lifted
   out of its swing).
6. `dir = |stick| ≥ 0.1 ? unit(stick) : unit(e.pos − o)`. If that's zero, use
   facing.
7. `dist = 5 × e.knockMul` (Plated 1.5).
8. `end = clampMove(e.pos, e.pos + dir·dist, e.radius)`.
9. `short = |end − e.pos| < dist − 0.05`.
10. `held.set(e, {from: e.pos.clone(), to: V3(end), t: 0, T: 0.35, short, def})`.
    Emit `throw {enemy, to, ms: 350, short}` (PartFx draws the 1.2 landing ring
    now, and the wall tick if `short`).
- `landThrow(e, h)`:
  1. `hitPart(e, 14)`.
  2. If `h.short`: `e.hit(12)` plus `onHit`. It's not doubled: the mark was
     already consumed by the first hit.
  3. Emit `land {what: h.short ? 'wall' : 'throw'}`.
  4. Splash: each other enemy with `dist(o2, to) ≤ 1.2 + o2.radius &&
     lineClear(to, o2, 0.2)` gets `hitPart(o2, 14)` and
     `shoveFrom(o2, to, 1.2)`.
  5. Breakables in `1.2 + b.r` smash.
- A thrown enemy that dies in flight (the auto, a bolt) is buried at the top of
  the next tick. Its `held` entry goes with it, and there's no landing.
- A thrown sleeper is fine. The landing damage wakes its pack (`hpSeen`).

**Anvil** (catch). `parts.anvil = {t: 0.9, max: 0.9, def}`, `r.holdS = 0.9`,
`r.beat = 'anvil'`. `catchBlow()`, called from `hurtPlayer` when the source is
melee:
1. `parts.anvil = null`.
2. Emit `catch {at: player}`.
3. For each enemy with `inBlast(player, e, 3.0) && !shaded(player, e)`:
   `hitPart(e, 30)`, `shoveFrom(e, player, 2.0)`. Breakables in 3.0 smash.

- Catches every `melee` action: the hulk slam, boss sweep, magnet and charge,
  and (later) the charger rush and swarm bite. Shots and shockwaves are never
  caught (B #7).
- The 0.35 s hurt cooldown starts, so simultaneous strikes fold into the one
  catch.
- If the window expires without a catch, emit `windowEnd {slot: 'arms', used: false}`.
- A strike aimed at the decoy that also covers Still is caught.

### 4.4 LEGS

The shared dash routine (Kickstart, Skid Plates, Overrun, Frost Trail):

```ts
const over = mod?.kind === 'overrun' && ctx.pushed ? mod : null
const range = over?.range ?? def.range, dmg = over?.damage ?? def.damage
const width = over?.radius ?? def.radius, knock = over?.shove ?? def.shove ?? 0, ms = over?.travelMs ?? def.travelMs!
const dir = this.steer(ctx)
const end = this.terrain.clampMove(o.x, o.z, o.x + dir.x * range, o.z + dir.z * range, PLAYER_RADIUS)
if (dmg > 0) {
  for (const e of this.enemies) {
    // existing run-over: distToSegment ≤ width + e.radius, later() at reachT × ms, re-check ≤ width + 1.1 on arrival
    // on arrival: hitPart(e, dmg); knock:
    //   overrun: sideways: n = (−dir.z, dir.x); side = sign(dot(e.pos − o, n)) || 1; e.knock += shoveVelocity(n.x·side, n.z·side, knock) × knockMul
    //   else:    shoveFrom(e, o, knock)   (the existing "away from the start")
  }
}
/* breakables along the path smash (existing), for every dash, damage or not */
this.emitMove({ kind: 'dash', path: [V3(end)], ms, vault: false, lockMs: 0 }, beat)
```

Run-over has no line check (B's list doesn't include dashes). The path is
already clamped at the first wall.

**Kickstart:** 6.4 u, 12 run-over, width 1.2, knock 1.2, 280 ms.

**Skid Plates:** 5.6 u, 8 run-over, knock 1.2, 280 ms, plus
`later(0.28)` at `end`. The slam: each enemy with `inBlast(end, e, 2.8) &&
!shaded(end, e)` gets `hitPart(e, 10)` and `shoveFrom(e, end, 1.4)`, followed
by the existing ring.

**Overrun:**
- Unpushed: 4.0 u, no damage, 220 ms, `r.beat = 'overrun-step'`.
- Pushed: 9 u, 22 run-over, width 1.4, sideways knock 2.4, 300 ms,
  `r.beat = 'overrun-charge'`. The +2 is the push's.
- The charge is only reachable while cooling (R5).

**Frost Trail:** 6.4 u, no damage, no knock, 280 ms. Push
`zones.push({ax: o.x, az: o.z, bx: end.x, bz: end.z, halfW: 0.7, t: 3, max: 3, mul: 0.5})`.
The zone is live from the cast. The boss is slowed, never tripped (B #13).

**Skitter** (hop). `dir = steer`,
`end = clampMove(o, o + dir·3.4, PLAYER_RADIUS)`,
`emitMove({kind: 'hop', path: [end], ms: 180, vault: false})`. No damage, no
breakables.

**Spring Heels** (hop, vault).
1. `end = clampMove(o, o + dir·3.4, R)`.
2. If `|end − o| < 3.4 − 0.05`, scan `s` from 3.4 to 4.6 in steps of 0.1 for
   the first `p = o + dir·s` where `!blocked(p.x, p.z, R)`.
3. **One-obstacle test:** sample the segment `end → p` every 0.1 u with
   `blocked(x, z, 0.001)`. It must contain exactly one contiguous blocked run.
   Two walls with a gap between them are refused. The void always counts as
   blocked, so you can never vault out of the level.
4. If found: `emitMove({kind: 'hop', path: [p], ms: 300, vault: true, lockMs: 300})`.
   Otherwise, a plain hop to `end` (300 ms, no lock).

- Main skips `terrain.pushOut(still.pos)` while `still.vaulting`, so it isn't
  shoved back mid-air.
- Parts still fire during the lock (B).
- Enemies aren't terrain, so hopping over a hulk is just a hop.

**Plumb Line** (anchor). See §3.7.
- **Plant** (no anchor, or pushed):
  `parts.anchor = {pos: o.clone(), t: 5, max: 5, def}`,
  `r.cooldown = 'hold'`, `r.beat = 'plant'`. Emit `anchor plant`.
- **Snap** (anchor live):
  1. If `dist(o, anchor) > 10`: `r.cooldown = 'refused'` and emit
     `anchor denied` (R7).
  2. Otherwise, `end = clampMove(o, anchor.pos, R)` (it stops at walls).
     Run-over along `o → end` with the dash rule: 14 dmg, width 1.0, knock 1.2,
     240 ms.
  3. `parts.anchor = null`.
  4. `emitMove({kind: 'snap', path: [end], ms: 240})`, emit `anchor snap`,
     `r.beat = 'snap'`, `r.cooldown = 'start'`.
- **Fade:** in `tickParts`, at `t ≤ 0`: `anchor = null`, emit `anchor fade`,
  then `cooldownStart {slot: 'legs'}`.
- **Swap or reset:** as a fade (R8). Main passes `forceFrac 1` to `hud.equip`
  when the outgoing part is a live anchor.
- A snap beyond 10 u was always going to fail, which stops the "plant and snap
  back across the level" trick (B #21).

**Borrowed Time** (rewind).
1. `w = history.window(1.5)`.
2. `combat.hp = min(100, hp + w.damage)`, then `history.zero(w.slots)` (R11).
   If `w.damage > 0`, call `hud.healing()` from main on the move event.
3. `path = subsample(w.points, every 4th, keep the last)`. If it has fewer than
   one point, there's no move (a fresh level). The cast still costs its strain,
   honestly.
4. `emitMove({kind: 'rewind', path, ms: 250})`. `r.strain = 2`.
- It passes through enemies harmlessly: no run-over, no i-frames.
- It never rewinds strain, and never restores converted Brace hits (they
  recorded 0).
- It can't be pressed at 0 HP: `simulate` breaks Still on the same tick HP
  reaches 0, and the HUD is disabled after that.
- The rewind path was walkable when recorded, so `pushOut` afterwards is enough.
  It ignores a breach (movement never honours one).
- The history is cleared on a level change, so a rewind never crosses levels.

### 4.5 Edge-case matrix (every part)

| case | rule |
|---|---|
| walls | Arcs, novas, bursts, slam, counter and splash need a solid `lineClear(…, 0.2)` per target. Bolts and shots stop at walls (see mode). Lobs arc over them. Dashes, hops, snaps and throws are clamped by `clampMove`, except a vault, which crosses exactly one obstacle. Breakables are always hit without the line check. |
| sleeping packs | Everything that hits a sleeper wakes its pack (the existing `hpSeen`). Parts that ignore line of sight target awake enemies first (R3). Only awake enemies are decoyed. Statuses tick while asleep. |
| boss | `knockMul 0.05` scales every shove, yank and throw. No grab (it takes the 14), no interrupt (it takes the damage), ignores the decoy (it takes the burst). Marks, slows (walk only) and the Anvil catch apply. The Frost strip never trips it. |
| elites | Plated: `armor 0.5` halves the (possibly doubled) damage, `knockMul 0.3` scales every displacement (a throw of 1.5 u). Warden: pack armor 0.35 while it stands; nothing special for parts. Quick: slows multiply, and the restore divides (§3.1). Many: the split halves start with no status. |
| swap mid-cooldown | The existing fraction rule. Patient resets its charge to 1.5 s. A Plumb Line with a live anchor passes on fraction 1.0 (R8). |
| swap mid-window | `combat.clearSlot(oldDef.slot)` runs before `hud.equip`. Guard and anvil end (G8 expire tick), the decoy vanishes without bursting, and the anchor fades (cooldownStart). World state (throws, lobs, moves, zones, marks, slows, breaches, the history) carries on (R10). |
| pause | `simulate` doesn't run, so every part timer is frozen. The HUD clock is frozen too. `later` is game time. |
| hitstop | Combat is frozen, but the HUD clock runs (existing). Windows don't drain during hitstop, cooldowns do. Cooldown is always longer than the window, so it's harmless. |
| level change | `enterLevel` → `combat.reset()` clears guard, anvil, decoy (no burst), anchor (emits cooldownStart first), zones, statuses, held, the history, and `patientSince = 1.5`. The terrain is replaced (breaches gone). `partFx.clear()`. |
| death (Broke) | `simulate` stops calling `combat.update`. Nothing resolves. `startRun` → `enterLevel` → `reset`. |
| Stopped mid-window | The world slows (`dt → 0`) and keeps resolving at that speed. A window can still catch or convert, a decoy can still burst, and strain is clamped at 20. HP can't Break during `'stopping'`. The HUD is disabled, so nothing new is cast. `end('stopped')` → `startRun` → `reset`. |
| dead enemies | Buried at the top of the loop before they can act (decision 6). |

---

## 5. Presentation hooks

The numbers are T's, verbatim. This section says **where they plug in and what
each hook needs**. "T-H2 Beat" means the Beat bullet of part H2 in T §6.

### 5.1 The hook contracts

```ts
// still.ts
export interface AttackSpec { beat: BeatKey | 'shot' | 'anvil-slam'; pushed: boolean; holdS?: number; power?: number; lean?: number }
attack(a: AttackSpec): void          // the pose table below; holdS holds k = 1, then releases over 0.1 s (R1)
startMove(m: StillMove & { hopH: number }): void   // replaces startDash: polyline, ease 1 − (1 − k)², hop parabola on group.y
get vaulting(): boolean              // true from a vault's start until it lands
makeGhost(opacity: number): THREE.Object3D          // N7 / Borrowed echo: a clone with a ghost material, caller owns it
// R1: expose `lens`, `core`, `jawL`, `jawR`; reset head.rotation.y/z, lens.rotation.z, group.y offset and jaws at the top of animate()
// stick lock: lockT (s) counts down in update(); while > 0 the stick reads as zero

// main.ts
castFx(def: AbilityDef, r: CastResult, pushed: boolean): void    // switch on r.beat
combat events: onPart(ev: PartEvent) → partFx.event(ev) + the moment effects below

// audio.ts
ability(beat: BeatKey, pushed: boolean, power: number): void     // the 'lens' | 'vent' | 'cleaver' | 'kick' voices are today's bolt/nova/arc/dash
// + event voices: bounce(pan, n, side), pierceTick(pan, n), lobLand(pan, what), markConsumed(pan), shieldTing(), reflect(),
//   braceConvert(), anvilCatch(), anvilMiss(), parryBreak(pan), decoyBeacon(pan), decoyBurst(pan), breachWall(pan),
//   breachClose(pan), denied(), anchorFade(), tetherFar(), throwLand(pan, wall), patientFull(), frayCross(up), slowEnd(pan), windowEnd()

// hud.ts
live(slot, frac: number | null): void       // LIVE lit conic ring, draining; hides the cd sweep while set
iconState(slot, s: IconState | null): void  // repaint only on change
setClass(slot, cls: 'far', on: boolean): void
charge(slot, c: number): void               // sets --charge on the button (Patient's .charge fill-opacity)
strainPips(n: number, from: { x: number; y: number }): void   // N8
recentDamage(frac: number): void            // N10
buttonPoint(slot): { x: number; y: number } // the button's screen centre
startCooldown(slot): void
isReady(slot): boolean
```

**Every frame, in `frame()` before `hud.update`**, main sets:
- `hud.live(slot, combat.liveFrac(slot))` for each slot. `liveFrac`: torso →
  guard or decoy `t/max`; arms → anvil; legs → anchor; head → null.
- if the head part is Patient Lens: `hud.charge('head', clamp01((since − 1.5)/6))`,
  and when the charge crosses 1: `sfx.patientFull()` plus a ring pop at the
  lens (once).
- if the arms part is Frayed: `hud.iconState('arms', tier(strain))`. On a tier
  change: `sfx.frayCross(up)`, the button pulse, and the ember thread off the
  clamp (T §4.4).
- if the legs part is Plumb: `hud.iconState('legs', anchor ? 'snap' : null)`,
  and `hud.setClass('legs', 'far', anchor && dist > 10)`. On the far flag
  turning true: `sfx.tetherFar()`.
- if the legs part is Borrowed Time:
  `hud.recentDamage(history.recentDamage(1.5) / 100)`.

**PartFx.update** draws from state:
- the guard shell (N5; drain = t/max; Mirror's sweep highlight);
- the Brace ember cage motes;
- the Anvil feet ring (1.0 → 0.3) and clamp glints;
- the decoy (N7 ghost at `decoy.pos`, pulse ring every 0.75 s, the burst ring
  closing in the last 0.6 s, `sfx.decoyBeacon` every 0.75 s);
- the anchor bob, its draining ring and the tether (N2; dashed and grey past
  10; ends at the wall with a tick where `clampMove` would stop);
- the Borrowed echo at `history.at(1.5)` while `hud.isReady('legs')`
  (opacity 0.14);
- the Ricochet ready tick: the bank point from `bankShot`, every 0.1 s, while
  the head is ready and the nearest target has no line;
- mark badges (N3) and rime motes (N4a) from `statusOf`, with the crowd rule
  (T §3);
- zone strips (N1 strip, thinning from the edges);
- breach rims (N6);
- lob globs (N12, peak 3.2) and landing previews (N1 ring 2.6 → 2.0 or
  2.4 → 2.2, the same contraction for the throw 1.4 → 1.2), both from the
  `lob`/`throw` events;
- path flashes (N2, 0.15 s at y 1.0).

### 5.2 Per-part table

Beat = `r.beat` (the pose and voice key). Dur/hold is the `attack()` duration
and `holdS`. "Needs" lists the inputs beyond the beat. castFx is the recipe run
at the press (T VFX "cast" lines). Events are the `onPart` kinds this part
produces, each with its T VFX + SFX line.

| part | beat | dur / hold | needs | castFx (T) | voice (T SFX) | events → moment fx | icon / HUD | LIVE |
|---|---|---|---|---|---|---|---|---|
| Focusing Lens | lens | 0.30 / 0 | – | existing bolt | existing bolt | – | icon | – |
| Flare | flare | 0.34 / 0 | – | T-H2 cast | T-H2 cast *thoop*, no flight whistle | lob → glob + ring; land → T-H2 land fx + land voice, panned | icon | – |
| Cracked Lens | cracked | 0.26 / 0 | – | T-H3 | T-H3 | pierce(n) → 5 sparks + tick up 2 semitones per n | icon | – |
| Ricochet Lens | ricochet | 0.30 / 0 | lean | T-H4 | T-H4 | path → N2 flash; bounce(still) → wall-top flash + ping (2nd a fifth up); bounce(enemy) → same ping | icon; ready wall tick (PartFx) | – |
| Patient Lens | patient | 0.26 + 0.14·power / 0 | power | T-H5, scaled by power | T-H5, tail by power | – | icon; `.charge` fill = --charge while ready, ember full while cooling | – |
| Signal Flare | signal | 0.30 / 0 | – | T-H6 | T-H6 cast | lob (sputter glob); land → chime; mark on → badge; consumed → slam + two flashes 60 ms apart + doubled hit; expired → quiet fade | icon | – |
| Through-Line | through | 0.42 / 0 | – | T-H7 draw + fire | T-H7 | breach open → per wall: chunks + dust on both faces, breachWall; breach close → breachClose, dust | icon | – |
| Overclocked Coil | coil | 0.22 / 0 | – | T-H8 (3 flashes, head embers) | T-H8 (3 voices + small grind) | – | icon; pip ● | – |
| Pressure Vent | vent | 0.42 / 0 | – | existing nova | existing nova | – | icon | – |
| Ward | ward | 0.35 / 1.4 | – | T-T2 | T-T2 | shield → 8 sparks + ting; windowEnd → G8 tick | icon | guard |
| Backdraft Vent | backdraft | 0.42 / 0 | – | T-T3 (gather, inward dust) | T-T3 (reverse swell) | – | icon | – |
| Chill Vent | chill | 0.42 / 0 | – | T-T4 (ring life .55, frost, no dust) | T-T4 | slow on → rime starts; slow off → 3 chunks + glass tick (slowEnd) | icon | – |
| Brace | brace | 0.40 / 0.8 | – | T-T5 | T-T5 setting | strain → 10 ember sparks into the core, braceConvert **replaces** the hurt sound, no hurt flash; pips from Still's screen point | icon; hollow pip ○ | guard |
| Mirror Ward | mirror | 0.30 / 0.8 | – | T-T6 | T-T6 | shield(reflected) → flash + reflect voice; the new bolt trails cold | icon | guard |
| Lure | lure | 0.35 / 0 | – | T-T7 | T-T7 doubled voice | decoy spawn → ghost; burst → T-T7 burst (no shatter cluster); gone → quiet fade | icon | decoy |
| Scrap Cleaver | cleaver | 0.34 / 0 | aim | existing arc | existing arc | – | icon | – |
| Piston | piston | 0.28 / 0 | aim | T-A2 (beam 3.4 × 0.5 in the sweep) | T-A2 (hit / miss variants: miss if no onHit this cast) | – | icon | – |
| Rusted Hook | hook | 0.36 / 0 | aim | T-A3 | T-A3 | per yanked enemy: N2 tether 0.2 s + trail (PartFx reads the knock vectors this tick) | icon | – |
| Parry Clamp | parry | 0.26 / 0 | aim | T-A4 snip | T-A4 snip | interrupt → N9 + parryBreak + hitstop 0.09 + rig.punch(.05); boss hit with no cancel → one cold spark off the ember sector | icon | – |
| Frayed Cleaver | fray-90/180/360 | 0.30 / 0.34 / 0.40 | aim | T-A5 (sparks 7/12/20, ember fray at 12+) | T-A5 (tear by tier) | – | iconStates by strain tier; strain notches at 6 and 12 while equipped | – |
| Clamp Toss | toss | 0.40 / 0 | aim | T-A6 grab | T-A6 grab + throw whoosh | throw → landing ring (+ wall tick if short); land/wall → T-A6 land or wall fx + throwLand | icon | – |
| Anvil | anvil (then anvil-slam) | 0.30 / 0.9 | – | T-A7 raise | T-A7 raise | catch → `still.attack({beat: 'anvil-slam'})`, T-A7 catch fx, anvilCatch, hitstop 0.09, **no hurt vignette**; windowEnd(unused) → anvilMiss + clamp dust | icon | anvil |
| Kickstart | kick | 0.30 / 0 | – | existing (none) | existing dash | move → existing onDash fx (dust, sparks, shake, punch) | icon | – |
| Skitter | skitter | 0.26 / 0 | hopH 0.35 | T-L2 takeoff dust | T-L2 takeoff | move → ghosts; landing dust + landing step (on arrival) | icon | – |
| Skid Plates | skid | 0.42 / 0 | – | – | T-L3 dash + scrape | move → dash fx; slam at arrival → T-L3 ring + sparks | icon | – |
| Overrun | overrun-step / overrun-charge | 0.22 / 0.30 | – | T-L4 step or charge (N2 wake) | T-L4 step or charge | per hit → sparks perpendicular to the path | icon; `.push` path at .35 while ready, ember while cooling; first-cooling pulse once per save (`localStorage` key `still.pushHint.overrun`, try/catch) | – |
| Frost Trail | frost | 0.30 / 0 | – | T-L5 | T-L5 icy dash | move → frost motes along the path; the zone strip is drawn by PartFx | icon | – |
| Spring Heels | spring | 0.40 (+0.30 lock pose if vault) | hopH 0.9, vault | T-L6 takeoff | T-L6 takeoff | move → on arrival: vault landing dust ring + heavy landing voice, or a light one | icon | – |
| Plumb Line | plant / snap | 0.30 / 0.24 | – | T-L7 plant or snap | T-L7 plant or snap | anchor plant → bob; snap → ghosts + wake + arrival flash, bob shatters; fade → motes + anchorFade; denied → button shake (HUD) + denied tick | icon ⇄ snap; `.far` past 10 | anchor |
| Borrowed Time | rewind | 0.30 / 0 | – | T-L8 | T-L8 + grind every cast | move → reversed ghost chain; on arrival gather(core, 12) + the echo merges; pale segment refills | icon; pips ●● | – |

The pushed dressing is unchanged for every part (pitch ×0.8, gain ×1.3,
`grind()`, embers, a bigger punch). Only Patient Lens and Overrun *behave*
differently when pushed.

### 5.3 HUD strain language (T §4)

- **Pips (N8).** `strainPips(n, from)` spawns `min(n, 4)` 7 px ember dots that
  fly to the strain meter in 0.35 s ease-in. The meter's *displayed* fill is
  `strain − pending`. Each arriving pip decrements `pending` and bumps the meter
  1 px. The logic value is already final, so Stopped starts on time.
- **Notches (N8b).** While the loadout contains a `fray` mod, draw ticks at
  6/20 and 12/20 on `#strain`.
- **Last-push warning.** Per button:
  `cost = (ready ? 0 : 2) + (def.strain ?? 0)`. If `cost > 0 && strain + cost ≥ 20`,
  add `.last`. `.pushable.last` replaces the bright rim with a dim 0.6 Hz
  pulse. It never blocks.
- **Button faces.**
  - `.btn .live`: a conic lit ring, `--live` from 360° down to 0.
  - `.btn.live .cd { opacity: 0 }`.
  - `.btn .pips` (● or ○) on the lower rim.
  - `.btn.ready .push { opacity: .35 }`, `.btn:not(.ready) .push { stroke: var(--strain) }`.
  - `.btn.ready .charge { fill-opacity: var(--charge) }`,
    `.btn:not(.ready) .charge { fill: var(--strain); fill-opacity: 1 }`.
  - `.btn.refused` shake.
  - `.btn.far` dims the snap icon's dashed path to 0.35.
- **Recent-damage ghost (N10).** A pale segment on `#hp` from `integrity` to
  `integrity + recent`.

### 5.4 VFX primitives: where they live

| id | where | signature |
|---|---|---|
| N1 cold tell | `vfx.ts` | `tellMaterial(style, radius, hot, deep, { cold: true })` adds `uCold`. When it's on: noise quantised `floor(n·5)/5`; the radial ripple sign flips (`+ uTime`, inward); the radial edge is dashed `step(.45, fract(atan(w.y,w.x)/6.283·16))`; the strip has no chevrons (static rime), with its edge dashed along `vUv.y`. Contraction is done by mesh scale, not a uniform. |
| N2 beam, tether | `partfx.ts` | `beam(from, to, width, life, y)`, `tether(a, b, width, opacity)`: a flat strip with the N1 cold strip material |
| N3 badge | `partfx.ts` | per marked enemy, pooled. `close` = 1 − markT / 4 |
| N4a frost, N4b rime | `vfx.frost(at, count, radius)`, `Enemy.rime` | §3.1 |
| N5 shell | `partfx.ts` | an open cylinder of radius r, height 1.1, 10 facets, `uDrain` |
| N6 breach | `partfx.ts` + `level.fadeSolid` | §3.6 |
| N7 decoy | `still.makeGhost(0.55)` + `partfx.ts` pulse | – |
| N8, N8b, N10 | `hud.ts` | §5.3 |
| N9 tell break | `main.ts` `tellBreak(e)` | chaser: 14 COLD sparks on a 2.4 circle; ranged: 14 along the aim, 0–6 u |
| N11 gather | `vfx.gather(at, count, radius, col)` | sparks spawned on a ring, velocity inward, life = radius / speed |
| N12 lob mover | combat (thrown y) + `partfx.ts` (glob) | parabola `sin(kπ) · peak` |
| N13 icons, LIVE | `hud.ts` | `paint(b)` uses `def.iconStates[state] ?? def.icon`; the empty slot keeps `SLOT_ICON`. `SHAPE_ICON` is deleted |

`vfx.trail(at, color, size, life = 0.18)` gains the `life` argument.

### 5.5 Pause / compare screen

- `REACH_LABEL` covers every shape: bolt range, lob range, nova radius, ward
  radius, decoy radius, arc reach, grab reach, catch radius, dash distance, hop
  distance, anchor snap, and rewind "rewind" (`windowMs / 1000` s). `reach(d)`
  returns `radius` for nova/ward/decoy/catch, `windowMs/1000` for rewind, and
  `range` otherwise.
- `damageLabel(d)`: charge → `6–32`; fan → `14 ×3`; overrun → `0 / 22 held`;
  ward/rewind/hop → `–`; otherwise `damage`.
- Card name: append the pip glyphs when `pips` is set (T §4.2).
- Conflict line (T §7), shown under the incoming card when the other id is
  equipped: `{lure, anvil}`, `{brace, anvil}`, `{frost-trail, backdraft-vent}`
  → T's three lines. `pause.compare` gains an `equipped: readonly AbilityDef[]`
  argument.

---

## 6. Build order

Each step ends in a playable build (`npm run build` clean, dev server runs, a
run can be played from depth 1 to a boss). Add each step's ids to `READY`.

**Step 1: the contract, and today's parts ported.**
Types, `PARTS` (all 30, only some READY), `STARTING`, `CastContext` and
`CastResult`, HUD `FireResult` and icons from the def, `addStrain`, `onPart`
plumbing with an empty PartFx, `still.attack(spec)` with today's four poses
mapped to lens/vent/cleaver/kick, `sfx.ability(beat)` likewise, the dead-first
enemy loop, `hurtPlayer(source)`, the line rule on arcs and novas, `inReach`,
drop tables and gating, `Pack.size`, `summoned`, the dev hooks (§7.0).
READY: focusing-lens, cracked-lens, pressure-vent, backdraft-vent,
scrap-cleaver, kickstart, skid-plates (the reworked slam with shove 1.4).
*Playable:* today's game, with the line rule and the new drop rates.

**Step 2: the parts that fit.**
Piston, Rusted Hook (the rework), Frayed Cleaver (strain in ctx, iconStates,
notches), Skitter and Spring Heels (`startMove`, hop parabola, vault flag,
`pushOut` skip, stick lock), Overrun (pushed), Patient Lens (`patientSince`,
charge fill), Overclocked Coil (`once`, strain 1, pips), Flare (lob, `later`,
N1 cold tell, glob, preview ring), R1 rig handles and the new poses and voices
for these. READY += piston, rusted-hook, frayed-cleaver, skitter, spring-heels,
overrun, patient-lens, overclocked-coil, flare.

**Step 3: windows and the LIVE face.**
`parts.guard`/`anvil`, `holdS` stances, the shot-loop shell check, Ward, Mirror
Ward (owner on shots, reflected bolts), Brace (conversion → `strain` event →
`addStrain`, sound swap), Anvil (catch → counter, slam beat), HUD LIVE ring,
`clearSlot`, N5 shell. READY += ward, mirror-ward, brace, anvil.

**Step 4: statuses, interrupt, the throw.**
The status map, `hitPart` mark consumption, `applySlow` store-and-divide, rime,
N3 badges, N4 frost, boss walk × `speedMul`, `Enemy.interrupt` (3 classes),
the hard-cut tone stop, N9, held enemies and `landThrow`. Signal Flare, Chill
Vent, Parry Clamp, Clamp Toss. READY += signal-flare, chill-vent, parry-clamp,
clamp-toss.

**Step 5: bounce and breach (the two the owner asked for).**
Terrain `see` mode and the call-site sweep, `blocker`, `faces`, `breach` and
`tickBreaches`, solid ids, bounce substeps, `bankShot`, the sentinel answer and
bent strip, `ghost` bolts, `pickTarget(awakeFirst)` (also retrofit Flare), N2
path flash, N6 rims (fadeSolid optional). Ricochet Lens, Through-Line.
READY += ricochet-lens, through-line.

**Step 6: zones, decoy, two-press, history.**
Zones and Frost Trail, the decoy override and `melee.reach` and Lure (N7), the
anchor state machine and `startCooldown`/refused/`forceFrac` and Plumb Line
(tether), `History` and Borrowed Time (echo, N10). READY += frost-trail, lure,
plumb-line, borrowed-time. `READY` now holds all 30 and can be removed.

**Step 7: the strain language, polished.**
Pip flight and the lagged meter (N8), the last-push warning, the Overrun/Patient
first-cooling pulse (once per save), compare-screen conflict lines, the
pause-card damage labels and pips. No rule changes. It's safe to tune on the
Poco.

---

## 7. Acceptance checks (headless)

### 7.0 Dev hooks (add in step 1, DEV only)

```ts
Object.assign(window, {
  __combat: combat, __still: still, __hud: hud, __loot: loot, __level: () => level, __world: world,
  __run: run, __parts: PARTS, __partLog: [] as PartEvent[],             // every onPart event is pushed here
  /** Advance exactly `s` seconds of game time: simulate(STEP) × 60s, and the HUD clock with it. No rAF, no hitstop. */
  __step: (s: number) => { for (let i = 0; i < Math.round(s * 60); i++) { simulate(STEP); clock += STEP * 1000; hud.update(clock) } },
  /** The same path a tap (false) or push (true) takes after the gesture: HUD cooldown, cast, strain. */
  __fire: (slot: SlotName, pushed = false) => hud.fireSlot(slot, pushed),
  /** takePart without the ground: clearSlot, equip (R8 aware), setEquipped. */
  __equip: (id: string) => { /* … */ },
  __stick: (x: number, z: number) => hud.setStick(x, z),
  /** Spawn one enemy as its own pack of 1. awake = true wakes it at once. */
  __spawn: (kind: Archetype, x: number, z: number, awake = true, elite?: EliteMod) => Enemy,
  /** A clean test floor: cells i, j ∈ [−3, 3] (x, z ∈ [−14, 14]), plus these solids. Clears enemies, bolts, shots, loot,
   *  parts runtime and the history; Still at (0, 0), facing 0 (+z); hp 100; strain 0; every button ready; auto attack off. */
  __arena: (o?: { boxes?: Box[]; circles?: Circle[]; auto?: boolean }) => void,
  __crate: (x: number, z: number) => Breakable,   // a breakable with a dummy mesh
  __enter: enterLevel,
  __lootRules: { rollPart, dropChance },
})
```

`__arena` uses `makeTerrain` (exported from `dungeon.ts`) and sets
`combat.terrain` and `loot.terrain`. `Combat` gains `autoAttack = true`, and the
auto block is skipped when it's false. Run through `playwright-core` as
HANDOVER.md describes.

In every check, **A** means `__arena()`. `c(x,z)` means
`__spawn('chaser', x, z)`, and `r(x,z)` means `__spawn('ranged', x, z)`. "hp"
is the enemy's unless it says Still. Tolerances are ±0.15 u for positions and
exact for damage (armor 1). To stop an awake enemy walking during a check, set
`e.speedMul = 0` (knockback still applies).
In §7.4 and §7.5, every spawned enemy gets `speedMul = 0` unless the check is
about its movement. `__spawn('boss', …)` goes through `addBoss`.

### 7.1 Systems

| id | setup | action | assert |
|---|---|---|---|
| S1 dead don't act | A; equip Cleaver; `e = c(0,1.8)`; advance `__step(1/60)` until `e.phase === 'windup' && e.timer < 16` (the next tick would strike); `e.hp = 5` | `__fire('arms')`, `__step(0.1)` | Still hp 100 (without decision 6 it's 91); the enemy is gone from `__combat.enemies` |
| S2 push → Stopped | A; equip Lens; `__run.strain = 18`; `__fire('head')` | `__fire('head', true)` | strain 20; `__run.phase === 'stopping'` |
| S3 Stopped beats Broke | A; equip Brace; strain 19; `__combat.hp = 5`; `c(0,1.8)` | `__fire('torso')`, `__step(0.7)` | phase `'stopping'`, not `'broken'`; Still hp 5 |
| S4 slow keeps Quick | A; `e = __spawn('chaser', 0, 5, true, 'swift')` | equip Chill, fire, `__step(3.1)` | `e.speedMul === 1.45` (±1e-9); mid-way (at 1 s) it was 0.725 |
| S5 slow refresh, no stack | S4 setup | fire at t0, `__step(1)`, fire pushed | speedMul 0.725; `statusOf(e).slowT ≈ 3` |
| S6 slow never touches a windup | two runs: `c(0,1.8)` control / `c(0,1.8)` + Chill at t0 | count ticks to the strike event (log onStrike) | equal |
| S7 breach is see-only | A; boxes `[{minX:-3,maxX:3,minZ:4,maxZ:4.6}]`; `terrain.breach(0,0,0,10,4)` | – | `lineClear(0,0,0,9,0.15,true)` true; `(…,false)` false; `clampMove(0,0,0,9,0.42).z < 4` |
| S8 breach closes | S7 | `__step(4.05)` | `lineClear(0,0,0,9,0.15,true)` false; partLog has breach `open:false` |
| S9 drop odds | – | 10k × `rollPart('chaser', [], 'kill')` | 0 golds; blue 0.40 ± 0.02; never a 'rare'/'boss' id |
| S10 elite/Plenty gating | – | 10k × 'elite' and 'plenty' | gold 0.10 ± 0.015; never through-line or borrowed-time |
| S11 boss pair | – | 200 × (boss-blue, then boss-gold excluding its slot) | tiers blue/gold; slots differ |
| S12 pack-size rate | – | `__lootRules.dropChance({ size: 3, side: false, members: [1], dropped: false }, false, false)`, and with `summoned = true` | 0.22 (±1e-9); 0 |
| S13 level clears state | Plumb anchor live, a decoy, a zone, a mark, a history | `__enter(2)` | `parts` all null; `zones.length 0`; `status.size 0`; `history.window(1.5).points.length ≤ 1`; hud legs cooling |

### 7.2 Head

| id | setup | action | assert |
|---|---|---|---|
| H1 Lens | A; equip focusing-lens; `c(0,6)`, `e.speedMul=0` | fire, `__step(0.3)` | hp 4 |
| H1b Lens wall | A with box z 2.7..3.3, x −2..2; same | same | hp 30 |
| H2 Flare lands late | A; equip flare; `c(0,9,false)` (asleep) | fire; `__step(0.78)`; then `__step(0.05)` | 30 then 12 |
| H2b over a wall + blast | A with box z 4..4.6; sleepers at (0,9), (1.8,9), (3,9) | fire, `__step(0.85)` | 12, 12, 30 |
| H2c awake first | A; sleeper (0,8.5) asleep; `r(-10,0)` awake | fire | partLog `lob.to` ≈ the ranged's cast-time pos |
| H3 Cracked | A; equip cracked-lens; sleepers (0,9), (0,11), (0,13) | fire, `__step(0.7)` | all 10; partLog pierce n = 1, 2, 3 |
| H3b Cracked wall | + box z 11.8..12.4 x −2..2 | same | 10, 10, 30 (the wall sits between the second and third) |
| H4 Ricochet bank | A with boxes cover `{-1.5,1.5, 4,4.6}` and side `{4,4.6,-2,14}`; `s = r(0,8.5,false)`, `s.speedMul = 0` | equip ricochet-lens, fire, `__step(0.6)` | s.hp 2; partLog bounce at ≈(3.85, 4.25); `s.answer` set |
| H4b answer hits | continue H4, Still stays at (0,0) | `__step(3.5)` | Still hp 92; the shot's partLog has bounce side 'enemy' |
| H4c bank then move | H4, then `__still.pos.set(-4,0,0)` right after the cast | `__step(3.5)` | Still hp 100 |
| H4d clear line = no bank | A; `c(0,6)` | fire | no bounce event; hp 12 |
| H5 Patient full | A; equip patient-lens; `c(0,9,false)`, `e.hp=200` | `__step(6.1)` (since 1.5 + 6.1 ≥ 7.5), fire, `__step(0.5)` | hp 168 |
| H5b pushed full | right after H5 | `__fire('head', true)`, `__step(0.5)` | hp 136; strain 2 |
| H5c weak tap | after H5b | `__step(1.5)`, fire, `__step(0.5)` | hp 130 (6 at 1.5 s) |
| H5d swap resets | equip lens, `__step(10)`, equip patient-lens | – | `parts.patientSince === 1.5` |
| H6 Signal marks | A; equip signal-flare + pressure-vent; sleepers (0,9), (1,9), `hp=100` | fire head, `__step(0.85)` | both hp 96; `statusOf(e).markT > 3` |
| H6b consume twice | continue: `__still.pos.set(0,0,7)`; `__fire('torso')` at once | – | both hp 66; markT 0; partLog `mark consumed` ×2 |
| H6c auto doesn't consume | `__arena({auto:true})`; `e = c(0,6)`, `speedMul 0`; `__combat.mark(e, 4)` | `__step(1.3)` | hp 15 (three autos at 0, 0.62, 1.24 s); markT > 2 |
| H7 Through-Line | A with box z 4..4.6 x −3..3; equip through-line; `c(0,9,false)`, hp 100 | fire, `__step(0.3)` | hp 76; `lineClear(0,0,0,9,.15,true)` true |
| H7b both sides | same with `s = r(0,9,false)`, `s.hp = 100`, `s.speedMul = 0` | fire, `__step(3.0)` (flight 0.11 + wake reload 1.2 + windup 0.76 + shot ≈ 0.5) | Still hp 92 (the sentinel fired through the hole) |
| H7c control | H7b with focusing-lens instead | `__step(3.0)` | Still hp 100; s.hp 100 (the bolt hit the wall) |
| H7d awake first | A; sleeper (0,9); `r(5,-12)`, `speedMul 0`, hp 100 | fire | the ranged hp 76; the sleeper 30 |
| H8 Coil one per enemy | A; equip overclocked-coil; `c(0,1.5)`, hp 100, `speedMul 0` | fire, `__step(0.2)` | hp 86; strain 1 |
| H8b pushed | then `__fire('head', true)` | – | strain 4 (1 + 1 + 2) |
| H8c Stops after firing | strain 19; fire | `__step(0.1)` | hp dropped 14; phase `'stopping'` |

### 7.3 Torso

| id | setup | action | assert |
|---|---|---|---|
| T1 Vent | A; equip pressure-vent; `c(0,3)` | fire; `__step(0.25)` | hp 15; dist to Still > 5.5 (a 3.15 u shove, still sliding) |
| T1b Vent line rule | A with box z 1.5..2.1 x −2..2; `c(0,3)`; `__crate(0,3.8)` | fire | hp 30; the crate is broken |
| T2 Ward | A; equip ward; fire; `__combat.fireShot(V3(0,0,6), V3(0,0,-1), 8)` | `__step(0.6)` | Still hp 100; no shots left; partLog shield |
| T2b expired | fire ward, `__step(1.5)`, then the shot | `__step(0.6)` | Still hp 92 |
| T2c melee passes | fire ward; `c(0,1.8)` | `__step(0.7)` | Still hp 91 |
| T3 Backdraft | A; equip backdraft-vent; `c(0,4.5)` | fire, `__step(0.4)` | hp 18; dist 1.4–2.0 |
| T4 Chill | A; equip chill-vent; `c(0,4)` | fire | hp 20; speedMul 0.5; after `__step(3.1)` it's 1 |
| T5 Brace shot | A; equip brace; fire; the shot as in T2 | `__step(0.6)` | Still hp 100; strain 1 |
| T5b Brace slam | fire; `c(0,1.8)` | `__step(0.7)` | Still hp 100; strain 2 |
| T5c window ends | fire; `__step(0.9)`; the shot | `__step(0.6)` | Still hp 92; strain 0 |
| T6 Mirror | A; equip mirror-ward; `s = r(0,8,false)`, `s.hp=100`, `s.speedMul=0`; fire; `fireShot(V3(0,0,6), V3(0,0,-1), 8, s)` | `__step(1.0)` | Still hp 100; s.hp 92 |
| T6b cap 6 | fire; 7 shots from (±0.3k, 6), 0.05 s apart, owner s | `__step(1.2)` | 6 reflect events; Still hp 92 |
| T7 Lure spawn | A; equip lure; stick (1,0) | fire | `parts.decoy.pos` ≈ (−1.5, 0) |
| T7b idle + wall | A with box z −1.6..−1.0 x −2..2; stick idle, facing 0 | fire | decoy.z > −1.0 (clamped; unclamped it would be −1.5) |
| T7c draw | T7, then `__still.pos.set(6,0,0)`; `c(-1.5,4)` | `__step(1.5)` | the chaser is within 2.2 of the decoy; Still hp 100 |
| T7d burst | continue to `__step(1.6)` | – | the chaser hp 12; decoy null; partLog decoy burst |
| T7e strike covers Still | T7 (decoy at (−1.5,0)), Still stays at (0,0); `c(-1.5,1.5)` (1.5 from the decoy, 2.12 from Still) | `__step(1)` | Still hp 91 |
| T7f boss ignores | A; boss at (0,8) awake; decoy live | – | `targetFor(boss, still.pos) === still.pos` |
| T7g swap, no burst | T7c, then `__equip('pressure-vent')` | `__step(3)` | chaser hp 30; partLog decoy gone |

### 7.4 Arms

| id | setup | action | assert |
|---|---|---|---|
| A1 Cleaver | A; equip scrap-cleaver; `c(0,2.5)` | fire | hp 12; `still.facing` ≈ 0 |
| A1b behind a wall | box z 1.2..1.8 x −2..2; `c(0,2.5)` | fire | hp 30; no onHit |
| A2 Piston | A; equip piston; `c(0,3)`, hp 100; `c(2,2.5)` | fire, `__step(0.5)` | first hp 74 and moved +z ≈ 1.6; second hp 30 |
| A3 Hook | A; equip rusted-hook; `s = r(0,6)` | fire, `__step(0.5)` | hp 8; dist to Still ≈ 1.6 (±0.3) |
| A3b line | + box z 3..3.6 | fire | hp 20 |
| A4 Parry cancel | A; equip parry-clamp; `c(0,1.8)`; `__step(0.1)` | fire, `__step(0.6)` | phase ≠ strike during the step; Still hp 100; hp 20; partLog interrupt |
| A4b no windup | `c(0,2.4)`, `speedMul 0` (never winds) | fire | hp 20; knock ≈ 0 |
| A4c boss | boss | – | `boss.interrupt() === false` |
| A5 Frayed widths | A; equip frayed-cleaver; `c(0,2.5)`, `c(2.5,0.5)`, `c(0,-2.5)`, all hp 100, `speedMul 0` | fire at strain 3 / 7 / 12 (reset hp, `__step(2.7)` between) | hits: [1,0,0] / [1,1,0] / [1,1,1]; beats fray-90/180/360 |
| A6 Toss | A; equip clamp-toss; `c(0,2)`, hp 100; `c(5.8,2)`, hp 100; stick (1,0) | fire, `__step(0.4)` | first at ≈(5,2), hp 86; second hp 86 and shoved +x |
| A6b wall | + box x 3..3.6 | fire, `__step(0.4)` | first.x ≤ 2.5; hp 74; partLog land 'wall' |
| A6c Plated | `__spawn('chaser',0,2,true,'plated')` | fire | lands ≈1.5 u away |
| A6d boss | boss at (0,2.5) | fire | boss hp 886; pos unchanged |
| A7 Anvil catch | A; equip anvil; `c(0,1.8)`, hp 100 | fire, `__step(0.7)` | Still hp 100; hp 70; dist > 3; partLog catch |
| A7b shot passes | fire; shot as T2 | `__step(0.6)` | Still hp 92; anvil still live |
| A7c miss | fire; `__step(1.0)`; `c(0,1.8)` | `__step(0.7)` | Still hp 91; partLog windowEnd used:false |

### 7.5 Legs

| id | setup | action | assert |
|---|---|---|---|
| L1 Kickstart | A; equip kickstart; sleeper (0,4) | fire, `__step(0.35)` | Still ≈(0,6.4); hp 18 |
| L1b wall | box z 3..3.6 | fire, `__step(0.35)` | Still.z ≤ 2.6 |
| L2 Skitter | A; equip skitter; stick (1,0); `c(1.7,0)`, `speedMul 0` | fire, `__step(0.25)` | Still ≈(3.4,0); hp 30 |
| L3 Skid | A; equip skid-plates; `c(0,3)`, `c(1.9,6.2)`, both `speedMul 0` | fire, `__step(0.35)` | 12 (run over for 8, knocked to ≈4.2, then slammed for 10) and 20 (off the path, slammed only, shoved away from (0,5.6)) |
| L4 Overrun step | A; equip overrun; `c(0,2)`, `speedMul 0` | fire, `__step(0.3)` | Still ≈(0,4); hp 30; strain 0 |
| L4b charge | then `c(0.5,7)`, `speedMul 0`; `__fire('legs', true)` | `__step(0.35)` | Still ≈(0,13); hp 8; knock.x > 0; strain 2 |
| L5 Frost | A; equip frost-trail; `c(0.3,3)` awake | fire, `__step(0.1)` | zones.length 1; speedMul 0.5 |
| L5b expiry | `__step(3.3)` (after it leaves, or the zone ends) | – | speedMul 1 |
| L6 vault | A with box z 2..2.6 x −3..3; equip spring-heels | fire, `__step(0.35)` | Still ≈(0,3.4) |
| L6b lock | right after L6 (0.05 s into the lock), stick (1,0) | `__step(0.2)`, then `__step(0.2)` | x unchanged after the first; x > 0 after the second |
| L6c two walls refused | boxes z 2..2.6 and z 3.4..4.0 | fire, `__step(0.35)` | Still.z < 2 |
| L6d void refused | Still at (0,12.5) facing +z (the edge at 14) | fire | Still.z ≤ 13.6 |
| L7 Plumb plant/snap | A; equip plumb-line; fire; `__still.pos.set(6,0,0)`; `c(3,0)`, `speedMul 0` | `__hud.isReady('legs')` true; fire; `__step(0.3)` | Still ≈(0,0); hp 16; legs cooling ~9 s |
| L7b too far | fire; `__still.pos.set(11,0,0)`; fire | – | still at 11; anchor live; partLog anchor denied |
| L7c fade | fire; `__step(5.1)` | – | anchor null; legs readyAt ≈ clock + 9000 |
| L7d swap mid-anchor | fire; `__equip('kickstart')` | – | legs cooling at the full 8 s |
| L8 Borrowed | A; equip borrowed-time; `__combat.hp = 50`; `fireShot(V3(0,0,2.5), V3(0,0,-1), 30)`; `__step(0.3)` (hp 20); `__combat.hp += 20` (a heal: 40) | stick (1,0), `__step(0.7)`; fire; `__step(0.3)` | hp 70 (40 + the 30 taken, **not** the old value 50); Still ≈ (0,0) (the oldest sample); strain 2 |
| L8b no double | then `__fire('legs', true)` | – | hp 70; strain 6 |
| L8c pushed cost | fresh A; `__fire('legs')`, `__fire('legs', true)` | – | strain 2, then 6 |

---

## 8. Out of scope (not in this pass)

| item | why |
|---|---|
| Parts for Yanah and Yuri | the owner writes them |
| Hold-on-ready for Overrun or any push-shaped part | the owner's open question (DESIGN "Hold means two things") |
| The charger trip (Frost Trail) and every charger/swarm number | those archetypes don't exist yet. The zone keeps a `trips` hook to add later |
| Charger/swarm treasure rows | they come with the archetypes |
| Recolouring the elite aura (T Q1) | a playtest question, not a rule |
| Tuning passes (mark 4 s, Coil +1, the fray thresholds, breach 4 s, Brace /8) | B §8: tune on the device or with a sim once the pool exists |
| A sim CLI for balance | valuable, but a separate project |
| Hold-to-aim | unbuilt, and it collides with the push gesture |
| Enemy lobbers answering the Flare's symmetry rule | no enemy lobber exists |
| Meta layer (found parts joining the pool across runs) | HANDOVER's open list |

---

## Summary

30 parts are specced as data: 12 shapes and a `Mod` union carrying each twist's
numbers. `useAbility(def, ctx) → CastResult` handles push and strain, and a
single `addStrain` in `main.ts` owns every route to Stopped. The seven new
systems are each defined once, with where their state lives (`src/parts.ts`,
Combat, Terrain, Ranged) and how pause, level change, death, swaps and the
Stopped slowdown treat them. Sixteen contradictions are resolved (§0.3). There
are presentation hooks per part, a seven-step build order that stays playable
at every step, and about 90 headless checks against dev hooks added in step 1.
