import type { AbilityDef, AbilityShape } from './abilities'

/**
 * The pause screen. Two modes, one layout language:
 *   loadout  — the four parts on Still right now, and what each one does
 *   compare  — the part on the floor next to the one it would replace
 *
 * Differences are marked, never judged: a tier is "different", not "better",
 * so there is no green-good / red-bad here.
 */
const SLOT_LABEL = { head: 'Head', torso: 'Torso', arms: 'Arms', legs: 'Legs' }
const REACH_LABEL: Record<AbilityShape, string> = { bolt: 'range', nova: 'radius', arc: 'reach', dash: 'distance' }

function reach(d: AbilityDef) {
  return d.shape === 'nova' ? d.radius : d.range
}

function stats(d: AbilityDef, other?: AbilityDef) {
  const row = (label: string, value: string, changed: boolean) =>
    `<div class="stat${changed ? ' changed' : ''}"><span>${label}</span><b>${value}</b></div>`
  return [
    row('cooldown', `${(d.cooldownMs / 1000).toFixed(1)}s`, !!other && other.cooldownMs !== d.cooldownMs),
    row('damage', String(d.damage), !!other && other.damage !== d.damage),
    row(REACH_LABEL[d.shape], String(reach(d)), !!other && reach(other) !== reach(d)),
  ].join('')
}

function card(d: AbilityDef, tag: string, other?: AbilityDef) {
  return `
    <div class="pcard tier-${d.tier}">
      <div class="tag">${tag}</div>
      <div class="pname">${d.name}</div>
      <p class="pline">${d.line}</p>
      <div class="stats">${stats(d, other)}</div>
    </div>`
}

export interface PauseScreen {
  readonly open: boolean
  loadout: (parts: readonly AbilityDef[], onResume: () => void) => void
  compare: (current: AbilityDef, incoming: AbilityDef, onTake: () => void, onLeave: () => void) => void
  hide: () => void
}

export function createPauseScreen(root: HTMLElement): PauseScreen {
  const el = document.createElement('div')
  el.id = 'pause'
  root.appendChild(el)
  let isOpen = false

  function show(html: string, actions: [string, string, () => void][]) {
    el.innerHTML = `${html}<div class="actions">${actions.map(([cls, label]) => `<button type="button" class="${cls}">${label}</button>`).join('')}</div>`
    for (const [cls, , cb] of actions) el.querySelector(`.${cls}`)!.addEventListener('click', cb)
    el.classList.add('show')
    isOpen = true
  }

  return {
    get open() { return isOpen },

    loadout(parts, onResume) {
      show(
        `<h2>Paused</h2><div class="row four">${parts.map((p) => card(p, SLOT_LABEL[p.slot])).join('')}</div>`,
        [['resume', 'resume', onResume]],
      )
    },

    compare(current, incoming, onTake, onLeave) {
      show(
        `<h2>${SLOT_LABEL[incoming.slot]} slot</h2>
         <div class="row two">
           ${card(current, 'on Still now', incoming)}
           <div class="arrow">&rarr;</div>
           ${card(incoming, 'on the floor', current)}
         </div>`,
        [['leave', 'leave it', onLeave], ['take', 'take it', onTake]],
      )
    },

    hide() {
      el.classList.remove('show')
      el.innerHTML = ''
      isOpen = false
    },
  }
}
