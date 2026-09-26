# Round 1: the verifier (what it costs here, and what breaks)

Lens: cost in this codebase and this way of building. Checked against `main` at 845333b
(the Line is merged dark, save v3 is live on his phone, the hand and the eye are on switches).

## The constraint nobody has priced: his phone-minutes

Agents make a system in an evening. What they can't make is a measured run. Every change so
far has owed "three runs on the Poco" (strain step 1, the hand, the eye), a run is 26 minutes,
and `playtest.json` holds 7 runs in total, one of them partial. `savePlaytest` only writes from
the dev server, only from his phone, and logs no drops or parts. So the scarce resource isn't
code, it's **validated play**: about 80 minutes of his time per switch, and one tester.
Price every direction in both: evenings to build, and runs owed before it counts.

## 1. The direction: systems for depth, one finished road for meaning

Costs from this repo, not in general:

| | build | runs owed | distinct play it adds |
|---|---|---|---|
| an area (the Line: A done, B 9.5, C 5 evenings) | ~15 evenings | ~6 (tuning trains, packs, a boss) | ~1 h, on half the runs |
| a boss (Arbiter, Engine) | ~5 evenings | ~4 (the Arbiter shipped trivially easy) | ~20-30 min until solved |
| a part (31st onward) | 0.3 evening | ~1 | blocked: the wall is full (below) |
| a choice system (pick 3, seeds, ladder) | 1-3 evenings | 2-3 | multiplies every area and part already built |

D2 volume to reach the balancer's ~15-20 h means roughly four more areas and four more bosses:
**~80 evenings and ~40 tuning runs**, with the art direction (a kit, a grade, a body palette)
redone per area. The hybrid gets there for about **20 evenings**: pick-one-of-three, seeded
days, the ladder, and the Line's stage B. Realistic target: **~5 h** of distinct play after
three cheap moves, **~15 h** with the ladder and the Line on. Content stays: the Line finished
to stage B, the two bosses, the Workshop, the family. It stops growing until the choices are rich.

## 2. The moves, ranked (cost to build / runs owed)

**0. Save v4 before any of it. Cheap (0.5 / 0).** `PartHistory` is a positional tuple, and
`repair()` drops any history whose length isn't exactly 8. v2 appended the Arbiter and v3 the
Engine; a fourth boss is another tuple migration, and one missed migration silently erases
every part's history on his phone. One v4 migration: history becomes a keyed record
(`{ runs, deepest, felled: Record<BossId, n>, ends: Record<EndingKind, n> }`), plus the
optional fields the moves below need (`rungsOpen`, a card's `seed` and `rung`). Checked by a
headless round-trip of a real v3 save, copied to `.premigrate` first as the code already does.

**1. Pick one of three at the boss (and at Plenty). Cheap (1 / 1).** Reuses nearly everything:
`rollPart` already has `excludeSlot` so the three land on different slots, the boss already
writes `bossLoot: PartId[]` into the snapshot (resume re-drops it), and the pedestals are floor
drops with today's compare pause. Guard the wall's fill rate: at most one of the three is
unfound (today boss-gold is always unfound; three unfound would fill the wall by run 3).
Pair it with one number: `FILL_EMPTY_CHANCE` 0.6 to about 0.35, so the build isn't done by
depth 2 and the third pick still matters.

**2. A run log on the device, with export. Cheap-medium (1.5 / 0).** Move the playtest record
out of the dev server: every run writes stats, taps, **drops offered / taken / left by part id**,
casts per part, and the switches on, into IndexedDB beside the drawings, local only, never sent
anywhere. Export it with the save export the premium round already wants (one file). Then a
second player in the house, or a friend, plays the live build and hands over a file. This
doubles the scarce resource, and it is the only way to measure build diversity (balancer gap 6)
and the ending split (gap 7) with anyone but the designer.

**3. Seeded days. Medium (2 / 1).** Honest cost: only the *layout* is seeded today.
`generateLevel` and `line.ts` use `rng(seed)` streams, but loot, elite modifiers, shrine kind,
the thief and names draw from `Math.random` (152 call sites in `src/`). Add named run streams
(`loot`, `elite`, `shrine`, `thief`) salted from one run seed plus depth, the way `dungeon.ts`
already salts `SALT.rail`; combat AI stays unseeded (fairness doesn't need it). The card stores
the seed; the door takes one. Bonus: a headless economy harness runs 1,000 seeded runs of drops
without combat, so wall-fill numbers become measured, not modelled.

**4. The ladder, cheap rungs first. Medium (2.5 / ~12).** A `Rules` record read where the
constants live now (`quiet()` and the floor in `main.ts`, shrine and elite counts in
`dungeon.ts`, the hook in `pool.ts`, the warm beam). Rungs 1-4, 7 and 8 are one-line rules.
Rungs 5 and 6 (the runaway thief, elites that read your buttons) are systems of their own,
~2-3 evenings each: ship without them. The chooser is the wall's `ChooserSpec` card, at the
door. The real cost is the column on the right: two runs a rung, about 5 hours of his play.

**5. The Line, stage B, switched on. Big (9.5 / ~6).** Stage A is sunk and the crossroads makes
it a decision, not just more floor. Stop at B with the Arbiter at the end of both roads (the
spec's own safe stop). The Engine waits until the log (move 2) shows the Arbiter being solved.

**6. Couplings among the 30, before a 31st. Medium (3 / 2).** Each wall section is 2 x 4 pegs;
head and legs are 8 of 8, torso and arms 7 of 8. A new head or legs part breaks the wall's
layout until the gold shelf lands (variety step 7). So make the 30 meet first: 6-8 authored
couplings through the hooks that exist (the mark, the break, pull into a vent, a shove into a
wall stuns). Each gets one headless check: `__equip` both, `__spawn`, `__fire`, assert the
effect. The pair matrix is the test surface; keep it to authored pairs, never emergent rules.

## 3. Stop, or don't build

- **A fourth area** (the old town) and **the Engine** until moves 1-5 are played.
- **Parts 31+** until the gold shelf; **families of parts** entirely for now.
- **Two switches at once.** The hand and the eye are both switchable; three runs with both
  moving can't say which did what. Decide them before any replay system goes behind a switch.
- **Pitch rounds that outrun play.** Built and unplayed today: the hand, the eye, the Line A.
  One new round per two closed ones.
- **A difficulty ladder made of numbers**, or any rung that touches HP or damage.

## 4. The surprising one: the maze remembers the hook

The hook by the door is the only choice between runs, and it's free: hang your favourite.
Make it answered. The first boss of the next run **wears a copy of the hooked part** (the
Mirrored champion's idea, moved to the bosses), and its move weights lean against that part's
leaning: hang the Rusted Hook and the Assembler opens with the shockwave that punishes standing
close; hang a lens and it keeps its adds between you. You see it the moment the arena opens, on
its body. Never stronger, only a different fight, and a reason to hang the part you *don't*
love. Cost: medium-cheap (2 / 2). It needs the leaning tags (variety step 6, data only), one
weight table per boss by leaning (4 x 2), and `save.hook`, which the run already reads at start.
Nothing new to save. It is the only move that makes the Workshop a decision, not a ceremony.

## Recommended direction and first three moves

**Systems for depth, the Line finished to stage B for meaning, and play-minutes as the budget
that orders everything.** Close the hand and eye switches first (his runs, no new code). Then:

1. **Save v4 plus the device run log and export** (2 evenings): safe history before any boss,
   and a second tester.
2. **Pick one of three at the boss, empty-slot fill down to 0.35** (1 evening, 1 run).
3. **Seeded days, with the headless economy harness** (2 evenings, 1 run), then the ladder.
