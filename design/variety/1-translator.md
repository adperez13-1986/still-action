# Round 1: Translator (feel, thumbs, phone-scale reads)

Pitches, not a spec. Each one has a name, a few sentences, then **You** (what
you see, hear and do), **Why** (why it fits Still) and **Cost**. Cheap means
an evening or less, medium two or three, big more than that. *Surprising*
marks ideas none of the existing documents have.

Scale, from the enemies pass: `viewHeight` is 17 u and the Poco's landscape
view is about 400 CSS px tall, so a unit is **about 23 px at zoom 1 and 16 px
at the widest zoom (0.7)**. The stick lives bottom-left and the four 62 px
buttons sit in an r96 arc bottom-right. Each thumb hides roughly a 200 px
corner, so nothing that has to be read should live in the bottom corners.

Three rules shaped every pitch. If you reject one, the pitches built on it
go with it.

1. **Where you stand is your only aim.** Under auto-aim, every playstyle's
   skill has to be *position*, and the screen has to draw what your position
   will make happen before you press. Today it draws the enemy's intent
   (rings, lines, lanes) and none of yours.
2. **One silhouette change, one tell change.** A variant is nameable at
   16 px/u with its core dark. Its twist shows in its tell, never only in a
   hidden number.
3. **Cold is Still's, and whatever he lends; ember is threat.** The thief's
   cage stays the only cold light on an enemy. So Still's marks and notches go
   on the floor under an enemy, not on its body.

---

## Two facts first

### 1. The brawler already exists in the numbers. The screen hides it.

A hulk winds up when you're within 2.0 u and its slam hits everything within
**2.4 u** of its centre. Still's arms reach a body, not a centre
(`inReach`: range + 0.6 pad + body radius - 0.55). Against a hulk that works
out to:

| arms part | reaches a hulk from | safe band outside its slam | on screen at zoom 0.7 |
|---|---|---|---|
| Parry Clamp | 3.2 u | 2.4-3.2 (0.8 u) | 13 px |
| Scrap Cleaver / Frayed | 3.7 u | 2.4-3.7 (1.3 u) | 21 px |
| Piston | 4.0 u | 2.4-4.0 (1.6 u) | 26 px |
| Rusted Hook | 6.1 u | a long way | - |

Stepping from 2.0 to 2.5 takes 0.5 u, about 90 ms at 5.5 u/s, inside a 520 ms
windup. Then the hulk stands in its 760 ms recover, **inside your reach and
outside its own**. That is a real footsies game: bait the rear-up, take one
small step, not a run, and swing into the recover. Kiting a hulk with the auto
takes about 3.7 s (8 dps against 30 HP). Dancing on its rim with a Cleaver
takes about 2 s. Standing close already kills twice as fast and faces half the
windups. Nobody plays it because nothing on screen says the band is there. The
band is thumb-sized, 13-26 px, a single nudge of the stick.

### 2. Why the owner has never met the thief

It spawns at depth 2 only, in 35% of levels, nests in the side room furthest
along the level, and only moves when a part lies on the floor unguarded. Every
floor part the owner leaves is one he looked at and declined. So the one
condition that wakes the thief is a part he doesn't want. Even if he'd seen it,
losing a declined part feels like nothing. **The fix isn't the odds. It's what
the thief goes for.**

---

## A. Enemy variety

### A1. Families: one prop, one tell (cheap per variant)

Each archetype gets two or three variants that run the same state machine
with one new prop on the silhouette and one twist in the tell. Names come from
the old roster, so the notebook has pages ready. The prop sits on the top or
the front of the body (the camera is at 38°), never at the feet, where the
tells draw.

| family | variant (old name) | prop | twist, as you see it | favours |
|---|---|---|---|---|
| hulk | **Bulwark** (Vault Keeper) | a door slab on one forearm | bolts and the auto stop on the slab from the front, the same as a wall. It's open from the sides and from above (lobs) | close, lobs |
| hulk | **Iron Crawler** | low and long, a spine of plates | its slam is a lane 4 u long in front of it, not a ring. Step beside it and you're still close | close |
| sentinel | **Thermal Scanner** | a second, smaller lens | its line freezes, fires, then fires again down the same line 300 ms later. Step off once and stay off | far (cover) |
| ram | **Drifting Frame** | skids for feet, no plough | it bounces off walls instead of stunning. The open floor is the answer now, so the ram's lesson is turned inside out | far, open ground |
| mites | **Furnace Ticks** | one brighter ember each | each tick leaves a small slag puddle where it dies (the existing hazard). Killing them in a clump paints the floor | far, around |

**You:** at the widest zoom a Bulwark reads as "a hulk holding a door" before
you've read anything else. The first bolt that clangs off the slab and throws
blue sparks teaches the rule on the spot.
**Why:** it's D2's families (Fallen, Carver, Devilkin), sized for one person.
The 43 old names come back as bodies, not only as pages.
**Cost:** cheap each. About 0.5-1 evening per variant: a prop mesh, a
`hide.ts` row, one branch in the tell. Iron Crawler's lane reuses the ram's
lane tell.

### A2. Champions with stacked marks (medium)

From depth 4, an elite carries **two** mods, and each area's named unique
(A3) carries three. Every mod already has, or gets, a **body feature**, like
the ram set does today (Quick an exhaust, Plated flank plates, Many twin
stacks, Warden a lamp mast). So a stack reads from the silhouette: a hulk with
an exhaust and plates is Quick and Plated before you read a word. The list
grows with behaviours, never stats:

| mod | body feature | what it does | favours / annoys |
|---|---|---|---|
| Quick, Plated, Many, Warden | as today | as today | as today |
| **Grounded** | bolted iron feet | can't be shoved, pulled or thrown | annoys Vent, Hook, Backdraft, Toss; favours bolts |
| **Echoing** | a second, fainter core | its strike lands again 500 ms later, in the same place. Don't step back in | annoys rim-dancing; favours far |
| **Mirrored** | a polished face plate | bolts that hit its front come back down the same line (Mirror Ward, turned round). Melee and lobs are fine | favours close, lobs; annoys far |
| **Tethered** | an ember chain to one pack-mate | when either falls, the other reels for 2 s (open ×1.5) | favours strings, marks, focus |
| **Kindled** | a dripping seam | leaves a slag puddle every 3 s as it walks | favours far; annoys close |

**The label at phone size.** The name floats above the body in the elite
blue, about 11 px. At the moment the pack wakes, the titles show under it for
2 s as short words ("Quick · Grounded"). Then only the name stays, with one
small sigil per mod, the same sigils the notebook uses. Nobody reads
"its whole pack moves fast" mid-dodge. The silhouette carries it.

**You:** a pack wakes with its flash and alert, a name comes up, two words
flicker under it and fade, and you see the bolted feet and know your Vent
won't move it.
**Why:** D2's champions and uniques are memorable because the mods *stack*
into a problem. Here the stack also asks for a build (see C).
**Cost:** medium. Two mods per leader is a small change in `dungeon.ts`. Each
new mod is a body feature and a behaviour (about 0.5 evening each). The label
change is small.

### A3. Named ones: "Somewhere here" (cheap-medium) *surprising*

Each area has two or three named uniques from the old roster, and a run draws
one per area. The **depth banner names it**: "Depth 2 · Somewhere here: the
Vault Keeper." It has a fixed look, fixed three mods and a notebook page with
its old flavour line. The First Warden keeps its line: *"It does not remember
what it was built to protect. It only remembers the door."* It stands in front
of the exit room's way in. When it falls it always drops a part, and the part
carries its name the way parts already remember ("Piston, taken from the
First Warden").

**You:** you read the banner, and for the rest of the level you're half
looking for it. When a pack wakes and that name comes up, it lands as a
meeting, not a spawn.
**Why:** it's D2's Bishibosh and Rakanishu, and it's the notebook's reason to
exist. It's also how the old game comes back without porting its turn-based
intents.
**Cost:** cheap-medium. Data, a banner line, a notebook page per unique. The
bodies are A1 variants with A2 mods.

### A4. Pack roles, drawn as threads on the floor (medium)

Supports that make a pack more than a pile of bodies. Each one draws **one
ember thread on the floor** (a decal, never in the air, so threads don't cross
labels) to whatever it helps. There are never more than three threads on
screen.

- **Mender** (the Martyr Shell): a small crane on legs that keeps behind its
  pack. When a pack-mate falls, it winds up a revive: a thread to the body,
  the body's core lighting from the centre out over 1.4 s. It's a committed
  windup, so a pushed hit breaks it and killing the Mender ends it.
- **Pylon** (the Ward Pylon): doesn't walk. It stands behind cover and seals
  every pack-mate its threads reach (the Warden's dark-ember "sealed" look,
  already built). You go and get it, or you lob onto it.
- **Screen**: a Bulwark paired with a sentinel walks between you and it. It's
  D2's "ranged behind melee", done as formation.

**You:** a hulk falls and a thin ember line runs across the floor to it from a
crane-thing at the back. You have 1.4 s to decide whether that's worth a
push.
**Why:** it's the "roles that work together" of the brief, and each role asks
a different archetype for help (C).
**Cost:** medium. Mender and Pylon are new small bodies. The thread is one
shared decal. The sealed look already exists.

### A5. Rosters per area, drawn from a pool (cheap, once A1 exists)

Each area gets a pool of about eight bodies. A run draws its roster per area:
the base three always, one or two variants, one named unique. The lessons stay
fixed (depth 2's ram, depth 4's swarm, depth 5's Lobber), because a lesson has
to teach the base body. Two runs through the ruin should feel like two
different mornings.
**Cost:** cheap. A roll per area and a filter on the pack tables that exist.

### A6. Meeting the thief (cheap)

Five changes, all small:

1. **It goes for the best thing on the floor, fresh.** It wakes when an
   elite's drop lands (the elite always drops, 75% blue) or when an unfound
   part lands. That's mid-fight, while you're still busy with the pack. It
   never cares about parts you walked past.
2. **It hides in the elite's room, in a barrel.** A barrel that stands up on
   thin legs when the elite falls and scuttles for the drop. Break the barrel
   early (crates and barrels break to any hit, either side's) and it bolts
   with nothing, which is its own small surprise.
3. **The first meeting is certain.** The first time a save reaches depth 2,
   the level has the thief. After that, 35% at depths 1-2 and 4-5.
4. **You can find it.** Every listen pause (each 2.5 s of running) rings a
   small glass chime, so you hear it stop. While it carries a part, a cold
   chevron sits on the screen edge pointing at the cage, only on the top half
   of the screen, away from the thumbs. The camera still doesn't frame it, so
   it really does run into the fog.
5. **Catching it feels like catching it.** A tackle (walk into it) or 12 HP
   of anything (one Lens bolt does it). The cage pops open, the part tumbles
   out spinning with a bright chime, and the thief lies on its back with its
   legs going. Its notebook page is the Wandering Drone.

**You:** the elite falls, its blue part spins onto the floor, and a barrel in
the corner *stands up*. You have a hulk on you and a cold light running away
with the best part of the level. Everything about the next five seconds is a
choice.
**Why:** it's D2's treasure goblin moment, and it's the only enemy that asks
you to chase instead of dodge. That's a playstyle test in itself: a marksman
snipes it, a brawler with the Winch (B3) runs it down, a summoner's Spare Hand
grips it.
**Cost:** cheap. A trigger change, a barrel nest, a save flag, a chime and a
chevron.

---

## B. Playstyles

### What each archetype feels like, moment to moment

**The brawler** plays the rim. A hulk rears up and its ember disc blooms, and
you *don't* run. You flick the stick a thumb's width, its fists hit the floor
a hand's width from your feet, and you swing into its open chest. The rhythm is
bait, step, swing, and the payoff is tempo: the pack dies before the next
windup comes round. Its hard enemies are the ones that hold distance
(sentinels, rams backing off) and the mites' outer ring.

**The marksman** plays from cover, which isn't the same thing as kiting.
Kiting is running backwards while the auto fires. The marksman picks a spot
behind a waist-high wall and moves *along* it until the line is right: the
sentinel alone in the line, or three hulks stacked for the Cracked Lens, or a
bank shot round the corner. Then one tap. The skill is picking the spot.

**The caster** plays the clump. It gathers enemies (Backdraft, Chill, Frost
Trail), waits for them to bunch, and drops something on the pile (Flare, a
360 Frayed Cleaver, the Vent). Its big moment is the push: a pushed nova
breaks every windup it touches, all four mite jaws at once.

**The summoner** plays the ground. It leaves cold things where it wants the
fight to happen (a decoy, a lens on a stalk, a crawling hand) and fights from
beside them. On a phone it reads because every summon is a small cold bit of
Still, there are never more than three, and each one wears a life ring on the
floor that shrinks.

**The masher** plays a rhythm. On four touch buttons, mashing can't mean
machine-gunning one key (cooldowns stop that, and so does a thumb). It means
a **string**: tap, tap, TAP on one button, with the third tap as the
finisher, and rolling across buttons (a Signal Flare, then two marked hits).
It's the D2 assassin's charge-ups and finishers, translated to a thumb.

### B1. Show the pick (cheap) *surprising*

Rule 1 made visible. While a fight is awake:

- **The rim:** while your arms part is ready, a thin cold circle sits on the
  floor round Still at the arms part's true reach against a hulk-sized body.
  A winding hulk draws its ember disc. Stand where your cold circle touches
  its body and your feet are off its ember: that's the band. When you're in
  the band with the arms ready, the arms button's rim glints once.
- **The sightline:** while your head part is ready, a faint dashed cold line
  runs from Still to the target it would pick. It bends at the wall for a
  Ricochet bank, ticks once per body for a Cracked Lens pierce, and draws its
  landing circle for a Flare. Move, and it re-picks.
- At most one circle and one line, only for ready parts, only while
  something's awake. The HUD already dims cooling buttons, so the cues fade
  with them.

**You:** the first time you stand in the band you see a cold circle kiss the
edge of a hulk's ember disc, and you understand the brawler without a word of
tutorial.
**Why:** auto-aim hides the choice the game is making for you. Draw the choice
before the press, and position becomes aim. That's the whole brawler and the
whole marksman.
**Cost:** cheap. Two decals and one call to the existing pickers
(`pickTarget`, the arc snap, the bounce search) each tick for ready parts.

### B2. Hands at the rim (cheap)

When the nearest awake enemy is inside 3.2 u, the auto stops firing bolts and
Still's clamp jabs instead: the same 5 damage, every 0.31 s, with a dry clack
and no flight time. Step back past 3.2 and the lens takes over again. It's a
rule about Still, like the auto itself, not a stat on a part.

**You:** standing close *sounds* different: a fast metal rattle instead of
the lens's measured pulse. Standing close is where your hands work.
**Why:** it answers "what makes standing close worth it" without magnetism.
Close doubles the auto's damage per second (8 to 16), and you're only close
if you chose to be. It also makes the band from fact 1 feel like the good place
to be.
**Cost:** cheap. A branch in the auto. The balancer should price it, because
it speeds up every close fight, including a caster's.

### B3. The Winch (legs, blue, bends Kickstart) (medium)

"A chain the way you're steering. It reels you to the first thing it
catches." The chain flies along the stick (or your facing if the stick is
centred), up to 9 u, and stops at the first thing it touches: an enemy, a
crate or a wall. It reels Still in to arm's reach of an enemy, or to the foot
of a wall. A miss clatters on the floor.
- **Not magnetism:** nothing snaps to a target. The stick aims, like every
  dash. If a sentinel is 20° off your stick, the chain misses.
- **Push:** a pushed Winch that catches an enemy mid-windup breaks it on
  arrival (it's a hit).

**You:** a sentinel backs off at 6 u with its line tracking you. You throw the
chain, feel the yank, and you're at its feet as its line freezes, in the band,
with the Cleaver ready.
**Why:** the brawler's one missing piece is closing on things that keep
distance. On foot you gain about 2 u/s on a sentinel (5.5 against its 3.4), so
3 u takes about 1.4 s, while it gets one or two shots off. The Winch makes the
brawler viable, not just possible. It also catches the thief.
**Cost:** medium. A dash variant with a first-hit stop, a chain line and a
new icon.

### B4. Lend a part (the spares) (medium-big) *surprising*

The summoner, built from what Still is: an incomplete robot that lends pieces
of himself.
- **Spare Lens** (head, blue, bends Focusing Lens): "Plant your lens on its
  stalk. It shoots for you. Press again to call it home." The lens stands on
  the floor and fires the auto at whatever is nearest *to it* for 8 s. Called
  home, it flies back and hits whatever it crosses, so it's a boomerang you
  aim by where you stand. **While it's out, Still's own auto is silent**, and
  his head visibly lacks its lens. The sacrifice is on screen.
- **Spare Hand** (arms, blue, bends Clamp Toss): "Send your clamp. It grips
  the nearest leg." The clamp scuttles to the nearest enemy and holds it for
  3 s. It can't walk, but it can still wind up (telegraphs stay honest). Your
  arms button is hollow until it comes back.
- **Lure** (torso, gold) is already the third spare.
- **The read:** at most three cold things on the floor, each a recognisable
  bit of Still, each with a shrinking life ring under it. The lent part's
  button goes hollow, with a thin cold thread from its rim toward where the
  part is. Press the hollow button to recall.
- **Push:** recall and re-send in one hold (+2), the same as Lure's.

**You:** you plant the lens behind a wall, pull a pack past it, and fight
beside your own eye while it pecks at them. Your auto has gone quiet, and
that's the price. You call it home through the pack and it clacks back into
the socket.
**Why:** a summoner under auto-aim works best if the summons aim for
themselves, and these do. They aren't companions. Yanah and Yuri stay off the
battlefield, as `DESIGN.md` says. This is Still lending himself, which is the
game's own sentence ("built by what it survives") turned into a button.
**Cost:** medium-big. Two new shapes (`spare`: a turret, and `crawler`), a
hollow button state, the recall. Still's body already shows his parts, which
is most of the read.

### B5. Strings (the masher) (medium)

A string part answers three taps in a rhythm. Its button has three notches
round the rim. Each tap within 0.7 s of the last lights the next notch, and
the third tap is the finisher. Then the full cooldown starts. Miss the beat
(too slow, or nothing in reach) and the string ends early, cooling from
wherever it got to.
- **Rattle Clamp** (arms, blue, bends Piston): jab, jab, heave. The heave
  shoves and lands with the 90 ms hitstop and a small shake.
- **Stutter Step** (legs, blue, bends Skitter): three quick short hops, then
  a long cooldown. Use them to weave through a ring and stay at the rim.
- **Overclocked Coil** is already masher-shaped (1.2 s, +1 strain a cast).
- **The thumb problem, solved:** inside a string the button stays *ready*,
  so a long press is a cast, never a push. That matters, because the playtest
  measured the owner's median press at about 0.5 s. A push only exists once
  the string has ended and the button is cooling.
- **Push:** a pushed string starts at the finisher.

**You:** tap, tap, *heave*: a small buzz on each, a bigger one on the third,
the hulk thrown across the room into a crate. The thumb learns the rhythm the
way it learns a phone keyboard.
**Why:** it's what "button masher" can honestly mean on glass, and it gives
the brawler a second shape: a duelist who strings, next to the one who
swings wide.
**Cost:** medium. A string state on the button, per-step numbers on the part,
three notches on the HUD.

### B6. Leanings on the card (cheap)

Each part card gets one small glyph for its leaning (close, far, around, lent,
rhythm). In the compare pause your four glyphs sit in a row. When three match,
a thin line joins them and the word appears: *leaning close*. It's a reading
aid, not a stat, and not a set bonus.
**Why:** the balancer's premium gap 4 ("a player can name their build by the
Assembler") is a reading problem as much as a content problem.
**Cost:** cheap. A field on `AbilityDef` and a row in the pause screen.

### The structural question: should slots stay role-locked?

**Keep slots tied to the body. Loosen what each slot does.** The four buttons'
places are the thumb's map, and Still's body shows what he wears. Both only
work if "head" always means the eye and "legs" always means how he moves.
Letting any slot carry any role would make the four buttons unreadable at a
glance and scramble his body. What *does* change is that each slot gets one or
two parts for each archetype, and an archetype is a build where all four
buttons lean the same way. The synergies are behaviours across slots (the
rim, marks, spares, strings), never numbers.

| archetype | head | torso | arms | legs | its push |
|---|---|---|---|---|---|
| brawler | (any; the auto jabs close) | Backdraft, Brace | Cleaver, Piston, Parry, Frayed, Anvil | Kickstart, Overrun, **Winch** | break the hulk's rear-up from the rim |
| marksman | Lens, Cracked, Ricochet, Patient, Through-Line | Ward, Mirror Ward | Hook | Spring Heels, Plumb Line | Patient's full shot; break a sentinel at range |
| caster | Flare, Signal Flare | Pressure, Chill, Backdraft | Frayed at 12+ | Frost Trail, Skid Plates | a pushed nova breaks every windup it touches |
| summoner | **Spare Lens** | Lure | **Spare Hand** | Plumb Line (a placed thing) | recall and re-send |
| masher | Coil | (Signal-marked targets) | **Rattle Clamp** | **Stutter Step**, Skitter | start the string at the finisher |

The missing pieces are exactly one per archetype that doesn't exist yet
(bold). The brawler and the caster are nearly complete today, and only need
B1 and B2 to be *seen*.

---

## C. How A and B meet

### C1. The door tells you the day (cheap) *surprising*

In the Workshop, standing at the cold beam in the doorway shows one caption:
"Out there today: Rust Guards, Bulwarks, and somewhere, the Vault Keeper."
The hook by the door is right there. So the one choice between runs, the part
you hang, becomes an answer to the day. The depth banner repeats the roster
for each area as you enter it.
**You:** you stand at the door, read "Bulwarks", and swap the Lens on the hook
for the Flare, because doors stop bolts and not lobs.
**Why:** it gives the hook a reason beyond "my favourite part", with no
currency and no power. It's D2's "the Cold Plains again, bring fire" feeling.
**Cost:** cheap. The roster roll (A5) happens at the door, not at depth 1.

### C2. Every archetype is asked for and every one is annoyed (cheap, as a table)

A rule for the content, not a mechanic: across the variants, mods and roles,
each archetype should be favoured by at least two and annoyed by at least two.
From A1, A2 and A4:

| archetype | favoured by | annoyed by |
|---|---|---|
| brawler | Bulwark, Iron Crawler, Mirrored, Pylon (go get it) | Echoing, Kindled, Furnace Ticks |
| marksman | Thermal Scanner (cover), Drifting Frame, Grounded, Kindled | Bulwark, Mirrored |
| caster | Furnace Ticks (clumps), Mender (a pushed nova breaks the revive) | Grounded (won't move), Drifting Frame |
| summoner | Screen (the spare shoots past the slab), thief (the hand grips it) | Echoing (hits the spare twice), Mirrored |
| masher | Tethered (focus), Mender (kill it inside the revive) | Grounded (the heave doesn't move it), Kindled |

A day whose roster leans hard one way (two Bulwarks, a Mirrored named one)
asks for a close or lob build, and C1 tells you at the door.

### C3. The day's drops lean toward the day (cheap, optional)

Elites on a roster's day drop parts that answer it a little more often: a
Bulwark day's elites lean toward lobs and close parts. It's only a weighting,
and no part gets stronger. **Against it:** it decides builds for you, and the
run's shape is supposed to be what you make of what falls. It's listed so the
balancer can argue it down.

---

## Three feel moments this round must land

1. **The first time you stand in the band.** The hulk's ember disc fills. You
   nudge the stick, not run. The fists hit a hand's width away, and your
   Cleaver lands in the recover with the 90 ms hitstop. It lands because the
   cold circle and the ember disc are *touching* on screen: you can see that
   you were exactly right. Sound: the slam's thud, then your clack on top,
   with no gap.
2. **The barrel stands up.** The elite falls, its part spins, and the barrel
   gets up. It lands because it's the only time the game makes you chase,
   and because the chime every 2.5 s turns the chase into a rhythm you can
   hear through the fight.
3. **Calling the lens home.** It flies back through the pack, three small
   hits, and seats in Still's head with a clack, and the auto starts again.
   It lands because you felt its absence: the silence of your own auto was
   the price, and now it's paid back.

---

## My one recommended bundle

**"Draw the pick, meet the thief, and let the day ask."** About 9-11
vibe-coding evenings, in this order. Each step is playable on its own.

| # | step | from | cost |
|---|---|---|---|
| 1 | Show the pick: the rim circle and the sightline, for ready parts, while something's awake | B1 | 1 |
| 2 | Hands at the rim: the close jab | B2 | 0.5 |
| 3 | The thief: goes for elite and unfound drops, hides in a barrel in the elite's room, certain on the first depth 2, chime and edge chevron, a proper catch | A6 | 1 |
| 4 | Three new parts, one for each missing archetype: the **Winch**, the **Spare Lens**, the **Rattle Clamp** | B3, B4, B5 | 3 |
| 5 | Leanings on the card and in the compare pause | B6 | 0.5 |
| 6 | Four variants, one per family: Bulwark, Thermal Scanner, Drifting Frame, Furnace Ticks | A1 | 2 |
| 7 | Two mods per elite from depth 4, plus Grounded, Echoing, Mirrored, Tethered | A2 | 1.5 |
| 8 | Rosters per area, one named unique per area on the banner, the door's caption | A3, A5, C1 | 1 |

Left for round 2: the Mender and the Pylon (A4), the Spare Hand and Stutter
Step, Kindled, Iron Crawler, the drops leaning (C3).

**Why this bundle:** steps 1-2 cost about an evening and a half and might
change more than everything after them. They make the brawler and the
marksman visible in a game that already contains both. Step 3 is the owner's
own question, answered cheaply. Steps 4-8 widen the game the way it's meant to
widen: new behaviours, new faces and a roster that asks, with no number on
any enemy going up.

## Open questions for the phone

1. **Can you see the band at zoom 0.7?** It's 21 px for the Cleaver and 13 px
   for the Parry Clamp. If the camera sits wide in fights, the rim circle may
   need to thicken as the zoom widens.
2. **Does the close jab make kiting worse, or just not the only answer?**
   Watch for close fights ending before the second windup. If every fight
   does, 0.31 s is too fast.
3. **Strings with long presses.** With a 0.5 s median press, can the owner
   make three taps inside 0.7 s gaps? Log the string completion rate. If it's
   under half, widen the window before blaming the part.
4. **Does a silent auto feel like a price or like a bug?** The Spare Lens
   needs a sound for "your lens is away": a faint empty-socket tick in the
   auto's rhythm might carry it.
5. **Does the edge chevron fight the elite labels** on the top half of the
   screen? If they cross, the chevron wins while the thief carries a part.
