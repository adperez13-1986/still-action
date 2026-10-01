# Lean on the parts, round 1: Claude

## Ask 1, tougher enemies + stronger parts: partly agree

**Strongest reason against doing it as stated:** if enemy HP goes up by k and part damage goes up by k, the parts
kill exactly as fast as before and the autos are worth 1/k as much. That is "autos x(1/k)" written as a buff. The
autos round already priced that: the never-melt player does ~64% of his damage with autos, so k = 1.5 makes his
kill time 1.5 / (0.36 x 1.5 + 0.64) = x1.27, the same 30% tax the bank charged, and his pace is hesitation, so
he won't press it back (TRIAL-1: presses per play-minute unchanged under the bank). It will feel better (bigger
numbers on the parts) and play the same as the bank on the floor.

**What I'd do instead: make the parts stronger in *kind*, and the enemies tougher in *number*.**
- The autos are single-target (the strike hits the nearest body; the lance pierces a line). Most parts hit an
  area, a cone, a line, or move bodies. **More bodies per pack, not more HP per body**, shifts weight onto the parts
  without taxing a never-melt player's single-target kills. A cleave through five is worth 5 strikes; through two,
  barely 2. The log agrees: parts' share is lowest at d1 (43%, small packs) and highest deep (70-83%, big packs).
- **Stronger = more consequence per hit, not only damage:** a real stagger (the body stops its approach for
  ~0.4 s), a heavier shove, a kill that throws the body. Things the autos never do. Damage up where a part is
  plainly weak (balancer: which).
- Keep HP the dial for bosses only, where autos already take x0.5.

## Ask 3, every cast a push: agree with the complaint, disagree with V1

**The trouble is the gesture.** Hold 180 ms on a button whose sweep reads "off", no feedback until it fires; 1 in 5
pushes held under 240 ms (he's already tapping cooling buttons expecting something). That's a UI tax on a choice.

**V1 (every cast pushes, always costs strain) works against his own goal.** If every press costs strain, the more
he leans on the parts the sooner he Stops. Strain stops being a choice ("do I spend the run on this fight?") and
becomes a fuel gauge on pressing, which teaches him to press *less* and let the autos work. At 10-20 presses a
play-minute, even +1 a cast is ~100+ strain a run against a cap of 20: the whole economy has to be rebuilt, and
Stopped becomes the default ending for the active player. And if every hit breaks windups, a windup stops being a
question.

**My pick: V2 plus.** A **tap on a cooling button pushes at once** (+2 as now, no hold), with the ember pips that
already show the price. Ready casts get the **threat aim** for free (aiming isn't a power, there's no reason a ready
cast should aim worse than a pushed one). The break stays the push's. Guard against the accidental tap: a tap in the
last ~250 ms of a cooldown buffers to the ready cast instead of pushing (no strain for impatience).

## Ask 2, drama: agree, and it's the cheapest lever here

Today every auto beat already gets 22 ms of hitstop and a 0.06 shake (main.ts ~555), every 0.62 s: the free hit
is juiced on a metronome, and the parts compete with that. **Make the autos quieter and the parts louder** is the
perceptual version of "lean on the parts": auto hitstop to ~0, smaller sparks; every part hit gets a per-slot
recipe (anticipation on Still's rig, 50-90 ms hitstop scaled by damage, a camera kick toward the hit, an enemy
flinch/knockback, a layered sound with a low end). Per slot, not per part: arms = weight (hitstop, kick, chunks);
head = precision (a freeze-frame on the line, a crack); torso = pressure (a ring, a shove wave); legs = motion
(ghosting, a landing slam). Watch the peach lesson: cold blues and deep reds, not light orange.

## The smallest trial

Two pause switches, each applying at once, separate so he can tell them apart:
1. **"heavy parts"**: the drama recipe + autos quietened. Log nothing new; his feel judges ("do I want to press?").
   It's also the one most likely to change hesitation: a press that *feels* big gets pressed.
2. **"tap push"**: V2 plus. Log: pushes a fight, `leftMs` per push, buffered-near-ready count, Stopped.
Then the pack-size change, once the balancer has numbers on which depths and bodies.
