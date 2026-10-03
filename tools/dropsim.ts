/**
 * The drop simulator: N seeded runs through the game's own drop code (src/drops.ts, src/pool.ts,
 * src/abilities.ts, src/temper.ts), so drop odds are tuned by script, not by the owner's runs.
 *
 *   npx tsx tools/dropsim.ts
 *   npx tsx tools/dropsim.ts --runs 20000 --seed 1 --build random --need 3 --pool full --crates 0.25 --plenty 1 --second want
 *   npx tsx tools/dropsim.ts --vs "$HOME/Downloads/still-playtest-2026-10-01 (1).json"     (his last two runs, side by side)
 *
 * 2 Oct (build layer B0): this models what SHIPS. Until then it modelled the 6-depth game with pedestals on.
 *   - 9 depths, bosses at 3, 6 and 9 (tools/levels.json is road II's census, tools/levels-III.json road III's; both are 9 depths, 40 levels a depth,
 *     made with the DEV hook `__census(40, route)`: refresh them when the level generator changes). `--road II|III|mix` (default II, the road his runs 23-24 took).
 *   - Pedestals are as the game has them: PEDESTALS_ON from src/drops.ts (off since 28 Sep). Off: no exit pedestals, Plenty drops one floor part, and
 *     EVERY boss (the Assembler at 3 and 6, the last at 9) leaves one blue and one gold on the floor, never for the same slot (main.ts bossDown).
 *     `--pedestals on` brings back the old structure (three at each crawl exit, three at Plenty, the gift after a boss before the last), for history.
 *   - Floor parts are for any slot, empty ones too (live since 28 Sep), not only the slots he wears.
 *   - An ordinary kill pays x TEMPER.killPayout (0.4 live; main.ts maybeDrop, temper on by default): the owed drops (an elite, a side room's last kill) are as ever.
 *     `--kills 1` for the old payout.
 *   - Melting (temper.ts, main.ts meltPart): a floor part he doesn't take, for a slot he wears, is melted into the part there (rank I -> II -> III, then, at III, a
 *     mastery up to MASTERY_MAX) and leaves the floor. That is "an unwanted duplicate counts as a melt". `--melt 0` leaves them lying instead.
 *     A take over a part at II or III lands at TEMPER.swapRank and the old part is used up; over a part at I the old part lands on the floor.
 *   - The leanings' modes (--lean) stay, riders gone (cut 28 Sep, code removed 2 Oct): a part is worth 1 of his lean, 0 off it; formed = 3+ parts of his lean
 *     worn before the last boss. They need `--pedestals on` to mean what they did.
 *   - `--core wake|ram` (B5): the hunt, below.
 *
 * --build   burner | cover | control | duel | random (one of the four each run) | a list of part ids
 * --need    how many of the build must be worn for it to count as formed (default 3)
 * --pool    full (every part found, the balancer's case) | starter (each run from the starter
 *           twelve) | career (starts from the twelve; what a run takes stays found for the next)
 * --crates  the share of a level's crates and barrels he smashes (a guess: nothing logs it yet)
 * --plenty  the chance he uses a Plenty shrine when the level has one
 * --second  with pedestals on, the gift's second pick (+4 strain, kept): want (when a pedestal left helps) |
 *           build (only for a part of the build) | never
 * --lean    close | marksman (a committed chooser of that lean) | random (a random picker) | all (the
 *           three, --runs each, and the leanings' pass lines); replaces --build (design/leanings/PITCHES.md)
 * --side    the share of side rooms he fights (0.5)
 * --whim    the share of other offers he takes anyway (0.08; with --side, calibrated to his runs 23-24: they are the only knobs fitted to his play)
 * --vs      a playtest export: print its last --vs-last (default 2) runs' offers, takes and melts under the simulator's
 *
 * A crawl depth is one of the real levels in the census; every pack is killed, each kill rolls the real dropChance, the elite's kill owes the 'elite' drop, a
 * smashed crate rolls LOOT.crateParts. Every drop is offered (he walks over all of them); what he leaves lies on the floor, out of the draw, until the level
 * ends. The thief is left out: a caught thief gives the part back.
 *
 * The player: takes a part for an empty slot, and a part of the target build over one that isn't in it, and (--whim) a few others on a whim; the rest he melts
 * (or leaves). He fights every main pack and (--side) half the side rooms. With --lean, a
 * committed chooser takes a part worth more of his lean than the one it replaces; the random picker takes half. With pedestals on, at a set, the first of: a
 * build part for an empty slot, a build part over one that isn't, anything for an empty slot; else he leaves all three.
 *
 * The pass line it was fixed to (B0): offers and takes a run within 25% of his runs 23-24 (`--vs`).
 *
 * --core wake|ram (B5, design/buildlayer/BUILD.md §2.9, 3-balancer.md): the same run with that core worn from the start and the hunt on: the game's own `rollForCore` at every elite, Plenty and
 *   boss-blue drop (FILTER from src/cores.ts: share 0.5, keyWeight 1, never gold, kills or crates), the core's own parts read from the real defs' `fits`, its two keystones, and the upgrades
 *   (a melt past III, from UPGRADE_FROM = depth 7, at most UPGRADE_MAX). Two choosers, runs each: committed (a spender 4 > the bridge 3 > a shaper 2 > a guard 1.5 > plain 1; takes a part worth
 *   more than the one worn, plus --whim; a keystone into an empty socket always, else half) and random (an empty slot always, else half; a keystone half the time). The bridge is a spender
 *   with a `k` under the core's K (Scrap Cleaver); "own" is a spender that is not the bridge. Formed by the Assembler: 2+ of the core's parts worn walking into the first boss, one a spender.
 *   The report, per core:
 *     formed d3, committed (>= 70% pass; and with an own spender), random, random / committed (<= 0.6 pass);
 *     own keystone seen by d6, taken per seen; a part, keystone or upgrade taken after d6 (reported); keystones left on the floor (dropped and not taken: the log counts these from the drop
 *     records, `fit: 'key'` with end 'left'); upgrades and when; the fit part's take / offer against a plain one's.
 */
import { PARTS, byId, type AbilityDef } from '../src/abilities'
import { dropChance, emptySlots, KILL_WEIGHT, LOOT, PEDESTALS_ON, rollForCore, rollPart, rollPicks, type DropSource, type PickKind } from '../src/drops'
import { CORES, FILTER, KEYSTONES, UPGRADE_FROM, UPGRADE_MAX, fitOf, type CoreId, type KeystoneDef, type KeystoneId } from '../src/cores'
import { MASTERY_FORM, MASTERY_MAX } from '../src/mastery'
import { markFound, startPart, STARTER_POOL, type PoolView } from '../src/pool'
import { TEMPER } from '../src/temper'
import type { Archetype } from '../src/combat'
import type { Save } from '../src/save'
import type { SlotName } from '../src/still'
import { readFileSync } from 'node:fs'
import census2 from './levels.json' with { type: 'json' }
import census3 from './levels-III.json' with { type: 'json' }


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
const PEDS = arg('pedestals', PEDESTALS_ON ? 'on' : 'off') === 'on'
const KILLS = Number(arg('kills', String(TEMPER.killPayout)))
const MELT = Number(arg('melt', '1')) > 0
const ROAD = arg('road', 'II') as 'II' | 'III' | 'mix'
/** The share of a level's side rooms he fights. 0.5: his logs show 5 fights a crawl depth of the census's 6.4 packs (4 main, 2.4 side), runs 23-24. */
const SIDE = Number(arg('side', '0.5'))
/** The share of the offers he has no reason to take (not for an empty slot, not the build's) that he takes anyway: 0.08, so takes a run match his 8 in runs 23-24. */
const WHIM = Number(arg('whim', '0.08'))

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
/**
 * The leanings (cut from the part defs in B1, 2 Oct): `--lean` keeps working for history, reading a part's lean from mastery.ts's MASTERY_FORM
 * (hand = close, eye = marksman, none = neither), which is what the tags said. The pedestal match (--match) went with them.
 */
type Lean = 'close' | 'marksman'
const leanOfPart = (d: AbilityDef): Lean | undefined => (MASTERY_FORM[d.id] === 'hand' ? 'close' : MASTERY_FORM[d.id] === 'eye' ? 'marksman' : undefined)
const LEAN = arg('lean', '') as '' | Lean | 'random' | 'all'
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
type Depth = { depth: number; boss: boolean; levels: Level[] }
const depthsOf = (census: typeof census2): Depth[] => Object.entries(census.depths).map(([d, v]) => ({
  depth: Number(d), boss: v.boss,
  levels: v.levels.map((l): Level => ({
    crates: l.crates, plenty: l.plenty,
    packs: l.packs.map((p) => {
      const [room, kinds] = p.split(': ') as [string, string]
      return { side: room.startsWith('side'), elite: room.endsWith('*'), kinds: kinds.split(' ') as Archetype[] }
    }),
  })),
}))
const ROADS: Record<'II' | 'III', Depth[]> = { II: depthsOf(census2), III: depthsOf(census3 as typeof census2) }
const RUN_DEPTHS = census2.runDepths

const SLOTS: SlotName[] = ['head', 'torso', 'arms', 'legs']
const shuffle = <T>(a: T[]) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

// --- one run ---
type Tag = 'kill' | 'crate' | 'elite' | 'plenty' | 'boss' | `ped-${PickKind}`
interface RunOut {
  fullAt: number | null
  /** Build parts worn after each boss's drops, by depth. */
  atBoss: Record<number, number>
  /** Build parts worn at the end (after the last boss's drops). */
  atEnd: number
  /** Parts on Still entering the first boss. */
  wornIn: number
  /** The first boss's gift's second pick was taken (pedestals on only). */
  second: boolean
  offers: { id: string; tag: Tag; depth: number; unfound: boolean; filled: boolean; taken: boolean; melted: boolean }[]
  /** Melts: floor parts melted into a worn part (rank or mastery). */
  melts: number
  /** --lean: his lean formed before the last boss (3+ of its parts worn). */
  formed: boolean
  /** Pedestal sets. */
  sets: number
}

const career: string[] = [...STARTER_POOL]

function run(who: Chooser): RunOut {
  const found = POOL === 'full' ? PARTS.map((p) => p.id) : POOL === 'career' ? career : [...STARTER_POOL]
  const save = { found, turned: [], hook: null } as unknown as Save
  const T = target()
  const worn: Partial<Record<SlotName, AbilityDef>> = {}
  const ranks: Partial<Record<SlotName, number>> = {}
  let masteries = 0
  const first = byId(startPart(save))
  worn[first.slot] = first
  const out: RunOut = { fullAt: null, atBoss: {}, atEnd: 0, wornIn: 0, second: false, offers: [], melts: 0, formed: false, sets: 0 }
  /** A committed chooser's worth of a part: 1 his lean, 0 off it. */
  const value = (def: AbilityDef) => (who !== 'build' && who !== 'random' && leanOfPart(def) === who ? 1 : 0)
  const formedAs = (lean: Lean) => SLOTS.map((sl) => worn[sl]).filter((p): p is AbilityDef => !!p && leanOfPart(p) === lean).length >= 3
  const score = () => SLOTS.filter((sl) => worn[sl] && T.has(worn[sl]!.id)).length
  let floor: AbilityDef[] = []
  let depth = 1

  const taken = () => [...(Object.values(worn) as AbilityDef[]), ...floor]
  const view = (): PoolView => ({ found: new Set(save.found), turned: new Set(), depth })
  const wornNow = () => Object.values(worn) as AbilityDef[]
  const empty = () => emptySlots(wornNow())

  const wear = (def: AbilityDef) => {
    markFound(save, def.id)
    const cur = worn[def.slot]
    if ((ranks[def.slot] ?? 1) >= TEMPER.swapRank) {
      // a swap from a tempered part: the part given up melts into the new one, which lands at II (main.ts takePart)
      ranks[def.slot] = TEMPER.swapRank
    } else {
      // from a part at I, or an empty slot: the new one starts at I, and the part he gave up lands at his feet
      delete ranks[def.slot]
      if (cur) floor.push(cur)
    }
    worn[def.slot] = def
  }
  /** Melt a floor part into the worn one in its slot: a rank, or at III a mastery. False when nothing can take it. */
  const melt = (def: AbilityDef): boolean => {
    if (!worn[def.slot]) return false
    const rank = (ranks[def.slot] ?? 1) + 1
    if (rank > TEMPER.maxRank) {
      if (masteries >= MASTERY_MAX) return false
      masteries++
    } else ranks[def.slot] = rank
    markFound(save, def.id)
    out.melts++
    return true
  }
  /** He walks over it: the card, and the player's choice. */
  const offer = (def: AbilityDef | null, tag: Tag) => {
    if (!def) return
    const cur = worn[def.slot]
    const take = !cur || (who === 'build' ? (T.has(def.id) && !T.has(cur.id)) || Math.random() < WHIM : who === 'random' ? Math.random() < 0.5 : value(def) > value(cur))
    const rec = { id: def.id, tag, depth, unfound: !save.found.includes(def.id), filled: !!cur, taken: take, melted: false }
    out.offers.push(rec)
    if (take) wear(def)
    else if (MELT && melt(def)) rec.melted = true
    else floor.push(def)
  }
  /** A floor part, for any slot. */
  const plain = (from: Archetype, source: DropSource) => offer(rollPart(from, taken(), source, view()), source === 'kill' ? 'kill' : 'crate')
  /** How much he wants a pedestal's part: 3 a build part for an empty slot, 2 over a part not in the build, 1 anything for an empty slot. */
  const want = (def: AbilityDef) => {
    const cur = worn[def.slot]
    if (who === 'random') return 1
    if (who !== 'build') return cur ? value(def) - value(cur) : value(def) > 0 ? 3 + value(def) : 1
    if (T.has(def.id) && (!cur || !T.has(cur.id))) return cur ? 2 : 3
    return cur ? 0 : 1
  }
  /** A set of pedestals (--pedestals on): he takes the one he wants most (up to `picks`, each while it's still wanted enough); the rest go back to the wall. */
  const pedestals = (kind: PickKind, picks = 1) => {
    const set = rollPicks(kind, wornNow(), taken(), view())
    out.sets++
    const recs = set.map((def) => ({ id: def.id, tag: `ped-${kind}` as Tag, depth, unfound: !save.found.includes(def.id), filled: !!worn[def.slot], taken: false, melted: false }))
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
    if (kind === 'gift' && depth === firstBoss) out.second = took > 1
  }
  /** What a boss leaves on the floor: one blue and one gold, never for the same slot (main.ts bossDown). */
  const bossFloor = () => {
    const blue = rollPart('boss', taken(), 'boss-blue', view())
    offer(blue, 'boss')
    offer(rollPart('boss', blue ? [...taken(), blue] : taken(), 'boss-gold', view(), blue ? [blue.slot] : []), 'boss')
  }

  const road = ROAD === 'mix' ? (Math.random() < 0.5 ? 'II' : 'III') : ROAD
  const depths = ROADS[road]
  const firstBoss = depths.find((d) => d.boss)!.depth
  for (const d of depths) {
    depth = d.depth
    floor = []
    if (d.boss) {
      if (depth === firstBoss) out.wornIn = wornNow().length
      if (depth === RUN_DEPTHS) out.formed = who === 'random' ? formedAs('close') || formedAs('marksman') : who !== 'build' && formedAs(who)
      // with pedestals on, a boss with more of the day to come gifts a pick; the last one, and every boss with them off, leaves its pair on the floor
      if (PEDS && depth < RUN_DEPTHS) pedestals('gift', 2)
      else bossFloor()
      out.atBoss[depth] = score()
    } else {
      const level = d.levels[Math.floor(Math.random() * d.levels.length)]!
      type Event = () => void
      const events: Event[] = level.packs.filter((p) => !p.side || Math.random() < SIDE).map((p) => () => {
        const pack = { weight: p.kinds.reduce((a, k) => a + KILL_WEIGHT[k], 0), side: p.side, dropped: false, members: [...p.kinds] }
        // the first listed member leads: it's the elite
        const order = shuffle(p.kinds.map((kind, i) => ({ kind, elite: p.elite && i === 0 })))
        for (const m of order) {
          pack.members.pop()
          // temper on: fewer, louder drops; an elite's and a side room's owed drop are as ever (main.ts maybeDrop)
          const chance = dropChance(pack, m.elite, false, KILL_WEIGHT[m.kind])
          if (Math.random() >= (chance < 1 ? chance * KILLS : chance)) continue
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
        events.splice(Math.floor(Math.random() * (events.length + 1)), 0,
          PEDS ? () => pedestals('plenty') : () => offer(rollPart('chaser', taken(), 'plenty', view()), 'plenty'))
      }
      for (const e of events) e()
      if (PEDS) pedestals('exit')
    }
    if (out.fullAt === null && empty().length === 0) out.fullAt = depth
  }
  out.atEnd = score()
  return out
}

// --- his logged runs, for --vs ---
interface LogDrop { depth: number; id: string; source: string; offered: boolean; end: string | null }
interface LogEntry { id: string; key: string; route?: string; runDepths?: number; depth: number; end: string | null; drops: LogDrop[] }
/** Offers, takes and melts of one logged run: its drop records without the swaps (a part he gave up, never a drop). Entries of one run id (a resume writes a second) are merged. */
function logged(path: string, last: number) {
  const entries = JSON.parse(readFileSync(path, 'utf8')) as LogEntry[]
  const ids = [...new Set(entries.map((e) => e.id))]
  return ids.slice(-last).map((id) => {
    const es = entries.filter((e) => e.id === id)
    const drops = es.flatMap((e) => e.drops).filter((r) => r.source !== 'swap')
    const lastEntry = es[es.length - 1]!
    return {
      id, entries: es.length, depths: lastEntry.depth, road: lastEntry.route ?? '?',
      offers: drops.filter((r) => r.offered).length, takes: drops.filter((r) => r.end === 'taken').length, melts: drops.filter((r) => r.end === 'melted').length,
      left: drops.filter((r) => r.offered && (r.end === 'left' || r.end === null)).length, missed: drops.filter((r) => !r.offered).length,
    }
  })
}

// --- the hunt: --core wake|ram|graze (B5; graze N1) ---
const CORE_ARG = arg('core', '')
if (CORE_ARG) {
  if (CORE_ARG !== 'wake' && CORE_ARG !== 'ram' && CORE_ARG !== 'graze') throw new Error(`--core wants wake, ram or graze, not ${CORE_ARG}`)
  const core: CoreId = CORE_ARG
  const K = CORES[core].K
  /** A part's job for this core, from the real defs: spend (own), bridge (a spender whose own k is under the core's K), shape, guard; null when plain. */
  type Role = 'spend' | 'bridge' | 'shape' | 'guard'
  const roleOf = (d: AbilityDef | undefined): Role | null => {
    const f = d ? fitOf(d, core) : null
    return !f ? null : f.role === 'spend' ? (f.k !== undefined && f.k < K ? 'bridge' : 'spend') : f.role
  }
  const WORTH: Record<Role, number> = { spend: 4, bridge: 3, shape: 2, guard: 1.5 }
  const ownKeys = (Object.values(KEYSTONES) as KeystoneDef[]).filter((k) => k.core === core).map((k) => k.id)
  interface Out {
    formed: boolean; formedOwn: boolean; keySeenBy6: boolean; keyOffers: number; keyTook: number; keyDropped: number; keyLeft: number; keyGivenUp: number; late: boolean; lateWhat: Set<string>
    upAt: number[]; fitOff: number; fitTook: number; plainOff: number; plainTook: number; filtered: number; offers: number; fitsAtEnd: number; ownSpenderAt: number | null
  }
  const coreRun = (who: 'committed' | 'random'): Out => {
    const found = POOL === 'full' ? PARTS.map((p) => p.id) : POOL === 'career' ? career : [...STARTER_POOL]
    const save = { found, turned: [], hook: null } as unknown as Save
    const worn: Partial<Record<SlotName, AbilityDef>> = {}
    const ranks: Partial<Record<SlotName, number>> = {}
    const first = byId(startPart(save))
    worn[first.slot] = first
    let socket: KeystoneId | null = null
    let upgrades = 0
    let depth = 1
    let floor: AbilityDef[] = []
    let floorKeys: KeystoneId[] = []
    const o: Out = { formed: false, formedOwn: false, keySeenBy6: false, keyOffers: 0, keyTook: 0, keyDropped: 0, keyLeft: 0, keyGivenUp: 0, late: false, lateWhat: new Set(), upAt: [], fitOff: 0, fitTook: 0, plainOff: 0, plainTook: 0, filtered: 0, offers: 0, fitsAtEnd: 0, ownSpenderAt: null }
    const val = (d: AbilityDef | undefined) => { const r = roleOf(d); return !d ? 0 : r ? WORTH[r] : 1 }
    const taken = () => [...(Object.values(worn) as AbilityDef[]), ...floor]
    const view = (): PoolView => ({ found: new Set(save.found), turned: new Set(), depth })
    const lateTake = (what: string) => { if (depth > 6) { o.late = true; o.lateWhat.add(what) } }
    const wear = (d: AbilityDef) => {
      const cur = worn[d.slot]
      if ((ranks[d.slot] ?? 1) >= TEMPER.swapRank) ranks[d.slot] = TEMPER.swapRank
      else { delete ranks[d.slot]; if (cur) floor.push(cur) }
      worn[d.slot] = d
      markFound(save, d.id)
      if (roleOf(d) === 'spend' && o.ownSpenderAt === null) o.ownSpenderAt = depth
    }
    /** A floor part melted into the worn one in its slot: a rank, or, at III, an upgrade (from UPGRADE_FROM, at most UPGRADE_MAX); before that the part stays on the floor. */
    const melt = (d: AbilityDef): boolean => {
      if (!worn[d.slot]) return false
      const r = (ranks[d.slot] ?? 1) + 1
      if (r > TEMPER.maxRank) {
        if (upgrades >= UPGRADE_MAX || depth < UPGRADE_FROM) return false
        upgrades++
        o.upAt.push(depth)
        lateTake('upgrade')
      } else ranks[d.slot] = r
      markFound(save, d.id)
      return true
    }
    const offer = (d: AbilityDef | null, filtered = false) => {
      if (!d) return
      o.offers++
      if (filtered) o.filtered++
      const cur = worn[d.slot]
      const r = roleOf(d)
      if (r) o.fitOff++; else o.plainOff++
      const take = !cur || (who === 'random' ? Math.random() < 0.5 : val(d) > val(cur) || (!r && Math.random() < WHIM) || (!!r && val(d) === val(cur) && Math.random() < WHIM))
      if (take) { if (r) o.fitTook++; else o.plainTook++; wear(d); lateTake('part') } else if (!melt(d)) floor.push(d)
    }
    const offerKey = (k: KeystoneId) => {
      o.keyDropped++
      o.keyOffers++
      o.filtered++
      if (depth <= 6) o.keySeenBy6 = true
      const take = who === 'random' ? Math.random() < 0.5 : socket === null || Math.random() < 0.5
      if (take) {
        if (socket) { floorKeys.push(socket); o.keyGivenUp++ }
        socket = k
        o.keyTook++
        lateTake('keystone')
      } else { floorKeys.push(k); o.keyLeft++ }
    }
    /** main.ts rollMoment: the game's own rollForCore, else rollPart. A keystone comes back as its id. */
    const moment = (src: DropSource, from: Archetype, exclude: SlotName[] = []): { def: AbilityDef; filtered: boolean } | { key: KeystoneId } | null => {
      const hit = rollForCore(core, src, taken(), { socketed: socket, onFloor: floorKeys }, view())
      if (hit) return 'slot' in hit ? { def: hit, filtered: true } : { key: hit.id }
      const def = rollPart(from, taken(), src, view(), exclude)
      return def ? { def, filtered: false } : null
    }
    const give = (m: ReturnType<typeof moment>) => { if (m) { if ('key' in m) offerKey(m.key); else offer(m.def, m.filtered) } }
    const depths = ROADS[ROAD === 'mix' ? 'II' : ROAD]
    const firstBoss = depths.find((d) => d.boss)!.depth
    for (const d of depths) {
      depth = d.depth
      floor = []
      floorKeys = []
      if (d.boss) {
        if (depth === firstBoss) {
          const fs = (Object.values(worn) as AbilityDef[]).filter((p) => roleOf(p))
          o.formed = fs.length >= 2 && fs.some((p) => roleOf(p) === 'spend' || roleOf(p) === 'bridge')
          o.formedOwn = fs.length >= 2 && fs.some((p) => roleOf(p) === 'spend')
        }
        const blue = moment('boss-blue', 'boss')
        give(blue)
        const blueDef = blue && 'def' in blue ? blue.def : null
        offer(rollPart('boss', blueDef ? [...taken(), blueDef] : taken(), 'boss-gold', view(), blueDef ? [blueDef.slot] : []))
        continue
      }
      const level = d.levels[Math.floor(Math.random() * d.levels.length)]!
      const events: (() => void)[] = level.packs.filter((p) => !p.side || Math.random() < SIDE).map((p) => () => {
        const pack = { weight: p.kinds.reduce((a, k) => a + KILL_WEIGHT[k], 0), side: p.side, dropped: false, members: [...p.kinds] }
        for (const m of shuffle(p.kinds.map((kind, i) => ({ kind, elite: p.elite && i === 0 })))) {
          pack.members.pop()
          const chance = dropChance(pack, m.elite, false, KILL_WEIGHT[m.kind])
          if (Math.random() >= (chance < 1 ? chance * KILLS : chance)) continue
          pack.dropped = true
          if (m.elite) give(moment('elite', m.kind)); else offer(rollPart(m.kind, taken(), 'kill', view()))
        }
      })
      for (let i = 0; i < level.crates; i++) if (Math.random() < CRATES) events.splice(Math.floor(Math.random() * (events.length + 1)), 0, () => { if (Math.random() < LOOT.crateParts) offer(rollPart('chaser', taken(), 'crate', view())) })
      if (level.plenty && Math.random() < PLENTY) events.splice(Math.floor(Math.random() * (events.length + 1)), 0, () => give(moment('plenty', 'chaser')))
      for (const e of events) e()
    }
    o.fitsAtEnd = (Object.values(worn) as AbilityDef[]).filter((p) => roleOf(p)).length
    return o
  }
  const pc = (n: number, of = RUNS) => `${((100 * n) / of).toFixed(0)}%`
  const dec = (n: number, of = RUNS) => (n / of).toFixed(2)
  const results = { committed: Array.from({ length: RUNS }, () => coreRun('committed')), random: Array.from({ length: RUNS }, () => coreRun('random')) }
  const cnt = (rs: Out[], f: (r: Out) => boolean) => rs.filter(f).length
  const sum = (rs: Out[], f: (r: Out) => number) => rs.reduce((a, r) => a + f(r), 0)
  const c = results.committed
  const r = results.random
  const formedC = cnt(c, (x) => x.formed) / RUNS
  const formedR = cnt(r, (x) => x.formed) / RUNS
  const ratio = formedR / formedC
  const upMed = (a: number[]) => (a.length ? a.sort((x, y) => x - y)[Math.floor(a.length / 2)] : '-')
  const up1 = c.filter((x) => x.upAt.length).map((x) => x.upAt[0]!)
  const up2 = c.filter((x) => x.upAt.length > 1).map((x) => x.upAt[1]!)
  const pass = (ok: boolean) => (ok ? 'pass' : 'FAIL')
  const partsOf = [...PARTS.filter((p) => fitOf(p, core))].map((p) => `${p.id}${roleOf(p) === 'bridge' ? ' (bridge)' : ''}`)
  console.log(`dropsim --core ${core}: ${RUNS} runs each (committed, random), seed ${SEED}, pool ${POOL}, road ${ROAD}, crates ${CRATES}, plenty ${PLENTY}, side ${SIDE}, whim ${WHIM}; the hunt: FILTER share ${FILTER.share}, keyWeight ${FILTER.keyWeight} on ${FILTER.sources.join(', ')}; upgrades from d${UPGRADE_FROM}, at most ${UPGRADE_MAX}`)
  console.log(`  ${core}'s parts (from the defs' fits): ${partsOf.join(', ')}; keystones ${ownKeys.join(', ')}; K ${K}\n`)
  console.log(`formed by the Assembler (d${depthsOfFirstBoss()}: 2+ of ${core}'s parts worn, one a spender)`)
  const p1 = (n: number) => `${((100 * n) / RUNS).toFixed(1)}%`
  console.log(`  committed ${p1(cnt(c, (x) => x.formed))} (with an own spender, not only the bridge: ${pc(cnt(c, (x) => x.formedOwn))})   line >= 70%: ${pass(formedC >= 0.7)}`)
  console.log(`  random    ${p1(cnt(r, (x) => x.formed))} (own spender ${pc(cnt(r, (x) => x.formedOwn))})   random / committed ${ratio.toFixed(2)}   line <= 0.6: ${pass(ratio <= 0.6)}`)
  console.log(`own keystone, committed: seen by d6 ${pc(cnt(c, (x) => x.keySeenBy6))} of runs (reported); offers ${dec(sum(c, (x) => x.keyOffers))} a run, taken ${pc(sum(c, (x) => x.keyTook), sum(c, (x) => x.keyOffers))} of them; socketed at the end ${pc(cnt(c, (x) => x.keyTook > 0))} of runs`)
  console.log(`keystones left on the floor, committed: ${dec(sum(c, (x) => x.keyLeft))} a run (dropped ${dec(sum(c, (x) => x.keyDropped))}, taken ${dec(sum(c, (x) => x.keyTook))}, given up for another ${dec(sum(c, (x) => x.keyGivenUp))}); ${pc(sum(c, (x) => x.keyLeft), sum(c, (x) => x.keyDropped))} of what dropped; random: ${dec(sum(r, (x) => x.keyLeft))} a run`)
  console.log(`a part taken after d6, committed: ${pc(cnt(c, (x) => x.lateWhat.has('part')))} of runs (reported; any of part, keystone, upgrade: ${pc(cnt(c, (x) => x.late))}; keystone ${pc(cnt(c, (x) => x.lateWhat.has('keystone')))}, upgrade ${pc(cnt(c, (x) => x.lateWhat.has('upgrade')))})`)
  console.log(`upgrades, committed: first by median d${upMed(up1)} (${pc(up1.length)} of runs), second by d${upMed(up2)} (${pc(up2.length)}); the 3-balancer's own: both at d7 in 99%`)
  console.log(`the fit: ${core}'s parts taken / offered ${pc(sum(c, (x) => x.fitTook), sum(c, (x) => x.fitOff))} against plain ${pc(sum(c, (x) => x.plainTook), sum(c, (x) => x.plainOff))} (committed); offers a run ${dec(sum(c, (x) => x.offers))}, filtered ${dec(sum(c, (x) => x.filtered))} a run, the core's parts worn at the end ${dec(sum(c, (x) => x.fitsAtEnd))}`)
  process.exit(0)
}
function depthsOfFirstBoss() { return ROADS.II.find((d) => d.boss)!.depth }

// --- the leanings' report ---
if (LEAN) {
  const whos: Chooser[] = LEAN === 'all' ? ['close', 'marksman', 'random'] : [LEAN]
  const by = new Map(whos.map((w) => [w, Array.from({ length: RUNS }, () => run(w))]))
  const pct = (n: number, of: number) => `${((100 * n) / of).toFixed(0)}%`
  console.log(`dropsim --lean ${LEAN}: ${RUNS} runs each, seed ${SEED}, pool ${POOL}, crates ${CRATES}, plenty ${PLENTY}, second ${SECOND}, pedestals ${PEDS ? 'on' : 'off'}\n`)
  const formed = new Map([...by].map(([w, rs]) => [w, rs.filter((r) => r.formed).length / RUNS]))
  for (const [w, f] of formed) console.log(`formed before the last boss (3+ own tags), ${w}: ${pct(f, 1)}`)
  const pass = (ok: boolean) => (ok ? 'pass' : 'FAIL')
  if (formed.has('close') && formed.has('marksman')) {
    const c = formed.get('close')!
    const m = formed.get('marksman')!
    console.log(`  committed >= 60% each: ${pass(c >= 0.6 && m >= 0.6)}   within 10 points: ${pass(Math.abs(c - m) <= 0.1)} (${(100 * Math.abs(c - m)).toFixed(0)})`)
  }
  if (formed.has('random')) console.log(`  random <= 30%: ${pass(formed.get('random')! <= 0.3)}`)

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
      return `${p.id}${leanOfPart(p) ? `[${leanOfPart(p)![0]}]` : ''} ${(offers.filter((o) => o.id === p.id).length / n).toFixed(2)} (${t.toFixed(2)})${hot ? '*' : ''}`
    })
    console.log(`  ${slot.padEnd(5)} median ${mid.toFixed(2)}: ${row.join('  ')}`)
  }
  console.log(`  no part picked > 2x its slot's median: ${pass(over === 0)}${over ? ` (${over} over)` : ''}`)

  console.log('\noffered a run, slot x lean (>= 0.5 each):')
  let thin = 0
  for (const slot of SLOTS) {
    const row = (['close', 'marksman'] as const).map((lean) => {
      const k = offers.filter((o) => { const p = byId(o.id); return p.slot === slot && leanOfPart(p) === lean }).length / n
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
const depthList = ROADS.II.map((d) => d.depth)
const bossDepths = ROADS.II.filter((d) => d.boss).map((d) => d.depth)

console.log(`dropsim: ${RUNS} runs, seed ${SEED}, build ${BUILD} (need ${NEED}), pool ${POOL}, crates ${CRATES}, plenty ${PLENTY}`)
console.log(`  ${RUN_DEPTHS} depths, bosses at ${bossDepths.join(', ')}, road ${ROAD}; pedestals ${PEDS ? 'on' : 'off'}, kills pay x${KILLS}, unwanted parts ${MELT ? 'melt' : 'stay on the floor'}, side rooms fought ${SIDE}, whim ${WHIM}`)
console.log(`  levels: tools/levels.json (${census2.n} a depth, road ${census2.route}, build ${census2.build}), tools/levels-III.json (road ${census3.route}, build ${census3.build})\n`)

console.log('all four slots first full, by the end of depth (cumulative):')
console.log('  ' + depthList.map((d) => `d${d} ${pct(count((r) => r.fullAt !== null && r.fullAt <= d))}`).join('  '))
console.log(`  parts on Still entering the first boss (d${bossDepths[0]}): ${[1, 2, 3, 4].map((n) => `${n} ${pct(count((r) => r.wornIn === n))}`).join('  ')}`)
if (PEDS) console.log(`  the first boss's second pick taken: ${pct(count((r) => r.second))}`)
console.log('')

console.log(`the target build worn (${NEED}+ of its parts), after each boss's drops:`)
console.log('  ' + bossDepths.map((d) => `d${d} ${pct(count((r) => (r.atBoss[d] ?? 0) >= NEED))}`).join('   '))
console.log('')

const all = runs.flatMap((r) => r.offers)
const tags: Tag[] = ['kill', 'crate', 'elite', 'plenty', 'boss', 'ped-exit', 'ped-plenty', 'ped-gift']
const used = tags.filter((t) => all.some((o) => o.tag === t))
const takes = all.filter((o) => o.taken)
console.log(`offers per run: ${per(all.length)}  (${used.map((t) => `${t} ${per(all.filter((o) => o.tag === t).length).trim()}`).join(', ')})`)
console.log(`takes per run:  ${per(takes.length)}  (${used.map((t) => `${t} ${per(takes.filter((o) => o.tag === t).length).trim()}`).join(', ')})`)
console.log(`melts per run:  ${per(runs.reduce((a, r) => a + r.melts, 0))}   left on the floor: ${per(all.filter((o) => !o.taken && !o.melted).length)}`)
console.log(`  for a filled slot (a real choice): ${per(all.filter((o) => o.filled).length)}   of those taken: ${per(all.filter((o) => o.filled && o.taken).length)}`)
if (PEDS) {
  const picks = all.filter((o) => o.tag.startsWith('ped-'))
  console.log(`  on pedestals: ${per(picks.length)}   taken: ${per(picks.filter((o) => o.taken).length)}   for an empty slot: ${per(picks.filter((o) => !o.filled).length)}`)
}
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

// --- against his logged runs ---
const VS = arg('vs', '')
if (VS) {
  const n = Number(arg('vs-last', '2'))
  const his = logged(VS, n)
  const sim = { offers: all.length / RUNS, takes: takes.length / RUNS, melts: runs.reduce((a, r) => a + r.melts, 0) / RUNS, left: all.filter((o) => !o.taken && !o.melted).length / RUNS }
  const mean = (k: 'offers' | 'takes' | 'melts' | 'left') => his.reduce((a, r) => a + r[k], 0) / his.length
  const f = (x: number) => x.toFixed(1).padStart(5)
  console.log(`\nagainst his last ${his.length} logged runs (${VS}), drop records without swaps:`)
  console.log('  run                     road depths  offers  takes  melts   left  missed')
  for (const r of his) console.log(`  ${r.id.padEnd(22)}  ${r.road.padEnd(4)}  ${String(r.depths).padStart(5)}  ${f(r.offers)}  ${f(r.takes)}  ${f(r.melts)}  ${f(r.left)}  ${f(r.missed)}`)
  console.log(`  his mean                          ${f(mean('offers'))}  ${f(mean('takes'))}  ${f(mean('melts'))}  ${f(mean('left'))}`)
  console.log(`  the simulator                     ${f(sim.offers)}  ${f(sim.takes)}  ${f(sim.melts)}  ${f(sim.left)}`)
  const within = (a: number, b: number) => Math.abs(a - b) <= 0.25 * b
  console.log(`  offers within 25% of his mean: ${within(sim.offers, mean('offers')) ? 'pass' : 'FAIL'} (${(100 * (sim.offers / mean('offers') - 1)).toFixed(0)}%)   takes within 25%: ${within(sim.takes, mean('takes')) ? 'pass' : 'FAIL'} (${(100 * (sim.takes / mean('takes') - 1)).toFixed(0)}%)`)
}
