# Premium gaps: the verifier (technical and product readiness)

Lens: what a paying player hits before the design does. Checked against `main` at 67 commits
(25 Sep), `dist/` from that build, and `public/`. Costs assume vibe coding with agents.

## 1. Already premium-grade

- **Offline PWA.** `vite.config.ts` writes every build file plus its content hash into `sw.js`;
  the page is network-first so deploys land, unchanged files are copied not refetched, and
  only this game's old caches are deleted on a shared origin. Better than most paid web games.
- **Download size.** 5.3 MB total, JS 1.15 MB raw / ~340 KB gzipped. Tiny for a 3D game.
- **Save code.** `src/save.ts` is versioned with lossless migrations, repairs any shape on load,
  never throws, falls back to memory in private windows, unions grow-only sets across tabs,
  refuses to overwrite a newer build's save, keeps the first corrupt copy, and writes on events.
  A run snapshot at every beam resumes a killed tab at the start of the depth.
- **GPU hygiene.** Pixel ratio capped at 1.5, no shadow maps, three lights in the whole game,
  KayKit's 16 atlas copies never uploaded (~90 MB GPU saved), resize debounced, context loss
  recovers instead of going blank. Fixed 60 Hz sim with interpolation and a frame clamp.
- **Pause and audio.** Screen-off pauses mid-fight; the AudioContext suspends with the page.
- **Licensing of content.** KayKit Dungeon Remastered, Kenney Impact Sounds and ambientCG are all
  CC0; fonts are OFL and self-hosted; music and most sound are synthesised in code. No
  commercial-use exposure anywhere.
- **Dev hooks.** The `window.__*` hooks, part/enemy logs and `savePlaytest` sit behind
  `import.meta.env.DEV` and drop out of the build; `lineup/look/parts.html` aren't built.

## 2. The gaps, ranked

**1. Saves are only as durable as the browser lets them be.** The code is careful; what's
around it isn't. (a) No `navigator.storage.persist()`: Chrome can evict under storage pressure,
and iPhone Safari wipes script storage after 7 days without a visit unless the game is on the
home screen. (b) The origin `adperez13-1986.github.io` is shared with every other project he
hosts there; any of them calling `localStorage.clear()` wipes the Workshop. (c) No export or
import: a phone change, or a move to itch.io (a different origin), strands every save, his own
included, and the kids' drawings in IndexedDB with it. (d) A real data-loss path: if a
migration or `repair()` throws, `openSave` falls back to `freshSave()` and its first
`store.write()` overwrites the stored copy. The `.corrupt` backup only covers unparseable JSON.
The `the-line` branch bumps the save to v3, so this is the next live risk.
*Fixed when:* raw save copied to a backup key before any migration runs; `persist()` requested
at first run; export/import of save + drawings as one file (from the Workshop or pause).
*Cost:* backup and persist cheap; export/import medium.

**2. Performance and battery are unmeasured below a flagship.** Every frame renders the full
composer (RenderPass, UnrealBloom's mip chain, grade, output) even when paused, in the
Workshop, and on ending screens, at display refresh: 120 Hz on the Poco F8 Pro, double the work
the 60 Hz sim can use. `powerPreference: 'high-performance'`, no quality tiers, no frame-time
readout. A 26-minute run is where thermal throttling lands, and it lands on the Arbiter. Only
one phone and no iPhone has ever run it. *Fixed when:* render capped at 60 fps, static screens
render on change only, a quality option (pixel ratio 1.0, half-res or no bloom), and one full
run each on a cheap Android and an iPhone holds 30+ fps, with the Poco's battery cost per run
written down. *Cost:* cap and idle cheap; quality tiers medium.

**3. Dev tuning UI ships to players.** `createGradePanel` runs unconditionally in `main.ts`:
the live site shows `sound / full / grade` chips, 25 sliders ("Grace's light", "zoom:
pull-back speed") and a "save values" button that POSTs to the dev server and says "failed".
The pause screen carries the playtest switch "push breaks wind-ups on/off". 18 `PLACEHOLDER`
markers remain in copy (endings, captions, notebook, Workshop cards), all his to write.
`?depth=` and `?save=memory` work in production (harmless; keep or gate). *Fixed when:* the
build has no top-right chips (grep `dist` for "save values" finds nothing), the break rule is
decided and the switch gone, zero PLACEHOLDER copy. *Cost:* cheap, except the words.

**4. No settings screen.** Mute is a chip that resets on reload. The buses a player wants
already exist in `audio.ts` (`master`, `music`, `hits`, `ambience`...) but only the dev panel
reaches them. Missing: volumes, screen shake and flash intensity, graphics quality (gap 2),
hold time for push (`PUSH_HOLD_MS = 180` is an accessibility knob), left-handed swap, abandon
run (it could end as Stopped, keeping the invariant), reset save, credits. *Fixed when:* one
settings page in pause and in the Workshop, persisted under `still-action.settings`. *Cost:*
cheap to medium; the knobs are built, the page isn't.

**5. A crash is a frozen frame with no words.** No `window.onerror` or `unhandledrejection`
handler. A throw inside `frame()` stops the rAF loop silently. A throw in boot (`loadKit`'s "has
no mesh") leaves a black screen forever. Context loss reloads after 400 ms and quietly drops the
current depth's progress. *Fixed when:* one overlay ("Something broke. Your run is kept from the
start of this depth.") with a reload button, the last few errors kept locally for a bug report,
and context loss saying what happened. *Cost:* cheap. The snapshot means the promise is true.

**6. Ready casts fire on release.** `hud.ts` fires a ready button on `pointerup`, and today's
playtest measured a median ~0.5 s press: every cast lands half a second late. A paying player
reads that as input lag. Hold-on-ready is reserved for aiming, which isn't built. *Fixed when:*
ready buttons fire on `pointerdown` (or after a short cap) and the playtest press-to-cast
median drops under 100 ms. *Cost:* cheap in code; it closes the "hold means two things" question.

**7. Only one input: touch.** No keyboard, no gamepad (the only `keydown` is the audio unlock).
Mouse can drag the virtual stick; that isn't playable. Most itch.io browser players are on
desktop. iPhone ignores `display: fullscreen` and the landscape lock, and has no Fullscreen API,
so the `full` chip does nothing there. *Fixed when:* WASD + four keys (hold a key = push, same
hold time) and a controller (stick + face buttons) play a full run, including the compare
prompt, pause and Workshop, which need focus navigation (that's the real work). *Cost:*
keyboard medium, gamepad medium, an iPhone pass cheap.

**8. Packaging for a store.** `base: '/still-action/'` is hardcoded; itch needs `./`. Inside
itch's iframe, storage sits on its shared HTML-game origin (verify), sharing quota with other
games. The free live URL and public repo already give the game away; decide what's paid (the
web build as a demo is a fine answer). Steam needs a desktop wrapper (Tauri or Electron),
window and resolution options (the orthographic view is tuned at 20:9; 16:9 and 16:10 show less
width), keyboard and controller as table stakes, controller-only on Steam Deck, and store art.
*Cost:* itch cheap to medium; Steam big.

**9. Licence notices are incomplete.** The assets are clean; the paperwork isn't. The three.js
MIT notice is stripped from the bundle (0 hits in `dist/assets`), and MIT requires it in copies.
`public/fonts/LICENSE.txt` is a one-line summary; OFL 1.1 wants the copyright lines and full
licence text to travel with the fonts. No credits screen: CC0 doesn't require one, but crediting
Kay Lousberg, Kenney and ambientCG is the convention. *Fixed when:* a third-party notices file in
the build and a credits page (the notebook's last page would suit). *Cost:* cheap.

**10. First open is a dark screen.** Nothing shows while 34 GLBs load, and the service worker's
install fetches all 5.3 MB in parallel on the same connection. Each KayKit GLB still carries the
colour atlas the code throws away, so most of `public/kaykit`'s 1.5 MB is downloaded for
nothing. *Fixed when:* a title card with a thin progress line; atlases stripped
(gltf-transform), likely ~1 MB saved. *Cost:* cheap.

**11. Localisation readiness.** Copy lives inline in about 12 modules, much of it inside
`innerHTML` templates; fonts are Latin subsets (Cinzel has no Cyrillic or CJK). English-only is
fine for a premium indie this size. But as he replaces the placeholders, put the words in one
copy module: nearly free now, a sweep later. *Cost:* cheap now, medium later.

**12. A slow leak over an evening.** The Workshop's geometry count grows 2-3 after some station
visits (handover, `the-line`). Five runs in one sitting drifts toward a context loss on a
phone. *Fixed when:* a 10-run soak holds `renderer.info.memory` flat. *Cost:* cheap to find.

## 3. The one that matters most

**Save durability (gap 1).** The game's whole promise is that you keep things: parts in the
pool, cards on the corkboard, marks on the doorframe, drawings. A paid game that loses the
Workshop to Safari's 7-day purge, a phone change or a host move breaks that promise in the
place it matters most, and no apology screen fixes it. The code is already 90% of the way there,
so the missing 10% (backup before migrating, `persist()`, export/import) is cheap relative to
what it protects. Do the backup before merging `the-line`, because that merge migrates his own
phone save. Close second: performance on unknown devices (gap 2), because it's unmeasured
rather than known bad. The cheapest embarrassment to remove is the dev panel (gap 3).
