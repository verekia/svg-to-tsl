// Shared TSL node-graph wiring used by every Msdf*NodeMaterial variant.
//
// `applyMsdfNodes(material, params)`:
//   1. Builds the median-of-3 + AA coverage node from a uniform-wrapped texture.
//   2. Assigns it to the material's `colorNode` / `opacityNode` (works on every
//      NodeMaterial subclass — Basic, Lambert, Standard, Sprite, …).
//   3. Installs accessor properties so React Three Fiber can declaratively
//      drive `color`, `map`, `opacity`, `threshold` via JSX props and the
//      changes propagate into the underlying uniforms.

import { Color, Vector2, type ColorRepresentation, type Texture } from 'three'
import { Fn, clamp, float, fwidth, max, min, texture, uniform, uniformTexture, uv } from 'three/tsl'

// Tuple form accepted by setters: [x, y].
export type Vec2Tuple = [number, number]

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
  // How many times the SVG repeats across the mesh's UV [0,1] range.
  // Distinct from `Texture.repeat` — that property is ignored here because
  // we sample via a custom TSL graph, not the stock material pipeline.
  tiling?: Vector2 | Vec2Tuple
  // UV translation applied after tiling. Same caveat as above: this is our
  // own uniform, not `Texture.offset`.
  uvOffset?: Vector2 | Vec2Tuple
}

const median3 = Fn<[unknown], unknown>(([v]) => {
  const c = v as { r: any; g: any; b: any }
  return max(min(c.r, c.g), min(max(c.r, c.g), c.b))
})

// `uniform(x, 'float')` returns a node with a live `.value` getter/setter,
// but the inferred return type from `three/tsl` doesn't expose it. This
// alias lets us read/write the scalar without a cast at every site.
type FloatUniform = ReturnType<typeof float> & { value: number }

const floatUniform = (initial: number): FloatUniform => uniform(initial, 'float') as unknown as FloatUniform

export interface MsdfUniforms {
  mapUniform: ReturnType<typeof uniformTexture>
  colorUniform: ReturnType<typeof uniform>
  thresholdUniform: FloatUniform
  opacityUniform: FloatUniform
  tilingUniform: ReturnType<typeof uniform>
  uvOffsetUniform: ReturnType<typeof uniform>
}

function toVec2(v: Vector2 | Vec2Tuple | undefined, dx: number, dy: number): Vector2 {
  if (!v) return new Vector2(dx, dy)
  if (v instanceof Vector2) return v.clone()
  return new Vector2(v[0], v[1])
}

export function applyMsdfNodes(material: any, parameters: MsdfNodeMaterialParameters): MsdfUniforms {
  const colorUniform = uniform(new Color(parameters.color ?? 0xffffff))
  const mapUniform = uniformTexture(parameters.map ?? undefined)
  // If `lineHalfWidth` is provided, derive the threshold from it; otherwise
  // honor an explicit `threshold` (default 0.5 = fill iso-level).
  const initialThreshold =
    parameters.lineHalfWidth !== undefined ? 1 - parameters.lineHalfWidth : (parameters.threshold ?? 0.5)
  const thresholdUniform = floatUniform(initialThreshold)
  const opacityUniform = floatUniform(parameters.opacity ?? 1)
  const tilingUniform = uniform(toVec2(parameters.tiling, 1, 1))
  const uvOffsetUniform = uniform(toVec2(parameters.uvOffset, 0, 0))

  // Apply our own UV transform. `Texture.repeat`/`Texture.offset` from
  // three.js are not honored here — only the sampler's wrap modes are
  // (already RepeatWrapping in bake.ts), which is what makes tiling > 1
  // actually repeat instead of clamp.
  const transformedUv = uv().mul(tilingUniform).add(uvOffsetUniform)
  const sample = texture(mapUniform, transformedUv).rgb
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
    get: () => opacityUniform.value,
    set: (v: number) => {
      opacityUniform.value = v
    },
  })
  Object.defineProperty(material, 'threshold', {
    configurable: true,
    enumerable: true,
    get: () => thresholdUniform.value,
    set: (v: number) => {
      thresholdUniform.value = v
    },
  })
  // `lineHalfWidth` is a derived view on the same uniform: setting it
  // writes `1 - x` into `threshold`, so JSX like
  //   <msdfBasicNodeMaterial lineHalfWidth={layer.halfWidthNorm} />
  // works as a one-prop convenience for line layers.
  Object.defineProperty(material, 'lineHalfWidth', {
    configurable: true,
    enumerable: true,
    get: () => 1 - thresholdUniform.value,
    set: (v: number) => {
      thresholdUniform.value = 1 - v
    },
  })
  // Our own UV-transform props. Accept either a Vector2 or a [x, y] tuple
  // so JSX can write `tiling={[2, 2]}` directly.
  Object.defineProperty(material, 'tiling', {
    configurable: true,
    enumerable: true,
    get: () => tilingUniform.value as Vector2,
    set: (v: Vector2 | Vec2Tuple) => {
      const target = tilingUniform.value as Vector2
      if (v instanceof Vector2) target.copy(v)
      else target.set(v[0], v[1])
    },
  })
  Object.defineProperty(material, 'uvOffset', {
    configurable: true,
    enumerable: true,
    get: () => uvOffsetUniform.value as Vector2,
    set: (v: Vector2 | Vec2Tuple) => {
      const target = uvOffsetUniform.value as Vector2
      if (v instanceof Vector2) target.copy(v)
      else target.set(v[0], v[1])
    },
  })

  return { mapUniform, colorUniform, thresholdUniform, opacityUniform, tilingUniform, uvOffsetUniform }
}
