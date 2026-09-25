# Area II: the commute, the Arbiter, and more variety

Settled 26 Sep 2026 from `PITCHES.md`. Adrian picked **C, the commute**, plus
everything the four voices agreed on. It builds on the Home design
(`design/meta/DESIGN.md`): a 6-depth run in two areas, one day, a night walk
home.

## The run, with area II filled in

| depth | place | light |
|---|---|---|
| 1-2 | the dungeon (today's kit) | morning |
| 3 | the Assembler, unchanged | noon |
| 4 | **the Works**, at the end of the shift | afternoon |
| 5 | **the workers' quarter**, more intact the closer you get to home | late afternoon into dusk |
| 6 | **the Arbiter**, in the quarter's square | dusk, falling to first dark |
| walk | the last of the quarter up to the lit house | night |

## The Works (depth 4)

- **Pieces:** the Assembler's foundry, built from unvendored pieces of the
  same KayKit Dungeon Remastered kit (grates, gated walls, scaffolds), so
  there's no style risk.
- **Surfaces:** metal plate and walkway ambientCG textures. Machinery sits
  beyond the edge in the fog.
- **Sound:** the unused "foundry" ambience becomes its room tone, with a forge
  thump at half the music's tempo and plate footsteps.
- **Slag cores** appear here and in the quarter.
- **The slag heap:** the Works' mites sleep as a mound of six coals. It's a
  new face on the existing brood, not a new mechanic.

## The workers' quarter (depth 5, the boss square, the walk home)

- **Cover:** broken furniture (KayKit Furniture Bits, CC0, the same scale as
  the dungeon kit).
- **"More intact" is never taller.** Walls stay waist-high and the camera is
  never blocked. Intactness shows in floors, furniture and door frames on the
  far side.
- **No cot**, because it's too near the kids.
- **Cover density rises through the level:** sparse near the entrance, dense
  near the exit. That gives the Lobber something to punish.
- **Sound:** wood underfoot, a curtain in a draft, something far off.

## The Arbiter (depth 6)

- **Body:** a lattice lamp tower in the middle of the square. It doesn't
  walk. 900 HP, never more than 22 per hit, no windup under 620 ms.
- **The sweep:** an ember wedge sweeps the floor like a lighthouse, stops on
  Still (tracks, then locks), and fires a lance down it. Walls block the
  lance, for both sides. The wedge is a floor tell, not a real light, so
  Grace stays the only warm light.
- **The heat beam:** a lance that hits heats one of Still's buttons. For a
  while it can only be fired by pushing (+2 strain).
- **The push window:** after every lance the tower vents for 1.2 s, and
  that's the time to hit it.
- **Lights out, capped:** the arena darkens with its HP and stops at first
  dark. Tells and enemy cores ignore the fog, walls get a cold rim, and
  Grace's light is scaled to stay constant. The kill lands at dusk as the warm
  beam opens.
- The spec pass fills in its second phase; the balancer's and translator's
  pitch files have the pieces.

## Enemy variety

- **The thief** (area I, from depth 2). A small machine that never attacks,
  carrying a found part in a cold-lit cage on its back, the only cold light on
  any enemy. It runs.
  - Catch it and the part drops.
  - It never leaves the level and can't take a part you're standing over.
  - It adds no new loot, so it's only ever a found part.
  - Its pauses bring its average speed to 4.5, under Still's 5.5.
- **Slag cores** (area II). Some enemies leave a telegraphed burning puddle
  where they die. It arms in 0.4 s, hurts Still and enemies alike, and never
  chains.
- **The Lobber** (area II, lesson at depth 5). A sentinel variant that lobs
  shells over walls, under the same rule as Still's Flare. Its landing circle
  is r 1.6 with a 1000 ms flight, so there's room to react. Ward's card says
  it doesn't stop shells. Body-equivalent 1.

## The day moves with you

The grade darkens with how far Still has got through each level, not only
from area to area. In the Arbiter's fight it follows the boss's HP instead.

## Foundations

- **A `Boss` interface and a `bossFor(depth)` picker**, because the
  Assembler is hardwired today.
- **A shared floor `Hazard`:** it shows a telegraph, arms once, and hurts Still
  and enemies alike. Slag cores, the Lobber's shells and the Arbiter's lances
  use it.
- **Per-area presets:** kit, surfaces, grade, fog, ambience and footsteps.
- **Precache on install.** The service worker caches a build-generated file
  list, so area II works offline the first time you reach it.

## Cut from this round

- The Gantry, the Viaduct with falls, the Kiln's grates, slow water, the Ring
  Hulk, and fences that stop bodies but not shots.
- Any "boss made of you". The mirror Echo may come later as a rare named
  enemy.
- Named ones from the old roster, until the notebook exists.
