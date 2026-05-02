import { useEffect, useRef, useState } from 'react'

import { bakeSvgToMsdf } from 'svg-to-tsl'

import type { Texture } from 'three'

export interface BakeInfo {
  bakeMs: number
  contours: number
  edges: number
  previewUrl: string
}

interface Options {
  size: number
  range: number
}

export function useSvgMsdf(svgText: string | null, options: Options) {
  const [texture, setTexture] = useState<Texture | null>(null)
  const [info, setInfo] = useState<BakeInfo | null>(null)
  const [baking, setBaking] = useState(false)
  const lastUrlRef = useRef<string | null>(null)

  useEffect(() => {
    if (!svgText) {
      setTexture(null)
      setInfo(null)
      return
    }
    let cancelled = false
    setBaking(true)
    const t0 = performance.now()
    bakeSvgToMsdf(svgText, { size: options.size, range: options.range })
      .then(result => {
        if (cancelled) {
          result.texture.dispose()
          return
        }
        const totalEdges = result.shape.contours.reduce((s, c) => s + c.edges.length, 0)
        // Render preview from the raw pixels.
        const canvas = document.createElement('canvas')
        canvas.width = result.width
        canvas.height = result.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          const imgData = ctx.createImageData(result.width, result.height)
          imgData.data.set(result.pixels)
          ctx.putImageData(imgData, 0, 0)
        }
        const previewUrl = canvas.toDataURL('image/png')

        if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current)
        lastUrlRef.current = previewUrl

        setTexture(prev => {
          if (prev) prev.dispose()
          return result.texture
        })
        setInfo({
          bakeMs: result.bakeMs || performance.now() - t0,
          contours: result.shape.contours.length,
          edges: totalEdges,
          previewUrl,
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

  return { texture, info, baking }
}
