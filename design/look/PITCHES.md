# The look: what we'd build

2 Oct 2026. Four voices, one round (`1-translator.md`, `1-balancer.md`, `1-verifier.md`, `1-claude.md`), from `BRIEF.md`. Design
only: nothing is built until you pick. Every name and word is PLACEHOLDER.

Your ask: "the animation of the parts... too basic right now.. maybe make their animations more dramatic as they get upgraded,
but hopefully not just bigger".

## The short answer

**Rank adds a new kind of beat, never a bigger one.**

| rank | what it adds | reads as |
|---|---|---|
| **I, the act** | the motion itself, drawn properly: a cold swept line across the screen in 60-80 ms, not today's flash + spark spray | "a tool" |
| **II, the bite** | contact: lit steel shards off each body it hits, and a short cut on the floor at its feet | "it lands" |
| **III, the scar + the stance** | a line of the motion stays on the floor for ~1 s; Still holds the end of the pose a beat; and **while the part is ready, it sits cocked on his body** (slack while cooling) | "it's mine, and it's dangerous" |

You can tell a III with the sound off, from a still frame, without anything getting bigger or brighter: by the stance on his body, or
the scar on the floor.

## Why it looks basic today (the round's diagnosis)

1. **Still's swing is drawn as an enemy warning.** The Cleaver's shape on the floor (`combat.sweep`) uses the enemies' telegraph material:
   a filled sector that ripples outward and grows, just tinted blue. Hook, Clamp Toss's whiff and the hand use it too.
2. **Every cast is one frame and a fade.** `castFx` in main.ts only varies how many flashes and sparks it throws. Nothing before,
   nothing after, nothing that moves across the screen.
3. **The detail is too small for a phone.** Sparks are 2-4 px at the game camera, so what shows is the flash: brightness. Rank never
   reaches the look at all (nothing reads `def.rank`); a III is a I with a wider cone.
4. **The hit flash** turns a struck body 85% white with a warm glow, held through the weight freeze: the "pale blob" on slammed hulks.

## Agreed by all four

- **Nothing grows faster than the power does.** Under the flat temper a core run uses, a III hits x1.3. So size, brightness and
  particles may grow at most x1.15 at II and x1.3 at III; area parts draw their true reach and nothing else of theirs grows. Rank
  shows as a change in kind (motion, contact, residue, stance, sound), so the look never lies about power.
- **No wind-up before the hit.** Damage lands on the press, and a 100 ms wind-up would be input lag (and costs fast parts ~4-9% of their
  damage a second). Anticipation lives in the III stance at rest and in the weight freeze frame, which stays the same at every rank.
- **Rank I gets better first.** A player who never melts sees rank I all run, and today's "basic" is all rank I. If only III improves,
  the look punishes building over melting. The build layer wants them as peers.
- **The loudest thing Still does is a big spend or a keystone, not a III cast.** A 3-mark spend is x1.9-2.2 a hit, bigger than any III.
  So the spend gets the drama that grows with marks, and the build layer's moment stays the build's.
- **Cold for Still, ember for enemies, kept.** The brief's "glow -> molten -> fractured" ladder is out: molten is the enemies' threat
  and Still's own embers mean cost (push, Brace). Still's ladder is cold: frost -> rime -> fractured steel / glass.
- **The enemy's tell always wins.** Layer order: enemy tells > mark rings / spends > bites > rank flourish > scars. Scars are open lines,
  never rings (rings already mean marks and landings), at <= 0.45 opacity, and last at most a quarter of the part's cooldown (cap 1 s).
  With a committed tell nearby or two flourishes live, a flourish drops to its rank-I size; the stance and material stay.
- **The rank-up moment is the big beat** (~16 a run): a melter spends most fights at III, so III is the normal look, and the
  ceremony belongs to the moment it arrives.

## The overall look, beyond the parts

1. **The hit flash:** a light 25% fill plus a cold rim on the body's edge, so the silhouette stays dark. A break keeps the full flash,
   so a hit and a break read differently. Costs nothing.
2. **Contact shadows:** shadows are off, so everything floats. One instanced set of soft dark discs under Still and every body
   (1 draw call); Still's shrinks in the air, which also shows a hop's height.
3. **A borrowed cold light:** one point light a cast lights for 90-160 ms: cold light spilling on warm stone. It costs per pixel on the
   whole floor, so it is measured on your phone (`?perf=1`) in two forms before it stays.
4. **Paid for by the dash trail:** a dash or hop trail costs ~130 draw calls today (9 afterimages of ~15 meshes). Instancing it frees
   ~100, about four times what the whole look layer needs at its peak (+25).

## Two things the round found that the build must fix first

- **The visuals and the fights share one random stream.** A III throwing more sparks would shift every later combat roll. Step L0
  gives the visuals their own seeded random, re-captures the fight record once, and adds a check that fights are identical with
  effects off. Then "visuals only" is true by construction.
- **The cast's look lives in `main.ts` (`castFx`), not in `partfx.ts`.** It moves to its own file, and rank reaches it through a
  read-only view of what's worn, so no look change can touch a combat number.

## Build order (the verifier's)

| step | what | then |
|---|---|---|
| L0 | separate random for visuals + the effects-off check; `castFx` out of main.ts; the worn view; a look tier table (`looktiers.ts`) whose type has no size or brightness field ("not just bigger", enforced); your `?perf=1` numbers in a d8 big room | nothing you'd see |
| **L1** | **the Cleaver family end to end** (Scrap Cleaver, Frayed Cleaver / Backhand, Piston): the swept crescent at I, the bite at II, the scar + stance at III; the hit-flash fix in the same slice | **stop for your feel** |
| L2 | the other families, by how often they're cast (bolts, novas, dashes, then the rest) | your feel per family |
| L3 | the overall look: contact shadows, the dash trail instanced, the cast light (measured first) | your phone number |

Checks: draw calls at most +4 for the rank layer (+25 peak for everything), particle caps per tier, screenshots at four phone sizes
and a warm and a dark depth for every family, a deep-pack test that an enemy tell's pixels are unchanged with effects on, and a
still-frame test that a III differs from a I without more white pixels. The real pass is you naming the III in three shuffled frames
with the sound off.

## Yours to decide

1. **Does "rank adds a beat" match what you pictured?** Or did you mean III as a different move altogether (a new animation, not a
   new layer)?
2. **The III stance:** the part sits cocked on Still's body while it's ready. Does that sound like "upgraded" to you, or just a
   different idle?
3. **Start with L0 + L1 now** (the Cleaver family, then stop for your feel), or wait until you've played the cores first? My rec:
   play the cores first (B6), since the build layer is the bigger change and the look work is easier to judge after.
4. Anything here that misses what you meant by "basic"?
