import type { SlotName } from './still'

/**
 * The deckbuilder's EquipmentDefinition carried one BodyAction and no stat block.
 * That ports almost directly: one part is one ability, and the turn cost becomes
 * a cooldown. `shape` is what replaces TargetMode in real time.
 */
export type AbilityShape = 'bolt' | 'nova' | 'arc' | 'dash'

/**
 * D2's tiers, repurposed: a tier is how *different* a part is, never how strong.
 * White is the plain ability, blue bends it one way, gold is a named oddity.
 */
export type Tier = 'white' | 'blue' | 'gold'

/** One behaviour change per blue or gold part. A modifier is code, not a number. */
export type Mod =
  | 'pierce' // bolt keeps going through every enemy it hits; walls still stop it
  | 'fan' // bolt fires three, spread
  | 'pull' // nova drags enemies in instead of shoving them out
  | 'hook' // arc yanks what it hits toward you
  | 'slam' // dash ends in a small blast

export interface AbilityDef {
  id: string
  slot: SlotName
  key: string
  name: string
  tier: Tier
  /** The one line the pickup card shows. */
  line: string
  mod?: Mod
  cooldownMs: number
  shape: AbilityShape
  damage: number
  /** Travel or reach, in world units. Unused by nova. */
  range: number
  /** Blast or sweep width, in world units. */
  radius: number
}

const KEYS: Record<SlotName, string> = { head: 'H', torso: 'T', arms: 'A', legs: 'L' }

function part(p: Omit<AbilityDef, 'key'>): AbilityDef {
  return { ...p, key: KEYS[p.slot] }
}

/**
 * PLACEHOLDER PARTS. Enough to feel the drop-and-swap loop, not the real list.
 * Names and behaviours are stand-ins.
 */
export const PARTS: AbilityDef[] = [
  // --- the four Still starts with ---
  part({ id: 'focusing-lens', slot: 'head', name: 'Focusing Lens', tier: 'white', line: 'A heavy bolt at the nearest enemy.', cooldownMs: 4200, shape: 'bolt', damage: 26, range: 13, radius: 0.85 }),
  part({ id: 'pressure-vent', slot: 'torso', name: 'Pressure Vent', tier: 'white', line: 'A blast around you that shoves enemies away.', cooldownMs: 6500, shape: 'nova', damage: 15, range: 0, radius: 4.3 }),
  part({ id: 'scrap-cleaver', slot: 'arms', name: 'Scrap Cleaver', tier: 'white', line: 'A wide swing at whatever is closest.', cooldownMs: 2600, shape: 'arc', damage: 18, range: 3.1, radius: 1.5 }),
  part({ id: 'kickstart', slot: 'legs', name: 'Kickstart', tier: 'white', line: 'Dash, running over anything in the way.', cooldownMs: 8000, shape: 'dash', damage: 12, range: 6.4, radius: 1.2 }),

  // --- blue: one twist each ---
  part({ id: 'cracked-lens', slot: 'head', name: 'Cracked Lens', tier: 'blue', mod: 'pierce', line: 'The bolt passes through every enemy it hits. Walls still stop it.', cooldownMs: 4600, shape: 'bolt', damage: 20, range: 15, radius: 0.7 }),
  part({ id: 'backdraft-vent', slot: 'torso', name: 'Backdraft Vent', tier: 'blue', mod: 'pull', line: 'The blast drags enemies in instead of out.', cooldownMs: 6500, shape: 'nova', damage: 12, range: 0, radius: 5.2 }),
  part({ id: 'rusted-hook', slot: 'arms', name: 'Rusted Hook', tier: 'blue', mod: 'hook', line: 'A longer, narrower swing that yanks enemies to you.', cooldownMs: 3000, shape: 'arc', damage: 14, range: 4.2, radius: 1.2 }),
  part({ id: 'skid-plates', slot: 'legs', name: 'Skid Plates', tier: 'blue', mod: 'slam', line: 'The dash ends in a small blast where you land.', cooldownMs: 8000, shape: 'dash', damage: 8, range: 5.6, radius: 1.2 }),

  // --- gold: named, odd ---
  part({ id: 'overclocked-coil', slot: 'head', name: 'Overclocked Coil', tier: 'gold', mod: 'fan', line: 'Three bolts at once, spread wide.', cooldownMs: 5000, shape: 'bolt', damage: 18, range: 12, radius: 0.75 }),
]

export const STARTING: AbilityDef[] = PARTS.filter((p) => p.tier === 'white')
