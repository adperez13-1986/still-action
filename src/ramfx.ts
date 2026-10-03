import * as THREE from 'three'
import { DECAL_Y } from './world'
import { HAND_REACH } from './combat'

/**
 * Ram, drawn (design/buildlayer/SHOW.md item 10): the shove's reach as a ring round Still, a wedge of it that pulses at each beat shove, and what a slam leaves on the floor. Two meshes, so two
 * draw calls whatever happens; nothing is created after the constructor, and with another core or none worn both are hidden. No Math.random: every spread is a function of an index.
 *
 * The reach is drawn where the shove's own test puts it: combat.ts inReach is `distance to the body's centre <= range + MELEE_PAD + radius - 0.55`, i.e. a body whose EDGE is within HAND_REACH of him.
 * The ring has Ram's notched look (markfx.ts: a steel band with V-notches cut into its inner edge, under a dark rim) and sits dim; a beat shove lights the wedge facing the body it moved and sends it a little outward.
 */
const REACH = {
  /** Brightness of the ring at rest, and the brightness a pulse adds at its peak. */
  idle: 0.2, pulse: 0.85,
  /** A pulse: how long, s; how far out it travels (a share of the ring's radius); how wide the wedge is (cosine of its half-angle: 0.6 is 53 degrees). */
  pulseS: 0.22, travel: 0.1, wedgeCos: 0.6,
  /** V-notches round the ring. */
  notches: 18,
  /** The plane reaches this far past the ring (a share of its radius), for the dark rim. */
  pad: 1.1,
  lift: 0.03,
}
const PULSES = 2
const COLD = [0.6, 0.78, 0.98] as const
const DARK = [0.02, 0.04, 0.09] as const

const REACH_VERT = `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const REACH_FRAG = `
uniform vec3 uPulse[${PULSES}];
varying vec2 vP;
const float TAU = 6.2831853;
// the notched band at radius d (the ring is 1): the inner edge is cut by V-notches round it
float band(float d, float ang) {
  float t = abs(fract(ang * ${REACH.notches.toFixed(1)} / TAU) - 0.5) * 2.0;
  float inner = 0.9 + 0.055 * (1.0 - smoothstep(0.0, 0.4, t));
  return smoothstep(inner - 0.01, inner + 0.01, d) * (1.0 - smoothstep(0.972, 0.99, d));
}
void main() {
  float d = length(vP);
  if (d > ${REACH.pad.toFixed(3)}) discard;
  float ang = atan(vP.y, vP.x);
  float idle = band(d, ang) * ${REACH.idle.toFixed(3)};
  float rim = smoothstep(0.87, 0.9, d) * (1.0 - smoothstep(0.99, 1.03, d));
  float lit = idle;
  for (int k = 0; k < ${PULSES}; k++) {
    float u = uPulse[k].z;
    if (u > 1.0) continue;
    // the wedge facing the body: its band is drawn a little further out as the pulse ages, and fades
    vec2 dir = uPulse[k].xy;
    float wedge = smoothstep(${REACH.wedgeCos.toFixed(2)}, 0.95, dot(vP / max(d, 1e-4), dir));
    float dd = d / (1.0 + ${REACH.travel.toFixed(3)} * u);
    lit = max(lit, band(dd, ang) * wedge * (1.0 - u) * ${REACH.pulse.toFixed(2)});
  }
  float aDark = rim * 0.6 * max(${REACH.idle.toFixed(3)} * 2.5, lit);
  float a = lit + aDark * (1.0 - lit);
  if (a < 0.004) discard;
  vec3 cold = vec3(${COLD[0]}, ${COLD[1]}, ${COLD[2]});
  vec3 dark = vec3(${DARK[0]}, ${DARK[1]}, ${DARK[2]});
  vec3 rgb = (cold * lit + dark * aDark * (1.0 - lit)) / a;
  gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0));
}`

/** What a slam leaves (SHOW.md item 10b): `SLOTS` pooled at once, the oldest recycled. */
const SLAM = {
  slots: 6,
  /** The streak along the body's path and the crack at the impact: lives, s. */
  streakS: 0.4, crackS: 0.8,
  /** Streak: its widest, u (at the head, where the body ended). Crack: spokes, their length range, u, and their width, u. */
  streakW: 0.55, spokes: 6, spokeMin: 0.55, spokeMax: 1.0, spokeW: 0.14,
  /** The crack's first beat grows from nothing, s. */
  popS: 0.08,
  lift: 0.025,
}
/** Vertices a slot owns: the streak's dark underlay and cold band (4 each), then each spoke's cold glow and dark crack (3 each). */
const SLOT_V = 8 + SLAM.spokes * 6

export class ShoveFx {
  private readonly reach: THREE.Mesh
  private readonly reachMat: THREE.ShaderMaterial
  private readonly slam: THREE.Mesh
  private readonly slamGeo: THREE.BufferGeometry
  private readonly slamMat: THREE.MeshBasicMaterial
  private readonly pos: Float32Array
  private readonly col: Float32Array
  // each slot: its path, its impact, the way the spokes start, and its age (negative: free)
  private readonly sx = new Float32Array(SLAM.slots)
  private readonly sz = new Float32Array(SLAM.slots)
  private readonly ax = new Float32Array(SLAM.slots)
  private readonly az = new Float32Array(SLAM.slots)
  private readonly ph = new Float32Array(SLAM.slots)
  private readonly age = new Float32Array(SLAM.slots).fill(-1)
  private next = 0
  /** Slams drawn since the level began: the spokes' phase, so each crack is its own and none is random. */
  private served = 0
  private readonly pulses: THREE.Vector3[] = []
  private pulseNext = 0
  /** A pulse's age in game seconds, by slot of `pulses`. */
  private readonly pAge = new Float32Array(PULSES).fill(9)

  constructor(scene: THREE.Scene) {
    const R = HAND_REACH
    for (let i = 0; i < PULSES; i++) this.pulses.push(new THREE.Vector3(1, 0, 9))
    this.reachMat = new THREE.ShaderMaterial({
      vertexShader: REACH_VERT, fragmentShader: REACH_FRAG, transparent: true, depthWrite: false, fog: false,
      uniforms: { uPulse: { value: this.pulses } },
    })
    // the shader reads positions in ring radii (1 = the reach); the mesh's scale is the reach
    const g = new THREE.PlaneGeometry(2 * REACH.pad, 2 * REACH.pad)
    this.reach = new THREE.Mesh(g, this.reachMat)
    this.reach.scale.setScalar(R)
    this.reach.rotation.x = -Math.PI / 2
    this.reach.frustumCulled = false
    this.reach.visible = false
    // over the floor and the marks' rings, under every tell
    this.reach.renderOrder = 1
    this.reach.name = 'ram-reach'

    this.pos = new Float32Array(SLAM.slots * SLOT_V * 3)
    this.col = new Float32Array(SLAM.slots * SLOT_V * 4)
    const idx: number[] = []
    for (let s = 0; s < SLAM.slots; s++) {
      const o = s * SLOT_V
      // the streak: a quad dark under a quad cold, then each spoke's glow under its crack
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 4, o + 5, o + 6, o + 5, o + 7, o + 6)
      for (let j = 0; j < SLAM.spokes; j++) {
        const b = o + 8 + j * 6
        idx.push(b, b + 1, b + 2, b + 3, b + 4, b + 5)
      }
    }
    this.slamGeo = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(this.pos, 3)
    const ca = new THREE.BufferAttribute(this.col, 4)
    pa.setUsage(THREE.DynamicDrawUsage)
    ca.setUsage(THREE.DynamicDrawUsage)
    this.slamGeo.setAttribute('position', pa)
    this.slamGeo.setAttribute('color', ca)
    this.slamGeo.setIndex(idx)
    this.slamMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true })
    this.slam = new THREE.Mesh(this.slamGeo, this.slamMat)
    this.slam.frustumCulled = false
    this.slam.visible = false
    this.slam.renderOrder = 2
    this.slam.name = 'ram-slam'
    scene.add(this.reach, this.slam)
  }

  /** A beat shove: the wedge of the ring facing (dx, dz) from Still (the way to the body) pulses. */
  pulse(dx: number, dz: number) {
    const d = Math.hypot(dx, dz)
    if (d < 1e-4) return
    const k = this.pulseNext
    this.pulseNext = (k + 1) % PULSES
    // the plane's local y is the floor's -z
    this.pulses[k]!.set(dx / d, -dz / d, 0)
    this.pAge[k] = 0
  }

  /** A slam: the body went from (sx, sz) to the contact point (ax, az). A steel streak along it, and a crack where it hit. */
  slammed(sx: number, sz: number, ax: number, az: number) {
    const i = this.next
    this.next = (i + 1) % SLAM.slots
    this.sx[i] = sx
    this.sz[i] = sz
    this.ax[i] = ax
    this.az[i] = az
    this.ph[i] = this.served * 2.399 + 0.6
    this.served++
    this.age[i] = 0
  }

  /** A new level, a run's end or the core off: nothing up. */
  clear() {
    this.age.fill(-1)
    this.pAge.fill(9)
    for (const p of this.pulses) p.z = 9
    this.col.fill(0)
    this.slamGeo.getAttribute('color').needsUpdate = true
    this.slam.visible = false
    this.served = 0
  }

  /** One rendered frame (`dt` real seconds, 0 while paused). `on`: Ram is worn in a crawl. (x, z) is Still's place. */
  update(on: boolean, dt: number, x: number, z: number) {
    if (!on) {
      if (this.reach.visible || this.slam.visible) {
        this.reach.visible = false
        this.clear()
      }
      return
    }
    this.reach.visible = true
    this.reach.position.set(x, DECAL_Y + REACH.lift, z)
    for (let k = 0; k < PULSES; k++) {
      this.pAge[k] = this.pAge[k]! + dt
      this.pulses[k]!.z = this.pAge[k]! / REACH.pulseS
    }
    if (dt <= 0 && !this.slam.visible) return
    const was = this.slam.visible
    let any = false
    for (let i = 0; i < SLAM.slots; i++) {
      if (this.age[i]! < 0) continue
      const a = this.age[i]! + dt
      this.age[i] = a
      if (a >= SLAM.crackS) {
        this.age[i] = -1
        this.writeSlot(i, 0, 0)
        continue
      }
      any = true
      this.writeSlot(i, a / SLAM.streakS, a / SLAM.crackS)
    }
    this.slam.visible = any
    if (any || was) {
      ;(this.slamGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(this.slamGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    }
  }

  /** One slot's vertices at `fs` of the streak's life and `fc` of the crack's; at 0 and 0 it is nothing. */
  private writeSlot(i: number, fs: number, fc: number) {
    const o = i * SLOT_V
    const Y = DECAL_Y + SLAM.lift
    const set = (v: number, px: number, pz: number, rgb: readonly number[], a: number, dy = 0) => {
      const q = (o + v) * 3
      this.pos[q] = px; this.pos[q + 1] = Y + dy; this.pos[q + 2] = pz
      const c = (o + v) * 4
      this.col[c] = rgb[0]!; this.col[c + 1] = rgb[1]!; this.col[c + 2] = rgb[2]!; this.col[c + 3] = a
    }
    if (fc <= 0 && fs <= 0) {
      for (let v = 0; v < SLOT_V; v++) set(v, 0, 0, DARK, 0)
      return
    }
    // the streak: tail (where it started) to head (where it hit); the head end is wide and bright, the tail a point that is already gone
    const dx = this.ax[i]! - this.sx[i]!
    const dz = this.az[i]! - this.sz[i]!
    const len = Math.hypot(dx, dz)
    const ux = len > 1e-4 ? dx / len : 1
    const uz = len > 1e-4 ? dz / len : 0
    const nx = -uz
    const nz = ux
    const sa = fs >= 1 || len < 0.2 ? 0 : (1 - fs) * (1 - fs)
    // the tail shortens toward the head as it fades
    const tx = this.sx[i]! + dx * Math.min(1, fs) * 0.6
    const tz = this.sz[i]! + dz * Math.min(1, fs) * 0.6
    const hw = SLAM.streakW * 0.5
    for (const [base, rgb, w, a] of [[0, DARK, hw * 1.35, sa * 0.4], [4, COLD, hw, sa * 0.85]] as const) {
      set(base, tx, tz, rgb, 0)
      set(base + 1, tx, tz, rgb, 0)
      set(base + 2, this.ax[i]! + nx * w, this.az[i]! + nz * w, rgb, 0)
      set(base + 3, this.ax[i]! - nx * w, this.az[i]! - nz * w, rgb, 0)
      // the head's two corners carry the alpha; the tail's two are one point at none
      this.col[(o + base + 2) * 4 + 3] = a
      this.col[(o + base + 3) * 4 + 3] = a
    }
    // the crack: spokes out of the contact point, each a thin dark wedge on a cold glow, the first beat growing out of nothing, then fading
    const grow = Math.min(1, (fc * SLAM.crackS) / SLAM.popS)
    const fade = fc >= 1 ? 0 : 1 - fc * fc
    for (let j = 0; j < SLAM.spokes; j++) {
      const ang = this.ph[i]! + (j / SLAM.spokes) * Math.PI * 2 + 0.3 * Math.sin(j * 2.1 + this.ph[i]!)
      const L = (SLAM.spokeMin + (SLAM.spokeMax - SLAM.spokeMin) * (((j * 5 + i) % 4) / 3)) * grow
      const cx = Math.cos(ang)
      const cz = Math.sin(ang)
      const px = -cz
      const pz = cx
      const b = 8 + j * 6
      const w = SLAM.spokeW
      // glow: wider, cold; crack: narrow, dark, over it
      set(b, this.ax[i]! + px * w * 1.6, this.az[i]! + pz * w * 1.6, COLD, 0.55 * fade)
      set(b + 1, this.ax[i]! - px * w * 1.6, this.az[i]! - pz * w * 1.6, COLD, 0.55 * fade)
      set(b + 2, this.ax[i]! + cx * L, this.az[i]! + cz * L, COLD, 0)
      set(b + 3, this.ax[i]! + px * w * 0.6, this.az[i]! + pz * w * 0.6, DARK, 0.85 * fade, 0.001)
      set(b + 4, this.ax[i]! - px * w * 0.6, this.az[i]! - pz * w * 0.6, DARK, 0.85 * fade, 0.001)
      set(b + 5, this.ax[i]! + cx * L, this.az[i]! + cz * L, DARK, 0, 0.001)
    }
  }

  dispose() {
    this.reach.removeFromParent()
    this.slam.removeFromParent()
    this.reach.geometry.dispose()
    this.reachMat.dispose()
    this.slamGeo.dispose()
    this.slamMat.dispose()
  }
}
