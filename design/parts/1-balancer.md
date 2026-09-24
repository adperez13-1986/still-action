# Parts pool: systems and maths (Balancer pass)

Pass 1 of 3. Mechanics and numbers only. Names are working names; the UX/feel
pass renames and dresses them, and the spec pass makes them buildable. Every
number here was worked out by hand from the constants in `src/`. None of it has
been simulated. Treat it as the starting point for tuning, not the result.

---

## 0. Reference numbers (from code) and assumptions

| value | number | source |
|---|---|---|
| Auto attack | 5 dmg / 0.62 s = **8.06 DPS**, range 7.6, clear line | `combat.ts` |
| Still | 100 HP, speed 5.5, radius 0.42, hurt cooldown 0.35 s | `combat.ts`, CONTEXT |
| Push | hold ≥ 180 ms on a *cooling* button: fires now, **resets the full cooldown**, +2 strain | `hud.ts`, `main.ts` |
| Strain | +2 per push, +4 Plenty, −2 per quiet, −6 Rest, 20 = Stopped | `main.ts` |
| Chaser | 30 HP, speed 4.3, strikes at ≤ 2.0, ring 2.4, windup 520 + strike 90 + recover 760 ms | `enemy.ts` |
| Ranged | 20 HP, speed 3.4, holds 6–10, fires ≤ 12, windup 760, reload 1500, 8 dmg | `ranged.ts` |
| Boss | 900 HP, r 1.6, knockMul 0.05, ×1.5 damage while stunned (1.7 s) | `boss.ts` |
| Knockback | slide v = 9·D, decays e^(−9t); **stagger while v > 1.5** | `enemy.ts` |

"Push = full power" means nothing in the code today: `pushed` only changes the
VFX. The parts below that behave differently when pushed need `pushed` (and the
current `strain`) passed into `useAbility`. That is plumbing, not a new system.

**Assumed stats for the two unbuilt archetypes.** Used for the maths below; the
archetype designer can change them.

| | HP | speed | windup | strike | pack |
|---|---|---|---|---|---|
| Charger | 36 | 3.8 walk | 700 ms line telegraph | rush 18 u/s for up to 10 u, 14 dmg, 1.2 s self-stun on a wall | 1–2 |
| Swarm | 8 each, r 0.3 | 4.8 | 250 ms | 3 dmg bite at 0.9 | 6–8 |

### Two derived rules every part is checked against

**Stagger time from one shove of D units:** `t = ln(6D) / 9`.

| D (u) | 1.0 | 1.2 | 1.6 | 2.0 | 2.5 | 3.85 | 5.0 |
|---|---|---|---|---|---|---|---|
| stagger (s) | 0.20 | 0.22 | 0.25 | 0.28 | 0.30 | 0.35 | 0.38 |
| + chaser walk-back D/4.3 (s) | 0.43 | 0.50 | 0.62 | 0.74 | 0.88 | 1.24 | 1.54 |

Call the second row **denial**: how long one shove keeps a chaser from striking.

**Stagger-lock threshold.** To keep an enemy above 1.5 u/s you have to shove it
again every T seconds by at least `D = (e^(9T) − 1) / 6`.

| repeat interval T | 0.1 s | 0.2 s | 0.3 s | 0.4 s | 0.62 s (auto) | 1.0 s |
|---|---|---|---|---|---|---|
| shove needed per hit | 0.24 u | 0.84 u | 2.3 u | 5.9 u | 44 u | 1350 u |

The biggest shove in the pool is a point-blank Vent at 3.85 u. So a lock needs a
shove source that repeats **every 0.3 s or faster**. No part does. Pushing every
0.3 s costs 6.7 strain/s, which stops the run within 3 s. **Pool rule: no knock
source may repeat faster than every 0.4 s, and no persistent zone may shove.**

**Strain exchange rate.** Pushing the Lens turns 2 strain into one extra 26-dmg
bolt, so 13 damage per strain. **Pool rule: no part turns 1 strain into more than
about 16 single-target damage, or into more than about 20 HP.** Anything above
that makes pushing the dominant strategy.

---

## 1. The pool: 30 parts

Split: **8 white, 16 blue, 6 gold.** Head 8, Torso 7, Arms 7, Legs 8.
Four new whites give each slot a second plain shape, so blues can bend either one.

### What happens to the placeholders

| placeholder | verdict | why |
|---|---|---|
| Cracked Lens (pierce) | **keep as is** | clean sidegrade for lines of enemies |
| Backdraft Vent (pull) | **keep as is** | sets up every arms part |
| Rusted Hook | **rework**: range 4.2 → 5.5, needs a clear line, yank to 1.6 | at 4.2 it can't reach a sentinel's 6-unit band, so it's just a worse Cleaver |
| Skid Plates | **rework**: the landing blast also shoves 1.4 u | 8 + 10 damage with no control was a number change |
| Overclocked Coil (fan) | **rework** into a strain gun, one hit per enemy per cast | point-blank on the boss (r 1.6), all 3 bolts land: 54 dmg / 5 s = 10.8 DPS, 1.75× the Lens. That makes it a boss trivialiser (§4) |

### HEAD: reaches far

| id | tier | from | shape | cd s | dmg | range | radius | other |
|---|---|---|---|---|---|---|---|---|
| focusing-lens | white | – | bolt | 4.2 | 26 | 13 | 0.85 | – |
| flare | white | – | **lob** (new shape) | 4.2 | 18 | 11 | blast 2.0 | flight 0.8 s |
| cracked-lens | blue | Lens | bolt, pierce | 4.6 | 20 | 15 | 0.7 | – |
| ricochet-lens | blue | Lens | bolt, **bounce** | 4.6 | 18 | path 20 | 0.7 | ≤ 2 bounces; bank search 8 u |
| patient-lens | blue | Lens | bolt, charge | 1.5 min | 6 → 32 | 13 | 0.85 | charge 1.5 → 7.5 s |
| signal-flare | blue | Flare | lob, mark | 5.0 | 4 | 11 | blast 2.2 | mark 4.0 s |
| through-line | gold | Lens | bolt, **pierce all** | 6.0 | 24 | 16 | 0.6 | breach 4.0 s |
| overclocked-coil | gold | Lens | bolt ×3 fan | 1.2 | 14 each | 12 | 0.6 | ±15°, +1 strain per cast |

1. **Focusing Lens.** A heavy bolt at the nearest enemy; walls stop it.
2. **Flare.** A lob lands 0.8 s later where the target stood when you cast it, hits everything within 2.0, and arcs over waist-high walls on the way. *Symmetry:* a lob physically clears waist-high cover, so any future enemy lobber gets the same rule. The landing ring is a cold telegraph, the same committed-strike rule enemies live under. 18 is deliberately below a sentinel's 20 HP, so a lob alone never kills a hidden sentinel (§4, #9).
3. **Cracked Lens.** The bolt passes through every enemy it hits; walls still stop it. *Gives up:* 6 damage per hit, 0.4 s of cooldown, and 0.15 of width. In exchange it gets 2 u more range and hits a whole line.
4. **Ricochet Lens.** The bolt bounces off walls up to twice. If the nearest enemy has no clear line, it fires a one-wall bank shot when one exists. A sentinel hit by a banked bolt aims its next windup back along the reversed path, as a bouncing shot, at the spot you fired from. *Gives up:* 8 damage and 0.4 s. It hits one enemy and stops, so with a clear line it's simply a weaker Lens.
5. **Patient Lens.** Damage grows with the time since the last cast: 6 at 1.5 s, rising linearly to 32 at 7.5 s and holding there. It can't fire before 1.5 s unless pushed, and **a pushed shot always fires at 32**. A Patient Lens swapped in off the floor starts at 1.5 s. *Gives up:* sustained DPS (about 4.2 against the Lens's 6.2). You have to hold fire to make it count.
6. **Signal Flare.** A lob that deals 4 and marks everything in 2.2 for 4 s. The first hit from any *other* part (not the auto) on a marked enemy lands its damage twice (knockback, yank or throw only once). *Gives up:* 14 damage of its own; it's worth nothing without the other three slots.
7. **Through-Line (gold).** A bolt that passes through every enemy, crate and wall, aimed at the nearest enemy within 16 whether or not there's a line to it. Every wall cell it crosses becomes a **breach** for 4 s: that cell stops blocking projectiles and sight, **for both sides**. *Gives up:* 2 damage and 1.8 s of cooldown, and **it opens your own cover**. Shoot through the barrier you're crouched behind and the sentinel on the other side can now see and shoot you through the same hole. See "The two bolts" below.
8. **Overclocked Coil (gold).** Three bolts in a ±15° fan, 14 each; any enemy takes at most one bolt per cast. **Every cast costs +1 strain, pushed or not.** *Gives up:* free damage. Everything it does is paid for out of the run. At 11.7 single-target DPS it's the strongest damage in the pool, and it drains 0.83 strain/s while you fire it (§7).

#### The two bolts the owner asked for

**Pierce everything, walls included: Through-Line.** Waist-high walls are
symmetric today: they block both sides. A wall-piercing bolt breaks that on
purpose, so the cost puts the symmetry back in the same place. The bolt
*damages the wall's protection* for both sides. It becomes a real positional
trade. You can reach a sentinel behind cover, but for 4 s it can reach you
through the same line (760 ms windup + 1500 ms reload = about 1–2 return shots
in the window). Shooting through a wall you're not hiding behind costs almost
nothing, and that's the skill. *Cheap fallback if breaches are too costly to
build:* each wall the bolt crosses adds +1 strain. It fits the current engine,
but it's less interesting: it prices the asymmetry instead of undoing it.

**Bounce: off walls, not between enemies.** Why walls:
1. It uses the cover system instead of bypassing it. The bolt still obeys
   walls; it just uses them. Positioning for an angle is a new decision the
   pool doesn't have yet.
2. Chaining between enemies is a pack damage multiplier, which is a number
   change. Cracked Lens already covers "many enemies".
3. Against a swarm of 6–8 bodies, chain arcs mean a screen-wipe plus an
   unreadable web of lines on a 6-inch screen.
4. The fairness rule is the same idea as the breach: **the path works both
   ways.** The sentinel you banked answers along the reversed path, so the
   right play is bank, then move. The enemy's answer reuses the same bounce
   code, so building bounce once pays for both.

### TORSO: works around Still

| id | tier | from | shape | cd s | dmg | radius | other |
|---|---|---|---|---|---|---|---|
| pressure-vent | white | – | nova, shove | 6.5 | 15 | 4.3 | shove 2.4–4.2 u (closer = further) |
| ward | white | – | **ring shield** (new) | 7.0 | 0 | 1.8 | lasts 1.4 s |
| backdraft-vent | blue | Vent | nova, pull | 6.5 | 12 | 5.2 | pull to 1.4 u |
| chill-vent | blue | Vent | nova, slow | 6.5 | 10 | 4.3 | walk ×0.5 for 3.0 s |
| brace | blue | Vent | nova, convert | 9.0 | 8 | 2.6 | 0.8 s window; ceil(dmg / 8) strain per hit |
| mirror-ward | blue | Ward | ring, reflect | 7.0 | 8 per shot | 1.8 | lasts 0.8 s; at most 6 reflections |
| lure | gold | Ward | **decoy** (new) | 12.0 | 18 burst | draw 12, burst 3.0 | lasts 3.0 s; burst shoves 1.6 u |

1. **Pressure Vent.** A blast around Still that shoves enemies away.
2. **Ward.** For 1.4 s, any enemy shot that comes within 1.8 of Still is destroyed. It does nothing to melee, shockwaves or pulls. This is the plain answer to projectiles that isn't "stand behind a wall".
3. **Backdraft Vent.** The blast drags enemies in to 1.4 u instead of out. *Gives up:* 3 damage and the panic shove, and it pulls enemies to 1.4, inside a chaser's 2.0 strike range, the moment they arrive.
4. **Chill Vent.** Enemies hit walk at half speed for 3 s. It refreshes but doesn't stack, and it multiplies with Quick (1.45 × 0.5). **It never slows a windup, a strike or a rush**; the committed part of an attack is untouchable. *Gives up:* 5 damage and the shove. It buys distance over time instead of space right now.
5. **Brace.** A small blast (8, no shove). For the next 0.8 s, any damage Still would take turns into strain instead: ceil(damage / 8) per hit. *Gives up:* 7 damage, the shove and 2.5 s of cooldown. Using it well costs the run. A hit that would push strain to 20 **Stops** Still instead of Breaking him. That's intended: it turns a Broke into a Stopped, which is the lineage's middle outcome.
6. **Mirror Ward.** For 0.8 s, enemy shots that reach 1.8 are turned back at their shooter as Still's bolts (8 dmg; walls stop them), at most 6 per cast. *Gives up:* 0.6 s of window, so timing matters more than with the white.
7. **Lure (gold).** Drops a cold decoy of Still at his feet for 3 s. Awake non-boss enemies within 12 treat it as Still: they approach, wind up, strike and aim at it. A strike whose area also covers Still still hurts him. When it expires it bursts for 18 within 3.0 and shoves 1.6 u. The Assembler ignores it; its adds obey it. *Gives up:* anything immediate. On a 12 s cooldown you have to walk away from your own decoy for it to protect you.

### ARMS: close

| id | tier | from | shape | cd s | dmg | range | cone | other |
|---|---|---|---|---|---|---|---|---|
| scrap-cleaver | white | – | arc | 2.6 | 18 | 3.1 | 120° | – |
| piston | white | – | **jab** (narrow arc) | 3.0 | 26 | 3.4 | 40° | shoves the struck 1.6 u |
| rusted-hook | blue | Cleaver | arc, yank | 3.2 | 12 | 5.5 | 70° | yank to 1.6 u in front; clear line |
| parry-clamp | blue | Cleaver | arc, cancel | 3.6 | 10 | 2.6 | 90° | a hit in windup cancels it, shove 2.5 u |
| frayed-cleaver | blue | Cleaver | arc, strain-width | 2.6 | 16 | 3.1 | 90° / 180° / 360° | at strain 0–5 / 6–11 / 12+ |
| clamp-toss | blue | Piston | **grab + throw** | 4.5 | 14 (+14 splash, +12 wall) | grab 2.4, throw 5.0 | – | splash 1.2, shove 1.2 u |
| anvil | gold | Piston | **catch + counter** | 6.0 | 30 | counter 3.0 | 360° | window 0.9 s; shove 2.0 u |

All arms parts, the Cleaver included, check for a clear line to each target (§4, #2).

1. **Scrap Cleaver.** A wide swing at whatever is closest.
2. **Piston.** A narrow, straight thrust that shoves what it hits 1.6 u back. It trades the sweep for single-target weight: 26 plus one auto kills a hulk.
3. **Rusted Hook.** A long, narrow swing that needs a clear line and yanks every enemy hit to 1.6 u in front of Still. At 5.5 + 0.6 pad + body it reaches 6.6, so it can pull a sentinel off the inner edge of its band. *Gives up:* 6 damage, 50° of width and 0.6 s, and it brings trouble to you.
4. **Parry Clamp.** Any enemy hit **during its windup** has the windup cancelled (back to approach) and is shoved 2.5 u; the Assembler takes the damage but can't be cancelled. *Gives up:* 8 damage, 30° and 1.0 s. It's only better than the Cleaver if you time it into the windup ring, and to do that you have to be standing inside the ring.
5. **Frayed Cleaver.** The sweep gets wider as strain rises: 90° at 0–5, 180° at 6–11, a full circle at 12+. *Gives up:* 2 damage, and at low strain it's narrower than the white. It only gets good when the run is close to Stopping, and every quiet (−2) narrows it again.
6. **Clamp Toss.** Grabs the nearest enemy within 2.4 (clear line) and throws it 5 u along the stick, or directly away if the stick is idle. On landing it takes 14, and everything within 1.2 takes 14 and a 1.2 u shove. If a wall cuts the throw short, the thrown enemy takes 12 more. The boss can't be grabbed (knockMul < 0.1) and just takes 14; a Plated elite only flies 1.5 u. *Gives up:* 12 damage and 1.5 s against the Piston. You trade raw damage for choosing where the enemy ends up.
7. **Anvil (gold).** For 0.9 s after the press, the first body strike that would hurt Still deals nothing, and Still answers with 30 to everything within 3.0 plus a 2 u shove. Body strikes are melee actions: hulk slam, boss sweep, magnet and charge, charger rush, swarm bite. Shots and shockwaves go through. The negated strike still starts the 0.35 s hurt cooldown, so a clump of simultaneous strikes all fold into the one catch. *Gives up:* all damage of its own. If nothing strikes you, the full 6 s cooldown is spent for nothing. You have to step into a windup on purpose.

### LEGS: move him

| id | tier | from | shape | cd s | dmg | range | radius | other |
|---|---|---|---|---|---|---|---|---|
| kickstart | white | – | dash | 8.0 | 12 | 6.4 | 1.2 | knock 1.2 u, 280 ms |
| skitter | white | – | **hop** (short dash) | 3.2 | 0 | 3.4 | – | 180 ms |
| skid-plates | blue | Kickstart | dash + slam | 8.0 | 8 run-over, 10 slam | 5.6 | 1.2, slam 2.8 | slam shoves 1.4 u |
| overrun | blue | Kickstart | dash, push-shaped | 7.0 | 0 / 22 pushed | 4.0 / 9.0 pushed | 1.4 pushed | pushed knock 2.4 u |
| frost-trail | blue | Kickstart | dash + **ground strip** | 8.0 | 0 | 6.4 | strip 1.4 wide | lasts 3.0 s, walk ×0.5 |
| spring-heels | blue | Skitter | hop, vault | 4.0 | 0 | 3.4 (to 4.6 to clear) | – | 300 ms; 0.3 s landing lock after a vault |
| plumb-line | gold | Skitter | **anchor + snap** | 9.0 | 14 | snap ≤ 10 | 1.0 | anchor 5.0 s, snap 240 ms |
| borrowed-time | gold | Kickstart | **rewind** | 10.0 | 0 | 1.5 s of path | – | 250 ms; +2 strain per cast |

1. **Kickstart.** Dash along the stick, running over anything in the way.
2. **Skitter.** A quick 3.4 u hop along the stick, no damage. From inside a chaser's 2.4 ring, any hop direction clears it: straight away 5.4 u, sideways √(2² + 3.4²) = 3.9 u.
3. **Skid Plates.** The dash ends in a 2.8 blast that shoves 1.4 u out. *Gives up:* 4 damage along the run and 0.8 u of reach.
4. **Overrun.** Unpushed, a short 4 u step with no damage. **Pushed**, a 9 u charge that deals 22 and knocks 2.4 u sideways. *Gives up:* the free dash does no damage; all of its damage costs strain (11 per strain on one target, about 27 on a line of 2.5).
5. **Frost Trail.** The dash deals nothing but leaves a 1.4-wide cold strip for 3 s. Enemies on it walk at half speed, and a charger whose rush crosses it trips and goes straight to recover. The boss doesn't trip. *Gives up:* 12 damage and the knock. Chasers following you walk your own path, so the strip lands exactly where they'll be.
6. **Spring Heels.** A hop that clears one waist-high wall if there's open floor beyond (stretching up to 4.6 u); landing after a vault locks movement for 0.3 s (parts still fire). *Gives up:* 0.8 s of cooldown and 120 ms more air. The vault commits you to the far side.
7. **Plumb Line (gold).** First press plants an anchor at Still's feet for 5 s. A second press snaps him back to it in 240 ms along a straight line that stops at walls, running over everything on the way (14, 1.2 u shove). The 9 s cooldown starts at the snap or when the anchor fades. Snaps beyond 10 u fail. *Gives up:* an instant escape; the first press does nothing on its own.
8. **Borrowed Time (gold).** Still is pulled back along his own path to where he stood 1.5 s ago, passing through enemies harmlessly, and the damage he took in those 1.5 s comes back. **Every cast costs +2 strain (+4 pushed).** It restores damage taken, not an old HP value, so it never undoes a heal. It can't rewind from 0 HP, and it never rewinds strain. *Gives up:* all damage and all forward movement, and each use costs a quiet's worth of strain.

### Coverage check

| requirement | parts |
|---|---|
| Control: stagger | Vent, Piston, Skid Plates, Clamp Toss, Anvil, Parry, Kickstart |
| Control: slow | Chill Vent, Frost Trail |
| Control: displacement | Backdraft (in), Rusted Hook (in), Clamp Toss (anywhere), Lure (redirect) |
| Control: windup denial | Parry Clamp (cancel), Anvil (negate) |
| Positioning | Flare, Ricochet, Through-Line, Spring Heels, Plumb Line, Lure, Frost Trail |
| Behaves differently when pushed | Patient Lens (push = full charge), Overrun (push = the real dash) |
| Behaves differently at high strain | Frayed Cleaver |
| Spends strain on normal casts | Overclocked Coil (+1), Borrowed Time (+2), Brace (damage → strain) |
| **Reduces strain** | **none** (§4, #1 and #14) |

---

## 2. DPS and uptime sanity

`ST` = damage × expected hits on a lone target ÷ cd. `pack-3` = three hulks in a
2 u clump (hits per cast: bolt 1, pierce 1.8, lob 1.7, nova 3, 120° arc 2,
40° jab 1.2, dash line 2). `swarm` = 8 bodies of 8 HP; kills per second.
`boss` = ST × realistic uptime on the Assembler (bolts 0.8; lobs 0.9 at walk
speed 2.4, since it moves 1.9 u in 0.8 s < 2.0 + 1.6; melee 0.5; novas and dashes 0.3).
Lob hit rate against a hulk is 0.75: it's stationary for 1.37 s of each strike cycle.

### Damage parts

| part | slot | cd | dmg | ST DPS | pack-3 DPS | swarm kills/s | boss DPS | vs slot white |
|---|---|---|---|---|---|---|---|---|
| **Focusing Lens** (W) | H | 4.2 | 26 | **6.2** | 6.2 | 0.24 | **5.0** | – |
| **Flare** (W) | H | 4.2 | 18 | 3.2 | 7.3 | 0.83 | 3.9 | packs, cover |
| Cracked Lens | H | 4.6 | 20 | 4.3 | 7.8 | 0.65 | 3.5 | lines |
| Ricochet Lens | H | 4.6 | 18 | 3.9 | 3.9 | 0.22 | 3.1 | only enemies behind cover |
| Patient Lens, 7.5 s wait | H | 7.5 | 32 | 4.3 | 4.3 | 0.13 | 3.4 | burst |
| Patient Lens, 4.2 s rhythm | H | 4.2 | 17.7 | 4.2 | 4.2 | 0.24 | 3.4 | – |
| Signal Flare + Piston repeat | H | 5.0 | 4 + 26 | 4.5 | – | – | 3.1 | enabler |
| Signal Flare + Vent repeat | H | 5.0 | 4 + 15 per mark | – | 6.5 | – | – | enabler |
| Through-Line | H | 6.0 | 24 | 4.0 | 7.2 | 0.50 | 4.0 | reach |
| Overclocked Coil | H | 1.2 | 14 ×3 | **11.7** | **25.7** | 1.83 | 11.7 | **costs 0.83 strain/s** |
| **Pressure Vent** (W) | T | 6.5 | 15 | 2.3 | 6.9 | 0.92 | 0.7 | – |
| Backdraft Vent | T | 6.5 | 12 | 1.8 | 5.5 | 1.08 | 0.6 | clumps for arms |
| Chill Vent | T | 6.5 | 10 | 1.5 | 4.6 | 0.92 | 0.5 | slow |
| Brace | T | 9.0 | 8 | 0.9 | 1.8 | 0.33 | 0.3 | defence |
| Lure burst | T | 12 | 18 | 1.5 | 4.5 | 0.50 | 0 | 3 s untargeted |
| **Scrap Cleaver** (W) | A | 2.6 | 18 | 6.9 | **13.8** | 1.54 | 3.5 | – |
| **Piston** (W) | A | 3.0 | 26 | **8.7** | 10.4 | 0.50 | 4.3 | single target |
| Rusted Hook | A | 3.2 | 12 | 3.8 | 4.9 | 0.62 | 1.9 | reach, pulls |
| Parry Clamp | A | 3.6 | 10 | 2.8 | 4.4 | 0.83 | 1.4 | cancels |
| Frayed Cleaver, strain 0–5 | A | 2.6 | 16 | 6.2 | 9.2 | 1.15 | 3.1 | worse |
| Frayed Cleaver, strain 6–11 | A | 2.6 | 16 | 6.2 | 13.5 | 1.92 | 3.1 | equal |
| Frayed Cleaver, strain 12+ | A | 2.6 | 16 | 6.2 | 18.5 | **3.08** | 3.1 | better, 4 pushes from Stopping |
| Clamp Toss | A | 4.5 | 14 (+14) | 3.1 | 7.8 | 0.44 | 1.6 | placement |
| Anvil (60% of windows caught) | A | 6.0 | 30 | 3.0 | 9.0 | 0.80 | 1.5 | + ~0.9 HP/s negated |
| **Kickstart** (W) | L | 8.0 | 12 | 1.5 | 3.0 | 0.38 | 0.4 | – |
| Skid Plates | L | 8.0 | 8 + 10 | 2.2 | 5.6 | 0.62 | 0.7 | – |
| Overrun, pushed | L | 7.0 | 22 | 3.1 | 7.9 | 0.36 | 0.9 | 11 dmg / strain |
| Plumb Line | L | 9.0 | 14 | 1.1 | 2.3 | 0.33 | 0.3 | – |

### Non-damage parts: uptime and value

| part | effect window | uptime (window ÷ cd) | value per cast | vs slot white |
|---|---|---|---|---|
| Pressure Vent (W) | shove | – | denial 1.24 s × 3 hulks = 3.7 hulk-s | – |
| Ward (W) | 1.4 s | 20% | 1 sentinel shot (8 HP); a whole boss barrage (15 shots, of which ~3–5 would have hit you = 21–35 HP) | – |
| Chill Vent | 3.0 s slow | 46% | hulk closing speed 4.3 → 2.15; kite gap +6.5 u per cast vs +3.6 | Vent: 3.7 hulk-s now; Chill: about 4.5 hulk-s spread over 3 s |
| Brace | 0.8 s | 9% | a 22-dmg charge → 3 strain; a 9-dmg slam → 2 strain | Vent keeps your HP and your strain |
| Mirror Ward | 0.8 s | 11% | ≤ 6 × 8 = 48 dmg returned | Ward: longer, safer window |
| Lure | 3.0 s | 25% | 3 s of free auto (24 dmg) + 18 burst on a clumped pack | Ward: 20% shot immunity |
| Parry Clamp | instant | – | a cancelled hulk loses ~1.4 s (0.52 windup + 0.88 denial) | Cleaver: 8 more damage |
| Piston (W) | shove | – | denial 0.62 s | – |
| Clamp Toss | throw | – | denial 1.54 s + 0.5 s × 1.5 splashed | Piston: 0.62 s |
| Kickstart (W) | 280 ms | – | 1 strike dodged per 8 s (7.5/min) | – |
| Skitter (W) | 180 ms | – | 1 strike dodged per 3.2 s (18.8/min) | – |
| Overrun, unpushed | 220 ms | – | 8.6 dodges/min | Kickstart: 12 dmg, 2.4 u longer |
| Frost Trail | 3.0 s | 37% | a hulk walking the strip covers 1.4 u in 0.65 s instead of 0.33 s | Kickstart: 12 dmg, knock |
| Spring Heels | 300 ms | – | 15 dodges/min; a vault forces a hulk detour of ~8 u ≈ 1.9 s | Skitter: 18.8 dodges/min |
| Plumb Line | 5 s anchor | – | 1 escape of up to 10 u per 9 s + 14 dmg on a line | Skitter: 3× more hops |
| Borrowed Time | 250 ms | – | restores 9–40 HP per cast for 2 strain | Kickstart: free |

### Verdicts

- **Head.** Lens is the single-target reference at 6.2. Every head blue sits at
  3.2–4.3 ST and buys a situation instead: lines, cover, burst or combos. Coil
  is the only part above the Lens, and it spends strain at the push exchange
  rate (14 per strain against the Lens's 13). Nothing dominates.
- **Torso.** No torso part is a damage source (≤ 2.3 ST). They compete on
  control and defence, and none has more than 46% effect uptime.
- **Arms.** Piston (8.7 ST) and Cleaver (13.8 pack) split the slot cleanly.
  Frayed beats the Cleaver only at strain 12+; Anvil and Parry pay for their
  effects with damage. The owner's note that "the Cleaver may be doing too
  much" still holds after this pass. The clear-line rule (§4, #2) is the fair
  way to trim it, without touching its numbers.
- **Legs.** No legs part exceeds 3.1 ST. They compete on dodges per minute
  (7.5–18.8) against what each dodge buys.
- **Whole-kit boss check.** A white loadout on the Assembler: auto 8.06 ×
  0.6 + Lens 5.0 + Cleaver 3.5 + Vent 0.7 + Kick 0.4 = **14.4 DPS → 62 s**. The
  best non-strain alternative (Signal + Piston + Vent + Kickstart) is about
  13.3 DPS. Target band: **45–75 s without pushes**. No combination below falls
  under 45 s without spending strain.

---

## 3. Synergy map

### Two-part combos (across slots)

| combo | why it works | the maths |
|---|---|---|
| Backdraft Vent + Scrap Cleaver | vacuum, then cut. Pulls the pack to 1.4 u, well inside the 120° arc | 12 + 18 = 30 = a hulk, times 2–3 in two presses. Fire the pull during their approach or you're standing in three strike rings |
| Signal Flare + Pressure Vent | mark a clump while it's winding up (stationary), then vent | 4 + 15 × 2 = 34 ≥ 30 on every marked hulk: a pack of 3 dies in 2 presses. **Strongest pack combo; watch it (§8)** |
| Signal Flare + Anvil | mark, let them all swing at you, catch | 4 + 30 × 2 = 64 ≥ an elite's 60 |
| Lure + Flare | Lure makes enemies stand still (winding up at the decoy), which is exactly what a lob needs | lob hit rate 0.75 → about 1.0 for 3 s |
| Chill Vent + Flare | a slowed hulk moves 2.15 × 0.8 = 1.7 u during the flight, less than 2.0 + 0.55, so the lob lands even on moving targets | lob hit rate → ~1.0 on slowed walkers |
| Rusted Hook + Pressure Vent | sort the pack: hook the sentinel in, blow the hulks out | the sentinel lands at 1.6 u inside auto range and dies to 1 auto + the vent (5 + 15) |
| Clamp Toss + Signal Flare | throw a marked enemy into a marked clump | 14 × 2 thrown + 14 × 2 splash = 28 on everything; add a wall and the thrown one takes 40 |
| Through-Line + Mirror Ward | breach a wall; sentinels fire through the hole; mirror sends the shots back through it | cover becomes a funnel you control |
| Ricochet Lens + Spring Heels | vault to a new side of the barrier, bank from an angle the sentinel doesn't cover, move before the answer | the answer shot needs its 760 ms windup; the hop is ready again 4 s later |
| Frayed Cleaver + Brace | Brace turns hits into strain, strain widens the Cleaver: a self-feeding build | three 9-dmg slams at strain 4 = +6 → strain 10 = 180° sweep |
| Overrun + Signal Flare | a pushed Overrun through a marked line | 22 × 2 = 44 per target for 2 strain; the mark's 5 s cooldown caps how often |
| Anvil + Backdraft Vent | pull them in, they all wind up on you, catch the first | 12 + 30 = 42 to everything within 3 |
| Parry Clamp + Skitter | cancel the one in front, hop out of the second ring | the hop is up again after 3.2 s, about when the parry is (3.6 s) |

### Three-part cores

| core | parts | the loop | what's open |
|---|---|---|---|
| **Cutter** | Backdraft Vent · Scrap Cleaver · Skid Plates | pull → cut → dash out with the slam as a door-closer | head: Lens for sentinels |
| **Cold** (kite) | Chill Vent · Frost Trail · Flare | slow them, lay the strip where they'll walk, lob the slow ones | arms: Piston for anything that arrives |
| **Counter** | Parry Clamp or Anvil · Brace · Skitter | stand in windups on purpose: cancel, catch, and let Brace pay for the misses | head: Signal (Anvil payoff) |
| **Marksman** | Through-Line or Ricochet · Mirror Ward · Spring Heels | fight across cover: open it, bend around it, vault it | arms: Hook for anyone who closes |
| **Burner** | Overclocked Coil · Frayed Cleaver · Borrowed Time | spend strain as ammo; high strain widens the cleave; rewind the mistakes | torso: Brace (it feeds Frayed) |
| **Wrestler** | Clamp Toss · Backdraft Vent · Plumb Line | gather, throw one into the rest or a wall, snap out to your anchor | head: Signal Flare |

### Anti-synergies to show in the UX pass (not bugs)

| pair | what goes wrong |
|---|---|
| Lure + Anvil | the decoy takes the strikes Anvil needs |
| Backdraft Vent + Chill Vent | same slot; noted because players will want both |
| Brace + Anvil | overlapping windows: Anvil catches the body strike, so Brace only matters for shots |
| Frost Trail + Backdraft Vent | the strip slows them out there; the vent drags them past it |

---

## 4. Broken-combo hunt

| # | exploit | the maths | fix (inside the part's rule unless marked ENGINE) |
|---|---|---|---|
| 1 | **Leash-quiet farm: infinite strain relief.** Present today, with any parts | wake a pack (walk to 8 u or snipe it), run past 16 u, and it turns to `returning`, which doesn't count as `awake`. 2.5 s later: quiet, −2 strain and half your missing HP back. Repeatable every ~6–8 s. Through-Line (range 16) and every legs part make it faster | **ENGINE:** a quiet only counts if an awake enemy died since the last quiet (a fight is cleared by clearing it). Every strain claim below depends on this fix |
| 2 | **Arcs and novas hit through walls.** Present today | chasers can't start a windup without a clear line; the boss sweep checks `inSight`; the boss wave is shadowed by cover. Still's Cleaver and Vent check nothing, so you can cleave a hulk across a barrier while it paths around | **ENGINE/rule:** arc and nova hits need `lineClear(origin, target, 0.2)` per target, the same test chasers use; cover shadows novas the way it shadows the boss wave. Every arms and torso part, the Lure burst and the Skid slam inherit it. It's also the fair way to trim the Cleaver |
| 3 | Old Overclocked Coil fan on the boss | point-blank on r 1.6, all 3 bolts land: 54 / 5 s = 10.8 DPS (1.75× the Lens) | **one bolt per enemy per cast**; the rework also prices it at +1 strain per cast |
| 4 | Stagger-lock (knock > 1.5 u/s forever) | needs a repeat under 0.3 s (§0). The fastest knock is Piston at 3.0 s. Push-spamming a Vent every 0.3 s = 6.7 strain/s → Stopped in 3 s | none needed. **Pool rule:** knock sources repeat no faster than 0.4 s, and zones never shove |
| 5 | Displacement lock (shove a hulk away faster than it walks back) | worst single-target kit: Clamp Toss 5/4.5 = 1.11 u/s + Vent 3.85/6.5 = 0.59 + Skid 1.4/8 = 0.18 → **1.88 u/s < 4.3**. With Chill in torso instead: 1.29 u/s against 2.15 slowed, 46% of the time. Boss knockMul 0.05 | none needed. Guard: a slowed enemy's knockMul is unchanged (a slow never makes shoves longer) |
| 6 | Parry chain | a cancelled hulk re-winds after ~1.3 s, but Parry's cooldown is 3.6 s. Chaining needs a push every loop: 2 strain / 1.3 s = 1.5 strain/s → Stopped in 13 s | **the Assembler can't be cancelled** (in the rule). Hulks are self-limited by strain |
| 7 | Anvil on the boss | catches sweep 18 / magnet 20 / charge 22. At cd 6 it catches about one in two body strikes: 30 dmg + ~20 HP saved per 6 s | shots and shockwaves are not caught (in the rule). ~5 DPS; accepted |
| 8 | Lure on the boss | 3 s of the boss swinging at a decoy every 12 s = 25% of its fight removed | **the Assembler ignores the decoy**; its adds obey |
| 9 | Lob from out of sight (Flare on a sentinel behind cover) | at 24 dmg a lob one-shot a 20 HP sentinel with no risk every 4.2 s | **damage set to 18 < 20**: a hidden sentinel takes 2 lobs (8.4 s) or 1 lob + 1 auto, and the auto needs a line |
| 10 | Bank shot from safety (Ricochet on a sentinel) | 18 dmg per 4.6 s from where it can't see you | **the path answers**: the struck sentinel's next windup aims a bouncing shot back along the reversed path. Stay put and you eat 8 |
| 11 | Through-Line sniping a sleeping pack through walls | first hit is free from 16 u | it's allowed (the pack wakes). The breach lets the pack's sentinels see you, and #1 closes the leash farm it would otherwise feed |
| 12 | Mirror Ward vs the barrage | 3 volleys × 5 shots = 15 → uncapped 15 × 8 = 120 (13% of the boss) per barrage | **at most 6 reflections per cast** (48 dmg) |
| 13 | Frost Trail tripping the boss charge | removes 22 dmg *and* the player's stun window | **the boss doesn't trip**; the strip only slows its walk (2.4 → 1.2) |
| 14 | *Cut part:* Bleed Valve (a torso nova that removes 1 strain for 12 HP) | a quiet heals half your missing HP, so HP is refilled between fights; burning 80 HP per fight → −6 strain a fight on top of the −2. Strain effectively free | no rule keeps it both fun and bounded; "once per fight" turns it into "quiet = −3", which is a number. **Cut. No part in the pool reduces strain** |
| 15 | Brace at strain 19 | one hit → strain 20+ → Stopped, not Broke | **intended**: it trades a Broke for a Stopped. It never lowers strain |
| 16 | Borrowed Time as a heal loop | restores *damage taken* in the window, never a past HP value: Brace + rewind = +2 strain for nothing; scrap and quiet heals can't be undone or doubled | in the rule. At most 1 cast per 10 s × 2 strain; a boss fight of 8 rewinds = 16 strain, so the build Stops |
| 17 | Patient Lens reset by swapping | a Patient Lens swapped in from the floor would arrive at a full 7.5 s charge | **a swapped-in Patient Lens starts at 1.5 s** |
| 18 | Pushed Patient Lens exchange | 32 at any time for 2 strain = 16 dmg/strain | on the cap (§0), accepted. On the boss: 5 pushes × 32 = 160 (18%) |
| 19 | Coil tapping into Stopped | a tap at strain 19 ends the run | not an exploit. **UX pass:** decide whether the button warns at 18+. The rule stays honest: it fires at any strain |
| 20 | Spring Heels kiting | each vault forces a ~1.9 s hulk detour; the auto gets free shots when the line clears | **0.3 s landing lock after a vault** (in the rule). Kiting is already meant to "work but not trivially" (DESIGN.md) |
| 21 | Plumb Line across the level | plant at a safe spot, fight far away, snap back to break aggro and leash | **snaps over 10 u fail**, and the snap stops at walls |
| 22 | Hurt-window stacking (Ward/Mirror + Anvil + Brace) | synced windows: shots blocked 1.4 / 7, body strikes 0.9 / 6, the rest to strain 0.8 / 9 | peak full immunity ≈ 0.8 s per 9 s (9%); no fix needed. Two of these share the torso slot anyway |
| 23 | Frayed at 12+ vs swarm | 360° × 16 dmg kills all 8 bodies in reach every 2.6 s | intended: swarms are AoE fodder, and holding 12+ means sitting 4 pushes from Stopped while each quiet narrows it back |

---

## 5. Drop tables

### Slot weights by archetype (treasure class)

| archetype | head | torso | arms | legs | reason |
|---|---|---|---|---|---|
| chaser | 1 | 3 | 3 | 1 | unchanged: all fists and body |
| ranged | 3 | 1 | 1 | 3 | unchanged: eyes and tripod legs |
| **charger** | 1 | 1 | 2 | **4** | a ram on legs; leans on the movement slot, which has the most gold |
| **swarm** | **3** | **3** | 1 | 1 | many small cores and eyes |
| boss | 1 | 1 | 1 | 1 | even |

With an equal kill mix, the slot totals are head 8, torso 8, arms 7, legs 9, so
no slot starves.

### Drop chance per kill: scale it by pack size

Today it's 0.22 per kill. Packs grow from 2–3 bodies at depth 1 to 5–6 at depth
7, so loot per level more than doubles (about 6 → 14 drops) even though "deeper"
isn't meant to mean "richer". A swarm of 8 at 0.22 would add 1.8 drops per pack.

**Proposed:** `per-kill chance = 0.66 ÷ pack size`, i.e. one pack pays out about
0.66 parts on average, which is today's depth-1 rate.

| pack | per kill | per pack |
|---|---|---|
| 3 hulks | 0.22 | 0.66 |
| 2 chargers | 0.33 | 0.66 |
| 8 swarm | 0.08 | 0.66 (P(at least one) = 1 − 0.92⁸ = 49%) |

Side-room packs still always pay; elites still always drop. That gives
**about 7–9 drops per level at every depth**, around 55 per 8-depth run against a
30-part pool. The run gets wider (you see most of the pool) without getting
richer.

### Tier odds

| source | white | blue | gold |
|---|---|---|---|
| normal kill, crate | 0.60 | 0.40 | **0** |
| elite | 0.15 | 0.75 | 0.10 |
| Plenty shrine | 0.15 | 0.75 | 0.10 (never a boss-only part) |
| boss | – | 1 guaranteed | 1 guaranteed (a different slot from the blue) |

### Gating

| parts | where they drop | why |
|---|---|---|
| Through-Line, Borrowed Time | **boss only** | the two parts that bend a core rule (walls, time/HP); earned at the end of an act |
| Overclocked Coil, Lure, Anvil, Plumb Line | elite, boss, Plenty | gold stays warm and thin |
| everything else | anywhere | – |

**Expected golds per 8-depth run** (bosses at depths 3 and 6, elites at 1 +
⌊(depth − 1)/2⌋ per level): 15 elites × 0.10 = 1.5, plus 2 from bosses =
**about 3.5 golds a run**, out of 6 in the pool.

---

## 6. Build cost per part

| part | cost | system needed |
|---|---|---|
| Focusing Lens, Cracked Lens, Pressure Vent, Backdraft Vent, Scrap Cleaver, Kickstart | fits | exists |
| Piston | fits | arc with a 0.94 cone + knock along the jab |
| Rusted Hook (rework) | fits | existing hook + `lineClear` |
| Frayed Cleaver | fits | pass `strain` into `useAbility` |
| Skid Plates (rework) | fits | add a shove to the existing `later` slam |
| Skitter | fits | dash variant: 3.4 u, 180 ms, 0 dmg |
| Overrun | fits | pass `pushed` into `useAbility` |
| Patient Lens | fits | time since last cast (HUD already has `readyAt`) + `pushed` |
| Overclocked Coil | fits | fan + a per-cast "already hit" set + a strain cost in `main.ts` |
| Flare | fits | new `lob` case built from `later` + ring telegraph + radial hit |
| Clamp Toss | fits | knock along the stick + `later` landing check; wall contact from `clampMove` |
| Chill Vent | fits (borderline) | `speedMul` + a `later` restore; needs care so a restore doesn't undo Quick (store and divide, don't set to 1) |
| Ward, Mirror Ward | fits (small hook) | a timed player flag checked in the enemy-shot loop; Mirror spawns a Still bolt |
| Brace | fits (small hook) | a timed flag in `hurtPlayer` + a new `onStrain` event, since strain lives in `main.ts` |
| Anvil | fits (small hook) | a timed flag in `hurtPlayer` that only catches `melee` actions (boss sweep/magnet/charge already resolve as `melee`) |
| Spring Heels | fits (small) | landing-cell check past one wall instead of `clampMove`'s stop |
| Signal Flare | **needs a new system: enemy marks** | a per-enemy timed status + a hook in `hit()`. It's also the seed for any later status effect |
| Parry Clamp | **needs a new system: windup interrupt** | `Enemy.interrupt()`: clear tells, back to approach, stop the windup tone |
| Lure | **needs a new system: target override** | per-enemy target in `e.update(dt, target)`; strikes aimed at the decoy re-check Still's position before hurting him |
| Frost Trail | **needs a new system: persistent ground zones** | timed floor strips queried per enemy per tick; charger "trip" hook |
| Ricochet Lens | **needs a new system: projectile bounce** | axis-aligned reflection on the wall grid + a one-bounce bank solver (mirror the target across nearby wall faces, check both legs with `lineClear`) + the enemy answer shot reusing the same bounce |
| Through-Line | **needs a new system: terrain breach** | per-cell, timed "projectiles and sight pass" flag read by `blocked` / `lineClear`, for both sides. Cheap fallback that fits the engine: +1 strain per wall crossed |
| Plumb Line | **needs a new system: two-stage part** | per-button state (anchor live / not) and a second-press path that ignores the cooldown |
| Borrowed Time | **needs a new system: short history** | 1.5 s ring buffer of position and damage taken |

**Suggested build order.** First the 18 that fit, since they give the full
white/blue spread of every slot. Then marks and interrupt (small, and they unlock
two combo parts). Then bounce and breach, the two the owner asked for. Zones,
two-stage parts and history last.

---

## 7. Strain maths (commitment)

**The only strain sources:** push +2, Plenty +4, Coil +1 per cast, Borrowed Time
+2 per cast, Brace ceil(dmg / 8). **The only relief:** quiet −2, Rest −6. No
part reduces strain.

**Relief per level** (6 fights, Rest on about half the levels):
2 × 6 + 6 × 0.5 = **about 15 strain**. That supports **about 7 pushes per level,
roughly 1 per fight**, before strain climbs. (DESIGN.md still says −4 per fight;
the code uses −2, which halves the free-push allowance the doc worried about.)

| play style | net strain per fight | per level (−3 Rest) | Stopped around |
|---|---|---|---|
| Comfort: 1 push per fight | 0 | −3 | never (Broke is the threat) |
| 2 pushes per fight | +2 | +9 | depth 3 |
| Coil, 3 casts + 1 push per fight | +3 | +15 | depth 2 |
| Borrowed Time once + 1 push | +2 | +9 | depth 3 |
| Coil burst at the boss only (10 casts) | +10 once | – | the boss fight is where it goes |

So every strain part can Stop the run, and none makes it unreachable. Each one is
a moth-and-flame choice: the power is real, and so is the road it puts you on to
Stopped. Brace is the one that makes Stopped *strategically* valid. At high
strain it turns a lethal hit into a Stopped, so a player near both limits can
choose the soft ending.

**Target outcome split** (no win condition yet, so this is about which ending you
get): strain-part builds should end **Stopped** in about 55–65% of runs; builds
without strain parts about 30%, the rest Broke. Verify with play or a sim.

---

## 8. Open questions for playtesting

| # | variable | current | why it's uncertain |
|---|---|---|---|
| 1 | Signal Flare mark duration | 4.0 s | Signal + Vent kills a 3-pack in two presses; if it dominates, drop it to 2.5 s before touching damage |
| 2 | Coil strain per cast | +1 at 1.2 s cd | if nobody takes it, try +1 per two casts; if everyone does, cd 1.5 |
| 3 | Lob flight time and hit rate | 0.8 s, assumed 0.75 on hulks | every Flare number depends on it; measure it on the phone |
| 4 | Frayed Cleaver thresholds | 6 / 12 | decides whether "live at high strain" is a build or a trap |
| 5 | Breach duration | 4.0 s | long enough for ~1–2 sentinel answers; shorter makes Through-Line safe, longer makes it useless |
| 6 | Brace conversion | ceil(dmg / 8) | at /6 it's rarely worth it; at /10 it makes hits nearly free |
| 7 | Charger and swarm stats | assumed (§0) | drop weights and the Frost Trail trip rule were sized against them |
