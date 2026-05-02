// Shared TSL node-graph wiring used by every Msdf*NodeMaterial variant.
//
// `applyMsdfNodes(material, params)`:
//   1. Builds the median-of-3 + AA coverage node from a uniform-wrapped texture.
//   2. Assigns it to the material's `colorNode` / `opacityNode` (works on every
//      NodeMaterial subclass — Basic, Lambert, Standard, Sprite, …).
//   3. Installs accessor properties so React Three Fiber can declaratively
//      drive `color`, `map`, `opacity`, `threshold` via JSX props and the
//      changes propagate into the underlying uniforms.

import { Color, type ColorRepresentation, type Texture } from 'three'
import { Fn, clamp, float, fwidth, max, min, texture, uniform, uniformTexture, uv } from 'three/tsl'

export interface MsdfNodeMaterialParameters {
  map?: Texture | null
  color?: ColorRepresentation
  // Iso-level for the median-of-3 reconstruction. Pixels with median >
  // threshold are covered. 0.5 (default) is correct for fill MSDFs.
  // For line textures, set this to `1 - halfWidthNorm` (or use the
  // `lineHalfWidth` shortcut, which does the same thing).
  threshold?: number
  opacity?: number
  transparent?: boolean
  // Convenience setter for line layers: writes `1 - lineHalfWidth` into
  // the `threshold` uniform. Pass the `halfWidthNorm` value the baker
  // returned for an exact match to the SVG stroke-width.
  lineHalfWidth?: number
}

const median3 = Fn<[unknown], unknown>(([v]) => {
  const c = v as { r: any; g: any; b: any }
  return max(min(c.r, c.g), min(max(c.r, c.g), c.b))
})

export interface MsdfUniforms {
  mapUniform: ReturnType<typeof uniformTexture>
  colorUniform: ReturnType<typeof uniform>
  thresholdUniform: ReturnType<typeof float>
  opacityUniform: ReturnType<typeof float>
}

export function applyMsdfNodes(material: any, parameters: MsdfNodeMaterialParameters): MsdfUniforms {
  const colorUniform = uniform(new Color(parameters.color ?? 0xffffff))
  const mapUniform = uniformTexture(parameters.map ?? undefined)
  // If `lineHalfWidth` is provided, derive the threshold from it; otherwise
  // honor an explicit `threshold` (default 0.5 = fill iso-level).
  const initialThreshold =
    parameters.lineHalfWidth !== undefined ? 1 - parameters.lineHalfWidth : (parameters.threshold ?? 0.5)
  const thresholdUniform = uniform(initialThreshold, 'float') as unknown as ReturnType<typeof float>
  const opacityUniform = uniform(parameters.opacity ?? 1, 'float') as unknown as ReturnType<typeof float>

  const sample = texture(mapUniform, uv()).rgb
  const median = median3(sample) as ReturnType<typeof float>
  // Single math path. Fill textures (signed, mid-gray edge) and line
  // textures (alpha-mask style — white on path, black far) both decode
  // via `coverage = median > threshold`. Line layers just use a higher
  // threshold (1 - halfWidthNorm) to clip in tighter on the white core.
  const sd = median.sub(thresholdUniform)
  const aa = max(fwidth(sd), float(1e-5))
  const coverage = clamp(sd.div(aa).add(0.5), 0, 1)

  material.colorNode = colorUniform
  material.opacityNode = coverage.mul(opacityUniform)
  material.transparent = parameters.transparent ?? true

  // Replace the stock `color`/`map`/`opacity` properties with accessors that
  // route through our uniforms. This makes the materials feel native in R3F:
  // <msdfBasicNodeMaterial color="#facc15" map={tex} opacity={0.8} />
  // mutates the right uniform under the hood without the user touching nodes.
  Object.defineProperty(material, 'color', {
    configurable: true,
    enumerable: true,
    get: () => colorUniform.value,
    set: (v: ColorRepresentation | Color) => {
      if (v && typeof v === 'object' && (v as Color).isColor) (colorUniform.value as Color).copy(v as Color)
      else (colorUniform.value as Color).set(v as ColorRepresentation)
    },
  })
  Object.defineProperty(material, 'map', {
    configurable: true,
    enumerable: true,
    get: () => mapUniform.value as Texture | null,
    set: (v: Texture | null) => {
      mapUniform.value = v as Texture
    },
  })
  Object.defineProperty(material, 'opacity', {
    configurable: true,
    enumerable: true,
    get: () => (opacityUniform as unknown as { value: number }).value,
    set: (v: number) => {
      ;(opacityUniform as unknown as { value: number }).value = v
    },
  })
  Object.defineProperty(material, 'threshold', {
    configurable: true,
    enumerable: true,
    get: () => (thresholdUniform as unknown as { value: number }).value,
    set: (v: number) => {
      ;(thresholdUniform as unknown as { value: number }).value = v
    },
  })
  // `lineHalfWidth` is a derived view on the same uniform: setting it
  // writes `1 - x` into `threshold`, so JSX like
  //   <msdfBasicNodeMaterial lineHalfWidth={layer.halfWidthNorm} />
  // works as a one-prop convenience for line layers.
  Object.defineProperty(material, 'lineHalfWidth', {
    configurable: true,
    enumerable: true,
    get: () => 1 - (thresholdUniform as unknown as { value: number }).value,
    set: (v: number) => {
      ;(thresholdUniform as unknown as { value: number }).value = 1 - v
    },
  })

  return { mapUniform, colorUniform, thresholdUniform, opacityUniform }
}
