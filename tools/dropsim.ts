/**
 * The drop simulator: N seeded runs through the game's own drop code (src/drops.ts, src/pool.ts,
 * src/abilities.ts), so drop odds are tuned by script, not by the owner's runs.
 *
 *   npx tsx tools/dropsim.ts
 *   npx tsx tools/dropsim.ts --runs 20000 --seed 1 --build random --need 3 --pool full --crates 0.25 --plenty 1 --second want
 *
 * --build   burner | cover | control | duel | random (one of the four each run) | a list of part ids
 * --need    how many of the build must be worn for it to count as formed (default 3)
 * --pool    full (every part found, the balancer's case) | starter (each run from the starter
 *           twelve) | career (starts from the twelve; what a run takes stays found for the next)
 * --crates  the share of a level's crates and barrels he smashes (a guess: nothing logs it yet)
 * --plenty  the chance he raises a Plenty shrine's pedestals when the level has one
 * --second  the Assembler's second pick (+4 strain, kept): want (when a pedestal left helps) |
 *           build (only for a part of the build) | never
 * --lean    close | marksman (a committed chooser of that lean) | random (a random picker) | all (the
 *           three, --runs each, and the leanings' pass lines); replaces --build (design/leanings/PITCHES.md)
 * --match   on | off (default, as the game ships: LEAN_MATCH): one pedestal in three from his lean
 *
 * A run is depths 1-6 of road II. A crawl depth is one of the real levels in tools/levels.json
 * (refresh it with the dev hook __census when the level generator changes); every pack is killed,
 * each kill rolls the real dropChance, the elite's kill owes the 'elite' drop, a smashed crate
 * rolls LOOT.crateParts; a floor part is only for a slot he wears. The pedestals (rollPicks):
 * three beside each crawl exit, after the level's fights; three at a Plenty shrine, where it
 * falls among them; three after the Assembler (depth 3), with the second pick. The Arbiter (6)
 * drops one blue and one gold on the floor, never the same slot. Every drop is offered (he walks
 * over all of them); what he leaves lies on the floor, out of the draw, until the level ends.
 * The thief is left out: a caught thief gives the part back.
 *
 * The player: on the floor, takes a part of the target build if the one it replaces isn't in
 * the build. At pedestals, the first of: a build part for an empty slot, a build part over one
 * that isn't, anything for an empty slot; else he leaves all three. The two he doesn't take go
 * back to the wall (found, in the career pool).
 *
 * With --lean, a part is worth 2 of his lean with a rider, 1 of his lean, 0 off it. A committed
 * chooser takes a floor part worth more than the one it replaces; at pedestals, the first of: his
 * lean for an empty slot, the biggest gain over what he wears, anything for an empty slot. The
 * random picker takes a pedestal at random, and a floor part (or the second pick) half the time.
 * Formed: 3+ parts of his lean and 1+ of its riders worn at the Arbiter (either lean, for random).
 */
import { PARTS, byId, type AbilityDef, type Lean } from '../src/abilities'
import { dropChance, emptySlots, KILL_WEIGHT, LEAN_MATCH, leanOf, LOOT, rollPart, rollPicks, type DropSource, type PickKind } from '../src/drops'
import { markFound, startPart, STARTER_POOL, type PoolView } from '../src/pool'
import type { Archetype } from '../src/combat'
import type { Save } from '../src/save'
import type { SlotName } from '../src/still'
import census from './levels.json' with { type: 'json' }


// --- options ---
const arg = (name: string, dflt: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : dflt
}
const RUNS = Number(arg('runs', '20000'))
const SEED = Number(arg('seed', '1'))
const NEED = Number(arg('need', '3'))
const POOL = arg('pool', 'full') as 'full' | 'starter' | 'career'
const CRATES = Number(arg('crates', '0.25'))
const PLENTY = Number(arg('plenty', '1'))
const SECOND = arg('second', 'want') as 'want' | 'build' | 'never'

/** The balancer's four builds (design/replay/2-balancer.md), by part id. */
const BUILDS: Record<string, string[]> = {
  burner: ['overclocked-coil', 'frayed-cleaver', 'overrun', 'brace', 'borrowed-time'],
  cover: ['ricochet-lens', 'clamp-toss', 'spring-heels', 'through-line'],
  control: ['chill-vent', 'frost-trail', 'backdraft-vent', 'rusted-hook'],
  duel: ['patient-lens', 'parry-clamp', 'anvil', 'plumb-line'],
}
const BUILD = arg('build', 'random')
const target = (): Set<string> =>
  new Set(BUILD === 'random' ? Object.values(BUILDS)[Math.floor(Math.random() * 4)]!
    : BUILDS[BUILD] ?? BUILD.split(',').map((id) => byId(id).id))
const LEAN = arg('lean', '') as '' | Lean | 'random' | 'all'
const MATCH = arg('match', LEAN_MATCH ? 'on' : 'off') === 'on'
/** Who picks: the build's chooser, a committed chooser of one lean, or the random picker. */
type Chooser = 'build' | Lean | 'random'

// Seeded: the drop code draws from Math.random, so it's replaced before the first run.
let s = SEED >>> 0
Math.random = () => {
  s = (s + 0x6d2b79f5) >>> 0
  let t = Math.imul(s ^ (s >>> 15), 1 | s)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// --- the levels ---
type Pack = { side: boolean; elite: boolean; kinds: Archetype[] }
type Level = { packs: Pack[]; crates: number; plenty: boolean }
const DEPTHS = Object.entries(census.depths).map(([d, v]) => ({
  depth: Number(d), boss: v.boss,
  levels: v.levels.map((l): Level => ({
    crates: l.crates, plenty: l.plenty,
    packs: l.packs.map((p) => {
      const [room, kinds] = p.split(': ') as [string, string]
      return { side: room.startsWith('side'), elite: room.endsWith('*'), kinds: kinds.split(' ') as Archetype[] }
    }),
  })),
}))

const SLOTS: SlotName[] = ['head', 'torso', 'arms', 'legs']
const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// --- one run ---
type Tag = 'kill' | 'crate' | 'elite' | 'boss' | PickKind
interface RunOut {
  fullAt: number | null
  /** Build parts worn: after the Assembler's gift, before the Arbiter's gift, at the end. */
  atAssembler: number; atArbiter: number; atEnd: number
  /** Parts on Still entering the Assembler. */
  wornIn: number
  /** The Assembler's second pick was taken. */
  second: boolean
  offers: { id: string; tag: Tag; unfound: boolean; filled: boolean; taken: boolean }[]
  /** --lean: his lean formed at the Arbiter (3+ of its parts, 1+ of its riders). */
  formed: boolean
  /** Pedestal sets, and those with a part of the lean he wears most (his match, when on). */
  sets: number; matched: number
}

const career: string[] = [...STARTER_POOL]

function run(who: Chooser): RunOut {
  const found = POOL === 'full' ? PARTS.map((p) => p.id) : POOL === 'career' ? career : [...STARTER_POOL]
  const save = { found, turned: [], hook: null } as unknown as Save
  const T = target()
  const worn: Partial<Record<SlotName, AbilityDef>> = {}
  const first = byId(startPart(save))
  worn[first.slot] = first
  const out: RunOut = { fullAt: null, atAssembler: 0, atArbiter: 0, atEnd: 0, wornIn: 0, second: false, offers: [], formed: false, sets: 0, matched: 0 }
  let last: Lean | null = null
  /** A committed chooser's worth of a part: 2 his lean with a rider, 1 his lean, 0 off it. */
  const value = (def: AbilityDef) => (who !== 'build' && who !== 'random' && def.lean === who ? (def.rider ? 2 : 1) : 0)
  const formedAs = (lean: Lean) => {
    const on = SLOTS.map((sl) => worn[sl]).filter((p): p is AbilityDef => !!p && p.lean === lean)
    return on.length >= 3 && on.some((p) => p.rider)
  }
  const score = () => SLOTS.filter((sl) => worn[sl] && T.has(worn[sl]!.id)).length
  let floor: AbilityDef[] = []
  let depth = 1

  const taken = () => [...(Object.values(worn) as AbilityDef[]), ...floor]
  const view = (): PoolView => ({ found: new Set(save.found), turned: new Set(), depth })
  const wornNow = () => Object.values(worn) as AbilityDef[]
  const empty = () => emptySlots(wornNow())

  const wear = (def: AbilityDef) => {
    if (def.lean) last = def.lean
    markFound(save, def.id)
    // the part he gave up lands at his feet, and lies there with the rest
    const cur = worn[def.slot]
    if (cur) floor.push(cur)
    worn[def.slot] = def
  }
  /** He walks over it: the card, and the player's choice. */
  const offer = (def: AbilityDef | null, tag: Tag) => {
    if (!def) return
    const cur = worn[def.slot]
    const take = !!cur && (who === 'build' ? T.has(def.id) && !T.has(cur.id) : who === 'random' ? Math.random() < 0.5 : value(def) > value(cur))
    out.offers.push({ id: def.id, tag, unfound: !save.found.includes(def.id), filled: !!cur, taken: take })
    if (take) wear(def)
    else floor.push(def)
  }
  /** A floor part: only ever for a slot he wears. */
  const plain = (from: Archetype, source: DropSource) => offer(rollPart(from, taken(), source, view(), empty()), source === 'kill' ? 'kill' : 'crate')
  /** How much he wants a pedestal's part: 3 a build part for an empty slot, 2 over a part not in the build, 1 anything for an empty slot. */
  const want = (def: AbilityDef) => {
    const cur = worn[def.slot]
    if (who === 'random') return 1
    if (who !== 'build') return cur ? value(def) - value(cur) : value(def) > 0 ? 3 + value(def) : 1
    if (T.has(def.id) && (!cur || !T.has(cur.id))) return cur ? 2 : 3
    return cur ? 0 : 1
  }
  /** A set of pedestals: he takes the one he wants most (up to `picks`, each while it's still wanted enough); the rest go back to the wall. */
  const pedestals = (kind: PickKind, picks = 1) => {
    const lean = leanOf(wornNow(), last)
    const set = rollPicks(kind, wornNow(), taken(), view(), lean, MATCH)
    out.sets++
    if (lean && set.some((d) => d.lean === lean)) out.matched++
    const recs = set.map((def) => ({ id: def.id, tag: kind as Tag, unfound: !save.found.includes(def.id), filled: !!worn[def.slot], taken: false }))
    out.offers.push(...recs)
    let took = 0
    for (let i = 0; i < picks; i++) {
      const left = set.filter((_, j) => !recs[j]!.taken)
      const best = who === 'random'
        ? (i === 0 || Math.random() < 0.5 ? left[Math.floor(Math.random() * left.length)] ?? null : null)
        : left.reduce<AbilityDef | null>((b, d) => (want(d) > (b ? want(b) : 0) ? d : b), null)
      if (!best || (i > 0 && SECOND === 'never') || (i > 0 && SECOND === 'build' && want(best) < 2)) break
      recs[set.indexOf(best)]!.taken = true
      wear(best)
      took++
    }
    if (took) for (const def of set) markFound(save, def.id)
    if (kind === 'gift') out.second = took > 1
  }
  const arbiter = () => {
    const blue = rollPart('boss', taken(), 'boss-blue', view(), empty())
    offer(blue, 'boss')
    offer(rollPart('boss', blue ? [...taken(), blue] : taken(), 'boss-gold', view(), blue ? [...empty(), blue.slot] : empty()), 'boss')
  }

  for (const d of DEPTHS) {
    depth = d.depth
    floor = []
    if (d.boss) {
      if (depth === 3) {
        out.wornIn = wornNow().length
        pedestals('gift', 2)
        out.atAssembler = score()
      } else {
        out.atArbiter = score()
        out.formed = who === 'random' ? formedAs('close') || formedAs('marksman') : who !== 'build' && formedAs(who)
        arbiter()
      }
    } else {
      const level = d.levels[Math.floor(Math.random() * d.levels.length)]!
      type Event = () => void
      const events: Event[] = level.packs.map((p) => () => {
        const pack = { weight: p.kinds.reduce((a, k) => a + KILL_WEIGHT[k], 0), side: p.side, dropped: false, members: [...p.kinds] }
        // the first listed member leads: it's the elite
        const order = shuffle(p.kinds.map((kind, i) => ({ kind, elite: p.elite && i === 0 })))
        for (const m of order) {
          pack.members.pop()
          if (Math.random() >= dropChance(pack, m.elite, false, KILL_WEIGHT[m.kind])) continue
          pack.dropped = true
          if (m.elite) offer(rollPart(m.kind, taken(), 'elite', view()), 'elite')
          else plain(m.kind, 'kill')
        }
      })
      for (let i = 0; i < level.crates; i++) {
        if (Math.random() < CRATES) events.splice(Math.floor(Math.random() * (events.length + 1)), 0, () => {
          if (Math.random() < LOOT.crateParts) plain('chaser', 'crate')
        })
      }
      if (level.plenty && Math.random() < PLENTY) {
        events.splice(Math.floor(Math.random() * (events.length + 1)), 0, () => pedestals('plenty'))
      }
      for (const e of events) e()
      pedestals('exit')
    }
    if (out.fullAt === null && empty().length === 0) out.fullAt = depth
  }
  out.atEnd = score()
  return out
}

// --- the leanings' report ---
if (LEAN) {
  const whos: Chooser[] = LEAN === 'all' ? ['close', 'marksman', 'random'] : [LEAN]
  const by = new Map(whos.map((w) => [w, Array.from({ length: RUNS }, () => run(w))]))
  const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(0)}%`
  console.log(`dropsim --lean ${LEAN}: ${RUNS} runs each, seed ${SEED}, pool ${POOL}, crates ${CRATES}, plenty ${PLENTY}, second ${SECOND}, match ${MATCH ? 'on' : 'off'}\n`)
  const formed = new Map([...by].map(([w, rs]) => [w, rs.filter((r) => r.formed).length / RUNS]))
  for (const [w, f] of formed) console.log(`formed at the Arbiter (3+ own tags, 1+ own rider), ${w}: ${pct(f, 1)}`)
  const pass = (ok: boolean) => (ok ? 'pass' : 'FAIL')
  if (formed.has('close') && formed.has('marksman')) {
    const c = formed.get('close')!
    const m = formed.get('marksman')!
    console.log(`  committed >= 60% each: ${pass(c >= 0.6 && m >= 0.6)}   within 10 points: ${pass(Math.abs(c - m) <= 0.1)} (${(100 * Math.abs(c - m)).toFixed(0)})`)
  }
  if (formed.has('random')) console.log(`  random <= 30%: ${pass(formed.get('random')! <= 0.3)}`)
  for (const [w, rs] of by) {
    const sets = rs.reduce((a, r) => a + r.sets, 0)
    console.log(`pedestal sets with a part of his lean, ${w}: ${pct(rs.reduce((a, r) => a + r.matched, 0), sets)}`)
  }

  // what gets picked and offered, over every chooser run
  const all = [...by.values()].flat()
  const n = all.length
  const offers = all.flatMap((r) => r.offers)
  console.log('\nper part, a run: offered (taken); * over 2x its slot\'s median taken')
  let over = 0
  for (const slot of SLOTS) {
    const parts = PARTS.filter((p) => p.slot === slot)
    const taken = new Map(parts.map((p) => [p.id, offers.filter((o) => o.id === p.id && o.taken).length / n]))
    const sorted = [...taken.values()].sort((a, b) => a - b)
    const mid = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]! : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2
    const row = parts.map((p) => {
      const t = taken.get(p.id)!
      const hot = t > 2 * mid
      if (hot) over++
      return `${p.id}${p.lean ? `[${p.lean[0]}]` : ''} ${(offers.filter((o) => o.id === p.id).length / n).toFixed(2)} (${t.toFixed(2)})${hot ? '*' : ''}`
    })
    console.log(`  ${slot.padEnd(5)} median ${mid.toFixed(2)}: ${row.join('  ')}`)
  }
  console.log(`  no part picked > 2x its slot's median: ${pass(over === 0)}${over ? ` (${over} over)` : ''}`)

  console.log('\noffered a run, slot x lean (>= 0.5 each):')
  let thin = 0
  for (const slot of SLOTS) {
    const row = (['close', 'marksman'] as const).map((lean) => {
      const k = offers.filter((o) => { const p = byId(o.id); return p.slot === slot && p.lean === lean }).length / n
      if (k < 0.5) thin++
      return `${lean} ${k.toFixed(2)}`
    })
    console.log(`  ${slot.padEnd(5)} ${row.join('  ')}`)
  }
  console.log(`  every slot x lean >= 0.5: ${pass(thin === 0)}`)
  process.exit(0)
}

// --- the report ---
const runs: RunOut[] = []
const wallAt: number[] = []
for (let i = 0; i < RUNS; i++) {
  runs.push(run('build'))
  if (POOL === 'career' && wallAt.length === 0 && career.length === PARTS.length) wallAt.push(i + 1)
}

const pct = (n: number) => `${((100 * n) / RUNS).toFixed(0).padStart(3)}%`
const per = (n: number) => (n / RUNS).toFixed(2).padStart(5)
const count = (f: (r: RunOut) => boolean) => runs.filter(f).length

console.log(`dropsim: ${RUNS} runs, seed ${SEED}, build ${BUILD} (need ${NEED}), pool ${POOL}, crates ${CRATES}, plenty ${PLENTY}`)
console.log(`levels: tools/levels.json, ${census.n} per depth, road ${census.route}, build ${census.build}\n`)

console.log('all four slots first full, by the end of depth (cumulative):')
console.log('  ' + DEPTHS.map((d) => `d${d.depth} ${pct(count((r) => r.fullAt !== null && r.fullAt <= d.depth))}`).join('  '))
console.log(`  entering the Assembler (by the end of d2): ${pct(count((r) => r.fullAt !== null && r.fullAt <= 2))}`)
console.log(`  parts on Still entering the Assembler: ${[1, 2, 3, 4].map((n) => `${n} ${pct(count((r) => r.wornIn === n))}`).join('  ')}`)
console.log(`  the Assembler's second pick taken: ${pct(count((r) => r.second))}\n`)

console.log(`the target build worn (${NEED}+ of its parts):`)
console.log(`  after the Assembler's gift ${pct(count((r) => r.atAssembler >= NEED))}   at the Arbiter ${pct(count((r) => r.atArbiter >= NEED))}   at the end ${pct(count((r) => r.atEnd >= NEED))}\n`)

const all = runs.flatMap((r) => r.offers)
const tags: Tag[] = ['kill', 'crate', 'elite', 'boss', 'exit', 'plenty', 'gift']
console.log(`offers per run: ${per(all.length)}  (${tags.map((t) => `${t} ${per(all.filter((o) => o.tag === t).length).trim()}`).join(', ')})`)
console.log(`  for a filled slot (a real choice): ${per(all.filter((o) => o.filled).length)}   of those taken: ${per(all.filter((o) => o.filled && o.taken).length)}`)
const picks = all.filter((o) => o.tag === 'exit' || o.tag === 'plenty' || o.tag === 'gift')
console.log(`  on pedestals: ${per(picks.length)}   taken: ${per(picks.filter((o) => o.taken).length)}   for an empty slot: ${per(picks.filter((o) => !o.filled).length)}`)
console.log(`  unfound parts offered: ${per(all.filter((o) => o.unfound).length)} a run, in ${pct(count((r) => r.offers.some((o) => o.unfound)))} of runs`)
if (POOL === 'career') {
  console.log(`  after ${RUNS} runs, ${career.length} of ${PARTS.length} found${wallAt[0] ? ` (all of them by run ${wallAt[0]})` : ''}; a part is found only once he takes one`)
}

console.log('\nper part, a run: offered (taken)')
for (const slot of SLOTS) {
  const row = PARTS.filter((p) => p.slot === slot).map((p) => {
    const os = all.filter((o) => o.id === p.id)
    return `${p.id} ${per(os.length).trim()} (${per(os.filter((o) => o.taken).length).trim()})`
  })
  console.log(`  ${slot.padEnd(5)} ${row.join('  ')}`)
}
