# Synergy: enemy states, balanced against melting

28 Sep 2026. Four voices (balancer, translator, verifier, Claude), two rounds; raw files here, brief in
`BRIEF.md`. His ask: "can a balance between melting and parts synergy be created?"

## The short answer

Yes, but not the way I first pitched it. The balancer's sim found that **two parts setting and paying
a state are worth almost nothing on packs**: a crawl fight lasts ~4 s, a setting part cools 5-8 s, and
overkill eats any multiplier. On a heavy, a pair of parts is worth about one rank. What changes that is
**mastery**: a state set by the close strike or the planted shot is on every auto hit, so one paying part
reaches rank-III value. So the shape all four agreed on is:

> **Your autos set states (through mastery), your parts pay them off.** Some parts set states too.

Melting and pairing each get their own place: **ranks win on heavies and bosses, pairs win on packs**
(with shatter, below). The choice between them is real at rank II.

## Agreed by all four

- **Four states**, each shown in its own place, all in Still's cold light:

  | State | Shown | Set by | Payoff |
  |---|---|---|---|
  | **Chilled** | on the body (the rime, exists) | Chill Vent, Frost Trail, Cold Strike/Shot | x2 on a paying part's hit, used up |
  | **Marked** | over the head (brackets, exist) | Signal Flare, Marking Strike/Shot | x2, used up |
  | **Slammed** | on the wall (a cold crack) | a part's shove that ends on a wall | x2, used up. Pinned in place, **no stun** |
  | **Hauled** (was "clumped") | on the floor (a cold cinch) | Rusted Hook, Backdraft Vent: pulled by you, 2 s | **no multiplier**: an area part catches every hauled body |

- **One multiplier a hit, cap x2** (rule 3, clarified: "beyond the part's own numbers", so temper is fine).
- **A state set by a part's own slot pays nothing:** a pair is always two parts, or a mastery and a part.
- **Marks pay only paying parts** (today any part pays: Marking Strike is the strongest thing in the game,
  +29% on a boss). Signal Flare's own hit 4 -> 12 (at 4 it's a trap pick).
- **Bosses take chilled and marked for paying parts**, never the slow. Otherwise synergy is zero where
  most of your Broke runs ended.
- **A swap lands at rank II.** It already happens if you melt the dropped part into the new one; make it
  automatic and say it on the card: **"take: Piston II · Scrap Cleaver III melts in"**. Keeping half the
  rank on top would make swaps free; a true full reset would kill swaps by mid-run.
- **Paying parts aim at enemies carrying their state** (bolts, lobs, arcs only; never turning away from a
  nearer enemy winding up).
- **The state says when to push.** A worn pair shows a glyph on the paying part's button; it **lights
  when a push would pay** (the state is live on an enemy it reaches). A one-time caption: "hold · pay it".
- **The pay is loud**: the state breaks with its own effect and one shared cold "paid" sound, on a body that
  survives or on a pushed pay (a kill already has its burst).
- **The floor card names the pair**: "pairs with Chill Vent", or "ends its pair with Pressure Vent".
- **Leanings** mean "where your pairs live": close parts pay close states, marksman parts marksman ones; with
  pedestals favouring your lean, a lean becomes "more pair offers". No set bonuses.

## Proposed by one voice, not yet argued

- **Shatter** (balancer, round 2): a kill by a paid hit passes its extra damage to the nearest body within
  3 u. Not a multiplier, never pays twice. It takes a pair on packs from ~0% to +15%, about a rank's worth,
  which is what makes "pairs win on packs" true. Without it, pairs only matter on heavies.

## Where they differ (yours to decide)

1. **Mastery chill: slow or not?** The verifier's rule: masteries may set only states that don't protect
   you on their own, so Cold Strike/Shot chill **without** the slow (the free auto then does offence only).
   The translator: one look must mean one thing, so keep the slow but shorter. Claude sides with the verifier.
2. **New masteries.** Hauling Strike (every close strike drags its target a step in: sets hauled) has
   support; Heavy Shot (knockback, sets slammed) doesn't: a free shove into walls is defence from a free auto.

## What we'd build first (one trial)

1. The plumbing: one state function (`src/states.ts`), `sets` / `pays` on parts, checks in a new
   `tools/statecheck.ts`.
2. Marks narrowed to paying parts (Patient Lens, Parry Clamp, Overrun); Signal Flare 12.
3. **Chilled pays:** Scrap Cleaver and Cracked Lens, x2 used up; bosses take chill for payers.
4. Swap lands at II, on the card.
5. The lit push glyph, "hold · pay it", "pairs with X" on the floor card, the pay sound.
6. Shatter, if you want it in the first trial.
7. Log fields (the verifier's list) and exact checks: the autos pay nothing, no multiplier above x2,
   every pay crosses slots.

**Pass lines after 3 runs:** with a chill pair worn, at least half a paid hit a pack and one a heavy;
the bonus is 15-33% of the paying part's damage; most chills get paid, not wasted; you press into the state
within 2.5 s; at least 0.3 pushes into a state a fight (crawl pushes up from 0.49).

**Then:** slammed (step 2), hauled (step 3), after your runs.

## Yours to decide

1. Build the first trial as above?
2. Mastery chill: without the slow (verifier, Claude) or with a shorter slow (translator)?
3. Shatter in the first trial, or later?
4. Pedestals: keep them as the place your lean brings pair offers, or remove them?
