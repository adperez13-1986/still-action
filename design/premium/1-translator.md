# What a paying player would feel is missing: the translator's lens

Lens: feel and experience. Controls, teaching, the 6-inch screen, juice, audio,
art, menus, accessibility, and the emotional arc of a run and of the first hour.
Read from the docs, the code (`hud.ts`, `pause.ts`, `grade.ts`, `ending.ts`,
`workshop.ts`, `audio.ts`) and yesterday's `playtest.json` (2 runs, 224 casts).

## 1. Already premium-grade

- **The look holds together.** One warm light, cold everything else, ember only
  for threats, a metal per enemy body. KayKit, photo textures, Still built from
  primitives and the crayon shader all sit under one grade. It reads like one
  artist made it, which cheap asset-kit games usually don't manage.
- **Telegraph discipline.** Every threat winds up, the tell closest to landing
  draws on top, committed locks are kept 300 ms apart, and the wind-up tone is
  panned and cuts at the strike. That's a crowd-readability rulebook, and most
  indie action games never write one.
- **Still wears what he finds.** Every part has a model on his body, on the floor
  and on the wall, and an empty slot shows the bare frame. You can see him start
  incomplete.
- **The endings and the room.** Three arrivals (put back together on the bench,
  the eye coming back on, walking in the door), crayon redraws of the last frame,
  a strain line on every card, a doorframe that grows in calendar time. That
  emotional layer is the rarest thing here, and it's already built.
- **Phone manners.** Offline PWA, fullscreen landscape, pauses when the screen
  goes off, a 1.2 s guard so a thumb still pressing from the fight can't skip
  the ending words.

## 2. The gaps, ranked

**1. Casts fire when you let go.** `hud.ts` casts a ready button on
`pointerup`. Yesterday: median press 533 ms, and 96 of 218 ready casts were held
more than 1 s. So half your casts land half a second or more after your thumb
lands. Holding probably goes long *because* nothing answers the touch, so the
thumb waits for something to happen. Legs got 18 casts in 48 fights: a dash that
leaves 0.5 s late can't dodge anything, which may be part of why walking answers
every threat.
- *Fixed when:* a ready button fires on `pointerdown`. A cooling one still draws
  the 180 ms ring and pushes as it closes. A press that lands up to about 120 ms
  before the button is ready fires the moment it is (an input buffer). Log
  touch-to-effect in place of press length, and aim for under 1 frame.
- *Cost:* cheap (an evening, mostly re-checking the dead tap and ring). It
  retires the unbuilt "hold aims", which settles "hold means two things".

**2. The words are placeholders.** A paying player would see "Still came home. /
[Adrian writes this line.]" on the Home ending. The captions ("hold to push"),
the boss phase lines, the ending button ("home") and most notebook pages are
drafts or blank. The game's emotional arc rests on about 40 lines of text.
- *Fixed when:* `grep PLACEHOLDER src/` returns nothing a player can reach.
- *Cost:* cheap in code, and it's the only item on this list no agent can do.

**3. There's no player settings screen, and the dev chips ship.**
`createGradePanel` runs in production, so players get "sound / full / grade" in
the corner, with the full grade and mix sliders one tap away. Pause shows the
loadout and the break-rule switch, and nothing else.
- *Fixed when:* the grade panel only exists under `import.meta.env.DEV`. Pause
  gets a settings page: master, music and effects volume, haptics on/off, shake
  scale, and a line saying the run is saved at the last beam. Don't add a
  "leave run" button: that would be the "Sit down" exit you ruled out.
- *Cost:* cheap to medium (1-2 evenings).

**4. The first minute has no frame, and strain is never named.** Run 1 drops
straight into the maze (`FIRST_RUN_IN_MAZE`) with no title, no name, no first
touch. The strain bar is the core mechanic, and nothing ever says what it is.
The first Workshop visit is where the game shows its heart, and nothing there
tells you the hook takes one part into the next run.
- *Fixed when:* a first-launch card with the name, one line in your words, and
  "touch to wake", which also unlocks audio cleanly. The first strain point gets
  a one-time label. The hook glows on the first night. A friend who has never
  seen it can explain strain and the hook after run 1, without you coaching.
- *Cost:* medium (2 evenings, plus the words).

**5. Accessibility.** Motion: no way to turn down the shake, the wake flashes or
Broken's slow-mo. Motor: pushing needs a 180 ms hold under a thumb that's
already busy. Offer "tap twice to push" as a setting (the second dead tap already
draws two thirds of the ring). Hands: no mirrored layout for left-handed
players. Colour is fine: ember against steel blue survives the common kinds of
colour blindness.
- *Fixed when:* the four toggles sit on the settings page from gap 3.
- *Cost:* medium (the mirrored layout is most of it).

**6. The strain bar is drawn smaller than anything else on screen.** 210 x 7 px at
the top edge, with 6 px pips. The HP bar sits bottom centre and the buttons
bottom right. The thing that decides the run is where your eyes aren't.
Captions are 12-13 px. That's fine to read on the Poco, but not at arm's length
on a bus.
- *Fixed when:* in a playtest you can say your strain mid-fight without pausing.
  Try a thicker bar, a notch at 16 that warms, and a low tick as it crosses.
- *Cost:* cheap.

**7. Juice left over.** Shot trails exist in `combat.ts`, but `combat.vfx` is
never set, so they never draw. Knockback is about 8% over. A kill has hitstop and
shake, but no distinct "last one down" beat before the quiet.
- *Fixed when:* those three are done and you don't notice any of them.
- *Cost:* cheap.

**8. The history can vanish.** Everything lives in `localStorage` and IndexedDB.
Nothing calls `navigator.storage.persist()`, so the browser may clear it under
storage pressure. Safari also wipes the data of sites you haven't installed after
about a week of not visiting. A deploy that can't read a run deletes it. For a
game whose reward is the corkboard and the doorframe, losing them is the one
thing a buyer won't forgive.
- *Fixed when:* `persist()` is requested on the first night. Settings gets
  export and import of the save (drawings included). Save versions migrate
  instead of discarding.
- *Cost:* cheap (`persist`) to medium (export, migrations, v3 for the Line).

**9. The score is one loop per area.** A generative D-minor loop, a boss tempo and
a drum line, one warm bell. It's good. Over 12 runs of 26 minutes it will wear
thin, and the three endings share one bed.
- *Fixed when:* each ending has its own short cue (Broken sudden, Stopped a long
  fade, Home the bell resolving at last), and each area or road has a second
  loop. Check the mix on the phone speaker and on headphones.
- *Cost:* medium.

**10. After the wall fills (about 12 runs, about 5 hours), the room stops
changing.** Only the doorframe (calendar time) and the corkboard (one card a run)
keep moving.
- *Fixed when:* something in the room still changes at run 20: notebook pages in
  your hand, the Line's road, the parked "doors, not upgrades". Not stronger,
  just still being noticed.
- *Cost:* medium to big (it's content, and it's mostly the balancer's list).

## 3. The one that matters most: casts on release

The spike's own question was *"do you want to press the button again?"* Every
feel item above sits on top of that press: hitstop, shake, the ring, the break
rule, the dash, even the strain data. Right now the press answers half a second
late, and for 44% of casts more than a second late. A buyer won't say "input
latency". They'll say it feels "floaty" or "mushy", and nothing else here can
cover for that. It's also the cheapest item on the list. Fix it before you read
another strain number, because the push, the dash and the break window were all
measured with a late thumb.
