# Lean on the parts, round 2: balancer

`node design/lean/lean-sim.mjs r2` (15 s). New in the sim:
- bodies a pack;
- body-seconds (alive bodies x seconds), a proxy for damage taken;
- a strain retune grid;
- a hitstop budget.

The enemies are my round-1 pick throughout.

## (a) Tap-push and the strain clock

Results are Broke/Stopped/Made it, for never-melt | median | investor.

| V4 | pushes a fight | result | median Stopped by d3 |
|---|---|---|---|
| V0 today (target) | 0.48 | 62/6/31 \| 20/6/74 \| 5/7/88 | 5% |
| x1.25, unchanged | 0.61 | median 17/18/65 | 16% |
| x1.5, unchanged | 0.75 | 49/27/24 \| 16/28/56 \| 4/29/66 | 24% |
| x1.5, quiet -3, or cap 24 | 0.74 | median 17/20/63 | 17-19% |
| x1.5, Rest -8, or floor .35 | 0.75 | median 16/28/56 (no effect) | 24% |
| **x1.5, cap 24 + first push a fight free** | 0.72 | **59/11/31 \| 19/11/70 \| 5/10/85** | 10% |
| x2, cap 26 + first push free | 0.99 | median 17/20/63 | 20% |

- **Rest and the floor are the wrong levers.** 77-97% of Stopped happens inside a boss fight, where only the cap and the price matter.
- **The retune is cap 24 plus a free first push each fight.** It stays in whole numbers, so the save and the pips survive. It makes DESIGN.md's "one push a fight is effectively free" literal. Stopped rises 6 to 11%, 92% of it at bosses: reachable, as intended.
- **Trial with strain unchanged? Safe for one run to d3, not for nine depths.** At x1.25-1.5 he Stops at the Assembler 16-24% of the time, which is the ending working. A free push would also blur the push rate we need to measure. Build the retune behind the same switch, and turn it on before a 9-depth run if pushes go above 0.6 a fight.

## (b) Bodies a pack: no, neither instead of HP nor alongside it

Figures are never-melt / investor.

| | d1-2 pack time | body-s | part kills | finish never-melt, by kill time \| by body-s |
|---|---|---|---|---|
| 4 bodies, HP x1.25 (pick) | 1.01 / 0.87 | 1.03 / 0.90 | 45 / 70% | 34 \| 32 |
| 5 bodies, HP x1 (same total) | 1.06 / 0.94 | 1.23 / 1.07 | 48 / 89% | 34 \| 22 |
| 6 bodies, HP x1 | 1.21 / 1.03 | 1.65 / 1.38 | 48 / 89% | 27 \| 8 |

- **His part kills move 3 points.** His casts are capped by hesitation, not by targets.
- **The investor's jump is a breakpoint.** His Cleaver (32) one-shots a 30-HP body.
- **The extra body is exposure.** On body-seconds, the never-melt finish falls from 32 to 22.

Keep HP as the dial. At 1.01 at d1-2, the pick needs no d1-2 exemption: there I disagree with the verifier.

## (c) One hitstop formula

**Contact only, never on a whiff:** ms = min(100, 30 + 6 x cooldown s + 10 x (bodies struck - 1)).
- Kills: 90 ms for a part kill, 35 for an auto kill.
- Auto hits: 0 (today 22; the sparks and the sound stay).
- The freeze is global, via `Math.max(hitstop, x)` as today. A freeze that starts within 200 ms of the last one's end adds only its excess.
- Moves freeze at the landing, if they struck.

The body count is the translator's; the cooldown term is mine.

| contact ms | 1 body | 3 bodies | 5 bodies |
|---|---|---|---|
| Cleaver | 46 | 66 | 86 |
| Lens | 55 | 75 | 95 |
| Vent | 69 | 89 | 100 |
| Kickstart | 78 | 98 | 100 |

**Budget:** packs are frozen 4% / 7% of the time (live today 7% / 9%), bosses 2-3%. About 77% of the freeze is now the parts'. Keeping the 22 ms auto beat brings it back to 6% / 9%.

## Changed / disagree

- **Changed:**
  - the queue window, to the verifier's 300 ms (from my 400): his dead taps cluster under 250 ms;
  - I take the translator's mash guard;
  - I drop my cooldown-only formula (30 + 8 x cooldown, on every cast): five bodies struck must read bigger than one.
- **Disagree:**
  - with Claude's round-1 "bodies instead of HP": it adds exposure and does nothing for the floor;
  - with the translator's 50 ms base: a lone Cleaver every 2.6 s needs 46 at most.
