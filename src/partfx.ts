import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, COLD_DEEP, EMBER, VFX_TIME, type Vfx } from './vfx'
import { PART, type PartEvent, type PartRuntime } from './parts'
import type { Enemy } from './enemy'
import type { Still } from './still'

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

/** Ward and Mirror Ward's shell stands this tall around him. */
const SHELL_H = 1.1

/**
 * N5: a shell of vertical cold facets. Its top edge drains down over the window
 * (G2: his marks close, never fill), and the facet seams catch the light.
 * Mirror Ward's is brighter, with a highlight sweeping round it.
 */
const SHELL_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const SHELL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uDrain;
  uniform float uSweep;
  uniform vec3 uHot;
  uniform vec3 uDeep;
  varying vec2 vUv;
  void main() {
    if (vUv.y > uDrain) discard;
    float facet = fract(vUv.x * 10.0);
    float seam = smoothstep(0.1, 0.0, min(facet, 1.0 - facet));
    float top = smoothstep(uDrain - 0.14, uDrain, vUv.y);
    // quantised shimmer, frost not fire
    float shimmer = floor(fract(sin(floor(vUv.x * 10.0) * 12.9898 + floor(uTime * 6.0)) * 43758.5) * 4.0) / 4.0;
    float sweep = uSweep * smoothstep(0.08, 0.0, abs(fract(vUv.x - uTime / 0.4) - 0.5) - 0.42);
    float heat = clamp(seam * 0.7 + top * 0.9 + shimmer * 0.15 + sweep, 0.0, 1.0);
    vec3 col = mix(uDeep, uHot, heat);
    float a = uOpacity * clamp(0.12 + vUv.y * 0.2 + seam * 0.45 + top * 0.6 + sweep * 0.6, 0.0, 1.0);
    gl_FragColor = vec4(col, a);
  }
`

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

  private readonly shellMat = new THREE.ShaderMaterial({
    vertexShader: SHELL_VERT,
    fragmentShader: SHELL_FRAG,
    uniforms: {
      uTime: VFX_TIME, uOpacity: { value: 0.6 }, uDrain: { value: 1 }, uSweep: { value: 0 },
      uHot: { value: COLD.clone() }, uDeep: { value: COLD_DEEP.clone() },
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  })
  /** Built for the Ward's radius; scaled if a shell's radius differs. */
  private readonly shell = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, SHELL_H, 10, 1, true), this.shellMat)
  /** Anvil: the ring at his feet closing from 1.0 to 0.3 over the window. */
  private readonly anvilMat = tellMaterial('radial', 1, COLD, COLD_DEEP, { cold: true })
  private readonly anvilRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40), this.anvilMat)
  private glintT = 0
  private embersT = 0

  constructor(
    readonly scene: THREE.Scene,
    private readonly vfx: Vfx,
    private readonly still: Still,
    /** Combat's part runtime: windows, decoy, anchor. Read every frame, never written. */
    private readonly parts: Readonly<PartRuntime>,
  ) {
    this.shell.visible = false
    this.anvilRing.rotation.x = -Math.PI / 2
    this.anvilRing.visible = false
    this.anvilMat.opacity = 0.8
    scene.add(this.shell, this.anvilRing)
  }

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

    this.drawWindows(dt)

    const from = this.still.pos
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

  /** The torso and arms windows, drawn from the part state each tick. */
  private drawWindows(dt: number) {
    const g = this.parts.guard
    const at = this.still.pos
    const shell = !!g && g.kind !== 'brace'
    this.shell.visible = shell
    if (g && shell) {
      this.shell.position.set(at.x, SHELL_H / 2 + 0.05, at.z)
      this.shell.scale.set(g.radius, 1, g.radius)
      this.shellMat.uniforms.uDrain!.value = Math.max(0.02, g.t / g.max)
      // Mirror Ward's is the pure white one, with the highlight going round
      const mirror = g.kind === 'mirror'
      this.shellMat.uniforms.uSweep!.value = mirror ? 1 : 0
      ;(this.shellMat.uniforms.uHot!.value as THREE.Color).copy(mirror ? new THREE.Color(1, 1, 1) : COLD)
    }
    if (g?.kind === 'brace' && (this.embersT -= dt) <= 0) {
      // the one time his body runs warm outside a push: this part is strain
      this.embersT = 0.1
      this.vfx.embers(this.still.core.getWorldPosition(new THREE.Vector3()), 2, 0.25, EMBER)
    }

    const a = this.parts.anvil
    this.anvilRing.visible = !!a
    if (a) {
      this.anvilRing.position.set(at.x, DECAL_Y + 0.012, at.z)
      this.anvilRing.scale.setScalar(0.3 + 0.7 * Math.max(0, a.t / a.max))
      if ((this.glintT -= dt) <= 0) {
        // a cold glint at the raised jaws
        this.glintT = 0.3
        this.vfx.flash(this.still.jawL.getWorldPosition(new THREE.Vector3()), COLD, 0.35)
      }
    }
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
