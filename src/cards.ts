import type { EndingKind, RunCard } from './save'

/**
 * A run's card: the kept thing. The kid's drawing on top; along the bottom, the run's
 * strain as a pencil line, a tick where each depth began and a mark for how it
 * ended; and the caption, date, ending and depth, small in the corner. The number
 * goes in the caption, never the headline (§5.8).
 *
 * Without a drawing (no IndexedDB, or it failed) the card is its line alone: the
 * line is always there, because it's written at the ending.
 */

const PAPER = '#eae4d6'
const PENCIL = '#4b4f57'
const GRACE = '#f2a950'
const SAMPLES = '0123456789abcdefghijk'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** PLACEHOLDER words, Adrian's. */
const END_WORD: Record<EndingKind, string> = { broken: 'broke', stopped: 'stopped', home: 'home' }

/** "25 Sep · home · depth 3" */
export function caption(c: Pick<RunCard, 'date' | 'end' | 'depth'>): string {
  const [, m, d] = c.date.split('-').map(Number)
  return `${d} ${MONTHS[(m ?? 1) - 1]} · ${END_WORD[c.end]} · depth ${c.depth}`
}

/** A tiny deterministic wobble per card, so no two lines are drawn quite the same. */
function jitter(seed: string) {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  return () => {
    h = Math.imul(h ^ (h >>> 13), 1274126177)
    return ((h >>> 0) % 1000) / 1000 - 0.5
  }
}

/**
 * The strain line in its box: strain 0 at the bottom, 20 at the top, a 3 px tick at
 * each depth's start, and at the right end the ending's mark: two offset jagged
 * strokes (broken), the line sinking to a flat dot (stopped), a small dot of Grace (home).
 */
export function drawStrainLine(ctx: CanvasRenderingContext2D, card: RunCard, box: { x: number; y: number; w: number; h: number }) {
  const line = card.line ?? ''
  const s = box.h / 24
  const r = jitter(card.id)
  const yOf = (v: number) => box.y + box.h - (v / 20) * box.h
  const n = Math.max(1, line.length)
  const xOf = (i: number) => box.x + (n === 1 ? 0 : (i / (n - 1)) * box.w)
  ctx.save()
  ctx.strokeStyle = PENCIL
  ctx.lineWidth = 1.5 * s
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  for (let i = 0; i < line.length; i++) {
    const v = Math.max(0, SAMPLES.indexOf(line[i]!))
    const x = xOf(i)
    const y = yOf(v) + r() * 0.8 * s
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  if (line.length === 1) ctx.lineTo(xOf(0) + box.w * 0.02, yOf(Math.max(0, SAMPLES.indexOf(line[0]!))))
  ctx.stroke()
  // where each depth began
  ctx.lineWidth = 1 * s
  for (const m of card.marks ?? []) {
    const x = xOf(Math.min(n - 1, m))
    ctx.beginPath()
    ctx.moveTo(x, box.y + box.h + 1 * s)
    ctx.lineTo(x, box.y + box.h + 4 * s)
    ctx.stroke()
  }
  // how it ended
  const last = line.length ? Math.max(0, SAMPLES.indexOf(line[line.length - 1]!)) : 0
  const ex = xOf(n - 1)
  const ey = yOf(last)
  ctx.lineWidth = 1.5 * s
  if (card.end === 'broken') {
    for (const off of [-2.5, 2.5]) {
      ctx.beginPath()
      ctx.moveTo(ex + 2 * s, ey - 6 * s + off * s)
      ctx.lineTo(ex + 5 * s, ey - 2 * s + off * s)
      ctx.lineTo(ex + 3 * s, ey + 1 * s + off * s)
      ctx.lineTo(ex + 7 * s, ey + 5 * s + off * s)
      ctx.stroke()
    }
  } else if (card.end === 'stopped') {
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.quadraticCurveTo(ex + 4 * s, ey, ex + 6 * s, box.y + box.h)
    ctx.stroke()
    ctx.fillStyle = PENCIL
    ctx.beginPath()
    ctx.ellipse(ex + 7 * s, box.y + box.h, 2.2 * s, 1.1 * s, 0, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = GRACE
    ctx.globalAlpha = 1
    ctx.beginPath()
    ctx.arc(ex + 4 * s, ey, 3 * s, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * A card at w x h (256 x 192 on the board, 512 x 384 on the look-back screen):
 * paper, the drawing cover-fitted into the top, the line along the bottom 42/192.
 */
export function composeCard(card: RunCard, drawing: CanvasImageSource | null, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  const s = h / 192
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, w, h)
  const top = Math.round(150 * s)
  if (drawing) {
    const dw = (drawing as { width: number }).width
    const dh = (drawing as { height: number }).height
    const k = Math.max(w / dw, top / dh)
    ctx.save()
    ctx.beginPath()
    ctx.rect(0, 0, w, top)
    ctx.clip()
    ctx.drawImage(drawing, (w - dw * k) / 2, (top - dh * k) / 2, dw * k, dh * k)
    ctx.restore()
  }
  drawStrainLine(ctx, card, { x: 10 * s, y: top + 6 * s, w: w - 36 * s, h: 20 * s })
  ctx.fillStyle = '#6a6358'
  ctx.font = `600 ${Math.round(11 * s)}px 'Barlow Semi Condensed', system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(caption(card), w - 6 * s, h - 5 * s)
  return c
}
