import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createWorld, grade } from './world'
import { createGradePanel, apply } from './grade'
import { Still } from './still'
import { Chaser } from './enemy'
import { Ranged } from './ranged'

/**
 * DISPOSABLE: the dungeon look test. One KayKit room under the real grade, to
 * decide whether the kit can be pulled cold and grim before a generator is built
 * around it. Open /look.html. Not part of the game.
 */

const TILE = 4
const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!
const world = createWorld(canvas, { arena: false })
// the arena's fog barely reached anything; a crawl needs the beyond to fade
grade.fogNear = 44
grade.fogFar = 72
// higher and dimmer than the arena's: a wide pool on photo-textured stone, not a spotlight
grade.graceLight = 300
createGradePanel(hudRoot, world)
apply(world)

/**
 * KayKit ships bright and warm. Pull its albedo down and cold so Grace's light is
 * the only warm thing in the room, as DESIGN.md requires. Tunable live.
 */
export const KIT = { darken: 0.34, cool: 0.3, photo: 0.85, relief: 1, graceY: 6 }
const kitMaterials = new Set<THREE.MeshStandardMaterial>()
const kitBase = new Map<THREE.MeshStandardMaterial, THREE.Color>()

function gradeKit() {
  const cold = new THREE.Color(0x6f8fbf)
  for (const m of kitMaterials) {
    m.color.copy(kitBase.get(m)!).multiplyScalar(KIT.darken).lerp(cold.clone().multiplyScalar(KIT.darken), KIT.cool)
    m.roughness = 1
    m.metalness = 0
  }
}

/**
 * Anti-clay: surface grime (world-space triplanar noise, so the kit's flat colour
 * gets stone-and-dirt breakup without new textures) and contact darkening (walls
 * and props go dark where they meet the floor). Shared uniforms, toggled live.
 */
const SURF = {
  uGrime: { value: 0.7 },
  uContact: { value: 0.65 },
  /** 1 = ambientCG photo textures over the kit's shapes, 0 = the kit's own flat colour. */
  uPhoto: { value: 1 },
  uPhotoGain: { value: KIT.photo },
  uRelief: { value: KIT.relief },
  uCool: { value: KIT.cool },
}

/**
 * Which photo texture a piece wears, and how many world units one repeat covers.
 * KayKit's UVs point into its colour atlas, so the photos are projected in world
 * space (triplanar) instead.
 */
type Surface = 'paving' | 'rock' | 'wood' | 'ground'
const SURFACE_TEX: Record<Surface, { id: string; scale: number; gain: number }> = {
  paving: { id: 'PavingStones142', scale: 7, gain: 0.62 },
  rock: { id: 'Rock035', scale: 3, gain: 1 },
  wood: { id: 'Planks023A', scale: 2, gain: 0.9 },
  // the beyond should recede, not compete with the room
  ground: { id: 'Ground108', scale: 6, gain: 0.32 },
}
function surfaceOf(name: string): Surface {
  if (name.startsWith('floor_dirt')) return 'ground'
  if (name.startsWith('floor')) return 'paving'
  if (/crate|box|barrel/.test(name)) return 'wood'
  return 'rock'
}

const texLoader = new THREE.TextureLoader()
const texCache = new Map<string, THREE.Texture>()
function tex(file: string, color: boolean) {
  let t = texCache.get(file)
  if (!t) {
    t = texLoader.load(`/textures/${file}.jpg`)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 4
    texCache.set(file, t)
  }
  return t
}

function antiClay(m: THREE.MeshStandardMaterial, surface: Surface) {
  const { id, scale, gain } = SURFACE_TEX[surface]
  const own = {
    uGain: { value: gain },
    uAlb: { value: tex(`${id}_Color`, true) },
    uNrm: { value: tex(`${id}_NormalGL`, false) },
    uScale: { value: 1 / scale },
  }
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SURF, own)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;
        uniform float uGrime;
        uniform float uContact;
        uniform float uPhoto;
        uniform float uPhotoGain;
        uniform float uRelief;
        uniform float uCool;
        uniform float uScale;
        uniform float uGain;
        uniform sampler2D uAlb;
        uniform sampler2D uNrm;
        vec3 triW() { vec3 b = pow(abs(normalize(vWNrm)), vec3(4.0)); return b / (b.x + b.y + b.z); }
        vec3 triAlb() {
          vec3 b = triW(); vec3 p = vWPos * uScale;
          return texture2D(uAlb, p.zy).rgb * b.x + texture2D(uAlb, p.xz).rgb * b.y + texture2D(uAlb, p.xy).rgb * b.z;
        }
        // whiteout-blended triplanar normal, returned in world space
        vec3 triNrm() {
          vec3 b = triW(); vec3 p = vWPos * uScale; vec3 n = normalize(vWNrm);
          vec3 tx = texture2D(uNrm, p.zy).xyz * 2.0 - 1.0;
          vec3 ty = texture2D(uNrm, p.xz).xyz * 2.0 - 1.0;
          vec3 tz = texture2D(uNrm, p.xy).xyz * 2.0 - 1.0;
          tx.xy *= uRelief; ty.xy *= uRelief; tz.xy *= uRelief;
          tx = vec3(tx.xy + n.zy, abs(tx.z) * n.x);
          ty = vec3(ty.xy + n.xz, abs(ty.z) * n.y);
          tz = vec3(tz.xy + n.xy, abs(tz.z) * n.z);
          return normalize(tx.zyx * b.x + ty.xzy * b.y + tz.xyz * b.z);
        }
        float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vnoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(h2(i), h2(i + vec2(1, 0)), u.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), u.x), u.y);
        }
        float fbm(vec2 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.3) + 0.15 * vnoise(p * 5.1); }
        float tri(float s) {
          vec3 b = abs(normalize(vWNrm)); b /= (b.x + b.y + b.z);
          return fbm(vWPos.yz * s) * b.x + fbm(vWPos.xz * s) * b.y + fbm(vWPos.xy * s) * b.z;
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 photo = triAlb() * uPhotoGain * uGain * mix(vec3(1.0), vec3(0.78, 0.88, 1.08), uCool);
        diffuseColor.rgb = mix(diffuseColor.rgb, photo, uPhoto);
        float g = tri(0.9) * 0.55 + tri(4.5) * 0.45;
        diffuseColor.rgb *= mix(1.0, 0.4 + 0.95 * g, uGrime);
        float side = 1.0 - abs(normalize(vWNrm).y);
        float foot = smoothstep(0.0, 1.1, vWPos.y);
        diffuseColor.rgb *= mix(1.0, 0.3 + 0.7 * foot, uContact * side);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        if (uPhoto > 0.5) normal = normalize((viewMatrix * vec4(triNrm(), 0.0)).xyz);`)
  }
  m.needsUpdate = true
}

const loader = new GLTFLoader()
const cache = new Map<string, THREE.Object3D>()

async function piece(name: string): Promise<THREE.Object3D> {
  let src = cache.get(name)
  if (!src) {
    src = (await loader.loadAsync(`/kaykit/${name}.glb`)).scene
    src.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial) {
        if (!kitBase.has(o.material)) {
          kitBase.set(o.material, o.material.color.clone())
          antiClay(o.material, surfaceOf(name))
        }
        kitMaterials.add(o.material)
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    gradeKit()
    cache.set(name, src)
  }
  return src.clone(true)
}

async function place(name: string, x: number, z: number, rotY = 0, y = 0, scale = 1) {
  const o = await piece(name)
  o.position.set(x, y, z)
  o.rotation.y = rotY
  o.scale.setScalar(scale)
  world.scene.add(o)
  return o
}

// a seeded random, so every reload shows the same room while tuning the grade
let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

async function build() {
  // ground under everything, so the ruins sit on something and the edge isn't a cliff into void
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(80, 48),
    new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 1 }),
  )
  const groundMat = ground.material as THREE.MeshStandardMaterial
  kitBase.set(groundMat, groundMat.color.clone())
  antiClay(groundMat, 'ground')
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -0.12
  world.scene.add(ground)

  // --- the room: 3x3 tiles, plus a corridor running east and a stub running south ---
  const floors = ['floor_tile_large', 'floor_tile_large', 'floor_tile_large', 'floor_tile_large_rocks', 'floor_dirt_large']
  const cells: [number, number][] = []
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) cells.push([i, j])
  cells.push([2, 0], [3, 0], [0, 2])
  for (const [i, j] of cells) {
    await place(floors[Math.floor(rand() * floors.length)]!, i * TILE, j * TILE, Math.floor(rand() * 4) * (Math.PI / 2))
  }

  // barriers on every room edge except where the corridors leave
  const half = TILE * 1.5
  for (let k = -1; k <= 1; k++) {
    await place('barrier', k * TILE, -half, 0) // north
    if (k !== 0) await place('barrier', k * TILE, half, 0) // south, gap for the stub
    await place('barrier', -half, k * TILE, Math.PI / 2) // west
    if (k !== 0) await place('barrier', half, k * TILE, Math.PI / 2) // east, gap for the corridor
  }
  for (const [x, z] of [[-half, -half], [half, -half], [-half, half], [half, half]] as const) {
    await place('column', x, z)
  }
  // corridor sides
  for (const i of [2, 3]) {
    await place('barrier', i * TILE, -TILE / 2, 0)
    await place('barrier', i * TILE, TILE / 2, 0)
  }
  await place('barrier', -TILE / 2, 2 * TILE, Math.PI / 2)
  await place('barrier', TILE / 2, 2 * TILE, Math.PI / 2)

  // cover
  await place('crates_stacked', -3.4, -3.2, 0.4)
  await place('barrel_large', 3.6, 3.4, 0, 0, 0.7)
  await place('box_large', -3.8, 3.2, 0.9, 0, 0.8)
  await place('rubble_half', 1.5, -4.2, 2.6, 0, 0.45)

  // --- the beyond: ruins outside the edge, sunk and scattered, fading into the fog ---
  const ruins = ['wall_broken', 'wall_broken', 'pillar', 'rubble_large', 'rubble_half', 'wall', 'barrier_column']
  for (let n = 0; n < 46; n++) {
    const a = rand() * Math.PI * 2
    const r = 10 + rand() * 20
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    // keep the corridor mouths clear
    if (Math.abs(z) < 3.5 && x > 5) continue
    if (Math.abs(x) < 3.5 && z > 5) continue
    // The camera looks from the south-east (+x, +z). Anything tall on that side stands
    // between you and the room, so the near side only gets low, sunk rubble.
    const nearSide = x + z > -2
    const name = nearSide ? (rand() < 0.5 ? 'rubble_half' : 'floor_dirt_large_rocky') : ruins[Math.floor(rand() * ruins.length)]!
    const sink = nearSide ? -2.4 - rand() * 0.6 : -rand() * 1.6
    await place(name, x, z, rand() * Math.PI * 2, sink, 0.8 + rand() * 0.5)
  }
  for (let n = 0; n < 14; n++) {
    const a = rand() * Math.PI * 2
    const r = 9 + rand() * 14
    await place('floor_dirt_large_rocky', Math.cos(a) * r, Math.sin(a) * r, rand() * 6, -0.08)
  }

  // --- for scale: Still in the room, a chaser and a ranged ---
  const still = new Still()
  still.pos.set(0.5, 0, 0.8)
  still.update(0, 0, 0)
  world.scene.add(still.group)

  const chaser = new Chaser(-2.5, 1.2)
  world.scene.add(chaser.group)
  chaser.group.position.set(-2.5, 0, 1.2)
  const ranged = new Ranged(9.5, 0.5)
  world.scene.add(ranged.group)
  ranged.group.position.set(9.5, 0, 0.5)
  ranged.group.rotation.y = -Math.PI / 2

  world.graceLight.position.set(0.5, KIT.graceY, 0.8)
  const target = new THREE.Vector3(0.5, 0, 0.8)
  world.camera.position.add(target)
  world.camera.lookAt(target)
}

// two extra sliders in the grade panel for the kit itself
const panel = document.querySelector<HTMLElement>('#grade')!
for (const [key, label, max] of [['darken', 'kit: brightness', 1], ['cool', 'kit: coldness', 1], ['photo', 'photo: brightness', 2], ['relief', 'photo: relief', 3], ['graceY', "Grace's light: height", 14]] as const) {
  const l = document.createElement('label')
  const v = document.createElement('span')
  v.textContent = String(KIT[key])
  const input = document.createElement('input')
  Object.assign(input, { type: 'range', min: '0', max: String(max), step: '0.01', value: String(KIT[key]) })
  input.addEventListener('input', () => {
    KIT[key] = Number(input.value)
    v.textContent = input.value
    SURF.uPhotoGain.value = KIT.photo
    SURF.uRelief.value = KIT.relief
    SURF.uCool.value = KIT.cool
    world.graceLight.position.y = KIT.graceY
    gradeKit()
  })
  l.append(label, v, input)
  panel.prepend(l)
}

// "save values" in the panel also writes the kit grade to kit.json
panel.querySelector('button:last-of-type')!.addEventListener('click', () => {
  void fetch('/__save/kit', { method: 'POST', body: JSON.stringify(KIT, null, 2) })
})

// --- shadows from the cold key light: one map, so it stays cheap on the phone ---
const key = world.scene.children.find((c): c is THREE.DirectionalLight => c instanceof THREE.DirectionalLight)!
key.shadow.mapSize.set(1024, 1024)
Object.assign(key.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 70 })
key.shadow.bias = -0.0008
key.shadow.normalBias = 0.04
world.renderer.shadowMap.type = THREE.PCFSoftShadowMap

function setShadows(on: boolean) {
  world.renderer.shadowMap.enabled = on
  key.castShadow = on
  world.scene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = on
      o.receiveShadow = on
      for (const m of [o.material].flat()) m.needsUpdate = true
    }
  })
}

// --- toggles, top left: flip each fix and see which one cures the clay ---
const grainU = world.gradePass.uniforms.uGrain!
const toggles: [string, boolean, (on: boolean) => void][] = [
  ['grime', true, (on) => (SURF.uGrime.value = on ? 0.7 : 0)],
  ['contact', true, (on) => (SURF.uContact.value = on ? 0.65 : 0)],
  ['shadows', true, setShadows],
  ['grain', true, (on) => (grainU.value = on ? 0.09 : 0)],
  ['photo', true, (on) => (SURF.uPhoto.value = on ? 1 : 0)],
]
const bar = document.createElement('div')
bar.style.cssText = 'position:absolute;top:8px;left:10px;display:flex;gap:6px;pointer-events:auto;z-index:20'
for (const [label, initial, set] of toggles) {
  const b = document.createElement('button')
  b.className = initial ? 'chip on' : 'chip'
  b.textContent = label
  b.addEventListener('click', () => set(b.classList.toggle('on')))
  bar.appendChild(b)
}
hudRoot.appendChild(bar)

void build().then(() => {
  for (const [, initial, set] of toggles) set(initial)
  const loop = (t: number) => {
    world.gradePass.uniforms.uTime!.value = t / 1000
    world.render()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})
