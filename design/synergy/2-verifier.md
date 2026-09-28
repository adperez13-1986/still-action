# Synergy round 2: the verifier

## Where I changed my mind

- **Marks are consumed only by payer parts: persuaded.** I had marked paying for any part. The
  balancer's Marking Strike (+29% on a boss, two thirds of four parts at III) is the reason not to.
  In `stateMul`, marked is then paid only if `def.pays` lists it. Signal Flare's and both Marking cards
  must name the payer, and statecheck's "the card says it" row enforces that.
- **Signal Flare 4 → 12: yes, but the setter rule as written fails its own number.** "At least ~0.8
  of the slot's white" measures 12 against Focusing Lens's 26, which gives 0.46. A version I can check:
  **at least 0.6 of the white of the same shape** (Flare's 18, so 11 or more). Its own hit stays a
  plain `e.hit`, a setter and not a payer.
- **"A swap lands at II," stated: yes, and my "keep half" is withdrawn.** I checked the balancer's
  finding: `meltPart` (main.ts) takes any floor part of that slot, including the one a swap just dropped.
  So the full reset that Claude and the translator defend doesn't exist today. Build it as
  `ranks[slot] = 2` on replace, with no drop. Check that the rank after a swap is always 2.
- **Hauled over clumped: yes.** It is set by the pull branches on each pulled body, with `by`, and no
  geometry test. The balancer's "2+ bodies within 2 u" is cheap but can't be seen. I keep half of my double-dip flag: hauled pays **at most x1.5** (statecheck:
  `STATE.hauled.mul <= 1.5`), because the area part already gains the extra bodies.
- **Payers aim at their state: yes, bounded.** It goes in one `prefer(o, def, pool)` after `threat()`:
  among targets the part `reaches` right now, a state carrier beats the nearest. It applies only to
  bolts, lobs and arcs; novas and dashes don't aim, and Clamp Toss keeps the stick's direction. So an arc
  never turns to a chilled body 3 u away while a hulk swings from 1 u, the nearest body keeps the swing
  if it is in a windup.

## Cold Strike, Cold Shot, Heavy Shot

**Heavy Shot is worse on rule 7 than Cold Shot.** A free shot that knocks back gives space (defence)
and damage. If slammed pins the enemy (translator 1.2 s, Claude "can't act"), a free auto also stuns
against every wall. **Rule for masteries: they set only states that do nothing defensive on their
own.** Marked and hauled pass (a drag toward you is the opposite of defence). Chilled passes only if
the mastery chills without the slow (`setChill(e, s, slow = false)`: rime shows, the walk doesn't
change). Slammed never comes from a mastery. The lean map is Adrian's call; the rule is the part
I'd hold.

## Step 1 (function, chilled paid, mark narrowed) after 3 runs

Payers: Scrap Cleaver (both lists), plus Focusing Lens or Cracked Lens. Setters: Chill Vent, Frost
Trail, Cold Strike. Mark payers: Patient, Parry, Overrun.

**Log fields, per depth:** `states.{chilled,marked}.{set,paid,expired}`, `stateBonus` (by state, per
body hit), `payerDmg` by part, `paidBy` by slot and form, `pushedIntoState`, `setToPayMs[]`,
`maxMul`, `aimedAtState`. **Per run:** `worn` at each depth start (id and rank), and `swaps[]`.

**Must hold exactly, every run (else a bug):**
- `paidBy.hand + paidBy.eye == 0`
- `maxMul <= 2`
- every `paid` crosses slots
- a mark on Patient, Parry or Overrun is exactly x2, and 0 marks paid by any other part.

**Pass lines (read after 3 runs, directional):**
- Where a chill pair is worn: **≥ 0.5 paid a pack fight and ≥ 1 a heavy** (the balancer's floor).
- The bonus share of the payer's damage is **0.15 to 0.33**, the range from x1.5 at 30-100% uptime.
  Above 0.33 it's always on; below 0.1 it never lands.
- `expired / set` under 0.8 where worn (above, he isn't reading it).
- Median `setToPayMs` under 2.5 s (he presses into the state).
- `pushedIntoState` ≥ 0.3 a fight; crawl pushes a fight up from 0.49.

Swap take-rates (the balancer's 30-70%), Stopped and Broke need 6+ runs.
