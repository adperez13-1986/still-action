# Variety, round 2: the balancer

Read against all four round-1 files. Assumptions as in round 1: 250 ms to react, a push
lands 430 ms after the tell. Numbers are from the code or from the round-1 scripts.

## (a) The close auto: one rule

| version | DPS close | reach on a hulk | cost | verdict |
|---|---|---|---|---|
| Claude: the auto follows the arms part | varies | varies | medium | cut: 7 extra auto designs, and an arms part becomes two abilities |
| translator: 5 dmg jab every 0.31 s within 3.2 u | 16.1 | 3.2 | cheap | merge |
| verifier: 8 dmg, 100° swing, 0.62 s within 2.6 + pad | 12.9 | ~3.2 | cheap | merge |
| mine: 10 dmg within 3.5 u, plus the "eye" | 16.1 | 3.5 | cheap | merge; the eye is cut |

**The rule, "the hand":** when the nearest awake target passes the arcs' own `inReach`
test at range **2.9** and the `shaded` test, the auto becomes a clamp strike. It hits for
**10, every 0.62 s, one target**, and fires while moving. Beyond that, today's bolt.
- **Reach:** 2.9 u in `inReach` terms is 3.5 u to a hulk's centre. That leaves a
  **1.1 u safe band** outside the slam's 2.4 u (about 18 px at zoom 0.7, the translator's
  scale). The translator's 3.2 u leaves 0.8 u (13 px), Parry Clamp's thin band.
- **Cadence:** kept at 0.62 s, not 0.31. `AUTO_INTERVAL` "sets the tempo of everything".
  Halving it doubles the hit events, the hitstop and the hurt-window checks, for the same
  DPS.
- **Single target:** the Cleaver's 120° stays distinct. Against mites a 100° arc averages
  about 1.1 targets on the inner ring (4 mites at 90° spacing), so an arc buys almost
  nothing.
- **Result:** close kit 33.1 DPS against 15.8 when kiting (2.1×). A close break under the
  hand is 38 damage in the reel against a hulk's 30 HP, so it's a kill.
- **Timing:** it goes in after his three measured runs (the verifier is right).
- **Marksman:** instead of my eye, the verifier's **spotter** (head parts prefer a
  leader, then a winding-up enemy, then the nearest). It's cheaper, and it doesn't change
  the auto a second time while we measure the first change.
- **The translator's rim circle** ships with the hand: the band only pays if it can be seen.

## (b) Set-style leanings: no

With 5 leanings and 4 slots, 2+ matching happens in 1 − (5·4·3·2)/5⁴ = **81%** of random
loadouts. So it isn't a choice, it's a passive that's always on. And the compare screen
turns into "does this keep my set?": you pick by tag, not by behaviour, which is a stat by
the back door. Claude's Brawler behaviour ("shortens your other cooldowns a little") is a
number. Once the hand exists, close already pays, and the spotter gives range a job.
**Tags only** (the translator's glyph on the card, the verifier's plaque tag). Revisit if a
playtest shows builds can't be named by the Assembler.

## (c) New parts: relay the wall, then Winch, Spare Lens, Flywheel

The wall: head 8/8, legs 8/8, torso 7/8, arms 7/8. The verifier's relayout (golds move to
a shelf by the hook) frees 2 pegs in each section, about 0.5 evening. After it:

| # | part | slot | why first (numbers) |
|---|---|---|---|
| 1 | **Winch** (bends Kickstart) | legs | the brawler's one real hole. On foot a sentinel costs 1.4 s of closing (2.1 u/s from 6 u to 3.5 u) and 1-2 shots. The chain covers 9 u in about 0.3 s. It also catches the thief. Cooldown 7 s. |
| 2 | **Spare Lens** (= Loose / Tripod Lens) | head | the only summoner that auto-aim suits. 8 per 1.0 s at 9 u for 8 s = 64 damage, against about 50 from the Lens over the same time: it pays only if placed well. The head button goes dark; the auto keeps firing (it's Still's body, and the hand depends on it). |
| 3 | **Flywheel** (bends Pressure Vent) | torso | caster and masher link. It uses the torso's free peg and has no input risk. |

Cut or held: **Grindstone** (the hand already rewards staying close: 33 → 40 DPS is
redundant); **Rattle Clamp**, **Stutter Step** and flurry (strings against his 0.5 s median
press: first log whether he can complete three taps inside 0.7 s gaps); **drone** and
**turret** (the drone duplicates Spare Lens, and so does the turret).

## (d) The thief: I switch to the elite's drop

My version (it spawns carrying the side room's drop) was payout-neutral, but it steals a
part he's never looked at. The translator's point wins: losing something you didn't want
isn't a meeting. The elite's drop is 75% blue and 10% gold, and it lands mid-fight, so it's
the one moment worth chasing. What I keep from mine is the rate:

| | today | elite-drop version |
|---|---|---|
| depths | 2 | **1, 2, 4, 5**, at 0.35 each (only on levels with an elite, which is all of them) |
| acts once present | ~0.5 | ~0.95 (noticeMs 0 on the elite drop) |
| P(meet at least one a run) | ~10% | **~76%**, and 100% the first time (a save flag) |

- **Check:** the thief can't take a part within 1.5 u of Still. The hand's band is
  2.4-3.5 u, so a brawler's kill still usually leaves the drop takeable. Measure it.
- **Barrel nest:** yes (the translator's), cheap.
- **Worn parts:** make the elite's drop the part it wore (e). The thief then runs off
  with the exact part you fought it for.

## (e) Stacked mods and worn parts

- **Fix first:** both of the verifier's bugs block any stacking.
  - A warded member's armor is written as `min(own, 0.35)`, not overwritten, or Plated
    Wardens lose Plated.
  - Mods are drawn from a new `SALT.champion` stream, or every shrine moves and `__gen`
    stops being byte-identical.
- **Rules:**
  - At most **one numeric mod** (Quick or Plated) per champion.
  - 1 mod at depths 1-2, 2 at depths 4-5, 3 on the one named unique per area.
- **The list, 10:** Quick, Plated, Many, Warden (built); Echoing (all three voices had
  it); Grounded (the translator's); Skittish and Gathering (the verifier's); and **worn
  Mirror Ward** and **worn Anvil** (mine; the same as the translator's Mirrored, with the
  model on its back).
- **Cut or moved:**
  - Mantled moves to the **Bulwark family** (a slab is a body, not a mod).
  - Molten/Kindled: area II's slag cores already do it.
  - Worn Backdraft: it moves Still for him.
  - Worn Chill: Quick already outruns him.
  - Tethered: later.
- **Legal pairs:** a hulk about 40, a sentinel 20, a mite brood-mother 6 (Quick, Warden,
  Echoing, Gathering). Against today: 13 single-mod elite types, all seen by run 6.
- **Worn-part rule:** it drops the part it wears. The part is drawn from the *found* pool,
  and from unfound only at `POOL_RULES.unfound.elite`, so the wall doesn't fill faster than
  it does today. A turned part is never worn.

## Where I changed my mind

1. **The eye** goes. The spotter does the marksman's real job (choosing a target) for half
   the cost and without a second change to the auto.
2. **The close-break refund** (+1 strain instead of +2) goes. The hand already makes a close
   break a kill, and a strain price change lands just while the half-floor rule is
   unmeasured.
3. **The Echo Shell's revive** becomes the verifier's **Linesman mend**. A revive farms
   drops. Mend 4 HP/s on one member, and walking through the cable cuts it for 4 s. A kiter
   takes about +33% on a 96 HP pack (6.1 s → 8.1 s); a brawler cuts the cable and loses
   nothing.
4. **The thief** goes for the elite's drop (d).
5. **Grindstone** is cut (c).

## Final bundle

| # | step | evenings |
|---|---|---|
| 0 | his three measured runs, then his call on the break switch | - |
| 1 | the thief: elite drop, barrel nest, depths 1/2/4/5 at 0.35, certain the first time | 1 |
| 2 | **the hand** (10 / 0.62 s, reach 2.9 in `inReach`) + rim circle + head-part spotter | 1.5 |
| 3 | stacking: the two fixes, 1/2/3 mods, one-numeric cap; Echoing, Grounded, Skittish, Gathering | 2 |
| 4 | families: the `cfg` refactor, then Iron Crawler (lane slam), Bulwark, Thermal Scanner, Furnace Tick | 3 |
| 5 | area rosters from a pool, shown at the door and on the depth banner | 1 |
| 6 | wall relayout, then Winch, Spare Lens, Flywheel | 3.5 |
| 7 | worn Mirror Ward and worn Anvil, dropping what they wear | 1.5 |
| 8 | the Linesman; archetype tags on cards and plaques | 2.5 |

Held: the eye, the refund, the Siphon, Grindstone, set leanings, strings, drone and
turret, ram variants (Drifting Frame undoes the ram's wall lesson, so area II only).
Measure after step 2: the share of autos landed as the hand, and fight length by build.
