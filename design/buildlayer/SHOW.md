# B6a: show the core (3 Oct 2026)

His first runs with the cores (B6), his words: "I honestly have no idea what Wake and Ram are doing.. there are texts, but I see no
effect, no clue how I am getting benefits from them.. I see some counters but whether they affect anything, I don't know."

This session: no design agents (his call, to save tokens). Lead thinks it through, one Sonnet 5.5 engineer builds, lead reviews.

## Why he can't see it (read from the code)

- A **spend** (the whole payoff) is a sound and a 0.12 s ring drain (`coreEvent` in main.ts, `markfx.ts`). No number, no burst.
- A **Wake skim** (the core's own act) is one frost mote (`vfx.frost(..., 1, 0.12)`).
- A **mark landing** has no sound and no pop; the ring just gains a third.
- **Which buttons spend** is only told by the digit, which shows only when there is something to spend now.
- The early spender (Scrap Cleaver) spends at k 3 / 4: a full spend is +9 / +12, invisible without a number.

So the loop (core marks → spender cashes marks → extra damage) exists and is never drawn. No numbers change in this step.

## What to build (visuals, sound, words only; no combat number changes)

1. **The spend number.** Every `spend` event puts a floating cold number `+{bonus}` above the body: rises ~0.6 u and fades over ~0.7 s.
   It's the only damage number in the world, kept for the core's bonus, so it means "this is what the core gave you". Size steps
   with marks spent (1 / 2 / 3+: small / medium / large, max ~1.4x of small). Pooled (cap 8 at once, oldest recycled). DOM overlay
   projected from world to screen each frame, or sprites; engineer's choice, must be cheap on a phone.
2. **The spend burst.** On a spend, the rings break outward instead of only draining: a ring flash at the feet (`combat.ring` or vfx
   equivalent, cold) plus a few ice shards. At 2+ marks a hitstop of 0.03 (respect the existing `combat.weight` hitstop rule used in
   `shoveEvent`). The spend must be the loudest core beat.
3. **The mark landing.** Each `mark` event with `added > 0`: a soft cold tick (new sfx, pitch rising with the stack n: 1 / 2 / 3) and
   a short scale pop of that body's ring (markfx). At cap, the ring holds a slow gentle pulse so "full, cash it" reads.
4. **The Wake skim.** Replace the single mote with a visible short cold slash along the body's near side (a streak of 4-5 trail
   segments, perpendicular to the Still→body line, ~1 u long at body height ~0.5) plus the existing mote.
5. **Spender buttons.** With a core worn, every slot whose part has `fits[core].role === 'spend'` carries a cold rim (CSS class)
   always, digit or not. Others don't. That's the visible link: blue rim = cashes marks.
6. **A first-fights hint.** With a core worn, a one-line caption at the top of the fight (the existing hint system, own hint id per
   core, shown once per save) for the first fight, gone after the first spend or ~8 s:
   - Wake: `Pass beside them to frost them. Blue buttons break the frost for extra damage.`
   - Ram: `Your shove marks what hits a wall or a body. Blue buttons break the marks for extra damage.`
   PLACEHOLDER words in `cores.ts` `WORDS`.
7. **The pick card** gains a third line: `Blue buttons spend them.` (WORDS, PLACEHOLDER).
8. **The pause readout** adds the run's spend bonus: `marked 41 · spent 29 · +312 damage` (sum of `spend` bonuses this run; the
   stats already carry `spends.bonus` per depth).
9. **Wake reads as a wake** (the player's ask, added 3 Oct). Wake worn only; visuals only.
   - **9a. The aura.** One flat cold field on the floor around Still at the real skim zone (his radius + `CORES.wake.radius` 1.6: a skim
     counts a body whose EDGE is within it, so the reach is drawn honestly). Dim (~0.15) below `minSpeed`, brighter (~0.45) at or above it. The two
     side arcs (45-135 deg off his movement, `sideCos`) are brighter than front and back: "beside, not behind". It turns with his movement,
     eases its brightness (~0.15 s), and flashes on each skim. One mesh, normal-blended with a darker rim so it reads on warm and dark floors.
   - **9b. The trail.** A cold streak on the floor along his path while he moves at or above `minSpeed`, ~0.5 u wide, fading over ~1 s. One mesh: a fixed
     ring buffer of points in one ribbon geometry with per-vertex alpha, sampled every ~0.15 u of travel, cleared on a level change. No `vfx.trail` per point.
   - Budget: the whole step is at most +4 draw calls at peak (these two are 2 of them). The per-core screenshot shows Wake moving beside a body.
10. **Ram reads as a shove, and a slam as a slam** (the player's ask, added 3 Oct, the twin of 9). Ram worn only; visuals only.
   - **10a. The reach.** One flat steel-blue ring on the floor round Still at the beat shove's real reach (`HAND_REACH`: combat.ts `inReach` tests the body's EDGE
     against range + `MELEE_PAD` - 0.55 from his centre), in Ram's notched look from markfx, dim (~0.2). On each beat or catch shove the wedge facing the shoved body
     brightens and pulses outward over ~0.2 s: the rhythm, and who got shoved. One mesh, a shader.
   - **10b. Slams are much bigger than plain shoves.** A plain shove keeps today's clack and sparks. A slam adds a steel streak on the floor along the body's path
     (~0.4 s), a crack at the impact (~0.8 s), both from one pooled mesh (cap 6), more index-spread sparks, and shake 0.12 (was 0.07). The hitstop rule is unchanged.
     No more white flash on the body itself (the known pale-blob issue).
   - Budget: the whole step is at most +6 draw calls at peak (item 10 adds 2).
   - Words: the player-facing use of Wake's mark word lives only in `cores.ts` WORDS (the hint, the pick card, the fit lines), so a rename is one line. **Decided 3 Oct (the player): "frosted"** replaces "rime" / "rimed" in everything he reads (item 6's hint is now `Pass beside them to frost them. Blue buttons break the frost for extra damage.`, the pick card's `leaves`, Spray, Frost Flare, the fit lines). Code identifiers (the `rime` mod kind) are unchanged.

## Rules

- **No `Math.random` in new code.** Visuals share combat's random today (L0 will split it); new spreads use deterministic offsets
  (index-based angles) so the fight record is unchanged. Check: K-90F / K-90 fights compare equal.
- No combat number changes. `BUILDS=0` and bare runs identical.
- Draw calls: at most +4 at peak for all of this (items 1-8 add none; item 9 adds 2).
- Screens: one fight screenshot per core mid-spend (the number visible), the hint, a rimmed button, the pick card, the pause block.
