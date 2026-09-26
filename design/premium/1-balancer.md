# Premium gaps: systems and content depth (balancer)

26 Sep 2026. Lens: replay value, hours of distinct play, meta, difficulty, build
diversity across the 30 parts, the strain economy, and whether the loop holds up
over 20+ runs. Numbers are from `src/` and the two runs in `playtest.json`.

## 1. What's already premium-grade

- **The part pool's discipline.** 30 parts, 4 slots (8/7/7/8 = 3,136 loadouts),
  and every blue or gold names what it gives up. No stat affixes. That's rarer
  than it sounds; most small roguelites ship +10% cards.
- **Five build identities are already in the pool** (on paper, untested):
  strain-burner (Overclocked Coil, Frayed Cleaver, Overrun, Brace), cover-player
  (Ricochet Lens, Clamp Toss, Spring Heels, Through-Line), controller (Chill
  Vent, Frost Trail, Backdraft Vent, Rusted Hook), duelist (Patient Lens, Parry
  Clamp, Anvil, Plumb Line), marker (Signal Flare with Vent or Cleaver).
- **A meta with no currency.** The hook, turning parts to the wall, unfound
  parts only from moments (`POOL_RULES`), parts that remember. It's choice, not
  power, and it's built.
- **No empty run.** Every ending keeps everything and leaves a corkboard card
  with a strain line and a crayon drawing.
- **Run length.** 26 minutes, 6 depths, saved at every beam: the right size for
  a phone.

## 2. The gaps, ranked

| # | gap | why a paying player feels it | fixed when | cost |
|---|---|---|---|---|
| 1 | **Strain resets every crawl level** | "Strain is the run" isn't true yet. It's a separate budget for each boss fight (details below). Once a player learns "crawl pushes are free, a boss allows ~9", there's no decision left to make across the run. | Strain going into depth 6 is ≥6 in half of full runs; the Home-early choice tracks strain | cheap rule, medium tuning |
| 2 | **No difficulty ladder, no skill ceiling** | The designer reached Home at depth 6 in both measured runs, and nothing sits above that. A premium roguelite's long tail is an opt-in ladder. | 6-8 rungs, each unlocked by Home on the one below and marked on the card | medium |
| 3 | **The new content is used up in ~6 runs** | Simulated from `POOL_RULES`, `eliteCount` and the shrine odds: the wall fills in a median of **6 full runs** (p10 5, p90 8). `DESIGN.md` targets 10-12. The boss's gold is always an unfound gold, so all 6 golds are found by about run 3. That's ~2.6 h of "something new". | Median wall fill of 10-12 full runs | cheap (3 numbers) |
| 4 | **Flat power curve inside a run** | Enemies never gain HP or damage and parts never get stronger. 60% of early drops fill an empty slot (`FILL_EMPTY_CHANCE`), so the build is complete by depth 2. So depth 5 plays like depth 1 with bigger packs. The power fantasy has to come from the build clicking, and nothing points at when it does. | A player can name their build by the Assembler, and depth 5 feels different from depth 1 | medium |
| 5 | **Loot is take-or-leave, one part at a time** | About 5 drops a level (`packPayout` 0.66 a pack, side rooms always pay, elites always pay). Each is a swap or a walk-past, so a build is mostly what fell. There's no moment where you pick one of three. | Each boss offers 3 parts on pedestals, pick 1 (still no power) | cheap-medium |
| 6 | **No measured build diversity** | Nobody knows which parts get kept. "Cleaver may be doing so much the others don't matter" is still open. If one white dominates, 3,136 loadouts shrink to ~50. | Per-part offered/kept/carried-to-Home counts in `playtest.json`; no part kept under 10% or over 60% of the times it's offered | cheap to log, medium to tune |
| 7 | **The three endings aren't measured** | 2 of 2 runs ended Home. Stopped needs about 10 pushes inside one boss fight. Broken hasn't happened. Premium players will test whether Stopped is real. | Over 10 runs by someone other than the designer: Home 55-70%, Broken 15-30%, Stopped 5-15% | cheap (it's play) |
| 8 | **The Home-early decision is empty** | By design, going home after the Assembler pays the same per minute as going on. Without #1 its only reasons are time and fear. With #1 it becomes "I'm at 12 strain and the Arbiter asks for pushes". | Players take the warm beam more often when they're high on strain | free with #1 |
| 9 | **One road** | Every full run goes Works, quarter, Arbiter. The Line (on the branch) doubles the afternoon, and the crossroads is a real choice only if the roads cost different things (the Line is meant to be the strain road, which again needs #1). | The Line is merged; the two roads show different strain at depth 6 | big (stages B and C, ~9 evenings) |
| 10 | **Few bosses, no rotation** | 2 bosses, the same two every run (the Engine would make 3). By run 10 each is a solved routine. Premium roguelites usually offer 2 candidate bosses per boss slot. | Each boss slot draws from 2 | big |
| 11 | **No gentler setting** | Premium players expect assist options. The endings are kind, but a fight's difficulty is fixed. | A "gentle day" toggle: wind-ups ×1.3, marked on the card, never hidden | cheap |
| 12 | **No seeded run to replay or compare** | Level seeds exist (`save.ts`) but a run can't be named or replayed. A seed you can type in gives a skill player a fair retry with no streaks or dailies. | "Same day" seed on the card, typeable at the door | cheap |

### Gap 1 in numbers

Crawl strain is refunded to zero: 6 of the 8 crawl depths ended at 0. Strain
rises only in boss fights, which have no quiet: depth 3 went 0→8 and 0→12,
depth 6 went 2→16 and 0→2. Each area then drains it again. Run 2 went into
depth 5 at 16 and left at 0 after 6 quiets, and depth 4 after Plenty took a
bargain's +4 away within one level. So strain is "Plenty is free, and Stopped
means 10 pushes in one fight".

**Proposed rule:** a quiet can't take strain below **half of what it was when
you entered the depth** (rounded down). The Rest shrine (−6) is the one way
below that floor. Replayed on the real runs:

| run | Assembler out | floor at 4 → 5 | into the Arbiter | Arbiter pushes | ends |
|---|---|---|---|---|---|
| 1 | 8 | 4 → ~2 | ~3 | 8 | ~19: one push from Stopped |
| 2 | 12 | 6 → 8 (Plenty sticks) | ~8 | 2 | ~12: chose to hold back |

That's the intended shape. A spender flirts with Stopped at the Arbiter, a saver
arrives safe, and the Assembler's spend is still felt two depths later. It also
makes the strain-burner build and Plenty cost something in the crawl (the
Coil's +1 a cast is currently refunded by every quiet). Draw the floor on the
strain bar as a pencil line.

### Gap 2: a ladder made of rules, not stats

It keeps "never more HP or damage". Each rung adds one rule to the ones below
it, and you can pick any rung you've unlocked:

1. A quiet eases 1, not 2. 2. No Rest shrines. 3. One more elite a level.
4. The floor is all of your entry strain, not half. 5. The thief runs for a
grate (the parked idea). 6. Elites read your buttons (parked). 7. The hook takes
nothing. 8. No warm beam after the Assembler.

With 8 rungs × 26 minutes, and a few tries a rung, that's ~10-15 hours of play
that gets harder without growing anything. It's the finite, earned long tail
his premium stance allows.

### Hours of distinct play, today and fixed

| state | new things run out at | then |
|---|---|---|
| now (main) | ~6 full runs, ~2.6 h | nothing new; replay rests on layouts and loot order |
| + gap 3 tune (boss-gold unfound 1 → 0.5, elite and Plenty 0.25 → 0.15) | ~10-12 runs, ~5 h | same |
| + the Line merged | ~6-7 h | the crossroads choice |
| + the ladder | ~15-20 h | a finish line at rung 8 |

## 3. The one gap that matters most

**Gap 1: strain doesn't carry.** Strain is the one thing this game has that
others don't: HP is the fight, strain is the run, and Stopped is the middle
ending. The measured runs show it working as a budget for each boss fight. Over
20 runs a player solves that budget, and then the core mechanic is a rule to
follow, not a decision. It's also the cheapest fix on this list: one rule in
`quiet()` in `main.ts`, and a line on the bar. And it's load-bearing for gaps 2, 7, 8
and 9: a ladder built on strain, measurable Stopped rates, a Home-early choice
that means something, and a Line that is really "the strain road" all need
strain that persists. Fix it first, then play three runs, then read
`strainIn` at depth 6.
