# The look: verifier

2 Oct 2026. Read: BRIEF, 1-claude, partfx, vfx, markfx, parts, temper, weight's WEIGHT_FEEL, combat's `useAbility` / `onContact`, main's
`cast` / `castFx` / `onContact`, enemy.ts's flash, partmodels' EYE, the check harness (lib, screens, builds K-M30, fights K-90F, lean K-L11).
Written beside the translator and balancer, not after: where their grammar or numbers land, this file names the slot they fill.

## 0. Four facts from the code that shape the build

1. **The cast's look is not in partfx.** It is `castFx(def, r, pushed)` in main.ts (~l. 4378-4520), a switch on `r.beat`. partfx draws what
   lasts (shell, decoy, anchor, landings, badges, rims). **Rank already reaches castFx**: `def` is the worn def (`asWorn` -> `tempered`, which
   sets `rank` at II/III; absent is I), and `weighed(def)` spreads it, so it survives weight. `onContact`'s `ev.def` is the same worn def.
   Nothing reads it. Only partfx's persistent visuals lack rank: PartEvents carry no def, and `parts.guard` has none.
2. **The look draws from combat's dice.** vfx's `rnd`, partfx, still.ts and parts of audio call `Math.random`: the stream combat draws from
   (5 calls in combat.ts, 2 in enemy.ts) and the one K-90F seeds with mulberry32. A spark count is in the fight's random sequence, so a III
   throwing 20 more sparks shifts every later combat roll. **"Visuals only" is not true by construction today**: a pure look change can fail
   K-90F in any fight that casts or hand-strikes. (A prediction from the code; step L0 measures it.)
3. **Damage lands on the press.** `useAbility` resolves the hit in the press's tick; the pose plays after (weight starts it cocked at 0.3 of
   its dur, and the contact freeze holds that frame for 30-100 ms, sized from `baseCooldownS`, the rank-I cooldown, on purpose). So a
   wind-up *before* release is input latency, and is out. Rank's "anticipation" can live only in **the frozen frame**, in **Still at rest**
   (the slot's idle look), or in a **flight that already takes time** (lob, throw). Freeze ms never reads rank.
4. **Weight chose to emit nothing at struck bodies** (main `onContact`: "a crowd's brightness is what it was", W4; `dimFlash` 1/sqrt n).
   A rank-II "contact beat on the body" reverses that review. It can come back only normal-blended, at the feet or as a darkening, with the
   same 1/sqrt n crowd rule. K-L11 asserts press spawn counts equal weight on and off; it runs at rank I and stays valid.

## 1. The data shape

### 1.1 Rank (and the core) into the look, combat untouched

- **castFx and onContact**: read `def.rank` through one helper, `rankOf(def: AbilityDef | null): Rank` (`def?.rank ?? 1`, clamped 1..3).
- **partfx**: a read-only view in its constructor, beside `CombatView`, built by main from `hud.slots` (the worn defs):

```ts
/** What the look may read of the loadout. Nothing here writes. INV: never read by combat, temper, weight or cores. */
export interface WornView {
  rank(slot: SlotName): Rank          // 1 with nothing worn
  shape(slot: SlotName): AbilityShape | null
  core(): CoreId | null               // combat.core: a tint for the layers, never a tier and never a layer of its own
}
```

  Everything partfx draws belongs to one slot (guard, decoy: torso; anvil, throw: arms; lob, landing, path: head; anchor, move: legs;
  `Zone.by` already names it), so partfx resolves rank by slot. **PartEvent, PartRuntime and combat.ts are not edited.**
- **The core** tints a III's residue (Wake's frost-white, Ram's steel-blue `LOOK.crack` family from markfx). No core: Wake's cold.

### 1.2 The per-shape-family tier table: `src/looktiers.ts`

Data only: no three objects, imports types only. `Record<AbilityShape, Tiers>`, so the compiler demands all 12 shapes; a family shares
one const (arc's for scrap-cleaver, piston, hook, parry, frayed; grab and catch may share the arms' or take their own).

```ts
export type Rank = 1 | 2 | 3
/** One rank's look for a shape family. Every field is visual; no field is a number combat reads. */
export interface TierLook {
  /** What the frozen contact frame carries (fact 3): a light gathered at the slot's pivot, a smear along the swing. */
  freeze: 'none' | 'gather' | 'smear'
  /** A beat after the freeze lets go, at the struck bodies' FEET (fact 4), ms after contact. 'none' at I. */
  contact: { kind: 'none' | 'bite' | 'crack' | 'bloom'; delayMs: number }
  /** What the floor keeps, under the fight. `reach`: a fraction of the shape's own extent (range, radius, cone), INV <= 1. */
  residue: { kind: 'none' | 'scorch' | 'frost' | 'crack'; s: number; reach: number }
  /** Still's body: the slot's light on the cast (0..1), and its look at rest. */
  body: { castLight: number; idle: 'none' | 'seam' | 'orbit' }
  /** A sound layer in audio.ts, drawing no Math.random. */
  sound: 'none' | 'tail' | 'ring'
  /** What this rank may spend in ONE cast, all pools: particles (glow + smoke), debris chunks. K-LK3 holds it. */
  budget: { particles: number; chunks: number }
}
export type Tiers = readonly [TierLook, TierLook, TierLook]
export const LOOK_TIERS: Record<AbilityShape, Tiers> = { /* the translator's grammar fills the kinds; the balancer's budget fills budget */ }
```

**"Not just bigger" as a type rule**: there is no scale, size, brightness or radius field. Area already grows through the def
(`TEMPER.area` on radius / cone), and the look keeps following the def's numbers as castFx does today. A rank buys a *kind*, never a
multiplier. The per-part flavour (Piston's thin strike, Frayed's widths, Patient's power) stays in castFx's beat switch: that is rank I.
A cast is its beat's recipe plus its shape's II / III layers.

### 1.3 Where it lives

| file | what | combat-side files may import it? |
|---|---|---|
| `src/looktiers.ts` | the table | no |
| `src/castfx.ts` | castFx and pushSignature moved out of main.ts verbatim, then the tier layers | no |
| `src/rankfx.ts` | the renderers (1.4) | no |
| `src/partfx.ts` | takes `WornView`; shell, decoy, anchor, landings at III | no (already) |
| `src/vfx.ts` | `fxRand`: its own mulberry32 in place of `Math.random`; no-allocation spawns taking r, g, b | no |

The fence (K-LK1): combat.ts, temper.ts, weight.ts, cores.ts, abilities.ts, parts.ts import none of the four new or changed look files.
Saves: nothing new. Rank is already in the snapshot; the look is derived from it. The Workshop wall shows no rank (rank is run-only).

### 1.4 Renderers, in markfx's pattern

- **Residue**: one `InstancedMesh` per residue kind (scorch, frost, crack): at most **+3 draw calls**, whatever the number of casts. 24
  instances each in a ring (the oldest is overwritten), preallocated Float32Arrays, a per-instance `aAlpha`, **normal blending** with a dark rim
  in vertex colours (markfx's lesson: added cold vanishes on the ruin's lit stone and goes peach on a warm floor), `forceSinglePass`,
  `renderOrder` 2-3 (over the floor and the mark rings, under every tell). Hidden while its count is 0.
- **Contact and gather**: the existing glow / smoke pools: 0 draw calls; their cost is fill, held by `budget`.
- **Smear** (the freeze frame): one preallocated mesh per slot that has one (arms first): +1.
- **Body**: partmodels' `EYE` material is shared by every part's light ("all go out together"). A III light needs its own material per slot
  that copies `EYE.color` every frame, so the lights-out rule (stopped: the eye goes out) still darkens it. It replaces the material on the
  slot's existing light mesh: +0 draw calls.
- **Never `partFx.beam()` for a tier layer**: each call makes a new `tellMaterial` and mesh (+1 draw call and an allocation per beam).

## 2. The build plan

Each step: one Sonnet engineer, the lead reviews the diff, then straight to main (his rule; a look change is not a trial, so no flag).

| step | what | done when |
|---|---|---|
| **L0a** | `fxRand` in vfx, partfx and still.ts's rig; audio's per-cast draws too, or show it has none. A dev switch `__fxOff(true)`: castFx, rankfx and partfx's `event` draw nothing | K-90F re-captured **once**, its diff reviewed as RNG phase only (same fights, different rolls), then **K-LK0 passes**. Today K-LK0 should fail (fact 2): run it first, as the negative test |
| L0b | castFx and pushSignature moved to `src/castfx.ts`, verbatim | K-90F equal; L0's screenshot set pixel-equal before / after |
| L0c | `WornView` into partfx (unused); `looktiers.ts` with every shape's three tiers set to today's look; `tools/checks/look.mjs` K-LK0..LK8 | all pass; the I baseline screenshots saved |
| L0d | his phone, `?perf=1`, a d5 big room, bare and Wake: fps and the adaptive resolution, written down | the numbers are in this folder |
| **L1** | **the arc family end to end, Scrap Cleaver first**: I cleaned up (one clear silhouette), II freeze smear + contact at the feet, III residue + arms idle seam + sound tail; then Frayed, Piston, Hook, Parry take the arc rows (their beats stay theirs). The hit flash (1-claude: rim, not fill) in the same slice, since a II contact over a white blob reads as nothing | K-LK all pass; K-90F equal (no re-capture); K-L11 equal at rank I; the contact sheet to him; **stop for his feel** before L2 |
| L2 | one family a step, by how often it is cast: bolt (6 parts), nova (4), dash + hop (6), lob (2), ward + decoy, grab + catch, anchor, rewind. Persistent things at III through partfx (the shell's facets, the decoy, the bob) | as L1, per family; K-LK3/LK4 numbers re-run with every family in |
| L3 | the overall look: Still's floor contact (a soft shadow, dust on landings), the cast light. Measure two forms on his phone first: one pooled PointLight (every lit material's shader gains a light: a program recompile the first time, a cost on every lit draw after) versus a fake light decal on the floor (one instanced mesh, normal-blended) | his phone holds its L0d numbers |

## 3. The checks: `tools/checks/look.mjs`, K-LK*

- **K-LK0 fx-blind.** K-90F's 14 fights x 5 seeds with `__fxOff(true)` deep-equal `fights.json`. Plus: `Math.random` wrapped with a counter,
  one cast of every part at every rank through `__equipRank` and `__fire` (castFx, onContact, sfx), with combat's own draws subtracted
  (counted with fx off): the look's draws are 0. This is "visuals only" proven once, for every later look change.
- **K-LK1 fence** (a `task`, no page): the import lists of the combat-side files contain no look file; `looktiers.ts` imports types only and
  has no key named scale, size, bright or radius.
- **K-LK2 the table**: all 12 shapes, three tiers each; rank I's contact and residue are 'none'; every `residue.reach <= 1`.
- **K-LK3 particles per tier** (K-L11's `__spawns`): every part at I, II, III, one cast into 1 body and into 5: spawned <= its tier's
  budget. Until the balancer's numbers land: I <= today's count for the beat (Cleaver 14, Vent ~42), II <= I + 10, III <= I + 20, any cast
  <= 60. **Pool headroom**: a d8 pack of 12, all four slots at III cast on cooldown for 20 s: the glow pool's live count (a new dev `live()`)
  stays <= 0.75 x 1800, so the ring buffer never recycles a live particle (an enemy's embers share that pool).
- **K-LK4 draw calls** (K-M30's pattern): calls with every slot at I, idle, then every slot at III cast each cooldown for 10 s across 40
  bodies: max calls <= that + 4 (3 residue + 1 smear); the scene's child count equal before and after; rankfx's meshes, geometries and
  materials the very ones built at start (uuids); `renderer.info.memory` and `info.programs.length` unchanged after 100 casts; rankfx's
  per-frame update with 72 residues live: median <= 0.1 ms over 1000 calls.
- **K-LK5 no allocation per cast**: the identity and count asserts above, plus a source task over the code between `// per-cast` markers in
  castfx.ts and rankfx.ts: no `new `, `.clone(`, object or array literals. (A JS heap cannot be measured reliably headless; this is the proxy
  K-M30 used.) Today's helpers (`sparks` clones a Color per particle) are not this work's to fix; new layers call the no-allocation spawns.
- **K-LK6 screenshots** (reviewed, not pass / fail): `page.screenshot` of the canvas, frozen (`__hold`, fixed fxRand seed, fixed
  `VFX_TIME`), at screens.mjs's four sizes (915x412 his Poco, 844x390, 800x360, 667x320) x two depths (**d2, the ruin: warm lit stone**,
  where added cold went peach; **d8, the deep road: dark**, where a dim cold vanishes) x Cleaver I / II / III x the freeze frame and 400 ms
  after: 48 frames into `design/look/shots/`, one contact sheet for him.
- **K-LK7 a III is not a I in a still frame**: the same frozen frame at I and III, a 5 u box around Still at 915x412. Pass: >= 4% of its
  pixels differ by dE > 10, **and** it is not just bigger: III's near-white pixels (every channel > 0.9) <= 1.25 x I's, and its mean
  luminance <= 1.15 x I's. The real pass is human: three frames, I / II / III shuffled, sound off; he names the III at a glance.
- **K-LK8 deep-pack readability**: d8, 12 bodies, three windups locked (`TELL_CROWD`), every slot at III, a Cleaver cast into the pack,
  frozen at contact. Rendered twice, fx on and `__fxOff`. In each tell's screen mask (its mesh bounds, projected), >= 85% of the pixels
  are within dE 12 of the fx-off frame, and >= 80% keep an ember hue (0-40 deg). Structural: every rankfx mesh's `renderOrder` < 900 (tells
  start near 1000; `tellOrder` reaches 900 only 10 s out).
- **The regression set, every step**: tsc, vite build, `fights.mjs compare` (K-90F), builds.mjs (K-M30 among them), screens.mjs (the DOM is
  untouched: must stay green), lean.mjs (K-L11), corecheck.

## 4. Risks

| risk | why it is real here | the shape that contains it |
|---|---|---|
| **Combat drift from a look change** | fact 2: fx share `Math.random` with combat | L0a's `fxRand` + K-LK0, before any look work |
| **Perf on his phone** | adaptive resolution (perf.ts) hides a cost as blur, not dropped frames; the suites run on swiftshader, not his GPU | L0d numbers first; each step re-measured with `?perf=1`; the budget is in the table, not in castFx's code |
| **Overdraw from additive blending** | the glow pool is additive and big quads multiply fill on a mobile GPU; markfx went normal-blended because added cold vanished on lit stone and went peach on warm floors | any layer wider than ~0.5 u is normal-blended with a dark rim; additive only for points; K-LK7's near-white cap |
| **The peach look** | `sparks()` lerps up to half-way to white, which under ACES + bloom reads peach (vfx's own HOT_FRAG note) | no tier lightens toward white; a III is a kind, not a brighter colour; review d2 shots for peach |
| **The ember grammar** | the brief's "glow -> molten -> fractured" ladder: molten is the enemies' threat (meltMaterial, EMBER), and Still's embers already mean *cost* (push signature, Brace) | the ladder stays cold: frost -> rime -> fractured glass / steel (Ram's cracked family). No ember in any tier. A pushed cast keeps its own signature, so a pushed I never reads as a III |
| **The hit-flash blob** | enemy.ts lerps a struck body 85% to white plus emissive; a II contact on top adds to the blob | contact at the feet (fact 4); the rim flash in L1, before II ships |
| **Clutter over tells** | contact sits exactly where tells are: at the bodies | residue on the floor under the tells; contact at the feet, 1/sqrt n per crowd; K-LK8 |
| **Latency dressed as anticipation** | fact 3 | no field for a pre-release delay; anticipation is the frozen frame |
| **Lights out** | a III slot light on its own material would stay lit when Still stops | it copies `EYE.color` every frame (1.4) |

## Open questions (for the synthesis)

1. Grab (Clamp Toss) and catch (Anvil): the arc family's rows or their own? It changes L1's size by two parts.
2. Does L1 ship the hit-flash fix for every hit, or only for the arc family's? Every hit is cleaner; the arc's alone keeps L1 small.
3. The balancer's particle budget replaces K-LK3's placeholders; the translator's kinds replace 1.2's vocabulary if they differ.
