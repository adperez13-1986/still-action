# Round 2: Translator

## (a) Three I'd back

1. **The Pourer** (Verifier B2). Its slag lanes use the ram's lane tell, which
   players already read. It runs ember and cools to dark iron, which is the
   colour language exactly. Every pour you dodge leaves a wall, so the arena
   rewrites itself for the cost of circles placed `dead`. Take the Kiln's
   discipline with it: pours come from authored patterns, never random, so
   no escape is ever longer than about 2.4 u.
2. **The Slag Lobber** (Balancer N1). Nothing punishes hiding today, and
   dense cover in a foundry makes hiding the answer to everything. Its
   landing circle is r 1.6 (37 px), and it's Still's own Flare in ember, so
   it teaches itself. Ward and Mirror Ward cards must say "shots, not lobs".
3. **Live cores** (Balancer N3). A 700 ms ring after a death, and a chain you
   can watch travel. It's cheap, it teaches itself the first time, and it
   makes where you kill something a decision without touching HP.

## (b) What reads badly or breaks the tone

- **The Ring Hulk** reverses the hulk's rule on the hulk's body. At 16 px that
  misleads the player. It needs its own silhouette, or it should be dropped.
- **Viaduct ring-outs.** The kill happens off the edge, out of frame, and a
  shove toward an edge teaches Still to fear edges. Railed edges only.
- **×0.8 walk in water** makes a whole area feel like mud on a thumb.
- **Iron fences that stop bodies but not shots** can't be told from stone in
  the 300 ms the read gets. If they're kept, they need open bars with fog
  showing through.
- **Warm props.** `torch_mounted` and `lantern_standing` must never be
  vendored. The dead trees from Halloween Bits push the tone toward spooky.
- **A cot in the residential quarter** is too near the kids. Leave it out.
- **A crate that "breathes"** by lifting its lid a finger's width won't show on
  a phone. The ember seam has to carry that tell by itself.

## (c) The splits

**The self-boss: an evil-twin trap as the depth-6 boss, all three versions.**
Discards turn letting go into a threat. The Copy makes the last fight of every
run *you against you*, and that's heavy in a game whose only line is "you
showed up, that was enough". My Echo softens the meaning ("a Lantern the maze
built instead of her carrying"). But a darker Still is still the last thing
you face before the road home. The good ideas inside it are worth keeping:
the Copy's insight that the Assembler's moves already match Still's four
slots, and tells the player knows from his own thumb. At most, Echo Construct
could be one *named* enemy (Claude's C-V1): rare, small, never the boss.

**Area II's identity: combine them.** Depth 4 is the Works at the end of the
shift. Depth 5 is the quarter where the workers lived, more intact the
further you get. The boss fights in the quarter's square at dusk, and the
night walk reaches the lit house. That's a commute: work, the streets, home.
The Yard is the weakest of the three, because its fence rule costs a read.
One hard rule: **"more intact" never means taller.** Walls stay waist-high.
The intactness shows in floors (rubble, then tile), furniture, doorframes and
window frames on the far side only. Cost: two kits in one area, about +2 MB.
Keep loading every piece at boot (Verifier's offline trap).

**Lights out: readable only with a floor under it.**
- Key the darkening to boss HP, and stop at "first dark", not black (exposure
  about 0.85 in my table).
- Hold the fog's far edge beyond the arena.
- Give the walls a cold rim so cover stays a silhouette.
- Scale Grace against exposure.

The telegraphs survive the dark. Cover doesn't, and cover decides every
move. Written as "until only Grace and the tells are lit", it breaks "walls
block both ways" for the eyes.

**The thief: the Picker's behaviour, the Tinker's safety, the Hollow's look.**
- **From the Picker:** it goes for floor loot mid-fight and runs toward a
  sleeping pack. That's the real decision.
- **From the Tinker:** it can't take a part Still is standing over, and it
  never leaves the level.
- **From the Hollow:** the part rides in a cage on its back, lit cold. A cold
  light moving away is the best read of the three: *that's mine*, with no
  words.

Put it in area I, where every run plays.

## (d) The bundle

| | what | evenings |
|---|---|---|
| plumbing | `Boss` interface, `Hazard` primitive, per-area grade and surfaces | 3 |
| environment | depth 4 the Works, depth 5 the quarter, the square at dusk; my "day moves with you" light layer | 5 |
| boss | **the Arbiter** (my B1) in the square: a lamp tower sweeping its wedge over the rooftops, cover wearing down, lights out capped at first dark | 3 |
| enemies | Slag Lobber at depths 4–5 (its lob teaches the Arbiter's flare, the way depth 2 teaches 3); live cores; the thief in area I | 4 |

About 15 evenings. The Pourer takes the Arbiter's slot if you'd rather the
arena change than the light.

## Summary

1. I'd back the Pourer (with the Kiln's authored patterns), the Slag Lobber and live cores.
2. Cut or fix: the Ring Hulk's misleading body, ring-outs, slow water, fences that can't be told from stone, warm props, the cot.
3. Self-boss: an evil-twin trap as the boss. Keep its shape-reuse insight, and at most a rare named Echo.
4. Area II goes Works, then the quarter, then home, with walls never taller than waist-high. Lights out only down to first dark.
5. Bundle: the Arbiter in the quarter's square, the Lobber, live cores, and the thief (Picker behaviour, Tinker rules, cold cage) in area I, about 15 evenings.
