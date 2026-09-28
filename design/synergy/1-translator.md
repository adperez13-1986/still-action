# Round 1: the translator (a state and a pair, read in the hand)

28 Sep 2026. Read: `combat.ts` statuses, `partfx.ts` badges, `enemy.ts` `statusTint`, `vfx.ts`,
`hud.ts` offer card, `pause.ts` compare.

## What Hades teaches, and where the phone disagrees

- **Curses sit in a row of icons over the foe.** Fine at TV distance on a few big foes; three icons on
  eight bodies on a 6-inch screen is noise. **Here: one place per state**, not one icon per state.
- **The curses players feel end in a bang** (Doom's late hit, Demeter's Chill blast that clears it); flat
  "+% against cursed" boons go unnoticed. **Here: every payoff consumes its state, seen and heard.** The
  mark already does (brackets slam shut, two flashes): the template.
- **Duo boons are offered only when you hold both gods**; the offer announces the pair. **Here: a floor
  card names the worn partner, or says nothing.** Merciful End (a deflect sets off Doom) is the shape:
  one part's state, paid by another's press, when you chose.

## 1. The states: four, each in its own place

All are Still's doing, so all cold (COLD, COLD_DEEP, RIME, FROST). Four cold states can't be told apart
by hue, so they're told apart by **where they sit**. All count down the same way (G2: Still's marks close).

| State | Set by | Lasts | Where it shows | Paid: how it breaks |
|---|---|---|---|---|
| **chilled** | Chill Vent, Frost Trail, Cold Strike/Shot (exist) | as now | **the body**: rime on joints, falling motes (exist) | the frost shatters outward, a glassy tick |
| **marked** | Signal Flare, Marking Strike/Shot (exist) | as now | **over the head**: three brackets closing (exist) | brackets slam shut, two flashes (exists) |
| **hauled** (the brief's clumped) | Rusted Hook, Backdraft Vent | 2 s after your pull | **the floor**: a cold cinch, a strip from each pulled body to the pull's centre, shortening | the strips whip outward |
| **slammed** | any shove stopped by a wall at speed (Piston, Clamp Toss's short throw, Pressure Vent, Skid Plates) | 1.2 s, pinned | **the wall**: a cold crack where it hit (the breach rim's material), body flat to it | the crack flares, the body drops |

- **Hauled, not clumped**: "how close is clumped?" has no answer on screen; "pulled by you in the last
  2 s" does, and says when to press. **Slammed is set by the wall**: the collision teaches itself.
- **Refreshes, never stacks.** No numbers over heads. Two states on one body coexist (different places);
  only the paid one breaks.
- **Crowd rule, extended**: past 5 bodies in a state, each drops to a quiet form (one bracket; tint
  without motes; the cinch's knot only). The pay is never quieted. No flat white anywhere.

## 2. Setters and payers, in the card's words

One state word per card. Payers add one clause, always one shape: **"On a chilled enemy: lands
twice."** (x2) or **"...: hits harder."** (x1.5). No numbers on the card; the compare screen gets a row
("vs chilled x2").

| State | Sets it (new or changed line) | Pays it (clause added) |
|---|---|---|
| chilled | Chill Vent (T): "A cold blast that chills enemies: they walk slowly." Frost Trail (L): "...a cold track that chills what walks on it." | **twice**: Focusing Lens (H), Lure's burst (T). **harder**: Scrap Cleaver (A) |
| marked | Signal Flare (H), unchanged | any part, twice (unchanged) |
| hauled | Rusted Hook (A): "A long, narrow swing that hauls enemies to you." Backdraft Vent (T): "The blast hauls enemies in instead of out." | **harder** ("On a hauled pack"): Flare, Cracked Lens (H), Pressure Vent (T), Frayed Cleaver (A), Skid Plates' blast (L) |
| slammed | Piston (A): + "Into a wall, it's slammed." Clamp Toss (A): + "Thrown into a wall, it's slammed." | **twice**: Through-Line (H), pushed Overrun (L). **harder**: Ricochet Lens (H), Kickstart (L) |

**Neither (11)**: Patient Lens, Overclocked Coil, Ward, Brace, Mirror Ward, Parry Clamp, Anvil, Skitter,
Spring Heels, Plumb Line, Borrowed Time. Marked stays paid by any part. Every slot has a setter and a
payer; pairs always cross slots (Pressure Vent pairs with Rusted Hook, not Backdraft). A first pass to cut.

**Payers aim at their state** (after the pushed-threat rule), or a pair whiffs in a crowd and nobody
can tell why.

## In the hand: the HUD arc

- **Top rim is the pair, bottom rim the price** (ember pips sit low). A complete pair puts the state's
  glyph (~14 px) on both buttons' top rims: hollow on the setter, solid on the payer. Half a pair shows
  nothing: the HUD shows what works, the card what could.
- **Primed**: the payer's glyph lights while its state is live on an enemy it `reaches`: "when you
  press" (rule 4). The break hint wins if both are up.
- **First pay of each state in a run**: a banner, as melt does: *shatter*, *twice*, *scatter*, *pinned*.
- **One sound family for pays** (a cold tick, pitched per state): the ear files all four as "paid".

## 3. Melt vs pair, on the card

**Rank is always on screen** (II, III on the button); **a pair is intermittent**. A player overvalues
what he sees, so the pair must be loud and the loss written. The floor card has one spare line:
1. Completes a pair: **"pairs with Chill Vent"**, in cold; the partner's button pulses beside the slot's `target` pulse.
2. Breaks a pair: **"replaces Rusted Hook · ends its pair with Pressure Vent"**.
3. Loses rank: **"replaces Scrap Cleaver III · its rank goes with it"**.

On the compare screen the pair sentence takes the slot `conflictLine` already fills. On a swap, **the
full reset reads best** ("III to I", one glance); if too harsh, keep a whole rank ("starts at II"),
never half: a half rank has no numeral.

## 4. Leanings

Mapped onto parts, the brief's map collides with names (Focusing Lens pays chilled, so "close"; a
close lens won't read). It means something **through the autos**: a leaning is which states your auto
sets. Swap two masteries: Marking Strike becomes **Hauling Strike** ("every close strike drags what it
hits a step in"), Cold Shot becomes **Heavy Shot** ("every planted shot knocks its target back; into a
wall, it's slammed"). Close then sets chilled and hauled, marksman marked and slammed. On the card the lean glyph gives way to the state glyph the part pays: "which of
your autos feeds me".

## 5. Three steps, smallest first

1. **Chilled pays** (chill exists): clauses on Focusing Lens and Scrap Cleaver, the shatter, pay
   sound, banner, payer aim, "pairs with". Play Chill Vent + Focusing Lens. Log: pays a fight.
2. **The hand**: top-rim glyphs and primed for chilled and marked; the three card lines; the compare row.
3. **Slammed, then hauled**: wall stop at speed (Clamp Toss's `short` is the seed) with crack and pin,
   then the cinch; their payers; then the two mastery swaps.

## Open for playtest

- Is primed read mid-crowd, or does the thumb ignore it?
- Consuming chill trades the slow for damage (rule 7 reads well). Does it feel like losing the slow?
- Haptics on every pay, or the first of a fight?
- Are 1.2 s pinned and 2 s hauled long enough to see and press?
