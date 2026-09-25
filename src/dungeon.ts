import * as THREE from 'three'
import { DECAL_Y } from './world'
import { buildInstanced, pieceData, skin, type Piece, type Placement } from './kit'
import type { Terrain, WallFace } from './terrain'
import type { BreachHole } from './parts'
import { ELITE_MODS, type Archetype, type EliteMod } from './combat'

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

/** A group of enemies placed together, asleep until you come near. */
export interface PackSpec {
  room: Room
  /** `face`: where a member looks while it sleeps; without one the pack faces a random way together. */
  members: { kind: Archetype; x: number; z: number; face?: { x: number; z: number } }[]
  /** The first member leads, named and with one modifier. */
  elite?: { mod: EliteMod; name: string }
  /** The pack that introduces an archetype: set up to be read, and never an elite. */
  lesson?: boolean
  /** The room's size budget, in body-equivalents, for the checks. */
  budget?: number
  /** The template it was built from (e.g. 'C+H+H'); today's packs have none. */
  template?: string
}

export interface Level {
  depth: number
  packs: PackSpec[]
  breakables: Breakable[]
  shrines: Shrine[]
  /** Break a crate: it stops being solid and its mesh goes. */
  smash: (b: Breakable) => void
  /** Boss levels: where the boss stands and what it faces. The exit stays shut until it falls. */
  boss?: { x: number; z: number; face: THREE.Vector3 }
  exitOpen: boolean
  openExit: () => void
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

/** C ram, H hulk, S sentinel; M8/M6 a swarm of mites (Step 3: until then a row with mites is today's pack). */
type Member = 'C' | 'H' | 'S' | 'M8' | 'M6'
type Row = { today: true; weight: number; members?: undefined } | { today?: false; weight: number; members: Member[] }

/**
 * Body-equivalents: what a member costs of a room's budget. A ram is half again a
 * hulk, a mite a quarter. Deeper is more varied, never more HP or damage.
 */
const BE: Record<Member, number> = { C: 1.5, H: 1, S: 1, M8: 2, M6: 1.5 }
const beOf = (ms: readonly Member[]) => ms.reduce((a, m) => a + BE[m], 0)
const kindOf = (m: Member): Archetype => (m === 'C' ? 'charger' : m === 'S' ? 'ranged' : 'chaser')

/** The first listed member leads (it becomes the elite if the pack is picked). */
const D4: Row[] = [{ members: ['C', 'H', 'H'], weight: 2 }, { members: ['C', 'H', 'S'], weight: 1 }]
const D5: Row[] = [
  { members: ['M8', 'S'], weight: 1 }, // the screen
  { members: ['C', 'C', 'H'], weight: 1 }, // bulls
  { members: ['C', 'H', 'H', 'S'], weight: 1 },
  { members: ['M6', 'H', 'H'], weight: 1 },
  { today: true, weight: 2 },
]
const D7: Row[] = [
  { members: ['C', 'M6', 'H', 'S'], weight: 1 },
  { members: ['C', 'C', 'M6'], weight: 1 },
  { members: ['M8', 'S', 'S'], weight: 1 },
  { members: ['C', 'H', 'H', 'H', 'S'], weight: 1 },
  { today: true, weight: 2 },
]
/** Per level: how many packs may hold rams or mites, rams per pack, and distinct archetypes per pack. */
const CAPS = (d: number) => d <= 4
  ? { chargerPacks: 2, swarmPacks: 1, chargersPerPack: 1, kinds: 2 }
  : d <= 6 ? { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 3 }
  : { chargerPacks: 3, swarmPacks: 2, chargersPerPack: 2, kinds: 4 }

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

export function generateLevel(depth: number, seed = Math.floor(Math.random() * 1e9), opts: { boss?: boolean } = {}): Level {
  const rand = rng(seed)
  const layout = opts.boss ? generateBossLayout(rand) : generateLayout(rand, 2 + Math.floor(rand() * 2))
  const { floor } = layout
  const placements: Placement[] = []
  const boxes: Box[] = []
  const circles: Circle[] = []
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!
  const quarter = () => Math.floor(rand() * 4) * (Math.PI / 2)

  // --- floors ---
  const cells = [...floor].map((k) => k.split(',').map(Number) as [number, number])
  for (const [i, j] of cells) {
    const corridor = layout.corridors.has(key(i, j))
    const roll = rand()
    const piece: Piece = corridor
      ? roll < 0.35 ? 'floor_dirt_large' : 'floor_tile_large'
      : roll < 0.14 ? 'floor_tile_large_rocks' : roll < 0.22 ? 'floor_dirt_large' : 'floor_tile_large'
    placements.push({ piece, x: i * CELL, z: j * CELL, rotY: quarter() })
  }

  // --- walls: a barrier on every floor edge facing nothing ---
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
    if (!floor.has(key(i + 1, j))) {
      placements.push({ piece: 'barrier', x: x + h, z, rotY: Math.PI / 2 })
      boxes.push({ minX: x + h - WALL_HALF, maxX: x + h + WALL_HALF, minZ: z - h, maxZ: z + h })
      touch(i + 1, j, 'across'); touch(i + 1, j + 1, 'across')
    }
    if (!floor.has(key(i - 1, j))) {
      placements.push({ piece: 'barrier', x: x - h, z, rotY: Math.PI / 2 })
      boxes.push({ minX: x - h - WALL_HALF, maxX: x - h + WALL_HALF, minZ: z - h, maxZ: z + h })
      touch(i, j, 'across'); touch(i, j + 1, 'across')
    }
    if (!floor.has(key(i, j + 1))) {
      placements.push({ piece: 'barrier', x, z: z + h })
      boxes.push({ minX: x - h, maxX: x + h, minZ: z + h - WALL_HALF, maxZ: z + h + WALL_HALF })
      touch(i, j + 1, 'along'); touch(i + 1, j + 1, 'along')
    }
    if (!floor.has(key(i, j - 1))) {
      placements.push({ piece: 'barrier', x, z: z - h })
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
      placements.push({ piece: 'column', x, z })
      circles.push({ x, z, r: COLUMN_R })
    }
  }

  // --- cover: a few props per room, kept off the lines between doorways ---
  const PROPS: [Piece, number][] = [['crates_stacked', 1], ['barrel_large', 0.7], ['box_large', 0.8], ['rubble_half', 0.42], ['box_stacked', 0.55], ['barrel_large', 0.7], ['box_large', 0.8]]
  const BREAKABLE = new Set<Piece>(['barrel_large', 'box_large', 'box_stacked'])
  const breakables: Breakable[] = []
  for (const room of layout.rooms) {
    if (room.kind === 'entrance' || room.kind === 'exit') continue
    const cellsIn = (2 * room.rx + 1) * (2 * room.rz + 1)
    const n = Math.round(cellsIn / 4) + Math.floor(rand() * 2)
    const maxX = room.rx * CELL + CELL / 2 - 1.4
    const maxZ = room.rz * CELL + CELL / 2 - 1.4
    const used: [number, number][] = []
    for (let tries = 0; tries < 40 && used.length < n; tries++) {
      const ox = (rand() * 2 - 1) * maxX
      const oz = (rand() * 2 - 1) * maxZ
      // corridors enter on the centre row and column: keep those lanes open
      if (Math.abs(ox) < 2.4 || Math.abs(oz) < 2.4) continue
      if (used.some(([ux, uz]) => Math.hypot(ux - ox, uz - oz) < 3.2)) continue
      used.push([ox, oz])
      const [piece, scale] = pick(PROPS)
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
    }
  }

  // --- the boss arena: four low cover walls to hide behind and to charge into, and crates ---
  let bossSpot: Level['boss']
  if (opts.boss) {
    const arena = layout.rooms.find((r) => r.kind === 'exit')!
    const entrance = layout.rooms.find((r) => r.kind === 'entrance')!
    const c = arena.center
    for (const [ox, oz, along] of [[-6.5, 0, 'z'], [6.5, 0, 'z'], [0, -6.5, 'x'], [0, 6.5, 'x']] as const) {
      const x = c.x + ox
      const z = c.z + oz
      placements.push({ piece: 'barrier_column', x, z, rotY: along === 'z' ? Math.PI / 2 : 0 })
      boxes.push(along === 'z'
        ? { minX: x - 0.35, maxX: x + 0.35, minZ: z - 2, maxZ: z + 2 }
        : { minX: x - 2, maxX: x + 2, minZ: z - 0.35, maxZ: z + 0.35 })
    }
    for (const [ox, oz] of [[-9.5, -9.5], [9.5, -9.5], [-9.5, 9.5], [9.5, 9.5], [-3.5, 10], [3.5, -10]] as const) {
      const x = c.x + ox
      const z = c.z + oz
      const piece: Piece = rand() < 0.5 ? 'barrel_large' : 'box_large'
      const scale = piece === 'barrel_large' ? 0.7 : 0.8
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
  const hidesFloor = (x: number, z: number) => {
    for (let s = 0; s <= 7; s += 0.75) {
      for (const side of [-1.8, 0, 1.8]) {
        const px = x - s * Math.SQRT1_2 + side * Math.SQRT1_2
        const pz = z - s * Math.SQRT1_2 - side * Math.SQRT1_2
        if (floor.has(key(Math.round(px / CELL), Math.round(pz / CELL)))) return true
      }
    }
    return false
  }
  const TALL: Piece[] = ['wall_broken', 'wall_broken', 'pillar', 'rubble_large', 'wall', 'barrier_column']
  const spanX = (maxI - minI + 10) * CELL
  const spanZ = (maxJ - minJ + 10) * CELL
  const ruinCount = Math.floor((spanX * spanZ) / 90)
  for (let n = 0; n < ruinCount; n++) {
    const x = (minI - 5) * CELL + rand() * spanX
    const z = (minJ - 5) * CELL + rand() * spanZ
    if (nearFloor(x, z, 0) || (nearFloor(x, z, 1) && rand() < 0.7)) continue
    if (hidesFloor(x, z)) {
      placements.push({ piece: rand() < 0.5 ? 'rubble_half' : 'floor_dirt_large_rocky', x, z, rotY: rand() * 6.3, y: -2.4 - rand() * 0.6, scale: 0.8 + rand() * 0.4 })
    } else {
      placements.push({ piece: pick(TALL), x, z, rotY: rand() * 6.3, y: -rand() * 1.6, scale: 0.8 + rand() * 0.5 })
    }
  }
  for (let n = 0; n < ruinCount / 3; n++) {
    const x = (minI - 5) * CELL + rand() * spanX
    const z = (minJ - 5) * CELL + rand() * spanZ
    if (nearFloor(x, z, 0)) continue
    placements.push({ piece: 'floor_dirt_large_rocky', x, z, rotY: rand() * 6.3, y: -0.08 })
  }

  // --- packs: one per main and side room, sized by depth, never in the entrance or exit ---
  const makeTerrainNow = makeTerrain(floor, boxes, circles)
  const packs: PackSpec[] = []
  const packRooms = layout.rooms.filter((r) => r.kind === 'main' || r.kind === 'side')
  // level 1: exactly one pack carries a ranged; deeper, more of them do
  const rangedPack = Math.floor(rand() * packRooms.length)
  // depth 2 meets the ram: one big main room holds a ram and a hulk, alone and easy to read
  const lessonRoom = depth === 2 ? pickLessonRoom(packRooms, rand) : null
  // depth 4: one or two main rooms get a ram template; the rest are today's packs
  const d4Rooms = new Set<Room>()
  if (depth === 4) {
    const mains = packRooms.filter((r) => r.kind === 'main')
    const n = 1 + (rand() < 0.5 ? 1 : 0)
    while (d4Rooms.size < Math.min(n, mains.length)) d4Rooms.add(mains.splice(Math.floor(rand() * mains.length), 1)[0]!)
  }
  const caps = CAPS(depth)
  let chargerPacks = 0
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
    if (room === lessonRoom) tpl = ['C', 'H']
    else if (d4Rooms.has(room)) tpl = fill(pickWeighted(D4, rand).members ?? [], size, Infinity)
    else if (depth >= 5) {
      const rows = (depth >= 7 ? D7 : D5).filter((row) => {
        if (row.today) return true
        const kinds = row.members.map(kindOf)
        const rams = kinds.filter((k) => k === 'charger').length
        if (rams > 0 && (room.kind === 'side' || chargerPacks >= caps.chargerPacks)) return false
        return rams <= caps.chargersPerPack && new Set(kinds).size <= caps.kinds && beOf(row.members) <= size + 1
      })
      const row = rows.length ? pickWeighted(rows, rand) : null
      // until the swarm exists, a row with mites stands in as today's pack
      if (row && !row.today && !row.members.some((m) => m === 'M8' || m === 'M6')) tpl = fill(row.members, size, caps.kinds)
    }

    if (tpl) {
      // the first member leads; everyone sits a little out from the spot, so a ram has room to stand and show its lane
      for (const m of tpl) {
        const kind = kindOf(m)
        // 12 tries in the ring, then 12 more anywhere near the spot: a big template in a hall shouldn't lose members
        for (let tries = 0; tries < 24; tries++) {
          const a = rand() * Math.PI * 2
          const r = tries < 12 ? 1.8 + rand() * 1.2 : 0.8 + rand() * 3.7
          const x = cx + Math.cos(a) * r
          const z = cz + Math.sin(a) * r
          if (makeTerrainNow.blocked(x, z, kind === 'charger' ? 0.8 : 0.7)) continue
          if (members.some((o) => Math.hypot(o.x - x, o.z - z) < 1.3)) continue
          // the lesson ram sleeps facing into the room: you walk in on its side, not its face
          const face = room === lessonRoom && kind === 'charger' ? { x: room.center.x, z: room.center.z } : undefined
          members.push({ kind, x, z, face })
          break
        }
      }
      if (members.some((m) => m.kind === 'charger')) chargerPacks++
      if (members.length) packs.push({ room, members, lesson: room === lessonRoom || undefined, budget: size, template: tpl.join('+') })
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
  const POOL: Partial<Record<Archetype, string[]>> = { charger: ['horn', 'brow', 'skull', 'hoof'] }
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

  const group = buildInstanced(placements)
  for (const b of breakables) group.add(b.mesh)
  for (const o of shrineParts) group.add(o)

  // ground under everything, so the ruins sit on something
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x151b24 })
  skin(groundMat, 'ground')
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(spanX + 80, spanZ + 80), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.set(((minI + maxI) / 2) * CELL, -0.12, ((minJ + maxJ) / 2) * CELL)
  group.add(ground)

  // --- the exit: a cold beam that rises well over the walls and fades out as it climbs ---
  // Tall enough to spot over waist-high barriers, short enough that it never paints a
  // stripe across the room behind it (the locked camera looks from +x,+z).
  const exitRoom = layout.rooms.find((r) => r.kind === 'exit')!
  const entranceRoom = layout.rooms.find((r) => r.kind === 'entrance')!
  const BEAM_H = 9
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
    color: 0xcfe0ff, map: fadeUp, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  })
  const coreMat = beamMat.clone()
  coreMat.opacity = 0.35
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, BEAM_H, 16, 1, true), beamMat)
  beam.position.set(exitRoom.center.x, BEAM_H / 2, exitRoom.center.z)
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, BEAM_H, 10, 1, true), coreMat)
  core.position.copy(beam.position)
  const padMat = new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.25, depthWrite: false })
  const pad = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.6, 40), padMat)
  pad.rotation.x = -Math.PI / 2
  pad.position.set(exitRoom.center.x, DECAL_Y, exitRoom.center.z)
  group.add(beam, core, pad)
  // a boss level's exit stays dark until the boss is down
  if (opts.boss) beam.visible = core.visible = pad.visible = false

  return {
    depth,
    group,
    terrain: makeTerrainNow,
    boss: bossSpot,
    exitOpen: !opts.boss,
    openExit() {
      this.exitOpen = true
      beam.visible = core.visible = pad.visible = true
    },
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
      const breathe = 0.5 + 0.5 * Math.sin(t * 1.3)
      beamMat.opacity = 0.14 + breathe * 0.08
      coreMat.opacity = 0.28 + breathe * 0.12
      padMat.opacity = 0.18 + breathe * 0.14
    },
    dispose() {
      group.removeFromParent()
      // kit geometry and materials are shared across levels; only this level's own things go
      for (const o of [ground, beam, core, pad]) o.geometry.dispose()
      for (const m of [groundMat, beamMat, coreMat, padMat]) m.dispose()
      for (const sh of shrines) sh.rune.dispose()
      fadeUp.dispose()
      for (const o of group.children) if (o instanceof THREE.InstancedMesh) o.dispose()
    },
  }
}
