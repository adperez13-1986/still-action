import * as THREE from 'three'
import { DECAL_Y } from './world'

/**
 * Everything that makes a hit feel alive: sparks, embers, dust, smoke, debris,
 * flashes, and animated textured telegraphs.
 *
 * Colour language: Still's effects are cold and electric (pale blue-white);
 * the enemies' are ember and fire (deep red to orange). You can tell whose an
 * effect is at a glance.
 */
export const COLD = new THREE.Color(0xcfe4ff)
export const COLD_DEEP = new THREE.Color(0x6f9bd0)
export const EMBER = new THREE.Color(0xff6a3a)
export const EMBER_DEEP = new THREE.Color(0x8a1f12)
/** Slag: hotter than an ember, toward orange, never white. */
export const SLAG_DROP = new THREE.Color(0xff8a3c)

// --- shared time, for every animated material ---
export const VFX_TIME = { value: 0 }

// --- particles -----------------------------------------------------------------

interface Particle {
  alive: boolean
  x: number; y: number; z: number
  vx: number; vy: number; vz: number
  life: number; max: number
  size: number; grow: number
  r: number; g: number; b: number
  gravity: number
  drag: number
  seed: number
}

const POINT_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  attribute float aSeed;
  uniform float uPx;
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSeed;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vSeed = aSeed;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.0, aSize * uPx);
  }
`

/** Hot particles: a bright core with a soft falloff, added onto the scene. */
const GLOW_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(1.0, 0.0, d);
    float a = pow(core, 1.6) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.6 + core * 0.9), a);
  }
`

/** Smoke and dust: soft, lumpy puffs, blended normally so they can darken. */
const SMOKE_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  varying float vSeed;
  uniform float uTime;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
  }
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    float lump = n(p * 5.0 + vSeed * 17.0 + uTime * 0.4) * 0.6 + n(p * 11.0 - vSeed * 5.0) * 0.4;
    float a = smoothstep(1.0, 0.25, d + (lump - 0.5) * 0.6) * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * (0.75 + lump * 0.5), a);
  }
`

class Pool {
  readonly points: THREE.Points
  private readonly parts: Particle[]
  private readonly pos: Float32Array
  private readonly size: Float32Array
  private readonly alpha: Float32Array
  private readonly color: Float32Array
  private readonly seed: Float32Array
  private cursor = 0
  readonly material: THREE.ShaderMaterial

  constructor(capacity: number, frag: string, blending: THREE.Blending) {
    this.parts = Array.from({ length: capacity }, () => ({
      alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 1, grow: 0,
      r: 1, g: 1, b: 1, gravity: 0, drag: 0, seed: Math.random(),
    }))
    const geo = new THREE.BufferGeometry()
    this.pos = new Float32Array(capacity * 3)
    this.size = new Float32Array(capacity)
    this.alpha = new Float32Array(capacity)
    this.color = new Float32Array(capacity * 3)
    this.seed = new Float32Array(capacity)
    for (const [name, arr, n] of [['position', this.pos, 3], ['aSize', this.size, 1], ['aAlpha', this.alpha, 1], ['aColor', this.color, 3], ['aSeed', this.seed, 1]] as const) {
      const attr = new THREE.BufferAttribute(arr, n)
      attr.setUsage(THREE.DynamicDrawUsage)
      geo.setAttribute(name, attr)
    }
    this.material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: frag,
      uniforms: { uPx: { value: 30 }, uTime: VFX_TIME },
      transparent: true,
      depthWrite: false,
      blending,
    })
    this.points = new THREE.Points(geo, this.material)
    this.points.frustumCulled = false
  }

  spawn(p: Partial<Particle> & { x: number; y: number; z: number; max: number }) {
    const slot = this.parts[this.cursor]!
    this.cursor = (this.cursor + 1) % this.parts.length
    Object.assign(slot, { vx: 0, vy: 0, vz: 0, size: 0.2, grow: 0, r: 1, g: 1, b: 1, gravity: 0, drag: 0 }, p)
    slot.alive = true
    slot.life = p.max
    slot.seed = Math.random()
  }

  update(dt: number) {
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]!
      if (p.alive) {
        p.life -= dt
        if (p.life <= 0) p.alive = false
        const damp = Math.exp(-p.drag * dt)
        p.vx *= damp
        p.vz *= damp
        p.vy = p.vy * damp - p.gravity * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt
        // sparks and debris skitter on the floor instead of sinking into it
        if (p.y < DECAL_Y && p.gravity > 0) {
          p.y = DECAL_Y
          p.vy = Math.abs(p.vy) * 0.3
          p.vx *= 0.6
          p.vz *= 0.6
        }
        p.size += p.grow * dt
      }
      const k = p.alive ? p.life / p.max : 0
      this.pos[i * 3] = p.x
      this.pos[i * 3 + 1] = p.y
      this.pos[i * 3 + 2] = p.z
      this.size[i] = p.alive ? p.size : 0
      // quick in, slow out
      this.alpha[i] = p.alive ? Math.min(1, (1 - k) * 8) * k : 0
      this.color[i * 3] = p.r
      this.color[i * 3 + 1] = p.g
      this.color[i * 3 + 2] = p.b
      this.seed[i] = p.seed
    }
    const geo = this.points.geometry
    for (const name of ['position', 'aSize', 'aAlpha', 'aColor', 'aSeed']) geo.getAttribute(name).needsUpdate = true
  }
}

// --- debris: real little chunks that bounce and tumble ---

interface Chunk { alive: boolean; p: THREE.Vector3; v: THREE.Vector3; spin: THREE.Vector3; rot: THREE.Euler; life: number; max: number; scale: number }

class Debris {
  readonly mesh: THREE.InstancedMesh
  private readonly chunks: Chunk[]
  private cursor = 0
  private readonly m = new THREE.Matrix4()
  private readonly q = new THREE.Quaternion()
  private readonly s = new THREE.Vector3()

  constructor(capacity: number) {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, metalness: 0.3 })
    this.mesh = new THREE.InstancedMesh(geo, mat, capacity)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.chunks = Array.from({ length: capacity }, () => ({
      alive: false, p: new THREE.Vector3(), v: new THREE.Vector3(), spin: new THREE.Vector3(), rot: new THREE.Euler(), life: 0, max: 1, scale: 0.1,
    }))
    const c = new THREE.Color(0x3a3a3a)
    for (let i = 0; i < capacity; i++) this.mesh.setColorAt(i, c)
  }

  spawn(at: THREE.Vector3, v: THREE.Vector3, scale: number, color: THREE.Color, life = 1.4) {
    const i = this.cursor
    const ch = this.chunks[i]!
    this.cursor = (this.cursor + 1) % this.chunks.length
    ch.alive = true
    ch.p.copy(at)
    ch.v.copy(v)
    ch.spin.set(Math.random() * 14 - 7, Math.random() * 14 - 7, Math.random() * 14 - 7)
    ch.life = ch.max = life
    ch.scale = scale
    this.mesh.setColorAt(i, color)
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true
  }

  update(dt: number) {
    this.chunks.forEach((ch, i) => {
      if (ch.alive) {
        ch.life -= dt
        if (ch.life <= 0) ch.alive = false
        ch.v.y -= 20 * dt
        ch.p.addScaledVector(ch.v, dt)
        const floor = DECAL_Y + ch.scale * 0.4
        if (ch.p.y < floor) {
          ch.p.y = floor
          ch.v.y = Math.abs(ch.v.y) * 0.35
          ch.v.x *= 0.55
          ch.v.z *= 0.55
          ch.spin.multiplyScalar(0.6)
        }
        ch.rot.x += ch.spin.x * dt
        ch.rot.y += ch.spin.y * dt
        ch.rot.z += ch.spin.z * dt
      }
      const k = ch.alive ? Math.min(1, ch.life / (ch.max * 0.35)) : 0
      this.q.setFromEuler(ch.rot)
      this.s.setScalar(ch.scale * k)
      this.m.compose(ch.p, this.q, this.s)
      this.mesh.setMatrixAt(i, this.m)
    })
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

// --- the public face ---

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

export class Vfx {
  private readonly glow = new Pool(1800, GLOW_FRAG, THREE.AdditiveBlending)
  private readonly smoke = new Pool(700, SMOKE_FRAG, THREE.NormalBlending)
  private readonly debris = new Debris(260)

  constructor(scene: THREE.Scene) {
    scene.add(this.smoke.points, this.glow.points, this.debris.mesh)
  }

  /** Point sizes are in world units; the ortho camera decides how many pixels that is. */
  update(dt: number, camera: THREE.OrthographicCamera, pixelHeight: number) {
    VFX_TIME.value += dt
    const px = pixelHeight / ((camera.top - camera.bottom) / camera.zoom)
    this.glow.material.uniforms.uPx!.value = px
    this.smoke.material.uniforms.uPx!.value = px
    this.glow.update(dt)
    this.smoke.update(dt)
    this.debris.update(dt)
  }

  /** A burst of sparks, thrown mostly along `dir` if given. */
  sparks(at: THREE.Vector3, color: THREE.Color, count: number, speed = 7, dir?: THREE.Vector3, spread = 1.2) {
    for (let i = 0; i < count; i++) {
      const a = dir ? Math.atan2(dir.x, dir.z) + rnd(-spread, spread) : rnd(0, Math.PI * 2)
      const s = speed * rnd(0.35, 1.1)
      const c = color.clone().lerp(new THREE.Color(1, 1, 1), rnd(0, 0.5))
      this.glow.spawn({
        x: at.x, y: at.y, z: at.z,
        vx: Math.sin(a) * s, vy: rnd(1.5, 5), vz: Math.cos(a) * s,
        max: rnd(0.25, 0.55), size: rnd(0.08, 0.16), gravity: 16, drag: 2.5,
        r: c.r, g: c.g, b: c.b,
      })
    }
  }

  /** Slow drifting embers, rising. */
  embers(at: THREE.Vector3, count: number, radius = 0.6, color = EMBER) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2)
      const r = rnd(0, radius)
      this.glow.spawn({
        x: at.x + Math.sin(a) * r, y: at.y + rnd(0, 0.4), z: at.z + Math.cos(a) * r,
        vx: rnd(-0.5, 0.5), vy: rnd(0.8, 2.2), vz: rnd(-0.5, 0.5),
        max: rnd(0.6, 1.3), size: rnd(0.06, 0.12), drag: 1,
        r: color.r, g: color.g * rnd(0.7, 1.1), b: color.b,
      })
    }
  }

  /** A molten drop falling off a slag core: it runs down, hits the floor and skitters. Heavy, where embers float. */
  drip(at: THREE.Vector3) {
    const c = SLAG_DROP.clone().multiplyScalar(rnd(0.8, 1.1))
    this.glow.spawn({
      x: at.x + rnd(-0.12, 0.12), y: at.y, z: at.z + rnd(-0.12, 0.12),
      vx: rnd(-0.2, 0.2), vy: rnd(-0.4, 0), vz: rnd(-0.2, 0.2),
      max: rnd(0.55, 0.8), size: rnd(0.06, 0.09), gravity: 9, drag: 0.5,
      r: c.r, g: c.g, b: c.b,
    })
  }

  /** A bright pop: a hot core and a soft bloom around it. */
  flash(at: THREE.Vector3, color: THREE.Color, size = 1) {
    this.glow.spawn({ x: at.x, y: at.y, z: at.z, max: 0.12, size: size * 0.9, grow: size * 3, r: 1, g: 1, b: 1 })
    this.glow.spawn({ x: at.x, y: at.y, z: at.z, max: 0.22, size: size * 1.6, grow: size * 4, r: color.r, g: color.g, b: color.b })
  }

  /** Dust thrown out along the floor: slams, landings, a dash kicking off. */
  dust(at: THREE.Vector3, count: number, radius = 1.2, color = new THREE.Color(0x6b6259), speed = 3) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2)
      const r = rnd(0.2, radius)
      const s = speed * rnd(0.4, 1)
      const shade = rnd(0.7, 1.1)
      this.smoke.spawn({
        x: at.x + Math.sin(a) * r, y: DECAL_Y + rnd(0.05, 0.4), z: at.z + Math.cos(a) * r,
        vx: Math.sin(a) * s, vy: rnd(0.2, 0.9), vz: Math.cos(a) * s,
        max: rnd(0.5, 1.1), size: rnd(0.5, 0.9), grow: rnd(0.8, 1.6), drag: 3.5,
        r: color.r * shade, g: color.g * shade, b: color.b * shade,
      })
    }
  }

  /** Rising smoke: the boss's stacks, a smashed crate. */
  smokePuff(at: THREE.Vector3, count = 1, color = new THREE.Color(0x2c2826)) {
    for (let i = 0; i < count; i++) {
      this.smoke.spawn({
        x: at.x + rnd(-0.1, 0.1), y: at.y, z: at.z + rnd(-0.1, 0.1),
        vx: rnd(-0.3, 0.3), vy: rnd(1.2, 2), vz: rnd(-0.3, 0.3),
        max: rnd(1.2, 2), size: rnd(0.35, 0.55), grow: 0.8, drag: 0.6,
        r: color.r, g: color.g, b: color.b,
      })
    }
  }

  /** Chunks of whatever broke. */
  chunks(at: THREE.Vector3, count: number, color: THREE.Color, speed = 5, size = 0.14) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2)
      const s = speed * rnd(0.3, 1)
      const c = color.clone().multiplyScalar(rnd(0.6, 1.15))
      this.debris.spawn(
        new THREE.Vector3(at.x, at.y + rnd(0, 0.5), at.z),
        new THREE.Vector3(Math.sin(a) * s, rnd(3, 7), Math.cos(a) * s),
        size * rnd(0.6, 1.5), c,
      )
    }
  }

  /** A glowing trail behind something in flight: call every frame with its position. A longer life keeps the whole line lit. */
  trail(at: THREE.Vector3, color: THREE.Color, size = 0.18, life = 0.18) {
    this.glow.spawn({
      x: at.x + rnd(-0.03, 0.03), y: at.y + rnd(-0.03, 0.03), z: at.z + rnd(-0.03, 0.03),
      max: life, size, grow: -size * 0.54 / life, r: color.r, g: color.g, b: color.b,
    })
  }

  /** N4a frost: pale motes that fall instead of rising. Heat rises, cold falls (G4). */
  frost(at: THREE.Vector3, count: number, radius = 0.5) {
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2)
      const r = rnd(0, radius)
      this.glow.spawn({
        x: at.x + Math.sin(a) * r, y: at.y + rnd(0, 0.3), z: at.z + Math.cos(a) * r,
        vx: rnd(-0.2, 0.2), vy: rnd(-1.0, -0.4), vz: rnd(-0.2, 0.2),
        max: rnd(0.6, 1.1), size: rnd(0.05, 0.1), drag: 0.8,
        r: COLD.r, g: COLD.g, b: COLD.b,
      })
    }
  }

  /** The inverse of sparks: motes spawned on a ring that fly in to a point. Charge, suction, a rewind arriving. */
  gather(at: THREE.Vector3, count: number, radius: number, color = COLD, speed = 6) {
    const life = radius / speed
    for (let i = 0; i < count; i++) {
      const a = rnd(0, Math.PI * 2)
      const r = radius * rnd(0.85, 1.1)
      this.glow.spawn({
        x: at.x + Math.sin(a) * r, y: at.y + rnd(-0.2, 0.2), z: at.z + Math.cos(a) * r,
        vx: -Math.sin(a) * speed, vy: 0, vz: -Math.cos(a) * speed,
        max: life * rnd(0.85, 1), size: rnd(0.06, 0.12), r: color.r, g: color.g, b: color.b,
      })
    }
  }
}

let halo: THREE.CanvasTexture | null = null

/**
 * A soft ember glow, drawn once and shared by every body that wears one. Shared,
 * so nothing disposes it: disposeBody frees materials, never their maps.
 */
export function haloTexture(): THREE.Texture {
  if (halo) return halo
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,120,80,0.9)')
  grad.addColorStop(0.35, 'rgba(255,80,50,0.35)')
  grad.addColorStop(1, 'rgba(255,60,40,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  halo = new THREE.CanvasTexture(c)
  return halo
}

/**
 * How many tells are locked (committed, about to land) this tick. Combat counts
 * them; a tracking tell draws at 60% while any other is locked, so the one that's
 * coming is the one you see.
 */
export const TELL_CROWD = { locked: 0 }
/** A tracking tell's brightness while the crowd has a locked one. */
export const trackingDim = () => (TELL_CROWD.locked > 0 ? 0.6 : 1)
/** Soonest on top: every tell's renderOrder, from how many ms until it lands. */
export const tellOrder = (msToStrike: number) => 1000 - Math.max(0, msToStrike) / 10

// --- telegraphs: animated, textured, instead of flat red ---

const TELL_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Floor telegraphs. `radial` for discs, sectors and rings (distance from the
 * centre drives the pattern); `strip` for lines (distance along the strip).
 * A molten noise body, a hot leading edge, and ripples or chevrons flowing
 * toward where the hit will land.
 */
const TELL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform vec3 uHot;
  uniform vec3 uDeep;
  uniform float uStrip;
  uniform float uRadius;
  uniform float uCold;
  uniform float uMolten;
  uniform float uSweep;
  uniform float uSweepHalf;
  varying vec2 vUv;
  varying vec3 vPos;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { return n(p) * 0.55 + n(p * 2.3 + 7.1) * 0.3 + n(p * 5.2 - 3.3) * 0.15; }
  void main() {
    // strips are baked flat in xz, discs and rings in xy
    vec2 w = uStrip > 0.5 ? vPos.xz : vPos.xy;
    float noise = fbm(w * 0.9 + vec2(uTime * 0.35, -uTime * 0.25));
    // Still's marks are frost, not fire: faceted instead of molten, ripples running
    // inward instead of out, and a dashed edge where an enemy's is solid
    bool cold = uCold > 0.5;
    if (cold) noise = floor(noise * 5.0) / 5.0;
    float pattern;
    float edge;
    // how much of the edge a cold dash cuts away (1 = none)
    float cut = 1.0;
    if (uStrip > 0.5) {
      float along = vUv.y;
      float across = abs(vUv.x - 0.5) * 2.0;
      pattern = cold ? 0.0 : smoothstep(0.35, 0.0, abs(fract(along * 9.0 - uTime * 2.2 + across * 0.35) - 0.5));
      edge = smoothstep(0.7, 1.0, across);
      if (cold) {
        float dash = step(0.45, fract(along * 16.0));
        edge *= dash;
        cut = mix(1.0, 0.15 + 0.85 * dash, smoothstep(0.6, 1.0, across));
      }
    } else {
      float r = length(w) / uRadius;
      pattern = smoothstep(0.25, 0.0, abs(fract(r * 5.0 + (cold ? 1.6 : -1.6) * uTime) - 0.5));
      edge = smoothstep(0.86, 1.0, r);
      if (cold) {
        float dash = step(0.45, fract(atan(w.y, w.x) / 6.283 * 16.0));
        edge *= dash;
        cut = mix(1.0, 0.15 + 0.85 * dash, smoothstep(0.8, 0.95, r));
      }
    }
    if (uMolten > 0.5) {
      // metal on the floor, not a telegraph: a dark crust with hot veins cracking through it,
      // slowly crawling. No rings (it isn't coming, it's here) and nothing past full heat.
      float crust = fbm(w * 1.7 + vec2(uTime * 0.08, -uTime * 0.05));
      float vein = 1.0 - smoothstep(0.0, 0.13, abs(crust - 0.5));
      float glow = smoothstep(0.5, 0.85, fbm(w * 0.8 - uTime * 0.12));
      float hot = clamp(vein + glow * 0.6, 0.0, 1.0);
      float r = length(w) / uRadius;
      // the hottest veins a touch past full, for the bloom; still orange, never white
      vec3 col = mix(uDeep, uHot, hot) * (1.0 + 0.3 * vein * glow);
      gl_FragColor = vec4(col, uOpacity * (0.82 + 0.18 * crust) * smoothstep(1.0, 0.9, r));
      return;
    }
    if (abs(uSweep) > 0.5) {
      // A gaze sweeping the floor (the Arbiter's wedge), laid on the floor, not a slab: shafts of
      // ember running out from the tower like a lamp's rays through dust, brightest at the edge
      // it's turning toward, a hot line along that edge, and heat rippling outward. Most of it is
      // floor showing through; the whole of its reach stays faintly there to read.
      float ang = atan(w.x, w.y);
      float s = clamp(ang / uSweepHalf * uSweep, -1.0, 1.0);
      float r = length(w) / uRadius;
      float shafts = n(vec2(ang * 38.0, r * 2.0 - uTime * 0.15)) * 0.65 + n(vec2(ang * 90.0 + 3.1, r * 6.0)) * 0.35;
      float dust = fbm(w * 2.6 + vec2(uTime * 0.2, uTime * 0.13));
      float ripple = smoothstep(0.3, 0.0, abs(fract(r * 6.0 - uTime * 1.2) - 0.5));
      float body = pow(s * 0.5 + 0.5, 1.4);
      float lead = smoothstep(0.8, 0.96, s) * (1.0 - smoothstep(0.97, 1.0, s));
      float reach = 1.0 - smoothstep(0.6, 1.0, r);
      float heatS = clamp(body * (0.25 + shafts * 0.6) + lead * (0.8 + dust * 0.4) + ripple * body * 0.25, 0.0, 1.2);
      vec3 colS = mix(uDeep, uHot, clamp(heatS, 0.0, 1.0)) * (0.7 + dust * 0.5);
      float aS = uOpacity * clamp(0.12 + body * (0.25 + shafts * 0.75) * (0.6 + dust * 0.6) + lead * 1.3 + ripple * body * 0.2, 0.0, 1.0)
        * reach * smoothstep(0.0, 0.08, r);
      gl_FragColor = vec4(colS, aS);
      return;
    }
    float heat = clamp(noise * 0.8 + pattern * 0.45 + edge * 0.9, 0.0, 1.6);
    vec3 col = mix(uDeep, uHot, clamp(heat, 0.0, 1.0)) + uHot * max(0.0, heat - 1.0) * 0.6;
    float a = uOpacity * clamp(0.35 + noise * 0.5 + pattern * 0.35 + edge * 0.8, 0.0, 1.0) * cut;
    gl_FragColor = vec4(col, a);
  }
`

export type TellStyle = 'radial' | 'strip'

/**
 * A telegraph material. Code keeps setting `.opacity` as before; `syncTells()`
 * copies it into the shader each frame. `radius` is the shape's world radius,
 * so the ripples and edge line up with it. `cold` is Still's variant (N1):
 * the same shape, but it can never be mistaken for an enemy's tell.
 */
export function tellMaterial(style: TellStyle, radius = 1, hot = EMBER, deep = EMBER_DEEP, opts: { cold?: boolean } = {}): THREE.ShaderMaterial {
  const m = new THREE.ShaderMaterial({
    vertexShader: TELL_VERT,
    fragmentShader: TELL_FRAG,
    uniforms: {
      uTime: VFX_TIME,
      uOpacity: { value: 0 },
      uHot: { value: hot.clone() },
      uDeep: { value: deep.clone() },
      uStrip: { value: style === 'strip' ? 1 : 0 },
      uRadius: { value: radius },
      uCold: { value: opts.cold ? 1 : 0 },
      uMolten: { value: 0 },
      uSweep: { value: 0 },
      uSweepHalf: { value: 0.26 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    // normal, not additive: on a floor already lit warm, adding light washes a tell to white
    blending: THREE.NormalBlending,
  })
  m.opacity = 0
  TELLS.add(m)
  return m
}

const TELLS = new Set<THREE.ShaderMaterial>()

/** Copy each telegraph's `.opacity` into its shader. Once a frame. */
export function syncTells() {
  for (const m of TELLS) m.uniforms.uOpacity!.value = m.opacity
}

export function releaseTell(m: THREE.Material) {
  TELLS.delete(m as THREE.ShaderMaterial)
  m.dispose()
}

// --- a melt: molten metal in a vessel, for a body's face ---

const MELT_VERT = /* glsl */ `
  varying vec2 vP;
  varying vec3 vB;
  void main() {
    vP = position.xy;
    vB = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Molten metal seen from above: a hot, churning core breaking up through drifting plates
 * of crust, gone to dark slag at the rim. `uHot` is the body's core colour (lit, asleep or
 * reeling), so everything else keys off it; its hottest is pushed toward orange, hotter not
 * redder, and never white. `uSwell` (0..1) is the tell: the core widens, the crust thins and
 * the churn quickens. `uBall` is a thrown gob of it instead: a sphere, all crust, cracked
 * through with hot seams (sampled on three planes, so it has no seam of its own).
 */
const MELT_FRAG = /* glsl */ `
  uniform float uTime;
  uniform vec3 uHot;
  uniform vec3 uCrust;
  uniform float uSwell;
  uniform float uRadius;
  uniform float uSeed;
  uniform float uBall;
  varying vec2 vP;
  varying vec3 vB;
  float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) { return n(p) * 0.55 + n(p * 2.3 + 7.1) * 0.3 + n(p * 5.2 - 3.3) * 0.15; }
  float tri(vec3 b, vec3 w, float k, vec2 o) {
    return (fbm(b.xy * k + o) * w.z + fbm(b.yz * k + o.yx) * w.x + fbm(b.zx * k - o) * w.y) / (w.x + w.y + w.z);
  }
  void main() {
    if (uBall > 0.5) {
      vec3 b = vB / uRadius;
      vec3 w = pow(abs(b), vec3(3.0));
      float crustB = tri(b, w, 1.9, vec2(uSeed, uSeed * 0.7));
      float glowB = tri(b, w, 1.2, vec2(uSeed * 1.3 + uTime * 0.6, -uTime * 0.4));
      float seam = 1.0 - smoothstep(0.0, 0.06, abs(crustB - 0.5));
      float heatB = clamp(seam * (0.55 + 0.6 * glowB) + smoothstep(0.55, 0.8, glowB) * 0.35, 0.0, 1.0);
      vec3 colB = mix(uCrust, uHot * vec3(0.22, 0.12, 0.08), smoothstep(0.0, 0.3, heatB));
      colB = mix(colB, uHot * vec3(0.85, 1.3, 0.4), smoothstep(0.25, 0.7, heatB));
      colB = mix(colB, uHot * vec3(1.0, 3.4, 0.9), smoothstep(0.75, 1.0, heatB) * 0.7);
      gl_FragColor = vec4(colB, 1.0);
      return;
    }
    vec2 p = vP / uRadius;
    float r = length(p);
    float t = uTime * (1.0 + 1.6 * uSwell);
    // a slow turn of the whole melt, and a warp that rolls it over itself: nothing accumulates
    float a = t * 0.22 + uSeed;
    vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a)) * p;
    q += 0.35 * vec2(n(q * 1.6 + vec2(t * 0.5, uSeed)), n(q * 1.6 - vec2(uSeed, t * 0.45))) - 0.175;
    float melt = fbm(q * 2.4 + vec2(uSeed * 3.1 + t * 0.2, -t * 0.15));
    // crust plates drift slower than the melt under them, and part as it swells
    float crust = fbm(p * 2.3 + vec2(uSeed * 1.7 - t * 0.06, t * 0.05));
    float core = 1.0 - smoothstep(0.0, 0.42 + 0.4 * uSwell, r);
    float heat = core * 0.6 + melt * 0.75 - 0.26 + 0.24 * uSwell;
    float vein = 1.0 - smoothstep(0.0, 0.05, abs(crust - 0.47));
    float rim = smoothstep(0.55 - 0.1 * uSwell, 1.0, r);
    float plate = smoothstep(0.47, 0.54, crust) * (1.0 - 0.7 * core) * (1.0 - 0.55 * uSwell);
    heat = clamp(heat + vein * 0.35 * (1.0 - rim), 0.0, 1.0) * (1.0 - clamp(max(rim * 0.95, plate * 0.85), 0.0, 1.0));
    // the ramp leans orange as it heats, and loses the blue that read as salmon
    vec3 dull = uHot * vec3(0.22, 0.12, 0.08);
    vec3 mid = uHot * vec3(0.85, 1.3, 0.4);
    vec3 hottest = uHot * vec3(1.0, 3.4, 0.9);
    vec3 col = mix(uCrust, dull, smoothstep(0.0, 0.28, heat));
    col = mix(col, mid, smoothstep(0.22, 0.68, heat));
    col = mix(col, hottest, smoothstep(0.7, 1.0, heat) * (0.6 + 0.4 * uSwell));
    // a touch past full at the height of the swell, for the bloom
    col *= 1.0 + 0.25 * uSwell * smoothstep(0.5, 1.0, heat);
    gl_FragColor = vec4(col, 1.0);
  }
`

/** Where a melt's plates cool to: slag, a hair off black. */
export const MELT_CRUST = new THREE.Color(0x1a0805)

/**
 * A melt for a flat disc of `radius` (a CircleGeometry, in its own xy). Its `uHot` is a
 * Color the body keeps setting, as it did a basic material's `.color`. Unfogged: the
 * lights-out rule. Each gets its own seed, so two never churn in step.
 */
export function meltMaterial(radius: number, hot: THREE.Color): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: MELT_VERT,
    fragmentShader: MELT_FRAG,
    uniforms: {
      uTime: VFX_TIME,
      uHot: { value: hot },
      uCrust: { value: MELT_CRUST },
      uSwell: { value: 0 },
      uRadius: { value: radius },
      uSeed: { value: Math.random() * 10 },
      uBall: { value: 0 },
    },
  })
}

/** The same melt on a sphere of `radius`: a gob of it thrown, crusted over and cracking hot. */
export function meltBallMaterial(radius: number, hot: THREE.Color): THREE.ShaderMaterial {
  const m = meltMaterial(radius, hot)
  m.uniforms.uBall!.value = 1
  return m
}
