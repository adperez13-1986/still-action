# Variety and playstyles: the verifier (round 2)

Checked against the code at a49442c and `playtest.json`. The one run since casts started
firing on the press (26 Sep, 05:27) had the break rule ON: 22 fights, 20 pushes, 8 breaks,
Home at depth 6.

## Where I changed my mind
- **The close hand hits one target, not an arc.** My 100° swing took the caster's clump
  and the Cleaver's job. The balancer and translator both land on 16.1 dps single-target.
- **The head spotter rule moves into the eye.** Priority aim while kiting makes the
  Focusing Lens unpredictable. It belongs to standing still.
- **Cut Mantled** (Bulwark and Mirrored cover it). **Defer the Linesman** until the Line's
  Signalman sets the support pattern. **My thief merges into the translator's.**

## (a) One close-auto rule, and whether it waits
Four versions: mine (8 in an arc), the balancer's (10 per 0.62 s), the translator's
(5 per 0.31 s), Claude's (the auto follows the arms). **One rule:**
- **The hand:** when the nearest *awake* enemy passes `inReach(range 2.9)` and `!shaded`
  (3.5 u from a hulk: outside its 2.4 ring, inside the Cleaver's 3.7), the auto becomes a
  jab: **10 damage every 0.62 s**, an arms pose, two clacks (the translator's rattle as
  sound, half the hitstops, 0.62 s stays the tempo). Claude's arms-driven auto is later.
- **The eye** (the balancer's): still for 0.5 s, the auto reaches 11 u every 0.5 s,
  leaders, shooters and supports first. **Awake enemies only.** Today `nearest()` ignores
  sleep, harmless only because 7.6 u is under the 8 u wake radius. At 11 u the eye would
  shoot packs awake, which catalog decision 5 forbids.
- Precedence: hand, then eye, then moving.
- **Build now, behind a pause switch** like `breakRule` (a `'mixed'` run flag and
  stance-share counters in `playtest.json`): the stances shorten fights, and one run is no
  baseline. **What waits** is the close-break refund: it moves strain, measured once.

## (b) Leanings or tags
**Tags as data now (0.5 evening). No behaviours from 2+ matching parts.**
- 26 of 30 parts fit 2+ styles: one tag per part loses that, and several let a random
  loadout reach two by accident. Brawler and Marksman leanings repeat the hand and eye;
  the other three are new global systems. And a buttonless passive can't fit a card line.
- A tag (close, far, around, lent, rhythm) on `AbilityDef` shows on the card, the plaque
  and the compare pause, so turning parts to the wall steers a build. Revisit if he still
  can't name his build by the Assembler.

## (c) New parts and the wall
Pegs free today: **torso 1, arms 1; head and legs none.**
- **Grindstone** (arms): refills only in reach, twice as fast; needs `hud.shift(slot, ms)`
  per tick, since `readyAt` is a timestamp. **Flywheel** (torso): other casts wind it, the
  fourth fires it (the nova plus `iconStates` notches). About 1 evening each.
- Both fit the free pegs. **Third: the Winch** (legs, the translator's: a dash that stops
  at its first hit, the brawler's answer to sentinels). It needs the relayout.
- **Relayout (1 evening, no save change):** the 6 golds move to their own shelf, freeing 2
  pegs per section. `sectionOf` filters out gold, and a new `'shelf'` `InteractId` gets a
  chooser. `turned` is keyed by id, so turning is untouched.

## (d) The thief
**The translator's version at the balancer's rate.**
- It wakes for an elite's owed drop or an unfound drop, `noticeMs` 0, from a barrel in the
  elite's room.
- Certain on the first depth ≥ 2 while the notebook has no `THIEF_PAGE` (the existing
  entry, no new save flag). Then 0.35 at depths 1, 2, 4 and 5, so met in about 80% of runs.
- A chime at each listen; a chevron (top half of the screen) while it carries.
- **Not "spawns carrying":** it moves the side room's drop and steals a part nobody wanted.
  `guardR` 1.5 still protects a part he stands over.

## (e) Stacked mods and worn parts
- **Bug 1:** `updatePacks` rewrites `armor` every tick, so a Plated Warden loses Plated.
  **Fix:** store `baseArmor` at crowning; `armor = baseArmor × (sealed ? 0.35 : 1)`.
- **Bug 2:** a second draw from the level's main `rand` moves every shrine on every seed.
  **Fix:** a new `SALT.champion` stream, so the flags-off `__gen` stays byte-identical.
- **First four new mods** (where the voices converge, all cheap): **Echoing** (re-emit the
  strike at 450 ms, booked in `LockBook`), **Molten** (the existing `Hazard`),
  **Grounded** (`knockMul` 0, can't be grabbed), **Mirrored** (a front bolt returns as a
  `Shot`; it *is* the balancer's worn Mirror Ward). At most one numeric mod (Quick or
  Plated) per leader.
- **Worn parts: yes,** starting with Mirrored and worn Backdraft (reuses the boss magnet's
  `'pull'` action). Worn Chill (Still has no slow multiplier) and worn Anvil (it punishes
  the brawler just as it becomes viable) wait.
- "Drops what it wears" replaces the elite's roll, under `rollPart`'s gates: never turned,
  never on Still, unfound only at depth ≥ 2. Worn models are tinted ember.

## Final bundle (about 13 evenings)
| # | step | ev |
|---|---|---|
| 1 | the thief | 1 |
| 2 | the hand, behind a switch, with stance logging | 1 |
| 3 | the rim circle (the translator's "show the pick", rim only; the sightline's per-tick bank search waits) | 1 |
| 4 | the eye, awake only, same switch; *then he plays with it on and off* | 1 |
| 5 | per-instance `cfg` on the enemy classes; Iron Crawler (lane slam), Thermal Scanner (double shot), Furnace Tick (slag on death) | 2.5 |
| 6 | `mods[]` on `SALT.champion`, the armor fix, glyphs, 2 mods from depth 4; the four new mods | 2.5 |
| 7 | Grindstone and Flywheel; tags on the card and plaque | 2 |
| 8 | the gold shelf, then the Winch | 2.5 |

**Later:** area rosters and the door caption, Bulwark, one support, Spare Lens, strings, the refund, the Siphon.

## What a spec must settle
- **Hand:** the range constant, and how it meets Anvil and the hurt window. **Eye:** what
  "still" means (stick deadzone or position delta? do casts and dashes reset it?) and the
  priority list.
- **Roster names collide:** `hollow-repeater` is the Lobber's page, `vault-keeper` an elite
  page, `drifting-frame` a hulk page, and the round-1 families reuse all three. Fix a
  name-to-role table before any family ships; met counts are keyed by id.
- **Champions:** mods per depth, banned pairs, the notebook page for a stack, the worn-part
  pool. Also: the shelf's place, the tag vocabulary, and every new `SALT` stream, with the
  `__gen` check kept as a gate.
