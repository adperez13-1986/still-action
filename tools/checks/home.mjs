/**
 * The warm beam's confirmation (29 Sep, his ask: brushing the warm light after a boss that isn't the last
 * took him home with no say). Beside an open cold beam, the warm one asks first: a prompt, and only its tap
 * takes him. After the last boss the warm beam stands alone and takes him as before.
 * `node tools/checks/home.mjs [K-H1 ...]`.
 */
import { assert, assertEq, evalJson, suite } from './lib.mjs'

// the 6-depth game, pinned with roads=0 (the live game is 9 depths since 30 Sep)
const RUN = '?depth=1&save=memory&roads=0&line=0&engine=0'
const { check, run } = suite()

/** In the page: to `depth` with its boss down; stepped outside the warm beam, then into it. */
const INTO_WARM = `(depth) => {
  window.__run.dev = false
  window.__enter(depth, 1)
  window.__killBoss()
  window.__step(0.2)
  const { warm, cold } = window.__exits()
  if (!warm) return { bad: 'no warm beam after the kill at ' + depth }
  window.__still.pos.set(warm.x + 3, 0, warm.z)
  window.__step(0.1)
  window.__still.pos.set(warm.x, 0, warm.z)
  window.__step(0.5)
  const p = document.querySelector('#prompt')
  return { cold: !!cold?.open, mode: window.__mode(), shown: p.classList.contains('show'), title: p.querySelector('.name').textContent, warm }
}`

check('K-H1', RUN, async ({ page }) => {
  const got = await evalJson(page, INTO_WARM, 3)
  assert(!got.bad, got.bad)
  assert(got.cold, 'depth 3: the cold beam is open beside the warm one')
  assertEq('depth 3, standing in the warm beam: still crawling', got.mode, 'crawl')
  assert(got.shown, 'depth 3, in the warm beam: the prompt shows')
  assertEq('the prompt', got.title, 'The warm light')
})

check('K-H2', RUN, async ({ page }) => {
  const got = await evalJson(page, `(depth) => {
    const r = (${INTO_WARM})(depth)
    if (r.bad) return r
    // out of the light: the prompt goes, nothing ends
    window.__still.pos.set(r.warm.x + 3, 0, r.warm.z)
    window.__step(0.3)
    const out = { mode: window.__mode(), shown: document.querySelector('#prompt').classList.contains('show') }
    // back in, and the tap
    window.__still.pos.set(r.warm.x, 0, r.warm.z)
    window.__step(0.3)
    document.querySelector('#prompt .take').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    const t = window.__until(() => window.__mode() !== 'crawl', 3)
    return { out, t, mode: window.__mode(), end: window.__run.ending?.kind ?? null }
  }`, 3)
  assert(!got.bad, got.bad)
  assertEq('stepped out: still crawling', got.out.mode, 'crawl')
  assert(!got.out.shown, 'stepped out: the prompt is gone')
  assert(got.t >= 0, 'the tap never took him out of the crawl')
  assertEq('after the tap: the ending kept', got.end, 'home')
})

check('K-H3', RUN, async ({ page }) => {
  const got = await evalJson(page, `(depth) => {
    const r = (${INTO_WARM})(depth)
    if (r.bad) return r
    return { ...r, end: window.__run.ending?.kind ?? null }
  }`, 6)
  assert(!got.bad, got.bad)
  assert(!got.cold, 'depth 6: no cold beam')
  assert(!got.shown, 'depth 6: no prompt')
  assert(got.mode !== 'crawl', 'depth 6: the warm beam takes him as before')
  assertEq('depth 6: the ending kept', got.end, 'home')
})

check('K-H4', RUN, async ({ page }) => {
  const got = await evalJson(page, () => {
    window.__run.dev = false
    window.__enter(3, 1)
    window.__killBoss()
    window.__step(0.2)
    window.__end('home')
    return { end: window.__run.ending?.kind ?? null, mode: window.__mode() }
  })
  assertEq("__end('home') at 3, cold beam open: the ending kept", got.end, 'home')
  assert(got.mode !== 'crawl', "__end('home') at 3 leaves the crawl")
})

process.exit(await run(process.argv.slice(2)))
