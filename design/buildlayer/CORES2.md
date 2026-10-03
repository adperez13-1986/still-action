# Two more cores: Graze and Tether (3 Oct 2026)

His call (3 Oct, after B6a/B6b): "I like it, the cues are helpful, the numbers are also good. It's more difficult as well.. can you
start designing the other cores? Just do it yourself, then give the design to sonnet 5.5 to implement. I am not satisfied yet with
the 2 cores, we need to tune them further, but the main idea works." Lead's design, no design agents (his session rule).

Every name and word is PLACEHOLDER. Every number lives in `cores.ts` and is a first guess by analogy with Wake and Ram; nothing
here is tuned. Tuning all four comes after his runs.

## Four verbs, four places to stand

| core | where Still is | what marks a body | the rule that stops the cheap play |
|---|---|---|---|
| Wake | close, always moving | passing beside it (and his trail) | beside, not behind |
| Ram | close, holding ground | a shove that ends on a wall or a body | a shove into air marks nothing |
| **Graze** | close, at the edge of their swing | **an attack that just misses him** | a strike that lands, or one he was nowhere near, gives nothing |
| **Tether** | middle distance, circling | **a wire from him to one body, swept across others** | only a crossing counts; bodies lying along the wire don't |

Graze is "the enemy causes it" (rule 2 from the first round). Breaker tried it, but Breaker's catch now lives in Ram's Catch keystone.
Graze is different: Still causes nothing and reads everything. Tether is the first core whose spenders are the lenses (the head
slot), so a ranged build finally exists without being "the eye again": the eye shot at things, while the wire has to be swept.

## 1. Graze

**The rule.** When an enemy's melee strike resolves (`action.kind === 'melee'` in combat.ts's enemy loop) and does **not** reach
Still, but Still was within `margin` of reaching (his distance to the attacker <= `action.reach + margin`), it's a **graze**:
- the attacker takes `damage` (a core hit, `autoHit(e, dmg, 'core')`, full on an immovable body like Wake's `bossSkim`) and
  `marks` marks;
- once per strike.
Lane strikes (`action.tested`: a charger's lane) count if the lane missed and Still's edge was within `margin` of it. If the lane
geometry isn't at hand where the test runs, leave lanes out of v1 and say so.
**Shots:** an enemy shot that passes within `shotMargin` of Still's edge and doesn't hit him (and isn't blocked first) grazes its
owner once: `shotMarks` mark, no damage. Waves and hazards never graze.
No auto, no beat: Graze does nothing until something swings at him.

`graze: { margin: 1.0, damage: 10, marks: 2, shotMargin: 0.7, shotMarks: 1 }`, `K: 8, cap: 3, lifeS: 3`.

**Spenders** (`fits.graze`): Parry Clamp `k 10` (the pair: slip the swing, snap the clamp), Anvil `k 12`, Overrun `k 8`, Scrap
Cleaver `k 4` (the white bridge, as for Wake and Ram). **Shapers:** Skitter ("hop to the edge of their swing"), Lure ("they swing
at it, and you"). **Guards:** Mirror Ward ("a reflected shot grazes its owner": a reflect counts as a shot graze), Borrowed Time
("undo a graze gone wrong").
**Keystones:** packs, **Feint**: a graze also gives 1 mark to every other awake body within `radius 2.0` of Still. Bosses,
**Read**: a graze on an immovable body gives `marks 3` and its `margin` is `1.6`.
**Upgrades** (from d7, as Wake and Ram): **Riposte**: each graze takes `0.4 s` off every spender's cooldown; the spender
buttons flash cold. **Wide Berth**: `margin` 1.0 -> 1.5; the band under winding-up enemies widens.

**The look, the most important part.** Graze is only playable if he can see where to stand:
- **The band:** under every awake enemy that starts a windup within 8 u of Still, a thin cold ring band on the floor from its
  reach to reach + margin, for the windup's length: "stand here when it swings". One instanced mesh, cap 6.
- **A graze:** a cold whiff streak past Still on the attacker's side, the band flashes and breaks, a mark tick. A short "tsss"
  sound unlike the spend's.
- **The ring:** a thin double ring (Wake's is smooth, Ram's notched).
- **Hint:** `Let them swing and just miss. Blue buttons break the marks for extra damage.`
- **Pick card:** thumb `Stand at the edge of their swing.`, leaves `What just misses you is grazed.`, mark word `grazed`.

## 2. Tether

**The wire.** With no wire up, the core hooks the nearest awake, targetable body between `minR 3` and `maxR 9` u in line of sight
(walls block, like shots), at most once every `rehookS 0.5` s. The hooked body (the anchor) gets 1 mark. The wire runs from
Still to the anchor. It breaks when the anchor dies, goes past `breakR 10` u, or line of sight is blocked for `losGraceS 0.3` s.
**The sweep.** Every tick, for every other awake body: which side of the wire it's on (the sign of the 2D cross product), and
whether its projection falls inside the segment. When the side **flips** inside the segment, with the body's edge within
`reach 0.4` of the wire, that's a **crossing**: `damage` and 1 mark, at most once per body per `perBodyS`. A body lying along
the wire (a chaser following him from the anchor's side) never flips, so running straight away earns nothing. He has to circle.
**The anchor** takes `anchorDamage` and 1 mark every `anchorEveryS` while held, so a boss alone isn't dead air.

`tether: { minR: 3, maxR: 9, breakR: 10, rehookS: 0.5, losGraceS: 0.3, reach: 0.4, damage: 6, perBodyS: 0.5, anchorDamage: 4, anchorEveryS: 1.5 }`,
`K: 6, cap: 3, lifeS: 3`.

**Spenders** (`fits.tether`), the lenses: Focusing Lens `k 5` (the white bridge), Cracked Lens `k 8` (it pierces: it spends on
every marked body down the line), Patient Lens `k 10`, Through-Line `k 8`, Ricochet Lens `k 6`. **Shapers:** Rusted Hook ("yanks them
across the wire"), Lure ("they walk across the wire to it"), Chill Vent ("slows them on the wire"). **Guards:** Plumb Line ("snap
back and swing the wire"), Ward.
**Keystones:** packs, **Snag**: a crossing slows that body x0.6 for 1 s. Bosses, **Taut**: tethered to an immovable body, the
anchor's tick is every 0.75 s and the wire doesn't break for range.
**Upgrades:** **Second Line**: a second wire to the next nearest valid body, swept the same way. **Whip**: when a wire breaks for
range or the anchor's death, every awake body within 1.5 u of where the wire was takes 6 and 1 mark, and a crack runs down the line.

**The look.**
- **The wire:** a thin cold line from Still's chest to the anchor, slightly slack (a shallow curve), one mesh. It flashes along
  its length on a crossing, and snaps (two recoiling halves, 0.2 s) when it breaks.
- **The anchor:** a small cold hook glyph above it while held.
- **A crossing:** a spark at the crossing point on the wire, a mark tick.
- **The ring:** a ring with a single gap, like a hook.
- **Hint:** `Circle so the wire sweeps across them. Blue buttons break the marks for extra damage.`
- **Pick card:** thumb `Circle them at a distance.`, leaves `What the wire sweeps across is snagged.`, mark word `snagged`.

## 3. The pick, the hunt, the rest

- **The pick shows all four cards** while he's testing them (one row in landscape, 2x2 in portrait). Later, maybe two of four.
- The hunt (`rollForCore`), fit rings, fit lines, the spend digit, the blue rim, the pause block, the readout, B6a's number and
  burst: all read `fits` / `CORES`, so they should work as they are. Check each with the new cores.
- No reshapes (VARIANTS) for either new core in v1.
- `CoreId` widens to four. Old saves are fine (their core is wake, ram or none).
- Logs: `st.grazes { n, melee, shot, lane, boss }`, `st.tether { hooks, breaks, crossings, anchorTicks }`, filled like `skims`.

## 4. Build order

- **N1 Graze**, plus the four-card pick (Graze, Wake, Ram; Tether's card reads "soon" and is disabled until N2).
- **N2 Tether**, and the pick's fourth card goes live.
- Each step: no Math.random in new code; the bare game, `BUILDS=0`, Wake and Ram all unchanged (K-90 / K-90F equal; cored
  runs equal to HEAD's); corecheck holds the new numbers; a bot report per new core (the K-M23 kind: marks made/spent, core damage,
  grazes or crossings per second, the Assembler felled or not), reported, not tuned; screenshots of the pick, the band or wire,
  a graze or crossing, and a spend.
- Draw calls: at most +3 per new core.
