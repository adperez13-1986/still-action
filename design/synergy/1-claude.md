# Round 1: Claude

## The frame

Melting is depth (one slot gets strong); synergy is breadth (two slots multiply). The swap reset is
already the price that makes them compete: completing a pair means giving up a slot's rank. So the
round's real job is the exchange rate. Rank III on one part is about x1.6 damage and x0.72 cooldown,
roughly x2.2 that part's output. A pair has to be worth about that, or melting always wins; worth much
more, and the reset stops mattering.

## States (four, all shown in Still's cold light, never red)

| State | Set by | Lasts | Shown |
|---|---|---|---|
| **Chilled** | Chill Vent, Frost Trail, Cold Strike, Cold Shot | 3 s | the rime tint that exists (`statusTint`), plus frost motes |
| **Marked** | Signal Flare, Marking Strike, Marking Shot | 3-4 s (exists) | the mark that exists |
| **Clumped** | Backdraft Vent, Rusted Hook, Lure | 2 s, on every body it pulled | a thin cold ring under each |
| **Slammed** | Piston, Clamp Toss, Pressure Vent (a shove that ends on a wall) | 1.2 s, and it can't act | a crack decal on the wall, the body reeling |

No stacking: a state refreshes. One multiplier on a hit, the larger wins, cap x2 (the rule).

## Payers

A payer's card gets one line: "**Against chilled:** shatters for double." Each payoff is x2 on that
part's hit against its state, or a behaviour (a slammed body is pierced; a clump takes the full blast
at every body, no falloff). Candidates:

- Chilled: Scrap Cleaver, Piston, Kickstart (shatter x2).
- Marked: generic already (any part lands twice); leave it as the one universal payer.
- Clumped: Pressure Vent, Flare, Frayed Cleaver (x2 on a clump).
- Slammed: Focusing Lens, Cracked Lens, Overrun (x2 on a slammed body).

Every slot gets a setter and a payer. Some parts do both across two states (Piston sets slammed and
pays chilled), which is where builds get their shape.

## Melt vs synergy

A payer's x2 at ~50% uptime is x1.5 on that part: less than a rank III (x2.2). So a pair is worth it
when both halves are ranked, which is the point: the best build melts *and* pairs, and the choice is
which slot to give up for the missing half. I'd keep the full reset. Half a rank kept on swap makes the
pair nearly free and the choice soft.

## Leanings

The state map gives them meaning: close states (chilled, clumped) and marksman states (marked, slammed).
A close build sets and pays close states, so the tag says "these two parts talk". Mastery already feeds
it: Cold Strike is a close setter, Marking Shot a marksman one.

## Three steps

1. **States and one multiplier function** (combat.ts): clumped and slammed join chilled and marked;
   `stateMul(e, def)` returns the larger of the payoffs, capped at x2. Visuals for the two new states.
   Playable: nothing pays yet, but he sees states on bodies.
2. **Payer lines on 6-8 parts**, card text, a leancheck rule (every slot has a setter and a payer).
3. **The sim** (balancer's): pair value against a rank, the exchange rate tuned, then his runs.
