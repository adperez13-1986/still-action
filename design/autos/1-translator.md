# Autos, round 1: translator (thumbs, feel, references)

## 1. Verdict: partly agree

He is right that it feels passive, and right that the planted shot is Archero's rule. I think he is wrong
that the cure is taking the floor away or adding a pressed basic. **Strongest reason:** the passive feeling
comes from *who owns the verbs*, not from damage landing on its own. Right now the autos do 67% of the
damage, pick the targets, and **break heavies' windups for free** (the hand and the eye both break). The
best moment in an action game, cutting a big swing short, happens to him instead of being done by him. A
pressed basic on a phone does not fix that, because on a phone a pressed basic turns into a held basic
(below), and a held basic is an auto that costs a thumb.

## How the references actually play on a phone

| game | right thumb | what "active" really is | confidence |
|---|---|---|---|
| Vampire Survivors | nothing; drag anywhere to move | pathing and level-up picks. No combat input at all | high |
| Archero | nothing; lift the finger and you fire | the stop/go rhythm: stand to shoot, move to dodge. **The planted shot is this, brace and all** | high |
| Diablo Immortal | big primary button in the corner, skills ringed around it | skill timing. The primary gets **held** almost all the time, auto-targeted, as a thumb rest; you slide off it to a skill and back | fairly high |
| Soul Knight | fire button (auto-aims at the nearest), skill, swap | weapon choice and energy. Fire is held too; what makes it a decision is **energy per shot**, not the press | fairly high |
| Hades | a pad game; I have not played the touch port and can't say how it holds up on glass | committing to a swing (the combo finisher roots you, a dash cancels it) and **four verbs that are each the build** | high on pad, unsure on phone |

Two lessons carry over. From Diablo Immortal and Soul Knight: a fifth button doesn't add activity, it
moves the auto under the thumb. From Hades: the verbs *are* the build, and Still already has Hades's four
(arms = Attack, head = Special, torso = Cast, legs = Dash). Hades's Attack has no cooldown and Still's arms
slot has a 2.6 s one. So the "more active" he wants already lives in the four slots. It is crowded out.

## 2. What "active" should mean here

Active means **every button press is a decision with a price his thumb chooses**, and the damage peaks
come from those presses. Still already puts a price on commitment (a push costs +2 strain against a 20
limit), and a crowd of pressure bodies leaves no room to stand around. So the fix is not to press more
often (he already does about 59 presses a minute). It is that pressing becomes where the damage and the
turns in a fight come from: breaks, finishing kills, clearing space. Movement should decide where the
floor damage goes, and the buttons should decide when it spikes.

## 3. Proposal: "the floor stays, the verbs leave it"

1. **The planted shot stops being an auto.** Planting still aims the head parts at leaders and shooters
   (`eyeCast`) and keeps the brace, so standing still stays a real stance. It just stops being a turret.
   This cuts out exactly the Archero part he dislikes.
2. **The close strike stays as the floor, but lighter.** 5 damage, never breaks a windup. Breaks belong
   to parts and pushes.
3. **Earned follow-through (D).** For the two close strikes after any part lands, the strike does x2
   with a brighter cold sweep and a heavier sound. The floor exists, but the peaks are his.
4. **Heading aims it (E, and it costs no thumb).** While the stick is live, the close strike hits the
   body closest to his heading within reach, not simply the nearest. Standing still, it falls back to the
   nearest. This is not magnetism: Still never lunges or moves.
5. **No fifth button.** The hollow inside the arc (about 100 px from the arc's centre to the inner button
   edge) would fit a 72 px button in the Diablo Immortal spot. But that spot is where the thumb rests, so
   the button would be held by default, and every part press would become a release.
6. **Arms becomes the Attack slot.** Arms white cooldowns come down toward 1.2-1.6 s (numbers are the
   balancer's), so there is always a verb about a beat away.

| settled thing it breaks | cost |
|---|---|
| "never dead time" | reworded: the floor is still there, just smaller. Walking up to a sentinel pack at 8 u does nothing until a head part fires |
| Mastery on the eye (Marking Shot, eye-split) | needs a new host: the head parts while planted. Content work |
| Riders on a hand or eye break | the trigger moves to a part break. Every rider line has to be reread |
| Leanings ("which auto a part teaches") | halved: only the strike is left to teach |
| Pressure crowds, CURVE / CURVE9 | the free floor falls from 8-10 to about 5. The balancer has to sim time-to-kill before the phone trial |
| Parry | **helped**: breaks are now scarce, so Parry's break becomes its job |

**Thumb risk I'm not sure about:** shorter arms cooldowns invite mashing, and a mash that lasts 180 ms
or more on a cooling button (`PUSH_HOLD_MS`) turns into a push by accident, costing +2 strain. The log
already records how long taps last. Check it before shortening cooldowns.

## 4. Smallest phone trial

A **pause switch "earned strike"** (PLACEHOLDER words, his to write), kept per device, takes effect
from the next depth, like `counters`. On: `combat.eye = false` for the lance only (the stance's aiming
and brace stay; this needs a split of that flag), the close strike does 5 and can't break, and gets x2 for
two strikes after a part hit. Heading-aim waits for a second pass. Off: today's game exactly.

**What he should notice in one run:** whether his eyes go to the buttons rather than Still's feet;
whether he taps arms on the beat after a head bolt; whether a sentinel pack at range becomes "go get them
or spend the head" instead of "stand still".

| log field | today | what the trial should show |
|---|---|---|
| `autoDmg` vs `partDmg` share | 67% autos | 30-40% autos |
| `handBreaks` / `eyeBreaks` | nonzero | 0 by design; part breaks go up |
| `pushes` per fight | baseline | flat or up. **If they jump, check tap ms for accidental pushes** |
| `hpLost` per depth | baseline | up a little is fine; a jump means the floor was holding the curve up |
| `plantedS` / `playS` | baseline | down: standing still is now a choice, not the plan |

Open for playtest: does x2 read without a glyph on the arms button; does heading-aim feel like steering or a miss.
