import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell, COLD, COLD_DEEP, EMBER, VFX_TIME, type Vfx } from './vfx'
import { PART, type EnemyStatus, type PartEvent, type PartRuntime } from './parts'
import type { Enemy } from './enemy'
import type { Still } from './still'

/**
 * Something in the air that will land: its mark on the floor closes on its true
 * size over the flight. A lob also has its glob; a throw has the enemy itself, and
 * a tick on the wall top when a wall will cut it short.
 */
interface Landing {
  from: THREE.Vector3; to: THREE.Vector3; t: number; T: number; radius: number; wide: number
  ring: THREE.Mesh; mat: THREE.ShaderMaterial
  glob?: THREE.Mesh
  /** Signal Flare's glob sputters a spark every 0.1 s. */
  sputter: boolean
  sputterT: number
  enemy?: Enemy
  tick?: THREE.Mesh
}

/** What PartFx may read of Combat's statuses. Nothing here writes. */
export interface StatusReader {
  statuses(): Iterable<[Enemy, Readonly<EnemyStatus>]>
  statusOf(e: Enemy): Readonly<EnemyStatus> | undefined
}

/** N3: the mark's three brackets orbiting an enemy's head. */
interface Badge { group: THREE.Group; mat: THREE.MeshBasicMaterial; spin: number; end: 'consumed' | 'expired' | null; endT: number; flash2: number }

/** A flat cold strip that fades: a jab's line, a charge's wake. */
interface Beam { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; life: number; max: number; opacity: number }

/** The hook's chain to something it caught, while it's hauled in. */
interface Tether { enemy: Enemy; t: number; mesh: THREE.Mesh; mat: THREE.ShaderMaterial }

/** A cold ring on the floor contracts from this much wider than its true size (G2: Still's marks close, enemies' fill). */
const PREVIEW_WIDE = 1.3
/** A throw's ring is smaller, so it closes less (1.4 to 1.2). */
const THROW_WIDE = 1.4 / 1.2
/** How long a mark lasts, for how far the brackets have closed. */
const MARK_S = 4
/** A consumed mark slams shut this fast; an expired one fades this slow. */
const SLAM_S = 0.12
const FADE_S = 0.25
/** With more marked than this on screen, each badge drops to one steady bracket (the crowd rule). */
const CROWD = 5
/** Falling frost motes, at most this many a beat across every slowed enemy. */
const MOTES_MAX = 12
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
  private landings: Landing[] = []
  private badges = new Map<Enemy, Badge>()
  private motesT = 0
  private readonly bracketGeo = new THREE.BoxGeometry(0.035, 0.035, 0.2)
  private readonly tickGeo = new THREE.BoxGeometry(0.12, 0.3, 0.12)
  private readonly tickMat = new THREE.MeshBasicMaterial({ color: 0xeef6ff, blending: THREE.AdditiveBlending, transparent: true })
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
    /** Combat's marks and slows, read-only. */
    private readonly status: StatusReader,
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
      const glob = new THREE.Mesh(this.globGeo, this.globMat)
      glob.position.set(ev.from.x, LOB_FROM_Y, ev.from.z)
      this.scene.add(glob)
      this.landings.push({ ...this.landingRing(ev.to, ev.radius, PREVIEW_WIDE), from: ev.from.clone(), t: 0, T: ev.ms / 1000, glob, sputter: ev.signal, sputterT: 0 })
    } else if (ev.kind === 'throw') {
      const radius = 1.2
      const l: Landing = { ...this.landingRing(ev.to, radius, THROW_WIDE), from: ev.enemy.pos.clone(), t: 0, T: ev.ms / 1000, enemy: ev.enemy, sputter: false, sputterT: 0 }
      if (ev.short) {
        // it'll hit the wall: a bright cold tick on the wall top, just past where it stops
        const dx = ev.to.x - l.from.x
        const dz = ev.to.z - l.from.z
        const d = Math.hypot(dx, dz) || 1
        const reach = ev.enemy.radius + 0.2
        l.tick = new THREE.Mesh(this.tickGeo, this.tickMat)
        l.tick.position.set(ev.to.x + (dx / d) * reach, 0.9, ev.to.z + (dz / d) * reach)
        this.scene.add(l.tick)
      }
      this.landings.push(l)
    } else if (ev.kind === 'land') {
      const i = this.landings.findIndex((l) => l.to.distanceToSquared(ev.at) < 1e-4)
      if (i >= 0) this.dropLanding(i)
    } else if (ev.kind === 'mark') {
      const b = this.badges.get(ev.enemy)
      if (ev.state === 'on' && !b) this.badges.set(ev.enemy, this.makeBadge())
      if (b && ev.state !== 'on') {
        b.end = ev.state
        b.endT = 0
        // "twice": two flashes 60 ms apart as the brackets slam shut
        if (ev.state === 'consumed') {
          this.vfx.flash(this.badgeAt(ev.enemy), COLD, 0.6)
          b.flash2 = 0.06
        }
      }
    }
  }

  update(dt: number) {
    for (const l of this.landings) {
      l.t = Math.min(l.T, l.t + dt)
      const k = l.t / l.T
      if (l.glob) {
        // N12: a parabola over the flight, high enough to be seen clearing the wall
        l.glob.position.set(
          l.from.x + (l.to.x - l.from.x) * k,
          LOB_FROM_Y + (0.2 - LOB_FROM_Y) * k + Math.sin(k * Math.PI) * PART.lobPeak,
          l.from.z + (l.to.z - l.from.z) * k,
        )
        this.vfx.trail(l.glob.position, COLD, l.sputter ? 0.3 : 0.26, 0.25)
        if (l.sputter && (l.sputterT -= dt) <= 0) {
          l.sputterT = 0.1
          this.vfx.sparks(l.glob.position, COLD, 1, 2)
        }
      }
      // the thrown body trails cold while it's in the air
      if (l.enemy && !l.enemy.dead) this.vfx.trail(new THREE.Vector3(l.enemy.pos.x, 0.8 + l.enemy.group.position.y, l.enemy.pos.z), COLD, 0.3)
      l.ring.scale.setScalar(l.radius * (l.wide + (1 - l.wide) * k))
    }
    // a thrown enemy that died in the air never lands: its mark goes with it
    for (let i = this.landings.length - 1; i >= 0; i--) if (this.landings[i]!.enemy?.dead) this.dropLanding(i)

    this.drawBadges(dt)
    this.drawFrost(dt)

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
    while (this.landings.length) this.dropLanding(0)
    for (const e of [...this.badges.keys()]) this.dropBadge(e)
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

  /** The N1 cold ring where something will land, starting `wide` times its true size. */
  private landingRing(to: THREE.Vector3, radius: number, wide: number) {
    const mat = tellMaterial('radial', 1, COLD, COLD_DEEP, { cold: true })
    mat.opacity = 0.85
    const ring = new THREE.Mesh(this.ringGeo, mat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(to.x, DECAL_Y + 0.015, to.z)
    ring.scale.setScalar(radius * wide)
    this.scene.add(ring)
    return { to: to.clone(), radius, wide, ring, mat }
  }

  private dropLanding(i: number) {
    const l = this.landings[i]!
    this.scene.remove(l.ring)
    if (l.glob) this.scene.remove(l.glob)
    if (l.tick) this.scene.remove(l.tick)
    releaseTell(l.mat)
    this.landings.splice(i, 1)
  }

  private makeBadge(): Badge {
    const mat = new THREE.MeshBasicMaterial({ color: 0xdfeeff, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false })
    const group = new THREE.Group()
    for (let i = 0; i < 3; i++) {
      // a chevron pointing in at the head: two short bars meeting at the apex
      const bracket = new THREE.Group()
      for (const side of [-1, 1]) {
        const bar = new THREE.Mesh(this.bracketGeo, mat)
        bar.rotation.y = side * 0.75
        bar.position.set(side * 0.065, 0, 0.07)
        bracket.add(bar)
      }
      const a = (i / 3) * Math.PI * 2
      bracket.userData.a = a
      bracket.rotation.y = a + Math.PI
      group.add(bracket)
    }
    this.scene.add(group)
    return { group, mat, spin: Math.random() * 6, end: null, endT: 0, flash2: 0 }
  }

  private dropBadge(e: Enemy) {
    const b = this.badges.get(e)
    if (!b) return
    this.scene.remove(b.group)
    b.mat.dispose()
    this.badges.delete(e)
  }

  private badgeAt(e: Enemy) {
    return new THREE.Vector3(e.pos.x, e.height * e.size + 0.25 + e.group.position.y, e.pos.z)
  }

  /** N3: each marked enemy's brackets orbit its head and close in as the mark runs out. */
  private drawBadges(dt: number) {
    let marked = 0
    for (const [, st] of this.status.statuses()) if (st.markT > 0) marked++
    const crowd = marked > CROWD
    for (const [e, b] of this.badges) {
      if (e.dead) {
        this.dropBadge(e)
        continue
      }
      const markT = this.status.statusOf(e)?.markT ?? 0
      const close = b.end ? 1 : 1 - Math.min(1, markT / MARK_S)
      let r = Math.max(0.45, e.radius * e.size * 1.3) * (1 - 0.45 * close)
      let opacity = 0.9
      if (b.end) {
        b.endT += dt
        if (b.end === 'consumed') {
          // slammed shut to a point
          r *= Math.max(0, 1 - b.endT / SLAM_S)
          if (b.flash2 > 0 && (b.flash2 -= dt) <= 0) this.vfx.flash(this.badgeAt(e), COLD, 0.6)
          if (b.endT >= Math.max(SLAM_S, 0.07)) { this.dropBadge(e); continue }
        } else {
          opacity *= Math.max(0, 1 - b.endT / FADE_S)
          if (b.endT >= FADE_S) { this.dropBadge(e); continue }
        }
      }
      b.spin += dt * 1.2
      b.group.position.copy(this.badgeAt(e))
      b.group.rotation.y = b.spin
      b.mat.opacity = opacity
      b.group.children.forEach((c, i) => {
        const a = c.userData.a as number
        c.position.set(Math.sin(a) * r, 0, Math.cos(a) * r)
        c.visible = !crowd || i === 0
      })
    }
  }

  /** N4a: slowed enemies shed falling cold motes, a few at a time across the whole screen. */
  private drawFrost(dt: number) {
    if ((this.motesT -= dt) > 0) return
    this.motesT = 0.5
    let n = 0
    for (const [e, st] of this.status.statuses()) {
      if (st.slowT <= 0 || e.dead || n >= MOTES_MAX) continue
      this.vfx.frost(new THREE.Vector3(e.pos.x, 1.0 * e.size, e.pos.z), 1, e.radius)
      n++
    }
  }

  /** Lay a unit strip from a to b at height y. */
  private pose(mesh: THREE.Mesh, a: THREE.Vector3, b: THREE.Vector3, width: number, y: number) {
    const len = Math.max(0.01, Math.hypot(b.x - a.x, b.z - a.z))
    mesh.position.set(a.x, y, a.z)
    mesh.rotation.y = Math.atan2(b.x - a.x, b.z - a.z)
    mesh.scale.set(width, 1, len)
  }
}
