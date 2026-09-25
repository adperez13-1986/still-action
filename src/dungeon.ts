import * as THREE from 'three'
import { DECAL_Y } from './world'
import { buildInstanced, pieceData, skin, type Piece, type Placement } from './kit'
import type { Terrain, WallFace } from './terrain'
import type { BreachHole } from './parts'
import { ELITE_MODS, type Archetype, type EliteMod } from './combat'
import { BROOD, HEAP } from './swarm'
import { exitsAfterBoss, lookAt, type BossDef, type ExitKind, type KitPreset, type MachineKind, type PlaceDef, type PlaceId } from './areas'
import { buildMachines, machineTop, CHIMNEY_H, type MachinePlacement } from './machines'
import { THIEF } from './thief'

/**
 * A D2-style crawl level on a 4-unit grid (KayKit's floor tile). A main path of
 * rooms from entrance to exit, 2–3 dead-end side rooms, corridors one cell wide,
 * no doors. Walls are waist-high barriers on every floor edge that faces nothing.
 * Outside the walls: ruins fading into the fog — never tall on the camera side.
 */
export const CELL = 4
/**
 * Room sizes, as half-extents in cells from the centre cell. Main-path rooms are
 * 5x5 (20 units, close to the old arena's fighting space: the ranged band, the
 * dash and the vent all need room). Side rooms stay 3x3 — a dead end you chose
 * should feel tight. Now and then a 5x3 hall, laid along the direction of travel.
 */
const SIZE = { big: [2, 2], small: [1, 1], hall: [2, 1], arena: [3, 3] } as const
const MAIN_ROOMS = 6
const WALL_HALF = 0.3
const COLUMN_R = 0.45

export type RoomKind = 'entrance' | 'main' | 'side' | 'exit'
export interface Room {
  kind: RoomKind
  /** Centre cell. */
  ci: number
  cj: number
  /** Half-extents in cells: the room spans ci-rx..ci+rx, cj-rz..cj+rz. */
  rx: number
  rz: number
  center: THREE.Vector3
}

export interface Box { minX: number; maxX: number; minZ: number; maxZ: number }
export interface Circle { x: number; z: number; r: number; /** Smashed: no longer solid. */ dead?: boolean }

/** A crate or barrel that breaks when hit. Sometimes there's something inside. */
export interface Breakable { mesh: THREE.Mesh; x: number; z: number; r: number; circle: Circle; broken: boolean }

/**
 * A shrine: one use, one bargain.
 *   rest   — strain eases, but the nearest sleeping pack hears it
 *   plenty — a good part, for a price in strain
 */
export type ShrineKind = 'rest' | 'plenty'
export interface Shrine { kind: ShrineKind; x: number; z: number; used: boolean; rune: THREE.MeshBasicMaterial }

/**
 * One of the square's eight brick posts (G9): two solid circles side by side, and its own
 * mesh, not instanced, so the Arbiter's lances can crack it for good in its second phase.
 */
export interface Post {
  circles: [Circle, Circle]
  mesh: THREE.Mesh
  /** Lances that ended on it in the Arbiter's second phase; at 3 it cracks. */
  lances: number
  cracked: boolean
  x: number
  z: number
}

/** The square (§4.4 G9): posts on a ring round the tower, the tower's footprint, and furniture in its corners. */
export const SQUARE = {
  posts: 8, ring: 7.5, offsetDeg: 22.5, circleR: 0.75, spread: 0.8, crackedR: 0.45,
  footprint: 1.2, furniture: 11,
  floor: [['floor_tile_large', 0.8], ['floor_tile_large_rocks', 1]] as [Piece, number][],
}

/**
 * The square's eight posts round (cx, cz): at k × 45° + 22.5° on a 7.5 ring, each two solid
 * circles along the ring's tangent and a brick barrier drawn to match them.
 */
export function squarePosts(cx: number, cz: number): Post[] {
  const { geometry, material, box } = pieceData('barrier')
  const out: Post[] = []
  for (let k = 0; k < SQUARE.posts; k++) {
    const a = ((k * 360) / SQUARE.posts + SQUARE.offsetDeg) * (Math.PI / 180)
    const x = cx + SQUARE.ring * Math.sin(a)
    const z = cz + SQUARE.ring * Math.cos(a)
    const tx = Math.cos(a)
    const tz = -Math.sin(a)
    const circles: [Circle, Circle] = [
      { x: x + SQUARE.spread * tx, z: z + SQUARE.spread * tz, r: SQUARE.circleR },
      { x: x - SQUARE.spread * tx, z: z - SQUARE.spread * tz, r: SQUARE.circleR },
    ]
    // the barrier, shortened to 3 u and thickened to the circles' 1.5: drawn is what's solid.
    // Its length runs along local x, so rotY = a lays it along the ring's tangent.
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(x, 0, z)
    mesh.rotation.y = a
    mesh.scale.set(0.75, 1, (2 * SQUARE.circleR) / (box.max.z - box.min.z))
    mesh.name = `post:${k}`
    out.push({ circles, mesh, lances: 0, cracked: false, x, z })
  }
  return out
}

/** A group of enemies placed together, asleep until you come near. */
export interface PackSpec {
  room: Room
  /**
   * `face`: where a member looks while it sleeps; without one the pack faces a random way together.
   * `slag`: it carries a slag core (area II), and leaves a burning puddle where it dies.
   */
  members: { kind: Archetype; variant?: 'lobber'; x: number; z: number; face?: { x: number; z: number }; slag?: true }[]
  /** 'heap': a Works brood asleep as a slag heap, a mound with six coals (a look, not a rule). */
  look?: 'heap'
  /** The first member leads, named and with one modifier. */
  elite?: { mod: EliteMod; name: string }
  /** The pack that introduces an archetype: set up to be read, and never an elite. */
  lesson?: boolean
  /** The room's size budget, in body-equivalents, for the checks. */
  budget?: number
  /** The template it was built from (e.g. 'C+H+H'); today's packs have none. */
  template?: string
}

/** What a level was built from, for the look checks (__genLook): props, the tall beyond, floors. */
export interface LevelMade {
  /** `room`: its index in `rooms` (-1 on the walk home). */
  props: { piece: Piece; x: number; z: number; top: number; p: number; breakable: boolean; intact: boolean; room: number }[]
  tall: { what: Piece | MachineKind; x: number; z: number; hides: boolean }[]
  floors: { piece: Piece; p: number; corridor: boolean }[]
  /** Everything standing within 0.5 u of a floor edge that isn't the wall or a column (INV: none that's tall). */
  edge: { piece: string; x: number; z: number; top: number }[]
  /** The far side's upright pieces (the quarter's door frames): p is the nearest room's progress, cells how far from floor. */
  far: { piece: Piece; x: number; z: number; p: number; hides: boolean; cells: number }[]
}

export interface Level {
  depth: number
  /** The look it was built in. */
  place: PlaceId
  /** The layout's floor cells (key(i, j)). */
  floor: ReadonlySet<string>
  /** 0..1 for a room: its spine index over the spine's length; side rooms take the nearest spine room's. */
  progressOf: (room: Room) => number
  /** The spine room containing (x, z), or null (corridors, side rooms, outside). */
  spineAt: (x: number, z: number) => Room | null
  /** G8: the thief's nest when this level rolled one (a side room's, clear of its pack). */
  thief?: { nest: THREE.Vector3; room: Room }
  made: LevelMade
  packs: PackSpec[]
  breakables: Breakable[]
  shrines: Shrine[]
  /** Break a crate: it stops being solid and its mesh goes. */
  smash: (b: Breakable) => void
  /** Boss levels: where the boss stands and what it faces. The exits stay shut until it falls. */
  boss?: { x: number; z: number; face: THREE.Vector3 }
  /** The square only: its posts, and the tower's footprint (dead until the tower falls and leaves its husk). */
  posts?: Post[]
  footprint?: Circle
  /** The cold beam, on. The last Assembler's arena builds none, so there it never opens. */
  exitOpen: boolean
  openExit: () => void
  /** The warm beam, home: boss levels only; null elsewhere. Opens by exitsAfterBoss. */
  home: THREE.Vector3 | null
  homeOpen: boolean
  openHome: () => void
  /** The warm beam's brightness over its breathing: 1 at rest, up to 2 as he walks into it. */
  homeGlow: number
  /** Walk home only: the lit house's door zone and where Grace's light ends up inside it. */
  house?: { door: THREE.Vector3; inside: THREE.Vector3 }
  group: THREE.Group
  terrain: Terrain
  rooms: Room[]
  entrance: THREE.Vector3
  exit: THREE.Vector3
  update: (t: number) => void
  dispose: () => void
}

/** A grid cell's name in the floor set. */
export const key = (i: number, j: number) => `${i},${j}`
const DIRS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]]

function rng(seed: number) {
  let s = seed % 2147483647 || 1
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

/**
 * Separate seeded streams for what area II adds (slag, the heap, machinery, the thief):
 * the main sequence never sees them, so the ruin builds exactly as it did.
 */
const SALT = { slag: 0x51a6, heap: 0x4ea9, far: 0xfa51, machine: 0x3ac1, thief: 0x7417 }
/**
 * The salted seed is scrambled before it seeds its stream: rng's first draws follow its
 * seed almost linearly, so seeds 1, 2, 3 xor one salt would all open on the same roll.
 */
function scramble(n: number) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b)
  return (n ^ (n >>> 16)) >>> 0
}
const stream = (seed: number, salt: number) => rng((scramble((seed ^ salt) >>> 0) % 2147483646) + 1)

/** Whether a point is within 0.5 u of a floor edge: where only the wall and its columns may stand. */
function nearEdge(floor: ReadonlySet<string>, x: number, z: number) {
  const ci = Math.round(x / CELL)
  const cj = Math.round(z / CELL)
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
    if (!floor.has(key(i, j))) continue
    for (const [dx, dz] of DIRS) {
      if (floor.has(key(i + dx, j + dz))) continue
      // the edge between (i, j) and its open neighbour: a segment one cell long
      const ex = (i + dx / 2) * CELL
      const ez = (j + dz / 2) * CELL
      const along = dx !== 0 ? Math.max(0, Math.abs(z - ez) - CELL / 2) : Math.max(0, Math.abs(x - ex) - CELL / 2)
      const across = dx !== 0 ? Math.abs(x - ex) : Math.abs(z - ez)
      if (Math.hypot(along, across) < 0.5) return true
    }
  }
  return false
}

/**
 * G1: how far along the level each room is. Spine rooms by their index; a side room
 * takes the spine room whose centre is nearest (ties to the lower index). No rand().
 */
function progressMap(rooms: Room[], boss: boolean) {
  const spine = boss ? rooms.slice(0, 2) : rooms.slice(0, MAIN_ROOMS)
  const of = new Map<Room, number>()
  spine.forEach((r, i) => of.set(r, i / Math.max(1, spine.length - 1)))
  for (const r of rooms) {
    if (of.has(r)) continue
    let best = 0
    let bestD = Infinity
    spine.forEach((sp, i) => {
      const d = Math.hypot(sp.center.x - r.center.x, sp.center.z - r.center.z)
      if (d < bestD - 1e-9) {
        bestD = d
        best = i
      }
    })
    of.set(r, of.get(spine[best]!)!)
  }
  const inside = (r: Room, i: number, j: number) => Math.abs(i - r.ci) <= r.rx && Math.abs(j - r.cj) <= r.rz
  /** A cell: its room's, or for a corridor cell the nearest room centre's. */
  const cell = (i: number, j: number) => {
    const r = rooms.find((rm) => inside(rm, i, j))
    if (r) return of.get(r)!
    let bestD = Infinity
    let p = 0
    for (const rm of rooms) {
      const d = Math.hypot(rm.ci - i, rm.cj - j)
      if (d < bestD - 1e-9) {
        bestD = d
        p = of.get(rm)!
      }
    }
    return p
  }
  const spineAt = (x: number, z: number) => {
    const i = Math.round(x / CELL)
    const j = Math.round(z / CELL)
    return spine.find((r) => inside(r, i, j)) ?? null
  }
  return { of: (r: Room) => of.get(r) ?? 0, cell, spineAt }
}

// --- layout -----------------------------------------------------------------

interface Layout {
  floor: Set<string>
  rooms: Room[]
  corridors: Set<string>
}

function roomCells(ci: number, cj: number, rx: number, rz: number): [number, number][] {
  const out: [number, number][] = []
  for (let i = -rx; i <= rx; i++) for (let j = -rz; j <= rz; j++) out.push([ci + i, cj + j])
  return out
}

/** Half-extent of a room along a direction. */
const halfAlong = (r: { rx: number; rz: number }, d: [number, number]) => (d[0] !== 0 ? r.rx : r.rz)

/**
 * Try to hang a room of the given size off `from` in direction d. A hall's long
 * side is laid along d. Returns null if it would touch anything.
 */
function tryAttach(
  layout: Layout, from: Room, d: [number, number], len: number, kind: RoomKind, size: readonly [number, number],
): Room | null {
  const [dx, dz] = d
  const [long, short] = size
  const rx = dx !== 0 ? long : short
  const rz = dx !== 0 ? short : long
  const reach = halfAlong(from, d) + len + halfAlong({ rx, rz }, d) + 1
  const ci = from.ci + dx * reach
  const cj = from.cj + dz * reach
  const corridor: [number, number][] = []
  const edge = halfAlong(from, d)
  for (let k = 1; k <= len; k++) corridor.push([from.ci + dx * (edge + k), from.cj + dz * (edge + k)])

  // the new room plus a one-cell margin must be empty, so rooms never merge
  for (let i = -rx - 1; i <= rx + 1; i++) {
    for (let j = -rz - 1; j <= rz + 1; j++) {
      if (layout.floor.has(key(ci + i, cj + j))) return null
    }
  }
  // corridor cells must not run alongside anything except where they join
  for (const [i, j] of corridor) {
    if (layout.floor.has(key(i, j))) return null
    for (const [sx, sz] of [[dz, dx], [-dz, -dx]] as [number, number][]) {
      if (layout.floor.has(key(i + sx, j + sz))) return null
    }
  }

  for (const [i, j] of corridor) {
    layout.floor.add(key(i, j))
    layout.corridors.add(key(i, j))
  }
  for (const [i, j] of roomCells(ci, cj, rx, rz)) layout.floor.add(key(i, j))
  const room: Room = { kind, ci, cj, rx, rz, center: new THREE.Vector3(ci * CELL, 0, cj * CELL) }
  layout.rooms.push(room)
  return room
}

/** A boss level: the entrance, a short walk, and one big arena. Nothing else. */
function generateBossLayout(rand: () => number): Layout {
  const layout: Layout = { floor: new Set(), rooms: [], corridors: new Set() }
  const first: Room = { kind: 'entrance', ci: 0, cj: 0, rx: 1, rz: 1, center: new THREE.Vector3() }
  for (const [i, j] of roomCells(0, 0, 1, 1)) layout.floor.add(key(i, j))
  layout.rooms.push(first)
  tryAttach(layout, first, DIRS[Math.floor(rand() * 4)]!, 2, 'exit', SIZE.arena)
  return layout
}

function generateLayout(rand: () => number, sideRooms: number): Layout {
  for (let attempt = 0; attempt < 80; attempt++) {
    const layout: Layout = { floor: new Set(), rooms: [], corridors: new Set() }
    // entrance and exit stay small: you arrive and leave through them, you don't fight in them
    const first: Room = { kind: 'entrance', ci: 0, cj: 0, rx: 1, rz: 1, center: new THREE.Vector3() }
    for (const [i, j] of roomCells(0, 0, 1, 1)) layout.floor.add(key(i, j))
    layout.rooms.push(first)

    // the spine wanders but mostly keeps a heading, so it reads as a journey
    let prev = first
    let heading = Math.floor(rand() * 4)
    let ok = true
    for (let n = 1; n < MAIN_ROOMS; n++) {
      const kind: RoomKind = n === MAIN_ROOMS - 1 ? 'exit' : 'main'
      const size = kind === 'exit' ? SIZE.small : rand() < 0.25 ? SIZE.hall : SIZE.big
      const turns = rand() < 0.55 ? [0, 1, 3] : [1, 3, 0]
      let placed: Room | null = null
      for (const t of turns) {
        const d = (heading + t) % 4
        placed = tryAttach(layout, prev, DIRS[d]!, 1 + Math.floor(rand() * 2), kind, size)
        if (placed) {
          heading = d
          break
        }
      }
      if (!placed) {
        ok = false
        break
      }
      prev = placed
    }
    if (!ok) continue

    // side rooms: dead ends off the middle of the spine, for loot and risk
    const spine = layout.rooms.filter((r) => r.kind === 'main')
    let added = 0
    for (let tries = 0; tries < 30 && added < sideRooms; tries++) {
      const host = spine[Math.floor(rand() * spine.length)]!
      if (tryAttach(layout, host, DIRS[Math.floor(rand() * 4)]!, 1 + Math.floor(rand() * 2), 'side', SIZE.small)) added++
    }
    return layout
  }
  throw new Error('dungeon layout failed')
}

// --- terrain ----------------------------------------------------------------

/** The solid world of one level: floor cells (by `key`), wall boxes, props as circles. */
export function makeTerrain(floor: Set<string>, boxes: Box[], circles: Circle[]): Terrain {
  // bucket everything by cell, so a query only looks at its neighbourhood
  const boxIndex = new Map<string, Box[]>()
  const circleIndex = new Map<string, Circle[]>()
  const cellOf = (v: number) => Math.round(v / CELL)
  const bucket = <T>(index: Map<string, T[]>, item: T, minX: number, maxX: number, minZ: number, maxZ: number) => {
    for (let i = cellOf(minX); i <= cellOf(maxX); i++) {
      for (let j = cellOf(minZ); j <= cellOf(maxZ); j++) {
        const k = key(i, j)
        const list = index.get(k) ?? []
        list.push(item)
        index.set(k, list)
      }
    }
  }
  for (const b of boxes) bucket(boxIndex, b, b.minX, b.maxX, b.minZ, b.maxZ)
  for (const c of circles) bucket(circleIndex, c, c.x - c.r, c.x + c.r, c.z - c.r, c.z + c.r)

  const near = <T>(index: Map<string, T[]>, x: number, z: number): T[] => {
    const ci = cellOf(x)
    const cj = cellOf(z)
    const out: T[] = []
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) out.push(...(index.get(key(i, j)) ?? []))
    return out
  }
  const onFloor = (x: number, z: number) => floor.has(key(cellOf(x), cellOf(z)))

  // --- breaches: per solid piece, and per void cell, open to sight and projectiles only ---
  const ids = new Map<Box | Circle, number>()
  let nextId = 1
  for (const b of boxes) ids.set(b, nextId++)
  for (const c of circles) ids.set(c, nextId++)
  /** Seconds left on each open piece. */
  const breached = new Map<Box | Circle, number>()
  /** Off-floor cells a breach crossed: key -> seconds left. Their ids are handed out as they open. */
  const voidBreach = new Map<string, { t: number; id: number; i: number; j: number }>()

  const inBox = (b: Box, x: number, z: number, r: number) => {
    const cx = Math.max(b.minX, Math.min(x, b.maxX))
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
    return (x - cx) ** 2 + (z - cz) ** 2 < r * r
  }
  const inCircle = (c: Circle, x: number, z: number, r: number) => (x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2

  /** What (x, z) is inside, grown by r. With `see`, open breaches don't count. Movement never passes `see`. */
  const solidAt = (x: number, z: number, r: number, see = false): 'wall' | 'prop' | null => {
    if (!onFloor(x, z) && !(see && voidBreach.has(key(cellOf(x), cellOf(z))))) return 'wall'
    for (const b of near(boxIndex, x, z)) {
      if (see && breached.has(b)) continue
      if (inBox(b, x, z, r)) return 'wall'
    }
    for (const c of near(circleIndex, x, z)) {
      if (c.dead || (see && breached.has(c))) continue
      if (inCircle(c, x, z, r)) return 'prop'
    }
    return null
  }
  const hits = (x: number, z: number, r: number, see = false) => solidAt(x, z, r, see) !== null

  const holeOf = (piece: Box | Circle): BreachHole => 'minX' in piece
    ? { id: ids.get(piece)!, kind: 'wall', minX: piece.minX, maxX: piece.maxX, minZ: piece.minZ, maxZ: piece.maxZ }
    : { id: ids.get(piece)!, kind: 'prop', minX: piece.x - piece.r, maxX: piece.x + piece.r, minZ: piece.z - piece.r, maxZ: piece.z + piece.r }
  const voidHole = (v: { id: number; i: number; j: number }): BreachHole => ({
    id: v.id, kind: 'void', minX: v.i * CELL - CELL / 2, maxX: v.i * CELL + CELL / 2, minZ: v.j * CELL - CELL / 2, maxZ: v.j * CELL + CELL / 2,
  })

  // --- navigation: a breadth-first distance field per target cell, cached ---
  const fields = new Map<string, Map<string, number>>()
  const field = (ti: number, tj: number) => {
    const k = key(ti, tj)
    let f = fields.get(k)
    if (f) return f
    f = new Map<string, number>()
    const queue: [number, number][] = [[ti, tj]]
    f.set(k, 0)
    while (queue.length) {
      const [i, j] = queue.shift()!
      const d = f.get(key(i, j))!
      for (const [dx, dz] of DIRS) {
        const nk = key(i + dx, j + dz)
        if (floor.has(nk) && !f.has(nk)) {
          f.set(nk, d + 1)
          queue.push([i + dx, j + dz])
        }
      }
    }
    if (fields.size > 24) fields.delete(fields.keys().next().value!)
    fields.set(k, f)
    return f
  }
  const clear = (ax: number, az: number, bx: number, bz: number, r: number) => {
    const len = Math.hypot(bx - ax, bz - az)
    const steps = Math.max(1, Math.ceil(len / 0.35))
    for (let s = 1; s < steps; s++) {
      const t = s / steps
      if (hits(ax + (bx - ax) * t, az + (bz - az) * t, r)) return false
    }
    return true
  }

  return {
    nextStep(ax, az, bx, bz, radius) {
      if (clear(ax, az, bx, bz, radius * 0.8)) return { x: bx, z: bz }
      const f = field(cellOf(bx), cellOf(bz))
      const ci = cellOf(ax)
      const cj = cellOf(az)
      let best = f.get(key(ci, cj)) ?? Infinity
      let to = { x: bx, z: bz }
      for (const [dx, dz] of DIRS) {
        const d = f.get(key(ci + dx, cj + dz))
        if (d !== undefined && d < best) {
          best = d
          to = { x: (ci + dx) * CELL, z: (cj + dz) * CELL }
        }
      }
      return to
    },

    pushOut(pos, radius) {
      for (const b of near(boxIndex, pos.x, pos.z)) {
        const cx = Math.max(b.minX, Math.min(pos.x, b.maxX))
        const cz = Math.max(b.minZ, Math.min(pos.z, b.maxZ))
        const dx = pos.x - cx
        const dz = pos.z - cz
        const d = Math.hypot(dx, dz)
        if (d < radius) {
          if (d > 0.0001) {
            pos.x = cx + (dx / d) * radius
            pos.z = cz + (dz / d) * radius
          } else {
            // centre inside the box: leave by the nearest face
            const faces = [pos.x - b.minX, b.maxX - pos.x, pos.z - b.minZ, b.maxZ - pos.z]
            const m = Math.min(...faces)
            if (m === faces[0]) pos.x = b.minX - radius
            else if (m === faces[1]) pos.x = b.maxX + radius
            else if (m === faces[2]) pos.z = b.minZ - radius
            else pos.z = b.maxZ + radius
          }
        }
      }
      for (const c of near(circleIndex, pos.x, pos.z)) {
        if (c.dead) continue
        const dx = pos.x - c.x
        const dz = pos.z - c.z
        const d = Math.hypot(dx, dz)
        const min = c.r + radius
        if (d > 0.0001 && d < min) {
          pos.x = c.x + (dx / d) * min
          pos.z = c.z + (dz / d) * min
        }
      }
    },

    blocked(x, z, pad = 0, see = false) {
      return hits(x, z, Math.max(0.001, pad), see)
    },

    blocker(x, z, pad, see) {
      return solidAt(x, z, Math.max(0.001, pad), see)
    },

    lineClear(ax, az, bx, bz, pad = 0, see = false) {
      const len = Math.hypot(bx - ax, bz - az)
      const steps = Math.max(1, Math.ceil(len / 0.35))
      for (let s = 1; s < steps; s++) {
        const t = s / steps
        if (hits(ax + (bx - ax) * t, az + (bz - az) * t, Math.max(0.001, pad), see)) return false
      }
      return true
    },

    breach(ax, az, bx, bz, seconds) {
      const opened: BreachHole[] = []
      const len = Math.hypot(bx - ax, bz - az)
      const steps = Math.max(1, Math.ceil(len / 0.2))
      const open = (piece: Box | Circle) => {
        if (!breached.has(piece)) opened.push(holeOf(piece))
        breached.set(piece, Math.max(breached.get(piece) ?? 0, seconds))
      }
      for (let s = 0; s <= steps; s++) {
        const x = ax + ((bx - ax) * s) / steps
        const z = az + ((bz - az) * s) / steps
        if (!onFloor(x, z)) {
          const i = cellOf(x)
          const j = cellOf(z)
          const k = key(i, j)
          const v = voidBreach.get(k)
          if (v) v.t = Math.max(v.t, seconds)
          else {
            const nv = { t: seconds, id: nextId++, i, j }
            voidBreach.set(k, nv)
            opened.push(voidHole(nv))
          }
        }
        for (const b of near(boxIndex, x, z)) if (inBox(b, x, z, 0.15)) open(b)
        for (const c of near(circleIndex, x, z)) if (!c.dead && inCircle(c, x, z, 0.15)) open(c)
      }
      return opened
    },

    tickBreaches(dt) {
      const closed: BreachHole[] = []
      for (const [piece, t] of breached) {
        if (t - dt > 0) breached.set(piece, t - dt)
        else {
          breached.delete(piece)
          closed.push(holeOf(piece))
        }
      }
      for (const [k, v] of voidBreach) {
        if ((v.t -= dt) <= 0) {
          voidBreach.delete(k)
          closed.push(voidHole(v))
        }
      }
      return closed
    },

    faces(x, z, r) {
      const out: WallFace[] = []
      for (const b of boxes) {
        if (breached.has(b)) continue
        const cx = Math.max(b.minX, Math.min(x, b.maxX))
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ))
        if ((x - cx) ** 2 + (z - cz) ** 2 > r * r) continue
        out.push(
          { axis: 'x', at: b.minX, normal: -1, from: b.minZ, to: b.maxZ },
          { axis: 'x', at: b.maxX, normal: 1, from: b.minZ, to: b.maxZ },
          { axis: 'z', at: b.minZ, normal: -1, from: b.minX, to: b.maxX },
          { axis: 'z', at: b.maxZ, normal: 1, from: b.minX, to: b.maxX },
        )
      }
      return out
    },

    clampMove(ax, az, bx, bz, radius) {
      const len = Math.hypot(bx - ax, bz - az)
      const steps = Math.max(1, Math.ceil(len / 0.2))
      let x = ax
      let z = az
      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const nx = ax + (bx - ax) * t
        const nz = az + (bz - az) * t
        if (hits(nx, nz, radius)) break
        x = nx
        z = nz
      }
      return { x, z }
    },
  }
}

// --- building ---------------------------------------------------------------

// --- pack templates: deeper levels mix archetypes at the same budget ---

/** C ram, H hulk, S sentinel, L Lobber (a sentinel that lobs); M8/M6 a swarm of eight or six mites. */
type Member = 'C' | 'H' | 'S' | 'L' | 'M8' | 'M6'
type Row = { today: true; weight: number; members?: undefined } | { today?: false; weight: number; members: Member[] }

/**
 * Body-equivalents: what a member costs of a room's budget. A ram is half again a
 * hulk, a mite a quarter. Deeper is more varied, never more HP or damage.
 */
const BE: Record<Member, number> = { C: 1.5, H: 1, S: 1, L: 1, M8: 2, M6: 1.5 }
const beOf = (ms: readonly Member[]) => ms.reduce((a, m) => a + BE[m], 0)
/** The Lobber is a ranged body, for the kinds cap too. */
const kindOf = (m: Member): Archetype => (m === 'C' ? 'charger' : m === 'S' || m === 'L' ? 'ranged' : m === 'H' ? 'chaser' : 'swarm')
/** A template's bodies, in order: a swarm member is its whole brood. */
const bodies = (ms: readonly Member[]): Archetype[] => ms.flatMap((m) => (m === 'M8' ? Array(8).fill('swarm') : m === 'M6' ? Array(6).fill('swarm') : [kindOf(m)]))
/** Which of those bodies are Lobbers, in the same order. */
const lobbersOf = (ms: readonly Member[]): boolean[] => ms.flatMap((m) => (m === 'M8' ? Array(8).fill(false) : m === 'M6' ? Array(6).fill(false) : [m === 'L']))
/** A swarm too big for the room's budget comes as six. */
const shrink = (ms: readonly Member[], budget: number): Member[] => (beOf(ms) > budget + 1 ? ms.map((m) => (m === 'M8' ? 'M6' : m)) : [...ms])

/** The first listed member leads (it becomes the elite if the pack is picked). */
const D4: Row[] = [{ members: ['C', 'H', 'H'], weight: 2 }, { members: ['C', 'H', 'S'], weight: 1 }]
const D5: Row[] = [
  { members: ['M8', 'S'], weight: 1 }, // the screen
  { members: ['C', 'C', 'H'], weight: 1 }, // bulls
  { members: ['C', 'H', 'H', 'S'], weight: 1 },
  { members: ['M6', 'H', 'H'], weight: 1 },
  { members: ['L', 'H', 'H'], weight: 1 }, // circles over the furniture (after the lesson)
  { members: ['M6', 'L'], weight: 1 }, // rings on the floor, circles from the sky
  { members: ['C', 'H', 'L'], weight: 1 }, // the ram flushes you, the shell punishes hiding
  { today: true, weight: 2 },
]
const D7: Row[] = [
  { members: ['C', 'M6', 'H', 'S'], weight: 1 },
  { members: ['C', 'C', 'M6'], weight: 1 },
  { members: ['M8', 'S', 'S'], weight: 1 },
  { members: ['C', 'H', 'H', 'H', 'S'], weight: 1 },
  { today: true, weight: 2 },
]
/**
 * Per level: how many packs may hold rams, mites or Lobbers, rams per pack, and distinct
 * archetypes per pack. Depth 4 has two broods: the open lesson, and the Works' slag heap
 * after it. Lobbers start at 5, where the quarter's cover gets dense enough to punish.
 */
const CAPS = (d: number) => d <= 4
  ? { chargerPacks: 2, swarmPacks: 2, chargersPerPack: 1, kinds: 2, lobberPacks: 0 }
  : d <= 6 ? { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 3, lobberPacks: 3 }
  : { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 4, lobberPacks: 3 }
/** INV: no pack holds more than this many shooters, Lobbers and sentinels together. */
const SHOOTERS_MAX = 2

function pickWeighted<T extends { weight: number }>(rows: T[], rand: () => number): T {
  let r = rand() * rows.reduce((a, row) => a + row.weight, 0)
  for (const row of rows) if ((r -= row.weight) <= 0) return row
  return rows[rows.length - 1]!
}

/** Top a template up with hulks until it's within half a body of the budget, never past the kinds cap. */
function fill(members: readonly Member[], budget: number, kindsCap: number): Member[] {
  const out = [...members]
  const kinds = new Set(out.map(kindOf))
  while (beOf(out) < budget - 0.5 && (kinds.has('chaser') || kinds.size < kindsCap)) {
    out.push('H')
    kinds.add('chaser')
  }
  return out
}

/** A lesson wants a full 5x5 main room; a hall will do if there's none. */
function pickLessonRoom(rooms: Room[], rand: () => number): Room | null {
  const main = rooms.filter((r) => r.kind === 'main')
  const full = main.filter((r) => r.rx === 2 && r.rz === 2)
  const pool = full.length ? full : main.filter((r) => r.rx >= 2 || r.rz >= 2)
  return pool.length ? pool[Math.floor(rand() * pool.length)]! : null
}

/** A floor cell's piece: the first whose cumulative threshold the cell's one roll is under. */
const pickFloor = (table: [Piece, number][], roll: number): Piece => (table.find(([, t]) => roll < t) ?? table[table.length - 1]!)[0]

/**
 * `place` (default: the depth's, lookAt) is what it's built with; `boss` is bossFor(depth).
 * INV: the ruin builds exactly what this built before places existed, rand() for rand().
 */
export function generateLevel(
  depth: number, seed = Math.floor(Math.random() * 1e9), opts: { boss?: BossDef | null; place?: PlaceDef; bossFelled?: boolean } = {},
): Level {
  const place = opts.place ?? lookAt(depth)
  const kit = place.kit
  const gen = place.gen
  const rand = rng(seed)
  const layout = opts.boss ? generateBossLayout(rand) : generateLayout(rand, 2 + Math.floor(rand() * 2))
  const { floor } = layout
  const progress = progressMap(layout.rooms, !!opts.boss)
  const made: LevelMade = { props: [], tall: [], floors: [], edge: [], far: [] }
  const placements: Placement[] = []
  const boxes: Box[] = []
  const circles: Circle[] = []
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!
  const quarter = () => Math.floor(rand() * 4) * (Math.PI / 2)

  // --- floors ---
  const cells = [...floor].map((k) => k.split(',').map(Number) as [number, number])
  // G2: one rand() per cell, against the band for how far along it is (the ruin has one table)
  const roomTable = (p: number) => {
    const bands = gen.floorBands
    if (!bands) return kit.floorRoom
    for (let b = bands.length - 1; b >= 0; b--) if (bands[b]!.from <= p) return bands[b]!.room
    return bands[0]!.room
  }
  const square = opts.boss?.arena === 'square' ? layout.rooms.find((r) => r.kind === 'exit')! : null
  const inSquare = (i: number, j: number) => !!square && Math.abs(i - square.ci) <= square.rx && Math.abs(j - square.cj) <= square.rz
  for (const [i, j] of cells) {
    const corridor = layout.corridors.has(key(i, j))
    const roll = rand()
    const p = progress.cell(i, j)
    // the square is paved: flags, some broken
    const piece = pickFloor(corridor ? kit.floorCorridor : inSquare(i, j) ? SQUARE.floor : roomTable(p), roll)
    placements.push({ piece, x: i * CELL, z: j * CELL, rotY: quarter() })
    made.floors.push({ piece, p, corridor })
  }

  buildWalls(cells, floor, kit, placements, boxes, circles)

  // --- cover: a few props per room, kept off the lines between doorways ---
  const PROPS = kit.cover
  const BREAKABLE = new Set<Piece>(kit.breakable)
  const breakables: Breakable[] = []
  for (const room of layout.rooms) {
    if (room.kind === 'entrance' || room.kind === 'exit') continue
    const cellsIn = (2 * room.rx + 1) * (2 * room.rz + 1)
    const p = progress.of(room)
    // G3: props per cell rise with progress where a place asks (the ruin's is 1/4 flat: round(cells / 4) as ever)
    const n = Math.round(cellsIn * (gen.cover[0] + (gen.cover[1] - gen.cover[0]) * p)) + Math.floor(rand() * 2)
    const maxX = room.rx * CELL + CELL / 2 - 1.4
    const maxZ = room.rz * CELL + CELL / 2 - 1.4
    const used: [number, number][] = []
    for (let tries = 0; tries < gen.coverTries && used.length < n; tries++) {
      const ox = (rand() * 2 - 1) * maxX
      const oz = (rand() * 2 - 1) * maxZ
      // corridors enter on the centre row and column: keep those lanes open
      if (Math.abs(ox) < 2.4 || Math.abs(oz) < 2.4) continue
      if (used.some(([ux, uz]) => Math.hypot(ux - ox, uz - oz) < gen.coverGap)) continue
      used.push([ox, oz])
      // G4: intact cover more often the further in (one extra rand(), only where a place has any)
      const intact = !!gen.intact && rand() < p
      const [piece, want] = pick(intact ? gen.intact! : PROPS)
      // INV: nothing in a room stands above the barrier's reach; a tall piece is scaled to fit
      const scale = Math.min(want, gen.coverMaxH / pieceData(piece).height)
      const x = room.center.x + ox
      const z = room.center.z + oz
      const rotY = rand() * Math.PI * 2
      const circle: Circle = { x, z, r: pieceData(piece).radius * scale * 0.8 }
      circles.push(circle)
      if (BREAKABLE.has(piece)) {
        // breakables are their own meshes, not instanced, so each can go on its own
        const { geometry, material } = pieceData(piece)
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, 0, z)
        mesh.rotation.y = rotY
        mesh.scale.setScalar(scale)
        breakables.push({ mesh, x, z, r: circle.r, circle, broken: false })
      } else {
        placements.push({ piece, x, z, rotY, scale })
      }
      made.props.push({ piece, x, z, top: pieceData(piece).height * scale, p, breakable: BREAKABLE.has(piece), intact, room: layout.rooms.indexOf(room) })
    }
  }

  // --- the square: eight brick posts round a lamp tower, and furniture left in its corners ---
  let bossSpot: Level['boss']
  const posts: Post[] = []
  let footprint: Circle | undefined
  const postMeshes: THREE.Mesh[] = []
  if (square) {
    const entrance = layout.rooms.find((r) => r.kind === 'entrance')!
    const c = square.center
    for (const p of squarePosts(c.x, c.z)) {
      circles.push(...p.circles)
      postMeshes.push(p.mesh)
      posts.push(p)
    }
    footprint = { x: c.x, z: c.z, r: SQUARE.footprint, dead: true }
    circles.push(footprint)
    // whole furniture in the four corners, from the quarter's intact pieces: solid, never breakable
    const fs = stream(seed, SALT.far)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const list = gen.intact ?? kit.cover
      const [piece, want] = list[Math.floor(fs() * list.length)]!
      const scale = Math.min(want, gen.coverMaxH / pieceData(piece).height)
      const x = c.x + sx * SQUARE.furniture
      const z = c.z + sz * SQUARE.furniture
      placements.push({ piece, x, z, rotY: Math.floor(fs() * 4) * (Math.PI / 2), scale })
      circles.push({ x, z, r: pieceData(piece).radius * scale * 0.8 })
      made.props.push({ piece, x, z, top: pieceData(piece).height * scale, p: 1, breakable: false, intact: true, room: layout.rooms.indexOf(square) })
    }
    // it stands at the centre, facing the way you come in
    bossSpot = { x: c.x, z: c.z, face: entrance.center.clone() }
  } else if (opts.boss) {
    // --- the yard: four low cover walls to hide behind and to charge into, and crates ---
    const arena = layout.rooms.find((r) => r.kind === 'exit')!
    const entrance = layout.rooms.find((r) => r.kind === 'entrance')!
    const c = arena.center
    for (const [ox, oz, along] of [[-6.5, 0, 'z'], [6.5, 0, 'z'], [0, -6.5, 'x'], [0, 6.5, 'x']] as const) {
      const x = c.x + ox
      const z = c.z + oz
      placements.push({ piece: kit.arenaCover, x, z, rotY: along === 'z' ? Math.PI / 2 : 0 })
      boxes.push(along === 'z'
        ? { minX: x - 0.35, maxX: x + 0.35, minZ: z - 2, maxZ: z + 2 }
        : { minX: x - 2, maxX: x + 2, minZ: z - 0.35, maxZ: z + 0.35 })
    }
    for (const [ox, oz] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5], [-3.5, 10], [3.5, -10]] as const) {
      const x = c.x + ox
      const z = c.z + oz
      const piece: Piece = rand() < 0.5 ? kit.breakable[0]! : kit.breakable[1]!
      const scale = piece === kit.breakable[0] ? 0.7 : 0.8
      const { geometry, material } = pieceData(piece)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, 0, z)
      mesh.rotation.y = rand() * 6.3
      mesh.scale.setScalar(scale)
      const circle: Circle = { x, z, r: pieceData(piece).radius * scale * 0.8 }
      circles.push(circle)
      breakables.push({ mesh, x, z, r: circle.r, circle, broken: false })
    }
    // it waits at the far side, facing the way you come in
    const away = new THREE.Vector3(c.x - entrance.center.x, 0, c.z - entrance.center.z).normalize()
    bossSpot = { x: c.x + away.x * 4, z: c.z + away.z * 4, face: entrance.center.clone() }
  }

  // --- the beyond ---
  const machines: MachinePlacement[] = []
  const { minI, maxI, minJ, maxJ, spanX, spanZ } = buildBeyond(cells, floor, rand, kit, placements, undefined, {
    machines: gen.machines, stream: stream(seed, SALT.machine), out: machines, made, clearEdges: gen.coverMaxH < Infinity,
    // the square is the end of the quarter: its far side at its most intact
    farSide: gen.farSide, farStream: stream(seed, SALT.far),
    pAt: square ? () => 1 : (x, z) => progress.cell(Math.round(x / CELL), Math.round(z / CELL)),
  })

  // --- packs: one per main and side room, sized by depth, never in the entrance or exit ---
  const makeTerrainNow = makeTerrain(floor, boxes, circles)
  const packs: PackSpec[] = []
  const packRooms = layout.rooms.filter((r) => r.kind === 'main' || r.kind === 'side')
  // level 1: exactly one pack carries a ranged; deeper, more of them do
  const rangedPack = Math.floor(rand() * packRooms.length)
  // depth 2 meets the ram: one big main room holds a ram and a hulk, alone and easy to read
  const lessonRoom = depth === 2 ? pickLessonRoom(packRooms, rand) : null
  // depth 4 meets the swarm: eight mites alone in a big main room, so the rings can be seen before they bite
  const swarmLesson = depth === 4 ? pickLessonRoom(packRooms, rand) : null
  // and one or two other main rooms get a ram template; the rest are today's packs
  const d4Rooms = new Set<Room>()
  if (depth === 4) {
    const mains = packRooms.filter((r) => r.kind === 'main' && r !== swarmLesson)
    const n = 1 + (rand() < 0.5 ? 1 : 0)
    while (d4Rooms.size < Math.min(n, mains.length)) d4Rooms.add(mains.splice(Math.floor(rand() * mains.length), 1)[0]!)
  }
  // the Works' slag heap: a second brood after the lesson, asleep as a mound (its own stream)
  let heapRoom: Room | null = null
  if (depth === 4 && place.id === 'works') {
    const hs = stream(seed, SALT.heap)
    const after = (r: Room) => r !== swarmLesson && progress.of(r) > (swarmLesson ? progress.of(swarmLesson) : -1)
    // a main room first: one without the rams, else one of two ram rooms (the level keeps its other), else a side
    const mains = packRooms.filter((r) => r.kind === 'main' && after(r))
    const plain = mains.filter((r) => !d4Rooms.has(r))
    const rams = d4Rooms.size >= 2 ? mains.filter((r) => d4Rooms.has(r)) : []
    const sides = packRooms.filter((r) => r.kind === 'side' && after(r))
    const pool = plain.length ? plain : rams.length ? rams : sides
    if (hs() < HEAP.chance && pool.length) heapRoom = pool[Math.floor(hs() * pool.length)]!
  }
  // depth 5 meets the Lobber: in the densest room, the main room furthest along (a full one, else a hall)
  let lobberLesson: Room | null = null
  if (depth === 5) {
    const mains = packRooms.filter((r) => r.kind === 'main')
    const full = mains.filter((r) => r.rx === 2 && r.rz === 2)
    const pool = full.length ? full : mains.filter((r) => r.rx >= 2 || r.rz >= 2)
    for (const r of pool) if (!lobberLesson || progress.of(r) > progress.of(lobberLesson)) lobberLesson = r
  }
  const caps = CAPS(depth)
  let chargerPacks = 0
  let swarmPacks = 0
  // the lesson's Lobber counts from the start, wherever its room falls in the order
  let lobberPacks = lobberLesson ? 1 : 0
  packRooms.forEach((room, idx) => {
    const big = room.rx >= 2 || room.rz >= 2
    // the room's budget, in body-equivalents: today's size formula, unchanged
    const size = 2 + Math.floor(rand() * 2) + Math.floor((depth - 1) / 2) + (big && depth > 2 ? 1 : 0)
    const rangedCount = depth === 1
      ? (idx === rangedPack ? 1 : 0)
      : (rand() < Math.min(0.85, 0.3 * depth) ? 1 : 0) + (depth >= 4 && big && rand() < 0.5 ? 1 : 0)
    // gather off-centre, so the corridor lanes through the room aren't where they sleep
    const ox = (rand() < 0.5 ? -1 : 1) * (room.rx * CELL * 0.45)
    const oz = (rand() < 0.5 ? -1 : 1) * (room.rz * CELL * 0.45)
    const cx = room.center.x + ox
    const cz = room.center.z + oz
    const members: PackSpec['members'] = []

    // which template, if any: the lesson, depth 4's rams, or a pick from the depth's list
    let tpl: Member[] | null = null
    const lesson = room === lessonRoom || room === swarmLesson || room === lobberLesson
    if (room === lessonRoom) tpl = ['C', 'H']
    else if (room === swarmLesson) tpl = ['M8']
    // the lesson: as it is, not filled, so the one new thing is what you read
    else if (room === lobberLesson) tpl = ['L', 'H', 'H']
    else if (room === heapRoom) tpl = fill(['M6', 'H'], size, caps.kinds)
    else if (d4Rooms.has(room)) tpl = fill(pickWeighted(D4, rand).members ?? [], size, Infinity)
    else if (depth >= 5) {
      const rows = (depth >= 7 ? D7 : D5).map((row) => (row.today ? row : { ...row, members: shrink(row.members, size) })).filter((row) => {
        if (row.today) return true
        const kinds = bodies(row.members)
        const rams = kinds.filter((k) => k === 'charger').length
        // rams never in a side room (every rush would stun on a wall, so it's free); swarms may be
        if (rams > 0 && (room.kind === 'side' || chargerPacks >= caps.chargerPacks)) return false
        if (kinds.includes('swarm') && swarmPacks >= caps.swarmPacks) return false
        const lobbers = row.members.filter((m) => m === 'L').length
        if (lobbers > 0 && lobberPacks >= caps.lobberPacks) return false
        if (kinds.filter((k) => k === 'ranged').length > SHOOTERS_MAX) return false
        return rams <= caps.chargersPerPack && new Set(kinds).size <= caps.kinds && beOf(row.members) <= size + 1
      })
      const row = rows.length ? pickWeighted(rows, rand) : null
      if (row && !row.today) tpl = fill(row.members, size, caps.kinds)
    }

    if (tpl) {
      const want = bodies(tpl)
      const lobs = lobbersOf(tpl)
      const spots: ({ x: number; z: number } | null)[] = want.map(() => null)
      // mites first, as a nest round the spot; then everyone else a little out from it, so a
      // ram has room to stand and show its lane. The first listed member still leads.
      const order = [...want.keys()].sort((a, b) => Number(want[b] === 'swarm') - Number(want[a] === 'swarm'))
      const heap = room === heapRoom
      const nestR = heap ? HEAP.nestR : BROOD.nestR
      const nestGap = heap ? HEAP.nestGap : BROOD.nestGap
      for (const i of order) {
        const kind = want[i]!
        const mite = kind === 'swarm'
        // 12 tries in the ring, then more a little wider: a big template in a hall, or a nest by a
        // crate, shouldn't lose members (a nest widens slowly, so it stays a nest)
        for (let tries = 0; tries < (mite ? 48 : 24); tries++) {
          const a = rand() * Math.PI * 2
          const wide = tries >= 12
          const r = mite ? rand() * nestR * (1 + Math.max(0, tries - 12) / 24) : wide ? 0.8 + rand() * 3.7 : 1.8 + rand() * 1.2
          const x = cx + Math.cos(a) * r
          const z = cz + Math.sin(a) * r
          if (makeTerrainNow.blocked(x, z, mite ? 0.4 : kind === 'charger' ? 0.8 : 0.7)) continue
          const clash = spots.some((o, j) => {
            if (!o) return false
            const d = Math.hypot(o.x - x, o.z - z)
            const other = want[j] === 'swarm'
            return mite ? d < (other ? nestGap : 1.0) : d < (other ? 1.0 : 1.3)
          })
          if (clash) continue
          spots[i] = { x, z }
          break
        }
      }
      want.forEach((kind, i) => {
        const at = spots[i]
        if (!at) return
        // the lesson ram sleeps facing into the room: you walk in on its side, not its face
        const face = room === lessonRoom && kind === 'charger' ? { x: room.center.x, z: room.center.z } : undefined
        members.push({ kind, variant: lobs[i] ? 'lobber' : undefined, x: at.x, z: at.z, face })
      })
      if (members.some((m) => m.kind === 'charger')) chargerPacks++
      if (members.some((m) => m.kind === 'swarm')) swarmPacks++
      if (room !== lobberLesson && members.some((m) => m.variant === 'lobber')) lobberPacks++
      if (members.length) packs.push({ room, members, lesson: lesson || undefined, budget: size, template: tpl.join('+'), look: heap ? 'heap' : undefined })
      return
    }
    for (let n = 0; n < size; n++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = rand() * Math.PI * 2
        const r = 0.6 + rand() * 1.8
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        if (makeTerrainNow.blocked(x, z, 0.7)) continue
        if (members.some((m) => Math.hypot(m.x - x, m.z - z) < 1.3)) continue
        members.push({ kind: n < rangedCount ? 'ranged' : 'chaser', x, z })
        break
      }
    }
    if (members.length) packs.push({ room, members, budget: size })
  })

  // --- elites: one per level at first, one more every two depths; never in side rooms, never a lesson ---
  const FIRST = ['Rust', 'Hollow', 'Cinder', 'Grim', 'Ash', 'Pale', 'Iron', 'Gutter', 'Shard', 'Mourn']
  const SECOND = ['jaw', 'maw', 'grip', 'wake', 'hook', 'coil', 'heart', 'knell']
  /** Half the time a leader is named for what it is: Cinderhorn, not Cindermaw. */
  const POOL: Partial<Record<Archetype, string[]>> = { charger: ['horn', 'brow', 'skull', 'hoof'], swarm: ['mother', 'nest', 'hive', 'brood'] }
  const TITLES: Record<EliteMod, string> = { swift: 'the Quick', plated: 'the Plated', splitting: 'the Many', warding: 'the Warden' }
  const mainPacks = packs.filter((p) => p.room.kind === 'main' && p.members.length >= 2 && !p.lesson)
  const eliteCount = Math.min(mainPacks.length, 1 + Math.floor((depth - 1) / 2))
  for (let n = 0; n < eliteCount; n++) {
    const p = mainPacks.splice(Math.floor(rand() * mainPacks.length), 1)[0]!
    const kind = p.members[0]!.kind as Exclude<Archetype, 'boss'>
    const mod = pick(ELITE_MODS[kind])
    const pool = POOL[kind]
    const second = pool && rand() < 0.5 ? pick(pool) : pick(SECOND)
    p.elite = { mod, name: `${pick(FIRST)}${second} ${TITLES[mod]}` }
  }

  // --- G7 slag cores: area II's hulks, rams and sentinels, never a lesson's or a leader's (its drop mustn't sit in a puddle) ---
  if (Object.keys(gen.slag).length) {
    const ss = stream(seed, SALT.slag)
    for (const p of packs) {
      if (p.lesson) continue
      p.members.forEach((m, i) => {
        // a Lobber's disc is its tell: it never carries a core as well
        if ((p.elite && i === 0) || m.variant) return
        const chance = gen.slag[m.kind as 'chaser' | 'charger' | 'ranged']
        if (chance && ss() < chance) m.slag = true
      })
    }
  }

  // --- G8 the thief: its own stream, so the level around it is exactly what it was ---
  let thief: Level['thief']
  const sideRooms = layout.rooms.filter((r) => r.kind === 'side')
  if (THIEF.depths.includes(depth) && !opts.boss && sideRooms.length && stream(seed, SALT.thief)() < THIEF.chance) {
    // the side room furthest along the level (ties to the first)
    let room = sideRooms[0]!
    for (const r of sideRooms) if (progress.of(r) > progress.of(room)) room = r
    const sleepers = packs.filter((p) => p.room === room).flatMap((p) => p.members)
    const clear = (x: number, z: number) => !makeTerrainNow.blocked(x, z, THIEF.bodyRadius + 0.15) && sleepers.every((m) => Math.hypot(m.x - x, m.z - z) >= 1.2)
    // a corner of the middle, stepped outward until it's clear of the room's props and its pack
    let nest = new THREE.Vector3(room.center.x + 0.9, 0, room.center.z + 0.9)
    search: for (let rr = 0; rr <= 3; rr += 0.5) {
      const n = rr === 0 ? 1 : Math.round(rr * 8)
      for (let k = 0; k < n; k++) {
        const a = Math.PI / 4 + (k / n) * Math.PI * 2
        const x = room.center.x + 0.9 + Math.sin(a) * rr
        const z = room.center.z + 0.9 + Math.cos(a) * rr
        if (clear(x, z)) {
          nest = new THREE.Vector3(x, 0, z)
          break search
        }
      }
    }
    thief = { nest, room }
  }

  // --- a shrine, most levels: one bargain, in a main room ---
  const shrines: Shrine[] = []
  const shrineParts: THREE.Object3D[] = []
  const hosts = layout.rooms.filter((r) => r.kind === 'main')
  if (hosts.length && rand() < 0.75) {
    const room = pick(hosts)
    for (let tries = 0; tries < 12; tries++) {
      const x = room.center.x + (rand() * 2 - 1) * (room.rx * CELL * 0.5)
      const z = room.center.z + (rand() * 2 - 1) * (room.rz * CELL * 0.5)
      if (makeTerrainNow.blocked(x, z, 1.2)) continue
      const kind: ShrineKind = rand() < 0.5 ? 'rest' : 'plenty'
      const stone = new THREE.Mesh(pieceData('pillar').geometry, pieceData('pillar').material)
      stone.scale.set(0.5, 0.3, 0.5)
      stone.position.set(x, 0, z)
      const rune = new THREE.MeshBasicMaterial({ color: kind === 'rest' ? 0x8fd0ff : 0xc7b8ff, transparent: true, opacity: 0.9 })
      const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), rune)
      glyph.position.set(x, 1.65, z)
      glyph.name = 'glyph'
      const pool = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 32), rune)
      pool.rotation.x = -Math.PI / 2
      pool.position.set(x, DECAL_Y, z)
      shrineParts.push(stone, glyph, pool)
      circles.push({ x, z, r: 0.45 })
      shrines.push({ kind, x, z, used: false, rune })
      break
    }
  }

  // what stands at a floor edge besides the wall and its columns (the checks: none, in area II)
  for (const p of placements) {
    if (p.piece === kit.wall || p.piece === kit.column || p.piece.startsWith('floor')) continue
    if (nearEdge(floor, p.x, p.z)) made.edge.push({ piece: p.piece, x: p.x, z: p.z, top: (p.y ?? 0) + pieceData(p.piece).height * (p.scale ?? 1) })
  }
  for (const m of machines) if (nearEdge(floor, m.x, m.z)) made.edge.push({ piece: m.kind, x: m.x, z: m.z, top: machineTop(m) })

  const group = buildInstanced(placements)
  for (const m of postMeshes) group.add(m)
  if (machines.length) group.add(buildMachines(machines))
  for (const b of breakables) group.add(b.mesh)
  for (const o of shrineParts) group.add(o)

  // ground under everything, so the ruins sit on something
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x151b24 })
  skin(groundMat, 'ground')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 80, spanZ + 80), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(((minI + maxI) / 2) * CELL, -0.12, ((minJ + maxJ) / 2) * CELL)
  group.add(ground)

  // --- the exits: the cold beam goes on, the warm one goes home ---
  const exitRoom = layout.rooms.find((r) => r.kind === 'exit')!
  const entranceRoom = layout.rooms.find((r) => r.kind === 'entrance')!
  // a crawl depth has only the cold beam, lit from the start; a boss depth builds what
  // exitsAfterBoss says it can open, and keeps it dark until the boss is down
  const exits: ExitKind[] = opts.boss ? exitsAfterBoss(depth) : ['cold']
  const cold = exits.includes('cold') ? makeBeam(COLD_BEAM, BEAM_H) : null
  if (cold) {
    cold.group.name = 'beam:cold'
    cold.group.position.set(exitRoom.center.x, 0, exitRoom.center.z)
    cold.group.visible = !opts.boss
    group.add(cold.group)
  }
  let home: THREE.Vector3 | null = null
  let warm: Beam | null = null
  if (opts.boss && exits.includes('warm')) {
    // beside the cold one, on the side away from the camera, so its stripe falls on the void
    const c = exitRoom.center
    const away = new THREE.Vector3(c.x - entranceRoom.center.x, 0, c.z - entranceRoom.center.z).normalize()
    const a = new THREE.Vector3(away.z, 0, -away.x)
    const side = a.x + a.z <= -a.x - a.z ? a : a.negate()
    home = c.clone().addScaledVector(side, WARM_OFFSET)
    warm = makeHomeBeam(BEAM_H)
    warm.group.name = 'beam:warm'
    warm.group.position.copy(home)
    warm.group.visible = false
    group.add(warm.group)
  }

  return {
    depth,
    place: place.id,
    floor,
    progressOf: progress.of,
    spineAt: progress.spineAt,
    thief,
    made,
    group,
    terrain: makeTerrainNow,
    boss: bossSpot,
    posts: square ? posts : undefined,
    footprint,
    exitOpen: !opts.boss,
    openExit() {
      if (!cold) return
      this.exitOpen = true
      cold.group.visible = true
    },
    home,
    homeOpen: false,
    openHome() {
      if (!warm) return
      this.homeOpen = true
      warm.group.visible = true
    },
    homeGlow: 1,
    packs,
    breakables,
    shrines,
    smash(b) {
      b.broken = true
      b.circle.dead = true
      b.mesh.removeFromParent()
    },
    rooms: layout.rooms,
    entrance: entranceRoom.center.clone(),
    exit: exitRoom.center.clone(),
    update(t) {
      for (const o of shrineParts) if (o.name === 'glyph') o.rotation.y = t * 0.8
      cold?.update(t)
      warm?.update(t, this.homeGlow)
    },
    dispose() {
      group.removeFromParent()
      // kit geometry and materials are shared across levels; only this level's own things go
      ground.geometry.dispose()
      groundMat.dispose()
      cold?.dispose()
      warm?.dispose()
      for (const sh of shrines) sh.rune.dispose()
      // the machines' shapes are shared; only their instance buffers are this level's
      group.traverse((o) => { if (o instanceof THREE.InstancedMesh) o.dispose() })
    },
  }
}

// --- the walk home -------------------------------------------------------------------

/** The walk home (§6.4): a start room, a short path up the screen, the yard, and the lit house. */
const WALK = {
  path: [[-1, 0], [-2, 0], [-3, 0], [-3, -1], [-3, -2], [-4, -2], [-5, -2], [-5, -3], [-5, -4], [-6, -4]] as [number, number][],
  yard: { i: [-8, -6] as [number, number], j: [-6, -4] as [number, number] },
  house: { i: [-8, -6] as [number, number], j: [-9, -7] as [number, number] },
  /** G10: intact furniture, two in the start room and two in the yard, clear of the path and the door. */
  furniture: [[-3, 3], [3, 3], [-31, -17], [-25, -21]] as [number, number][],
  /** The door zone and where Grace's light ends up inside. The house's south face is at z = -26. */
  door: new THREE.Vector3(-28, 0, -25),
  doorRadius: 1.3,
  inside: new THREE.Vector3(-28, 2.5, -27.5),
}
/**
 * The one light: the lamp in the house is hers, and what spills from it (never a second
 * light source). A deep amber, like the warm beam's, and brighter than white, so it blooms:
 * at night's saturation any warm colour that doesn't glow reads as a flat pink.
 */
const HOUSE_WARM = new THREE.Color(0xff8a33).multiplyScalar(2.4)

/**
 * The walk home, built with a place's kit at night: no packs, no crates, no shrines,
 * nothing that can hurt or cost him. It ends at the lit house (§6.5), seen from
 * outside, where only its south and east faces show; walking into its door zone is
 * the Home ending. `house.door` is that zone.
 */
export function generateWalkHome(seed: number, place: PlaceDef): Level {
  const kit = place.kit
  const rand = rng(seed)
  const floor = new Set<string>()
  const add = (i: number, j: number) => floor.add(key(i, j))
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) add(i, j)
  for (const [i, j] of WALK.path) add(i, j)
  for (let i = WALK.yard.i[0]; i <= WALK.yard.i[1]; i++) for (let j = WALK.yard.j[0]; j <= WALK.yard.j[1]; j++) add(i, j)
  const solid = new Set<string>()
  for (let i = WALK.house.i[0]; i <= WALK.house.i[1]; i++) for (let j = WALK.house.j[0]; j <= WALK.house.j[1]; j++) solid.add(key(i, j))
  const cells = [...floor].map((k) => k.split(',').map(Number) as [number, number])
  const placements: Placement[] = []
  const boxes: Box[] = []
  const circles: Circle[] = []
  const made: LevelMade = { props: [], tall: [], floors: [], edge: [], far: [] }
  const gen = place.gen
  // G10: the walk is the last of the quarter, at its most intact (p = 1)
  const bands = gen.floorBands
  const last = bands ? bands[bands.length - 1]!.room : null

  // dirt and broken paving: the way home is worn, not built (in the quarter, its last floors)
  for (const [i, j] of cells) {
    const roll = rand()
    const piece: Piece = last ? pickFloor(last, roll) : roll < 0.55 ? 'floor_dirt_large' : 'floor_tile_large_rocks'
    placements.push({ piece, x: i * CELL, z: j * CELL, rotY: Math.floor(rand() * 4) * (Math.PI / 2) })
    made.floors.push({ piece, p: 1, corridor: false })
  }
  buildWalls(cells, floor, kit, placements, boxes, circles, solid)
  // and a few pieces of intact furniture, two in the start room and two in the yard: solid, never breakable
  if (gen.intact) {
    const fs = stream(seed, SALT.far)
    for (const [x, z] of WALK.furniture) {
      const [piece, want] = gen.intact[Math.floor(fs() * gen.intact.length)]!
      const scale = Math.min(want, gen.coverMaxH / pieceData(piece).height)
      placements.push({ piece, x, z, rotY: Math.floor(fs() * 4) * (Math.PI / 2), scale })
      circles.push({ x, z, r: pieceData(piece).radius * scale * 0.8 })
      made.props.push({ piece, x, z, top: pieceData(piece).height * scale, p: 1, breakable: false, intact: true, room: -1 })
    }
  }
  // the house is solid all through: he stops at its door
  const hx0 = WALK.house.i[0] * CELL - CELL / 2
  const hx1 = WALK.house.i[1] * CELL + CELL / 2
  const hz0 = WALK.house.j[0] * CELL - CELL / 2
  const hz1 = WALK.house.j[1] * CELL + CELL / 2
  boxes.push({ minX: hx0, maxX: hx1, minZ: hz0, maxZ: hz1 + 0.5 })
  const { minI, maxI, minJ, maxJ, spanX, spanZ } = buildBeyond(cells, floor, rand, kit, placements, (x, z) => x > hx0 - 1.5 && x < hx1 + 1.5 && z > hz0 - 1.5 && z < hz1 + 1.5, {
    made, clearEdges: gen.coverMaxH < Infinity, farSide: gen.farSide, farStream: stream(seed ^ 0x1, SALT.far), pAt: () => 1,
  })

  const group = buildInstanced(placements)
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x151b24 })
  skin(groundMat, 'ground')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 80, spanZ + 80), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(((minI + maxI) / 2) * CELL, -0.12, ((minJ + maxJ) / 2) * CELL)
  group.add(ground)

  // --- the lit house: the Workshop, seen from outside ---
  const faceZ = hz1
  const faceX = hx1
  const house: Placement[] = [
    { piece: 'wall', x: -32, z: faceZ }, { piece: 'wall_doorway', x: -28, z: faceZ }, { piece: 'wall_window_open', x: -24, z: faceZ },
    // the east face spans the footprint (z -38..-26; §6.5's -38/-34/-30 left its south corner open)
    { piece: 'wall', x: faceX, z: hz0 + 2, rotY: Math.PI / 2 }, { piece: 'wall', x: faceX, z: hz0 + 6, rotY: Math.PI / 2 }, { piece: 'wall', x: faceX, z: hz0 + 10, rotY: Math.PI / 2 },
  ]
  const houseGroup = buildInstanced(house, { surface: { wall: 'wood', wall_doorway: 'wood', wall_window_open: 'wood' }, tune: { gain: 0.5 } })
  group.add(houseGroup)
  const own: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
  const keep = <T extends THREE.Mesh>(m: T) => {
    own.push({ geometry: m.geometry, material: m.material as THREE.Material })
    group.add(m)
    return m
  }
  // the door, filled with warm light spilling out; a lit window beside it
  const warmMat = new THREE.MeshBasicMaterial({ color: HOUSE_WARM, fog: false, transparent: true, opacity: 0.95 })
  const doorLight = keep(new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.75), warmMat))
  doorLight.position.set(-28, 1.375, faceZ - 0.3)
  const winLight = keep(new THREE.Mesh(new THREE.PlaneGeometry(4, 4), warmMat.clone()))
  winLight.position.set(-24, 2, faceZ - 0.62)
  // a fan of warm light on the yard in front of the door
  const fanTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')!
    // spreading from the threshold (the texture's top edge), gone before the plane's edges
    const grad = g.createRadialGradient(64, 0, 2, 64, 0, 64)
    grad.addColorStop(0, 'rgba(255, 130, 50, 0.9)')
    grad.addColorStop(0.45, 'rgba(255, 110, 40, 0.35)')
    grad.addColorStop(1, 'rgba(255, 100, 30, 0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const fanMat = new THREE.MeshBasicMaterial({ map: fanTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  const fan = keep(new THREE.Mesh(new THREE.PlaneGeometry(5, 4), fanMat))
  fan.rotation.x = -Math.PI / 2
  fan.position.set(-28, DECAL_Y, faceZ + 2 + 0.5)
  // roofed, so the room is only ever seen from inside; a stub of chimney
  const roof = keep(new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.4, 12.6), new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 1 })))
  roof.position.set((hx0 + hx1) / 2, 4.2, (hz0 + hz1) / 2)
  const chimney = new THREE.Mesh(pieceData('pillar').geometry, pieceData('pillar').material)
  chimney.scale.setScalar(0.4)
  chimney.position.set(hx1 - 3, 4.4, hz0 + 3)
  group.add(chimney)

  const start: Room = { kind: 'entrance', ci: 0, cj: 0, rx: 1, rz: 1, center: new THREE.Vector3() }
  const yard: Room = { kind: 'exit', ci: -7, cj: -5, rx: 1, rz: 1, center: new THREE.Vector3(-28, 0, -20) }
  return {
    depth: RUN_DEPTHS_WALK,
    place: place.id,
    floor,
    // the last of the day: all the way along
    progressOf: () => 1,
    spineAt: () => null,
    made,
    group,
    terrain: makeTerrain(floor, boxes, circles),
    exitOpen: false,
    openExit() {},
    home: null,
    homeOpen: false,
    openHome() {},
    homeGlow: 1,
    packs: [],
    breakables: [],
    shrines: [],
    smash() {},
    rooms: [start, yard],
    entrance: new THREE.Vector3(0, 0, 0),
    // Grace leans toward the door on the way
    exit: WALK.door.clone(),
    house: { door: WALK.door.clone(), inside: WALK.inside.clone() },
    update(t) {
      // the light in there moves a little, as a lamp's does
      const flicker = 0.92 + 0.05 * Math.sin(t * 2.3) + 0.03 * Math.sin(t * 7.1)
      warmMat.opacity = flicker
      ;(winLight.material as THREE.MeshBasicMaterial).opacity = flicker * 0.95
    },
    dispose() {
      group.removeFromParent()
      ground.geometry.dispose()
      groundMat.dispose()
      for (const o of own) {
        o.geometry.dispose()
        o.material.dispose()
      }
      fanTex.dispose()
      for (const o of group.children) if (o instanceof THREE.InstancedMesh) o.dispose()
      for (const o of houseGroup.children) if (o instanceof THREE.InstancedMesh) o.dispose()
    },
  }
}
/** The walk home is past the last depth; nothing reads its number but the banner, and it shows none. */
const RUN_DEPTHS_WALK = 7

/**
 * A wall (the kit's barrier) on every floor edge facing nothing, and a column wherever
 * a wall turns a corner or ends. Uses no rand(). `solid` cells (the lit house) get no
 * wall on their side: they bring their own.
 */
function buildWalls(
  cells: [number, number][], floor: Set<string>, kit: KitPreset, placements: Placement[], boxes: Box[], circles: Circle[], solid?: Set<string>,
) {
  const open = (i: number, j: number) => !floor.has(key(i, j)) && !solid?.has(key(i, j))
  // vertices are grid corners; count wall edges meeting at each to place columns
  const vx = new Map<string, { along: number; across: number }>()
  const touch = (a: number, b: number, axis: 'along' | 'across') => {
    const v = vx.get(key(a, b)) ?? { along: 0, across: 0 }
    v[axis]++
    vx.set(key(a, b), v)
  }
  const h = CELL / 2
  for (const [i, j] of cells) {
    const x = i * CELL
    const z = j * CELL
    if (open(i + 1, j)) {
      placements.push({ piece: kit.wall, x: x + h, z, rotY: Math.PI / 2 })
      boxes.push({ minX: x + h - WALL_HALF, maxX: x + h + WALL_HALF, minZ: z - h, maxZ: z + h })
      touch(i + 1, j, 'across'); touch(i + 1, j + 1, 'across')
    }
    if (open(i - 1, j)) {
      placements.push({ piece: kit.wall, x: x - h, z, rotY: Math.PI / 2 })
      boxes.push({ minX: x - h - WALL_HALF, maxX: x - h + WALL_HALF, minZ: z - h, maxZ: z + h })
      touch(i, j, 'across'); touch(i, j + 1, 'across')
    }
    if (open(i, j + 1)) {
      placements.push({ piece: kit.wall, x, z: z + h })
      boxes.push({ minX: x - h, maxX: x + h, minZ: z + h - WALL_HALF, maxZ: z + h + WALL_HALF })
      touch(i, j + 1, 'along'); touch(i + 1, j + 1, 'along')
    }
    if (open(i, j - 1)) {
      placements.push({ piece: kit.wall, x, z: z - h })
      boxes.push({ minX: x - h, maxX: x + h, minZ: z - h - WALL_HALF, maxZ: z - h + WALL_HALF })
      touch(i, j, 'along'); touch(i + 1, j, 'along')
    }
  }
  // a column wherever a wall turns a corner or ends; straight runs stay plain
  for (const [k, v] of vx) {
    const [a, b] = k.split(',').map(Number) as [number, number]
    if ((v.along > 0 && v.across > 0) || v.along + v.across === 1) {
      const x = a * CELL - h
      const z = b * CELL - h
      placements.push({ piece: kit.column, x, z })
      circles.push({ x, z, r: COLUMN_R })
    }
  }

}

/**
 * The ruins beyond the walls, fading into the fog: tall only where the camera's
 * sight line past them falls on no floor, sunk rubble where it would. `avoid`
 * keeps a place clear (the lit house's footprint) without costing a rand().
 */
function buildBeyond(
  cells: [number, number][], floor: Set<string>, rand: () => number, kit: KitPreset, placements: Placement[], avoid?: (x: number, z: number) => boolean,
  more: {
    /** G6: this share of the tall picks become machinery (the Works), drawn from `stream`. */
    machines?: { kinds: MachineKind[]; share: number }
    stream?: () => number
    out?: MachinePlacement[]
    made?: LevelMade
    /** Nothing of the beyond right against a floor edge (area II: the walls stay the only thing there). Costs no rand(). */
    clearEdges?: boolean
    /** G5: upright far-side pieces, from `farStream`, more often the further along the nearest room is (`pAt`). */
    farSide?: { pieces: Piece[]; chance: [number, number] }
    farStream?: () => number
    pAt?: (x: number, z: number) => number
  } = {},
) {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!
  let minI = Infinity, maxI = -Infinity, minJ = Infinity, maxJ = -Infinity
  for (const [i, j] of cells) {
    minI = Math.min(minI, i); maxI = Math.max(maxI, i); minJ = Math.min(minJ, j); maxJ = Math.max(maxJ, j)
  }
  const nearFloor = (x: number, z: number, cellsAway: number) => {
    const ci = Math.round(x / CELL)
    const cj = Math.round(z / CELL)
    for (let i = ci - cellsAway; i <= ci + cellsAway; i++) for (let j = cj - cellsAway; j <= cj + cellsAway; j++) {
      if (floor.has(key(i, j))) return true
    }
    return false
  }
  // The camera looks from +x,+z. A tall ruin hides whatever lies behind it along
  // (-1,-1), so it's only allowed where that shadow falls on no floor.
  // `reach`: how far behind it the camera's line is blocked; 7 u covers the kit's walls, a chimney needs more
  const hidesFloor = (x: number, z: number, reach = 7) => {
    for (let s = 0; s <= reach; s += 0.75) {
      for (const side of [-1.8, 0, 1.8]) {
        const px = x - s * Math.SQRT1_2 + side * Math.SQRT1_2
        const pz = z - s * Math.SQRT1_2 - side * Math.SQRT1_2
        if (floor.has(key(Math.round(px / CELL), Math.round(pz / CELL)))) return true
      }
    }
    return false
  }
  const TALL = kit.beyondTall
  const spanX = (maxI - minI + 10) * CELL
  const spanZ = (maxJ - minJ + 10) * CELL
  const ruinCount = Math.floor((spanX * spanZ) / 90)
  for (let n = 0; n < ruinCount; n++) {
    const x = (minI - 5) * CELL + rand() * spanX
    const z = (minJ - 5) * CELL + rand() * spanZ
    if (nearFloor(x, z, 0) || (nearFloor(x, z, 1) && rand() < 0.7)) continue
    const edge = !!more.clearEdges && nearEdge(floor, x, z)
    if (hidesFloor(x, z)) {
      const piece = rand() < 0.5 ? kit.beyondLow[0]! : kit.beyondLow[1]!
      const place = { piece, x, z, rotY: rand() * 6.3, y: -2.4 - rand() * 0.6, scale: 0.8 + rand() * 0.4 }
      if (!avoid?.(x, z) && !edge) placements.push(place)
    } else {
      const place = { piece: pick(TALL), x, z, rotY: rand() * 6.3, y: -rand() * 1.6, scale: 0.8 + rand() * 0.5 }
      if (avoid?.(x, z) || edge) continue
      const mc = more.machines
      if (mc && more.stream && more.out && more.stream() < mc.share) {
        // machinery instead, from its own stream: only where its taller shadow still falls on no floor
        const kind = mc.kinds[Math.floor(more.stream() * mc.kinds.length)]!
        const h = kind === 'chimney' ? CHIMNEY_H[0] + more.stream() * (CHIMNEY_H[1] - CHIMNEY_H[0]) : undefined
        const m: MachinePlacement = { kind, x, z, y: place.y, rotY: place.rotY, scale: place.scale, h }
        // the camera's 38 degrees: a top h high blocks the floor about 1.28 h behind it
        if (hidesFloor(x, z, machineTop(m) * 1.28 + 1)) continue
        more.out.push(m)
        more.made?.tall.push({ what: kind, x, z, hides: false })
        continue
      }
      placements.push(place)
      more.made?.tall.push({ what: place.piece, x, z, hides: hidesFloor(x, z) })
    }
  }
  for (let n = 0; n < ruinCount / 3; n++) {
    const x = (minI - 5) * CELL + rand() * spanX
    const z = (minJ - 5) * CELL + rand() * spanZ
    if (nearFloor(x, z, 0)) continue
    const place = { piece: kit.beyondLow[1]!, x, z, rotY: rand() * 6.3, y: -0.08 }
    if (!avoid?.(x, z)) placements.push(place)
  }
  // G5, the far side: door frames and windows still standing where rooms were, facing the floor.
  // Two cells out, never one (no frame on a wall's edge), never where the camera would lose floor.
  const fs = more.farSide
  const fr = more.farStream
  if (fs && fr) {
    for (let n = 0; n < ruinCount / 2; n++) {
      const x = (minI - 5) * CELL + fr() * spanX
      const z = (minJ - 5) * CELL + fr() * spanZ
      if (nearFloor(x, z, 1) || !nearFloor(x, z, 2) || hidesFloor(x, z) || avoid?.(x, z)) continue
      const p = more.pAt?.(x, z) ?? 1
      if (fr() >= fs.chance[0] + (fs.chance[1] - fs.chance[0]) * p) continue
      const piece = fs.pieces[Math.floor(fr() * fs.pieces.length)]!
      // its face toward the nearest floor cell, snapped to the grid
      const ci = Math.round(x / CELL)
      const cj = Math.round(z / CELL)
      let best: [number, number] | null = null
      let bestD = Infinity
      for (let i = ci - 2; i <= ci + 2; i++) for (let j = cj - 2; j <= cj + 2; j++) {
        const d = Math.hypot(i * CELL - x, j * CELL - z)
        if (floor.has(key(i, j)) && d < bestD) {
          bestD = d
          best = [i, j]
        }
      }
      const face = best ? Math.atan2(best[0] * CELL - x, best[1] * CELL - z) : 0
      const rotY = Math.round(face / (Math.PI / 2)) * (Math.PI / 2)
      placements.push({ piece, x, z, rotY })
      more.made?.far.push({ piece, x, z, p, hides: hidesFloor(x, z), cells: bestD / CELL })
    }
  }
  return { minI, maxI, minJ, maxJ, spanX, spanZ }
}

// --- the beams ---------------------------------------------------------------

/**
 * Tall enough to spot over waist-high barriers, short enough that it never paints a
 * stripe across the room behind it (the locked camera looks from +x,+z).
 */
export const BEAM_H = 9
/** Cold is the way on. */
export const COLD_BEAM = 0xcfe0ff
/** How far the warm beam stands from the arena centre, where the cold one is. */
const WARM_OFFSET = 4.5

export interface Beam {
  group: THREE.Group
  /** `glow` scales the whole beam over its breathing (the walk into the warm one). */
  update(t: number, glow?: number): void
  dispose(): void
}

/** A beam that rises well over the walls and fades out as it climbs, with a ring on the floor. */
export function makeBeam(color: number, height: number): Beam {
  const fadeUp = (() => {
    const data = new Uint8Array(64 * 4)
    for (let i = 0; i < 64; i++) {
      const v = Math.round(255 * Math.pow(1 - i / 63, 1.6))
      data.set([v, v, v, 255], i * 4)
    }
    const t = new THREE.DataTexture(data, 1, 64)
    t.needsUpdate = true
    return t
  })()
  const beamMat = new THREE.MeshBasicMaterial({
    color, map: fadeUp, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  })
  const coreMat = beamMat.clone()
  coreMat.opacity = 0.35
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, height, 16, 1, true), beamMat)
  beam.position.y = height / 2
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, height, 10, 1, true), coreMat)
  core.position.copy(beam.position)
  const padMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false })
  const pad = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 40), padMat)
  pad.rotation.x = -Math.PI / 2
  pad.position.y = DECAL_Y
  const group = new THREE.Group()
  group.add(beam, core, pad)
  return {
    group,
    update(t, glow = 1) {
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.3)
      beamMat.opacity = (0.14 + breathe * 0.08) * glow
      coreMat.opacity = (0.28 + breathe * 0.12) * glow
      padMat.opacity = (0.18 + breathe * 0.14) * glow
    },
    dispose() {
      for (const o of [beam, core, pad]) o.geometry.dispose()
      for (const m of [beamMat, coreMat, padMat]) m.dispose()
      fadeUp.dispose()
    },
  }
}

/**
 * Home: Grace's light, standing where he can walk into it. Not a second exit beam
 * tinted: flat additive peach over her lit floor went cream through ACES and the
 * grade. It's a thinner column in a deep amber that keeps its hue, soft at its
 * sides, with streaks drifting up it, motes rising through it, and a warm pool
 * breathing on the floor. The warmest thing on screen after her.
 */
/** How a light beam is drawn: its two colours, its size, how strong each layer is. */
export interface BeamStyle {
  /** The deep colour (the column's edges and the pool) and the hot one (its middle and the motes). */
  deep: number
  hot: number
  radius: [top: number, bottom: number]
  core: [top: number, bottom: number]
  shell: number
  coreStrength: number
  motes: number
  /** The motes' spiral: how far out they ride, and their size in px. */
  moteR: number
  moteSize: number
  pool: { radius: number; strength: number; ripple: number }
}
/** Grace's light, where he can walk into it. */
export const HOME_STYLE: BeamStyle = {
  deep: 0xff7a22, hot: 0xffb866, radius: [0.55, 0.78], core: [0.14, 0.2], shell: 1.35, coreStrength: 1.6,
  motes: 34, moteR: 0.55, moteSize: 4.5, pool: { radius: 1.7, strength: 0.5, ripple: 0.3 },
}

const HOME_NOISE = /* glsl */ `
  float hash3(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y);
    float b = mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y);
    return mix(a, b, f.z);
  }
`

function makeHomeBeam(height: number): Beam {
  return makeLightBeam(height, HOME_STYLE)
}

/** A textured beam of light: soft round column, streaks drifting up, rising motes, a breathing pool. */
export function makeLightBeam(height: number, st: BeamStyle): Beam {
  const uniforms = {
    uTime: { value: 0 },
    uGlow: { value: 1 },
    uAmber: { value: new THREE.Color(st.deep) },
    uHot: { value: new THREE.Color(st.hot) },
  }
  // the column: brightest where it faces the camera, gone at its silhouette, so it reads round, not a slab
  const columnMat = (strength: number, grain: number) => new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uStrength: { value: strength }, uGrain: { value: grain } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      varying float vFace;
      varying vec3 vLocal;
      void main() {
        vUv = uv;
        vLocal = position;
        vFace = abs(normalize(normalMatrix * normal).z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uGlow, uStrength, uGrain;
      uniform vec3 uAmber, uHot;
      varying vec2 vUv;
      varying float vFace;
      varying vec3 vLocal;
      ${HOME_NOISE}
      void main() {
        float y = vUv.y;
        // fades as it climbs, and sets down softly instead of cutting at the floor
        float fall = pow(1.0 - y, 1.7) * smoothstep(0.0, 0.05, y);
        float edge = pow(vFace, 1.2);
        // streaks drifting upward, sampled round the column so there's no seam
        vec2 ring = normalize(vLocal.xz + 1e-4);
        float streak = vnoise(vec3(ring * 2.6, y * 5.0 - uTime * 0.55));
        float fine = vnoise(vec3(ring * 6.0 + 3.1, y * 14.0 - uTime * 1.3));
        float tex = mix(1.0, 0.35 + 1.0 * streak * (0.55 + 0.45 * fine), uGrain);
        float breathe = 0.85 + 0.15 * sin(uTime * 1.3);
        float a = fall * edge * tex * breathe * uGlow * uStrength;
        vec3 col = mix(uAmber, uHot, edge * edge * (1.0 - y));
        gl_FragColor = vec4(col, a);
      }
    `,
  })
  const shellMat = columnMat(st.shell, 1)
  const coreMat = columnMat(st.coreStrength, 0.6)
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(st.radius[0], st.radius[1], height, 24, 1, true), shellMat)
  shell.position.y = height / 2
  const core = new THREE.Mesh(new THREE.CylinderGeometry(st.core[0], st.core[1], height * 0.8, 12, 1, true), coreMat)
  core.position.y = height * 0.4

  // motes: each rises on its own slow spiral and fades out high up; all of it in the vertex shader
  const seeds = new Float32Array(st.motes * 3)
  for (let i = 0; i < st.motes; i++) seeds.set([Math.random(), Math.random(), Math.random()], i * 3)
  const moteGeo = new THREE.BufferGeometry()
  moteGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(st.motes * 3), 3))
  moteGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3))
  // the positions are computed on the GPU: a fixed box keeps the motes from being culled
  moteGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, height / 2, 0), height)
  const moteMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uH: { value: height * 0.7 }, uPx: { value: st.moteSize * Math.min(window.devicePixelRatio, 1.5) }, uR: { value: st.moteR } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute vec3 aSeed;
      uniform float uTime, uH, uPx, uR;
      varying float vA;
      void main() {
        float k = fract(uTime * (0.07 + 0.08 * aSeed.x) + aSeed.y);
        float ang = aSeed.z * 6.2832 + uTime * (0.3 + aSeed.x * 0.5);
        float r = 0.1 + uR * aSeed.x * (1.0 - 0.4 * k);
        vec3 p = vec3(sin(ang) * r, 0.15 + k * uH, cos(ang) * r);
        vA = smoothstep(0.0, 0.08, k) * (1.0 - smoothstep(0.45, 1.0, k));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = uPx * (0.7 + 0.6 * aSeed.y);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uGlow;
      uniform vec3 uHot;
      varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.2, 1.0, d)) * vA * 0.8 * min(uGlow, 1.5);
        gl_FragColor = vec4(uHot, a);
      }
    `,
  })
  const motes = new THREE.Points(moteGeo, moteMat)

  // the pool on the floor: warm light spilling round its foot, with a slow ripple going out
  const poolMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uPoolR: { value: st.pool.radius }, uPoolA: { value: st.pool.strength }, uRipple: { value: st.pool.ripple } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main() {
        vP = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uGlow, uPoolR, uPoolA, uRipple;
      uniform vec3 uAmber, uHot;
      varying vec2 vP;
      void main() {
        float r = length(vP) / uPoolR;
        float pool = pow(1.0 - smoothstep(0.0, 1.0, r), 2.0);
        float wave = fract(uTime * 0.35);
        float ripple = exp(-pow((r - wave) * 9.0, 2.0)) * (1.0 - wave);
        float a = (pool * uPoolA + ripple * uRipple) * uGlow;
        gl_FragColor = vec4(mix(uAmber, uHot, pool * 0.6), a);
      }
    `,
  })
  const pool = new THREE.Mesh(new THREE.CircleGeometry(st.pool.radius, 48), poolMat)
  pool.rotation.x = -Math.PI / 2
  pool.position.y = DECAL_Y

  const group = new THREE.Group()
  group.add(shell, core, motes, pool)
  return {
    group,
    update(t, glow = 1) {
      // one uniforms object is shared by every material here
      uniforms.uTime.value = t
      uniforms.uGlow.value = glow
    },
    dispose() {
      for (const o of [shell, core, pool]) o.geometry.dispose()
      moteGeo.dispose()
      for (const m of [shellMat, coreMat, moteMat, poolMat]) m.dispose()
    },
  }
}
