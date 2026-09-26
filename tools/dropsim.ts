/**
 * The drop simulator: N seeded runs through the game's own drop code (src/drops.ts, src/pool.ts,
 * src/abilities.ts), so drop odds are tuned by script, not by the owner's runs.
 *
 *   npx tsx tools/dropsim.ts
 *   npx tsx tools/dropsim.ts --runs 20000 --seed 1 --build random --need 3 --pool full --crates 0.25 --plenty 1
 *
 * --build   burner | cover | control | duel | random (one of the four each run) | a list of part ids
 * --need    how many of the build must be worn for it to count as formed (default 3)
 * --pool    full (every part found, the balancer's case) | starter (each run from the starter
 *           twelve) | career (starts from the twelve; what a run takes stays found for the next)
 * --crates  the share of a level's crates and barrels he smashes (a guess: nothing logs it yet)
 * --plenty  the chance he takes a Plenty shrine's bargain when the level has one
 *
 * A run is depths 1-6 of road II. A crawl depth is one of the real levels in tools/levels.json
 * (refresh it with the dev hook __census when the level generator changes); every pack is killed,
 * each kill rolls the real dropChance, the elite's kill owes the 'elite' drop, a smashed crate
 * rolls LOOT.crateParts, and a kill's or crate's part may be the empty-slot fill. Depths 3 and 6
 * are the bosses: one blue and one gold, never the same slot. Every drop is offered (he walks over
 * all of them); what he leaves lies on the floor, out of the draw, until the level ends. The
 * thief is left out: a caught thief gives the part back.
 *
 * The player: takes anything for an empty slot; otherwise takes a part of the target build if
 * the one it replaces isn't in the build; leaves everything else.
 */
import { PARTS, byId, type AbilityDef } from '../src/abilities'
import { dropChance, fillEmpty, KILL_WEIGHT, LOOT, rollPart, type DropSource } from '../src/drops'
import { facingOutWhites, markFound, startPart, STARTER_POOL, type PoolView } from '../src/pool'
import type { Archetype } from '../src/combat'
import type { Save } from '../src/save'
import type { SlotName } from '../src/still'
import census from './levels.json' with { type: 'json' }

declare const process: { argv: string[] }

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
type Tag = 'kill' | 'fill' | 'crate' | 'elite' | 'plenty' | 'boss'
interface RunOut {
  fullAt: number | null
  /** Build parts worn: after the Assembler's gift, before the Arbiter's gift, at the end. */
  atAssembler: number; atArbiter: number; atEnd: number
  offers: { id: string; tag: Tag; unfound: boolean; filled: boolean; taken: boolean }[]
}

const career: string[] = [...STARTER_POOL]

function run(): RunOut {
  const found = POOL === 'full' ? PARTS.map((p) => p.id) : POOL === 'career' ? career : [...STARTER_POOL]
  const save = { found, turned: [], hook: null } as unknown as Save
  const T = target()
  const worn: Partial<Record<SlotName, AbilityDef>> = {}
  const first = byId(startPart(save))
  worn[first.slot] = first
  const out: RunOut = { fullAt: null, atAssembler: 0, atArbiter: 0, atEnd: 0, offers: [] }
  const score = () => SLOTS.filter((sl) => worn[sl] && T.has(worn[sl]!.id)).length
  let floor: AbilityDef[] = []
  let depth = 1

  const taken = () => [...(Object.values(worn) as AbilityDef[]), ...floor]
  const view = (): PoolView => ({ found: new Set(save.found), turned: new Set(), depth })
  const empty = () => SLOTS.filter((sl) => !worn[sl])

  /** He walks over it: the card, and the player's choice. */
  const offer = (def: AbilityDef | null, tag: Tag) => {
    if (!def) return
    const cur = worn[def.slot]
    const take = !cur || (T.has(def.id) && !T.has(cur.id))
    out.offers.push({ id: def.id, tag, unfound: !save.found.includes(def.id), filled: !!cur, taken: take })
    if (!take) return floor.push(def)
    markFound(save, def.id)
    // the part he gave up lands at his feet, and lies there with the rest
    if (cur) floor.push(cur)
    worn[def.slot] = def
  }
  /** A kill's or a crate's part: the empty-slot fill first, as the game does. */
  const plain = (from: Archetype, source: DropSource) => {
    const fill = fillEmpty(taken(), empty(), () => facingOutWhites(save))
    offer(fill ?? rollPart(from, taken(), source, view()), fill ? 'fill' : source === 'kill' ? 'kill' : 'crate')
  }
  const boss = () => {
    const blue = rollPart('boss', taken(), 'boss-blue', view())
    offer(blue, 'boss')
    offer(rollPart('boss', blue ? [...taken(), blue] : taken(), 'boss-gold', view(), blue?.slot), 'boss')
  }

  for (const d of DEPTHS) {
    depth = d.depth
    floor = []
    if (d.boss) {
      if (depth === 6) out.atArbiter = score()
      boss()
      if (depth === 3) out.atAssembler = score()
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
        events.splice(Math.floor(Math.random() * (events.length + 1)), 0, () => offer(rollPart('chaser', taken(), 'plenty', view()), 'plenty'))
      }
      for (const e of events) e()
    }
    if (out.fullAt === null && empty().length === 0) out.fullAt = depth
  }
  out.atEnd = score()
  return out
}

// --- the report ---
const runs: RunOut[] = []
const wallAt: number[] = []
for (let i = 0; i < RUNS; i++) {
  runs.push(run())
  if (POOL === 'career' && wallAt.length === 0 && career.length === PARTS.length) wallAt.push(i + 1)
}

const pct = (n: number) => `${((100 * n) / RUNS).toFixed(0).padStart(3)}%`
const per = (n: number) => (n / RUNS).toFixed(2).padStart(5)
const count = (f: (r: RunOut) => boolean) => runs.filter(f).length

console.log(`dropsim: ${RUNS} runs, seed ${SEED}, build ${BUILD} (need ${NEED}), pool ${POOL}, crates ${CRATES}, plenty ${PLENTY}`)
console.log(`levels: tools/levels.json, ${census.n} per depth, road ${census.route}, build ${census.build}\n`)

console.log('all four slots first full, by the end of depth (cumulative):')
console.log('  ' + DEPTHS.map((d) => `d${d.depth} ${pct(count((r) => r.fullAt !== null && r.fullAt <= d.depth))}`).join('  '))
console.log(`  entering the Assembler (by the end of d2): ${pct(count((r) => r.fullAt !== null && r.fullAt <= 2))}\n`)

console.log(`the target build worn (${NEED}+ of its parts):`)
console.log(`  after the Assembler's gift ${pct(count((r) => r.atAssembler >= NEED))}   at the Arbiter ${pct(count((r) => r.atArbiter >= NEED))}   at the end ${pct(count((r) => r.atEnd >= NEED))}\n`)

const all = runs.flatMap((r) => r.offers)
const tags: Tag[] = ['kill', 'fill', 'crate', 'elite', 'plenty', 'boss']
console.log(`offers per run: ${per(all.length)}  (${tags.map((t) => `${t} ${per(all.filter((o) => o.tag === t).length).trim()}`).join(', ')})`)
console.log(`  for a filled slot (a real choice): ${per(all.filter((o) => o.filled).length)}   of those taken: ${per(all.filter((o) => o.filled && o.taken).length)}`)
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
