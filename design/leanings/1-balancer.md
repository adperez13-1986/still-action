# Round 1, balancer: close and marksman, by the numbers

## Where it stands (read off the code and 10 hand+eye runs in playtest.json)
| stance | auto | + plain kit (Lens 6.2, Vent 2.3, Cleaver 6.9, Kickstart 1.5) | single-target DPS | blows taken |
|---|---|---|---|---|
| close, in reach (hand 10 / 0.62 s) | 16.1 | 16.9 | **33.0** | ×1 (×0.5 if also planted) |
| planted, any range (eye 5 / 0.62 s, pierces) | 8.1 | Lens 6.2 (torso/arms/legs don't reach) | **14.3** | ×0.5 |
| walking at range | 0 | Lens 6.2 | 6.2 | ×1 |
Planted is 43% of close per body; the eye is ~20% of auto damage. 5 of the last 7 runs Broke at the
Assembler; Stopped is 0 of 21. Two facts shape this: bosses can't be broken, so break payoffs die
where runs die; and hand and eye never reach the same body at once, so a stance-gated payoff splits
its own triggers in a mixed loadout. That second fact is the case against set bonuses.

## 1. What a leaning is
- **A tag, one per part, nothing else**: close (hand glyph) or marksman (eye glyph); 2 neutral.
  Tags do no maths. They steer the pedestal match and the look-back (card, wall plaque, compare
  pause "leaning close: 3 of 4"). Never the HUD.
- **Payoffs live on 8 blues, one per leaning per slot**, each a single enemy-triggered clause that
  acts on that part's own ability (readies it, fills it). No part reads another part's numbers.
- **Two triggers, symmetric**: a *hand break* (exists: `onHand(e, broke)`; 31-39 per full run,
  ~1.2 a fight) and an *eye break* (new, below). At a boss, the first hand/eye hit on each opening
  (Assembler stunned on a wall, the Arbiter's vent) counts as a break, or payoffs die at the bosses.
- **The hand and the eye don't change with what you wear.** A worn auto makes every part two
  abilities (cut in the variety round). Parts react to the hand and eye; they never rewrite them.
- **No set bonuses, measured**: in my sim a random picker wears 3+ same-tag parts in 47-62% of runs.
  A count bonus would switch on in half of random loadouts: a stat in disguise.

## 2. The kit (w white, b blue, g gold; **P** = payoff; *rework*, NEW)
| slot | close | marksman | neutral |
|---|---|---|---|
| head | Signal Flare b (offence setup), Overclocked Coil g (offence), **Glare b P NEW** (defence) | Focusing Lens w, Cracked b, Ricochet b, **Patient Lens b P**, Through-Line g | Flare w |
| torso | Pressure Vent w, **Backdraft b P**, Brace b (defence) | Ward w, **Chill Vent b P**, Mirror Ward b, Lure g | |
| arms | Scrap Cleaver w, Rusted Hook b (reach/mobility), **Parry Clamp b P**, Frayed b, Anvil g | *Piston w*, **Clamp Toss b P** | |
| legs | Kickstart w, **Skid Plates b P**, Overrun b | Skitter w, Frost Trail b, **Spring Heels b P**, Plumb Line g | Borrowed Time g |
Close 14, marksman 15, neutral 2; 2+ per leaning per slot; STARTER_POOL holds Backdraft and Patient.
- **Glare** (head, blue, bends Focusing Lens), NEW, the only new part. "A flash at close range.
  Anything winding up in front of you flinches." Shape `arc` + the existing `parry` mod: cone 100°,
  reach 4.5 u, 6 dmg, breaks any breakable windup, shove 1.0, cd 6.0 s. Gives up 8.5 u of reach and
  20 of 26 damage. It fills close's thinnest slot (head had one blue and one gold).
- **Piston**, *rework* to marksman's arms white: dmg 26→20, shove 1.6→4.0, "knocks one enemy far
  back". A hulk shoved from 3 u to 7 u takes 0.93 s to return = 1.5 far shots (+12): 32 eq vs 26.
- **Clamp Toss**, *rework*: planted (stick at rest), it throws straight away from Still, 5 u.

## 3. Payoffs (card clause appended to the part's line)
| part | trigger → gift | per trigger | why this part |
|---|---|---|---|
| Glare | hand break → 2 s off it | 1/3 cast | chains breaks through a crowd |
| Backdraft Vent | hand break → 3 s off it (cd 6.5) | 0.46 cast: 12 dmg + drag into reach | feeds the hand more windups |
| Parry Clamp | hand break → readies it | ≤1 cast: 10 dmg + a second break | break the next slam |
| Skid Plates | hand break → readies it | ≤1 dash: 18 dmg + shove | leave the crowd or reach the next |
| Patient Lens | eye break → fills it | up to +26 dmg (6→32) | the heavy shot on demand |
| Chill Vent | eye break → readies it | hulk approach 8→3 u: 1.2 s → 2.3 s | keeps the range |
| Clamp Toss | eye break → readies it | 5 u throw ≈ 1.2 s more far shots ≈ +16 | the "get off me" |
| Spring Heels | eye break → readies it | ≤1 vault to cover | replant behind a wall |
Value bands: a pack is ~80-100 HP. 2 payoffs of one leaning ≈ +1 cast a fight ≈ **+12-15%** clear
speed; all 4 ≈ **+25-30%**; hard cap **+35%**. One of each leaning fires each half as often (the
stance split): **~+7%**. So committing beats mixing (rule 8) with no counting. No heal anywhere
(rule 7); refunds add casts, never multiply (rule 3). A refund doesn't waive a push's +2.

## 4. Making marksman real (the base eye; one combat change)
- **Far shot: eye 5 → 8 dmg on bodies ≥5 u away** (5 under). Planted at range: 12.9 + Lens 6.2 =
  **19.1 per body**, 58% of close single, **~100% on a line of two** (pierce). Knob: 7-9.
- **Eye break: a planted shot from ≥5 u that lands on a windup still tracking breaks it** (sentinel
  before its lock, ram before its lock, Lobber windup). Odds per windup, eye on it: sentinel
  456/620 = **74%**, ram 495/620 = **80%**; the hand vs a hulk is 520/620 = **84%**. Symmetric.
- **Keep** settle 0.3 s, brace ×0.5, reach 11, shove 0.6. The 0.62 s beat stays.
- Matchups, different not stronger: close wins hulks and mites (TTK hulk 1.24 s hand vs 1.86 s far
  eye); marksman wins sentinels (3 far shots, 1.24 s, 74% never fire vs ~1.4 s walk-in + 1-2 shots
  taken for close), Lobbers and tracking rams. Deeper packs carry more ranged: close peaks at
  depths 1-2, marksman at 4-5. Both must clear the Assembler: watch it (below).

## 5. The pedestal match
- **Your leaning** = the tag on most worn parts; tie → the latest taken tagged part.
- Of three: **one drawn from your leaning** (normal tier roll), one for an empty slot if any, one free.
- **No leaning yet** (Flare start, or a tie with nothing): one close, one marksman, one free: both
  doors shown. STARTING is 3 close : 1 marksman, so first runs lean close unless the hook says else.
- Sim (scratchpad approximation: 31 parts found, exit pedestals d1/2/4/5, Assembler 1 + a +4-strain
  second pick half the time, Plenty 40%/crawl level, 2-6 floor offers per crawl depth):
| rule | committed: 2+ own payoffs at the Arbiter | 3+ | random picker, 2+ |
|---|---|---|---|
| no match | 75-86% | 39-55% | 11-12% |
| **1 in 3 matches** | **87-93%** | 53-67% | 12% |
| match + one of the other leaning | 81-89% | 44-58% | 11% |
The match is worth +7 to +12 points, more when the floor is thin. Tags alone form in 100% of
committed runs, so formation must be counted in payoffs, never tags. The +4-strain second pick is
now where commitment costs strain: the payoff you want, for strain that stays.

## 6. Guardrails (pass / fail)
- **Static test**: 2+ parts per leaning per slot in the pool; exactly one payoff per leaning per slot.
- **dropsim** (see modelling): committed formation (2+ own payoffs at the Arbiter) **≥70%** each
  leaning, gap **≤10 pts**; random **≤20%**; all 4 own payoffs at the end **≤15%** (rule 9); under
  the drift policy no part picked **>2×** its slot's median; each slot **15-35%** of pedestal picks.
- **Playtest log** (new: `eyeBreaks`, fires per payoff part, `plantedS`, damage by hand/eye/parts,
  blows taken planted vs not). Over 6+ runs: no part taken **>60%** when offered for a filled slot
  (10+ offers); each payoff fires **0.5-3 a fight** in its leaning (below 0.5 = failed part);
  marksman runs: eye **≥35%** of auto damage and Arbiter eye:hand **≥1:2** (today 5:60); pushes a
  fight in committed runs **≥70%** of mixed (refunds must not starve the push; Stopped is already
  0/21); Broke at the Assembler **≤40%** of runs that reach it (today 5 of 7).
- **Modelling in dropsim**: `lean` and `payoff` on AbilityDef (data only); pedestal events; empty
  slots filled only by pedestals; policies `commit` (start part's leaning; value empty+own payoff 4,
  empty+own 3, empty+other 2, own payoff over non-payoff 2, own over other 1.5, else leave), `drift`
  (majority leaning), `random`; report the lines above per leaning.

## 7. Scope (one combat change + one economy change, as the plan allows)
Combat: far shot, eye break, boss openings as breaks, a `refund(slot)` hook, 8 clauses, Glare as data
(`arc` + `parry`), Piston and Toss numbers. Economy: tags, the match, glyphs. Plus dropsim and log.

## Recommended leaning design
- One tag per part: close 14, marksman 15, neutral 2 (Flare, Borrowed Time). Tags do no maths.
- No set bonuses: a count bonus switches on in 47-62% of random loadouts.
- Payoffs on 8 blues, one per leaning per slot, each one clause on its own ability.
- Two triggers: hand break (exists, ~1.2 a fight) and eye break (new); boss openings count as both.
- The hand and eye never change with parts; parts react to them.
- The stance split does the committing: mixed payoffs fire half as often (+7% vs +12-15% for two).
- Marksman: far shot 8 dmg at ≥5 u; eye breaks tracking windups (74-80%, the hand's 84% mirrored).
- One new part: Glare (head, close). Reworks: Piston to marksman white (20 dmg, 4 u shove), Toss
  throws away when planted, 7 blues gain a clause.
- Pedestal: one of three from your leaning; nothing worn → one of each; +12 pts formation.
- Pass lines: formation ≥70% each, random ≤20%, done ≤15%, no part >60% taken, eye ≥35% in marksman
  runs, pushes ≥70% of mixed, Assembler Broke ≤40%.
