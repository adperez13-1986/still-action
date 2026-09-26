import { PARTS } from './abilities'
import { STARTER_POOL, keepWhites } from './pool'
import type { HomeHour, RouteId } from './areas'

/**
 * The one save: everything a run leaves behind, under one versioned key.
 *
 * Every project on adperez13-1986.github.io shares one localStorage, so every
 * key starts with `still-action.`, and nothing without that prefix is touched
 * except the old `still.pushHint.*` keys, which move in here. Storage can fail
 * any way a phone can make it fail (a private window, a full quota, a save from
 * a newer build): none of that throws, the save just stays in memory.
 *
 * Writes happen on events (a new part taken, an ending, a push hint), never on
 * a timer, so any write may be the last one before the tab dies.
 */
export const SAVE_KEY = 'still-action.save'
export const SAVE_BACKUP_KEY = 'still-action.save.corrupt'
/** A save that a migration couldn't carry forward, kept as it was. */
export const SAVE_MIGRATE_KEY = 'still-action.save.premigrate'
export const PROBE_KEY = 'still-action.probe'
export const LEGACY_HINT_PREFIX = 'still.pushHint.'
/** v2 (area II): each part's history counts the Arbiters it saw fall. v3 (area III): the Engines too, and the roads. */
export const SAVE_VERSION = 3
/** Cards kept in localStorage, newest last. */
export const CARD_KEEP = 36
/** Of those, the newest this many keep their strain line. */
export const CARD_LINES = 24
export const LEADERS_MAX = 6

export type PartId = string
/** An id from still's enemies.ts. */
export type RosterId = string
/** The three endings. INV: the only terminal states there are. */
export type EndingKind = 'broken' | 'stopped' | 'home'
export type Drawer = 'yanah' | 'yuri'

/** Who drew the first run's card. PLACEHOLDER: Adrian's call (the crayon step takes this over). */
export const FIRST_DRAWER: Drawer = 'yanah'
/** The children take turns: run 1 is FIRST_DRAWER's, run 2 the other's, and so on. */
export const drawerFor = (n: number): Drawer => (n % 2 === 1 ? FIRST_DRAWER : FIRST_DRAWER === 'yanah' ? 'yuri' : 'yanah')

/** [runs carried, deepest depth, Assemblers felled while worn, worn at broken, at stopped, at home, Arbiters felled while worn, Engines felled while worn] */
export type PartHistory = [runs: number, deepest: number, assemblers: number, broken: number, stopped: number, home: number, arbiters: number, engines: number]

export interface NotebookEntry {
  /** First met, local date 'yyyy-mm-dd'. */
  f: string
  /** Levels met in. */
  m: number
  /** Felled. */
  k: number
  /** Deepest depth met at. */
  d: number
  /** Elites only: leader names seen (D2 names), newest last, at most LEADERS_MAX. */
  l?: string[]
}

/** The kept thing. INV: written at commit, before the terminal phase runs. */
export interface RunCard {
  /** The run's id; also the IndexedDB key of its drawing. */
  id: string
  /** Run number, 1-based (save.runs at commit). */
  n: number
  /** Local 'yyyy-mm-dd' of the ending. */
  date: string
  end: EndingKind
  /** Caption only, never a headline. */
  depth: number
  hour: HomeHour
  by: Drawer
  /** Four, slot order head/torso/arms/legs, at the ending. */
  worn: (PartId | null)[]
  /** Strain samples '0'..'k' (0-20), at most 96 chars. INV: at least 1 char when written (the corkboard step). */
  line?: string
  /** Sample index where each depth began. */
  marks?: number[]
  /** The road taken at depth 4. Absent: 'II' (every card before the Line, and every Works run). */
  route?: RouteId
}

export interface LastEnding {
  kind: EndingKind
  hour: HomeHour
  depth: number
  worn: (PartId | null)[]
  cardId: string
  /** False until the arrival finishes; a reload replays it. */
  arrived: boolean
}

export interface RunTally {
  /** Every part equipped at any point this run. */
  carried: PartId[]
  deepest: Record<PartId, number>
  assemblers: Record<PartId, number>
  arbiters: Record<PartId, number>
  engines: Record<PartId, number>
  /** The strain line so far (the corkboard step). */
  line: string
  lineStep: number
  marks: number[]
  /** The open sample window: max strain, seconds in. */
  win: number
  winT: number
  /** For __runStats. */
  pushes: number
  quiets: number
}

export const freshTally = (): RunTally => ({
  carried: [], deepest: {}, assemblers: {}, arbiters: {}, engines: {}, line: '', lineStep: 5, marks: [], win: 0, winT: 0, pushes: 0, quiets: 0,
})

/** The in-progress run at its last beam. INV: null whenever no run is in progress (resume is the last step). */
export interface RunSnapshot {
  /** Snapshot schema; any other value is discarded. */
  s: 1
  /** __BUILD__, diagnostic only. */
  build: string
  id: string
  /** ISO. */
  startedAt: string
  /** Resume at the START of this depth. */
  depth: number
  /** This depth's level seed: the same layout on resume. */
  seed: number
  /** This depth's boss is down: resume with the beams open and no boss. */
  bossFelled: boolean
  /** Its drops, dropped again on resume unless worn. */
  bossLoot: PartId[]
  strain: number
  /** Four, slot order. */
  loadout: (PartId | null)[]
  tally: RunTally
  /** undefined: a v2 snapshot, so route 'II'. null: not chosen yet (only with `crossroads`). */
  route?: RouteId | null
  /** Resume in the crossroads room (depth 3, its boss down). */
  crossroads?: true
}

export interface Save {
  v: 3
  /** ISO; set at the first run's start. The doorframe grows from it. */
  firstRunAt: string | null
  /** Endings committed. */
  runs: number
  /** INV: contains STARTER_POOL; only grows (except unknown-id pruning). */
  found: PartId[]
  /** INV: a subset of found; every slot keeps at least one white not in here. */
  turned: PartId[]
  /** INV: never gold, never turned, in found. */
  hook: PartId | null
  /** Set at commit, cleared when the next run starts. */
  pendingHook: { candidates: PartId[] } | null
  history: Record<PartId, PartHistory>
  notebook: Record<RosterId, NotebookEntry>
  /** Newest last, at most CARD_KEEP (IndexedDB keeps them all, from the corkboard step). */
  cards: RunCard[]
  lastEnding: LastEnding | null
  run: RunSnapshot | null
  /** Push hints shown (was still.pushHint.*). */
  hints: PartId[]
  /** High-water mark count: never shrinks under clock skew. */
  doorMarks: number
  /** INV: contains 'II'; only grows (unioned in write). 'III' joins at the commit of a run that felled an Assembler, while the Line is on. */
  roads: RouteId[]
  /** The road last taken at depth 4 (non-dev). The alternate fallback reads it. */
  lastRoad: RouteId | null
}

export interface SaveStore {
  /** Live and mutable: the pure helpers in pool.ts change it in place. */
  readonly data: Save
  readonly mode: 'local' | 'memory'
  /** Unions the only-growing sets with the stored copy, then writes. Never throws. A no-op in memory mode. */
  write(): void
  /** Back to a fresh save, the stored copy included (dev hooks). */
  reset(): void
}

/**
 * Key n upgrades a save from version n to n + 1. Lossless, run on load before anything reads
 * the save. 1 → 2: every part's history gains its Arbiter count (0), and a snapshot's tally
 * its `arbiters`; every card, page and part stays exactly as it was.
 */
export const MIGRATIONS: Record<number, (s: any) => any> = {
  1: (s: any) => ({
    ...s,
    v: 2,
    history: Object.fromEntries(Object.entries(s.history ?? {}).map(([k, h]) => [k, Array.isArray(h) ? [...h, 0] : h])),
    run: s.run && typeof s.run === 'object' ? { ...s.run, tally: { ...(s.run.tally ?? {}), arbiters: {} } } : s.run ?? null,
  }),
  // 2 → 3: every history gains its Engine count (0), the roads open to the Works only, and a snapshot's tally gains `engines`
  2: (s: any) => ({
    ...s,
    v: 3,
    history: Object.fromEntries(Object.entries(s.history ?? {}).map(([k, h]) => [k, Array.isArray(h) ? [...h, 0] : h])),
    roads: ['II'],
    lastRoad: null,
    run: s.run && typeof s.run === 'object' ? { ...s.run, tally: { ...(s.run.tally ?? {}), engines: {} } } : s.run ?? null,
  }),
}

const KNOWN = new Set(PARTS.map((p) => p.id))

export function freshSave(): Save {
  return {
    v: 3, firstRunAt: null, runs: 0, found: [...STARTER_POOL], turned: [], hook: null, pendingHook: null,
    history: {}, notebook: {}, cards: [], lastEnding: null, run: null, hints: [], doorMarks: 0, roads: ['II'], lastRoad: null,
  }
}

/** Local 'yyyy-mm-dd': a card is dated where he played it, not in UTC. */
export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x)
const ids = (x: unknown): PartId[] => (Array.isArray(x) ? [...new Set(x.filter((i): i is string => typeof i === 'string'))] : [])

/**
 * Whatever came out of storage, made into a save the rules allow: every field
 * present and the right shape, unknown part ids pruned, the starter pool
 * re-asserted (§4.8), turned inside found, the hook legal. Never throws on
 * a plain object.
 */
function repair(raw: Record<string, any>): Save {
  const s = freshSave()
  const found = new Set([...ids(raw.found).filter((i) => KNOWN.has(i)), ...STARTER_POOL])
  s.found = [...found]
  s.turned = ids(raw.turned).filter((i) => found.has(i))
  const byGold = new Set(PARTS.filter((p) => p.tier === 'gold').map((p) => p.id))
  s.hook = typeof raw.hook === 'string' && found.has(raw.hook) && !byGold.has(raw.hook) && !s.turned.includes(raw.hook) ? raw.hook : null
  s.firstRunAt = typeof raw.firstRunAt === 'string' ? raw.firstRunAt : null
  s.runs = Number.isFinite(raw.runs) ? Math.max(0, Math.floor(raw.runs)) : 0
  s.pendingHook = isObj(raw.pendingHook) ? { candidates: ids(raw.pendingHook.candidates).filter((i) => KNOWN.has(i)) } : null
  if (isObj(raw.history)) {
    for (const [k, h] of Object.entries(raw.history)) {
      if (KNOWN.has(k) && Array.isArray(h) && h.length === 8 && h.every(Number.isFinite)) s.history[k] = h as PartHistory
    }
  }
  if (isObj(raw.notebook)) s.notebook = raw.notebook
  if (Array.isArray(raw.cards)) s.cards = raw.cards.filter(isObj) as RunCard[]
  s.lastEnding = isObj(raw.lastEnding) ? (raw.lastEnding as LastEnding) : null
  s.run = isObj(raw.run) ? (raw.run as RunSnapshot) : null
  // a snapshot from before the Arbiter's count: its tally starts it at nothing
  if (s.run && isObj(s.run.tally)) {
    s.run.tally.arbiters ??= {}
    s.run.tally.engines ??= {}
  }
  s.hints = ids(raw.hints)
  s.doorMarks = Number.isFinite(raw.doorMarks) ? Math.max(0, raw.doorMarks) : 0
  // the roads: always the Works; the Line only if it was ever opened
  s.roads = ['II', ...(Array.isArray(raw.roads) && raw.roads.includes('III') ? (['III'] as const) : [])]
  s.lastRoad = raw.lastRoad === 'II' || raw.lastRoad === 'III' ? raw.lastRoad : null
  keepWhites(s)
  return s
}

/** Storage calls that can't throw. */
function tryGet(k: string): string | null {
  try {
    return localStorage.getItem(k)
  } catch {
    return null
  }
}

/**
 * Opens the save. `memory`: read what's stored, but never write (a dev run at
 * ?depth=, or ?save=memory for checks). A private window, a corrupt string or
 * a newer save's version all end in a save that works; only some of them can
 * be kept.
 */
export function openSave(opts: { memory?: boolean } = {}): SaveStore {
  // the probe: a private window (or storage turned off) throws on one of these
  let usable = true
  try {
    localStorage.setItem(PROBE_KEY, '1')
    localStorage.removeItem(PROBE_KEY)
  } catch {
    usable = false
  }
  let mode: 'local' | 'memory' = usable && !opts.memory ? 'local' : 'memory'

  let data = freshSave()
  const raw = usable ? tryGet(SAVE_KEY) : null
  if (raw !== null) {
    let parsed: unknown = undefined
    try {
      parsed = JSON.parse(raw)
    } catch {
      // keep the first broken copy for a look later, then start over
      if (mode === 'local' && tryGet(SAVE_BACKUP_KEY) === null) {
        try {
          localStorage.setItem(SAVE_BACKUP_KEY, raw)
        } catch {
          // nowhere to keep it
        }
      }
    }
    if (isObj(parsed) && typeof parsed.v === 'number') {
      if (parsed.v > SAVE_VERSION) {
        // a newer build wrote this (a rollback): play on a best-effort copy, and never overwrite it
        mode = 'memory'
        try {
          data = repair(parsed)
        } catch {
          data = freshSave()
        }
      } else {
        let s: any = parsed
        try {
          for (let v = s.v; v < SAVE_VERSION; v++) s = MIGRATIONS[v]!(s)
          data = repair(s)
        } catch {
          // a migration that throws must never cost the save: keep a copy, leave the original
          // untouched, and play this session in memory. A build with the migration fixed picks it up.
          if (mode === 'local') {
            try {
              if (tryGet(SAVE_MIGRATE_KEY) === null) localStorage.setItem(SAVE_MIGRATE_KEY, raw)
            } catch {
              // nowhere to keep a copy; the original is still where it was
            }
          }
          mode = 'memory'
          data = freshSave()
        }
      }
    } else if (parsed !== undefined && mode === 'local' && tryGet(SAVE_BACKUP_KEY) === null) {
      // valid JSON that isn't a save is as good as corrupt
      try {
        localStorage.setItem(SAVE_BACKUP_KEY, raw)
      } catch {
        // nowhere to keep it
      }
    }
  }

  // the old push hints move in; only this game's old keys, nothing else with a still. prefix
  if (usable) {
    const legacy: string[] = []
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k?.startsWith(LEGACY_HINT_PREFIX) && localStorage.getItem(k) === '1') legacy.push(k)
      }
    } catch {
      // unreadable: nothing to move
    }
    for (const k of legacy) {
      const id = k.slice(LEGACY_HINT_PREFIX.length)
      if (!data.hints.includes(id)) data.hints.push(id)
    }
    if (mode === 'local') {
      for (const k of legacy) {
        try {
          localStorage.removeItem(k)
        } catch {
          // it stays; it's read again next boot and changes nothing
        }
      }
    }
  }

  const store: SaveStore = {
    data,
    get mode() { return mode },
    write() {
      if (mode === 'memory') return
      // another tab may have found something since: the sets that only grow are unioned, never dropped
      const stored = tryGet(SAVE_KEY)
      if (stored !== null) {
        try {
          const other = JSON.parse(stored)
          if (isObj(other) && other.v === SAVE_VERSION) {
            for (const id of ids(other.found)) if (KNOWN.has(id) && !data.found.includes(id)) data.found.push(id)
            for (const id of ids(other.hints)) if (!data.hints.includes(id)) data.hints.push(id)
            if (Array.isArray(other.roads) && other.roads.includes('III') && !data.roads.includes('III')) data.roads.push('III')
            if (isObj(other.notebook)) {
              for (const [k, e] of Object.entries(other.notebook)) if (!(k in data.notebook)) data.notebook[k] = e as NotebookEntry
            }
          }
        } catch {
          // a broken stored copy is simply replaced
        }
      }
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data))
      } catch {
        // quota, or storage gone mid-session: it stays in memory, and the next event write retries
      }
    },
    reset() {
      const f = freshSave()
      for (const k of Object.keys(data) as (keyof Save)[]) delete data[k]
      Object.assign(data, f)
      if (mode === 'local') {
        try {
          localStorage.removeItem(SAVE_KEY)
        } catch {
          // nothing stored to clear
        }
      }
      store.write()
    },
  }
  // the first write: the migrated hints and the repaired shape are kept from the first boot
  store.write()
  return store
}

/** Keep the newest CARD_KEEP; older than the newest CARD_LINES lose their line (IndexedDB keeps it, later). */
export function trimCards(s: Save): void {
  if (s.cards.length > CARD_KEEP) s.cards.splice(0, s.cards.length - CARD_KEEP)
  for (let i = 0; i < s.cards.length - CARD_LINES; i++) {
    delete s.cards[i]!.line
    delete s.cards[i]!.marks
  }
}
