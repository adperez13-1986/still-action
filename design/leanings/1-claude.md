# Round 1: Claude (lead)

## The frame
LESSONS.md in one line: builds died of one dominant answer, generic-good picks, dead slots and
archetypes that existed only on paper. So two leanings, each complete, each with payoffs the
enemy triggers, and a base kit that doesn't already pick the winner.

## 0. The base kit already picks a winner
The hand is 10 dmg every 0.62 s (~16 DPS) and breaks windups; the eye is 5 dmg on the same beat
(~8 DPS) and costs standing still. His runs show it: ~190 strikes to ~95 eye shots, and the eye
only where the Assembler forces range. Before any tag, close is the dominant answer (lesson 1).
**Fix the base first:** the eye's planted shot goes to 8 dmg (still under the hand, because the
hand has the reach risk and the eye has the brace). The balancer should price it; my bar is
"planted DPS within ~20% of close DPS against one target, higher against a line".

## 1. What a leaning is
- **A tag on each part: close, marksman, or none.** One tag, not two (two tags made "set
  bonuses switch on by accident" in the variety round; one keeps the read clean).
- **No set bonuses.** Payoffs live on individual parts and react to hand/eye events. Wearing
  three close parts does nothing by itself; the close parts are just better at what close does.
- **The hand and the eye don't change with tags.** They're the symmetric base; parts bend them.
- **Shown:** a glyph on the pickup card, the compare screen and the wall plaque (a fist for close,
  the lens for marksman). On the compare screen a line under the loadout: "leaning close (3)".
  Never on the HUD.

## 2. The 30 parts, tagged (my first pass)
| slot | close | marksman | none |
|---|---|---|---|
| head | Signal Flare (reworked, below) | Focusing, Cracked, Ricochet, Patient (reworked), Through-Line, Coil | Flare |
| torso | Backdraft, Brace | Ward, Mirror, Chill, Lure, **Flywheel (new)** | Pressure Vent |
| arms | Cleaver, Hook, Parry Clamp, Frayed, Anvil, **Grindstone (new)** | Piston (reworked) | Clamp Toss |
| legs | Kickstart, Overrun | Frost Trail, Spring Heels, Plumb Line, Skid Plates | Skitter, Borrowed Time |

Gaps this closes: close had no head part, marksman no arms part (rule 5, the Still Head/Legs
lesson). Every slot has at least one of each leaning.

## 3. Payoffs (enemy-triggered, additive)
- **Grindstone (arms, close, new; the variety round's idea).** A heavy grinding swing. Its
  cooldown only runs while an awake enemy is in the hand's reach, and each windup the hand breaks
  takes 1.5 s off it. Trigger: the enemy is close and winds up. Gives up: useless at range.
- **Signal Flare, reworked (head, close).** Still lobs a mark. New: a windup the hand breaks also
  marks that enemy. A marked enemy takes your next hit twice (the hand counts: 10 → 20). Trigger:
  the enemy winds up next to you. Gives up: its own lob does almost nothing, as today.
- **Patient Lens, reworked (head, marksman).** It charges only while planted (the eye's stance),
  full in 2.4 s. A full shot that hits a leader or a shooter breaks its windup if it has one.
  Mirror of Grindstone: each leaning has one part whose clock runs only in its stance.
- **Flywheel (torso, marksman, new).** Spins up while planted (1.5 s). When an enemy steps into
  the hand's reach while it's spun, it releases a shove ring (2 u, no damage) and spins down.
  Trigger: an enemy reaches you. Defence for the turret, never damage (rule 7).
- **Piston, reworked (arms, marksman).** Planted, its knockback is twice as far and the eye keeps
  its stance. The "get off me" button that keeps the marksman planted.
No part multiplies another. The only doubling is the mark, one hit, consumed (it exists today).

## 4. Making marksman real
The eye at 8, Patient charging only planted, Flywheel for the enemy that arrives, Piston to
send it back, Ward and Mirror against shooters. Planting stops being "absorb blows" and becomes
a stance you build for. Test: in his log, eye shots per run should climb toward strikes on a
marksman loadout, and the Arbiter should see planted play when he wears one.

## 5. The pedestal match
Count the tags worn. The leading leaning (2+ parts ahead or not) gets one pedestal in three drawn
from its tag. Nothing worn, or a tie: one close, one marksman, one any, so the first pick shows
both roads. The matching pedestal shows the glyph lit. No hidden weighting, and the other two stay
the normal draw.

## 6. Guardrails (checks, with lines)
- Simulator: per-part take rate when offered, no part above 1.6x the median (the 78% case).
- Per slot, per leaning: every slot has a part of each leaning worn at run end in >= 15% of the
  runs that commit to that leaning.
- Committed loadout (3+ of 4 slots one leaning) at run end in >= 40% of runs; close and marksman
  commit within 1.5x of each other.
- Playtest log per depth: tags worn, payoff triggers (grind refunds, marks consumed, Patient full
  shots and breaks, Flywheel releases), and the existing strikes/eye/braced counts.

## 7. Scope (one combat change on trial)
Tags (data + glyph on card/compare/wall), the eye to 8, two new parts (Grindstone, Flywheel:
the arms and torso sections each have a free wall peg), three reworks (Signal Flare, Patient,
Piston), the pedestal match, simulator and log. No new enemies, no new systems.

## Recommended
- One tag per part: close, marksman or none; no set bonuses.
- The base kit first: the eye's planted shot to 8 so close isn't dominant before tags.
- Hand and eye unchanged by tags; parts bend them.
- Grindstone (close arms): cooldown runs only in reach; hand breaks refund it.
- Patient Lens (marksman head): charges only planted; a full shot breaks a leader's windup.
- Signal Flare becomes close's head part: hand breaks mark, next hit lands twice.
- Flywheel (marksman torso): planted spin, releases a shove when an enemy reaches you.
- Piston becomes marksman's arms part: planted, double knockback, stance kept.
- Pedestal match: one in three from your leading leaning; none worn, one of each.
- Checks: take-rate ceiling 1.6x median, per-slot coverage, commit >= 40% and balanced.
