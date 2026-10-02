# The look: translator (lead voice)

2 Oct 2026. Read: BRIEF, `partfx.ts` in full, `castFx` / `onContact` / `meltPart` in `main.ts`, `combat.sweep` / `combat.ring`,
`vfx.ts` (pools, `tellMaterial`), `markfx.ts`, `temper.ts`, `weight.ts`, `still.ts` (POSES, the arc pose), `enemy.ts` `tint()`,
`partmodels.ts` header, `prod.png`. I read `1-claude.md` after my diagnosis; we agree on the spine, I differ in three places (marked **vs lean**).

Scale I design against: landscape, `viewHeight` 17 u over ~400-440 CSS px = **~24 px per unit**. Still is ~45 px tall. The
brief's 6 px floor is **0.25 u**. Anything thinner than 0.25 u is a colour smear, not a shape.

## 1. Why the parts look basic (from what the code draws)

**1. Still's swing is written in the enemy's language.** The Cleaver's only floor shape is `combat.sweep(o, aimed, range, 0x8fb8e8, cone)`:
a filled `CircleGeometry` sector on `tellMaterial('radial', ...)` **without `cold: true`**. So it draws the enemy telegraph's grammar
(outward ripples, solid edge, molten noise), tinted blue, and it **grows** 1 -> 1.15 over its 220 ms life: the "fill" that G2 gives
enemies, not the "close" it gives Still. A filled sector on the floor means "something is coming here" everywhere else in this game.
The player's own blow reads as a tell, after the fact. Hook, Clamp Toss's whiff and the hand's sweeps share it. (It also allocates a
new `CircleGeometry` every cast.)

**2. Every cast is one frame, then a fade: no before, no after, no spacing.** `castFx` is `vfx.flash` + `vfx.sparks` (+ `partFx.beam`)
per beat; only counts change (lens 10 sparks, vent 26 + 14 dust, Cleaver 7 points x 2). Sparks live 0.25-0.55 s, the sweep 0.22 s,
beams 0.15-0.35 s. The anticipation is gone too, and rightly: under weight `WEIGHT_FEEL.cocked.arc = 0.3` starts the arc pose at
exactly `k = 0.3`, where its windup ends (`wind = k / 0.3`), so the press is instant. Nova's 0.25 is the end of its crouch the same
way. What's left is the contact alone: freeze (`30 + 6 x cd s + 10 / body`, 46 ms for one Cleaver body), shake, sound, a head's
flinch. Nothing travels across the screen in time (the sector appears whole), and nothing is left on the floor once it fades.

**3. The detail sits under the phone's floor, and the only thing rank moves is size.** `sparks` are 0.08-0.16 u (2-4 px), `trail`
0.18-0.26 u, `frost` 0.05-0.1 u. What does carry on the phone is `flash` (a bloom pop), which is brightness: the lever he ruled out.
`castFx` gets the tempered def and never reads `def.rank`. Rank reaches the screen only through `TEMPER.area` (radius x1.15 / x1.3
on nova, ward, lob, decoy; the arc's cone: Cleaver 180 -> 207 -> 234 deg after `cleaverCone`), which is "just bigger" by definition.
And the Cleaver's sparks don't even show that: their arc is hard-coded `(i / 6 - 0.5) * 2`, **115 deg whatever the cone**, so at
III the sparks cover under half the swing.

## 2. The escalation grammar: the act, the bite, the scar

One rule across all twelve shapes, so he learns it once (agreeing with the lean's spine):

| rank | adds | where it lives | reads as |
|---|---|---|---|
| **I: the act** | the motion itself, **swept in time**, in Still's own vocabulary (strokes, not fills) | in the air at his reach | "a tool" |
| **II: the bite** | a second beat on what it touched, at the freeze's release: a **material** change (lit steel shards, dark-cored edges) | at bodies' feet, the far side from Still | "it lands" |
| **III: the scar + the stance** | the floor keeps a **stroke** of the motion for ~1.2 s; Still's body **holds the finish**, and **waits armed at rest** | the floor; his body | "it's mine" |

The seven levers from the brief, assigned so each rank changes several and none is size or brightness:

| lever | I | II | III |
|---|---|---|---|
| anticipation | none at the press (weight's instant cast stays) | the slot's mesh glints once as the cooldown ends (one 120 ms EYE pulse) | **the ready stance**: the part waits cocked at rest (below) |
| follow-through | the pose settles as today | pose overshoots +15% and counter-settles over +80 ms | **held finish**: the pose freezes at its end 160 ms, then lets go |
| secondary motion | sparks, re-sized to >= 0.22 u | + 3 lit steel shards per bitten body (`vfx.chunks`, the `Debris` pool) | + the scar breaks into 2-3 chips as it ends |
| timing / spacing | a sweep over 60-80 ms (lead edge bright, tail thin) | same time, **ease-in-out** becomes **fast-out** (snap) | the act stops on the struck body for the freeze, then **finishes** |
| material | frost (cold, faceted, normal-blended, dark rim) | **steel**: a dark core line inside every cold edge; shards are lit metal, not glow | **fractured**: trailing edges break in discrete steps, scars crack |
| the world | nothing stays | a floor stroke at the bite, 300 ms | **the scar**: a stroke of the motion's path, 1.2 s, closing toward its end |
| Still's pose | the pose | longer settle | held finish + **ready stance at rest** |

**vs lean (1): anticipation lives in readiness, not in the cast.** We can't put a windup back before the hit without undoing weight's
instant press. So a III's anticipation is the stance it holds **while ready**: the arm carried back, the lens leaned in, the knees
low. It goes slack when the part is cooling, and cocks again (a 150 ms ease) when it's ready. That's the one cue that works with
nothing being cast, it costs zero draw calls (pose writes on existing pivots), and it doubles as a cooldown read on his body.

**vs lean (2): strokes, never rings.** Ram's mark ring is "cracked steel", Wake's is frost, landing previews and the anvil are
closing rings. If a III scar were a ring it would collide with both cores. So the rule: **rings belong to marks and previews;
strokes (open lines, arcs < 360, broken circles) belong to rank.** A 360 deg swing's scar is four dashed quarter-arcs at 1.05 x range.

**vs lean (3): the bite is steel, not light.** `onContact` already refuses to emit at struck bodies (W4: five hulks must stay five
under bloom). So the bite is lit `Debris` boxes (MeshStandard, normal blend, 0 extra calls) and a floor stroke at the body's feet:
it can never wash a body. Shards in `PALE 0x8e9aa6` / `SHELL 0x55616e`, the part's own metal.

**Kept from the lean:** pushed is not a rank (a pushed I keeps `pushSignature`'s embers and gets no bite or scar); the slot mesh on
Still changes at III (a frost seam in `RIME 0x9fb4c8` painted on the part, lit with the shared EYE when ready).

**The at-a-glance test (sound off).** A still screenshot of a fight shows a III by any one of: the stance (always, while ready), a
scar (1.2 s after each cast), the button's existing `III` (`hud.ts` already draws it). A II is visible only in motion (bites,
overshoot): that's correct, II is "it lands", III is "it's yours".

### Per family

| family (parts) | II bite | III scar | III stance at rest | III spacing |
|---|---|---|---|---|
| **Projectiles**: bolt (Focusing, Cracked, Ricochet, Patient, Through-Line, Coil), lob (Flare, Signal) | bolt: 3 shards out the struck body's far side + a 0.6 u frost splash stroke behind it (pierce: first 3 bodies; Coil: 3 a cast total). lob: 5 shards out low from the landing | bolt: the path scored on the floor, a cold dashed `beam` Still -> last body, closing from his end over 900 ms (Ricochet: a tick at each bank). lob: a 6-stroke crack star at the landing | bolt: lens stalk leaned forward 0.1 rad, glass at full EYE. lob: lens chin-up 0.15 rad, a mortar's tilt | bolt: recoil held 80 ms, legs brace (Through-Line's draw pose for all IIIs). lob: the glob hangs at its apex (re-eased, same `travelMs`) |
| **Bursts**: nova (Pressure, Backdraft, Chill, Brace), catch (Anvil) | each shoved body drags a 0.4 s dust skid stroke the length of its shove (Backdraft: toward him). Chill: frost motes at feet. Anvil: shards off the caught body | 6 radial crack strokes around him, 0.5-0.9 x radius (Chill: rime strokes in `FROST`; Brace stays ember, it's strain) | the core breathes: one frost mote off the cage every 1.2 s | the cage holds open 120 ms past the burst, then shuts with an overshoot |
| **Shells**: ward (Ward, Mirror) | the facet facing each blocked hit cracks and flares (a hit-angle uniform in `SHELL_FRAG`); Mirror: the reflected shot leaves from that facet | on release the shell drops as 10 shards; its 10 facet bases stay as 10 short dashes at his feet 0.8 s (broken, so not a ring) | shoulders squared: arms out `rotation.z` +-0.12 | the drain's top edge steps facet by facet instead of sliding |
| **Melee**: arc (Scrap Cleaver, Piston, Hook, Parry, Frayed), grab (Clamp Toss) | see section 3. Piston: shards straight out the far side. Hook: the chain drawn as cold dashes with a dark core. Parry: the broken windup's ring goes cold before it vanishes ("he took it"). Toss: the wall tick cracks on impact | Piston: a straight gouge along the strike. Hook: a furrow from the body's start to his feet. Toss: a skid stroke where the body lands. Parry: none (its answer is the broken tell) | the clamp arm carried back and up | the act stops at the struck body for the freeze, then finishes |
| **Moves**: dash (Kickstart, Skid, Overrun, Frost Trail), hop (Skitter, Spring Heels) | run-over bodies flinch (extend `flinch` beyond the head) + 2 shards each. hop: a 3-stroke crack at the landing | dash: two parallel skid strokes (his feet) along the path, 1.2 s. hop: a print at takeoff, cracks at landing. Frost Trail's strip is already a scar: its III gets the dashed dark-core edge | knees bent 0.15, weight forward | dash: a 60 ms slide on arrival (pose, not position). hop: hang at apex, same `travelMs` |
| **Left behind**: decoy (Lure), anchor (Plumb Line), rewind (Borrowed Time) | the thing gains an edge: the decoy ghost a dark rim (it reads on warm stone), the tether chain dashes, the echo ghost two dots of its path | decoy: bursts into shards + a crack star. anchor: the snap leaves a gouge along the snap path. rewind: the self he left cracks and falls as shards (250 ms) | the core's light pulses at the part's own rhythm (decoy's 0.75 s call, the echo's 1.5 s) | the snap and the rewind arrive with a 40 ms overshoot |

Frayed Cleaver's width (90/180/360) and its ember at 12+ strain stay the **strain** dial; rank is orthogonal. A fray-360 at III gets
the dashed quarter-arc scar, in ember if the fray is ember. Ember on Still means "it costs him", nowhere else.

## 3. Worked example: the Cleaver family at I, II, III

Numbers under weight (default): pose `arc`, dur 340 ms, starts cocked at 102 ms (k 0.3), so the visible whip is 238 ms. Range 3.1 u,
cone 180 / 207 / 234 deg by rank. Contact freeze `min(100, 30 + 6 x 2.6 + 10 x (n-1))` = 46 ms for 1 body, 66 for 3, 100 at 6+.
`partFx.update` runs on game time, so **anything I draw holds still during the freeze**: the freeze frame is the money frame.

**The act (all ranks): a crescent, not a sector.** Replace `combat.sweep` for the arc with a thin swept crescent: a `RingGeometry`
band at 0.78-1.0 x range, `thetaLength` = the cone, on a **cold** tell material (dashed edge, faceted, normal blend) with a dark inner
rim (markfx's lesson: it reads on warm and dark floors). A `uReveal` uniform sweeps it from the arm's start side to its end; the
lead edge is bright and 0.3 u thick (12 px), the tail thins to 0.1 u. Sparks re-placed along the **real** cone at the blade's edge,
size 0.22-0.3 u.

| t (ms) | I | II (adds) | III (adds) |
|---|---|---|---|
| 0 press | pose at k 0.3, arm whipping. Crescent revealed **up to the first struck body's angle** (the smear frame). Contact: freeze starts | crescent edge has the steel core line | crescent's trailing edge stepped in 4 segments (fractured) |
| 0-46 freeze | the frame holds: blade on the body, arm mid-whip, head flinched (struck body tilts as today) | - | - |
| 46 release | crescent finishes its sweep over 50 ms; 12 sparks along the cone | **bite**: per struck body (max 3), 3 steel shards out the far side, a 0.6 u cold stroke at its feet along the blade's tangent, 300 ms | - |
| 96 | crescent fades over 120 ms | arm passes 15% beyond its end | crescent **drops to the floor** as the scar: its outer edge, a 0.08 u dark-cored stroke at 0.95 x range |
| 216 | gone. Pose settling | settle extends to ~420 ms (counter-twist) | pose **holds the finish** (arm out, cage turned) until ~380 ms |
| 380-500 | - | - | pose lets go; scar starts closing from the swing's start edge |
| ~1300 | - | - | scar's last third breaks into 2 chips and goes. Cleaver ready again at ~1.9-2.2 s (cd 2600 x 0.72 / 0.85): the arm **cocks back** (150 ms ease) |
| whiff | no freeze: crescent sweeps the full cone in 70 ms | no bite (nothing touched) | scar still drawn: the world shows his blade passed |

**What the eye reads.** I: "a blade went across, that way." II: "it went across and **bit** them": the shards are the only lit metal
flying in a fight. III: "it **cut the floor**, and he holds the pose like he means it"; and between swings, the arm is held back:
"that arm is loaded."

**Cost** (per cast, peak, draw calls on the frame they live):

| | today | I | II | III |
|---|---|---|---|---|
| draw calls | 1 (sector, 220 ms) | 1 (crescent, ~220 ms) | +1 (bite strokes: one `InstancedMesh` for all bites, built once) | +1 (scar, ~1.3 s; <= 1 alive per Cleaver, cd outlasts it) |
| particles (`glow`, cap 1800) | 14 | 12 | 12 | 12 |
| debris (`Debris`, cap 260, 0 calls) | 0 | 0 | 9 | 9 + 2 chips |
| allocation | a `CircleGeometry` a cast | none (shared ring geometry per cone bucket, pooled material) | none | none |
| CPU | - | one uniform | <= 3 matrices | one uniform + pose writes |

So the whole family at III peaks at **3 calls** (today: 1) and fewer glow particles than today. Piston (cone 40) uses the same
crescent narrowed to a lance with a straight gouge for its scar; Hook's crescent is the 70 deg reach band with the chain on top.

## 4. The overall look: three changes, most lift for least cost

1. **The hit flash: rim, not fill.** `Enemy.tint()` lerps body and joints 0.85 toward white and adds a warm emissive (0.6, 0.25,
   0.2); `hit()` sets `flash = 1`, decaying at 6/s (~167 ms), and it decays on game time, so it **holds full white through the
   weight freeze**. A slammed hulk is a peach-white blob for ~46-100 ms frozen + ~120 ms more; `dimFlash(1/sqrt n)` only helps crowds.
   Fix: fill lerp 0.85 -> 0.25, and add a fresnel rim (`onBeforeCompile`: `rim = flash x pow(1 - N.V, 2.5)`) in `COLD`. The
   silhouette and joints stay; the edge says "touched". A **break** (`breakFx`) keeps a full fill flash: hit = rim, break = fill, a
   hierarchy for free. Cost: **0 draw calls**; one shader patch per enemy material (precompile at level load, or the first hit hitches).
2. **Contact blobs: ground everything.** `shadowMap.enabled = false`, so bodies and Still float on the lit stone (see `prod.png`).
   One `InstancedMesh` of soft dark discs (radius from `e.radius`, opacity 0.45, under every decal) for Still and every body. Still's
   blob shrinks while he's airborne: today a hop at 38 deg reads as a slide, and a lob's glob and a thrown body have no height cue
   beside their ring. Cost: **1 draw call**, 2 tris a body, one matrix write each a frame.
3. **A borrowed cold light.** Additive cold on warm stone washes to "flat peach" (the markfx / handring finding), so cold can't be
   painted onto the lit floor; it has to **light** it. One `PointLight` (`COLD`, always in the scene at intensity 0, so no recompiles),
   borrowed by a part cast for 90-160 ms at the act's centre (the crescent's midpoint, the core, the lens on release). The warm floor
   goes cold under his blow, and Grace stays the only warm light. Cost: **0 draw calls**, but +1 light in every MeshStandard fragment
   for the whole level. **Measure first** with `?perf=1` in a d5 big room; if it costs frames, drop it, the other two stand alone.

## 5. Clutter: the tell always wins

A d6-d9 pack carries mark rings (3-5 calls), badges, state glyphs, ember windups and rail strips. The escalation must sit under all of it.

1. **Shape vocabulary, partitioned.** Enemies **fill** the floor (sectors, discs, strips, molten, ember). Still **never fills**: his
   acts are strokes, his previews are closing cold rings, his marks are rings at feet, his scars are open strokes. The Cleaver's sector
   fill is the one violation today; the crescent fixes it.
2. **Layer order** (renderOrder, then opacity caps): enemy tells (`tellOrder`, soonest on top) > mark rings > Still's act >
   bites > scars. Scars at opacity <= 0.45, laid **under** the tell layer, so a tell crossing a scar draws over it.
3. **The tell's duck.** While `TELL_CROWD.locked > 0`, new scars spawn at 40% and live ones fade 2x; the borrowed light skips. This
   reuses the signal `trackingDim` already reads. A committed ember tell is never sharing the frame with our brightest moment.
4. **One answer per body per cast.** If the cast spends core marks on a body, the mark's own spend visual is its answer (markfx, the
   badge slam); the bite skips that body. No body gets two flourishes in a frame.
5. **Caps.** Bites: 3 bodies a cast. Scars: 4 alive across all slots, oldest fades in 150 ms when a fifth spawns. Part shards: 24
   live (of `Debris`' 260). Over `CROWD` (5) marked bodies, III scars shorten to 600 ms, as badges drop to one bracket today.
6. **The stance costs the fight nothing.** It lives on Still's pivots: no pixels near an enemy, no floor, no air.

Worst case, four IIIs fired in one beat in a d8 pack: +4 scar calls, +1 bite call, +1 blob call, ~50 glow particles, ~40 debris.
The balancer owns whether that budget holds; at these numbers it's under a single mark ring set per slot.

## Questions for playtest

- Does the **ready stance** read as "this part is III" or just "Still idles differently"? (It's the load-bearing cue at a glance.)
- Does the crescent stopping on the struck body for the freeze read as **weight**, or as a stutter on a 46 ms freeze?
- Do steel shards read as "it bit" on the warm floor, or as debris from the room (crates throw `WOOD` chunks from the same pool)?
- Is the cold hit rim confused with **chilled**'s rime tint on a body?
- With three IIIs worn, does the floor still read as the enemies' at d8 (screenshots at four phone sizes, the tell duck on and off)?
