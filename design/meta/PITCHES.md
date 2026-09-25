# Pitches: the Workshop, meta progression, and a complete run

26 Sep 2026. Four voices (balancer, translator, verifier and me), two rounds:
everyone pitched, then everyone read and argued with the others. This page is
the result. The raw rounds are in this folder (`1-*.md`, `2-*.md`) if a pitch
makes you ask "why". Nothing here is built.

Each pitch is small on purpose. Mix and match: they were written to combine.

---

## Where all four ended up agreeing

- **Every ending keeps everything.** Genesis: "you never leave with
  nothing". The balancer proposed that Broken loses the parts found on that
  depth, then withdrew it in round 2.
- **Yanah and Yuri are home from the first night.** Nobody earns their
  children. The translator put it: "earning them makes love conditional, and
  Grace means unmerited favour." Their *parts*, and when those drop, stay
  yours to decide.
- **No currency.** Nothing to farm, nothing to spend. Things open because of
  a moment, not a balance.
- **A third ending: Home.** Walking into Grace's light. It needs your words,
  like the other two.

---

## The Workshop

**1. Coming home** *(the one everyone backed, medium)*
A small iso room in the same engine, and the only warm one: Grace's light is
its lamp, and Still's footsteps turn from stone to wood at the door. Still
walks around it with the stick, no menus. How he arrives depends on the
ending: **Broken**, he's put back together on the bench, piece by piece;
**Stopped**, he's whole but dim, and the room's light slowly brings his eye
back on; **Home**, he walks in through the door. The way out is a cold beam.

**2. The wall of parts** *(cheap)*
One hook per part. The ones you've found hang there, lit. Unfound ones are
bare outlines with a hint of where they live ("the Assembler carries this").
Walk up to it to pick which found white Still wakes up holding. Or turn a part
to face the wall, which takes it out of the findable pool, so the one choice
between runs is curating, not upgrading.

**3. The kids draw your run** *(medium; surprising)*
No photo on the corkboard. Yanah or Yuri draws it: the engine's last frame
of the run, redrawn in crayon, pinned up with the date. The wall of drawings
*is* your run history, and a drawing of the ram that broke you is tender, not
a failure screen. *Cost note:* the drawings need their own storage
(IndexedDB); `localStorage` is too small and shared with your other Pages
projects.

**4. The doorframe** *(cheap; surprising)*
Pencil height marks for Yanah and Yuri on the door frame. They grow with
**real calendar time since your first run**, not with runs played. Play once
in October and come back in March, and they've grown. It saves one date.

**5. The strain-line card** *(cheap)*
Every run leaves a card on the corkboard, drawn as its strain line: the
climb, the quiets, the push that crossed 20, or the walk home. The depth
number goes in the caption, not the headline.

**6. The hook by the door** *(cheap; the alternative to #2's starting pick)*
At every ending you hang one part you were wearing on the hook by the door
(not a gold), and the next run starts with it. It carries a thread through
runs rather than a choice from the whole wall.

---

## Meta progression: wider, not stronger

**1. The wall fills** *(cheap; the backbone)*
The pool starts at 12 parts (the 8 whites + 4 blues). The other 18 appear
only from elites, the Assembler and Plenty, and never at depth 1, so
throwing away runs doesn't pay. Full in about 10-12 runs (5-6 hours).
Plenty becomes a real bargain: +4 strain for a chance at something you've
never seen.

**2. Parts remember** *(cheap)*
A part's card carries its history ("carried 4 runs, saw depth 8"). A part
that survived an Assembler drops next time with a name: *Scrap Cleaver, that
saw the Assembler*. No stats change. Swapping out an old friend should feel
like something.

**3. Doors, not upgrades** *(medium)*
A short list of things that each open once, from a moment: your first
Stopped opens the quiet room, your first Assembler opens the elite den, your
first time home opens the swap node. What grows is the map, not Still.

**4. The notebook** *(cheap to medium; carries the lineage)*
The 43 enemies from the original `still` come back as knowledge. Each one
Still meets gets a page, and each variant fills in a line of the old flavour
text. Knowing the maze is the one kind of progress that doesn't break "your
first runs are bad by design".

**5. The shelf fixes dilution** *(free with Workshop #2)*
The worry: more parts means you see each one less often. With 30 parts it's
minor; at 50 it's real. Turning parts to the wall caps it: any one part you
keep shows up in about 92% of runs, a named pair in 85%, however big the
catalog grows.

**6. Marks on Still** *(needs "Still wears his parts" first)*
Welds where he was broken, scuffs, a small drawing one of the kids put on his
casing. His body is the record.

---

## A complete run

**1. The warm beam** *(one evening; build this first)*
After an Assembler falls, two beams: the cold one goes deeper, the warm one
goes **home**, the third ending. After the last Assembler, only the warm one.
It gives the run an end without a score, and a real decision at every boss.

**2. A run is one day** *(cheap to medium; surprising)*
The light moves through the run: morning in the first area, afternoon, dusk
in the last, and the walk home is at night with Grace's light the only thing
lit. The Workshop window shows the hour the run ended: a Broken run at noon
comes home to an empty afternoon room, and a full run comes home at night
with the kids asleep. No clock, no timer: the depth *is* the time.

**3. Three areas and the walk home** *(the shape)*
Each area is two crawls plus the Assembler. At the end, the last "level" isn't
a boss. It's a short walk up to a small lit house in the ruins, which is the
Workshop from outside, and you fade straight into the room. The run saves at
every beam, so a phone call doesn't cost a 40-minute run.

**4. Two doors, not a map screen** *(medium)*
The node map lives in the boss arena as two cold beams with floor glyphs for
the next area's kind (a **Den**: more elites, more finds; a **Hollow**:
quieter, a shrine). You choose by walking into one. Plus the warm beam home.

**5. The Assembler, three ways** *(cheap)*
The same boss each time, never more HP (900). Its adds change: as built, then
rams, then mites under a Warden. Deeper means different, never stronger, the
rule the rest of the game already follows.

**6. Where you fell** *(cheap; contested)*
A small cairn at the depth where your last runs ended. It gives nothing: the
balancer and translator both vetoed making it a crate or a bonus. You just
pass it.

---

## Yours to decide (the four voices split)

1. **How long is a full run?**
   - 6 depths, two areas, about 26 min (translator, verifier).
   - 9 depths, three areas, about 41 min (balancer).
   - The verifier suggests making it one constant and trying both.
2. **Is there a warm beam after the first boss?** The translator says yes.
   The balancer says no: at depth 3 you've found little, and going home at 13
   minutes would become the safe loop.
3. **Can Still choose to stop** ("Sit down" at a Rest shrine)?
   - The translator says yes: it's the graceful way to end a run at night.
   - The balancer and verifier say no: the warm beam is the chosen exit, and
     Stopped should stay something that happens to him.
4. **Strain barely carries today.** Six quiets a level refund −12, so pushing
   about once per fight is free and Stopped is hard to reach. The cheapest fix
   is one number, quiet −2 to −1. It's a feel change, so it's for you to try on
   the phone, not for us to decide.
5. **The Workshop room tone** could be recorded in your real house. The repo is
   public, so what's in that recording is up to you.
