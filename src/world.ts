import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'

/** Locked isometric pitch. Q2: the camera never rotates. */
const PITCH = 38 * (Math.PI / 180)
const YAW = 45 * (Math.PI / 180)
const CAM_DIST = 40

export const ARENA_RADIUS = 13

/**
 * Height for anything drawn flat on the floor: telegraphs, rings, auras, pads.
 * The kit's floor tiles top out at +0.05, so anything lower is hidden under them.
 */
export const DECAL_Y = 0.1

/** Circles on a plane. No physics engine, per Q12. */
export interface Collider { x: number; z: number; r: number }

/** Everything the grade sliders can touch, in one place. */
/** Shared by Still and the enemies — push a circle out of the static debris. */
export function pushOutOfColliders(pos: { x: number; z: number }, radius: number, colliders: Collider[]) {
  for (const c of colliders) {
    const dx = pos.x - c.x
    const dz = pos.z - c.z
    const min = c.r + radius
    const dist = Math.hypot(dx, dz)
    if (dist > 0.0001 && dist < min) {
      pos.x = c.x + (dx / dist) * min
      pos.z = c.z + (dz / dist) * min
    }
  }
}

export const grade = {
  exposure: 1.3,
  fogNear: 44,
  fogFar: 72,
  bloomStrength: 0.5,
  bloomThreshold: 0.72,
  bloomRadius: 0.6,
  vignette: 0.8,
  saturation: 0.78,
  graceLight: 300,
  viewHeight: 17,
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: grade.vignette },
    uSaturation: { value: grade.saturation },
    /** Film grain, 0 = off. Breaks up the clean "clay" read of flat-coloured kits. */
    uGrain: { value: 0 },
    uTime: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uVignette;
    uniform float uSaturation;
    uniform float uGrain;
    uniform float uTime;
    varying vec2 vUv;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
      vec4 c = texture2D(tDiffuse, vUv);

      // desaturate hard, then tint the remaining shadow cold
      float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb = mix(vec3(l), c.rgb, uSaturation);
      c.rgb *= mix(vec3(0.86, 0.94, 1.12), vec3(1.0), smoothstep(0.0, 0.5, l));

      // vignette
      vec2 d = vUv - 0.5;
      float v = 1.0 - dot(d, d) * uVignette * 2.2;
      c.rgb *= clamp(v, 0.0, 1.0);

      // grain: strongest in the mids, where flat colour reads most like clay
      float n = hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5;
      c.rgb += n * uGrain * (0.35 + 0.65 * smoothstep(0.0, 0.35, l) * (1.0 - smoothstep(0.55, 1.0, l)));

      gl_FragColor = c;
    }
  `,
}

export interface World {
  scene: THREE.Scene
  camera: THREE.OrthographicCamera
  renderer: THREE.WebGLRenderer
  composer: EffectComposer
  graceLight: THREE.PointLight
  fog: THREE.Fog
  bloom: UnrealBloomPass
  gradePass: ShaderPass
  colliders: Collider[]
  resize: () => void
  render: () => void
}

/** `arena: false` gives the lit, graded, empty world: for the dungeon look test, and later the crawl. */
export function createWorld(canvas: HTMLCanvasElement, opts: { arena?: boolean } = {}): World {
  const withArena = opts.arena ?? true
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = grade.exposure
  renderer.shadowMap.enabled = false

  const scene = new THREE.Scene()
  const fog = new THREE.Fog(0x0b1018, grade.fogNear, grade.fogFar)
  scene.fog = fog
  scene.background = new THREE.Color(0x070a0e)

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
  camera.position.set(Math.sin(YAW) * CAM_DIST, Math.tan(PITCH) * CAM_DIST, Math.cos(YAW) * CAM_DIST)
  camera.lookAt(0, 0, 0)

  // --- lights: one warm source (Grace), everything else cold ---
  scene.add(new THREE.HemisphereLight(0x53749c, 0x0b1119, 1.6))

  const key = new THREE.DirectionalLight(0x8fb0da, 1.15)
  key.position.set(-8, 14, -6)
  scene.add(key)

  const graceLight = new THREE.PointLight(0xffb26b, grade.graceLight, 34, 1.6)
  graceLight.position.set(0, 4.6, 0)
  scene.add(graceLight)

  const colliders: Collider[] = []
  if (withArena) {
    // --- floor ---
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS + 34, 72),
      new THREE.MeshStandardMaterial({ color: 0x24303f, roughness: 0.95, metalness: 0 }),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    const grid = new THREE.GridHelper(ARENA_RADIUS * 2, 26, 0x2a3f5c, 0x1b2837)
    ;(grid.material as THREE.Material).transparent = true
    ;(grid.material as THREE.Material).opacity = 0.35
    grid.position.y = 0.01
    scene.add(grid)

    const arena = buildArena()
    scene.add(arena.group)
    colliders.push(...arena.colliders)
  }

  // --- post ---
  const composer = new EffectComposer(renderer)
  composer.addPass(new RenderPass(scene, camera))

  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), grade.bloomStrength, grade.bloomRadius, grade.bloomThreshold)
  composer.addPass(bloom)

  const gradePass = new ShaderPass(GradeShader)
  composer.addPass(gradePass)
  composer.addPass(new OutputPass())

  function resize() {
    const w = window.innerWidth
    const h = window.innerHeight
    const aspect = w / h
    const halfH = grade.viewHeight / 2
    const halfW = halfH * aspect
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.updateProjectionMatrix()

    renderer.setSize(w, h, false)
    composer.setSize(w, h)
    bloom.setSize(w, h)
  }

  resize()
  // Turning the phone fires a burst of resizes; rebuilding every full-screen
  // buffer for each one spikes GPU memory. Rebuild once, after it settles.
  let resizeTimer = 0
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(resize, 180)
  })

  // If the phone takes the GPU away anyway, come back rather than die blank.
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    setTimeout(() => location.reload(), 400)
  })

  return {
    scene, camera, renderer, composer, graceLight, fog, bloom, gradePass,
    colliders,
    resize,
    render: () => composer.render(),
  }
}

/** Waist-height walls and scattered debris — open-topped, so nothing occludes the camera. */
function buildArena(): { group: THREE.Group; colliders: Collider[] } {
  const g = new THREE.Group()
  const colliders: Collider[] = []
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1b2531, roughness: 0.9 })
  const debrisMat = new THREE.MeshStandardMaterial({ color: 0x202b39, roughness: 0.85 })

  const segments = 40
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2
    const h = 1.1 + Math.random() * 0.5
    const block = new THREE.Mesh(new THREE.BoxGeometry(2.1, h, 0.9), wallMat)
    block.position.set(Math.cos(a) * ARENA_RADIUS, h / 2, Math.sin(a) * ARENA_RADIUS)
    block.rotation.y = -a
    g.add(block)
  }

  // Waist-high walls never occlude the camera, but you always see over them —
  // so the world has to continue past the arena or the edge reads as void.
  const outerMat = new THREE.MeshStandardMaterial({ color: 0x18222e, roughness: 0.95 })
  for (let i = 0; i < 46; i++) {
    const a = Math.random() * Math.PI * 2
    const r = ARENA_RADIUS + 3 + Math.random() * 27
    const h = 0.5 + Math.random() * 2.6
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.8 + Math.random() * 2.4, h, 0.8 + Math.random() * 2.4), outerMat)
    d.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r)
    d.rotation.y = Math.random() * Math.PI
    g.add(d)
  }

  // interior reference objects — movement is unreadable without them
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 2.5 + Math.random() * (ARENA_RADIUS - 4)
    const h = 0.4 + Math.random() * 0.9
    const w = 0.6 + Math.random()
    const dp = 0.6 + Math.random()
    const d = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), debrisMat)
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    d.position.set(x, h / 2, z)
    d.rotation.y = Math.random() * Math.PI
    g.add(d)
    colliders.push({ x, z, r: Math.max(w, dp) * 0.5 })
  }

  return { group: g, colliders }
}
