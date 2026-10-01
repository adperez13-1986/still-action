# Lean on the parts: where the round landed (1 Oct)

His ask: instead of the autos, tougher enemies and stronger parts; more dramatic part animations; no hold-to-push
("too troublesome": every cast the full effect, always costing strain). Files: BRIEF, 1-/2- per voice, sim
`lean-sim.mjs` (`node design/lean/lean-sim.mjs`, `... r2` for round 2).

## What his log says first (runs 9-20)

- **A push almost never does its special thing.** It broke a windup 4 times in 118 pushes (the autos broke 77):
  pressure hulks never wind up. So today a push buys "fire now" and a louder look, nothing else.
- **The hold isn't slow, the flick is lost.** His ready presses already last ~207 ms (past the 180 ms push hold), so a
  deliberate press on a cooling button pushes. But all 30 dead taps were under 190 ms: when he flicks a cooling button
  in a hurry, nothing happens, silently. "Troublesome" = a flick that does nothing + a push that does little.
- **The freeze is on the wrong thing.** The cast freeze and shake fire on the press, hit or miss (main.ts:3716); damage
  lands while Still's pose is still winding back (still.ts:687); every kill gets 80 ms, the free auto's included; every
  auto beat already freezes 22 ms (and the eye lance 45). The autos get the game's biggest moments.

## Where all four agree, including against him

- **No strain on every cast** (V1). It makes strain a meter on pressing: leaning on the parts is what would Stop him.
  Sim: +0.5 a cast, median Stopped 74%.
- **Yes to "full effect" on every cast** (V4): a ready cast carries everything a push adds (the break, the threat aim,
  the pushed look and sound). Free, because the break so rarely happens. Patient Lens, Overrun, Lure and Plumb Line keep
  their push-only extras (an always-full Lens would do 21/s, three times its peer).
- **A tap on a cooling button pushes at once** (+2, no hold). A tap with <= 300 ms left queues and fires free when ready
  (3 of 4 voices; it must visibly take: ring snaps full, a soft tick). A second tap on the same button within 250 ms of
  its last fire is ignored (no double charge on a mash). **No touch is ever silent.**
- **Drama: fix the timing before adding anything.** Freeze on contact only, never on a whiff; the pose starts cocked so
  the hit lands on the swing; auto beats 0 freeze (sparks and sound stay), auto kills 35 ms, part kills 90 ms. One
  formula: **min(100, 30 + 6 x cooldown s + 10 x (bodies struck - 1)) ms**, global, merged within 200 ms (Cleaver 46 /
  66 / 86 ms at 1 / 3 / 5 bodies; Vent 69 / 89 / 100). Budget: freeze 4-7% of pack-fight time (7-9% today), 77% of it
  the parts'. Per slot: arms weight (shove 0.8-1.5 u, contact crunch), head a gather + flinch + rising tick per pierce,
  torso a 70 ms inhale then the ring, legs freeze at the landing only if struck; a break gets the Anvil's weight. Push
  signature (ember sparks, vibration) only on a real push. No new particles in crowds; deep reds and cold blues.
- **Stronger in kind, tougher a little** (balancer's numbers): packs x1.25 HP, bosses x1.1; torso and legs x1.5 damage
  (the weakest slots: 1.5-2.3 DPS vs 6-7 for head/arms), head/arms x1.1; area: vent radius x1.25, dash width x1.5, Scrap
  Cleaver 120 -> 160 deg plus a shove. Never-melt pack time 1.00, part kills 38 -> 45%, finish 32/74/92 -> 34/79/95.
- **Not bigger packs.** More bodies gives the never-melt player +3 points of part kills and more exposure (finish 32 ->
  22); costs seeds, k9 pins and draw calls. HP is the dial.

## His call on strain (1 Oct): leave it alone

"I rarely get stopped so don't touch the strain economy yet." So tap-push ships with strain unchanged. For the record:
the sim puts him Stopped by the end of d3 in 16-24% of runs if he pushes x1.25-1.5 (5% today). The parked retune, if
it's ever wanted: cap 24 + a free first push each fight (median Made-it back to 70 at 0.72 pushes a fight).
Log strain at each boss entry and `tapPushes` so it can be seen if it happens.

## The trial: two switches, cut along strain

| switch | what | strain | judge by |
|---|---|---|---|
| **"weight"** | timing fixes + drama recipe + full effect on ready casts + the Ask 1 numbers | none | does a five-body Cleaver feel different from a jab; `kills.part` share d1-2 >= 45% (36% now); hpLost d1-3 within 20% |
| **"tap push"** | the gesture only (`hud.ts`): tap pushes, 300 ms queue, 250 ms mash guard | +2 a push, as now | dead taps ~0; pushes a fight 0.5-0.75; `queued`, `guarded`; Stopped |

Both pause switches, off by default, apply at once (pack HP from the next level; that depth logs `weightMixed`).
Checks: `tools/checks/lean.mjs` K-L*, incl. K-L8 "no freeze on a miss" via a DEV `__fx()` hook, negative-tested
against the old line; "off is today" (fights compare, autos, stageb, k9 unchanged).

**Order (my rec): build "weight" first.** It answers "lean on the parts" without touching strain and can't hurt the
never-melt player. "Tap push" right after, as its own switch, so he can tell which one he's feeling.

## Small things found on the way

`combat.ts:468` comment says the break rule is off by default (on since 26 Sep); `tools/checks/autos.mjs` uses K-A7
twice (lines 167, 271).
