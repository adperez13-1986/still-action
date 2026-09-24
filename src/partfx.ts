import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, COLD_DEEP, type Vfx } from './vfx'
import { PART, type PartEvent } from './parts'
import type { Enemy } from './enemy'

/** A lob in the air: the glob climbing over the wall, and the landing mark closing on its true size. */
interface Lob { from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; radius: number; glob: THREE.Mesh; ring: THREE.Mesh; mat: THREE.ShaderMaterial }

/** A flat cold strip that fades: a jab's line, a charge's wake. */
interface Beam { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; life: number; max: number; opacity: number }

/** The hook's chain to something it caught, while it's hauled in. */
interface Tether { enemy: Enemy; t: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial }

/** A cold ring on the floor contracts from this much wider than its true size (G2: Still's marks close, enemies' fill). */
const PREVIEW_WIDE = 1.3
/** The glob leaves from about lens height. */
const LOB_FROM_Y = 1.9
const TETHER_Y = 1.0

/** A unit strip along +z from the origin, flat on the floor plane. Scaled to width × length. */
function unitStrip() {
  const g = new THREE.PlaneGeometry(1, 1)
  g.translate(0, 0.5, 0)
  g.rotateX(Math.PI / 2)
  return g
}

/**
 * Persistent part visuals, drawn by reading state: shells, the decoy, the anchor
 * and its tether, mark badges, zones, breach rims, lob globs, previews. Moments
 * arrive through `event`; anything that lasts is polled in `update`, so nothing
 * leaks across levels as long as `clear` runs where `combat.reset()` does.
 *
 * `update` runs on game time, from the simulation, so a glob lands on the same
 * tick its blast does even through hitstop.
 */
export class PartFx {
  private lobs: Lob[] = []
  private beams: Beam[] = []
  private tethers: Tether[] = []
  private readonly stripGeo = unitStrip()
  private readonly ringGeo = new THREE.RingGeometry(0.9, 1, 48)
  private readonly globGeo = new THREE.SphereGeometry(0.16, 10, 8)
  private readonly globMat = new THREE.MeshBasicMaterial({ color: 0xeef6ff, blending: THREE.AdditiveBlending, transparent: true })

  constructor(
    readonly scene: THREE.Scene,
    private readonly vfx: Vfx,
    /** Where a tether starts: Still's hook, near enough. */
    private readonly still: () => THREE.Vector3,
  ) {}

  /** One instant from Combat's onPart. */
  event(ev: PartEvent) {
    if (ev.kind === 'lob') {
      const mat = tellMaterial('radial', 1, COLD, COLD_DEEP, { cold: true })
      mat.opacity = 0.85
      const ring = new THREE.Mesh(this.ringGeo, mat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(ev.to.x, DECAL_Y + 0.015, ev.to.z)
      ring.scale.setScalar(ev.radius * PREVIEW_WIDE)
      const glob = new THREE.Mesh(this.globGeo, this.globMat)
      glob.position.set(ev.from.x, LOB_FROM_Y, ev.from.z)
      this.scene.add(ring, glob)
      this.lobs.push({ from: ev.from.clone(), to: ev.to.clone(), t: 0, T: ev.ms / 1000, radius: ev.radius, glob, ring, mat })
    } else if (ev.kind === 'land') {
      const i = this.lobs.findIndex((l) => l.to.distanceToSquared(ev.at) < 1e-4)
      if (i >= 0) this.dropLob(i)
    }
  }

  update(dt: number) {
    for (const l of this.lobs) {
      l.t = Math.min(l.T, l.t + dt)
      const k = l.t / l.T
      // N12: a parabola over the flight, high enough to be seen clearing the wall
      l.glob.position.set(
        l.from.x + (l.to.x - l.from.x) * k,
        LOB_FROM_Y + (0.2 - LOB_FROM_Y) * k + Math.sin(k * Math.PI) * PART.lobPeak,
        l.from.z + (l.to.z - l.from.z) * k,
      )
      this.vfx.trail(l.glob.position, COLD, 0.26, 0.25)
      l.ring.scale.setScalar(l.radius * (PREVIEW_WIDE + (1 - PREVIEW_WIDE) * k))
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i]!
      b.life -= dt
      b.mat.opacity = b.opacity * Math.max(0, b.life / b.max)
      if (b.life <= 0) {
        this.scene.remove(b.mesh)
        releaseTell(b.mat)
        this.beams.splice(i, 1)
      }
    }

    const from = this.still()
    for (let i = this.tethers.length - 1; i >= 0; i--) {
      const te = this.tethers[i]!
      te.t -= dt
      const e = te.enemy
      if (te.t <= 0 || e.dead) {
        this.scene.remove(te.mesh)
        releaseTell(te.mat)
        this.tethers.splice(i, 1)
        continue
      }
      this.pose(te.mesh, from, e.pos, 0.12, TETHER_Y)
      this.vfx.trail(new THREE.Vector3(e.pos.x, 0.9, e.pos.z), COLD, 0.3)
    }
  }

  /** N2: a flat cold strip from one point to another, fading over `life`. */
  beam(from: THREE.Vector3, to: THREE.Vector3, width: number, life: number, y = DECAL_Y + 0.02, opacity = 0.8) {
    const mat = tellMaterial('strip', 1, COLD, COLD_DEEP, { cold: true })
    mat.opacity = opacity
    const mesh = new THREE.Mesh(this.stripGeo, mat)
    this.pose(mesh, from, to, width, y)
    this.scene.add(mesh)
    this.beams.push({ mesh, mat, life, max: life, opacity })
  }

  /** The hook's chain to an enemy it caught, re-posed every frame while it's hauled in. */
  yank(enemy: Enemy, life = 0.2) {
    const mat = tellMaterial('strip', 1, COLD, COLD_DEEP, { cold: true })
    mat.opacity = 0.9
    const mesh = new THREE.Mesh(this.stripGeo, mat)
    this.scene.add(mesh)
    this.tethers.push({ enemy, t: life, mesh, mat })
  }

  /** A new level or a new run: everything drawn goes. */
  clear() {
    while (this.lobs.length) this.dropLob(0)
    for (const b of this.beams) {
      this.scene.remove(b.mesh)
      releaseTell(b.mat)
    }
    this.beams.length = 0
    for (const te of this.tethers) {
      this.scene.remove(te.mesh)
      releaseTell(te.mat)
    }
    this.tethers.length = 0
  }

  private dropLob(i: number) {
    const l = this.lobs[i]!
    this.scene.remove(l.glob, l.ring)
    releaseTell(l.mat)
    this.lobs.splice(i, 1)
  }

  /** Lay a unit strip from a to b at height y. */
  private pose(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, width: number, y: number) {
    const len = Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z))
    mesh.position.set(a.x, y, a.z)
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
    mesh.scale.set(width, 1, len)
  }
}
