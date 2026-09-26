# Round 1: Balancer (systems and math)

Sources: `src/`, the 6 runs in `playtest.json`, a Monte Carlo of the drop code (20k runs, full wall).

## 1. Direction: systemic core, content as a multiplier (a specific hybrid)

**Decisions per run today** (26 min):

| decision | per run | real? |
|---|---|---|
| take/leave prompts (after the slots fill) | ~25 | ~2 touch the build you're chasing; ~23 are walk-pasts |
| shrines (0.75 a crawl level x 4) | ~3 | Plenty yes; Rest mostly obvious |
| warm beam, hook | 1 + 1 | yes |
| pushes (in-fight) | 7-23 | tactical, not run-shaping |

About **7 real decisions a run, one every ~4 minutes.** Target: one every 75-90 s, ~18-20.
**Combinatorics.** 8x7x7x8 = 3,136 loadouts (81 from the starting twelve). That number is
not depth: with role-locked, additive parts a loadout plays like the sum of 4 buttons, so the
learnable space is ~30 parts, not 3,136. Depth lives in the pairs: 337 cross-slot pairs, of
which ~25 interact by design (~7%), and half of those are "Signal Flare + anything that hits".

**Build agency.** Pick one of the 4 non-trivial identities (burner, cover, control, duel) at
the start and chase it:

| drop rule | chosen build (3 parts) by end | by the Assembler |
|---|---|---|
| today, take/leave | 28% | 9% |
| pick 1 of 3 at moments (elites, bosses, Plenty: ~9 a run) | 74% | 24% |
| moments x3 + leaning weight x3 | 92% | 32% |

(Pick-of-3 at every drop: 85%, +11 points for ~25 prompts a run, so moments only.) Today a build is
what fell. And the wall makes it worse: the chance a given blue appears in
a run falls from ~98% (starting twelve) to ~58% (wall full). **Every part added to the pool
lowers agency** unless drops can be steered. That's the core math reason systems come first.

**Lifetime model.** Distinct runs = novelty runs + ~1.5 x (steerable identities x roads) +
ladder runs. A cell (identity x road) is only playable on purpose if the build forms.

| direction | evenings | novelty | cells | ladder | runs | distinct hours | h per evening |
|---|---|---|---|---|---|---|---|
| today | 0 | 6 | 1.4 x 1 | 0 | ~8 | ~3.5 | |
| content (Line B+C, 4th area, boss per road) | ~35 | 16 | 1.4 x 3 | 0 | ~22 | 8-11 | ~0.2 |
| systemic (moves 1-6, 8 below) | ~13 | 10 | 4.4 x 1 | 23 | ~40 | 12-18 | ~1.1 |
| hybrid (systemic + the Line to stage B) | ~17 | 12 | 4.4 x 2 | 23 | ~48 | 16-22 | ~1.0 |

The Line alone buys ~1.5 h for its remaining ~10 evenings. After steering lands, stage B
alone (4 evenings) buys ~4 h, because a road multiplies identities instead of adding to
them. **Content earns 3-5x more once the build space is steerable.** Realistic target:
~20 h of distinct play, ~17-25 evenings. D2 volume at ~0.15-0.2 h an evening would need
~100+ evenings, mostly art and tuning, the slow resources.

**Mastery ladder.** 8 rule rungs; Home rate falling 62% to 20% across them: sum 1/p = ~23
runs, ~10 h. It's the biggest single number here, but it multiplies only what's under it:
if one build is always right, 23 runs are one build 23 times. Each rung should break one
identity (a quiet eases 1 hurts the burner; elites reading buttons hurt the duelist), so the
ladder forces rotation through the cells. Build it after steering, not before.

## 2. The moves, ranked

| # | move | cost | what the numbers say |
|---|---|---|---|
| 1 | **Pick 1 of 3 at moments** (elite, boss, Plenty); cut `packPayout` 0.66 to ~0.45 | cheap (1.5) | chosen build 28% to 74%; parts seen per run 27 to ~39 with fewer floor beams |
| 2 | **Leanings as drop weight**: the tags (variety step 6) weight drops x2-3 toward what you wear | cheap (0.5 on top of tags) | undoes wall dilution; 74% to ~85-92%. Tune to 65-80%: always getting it is also no choice |
| 3 | **Push the drop** (the surprising one, section 4) | cheap-medium (1 + tuning) | ties choice to strain; Stopped reachable by wanting, not just fighting |
| 4 | **Four states as the interaction grammar**: marked, chilled, pinned (on a wall), pulled. Every part applies one or reads one, as a rule not a % | medium (3) | designed pairs ~25 to ~50 of 337 (7% to 15%). Past ~20% it's noise on a phone |
| 5 | **The rule ladder**, 8 rungs, each one breaks an identity, all strain or rule, never HP | medium (3-4) | +~23 runs, ~10 h; rung marked on the card |
| 6 | **Champions that ask for answers** (stacked modifiers, Mirrored) | medium (3) | makes identity a choice about which problems you accept |
| 7 | **The Line to stage B** (crossroads, a second road, Arbiter as its boss) | medium-big (4) | roads 1 to 2 doubles the cells: ~+4 h |
| 8 | **Per-part offered / kept / carried-to-Home counts** in `playtest.json` | cheap (0.5) | no part kept under 10% or over 60% of offers; Cleaver question answered |

## 3. Stop, or don't build

- New areas, bosses or families before moves 1-2. Each adds to a space the player can't steer.
- Growing the pool past 30 before leanings weight drops (each part dilutes every other).
- The Engine (stage C, 5 evenings) until the ladder exists: a third boss is 1 cell, not x2.
- Set bonuses (81% accidental, round agreed), stat affixes, bigger-number rungs.
- Tuning without move 8. Six designer runs (5 Home, 1 Stopped, 0 Broken) can't set odds.
- Seeded runs as a replay feature: ~0 distinct hours for one player (fine later as the ladder's retry).

## 4. The surprising one: push the drop (strain buys choice)

Hold on a part on the floor, the same gesture as a push: it rerolls into another part **for
the same slot**, +2 strain. This is the only place in the game a thing you *want* costs the
run's resource, and it's the Still lineage's Growth vs Comfort made physical: take what fell
(comfort) or strain for what you want (growth). Moth and flame stays, since a slot still
holds one part.

It needs one rule or it's free (quiets refund 2 a fight, so a reroll just eats the free
push): **want strain is ember on the bar; quiets never ease it, only Rest.**

| player | rerolls a run | carried into the Arbiter | Arbiter pushes before Stopped |
|---|---|---|---|
| saver | 0 | ~4-6 (today's floor) | ~7 |
| chooser | 3 | ~10-12 | ~4 |
| greedy | 5+ | ~14-16 | ~2 |

Stopped becomes the outcome of wanting too much, not of a bad fight: the lineage's middle
ending exactly. Sim: 4 rerolls lift chosen builds 28% to 34% alone, 92% to 95% on top of
moves 1-2: a finisher, not a crutch. The warm beam gains a strain reason (greedy at 14 goes
home). Flag: "no currency" is about the meta; strain is spent inside a run. Yours to confirm.

## Economy changes, in one list

| knob | now | proposed | why |
|---|---|---|---|
| `packPayout` | 0.66 | ~0.45 | pedestals replace floor clutter; offers seen still rise |
| pedestal moments | 0 | ~9 a run, 3 parts, pick 1 | 28% to 74% chosen build |
| leaning weight | none | x2-3 | counters wall dilution (58% seen at full wall) |
| want strain | none | +2 a reroll, quiet-proof | Growth vs Comfort on the bar |
| intended outcomes, rung 0 | 5/1/0 of 6 | Home 60-70%, Broken 15-25%, Stopped 10-15% | spenders Stopped 15-25%, savers 0-5% |

Open for playtest: leaning weight (65-80% chosen), want strain 2 or 3, 7 vs 9 pedestals.

## Recommendation

**Systemic core, content as a multiplier.** Systems buy ~1 h of distinct play per evening,
content ~0.2 until builds are steerable, then ~1. First three moves:
1. **Pick 1 of 3 at moments**, with `packPayout` to ~0.45 and move 8's counters.
2. **Leanings as drop weight** (ship with the tags).
3. **Push the drop** with quiet-proof want strain, then measure Stopped rates before the ladder.
