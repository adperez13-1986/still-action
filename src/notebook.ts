import type { Archetype, EliteMod } from './combat'
import type { NotebookEntry, RosterId, Save } from './save'
import { localDate, LEADERS_MAX } from './save'

/**
 * The notebook: the 43 enemies of the original Still, back as the names of what
 * this Still meets. Each archetype takes one name per level; the first time ever
 * a name is met, it's written in the book (and floats over the one he met). Every
 * page keeps a few facts: when first met, how often, how many felled, how deep.
 * Knowing the maze is the one progress that doesn't make a run stronger.
 *
 * From design/meta/SPEC.md §7.3 (ids are still's ALL_ENEMIES keys).
 */

export type RosterRole = 'hulk' | 'sentinel' | 'ram' | 'mites' | 'elite' | 'fragment' | 'boss' | 'lobber' | 'heap' | 'thief' | 'mender' | 'reserved' | 'signal' | 'handcar' | 'sleepers'
export interface RosterEntry {
  id: RosterId
  name: string
  role: RosterRole
  band: 'I' | 'II' | 'any'
  /** Elites: the modifier whose page this is. */
  mod?: EliteMod
  boss?: 'assembler' | 'arbiter'
  /** The content step's: 'the thief', 'the Lobber', ... */
  reservedFor?: string
  /**
   * The page's one line. Only the two bosses have one from the old game. Every
   * `null` here is a page left blank for Adrian to write (41 of them): it renders
   * as an empty ruled line, never as a placeholder.
   */
  line: string | null
}

const E = (id: string, name: string, role: RosterRole, band: RosterEntry['band'], more: Partial<RosterEntry> = {}): RosterEntry =>
  ({ id, name, role, band, line: null, ...more })

// ADRIAN: every `line: null` below is a blank page for you to write (41). Two ship with their old lines.
export const ROSTER: readonly RosterEntry[] = [
  E('wandering-drone', 'Wandering Drone', 'thief', 'I'),
  E('rust-guard', 'Rust Guard', 'hulk', 'I'),
  E('corroded-sentry', 'Corroded Sentry', 'sentinel', 'I'),
  E('fracture-mite', 'Fracture Mite', 'mites', 'II'),
  E('iron-crawler', 'Iron Crawler', 'ram', 'I'),
  E('glitch-node', 'Glitch Node', 'sentinel', 'I'),
  E('sentinel-shard', 'Sentinel Shard', 'sentinel', 'I'),
  E('hollow-repeater', 'Hollow Repeater', 'lobber', 'II'),
  E('drifting-frame', 'Drifting Frame', 'hulk', 'I'),
  E('echo-construct', 'Echo Construct', 'hulk', 'I'),
  E('thermal-scanner', 'Thermal Scanner', 'sentinel', 'I'),
  E('signal-jammer', 'Signal Jammer', 'sentinel', 'I'),
  E('vault-keeper', 'Vault Keeper', 'elite', 'any', { mod: 'plated' }),
  E('corrupted-overseer', 'Corrupted Overseer', 'elite', 'II', { mod: 'warding' }),
  E('fracture-titan', 'Fracture Titan', 'elite', 'any', { mod: 'splitting' }),
  E('the-first-warden', 'The First Warden', 'boss', 'any', { boss: 'assembler', line: 'It does not remember what it was built to protect. It only remembers the door.' }),
  E('thermal-leech', 'Thermal Leech', 'mites', 'II'),
  E('wire-jammer', 'Wire Jammer', 'sentinel', 'II'),
  E('slag-heap', 'Slag Heap', 'heap', 'II'),
  E('feedback-loop', 'Feedback Loop', 'sentinel', 'II'),
  E('phase-drone', 'Phase Drone', 'sentinel', 'II'),
  E('furnace-tick', 'Furnace Tick', 'mites', 'II'),
  E('static-frame', 'Static Frame', 'hulk', 'II'),
  E('conduit-spider', 'Conduit Spider', 'mites', 'II'),
  E('overcharge-sentinel', 'Overcharge Sentinel', 'elite', 'I', { mod: 'swift' }),
  E('lockdown-warden', 'Lockdown Warden', 'elite', 'I', { mod: 'warding' }),
  E('meltdown-core', 'Meltdown Core', 'elite', 'II', { mod: 'swift' }),
  E('the-thermal-arbiter', 'The Thermal Arbiter', 'boss', 'any', { boss: 'arbiter', line: 'It measures everything. It forgives nothing.' }),
  E('thorn-sentinel', 'Thorn Sentinel', 'sentinel', 'I'),
  E('feedback-drone', 'Feedback Drone', 'sentinel', 'II'),
  E('strain-siphon', 'Strain Siphon', 'mites', 'II'),
  E('overload-core', 'Overload Core', 'ram', 'I'),
  E('fracture-fragment', 'Fracture Fragment', 'fragment', 'any'),
  E('fracture-host', 'Fracture Host', 'hulk', 'I'),
  E('echo-shell', 'Echo Shell', 'reserved', 'any', { reservedFor: 'the Echo, later, maybe' }),
  E('void-leech', 'Void Leech', 'mites', 'II'),
  E('strain-parasite', 'Strain Parasite', 'mites', 'II'),
  E('fury-core', 'Fury Core', 'ram', 'II'),
  E('ward-pylon', 'Ward Pylon', 'sentinel', 'II'),
  E('raging-hull', 'Raging Hull', 'ram', 'II'),
  E('phase-wraith', 'Phase Wraith', 'ram', 'II'),
  E('drain-frame', 'Drain Frame', 'hulk', 'II'),
  E('martyr-shell', 'Martyr Shell', 'hulk', 'II'),
]
export const ROSTER_BY_ID = new Map(ROSTER.map((r) => [r.id, r]))

// the mender has no page yet: its name is his to choose, so it's met and felled unwritten
const ROLE_OF: Record<Exclude<Archetype, 'boss'>, RosterRole> = { chaser: 'hulk', ranged: 'sentinel', charger: 'ram', swarm: 'mites', thief: 'thief', mender: 'mender' }
const bandOf = (depth: number): 'I' | 'II' => (depth <= 3 ? 'I' : 'II')
/** The Assembler's page, both depths. */
export const BOSS_PAGE: RosterId = 'the-first-warden'
/** The Lobber's page, and the slag heap's: one each, whatever the level names its ranged and its mites. */
export const LOBBER_PAGE: RosterId = 'hollow-repeater'
export const HEAP_PAGE: RosterId = 'slag-heap'
/** The thief's page: met on its first wake, felled on a catch. */
export const THIEF_PAGE: RosterId = 'wandering-drone'
/** The halves of a Many split. */
export const FRAGMENT_PAGE: RosterId = 'fracture-fragment'

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  if (s < 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/** The Line's bodies that take a page of a name he may not have met yet: the three crawl bodies, and the Engine (stage C; the Porter's waits for stage D). */
export type LineRole = 'signal' | 'handcar' | 'sleepers' | 'engine'
/**
 * The pages a Line body may take, all blank-line pages of a name he may not have met yet (never `raging-hull` or
 * `drifting-frame`, which stages C and D will take). Only a page he has never met can change role (INV-N2): a page he
 * has met as a sentinel stays a sentinel, so no page he already holds is re-labelled under him.
 */
export const LINE_DONORS: Record<LineRole, readonly RosterId[]> = {
  signal: ['signal-jammer', 'thermal-scanner', 'glitch-node'],
  handcar: ['feedback-loop', 'phase-drone'],
  sleepers: ['conduit-spider', 'strain-siphon', 'void-leech'],
  /**
   * The Engine's page. SPEC's raging-hull while he hasn't met it; else echo-shell, the one page the live game never assigns (role
   * 'reserved', never in namesFor), so it is unmet on every save and a boss is never unwritten. PLACEHOLDER choice: Adrian's (STAGE-C §9).
   */
  engine: ['raging-hull', 'echo-shell'],
}
const LINE_ROLES = Object.keys(LINE_DONORS) as LineRole[]

let linePagesOn = false
const chosen: Record<LineRole, RosterId | null> = { signal: null, handcar: null, sleepers: null, engine: null }

/**
 * INV-N1: while off, every roster lookup is exactly today's (namesFor, WHAT, the pages' order). main sets it once at
 * boot: on when the Line can generate, off otherwise, so the shipped game's names never change (K-E10 OFF).
 * On, each Line role takes a donor page: the one already met as that body (`r`), else the first donor never met,
 * else none (the body is then met and felled unwritten, like the mender). It is chosen here and kept, so a name
 * never changes role during a session.
 */
export function setLinePages(on: boolean, notebook: Save['notebook']): void {
  linePagesOn = on
  for (const role of LINE_ROLES) {
    const donors = LINE_DONORS[role]
    chosen[role] = !on ? null
      : donors.find((id) => notebook[id]?.r === role) ?? donors.find((id) => !(id in notebook)) ?? null
  }
}

/** True while the Line's pages are in play, so a Line body without a page is unwritten rather than named by its level. */
export const linePagesActive = () => linePagesOn

/** A Line body's page, or null: off, or every donor already met as something else. */
export const linePage = (role: LineRole): RosterId | null => chosen[role]

/** A page's role and band now: the Line body's role, band 'any', for a chosen donor (the Engine's page reads as a boss's); its own otherwise. */
export function roleOf(r: RosterEntry): { role: RosterRole; band: RosterEntry['band'] } {
  if (linePagesOn) for (const role of LINE_ROLES) if (chosen[role] === r.id) return { role: role === 'engine' ? 'boss' : role, band: 'any' }
  return { role: r.role, band: r.band }
}

/** What an archetype may be called at a depth: its role, in the depth's band or any; with no band match, any of its role. */
export function namesFor(kind: Exclude<Archetype, 'boss'>, depth: number): RosterEntry[] {
  const role = ROLE_OF[kind]
  const band = bandOf(depth)
  const inBand = ROSTER.filter((r) => { const o = roleOf(r); return o.role === role && (o.band === band || o.band === 'any') })
  return inBand.length ? inBand : ROSTER.filter((r) => roleOf(r).role === role)
}

/**
 * This level's names (§7.2): each archetype gets one, chosen among those not yet met
 * if any are left. Its own seeded stream, outside generateLevel, so the level's
 * layout doesn't know names exist.
 */
export function assignNames(depth: number, seed: number, notebook: Save['notebook']): Record<Exclude<Archetype, 'boss'>, RosterId> {
  const r = rng((seed ^ 0x9e3779b1) >>> 0)
  const out = {} as Record<Exclude<Archetype, 'boss'>, RosterId>
  for (const kind of ['chaser', 'ranged', 'charger', 'swarm'] as const) {
    const all = namesFor(kind, depth)
    const unmet = all.filter((e) => !(e.id in notebook))
    const pool = unmet.length ? unmet : all
    out[kind] = pool[Math.floor(r() * pool.length)]!.id
  }
  return out
}

/** An elite's page: its modifier's, in the depth's band. */
export function elitePage(mod: EliteMod, depth: number): RosterId {
  const band = bandOf(depth)
  const pages = ROSTER.filter((r) => r.role === 'elite' && r.mod === mod)
  return (pages.find((r) => r.band === band) ?? pages.find((r) => r.band === 'any') ?? pages[0]!).id
}

/**
 * Meet a name this level. True the first time ever (the caller writes the save and
 * shows the name). `seen` holds the names already counted this level.
 */
export function meet(nb: Save['notebook'], id: RosterId, depth: number, seen: Set<RosterId>): boolean {
  const e = nb[id]
  if (!e) {
    nb[id] = { f: localDate(), m: 1, k: 0, d: depth }
    seen.add(id)
    return true
  }
  if (!seen.has(id)) {
    e.m += 1
    seen.add(id)
  }
  e.d = Math.max(e.d, depth)
  return false
}

/** An elite leader's D2 name on its page: newest last, once each, at most LEADERS_MAX. */
export function addLeader(e: NotebookEntry, name: string) {
  const l = (e.l ?? []).filter((n) => n !== name)
  l.push(name)
  e.l = l.slice(-LEADERS_MAX)
}

/** What the page says it is. */
export const WHAT: Record<RosterRole, string> = {
  // PLACEHOLDER words for the content pages
  hulk: 'a hulk', sentinel: 'a sentinel', ram: 'a ram', mites: 'mites', elite: 'an elite', boss: 'the boss', fragment: 'pieces of one',
  lobber: 'a lobber', heap: 'a slag heap', thief: 'a thief', mender: 'a mender', reserved: '',
  signal: 'a signalman', handcar: 'a handcar', sleepers: 'sleepers',
}
