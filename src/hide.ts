import * as THREE from 'three'

/**
 * What each enemy is made of. Ember is the threat's colour only (cores, eyes,
 * seams, tells); the bodies are told apart by their metal, as well as their
 * shape, so a room of them doesn't read as one red-orange family under Grace's
 * light. None is pale or cold (that's Still), none is saturated red or orange
 * (that's the ember). Judged in the graded game, not by hex.
 */
export interface Hide {
  body: number
  joint: number
  /** The body's roughness and metalness; the joints keep their own. */
  rough: number
  metal: number
  jointRough: number
  jointMetal: number
  /** The body's surface, laid over its colour by `finish`. */
  finish: Finish
  /** The joints' surface: usually just grain. */
  jointFinish: Finish
}

/**
 * A surface worked into a body's colour, roughness and relief by procedural noise
 * in the mesh's own space, so it rides with the body and never swims.
 */
export interface Finish {
  /** Noise frequency per unit, per axis: a taller y streaks it (drawn steel). */
  scale: [number, number, number]
  /** Fine grain: ± this fraction of the colour. */
  grain: number
  /** ± roughness from the grain. */
  roughVar: number
  /** A second tone, as a multiplier on the colour, where the coarse noise passes `mask`. */
  tone: [number, number, number]
  /** 0..1: how much of the body wears the second tone (higher is less). */
  mask: number
  /** Roughness and metalness added where the second tone lies. */
  toneRough: number
  toneMetal: number
  /** Pitting: relief from the grain, in the shading only. */
  bump: number
  /**
   * Scrap plates: the body in cells of this size (0 for none), each one of three
   * metals (the colour, or it times patchA or patchB, with their own roughness and
   * metalness added). The Assembler.
   */
  patch?: number
  patchA?: [number, number, number]
  patchB?: [number, number, number]
  /** Roughness and metalness added on A's plates, then B's. */
  patchRM?: [number, number, number, number]
}

/** The multiplier that takes one sRGB colour to another, in the linear space the shader works in. */
function toward(from: number, to: number): [number, number, number] {
  const a = new THREE.Color(from), b = new THREE.Color(to)
  return [b.r / a.r, b.g / a.g, b.b / a.b]
}

const ASSEMBLER_IRON = 0x2a2826

const GRAIN_ONLY: Finish = { scale: [6, 6, 6], grain: 0.12, roughVar: 0.15, tone: [1, 1, 1], mask: 1, toneRough: 0, toneMetal: 0, bump: 0.2 }

export const HIDES = {
  /** The hulk: soot-black cast iron, rough and pitted, with lighter mill scale where it's worn. */
  hulk: {
    body: 0x2c2c2d, joint: 0x19191a, rough: 0.82, metal: 0.35, jointRough: 0.7, jointMetal: 0.45,
    finish: { scale: [3.2, 3.2, 3.2], grain: 0.2, roughVar: 0.2, tone: [1.5, 1.55, 1.62], mask: 0.6, toneRough: -0.2, toneMetal: 0.2, bump: 0.6 },
    jointFinish: GRAIN_ONLY,
  },
  /** The ram: dull dark bronze, heavy and metallic, gone to a darker brown-olive patina in patches. */
  ram: {
    body: 0x4a4823, joint: 0x22211a, rough: 0.5, metal: 0.72, jointRough: 0.6, jointMetal: 0.55,
    finish: { scale: [2.6, 2.6, 2.6], grain: 0.12, roughVar: 0.18, tone: [0.66, 0.74, 0.66], mask: 0.52, toneRough: 0.3, toneMetal: -0.35, bump: 0.25 },
    jointFinish: GRAIN_ONLY,
  },
  /** The sentinel: drawn gunmetal, neutral and mid-dark (Still is the pale one), streaked along its legs. */
  sentinel: {
    body: 0x67696d, joint: 0x2c2e31, rough: 0.38, metal: 0.72, jointRough: 0.55, jointMetal: 0.55,
    finish: { scale: [3, 14, 3], grain: 0.14, roughVar: 0.25, tone: [0.78, 0.78, 0.78], mask: 0.62, toneRough: 0.15, toneMetal: 0, bump: 0.12 },
    jointFinish: GRAIN_ONLY,
  },
  /** The Lobber: tarnished copper gone to a dark verdigris, the copper showing dull through it. */
  lobber: {
    body: 0x2e4b3f, joint: 0x1c2420, rough: 0.72, metal: 0.4, jointRough: 0.62, jointMetal: 0.5,
    finish: { scale: [3.4, 3.4, 3.4], grain: 0.16, roughVar: 0.2, tone: [1.25, 0.85, 0.72], mask: 0.64, toneRough: -0.25, toneMetal: 0.35, bump: 0.3 },
    jointFinish: GRAIN_ONLY,
  },
  /** The mites: coal-black domes, matte, so the one ember on each back is what you count. */
  mite: {
    body: 0x222325, joint: 0x19191a, rough: 0.9, metal: 0.25, jointRough: 0.65, jointMetal: 0.45,
    finish: { scale: [9, 9, 9], grain: 0.25, roughVar: 0.2, tone: [1.5, 1.45, 1.4], mask: 0.66, toneRough: -0.3, toneMetal: 0.3, bump: 0.5 },
    jointFinish: GRAIN_ONLY,
  },
  /** The thief: the one small rusty thing, darker than rust used to be, living in the corners. */
  thief: {
    body: 0x4e3a31, joint: 0x2a2224, rough: 0.85, metal: 0.35, jointRough: 0.6, jointMetal: 0.5,
    finish: { scale: [5, 5, 5], grain: 0.18, roughVar: 0.15, tone: [0.7, 0.62, 0.58], mask: 0.58, toneRough: 0.1, toneMetal: -0.1, bump: 0.35 },
    jointFinish: GRAIN_ONLY,
  },
  /**
   * The Assembler: built from scrap, so plates of cast iron, bronze and steel on one
   * hull. The plates differ in shine as much as colour: on a dark metal it's the
   * sheen that tells them apart under Grace's light.
   */
  assembler: {
    body: ASSEMBLER_IRON, joint: 0x1a1818, rough: 0.78, metal: 0.3, jointRough: 0.62, jointMetal: 0.5,
    finish: {
      scale: [1.8, 1.8, 1.8], grain: 0.14, roughVar: 0.2, tone: [0.75, 0.75, 0.75], mask: 0.62, toneRough: 0.15, toneMetal: -0.1, bump: 0.3,
      patch: 0.4, patchA: toward(ASSEMBLER_IRON, 0x5a4e2c), patchB: toward(ASSEMBLER_IRON, 0x54575b), patchRM: [-0.3, 0.4, -0.35, 0.35],
    },
    jointFinish: GRAIN_ONLY,
  },
  /** The Arbiter: a lamp tower of blackened steel, oily and streaked, its lenses the only light on it. */
  arbiter: {
    body: 0x2b2d30, joint: 0x17181a, rough: 0.42, metal: 0.78, jointRough: 0.55, jointMetal: 0.6,
    finish: { scale: [2, 9, 2], grain: 0.18, roughVar: 0.28, tone: [1.35, 1.35, 1.38], mask: 0.66, toneRough: -0.1, toneMetal: 0, bump: 0.15 },
    jointFinish: GRAIN_ONLY,
  },
} satisfies Record<string, Hide>
export type HideKind = keyof typeof HIDES

/** A body's two materials, finished. The colours are reset every frame by each body's tint. */
export function hideMaterials(kind: HideKind, o: { transparent?: boolean } = {}) {
  const h: Hide = HIDES[kind]
  const transparent = o.transparent ?? false
  const mat = new THREE.MeshStandardMaterial({ color: h.body, roughness: h.rough, metalness: h.metal, transparent })
  const jointMat = new THREE.MeshStandardMaterial({ color: h.joint, roughness: h.jointRough, metalness: h.jointMetal, transparent })
  finish(mat, h.finish)
  finish(jointMat, h.jointFinish)
  return { mat, jointMat }
}

/** The colour a body breaks into: its own metal. */
export const debrisColor = (kind: HideKind) => new THREE.Color(HIDES[kind].body)

const v3 = (a: [number, number, number]) => new THREE.Vector3(...a)

/**
 * Work a Finish into a standard material. Every finished material shares one
 * program: the finish is all uniforms. The texture fades out as the colour nears
 * white, so the hit flash stays a flash.
 */
export function finish(m: THREE.MeshStandardMaterial, f: Finish) {
  const u = {
    uHideScale: { value: v3(f.scale) },
    uHideGrain: { value: f.grain },
    uHideRough: { value: f.roughVar },
    uHideTone: { value: v3(f.tone) },
    uHideMask: { value: f.mask },
    uHideToneRM: { value: new THREE.Vector2(f.toneRough, f.toneMetal) },
    uHideBump: { value: f.bump },
    uHidePatch: { value: f.patch ?? 0 },
    uHidePatchA: { value: v3(f.patchA ?? [1, 1, 1]) },
    uHidePatchB: { value: v3(f.patchB ?? [1, 1, 1]) },
    uHidePatchRM: { value: new THREE.Vector4(...(f.patchRM ?? [0, 0, 0, 0])) },
  }
  // the look test (and checks) can tune a live body's finish through its uniforms
  m.userData.hide = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vHide;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHide = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vHide;
        uniform vec3 uHideScale, uHideTone, uHidePatchA, uHidePatchB;
        uniform float uHideGrain, uHideRough, uHideMask, uHideBump, uHidePatch;
        uniform vec2 uHideToneRM;
        uniform vec4 uHidePatchRM;
        float hideH(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float hideN(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          vec3 w = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hideH(i), hideH(i + vec3(1, 0, 0)), w.x), mix(hideH(i + vec3(0, 1, 0)), hideH(i + vec3(1, 1, 0)), w.x), w.y),
            mix(mix(hideH(i + vec3(0, 0, 1)), hideH(i + vec3(1, 0, 1)), w.x), mix(hideH(i + vec3(0, 1, 1)), hideH(i + vec3(1, 1, 1)), w.x), w.y),
            w.z);
        }
        float hideF(vec3 p) { return 0.55 * hideN(p) + 0.3 * hideN(p * 2.3 + 7.1) + 0.15 * hideN(p * 5.1 + 3.3); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 hideP = vHide * uHideScale;
        float hideCoarse = hideF(hideP);
        float hideFine = hideF(hideP * 3.1 + 19.0);
        float hideM = smoothstep(uHideMask - 0.06, uHideMask + 0.06, hideCoarse);
        vec3 hideMod = mix(vec3(1.0), uHideTone, hideM) * (1.0 + (hideFine - 0.5) * 2.0 * uHideGrain);
        vec2 hidePRM = vec2(0.0);
        if (uHidePatch > 0.0) {
          vec3 cell = floor(vHide / uHidePatch + 0.37);
          float r = hideH(cell);
          hideMod *= r < 0.34 ? uHidePatchA : r < 0.6 ? uHidePatchB : vec3(1.0);
          hidePRM = r < 0.34 ? uHidePatchRM.xy : r < 0.6 ? uHidePatchRM.zw : vec2(0.0);
        }
        // a flash (the colour gone toward white) wipes the surface out with it
        float hideK = 1.0 - smoothstep(0.3, 0.75, max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b)));
        diffuseColor.rgb *= mix(vec3(1.0), hideMod, hideK);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (hideFine - 0.5) * 2.0 * uHideRough + hideM * uHideToneRM.x + hidePRM.x, 0.08, 1.0);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = clamp(metalnessFactor + hideM * uHideToneRM.y + hidePRM.y, 0.0, 1.0);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        {
          // pitting from the grain: the bump map's screen-space perturbation
          float bh = (hideFine + hideM * 0.5) * uHideBump * 0.02;
          vec3 dpx = dFdx(-vViewPosition), dpy = dFdy(-vViewPosition);
          float dhx = dFdx(bh), dhy = dFdy(bh);
          vec3 r1 = cross(dpy, normal), r2 = cross(normal, dpx);
          float det = dot(dpx, r1);
          normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
        }`)
  }
}
