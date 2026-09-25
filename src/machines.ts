import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { skin } from './kit'
import type { MachineKind } from './areas'

/**
 * The Works' beyond: the foundry's machinery standing in the fog past the walls.
 * Built from primitives in code, one instanced mesh per kind, skinned in the Works'
 * sheet iron. They're silhouettes: no lights, no ember, never on the camera side
 * (the generator only puts them where their shadow falls on no floor).
 *
 *   chimney   a stack 9-13 u tall, with a lip
 *   crucible  a tapered pot with a dark mouth
 *   press     a block with its head over it
 *   hopper    an upturned cone on four legs
 */

export interface MachinePlacement {
  kind: MachineKind
  x: number
  z: number
  /** Sunk into the ground, like the ruins (≤ 0). */
  y: number
  rotY: number
  scale: number
  /** The chimney's height before scale; the others have one. */
  h?: number
}

/** Each kind's height before scale: what the generator needs to keep its shadow off the floor. */
export const MACHINE_H: Record<MachineKind, number> = { chimney: 11, crucible: 2.6, press: 3.8, hopper: 4 }
/** A chimney's height is drawn from this range. */
export const CHIMNEY_H: [number, number] = [9, 13]

/** Vertex colour: most of a machine wears the skin as it is; mouths and joins are dark. */
const LIT = 1
const DARK = 0.18

function tinted(g: THREE.BufferGeometry, v: number) {
  const n = g.getAttribute('position').count
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(v), 3))
  return g
}

function shape(kind: MachineKind): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const add = (g: THREE.BufferGeometry, x: number, y: number, z: number, v = LIT) => parts.push(tinted(g.translate(x, y, z), v))
  switch (kind) {
    case 'chimney': {
      const h = MACHINE_H.chimney
      add(new THREE.CylinderGeometry(1.1, 1.1, h, 8), 0, h / 2, 0)
      add(new THREE.CylinderGeometry(1.35, 1.35, 0.45, 8), 0, h - 0.1, 0)
      add(new THREE.CircleGeometry(1.05, 8).rotateX(-Math.PI / 2), 0, h + 0.13, 0, DARK)
      break
    }
    case 'crucible':
      add(new THREE.CylinderGeometry(1.7, 1.3, 2.6, 10), 0, 1.3, 0)
      add(new THREE.CircleGeometry(1.5, 10).rotateX(-Math.PI / 2), 0, 2.4, 0, DARK)
      break
    case 'press':
      add(new THREE.BoxGeometry(3, 3.8, 2.4), 0, 1.9, 0)
      add(new THREE.BoxGeometry(3.4, 0.8, 2.8), 0, 3.2, 0)
      add(new THREE.BoxGeometry(3.1, 0.12, 2.5), 0, 2.74, 0, DARK)
      break
    case 'hopper':
      add(new THREE.ConeGeometry(1.8, 2, 10).rotateX(Math.PI), 0, 4, 0)
      for (const [lx, lz] of [[1.1, 1.1], [-1.1, 1.1], [1.1, -1.1], [-1.1, -1.1]] as const) add(new THREE.BoxGeometry(0.25, 3, 0.25), lx, 1.5, lz)
      break
  }
  const g = mergeGeometries(parts)!
  g.computeBoundingBox()
  return g
}

/** Shared by every level: built once, never disposed. */
let kit: { geo: Record<MachineKind, THREE.BufferGeometry>; mat: THREE.MeshStandardMaterial } | null = null
function machineKit() {
  if (kit) return kit
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true })
  // darker than the walls: shapes standing in the fog, not things to look at
  skin(mat, 'rock', { gain: 0.34 })
  kit = { geo: { chimney: shape('chimney'), crucible: shape('crucible'), press: shape('press'), hopper: shape('hopper') }, mat }
  return kit
}

/** One InstancedMesh per kind used. Its instance buffers are the level's; the shapes are shared. */
export function buildMachines(list: readonly MachinePlacement[]): THREE.Group {
  const group = new THREE.Group()
  const { geo, mat } = machineKit()
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  for (const kind of ['chimney', 'crucible', 'press', 'hopper'] as const) {
    const of = list.filter((p) => p.kind === kind)
    if (!of.length) continue
    const inst = new THREE.InstancedMesh(geo[kind], mat, of.length)
    inst.name = `machine:${kind}`
    of.forEach((p, i) => {
      q.setFromAxisAngle(up, p.rotY)
      pos.set(p.x, p.y, p.z)
      // a chimney stretches to its own height; everything else keeps its proportions
      scl.set(p.scale, p.scale * (p.h ? p.h / MACHINE_H.chimney : 1), p.scale)
      inst.setMatrixAt(i, m.compose(pos, q, scl))
    })
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    group.add(inst)
  }
  return group
}

/** The top of a placed machine, world y: how far its shadow reaches behind it. */
export const machineTop = (p: MachinePlacement) => p.y + (p.h ?? MACHINE_H[p.kind]) * p.scale
