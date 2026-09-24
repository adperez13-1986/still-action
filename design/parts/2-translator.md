# Parts pool: presentation (Translator pass)

Pass 2 of 3. The Balancer's mechanics and numbers are taken as settled. This pass
covers what each part looks, sounds and reads like on a 6-inch landscape phone,
and how the player learns the odd ones without a tutorial. Every recipe is built
from what is in `src/` today (`vfx.ts`, `audio.ts`, `still.ts`, `combat.ts`
`ring`/`sweep`, `hud.ts`). Anything new is listed in §2 and named where it's used.

Names: I kept all 30 of the Balancer's names. They're short, physical, and fit
Still being built out of salvage. Nothing needed changing.

---

## 0. Notation

| shorthand | means (in `still.ts`) |
|---|---|
| `head.rx` / `head.rz` / `head.pz` | `parts.head.rotation.x` / `.rotation.z` / `.position.z` (neck pivot) |
| `lens.*` | the lens group inside the head. **Not exposed today**: needs a `private lens` handle (§2, R1) |
| `torso.rx` / `torso.ry` / `torso.s` | cage rotation / uniform scale (rest `rx` = 0.16) |
| `armL.*` | the **clamp** arm (long, left). `jaws` = its two jaw boxes (R1) |
| `armR.*` | the **hook** arm (short, right) |
| `legL.rx` / `legR.rx` | hip swing |
| `grp.y` / `grp.s` | `group.position.y` / `group.scale` (visual only, never `pos`) |
| `k` | 0→1 through the beat, as in `animate()` (`wind` = k < 0.3, `release` after) |
| `ring(from→to, life, col)` | `combat.ring` |
| `sweep(range, spread)` | `combat.sweep` |
| `COLD` / `COLD_DEEP` / `EMBER` | `vfx.ts` colours. `STEEL` = the `0x8fb8e8` rings already use |

All beats are ≤ 0.45 s. A few parts hold a **stance** afterwards for as long as
their window lasts (Ward, Brace, Anvil). The stance is the rule made visible,
not extra animation, and a stance is listed separately from the beat.

---

## 1. The grammar (the rules every part obeys)

These rules make 30 parts readable as one family, and they keep Still's marks
from being mistaken for enemy telegraphs.

| # | rule | why it reads on a phone |
|---|---|---|
| G1 | **Colour.** Still's effects are cold. Enemies' are ember. Gold-tier parts stay cold in play: gold is the loot colour, not the effect colour, so Grace stays the only warm light | the one contrast that survives thumb cover, glare and colour-blindness (orange vs blue is the safest pair) |
| G2 | **Enemy tells fill. Still's close.** An enemy's clock is a disc growing inside a fixed ring (chaser today). Still's lasting floor marks start wider than their true size and **contract** to it, or drain inward while they last | even without colour, the motion says whose it is |
| G3 | **Ripples run the other way.** Enemy radial tells ripple outward (`fract(r*5 - t*1.6)`). Still's ripple inward and have a **dashed, faceted** edge instead of a solid molten one (§2, N1) | the texture reads at a glance: molten is theirs, frosted is his |
| G4 | **Heat rises, cold falls.** Enemy windups shed rising embers (hulks do today). Still's statuses shed **falling** motes | a stationary enemy tells you which side's thing is on it |
| G5 | **Floor is future, body is present.** Anything on the floor says what *will* happen (a landing, a burst, a zone). Anything on an enemy's *body* says what *is* happening to it (marked, slowed). Statuses never use floor rings, because the elite aura is already a floor ring | the floor stays for dodging and the body for targeting. Two questions, two places |
| G6 | **Embers off Still = strain spent.** Pushes already throw embers off his joints. Every other strain cost uses the same embers, plus a pip that flies to the meter (§4) | one symbol for one resource |
| G7 | **Motion only under half a second.** Stagger, yank and throw get no badge, only motion, dust and a spark at contact. A badge that shows up after the effect has ended is noise | fewer glyphs on a crowded screen |
| G8 | **Anything that lasts ends with a snap.** Statuses, windows and zones make a small visual and sound tick when they end. A mark that gets *used* ends differently (loud) from one that runs out (quiet fade) | you notice something is gone without watching it |

### Button face states (the HUD side of the grammar)

```
  READY            LIVE                 COOLING            PUSHABLE (held while cooling)
 .-----.          .-----.              .-----.            .-----.
( icon  )        ( icon  )            (#icon  )          ( icon  )   rim goes strain-red (exists)
 '-----'          '=====' <- lit ring   '-----'           '-----'
 bright rim       drains clockwise     dark sweep         
 (exists)         = something of       (exists)
                  yours is out in
                  the world
```

**LIVE** is new (N13). It shows while a window, a decoy or an anchor is out:
Ward, Mirror Ward, Brace, Anvil, Lure, Plumb Line. A **lit** ring draining
(something is active) reads as the opposite of the **dark** sweep (something is
charging), so the two never get mixed up. The cooldown sweep starts when the
live ring runs out.

**Strain pips.** Parts that cost strain on an ordinary cast carry small ember
dots on the lower rim of the button: Coil ●, Borrowed Time ●●, Brace ○ (a hollow
dot, because the cost is conditional). They are always visible, so the price is
on the button before you press it.

### Player-facing words

The card text uses the HUD's own nouns and the gesture itself. It never uses
code words.

| code | player sees |
|---|---|
| push | "held while it recharges" (the gesture) |
| strain | "strain" (the top meter is labelled STRAIN) |
| HP | "integrity" (the bottom meter is labelled INTEGRITY) |
| part | "part" (the pickup card's noun) |
| cooldown | "recharges" |

---

## 2. New primitives this pass needs

Each one is small and reused by several parts. The spec pass decides where they live.

| id | primitive | what it is | used by |
|---|---|---|---|
| **N1** | cold tell variant | `tellMaterial(style, radius, COLD, COLD_DEEP, { cold: true })` sets a `uCold` uniform. In the shader, ripples run inward (`+ uTime`), the fbm is quantised to facets (`floor(noise*5)/5`), and the edge is dashed (radial: `step(.45, fract(atan(w.y,w.x)/6.283*16))`; strip: dashes along `vUv.y`). Plus a `uClose` 0→1 uniform that shrinks the ring's outer radius toward its true radius (the G2 clock) | Flare, Signal Flare, Lure, Clamp Toss, Anvil, Frost Trail, Plumb Line |
| **N2** | `beam(from, to, width, life, y)` and `tether(a, b)` | a flat strip mesh with the N1 strip shader, fading over `life`. `y` lets it sit at wall-top height so barriers never hide it. `tether` is the same mesh kept alive and re-posed every frame | Cracked, Ricochet, Through-Line, Piston, Rusted Hook, Overrun, Plumb Line |
| **N3** | status badge | a billboard of 3 short cold bracket ticks at head height, orbiting slowly, scaled to `radius × 1.3` (minimum 0.45 u on screen). A `close` uniform pulls the ticks inward as time runs out. `consume()` slams them to a point; `expire()` fades them | Signal Flare mark |
| **N4** | frost | (a) `vfx.frost(at, count, radius)`: glow-pool motes with `vy` −0.4…−1.0 and light drag, i.e. embers falling. (b) a per-enemy `rime` 0..1 that lerps its shell materials toward `0x9fb4c8`, bottom-up | Chill Vent, Frost Trail |
| **N5** | shell | an open-ended cylinder of radius r and height 1.1 around Still, with the N1 strip shader wrapped vertically into 10 facets. A `uDrain` uniform clips its top edge downward over the window | Ward, Mirror Ward |
| **N6** | breach | per wall cell: the barrier mesh at 30% opacity, and a cold rim (4 glowing edge strips) that burns shorter over 4 s and flickers in the last 1 s. The rim flares **ember** for 0.1 s whenever an enemy shot or aim line passes through | Through-Line |
| **N7** | decoy | `Still.spawnGhost()` with a held life, opacity 0.55 pulsing 0.45↔0.65 at 1.3 Hz, and a lit lens | Lure |
| **N8** | strain pip | a DOM dot (ember, 7 px) that flies from its source (a button, or Still's screen position) to the strain meter in 0.35 s ease-in. On arrival the meter ticks (+1 px bump) and the fill steps. One pip = one strain point, capped at 4 visible (a +6 shows 4 pips, then the meter steps) | every strain cost, pushes included |
| **N8b** | strain notches | small tick marks on the strain meter, drawn only while a part that cares about them is equipped | Frayed Cleaver (6 and 12) |
| **N9** | tell break | shatters an enemy's live ember tell: opacity to 0 at once, 12–16 **cold** sparks along its outline, the windup tone hard-cut. Their heat broken by his cold | Parry Clamp, Frost Trail (charger trip) |
| **N10** | recent-damage ghost | the INTEGRITY meter shows damage from the last 1.5 s as a pale segment that trails behind the fill | Borrowed Time |
| **N11** | `vfx.gather(at, count, radius, col)` | sparks spawned on a ring that fly **inward** to a point (the inverse of `sparks`) | Patient Lens, Backdraft Vent, Through-Line, Borrowed Time |
| **N12** | lob mover | a parabolic flight over `T` with a peak height `h`, calling `trail()` each frame. For thrown enemies, it drives their `group.position.y` | Flare, Signal Flare, Clamp Toss |
| **N13** | per-part icons and the LIVE face | the icon comes from part `id`, not `shape`. Some icons have states (Patient fill, Frayed width, Plumb anchor/snap, Overrun halves). LIVE is a lit conic ring that drains | all |

**Rig additions (R1).** None of these change behaviour.
- Expose `lens` (the group inside the head), `core` (the EYE ball in the cage) and
  `jawL`/`jawR` (the clamp's jaw boxes) as fields.
- Reset `head.rotation.y/z`, `lens.rotation.z`, `grp.y` and the jaw offsets at the
  top of `animate()`, the way `torso.ry` is reset today.
- Give `attack()` an optional `holdS`: the pose at `k = 1` is held for `holdS`
  before releasing over 0.1 s. That's what the stances use.
- Add a `hop(h, ms)` to go with `startDash`, adding a parabola to `grp.y`.
- Give `trail()` a `life` argument (today it's fixed at 0.18).

---

## 3. Status effects on enemies: one visual language

Everything here is cold. It all sits on the enemy's body or above its head,
never on the floor (G5).

| status | from | what you see | countdown | end |
|---|---|---|---|---|
| **Marked** | Signal Flare (4 s) | three cold **brackets** orbiting at head height (N3). This is the same reticle as Signal Flare's icon, so the button explains the badge | the brackets close inward over the 4 s | **consumed**: they slam shut to a point, two flashes 60 ms apart, a doubled hit sound. That's the "twice", made visible. **Expired**: a quiet fade |
| **Slowed** | Chill Vent, Frost Trail (3 s) | **rime** creeping up from the feet (N4b, to 0.35), falling cold motes (2 per second, N4a), and the walk bob visibly slower (it already scales with speed) | the rime recedes downward | 3 pale chunks fall off, plus a tiny glass tick |
| **Staggered** | any shove above 1.5 u/s (0.2–0.38 s) | motion only (G7): the slide, dust at the feet, the body tipping back 0.15 rad, cold sparks at the contact point on the shove frame | – | – |
| **Windup broken** | Parry Clamp | the ember ring shatters into cold shards (N9). The hulk's core blinks dark for 0.2 s and it stumbles back | – | – |
| **Decoyed** | Lure | the enemy turns to face the decoy. Their own ember tells, which are drawn around themselves, now point at it. **No extra glyph**: the facing *is* the read | – | when the decoy bursts they snap back to Still (a head turn) |
| **In flight** | Hook, Clamp Toss | a cold `trail()` on the body during the yank or throw (G7) | – | landing dust |
| **Breach** (terrain) | Through-Line (4 s) | the barrier cell goes see-through with a cold rim (N6) | the rim burns shorter; it flickers in the last second | a soft stone-settle sound, then dust. The cover is back |

**Two things a status must never look like:**
1. **The elite aura** (a blue floor ring under the leader, `0x7d98ff`, static).
   Statuses are on the body, animated and bracketed. See §9, Q1: the aura's blue
   sits inside Still's cold family, which blurs G1 slightly.
2. **A hit flash.** Enemies already flash when struck. Statuses stay steady and
   quiet so the hit flash keeps its meaning.

**Crowd rule (swarm, 6–8 bodies at r 0.3).** With more than 5 marked enemies on
screen, each badge drops to a single steady bracket over a faint tint. Rime
never scales up, and motes are capped at 12 across all enemies.

**Windups the slow can't touch.** Chill Vent never slows a windup. The read
teaches this without words: a rimed hulk's ember disc still fills at full speed
while its legs crawl. The contrast shows that its walk is slowed and its attack
isn't.

---

## 4. Strain and push: learning it without a tutorial

The player already knows one thing: holding a recharging button turns its rim
strain-red and fires it, and embers fly off Still. Everything below builds on
that one lesson.

**1. Strain is something you can watch move (G6, N8).** Every strain point spent
produces an ember pip that flies to the meter at the top centre. The top centre
is the one HUD spot no thumb covers, so the flight crosses the whole screen and
you catch it from the corner of your eye. Pushes, Coil casts, Borrowed Time
casts and Brace-converted hits all use the same pip. After two sightings the
pip *means* strain.

**2. The price is printed on the button.** Parts that cost strain every cast
carry ember rim pips (§1). The pickup card shows the same pip next to the name,
so the card and the button agree before you take the part.

**3. Parts that change when pushed show what the push buys.** Their icon has
two halves. The plain half is always lit. The pushed half sits at 35% while the
button is ready and turns **ember** while it's recharging, which is exactly when
a hold would push it. The button is telling you that holding it now does
something different.
- **Patient Lens**: the pushed half is the full-charge fill. See the touch flow in §5.
- **Overrun**: the pushed half is the long arrow.
- The first time a push-shaped part starts recharging, its ember half pulses
  once. That happens once per save, never again.

**4. The part that reacts to strain shows the dependency twice.**
**Frayed Cleaver** puts notches on the strain meter at 6 and 12 (N8b) while it's
equipped, and its button icon redraws at 90°, 180° or 360° to match. When strain
crosses a notch, the arms button pulses, the icon redraws with a tear, and a
thread of embers comes off Still's clamp. A quiet (−2) that takes you back
below a notch plays the reverse: the icon narrows with a soft click. So the
player sees the meter, the icon and the swing change together, and the link
teaches itself.

**5. The last push is always honest and always a choice.** The Balancer asked
(#19) whether the button should warn at 18+. **Decision: warn, never block.**
- When the next push (or Coil cast, or Borrowed Time cast) would reach 20, the
  strain meter's last segment is outlined, and that button's pushable rim
  changes from a bright strain-red to a **slow, dim** pulse at 0.6 Hz, like a
  tired heartbeat. The part still fires.
- The pip that crosses 20 doesn't tick into the meter. It lands, the meter fills,
  and the existing wind-down starts. Stopping should feel like a sigh, not a
  buzzer. Nothing flashes red.

**6. Brace is the one part where getting hit spends strain.** During its window,
a hit doesn't flash integrity. It becomes an ember spark that flies *into
Still's cage*, a pip goes to the meter, and it sounds like a bell and a grind
instead of the hurt sound. The integrity bar visibly doesn't move. The player
sees the cost change meters.

---

## 5. Touch flows (all on one button)

Base rules, unchanged: **tap a ready button** and it fires on release. **Hold a
recharging button for 180 ms** and it pushes, firing at the threshold rather
than on release.

| part | press 1 | while live / recharging | press 2 | notes |
|---|---|---|---|---|
| **Patient Lens** | tap when ready (1.5 s or more since the last shot) fires at the current charge | during the 1.5 s after a shot the button is recharging, so a **hold pushes a full shot** (32) | – | the face shows charge as a fill inside the lens (dim to bright). While recharging, the fill is drawn **ember and full**, which is the push offer. At a full natural charge (7.5 s) the rim clicks bright once |
| **Overrun** | tap when ready = the short step | while recharging (7 s), a **hold = the charge** (+2 strain) | – | under the current push rule the charge is only reachable after a step. See §8, flag 1 |
| **Plumb Line** | tap = plant the anchor. The face swaps to the **snap** glyph with a LIVE ring draining over 5 s | while the anchor is live, holding does nothing extra: no push, no strain. It fires on release like a tap | tap = snap. Then the cooldown sweep | beyond 10 u the snap glyph shows a **broken tether**. A press then shakes the button, gives a soft denied tick and **keeps the anchor** (the spec needs to confirm this). A push while recharging after a snap plants a new anchor at once for +2 |
| **Ward / Mirror Ward / Brace / Anvil / Lure** | tap opens the window, or drops the decoy. Face = LIVE draining | – | – | the cooldown sweep starts when LIVE ends. A push while recharging reopens the window at once for +2 |
| **Borrowed Time** | tap = rewind | – | – | the face always shows its ●● pips. A push costs +4 (Balancer): **4 pips** fly |
| **Coil** | tap = the volley | 1.2 s recharge | – | ● on every cast. Its fast rhythm makes the pip stream the lesson: tapping it five times sends five embers up to the meter |

---

## 6. The parts

Each block gives: **Card** (the pickup line), **Read** (what tells you it fired
and where it landed, and what it could be confused with), **Beat** (Still's
body), **VFX**, **SFX**, and **Icon** (24×24, stroke 2, round caps, the same
wrapper as `hud.ts`).

Pushed casts of every part keep the existing push dressing: pitch ×0.8, gain
×1.3, `grind()`, embers off the joints, and a bigger scale punch. Only parts that
*behave* differently when pushed get a pushed line.

SFX shorthand: `saw 600→2600 .06` = `tone('sawtooth', f0, f1, dur)`.
`hp-hiss 3k→6k .12` = `hiss(..., 'highpass', f0, f1)`, and similarly `bp-` and
`lp-`. `+metalLight @1.8 ×.3` = `sample('metalLight', gain .3, rate 1.8)`.

---

### HEAD: reaches far

The shared read for the slot: the lens moves, and the effect leaves from `lensPoint()`.

#### H1. Focusing Lens (white, bolt). Unchanged
- **Card:** A heavy bolt at the nearest enemy.
- **Read:** a fat cold bolt with a trail (`trail` size 0.34) and a small impact
  ring. There is nothing like it on the enemy side, because sentinel shots are
  ember and thinner.
- **Beat (0.30 s):** the existing one. The lens kicks back and up, and the body rocks after it.
- **VFX:** existing (`flash` at the lens, 10 forward sparks, trail, `ring(.2→.8)`).
- **SFX:** existing bolt voice.
- **Icon:** existing. A lens with the beam leaving it.
  `<circle cx="7" cy="12" r="3.5"/><path d="M11.5 12H21"/><path d="M17 8.5 21 12l-4 3.5"/>`

#### H2. Flare (white, lob)
- **Card:** Lobs a burst over walls onto where the enemy was standing.
- **Read:** the landing mark appears **the instant you cast**: an N1 cold ring
  contracting from 2.6 to its true 2.0 over the 0.8 s flight (G2). The glob
  climbs visibly (N12, peak 3.2 u) with a trail, so you can see it clear the
  wall. On landing: a flash, `ring(.3→2.0)` and dust.
  *Confusable with* a chaser's strike ring. The ring differs in colour, in
  contracting instead of filling, in its dashed edge, and in having **no inner
  disc**. In the Assembler's arena, cold floor marks also mean the shockwave's
  safe lanes, but lanes are strips, never circles.
- **Beat (0.34 s):** the lens **looks up**: `head.rx → −0.7` by k 0.3, a short
  crouch into the toss (`grp.y −0.06`, `legL.rx = legR.rx = +0.2`), then release
  with `torso.rx 0.16 → 0.02` and a settle. The upward lens is the whole
  difference from a bolt: a bolt kicks the lens *back*, a lob *lifts* it.
- **VFX:** cast: `flash(lens, COLD, .6)` and 6 sparks. Flight: a small glow
  sphere with `trail(COLD, .26, life .25)`. Land: `flash(COLD_DEEP, 1.2)`,
  `ring(.3→2.0, .35, STEEL)`, `dust(10, r 1.2)`, 16 sparks at speed 6.
- **SFX:** cast is a hollow *thoop*: `sine 380→620 .09` (it rises, because it goes
  up) plus `bp-hiss 1.2k→600 .12 Q1.5`. The landing, panned to where it lands,
  is a small nova: `sine 160→50 .22`, `lp-hiss 3k→300 .25`, `+softMedium @1.1 ×.5`,
  `+metalLight @1.5 ×.3`. **No whistle in flight**: the enemies' windup tone is a
  telegraph and must not be masked.
- **Icon:** a trajectory arc onto a ground ellipse.
  `<path d="M3.5 18C5.5 6 13.5 4 17.5 14"/><ellipse cx="17.5" cy="18" rx="4" ry="1.8"/>`

#### H3. Cracked Lens (blue, pierce)
- **Card:** The bolt passes through every enemy it hits. Walls still stop it.
- **Read:** a thinner bolt with a **long-lived** trail (life 0.35), so the whole
  line stays lit for a moment and you see the row it went through. Each enemy it
  passes throws sparks out of its **far side**. That exit spark is the
  "through".
- **Beat (0.26 s):** the Lens kick at 0.8× (`head.rx −0.36`), plus a crack-twitch
  where `lens.rz` snaps +0.3 and back in 0.1 s.
- **VFX:** `flash(.6)`, 6 sparks at spread 0.25, `trail(COLD, .16, life .35)`. On
  each pass-through: 5 sparks along the bolt direction (spread 0.3) and
  `ring(.2→.6)`. At a wall: a ring plus 3 grey `chunks`.
- **SFX:** the bolt voice, thinner: `saw 800→3200 .05`, `sine 3000→500 .16`,
  `hp-hiss 4k→7k`. Each pass-through adds a tick, `+metalLight @2.0 ×.3` with
  `tri 1800→1500 .03`, **pitched up two semitones per enemy**, so a line of
  three rises like a scale.
- **Icon:** a cracked lens, with a beam through two ticks.
  `<circle cx="6" cy="12" r="3.5"/><path d="M5 8.8 6.5 11 5 13"/><path d="M10.5 12H22"/><path d="M14.5 8.5v7M18.5 8.5v7"/>`

#### H4. Ricochet Lens (blue, bounce)
- **Card:** A bolt that bounces off walls to reach enemies behind cover.
- **Read:** you didn't pick the angle, so at cast the whole path flashes as a thin
  N2 beam (width 0.1, life 0.15, drawn at **wall-top height**) before the bolt
  travels. Each bounce makes a cold flash and a reflected spark fan on the wall
  top. **The answer shot** (the enemy's side) is the sentinel's ember aim strip
  drawn **bent** at the same wall, with the bend marked by an ember tick at
  wall-top height so the barrier never hides it.
  *Confusable with:* the cold pre-path is a line, and so is the enemy's aim line.
  The two differ in colour, width (0.1 against 0.62), and lifetime (0.15 s
  against the whole windup).
  *Before you press:* when the button is ready, the nearest enemy has no clear
  line, and a bank exists, a single small cold tick glows on the wall where it
  would bounce. That's one mark, not a line.
- **Beat (0.30 s):** the Lens kick (`head.rx −0.4`) plus a cant, `head.rz ±0.25`
  toward the bank side, so the head reads "at an angle".
- **VFX:** the bolt's normal flash and sparks, `trail(COLD, .2)`. Per bounce:
  `flash(COLD, .5)` at wall top, 8 sparks reflected (spread 0.6) and 2 grey chunks.
- **SFX:** the bolt voice, plus a *ping* per bounce: `+tin @1.8 ×.5` with
  `tri 2200→1600 .05`, the second bounce a fifth higher. **The enemy answer shot
  gets the same ping at its bounce.** You hear the symmetry.
- **Icon:** a lens, a V off a wall line, and an arrowhead.
  `<circle cx="5" cy="5.5" r="2.5"/><path d="M7 8l5.5 11L18 8"/><path d="M15.2 8.6 18 8l.6 2.8"/><path d="M8 20.5h9"/>`

#### H5. Patient Lens (blue, charge)
- **Card:** Hits harder the longer you wait. Held while it recharges, it fires full.
- **Read:** the charge lives **on Still**: the lens glass brightens with charge,
  and at full, cold motes (N11 `gather`) drift into the lens, 2 per 0.2 s. The
  bolt's visual size scales with the damage (0.3 to 0.85), so a weak shot
  *looks* weak and a full one looks like a Focusing Lens. At full charge a small
  cold ring pops around the lens, once.
- **Beat (0.26–0.40 s):** kick = 0.2 + 0.5 × charge. A full shot also plants a
  foot for recoil (`legR.rx +0.35`) and rocks the torso back (`torso.rx −0.05`),
  and the duration stretches to 0.4 s. A weak shot is a lens twitch.
- **VFX:** `flash(lens, .4 + .8c)`, sparks `4 + 12c`, trail size `.14 + .2c`,
  impact `ring(.2→.4 + .8c)`.
- **SFX:** reaching full plays one glassy tick, `sine 2637 .12 ×.08` with
  `tri 1318 .1`. There is no charging drone, because that would be clutter. The
  shot is the bolt voice with its sine tail lengthened by charge (0.2 to 0.35 s)
  and dropped by a third at full. A full shot adds `+metalMedium @1.2 ×.5` for
  weight.
- **Pushed:** always fires at 32. It plays and sounds exactly like a full shot,
  plus the push dressing.
- **Icon:** a lens whose inner disc is the live charge, plus a gathering beam.
  The inner disc's `fill-opacity` equals the charge. While the button is
  recharging it's drawn ember at 1.0 (the push offer, §4.3).
  `<circle cx="8.5" cy="12" r="5.5"/><circle cx="8.5" cy="12" r="2.2" fill="currentColor" stroke="none" class="charge"/><path d="M16 12h1M19.5 12h2.5"/>`

#### H6. Signal Flare (blue, lob + mark)
- **Card:** Marks enemies where it lands. Your next part hits a marked one twice.
- **Read:** the same lob grammar as Flare (the N1 landing ring, 2.2), but the
  glob **sputters** (it sheds a spark every 0.1 s) and the landing is bright
  rather than heavy. Every enemy caught gets the **mark** badge (§3). The payoff
  read is the badge slamming shut with two flashes when another part hits.
  Auto-attack hits don't touch the badge, so the auto never seems to "waste" it.
- **Beat (0.30 s):** Flare's look-up, plus a flick on release, `lens.rz +0.35`
  and back. The lens signals.
- **VFX:** flight: `trail(COLD, .3)` and the sputter sparks. Land:
  `flash(COLD, .8)`, `ring(.3→2.2)`, 10 sparks, **no dust**, then N3 on each hit.
- **SFX:** cast as Flare. Land is a chime rather than a thud: `tri 1760 .25 ×.12`,
  `sine 2637 .2`, a short `hp-hiss`. The mark consumed plays a **doubled** hit,
  two `+metalLight @1.6` 60 ms apart over `tri 1318 / 1976`. You hear "twice".
- **Icon:** a lob into a reticle. The same brackets as the badge, so the button
  explains the badge.
  `<path d="M3 19C4.5 8 11 5 15.5 11"/><path d="M13 15v-2h2M19 13h2v2M13 19v2h2M21 19v2h-2"/>`

#### H7. Through-Line (gold, pierce all)
- **Card:** A bolt through enemies and walls. The holes it leaves let shots through both ways.
- **Read:** a near-instant line, an N2 beam 16 u long (width 0.18, life 0.2) with
  a bright head travelling along it. **The important read is the breach (N6)**:
  every wall cell it crossed goes see-through with a burning-down cold rim.
  When you're crouched behind a breached cell, you see the sentinel's ember aim
  line pass straight through your cover, and the rim flares ember as it does.
  That flare is the lesson: *you opened this.*
- **Beat (0.42 s, the biggest head beat):** a **draw** for 0.12 s (`head.pz −0.06`,
  `gather` into the lens) with the legs bracing (`legL.rx +0.25`, `legR.rx −0.25`),
  then the release (`head.rx −0.55`, `torso.rx 0.16 → 0.0`) and a visual recoil
  of the group 0.15 u backwards, eased back. It's the only head part that moves
  his whole body.
- **VFX:** draw: `gather(lens, 10, .6, COLD)`. Fire: `flash(lens, COLD, 1.1)`, the
  beam, and sparks at each enemy pierced. Per wall crossed: stone `chunks(6)` and
  `dust` on **both** faces.
- **SFX:** the bolt voice stretched low: `saw 300→3200 .1`, `sine 3200→120 .4`,
  `hp-hiss`. Per wall crossed: `+mining @1.2 ×.6` and `+plateHeavy @1.4 ×.3`.
  The breach closing plays `+generic @.8 ×.25` with `lp-hiss 800→200 .2`, soft,
  so your ear tells you your cover is back.
- **Icon:** a beam through a broken wall.
  `<path d="M2 12h18"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M10 3.5v5M14 3.5v5M10 15.5v5M14 15.5v5"/>`

#### H8. Overclocked Coil (gold, 3-bolt fan, +1 strain per cast)
- **Card:** Three bolts at once, ready fast, but every shot adds strain.
- **Read:** three thin trails fanned ±15°, each ending on a different enemy.
  **The cost read:** one ember pip flies from the button to the meter on every
  cast (N8), and 4 small embers come off the lens stalk. That's a tenth of a
  push's embers, but it's the same colour and the same place.
- **Beat (0.22 s, short because the cooldown is 1.2 s):** `head.rx −0.3`, plus a
  coil shiver: `lens.rz` oscillating ±0.08 at 30 Hz for 0.15 s.
- **VFX:** three small flashes fanned at the lens, `trail(COLD, .16)` per bolt,
  4 sparks per hit, `embers(head joint, 4, .15, EMBER)`.
- **SFX:** three short bolt voices staggered 12 ms (`saw 900→3000 .04`,
  `sine 2800→400 .12`) plus a **small grind** every cast: `square 110→98 .18`
  through the 320 Hz bandpass at ×0.15. The push grind, a little of it every
  time, so the ear learns this part runs on strain.
- **Icon:** a coil and three rays.
  `<path d="M2 9l2 6 2-6 2 6"/><path d="M11 12h10M10.5 10 20 5.5M10.5 14l9.5 4.5"/>`

---

### TORSO: works around Still

The shared read for the slot: the cage and core move, and effects centre on Still.

#### T1. Pressure Vent (white, nova + shove). Unchanged
- **Card:** A blast around you that shoves enemies away.
- **Read / Beat / VFX / SFX:** existing (the cage bursts open, `ring(.3→4.3)`,
  flash, 26 sparks, dust, the nova voice).
- **Icon:** existing. Rays around a small core.
  `<circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/>`

#### T2. Ward (white, ring shield)
- **Card:** A brief shield that destroys enemy shots.
- **Read:** an N5 **shell** of vertical cold facets at 1.8 around Still. Its top
  edge drains downward over 1.4 s (G2). A shot that meets it turns from ember to
  cold sparks at the contact point. A shell is vertical and moves with Still, so
  nothing on the enemy side or the elite aura looks like it. It does nothing to
  melee, so a hulk's ring just keeps filling through it. The part tells you
  that truthfully without any text.
- **Beat (0.35 s + stance for the window):** the cage pulls in (`torso.s .9`), both
  arms come up and cross in front (`armL.rx, armR.rx −0.6`, `armL.rz +0.5`,
  `armR.rz −0.5`), and the head ducks (`head.rx +0.2`). Held with `holdS` = the
  window, eased out as the shell drains.
- **VFX:** `flash(core, COLD_DEEP, .6)`, the shell, and a contracting floor
  `ring(1.9→1.8, .3)` so the edge of the zone shows on the floor too. Per shot
  destroyed: 8 COLD sparks and a small flash.
- **SFX:** a glassy close: `tri 880→660 .1`, `sine 1320 .3 ×.1` (shimmer),
  `bp-hiss 5k→3k .2 Q3`. Each shot destroyed: `+tin @1.4 ×.5` and
  `tri 1760→1200 .05`, a *ting*.
- **Icon:** a dashed ring around a core.
  `<circle cx="12" cy="12" r="8.5" stroke-dasharray="4.2 2.5"/><circle cx="12" cy="12" r="2.5"/>`

#### T3. Backdraft Vent (blue, nova + pull)
- **Card:** The blast drags enemies in instead of out.
- **Read:** the existing inward ring (5.2 → 0.3), plus sparks and dust visibly
  drawn *toward* Still (N11, negative dust speed). Everything on screen moves
  inward.
- **Beat (0.42 s):** the reverse of the nova: the cage swells first (`torso.s 1.15`
  by k 0.3) with the arms flung wide (`armL.rz −1`, `armR.rz +1`), then collapses
  (`torso.s .85`) as the arms sweep in. He *inhales*.
- **VFX:** `gather(Still, 26, 5.2, COLD)`, inward dust, the existing ring, and a
  `flash(core)` at the end, when they arrive.
- **SFX:** the nova reversed: `sine 38→120 .35` (rising), `lp-hiss 250→4k .4`
  (opening), ending on `+softMedium @1.0 ×.6` as they land. A reverse swell
  reads as suction.
- **Icon:** four arrows pointing into a core.
  `<circle cx="12" cy="12" r="2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><path d="M10 5.5l2 2 2-2M10 18.5l2-2 2 2M5.5 10l2 2-2 2M18.5 10l-2 2 2 2"/>`

#### T4. Chill Vent (blue, nova + slow)
- **Card:** A cold blast that makes enemies walk slowly for a while.
- **Read:** a slower expanding ring (life 0.55 against the Vent's 0.45) in the N1
  frost variant, with falling motes at its edge. It has no shove, so the enemies
  don't move. What changes is them: **rime** climbs their legs and they slow
  (§3). The windup contrast (a rimed hulk, a full-speed ember disc) teaches the
  "attacks aren't slowed" rule by itself.
- **Beat (0.42 s):** the nova beat as an exhale: the cage swells to 1.25 and holds
  through k 0.6, the head tips back (`head.rx −0.25`), and the arms stay lower
  than the Vent's (`rz ±0.6`).
- **VFX:** `ring(.3→4.3, .55, STEEL)`, `frost(edge, 20)`, `flash(core, COLD, .6)`,
  **no dust** (nothing is pushed).
- **SFX:** a softer nova, `sine 120→60 .4 ×.6`, plus icy air
  `hp-hiss 6k→2.5k .6 ×.4` and a frost tinkle: 6 × `tri` at 2349 or 3136 Hz,
  0.04 s each, 50 ms apart, ×0.05.
- **Icon:** a snowflake.
  `<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>`

#### T5. Brace (blue, damage to strain)
- **Card:** For a moment, hits cost you strain instead of integrity.
- **Read:** a small cold `ring(.3→2.6)` (the 8-damage blast), then for 0.8 s
  **the cage bars glow ember**. It's the only time Still's own body is warm
  outside a push, because this part *is* strain. A hit during the window flies
  into the core as ember sparks, a pip goes to the meter (N8), and the
  integrity bar doesn't move (§4.6). A Brace-converted hit that Stops Still
  plays the wind-down, not the shatter: the intended soft ending.
- **Beat (0.40 s + stance for 0.8 s):** he plants: legs spread (`legL.rx +0.3`,
  `legR.rx −0.3`), `grp.y −0.08`, `torso.rx +0.35` (leaning into a wind), arms
  down and out (`rz ±0.4`), head low (`head.rx +0.25`). Held for the window.
- **VFX:** `flash(core, COLD_DEEP)`, the ring, and `embers(cage, 2 per 0.1 s,
  .25, EMBER)` during the window. Per converted hit: 10 EMBER sparks aimed at
  the core, plus the pips.
- **SFX:** setting: `square 90→70 .12` through a 600 Hz lowpass,
  `+plateHeavy @.9 ×.6`, a short `bp-hiss`. A converted hit **replaces** the hurt
  sound with `+bell @1.3 ×.35` and a short `grind()`. It sounds like strain,
  not damage.
- **Icon:** an arrow meeting a plate, absorbed into layers below.
  `<path d="M12 2.5v8"/><path d="M8.5 7 12 10.5 15.5 7"/><path d="M4 14h16"/><path d="M6.5 18h11M9.5 21.5h5"/>`

#### T6. Mirror Ward (blue, reflect)
- **Card:** A brief shield that sends enemy shots back at whoever fired them.
- **Read:** Ward's shell, brighter (hot = pure `COLD` white), with a highlight
  sweeping around it once per 0.4 s. It drains in 0.8 s, visibly faster than
  Ward. A reflected shot **changes colour in flight**: its ember trail becomes
  Still's cold trail and it flies back. The colour switch *is* the read: it's
  his shot now.
- **Beat (0.30 s + stance for 0.8 s):** the opposite of Ward. The arms fling
  *open* (`armL.rz −0.6`, `armR.rz +0.6`), the cage swells to 1.1, and the chest
  is presented.
- **VFX:** the shell with a sweep highlight. Per reflection: `flash(COLD, .5)`,
  then the projectile recoloured to a cold `trail(.18)`.
- **SFX:** the shell rises: `tri 1320→1760 .08`, `sine 2640 .25` shimmer. Each
  reflection plays `+tin @1.9` and a mini bolt voice, `saw 800→2400 .05`, so the
  returned shot *sounds like Still's bolt*.
- **Icon:** a mirror arc with an arrow bouncing off it.
  `<path d="M16 3.5a9 9 0 0 1 0 17"/><path d="M3 5.5 13.5 12 3 18.5"/><path d="M4.7 15.1 3 18.5h3.8"/>`

#### T7. Lure (gold, decoy)
- **Card:** Leaves a decoy of you that enemies go after, until it bursts.
- **Read:** a translucent cold copy of Still (N7) with its lens lit and blinking,
  sending out a small contracting N1 pulse ring every 0.75 s: *calling*. Enemies
  turn to face it (§3). In its last 0.6 s the burst area (3.0) is drawn as an N1
  ring closing to its true size, so you can see where it will hit them. The
  ring is harmless to Still, and the cold says so. Against the Assembler, the
  boss's lens simply doesn't turn while its adds do. That's all the "the boss
  isn't fooled" read needs.
  *Risk:* see §8, flag 2 (it spawns on top of you).
- **Beat (0.35 s):** he leaves something behind. The cage opens (`torso.s 1.2`),
  the lens flares, the decoy is spawned in his exact pose, and he dips his head
  (`head.rx +0.3`) and settles smaller (`grp.s .96` for 0.2 s).
- **VFX:** `flash(core, COLD)`, the decoy and its pulse rings. Burst:
  `flash(COLD, 1.4)`, `ring(.3→3.0, .4)`, 30 sparks, 12 dust, and the decoy
  shattering into 8 cold-tinted `chunks`.
- **SFX:** cast: a doubled voice, `sine 660` and `sine 663` for 0.4 s (a slow
  beat, *two of him*), plus a light `hp-hiss`. While alive, a quiet beacon
  `sine 1318 .08 ×.06` every 0.75 s, panned to the decoy. Burst: the nova voice,
  `+bell @1.1 ×.4`, `+tin`. **Avoid the triangle cluster at 520–1490 Hz**: that
  is `shatter()`, the HP-death sound, and the decoy breaking must never echo
  Still breaking.
- **Icon:** a small figure (lens head, cage) with signal arcs on both sides.
  `<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5V11"/><path d="M8.5 11h7l-1 8.5h-5z"/><path d="M4.5 9a8 8 0 0 0 0 7M19.5 9a8 8 0 0 1 0 7"/>`

---

### ARMS: close

The shared read for the slot: the clamp (left) or hook (right) leads, and every
hit makes a sweep sector on the floor. With the clear-line rule (Balancer #2),
**a target behind a wall gets no spark and no hit sound**. The swing visibly
fails to reach it, and that alone teaches the rule.

#### A1. Scrap Cleaver (white, 120° arc). Unchanged
- **Card:** A wide swing at whatever is closest.
- **Read / Beat / VFX / SFX:** existing.
- **Icon:** existing. A crescent.
  `<path d="M4 19C6 10 12 5 20 4"/><path d="M8 20.5c2.5-6 6.5-9.5 12-10.5" opacity=".55"/>`

#### A2. Piston (white, 40° jab + shove)
- **Card:** A hard, narrow punch that knocks one enemy back.
- **Read:** a **long thin** cold strike (an N2 beam 3.4 × 0.5, life 0.15) inside a
  narrow `sweep(3.4, 40°)`. The Cleaver's is a wide fan, so the two slot whites
  never look alike. The struck enemy slides back with dust at its feet.
- **Beat (0.28 s):** straight, no lunge (no magnetism). Wind: `armL.rx +0.6`
  (elbow back), `torso.ry +0.35` (coil). Release: `armL.rx −1.6` (arm dead
  straight) in 0.06 s, `torso.ry −0.2`, `torso.rx +0.2`. The jaws close
  (`jaw x ±.06 → ±.02`) at the extension.
- **VFX:** the beam and sweep. At contact: 12 sparks forward (spread 0.3) and
  `flash(.6)`. `dust(8)` along the enemy's shove.
- **SFX:** a short whoosh, `bp-hiss 800→2.4k .06 Q2`. On hit: `+punchHeavy @1.1 ×.8`,
  `+metalMedium ×.4`, and a piston thunk `square 120→60 .06`. On a miss: the
  whoosh plus a pneumatic `hp-hiss 4k .05`.
- **Icon:** a piston rod and head with an impulse arrow.
  `<path d="M3 12h9"/><path d="M12 7.5v9"/><path d="M15 12h6"/><path d="M18 9l3 3-3 3"/><path d="M3 8.5h3M3 15.5h3"/>`

#### A3. Rusted Hook (blue, long arc + yank)
- **Card:** A long, narrow swing that yanks enemies to you.
- **Read:** a long narrow `sweep(5.5, 70°)`, then a **chain**: an N2 tether from
  the hook to each enemy caught, for 0.2 s, while they slide in with a cold trail
  and a dust wake. Nothing else in the game draws a line *to* Still.
- **Beat (0.36 s):** the only part led by the hook arm. Cast: `armR.rx −0.3`, then
  reach `−1.8` by k 0.45. Yank: `armR.rx → +0.4` over the rest, `torso.rx −0.1`
  (leaning back), `torso.ry −0.25` (hauling).
- **VFX:** sweep, tether, 6 sparks per catch, `dust` along each yank path,
  `trail(COLD, .3)` on each yanked body.
- **SFX:** a narrow whoosh `bp-hiss 700→3k .12 Q3`, a chain rattle of
  `+tin @1.2–1.5 ×.3` three times 30 ms apart, and a yank `saw 90→180 .1`
  through a 700 Hz lowpass (rising, toward you).
- **Icon:** a line with a curled hook, and an arrow pointing back to you.
  `<path d="M4 12h13"/><path d="M17 12a3 3 0 1 0 3-3"/><path d="M7.5 8.5 4 12l3.5 3.5"/>`

#### A4. Parry Clamp (blue, windup cancel)
- **Card:** A quick snap. Catch an enemy winding up and it breaks the attack.
- **Read:** a miss or an ordinary hit is a small, plain snip (`sweep(2.6, 90°)`,
  life 0.15). A **cancel** is loud and unmistakable: the enemy's ember ring and
  disc **shatter into cold shards** (N9), its core blinks dark, it stumbles back
  2.5 u, and the game gives it the big hitstop (90 ms). The whole difference
  between the two outcomes carries the part. On the Assembler, the snip lands
  with its damage but the tell doesn't break. A cold spark bounces off the
  ember sector: "not this one".
- **Beat (0.26 s):** a bite. `armL.rx −0.4 → −1.3` in 0.08 s, the jaws slam shut,
  `torso.ry` snaps 0.3 toward the target. On a cancel, the pose freezes for the
  hitstop, then Still recoils half a step (`torso.rx −0.1`).
- **VFX:** the snip sweep. Cancel: N9 on the enemy's tell, `flash(chest, COLD, 1.0)`,
  16 sparks, shove dust, `rig.punch(.05)`.
- **SFX:** snip: `square 1600→900 .03` and `+metalLight @2.0 ×.5`. Cancel: the
  enemy's windup tone **hard-cut**, then `+bell @1.6 ×.6` and `tri 1976→1318 .15`.
  A clang of a broken attack.
- **Icon:** clamp jaws closing on a cross.
  `<path d="M3 6c4.5 0 7.5 2 8.5 6M3 18c4.5 0 7.5-2 8.5-6"/><path d="M15 8.5l6 7M21 8.5l-6 7"/>`

#### A5. Frayed Cleaver (blue, width follows strain)
- **Card:** A swing that grows wider the more strained you are.
- **Read:** the sweep sector at its current width (90°, 180° or 360°) with a
  **ragged edge**: sparks fray off both ends. Threshold crossings are shown on the
  meter, the button and the body together (§4.4). At 12+ the fray sparks turn
  ember, the heat that feeds it.
- **Beat:** 90°: the Cleaver beat at 0.7× yaw (0.30 s). 180°: the Cleaver beat
  (0.34 s). **360°: a full spin**, `torso.ry 0 → 2π` over the release, both arms
  out (`rz ±0.9`), legs planted (0.40 s).
- **VFX:** `sweep(3.1, width)`. The existing arc-spark loop scaled to the width
  (7 / 12 / 20 points). End fray: 3 sparks at each end, EMBER at 12+.
- **SFX:** the arc voice, plus a **tear** that grows with the tier. Tier 1: plain.
  Tier 2: `+tin @.9 ×.3` and a lower-Q hiss. Tier 3: `+grind() ×.5`. You hear
  strain in the swing.
- **Icon, three states** (the arms button redraws live):
  - 90° `<path d="M6.3 9.3A8 8 0 0 1 17.7 9.3"/><path d="M6.3 9.3 4.6 7.6M17.7 9.3l1.7-1.7"/><circle cx="12" cy="15" r="1.2"/>`
  - 180° `<path d="M4 15a8 8 0 0 1 16 0"/><path d="M4 15H2M20 15h2"/><circle cx="12" cy="15" r="1.2"/>`
  - 360° `<circle cx="12" cy="12.5" r="8"/><path d="M6.3 6.8 4.9 5.4M17.7 6.8l1.4-1.4M6.3 18.2l-1.4 1.4M17.7 18.2l1.4 1.4"/><circle cx="12" cy="12.5" r="1.2"/>`

#### A6. Clamp Toss (blue, grab + throw)
- **Card:** Grabs the nearest enemy and throws it the way you're steering.
- **Read:** at the grab, an N1 cold landing ring (1.2) appears where it will land.
  If a wall cuts the throw short, the ring sits against the wall with a bright
  cold tick on the wall top: *it'll hit the wall*. The enemy flies on a visible
  arc (N12, peak 1.5 u) with a cold trail. Landing: a burst and dust, plus a
  spark shower and stone chunks on a wall hit. If the stick is idle, the ring
  appears directly away from Still, which teaches the fallback.
  A Plated elite's ring appears at only 1.5 u. The short throw is visible
  before it happens.
- **Beat (0.40 s):** grab (0–0.12 s): `armL.rx −1.4` with the jaws shut. Wind:
  `torso.ry −0.6` (away from the throw). Toss (0.12–0.40 s): `torso.ry → +1.2`
  toward the throw direction, `armL.rx −1.4 → −2.4` up and over. The enemy
  follows the clamp for the first 0.05 s, then goes on the lob.
- **VFX:** grab: 6 sparks at the clamp. Flight: `trail(COLD, .3)` on the body.
  Land: `flash`, `ring(.3→1.2)`, `dust(14)`, 4 chunks in the enemy's colour. Wall:
  16 sparks, 6 stone chunks, `rig.punch(.04)`.
- **SFX:** grab: `+metalMedium @1.3 ×.5` and `square 200→140 .04` (the bite).
  Throw: a long whoosh, `bp-hiss 400→2k .25`. Land: `+softHeavy @.9 ×.9` and
  `sine 110→40 .2`. Wall: add `+mining ×.7` and `+plateHeavy ×.5`.
- **Icon:** open jaws and a thrown arc with an arrow.
  `<path d="M3 21v-3.5l2-2M9 21v-3.5l-2-2"/><path d="M6 13C7 6.5 13 3.5 20 5"/><path d="M17.5 2.5 20 5l-2.5 2.5"/>`

#### A7. Anvil (gold, catch + counter)
- **Card:** Catches the next blow that would hit you and hammers back. Shots get through.
- **Read:** a **stance**. The clamp raised overhead, a cold glint pulsing at the
  jaws every 0.3 s, and an N1 ring at his feet closing from 1.0 to 0.3 over the
  0.9 s window (G2). **The catch** is the biggest moment an arms part has: the
  enemy's strike pose freezes on contact (hitstop 90 ms), no hurt vignette, no
  integrity loss, then a 360° cold shockwave to 3.0. **A miss** (the window ends)
  is small and honest: the arm lowers, a clink, a puff of dust off the clamp.
- **Beat (0.30 s raise + stance for 0.9 s + 0.30 s slam):** raise: `armL.rx −2.6`,
  `torso.rx −0.1`, legs spread. On a catch, the slam: `armL.rx → −0.3` in 0.08 s,
  `torso.rx +0.4`, `grp.y −0.08`, `torso.s 1.15`.
- **VFX:** raise: a small `flash(clamp)` and the glints. Catch:
  `flash(contact, COLD, 1.4)`, `ring(.3→3.0, .35)`, 34 sparks at speed 10,
  `dust(18)`, 4 metal chunks, `rig.punch(.07)`.
- **SFX:** raise: `+metalLight @.8 ×.3` and a faint `tri 440 .3 ×.05` ring-in.
  Catch: `+bell @.8 ×1.0`, `+metalHeavy @.9 ×.8`, and `sine 90→30 .35` through
  `distorted`. The loudest sound any Still part makes, because it's a payoff.
  Miss: `+tin @.6 ×.2`.
- **Icon:** an anvil with a spark.
  `<path d="M3 7h15.5c0 2.5-2 4-5 4h-.5v3.5h2.5l1.5 4.5H7l1.5-4.5H11V11H8C5 11 3 9.5 3 7z"/><path d="M19.5 3.5 21 2M21 5.5h1.5"/>`

---

### LEGS: move him

The shared read for the slot: ghosts (existing) mean travel, and the body's
height says which kind. **Flat = dash, arc = hop.**

#### L1. Kickstart (white, dash). Unchanged
- **Card:** Dash, running over anything in the way.
- **Read / Beat / VFX / SFX:** existing (ghosts, lean, tucked legs, the dash voice).
- **Icon:** existing. Double chevrons. `<path d="M4 6l6 6-6 6"/><path d="M12 6l6 6-6 6"/>`

#### L2. Skitter (white, hop)
- **Card:** A quick little hop the way you're steering.
- **Read:** a visible **vertical** arc (`hop(.35, 180)`), about six ghosts, a
  dust puff at takeoff and landing. Nothing like a dash's flat lean. It does no
  damage, so there are no sparks: an empty hop looks empty.
- **Beat (0.26 s):** crouch 0.04 s (`grp.y −0.06`, `legL.rx = legR.rx +0.3`),
  spring with the legs tucked (`legL.rx −0.6`, `legR.rx −0.4`) and the arms up
  for balance (`rz ±0.3`), then land with a squash (`grp.y −0.04`, 0.05 s).
- **VFX:** `dust(6, r .3)` at takeoff, `dust(8)` at landing, ghosts.
- **SFX:** Still's own footstep doubled: takeoff `+step @1.6 ×.5` with
  `bp-hiss 1.2k→2.4k .08`, landing `+step @1.4` and `+tin @2.2 ×.1`. Light.
- **Icon:** a small hop arc with an arrowhead and two ground marks.
  `<path d="M4 18c2.5-7 9.5-7 12 0"/><path d="M13.3 16.3 16 18l1.4-2.8"/><path d="M3 21h4M14 21h4"/>`

#### L3. Skid Plates (blue, dash + landing slam)
- **Card:** The dash ends in a blast that shoves enemies away.
- **Read:** the dash, then a skid mark (a short dust line) and the existing
  `ring(.3→2.8)` slam at the landing spot.
- **Beat (0.30 s + 0.12 s skid):** the dash lean, then at the end the legs splay
  forward (`legL.rx +0.6`, `legR.rx +0.3`), `torso.rx −0.2` (leaning back
  against the skid), and a plate slam (`grp.y −0.08`).
- **VFX:** the dash ghosts, `dust(10)` in a line over the last 0.8 u, the slam
  ring, 14 sparks, `flash(COLD_DEEP, .8)`.
- **SFX:** the dash voice, then a scrape `bp-hiss 3k→800 .18 Q2`,
  `+plateHeavy ×.7` and `sine 100→40 .2`.
- **Icon:** double chevrons into a burst.
  `<path d="M3 6.5l5 5.5-5 5.5M9.5 6.5l5 5.5-5 5.5"/><path d="M19.5 6.5V9M19.5 15v2.5M22.5 12H20M21.6 9.9l-1.1 1.1M21.6 14.1l-1.1-1.1"/>`

#### L4. Overrun (blue, push-shaped dash)
- **Card:** A short step. Held while it recharges, a long charge that hits.
- **Read:** the **step** is deliberately modest: 3 ghosts, a little dust, no sparks.
  The **charge** is the loudest movement in the pool: dense ghosts (every 0.02 s),
  an N2 wake 1.4 wide behind him (life 0.3), side-thrown sparks at every enemy
  knocked, and the push embers. The two are so different that the button's
  lit ember half (§4.3) makes sense after one use.
- **Beat:** step (0.22 s): the dash lean at half strength. Charge (0.30 s): a
  ram, with the head down (`head.rx +0.5`), `torso.rx 0.7`, arms swept back
  (`armL.rx, armR.rx +1.2`).
- **VFX:** step: `dust(4)` and ghosts. Charge: ghosts, the wake, per hit 10
  sparks thrown perpendicular to the path plus `flash(.7)`, `dust` every 0.05 s,
  the push embers.
- **SFX:** step: `+step @1.2 ×.5` and a short hiss. Charge: the dash voice
  lengthened (`saw 50→220 .3` through a 1.2 kHz lowpass), `+metalHeavy ×.7` per
  hit, plus the push dressing.
- **Icon, two halves:** the plain chevron, and a long arrow (the pushed half) at
  0.35 while ready and ember while recharging.
  `<path d="M3 7l5 5-5 5"/><path class="push" d="M11 12h9M17 8l4 4-4 4"/>`

#### L5. Frost Trail (blue, dash + ground strip)
- **Card:** A dash that leaves a cold track that slows enemies on it.
- **Read:** an N1 **strip** 1.4 wide along the dash path. It is deliberately
  **static rime**: facets, no flowing chevrons. The flowing strip pattern belongs
  to the sentinel's aim line and the boss's safe lanes, so the frost must not
  move. The strip thins from its edges over 3 s (G2). Enemies on it get rime
  (§3). A charger crossing it **trips**: its ember rush strip shatters (N9), its
  body spins a quarter turn, and frost chunks burst.
- **Beat (0.30 s):** the dash lean, with the trailing leg dragging
  (`legR.rx +0.4`, held), scraping frost.
- **VFX:** the dash ghosts, `frost(path, 1 per 0.03 s)`, a little cold dust, the
  strip mesh.
- **SFX:** the dash voice with its hiss swapped to icy `hp-hiss 5k→3k`, plus ice
  forming: 6 × `tri` between 2000 and 3500 Hz, 25 ms apart, ×0.04. The trip:
  `+tin @1.0 ×.5` and a glass tick.
- **Icon:** chevrons over a hatched track.
  `<path d="M4 3.5l4 4-4 4M11 3.5l4 4-4 4"/><path d="M2.5 17.5h19"/><path d="M5.5 15v5M10 15v5M14.5 15v5M19 15v5"/>`

#### L6. Spring Heels (blue, vaulting hop)
- **Card:** A hop that clears a low wall, landing heavy on the far side.
- **Read:** a **high** arc (`hop(.9, 300)`), twice Skitter's height. It clearly
  goes over the barrier, not through it. The 0.3 s landing lock is the
  **landing pose**: knees buckled, dust ring, head down. You see that he can't
  move yet, so the lock never feels like dropped input.
- **Beat (0.40 s + 0.30 s landing lock on a vault):** a deeper crouch
  (`grp.y −0.1`, legs +0.45), spring with the legs tucked high, then on a vault
  a held squash (`grp.y −0.12`, `torso.rx +0.35`, `head.rx +0.2`) for the lock. A
  hop that doesn't vault skips the lock pose.
- **VFX:** `dust(8)` at takeoff. Vault landing: `dust(12, r .8)` and
  `ring(.3→1.0, .3, 0x8fa3b8)` (the grey the dust rings already use).
- **SFX:** takeoff: `+step @1.2` and a spring `saw 80→160 .12` through a 700 Hz
  lowpass. Vault landing: `+softMedium ×.7`, `+step @.9`, `+tin @1.4 ×.15`,
  heavier than Skitter's.
- **Icon:** a hop arc over a block.
  `<path d="M3 20C5 9 15 9 17 20"/><path d="M8.5 20.5v-4h4v4"/><path d="M14.4 18.3 17 20l1.6-2.7"/>`

#### L7. Plumb Line (gold, anchor then snap)
- **Card:** Drop an anchor, then press again to snap back to it.
- **Read:** the anchor is a small cold **plumb bob** hovering at knee height,
  with an N1 ring at its base draining over 5 s. A faint N2 **tether** (width
  0.06, 30% opacity) runs from Still to it. The tether has two warnings:
  - beyond 10 u it goes dashed and the bob greys out (a snap would fail);
  - where a wall cuts the straight line, the tether **ends at the wall with a
    bright tick**. That's where the snap will stop.
  The snap: a fast pull with ghosts, an N2 wake, and sparks on everything it
  runs over.
- **Beat:** plant (0.30 s): the clamp drops the bob (`armL.rx −0.8 → 0` with
  the jaws opening) as he stomps (`legR.rx −0.5` then down, `grp.y −0.05`).
  Snap (0.24 s): he faces the anchor and pitches forward (`torso.rx 0.5`) with
  his arms trailing (`rx +1.0`). On arrival: a squash.
- **VFX:** the bob mesh, its ring and the tether. Snap: ghosts, wake, per hit 8
  sparks and `flash`, arrival `flash(COLD, .8)`, and the bob shattering into
  cold sparks. If it expires instead: the bob sheds motes and fades (G8, quiet).
- **SFX:** plant: `+metalMedium @.7 ×.6` and a soft pluck `sine 220 .4 ×.1`.
  Snap: the dash voice turned around (`saw 190→65`, `bp-hiss 2.4k→400 .2`), then
  `+plateHeavy ×.5` on arrival. Crossing 10 u: a single soft descending tick,
  `tri 880→660 .05 ×.05`. Expiry: `sine 440→330 .2 ×.08`.
- **Icon, two states:**
  - anchor (ready): `<path d="M12 2.5v8" stroke-dasharray="2 2.5"/><path d="M7.5 11.5h9L12 21z"/>`
  - snap (anchor live): `<path d="M21 12H10" stroke-dasharray="2 2.5"/><path d="M13 8.5 9.5 12l3.5 3.5"/><path d="M2.5 8h6L5.5 14z"/>`

#### L8. Borrowed Time (gold, rewind, +2 strain per cast)
- **Card:** Rewinds you a moment and undoes the hits you took. Adds strain.
- **Read:** while the button is ready, **a faint afterimage of Still (the ghost
  material at 0.14) walks 1.5 s behind him**, exactly where a rewind would take
  him. It's one figure, low opacity, and it *is* the preview. The integrity meter
  shows the last 1.5 s of damage as a pale trailing segment (N10), which is
  exactly what a rewind returns. On a cast he is pulled back along the ghost
  path, the pale segment fills back in, and two pips fly (§4). While the button
  is recharging, the afterimage is gone, so its absence tells you it's not
  available.
- **Beat (0.30 s):** yanked from the chest. `head.rx −0.4`, `torso.rx −0.2`
  (arching back), arms trailing forward (`rx −0.6`). During the 250 ms of travel,
  **the walk bob runs backwards**: `bob` decreases, so the legs un-walk.
- **VFX:** `flash(core, COLD)` at the start, the reversed ghost chain along the
  path, `gather(core, 12)` on arrival as the afterimage merges into him (its
  opacity up, then gone), and embers off the joints (G6).
- **SFX:** a reverse swell, `sine 80→400 .25` rising, against a falling
  `bp-hiss 3k→500 .25 Q1.5`, then `+bell @1.8 ×.2` on arrival, plus `grind()`
  **on every cast, pushed or not**, because it always costs strain. Do **not**
  use `cleared()`: that's the one warm sound, and it belongs to quiets.
- **Icon:** a counter-clockwise arrow around a dot.
  `<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5"/><circle cx="12" cy="12" r="1.5"/>`

---

## 7. Anti-synergies (the Balancer asked for these to be shown)

These appear only on the **compare** screen (which pauses), and only when the
incoming part conflicts with something equipped. Each is a single muted line
under the card, in the card's own voice. It never shows in play.

| pair | line shown |
|---|---|
| Lure + Anvil | "Your decoy will draw the blows Anvil needs to catch." |
| Brace + Anvil | "Anvil catches the blow first; Brace only matters for shots." |
| Frost Trail + Backdraft Vent | "The vent drags them past your cold track." |
| Backdraft Vent ↔ Chill Vent | nothing (same slot: the swap card already says "replaces") |

This is also where the moth-and-flame choice lives: "replaces Scrap Cleaver" is
already on the card, and a conflict line makes the cost of a combo as concrete
as the cost of a slot.

---

## 8. Flags: parts that read badly and presentation can't fix

| # | part | problem | why presentation can't fix it | options for the spec pass / owner |
|---|---|---|---|---|
| 1 | **Overrun** | the charge is only reachable while the button is recharging, so the flow is always *step first, then hold to charge*. On first contact the good version feels locked behind the bad one, and a player who wants to open with the charge can't | the constraint is the push rule (hold only pushes a *recharging* button). A lit ember half can show *when* the charge is available, but it can't make it available | (a) for push-shaped parts only, a hold on a *ready* button also pushes. This runs into DESIGN.md's open "hold means two things", and since hold-to-aim is unbuilt, these parts could claim it; (b) accept it and let the card say it. My recommendation is (a) |
| 2 | **Lure** | the decoy spawns at Still's feet. In melee, strikes aimed at it still cover him, so the first use usually reads as "it did nothing" and he gets hit anyway | re-centring enemy rings on the decoy makes it *legible* afterwards, but the geometry is the rule: at the moment of casting, the decoy and Still are in the same place | (a) spawn the decoy 1.5 u behind Still, opposite the stick (a small rule change the owner has to approve); (b) accept it, relying on the compare-screen line and the pulse to teach "walk away". This is a first-use risk, not a balance one |
| 3 | **Through-Line** | "nearest enemy within 16, line or not" will often pick a **sleeping** pack behind a wall over the awake hulk you're fighting, and waking a second pack by accident feels like the game's fault | target selection is a rule. No visual can stop the bolt going where it goes | the target rule becomes "nearest **awake** enemy within 16; if none, nearest". A spec decision, and it doesn't change any number |
| 4 | **Frayed Cleaver** (mild) | picked up early at strain 0–5, it's visibly narrower than the white it replaces. It reads as a downgrade on the pickup screen, because it is one at that moment | by design it only pays off near Stopping. Presentation can be honest about that (the card, the notches), but it can't make it feel good at strain 2 | none needed. It's a real moth-and-flame choice. Watch whether players ever take it before depth 3 (Balancer Q4) |

Everything else in the pool reads on a phone with the recipes above. The parts
closest to the line are **Ricochet** (it's automatic, solved by the cast-time
path flash and the ready-state wall tick) and **Brace** (its cost is invisible
unless the hit sound and visual swap, §4.6).

---

## 9. Open UX questions for playtest

| # | question | what to watch |
|---|---|---|
| Q1 | The **elite aura** is a floor ring in `0x7d98ff`, which is inside Still's cold family. Does it get mistaken for one of his marks, or a mark for it? | if yes, move the aura toward the Plenty shrine's violet (`0xc7b8ff`). That keeps the D2 "blue champion" feel at a distance and gives G1 back to Still |
| Q2 | Is the **strain pip** flight (button → top centre, 0.35 s) seen during a fight, or lost in the action? | test with the Coil, where it fires every 1.2 s. If players can't say what the embers mean after one run, add a small bump to the meter itself, not a longer flight |
| Q3 | Does **"held while it recharges"** on the Patient Lens and Overrun cards land for players who haven't discovered pushing yet? | if not, the one-time pulse of the ember half (§4.3) has to carry it. Measure whether a player's first push happens before or after picking one of these up |
| Q4 | **Borrowed Time's afterimage** at 0.14 opacity: readable on the Poco in a lit room, or invisible, or distracting? | try 0.10, 0.14 and 0.20 on the device. It must never be mistaken for the Lure decoy (0.55, pulsing, lens lit) |
| Q5 | **Frost Trail's static strip** in the Assembler arena, next to the shockwave's cold safe lanes: do players ever stand on frost thinking it's a lane? | if yes, tint frost greyer (`0x9fb4c8`) and keep the lanes pure `COLD` |

---

## 10. The three moments that must land

1. **The Anvil catch.** You walk into a hulk's full ember disc on purpose, the
   fists come down, and they *stop*. There's a 90 ms freeze with no hurt flash,
   then the bell, the heaviest sound Still makes, and a cold ring blows the pack
   off him. It works because the danger is real right up to the frame it isn't.
   Keep the hitstop, and never let the hurt vignette flicker on a caught strike.
2. **The Parry break.** Their heat is shattered by his cold: the ember ring
   turns to blue shards mid-windup and the windup tone is cut, not faded. A
   broken attack has to sound like silence arriving.
3. **Signal Flare's double pop.** You mark a clump winding up and vent, and every
   bracket slams shut with two flashes and two hits at once. The pack falls in
   one press. The doubled sound is what makes the combo *feel* like two parts
   working together instead of a number going up.
