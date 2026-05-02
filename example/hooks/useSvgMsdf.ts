import { useEffect, useState } from 'react'

import { bakeSvgToMsdfLayered } from 'svg-to-msdf'

import type { Texture } from 'three'

export interface BakedFillLayer {
  kind: 'fill'
  color: string
  texture: Texture
  edgeCount: number
  contourCount: number
  bakeMs: number
  previewUrl: string
}

export interface BakedLineLayer {
  kind: 'line'
  color: string
  width: number
  halfWidthNorm: number
  texture: Texture
  edgeCount: number
  contourCount: number
  bakeMs: number
  previewUrl: string
}

export type BakedLayer = BakedFillLayer | BakedLineLayer

export interface BakeInfo {
  totalBakeMs: number
  width: number
  height: number
  // Fill layers first, then line layers (matches default SVG paint order:
  // fill before stroke). Each is a separate stacked draw call.
  layers: BakedLayer[]
}

interface Options {
  size: number
  range: number
}

function pixelsToDataUrl(pixels: Uint8ClampedArray, w: number, h: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  const imgData = ctx.createImageData(w, h)
  imgData.data.set(pixels)
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/png')
}

export function useSvgMsdf(svgText: string | null, options: Options) {
  const [info, setInfo] = useState<BakeInfo | null>(null)
  const [baking, setBaking] = useState(false)

  useEffect(() => {
    if (!svgText) {
      setInfo(null)
      return
    }
    let cancelled = false
    setBaking(true)
    bakeSvgToMsdfLayered(svgText, { size: options.size, range: options.range })
      .then(result => {
        if (cancelled) {
          for (const layer of result.layers) layer.texture.dispose()
          for (const layer of result.lineLayers) layer.texture.dispose()
          return
        }
        const fillLayers: BakedLayer[] = result.layers.map(l => ({
          kind: 'fill',
          color: l.fill,
          texture: l.texture,
          edgeCount: l.edgeCount,
          contourCount: l.contours.length,
          bakeMs: l.bakeMs,
          previewUrl: pixelsToDataUrl(l.pixels, result.width, result.height),
        }))
        const lineLayers: BakedLayer[] = result.lineLayers.map(l => ({
          kind: 'line',
          color: l.color,
          width: l.width,
          halfWidthNorm: l.halfWidthNorm,
          texture: l.texture,
          edgeCount: l.edgeCount,
          contourCount: l.contours.length,
          bakeMs: l.bakeMs,
          previewUrl: pixelsToDataUrl(l.pixels, result.width, result.height),
        }))

        setInfo(prev => {
          if (prev) for (const layer of prev.layers) layer.texture.dispose()
          return {
            totalBakeMs: result.totalBakeMs,
            width: result.width,
            height: result.height,
            layers: [...fillLayers, ...lineLayers],
          }
        })
        setBaking(false)
      })
      .catch(err => {
        console.error('[svg-to-msdf] bake failed:', err)
        if (!cancelled) setBaking(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, options.size, options.range])

  return { info, baking }
}
