# Charger and swarm: systems and maths (Balancer pass)

Pass 1 of 3. Mechanics and numbers only. The feel/VFX/SFX pass dresses them,
and the spec pass makes them buildable. Working names: **charger** (the ram) and
**mites** (one swarm body), led by a per-pack coordinator called the **brood**.

The swarm numbers come from a small sim, `design/enemies/swarm-sim.mjs`
(`node design/enemies/swarm-sim.mjs`): an open 20x20 room, no walls, 40 runs per
row. The charger numbers are worked by hand. Treat all of it as a starting point
for tuning on the phone.

---

## 0. What changed from the placeholders (parts doc §0)

| | placeholder | this pass | why |
|---|---|---|---|
| Charger HP | 36 | **36** | kept: Lens + 2 autos, or one stun + any big hit |
| Charger walk | 3.8 | **3.8** | kept: it doesn't need to catch you, it needs a lane |
| Charger windup | 700 ms line | **900 ms: 495 tracking + 405 locked** | 700 ms (lock at 0.6) left 0.21 s to react at 3.5 u. Phone reaction is about 0.3 s (§2.3) |
| Rush | 18 u/s, up to 10 u | **18 u/s, length clamp(d + 3.5, 6, 11)** | always passes through Still and ends past him, so "a wall behind you" means something |
| Rush damage | 14 | **14** | kept |
| Wall stun | 1.2 s | **1.2 s at ×1.5 damage, then 400 ms recover** | the boss's rule, scaled down |
| Swarm HP / radius / speed | 8 / 0.3 / 4.8 | **8 / 0.3 / 4.8** | kept |
| Swarm windup | 250 ms per body | **550 ms per surge, one ring for the whole pack** | 250 ms is below human reaction and gives 8 tells. Measured cliff in §3.4 |
| Swarm bite | 3 dmg each | **3 per biter, at most 4 biters, one hit** | the 0.35 s hurt cooldown folds simultaneous bites into one 3-dmg hit today (§1) |
| Swarm pack | 6–8 | **6–8** | kept |
| Treasure class charger | 1/1/2/4 | **2/1/1/4** | head and legs are under-dropped across a run (§8) |
| Treasure class swarm | 3/3/1/1 | **4/1/1/2** | same |

---

## 1. Engine facts that shaped this

| fact (code) | consequence for the new archetypes |
|---|---|
| `hurtPlayer` has one global 0.35 s cooldown, and **hits during it are dropped, not queued** | 8 mites biting on the same tick deal 3, not 24. A 3-dmg bite landing first also **eats a 14-dmg rush** that follows within 0.35 s. Fixes: the surge resolves as one aggregated hit (§3), and the engine gets the top-up rule (§4.4) |
| Still and enemies **don't collide** (only `terrain.pushOut` on Still) | the rush passes through Still. The hit is a swept-segment test, one per rush. Mites must stop at a bite ring themselves; nothing holds them off Still's body |
| `BODY_SPACING = 1.1` for every pair, split 50/50 | a mite pair at r 0.3 would sit 1.1 apart (a hulk's spacing), and a rushing charger would be dragged by every body it passes. Spacing becomes per pair; rushing chargers and lunging mites are exempt (§4.3) |
| Auto attack and every auto-targeted part pick the **nearest** enemy; bolts stop at the first body | mites screen whatever stands behind them. That's the job of the "swarm + sentinel" pack (§7) |
| Boss charge: drawn lane 2.3 wide (half 1.15), but `hitYou` is centre distance < `radius + 0.5` = **2.1** | **the boss lane under-draws its hit zone by 0.95 u.** Still's centre 2.0 off the line, visibly outside the strip, gets hit. The charger is built honest (§2.2); the boss fix is in §11 |
| Boss charge: `clampMove` each tick, "blocked" = moved less than asked by > 0.05 | reused as is for the rush, including crates (they're circles in `hits`) |
| Still's dash stops at the first solid (`clampMove`) and smashes a breakable it reaches | symmetry for the rush: **solids stop it, and a breakable breaks doing it** |
| Chill Vent rule (parts doc): never slows a windup, strike or rush | `speedMul` only scales the walk, for both new archetypes |
| Stagger: sliding > 1.5 u/s blocks advancing and starting a windup, not a windup in progress | kept for both. A shove during a locked windup moves the lane origin with the body. Vent shoves radially, so it pushes a charger straight back along its own lane: more distance means more reaction time, and a locked rush has a fixed length (§2.2), so a shove of ≥ 3.5 u makes it stop short of Still. That's the player's doing and a skill |

---

## 1a. Why these two: the movement-habit matrix

Deeper levels get harder by asking for more kinds of movement, not by adding
HP. Each archetype punishes one habit, and the charger and the swarm cover the
two habits nothing punishes today.

| habit | hulk | sentinel | **charger** | **swarm** |
|---|---|---|---|---|
| standing still | hit (ring on you) | hit | hit | hit (ring under you) |
| moving straight at/away from it | – | hit (along the line) | **hit (along the lane)** | **hit (the ring leads you)** |
| strafing at a steady angle / circling | safe | safe | safe | **hit (the lead catches a steady curve: 93%)** |
| hugging it (≤ 2 u) | hit | safe (it backs off) | **hit after 1 s (point-blank rush)** | hit |
| wall right behind you | – | – | **its weakness: it stuns itself** | – |
| behind cover | safe (it paths round) | safe | safe; a locked rush **stuns on the cover** | safe (lunges are bodies; they path round) |
| changing direction when a tell appears | safe | safe | safe | **safe (the only answer)** |

The charger rewards lateral movement and a wall at your back. The swarm punishes
any movement you can predict. Put them in one pack and you have to keep
changing direction and pick your wall. That's the depth-7 fight.

---

## 2. Charger

### 2.1 Stats

| field | value | note |
|---|---|---|
| `hp` | 36 | |
| `bodyRadius` | 0.6 | bigger than a hulk (0.55); low and long |
| `speed` (walk) | 3.8 | Still 5.5, hulk 4.3 |
| `knockMul` | 1; **0 while rushing** | the committed part can't be shoved (boss: 0.05) |
| `preferMin` / `preferMax` | 3.5 / 8.5 | the run-up band |
| `fireRange` | 9.0 | never starts a windup from further out |
| `hugMs` | 1000 | how long it tries to back off before rushing anyway |
| `windupMs` | 900 | |
| `lockAt` | 0.55 | 495 ms tracking, 405 ms locked |
| `rushSpeed` | 18 u/s | boss 21 |
| `rushLength` | clamp(d_lock + 3.5, 6, 11) | truncated at the first solid |
| `laneHalf` | radius + 0.1 = **0.7** (drawn 1.4 wide) | |
| hit test | Still's centre within `laneHalf + 0.42` = **1.12** of the swept segment | = Still's body overlapping the drawn lane. Honest |
| `damage` | 14 | once per rush |
| `stunMs` | 1200, damage taken ×1.5 (plating lifted) | on any solid, or on Anvil |
| `stunRecoverMs` | 400 | |
| `missRecoverMs` | 900 | rush ended in the open (skid is inside the length) |
| `tripRecoverMs` | 1200, no ×1.5 | Frost Trail |
| `reloadMs` | 700 | after recover: may walk, may not wind up |
| trample shove | 1.4 u perpendicular, ×knockMul, 0 damage | once per enemy per rush |

### 2.2 Phase machine

```
idle(asleep) -> approach -> windup[track 495 | locked 405] -> strike(rush) -> recover -> approach
                                  |                              |  |  |
                        interrupt (Parry) -> approach            |  |  trip (Frost) -> recover 1200
                                                                 |  solid / Anvil -> stun 1200 (x1.5) -> recover 400
                                                                 end in open -> recover 900
```

| phase | what it does | exits |
|---|---|---|
| **approach** | If `lineClear(pos, Still, pad 0.6)` fails (the *body* lane, see below) or dist > 8.5: walk `nextStep` at 3.8 × speedMul. If dist < 3.5: back off, directly away, at 3.0 × speedMul, facing Still. Else hold and turn to face. `reload` ticks down throughout. | → windup when reload ≤ 0, dist ≤ 9, body lane clear, not staggered, the pack token is free, **and** a lock slot is booked (§4.1). Also → windup after 1000 ms of backing off, whatever the distance (the hug punish) |
| **windup: tracking** (0–495 ms) | Aim follows Still every tick, like the sentinel. The lane is drawn faint and narrow, its length recomputed each tick (clamp(d + 3.5, 6, 11), cut at the first solid by `clampMove` with r 0.6). Doesn't move. | at 495 ms: lock |
| **windup: locked** (495–900 ms) | Direction and length freeze. The lane goes bright at full width, and if it ends at a solid, an impact mark shows there. Lock click. | at 900 ms: rush |
| **strike: rush** | Moves 18 u/s along the locked line via `clampMove(r 0.6)`. Each tick: swept-segment test against Still (one hit, 14, `melee` with `source`), trample test against other enemies, breakable test. `knockMul` 0. | blocked → **stun** (smashes a breakable if that's what blocked it); reached length → recover 900; crossed a frost strip → recover 1200; caught by Anvil → **stun** |
| **stun** (recover phase with `stunned`) | Wedged. Takes ×1.5, and plating doesn't apply (§5). Can be shoved. | 1200 ms → recover 400 |
| **recover** | Turning around, normal damage. | → approach, `reload = 700` |

**Body lane vs sight lane.** The windup check uses `lineClear` with pad 0.6
against *solids*. A future Through-Line breach opens sight and projectiles, not
the floor (parts doc #7). So the charger never starts a rush through a breach,
and it can't be farmed by shooting holes in your own cover.

### 2.3 Reading and dodging the rush

Time from the lock click to contact, for Still standing on the lane at distance d:
`t(d) = 0.405 + (d − 1.12) / 18`. Stepping clear takes 1.12 / 5.5 = **0.204 s**
from the centreline. Reaction budget = t − 0.204.

| d at lock (u) | 1.5 | 2.0 | **3.5** (band min) | 5.0 | 6.5 | 8.0 | 9.0 |
|---|---|---|---|---|---|---|---|
| lock → contact (s) | 0.43 | 0.45 | 0.54 | 0.62 | 0.70 | 0.79 | 0.84 |
| reaction budget (s) | 0.22 | 0.25 | **0.33** | 0.42 | 0.50 | 0.58 | 0.64 |

- In its band (≥ 3.5) the budget is ≥ 0.33 s, about one phone reaction. At the
  placeholder's 700 ms windup, lock at 0.6 (280 ms locked), it was 0.21 s at 3.5 u.
- Hug it and it rushes point-blank after 1 s with 0.22–0.25 s. The tracking
  lane has been on screen for 495 ms, so you can see it coming, but you have to
  anticipate the click, not react to it.
- **Any lateral motion at the lock dodges it**: moving perpendicular clears the
  1.12 in 0.204 s < 0.405. Even a 45° diagonal (3.9 u/s across) clears in
  0.29 s. The charger only hits Still if he stands still or runs along the lane.
  That's the sentinel's lesson, reused. The threat comes from mixes (§1a).
- For comparison, the boss charge (locked 427 ms, 21 u/s, hit reach 2.1) gives
  0.14 s at d 4 and 0.23 s at d 6. It's the least fair tell in the game (§11).

### 2.4 Walls, cover, crates: the matador rule

| situation | outcome |
|---|---|
| Still stands 0–3.5 u in front of a wall, **in** the lane, and steps aside at the click | the rush reaches the wall (length = d + 3.5): **stunned on Still's side**, 1.2 s at ×1.5 |
| wall more than 3.5 u behind Still | the rush ends in the open, 900 ms recover, normal damage |
| Still steps **behind** cover during tracking | the lane follows him and is cut at the cover. The locked rush hits the cover and is stunned **on the far side**. Arcs and novas need a clear line (parts doc #2), so Still can't cleave it across the wall. The skill is keeping the wall *behind* you, not *between* you |
| Still behind cover before the windup | no body lane, so no windup. It paths round to find a lane |
| crate or barrel in the lane | the lane preview ends at it. The rush stops, **the crate breaks**, and the charger is stunned exactly as at a wall. Contents drop as usual (10% part, 30% scrap). One-use matador post |
| unbreakable prop, column | = wall |
| corridor (4 u, ~3.4 u free) | a lane along the corridor still leaves 1.28 u of lateral room for Still's centre against the 1.12 needed. Tight but dodgeable. An off-axis rush meets the side wall and stuns early; the preview shows it |

**Kill maths in a stun** (1.2 s at ×1.5, white kit):

| hits landed in the window | damage | kills a 36-HP charger? |
|---|---|---|
| 2 autos | 15 | no |
| Lens + 2 autos | 39 + 15 = 54 | yes |
| Cleaver + 2 autos | 27 + 15 = 42 | yes |
| Piston alone | 39 | yes |
| Flare (lands 0.8 s later, inside 1.2) | 27 | + 2 autos, yes |
| Patient Lens at full | 48 | yes |

One stun plus any big ability ready kills a charger. That's the reward for
reading the lane. The cost is standing in front of a wall, where hulk rings and
swarm rings box you in.

### 2.5 Trample: what the rush does to other enemies

| rule | value |
|---|---|
| who | any non-boss enemy, its own pack or not, within `its radius + 0.7` of the swept segment |
| what | shoved **1.4 u perpendicular to the lane**, away from the centreline, × its knockMul. Stagger ≈ 0.24 s + walk-back 0.33 s (hulk) |
| damage | **0** (open question §10 #4) |
| windups | not cancelled (committed), but the ring/lane moves with the shoved body, as with Still's shoves |
| rushing charger vs rushing charger | pass through each other |
| repeat rate | once per enemy per rush, ≥ 3 s apart: nowhere near the 0.3 s stagger-lock threshold |
| a trampled mite | flung out of its orbit slot; the brood refills (§3.3) |

Why no damage: at 14 per trample, baiting rushes through the pack becomes a
farm (3 rushes kill a hulk for free). Why the shove: the lane has to *read* as
dangerous to everything, and a pack flung aside is the clearest proof on a
6-inch screen. It also rearranges the fight: after a rush, the hulk that was on
you is 1.4 u to the side and staggered.

### 2.6 Readability with two chargers and a sentinel awake

| rule | number | what it prevents |
|---|---|---|
| **Honest lane**: drawn width = hit width, drawn length = rush length, impact mark where it will stop | half-width 0.7 drawn, hit at 0.7 + Still's 0.42 | the boss's 0.95 u lie (§1) |
| Two-stage tell: tracking faint + narrow, locked bright + full width + click | 495 / 405 ms | "is it committed yet?" |
| **Pack token**: one charger per pack in windup or rush at a time | – | two lanes from one pack locking together |
| **Lock book** (§4.1): committed locks, across every awake enemy, at least 300 ms apart | 300 ms | two clicks you can't tell apart, and one dodge that has to answer two lines at once |
| Lane widths are distinct | sentinel line 0.62, charger 1.4, boss 2.3 (should be 4.2, §11) | the feel pass can tell them apart by width before pattern |
| The camera frames the locked lane's end point, not only the body | – | an 11 u lane from an on-screen charger ending off-screen |
| It never winds up from beyond 9 u | `fireRange` 9 | rushes from off-screen |

Worst case, 2 chargers (two packs) + 1 sentinel: lock rates 1/3.0 s + 1/3.0 s +
1/2.9 s ≈ **1.0 lock per second**, never two within 300 ms, at most 2 lanes and
1 aim line on screen, and at most one of them freshly locked.

### 2.7 Charger threat numbers

| | value |
|---|---|
| cycle (open-floor miss) | windup 0.9 + rush ~0.52 (mean length 9.4 u) + recover 0.9 + reload 0.7 = **3.0 s** |
| cycle (wall stun) | 0.9 + ~0.4 + 1.2 + 0.4 + 0.7 = 3.6 s |
| max DPS if every rush hits | 14 / 3.0 = **4.7** (hulk 6.6, sentinel 2.8) |
| time to kill, white kit, open floor | autos alone 4.3 s (8 shots); Lens + 2 autos ≈ 1.3 s once in range |
| time to kill, one wall stun | ≤ 1.2 s |
| 100 HP / 14 | 8 rushes to Break Still |

---

## 3. Swarm (mites and the brood)

### 3.1 Stats

| field | value | note |
|---|---|---|
| mite `hp` | 8 | auto 5 → 2 autos. Every ability in the pool one-shots a mite |
| mite `bodyRadius` | 0.3 | |
| mite `speed` | 4.8 | Still outruns it by 0.7 u/s |
| mite `knockMul` | 1 | Vent shove 4.2 u → 0.36 s stagger + 0.88 s walk-back |
| pack | 6–8 mites (8 when the pack is swarm-led, 6 in mixed packs) | |
| `innerMax` | **4 biters around Still, across all broods** (global cap) | the swarm DPS cap doesn't grow with the number of swarms |
| `innerR` | 1.8 | orbit radius of the biters |
| `outerR` | **5.5** | outside Vent/Chill reach (4.1) and Backdraft reach (5.0) |
| spin | inner +0.5 rad/s, outer −0.3 rad/s | two rings turning opposite ways read as two rings, not a cloud |
| `refillMs` | 500 | an outer mite takes an empty inner slot after this |
| surge range | inner mites within **2.6** of Still, body lane clear, not staggered | |
| surge need | ≥ min(3, inner alive) | |
| `windupMs` (surge) | **550** | |
| lead | lock point L = Still.pos + Still.velocity × **0.45 s**, ≤ 2.5 u from Still, cut by `clampMove`, pushed out of walls | |
| ring | radius **1.0** around L; hit = Still's centre within 1.0 at 550 ms | same convention as the hulk ring (centre test) |
| strike | 150 ms lunge to L (≤ 2.8 u, `clampMove`) | presentation; damage is on the 550 ms tick |
| damage | **3 × biters** (biters ≤ 4) → 3 / 6 / 9 / **12**, one `melee` action | one hurt event |
| `recoverMs` | 800 | biters sit in a clump within ~0.6 of L |
| `regroupMs` | 500 | minimum gap before the next surge |

### 3.2 Phase machine: per mite, driven by the brood

The brood is one invisible object per swarm pack. It ticks before its mites,
owns the surge, and hands each mite a role and a target point. Each mite is
still an `Enemy` (so autos, bolts, parts, marks and Parry all work per body),
with the usual phases.

| mite phase | when | what it does |
|---|---|---|
| idle | asleep | a nest: mites 0.6 apart within 1.4 of the pack spot |
| **approach** | default | *far* (> 6 u or no line): stream to Still with `nextStep`, spacing keeps a column in corridors. *Near*: go to its orbit slot (inner 1.8 or outer 5.5). Slots are assigned **by current bearing** (sorted by angle around Still), so mites never cross the middle to reach a slot. That matters: crossing puts outer mites inside the Vent (§3.5) |
| **windup** | a surge it joined | crouches, doesn't move. Hit during it by Parry: interrupted, leaves the surge (−3 dmg) |
| **strike** | 150 ms | lunges to L |
| **recover** | 800 ms | sits where it landed. **The punish window**: up to 4 mites in a 0.6-radius clump, not moving |

| brood state | entry | exit |
|---|---|---|
| gather | recover done, and 500 ms of regroup | inner count in surge range ≥ need, **and** a lock slot booked (§4.1) → surge |
| surge windup (550) | L fixed, ring drawn at L, one windup sound | 550 → damage check: `3 × (biters alive and within 2.8 of L with a body lane)` if Still is within 1.0 of L |
| strike + recover (950) | – | → gather |

Minimum surge cycle: 0.55 + 0.15 + 0.8 + 0.5 = **2.0 s**.

### 3.3 Group movement, and how it avoids being noise

| problem | rule |
|---|---|
| 8 tells at once | **one ring per surge**, on the floor at L. No per-mite telegraph |
| a blob you can't count | two rings of at most 4 + 4 bodies, turning opposite ways |
| unavoidable blender | ≤ 4 biters around Still across all broods, one hit per surge, 2.0 s minimum cycle → **hard cap 6.0 DPS** from any number of swarms |
| two swarms surging together | the lock book spaces surge starts ≥ 300 ms from each other and from charger/sentinel locks |
| fodder that dies to one button | the outer ring sits beyond every nova's reach; only the inner 4 are exposed at once |
| leader? | no leader in a normal pack; the brood is the "mind". With an elite, the queen (§5) is always one of the four biters |

### 3.4 Incoming DPS caps (sim: 8 mites, no cover, 30 s, no attacks from Still)

| Still's behaviour | DPS taken | surges that hit |
|---|---|---|
| **standing still, never dodging** | **5.5** (hard cap 12 / 2.0 = 6.0) | 93% |
| circling at a steady rate, not reacting | 5.5 | 93% (the 0.45 s lead catches a steady curve) |
| running straight, bouncing off room walls | 2.2 | 93%, but fewer surges (they can't keep up) |
| wandering, new direction every 0.6–1.5 s | 2.5 | 66% |
| **standing, steps out on the ring, reaction 0.35 s** | **0.0** | 0% |
| **circling, turns away on the ring, reaction 0.35 s** | **0.0** | 0% |
| Quick elite (walk 7.0), standing | 6.0 | 100% |
| Quick elite, running straight | 3.0 | 86% |

**The dodge is a cliff, and it's set by the windup.** Stepping out of a 1.0
ring from its centre takes 0.18 s, so a dodge works whenever reaction ≤
windup − 0.18.

| surge windup | reaction 0.25 s | 0.30 s | 0.35 s | 0.40 s |
|---|---|---|---|---|
| 450 ms | dodged | **fails (5.9 DPS)** | fails | fails |
| 500 ms | dodged | dodged | fails | fails |
| **550 ms** | dodged | dodged | **dodged** | fails |

550 ms sets the cliff at a 0.35 s reaction, one reaction on a phone with a
thumb on a stick. The lead has to scale with it: a straight runner at 5.5 u/s
is at +3.0 u when the ring fills, so the lead must be ≥ 0.55 − 0.18 = 0.37 s or
runners are never hit. At 0.45 the runner is 0.55 u from the centre, inside.
Turning 90° or reversing escapes; stopping doesn't.

**Against Still's 100 HP** (sim, 8 mites, standing and never dodging, 60 s):

| kit | damage taken | time to clear | same kit, wandering | same kit, reacting ≤ 0.35 s |
|---|---|---|---|---|
| auto only | 35 | 9.5 s | 18 | 0 |
| auto + Cleaver | 18 | 6.0 s | 8 | 0 |
| auto + Vent | 9 | 4.4 s | 9 | 0 |
| auto + Cleaver + Vent | 9 | 4.1 s | 6 | 0 |

A lone swarm costs a careless auto-only Still about a third of his HP. It costs
an attentive one nothing. Its job is pressure inside mixed packs, where "just
stand and step out" competes with hulk rings and charger lanes. The hurt
cooldown (0.35 s) never limits the swarm itself, since the cycle is 2.0 s. It
only matters when another enemy's hit lands in the same window (§4.4).

### 3.5 Why two rings

With every mite orbiting at 1.8, Pressure Vent (reach 4.3 + 0.3 − 0.5 = 4.1)
and Chill Vent both kill **the whole swarm in one press**, since every nova
deals ≥ 10 against 8 HP. With the outer ring at 5.5, a Vent kills the 4 biters
and the other 4 come in about 1.3 s later (0.5 refill + 3.7 u / 4.8). A Vent
kit clears in 4.4 s instead of one frame. In the sim, before slots were
assigned by bearing, outer mites crossed through the Vent to reach their slots
and it cleared in 2.5 s. The bearing rule carries weight: keep it in the spec.

---

## 4. Shared engine rules (both archetypes need them)

### 4.1 The lock book

`Combat` keeps the times of upcoming committed locks. An enemy that wants to
start a windup computes its lock time (now + lock offset) and may start only if
no booked lock is within **300 ms** of it; otherwise it waits in approach.

| booker | lock offset | counts |
|---|---|---|
| charger | 495 ms | yes |
| sentinel | 0.6 × 760 = 456 ms | yes (a small change to `ranged.ts`) |
| surge start (its ring is fixed from the start) | 0 | yes |
| hulk | – | no: its ring is centred on itself and it's the baseline enemy |
| boss | – | no (it has no other lockers in its arena) |

300 ms is just under the hurt cooldown and above a click-to-click
discrimination floor. The cost is small: with 3 bookers at ≤ 1 lock/s total,
the average wait is well under 100 ms.

### 4.2 Pack token

At most one charger per pack in windup or rush at a time. A second charger
waits until the first is in recover.

### 4.3 Per-pair body spacing

`spacing(a, b) = a.radius + b.radius` (hulk–hulk stays 1.1; sentinel–sentinel
1.0; mite–mite 0.6; mite–hulk 0.85; charger–hulk 1.15). Skip the pair when
either one is a rushing charger (trample handles it) or a lunging mite. Awake
bodies at depth 7: about 40 → 780 pairs per tick. Trivial.

### 4.4 Hurt top-up

Inside the 0.35 s window, Still takes the **largest** hit, not the first:
`apply max(0, dmg − windowMax)`, then `windowMax = max(windowMax, dmg)`. A
3-dmg bite no longer shields a 14-dmg rush. Per-window intake stays capped at
one hit, which is what the cooldown was for. An Anvil catch sets the window to
"body strikes caught" for its remainder (the parts doc's "a clump of
simultaneous strikes all fold into the one catch").

### 4.5 Melee actions carry their source

`{ kind: 'melee'; damage; source?: Enemy }`. Anvil needs it to stop the rush
(§6), and Brace and the top-up don't care.

### 4.6 Update context

Mites need Still's velocity (for the lead) and every booker needs the lock
book. `update(dt, target, terrain)` gains a fourth argument,
`ctx: { targetVel, canLock(offsetMs), book(offsetMs) }`. Chaser and Assembler
ignore it.

---

## 5. Elites

The leader gets 2× HP and size 1.28 as today. Allowed mods per leader archetype:

| mod | charger leader (72 HP) | swarm queen (16 HP, r 0.4) |
|---|---|---|
| **Quick** (pack walk ×1.45) | **yes**. Walk 5.5 = Still's: it holds its band against a kiting Still. Windup and rush unchanged (committed) | **yes**. Walk 7.0 > Still: the outer ring keeps pace; straight-runner intake 2.2 → 3.0; the standing cap doesn't change (6.0, cycle-bound) |
| **Plated** (armor 0.5, knockMul 0.3) | **yes, the matador elite.** Outside a stun it takes half (72 HP = 144 effective). **In a stun the plate lifts: ×1.5 of full damage**, so 48 raw damage across stuns kills it. Usually 2 stuns. A Vent moves it only 0.7–1.3 u, never enough to make a locked rush stop short | **no**. A 16-HP body at half damage is a number, not a decision |
| **Many** (splits on death) | **yes**. Splits into 2 chargers: 12 HP, size 0.72, r 0.45, lane half-width 0.55, same 14 damage and timings, awake. The pack token makes them alternate. `split()` must spawn the leader's archetype (today it always makes Chasers) | **no**. A swarm already is many; more bodies are more noise |
| **Warden** (pack ×0.35 while it stands) | **yes**. The pack's hulks take 0.35× until you stun-kill the charger | **yes, the screen elite.** The queen is **always one of the 4 biters** (never rotates out). Mites take 0.35×: Cleaver 6.3 and Vent 5.3 no longer one-shot them. Kill the queen first: a Cleaver (18) kills her if she's in the arc; a Vent leaves her at 1, and any auto finishes her |

Why the queen bites: at the outer ring, every auto-targeted part (nearest) would
pick an inner mite, and she'd keep her 5.5 u distance from Still. She'd be
unreachable, and a Warden swarm would be 7 × 22.9 = 160 effective HP of grind.
In the inner ring she's one of four at the same distance.

**Plated in a stun, implementation.** Warden overwrites `armor` every tick for
non-leaders, and only one mod applies per elite, so a flag is enough:
`hit(d): hp -= d × armor × (stunned ? 1.5 × (plated ? 2 : 1) : 1)`.

---

## 6. Depth introduction and pack mixes

### 6.1 Budget in body-equivalents (BE)

The pack budget stays today's size formula (`2 + {0,1} + ⌊(d−1)/2⌋ + big&&d>2`).
It counts BE instead of bodies:

| archetype | BE | HP per BE | standing-still DPS cap per BE |
|---|---|---|---|
| hulk | 1 | 30 | 6.6 |
| sentinel | 1 | 20 | 2.8 |
| charger | 1.5 | 24 | 3.1 |
| mite | 0.25 (a swarm of 8 = 2.0) | 32 | 3.0 (8 mites) |

**This is the proof of "deeper is more varied, never more HP or damage".**
Swapping hulks for chargers or mites at equal BE changes pack HP by −20% to
+7%, and it *lowers* the raw damage a standing Still takes (3.0–3.1 against
6.6 per BE). What rises is how many movement habits the pack punishes (§1a).
Per-enemy stats never change with depth.

### 6.2 When each appears

| depth | new | rule |
|---|---|---|
| 1 | – | unchanged: 2–3 hulks, one pack has a sentinel |
| **2** | **charger** | exactly one **lesson pack**: 1 charger + 1 hulk (2.5 BE), in a main 5x5 room with cover, never an elite. The depth-3 boss charges with the same lane-and-wall-stun rule, so depth 2 teaches it first |
| 3 (boss) | – | packs before the arena as depth 2, ≤ 2 charger packs |
| **4** | **swarm** | exactly one **lesson pack**: 8 mites alone (2.0 BE, allowed under budget), main big room, never an elite. 1–2 charger packs |
| 5–6 | mixes | templates below |
| 7+ | 4-archetype packs | templates below |

### 6.3 Templates (first listed = elite leader)

| depth | template | BE | HP | weight |
|---|---|---|---|---|
| 2–3 | C + H | 2.5 | 66 | lesson / 1 per level |
| 4 | M8 | 2.0 | 64 | lesson |
| 4 | C + 2H | 3.5 | 96 | 2 |
| 4 | C + H + S | 3.5 | 86 | 1 |
| 5–6 | **M8 + S** ("the screen": the sentinel behind a swarm; autos and bolts hit mites first) | 3.0 | 84 | 1 |
| 5–6 | 2C + H ("bulls") | 4.0 | 102 | 1 |
| 5–6 | C + 2H + S | 4.5 | 116 | 1 |
| 5–6 | M6 + 2H | 3.5 | 108 | 1 |
| 5–6 | H/S as today | 3–5 | – | 2 |
| 7+ | C + M6 + H + S | 5.0 | 134 | 1 |
| 7+ | 2C + M6 | 4.5 | 120 | 1 |
| 7+ | M8 + 2S | 4.0 | 104 | 1 |
| 7+ | C + 3H + S | 5.5 | 146 | 1 |
| 7+ | H/S as today | 5–7 | – | 2 |

**Fill rule.** Pick a template whose BE ≤ budget + 1, then add hulks until
BE ≥ budget − 0.5. If no template fits, drop a mixed swarm from 8 to 6.

**Caps.**

| cap | d2–4 | d5–6 | d7+ |
|---|---|---|---|
| charger packs per level | 1–2 | ≤ 3 | ≤ 3 |
| swarm packs per level | 1 (d4) | ≤ 2 | ≤ 2 |
| chargers per pack | 1 | 2 | 2 |
| distinct archetypes per pack | ≤ 2 | ≤ 3 | ≤ 4 |
| chargers in side rooms (3x3, 12 u) | never: every rush stuns on a wall, so it's free | never | never |
| swarms in side rooms | no | yes (tight rooms push the outer ring inside Vent reach: a deliberate easier case) | yes |

---

## 7. Interactions with the part pool

### 7.1 Every part that touches either one

| part | vs charger | vs swarm | verdict |
|---|---|---|---|
| Focusing Lens | 26; 39 in a stun (kills) | 1 mite per 4.2 s; stopped by the first body | fine |
| Flare | lob lands inside a 1.2 s stun: 27 | cast at a surge strike: lands 0.8 s later on the recover clump (800 ms), kills ≤ 4 | **synergy** |
| Cracked Lens | 20 | pierces a line of mites and reaches a screened sentinel | fine; the screen answer |
| Patient Lens | 32 → 48 in a stun: "patience + matador" | overkill on a mite | fine |
| Signal Flare | mark + stun + Piston = 26 × 2 × 1.5 = 78 | irrelevant (mites die anyway) | fine |
| Through-Line | breaches open sight, **not** the body lane (§2.2): no rush through a hole | – | rule written |
| Overclocked Coil | fine | 3 mites per cast at +1 strain | fine; priced in strain |
| Pressure Vent | during a windup, shoves it 2.4–4.2 u back along its own lane: +0.13–0.23 s of budget, and a locked rush pushed back ≥ 3.5 u stops short of Still. No effect on a rush (knockMul 0) | kills the 4 biters; outer ring safe (4.1 < 5.5) | fine (§3.5) |
| Backdraft Vent | pulls it into hug range → it backs off | reach 5.0 < outer 5.5: pulls biters only | margin 0.5 u, watch |
| Chill Vent | walk ×0.5; the rush isn't slowed | kills biters; slowed mites can't keep up with a moving Still | strong torso answer, not free |
| Brace | 14 → 2 strain | 12 → 2 strain | fine |
| Ward, Mirror Ward | nothing (the rush is a body strike) | nothing | torso still has 5 answers: not a hard counter |
| Lure | lane aims at the decoy; Still in it still gets hit | surges the decoy (no lead); the 18 burst kills its biters | strong, gold, 12 s |
| Scrap Cleaver | 18; 27 in a stun | hits ~1.5 orbiting biters, **all 4 in the recover clump** | the "dodge, then cut" rhythm |
| Piston | 26 / 39 in a stun | one mite | fine |
| Rusted Hook | yanks it to 1.6 → hug | nearest = a biter | fine |
| **Parry Clamp** | reach 3.25 < band 3.5: you must step in during its windup, into the lane at 0.25 s budget. Cancel → approach, reload 700. cd 3.6 vs cycle 3.0 | kills a crouching biter (10 > 8), −3 surge dmg | fair: risk priced |
| Frayed Cleaver | – | at 12+ (360°, reach 3.45): all 4 biters every 2.6 s | intended strain payoff (parts doc #23) |
| Clamp Toss | can't grab a rushing charger; a thrown charger into a wall takes +12 but **isn't stunned** (only rushes stun) | throw a mite into the clump: 14 splash kills | fine |
| **Anvil** | press at the click: contact is 0.43–0.84 s later, inside the 0.9 s window at every d ≤ 9. Caught: 30 to it (36 → 6), **the rush stops as at a wall: stunned 1.2 s ×1.5**, then any hit kills. Needs `melee.source` | surge caught: 30 in 3.0 kills all ≤ 4 biters | high catch rate, but that's Anvil's whole job; it kills a hulk per catch already. Accepted |
| Kickstart / Skid Plates | lateral dodge; knock 0 on a rushing body | runs over the ring: 12 / slam 10 kill mites | fine |
| Skitter | 3.4 u in 180 ms: dodges any rush, but walking already does | out of any ring | fine |
| **Frost Trail** | a rush crossing the strip trips: recover 1200, **no** ×1.5. The strip lies along your dash, so dash across the lane | slowed mites fall behind | fine: a stop, not a stun |
| Spring Heels | vault behind cover during tracking → the locked rush stuns on the far side (can't be cleaved there); or vault so it has to re-path | breaks both rings for ~1.7 s of detour | fine |
| Plumb Line, Borrowed Time | escape / rewind a rush | escape / rewind a surge | fine |

### 7.2 Checks

| check | result |
|---|---|
| **Does any part trivialise the charger?** | Anvil and walls come closest, and both demand standing in the lane. Frost Trail gives a stop without the ×1.5. None works without a positional decision |
| **Does any part trivialise the swarm?** | Without the outer ring, every nova did (one press). With it: Vent 4.4 s, Frayed at 12+ ~4 s (costs strain), Anvil 2 catches. None under 3.5 s |
| **Does the charger hard-counter a slot?** | Torso: Ward and Mirror do nothing, 5 of 7 help. Arms: melee reaches it in its recover (it ends ~3.5 u past you; Cleaver reach is 3.75). No |
| **Does the swarm hard-counter a slot?** | Head: Lens, Patient and Ricochet are weak (single target), but Flare, Cracked, Coil and Signal work, and autos handle mites (2 each). A pure single-target kit (auto + Lens + Piston) clears 8 mites in ~5.8 s. No |
| **Stagger-lock** (parts doc §0: repeats ≤ 0.3 s) | trample repeats every ≥ 3 s; the rush can't be shoved; the fastest knock on a mite is still Piston at 3.0 s. No lock |
| **Displacement lock** | the kit's best 1.88 u/s < charger walk 3.8, and it doesn't need to walk to you, just a lane |
| **Strain** | neither needs a push: the charger has walls, the swarm has stepping out. The strain-priced shortcuts (Frayed 12+, Coil, a pushed Patient Lens into a stun) are faster, not required. Stopped stays a choice, not a tax |

---

## 8. Loot

| rule | value |
|---|---|
| per-kill chance | `0.66 × w / W_pack`, with w: hulk, sentinel, charger 1; mite 0.25; split and summoned bodies 0 |
| `W_pack` | summed once, at pack creation |
| elites, side rooms | always pay (unchanged) |
| pure swarm of 8 | 0.0825 per mite; P(≥ 1 drop) = 1 − 0.9175⁸ = **49%** (a 3-hulk pack today: 1 − 0.78³ = 52%) |
| "M8 + S" | mites 0.055 each, sentinel 0.22: its drop keeps the sentinel's treasure class instead of being diluted to 0.073 |
| a crate broken by a rush | drops its contents as if Still broke it |
| treasure class, charger | **head 2, torso 1, arms 1, legs 4** |
| treasure class, swarm | **head 4, torso 1, arms 1, legs 2** |

Run-wide slot share with the §6 mixes (drops by archetype, depths 1–8):

| treasure classes | head | torso | arms | legs |
|---|---|---|---|---|
| placeholders (charger 1/1/2/4, swarm 3/3/1/1) | 20.2% | 30.1% | 28.3% | 21.3% |
| **this pass (charger 2/1/1/4, swarm 4/1/1/2)** | **23.3%** | **26.9%** | **26.9%** | **22.9%** |
| pool share (8/7/7/8 parts) | 26.7% | 23.3% | 23.3% | 26.7% |

The remaining skew comes from hulk-heavy depths 1–2 (hulks drop torso/arms
3:1). By depth 7 the per-level split is even (0.95 / 1.08 / 0.95 / 0.98 drops).
If head and legs still feel thin, change the hulk to 1/2/2/1, not these two.

---

## 9. Build cost

| item | cost | notes |
|---|---|---|
| `Charger` class | **fits** | the Chaser skeleton + the boss's charge code (per-tick `clampMove`, blocked → stun, `stunTimer`, ×1.5 in `hit`) + the sentinel's `strip()` lane with a fill. The lane length preview is one `clampMove` per tracking tick |
| kinds: `Enemy.kind`, `Archetype`, `TREASURE`, `addPack` switch, elite mod lists, `onWindup`/`onStrike` sound routing, footsteps, `strikeFx`, kill chunk colour | **fits** | plumbing |
| `split()` spawns the leader's archetype | **fits** | today it hardcodes `Chaser` |
| trample | **small** | in `Combat.update`: while a charger rushes, test other enemies against its swept segment |
| per-pair spacing + exemptions | **small** | one line in `updatePacks` |
| hurt top-up | **small** | ~5 lines in `hurtPlayer` |
| `melee.source` | **small** | a field on the action |
| loot weights | **small** | `pack.weight` at creation, read in `maybeDrop` |
| Plated-in-stun | **small** | a `plated` flag set by `crown` |
| update context (`targetVel`, lock book) | **small, touches all enemies** | a signature change; Chaser and Assembler ignore it; the sentinel adopts the book |
| lock book + pack token | **small new system** | a sorted list of booked lock times in `Combat` |
| **Brood + Mite** | **new system** | the per-pack coordinator (roles, slots by bearing, surge state, lead, aggregated action, one windup sound, the global 4-biter cap) + a light `Mite` class. ~250 lines. Pathing: mites use `nextStep` only when a wall blocks their slot; otherwise they steer straight (fewer flow fields) |
| Anvil stops a rush | small hook, on a gold that isn't built yet | `source.stopRush('caught')` |
| Frost Trail trip | on the zones system (parts doc, already new) | the charger exposes `trip()` |
| Parry on either | on the interrupt system (parts doc, already new) | charger: → approach, reload 700; mite: leaves the surge |

**Order.** Build the charger first: it fits the engine and it teaches the
boss's charge. Then the lock book (both need it), then the brood.

---

## 10. Open questions for playtesting

| # | variable | current | why it's uncertain |
|---|---|---|---|
| 1 | Surge windup / lead / ring | 550 ms / 0.45 s / 1.0 | the dodge is a cliff at reaction = windup − 0.18. Measure real thumb reaction on the Poco; ±50 ms flips the swarm from free to 5.5 DPS |
| 2 | Charger locked phase | 405 ms (0.33 s budget at 3.5 u) | same cliff, and 4 tells per fight instead of 1. If it's too easy, shorten the tracking phase, not the locked one |
| 3 | Wall stun | 1.2 s at ×1.5 | one stun + any big hit kills. If the matador loop makes chargers the easiest enemy, go to 1.0 s or ×1.3 before touching HP |
| 4 | Trample damage | 0 | at 0 the lane only rearranges; at ~5 it becomes a juke-the-bull tactic. Worth trying once packs are mixed |
| 5 | Outer ring radius | 5.5 (Backdraft reach 5.0) | if Vent still wipes swarms in play (mites jittering inside 4.1), move it to 6.0 before raising mite HP. At HP 11, Chill Vent (10) stops killing a mite but Vent (15) still does |
| 6 | Queen HP and ward | 16 HP, pack ×0.35 | she dies to one Cleaver in the arc: may be too quick, or a nice clean answer |
| 7 | Lock-book spacing | 300 ms | too wide delays attacks in dense rooms; too narrow gives back the double click |

---

## 11. Found outside scope (for the spec pass, not changed here)

| # | where | what | suggested fix |
|---|---|---|---|
| 1 | `boss.ts` charge | drawn lane 2.3 wide (half 1.15), hit at centre distance < 2.1. Still is hit 0.95 u outside the drawn edge; reaction budget 0.14–0.23 s at 4–6 u | hit when Still's body overlaps the lane: lateral < 1.15 + 0.42 = 1.57 (budget 0.35 s at 6 u). Or draw it 4.2 wide. The first keeps the lane's look |
| 2 | `combat.ts` `hurtPlayer` | the first hit in a window swallows larger ones | §4.4 top-up |
| 3 | `combat.ts` `split()` | always makes Chasers | spawn the leader's archetype |
| 4 | `combat.ts` `crown()` | the leader grows to size 1.28 but its hit `radius` stays the same | scale `radius` with `size`, or accept it; matters more for the queen (0.3 → 0.4) |
