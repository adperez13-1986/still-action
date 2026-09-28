import type * as THREE from 'three'
import { CELL, key, type Level } from './dungeon'

/**
 * The open field's map: the pause screen draws what he has seen, the way
 * D2's automap fills in. Floor within REVEAL cells of Still (about what the screen shows) is seen; the exit, the entrance and
 * shrines show once their cell is. Drawn turned to match the camera, which looks from +x,+z, so
 * "up" on the map is "up" on the screen.
 */
const REVEAL = 6
const INK = {
  floor: '#1b2531', path: '#33465c', edge: '#6f8196', still: '#bcd6ff', exit: '#cfe0ff', entrance: '#6f8196',
  rest: '#8fd0ff', plenty: '#c7b8ff',
}

export function createFieldMap() {
  const seenOf = new WeakMap<Level, Set<string>>()
  const seen = (l: Level) => {
    let s = seenOf.get(l)
    if (!s) seenOf.set(l, (s = new Set()))
    return s
  }

  return {
    /** Marks the floor round (x, z) as seen. Cheap enough for every tick. */
    reveal(l: Level, at: THREE.Vector3) {
      const s = seen(l)
      const ci = Math.round(at.x / CELL)
      const cj = Math.round(at.z / CELL)
      for (let i = ci - REVEAL; i <= ci + REVEAL; i++) {
        for (let j = cj - REVEAL; j <= cj + REVEAL; j++) {
          if ((i - ci) ** 2 + (j - cj) ** 2 > REVEAL * REVEAL + 1) continue
          const k = key(i, j)
          if (l.floor.has(k)) s.add(k)
        }
      }
    },

    /** The map as a canvas `w` x `h` CSS px, Still at `at`. */
    draw(l: Level, at: THREE.Vector3, w: number, h: number): HTMLCanvasElement {
      const s = seen(l)
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      const g = canvas.getContext('2d')!
      // the whole level's floor sets the frame, seen or not, so the map never jumps as it fills
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity
      for (const k of l.floor) {
        const [i, j] = k.split(',').map(Number) as [number, number]
        const x = i * CELL, z = j * CELL
        // screen right is world (1, -1), screen down is world (1, 1)
        const u = (x - z) / Math.SQRT2, v = (x + z) / Math.SQRT2
        minU = Math.min(minU, u); maxU = Math.max(maxU, u); minV = Math.min(minV, v); maxV = Math.max(maxV, v)
      }
      const m = CELL * 1.5
      const scale = Math.min(canvas.width / (maxU - minU + 2 * m), canvas.height / (maxV - minV + 2 * m))
      const k = scale / Math.SQRT2
      const ox = (canvas.width - (maxU - minU) * scale) / 2 - minU * scale
      const oy = (canvas.height - (maxV - minV) * scale) / 2 - minV * scale
      // world (x, z) to canvas: u = (x - z)/√2, v = (x + z)/√2, then scaled and centred
      g.setTransform(k, k, -k, k, ox, oy)
      const hc = CELL / 2
      for (const c of s) {
        const [i, j] = c.split(',').map(Number) as [number, number]
        g.fillStyle = l.path?.has(c) ? INK.path : INK.floor
        // a hair over the cell, so neighbours meet without seams
        g.fillRect(i * CELL - hc - 0.1, j * CELL - hc - 0.1, CELL + 0.2, CELL + 0.2)
      }
      g.strokeStyle = INK.edge
      g.lineWidth = 0.5
      g.beginPath()
      for (const c of s) {
        const [i, j] = c.split(',').map(Number) as [number, number]
        const x = i * CELL, z = j * CELL
        if (!l.floor.has(key(i + 1, j))) { g.moveTo(x + hc, z - hc); g.lineTo(x + hc, z + hc) }
        if (!l.floor.has(key(i - 1, j))) { g.moveTo(x - hc, z - hc); g.lineTo(x - hc, z + hc) }
        if (!l.floor.has(key(i, j + 1))) { g.moveTo(x - hc, z + hc); g.lineTo(x + hc, z + hc) }
        if (!l.floor.has(key(i, j - 1))) { g.moveTo(x - hc, z - hc); g.lineTo(x + hc, z - hc) }
      }
      g.stroke()
      const known = (p: { x: number; z: number }) => s.has(key(Math.round(p.x / CELL), Math.round(p.z / CELL)))
      const dot = (p: { x: number; z: number }, r: number, fill: string, ring = false) => {
        g.beginPath()
        g.arc(p.x, p.z, r, 0, Math.PI * 2)
        if (ring) {
          g.strokeStyle = fill
          g.lineWidth = 0.9
          g.stroke()
        } else {
          g.fillStyle = fill
          g.fill()
        }
      }
      dot(l.entrance, 1.4, INK.entrance, true)
      for (const sh of l.shrines) if (known(sh)) dot(sh, 1.1, sh.kind === 'rest' ? INK.rest : INK.plenty)
      if (known(l.exit)) {
        dot(l.exit, 2.6, INK.exit, true)
        dot(l.exit, 1, INK.exit)
      }
      // Still last, with a soft halo so he's found at a glance
      g.globalAlpha = 0.25
      dot(at, 3.2, INK.still)
      g.globalAlpha = 1
      dot(at, 1.5, INK.still)
      return canvas
    },
  }
}
