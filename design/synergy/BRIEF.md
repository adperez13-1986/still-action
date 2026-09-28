# Brief: part synergy through enemy states, balanced against melting

28 Sep 2026. His ask: "can a balance between melting and parts synergy be created? we currently
don't have parts synergy, right?" He then asked for this round.

## Where things stand (read the code, not older design docs)

- **Parts:** 30, one ability each, four slots (head, torso, arms, legs); `src/abilities.ts`.
- **Temper** (`src/temper.ts`): melt a floor part into the one worn in its slot: ranks I-III (damage
  x1.3/x1.6, cooldown x0.85/x0.72, areas x1.15/x1.3, the part's own mod numbers too). **Swapping a
  part resets that slot to I.** That is the tension this round builds on: depth (melt one part) vs
  breadth (swap in the part that completes a synergy).
- **Mastery** (`src/mastery.ts`): melting into a III part teaches the close strike (close parts) or the
  planted shot (marksman parts) one of six mods: slow, mark, cleave, split. Max 6 a run.
- **Existing synergy:** one designed (Signal Flare / Marking Strike / Marking Shot: a marked enemy's next
  part hit lands twice, `mark` in `src/combat.ts`), and accidental ones by position (Rusted Hook or
  Backdraft pull, then an area part; Chill Vent / Frost Trail slow; Piston / Clamp Toss wall hits).
  Nothing pays them off.
- **Pressure** (accepted): ordinary hulks and sentinels have no big windup; heavies (an elite leader)
  and bosses keep telegraphs. Breaks are rare now, so no synergy may depend on breaking windups.
- **In-run growth is allowed**; enemies follow a fixed depth curve (`design/scaling/CURVE.md`, being
  retuned for a harder target: never-melt finishes ~1 in 3, median ~2 in 3, investor nearly always).
- **Rules** (`design/rules/PITCHES.md`, not all settled; these are): at most **one multiplier on a hit**,
  from the enemy's state, the larger wins, **cap x2**, never from what you wear; nothing free does both
  offence and defence; every part changes where you stand or when you press; no always-take.
- On screen the autos are **the close strike** and **the planted shot** (never hand / eye).
- Leanings today are a tag (close / marksman) whose only effect is which auto mastery teaches.

## The direction to design (Claude's pitch; argue with it)

**Enemy states**, Hades-style: some parts **set** a state on an enemy, others **pay** against it.
Candidate states: **chilled**, **marked** (exists), **clumped** (pulled together), **slammed** (knocked
into a wall). Setters and payers sit in different slots, so a synergy needs two parts. Masteries can
set states too (Cold Strike chills, Marking Strike marks), so the autos feed the parts. Leanings could
map onto states (close: clumped, chilled; marksman: marked, slammed).

## What each voice produces (round 1)

1. **The states**: which (3-5), what sets each (parts, masteries), how long, how it's shown on a phone
   (cold colour language for Still's effects, no flat red/white), and whether it stacks.
2. **Setters and payers**: for each of the 30 parts, set / pay / both / neither, and the payoff line in a
   card's words. Prefer retuning existing parts' second effect over new parts. No slot without a setter
   and a payer in the pool.
3. **Melt vs synergy**: numbers that make "melt this to III" and "swap in the part that completes a
   synergy" a real choice (a completed pair worth about rank II-III of one part, a guess to test).
   Can a swap keep something (e.g. half its rank) or is the full reset the right price?
4. **Leanings**: does the state map give leanings a real meaning? If not, say what would.
5. **Three steps to build**, smallest first, each playable on the phone.

Balancer: numbers, and a sim or model of pair value vs rank value. Translator: how a player reads a
state and a pair in the hand, on a 6-inch screen, mid-crowd. Verifier: checks for each rule (a static
check like `tools/leancheck.ts`, log fields), and what in the code each step touches.

Under ~1,200 words. Write to `design/synergy/1-<voice>.md`. Don't change code.

## Round 2

Read the other round-1 files (including `1-claude.md`). Say where you disagree and why in a sentence;
change verdicts you were persuaded on. Under ~600 words, to `design/synergy/2-<voice>.md`.
