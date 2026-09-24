# Charger and swarm: presentation (Translator pass)

Pass 2 of 3. The Balancer's mechanics and numbers (`1-balancer.md`) are settled.
This pass covers what the two archetypes look, move, sound and read like on a
6-inch landscape phone at the fixed 38° iso camera. Every recipe builds on what
is in `src/` today: the hulk's rig and `strikePose` easing (`enemy.ts`), the
sentinel's two-stage aim line (`ranged.ts`), the Assembler's charge, stun and
open grill (`boss.ts`), `vfx.ts` pools, `tellMaterial`, and the `audio.ts`
voices. Anything new is listed in §1.3 and named where it is used.

Two presentation-only proposals here touch timing or drawing, not the
mechanics. Both are flagged and both have fallbacks: the **lane wash** (§4.1,
drawing the lane to Still's centre-hit edge) and the **skid ease** (§3.1, the
last 1.5 u of an open rush).

---

## 0. Names and flavour

| code `kind` | in-world name | one-line flavour |
|---|---|---|
| `charger` | **ram** (in full: a *boiler ram*) | A boiler on four legs with a plough for a face. It only knows one direction, and it takes its time choosing it. |
| `mite` | **swarf mite** (swarf: the curls of metal a lathe throws off) | Filings the foundry swept out, that learned to walk. One of them is a nuisance. |
| brood (the invisible coordinator) | **the brood** | Nobody has seen the brood. You only see where all of them are looking. |
| swarm elite leader | **brood-mother** | The one light in the swarm that never dims. |

**Elite names.** Keep `dungeon.ts`'s `FIRST + SECOND + title` generator. Add
one archetype pool for each new leader so the name hints at the body. Draw half
of the time from the shared `SECOND` list and half from the archetype pool.

| leader | extra `SECOND` pool | examples |
|---|---|---|
| ram | `horn`, `brow`, `skull`, `hoof` | *Cinderhorn the Plated*, *Rustjaw the Quick*, *Grimbrow the Many* |
| brood-mother | `mother`, `nest`, `hive`, `brood` | *Ashmother the Warden*, *Palehive the Quick* |

**Elite lines** (`ELITE_LINE`, shown under the name). Where the meaning changes
for these archetypes, the line changes with it:

| leader + mod | line |
|---|---|
| ram, Quick | its whole pack moves fast (unchanged) |
| ram, **Plated** | **takes half damage, until it hits a wall** (this teaches the plate lift) |
| ram, Many | breaks into two when it falls (unchanged) |
| ram, Warden | its pack takes little damage while it stands (unchanged) |
| brood-mother, Quick | **her whole brood moves fast** |
| brood-mother, Warden | **her brood takes little damage while she stands** |

**Label height.** `drawEliteLabels` puts the label at `2.3 × size`. That is
right for a hulk and floats 2.9 u over a 0.3 u mite. Use a per-kind label height
of `(model height + 0.8) × size`: ram `2.0 × size`, brood-mother `1.1 × size`.

---

## 1. Grammar check (enemy side of the parts pass §1)

### 1.1 How these two obey G1–G8

| rule | ram | swarm |
|---|---|---|
| G1 colour | every tell, spark, trail and glow is ember (`EMBER`, `EMBER_DEEP`, `CORE`). No gold, no cold | same |
| G2 enemy tells **fill** | locked lane: the core strip fills from its body to the end over 405 ms. Tracking: the spine seam fills rear to front | bite ring: the disc fills a fixed ring over 550 ms (the hulk's clock) |
| G3 ripples outward | the strip chevrons flow **away from the ram**, toward the end (the shader already does this) | radial ripples outward (unchanged shader) |
| G4 heat rises | stack embers rise during the windup. Its last breath on death is smoke rising | the brood's end: an ember column rising from the last mite |
| G5 floor = future, body = present | lane, end mark, wall mark: floor. Stun "open to hits", Plated lift, Warden seal: body | ring: floor. Crouch, spent dimming, seal: body |
| G7 motion under 0.5 s | trample shove: motion, dust and a spark only. No badge | a flung mite tumbles. No badge |
| G8 lasting things end with a snap | the stun ends with the hatch **slamming** shut (sound and sparks) | the spent clump's cores flick back to full at the end of recover (visual only) |

### 1.2 One honesty rule for every tell (proposal)

Today the ring tells (hulk, and the new bite ring) hit when **Still's centre**
is inside the drawn edge. The Balancer's lane hits when Still's centre is within
`laneHalf + 0.42` of the line, which is his **body** overlapping the drawn
0.7-half lane. On screen those are two different rules: "feet on the ember" for
rings, "any part of you touching it" for lanes. Still's bird legs and 0.23-wide
cage are narrower than his 0.42 hit radius, so a player whose feet are 0.3 u
outside a 0.7-half lane gets hit. It is the boss's lie again, only smaller.

**Rule R: every tell is drawn out to where Still's centre gets hit.** In words
the player can hold: *if your feet are on ember, you're hit.*

- Rings: already true (hulk 2.4, bite ring 1.0).
- Ram lane: a bright **core** at the ram's real width (half 0.7) plus a faint
  **wash** out to the centre-hit edge (half 1.12). The rails sit on the wash
  edge. Numbers are unchanged: this is drawing only (§4.1).
- The Assembler's charge (Balancer §11 #1): with his first fix (body-overlap
  lateral < 1.57), draw it the same way: core half 1.15, wash half 1.57. Depth 2
  teaches depth 3, so the two lanes must look like the same thing at two sizes.

**Fallback** if the wash reads as soft glow rather than danger in playtest
(Q1): draw the full 2.24 width as one strip, with the ram's body width as a
brighter centre stripe.

### 1.3 New primitives this pass needs

| id | what it is | used by |
|---|---|---|
| **E1** | `lane` tell: a group of rails (2 × strip 0.08 wide), wash (strip 2.24), core (strip 1.4, fill by `scale.z`), and an end mark (skid streaks **or** wall star, §4.1). Unit-length strips scaled to the lane length each tick | ram (and a later redraw of the boss charge) |
| **E2** | `biteRing`: 4 arc meshes `RingGeometry(0.88, 1.0, 10, 1, 0, arc)` and a fill disc `CircleGeometry(1.0, 32)` under one `tellMaterial('radial', 1.0)` pair, owned by the brood, in world space at L | brood |
| **E3** | `seamGlow`: a flat additive plane (0.42 × 1.0) lying on the ram's back, using the sentinel's halo canvas texture, its opacity driven by the windup | ram |
| **E4** | per-brood **shared core materials** by role (`inner`, `outer`, `surge`, `spent`, `asleep`, `sealed`), each a `MeshBasicMaterial` + `SpriteMaterial` pair. A mite swaps material references when its role changes. One uniform write lights 4 mites at once | swarm |
| **E5** | a live pan handle: windup and rush voices return `{ stop(), pan(p) }` instead of a bare stop, so a sound can follow its source across the screen | ram rush, brood skitter |
| **E6** | *(optional)* **husk**: on kill, the body's group is kept for 350 ms after logic ends, playing a collapse, then the kill burst fires. Today kills are instant (`dispose` then VFX). Only the ram uses it (a mite husk costs too much at 8 per press). The hulk can adopt it later | ram death |
| **E7** | voice limiter: a per-name minimum gap and a per-window cluster merge in `audio.ts`, the way `hit()` already refuses repeats inside 22 ms | mite pop, trample clank, skitter |

---

## 2. Look

Screen scale, for every size decision below: `viewHeight` is 17 u, and the
Poco's landscape viewport is about 400 CSS px tall, so **about 23 px per unit at
zoom 1 and 16 px at the widest zoom (0.7)**. 1 px is about 0.17 mm.

| body | footprint (w × l) | height | on screen at zoom 1 / 0.7 |
|---|---|---|---|
| Still | 0.6 × 0.5 | 1.9 | tall and thin |
| hulk | 1.3 × 0.9 | 1.5 | 30 × 35 px / 21 × 24 px, a tall blob |
| tripod sentinel | 1.6 × 1.6 (legs) | 1.7 | a spider of lines |
| **ram** | **1.0 × 1.9** | **1.0 (stack 1.25)** | **44 × 23 px / 30 × 16 px, a long low wedge** |
| **swarf mite** | **0.76 × 0.65** (legs) | **0.3** | **17 × 15 px / 12 × 10 px, plus a 13 px glow** |

### 2.1 Ram

**Silhouette idea.** A rusted boiler lying on its side on four short piston
legs, with a cowcatcher plough for a face, two bare-iron tusks, and one stack at
the back. The hulk is taller than it is wide, has no top feature and glows on
its chest. The ram is **twice as long as it is tall**, and its brightest mark is
a **line of light along its spine** that points exactly where it will run. From
38° the top of a body is what you see, so the direction lives on its back.

| cue | hulk | ram |
|---|---|---|
| aspect | tall and round | long and low (1.9 × 1.0) |
| top view | a yoke and two shoulder balls | spine seam (a line) + stack (rear) + tusks (front): an arrow |
| core | a box on its chest | the seam on its back and a visor slit on its face |
| gait | 2 legs, alternating | 4 legs, diagonal pairs (a trot) |
| tell | a ring round itself | a lane away from itself |
| sound | low ratchet crank | engine rev, then a heavy latch |

**Materials.** `mat` (`BODY 0x5b3b35`, roughness 0.7, metalness 0.45), `jointMat`
(`JOINT 0x2b2426`), `coreMat` (`CORE 0xff5a3c`, basic), 5 × `seamMat` (basic,
one per seam segment). One new colour in the same family: **`worn 0x8a6a5a`**
(roughness 0.5, metalness 0.6), bare iron where it hits things, used on the
plough's lip and the tusks. It catches Grace's light, so the business edge
glints.

**Hierarchy.** Local +z is forward. The group origin is on the floor at the
centre of its hit circle (r 0.6).

```
group                              rotation.y = facing
├─ body        Group (0, 0.55, 0)       pivot: boiler centre. rx = pitch (+ nose down), rz = roll, scale = squash
│  ├─ boiler   Cylinder(rTop .40, rBot .46, len 1.25, 12)  rx +PI/2 (axis along z, narrow end forward)  z -0.05   mat
│  ├─ band ×2  Torus(.45, .04, 6, 18) at z -0.45 and +0.30                                                     joint
│  ├─ firebox  Box(.50, .04, .62) at (0, .42, -.12)          the core: hidden under the hatch, seen in a stun  coreMat
│  ├─ hatchL   Group pivot (-.30, .46, -.12)  hinge along z; open = rz +1.2
│  │  └─ plate Box(.20, .045, .64) at (+.10, 0, 0)          spans x -.30…-.10                               joint
│  ├─ hatchR   mirror: pivot (+.30, .46, -.12), plate at (-.10, 0, 0), open = rz -1.2
│  ├─ seam ×5  Box(.12, .04, .11) at y .48, z = -.40, -.27, -.14, -.01, +.12 (rear → front)                   seamMat[i]
│  ├─ seamGlow Plane(.42 × 1.0) flat at (0, .50, -.14), additive halo texture (E3)
│  ├─ stack    Group (0, .38, -.55), rx -0.35
│  │  ├─ pipe  Cylinder(.08, .10, .34) at y .17                                                               joint
│  │  └─ lip   Cylinder(.11, .11, .05) at y .34   (ember spawn point: the mouth)                              mat
│  └─ prow     Group pivot (0, -.05, .58)   front face of the boiler, low. rx = head (+ down), ry = shake
│     ├─ plough Box(.96, .52, .22) at (0, 0, .12), rx -0.35 (bottom edge forward: a cowcatcher)             mat
│     ├─ lip    Box(1.0, .08, .12) at (0, -.26, .24)                                                       worn
│     ├─ visor  Box(.46, .05, .03) at (0, .12, .215)        ember slit, seen when it faces the camera       coreMat
│     └─ tusk ×2 Cylinder(.02, .07, .42, 6) at (±.36, -.08, .36), rx PI/2 - 0.2 (forward, a little up)      worn
└─ leg ×4      Group at (±.36, .42, +.38 front / -.42 back).  rx = swing, rz = splay
   ├─ thigh    Cylinder(.11, .09, .26) at y -.13                                                              joint
   ├─ shin     Cylinder(.08, .10, .18) at y -.30                                                              mat
   └─ hoof     Box(.24, .10, .28) at (0, -.37, .04)          bottom at y 0                                   mat
```

About 24 meshes, the same as a hulk. The tusk tips reach z +1.15, so the body
overhangs its 0.6 hit circle by 0.2 behind and 0.55 at the thin tusks. The hulk's
fists overhang the same way.

**Awake at rest.** Seam segments at 20% (`CORE × 0.2`), visor at `CORE`,
firebox dark under the closed hatch, `seamGlow` at 0.

**Asleep.**

| part | pose |
|---|---|
| body | `y 0.40` (belly on the floor), `rx +0.06` |
| legs | front `rx +1.1` (folded under), back `rx -1.1` |
| prow | `rx +0.30`: chin resting on the floor |
| colour | `SLEEP_BODY` tint as the hulk, seam, visor and firebox `CORE_ASLEEP 0x2a1512` |
| life | breathing: `body.scale.y` 1 → 1.02 at 0.3 Hz. **A banked fire:** one thin grey `smokePuff` from the stack every 2.5 s (± 0.8 s). You can spot a sleeping ram across a room by its wisp, which says "asleep, not scrap" |
| waking (250 ms) | legs unfold, body rises to 0.55, 3 stack puffs, the seam flickers once rear to front (50 ms per segment), then `onWake`'s embers and alert as today |

### 2.2 Swarf mite

**Silhouette idea.** A flat iron tick: an oval dome, six leg ticks, two small
mandibles, and one ember dot on its back with a soft glow. At 12 px the body
is a smudge; **the glow is the mite**. Eight glows in two rings that turn
opposite ways are what you count. The body only has to say "small, low, many
legs" when you look straight at one.

**Readable, not noise:** fixed spacing of 0.6, two rings of at most 4 turning
opposite ways (Balancer §3.3), **one shared heartbeat** per brood (below), no
tell of their own, no footstep of their own. The eye groups them as one thing
with parts, not as sixteen things.

**Materials.** Per mite: `shellMat` (`BODY`, roughness 0.45, metalness 0.6, a
little shinier than the hulk so the dome catches a highlight on dark stone; per
mite because hit flash matters when every mite dies to two autos). Per brood,
shared: `jointMat`, and the E4 core/halo pairs.

```
group                                  origin on the floor, rotation.y = facing
└─ body     Group (0, .12, 0)             rx = pitch (+ nose down), scale = crouch
   ├─ shell Sphere(.27, 10, 6, 0, 2PI, 0, PI/2), scale (1, .62, 1.2)   dome .54 w × .65 l × .17 h   shellMat
   ├─ belly Cylinder(.25, .21, .07, 8) at y -.02                                                          joint
   ├─ core  Sphere(.075, 8, 6), scale (1, .6, 1.3) at (0, .155, -.04)                                     brood core [role]
   ├─ halo  Sprite, scale .55, at (0, .20, -.04)                                                          brood halo [role]
   ├─ jawL / jawR  Group at (±.07, 0, .30); child Box(.045, .04, .15) at (0, 0, .07). rest ry ∓0.25, open ∓0.55  joint
   └─ legsL / legsR  Group at (±.18, 0, 0); ONE merged geometry each: 3 × Box(.20, .03, .035) centred x ±.10,
                     z -.13 / 0 / +.13, yawed ∓.35 / 0 / ±.35, tips tilted down to the floor. rz = rock          joint
```

7 draw calls per mite (legs merged with `mergeGeometries`, geometries shared at
module level). 16 mites (two broods) come to 112 calls. If the Poco drops
frames, the fallback is one `InstancedMesh` per part per brood (7 calls a brood),
at the cost of per-mite flash (a scale pop replaces it).

**Core roles (E4).** One set per brood. The heartbeat multiplies every role:
`× (0.85 + 0.15 sin(2π f t))`, with `f = 1.1 Hz + 0.25 × broodIndex`. Two broods
in one room visibly pulse out of step, so you can tell which mites belong
together without any line between them.

| role | core colour | halo opacity | when |
|---|---|---|---|
| `inner` | `CORE` | 0.9 | orbiting at 1.8: the four that will bite |
| `outer` | `CORE × 0.55` | 0.45 | orbiting at 5.5: waiting |
| `surge` | `CORE → 0xffc890` over the 550 ms | 0.9 → 1.0, halo scale 0.55 → 0.8 | joined a surge |
| `spent` | `CORE × 0.3` | 0.15 | recover (800 ms): the punish window |
| `asleep` | `CORE_ASLEEP` | 0 | in the nest |
| `sealed` | `JOINT` (an iron lid over the dot) with a hairline `CORE × 0.4` rim | 0 | warded by a Warden brood-mother (§7) |

The refill (an outer mite taking an empty inner slot after 500 ms) is visible
for free: its glow brightens as it swaps `outer` → `inner` on the way in.

**Asleep: the nest.** Mites 0.6 apart within 1.4 of the pack spot, legs tucked
(`legs rz` folded up 0.6, `body.y 0.06`), cores and halos off (`asleep`), and a
staggered breath (`body.scale.y` 1 → 1.04 at 0.4 Hz, each mite phase-offset by
its index), so the nest shimmers faintly and reads as alive. **Waking:** the
cores light in a ripple from the nest's centre outward over 150 ms. It is the
first sign that there is one mind.

### 2.3 Brood-mother (swarm elite)

The mite at `size 1.28` (hit radius 0.4 per Balancer §5), plus:

| part | spec |
|---|---|
| sac | `Sphere(.16, 10, 8)`, scale z 1.35, at (0, .08, -.30): a raised abdomen with its **own** core material, `CORE`, never on the brood's roles |
| spines | 3 × `Cone(.03, .12, 5)` on the dome ridge at z -.10 / .02 / .14, y .17. Joint |
| halo | scale 0.8, on the sac |
| pulse | the sac beats with the brood's heartbeat at double depth (`0.7 + 0.3 sin`) |

She is always one of the four biters (Balancer §5), so she is always in the
inner ring, bigger and brighter than the three next to her.

**Aura.** `crown()` draws a `RingGeometry(0.9, 1.15)` whatever the body. For
her, scale the aura to `(radius × size + 0.1) / 0.9`, giving 0.68–0.87, so it
hugs her and doesn't overlap the biters beside her in the recover clump. The
same formula leaves a ram at 0.96–1.23, close to today's.

---

## 3. Animation

All poses are eased targets, like the hulk's `strikePose`:
`p += (target - p) × min(1, dt × 14)`, snapped (`k = 1`) where a row says
**snap**. `bob` advances `dt × 5` for the ram (as the hulk) and `dt × 12` for
mites. The tables use the notation from the parts pass: `body.rx` is
`body.rotation.x` and so on. `grp` is the enemy's `group`, and group offsets are
visual only, never `pos`.

### 3.1 Ram

| phase (Balancer §2.2) | ms | pose target / per-frame motion | other |
|---|---|---|---|
| **approach: walk** (3.8 u/s) | – | trot: `legFL.rx = legBR.rx = sin(bob·1.8)·0.40`, `legFR.rx = legBL.rx = −that`. `body.rz = sin(bob·1.8)·0.04`. `grp.y = abs(sin(bob·1.8))·0.04`. `prow.ry = sin(bob·0.9)·0.05` (the head swings) | one smoke puff from the stack every 0.8 s. `gait = bob·1.8` (one step a diagonal pair) |
| **approach: back off** (3.0 u/s, facing Still) | – | the trot played backward (negate the sine), `prow.rx +0.10` (head low, watching) | this is the hug warning: it is making room. At 1000 ms it winds up wherever it is |
| **approach: hold in band** | – | legs still, `body.scale.y` 1 → 1.02 at 0.8 Hz (breathing), turns to face at the walk's turn rate | – |
| **windup: tracking** | 0–495 | `body.rx → +0.12` (rear up, nose down), `grp.y → −0.08`, `prow.rx → +0.10`. **Pawing:** `legFR.rx` kicks −0.6 and back at 80 ms and at 300 ms (60 ms each way), each kick with a 3-puff dust at the hoof. **Shiver:** `grp.x += sin(t·60)·0.01·k`. Yaw follows Still every tick | **the seam fills**: segment *i* lights (seamMat `CORE × 0.2` → `CORE`) at `(i+1) × 99 ms`, rear first. `seamGlow` opacity `0.35 × k`. 1 stack ember per 90 ms |
| **LOCK** | 495 | **snap, one frame:** `prow.rx +0.28` (head drops), `body.scale (1.02, 1.04, 0.94)` (coiled), `grp` offset −0.08 along −aim (rocks back on its haunches), back legs `rx −0.35` (braced). Yaw stops, with the lane | the seam flashes white (`0xffe0b0`) and settles to `CORE` over 100 ms. `seamGlow` 0.8. The stack spits 4 embers + 1 smoke |
| **windup: locked** | 495–900 | hold. Shiver rises to 30 Hz at 0.012. Nothing else moves | this stillness is the tell: tracking fidgets, a locked ram is frozen |
| **strike: rush** (18 u/s) | 0.33–0.61 s | gallop: pairs swing `±0.70` at 14 Hz. `body.rx +0.14`, `body.scale (0.98, 0.97, 1.06)` (stretched), `prow.rx +0.28` held | trail and dust, §5.1. `knockMul` 0 shows as nothing moving it |
| **skid** (the last 1.5 u of an open rush, see note) | ~120 | **snap** front legs `rx −0.60` (braced forward), back legs `+0.3`, `body.rx −0.18` (rear sits down), `prow.rx −0.05` (head up) | sparks from the front hooves, grinding, §5.1 |
| **recover after a miss** | 900 | 0–250: hold the braced pose, easing out. 250–750: turn to face Still (yaw lerp at 5 rad/s), two hoof steps. 750–900: one head shake `prow.ry ±0.10` | seam fades to 20% over 300 ms |
| **wall impact** (→ stun) | frame 0 | **snap** `body.scale (1.1, 1.1, 0.80)`, then spring back with one overshoot over 200 ms. `prow.rx −0.25` (the head snaps up from the blow), `body.rx +0.30` settling to +0.18 (rear up, nose wedged in the wall) | §5.2 |
| **stun** (open to hits) | 1200 | hatches open to ±1.2 over 120 ms, ease-out-back. Legs splay `rz ±0.30`. **Dazed:** `prow.ry = sin(t·44)·0.12·(1 − t/1.2)`. Firebox pulses `scale 1 ± 0.25` at 9 Hz (the boss's rule). Last 400 ms: the hatches sink from 1.2 to 0.8, the window closing | **snap at 1200:** the hatches slam to 0 with a clank and 4 sparks (G8) |
| **recover after a stun** | 400 | `body.rx → 0`, pull back from the wall (the rear drops), turn toward Still | – |
| **trip** (Frost Trail) | 1200 | `prow.rx +0.50` (nose digs in), `body.rx +0.45` then drops back over 300 ms. Parts pass: a quarter-turn spin (`grp` yaw +PI/2 over 250 ms), rime (N4b). **The hatch stays shut** | shut hatch = normal damage. Only a stun opens it (§4.4) |
| **reload** | 700 | walk poses. Seam at 20% | – |
| **stagger** (slide > 1.5 u/s) | 200–380 | `body.rx −0.15` (tips back), dust at the hooves, cold sparks at the contact (parts §3) | – |
| **Parry cancel** | – | N9 on the lane (§4.1), all seam segments snap dark, `prow.rx −0.2` (flinch), stumble back as the parts pass says | – |
| **death** | 350 (E6) or 0 | husk: legs buckle outward (`rz ±0.8`), `body.y` 0.55 → 0.25 over 150 ms, `body.rx +0.2`, seam and visor flare white and go dark at 200 ms, then the burst (§5.3). **Killed mid-rush:** the husk slides on 1.5 u, easing out, spraying hoof sparks, and bursts where it stops. Without E6: the burst alone, as the hulk | – |

**Note on the skid ease (presentation proposal).** At 18 u/s the last 1.0 u
passes in 55 ms, too short to see a skid. Easing speed from 18 to 6 u/s over
the **last 1.5 u of an open-ended rush only** (never when the lane ends at a
solid) gives a 120 ms skid. The length and the hit are unchanged. Still at the
lock distance is 3.5 u before the end, so the ease starts 2 u past him and never
changes contact timing. The rush gets about 40 ms longer, and the cycle goes
from 3.0 to 3.04 s. **Fallback:** keep the speed constant and play the braced
pose and sparks over the first 250 ms of recover.

### 3.2 Swarf mite

| phase | ms | pose / motion | other |
|---|---|---|---|
| **approach: stream** (far, > 6 u) | – | scuttle: `legsL.rz = sin(bob·2)·0.35`, `legsR.rz = −that`. `body.y = 0.12 + abs(sin(bob·2))·0.02`. Yaw jitter ±0.06 (hash noise per mite). `jaw.ry` flutter ±0.1 at 6 Hz | faces its direction of travel: in corridors they read as a column |
| **approach: orbit** | – | the same scuttle, but **faces Still while moving sideways** (crab-walk) | a ring of faces all turned inward reads as "circling you" |
| **windup** (surge, 550) | 0–80 | **snap-turn** to face L (the ring's centre). Every biter points at the same spot | E4: role → `surge` |
|  | 80–450 | crouch: `body.y → 0.08`, `body.scale (1.1, 0.75, 1.1)`, `body.rx → −0.30` (rear up), jaws open to ∓0.55, legs splay out 0.3. Tremble 40 Hz at 0.01 | – |
|  | 450–550 | coil: `body.y → 0.06`, `scale.y → 0.68` | – |
| **strike: lunge** (150) | 0–150 | presentation curve: **ease-out quartic**, so 80% of the distance is covered in the first 50 ms. Hop `grp.y = 4h·u(1−u)` with h 0.35. `body.rx +0.40` (diving). **Jaws snap shut at 50 ms** | the damage lands on the 550 tick (Balancer). With this curve the bodies arrive within 50 ms of the hurt, which reads as simultaneous. A linear lunge would bite from 1.4 u away |
| **recover** (the clump, 800) | – | flattened: `scale.y 0.80 ± 0.03` at 3 Hz (panting). Jaws shut, legs still | role → `spent` (dim). One smoke mote rises from the clump every 200 ms: the heat coming off them. **At 800:** cores flick back to `inner` in one frame (G8) |
| **regroup** (500) | – | scuttle back to slots by bearing | – |
| **Parry cancel** (during windup) | – | its arc in the ring shatters (N9), its core blinks dark 0.2 s, it hops back 0.4 u | role → `inner` |
| **stagger / flung** (Vent, trample) | slide time | **tumble:** `body.rx` spins one full turn over the slide, landing with 1 dust puff | no sparks. With 8 mites flung at once the tumble is enough |
| **death** | 0 | pop (§5.4). No husk | – |

### 3.3 Brood-mother

Same as a mite, plus: her sac swells 1.0 → 1.25 through the surge windup and
releases at the lunge, and in recover her sac stays bright (only the shell core
dims), so she is the obvious target in the spent clump. Under a Quick mod her
legs are longer (leg boxes 0.26) and her scuttle runs at `bob·2.6`.

---

## 4. Telegraphs

### 4.1 The ram's lane: track → lock → rush

All pieces are E1 strips in the ram's `tellGroup` (world space, positioned at
`pos`, rotated to `aim`). Length `L = clamp(d + 3.5, 6, 11)`, cut at the first
solid by `clampMove(r 0.6)`, exactly the Balancer's rush length. The lane starts
**under its body** at `pos`, because the swept segment starts there.

| piece | width | tracking (0–495) | locked (495–900) | rush | after |
|---|---|---|---|---|---|
| **rails** (2) | 0.08 each, centred at ±1.12 (the centre-hit edge) | opacity 0.30. Length re-computed every tick. The far end is **open**: the last 0.6 u fades out | **snap** to 0.70 and hold | 0.70 | fade `dt × 5` |
| **wash** | 2.24 (half 1.12) | 0 | **snap** to 0.18 | 0.30 | fade |
| **core** | 1.4 (half 0.7 = `laneHalf`) | 0: no fill yet | **fills** from the body to the end: `scale.z = (t − 495)/405`, opacity 0.55. The chevrons flow toward the end | 0.90, full length | fade |
| **end mark** | – | none | **stamps** at lock (opacity 0 → 0.9 in 40 ms, settling to 0.6) | 0.9 | fade |
| **burn-off** | – | – | – | everything behind the ram's current position is cut: the tell group's origin follows `pos` and `L` shrinks to the remaining length | – |

Tracking only ever shows the **rails at their true width**. The Balancer's
"faint and narrow" would put a 0.6-wide strip on the floor, which is the
sentinel's aim line (0.62). Faint rails at 2.24 can't be mistaken for it, and
the width you see at tracking is the width that locks.

**The end mark says how the rush ends** before it happens. This makes the
matador rule visible:

| lane ends | mark | reads as |
|---|---|---|
| in the open | two skid streaks (strips 0.12 × 1.2 at x ±0.35) ending at `L`, and a half-disc wash (r 1.12) past the end | "it skids to a stop here" (recover 900, normal damage) |
| at a wall, column or unbreakable prop | a **wall star**: a `radial` disc r 0.7 at the contact point with 6 thin spikes (0.9 long) splayed back from the wall, **plus a bar on the wall top** (strip 1.4 × 0.12 at `y = wallHeight + 0.02`) so a wall that hides the floor from the camera still shows it | "it gets stuck here" (stun 1.2 s ×1.5) |
| at a crate or barrel | the wall star, on the crate | "it breaks this and gets stuck" |

During the locked phase the lane keeps its locked direction and length but
moves with the body (a Vent shove along its own lane, Balancer §1). Recompute
the cut and the end mark every tick. A ram shoved 2 u back from a wall turns its
star into skid streaks, and the player sees his Vent turn a stun into a miss.

**Lock, seen:** rails snap bright, the wash appears, the core starts filling,
the end mark stamps, the body snaps head-down and stops tracking. That is five
signals on one frame. **Lock, heard:** the rev stops climbing and the latch
clunks (§6.1).

**Camera.** While a ram is locked or rushing, pass the lane's end point to
`rig.update` as an extra threat (Balancer §2.6), so an 11 u lane never ends off
screen.

**Many split rams** (lane half 0.55): core 1.1, wash and rails at ±0.97.

**Parry cancel / Frost trip:** N9 on the whole lane: all pieces to 0 at once and
16 cold sparks strewn along the rails. The windup voice is hard-cut.

### 4.2 The bite ring (brood)

Owned by the brood, at L, drawn **only while a surge is winding up or striking**.
No mite ever draws a tell of its own.

| piece | spec |
|---|---|
| **arcs** | one per biter (1–4). Arc length `2π/n − 0.35` rad, each centred on the bearing **from L to its biter**. So the ring comes in as many pieces as there are jaws, and each piece is on the side its jaw is coming from |
| **fill disc** | `scale = t/550`, opacity 0.30. The hulk's clock, at 1.0 |
| **stamp** (surge start = its lock; its ring is fixed from the start) | arcs pop opacity 0 → 0.9 in 50 ms, settle to 0.5. 6 ember sparks thrown outward off the edge at speed 2. **No scale change**: a shrinking ring is Still's grammar (G2) |
| **strike frame** | arcs 0.95, disc 0.80, then fade `dt × 4` (as the hulk) |
| **a biter lost mid-windup** (killed, Parry, trampled out of 2.8) | its arc shatters on the spot (N9 for a Parry, an ember crumble for a kill). The ring honestly shows the new damage |

**Reading the damage from the shape.** A ring in four pieces bites for 12, in
two pieces for 6. The player never needs the number, only "more pieces, more
hurt". It also separates the bite ring from the hulk's at a glance:

| | hulk ring | bite ring |
|---|---|---|
| radius | 2.4 | 1.0 |
| where | round the hulk's own body | on empty floor near you, usually under you or just ahead |
| edge | whole | 1–4 separate arcs, each pointing at a crouched mite |
| clock | 520 ms | 550 ms |

The lead (the ring is where Still is going, 0.45 s ahead) is the lesson. The
first time it lands in front of a running Still, the player learns "turn, don't
run" from the picture itself.

### 4.3 Tells in a crowd

| rule | detail |
|---|---|
| **Soonest on top** | every tell's `renderOrder = 1000 − msToStrike/10`, set each tick. The one about to land is never drawn under a fainter one |
| **Tracking gives way** | while any tell is locked, other tracking tells (ram rails, sentinel line before its lock) draw at 60% of their opacity |
| **Widths never collide** | sentinel line 0.62 · ram core 1.4 / wash 2.24 · boss 2.3 / 3.14 (with §1.2) · Frost Trail 1.4 but cold, faceted and **static**. The one near-match (ram core and Frost Trail, both 1.4) differs in colour, motion and edge |
| **Lock book** | Balancer §4.1: committed locks ≥ 300 ms apart. So there is never more than one stamp and one latch per 300 ms |

### 4.4 The stun, and Plated's plate lift

"Open to hits" is **on the body** (G5), and it is the same sign for every ram:

| state | hatch | firebox | hits sound | damage |
|---|---|---|---|---|
| normal, trip, recover | shut | hidden | normal `hit()` | ×1 |
| **stunned** | open ±1.2, sinking to ±0.8 in the last 400 ms | pulsing 9 Hz, sparking | `hit()` + **the open ring** (§6.1) | ×1.5 |
| Plated, normal | shut, and 3 flank plates per side lie flat | hidden | **dull**: `hit()` at 0.7 + `blocked()`'s `generic` sample | ×0.5 |
| **Plated, stunned** | hatch open, **and the flank plates flare out** `rz ±0.6` over 120 ms with a clank | pulsing | the open ring, louder (×1.3) | ×1.5 of full |

The **rule the player learns:** *open hatch = hit it now.* A Frost trip keeps
the hatch shut on purpose (Balancer: trip is a stop, no ×1.5), so the body tells
you which kind of stop you got.

---

## 5. VFX

Counts are per event unless marked per tick (1/60 s). Colours: `EMBER`, `STONE
0x5a5550`, `RUST 0x5b3b35`, `WOOD` as in `main.ts`. The "shake" column feeds
`shake = max(shake, x)`, and the others for scale are hit 0.1, kill 0.28, hurt
0.5, boss clang 0.6.

### 5.1 Ram: windup, rush, trample, skid

| event | effect | shake / hitstop / punch |
|---|---|---|
| paw (×2 in tracking) | `dust(hoofFR, 3, 0.3, speed 2)` | – |
| tracking | `embers(stackMouth, 1, 0.1)` every 90 ms (replaces the hulk's windup embers in `ambientFx` for this kind) | – |
| lock | `embers(stackMouth, 4, 0.15)` + `smokePuff(stackMouth, 1)` | `rig.punch(0.01)` |
| **rush start** (`strikeFx`) | `dust` 12 at the rear hooves, radius 0.6, speed 5 (kicked back). `sparks(rearHooves, EMBER, 8, 6, −aim, 0.6)`. `flash(prow, EMBER, 0.6)` | 0.12 / – / – |
| **rush, per tick** | `trail(stackMouth, EMBER, 0.22)` every tick. `dust(rearHooves, 1, 0.3, speed 2)` every 2nd tick. `sparks(hooves, EMBER, 2, 4, −aim, 0.5)` every 3rd tick. **Cap: 24 live rush particles per ram** | – |
| **trample** (each shoved enemy) | `sparks(contact, EMBER, 6, 5, shoveDir, 0.5)` + `dust(its feet, 4, 0.5)`. A mite tumbles instead of dusting | – |
| **near miss** (the rush passes within 2.0 of Still without hitting) | nothing on the floor. A small cold dust puff at Still's feet, blown away from the lane | `rig.punch(−0.015)` (a flinch back) |
| **skid** | `sparks(frontHooves, EMBER, 3, 5, +aim, 0.4)` per tick for 120 ms, `dust(frontHooves, 2, 0.4, speed 4)` per tick | – |

### 5.2 Ram: wall impact and stun

| event | effect | shake / hitstop / punch |
|---|---|---|
| **wall impact** | at the contact point (`pos + aim × 0.95`, y 0.4): `chunks(STONE, 10, 5, 0.14)` from the wall, `chunks(RUST, 3, 4, 0.12)` off the ram, `sparks(EMBER, 22, 8, −aim, 1.3)` (a fan thrown back off the wall), `flash(EMBER, 1.3)`, `dust(14, 1.0, speed 5)`, `smokePuff(stackMouth, 2)` | **0.40 / 0.07 s / +0.03** |
| first stun of the run | the same, plus hitstop 0.12 and punch +0.04 | teaches it once (§8) |
| into a crate | the above + the existing `onSmash` (wood chunks, smash sound) | 0.40 |
| **stun, per 90 ms tick** | `sparks(firebox, EMBER, 2, 3)` up out of the open hatch. `seamGlow` 0.9 pulsing at 9 Hz with the firebox. Plated: +1 spark from each flared flank | – |
| a hit landing in the stun | the normal cold hit sparks ×1.5 (12, not 8) + `flash(firebox, EMBER, 0.4)`: the core flaring as it's struck | hitstop 0.06 (normal 0.045) |
| stun ends (hatch slam) | `sparks(back, EMBER, 4, 3)` + `dust(2)` | – |

### 5.3 Ram death

`chunks(RUST, 14, 5.5, 0.18)` + **2 hatch plates** as big chunks (`JOINT`, size
0.30, thrown up at speed 6) + `sparks(EMBER, 18, 6)` + `flash(EMBER, 1.0)` +
`dust(10, 1.0)` + `smokePuff(stackMouth, 3)`: the boiler's last breath, rising.
Shake 0.30, hitstop 0.08, punch +0.035. Plated: +4 flank plates as chunks. Many:
the split (§7) replaces the plates.

### 5.4 Swarm

| event | effect | shake / hitstop |
|---|---|---|
| surge start | the stamp sparks (§4.2). Biters' halos swell (E4) | – |
| lunge | `trail(core, EMBER, 0.10)` per lunging mite per tick, for the 50 ms of travel (≤ 4 × 3 particles) | – |
| landing at L | `dust(each biter, 2, 0.25, speed 2)` | – |
| bite lands on Still | the existing hurt FX. Nothing extra: one hurt event, one burst | (hurt's) |
| bite on empty floor (dodged) | the landing dust only. The empty snap is **heard** (§6.2) | – |
| **mite death** | `chunks(RUST, 3, 3.5, 0.08)` + `sparks(EMBER, 5, 4)` + `flash(EMBER, 0.35)`. **No dust** | 0.06 / 0.02 s (max, never summed) |
| **8 mites at once** (a Vent) | 24 chunks (pool 260), 40 sparks (pool 1800), 16 flash particles. Within budget. Shake and hitstop are the max of one, so a Vent kill feels like one crunch | 0.06 → **0.12** if ≥ 3 die in one frame / 0.03 s |
| **the brood's end** (last mite of a brood dies) | `embers(at, 12, 0.3)` rising in a column where the last one fell: the mind leaving | 0.15 |

**Mite kill chunks** use `RUST` for mites and the brood-mother, like the hulk.
`main.ts`'s `kind === 'ranged' ? STEEL : RUST` already covers that.

---

## 6. SFX

Recipes use the `audio.ts` building blocks: `tone(type, f0→f1, dur, peak)`,
`hiss(filter, f0→f1, Q, dur, peak)`, `distorted`, and `+sample @rate ×gain`.
Every voice pans with `panOf(pos)` at its trigger. The rush and the skitter use
a live pan (E5).

### 6.1 Ram

**Register.** The hulk's windup is a mid ratchet (1.5–3.1 kHz clicks over low
noise), and the sentinel's is a servo whir with a high clack. The ram is **an
engine**: low, tonal, and it *revs*. The rev is tuned to **A (55 → 110 Hz)**, the
dominant of the music's D-minor drone, so it sits inside the score instead of
fighting it. The tremolo and grit keep it menacing.

| voice | when | recipe | recorded layer |
|---|---|---|---|
| `step('ram')` | each diagonal pair lands (`gait` crosses a multiple of PI) | – | `+step @0.80 ×0.7`, `+metalLight @0.70 ×0.12` (iron-shod) |
| **`rev(ms, lockAt, pan)`** (the windup; returns E5) | windup start | **engine:** `sawtooth` 55 → 110 Hz exp over 495 ms, then **held at 110** to 900, through `distorted` into a lowpass (Q 4) 250 → 1100 Hz over 495, held. Gain 0.0001 → 0.20 over 495, held. **From the lock:** a 14 Hz tremolo (LFO on the gain, depth 40%). **Ratchet:** 5 ticks at `(i+1) × 99 ms`, one per seam segment: `square (900 + 120i) → ×0.6, 0.014 s, ×0.12`. **Pawing:** at 80 and 300 ms, `hiss bandpass 1600→500 Q1.2 .09 ×.25` | pawing: `+step @0.55 ×0.4` each |
| **the lock** (inside `rev`, at 495) | lock | `square 700→380 .03 ×.20` + `sine 110→70 .08 ×.5` (a latch dropping, felt as much as heard). From here to 900: `hiss highpass 3000→6000` rising 0.02 → 0.12, a pressure valve | `+metalHeavy @1.25 ×0.7` |
| **`rush(pan)`** (returns E5, pan updated per frame) | strike | **roar:** `sawtooth 110→55 .55 ×.5` through `distorted`. `hiss bandpass 500→1400 Q1 .5 ×.45`. **Hooves:** 6 samples 70 ms apart | `+softHeavy @0.8 ×0.8` (the launch), hooves `+step @0.60 ×0.5` decaying ×0.85 each |
| near miss | the rush's closest pass within 2.0, no hit | none extra: the roar's live pan sweeping past Still **is** the whoosh. Drop the roar's frequency ×0.85 over 80 ms at the moment of closest pass (a cheap Doppler) | – |
| **`ramCrash(pan)`** | wall stun | `sine 130→38 .35 ×1.0`, `hiss lowpass 4500→250 .35 ×.6` | `+metalHeavy @0.75 ×1.0`, `+mining @0.70 ×0.7` at +10 ms, **`+bell @1.35 ×0.55`**: the Assembler's clang, smaller. Depth 2 teaches depth 3 by ear as well |
| crate variant | a crate stops the rush | `ramCrash` + the existing `smash()` | – |
| **`dazed(ms, pan)`** (returns stop) | stun | three `triangle` partials 1040 / 1560 / 2330 Hz (±1% detune), ×0.05 each, through one gain with a **5 Hz wobble** (depth 0.5), exponential decay over 1.2 s. Struck iron, ringing. **At 1200:** `square 1200→700 .015 ×.2` (the hatch slam, G8) | slam: `+metalMedium @1.4 ×0.5` |
| **`hitOpen(pan)`** | any hit on a stunned ram, layered on `hit()` | `sine 1320→1300 .25 ×.08` | `+bell @2.0 ×0.3` |
| hit on Plated outside a stun | layered on `hit()` at 0.7 | – | `+generic @0.9 ×0.4` (the `blocked()` layer) |
| `skid(pan)` | open rush ends | `hiss bandpass 2800→700 Q2 .4 ×.35` (iron grinding stone), `square 180→90 .2 ×.08` through `distorted` | `+mining @1.3 ×0.25` |
| trample clank | each shoved enemy, E7: ≥ 80 ms apart | – | `+metalMedium @1.1 ×0.4` |
| **death** | kill | the existing `kill()`, plus: `hiss highpass 2500→1200 .6 ×.2` (steam escaping) and `sine 1800→600 .5 ×.05`, a dying whistle. **A sigh, not a buzzer** | `+plateHeavy @0.6 ×0.6` at +50 ms (the plates falling) |
| wake | as all packs | the existing `alert()` | – |

### 6.2 Swarm

**Register.** The swarm is the only enemy above 3 kHz: clicks, chitter and
air. It never uses a low tone except in the brood's end.

**Voice-limiting rule (skitter).** Mites never call `step()`. Each **brood** owns
one skitter stream:

| parameter | value |
|---|---|
| tick rate | `6 × min(moving mites, 4)` per second, so ≤ 24/s per brood |
| global cap | 36 ticks/s across all broods. If two broods are both at cap, each gets 18 |
| each tick | `square vary(3400)→2200 .006 ×.04` + `hiss highpass 6000 .008 ×.03`, **or**, one tick in three, `+tin @vary(3.0, .15) ×.05` |
| pan | a **randomly chosen moving mite's** position, per tick. The stereo field shimmers across the whole swarm, and it stays honest |
| loudness | `1 − d/16` of the brood's nearest mite (the same falloff as footsteps) |
| duck | ×0.5 while any enemy windup voice is playing, so the skitter never covers a tell |
| Quick brood-mother | the rate scales with speed (×1.45) for free, up to the same cap |

Result: 8 mites sound like one rustling thing that gets thicker as they close
in, not like 8 sets of footsteps.

| voice | when | recipe | recorded layer |
|---|---|---|---|
| **`chitter(ms, biters, pan)`** (the brood's shared windup; returns stop) | surge start | **onset = the lock:** `square 2600→3400 .03 ×.18`, rising (the sentinel's clack falls, the ram's latch is low, so this chirp goes up). **Body:** `hiss bandpass Q6 1800→4800` over 550 ms, gain 0.04 → 0.22, like insects rising or a kettle about to go. **Mandibles:** clicks every 70 ms tightening to 22 ms (the hulk ratchet's shape an octave up). Each click is **n flammed ticks** (n = biters, 4 ms apart), `square 4200→3000 .005 ×.07`, so a four-jaw surge sounds thicker than a one-jaw surge. Ends exactly on the 550 tick. Pan at L (near Still: centred, because it's on you) | onset `+tin @2.4 ×0.4` |
| a biter lost mid-windup | Parry or a kill | the next clicks drop to n−1 ticks. Parry: the parts pass's cancel clang, and the chitter is **not** cut, because the other jaws are still coming | – |
| **`snap(biters, hit, pan)`** | the 550 tick | n jaw clicks flammed 7 ms apart: `square 3000→1100 .02 ×.18` + `hiss bandpass 3500 Q3 .015 ×.2` each. **If hit:** `hurt()` plays (it bypasses the duck). **If dodged:** add `hiss highpass 5000 .06 ×.12`, jaws on air, and the landing | `+tin @1.6 ×0.3`. Dodged landing: `+softMedium @1.8 ×0.2` |
| **`pop(pan)`** (mite death, **not** `kill()`) | kill | `triangle vary(1500)→700 .06 ×.2`, `sine 260→110 .07 ×.35` | `+tin @vary(1.8) ×0.3` |
| pop limit (E7) | – | pops ≥ 35 ms apart. **Cluster:** if ≥ 3 pops fall inside 120 ms, play one `popCluster(n, pan)` instead: `sine 180→60 .15 ×.5`, and min(n, 5) `+tin` scattered over 100 ms at rates 1.6–2.4, ×0.18 each | `+metalMedium @1.5 ×0.5` |
| **`broodEnd(pan)`** | last mite of a brood dies (after its pop) | 6 clicks **slowing down** (22 → 90 ms apart), pitch falling 3400 → 1400, gain falling. `hiss bandpass 3000→900 .5 ×.08` (an exhale). Then one small clear `sine 660→655 .25 ×.05`: the mind gone quiet. Not warm: it isn't `cleared()` | – |
| brood-mother pop | her kill | `pop()` an octave down + `+plateHeavy @1.4 ×0.3` | – |

### 6.3 Mix rules in a crowd

| rule | value |
|---|---|
| windup voices at once | ≤ 3. A 4th starts at −9 dB. Priority by time to strike |
| **the hush before the rush** | while any ram is locked (405 ms), every enemy footstep and the skitter play at −6 dB. The latch and the held rev get the room to themselves |
| footsteps | ≤ 3 per 120 ms across all enemies, nearest first |
| hit sounds on mites | `hit()`'s existing 22 ms guard. Enough |
| lock sounds | three registers (sentinel clack high and falling, ram latch low, brood chirp rising), and the lock book keeps them ≥ 300 ms apart |

---

## 7. Elite looks

The aura and the floating name stay as today. Each mod adds **one** body-level
feature, so the leader reads as different before you read the label.

| elite | feature | where it shows | extra read |
|---|---|---|---|
| **ram, Quick** | the stack becomes a flared exhaust (`Cylinder(.08, .16, .30)`) that streams one ember a tick while it walks | the top view: a spark trail behind a ram | footsteps and trot scale with speed on their own |
| **ram, Plated** | 3 flank plates a side (`Box(.05, .30, .32)`, colour `0x6e5a50`, a shade lighter than `BODY`: bare plate) hinged at their top edge along the boiler's sides, plus a plate over the plough face | a thicker, blockier silhouette | outside a stun: dull hits (§4.4). **In a stun: hatch open and flank plates flared, the whole body opening like a pinecone.** The line: "takes half damage, until it hits a wall" |
| **ram, Many** | a **split seam**: a dark `JOINT` band (`Box(.04, 1.0, 1.9)`) down the centreline, the two halves offset ±0.02 x, and **two stacks** (x ±0.18) | the top view: twin stacks = two of them | on death the halves separate along the seam with a crack (`chunks(RUST, 6)` + `+metalHeavy @1.1`), each shoved ±6 sideways (as `split()` does). The smalls are rams at size 0.72 with one stack each, and their lanes are drawn at half 0.55 |
| **ram, Warden** | a **mast**: `Cylinder(.04, .04, .9)` from the back, topped with a small iron cage (`Box(.16, .2, .16)` wireframe-ish: 4 thin bars) holding an ember lamp (`Sphere(.07)`, `CORE`, with a halo). The tallest point in its pack (1.9) | seen across a room: kill that one | **sealed cores** (below) |
| **brood-mother, Quick** | longer legs, faster scuttle (§3.3) | – | skitter thickens (§6.2) |
| **brood-mother, Warden** | her sac is the brood's only lit core; every other mite is `sealed` (E4) | the swarm goes dark except for her | **sealed cores** (below) |

**Sealed cores (any Warden pack, hulks included).** Warded members' cores go
dark (`JOINT`, with a thin `CORE × 0.4` rim), and hits on them sound dull (the
Plated layer, §6.1). The pack visibly has one light left, and it is the Warden
(or her). When the Warden dies, the seals break in a ripple outward from its
position over 200 ms, 30 ms per member, each with `+tin @2.0 ×0.15`. You hear
the ward come off. This extends the current hulk Warden too, which today only
shows its label.

---

## 8. How the player learns them (no text)

| depth | what they meet | what teaches it |
|---|---|---|
| 2 | the lesson pack: 1 ram + 1 hulk in a main room with cover (Balancer §6.2) | place the sleeping ram **facing into the room's cover**, so its first real lane is likely to cross the cover or a wall. The first rush in the open ends in **skid streaks**: "it runs through where you were". The first time Still's back is to a wall, the end mark is a **star**: a new picture, so the player notices it. The first stun has the bigger hitstop (§5.2) and opens the hatch; the first hit into it **rings** (`hitOpen`). The loop "dull hit / crash / ring ring / slam" teaches the ×1.5 without a number |
| 3 | the Assembler | its charge draws the same lane at a bigger size (§1.2), and its wall crash is the same bell, lower. The player already knows what to do |
| 4 | the lesson swarm: 8 mites alone, a big room | they orbit first (two rings, one heartbeat) before the first surge, so the player sees the formation before being bitten. The first ring comes in 4 pieces, pointing at 4 crouched mites. Stepping out gets the dry **snap on air**, and the spent clump dims, which is the invitation to cleave it |
| 5+ | mixes | nothing new. Every read above holds with more on screen (§9) |

---

## 9. Readability: two rams, a sentinel and a swarm awake

The depth-7 case (`C + M6 + H + S` next to a `2C + M6` pack, both awake). The
Balancer's worst case is about one lock a second, never two inside 300 ms.

**What stays legible (never suppressed):**

| always shown | why |
|---|---|
| every **locked** tell at full strength (lane core + wash + end mark, the sentinel's locked line, the bite ring, hulk rings) | the soonest-to-land decides your next move |
| mite **halos** (12 glow dots in this case) in their roles | counting jaws is the swarm read |
| each ram's **seam** and **stack** | direction, before any tell |
| the stun hatch | the reward window |
| elite labels (as today) | – |

**What gets suppressed:**

| thing | rule |
|---|---|
| tracking tells | 60% while any tell is locked (§4.3) |
| rush particles | ≤ 24 live per ram (§5.1) |
| ram walk smoke | off while that ram is within 6 u of another awake ram (it would fog the lanes) |
| mite stagger | tumble only, no dust or sparks |
| mite recover smoke motes | one per brood per 200 ms, not per mite |
| status badges, rime, motes | the parts pass's crowd rule stands: > 5 marked → one steady bracket each, rime never scales up, ≤ 12 motes across all enemies |
| sounds | §6.3: ≤ 3 windups, the hush before the rush, ≤ 3 footsteps per 120 ms, one skitter stream per brood, pop clusters |
| camera | frames lane end points (§4.1) but keeps `ZOOM.min 0.7`. At 0.7 a mite is 12 px and its halo 9 px: still a dot you can count |

**On-screen census at the worst moment:** 2 ram lanes (one tracking at 60%, one
locked), 1 sentinel line, 1 bite ring, 1–2 hulk rings, 12 mite halos, 3 elite
labels at most. Every tell is a different shape (lane, line, ring in pieces,
whole ring) before it is a different size, and every lock has its own sound.

---

## 10. Parts that touch them: what the player sees

| part | on a ram | on the swarm |
|---|---|---|
| Pressure Vent | the locked lane slides back with the body. A star can turn into skid streaks (§4.1) | the 4 biters tumble. The outer ring doesn't flinch (it is out of reach, and the stillness shows it) |
| Parry Clamp | N9 on the whole lane, seam snaps dark (§3.1) | one arc shatters, and the next clicks lose a tick (§6.2) |
| Anvil | a caught rush = a stun: the hatch opens. The catch's own bell (parts pass) plays first, then `ramCrash` without its bell layer (one bell per moment) | the catch folds the bite. The ring's arcs shatter cold |
| Frost Trail | trip: N9 on the lane, quarter-turn, rime, **hatch shut** | slowed mites fall behind: rime on 0.3 u domes is only a tint |
| Lure | the lane aims at the decoy, and the rails show it before the lock | the bite ring lands on the decoy with no lead: a clear "they're fooled" picture |
| Flare | the lob landing inside a stun gets `hitOpen` like any hit | a lob on the spent clump: 4 pops merge into one `popCluster` |

---

## 11. The three moments that must land

1. **The matador stun.** You stand in front of a wall, see a star where the
   lane ends, and step aside at the latch. The ram goes past close enough that
   its roar sweeps across your ears, meets the wall with the Assembler's bell
   in miniature, and the hatch on its back springs open on a pulsing core.
   Every hit now rings. Then the hatch slams and you know the window is shut
   without looking. It works because the outcome was promised on the floor
   before it happened. Keep the star honest: recompute it every locked tick,
   and never draw a star where the rush will skid.
2. **The snap on air.** Four mites crouch, the ring comes down in four pieces
   ahead of you, the chitter climbs, you turn, and four jaws close on empty
   floor with a dry click and a patter of landings. Then their lights go dim,
   and they are sitting in a clump in front of you. Dodging and punishing are
   one motion. The sound of the miss has to be crisp and clearly *theirs*, so
   the player hears that they won without looking at the HP bar.
3. **The brood going quiet.** The last mite pops, the clicking slows and falls,
   an exhale, and one small clear tone as a column of embers rises where it
   died. The player never saw the brood, and this is the only time they hear
   it on its own. It has to feel like a thing ending, not like a sound effect
   for the thirtieth kill of the level.

---

## 12. Open questions for playtest

| # | question | what to watch |
|---|---|---|
| Q1 | Does the **lane wash** (§1.2, out to 1.12) read as danger, or as soft glow players ignore? | players getting hit with their feet in the wash and calling it unfair means it reads as glow: raise the wash to 0.3, or use the fallback (one full-width strip) |
| Q2 | Are **mite halos** at 0.55 scale countable at zoom 0.7 in a lit room, and do 12–16 of them turn into a smear? | if they smear, cut the `outer` halo to 0.25 so only the 4 biters glow clearly |
| Q3 | Does the **ease-out lunge** make the bite feel simultaneous with the hurt? | if players say "it bit me before it touched me", move the curve further (90% in 40 ms) before touching the sim |
| Q4 | Is the **seam fuse** (5 segments, 0.12 u wide) readable as filling at zoom 0.7, or just "it got brighter"? | if only brightness reads, the seam still works as the lock snap. Widen it to 0.16 before adding anything else |
| Q5 | Is **one skitter stream per brood** enough to locate a swarm behind you off screen? | if not, give the brood's nearest mite a quiet always-on hiss (`bandpass 4k Q4 ×0.03`) panned to it, capped at one per brood |
| Q6 | Is the **skid ease** (§3.1) worth the 40 ms? | compare it with the fallback on the Poco. If nobody sees the difference, keep the rush at constant speed |
