import * as THREE from 'three'
import { CORES } from './cores'
import type { Combat } from './combat'
import type { PartEvent } from './parts'

/**
 * Tether, drawn (design/buildlayer/CORES2.md §2, "the look"): the WIRE and the hook glyph over its anchor. Two draw calls whatever happens (the third is markfx.ts's ring); nothing is created after the constructor, and
 * with another core or none worn both are hidden. Nothing random: every number is a function of the frame and of the events.
 *
 * The wire is ONE mesh: a flat ribbon at chest height from Still to the anchor, slightly slack (a shallow bow that goes taut as it nears `breakR`), a wide dark underlay beneath a thin cold core (so it holds on a bright floor and a
 * dark one, as markfx's rings do). Second Line's second wire is two more ribbons of the same mesh. It is drawn from `combat.wires`, the very ends the sweep tests, bowed at most 0.02 of its length (0.2 u at the longest, inside
 * the 0.4 u reach). A crossing sends a bright pulse along it from the crossing point, which fades; a hook throws it out to the anchor in `HOOK_S`; a break leaves two halves that recoil to their ends and fade in `SNAP_S`.
 * The glyph is a camera-facing J on the anchor's head, one instanced quad per wire, which pulses on the anchor's tick.
 */
const LOOK = {
  /** Width (u) of the cold core and of its dark underlay; the underlay's opacity. */
  width: 0.1, darkWidth: 0.26, darkA: 0.42,
  /** The core's opacity at rest and its colour; the dark's. */
  coreA: 0.9, core: [0.8, 0.94, 1.0] as const, dark: [0.02, 0.04, 0.09] as const,
  /** The wire's height at Still's chest, and the most the anchor's end is lifted (a share of its height); how far it sags in the middle (u). */
  chestY: 0.9, anchorShare: 0.55, anchorMinY: 0.5, sag: 0.1,
  /** The shallow bow, a share of the length, and its sway; a wire taut past `tautFrom` u loses it by `breakR`. */
  bow: 0.02, sway: 0.4, swayHz: 0.5, tautFrom: 8,
  /** The wire starts this far from his centre, toward the anchor (u). */
  start: 0.3,
  /** A hook throws the wire out over this long (s). */
  hookS: 0.12,
  /** A crossing's pulse: how long it runs (s), how wide it starts and spreads to (a share of the wire), and how much it adds. */
  pulseS: 0.3, pulseW: 0.07, pulseSpread: 0.5, pulseAmt: 0.9,
  /** A snap: two halves recoil over this long (s). */
  snapS: 0.2,
  /** The glyph: its size (u), how far above the anchor's head it floats, its bob (u) and rate, and its flash on the anchor's tick (s). */
  glyph: 0.85, glyphLift: 0.5, bob: 0.05, bobHz: 0.8, tickS: 0.25,
}
const SEG = 14
const WIRES = 2
const PULSES = 4
const GHOSTS = 2
/** Ribbons: a wire is two (the dark and the core); a ghost is two halves of each. */
const RIBBONS = WIRES * 2 + GHOSTS * 4
const VERTS = RIBBONS * SEG * 6
/** A strip's quad as two triangles: which of its four corners (a-, a+, b-, b+) each vertex is, and at which end (0: a, 1: b). */
const QUAD_C = [0, 1, 2, 1, 3, 2] as const
const QUAD_E = [0, 0, 1, 0, 1, 1] as const

const GLYPH_VERT = `
attribute vec2 aState;
varying vec2 vP;
varying vec2 vS;
void main() {
  vP = position.xy;
  vS = aState;
  float scale = length(instanceMatrix[0].xyz);
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  c.xy += position.xy * scale;
  gl_Position = projectionMatrix * c;
}`
// a J: a shank with an eye at its top, a half-circle bowl and a barb on its tip, in a unit square -0.5..0.5
const GLYPH_FRAG = `
varying vec2 vP;
varying vec2 vS;
float seg(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}
void main() {
  vec2 p = vP;
  float d = seg(p, vec2(0.14, 0.3), vec2(0.14, -0.06));
  vec2 c = vec2(-0.04, -0.06);
  float bowl = p.y < c.y ? abs(length(p - c) - 0.18) : min(length(p - vec2(0.14, c.y)), length(p - vec2(-0.22, c.y)));
  d = min(d, bowl);
  d = min(d, seg(p, vec2(-0.22, -0.06), vec2(-0.22, 0.06)));
  d = min(d, seg(p, vec2(-0.22, 0.06), vec2(-0.3, 0.02)));
  d = min(d, abs(length(p - vec2(0.14, 0.38)) - 0.06));
  float line = 1.0 - smoothstep(0.035, 0.06, d);
  float dark = 1.0 - smoothstep(0.08, 0.115, d);
  if (dark <= 0.0) discard;
  vec3 cold = mix(vec3(0.72, 0.9, 1.0), vec3(1.0), vS.y);
  vec3 rgb = mix(vec3(0.02, 0.04, 0.09), cold, line);
  gl_FragColor = vec4(rgb, max(line, dark * 0.75) * vS.x);
}`

/** A snapped wire: where it ran, and how long ago it broke. */
interface Ghost { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; bow: number; age: number }

export class TetherFx {
  private readonly wire: THREE.Mesh
  private readonly wireGeo: THREE.BufferGeometry
  private readonly wireMat: THREE.MeshBasicMaterial
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private readonly glyph: THREE.InstancedMesh
  private readonly glyphMat: THREE.ShaderMaterial
  private readonly state: Float32Array
  private readonly ghosts: Ghost[] = Array.from({ length: GHOSTS }, () => ({ x0: 0, y0: 0, z0: 0, x1: 0, y1: 0, z1: 0, bow: 0, age: -1 }))
  private gNext = 0
  // crossing pulses: which wire, where along it (0..1), how old (negative: free)
  private readonly pw = new Uint8Array(PULSES)
  private readonly pu = new Float32Array(PULSES)
  private readonly pa = new Float32Array(PULSES).fill(-1)
  private pNext = 0
  // per wire: how long since it was hooked (the throw), and since its anchor last ticked (the glyph's flash)
  private readonly hookAge = new Float32Array(WIRES).fill(9)
  private readonly tickAge = new Float32Array(WIRES).fill(9)
  private clock = 0
  private v = 0
  /** Scratch: one segment's four corners. */
  private readonly quad = new Float32Array(12)
  /** Vertices drawn last frame, and glyphs (for checks). */
  drawn = 0
  glyphs = 0

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(VERTS * 3)
    this.col = new Float32Array(VERTS * 4)
    this.wireGeo = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(this.pos, 3)
    const ca = new THREE.BufferAttribute(this.col, 4)
    pa.setUsage(THREE.DynamicDrawUsage)
    ca.setUsage(THREE.DynamicDrawUsage)
    this.wireGeo.setAttribute('position', pa)
    this.wireGeo.setAttribute('color', ca)
    this.wireGeo.setDrawRange(0, 0)
    this.wireMat = new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true })
    this.wire = new THREE.Mesh(this.wireGeo, this.wireMat)
    this.wire.frustumCulled = false
    this.wire.visible = false
    this.wire.renderOrder = 3
    this.wire.name = 'tether-wire'
    scene.add(this.wire)

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3))
    g.setIndex([0, 1, 2, 0, 2, 3])
    this.state = new Float32Array(WIRES * 2)
    const sa = new THREE.InstancedBufferAttribute(this.state, 2)
    sa.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aState', sa)
    this.glyphMat = new THREE.ShaderMaterial({ vertexShader: GLYPH_VERT, fragmentShader: GLYPH_FRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })
    this.glyph = new THREE.InstancedMesh(g, this.glyphMat, WIRES)
    this.glyph.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.glyph.frustumCulled = false
    this.glyph.visible = false
    this.glyph.count = 0
    this.glyph.renderOrder = 4
    this.glyph.name = 'tether-glyph'
    scene.add(this.glyph)
  }

  /** The wire's own moments: a hook throws it out, a crossing pulses along it, the anchor's tick flashes the glyph, a break leaves two recoiling halves. */
  event(ev: PartEvent) {
    if (ev.kind !== 'tether') return
    if (ev.what === 'hook') this.hookAge[ev.wire] = 0
    else if (ev.what === 'anchor') this.tickAge[ev.wire] = 0
    else if (ev.what === 'cross') {
      const i = this.pNext
      this.pNext = (i + 1) % PULSES
      this.pw[i] = ev.wire
      this.pu[i] = ev.u
      this.pa[i] = 0
    } else if (ev.what === 'break') {
      const g = this.ghosts[this.gNext]!
      this.gNext = (this.gNext + 1) % GHOSTS
      const len = Math.hypot(ev.to.x - ev.from.x, ev.to.z - ev.from.z) || 1
      g.x0 = ev.from.x + ((ev.to.x - ev.from.x) / len) * LOOK.start
      g.z0 = ev.from.z + ((ev.to.z - ev.from.z) / len) * LOOK.start
      g.y0 = LOOK.chestY
      g.x1 = ev.to.x
      g.z1 = ev.to.z
      g.y1 = this.anchorY(ev.enemy)
      g.bow = this.bowOf(len)
      g.age = 0
    }
  }

  /** A new level, a run's end or the core off: nothing up. */
  clear() {
    this.wire.visible = false
    this.glyph.visible = false
    this.glyph.count = 0
    this.wireGeo.setDrawRange(0, 0)
    for (const g of this.ghosts) g.age = -1
    this.pa.fill(-1)
    this.hookAge.fill(9)
    this.tickAge.fill(9)
    this.drawn = 0
    this.glyphs = 0
  }

  private anchorY(e: { height: number; size: number }) {
    return Math.max(LOOK.anchorMinY, e.height * e.size * LOOK.anchorShare)
  }

  /** The bow (u) of a wire this long: a shallow slack curve, less as it goes taut. */
  private bowOf(len: number) {
    const slack = 1 - Math.min(1, Math.max(0, (len - LOOK.tautFrom) / (CORES.tether.breakR - LOOK.tautFrom)))
    return len * LOOK.bow * slack * (1 + LOOK.sway * Math.sin(this.clock * Math.PI * 2 * LOOK.swayHz))
  }

  /** Brightness pulses at a point `u` along wire `w`: the crossings' flashes, spreading from where they crossed. */
  private lit(w: number, u: number): number {
    let b = 0
    for (let i = 0; i < PULSES; i++) {
      const a = this.pa[i]!
      if (a < 0 || this.pw[i] !== w) continue
      const f = a / LOOK.pulseS
      const wid = LOOK.pulseW + LOOK.pulseSpread * f * f
      const x = (u - this.pu[i]!) / wid
      b += LOOK.pulseAmt * (1 - f) * Math.exp(-x * x)
    }
    return Math.min(1, b)
  }

  /**
   * One ribbon over the wire's span `u0` to `u1`, appended to the arrays: a flat strip `width` wide at the wire's height, from (x0, y0, z0) to (x1, y1, z1), bowed sideways by `bow` and sagging a little in the middle. `w` is the
   * wire's index for the pulses (-1: none), `fade` its opacity. The core brightens toward white where a pulse is; the dark does not.
   */
  private ribbon(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, bow: number, u0: number, u1: number, width: number, rgb: readonly number[], alpha: number, w: number) {
    if (u1 - u0 < 1e-3) return
    const dx = x1 - x0
    const dz = z1 - z0
    const len = Math.hypot(dx, dz) || 1
    const nx = -dz / len
    const nz = dx / len
    let o = this.v
    const h = width / 2
    const q = this.quad
    for (let s = 0; s < SEG; s++) {
      // the strip's two edges at this segment's two ends: corners 0, 1 (the start's) and 2, 3 (the end's)
      for (let e = 0; e < 2; e++) {
        const u = u0 + ((u1 - u0) * (s + e)) / SEG
        const bend = 4 * u * (1 - u)
        const cx = x0 + dx * u + nx * bow * bend
        const cz = z0 + dz * u + nz * bow * bend
        const cy = y0 + (y1 - y0) * u - LOOK.sag * bend
        q[e * 6] = cx - nx * h
        q[e * 6 + 1] = cy
        q[e * 6 + 2] = cz - nz * h
        q[e * 6 + 3] = cx + nx * h
        q[e * 6 + 4] = cy
        q[e * 6 + 5] = cz + nz * h
      }
      // two triangles, (a-, a+, b-) and (a+, b+, b-); each vertex takes its end's brightness
      for (let k = 0; k < 6; k++) {
        const c = QUAD_C[k]!
        const u = u0 + ((u1 - u0) * (s + QUAD_E[k]!)) / SEG
        const p = o * 3
        this.pos[p] = q[c * 3]!
        this.pos[p + 1] = q[c * 3 + 1]!
        this.pos[p + 2] = q[c * 3 + 2]!
        const lit = w >= 0 && rgb === LOOK.core ? this.lit(w, u) : 0
        const t = o * 4
        this.col[t] = rgb[0]! + (1 - rgb[0]!) * lit
        this.col[t + 1] = rgb[1]! + (1 - rgb[1]!) * lit
        this.col[t + 2] = rgb[2]! + (1 - rgb[2]!) * lit
        // fainter at the ends than in the middle, so it does not smear over his chest
        this.col[t + 3] = Math.min(1, alpha * (0.65 + 0.35 * Math.sin(Math.PI * u)) + lit * 0.1)
        o++
      }
    }
    this.v = o
  }

  /** One rendered frame (`dt` real seconds, 0 while paused). `on`: Tether is worn in a crawl; (x, z) is Still's place. */
  update(on: boolean, dt: number, combat: Combat, x: number, z: number) {
    if (!on) {
      if (this.wire.visible || this.glyph.visible) this.clear()
      return
    }
    this.clock += dt
    this.v = 0
    let gl = 0
    const mat = this.glyph.instanceMatrix.array as Float32Array
    for (let i = 0; i < WIRES; i++) {
      this.hookAge[i] = this.hookAge[i]! + dt
      this.tickAge[i] = this.tickAge[i]! + dt
      const w = combat.wires[i]!
      const e = w.e
      if (!e) continue
      const dx = e.pos.x - x
      const dz = e.pos.z - z
      const len = Math.hypot(dx, dz)
      if (len < 1e-3) continue
      const x0 = x + (dx / len) * LOOK.start
      const z0 = z + (dz / len) * LOOK.start
      const y1 = this.anchorY(e)
      const grow = Math.min(1, this.hookAge[i]! / LOOK.hookS)
      const bow = this.bowOf(len)
      this.ribbon(x0, LOOK.chestY, z0, e.pos.x, y1, e.pos.z, bow, 0, grow, LOOK.darkWidth, LOOK.dark, LOOK.darkA, -1)
      this.ribbon(x0, LOOK.chestY, z0, e.pos.x, y1, e.pos.z, bow, 0, grow, LOOK.width, LOOK.core, LOOK.coreA, i)
      // the glyph over the anchor's head: bobbing, flashing on its tick
      const s = LOOK.glyph
      const o = gl * 16
      mat[o] = s; mat[o + 1] = 0; mat[o + 2] = 0; mat[o + 3] = 0
      mat[o + 4] = 0; mat[o + 5] = s; mat[o + 6] = 0; mat[o + 7] = 0
      mat[o + 8] = 0; mat[o + 9] = 0; mat[o + 10] = s; mat[o + 11] = 0
      mat[o + 12] = e.pos.x; mat[o + 13] = e.height * e.size + LOOK.glyphLift + LOOK.bob * Math.sin(this.clock * Math.PI * 2 * LOOK.bobHz + i * 2); mat[o + 14] = e.pos.z; mat[o + 15] = 1
      this.state[gl * 2] = Math.min(1, grow * 1.5)
      this.state[gl * 2 + 1] = Math.max(0, 1 - this.tickAge[i]! / LOOK.tickS)
      gl++
    }
    // the snapped: two halves recoiling to their ends, fading
    for (const g of this.ghosts) {
      if (g.age < 0) continue
      g.age += dt
      const f = g.age / LOOK.snapS
      if (f >= 1) {
        g.age = -1
        continue
      }
      const ease = 1 - (1 - f) * (1 - f)
      const keep = 0.5 * (1 - ease)
      const a = 1 - f
      this.ribbon(g.x0, g.y0, g.z0, g.x1, g.y1, g.z1, g.bow, 0, keep, LOOK.darkWidth, LOOK.dark, LOOK.darkA * a, -1)
      this.ribbon(g.x0, g.y0, g.z0, g.x1, g.y1, g.z1, g.bow, 1 - keep, 1, LOOK.darkWidth, LOOK.dark, LOOK.darkA * a, -1)
      this.ribbon(g.x0, g.y0, g.z0, g.x1, g.y1, g.z1, g.bow, 0, keep, LOOK.width * (1 + f), LOOK.core, LOOK.coreA * a, -1)
      this.ribbon(g.x0, g.y0, g.z0, g.x1, g.y1, g.z1, g.bow, 1 - keep, 1, LOOK.width * (1 + f), LOOK.core, LOOK.coreA * a, -1)
    }
    for (let i = 0; i < PULSES; i++) {
      if (this.pa[i]! < 0) continue
      this.pa[i] = this.pa[i]! + dt
      if (this.pa[i]! >= LOOK.pulseS) this.pa[i] = -1
    }
    this.drawn = this.v
    this.wireGeo.setDrawRange(0, this.v)
    this.wire.visible = this.v > 0
    if (this.v > 0) {
      ;(this.wireGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
      ;(this.wireGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
    }
    this.glyphs = gl
    this.glyph.count = gl
    this.glyph.visible = gl > 0
    if (gl > 0) {
      this.glyph.instanceMatrix.needsUpdate = true
      ;(this.glyph.geometry.getAttribute('aState') as THREE.InstancedBufferAttribute).needsUpdate = true
    }
  }

  dispose() {
    this.wire.removeFromParent()
    this.glyph.removeFromParent()
    this.wireGeo.dispose()
    this.wireMat.dispose()
    this.glyph.geometry.dispose()
    this.glyph.dispose()
    this.glyphMat.dispose()
  }
}
