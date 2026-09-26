import * as THREE from 'three'
import { DECAL_Y } from './world'
import { COLD_DEEP } from './vfx'

/**
 * The eye's sightline (design/variety/PITCHES.md 3): planted, a thin dashed cold line on the
 * floor from Still to the body the eye has chosen. When the choice changes it snaps to the new
 * body and draws out again, brighter for a moment, so "it jumped to the sentinel" reads at a
 * glance. Dashes creep toward the target. Frosted like the hand's ring, laid under ember tells.
 */
const LINE = {
  /** Strip width, u; one dash and its gap, u. */
  width: 0.18, period: 0.6,
  /** Opacity held, and the lift a jump gives it. */
  held: 0.7, jump: 0.3,
  /** How far off Still's centre it starts, and short of the body's edge it stops, u. */
  from: 0.6, short: 0.1,
  /** Seconds to draw out after a jump; the dashes' creep, u/s. */
  drawS: 0.12, creep: 0.9,
  /** Fade rates per second: in when he plants, out (faster) when he steps. */
  fadeIn: 7, fadeOut: 14, jumpDecay: 4,
}

/** One dash period: a soft core, frost ticks across it, then the gap. */
function dashTexture(): THREE.CanvasTexture {
  const W = 128
  const H = 32
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const on = W * 0.56
  const grad = g.createLinearGradient(0, 0, 0, H)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(0.32, 'rgba(255,255,255,0.55)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(0.68, 'rgba(255,255,255,0.55)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(4, 0, on - 8, H)
  // frost: short leaning scratches over the dash, so it's never a flat printed line
  for (let i = 0; i < 26; i++) {
    const x = 6 + Math.random() * (on - 12)
    const y = H * (0.2 + Math.random() * 0.6)
    const len = 5 + Math.random() * 9
    const a = (Math.random() - 0.5) * 1.4
    g.strokeStyle = `rgba(255,255,255,${(0.2 + Math.random() * 0.5).toFixed(3)})`
    g.lineWidth = 1 + Math.random()
    g.beginPath()
    g.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5)
    g.lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5)
    g.stroke()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.anisotropy = 4
  return tex
}

/** A unit strip along +z from 0 to 1, x in ±0.5; u runs along it. */
function stripGeometry(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, -0.5, 0, 1, 0.5, 0, 1], 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0, 1, 1], 2))
  g.setIndex([0, 2, 1, 1, 2, 3])
  return g
}

export class Sightline {
  readonly mesh: THREE.Mesh
  private readonly mat: THREE.MeshBasicMaterial
  private readonly tex = dashTexture()
  private shown = 0
  private pulse = 0
  /** 0..1 how far out it's drawn since the last jump. */
  private drawn = 1
  private last: object | null = null

  constructor() {
    this.mat = new THREE.MeshBasicMaterial({
      // laid over the floor, not added to it, like the ring: an added cold vanishes on lit stone
      map: this.tex, color: COLD_DEEP.clone().lerp(new THREE.Color(0xcfe4ff), 0.5),
      transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide,
    })
    this.mesh = new THREE.Mesh(stripGeometry(), this.mat)
    this.mesh.position.y = DECAL_Y - 0.015
    this.mesh.renderOrder = -1
    this.mesh.visible = false
    this.mesh.scale.x = LINE.width
  }

  /** From Still at `x, z` to `target` (a body's drawn position and radius), or null: fade out. */
  update(dt: number, x: number, z: number, target: { key: object; x: number; z: number; r: number } | null) {
    if (target && target.key !== this.last) {
      // a jump: it snaps over and draws out again, a little brighter
      if (this.last !== null || this.shown > 0.05) this.pulse = 1
      this.drawn = 0
      this.last = target.key
    }
    if (!target) this.last = null
    this.shown += ((target ? 1 : 0) - this.shown) * Math.min(1, dt * (target ? LINE.fadeIn : LINE.fadeOut))
    this.pulse = Math.max(0, this.pulse - dt * LINE.jumpDecay)
    this.drawn = Math.min(1, this.drawn + dt / LINE.drawS)
    this.tex.offset.x -= dt * LINE.creep / LINE.period
    const opacity = this.shown * (LINE.held + LINE.jump * this.pulse)
    this.mat.opacity = opacity
    this.mesh.visible = opacity > 0.01 && !!target
    if (!target) return
    const dx = target.x - x
    const dz = target.z - z
    const d = Math.hypot(dx, dz)
    const len = Math.max(0, d - LINE.from - target.r - LINE.short) * (1 - (1 - this.drawn) ** 2)
    if (len < 0.05) {
      this.mesh.visible = false
      return
    }
    const ux = dx / d
    const uz = dz / d
    this.mesh.position.x = x + ux * LINE.from
    this.mesh.position.z = z + uz * LINE.from
    this.mesh.rotation.y = Math.atan2(dx, dz)
    this.mesh.scale.z = len
    this.tex.repeat.x = len / LINE.period
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.mat.dispose()
    this.tex.dispose()
  }
}
