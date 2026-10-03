import * as THREE from 'three'
import { DECAL_Y } from './world'
import { UPGRADES } from './cores'
import type { Combat } from './combat'
import type { PartEvent } from './parts'

/**
 * Thorns, drawn (design/buildlayer/THORNS.md, "the look"): ONE InstancedMesh, so ONE draw call (the second is markfx.ts' ring). Instance 0 is the ARMED ring: a faint ring of short cold spikes on the floor at his feet
 * for as long as Thorns is worn, which flares (bigger, brighter, over `flareS`) on every thorns hit and more on a block. The others are Bramble Patch's patches, the same barbed ring at the patch's radius and drawn from
 * `combat.patches`, the very numbers the marking test uses, with a barbed look inside as well: a ring and an inner ring of spikes, so a patch reads as a floor to keep out of. Nothing is created after the constructor; with
 * another core or none worn it is hidden. A dark underlay under the cold spikes holds on a bright floor and a dark one (markfx.ts learned that). Nothing random: every number is a function of the frame and of the events.
 */
const LOOK = {
  /** The floor lift above the decals (and just under markfx's rings at 0.02). */
  lift: 0.015,
  /** The armed ring: its radius (u), its opacity at rest (it breathes by `amp` at `hz`), and how it looks on the floor under him. */
  armedR: 1.05, armedA: 0.38, amp: 0.06, hz: 0.7,
  /** A flare: how long it runs (s), how much bigger the ring swells (a share), by a hit and by a block. */
  flareS: 0.3, blockS: 0.45, hitGrow: 0.28, blockGrow: 0.55,
  /** A patch: grows in over `inS` (s) from `inFrom` of its size, and fades over its last `outS`; its opacity. */
  inS: 0.12, inFrom: 0.6, outS: 0.4, patchA: 0.85,
  /** The ring's parts, as fractions of its radius: the band, the outward spikes (count, base half-width in radians, tip), the inward ones. */
  band: [0.74, 0.8] as const, rim: [0.7, 0.84] as const, out: { n: 12, half: 0.1, tip: 1.0 }, inn: { n: 8, half: 0.12, tip: 0.5 }, rimGrow: 0.03,
  core: [0.5, 0.78, 1.0] as const, dark: [0.02, 0.04, 0.09] as const,
}
const CAP = 1 + UPGRADES['thorns-patch'].max

/** A triangle on the floor, appended to the position / colour arrays. */
function tri(pos: number[], col: number[], pts: readonly (readonly [number, number])[], rgb: readonly number[], alpha: number) {
  for (const [x, z] of pts) {
    pos.push(x, 0, z)
    col.push(rgb[0]!, rgb[1]!, rgb[2]!, alpha)
  }
}

/** A spike: base on radius `r0`, `half` radians either side of angle `t`, tip at radius `r1` on `t`. */
function spike(pos: number[], col: number[], r0: number, r1: number, t: number, half: number, rgb: readonly number[], alpha: number) {
  tri(pos, col, [[Math.cos(t - half) * r0, Math.sin(t - half) * r0], [Math.cos(t + half) * r0, Math.sin(t + half) * r0], [Math.cos(t) * r1, Math.sin(t) * r1]], rgb, alpha)
}

/** A full ring band, radii r0..r1, in `steps` quads. */
function ring(pos: number[], col: number[], r0: number, r1: number, steps: number, rgb: readonly number[], alpha: number) {
  for (let i = 0; i < steps; i++) {
    const t0 = (i / steps) * Math.PI * 2
    const t1 = ((i + 1) / steps) * Math.PI * 2
    const a: [number, number] = [Math.cos(t0) * r0, Math.sin(t0) * r0]
    const b: [number, number] = [Math.cos(t1) * r0, Math.sin(t1) * r0]
    const c: [number, number] = [Math.cos(t0) * r1, Math.sin(t0) * r1]
    const d: [number, number] = [Math.cos(t1) * r1, Math.sin(t1) * r1]
    tri(pos, col, [a, b, c, b, d, c], rgb, alpha)
  }
}

function geometry(): THREE.BufferGeometry {
  const pos: number[] = []
  const col: number[] = []
  ring(pos, col, LOOK.rim[0], LOOK.rim[1], 36, LOOK.dark, 0.6)
  ring(pos, col, LOOK.band[0], LOOK.band[1], 36, LOOK.core, 0.95)
  // the spikes: outward (from the band, dark and bigger first), and a shorter set inward; each set offset half a step from the other
  for (let k = 0; k < LOOK.out.n; k++) {
    const t = ((k + 0.5) / LOOK.out.n) * Math.PI * 2
    spike(pos, col, LOOK.band[1] - 0.02, LOOK.out.tip + LOOK.rimGrow, t, LOOK.out.half + LOOK.rimGrow, LOOK.dark, 0.6)
    spike(pos, col, LOOK.band[1] - 0.02, LOOK.out.tip, t, LOOK.out.half, LOOK.core, 0.95)
  }
  for (let k = 0; k < LOOK.inn.n; k++) {
    const t = (k / LOOK.inn.n) * Math.PI * 2
    spike(pos, col, LOOK.band[0] + 0.02, LOOK.inn.tip - LOOK.rimGrow, t, LOOK.inn.half + LOOK.rimGrow, LOOK.dark, 0.6)
    spike(pos, col, LOOK.band[0] + 0.02, LOOK.inn.tip, t, LOOK.inn.half, LOOK.core, 0.95)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4))
  const a = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1)
  a.setUsage(THREE.DynamicDrawUsage)
  g.setAttribute('aAlpha', a)
  return g
}

export class ThornFx {
  private readonly mesh: THREE.InstancedMesh
  private readonly mat: THREE.MeshBasicMaterial
  /** The armed ring's flare: how long ago it started (s; negative: none) and how big it swells and how long it runs. */
  private flareAge = -1
  private flareGrow = 0
  private flareLen = LOOK.flareS
  private clock = 0
  /** Instances drawn last frame (for checks). */
  drawn = 0

  constructor(scene: THREE.Scene) {
    this.mat = new THREE.MeshBasicMaterial({
      color: 0xffffff, vertexColors: true, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      // a transparent double-sided material is drawn twice unless told otherwise: one draw call
      forceSinglePass: true,
    })
    // a per-instance alpha, as markfx.ts has it
    this.mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aAlpha;\nvarying float vAlpha;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvAlpha = aAlpha;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vAlpha;')
    }
    this.mesh = new THREE.InstancedMesh(geometry(), this.mat, CAP)
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    this.mesh.frustumCulled = false
    this.mesh.visible = false
    this.mesh.count = 0
    // over the floor and its decals, under every tell (tellOrder starts near 1000)
    this.mesh.renderOrder = 2
    this.mesh.name = 'thorns-ring'
    scene.add(this.mesh)
  }

  /** A thorns hit: the armed ring flares (a block's is the bigger and the longer). */
  event(ev: PartEvent) {
    if (ev.kind !== 'thorns') return
    this.flareAge = 0
    this.flareGrow = ev.blocked ? LOOK.blockGrow : LOOK.hitGrow
    this.flareLen = ev.blocked ? LOOK.blockS : LOOK.flareS
  }

  /** A new level, a run's end or the core off: nothing up. */
  clear() {
    this.flareAge = -1
    this.mesh.count = 0
    this.mesh.visible = false
    this.drawn = 0
  }

  private put(i: number, x: number, z: number, size: number, alpha: number) {
    const m = this.mesh.instanceMatrix.array as Float32Array
    const o = i * 16
    m[o] = size; m[o + 1] = 0; m[o + 2] = 0; m[o + 3] = 0
    m[o + 4] = 0; m[o + 5] = size; m[o + 6] = 0; m[o + 7] = 0
    m[o + 8] = 0; m[o + 9] = 0; m[o + 10] = size; m[o + 11] = 0
    m[o + 12] = x; m[o + 13] = DECAL_Y + LOOK.lift; m[o + 14] = z; m[o + 15] = 1
    ;((this.mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).array as Float32Array)[i] = alpha
  }

  /** One rendered frame (`dt` real seconds, 0 while paused), Still at (x, z). `on`: Thorns is worn in a crawl. */
  update(on: boolean, dt: number, combat: Combat, x: number, z: number) {
    if (!on) {
      if (this.mesh.visible) this.clear()
      return
    }
    this.clock += dt
    // the armed ring: faint, breathing; a flare swells it and lights it, fast then easing back
    let size = LOOK.armedR
    let alpha = LOOK.armedA * (1 - LOOK.amp + LOOK.amp * Math.sin(this.clock * Math.PI * 2 * LOOK.hz))
    if (this.flareAge >= 0) {
      this.flareAge += dt
      const f = this.flareAge / this.flareLen
      if (f >= 1) this.flareAge = -1
      else {
        const k = f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8
        size *= 1 + this.flareGrow * k
        alpha += (1 - alpha) * k
      }
    }
    this.put(0, x, z, size, alpha)
    let n = 1
    const U = UPGRADES['thorns-patch']
    for (let i = 0; i < combat.patches.length && n < CAP; i++) {
      const q = combat.patches[i]!
      const grow = q.t < LOOK.inS ? LOOK.inFrom + (1 - LOOK.inFrom) * (q.t / LOOK.inS) : 1
      const left = U.lifeS - q.t
      const fade = left < LOOK.outS ? Math.max(0, left / LOOK.outS) : 1
      this.put(n++, q.x, q.z, U.radius * grow, LOOK.patchA * fade)
    }
    this.drawn = n
    this.mesh.count = n
    this.mesh.visible = true
    this.mesh.instanceMatrix.needsUpdate = true
    ;(this.mesh.geometry.getAttribute('aAlpha') as THREE.InstancedBufferAttribute).needsUpdate = true
  }

  dispose() {
    this.mesh.removeFromParent()
    this.mesh.geometry.dispose()
    this.mesh.dispose()
    this.mat.dispose()
  }
}
