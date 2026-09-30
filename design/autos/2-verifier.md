# Autos, round 2: verifier (30 Sep)

**Changed verdict: the trial should be the balancer's bank (D3), not my claim.** I accept the balancer's correction on
the 67%: `partDmg` only exists in 2 runs, which is a bigger problem than the nominal-logging point I raised.

## 1. Bank vs claim: code and check load

| | bank (D3) | claim (mine) |
|---|---|---|
| state | one `combat.bank` number, cleared in `reset()` | `claimT` on every `EnemyStatus`, ticked with the states |
| where it's set | `useAbility`, once the result is not `refused` (casts and pushes both count) | `hitPart` |
| gate | one test in the auto block (`combat.ts` 656), one decrement per strike or lance. Cleave and split don't spend | filters in `handTarget`, `nearest` and `eyePick`. `eyePick` is shared with `eyeHead`, so a part path has to be split out |
| on screen | one read on Still (pips or core glow) | a rim on every claimed body in a crowd |
| modelled | yes | no |

The bank is smaller and it has been modelled, so it is the more honest trial. I also have to correct my own check.
In K-90F, F1-F5, F8 and F9 never cast the Cleaver. Under either switch the autos go silent in those, so an `--x-on`
diff can't tell bank from claim. My "F10-F14 equal" proof also misses the claim's real leak (head casts through
`eyePick`), because no scenario wears a head part. For the bank, add **F15**: F1 with the Cleaver fired when ready
and the switch on. Capture it as a new entry and leave the old ones untouched. Pin the switch off in the same
K-W3/T/E/N setups I listed in round 1.

## 2. The translator's accidental-push worry is confirmed, and it gets worse under the bank

From `playtest.json` (2,935 taps; `PUSH_HOLD_MS` is 180):

- A **tap on a ready button takes a median of 214 ms**, and 1,728 of his 2,519 ready taps (69%) are 180 ms or
  longer. His normal tap is longer than the push threshold.
- Of the 416 taps on a cooling button, 326 became pushes, 62 were dead and 28 were casts.
- 54 pushes lifted within 60 ms of the threshold (180-240 ms). Another 44 dead taps stopped just short of it
  (120-180 ms).

So any ordinary tap on a button he thinks is ready turns into a push, for +2 strain. The bank pays pushes 3 beats,
which makes pressing into a cooling button pay off. That rewards exactly this accident, and the balancer's pass line
of "casts ≥35 a minute" could be met partly by mistakes. Before the trial: add `leftMs` (cooldown left at press-down)
to `TapLog`, and count a push with `leftMs` under 400 as an early push, not a chosen one. Don't move
`PUSH_HOLD_MS` during the trial, or it gets confounded. If early pushes turn out to be more than ~25% of pushes,
raising the threshold toward ~300 ms is its own trial.

## 3. One switch with modes? No. Send only the bank to the phone

`pause.setSwitch` is boolean only (`pause.ts` 281). A mode cycle means building a new pause widget. The two rules
also compose (the bank decides when, the claim decides whom), so two booleans could both end up on and the log
couldn't separate them. One boolean, "follow-through", for the bank. The claim waits, and only comes back if the bank
passes on pace but he still says "things die I didn't choose".

## Where I disagree

- **Translator:** four changes in one switch (lance off, strike 5 with no breaks, x2 strike, the `eye` flag split).
  If the run feels different, nobody can say which change did it. The x2 strike can come later.
- **Claude:** the "autos off" switch with cooldowns x0.6. The balancer's B1 shows the push stops being worth
  anything at those cooldowns, and "stopped" becomes unreachable. That breaks a terminal-state invariant, so it
  shouldn't go to his phone.
- **Claude's 2.5 s warm window:** it is a bank counted in time. Counting beats is deterministic under K-90F, and
  "landed or not" means a miss can't lock him out.

**Bank trial log:** `bankBeats`, `emptyBeats`, `fightS` (balancer's), plus `leftMs` per tap and `earlyPushes` per depth.
