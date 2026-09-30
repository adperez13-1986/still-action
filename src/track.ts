/**
 * The roundhouse's yard of track, as pure numbers (design/area3/STAGE-C.md §2.1, SPEC §7.2): the loop the Engine runs, the four arms
 * a thrown lever sends it down, the levers, and phase 2's two spurs. No three.js: tools and checks import this too.
 * "Right" and "left" are screen sides: screen-right is world (1, 0, -1).
 */

export interface Pt { x: number; z: number }
export type Side = 'right' | 'left'

export interface TrackArm {
  side: Side; kind: 'a' | 'b'
  /** The loop direction it is taken from: 'a' arms with dir +1, 'b' arms with dir -1. */
  dir: 1 | -1
  /** The loop vertex it leaves from straight on (its junction), and its buffer end. */
  vertex: number; junction: Pt; buffer: Pt; len: number
}

export interface TrackDef {
  c: Pt
  /** SPEC §7.2's 8 vertices, absolute, in dir +1 order. */
  loop: Pt[]
  /** Path distance of each vertex from vertex 0 along dir +1; loopLen = 64.97 (SPEC), summed from the vertices. */
  vertexS: number[]; loopLen: number
  /** Right a, right b, left a, left b, as SPEC §7.2's table. */
  arms: TrackArm[]
  levers: Record<Side, Pt>
  /** Phase 2's two spurs: `outer` at 13 from c, `onLoop` at 9, on the axis across the entrance. */
  spurs: { outer: Pt; onLoop: Pt }[]
  spurAxis: 'x' | 'z'
}

/** Vertex i of a loop (wrapping), the one place the indexed access is asserted. */
const vert = (loop: readonly Pt[], i: number): Pt => loop[i % loop.length]!

/** SPEC §7.2, relative to c. */
export const TRACK = {
  loop: [[-6, -9], [6, -9], [9, -6], [9, 6], [6, 9], [-6, 9], [-9, 6], [-9, -6]] as const,
  arms: [
    { side: 'right', kind: 'a', dir: 1, vertex: 1, buffer: [12.4, -9] },
    { side: 'right', kind: 'b', dir: -1, vertex: 2, buffer: [9, -12.4] },
    { side: 'left', kind: 'a', dir: 1, vertex: 5, buffer: [-12.4, 9] },
    { side: 'left', kind: 'b', dir: -1, vertex: 6, buffer: [-9, 12.4] },
  ] as const,
  levers: { right: [11.3, -11.3], left: [-11.3, 11.3] } as const,
  spur: { outer: 13, onLoop: 9 },
  bufferR: 0.6, leverR: 0.3,
}

/** The track round (cx, cz). `spurAxis` is 'z' when the entrance lies along x from c, else 'x' (the spurs run across the entrance). */
export function makeTrack(cx: number, cz: number, spurAxis: 'x' | 'z'): TrackDef {
  const at = (p: readonly [number, number]): Pt => ({ x: cx + p[0], z: cz + p[1] })
  const loop = TRACK.loop.map(at)
  const vertexS: number[] = []
  let loopLen = 0
  for (let i = 0; i < loop.length; i++) {
    vertexS.push(loopLen)
    const a = vert(loop, i), b = vert(loop, i + 1)
    loopLen += Math.hypot(b.x - a.x, b.z - a.z)
  }
  const arms = TRACK.arms.map((a): TrackArm => {
    const junction = vert(loop, a.vertex), buffer = at(a.buffer)
    return { side: a.side, kind: a.kind, dir: a.dir, vertex: a.vertex, junction, buffer, len: Math.hypot(buffer.x - junction.x, buffer.z - junction.z) }
  })
  const { outer, onLoop } = TRACK.spur
  const spur = (sign: 1 | -1) => spurAxis === 'z'
    ? { outer: { x: cx, z: cz + sign * outer }, onLoop: { x: cx, z: cz + sign * onLoop } }
    : { outer: { x: cx + sign * outer, z: cz }, onLoop: { x: cx + sign * onLoop, z: cz } }
  return {
    c: { x: cx, z: cz }, loop, vertexS, loopLen, arms,
    levers: { right: at(TRACK.levers.right), left: at(TRACK.levers.left) },
    spurs: [spur(-1), spur(1)], spurAxis,
  }
}

/** The loop at path distance s (wrapped into [0, loopLen)): the point and the unit direction of dir +1. */
export function loopAt(t: TrackDef, s: number): { x: number; z: number; dx: number; dz: number } {
  const w = ((s % t.loopLen) + t.loopLen) % t.loopLen
  let i = t.vertexS.length - 1
  while (t.vertexS[i]! > w) i--
  const a = vert(t.loop, i), b = vert(t.loop, i + 1)
  const len = Math.hypot(b.x - a.x, b.z - a.z), dx = (b.x - a.x) / len, dz = (b.z - a.z) / len
  const u = w - t.vertexS[i]!
  return { x: a.x + dx * u, z: a.z + dz * u, dx, dz }
}

/** Distance from (x, z) to the segment a-b, and how far along a-b (0..len) the nearest point is. */
function toSegment(x: number, z: number, a: Pt, b: Pt): { d: number; u: number } {
  const ex = b.x - a.x, ez = b.z - a.z, len = Math.hypot(ex, ez)
  const u = Math.max(0, Math.min(len, ((x - a.x) * ex + (z - a.z) * ez) / len))
  return { d: Math.hypot(x - (a.x + (ex / len) * u), z - (a.z + (ez / len) * u)), u }
}

/** The loop parameter nearest (x, z). */
export function loopS(t: TrackDef, x: number, z: number): number {
  let best = Infinity, bestS = 0
  for (let i = 0; i < t.loop.length; i++) {
    const { d, u } = toSegment(x, z, vert(t.loop, i), vert(t.loop, i + 1))
    if (d < best) { best = d; bestS = t.vertexS[i]! + u }
  }
  return bestS
}

export function armFor(t: TrackDef, side: Side, dir: 1 | -1): TrackArm {
  return t.arms.find((a) => a.side === side && a.dir === dir)!
}

/** Distance from (x, z) to the nearest centre line of the loop, an arm or a spur. */
export function distToTrack(t: TrackDef, x: number, z: number): number {
  let best = Infinity
  for (let i = 0; i < t.loop.length; i++) best = Math.min(best, toSegment(x, z, vert(t.loop, i), vert(t.loop, i + 1)).d)
  for (const a of t.arms) best = Math.min(best, toSegment(x, z, a.junction, a.buffer).d)
  for (const s of t.spurs) best = Math.min(best, toSegment(x, z, s.outer, s.onLoop).d)
  return best
}
