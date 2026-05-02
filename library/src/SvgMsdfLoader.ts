import { Loader, type LoadingManager, type Texture } from 'three'

import { bakeSvgToMsdf, type BakeResult } from './bake.js'

export interface SvgMsdfMetadata {
  width: number
  height: number
  bakeMs: number
}

export class SvgMsdfLoader extends Loader<Texture> {
  size = 256
  range = 4
  padding = 8
  flipY = true
  tolerance = 0.25
  cornerAngleDeg = 3

  // Last bake's metadata, also stashed on `texture.userData.svgMsdf`.
  lastResult: BakeResult | null = null

  constructor(manager?: LoadingManager) {
    super(manager)
  }

  override load(
    url: string,
    onLoad: (texture: Texture) => void,
    onProgress?: (event: ProgressEvent) => void,
    onError?: (err: unknown) => void,
  ): void {
    const fetcher =
      typeof fetch === 'function'
        ? fetch(url).then(r => {
            if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status} ${r.statusText}`)
            return r.text()
          })
        : Promise.reject(new Error('fetch is not available'))

    fetcher
      .then(svgText => this.bake(svgText))
      .then(result => onLoad(result.texture))
      .catch(err => {
        if (onError) onError(err)
        else this.manager.itemError(url)
      })
    void onProgress
  }

  async bake(svgText: string): Promise<BakeResult> {
    const result = await bakeSvgToMsdf(svgText, {
      size: this.size,
      range: this.range,
      padding: this.padding,
      flipY: this.flipY,
      tolerance: this.tolerance,
      cornerAngleDeg: this.cornerAngleDeg,
    })
    this.lastResult = result
    result.texture.userData = {
      ...result.texture.userData,
      svgMsdf: { width: result.width, height: result.height, bakeMs: result.bakeMs } as SvgMsdfMetadata,
    }
    return result
  }
}
