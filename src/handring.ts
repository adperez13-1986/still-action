import * as THREE from 'three'
import { DECAL_Y } from './world'
import { COLD_DEEP } from './vfx'

/**
 * The hand's ring (design/variety/PITCHES.md 2): a faint cold ring on the floor round Still
 * at the hand's reach. Any body its edge touches, the hand reaches. A hulk's ember slam disc
 * stops 1.1 u short of him when he stands with the hulk on the ring: the gap is the safe band.
 * Frost-scratched, never a flat line: Still's cold, so it lies under every ember tell.
 */
const RING = {
  /** Band half-width, u. */
  band: 0.09,
  /** Opacity: nothing awake near, a body at the ring, and the lift a strike gives it. */
  far: 0.2, near: 0.7, pulse: 0.3,
  /** How far past the ring (body edge, u) it starts to wake up. */
  wakeFrom: 4,
  /** Pulse decay per second; the ring's slow turn, rad/s, so the scratches never sit still. */
  pulseDecay: 5, spin: 0.05,
}

const TEX = 512
let tex: THREE.CanvasTexture | null = null

/** The ring's texture for a ring of `r` in a square of half-size `half`: scratches across a thin soft core. Shared. */
function ringTexture(r: number, half: number): THREE.CanvasTexture {
  if (tex) return tex
  const c = document.createElement('canvas')
  c.width = c.height = TEX
  const g = c.getContext('2d')!
  const px = TEX / 2 / half
  const R = r * px
  const w = RING.band * px
  g.translate(TEX / 2, TEX / 2)
  // the core: a soft thin line, uneven in strength round the ring like breath on glass
  for (let i = 0; i < 180; i++) {
    const a0 = (i / 180) * Math.PI * 2
    const a1 = ((i + 1.2) / 180) * Math.PI * 2
    const k = 0.35 + 0.35 * Math.sin(i * 0.37) * Math.sin(i * 0.11 + 1) + Math.random() * 0.2
    g.strokeStyle = `rgba(255,255,255,${Math.max(0.12, k).toFixed(3)})`
    g.lineWidth = w * 0.7
    g.beginPath()
    g.arc(0, 0, R, a0, a1)
    g.stroke()
  }
  // frost scratches: short ticks leaning across the band, some long, most faint
  for (let i = 0; i < 520; i++) {
    const a = Math.random() * Math.PI * 2
    const len = w * (0.8 + Math.random() * 2.2)
    const lean = (Math.random() - 0.5) * 1.1
    const r0 = R + (Math.random() - 0.5) * w * 1.6
    const x = Math.cos(a) * r0
    const y = Math.sin(a) * r0
    const dx = Math.cos(a + lean) * len * 0.5
    const dy = Math.sin(a + lean) * len * 0.5
    g.strokeStyle = `rgba(255,255,255,${(0.15 + Math.random() * 0.6).toFixed(3)})`
    g.lineWidth = 0.8 + Math.random() * 1.4
    g.beginPath()
    g.moveTo(x - dx, y - dy)
    g.lineTo(x + dx, y + dy)
    g.stroke()
  }
  tex = new THREE.CanvasTexture(c)
  tex.anisotropy = 4
  return tex
}

export class HandRing {
  readonly mesh: THREE.Mesh
  private readonly mat: THREE.MeshBasicMaterial
  private shown = 0
  private pulse = 0

  constructor(readonly radius: number) {
    const half = radius + 0.4
    this.mat = new THREE.MeshBasicMaterial({
      // laid over the floor, not added to it: an added cold vanishes on the ruin's lit stone
      map: ringTexture(radius, half), color: COLD_DEEP.clone().lerp(new THREE.Color(0xcfe4ff), 0.55),
      transparent: true, opacity: 0, depthWrite: false, fog: false,
    })
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, half * 2), this.mat)
    this.mesh.rotation.x = -Math.PI / 2
    // under every tell: ember lies over cold
    this.mesh.position.y = DECAL_Y - 0.02
    this.mesh.renderOrder = -1
    this.mesh.visible = false
  }

  /** A strike: the ring lifts for a moment, so the hand's beat shows on the floor too. */
  strike() {
    this.pulse = 1
  }

  /** `gap`: how far the nearest awake body's edge is from his centre (Infinity: none). `on`: the switch, in a crawl. */
  update(dt: number, x: number, z: number, gap: number, on: boolean) {
    const near = gap <= this.radius ? 1 : Math.max(0, 1 - (gap - this.radius) / RING.wakeFrom)
    const want = on ? RING.far + (RING.near - RING.far) * near * near : 0
    this.shown += (want - this.shown) * Math.min(1, dt * 6)
    this.pulse = Math.max(0, this.pulse - dt * RING.pulseDecay)
    const opacity = this.shown + (on ? RING.pulse * this.pulse * near : 0)
    this.mat.opacity = opacity
    this.mesh.visible = opacity > 0.004
    this.mesh.position.x = x
    this.mesh.position.z = z
    this.mesh.rotation.z += dt * RING.spin
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
  }
}
