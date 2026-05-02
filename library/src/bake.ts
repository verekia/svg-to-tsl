// CPU MSDF baker. Walks every output pixel and computes the minimum
// unsigned distance per color channel (R/G/B) to the colored edge set,
// signed by an even-odd point-in-polygon test.

import { CanvasTexture, LinearFilter, NoColorSpace, RGBAFormat, RepeatWrapping, type Texture } from 'three'

import { colorEdges } from './edgeColoring.js'
import { parseSvg, parseSvgLayered } from './parseSvg.js'
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

export interface LayeredBakeLayer {
  fill: string
  texture: Texture
  pixels: Uint8ClampedArray
  contours: Contour[]
  edgeCount: number
  bakeMs: number
}

export interface LayeredBakeResult {
  layers: LayeredBakeLayer[]
  width: number
  height: number
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  totalBakeMs: number
}

interface ResolvedOptions {
  size: number
  range: number
  padding: number
  flipY: boolean
  tolerance: number
  cornerAngle: number
}

function resolveOptions(options: BakeOptions): ResolvedOptions {
  return {
    size: Math.max(8, Math.floor(options.size ?? 256)),
    range: Math.max(0.5, options.range ?? 4),
    padding: Math.max(0, Math.floor(options.padding ?? 8)),
    flipY: options.flipY ?? true,
    tolerance: options.tolerance ?? 0.25,
    cornerAngle: options.cornerAngleDeg ?? 3,
  }
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now()

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

interface ProjectionParams {
  scale: number
  offsetX: number
  offsetY: number
  minX: number
  minY: number
  svgRange: number
}

function buildProjection(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  size: number,
  padding: number,
  range: number,
): ProjectionParams {
  const sw = Math.max(bounds.maxX - bounds.minX, 1)
  const sh = Math.max(bounds.maxY - bounds.minY, 1)
  const inner = size - 2 * padding
  const scale = inner / Math.max(sw, sh)
  const offsetX = padding + (inner - sw * scale) / 2
  const offsetY = padding + (inner - sh * scale) / 2
  return { scale, offsetX, offsetY, minX: bounds.minX, minY: bounds.minY, svgRange: range / scale }
}

function bakeContoursToPixels(
  contours: Contour[],
  proj: ProjectionParams,
  size: number,
  flipY: boolean,
): Uint8ClampedArray {
  const allEdges: LineEdge[] = []
  for (const c of contours) for (const e of c.edges) allEdges.push(e)
  const channels: LineEdge[][] = [
    allEdges.filter(e => (e.color & EDGE_RED) !== 0),
    allEdges.filter(e => (e.color & EDGE_GREEN) !== 0),
    allEdges.filter(e => (e.color & EDGE_BLUE) !== 0),
  ]
  const pixels = new Uint8ClampedArray(size * size * 4)
  for (let py = 0; py < size; py++) {
    const yPixel = flipY ? size - 1 - py : py
    const sy = (yPixel + 0.5 - proj.offsetY) / proj.scale + proj.minY
    for (let px = 0; px < size; px++) {
      const sx = (px + 0.5 - proj.offsetX) / proj.scale + proj.minX
      const inside = pointInside(contours, sx, sy)
      const sign = inside ? 1 : -1
      const idx = (py * size + px) * 4
      for (let c = 0; c < 3; c++) {
        const d = minDistance(channels[c], sx, sy)
        const sd = sign * d
        const v = 0.5 + sd / proj.svgRange
        pixels[idx + c] = Math.max(0, Math.min(255, Math.round(v * 255)))
      }
      pixels[idx + 3] = 255
    }
  }
  return pixels
}

function pixelsToTexture(pixels: Uint8ClampedArray, size: number): Texture {
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
  // MSDF channels are raw signed-distance data, not gamma-encoded color.
  texture.colorSpace = NoColorSpace
  texture.flipY = false
  texture.needsUpdate = true
  return texture
}

export async function bakeSvgToMsdf(svgText: string, options: BakeOptions = {}): Promise<BakeResult> {
  const opts = resolveOptions(options)
  const t0 = now()

  const shape = parseSvg(svgText, opts.tolerance)
  if (shape.contours.length === 0) throw new Error('SVG contains no usable shape data')
  colorEdges(shape.contours, opts.cornerAngle)

  const proj = buildProjection(shape.bounds, opts.size, opts.padding, opts.range)
  const pixels = bakeContoursToPixels(shape.contours, proj, opts.size, opts.flipY)
  const texture = pixelsToTexture(pixels, opts.size)

  return { texture, width: opts.size, height: opts.size, pixels, shape, bakeMs: now() - t0 }
}

export async function bakeSvgToMsdfLayered(svgText: string, options: BakeOptions = {}): Promise<LayeredBakeResult> {
  const opts = resolveOptions(options)
  const t0 = now()

  const layered = parseSvgLayered(svgText, opts.tolerance)
  if (layered.layers.length === 0) throw new Error('SVG contains no fillable shape data')

  // Use the union of all layers for bounds so every layer is rendered
  // into the same UV / pixel coordinate system. This means stacking the
  // resulting textures on the same mesh lines up perfectly.
  const proj = buildProjection(layered.bounds, opts.size, opts.padding, opts.range)

  const layerResults: LayeredBakeLayer[] = []
  for (const layer of layered.layers) {
    const layerStart = now()
    colorEdges(layer.contours, opts.cornerAngle)
    const pixels = bakeContoursToPixels(layer.contours, proj, opts.size, opts.flipY)
    const texture = pixelsToTexture(pixels, opts.size)
    const edgeCount = layer.contours.reduce((s, c) => s + c.edges.length, 0)
    layerResults.push({
      fill: layer.fill,
      texture,
      pixels,
      contours: layer.contours,
      edgeCount,
      bakeMs: now() - layerStart,
    })
  }

  return {
    layers: layerResults,
    width: opts.size,
    height: opts.size,
    bounds: layered.bounds,
    totalBakeMs: now() - t0,
  }
}
