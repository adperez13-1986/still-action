# Round 2, balancer: converging
Numbers below use the code as it stands: HAND 10 dmg / 2.9 u, EYE settle 0.3 s / 11 u, beat 0.62 s,
sentinel lock 760 ms, Piston 26 dmg / 1.6 u shove, Clamp Toss 5.0 u shove, Flare 11 u / 800 ms.

1. **Marksman trigger: the eye break, printed on cards as "pin".** A planted eye shot that lands on any
   windup the hand could break (`breakable(e)`), first shot included, no range gate. Steady-from-shot-3 loses
   on timing: steady arrives 0.3 + 2 x 0.62 = 1.54 s after the plant, on one body. A 760 ms lock is pinned
   only if Still planted 0.78 s *before* the windup started and never switched target. Most windups start while
   he moves, so pins would fall below the 0.5x-breaks line. Eye on the windup, the first-shot rule pins a sentinel
   74% and a ram 80% of the time; the hand breaks a hulk 84%. The lead's planted-only clock is not enemy-caused
   (rule 2): keep it off the trigger. From the translator: the word "pin", the cold spike, and eye targeting
   that puts "a shooter mid-windup" first. The 0.8 s nail stays as the dial if pins fire but feel weak.
2. **Base eye: 8 whenever planted (lead).** I drop my 5 u gate. A hulk (~4.3 u/s) crosses the 2.9-5 u band in
   0.49 s, under one beat, so the gate changes at most one shot per approach (+3 dmg), and there is nothing on
   screen to show it. Planted per body: 12.9 + Lens 6.2 = 19.1 = 58% of close on one target, ~100% on a line
   of two (pierce). Dial 7-9. No ramp. The translator's three floor ticks at settle are adopted as the look.
3. **Close head: retune Flare (verifier), tag Signal Flare close; no new part.** Flare to 6 u range, 450 ms
   travel, "over its packmates". That puts a white `any` part in close head at 0 new parts, and marksman keeps 5 heads.
   Glare/Welding Eye only if Flare's close-run take rate < 0.5x its slot median. The Signal Flare rework (hand
   breaks mark) is a cross-part doubling (rule 3): its card stays as it is.
4. **Marksman arms: Piston reworked flat, Clamp Toss as it is.** Piston 26 -> 20 dmg, shove 1.6 -> 4.0 u. A 1.6 u
   shove buys 0.37 s (0.6 of a shot). 4.0 u buys 0.93 s = 1.5 shots at 8 = +12, so 32 eq vs 26 today. In close
   hands it pushes the body out of the 2.9 u ring and costs ~1.5 strikes (-15), so it sorts itself with no
   "planted" clause. Toss already buys 1.16 s. No Kickstand: it rewrites the eye's stance by what you wear, and
   all four of us ruled that out.
5. **Payoffs: 4 riders first (verifier's count), no new payoff parts.** Parry Clamp (handBreak, -2 s, icd 1.5 s),
   Backdraft (handBreak, -3 s, icd 1.5 s), Patient Lens (eyeBreak, fully charged, icd 3 s), Clamp Toss
   (eyeBreak, -2.5 s, icd 3 s; "pin the shooter, throw the hulk", and it gives marksman arms a reason).
   I take Toss over Mirror because arms is marksman's thinnest slot. Two of one leaning ≈ +12-15% clear speed;
   one of each ≈ +7% (the stance split), so committing pays without anyone counting tags. Grindstone and Flywheel
   are the second wave if L1 fails. They'd be 2 new parts plus a stance clock and an auto-fire.
6. **Bosses: keep mine, narrowed.** The first hand or eye hit on each opening (Assembler pinned on a wall,
   Arbiter vent) *fires the riders*. It does not interrupt anything. At ~4 openings a fight, that's the
   normal-fight rate, and the icd caps it. Without it the riders go quiet at the bosses, where 5 of 7 runs Broke.
7. **Pedestal match: off until 3 plain-pedestal runs (verifier).** Tags, glyphs and the sim ship now, inert.
   My sim puts the match's worth at +7-12 pts of formation, and formation clears the line without it. Those 3
   runs are also the baseline we'd measure the match against.
8. **Pass lines (tag counts can't be the signal: a random picker wears 3+ of one tag ~54% of the time).**
   - Static (`leancheck`): one lean per part; every slot has a lean `any` part for each lean; riders only on
     handBreak/eyeBreak, own button, no HP/damage.
   - Headless: one sentinel at 9 u, planted, no parts, 20 s: <= 1 shot lands.
   - Sim: *formed* = 3+ own tags and >= 1 own rider at the Arbiter. Commit chooser >= 60% each lean, gap <= 10
     pts; random <= 30%; no part picked > 2x its slot's median; every slot x lean offered >= 0.5 a run.
   - Log, 6+ runs, feel asked first: L1 each rider fires >= 8 a run where worn and >= 2 per boss fight;
     eye breaks in marksman runs >= 0.5x hand breaks in close runs. L2 taken >= 70% of >= 6 offers, or 0 of 6, means rework.
     L3 marksman runs: planted >= 30% of play, eye >= 35% of auto damage, Arbiter eye:hand >= 1:2 (today 5:60).
     L4 pushes and strain within 25% of today. L5 Broke at the Assembler <= 40% of arrivals (today 5/7).

## Final design
- One `lean` tag per part, no maths, never on the HUD. No set bonuses: riders on single parts, own button, icd.
- Two enemy-caused triggers: break (the hand, exists) and pin (the eye, new: a planted shot in a breakable windup).
- The eye does 8 whenever planted (dial 7-9). Settle, brace and reach stay. It targets a shooter mid-windup first.
- The hand and the eye never change with what you wear.
- Close head: Flare retuned to 6 u / 450 ms, and Signal Flare tagged close. No new part.
- Marksman arms: Piston goes to 20 dmg / 4.0 u shove, and Clamp Toss stays as it is. No Kickstand.
- Four riders: Parry Clamp and Backdraft on a break; Patient Lens and Clamp Toss on a pin.
- At a boss, the first hit on each opening fires the riders (no interrupt).
- Pedestal match wired but off until 3 plain-pedestal runs; then one in three from your most-worn lean.
- One combat trial (pin, eye 8, 4 riders, boss openings, Flare/Piston numbers, tags, glyphs), judged by the
  pass lines above. A failed rider gets a new trigger, not a bigger number.
