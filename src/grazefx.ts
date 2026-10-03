import * as THREE from 'three'
import { DECAL_Y } from './world'
import { CORES } from './cores'
import type { Combat } from './combat'
import type { PartEvent } from './parts'
import type { Enemy } from './enemy'

/**
 * Graze, drawn (design/buildlayer/CORES2.md §1, "the look, the most important part"): the BAND. Under every awake body whose melee swing is in its tell within `CORES.graze.bandR` of Still, a thin cold ring
 * band on the floor from the swing's reach to reach + margin: "stand here when it swings". The band is drawn from `combat.bands` (the very numbers the graze test uses), so what he sees is what grazes: a
 * Wide Berth or Read margin widens it, the Assembler's sweep draws only its sector. A swing that resolves leaves a ghost for a moment: it fades if it landed or missed far, and flashes and breaks outward if it grazed.
 *
 * One InstancedMesh, so ONE draw call whatever happens (`bandMax` live bands and `GHOSTS` fading ones at most); nothing is created after the constructor; with another core or none worn it is hidden. The shader draws
 * the band in a unit quad: a cold fill, a bright line on each edge, each outlined in dark so it holds on a bright floor and a dark one (markfx.ts learned that). Nothing random: every number is a function of the frame.
 */
const LOOK = {
  /** The floor lift above the decals. */
  lift: 0.025,
  /** A ghost that did not graze fades over `fadeS`; one that did flashes and breaks outward over `breakS`, growing by `grow` of its size. */
  fadeS: 0.18, breakS: 0.32, grow: 0.45,
  /** The live band breathes: `amp` of its alpha at `hz`. */
  amp: 0.12, hz: 2.2,
}
const LIVE = CORES.graze.bandMax
const GHOSTS = 4
const CAP = LIVE + GHOSTS
const FULL = Math.PI

const VERT = `
attribute vec4 aBand;
attribute vec2 aSector;
varying vec2 vP;
varying vec4 vB;
varying vec2 vS;
void main() {
  vP = position.xz;
  vB = aBand;
  vS = aSector;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`
const FRAG = `
varying vec2 vP;
varying vec4 vB;
varying vec2 vS;
const float PI = 3.14159265;
const float TAU = 6.2831853;
void main() {
  float d = length(vP);
  float inner = vB.x;
  if (d > 1.0 || d < inner) discard;
  // a sector (the Assembler's hammer): inside its half-angle about the aim, soft at the edges; a ring has none
  float side = 1.0;
  if (vS.y < PI) {
    float da = abs(mod(atan(vP.x, vP.y) - vS.x + PI, TAU) - PI);
    side = 1.0 - smoothstep(vS.y - 0.08, vS.y, da);
    if (side <= 0.0) discard;
  }
  // the band's two edges, as fractions of the outer radius: a bright line with a dark outline beside it
  float line = 0.016;
  float hiO = smoothstep(1.0 - 2.0 * line, 1.0 - 1.6 * line, d) * (1.0 - smoothstep(1.0 - line, 1.0 - 0.6 * line, d));
  float hiI = smoothstep(inner + 0.2 * line, inner + 0.6 * line, d) * (1.0 - smoothstep(inner + 1.4 * line, inner + 1.8 * line, d));
  float dkO = smoothstep(1.0 - line, 1.0 - 0.6 * line, d);
  float dkI = 1.0 - smoothstep(inner + 0.2 * line, inner + 0.6 * line, d);
  float hi = max(hiO, hiI);
  float dk = max(dkO, dkI);
  vec3 fill = vec3(0.26, 0.5, 0.88);
  vec3 bright = vec3(0.78, 0.92, 1.0);
  vec3 dark = vec3(0.02, 0.04, 0.09);
  vec3 col = fill;
  float a = 0.3;
  col = mix(col, dark, dk);
  a = max(a, dk * 0.7);
  col = mix(col, bright, hi);
  a = max(a, hi * 0.95);
  // a graze flashes the band white, and brightens it
  col = mix(col, vec3(1.0), vB.z * 0.65);
  a = min(1.0, a + vB.z * 0.4);
  gl_FragColor = vec4(col, a * vB.y * side);
}`

export class GrazeFx {
  private readonly mesh: THREE.InstancedMesh
  private readonly mat: THREE.ShaderMaterial
  private readonly band: Float32Array
  private readonly sector: Float32Array
  // last frame's live bands: who, where, how big, so a swing that stops showing can leave a ghost
  private readonly pe: (Enemy | null)[] = new Array(LIVE).fill(null)
  private readonly px = new Float32Array(LIVE)
  private readonly pz = new Float32Array(LIVE)
  private readonly pr = new Float32Array(LIVE)
  private readonly pm = new Float32Array(LIVE)
  private readonly pa = new Float32Array(LIVE)
  private readonly ph = new Float32Array(LIVE)
  private pn = 0
  // the ghosts: where, how big, how old (negative: free) and what became of the swing (1: it faded, 2: it grazed)
  private readonly gx = new Float32Array(GHOSTS)
  private readonly gz = new Float32Array(GHOSTS)
  private readonly gr = new Float32Array(GHOSTS)
  private readonly gm = new Float32Array(GHOSTS)
  private readonly ga = new Float32Array(GHOSTS)
  private readonly gh = new Float32Array(GHOSTS)
  private readonly gage = new Float32Array(GHOSTS).fill(-1)
  private readonly gk = new Uint8Array(GHOSTS)
  private gNext = 0
  /** Bodies whose swing grazed since the last frame: their ghost, when it forms, breaks. */
  private readonly grazed = new Set<Enemy>()
  private clock = 0
  /** Instances drawn last frame (for checks). */
  drawn = 0

  constructor(scene: THREE.Scene) {
    const g = new THREE.BufferGeometry()
    // a unit quad on the floor, x and z in -1..1: the shader reads them as the radius
    g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, -1, 1, 0, -1, 1, 0, 1, -1, 0, 1], 3))
    g.setIndex([0, 2, 1, 0, 3, 2])
    this.band = new Float32Array(CAP * 4)
    this.sector = new Float32Array(CAP * 2)
    const ba = new THREE.InstancedBufferAttribute(this.band, 4)
    const sa = new THREE.InstancedBufferAttribute(this.sector, 2)
    ba.setUsage(THREE.DynamicDrawUsage)
    sa.setUsage(THREE.DynamicDrawUsage)
    g.setAttribute('aBand', ba)
    g.setAttribute('aSector', sa)
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide })
    this.mesh = new THREE.InstancedMesh(g, this.mat, CAP)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.count = 0
    // over the floor and the marks' rings, under every tell (tellOrder starts near 1000)
    this.mesh.renderOrder = 2
    this.mesh.name = 'graze-band'
    scene.add(this.mesh)
  }

  /** A graze by a strike: the swing's band flashes and breaks. (A lane's or a shot's has no band: main.ts draws its streak.) */
  event(ev: PartEvent) {
    if (ev.kind !== 'graze' || ev.how !== 'melee') return
    // its band was up last frame: its ghost is made when it stops showing. Else (a tell shorter than a frame): one made here, from where it stood
    if (this.pe.includes(ev.enemy)) {
      this.grazed.add(ev.enemy)
      return
    }
    const d = Math.hypot(ev.at.x - ev.enemy.pos.x, ev.at.z - ev.enemy.pos.z)
    this.ghost(ev.enemy.pos.x, ev.enemy.pos.z, Math.max(0.5, d - 0.3), 0.6, 0, FULL, 2)
  }

  private ghost(x: number, z: number, reach: number, margin: number, aim: number, half: number, kind: 1 | 2) {
    const i = this.gNext
    this.gNext = (i + 1) % GHOSTS
    this.gx[i] = x
    this.gz[i] = z
    this.gr[i] = reach
    this.gm[i] = margin
    this.ga[i] = aim
    this.gh[i] = half
    this.gage[i] = 0
    this.gk[i] = kind
  }

  /** A new level, a run's end or the core off: nothing up. */
  clear() {
    this.pn = 0
    this.pe.fill(null)
    this.gage.fill(-1)
    this.grazed.clear()
    this.mesh.count = 0
    this.mesh.visible = false
    this.drawn = 0
  }

  /** One instance: a band at (x, z) from `reach` to `reach + margin`, seen at `alpha`, `flash` bright, its outer radius grown by `grow`. `half` at or past PI is a full ring. */
  private put(i: number, x: number, z: number, reach: number, margin: number, aim: number, half: number, alpha: number, flash: number, grow: number) {
    const outer = (reach + margin) * grow
    const m = this.mesh.instanceMatrix.array as Float32Array
    const o = i * 16
    m[o] = outer; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0
    m[o + 4] = 0; m[o + 5] = 1; m[o + 6] = 0; m[o + 7] = 0
    m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = outer; m[o + 11] = 0
    m[o + 12] = x; m[o + 13] = DECAL_Y + LOOK.lift; m[o + 14] = z; m[o + 15] = 1
    const b = i * 4
    this.band[b] = reach / (reach + margin)
    this.band[b + 1] = alpha
    this.band[b + 2] = flash
    this.band[b + 3] = 0
    const s = i * 2
    this.sector[s] = aim
    // the sector's drawn half-angle is the test's: the arc grown by the margin at its reach
    this.sector[s + 1] = half >= FULL ? 10 : half + margin / Math.max(reach, 1)
  }

  /** One rendered frame (`dt` real seconds, 0 while paused). `on`: Graze is worn in a crawl. */
  update(on: boolean, dt: number, combat: Combat) {
    if (!on) {
      if (this.mesh.visible || this.pn > 0) this.clear()
      return
    }
    this.clock += dt
    const breath = 1 - LOOK.amp + LOOK.amp * Math.sin(this.clock * Math.PI * 2 * LOOK.hz)
    // a swing that showed last frame and does not now: a ghost (it grazed, or it did not)
    const n = Math.min(combat.bandN, LIVE)
    for (let i = 0; i < this.pn; i++) {
      const e = this.pe[i]!
      let still = false
      for (let j = 0; j < n; j++) if (combat.bands[j]!.e === e) still = true
      if (still) continue
      this.ghost(this.px[i]!, this.pz[i]!, this.pr[i]!, this.pm[i]!, this.pa[i]!, this.ph[i]!, this.grazed.has(e) ? 2 : 1)
    }
    this.grazed.clear()
    let k = 0
    for (let j = 0; j < n; j++) {
      const b = combat.bands[j]!
      const e = b.e!
      this.put(k, e.pos.x, e.pos.z, b.reach, b.margin, b.aim, b.half, breath, 0, 1)
      this.pe[j] = e
      this.px[j] = e.pos.x
      this.pz[j] = e.pos.z
      this.pr[j] = b.reach
      this.pm[j] = b.margin
      this.pa[j] = b.aim
      this.ph[j] = b.half
      k++
    }
    for (let j = n; j < this.pn; j++) this.pe[j] = null
    this.pn = n
    for (let i = 0; i < GHOSTS; i++) {
      if (this.gage[i]! < 0) continue
      const a = this.gage[i]! + dt
      const life = this.gk[i] === 2 ? LOOK.breakS : LOOK.fadeS
      if (a >= life) {
        this.gage[i] = -1
        continue
      }
      this.gage[i] = a
      const f = a / life
      if (this.gk[i] === 2) {
        const ease = 1 - (1 - f) * (1 - f)
        this.put(k, this.gx[i]!, this.gz[i]!, this.gr[i]!, this.gm[i]!, this.ga[i]!, this.gh[i]!, 1 - f * f, 1 - f, 1 + LOOK.grow * ease)
      } else this.put(k, this.gx[i]!, this.gz[i]!, this.gr[i]!, this.gm[i]!, this.ga[i]!, this.gh[i]!, 1 - f, 0, 1)
      k++
    }
    this.drawn = k
    this.mesh.count = k
    this.mesh.visible = k > 0
    if (k > 0) {
      this.mesh.instanceMatrix.needsUpdate = true
      const g = this.mesh.geometry
      ;(g.getAttribute('aBand') as THREE.InstancedBufferAttribute).needsUpdate = true
      ;(g.getAttribute('aSector') as THREE.InstancedBufferAttribute).needsUpdate = true
    }
  }

  dispose() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.dispose()
    this.mat.dispose()
  }
}
