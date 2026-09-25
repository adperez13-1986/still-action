# Parts pool: what each part looks like (pass 4)

Written 25 Sep 2026. The Balancer (pass 1), Translator (pass 2) and spec (pass 3)
settled what the 30 parts do, sound like and how they pose. This pass covers
what each one **is**: one model per part, drawn in code from primitives. The same
model serves three places:

1. **worn** on Still, driven by the existing poses;
2. **hung** on the Workshop's wall of parts (`design/meta/DESIGN.md`), with
   unfound parts as bare outlines;
3. **dropped** on the floor as loot, in place of today's glowing chunk
   (`src/loot.ts`), inside its tier-coloured beam.

Nothing in `src/` is changed by this pass. §2 is what the build needs.

---

## 0. What reads at phone size

The brief says Still is about 1.2 u tall. In `still.ts` he measures about 2.05 u,
from the toe at y 0.03 to the top of the lens at y 2.08. Seen from the 38° pitch
that is about 1.6 u on screen.

| zoom | px per u | Still on screen | one slot (head / torso / arm / leg) |
|---|---|---|---|
| default | 23 | ~38 px tall | 9 / 11×10 / 15 / 18 px |
| widest (0.7) | 16 | ~26 px tall | **6 / 7×7 / 10 / 12 px** |

So at 16 px per unit:

- **An outline change under about 0.2 u (3 px) doesn't exist.** Neither does a
  dark detail on dark steel, whatever its size.
- **A lit point of 0.06 u does exist.** The lens glass and the core are
  `MeshBasicMaterial`s above the bloom threshold (0.72), so bloom spreads them
  to 2-3 px.
- **Value beats colour.** The grade desaturates hard, so a pale part next to a
  dark one reads, and a blue tint next to grey steel doesn't.

Every part below names **one 16 px feature**, and each one is one of three
kinds: a lit point, a change of value, or an outline change of at least 0.2 u.
Rivets, tier tags and edge wear are only for the wall and the floor, where the
camera is closer or the part is scaled up.

---

## 1. Rules for the whole family

### 1.1 The skeleton is the frame, and the frame is the empty slot

Every slot has a **frame**: the pivots, the pose handles and the thinnest rods
that join them. Every part is built as *frame + shell*. The frame is never
changed, and the shell is what makes the part.

**An empty slot draws its frame alone**, in `BARE`. Today an empty slot draws
the whole Lantern piece in `BARE`. With the frame instead, run 1's Still (one part
and three frames) looks sparse and exposed, and filling a slot visibly **adds
mass**, not just light. The lens glass and the core stay lit on the frame, as
they do today: they are Still himself, not a part.

| slot | fixed by the frame (handles the poses write every frame) |
|---|---|
| head | root at the neck pivot `(0, 1.56, 0.1)` (`head.position.z` is written back to 0.1 every frame); a stalk up to the `lens` group at `(0.03, 0.32, 0.05)`, rest `lens.rotation.z` 0.18 (written every frame, so no part can change the rest tilt); a lit glass facing +z in lens space |
| torso | root at `(0, 1.0, 0)`, rest `rotation.x` 0.16; bottom ring R 0.15 at y 0 (the legs hang under it); top ring R 0.23 at y 0.55 (the arms and neck mount on it); `core` (EYE ball r 0.11) at `(0, 0.28, 0)`, the anchor for every core flash |
| arms | `armL` pivot `(-0.26, 1.5, 0.04)`, elbow `(-0.08, -0.32, 0.08)`, hand `(-0.05, -0.64, 0.14)`; `jawL` / `jawR` meshes whose **origin x** is written as `JAW_X ± JAW_OPEN` every frame; `armR` pivot `(0.26, 1.5, 0.04)`, elbow `(0.06, -0.28, 0.07)`, and a hook below it |
| legs | `legL` / `legR` pivots at `(±0.14, 0.98, 0)`; per leg the backward bird bend: knee `(±0.02, -0.4, 0.17)`, ankle `(0, -0.8, -0.09)`, toe `(0, -0.95, 0.14)` on the floor |

**Jaw rule.** The poses move each jaw by its origin, so a bigger or odder clamp
changes the jaw's *geometry* (built, then `geometry.translate`d so its pivot
stays at the hand) and never the mesh's position. The same goes for the lens.
Anything that must sit off the pivot is offset inside the geometry.

### 1.2 Palette (one material, painted per vertex)

All steel on every part is one `MeshStandardMaterial({ vertexColors: true })`,
called `STEEL` here. Each primitive is painted before merging. Nothing on Still
is warm.

| name | hex | used for |
|---|---|---|
| SHELL | `0x55616e` | working surfaces: barrels, bars, forearms, jaws, feet (today's `SHELL`) |
| DARK | `0x2c343d` | load-bearing structure: stalks, rings, upper arms, thighs and shins (today's `SHELL_DARK`) |
| PALE | `0x8e9aa6` | polished or worn faces: mirrors, plates, blade edges. Kept under the bloom threshold, so it reads as metal, never as light |
| RIME | `0x9fb4c8` | frost, the same pale as the rime on slowed enemies (pass 2, N4) |
| PIT | `0x3b3e42` | pitted steel (Rusted Hook). Rust is shown as pitting, not brown: Still is never warm |
| TAG_BLUE | `0x55669a` | the blue tier tag |
| TAG_GOLD | `0x857b66` | the gold tier tag: brass gone grey, with the same brightness as SHELL, so it reads as another metal and never as a light |
| `EYE` | `0xd6ebff`, Basic | the lens glass, the core, and each part's one allowed extra light |

The **value rule** is what makes any four parts look like one robot: dark for
what carries load, mid for what works, pale only where something is polished or
frosted. It's the rule the Lantern already follows.

### 1.3 Tier is how different the part is

| tier | what changes | how it's built | tag |
|---|---|---|---|
| **white** | plain salvage: one idea, Lantern proportions | its own builder | none |
| **blue** | its parent white's model **plus one twist** you could name in three words ("a deflector plate", "coiled shins") | `parentBuilder()` + `twist()`. It mirrors "a blue has exactly one mod" | TAG_BLUE |
| **gold** | a named oddity: keeps the frame, drops the family look | its own builder | TAG_GOLD |

Parents are the Balancer's "from" column (pass 1). Each family has a **marker**
that its blues keep and its golds drop:

| family | marker | its blues | its golds (marker dropped) |
|---|---|---|---|
| Focusing Lens | the round barrel | Cracked, Ricochet, Patient | Through-Line (square bore), Coil (three small barrels) |
| Flare | the raised mortar | Signal Flare | |
| Pressure Vent | the open 6-bar cage | Backdraft, Chill, Brace | |
| Ward | the slat cage | Mirror Ward | Lure (bulging lantern cage) |
| Scrap Cleaver | the pale scrap blade | Rusted Hook, Parry Clamp, Frayed Cleaver | |
| Piston | the thick sleeve | Clamp Toss | Anvil (a solid beam) |
| Kickstart | the Lantern bird legs | Skid Plates, Overrun, Frost Trail | Borrowed Time (square shins) |
| Skitter | the forked feet | Spring Heels | Plumb Line (bare frame and a bob) |

**The tier tag** always sits in the same place in its slot, like a luggage tag,
so you can count them on the wall: a collar at the top of the head's stalk, a
thin ring just under the torso's top ring, a cuff on the left wrist, a band on
each shin above the ankle. It's a torus with a 0.014 tube and no emissive. It's
invisible at 16 px on purpose: the shape carries the tier there, and the tag is
for the wall and the pickup close-up. The full `TIER_COLOR` appears only in the
floor beam.

**Gold never glows warm on the body.** A gold's only gold is its grey-brass
tag. Its lights are `EYE` like every other light on Still.

### 1.4 More rules that keep a mixed Still one robot

1. **Salvage is attached, not grown.** Every add-on meets the frame at a rivet
   (ball r 0.03) or a collar, with the same joint balls as the Lantern (0.06
   elbows and ankles, 0.085 knees). Mismatched parts share one vocabulary of
   joins.
2. **Rod radii come from the Lantern's set**: 0.035 / 0.045 / 0.05 / 0.055 /
   0.07. A thicker section needs a named reason (Piston's sleeve, Anvil's beam).
3. **Envelopes.** The head stays inside 0.5 u around the lens pivot, the torso
   inside r 0.3 (so it never meets the arms), and the arms within 0.2 u of the
   Lantern's arm line. Anvil is the named exception, and only overhead.
4. **Left clamp, right hook, always.** The mismatched arms are the Lantern's
   identity. Parts may exaggerate it or flip which side is longer (Rusted Hook),
   but never swap the hands.
5. **The lean stays**: the torso's 0.16 hunch and the lens's 0.18 tilt are in
   the frame.
6. **At most one extra light per part**, always `EYE`, and only where the light
   *is* the ability (a blinker, a lure, a plumb bob's tip). Whites have none.
   Because it's `EYE`, it flashes on every cast and goes out with the lens when
   he Stops (`setSlowdown`). All his lights live and die together.
7. **What's out in the world is missing from the body.** A part whose thing is
   out there (Plumb Line's anchor, Lure's decoy) hides it on the body while it's
   out. It's the body's version of the LIVE button face.
8. **Nothing for Yanah or Yuri**: no reserved slot, peg or placeholder
   anywhere (§4).

---

## 2. One model, three uses: the build

### 2.1 The seam

A new module, say `src/partmodels.ts`, builds a slot model from a part id (or
`null` for the frame). The signature is the load-bearing part:

```ts
export interface SlotModel {
  root: THREE.Group                       // at the slot's home (§1.1)
  lens?: THREE.Group; glass?: THREE.Mesh  // head
  core?: THREE.Mesh                       // torso
  armL?: THREE.Group; armR?: THREE.Group; jawL?: THREE.Mesh; jawR?: THREE.Mesh // arms
  legL?: THREE.Group; legR?: THREE.Group  // legs
  /** optional idle motion (§3 per part); ctx carries walk phase, speed, Patient's charge */
  tick?(dt: number, ctx: PartCtx): void
  /** optional: its thing is out in the world (rule 7) */
  setLive?(out: boolean): void
}
export function buildModel(slot: SlotName, id: string | null, use: 'body' | 'display'): SlotModel
```

`Still` gains `wear(slot, def | null)`, which replaces `setEquipped`:

- build the model, `setPart` it, and rebind `lens` / `core` / `jawL` / `jawR` /
  `armL` / `armR` / `legL` / `legR` from it;
- **register its home**: `home.set(model.root, HOME[slot])`. Today `home` is
  filled only in the constructor, so a part swapped in mid-run would reassemble
  at the origin;
- use `STEEL` for a part and `BARE` for a frame, and bump a `version` counter
  (the ghosts need it, §6);
- call `tick` from `update()` and `setLive` from the decoy and anchor events.

`main.ts`'s three `setEquipped` calls become `wear`. `hud`, `combat` and
`partfx` keep reading the same handles.

### 2.2 Geometry: merged, cached, shared

- **One mesh per rigid piece, one material per mesh.** Everything that moves as
  one (the stalk; the lens group; the torso cage; `armL` minus its jaws; `armR`;
  each leg) is painted and merged into one `BufferGeometry` with
  `BufferGeometryUtils.mergeGeometries`. The `EYE` bits of a piece merge into
  one `EYE` mesh.
  - Gotcha: `ExtrudeGeometry` is non-indexed and the rest are indexed. Call
    `toNonIndexed()` on everything before merging, and give every piece
    `position` / `normal` / `uv` / `color`.
- **Cached per part id**, built lazily and never disposed: 30 parts of a few
  small geometries each. `drop()` builds the floor model, so a part's geometry
  is always warm before it's picked up.
- **Segment counts:** cylinders 8 radial, spheres 10×8, tori 6×12-18, helices 10
  segments per turn × 5 radial. Cap: **700 triangles per part**, about 2,500 for
  Still.

**Draw calls.** Today's Lantern is 31 meshes, so 31 draw calls. During a dash
(an afterimage every 0.03 s, living 0.26 s) about 9 ghosts are alive, which is
about 280 more. Merged, the Lantern-equivalent is **11**:

| slot | meshes | + extras (named in §3) |
|---|---|---|
| head | stalk, lens steel, glass | Signal Flare's blinker +1 |
| torso | cage, core | Backdraft's fan +1, Lure's bulb +1 |
| arms | armL, jawL, jawR, armR | Frayed Cleaver's strips +1 (optional) |
| legs | legL, legR | Plumb Line's pendulum +2, Borrowed Time's wheels +2 (optional) |

The worst real mix is 15. A dash's ghosts drop from about 280 draw calls to
about 100-135, which is the one real performance gain here for the Poco.

### 2.3 Other materials

| material | what | where |
|---|---|---|
| `BARE` | today's `0x15191e`, rough; ignores vertex colours | frames on the body; unfound parts on the wall |
| `DISPLAY_EYE` | Basic `0x4d6781`, dim cold glass that isn't powered | glass and core of any part not on Still (wall, floor) |
| `OUTLINE` | Basic `0x3a4654`, `BackSide`, `onBeforeCompile` pushes vertices 0.012 u along the normal (an inverted hull) | unfound parts on the wall |

All three are shared. **`Loot.dispose` must stop disposing every material in the
group**: shared ones get `userData.shared = true` and are skipped. Today it
disposes all of them, which with shared materials would blank every other copy.

---

## 3. The parts

Coordinates are in the slot's local frames, as in `still.ts`: head = neck pivot;
lens = lens pivot with +z out of the glass; torso = bottom-ring centre;
`armL` / `armR` = shoulder pivot; leg = hip pivot. `×1.3` means relative to the
Lantern piece it replaces. Colours in brackets are §1.2's vertex colours.
**Card** is the pickup line, word for word, and every look is tied to it.

### HEAD: reaches far

| stays | varies |
|---|---|
| neck pivot, stalk to the lens pivot, `lens` group and rest tilt, one lit glass facing forward | the barrel (size, depth, angle, section), attachments on it, the number and shape of the glass, the stalk's section |

| | part | tier | silhouette | 16 px feature | meshes |
|---|---|---|---|---|---|
| — | frame | — | an eye on a stick | a small lit disc, no barrel | 3 |
| H1 | Focusing Lens | white | one round barrel | the big bright disc | 3 |
| H2 | Flare | white | a stubby mortar raised 35° | the head rises and the glass faces the sky | 3 |
| H3 | Cracked Lens | blue | Lens, glass split | a broken glint: half a disc and a sliver | 3 |
| H4 | Ricochet Lens | blue | Lens + side plate | a flat plate off one side; the head isn't round | 3 |
| H5 | Patient Lens | blue | a bigger Lens with an iris | the biggest round head, with a small light that grows | 3 |
| H6 | Signal Flare | blue | Flare + blinker mast | a lit point above the mortar, blinking | 4 |
| H7 | Through-Line | gold | a long square bore | the only long head, with a bright line along it | 3 |
| H8 | Overclocked Coil | gold | three small lenses in a fan | three bright dots in a row | 3 |

**Frame.** Stalk rod r 0.03 (×0.75) [BARE]. Lens: a thin ring (torus R 0.12,
tube 0.02) [BARE] holding a glass that is a flat cylinder r 0.1, h 0.02 (EYE),
so it shows from behind too. No barrel.

#### H1. Focusing Lens (white, bolt)
*Card: A heavy bolt at the nearest enemy.*
- **Silhouette:** today's Lantern head, unchanged. One big lens, one heavy bolt.
- **Build:** stalk rod r 0.04 [DARK]; barrel cylinder r 0.2, h 0.17, along z
  [SHELL]; glass circle r 0.135 at z 0.087 (EYE); rim torus R 0.16, tube 0.03
  at z 0.086 [DARK].
- **16 px:** the round face with the big bright disc. Every other head is judged
  against it.
- **Idle:** none.

#### H2. Flare (white, lob)
*Card: Lobs a burst over walls onto where the enemy was standing.*
- **Silhouette:** a mortar. A short tube raised 35° up and forward, so the head
  looks up even at rest. The flare pose (`head.rx −0.7`) lifts it nearly vertical
  at the release: it reads as firing *up*.
- **Build (lens space):** axis `u = (0, sin 35°, cos 35°)`. Breech: a squat
  cylinder r 0.18, h 0.08 on `u` at the origin [DARK]. Tube: an open cylinder
  r 0.15 (×0.75), length 0.3 (×1.75) along `u` [SHELL]. Glass circle r 0.11,
  recessed 0.03 inside the mouth, facing `u` (EYE). Mouth rim torus R 0.15,
  tube 0.03 [DARK].
- **16 px:** the top of the head sits about 0.1 higher and further forward, and
  the glass faces the camera (which looks down) more than any other head's.
- **Idle:** none.

#### H3. Cracked Lens (blue ← Lens, pierce)
*Card: The bolt passes through every enemy it hits. Walls still stop it.*
- **Silhouette:** the Focusing Lens with its glass split straight through, the
  way the bolt goes straight through.
- **Twist:** the glass becomes two half-circles (`CircleGeometry(0.135, 18, a, π)`)
  split along a diagonal (0.6 rad). The upper half is shifted 0.03 along the
  split and 0.02 out, leaving a gap of about 0.04. A 50° wedge is missing from
  the lower half (`thetaLength` 0.72 π), so the dark barrel face shows. The rim
  torus breaks where the crack leaves it (arc 1.75 π). Tag at the stalk collar.
- **16 px:** a broken glint, half a disc and a sliver where the others have a
  round one. The closest call in the pool (§8).
- **Idle:** none. Pass 2's crack twitch (`lens.rz` snaps +0.3) now shows the
  halves shifting.

#### H4. Ricochet Lens (blue ← Lens, bounce)
*Card: A bolt that bounces off walls to reach enemies behind cover.*
- **Silhouette:** the Lens with a deflector plate hinged off one side, a small
  mirror for banking shots.
- **Twist:** a box 0.24 × 0.16 × 0.02 [PALE] hinged at the barrel's +x rim
  `(0.2, 0, 0.02)`, yawed 0.8 rad so it angles out and forward, with a rivet
  (r 0.03) at the hinge.
- **16 px:** a flat pale plate off one side. The head is no longer round. The
  ricochet pose cants the head toward the bank, so the plate visibly swings with
  it.
- **Idle:** none.

#### H5. Patient Lens (blue ← Lens, charge)
*Card: Hits harder the longer you wait. Held while it recharges, it fires full.*
- **Silhouette:** a wide, heavy eye with an iris. Its pupil opens as the charge
  builds, so you watch it get ready.
- **Twist:** barrel r 0.25 (×1.25), h 0.2 [SHELL]; rim torus R 0.2, tube 0.035
  [DARK]; iris: a disc r 0.17 at z 0.101 [DARK] (part of the steel mesh);
  pupil: an EYE circle r 0.17 at z 0.103. The pupil is the glass handle.
- **16 px:** the biggest round head, mostly dark, with a small lit centre that
  grows to fill it.
- **Idle:** `pupil.scale` follows the charge from 0.35 (empty) to 1.0 (full),
  eased at 8/s. At full it overshoots once to 1.1 for 0.1 s, the body side of
  pass 2's ring pop. It's the only part whose idle motion carries information.
  Needs the charge in `PartCtx`.

#### H6. Signal Flare (blue ← Flare, mark)
*Card: Marks enemies where it lands. Your next part hits a marked one twice.*
- **Silhouette:** the Flare mortar with a signal lamp on a thin mast.
- **Twist:** a mast rod r 0.015, 0.1 tall, rising from the top of the mouth rim
  [DARK], capped by an EYE sphere r 0.04. The bulb is its own mesh so it can
  blink.
- **16 px:** a lit point above the mortar mouth, blinking.
- **Idle:** the bulb blinks (scale 1 → 0) for 0.12 s every 2 s. While any enemy
  carries his mark it blinks at 4 Hz: the mark is out, and the body says so. The
  signal pose's lens flick whips the mast.

#### H7. Through-Line (gold, boss only, pierce all)
*Card: A bolt through enemies and walls. The holes it leaves let shots through both ways.*
- **Silhouette:** the round lens is gone. In its place is a long square bore,
  the only straight line on Still, shaped like the beam it fires. **Boss-only
  parts use the Assembler's vocabulary**: square sections where Still is round.
  Borrowed Time is the other one.
- **Build (lens space):** bore box 0.16 × 0.16 × 0.52 from z −0.1 to +0.42
  [DARK]; two rails along its top edges, 0.02 × 0.03 × 0.5 [PALE]; a muzzle
  frame of 4 boxes 0.2 × 0.03 × 0.03 at z 0.42 [SHELL]. **The glass is a slit**:
  an EYE plane 0.035 × 0.44 lying on the top face (y 0.082, z 0.04 to 0.40).
  Stalk: box 0.07 × 0.2 × 0.07 [DARK]. Gold tag at the collar.
- **16 px:** a long head pointing where he faces, with a lit line along it.
  Nothing else has either.
- **Idle:** none. The through pose's draw and recoil slide the bore back
  0.06-0.15, which a long shape shows better than a round one.

#### H8. Overclocked Coil (gold, 3-bolt fan, +1 strain)
*Card: Three bolts at once, ready fast, but every shot adds strain.*
- **Silhouette:** three small lenses side by side, the outer two turned out at
  the fan's own angle, and the stalk wound in a coil.
- **Build (lens space):** three barrels, cylinders r 0.1, h 0.14, at x −0.17 /
  0 / +0.17, yawed −0.26 / 0 / +0.26 (±15°, the spread) [SHELL]; three glasses,
  circles r 0.07 on their faces, merged into one EYE mesh; a bar behind them,
  0.44 × 0.05 × 0.06 [DARK]. Stalk: rod r 0.035 inside a helix (r 0.06, 5 turns,
  tube 0.014) [SHELL]. Gold tag on top of the coil.
- **16 px:** three bright dots in a row, the widest head.
- **Idle:** none. The strain cost reads on the button pips and the meter, not
  the body, because the body must stay cold. The existing coil shiver
  (`lens.rz` ±0.08 at 30 Hz) shakes all three.

---

### TORSO: works around Still

| stays | varies |
|---|---|
| both rings (the sockets for arms, neck and legs), the core and its position, the 0.16 hunch, an open cage you can see the core through | the bars (count, section, shape), what hangs on the outside, what frames the core |

| | part | tier | silhouette | 16 px feature | meshes |
|---|---|---|---|---|---|
| — | frame | — | two rings and three thin bars | a bright core in almost nothing | 2 |
| T1 | Pressure Vent | white | the Lantern's open cage | open cage, bright core | 2 |
| T2 | Ward | white | a cage of 10 flat slats | a solid-looking torso, the core glinting through | 2 |
| T3 | Backdraft Vent | blue | Vent + a fan on the back | a round plate on his back, flickering when it spins | 3 |
| T4 | Chill Vent | blue | Vent, frosted, icicles hanging | a pale fringe at the waist | 2 |
| T5 | Brace | blue | Vent + cross-braces | a dark X across the bright core | 2 |
| T6 | Mirror Ward | blue | Ward + a chest mirror | a pale disc on the chest with a lit centre | 2 |
| T7 | Lure | gold | a bulging lantern with an angler's lamp behind | a lit point hanging behind his shoulders | 3 |

**Frame.** Rings as today but with a 0.03 tube (×0.67) [BARE]; 3 bars (every
other one of the Lantern's 6), r 0.022 [BARE]; the core (EYE r 0.11).

#### T1. Pressure Vent (white, nova + shove)
*Card: A blast around you that shoves enemies away.*
- **Silhouette:** today's cage, unchanged: bars that burst open in the nova pose.
- **Build:** 6 bars r 0.035 from `(cos a·0.15, 0, sin a·0.15)` to
  `(cos a·0.23, 0.55, sin a·0.2)` [SHELL]; bottom ring R 0.15 and top ring
  R 0.23, tube 0.045 [DARK]; core.
- **16 px:** the open cage with a bright core inside.
- **Idle:** none.

#### T2. Ward (white, shield)
*Card: A brief shield that destroys enemy shots.*
- **Silhouette:** a cage of 10 flat slats: a small, still version of the
  10-facet shell it raises (pass 2, N5). It's still a cage, and the core shows
  through the slits.
- **Build:** 10 boxes 0.075 × 0.56 × 0.02 on the Vent bars' endpoints, faces
  turned outward, gaps about 0.03 [SHELL]; rings as the Vent [DARK]; core.
- **16 px:** the torso reads solid and mid-grey instead of see-through, with the
  core glinting between the slats.
- **Idle:** none.

#### T3. Backdraft Vent (blue ← Vent, pull)
*Card: The blast drags enemies in instead of out.*
- **Silhouette:** the Vent with an intake fan on its back. It draws air in, and
  enemies with it.
- **Twist:** at `(0, 0.3, −0.26)`, facing −z: a shroud torus R 0.16, tube 0.025
  [DARK], on two short struts to the back bars; a hub cylinder r 0.04, h 0.05; 3
  blades 0.14 × 0.05 × 0.012 at 120°, pitched 0.35 [SHELL]. Hub and blades are
  their own mesh, so they can spin.
- **16 px:** a round plate on his back, visible when he faces away or sideways
  and through the open bars when he faces you. It flickers when it spins.
- **Idle:** the fan turns at 1 rev/s. On a cast it winds up to 12 rev/s during
  the inhale (k < 0.3) and coasts back over 1 s. The flicker is the read.

#### T4. Chill Vent (blue ← Vent, slow)
*Card: A cold blast that makes enemies walk slowly for a while.*
- **Silhouette:** the Vent frosted from the bottom up, with icicles hanging off
  the hip ring. Cold falls (pass 2, G4).
- **Twist:** 8 cones, r 0.03, h 0.10 and 0.16 alternating, pointing down from
  the bottom ring (radius 0.15, y −0.02) [RIME]. The bars' vertex colours run
  from RIME at y 0 to SHELL at y 0.35: the same bottom-up rime that climbs a
  slowed enemy.
- **16 px:** a pale fringe at the waist, and the cage paler at the bottom. It's
  a value change, which survives the grade.
- **Idle:** none.

#### T5. Brace (blue ← Vent, strain for integrity)
*Card: For a moment, hits cost you strain instead of integrity.*
- **Silhouette:** the Vent cross-braced like a scaffold. Bracing is literally
  what it does.
- **Twist:** 4 flat bars, 0.05 × 0.62 × 0.025 [DARK]. A front pair runs from the
  bottom ring's front-left to the top ring's front-right and vice versa,
  crossing at y 0.28, z about 0.16, in front of the core, with a rivet (r 0.03)
  at the crossing. A back pair mirrors it at −z, so it reads from any facing.
- **16 px:** a dark X across the bright core. Check whether it reads as "crossed
  out" (§8).
- **Idle:** none. If pass 2's "cage bars glow ember" window is built, the braces
  are the natural thing to tint, and they become their own mesh (+1).

#### T6. Mirror Ward (blue ← Ward, reflect)
*Card: A brief shield that sends enemy shots back at whoever fired them.*
- **Silhouette:** Ward's slats with a convex mirror on the chest. The mirror pose
  throws the arms open and presents it.
- **Twist:** a cap of a sphere (r 0.3, `thetaStart` 0.12, `thetaLength` 0.45,
  about 0.32 across), pole turned to +z, cap face at z about 0.21, centred at
  y 0.3 [PALE], with a small hole at its pole. An EYE disc r 0.04 sits in the
  hole, merged into the core mesh (so it flashes and dims with the core).
- **16 px:** a pale disc on the chest with a lit centre.
- **Idle:** none.

#### T7. Lure (gold, decoy)
*Card: Leaves a decoy of you that enemies go after, until it bursts.*
- **Silhouette:** an old hurricane lantern (the cage bulges out and pinches in
  at both rings) with an angler's lamp on an arched rod over his back. The decoy
  appears 1.5 u behind him, and the lure already hangs behind him, so the model
  teaches where the decoy will be.
- **Build:** 8 bars r 0.03, each two segments: bottom ring → a bulge at r 0.25,
  y 0.28 → top ring [SHELL]; rings as the Vent [DARK]. The rod is a tube
  (r 0.02) along a CatmullRom curve `(0, 0.55, −0.2) → (0, 0.85, −0.3) →
  (0, 0.92, −0.45) → (0, 0.8, −0.55)` [DARK]. At its tip hangs its own group: a
  line (rod r 0.008, 0.08 long) and a bulb, EYE sphere r 0.055. Gold tag under
  the top ring.
- **16 px:** a lit point hanging behind his shoulders, about 1.7 u up, on an arc.
- **Idle:** the bulb swings like a pendulum, lagging the walk:
  `rot.x = −0.5 × smoothed speed + 0.15 × sin(bob)`.
- **Live (rule 7):** while the decoy is out, the body's bulb is hidden. Clone
  the decoy **before** hiding it, so the decoy carries the lit lure and he
  doesn't (§6). The light went with the decoy. It comes back when the decoy
  bursts.

---

### ARMS: close

| stays | varies |
|---|---|
| both shoulder pivots, the elbows, the clamp hand's position and its two jaw handles (origins untouched, §1.1), a hook on the right | forearm section and add-ons, jaw shape (inside the geometry), the hook's size and how it hangs, plates and blades |

| | part | tier | silhouette | 16 px feature | meshes |
|---|---|---|---|---|---|
| — | frame | — | thin rods, small jaws, a small hook | two thin lines | 4 |
| A1 | Scrap Cleaver | white | Lantern arms + a scrap blade | a pale fin along the left forearm | 4 |
| A2 | Piston | white | the left forearm is a piston | a thick, straight left forearm ending in a disc | 4 |
| A3 | Rusted Hook | blue | Cleaver + a big hook on a chain | the right side is now the long one | 4 |
| A4 | Parry Clamp | blue | Cleaver + long curved jaws | a long pincer that visibly snaps | 4 |
| A5 | Frayed Cleaver | blue | Cleaver, blade coming apart | a spiky fringe off the left forearm | 4 (5) |
| A6 | Clamp Toss | blue | Piston + a big claw | the biggest hand, a square claw on a thick arm | 4 |
| A7 | Anvil | gold | an anvil on a beam of an arm | a heavy block at the end of the left arm | 4 |

**Frame.** Upper arms r 0.035, left forearm r 0.03, elbow balls r 0.045;
jaws 0.035 × 0.12 × 0.05; hook torus R 0.07, tube 0.022, arc 1.3 π. All [BARE].

#### A1. Scrap Cleaver (white, 120° arc)
*Card: A wide swing at whatever is closest.*
- **Silhouette:** the Lantern's arms with a sheet of scrap lashed along the
  clamp's forearm, edge forward. The clamp becomes a cleaver, and the arc pose
  sweeps the edge first. It's the only starting white that isn't the Lantern
  piece untouched, because a bare clamp doesn't say "cleaver".
- **Build:** Lantern arms (upper rods r 0.05 [DARK], left forearm r 0.045
  [SHELL], elbow balls r 0.06, jaws 0.05 × 0.16 × 0.07 [SHELL], hook torus
  R 0.1, tube 0.035 [SHELL]). Blade: an extruded trapezoid 0.02 thick, lying in
  the plane of the forearm and forward, 0.34 long, 0.06 deep at the elbow to
  0.16 deep at the wrist, offset 0.05 to the outside (−x), 2 rivets [PALE].
- **16 px:** a pale fin along the left forearm. It's the arms family's marker.
- **Idle:** none.

#### A2. Piston (white, 40° jab + shove)
*Card: A hard, narrow punch that knocks one enemy back.*
- **Silhouette:** the clamp's forearm is a piston: a fat sleeve, a polished rod,
  and a punch plate the jaws close in front of. The piston pose's dead-straight
  arm reads as a ram.
- **Build:** a sleeve cylinder r 0.08 (×1.8), 0.2 long from the elbow along the
  forearm [DARK]; a rod r 0.035 from the sleeve to the hand [PALE]; a punch
  plate cylinder r 0.09, h 0.04 at the hand, along the forearm axis [SHELL];
  jaws and hook as the Lantern. It's the marker for its family (Clamp Toss).
- **16 px:** a thick, straight left forearm ending in a disc.
- **Idle:** none.

#### A3. Rusted Hook (blue ← Cleaver, long arc + yank)
*Card: A long, narrow swing that yanks enemies to you.*
- **Silhouette:** Cleaver arms whose hook has grown and hangs on a chain. For
  once the hook side is the long one, and the hook pose (the only one it leads)
  throws it.
- **Twist (armR space):** 3 chain links (tori R 0.035, tube 0.012, alternating
  90°) from the elbow down to y −0.46, then the hook: torus R 0.15 (×1.5), tube
  0.045, arc 1.5 π, centred at `(0.06, −0.6, 0.07)`, with a barb (cone r 0.035,
  h 0.08) at its point. Hook and chain [PIT]. Tag at the left cuff as always.
- **16 px:** the right side is now as long as the clamp, with a big dark hook
  hanging at hand height. The arms' asymmetry flips. That's an outline change,
  not a colour one: the pitting is for the wall.
- **Idle:** none.

#### A4. Parry Clamp (blue ← Cleaver, windup cancel)
*Card: A quick snap. Catch an enemy winding up and it breaks the attack.*
- **Silhouette:** Cleaver arms whose jaws are long curved tines, a pincer built
  for a snap you can see.
- **Twist:** each jaw becomes an extruded crescent 0.26 long, 0.05 wide,
  0.05 thick, curving 0.05 toward the other jaw at its tip [SHELL]. Its geometry
  is translated so its top sits where the Lantern jaw's top was
  (`lh.y + 0.01`), with the origin untouched. When the parry pose shuts the jaws
  (−0.054 each), the tips meet.
- **16 px:** a long V at the end of the left arm that closes, with the blade fin
  above it.
- **Idle:** none.

#### A5. Frayed Cleaver (blue ← Cleaver, width follows strain)
*Card: A swing that grows wider the more strained you are.*
- **Silhouette:** the Cleaver's blade coming apart into a fan of loose strips.
  It's already the wider swing it grows into.
- **Twist:** 3 strips (boxes 0.14 / 0.17 / 0.2 × 0.03 × 0.015) splaying from the
  blade's edge at 15°, 35° and 55° [PALE]; the blade's own edge notched (3 V cuts
  in the extrude outline).
- **16 px:** a spiky fringe off the left forearm.
- **Idle (optional, +1 mesh):** the strips are their own mesh and splay 1.0 /
  1.3 / 1.6× at the strain thresholds (below 6, 6-11, 12+). It's the body side
  of pass 2's meter notches, so it matters only if the notches alone don't
  teach the thresholds.

#### A6. Clamp Toss (blue ← Piston, grab + throw)
*Card: Grabs the nearest enemy and throws it the way you're steering.*
- **Silhouette:** the Piston arm with a big claw, a hand built to hold a body.
- **Twist:** jaws 0.09 × 0.28 × 0.11 (×1.8 / ×1.75 / ×1.6), each translated 0.03
  outward and 0.06 down so the open gap is 0.18 (the Lantern's is 0.07). Shut,
  it still leaves 0.07, as if it's holding something. A lip (box
  0.05 × 0.04 × 0.11) points inward at each jaw's tip [SHELL].
- **16 px:** the biggest hand in the pool, a square claw on a thick arm. It's
  told apart from Parry's long V by the sleeve under it.
- **Idle:** none.

#### A7. Anvil (gold, catch + counter)
*Card: Catches the next blow that would hit you and hammers back. Shots get through.*
- **Silhouette:** the clamp's forearm is a solid beam carrying an anvil across
  the wrist. The stance raises it overhead: he holds up an anvil to catch the
  blow, and the slam brings it down.
- **Build:** upper arm r 0.065 [DARK]; forearm a box 0.1 × 0.34 × 0.1 along the
  forearm axis [DARK]; the anvil head, an extruded profile from the icon (flat
  top, horn forward, waist, foot), 0.32 long × 0.15 tall × 0.12 thick, centred
  at `hand + (0, 0.06, 0.02)`, with a PALE top face (worn by blows) and SHELL
  otherwise; the frame's small jaws under it; the Lantern's hook on the right.
  Gold tag at the cuff.
- **16 px:** a heavy block at the end of the left arm, top-heavy, and in the
  stance a block over his head.
- **Idle:** none.

---

### LEGS: move him

| stays | varies |
|---|---|
| hip pivots, stance width, the backward bird bend through the knee, ankle and toe, feet on the floor | rod sections, what's at the knee, the foot's shape, what trails or hangs, static pieces in the legs root (which doesn't swing) |

| | part | tier | silhouette | 16 px feature | meshes |
|---|---|---|---|---|---|
| — | frame | — | thin bird legs | two thin bent lines | 2 |
| L1 | Kickstart | white | the Lantern's bird legs | the backward-bent legs | 2 |
| L2 | Skitter | white | lighter legs, forked bird feet | a small star at each foot | 2 |
| L3 | Skid Plates | blue | Kickstart + sled runners | long flat feet, twice the length | 2 |
| L4 | Overrun | blue | Kickstart + ram plates at the knees | blocky knees at the front | 2 |
| L5 | Frost Trail | blue | Kickstart + a frost scraper at each heel | a pale tail off each heel along the floor | 2 |
| L6 | Spring Heels | blue | Skitter with coiled shins | pale, thick, striped shins | 2 |
| L7 | Plumb Line | gold | a bare frame with a plumb bob hanging between the legs | a swinging weight with a lit tip | 4 |
| L8 | Borrowed Time | gold | square legs with clock wheels at the knees | big round knees | 2 (4) |

**Frame.** Thigh r 0.05, shin r 0.04, foot r 0.035; knee ball r 0.06, ankle
ball r 0.045. All [BARE].

#### L1. Kickstart (white, dash)
*Card: Dash, running over anything in the way.*
- **Silhouette:** today's legs, unchanged: long backward-bent legs built to
  launch.
- **Build:** thigh r 0.07, shin r 0.055 [DARK]; foot rod r 0.05 [SHELL]; knee
  ball r 0.085, ankle ball r 0.06 [SHELL].
- **16 px:** the bird legs.
- **Idle:** none.

#### L2. Skitter (white, hop)
*Card: A quick little hop the way you're steering.*
- **Silhouette:** lighter bird legs with real bird feet: three splayed toes and
  a back spur.
- **Build:** thigh r 0.06, shin r 0.04 [DARK]; knee ball r 0.07; three toes,
  rods r 0.03, 0.25 long, from the ankle to the floor, yawed −40° / 0° / +40°
  (the middle one replaces the Lantern's single toe) [SHELL]; a back spur 0.07
  long. It's the marker for its family.
- **16 px:** a small star at each foot (the fork is about 0.18 wide), on thinner
  legs.
- **Idle:** none.

#### L3. Skid Plates (blue ← Kickstart, dash + slam)
*Card: The dash ends in a blast that shoves enemies away.*
- **Silhouette:** the Kickstart with sled runners under the feet. The skid pose
  splays the legs forward and the plates slam.
- **Twist (per leg):** a runner box 0.12 × 0.03 × 0.34 at `(0, −0.95, 0.04)`,
  from 0.13 behind the ankle to past the toe, top [SHELL], underside [PALE]
  (worn); a nose box 0.12 × 0.03 × 0.08 at its front, bent up 25°. Tag band
  above the ankle.
- **16 px:** long flat feet, twice the Lantern's foot, light against the stone.
- **Idle:** none.

#### L4. Overrun (blue ← Kickstart, push charge)
*Card: A short step. Held while it recharges, a long charge that hits.*
- **Silhouette:** the Kickstart with ram plates on the knees. In the ram pose
  (torso pitched 0.7, head down) the knees lead.
- **Twist (per leg):** a plate 0.17 × 0.22 × 0.05 at `knee + (0, 0, 0.07)`,
  tilted 23° to the thigh [DARK]; a buffer on its face, a cylinder r 0.04,
  h 0.05, pointing forward [PALE].
- **16 px:** blocky knees at the front: the leg is thick in the middle.
- **Idle:** none.

#### L5. Frost Trail (blue ← Kickstart, strip)
*Card: A dash that leaves a cold track that slows enemies on it.*
- **Silhouette:** the Kickstart with a frost scraper trailing behind each heel,
  the thing that leaves the track. The frost pose drags the trailing leg, and
  the scraper drags with it.
- **Twist (per leg):** a blade 0.02 × 0.08 × 0.26 from the ankle back and down,
  so its tail touches the floor at about `(0, −0.95, −0.31)` [RIME]. RIME is the
  pale of the frost it leaves and of the enemies it slows.
- **16 px:** a pale tail off each heel along the floor.
- **Idle:** none.

#### L6. Spring Heels (blue ← Skitter, vaulting hop)
*Card: A hop that clears a low wall, landing heavy on the far side.*
- **Silhouette:** Skitter's legs with coiled shins. The spring pose's deep
  crouch reads as the coil loading.
- **Twist (per leg):** the shin becomes a helix around the knee → ankle axis
  (r 0.065, 4.5 turns, tube 0.02) [SHELL], with a thin core rod r 0.02 inside
  [DARK] so it still reads as a leg. The forked feet stay.
- **16 px:** pale, thick, striped shins, where every other leg's shins are thin
  and dark. It's a value change and an outline change together.
- **Idle:** none. The whole leg swings from one pivot, so the coil can't squash
  on its own. The pose's crouch and lift do that job.

#### L7. Plumb Line (gold, anchor then snap)
*Card: Drop an anchor, then press again to snap back to it.*
- **Silhouette:** bare frame legs (the gold has dropped the family look) with a
  plumb bob hanging between them from a pelvis bar. It's the anchor he drops,
  and it hangs at knee height, the height pass 2's floor anchor hovers at.
- **Build:** frame-weight rods in DARK / SHELL (not BARE); a pelvis bar (rod
  r 0.03, hip to hip at y 0.98) in the legs **root**, so it doesn't swing; a
  pendulum group at `(0, 0.96, 0.02)` holding a line (rod r 0.008, 0.3 long)
  [PALE], a bob (a cone r 0.07, h 0.14 pointing down, under a half-sphere
  r 0.07) [SHELL], and an EYE tip (sphere r 0.025) at its point. Gold tags on
  both shins.
- **16 px:** a swinging weight between his legs with a lit tip.
- **Idle:** the pendulum lags the walk, a spring-damper on `rot.x` against his
  acceleration plus `0.2 × sin(bob)` on `rot.z`.
- **Live (rule 7):** hidden at the plant pose's stomp (k 0.4), shown again on
  the snap's arrival or when the anchor expires. You can see whether he's still
  carrying it.

#### L8. Borrowed Time (gold, boss only, rewind)
*Card: Rewinds you a moment and undoes the hits you took. Adds strain.*
- **Silhouette:** the Assembler's square sections (boss-only, like Through-Line)
  and clock wheels for knees. Clockwork that runs backwards.
- **Build (per leg):** thigh box 0.1 × 0.44 × 0.08 along hip → knee, shin box
  0.08 × 0.46 × 0.07 along knee → ankle [DARK]; foot box 0.08 × 0.05 × 0.28
  [SHELL]. The knee is a drum wheel: a cylinder r 0.12, h 0.07, axis x [SHELL],
  a PALE rim (torus R 0.12, tube 0.015) and 8 teeth. Small drum at the ankle
  (r 0.06, h 0.05). Gold tag above the ankle.
- **16 px:** big round knees (0.24 across, against the Lantern's 0.17 ball) on
  square legs. A drum still shows as a 0.24 × 0.07 bar when seen edge-on.
- **Idle (optional, +2 meshes):** the wheels tick **backwards** one tooth a
  second; during a rewind they spin back 3 turns over the 250 ms. The preview
  echo (0.14 ghost) wears the same legs.

---

### 3.5 Mixes to check

Any four parts have to look like one robot. These are the combinations most
likely to fail:

| mix | risk | what holds it together |
|---|---|---|
| Signal Flare + Lure + Plumb Line | 5 lights (lens, core, blinker, bulb, bob tip) | all small, all `EYE`, all out together on a Stop; two hide while their thing is out |
| Patient Lens + Lure | a big head on a big torso | both stay inside their envelopes |
| a frame head + Lure | a tiny eye on a lantern | intended: that's what an incomplete Still looks like |
| Through-Line + Borrowed Time | two square parts on a round robot | both are boss-only, so the square reads as "from the Assembler", a meaning, not a mistake |
| Anvil stance + Through-Line | the block over a long head | the block goes up the left side, the bore points forward: no overlap |
| Rusted Hook + Lure's rod | right side long, rod behind | the rod stays at z < −0.2, the hook at z 0.07 |

---

## 4. On the wall of parts

**Layout.** One peg per part, **in body order from the top**: heads on the top
row, then torsos, arms, and legs nearest the floor. The wall reads like a body's
worth of parts many times over, and a mix you're picturing is a vertical line
through it. In each row whites are on the left, blues in the middle and golds on
the right. Rows are centred (8 / 7 / 7 / 8), so the two shorter rows have no
empty peg at the end. Nothing on the wall is reserved for Yanah or Yuri.

**Scale and pegs.** Every part hangs at the same **1.25×**, so relative sizes
are true (legs really are bigger than heads). Each hangs **as worn**, facing the
room, from its own skeleton joint:

| slot | hangs from | looks like |
|---|---|---|
| head | a peg at the neck pivot | a lens on a stalk, tilted its 0.18 |
| torso | a peg through the back of the top ring | a cage on a nail |
| arms | a hanger bar through both shoulder pivots | a coat on a hanger: clamp left, hook right, as worn |
| legs | a bar through both hip pivots | a pair of legs with the toes toward the room |

The pitch is about 1.1 u, so the wall is about 9 × 4.5 u. If the room is
smaller, split it across two walls (heads and torsos, arms and legs) in the same
order. Walking up to the wall closes the dynamic zoom in, and at about 1.6× (37
px per u) the tags and rivets finally read. The wall is where the detail is for.

**States.**

| state | model | glass and core | extra |
|---|---|---|---|
| found | `STEEL`, lit by Grace's lamp: the one place his steel looks warm, because home is warm and he isn't | `DISPLAY_EYE`, dim cold | none |
| **unfound** | `BARE` | black (`EYE_OFF`) | the `OUTLINE` hull. The shape is there to be recognised later: a bare outline of exactly what drops |
| turned to the wall | as found, rotated π about the vertical at its peg: the lens faces the wall, the clamp swaps sides, the toes point in | off | none |
| worn right now | the peg is empty | | the empty peg is how you see what he's wearing from across the room (optional) |
| on the hook by the door | as found, at the same 1.25× | `DISPLAY_EYE` | none |

When he hangs a part on the hook by the door, the part lifts off his body onto
the hook, and his body shows the frame in its place until the run starts. For a
moment he visibly lacks it.

---

## 5. On the floor

The model replaces `chunkGeo` in `Loot.drop`. The beam (`beamGeo`, tier colour,
white 0.18 and blue/gold 0.34 opacity) and the disc stay as they are: **the beam
finds the part, and the model says what it is.**

- **Scale per slot**, so every drop is about 0.6 u across, a little bigger than
  worn, so it reads inside the beam: head 1.3×, torso 1.05×, arms 0.75×, legs
  0.6×. Floor scale is for recognising one part; wall scale (§4) is for
  comparing.
- **Orientation:** upright, as worn, inside a display group offset by minus its
  bounding-box centre, so it spins about its own middle rather than its pivot.
  It hovers at y 0.3 with a 0.08 bob and spins at 1.6 rad/s, as today's chunk
  does.
- **Flight:** during the 0.42 s pop out of the enemy it tumbles (a random spin),
  then lands upright with a small bounce. It reads as a piece of the enemy
  flying off.
- **Materials:** `STEEL` with its tier tag, plus a per-drop copy of
  `DISPLAY_EYE` for its glass or core. No emissive: the old chunk's tier
  emissive goes, and tier colour lives only in the beam and the disc. A gold
  part on the floor has a thin warm beam (as today) and cold steel.
- **Offered** (`under()` returns it and the card shows): its glass eases to
  `EYE_ON` over 0.15 s, the spin slows to a stop, and it turns to face Still.
  The part answers him. A head part literally looks at him. It's the moment the
  translator role asks for: taking this means losing the one you're wearing.
- **The swap:** the part he gives up drops at his feet as **its own model**, not
  a chunk, so you see the thing you left: the moth-and-flame choice made
  concrete. Optionally, the new part fits in: its root starts 0.08 u off its
  home and snaps in over 80 ms under the existing 1.12 scale punch.
- **Dispose:** only the beam, disc and per-drop glass materials. Geometry and
  `STEEL` are shared (§2.3).

---

## 6. `breakApart`, the ghosts, the decoy

### `breakApart` and `reassemble`

Each slot already flies apart as its own `Object3D`, so mixed parts come apart as
four different things, which is exactly the read. What changes:

1. **Homes come from the model** (§2.1). This is the one real bug waiting in the
   swap: `home` is filled once in the constructor, so a part picked up mid-run
   would reassemble at the origin.
2. **The resting height already works for any shape**: `breakApart` uses each
   part's bounding-box centre. Long parts (Through-Line's bore, Lure's rod) just
   rest lower and tumble more.
3. **Idle motion stops while broken**, except that Backdraft's fan coasts down
   over 1 s instead of stopping dead. Pendulums, bulbs and wheels freeze where
   they are.
4. **Frames fly too.** A run-1 Still breaks into one real part and three frames,
   and you see how little there was.
5. **The Workshop's Broken arrival** ("put back together on the bench", played
   backwards): record each piece's final transform, then ease each back to its
   home in the order legs, torso, arms, head, 0.25 s each with a click. Every
   mixed part is recognisable as it goes on. Nothing is lost: *the pieces all
   come home.*

### Ghosts (dash and hop afterimages)

`makeGhost` clones the group and sets one additive material on every mesh, so it
shows whatever mix he's wearing, frames included, with shared geometry.

- **Cost** drops with the merge: about 11 meshes per ghost instead of 31 (§2.2).
- Hidden sub-objects clone hidden. A ghost of him with the anchor out has no
  bob, which is correct.
- `makeGhost` must handle meshes whose material is replaced wholesale. With one
  material per mesh (§2.2), nothing else changes.

### Lure's decoy (N7)

- Clone **first**, then hide the body's bulb (T7). The decoy is him in his cast
  pose, lure lit; he walks away without it.
- If N7's "lit lens" is built, `makeGhost` keeps `EYE` on meshes whose material
  is `EYE` (the glass, the core, the one extra light) and ghosts the rest. The
  decoy's lights then go out on a Stop with his, which is right: it's him.

### Borrowed Time's echo (0.14)

`partfx.echo()` clones once and then only moves the clone, so it goes stale
after a swap and would show the old parts. It should rebuild whenever
`still.version` changes (§2.1). Every other ghost is cloned fresh, so only the
echo needs this.

---

## 7. How to check it

1. **A disposable page**, like `lineup.html`: all 30 on the wall in the real
   Workshop light, plus a "random Still" button that wears four random parts in
   a real dungeon room under the real grade, with the zoom locked at 0.7.
2. **The 16 px test, on the Poco.** For each slot, line up its parts in a row at
   the widest zoom. Someone who hasn't read this doc should be able to point at
   each one's §3 feature, and no two parts in a slot should be mistaken for each
   other.
3. **The frame test.** A run-1 Still (one part, three frames) at 16 px: do the
   frame legs still read as legs while he walks?
4. **The value test.** Screenshot a mixed Still, desaturate it, blur it by 2 px:
   are the four slots still four distinct masses?

---

## 8. Open questions for playtest

| # | question | fallback |
|---|---|---|
| Q1 | Does **Cracked Lens's** split glint read at 16 px, or does bloom heal the crack? | offset the halves further (0.06) and drop the wedge, making the glass two separate glints |
| Q2 | **Brace's X** over the core: does it read as "braced", or as "crossed out / disabled"? | move the X to the back only and put two vertical struts at the front |
| Q3 | **Frames on empty slots** (instead of today's bare Lantern pieces): does run 1 look exposed in a good way, or broken in a bad one? | frame rods back at Lantern thickness, still in `BARE` |
| Q4 | **One merged `STEEL` material**: today SHELL and SHELL_DARK differ in roughness (0.5 / 0.65) and metalness (0.55 / 0.45). Averaging them changes the Lantern's look a little | two steel materials (+4 meshes); still well under today's 31 |
| Q5 | **Five lights** (Signal + Lure + Plumb Line): charming or noisy next to the enemies' ember tells? | the Signal blinker blinks only while a mark is out |

---

## 9. Summary

- **One model per part, built as frame + shell.** The frame is the skeleton:
  the pivots and the handles every pose writes (neck and lens; rings and core;
  shoulders, elbows, hand, jaw origins and hook; hips and the bird bend). A part
  changes only the shape around it, so every existing pose works unchanged. An
  empty slot draws its frame in `BARE`, so filling a slot adds mass.
- **Tier is distance from the family look.** Whites are plain salvage (three of
  the four starters are the Lantern pieces untouched; Scrap Cleaver adds a
  blade). A blue is its parent's model plus one named twist. A gold keeps only
  the frame and becomes a named oddity. Boss-only golds use the Assembler's
  square sections. The tier tag is a thin, non-emissive band in a fixed place
  per slot; gold's is grey-brass, so no gold glows warm on the body.
- **One robot in any mix**, held by one palette painted per vertex (dark
  structure, mid working parts, pale only for polish or frost, never warm),
  shared joints and rivets, envelopes per slot, left clamp / right hook, and at
  most one extra `EYE` light per part.
- **Every part has one feature that reads at 16 px**: a lit point, a value
  change, or an outline change of at least 0.2 u. Each is tied to its card line.
  Four parts have idle motion that says something (Patient's pupil opens with
  charge, Signal's blinker, Backdraft's fan, Lure's bulb and Plumb Line's bob
  swinging, then hidden while their thing is out), and two more are optional.
- **Cheaper than today.** Merged geometry takes Still from 31 draw calls to 11
  (15 at worst), and a dash's afterimages from about 280 to about 100-135.
- **Wall:** body order top to bottom, 1.25× true scale, hung from each slot's own
  joints; unfound parts are `BARE` plus an outline hull; turned parts face the
  wall. **Floor:** normalised to about 0.6 u in the tier beam, lights up and
  turns to face Still when offered, and the part you give up drops as itself.
- **What the build must fix:** register homes per model (or a swapped part
  reassembles at the origin); stop `Loot.dispose` disposing shared materials;
  rebuild Borrowed Time's echo on a swap; clone Lure's decoy before hiding the
  bulb.
