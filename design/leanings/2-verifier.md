# Round 2: the verifier (converge; checked on `main`: combat.ts autos, breakable, hitPart, lance, grab, bosses' open)

## Calls
1. **Trigger: the eye break.** A planted lance landing on `breakable(e)` runs the hand's own
   `interrupt(false)` + `interrupted(e)`: ~12 lines (an `eye` flag on the lance bolt, a check in `boltStep`).
   Enemy-caused, mirrors the hand, shatters cold (translator). Out: pin (a new status on every kind), steady
   (1.5 s ramp loses to the sentinel's 760 ms lock: rare by design), Patient planted-only (Still-caused).
2. **The eye: 8 flat when planted.** Only `lance()` changes (`EYE.damage = 8`; `shoot()` keeps 5). In
   reach the hand takes the auto, so a 5 u gate would only split the 3-5 u band, and invisibly. Knob 7-9.
3. **Close head: tag Signal Flare close.** It's a blue with the `any` gate, so tagging closes my dead cell.
   Rider: a hand break marks the broken enemy 4 s; the next *part* doubles on it (`hitPart` as today), never
   the hand (the lead's version changes the hand). Flare stays neutral, Coil is close; Glare if this fails take rates.
4. **Marksman arms: Piston as data (dmg 26 -> 20, shove 1.6 -> 4.0), Toss as is.** "Stance kept" is free:
   a cast doesn't lift `inStance`. At rest Toss already throws away from Still (L1665). Kickstand is out.
5. **8 riders, one per lean per slot, no new payoff parts.** Once the hook is in, a rider is one data line.
   At 2 per lean, three slots never pay. Grindstone and Flywheel need new clocks: backlog.
   Hand break: Signal Flare marks, Backdraft -3 s (icd 1.5 s), Parry Clamp and Skid Plates ready. Eye break:
   Patient full, Chill Vent, Toss, Spring Heels ready (ready/charge/mark icd 4 s). Own button only, no HP;
   a part-caused break (Parry, Toss, a push) fires nothing; a refund never clears heat or a push's +2.
6. **Bosses: the balancer's rule answers my R3.** The first hand or eye hit in each `open` window
   (Assembler stunned, Arbiter venting) fires that trigger, never `interrupt`; per-boss `openingSpent` resets on close.
7. **Match: build now, off.** `LEAN_MATCH = false` in `rollPicks`, simulated in dropsim. It turns on after
   3 plain-pedestal runs (pedestals are the economy change, eye + riders the combat one). Lean = most worn;
   tie = last tagged pick; nothing picked = one close, one marksman, one free (STARTING splits 2-2).
8. **Tags.** Close (12): Signal Flare, Coil, Backdraft, Brace, Cleaver, Hook, Parry, Frayed, Anvil, Kickstart,
   Skid, Overrun. Marksman (16): Focusing, Cracked, Ricochet, Patient, Through-Line, Pressure Vent, Ward,
   Chill, Mirror, Lure, Piston, Toss, Skitter, Frost, Spring, Plumb. None: Flare, Borrowed Time.

## Pass lines
- **leancheck:** at most one lean per part; an `any`-gate part per lean per slot; one rider per lean per
  slot; riders name `hand`/`eye`, act on their own slot only, and carry no HP or damage.
- **Headless:** a sentinel at 9 u, planted, no parts, 20 s: <= 1 of its shots lands (measure today first).
- **dropsim** (`--lean commit|drift|random`, match on/off): formation (2+ own riders at the Arbiter) >= 70%
  each lean, gap <= 10 pts; random <= 20%; all 4 own by the end <= 15%; each lean >= 0.5 offers a run per
  slot; no part > 2x its slot median; each slot 15-35% of picks; match on: a match in >= 90% of sets.
- **Log, 6+ runs** (ask him first): each worn rider fires 0.5-3 a fight (fail = rework the trigger); a part
  taken > 60% of >= 10 offers, or 0 of >= 6, is reworked; 3+ marksman runs: planted >= 30% of playS, eye >=
  35% of auto damage, Arbiter eye:hand >= 1:2, eye breaks 0.5-1.5x hand breaks; committed pushes >= 70% of
  mixed; strainOut within 25% of today; matched pedestal taken 40-65%.

## Build order
- **A, inert:** `abilities.ts` `lean?`, `rider?: {on:'hand'|'eye'; act:'cut'|'ready'|'charge'|'mark'; ms?;
  icdMs}`, tags, riders, Piston; `cards.ts` glyphs (card, compare, plaque, never HUD) and "On a break:" / "On
  a shootdown:"; `tools/leancheck.ts`; `dropsim --lean`; `playlog.ts` per depth breaks, openings, `plantedS`,
  damage by source, rider fires, plus pedestal sets and worn at each boss.
- **B, combat trial:** `combat.ts` `EYE.damage`, eye break, openings, `onTrigger(on, e, how)` beside `onHand`;
  `hud.cut(slot, ms)` clamps `readyAt`, never `hotUntil`; `main.ts` routes to worn riders, per-slot icd; `vfx`.
- **C:** match on after 3 pedestal runs. A+B ~2 evenings; the tuning is the hard part.

## Final design
- One lean per part (close 12, marksman 16, none 2). Tags switch nothing on; no set bonuses.
- The hand and the eye never change with what you wear; the planted eye goes to 8.
- Two enemy-caused triggers: the hand break, and the eye break (a planted shot lands in a breakable windup).
- The first hit in each boss opening fires the trigger; bosses stay unbreakable.
- 8 riders, one per lean per slot, own button only, icd-capped, no HP; part-caused breaks don't count.
- Close head: Signal Flare (a hand break marks). Marksman arms: Piston (20 dmg / 4.0 shove), Toss as is.
- No new parts. Glare, Grindstone, Flywheel and Kickstand are backlog, each tied to a failed line.
- Out: pin, steady, the 5 u gate, Patient's planted-only clock.
- Match: most-worn lean, ties to the last tagged pick, nothing picked gives a fork. Built now, on after 3 runs.
- Checks: leancheck, the headless sentinel, dropsim, the log. Order: A (inert), B (one combat trial), C (the match).
