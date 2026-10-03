import * as THREE from 'three'

/**
 * What the core gave you, said in the world (design/buildlayer/SHOW.md items 1 and 6): a cold number over a body when marks are spent, and the first fight's one-line hint.
 *
 * It is the only damage number in the game, kept for the core's bonus, so it means "this is what the core gave you". DOM, not sprites: no draw call, at most `MAX` elements made once,
 * each moved by a transform (no layout) from its world point, projected each frame. The oldest is recycled when more than `MAX` are up. No Math.random.
 */
const NUM = {
  max: 8,
  /** How long a number lives, s; how far it rises, world u; the share of its life it is fully opaque. */
  lifeS: 0.7, rise: 0.6, holdAt: 0.45,
}
/** The hint is gone after this long even if nothing was spent, s. */
const HINT_S = 8

export class CoreShow {
  private readonly box = document.createElement('div')
  private readonly els: HTMLElement[] = []
  private readonly wx = new Float32Array(NUM.max)
  private readonly wy = new Float32Array(NUM.max)
  private readonly wz = new Float32Array(NUM.max)
  /** Seconds lived; a negative age is a free slot. */
  private readonly age = new Float32Array(NUM.max).fill(-1)
  private next = 0
  private readonly tmp = new THREE.Vector3()
  private readonly hintEl = document.createElement('div')
  private hintLeft = 0
  /** Numbers up now (for checks). */
  live = 0

  constructor(root: HTMLElement, private readonly camera: THREE.Camera) {
    this.box.className = 'coreshow'
    for (let i = 0; i < NUM.max; i++) {
      const el = document.createElement('div')
      el.className = 'spendnum'
      el.style.display = 'none'
      this.box.appendChild(el)
      this.els.push(el)
    }
    this.hintEl.className = 'corehint'
    this.box.appendChild(this.hintEl)
    root.appendChild(this.box)
  }

  /** A spend of `n` marks that added `bonus`: `+bonus`, small at 1 mark, medium at 2, large at 3 or more, from (x, y, z) in the world. */
  spend(x: number, y: number, z: number, n: number, bonus: number) {
    const i = this.next
    this.next = (this.next + 1) % NUM.max
    const el = this.els[i]!
    el.textContent = `+${bonus}`
    el.className = `spendnum n${Math.min(3, Math.max(1, n))}`
    el.style.display = ''
    this.wx[i] = x
    this.wy[i] = y
    this.wz[i] = z
    this.age[i] = 0
    // the pop restarts: the class is the same, so the animation is retriggered by a reflow
    el.style.animation = 'none'
    void el.offsetWidth
    el.style.animation = ''
  }

  /** The hint line, or null to take it away. It also goes by itself after `HINT_S` of game time. */
  hint(text: string | null) {
    this.hintLeft = text ? HINT_S : 0
    this.hintEl.textContent = text ?? ''
    this.hintEl.classList.toggle('show', !!text)
  }

  get hinting(): boolean { return this.hintLeft > 0 }

  /** One rendered frame (`dt` real seconds, 0 while paused). */
  update(dt: number) {
    if (this.hintLeft > 0 && dt > 0) {
      this.hintLeft -= dt
      if (this.hintLeft <= 0) this.hint(null)
    }
    let live = 0
    const w = window.innerWidth
    const h = window.innerHeight
    for (let i = 0; i < NUM.max; i++) {
      if (this.age[i]! < 0) continue
      const a = this.age[i]! + dt
      this.age[i] = a
      const f = a / NUM.lifeS
      const el = this.els[i]!
      if (f >= 1) {
        this.age[i] = -1
        el.style.display = 'none'
        continue
      }
      live++
      // eased out: most of the rise is early
      const rise = NUM.rise * (1 - (1 - f) * (1 - f))
      this.tmp.set(this.wx[i]!, this.wy[i]! + rise, this.wz[i]!).project(this.camera)
      const x = (this.tmp.x * 0.5 + 0.5) * w
      const y = (-this.tmp.y * 0.5 + 0.5) * h
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`
      el.style.opacity = f < NUM.holdAt ? '1' : String(1 - (f - NUM.holdAt) / (1 - NUM.holdAt))
    }
    this.live = live
  }

  /** A new level or a run's end: nothing up. */
  clear() {
    this.age.fill(-1)
    for (const el of this.els) el.style.display = 'none'
    this.live = 0
    this.hint(null)
  }
}
