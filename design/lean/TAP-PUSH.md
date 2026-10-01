# Tap push (build brief)

1 Oct 2026. The second trial of the "lean on the parts" round: the pause switch **"tap push"**, the "tap push" row of
`design/lean/PITCHES.md`'s trial table. A coding agent follows it step by step (P0 to P2). The lead reviews each step
against its "Done when" list. Every file:line below was checked against the tree at 888084d.

His words (1 Oct): "I didn't like the hold approach, feels like it is not working, and I think it makes things complicated
for no reason. I know it is supposed to prevent accidental pushes, but more often than not, the hold makes intentional
pushes more difficult."

**Rules for the engineer:**
- The words "tap push" and every caption below are PLACEHOLDERS: Adrian writes the words.
- Do not commit.
- Do not start a dev server (`npm run dev`, `npx vite`): `vite.config.ts` binds 0.0.0.0. Checks start their own vite on
  127.0.0.1 (`tools/checks/lib.mjs` `startVite`).
- Do not touch:
  - strain: `STRAIN_PER_PUSH`, `STRAIN_MAX`, `QUIET_STRAIN`, the quiet, Rest, the floor (his call: "don't touch the strain economy");
  - `PUSH_HOLD_MS`, `BUFFER_MS` and the off path of the press handler: off is today's gesture exactly;
  - `fireSlot` / `__fire` (every suite drives the game through it);
  - anything of "weight" (`src/weight.ts`, `cast()`'s `full`).

---

## 1. Scope

**"tap push" on** changes the gesture on a filled part button and nothing else. A touch-down answers at once, in that
handler, as exactly one of:

| touch-down on | answer | what happens | strain |
|---|---|---|---|
| a ready button | **cast** | fires on the press, as today (settled) | the part's own, as today |
| a cooling (or hot) button, > 300 ms left | **push** | fires now, the real push: `fire(b, true)`, the same `pushed` path, cast, embers, `[14,26,14]` | +2, as today |
| a cooling (or hot) button, <= 300 ms left | **queued** | the ring snaps full (cold) and a soft tick; it fires as a ready cast (`pushed = false`) the moment the button readies | none |
| a cooling button within 250 ms of its own last fire **or last touch** (rolling: lead's change), or one already queued | **guarded** | nothing fires; the ember arc and the dry click | none |

- No hold anywhere. Holding after the answer does nothing more. Letting go does nothing more.
- A refused fire (the run said no) answers **refused**, the shake, as today.
- **No touch is ever silent:** every touch on a filled, enabled button gets one of the five answers inside the
  pointerdown handler (DOM classes, `--arm`, sound and vibration set synchronously, never waiting for `update()`).
- **Replaces today's 120 ms buffer** under the switch. Today (`hud.ts:512`) a press with <= 120 ms left and not hot is
  `'buffered'`: it fires as a cast when ready, held or released (the release sets `b.queued`, `hud.ts:521-525`), and logs
  `'cast'`. On, the 300 ms queue does this job at touch-down, logs `'queued'`, and the 120 ms branch never runs.

**The switch:**
- A pause switch "tap push", key `still-action.tapPush`, off by default (`=== '1'`).
- Applies at once, at any phase (a gesture: no level boundary). Flipped during a crawl, the open depth logs `tapPushMixed: true`.
- **Off is today's gesture exactly** (K-P1, with real presses).

**Unchanged:**
- strain numbers;
- ready presses;
- `fireSlot` / `__fire`;
- the "weight" switch. Both may be on (§2.6).

**Out of scope:**
- the 40 ms neighbour guard (dropped by the round: it is logged instead);
- any strain retune (PITCHES' parked cap 24 + free push);
- DESIGN.md "Hold means one thing", HANDOVER, PITCHES edits (the lead's).

---

## 2. The rule, in code terms

### 2.1 The answer, pure (`src/hud.ts`, P0)

Exported, beside the constants at `hud.ts:29`. The pointerdown handler calls this, and nothing else decides.

```ts
/** "tap push" (design/lean/TAP-PUSH.md): the queue window and the same-button mash guard, game ms. */
export const TAP = { queueMs: 300, guardMs: 250, queueSlackMs: 50, nbLogMs: 1000 } as const
export type TapAnswer = 'cast' | 'push' | 'queued' | 'guarded'

/**
 * What a touch-down on a filled, enabled button answers with the switch on. Pure.
 * leftMs: max(cooldown left, heat left), unrounded (b.leftAtDown). sinceFireMs: now - the button's last successful fire.
 * queued: a queue is already pending on this button.
 * INV: ready -> 'cast' (the guard never touches a ready press: a live anchor's second press stays a press).
 * INV: no answer is a no-op without a visible and audible reply (§2.4).
 */
export function tapAnswer(t: { ready: boolean; leftMs: number; sinceFireMs: number; queued: boolean }): TapAnswer {
  if (t.ready) return 'cast'
  if (t.queued || t.sinceFireMs < TAP.guardMs) return 'guarded'
  return t.leftMs <= TAP.queueMs ? 'queued' : 'push'
}
```

Boundaries:
- left 300 queues, 300.01 pushes;
- since-fire 249.99 is guarded, 250 is not.

The shortest cooldown in `abilities.ts` is 1200 ms, so a guarded touch always has more than 950 ms left: the guard and the
queue never overlap for a real part.

### 2.2 The press (`src/hud.ts`, P1)

**`ButtonState` (`hud.ts:59`), new fields:**
- `firedAt: number`: game ms of the last *successful* `fire()`, both modes (`-Infinity` at start). Set in `fire()` after the refused return.
- `answer: TapAnswer | 'refused' | null`: this press's on-mode result, set at down, read at up.
- `queueBy: number`: a pending queue's deadline (`downAt + leftAtDown + TAP.queueSlackMs`).
- `pressed` gains `'answered'`, set at down on-mode, so today's hold branch (`pressed === null`, `hud.ts:627`) and buffer
  branch (`'buffered'`, `:622`) can never run for an on-mode press.
- Reuse `queued` for the pending queue.

**`Hud` (`hud.ts:93`), new members:**
- `tapPush: boolean` (get/set). The setter first drops every pending queue (`dropQueue`, below), then sets the flag.
- `onAnswer(cb: (a: { slot: SlotName; kind: 'push' | 'queued' | 'guarded' | 'queueDropped'; leftMs: number }) => void)`.
  It is called synchronously at down for push / queued / guarded, and wherever a queue drops. It is never called with the switch off.
- DEV only, `devCool(slot, ms)`: `b.readyAt = state.clock + ms` (a cooling state for checks).
- `Press` (`hud.ts:57`): `result` gains `'queued' | 'guarded'`. The new fields are `at: number` (game ms at down, rounded),
  `nbMs?: number`, `nbSlot?: SlotName` and `tp?: true`.

**pointerdown (`hud.ts:498`).**
- Today's first lines run as they are, through `b.el.classList.add('press')`.
- **Neighbour (both modes):** the hud keeps `lastDown = { slot, wall }` for the last down on any filled button. If `lastDown.slot !== b.slot` and
  `e.timeStamp - lastDown.wall < TAP.nbLogMs`, the press carries `nbMs` (rounded) and `nbSlot`. Then `lastDown` is updated.
- **Off:** today's two lines (`:511-512`), unchanged. Return.
- **On**, and `!b.def || !state.enabled`: do as today (the fire refuses quietly), `answer = null`. Nothing is logged.
- **On:** `a = tapAnswer({ ready: b.readyAtDown, leftMs: b.leftAtDown, sinceFireMs: state.clock - b.firedAt, queued: b.queued })`,
  `b.pressed = 'answered'`, then:
  - `cast`: `b.answer = fire(b, false) ? 'cast' : 'refused'`.
  - `push`: `b.answer = fire(b, true) ? 'push' : 'refused'`. On a push, kick the rim (§2.4) and emit `push`.
  - `queued`: `b.queued = true`, `b.queueBy = …`, `b.answer = 'queued'`. Show the ring full now (§2.4), emit `queued`.
  - `guarded`: `b.answer = 'guarded'`, `guardTap(b)` (§2.4), emit `guarded`.

**pointerup / pointercancel (`hud.ts:514`).**
- On, with `b.answer !== null`: the result is `b.answer`. No `deadTap`, no fire.
- Otherwise, today's code, unchanged.
- Logged the same way (`hud.ts:532`), with the new fields and `tp: true` when the answer came from the on path.

**update (`hud.ts:593`), per button.**
- **On, a queue:** `if (b.queued) { if (ready) { b.queued = false; if (!fire(b, false)) drop('refused') } else if (now > b.queueBy) drop() }`.
  This runs before today's buffered branch (`:622`), which is wrapped in `if (!state.tapPush)`.
- **The ring:** on, `arm = b.queued ? 360 : <the arc pull-back, as today's else-branch>`. Toggle class `queued` with `b.queued`.
  Off: today's lines.
- **The honest price, on only:** `near = !ready && left <= TAP.queueMs`, where `left = max(readyAt, hotUntil) - now`. Toggle class `near`.
  A near button is free to touch, so `cost` (`:615`) becomes `(ready || near ? 0 : 2) + strain` and `.btn.near .pips .owed` hides.
  Off: `near` is false and nothing changes.

**`dropQueue(b, why)`.**
- Does something only on-mode with `b.queued`: clears it, clears the ring, emits `queueDropped`.
- Called from `heat()` (`:859`), `equip()` (`:667`), `resetLoadout()` (`:683`), `startCooldown()` (`:808`),
  `set enabled(false)` (`:584`, the pause and the endings), and the `tapPush` setter.
- `ready(slot)` (`:874`, a rider) does **not** drop a queue: the queue fires on the next update, free.

**Captions (on only, PLACEHOLDER).** The hint ids are unchanged, so each caption shows once per save in either mode.
- `HEAT_CAPTION` reads `'hot · tap to push'`.
- `BREAK_CAPTION` reads `'tap · break it'`.
- `PAY_CAPTION` reads `'tap · pay it'`.
- `DEAD_CAPTION` can't show: no touch is dead when the switch is on.

### 2.3 The switch and the log (`src/main.ts`, P0)

**The switch.**
- Built like "weight" (`main.ts:2388-2416`), and registered right after it: `pause.setSwitch('tap push', …)`.
- `hud.tapPush = tapPushOn` at boot.
- The write: `if (run.phase === 'crawl' && hud.tapPush !== on) <open depth>.tapPushMixed = true`. Then always `hud.tapPush = on`, then persist.
- `__tapPush(on?)` (DEV) sets `hud.tapPush` and returns it.

**Counting, in `hud.onAnswer`** (new, beside `hud.onPress`, `main.ts:3791`). It acts only when `run.phase === 'crawl'`, on the open depth:
- `push`: `tapPushes++`. `pushes` is still counted in `onFire` (`:3783`), and strain is charged there, unchanged (`:3786`).
- `queued`: `queued++`, then `sfx.queued(0.35)`.
- `guarded`: `guarded++`, then `sfx.deadTap(0.35)`.
- `queueDropped`: `queueDropped++`.

`onPress` keeps today's `'dead'` branch. Off it is the only branch that fires.

**`DepthStats` (`main.ts:1614`)**, always logged, on or off. Set in the stats push at `main.ts:3105`.
```ts
/**
 * The "tap push" trial (design/lean/TAP-PUSH.md; PLACEHOLDER words). `tapPush`: hud.tapPush at entry. `tapPushMixed`: flipped
 * during this depth (leave it out when judging). `tapPushes`: pushes a touch made with the switch on (<= pushes; 0 off).
 * `queued` / `guarded`: touches that answered so (0 off). `queueDropped`: queues that never fired (heat, a swap, the pause,
 * the switch flipped, refused; 0 off), so free queued casts = queued - queueDropped. `strainAtBoss`: run.strain on the first
 * tick this depth's boss was awake (absent on a depth without one). Strain at a boss is now logged with the switch on or off.
 */
tapPush: boolean; tapPushMixed?: true; tapPushes: number; queued: number; queueDropped: number; guarded: number; strainAtBoss?: number
```
- `strainAtBoss` is set in `simulate()`'s boss block (`main.ts:4324`): `if (awakeBoss && st && st.strainAtBoss === undefined) st.strainAtBoss = run.strain`.
  It isn't logged today: `strainIn` is the strain at level entry, not at the wake.

**`TapLog` (`main.ts:1692`)** gains `at`, `nbMs?`, `nbSlot?`, `tp?` from `Press`. `result` widens with `Press['result']`.

**DEV hooks** (inside `if (import.meta.env.DEV)`):
- `__tapPush(on?)`;
- `__cool(slot, ms)` (`hud.devCool`);
- `__tapAnswer(input)` (`tapAnswer`);
- `__clockHold(on?)`. While it is on, `frame()` stops advancing `clock` (`main.ts:~4805`, `if (!paused && !clockHeld)`): only
  `__step` / `__until` move the HUD clock. Real presses then meet exact cooldowns. `let clockHeld = false`, set only by the hook.

### 2.4 The answers, on screen and in the ear (P1)

| answer | at once, in the handler | after |
|---|---|---|
| cast | the cast, `press` scale, 12 ms buzz (today) | today |
| push | the cast, the push signature (embers, the grind, `[14,26,14]`), strain pips flying from the button (today's `addStrain`), **and** class `kick`: a 220 ms ember flash on the rim | none: no ring, no hold |
| queued | classes `arming queued`, `--arm: 360deg` (a full **cold** ring), `sfx.queued` | the ring holds until the fire, then fades whole (`.15s`, today's transition); the fire's 12 ms buzz |
| guarded | `guardTap`: `b.arc = { from: 120, at: now, hold: 0 }`, `--arm: 120deg`, `arming`; `sfx.deadTap` (today's dry latch) | the arc pulls back over `DEAD_BACK_MS` (90 ms), as a dead tap's does |

- On a pending queue, a guarded touch keeps the full cold ring (no arc) and plays only the click.
- No caption on a guarded touch.

**CSS (`src/style.css`, after `.btn.arming .arm`, `:177`).**
```css
/* tap push: a queued press, taken: the ring full and cold (it costs nothing) until it fires */
.btn.queued .arm { background: <the .arm noise url>, conic-gradient(#8fb8e8 var(--arm, 0deg), #0e1a2a 0deg); filter: drop-shadow(0 0 3px rgba(143, 184, 232, .6)); }
/* tap push: the push, the instant it fires: the price on the rim */
.btn.kick { animation: kick .22s ease-out; }
@keyframes kick { 0% { border-color: var(--strain); box-shadow: 0 0 0 3px rgba(200, 69, 47, .75), 0 0 22px rgba(200, 69, 47, .5); } }
.btn.near .pips .owed { display: none; }
```

**Sound (`src/audio.ts`).**
- New `queued(pan)`: a soft, cold, short tick, distinct from `deadTap`'s latch (a triangle around 1.4 kHz, ~25 ms, quiet,
  `limited` like `deadTap`). It calls `heard('queued')`.
- Add `heard('deadTap')` to `deadTap` (`audio.ts:1612`). It is DEV-only logging, so off-play is unchanged.
- Unheard until the phone.

### 2.5 `tools/checks/lib.mjs` (P0)

`TAP=1` adds `localStorage.setItem('still-action.tapPush', '1')` to the init script, beside `WEIGHT=1`. Both can be set.
It is report only. By design `TAP=1 autos.mjs` K-A7 differs (its cooling tap answers 'push', not 'dead').

### 2.6 With "weight"

No code couples them.
- A queued fire and a ready press are both `fire(b, false)`, so with weight on they carry the push's full effect for free (`main.ts`
  `cast()` `full`).
- A tap push is the real push: signature and +2.
- On both, a push differs from a free cast only by time, the signature and the price, which is PITCHES' "the push buys time".
- K-P11 runs the four combinations.

---

## 3. Steps

**The regression set.** Each step ends with all of it, in order:
- `npx tsc --noEmit -p .` and `npx vite build` clean;
- `node tools/checks/baseline.mjs compare` → K-90, K-90L PASS;
- `node tools/checks/fights.mjs compare` → K-90F PASS;
- `node tools/checks/autos.mjs` → all PASS (K-A7 is registered twice, `:167` and `:271`; it prints one line);
- `k9.mjs`, `area3.mjs`, `home.mjs`, `stagec.mjs`, `screens.mjs` → as P0 recorded;
- `stageb.mjs` → as P0 recorded (K-W3d, the known Parry finding, fails; skip the slow K-T13 until P2);
- `lean.mjs` with every id but K-L1 → as P0 recorded (K-L1's children are already in this set);
- the step's own `node tools/checks/tap.mjs <ids>`.

Each check a step adds is negative-tested once (the break is named per check in §4): break its rule, see it FAIL, restore,
and report it. Each step reports every file it touched and every check line, verbatim.

### P0. The switch, the log, the answer function, the record
- **First, on the clean tree:** run every suite, then record the PASS/FAIL ids and the `dist/` bytes. These are K-P1's `RECORD`.
- `tools/checks/tap.mjs` on `suite()`, modelled on lean.mjs:
  - `RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'`;
  - a SETUP: the arena; the four starting parts (lens, vent, cleaver, kickstart; assert none has `def.strain`); loop held;
    `__clockHold(true)`; autos off; `__tapPush(on)`; `navigator.vibrate` recorded; `__heard.length = 0`; `__run.taps.length = 0`;
  - helpers `touch(slot, holdS = 0)`, a real `page.mouse` down on `.btn:has(.lbl[aria-label="H|T|A|L"])`. Between down and up it
    runs an evaluate that reads the answer (no step, no wait). Then `__step(holdS)` if asked, then the up.
- §2.1, §2.3 entire, §2.5, and `hud.tapPush`, `devCool`, `Press`'s new fields and the neighbour log from §2.2.
- The gesture is not wired yet: on still behaves as off.

**Done when:** the regression set passes; K-P1, K-P2, K-P3 PASS, and K-P9's P0 part PASS; `screens.mjs` K-S1 PASS with the new row; the record is reported.

### P1. The gesture and its answers
- §2.2 entire (pointerdown, pointerup, update, `dropQueue`, `near`), §2.4 entire (classes, CSS, sound), `onAnswer` counting (§2.3).

**Done when:** the regression set passes; K-P4, K-P5, K-P6, K-P8, K-P10, K-P13 PASS; K-P1 and K-P9 PASS again (now with the counters).
The lead gets screenshots T2-T5 (§5).

### P2. Words, weight, the sweep, the whole
- §2.2's captions.
- K-P7, K-P11, K-P12.
- Every suite in full, with stageb's K-T13.
- `TAP=1` report runs: `fights.mjs compare` (must PASS: it drives `__fire` only), `autos.mjs` (K-A7 the expected diff),
  `lean.mjs` without K-L1, and `TAP=1 WEIGHT=1 lean.mjs` without K-L1. Paste every line.
- `dist/` bytes against P0's.
- Every screenshot in §5.

**Done when:** K-P1 through K-P13 PASS. The lead has a table (check → result → one line), the TAP=1 lines with each
difference explained, and every screenshot with the engineer's one honest line on what reads and what doesn't.

**Check assignment** (each id belongs to exactly one introducing step):

| step | checks |
|---|---|
| P0 | K-P1, K-P2, K-P3, K-P9 (shape, neighbour, strainAtBoss) |
| P1 | K-P4, K-P5, K-P6, K-P8, K-P10, K-P13; K-P9 counters |
| P2 | K-P7, K-P11, K-P12 |

---

## 4. Acceptance checks (`tools/checks/tap.mjs`)

**Setup for every check unless stated:**
- P0's SETUP;
- every press a real mouse press through the HUD (never `__fire`, except as the control in K-P13);
- `__clockHold(true)`, so the HUD clock moves only by `__step`;
- the answer read in an evaluate between `mouse.down` and `mouse.up`, with no step between;
- strain read as `__run.strain`, counters off `__runStats().at(-1)`, the tap off `__taps().at(-1)`.

- **K-P1 off is today** (a `task` and a page part).
  - Task: spawn `fights.mjs compare`, `autos.mjs`, `lean.mjs <every id but K-L1>`, `stageb.mjs`, `k9.mjs` and `screens.mjs`. Each must print P0's record.
  - Page (a): a fresh context has `localStorage['still-action.tapPush']` unset, `__tapPush()` false, and the open depth `tapPush: false`.
  - Page (b), switch off, the hold path by real presses:
    - a cooling Cleaver (`__cool('arms', 2000)`), down, `__step(0.1)`: strain unchanged;
    - `__step(0.1)` more (200 >= 180): strain +2;
    - up: 'push', with no second push on a further `__step(0.3)` held;
    - a 0.06 s press on a cooling button: 'dead', `deadTaps +1`, strain unchanged;
    - `__cool('arms', 100)`, down, `__step(0.12)`, up: 'cast', strain unchanged, the cooldown restarted (`readyIn ≈ cooldownMs`);
    - a ready press: 'cast' at down.
  - *Negative:* `PUSH_HOLD_MS = 100` makes (b)'s first read FAIL.
- **K-P2 the switch.**
  - The loadout pause screen shows a row labelled `tap push`. One real click turns it on, and storage becomes `'1'`.
  - `__hud.tapPush` is true at once.
  - Flipped mid-crawl, the open depth logs `tapPushMixed: true`.
  - `__enter(depth + 1)`: `tapPush: true` and no `tapPushMixed`.
  - Off then on in the same depth: one `tapPushMixed`, no throw.
  - Flipped outside a crawl: no `tapPushMixed`.
- **K-P3 the answer table** (`__tapAnswer`).
  - ready, any left, any since-fire, queued → 'cast';
  - left 300 → 'queued'; 300.01 → 'push'; 0.5 → 'queued';
  - since-fire 249.99 → 'guarded'; 250 with left 2000 → 'push';
  - queued true, left 100 → 'guarded'.
  - *Negative:* `queueMs` 299; the guard as `<=`.
- **K-P4 push by a real touch** (on).
  - `__cool('arms', 2000)`, then a touch. Between down and up:
    - strain +2 exactly;
    - `pushes +1`, `tapPushes +1`;
    - `readyIn('arms') ≈ cooldownMs` (±17 ms);
    - vib `[14,26,14]`;
    - class `kick`.
  - Then `__step(0.5)` held: strain still +2. Up: tap `{ result: 'push', leftMs: 2000, tp: true }`.
  - A hot button (cooldown done, `__hud.heat('arms', 2000)`) pushes the same way (+2).
  - *Negative:* the push fired on pointerup instead of down.
- **K-P5 the queue fires free** (on).
  - `__cool('arms', 300)`, then a touch. Between down and up:
    - strain unchanged, `readyIn ≤ 300` (nothing fired);
    - classes `arming queued`, `--arm` `360deg`;
    - `__heard` has `queued`;
    - `queued +1`.
  - Up (released early), then `__step(0.3)`:
    - it fired once: `readyIn ≈ cooldownMs`, vib 12, `pushes +0`;
    - strain unchanged, `queued` class gone.
  - Tap `{ result: 'queued', leftMs: 300 }`.
  - The same with the mouse held through the ready: one fire, and the up does nothing.
  - Honest price: at left 300 the button has `near` and `.owed` is hidden; at left 301 neither.
  - *Negative:* the queue fires `pushed = true` (strain +2).
- **K-P6 the mash guard** (on).
  - A ready Cleaver touched: 'cast'.
  - `__step(0.2)`, a touch: 'guarded' (`arming`, `--arm` `120deg`, `__heard` `deadTap`), with strain, `pushes` and `readyIn` unchanged, and `guarded +1`.
  - `__step(0.05)` (250 since the fire), a touch: 'push', +2.
  - A pending queue touched again: 'guarded', the ring stays `360deg`, and it fires once.
  - *Negative:* the guard removed (the second touch pushes).
- **K-P7 no touch is silent** (P2, on). 24 scripted real touches across the four buttons. The states are set by `__cool` / `__step` / `heat` / a
  refused phase, with at least 3 of each answer.
  - For every touch, between down and up, the DOM shows its answer:
    - cast: `readyIn > 0` and a new vib 12;
    - push: `kick`;
    - queued: `queued`;
    - guarded: `arming` at `120deg` (or `360deg` on a pending queue);
    - refused: `refused`.
  - Every logged result is in {cast, push, queued, guarded, refused}, `deadTaps` stays 0, and the counters sum to the taps they count.
  - *Negative:* `guardTap` doesn't draw the arc.
- **K-P8 strain exactly +2 a push** (on).
  - Over K-P5 and K-P6's sequences, plus 6 more pushes on lens / vent / kickstart:
    `Δstrain === 2 × (taps with result 'push')`, and `quiets` unchanged.
  - Strain 18, a tap push: strain 20 and the phase is 'stopping' (the push lands, then he stops, as today).
  - Task part: `src/main.ts` still has `const STRAIN_PER_PUSH = 2`, `const STRAIN_MAX = 20`, `const QUIET_STRAIN = 2`.
  - *Negative:* the on-path push fires twice.
- **K-P9 the log.**
  - P0, on and off:
    - a fresh depth has `tapPush`, and `tapPushes`, `queued`, `queueDropped`, `guarded` all 0;
    - every tap has `at`;
    - arms then torso with a ~80 ms wall gap: torso's tap has `nbSlot 'arms'` and `nbMs` in 40..250;
    - a 1100 ms gap, or the same slot twice: no `nbMs`.
  - P0, strainAtBoss:
    - `__enter(3)`, strain 7, the boss woken and stepped: `strainAtBoss === 7`;
    - strain 9, stepped: still 7;
    - `__enter(2)`: no key.
  - P1, on: one push, one queued and one guarded give `tapPushes 1, queued 1, guarded 1, pushes 1`, with each tap `tp: true`.
    Off, the same touches log 'push' (held 0.2 s) / 'dead' / 'dead' with every new counter 0 and no `tp`.
- **K-P10 the queue's edges** (on). Each starts from a fresh queue at left 200.
  - (a) `heat('arms', 2000)`: no fire by the old ready time or after `__step(0.5)`, `queueDropped +1`, the ring gone.
  - (b) `__equip` another arms part: dropped.
  - (c) the pause opened (`hud.enabled = false`), `__step(0.4)`, resumed: dropped, no cast.
  - (d) the switch flipped off: dropped.
  - (e) `__hud.ready('arms', 'cold')`: it fires on the next step, free.
  - (f) heat 200 on a cooled button: 'queued', fires free when the heat ends.
  - *Negative:* `heat()` without `dropQueue`.
- **K-P11 with weight** (P2). A crowned hulk winding up 2 u ahead (lean.mjs K-L4(a)'s setup), all four switch pairs:
  - a queued Cleaver with weight on: breaks it, `breaksBy.ready +1`, pushSig 0, vib 12, strain +0;
  - a queued Cleaver with weight off: no break;
  - a tap push (both weights): breaks it, `breaksBy.pushed +1`, pushSig 1, `[14,26,14]`, +2.
- **K-P12 the words** (P2). Each mode on a fresh page (a second query, e.g. `RUN + '&p12=1'`; confirm the game ignores it).
  - On: `breakHint`, `heat`, and a lit `stateCue` on a cooling button caption 'tap · break it', 'hot · tap to push', 'tap · pay it'.
  - Off: today's three.
  - On, no touch ever shows `DEAD_CAPTION`.
- **K-P13 the DEV path is the gesture's after** (P1). On and off:
  - `__fire('arms')` on a cooling button does nothing;
  - `__fire('arms', true)` pushes, +2;
  - `__fire` on a ready button casts;
  - the on and off results are identical.
  - So suites that drive `__fire` can't see the switch.
  - *Negative:* `fireSlot` reads `tapPush`.

---

## 5. What the engineer must screenshot and look at

- **Setup:**
  - viewport 915 × 412 (the Poco F8 Pro in landscape), `deviceScaleFactor` 2.6;
  - the game camera at fight zoom;
  - `__clockHold(true)`;
  - PNGs outside the repo.
- **Taking each shot:**
  - Take each shot between `mouse.down` and `mouse.up`.
  - Before the shot, run `document.getAnimations().forEach((a) => a.pause())`, so a 220 ms flash is caught at its peak.
  - Each shot is a full frame plus a 2x crop of the button arc.
  - Write one honest line per shot on what reads at phone size and what doesn't.

| id | what | look for |
|---|---|---|
| T1 | a cooling button (left 2000) and a near one (left 250), on vs off | the price pips: ember on the cooling one, gone on the near one when on; off identical to today |
| T2 | push: the down frame, and +100 ms (animations resumed) | the ember kick on the rim, pips leaving the button, embers on Still; does it read as "paid" |
| T3 | queued: the down frame, held, and the frame after the fire | the full cold ring reads as "taken, coming", not as a push; it fades whole on the fire |
| T4 | guarded: the down frame, and +50 ms | the arc is small and pulls back: "already done", not "almost a push" |
| T5 | a hot button tapped (heat 2000), and one with heat 200 | push vs queued over the heat rim: both readable through the ember heat ring |
| T6 | weight on: a ready cast, a queued cast and a tap push, the frame after each | the push still has its own look (kick + embers) when every cast is big |
| T7 | the pause screen with the new row, at 915 × 412 and 667 × 320 | the row fits; resume is reachable (screens.mjs proves the reach) |
| T8 | strain 18, a cooling button: its `last` pulse, then the tap push and the stop beginning | the brink is still seen before it's crossed |
| T9 | the break caption, on | 'tap · break it' fits over the button at the screen edge |

Sound (the tick, the click), haptics and how a tap *feels* can't be judged headless. They go on the phone list (§7).

---

## 6. Risks

- **R1. Stopped comes closer.** That is his call (strain untouched).
  - Sim: pushes a fight rise from 0.48 to 0.61-0.75. With that, the median is Stopped by d3 in 16-24% of runs, against 5% today.
  - Watch `strainAtBoss` and pushes a fight. The parked retune is in PITCHES (cap 24 + a free first push).
  - The `last` pulse and the brink outline stay as they are (T8).
- **R2. The hold was the accidental-push guard.**
  - A stray thumb on a cooling button now costs 2.
  - The log answers it. Pushes with `nbMs < 40` are neighbour rolls; pushes with a tiny `ms` and no follow-up are possible strays.
  - If they show up, the dropped 40 ms neighbour guard is the fix: one more `tapAnswer` input.
- **R3. Lead's change (1 Oct): the guard rolls.** It counts from the later of the button's last fire and its last touch, so a
  sustained mash (4 taps at 120 ms: push, guarded, guarded, guarded) pays once (+2), never twice. `tapAnswer` takes `sinceTouchMs`
  beside `sinceFireMs` and guards when either is < 250 (a ready press is never guarded, as before). Every check line that asserts the
  guard must cover both: since-touch 249.99 guarded / 250 not, and the 4-tap mash = +2 exactly. Where a check steps 250 ms after a fire
  and expects 'push', make sure no touch fell inside that window (or assert 'guarded' if one did). A pause between taps of 250 ms or more
  pushes again, deliberately.
- **R4. A queued cast fires up to 300 ms after the touch,** aimed at the world as it is then (threat aim at fire time).
  This is intended: the round's reason for 300 over 400.
- **R5. Captions are once per save.** His save has likely seen all three hold captions, so he'll see none of the tap ones.
  He knows the rule. A fresh save shows them.
- **R6. Headless presses are a mouse,** one pointer, `pointerType 'mouse'`.
  - Thumb-on-stick plus thumb-on-button multi-touch isn't exercised. The handler is per-pointer (`pointerId` capture) as today.
  - Goes on the phone list.
- **R7. Off must be today.**
  - Before this, no suite drove the hold path with real presses (K-A7 covers only the dead tap). K-P1(b) pins it now.
  - The off branches are today's lines, untouched, and `firedAt` / the neighbour log are writes that nothing off-mode reads.

---

## 7. Where this brief departs from the round's docs

- **The queue covers heat.** Today's buffer refuses hot buttons (`hud.ts:512`). On, `leftMs` is max(cooldown, heat), so a tap in
  a heat's last 300 ms queues free: "waiting frees it" (`hud.ts:181` INV). A heat landing on a queued button drops the queue.
- **A touch on a pending queue is 'guarded'**, so a mash during the queue window never stacks.
- **New `strainAtBoss`.** The round asked for strain on entering each boss "if not already logged". It wasn't: `strainIn` is the
  strain at level entry.

**Decided here** (the lead or Adrian may overturn):
- The queued ring is cold (free), not ember.
- A push gets a 220 ms ember kick on the rim, since there's no ring.
- A near button (<= 300 ms left) hides its owed pips and isn't counted as brink.
- `queueSlackMs` 50.
- The neighbour log window is 1000 ms.
- `at` is added per tap.
- The guard rolls: last fire or last touch (R3, lead's change).
- A queue drops on pause, swap, heat, a flip and refusal. It does not drop on a rider's ready.

**For the phone (his):**
- does a tap on a cooling button feel like an intentional push, every time;
- any accidental pushes (and was it a neighbour roll);
- does the cold ring read as "taken", and is the tick audible;
- a mash: does guarded feel like the game ignoring him;
- does he miss the hold.

Log lines to judge by:
- `deadTaps` 0 by construction, so read `guarded` (it should be rare outside mashes);
- pushes a fight 0.5-0.75, with `tapPushes` the gesture's share;
- `queued` and `queued - queueDropped` (free casts the queue gave);
- `strainAtBoss` per boss;
- Stopped;
- neighbour pushes (`result 'push'` with `nbMs < 40`);
- leave out the depths with `tapPushMixed`.
