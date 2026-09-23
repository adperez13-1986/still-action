import * as THREE from 'three'
import { grade, type World } from './world'

/**
 * Dynamic zoom stands in for a live camera. The angle never moves; only how
 * much of the floor you see does.
 *
 * Three layers, multiplied: framing (keep every threat on screen), punch (short
 * kicks on impact), and hold (the slow close-in when Still stops).
 */
export const ZOOM = {
  /** Never pull back further than this, however spread out the fight is. */
  min: 0.7,
  /** Breather between fights: a little closer, a little quieter. */
  calm: 1.1,
  /** Fraction of the half-screen a threat may reach before the camera backs off. */
  marginX: 0.78,
  /** Tighter vertically: the HP meter and the thumbs live at the bottom. */
  marginY: 0.7,
  /** Pull back fast, settle in slow. You need to see a threat now; the return can wait. */
  outRate: 4,
  inRate: 0.9,
  punchDecay: 7,
}

export interface CameraRig {
  update: (elapsed: number, focus: THREE.Vector3, threats: readonly THREE.Vector3[], calm: boolean) => void
  /** Positive closes in, negative pulls back. Fractions of zoom, e.g. 0.05. */
  punch: (amount: number) => void
  /** 1 is normal. The strain ending drives it up to close in on Still. */
  hold: number
  reset: () => void
}

export function createCameraRig(world: World): CameraRig {
  const cam = world.camera
  // The yaw and pitch are locked, so the screen axes are fixed for the whole game.
  cam.updateMatrixWorld()
  const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
  const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
  const v = new THREE.Vector3()

  let framing = 1
  let kick = 0

  const rig: CameraRig = {
    hold: 1,

    update(elapsed, focus, threats, calm) {
      const halfH = grade.viewHeight / 2
      const halfW = halfH * (window.innerWidth / window.innerHeight)

      // the most zoom that still keeps every threat inside the margins
      let fit = calm ? ZOOM.calm : 1
      for (const t of threats) {
        v.set(t.x - focus.x, 0.9, t.z - focus.z)
        const sx = Math.abs(v.dot(right))
        const sy = Math.abs(v.dot(up))
        if (sx > 0.01) fit = Math.min(fit, (ZOOM.marginX * halfW) / sx)
        if (sy > 0.01) fit = Math.min(fit, (ZOOM.marginY * halfH) / sy)
      }
      fit = Math.max(ZOOM.min, fit)

      const rate = fit < framing ? ZOOM.outRate : ZOOM.inRate
      framing += (fit - framing) * Math.min(1, elapsed * rate)
      kick *= Math.exp(-ZOOM.punchDecay * elapsed)

      cam.zoom = framing * (1 + kick) * rig.hold
      cam.updateProjectionMatrix()
    },

    punch(amount) {
      // the strongest recent kick wins; stacking them turns into a wobble
      if (Math.abs(amount) > Math.abs(kick)) kick = amount
    },

    reset() {
      framing = 1
      kick = 0
      rig.hold = 1
      cam.zoom = 1
      cam.updateProjectionMatrix()
    },
  }
  return rig
}
