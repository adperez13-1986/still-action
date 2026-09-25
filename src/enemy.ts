import * as THREE from 'three'
import { DECAL_Y } from './world'
import { tellMaterial, releaseTell } from './vfx'
import type { Terrain } from './terrain'
import type { EliteMod } from './combat'

/**
 * Every archetype is the same machine: approach, windup, strike, recover.
 * The windup is the game — everything else is scaffolding around it.
 */
export type EnemyPhase = 'approach' | 'windup' | 'strike' | 'recover'

/** What an enemy does to the world on the tick it strikes. Combat resolves it. */
export type EnemyAction =
  /**
   * `reach`: the strike's own radius around the striker. A strike aimed at something
   * else (the decoy) still lands on Still if he's inside it. Without it, only the
   * target is hit.
   */
  | {
      kind: 'melee'
      damage: number
      reach?: number
      /** Who swung. The Anvil needs it to stop a rush; the top-up and Brace ignore it. */
      source?: Enemy
      /**
       * The enemy already tested the real Still (ctx.player) and hit, so Combat skips
       * its own test. A lane aimed at the decoy still hits him if his feet are in it.
       */
      tested?: boolean
    }
  /** `bounces`: an answer shot reflects off walls this many times, retracing a banked bolt. */
  | { kind: 'shot'; dir: THREE.Vector3; damage: number; bounces?: number }
  /** A fan of shots from one point (the boss's cannon). */
  | { kind: 'shots'; from: THREE.Vector3; dirs: THREE.Vector3[]; damage: number }
  /** A ring rolling outward with gaps to stand in. Angles in radians, world space. */
  | { kind: 'wave'; center: THREE.Vector3; gaps: number[]; damage: number }
  /** Scrap piles that become small hulks. */
  | { kind: 'summon'; points: THREE.Vector3[] }
  /** Drag Still toward a point for a while. */
  | { kind: 'pull'; center: THREE.Vector3; strength: number; seconds: number }

/** A shove is a velocity that bleeds off, not a teleport: slide distance = speed / decay. */
export const KNOCK_DECAY = 9
/** Above this speed an enemy is sliding and can't advance or start a windup. */
const STAGGER_SPEED = 1.5

/** Integrates knockback. Returns true while the enemy is still sliding. */
export function slide(pos: THREE.Vector3, knock: THREE.Vector3, dt: number): boolean {
  pos.addScaledVector(knock, dt)
  knock.multiplyScalar(Math.exp(-KNOCK_DECAY * dt))
  return knock.lengthSq() > STAGGER_SPEED * STAGGER_SPEED
}

/** The velocity that slides something `distance` units along (dx, dz). */
export function shoveVelocity(dx: number, dz: number, distance: number): THREE.Vector3 {
  const len = Math.hypot(dx, dz) || 1
  return new THREE.Vector3((dx / len) * distance * KNOCK_DECAY, 0, (dz / len) * distance * KNOCK_DECAY)
}

/**
 * What every enemy's update can see beyond its target. One object, owned by
 * Combat and reused every call, so nothing here may be kept past the tick.
 */
export interface EnemyCtx {
  /** Still's centre. Never the decoy: every hit test an enemy does itself uses this. */
  readonly player: THREE.Vector3
  /** Still's velocity this tick, u/s, from the position delta. Zero on the first tick and after a jump. */
  readonly playerVel: THREE.Vector3
  /** Combat's game clock, seconds. */
  readonly now: number
  /** No booked lock within BOOK_GAP of now + offsetMs: two locks never land on top of each other. */
  canLock(offsetMs: number): boolean
  book(owner: object, offsetMs: number): void
  /** Rams: the pack's windup/rush token is free for e (nobody, e itself, or its holder is past its rush). */
  tokenFree(e: Enemy): boolean
  takeToken(e: Enemy): void
  /** In the clamp's throw. */
  held(e: Enemy): boolean
  emit(ev: EnemyEvent): void
}

/** Instants the run dresses (sound, sparks, the log). Lasting state is polled instead. */
export type EnemyEvent =
  /** A committed aim: the ram 495 ms in (`end` = where its lane ends), the sentinel's line freezing (`end` null). */
  | { kind: 'lock'; e: Enemy; end: THREE.Vector3 | null }
  /** The ram scraping a hoof while it tracks, at 80 and 300 ms. */
  | { kind: 'paw'; e: Enemy; at: THREE.Vector3 }
  | { kind: 'rushEnd'; e: Enemy; how: 'open' | 'wall' | 'caught' | 'trip'; at: THREE.Vector3 }
  /** A rush shouldering another enemy aside. */
  | { kind: 'trample'; e: Enemy; victim: Enemy; at: THREE.Vector3; dir: THREE.Vector3 }
  /** The hatch slams: the stun window is over. */
  | { kind: 'stunEnd'; e: Enemy }

export interface Enemy {
  readonly kind: 'chaser' | 'ranged' | 'charger' | 'boss'
  /**
   * Body radius for every hit check: base × size, so an elite is a bigger target
   * and a split half a smaller one. The boss is far bigger than a hulk.
   */
  readonly radius: number
  readonly group: THREE.Group
  /** Telegraphs live in world space, not under the body, so a lunge can't scale them. */
  readonly tellGroup: THREE.Group
  readonly pos: THREE.Vector3
  readonly windupMs: number
  /** Knockback velocity. Combat adds to it; the enemy slides it off. */
  readonly knock: THREE.Vector3
  hp: number
  phase: EnemyPhase
  dead: boolean
  /** Damage taken is multiplied by this. Elites and their wards change it. */
  armor: number
  speedMul: number
  /** Knockback taken is multiplied by this. */
  knockMul: number
  /** Overall scale; an elite leader stands bigger than its pack. */
  size: number
  /** Where a status badge sits: the top of the body, unscaled (Combat multiplies by size). */
  readonly height: number
  /**
   * Frost on the body, 0..1, set by Combat while it's slowed. Presentation only:
   * each class's tint lerps toward RIME with it, joints first (legs first).
   */
  rime: number
  /**
   * 0..1: how high it's been thrown, set by Combat while it's in the air. Tint
   * shades the body by it, so a hulk lifted toward Grace's light stays rusted
   * metal instead of blowing out white.
   */
  air: number
  /** For footsteps: whether it's walking, and a phase that advances one PI per step. */
  readonly walking: boolean
  readonly gait: number
  hit: (damage: number) => boolean
  /**
   * Break a windup (Parry Clamp, a grab). True if one was broken: the tell goes,
   * the strike never comes, and it goes back to closing in. Something that can't
   * be interrupted (the Assembler) returns false and just takes the hit.
   */
  interrupt: () => boolean
  update: (dt: number, target: THREE.Vector3, terrain: Terrain, ctx: EnemyCtx) => EnemyAction | null
  /** Presentation only, no thinking: while asleep, or walking home. `face` is where to look. */
  idle: (dt: number, face: THREE.Vector3) => void
  /** Dim and dark-cored while asleep; a flash on waking. */
  setAsleep: (asleep: boolean) => void
  /** Crowning calls it after size, hp and armor are set, for a mod the body itself has to know about. */
  setElite?: (mod: EliteMod) => void
  dispose: (scene: THREE.Scene) => void
}

/** Still's body radius. Lives here so an enemy that tests him itself can import it without a cycle. */
export const PLAYER_RADIUS = 0.42

/** Distance from a point to a segment, on the floor. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax
  const vz = bz - az
  const len = vx * vx + vz * vz
  const t = len > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / len)) : 0
  return Math.hypot(px - (ax + vx * t), pz - (az + vz * t))
}

/** Turn `from` toward `to` by at most `maxStep` radians, the short way round. */
export function turn(from: number, to: number, maxStep: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return from + Math.max(-maxStep, Math.min(maxStep, d))
}

export const SLEEP_BODY = new THREE.Color(0.35, 0.35, 0.38)

/**
 * Free everything an enemy built for itself: every mesh's geometry and material
 * under these objects. Each enemy makes its own, none are shared, so this is safe;
 * without it, every level left its enemies' geometry on the GPU.
 */
export function disposeBody(...roots: THREE.Object3D[]) {
  for (const r of roots) {
    r.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return
      o.geometry.dispose()
      const m = o.material as THREE.Material | THREE.Material[]
      for (const x of Array.isArray(m) ? m : [m]) x.dispose()
    })
  }
}

/** What frost does to iron: pale and cold. Still's colour, on their bodies (G5: statuses live on the body). */
export const RIME = new THREE.Color(0x9fb4c8)
/**
 * How far full frost takes the colour. A status stays quiet (T §3: rime climbs to
 * about a third), so the hit flash keeps its meaning.
 */
const RIME_DEPTH = 0.4

/** At the top of a throw the body is this much closer to the light: shade it back by about as much. */
const AIR_SHADE = 0.5

/**
 * What statuses and flight do to a body's colour. Frost climbs the joints first,
 * the shell half as much; a thrown body is shaded against the light it rises into.
 * Call after the base colour, before the hit flash.
 */
export function statusTint(joint: THREE.MeshStandardMaterial, shell: THREE.MeshStandardMaterial, rime: number, air: number) {
  if (rime > 0) {
    joint.color.lerp(RIME, rime * RIME_DEPTH)
    shell.color.lerp(RIME, rime * RIME_DEPTH * 0.5)
  }
  if (air > 0) {
    joint.color.multiplyScalar(1 - AIR_SHADE * air)
    shell.color.multiplyScalar(1 - AIR_SHADE * air)
  }
}
export const CORE_ASLEEP = 0x2a1512

/** Dark rusted iron. Red belongs to the enemies: their cores and their tells. */
export const BODY = 0x5b3b35
export const JOINT = 0x2b2426
export const CORE = 0xff5a3c

function cyl(r0: number, r1: number, len: number, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, len, 10), mat)
  m.position.y = y
  return m
}

export const CHASER = {
  hp: 30,
  speed: 4.3,
  bodyRadius: 0.55,
  strikeRange: 2.0,
  strikeRadius: 2.4,
  damage: 9,
  windupMs: 520,
  recoverMs: 760,
}

/** Closes, telegraphs a ring, strikes where the ring is. */
export class Chaser implements Enemy {
  readonly kind = 'chaser'
  get radius() { return CHASER.bodyRadius * this.size }
  readonly windupMs = CHASER.windupMs
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = CHASER.hp
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  knockMul = 1
  size = 1
  readonly height = 1.7
  rime = 0
  air = 0
  walking = false
  get gait() { return this.bob * 1.6 }

  private timer = 0
  /** A broken windup: the core blinks dark for a moment. */
  private blink = 0
  private flash = 0
  private bob = Math.random() * 10
  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly core: THREE.Mesh
  private readonly coreMat: THREE.MeshBasicMaterial
  /** The hulk's rig: hinged at the hips, shoulders and legs so it can rear and slam. */
  private readonly torso = new THREE.Group()
  private readonly armL = new THREE.Group()
  private readonly armR = new THREE.Group()
  private readonly legL = new THREE.Group()
  private readonly legR = new THREE.Group()
  private pose = { lean: 0, arms: 0, squash: 1 }
  private asleep = false
  /** Lives in world space, NOT under the body — the lunge must not scale the tell. */
  readonly tellGroup = new THREE.Group()
  private readonly disc: THREE.Mesh
  private readonly ringMat: THREE.ShaderMaterial
  private readonly discMat: THREE.ShaderMaterial

  constructor(x: number, z: number) {
    this.pos.set(x, 0, z)

    // A headless hulk: broad, low, heavy fists. The core in its chest is its face.
    this.mat = new THREE.MeshStandardMaterial({ color: BODY, roughness: 0.7, metalness: 0.45 })
    this.jointMat = new THREE.MeshStandardMaterial({ color: JOINT, roughness: 0.6, metalness: 0.5 })

    for (const [leg, side] of [[this.legL, -1], [this.legR, 1]] as const) {
      leg.position.set(side * 0.26, 0.5, 0)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.38), this.jointMat)
      foot.position.set(0, -0.44, 0.05)
      leg.add(cyl(0.13, 0.15, 0.42, this.jointMat, -0.2), foot)
    }

    this.torso.position.y = 0.5
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), this.mat)
    chest.scale.set(1.05, 0.8, 0.85)
    chest.position.y = 0.48
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.055, 6, 18), this.jointMat)
    band.rotation.x = Math.PI / 2
    band.position.y = 0.3
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.14, 0.5), this.mat)
    yoke.position.y = 0.84

    this.coreMat = new THREE.MeshBasicMaterial({ color: CORE })
    this.core = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.12), this.coreMat)
    this.core.position.set(0, 0.5, 0.4)
    this.torso.add(chest, band, yoke, this.core)

    for (const [arm, side] of [[this.armL, -1], [this.armR, 1]] as const) {
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), this.mat)
      shoulder.position.set(side * 0.56, 0.78, 0)
      arm.position.set(side * 0.62, 0.74, 0)
      const fist = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.3), this.mat)
      fist.position.y = -0.82
      arm.add(cyl(0.1, 0.11, 0.36, this.jointMat, -0.18), cyl(0.18, 0.13, 0.4, this.mat, -0.52), fist)
      this.torso.add(shoulder, arm)
    }

    // Outer ring is fixed at the real strike radius so the danger zone never moves.
    // The inner disc fills it over the windup, so growth reads as a clock.
    this.ringMat = tellMaterial('radial', CHASER.strikeRadius)
    const ring = new THREE.Mesh(new THREE.RingGeometry(CHASER.strikeRadius - 0.1, CHASER.strikeRadius, 48), this.ringMat)
    ring.rotation.x = -Math.PI / 2

    this.discMat = tellMaterial('radial', CHASER.strikeRadius)
    this.disc = new THREE.Mesh(new THREE.CircleGeometry(CHASER.strikeRadius, 48), this.discMat)
    this.disc.rotation.x = -Math.PI / 2
    this.disc.scale.setScalar(0.001)

    this.tellGroup.position.y = DECAL_Y
    this.tellGroup.add(ring, this.disc)

    this.group.add(this.legL, this.legR, this.torso)
  }

  /** Lean, raised fists and squash, eased toward a target so the slam has weight. */
  private strikePose(dt: number, target: { lean: number; arms: number; squash: number }, snap = false) {
    const k = snap ? 1 : Math.min(1, dt * 14)
    this.pose.lean += (target.lean - this.pose.lean) * k
    this.pose.arms += (target.arms - this.pose.arms) * k
    this.pose.squash += (target.squash - this.pose.squash) * k
    this.torso.rotation.x = this.pose.lean
    this.armL.rotation.x = this.pose.arms
    this.armR.rotation.x = this.pose.arms
    this.torso.scale.set(1 / Math.sqrt(this.pose.squash), this.pose.squash, 1 / Math.sqrt(this.pose.squash))
  }

  private tint() {
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) {
      m.color.setHex(base)
      if (this.asleep) m.color.multiply(SLEEP_BODY)
    }
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }

  interrupt() {
    if (this.phase !== 'windup') return false
    this.phase = 'approach'
    this.timer = 0
    // the ring goes at once: no fade, its heat broken
    this.ringMat.opacity = 0
    this.discMat.opacity = 0
    this.disc.scale.setScalar(0.001)
    this.core.scale.setScalar(1)
    this.blink = 0.2
    this.coreMat.color.setHex(CORE_ASLEEP)
    return true
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

  update(dt: number, target: THREE.Vector3, terrain: Terrain): EnemyAction | null {
    this.timer -= dt * 1000
    this.bob += dt * 5
    if (this.blink > 0 && (this.blink -= dt) <= 0) this.coreMat.color.setHex(CORE)
    this.flash = Math.max(0, this.flash - dt * 6)

    const dx = target.x - this.pos.x
    const dz = target.z - this.pos.z
    const dist = Math.hypot(dx, dz)
    let action: EnemyAction | null = null
    const staggered = slide(this.pos, this.knock, dt)

    switch (this.phase) {
      case 'approach': {
        if (staggered) break
        // no striking through a wall, even a low one: close in until the way is clear
        if (dist > CHASER.strikeRange || !terrain.lineClear(this.pos.x, this.pos.z, target.x, target.z, 0.2)) {
          const to = terrain.nextStep(this.pos.x, this.pos.z, target.x, target.z, this.radius)
          const sx = to.x - this.pos.x
          const sz = to.z - this.pos.z
          const sd = Math.hypot(sx, sz) || 1
          this.pos.x += (sx / sd) * CHASER.speed * this.speedMul * dt
          this.pos.z += (sz / sd) * CHASER.speed * this.speedMul * dt
        } else {
          this.phase = 'windup'
          this.timer = CHASER.windupMs
        }
        break
      }
      case 'windup': {
        if (this.timer <= 0) {
          this.phase = 'strike'
          // committed: the strike lands where the ring is, whether you left or not
          if (dist <= CHASER.strikeRadius) action = { kind: 'melee', damage: CHASER.damage, reach: CHASER.strikeRadius }
          this.timer = 90
        }
        break
      }
      case 'strike': {
        if (this.timer <= 0) {
          this.phase = 'recover'
          this.timer = CHASER.recoverMs
        }
        break
      }
      case 'recover': {
        if (this.timer <= 0) this.phase = 'approach'
        break
      }
    }

    terrain.pushOut(this.pos, this.radius)

    // --- presentation ---
    const winding = this.phase === 'windup'
    const t = winding ? Math.min(1, Math.max(0, 1 - this.timer / CHASER.windupMs)) : 0

    if (winding) {
      this.ringMat.opacity = 0.42
      this.discMat.opacity = 0.3
      this.disc.scale.setScalar(Math.max(0.001, t))
    } else if (this.phase === 'strike') {
      this.ringMat.opacity = 0.95
      this.discMat.opacity = 0.8
      this.disc.scale.setScalar(1)
    } else {
      // fade out rather than snapping off
      this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
      this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    }
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)

    // winding: rear back and raise both fists. strike: slam them into the floor.
    if (winding) this.strikePose(dt, { lean: -0.32 * t, arms: -2.5 * t, squash: 1 + 0.06 * t })
    else if (this.phase === 'strike') this.strikePose(dt, { lean: 0.42, arms: -0.55, squash: 0.86 }, true)
    else this.strikePose(dt * 0.5, { lean: 0.08, arms: 0, squash: 1 })
    this.core.scale.setScalar(1 + (winding ? t * 0.7 : 0))

    const walking = this.phase === 'approach' && !staggered
    this.walking = walking
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.4 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride

    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.tint()
    this.group.position.set(this.pos.x, walking ? Math.abs(Math.sin(this.bob * 1.6)) * 0.05 : 0, this.pos.z)
    this.group.rotation.y = Math.atan2(dx, dz)

    return action
  }

  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt * (this.asleep ? 1.5 : 5)
    this.flash = Math.max(0, this.flash - dt * 6)
    this.ringMat.opacity = Math.max(0, this.ringMat.opacity - dt * 4)
    this.discMat.opacity = Math.max(0, this.discMat.opacity - dt * 4)
    this.tellGroup.position.set(this.pos.x, DECAL_Y, this.pos.z)
    this.group.position.set(this.pos.x, Math.sin(this.bob) * (this.asleep ? 0.02 : 0.06), this.pos.z)
    this.group.rotation.y = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    // asleep: slumped forward, fists on the floor
    this.strikePose(dt, this.asleep ? { lean: 0.38, arms: -0.2, squash: 0.95 } : { lean: 0.08, arms: 0, squash: 1 })
    const walking = !this.asleep
    const stride = walking ? Math.sin(this.bob * 1.6) * 0.3 : 0
    this.legL.rotation.x = stride
    this.legR.rotation.x = -stride
    this.tint()
  }

  setAsleep(asleep: boolean) {
    this.asleep = asleep
    this.coreMat.color.setHex(asleep ? CORE_ASLEEP : CORE)
    if (!asleep) this.flash = 1
    this.phase = 'approach'
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group)
    scene.remove(this.tellGroup)
    disposeBody(this.group, this.tellGroup)
    this.mat.dispose()
    this.jointMat.dispose()
    this.coreMat.dispose()
    releaseTell(this.ringMat)
    releaseTell(this.discMat)
  }
}
