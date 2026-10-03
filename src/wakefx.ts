import * as THREE from 'three'
import { DECAL_Y } from './world'
import { CORES } from './cores'

/**
 * Wake, drawn as a wake (design/buildlayer/SHOW.md item 9): a cold field on the floor round Still at the skim's real reach, and a streak where he walked. Two meshes, so two draw calls
 * whatever happens; nothing is created after the constructor, and with another core or none worn both are hidden. No Math.random: the look is a function of where he is and has been.
 *
 * The aura is one plane with a shader. The reach is CORES.wake.radius from his centre (combat.ts tickWake tests a body's EDGE against it), so the ring is drawn at exactly that. The two side
 * arcs (45 to 135 degrees off his way, `sideCos`) are bright and front and back are dim: "beside, not behind". Like markfx's rings it has a dark rim under its cold band, so it reads on a warm floor.
 */
const AURA = {
  /** Brightness at rest, and while moving at or above `minSpeed`. */
  idle: 0.15, moving: 0.45,
  /** Front and back arcs, as a share of the side arcs' brightness. */
  endsMul: 0.35,
  /** The ease of the brightness, s (time constant). */
  easeS: 0.15,
  /** A skim's flash: added brightness, and its decay time constant, s. */
  flash: 0.4, flashS: 0.18,
  /** The plane reaches this far past the ring (a share of its radius) for the dark rim. */
  pad: 1.08,
  lift: 0.03,
}
const TRAIL = {
  /** Points kept (a full second at a fast walk with a dash's extra), and the travel between samples, u. */
  max: 72, step: 0.15,
  /** A point's life, s; the streak's width, u; its peak opacity. */
  lifeS: 1.0, width: 0.5, alpha: 0.5,
  /** Its dark underlay is this much wider and this opaque. */
  darkMul: 1.5, darkA: 0.28,
  /** A frame that moved him further than this is a dash or a placement: the streak is cut there, not drawn across it. */
  jump: 2,
  lift: 0.015,
}
const COLD = [0.42, 0.72, 1.0] as const
const DARK = [0.02, 0.04, 0.09] as const

const AURA_VERT = `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const AURA_FRAG = `
uniform float uLevel;
uniform float uFlash;
uniform vec2 uDir;
uniform float uSide;
uniform float uEnds;
varying vec2 vP;
void main() {
  float d = length(vP);
  if (d > ${AURA.pad.toFixed(3)}) discard;
  // beside his way (|sin| from 0.707 up, which is sideCos) is full; front and back dim
  float s = abs(vP.x * uDir.y - vP.y * uDir.x) / max(d, 1e-4);
  float w = mix(uEnds, 1.0, smoothstep(uSide - 0.12, uSide + 0.12, s));
  float fill = 0.5 * smoothstep(0.35, 0.96, d) * (1.0 - smoothstep(0.96, 0.985, d));
  float core = smoothstep(0.9, 0.935, d) * (1.0 - smoothstep(0.975, 0.995, d));
  float rim = smoothstep(0.86, 0.9, d) * (1.0 - smoothstep(1.0, 1.045, d));
  float lvl = uLevel * w + uFlash;
  float aCold = max(fill * 0.6, core) * lvl;
  float aDark = rim * 0.9 * lvl;
  float a = aCold + aDark * (1.0 - aCold);
  if (a < 0.004) discard;
  vec3 cold = vec3(${COLD[0]}, ${COLD[1]}, ${COLD[2]});
  vec3 dark = vec3(${DARK[0]}, ${DARK[1]}, ${DARK[2]});
  vec3 rgb = (cold * aCold + dark * aDark * (1.0 - aCold)) / a;
  gl_FragColor = vec4(rgb, clamp(a, 0.0, 1.0));
}`

export class WakeFx {
  private readonly aura: THREE.Mesh
  private readonly auraMat: THREE.ShaderMaterial
  private readonly trail: THREE.Mesh
  private readonly trailGeo: THREE.BufferGeometry
  private readonly trailMat: THREE.MeshBasicMaterial
  // the ring buffer: where, which way (unit), when
  private readonly tx = new Float32Array(TRAIL.max)
  private readonly tz = new Float32Array(TRAIL.max)
  private readonly tdx = new Float32Array(TRAIL.max)
  private readonly tdz = new Float32Array(TRAIL.max)
  private readonly tt = new Float32Array(TRAIL.max)
  private head = 0
  private count = 0
  private readonly pos: Float32Array
  private readonly col: Float32Array
  private clock = 0
  private level: number = AURA.idle
  private flash = 0
  private dirX = 0
  private dirZ = 1
  private lastX = 0
  private lastZ = 0
  private has = false
  /** Travel since the last sample. */
  private run = 0

  constructor(scene: THREE.Scene) {
    const R = CORES.wake.radius * AURA.pad
    this.auraMat = new THREE.ShaderMaterial({
      vertexShader: AURA_VERT, fragmentShader: AURA_FRAG, transparent: true, depthWrite: false, fog: false,
      uniforms: {
        uLevel: { value: AURA.idle }, uFlash: { value: 0 }, uDir: { value: new THREE.Vector2(0, 1) },
        uSide: { value: Math.sqrt(1 - CORES.wake.sideCos * CORES.wake.sideCos) }, uEnds: { value: AURA.endsMul },
      },
    })
    // the plane's local xy is the floor's: the shader sees positions in ring radii (1 = the reach)
    const g = new THREE.PlaneGeometry(2 * R, 2 * R)
    const p = g.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setXY(i, p.getX(i) / CORES.wake.radius, p.getY(i) / CORES.wake.radius)
    this.aura = new THREE.Mesh(g, this.auraMat)
    this.aura.rotation.x = -Math.PI / 2
    this.aura.frustumCulled = false
    this.aura.visible = false
    // over the floor and the marks' rings, under every tell
    this.aura.renderOrder = 1
    this.aura.name = 'wake-aura'
    // the plane's scale is the reach: the geometry is in ring radii, so its world size is 1 radius per unit x the reach
    this.aura.scale.setScalar(CORES.wake.radius)

    // the streak: per point 6 vertices (a dark underlay's left, centre and right, then the cold band's), 4 quads' worth of triangles a segment
    const n = TRAIL.max
    this.pos = new Float32Array(n * 6 * 3)
    this.col = new Float32Array(n * 6 * 4)
    const idx: number[] = []
    // a segment's dark underlay, then its cold band: one mesh draws its triangles in index order, so a draw range of the first segments is whole
    for (let i = 0; i < n - 1; i++) {
      for (const base of [0, 3]) {
        const a = i * 6 + base
        const b = (i + 1) * 6 + base
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1)
      }
    }
    this.trailGeo = new THREE.BufferGeometry()
    const pa = new THREE.BufferAttribute(this.pos, 3)
    const ca = new THREE.BufferAttribute(this.col, 4)
    pa.setUsage(THREE.DynamicDrawUsage)
    ca.setUsage(THREE.DynamicDrawUsage)
    this.trailGeo.setAttribute('position', pa)
    this.trailGeo.setAttribute('color', ca)
    this.trailGeo.setIndex(idx)
    this.trailGeo.setDrawRange(0, 0)
    this.trailMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true })
    this.trail = new THREE.Mesh(this.trailGeo, this.trailMat)
    this.trail.frustumCulled = false
    this.trail.visible = false
    this.trail.renderOrder = 1
    this.trail.name = 'wake-trail'
    scene.add(this.aura, this.trail)
  }

  /** A skim landed: the field flashes. */
  skim() {
    this.flash = AURA.flash
  }

  /** A new level, a run's end or the core off: no streak, no flash. */
  clear() {
    this.count = 0
    this.head = 0
    this.run = 0
    this.has = false
    this.flash = 0
    this.trailGeo.setDrawRange(0, 0)
  }

  /**
   * One rendered frame (`dt` real seconds, 0 while paused). `on`: Wake is worn in a crawl. (x, z) is Still's place. Speed and way are his own frame-to-frame motion, so the field
   * follows what the player sees; combat's skim test reads its own velocity the same way (a jump of more than 1.5 u a tick counts as none).
   */
  update(on: boolean, dt: number, x: number, z: number) {
    if (!on) {
      if (this.aura.visible || this.trail.visible) {
        this.aura.visible = this.trail.visible = false
        this.clear()
      }
      return
    }
    this.aura.visible = true
    this.trail.visible = true
    this.aura.position.set(x, DECAL_Y + AURA.lift, z)
    if (dt <= 0) return
    this.clock += dt
    let moving = false
    if (this.has) {
      const mx = x - this.lastX
      const mz = z - this.lastZ
      const step = Math.hypot(mx, mz)
      if (step > TRAIL.jump) {
        // a dash or a placement: the streak is cut, the field keeps its way
        this.count = 0
        this.head = 0
        this.run = 0
      } else if (step > 1e-5) {
        const sp = step / dt
        if (sp >= CORES.wake.minSpeed) {
          moving = true
          this.dirX = mx / step
          this.dirZ = mz / step
          this.run += step
          if (this.run >= TRAIL.step || this.count === 0) {
            this.run = 0
            this.push(x, z)
          }
        }
      }
    }
    this.lastX = x
    this.lastZ = z
    this.has = true
    // the field: brightness eases to its level, the flash falls away; the plane is turned so its +x runs along his way
    const k = 1 - Math.exp(-dt / AURA.easeS)
    this.level += ((moving ? AURA.moving : AURA.idle) - this.level) * k
    this.flash *= Math.exp(-dt / AURA.flashS)
    this.auraMat.uniforms.uLevel!.value = this.level
    this.auraMat.uniforms.uFlash!.value = this.flash
    // plane-local y maps to world -z after the tilt flat: hand the shader the way in its own xy
    ;(this.auraMat.uniforms.uDir!.value as THREE.Vector2).set(this.dirX, -this.dirZ)
    this.writeTrail(x, z)
  }

  private push(x: number, z: number) {
    const n = TRAIL.max
    const at = (this.head + this.count) % n
    if (this.count === n) this.head = (this.head + 1) % n
    else this.count++
    this.tx[at] = x
    this.tz[at] = z
    this.tdx[at] = this.dirX
    this.tdz[at] = this.dirZ
    this.tt[at] = this.clock
  }

  /** The ribbon, oldest to newest, its vertices rewritten each frame: expired points drop off the tail first. */
  private writeTrail(fx: number, fz: number) {
    const n = TRAIL.max
    while (this.count > 0 && this.clock - this.tt[this.head]! >= TRAIL.lifeS) {
      this.head = (this.head + 1) % n
      this.count--
    }
    if (this.count < 2) {
      this.trailGeo.setDrawRange(0, 0)
      return
    }
    for (let i = 0; i < this.count; i++) {
      const s = (this.head + i) % n
      // the newest point is carried to Still's feet, so the streak runs up to him
      const last = i === this.count - 1
      const px = last ? fx : this.tx[s]!
      const pz = last ? fz : this.tz[s]!
      const f = 1 - (this.clock - this.tt[s]!) / TRAIL.lifeS
      // across the way: (-dz, dx); the older, the narrower
      const nx = -this.tdz[s]!
      const nz = this.tdx[s]!
      const hw = TRAIL.width * 0.5 * (0.35 + 0.65 * f)
      const o = i * 6
      for (let v = 0; v < 6; v++) {
        const dark = v < 3
        const side = (v % 3) - 1
        const w = hw * (dark ? TRAIL.darkMul : 1) * (side === 0 ? 0 : side)
        const q = (o + v) * 3
        this.pos[q] = px + nx * w
        this.pos[q + 1] = DECAL_Y + TRAIL.lift + (dark ? 0 : 0.001)
        this.pos[q + 2] = pz + nz * w
        const c = (o + v) * 4
        const rgb = dark ? DARK : COLD
        this.col[c] = rgb[0]; this.col[c + 1] = rgb[1]; this.col[c + 2] = rgb[2]
        this.col[c + 3] = side === 0 ? (dark ? TRAIL.darkA : TRAIL.alpha) * f * f : 0
      }
    }
    this.trailGeo.setDrawRange(0, (this.count - 1) * 24)
    ;(this.trailGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    ;(this.trailGeo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  }

  dispose() {
    this.aura.removeFromParent()
    this.trail.removeFromParent()
    this.aura.geometry.dispose()
    this.auraMat.dispose()
    this.trailGeo.dispose()
    this.trailMat.dispose()
  }
}
