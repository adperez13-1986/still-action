# Round 1: Claude

**Verdict: partly.** He's right that something is passive, and I think the planted shot is exactly the
Archero rule he's naming (stand still, it fires). But I don't think the auto existing is the problem. The
problem is its **share**: 67% of his damage is free. With that split, the four buttons, the push and
where he stands are garnish on a fight the autos are already winning. Removing the auto fixes the share
by force. Retuning or earning it might fix it without the costs below.

**What "active" should mean here.** Not pressing more: at ~59 presses a minute he isn't idle. It should
mean **the fight changes because of a choice he made in the last second or two**: which part, which body,
where to stand for it, whether to push (and pay strain). A good test for any option: in a pressure crowd,
could he describe why a body died? "I hooked the sentinel into the Cleaver" is active. "It was in range" is
not.

**What removing the auto outright costs (option B, and C if the pressed basic is weak):**
- **Dead time between cooldowns.** Parts at 3-12 s leave gaps. Filling them means pushing, and pushing is
  strain. That turns the run-length resource into the fight's filler and makes strain forfeits come from
  boredom, not greed.
- **Pressure crowds were balanced against a free floor.** Mites and hulk crowds with no basic will either
  overwhelm or need re-curving (CURVE9 is a first pass anyway).
- **Mastery and synergy lose their setter.** "The autos set states, parts pay" is the synergy spine
  (design/synergy). With no autos, masteries have nowhere to live and leanings go back to a tag.

**My proposal: D, an earned auto, with parts made to carry.** The autos fire only for a short window after
one of his parts lands (a guess: 2.5 s "warm", shown on Still's core). Any part hit warms him; nothing else
does. That means:
- The parts become the engine and the autos become the follow-through. The split should move toward parts
  without shrinking the autos' numbers.
- "Never dead time" survives only if he keeps casting, which is the point.
- Mastery and synergy keep working, because the autos still set states. They just set them after a
  decision.
- The planted shot stays, but it only fires while warm, so standing still is a choice he pays into, not
  Archero's resting state.

Costs: cooldowns probably need to come down (the balancer's numbers should say how far). Kiting with
nothing ready becomes a real gap, which might be good (a breather) or might feel bad (it's what he
dislikes about Vampire Survivors from the other side). A second read for the phone: the warm state has to
be visible without looking at Still's core in a crowd.

**Where I'd push back on C (a fifth, pressed basic).** On this layout the right thumb has four buttons on
an arc. A fifth, larger button (Diablo Immortal's way) works, but hold-to-attack is an auto with a finger
on it. It's only more active if the basic has commitment: a rooted swing, a 3-hit string whose third hit
shoves, a dash that cancels it. That's a bigger build than D and moves every part further from centre.
I'd want the translator's read on the thumb before believing it.

**The smallest trial:** two pause switches, played one run each.
- "autos earned": the warm window as above, with cooldowns x0.75.
- "autos off": no autos at all, with cooldowns x0.6 (to feel B at its best, not at its worst).
What he should notice: does a pressure crowd feel like a problem to solve, or a chore? Log: the damage
split per depth (autoDmg vs partDmg is already logged), pushes per fight, strain out, and time with every
button cooling (new field: `coldS`, seconds where nothing was ready and no auto could fire).
