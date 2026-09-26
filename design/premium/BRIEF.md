# Brief: what does still-action lack to be a premium game?

The owner asked: *"Right now, what are the things that the game lacks so that it can be a
premium game?"* Premium here means the buy-once standard (itch.io / Steam, no IAP, no
retention tricks; see his stance: choice over grind, finite content, self-contained runs).
It's a hobby built for fun, so this is **an honest gap list, not a roadmap or a milestone
plan.** Rank what matters most, say what's already at premium grade, and be concrete.

## Read first
`/Users/adrianperez/repos/personal/still-action`: `HANDOVER.md` (current state, 25 Sep),
`DESIGN.md`, `design/meta/DESIGN.md` (the run, the Workshop, endings), `design/CATALOG.md`
(30 parts, enemies), `design/content/DESIGN.md` (area II), `design/area3/PITCHES.md` (the Line,
in progress on a branch), `design/strain/PITCHES.md` (the core mechanic's problem and fixes).
Look at the code where it helps you judge (`src/`), and at `public/` for assets and the manifest.
Today's playtest (2 runs, both Home at depth 6, ~24 fights each): pushes ~1 a fight (up from
~0.2), strain peaked 16/20, the push-breaks-wind-up rule fired once in 46 pushes, and casts on
ready buttons fire on release after a median ~0.5 s press.

## Context
- Phone-first (Poco F8 Pro, landscape), web/PWA, three.js. A run is ~26 minutes, 6 depths,
  3 endings; the Workshop between runs; parts persist into the pool; the family are presences.
- One person, vibe coding with agents, for fun. Say what's cheap and what's big.
- Don't assume the owner has played games you cite; describe the idea.

## Write
Your file in `design/premium/`, about 80-120 lines:
1. **What's already premium-grade** (short).
2. **The gaps, ranked** (top 8-12): what's missing, why it matters for a paying player, how
   you'd know it's fixed, cost (cheap / medium / big).
3. **The one gap that matters most**, and why.
Don't edit code or any other file.
