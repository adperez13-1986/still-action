# Brief: an enemy curve by depth that never punishes growth

28 Sep 2026. His asks, in order: inside a run Still gets stronger (allowed, DESIGN.md Persistence);
"what should we do with the enemies so that they don't get one shotted?"; then "lift [never more
enemy HP or damage] and go ahead, but be smart so that growth is not punished."

## What's new since the last numbers (read the code, not older docs)
- **Pressure** (accepted): ordinary hulks and sentinels at every crawl depth have no big windup
  (`PRESSURE_HULK` in src/enemy.ts: 5 a jab, 180 ms cock, 550 ms recover; `PRESSURE_SENTINEL` in
  src/ranged.ts: 3-shot bursts of 3). Their hits stack (no hurt window). In an elite pack only the
  crowned leader keeps the old telegraphs: the heavy. Rams, mites, Lobbers unchanged.
- **Temper** (src/temper.ts): melt a floor part into the worn one, ranks I-III (damage x1.3/x1.6,
  cooldown x0.85/x0.72, areas x1.15/x1.3). Kill drops x0.4 (`TEMPER.killPayout`). Swapping resets rank.
- **Mastery** (src/mastery.ts): melting into a III part teaches the close strike or planted shot one of
  six behaviour mods (slow, mark = next part hits twice, cleave 6, split 2x6). Max 6 a run.
- Riders are cut. The autos: close strike 10 on a 0.62 s beat; planted shot 8, pierces.
- Log: `playtest.json` now has `hpLost` per depth (a few runs only, maybe none with temper yet).

## Produce `design/scaling/CURVE.md`
1. **Expected power by depth** for three players: one who never melts (floor), a median one, one who
   invests (melts everything it can). Use the real drop rates (`src/drops.ts`, `tools/dropsim.ts`, you may
   extend it or write a small script in your scratch space; don't change src/). State what you modelled
   and what you guessed.
2. **The curve**: per depth 1, 2, 4, 5 (crawl) and 3, 6 (bosses), multipliers for
   - ordinary bodies' HP and damage (small) and pack size / count (density carries pressure),
   - heavies (elite leaders): HP and damage, and how many per level by depth,
   - bosses: Assembler and Arbiter HP (and whether damage changes).
   Every number with its reason. Keep enemy damage growth modest: HP lost should rise gently by depth.
3. **The growth test**: for each depth, time-to-kill a pack and a heavy for the three players, and HP lost
   per pack (rough). Pass: the investing player kills clearly faster than the floor player at every depth
   (growth felt), the floor player still finishes a run most of the time, ordinary bodies at depth 5 still
   die in about the same number of hits as at depth 1 for the median player (fodder stays fodder).
4. **Where to put it in code**: name the constants and the call sites (e.g. a `DEPTH_CURVE` table read where
   packs are made in src/combat.ts addPack or level generation in src/dungeon.ts). Don't implement.

Rules: never scale to his actual loadout or ranks (that punishes growth). Under ~1,200 words. Numbers where
they exist; mark guesses.
