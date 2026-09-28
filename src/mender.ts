import * as THREE from 'three'
import { DECAL_Y } from './world'
import { VFX_TIME } from './vfx'
import { HIDES, hideMaterials } from './hide'
import { rod } from './ranged'
import type { Terrain } from './terrain'
import {
  slide, statusTint, disposeBody, turn, distToSegment, PLAYER_RADIUS, CORE, CORE_ASLEEP,
  type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase,
} from './enemy'

/**
 * The mender (design/enemies/MENDER.md, design/variety/PITCHES.md 9): a small machine on
 * stilts that never attacks. It keeps behind its pack and mends one packmate through a cable
 * drawn on the floor. Walk through the cable to cut it, or kill the mender first: a stick
 * answer, so it has no windup and nothing to break.
 *
 *   linked    the cable runs out from its feet to the patient; once it arrives, the patient heals
 *   cut       Still's body crossed the cable: it snaps, the mender reels, and can't re-link for a while
 *   let go    the patient died (the next after a beat), a wall came between, or it ran out of cable
 *
 * Only his body cuts it: a part or an auto hitting the cable does nothing (nothing aims at it).
 */
export const MENDER = {
  /** A sentinel's; the depth curve applies through addPack as for any body. */
  hp: 20,
  speed: 3.2,
  bodyRadius: 0.4,
  height: 1.6, labelY: 2.0,
  /** Where it stands: this far from Still at least, behind a packmate by `behind` where it can. */
  holdMin: 7, holdMax: 9, behind: 1.5,
  /** HP a second into the patient, up to its full HP: about a third of the close strike's damage a second (a guess). */
  heal: 6,
  /** Cut: it reels this long, doing nothing; it can't link again until this long after the cut. */
  reelS: 1.5, blockS: 4,
  /** Its patient died: the next link after this. */
  relinkS: 1,
  /** The cable runs out from its feet this fast (u/s); the mending starts when it arrives. */
  drawSpeed: 24,
  /** The longest cable: past it, it lets go. */
  reach: 14,
  /** It won't lay a cable through him: his circle this much clear of the line to link. */
  layClear: 0.2,
  /** A link wants this much room from walls; a link lets go only when the bare line is blocked (no flicker on an edge). */
  linkPad: 0.15,
  /** The cable on the floor, and the snap's recoil. */
  width: 0.3, snapS: 0.3, fadeS: 0.2,
  /** Where it appears (dungeon.ts): per main pack of `minPack`+ bodies, by depth; never depth 1 or a boss depth. */
  chance: { 2: 0.3, 4: 0.35, 5: 0.4 } as Record<number, number>,
  perLevel: 2, minPack: 3,
}

/** What a mender knows of its pack. Combat's Pack is one. */
export interface MenderPack {
  readonly members: readonly Enemy[]
  readonly elite?: { readonly leader: Enemy }
}

/** Heat-tinted steel (hide.ts): plum-dark, straw where the torch passed. */
const BODY = HIDES.mender.body
const JOINT = HIDES.mender.joint
/** The cable: dark wire, and the faint ember running along it (not a threat's bright colour: it can't hurt him). */
const WIRE = new THREE.Color(0x15100d)
const PULSE = new THREE.Color(0xc4502c)

/** Distance between two floor segments: zero where they cross. */
function segSeg(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): number {
  const cr = (ux: number, uz: number, vx: number, vz: number) => ux * vz - uz * vx
  const d1 = cr(bx - ax, bz - az, cx - ax, cz - az)
  const d2 = cr(bx - ax, bz - az, dx - ax, dz - az)
  const d3 = cr(dx - cx, dz - cz, ax - cx, az - cz)
  const d4 = cr(dx - cx, dz - cz, bx - cx, bz - cz)
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0
  return Math.min(
    distToSegment(ax, az, cx, cz, dx, dz), distToSegment(bx, bz, cx, cz, dx, dz),
    distToSegment(cx, cz, ax, az, bx, bz), distToSegment(dx, dz, ax, az, bx, bz),
  )
}

const CABLE_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * The cable, flat on the floor: a braided dark wire, and ember pulses running along it toward
 * the patient. `uDrawn` is how far it has run out; `uSnap` (0..1, off below 0) pulls the two
 * halves back to their ends from `uCut`.
 */
const CABLE_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uLen;
  uniform float uDrawn;
  uniform float uCut;
  uniform float uSnap;
  uniform vec3 uWire;
  uniform vec3 uPulse;
  varying vec2 vUv;
  void main() {
    float t = vUv.y;
    if (t > uDrawn) discard;
    float ga = uCut * (1.0 - uSnap);
    float gb = uCut + (1.0 - uCut) * uSnap;
    if (uSnap >= 0.0 && t > ga && t < gb) discard;
    float along = t * uLen;
    // the torn ends glow as they whip back, hot at the tear and cooling along the wire
    float tear = uSnap >= 0.0 ? (1.0 - smoothstep(0.0, 0.9, min(abs(t - ga), abs(t - gb)) * uLen)) * (1.0 - uSnap * 0.6) : 0.0;
    float across = abs(vUv.x - 0.5) * 2.0;
    // the braid: a twist running along the wire, so it reads as a cable, not a painted line
    float braid = 0.5 + 0.5 * sin(along * 22.0 + across * 5.0);
    // one pulse every 1.6 u, travelling 3.2 u/s toward the patient; none while it snaps
    float ph = fract(along / 1.6 - uTime * 2.0);
    float pulse = smoothstep(0.0, 0.18, ph) * (1.0 - smoothstep(0.18, 0.5, ph)) * (uSnap >= 0.0 ? 0.0 : 1.0);
    float core = 1.0 - smoothstep(0.1, 0.7, across);
    vec3 col = uWire * (0.8 + 0.5 * braid) + uPulse * (pulse * core + tear * 1.4);
    float a = uOpacity * (1.0 - smoothstep(0.7, 1.0, across)) * (0.85 + 0.15 * braid);
    gl_FragColor = vec4(col, a);
  }
`

/** A strip along local +z, 0..1 long and 1 wide: scaled to the cable each frame. */
function cableGeometry() {
  const g = new THREE.PlaneGeometry(1, 1, 1, 1)
  g.translate(0, 0.5, 0)
  g.rotateX(Math.PI / 2)
  return g
}

/** Keeps behind its pack, mends one packmate down a cable on the floor. Never attacks. */
export class Mender implements Enemy {
  readonly kind = 'mender'
  readonly labelY = MENDER.labelY
  get radius() { return MENDER.bodyRadius * this.size }
  readonly windupMs = 0
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = MENDER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  readonly height = MENDER.height
  rime = 0
  air = 0
  walking = false
  get gait() { return this.bob * 2.4 }

  /** Its pack, and each body's full HP: Combat sets them in addPack. */
  pack: MenderPack | null = null
  full: (e: Enemy) => number = (e) => e.hp
  /** The packmate on the cable, or null. */
  patient: Enemy | null = null
  /** HP its cables restored and not yet logged (the run reads it with `flush`). */
  private healed = 0

  /** Seconds left: reeling from a cut, blocked from linking, waiting after a patient died. */
  private reelT = 0
  private blockT = 0
  private waitT = 0
  /** How much cable has run out, u. */
  private drawn = 0
  /** The cable as last drawn (its ends), kept while it snaps or fades. */
  private readonly a = new THREE.Vector3()
  private readonly b = new THREE.Vector3()
  /** A snap running (s in), or -1; a fade after a let-go (s left). */
  private snapT = -1
  private fadeT = 0

  private flash = 0
  private bob = Math.random() * 10
  private face = 0
  private asleep = false
  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly coreMat: THREE.MeshBasicMaterial
  private readonly core: THREE.Mesh
  /** Upper body over the stilts: it tilts and wobbles in a reel. */
  private readonly hull = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  /** The spool on its back pays the cable out, and spins loose when it's cut. */
  private readonly spool = new THREE.Group()
  private spin = 0
  /** The lead: the cable from the spool down to its feet, while one is out. */
  private readonly lead: THREE.Mesh
  private readonly cable: THREE.Mesh
  private readonly cableMat: THREE.ShaderMaterial

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A thin thing on two tall stilts, a small hull, a spool on its back. The ember core is small:
    // it's a threat only through what it keeps alive.
    const hide = hideMaterials('mender')
    this.mat = hide.mat
    this.jointMat = hide.jointMat

    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.13, 1.15, 0)
      // knees a little forward, so the stilts bend and the silhouette isn't a pair of poles
      const knee = new THREE.Vector3(side * 0.04, -0.55, 0.12)
      const foot = new THREE.Vector3(side * 0.07, -1.13, 0)
      const kneeBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), this.jointMat)
      kneeBall.position.copy(knee)
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 8), this.jointMat)
      pad.position.copy(foot)
      leg.add(rod(new THREE.Vector3(), knee, 0.035, this.mat), rod(knee, foot, 0.03, this.mat), kneeBall, pad)
    }

    this.hull.position.y = 1.2
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.34, 10), this.mat)
    can.position.y = 0.14
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.mat)
    cap.position.y = 0.31
    const hip = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.14), this.jointMat)
    // cores ignore the fog (the lights-out rule), and this one is small
    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE, fog: false })
    // a pilot light on its crown, so the camera above sees it whichever way it faces
    this.core = new THREE.Mesh(new THREE.OctahedronGeometry(0.085), this.coreMat)
    this.core.position.set(0, 0.4, 0.04)

    this.spool.position.set(0, 0.17, -0.19)
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 12), this.jointMat)
    drum.rotation.z = Math.PI / 2
    for (const s of [-1, 1]) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), this.mat)
      rim.rotation.z = Math.PI / 2
      rim.position.x = s * 0.06
      this.spool.add(rim)
    }
    // a spoke, so the spin reads
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.26, 0.03), this.mat)
    this.spool.add(drum, spoke)
    this.hull.add(can, cap, hip, this.core, this.spool)

    // the lead drops from the spool to the floor behind its feet; the floor cable starts there
    this.lead = rod(new THREE.Vector3(0, 1.3, -0.3), new THREE.Vector3(0, 0.02, -0.05), 0.018, new THREE.MeshBasicMaterial({ color: WIRE, fog: false }))
    this.lead.visible = false

    this.group.add(this.legL, this.legR, this.hull, this.lead)

    this.cableMat = new THREE.ShaderMaterial({
      vertexShader: CABLE_VERT,
      fragmentShader: CABLE_FRAG,
      uniforms: {
        uTime: VFX_TIME,
        uOpacity: { value: 0 },
        uLen: { value: 1 },
        uDrawn: { value: 0 },
        uCut: { value: 0.5 },
        uSnap: { value: -1 },
        uWire: { value: WIRE.clone() },
        uPulse: { value: PULSE.clone() },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // normal, not additive: dark wire on a floor lit warm
      blending: THREE.NormalBlending,
    })
    this.cable = new THREE.Mesh(cableGeometry(), this.cableMat)
    this.cable.visible = false
    // under the bodies' tells: it's information, not a threat
    this.cable.renderOrder = -1
    // the cable is laid in world space: the group only lifts it to the decals' height
    this.tellGroup.position.y = DECAL_Y
    this.tellGroup.add(this.cable)
  }

  hit(damage: number): boolean {
    this.hp -= damage * this.armor
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.dead = true
      return true
    }
    return false
  }

  /** Nothing to break: it never winds up. */
  interrupt() {
    return false
  }

  landsIn() {
    return null
  }

  /** HP its cables restored since the last call. */
  flush(): number {
    const h = this.healed
    this.healed = 0
    return h
  }

  /** Reeling from a cut. */
  get reeling() {
    return this.reelT > 0
  }

  /** The cable has arrived and is mending. */
  get mending() {
    const q = this.patient
    return !!q && this.drawn >= Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z) - 1e-3
  }

  /** The cable's ends as drawn now: the mender's feet and the patient (or where they were at a cut). */
  cableEnds(): [THREE.Vector3, THREE.Vector3] {
    return [this.a, this.b]
  }

  /** Who it may mend: the living, not another mender, and not a mite still under its slag heap (it would give the heap away). */
  private mates(): Enemy[] {
    return (this.pack?.members ?? []).filter((e) => e !== this && !e.dead && e.kind !== 'mender' && !(e as { buried?: boolean }).buried)
  }

  /** A cable to q: in reach, the line clear of walls (grown by `pad`). */
  private holds(q: Enemy, terrain: Terrain, pad: number) {
    return Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z) <= MENDER.reach
      && terrain.lineClear(this.pos.x, this.pos.z, q.pos.x, q.pos.z, pad)
  }

  /**
   * Who to mend: a heavy first if it's hurt, else the most hurt (HP missing), else whoever's
   * nearest. Only a packmate it can reach with the line clear, and never through him.
   */
  private choose(terrain: Terrain, player: THREE.Vector3): Enemy | null {
    let best: Enemy | null = null
    let bestKey = -Infinity
    const heavy = this.pack?.elite?.leader
    for (const q of this.mates()) {
      if (!this.holds(q, terrain, MENDER.linkPad)) continue
      if (distToSegment(player.x, player.z, this.pos.x, this.pos.z, q.pos.x, q.pos.z) <= PLAYER_RADIUS + MENDER.layClear) continue
      const missing = this.full(q) - q.hp
      const key = (q === heavy && missing > 0.5 ? 1e6 : 0) + (missing > 0.5 ? missing : -Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z) * 1e-3)
      if (key > bestKey) {
        bestKey = key
        best = q
      }
    }
    return best
  }

  private link(q: Enemy, ctx: EnemyCtx) {
    this.patient = q
    this.drawn = 0
    this.snapT = -1
    this.fadeT = 0
    ctx.emit({ kind: 'mend', e: this, what: 'link', at: q.pos.clone(), patient: q })
  }

  /** The cable ends without a cut: it fades where it lay. */
  private letGo(ctx: EnemyCtx) {
    const q = this.patient
    if (!q) return
    this.patient = null
    this.fadeT = MENDER.fadeS
    ctx.emit({ kind: 'mend', e: this, what: 'drop', at: q.pos.clone(), patient: q })
  }

  update(dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx): EnemyAction | null {
    this.bob += dt * 4
    this.flash = Math.max(0, this.flash - dt * 6)
    this.reelT = Math.max(0, this.reelT - dt)
    this.blockT = Math.max(0, this.blockT - dt)
    this.waitT = Math.max(0, this.waitT - dt)
    const staggered = slide(this.pos, this.knock, dt)
    const p = ctx.player

    // --- the cable ---
    const q0 = this.patient
    if (q0 && q0.dead) {
      this.letGo(ctx)
      this.waitT = MENDER.relinkS
    } else if (q0 && !this.holds(q0, terrain, 0)) this.letGo(ctx)
    const q = this.patient
    if (q) {
      const len = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z)
      this.drawn = Math.min(len, this.drawn + MENDER.drawSpeed * dt)
      const k = len > 1e-3 ? this.drawn / len : 1
      const ex = this.pos.x + (q.pos.x - this.pos.x) * k
      const ez = this.pos.z + (q.pos.z - this.pos.z) * k
      // his body crossing it this tick, swept from where he was, so a dash can't jump it
      const v = ctx.playerVel
      const cross = segSeg(p.x - v.x * dt, p.z - v.z * dt, p.x, p.z, this.pos.x, this.pos.z, ex, ez)
      if (cross <= PLAYER_RADIUS) this.cut(q, ctx)
      else if (this.drawn >= len - 1e-3) {
        const full = this.full(q)
        if (q.hp < full) {
          const before = q.hp
          q.hp = Math.min(full, q.hp + MENDER.heal * dt)
          this.healed += q.hp - before
        }
      }
    }
    if (!this.patient && this.reelT <= 0 && this.blockT <= 0 && this.waitT <= 0) {
      const next = this.choose(terrain, p)
      if (next) this.link(next, ctx)
    } else if (this.patient && this.mending) {
      // a hurt heavy comes first; a patient mended full hands over to whoever is hurt
      const heavy = this.pack?.elite?.leader
      const cur = this.patient
      const switchTo = heavy && heavy !== cur && !heavy.dead && heavy.hp < this.full(heavy) - 0.5
        ? heavy : cur.hp >= this.full(cur) ? this.choose(terrain, p) : null
      if (switchTo && switchTo !== cur && this.full(switchTo) - switchTo.hp > 0.5 && this.holds(switchTo, terrain, MENDER.linkPad)) {
        this.letGo(ctx)
        this.link(switchTo, ctx)
      }
    }

    // --- where it stands: behind a packmate, 7-9 u from him; backing off when he closes ---
    let mx = 0
    let mz = 0
    if (!staggered && this.reelT <= 0) {
      const dx = this.pos.x - target.x
      const dz = this.pos.z - target.z
      const d = Math.hypot(dx, dz) || 1
      const anchor = this.patient ?? this.nearestMate()
      let gx: number
      let gz: number
      if (anchor) {
        const ax = anchor.pos.x - target.x
        const az = anchor.pos.z - target.z
        const ad = Math.hypot(ax, az) || 1
        // never in front of it: a packmate far off keeps it further off still
        const r = Math.max(MENDER.holdMin, ad + MENDER.behind)
        gx = target.x + (ax / ad) * r
        gz = target.z + (az / ad) * r
      } else {
        gx = target.x + (dx / d) * MENDER.holdMax
        gz = target.z + (dz / d) * MENDER.holdMax
      }
      const tx = gx - this.pos.x
      const tz = gz - this.pos.z
      const td = Math.hypot(tx, tz)
      // the spot is past him (he got round it): straight away from him instead of walking by
      const pastHim = d < MENDER.holdMin && (tx * -dx + tz * -dz) / (td * d || 1) > 0.3
      if (pastHim || terrain.blocked(gx, gz, this.radius)) {
        if (d < MENDER.holdMin) {
          mx = dx / d
          mz = dz / d
        }
      } else if (td > 0.5) {
        const to = terrain.nextStep(this.pos.x, this.pos.z, gx, gz, this.radius)
        const sd = Math.hypot(to.x - this.pos.x, to.z - this.pos.z) || 1
        mx = (to.x - this.pos.x) / sd
        mz = (to.z - this.pos.z) / sd
      }
      this.pos.x += mx * MENDER.speed * this.speedMul * dt
      this.pos.z += mz * MENDER.speed * this.speedMul * dt
    }
    terrain.pushOut(this.pos, this.radius)
    this.walking = mx !== 0 || mz !== 0

    this.present(dt, target)
    return null
  }

  private nearestMate(): Enemy | null {
    let best: Enemy | null = null
    let bd = Infinity
    for (const e of this.mates()) {
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z)
      if (d < bd) {
        bd = d
        best = e
      }
    }
    return best
  }

  private cut(q: Enemy, ctx: EnemyCtx) {
    const p = ctx.player
    const len = Math.hypot(q.pos.x - this.pos.x, q.pos.z - this.pos.z) || 1
    // where on the cable he crossed it: the snap parts there
    const vx = (q.pos.x - this.pos.x) / len
    const vz = (q.pos.z - this.pos.z) / len
    const along = Math.max(0, Math.min(this.drawn, (p.x - this.pos.x) * vx + (p.z - this.pos.z) * vz))
    const at = new THREE.Vector3(this.pos.x + vx * along, 0, this.pos.z + vz * along)
    this.a.set(this.pos.x, 0, this.pos.z)
    this.b.set(this.pos.x + vx * this.drawn, 0, this.pos.z + vz * this.drawn)
    this.cableMat.uniforms.uCut!.value = this.drawn > 1e-3 ? along / this.drawn : 0.5
    this.cableMat.uniforms.uLen!.value = this.drawn
    this.cableMat.uniforms.uDrawn!.value = 1
    this.patient = null
    this.snapT = 0
    this.reelT = MENDER.reelS
    this.blockT = MENDER.blockS
    this.spin = 30
    ctx.emit({ kind: 'mend', e: this, what: 'cut', at, patient: q, from: this.a.clone(), to: this.b.clone() })
  }

  private present(dt: number, face: THREE.Vector3) {
    // the cable: live, snapping, or fading where it lay
    const q = this.patient
    const u = this.cableMat.uniforms
    if (q) {
      this.a.set(this.pos.x, 0, this.pos.z)
      this.b.set(q.pos.x, 0, q.pos.z)
      const len = this.a.distanceTo(this.b)
      u.uLen!.value = len
      u.uDrawn!.value = len > 1e-3 ? this.drawn / len : 1
      u.uSnap!.value = -1
      this.cableMat.opacity = 0.92
      this.spin += (this.mending ? 1.5 : 14) * dt
    } else if (this.snapT >= 0) {
      this.snapT += dt
      const s = this.snapT / MENDER.snapS
      // the halves whip back fast, then slow: out of the ease
      u.uSnap!.value = Math.min(1, 1 - (1 - s) * (1 - s))
      this.cableMat.opacity = 0.92 * (1 - Math.max(0, s - 0.5) * 2)
      if (s >= 1) this.snapT = -1
    } else if (this.fadeT > 0) {
      this.fadeT = Math.max(0, this.fadeT - dt)
      this.cableMat.opacity = 0.92 * (this.fadeT / MENDER.fadeS)
    } else this.cableMat.opacity = 0
    this.cableMat.uniforms.uOpacity!.value = this.cableMat.opacity
    this.cable.visible = this.cableMat.opacity > 0.01
    if (this.cable.visible) {
      this.cable.position.set(this.a.x, 0, this.a.z)
      this.cable.rotation.y = Math.atan2(this.b.x - this.a.x, this.b.z - this.a.z)
      this.cable.scale.set(MENDER.width, 1, Math.max(0.01, this.a.distanceTo(this.b)))
    }
    this.lead.visible = !!q

    // the body: watching him; a reel throws it back on its stilts, wobbling, the core flickering
    const reel = this.reelT > 0 ? this.reelT / MENDER.reelS : 0
    this.face = turn(this.face, Math.atan2(face.x - this.pos.x, face.z - this.pos.z), dt * 5)
    this.group.rotation.y = this.face
    this.hull.rotation.x = -0.35 * reel
    this.hull.rotation.z = Math.sin(this.bob * 7) * 0.22 * reel
    this.coreMat.color.setHex(reel > 0 && Math.sin(this.bob * 11) > 0.3 ? CORE_ASLEEP : CORE)
    this.spin *= Math.exp(-dt * (reel > 0 ? 1.2 : 6))
    this.spool.rotation.x += this.spin * dt
    const stride = this.walking ? Math.sin(this.bob * 2.4) * 0.3 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride
    this.group.position.set(this.pos.x, (this.walking ? Math.abs(Math.sin(this.bob * 2.4)) * 0.04 : 0) + Math.sin(this.bob) * 0.02, this.pos.z)
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
  }

  idle(dt: number, face: THREE.Vector3) {
    // held, asleep or walking home: no cable (nothing to log, it wasn't cut)
    if (this.patient) {
      this.patient = null
      this.fadeT = MENDER.fadeS
    }
    this.bob += dt * (this.asleep ? 1.2 : 4)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.walking = false
    this.present(dt, face)
    // asleep: folded down on its stilts, the hull low
    if (this.asleep) {
      this.hull.position.y = 0.95
      this.legL.scale.y = this.legR.scale.y = 0.8
    }
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? CORE_ASLEEP : CORE)
    if (!asleep) this.flash = 1
    this.hull.position.y = asleep ? 0.95 : 1.2
    this.legL.scale.y = this.legR.scale.y = asleep ? 0.8 : 1
    this.patient = null
    this.reelT = 0
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiplyScalar(0.4)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
    // asleep, the core is banked (setAsleep); present() would light it again
    if (this.asleep) this.coreMat.color.setHex(CORE_ASLEEP)
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    disposeBody(this.group, this.tellGroup)
    this.mat.dispose()
    this.jointMat.dispose()
    this.coreMat.dispose()
  }
}
