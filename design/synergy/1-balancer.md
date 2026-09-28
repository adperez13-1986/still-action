# Round 1: the balancer

28 Sep 2026. Numbers come from a scratch sim of one fight (1,000-3,000 runs), using the real numbers from `abilities.ts` and `temper.ts`, the hand at 10 per 0.62 s, and depth-5 HP from CURVE.md (pack 36/24/36/10, heavy 105, Arbiter 1170). The auto/part split is still unknown, so there are two calibrations: **A**, where the autos carry (parts do 36% of damage), and **B**, where openers carry (parts ~60%). In both a pack dies in about 4 s, close to the logged 2.5-3.5 s. Tables show B. A is about half of B throughout.

## What the model says first

1. **A crawl fight (~4 s) is shorter than a setter's cooldown** (5-8 s). A state set by a part lands about once a fight, and the payer catches it 0.2-0.9 times. On packs, overkill eats most of any multiplier.
2. **Pairs pay on heavies. Ranks pay everywhere.** Bosses don't take slows, walls or pulls, so three of the four states are worth **0 on a boss**, the place where 5 of his 7 Broke runs ended.
3. **When the payer is pushed into the state, the gain comes from the push.** Pushed into the state: +17-40%. The same pushes with no payoff: +16-35%. So the state's job is to say *when* to push, which is the strain demand DESIGN asks for.
4. **A state set by a mastery reaches rank III.** Cold Strike and Marking Strike set the state on every hand hit, so one x2 payer gains +15-24% on a heavy and +17% on a boss (mark). That's how melting leads into a pair.
5. **Today's Marking Strike is the strongest thing in the game.** Every part pays off its mark: +32% on a heavy, +29% on a boss. That's two thirds of *all four parts at III* (+36-39%). Narrow it to payers.
6. **A swap doesn't cost a full reset today.** `takePart` drops the old part at his feet, and he can melt it into the new one. So **a swap already lands at II from any rank.**

## 1. The states

| State | Set for | Payer gets | Consumed | Boss | Stacks |
|---|---|---|---|---|---|
| **Chilled** | nova 3 s; Frost Trail +1.5 s off the strip; Cold Strike/Shot 1.5 s | x1.5 | no | **new:** takes it for payers, never the slow | refresh |
| **Marked** | Signal Flare 4 s; Marking Strike/Shot 3 s | x2 | by the first **payer** hit | yes | refresh |
| **Slammed** | 2 s after a wall hit (shove, or a throw cut short) | x2 | yes | **new:** the Assembler's charge into a wall slams it for its opening | refresh |
| **Clumped** | 2 s once 2+ bodies end a pull within 2 u of each other | an area payer reaches every clumped body (Vent: x1.5) | no | no | refresh |

As rule 3 says: one multiplier per hit, the larger wins, cap x2. A state never shoves and never heals.

## 2. Setters and payers

| Slot | Setters | Payers (card line) |
|---|---|---|
| Head | **Signal Flare** marks (**damage 4 → 12**) | **Focusing Lens** "A slammed enemy takes it twice." **Flare** "Lands on a clump: catches every body in it." **Cracked Lens** "Chilled enemies it passes through take half again." **Patient Lens** "A marked enemy takes the shot twice." |
| Torso | **Chill Vent** chills. **Backdraft** and **Lure** (on its burst) clump. **Pressure Vent** slams whatever it shoves into a wall. | **Pressure Vent** "A clump takes half again." |
| Arms | **Piston** and **Clamp Toss** slam on a wall hit. **Rusted Hook** clumps when it yanks two. | **Scrap Cleaver** "Cuts chilled enemies for half again." **Parry Clamp** "Hits a marked enemy twice." **Clamp Toss** "A chilled enemy thrown into a wall takes the wall hit twice." |
| Legs | **Frost Trail** chills. | **Kickstart** "Runs over a slammed enemy twice." **Skid Plates** "The landing blast reaches every clumped body." **Overrun** "The pushed charge hits marked enemies twice." **Spring Heels** "Lands on a slammed enemy for 16." (the only new number) |

**Neither (11):** Ricochet, Through-Line, Overclocked Coil, Ward, Brace, Mirror Ward (already flagged as an always-take), Frayed Cleaver, Anvil, Skitter, Plumb Line, Borrowed Time. That makes 9 setters and 12 payers. Vent and Toss are both, never on their own state. Every slot has at least one setter and one payer.

**Setter rule:** a setter's own hit should be at least ~0.8 of its slot's white. At 4 damage, Signal Flare is a trap: −17% on packs and −21% on heavies against the Lens it replaces. At 12 it's +3% on packs and −8% on heavies.

## 3. Melt vs synergy

How much faster one slot kills, against the same parts with no payoff:

| One slot | Pack | Heavy | Boss |
|---|---|---|---|
| Payer II | +1-9% | +6-14% | +8-9% |
| Payer III | +5-26% | +17-23% | +16-18% |
| Pair I/I, part-set state | 0-6% | **+6-10%** | 0 (chilled, slammed, clumped) |
| Pair, payer II | +7-12% | +12-20% | +8% |
| Pair I/I, mastery-set state, x2 | 0-3% | +15-24% | +17% (mark) |

A pair set by parts is worth **about one rank (the II-to-III gap), on heavies only**, until states land on bosses.

**The choice at a floor part that completes a pair** (the slot is at rank r now):

| r | Melt | Swap (old part melted in) | Verdict |
|---|---|---|---|
| I | II | payer II + pair | swap; nothing to lose yet |
| II | III (+17-23% on a heavy) | II + pair (+12-20%) | **the real choice.** A boss ahead says melt; a depth full of heavies says swap |
| III | III + a mastery | II + pair | melt, unless that mastery would set this payer's state |

**The price:** keep **"a swap lands at II"**. Put it on the card ("take: Piston II") and have the old part melt in automatically. Today it takes a floor dance he may never find. Keeping half the rank *and* melting the old part in (III → II → III) makes a swap at III free, which kills the choice. A true full reset (payer at I, +6-10%) loses to melting at rank II and up. The investor averages rank 2.35 by depth 3, so swaps would die mid-run.

**Stopped:** pushing payers into states adds 0.4-1.2 pushes a pack and 0.9-2.4 a heavy. A quiet refunds 2 strain, so one pair (~1.4 strain a fight) stays inside the free push. Two pairs (~1.4 pushes a fight) net about +0.8 strain a fight, about +25 over ~31 fights before the quiet floor. **Two pairs is where Stopped becomes reachable**, which is Growth vs Comfort: the pair-pusher spends strain, the melter keeps it.

## 4. Leanings

Share of all 3,136 loadouts with at least one completed pair:

| Loadout | Without Spring and Toss paying | With them (§2) |
|---|---|---|
| Random | 28% | 34% |
| 3+ close / 3+ marksman | 37% / 26% | 37% / 40% |
| 4 close / 4 marksman | 48% / 28% | 48% / 57% |
| Random + Cold Strike + Marking Strike | | 73% |

With those two marksman payers, **a lean is where your pairs live**: close gets clumped and marked, marksman gets slammed and chilled. Cold Strike and Marking Strike work across both leans, so mixing stays valid. With `LEAN_MATCH` on, a lean then means "more pair offers" instead of a set bonus. The lift (+3-6 points at 3+, +14-23 at 4) is modest, and it should be.

## 5. Three steps

1. **Narrow the mark, and land swaps at II.** `hitPart` doubles and uses up a mark only for payer parts (Patient, Parry, Overrun). Signal Flare goes to 12. `takePart` sets `ranks[slot] = 2` on a replace and drops nothing. Log `paid` per part and `pushedIntoState`. Pass: Marking Strike's share of boss damage falls, and swaps from II are taken 30-70% of the time.
2. **Chilled, with bosses taking states.** `applySlow` and `rime` exist already. Add the payer multiplier (Cracked, Cleaver, Toss) and a boss chill with no slow. Pass: at least 1 paid hit per heavy in a chill run.
3. **Slammed, then clumped.** Add a wall-hit flag where `landThrow` and the shoves already test walls, and a clump test after a pull. Pass: two-pair runs log at least 1 push a fight and strain of 8+ at the Arbiter.

**Needs play to lock:** the auto/part split (A vs B halves every number); how often a shove meets a wall (0.45 is a guess); whether heavies at 1.25-1.75x HP make pairs pay; how the quiet floor changes the +25 strain estimate.
