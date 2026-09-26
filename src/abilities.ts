import type { SlotName } from './still'

/**
 * The deckbuilder's EquipmentDefinition carried one BodyAction and no stat block.
 * That ports almost directly: one part is one ability, and the turn cost becomes
 * a cooldown. `shape` is what replaces TargetMode in real time: a code path.
 * Twelve of them; everything else is data.
 */
export type AbilityShape =
  | 'bolt'   // a projectile at a target (Lens family)
  | 'lob'    // lands `travelMs` later at a snapshot point, arcs over walls (Flare family)
  | 'nova'   // a blast around Still (Vent family, Brace)
  | 'ward'   // a shell around Still for `windowMs` that meets enemy shots (Ward, Mirror Ward)
  | 'decoy'  // a cold copy of Still that draws enemies, then bursts (Lure)
  | 'arc'    // a melee sweep that snaps to the nearest reachable target (Cleaver family, Piston)
  | 'grab'   // take the nearest enemy and throw it (Clamp Toss)
  | 'catch'  // a window that negates the next body strike and counters (Anvil)
  | 'dash'   // travel along the stick, running over things (Kickstart family)
  | 'hop'    // a short airborne travel, no damage (Skitter, Spring Heels)
  | 'anchor' // press 1 plants, press 2 snaps back (Plumb Line)
  | 'rewind' // back along the recorded path (Borrowed Time)

/**
 * D2's tiers, repurposed: a tier is how *different* a part is, never how strong.
 * White is the plain ability, blue bends it one way, gold is a named oddity.
 */
export type Tier = 'white' | 'blue' | 'gold'

/** Where a part may drop. 'rare' = elite, boss, Plenty. 'boss' = boss only. */
export type DropGate = 'any' | 'rare' | 'boss'

/**
 * One behaviour change, with its own numbers. A white has no mod. A blue has
 * exactly one. A gold's oddity is its shape, its mod, or both. Durations are ms,
 * distances are world units, cones are degrees.
 */
export type Mod =
  /** bolt: passes through every enemy (each once). Walls still stop it. */
  | { kind: 'pierce' }
  /** bolt: passes through enemies, crates and walls. Every solid crossed is breached for `breachMs` (both sides). */
  | { kind: 'pierceAll'; breachMs: number }
  /** bolt: reflects off walls up to `bounces` times. With no clear line, it takes a one-wall bank found within `bankSearch` of Still. */
  | { kind: 'bounce'; bounces: number; bankSearch: number }
  /** bolt: damage rises linearly from `minDamage` at `minS` to def.damage at `fullS` since the last cast. A pushed shot is always def.damage. */
  | { kind: 'charge'; minDamage: number; minS: number; fullS: number }
  /** bolt: `count` bolts spread `spreadRad` apart. An enemy takes at most one per cast. */
  | { kind: 'fan'; count: number; spreadRad: number }
  /** lob: everything caught is marked for `ms`. The next hit from another part on a marked enemy lands twice. */
  | { kind: 'mark'; ms: number }
  /** nova: drags enemies in, stopping `to` u from Still. */
  | { kind: 'pull'; to: number }
  /** nova: walk speed × `mul` for `ms`. Refreshes, never stacks, never touches a windup, strike or rush. */
  | { kind: 'slow'; mul: number; ms: number }
  /** nova: then for def.windowMs every hit becomes ceil(damage / perStrain) strain instead of HP. */
  | { kind: 'brace'; perStrain: number }
  /** ward: shots reaching the shell fly back at their shooter as Still's bolts, at most `max` per cast. */
  | { kind: 'reflect'; max: number; damage: number }
  /** arc: yanks every enemy hit to `to` u in front of Still. */
  | { kind: 'hook'; to: number }
  /** arc: an enemy hit during its windup has the windup cancelled and is shoved `shove` u. */
  | { kind: 'parry'; shove: number }
  /** arc: the cone follows strain. cones[0] below at[0], cones[1] below at[1], cones[2] from at[1] up. */
  | { kind: 'fray'; at: readonly [number, number]; cones: readonly [number, number, number] }
  /** grab: the landing splash shoves `splashShove`. A throw cut short by a solid adds `wallDamage` to the thrown enemy. */
  | { kind: 'toss'; splashShove: number; wallDamage: number }
  /** dash: ends in a blast at the landing point. */
  | { kind: 'slam'; radius: number; damage: number; shove: number }
  /** dash: pushed, these numbers replace the def's. Unpushed, the def's own (a short step). */
  | { kind: 'overrun'; range: number; damage: number; radius: number; shove: number; travelMs: number }
  /** dash: leaves a floor strip along the path that slows whatever stands on it. */
  | { kind: 'strip'; width: number; ms: number; mul: number }
  /** hop: may clear exactly one obstacle by stretching up to `maxRange`. A vault locks the stick for `lockMs` on landing. */
  | { kind: 'vault'; maxRange: number; lockMs: number }

/**
 * A cast's presentation identity: the pose, the voice and the castFx recipe all
 * key on it. A part's default is `def.beat`. useAbility picks the variants
 * (fray width, overrun half, plant/snap).
 */
export type BeatKey =
  | 'lens' | 'flare' | 'cracked' | 'ricochet' | 'patient' | 'signal' | 'through' | 'coil'
  | 'vent' | 'ward' | 'backdraft' | 'chill' | 'brace' | 'mirror' | 'lure'
  | 'cleaver' | 'piston' | 'hook' | 'parry' | 'fray-90' | 'fray-180' | 'fray-360' | 'toss' | 'anvil'
  | 'kick' | 'skitter' | 'skid' | 'overrun-step' | 'overrun-charge' | 'frost' | 'spring' | 'plant' | 'snap' | 'rewind'

/** Alternate icon markups the HUD swaps in by state. The base state is `icon`. */
export type IconState = 'fray-180' | 'fray-360' | 'snap'

export interface AbilityDef {
  id: string
  slot: SlotName
  /** H / T / A / L, filled by `part()`. */
  key: string
  name: string
  tier: Tier
  /** The pickup card's one line (T §6). */
  line: string
  shape: AbilityShape
  mod?: Mod
  cooldownMs: number
  /**
   * bolt/lob/arc/grab/dash (run-over)/anchor (run-over): damage per hit.
   * nova: blast. decoy: burst. catch: counter. charge mod: the full-charge value.
   */
  damage: number
  /**
   * bolt: flight distance (life = range / speed); for bounce, the path length.
   * lob: target search. arc/grab: reach (see `inReach`). dash/hop: travel.
   * decoy: draw radius. anchor: the longest snap. Unused elsewhere (0).
   */
  range: number
  /**
   * bolt: hit radius. lob: landing blast. nova: blast. ward: shell. decoy: burst.
   * catch: counter radius. dash/anchor: run-over half-width. Unused elsewhere (0).
   */
  radius: number
  /** arc: full cone width, degrees. */
  cone?: number
  /**
   * The shove this part applies, in u of slide (× knockMul). nova: the max of the
   * falloff (PART.novaShoveMin floor). arc: along the swing's aim. dash/anchor:
   * run-over knock. decoy/catch: away from the centre. grab: the throw distance.
   */
  shove?: number
  /** ward/catch/nova-brace: window. decoy: life. anchor: anchor life. rewind: history length. */
  windowMs?: number
  /** lob flight, grab flight, dash/hop/snap/rewind travel. */
  travelMs?: number
  /** decoy: how far behind Still it's placed. */
  offset?: number
  /** grab: splash radius. */
  blast?: number
  /** grab: splash damage. */
  blastDamage?: number
  /** Strain this part costs on every cast, pushed or not (a push adds its own +2 on top). */
  strain?: number
  drops: DropGate
  beat: BeatKey
  /** SVG inner markup, 24×24, stroke 2, round caps (T §6). Classes `push` / `charge` are styled by button state. */
  icon: string
  iconStates?: Partial<Record<IconState, string>>
  /** Ember dots on the button's lower rim: the price on every cast. */
  pips?: { n: number; hollow?: boolean }
}

const KEYS: Record<SlotName, string> = { head: 'H', torso: 'T', arms: 'A', legs: 'L' }

function part(p: Omit<AbilityDef, 'key' | 'drops'> & { drops?: DropGate }): AbilityDef {
  return { drops: 'any', ...p, key: KEYS[p.slot] }
}

/** Icons two parts share. */
const I = {
  vent: '<circle cx="12" cy="12" r="2.5"/><path d="M12 2.5v4M12 17.5v4M2.5 12h4M17.5 12h4M5.3 5.3l2.8 2.8M15.9 15.9l2.8 2.8M18.7 5.3l-2.8 2.8M8.1 15.9l-2.8 2.8"/>',
  cleaver: '<path d="M4 19C6 10 12 5 20 4"/><path d="M8 20.5c2.5-6 6.5-9.5 12-10.5" opacity=".55"/>',
}

/**
 * The whole pool: 30 parts, 12 shapes. Numbers are the balancer's, words and icons
 * the translator's (design/parts).
 */
export const PARTS: AbilityDef[] = [
  // ---------------- HEAD: reaches far ----------------
  part({
    id: 'focusing-lens', slot: 'head', name: 'Focusing Lens', tier: 'white', beat: 'lens',
    line: 'A heavy bolt at the nearest enemy.',
    shape: 'bolt', cooldownMs: 4200, damage: 26, range: 13, radius: 0.85,
    icon: '<circle cx="7" cy="12" r="3.5"/><path d="M11.5 12H21"/><path d="M17 8.5 21 12l-4 3.5"/>',
  }),
  part({
    id: 'flare', slot: 'head', name: 'Flare', tier: 'white', beat: 'flare',
    line: 'Lobs a burst over walls onto where the enemy was standing.',
    shape: 'lob', cooldownMs: 4200, damage: 18, range: 11, radius: 2.0, travelMs: 800,
    icon: '<path d="M3.5 18C5.5 6 13.5 4 17.5 14"/><ellipse cx="17.5" cy="18" rx="4" ry="1.8"/>',
  }),
  part({
    id: 'cracked-lens', slot: 'head', name: 'Cracked Lens', tier: 'blue', beat: 'cracked',
    line: 'The bolt passes through every enemy it hits. Walls still stop it.',
    shape: 'bolt', mod: { kind: 'pierce' }, cooldownMs: 4600, damage: 20, range: 15, radius: 0.7,
    icon: '<circle cx="6" cy="12" r="3.5"/><path d="M5 8.8 6.5 11 5 13"/><path d="M10.5 12H22"/><path d="M14.5 8.5v7M18.5 8.5v7"/>',
  }),
  part({
    id: 'ricochet-lens', slot: 'head', name: 'Ricochet Lens', tier: 'blue', beat: 'ricochet',
    line: 'A bolt that bounces off walls to reach enemies behind cover.',
    shape: 'bolt', mod: { kind: 'bounce', bounces: 2, bankSearch: 8 }, cooldownMs: 4600, damage: 18, range: 20, radius: 0.7,
    icon: '<circle cx="5" cy="5.5" r="2.5"/><path d="M7 8l5.5 11L18 8"/><path d="M15.2 8.6 18 8l.6 2.8"/><path d="M8 20.5h9"/>',
  }),
  part({
    id: 'patient-lens', slot: 'head', name: 'Patient Lens', tier: 'blue', beat: 'patient',
    line: 'Charges between shots. Push it for a full shot.',
    shape: 'bolt', mod: { kind: 'charge', minDamage: 6, minS: 1.5, fullS: 7.5 }, cooldownMs: 1500, damage: 32, range: 13, radius: 0.85,
    icon: '<circle cx="8.5" cy="12" r="5.5"/><circle cx="8.5" cy="12" r="2.2" fill="currentColor" stroke="none" class="charge"/><path d="M16 12h1M19.5 12h2.5"/>',
  }),
  part({
    id: 'signal-flare', slot: 'head', name: 'Signal Flare', tier: 'blue', beat: 'signal',
    line: 'Marks enemies where it lands. Your next part hits a marked one twice.',
    shape: 'lob', mod: { kind: 'mark', ms: 4000 }, cooldownMs: 5000, damage: 4, range: 11, radius: 2.2, travelMs: 800,
    icon: '<path d="M3 19C4.5 8 11 5 15.5 11"/><path d="M13 15v-2h2M19 13h2v2M13 19v2h2M21 19v2h-2"/>',
  }),
  part({
    id: 'through-line', slot: 'head', name: 'Through-Line', tier: 'gold', beat: 'through', drops: 'boss',
    line: 'A bolt through enemies and walls. The holes it leaves let shots through both ways.',
    shape: 'bolt', mod: { kind: 'pierceAll', breachMs: 4000 }, cooldownMs: 6000, damage: 24, range: 16, radius: 0.6,
    icon: '<path d="M2 12h18"/><path d="M17 8.5 20.5 12 17 15.5"/><path d="M10 3.5v5M14 3.5v5M10 15.5v5M14 15.5v5"/>',
  }),
  part({
    id: 'overclocked-coil', slot: 'head', name: 'Overclocked Coil', tier: 'gold', beat: 'coil', drops: 'rare',
    line: 'Three bolts at once, ready fast, but every shot adds strain.',
    shape: 'bolt', mod: { kind: 'fan', count: 3, spreadRad: 0.26 }, cooldownMs: 1200, damage: 14, range: 12, radius: 0.6,
    strain: 1, pips: { n: 1 },
    icon: '<path d="M2 9l2 6 2-6 2 6"/><path d="M11 12h10M10.5 10 20 5.5M10.5 14l9.5 4.5"/>',
  }),

  // ---------------- TORSO: works around Still ----------------
  part({
    id: 'pressure-vent', slot: 'torso', name: 'Pressure Vent', tier: 'white', beat: 'vent',
    line: 'A blast around you that shoves enemies away.',
    shape: 'nova', cooldownMs: 6500, damage: 15, range: 0, radius: 4.3, shove: 4.2,
    icon: I.vent,
  }),
  part({
    id: 'ward', slot: 'torso', name: 'Ward', tier: 'white', beat: 'ward',
    line: 'A brief shield that destroys enemy shots. Not shells.',
    shape: 'ward', cooldownMs: 7000, damage: 0, range: 0, radius: 1.8, windowMs: 1400,
    icon: '<circle cx="12" cy="12" r="8.5" stroke-dasharray="4.2 2.5"/><circle cx="12" cy="12" r="2.5"/>',
  }),
  part({
    id: 'backdraft-vent', slot: 'torso', name: 'Backdraft Vent', tier: 'blue', beat: 'backdraft',
    line: 'The blast drags enemies in instead of out.',
    shape: 'nova', mod: { kind: 'pull', to: 1.4 }, cooldownMs: 6500, damage: 12, range: 0, radius: 5.2,
    icon: '<circle cx="12" cy="12" r="2"/><path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5"/><path d="M10 5.5l2 2 2-2M10 18.5l2-2 2 2M5.5 10l2 2-2 2M18.5 10l-2 2 2 2"/>',
  }),
  part({
    id: 'chill-vent', slot: 'torso', name: 'Chill Vent', tier: 'blue', beat: 'chill',
    line: 'A cold blast that makes enemies walk slowly for a while.',
    shape: 'nova', mod: { kind: 'slow', mul: 0.5, ms: 3000 }, cooldownMs: 6500, damage: 10, range: 0, radius: 4.3,
    icon: '<path d="M12 2.5v19M3.8 7.25l16.4 9.5M3.8 16.75l16.4-9.5"/><path d="M9.5 4l2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  }),
  part({
    id: 'brace', slot: 'torso', name: 'Brace', tier: 'blue', beat: 'brace',
    line: 'For a moment, hits cost you strain instead of integrity.',
    shape: 'nova', mod: { kind: 'brace', perStrain: 8 }, cooldownMs: 9000, damage: 8, range: 0, radius: 2.6, windowMs: 800,
    pips: { n: 1, hollow: true },
    icon: '<path d="M12 2.5v8"/><path d="M8.5 7 12 10.5 15.5 7"/><path d="M4 14h16"/><path d="M6.5 18h11M9.5 21.5h5"/>',
  }),
  part({
    id: 'mirror-ward', slot: 'torso', name: 'Mirror Ward', tier: 'blue', beat: 'mirror',
    line: 'A brief shield that sends enemy shots back at whoever fired them. Not shells.',
    shape: 'ward', mod: { kind: 'reflect', max: 6, damage: 8 }, cooldownMs: 7000, damage: 0, range: 0, radius: 1.8, windowMs: 800,
    icon: '<path d="M16 3.5a9 9 0 0 1 0 17"/><path d="M3 5.5 13.5 12 3 18.5"/><path d="M4.7 15.1 3 18.5h3.8"/>',
  }),
  part({
    id: 'lure', slot: 'torso', name: 'Lure', tier: 'gold', beat: 'lure', drops: 'rare',
    line: 'Leaves a decoy of you that enemies go after, until it bursts. Push it to burst it early and leave another.',
    shape: 'decoy', cooldownMs: 12000, damage: 18, range: 12, radius: 3.0, windowMs: 3000, shove: 1.6, offset: 1.5,
    icon: '<circle cx="12" cy="6" r="2.5"/><path d="M12 8.5V11"/><path d="M8.5 11h7l-1 8.5h-5z"/><path d="M4.5 9a8 8 0 0 0 0 7M19.5 9a8 8 0 0 1 0 7"/>',
  }),

  // ---------------- ARMS: close ----------------
  part({
    id: 'scrap-cleaver', slot: 'arms', name: 'Scrap Cleaver', tier: 'white', beat: 'cleaver',
    line: 'A wide swing at whatever is closest.',
    shape: 'arc', cooldownMs: 2600, damage: 18, range: 3.1, radius: 0, cone: 120,
    icon: I.cleaver,
  }),
  part({
    id: 'piston', slot: 'arms', name: 'Piston', tier: 'white', beat: 'piston',
    line: 'A hard, narrow punch that knocks one enemy back.',
    shape: 'arc', cooldownMs: 3000, damage: 26, range: 3.4, radius: 0, cone: 40, shove: 1.6,
    icon: '<path d="M3 12h9"/><path d="M12 7.5v9"/><path d="M15 12h6"/><path d="M18 9l3 3-3 3"/><path d="M3 8.5h3M3 15.5h3"/>',
  }),
  part({
    id: 'rusted-hook', slot: 'arms', name: 'Rusted Hook', tier: 'blue', beat: 'hook',
    line: 'A long, narrow swing that yanks enemies to you.',
    shape: 'arc', mod: { kind: 'hook', to: 1.6 }, cooldownMs: 3200, damage: 12, range: 5.5, radius: 0, cone: 70,
    icon: '<path d="M4 12h13"/><path d="M17 12a3 3 0 1 0 3-3"/><path d="M7.5 8.5 4 12l3.5 3.5"/>',
  }),
  part({
    id: 'parry-clamp', slot: 'arms', name: 'Parry Clamp', tier: 'blue', beat: 'parry',
    line: 'A quick snap. Catch an enemy winding up and it breaks the attack.',
    shape: 'arc', mod: { kind: 'parry', shove: 2.5 }, cooldownMs: 3600, damage: 10, range: 2.6, radius: 0, cone: 90,
    icon: '<path d="M3 6c4.5 0 7.5 2 8.5 6M3 18c4.5 0 7.5-2 8.5-6"/><path d="M15 8.5l6 7M21 8.5l-6 7"/>',
  }),
  part({
    id: 'frayed-cleaver', slot: 'arms', name: 'Frayed Cleaver', tier: 'blue', beat: 'fray-90',
    line: 'A swing that grows wider the more strained you are.',
    shape: 'arc', mod: { kind: 'fray', at: [6, 12], cones: [90, 180, 360] }, cooldownMs: 2600, damage: 16, range: 3.1, radius: 0, cone: 90,
    icon: '<path d="M6.3 9.3A8 8 0 0 1 17.7 9.3"/><path d="M6.3 9.3 4.6 7.6M17.7 9.3l1.7-1.7"/><circle cx="12" cy="15" r="1.2"/>',
    iconStates: {
      'fray-180': '<path d="M4 15a8 8 0 0 1 16 0"/><path d="M4 15H2M20 15h2"/><circle cx="12" cy="15" r="1.2"/>',
      'fray-360': '<circle cx="12" cy="12.5" r="8"/><path d="M6.3 6.8 4.9 5.4M17.7 6.8l1.4-1.4M6.3 18.2l-1.4 1.4M17.7 18.2l1.4 1.4"/><circle cx="12" cy="12.5" r="1.2"/>',
    },
  }),
  part({
    id: 'clamp-toss', slot: 'arms', name: 'Clamp Toss', tier: 'blue', beat: 'toss',
    line: "Grabs the nearest enemy and throws it the way you're steering.",
    shape: 'grab', mod: { kind: 'toss', splashShove: 1.2, wallDamage: 12 }, cooldownMs: 4500, damage: 14, range: 2.4, radius: 0,
    shove: 5.0, blast: 1.2, blastDamage: 14, travelMs: 350,
    icon: '<path d="M3 21v-3.5l2-2M9 21v-3.5l-2-2"/><path d="M6 13C7 6.5 13 3.5 20 5"/><path d="M17.5 2.5 20 5l-2.5 2.5"/>',
  }),
  part({
    id: 'anvil', slot: 'arms', name: 'Anvil', tier: 'gold', beat: 'anvil', drops: 'rare',
    line: 'Catches the next blow that would hit you and hammers back. Shots get through.',
    shape: 'catch', cooldownMs: 6000, damage: 30, range: 0, radius: 3.0, windowMs: 900, shove: 2.0,
    icon: '<path d="M3 7h15.5c0 2.5-2 4-5 4h-.5v3.5h2.5l1.5 4.5H7l1.5-4.5H11V11H8C5 11 3 9.5 3 7z"/><path d="M19.5 3.5 21 2M21 5.5h1.5"/>',
  }),

  // ---------------- LEGS: move him ----------------
  part({
    id: 'kickstart', slot: 'legs', name: 'Kickstart', tier: 'white', beat: 'kick',
    line: 'Dash, running over anything in the way.',
    shape: 'dash', cooldownMs: 8000, damage: 12, range: 6.4, radius: 1.2, shove: 1.2, travelMs: 280,
    icon: '<path d="M4 6l6 6-6 6"/><path d="M12 6l6 6-6 6"/>',
  }),
  part({
    id: 'skitter', slot: 'legs', name: 'Skitter', tier: 'white', beat: 'skitter',
    line: "A quick little hop the way you're steering.",
    shape: 'hop', cooldownMs: 3200, damage: 0, range: 3.4, radius: 0, travelMs: 180,
    icon: '<path d="M4 18c2.5-7 9.5-7 12 0"/><path d="M13.3 16.3 16 18l1.4-2.8"/><path d="M3 21h4M14 21h4"/>',
  }),
  part({
    id: 'skid-plates', slot: 'legs', name: 'Skid Plates', tier: 'blue', beat: 'skid',
    line: 'The dash ends in a blast that shoves enemies away.',
    shape: 'dash', mod: { kind: 'slam', radius: 2.8, damage: 10, shove: 1.4 }, cooldownMs: 8000, damage: 8, range: 5.6, radius: 1.2, shove: 1.2, travelMs: 280,
    icon: '<path d="M3 6.5l5 5.5-5 5.5M9.5 6.5l5 5.5-5 5.5"/><path d="M19.5 6.5V9M19.5 15v2.5M22.5 12H20M21.6 9.9l-1.1 1.1M21.6 14.1l-1.1-1.1"/>',
  }),
  part({
    id: 'overrun', slot: 'legs', name: 'Overrun', tier: 'blue', beat: 'overrun-step',
    line: 'A short step. Push it for a long charge that hits.',
    shape: 'dash', mod: { kind: 'overrun', range: 9, damage: 22, radius: 1.4, shove: 2.4, travelMs: 300 },
    cooldownMs: 7000, damage: 0, range: 4.0, radius: 0, travelMs: 220,
    icon: '<path d="M3 7l5 5-5 5"/><path class="push" d="M11 12h9M17 8l4 4-4 4"/>',
  }),
  part({
    id: 'frost-trail', slot: 'legs', name: 'Frost Trail', tier: 'blue', beat: 'frost',
    line: 'A dash that leaves a cold track that slows enemies on it.',
    shape: 'dash', mod: { kind: 'strip', width: 1.4, ms: 3000, mul: 0.5 }, cooldownMs: 8000, damage: 0, range: 6.4, radius: 0, travelMs: 280,
    icon: '<path d="M4 3.5l4 4-4 4M11 3.5l4 4-4 4"/><path d="M2.5 17.5h19"/><path d="M5.5 15v5M10 15v5M14.5 15v5M19 15v5"/>',
  }),
  part({
    id: 'spring-heels', slot: 'legs', name: 'Spring Heels', tier: 'blue', beat: 'spring',
    line: 'A hop that clears a low wall, landing heavy on the far side.',
    shape: 'hop', mod: { kind: 'vault', maxRange: 4.6, lockMs: 300 }, cooldownMs: 4000, damage: 0, range: 3.4, radius: 0, travelMs: 300,
    icon: '<path d="M3 20C5 9 15 9 17 20"/><path d="M8.5 20.5v-4h4v4"/><path d="M14.4 18.3 17 20l1.6-2.7"/>',
  }),
  part({
    id: 'plumb-line', slot: 'legs', name: 'Plumb Line', tier: 'gold', beat: 'plant', drops: 'rare',
    line: 'Drop an anchor, then press again to snap back to it. Push it to drop a new one where you stand.',
    shape: 'anchor', cooldownMs: 9000, damage: 14, range: 10, radius: 1.0, shove: 1.2, windowMs: 5000, travelMs: 240,
    icon: '<path d="M12 2.5v8" stroke-dasharray="2 2.5"/><path d="M7.5 11.5h9L12 21z"/>',
    iconStates: { snap: '<path d="M21 12H10" stroke-dasharray="2 2.5"/><path d="M13 8.5 9.5 12l3.5 3.5"/><path d="M2.5 8h6L5.5 14z"/>' },
  }),
  part({
    id: 'borrowed-time', slot: 'legs', name: 'Borrowed Time', tier: 'gold', beat: 'rewind', drops: 'boss',
    line: 'Rewinds you a moment and undoes the hits you took. Adds strain.',
    shape: 'rewind', cooldownMs: 10000, damage: 0, range: 0, radius: 0, windowMs: 1500, travelMs: 250,
    strain: 2, pips: { n: 2 },
    icon: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5"/><path d="M3.5 3.5v5h5"/><circle cx="12" cy="12" r="1.5"/>',
  }),
]

export const byId = (id: string): AbilityDef => PARTS.find((p) => p.id === id)!

/** The kit `?depth=` hands out, and the pool the random first part comes from. */
export const STARTING: AbilityDef[] = ['focusing-lens', 'pressure-vent', 'scrap-cleaver', 'kickstart'].map(byId)
