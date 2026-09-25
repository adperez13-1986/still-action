# Round 1: the Verifier's pitches

The technical director's view, with my own pitches alongside the checks.
Everything here comes from reading the code as it stands (`hud.ts`, `main.ts`,
`combat.ts`, `abilities.ts`, `parts.ts`, the enemy files, `save.ts`) against the
brief. Costs are in vibe-coding evenings. The code is quick to write. The slow
part is tuning timings on the Poco.

---

## What the code says about "the game never asks"

Seven findings. The pitches below build on them.

1. **A push is "fire early" and nothing else, for 26 of the 30 parts.** `cast()`
   gets `ctx.pushed`, but only four parts read it: Patient Lens (full charge),
   Overrun (the long charge), Lure (bursts the old decoy) and Plumb Line (plants
   again). For everything else a push only changes presentation: scale 1.16,
   shake 0.34, hitstop 60 ms, ember sparks, a double buzz (`main.ts` `cast` /
   `castFx`). Also, a push restarts the *full* cooldown
   (`readyAt = clock + cooldownMs`), so a push is only worth the time that was
   left on the button.
2. **Being "open" pays every hit the same.** The ram's hatch, the Assembler's
   grill and the Arbiter's vent are all ×1.5 on *any* damage, the auto attack
   included. An opening never asks for a particular button, so whatever is
   ready does the job.
3. **Walking answers every threat.** Everything is tuned so a step clears it
   (catalog questions 2 and 3). No threat is left that only a part can answer,
   so a threat never creates demand. Demand has to come from *opportunity*.
4. **The lock scheduler keeps demand away.** `canLock/book` keeps committed
   locks 300 ms apart across the room, so threats come one at a time and one
   answer is always enough. That's good for readability, but it also works
   against the push.
5. **The gesture is slow compared with the tells.** A push fires 180 ms into the
   hold (`PUSH_HOLD_MS`). Add about 250 ms for a thumb to react, and a push
   lands about **430 ms** after the player sees something. The ram locks 405 ms
   before it rushes and the mites' ring closes in 550 ms, so an emergency push
   after the tell is too late for the first and just in time for the second.
   Any "push now" moment has to be at least about 600 ms long.
6. **Only 2 of 30 parts ever tell you they can be pushed.** The one-time hint
   fires only for `overrun` and `charge` mods (`hud.ts` `pushShaped`). The only
   other prompt is the heat caption, which shows at depth 6, and only *after* a
   lance has hit you. So the one push demand that's built is a penalty for
   failing to dodge, at the last depth.
7. **A tap on a recharging button is thrown away without a sound.** `pointerup`
   fires only if the button is ready, and a dead tap gets no answer at all (the
   `refused` flash is only for casts). A dead tap is the one moment the game
   *knows* the player wanted a button that wasn't ready, and nothing records it.

Doc drift, while I was there: `DESIGN.md` still says strain "decays 4 per fight"
(twice). The code says `QUIET_STRAIN = 2`.

---

## 1. Demand: moments that ask for a push

### D1. Every windup is a door

This pitch needs R1. With R1, a pushed hit that lands during an enemy's windup
breaks it. The enemy reels, which reuses its own recover timer and leaves it
open ×1.5, the same "open" language as the ram's hatch. Every windup becomes a
choice: step away (free, but you give up ground and hits) or break it (+2, stay
in, and punish the reel). Breaking is only worth it when the slot that can
reach is cooling. Players fire parts as soon as they're ready, so it usually
is. The latency in finding 5 sorts the enemies without any new rules:

| enemy | windup | spare after 430 ms | what breaks it in time |
|---|---|---|---|
| hulk | 520 | 90 ms | instant parts only: arcs, novas, a dash if adjacent |
| sentinel | 760 | 330 ms | arcs, novas; a bolt only if pushed bolts fly 2× (below) |
| ram | 900 (lock at 495) | 470 ms from the *tracking* | anything, but only if you react to the faint rails, not the lock |
| Lobber | 620 | 190 ms | instant parts, or a 2× bolt from within about 10 u |
| mites | 550 | 120 ms | a nova or an arc; each biter broken shrinks the bite |
| Assembler, Arbiter | never | | `interrupt()` already returns false |

What changes: the reel (hulk 760 ms, sentinel 520, Lobber 500, ram 700, mites
back to the ring). Pushed bolts fly at 52 u/s instead of 26, so a sentinel can
be broken from the far end of the Lens's range. **Cost: included in R1.** The
enemy side is one `reel` branch in each of six `interrupt()`s.

### D2. The linked pair (surprising)

Finding 4 is the reason: the scheduler that keeps the room readable also means
one button is always enough. A rare pack template, from depth 4, books **two
locks for the same instant** on purpose, for example a sentinel's line and a
ram's lane that cross where you'd step. A thin ember thread joins the two tells,
so they read as one move, not a mess. One ready part (or one step) answers one
of them. For the other, you push, dash through, or eat it. It's still
telegraphed and committed. It asks for two answers at once, which is the one
thing the room never does today. **Contradiction to flag:** the catalog's "two
committed locks never land together" was made for readability, and this breaks
it on purpose, at most once or twice a level. **Cost: medium, 1.5–2 evenings:**
a `bookPair` in the lock book, the thread in `vfx.ts`, a template in `dungeon.ts`,
and phone tests to check the pair is readable at 6 inches.

### D3. The grill's four locks

Only the Assembler. The Arbiter's 1.2 s vent is too short for one thumb to hit
four buttons, and its heat is already its push demand. When a charge stuns it
into a wall (1.7 s), four small locks light on its boss bar, one per slot. A
part that lands a hit lights its slot's lock. For legs parts that do no damage,
a cast that ends within 3 u of the grill counts. Light all four before the
recover ends (stun plus 1.0 s, so 2.7 s) and the core tears: 90 damage, a big
beat, and a plate falls on the floor. With four staggered cooldowns you
almost never have all four ready, so the unlit locks point at exactly the
buttons you'd need to push. Boss fights have no quiet (the boss is awake the
whole time), so every push here costs real strain: a bet you choose, at the two
moments of the run built for it. **Cost: medium, about 1.5 evenings.** `hitPart`
already knows the def, and therefore the slot. The bar notches are HUD work.
The fallen plate as cover is an extra half evening, because it's a runtime
breakable.

---

## 2. Reward: pushed forms worth wanting

### R1. A push breaks

**One rule for all 30 parts:** a pushed hit that lands on an enemy during its
windup breaks the windup, as Parry Clamp does. `hitPart` already handles every
part hit, so the rule goes in one place. The `pushed` flag has to travel with
anything that lands later: bolt records, lobs, the dash's run-over and the
decoy's burst. Lobs land 800 ms later, so they almost never break anything
reactively, and that's their give-up. Why it fits Still: "the windup is the
game" (`enemy.ts`), and the push becomes the way to answer one. It doesn't make
Still stronger with strain, and it can't break a boss. Autopilot risk inside
the free band: low. It only does something when a windup you can reach is
running, so the free push each fight becomes a choice of *which* windup.

What it does to existing parts:
- **A4 Parry Clamp is narrowed, not useless.** It stays the break that costs
  nothing, every 3.6 s.
- **L4 Overrun** gets stronger: a pushed charge breaks every windup along 9 u.
  That fits "all its damage costs strain".
- **A5 Frayed Cleaver** at 12+ strain becomes a 360° break. That's its
  identity.
- **T1 Pressure Vent** becomes the panic break, because a nova is instant.
- **H8 Overclocked Coil**: 3 bolts can break 3 windups, for 3 strain.
- **A6 Clamp Toss** and **A7 Anvil** don't change.

**Cost: cheap to medium, about 1 evening** including D1's reel. The phone
tuning is the real work.

### R2. A push aims at the threat

Today every tap aims at the nearest enemy. A **pushed** cast aims at the enemy
whose windup lands soonest, as long as it's in the part's reach. That's the
tell the renderer already draws on top (`tellOrder`). What the player sees: the
hulk next to you is idle, and the sentinel behind it is locking. The push
ignores the hulk and hits the sentinel. It also answers half of the open "hold
means two things" question: a hold on a cooling button means "that one, now".
It isn't more damage, and it's worthless when nothing is winding up, so pushing
when nothing is winding up is simply a waste. **Cost: cheap, half an evening.** A
`landsIn(): number | null` on the `Enemy` interface is about seven one-liners,
since each class already has the timer, plus one branch in the target picker
for arcs, bolts and grabs. Dashes keep following the stick.

### R3. Pushed whites borrow their blue (surprising)

Each of the 8 whites gets a `pushMod`. For one cast, the pushed white does its
blue's bend, using the mod code that's already built:
- Focusing Lens pierces (Cracked Lens)
- Pressure Vent drags in (Backdraft Vent)
- Scrap Cleaver hooks (Rusted Hook)
- Kickstart ends in a slam (Skid Plates)
- Flare marks (Signal Flare)
- Ward reflects (Mirror Ward)
- Piston parries (Parry Clamp)
- Skitter vaults (Spring Heels)

It isn't strictly better: a pushed Vent pulls enemies *in*. So you push when
the other verb fits, not by reflex. Nobody has said this yet: once the pool
starts at 12, a push is how you **glimpse a blue you haven't found**, a small
look ahead at the wall of parts. What it costs the pool: finding a blue loses
some of its surprise, since it's "the push, for free, every cast". It also
competes with R1 for what a push means. I'd build R1 or R3, not both. **Cost:
cheap, about 1 evening** (one field, one line resolving the mod, card copy and
a pushed icon state). It's mostly tuning.

### R4. A push is remembered

This reward is memory, not power. A pushed hit that breaks a windup or finishes
an enemy writes into that part's history: *Scrap Cleaver, that broke a ram's
charge*. On the corkboard card, each push gets an ember tick on the run's
strain line, so the line shows where the pushes happened. It fits "parts
remember" and "no stats change". **Cost: cheap to medium, about 1 evening.**
`PartHistory` is a fixed 7-tuple, so this is a save v3 migration, following the
pattern of the existing 1 → 2 step (`save.ts`). Push ticks go beside
`tally.marks`. It works best with R1 on top of it. Without R1, "that broke a
charge" can't happen.

---

## 3. The thought coming up

### T1. The dead tap answers, and counts (surprising)

Finding 7. When a tap lands on a recharging button, the button answers: a dry
cold click, and the push ring fills a quarter of the way and drains, showing
the gesture in 300 ms. Words only once per save ("hold to push", reusing the
heat caption's code). It isn't a nag, because it only shows at the moment the
player reached for the button. The tap also gets counted: `deadTaps` goes next
to `pushes` in `DepthStats` and in `__runStats`. After three phone runs, that
number tests the owner's diagnosis. If it's near zero, the thought really never
comes up, and demand (D1–D3) is the fix. If it's high, the want is there and
the gesture is hiding it. **Cost: cheap, about 0.3 evening** (a branch in
`hud.ts` `pointerup`, one sound, one counter).

### T2. The answer glows

When a windup starts that a *cooling* part could break (R1) and reach (R2), that
part's button gets a thin ember arc on its outer rim, drawn outside the thumb's
cover. It shows up with the tell and goes out when the tell ends. Only one
button lights at a time: the one for the windup that lands soonest. It uses the
language that's already there: ember on a button already means "this is about
the enemy, push it" (the Arbiter's heat). Under it, a tiny latch tick sits in
the button's own stereo position, never counted against the windup sound cap.
Phone risk: a 62 px button under a thumb is the worst place to show anything.
If the rim can't be read on the Poco, the glow moves to Still's own cage core
(center screen), in the slot's direction. **Cost: medium, about 1 evening**,
and it needs R1/R2's `breakable` and `landsIn`. The per-frame reach test uses
the existing `inReach` / `lineClear`, for one enemy only.

---

## 4. The economy, only as it serves 1–3

### E1. Leave the numbers alone: Stopped is reachable

A check, not a change. A 6-depth run has about 24 crawl fights plus 2 bosses, so
about 26 quiets (−52), plus 1–2 Rests (−6 each). One push a fight nets zero,
forever. **Two pushes a fight Stops Still around depth 4**, and 1.5 a fight
around depth 6. So the band is set right: the first push is free, and the
second is a real bet against the run. Boss fights have no quiet at all, which
makes them where strain rises naturally, and that's where D3 puts its demand.
**Cost: none.** Quiet −2 → −1 stays reverted.

### E2. The house push (surprising)

While a fight is awake, the strain meter shows two hollow pips at its tip: the
quiet that's coming. One detail isn't shown anywhere today: **at strain 0 an
unused quiet refund is wasted** (`Math.max(0, strain − 2)`). The hollow pips
make that visible: this fight's push is on the house, and you lose it if you
don't use it. When you push, the pips fill ember. The quiet drains them as it
does now. This brings the thought up once a fight, which is what the band was
for. The risk is a rote "spend the freebie". But one push a fight *is* the
intended rate, and with R1 the freebie still goes to a particular windup.
**Cost: cheap, about 0.3 evening** (CSS on the meter, and the `awake` count
already exists).

---

## Recommended bundle: R1 + R2 + T1

**A push breaks, aims at the threat, and the dead tap answers and counts.**
About 2 evenings together.

- **R1 and R2 give the push one meaning for all 30 parts:** *answer that windup,
  now*. Demand then shows up wherever there's a windup (D1), with no new enemy,
  no new content and no change to strain. They keep every settled rule: bosses
  can't be broken, walking still answers everything, and strain doesn't make
  Still stronger.
- **T1 is the measuring stick, and it costs almost nothing.** It shows whether
  the thought starts coming up once there's a reason, so the owner can judge
  the bundle from his own `deadTaps` and `pushes` over three runs rather than
  from feel alone.

**Next, if it lands:** T2 (so the player sees the break is available) and D3
(the boss chord). D2 comes last, because it's the only pitch that reopens a
readability decision.
