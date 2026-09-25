# Charger and swarm: buildable spec (Verifier pass)

Pass 3 of 3. The mechanics and numbers come from `1-balancer.md` (called **B**
here) and `swarm-sim.mjs`. The look, animation, telegraphs, VFX, SFX and names
come from `2-translator.md` (**T**). Both are settled. This document says how to
build them on top of the part-pool spec `design/parts/3-spec.md` (**P**), which
lands in full (its 7 steps) before any of this starts. Where this doc and B, T
or P disagree, **this doc wins**, and §0.4 lists each place that happens.

Reading order for the engineer: §0 (decisions), §1 (types and constants), §2
(shared engine rules), §3 (the ram), §4 (the swarm), §5 (models, rigs,
animation), §6 (telegraphs), §7 (VFX and SFX), §8 (dungeon, camera, labels), §9
(build order), §10 (headless checks). §11 is out of scope.

In-world names: **ram** (a boiler ram) for `kind: 'charger'`, **swarf mite** for
`kind: 'swarm'`, **the brood** for the invisible per-pack coordinator, and
**brood-mother** for the swarm's elite leader. Code names stay `charger`,
`swarm`, `Mite`, `Brood`.

---

## 0. Proposal and decisions

### 0.1 Why / what changes

**Why.** Every archetype today punishes standing still. Nothing punishes running
in a straight line along a threat (except the sentinel's line) or circling at a
steady rate. The ram punishes running along its lane and rewards a wall at your
back. The swarm punishes any movement you can predict. Deeper levels get more
varied, not stronger: pack budgets count body-equivalents, and per-enemy stats
never change with depth (B §6.1).

**What changes.**
- Two new archetypes: `Charger` (`src/charger.ts`) and `Mite` + `Brood`
  (`src/swarm.ts`), plus an instanced mite renderer and the brood's bite ring.
- A shared lane telegraph (`src/lane.ts`) used by the ram **and** the Assembler,
  drawn out to the true hit edge.
- Engine rules: an update context (Still's real position and velocity, the lock
  book, the pack token, an event sink), the hurt top-up, `radius = base × size`,
  `split()` spawning the leader's archetype, per-pair body spacing, loot weights
  per kill, `melee.source`, the Frost Trail trip, and the Anvil stopping a rush.
- Dungeon: body-equivalent pack budgets, lesson packs at depth 2 (ram) and 4
  (swarm), templates for mixed packs, elite rules and name pools per archetype.

**Capabilities.** New: ram, swarf mite, brood, brood-mother, the lane tell, the
bite ring, the lock book, the pack token, skitter stream, pop clusters.
Modified: `hurtPlayer`, `split`, `crown`, body spacing, `dropChance`, the
Assembler's charge lane and hit rule, the sentinel (books its lock), elite
labels and lines, camera framing.

**Impact (files).**

| file | change |
|---|---|
| `src/enemy.ts` | `Enemy` interface additions, `EnemyCtx`, `EnemyEvent`, `EnemyAction.melee` fields, `turn()`; Chaser: `radius` getter, ctx arg |
| `src/charger.ts` | **new**: `CHARGER`, `class Charger` |
| `src/swarm.ts` | **new**: `MITE`, `BROOD`, `class Mite`, `class Brood`, `class MiteBatch`, `class BiteRing` |
| `src/lane.ts` | **new**: `LaneTell`, `LaneState`, `LaneEnd`, `WALL_TOP` |
| `src/ranged.ts` | ctx arg, books its lock, emits `lock`, `radius` getter, tracking dim |
| `src/boss.ts` | ctx arg, `LaneTell` for the charge, swept once-per-charge hit at lateral ≤ 1.57 |
| `src/combat.ts` | `LockBook`, pack token, ctx, broods, trample, rush/zone/Anvil hooks, top-up, `split`, `crown`, spacing, `onEnemy`, `onHit(at, e)`, `onKill(…, weight)`, `laneEnds()`, `eliteLine()` |
| `src/dungeon.ts` | BE budget, lesson packs, templates, nests, elite mods per leader kind, name pools |
| `src/loot.ts` | `TREASURE` rows, `KILL_WEIGHT`, `dropChance(pack, wasElite, summoned, weight)` |
| `src/audio.ts` | `Voice`, `hit(pan, gain)`, ram voices, swarm voices, limiters |
| `src/vfx.ts` | `haloTexture()` (shared), `TELL_CROWD` |
| `src/main.ts` | onEnemy wiring, per-kind kill/strike FX, `ramFx`, `broodFx`, skitter scheduler, voices maps, labels, camera threats, dev hooks |

### 0.2 Top decisions

1. **Enemies test Still themselves for the two new strikes.** The ram's swept
   lane and the brood's off-body ring don't fit P's melee rule (`target ===
   player || dist(e, player) ≤ reach`). Both test `ctx.player` (always the real
   Still, never the decoy) and emit `{ kind: 'melee', tested: true }` only on a
   hit. *Why:* one honest rule, "if your feet are on ember, you're hit", holds
   when the tell aims at a decoy.
2. **The brood is a Combat-owned coordinator, not an Enemy.** One `Brood` per
   pack that has mites, stored on `Pack.brood` and in `Combat.broods`. It ticks
   after `updatePacks` and before the enemy loop, owns roles, slots, the surge,
   the ring and the bite, and returns the bite as a melee action that Combat
   resolves. Each mite is still an `Enemy` (autos, bolts, parts, marks, Parry,
   Clamp Toss all work per body). *Why:* B §3.2, and it keeps the enemy loop
   unchanged.
3. **Mites are instanced from day one.** One `MiteBatch` per Combat draws every
   mite in the level in 8 draw calls (shell, belly, core, halo, two jaws, two
   leg sets). A mite's `group` is a transform-only rig of empty `Object3D`
   nodes; the batch copies their world matrices. Per-mite flash, sleep tint,
   rime and role colour are per-instance colour. *Why:* T's per-mite meshes
   cost 7 calls a mite (112 for two broods). The batch costs 8 whatever the
   count, and keeps per-mite flash (T's fallback lost it).
4. **One lane tell, two sizes.** `LaneTell` draws rails at the true hit edge, a
   faint wash out to them, a core at the body's width that fills, an end cap,
   and an end mark (skid streaks or wall star). The ram uses core half
   `radius + 0.1`, hit half `+ 0.42`. The Assembler uses core 1.15, hit 1.57,
   and its hit rule changes to match. *Why:* the owner accepted both T
   proposals; depth 2 teaches depth 3.
5. **The lock book lives in Combat and is game time.** Every committed lock
   (ram 495 ms in, sentinel 456 ms in, surge at 0) books a time; a new windup
   may start only if no booked lock is within 300 ms. The hulk and the boss
   don't book. *Why:* B §4.1, and pause/hitstop/Stopped freeze it like
   everything else.
6. **`radius = base × size` for every enemy.** One rule for elites, split
   halves and adds. *Why:* the owner accepted B's fix; a bigger body is a bigger
   target, and the Many ram's lane width follows from it.
7. **The top-up keeps one hit per window.** Inside the 0.35 s hurt window a
   bigger hit deals the difference; the window never extends. Anvil takes
   precedence over the window. *Why:* B §4.4; a 3-dmg bite must not shield a
   14-dmg rush, and intake per window stays one hit.
8. **Moments are `EnemyEvent`s; lasting state is polled.** The same split as P
   decision 3: charger and brood emit `lock`, `paw`, `rushEnd`, `trample`,
   `nearMiss`, `skid`, `stunEnd`, `surge`, `biterLost`, `bite`, `landed`,
   `broodEnd`, `broodGone`, `sealBreak` through `ctx.emit`. Main reads
   `rushing`, `stunned`, `skidding`, brood `state` each frame for continuous FX.

### 0.3 Protected rules

- One part = one ability; nothing here touches parts, strain costs or tiers.
- **Every threat is telegraphed and committed.** The ram's windup, rush and the
  surge windup are uninterruptible except by Parry (windup only) and the
  documented stops (wall, crate, Anvil, Frost Trail). The ring and the lane are
  on the floor before damage can land.
- **Every tell is honest.** Drawn width = hit width, drawn length = rush
  length, end mark = how the rush ends. The bite ring's piece count = biters.
- **Neither archetype requires a push.** Walls and stepping out are free
  answers; Stopped stays a choice (B §7.2).
- **No new terminal state.** Runs still end `broken` or `stopped`, through
  `end()`. Nothing here adds a path that skips it.
- **Rules are symmetric.** The rush stops at the first solid and smashes a
  breakable, like Still's dash; the body lane uses solid mode, so a breach never
  opens a lane (P §3.6).
- **Per-enemy stats never change with depth.**

### 0.4 Contradictions resolved

| # | where | says | other side says | resolution |
|---|---|---|---|---|
| R1 | swarm `kind` | T: `mite` | owner: `'charger' \| 'swarm'` | `kind: 'swarm'`. Class `Mite`. `Archetype` gains `'charger' \| 'swarm'`. |
| R2 | tracking lane look | B: "faint and narrow" | T: faint rails at the true width | T (owner). Tracking shows only the rails. |
| R3 | lane drawn width | B: drawn 1.4, hit at body overlap | T: wash to the centre-hit edge 1.12 | T (owner): core 1.4, wash + rails to 1.12. Hit numbers unchanged. |
| R4 | Assembler charge | B §11 #1 (a) hit lateral < 1.57 | T: core 1.15, wash 1.57 | Both (owner). Also: once per charge, swept, and the lane drawn to the real cut instead of a fixed 30 u. |
| R5 | ram windup distance | B: "→ windup when dist ≤ 9" | B: "hug punish after 1000 ms backing off" | A normal windup needs **3.5 ≤ d ≤ 9**. Closer, it only winds up via the hug rule. Otherwise the hug rule never fires. |
| R6 | depth 3 packs | B: "packs before the arena as depth 2, ≤ 2 charger packs" | code: boss levels (3, 6, 9…) are entrance + arena, no packs | No packs on boss levels (unchanged). "5–6" means depth 5; "7+" means 7, 8, 10, 11… |
| R7 | split halves' drops | P R12: roll normally vs creation size | B §8: split bodies weigh 0 | B. Halves weigh 0; the elite's guaranteed drop is the Many pack's payout. |
| R8 | drop maths | P: `packPayout / size` | B: `0.66 × w / W_pack` | B. `Pack.weight` = Σ w at creation. Identical for all-weight-1 packs (P S12 still reads 0.22 with the new signature). |
| R9 | brood-mother hit radius | B / T: 0.4 | decision 6 | `0.3 × 1.28 = 0.384`. |
| R10 | Many ram lane half | B: 0.55 | decision 6 | `0.6 × 0.72 + 0.1 = 0.532`; hit half 0.952. |
| R11 | skid ease | T: "~40 ms longer, 120 ms skid" | exact linear-in-distance ease | Speed `6 + 12 × rem / 1.5` over the last 1.5 u. At 60 Hz a 9.5 u open rush takes 35 ticks (0.583 s) against 32 constant: the skid lasts 133 ms and the rush is 50 ms longer, cycle 3.05 s. Contact timing is unchanged (it starts 2 u past Still). |
| R12 | per-mite windup events | Combat fires `onWindup` per phase change | B/T: one tell and one sound per surge | Combat skips `onWindup`/`onStrike` for `kind === 'swarm'`. The brood emits `surge` and `bite`. |
| R13 | trample targets | B: any non-boss enemy | code: asleep enemies never integrate knock | Awake packs only. Other rushing rams and held enemies are skipped. |
| R14 | elite aura | T: scale by `(radius × size + 0.1)/0.9` | decision 6 already scales radius | Aura scale 1 for every kind except the brood-mother: `(radius + 0.25) / 0.9` = 0.71. |
| R15 | mite materials | T E4: shared role materials | decision 3 | Role colours are per-instance colours on the core and halo instanced meshes. The heartbeat multiplies them. Same look. |
| R16 | live pan (T E5) | P: windup voices return `(hard?) => void` | T: `{ stop(), pan() }` | `Voice = { stop(hard?), pan(p), dip?(), lose?() }`. Old voices wrap with `asVoice(stop)`. Main's maps hold `Voice`. |
| R17 | Anvil catch damage | B: 36 → 6 then stun | ordering | `catchBlow` deals the 30 counter first (×1), then calls `stopRush('caught')`. |
| R18 | Anvil vs the top-up | – | – | A melee that would deal > 0 after top-up is caught even inside an open window. Body strikes after a catch fold for the rest of the window. |
| R19 | Frost trip | P §8: out of scope | B: trip, recover 1200, no ×1.5 | In. `applyZones` calls `Charger.trip()` for a rushing ram inside a zone. |
| R20 | decoy vs brood | P: `targetFor(e)` per enemy | B: "surges the decoy (no lead)" | One mind: the brood targets the decoy when any of its awake mites is within the decoy's range (12). Mites ignore the per-enemy target. |
| R21 | queen always a biter | B §5 | the global 4-biter cap | A queen outside the inner ring displaces the farthest orbiting non-queen inner mite of any brood. She is never demoted. |
| R22 | "flung out of its slot" | B §2.5 | – | An inner mite is demoted to outer when it is staggered (sliding > 1.5 u/s) and more than 4.0 u from the brood's target. Chasing lag never demotes. |
| R23 | ram wake | – | B has no wake delay | A ram wakes with `reload = 700`, covering T's 250 ms unfold. No rush on the wake frame. |
| R24 | tracking "open end" | T: last 0.6 u fades out | the tell shader has no gradient | Tracking rails stop 0.6 short of the lane's end, with no end mark. At lock they snap to full length and the mark stamps. |
| R25 | d4 filler | B's d4 row lists only charger templates | the charger-pack cap is 1–2 | Rooms past the lesson swarm and the 1–2 charger packs use today's H/S generator. |
| R26 | sealed cores on hulk Wardens | T §7 extends it to hulks | scope | Only rams and mites get sealed looks. Hulk Wardens keep today's label-only read (§11). |
| R27 | Plated hit sound | T: `hit()` at 0.7 | `hit(pan)` has no gain | `hit(pan, gain = 1)`. |
| R28 | lunge vs "presentation" | B: damage on the 550 tick | the recover clump must be real for the punish window | Damage resolves on the 550 tick. The 150 ms lunge moves `pos` (ease-out quartic) so the clump is where it's drawn. |
| R29 | mite footsteps | – | T: mites never `step()` | `Mite.walking` is always false; the brood's skitter stream replaces footsteps. |

### 0.5 How the owner-accepted engine fixes touch existing behaviour

| fix | code | exactly what changes for things that exist today |
|---|---|---|
| **Hurt top-up** | `Combat.hurtPlayer` | Inside a window, a later bigger hit now deals `damage − windowMax`. Examples: a hulk slam 9 landing 0.2 s after a sentinel shot 8 deals +1 (was 0); a boss sweep 18 after a barrage pellet 7 deals +11 (was 0); a shot after a slam still deals 0. The window is not extended by a top-up. Brace converts only the difference (`ceil(extra / 8)`). `tickDamage` and the history record only what was applied. `onPlayerHurt(amount)` fires again for a top-up with the difference (hurt sound, vignette, vibrate). P checks S3, T2c, T5, T5b, A7, L8 keep their numbers (none stacks two hits in a window). |
| **`split()` spawns the leader's archetype** | `Combat.split` | A Many hulk still becomes two hulks (12 HP, size 0.72). A Many ram becomes two rams (12 HP, size 0.72, `reload = 700`). Halves weigh 0 for drops (R7): before, each half rolled 0.66 / size. |
| **Radius grows with size** | every class: `get radius() { return BASE × this.size }`; `pushOut`, `nextStep` and spacing use `this.radius` | Elite hulk 0.55 → 0.704: bolts connect 0.154 u sooner, arcs (`inReach`) and blasts (`inBlast`) reach it 0.154 u further, it keeps 0.154 u further from walls, hulk–elite spacing 1.254. Elite sentinel 0.5 → 0.64. Split hulks 0.55 → 0.396, boss adds (size 0.78) → 0.429: slightly harder to hit. Boss unchanged (size 1). The Chaser's `CHASER.bodyRadius` in `pushOut`/`nextStep` becomes `this.radius`. |
| **Per-pair spacing** | `updatePacks` | `spacing = a.radius + b.radius`, split 50/50: hulk–hulk 1.1 (unchanged), sentinel–sentinel 1.0 (was 1.1), hulk–sentinel 1.05 (was 1.1). Pairs with a rushing ram or a lunging mite are skipped. |
| **Lock book** | `ranged.ts` approach | A sentinel whose lock would land within 300 ms of a booked lock stays in approach (still moving) and retries next tick. Alone it is unchanged. |
| **Update context** | `update(dt, target, terrain, ctx)` | Chaser and Assembler ignore `ctx` (Chaser reads nothing new). |
| **Assembler charge** | `boss.ts` | Hit rule: once per charge, when Still's centre is within 1.57 of this tick's swept segment and not behind the charge's start (was: any tick with centre distance < 2.1, repeating after each hurt window). Drawn: `LaneTell` core 2.3 wide, wash/rails 3.14 wide, length = the real cut (was a fixed 30-u strip 2.3 wide). |
| **`onHit(at, e)`** | every hit site | Adds the enemy. Main's existing handler ignores it except for the ram's stun and plate reads. |

### 0.6 Risks, migration, open questions

| risk | mitigation |
|---|---|
| The dodge cliffs are ±50 ms wide (surge 550 at a 0.35 s reaction, the ram's 405 ms locked phase) | every number is one constant in `BROOD` / `CHARGER`; tune on the Poco before touching HP (B §10 #1, #2) |
| The wash reads as soft glow and players feel cheated at the 1.12 edge (T Q1) | raise `washMat` to 0.3 in `LaneTell`, or T's fallback (one full-width strip); both are presentation-only |
| Instanced mites lose something visually vs meshes | per-instance colour keeps flash, rime, sleep and roles; the only loss is per-mite emissive on hit flash (the colour lerp carries it) |
| The top-up makes mixed packs hit harder than today in overlapping windows | it's B's intended fix; per-window intake still caps at the largest single hit |
| Lock-book waits pile up in dense rooms | worst case B §2.6 is ~1 lock/s with 3 bookers; average wait < 100 ms; `BOOK_GAP` is one number |
| The P spec lands late or changes shape | this doc names every P contract it uses (`hurtPlayer`, dead-first loop, `interrupt`, `rime`, statuses, zones, decoy, `melee.reach`, Anvil, Parry, `see`/`blocker`, `Pack.size`, `dropChance`, dev hooks); re-check them at step 1 |

**Migration:** N/A for saves (the game keeps no run save). Code migration is
the signature change (`update(…, ctx)`), `dropChance`'s extra argument (P's
S12 check moves to E6), `onHit(at, e)`, `onKill(…, weight)`, and the voices maps
holding `Voice`; each is done in step 1.

**Open questions** (playtest, not blockers): B §10 #1–#7 and T Q1–Q6, unchanged.

---

## 1. Data and types

### 1.1 `src/enemy.ts`

```ts
export type EnemyPhase = 'approach' | 'windup' | 'strike' | 'recover'

export type EnemyAction =
  | {
      kind: 'melee'
      damage: number
      /** Who swung. Anvil needs it to stop a rush; the top-up and Brace ignore it. */
      source?: Enemy
      /** P §3.3: the strike's reach, for a strike aimed at the decoy that also covers Still. */
      reach?: number
      /** The enemy already tested the real Still (ctx.player) and hit: Combat skips its own test. Ram, brood. */
      tested?: boolean
    }
  | { kind: 'shot'; dir: THREE.Vector3; damage: number; bounces?: number }
  | { kind: 'shots'; from: THREE.Vector3; dirs: THREE.Vector3[]; damage: number }
  | { kind: 'wave'; center: THREE.Vector3; gaps: number[]; damage: number }
  | { kind: 'summon'; points: THREE.Vector3[] }
  | { kind: 'pull'; center: THREE.Vector3; strength: number; seconds: number }

/** What every enemy's update can see beyond its target. One object, owned by Combat, reused every call. */
export interface EnemyCtx {
  /** Still's centre. Never the decoy. Every hit test the enemy does itself uses this. */
  readonly player: THREE.Vector3
  /** Still's velocity this tick, u/s, from the position delta. Zero on the first tick and after a jump > 2 u. */
  readonly playerVel: THREE.Vector3
  /** Combat's game clock, seconds. */
  readonly now: number
  /** No booked lock within BOOK_GAP of now + offsetMs. */
  canLock(offsetMs: number): boolean
  book(owner: object, offsetMs: number): void
  /** Chargers: the pack's windup/rush token is free for e (none, e's own, dead, or its holder is past its rush). */
  tokenFree(e: Enemy): boolean
  takeToken(e: Enemy): void
  /** In the clamp's throw (P §3.9). */
  held(e: Enemy): boolean
  emit(ev: EnemyEvent): void
}

/** Instants the run dresses. Lasting state is polled. */
export type EnemyEvent =
  | { kind: 'lock'; e: Enemy; end: THREE.Vector3 | null }                 // ram 495 ms in (end = lane end), sentinel lock (end null)
  | { kind: 'paw'; e: Enemy; at: THREE.Vector3 }                          // ram tracking, 80 and 300 ms
  | { kind: 'rushEnd'; e: Enemy; how: 'open' | 'wall' | 'caught' | 'trip'; at: THREE.Vector3 }
  | { kind: 'skid'; e: Enemy }                                            // open rush enters its last 1.5 u
  | { kind: 'trample'; e: Enemy; victim: Enemy; at: THREE.Vector3; dir: THREE.Vector3 }
  | { kind: 'nearMiss'; e: Enemy; at: THREE.Vector3 }                     // passed within 2.0 of Still without hitting
  | { kind: 'stunEnd'; e: Enemy }                                         // the hatch slams
  | { kind: 'surge'; brood: Brood; at: THREE.Vector3; ms: number; biters: number }
  | { kind: 'biterLost'; brood: Brood; mite: Enemy; why: 'dead' | 'parry' | 'flung'; arc: THREE.Vector3 }
  | { kind: 'bite'; brood: Brood; at: THREE.Vector3; biters: number; hit: boolean }
  | { kind: 'landed'; brood: Brood; at: THREE.Vector3[] }                 // biters touch down in the clump
  | { kind: 'broodEnd'; at: THREE.Vector3 }                               // the last mite of a brood died
  | { kind: 'broodGone'; brood: Brood }                                   // reset/level change: stop its voices
  | { kind: 'sealBreak'; from: THREE.Vector3; members: Enemy[] }          // a Warden fell; members nearest first

export interface Enemy {
  readonly kind: 'chaser' | 'ranged' | 'charger' | 'swarm' | 'boss'
  /** BASE × size. A getter on every class. */
  readonly radius: number
  /** Elite name height, × size (T §0): hulk/sentinel/boss 2.3, ram 2.0, mite 1.1. */
  readonly labelY: number
  readonly group: THREE.Group
  readonly tellGroup: THREE.Group
  readonly pos: THREE.Vector3
  readonly windupMs: number
  readonly knock: THREE.Vector3
  hp: number
  phase: EnemyPhase
  dead: boolean
  armor: number
  speedMul: number
  /** Accessor on Charger: 0 while rushing. */
  knockMul: number
  size: number
  rime: number                                   // P §3.1
  readonly walking: boolean
  readonly gait: number
  hit: (damage: number) => boolean
  update: (dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx) => EnemyAction | null
  idle: (dt: number, face: THREE.Vector3) => void
  setAsleep: (asleep: boolean) => void
  interrupt: () => boolean                       // P §3.2
  /** crown() calls it after size/hp/armor: builds the mod's body feature. Optional. */
  setElite?: (mod: EliteMod) => void
  dispose: (scene: THREE.Scene) => void
}

/** Still's body radius. Moved here from combat.ts so charger.ts and swarm.ts can import it without a cycle. */
export const PLAYER_RADIUS = 0.42

/** Distance from a point to a segment. Moved here from Combat's private method; Combat calls this one. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number { /* Combat's body */ }

/** Turn `from` toward `to` by at most `maxStep` radians. */
export function turn(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return from + Math.max(-maxStep, Math.min(maxStep, d))
}
```

`Archetype = Enemy['kind']` in `combat.ts` picks the two new kinds up.

### 1.2 `CHARGER` (`src/charger.ts`)

```ts
export const CHARGER = {
  hp: 36,
  bodyRadius: 0.6,          // × size: plain 0.6, elite 0.768, Many half 0.432
  speed: 3.8,               // walk
  backoffSpeed: 3.0,
  turnRate: 5,              // rad/s: approach, hold, recover
  preferMin: 3.5,
  preferMax: 8.5,
  fireRange: 9.0,           // never winds up from further out
  hugMs: 1000,              // backing off this long → winds up anyway
  windupMs: 900,
  lockAt: 0.55,             // 495 ms tracking, 405 ms locked
  rushSpeed: 18,
  rushExtra: 3.5,           // nominal length = clamp(d + 3.5, rushMin, rushMax)
  rushMin: 6,
  rushMax: 11,
  laneExtra: 0.1,           // laneHalf = radius + 0.1 → 0.7
  bodyLanePad: 0.6,         // lineClear pad, solid mode: "can I run at you"
  skidLen: 1.5,             // an open rush eases over its last 1.5 u (skid 133 ms, rush +50 ms)…
  skidSpeed: 6,             // …from 18 down to 6 u/s
  rushTimeoutMs: 1500,      // safety: a rush that hasn't ended by then ends as open
  damage: 14,               // once per rush
  stunMs: 1200,
  stunMul: 1.5,             // damage taken while stunned; Plated's plate lifts (×2 on its 0.5 armor)
  stunRecoverMs: 400,
  missRecoverMs: 900,
  tripRecoverMs: 1200,      // Frost Trail: a stop, no ×1.5
  reloadMs: 700,            // after recover, and on wake
  trampleShove: 1.4,        // u, perpendicular, × knockMul, 0 damage
  trampleReach: 0.7,        // victim within its radius + 0.7 of the swept segment
  nearMiss: 2.0,
  pawMs: [80, 300] as const,
  splitHp: 12,
  splitSize: 0.72,
}
```

Derived, per ram: `laneHalf = radius + 0.1`, `hitHalf = laneHalf + PLAYER_RADIUS (0.42)`
→ 0.7 / 1.12 plain, 0.868 / 1.288 elite, 0.532 / 0.952 Many half.
`lockMs = windupMs × lockAt = 495`.

### 1.3 `MITE`, `BROOD` (`src/swarm.ts`)

```ts
export const MITE = {
  hp: 8,
  bodyRadius: 0.3,          // × size: queen 0.384
  speed: 4.8,
  farDist: 6,               // beyond this (or no line to the target) it streams with nextStep
  streamPad: 0.3,
}

export const BROOD = {
  innerMax: 4,              // biters around Still, summed over every awake brood (global cap)
  perBrood: 4,
  innerR: 1.8,
  outerR: 5.5,              // beyond Vent/Chill reach 4.1 and Backdraft 5.0
  spinIn: 0.5,              // rad/s
  spinOut: -0.3,
  refillMs: 500,            // an outer mite takes an empty inner slot after this
  surgeRange: 2.6,          // inner mites this close to the target, with a line, may surge
  need: 3,                  // ≥ min(3, inner alive)
  windupMs: 550,
  lead: 0.45,               // s
  leadMax: 2.5,             // u from the target
  ringR: 1.0,               // hit: Still's centre within 1.0 of L at 550
  biteReach: 2.8,           // a biter further than this from L at 550 is lost
  bite: 3,                  // per biter, ≤ 4 → 3/6/9/12, one melee
  strikeMs: 150,
  lungeMax: 2.8,
  clumpR: 0.45,             // biters land this far from L, on their own side
  recoverMs: 800,           // the punish window
  regroupMs: 500,
  demoteDist: 4.0,          // R22
  nestR: 1.4,
  nestGap: 0.6,
  wakeRippleMs: 150,
  heartHz: 1.1,             // + 0.25 × (brood index mod 3)
  heartStep: 0.25,
  packSolo: 8,
  packMixed: 6,
}
```

Cycle floor: 0.55 + 0.15 + 0.8 + 0.5 = 2.0 s. Standing-still cap 12 / 2.0 = 6.0 DPS
across any number of broods.

### 1.4 Combat additions (`src/combat.ts`)

```ts
export const BOOK_GAP = 0.3            // s between committed locks

export interface Pack {
  // … P's fields (elite, members, state, side, dropped, size, homes, gaze, hpSeen, wakeRadius, leash)
  /** Σ KILL_WEIGHT at creation (R8). */
  weight: number
  /** The ram holding the pack's windup/rush token. */
  token: Enemy | null
  /** Set when any member is a mite. */
  brood?: Brood
}

export type EliteMod = 'swift' | 'plated' | 'splitting' | 'warding'
/** Which mods a leader of each kind may carry (dungeon picks from these). */
export const ELITE_MODS: Record<Exclude<Archetype, 'boss'>, EliteMod[]> = {
  chaser: ['swift', 'plated', 'splitting', 'warding'],
  ranged: ['swift', 'plated', 'warding'],
  charger: ['swift', 'plated', 'splitting', 'warding'],
  swarm: ['swift', 'warding'],
}
export function eliteLine(kind: Archetype, mod: EliteMod): string {
  if (kind === 'charger' && mod === 'plated') return 'takes half damage, until it hits a wall'
  if (kind === 'swarm' && mod === 'swift') return 'her whole brood moves fast'
  if (kind === 'swarm' && mod === 'warding') return 'her brood takes little damage while she stands'
  return ELITE_LINE[mod]
}

export interface CombatEvents {
  onHit: (at: THREE.Vector3, e?: Enemy) => void
  onKill: (at: THREE.Vector3, kind: Archetype, pack: Pack, wasElite: boolean, summoned: boolean, weight: number) => void
  onEnemy: (ev: EnemyEvent) => void
  // … every other P event unchanged
}
```

### 1.5 Loot (`src/loot.ts`)

```ts
const TREASURE: Record<Archetype, Record<SlotName, number>> = {
  chaser: { head: 1, torso: 3, arms: 3, legs: 1 },
  ranged: { head: 3, torso: 1, arms: 1, legs: 3 },
  charger: { head: 2, torso: 1, arms: 1, legs: 4 },
  swarm: { head: 4, torso: 1, arms: 1, legs: 2 },
  boss: { head: 1, torso: 1, arms: 1, legs: 1 },
}

/** A kill's share of its pack's payout. Split halves and summoned adds weigh 0. */
export const KILL_WEIGHT: Record<Archetype, number> = { chaser: 1, ranged: 1, charger: 1, swarm: 0.25, boss: 1 }

export function dropChance(
  pack: Pick<Pack, 'weight' | 'side' | 'dropped'> & { members: readonly unknown[] },
  wasElite: boolean, summoned: boolean, weight = 1,
): number {
  if (summoned) return 0
  if (wasElite || (pack.side && pack.members.length === 0 && !pack.dropped)) return 1
  if (weight <= 0) return 0
  return (LOOT.packPayout * weight) / Math.max(1e-6, pack.weight)
}
```

| pack | per kill | P(≥ 1 drop) |
|---|---|---|
| 3 hulks | 0.22 | 52% |
| M8 | 0.0825 per mite | 49% |
| M8 + S | mite 0.055, sentinel 0.22 | – |
| C + H | 0.33 each | 55% |

Main's `maybeDrop(at, kind, pack, wasElite, summoned, weight)` passes `weight`
to `dropChance`. The tier roll uses `kind`'s treasure class, so a sentinel in a
swarm pack keeps its class (B §8).

---

## 2. Shared engine rules

### 2.1 The update context, and Still's velocity

Combat owns one `ctx` object and `prevPlayer = new Vector3()`, `hasPrev = false`.
At the top of `update(dt, player)`:

```ts
this.time += dt
const dx = player.x - this.prevPlayer.x, dz = player.z - this.prevPlayer.z
if (!this.hasPrev || dt < 1e-4 || dx * dx + dz * dz > 4) this.playerVel.set(0, 0, 0)   // first tick, frozen, or a jump
else this.playerVel.set(dx / dt, 0, dz / dt)
this.prevPlayer.copy(player); this.hasPrev = true
this.ctx.player = player                          // the live vector, read-only by convention
```

`reset()` sets `hasPrev = false`. The velocity includes wall sliding (after
`pushOut`), dashes, hops and the magnet: whatever really moved him. The lead
clamps at 2.5 u, so a 23 u/s dash can't throw a ring across the room.

### 2.2 The lock book

```ts
class LockBook {
  private entries: { at: number; owner: object }[] = []
  constructor(private readonly clock: () => number) {}
  canLock(offsetMs: number) {
    const t = this.clock() + offsetMs / 1000
    return !this.entries.some((b) => Math.abs(b.at - t) < BOOK_GAP)
  }
  book(owner: object, offsetMs: number) { this.entries.push({ at: this.clock() + offsetMs / 1000, owner }) }
  /** Drop an owner's future locks (interrupted, buried, gone). */
  unbook(owner: object) { const now = this.clock(); this.entries = this.entries.filter((b) => b.owner !== owner || b.at < now) }
  prune() { const now = this.clock(); this.entries = this.entries.filter((b) => b.at > now - BOOK_GAP) }
  clear() { this.entries.length = 0 }
}
```

| booker | when it asks | offset | call site |
|---|---|---|---|
| ram | the tick it would start a windup | 495 | `Charger.update` approach |
| sentinel | the tick it would start a windup | `RANGED.windupMs × RANGED.lockAt` = 456 | `Ranged.update` approach: `&& ctx.canLock(456)`, then `ctx.book(this, 456)` |
| sentinel answer (P §3.5) | answer windup start | 0 (locked from the start) | same branch, `canLock(0)` |
| brood surge | gather → windup | 0 (the ring is fixed from the start) | `Brood.tick` |
| hulk, boss | never | – | – |

`prune()` runs once per `update`. `unbook(e)` runs in `bury`, in Combat's
`interrupt` event path (P §3.2), and for a brood in `reset`. The sentinel also
emits `ctx.emit({ kind: 'lock', e: this, end: null })` on the tick `locked`
turns true, so the checks can see every lock (§10).

### 2.3 The pack token (rams)

```ts
tokenFree(e) {
  const p = this.packOf.get(e); const h = p?.token
  return !h || h === e || h.dead || (h.phase !== 'windup' && h.phase !== 'strike')
}
takeToken(e) { const p = this.packOf.get(e); if (p) p.token = e }
```

The token frees itself when its holder leaves windup/strike (recover, stun,
trip, interrupt, death), so nothing has to release it. `bury` sets
`pack.token = null` if the buried enemy held it.

### 2.4 `hurtPlayer`, with the top-up

Replaces P §3.11. `from` is the melee action's `source`.

```ts
private hurtMax = 0          // the largest hit this window
private hurtCaught = false   // an Anvil catch folded this window's body strikes

private hurtPlayer(damage: number, source: HurtSource, from?: Enemy) {
  const open = this.hurtCooldown > 0
  if (open && source === 'melee' && this.hurtCaught) return
  const amount = open ? damage - this.hurtMax : damage
  if (amount <= 0) return
  if (!open) { this.hurtCooldown = 0.35; this.hurtMax = 0; this.hurtCaught = false }   // the window never extends
  this.hurtMax = Math.max(this.hurtMax, damage)
  if (source === 'melee' && this.parts.anvil) { this.catchBlow(from); this.hurtCaught = true; return }   // R18
  const g = this.parts.guard
  if (g?.kind === 'brace') {
    this.events.onPart({ kind: 'strain', amount: Math.ceil(amount / g.perStrain), at: this.lastPlayer.clone() })
    return
  }
  this.hp = Math.max(0, this.hp - amount)
  this.tickDamage += amount
  this.events.onPlayerHurt(amount, source)
}
```

`catchBlow(from)` is P §4.3's, plus a last step:
`if (from instanceof Charger && from.stopRush()) this.emitEnemy({ kind: 'rushEnd', e: from, how: 'caught', at: from.pos.clone() })`.
The counter's 30 lands before the stun (R17).

Melee resolution in the enemy loop (replaces P's line):

```ts
if (action?.kind === 'melee') {
  const reaches = action.tested || target === player || Math.hypot(e.pos.x - player.x, e.pos.z - player.z) <= (action.reach ?? 0)
  if (reaches) this.hurtPlayer(action.damage, 'melee', action.source ?? e)
}
```

### 2.5 `radius`, `split`, `crown`, spacing

```ts
// every class
get radius() { return CHASER.bodyRadius * this.size }        // RANGED / CHARGER / MITE / BOSS likewise

// Combat
private make(kind: Archetype, x: number, z: number): Enemy {
  switch (kind) {
    case 'ranged': return new Ranged(x, z)
    case 'charger': return new Charger(x, z)
    case 'swarm': { const m = new Mite(x, z); this.miteBatch.add(m); return m }
    default: return new Chaser(x, z)
  }
}

private split(pack: Pack, from: Enemy) {
  for (const side of [-1, 1]) {
    const c = this.make(from.kind, from.pos.x + side * 0.6, from.pos.z)   // was: new Chaser
    c.size = CHARGER.splitSize                                             // 0.72 for both kinds that can split
    c.hp = CHARGER.splitHp                                                 // 12
    if (c instanceof Charger) c.reload = CHARGER.reloadMs
    this.splitBorn.add(c)                                                  // weight 0 (R7)
    this.scene.add(c.group, c.tellGroup); this.enemies.push(c); c.setAsleep(false)
    c.knock.set(side * 6, 0, 0)
    pack.members.push(c); pack.homes.set(c, from.pos.clone()); pack.gaze.set(c, from.pos.clone()); this.packOf.set(c, pack)
  }
}

private crown(pack: Pack, leader: Enemy, mod: EliteMod, name: string) {
  leader.size = 1.28
  leader.hp *= 2                                   // ram 72, queen 16
  if (mod === 'swift') for (const e of pack.members) e.speedMul = 1.45
  if (mod === 'plated') { leader.armor = 0.5; leader.knockMul = 0.3 }
  leader.setElite?.(mod)                           // ram: plated flag + body feature; mite: queen
  const aura = /* existing RingGeometry(0.9, 1.15) */
  aura.scale.setScalar(leader.kind === 'swarm' ? (leader.radius + 0.25) / 0.9 : 1)   // R14
  if (leader instanceof Mite && pack.brood) pack.brood.queen = leader
  // … existing
}
```

Spacing, in `updatePacks` (replaces `BODY_SPACING`):

```ts
const skip = (e: Enemy) => (e instanceof Charger && e.rushing) || (e instanceof Mite && e.phase === 'strike')
// for each pair a, b of non-asleep enemies, neither skipped:
const min = a.radius + b.radius
if (d > 0.001 && d < min) { const push = (min - d) / 2; /* existing 50/50 split */ }
```

### 2.6 Combat's tick, in full order

```ts
update(dt, player) {
  // velocity, time (§2.1)
  this.hurtCooldown = Math.max(0, this.hurtCooldown - dt)
  this.updatePacks(player)                       // wake / leash / sleep, warden armor, spacing
  this.book.prune()
  this.countTells()                              // TELL_CROWD (§6.4), step 4
  this.tickBroods(dt, player)                    // §4.3: roles, the global cap, surge, bite → hurtPlayer
  for (let i = this.enemies.length - 1; i >= 0; i--) {
    const e = this.enemies[i]!
    if (e.dead) { this.bury(i); continue }       // P decision 6
    const st = this.status.get(e); if (st) this.tickStatus(e, st, dt)
    this.applyZones(e)                           // P §3.4, plus the trip (§3.5)
    if (/* held */) { …; continue }              // P §3.9
    const pack = this.packOf.get(e)
    if (pack && pack.state !== 'awake') { /* existing sleep/return */ continue }
    const target = this.targetFor(e, player)
    const before = e.phase
    const action = e.update(dt, target, this.terrain, this.ctx)
    if (e.phase !== before && e.kind !== 'swarm') {                    // R12
      if (e.phase === 'windup') this.events.onWindup(e, e.windupMs)
      if (e.phase === 'strike') this.events.onStrike(e)
    }
    // melee (§2.4), shot, shots, wave, summon, pull: P's
    if (e instanceof Charger && e.sweep) this.trample(e)               // §3.4
    if (e.dead) this.bury(i)
  }
  // P: tickParts, auto, bolts, pull, waves, later, shots, fx, history
}
```

`ctx.emit` goes through `emitEnemy(ev)`, which does Combat's own work first
(`rushEnd` with `how: 'wall'` → `smashNear(ev.at.x, ev.at.z, 0.4)`), then calls
`events.onEnemy(ev)`.

`bury(i)` adds, after P's work: `this.book.unbook(e)`; if `pack.token === e`,
`pack.token = null`; for a `Mite`, `pack.brood?.remove(e)` and, if the brood
has no mites left, `emitEnemy({ kind: 'broodEnd', at: e.pos.clone() })`,
`this.broods.splice(…)`, `brood.dispose(scene)`, `delete pack.brood`,
`miteBatch.remove(e)`; if `wasElite && mod === 'warding'`, emit `sealBreak`
with the surviving members sorted by distance from `e.pos`, and set each Mite's
and Charger's `unsealT = 0.03 × rank` (the seal ripple, §5.3). `onKill` gets
`weight = summoned.has(e) || splitBorn.has(e) ? 0 : KILL_WEIGHT[e.kind]`.

`reset()` adds: for each brood, `emitEnemy({ kind: 'broodGone', brood })` and
`brood.dispose(scene)`; `broods.length = 0`; `book.clear()`; `miteBatch.clear()`;
`hasPrev = false`; `broodIndex = 0`.

`addPack` builds members with `make()`, sets `pack.weight = Σ KILL_WEIGHT[kind]`,
`pack.token = null`, and, if any member is a mite,
`pack.brood = new Brood(pack, this.broodIndex++, this.scene)` with every mite
added to it (`m.brood = brood`).

`laneEnds(): THREE.Vector3[]` returns, for each awake ram with
`(phase === 'windup' && locked) || rushing`, its lane end point, and for the
boss with `move === 'charge' && (locked || phase === 'strike')`, its lane end.

---

## 3. The ram: exact behaviour

### 3.1 State

```ts
export class Charger implements Enemy {
  readonly kind = 'charger'
  get radius() { return CHARGER.bodyRadius * this.size }
  get laneHalf() { return this.radius + CHARGER.laneExtra }
  get hitHalf() { return this.laneHalf + PLAYER_RADIUS }
  readonly labelY = 2.0
  readonly windupMs = CHARGER.windupMs
  hp = CHARGER.hp; phase: EnemyPhase = 'approach'; dead = false; armor = 1; speedMul = 1; size = 1; rime = 0
  private baseKnock = 1
  get knockMul() { return this.rushing ? 0 : this.baseKnock }
  set knockMul(v: number) { this.baseKnock = v }
  plated = false
  // read by Combat, main and the checks
  locked = false; rushing = false; stunned = false; tripped = false; skidding = false
  aim = 0; facing = 0
  reload = 0                       // ms
  hug = 0                          // ms spent backing off
  t = 0                            // ms in the current phase
  timer = 0                        // ms the current recover lasts
  readonly lane = { x: 0, z: 0, len: 0, nominal: 0, end: 'open' as LaneEnd }
  readonly rushFrom = new THREE.Vector3()
  private readonly endPt = new THREE.Vector3()
  rushLeft = 0
  hitDone = false
  private skidEase = false
  private passSign = 0
  sweep: { ax: number; az: number; bx: number; bz: number } | null = null
  readonly trampled = new Set<Enemy>()
  unsealT = 0
  mode: 'walk' | 'back' | 'hold' = 'hold'
  private pawed = 0                // paw events sent this windup (0..2)
  private flash = 0; private bob = Math.random() * 10; private asleep = true
  wakeT = 0                        // s left of the 250 ms unfold
  readonly laneTell = new LaneTell()   // in tellGroup (§6.1)
  // presentation: the rig nodes (§5.1) and the pose record
}
```

### 3.2 Phase machine

```
            wake (reload 700)
   asleep ─────────────────▶ APPROACH ◀──────────────────────────────────────┐
                              │  walk / back off / hold                      │ reload = 700
                              │  start: reload ≤ 0 ∧ lane ∧ ¬staggered ∧      │
                              │   token free ∧ canLock(495) ∧                 │
                              │   (3.5 ≤ d ≤ 9  ∨  hug ≥ 1000)                │
                              ▼                                               │
                     WINDUP: tracking 0–495 ──(495)──▶ locked 495–900         │
                              │  Parry → APPROACH (reload 700)                │
                              ▼ (900)                                         │
                     STRIKE: rush 18 u/s (eases to 6 over the last 1.5 u if open)
                   ┌──────────┼───────────────┬──────────────┐                │
            blocked│   length reached   Frost zone      Anvil catch           │
                   ▼          ▼               ▼              ▼                │
             RECOVER:stun  RECOVER 900   RECOVER 1200    RECOVER:stun         │
             1200 (×1.5)   (miss)        (trip, ×1)      1200 (×1.5)          │
                   │          │               │              │                │
                   └─▶ RECOVER 400 ───────────┴──────────────┴────────────────┘
```

| from | trigger | to |
|---|---|---|
| asleep | pack wakes | approach, `reload = 700` |
| approach | the start condition in the diagram | windup (`t = 0`), token taken, lock booked at +495 |
| windup | `t ≥ 495` | windup, `locked = true`, emit `lock` |
| windup | `t ≥ 900` | strike (`rushing = true`) |
| windup | Parry (`interrupt()`) or grabbed | approach, `reload = 700`, lane broken |
| strike | `clampMove` blocked | recover, `stunned`, `timer = 1200`; emit `rushEnd wall` (Combat smashes a breakable there) |
| strike | `rushLeft ≤ 0.001` or `t ≥ 1500` | recover, `timer = 900`; emit `rushEnd open` |
| strike | inside a Frost zone (`trip()`) | recover, `tripped`, `timer = 1200`; Combat emits `rushEnd trip` |
| strike | Anvil (`stopRush()`) | recover, `stunned`, `timer = 1200`; Combat emits `rushEnd caught` |
| recover (stunned) | `t ≥ 1200` | recover, `stunned = false`, `timer = 400`; emit `stunEnd` |
| recover | `t ≥ timer` | approach, `tripped = false`, `reload = 700` |

### 3.3 `update`

```ts
update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
  const ms = dt * 1000
  this.t += ms
  this.reload -= ms
  this.flash = Math.max(0, this.flash - dt * 6)
  this.unsealT = Math.max(0, this.unsealT - dt)
  this.sweep = null
  const dx = target.x - this.pos.x, dz = target.z - this.pos.z
  const dist = Math.max(0.001, Math.hypot(dx, dz))
  const toward = Math.atan2(dx, dz)
  const staggered = slide(this.pos, this.knock, dt)
  let action: EnemyAction | null = null

  switch (this.phase) {
    case 'approach': {
      if (staggered) { this.hug = 0; break }
      // solid mode, never `see`: a breach opens sight, not the floor
      const lane = terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, CHARGER.bodyLanePad)
      if (!lane || dist > CHARGER.preferMax) {
        const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
        const sx = to.x - this.pos.x, sz = to.z - this.pos.z, sd = Math.hypot(sx, sz) || 1
        this.pos.x += (sx / sd) * CHARGER.speed * this.speedMul * dt
        this.pos.z += (sz / sd) * CHARGER.speed * this.speedMul * dt
        this.facing = turn(this.facing, Math.atan2(sx, sz), CHARGER.turnRate * dt)
        this.mode = 'walk'; this.hug = 0
      } else if (dist < CHARGER.preferMin) {
        const s = CHARGER.backoffSpeed * this.speedMul * dt
        const to = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x - (dx / dist) * s, this.pos.z - (dz / dist) * s, this.radius)
        this.pos.x = to.x; this.pos.z = to.z
        this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)
        this.mode = 'back'; this.hug += ms                      // counts even when pinned against a wall
      } else {
        this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)
        this.mode = 'hold'; this.hug = 0
      }
      const inBand = lane && dist >= CHARGER.preferMin && dist <= CHARGER.fireRange
      const hugged = lane && this.hug >= CHARGER.hugMs
      const lockMs = CHARGER.windupMs * CHARGER.lockAt
      if (this.reload <= 0 && (inBand || hugged) && ctx.tokenFree(this) && ctx.canLock(lockMs)) {
        ctx.takeToken(this); ctx.book(this, lockMs)
        this.phase = 'windup'; this.t = 0; this.locked = false; this.hug = 0
        this.aim = toward; this.lane.nominal = clamp(dist + CHARGER.rushExtra, CHARGER.rushMin, CHARGER.rushMax)
        this.pawed = 0
      }
      break
    }
    case 'windup': {
      const lockMs = CHARGER.windupMs * CHARGER.lockAt
      if (!this.locked) {
        this.aim = toward
        this.lane.nominal = clamp(dist + CHARGER.rushExtra, CHARGER.rushMin, CHARGER.rushMax)
      }
      this.facing = this.aim
      this.cut(terrain)                                           // every tick, tracking and locked (§3.3a)
      if (!this.locked && this.t >= lockMs) {
        this.locked = true
        ctx.emit({ kind: 'lock', e: this, end: this.laneEnd(new THREE.Vector3()) })
      }
      for (const [k, at] of CHARGER.pawMs.entries()) {
        if (this.pawed === k && this.t >= at) { this.pawed++; ctx.emit({ kind: 'paw', e: this, at: this.hoof(1, new THREE.Vector3()) }) }
      }
      if (this.t >= CHARGER.windupMs) this.startRush()
      break
    }
    case 'strike':
      action = this.rushTick(dt, terrain, ctx)
      break
    case 'recover': {
      if (!this.stunned && (this.timer !== CHARGER.missRecoverMs || this.t > 250)) {
        this.facing = turn(this.facing, toward, CHARGER.turnRate * dt)   // a miss holds its braced pose 250 ms first
      }
      if (this.t >= this.timer) {
        if (this.stunned) { this.stunned = false; this.t = 0; this.timer = CHARGER.stunRecoverMs; ctx.emit({ kind: 'stunEnd', e: this }) }
        else { this.phase = 'approach'; this.tripped = false; this.reload = CHARGER.reloadMs; this.t = 0 }
      }
      break
    }
  }
  if (!this.rushing) terrain.pushOut(this.pos, this.radius)
  this.present(dt, target)
  return action
}
```

**3.3a The cut** (the lane preview and the rush length are the same number):

```ts
private cut(terrain: Terrain) {
  const fx = Math.sin(this.aim), fz = Math.cos(this.aim), want = this.lane.nominal
  const end = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + fx * want, this.pos.z + fz * want, this.radius)
  this.lane.x = this.pos.x; this.lane.z = this.pos.z
  this.lane.len = Math.hypot(end.x - this.pos.x, end.z - this.pos.z)
  if (this.lane.len >= want - 0.05) this.lane.end = 'open'
  else {
    // probe just past the contact point: a Box or the void is a wall, a Circle (crate, barrel, column, prop) is a prop
    const px = end.x + fx * (this.radius + 0.1), pz = end.z + fz * (this.radius + 0.1)
    this.lane.end = terrain.blocker(px, pz, 0.05, false) === 'prop' ? 'prop' : 'wall'
  }
}
laneEnd(out) { return out.set(this.lane.x + Math.sin(this.aim) * this.lane.len, 0, this.lane.z + Math.cos(this.aim) * this.lane.len) }
```

In the locked phase the direction and `nominal` are frozen but the cut is
recomputed from wherever the body is: a Vent shoving it 2 u back from a wall
turns the star into skid streaks (T §4.1), honestly.

**3.3b The rush.**

```ts
private startRush() {
  this.phase = 'strike'; this.rushing = true; this.t = 0
  this.knock.set(0, 0, 0)                                          // committed: nothing it carried in moves it now
  this.rushFrom.copy(this.pos); this.rushLeft = this.lane.nominal
  this.laneEnd(this.endPt)
  this.hitDone = false; this.trampled.clear(); this.passSign = 0
  this.skidEase = this.lane.end === 'open'                          // decided once
}

private rushTick(dt: number, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
  const fx = Math.sin(this.aim), fz = Math.cos(this.aim)
  const easing = this.skidEase && this.rushLeft < CHARGER.skidLen
  if (easing && !this.skidding) { this.skidding = true; ctx.emit({ kind: 'skid', e: this }) }
  const v = easing ? CHARGER.skidSpeed + (CHARGER.rushSpeed - CHARGER.skidSpeed) * (this.rushLeft / CHARGER.skidLen) : CHARGER.rushSpeed
  const step = Math.min(this.rushLeft, v * dt)
  const ax = this.pos.x, az = this.pos.z
  const nx = ax + fx * step, nz = az + fz * step
  const free = terrain.clampMove(ax, az, nx, nz, this.radius)
  const blocked = Math.hypot(free.x - nx, free.z - nz) > 0.05
  this.pos.x = free.x; this.pos.z = free.z
  this.rushLeft -= Math.hypot(free.x - ax, free.z - az)
  this.sweep = { ax, az, bx: free.x, bz: free.z }
  this.lane.x = free.x; this.lane.z = free.z                        // burn-off: the tell starts at the body
  this.lane.len = Math.max(0, (this.endPt.x - free.x) * fx + (this.endPt.z - free.z) * fz)

  let action: EnemyAction | null = null
  const p = ctx.player
  const along = (p.x - this.rushFrom.x) * fx + (p.z - this.rushFrom.z) * fz
  if (!this.hitDone && along >= 0 && distToSegment(p.x, p.z, ax, az, free.x, free.z) <= this.hitHalf) {
    this.hitDone = true
    action = { kind: 'melee', damage: CHARGER.damage, source: this, tested: true }
  }
  // near miss: the tick its front passes him
  const ahead = (p.x - free.x) * fx + (p.z - free.z) * fz
  const lateral = Math.abs((p.x - free.x) * fz - (p.z - free.z) * fx)
  if (!this.hitDone && this.passSign > 0 && ahead <= 0 && lateral <= CHARGER.nearMiss) ctx.emit({ kind: 'nearMiss', e: this, at: p.clone() })
  this.passSign = Math.sign(ahead)

  if (blocked) {
    const at = new THREE.Vector3(free.x + fx * this.radius, 0.4, free.z + fz * this.radius)
    this.enterStun()
    ctx.emit({ kind: 'rushEnd', e: this, how: 'wall', at })        // Combat smashes a breakable at `at`
  } else if (this.rushLeft <= 0.001 || this.t >= CHARGER.rushTimeoutMs) {
    this.endRush(CHARGER.missRecoverMs)
    ctx.emit({ kind: 'rushEnd', e: this, how: 'open', at: this.pos.clone() })
  }
  return action
}

private endRush(recoverMs: number) { this.rushing = false; this.skidding = false; this.phase = 'recover'; this.t = 0; this.timer = recoverMs }
enterStun() { this.endRush(CHARGER.stunMs); this.stunned = true }

/** Frost Trail (§3.5). */
trip(): boolean { if (!this.rushing) return false; this.endRush(CHARGER.tripRecoverMs); this.tripped = true; return true }
/** Anvil. */
stopRush(): boolean { if (!this.rushing) return false; this.enterStun(); return true }

interrupt(): boolean {
  if (this.phase !== 'windup') return false        // a rush is committed
  this.phase = 'approach'; this.t = 0; this.locked = false; this.reload = CHARGER.reloadMs
  this.laneTell.break()
  return true
}

hit(d: number): boolean {
  const stun = this.stunned ? CHARGER.stunMul * (this.plated ? 2 : 1) : 1
  this.hp -= d * this.armor * stun
  this.flash = 1
  if (this.hp <= 0 && !this.dead) { this.dead = true; return true }
  return false
}

setAsleep(asleep: boolean) {
  this.asleep = asleep
  if (!asleep) { this.flash = 1; this.reload = CHARGER.reloadMs; this.wakeT = 0.25 }
  this.phase = 'approach'; this.locked = false; this.rushing = false; this.stunned = false; this.tripped = false
}

setElite(mod: EliteMod) { if (mod === 'plated') this.plated = true; this.buildEliteFeature(mod) }   // §5.1
```

Walking for footsteps: `walking = phase === 'approach' && mode !== 'hold' && !staggered`;
`gait = bob × 1.8` (one step per diagonal pair).

### 3.4 Trample (Combat)

```ts
private trample(c: Charger) {
  const s = c.sweep!, fx = Math.sin(c.aim), fz = Math.cos(c.aim)
  for (const o of this.enemies) {
    if (o === c || o.dead || o.kind === 'boss' || c.trampled.has(o) || this.held.has(o)) continue
    if (o instanceof Charger && o.rushing) continue                           // they pass through each other
    if (this.packOf.get(o)?.state !== 'awake') continue                       // R13
    if (this.distToSegment(o.pos.x, o.pos.z, s.ax, s.az, s.bx, s.bz) > o.radius + CHARGER.trampleReach) continue
    const nx = -fz, nz = fx                                                   // lane normal
    const side = Math.sign((o.pos.x - s.ax) * nx + (o.pos.z - s.az) * nz) || 1
    o.knock.addScaledVector(shoveVelocity(nx * side, nz * side, CHARGER.trampleShove), o.knockMul)
    c.trampled.add(o)
    this.emitEnemy({ kind: 'trample', e: c, victim: o, at: o.pos.clone(), dir: new THREE.Vector3(nx * side, 0, nz * side) })
  }
}
```

No damage (B §2.5). A victim mid-windup keeps its windup; its ring moves with
it (hulk) or it may leave the surge (a biter shoved beyond 2.8 of L, §4.4).

### 3.5 Frost Trail trip (Combat `applyZones`)

P §3.4's loop, plus, inside the zone test, before `applySlow`:

```ts
if (e instanceof Charger && e.rushing && e.trip()) {
  this.emitEnemy({ kind: 'rushEnd', e, how: 'trip', at: e.pos.clone() })
}
```

`applyZones` runs before `e.update`, so the ram stops on the tick its centre
enters `halfW + radius × 0.5` (0.7 + 0.3 = 1.0) of the strip. At 0.3 u per
tick it can't tunnel a 2.0-wide strip. The slow still applies (walk only).

### 3.6 Edge cases

| case | rule |
|---|---|
| wall in the lane | the cut ends at it; the end mark is a star (+ wall-top bar for a Box); the rush is blocked there → stun 1.2 s ×1.5 |
| wall more than 3.5 u behind Still | the nominal length ends in the open: skid, recover 900, ×1 |
| Still behind cover before the windup | no body lane → no windup; it paths round with `nextStep` |
| Still steps behind cover during tracking | the lane follows him and is cut at the cover; the locked rush stuns on the ram's side of it (arcs and novas need a line, so he can't cleave it across the wall) |
| crate / barrel in the lane | a Circle: end mark star (no bar); the rush stops there, Combat's `smashNear` breaks it (contents drop as if Still broke it), the ram is stunned. One-use |
| column, unbreakable prop | a Circle that doesn't break: star, stun |
| corridor (4 u) | a lane along it leaves 1.28 u of lateral room for Still's centre against 1.12 needed; an off-axis lane meets the side wall and the preview shows a star |
| other enemies in the path | trampled (§3.4); rushing rams pass through each other; spacing skips a rushing ram |
| Still dashing through the lane | the hit test runs every tick against his current position; the lane is 2.24 wide and a dash moves 0.38 u a tick, so he can't tunnel it. No i-frames (P's rule) |
| Plumb snap | same as a dash: judged each tick where he is |
| Spring Heels vault | a vault behind cover during tracking cuts the lane at the cover → stun on the far side; no air immunity |
| decoy (Lure) | `target` is the decoy: the lane aims and measures at it; the hit test still uses `ctx.player`, so Still in the lane is hit |
| slows (Chill, Frost strip) | `speedMul` scales the walk and the back-off only. Windup timing, rush speed and length untouched |
| Vent in the windup | shoves the body (knockMul 1): the lane moves with it and the cut is recomputed; a shove ≥ `d` + 3.5 − gap stops the rush short of Still |
| Vent / Piston / hook during the rush | knockMul reads 0: nothing moves it; damage lands |
| Clamp Toss | can't grab a rushing ram (knockMul 0 < 0.1); a winding ram is interrupted and thrown; a thrown ram into a wall takes +12 but isn't stunned (only rushes stun) |
| Parry | windup (tracking or locked) only: → approach, reload 700; rush: nothing but the 10 damage |
| marks | normal: `hitPart` doubles, then `hit` applies armor and ×1.5 in a stun (Signal + stun + Piston = 26 × 2 × 1.5 = 78) |
| Warden pack | members armor 0.35 (existing); a warded ram in a stun takes 0.35 × 1.5 |
| pause / hitstop | Combat doesn't tick: frozen mid-rush. Voices are real time and drift by the hitstop (existing) |
| level change | `reset()` disposes it; its voices stop via `onGone` |
| death mid-rush | buried at the top of the next tick (dead-first); unbooked; token freed; husk (optional, §5.1) or burst |
| Stopped | the world slows with `dt`; a rush in flight finishes in slow motion; no new windup voices (`run.phase !== 'crawl'`) |

---

## 4. The swarm: exact behaviour

### 4.1 Who owns what

| thing | owner | lifetime |
|---|---|---|
| `Brood` | `Pack.brood` and `Combat.broods` | created in `addPack` when a member is a mite; disposed when its last mite is buried, or in `reset()` |
| roles, refill timers, slots | the brood (fields on each `Mite`) | per tick |
| surge state, `L`, biters | the brood | per surge |
| the bite ring (`BiteRing`) | the brood (world-space group in the scene) | brood life |
| the global 4-biter cap | Combat (`tickBroods`) | per tick |
| drawing every mite | `Combat.miteBatch` (`MiteBatch`) | Combat life; `clear()` in reset |
| queen extras (sac, spines, her halo) | the queen `Mite` | her life |
| the skitter stream, chitter voice | main (keyed by brood) | brood life |

### 4.2 `Mite`

```ts
export class Mite implements Enemy {
  readonly kind = 'swarm'
  get radius() { return MITE.bodyRadius * this.size }
  readonly labelY = 1.1
  readonly windupMs = BROOD.windupMs
  readonly group = new THREE.Group()              // transform-only rig; no meshes (§5.2)
  readonly tellGroup = new THREE.Group()          // empty: the brood draws the ring
  hp = MITE.hp; phase: EnemyPhase = 'approach'; dead = false; armor = 1; speedMul = 1; knockMul = 1; size = 1; rime = 0
  readonly walking = false                        // R29
  readonly gait = 0
  brood!: Brood
  role: 'outer' | 'inner' | 'surge' | 'spent' = 'outer'
  refill = 0                                      // ms
  readonly slot = new THREE.Vector3()
  staggered = false
  queen = false
  t = 0                                           // ms in phase
  readonly lungeFrom = new THREE.Vector3()
  readonly lungeTo = new THREE.Vector3()
  flash = 0; bob = Math.random() * 10; readonly seed = Math.random()
  asleep = true; wakeDelay = 0; unsealT = 0; tumble = 0; landed = false; quick = false
  moving = false; face = 0; blinkT = 0             // presentation reads (skitter counts `moving`)
  readonly rig: Record<'body' | 'shell' | 'belly' | 'core' | 'halo' | 'jawL' | 'jawR' | 'legsL' | 'legsR', THREE.Object3D>

  update(dt: number, _target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    this.t += dt * 1000
    this.flash = Math.max(0, this.flash - dt * 6)
    this.wakeDelay = Math.max(0, this.wakeDelay - dt * 1000)
    this.unsealT = Math.max(0, this.unsealT - dt)
    const wasSliding = this.staggered
    this.staggered = slide(this.pos, this.knock, dt)
    if (wasSliding && !this.staggered) this.landed = true            // main puffs 1 dust, once
    const T = this.brood.T                                           // R20: the brood's target, not `_target`
    if (this.phase === 'approach' && !this.staggered) {
      const dT = Math.hypot(T.x - this.pos.x, T.z - this.pos.z)
      const far = dT > MITE.farDist || !terrain.lineClear(this.pos.x, this.pos.z, T.x, T.z, MITE.streamPad)
      const goal = far ? T : this.slot
      const to = far || !terrain.lineClear(this.pos.x, this.pos.z, goal.x, goal.z, this.radius)
        ? terrain.nextStep(this.pos.x, this.pos.z, goal.x, goal.z, this.radius)
        : goal
      const sx = to.x - this.pos.x, sz = to.z - this.pos.z, sd = Math.hypot(sx, sz)
      if (sd > 0.001) {
        const s = Math.min(sd, MITE.speed * this.speedMul * dt)
        this.pos.x += (sx / sd) * s; this.pos.z += (sz / sd) * s
      }
      this.moving = sd > 0.05
      this.face = far ? Math.atan2(sx, sz) : Math.atan2(T.x - this.pos.x, T.z - this.pos.z)   // stream: travel; orbit: crab-walk facing Still
    }
    if (this.phase === 'strike') {
      const k = Math.min(1, this.t / BROOD.strikeMs), u = 1 - (1 - k) ** 4       // ease-out quartic (R28)
      this.pos.lerpVectors(this.lungeFrom, this.lungeTo, u)
    }
    terrain.pushOut(this.pos, this.radius)
    this.present(dt, T)
    return null                                                     // the brood bites, not the mite
  }

  interrupt(): boolean {                                            // Parry: it leaves the surge
    if (this.phase !== 'windup') return false
    this.phase = 'approach'; this.role = 'inner'; this.t = 0
    this.blinkT = 0.2                                               // core dark 0.2 s
    return true                                                     // the brood notices on its next tick (§4.4)
  }

  hit(d: number) { this.hp -= d * this.armor; this.flash = 1; if (this.hp <= 0 && !this.dead) { this.dead = true; return true } return false }

  setAsleep(asleep: boolean) { this.asleep = asleep; this.phase = 'approach'; if (!asleep) this.flash = 1 }

  setElite(mod: EliteMod) { this.queen = true; this.quick = mod === 'swift'; this.buildQueenExtras(mod) }   // §5.2
}
```

### 4.3 `Brood` and `Combat.tickBroods`

```ts
export class Brood {
  readonly mites: Mite[] = []
  queen: Mite | null = null
  state: 'gather' | 'windup' | 'strike' | 'recover' = 'gather'
  timer = 0                                        // ms left in the state
  L: THREE.Vector3 | null = null
  biters: Mite[] = []
  readonly T = new THREE.Vector3()                 // Still or the decoy
  decoyed = false
  readonly ring: BiteRing
  readonly heartHz: number
  moteT = 0
  private active = false                           // ticked since its last reset

  constructor(readonly pack: Pack, readonly index: number, scene: THREE.Scene) {
    this.ring = new BiteRing(scene)
    this.heartHz = BROOD.heartHz + BROOD.heartStep * (index % 3)
  }
  add(m: Mite) { this.mites.push(m); m.brood = this }
  remove(m: Mite) { this.mites.splice(this.mites.indexOf(m), 1); if (this.queen === m) this.queen = null }
  innerCount() { return this.mites.filter((m) => !m.dead && m.role !== 'outer').length }
  movingCount() { return this.mites.filter((m) => !m.dead && m.phase === 'approach' && m.moving).length }

  reset() {                                        // on leaving 'awake', on wake, on level change
    for (const m of this.mites) { m.role = 'outer'; m.refill = 0; if (!m.dead) m.phase = 'approach' }
    this.state = 'gather'; this.timer = 0; this.L = null; this.biters = []; this.ring.hide(); this.active = false
  }
}
```

```ts
// Combat
private tickBroods(dt: number, player: THREE.Vector3) {
  for (const b of this.broods) if (b.pack.state !== 'awake' && b.active) b.reset()
  const awake = this.broods.filter((b) => b.pack.state === 'awake')
  const cap = { used: awake.reduce((n, b) => n + b.innerCount(), 0) }
  for (const b of awake) b.seatQueen(cap, awake)                    // R21
  awake.sort((a, b) => nearestMiteDist(a, player) - nearestMiteDist(b, player))   // min over live mites of dist to player
  for (const b of awake) {
    const bite = b.tick(dt, this.terrain, this.ctx, cap, this.parts.decoy)
    if (bite) this.hurtPlayer(bite.damage, 'melee', bite.source)
  }
}
```

`Brood.tick`, in order:

```ts
tick(dt, terrain, ctx, cap, decoy): Extract<EnemyAction, { kind: 'melee' }> | null {
  if (!this.active) { this.reset(); this.active = true; this.rippleWake() }   // first tick awake: roles from scratch
  const ms = dt * 1000
  const alive = this.mites.filter((m) => !m.dead && !ctx.held(m))
  if (!alive.length) return null

  // 1. target (R20)
  this.decoyed = !!decoy && alive.some((m) => dist(m.pos, decoy.pos) <= decoy.def.range)
  this.T.copy(this.decoyed ? decoy!.pos : ctx.player)

  // 2. demote the flung (R22); never the queen, never a biter mid-surge
  for (const m of alive) {
    if (m.role === 'inner' && m !== this.queen && m.phase === 'approach' && m.staggered && dist(m.pos, this.T) > BROOD.demoteDist) {
      m.role = 'outer'; m.refill = 0; cap.used--
    }
  }

  // 3. promote, nearest first, after refillMs, inside both caps
  const innerN = alive.filter((m) => m.role !== 'outer').length
  const room = Math.min(Math.min(BROOD.perBrood, alive.length) - innerN, BROOD.innerMax - cap.used)
  const cands = alive.filter((m) => m.role === 'outer').sort((a, b) => dist(a.pos, this.T) - dist(b.pos, this.T))
  cands.forEach((m, k) => {
    if (k >= room) { m.refill = 0; return }
    m.refill += ms
    if (m.refill >= BROOD.refillMs && cap.used < BROOD.innerMax) { m.role = 'inner'; m.refill = 0; cap.used++ }
  })

  // 4. slots by bearing: nobody crosses the middle (B §3.5)
  this.place(alive.filter((m) => m.role === 'inner' && m.phase === 'approach'), BROOD.innerR, BROOD.spinIn * dt, terrain)
  this.place(alive.filter((m) => m.role === 'outer'), BROOD.outerR, BROOD.spinOut * dt, terrain)

  // 5. the surge
  this.timer -= ms
  let bite: Extract<EnemyAction, { kind: 'melee' }> | null = null
  switch (this.state) {
    case 'gather': {
      if (this.timer > 0) break
      const inner = alive.filter((m) => m.role !== 'outer')
      const near = inner.filter((m) => m.phase === 'approach' && !m.staggered
        && dist(m.pos, this.T) <= BROOD.surgeRange && terrain.lineClear(m.pos.x, m.pos.z, this.T.x, this.T.z, 0.2))
        .sort((a, b) => dist(a.pos, this.T) - dist(b.pos, this.T))
      const need = Math.min(BROOD.need, inner.length)
      if (near.length === 0 || near.length < need || !ctx.canLock(0)) break
      ctx.book(this, 0)
      let biters = near.slice(0, 4)
      if (this.queen && near.includes(this.queen) && !biters.includes(this.queen)) biters = [...biters.slice(0, 3), this.queen]
      this.L = this.lead(terrain, ctx)
      this.biters = biters
      for (const m of biters) { m.phase = 'windup'; m.role = 'surge'; m.t = 0 }
      this.state = 'windup'; this.timer = BROOD.windupMs
      this.ring.show(this.L, biters.map((m) => Math.atan2(m.pos.x - this.L!.x, m.pos.z - this.L!.z)))
      ctx.emit({ kind: 'surge', brood: this, at: this.L.clone(), ms: BROOD.windupMs, biters: biters.length })
      break
    }
    case 'windup': {
      for (let i = this.biters.length - 1; i >= 0; i--) {
        const m = this.biters[i]!
        const why = m.dead ? 'dead' : ctx.held(m) ? 'flung' : m.phase !== 'windup' ? 'parry' : dist(m.pos, this.L!) > BROOD.biteReach ? 'flung' : null
        if (!why) continue
        this.ring.lose(m)
        this.biters.splice(i, 1)
        if (!m.dead && m.phase === 'windup') { m.phase = 'approach'; m.role = 'inner' }
        ctx.emit({ kind: 'biterLost', brood: this, mite: m, why, arc: this.ring.arcPoint(m) })
      }
      if (this.biters.length === 0) { this.ring.hide(); this.state = 'gather'; this.timer = BROOD.regroupMs; this.L = null; break }
      if (this.timer > 0) break
      const live = this.biters.filter((m) => terrain.lineClear(m.pos.x, m.pos.z, this.L!.x, this.L!.z, 0.2))
      const n = Math.min(4, live.length)
      const hit = n > 0 && Math.hypot(ctx.player.x - this.L!.x, ctx.player.z - this.L!.z) <= BROOD.ringR
      ctx.emit({ kind: 'bite', brood: this, at: this.L!.clone(), biters: n, hit })
      if (hit) bite = { kind: 'melee', damage: BROOD.bite * n, source: live[0], tested: true }
      for (const m of this.biters) {
        const bx = m.pos.x - this.L!.x, bz = m.pos.z - this.L!.z, bd = Math.hypot(bx, bz) || 1
        let tx = this.L!.x + (bx / bd) * BROOD.clumpR, tz = this.L!.z + (bz / bd) * BROOD.clumpR
        const ld = Math.hypot(tx - m.pos.x, tz - m.pos.z)
        if (ld > BROOD.lungeMax) { tx = m.pos.x + ((tx - m.pos.x) / ld) * BROOD.lungeMax; tz = m.pos.z + ((tz - m.pos.z) / ld) * BROOD.lungeMax }
        const to = terrain.clampMove(m.pos.x, m.pos.z, tx, tz, m.radius)
        m.lungeFrom.copy(m.pos); m.lungeTo.set(to.x, 0, to.z)
        m.phase = 'strike'; m.t = 0
      }
      this.ring.strike()
      this.state = 'strike'; this.timer = BROOD.strikeMs
      break
    }
    case 'strike': {
      if (this.timer > 0) break
      for (const m of this.biters) if (!m.dead) { m.phase = 'recover'; m.role = 'spent'; m.t = 0 }
      ctx.emit({ kind: 'landed', brood: this, at: this.biters.map((m) => m.pos.clone()) })
      this.state = 'recover'; this.timer = BROOD.recoverMs
      break
    }
    case 'recover': {
      if (this.timer > 0) break
      for (const m of this.biters) if (!m.dead) { m.phase = 'approach'; m.role = 'inner'; m.t = 0 }   // cores flick back (G8)
      this.biters = []; this.L = null
      this.state = 'gather'; this.timer = BROOD.regroupMs
      break
    }
  }
  this.ring.update(dt, this.state, this.state === 'windup' ? 1 - Math.max(0, this.timer) / BROOD.windupMs : 1)
  return bite
}

private lead(terrain: Terrain, ctx: EnemyCtx): THREE.Vector3 {
  if (this.decoyed) return this.T.clone()                       // no lead on a decoy
  let lx = this.T.x + ctx.playerVel.x * BROOD.lead, lz = this.T.z + ctx.playerVel.z * BROOD.lead
  const d = Math.hypot(lx - this.T.x, lz - this.T.z)
  if (d > BROOD.leadMax) { lx = this.T.x + ((lx - this.T.x) / d) * BROOD.leadMax; lz = this.T.z + ((lz - this.T.z) / d) * BROOD.leadMax }
  const c = terrain.clampMove(this.T.x, this.T.z, lx, lz, PLAYER_RADIUS)   // never a ring inside a wall
  const L = new THREE.Vector3(c.x, 0, c.z)
  terrain.pushOut(L, PLAYER_RADIUS)
  return L
}

private place(list: Mite[], R: number, spin: number, terrain: Terrain) {
  if (!list.length) return
  const bearing = (m: Mite) => Math.atan2(m.pos.x - this.T.x, m.pos.z - this.T.z)
  list.sort((a, b) => bearing(a) - bearing(b))
  const a0 = bearing(list[0]!) + spin
  list.forEach((m, i) => {
    const a = a0 + (i * Math.PI * 2) / list.length
    m.slot.set(this.T.x + Math.sin(a) * R, 0, this.T.z + Math.cos(a) * R)
    if (terrain.blocked(m.slot.x, m.slot.z, m.radius)) {
      const c = terrain.clampMove(this.T.x, this.T.z, m.slot.x, m.slot.z, m.radius)   // a room edge pulls the slot in
      m.slot.set(c.x, 0, c.z)
    }
  })
}

seatQueen(cap: { used: number }, awake: Brood[]) {
  const q = this.queen
  if (!q || q.dead || q.role !== 'outer') return
  if (cap.used >= BROOD.innerMax) {
    // displace the farthest orbiting non-queen inner mite of any brood
    const victim = awake.flatMap((b) => b.mites).filter((m) => !m.dead && !m.queen && m.role === 'inner' && m.phase === 'approach')
      .sort((a, b) => dist(b.pos, b.brood.T) - dist(a.pos, a.brood.T))[0]
    if (!victim) return                                          // everyone's mid-surge: wait a tick
    victim.role = 'outer'; victim.refill = 0; cap.used--
  }
  q.role = 'inner'; q.refill = 0; cap.used++
}

private rippleWake() {                                          // cores light from the nest centre outward
  const c = centroid(this.mites.map((m) => this.pack.homes.get(m)!))
  for (const m of this.mites) m.wakeDelay = BROOD.wakeRippleMs * Math.min(1, dist(m.pos, c) / BROOD.nestR)
}
```

### 4.4 State machines

```
MITE (phases set by the brood; the mite only executes them)
  approach ──(brood: surge start, it's a biter)──▶ windup ──(550)──▶ strike 150 ──▶ recover 800 ──▶ approach
      ▲                                              │
      └────── Parry / grabbed / dead / > 2.8 from L ─┘  (leaves the surge; the ring loses one arc)

MITE ROLE
  outer ──(room in both caps, nearest first, 500 ms)──▶ inner ──(surge)──▶ surge ──▶ spent ──▶ inner
    ▲                                                   │
    └──── staggered and > 4.0 from T (not the queen) ───┘       queen: outer → inner at once (R21)

BROOD
  (asleep) ──wake──▶ GATHER ──(regroup done ∧ near ≥ min(3, inner) ∧ canLock(0))──▶ WINDUP 550
                       ▲                                                              │ all biters lost
                       │                                                              ├──────────▶ GATHER (500)
                       └── RECOVER 800 ◀── STRIKE 150 ◀──(550: bite resolves)─────────┘
  any state ──(pack leaves 'awake')──▶ reset (roles outer, ring off) ──(awake again)──▶ GATHER
```

### 4.5 How damage resolves, and what happens when mites die mid-windup

- The ring is fixed at `L` from the surge's first tick. Damage is decided on the
  550 ms tick only: `n = min(4, biters still in the surge with a solid line to
  L)`, and Still is hit if his centre is within 1.0 of L. One `melee` of `3 × n`,
  one hurt event, through the top-up and Anvil/Brace like any strike.
- A biter that dies (auto, bolt, Vent, anything, including a kill cast between
  ticks: the brood's tick runs before the enemy loop buries it), is Parried, is
  grabbed, or is shoved beyond 2.8 of L is removed on the brood's next tick. Its
  arc shatters, the chitter loses one flam, and the bite is 3 lighter. The
  ring's shape is always the true damage (T §4.2).
- All biters lost: the ring clears, no bite, `gather` with a 500 ms regroup.
- The queen is a biter like the others: a Cleaver (18) kills her in the arc.

### 4.6 Sleep, leash, return, wake

| event | brood | mites |
|---|---|---|
| asleep (placement) | idle; ring hidden | nest (§8.3), `idle()` nest pose, cores off |
| wake (pack) | first awake tick: `reset()`, `rippleWake()`; roles all outer | cores light in the ripple; promotion starts at once, so the first inner mites seat 0.5 s after waking |
| leash (nearest member > 16) | pack `returning`: `reset()` (the `active` flag) | `walkHome` at 3 u/s with `pushOut(e.pos, e.radius)`, idle pose |
| home | pack asleep | nest pose |
| woken again | fresh `reset()` | – |
| level change | `reset()` in Combat emits `broodGone`, disposes | batch cleared |

### 4.7 Edge cases

| case | rule |
|---|---|
| walls | slots inside a wall are pulled in (`place`); a blocked straight line uses `nextStep`; a surge needs a solid line from each biter to the target and from each biter to L; `L` is clamped by `clampMove` and pushed out, so no ring in a wall |
| crates, props | solids for all of the above; a lunge stops at them (`clampMove`) |
| corridors | streaming mites form a column (per-pair spacing 0.6); the outer ring clamps to the walls, which pulls it inside Vent reach (a deliberate easier case, B §6.3) |
| other enemies | spacing; a trampling ram flings them (they tumble; a biter may be lost; an inner one may be demoted) |
| Still dashing / Plumb snap | the lead reads the real velocity, clamped to 2.5 u; a dash at the ring's start throws it ahead; a dash during the windup is the dodge |
| Spring Heels vault | behind a wall the line checks fail: no surge; mites stream round |
| decoy | R20: the brood circles and surges the decoy with no lead; Still standing within 1.0 of L is still bitten; the Lure burst (18) kills its biters |
| slows | `speedMul` scales approach movement only (orbit, stream); the lunge and the 550 windup are untouched; slowed mites fall behind a moving Still |
| interrupts | Parry on a crouching biter: it leaves the surge (−3); on a mite that isn't winding up: only the 10 (a normal mite dies anyway) |
| marks | per mite, normal |
| Clamp Toss | grab a mite: `held` → lost `flung`; the throw's splash (14) kills the clump |
| Anvil | the bite is `melee`: caught; the 30 counter hits everything within 2.8 of Still, which kills every biter still near him |
| pause / hitstop | frozen; the chitter drifts by the hitstop (existing) |
| death of a mite | buried; `brood.remove`; last one → `broodEnd` |
| Stopped | world slows; no new surge voices |

---

## 5. Models, rigs, animation

Materials use today's palette: `BODY 0x5b3b35`, `JOINT 0x2b2426`, `CORE 0xff5a3c`,
`CORE_ASLEEP 0x2a1512`, `SLEEP_BODY (0.35, 0.35, 0.38)`, plus **`WORN 0x8a6a5a`**
(roughness 0.5, metalness 0.6) and **`PLATE 0x6e5a50`** (roughness 0.5,
metalness 0.55). Pose easing everywhere: `p += (target − p) × k` with
`k = snap ? 1 : min(1, dt × 14)`. `rim(x)` below means `rime` tint per P §3.1.

### 5.1 The ram

**Geometry is built once per module** (a lazy `RAM_GEO` cache) and shared by
every ram. Static pieces that share a material and a parent are merged with
`mergeGeometries` (`three/examples/jsm/utils/BufferGeometryUtils.js`), with
their transforms baked. Per ram: `mat` (BODY), `jointMat` (JOINT), `coreMat`
(CORE, basic), 5 × `seamMat` (basic), `glowMat` (additive, `haloTexture()`).
`wornMat` is module-shared (it doesn't flash). About 22 draw calls a ram.

Local +z is forward; the group origin is on the floor at the centre of its hit
circle. L = −x, R = +x.

```
group                                   rotation.y = facing (visual offsets in `grp`, never pos)
├─ body       Group (0, 0.55, 0)        rx = pitch (+ nose down), rz = roll, scale = squash
│  ├─ hullMat    MERGED(mat):   Cylinder(.40, .46, 1.25, 12) rx +π/2 at z −.05;  stack lip Cylinder(.11, .11, .05) at stack-local y .34
│  ├─ hullJoint  MERGED(joint): Torus(.45, .04, 6, 18) at z −.45 and +.30; stack pipe Cylinder(.08, .10, .34) at stack-local y .17
│  │               (stack frame: (0, .38, −.55), rx −0.35, baked)
│  ├─ firebox    Box(.50, .04, .62) at (0, .42, −.12)                                  coreMat  (hidden under the hatch)
│  ├─ hatchL     Group pivot (−.30, .46, −.12); open rz +1.2
│  │  └─ plate   Box(.20, .045, .64) at (+.10, 0, 0)                                    jointMat
│  ├─ hatchR     Group pivot (+.30, .46, −.12); open rz −1.2
│  │  └─ plate   Box(.20, .045, .64) at (−.10, 0, 0)                                    jointMat
│  ├─ seam[0..4] Box(.12, .04, .11) at y .48, z = −.40, −.27, −.14, −.01, +.12 (rear → front)   seamMat[i]
│  ├─ seamGlow   Plane(.42, 1.0) rx −π/2 at (0, .50, −.14), additive, depthWrite false   glowMat
│  ├─ stackMouth Object3D at stack-local (0, .37, 0) (ember/smoke spawn point)
│  └─ prow       Group pivot (0, −.05, .58); rx = head (+ down), ry = shake
│     ├─ plough  Box(.96, .52, .22) at (0, 0, .12), rx −0.35                              mat
│     ├─ edge    MERGED(worn): lip Box(1.0, .08, .12) at (0, −.26, .24); tusks Cylinder(.02, .07, .42, 6) at (±.36, −.08, .36) rx π/2 − 0.2   wornMat
│     └─ visor   Box(.46, .05, .03) at (0, .12, .215)                                     coreMat
└─ leg[FL, FR, BL, BR]  Group at (∓.36, .42, +.38 front / −.42 back); rx = swing, rz = splay
   ├─ thigh    Cylinder(.11, .09, .26) at y −.13                                          jointMat
   └─ lower    MERGED(mat): shin Cylinder(.08, .10, .18) at y −.30; hoof Box(.24, .10, .28) at (0, −.37, .04)
```

Hoof world points for FX: `hoof(i, out) = leg[i].localToWorld(out.set(0, −.37, .04))`.
`stackMouth(out)`, `firebox(out)`, `prowPoint(out)` likewise.

**Elite features** (`buildEliteFeature(mod)`, extra meshes on `body`):

| mod | meshes | behaviour |
|---|---|---|
| Quick | replace the stack pipe with `Cylinder(.08, .16, .30)` (a flared exhaust; rebuild `hullJoint` without the pipe and add this mesh) | main streams 1 ember a frame from `stackMouth` while it walks |
| Plated | `flankL`/`flankR`: Group pivots at (∓.46, .62, −.05), each with one MERGED(plateMat) of 3 × `Box(.05, .30, .32)` at z −.35 / 0 / +.35, hanging (y −.15); `ploughPlate` Box(.9, .46, .04) at prow (0, 0, .24) rx −0.35 | in a stun, flank pivots rz → ∓0.6 over 120 ms (ease-out-back); hits outside a stun sound dull |
| Many | `splitBand` Box(.04, 1.0, 1.9) at body (0, 0, −.05), jointMat; the halves' meshes offset ±0.02 in x (set `body.children` x); a second stack (both at x ±.18) | on death: the split (the halves are real rams at size 0.72 with one stack) |
| Warden | `mast` Cylinder(.04, .04, .9) from stack base to y 1.35 (body space); `cage`: 4 × Box(.02, .2, .02) at the corners of a .16 square, merged, jointMat; `lamp` Sphere(.07) coreMat; a `Sprite` (haloTexture, scale .5) at the lamp | sealed looks on its pack (below); tallest point in its pack |

**Awake at rest:** seams at `CORE × 0.2`, visor `CORE`, firebox hidden (hatches
shut), `glowMat.opacity = 0`.

**Sealed** (a Warden pack member while `armor < 1`, or `unsealT > 0`): seams
and visor at `JOINT`, with `seamMat[2]` at `CORE × 0.4` as the rim.

**Per-phase animation** (`present(dt, target)`; `tw = t` in ms of the phase; `s = seconds since phase start`):

| phase | targets and per-frame formulas | colour / glow |
|---|---|---|
| asleep (`idle`) | body.y 0.40, body.rx +0.06; legFL/FR.rx +1.1, legBL/BR.rx −1.1; prow.rx +0.30; `body.scale.y = 1 + 0.02 × (0.5 + 0.5 sin(2π × 0.3 × clock))` | bodies × SLEEP_BODY; seam, visor, firebox `CORE_ASLEEP` |
| waking (`wakeT` 0.25 s, counting down in update and idle) | `u = 1 − wakeT/0.25`: body.y = 0.40 + 0.15u; legs lerp from folded to 0 by u; seam i flashes CORE for 50 ms at `i × 50 ms` | main puffs 3 × `smokePuff(stackMouth)` on the first waking frame (`consumeWake()`) |
| approach: walk | `bob += dt × 5`; `g = bob × 1.8`; legFL.rx = legBR.rx = `sin(g) × 0.40`; legFR.rx = legBL.rx = `−sin(g) × 0.40`; body.rz = `sin(g) × 0.04`; grp.y = `abs(sin(g)) × 0.04`; prow.ry = `sin(bob × 0.9) × 0.05` | seams 20% |
| approach: back off | `bob −= dt × 5` (the trot plays backward); prow.rx → +0.10 | – |
| approach: hold | legs → 0; `body.scale.y = 1.01 + 0.01 sin(2π × 0.8 × clock)` | – |
| windup: tracking (0–495) | body.rx → +0.12; body.y → 0.47; prow.rx → +0.10; paw: `legFR.rx = −0.6 × tri(tw − 80) − 0.6 × tri(tw − 300)` with `tri(x) = x∈[0,60] ? x/60 : x∈[60,120] ? 2 − x/60 : 0`; shiver `grp.x = sin(s × 60) × 0.01 × (tw / 495)` (in local x); yaw = aim | seam i = `tw ≥ (i+1) × 99 ? CORE : CORE × 0.2`; glow `0.35 × tw/495` |
| LOCK (the frame tw crosses 495) | **snap:** prow.rx +0.28; body.scale (1.02, 1.04, 0.94); grp.z = −0.08 (local, rocks back); legBL/BR.rx −0.35 | seams `0xffe0b0` → CORE over 100 ms; glow 0.8 |
| windup: locked (495–900) | hold every target; shiver `grp.x = sin(2π × 30 × s) × 0.012` | – |
| strike: rush | gallop: `h = sin(2π × 14 × s) × 0.70`; legFL = legBR = h, legFR = legBL = −h; body.rx → +0.14; body.scale → (0.98, 0.97, 1.06); prow.rx +0.28 | – |
| strike: skidding | **snap:** front legs rx −0.60, back +0.30; body.rx −0.18; prow.rx −0.05 | – |
| recover: miss (900) | 0–250: hold the skid pose, `k × 0.5`; 250–750: targets to rest, facing turns (update), legs step (`bob += dt × 5`); 750–900: `prow.ry = 0.10 × sin(2π × (tw − 750) / 150)` | seams → 20% over 300 ms |
| wall impact (first frame of a stun) | **snap:** `squash0 = (1.1, 1.1, 0.80)`; then `body.scale = 1 + (squash0 − 1) × exp(−s / 0.07) × cos(2π s / 0.14)` for s ≤ 0.2; prow.rx **snap** −0.25; body.rx +0.30 → +0.18 | – |
| stun (1200) | hatches: `u = min(1, s / 0.12)`, `open = 1.2 × backOut(u)` with `backOut(u) = 1 + 2.70158 (u−1)³ + 1.70158 (u−1)²`; last 400 ms `open = 1.2 − 0.4 × (tw − 800)/400`; hatchL.rz = +open, hatchR.rz = −open; legs rz ±0.30; `prow.ry = sin(s × 44) × 0.12 × (1 − s/1.2)`; firebox visible, `scale = 1 + 0.25 sin(2π × 9 × s)`; Plated flanks ∓0.6 | glow `0.9 × (0.5 + 0.5 sin(2π × 9 × s))` |
| stun end (1200) | **snap** hatches 0, flanks 0 | – |
| recover after stun (400) | body.rx → 0; body.y → 0.55; turning (update) | – |
| trip (1200) | prow.rx → +0.50; body.rx +0.45, back to 0 over 300 ms; **facing += (π/2) × dt / 0.25 for the first 250 ms** (a real quarter turn); hatches stay shut | rime (P) |
| reload | walk poses | seams 20% |
| stagger (sliding > 1.5) | body.rx → −0.15 | – |
| Parry cancel | seams snap to `CORE × 0.2`; prow.rx snap −0.2, eased back | – |
| death | without the husk: the burst (§7.1). **Husk (optional, step 4):** `bury` calls `c.detachHusk()` before `dispose`: the group is removed from Combat's ownership and handed to main's `husks` list for 350 ms: legs rz ±0.8, body.y 0.55 → 0.25 over 150 ms, body.rx +0.2, seam/visor white then dark at 200 ms; killed mid-rush it slides on 1.5 u easing out (`x += v`, `v` from 18 decaying `exp(−12 s)`); then the burst fires at its final spot and main disposes it | – |

`tint()`: `mat`/`jointMat` as the Chaser's (asleep multiply, flash lerp to
white × 0.85, flash emissive), plus P's rime lerp.
`group.scale = size × (1 + flash × 0.1)`.

### 5.2 The swarf mite

**Rig (per mite, no meshes):**

```
group                    Object3D at pos (+ hop y), rotation.y = face, scale = size × (1 + flash × 0.1)
└─ body   (0, .12, 0)    rx = pitch, scale = crouch, x = tremble
   ├─ shell  (0, 0, 0)
   ├─ belly  (0, −.02, 0)
   ├─ core   (0, .155, −.04)
   ├─ halo   (0, .20, −.04)            billboard: the batch uses its world position only
   ├─ jawL   (−.07, 0, .30)  ry rest −0.25     jawR (+.07, 0, .30) ry rest +0.25
   └─ legsL  (−.18, 0, 0)  rz = rock           legsR (+.18, 0, 0)
```

**`MiteBatch`** (one per Combat, capacity 32; two broods of 8 is the level max):

| InstancedMesh | geometry (module-level, scales baked) | material | instance colour |
|---|---|---|---|
| shell | `Sphere(.27, 10, 6, 0, 2π, 0, π/2)` scaled (1, .62, 1.2) | `MeshStandardMaterial(white, rough .45, metal .6)` | BODY × sleep × rime(0.5) → flash lerp white × 0.85 |
| belly | `Cylinder(.25, .21, .07, 8)` | shared `jointInst` (`MeshStandardMaterial(white, rough .6, metal .5)`) | JOINT × sleep × rime |
| jawL, jawR | `Box(.045, .04, .15)` translated (0, 0, .07) | `jointInst` | same |
| legsL | merged 3 × `Box(.20, .03, .035)` centred x −.10, z −.13 / 0 / +.13, yaw +.35 / 0 / −.35, **rz +0.5** (outer tips down to the floor) | `jointInst` | same |
| legsR | mirror: x +.10, yaw −.35 / 0 / +.35, **rz −0.5** | `jointInst` | same |
| core | `Sphere(.075, 8, 6)` scaled (1, .6, 1.3) | `MeshBasicMaterial(white)` | role colour × heartbeat |
| halo | `Plane(1, 1)` | `MeshBasicMaterial(white, map haloTexture(), additive, transparent, depthWrite false)` | `0xff7850 × haloOpacity` (additive: colour is brightness) |

```ts
sync(camera: THREE.Camera, clock: number) {
  let i = 0
  for (const m of this.live) {
    m.group.updateMatrixWorld(true)
    this.shell.setMatrixAt(i, m.rig.shell.matrixWorld)             // … belly, jawL, jawR, legsL, legsR, core likewise
    m.rig.halo.getWorldPosition(v)
    this.halo.setMatrixAt(i, mtx.compose(v, camera.quaternion, s.setScalar(m.haloScale * m.size)))
    this.shell.setColorAt(i, m.shellColor(c)); /* joint colour on 5 meshes; core; halo */
    i++
  }
  for (const mesh of this.meshes) { mesh.count = i; mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true }
}
```

Every instanced mesh: `frustumCulled = false`, `setColorAt` for all 32 at
construction. Main calls `combat.miteBatch.sync(world.camera, now)` each frame
before `world.render()`. **Draw calls for every mite in the level: 8.**

**Core role colours** (T E4), × heartbeat `hb = 0.85 + 0.15 sin(2π × brood.heartHz × clock)`:

| role / state | core | halo opacity | halo scale |
|---|---|---|---|
| inner | CORE | 0.9 | 0.55 |
| outer | CORE × 0.55 | 0.45 | 0.55 |
| surge (windup, `k = t/550`) | CORE → `0xffc890` by k | 0.9 → 1.0 | 0.55 → 0.8 |
| spent (recover) | CORE × 0.3 | 0.15 | 0.55 |
| asleep, or `wakeDelay > 0` | CORE_ASLEEP (no hb) | 0 | – |
| sealed (`armor < 1` or `unsealT > 0`) | JOINT with no hb | 0 | – |
| Parry blink (`blinkT > 0`) | CORE_ASLEEP | 0 | – |

**Per-phase animation** (`present`; `bob += dt × 12`, `× 1.3` for a Quick queen;
`g = bob × 2` (`× 2.6` Quick queen); `s` seconds in phase):

| phase | pose |
|---|---|
| asleep (`idle`) | body.y 0.06; legsL.rz +0.6, legsR.rz −0.6 (tucked); `body.scale.y = 1 + 0.04 × (0.5 + 0.5 sin(2π × 0.4 × clock + index))` |
| approach (stream or orbit) | legsL.rz = `sin(g) × 0.35`, legsR.rz = `−sin(g) × 0.35`; body.y = `0.12 + abs(sin(g)) × 0.02`; face = travel (stream) or toward T (orbit); yaw jitter `+ 0.06 sin(bob × 0.7 + seed × 6.28)`; jaws `rest ± 0.1 sin(2π × 6 × s)`; when not `moving`, legs → 0 |
| windup 0–80 ms | **snap** face = `atan2(L − pos)` |
| windup 80–450 | body.y → 0.08; body.scale → (1.1, 0.75, 1.1); body.rx → −0.30; jaws → ∓0.55; legsL.rz → −0.3, legsR.rz → +0.3 (splayed flat); tremble `body.x = sin(2π × 40 × s) × 0.01` |
| windup 450–550 | body.y → 0.06; body.scale.y → 0.68 |
| strike (150) | `u = min(1, t/150)`; hop `group.position.y = 4 × 0.35 × u (1 − u)`; body.rx → +0.40; jaws **snap** ∓0.05 at `t ≥ 50` |
| recover (800) | `body.scale.y = 0.80 + 0.03 sin(2π × 3 × s)`; jaws ∓0.05; legs 0 |
| staggered (sliding) | tumble: `body.rx += dt × 18` while sliding; on landing `body.rx` eases to 0 and main puffs `dust(pos, 1, 0.2)` |
| death | pop (§7.2); no husk |

**The brood-mother** (`buildQueenExtras(mod)`): a real `Group` with
`matrixAutoUpdate = false`, added to the scene, whose `matrix` is copied from
`rig.body.matrixWorld` each frame in `sync`. Children: `sac` Sphere(.16, 10, 8)
scale z 1.35 at (0, .08, −.30), its own `MeshBasicMaterial(CORE)`; `spines`
MERGED 3 × Cone(.03, .12, 5) at z −.10 / .02 / .14, y .17, `jointMat`; `glow`
Sprite (haloTexture, additive) scale 0.8 at the sac. The sac pulses
`0.7 + 0.3 sin(2π × heartHz × clock)`, swells 1.0 → 1.25 through the windup,
releases (**snap** 1.0) at the lunge, and stays at full CORE in recover. Quick:
`legsL/legsR.scale.x = 1.3`. Warden: her sac is the brood's only lit core
(members are sealed). 4 extra draw calls per queen.

### 5.3 The seal ripple

When a Warden dies, Combat sets `unsealT = 0.03 × rank` on each surviving
member (ram or mite, nearest first) and emits `sealBreak`. A member's sealed
look lasts while `armor < 1 || unsealT > 0`, so the lights come back in a ripple
outward over `0.03 × n` s. Main plays one `sfx.sealTick(panOf(m.pos), 0.03 × rank)` per member.

---

## 6. Telegraphs

### 6.1 `LaneTell` (`src/lane.ts`)

```ts
export const WALL_TOP = 0.9                 // the barrier's top, as P §3.5's tick
export type LaneEnd = 'open' | 'wall' | 'prop'
export interface LaneState {
  stage: 'off' | 'tracking' | 'locked' | 'rush'
  x: number; z: number; aim: number
  len: number             // body centre now → body centre where it stops
  coreHalf: number        // the body's lane: radius + 0.1
  hitHalf: number         // where Still's centre gets hit: coreHalf + 0.42
  bodyR: number           // for the contact point
  end: LaneEnd
  fill: number            // 0..1, the locked core fill
  dim: number             // 1, or 0.6 while another tell is locked (tracking only; step 4)
  order: number           // renderOrder (step 4)
}
export class LaneTell {
  readonly group = new THREE.Group()       // world space; the owner adds it to its tellGroup
  update(dt: number, s: LaneState): void
  /** N9: every piece to 0 now (Parry, trip). */
  break(): void
  dispose(): void
}
```

All strips use one module-level unit strip geometry,
`PlaneGeometry(1, 1).translate(0, 0.5, 0).rotateX(π/2)` (width 1 on x, length 1
along +z), scaled per piece. Radial pieces use `CircleGeometry`. The group sits
at `(x, DECAL_Y, z)`, `rotation.y = aim`.

| piece | geometry / placement (local) | material | tracking | locked | rush |
|---|---|---|---|---|---|
| rails ×2 | unit strip, scale (0.08, 1, L_r), x = ±(hitHalf − 0.04), y +0.006; **L_r = len − 0.6** tracking, `len` after | `railMat` strip | 0.30 × dim | **snap** 0.70 | 0.70 |
| wash | unit strip, scale (2 hitHalf, 1, len), y +0.002 | `washMat` strip | 0 | **snap** 0.18 | 0.30 |
| core | unit strip, scale (2 coreHalf, 1, max(0.001, len × fill)), y +0.004; `fill = (t − 495)/405` | `coreMat` strip | 0 | 0.55 | 0.90, fill 1 |
| end cap | `CircleGeometry(1, 16, π, π)` rx −π/2 (the half past the end), scale hitHalf, at z = len | `capMat` radial r 1 | 0 | 0.18 | 0.30 |
| skid streaks ×2 (`end === 'open'`) | unit strip, scale (0.12, 1, 1.2), x ±0.35, z = len − 1.2, y +0.008 | `markMat` strip | 0 | stamp | 0.9 |
| wall star (`end !== 'open'`) | disc `CircleGeometry(0.7, 20)` rx −π/2 at z = len + bodyR; 6 spikes: unit strip scale (0.06, 1, 0.9), origin at the contact, `rotation.y = π + a`, a ∈ {−1.2, −0.72, −0.24, 0.24, 0.72, 1.2} | `starMat` radial r 0.7; spikes `markMat` | 0 | stamp | 0.9 |
| wall-top bar (`end === 'wall'`) | unit strip scale (2 coreHalf, 1, 0.12) at (0, WALL_TOP + 0.02 − DECAL_Y, len + bodyR + 0.25) | `markMat` | 0 | stamp | 0.9 |

- **Stamp** (the end mark's lock frame): opacity 0 → 0.9 over 40 ms, then eases
  to 0.6 by `dt × 5`. `markMat` and `starMat` share the stamp value.
- **Off** (after the rush, a recover, a stop): every material fades `dt × 5`.
- `break()`: every material's opacity = 0 this frame (main scatters the cold
  sparks).
- The strip shader's chevrons already flow toward +z (away from the body) and
  the radial ripple outward (G3). Nothing new in the shader.
- The ram fills `LaneState` from its own fields: `stage = rushing ? 'rush' :
  phase === 'windup' ? (locked ? 'locked' : 'tracking') : 'off'`.
- Many split rams get the narrower lane for free (`coreHalf 0.532`, `hitHalf 0.952`).

### 6.2 The Assembler's lane

`boss.ts` replaces `this.lane` (strip 2.3 × 30) with
`this.laneTell = new LaneTell()` (in `tellGroup`), `coreHalf 1.15`,
`hitHalf 1.57`, `bodyR = radius`.

```ts
// windup, move === 'charge', every tick (tracking and locked)
const want = 30
const end = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + Math.sin(this.aim) * want, this.pos.z + Math.cos(this.aim) * want, this.radius)
this.laneLen = Math.hypot(end.x - this.pos.x, end.z - this.pos.z)
this.laneEnd = this.laneLen < want - 0.05 ? (terrain.blocker(/* probe past contact */) === 'prop' ? 'prop' : 'wall') : 'open'
// strike (charge): replaces `hitYou`
const along = (target.x - this.chargeFrom.x) * fx + (target.z - this.chargeFrom.z) * fz
if (!this.chargeHit && along >= 0 && distToSegment(target.x, target.z, ax, az, this.pos.x, this.pos.z) <= 1.57) {
  this.chargeHit = true
  action = { kind: 'melee', damage: BOSS.charge.damage, source: this, tested: true }
}
```

`chargeFrom`/`chargeHit` are set when the charge's strike starts. The boss's
wall crash keeps `sfx.clang`. The camera frames its lane end (§8.4).

### 6.3 The bite ring (`BiteRing`, in `swarm.ts`)

```ts
const ARC_GEO = [1, 2, 3, 4].map((n) => { const arc = (Math.PI * 2) / n - 0.35; return new THREE.RingGeometry(0.88, 1.0, 10, 1, -arc / 2, arc) })
const DISC_GEO = new THREE.CircleGeometry(1.0, 32)

export class BiteRing {
  readonly group = new THREE.Group()        // in the scene, at (L.x, DECAL_Y, L.z)
  private arcs: THREE.Mesh[]                // 4, share arcMat = tellMaterial('radial', 1.0)
  private disc: THREE.Mesh                  // discMat = tellMaterial('radial', 1.0)
  private owners: (Mite | null)[] = []
  show(L: THREE.Vector3, bearings: number[]) // n = bearings.length: arcs[i].geometry = ARC_GEO[n − 1], rotation.x = −π/2, rotation.z = bearings[i] − π/2; stamp
  lose(m: Mite)                              // that arc: visible = false
  arcPoint(m: Mite): THREE.Vector3           // L + (sin b, 0, cos b) × 1.0 for the shatter FX
  strike()                                   // arcs 0.95, disc 0.80, disc scale 1
  hide()
  update(dt, state, k)                       // windup: disc scale max(0.001, k), opacity 0.30; arcs stamp; else fade dt × 4
}
```

The rotation mapping matches `Combat.sweep` (`rotation.z = bearing − π/2`
points a flat circle's local +x along `(sin b, 0, cos b)`). **Stamp**: arcs 0 →
0.9 over 50 ms, settle to 0.5. **No scale change** on the ring itself (a
shrinking ring is Still's grammar, G2).

### 6.4 Tells in a crowd (step 4)

- `TELL_CROWD = { locked: 0 }` in `vfx.ts`. `Combat.countTells()` sets it each
  tick to the number of locked tells: rams locked or rushing, sentinels
  `locked`, broods in windup, hulks in windup, the boss in windup.
- Tracking dims to 60% while `TELL_CROWD.locked > 0` (excluding itself): ram
  rails (`dim`), sentinel line before its lock (`lineMat.opacity = 0.16 × dim`).
- **Soonest on top:** every tell's meshes get
  `renderOrder = 1000 − msToStrike / 10` each tick (ram `900 − t` in windup, 0
  in rush; sentinel `windupMs − t`; hulk `timer`; brood `timer`; boss `timer`).

---

## 7. VFX and SFX

### 7.1 VFX: exact calls

All calls are the existing `vfx.ts` API: `sparks(at, color, count, speed, dir?, spread)`,
`embers(at, count, radius, color?)`, `flash(at, color, size)`,
`dust(at, count, radius, color?, speed)`, `smokePuff(at, count, color?)`,
`chunks(at, count, color, speed, size)`, `trail(at, color, size, life?)`. `aim3`
is the unit lane direction; `at3(p, y)` as in main.

**Ram, moments (main, `onEnemy` / `onStrike` / `onKill` / `onHit`):**

| event | calls | shake / hitstop / punch |
|---|---|---|
| `paw` | `dust(ev.at, 3, 0.3, undefined, 2)` | – |
| `lock` | `embers(stackMouth, 4, 0.15)`; `smokePuff(stackMouth, 1)` | punch +0.01 |
| rush start (`strikeFx` charger branch) | `dust(rearMid, 12, 0.6, undefined, 5)`; `sparks(at3(rearMid, 0.1), EMBER, 8, 6, aim3.negate(), 0.6)`; `flash(prowPoint, EMBER, 0.6)` | 0.12 / – / – |
| `trample` | `sparks(at3(ev.at, 0.5), EMBER, 6, 5, ev.dir, 0.5)`; not a mite: `dust(ev.at, 4, 0.5)` | – |
| `nearMiss` | `dust(still.pos, 4, 0.4, new Color(0x55606c), 3)` | punch −0.015 |
| `rushEnd wall` | at `ev.at`: `chunks(at, 10, STONE, 5, 0.14)`; `chunks(at, 3, RUST, 4, 0.12)`; `sparks(at, EMBER, 22, 8, aim3.negate(), 1.3)`; `flash(at, EMBER, 1.3)`; `dust(at, 14, 1.0, undefined, 5)`; `smokePuff(stackMouth, 2)` | 0.40 / 0.07 / +0.03; **the first ram stun of the run**: hitstop 0.12, punch +0.04 (`run.ramStunSeen`) |
| `rushEnd caught` | as wall, without the stone chunks | as wall |
| `rushEnd trip` | `tellBreak(e)` (below) | – |
| `rushEnd open` | – (the skid FX already ran) | – |
| `stunEnd` | `sparks(at3(e.pos, 0.9), EMBER, 4, 3)`; `dust(e.pos, 2, 0.5)` | – |
| hit on a stunned ram (`onHit`) | instead of the normal 8: `sparks(at, COLD, 12, 6.5, away, 0.9)`; plus `flash(firebox, EMBER, 0.4)` | hitstop 0.06 (normal 0.045) |
| death (`onKill` charger) | `chunks(at3(at, 0.8), 14, RUST, 5.5, 0.18)`; `chunks(at3(at, 1.0), 2, JOINT_C, 6, 0.30)` (the hatches); `sparks(at3(at, 0.9), EMBER, 18, 6)`; `flash(at3(at, 0.9), EMBER, 1.0)`; `dust(at, 10, 1.0)`; `smokePuff(at3(at, 1.0), 3)`. Plated: `+ chunks(…, 4, PLATE_C, 5, 0.26)`. Many: `+ chunks(…, 6, RUST, 5, 0.14)` (the crack) | 0.30 / 0.08 / +0.035 |
| Parry cancel or trip: `tellBreak(e)` for a ram | 16 × `sparks(p, COLD, 1, 2)` at `p = lane origin + aim3 × rand(0, len) + normal × (±hitHalf)` | P's (0.09 for Parry) |

**Ram, continuous (`ramFx(dt)` in main, every frame, per ram):**

| while | calls |
|---|---|
| asleep, within 20 u of Still | every `2.5 ± 0.8` s: `smokePuff(stackMouth, 1, new Color(0x4a4744))` (the banked fire) |
| waking (`consumeWake()`) | `smokePuff(stackMouth, 3)` once |
| windup tracking | every 90 ms: `embers(stackMouth, 1, 0.1)` (replaces the hulk windup embers for this kind) |
| walking | every 0.8 s: `smokePuff(stackMouth, 1)`, **unless** another awake ram is within 6 u; Quick: `embers(stackMouth, 1, 0.05)` every frame |
| rushing | `trail(stackMouth, EMBER, 0.22)` every frame; while `spent < 24`: every 2nd frame `dust(rearMid, 1, 0.3, undefined, 2)` (spent += 1), every 3rd frame `sparks(hoofMid, EMBER, 2, 4, aim3.negate(), 0.5)` (spent += 2). `spent` resets at rush start |
| skidding | `sparks(frontMid, EMBER, 3, 5, aim3, 0.4)`; `dust(frontMid, 2, 0.4, undefined, 4)` |
| stunned | every 90 ms: `sparks(firebox, EMBER, 2, 3)`; Plated: `+ sparks(flankL/R points, EMBER, 1, 3)` |

**Swarm:**

| event | calls | shake / hitstop |
|---|---|---|
| `surge` | 6 × `sparks(L + dir_k × 1.0 (y 0.15), EMBER, 1, 2, dir_k, 0.2)`, `dir_k` at k × 60° | – |
| strike (per biter, first 50 ms of the lunge, `broodFx`) | `trail(core point, EMBER, 0.10)` | – |
| `landed` | per point: `dust(p, 2, 0.25, undefined, 2)` | – |
| recover (`broodFx`, per brood) | every 200 ms: `smokePuff(L + (0, 0.2, 0), 1, new Color(0x3a3430))` | – |
| `biterLost` parry | `sparks(ev.arc, COLD, 6, 3)` | – |
| `biterLost` flung | `sparks(ev.arc, EMBER, 3, 2)` (an ember crumble) | – |
| mite death (`onKill` swarm) | `chunks(at3(at, 0.2), 3, RUST, 3.5, 0.08)`; `sparks(at3(at, 0.25), EMBER, 5, 4)`; `flash(at3(at, 0.25), EMBER, 0.35)`. No dust. Queen: + `flash(…, EMBER, 0.6)` | `miteKills++` this tick: shake = max(shake, miteKills ≥ 3 ? 0.12 : 0.06); hitstop = max(hitstop, miteKills ≥ 3 ? 0.03 : 0.02). Never summed. `miteKills = 0` at the top of `simulate` |
| tumble landing | `dust(m.pos, 1, 0.2)` | – |
| `broodEnd` | `embers(at3(ev.at, 0.2), 12, 0.3)` | 0.15 |

Budget check, a Vent killing 8 mites: 24 chunks (pool 260), 40 sparks (pool
1800), 16 flash particles. One crunch.

### 7.2 SFX: new `audio.ts` code

```ts
/** A voice that can follow its source and be cut. */
export interface Voice { stop: (hard?: boolean) => void; pan: (p: number) => void; dip?: () => void; lose?: () => void }
export const asVoice = (stop: (hard?: boolean) => void): Voice => ({ stop, pan: () => {} })

/** A panner the caller can move. */
function livePan(c: AudioContext, bus: Bus, pan: number) { const p = c.createStereoPanner(); p.pan.value = clampPan(pan); p.connect(buses[bus]); return p }
function gate(g: GainNode, c: AudioContext, until: number) {
  return (hard = false) => {
    const now = c.currentTime; if (now >= until) return
    g.gain.cancelScheduledValues(now)
    if (hard) g.gain.setValueAtTime(0, now); else g.gain.setTargetAtTime(0.0001, now, 0.01)
  }
}
/** Limiter: at most one call per `gapS` per name (T E7). */
const lastAt = new Map<string, number>()
function limited(name: string, gapS: number, t: number) { const l = lastAt.get(name) ?? -1; if (t - l < gapS) return true; lastAt.set(name, t); return false }

export function hit(pan: number, gain = 1) { /* existing body with every peak × gain */ }
// step(): add   case 'ram': sample(c, 'step', d, 0.7 * loudness, 0.8); sample(c, 'metalLight', d, 0.12 * loudness, 0.7)
```

**The ram.**

```ts
/** The windup: an engine revving on A, a latch at the lock, a valve to the rush. */
export function rev(ms: number, lockAt: number, pan: number, gain = 1): Voice {
  const c = live(); if (!c) return asVoice(() => {})
  const t = c.currentTime, dur = ms / 1000, lock = t + dur * lockAt
  const p = livePan(c, 'enemy', pan)
  const g = c.createGain(); g.gain.value = gain; g.connect(p)
  // engine: saw 55 → 110 Hz to the lock, held; distorted, lowpass Q4 250 → 1100 to the lock, held
  const o = c.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(55, t); o.frequency.exponentialRampToValueAtTime(110, lock); o.frequency.setValueAtTime(110, lock)
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4
  lp.frequency.setValueAtTime(250, t); lp.frequency.exponentialRampToValueAtTime(1100, lock); lp.frequency.setValueAtTime(1100, lock)
  const eg = c.createGain()
  eg.gain.setValueAtTime(0.0001, t); eg.gain.linearRampToValueAtTime(0.20, lock); eg.gain.setValueAtTime(0.20, t + dur)
  eg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.03)
  // tremolo from the lock: 14 Hz, depth 40% of 0.20
  const lfo = c.createOscillator(); lfo.frequency.value = 14
  const depth = c.createGain(); depth.gain.value = 0.08
  lfo.connect(depth).connect(eg.gain); lfo.start(lock); lfo.stop(t + dur + 0.05)
  o.connect(distorted(c, lp)); lp.connect(eg).connect(g)
  o.start(t); o.stop(t + dur + 0.05)
  // ratchet: one tick per seam segment
  for (let i = 0; i < 5; i++) { const f = 900 + 120 * i; tone(c, g, 'square', t + (i + 1) * 0.099, f, f * 0.6, 0.014, 0.12, 0.0008) }
  // pawing at 80 and 300 ms
  for (const at of [0.08, 0.30]) { hiss(c, g, t + at, 0.09, 0.25, 'bandpass', 1600, 500, 1.2); sample(c, 'step', g, 0.4, 0.55, at) }
  // the latch
  tone(c, g, 'square', lock, 700, 380, 0.03, 0.20, 0.0008)
  tone(c, g, 'sine', lock, 110, 70, 0.08, 0.5)
  sample(c, 'metalHeavy', g, 0.7, 1.25, lock - t)
  // the valve: highpass hiss 3000 → 6000, 0.02 → 0.12, lock → end
  valve(c, g, lock, t + dur)          // loop noise → highpass (setValueAtTime 3000 at lock, exp to 6000 at end) → gain linear 0.02 → 0.12, stop at end + 0.02
  return { stop: gate(g, c, t + dur), pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.03) }
}

/** The rush: a roar and hooves, panned live; dip() is the cheap Doppler at the closest pass. */
export function rush(pan: number): Voice {
  const c = live(); if (!c) return asVoice(() => {})
  const t = c.currentTime, p = livePan(c, 'enemy', pan), g = c.createGain(); g.connect(p)
  const o = c.createOscillator(); o.type = 'sawtooth'
  o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.55)
  const eg = c.createGain(); env(eg, t, 0.5, 0.003, 0.55)
  o.connect(distorted(c, eg)); eg.connect(g); o.start(t); o.stop(t + 0.6)
  hiss(c, g, t, 0.5, 0.45, 'bandpass', 500, 1400, 1)
  sample(c, 'softHeavy', g, 0.8, 0.8)
  for (let i = 0; i < 6; i++) sample(c, 'step', g, 0.5 * 0.85 ** i, 0.6, i * 0.07)
  return {
    stop: (hard) => { const now = c.currentTime; g.gain.cancelScheduledValues(now); hard ? g.gain.setValueAtTime(0, now) : g.gain.setTargetAtTime(0.0001, now, 0.02) },
    pan: (v) => p.pan.setTargetAtTime(clampPan(v), c.currentTime, 0.02),
    dip: () => { const now = c.currentTime; o.frequency.cancelScheduledValues(now); o.frequency.setTargetAtTime(o.frequency.value * 0.85, now, 0.03) },
  }
}

export function ramCrash(pan: number, bell = true) {
  // sine 130 → 38 .35 ×1.0; hiss lowpass 4500 → 250 .35 ×.6; +metalHeavy @0.75 ×1.0; +mining @0.70 ×0.7 at +10 ms; bell: +bell @1.35 ×0.55
}
/** The stun: struck iron ringing, wobbling at 5 Hz; the hatch slams at the end. Cut hard if it dies inside. */
export function dazed(ms: number, pan: number): Voice {
  // g (gate) ← wobble gain (base 1, LFO 5 Hz depth 0.5) ← three triangle partials 1040 / 1560 / 2330 × vary(1, .01), ×0.05 each,
  //   one env: attack 3 ms, exponential decay over ms / 1000
  // at t + ms/1000: tone(square 1200 → 700, .015, ×.2) + sample metalMedium @1.4 ×0.5, both into g
  // return { stop: gate(g, c, t + ms/1000 + 0.05), pan }
}
export function hitOpen(pan: number) { /* sine 1320 → 1300 .25 ×.08; +bell @2.0 ×0.3 */ }
export function plateDull(pan: number) { /* +generic @0.9 ×0.4 */ }
export function skid(pan: number) { /* hiss bandpass 2800 → 700 Q2 .4 ×.35; square 180 → 90 .2 ×.08 through distorted; +mining @1.3 ×0.25 */ }
export function trample(pan: number) { const c = live(); if (!c || limited('trample', 0.08, c.currentTime)) return; /* +metalMedium @1.1 ×0.4 */ }
export function ramDeath(pan: number) { /* hiss highpass 2500 → 1200 .6 ×.2; sine 1800 → 600 .5 ×.05; +plateHeavy @0.6 ×0.6 at +50 ms. Layered on kill() */ }
export function sealTick(pan: number, delay: number) { /* +tin @2.0 ×0.15 at +delay */ }
```

**The swarm.**

```ts
/** One tick of a brood's rustle. The scheduler lives in main. */
export function skitterTick(pan: number, loud: number) {
  const c = live(); if (!c || loud <= 0.02) return
  const t = c.currentTime, d = out(c, 'enemy', pan)
  if (Math.random() < 1 / 3) sample(c, 'tin', d, 0.05 * loud, vary(3.0, 0.15))
  else { const f = vary(3400, 0.08); tone(c, d, 'square', t, f, 2200, 0.006, 0.04 * loud, 0.0005); hiss(c, d, t, 0.008, 0.03 * loud, 'highpass', 6000, 6000, 0.7) }
}

/** The surge's one windup: a rising chirp, a kettle hiss, mandible clicks tightening. n flams per click = biters; lose() drops one. */
export function chitter(ms: number, biters: number, pan: number, gain = 1): Voice {
  const c = live(); if (!c) return asVoice(() => {})
  const t = c.currentTime, dur = ms / 1000
  const g = c.createGain(); g.gain.value = gain; g.connect(out(c, 'enemy', pan))
  tone(c, g, 'square', t, 2600, 3400, 0.03, 0.18, 0.0008)            // onset = the lock
  sample(c, 'tin', g, 0.4, 2.4)
  riseHiss(c, g, t, dur, 1800, 4800, 6, 0.04, 0.22)                   // loop noise → bandpass Q6 (exp 1800 → 4800) → gain linear .04 → .22, cut at t + dur
  const flam = [0, 1, 2, 3].map((k) => { const fg = c.createGain(); fg.gain.value = k < biters ? 1 : 0; fg.connect(g); return fg })
  let at = 0
  while (at < dur - 0.01) {
    for (let k = 0; k < 4; k++) tone(c, flam[k]!, 'square', t + at + k * 0.004, 4200, 3000, 0.005, 0.07, 0.0005)
    at += 0.070 - 0.048 * (at / dur)                                 // 70 ms tightening to 22 ms
  }
  let n = biters
  return {
    stop: gate(g, c, t + dur),
    pan: () => {},
    lose: () => { if (n > 0) { n--; flam[n]!.gain.setValueAtTime(0, c.currentTime) } },
  }
}

/** The 550 tick: n jaws, flammed 7 ms. On air: a dry hiss and the landing patter. */
export function snap(biters: number, hit: boolean, pan: number) {
  // for k < biters at +k × 7 ms: square 3000 → 1100 .02 ×.18 + hiss bandpass 3500 Q3 .015 ×.2; +tin @1.6 ×0.3
  // if !hit: hiss highpass 5000 .06 ×.12; +softMedium @1.8 ×0.2 at +150 ms (the landing)
  // if hit: nothing more; hurt() plays from onPlayerHurt and bypasses the duck
}

let lastPop = -1, clusterUntil = -1
const popTimes: number[] = []
/** Mite death. ≥ 35 ms apart; a third inside 120 ms turns into one cluster. */
export function pop(pan: number, queen = false) {
  const c = live(); if (!c) return
  const t = c.currentTime
  while (popTimes.length && t - popTimes[0]! > 0.12) popTimes.shift()
  popTimes.push(t)
  if (t < clusterUntil) return
  if (popTimes.length >= 3) { popCluster(popTimes.length, pan); clusterUntil = t + 0.12; return }
  if (t - lastPop < 0.035) return
  lastPop = t
  const d = out(c, 'hits', pan), o = queen ? 0.5 : 1                 // the queen: an octave down + a plate
  tone(c, d, 'triangle', t, vary(1500, 0.1) * o, 700 * o, 0.06, 0.2)
  tone(c, d, 'sine', t, 260 * o, 110 * o, 0.07, 0.35)
  sample(c, 'tin', d, 0.3, vary(1.8, 0.1) * o)
  if (queen) sample(c, 'plateHeavy', d, 0.3, 1.4)
}
function popCluster(n: number, pan: number) {
  // sine 180 → 60 .15 ×.5; min(n, 5) × +tin at rand(0, .1) s, rate rand(1.6, 2.4), ×.18; +metalMedium @1.5 ×0.5
}

/** The last mite of a brood: clicks slowing and falling, an exhale, one small clear tone. Not cleared(). */
export function broodEnd(pan: number) {
  // clicks i = 0..5 at cumulative gaps 22 + 13.6 i ms: square (3400 − 400 i) → ×0.7, .008, gain 0.12 − 0.016 i
  // hiss bandpass 3000 → 900 .5 ×.08 at +50 ms
  // sine 660 → 655 .25 ×.05 at +0.35 s
}
```

**Voice limiting and the mix** (main):

| rule | implementation |
|---|---|
| skitter: one stream per brood | `skitter(dt)` each frame: for each awake brood, `rate = min(24, 6 × min(movingCount, 4) × (queen quick ? 1.45 : 1))`; if `Σ rate > 36`, every rate × `36 / Σ`; `acc += rate × dt`; each whole tick: pan at a random moving mite of that brood, `loud = (1 − dNearest / 16) × duck × hush`, `sfx.skitterTick(pan, loud)` |
| skitter duck | `duck = windups.size > 0 ? 0.5 : 1` (never covers a tell) |
| the hush before the rush (step 4) | `hush = any ram locked-not-rushing ? 0.5 : 1`, applied to skitter and every enemy footstep |
| windup voices ≤ 3 (step 4) | a new windup voice gets `gain = windups.size >= 3 ? 0.355 : 1` (−9 dB); `windup`, `aim` gain a `gain` param like `rev`/`chitter` |
| footsteps (step 4) | ≤ 3 enemy steps per 120 ms, nearest first (sort `combat.awake` by distance before the loop; count steps in a sliding 120 ms window) |
| pops | the `pop()` limiter above |
| trample clank | `limited('trample', 0.08)` |
| mite hit sounds | `hit()`'s 22 ms guard (existing) |

### 7.3 Main wiring (`main.ts`)

```ts
const windups = new Map<object, Voice>()     // tells: rev, chitter, windup, aim (keyed by Enemy or Brood)
const loops = new Map<Enemy, Voice>()        // rush, dazed
// stopAllWindups(): stop and clear both. onGone(e): windups.get(e)?.stop(); loops.get(e)?.stop(true); delete both.
// P's interrupt handler: windups.get(ev.enemy)?.stop(true)

onWindup(e, ms):  if (run.phase !== 'crawl') return
  charger → windups.set(e, sfx.rev(ms, CHARGER.lockAt, panOf(e.pos), windupGain()))
  (swarm never arrives here; the rest as today, wrapped with asVoice)
onStrike(e):      windups.delete(e)
  charger → if (run.phase === 'crawl') loops.set(e, sfx.rush(panOf(e.pos))); strikeFx(e)
onEnemy(ev):
  lock (ram)  → §7.1 lock FX
  paw         → dust
  skid        → sfx.skid(panOf(ev.e.pos))
  rushEnd     → loops.get(e)?.stop(ev.how === 'trip'); loops.delete(e)
                wall:   sfx.ramCrash(pan); (crate: onSmash plays smash() itself) ; loops.set(e, sfx.dazed(CHARGER.stunMs, pan)); FX
                caught: sfx.ramCrash(pan, false); loops.set(e, sfx.dazed(…)); FX            (Anvil's own bell plays first)
                trip:   tellBreak(e)
  stunEnd     → loops.delete(e) (dazed plays its own slam); FX
  trample     → sfx.trample(pan); FX
  nearMiss    → loops.get(ev.e)?.dip?.(); FX
  surge       → if (run.phase === 'crawl') windups.set(ev.brood, sfx.chitter(ev.ms, ev.biters, panOf(ev.at), windupGain())); FX
  biterLost   → windups.get(ev.brood)?.lose?.(); FX
  bite        → sfx.snap(ev.biters, ev.hit, panOf(ev.at)); windups.delete(ev.brood)
  landed      → FX
  broodEnd    → sfx.broodEnd(panOf(ev.at)); FX
  broodGone   → windups.get(ev.brood)?.stop(true); windups.delete(ev.brood)
  sealBreak   → per member (rank r): sfx.sealTick(panOf(m.pos), 0.03 × r)
onHit(at, e):
  e is a stunned Charger → stunned FX; sfx.hit(pan); sfx.hitOpen(pan) (× 1.3 gain if plated)
  e is a Plated Charger (not stunned) → sfx.hit(pan, 0.7); sfx.plateDull(pan)
  else today's
onKill(at, kind, pack, wasElite, summoned, weight):
  charger → today's kill FX replaced by §7.1; sfx.kill(pan); sfx.ramDeath(pan)
  swarm   → §7.1 mite FX; sfx.pop(pan, wasElite)       (never kill())
  maybeDrop(at, kind, pack, wasElite, summoned, weight)
frame(): after footsteps(): ramFx(elapsed); broodFx(elapsed); skitter(elapsed);
         for (const [e, v] of loops) v.pan(panOf(e.pos)); combat.miteBatch.sync(world.camera, now)
```

`footsteps()`: `who = kind === 'charger' ? 'ram' : …`; mites never step
(`walking` false). `strikeFx` gains the charger branch; the swarm has none.

---

## 8. Dungeon integration, camera, labels

### 8.1 Budget in body-equivalents

```ts
const BE: Record<Exclude<Archetype, 'boss'>, number> = { chaser: 1, ranged: 1, charger: 1.5, swarm: 0.25 }
// budget B per room: today's size formula, unchanged
const B = 2 + Math.floor(rand() * 2) + Math.floor((depth - 1) / 2) + (big && depth > 2 ? 1 : 0)
```

### 8.2 Templates and the pick

```ts
type T = 'C' | 'H' | 'S' | 'M8' | 'M6'
interface Template { members: T[]; weight: number }
const TODAY = null                                  // today's H/S generator (size B, the ranged-count rule)
const D4: (Template | { today: true; weight: number })[] = [{ members: ['C', 'H', 'H'], weight: 2 }, { members: ['C', 'H', 'S'], weight: 1 }]
const D5: … = [
  { members: ['M8', 'S'], weight: 1 },              // "the screen"
  { members: ['C', 'C', 'H'], weight: 1 },          // "bulls"
  { members: ['C', 'H', 'H', 'S'], weight: 1 },
  { members: ['M6', 'H', 'H'], weight: 1 },
  { today: true, weight: 2 },
]
const D7: … = [
  { members: ['C', 'M6', 'H', 'S'], weight: 1 },
  { members: ['C', 'C', 'M6'], weight: 1 },
  { members: ['M8', 'S', 'S'], weight: 1 },
  { members: ['C', 'H', 'H', 'H', 'S'], weight: 1 },
  { today: true, weight: 2 },
]
const CAPS = (d: number) => d <= 4
  ? { chargerPacks: 2, swarmPacks: 1, chargersPerPack: 1, kinds: 2 }
  : d <= 6 ? { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 3 }
  : { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 4 }
```

The first listed member leads (becomes the elite if the pack is chosen).

**Per level** (replaces the member loop in `generateLevel`; boss levels have no
packs, R6):

1. **Depth 1:** today's generator for every room (unchanged).
2. **Depth 2:** choose the lesson room: a `main` room with `rx === 2 && rz === 2`
   (else any `main` with `rx ≥ 2 || rz ≥ 2`). It gets `['C', 'H']`,
   `lesson: true`, and its ram's gaze faces the room centre. Every other room:
   today.
3. **Depth 4:** the lesson swarm: another `main` big room gets `['M8']`,
   `lesson: true`. Then `nC = 1 + (rand() < 0.5 ? 1 : 0)` further `main` rooms
   (never side) get a D4 template (weighted pick), filled. Every other room:
   today (R25).
4. **Depth ≥ 5:** for each room in layout order, candidates = the depth's list,
   minus templates with a `C` if the room is `side`, minus templates that would
   break the level caps (charger packs so far, swarm packs so far). For a
   candidate with `M8`: if `BE > B + 1`, use the `M6` variant. Keep candidates
   with `BE ≤ B + 1` (`today` always fits). Weighted pick. Then **fill**: add
   `H` while `BE < B − 0.5`, unless adding an `H` would break the kinds cap. If
   nothing fits: today.

`BE(members) = Σ BE[kind]` with `M8 = 8 × 0.25 = 2.0`, `M6 = 1.5`.

**Placement** (per pack, around today's off-centre spot `(cx, cz)`):

```ts
// 1. mites first, as a nest: r ∈ [0, BROOD.nestR], ≥ nestGap from each other, !blocked(x, z, 0.4)
// 2. everything else: r ∈ [1.8, 3.0], ≥ 1.3 from non-mites and ≥ 1.0 from mites, !blocked(x, z, kind === 'charger' ? 0.8 : 0.7)
// 12 tries a member, as today; a member that can't be placed is dropped
```

`PackSpec` gains `lesson?: boolean`, `budget?: number` (for the checks), and
member kinds `'charger' | 'swarm'`. `main.enterLevel` passes packs as today.

### 8.3 Elites

```ts
const mainPacks = packs.filter((p) => p.room.kind === 'main' && p.members.length >= 2 && !p.lesson)
const eliteCount = Math.min(mainPacks.length, 1 + Math.floor((depth - 1) / 2))       // unchanged
const POOL: Partial<Record<Archetype, string[]>> = { charger: ['horn', 'brow', 'skull', 'hoof'], swarm: ['mother', 'nest', 'hive', 'brood'] }
// for each chosen pack p:
const kind = p.members[0]!.kind
const mod = pick(ELITE_MODS[kind])
const second = POOL[kind] && rand() < 0.5 ? pick(POOL[kind]!) : pick(SECOND)
p.elite = { mod, name: `${pick(FIRST)}${second} ${TITLES[mod]}` }            // e.g. "Cinderhorn the Plated", "Ashmother the Warden"
```

| leader | allowed | notes |
|---|---|---|
| hulk | Quick, Plated, Many, Warden | unchanged |
| sentinel | Quick, Plated, Warden | unchanged |
| ram | Quick, Plated, Many, Warden | Plated line: "takes half damage, until it hits a wall" |
| brood-mother | Quick, Warden | lines: "her whole brood moves fast", "her brood takes little damage while she stands" |

Lesson packs are never elite. Side rooms never get elites (unchanged).

### 8.4 Camera and labels

- `frame()`: `rig.update(elapsed, camTarget, [...awake.map((e) => e.pos), ...combat.laneEnds()], !fighting)`.
  A locked or rushing ram's lane end (and the Assembler's) is a threat point, so
  an 11 u lane never ends off screen. `ZOOM.min 0.7` is unchanged.
- `drawEliteLabels()`: `labelTmp.set(x, el.leader.labelY * el.leader.size, z)`
  and `eliteLine(el.leader.kind, el.mod)` instead of `ELITE_LINE[el.mod]`.

---

## 9. Build order (MVP staging)

Each step ends playable: `npm run build` clean, the dev server runs, a run
plays from depth 1 to the boss, and that step's checks (§10) pass.

**Step 1: the engine rules and the ram (v0.1).**
`EnemyCtx` and the 4-arg `update` for every class; `turn()`; `radius = base ×
size` everywhere; `LockBook` (ram + sentinel, and the sentinel's `lock` event);
pack token; `EnemyEvent` / `onEnemy` / `emitEnemy`; `melee.source` / `tested`;
the top-up; `onHit(at, e)`; per-pair spacing; `split()` by archetype with
`splitBorn`; loot `KILL_WEIGHT`, `Pack.weight`, `dropChance(…, weight)`,
`TREASURE.charger`; the `Charger` class (behaviour §3, rig §5.1 without elite
features, `LaneTell` §6.1, trample, crate smash, trip, `stopRush`, interrupt);
`rev`, `rush`, `ramCrash`, `dazed`, `step('ram')`; the ram FX rows for lock,
rush start, wall, death; depth-2 lesson pack; `laneEnds()` into the camera;
dev hooks `__pack`, `__until`, `__enemyLog`, `__gen`.
*Playable:* depth 2 has a ram; everything else is today's game.

**Step 2: the ram, finished, and the Assembler's lane (v0.2).**
The Assembler's `LaneTell` and its swept once-per-charge hit (§6.2) and its
lane end in the camera; ram elites (Quick exhaust, Plated plates and lift,
Many seam and split, Warden mast) with names, lines and label heights; skid
ease; near miss; `hitOpen`, `plateDull`, `skid`, `trample`, `ramDeath`; the
whole ram FX table (§7.1) including `ramFx`; depth 4–8 **charger** templates
(D4, and D5/D7 rows without an `M`; the `M` rows fall back to today until step
3).
*Playable:* rams everywhere they belong; the boss's charge is honest.

**Step 3: the swarm (v0.3).**
`Mite`, `Brood`, `MiteBatch`, `BiteRing`; `tickBroods` with the global cap and
the queen seat; surge booking; decoy targeting; per-mite interrupt; Clamp Toss /
Anvil / Parry interplay; `TREASURE.swarm`; `skitterTick` + the scheduler,
`chitter`, `snap`, `pop` (+ cluster), `broodEnd`; the swarm FX table and
`broodFx`; depth-4 lesson swarm and the `M` templates at depth 5+; nest
placement; side-room swarms at 5+.
*Playable:* the full enemy roster through depth 8+.

**Step 4: elites, crowd rules, polish (v1.0).**
Brood-mother (extras, Quick legs, Warden sealed brood), sealed looks on warded
rams and mites and the seal ripple; `TELL_CROWD`, tracking dim, soonest-on-top
render order; the hush before the rush; ≤ 3 windup voices; ≤ 3 footsteps per
120 ms; the first-stun extra hitstop; the ram husk (optional: drop it if the
Poco drops frames); the perf check P1 on the device.
*Playable:* the depth-7 fight at T §9's census.

---

## 10. Headless acceptance checks

### 10.0 Hooks (P §7.0, plus four, DEV only)

```ts
__enemyLog: [] as { t: number; ev: EnemyEvent }[],     // every onEnemy, t = combat.time; cleared by __arena
/** A pack from members, like addPack. awake = true wakes it at once. */
__pack: (members: { kind: Archetype; x: number; z: number }[], awake = true, elite?: EliteMod) => Pack,
/** Step 1/60 s until pred() is true. Returns the seconds stepped, or −1 after maxS. */
__until: (pred: () => boolean, maxS = 5) => number,
/** Generate a level's packs without entering it: [{ room, rx, rz, kinds, elite, lesson, budget }]. Disposes the level. */
__gen: (depth: number, seed: number) => PackSummary[],
```

`nest(cx, cz)` in the checks below means 8 points `(cx + 0.9 cos(πk/4), cz + 0.9 sin(πk/4))`.
**A** = `__arena()`; Still at (0, 0), stationary, auto off. `ch(x, z)` =
`__spawn('charger', x, z)`. `hp` is the enemy's unless it says Still. Where a
check would let Still die over a long run, it sets `__combat.hp = 1e4` first.
Positions ±0.15 u; times ±1/60 s; damage exact.

### 10.1 Engine rules

| id | setup | action | assert |
|---|---|---|---|
| E1 top-up up | A; `fireShot(V3(0,0,2), V3(0,0,−1), 3)` | `__step(0.1)`; `fireShot(…, 14)`; `__step(0.1)` | Still 97 then 86 |
| E2 top-up down | A; shot 14, `__step(0.1)`, shot 3, `__step(0.1)` | – | Still 86 |
| E3 new window | A; shot 3, `__step(0.1)`, `__step(0.4)`, shot 3, `__step(0.1)` | – | Still 94 |
| E4 radius | `h = __spawn('chaser', 0, 8, false, 'plated')` | – | `h.radius ≈ 0.704` (1e-9) |
| E5 split hulk | `h = __spawn('chaser', 0, 8, true, 'splitting')`; `h.hit(999)` | `__step(1/60)` | 2 enemies, kind chaser, size 0.72, hp 12 |
| E6 drop weights | – | `dropChance({ weight: 3, side: false, members: [1], dropped: false }, false, false, 1)`; `…({ weight: 2, … }, false, false, 0.25)`; `…(any, false, false, 0)`; `…(any, false, true, 1)` | 0.22; 0.0825; 0; 0 (P S12 in the new signature) |
| E7 spacing | A; `r1 = __spawn('ranged', 0, 6)`, `r2 = __spawn('ranged', 0.4, 6)`, both `speedMul 0` | `__step(0.2)` | `dist(r1, r2) ≈ 1.0` |
| E8 sentinel books | A; `s = __spawn('ranged', 7, 0)` (wakes with reload 1200, so it would wind up at 1.2 s and lock at 1.656 s); at once `__combat.book.book({}, 1656)` | `__step(1.25)`; `__step(0.3)` | approach (control without the booking: windup); then windup (it waited until its lock was ≥ 0.3 s from the booked one) |

### 10.2 The ram

| id | setup | action | assert |
|---|---|---|---|
| C1 wake reload | A; `c = ch(0, 6)` | `__until(() => c.phase === 'windup')` | 0.70–0.74 s; `__enemyLog` has no lock yet |
| C2 track then lock | C1, then `__still.pos.set(1.5, 0, 0)`; `__step(0.2)` | `__until(() => c.locked)`; then `__still.pos.set(−1.5, 0, 0)`; `__step(0.1)` | first: `c.aim ≈ atan2(1.5, −6)`; lock at 0.495 s after windup start (±1 tick); after: aim unchanged (1e-6); log has `lock` with `end` |
| C3 rush hits once | A; `c = ch(0, 6)`; `__until(() => c.phase === 'strike')` | `__step(0.26)`; `__step(0.04)`; `__step(0.5)` | Still 100; 86; 86 (one hit); `c.pos.z ≈ −3.5`; phase recover; log `rushEnd open` |
| C4 honest edge | as C3 but at `__until(() => c.locked)` set Still (1.08, 0, 0) / (1.16, 0, 0) | `__step(1.2)` | 86 / 100 |
| C5 skid timing | C3 | from strike start, `__until(() => c.phase === 'recover')` | 0.583 s = 35 ticks (±1); log `skid` 0.133 s before `rushEnd` |
| C6 wall stun | A boxes `[{ minX: −3, maxX: 3, minZ: −2.4, maxZ: −1.8 }]`; `c = ch(0, 6)` | `__until(() => c.locked)`; read `c.lane.end`; `__still.pos.set(2.5, 0, 0)`; `__step(1.0)` (contact is 0.805 s after the lock); `c.hit(10)` | `lane.end === 'wall'`; Still 100; `c.stunned`; `c.pos.z ∈ [−1.25, −1.0]`; c.hp 21; log `rushEnd wall` |
| C6b stun clock | continue | `__until(() => !c.stunned)`; `__until(() => c.phase === 'approach')` | log `stunEnd` 1.2 s (±1 tick) after `rushEnd wall`; approach 0.4 s after `stunEnd` |
| C7 crate | `cir = { x: 0, z: −1.5, r: 0.45 }`; `__arena({ circles: [cir] })`; `b = __crate(0, −1.5)`; `b.circle = cir`; `c = ch(0, 6)` | `__until(() => c.locked)`; read `lane.end`; Still to (2.5, 0); `__step(1.0)` | `'prop'`; `b.broken`; `c.stunned` |
| C8 open end, no stun | A; `c = ch(0, 6)`; Still to (2.5, 0) at lock | `c.hit(10)` during recover | hp 26 (×1) |
| C9 hug punish | A boxes z 3.1..3.7 (x ±3); `c = ch(0, 2.4)` | `__until(() => c.phase === 'windup')` | 0.98–1.05 s; `dist(c, Still) < 3.5` |
| C9b control | A; `c = ch(0, 2.4)` | same | ≤ 0.75 s; `dist ≥ 3.5` |
| C10 band start | A; `c = ch(0, 10)` (beyond 9), `c.speedMul = 0` | `__step(3)` | never windup |
| C11 trample | A; `c = ch(0, 6)`; `h = __spawn('chaser', 0.5, 3)`, `h.speedMul = 0` | strike, `__step(0.7)` | `h.hp === 30`; `h.pos.x ≈ 1.9`; Still 86; log `trample` once |
| C12 knock 0 in rush | A; equip pressure-vent; `c = ch(0, 6)`; Still to (3, 0) at lock | `__until(strike)`; `__step(0.2)` (z ≈ 2.4, inside the 4.4 blast reach); `__fire('torso')`; `__step(0.5)` | c.hp 21; `abs(c.pos.x) < 0.05` on every tick of the rush |
| C13 lane moves with body | A boxes z −2.4..−1.8 (x ±3); `c = ch(0, 4)` (nominal 7.5 → cut at the wall) | `__until(() => c.locked)`: `lane.end === 'wall'`; `c.knock.set(0, 0, 27)` (a 3 u shove); `__step(0.3)` | still locked, not rushing; `lane.x/z ≈ c.pos`; `c.pos.z > 6.3`; `lane.end === 'open'` (the frozen 7.5 now ends short of the wall) |
| C14 Parry | C9 setup; equip parry-clamp | `__until(windup)`; `__step(0.1)`; `__fire('arms')` | phase approach; c.hp 26; partLog `interrupt`; next windup ≥ 0.7 s later |
| C15 Frost trip | A; `__combat.zones.push({ ax: −4, az: 2, bx: 4, bz: 2, halfW: 0.7, t: 3, max: 3, mul: 0.5 })`; `c = ch(0, 7)` | strike; `__step(0.5)`; `c.hit(10)` | Still 100; `c.tripped`; not stunned; hp 26; log `rushEnd trip`; recover lasts 1.2 s |
| C16 Anvil | A; equip anvil; `c = ch(0, 6)` | `__until(() => c.locked)`; `__fire('arms')`; `__step(0.8)` | Still 100; c.hp 6; `c.stunned`; partLog `catch`; log `rushEnd caught`; then `c.hit(4)` kills |
| C17 lock spacing | A; `__combat.hp = 1e4`; `ch(0, 6)`; `__spawn('ranged', 7, 0)` | `__step(15)` | all `lock` times sorted: every gap ≥ 0.3 − 1/60; ≥ 3 locks from each |
| C18 pack token | A; `__pack([{ kind: 'charger', x: −2, z: 6 }, { kind: 'charger', x: 2, z: 6 }])`; hp 1e4 | 720 × `__step(1/60)` | never both in windup/strike on one tick; both rushed ≥ 2 times |
| C19 Plated | `c = __spawn('charger', 0, 8, true, 'plated')` | `c.hit(10)`; `c.enterStun()`; `c.hit(10)` | 67; 52 |
| C20 Many | `c = __spawn('charger', 0, 8, true, 'splitting')`; `c.hit(999)` | `__step(1/60)` | 2 chargers, size 0.72, hp 12, radius 0.432, `hitHalf ≈ 0.952` |
| C21 vault behind cover | A boxes z 1.0..1.6 (x ±3); Still at (0, 2.5); equip spring-heels; stick (0, −1); `c = ch(0, 8)` | `__until(windup)`; `__fire('legs')`; `__step(1.5)` | Still.z < 1.0; Still 100; log `rushEnd wall` |
| C22 decoy | A; equip lure; `c = ch(0, 7)`; stick (1, 0) | fire torso (decoy ≈ (−1.5, 0)); `__still.pos.set(5, 0, 0)`; `__until(() => c.locked)` | `c.aim ≈ atan2(−1.5, −7)`; Still 100 after the rush |
| C23 boss lane edge | A; `b = __spawn('boss', 0, 10)`; `b.speedMul = 0`; force `b.begin('charge', V3(), π)` | `__until(() => b.locked)`; Still to (1.5, 0) / (1.65, 0); `__step(1.0)` | 78 / 100; exactly one hurt |

### 10.3 The swarm

| id | setup | action | assert |
|---|---|---|---|
| M1 rings | A; hp 1e4; `__pack(nest(0, 9).map(p => ({ kind: 'swarm', ...p })))`; `b = __combat.broods[0]` | `__step(3)` | 4 non-outer; orbiting inner at 1.8 ± 0.5 from Still; outer at 5.5 ± 0.8 |
| M2 standing bite | M1 | `__until(() => b.state === 'windup')`; `n = b.biters.length`; `__step(0.56)` | `L ≈ Still` (±0.05); `n ∈ {3, 4}`; Still dropped exactly `3n`, once; log `bite` hit true |
| M3 step out | M1; at windup start `__still.pos.set(b.L.x + 1.1, 0, b.L.z)` | `__step(0.6)` | Still unchanged; log `bite` hit false |
| M4 lead | A; `__still.speed = 2`; Still at (−8, 0); pack at `nest(−8, 7)`; `__step(2.5)`; stick (1, 0) | `__until(() => b.state === 'gather')`; `__until(() => b.state === 'windup')` | `b.L − Still ≈ (0.9, 0)` (±0.1): 2 u/s × 0.45 s |
| M5 biter killed | M2 at windup start: `b.biters[0].hit(99)` | `__step(0.56)` | drop `3(n − 1)`; log `biterLost dead` |
| M6 biter interrupted | M2 at windup start: `b.biters[0].interrupt()` | `__step(0.56)` | returns true; drop `3(n − 1)`; log `biterLost parry` |
| M7 global cap | A; hp 1e4; packs at `nest(−6, 9)` and `nest(6, 9)` | 720 × `__step(1/60)` | Σ non-outer ≤ 4 every tick; every `bite` biters ≤ 4 |
| M8 cycle | M1; hp 1e4 | `__step(12)` | consecutive `surge` of one brood ≥ 2.0 − 1/60 s apart |
| M9 outer ring safe | M1; equip pressure-vent; `__until(() => b.state === 'gather' && 4 mites are inner, in approach, within 2.2 of Still)` | `__fire('torso')`; `__step(0.05)` | 4 dead; 4 alive, all role outer, all ≥ 4.1 from Still |
| M10 refill, bearing | continue | 90 × `__step(1/60)` | every tick, every outer mite ≥ 4.1 from Still; within 1.5 s ≥ 1 inner again |
| M11 decoy | M1; equip lure; stick (1, 0) | fire torso; `__until(() => b.state === 'windup')` | `b.L ≈ decoy.pos` (±0.05); `b.decoyed` |
| M12 brood end | M1 | every mite `.hit(99)`; `__step(1/60)` | log `broodEnd` once; `broods.length === 0` |
| M13 leash | M1; `b.pack.leash = 5` (the arena is too small for 16) | `__still.pos.set(0, 0, −13)`; `__step(0.3)` | pack `returning`; `b.state === 'gather'`; `b.L === null`; all outer; ring hidden |
| M14 queen | A; `__pack(nest(0, 9)…, true, 'warding')` | `__step(10)` | queen radius 0.384, hp 16 at birth; queen never outer after she seats; others armor 0.35; then kill her → next tick armor 1; log `sealBreak` |
| M15 Anvil | M1; equip anvil | at windup start `__fire('arms')`; `__step(0.6)` | Still unchanged; every biter dead |
| M16 drop | M1 | `dropChance(pack, false, false, 0.25)` | 0.0825 |
| M17 lock spacing, all three | A; hp 1e4; `ch(0, 7)`; `__spawn('ranged', 7, 0)`; pack at `nest(−6, 6)` | `__step(15)` | every gap between `lock` and `surge` times ≥ 0.3 − 1/60 |
| M18 level change | M2 at windup start | `__enter(4)` | log `broodGone`; `broods` holds only the new level's |

### 10.4 Dungeon, loot, performance

| id | setup | action | assert |
|---|---|---|---|
| D1 depth 1 | 200 seeds `__gen(1, s)` | – | no charger, no swarm |
| D2 depth 2 lesson | 200 seeds `__gen(2, s)` | – | exactly one pack with a charger; it is `[charger, chaser]`, `lesson`, main, no elite; no charger elsewhere |
| D3 boss levels | `__gen(3, s)`, `__gen(6, s)` | – | no packs |
| D4 depth 4 | 200 seeds | – | exactly one `lesson` pack of 8 swarm and nothing else; 1–2 other packs with a charger, each with 1 charger; no charger in side rooms |
| D5 caps | 200 seeds each at 5, 7, 8 | – | charger packs ≤ 3; swarm packs ≤ 2; chargers per pack ≤ 2; kinds per pack ≤ 3 (d5) / ≤ 4 (d7, 8); no charger in a side room; templated packs' BE ∈ [budget − 0.5, budget + 1] |
| D6 elites | 500 seeds at 5 and 7 | – | a swarm-led elite's mod ∈ {swift, warding}; lessons never elite; names use the pools about half the time |
| L1 treasure | 10k × `rollPart('charger', [], 'kill')` / `('swarm', …)` | – | legs share 0.50 ± 0.03 / head share 0.50 ± 0.03 (all slots in the pool) |
| P1 mite draw calls | `r = __world.renderer; r.info.autoReset = false`. A, nothing spawned: `r.info.reset(); __world.render(); calls0 = r.info.render.calls` (bloom passes included). Then two packs of 8 mites awake, `__step(2)`, sync, same measure → `calls1` | – | `calls1 − calls0 ≤ 8` (+ 4 per queen) |
| P2 ram draw calls | same method, one ram in windup | – | `≤ 30` more than the empty arena (body + lane) |

---

## 11. Out of scope

| item | why |
|---|---|
| Sealed-core looks on hulk Wardens (T §7) | a change to an existing enemy's look; the ram and mite versions prove it first |
| Trample damage (B Q4) | 0 by design; a playtest question |
| Retuning surge windup / lead / ring, locked phase, stun length, outer radius, queen HP, book spacing (B §10) | tune on the Poco; the constants are single numbers in `CHARGER` / `BROOD` / `BOOK_GAP` |
| An always-on hiss for an off-screen swarm (T Q5) | only if one skitter stream per brood proves too quiet |
| Mite halo size cuts (T Q2) | playtest |
| The skid-ease fallback (T Q6) | the ease ships; the fallback is a one-line change if nobody sees it |
| A charger or swarm boss, or boss adds of the new kinds | the Assembler's summon stays hulks |
| New elite mods for the new archetypes | the four existing mods cover them |
| A sim for the ram, or a sim CLI for mixed packs | B worked the ram by hand; the swarm sim exists |
| Yanah and Yuri | the owner's |

---

## Summary

Two archetypes built on the part-pool contracts. The ram (`src/charger.ts`)
runs a four-phase machine with tracking and locked windup stages, a rush that
tests the real Still against an honest capsule once, a wall/crate stun with a
×1.5 window (Plated's plate lifting), a Frost trip, an Anvil catch, trample, and
a lane tell (`src/lane.ts`) drawn to the true hit edge that the Assembler now
shares. The swarm (`src/swarm.ts`) is a Combat-owned brood per pack that assigns
inner and outer rings by bearing under a global 4-biter cap, books its surge in
the shared 300 ms lock book, draws one piecewise ring, and bites once for 3 per
remaining biter; every mite in the level is drawn in 8 instanced draw calls.
Engine fixes (top-up, radius × size, split by archetype, per-pair spacing, loot
weights) are specified with their exact effect on today's enemies. The dungeon
introduces the ram at depth 2 and the swarm at depth 4 with lessons, BE budgets
and templates. There are 29 resolved contradictions, a 4-step build order that
stays playable at every step, and about 60 headless checks.
