# Round 2: the balancer

## The free autos: (a), then (c), with (b) as the dial

**I switch to the translator's (a): the autos stop breaking.** My 3 s poise misses my own target.
After a hand break the hulk closes again and rewinds in about 0.6-1 s (a guess from `interrupt(false)`
plus the 0.5 u shove), so a 3 s poise still breaks 1 in 3-4 windups, about 25-35%, and he can't see
why one breaks and the next doesn't. (a) is a rule he can learn, and it makes a clean log: free breaks
go to 0, and whatever pushes do then is the real demand. The hand keeps 16 DPS against 0 while walking
at range, so close still pays and kiting shouldn't come back. **Poise becomes the dial** if kiting or
Broke at the Assembler spikes.

**(c), the verifier's, goes on top, in two halves:**
- **Prime, yes.** It's M2 in one field: a rider changes what a push does and never sells "fire now".
  I withdraw my "a pushed break gets its button back". A full ready is still the push's product.
  Use both: **the trigger is a pushed break** (the translator's and mine, since under (a) the autos
  make none), **the act is prime** (the verifier's). The loop costs 2 strain at every step, so it
  feeds Stopped instead of starving it. Remove Patient Lens's rider now (verifier), agreed.
- **Quiet at 1/4, yes, after `hpLost` is logged.** The maths: with a loss L a fight, the steady HP
  deficit is L at 1/2 heal and 3L at 1/4 (M = 0.75(M + L)). At L = 10 that's 70 HP going into a
  pack, not 90, and a push that ends a fight 0.7 s earlier starts to be worth HP. It's the verifier's
  missing lesson (the enemy curve, not the relics), and it doesn't touch the bosses: HP is full at
  each depth, and he dies at the Assembler.

Order: (a) plus prime-on-pushed-break together (one combat trial), then the quiet dial.

## Rule 7 and the dropped "or"

**The verifier is right, and I change my verdict from "keep, extend" to rewrite:** *"Offence and
defence from one source only through an enemy action and a press (Anvil's catch, a parry, a pushed
break). Nothing free does both."* Restoring the "or" keeps Anvil and Mirror Ward legal. My extension
still stands for the free part: the autos did both, and that's why (a) is right.

## Other verdicts I changed

- **Rule 4: keep -> rewrite**, with the translator's wording ("changes where you stand or when you
  press"). The verifier is right that dropsim scores parts by tag, so it can't measure opinion.
- **Rule 6: keep -> rewrite**, as the verifier's (read first; gifts and golds excluded). Anvil 7/7 is
  a boss gift, and the 78% was a bot's.
- **Rule 8:** I withdraw my 98% as evidence. It's circular, because the bot is built to commit.
- **Rule 9: rewrite -> keep**, and add my check (takes a depth >= 0.5 at depths 4-5). My low d4/d5
  takes come from 9 mostly pre-pedestal runs.
- **Change 3: my "caller" -> the translator's counter-moves.** Under (a), "autos can't break this
  pack" is moot, and "the band is safe forever" is the sharper diagnosis of observation 2.

## Where I still disagree

- **Claude, rule 3 ("two may multiply"):** one multiplier, the larger, is the same power in practice
  (x2 over x1.5 open) and it's one function and one test (the verifier's check).
- **Claude, "a hand break makes the next push cost 1":** it's a strain refund, so it moves the Stopped
  threshold. Prime spends time, not strain, and leaves the +2 whole.
- **The translator's M5 (autos under 45% of damage):** keep it, but the log has no part damage.
  Add `partDmg` next to `autoDmg` before it's a pass line.
- **The verifier's M1 target (Arbiter strain >= 8):** fine. Under (a) + prime, 4-6 boss pushes put
  a spender at ~16-20 by the Arbiter, so Stopped is ~10-20% for spenders and ~0% for savers (a guess
  until the log has a run of it).
