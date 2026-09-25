/**
 * The three endings, as text. Deliberately different: HP death is a hard cut to
 * black; strain is Still stopping, and the scene stays up behind the words; home
 * is walking into Grace's light by choice, and the warm scene stays with him.
 * All three close on the same line, whatever happened.
 *
 * DRAFT COPY. The words are placeholders to feel the shape of the moment.
 */
import type { EndingKind } from './save'

export type { EndingKind }

const COPY: Record<EndingKind, { title: string; body: string }> = {
  broken: {
    title: 'Still came apart.',
    body: 'All at once. That happens.',
  },
  stopped: {
    title: 'Still slowed down, and stopped.',
    body: 'Nothing broke. It gave what it had.',
  },
  // PLACEHOLDER, Adrian's words. Walking into Grace's light by choice: the third ending.
  home: {
    title: 'Still came home.',
    body: '[Adrian writes this line.]',
  },
}

const CLOSING = 'You showed up. That was enough.'
/** PLACEHOLDER label, Adrian's word: every ending's button leads home, to the Workshop. */
const CONTINUE = 'home'
/** The button ignores taps this long after the words go up: a thumb still pressing from the fight can't skip them. */
const GUARD_MS = 1200

export interface Overlay {
  banner: (text: string) => void
  /** The Workshop: any banner showing goes at once, and none are shown until it's off again. */
  quiet: (on: boolean) => void
  /** A banner that shows even in the room (the one thing the Workshop has to say). */
  notice: (text: string) => void
  /** The words, and the button that goes on from them (home). */
  show: (kind: EndingKind, depth: number, onContinue: () => void) => void
  hide: () => void
  /** The words fade out on the way home (the room fades in behind). */
  leave: () => void
  /** The button, without the finger guard (dev checks have no real time between frames). */
  press: () => void
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
      <button type="button">${CONTINUE}</button>
    </div>
  `
  const title = end.querySelector('h1')!
  const body = end.querySelector<HTMLElement>('.body')!
  const count = end.querySelector<HTMLElement>('.count')!
  const closing = end.querySelector<HTMLElement>('.closing')!
  const again = end.querySelector('button')!

  root.append(banner, end)

  let bannerTimer = 0
  let hushed = false
  let onAgain: (() => void) | null = null
  let shownAt = 0
  again.addEventListener('click', () => {
    if (performance.now() - shownAt >= GUARD_MS) onAgain?.()
  })

  return {
    banner(text) {
      if (hushed) return
      banner.textContent = text
      banner.classList.add('show')
      clearTimeout(bannerTimer)
      bannerTimer = window.setTimeout(() => banner.classList.remove('show'), 1800)
    },

    notice(text) {
      banner.textContent = text
      banner.classList.add('show')
      clearTimeout(bannerTimer)
      bannerTimer = window.setTimeout(() => banner.classList.remove('show'), 3200)
    },

    quiet(on) {
      hushed = on
      if (on) {
        clearTimeout(bannerTimer)
        banner.classList.remove('show')
      }
    },

    show(kind, depth, cb) {
      onAgain = cb
      shownAt = performance.now()
      title.textContent = COPY[kind].title
      body.textContent = COPY[kind].body
      // the depth is the card's caption now, never the headline
      count.textContent = ''
      count.style.display = 'none'
      void depth
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

    leave() {
      onAgain = null
      end.classList.add('leaving')
    },

    press() {
      onAgain?.()
    },
  }
}
