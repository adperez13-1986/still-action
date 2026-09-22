import { grade, type World } from './world'

interface Slider {
  key: keyof typeof grade
  label: string
  min: number
  max: number
  step: number
}

const SLIDERS: Slider[] = [
  { key: 'exposure', label: 'exposure', min: 0.3, max: 2, step: 0.01 },
  { key: 'saturation', label: 'saturation', min: 0, max: 1.4, step: 0.01 },
  { key: 'vignette', label: 'vignette', min: 0, max: 2.5, step: 0.01 },
  { key: 'fogNear', label: 'fog near', min: 0, max: 40, step: 0.5 },
  { key: 'fogFar', label: 'fog far', min: 10, max: 120, step: 1 },
  { key: 'bloomStrength', label: 'bloom strength', min: 0, max: 1.6, step: 0.01 },
  { key: 'bloomThreshold', label: 'bloom threshold', min: 0, max: 1, step: 0.01 },
  { key: 'bloomRadius', label: 'bloom radius', min: 0, max: 1.5, step: 0.01 },
  { key: 'graceLight', label: "Grace's light", min: 0, max: 12, step: 0.1 },
  { key: 'viewHeight', label: 'camera zoom', min: 8, max: 34, step: 0.5 },
]

/** Live grade tuning. The look gets decided on the phone, in motion — not in a mock. */
export function createGradePanel(root: HTMLElement, world: World) {
  const toggle = document.createElement('button')
  toggle.id = 'gradeToggle'
  toggle.textContent = 'grade'

  const panel = document.createElement('div')
  panel.id = 'grade'

  toggle.addEventListener('click', () => panel.classList.toggle('open'))

  for (const s of SLIDERS) {
    const label = document.createElement('label')
    const value = document.createElement('span')
    const input = document.createElement('input')

    value.textContent = String(grade[s.key])
    label.append(s.label, value)

    input.type = 'range'
    input.min = String(s.min)
    input.max = String(s.max)
    input.step = String(s.step)
    input.value = String(grade[s.key])
    input.addEventListener('input', () => {
      grade[s.key] = Number(input.value)
      value.textContent = input.value
      apply(world)
    })

    label.appendChild(input)
    panel.appendChild(label)
  }

  const copy = document.createElement('button')
  copy.textContent = 'copy values'
  copy.addEventListener('click', async () => {
    const text = JSON.stringify(grade, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      copy.textContent = 'copied'
    } catch {
      copy.textContent = text
    }
    setTimeout(() => (copy.textContent = 'copy values'), 1400)
  })
  panel.appendChild(copy)

  root.append(toggle, panel)
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
