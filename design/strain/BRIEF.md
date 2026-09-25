# Brief: making the push wanted

For the design agents. **This is a pitch round, not a spec.**

## The problem, in the owner's words

Strain is one of the game's main mechanics, its differentiator. On the phone,
the owner says: *"I often find that I don't really need to strain."* Asked
whether he ever wants to push and holds back because of the cost, he said:
*"the thought never comes up, I don't feel the need to push."*

So the cost isn't the problem. **The game never asks for a push.** Making strain
stickier (quiet −2 → −1) was tried on paper and reverted: it raises the price of
something nobody is buying.

## What's built (the numbers, from the code)

- **The push:** hold a *recharging* ability button for 180 ms and it fires now,
  at full power, for +2 strain (`STRAIN_PER_PUSH`, `src/main.ts`). Tap on a
  recharging button does nothing. A one-time hint per part appears the first
  time a push-shaped part starts recharging (`src/hud.ts`).
- **Strain:** it persists across the whole run. At 20 the run ends in
  **Stopped** (Still slows and stops), which is an ending, not a failure: every
  ending keeps everything. Strain drops 2 per fight cleared ("quiet",
  `QUIET_STRAIN`). Shrine of Rest: −6, wakes the nearest pack. Shrine of Plenty:
  a good part for +4. No part lowers strain (a deliberate rule, see
  `design/CATALOG.md`).
- **The run:** 6 depths in two areas, about 26 minutes, bosses at 3 and 6
  (`design/meta/DESIGN.md`).
- **The loadout:** four slots (head, torso, arms, legs), each part one ability.
  Cooldowns across the 30 parts are mostly 3–8 s (range 1.2–12 s), plus an auto
  attack doing 5. Four staggered cooldowns plus auto means **something is almost
  always ready**, so a push is rarely the only way to act.
- **Parts that already touch strain:** Overclocked Coil (H8, +1 per cast),
  Brace (T5, hits cost strain instead of integrity), Frayed Cleaver (A5, wider the
  more strained), Overrun (L4, its long charge exists only as a push), Borrowed
  Time (L8, +2 per cast). Bolts charge over time; a pushed bolt is always full
  (`src/abilities.ts`).
- **The free band:** a push costs 2 and a quiet refunds 2, so one push per fight
  is free forever. Anything above that is a real bet against the run.

## Read first

In `/Users/adrianperez/repos/personal/still-action`: `DESIGN.md`, `HANDOVER.md`,
`design/CATALOG.md` (the 30 parts, the ram, the mites), `design/meta/DESIGN.md`
(the run shape and endings), `design/content/DESIGN.md` (area II: the Works, the
quarter, the Lobber, the Arbiter, the thief). Code: `src/abilities.ts`,
`src/parts.ts`, `src/hud.ts` (the push gesture), `src/main.ts` (strain, quiet,
shrines), `src/enemy.ts`, `src/charger.ts`, `src/ranged.ts`, `src/swarm.ts`,
`src/lobber.ts`, `src/boss.ts`, `src/arbiter.ts` (the enemies' state machines and
their windups/recovers).

## Settled, don't reopen

- **Strain is the run.** "HP is the fight; strain is the run." Stopped is
  something that happens to Still, never a trap and never a punishment screen.
- **Every threat is telegraphed and committed; rules are symmetric** between
  Still and enemies (walls block both ways).
- **No melee magnetism** (auto-lunging toward enemies). The owner rejected it.
- **No part lowers strain.**
- **Deeper means more varied, never stronger.**
- **Strain making Still stronger in general** is parked: it changes what strain
  means. Frayed Cleaver already does it for one part; that's fine as a part.

## Constraints

- Phone-first, landscape, 6-inch screen, thumbs. Anything the player must read
  in a fraction of a second has to read at that size.
- Colour language: Still cold, enemies ember, Grace the only warm light.
  Effects textured, never flat red or white.
- Built for fun, by one person, vibe coding. Say what's cheap and what's big.
- Existing parts must keep working. Name any of the 30 that a pitch breaks,
  makes useless or makes too strong.
- Don't assume the owner has played games you cite; describe the idea itself.

## What to pitch

1. **Demand: moments that ask for a push.** 3+ pitches. Fight situations where
   waiting for a cooldown costs something the player cares about: openings
   shorter than a cooldown, enemy states that reward the right ability *now*,
   boss windows. Say which existing enemies or bosses change and how.
2. **Reward: pushed forms worth wanting.** 3+ pitches. What a push buys beyond
   "fire early". Which parts, or which rule across all parts. Address the risk
   that it becomes a rule you follow on autopilot inside the free band.
3. **The thought coming up.** 2+ pitches. The owner says the *thought* never
   comes up. How does the game put the push in the player's mind at the right
   moment without a tutorial: in the button, the HUD, the enemy, the sound?
4. **The economy, only if it serves 1–3.** The free band, quiet refund, shrines,
   whether Stopped is reachable in 6 depths. Don't pitch cost changes on their
   own; the owner's diagnosis is that cost isn't the problem.

Each pitch: a name, 3–6 sentences, what the player does or sees, why it fits
Still, and the cost (cheap / medium / big). Mark at least one per topic
"surprising": something none of the existing documents say. End with your
**one recommended bundle**: the 2–3 pitches you'd build first, together.
