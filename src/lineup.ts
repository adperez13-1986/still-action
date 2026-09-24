import './style.css'
import * as THREE from 'three'
import { createWorld } from './world'
import { createGradePanel } from './grade'
import { loadKit } from './kit'
import { generateLevel } from './dungeon'
import { Still } from './still'

/**
 * DISPOSABLE: a lineup of three directions for Still, beside the current one,
 * standing in a real dungeon room under the real grade. Open /lineup.html.
 * Each keeps four separate parts (head, torso, arms, legs) so loot can still
 * swap them. Not part of the game.
 */

type Parts = { head: THREE.Group; torso: THREE.Group; arms: THREE.Group; legs: THREE.Group }

const METAL = () => new THREE.MeshStandardMaterial({ color: 0x4a5663, roughness: 0.55, metalness: 0.5 })
const DARK = () => new THREE.MeshStandardMaterial({ color: 0x2a3139, roughness: 0.7, metalness: 0.4 })
const RUST = () => new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.85, metalness: 0.25 })
const CLOTH = () => new THREE.MeshStandardMaterial({ color: 0x3b3f45, roughness: 1, metalness: 0, side: THREE.DoubleSide })
/** Pale and cold: Grace is the only warm light. */
const EYE = () => new THREE.MeshBasicMaterial({ color: 0xcfe6ff })

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat)
  m.position.set(x, y, z)
  return m
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material) {
  const len = a.distanceTo(b)
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat)
  m.position.copy(a).add(b).multiplyScalar(0.5)
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return m
}

function coil(radius: number, height: number, turns: number, tube: number, mat: THREE.Material) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= turns * 24; i++) {
    const t = i / (turns * 24)
    const a = t * turns * Math.PI * 2
    pts.push(new THREE.Vector3(Math.cos(a) * radius, t * height, Math.sin(a) * radius))
  }
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, tube, 6), mat)
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

// --- 1. Lantern: a cage with a small core, a lens on a stalk, bird legs ---
function lantern(): Parts {
  const metal = METAL()
  const dark = DARK()
  const eye = EYE()

  const legs = new THREE.Group()
  for (const side of [-1, 1]) {
    const hip = v(side * 0.12, 0.98, 0)
    const knee = v(side * 0.14, 0.58, 0.16)
    const ankle = v(side * 0.13, 0.18, -0.1)
    legs.add(rod(hip, knee, 0.045, dark), rod(knee, ankle, 0.035, dark), rod(ankle, v(side * 0.13, 0.02, 0.1), 0.03, metal))
    legs.add(mesh(new THREE.SphereGeometry(0.06, 8, 6), metal, knee.x, knee.y, knee.z))
  }

  const torso = new THREE.Group()
  torso.position.y = 1.02
  torso.rotation.x = 0.18 // a little hunched, leaning into the walk
  const bars = 6
  for (let i = 0; i < bars; i++) {
    const a = (i / bars) * Math.PI * 2
    torso.add(rod(v(Math.cos(a) * 0.13, 0, Math.sin(a) * 0.13), v(Math.cos(a) * 0.2, 0.52, Math.sin(a) * 0.17), 0.018, metal))
  }
  torso.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 16), dark, 0, 0.52, 0).rotateX(Math.PI / 2))
  torso.add(mesh(new THREE.TorusGeometry(0.13, 0.025, 6, 14), dark, 0, 0, 0).rotateX(Math.PI / 2))
  // the core: small, and visible through the bars
  torso.add(mesh(new THREE.SphereGeometry(0.075, 12, 8), eye, 0, 0.26, 0))

  const head = new THREE.Group()
  head.position.set(0, 1.56, 0.1)
  head.add(rod(v(0, 0, 0), v(0.03, 0.22, 0.04), 0.022, dark))
  const lens = new THREE.Group()
  lens.position.set(0.03, 0.3, 0.05)
  lens.rotation.z = 0.2 // head tilted, curious
  lens.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.13, 16), metal).rotateX(Math.PI / 2))
  lens.add(mesh(new THREE.CircleGeometry(0.1, 16), eye, 0, 0, 0.067))
  lens.add(mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 16), dark, 0, 0, 0.066))
  head.add(lens)

  const arms = new THREE.Group()
  // left: long, ends in a clamp
  const ls = v(-0.22, 1.5, 0.05), le = v(-0.3, 1.18, 0.12), lh = v(-0.28, 0.86, 0.18)
  arms.add(rod(ls, le, 0.028, dark), rod(le, lh, 0.024, metal))
  arms.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), metal, lh.x - 0.04, lh.y - 0.05, lh.z))
  arms.add(mesh(new THREE.BoxGeometry(0.03, 0.12, 0.05), metal, lh.x + 0.04, lh.y - 0.05, lh.z))
  // right: shorter, a hook
  const rs = v(0.22, 1.5, 0.05), re = v(0.27, 1.25, 0.1)
  arms.add(rod(rs, re, 0.028, dark))
  const hook = mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI * 1.3), metal, re.x, re.y - 0.08, re.z)
  hook.rotation.y = Math.PI / 2
  arms.add(hook)

  return { head, torso, arms, legs }
}

// --- 2. Scrap bundle: a can, a lamp for a head, a spring, one short leg on a block ---
function scrap(): Parts {
  const metal = METAL()
  const rust = RUST()
  const dark = DARK()
  const cloth = CLOTH()
  const eye = EYE()

  const legs = new THREE.Group()
  legs.add(rod(v(-0.13, 0.72, 0), v(-0.14, 0.06, 0.02), 0.06, metal))
  legs.add(mesh(new THREE.BoxGeometry(0.16, 0.06, 0.22), dark, -0.14, 0.03, 0.04))
  // the short one, propped on a block it found somewhere
  legs.add(rod(v(0.13, 0.72, 0), v(0.14, 0.2, 0.02), 0.055, rust))
  legs.add(mesh(new THREE.BoxGeometry(0.2, 0.18, 0.2), rust, 0.14, 0.09, 0.03))

  const torso = new THREE.Group()
  torso.position.y = 0.7
  torso.rotation.z = -0.06
  const can = mesh(new THREE.CylinderGeometry(0.27, 0.25, 0.56, 14), rust, 0, 0.28, 0)
  torso.add(can)
  torso.add(mesh(new THREE.TorusGeometry(0.27, 0.025, 6, 18), dark, 0, 0.44, 0).rotateX(Math.PI / 2))
  torso.add(mesh(new THREE.BoxGeometry(0.2, 0.16, 0.03), metal, 0.08, 0.24, 0.26).rotateZ(0.2)) // a patch
  // the cloth strip, tied round and trailing
  torso.add(mesh(new THREE.TorusGeometry(0.28, 0.035, 5, 18), cloth, 0, 0.12, 0).rotateX(Math.PI / 2))
  const tail = mesh(new THREE.PlaneGeometry(0.1, 0.42), cloth, -0.12, -0.05, -0.28)
  tail.rotation.set(0.3, 0.4, 0.2)
  tail.name = 'tail'
  torso.add(tail)

  const head = new THREE.Group()
  head.position.set(0, 1.26, 0.02)
  head.add(coil(0.06, 0.2, 4, 0.014, metal))
  const lamp = new THREE.Group()
  lamp.position.y = 0.3
  lamp.rotation.x = 0.35 // looking a little down, a little forward
  lamp.add(mesh(new THREE.ConeGeometry(0.22, 0.2, 14, 1, true), metal, 0, 0.04, 0))
  lamp.add(mesh(new THREE.SphereGeometry(0.075, 12, 8), eye, 0, -0.03, 0.02))
  head.add(lamp)

  const arms = new THREE.Group()
  // a pipe with an elbow
  arms.add(rod(v(-0.27, 1.14, 0), v(-0.36, 0.9, 0.06), 0.045, metal))
  arms.add(mesh(new THREE.SphereGeometry(0.055, 8, 6), dark, -0.36, 0.9, 0.06))
  arms.add(rod(v(-0.36, 0.9, 0.06), v(-0.32, 0.66, 0.14), 0.04, metal))
  // a coil ending in a little pincer
  const spring = coil(0.04, 0.34, 6, 0.012, metal)
  spring.position.set(0.3, 0.78, 0.05)
  arms.add(spring)
  arms.add(mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), dark, 0.3, 0.76, 0.05))

  return { head, torso, arms, legs }
}

// --- 3. Wanderer: a torn cloak over a frame, an eye in the hood, one arm a stub ---
function wanderer(): Parts {
  const dark = DARK()
  const metal = METAL()
  const cloth = CLOTH()
  const eye = EYE()

  const legs = new THREE.Group()
  for (const side of [-1, 1]) {
    legs.add(rod(v(side * 0.1, 0.62, 0), v(side * 0.12, 0.3, 0.08), 0.035, dark))
    legs.add(rod(v(side * 0.12, 0.3, 0.08), v(side * 0.11, 0.02, -0.02), 0.03, metal))
  }

  const torso = new THREE.Group()
  // cloak: an open cone with a torn hem
  const cloakGeo = new THREE.ConeGeometry(0.42, 1.05, 9, 3, true)
  const pos = cloakGeo.attributes.position!
  let seed = 3
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.5) pos.setY(i, pos.getY(i) + rnd() * 0.22) // ragged hem
  }
  cloakGeo.computeVertexNormals()
  const cloak = mesh(cloakGeo, cloth, 0, 1.04, 0)
  torso.add(cloak)
  torso.add(mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cloth, 0, 1.5, 0)) // shoulders

  const head = new THREE.Group()
  head.position.set(0, 1.62, 0.02)
  // the hood: a shell open at the front, and the eye deep inside it
  const hood = mesh(new THREE.SphereGeometry(0.2, 14, 10, Math.PI * 0.2, Math.PI * 1.6), cloth)
  hood.rotation.y = Math.PI / 2 // the gap in the shell faces forward
  hood.scale.set(1, 1.15, 1.05)
  head.add(hood)
  head.add(mesh(new THREE.SphereGeometry(0.055, 10, 8), eye, 0, 0, 0.07))

  const arms = new THREE.Group()
  // one arm out of the cloak, thin and mechanical
  arms.add(rod(v(0.3, 1.36, 0.06), v(0.38, 1.02, 0.14), 0.026, dark))
  arms.add(rod(v(0.38, 1.02, 0.14), v(0.34, 0.74, 0.2), 0.022, metal))
  // the other is only a stub, and the cloak hangs flat on that side
  arms.add(rod(v(-0.3, 1.38, 0.04), v(-0.36, 1.24, 0.06), 0.03, metal))

  return { head, torso, arms, legs }
}

function assemble(p: Parts) {
  const g = new THREE.Group()
  g.add(p.legs, p.torso, p.arms, p.head)
  return g
}

/**
 * Mixes: the parts are separate, so directions can be combined. `lift` raises the
 * upper body when the legs come from a taller design.
 */
function mix(pick: { head: Parts; torso: Parts; arms: Parts; legs: Parts }, lift = 0) {
  const g = new THREE.Group()
  const upper = new THREE.Group()
  upper.position.y = lift
  upper.add(pick.torso.torso, pick.arms.arms, pick.head.head)
  g.add(pick.legs.legs, upper)
  return g
}

// --- the scene ---
const canvas = document.querySelector<HTMLCanvasElement>('#view')!
const hudRoot = document.querySelector<HTMLElement>('#hud')!
const world = createWorld(canvas, { arena: false })
createGradePanel(hudRoot, world)

const labels = document.createElement('div')
labels.style.cssText = 'position:absolute;inset:0;pointer-events:none;font:600 12px ui-sans-serif,system-ui;color:#cbd7e6;text-shadow:0 1px 3px #000'
hudRoot.appendChild(labels)

void loadKit().then(() => {
  const level = generateLevel(1, 4242)
  world.scene.add(level.group)
  const c = level.entrance

  const current = new Still()
  const lineup: [string, THREE.Object3D][] = [
    ['current', current.group],
    ['1 · lantern', assemble(lantern())],
    ['2 · scrap', assemble(scrap())],
    ['3 · wanderer', assemble(wanderer())],
    ['4 · cloak + lens', (() => { const w = wanderer(); const l = lantern(); return mix({ head: l, torso: w, arms: w, legs: w }) })()],
    // the lantern's hips sit at 0.98, the scrap bot's at 0.72
    ['5 · scrap on bird legs', (() => { const sc = scrap(); const l = lantern(); return mix({ head: sc, torso: sc, arms: sc, legs: l }, 0.26) })()],
  ]
  // stand them in a row across the screen: screen-right is world (+x, -z)
  lineup.forEach(([, g], i) => {
    const o = (i - (lineup.length - 1) / 2) * 1.75
    g.position.set(c.x + o * Math.SQRT1_2, 0, c.z - o * Math.SQRT1_2)
    g.rotation.y = Math.PI / 4 + 0.35 // turned toward the camera, a little to one side
    world.scene.add(g)
  })
  current.pos.copy(current.group.position)

  world.graceLight.position.set(c.x, 6, c.z)
  const target = c.clone()
  const offset = world.camera.position.clone()

  // close-up vs the size Still actually is on the phone
  let close = true
  const chip = document.createElement('button')
  chip.className = 'chip on'
  chip.textContent = 'close-up'
  chip.style.cssText = 'position:absolute;top:8px;left:10px;pointer-events:auto;z-index:20'
  chip.addEventListener('click', () => {
    close = !close
    chip.textContent = close ? 'close-up' : 'game size'
  })
  hudRoot.appendChild(chip)

  const tmp = new THREE.Vector3()
  const loop = (t: number) => {
    const s = t / 1000
    world.camera.zoom = close ? 3.3 : 1.1
    world.camera.updateProjectionMatrix()
    world.camera.position.copy(target).add(offset)
    world.camera.lookAt(target)

    // a little life: breathe, and the scrap bot's cloth sways
    lineup.forEach(([, g], i) => {
      if (i === 0) return
      g.position.y = Math.abs(Math.sin(s * 2 + i)) * 0.02
      g.getObjectByName('tail')?.rotation.set(0.3 + Math.sin(s * 2.4) * 0.25, 0.4, 0.2)
    })

    labels.innerHTML = lineup.map(([name, g]) => {
      tmp.copy(g.position).setY(-0.35).project(world.camera)
      const x = (tmp.x * 0.5 + 0.5) * window.innerWidth
      const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight
      return `<div style="position:absolute;left:${x}px;top:${y}px;transform:translateX(-50%)">${name}</div>`
    }).join('')

    world.render()
    requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
})
