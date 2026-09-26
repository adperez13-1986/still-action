# Round 2: the verifier

Read all four round-1 files against `main` at 845333b. Costs are vibe-coding evenings, plus
the runs on the Poco each step owes before it counts (his play is still the scarce resource).

## Where I changed my mind

- **Infrastructure first was wrong.** Save v4, an on-device log with export, and seeded days
  are real, but none of them makes a run better. Only two cheap tools come first (e).
- **Seeded days drop down the order**, to the ladder's retry (the balancer: ~0 hours alone).
  "Cheap, the seeds exist" is wrong in the code: only layouts are seeded; drops, elite mods,
  shrine kind and the thief use `Math.random`. It stays 2 evenings.
- **The hook-boss drops to late:** it needs tags and boss tuning, the expensive kind.

## (a) Pick one of three: bosses and Plenty first, elites at the quiet second

- **Bosses: 3 pedestals. Plenty: 2.** Reuses `rollPart(..., excludeSlot)` (so the three land on
  three slots), `GroundPart` for the beams, the compare pause, and `RunSnapshot.bossLoot:
  PartId[]` (resume re-drops the set). New: a `set` id on `GroundPart`; taking one darkens the rest.
- **Guard the wall:** at most one unfound per set (three always-unfound golds fill it by run 3).
- **Elites need a rule:** the thief (b793d0d) runs for "the drop the elite owed", and a
  pick-three with the pack awake stops a fight. So in a thief room the elite drops one part, as
  today; elsewhere its three pedestals rise at the quiet. That keeps the balancer's ~9 moments.
- Cost: 1.5 evenings (bosses and Plenty) + 1 (elites at the quiet). 3 runs. Ship with
  `FILL_EMPTY_CHANCE` 0.6 to ~0.3 (the translator's fourth button at the Assembler) and
  `packPayout` 0.66 to ~0.45, both set with the simulator, not by feel.

## (b) Tag-weighted drops: cheap code, one decision first

- `AbilityDef` has no tags. `pickPart` picks tier, then slot by `TREASURE`, then uniformly in
  the slot; weighting is ~10 lines at that last step (shared leaning with what he wears: x2-3).
- **Two vocabularies don't match:** variety's close / marksman / caster / keeper (shown as
  glyphs) vs the balancer's burner / cover / control / duel. Steer by the one players see; I'd
  keep variety's and rerun the balancer's sim on it.
- Cost: 1 evening; the tags are design judgment. Only the simulator can check x2; a thumb can't.

## (c) Push the drop: keep the cheap version

- **The code already makes it half quiet-proof.** Since 6ec6b02 a quiet can't take strain below
  half of what he carried into the depth. A +2 reroll at the boss pedestals (the end of depth 3
  or 6) enters the next depth and keeps +1 through every quiet. No second strain.
- **Cheap version:** only at pedestals, plain +2, the reroll draws the same slot from *found*
  parts only (or it farms the wall). The gesture sits on the pedestal card as a hold, reusing
  step 0's closing ring. 0.5 evening, 2 runs.
- **Ember "want strain"** reopens the resource just stabilised (`quiet()`, Rest, Brace, the
  Coil, the 7 px bar, the snapshot): 2 evenings + ~3 runs, only if cheap rerolls prove free.
  Risks: "no currency" (his call); Stopped-by-greed needs his words.

## (d) Wishes vs the hook-boss

- **Wishes need save changes:** `wish: WishId | null`, a grow-only `shoebox: WishId[]` (unioned
  in `write()` like `found`), and `wish?` on `RunCard`. That makes wishes the step that opens
  **save v4**, and v4 also rekeys `PartHistory` (a list of exactly 8 today; `repair()` drops
  any other length, so the Engine would be one more risky migration).
- **Detection:** most of the 8 starting sights come from things already counted: notebook met or
  felled, `lastEnding.hour`, part history for "a part with a name". "A ram asleep" needs a new
  on-screen test for a sleeping pack. The drawing reuses `crayon.request(cardId, by, moment)`
  mid-run (card id = run id); today the later request wins, so the wish must beat the ending.
- Cost: 3 evenings with v4, plus his words; kids' scans ~0.6 MB against the 5.6 MB cap.
- **The hook-boss:** 2 evenings, no save change, but needs (b)'s tags and two bosses retuned.
  Wishes answer "why start run 20", more cheaply. Wishes first.

## (e) My infrastructure: needed first vs nice

| | when | cost |
|---|---|---|
| per-part offered / taken / left counts, in today's dev `playtest.json` | **first** | 0.5 |
| drop simulator as a repo script on `loot.ts` / `pool.ts` (the balancer's Monte Carlo, kept) | **first**: payout, pedestals and weights are all drop tuning | 0.5 |
| save v4 (history rekeyed, wish fields) | with wishes, and before any boss | in (d) |
| seeded days | with the ladder, as its retry | 2 |
| on-device log with export | when a second tester exists; rides on the save export | 1.5 |

## (f) Families: after steering, before the ladder

Variety step 3, 3 evenings, mostly reuse: `PackSpec.members[].variant` already carries
`lobber | signal | handcar | porter`, `hide.ts` gives bodies their metal, `assignNames` names
them. **After (a) and (b)**: an enemy favouring a leaning only asks once builds steer. **Before
the ladder**: each family adds a wish and a page. The Mirrored champion follows (1.5).

## Final direction and build order

**Steering first (pedestals, tags), then questions in the house (wishes, families), then
mastery (ladder, seeds), then the second road.** About 31 evenings, and ~30 of his runs.

| # | step | evenings | runs |
|---|---|---|---|
| 1 | drop counters + drop simulator | 1 | 0 |
| 2 | pedestals at bosses and Plenty; fill 0.3; payout by sim | 1.5 | 2 |
| 3 | leanings: one vocabulary, 30 tags, glyphs, x2-3 weight | 1 | 2 |
| 4 | elite pedestals at the quiet (the thief rule) | 1 | 1 |
| 5 | push the drop, pedestal-only, plain +2 | 0.5 | 2 |
| 6 | save v4 + wishes, 8 sights | 3 | 2 |
| 7 | three families, then the Mirrored champion | 4.5 | 3 |
| 8 | ladder rungs 1-4, 7, 8 + seeded "same day" retry | 4.5 | 12 |
| 9 | the Line, stage B, switched on | 9.5 | 6 |
| 10 | the hook-boss; authored couplings among the 30 | 5 | 3 |

Not until after 10: the Engine, a fourth area, parts past 30 (the wall is 8/8 on head and legs),
want strain as a second resource, the on-device export. And still: one playtest switch at a
time, so close the hand and the eye before step 2 goes live.
