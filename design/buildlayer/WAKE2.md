# B6b: Wake's frost bites, and the trail frosts (3 Oct 2026)

His call after learning Wake has no auto attack: "not weak auto, but rather very low damage while frosted, plus make the trail also
induce frosted". Lead's numbers (no design agents this session, his rule). Builds after B6a (`SHOW.md`) is reviewed and pushed, since
B6a must leave every fight equal and this deliberately changes Wake's.

## 1. Frostbite

- A body with Wake marks (n > 0) takes `bite.damage` 1 every `bite.everyS` 0.5 s while frosted (2 / s), through the core's auto path
  (`autoHit(e, dmg, 'core')`, so x BOSS_AUTO_MUL on a boss like any auto). Flat: not scaled by the mark count.
- A skim keeps its own 6. With marks living 3 s, an unspent frost adds ~6 on top: a skim is worth ~12 if never cashed.
- Ticks on combat time, per body, deterministically (a per-body accumulator on EnemyStatus beside `marks`). Stops the tick the marks
  are spent or run out. Never spends, never adds marks.
- The look: a tiny cold mote at the body each tick, no sound (it's background; the spend stays loudest).
- Log: `st.skims.bite` (damage dealt by frostbite), counted in `autoDmg.core`.

## 2. The trail frosts

- The trail becomes combat state: `combat.ts` keeps Wake's trail points (the same sampling as B6a's ribbon: every ~0.15 u of travel
  at or above `minSpeed`, life `trail.lifeS` 1.0 s). The ribbon (B6a 9b) draws from these points, so what he sees is what frosts.
- An awake body whose edge is within `trail.halfWidth` 0.25 u of a live trail segment gets +1 mark (`by: 'core'`), at most once a
  `trail.perBodyS` 1.0 s per body (its own timer, separate from the skim's). No damage from the trail itself.
- A trail mark triggers Burst and Spray like a skim's mark? **No**: only a skim does (Burst is the skim filling the ring). Keep the
  keystones on the skim.
- Cleared on a level change and when Wake isn't worn.
- The look: the trail segment under the body flashes as it frosts (a short brighten of those ribbon vertices).

## Numbers, all in `cores.ts` `CORES.wake`

`bite: { damage: 1, everyS: 0.5 }`, `trail: { lifeS: 1.0, stepU: 0.15, halfWidth: 0.25, perBodyS: 1.0 }`.

## Checks

- Bare game and `BUILDS=0`: fights equal (K-90 / K-90F). Ram: equal.
- Wake: report the change, don't tune. The Wake bot's core damage on packs and bosses before/after (K-M23 or the build-sim), the
  share from bite vs skim vs spends, and kiting: a bot running straight away from a chaser pack for 10 s, damage dealt before/after.
- corecheck holds the new numbers.
