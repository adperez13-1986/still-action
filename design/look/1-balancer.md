# The look: balancer

2 Oct 2026. What rank escalation may claim (it must not overclaim), what fits on screen in a deep pack, and the phone's budget. Sources:
temper.ts, cores.ts (K), abilities.ts (cooldowns), curve.ts + dungeon.ts (packs), vfx.ts / partfx.ts / markfx.ts / still.ts (costs),
weight.ts (freeze), perf.ts / world.ts (buffer), buildlayer/3-balancer.md (peers, melt counts), lean/TRIAL-1.md (fight times).

**Live table: TEMPER_FLAT.** Every live run picks a core at run start (B4), so the 1.3 / 1.6 table only shows with builds off or on an
old resumed run. Design to the flat table.

## 1. The power read

### 1.1 What a rank really changes (rank I = 1)

| quantity | II | III | applies to |
|---|---|---|---|
| damage per hit | 1.15 | 1.30 | every part with damage |
| casts a second (1 / cooldown) | 1.087 | 1.176 | every part |
| part DPS, one target | 1.25 | **1.53** | bolt, grab, anchor, dash, arc on one body |
| reach (radius / cone) | 1.15 | 1.30 | nova, ward, lob, decoy radius; arc cone; slam radius, strip width, fray cones |
| hit area | 1.32 | 1.69 | the same |
| DPS on a pack, area shapes (hits ~ 1 + 0.5 x (area - 1), part-saturated) | 1.45 | **2.06** | nova, lob, decoy, wide arcs |
| held window | 1.15 | 1.30 | ward, catch, brace |
| cooldown only, nothing else | 1.087 | 1.176 | **hop, vault, rewind** (damage 0) |
| a cored hit with 2 marks (base 20, K 6), DPS | 1.19 | 1.40 | the mark's +K is flat, never scaled |
| bare table (builds off), DPS one target / pack area | 1.53 / 1.77 | 2.22 / 3.0 | old runs only |

Compare the spend, the build's own number (K flat per mark, cores.ts):

| a rank-I hit of 20 | 1 mark | 2 marks | 3 marks |
|---|---|---|---|
| Wake (K 6) | 1.30 | 1.60 | **1.90** |
| Ram (K 8) | 1.40 | 1.80 | **2.20** |
| Cleaver under Wake (Fit.k 3, base 22) | 1.14 | 1.27 | 1.41 |

**Read:** in the live game the biggest per-hit jump is a 3-mark spend (x1.4-2.2), not a III (x1.3). The biggest per-second jump is an
area III on a pack (x2.06). A single-target III is x1.53 a second, and a III hop or rewind is just 15% sooner.

### 1.2 Honesty rules (proposed)

| # | rule | number |
|---|---|---|
| H1 | **Magnitude per cast tracks damage per hit.** Magnitude = peak brightness x particle count x the flourish's screen area. The rate rises on its own because casts come sooner, so per second the visual mass lands near DPS without help. | I 1.0 / II <= 1.15 / III <= 1.30 |
| H2 | **Area shapes draw their true reach, and nothing else of theirs grows.** The ring or cone is the hitbox to the pixel. That spends their whole magnitude budget (area x1.69 is already above damage x1.3); brightness and count stay at x1.0. | nova III r 4.3 -> 5.6 u; Cleaver 180 deg -> 234 deg |
| H3 | **Cooldown-only parts (hop, vault, rewind) get no magnitude growth at all.** Their rank shows only on the button refill and in categorical cues. | magnitude x1.0 at III |
| H4 | **Rank's identity comes from channels that say which rank, not how much**: material (glow -> molten -> fractured), timing shape, the kind of secondary motion, a sound layer, a mark on Still's body. These can be as distinct as he likes without lying. | recognisable with sound off, at px 1.0 |
| H5 | **A spend's magnitude scales with the marks it spends**, and it may be the loudest thing Still does. | 1 / 2 / 3 marks -> x1.3 / x1.6 / x1.9 (Ram x2.2) |
| H6 | **Cooldown is shown where it's true**: the button's refill and how often casts come, never as a field effect. | |
| H7 | **Zero gameplay ms.** A wind-up must not delay the hit or move a window (Parry, Catch, Anvil). Any anticipation lives in the existing press-to-release time (the cocked pose: arc 0.3, nova 0.25 of its pose) or plays over the release. | see the table below |
| H8 | **Freeze stays rank-blind.** weight.ts keys it to the rank-I cooldown (`baseCooldownS`) on purpose. TRIAL-1 measured freeze at 3-10% of fight time against a <= 10% line, so it has no room left. | |

What a 100 ms delay at release would cost a III (H7), as DPS:

| part (III flat cd) | Overclocked Coil 1.02 s | Cleaver 2.21 s | Cracked Lens 3.91 s | nova 5.53 s |
|---|---|---|---|---|
| loss | -9% (III at 1.39, only 0.14 above II) | -4.3% | -2.5% | -1.8% |

A dramatic wind-up hurts the fastest parts most, and those are the ones a melter ranks first.

**Perception check.** In a moving fight, a size or brightness change under ~20% is near invisible on its own. So H1's x1.15 / x1.3 can't
carry rank, and it doesn't have to: H4 carries it. The math agrees with his "not just bigger": the honest size changes are too small to
read except on area shapes, and there they're true.

## 2. The clutter budget at d6-d9

**Inputs.** Pack = 2-3 + budget 2 + big 1 = **4-6 body-equivalents**. That's 4-6 bodies, or **10-13 with a brood** (M8 = 2 BE; shrink to
M6). Three elite packs a level. Fight about **7 s** (3-balancer: 6.8-7.3 s for a c3 pack; brief 5-8). Four slots. Utilisation 0.85.
A melter is at III in all four slots from about d4-5 (section 4), so the deep budget is set at **all-four-III, flat**.

| loadout (rank-I cd) | III cd | casts/s at I | casts/s at III | casts per 7 s fight |
|---|---|---|---|---|
| median: bolt 4.2 / Cleaver 2.6 / nova 6.5 / dash 8.0 | x0.85 | 0.77 | 0.90 | 6.3 |
| fast: Overclocked Coil 1.2 / Frayed Cleaver 2.6 / Skitter 3.2 / nova 6.5 | x0.85 | 1.43 | 1.68 | 11.8 |

Live effects on screen at once, N = rate x lifetime:

| layer | life | median III, 5 bodies | fast III, 5 bodies | fast III, brood (11) |
|---|---|---|---|---|
| release burst (flash + sparks) | 0.35 s | 0.3 | 0.6 | 0.6 |
| follow-through (today ~1 s of dust/smoke/trail) | 1.0 s | 0.9 | 1.7 | 1.7 |
| hit bursts (2.5 / 3 / 5 bodies a cast) | 0.3 s | 0.7 | 1.5 | 2.5 |
| autos (1.6/s, ~0.6 in range) | 0.25 s | 0.2 | 0.2 | 0.2 |
| kill bursts (5 or 11 kills / 7 s) | 0.7 s | 0.5 | 0.5 | 1.1 |
| **Still-side transients** | | **2.6** | **4.5** | **6.1** |
| mark rings (Wake 0.6 skims/body/s, life 3 s: nearly every body) | held | ~4 | ~4 | ~9 |
| **enemy tells live** (~0.25 per awake body) | | 1.3 | 1.3 | 2.8 |

So **Still's transients outnumber live tells about 2-3.5 to 1** before any rank drama is added. Follow-through is the biggest layer,
and on a fast loadout it grows with rank (cooldown x0.85 means 1.18x as many). The budget that fixes this:

| # | rule | effect |
|---|---|---|
| C1 | **A part's follow-through lasts <= 25% of its own cooldown at its rank** (cap 1.0 s). | Little's law: each slot holds <= 0.25 of a residue at any rank, so all four hold <= 1.0. Fast III: 1.7 -> 0.8. A rank shortens its own residue, so III never piles up. |
| C2 | Per cast, particles <= **40 / 46 / 52** (I / II / III); today's loudest Still cast spawns ~58 (2 flashes + 34 sparks + 18 dust + 4 chunks). | H1 at x1.3 |
| C3 | Release flash peak <= **4% of the screen** at III (today: a size-1.4 glow grows to ~3.5 u, ~1.5% of the buffer). | |
| C4 | A floor mark (scorch, frost, crack) stays **inside the true hit area**, laid over the floor with the dark rim (the markfx rule), alpha <= 0.6, life under C1. | honest area; no peach wash |
| C5 | **Crowd rule.** With 2+ Still flourishes live, or a locked tell (`TELL_CROWD.locked`) within 2 u of the footprint, a flourish plays its rank-I magnitude (counts and alpha x0.5). Categorical cues (material, body mark) stay. | the same kind of rule as CROWD 5, MOTES_MAX 12, the 1/sqrt(n) hit flash |
| C6 | **Priority when they compete:** enemy tell > mark ring / spend > hit burst > rank flourish > follow-through. | building's read beats rank's |

With C1 + C5: Still-side transients are ~1.9 (median) / ~3.4 (brood), about 1.2-1.5 to 1 against tells. Every tell still has its own
clear ground.

**Pixel scale for the cues (H4).** His Poco in landscape is 915 x 412 CSS. At px 1.5 the buffer is 1372 x 618 (0.85 MP); the view is
17 u tall, so **36 px/u** (24 px/u at px 1.0, where adaptive lands). Still is ~1.9 u, about 46-69 px. The ~6 px floor is **0.25 u at
px 1.0**, so any rank cue (a body mark, a fracture line, debris) needs to be at least 0.25 u, designed at px 1.0.

## 3. The perf budget (Poco F8 Pro, 60 fps)

**Assumed GPU: Snapdragon 8 Elite class. Verify with `?perf=1`.** At 0.85 MP, fill is not what binds. What binds is the main thread
(draw calls, the JS particle loops, attribute uploads) and heat (perf.ts: long fights cook the phone, and adaptive then drops the buffer).

| frame item (16.7 ms) | budget |
|---|---|
| sim + combat + AI | <= 5 ms |
| render submit (three.js -> ANGLE), ~12-20 us a call | <= 6 ms -> **<= 300-500 calls** |
| vfx update (3 pools + debris) | <= 0.7 ms |
| GPU (parallel) | <= 10 ms |
| headroom | >= 3 ms |

**Draw calls.** Idle d1 on a production build: 44. Big arenas headless: 490-750, which is already at or over the submit budget before any
look work. The look layer adds:

| | budget | how |
|---|---|---|
| steady (fixed objects) | **+12** | one shared mesh or instanced set per shape family (<= 6), rank as a uniform, plus at most one more Points pool |
| peak (one frame, mid-fight) | **+25** | no per-cast `new Mesh` or material past 2 live a cast (today: beams, landing rings, tethers each add a call) |
| per body | **0** | never per-body meshes for rank (the badges are 6 meshes a marked body today: 3 brackets x 2 bars) |

**Fund it first.** A dash or hop trail today is GHOST_LIFE 0.26 / GHOST_EVERY 0.03, so ~9 ghosts x ~15 Still meshes = **~130 calls for
every dash**. parts/4-appearance.md measured 280 -> 100-135 for this. Instancing or merging the ghost frees ~100 calls: about 4x the rank
layer's peak. I'd do it before or with the first slice.

**Particles.** Pools: glow 1800, smoke 700, hot 480 (lazy), debris 260. Each is one call. The measured load is far below that:

| alive at once | median deep, III | brood deep, fast III | line |
|---|---|---|---|
| glow (sparks, flashes, embers) | ~100 | ~200 | <= 900 (50%): the ring buffer evicts the oldest, enemy embers included |
| smoke / dust | ~40 | ~90 | <= 350 |
| debris chunks | ~10 | ~30 | <= 130 |
| Still-side spawn rate | ~50/s | ~120/s | <= 150/s |

**Don't raise the caps.** `Pool.update` walks every slot and re-uploads all five attributes each frame, used or not: 2,980 slots x 9
floats = ~107 KB a frame, ~6.4 MB/s. The glow pool is ~9x what's used, so there's a later perf win in uploading only the live range.

**Overdraw.** The cost is sprite size, not count. A dust burst (10-18 sprites growing to 2-3 u, ~6k px^2 each) covers 7-13% of the screen
for ~1 s, while a spark covers ~0.01%. Base frame ≈ scene 1.5-2.0 + bloom chain ~1.2 (half-res) + output 1.0 ≈ **4 full-screen
equivalents**. Look budget: Still's transient sprites **<= +0.25 screens averaged over a fight, <= +0.6 at a peak frame**. That means
III swaps dust for sparks and hard shards, never for more smoke.

**Shader compile.** Rank tiers go in as uniforms on shared, prewarmed materials, never as a `#define` or a new material. An Android
compile costs 20-150 ms (1-9 frames), and the first III flourish would hitch on the payoff (the known first-cast hitch, now on the best
frame).

**The phone check (his):** d8 big room, a brood pack, all four III, the fast loadout, `?perf=1`, after 10 min of play. Pass: px stays
1.5 (level 1/3), fps >= 57, calls <= that room's bare count + 25. Adaptive steps down after 3 s under 50 fps. A 7 s fight at 48 fps drops
the buffer mid-fight, and it waits 20 s of calm to come back.

## 4. What rank escalation does to how upgrades are valued

| # | finding | number | proposal |
|---|---|---|---|
| V1 | **III is the baseline, not the peak.** A melter melts ~16 times a run and needs 8 to put all four slots at III, so that happens by about d4-5 of 9. | III covers ~55-65% of a melter's fight time | III's look must hold up when it's the normal look. The single big beat goes on the **rank-up moment** (~16 a run, about 1 every 1-2 min), not on every cast |
| V2 | **Melting already leads building on packs.** All four III flat vs c3 + keystone: Wake +25 vs +20 packs, +32 vs +15 bosses; Ram +24 vs +17 packs, +31 vs +35 bosses. | 5-7 points ahead on packs | A louder III widens the felt gap. Give the spend H5's magnitude (x1.9-2.2 at 3 marks, which is true) and the keystone a categorical signature. **The loudest single moment in a fight should be a 3-mark spend or a keystone, not a III cast** |
| V3 | **Rank I is the never-melt run's whole run** (his 29 Sep call; floor 11-18%), and a core player sees no melt past III until d7 upgrades. | | Raise rank I first. His "too basic" is about today's look, which is all rank I. If only III improves, the look taxes never-melt and building |
| V4 | **The swap drops to II** (`swapRank` 2: a swap from II or III lands at II and uses up the old part). | | II must be complete and different in kind, not "III minus". Then a late swap reads as a trade (moth and flame), not a visual downgrade that stops swaps |
| V5 | **Area shapes really do gain more on packs** (x2.06 vs x1.53), and H2 shows it truthfully. On a boss (one body) all shapes are x1.53. | | Fine as is: the look matches the numbers, and the boss ring shows the same reach |
| V6 | **The bare table understates** (III x2.22 with builds off, same visuals). | | Accept: under-claiming is fine, over-claiming is not |
| V7 | **Hop, vault and rewind gain only cooldown.** A dramatic III on them would make movement parts look like damage parts. | x1.176 casts a second, nothing else | H3: categorical only |

## 5. For the synthesis

- Rank shows **kind** (H4); magnitude follows damage per hit (H1, <= x1.3); area shapes show true reach (H2); the spend owns the boom (H5).
- **C1 is the one rule that keeps deep packs readable at any rank:** follow-through <= 25% of the part's own cooldown.
- Budget: **+12 calls steady, +25 peak, 0 per body**; particles <= 52 a cast at III; overdraw <= +0.25 screens average. Pay for it with the
  ghost trail (~100 calls back).
- Open, his phone only: real call cost a frame on the Poco (the 12-20 us is assumed); whether px holds 1.5 through a d8 brood fight;
  whether H4's cues read at px 1.0 (0.25 u floor).
