import { useEffect, useState } from 'react'

import { bakeSvgToMsdfLayered } from 'svg-to-tsl'

import type { Texture } from 'three'

export interface BakedLayer {
  fill: string
  texture: Texture
  edgeCount: number
  contourCount: number
  bakeMs: number
  previewUrl: string
}

export interface BakeInfo {
  totalBakeMs: number
  width: number
  height: number
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
          return
        }
        const layers: BakedLayer[] = result.layers.map(l => ({
          fill: l.fill,
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
            layers,
          }
        })
        setBaking(false)
      })
      .catch(err => {
        console.error('[svg-to-tsl] bake failed:', err)
        if (!cancelled) setBaking(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, options.size, options.range])

  return { info, baking }
}
