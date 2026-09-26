import * as THREE from 'three'
import { HIDES, hideMaterials } from './hide'
import { YAW as CAM_YAW } from './world'
import type { Terrain } from './terrain'
import type { AbilityDef } from './abilities'
import type { GroundPart } from './loot'
import { CELL, key, type Room } from './dungeon'
import { buildModel, centred, FLOOR_SCALE } from './partmodels'
import { rod } from './ranged'
import {
  slide, statusTint, disposeBody, turn,
  type Enemy, type EnemyAction, type EnemyCtx, type EnemyPhase,
} from './enemy'

/**
 * The thief (design/content/SPEC.md §6.1, design/variety/PITCHES.md 6): a small machine
 * that never attacks. It hides in a barrel in an elite's room; when the elite falls it
 * bursts out, runs for the drop the elite owed, and carries it off in the birdcage on
 * its back, lit cold: the only cold light on any enemy. Catch it (walk into it, or 12 HP
 * of anything) and the part drops again. It only wakes for what he hasn't looked at yet:
 * an elite's drop or a part never found. A part whose card has shown before it noticed
 * was turned down; one it's already after, it keeps after.
 *
 *   hidden    in the barrel, cage glinting through the gap; not an enemy yet (Combat holds it apart)
 *   burst     out of the barrel, a hop, before it runs
 *   dormant   at its nest, or walking back to it; not a target
 *   fetch     running its own BFS to the nearest unguarded part
 *   wait      the part is guarded: hovering 5-7 u off, watching it
 *   carry     running for the refuge, the allowed room farthest (BFS) from Still
 *   listen    every 2.5 s of running, 0.8 s stopped, head up: 4.55 u/s on average
 *   settled   at the refuge with the part; Still within 7 u sends it running again
 *   caught    dead: the part (if any) is Combat's event, and main drops it
 *
 * It has no pack: it's never in `combat.awake`, so it never counts for the quiet, the
 * music or the camera, and nothing it does wakes anything. Its BFS runs over the
 * level's floor minus the cells of rooms it may not enter (an asleep pack's, the exit).
 */
export const THIEF = {
  /** Area I and II's plain levels. Never a boss level, never the walk. Certain the first time from depth 2 (G8). */
  depths: [1, 2, 4, 5] as readonly number[],
  chance: 0.35,
  hp: 12, bodyRadius: 0.35, height: 1.1, labelY: 1.4,
  speed: 6.0,                                  // empty and carrying
  runMs: 2500, listenMs: 800,                  // carrying: a listen pause every 2.5 s of running → average 4.55 u/s
  catchR: 1.1,                                 // centre distance for a tackle while it carries
  guardR: 1.5,                                 // it can't take a part while Still's centre is this close to it
  fleeR: 7,                                    // settled with a part: Still this close makes it run again
  waitRing: [5, 7] as const,                   // where it hovers while a part is guarded
  cageScale: 0.35,
  /** Settled, spooked: the short listen before it runs again. */
  spookMs: 400,
  /** How close it gets: to a part it takes, to the refuge's centre, to its nest. */
  reachPart: 0.6, reachRefuge: 0.8, reachHome: 0.3,
  /** INV: never within EXIT_RADIUS + 1 of a beam. */
  beamClear: 2.4,
  /** The barrel: barrel_large at cover's own scale, so it's one of the room's barrels. Still can't walk through it. */
  barrelScale: 0.7, barrelR: 0.62,
  /** The barrel stands at least this far from any of its elite's pack as they sleep. */
  lairGap: 2.2,
  /** Out of the barrel: the hop before it runs. */
  burstMs: 380,
}

export type ThiefState = 'hidden' | 'burst' | 'dormant' | 'fetch' | 'wait' | 'carry' | 'listen' | 'settled' | 'caught'
export type ThiefEvent =
  | { kind: 'wake'; e: Thief } | { kind: 'burst'; e: Thief } | { kind: 'take'; e: Thief; def: AbilityDef } | { kind: 'listen'; e: Thief }
  | { kind: 'caught'; e: Thief; def: AbilityDef | null; at: THREE.Vector3; how: 'tackle' | 'hp' }

export interface ThiefWorld {
  ground: () => readonly GroundPart[]          // loot.ground
  lift: (g: GroundPart) => AbilityDef          // loot.lift
  still: THREE.Vector3
  /** Rooms it may flee to or through: no asleep pack in them, not the exit room. Asked every tick (it's cheap). */
  allowedRooms: () => readonly Room[]
  floor: ReadonlySet<string>
  /** Every room of the layout: the ones not allowed are walls to its BFS. */
  rooms: readonly Room[]
  /** The beams' centres (cold, and warm where there is one): it never stands within beamClear of one. */
  beams: readonly THREE.Vector3[]
  /** The barrel's look (the level's own barrel piece), or null for a thief without one (__spawn). */
  barrel?: { geometry: THREE.BufferGeometry; material: THREE.Material } | null
}

/** What it wants: not yet looked at, and either an elite's owed drop or a part never found. */
export const wanted = (g: GroundPart) => !g.seen && (!!g.owed || g.bare)

/** A rusted shell, the one small rusty thing among them: it lives in the corners. */
const BODY = HIDES.thief.body
const JOINT = HIDES.thief.joint
/** Its one dim ember eye. A touch brighter while it's up and about. */
const EYE_DIM = 0x6a2a1c
const EYE_UP = 0x8a3622
/** The found part in the cage: the only cold light on any enemy. */
const CAGED = new THREE.Color(0xcfe4ff).multiplyScalar(0.9)
const CAGE_Y = 0.6
const BARS_H = 0.5
const RING_R = 0.22

/** A soft white falloff for the cage's halo, tinted cold by the sprite. Shared, never disposed. */
let coldHalo: THREE.Texture | null = null
function coldHaloTexture(): THREE.Texture {
  if (coldHalo) return coldHalo
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,0.85)')
  grad.addColorStop(0.3, 'rgba(255,255,255,0.3)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  coldHalo = new THREE.CanvasTexture(c)
  return coldHalo
}

const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]
/** The 1 u grid's moves: straight first, so a straight run is preferred over a zigzag. */
const STEPS: [number, number][] = [...DIRS, [1, 1], [1, -1], [-1, 1], [-1, -1]]
const cellOf = (v: number) => Math.round(v / CELL)
const inRoom = (r: Room, i: number, j: number) => Math.abs(i - r.ci) <= r.rx && Math.abs(j - r.cj) <= r.rz
/** No room: a thief without one (spawned outside every room) has nowhere of its own. */
const NOWHERE: Room = { kind: 'side', ci: 1e6, cj: 1e6, rx: 0, rz: 0, center: new THREE.Vector3() }

export class Thief implements Enemy {
  readonly kind = 'thief'
  readonly labelY = THIEF.labelY
  get radius() { return THIEF.bodyRadius * this.size }
  /** It never winds up. */
  readonly windupMs = 0
  readonly knock = new THREE.Vector3()
  readonly group = new THREE.Group()
  readonly tellGroup = new THREE.Group()
  readonly pos = new THREE.Vector3()
  hp = THIEF.hp
  /** Always 'approach': nothing about it is a windup, so Parry and the tell crowd never see it. */
  phase: EnemyPhase = 'approach'
  dead = false
  armor = 1
  speedMul = 1
  /** The Hook yanks it like anything else. */
  knockMul = 1
  size = 1
  readonly height = THIEF.height
  rime = 0
  air = 0
  state: ThiefState
  /** INV: only ever a def that was on loot.ground this level. */
  carrying: AbilityDef | null = null
  get walking() { return this.stepping > 0.3 }
  get gait() { return this.bob * 2.6 }
  readonly nest: THREE.Vector3

  /** Its own room: always allowed, asleep pack or not (it nests beside one). */
  private readonly home: Room | null
  private timer = 0
  /** Carrying: ms run since the last listen. */
  private runT = 0
  /** Where it's running to while it carries, and where it hovers while it waits. */
  private refuge: THREE.Vector3 | null = null
  private hover: THREE.Vector3 | null = null
  private hoverT = 0
  /** The part it's after. */
  private goal: GroundPart | null = null
  /** The elite's pack it hides beside: that pack's owed drop brings it out. */
  private readonly lair: object | null
  private woke = false
  private readonly pending: ThiefEvent[] = []
  private facing = 0
  private bob = Math.random() * 10
  private stepping = 0
  private flash = 0
  /** 0..1: the listen pose, head up. */
  private ear = 0
  private lit = 0

  // its own BFS: the cells it may not enter, by which rooms are allowed, and a 1 u field per goal
  private sig = ''
  private readonly walls = new Set<string>()
  private readonly fields = new Map<string, Map<string, number>>()
  /** Which 1 u nodes it can stand on, as it has asked. */
  private readonly pass = new Map<string, boolean>()
  /** This tick's solids (the level's, or __arena's). */
  private terrain: Terrain | null = null

  private readonly mat: THREE.MeshStandardMaterial
  private readonly jointMat: THREE.MeshStandardMaterial
  private readonly eyeMat: THREE.MeshBasicMaterial
  private readonly body = new THREE.Group()
  private readonly legs: THREE.Group[] = []
  private readonly cage = new THREE.Group()
  /** What rides in the cage: the part's model (shared geometry) under the cold material, and the halo. */
  private readonly holder = new THREE.Group()
  private readonly coldMat = new THREE.MeshBasicMaterial({ color: CAGED, fog: false })
  private readonly halo: THREE.Sprite
  private caged: THREE.Object3D | null = null
  /** The barrel (in tellGroup: its geometry and material are the level's, never disposed) and the cold glint in its gap. */
  private readonly barrel = new THREE.Group()
  private readonly glint: THREE.Sprite | null = null
  /** The lid's own disc (its geometry is ours; the wood is the level's). */
  private readonly lid: THREE.Mesh | null = null
  /** Burst: 0..1 through the hop. */
  private hop = 0

  /** `lair`: the elite's pack it hides beside, in a barrel. Without one (or without a barrel look) it sits in the open. */
  constructor(x: number, z: number, nest: THREE.Vector3, private readonly world: ThiefWorld, lair: object | null = null) {
    this.pos.set(x, 0, z)
    this.nest = nest.clone()
    this.home = world.rooms.find((r) => inRoom(r, cellOf(nest.x), cellOf(nest.z))) ?? null
    this.lair = lair
    this.state = lair && world.barrel ? 'hidden' : 'dormant'
    const hide = hideMaterials('thief')
    this.mat = hide.mat
    this.jointMat = hide.jointMat

    // a low beetle: one flat box on four thin legs, knees out
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.8), this.mat)
    shell.position.y = 0.45
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.14), this.jointMat)
    brow.position.set(0, 0.58, 0.36)
    this.eyeMat = new THREE.MeshBasicMaterial({ color: EYE_DIM, fog: false })
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.eyeMat)
    eye.position.set(0, 0.48, 0.41)
    this.body.add(shell, brow, eye)
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const leg = new THREE.Group()
      leg.position.set(sx * 0.26, 0.4, sz * 0.28)
      const knee = new THREE.Vector3(sx * 0.22, 0.12, sz * 0.06)
      const foot = new THREE.Vector3(sx * 0.3, -0.4, sz * 0.1)
      leg.add(rod(new THREE.Vector3(), knee, 0.04, this.jointMat), rod(knee, foot, 0.04, this.jointMat))
      this.legs.push(leg)
      this.body.add(leg)
    }

    // the birdcage on its back: six bars on a ring, a cap ring and a hook
    this.cage.position.y = CAGE_Y
    const base = new THREE.Mesh(new THREE.TorusGeometry(RING_R, 0.02, 5, 18), this.jointMat)
    base.rotation.x = Math.PI / 2
    const cap = new THREE.Mesh(new THREE.TorusGeometry(RING_R * 0.7, 0.018, 5, 16), this.jointMat)
    cap.rotation.x = Math.PI / 2
    cap.position.y = BARS_H
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      const lo = new THREE.Vector3(Math.sin(a) * RING_R, 0, Math.cos(a) * RING_R)
      const hi = new THREE.Vector3(Math.sin(a) * RING_R * 0.7, BARS_H, Math.cos(a) * RING_R * 0.7)
      this.cage.add(rod(lo, hi, 0.02, this.jointMat))
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 5, 10, Math.PI * 1.4), this.jointMat)
    hook.position.y = BARS_H + 0.07
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coldHaloTexture(), color: CAGED, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
    }))
    this.halo.scale.setScalar(1.2)
    this.halo.position.y = BARS_H * 0.45
    this.halo.visible = false
    this.holder.position.y = BARS_H * 0.45
    this.cage.add(base, cap, hook, this.holder, this.halo)
    this.body.add(this.cage)
    this.group.add(this.body)

    // the barrel: one of the room's own, its lid pushed up off one side, and the empty cage glinting cold in the gap
    if (this.state === 'hidden' && world.barrel) {
      const g = world.barrel.geometry
      if (!g.boundingBox) g.computeBoundingBox()
      const bb = g.boundingBox!
      const k = THIEF.barrelScale
      const top = bb.max.y * k
      const rTop = Math.min(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 0.5 * k * 0.86
      const b = new THREE.Mesh(g, world.barrel.material)
      b.scale.setScalar(k)
      // the lid: a disc of the same wood, hinged on the far rim and lifted on the near one
      const hinge = new THREE.Group()
      hinge.position.set(0, top + 0.01, -rTop)
      hinge.rotation.x = 0.3
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, 0.07, 18), world.barrel.material)
      lid.position.set(0, 0.035, rTop)
      hinge.add(lid)
      this.lid = lid
      this.barrel.add(b, hinge)
      this.glint = new THREE.Sprite(new THREE.SpriteMaterial({
        map: coldHaloTexture(), color: CAGED, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }))
      // a sliver of cold light along the lifted edge, the width of the gap
      this.glint.scale.set(rTop * 1.9, 0.16, 1)
      this.glint.position.set(0, top + 0.06, rTop * 0.92)
      this.barrel.add(this.glint)
      this.barrel.position.set(x, 0, z)
      // the gap turns to the camera, so the glint is seen, never lidded
      this.barrel.rotation.y = CAM_YAW
      if (this.home) this.facing = Math.atan2(this.home.center.x - x, this.home.center.z - z)
      this.tellGroup.add(this.barrel)
    }
    this.present(0)
  }

  /** In its barrel: not an enemy yet. */
  get hidden() { return this.state === 'hidden' }

  /** Any damage counts. At 0 it's caught, and a carried part drops (Combat's event). */
  hit(damage: number): boolean {
    this.hp -= damage * this.armor
    this.flash = 1
    if (this.hp <= 0 && !this.dead) {
      this.caught('hp')
      return true
    }
    return false
  }

  /** It never winds up: there's nothing to break. */
  interrupt() {
    return false
  }

  landsIn() {
    return null
  }

  /** Its instants since the last call, for Combat's onThief. */
  drain(): ThiefEvent[] {
    return this.pending.splice(0)
  }

  /** INV: it never returns an action. `target` is ignored: it doesn't hunt anyone. */
  update(dt: number, _target: THREE.Vector3, terrain: Terrain, _ctx: EnemyCtx): EnemyAction | null {
    const ms = dt * 1000
    this.terrain = terrain
    this.timer -= ms
    this.bob += dt * 3
    this.flash = Math.max(0, this.flash - dt * 6)
    this.stepping *= 0.85
    this.rooms()
    const still = this.world.still
    const dStill = Math.hypot(still.x - this.pos.x, still.z - this.pos.z)
    const staggered = slide(this.pos, this.knock, dt)
    const ground = this.world.ground()

    // a tackle: while it carries, Still walking into it catches it
    if (this.carrying && dStill <= THIEF.catchR) {
      this.caught('tackle')
      return null
    }

    const speed = THIEF.speed * this.speedMul
    switch (this.state) {
      case 'hidden': {
        // only its own elite's drop (or a never-found part falling in its room) brings it out
        const g = this.notice((p) => p.owed === this.lair || (p.bare && inRoom(this.home ?? NOWHERE, cellOf(p.from.x), cellOf(p.from.z))))
        if (!g) break
        this.goal = g
        this.state = 'burst'
        this.timer = THIEF.burstMs
        this.hop = 0
        this.pending.push({ kind: 'burst', e: this })
        this.wake()
        break
      }
      case 'burst': {
        this.hop = Math.min(1, 1 - this.timer / THIEF.burstMs)
        const g = this.goal
        if (g) this.faceTo(g.pos.x, g.pos.z, dt * 2)
        if (this.timer > 0) break
        this.hop = 1
        if (!g || !ground.includes(g)) {
          this.goal = null
          this.state = 'dormant'
          break
        }
        this.state = this.guarded(g) ? 'wait' : 'fetch'
        this.hover = null
        break
      }
      case 'dormant': {
        const g = this.notice()
        if (g) {
          this.wake()
          this.goal = g
          this.state = this.guarded(g) ? 'wait' : 'fetch'
          this.hover = null
          break
        }
        // home to its nest, then sit looking at the room's middle
        if (!staggered && Math.hypot(this.nest.x - this.pos.x, this.nest.z - this.pos.z) > THIEF.reachHome) this.go(this.nest.x, this.nest.z, speed, dt, terrain)
        else if (this.home) this.faceTo(this.home.center.x, this.home.center.z, dt)
        break
      }
      case 'fetch': {
        const g = this.goal
        // once it's after a part it keeps after it, looked at or not: he takes it or loses it
        if (!g || !ground.includes(g)) {
          this.goal = null
          this.state = 'dormant'
          break
        }
        if (this.guarded(g)) {
          this.state = 'wait'
          this.hover = null
          break
        }
        // it runs for where the part will land, and takes it once it's down
        if (g.fly <= 0 && Math.hypot(g.pos.x - this.pos.x, g.pos.z - this.pos.z) <= THIEF.reachPart) {
          this.take(g)
          this.startCarry(terrain)
          break
        }
        if (!staggered && !this.go(g.pos.x, g.pos.z, speed, dt, terrain)) {
          // it can't get there any more (a pack went back to sleep across the way)
          this.goal = null
          this.state = 'dormant'
        }
        break
      }
      case 'wait': {
        const g = this.goal
        if (!g || !ground.includes(g)) {
          this.goal = null
          this.state = 'dormant'
          break
        }
        if (!this.guarded(g)) {
          this.state = 'fetch'
          break
        }
        this.hoverT -= dt
        if (!this.hover || this.hoverT <= 0) {
          this.hover = this.hoverPoint(g, terrain)
          this.hoverT = 0.5
        }
        const h = this.hover
        if (!staggered && h && Math.hypot(h.x - this.pos.x, h.z - this.pos.z) > THIEF.reachHome) this.go(h.x, h.z, speed, dt, terrain)
        else this.faceTo(g.pos.x, g.pos.z, dt)
        break
      }
      case 'carry': {
        const r = this.refuge
        if (!r || Math.hypot(r.x - this.pos.x, r.z - this.pos.z) <= THIEF.reachRefuge) {
          this.state = 'settled'
          break
        }
        if (staggered) break
        this.runT += ms
        if (!this.go(r.x, r.z, speed, dt, terrain)) {
          // the only way is shut: it settles where it is
          this.state = 'settled'
          break
        }
        if (this.runT >= THIEF.runMs) this.listen(THIEF.listenMs)
        break
      }
      case 'listen':
        if (this.timer <= 0) this.startCarry(terrain)
        break
      case 'settled':
        this.faceTo(still.x, still.z, dt)
        if (dStill <= THIEF.fleeR) this.listen(THIEF.spookMs)
        break
      case 'caught':
        break
    }
    terrain.pushOut(this.pos, this.radius)
    this.present(dt)
    return null
  }

  /** First out: its notebook meet. */
  private wake() {
    if (this.woke) return
    this.woke = true
    this.pending.push({ kind: 'wake', e: this })
  }

  /** Presentation only, no thinking (in the clamp's throw). */
  idle(dt: number, face: THREE.Vector3) {
    this.bob += dt * 3
    this.flash = Math.max(0, this.flash - dt * 6)
    this.facing = Math.atan2(face.x - this.pos.x, face.z - this.pos.z)
    this.present(dt)
  }

  /** It has no pack: nothing puts it to sleep. */
  setAsleep() {}

  dispose(scene: THREE.Scene) {
    scene.remove(this.group, this.tellGroup)
    // the barrel's mesh is the level's piece: only the glint and the lid's disc are ours
    this.glint?.material.dispose()
    this.lid?.geometry.dispose()
    // the caged model's geometry is shared with every other copy of the part: only ours goes
    this.uncage()
    this.cage.remove(this.halo)
    this.halo.material.dispose()
    this.coldMat.dispose()
    disposeBody(this.group)
  }

  // --- what it does ---

  /**
   * The nearest part it wants (the moment it falls: an owed drop is the one thing worth
   * running for mid-fight) that its BFS reaches, by where it lands. Unguarded ones first.
   */
  private notice(only?: (g: GroundPart) => boolean): GroundPart | null {
    let best: GroundPart | null = null
    let bestD = Infinity
    let bestFree = false
    for (const g of this.world.ground()) {
      if (!wanted(g) || (only && !only(g))) continue
      const d = this.pathLength(g.pos.x, g.pos.z)
      if (d === null) continue
      const free = !this.guarded(g)
      if ((free && !bestFree) || (free === bestFree && d < bestD)) {
        best = g
        bestD = d
        bestFree = free
      }
    }
    return best
  }

  private guarded(g: GroundPart) {
    return Math.hypot(g.pos.x - this.world.still.x, g.pos.z - this.world.still.z) < THIEF.guardR
  }

  private take(g: GroundPart) {
    const def = this.world.lift(g)
    this.goal = null
    this.carrying = def
    this.cagePart(def)
    this.pending.push({ kind: 'take', e: this, def })
  }

  private listen(ms: number) {
    this.state = 'listen'
    this.timer = ms
    this.runT = 0
    this.pending.push({ kind: 'listen', e: this })
  }

  /** Into carry: the refuge is recomputed each time, from where Still is now. */
  private startCarry(terrain: Terrain) {
    this.state = 'carry'
    this.runT = 0
    this.refuge = this.pickRefuge(terrain)
  }

  private caught(how: 'tackle' | 'hp') {
    const def = this.carrying
    this.dead = true
    this.state = 'caught'
    this.carrying = null
    this.pending.push({ kind: 'caught', e: this, def, at: this.pos.clone(), how })
  }

  /**
   * The refuge: of the allowed rooms it can reach, the one whose centre is farthest from
   * Still by his own walk (BFS over the whole floor). Aimed at the clear point nearest
   * the centre, so a prop standing there can't hold it off forever.
   */
  private pickRefuge(terrain: Terrain): THREE.Vector3 | null {
    const s = this.world.still
    const still = this.cells(cellOf(s.x), cellOf(s.z), (k) => this.world.floor.has(k))
    const far = this.allowed().map((r) => ({ r, d: still.get(key(r.ci, r.cj)) ?? 0 })).sort((a, b) => b.d - a.d)
    for (const { r } of far) {
      const p = this.clearNear(r.center.x, r.center.z, terrain)
      if (this.pathLength(p.x, p.z) !== null) return p
    }
    return null
  }

  /** Where it hovers while a part is guarded: 5-7 u beyond the part from Still, clear, and somewhere it can go. */
  private hoverPoint(g: GroundPart, terrain: Terrain): THREE.Vector3 | null {
    const s = this.world.still
    const base = Math.atan2(g.pos.x - s.x, g.pos.z - s.z)
    const r = (THIEF.waitRing[0] + THIEF.waitRing[1]) / 2
    for (const off of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 2.6, -2.6]) {
      for (const rr of [r, THIEF.waitRing[0], THIEF.waitRing[1]]) {
        const x = g.pos.x + Math.sin(base + off) * rr
        const z = g.pos.z + Math.cos(base + off) * rr
        if (!this.standable(x, z, terrain) || this.pathLength(x, z) === null) continue
        return new THREE.Vector3(x, 0, z)
      }
    }
    return null
  }

  /** The clear standable point nearest (x, z), searched outward in rings. */
  private clearNear(x: number, z: number, terrain: Terrain): THREE.Vector3 {
    for (let rr = 0; rr <= 3; rr += 0.5) {
      const n = rr === 0 ? 1 : Math.round(rr * 8)
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2
        const px = x + Math.sin(a) * rr
        const pz = z + Math.cos(a) * rr
        if (this.standable(px, pz, terrain)) return new THREE.Vector3(px, 0, pz)
      }
    }
    return new THREE.Vector3(x, 0, z)
  }

  private standable(x: number, z: number, terrain: Terrain) {
    return this.open(key(cellOf(x), cellOf(z))) && !terrain.blocked(x, z, this.radius + 0.05) && !this.nearBeam(x, z)
  }

  private nearBeam(x: number, z: number) {
    return this.world.beams.some((b) => Math.hypot(b.x - x, b.z - z) < THIEF.beamClear)
  }

  // --- its own pathing: the level's cells for the route, a 1 u grid inside them for the props ---

  private allowed(): readonly Room[] {
    const a = this.world.allowedRooms()
    return this.home && !a.includes(this.home) ? [...a, this.home] : a
  }

  /** The cells of rooms it may not enter are walls to it. Rebuilt only when the allowed set changes. */
  private rooms() {
    const a = this.allowed()
    const sig = this.world.rooms.map((r) => (a.includes(r) ? 1 : 0)).join('')
    if (sig === this.sig) return
    this.sig = sig
    this.walls.clear()
    this.fields.clear()
    this.pass.clear()
    for (const r of this.world.rooms) {
      if (a.includes(r)) continue
      for (let i = r.ci - r.rx; i <= r.ci + r.rx; i++) for (let j = r.cj - r.rz; j <= r.cj + r.rz; j++) this.walls.add(key(i, j))
    }
  }

  private open(k: string) {
    return this.world.floor.has(k) && !this.walls.has(k)
  }

  /** Breadth-first distances over the level's cells from (i, j), through `ok` cells: Still's walk, for the refuge. */
  private cells(i: number, j: number, ok: (k: string) => boolean) {
    const f = new Map<string, number>()
    if (!ok(key(i, j))) return f
    f.set(key(i, j), 0)
    const q: [number, number][] = [[i, j]]
    for (let h = 0; h < q.length; h++) {
      const [ci, cj] = q[h]!
      const d = f.get(key(ci, cj))!
      for (const [dx, dz] of DIRS) {
        const nk = key(ci + dx, cj + dz)
        if (ok(nk) && !f.has(nk)) {
          f.set(nk, d + 1)
          q.push([ci + dx, cj + dz])
        }
      }
    }
    return f
  }

  /** A 1 u node it can stand on: in an open cell, clear of every solid by its radius, away from the beams. */
  private passable(gx: number, gz: number) {
    const k = key(gx, gz)
    let p = this.pass.get(k)
    if (p === undefined) {
      const x = gx + 0.5
      const z = gz + 0.5
      p = this.open(key(cellOf(x), cellOf(z))) && !this.terrain!.blocked(x, z, this.radius) && !this.nearBeam(x, z)
      this.pass.set(k, p)
    }
    return p
  }

  /** The 1 u field toward (x, z): 8-way, never cutting a corner. Cached until the allowed rooms change. */
  private field(x: number, z: number) {
    const tx = Math.floor(x)
    const tz = Math.floor(z)
    const k0 = key(tx, tz)
    let f = this.fields.get(k0)
    if (f) return f
    f = new Map<string, number>()
    // the goal's own node is always in: a part may lie closer to a prop than a node's centre
    f.set(k0, 0)
    const q: [number, number][] = [[tx, tz]]
    for (let h = 0; h < q.length; h++) {
      const [gx, gz] = q[h]!
      const d = f.get(key(gx, gz))!
      for (const [dx, dz] of STEPS) {
        const nx = gx + dx
        const nz = gz + dz
        const nk = key(nx, nz)
        if (f.has(nk) || !this.passable(nx, nz)) continue
        if (dx && dz && (!this.passable(gx + dx, gz) || !this.passable(gx, gz + dz))) continue
        f.set(nk, d + 1)
        q.push([nx, nz])
      }
    }
    if (this.fields.size > 16) this.fields.delete(this.fields.keys().next().value!)
    this.fields.set(k0, f)
    return f
  }

  /** Nodes from here to (x, z), or null when it can't get there. Standing on a shut node, one step out of it counts. */
  private pathLength(x: number, z: number): number | null {
    const f = this.field(x, z)
    const gx = Math.floor(this.pos.x)
    const gz = Math.floor(this.pos.z)
    const d = f.get(key(gx, gz))
    if (d !== undefined) return d
    let best: number | null = null
    for (const [dx, dz] of STEPS) {
      const n = f.get(key(gx + dx, gz + dz))
      if (n !== undefined && (best === null || n + 1 < best)) best = n + 1
    }
    return best
  }

  /**
   * One tick toward (x, z) down its field: the farthest of the next few nodes (or the
   * goal itself) that a straight line reaches clear, through open cells only. False when
   * there's no way there.
   */
  private go(x: number, z: number, speed: number, dt: number, terrain: Terrain): boolean {
    const f = this.field(x, z)
    let gx = Math.floor(this.pos.x)
    let gz = Math.floor(this.pos.z)
    let d = f.get(key(gx, gz))
    const pts: { x: number; z: number }[] = []
    if (d === undefined) {
      // off the field (pushed against something, or in a cell that just shut): out by the best neighbour
      let best: [number, number] | null = null
      for (const [dx, dz] of STEPS) {
        const n = f.get(key(gx + dx, gz + dz))
        if (n !== undefined && (d === undefined || n < d)) {
          d = n
          best = [gx + dx, gz + dz]
        }
      }
      if (!best || d === undefined) return false
      ;[gx, gz] = best
      pts.push({ x: gx + 0.5, z: gz + 0.5 })
    }
    for (let n = 0; n < 16 && d! > 0; n++) {
      let next: [number, number] | null = null
      for (const [dx, dz] of STEPS) {
        if (f.get(key(gx + dx, gz + dz)) === d! - 1) {
          next = [gx + dx, gz + dz]
          break
        }
      }
      if (!next) break
      ;[gx, gz] = next
      d = d! - 1
      pts.push({ x: gx + 0.5, z: gz + 0.5 })
    }
    if (d === 0) pts.push({ x, z })
    let to = pts[0] ?? { x, z }
    for (let k = pts.length - 1; k > 0; k--) {
      if (this.clearTo(pts[k]!.x, pts[k]!.z, terrain)) {
        to = pts[k]!
        break
      }
    }
    this.walk(to.x, to.z, speed * dt, dt, terrain)
    return true
  }

  /** A straight run it can take: nothing solid, and every point on it in an open cell, clear of the beams. */
  private clearTo(x: number, z: number, terrain: Terrain) {
    if (!terrain.lineClear(this.pos.x, this.pos.z, x, z, this.radius)) return false
    const len = Math.hypot(x - this.pos.x, z - this.pos.z)
    const n = Math.max(1, Math.ceil(len / 0.5))
    for (let s = 1; s <= n; s++) {
      const px = this.pos.x + ((x - this.pos.x) * s) / n
      const pz = this.pos.z + ((z - this.pos.z) * s) / n
      if (!this.open(key(cellOf(px), cellOf(pz))) || this.nearBeam(px, pz)) return false
    }
    return true
  }

  /** Step toward a point by at most `step`, sliding along whatever it meets; never into a shut cell or a beam. */
  private walk(x: number, z: number, step: number, dt: number, terrain: Terrain) {
    const dx = x - this.pos.x
    const dz = z - this.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist < 1e-4) return
    const s = Math.min(dist, step)
    const ux = dx / dist
    const uz = dz / dist
    const tries = [[ux, uz], [Math.sign(ux), 0], [0, Math.sign(uz)]] as const
    let best = { x: this.pos.x, z: this.pos.z }
    let bestD = 0
    for (const [tx, tz] of tries) {
      if (tx === 0 && tz === 0) continue
      const r = terrain.clampMove(this.pos.x, this.pos.z, this.pos.x + tx * s, this.pos.z + tz * s, this.radius)
      const moved = Math.hypot(r.x - this.pos.x, r.z - this.pos.z)
      // toward the goal: the full move, or the axis that gains most on it
      const gain = (r.x - this.pos.x) * ux + (r.z - this.pos.z) * uz
      if (gain <= bestD + 1e-5 || moved < 1e-5) continue
      if (!this.open(key(cellOf(r.x), cellOf(r.z))) && this.open(key(cellOf(this.pos.x), cellOf(this.pos.z)))) continue
      if (this.nearBeam(r.x, r.z)) continue
      best = r
      bestD = gain
      if (moved >= s * 0.95) break
    }
    const mx = best.x - this.pos.x
    const mz = best.z - this.pos.z
    this.pos.x = best.x
    this.pos.z = best.z
    const m = Math.hypot(mx, mz)
    if (m > 1e-4) {
      this.facing = turn(this.facing, Math.atan2(mx, mz), dt * 14)
      this.stepping = 1
    }
  }

  private faceTo(x: number, z: number, dt: number) {
    if (Math.hypot(x - this.pos.x, z - this.pos.z) < 0.05) return
    this.facing = turn(this.facing, Math.atan2(x - this.pos.x, z - this.pos.z), dt * 6)
  }

  // --- how it looks ---

  /** The part rides in the cage at a third of its floor size, every material one cold white. */
  private cagePart(def: AbilityDef) {
    this.uncage()
    const model = buildModel(def.slot, def.id, 'display')
    model.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.material = this.coldMat
    })
    const { group } = centred(model.root, FLOOR_SCALE[def.slot] * THIEF.cageScale)
    this.caged = group
    this.holder.add(group)
    this.halo.visible = true
  }

  /** Out of the cage: its geometry is shared, so it's only unhooked, never disposed. */
  private uncage() {
    if (this.caged) this.holder.remove(this.caged)
    this.caged = null
    this.halo.visible = false
  }

  private present(dt: number) {
    const listening = this.state === 'listen'
    this.ear += ((listening ? 1 : 0) - this.ear) * Math.min(1, dt * 12)
    const lit = this.carrying ? 1 : 0
    this.lit += (lit - this.lit) * Math.min(1, dt * 8)
    const hid = this.state === 'hidden'
    const bursting = this.state === 'burst'
    this.barrel.visible = hid
    this.body.visible = !hid
    if (this.glint) {
      // the empty cage catches the light in the gap: a low breath, and now and then a brighter glint
      const catchLight = Math.pow(Math.max(0, Math.sin(this.bob * 0.7)), 12)
      this.glint.material.opacity = 0.7 + 0.1 * Math.sin(this.bob * 2.1) + 0.2 * catchLight
    }
    // out of the barrel: legs going, one hop up and over the staves
    const run = bursting ? 1 : this.stepping
    this.legs.forEach((l, i) => {
      l.rotation.x = Math.sin(this.bob * (bursting ? 9 : 5.2) + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 * run
    })
    this.body.position.y = Math.abs(Math.sin(this.bob * 5.2)) * 0.03 * run + (bursting ? Math.sin(this.hop * Math.PI) * 0.8 : 0)
    this.body.rotation.x = -0.3 * this.ear
    this.cage.rotation.x = 0.15 * this.ear
    // the cage's light breathes a little, like a held lamp
    const breathe = 0.9 + 0.1 * Math.sin(this.bob * 2.1)
    this.halo.material.opacity = 0.75 * this.lit * breathe
    if (this.caged) this.caged.rotation.y += dt * 1.2
    this.group.position.set(this.pos.x, this.air > 0 ? this.group.position.y : 0, this.pos.z)
    this.group.rotation.y = this.facing
    this.group.scale.setScalar(this.size * (1 + this.flash * 0.1))
    this.eyeMat.color.setHex(this.state === 'dormant' ? EYE_DIM : EYE_UP)
    for (const [m, base] of [[this.mat, BODY], [this.jointMat, JOINT]] as const) m.color.setHex(base)
    statusTint(this.jointMat, this.mat, this.rime, this.air)
    for (const m of [this.mat, this.jointMat]) {
      m.color.lerp(new THREE.Color(0xffffff), this.flash * 0.85)
      m.emissive.setRGB(this.flash * 0.6, this.flash * 0.25, this.flash * 0.2)
    }
  }
}
