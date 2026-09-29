/**
 * Parry Clamp vs Scrap Cleaver (and Piston) at realistic depths, realistic packs.
 *   node parry-depths.mjs [levels=8] [depths=2,4,5,8] [policies=all]
 * Packs: __genLook(depth, k*7919) for k=1..levels, every pack of every level is one fight, placed in __arena
 * (centre 6 u from Still, members on a 1.2 u ring), woken at once. Curve: __curveAt(depth) on the page whose table
 * the depth belongs to (2/4/5 on the live 6-depth page, 8 on ?roads=1). Pressure on, counters ON (the live default),
 * break rule off, autos on, 60 s cap, Still's HP put back to 100 each tick (HP lost summed).
 * Movement bot (all parts): steer at the nearest live awake body while it is > 2.2 u away, else stand.
 * Cast policies:
 *   cleaver / piston / parry-naive: fire when a live body is within the part's range + 0.3
 *   parry-oracle: fire only when a body in reach is telling (tellIn != null) or winding up (0 ms reaction)
 *   parry-r250: the same after the tell/windup has been visible 250 ms (a phone thumb), grace 0
 *   parry-r250g150: the same, __parryGrace(150)
 *   parry-hybrid-r250g150: r250g150, plus a plain cast when ready and no tell has come in reach for 1.5 s
 * Dial variants are applied to the in-page def (byId('parry-clamp') is the object the HUD holds): cd=<ms>, range=<u>.
 */
const LIB = process.env.LIB ?? '/Users/adrianperez/repos/personal/still-action/tools/checks/lib.mjs'
const { startVite, openPage, evalJson } = await import(LIB)

const LEVELS = Number(process.argv[2] ?? 8)
const DEPTHS = (process.argv[3] ?? '2,4,5,8').split(',').map(Number)
const ALL = ['cleaver', 'piston', 'parry-naive', 'parry-oracle', 'parry-r250', 'parry-r250g150', 'parry-hybrid-r250g150']
const POLICIES = process.argv[4] && process.argv[4] !== 'all' ? process.argv[4].split(',') : ALL

function run(arg) {
  const W = window, C = W.__combat
  const mulberry32 = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
  const stat = () => W.__run.stats[W.__run.stats.length - 1]
  const SLOTS = ['head', 'torso', 'arms', 'legs']
  // dials on the live def
  const policy = arg.policy
  const partId = policy === 'cleaver' ? 'scrap-cleaver' : policy === 'piston' ? 'piston' : 'parry-clamp'
  const out = []
  for (const f of arg.fights) {
    W.__hold(true)
    for (const slot of SLOTS) C.clearSlot(slot)
    W.__hud.resetLoadout([])
    for (const slot of SLOTS) W.__still.wear(slot, null)
    W.__equip('scrap-cleaver')
    const original = Math.random
    Math.random = mulberry32(f.seed)
    try {
      W.__arena()
      C.time = 0
      C.pressure = true
      C.counters = true
      C.breakRule = false
      C.autoAttack = true
      C.autoTimer = 0
      C.mastery = new Set()
      C.curve = W.__curveAt(arg.depth)
      W.__stick(0, 0)
      W.__equip(partId)
      const def = W.__hud.slots.find((s) => s.def?.slot === 'arms').def
      const saved = { cd: def.cooldownMs, range: def.range }
      if (partId === 'parry-clamp') {
        if (arg.dial.cd) def.cooldownMs = arg.dial.cd
        if (arg.dial.range) def.range = arg.dial.range
      }
      const grace = policy.includes('g150') ? 150 : (arg.dial.grace ?? 0)
      W.__parryGrace(grace)
      const a = Math.random() * Math.PI * 2
      const cx = Math.sin(a) * 6, cz = Math.cos(a) * 6
      const n = f.kinds.length
      const members = f.kinds.map((kind, k) => {
        const r = n > 1 ? 1.2 : 0
        const m = { kind, x: cx + Math.sin((k * 2 * Math.PI) / n) * r, z: cz + Math.cos((k * 2 * Math.PI) / n) * r }
        if (f.lobbers[k]) m.variant = 'lobber'
        return m
      })
      const pack = W.__pack(members, true, f.elite ?? undefined)
      const leader = f.elite ? pack.members[0] : null
      if (partId === 'parry-clamp' && arg.dial.stagger) {
        const add = arg.dial.stagger
        for (const e of pack.members) {
          if (!e.catchTell) continue
          const orig = e.catchTell
          e.catchTell = function (...a) {
            const ok = orig.apply(this, a)
            if (ok) {
              if (this.kind === 'chaser') this.timer += add
              else if (this.kind === 'ranged') { if (this.phase === 'recover') this.timer += add; else this.reload += add }
              else if (this.kind === 'swarm') this.rest += add
            }
            return ok
          }
        }
      }
      const st0 = stat()
      const c0 = { ...st0.catches }, lb0 = st0.lunges.broken
      let casts = 0, readies = 0, nextReady = -Infinity
      const ua = C.useAbility
      C.useAbility = function (d, ctx) { if (d.slot === 'arms') casts++; return ua.call(this, d, ctx) }
      W.__partLog.length = 0
      let lost = 0, clear = -1, breaks = 0, catchesLog = 0, tells = 0, leaderWindups = 0, leaderBroken = 0
      const seen = new Map() // enemy -> tick its tell/windup began
      let lastTellTick = 0
      const reactTicks = policy.includes('r250') ? Math.round(0.25 * 60) : 0
      const reach = def.range
      const armsSlot = () => W.__hud.slots.find((s) => s.def?.slot === 'arms')
      for (let i = 1; i <= 60 * 60; i++) {
        const live = C.enemies.filter((e) => !e.dead)
        if (!live.length) { clear = (i - 1) / 60; break }
        // movement
        let near = null, nd = Infinity
        for (const e of live) { const d = dist(e.pos, W.__still.pos); if (d < nd) { nd = d; near = e } }
        if (near && nd > 2.2) W.__stick((near.pos.x - W.__still.pos.x) / nd, (near.pos.z - W.__still.pos.z) / nd)
        else W.__stick(0, 0)
        // tells: onset tracking; an entry lives on for `grace` after its tell ends (the catch window the sim keeps)
        const graceTicks = Math.round((grace / 1000) * 60)
        for (const e of live) {
          const on = (e.tellIn && e.tellIn() !== null) || e.phase === 'windup'
          const s = seen.get(e)
          if (on && (!s || s.end !== null)) { seen.set(e, { start: i, end: null }); tells++; if (e === leader && e.phase === 'windup') leaderWindups++ }
          else if (!on && s && s.end === null) s.end = i
          const s2 = seen.get(e)
          if (s2 && s2.end !== null && i - s2.end > graceTicks) seen.delete(e)
        }
        const inReach = (e) => dist(e.pos, W.__still.pos) <= reach + (e.radius ?? 0.5) + 0.05
        const telling = live.filter((e) => seen.has(e) && inReach(e) && i - seen.get(e).start >= reactTicks)
        if (telling.length) lastTellTick = i
        let fire = false
        if (policy === 'cleaver' || policy === 'piston' || policy === 'parry-naive') fire = live.some((e) => dist(e.pos, W.__still.pos) <= reach + 0.3)
        else {
          fire = telling.length > 0
          if (policy.includes('hybrid') && !fire && i - lastTellTick >= 90) fire = live.some((e) => dist(e.pos, W.__still.pos) <= reach + 0.3)
        }
        if (fire) {
          const nlog = W.__partLog.length
          W.__fire('arms')
          if (partId === 'parry-clamp' && arg.dial.readyOnCatch && W.__partLog.slice(nlog).some((ev) => ev.kind === 'interrupt' && !ev.by) && C.time * 1000 >= nextReady) {
            W.__hud.ready('arms', 'ember')
            readies++
            nextReady = C.time * 1000 + (arg.dial.icd ?? 0)
          }
        }
        C.hp = 100
        W.__step(1 / 60)
        lost += 100 - C.hp
        for (const ev of W.__partLog) {
          if (ev.kind !== 'interrupt') continue
          if (ev.tell) catchesLog++
          else if (!ev.by) { breaks++; if (ev.enemy === leader) leaderBroken++ }
        }
        W.__partLog.length = 0
      }
      // grace-aware reactive bot: handled by the sim's own grace (the catch window) since the thumb fires on the tell seen
      const st = stat()
      const catches = (st.catches.hulk - c0.hulk) + (st.catches.sentinel - c0.sentinel) + (st.catches.mite - c0.mite)
      out.push({ id: f.id, elite: !!f.elite, kinds: f.kinds.join(' '), casts, readies, catches, catchesLog, breaks, lost, clear, tells, leaderWindups, leaderBroken })
      delete C.useAbility
      def.cooldownMs = saved.cd
      def.range = saved.range
    } finally {
      W.__parryGrace(0)
      Math.random = original
    }
  }
  return out
}

function packsFor(arg) {
  const out = []
  for (let k = 1; k <= arg.levels; k++) {
    const l = window.__genLook(arg.depth, k * 7919)
    l.packs.forEach((p, j) => out.push({ id: `${k}.${j}`, seed: k * 100 + j, kinds: p.kinds, lobbers: p.lobbers, elite: p.elite }))
  }
  return out
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN)
const DIALS = JSON.parse(process.env.DIALS ?? '[{"name":"shipped"}]')

const vite = await startVite()
try {
  const pages = {}
  for (const d of DEPTHS) {
    const q = d >= 6 || process.env.ROADS === '1' ? '?depth=1&save=memory&roads=1' : '?depth=1&save=memory'
    if (!pages[q]) pages[q] = await openPage(vite.url, q)
    const p = pages[q]
    await p.page.evaluate(() => window.__hold(true))
    const fights = await evalJson(p.page, packsFor, { depth: d, levels: LEVELS })
    const nElite = fights.filter((f) => f.elite).length
    console.log(`\n== depth ${d} (${q.includes('roads') ? '9' : '6'}-table): ${fights.length} packs, ${nElite} elite`)
    const rows = {}
    for (const dial of DIALS) {
      for (const policy of POLICIES) {
        if (dial.name !== 'shipped' && !policy.startsWith('parry')) continue
        const t0 = Date.now()
        let r
        for (let attempt = 0; ; attempt++) {
          try {
            r = await evalJson(p.page, run, { depth: d, fights, policy, dial })
            break
          } catch (e) {
            if (attempt >= 3) throw e
            console.log(`  (retry ${policy}: ${String(e).slice(0, 80)})`)
            await p.page.waitForFunction(() => typeof window.__enter === 'function' && window.__level && window.__level(), null, { timeout: 60000 })
            await p.page.evaluate(() => window.__hold(true))
          }
        }
        const key = dial.name === 'shipped' ? policy : `${policy}@${dial.name}`
        rows[key] = r
        const sub = (xs) => ({
          c: mean(xs.map((x) => x.catches)), b: mean(xs.map((x) => x.breaks)), hp: mean(xs.map((x) => x.lost)),
          t: mean(xs.map((x) => (x.clear < 0 ? 60 : x.clear))), un: xs.filter((x) => x.clear < 0).length, tells: mean(xs.map((x) => x.tells)),
          lw: mean(xs.map((x) => x.leaderWindups)), casts: mean(xs.map((x) => x.casts)), rd: mean(xs.map((x) => x.readies)), lb: mean(xs.map((x) => x.leaderBroken)),
        })
        const all = sub(r), el = sub(r.filter((x) => x.elite))
        const base = rows.cleaver ? sub(rows.cleaver) : null, baseE = rows.cleaver ? sub(rows.cleaver.filter((x) => x.elite)) : null
        const paired = (xs, bs) => { const ok = xs.map((x, i) => [x, bs[i]]).filter(([x, b]) => x.clear >= 0 && b.clear >= 0); return [mean(ok.map(([x]) => x.clear)), mean(ok.map(([, b]) => b.clear))] }
        const [pt, pb] = rows.cleaver ? paired(r, rows.cleaver) : [NaN, NaN]
        const [pte, pbe] = rows.cleaver ? paired(r.filter((x) => x.elite), rows.cleaver.filter((x) => x.elite)) : [NaN, NaN]
        const rel = (a, b) => (b ? `${a >= b ? '+' : ''}${((a / b - 1) * 100).toFixed(1)}%` : '-')
        console.log(`${key.padEnd(34)} all: catch ${all.c.toFixed(2)} break ${all.b.toFixed(2)} hp ${all.hp.toFixed(1)} (${rel(all.hp, base?.hp)}) clear ${all.t.toFixed(2)}s (${rel(all.t, base?.t)}) casts ${all.casts.toFixed(1)} rdy ${all.rd.toFixed(2)} uncl ${all.un} pairedClear ${rel(pt, pb)} tells ${all.tells.toFixed(1)} | pairedE ${rel(pte, pbe)} elite: catch ${el.c.toFixed(2)} break ${el.b.toFixed(2)} leaderBreak ${el.lb.toFixed(2)}/${el.lw.toFixed(2)} hp ${el.hp.toFixed(1)} (${rel(el.hp, baseE?.hp)}) clear ${el.t.toFixed(2)}s (${rel(el.t, baseE?.t)})  [${((Date.now() - t0) / 1000).toFixed(0)}s]`)
      }
    }
    if (p.errors.length) console.log('PAGE ERRORS', p.errors.slice(0, 3))
    if (process.env.UNCL) for (const [k, r] of Object.entries(rows)) console.log(k, 'uncleared:', r.filter((x) => x.clear < 0).map((x) => x.kinds + (x.elite ? '*' : '')).join(' / '))
  }
  for (const p of Object.values(pages)) await p.close()
} finally {
  await vite.close()
}
