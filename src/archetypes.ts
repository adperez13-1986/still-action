import type { SlotName } from './still'

/**
 * The archetype (design/archetypes/ARCHETYPES.md): who Still is for a whole run, picked at its start in the core pick's place.
 * No three.js here, so the checks and the drop simulator can read it. All words are PLACEHOLDER (WORDS below).
 */
export type ArchetypeId = 'brawler' | 'marksman' | 'summoner'
export const ARCH_IDS: readonly ArchetypeId[] = ['brawler', 'marksman', 'summoner']
export const ARCH_LIVE: readonly ArchetypeId[] = ['brawler', 'marksman', 'summoner']

/** What a part does, whatever slot it came from: the slot law reads this, never `def.slot`. */
export type Family = 'strike' | 'bolt' | 'blast' | 'guard' | 'move' | 'summon'

/** Explicit per part (a check asserts every part has one): a new part fails K-AR1 until it is placed here. */
export const FAMILY: Record<string, Family> = {
  'scrap-cleaver': 'strike', piston: 'strike', 'rusted-hook': 'strike', 'parry-clamp': 'strike', 'frayed-cleaver': 'strike', 'clamp-toss': 'strike', anvil: 'strike',
  'focusing-lens': 'bolt', flare: 'bolt', 'cracked-lens': 'bolt', 'ricochet-lens': 'bolt', 'patient-lens': 'bolt', 'signal-flare': 'bolt', 'through-line': 'bolt', 'overclocked-coil': 'bolt',
  'pressure-vent': 'blast', 'backdraft-vent': 'blast', 'chill-vent': 'blast',
  ward: 'guard', brace: 'guard', 'mirror-ward': 'guard',
  kickstart: 'move', skitter: 'move', 'skid-plates': 'move', overrun: 'move', 'frost-trail': 'move', 'spring-heels': 'move', 'plumb-line': 'move', 'borrowed-time': 'move',
  lure: 'summon', turret: 'summon',
}

/** The slot law: which families each slot of each archetype accepts. */
export const LAW: Record<ArchetypeId, Record<SlotName, Family[]>> = {
  brawler: { head: ['blast', 'guard'], torso: ['blast', 'guard'], arms: ['strike'], legs: ['move', 'strike'] },
  marksman: { head: ['bolt'], torso: ['guard', 'blast'], arms: ['bolt', 'strike'], legs: ['move'] },
  summoner: { head: ['bolt', 'summon'], torso: ['summon'], arms: ['summon', 'strike'], legs: ['move'] },
}

const ORDER: readonly SlotName[] = ['head', 'torso', 'arms', 'legs']

export const fitsSlot = (arch: ArchetypeId, partId: string, slot: SlotName): boolean => {
  const f = FAMILY[partId]
  return !!f && LAW[arch][slot].includes(f)
}

/** Every slot that may wear the part, its own slot first (so a take defaults to where it always went), else the law's order. */
export const slotsFor = (arch: ArchetypeId, partId: string, own?: SlotName): SlotName[] => {
  const all = ORDER.filter((s) => fitsSlot(arch, partId, s))
  return own && all.includes(own) ? [own, ...all.filter((s) => s !== own)] : all
}

/** The one auto an archetype keeps (the others are off): the hand is the close auto, the eye the far one. */
export const AUTO: Record<ArchetypeId, 'hand' | 'eye' | 'drone'> = { brawler: 'hand', marksman: 'eye', summoner: 'drone' }

/** The trait: Hardened takes `hardened` off every hit; Footwork is walk speed x `speed` and Move-family cooldowns x `moveCd`. */
export const TRAIT = {
  brawler: { hardened: 0.15 },
  marksman: { footwork: { speed: 1.1, moveCd: 0.75 } },
  /** Crowd: an awake enemy within `radius` u of a live summon (a Turret, Lure's decoy) goes for it instead of Still. */
  summoner: { crowd: { radius: 3 } },
} as const

/**
 * The Summoner's drone (PLACEHOLDER numbers): it hovers `follow` u behind and to his side, `height` u up, easing there at `ease` /s; every `everyS` s it pecks the nearest awake body
 * within `range` u of itself, `dmgOfEye` of the eye's hit. Enemies ignore it and it never dies.
 */
export const DRONE = { follow: 1.3, ease: 6, height: 1.2, everyS: 0.7, range: 4.5, dmgOfEye: 0.7 }

/**
 * The Turret, the Summoner's arms part (PLACEHOLDER numbers; it is not in PARTS, abilities.ts ARCH_PARTS): dropped `offset` u toward the stick, it stands `lifeS` s or until enemies deal it `hp`,
 * and every `everyS` s shoots the nearest awake body within `range` u for `damage`. One at a time.
 */
export const TURRET = { offset: 1.0, lifeS: 6, hp: 30, everyS: 0.5, range: 7, damage: 4, cooldownMs: 7000 }

/** What he wears at depth 1, in place of today's one-part start. */
export const KIT: Record<ArchetypeId, Record<SlotName, string>> = {
  brawler: { arms: 'scrap-cleaver', torso: 'pressure-vent', legs: 'kickstart', head: 'ward' },
  marksman: { head: 'focusing-lens', arms: 'flare', legs: 'skitter', torso: 'ward' },
  summoner: { head: 'focusing-lens', torso: 'lure', arms: 'turret', legs: 'kickstart' },
}

/** PLACEHOLDER: player-facing words. */
export const WORDS = {
  pickTitle: 'Choose who you are', pickIntro: 'For the whole run.',
  soon: 'soon',
  turretLine: 'Drops a turret that shoots the nearest enemy.',
  arch: {
    brawler: { name: 'Brawler', line: 'In the middle of them.', trait: 'Takes hits lighter.' },
    marksman: { name: 'Marksman', line: 'Keep your distance.', trait: 'Lighter on your feet.' },
    summoner: { name: 'Summoner', line: 'Others fight for you.', trait: 'Enemies near your summons go for them.' },
  } as Record<ArchetypeId, { name: string; line: string; trait: string }>,
}
