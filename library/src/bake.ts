// CPU MSDF baker. Walks every output pixel and computes the minimum
// unsigned distance per color channel (R/G/B) to the colored edge set,
// signed by an even-odd point-in-polygon test.

import { CanvasTexture, LinearFilter, RGBAFormat, RepeatWrapping, SRGBColorSpace, type Texture } from 'three'

import { colorEdges } from './edgeColoring.js'
import { parseSvg } from './parseSvg.js'
import { segmentClosest } from './signedDistance.js'
import { EDGE_BLUE, EDGE_GREEN, EDGE_RED } from './types.js'

import type { Contour, LineEdge, Shape } from './types.js'

export interface BakeOptions {
  size?: number
  range?: number
  padding?: number
  flipY?: boolean
  tolerance?: number
  cornerAngleDeg?: number
}

export interface BakeResult {
  texture: Texture
  width: number
  height: number
  pixels: Uint8ClampedArray
  shape: Shape
  bakeMs: number
}

interface Channel {
  edges: LineEdge[]
  mask: number
}

function pointInside(contours: Contour[], px: number, py: number): boolean {
  let inside = false
  for (const c of contours) {
    for (const e of c.edges) {
      const x0 = e.p0.x
      const y0 = e.p0.y
      const x1 = e.p1.x
      const y1 = e.p1.y
      if (y0 > py !== y1 > py) {
        const dy = y1 - y0
        if (dy !== 0) {
          const xi = x0 + ((py - y0) * (x1 - x0)) / dy
          if (px < xi) inside = !inside
        }
      }
    }
  }
  return inside
}

function minDistance(edges: LineEdge[], px: number, py: number): number {
  let best = Infinity
  for (const e of edges) {
    const r = segmentClosest({ x: px, y: py }, e.p0, e.p1)
    if (r.dist < best) best = r.dist
  }
  return best
}

export async function bakeSvgToMsdf(svgText: string, options: BakeOptions = {}): Promise<BakeResult> {
  const t0 =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()
  const size = Math.max(8, Math.floor(options.size ?? 256))
  const range = Math.max(0.5, options.range ?? 4)
  const padding = Math.max(0, Math.floor(options.padding ?? 8))
  const flipY = options.flipY ?? true
  const tolerance = options.tolerance ?? 0.25
  const cornerAngle = options.cornerAngleDeg ?? 3

  const shape = parseSvg(svgText, tolerance)
  if (shape.contours.length === 0) throw new Error('SVG contains no usable shape data')
  colorEdges(shape.contours, cornerAngle)

  // Map SVG bounds to texture pixels with padding.
  const { minX, minY, maxX, maxY } = shape.bounds
  const sw = Math.max(maxX - minX, 1)
  const sh = Math.max(maxY - minY, 1)
  const inner = size - 2 * padding
  const scale = inner / Math.max(sw, sh)
  const offsetX = padding + (inner - sw * scale) / 2
  const offsetY = padding + (inner - sh * scale) / 2

  // Group edges by channel for per-channel min-distance scans.
  const allEdges: LineEdge[] = []
  for (const c of shape.contours) for (const e of c.edges) allEdges.push(e)
  const channels: Channel[] = [
    { mask: EDGE_RED, edges: allEdges.filter(e => (e.color & EDGE_RED) !== 0) },
    { mask: EDGE_GREEN, edges: allEdges.filter(e => (e.color & EDGE_GREEN) !== 0) },
    { mask: EDGE_BLUE, edges: allEdges.filter(e => (e.color & EDGE_BLUE) !== 0) },
  ]

  const pixels = new Uint8ClampedArray(size * size * 4)

  // Pre-compute SVG-space range so distances are comparable.
  const svgRange = range / scale

  for (let py = 0; py < size; py++) {
    const yPixel = flipY ? size - 1 - py : py
    const sy = (yPixel + 0.5 - offsetY) / scale + minY
    for (let px = 0; px < size; px++) {
      const sx = (px + 0.5 - offsetX) / scale + minX
      const inside = pointInside(shape.contours, sx, sy)
      const sign = inside ? 1 : -1
      const idx = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        const d = minDistance(channels[c].edges, sx, sy)
        const sd = sign * d
        const v = 0.5 + sd / svgRange
        pixels[idx + c] = Math.max(0, Math.min(255, Math.round(v * 255)))
      }
      pixels[idx + 3] = 255
    }
  }

  if (typeof document === 'undefined' && typeof OffscreenCanvas === 'undefined') {
    throw new Error('bakeSvgToMsdf requires a browser environment with Canvas / OffscreenCanvas')
  }
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(size, size)
      : Object.assign(document.createElement('canvas'), { width: size, height: size })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null
  if (!ctx) throw new Error('Failed to acquire 2D context for MSDF texture')
  const imgData = ctx.createImageData(size, size)
  imgData.data.set(pixels)
  ctx.putImageData(imgData, 0, 0)
  const texture: Texture = new CanvasTexture(canvas as unknown as HTMLCanvasElement)
  texture.format = RGBAFormat
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.generateMipmaps = false
  texture.colorSpace = SRGBColorSpace
  texture.flipY = false
  texture.needsUpdate = true

  const t1 =
    typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

  return { texture, width: size, height: size, pixels, shape, bakeMs: t1 - t0 }
}
