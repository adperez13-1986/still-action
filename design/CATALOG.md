# Catalog: the part pool and the new enemies

Written 25-26 Sep 2026 for Adrian to read once: keep, cut, rename. It's all
built and playable already. You asked for that, so the review happens against
the real thing and not against paper. Mark the tables, then tell me what to
change.

How it was made: the three design agents, one after another (balancer, then
translator, then verifier), for the parts and again for the enemies. The full
passes are next to this file, in `parts/` and `enemies/`. Each is long, and you
don't need them unless a line here makes you ask "why".

The rules they were briefed with are yours: one part = one ability, tiers mean
*different* not stronger, runs get wider not stronger, rules are symmetric,
every threat is telegraphed, cold for Still and ember for enemies, no melee
magnetism, and nothing for Yanah or Yuri. Their two parts are still yours to
write, and there are no placeholders for them.

---

## Try it

- Live after the push: https://adperez13-1986.github.io/still-action/
- `?depth=3` still starts at the Assembler with the four plain parts.
- Parts drop from the start. There are 30 in the pool now, so a run shows you
  maybe half.

---

## The parts (30)

8 white, 16 blue, 6 gold. Every blue or gold names the white it bends and what
it gives up for the twist. The card line is exactly what the pickup card says.

"Held" means the push gesture (hold a recharging button, +2 strain), same as
today.

### Head: reaches far

| | part | tier | card line | gives up | keep / cut / rename |
|---|---|---|---|---|---|
| H1 | Focusing Lens | white | A heavy bolt at your target. | (the baseline) | |
| H2 | Flare | white | Lobs a burst over walls onto where the enemy was standing. | lands 0.8s late, 18 dmg (a hidden sentinel needs two) | |
| H3 | Cracked Lens | blue | The bolt passes through every enemy it hits. Walls still stop it. | less damage per hit, for a whole line | |
| H4 | **Ricochet Lens** | blue | A bolt that bounces off walls to reach enemies behind cover. | weaker. The sentinel you bank into **shoots back down the same path**: bank, then move | |
| H5 | Patient Lens | blue | Charges between shots. Push it for a full shot. | 6 to 32 by wait; lower damage per second | |
| H6 | Signal Flare | blue | Marks enemies where it lands. Your next part hits a marked one twice. | does almost nothing on its own | |
| H7 | **Through-Line** | gold, boss only | A bolt through enemies and walls. The holes it leaves let shots through both ways. | every solid it crosses opens for 4s **for both sides**. Shoot through your own cover and the sentinel behind it can see you | |
| H8 | Overclocked Coil | gold | Three bolts at once, ready fast, but every shot adds strain. | +1 strain per cast, pushed or not | |

H4 and H7 are the two bolts you asked for. The bounce goes off walls, not
between enemies: chaining between enemies is just a pack damage multiplier and
an unreadable web on a phone. Bouncing off walls uses the cover system instead.
The pierce-everything bolt breaks the symmetry rule on purpose, so the price
puts it back: the hole works both ways.

### Torso: works around Still

| | part | tier | card line | gives up | keep / cut / rename |
|---|---|---|---|---|---|
| T1 | Pressure Vent | white | A blast around you that shoves enemies away. | (the baseline) | |
| T2 | Ward | white | A brief shield that destroys enemy shots. | does nothing against melee or shockwaves | |
| T3 | Backdraft Vent | blue | The blast drags enemies in instead of out. | pulls them inside a hulk's strike range | |
| T4 | Chill Vent | blue | A cold blast that makes enemies walk slowly for a while. | no shove; never slows an attack, only the walk | |
| T5 | Brace | blue | For a moment, hits cost you strain instead of integrity. | spends the run. A hit that would reach 20 **Stops** Still instead of Breaking him | |
| T6 | Mirror Ward | blue | A brief shield that sends enemy shots back at whoever fired them. | shorter window; at most 6 shots back | |
| T7 | Lure | gold | Leaves a decoy of you that enemies go after, until it bursts. Push it to burst it early and leave another. | nothing immediate; the boss ignores it | |

### Arms: close

| | part | tier | card line | gives up | keep / cut / rename |
|---|---|---|---|---|---|
| A1 | Scrap Cleaver | white | A wide swing at whatever is closest. | (the baseline) | |
| A2 | Piston | white | A hard, narrow punch that knocks one enemy back. | 40° instead of 120° | |
| A3 | Rusted Hook | blue | A long, narrow swing that yanks enemies to you. | brings trouble to you (reworked: now reaches a sentinel) | |
| A4 | Parry Clamp | blue | A quick snap. Catch an enemy winding up and it breaks the attack. | weak unless you time it into their windup; the boss can't be broken | |
| A5 | Frayed Cleaver | blue | A swing that grows wider the more strained you are. | narrower than the Cleaver below 6 strain, full circle at 12+ | |
| A6 | Clamp Toss | blue | Grabs the nearest enemy and throws it the way you're steering. | less damage; you choose where it lands (a wall adds damage) | |
| A7 | Anvil | gold | Catches the next blow that would hit you and hammers back. Shots get through. | no damage unless you step into a windup on purpose | |

### Legs: move him

| | part | tier | card line | gives up | keep / cut / rename |
|---|---|---|---|---|---|
| L1 | Kickstart | white | Dash, running over anything in the way. | (the baseline) | |
| L2 | Skitter | white | A quick little hop the way you're steering. | no damage; ready every 3.2s | |
| L3 | Skid Plates | blue | The dash ends in a blast that shoves enemies away. | shorter dash (reworked: the blast now shoves) | |
| L4 | Overrun | blue | A short step. Push it for a long charge that hits. | all its damage costs strain | |
| L5 | Frost Trail | blue | A dash that leaves a cold track that slows enemies on it. | no damage; a ram that rushes across it trips | |
| L6 | Spring Heels | blue | A hop that clears a low wall, landing heavy on the far side. | a short landing lock after a vault | |
| L7 | Plumb Line | gold | Drop an anchor, then press again to snap back to it. Push it to drop a new one where you stand. | first press does nothing on its own; won't snap from over 10u | |
| L8 | Borrowed Time | gold, boss only | Rewinds you a moment and undoes the hits you took. Adds strain. | +2 strain every cast (+4 held) | |

**What was cut:** a vent that traded integrity for strain relief. Quiets refill
integrity, so it made strain free. No part in the pool lowers strain.

---

## The new enemies

### The ram (charger): from depth 2

A rusted boiler on four short legs with a plough for a face. It's twice as
long as it is tall, so it can't be mistaken for a hulk. An ember seam down its
back points where it will run.

- **Tracks, locks, rushes.** Faint rails show while it tracks. At the lock the
  rails snap bright, its head drops, and you hear a heavy latch. 405ms later it
  rushes at 18 u/s for 14, carrying past where you stood.
- **The lane is drawn to where it really hits.** The boss's charge lane used to
  be drawn narrower than its hit. That's fixed too, so depth 2 teaches depth 3
  honestly.
- **Walls are the answer.** A wall or crate behind you turns its rush into a
  1.2s stun, with an open hatch on its back: it takes 1.5x while stunned. The
  end of the lane shows a star when it will hit something, and skid streaks
  when it will end in the open.
- It shoves its own pack aside, and it trips on a Frost Trail.

### Swarf mites (swarm): from depth 4

Small iron domes with six legs and one ember dot each, 6-8 to a pack. An
invisible "brood" steers them as one:

- **4 bite, the rest wait.** Four circle close and the rest hang back outside
  any vent's reach, so one Pressure Vent can't delete the swarm.
- **One shared bite.** It's a ring on the floor, in one piece per jaw, placed
  where you'll be in about half a second. 550ms later it closes. More pieces
  means more damage (max 12), and it can bite at most every 2s.
- A Still who never dodges takes at most about 6 damage a second. One who
  moves when the ring appears takes about none.
- One skitter voice per brood, not 8 sets of footsteps, so it doesn't turn
  into noise.
- The elite is the **brood-mother** (Quick or Warden only).

Deeper levels get more varied, never stronger: packs are budgeted in
"body-equivalents" (hulk 1, ram 1.5, mite 0.25). By depth 7 you meet packs with
all four archetypes.

**Elites.** Every ram elite gets one body feature: Quick an ember exhaust,
Plated flank plates that flare open when it's stunned (it takes half damage
until it hits a wall), Many twin stacks and a split seam (it breaks into two
rams), Warden a lamp mast. In a Warden's pack, the embers of the protected rams
and mites go dark ("sealed") and ripple back on when the Warden falls.

**Readability in a crowd.** The tell closest to landing draws on top. Tracking
tells dim while another is locked. Committed locks (ram, sentinel, swarm) are
kept 300ms apart across the room, so two never land together. At most three
windup sounds and three footsteps play at once. Everything goes a little quiet
just before a ram rushes.

### What to try on the phone (the laptop can't answer these)

1. **Frame rate at depth 7+.** CPU is fine even at 4x throttle (p95 7ms). The
   GPU side (about 300 draw calls with bloom, at your DPR) couldn't be measured
   here. If it stutters, bloom or resolution is the first dial, not the
   enemies.
2. **Can you step off a ram lane** in the 405ms after it locks, from 3.5u?
3. **Can you step out of the mites' ring** in 550ms?
4. **Do you see a ram start tracking?** The rails are very faint on purpose,
   maybe too faint in Grace's light.
5. **Can you count the mites' embers** at the widest zoom?
6. **Does "four pieces = big bite" teach itself?**
7. **Swarms under a Vent:** about 45% of their bites break before landing.
   That's intended, but check they don't feel toothless.
8. **The first ram stun holds 0.12s.** Does it land as a lesson, or feel like
   a hitch?

---

## Decisions I made tonight, so you don't have to (reverse any)

1. **A quiet needs a kill.** You could wake a pack, outrun it until it walked
   home, and get the quiet (−2 strain, half HP) every few seconds, forever. Now
   a fight counts as cleared only if something died.
2. **Still's melee and blasts need a clear line**, like the hulk's. The
   Cleaver and Vent used to hit through waist-high walls. Symmetric now, and it
   also trims the Cleaver's "doing too much" without touching its numbers.
3. **Drops scale with pack size:** 0.66 ÷ pack size per kill, so a pack pays
   out about the same at every depth. At a flat 22%, deeper levels were twice
   as rich, and an 8-mite swarm would flood the floor. Elites: 75% blue, 10%
   gold. Gold otherwise only from elites, the boss (always 1 blue + 1 gold) and
   Plenty. That works out to about 3-4 golds a run.
4. **Lure's decoy appears 1.5u behind you**, not at your feet, or the first use
   looks like nothing happened.
5. **Through-Line and the lobs aim at awake enemies first**, so they don't wake
   a second pack by accident.
6. **Overrun's charge can only be reached by push**, i.e. while it recharges
   after a step. Holding a *ready* button still does nothing, because that's
   your open "hold means two things" question.
7. **A hit inside the hurt window deals the difference if it's bigger.** One
   0.35s window used to throw away everything after the first hit, so a 3-dmg
   mite bite could swallow a 14-dmg ram rush.
8. **Enemies free their GPU memory** when a level ends. They were leaking
   geometry on every level change. It changes nothing you can see, but a long
   run on the Poco should stay smoother.

## Open, yours to call

- **Shot trails.** `combat.vfx` was never wired, so Still's bolts and enemy
  shots have had no trails since the effects commit (the part effects do have
  them). It's one line to turn them on, but every shot would look different,
  so I left it for you to see first.
- **Knockback goes about 8% past its number** (a 60Hz stepping thing). It
  could be exact with one constant, but that changes how the Vent, Kickstart
  and Skid feel. Your call on the phone.
- The numbers most worth arguing with, all untested on a thumb: Signal Flare's
  4s mark (Signal + Vent kills a pack of 3 in two presses), the ram's 405ms
  lock, the mites' 550ms bite windup, and the Frayed Cleaver thresholds (6 and
  12).
- The ending words are still yours to write, and so are Yanah's and Yuri's
  parts.
