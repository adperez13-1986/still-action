# Round 1: Translator (mechanics, UX, feel on the phone)

Pitches, not a spec. Each one has a name and a short body, then **You** (what
you see, hear and feel, and what the right thumb does), **Why** (why it fits
Still), **Parts** (which of the 30 it breaks, makes useless or makes too
strong), and **Cost**. Cheap means an evening or less, medium two or three,
big more than that. *Surprising* marks ideas that none of the existing
documents have.

Scale, from the enemies pass: the Poco in landscape is about 400 CSS px tall,
so a unit is **about 23 px at zoom 1 and 16 px at the widest zoom (0.7)**. The
ability arc is four 60 px buttons on an r132 quarter circle in the bottom
right corner: head at the low-left end, legs at the high-right end. The right
thumb rests near the middle of the arc, between torso and arms. Strain is a
210 x 7 px bar at the top centre.

## Why the thought doesn't come up, read off the screen

These come from `src/hud.ts` and `src/style.css`, not from theory.

1. **A recharging button looks switched off.** The cooldown is a conic sweep
   of `rgba(6,10,15,.78)` over the icon, which is how every phone app draws
   "disabled". Nothing on a cooling button says "available, at a price".
2. **There's always a lit button, and the thumb goes to lit things.** Scrap
   Cleaver (2.6 s) is ready about every other second. A thumb in a fight looks
   for a glowing button, not a dark one.
3. **The hold is silent until it fires.** From pointer-down to 180 ms, the
   only feedback is a 0.93 scale. There's no clock for "keep holding", so a
   hold never gets discovered by accident. It feels the same as a tap that
   didn't work, and the thumb lets go.
4. **The one designed push moment arrives at minute 24.** The Arbiter's heat
   and its 1.2 s vent (depth 6) are the only place the game asks for a push.
   The one-time hint fires for 2 of the 30 parts (Patient Lens, Overrun), once
   per save.

So the pitches below work on three things. Openings have to happen often
enough that some land while the right part is cooling (demand). The push
into an opening has to pay more than "early" (reward). And the game has to
point from the opening to the thumb, through the eyes (on Still), the ears
(stereo) and the thumb itself (haptics and the rim), at the moment it
happens (the thought).

---

## Topic 1: Demand, moments that ask for a push

### D1. A miss is an opening
When a hulk's slam lands on empty floor because Still stepped out, its fists
stay buried for its existing 760 ms recover, and it takes x1.5, the ram's
`stunMul`. A slam that hits Still recovers as it does today. The brood gets
the same rule: a bite that closes on nothing leaves the four biters tumbled
on their backs, legs kicking, for their existing 800 ms recover, at x1.5.
It's the one opening in the game that happens at depth 1, several times a
fight. That matters more than any single number: a push is wanted when an
opening *happens to land* while the right part is cooling, so openings have
to be frequent before the coincidence can be. A stuck hulk (30 HP) dies to
one heavy part (Focusing Lens or Piston: 39) but not to the Cleaver alone
(27), so the question is often "is my Lens ready?", and the answer is often
no.
- **You:** You step out of the ember disc and the slam thumps into stone
  behind you. Its back plate lifts over a brighter core, and a grinding tail
  plays, panned to it, for exactly 760 ms, so your ear knows when the window
  shuts. The hulk is 2-3 u away (46-69 px). Your thumb just spent the Cleaver
  on the approach, the Lens button is dark, and that's the moment.
- **Why:** The rules are symmetric: enemies already punish Still for
  committing in the wrong place, and now Still can punish theirs. It also
  makes depth 1 teach the Arbiter's vent at depth 6.
- **Parts:** Parry Clamp keeps its niche (it breaks the windup *before* the
  slam; this rewards dodging it). With Lure, a slam on the decoy counts as a
  miss. That's strong on a 12 s gold part, and I'd allow it, but it's your
  call. Nothing breaks.
- **Cost:** cheap. A flag at the strike (did it connect?), a pose, the x1.5
  the ram already has, one sound.

### D2. HP or strain: the move you can't walk out of
The Assembler's magnet (phase 2: pull 3.3 u/s in r3.6, then 20 damage, 1500
ms windup) gets tuned and drawn so that walking out of its **inner ring**
fails. Only the outer ring is walkable. From the inner ring you have three
answers: leave with a leg part, meet it with a torso or arms part, or take
the 20. That's the thesis, "HP is the fight, strain is the run", made into a
decision your thumb makes in a second and a half. Future bosses each get one
move like this. The Arbiter already has its version (the heat).
- **You:** The magnet's floor tell draws two rings. The inner one is darker
  ember, and a low rising drone pulls in from both speakers toward the
  centre. You're inside, and the legs button (the top of the arc, where your
  thumb has to reach up about 130 px) is dark with 4 s left. Either you slide
  up and hold, or you brace for the hit.
- **Why:** It's telegraphed and committed, and it's honest: the inner ring
  is drawn exactly where walking fails. Paying HP instead is a real choice,
  because a quiet refills half of it and nothing refills strain.
- **Parts:** This gives the strain parts their scene. Anvil catches the
  magnet's blow and hammers back. Plumb Line snaps out if the anchor is
  outside. Borrowed Time rewinds out of it. Brace turns the 20 into 3 strain
  (ceil 20/8). Kickstart and Skitter clear it. Ward does nothing (melee),
  and its card already says so. Nothing is made useless.
- **Cost:** cheap. Tuning plus a second ring in the existing tell. The
  balancer owns the pull numbers.

### D3. The pile-up
A ram's rush already shoves its own pack aside. Now a packmate it shoves
*into a wall* goes into the same wall stun the ram gets, 1.2 s at x1.5, and
a ram that drives two or more bodies into the wall stuns with them. A player
who stands with a wall at their back and a hulk between them and the ram
gets a heap of stunned enemies in one place. For 1.2 s, one Pressure Vent or
Cleaver clears the pack, if it's ready.
- **You:** At the lock, the lane's end star now sits on a hulk's silhouette.
  The rush hits with a double clang, bodies stacked against stone, every
  hatch and back plate open. Three open cores glow in a 2 u pile (32-46 px):
  one Vent's worth. The torso button is dark with 3 s left.
- **Why:** Symmetry again: the ram's rule applies to anything the ram
  carries. And a big opening you *set up* by standing somewhere is the kind
  of opening worth the strain.
- **Parts:** Backdraft Vent (drags the heap tighter) and Pressure Vent
  become the pile-up parts. Nothing breaks.
- **Cost:** medium. Rush-carry needs a "shoved into a solid at speed" check
  per packmate, plus a stun state on the hulk and the sentinel (the hulk
  gets one for D1 anyway).

### D4. The runaway (*surprising*)
The thief stops being a thing you walk down eventually. While you chase it,
it heads for a floor grate, which lights cold the moment it wakes, and 4 s
after it reaches the grate it drops through. The part in its cage is gone
**for this run**. It stays in the pool, because every ending keeps
everything. This is the only demand where waiting costs a *thing you can
see*: a part in a cold-lit cage, getting further away. This reverses one
line in `design/content/DESIGN.md` ("It never leaves the level"), which
isn't on the brief's settled list, but I'm flagging it.
- **You:** A cold square on the floor 12 u off, a cold cage bobbing toward
  it, the thief's little feet ticking fast. You close about 1 u/s on foot,
  which isn't enough. The legs button is dark. The thought is plain: dash
  now, or hook it (Rusted Hook, 5.5 u), or throw a pushed Lens.
- **Why:** It's area I (depth 2 on), so it's a push lesson early and in
  miniature, with no damage at stake. And the loss has a shape: it's a part,
  not a number.
- **Parts:** Rusted Hook, Clamp Toss and Frost Trail each get a new use.
  Skitter becomes a real chase part. Nothing breaks.
- **Cost:** cheap. A grate target in the thief's flee logic, a timer, a
  cold floor decal, and a small "it got away" sound.

---

## Topic 2: Reward, pushed forms worth wanting

The push already feels good: scale 1.16, shake 0.34, 60 ms hitstop, the
grind, ember sparks off Still's joints, a [14, 26, 14] buzz. Feel isn't what
it's missing. What it's missing is **a reason that exists only in the
moment**, because a reward that's always on turns into autopilot inside the
free band.

### R1. Held open
A pushed part that hits an enemy inside an opening (D1's stuck hulk or
tumbled mites, the ram's wall stun, the Assembler's stun, the Arbiter's
vent) **re-opens it: its timer refills by 600 ms, once per opening**. An
unpushed hit only takes the x1.5. So a push buys what nothing else can:
room for a second part. Outside an opening it does nothing extra, so there's
no rule to follow on autopilot. It only pays when you've seen the door.
- **You:** Every opening wears a thin cold ring on the floor under the enemy
  that drains as its window runs out. It's the same drain as the button's
  LIVE ring, so the grammar is shared. Your pushed Lens lands as the ring
  nears empty: the hatch bangs back open with a bright clang a fifth above
  the normal hit, and the ring snaps back to full. Now the Cleaver you had
  ready has somewhere to go.
- **Why:** Still reaching past his limit to keep a door from closing: that
  is what straining is. It turns the push into a *key*, not an accelerator.
- **Parts:** Patient Lens is the best key (a pushed shot is always full, 32).
  Overclocked Coil can hold a door for +3 strain a time. That's strong but
  self-limiting, because it's a real bet above the band. Signal Flare plus a
  pushed hit is the biggest single boss hit in the game. Watch that in the
  sim, but it's a two-part setup, which is fine.
- **Cost:** cheap to medium. A per-opening timer and one refill flag on the
  ram, the boss and the Arbiter (all three already have an `open` or
  `stunned` state), plus D1's two new ones, and the floor ring.

### R2. Walls break them (*surprising*)
The ram teaches you that a wall behind you turns its rush into a stun. Turn
that around: **a pushed shove that drives an enemy into a solid, cut short
by at least 1.5 u, stuns it 0.8 s at x1.5.** An unpushed shove just stops at
the wall, as today. So pushing Pressure Vent, Piston, Kickstart's run-over,
Skid Plates' blast or a Clamp Toss becomes a question of *where the enemy
is*: near cover, the push is worth wanting, and in the open it isn't. The
1.5 u "cut short" rule matters because corridors are only 4 u wide, and
without it every pushed Vent in a corridor would stun the whole pack.
- **You:** A hulk with its back to a barrier. You hold the torso button, the
  blast shoves, the hulk hits the wall with the ram's star-burst on impact
  (the glyph you already know from the lane end), and its back plate lifts.
  It reads as "I did to it what the ram does to itself".
- **Why:** The rules are symmetric, walls already are the answer, and this
  gives Still's own offence a use for the level's geometry, not just
  its defence.
- **Parts:** Clamp Toss gets stronger (it already adds 12 on a wall; now a
  pushed throw also stuns). It's a blue, and I'd keep it. Pressure Vent in
  side rooms (3x3) could get too good. Check that 3x3 rooms don't make every
  pushed Vent a stun. Backdraft Vent and Frost Trail are unaffected.
- **Cost:** medium. Shoves need a "stopped by a solid, and by how much" at
  resolution. Clamp Toss's `short` flag is the model.

### R3. The last word
A **pushed** hit that kills the last awake enemy lands the quiet on the
blow instead of 2.5 s later. Time drops to 30% for 400 ms, the quiet's chime
lands on the impact, and the −2 flies from the corpse to the strain meter as
**cold** motes, the reverse of the ember pips a push sends. It's the free
band made visible and made into a moment. It will become a habit, one push
per fight, and I'd let it. A habit means the gesture is in the thumb before
the openings that really need it come.
- **You:** One hulk left, limping in, the Cleaver 1.5 s off. You hold. The
  swing, the slow, the chime, and two cold motes climbing to the top of the
  screen while the meter drops back to where the fight began.
- **Why:** "Show up, that was enough" at fight size: the last push is paid
  back in front of you.
- **Parts:** Overclocked Coil and Borrowed Time's own cast strain don't count;
  only a push does. Nothing breaks.
- **Cost:** cheap. The quiet already exists; this triggers it early and adds
  a time-scale dip and reversed pips.

### R4. A push reaches (the risky one)
One rule across all parts: **pushed, a part's reach is x1.5** (bolt range,
arc reach, nova radius, dash and hop travel). It answers D2 (a dash that
clears the inner ring) and far openings (the Assembler stunned 20 u away).
I'm listing it for completeness and wouldn't build it first, because it's
always on, and that's the autopilot the brief warns about.
- **You:** The pushed swing draws visibly longer. It's easy to read.
- **Parts:** It erodes Rusted Hook's identity (a pushed Cleaver reaches 4.65
  u against the Hook's 5.5) and Spring Heels' (a pushed Skitter hops 5.1 u).
- **Cost:** cheap to build, expensive in tuning.

---

## Topic 3: The thought coming up

### T1. The cooling button isn't dead
Redraw the recharging state from "off" to "costs 2". The dark sweep drops
from .78 to about .5 opacity so the icon stays legible in its tier colour,
and **two hollow ember pips sit on the bottom rim** while it's cooling. That
extends the rule that's already there ("the price on the rim, before you
press it") to the push. When the button comes ready, the pips go and the
cold glow comes on, as today. A part with its own price shows both: Borrowed
Time cooling reads ●● ○○.
- **You:** At a glance, the arc is four lit buttons. Two glow cold, and two
  show a small ember price. None looks switched off.
- **Why:** It's honest (nothing is hidden or blocked), it's the existing pip
  language, and the price stays on the part.
- **Parts:** none.
- **Cost:** cheap. CSS plus one line in `paint()`.

### T2. Still looks (the bundle's centre)
When an opening begins (D1, D3, a ram wall stun, a boss stun or vent) and a
cooling part could land in it, three things happen at once, one per
channel. **Eyes:** Still's lens stalk swings to the opening in 80 ms and the
lens glints cold, on the character your eyes are already on. **Ear:** a high
metallic *tink* panned to the enemy, then a thin hiss that runs as long as
the window. **Thumb:** one 8 ms buzz, and on the right button a 3 px ember
thread circling the rim once every 600 ms. Peripheral vision sees motion,
not colour, so it has to move. "The right button" means the heaviest cooling
part that can reach the enemy. For D2's "leave" moves, it's the legs button.
It never lights more than one button, and it never fires when a part that
can answer is already ready.
- **You:** Stuck hulk, 2 u away, and Still's head turns to it. *Tink*, a
  small buzz under your thumb, and the head button, low left on the arc,
  has a thread running round it. Your thumb slides left about 60 px and
  stays.
- **Why:** Still noticing the opening is Still wanting to push. It's his
  wish, not a tutorial's. Grace's light already leans toward the exit, and
  this uses the same grammar: something in the scene points.
- **Parts:** none directly. "Can reach" needs each shape's reach test
  (bolt: range and line, arc: `inReach`, lob: range, nova: radius).
- **Cost:** medium. An "opening started" event from every enemy that has one
  (most already emit something: `stunEnd`, the Arbiter's `vent`), a head
  look in `still.ts`, a sound, a HUD class, and a reach check per part.

### T3. The mash is the want (*surprising*)
When a player taps a cooling button, they're telling you they want it now.
That's the thought, just not in words. So catch the tap. A tap on a cooling
button draws an ember arc 120° round the rim and pulls it back (90 ms),
with a dry latch *tk*. A second tap within 500 ms draws it to 240° and
holds it there 250 ms with a whisper of the push grind. If the thumb stays,
it completes and pushes. And every hold on a cooling button gets a visible
clock: **the ring draws 0 to 360° over the 180 ms and the push fires as it
closes.** Today that stretch shows nothing. Taps alone never push. It
isn't a one-time hint: it answers every mash, forever, because every mash
is the moment.
- **You:** Panic-tapping the Lens as a sentinel's line swells, you see the
  button *almost* go. The second time, you hold.
- **Why:** It teaches the gesture at the one moment the player already
  wants it, and never costs strain by accident.
- **Parts:** none. It also leaves "hold means two things" open: holding a
  *ready* button is still unbuilt aim.
- **Cost:** cheap. Pointer timing already lives in `hud.ts`. Add a tap
  counter and the ring as a CSS `--arm` angle.

### T4. The crack (optional)
An enemy that a cooling part in reach would kill **if pushed now** shows a
hairline of cold light across its core. It's the "that would finish it"
thought drawn on the enemy. The hairline stays hidden for sleeping enemies
and while a ready part could already kill. It's the most direct of these,
and the most like reading a stat. Pair it with T2 only if T2 alone doesn't
land on the phone.
- **Cost:** medium. A per-frame damage check over awake enemies in reach.

---

## Topic 4: The economy, only where it serves 1-3

### E1. The waterline
When a pack wakes, a thin cold tick drops onto the strain meter at the
current strain: the fight's **waterline**. Pushes fill above it in ember,
and the quiet drains back toward it. After a fight with one push you land
exactly on the tick. After two you're a push above it, in plain sight. It
makes the free band legible without words, so the first push of a fight
feels like a loan the quiet will pay back and the second like a bet. It
serves R3 (the cold motes fly back to the tick) and T1 (the price on the
button, and where it lands).
- **You:** A 2 px cold tick on the 7 px bar. The ember fill climbs past it
  and slides back to it at the chime.
- **On Stopped:** a run has about 30 fights, so the band covers about 30
  pushes. Stopped needs about 10 pushes *above* the waterline, give or take
  Plenty's +4 and Rest's −6. With D1-D4 making maybe 2-4 real push moments a
  level, Stopped becomes reachable by choosing it and not by drifting there.
  I'd change no cost numbers.
- **Cost:** cheap. The meter already draws notches (Frayed Cleaver's).

---

## Recommended bundle: D1 + T2 + R1

**A miss is an opening, Still looks, held open.** They're one loop, and each
fails without the other two:

1. **D1** makes openings happen at depth 1, several times a fight, so some
   of them land while the right part is cooling.
2. **T2** points from that opening to the one cooling button, through the
   eyes, ear and thumb, the moment it happens. That's the thought the owner
   says never comes up.
3. **R1** makes the push into it buy something waiting can't (a second part
   in the same window), and only there, so it doesn't turn into autopilot.

Roughly three to four evenings. If there's one more cheap evening, add **T3**
(the mash and the arming ring): it's the smallest change here with the
largest effect on whether a hold ever happens by accident.

What to try on the phone, in this order:
1. At depth 1, does Still's head turn read at 16 px/u, or only the buzz?
2. Does the thread on the head button get noticed while your eyes are on
   the hulk?
3. How many times a level does "stuck hulk + Lens cooling" happen?
4. After a few runs, do you push without the thread?
