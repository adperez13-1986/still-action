# Round 1: the Verifier's pitches

Scope, structure and buildability, but pitching too. Everything here is grounded
in what exists today:

- **Run phases** (`main.ts`): `crawl → descending → crawl …`, ending in
  `broken → over` or `stopping → over`. "again" on the ending calls
  `startRun()` directly. Nothing sits between two runs yet.
- **Levels** (`dungeon.ts`): `generateLevel(depth, seed, { boss })` is already
  seeded and deterministic. Boss every 3rd depth (`BOSS_EVERY`), and
  `"area N cleared"` already shows after each Assembler. Pack tables change by
  depth (D4 / D5 / D7 rows, `CAPS`).
- **Loot** (`loot.ts`): `rollPart` filters `PARTS` by gate and by what's
  "taken". One extra filter on that line is all a findable pool needs. Loot
  rolls use `Math.random`, not the level seed.
- **Screens** (`pause.ts`): the loadout and compare cards can already show any
  list of parts.
- **The rig** (`still.ts`): `breakApart`, `reassemble` and `setEquipped` per
  slot.
- **Save**: none. The only `localStorage` use is the push-hint flag
  (`still.pushHint.*`).

Every pitch lists what goes into the save and how big it is. Sizes are rough
JSON sizes in one `localStorage` key. None of these ideas comes near the
browser's ~5 MB limit, so size never decides anything here. What decides is
how many things have to stay in sync.

---

## Topic 1: The Workshop

### W1. One room, walked

The Workshop is a single room made by the dungeon generator, with a fixed
layout. It uses the same stone and barriers, and Grace's warm light is the only
light source. You walk Still around it with the stick, like anywhere else.
There are three things to walk up to:

- **a shelf**, which opens the loadout card screen with every part you've
  found ("14 of 30")
- **a corkboard** of past runs
- **the cold exit beam**, which is the door: walk into it and the run starts

Yanah and Yuri are there as traces, not figures: chalk drawings on the floor
(the floor decals already exist at `DECAL_Y`) and two covered shapes on a bench.

- **Why it fits:** no menus in a game about walking. The between-run space is
  the maze's one warm room.
- **Save:** nothing of its own. It shows the save from M1 and R1.
- **Smallest fun version:** the room, the beam as the door, and a shelf that
  only shows a count.
- **Cost:** medium. The layout, the beam, the light and the cards all exist.
  The new work is the "walk up and a card opens" trigger, which is the shrine
  prompt reused.

### W2. The corkboard screen

The cheapest option. The ending's single "again" becomes two buttons:
"again" and "the workshop". The Workshop is an HTML screen over the dimmed last
frame of the run. It shows a corkboard with one index card per run (date,
ending, depth, the four parts he carried), a line of found parts, and one warm
dot for Grace in the corner. It has no 3D and no new art. Yanah and Yuri are two
pinned drawings on the board. After a set number of runs, a drawing's corner
lifts to show there's something behind it (their parts, which you write).

- **Why it fits:** "you never leave with nothing", made literal. Every run pins
  a card, whether it ended in Broken, Stopped or home.
- **Save:** the run log. About 200 B per card, capped at 60 cards, so about
  12 KB.
- **Smallest fun version:** the ending pins a card, and the board shows the
  last 12.
- **Cost:** cheap. It's one screen in the same style as `pause.ts`.

### W3. Put back together (surprising)

The Workshop is not a place you go to. It's the moment after the ending. Every
ending already takes Still apart: Broken throws his pieces, and Stopped leaves
him slumped. The Workshop is that scene played backwards: `reassemble()`,
slowly, under Grace's light, on a bench. While he's put back together, you make
the one choice between runs: which part he wakes up holding, picked from the
plain parts you've found. That replaces today's random starting part. No one is
shown doing the repair. It's warm and it happens, and that's all.

- **Why it fits:** "built by what it survives". Each run starts from his being
  rebuilt, not from a menu. And it's the only between-run verb that widens
  without making him stronger: you get a choice, not a bonus.
- **Save:** the found set (M1). The last starting part adds about 20 B.
- **Smallest fun version:** after the ending words, the reassembly plays and
  four white cards appear. Tap one to begin.
- **Cost:** cheap to medium. The rig can already take itself apart and put
  itself back. The reverse animation needs one new timeline.

### W4. The doorframe (surprising)

On the Workshop's doorframe there are two sets of pencil height marks, one
for Yanah and one for Yuri. The marks go up with **calendar time since your
first run**, not with runs played or anything you earned. Come back after three
months and they're a little taller. Nothing is lost if you don't come back, and
there's nothing to collect. The marks just show that time passed and they grew.

- **Why it fits:** "what my kids will develop into" from the genesis document,
  as the only moving thing in the room. It isn't a reward and can't be ground
  for, because the only thing that moves it is the date.
- **Save:** `firstPlayed`, one timestamp, 13 B.
- **Smallest fun version:** two marks that go up one notch per month, and no
  labels.
- **Cost:** cheap. It works with W1 (a decal on the door piece) or W2 (a strip
  on the board's edge).

---

## Topic 2: Meta progression

### M1. The pool opens (the settled idea, pinned down)

Still starts with a **starter pool**: the 8 white parts and 4 blues. Every other
part is "unseen". Unseen parts can only come from rare sources: the boss's gold
drop (always), elites and Plenty (a 25% chance of an unseen part). The first
time you pick one up, the card says **new**, and from then on it's in the
ordinary pool for good. At about one to two new parts a run, all 30 are in
after about 10–14 runs.

- **Why it fits:** run 1 is simple and readable. Run 10 has three times the
  options at the same power: wider, not stronger.
- **Save:** the found set, as ids. 30 ids is about 500 B.
- **Smallest fun version:** the "new" tag, and "found 14 of 30" on the ending
  screen.
- **Cost:** cheap. It's one more filter in `rollPart`, plus an "unseen first"
  order for the rare sources.
- **Watch:** `?depth=3` has to keep working with an empty save.

### M2. Worn parts

Parts remember the runs they were on: how many runs carried them, the deepest
depth they reached, and whether they were on Still when an Assembler fell. The
compare card gains one grey line, like "carried 6 times · depth 8 · there for
the Assembler twice". Nothing about the part changes: no stats, no levels, no
mastery. The icon gets one small notch per five runs carried, which is wear,
not a medal.

- **Why it fits:** by run 10 the pool is full of things with history instead of
  just "more options". It's the answer to "wider feels flat".
- **Save:** 30 entries, each about 40 B, so about 1.2 KB.
- **Smallest fun version:** just the grey line on the card.
- **Cost:** cheap. The counters update where `end()` runs, and the card gets one
  line.

### M3. The shelf (surprising)

In the Workshop, found parts sit on a shelf, and you can **take any part off
the shelf** so the maze stops offering it. There's a floor of two parts per slot
so the pool never empties, and you can put a part back any time. The only meta
verb in the game is **curating**, not upgrading: your run 10 is different
because you shaped what the maze gives you. Tiers stay "different, not
stronger", so the most taking parts off can do is steer your runs toward a
style you like.

- **Why it fits:** the maze is made of what you've chosen to keep, and it asks
  you to choose. It also quietly fixes the "Cleaver does too much" worry,
  because players can drop what bores them.
- **Save:** the set of shelved parts, about 200 B.
- **Smallest fun version:** a toggle on each card in the found list.
- **Cost:** cheap. It reuses the M1 filter, and the card only needs a toggle.
- **Watch:** it makes it a little easier to plan for a build. That's
  acceptable, because nothing gets stronger.

### M4. Doors, not upgrades (the "small workshop upgrade track")

The upgrade track is a fixed list of about six **new options**, each opened by
a moment that happens once, never bought with a currency:

| Moment | What opens |
|---|---|
| first Assembler falls | you pick your starting part (W3) |
| first time home | the node map shows two choices instead of one |
| 10 parts found | a third kind of shrine |
| first Stopped ending | the Rest shrine can appear on boss levels |
| … | … |

Each option makes runs more varied, not stronger. The Workshop shows the list
as unlit and lit marks. It's short, so it ends: after about 15 runs everything
is open.

- **Why it fits:** you still feel progress with no power curve. And because
  Stopped and Broken open things too, "your bad runs count" becomes a rule of
  the game.
- **Save:** a set of flags, under 200 B.
- **Smallest fun version:** two flags: pick your starting part, and the third
  shrine.
- **Cost:** cheap per flag. The work is in what each flag opens.

---

## Topic 3: A complete run

### R1. Two areas and home

A run is **two areas of three depths each**, so 6 depths and about 25 minutes:
four levels of about 4.5 minutes and two boss levels of about 3 minutes. That's
one phone session.

- **Between areas:** a node map with 2–3 choices. Each node is a *flavour* made
  only from existing data: a pack-table weighting ("the foundry": more rams),
  a grade tint, and which shrines appear. There's no new art.
- **After the second Assembler:** there's no exit beam, just Grace's light
  filling the arena, and the third ending, **came home**. It closes on the same
  line as the other two. So the run state has three endings: broken, stopped,
  home.
- **Why it fits:** reaching the end means coming home, not winning. It's
  possible from run 1, but most early runs won't get there, and they don't need
  to.
- **Save:** one run card per run (see W2), plus the found set.
- **Smallest fun version:** a 6-depth cap and the home ending, with no node map
  yet.
- **Cost:** medium. The run cap and the ending are cheap. The node map screen
  and area flavours are most of the work.

### R2. Walk home when it's enough (surprising)

The run doesn't end at a depth. It ends when you decide. After every
Assembler, the arena shows **two beams**: the cold one (deeper) and a warm one
(home). Walk into the warm one and the run ends with "came home, depth N". You
can go home after the first boss or go on to depth 12. A soft cap stops it at
depth 12, where only the warm beam appears. Going deeper pays in *finding*:
unseen parts come from bosses (M1). It doesn't pay in score.

- **Why it fits:** it makes the game's one line a real choice. The player
  decides that it was enough, and the game agrees.
- **Save:** the run card records "home at depth N".
- **Smallest fun version:** this whole pitch. It's the one-evening build below.
- **Cost:** cheap.

### R3. The crossroads room

Instead of a map screen, the node map is a **room**. After each Assembler you
walk into a small hub, made with the Workshop room's layout, that has 2–3
exit beams. Each beam has a floor sign showing what's beyond: a shrine glyph,
an elite's blue aura, a crate pile, the boss mark. You choose by walking to one.

- **Why it fits:** the choice happens in the world, under the fixed camera,
  with thumbs on the stick. It also keeps the whole game free of new UI screens.
- **Save:** nothing. It's all within the run.
- **Smallest fun version:** two beams, "shrine level" or "elite level".
- **Cost:** cheap to medium. The generator needs a second exit position, and
  the beam and glyph meshes already exist.

### R4. Where you fell (surprising)

The next run remembers the last one. At the depth where Still broke or stopped
last time, that level's entrance room holds **his old shell**: a dark Lantern,
cold, slumped the way that ending left him, and wearing the parts he had. You
walk past it with a one-line banner: "you got this far last time". If you
touch it, it counts as one crate. It gives nothing extra, so no run is stronger
for it. On run 10 you pass shells you left at depth 2, 4 and 7, and each run
only remembers the one before.

- **Why it fits:** "built by what it survives" as something you can see.
  Failure leaves a marker, not a loss. And it's how run 10 feels different from
  run 1 without adding power.
- **Save:** the last ending: depth, kind and the four part ids, about 150 B.
- **Smallest fun version:** the shell with no parts showing, and the banner.
- **Cost:** cheap. It's the Lantern rig posed and dimmed, plus one placement.

### The one-evening build: "The Warm Beam"

The smallest complete run that could ship tonight. It takes R2 and caps it:

- **The run:** at most 6 depths. After the depth-3 Assembler, **two beams**:
  cold (deeper) and warm (home). After the depth-6 Assembler, only the warm
  one. Walking into the warm beam is the third ending, "came home".
- **Code:** `dungeon.ts` gets a second exit position in the boss layout (the
  arena is 28×28, so there's room). `main.ts` checks which beam you entered,
  and the warm one goes to the ending instead of `descend()`. `ending.ts` gets
  a third ending kind with placeholder copy. The real words are yours.
- **Beam colour:** the warm beam is the exit beam in Grace's colour, and her
  light already leans toward it.
- **Save:** none. At most a `bestDepth`, 10 B.
- **Out of scope tonight:** no Workshop, no pool, no map. It's still a full
  run: it has a shape (1–2 areas), a real end you choose, and three endings.

---

## How they stack

- **The spine is M1, then W2 or W3, then R1.** The findable pool gives run 10
  something run 1 didn't have. The Workshop gives it somewhere to be seen. The
  run cap gives it an end.
- **Everything else is optional.** M2, M3, W4, R3 and R4 each add warmth or
  texture, and none of them needs the others.
- **One save key, one version field.** With every pitch included, the save is
  found set + shelved set + run log + part history + last ending +
  `firstPlayed` + flags, under 20 KB.

Build flags worth knowing now:

1. **Namespace the key.** GitHub Pages serves all of the owner's project sites
   from the one origin, `adperez13-1986.github.io`, so they share
   `localStorage`. The existing `still.pushHint.*` key could collide with a
   still-merge key. Use a `still-action.` prefix.
2. **Loot isn't seeded.** Level layout comes from the seed but loot and combat
   use `Math.random`, so "replay this run" or "share a seed" would need the RNG
   threaded through first. That's why none of these pitches depend on seeds.
3. **Save when the ending starts.** Write the run card when `broken` /
   `stopping` / home begins, not when "again" is tapped. That way a closed tab
   still keeps the run.
4. **Yanah and Yuri.** Only their *placement* is pitched here: the bench,
   drawings, height marks. Their parts and what opens them are yours.

---

## Summary

1. Workshop: W2 (a corkboard screen) is the cheap win, W1 (a walkable warm room) is the full version, W3 (reassembly as the Workshop) is the surprising one, and W4 puts the kids there as height marks that grow with the calendar.
2. Meta: M1 (the findable pool opens from 12 parts to 30 through bosses, elites and Plenty) is the spine, M2 gives parts a history, M3 lets you curate, and M4 is a short list of options that open once, with no currency.
3. Run: R1 is two areas and home in about 25 minutes. R2, the surprising one, lets you walk into a warm beam when it's enough. R3 makes the node map a room. R4 leaves your last shell where you fell.
4. Tonight's build: "The Warm Beam". Cap at 6 depths, add a second warm exit after each Assembler, and add a third "came home" ending. It needs no save.
5. The whole meta save fits in one namespaced `localStorage` key under 20 KB. It needs a `still-action.` prefix because the Pages origin is shared, and it should be written when the ending starts, not when "again" is tapped.
