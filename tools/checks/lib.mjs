/**
 * The headless checks' shared harness (design/area3/STAGE-R.md §3 R0). Every script starts its own vite
 * on 127.0.0.1 (never `npm run dev`: vite.config.ts sets `server.host: true`, which binds 0.0.0.0 and
 * this game does not go on the office network) and drives the system Chrome through playwright-core,
 * which downloads no browser of its own. Every check URL carries ?save=memory (a check never touches
 * a real save) except K-9C's, and ?depth=1 (a dev run straight into a level) except K-9C's.
 *
 * Values cross from the page as JSON text, never through playwright's own serialiser: the same
 * bytes then hash the same in a baseline and in a later check (see `evalJson`).
 */
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { chromium } from 'playwright-core'

/** The repo root, with its trailing slash. */
export const REPO = fileURLToPath(new URL('../../', import.meta.url))

/**
 * A vite dev server for the checks, on 127.0.0.1 only. The inline `host` beats vite.config.ts's `host: true`;
 * the assert is the proof, and the server is closed before it throws. Every script closes it in `finally`.
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export async function startVite() {
  const server = await createServer({
    root: REPO,
    configFile: REPO + 'vite.config.ts',
    server: { host: '127.0.0.1', port: 5199, strictPort: false },
    logLevel: 'error',
  })
  await server.listen()
  const local = server.resolvedUrls?.local?.[0] ?? ''
  const network = server.resolvedUrls?.network ?? []
  if (!local.startsWith('http://127.0.0.1') || network.length !== 0) {
    await server.close()
    throw new Error(`vite is not loopback-only: local=${local} network=${JSON.stringify(network)}`)
  }
  return { url: local, close: () => server.close() }
}

/**
 * A page on a fresh browser context, waiting for the game's dev hooks and its first level.
 * `errors` collects every pageerror and console error, for the caller to fail on.
 * @param {string} url the server's base url
 * @param {string} query the query string, with or without its `?`
 */
export async function openPage(url, query) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--use-gl=angle', '--enable-unsafe-swiftshader'],
  })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    /** @type {string[]} */
    const errors = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`) })
    // a boot that throws never gets its level: fail on the first page error rather than after the timeout
    const crashed = new Promise((_, reject) => page.on('pageerror', (e) => reject(new Error(`boot failed: ${e.message}`))))
    crashed.catch(() => {})
    await page.goto(url + (query.startsWith('?') || query === '' ? query : '?' + query))
    await Promise.race([
      page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 }),
      crashed,
    ])
    return { page, errors, close: () => browser.close() }
  } catch (e) {
    await browser.close()
    throw e
  }
}

/** sha1 hex of a value's JSON text. */
export const hash = (v) => createHash('sha1').update(JSON.stringify(v)).digest('hex')

/**
 * Run `fn(arg)` in the page (fn must be self-contained: it is sent as source) and hand back what it returned, as it stringifies. Playwright's own
 * serialiser keeps NaN, undefined and friends apart from JSON's; going through JSON on both sides keeps
 * one rule for what a baseline file, a hash and a deep-equal all see.
 */
export async function evalJson(page, fn, arg) {
  const text = await page.evaluate(
    async ({ f, a }) => JSON.stringify(await new Function('return ' + f)()(a)) ?? 'null',
    { f: fn.toString(), a: arg ?? null },
  )
  return JSON.parse(text)
}

/** The path and the two values of the first difference between two JSON values, or null when they are equal. */
export function firstDiff(a, b, path = '$') {
  if (a === b) return null
  const ta = typeof a, tb = typeof b
  if (ta !== 'object' || tb !== 'object' || a === null || b === null) return `${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`
  if (Array.isArray(a) !== Array.isArray(b)) return `${path}: array vs object`
  if (Array.isArray(a)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} != ${b.length}`
    for (let i = 0; i < a.length; i++) {
      const d = firstDiff(a[i], b[i], `${path}[${i}]`)
      if (d) return d
    }
    return null
  }
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  for (const k of keys) {
    if (!(k in a)) return `${path}.${k}: missing in the first`
    if (!(k in b)) return `${path}.${k}: missing in the second`
    const d = firstDiff(a[k], b[k], `${path}.${k}`)
    if (d) return d
  }
  return null
}

/** Throw unless a deep-equals b (JSON values). `what` names it in the message. */
export function assertEq(what, a, b) {
  const d = firstDiff(a, b)
  if (d) throw new Error(`${what}: ${d}`)
}

/** Throw unless ok. */
export function assert(ok, what) {
  if (!ok) throw new Error(what)
}

/**
 * The check runner. `check(id, query, fn)` registers one part of a check; `fn({ page, url })` throws on a mismatch,
 * and its message is the FAIL line. An id may be registered more than once, once per query it needs (K-9B reads
 * three boots): it passes when every part does, and it prints one line. `run(argvIds)` runs all of them, or the
 * listed ids, grouped by query so each group gets one page: a part must enter its own level and leave nothing
 * another needs. A page error fails every part on that page. Prints `PASS K-9x` or `FAIL K-9x: <first mismatch>`,
 * in registration order; the exit code is 1 on any fail.
 */
export function suite() {
  /** @type {{ id: string, query: string, fn: (ctx: { page: any, url: string }) => Promise<void> }[]} */
  const checks = []
  return {
    check: (id, query, fn) => { checks.push({ id, query, fn }) },
    /** @param {string[]} argvIds */
    async run(argvIds = []) {
      const want = argvIds.length ? checks.filter((c) => argvIds.includes(c.id)) : checks
      const missing = argvIds.filter((id) => !checks.some((c) => c.id === id))
      for (const id of missing) console.log(`FAIL ${id}: no such check registered`)
      /** @type {Map<string, string | null>} id -> its first failure, or null while it passes */
      const outcome = new Map(want.map((c) => [c.id, null]))
      const groups = new Map()
      for (const c of want) groups.set(c.query, [...(groups.get(c.query) ?? []), c])
      if (groups.size) {
        const vite = await startVite()
        try {
          for (const [query, list] of groups) {
            let p
            try {
              p = await openPage(vite.url, query)
            } catch (e) {
              for (const c of list) if (!outcome.get(c.id)) outcome.set(c.id, `${query}: ${e instanceof Error ? e.message : String(e)}`)
              continue
            }
            try {
              for (const c of list) {
                let why = null
                try {
                  await c.fn({ page: p.page, url: vite.url })
                } catch (e) {
                  why = e instanceof Error ? e.message : String(e)
                }
                if (why && !outcome.get(c.id)) outcome.set(c.id, why)
              }
              if (p.errors.length) for (const c of list) if (!outcome.get(c.id)) outcome.set(c.id, `page error: ${p.errors[0]}`)
            } finally {
              await p.close()
            }
          }
        } finally {
          await vite.close()
        }
      }
      for (const [id, why] of outcome) console.log(why ? `FAIL ${id}: ${why}` : `PASS ${id}`)
      return missing.length || [...outcome.values()].some(Boolean) ? 1 : 0
    },
  }
}
