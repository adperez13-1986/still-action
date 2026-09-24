// Swarm (brood) intake sim for design/enemies/1-balancer.md. Open 20x20 room, no cover, 60 Hz.
// Usage: node swarm-sim.mjs [all|no|auto] ['{"windup":0.55,...}'] [stand,react,straight,wander,reactwander,circle,reactcircle]
// Kits: 'no attacks' measures the intake cap; the others measure clear time and damage taken.
// Simplifications: no walls, bolts hit instantly, Still never takes other damage, cleave cone is 120 deg at reach 3.45.
const P = {
  n: 8, hp: 8, speed: 4.8, inner: 4, innerR: 1.8, outerR: 5.5, orbitSpin: 0.5,
  surgeRange: 2.6, need: 3, windup: 0.55, strike: 0.15, recover: 0.8, regroup: 0.5,
  lead: 0.45, ring: 1.0, bite: 3, refillDelay: 0.5, reaction: 0.35,
}
const STILL = { speed: 5.5, auto: 5, autoInt: 0.62, autoRange: 7.6 }
const HALF = 9.5
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647 })()

function run(behaviour, kit, T = 60, overrides = {}) {
  const p = { ...P, ...overrides }
  const still = { x: 0, z: 0, vx: 0, vz: 0, dirT: 0, ang: rnd() * 6.28 }
  const mites = []
  for (let i = 0; i < p.n; i++) {
    const a = rnd() * 6.28
    mites.push({ x: 7 * Math.sin(a), z: 7 * Math.cos(a), hp: p.hp, role: 'outer', frozen: 0, refill: 0 })
  }
  let base = 0, state = 'gather', t = 0, timer = 0.8, lock = null, parts = [], taken = 0, surges = 0, hits = 0
  let autoT = 0, cleaveT = 1, ventT = 1, react = -1, dodgeTo = null, clearAt = null
  const dt = 1 / 60
  for (let step = 0; step < T * 60; step++) {
    t += dt
    const alive = mites.filter((m) => m.hp > 0)
    if (!alive.length) { clearAt = t; break }
    // roles: nearest 4 are inner (with refill delay)
    alive.sort((a, b) => Math.hypot(a.x - still.x, a.z - still.z) - Math.hypot(b.x - still.x, b.z - still.z))
    const innerCount = alive.filter((m) => m.role === 'inner').length
    for (const m of alive) {
      if (m.role === 'outer' && innerCount < Math.min(p.inner, alive.length)) {
        m.refill += dt
        if (m.refill >= p.refillDelay && alive.filter((q) => q.role === 'inner').length < p.inner) m.role = 'inner'
      }
    }
    // --- still moves ---
    let mx = 0, mz = 0
    if (behaviour === 'straight') { mx = Math.sin(still.ang); mz = Math.cos(still.ang) }
    if (behaviour === 'wander') {
      still.dirT -= dt
      if (still.dirT <= 0) { still.ang = rnd() * 6.28; still.dirT = 0.6 + rnd() * 0.9 }
      mx = Math.sin(still.ang); mz = Math.cos(still.ang)
    }
    if (behaviour === 'circle') {
      const a = Math.atan2(still.x, still.z) + 0.001
      const r = Math.hypot(still.x, still.z)
      if (r < 5.5) { mx = still.x / (r || 1); mz = still.z / (r || 1) } else { mx = Math.cos(a); mz = -Math.sin(a) }
    }
    if (behaviour === 'react' || behaviour === 'reactwander' || behaviour === 'reactcircle') {
      if (behaviour === 'reactcircle' && !dodgeTo) { const a = Math.atan2(still.x, still.z) + 0.001; const r = Math.hypot(still.x, still.z); if (r < 5.5) { mx = still.x / (r || 1); mz = still.z / (r || 1) } else { mx = Math.cos(a); mz = -Math.sin(a) } }
      if (behaviour === 'reactwander') {
        still.dirT -= dt
        if (still.dirT <= 0) { still.ang = rnd() * 6.28; still.dirT = 0.6 + rnd() * 0.9 }
        mx = Math.sin(still.ang); mz = Math.cos(still.ang)
      }
      if (lock && react >= 0) {
        react -= dt
        if (react < 0) {
          // step directly away from the ring centre until clear by 0.3
          const dx = still.x - lock.x, dz = still.z - lock.z, d = Math.hypot(dx, dz)
          const a = d > 0.05 ? Math.atan2(dx, dz) : rnd() * 6.28
          dodgeTo = { x: lock.x + Math.sin(a) * (p.ring + 0.35), z: lock.z + Math.cos(a) * (p.ring + 0.35) }
        }
      }
      if (dodgeTo) {
        const dx = dodgeTo.x - still.x, dz = dodgeTo.z - still.z, d = Math.hypot(dx, dz)
        if (d < 0.1) dodgeTo = null
        else { mx = dx / d; mz = dz / d }
      }
    }
    still.vx = mx * STILL.speed; still.vz = mz * STILL.speed
    still.x += still.vx * dt; still.z += still.vz * dt
    if (Math.abs(still.x) > HALF) { still.x = Math.sign(still.x) * HALF; still.ang = rnd() * 6.28 }
    if (Math.abs(still.z) > HALF) { still.z = Math.sign(still.z) * HALF; still.ang = rnd() * 6.28 }

    // --- brood ---
    base += p.orbitSpin * dt
    timer -= dt
    const inner = alive.filter((m) => m.role === 'inner')
    const outer = alive.filter((m) => m.role === 'outer')
    if (state === 'gather' && timer <= 0) {
      const near = inner.filter((m) => Math.hypot(m.x - still.x, m.z - still.z) <= p.surgeRange)
      if (near.length >= Math.min(p.need, inner.length) && near.length > 0) {
        state = 'windup'; timer = p.windup; surges++
        let lx = still.x + still.vx * p.lead, lz = still.z + still.vz * p.lead
        lx = Math.max(-HALF, Math.min(HALF, lx)); lz = Math.max(-HALF, Math.min(HALF, lz))
        lock = { x: lx, z: lz }; parts = near
        react = p.reaction
      }
    } else if (state === 'windup' && timer <= 0) {
      state = 'recover'; timer = p.strike + p.recover
      const biters = parts.filter((m) => m.hp > 0)
      for (const m of biters) { const a = rnd() * 6.28; m.x = lock.x + Math.sin(a) * 0.5; m.z = lock.z + Math.cos(a) * 0.5 }
      if (Math.hypot(still.x - lock.x, still.z - lock.z) <= p.ring && biters.length) { taken += p.bite * Math.min(biters.length, p.inner); hits++ }
    } else if (state === 'recover' && timer <= 0) {
      state = 'gather'; timer = p.regroup; lock = null; parts = []
    }
    // move mites
    const place = (list, R) => { const sorted = [...list].sort((a, b) => Math.atan2(a.x - still.x, a.z - still.z) - Math.atan2(b.x - still.x, b.z - still.z)); const a0 = sorted.length ? Math.atan2(sorted[0].x - still.x, sorted[0].z - still.z) : 0; sorted.forEach((m, i) => {
      if (parts.includes(m) && state !== 'gather') return
      const a = a0 + p.orbitSpin * dt + (i * 2 * Math.PI) / sorted.length
      const tx = still.x + Math.sin(a) * R, tz = still.z + Math.cos(a) * R
      const dx = tx - m.x, dz = tz - m.z, d = Math.hypot(dx, dz)
      const s = Math.min(d, p.speed * dt)
      if (d > 0.001) { m.x += (dx / d) * s; m.z += (dz / d) * s }
    }) }
    place(inner, p.innerR); place(outer, p.outerR)

    // --- still attacks ---
    if (kit.auto) {
      autoT -= dt
      if (autoT <= 0) {
        const tgt = alive.find((m) => m.hp > 0 && Math.hypot(m.x - still.x, m.z - still.z) <= STILL.autoRange)
        if (tgt) { tgt.hp -= STILL.auto; autoT = STILL.autoInt }
      }
    }
    if (kit.cleave) {
      cleaveT -= dt
      const tgt = alive.find((m) => m.hp > 0 && Math.hypot(m.x - still.x, m.z - still.z) <= 3.7)
      if (cleaveT <= 0 && tgt) {
        const fa = Math.atan2(tgt.x - still.x, tgt.z - still.z)
        for (const m of alive) {
          const d = Math.hypot(m.x - still.x, m.z - still.z)
          if (d > 3.7 - 0.25) continue
          const c = ((m.x - still.x) * Math.sin(fa) + (m.z - still.z) * Math.cos(fa)) / (d || 1)
          if (c >= 0.5) m.hp -= 18
        }
        cleaveT = 2.6
      }
    }
    if (kit.vent) {
      ventT -= dt
      const n = alive.filter((m) => Math.hypot(m.x - still.x, m.z - still.z) <= 4.1).length
      if (ventT <= 0 && n >= 2) {
        for (const m of alive) if (Math.hypot(m.x - still.x, m.z - still.z) <= 4.1) m.hp -= 15
        ventT = 6.5
      }
    }
    for (const m of mites) if (m.hp <= 0 && m.role === 'inner') m.role = 'dead'
  }
  const dur = clearAt ?? T
  return { taken, dps: +(taken / dur).toFixed(2), surges, hits, hitRate: surges ? +(hits / surges).toFixed(2) : 0, clear: clearAt ? +clearAt.toFixed(1) : null }
}

const beh = (process.argv[4] ?? 'stand,react,straight,wander,reactwander,circle,reactcircle').split(',')
const avg = (f, k = 40) => { let acc = { taken: 0, dps: 0, hitRate: 0, clear: 0, cn: 0 }; for (let i = 0; i < k; i++) { const r = f(); acc.taken += r.taken; acc.dps += r.dps; acc.hitRate += r.hitRate; if (r.clear) { acc.clear += r.clear; acc.cn++ } } return { taken: +(acc.taken / k).toFixed(1), dps: +(acc.dps / k).toFixed(2), hitRate: +(acc.hitRate / k).toFixed(2), clear: acc.cn ? +(acc.clear / acc.cn).toFixed(1) : null, clearedRuns: acc.cn } }
const which = process.argv[2] ?? 'all'
const over = process.argv[3] ? JSON.parse(process.argv[3]) : {}
console.log('params', { ...P, ...over })
for (const [name, kit] of [['no attacks (intake cap)', {}], ['auto only', { auto: 1 }], ['auto + cleaver', { auto: 1, cleave: 1 }], ['auto + vent', { auto: 1, vent: 1 }], ['auto + cleaver + vent', { auto: 1, cleave: 1, vent: 1 }]]) {
  if (which !== 'all' && which !== name.split(' ')[0]) continue
  console.log('\n==', name)
  for (const b of beh) console.log(b.padEnd(12), JSON.stringify(avg(() => run(b, kit, name.startsWith('no') ? 30 : 60, over))))
}
