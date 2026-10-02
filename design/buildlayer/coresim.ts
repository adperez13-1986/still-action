/**
 * The hunt with a core (design/buildlayer/3-balancer.md): tools/dropsim.ts's live run (9 depths, pedestals off, kills x0.4, melts)
 * plus BUILD.md §2.9's drop filter, the two keystones and the two upgrades a core. A copy, not an edit: B5 owns tools/dropsim.ts.
 * Reads the game's own drop code (src/drops.ts, src/pool.ts, src/temper.ts) and the census (tools/levels.json).
 *
 *   npx tsx design/buildlayer/coresim.ts [--runs 20000] [--share 0.45] [--keyw 1] [--core wake|ram|both] [--seed 1]
 *
 * The fits are BUILD.md §5.1's, by id. Choosers:
 *   committed: own spender 4 > the bridge (Scrap Cleaver) 3 > shaper 2 > guard 1.5 > plain 1; takes a fit over what is worn when worth more,
 *     and (dropsim's --whim 0.08) a few others; a keystone into an empty socket always, over the other one half the time (a swap for the
 *     next fight). Melting past III takes an upgrade (at most 2), never a mastery.
 *   random: dropsim's random picker (an empty slot always, else half), a keystone half the time.
 * Formed by the Assembler: 2+ of the core's parts worn walking into d3's boss, including a spender (BUILD B5). "own" = the spender is not the bridge.
 */
import { PARTS, byId, type AbilityDef } from '../../src/abilities'
import { dropChance, KILL_WEIGHT, LOOT, rollPart, type DropSource } from '../../src/drops'
import { markFound, startPart, type PoolView } from '../../src/pool'
import { TEMPER } from '../../src/temper'
import type { Archetype } from '../../src/combat'
import type { Save } from '../../src/save'
import type { SlotName } from '../../src/still'
import census2 from '../../tools/levels.json' with { type: 'json' }

const arg = (n: string, d: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 && process.argv[i + 1] ? process.argv[i + 1]! : d }
const RUNS = Number(arg('runs', '20000')), SEED = Number(arg('seed', '1')), SIDE = 0.5, WHIM = 0.08, CRATES = 0.25
const SHARES = arg('share', '0,0.3,0.45,0.5').split(',').map(Number), KEYW = Number(arg('keyw', '1'))
const UPFROM = Number(arg('upfrom', '1')), UPCOST = Number(arg('upcost', '1'))
const CORES = arg('core', 'both') === 'both' ? ['wake', 'ram'] as const : [arg('core', 'wake') as 'wake' | 'ram']
type Core = 'wake' | 'ram'
type Role = 'spend' | 'bridge' | 'shape' | 'guard'
const FITS: Record<Core, Record<string, Role>> = {
  ram: { piston: 'spend', 'scrap-cleaver': 'bridge', flare: 'spend', 'backdraft-vent': 'shape', kickstart: 'shape', brace: 'guard' },
  wake: { 'frayed-cleaver': 'spend', 'scrap-cleaver': 'bridge', 'frost-trail': 'spend', 'signal-flare': 'shape', 'spring-heels': 'shape', ward: 'guard' },
}
const KEYS: Record<Core, string[]> = { ram: ['ram-domino', 'ram-catch'], wake: ['wake-burst', 'wake-deep'] }
const WORTH: Record<Role, number> = { spend: 4, bridge: 3, shape: 2, guard: 1.5 }

let s = SEED >>> 0
Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const R = () => Math.random()

type Pack = { side: boolean; elite: boolean; kinds: Archetype[] }
const DEPTHS = Object.entries(census2.depths).map(([d, v]) => ({
  depth: Number(d), boss: v.boss,
  levels: v.levels.map((l) => ({ crates: l.crates, plenty: l.plenty, packs: l.packs.map((p): Pack => { const [room, kinds] = p.split(': ') as [string, string]; return { side: room.startsWith('side'), elite: room.endsWith('*'), kinds: kinds.split(' ') as Archetype[] } }) })),
}))
const FIRST_BOSS = DEPTHS.find((d) => d.boss)!.depth
const SLOTS: SlotName[] = ['head', 'torso', 'arms', 'legs']
const shuffle = <T>(a: T[]) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!] } return a }

interface Out { formed: boolean; formedOwn: boolean; keySeenBy6: boolean; keySeen: number; keyTook: number; keyAt: number | null; ownSpenderAt: number | null; late: boolean; lateWhat: Set<string>; upAt: number[]; fitOff: number; fitTook: number; plainOff: number; plainTook: number; filtered: number; offers: number; takes: number; fitsAtEnd: number }

function run(core: Core, who: 'committed' | 'random', share: number): Out {
  const save = { found: PARTS.map((p) => p.id), turned: [], hook: null } as unknown as Save
  const worn: Partial<Record<SlotName, AbilityDef>> = {}, ranks: Partial<Record<SlotName, number>> = {}
  const first = byId(startPart(save)); worn[first.slot] = first
  let socket: string | null = null, upgrades = 0, past = 0, depth = 1, floor: AbilityDef[] = [], floorKeys: string[] = []
  const o: Out = { formed: false, formedOwn: false, keySeenBy6: false, keySeen: 0, keyTook: 0, keyAt: null, ownSpenderAt: null, late: false, lateWhat: new Set(), upAt: [], fitOff: 0, fitTook: 0, plainOff: 0, plainTook: 0, filtered: 0, offers: 0, takes: 0, fitsAtEnd: 0 }
  const fit = (d: AbilityDef | undefined) => (d ? FITS[core][d.id] ?? null : null)
  const val = (d: AbilityDef | undefined) => (!d ? 0 : fit(d) ? WORTH[fit(d)!] : 1)
  const taken = () => [...(Object.values(worn) as AbilityDef[]), ...floor]
  const view = (): PoolView => ({ found: new Set(save.found), turned: new Set(), depth })
  const lateTake = (what: string) => { if (depth > 6) { o.late = true; o.lateWhat.add(what) } }
  const wear = (d: AbilityDef) => {
    const cur = worn[d.slot]
    if ((ranks[d.slot] ?? 1) >= TEMPER.swapRank) ranks[d.slot] = TEMPER.swapRank
    else { delete ranks[d.slot]; if (cur) floor.push(cur) }
    worn[d.slot] = d; markFound(save, d.id)
    if (fit(d) === 'spend' && o.ownSpenderAt === null) o.ownSpenderAt = depth
  }
  const melt = (d: AbilityDef) => {
    if (!worn[d.slot]) return false
    const r = (ranks[d.slot] ?? 1) + 1
    if (r > TEMPER.maxRank) {
      // --upfrom: past III offers an upgrade only from this depth; --upcost: melts past III an upgrade takes. Before, the part stays on the floor.
      if (upgrades >= 2 || depth < UPFROM) return false
      if (++past < UPCOST) return true
      past = 0; upgrades++; o.upAt.push(depth); lateTake('upgrade'); return true
    }
    ranks[d.slot] = r; return true
  }
  const offer = (d: AbilityDef | null) => {
    if (!d) return
    o.offers++
    const cur = worn[d.slot], f = fit(d)
    if (f) o.fitOff++; else o.plainOff++
    const take = !cur || (who === 'random' ? R() < 0.5 : val(d) > val(cur) || (!f && R() < WHIM) || (!!f && val(d) === val(cur) && R() < WHIM))
    if (take) { o.takes++; if (f) o.fitTook++; else o.plainTook++; wear(d); lateTake('part') } else if (!melt(d)) floor.push(d)
  }
  const offerKey = (k: string) => {
    o.keySeen++; if (depth <= 6) o.keySeenBy6 = true
    const take = who === 'random' ? R() < 0.5 : socket === null || R() < 0.5
    if (take) { if (socket) floorKeys.push(socket); socket = k; o.keyTook++; if (o.keyAt === null) o.keyAt = depth; lateTake('keystone') } else floorKeys.push(k)
  }
  /** BUILD §2.9 rollForCore: share of the time, from the core's parts and keystones not worn, socketed or lying here. */
  const filtered = (src: DropSource, from: Archetype, exclude: SlotName[] = []): AbilityDef | string | null => {
    if (share > 0 && R() < share) {
      const on = new Set(taken().map((p) => p.id))
      const parts = Object.keys(FITS[core]).map(byId).filter((p) => !on.has(p.id) && !exclude.includes(p.slot))
      const keys = KEYS[core].filter((k) => k !== socket && !floorKeys.includes(k))
      const w = parts.length + keys.length * KEYW
      if (w > 0) { o.filtered++; let x = R() * w; for (const p of parts) if ((x -= 1) < 0) return p; for (const k of keys) if ((x -= KEYW) < 0) return k }
    }
    return rollPart(from, taken(), src, view(), exclude)
  }
  const drop = (r: AbilityDef | string | null) => (typeof r === 'string' ? offerKey(r) : offer(r))
  for (const d of DEPTHS) {
    depth = d.depth; floor = []; floorKeys = []
    if (d.boss) {
      if (depth === FIRST_BOSS) {
        const w = Object.values(worn) as AbilityDef[], fs = w.filter((p) => fit(p))
        o.formed = fs.length >= 2 && fs.some((p) => fit(p) === 'spend' || fit(p) === 'bridge')
        o.formedOwn = fs.length >= 2 && fs.some((p) => fit(p) === 'spend')
      }
      const blue = filtered('boss-blue', 'boss')
      drop(blue)
      const ex = blue && typeof blue !== 'string' ? [blue.slot] : []
      offer(rollPart('boss', blue && typeof blue !== 'string' ? [...taken(), blue] : taken(), 'boss-gold', view(), ex))
      continue
    }
    const level = d.levels[Math.floor(R() * d.levels.length)]!
    const events: (() => void)[] = level.packs.filter((p) => !p.side || R() < SIDE).map((p) => () => {
      const pack = { weight: p.kinds.reduce((a, k) => a + KILL_WEIGHT[k], 0), side: p.side, dropped: false, members: [...p.kinds] }
      for (const m of shuffle(p.kinds.map((kind, i) => ({ kind, elite: p.elite && i === 0 })))) {
        pack.members.pop()
        const c = dropChance(pack, m.elite, false, KILL_WEIGHT[m.kind])
        if (R() >= (c < 1 ? c * TEMPER.killPayout : c)) continue
        pack.dropped = true
        if (m.elite) drop(filtered('elite', m.kind)); else offer(rollPart(m.kind, taken(), 'kill', view()))
      }
    })
    for (let i = 0; i < level.crates; i++) if (R() < CRATES) events.splice(Math.floor(R() * (events.length + 1)), 0, () => { if (R() < LOOT.crateParts) offer(rollPart('chaser', taken(), 'crate', view())) })
    if (level.plenty) events.splice(Math.floor(R() * (events.length + 1)), 0, () => drop(filtered('plenty', 'chaser')))
    for (const e of events) e()
  }
  o.fitsAtEnd = (Object.values(worn) as AbilityDef[]).filter((p) => fit(p)).length
  return o
}

const pc = (n: number, of = RUNS) => `${Math.round((100 * n) / of)}%`.padStart(4)
console.log(`coresim: ${RUNS} runs a row, seed ${SEED}, keyWeight ${KEYW}, upgrades from d${UPFROM} at ${UPCOST} melt(s) past III; live drops (pedestals off, kills x${TEMPER.killPayout}, melts), filter on elite, Plenty, boss-blue`)
for (const core of CORES) for (const share of SHARES) {
  const line: string[] = []
  for (const who of ['committed', 'random'] as const) {
    const rs = Array.from({ length: RUNS }, () => run(core, who, share))
    const n = (f: (r: Out) => boolean) => rs.filter(f).length, sum = (f: (r: Out) => number) => rs.reduce((a, r) => a + f(r), 0)
    if (who === 'committed') {
      const up1 = rs.filter((r) => r.upAt.length).map((r) => r.upAt[0]!).sort((a, b) => a - b), up2 = rs.filter((r) => r.upAt.length > 1).map((r) => r.upAt[1]!).sort((a, b) => a - b)
      const med = (a: number[]) => (a.length ? a[Math.floor(a.length / 2)] : '-')
      line.push(`committed formed d3 ${pc(n((r) => r.formed))} (own spender ${pc(n((r) => r.formedOwn))})  key seen by d6 ${pc(n((r) => r.keySeenBy6))}, taken/seen ${pc(sum((r) => r.keyTook), sum((r) => r.keySeen))}, socketed by d6 ${pc(n((r) => r.keyAt !== null && r.keyAt <= 6))}` +
        `  own spender by d3 ${pc(n((r) => r.ownSpenderAt !== null && r.ownSpenderAt < 3))}  late take ${pc(n((r) => r.late))} (part ${pc(n((r) => r.lateWhat.has('part')))}, key ${pc(n((r) => r.lateWhat.has('keystone')))}, upgrade ${pc(n((r) => r.lateWhat.has('upgrade')))})` +
        `  upgrade 1 by median d${med(up1)} (${pc(up1.length)}), 2 by d${med(up2)} (${pc(up2.length)})  fit take/offer ${pc(sum((r) => r.fitTook), sum((r) => r.fitOff))} vs plain ${pc(sum((r) => r.plainTook), sum((r) => r.plainOff))}  filtered ${(sum((r) => r.filtered) / RUNS).toFixed(1)}/run, offers ${(sum((r) => r.offers) / RUNS).toFixed(1)}, fits worn at end ${(sum((r) => r.fitsAtEnd) / RUNS).toFixed(1)}`)
    } else line.push(`random formed d3 ${pc(n((r) => r.formed))} (own ${pc(n((r) => r.formedOwn))})`)
  }
  console.log(`  ${core} share ${share}: ${line.join('\n      ')}`)
}
