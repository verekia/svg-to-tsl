// MSDF material implemented with TSL so it runs natively under
// WebGPURenderer. Median-of-3 reconstruction with screen-space
// derivatives for analytic AA.

import { Color, type ColorRepresentation, type Texture } from 'three'
import { Fn, clamp, color as colorNode, float, fwidth, max, min, mix, texture, uniform, uv } from 'three/tsl'
import { MeshBasicNodeMaterial } from 'three/webgpu'

export interface MsdfMaterialParameters {
  map?: Texture | null
  color?: ColorRepresentation
  background?: ColorRepresentation
  threshold?: number
  opacity?: number
  transparent?: boolean
  // When true, uses the MSDF as alpha and lets the background color show
  // through. When false, blends color over background based on coverage.
  alphaOnly?: boolean
}

// TSL helper: median of the three channels (R, G, B). Used to reconstruct
// a single signed-distance value from a multi-channel SDF sample.
const median3 = Fn<[unknown], unknown>(([v]) => {
  const c = v as { r: any; g: any; b: any }
  return max(min(c.r, c.g), min(max(c.r, c.g), c.b))
})

export class MsdfMaterial extends MeshBasicNodeMaterial {
  readonly colorUniform: ReturnType<typeof colorNode>
  readonly backgroundUniform: ReturnType<typeof colorNode>
  readonly thresholdUniform: ReturnType<typeof float>
  readonly opacityUniform: ReturnType<typeof float>

  constructor(parameters: MsdfMaterialParameters = {}) {
    super()

    this.colorUniform = uniform(new Color(parameters.color ?? 0xffffff)) as unknown as ReturnType<typeof colorNode>
    this.backgroundUniform = uniform(new Color(parameters.background ?? 0x000000)) as unknown as ReturnType<
      typeof colorNode
    >
    this.thresholdUniform = uniform(parameters.threshold ?? 0.5, 'float') as unknown as ReturnType<typeof float>
    this.opacityUniform = uniform(parameters.opacity ?? 1, 'float') as unknown as ReturnType<typeof float>

    this.map = parameters.map ?? null
    const sample = parameters.map ? texture(parameters.map, uv()).rgb : uv().xyx
    const sd = (median3(sample) as ReturnType<typeof float>).sub(this.thresholdUniform)
    const aa = max(fwidth(sd), float(1e-5))
    const coverage = clamp(sd.div(aa).add(0.5), 0, 1)

    if (parameters.alphaOnly) {
      this.colorNode = this.colorUniform
      this.opacityNode = coverage.mul(this.opacityUniform)
    } else {
      this.colorNode = mix(this.backgroundUniform, this.colorUniform, coverage)
      this.opacityNode = max(coverage.mul(this.opacityUniform), this.opacityUniform)
    }

    this.transparent = parameters.transparent ?? true
  }

  // Colors and threshold are exposed via the uniform nodes — mutate
  // `.colorUniform.value`, `.backgroundUniform.value`, etc. to animate.
  // We don't override the parent's `color` getter because
  // MeshBasicNodeMaterial reads it during construction before our fields
  // are initialized.
}
