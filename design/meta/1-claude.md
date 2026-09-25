# Round 1: Claude's pitches (the fourth voice)

Short on purpose. These are ideas that none of the three round-1 files had,
or had only in part.

## Workshop

**C-W1. The kids draw your run.** Nobody pins a photo of the last run.
Yanah and Yuri draw it. When Still gets home, one of them draws what he came
back talking about: the ram that broke him, the gold part he wore, the depth
where he stopped. The drawing is a crayon rendering of the run's defining
thing (a flat, wobbly-line version of the enemy or part mesh, done as a
render-to-texture with a crayon shader), pinned to the wall with a date. The
wall of drawings *is* the run history. *Why:* the kids' presence becomes the
record of showing up, not a reward for doing well. A drawing of the thing that
beat you is tender, not a failure screen. *Cost:* medium (one shader, a
picker for "the defining thing", a wall).

**C-W2. The Workshop is where Still is repaired, and he can't do it alone.**
A Broken Still comes home in pieces. Grace's light puts him back together
before the door opens. A Stopped Still comes home whole but dim, and the
room's light slowly brings his eye back on. The two endings stay different
all the way home. *Cost:* cheap (reuse `breakApart`/`reassemble` and
`setSlowdown`).

## Meta progression

**C-M1. The notebook (the deckbuilder's 43 enemies, as knowledge).**
`DESIGN.md` says the 43 enemies from `still` port as *data*: names, flavour,
sector. Here they are the notebook. Each enemy archetype seen gets a page;
each variant (elite name, sector skin) fills in a line of the old flavour
text. Nothing gets stronger. What grows is Still knowing the maze. *Why:* it
carries the lineage across all three shapes of the game, and "knowing more"
is the one progress that doesn't break "your first runs are bad by design".
*Cost:* cheap to medium (a book screen; flavour text exists already).

**C-M2. Names, not numbers.** A part carried through a boss fight earns a
name suffix the next time it drops: "Scrap Cleaver, that saw the Assembler".
Only the name changes, and it's a stranger's joy to find it again. *Cost:*
cheap.

## A complete run

**C-R1. A run is one day.** The light moves across the run. The first area is
morning (cold, low sun through the ruins), the second afternoon, the third
dusk, and the last walk home is night, with Grace's light the only thing lit.
The Workshop window shows the same time the run ended at: a Broken run at noon
comes home to an empty afternoon room, and a full run comes home at night
with the kids asleep. It needs no timer and no clock. The depth *is* the
time. *Why:* it gives a complete run a shape you can feel without a number,
and "coming home at night" is the end every parent knows. *Cost:* cheap to
medium (grade and fog presets per area; the Workshop's light per ending).

**C-R2. The last room is the Workshop's door, seen from outside.** The final
depth isn't a boss. It's a short walk up to a small lit house in the ruins,
the Workshop from the outside. Walking in is the third ending, and the run
fades straight into the room. *Cost:* medium (one authored exterior).
