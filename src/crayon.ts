import * as THREE from 'three'
import type { Drawer, RunCard } from './save'

export { FIRST_DRAWER } from './save'

/**
 * The kids' drawings. At every ending, Yanah or Yuri redraws the run's last frame
 * in crayon: the frame read straight off the canvas, simplified the way a child
 * simplifies (big shapes, the bright thing in the middle, the dark left as paper),
 * filled in waxy strokes from a small box of colours, outlined in a wobbly broken
 * pencil. One keepsake per run, kept in IndexedDB under the card's id. Which child
 * drew it alternates (§5.8).
 *
 * Nothing here is allowed to cost the run: every failure means no drawing, and the
 * card shows its strain line alone.
 */

/** A child's hand, as the shader takes it. Which is whose is Adrian's call (placeholders). */
export interface Hand {
  /** How far the stroke wanders, in pixels at 512 wide. */
  wobble: number
  /** Edge strength that becomes a line: lower draws more lines. */
  line: number
  /** Value steps in the fill: fewer is bolder. */
  bands: number
  /** The angle the wax is laid on, radians. */
  hatch: number
  /** How much of the frame they draw: the moment, big in the middle of the page. */
  crop: number
  /** Line thickness in pixels. */
  weight: number
  /** How big they draw him, as a share of the page's height: a child draws the one it's about big. */
  size: number
  /** How much the hand shakes on a stroke, in pixels. */
  jitter: number
}

/**
 * What the moment was, for the part a child draws by hand over the washes: where he
 * stood on the frame (0..1 across and down), how it ended, the house if he was at
 * it, and whether it was day or night.
 */
export interface Moment {
  still: { x: number; y: number }
  pose: 'stand' | 'broken' | 'slumped'
  house?: { x: number; y: number }
  sky: 'sun' | 'moon'
  /** A light he was in (the warm beam): drawn round him in her colour. */
  light?: 'warm' | 'cold'
}
/** Hand A, neater; hand B, wobblier, thicker, fewer colours. PLACEHOLDER: which is Yanah's and which Yuri's. */
export const HANDS: Record<Drawer, Hand> = {
  yanah: { wobble: 1.6, line: 0.55, bands: 3, hatch: 0.6, crop: 0.62, weight: 1.6, size: 0.46, jitter: 1.2 },
  yuri: { wobble: 2.8, line: 0.65, bands: 2, hatch: -0.4, crop: 0.56, weight: 2.4, size: 0.56, jitter: 2.4 },
}

/** The drawing's width; its height follows the canvas. */
export const DRAW_W = 512
/** How wide the tiny copy the shapes are read from is: a child's resolution. */
const COARSE_W = 26
/** The card's picture: 256 x 150 above its line. The drawing is captured at this shape. */
export const CARD_ASPECT = 256 / 150

/** The box of crayons (sRGB): paper, graphite, slate, cold blue, pale blue, rust, ember, and Grace. */
const PALETTE = [0xeae4d6, 0x2a2d33, 0x5d6b7c, 0x6f9bd1, 0xb9d3ee, 0x8a5a44, 0xd9653b, 0xf2a950]
export const PAPER = PALETTE[0]!

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/**
 * §5.8's CRAYON, reworked to read as a child's drawing rather than a filter:
 * - the frame is read very soft, so only big shapes survive (no stone, no detail);
 * - the dark is left as paper: a child colours what's lit, what matters;
 * - each lit shape gets one crayon chosen by what it is, not nearest RGB: cold
 *   light in the blues, Grace's warm light in her yellow, the warm floor round her
 *   in ember and rust; graphite is only ever the pencil line, never a fill;
 * - the fill is scribbled: strokes laid at the hand's angle with paper between
 *   them, pressed harder (and crossed) where it's brightest;
 * - a wobbly, broken pencil outline goes round the big shapes only.
 * Raw bytes in and out (no colour space either way).
 */
const FRAG = /* glsl */ `
  uniform sampler2D uSrc;
  uniform vec2 uTexel;
  /** One texel of the tiny copy the shapes are read from. */
  uniform vec2 uCoarse;
  uniform float uSeed, uWobble, uLine, uBands, uHatch, uWeight;
  uniform vec3 uPalette[8];
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
  float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
  // the frame at a scale: 5 x 5 taps, spread k texels apart
  vec3 blur(vec2 uv, float k) {
    vec3 c = vec3(0.0);
    for (int i = -2; i <= 2; i++) for (int j = -2; j <= 2; j++) c += texture2D(uSrc, uv + vec2(float(i), float(j)) * uTexel * k).rgb;
    return c / 25.0;
  }
  // scribbled strokes along angle a, gap px apart, broken along their length; w (0..1) is the pressure
  float scribble(vec2 px, float a, float gap, float w, float seed) {
    vec2 q = rot(a) * px;
    float wave = (n(vec2(q.y * 0.03, seed)) - 0.5) * gap * 1.6;
    float d = abs(fract((q.x + wave) / gap) - 0.5) * 2.0;
    float line = 1.0 - smoothstep(w - 0.18, w + 0.18, d);
    // a crayon lifts now and then: gaps along the stroke
    float lift = smoothstep(0.25, 0.4, n(vec2(floor((q.x + wave) / gap) * 3.1, q.y * 0.045) + seed));
    return line * lift;
  }

  void main() {
    vec2 s = vec2(uSeed);
    vec2 px = gl_FragCoord.xy;
    // the hand wanders: slow wobble, so shapes and lines drift together
    vec2 uv = vUv + (vec2(n(vUv * 4.0 + s), n(vUv * 4.0 + s + 17.0)) - 0.5) * uWobble * 7.0 * uTexel;
    // the shapes come from the tiny copy: only what a child would see survives
    vec3 mid = blur(uv, 0.5 * uCoarse.x / uTexel.x);
    vec3 wide = blur(uv, 2.0 * uCoarse.x / uTexel.x);
    float l = lum(mid);
    float lw = lum(wide);
    // what a child draws: the ground where it's lit, pale; things that stand out, pressed hard
    float ground = smoothstep(0.14, 0.42, lw);
    float bright = smoothstep(0.04, 0.16, l - lw) * smoothstep(0.2, 0.35, l);
    float darkThing = smoothstep(0.05, 0.16, lw - l) * ground;

    vec3 paper = uPalette[0];
    vec3 col = paper;
    float warm = mid.r - mid.b;
    float coldness = mid.b / max(mid.r, 1e-3);

    // the ground: the side of a crayon, lightly, in the colour of the light on it
    vec3 gCol = (wide.b / max(wide.r, 1e-3) > 0.95) ? uPalette[4] : (lw > 0.36 ? uPalette[7] : uPalette[5]);
    float g = scribble(px, uHatch, 9.0, 0.3, s.x) * ground * 0.6;
    col = mix(col, gCol, g);

    // the things: the crayon chosen by what the light is, pressed hard, crossed where brightest
    if (bright > 0.01) {
      vec3 fill = coldness > 0.92 ? (l > 0.62 ? uPalette[4] : uPalette[3]) : (l > 0.5 ? uPalette[7] : uPalette[6]);
      float press = floor(bright * uBands + 0.5) / uBands;
      float f = scribble(px, uHatch + 0.25, 5.0, mix(0.45, 0.85, press), s.y);
      f = max(f, scribble(px, uHatch + 1.35, 6.0, 0.5, s.x + 5.0) * step(0.66, press));
      col = mix(col, fill, f * smoothstep(0.0, 0.35, bright));
    }
    // (dark things, him among them, are drawn by hand on top: see drawMoment)
    col += 0.0 * darkThing;

    // the outline: round the big shapes only, in a thick, broken, wobbly pencil
    vec2 o = uCoarse * 0.6 * uWeight;
    float k = 0.35 * uCoarse.x / uTexel.x;
    float tl = lum(blur(uv + vec2(-o.x, o.y), k)), tc = lum(blur(uv + vec2(0.0, o.y), k)), tr = lum(blur(uv + vec2(o.x, o.y), k));
    float ml = lum(blur(uv + vec2(-o.x, 0.0), k)), mr = lum(blur(uv + vec2(o.x, 0.0), k));
    float bl = lum(blur(uv + vec2(-o.x, -o.y), k)), bc = lum(blur(uv + vec2(0.0, -o.y), k)), br = lum(blur(uv + vec2(o.x, -o.y), k));
    float gx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
    float gy = (tl + 2.0 * tc + tr) - (bl + 2.0 * bc + br);
    float edge = length(vec2(gx, gy));
    float stroke = smoothstep(uLine, uLine * 1.7, edge) * smoothstep(0.3, 0.45, n(px * 0.09 + s));
    // children outline their figures, not the lighting: at this coarseness a line round
    // the light reads as a smudge, so the washes go unlined (drawMoment's figures have theirs)
    col = mix(col, uPalette[1], 0.0 * stroke);

    // the paper's tooth
    col *= 0.965 + 0.035 * n(px * 1.3);
    gl_FragColor = vec4(col, 1.0);
  }
`

// --- the hand-drawn part: what a child actually draws ---------------------------------

const hex = (h: number) => `#${h.toString(16).padStart(6, '0')}`
const INK = { graphite: hex(PALETTE[1]!), slate: hex(PALETTE[2]!), blue: hex(PALETTE[3]!), pale: hex(PALETTE[4]!), rust: hex(PALETTE[5]!), ember: hex(PALETTE[6]!), grace: hex(PALETTE[7]!) }

/** A small seeded random: the same card always draws the same way. */
function hand(seed: number) {
  let t = (Math.floor(seed * 1000) >>> 0) || 1
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let x = t
    x = Math.imul(x ^ (x >>> 15), x | 1)
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

type Pt = [number, number]

/**
 * A crayon line: the path resampled every few pixels and shaken a little, drawn in
 * two passes of short segments that skip now and then, the way wax catches on paper.
 */
function crayonLine(g: CanvasRenderingContext2D, pts: Pt[], color: string, width: number, shake: number, r: () => number) {
  const dense: Pt[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i]!
    const [bx, by] = pts[i + 1]!
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 3))
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n])
  }
  dense.push(pts[pts.length - 1]!)
  g.save()
  g.strokeStyle = color
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let pass = 0; pass < 2; pass++) {
    let wx = 0, wy = 0
    for (let i = 0; i < dense.length - 1; i++) {
      // the hand drifts slowly, not per pixel
      wx += (r() - 0.5) * shake * 0.5
      wy += (r() - 0.5) * shake * 0.5
      wx *= 0.85
      wy *= 0.85
      if (r() < 0.06) continue
      const [ax, ay] = dense[i]!
      const [bx, by] = dense[i + 1]!
      g.globalAlpha = 0.55 + r() * 0.4
      g.lineWidth = width * (0.75 + r() * 0.45)
      g.beginPath()
      g.moveTo(ax + wx + pass * 0.6, ay + wy)
      g.lineTo(bx + wx + pass * 0.6, by + wy)
      g.stroke()
    }
  }
  g.restore()
}

/** A scribbled fill inside a shape: zigzag strokes back and forth across it, clipped to it. */
function scribbleFill(g: CanvasRenderingContext2D, path: Path2D, box: [number, number, number, number], color: string, gap: number, width: number, shake: number, r: () => number) {
  const [x0, y0, x1, y1] = box
  g.save()
  g.clip(path)
  const pts: Pt[] = []
  let flip = false
  for (let y = y0 - gap; y <= y1 + gap; y += gap * (0.8 + r() * 0.4)) {
    pts.push(flip ? [x1 + 4, y] : [x0 - 4, y + gap * 0.5])
    flip = !flip
  }
  crayonLine(g, pts, color, width, shake, r)
  g.restore()
}

const circle = (x: number, y: number, rad: number, n = 18): Pt[] =>
  Array.from({ length: n + 1 }, (_, i) => [x + Math.cos((i / n) * Math.PI * 2) * rad, y + Math.sin((i / n) * Math.PI * 2) * rad] as Pt)

/**
 * Still, as a child draws him: the round lens on its stalk with his cold eye, the
 * cage with its little light, bird legs, the clamp and the hook. Standing in the
 * light; in pieces; or slumped, his eye out.
 */
function drawStill(g: CanvasRenderingContext2D, cx: number, base: number, h: number, pose: Moment['pose'], hd: Hand, r: () => number) {
  let u = h / 10
  const lw = Math.max(2, u * 0.32) * (hd.weight / 1.6)
  const sh = hd.jitter
  const line = (pts: Pt[], c = INK.graphite, w = lw) => crayonLine(g, pts, c, w, sh, r)
  const eyeColor = pose === 'slumped' ? INK.slate : INK.blue
  if (pose === 'broken') {
    // the pieces, where they fell: the lens, the cage, a leg, the clamp, all a little apart
    // (drawn bigger than whole: lying down they'd be too small to read)
    u *= 1.5
    const head: Pt = [cx - u * 2.6, base - u * 0.9]
    line(circle(head[0], head[1], u * 0.9))
    line(circle(head[0] + u * 0.2, head[1], u * 0.35, 10), INK.slate, lw * 0.9)
    const cage = new Path2D()
    cage.rect(cx - u * 0.9, base - u * 2.2, u * 1.9, u * 2.0)
    scribbleFill(g, cage, [cx - u, base - u * 2.3, cx + u * 1.1, base], INK.pale, lw * 1.2, lw * 0.8, sh, r)
    line([[cx - u * 0.9, base - u * 0.2], [cx - u * 0.9, base - u * 2.2], [cx + u, base - u * 2.2], [cx + u, base - u * 0.2], [cx - u * 0.9, base - u * 0.2]])
    for (const k of [-0.35, 0.35]) line([[cx + u * k, base - u * 2.2], [cx + u * k, base - u * 0.2]], INK.graphite, lw * 0.7)
    line([[cx + u * 1.8, base - u * 0.3], [cx + u * 3.2, base - u * 1.1], [cx + u * 4.0, base - u * 0.2]])
    line([[cx - u * 1.4, base + u * 0.2], [cx - u * 0.2, base - u * 0.1]])
    line(circle(cx + u * 2.4, base - u * 2.3, u * 0.35, 10), INK.slate, lw * 0.8)
    return
  }
  const slump = pose === 'slumped'
  // legs: bent backwards like a bird's
  const hip: Pt = [cx, base - u * 3.6]
  for (const side of [-1, 1]) line([[hip[0] + side * u * 0.3, hip[1]], [hip[0] + side * u * 0.9, base - u * 1.8], [hip[0] + side * u * 0.3, base], [hip[0] + side * u * 0.9, base]])
  // the cage, with his light inside
  const top = base - u * (slump ? 6.2 : 6.6)
  const cage = new Path2D()
  cage.rect(cx - u * 1.1, top, u * 2.2, hip[1] - top)
  scribbleFill(g, cage, [cx - u * 1.2, top, cx + u * 1.2, hip[1]], INK.pale, lw * 1.3, lw * 0.8, sh, r)
  line([[cx - u * 1.1, hip[1]], [cx - u * 1.1, top], [cx + u * 1.1, top], [cx + u * 1.1, hip[1]], [cx - u * 1.1, hip[1]]])
  for (const k of [-0.4, 0.4]) line([[cx + u * k, top], [cx + u * k, hip[1]]], INK.graphite, lw * 0.7)
  line(circle(cx, (top + hip[1]) / 2, u * 0.35, 10), slump ? INK.slate : INK.blue, lw * 1.1)
  // arms: the clamp on one side, the hook on the other; down by his sides when he's stopped
  const sh0: Pt = [cx - u * 1.1, top + u * 0.4]
  const sh1: Pt = [cx + u * 1.1, top + u * 0.4]
  const reach = slump ? 2.4 : 1.7
  line([sh0, [sh0[0] - u * 0.9, sh0[1] + u * reach], [sh0[0] - u * 1.3, sh0[1] + u * (reach + 0.4)]])
  line([[sh0[0] - u * 1.3, sh0[1] + u * (reach + 0.4)], [sh0[0] - u * 1.6, sh0[1] + u * (reach + 0.1)]])
  line([[sh0[0] - u * 1.3, sh0[1] + u * (reach + 0.4)], [sh0[0] - u * 1.1, sh0[1] + u * (reach + 0.8)]])
  line([sh1, [sh1[0] + u * 0.9, sh1[1] + u * reach], [sh1[0] + u * 1.2, sh1[1] + u * (reach + 0.5)], [sh1[0] + u * 0.8, sh1[1] + u * (reach + 0.8)]])
  // the stalk and the lens: drooped forward when he's stopped
  const neck: Pt = [cx, top]
  const head: Pt = slump ? [cx + u * 0.9, top - u * 0.9] : [cx, top - u * 1.6]
  line([neck, head])
  const lens = new Path2D()
  lens.arc(head[0], head[1], u * 1.0, 0, Math.PI * 2)
  if (!slump) scribbleFill(g, lens, [head[0] - u, head[1] - u, head[0] + u, head[1] + u], INK.pale, lw * 1.1, lw * 0.7, sh, r)
  line(circle(head[0], head[1], u * 1.0))
  // his eye: a blue dot, pressed hard; dark when he's stopped
  const eye = new Path2D()
  eye.arc(head[0] + u * 0.1, head[1], u * 0.42, 0, Math.PI * 2)
  scribbleFill(g, eye, [head[0] - u * 0.4, head[1] - u * 0.45, head[0] + u * 0.6, head[1] + u * 0.45], eyeColor, lw * 0.5, lw * 0.9, sh * 0.5, r)
}

/** The lit house: a box, a roof, and the door and window in her colour. */
function drawHouse(g: CanvasRenderingContext2D, x: number, y: number, s: number, hd: Hand, r: () => number) {
  const lw = Math.max(2, s * 0.03) * (hd.weight / 1.6)
  const line = (pts: Pt[], c = INK.graphite) => crayonLine(g, pts, c, lw, hd.jitter, r)
  const w = s, h = s * 0.75
  const door = new Path2D()
  door.rect(x - w * 0.12, y - h * 0.55, w * 0.24, h * 0.55)
  scribbleFill(g, door, [x - w * 0.13, y - h * 0.56, x + w * 0.13, y], INK.grace, lw * 0.8, lw, hd.jitter, r)
  const win = new Path2D()
  win.rect(x + w * 0.2, y - h * 0.7, w * 0.2, w * 0.18)
  scribbleFill(g, win, [x + w * 0.19, y - h * 0.71, x + w * 0.41, y - h * 0.7 + w * 0.19], INK.grace, lw * 0.8, lw, hd.jitter, r)
  line([[x - w / 2, y], [x - w / 2, y - h], [x + w / 2, y - h], [x + w / 2, y], [x - w / 2, y]])
  line([[x - w * 0.6, y - h], [x, y - h - w * 0.45], [x + w * 0.6, y - h]], INK.rust)
  line([[x - w * 0.12, y], [x - w * 0.12, y - h * 0.55], [x + w * 0.12, y - h * 0.55], [x + w * 0.12, y]])
  line([[x + w * 0.2, y - h * 0.7], [x + w * 0.4, y - h * 0.7], [x + w * 0.4, y - h * 0.7 + w * 0.18], [x + w * 0.2, y - h * 0.7 + w * 0.18], [x + w * 0.2, y - h * 0.7]])
}

/**
 * The part of the drawing a child draws on purpose, over the washes of the frame:
 * him, big, where he was; the house when he'd got there; the sun or the moon.
 */
function drawMoment(out: HTMLCanvasElement, m: Moment, by: Drawer, seed: number) {
  const g = out.getContext('2d')!
  const hd = HANDS[by]
  const r = hand(seed + (by === 'yuri' ? 50 : 0))
  const W = out.width, Hh = out.height
  // the sky in a corner: the sun in her colour, or a pale moon and a few stars
  const sx = by === 'yanah' ? W * 0.9 : W * 0.1
  const sy = Hh * 0.17
  if (m.sky === 'sun') {
    const sun = new Path2D()
    sun.arc(sx, sy, Hh * 0.09, 0, Math.PI * 2)
    scribbleFill(g, sun, [sx - Hh * 0.1, sy - Hh * 0.1, sx + Hh * 0.1, sy + Hh * 0.1], INK.grace, 3, 3, hd.jitter, r)
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + r() * 0.2
      crayonLine(g, [[sx + Math.cos(a) * Hh * 0.12, sy + Math.sin(a) * Hh * 0.12], [sx + Math.cos(a) * Hh * 0.18, sy + Math.sin(a) * Hh * 0.18]], INK.grace, 2.4, hd.jitter, r)
    }
  } else {
    const moon = new Path2D()
    moon.arc(sx, sy, Hh * 0.08, 0, Math.PI * 2)
    const bite = new Path2D()
    bite.arc(sx + Hh * 0.04, sy - Hh * 0.02, Hh * 0.07, 0, Math.PI * 2)
    g.save()
    g.clip(moon)
    scribbleFill(g, moon, [sx - Hh * 0.09, sy - Hh * 0.09, sx + Hh * 0.09, sy + Hh * 0.09], INK.pale, 3, 3, hd.jitter, r)
    g.globalCompositeOperation = 'destination-out'
    g.fill(bite)
    g.restore()
    for (let k = 0; k < 5; k++) {
      const x = W * (0.15 + r() * 0.7), y = Hh * (0.06 + r() * 0.16)
      crayonLine(g, [[x - 3, y], [x + 3, y]], INK.pale, 2, 0.5, r)
      crayonLine(g, [[x, y - 3], [x, y + 3]], INK.pale, 2, 0.5, r)
    }
  }
  const h = Hh * hd.size
  let cx = Math.max(W * 0.18, Math.min(W * 0.82, m.still.x * W))
  let base = Math.max(h * 1.05, Math.min(Hh * 0.94, m.still.y * Hh + h * 0.25))
  if (m.house) {
    // the whole house on the page, roof and all, and him beside it at its door, the same ground
    const hs = Hh * 0.42
    const hx = Math.max(hs * 1.4, Math.min(W - hs * 0.7, m.house.x * W))
    const hy = Math.max(hs * 1.3, Math.min(Hh * 0.95, m.house.y * Hh))
    drawHouse(g, hx, hy, hs, hd, r)
    cx = hx - hs * 0.95
    base = hy
  }
  // him: big, a little in from wherever he was, standing on the page's ground
  if (m.light) {
    // the light he's in, round him, pressed in her colour (or the cold one's)
    const glow = new Path2D()
    glow.ellipse(cx, base - h * 0.5, h * 0.42, h * 0.62, 0, 0, Math.PI * 2)
    scribbleFill(g, glow, [cx - h * 0.45, base - h * 1.15, cx + h * 0.45, base + h * 0.15], m.light === 'warm' ? INK.grace : INK.pale, 4, 3.2, hd.jitter, r)
  }
  drawStill(g, cx, base, h, m.pose, hd, r)
}

export interface Drawings {
  /** False: no IndexedDB (a private window, or it failed). Cards show the line alone. */
  readonly available: boolean
  /** Capture the next rendered frame for this card, and what the moment was. */
  request(cardId: string, by: Drawer, moment: Moment): void
  /** Call right after world.render(), in the same rAF callback, so the drawing buffer is still there. */
  afterRender(canvas: HTMLCanvasElement): void
  /** The archive copy of every card (localStorage keeps only the newest). */
  putCard(card: RunCard): void
  get(cardId: string): Promise<Blob | null>
  /** Every card ever, oldest first; null when unavailable. */
  allCards(): Promise<RunCard[] | null>
  /** Drawings asked for and not yet stored. */
  readonly pending: number
  /** A frame is wanted (or its pass is due): the next frames must be drawn, not skipped. */
  readonly wanting: boolean
  /** Called with a card's id once its drawing is stored (the board redraws that card). */
  onStored(cb: (cardId: string) => void): void
  /** Dev: the keys in the drawings store. */
  keys(): Promise<string[]>
  /** Dev: run the whole drawing on any canvas now, for a look at a hand. */
  draw(src: HTMLCanvasElement, by: Drawer, seed: number, moment?: Moment): HTMLCanvasElement
}

const DB_NAME = 'still-action'
const DB_OPEN_MS = 2000

/** IndexedDB, or null in two seconds if it's missing, errors, or is blocked. */
function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let done = false
    const finish = (db: IDBDatabase | null) => {
      if (done) return
      done = true
      resolve(db)
    }
    setTimeout(() => finish(null), DB_OPEN_MS)
    try {
      if (typeof indexedDB === 'undefined') return finish(null)
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains('drawings')) db.createObjectStore('drawings')
        if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards')
      }
      req.onsuccess = () => finish(req.result)
      req.onerror = () => finish(null)
      req.onblocked = () => finish(null)
    } catch {
      finish(null)
    }
  })
}

/** A card id to a seed: the same card always wobbles the same way. */
export const seedOf = (id: string) => {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 10
}

export function createDrawings(renderer: THREE.WebGLRenderer): Drawings {
  let db: IDBDatabase | null = null
  let available = typeof indexedDB !== 'undefined'
  const ready = openDb().then((d) => {
    db = d
    available = !!d
    return d
  })

  // the pass: one quad, one material, a render target resized to each drawing
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false,
    uniforms: {
      uSrc: { value: null as THREE.Texture | null }, uTexel: { value: new THREE.Vector2() }, uCoarse: { value: new THREE.Vector2() }, uSeed: { value: 0 },
      uWobble: { value: 1 }, uLine: { value: 0.2 }, uBands: { value: 3 }, uHatch: { value: 0 }, uWeight: { value: 1.5 },
      uPalette: { value: PALETTE.map((h) => new THREE.Vector3(((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255)) },
    },
  })
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
  const scene = new THREE.Scene()
  scene.add(quad)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const rt = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false, type: THREE.UnsignedByteType })

  /** The crayon pass, straight to a canvas. */
  function draw(src: HTMLCanvasElement, by: Drawer, seed: number, moment?: Moment): HTMLCanvasElement {
    const w = src.width
    const h = src.height
    const hand = HANDS[by]
    // a tiny copy, box-averaged by the canvas: the shapes a child sees, and nothing smaller
    const small = document.createElement('canvas')
    small.width = COARSE_W
    small.height = Math.max(1, Math.round((COARSE_W * h) / w))
    const sctx = small.getContext('2d')!
    sctx.imageSmoothingEnabled = true
    sctx.imageSmoothingQuality = 'high'
    sctx.drawImage(src, 0, 0, small.width, small.height)
    const tex = new THREE.CanvasTexture(small)
    tex.colorSpace = THREE.NoColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    const u = mat.uniforms
    u.uSrc!.value = tex
    u.uTexel!.value.set(1 / w, 1 / h)
    u.uCoarse!.value.set(1 / small.width, 1 / small.height)
    u.uSeed!.value = seed
    u.uWobble!.value = hand.wobble
    u.uLine!.value = hand.line
    u.uBands!.value = hand.bands
    u.uHatch!.value = hand.hatch
    u.uWeight!.value = hand.weight
    rt.setSize(w, h)
    const prev = renderer.getRenderTarget()
    const tone = renderer.toneMapping
    renderer.toneMapping = THREE.NoToneMapping
    renderer.setRenderTarget(rt)
    renderer.render(scene, cam)
    const buf = new Uint8Array(w * h * 4)
    renderer.readRenderTargetPixels(rt, 0, 0, w, h, buf)
    renderer.setRenderTarget(prev)
    renderer.toneMapping = tone
    tex.dispose()
    const out = document.createElement('canvas')
    out.width = w
    out.height = h
    const img = new ImageData(w, h)
    // the target reads bottom-up
    for (let y = 0; y < h; y++) img.data.set(buf.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
    out.getContext('2d')!.putImageData(img, 0, 0)
    if (moment) drawMoment(out, moment, by, seed)
    return out
  }

  const encode = (c: HTMLCanvasElement) => new Promise<Blob | null>((resolve) => {
    c.toBlob((b) => {
      if (b && b.type === 'image/webp') return resolve(b)
      c.toBlob((j) => resolve(j), 'image/jpeg', 0.82)
    }, 'image/webp', 0.82)
  })

  const put = (store: 'drawings' | 'cards', key: string, value: unknown) => new Promise<void>((resolve) => {
    if (!db) return resolve()
    try {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })

  let wanted: { cardId: string; by: Drawer; moment: Moment } | null = null
  let captured: { cardId: string; by: Drawer; src: HTMLCanvasElement; moment: Moment } | null = null
  let pending = 0
  const storedListeners: ((id: string) => void)[] = []

  return {
    get available() { return available },
    get pending() { return pending },
    get wanting() { return !!wanted || !!captured },

    request(cardId, by, moment) {
      if (!available) return
      // two endings before a frame (only checks can): the later one is the one drawn
      if (!wanted) pending++
      wanted = { cardId, by, moment }
    },

    afterRender(canvas) {
      // the frame after a capture: the pass, the encode and the store, off the capture's frame
      if (captured) {
        const c = captured
        captured = null
        try {
          const out = draw(c.src, c.by, seedOf(c.cardId), c.moment)
          void encode(out).then(async (blob) => {
            await ready
            if (blob) await put('drawings', c.cardId, blob)
            pending = Math.max(0, pending - 1)
            if (blob) for (const cb of storedListeners) cb(c.cardId)
          })
        } catch {
          pending = Math.max(0, pending - 1)
        }
      }
      if (!wanted) return
      const w = wanted
      wanted = null
      try {
        // the moment, big in the middle of the page: a child draws what matters, not the edges
        const hand = HANDS[w.by]
        // at the card's own shape, so nothing the kid drew (the sun in the corner) is cut off by the card
        const sh = Math.min(canvas.height * hand.crop, (canvas.width * hand.crop) / CARD_ASPECT)
        const sw = sh * CARD_ASPECT
        const H = Math.round((DRAW_W * sh) / sw)
        const src = document.createElement('canvas')
        src.width = DRAW_W
        src.height = H
        src.getContext('2d')!.drawImage(canvas, (canvas.width - sw) / 2, (canvas.height - sh) / 2, sw, sh, 0, 0, DRAW_W, H)
        // where things were, moved from the whole frame into the part they drew
        const fx = sw / canvas.width, fy = sh / canvas.height
        const into = (p: { x: number; y: number }) => ({ x: (p.x - (1 - fx) / 2) / fx, y: (p.y - (1 - fy) / 2) / fy })
        const m = { ...w.moment, still: into(w.moment.still), house: w.moment.house ? into(w.moment.house) : undefined }
        captured = { cardId: w.cardId, by: w.by, src, moment: m }
      } catch {
        pending = Math.max(0, pending - 1)
      }
    },

    onStored(cb) {
      storedListeners.push(cb)
    },

    putCard(card) {
      void ready.then(() => put('cards', card.id, card))
    },

    get(cardId) {
      return ready.then((d) => new Promise<Blob | null>((resolve) => {
        if (!d) return resolve(null)
        try {
          const req = d.transaction('drawings').objectStore('drawings').get(cardId)
          req.onsuccess = () => resolve((req.result as Blob | undefined) ?? null)
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }))
    },

    allCards() {
      return ready.then((d) => new Promise<RunCard[] | null>((resolve) => {
        if (!d) return resolve(null)
        try {
          const req = d.transaction('cards').objectStore('cards').getAll()
          req.onsuccess = () => resolve((req.result as RunCard[]).sort((a, b) => a.n - b.n))
          req.onerror = () => resolve(null)
        } catch {
          resolve(null)
        }
      }))
    },

    keys() {
      return ready.then((d) => new Promise<string[]>((resolve) => {
        if (!d) return resolve([])
        try {
          const req = d.transaction('drawings').objectStore('drawings').getAllKeys()
          req.onsuccess = () => resolve(req.result.map(String))
          req.onerror = () => resolve([])
        } catch {
          resolve([])
        }
      }))
    },

    draw,
  }
}
