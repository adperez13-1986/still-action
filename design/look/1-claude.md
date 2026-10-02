# The look: Claude's lean

2 Oct 2026. Written before reading the other three.

## Why it looks basic

Almost every cast is the same three verbs: `vfx.flash` + `vfx.sparks` (+ `partFx.beam` for a line). `castFx` in `main.ts` picks
counts and colours per beat (`lens` 10 sparks, `piston` a 0.5-wide beam and 12 sparks, `fray-*` 7/12/20 spark points), but the
grammar is one word said louder or softer. There is no **anticipation** (the cast is the frame it fires), no **follow-through**
(sparks die in ~0.3 s, nothing stays), no **contact** (the hit and the cast are the same burst), and **rank never reaches the
look**: `castFx(def, r, pushed)` gets the tempered def, but nothing reads `def.rank`. A III Cleaver is a I Cleaver with bigger
numbers on the card.

## The lean

**Rank buys a new beat, not a bigger one.** Each rank adds one layer of the cast's story, in a fixed order across every family, so
the player learns one grammar once:

| rank | adds | reads as |
|---|---|---|
| I | the act: today's cast, cleaned up (one clear silhouette, timed to the hit, not a spark spray) | "a tool" |
| II | **contact**: a distinct hit beat on what it touches (a bite, a crack, a frost bloom on the body), 40-80 ms after the cast's own frame, and Still's part mesh lights for the cast | "it lands" |
| III | **residue**: the world keeps a mark for 1-2 s (a scorch arc on the floor, a frost wake, a crack line on the wall it threw into), and the part's mesh on Still's body changes at rest (an idle tell: a glow seam, a slow rotating ring) | "it's mine, and it's dangerous" |

Why this order: contact is about power (honest with temper's x1.3), residue is about ownership (the build), and both stay out of the
air above the bodies where the enemy's tells live. Residue sits on the floor, under the fight, like the mark rings. That is how III
gets "more dramatic" without getting bigger or brighter.

**Still's body carries the rank.** The four slot meshes (`partmodels.ts`) are the one place a III can be seen when nothing is being
cast. A III part that looks different on Still at rest is the cheapest, clearest "it was upgraded" in the game, and it costs nothing in a
fight.

**Pushed is not a rank.** A push today adds its own flourish (rim kick, strain). Keep that separate, so a pushed I never looks like a III.

## The overall look, three cheap wins

1. **The hit flash** washes bodies to a pale blob (B3 screenshots: slammed hulks, a Cleaver over a crowd). Make the hit read on the
   body's edge (a rim), not its whole fill, and keep the body's silhouette dark. It is the single most "cheap-looking" frame we have.
2. **Floor contact for Still.** He floats a little in every screenshot: a soft contact shadow and dust on a dash or hop landing
   would ground him for a few draws.
3. **Light from the casts.** One pooled point light (or a fake light decal on the floor) that a cast borrows for 120 ms. Cold light
   spilling on warm stone is the "dramatic" the owner is after, for one light's cost. Measure first on his phone (`?perf=1`).

## First slice

The **arc family** (Scrap Cleaver, Frayed Cleaver / Backhand, Piston): the most cast, every core spends with it, and the B2/B3
screenshots show it weakest. I / II / III per the table, Still's arms mesh at III, and the hit-flash fix in the same slice, so he
feels the whole idea in one family before we spend on the other eleven.

## What I'd ask him

- Does "rank adds a beat" match what he meant, or did he picture III as a different animation altogether (a new move)?
- Residue on the floor: does a deep pack at d8 with three III parts stay readable for him? (Screenshot it at four sizes first.)
