# Variety, round 1: the balancer

Lens: systems and math. Numbers come from the code (`src/abilities.ts`, `src/combat.ts`,
`src/enemy.ts`, `src/ranged.ts`, `src/charger.ts`, `src/swarm.ts`, `src/lobber.ts`,
`src/thief.ts`, `src/dungeon.ts`, `src/loot.ts`), from `playtest.json` (7 runs, 130 fights,
636 casts), and from three small scripts: DPS by band, roster combinatorics, and thief
encounter odds. Where a number is a model and not a measurement, the table says so.
Two assumptions run through everything: 250 ms to react to a tell, and a push landing
430 ms after the tell (reaction plus the 180 ms hold), as in the strain round.

---

## 0. Why kiting wins, in numbers

### 0.1 Damage by range (starting kit, one target, every part cast on cooldown)

| where Still stands | what reaches | DPS | share of max |
|---|---|---|---|
| 7.6-13 u | Focusing Lens (26 / 4.2 s) | 6.2 | 25% |
| 4.3-7.6 u | + auto (5 / 0.62 s = 8.1) + Kickstart (1.5) | 15.8 | 63% |
| 3.7-4.3 u | + Pressure Vent (2.3) | 18.1 | 72% |
| ≤ 3.7 u | + Scrap Cleaver (6.9) | 25.0 | 100% |

Standing close is worth 1.6× the damage of kiting at 5 u. That looks like a reason to
stand close. It isn't one, for five reasons:

1. **Moving costs no damage.** The auto and every cast fire while Still walks. The only
   cast that roots him is Spring Heels' 300 ms landing. So the 15.8 DPS band has no price.
2. **Close damage is an instant, not a place.** The 9.2 DPS that needs ≤ 4.3 u (Cleaver
   and Vent) only needs Still there at the moment of the cast: about 2 instants every
   2.6 s. "Dip in when the Cleaver is up, dip out" gets all of it. That's kiting with a
   melee button, and it's exactly what the playtest shows.
3. **The auto is the biggest single source, and it lives at 7.6 u.** 8.1 DPS is 51% of
   the mid-band total, and it reaches 3× further than the hulk's strike (2.4 u).
4. **Stepping answers every threat, with room to spare.** Slack = the time from the
   tell to the hit, minus 250 ms of reaction, minus the time needed to walk clear at 5.5 u/s:

   | threat | tell to hit | walk to clear | slack |
   |---|---|---|---|
   | hulk slam (starts at 2.0 u, hits ≤ 2.4 u) | 520 ms | 0.4 u, 73 ms | **197 ms** |
   | mite bite ring (r 1.0) | 550 ms | 1.0 u, 182 ms | **118 ms** |
   | ram, after the lock, from 3.5 u | 599 ms | 1.12 u, 204 ms | **145 ms** |
   | sentinel shot from 8 u (freeze + flight) | 837 ms | 0.72 u, 131 ms | **456 ms** |
   | Lobber shell (windup + flight) | 1620 ms | 2.0 u, 367 ms | **1002 ms** |

   Every number is positive. That's correct by design (the telegraph rule), but together
   with reason 1 it means moving is always free and always enough.
5. **Time has no price.** There's no fight clock, no enemy that grows while it lives, and
   the quiet always comes. HP comes back half per quiet and full per level. So killing
   faster buys nothing except fewer windups to dodge, and a kiter already dodges almost
   all of them. **DPS isn't a currency in this game. Exposure is, and kiting's exposure
   is about zero.**

The playtest agrees: head 323 casts (51%), arms 157 (25%), torso 81 (13%), legs 75 (12%).
Patient Lens's 1.5 s cooldown inflates the head count, but the order holds.

**What follows from this:** a close style can't be bought with more damage alone. It has
to be paid in something the game already prices: **strain** (the push), **HP exposure over
time** (enemies that make a long fight cost something), and **sustained close presence**
(a damage source that needs you to *stay* near, not just visit). Each archetype below is
priced in one of those.

### 0.2 Where a push can break a windup

The margin is windup, minus 430 ms, minus flight time. Positive means a push from that
slot can land a break. A bolt flies at 26 u/s, a lob takes 800 ms, and a dash 280 ms.

| windup | typical range | arc | nova | bolt | dash | lob |
|---|---|---|---|---|---|---|
| hulk 520 | 2.0 u | **+90** | **+90** | +13 | −190 | −710 |
| mite surge 550 | 1.8 u | **+120** | **+120** | +50 | −160 | −680 |
| Lobber 620 | 9 u | out of reach | out of reach | −156 (+13 inside 4.6 u) | out of reach | −610 |
| sentinel 760 | 7 u | out of reach | out of reach | **+60** | +50 | −470 |
| ram 900 | 5 u | out of reach | out of reach | **+277** | +190 | −330 |

**Three of the five windups can only be broken from within about 4 u.** With the break
switch on, close range is already where pushes land. Nothing tells the player that, and
nothing rewards it beyond the reel. It's the brawler's natural currency (B1). Also: a lob
can break nothing. Flare and Signal Flare need a different push (see Open, Q5).

**A close break is a kill.** The reel is the hulk's 760 ms recover at ×1.5. At close-kit
DPS (33 under B0) that's 38 damage against 30 HP. At the kiter's 15.8 it's 18, a stagger.

---

## A. Enemy variety

Today a run meets 5 bodies (hulk, sentinel, ram, mites, Lobber) and at most 13 elite
types (4 mods × the kinds that may carry them, one mod each). Seven elites a run
(1, 1, 2, 3 at depths 1, 2, 4, 5) see all 13 in a median of **6 runs** (p90 9). After
that there's nothing new to meet. D2's answer had four parts: an area roster drawn from a
larger pool, families (the same behaviour renamed, with one twist), champions and
uniques with *stacked* mods, and roles that work together. Translated:

### A1. Families: one twist per variant (cheap to medium)

Each archetype gets 2-3 variants. A variant is the same state machine with one changed
behaviour, a palette from `hide.ts`, and one mesh piece. The names come from the old
deckbuilder, so the notebook fills. The player sees a hulk and learns to ask "which hulk?"
The Crawler's slam is a cone, so the safe spot is its side, not the step back.

| archetype | variant | the one twist | who it asks for | cost |
|---|---|---|---|---|
| hulk | Rust Guard | today's ring slam (r 2.4, 520 ms) | anyone | built |
| hulk | **Iron Crawler** | low body; the slam is a 150° cone reaching 3.4 u *in front*, 620 ms | flanking, range: its reach covers the close band | cheap |
| hulk | **Static Frame** | slams twice: r 2.4, then r 3.6 450 ms later from the same spot | step out and stay out, or break the first with a push (it cancels both) | cheap |
| sentinel | Corroded Sentry | today's | anyone | built |
| sentinel | **Hollow Repeater** | the frozen line fires 3 shots 200 ms apart, 4 each | Ward/Mirror Ward; a moving target is fine | cheap |
| sentinel | Lobber | built | | built |
| ram | Ram | today's | walls | built |
| ram | **Raging Hull** | its lane bends once, 30°, toward Still at the midpoint; the kink is drawn at the lock | walls still stun it; a late side-step is punished | medium |
| mite | Fracture Mite | today's brood | area | built |
| mite | **Furnace Tick** | each dying mite leaves a small slag (r 1.2, the existing `Hazard`) | shove them away before popping them; bad for a nova at your feet | cheap |

That's 5 new bodies, 10 in all, before roles.

### A2. Roles that work together (medium)

These are the D2 shaman, pylon and leader. They also do something no current enemy does:
**they make time cost something** (0.1, reason 5), and that's what a close or burst style
needs to pay off.

| role | what it does | the tell | answers | BE |
|---|---|---|---|---|
| **Echo Shell** (tender) | holds 8-11 u behind its pack; every 5 s it rebuilds the nearest wreck within 9 u at half HP | 1600 ms ember tether to the wreck, its seams relight | kill it (18 HP); stand on the wreck (within 1.5 u it can't rebuild: the thief's guard rule, mirrored); a pushed bolt breaks the tether (+824 ms margin at 9 u) | 1 |
| **Ward Pylon** | a post that doesn't move or attack; every pack member within 6 u is sealed (the Warden's seal, with no leader) | an ember ring on the floor, r 6 | snipe it (24 HP); hit it over walls (Ricochet, Through-Line, Flare); drag bodies out of the ring (Hook, Backdraft, Clamp Toss) | 1 |
| **Strain Siphon** *(surprising)* | holds 5-9 u; latches a tether to Still and draws **+1 strain every 4 s latched, at most +2 a fight** | 800 ms tether windup, a thin ember line | kill it (14 HP); get beyond 11 u; a pushed hit in the windup breaks it | 1 |

The Echo Shell's cost to a kiter: C+H+H+tender, with a rebuilt 15 HP body every 5 s,
is +3 enemy HP/s against 15.8 DPS. That's about 25% longer at the kiter's exposure rate.
A marksman kills it first (B2's targeting). A brawler stands on the wrecks.

The Siphon is surprising because its damage is **strain, not HP**. It's the only enemy that
moves the run's resource in the crawl without a push, and it's priced so the default
mid-range kite (5-9 u) is exactly where it drains. The cap keeps it from causing a
cascade: at most +2 a fight, and a quiet still takes 2 back down to the floor. Area II
only. Expected effect: +0.5 to +1 strain going into the Arbiter.

### A3. Champions and uniques with stacked mods (medium)

The list goes from 4 mods to 10. **Four of the new ones are Still's own parts, worn by the
enemy** (the symmetry rule, applied to modifiers). The worn part shows as its model on the
elite's back, lit ember (like the thief's cage, but warm). Champions carry 1 mod. One
**unique** per area carries 2, has a fixed old name (Fracture Titan, Vault Keeper,
Corrupted Overseer, Lockdown Warden), sits in a side room, and drops a guaranteed blue.

| mod | behaviour | pressures | new? |
|---|---|---|---|
| Quick | pack speed ×1.45 (a hulk at 6.2 u/s outruns Still's 5.5) | kiting | built |
| Plated | half damage | everyone | built |
| Many | splits in two | area helps | built |
| Warden | seals its pack | range (snipe the leader) | built |
| Echoing | every strike repeats 450 ms later on the same spot | the brawler's step-back-in | new |
| Molten | every strike leaves a slag (`Hazard`) | close play, planted play | new |
| *worn* Mirror Ward | bolts that hit it **during its windup** fly back at Still | marksman, skirmisher: hit it in the recover | new |
| *worn* Anvil | catches the first melee hit every 6 s and hammers back (r 3, 12, telegraphed flash) | brawler: open with a bolt or nova | new |
| *worn* Backdraft | the start of its windup pulls Still 1.4 u toward it | range styles | new |
| *worn* Chill Vent | its strike slows Still to ×0.7 for 2 s (3.85 u/s, under a hulk's 4.3) | kiting breaks for 2 s | new |

**A worn-part elite drops the part it wears.** That's targeted loot: see a Mirrored
champion, want Mirror Ward, go and get it. It's the only way to chase a part on purpose,
it's build agency without currency, and it uses the elite drop that already happens
(elites always drop).

Rules: mites can take only Quick, Warden, Echoing, Molten, Chill; sentinels can't take
Many or Anvil; roles and the thief are never crowned. Banned pairs on uniques: Many +
Warden, Anvil + Plated.

### A4. Area rosters (cheap once A1 exists)

Each area has a family pool, and each level draws from it (the base hulk always fills the
budget). The level's roster is named on the entrance banner ("tonight: Crawlers,
Repeaters, Ticks").

| | pool | draws | roster combinations |
|---|---|---|---|
| depth 1 | area I minus ram and tender (5) | 2 | 10 |
| depth 2 | area I (7) | 3 | 35 |
| depth 4 | area II (10) | 3 | 120 |
| depth 5 | area II (10) | 4 | 210 |

Area I: Rust Guard, Iron Crawler, Static Frame, Sentry, Repeater, Ram, Echo Shell.
Area II: Rust Guard, Iron Crawler, Ram, Raging Hull, Fracture Mite, Furnace Tick, Lobber,
Sentry, Ward Pylon, Siphon. The lessons (ram at 2, mites at 4, Lobber at 5) stay fixed.

### A5. The thief: how the owner actually meets it (cheap)

**Today's encounter rate (a model):**

| factor | value | source |
|---|---|---|
| depths that can roll it | 2 only | `THIEF.depths` |
| chance per depth-2 level | 0.35 | `THIEF.chance` |
| has a side room for its nest | ~0.95 | generator |
| acts: a part lies unguarded ≥ 600 ms | ~0.5 (0.3-0.8) | it never spawns carrying; a player who takes or stands on drops gives it nothing |
| noticed: it's in a corner and takes a part you'd already left | ~0.6 | |
| **met, per run** | **0.10** (0.05-0.21) | |
| never met in 7 runs | **48%** | the owner's 7 runs |

Not meeting it was the expected outcome, not bad luck.

**The fix.** (1) It **spawns carrying**: it takes the side room's guaranteed drop into its
cage, so a level pays out exactly what it did (no new loot). (2) Depths 1, 2, 4 and 5,
at 0.3 each (area II gets a Works-coloured family member). (3) Run 1's depth 1 always
has one, in the lesson's sight line. With a 0.9 notice rate (a cold light that chimes and
runs when you come within 7 u):

| | today | proposed |
|---|---|---|
| thieves per run | 0.33 present, 0.10 met | 1.2 present, 1.08 met |
| P(meet at least one) | 10% | **72%** |
| never met in 7 runs | 48% | < 0.01% |

**It's a range test that every build can pass.** 12 HP is one Focusing Lens bolt at 13 u,
1.2 s of B2's planted eye, or a Kickstart (6.4 u) onto it. On foot it averages 4.55 u/s
against Still's 5.5: closing at 0.95 u/s from its 7 u flee radius, a chase is about
7.4 s. So a marksman snipes it, a brawler needs its legs, and a tinker's Plumb Line
cuts it off.

---

## B. Playstyles

### The structural question: slots stay role-locked

| option | loadouts | what happens |
|---|---|---|
| **role-locked (today)** | 8 × 7 × 7 × 8 = 3,136 | every build has one answer at each range; button position = role, which a thumb learns once |
| any slot, any role | C(30,4) = 27,405 sets | 70 four-bolt builds are kiting with four answers at range: the dominant style gets *more* dominant; a drop no longer says which button it replaces; the compare screen becomes 4-way |
| **role-locked + cross-slot behaviours** | 3,136 → 5,832 with 5 new parts | parts that read what the other slots do (Signal Flare already does: "your next part hits twice"); archetypes come from what the build rewards, not from which buttons exist |

Recommendation: **keep the lock**. Archetypes come from three places: (1) a global rule
that gives the auto a stance by where Still stands (B0), (2) cross-slot behaviours on
about 5 new parts (never stats), and (3) enemies that pay each style (A, C). The lock
also protects the weak slot: a brawler still has a head, a marksman still has arms, so
no build is helpless against the wrong roster.

### B0. Hand and eye: the auto has three stances (cheap, the keystone)

Nobody chooses it, and it asks nothing new of the thumb. The auto reads where Still is:

| stance | when | auto | DPS | target |
|---|---|---|---|---|
| **moving** | today | 5 per 0.62 s, 7.6 u | 8.1 | nearest (today) |
| **hand** | nearest target ≤ 3.5 u, clear line | **10** per 0.62 s | **16.1** | nearest |
| **eye** *(surprising)* | Still hasn't moved for 0.5 s | 5 per **0.5 s**, **11 u** | 10.0 | **shooters and supports first** (sentinel, Lobber, Echo Shell, Pylon, Siphon), then nearest |

Hand takes precedence over eye. What each changes:
- **Hand:** the close band pays *continuously*, not at cast instants. Full close kit:
  16.1 + 6.2 + 6.9 + 2.3 + 1.5 = **33.1 DPS**, against the 15.8 kite. That's 2.1×. The hulk
  can't reach 2.5-3.5 u (its strike is 2.4 u), so there's a 1.0 u band where a disciplined
  brawler is never hit by a hulk and does double. That's the footsies fantasy, from a rule
  that already exists (the hulk's reach). It pays nothing against a sentinel (you have to
  chase it: closing at 2.1 u/s from 6 u to 3.5 u takes 1.2 s) or a ram (at point blank
  the sideways step out of its lane is 204 ms against a 405 ms lock, right after its 1 s
  hug timer).
- **Eye:** a robot named Still, rewarded for standing still. It changes the target rule
  too, which solves the one thing a marksman can't do on a phone: choose. The eye covers a
  sentinel's whole 6-10 band and 8-11 of a Lobber's 8-12. Moving resets it (0.5 s), so
  every dodge costs the marksman tempo. That's its risk.
- **Moving** stays exactly as today, so a skirmisher run is still possible. It just
  stops being the only one.

### Archetype pitches

Each gives a DPS model, which existing parts fit (P primary, s secondary), what's
missing, and how it uses the push. The outcome shares in the last table are targets for
tuning, not measurements.

**B1. The brawler: stay in the band (cheap with B0).** Still holds 2.5-3.5 u off hulks,
swinging the hand auto, and breaks slams with close pushes. What makes it viable: B0's
hand (2.1×), and **a close break gives one back**: a pushed hit that breaks a windup
within 4 u refunds 1 strain, so it costs +1, not +2. Two close breaks a fight cost what
one push costs anyone else, and 0.2 shows only close pushes can break hulks, mites and
Lobbers at all. Bosses can't be broken, so the refund never applies where Stopped lives
(the boss fights): the Stopped odds from the strain round stay as they are. What makes it
rewarding: a close break is a kill (0.2). Fits: Scrap Cleaver P, Piston P, Rusted Hook P,
Parry Clamp P, Frayed Cleaver s, Clamp Toss P, Anvil P, Backdraft P, Brace P, Pressure
Vent s, Kickstart s, Skid Plates s, Overrun s. **Missing: Grindstone** (arms blue, bends
the Cleaver): "Refills only while an enemy is in reach, twice as fast." 18 per 1.3 s =
13.8 DPS close, 0 while kiting. Brawler total 39.9 DPS against 15.8. It gives up all
value at range. Its ending is more often Stopped than Broken (Brace turns hits into
strain), which is the right signature: the brawler wears out.

**B2. The marksman: plant and pick (cheap with B0).** Still finds a spot 9-11 u out, stands,
and the eye takes the shooters and supports first. Viable because distance becomes damage
time: from 11 u a hulk takes 2.1 s to reach its 2.0 u trigger, so eye plus Lens deals
21 + 26 = 47 against 30 HP, and a lone hulk dies on the way in. **Chill Vent doubles the
window** (walk ×0.5): 4.2 s gives 94 damage, so a 3-hulk pack dies before it arrives. That's
a two-part synergy with numbers behind it. Punished by mites (4.8 u/s, 8 bodies: the eye
kills about 2 before they arrive) and rams (they rush from 9 u). Fits: Focusing Lens P,
Cracked Lens P, Ricochet P, Patient Lens P, Through-Line P, Ward s, Mirror Ward P, Chill
Vent s, Skitter s, Spring Heels P, Plumb Line P ("snap back to the perch"), Frost Trail s.
Arms is its weak slot (0 fits, and any of the 7 will do). Push: Patient Lens's full shot,
a pushed bolt breaks sentinels (≤ 8 u) and rams (read the tracking rails). Few pushes,
far from Stopped. Its ending is Broken, when something reaches it.

**B3. The caster: make them clump, hit them all (cheap).** Area damage scales with the
number caught, so the caster's DPS is (per target) × N. Backdraft pulls N bodies into
1.4 u, then Cleaver's 120° or Skid's slam catches all of them. Signal Flare then Vent
marks and doubles on each: 2 × 15 × N, so 90 on a pack of 3 in two presses (the catalog's
known number). Viable because swarms and Many-splits pay it, and **a pushed nova breaks
every windup in its radius**: one push answers a whole mite surge (4 biters, 1 bite),
which no other style can. Fits: Flare P, Cracked s, Signal Flare P, Pressure Vent P,
Backdraft s, Chill P, Rusted Hook s, Clamp Toss s, Frayed at 360° s, Skid Plates P,
Frost Trail s. **Missing: Flywheel** (torso blue, bends the Vent): "Every part you cast
winds the blast. The fourth cast fires it on its own. Push it to fire it now." It gives up
manual timing.

**B4. The burner / masher: short cooldowns, links, strain (cheap to medium).** D2's
assassin translated: many small presses that feed each other, paid in strain. Coil every
1.2 s, the auto, Patient taps. **Missing: Ratchet** (legs blue, bends Skitter): "Every hit
you land winds this hop 0.4 s closer." At about 3 hits a second (auto 1.6 + Coil up to
2.5) Skitter's 3.2 s becomes about 1.45 s, so the masher hops constantly. Fits: Coil P,
Patient s, Signal s, Brace s, Frayed Cleaver P, Overrun P, Borrowed Time P, plus
Flywheel. Push: constantly. This is the archetype of the middle ending, by design: it
lives near 12+ strain (the Frayed full circle) and chooses when to go home.

**B5. The tinker: Still leaves pieces of himself (medium, surprising).** An incomplete
robot whose parts come off and keep working. **Loose Lens** (head blue, bends Focusing
Lens): "Set your lens down. It fires at the nearest enemy on its own for 8 s. Your head
button is empty until you walk over it." That's 8 per 1.0 s at 9 u, 64 over its life
against about 50 from the Lens: it pays only if placed well, and it costs a button (the
moth and the flame, literally). **Spare Clamp** (arms blue, bends Parry Clamp): "Leave a
clamp on the floor. The first enemy to wind up beside it is caught." That's a placed break
with no push, one charge. Existing fits: Lure P, Plumb Line P, Frost Trail P, Through-Line s
(its breaches). It's thin even with both new parts (see the table), so it's a later
archetype.

### Build diversity across the pool

Fits per slot (head, torso, arms, legs). "3 fit + weak" counts loadouts where 3 slots fit
and the weakest slot takes anything.

| archetype | fits today | 3 fit + weak, today | fits with the 5 new parts | 3 fit + weak, with |
|---|---|---|---|---|
| skirmisher | 3 / 2 / 1 / 4 | 168 | 3 / 2 / 1 / 5 | 270 |
| brawler | 1 / 3 / 7 / 3 | 504 | 1 / 3 / 9 / 3 | 729 |
| marksman | 5 / 4 / 0 / 4 | 560 | 6 / 4 / 0 / 4 | 864 |
| caster | 3 / 3 / 2 / 2 | 144 | 3 / 4 / 2 / 2 | 216 |
| burner | 3 / 1 / 1 / 2 | 42 | 3 / 2 / 1 / 3 | 162 |
| tinker | 1 / 1 / 0 / 2 | 14 | 2 / 1 / 1 / 2 | 36 |

- **All 30 parts fit at least one archetype; 26 fit two or more** (30 of 35 with the new
  parts). No part is dead under these proposals. The ones that fit only one: Ricochet,
  Piston, Parry Clamp, Anvil (all brawler or marksman cores).
- Brawler and marksman are deep today and only need B0. Caster is adequate. Burner needs
  Flywheel and Ratchet. Tinker needs two more parts than proposed.
- The pool grows from 30 to 35, and the loadouts from 3,136 to 5,832. Side effect: the wall
  takes about 1 run longer to fill (the premium round's gap 3 wants longer, not shorter).
- **Getting to an archetype on purpose:** the hook by the door carries one part (hang
  Grindstone and you start as a brawler). A3's worn-part elites let you hunt a second.
  Floor drops fill the rest.

### How each archetype uses the push, and where it ends

| archetype | crawl pushes / fight | what the push is for | boss pushes | Home | Broken | Stopped |
|---|---|---|---|---|---|---|
| skirmisher | 0.8 | the free one, on a sentinel | 4-6 | 70% | 20% | 10% |
| brawler | 1.5 (net +2 with refunds) | close breaks: hulks, mites | 6-8 | 60% | 15% | 25% |
| marksman | 0.5 | Patient full shot, sentinel breaks | 3-5 | 65% | 30% | 5% |
| caster | 1.0 | a nova breaks a whole surge | 5 | 65% | 20% | 15% |
| burner | 2.5 + Coil's +1 a cast | everything | 8-10 | 50% | 10% | 40% |
| tinker | 1.0 | re-place: Lure, Plumb, Loose Lens recall | 4 | 65% | 25% | 10% |

Averaged over styles that's about Home 62 / Broken 19 / Stopped 19. The premium round's
band is 55-70 / 15-30 / 5-15, so Stopped runs high, and most of that is the burner.
That's acceptable: the burner chooses it. The numbers need measuring (Q3).

---

## C. How A and B meet

### C1. The roster asks for a build (free once A and B exist)

\+ helps the style, − punishes it. Every row helps someone and punishes someone. That's
the property that makes a run's roster ask for a different build.

| | brawler | marksman | caster | burner | skirmisher |
|---|---|---|---|---|---|
| Rust Guard | + band | + dies on approach | | | |
| Iron Crawler | − cone covers the band | + | | | |
| Static Frame | − second ring | | + pushed nova cancels both | | − |
| Sentry / Repeater | − chase | + eye covers the band | | | |
| Lobber | + under the arc | ± half its band | | | − |
| Ram / Raging Hull | ± walls | − rushes from 9 u | + Frost trips it | | − (Hull) |
| Fracture Mite | + hand kills in 1 | − swarmed | + one push per surge | + | |
| Furnace Tick | − slag at your feet | + they die far out | − | | |
| Echo Shell | + stand on wrecks | + eye picks it | | | − longer fights |
| Ward Pylon | + drag bodies out | + eye picks it | + Backdraft out of the ring | | − |
| Siphon | + kills it in 1 s | + eye picks it | | | − drains the mid-range |
| Quick | + they come to you | − | | | − outrun |
| Mirror (worn) | + | − in its windup | | − Coil bolts | − |
| Anvil (worn) | − | + | + nova opens it | | |
| Backdraft (worn) | + | − pulled off the perch | | | − |
| Chill (worn) | | | | | − under hulk speed |

With A4 a level draws 3-4 families, so a level has a lean: Crawler + Repeater + Pylon asks
for a marksman or caster, Mite + Tick + Siphon asks for a brawler.

### C2. The beam shows the next roster (cheap)

The exit beam's banner names the next level's families before you step in. With parts
lying on the floor until you leave, that's a real decision: *take the Chill Vent from the
floor, the next level is Crawlers and Repeaters.* It's D2's "Act 2 has Claw Vipers", in one
line of UI.

### C3. Treasure classes lean toward the answer (cheap, surprising)

`TREASURE` already leans each archetype's drops by slot. Add a second lean: **each level's
roster raises the drop weight of parts that answer it**, ×1.5 for parts tagged with a
style the roster's "+" column favours. Tiers stay the same and nothing gets stronger. Only
*which* part falls changes. Together with worn-part drops (A3), a run's roster offers the
build it asks for. You can refuse it: moth and flame again, since keeping your build means
passing up the answer.

---

## My one recommended bundle

**"Three ways to stand, and a roster that asks for one."** It's aimed at the owner's two
complaints with the cheapest pieces that move the numbers.

| # | piece | what it moves | cost |
|---|---|---|---|
| 1 | **B0 hand and eye** (hand ×2 at ≤ 3.5 u; eye at 11 u and 0.5 s intervals, shooters first, after 0.5 s planted) | creates the brawler and the marksman from existing parts; close DPS 2.1× the kite, stillness priced in tempo | cheap |
| 2 | **A close break gives one back** (+1 not +2 within 4 u) | the brawler's strain currency; boss math untouched | cheap |
| 3 | **The thief spawns carrying**, depths 1/2/4/5 at 0.3, guaranteed on run 1 | met 10% → 72% of runs; payout neutral | cheap |
| 4 | **A1 families**: Iron Crawler, Static Frame, Hollow Repeater, Furnace Tick (Raging Hull later) | 5 → 9 bodies; each asks a different style | cheap to medium |
| 5 | **A4 area rosters** + **C2 the beam names them** | a level has a lean; the floor becomes a choice | cheap |
| 6 | **A2 Echo Shell and Ward Pylon** | time starts to cost something; the eye has a job | medium |
| 7 | **A3 six new mods incl. the four worn parts**, one 2-mod unique per area | 13 elite types → 84 champion and 319 unique combinations; targeted loot | medium |
| 8 | **Grindstone** (brawler) and **Flywheel** (caster/burner) | the two archetypes missing a part | cheap each |

Variety after the bundle (model): **8.7 families and 8.5 distinct elites per run**, against
5 families and about 5.6 distinct elites today (7 draws from 13 types). It takes a median of 11 runs to see half the champion combinations
and 45 to see 90%, against all 13 elite types in 6 today. Build: 4 archetypes you can
name (skirmisher, brawler, marksman, caster), with the burner and tinker to follow.

Held back: the Siphon (surprising, but it's the one piece that touches the Stopped
economy, so it waits until the half-floor rule has three measured runs), the tinker parts,
Ratchet, and C3's drop lean (the worn-part drops may be enough).

Build order: 1 and 2 first (an evening, and they change how every fight feels), then 3,
then 4+5, 6, 7, 8. Play three runs after 1+2 before building anything else. If a
brawler run doesn't feel different by depth 2, the hand number is wrong, not the idea
(Q1).

---

## Open math questions (playtest locks these)

1. **The hand's multiplier and radius** (×2, 3.5 u). Below ×1.6 the band isn't worth the
   narrowness. Above ×2.5 every hulk fight becomes a brawl whatever the build. The radius
   must stay above the hulk's 2.4 u and at or under the Cleaver's 3.7 u. Log per fight:
   the share of auto hits in hand stance.
2. **The eye's settle time** (0.5 s). If it's too short, "stand still" is just "don't touch
   the stick for a beat" and the eye is always on. If it's too long, every dodge wipes it
   and the marksman never plants. Log: the eye's uptime per fight by build.
3. **The outcome shares by archetype.** Stopped around 19% overall is above the 5-15%
   band, driven by the burner. Needs 10+ runs tagged by build. The knobs, in order: the
   refund (2), Coil's +1, and the Siphon's cap if it ships.
4. **The Echo Shell's rebuild interval** (5 s, half HP). It sets how much time costs a
   kiter (about +25% fight length modelled). Target: kiters take about 1.3× as long on a
   tender pack, not 2×.
5. **A lob can break nothing** (0.2: 800 ms of flight against windups of 900 ms and
   under). Either Flare and Signal Flare get a different push (the pushed lob lands in
   300 ms), or they stay the one family whose push isn't a break. Needs a decision, not a
   playtest.
