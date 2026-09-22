import type { SlotName } from './still'

/**
 * The deckbuilder's EquipmentDefinition carried one BodyAction and no stat block.
 * That ports almost directly: one part is one ability, and the turn cost becomes
 * a cooldown. `shape` is what replaces TargetMode in real time.
 */
export type AbilityShape = 'bolt' | 'nova' | 'arc' | 'dash'

export interface AbilityDef {
  slot: SlotName
  key: string
  name: string
  cooldownMs: number
  shape: AbilityShape
  damage: number
  /** Travel or reach, in world units. Unused by nova. */
  range: number
  /** Blast or sweep width, in world units. */
  radius: number
}

export const ABILITIES: AbilityDef[] = [
  { slot: 'head', key: 'H', name: 'Focusing Lens', cooldownMs: 4200, shape: 'bolt', damage: 26, range: 13, radius: 0.85 },
  { slot: 'torso', key: 'T', name: 'Pressure Vent', cooldownMs: 6500, shape: 'nova', damage: 15, range: 0, radius: 4.3 },
  { slot: 'arms', key: 'A', name: 'Scrap Cleaver', cooldownMs: 2600, shape: 'arc', damage: 18, range: 3.1, radius: 1.5 },
  { slot: 'legs', key: 'L', name: 'Kickstart', cooldownMs: 8000, shape: 'dash', damage: 12, range: 6.4, radius: 1.2 },
]
