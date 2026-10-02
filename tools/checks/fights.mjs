/**
 * K-90F: the fight baseline (design/area3/STAGE-B.md §3 B0). K-90 (baseline.mjs) steps no fight, so it cannot prove a
 * combat change touched only what it names; this can. Ten scripted fights, each on seeds 1..5, recorded every half second.
 *
 *   node tools/checks/fights.mjs capture                       writes tools/checks/baseline/fights.json
 *   node tools/checks/fights.mjs compare [--may-differ F5,F9]  reruns it and deep-equals each scenario against the file
 *   node tools/checks/fights.mjs capture-names                 writes tools/checks/baseline/names.json (the roster, flag-off)
 *   node tools/checks/fights.mjs compare-names                 reruns it and deep-equals it (stageb.mjs K-E10 does the same)
 *
 * One page, `?depth=1&save=memory&roads=0&line=0&engine=0`, frame loop held (`__hold(true)`). Each scenario runs in ONE evaluate: Math.random is
 * seeded with mulberry32(seed) (restored in `finally`), then `__arena()`, `__combat.time = 0`, the setup, and `__step` in
 * 1/60 s ticks with Still's HP put back to 100 before each tick (so no ending triggers; the HP he lost is read after it).
 * `compare` PASSes when every scenario outside `--may-differ` is equal; a listed one prints INFO either way. A stage that
 * changes a fight on purpose names its scenarios, reviews the diff, then re-captures.
 *
 * 2 Oct (build layer B0): re-captured with weight ON (the suites' live default, lib.mjs); tap push changes nothing here (`__fire` is not a touch). The diff against the
 * weight-off file is weight's known numbers only: depth-1 pack HP x1.4 (a hulk 30 -> 42, a sentinel 20 -> 28), and what follows from fights that run longer (Still loses more
 * HP in F1-F6, F8, F9; counter, lunge and skid events now fit in the window; F2, F3, F5 count more pierce hits). `WEIGHT=0` no longer compares equal.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { REPO, evalJson, firstDiff, openPage, startVite } from './lib.mjs'

const FILE = REPO + 'tools/checks/baseline/fights.json'
const NAMES = REPO + 'tools/checks/baseline/names.json'
// pinned to the 6-depth game with roads=0 (the live game is 9 depths since 30 Sep)
const QUERY = '?depth=1&save=memory&roads=0&line=0&engine=0'
const SEEDS = [1, 2, 3, 4, 5]
/** F1-F10 are the brief's. F11-F14 are B0's additions (see fight()): the same fights where the brief's never reach what they guard. */
const IDS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'F13', 'F14']

/**
 * One fight, in the page (self-contained: it is sent as source). Returns
 * `{ loadout, ticks: [{ t, lost, still, e: [[x, z, hp, phase], ...] }], part, enemy }`: every 0.5 s the HP Still lost in
 * that window, where he stands and each body; at the end the counts of the part events and the enemy events, by kind.
 */
function fight({ id, seed, parry }) {
  const W = window
  /** mulberry32, the usual: one 32-bit state, no dependency. */
  const mulberry32 = (a) => () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const r3 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null)
  // every fight starts from one pinned loadout, the Scrap Cleaver alone (a plain start part, uncast in most fights): a depth-1
  // boot deals him ONE RANDOM plain part (main.ts startPart, unseeded), and an earlier fight's Parry Clamp must not follow him.
  // This runs BEFORE the seed: still.wear draws Math.random (its rig), a different number of times for each part it takes off
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  for (const slot of SLOTS) W.__combat.clearSlot(slot)
  W.__hud.resetLoadout([])
  for (const slot of SLOTS) W.__still.wear(slot, null)
  W.__equip('scrap-cleaver')
  const original = Math.random
  Math.random = mulberry32(seed)
  // the parry-catch trial's switch is on by default in the page: the baseline is the game with it OFF (today's), `--parry-on` the trial
  W.__parryCatch(!!parry)
  try {
    W.__arena()
    const C = W.__combat
    C.time = 0
    C.pressure = true
    C.counters = false
    C.breakRule = false
    C.autoAttack = true // "the close strike on": the hand, and the eye once he rests
    W.__stick(0, 0)
    const around = (n, r, a0 = Math.random() * Math.PI * 2) =>
      Array.from({ length: n }, (_, k) => [Math.sin(a0 + (k * 2 * Math.PI) / n) * r, Math.cos(a0 + (k * 2 * Math.PI) / n) * r])
    const spawn = (kind, [x, z], elite) => W.__spawn(kind, x, z, true, elite)
    let secs = 20
    /** @type {() => void} */
    let before = () => {}
    let ram = null
    switch (id) {
      case 'F1':
        for (const p of around(3, 3)) spawn('chaser', p)
        break
      case 'F2':
        for (const p of around(2, 7)) spawn('ranged', p)
        break
      case 'F3': {
        const ps = around(6, 5)
        W.__pack(ps.map(([x, z]) => ({ kind: 'swarm', x, z })), true)
        break
      }
      case 'F4':
        C.counters = true
        spawn('chaser', around(1, 3)[0])
        break
      case 'F5': {
        C.counters = true
        secs = 30
        const a0 = Math.random() * Math.PI * 2
        spawn('chaser', around(1, 3, a0)[0])
        spawn('charger', around(1, 6, a0 + Math.PI)[0])
        break
      }
      case 'F6':
        W.__equip('parry-clamp')
        for (const p of around(3, 3)) spawn('chaser', p)
        before = () => W.__fire('arms') // a tap on a cooling button does nothing, so this is "when ready"
        break
      case 'F7':
        W.__equip('parry-clamp')
        spawn('chaser', [0, 2.2], 'plated')
        before = () => W.__fire('arms')
        break
      case 'F8':
        spawn('charger', around(1, 6)[0])
        break
      case 'F9': {
        C.counters = true
        secs = 30
        const a0 = Math.random() * Math.PI * 2
        spawn('ranged', around(1, 8, a0)[0], 'plated')
        spawn('chaser', around(1, 3, a0 + Math.PI)[0])
        break
      }
      case 'F10': {
        secs = 10
        C.autoAttack = false
        W.__equip('parry-clamp')
        ram = spawn('charger', around(1, 6)[0])
        let pushed = false
        before = () => {
          if (!pushed && ram.phase === 'windup' && !ram.locked) {
            pushed = true
            W.__fire('arms', true)
          }
        }
        break
      }
      // F11-F13: F4, F5 and F9 with the close strike OFF. With it on (the brief's), a 20 hp hulk dies inside 1.3 s and the
      // counter-move's crouch (it needs 1.5 s in the strike's reach) never starts in any of the five seeds: F4, F5 and F9
      // then record no `counter` event at all, and could not show B2's crouch-books-its-lunge change. These can.
      case 'F11':
        C.counters = true
        C.autoAttack = false
        spawn('chaser', around(1, 3)[0])
        break
      case 'F12': {
        C.counters = true
        C.autoAttack = false
        secs = 30
        const a0 = Math.random() * Math.PI * 2
        spawn('chaser', around(1, 3, a0)[0])
        spawn('charger', around(1, 6, a0 + Math.PI)[0])
        break
      }
      case 'F13': {
        C.counters = true
        C.autoAttack = false
        secs = 30
        const a0 = Math.random() * Math.PI * 2
        spawn('ranged', around(1, 8, a0)[0], 'plated')
        spawn('chaser', around(1, 3, a0 + Math.PI)[0])
        break
      }
      // F14: F10 with Still stepped up to the ram (1.8 u, on the origin's side of it) as it starts to track, and the break
      // rule on. In the brief's F10 the ram tracks from 3.4 u or more, outside Parry's 2.6 reach, so the push breaks nothing;
      // here it does, which is the path (`interrupt(reel)`, the stagger) B5's charger.ts refactor widens.
      case 'F14': {
        secs = 10
        C.autoAttack = false
        C.breakRule = true
        W.__equip('parry-clamp')
        ram = spawn('charger', around(1, 2.2)[0])
        let pushed = false
        before = () => {
          if (!pushed && ram.phase === 'windup' && !ram.locked) {
            pushed = true
            const d = Math.hypot(ram.pos.x, ram.pos.z) || 1
            W.__still.pos.set(ram.pos.x - (ram.pos.x / d) * 1.8, 0, ram.pos.z - (ram.pos.z / d) * 1.8)
            W.__fire('arms', true)
          }
        }
        break
      }
      default:
        throw new Error(`no scenario ${id}`)
    }
    // counts are of what the ticks produce: whatever the arena and the setup logged is dropped first
    W.__partLog.length = 0
    W.__enemyLog.length = 0
    const ticks = []
    const part = {}, enemy = {}
    const count = (into, key) => { into[key] = (into[key] ?? 0) + 1 }
    let lost = 0
    const n = Math.round(secs * 60)
    for (let i = 1; i <= n; i++) {
      C.hp = 100
      before()
      W.__step(1 / 60)
      lost += 100 - C.hp
      if (i % 30 === 0) {
        ticks.push({
          t: r3(i / 60), lost: r3(lost), still: [r3(W.__still.pos.x), r3(W.__still.pos.z)],
          e: C.enemies.map((e) => [r3(e.pos.x), r3(e.pos.z), r3(e.hp), e.phase]),
        })
        lost = 0
        // the logs are capped (500, 2000, oldest out): drain them each window so no count is ever lost to the cap
        for (const ev of W.__partLog) count(part, ev.kind)
        for (const { ev } of W.__enemyLog) count(enemy, ev.what ? `${ev.kind}:${ev.what}` : ev.kind)
        W.__partLog.length = 0
        W.__enemyLog.length = 0
      }
    }
    const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))
    return { loadout: W.__hud.slots.map((s) => s.def?.id ?? null), ticks, part: sorted(part), enemy: sorted(enemy) }
  } finally {
    Math.random = original
  }
}

/** Everything the baseline records, from one flag-off page held still. */
async function collect(page, parry = false) {
  await page.evaluate(() => window.__hold(true))
  const out = {}
  for (const id of IDS) {
    out[id] = {}
    for (const seed of SEEDS) out[id][seed] = await evalJson(page, fight, { id, seed, parry })
  }
  return out
}

/** The flag-off roster as a page shows it: names by kind and depth, the pages' roles and bands, and WHAT (notebook.ts, imported as main has it). */
async function collectNames(page) {
  return evalJson(page, async () => {
    const { WHAT } = await import('/src/notebook.ts')
    const names = {}
    for (const kind of ['chaser', 'ranged', 'charger', 'swarm']) {
      names[kind] = {}
      for (let d = 1; d <= 9; d++) names[kind][d] = window.__namesFor(kind, d)
    }
    return { names, what: WHAT, roster: window.__roster().map((r) => [r.id, r.name, r.role, r.band, r.mod ?? null]) }
  })
}

async function withPage(fn) {
  const vite = await startVite()
  try {
    const p = await openPage(vite.url, QUERY)
    try {
      const out = await fn(p.page)
      if (p.errors.length) throw new Error(`page errors:\n${p.errors.join('\n')}`)
      return out
    } finally {
      await p.close()
    }
  } finally {
    await vite.close()
  }
}

const mode = process.argv[2]
const flag = process.argv.indexOf('--may-differ')
const mayDiffer = new Set(flag >= 0 ? (process.argv[flag + 1] ?? '').split(',').filter(Boolean) : [])
for (const id of mayDiffer) if (!IDS.includes(id)) { console.log(`unknown scenario in --may-differ: ${id}`); process.exit(2) }

if (mode === 'capture') {
  const rec = await withPage(collect)
  writeFileSync(FILE, JSON.stringify(rec, null, 1) + '\n')
  console.log(`captured ${FILE}`)
} else if (mode === 'compare') {
  const parryOn = process.argv.includes('--parry-on')
  const now = JSON.parse(JSON.stringify(await withPage((page) => collect(page, parryOn))))
  const want = JSON.parse(readFileSync(FILE, 'utf8'))
  let bad = 0
  for (const id of IDS) {
    const d = firstDiff(now[id], want[id])
    // --parry-on: the trial's diff against the switch-off baseline, all INFO (which scenarios it changes)
    if (parryOn) console.log(d ? `INFO K-90F --parry-on: ${id} differs at ${d}` : `INFO K-90F --parry-on: ${id} equal`)
    else if (mayDiffer.has(id)) console.log(d ? `INFO K-90F: ${id} differs at ${d}` : `INFO K-90F: ${id} equal`)
    else if (d) { bad++; console.log(`FAIL K-90F: ${id} differs at ${d}`) }
  }
  if (bad) process.exit(1)
  if (!parryOn) console.log('PASS K-90F')
} else if (mode === 'capture-names') {
  writeFileSync(NAMES, JSON.stringify(await withPage(collectNames), null, 1) + '\n')
  console.log(`captured ${NAMES}`)
} else if (mode === 'compare-names') {
  const now = JSON.parse(JSON.stringify(await withPage(collectNames)))
  const d = firstDiff(now, JSON.parse(readFileSync(NAMES, 'utf8')))
  console.log(d ? `FAIL K-90N: ${d}` : 'PASS K-90N')
  if (d) process.exit(1)
} else {
  console.log('usage: node tools/checks/fights.mjs capture|compare [--may-differ F5,F9] [--parry-on]|capture-names|compare-names')
  process.exit(2)
}
