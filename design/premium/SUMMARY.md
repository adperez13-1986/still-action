# What still-action lacks to be premium — summary

26 Sep 2026. Three voices, one round (`1-balancer.md`, `1-translator.md`,
`1-verifier.md`). A gap list, not a plan.

## Already premium-grade
The look holding together under one grade; the telegraph rules (committed, readable,
symmetric); the 30 parts, each saying what it gives up; Still wearing his parts; three
endings and the Workshop; a meta with no currency and no empty run; the offline PWA
(5.3 MB, content-hashed cache); a careful save format; clean licensing (CC0, OFL, synth).

## The gaps, ranked (where the voices agree first)
1. **Casts fire on release.** Ready buttons cast on `pointerup`; the playtest's median press
   is ~0.5 s, and 96 of ~218 casts were held over 1 s. Every cast is late, dashes can't dodge
   (18 dashes in 48 fights). Cheap: fire on press, keep the 180 ms hold for pushes, a short
   input buffer. It also taints every strain number so far. *(translator #1, verifier)*
2. **Saves are only as safe as the browser.** No `storage.persist()`; iPhone Safari clears
   site data after 7 days unvisited; no export/import (a new phone loses the corkboard and
   the doorframe); and a confirmed bug: if a migration throws, the fresh save overwrites the
   stored one (`save.ts` ~290, then the first write). Fix before `the-line` merges. Cheap to
   medium. *(verifier #1, translator)*
3. **The owner's words.** The Home ending says "[Adrian writes this line.]"; captions,
   boss lines, notebook pages are drafts or blank. Only he can close this. *(translator)*
4. **Strain resets every crawl level.** 6 of 8 crawl depths ended at 0; strain only rises in
   boss fights, so it's a per-boss budget, not the run's resource. Cheap rule: a quiet can't
   take strain below half of what you entered the depth with; Rest is the only way under.
   *(balancer #1)*
5. **A settings screen, and dev tools out of the live build.** The grade panel (25 sliders)
   and the playtest switch ship live; mute resets on reload; no shake/flash/haptics toggles,
   no quality setting, no left-handed layout. Medium. *(all three)*
6. **Content lifetime.** The wall of parts fills in ~6 runs (~2.6 h) vs the design's 10-12;
   one road, two bosses; nothing above the current difficulty and nothing gentler. Tuning
   the drop odds is cheap; the Line and an opt-in rule ladder (never HP/damage) are the
   big part. ~2.6 h of distinct play today, ~15-20 h with those. *(balancer #2-3)*
7. **The first hour.** No title or first touch, strain never explained, the hook in the
   Workshop never explained. *(translator)*
8. **Unmeasured below one phone.** Never profiled on a mid/low-end phone or an iPhone; full
   bloom every frame at 120 Hz even paused; no quality levels. *(verifier)*
9. **Smaller:** crashes freeze with no message; shot trails never wired; a 7 px strain bar;
   licence notices incomplete (three.js MIT, fonts); a slow Workshop memory creep; one-loop
   score; the room stops changing once the wall is full.
10. **Platform.** Touch only. itch.io is reachable with the fixes above; Steam is big
    (desktop input, controller menus, packaging).

## The one that matters most
Each voice named a different one: input (translator), saves (verifier), strain carry
(balancer). Order by what's cheap and what can't be undone: **input first** (it changes how
every fight feels and every number we measure), **saves second** (a lost save is the one
thing a player never forgives, and it's his kids' drawings), **strain carry third** (it
decides whether the core mechanic is the run's or only the bosses').
