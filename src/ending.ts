/**
 * The two endings, as text. Deliberately different: HP death is a hard cut to
 * black; strain is Still stopping, and the scene stays up behind the words.
 * Both close on the same line, whatever happened.
 *
 * DRAFT COPY. The words are placeholders to feel the shape of the moment.
 */
export type EndingKind = 'broken' | 'stopped'

const COPY: Record<EndingKind, { title: string; body: string }> = {
  broken: {
    title: 'Still came apart.',
    body: 'All at once. That happens.',
  },
  stopped: {
    title: 'Still slowed down, and stopped.',
    body: 'Nothing broke. It gave what it had.',
  },
}

const CLOSING = 'You showed up. That was enough.'

export interface Overlay {
  banner: (text: string) => void
  show: (kind: EndingKind, depth: number, onAgain: () => void) => void
  hide: () => void
}

export function createOverlay(root: HTMLElement): Overlay {
  const banner = document.createElement('div')
  banner.id = 'banner'

  const end = document.createElement('div')
  end.id = 'ending'
  end.innerHTML = `
    <div class="words">
      <h1></h1>
      <p class="body"></p>
      <p class="count"></p>
      <p class="closing"></p>
      <button type="button">again</button>
    </div>
  `
  const title = end.querySelector('h1')!
  const body = end.querySelector<HTMLElement>('.body')!
  const count = end.querySelector<HTMLElement>('.count')!
  const closing = end.querySelector<HTMLElement>('.closing')!
  const again = end.querySelector('button')!

  root.append(banner, end)

  let bannerTimer = 0
  let onAgain: (() => void) | null = null
  again.addEventListener('click', () => onAgain?.())

  return {
    banner(text) {
      banner.textContent = text
      banner.classList.add('show')
      clearTimeout(bannerTimer)
      bannerTimer = window.setTimeout(() => banner.classList.remove('show'), 1800)
    },

    show(kind, depth, cb) {
      onAgain = cb
      title.textContent = COPY[kind].title
      body.textContent = COPY[kind].body
      count.textContent = `reached depth ${depth}`
      closing.textContent = CLOSING
      banner.classList.remove('show')
      end.className = kind
      // next frame, so the transition actually runs
      requestAnimationFrame(() => requestAnimationFrame(() => end.classList.add('show')))
    },

    hide() {
      onAgain = null
      end.className = ''
    },
  }
}
