import * as THREE from 'three'
import { DECAL_Y } from './world'
import { PARTS, type AbilityDef, type DropGate, type Tier } from './abilities'
import type { SlotName } from './still'
import type { Archetype, Pack } from './combat'
import type { Terrain } from './terrain'

/**
 * D2's structure, not D2's maths. Each archetype has a treasure class that
 * leans toward certain slots; a tier roll picks white, blue or gold; the part
 * comes from whatever of that tier isn't already on Still. Tiers mean
 * "different", never "stronger".
 */
export type DropSource = 'kill' | 'crate' | 'elite' | 'plenty' | 'boss-blue' | 'boss-gold'

export const LOOT = {
  /**
   * One pack pays out about this many parts, whatever its size: each kill rolls
   * packPayout / size. Low on purpose: a phone screen buried in beams can't show telegraphs.
   */
  packPayout: 0.66,
  /** Tier odds per source. Elites and Plenty lean toward the interesting tiers; only they can give gold. */
  odds: {
    kill: { white: 0.60, blue: 0.40, gold: 0 },
    crate: { white: 0.60, blue: 0.40, gold: 0 },
    elite: { white: 0.15, blue: 0.75, gold: 0.10 },
    plenty: { white: 0.15, blue: 0.75, gold: 0.10 },
  } as Record<'kill' | 'crate' | 'elite' | 'plenty', Record<Tier, number>>,
  pickupRadius: 1.15,
  /** A crate or barrel: sometimes a part, more often a scrap of repair. */
  crateParts: 0.1,
  crateScrap: 0.3,
  scrapHeal: 20,
}

const TREASURE: Record<Archetype, Record<SlotName, number>> = {
  // chasers are all arms and torso; ranged ones are all eyes and legs
  chaser: { head: 1, torso: 3, arms: 3, legs: 1 },
  ranged: { head: 3, torso: 1, arms: 1, legs: 3 },
  boss: { head: 1, torso: 1, arms: 1, legs: 1 },
}

export const TIER_COLOR: Record<Tier, number> = {
  white: 0xdfe6ee,
  blue: 0x6f8cff,
  // warm like Grace's light, so it's kept thin and rare; no light source of its own
  gold: 0xd9b36c,
}

function pickWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][]
  let r = Math.random() * entries.reduce((a, [, w]) => a + w, 0)
  for (const [k, w] of entries) {
    r -= w
    if (r <= 0) return k
  }
  return entries[entries.length - 1]![0]
}

/** Which parts each source may give. A 'rare' part only comes from something rare; a 'boss' part only from a boss. */
const GATES: Record<DropSource, readonly DropGate[]> = {
  kill: ['any'], crate: ['any'], elite: ['any', 'rare'], plenty: ['any', 'rare'],
  'boss-blue': ['any', 'rare', 'boss'], 'boss-gold': ['any', 'rare', 'boss'],
}

/**
 * The chance this kill drops a part: 1 when it's owed (an elite, or a side room's
 * last kill with nothing dropped yet), 0 for a boss add, otherwise the pack's
 * payout split across its members.
 */
export function dropChance(
  pack: Pick<Pack, 'size' | 'side' | 'dropped'> & { members: readonly unknown[] }, wasElite: boolean, summoned: boolean,
): number {
  if (summoned) return 0
  if (wasElite || (pack.side && pack.members.length === 0 && !pack.dropped)) return 1
  return LOOT.packPayout / Math.max(1, pack.size)
}

/**
 * Null when nothing is left to find at any tier. `taken` is everything on Still
 * or on the floor; `excludeSlot` keeps a boss's second drop off the first one's slot.
 */
export function rollPart(from: Archetype, taken: readonly AbilityDef[], source: DropSource, excludeSlot?: SlotName): AbilityDef | null {
  const on = new Set(taken.map((p) => p.id))
  const gates = GATES[source]
  const pool = PARTS.filter((p) => !on.has(p.id) && gates.includes(p.drops) && p.slot !== excludeSlot)
  if (pool.length === 0) return null

  // tier first, then fall back through the others if that tier has nothing left
  const first: Tier = source === 'boss-blue' ? 'blue' : source === 'boss-gold' ? 'gold' : pickWeighted(LOOT.odds[source])
  const order: Tier[] = source === 'boss-gold' ? ['gold', 'blue', 'white'] : [first, 'blue', 'white', 'gold']
  for (const tier of order) {
    const tierPool = pool.filter((p) => p.tier === tier)
    if (tierPool.length === 0) continue
    const slotWeights = {} as Record<SlotName, number>
    for (const p of tierPool) slotWeights[p.slot] = TREASURE[from][p.slot]
    const slot = pickWeighted(slotWeights)
    const options = tierPool.filter((p) => p.slot === slot)
    return options[Math.floor(Math.random() * options.length)]!
  }
  return null
}

export interface GroundPart {
  def: AbilityDef
  pos: THREE.Vector3
  group: THREE.Group
  /** The pop out of the enemy: counts down to landing. */
  fly: number
  from: THREE.Vector3
  bob: number
}

const FLY = 0.42

export class Loot {
  readonly ground: GroundPart[] = []
  /** Repair scrap on the floor: walked over, not taken. */
  private scraps: { mesh: THREE.Mesh; pos: THREE.Vector3; bob: number }[] = []
  private readonly scrapGeo = new THREE.TorusGeometry(0.16, 0.06, 6, 10)
  private readonly scrapMat = new THREE.MeshBasicMaterial({ color: 0x9fd8c4 })
  private readonly beamGeo = new THREE.CylinderGeometry(0.07, 0.16, 5, 8, 1, true)
  private readonly chunkGeo = new THREE.BoxGeometry(0.38, 0.3, 0.38)
  private readonly discGeo = new THREE.CircleGeometry(0.55, 24)

  /** Swapped for each level, so drops never land on the far side of a wall. */
  terrain: Terrain | null = null

  constructor(private readonly scene: THREE.Scene) {}

  drop(def: AbilityDef, at: THREE.Vector3, toward?: THREE.Vector3) {
    const color = TIER_COLOR[def.tier]
    const group = new THREE.Group()

    const chunk = new THREE.Mesh(this.chunkGeo, new THREE.MeshStandardMaterial({
      color: 0x3a4b61, emissive: color, emissiveIntensity: 0.55, roughness: 0.5, metalness: 0.4,
    }))
    chunk.position.y = 0.35
    chunk.name = 'chunk'

    const beamMat = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: def.tier === 'white' ? 0.18 : 0.34,
      depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    })
    const beam = new THREE.Mesh(this.beamGeo, beamMat)
    beam.position.y = 2.5

    const disc = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.3, depthWrite: false,
    }))
    disc.rotation.x = -Math.PI / 2
    disc.position.y = DECAL_Y

    group.add(chunk, beam, disc)

    // land a short hop away from where it fell, never through a wall
    const a = toward
      ? Math.atan2(toward.x - at.x, toward.z - at.z) + (Math.random() - 0.5) * 1.6
      : Math.random() * Math.PI * 2
    const dist = 0.8 + Math.random() * 0.8
    const tx = at.x + Math.sin(a) * dist
    const tz = at.z + Math.cos(a) * dist
    const land = this.terrain ? this.terrain.clampMove(at.x, at.z, tx, tz, 0.35) : { x: tx, z: tz }
    const pos = new THREE.Vector3(land.x, 0, land.z)

    group.position.copy(at)
    this.scene.add(group)
    this.ground.push({ def, pos, group, fly: FLY, from: at.clone(), bob: Math.random() * 10 })
  }

  dropScrap(at: THREE.Vector3) {
    const mesh = new THREE.Mesh(this.scrapGeo, this.scrapMat)
    const pos = new THREE.Vector3(at.x, 0, at.z)
    mesh.position.set(pos.x, 0.4, pos.z)
    this.scene.add(mesh)
    this.scraps.push({ mesh, pos, bob: Math.random() * 6 })
  }

  /** Scrap Still is standing on is picked up at once. Returns how many. */
  collectScrap(at: THREE.Vector3): number {
    let n = 0
    for (let i = this.scraps.length - 1; i >= 0; i--) {
      const s = this.scraps[i]!
      if (Math.hypot(s.pos.x - at.x, s.pos.z - at.z) < 0.95) {
        this.scene.remove(s.mesh)
        this.scraps.splice(i, 1)
        n++
      }
    }
    return n
  }

  update(dt: number) {
    for (const s of this.scraps) {
      s.bob += dt * 3
      s.mesh.position.y = 0.4 + Math.sin(s.bob) * 0.08
      s.mesh.rotation.y += dt * 2
      s.mesh.rotation.x = 0.6
    }
    for (const g of this.ground) {
      g.bob += dt * 2.4
      const chunk = g.group.getObjectByName('chunk')!
      if (g.fly > 0) {
        g.fly = Math.max(0, g.fly - dt)
        const k = 1 - g.fly / FLY
        g.group.position.lerpVectors(g.from, g.pos, k)
        g.group.position.y = Math.sin(k * Math.PI) * 1.4
      } else {
        g.group.position.set(g.pos.x, 0, g.pos.z)
      }
      chunk.rotation.y += dt * 1.6
      chunk.position.y = 0.35 + Math.sin(g.bob) * 0.08
    }
  }

  /** The closest landed part Still is standing on, if any. */
  under(at: THREE.Vector3): GroundPart | null {
    let best: GroundPart | null = null
    let bestD = LOOT.pickupRadius
    for (const g of this.ground) {
      if (g.fly > 0) continue
      const d = Math.hypot(g.pos.x - at.x, g.pos.z - at.z)
      if (d < bestD) {
        bestD = d
        best = g
      }
    }
    return best
  }

  remove(g: GroundPart) {
    const i = this.ground.indexOf(g)
    if (i < 0) return
    this.ground.splice(i, 1)
    this.dispose(g)
  }

  clear() {
    for (const g of this.ground) this.dispose(g)
    this.ground.length = 0
    for (const s of this.scraps) this.scene.remove(s.mesh)
    this.scraps.length = 0
  }

  private dispose(g: GroundPart) {
    this.scene.remove(g.group)
    g.group.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose()
    })
  }
}
