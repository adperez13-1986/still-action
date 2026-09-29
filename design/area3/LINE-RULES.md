# The Line's rules after pressure and counters

29 Sep 2026. The mechanics & UX pass. `SPEC.md` (25 Sep) was written before pressure bodies, the
two autos, the break rule and the counters. `BOTH-ROADS.md` §2 lists where it conflicts with them.
This doc gives the rules that fix those conflicts. It proposes and settles nothing: every rule
here waits for his OK. Words marked PLACEHOLDER are his to write.

Code read: `combat.ts` (`breakable` 1168, `committed` 1533, `stepOff` 1548, Parry 2008,
`eyeRank` 2319, `lungeFree` 487, `BOOK_GAP` 173), `enemy.ts` (`PRESSURE_HULK`, `COUNTER_HULK`,
the crouch start at 614), `ranged.ts`, `swarm.ts` (`nips`, where the pressure brood never reads
`nearLit`), `line.ts` (`LINE`), `dungeon.ts` (`layLine` 1110/1128, lessons 1405-1460,
`SLEEPERS_CHANCE` 916), `curve.ts`, and `abilities.ts` (Parry Clamp 307).

## The rules at a glance

| id | rule | scope |
|---|---|---|
| **R1** | A Line body's windup is a *place tell*: the autos never break it. Only a push, a part or a kill does. This covers the Signalman's call and the Handcar's tracking. | Line |
| **R2** | The Signalman never calls a lane it's standing in, grown by 1 u. | Line |
| **R3** | Parry Clamp catches **any tell** in its cone. That includes a pressure body's cock, lens glow and rear, which nothing else can break. Its snap aims at the tell. | **whole game** |
| **R4** | Commitment is a telegraph. A pressure body steps off lit rails at any time, except while it slides, is held, or is in a counter's crouch, lunge or the lunge's recover. Telegraphed bodies stay committed from windup to recover, as built. | Line |
| **R5** | A hulk doesn't start a crouch while it's inside a lit strip. | Line |
| **R6** | A train hits a body for `LINE.damage × curveAt(d).hp`, and hits Still for a flat 20. | Line |
| **R7** | Sleepers are never the elite pack. The brood-on-lit-rail rule stays for a queen's brood only. | Line |
| **R8** | The counter's crouch books its lunge (`canLock` / `book` at `crouchMs`). | **whole game** |
| **R9** | The Line's lessons key on `stepOf(depth) === 4`. The swarm lesson stays on the run's depth 4. | Line |
| **R10** | The Signalman's lesson pack calls once on waking. That first call skips `laneReach` and `signalQuietS`. | Line |
| **R11** | On a Line-first run, no Sleepers at step 4. Chance 0.4 at step 5, unchanged. | Line |

---

## 1. The Signalman's call

**Confirmed, with one addition (R1, R2).** The autos never break the call. A push, a part or
killing it does.

- **Why not the autos.** It's a variant, so it isn't a pressure body (combat.ts:2678). As built,
  `breakable(e, true)` is true in its windup, and `eyeRank` then puts a breakable windup first
  (rank 3). So every planted shot at 7-11 u would hit the call first and cancel it. The Line's own
  lesson would never play.
- **The code change.** In `breakable`, return false for `e.variant === 'signal' && auto`, using the
  same pattern as the crouch. `eyeRank` needs no change. It's `kind: 'ranged'`, so the planted shot
  still ranks it 1 ("what shoots") and aims at it for damage.
- **Why R2.** The Signalman commits from its windup to the end of its recover (760 ms). If it stood
  on the lane it called, its own train would kill it. That's funny once, then it reads as a bug.

**On the phone.** You're fighting two hulks near a lane. A thin post 9 u away raises its arm, its
lamp swells, and a ratchet clicks six times over 0.9 s. You have three answers:
- push a part that reaches it (its button shows the break hint);
- kill it (20 HP, about 3 planted shots, so usually too slow unless it's already hurt);
- walk off the lane and let the train come. The rails light 0.9 s after the call and the rake
  arrives 2.0 s after that, so you get about 2.9 s of warning.

Close builds answer the Line by moving. Marksman builds answer it by pushing. Both are fine, and
neither answer is free.

**Numbers.** Keep SPEC §6.1: windup 900, reload 7000, interrupted 3000, recover 760, callRange 14,
laneReach 3.7, signalQuietS 4. R2's pad is 1.0 u past `halfW + radius`.

**Does it give Parry Clamp its new job? No, not on its own.**
- **Range.** The Signalman keeps 7-11 u away and Parry reaches 2.6. Closing 4.4-8.4 u at 5.5 u/s
  takes 0.8-1.5 s, and the call takes 0.9 s. Parry would almost never catch one.
- **Rarity.** Signalmen live on 2 of 9 depths, in at most 2 packs a level. A job that only exists
  there makes Parry a dead slot on the other 7.

**Parry Clamp's job instead (R3): it catches the beat.** Its snap breaks any tell in its cone at
the moment of the cast:
- a windup, as today (heavies, rams tracking, the crouch, and the call if it's in reach);
- **a pressure body's own tell**, which today nothing may break:
  - the hulk's 180 ms cock;
  - the sentinel's 260 ms lens glow;
  - the mite's 120 ms rear.

When a tell is caught:
- the attack is spent (no jab, burst or nip);
- the body is thrown back 2.5 u (the existing `shove`);
- its own clock restarts: the hulk waits 550 ms (its recover) before cocking again, the sentinel
  reloads for 1300 ms, and the mite's `rest` is a full cycle;
- pushed, it also reels.

Unpushed, the snap aims at the body in a tell that lands soonest (as the pushed aim already does
for windups). Tap it and it turns to the cocking hulk. Parry becomes the timing part: the one
break that costs no strain, and the only thing that catches a jab. The damage (10), cooldown
(3600), cone (90°), range (2.6) and mark-pay all stay the same.

**Balance check (estimates to verify, not measured):**
- **Not always-take.** Parry does 10 per 3.6 s, the lowest arm damage. Frayed Cleaver does 16 per
  2.6 s in a wider cone, about 2.2x the rate. Anvil catches the next blow and hits back for 30. A
  catch saves one 5-damage jab (7.5 at depths 4-5) and buys space.
- **How often it catches.** A random tap into n hulks in contact, each cocking about 22% of the
  time, catches at least one tell 1 − 0.78ⁿ of the time: 22% / 39% / 53% for n = 1 / 2 / 3. A timed
  tap catches more.
- **Not a dead slot.** Pressure bodies are on every crawl depth of both roads. It's still weak
  against bosses and Lobbers, as it is today.
- **Overlap with Anvil.** Anvil takes the blow and pays it back. Parry stops the blow before it
  lands and moves the body. It's close, and a flag for him.
- **Headless.** A bot that taps Parry when ready, against 3 pressure hulks, then the same bot
  with Frayed Cleaver:
  - target: 0.8-2.0 catches per pack fight;
  - target: 15-30% less HP lost and 20-40% longer to clear than Cleaver;
  - too strong: it clears faster **and** loses less HP;
  - dead: under 0.3 catches per fight on any road.

**Card line: PLACEHOLDER.** Today's line ("Catch an enemy winding up...") would be wrong.

## 2. Trains vs pressure bodies

**The problem, measured from the code.** A pressure hulk in contact runs cock (180 ms, phase
`approach`), then strike (90 ms), then recover (550 ms). So it's "committed" for 640 of every
820 ms, about 78% of the time. It can only step off in the 180 ms gaps, at 4.5 u/s, which is about
0.8 u per gap. Leaving the strip takes about 2.0 u. Most hulks fighting on a lane are still there
when the rake arrives, and the train kills them without Still doing anything. That's SPEC risk 1.

**R4: commitment is a telegraph.** A body stays on a lit rail only while it's doing something it
telegraphed, or while it's being moved: the same things that pin Still (a shove sliding him, a
lunge's shove).

| body | committed (the train can catch it) |
|---|---|
| pressure hulk, sentinel, mite | sliding (knock > 1.5 u/s), held or thrown, or in a counter's crouch, lunge or 900 ms after-lunge recover. **Never by phase.** Its cock or nip keeps timing while it steps. |
| crowned leader, ram, Lobber, Signalman | windup through recover, as built. This is the bait. |
| Handcar | never on a lane (sidings never carry trains) |
| boss, thief | always, as built |

The change goes in `Combat.committed`. For `e.pressure`, skip the phase test unless
`crouching || lunging || spent`.

**R5.** A hulk inside a lit strip doesn't start a crouch. A lunge that carries it onto one is
still fair (BOTH-ROADS §2).

**Symmetry.** Still and the bodies see the same rails 2.0 s ahead:
- Still leaves at 5.5 u/s, which takes about 0.2 s from the centre;
- a pressure body leaves at 4.5 u/s, which takes about 0.45 s to clear 2.0 u.

Both can be pinned by a shove. Only a telegraphed body (or a counter-move) plants its feet.

**What's left for Still to earn.** He kills with the train by timing a shove. The knock stays
above 1.5 u/s for:
- 0.12 s after the close strike's 0.5 u;
- 0.14 s after the planted shot's 0.6 u;
- 0.30 s after Parry's 2.5 u;
- the whole throw with Clamp Toss.

A body shoved into the strip centre then needs about 0.45 s to walk out, so the kill window is
roughly the last 0.6-0.75 s before arrival. The horn at +800 (1.2 s before arrival) is the cue.
Baiting a heavy's windup or a ram's rush across a lane is the big version.

**On the phone.** You're in a crowd of three hulks, on a lane. The rails glow and the hum rises.
The hulks drift off the rails sideways, still jabbing at you. You step off too, and there's half a
beat of air. Or you wait for the horn, strike the nearest hulk back onto the rails, and the rake
takes it. That kill is yours. The free one is gone.

**Numbers to start from.** `LINE.stepOff.speed` 4.5 and `pad` 0.3, both unchanged. The first dial,
if baiting feels impossible, is a pressure-only step speed of 3.0, which widens the kill window to
about 1.0 s.

**Headless check (K-T13, new).** 40 seeds each at step 4 and step 7, lane rooms only. Kills are
split by source; a **free** train kill is one on a body Still hasn't shoved, held or thrown in the
previous 1.0 s, that isn't in a counter-move and isn't telegraphed.

| bot | measures | ok | broken |
|---|---|---|---|
| A: fights with the autos on the lane, never dodges | train share of all kills; free share | total ≤ 25%, free ≤ 5% | total > 35% ("trains do the fight"), or free > 10% |
| A | trains that kill ≥ 2 bodies in one pass | ≤ 1 in 10 | > 2 in 10 |
| B: steps to the edge when the rails light | train hits on Still per lane room | 0 | > 0 (the escape doesn't work) |
| C: shoves the nearest body toward the lane after the horn | earned train share | 15-40% | < 10% (trains are scenery: use the 3.0 dial) |

Also rewrite K-T5: no pressure body stays uncommitted inside a lit strip for more than 0.6 s.

## 3. Sleepers

**The brood-on-lit-rail rule doesn't touch them.**
- It gates a *surge's* start (`nearLit` in the surge path, swarm.ts:1072). Pressure broods run
  `nips()` and never read it.
- Sleepers are never placed in lane rooms anyway: lanes and sidings never share a room (K-E7), and
  the nest sits 2.5 u off a wagon or empty siding.

**Rules:**
- **R7.** Keep the brood rule for a queen's brood, the one brood that still surges. Also: Sleepers
  are never the elite pack. Their template leads with M6, so they could be crowned today, and a
  surge ring coming out of gravel would be two new reads in one moment. Drop them from
  `mainPacks` when picking elites.
- Pressure mites follow R4 (never committed by phase), so the "a train kills at most 4 mites" INV
  holds with room to spare.

**On the phone.** A patch of gravel shivers every 2-3 s with no ember. You step within 8 u and six
mites rise one by one over 1 s and scatter to nip you. They're a crowd, like any brood. It's an
ambush, not a new mechanic.

**Numbers.** `BALLAST` unchanged. Chance: see R11 in §5.

## 4. The Handcar

**No conflict with the counters or pressure.** It's a ram, it keeps its telegraph (the chevroned
lane with the star at the buffer), and counters are for pressure hulks and sentinels only. Two
real conflicts, though:

1. **The planted shot would neuter it (R1).**
   - Its 495 ms tracking phase is `breakable(e, true)`, and `eyeRank` puts that first.
   - A Still planted on the siding always has sight down the straight rails, within the planted
     shot's 11 u, so about half of all rushes would break for free.
   - The lesson would become "stand planted on its rails", which is backwards.
   - Under R1 it's a place tell: a push, a part or a kill breaks it.
   - A plain ram stays breakable by the autos. It chases, and its break is the planted shot's
     trigger. The Handcar doesn't chase: its only threat is where you stand.
2. **The lunge isn't booked (R8).**
   - `lungeFree` keeps it to one hulk at a time, but the crouch never calls `canLock`. So a lunge
     can land within 300 ms (`BOOK_GAP`) of the Handcar's lock, or of a train's commit or arrival.
   - The Handcar rooms hold hulks (`['H','K']` as the lesson, `['H','H','K']` at step 5), and K-T7
     assumes every committed moment is booked.
   - Fix: start the crouch only if `canLock(crouchMs)`, then book it.
   - This fixes every level, not just the Line.

**On the phone.** A cart sits at one end of rusted rails with buffers at both ends. You step onto
its rails while a hulk jabs you, the pump clanks, and a chevroned lane runs from the cart to a
star at the far buffer. It locks and latches. You step off (you have about 396 ms of slack), the
cart slams into the buffer and stalls, and its hatch is open for 1.2 s at ×1.5 damage. The hulk
never lunges on the same beat.

**Numbers.** SPEC §6.2 unchanged. `BOOK_GAP` 0.3 s.

## 5. The second road

**R9.** Every Line rule that was `depth === 4` or `5` reads `stepOf(depth)`:
- the lesson lane (1128);
- `holds` (1110);
- the Handcar and Signalman lessons (1419-1421);
- `SLEEPERS_CHANCE`;
- the Line's pack rows.

Only the curve reads the real depth. The swarm lesson stays on the run's depth 4.

What the Line's lessons assume, by order:

| the Line at 4 (Line first) | the Line at 7 (Works first) |
|---|---|
| **Everything is new at once:** trains, the Signalman, the Handcar, mites (the swarm lesson lands here), maybe Sleepers. That's 4-5 new reads on one level. → **R11:** no Sleepers at step 4 on this order. | **He's seen:** mites, and a brood asleep under a mound (the Works' heap at 4), so Sleepers is a known trick in new gravel. He's seen ember floor strips (slag, Lobber rings) and ram lanes, so the rails read faster. Counters and pressure are the same on both roads. |
| **Afternoon light:** the rail tell's coming phase (0.35 rails, 0.12 wash) has the least contrast. Check it on the phone. | **Dusk:** the rails read better, and the Sleepers' shiver on the dark floor reads worse. Check it on the phone. |
| **Cheap strain:** a push to break a call costs little here. | **Strain is high** (the quiet floor ratchets), so every push to break a call is dearer. Movement is the better answer. Watch Stopped by order in stage T. |
| **Ordinary HP ×1.1-1.3.** | **HP ×(the new 7-9 rows):** a flat 20 kills less. Already at 4, a sentinel has 22 HP, so "one pass kills anything that shoots" is false today. → **R6.** |
| **A light build:** lesson packs are a real fight. | **A strong build:** it can kill the Signalman's lesson pack before it ever calls. → **R10.** |

- **R6.** Train on a body: `20 × curveAt(d).hp`. A pass then kills what shoots (sentinels, mites,
  Lobbers) and leaves a hulk standing, on both roads, as a fact learned once. Still takes a flat
  20, because a place's hit doesn't grow with the depth curve. He learns what a train does to him
  once, too.
- **R10.** In its lesson room (`lesson: true`), the Signalman calls once on waking. The trigger is
  Still within callRange; it skips `laneReach` and `signalQuietS`, and the reload is 0. It's a
  real train. The first harmless train already taught the tell, so this teaches the *call*. The
  rule is the same at 4 and at 7, so no build can skip it.
- **The first harmless train** (lesson lane, no pack) and **the Handcar lesson** (`['H','K']`)
  work at 7 unchanged. They're lessons in reading, not fights, and at 7 they're a breather. Keep
  them.
- **More parts and masteries at 7:** R1 means no mastery or auto skips the call or the Handcar.
  R3 gets stronger with more hulks, which suits a late depth.

## 6. Open for the phone

1. Can a thin post 7-11 u away be seen raising its arm in a crowd at phone size, or is the ratchet
   doing all the work?
2. R3: are the 120-260 ms pressure tells catchable by eye, or is Parry a lucky tap? If lucky, the
   dial is a 150 ms grace after the tell ends.
3. R4: do the hulks drifting off the rails read as "they saw it too", or as the hulks being dumb?
4. The rail tell's coming phase in afternoon light (Line at 4).
5. Sleepers' shiver at dusk (Line at 7).
