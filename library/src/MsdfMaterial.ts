// Three.js material that samples a baked MSDF texture using median-of-3
// reconstruction with screen-space derivatives for analytic AA.

import { Color, ShaderMaterial, UniformsLib, UniformsUtils, type ColorRepresentation, type Texture } from 'three'

import { msdfFragment } from './shaders.js'

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

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

export class MsdfMaterial extends ShaderMaterial {
  constructor(parameters: MsdfMaterialParameters = {}) {
    const color = new Color(parameters.color ?? 0xffffff)
    const bg = new Color(parameters.background ?? 0x000000)
    super({
      defines: {
        ALPHA_ONLY: parameters.alphaOnly ? 1 : 0,
      },
      uniforms: UniformsUtils.merge([
        UniformsLib.common,
        {
          uMap: { value: parameters.map ?? null },
          uColor: { value: color },
          uBackground: { value: bg },
          uThreshold: { value: parameters.threshold ?? 0.5 },
          uOpacity: { value: parameters.opacity ?? 1 },
        },
      ]),
      vertexShader,
      fragmentShader: msdfFragment,
      transparent: parameters.transparent ?? true,
    })
  }

  get map(): Texture | null {
    return this.uniforms.uMap.value as Texture | null
  }
  set map(value: Texture | null) {
    this.uniforms.uMap.value = value
  }
  get color(): Color {
    return this.uniforms.uColor.value as Color
  }
  get background(): Color {
    return this.uniforms.uBackground.value as Color
  }
  get threshold(): number {
    return this.uniforms.uThreshold.value as number
  }
  set threshold(value: number) {
    this.uniforms.uThreshold.value = value
  }
}
