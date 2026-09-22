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

/** Everything the grade sliders can touch, in one place. */
export const grade = {
  exposure: 0.95,
  fogNear: 16,
  fogFar: 52,
  bloomStrength: 0.42,
  bloomThreshold: 0.72,
  bloomRadius: 0.6,
  vignette: 1.05,
  saturation: 0.62,
  graceLight: 3.4,
  viewHeight: 17,
}

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uVignette: { value: grade.vignette },
    uSaturation: { value: grade.saturation },
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
    varying vec2 vUv;

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
  resize: () => void
  render: () => void
}

export function createWorld(canvas: HTMLCanvasElement): World {
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
  scene.add(new THREE.HemisphereLight(0x2a3d57, 0x05080c, 0.55))

  const key = new THREE.DirectionalLight(0x6f92c4, 0.7)
  key.position.set(-8, 14, -6)
  scene.add(key)

  const graceLight = new THREE.PointLight(0xffb26b, grade.graceLight, 22, 1.8)
  graceLight.position.set(0, 1.6, 0)
  scene.add(graceLight)

  // --- floor ---
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(ARENA_RADIUS + 2, 64),
    new THREE.MeshStandardMaterial({ color: 0x151d28, roughness: 0.95, metalness: 0 }),
  )
  floor.rotation.x = -Math.PI / 2
  scene.add(floor)

  const grid = new THREE.GridHelper(ARENA_RADIUS * 2, 26, 0x2a3f5c, 0x1b2837)
  ;(grid.material as THREE.Material).transparent = true
  ;(grid.material as THREE.Material).opacity = 0.35
  grid.position.y = 0.01
  scene.add(grid)

  scene.add(buildArena())

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
  window.addEventListener('resize', resize)

  return {
    scene, camera, renderer, composer, graceLight, fog, bloom, gradePass,
    resize,
    render: () => composer.render(),
  }
}

/** Waist-height walls and scattered debris — open-topped, so nothing occludes the camera. */
function buildArena(): THREE.Group {
  const g = new THREE.Group()
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

  // interior reference objects — movement is unreadable without them
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 2.5 + Math.random() * (ARENA_RADIUS - 4)
    const h = 0.4 + Math.random() * 0.9
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.6 + Math.random(), h, 0.6 + Math.random()), debrisMat)
    d.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r)
    d.rotation.y = Math.random() * Math.PI
    g.add(d)
  }

  return g
}
