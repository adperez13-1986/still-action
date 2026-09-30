# Autos, round 1: the balancer

Model: `node design/autos/autos-sim.mjs` (numbers from combat.ts, abilities.ts, temper.ts; CURVE9 Works-first, CV 0.5). Kill time × = 1 / (a·s + p·(1−s)): s the autos' share, a and p the autos' and parts' multipliers. HP lost ∝ kill time^0.8.

## 0. The 67% is a logging artefact

It sets autos from ~12 runs (13,094) against parts from **2** (6,405): partDmg began at 14:59 on 28 Sep. The two runs that log both:

| run | auto share by depth 1-6 | total | casts per fight-minute (upper bound) | dmg per cast | dmg per auto beat |
|---|---|---|---|---|---|
| 15:27, never-melt | 59 / 80 / 64 / 64 / 56 / 74 | **64%** | ≤28 | 18 | 9.5 |
| 14:59, investor | 47 / 34 / 30 / 42 / 16 / 49 | **34%** | ≤51 | 35 | 9.7 |

(Fight time ≥ auto beats × 0.62 s.) The autos carry only the player who doesn't grow, and everyone at depths 1-2.

## 1. Verdict: partly agree

**Strongest reason:** on a single body the free close strike (10 / 0.62 s = **16.1 DPS**) out-damages every white part, and ties the best of them at rank III.

| part | DPS at I | DPS at III |
|---|---|---|
| Scrap Cleaver | 6.9 | 15.4 |
| Piston | 6.7 | 14.8 |
| Focusing Lens | 6.2 | 13.8 |
| Pressure Vent | 2.3 | 5.1 |
| Kickstart | 1.5 | 3.3 |
| Overclocked Coil (gold) | 11.7 | 25.9 |

At white a press is worth two free beats (18 vs 9.5), so the never-melt run pressed ≤28 a fight-minute of a white cap of ~54. "Passive" is right; the cause is the auto's *price*, not its existence: free, never misses, blind to what he does. Removing it (B) costs more than it buys (§3).

## 2. What "active" means here

**Every press is worth enough that a ready button left idle is a loss, and the damage between presses comes from presses.** Not more buttons: the right thumb has four, and a fifth at 97 taps a minute is a 6-inch-screen tax. Not aim: E adds a decision, not a damage share. Growth stays in the parts, strain stays the price of pressing early, crowds stay the reason to press now.

## 3. The options, modelled

Each cell reads floor / median / investor. The finish rate is at 9 depths; CURVE9 today gives 31 / 74 / 91.

| option | crawl kill time × | boss kill time × | finish % | investor ÷ floor pack time at d5 (today 0.52) |
|---|---|---|---|---|
| A0 today | 1 / 1 / 1 | 1 / 1 / 1 | 31 / 74 / 91 | 0.52 |
| A1 autos ×0.5 | 1.48 / 1.32 / 1.19 | 1.36 / 1.24 / 1.14 | **6** / 52 / 84 | 0.38 |
| A2 autos ×0.5, part cooldowns ×0.7 | 1.21 / 1.02 / 0.89 | 1.07 / 0.93 / 0.83 | 20 / 77 / 95 | 0.34 |
| B0 no autos | 2.86 / 1.95 / 1.50 | 2.14 / 1.63 / 1.32 | **0** / 18 / 68 | 0.22 |
| B1 no autos, cooldowns ×0.35 | 1.00 / 0.68 / 0.52 | 0.75 / 0.57 / 0.46 | 46 / 96 / 100 | **0.22** |
| C pressed basic, 75% of beats hit | 1.25 / 1.21 / 1.17 | 1.22 / 1.19 / 1.16 | 13 / 58 / 84 | 0.48 |
| **D3 earned, 3 beats per press** | 1.17 / 1.00 / 1.00 | 1.14 / 1.00 / 1.00 | 18 / 74 / 91 | 0.44 |
| D3, floor presses 35 a minute | 0.92 / 1 / 1 | 0.89 / 1 / 1 | 42 / 74 / 91 | 0.57 |

- **A** can't reach 30% autos without breaking the floor player: every point cut is his kill time. A2 still costs a third of his finishes.
- **B1** needs Cleaver 0.9 s, Lens 1.5 s, Vent 2.3 s, Kickstart 2.8 s. Costs:
  - **The push dies**: it saves 0.5-1.4 s for +2 strain (1.3-4.0 s today). Pushes go to ~0, strain stops, Stopped is unreachable outside the Line. An invariant break.
  - **The spread doubles**: investor 4.5× the floor player's pace (1.9× today). CURVE9 redone.
  - **Six masteries and every rider go dead**; synergy loses its setters.
  - **Brace and windup breaks go**: defence the model doesn't count, so it flatters B.
- **C** is the auto with a thumb tax: a strict nerf at today's damage; at 1.33× per press it is a fifth part on a 0.62 s cooldown.
- **D3** leaves median and investor untouched (at ≥38 casts a minute 3 beats a press covers every beat). The floor player loses 17% *unless he presses*; at 35 a minute he beats today. Only D makes pressing the fix.

## 4. Proposal: D3, "follow-through"

Each cast or push adds 3 beats to a bank (cap 6), landed or not, so a whiff can't lock him out. Each auto beat (close strike or planted shot, unchanged: 10 / 8, breaks, shove, brace) spends one; empty bank, no auto. Bosses keep ×0.5.

| settled thing | what happens | cost |
|---|---|---|
| "Never dead time" | Broken on purpose. The never-melt pace loses ~22% of beats. | The rule becomes "never dead time while you're pressing". |
| Mastery, riders, states, leanings | Unchanged. The autos still set the states. | None |
| The push | Now worth a cast plus 3 beats (~18 + 28 at white, against 18 today). | Pushes rise, so strain rises. That's the direction CURVE9 §4 asked for, but the Stopped rate needs a check. |
| Pressure crowds, the curve | No change for the median player or the investor. The floor player's crawl kill time is ×1.17 at today's pace. | If he doesn't press more, cut white cooldowns ×0.85 (floor finish 25%). |
| Parry | No effect | None |

## 5. Smallest phone trial

- **Switch:** pause toggle "follow-through" beside "counters" and "parry catch"; off is today.
- **Run:** one never-melt run to depth 3. Notice: does he fire buttons as they come up; do the quiet gaps read as Still waiting for him, or as a bug?
- **Log:** `bankBeats` (spent), `emptyBeats` (would fire today, bank empty), `fightS` (an awake body within 8 u), so casts per fight-minute is measured, not bounded.
- **Pass:** casts per fight-minute ≥35 (today ≤28), `emptyBeats` <20% of beats, depth-1 hpLost ≤80.

## 6. Open questions

1. **The kill-time exponent** (0.8) is a guess. At 0.6-1.0, D3 gives the floor player a finish rate of 16-21%.
2. **The bank size** (3 per press, cap 6). At 2 per press the floor player's finish drops to 7%.
3. **Strain under D3.** The push is worth ~2.5× more, so the extra pushes per depth need logging against quiet −2.
