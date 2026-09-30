# ENGINE-N17: the outrun rule's numbers

The balancer's call on K-N17 (STAGE-C §4), 30 Sep. It reads the C6 code in `src/engine.ts` as it stands (uncommitted) and the
engineer's what-if table. Nothing here has been run. The combined set in §1 needs one K-N17 pass before it is locked.

## 1. Recommended values

| key | now | recommended | reason |
|---|---|---|---|
| `steam.len` | 7 | **11** | `range + leadMax` (8 + 3). A jet booked at range should reach the point it aims at. This is a bug fix (§2). |
| `cinder.leadS` | 0.6 | **1.0** | Lead by the whole flight (`flightMs` / 1000). The Arbiter's outrun shell does the same (`ARBITER.outrun.leadS` 1.0), so the rule is symmetric. |
| `cinder.leadMax` | 3.0 | **5.5** | 5.5 u/s × 1.0 s. The cap never binds at walking speed, so it only stops a dash from being over-led. |
| `outrun.afterMs` | [5000, 3500] | **[6500, 5000]** | Phase 1 uses the Arbiter's outrun clock (`shellMs` 6500). Phase 2 gets a real step up (§3). |
| `outrun.cooldownMs` | 5000 | 5000 (keep) | Keep it: raising it would flatten phase 2 again (§3). |
| `cinder.damage`, `r`, `flightMs` | 12, 1.6, 1000 | keep | These are the Arbiter's shell values. K-N9's slack is 409 ms, and none of these changes touch it. |
| `steam.range`, `damage`, `halfW` | 8, 14, 1.3 | keep | The slack rule doesn't depend on length (700 − 300 − 236 = 164). Range 9 with len 9 was measured and did nothing. |

**Expected result (a model, not measured):**
- **camp:** 78-91. The cinder period goes from 5.62 s to 7.12 s, so 6-7 cinders × 13.0 on average.
- **circle:** 60-80. Steam with len 11 alone gave 60.7. Cinders now land when it runs straight through a long out-of-range stretch, but the 6.5 s clock makes that rare.

**Why cadence, not accuracy, is the dial:** a cinder that under-leads teaches nothing. At 0.6 s a steady runner is never hit, so
"keep running", the very answer the rule exists to remove, beats it. At 1.0 s one sentence is true: *it lands where you'll be; stop, turn,
or step aside.* Tune how often it comes, never whether it can hit.

**If the pass misses the band (§4):**

| result | change |
|---|---|
| circle < 40 | `afterMs[0]` to 5500 |
| circle > camp, or camp > 95 | `afterMs[0]` to 7500 |
| circle > 85 but below camp | `steam.gapS` to [7, 10] |

## 2. Steam len vs range: a bug, fix it regardless

A strip that is booked in range and then stops short of him every time reads as broken. It looks like a telegraph that can't hit.
Pairing drawn = hit with "never reaches" teaches the player that the tells lie. Distance to the aim point at the lock
= lock distance (8.8-9.2 measured, because he drifts out during the 250 ms track) + lead (up to `leadMax` 3). That is 11.8-12.2 u, so 7 can't reach it.
Add to K-N8: **`steam.len ≥ steam.range + steam.leadMax`**. At 11 a worst-case lock can still end about 1 u short of the aim point.
That is honest: the strip is drawn short, so it misses. Camp is unaffected, because steam never books at c (9-10.6 u from the loop is more than 8).

## 3. Camp at 104: ease it, through `afterMs[0]` and not the cooldown

- **104 in 45 s:** zero input dies at about 45 s, well before the fight's guessed 85-100 s. A ring every 5.6 s makes the centre of the
  loop the busiest place in the phase. The centre should be the breather between lever windows, with a one-step tax. At 7.1 s it is.
- **Phase 2 has no step up today.** A cinder books only when `outMs ≥ afterMs` and `sinceCinder ≥ cooldownMs`. Both clocks reset at launch, so
  the period is `max(afterMs, cooldown) + windupMs`. That is 5.62 s in both phases, so `afterMs[1]` 3500 never takes effect. With [6500, 5000]
  the periods are 7.12 s, then 5.62 s. Raising the cooldown instead would push phase 2's period up too.
- Camp must still cost at least as much as circling. If planting is cheaper than moving, the rule teaches "stand still".

## 4. K-N17's thresholds, revised

| bot | now | revised | reason |
|---|---|---|---|
| circle | FAIL < 20 | **FAIL < 40 or > 85** | The floor player's whole-fight budget is 51.3 HP over ~90 s (CURVE9), about 25 per 45 s. At 20, ignoring every tell would cost *less* than playing, so 40 is about 1.6× the budget rate. A person who reads 3 tells in 4 pays about 25% of the bot's figure, 10-21 per 45 s, which leaves room for rail hits. The 85 cap keeps it under the Arbiter's accepted 60-108 (and the owner's feel on that is still pending), because the Engine adds rails and levers on top. |
| camp | FAIL < 20 | **FAIL < 50 or > 95** | Zero input must be taxed. The cap is under 100 so that planting in the calm spot isn't a death inside 45 s. Means only: ENG6 at `bossDmg` 1.2 runs about 10% over. |
| camp vs circle | none | **FAIL if circle > camp** | Moving must never be the worse non-answer. |
| dodge | FAIL if hit by steam or cinder | keep | Escape stays 590 ms against a 1000 ms flight, and the lateral 0.24 s against the 700 ms lock. |
| INFO | before/after | add the phase-2 cinder period (5.62 s expected) | This catches `afterMs[1]` going dead again. |
