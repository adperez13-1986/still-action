# Variety and playstyles: the verifier (round 1)

Lens: what the code allows, what each idea costs, and what it breaks. Read against
`main` at a49442c (the Line merged, dark behind `LINE_ENABLED`). Costs are
vibe-coding evenings. Nothing here is built.

---

## 0. What the code says

These facts decide most of the pitches below, so they come first.

1. **Close range pays nothing, and that is why kiting wins. Targeting isn't the cause.**
   Sustained damage, single target:

   | source | dmg / cooldown | dps | from |
   |---|---|---|---|
   | **auto** | 5 / 0.62 s | **8.1** | 7.6 u, fires while walking away |
   | Piston | 26 / 3.0 s | 8.7 | 3.4 u |
   | Scrap Cleaver | 18 / 2.6 s | 6.9 | 3.1 u |
   | Focusing Lens | 26 / 4.2 s | 6.2 | 13 u |
   | Flare | 18 / 4.2 s | 4.3 | 11 u |

   The free ranged auto out-damages every part but one, and it works best at the
   distance a kiter keeps anyway. A brawler takes the risk and gets no more damage for
   it. Any archetype pitch that leaves this alone only makes new ways to kite.
2. **The names are already there, but the behaviour isn't.** `notebook.assignNames` gives
   each archetype one roster name per level: 7 hulk, 13 sentinel, 6 ram and 7 mite names
   from the old game. A "Glitch Node" behaves exactly like a "Corroded Sentry". The notebook
   promises variety the bodies don't deliver. This is the cheapest lever in the repo.
3. **Every enemy class stands alone and reads module constants** (`CHASER`, `RANGED`,
   `CHARGER`, `LOBBER`; e.g. `readonly windupMs = CHASER.windupMs`). The Lobber is a
   400-line copy, not a subclass. So a variant today means a new class. Making variants
   cheap first takes a mechanical refactor: constants become a per-instance `cfg`.
4. **Elites hold one mod, and stacking two breaks now.** `Pack.elite` is `{ mod }`, and
   `setElite?(mod)` is called once. `updatePacks` sets the armor of every warded member
   *each tick*, leader included (`armor = 1`), so a Plated Warden silently loses Plated.
   The mod is drawn from the level's main `rand` *before the shrines*, so a second draw
   moves every shrine for every seed. That changes resumed layouts and breaks the
   flags-off `__gen` byte-identity check. Any new draw needs its own `SALT` stream, like
   slag and the thief.
5. **Quick hulks already outrun Still:** 4.3 × 1.45 = 6.2 u/s against his 5.5. The game
   already has packs you can't kite, but only as a 1-in-4 elite roll.
6. **Why he's never met the thief** (`THIEF` in `thief.ts`): depth 2 only, rolled at 0.35,
   nesting in the side room *furthest along*, and it moves only when a part has lain
   unguarded for 600 ms. Parts are picked up by walking over them, and a swapped-out part
   lands at his feet (inside `guardR` 1.5). So it has almost nothing to steal. A likely
   run has no thief. When there is one, it sits dormant in a room he may skip.
7. **Where "slot = role" lives in code:**
   - The cast dispatch (`useAbility`'s `switch (def.shape)`) is slot-agnostic.
   - The role lives in these places:
     - `buildModel` **throws** if a part's slot doesn't match (`partmodels.ts:1063`).
     - `PartRuntime` has one `guard`, `anvil`, `decoy` and `anchor`, because each slot
       holds one part.
     - `combat.clearSlot`, `hud.equip`, `still.wear(def.slot)` and the loot
       `TREASURE` weights are all keyed on `def.slot`.
     - `keepWhites` keeps a white per slot. The save's `loadout` and `worn` are slot-ordered.
     - The Workshop wall: each section is **2 × 4 pegs**. Head is 8/8 and legs 8/8, torso
       7/8 and arms 7/8. **A new head or legs part has no peg.**
8. **The area push already exists:** a pushed nova passes `pushed` to every `hitPart`, so
   under the break rule one pushed Vent breaks *every* wind-up in its radius. The
   brawler's push (a pushed arc into a wind-up) needs the break rule too, and **the break
   rule is OFF by default** until his three measured runs.
9. **The rim is already roomy.** The hulk hits inside 2.4 u of its own centre. The
   Cleaver reaches 3.1 + 0.6 pad + the body radius (`inReach`), about 3.7 u against a hulk.
   A brawler can stand on the ring's edge and swing. Nothing tells him so, and nothing
   pays him for it.

---

## 1. The structural question: should slots stay role-locked?

| option | what it means | cost | what breaks |
|---|---|---|---|
| **Any slot, any role** | a lens can go in the legs slot | **big** (6+) | `buildModel` throws; every model is built for one body place; `PartRuntime` singletons collide (two wards means one `guard`); the wall's sections; `TREASURE`; `keepWhites`; the hook's "starts with it on"; every pose and beat in `still.ts`. It also removes the one thing the premium round called premium-grade: **Still wearing what he found, where it belongs.** |
| **Slots are places, not roles** | a slot keeps its body place and model, but can hold an *off-role* part that's plausible there (a headlamp flash up close, a kicked stone from the legs) | **medium** (the first wall relayout, then per part) | nothing in code, since slot typing is unchanged. Only the wall's pegs (head and legs are full). |
| **Cross-slot behaviours** | archetypes come from how parts react to each other and to the auto (Signal Flare's mark and Frayed Cleaver's strain already do this) | cheap to medium | nothing |

**My answer:** keep slot typing exactly as it is. Drop "role-locked" as a *design* rule,
because the code never enforced it. Archetypes come from three things, cheapest first:
**(a)** making close range pay (B0), **(b)** cross-slot behaviours, **(c)** a few off-role
parts later, once the wall is re-laid. Any-slot is the only option that makes things
worse: it costs the most and breaks the most, and it erases Still's body.

**Standing close pays when** it's where the damage is (B0), where the wind-ups are
broken (the break rule), and where the right enemies want you (C).

---

## A. Enemy variety

### A1. The names get their twist (families)
Each roster name the notebook already hands out becomes a *family*: same archetype, same
tell, plus one named behaviour twist and one body feature. Examples:
- *Glitch Node*: the sentinel's line jitters for its tracking 60%, then freezes clean, so
  the freeze is louder.
- *Thermal Scanner*: fires twice down one line, 300 ms apart.
- *Iron Crawler*: the ram doesn't carry past you; it stops dead where you stood.
- *Drifting Frame*: the hulk steps back before it rears, so the ring lands a body-length
  off.

The floating name on first meeting is already built, so the player reads *which* twist
before it bites, and the notebook page becomes true. Two twists per archetype gives about
8 families. Twists must be behaviour, never HP or damage, and body features keep to
`hide.ts` metals: **no new ember**.
- **Why it fits:** D2's families, and the 43 old names finally *mean* something.
- **Cost: medium, about 3 evenings.** 1 for the `cfg` refactor across four classes, then
  about 0.25 per twist.
- **Save:** none. The notebook is keyed by `RosterId` already.
- **Level layout:** untouched. `assignNames` runs on its own stream outside
  `generateLevel`, so the byte-identity check holds.

### A2. The day's roster
Replace depth-fixed casts with a per-area pool in `GenPreset` (`areas.ts`, next to `slag`).
Each run draws 2-3 families per area from it.
- **What he sees:** the notebook at the door opens to today's pages, so the hook and the
  wall can answer them.
- The lesson rooms stay hard-coded: the ram at 2, the brood at 4, the Lobber at 5.
- Derive the draw from the run id (`RunSnapshot.id`), so resume needs **no new save
  field** and no version bump.
- **Cost: cheap, about 1 evening after A1.** It touches `D4`/`D5`/`D7`, which the Line's
  `D5L` tables filter, so it has to be done on `main` with the Line's checks re-run.

### A3. Champions with stacked mods, and named uniques
`Pack.elite.mod` becomes `mods: EliteMod[]`: 1 mod at depths 1-2, 2 at depths 4-5, and a
rare named unique with 3.
- **Mod list, 4 → 8.** The new four are behaviours, and each favours an archetype (see C):
  - **Mantled:** shots and lobs glance off its front; blades, blasts and anything from
    behind get through.
  - **Skittish:** hops 4 u away when something closes inside 3 u, telegraphed by a crouch.
  - **Gathering:** every 5 s it calls its pack to its side, with a visible ripple.
  - **Echoing:** its strike lands again 450 ms later at the same spot, with a second tell.
- **Rule:** at most **one numeric mod** (Quick or Plated) per champion, so stacking can't
  become "stronger".
- **Fixes it needs:**
  - A warded member's armor is written with `min(own, 0.35)`, not overwritten (the
    Plated Warden bug).
  - Mods are drawn from a new `SALT.champion` stream.
  - The nameplate stays one line ("Rustjaw the Quick, Mantled"), with each mod as a glyph
    on the aura.
  - `elitePage` takes the first mod.
- **Named uniques:** a fixed name from the roster's elite pages, fixed mods, and a
  notebook line Adrian writes.
- **Cost: medium, 2 evenings.** Plus one body feature per new mod on the ram, which
  already has four.

### A4. The drop runs *(surprising)*
The thief stops waiting in a far corner. On a level with an elite, it shadows the elite's
pack, sleeping with it. When the leader falls, its **owed drop** (75% blue, 10% gold)
hits the floor and the thief goes for it at once. The first time ever (no `THIEF_PAGE` in
the notebook), this is certain on the first elite of depth 2 or later.
- It takes nothing that wasn't already dropping, so "adds no new loot" holds.
- The part is the one he most wants, so the chase finally matters.
- It stays a rule of the level, so the thief still never leaves.
- **Cost: cheap, about 1 evening.** Nest placement (`dungeon.ts` G8) and a `noticeMs`
  of 0 for the elite drop; `THIEF.depths` widens to 2, 4 and 5.
- **Check:** drops land within `guardR` of a corpse, not of Still, so the thief can
  really take them.

### A5. The cable (a support that works with the pack)
A small new body, the **Linesman**. It never attacks. It clamps a dark cable to one pack
member and slowly mends it (restoring, never above max HP).
- The cable is **physical**, a dark line on the floor, not ember light, because it isn't
  a threat to Still.
- Walking through the cable, or any hit on the Linesman, cuts it for 4 s.
- It gives a reason to move *into* a pack rather than around it.
- **Rules:** weight 0 in `KILL_WEIGHT` terms beyond its own body; no revive (a revive
  breaks "a quiet needs a kill" and farms loot).
- **Cost: medium, about 2 evenings.** A new class on the thief's template, one `HIDES`
  entry, and `EnemyCtx` gains `mates(e)`.
- The same plumbing gives the cheap **screen formation**: sentinels choose their 6-10 u
  band position *behind* the nearest pack hulk (about 0.5 evening more).

---

## B. Playstyles

### B0. The close hand (the foundation for every other B pitch)
When an enemy is inside **2.6 u + pad** with a clear line (the arcs' own `inReach` and
`shaded` test), the auto becomes a **swing** instead of a bolt: 8 damage, a 100° arc, same
0.62 s. That's 12.9 dps single-target and more against a clump, against the bolt's 8.1.
- Against a hulk that's about 3.2 u centre to centre, **outside its 2.4 ring**. The
  brawler's spot is the ring's rim, and it's already drawn on the floor.
- A hulk dies inside one 760 ms recover (two swings plus a Cleaver) instead of three
  cycles.
- It needs no aiming and no magnetism. The stick decides whether he's close.
- One line in `combat.ts`'s auto block plus an arms pose in `still.ts`.
- **Cost: cheap, about 1 evening.**
- **Honest risk:** `AUTO_INTERVAL` "sets the tempo of everything". This changes every
  fight and taints the strain numbers the same way late casts did, so **it goes in after
  his three measured runs.**

### B1. The brawler (close)
- **Has:** Scrap Cleaver, Piston, Frayed Cleaver, Parry Clamp, Anvil, Rusted Hook,
  Backdraft Vent, Brace, Kickstart, Overrun, Skid Plates.
- **Viable with:** B0, plus the break rule switched on (a pushed arc into a hulk's 520 ms
  wind-up reels it at ×1.5).
- **Rewarding because:** the rim is where the damage is, and the Hook and Backdraft bring
  the sentinels that hold 6-10 u into it.
- **The push:** break the wind-up you're standing next to. Overrun's charge closes the gap.
- **Missing:** nothing is essential. A Linesman (A5) and Mantled (A3) give it targets only
  it handles well.

### B2. The marksman (far)
- **Has:** every lens, Through-Line, Overclocked Coil, Skitter, Spring Heels, Plumb Line,
  both wards. It's today's default, so it's already viable.
- **What's missing is target choice.** Auto-aim takes the nearest enemy, and a marksman
  wants the *leader*. **The spotter rule:** head parts (bolt and lob) prefer, in reach, a
  champion leader, then an enemy mid-wind-up, then the nearest. The pushed cast already
  does the middle one (`threat()`).
- **Rewarding because:** the Warden's seal, Skittish and the screen formation (A5) are
  problems only range solves, and Ricochet and lobs finally have something behind cover
  that matters.
- **The push:** Patient Lens's full shot, and breaking a sentinel wind-up at 13 u.
- **Cost: cheap, 0.5 evening.** A `pickTarget` priority for `slot === 'head'`, behind a
  constant. It changes Focusing Lens for everyone, which is reversible.

### B3. The controller (area)
- **Has:** Flare, Signal Flare, all three Vents, Chill, Frost Trail, Skid Plates, Lure.
- **Viable because:** the brood and Gathering champions clump, and Backdraft plus Flare is
  already a combo.
- **The push is its best feature:** one pushed Vent breaks *every* wind-up in 4.3 u (fact
  8). It's the only archetype whose push answers a crowd.
- **Missing:** a lasting cold field from the head. A lob that leaves a Frost-Trail-style
  `Zone` disc would reuse the zone code, but it needs a head peg.
- **Cost:** none for the archetype itself; about 1 evening for the field part plus the
  wall relayout (below).

### B4. The tinkerer: plant a part *(surprising)*
A summoner without companions: Still **plants one of his own parts** and fights without
it.
- **Tripod Lens** (head, blue): plant the lens on its stalk; it fires the auto's bolt at
  the nearest enemy for 6 s. Meanwhile Still's head slot shows the bare frame and the head
  button is dark. A push picks it up and plants it again where he stands (Lure's pattern).
- **What he sees:** an incomplete robot choosing to be *more* incomplete for a moment.
  That's the thesis, played.
- **Code:** the decoy is the template (`PartRuntime.decoy`: position, life, def, pushed).
  `still.wear('head', null)` already draws the frame. Enemies can already be handed a
  non-Still target.
- **Contradiction check:** this is **not** a companion entity, so the Yanah/Yuri rule
  holds. Enemy "rewiring" (making enemies allies) is out: enemy strikes resolve against
  Still or the decoy only, and a friendly-fire path is big.
- **Cost: medium, about 2 evenings.** A new `post` shape, a model variant, and a head peg.

### B5. The masher: wind them up
- **Rivet Flail** (arms, blue): 1.1 s cooldown, 6 damage, short reach. Each hit on the
  same enemy *winds* it: one to three pips over it, in `EnemyStatus`, which already exists
  per enemy.
- A hit **from another slot** on a fully wound enemy **staggers** it: no new wind-up for
  1 s, using the knock-stagger that already exists (`STAGGER_SPEED`).
- So pressing buttons **prevents** wind-ups, while a push **answers** one that has
  started. The two don't compete.
- **Flag:** it must not break a committed wind-up. That would be a strain-free break,
  which the strain round reserved for pushes and a narrowed Parry Clamp.
- **The push:** push the finisher when a wind-up has already begun.
- **Cost: medium, about 1.5 evenings** plus an arms peg (torso and arms have one free each).

---

## C. Where A and B meet

| the roster brings | it favours | why, in code |
|---|---|---|
| **Mantled** champion (A3) | brawler, controller | bolts and lobs glance off its front; arcs and novas don't |
| **Skittish** champion (A3) | marksman | it won't let you close; the spotter rule finds it |
| **Gathering** champion (A3) | controller | it makes its own clump for one pushed Vent |
| **Screen formation** (A5) | marksman with Ricochet or lobs, or a brawler who dives | the sentinel stands behind a hulk, where the auto's `clearShot` fails |
| **Linesman** (A5) | brawler, dasher | the cable is cut by walking through it |
| **Quick** packs (already exist) | brawler, controller with Chill | 6.2 u/s, so they can't be kited (fact 5) |
| **Warden** (already exists) | marksman | the sealed pack falls when the leader does, and only range reaches it first |

**The day's roster (A2) is what makes this a choice.** The notebook at the door shows
today's families before the run. Turning parts to the wall (already built, `toggleTurn`)
then *is* archetype steering: face the close parts out, and the drops lean close. To
support it, show each part's archetype tag (data only, derived, no save) on its wall
plaque and pickup card.

---

## What breaks, and what doesn't

| thing | A1 families | A3 stacking | A4 thief | B0 close hand | new parts (B3-B5) | any slot, any role |
|---|---|---|---|---|---|---|
| **the 30 parts** | – | – | – | Cleaver and Piston relatively weaker, since the swing covers the same ground; re-read after play | – | all rebuilt |
| **save** (`still-action.save` v3) | none | none | none | none | none: `found` is filtered by `KNOWN`, and new ids arrive unfound | slot-ordered `loadout`/`worn` lose meaning; v4 |
| **the wall of parts** | – | – | – | – | **head and legs are full**: one relayout, e.g. golds to a shelf by the hook, freeing 2 pegs per section | redesigned |
| **Still wearing his parts** | – | – | – | a new arms pose | a model each | `buildModel` throws |
| **`__gen` byte-identity** | holds | holds only on a new `SALT` | holds on the G8 stream | holds | holds | holds |
| **readability caps** (`BOOK_GAP`, 3 windup voices, `SHOOTERS_MAX`) | the Scanner's double shot books 2 locks | Echoing books its echo | – | – | – | – |
| **perf** (about 300 draw calls at depth 7) | +1 material per family | +1 mesh per mod | – | – | – | – |

## Contradictions with settled design

- **Revive supports** break "a quiet needs a kill" and farm drops. Mend, never revive
  (A5).
- **Combo damage multipliers** ("the finisher hits ×2") sit next to the cut "last push
  ×2" and "reach ×1.5 pushed". Combo payoffs must be behaviours: stagger, never numbers
  (B5).
- **Summoned allies** can't be family, and enemy rewiring needs a friendly-fire path
  (big). Plant your own parts instead (B4).
- **Stacking Quick and Plated** is "stronger" by another name. Cap it at one numeric mod
  (A3).
- **The thief carrying a part from the start** would add loot. A4 moves the elite's owed
  drop instead. The runaway thief stays parked.
- **A faster-than-Still enemy family** doesn't break the telegraph rule (every strike still
  commits), but it does end "kiting should work but not trivially" for that family. That's
  intended; Quick already does it.

---

## Recommended bundle

**"Make close pay, make names true, make the thief run."** About 7-8 evenings, in this
order. Nothing touches the save schema, the wall or Still's models.

| # | what | evenings | why now |
|---|---|---|---|
| 0 | *his three measured runs, then his break-rule call* | – | B0 changes the auto; measure before it moves |
| 1 | **A4 the drop runs** | 1 | he meets the thief in his next run; independent of everything |
| 2 | **B0 the close hand** + the break rule on | 1 | the one change that makes a second archetype exist |
| 3 | **B2 the spotter rule** | 0.5 | gives range a job the close hand doesn't take |
| 4 | **A1 families**: the `cfg` refactor + 8 twists | 3 | the variety he asked for, reusing the names he already sees |
| 5 | **A3 stacking** on a new `SALT`, with the Plated/Warden fix; Mantled, Skittish and Gathering first | 2 | gives each archetype a champion that asks for it (C) |
| 6 | archetype tags on wall plaques and pickup cards | 0.5 | makes turning parts to the wall the steering wheel |

**Later, and why:**
- A2's roster draw, after A1 has families to draw from.
- A5 the Linesman, after Line stage B1 (the Signalman is the first support on the books,
  and it should set the pattern).
- B3-B5's new parts, after one wall relayout.
- Any-slot-any-role: **never**.
