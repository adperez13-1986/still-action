import { grade, type World } from './world'
import { mix, applyMix, setMuted } from './audio'
import { ZOOM } from './camera'

interface Slider {
  obj: Record<string, number>
  key: string
  label: string
  min: number
  max: number
  step: number
}

const SLIDERS: Slider[] = [
  { obj: grade, key: 'exposure', label: 'exposure', min: 0.3, max: 2, step: 0.01 },
  { obj: grade, key: 'saturation', label: 'saturation', min: 0, max: 1.4, step: 0.01 },
  { obj: grade, key: 'vignette', label: 'vignette', min: 0, max: 2.5, step: 0.01 },
  { obj: grade, key: 'fogNear', label: 'fog near', min: 0, max: 100, step: 1 },
  { obj: grade, key: 'fogFar', label: 'fog far', min: 20, max: 220, step: 1 },
  { obj: grade, key: 'bloomStrength', label: 'bloom strength', min: 0, max: 1.6, step: 0.01 },
  { obj: grade, key: 'bloomThreshold', label: 'bloom threshold', min: 0, max: 1, step: 0.01 },
  { obj: grade, key: 'bloomRadius', label: 'bloom radius', min: 0, max: 1.5, step: 0.01 },
  { obj: grade, key: 'graceLight', label: "Grace's light", min: 0, max: 900, step: 5 },
  { obj: grade, key: 'viewHeight', label: 'view size', min: 8, max: 34, step: 0.5 },
  { obj: ZOOM, key: 'min', label: 'zoom: furthest out', min: 0.4, max: 1, step: 0.01 },
  { obj: ZOOM, key: 'calm', label: 'zoom: between fights', min: 0.8, max: 1.4, step: 0.01 },
  { obj: ZOOM, key: 'marginY', label: 'zoom: vertical margin', min: 0.4, max: 1, step: 0.01 },
  { obj: ZOOM, key: 'outRate', label: 'zoom: pull-back speed', min: 0.5, max: 10, step: 0.1 },
  { obj: mix, key: 'master', label: 'sound: master', min: 0, max: 1.5, step: 0.01 },
  { obj: mix, key: 'auto', label: 'sound: auto attack', min: 0, max: 1.5, step: 0.01 },
  { obj: mix, key: 'hits', label: 'sound: hits', min: 0, max: 1.5, step: 0.01 },
  { obj: mix, key: 'enemy', label: 'sound: telegraph', min: 0, max: 1.5, step: 0.01 },
  { obj: mix, key: 'abilities', label: 'sound: abilities', min: 0, max: 1.5, step: 0.01 },
  { obj: mix, key: 'music', label: 'sound: music', min: 0, max: 1.5, step: 0.01 },
]

/** Live grade tuning. The look gets decided on the phone, in motion — not in a mock. */
export function createGradePanel(root: HTMLElement, world: World) {
  const bar = document.createElement('div')
  bar.id = 'topRight'

  const full = document.createElement('button')
  full.className = 'chip'
  full.textContent = 'full'
  full.addEventListener('click', () => {
    if (document.fullscreenElement) void document.exitFullscreen?.()
    else void document.documentElement.requestFullscreen?.()
  })
  document.addEventListener('fullscreenchange', () => {
    full.classList.toggle('on', Boolean(document.fullscreenElement))
  })

  const toggle = document.createElement('button')
  toggle.className = 'chip'
  toggle.textContent = 'grade'

  const panel = document.createElement('div')
  panel.id = 'grade'

  toggle.addEventListener('click', () => {
    panel.classList.toggle('open')
    toggle.classList.toggle('on', panel.classList.contains('open'))
  })

  const mute = document.createElement('button')
  mute.className = 'chip on'
  mute.textContent = 'sound'
  mute.addEventListener('click', () => {
    const off = mute.classList.toggle('on') === false
    setMuted(off)
  })

  bar.append(mute, full, toggle)

  for (const s of SLIDERS) {
    const label = document.createElement('label')
    const value = document.createElement('span')
    const input = document.createElement('input')

    value.textContent = String(s.obj[s.key])
    label.append(s.label, value)

    input.type = 'range'
    input.min = String(s.min)
    input.max = String(s.max)
    input.step = String(s.step)
    input.value = String(s.obj[s.key])
    input.addEventListener('input', () => {
      s.obj[s.key] = Number(input.value)
      value.textContent = input.value
      if (s.obj === mix) applyMix()
      else apply(world)
    })

    label.appendChild(input)
    panel.appendChild(label)
  }

  const save = document.createElement('button')
  save.textContent = 'save values'
  save.addEventListener('click', async () => {
    save.textContent = 'saving...'
    try {
      const res = await Promise.all([
        fetch('/__save/grade', { method: 'POST', body: JSON.stringify(grade, null, 2) }),
        fetch('/__save/mix', { method: 'POST', body: JSON.stringify(mix, null, 2) }),
        fetch('/__save/zoom', { method: 'POST', body: JSON.stringify(ZOOM, null, 2) }),
      ])
      save.textContent = res.every((r) => r.ok) ? 'saved grade, mix, zoom .json' : 'failed'
    } catch {
      save.textContent = 'failed'
    }
    setTimeout(() => (save.textContent = 'save values'), 2000)
  })
  panel.appendChild(save)

  root.append(bar, panel)
  apply(world)
}

export function apply(world: World) {
  world.renderer.toneMappingExposure = grade.exposure
  world.fog.near = grade.fogNear
  world.fog.far = grade.fogFar
  world.bloom.strength = grade.bloomStrength
  world.bloom.threshold = grade.bloomThreshold
  world.bloom.radius = grade.bloomRadius
  world.graceLight.intensity = grade.graceLight
  world.gradePass.uniforms.uVignette!.value = grade.vignette
  world.gradePass.uniforms.uSaturation!.value = grade.saturation
  world.resize()
}
