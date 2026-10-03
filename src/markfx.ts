import * as THREE from 'three'
import { DECAL_Y } from './world'
import { RING, markCap } from './cores'
import type { Combat } from './combat'
import type { PartEvent } from './parts'
import type { Enemy } from './enemy'

/**
 * The core's marks, drawn (design/buildlayer/BUILD.md §2.10): a ring at the feet of every body holding marks, filled in thirds (fifths under Deep Frost).
 *
 * The frame budget: **one InstancedMesh per ring segment** (3, and 5 for Deep), each `RING.maxBodies` instances, one shared material. A body with 2 marks
 * takes instance j of segments 0 and 1. So the draw calls this adds are the segment count (3, or 5) whatever the number of marked bodies, and nothing is
 * created after the constructor: Wake's 3-segment and 5-segment sets and Ram's 3-segment set are built once and shown or hidden. A frame's cost is one pass over `combat.statuses()`
 * and a write of 16 floats a mark into preallocated arrays; no allocation unless more than `maxBodies` bodies are marked (then the farthest go undrawn;
 * their marks still count).
 *
 * The look, a departure from the brief (which had one additive material and `instanceColor` for the fade): the ring is **laid over the floor, not added to it**
 * (handring.ts learned that an added cold vanishes on the ruin's lit stone, and washes to flat peach on a warm floor), and each segment carries its own dark
 * rim in the same geometry (vertex colours), so a bright core reads on a dark floor and a dark rim on a bright one, at no extra draw call. The fade is a
 * per-instance alpha attribute (`aAlpha`), since normal blending cannot fade through a colour. Wake's ring is plain and frost-bright. Ram's is cracked (B3, §2.10): a steel-blue band (inner 0.76, COLD_DEEP's family) with two V-notches cut into each arc's
 * inner edge, so the segments read as split stone and not as Wake's frost; it has 3 segments only (Deep Frost is Wake's), so its set adds 3 meshes, and only the worn core's set is ever shown.
 *
 * Thorns' ring (N3, THORNS.md) is a thin cold band with short SPIKES on its outer edge, each arc's own, in a dark rim: barbed wire. Its set is ONE InstancedMesh, not three: every segment is the same arc turned by a multiple of 120
 * degrees, so the instance matrix carries the turn and a ring is up to 3 instances of the one mesh. A body's marks then cost Thorns one draw call (the others, three).
 *
 * Tether's ring (N2, CORES2.md §2) is built the same way (one mesh, turned arcs): a thin cold band with a barb on each arc's trailing end, pointing in, like a hook, under the dark rim.
 */

/** The look. Radii are fractions of the ring's outer radius (1). */
const LOOK = {
  /** The dark rim under the core: [inner, outer], and its opacity. */
  rim: [0.68, 1.0] as const, rimA: 0.62, rimColor: [0.02, 0.04, 0.09] as const,
  /** The cold core band: [inner, outer], and its opacity. */
  core: [0.74, 0.94] as const, coreA: 0.96, coreColor: [0.42, 0.72, 1.0] as const,
  /**
   * Ram's cracked band (§2.10): inner 0.76 (BUILD.md: 0.8; at 0.8 it read thinner than Wake's frost), steel blue (COLD_DEEP's family, lightened so it holds on a dark floor); two V-notches in each arc's inner edge, at `at` (fractions
   * along the arc), `halfDeg` wide at the edge and `depth` (a radius fraction) deep: as deep as the band, so a notch splits it (a crack), and the apex is held 0.01 short of the outer edge.
   */
  crack: { inner: 0.76, outer: 0.95, color: [0.6, 0.78, 0.98] as const, at: [0.33, 0.7] as const, halfDeg: 8, depth: 0.2 },
  /**
   * Thorns' barbed ring (THORNS.md): a thin band [inner, outer] under a dark rim, and `spikes` triangles on each arc, base on the band's outer edge and tip at `tip` (a radius fraction), `half` radians wide at the base,
   * evenly spread along the arc (a spike at (i + 0.5) / spikes of it). The dark rim carries the spikes too, a little bigger (`rimGrow`), so they hold on a bright floor.
   */
  barb: { band: [0.66, 0.8] as const, rim: [0.6, 0.84] as const, spikes: 4, tip: 1.0, half: 0.085, rimGrow: 0.03 },
  /** Tether's hooked ring (§2): one thin band, and a barb at each arc's trailing end (radii [inner, outer], and how far along the arc it runs, radians, from the end). */
  hook: { band: [0.72, 0.94] as const, rim: [0.66, 1.0] as const, barb: [0.44, 0.72] as const, barbRim: [0.4, 0.74] as const, barbLen: 0.2, barbCore: [0.03, 0.15] as const },
  /** Triangles along a full circle. */
  steps: 36,
  /** The floor lift above the decals' DECAL_Y. */
  lift: 0.02,
  /** Each segment's start, so the first third sits at the back-left and they fill clockwise on screen. */
  startDeg: 90,
}
/** Breaks running at once (a spend's last RING.breakS): a nova spending a pack fills them, the oldest is recycled. */
const DRAINS = 24
const MAX_SEG = 5
/** The ring sets, by name (a fixed list: a frame loops over it without allocating). */
const SET_NAMES = ['wake3', 'wake5', 'ram3', 'thorns3', 'tether3'] as const

const FLOOR_Y = DECAL_Y + LOOK.lift

/** One band of an arc on the floor, appended to the position / colour arrays: radii r0..r1, from angle a0 to a1 (radians), in `steps` quads. The material is double-sided. */
function band(pos: number[], col: number[], r0: number, r1: number, a0: number, a1: number, steps: number, rgb: readonly number[], alpha: number) {
  for (let i = 0; i < steps; i++) {
    const t0 = a0 + ((a1 - a0) * i) / steps
    const t1 = a0 + ((a1 - a0) * (i + 1)) / steps
    // the quad's corners: inner at t0, inner at t1, outer at t0, outer at t1; two triangles
    const c: [number, number][] = [[Math.cos(t0) * r0, Math.sin(t0) * r0], [Math.cos(t1) * r0, Math.sin(t1) * r0], [Math.cos(t0) * r1, Math.sin(t0) * r1], [Math.cos(t1) * r1, Math.sin(t1) * r1]]
    for (const k of [0, 1, 2, 1, 3, 2]) {
      const [x, z] = c[k]!
      pos.push(x, 0, z)
      col.push(rgb[0]!, rgb[1]!, rgb[2]!, alpha)
    }
  }
}

/** A band whose inner radius varies with the angle (`inner(t)`, t from 0 to 1 along the arc), for the cracked look: radii inner(t)..r1 from angle a0 to a1, `steps` quads. */
function jagged(pos: number[], col: number[], inner: (t: number) => number, r1: number, a0: number, a1: number, steps: number, rgb: readonly number[], alpha: number) {
  for (let i = 0; i < steps; i++) {
    const u0 = i / steps
    const u1 = (i + 1) / steps
    const t0 = a0 + (a1 - a0) * u0
    const t1 = a0 + (a1 - a0) * u1
    const r00 = inner(u0)
    const r01 = inner(u1)
    const c: [number, number][] = [[Math.cos(t0) * r00, Math.sin(t0) * r00], [Math.cos(t1) * r01, Math.sin(t1) * r01], [Math.cos(t0) * r1, Math.sin(t0) * r1], [Math.cos(t1) * r1, Math.sin(t1) * r1]]
    for (const k of [0, 1, 2, 1, 3, 2]) {
      const [x, z] = c[k]!
      pos.push(x, 0, z)
      col.push(rgb[0]!, rgb[1]!, rgb[2]!, alpha)
    }
  }
}

/** One spike on the floor: a triangle with its base on radius `r0`, `half` radians either side of angle `t`, and its tip at radius `r1` on `t`. */
function spike(pos: number[], col: number[], r0: number, r1: number, t: number, half: number, rgb: readonly number[], alpha: number) {
  for (const [x, z] of [[Math.cos(t - half) * r0, Math.sin(t - half) * r0], [Math.cos(t + half) * r0, Math.sin(t + half) * r0], [Math.cos(t) * r1, Math.sin(t) * r1]] as const) {
    pos.push(x, 0, z)
    col.push(rgb[0]!, rgb[1]!, rgb[2]!, alpha)
  }
}

/** Segment `i` of `cap`: a dark rim band and the cold band on it, an arc of 360 / cap less the gap. Unit outer radius. `look`: Wake's plain frost band, or Ram's cracked one. */
function segmentGeometry(i: number, cap: number, look: 'wake' | 'ram' | 'thorns' | 'tether', instances = RING.maxBodies + DRAINS): THREE.BufferGeometry {
  const span = (Math.PI * 2) / cap
  const gap = (RING.gapDeg * Math.PI) / 180
  // clockwise on screen: the angle runs the other way over the floor
  const a0 = (LOOK.startDeg * Math.PI) / 180 - i * span - gap / 2
  const a1 = a0 - (span - gap)
  const pos: number[] = []
  const col: number[] = []
  const steps = Math.max(4, Math.round((LOOK.steps * (span - gap)) / (Math.PI * 2)))
  if (look === 'wake') {
    band(pos, col, LOOK.rim[0], LOOK.rim[1], a0, a1, steps, LOOK.rimColor, LOOK.rimA)
    band(pos, col, LOOK.core[0], LOOK.core[1], a0, a1, steps, LOOK.coreColor, LOOK.coreA)
  } else if (look === 'thorns') {
    const B = LOOK.barb
    band(pos, col, B.rim[0], B.rim[1], a0, a1, steps, LOOK.rimColor, LOOK.rimA)
    band(pos, col, B.band[0], B.band[1], a0, a1, steps, LOOK.coreColor, LOOK.coreA)
    // the spikes, evenly along the arc: a dark one a little bigger under a cold one
    for (let k = 0; k < B.spikes; k++) {
      const t = a0 + ((a1 - a0) * (k + 0.5)) / B.spikes
      spike(pos, col, B.band[1] - 0.02, B.tip + B.rimGrow, t, B.half + B.rimGrow, LOOK.rimColor, LOOK.rimA)
      spike(pos, col, B.band[1] - 0.02, B.tip, t, B.half, LOOK.coreColor, LOOK.coreA)
    }
  } else if (look === 'tether') {
    const H = LOOK.hook
    band(pos, col, H.rim[0], H.rim[1], a0, a1, steps, LOOK.rimColor, LOOK.rimA)
    band(pos, col, H.band[0], H.band[1], a0, a1, steps, LOOK.coreColor, LOOK.coreA)
    // the barb, at the arc's trailing end (a1), reaching in
    band(pos, col, H.barbRim[0], H.barbRim[1], a1, a1 + H.barbLen, 3, LOOK.rimColor, LOOK.rimA)
    band(pos, col, H.barb[0], H.barb[1], a1 + H.barbCore[0], a1 + H.barbCore[1], 3, LOOK.coreColor, LOOK.coreA)
  } else {
    const K = LOOK.crack
    band(pos, col, LOOK.rim[0], LOOK.rim[1], a0, a1, steps, LOOK.rimColor, LOOK.rimA)
    // fine steps, so a notch is a V and not a block: the angle of one step is a fraction of the notch's half-width
    const fine = Math.max(24, Math.round(((span - gap) * 180) / Math.PI / 1.5))
    const half = (K.halfDeg * Math.PI) / 180 / (span - gap)
    const inner = (t: number) => {
      let r = K.inner
      for (const at of K.at) r = Math.max(r, K.inner + K.depth * Math.max(0, 1 - Math.abs(t - at) / half))
      return Math.min(r, K.outer - 0.01)
    }
    jagged(pos, col, inner, K.outer, a0, a1, fine, K.color, LOOK.coreA)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  g.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(instances), 1))
  return g
}

export class MarkFx {
  readonly group = new THREE.Group()
  private readonly mat: THREE.MeshBasicMaterial
  /** Segment meshes by ring: Wake's 3 and 5 (Deep Frost), Ram's 3 (cracked), Thorns' one (its segments are instances, turned). Built once. */
  private readonly sets: Record<(typeof SET_NAMES)[number], THREE.InstancedMesh[]> = { wake3: [], wake5: [], ram3: [], thorns3: [], tether3: [] }
  // one frame's gathered rings: where, how big, how many segments, how opaque, how shrunk
  private readonly gx = new Float32Array(RING.maxBodies + DRAINS)
  private readonly gz = new Float32Array(RING.maxBodies + DRAINS)
  private readonly gr = new Float32Array(RING.maxBodies + DRAINS)
  private readonly gn = new Uint8Array(RING.maxBodies + DRAINS)
  private readonly ga = new Float32Array(RING.maxBodies + DRAINS)
  private readonly gd = new Float32Array(RING.maxBodies + DRAINS)
  /** Rings breaking outward in a spend: a ring of `dn` segments at (dx, dz), age `dt` of RING.breakS. dn 0: free. */
  private readonly dx = new Float32Array(DRAINS)
  private readonly dz = new Float32Array(DRAINS)
  private readonly dr = new Float32Array(DRAINS)
  private readonly dn = new Uint8Array(DRAINS)
  private readonly dt = new Float32Array(DRAINS)
  private dNext = 0
  /** Bodies whose ring is swelling from a mark that just landed: seconds since. Cleared as they settle. */
  private readonly pops = new Map<Enemy, number>()
  /** Game seconds drawn, for the cap's pulse. */
  private clock = 0
  /** Marked bodies in the last frame, drawn and not (the log of the cap). */
  drawn = 0
  skipped = 0

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      // a transparent double-sided material is drawn twice (back faces, then front) unless told otherwise: one draw call a segment, not two
      forceSinglePass: true,
    })
    // a per-instance alpha: the fade of a ring that is running out, and the drain of one being spent
    this.mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;')
    }
    for (const [name, look, cap] of [['wake3', 'wake', 3], ['wake5', 'wake', 5], ['ram3', 'ram', 3]] as const) {
      for (let i = 0; i < cap; i++) {
        const m = new THREE.InstancedMesh(segmentGeometry(i, cap, look), this.mat, RING.maxBodies + DRAINS)
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
        m.frustumCulled = false
        m.visible = false
        m.count = 0
        // over the floor and its decals, under every tell (tellOrder starts near 1000) and under the hand's ring's neighbours
        m.renderOrder = 2
        m.name = `marks-${cap}-${i}${look === 'ram' ? '-ram' : ''}`
        this.group.add(m)
        this.sets[name].push(m)
      }
    }
    // Thorns' and Tether's: one arc each, instanced three times a body at 120-degree turns (drawTurned)
    for (const [name, look] of [['thorns3', 'thorns'], ['tether3', 'tether']] as const) {
      const gz = new THREE.InstancedMesh(segmentGeometry(0, 3, look, (RING.maxBodies + DRAINS) * 3), this.mat, (RING.maxBodies + DRAINS) * 3)
      gz.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      gz.frustumCulled = false
      gz.visible = false
      gz.count = 0
      gz.renderOrder = 2
      gz.name = `marks-3-${look}`
      this.group.add(gz)
      this.sets[name].push(gz)
    }
    scene.add(this.group)
  }

  /**
   * A spend: the body's rings break outward and fade. The marks are already gone from the body, so the ring is drawn from here until it has gone. A mark that landed (`added` above 0)
   * swells its body's ring for a beat.
   */
  event(ev: PartEvent) {
    if (ev.kind === 'mark') {
      if (ev.added > 0) this.pops.set(ev.enemy, 0)
      return
    }
    if (ev.kind !== 'spend') return
    this.pops.delete(ev.enemy)
    const k = this.dNext
    this.dNext = (k + 1) % DRAINS
    this.dx[k] = ev.enemy.pos.x
    this.dz[k] = ev.enemy.pos.z
    this.dr[k] = Math.max(RING.minR, ev.enemy.radius * RING.perRadius)
    this.dn[k] = Math.min(MAX_SEG, ev.n)
    this.dt[k] = 0
  }

  /** A ring's size factor now: the swell of a mark that just landed, and at the cap a slow gentle pulse ("full, cash it"). */
  private look(e: Enemy, n: number, cap: number, dt: number): number {
    let f = 1
    const age = this.pops.get(e)
    if (age !== undefined) {
      const a = age + dt
      if (a >= RING.popS) this.pops.delete(e)
      else {
        this.pops.set(e, a)
        // up fast, settling slowly: a sine over the first half, down through the rest
        const u = a / RING.popS
        f += RING.popAmt * (u < 0.3 ? u / 0.3 : (1 - u) / 0.7)
      }
    }
    if (n >= cap) f += RING.pulseAmp * Math.sin(this.clock * Math.PI * 2 * RING.pulseHz)
    return f
  }

  /** A new level, or a run's end: nothing draining. */
  clear() {
    this.dn.fill(0)
    this.pops.clear()
    for (const name of SET_NAMES) for (const m of this.sets[name]) { m.count = 0; m.visible = false }
  }

  /**
   * One rendered frame's rings (`dt` real seconds, for the drains). `from`: Still's place, for who is left undrawn past `maxBodies`.
   * With no core worn, nothing is drawn.
   */
  draw(combat: Combat, dt: number, fromX: number, fromZ: number) {
    const core = combat.core
    const cap = core ? (markCap(core, combat.keystone) >= 5 ? 5 : 3) : 0
    const which = core === 'wake' ? (cap === 5 ? 'wake5' : 'wake3') : core === 'ram' ? 'ram3' : core === 'thorns' ? 'thorns3' : core === 'tether' ? 'tether3' : null
    if (!cap || !which) {
      this.hideAll()
      this.drawn = this.skipped = 0
      return
    }
    this.clock += dt
    const max = RING.maxBodies
    let g = 0
    let over = 0
    for (const [e, st] of combat.statuses()) {
      const m = st.marks
      if (m.n <= 0 || e.dead) continue
      if (g >= max) {
        over++
        continue
      }
      this.gx[g] = e.pos.x
      this.gz[g] = e.pos.z
      this.gr[g] = Math.max(RING.minR, e.radius * RING.perRadius)
      this.gn[g] = Math.min(cap, m.n)
      // the last RING.fadeS of life dims it
      this.ga[g] = m.t >= RING.fadeS ? 1 : Math.max(0, m.t / RING.fadeS)
      this.gd[g] = this.look(e, m.n, cap, dt)
      g++
    }
    if (over > 0) g = this.nearest(combat, fromX, fromZ, cap, dt)
    this.drawn = g
    this.skipped = over
    // the rings breaking outward in a spend: bigger and fainter as they go
    for (let k = 0; k < DRAINS; k++) {
      if (this.dn[k] === 0) continue
      const age = this.dt[k]! + dt
      this.dt[k] = age
      const f = age / RING.breakS
      if (f >= 1) {
        this.dn[k] = 0
        continue
      }
      if (g >= this.gx.length) continue
      const ease = 1 - (1 - f) * (1 - f)
      this.gx[g] = this.dx[k]!
      this.gz[g] = this.dz[k]!
      this.gr[g] = this.dr[k]!
      this.gn[g] = Math.min(cap, this.dn[k]!)
      this.ga[g] = 1 - f * f
      this.gd[g] = 1 + RING.breakGrow * ease
      g++
    }
    const meshes = this.sets[which]
    for (const name of SET_NAMES) if (name !== which) for (const m of this.sets[name]) m.visible = false
    if (which === 'thorns3' || which === 'tether3') {
      this.drawTurned(meshes[0]!, g, cap)
      return
    }
    for (let s = 0; s < meshes.length; s++) {
      const mesh = meshes[s]!
      const mat = mesh.instanceMatrix.array as Float32Array
      const alpha = (mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).array as Float32Array
      let j = 0
      for (let b = 0; b < g; b++) {
        if (this.gn[b]! <= s) continue
        const sc = this.gr[b]! * this.gd[b]!
        const o = j * 16
        mat[o] = sc; mat[o + 1] = 0; mat[o + 2] = 0; mat[o + 3] = 0
        mat[o + 4] = 0; mat[o + 5] = sc; mat[o + 6] = 0; mat[o + 7] = 0
        mat[o + 8] = 0; mat[o + 9] = 0; mat[o + 10] = sc; mat[o + 11] = 0
        mat[o + 12] = this.gx[b]!; mat[o + 13] = FLOOR_Y; mat[o + 14] = this.gz[b]!; mat[o + 15] = 1
        alpha[j] = this.ga[b]!
        j++
      }
      mesh.count = j
      mesh.visible = j > 0
      if (j > 0) {
        mesh.instanceMatrix.needsUpdate = true
        ;(mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true
      }
    }
  }

  /** Thorns' and Tether's ring: segment s of a body is the one arc turned by -s x (360 / cap) degrees (clockwise on screen, like the others), an instance each. */
  private drawTurned(mesh: THREE.InstancedMesh, g: number, cap: number) {
    const mat = mesh.instanceMatrix.array as Float32Array
    const alpha = (mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).array as Float32Array
    const span = (Math.PI * 2) / cap
    let j = 0
    for (let b = 0; b < g; b++) {
      const sc = this.gr[b]! * this.gd[b]!
      for (let s = 0; s < this.gn[b]!; s++) {
        const c = Math.cos(-s * span) * sc
        const n = Math.sin(-s * span) * sc
        const o = j * 16
        mat[o] = c; mat[o + 1] = 0; mat[o + 2] = n; mat[o + 3] = 0
        mat[o + 4] = 0; mat[o + 5] = sc; mat[o + 6] = 0; mat[o + 7] = 0
        mat[o + 8] = -n; mat[o + 9] = 0; mat[o + 10] = c; mat[o + 11] = 0
        mat[o + 12] = this.gx[b]!; mat[o + 13] = FLOOR_Y; mat[o + 14] = this.gz[b]!; mat[o + 15] = 1
        alpha[j] = this.ga[b]!
        j++
      }
    }
    mesh.count = j
    mesh.visible = j > 0
    if (j > 0) {
      mesh.instanceMatrix.needsUpdate = true
      ;(mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true
    }
  }

  /** More marked bodies than `maxBodies`: keep the nearest to Still. Rare (a deep pack with everything marked): it may allocate. Returns how many are kept. */
  private nearest(combat: Combat, fx: number, fz: number, cap: number, dt: number): number {
    const all: { x: number; z: number; r: number; n: number; a: number; d: number; s: number }[] = []
    for (const [e, st] of combat.statuses()) {
      const m = st.marks
      if (m.n <= 0 || e.dead) continue
      all.push({ x: e.pos.x, z: e.pos.z, r: Math.max(RING.minR, e.radius * RING.perRadius), n: Math.min(cap, m.n), a: m.t >= RING.fadeS ? 1 : Math.max(0, m.t / RING.fadeS), d: (e.pos.x - fx) ** 2 + (e.pos.z - fz) ** 2, s: this.look(e, m.n, cap, dt) })
    }
    all.sort((a, b) => a.d - b.d)
    const keep = Math.min(all.length, RING.maxBodies)
    for (let i = 0; i < keep; i++) {
      const o = all[i]!
      this.gx[i] = o.x; this.gz[i] = o.z; this.gr[i] = o.r; this.gn[i] = o.n; this.ga[i] = o.a; this.gd[i] = o.s
    }
    this.skipped = all.length - keep
    return keep
  }

  private hideAll() {
    for (const name of SET_NAMES) for (const m of this.sets[name]) if (m.visible) { m.visible = false; m.count = 0 }
  }

  dispose() {
    this.group.removeFromParent()
    for (const name of SET_NAMES) for (const m of this.sets[name]) { m.geometry.dispose(); m.dispose() }
    this.mat.dispose()
  }
}
