# N3: Thorns replaces Graze (3 Oct 2026)

His call: "Graze feels like something that can work if there is a dodge mechanic, not something for stepping away" (the basic
enemy has no red windup zone, its windup is 0.52 s and the pressure hulk's cock 0.18 s, so the band can't be reacted to). He asked
for simpler cores closer to established mechanics; picked Thorns (retaliation, as in Diablo and many roguelites) to replace Graze.
Lead's design, no design agents. Every number and word is PLACEHOLDER, a first guess.

## The rule

- **A hit lands on him:** when `hurtPlayer` is called for an enemy's melee hit (the attacker is known: `from` / `action.source`),
  the attacker takes `damage` (a core hit, `autoHit(e, dmg, 'core')`, full on an immovable body) and `marks` marks.
- **A shot lands on him:** its owner gets `shotMarks` marks, no damage (thread the owner through where it's undefined today, e.g.
  combat.ts ~line 996).
- **A blocked hit counts more:** a hit a guard stops (Ward's shield, Brace, Anvil's catch, Mirror Ward's reflect; find each block
  path) gives the attacker `blockMarks` marks and the core `damage`. Playing well means blocking, not soaking.
- **Hardened:** with Thorns worn, the damage he takes is x`(1 - armor)`. Thorns asks him to stand where things hit him; this makes
  that survivable. It's the only defensive number on any core.
- Waves, hazards, and hits with no attacker: no thorns (Hardened still applies).
- No auto, no beat.

`thorns: { damage: 8, marks: 2, shotMarks: 1, blockMarks: 3, armor: 0.15 }`, `K: 8, cap: 3, lifeS: 3`.

## Parts

**Spenders:** Parry Clamp `k 10`, Anvil `k 12` (its catch is a block: marks, then the hammer spends them), Piston `k 8`, Scrap
Cleaver `k 4` (the white bridge). **Guards:** Ward ("a blocked hit barbs harder"), Brace, Mirror Ward ("a reflected shot barbs its
owner"). **Shapers:** Rusted Hook ("yank them in to swing at you"), Lure.
**Keystones:** packs, **Bramble**: a hit taken or blocked also gives 1 mark to every other awake body within `radius 2.0`.
Bosses, **Spite**: a hit from an immovable body gives `marks 3`, and the core hit is x2.
**Upgrades** (from d7): **Backlash**: any hit taken or blocked shoves the attacker `1.5 u` (visible recoil). **Bramble Patch**: a
hit taken leaves a cold barbed patch at his feet (`radius 1.5`, `2 s`) that gives 1 mark to each body entering it, once per body.

## The look

- **Armed:** a faint ring of short cold spikes on the floor at his feet while Thorns is worn (one mesh). It flares on each thorns hit.
- **A thorns hit:** cold shards fly from Still to the attacker (`vfx.shards` / a short streak, deterministic), a mark tick, a
  barbed "tk" sound. A block: bigger burst, a deeper sound.
- **The ring on marked bodies:** spiked.
- **Hint:** `What hits you is barbed. Blocking barbs harder. Blue buttons break the barbs for extra damage.`
- **Pick card:** thumb `Let them hit you, or block.`, leaves `What hits you is barbed.`, mark word `barbed`.

## Graze goes

Remove Graze's code and data: the core, `grazefx.ts`, its keystones, upgrades, fits, events, words, logs, bot and K-M33. Remove
`Enemy.swing()`, `laneMargin` and `lanePass` unless something else uses them. A save whose core is `graze` resumes with no core,
like an old save. The pick shows Wake, Ram, Thorns, Tether.

## Checks

As N1/N2: no Math.random in new code; bare, `BUILDS=0`, Wake, Ram and Tether unchanged (K-90F equal; cored runs equal to HEAD's);
a Thorns bot report (thorns hits/blocks a second, marks made/spent, core damage, HP lost vs bare, the Assembler felled); K-M33
becomes Thorns' rules (melee hit, shot hit, block, Hardened, Bramble, Spite, Backlash, Patch, no effect without Thorns);
screenshots: the pick, the armed spikes, a thorns hit, a block, a spend. At most +2 draw calls.
