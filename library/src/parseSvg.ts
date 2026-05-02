// Convert an SVG document into contours composed of line segments, with
// optional grouping by fill color. Curves are flattened using
// `flatten.ts`. Supports the most common shape elements; transforms,
// strokes, gradients and CSS are ignored.

import { flattenCubic, flattenQuadratic } from './flatten.js'
import { parsePath } from './pathParser.js'
import { EDGE_WHITE } from './types.js'

import type { Contour, LayeredShape, LineEdge, Shape, ShapeLayer, Vec2 } from './types.js'

const CIRCLE_KAPPA = 0.5522847498307936
const SHAPE_TAGS = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line'])
const DEFAULT_FILL = '#000000'

interface Pen {
  contours: Contour[]
  current: Vec2[]
  start: Vec2 | null
  cx: number
  cy: number
  tolerance: number
}

const newPen = (tolerance: number): Pen => ({ contours: [], current: [], start: null, cx: 0, cy: 0, tolerance })

const closeSubpath = (pen: Pen) => {
  if (pen.current.length >= 2) {
    const edges: LineEdge[] = []
    for (let i = 0; i < pen.current.length - 1; i++) {
      edges.push({ p0: pen.current[i], p1: pen.current[i + 1], color: EDGE_WHITE })
    }
    if (pen.start && pen.current.length > 0) {
      const last = pen.current[pen.current.length - 1]
      if (last.x !== pen.start.x || last.y !== pen.start.y) {
        edges.push({ p0: last, p1: pen.start, color: EDGE_WHITE })
      }
    }
    if (edges.length > 0) pen.contours.push({ edges })
  }
  pen.current = []
  pen.start = null
}

const moveTo = (pen: Pen, x: number, y: number) => {
  closeSubpath(pen)
  pen.start = { x, y }
  pen.current = [{ x, y }]
  pen.cx = x
  pen.cy = y
}

const lineTo = (pen: Pen, x: number, y: number) => {
  if (pen.start === null) pen.start = { x: pen.cx, y: pen.cy }
  if (pen.current.length === 0) pen.current.push({ x: pen.cx, y: pen.cy })
  pen.current.push({ x, y })
  pen.cx = x
  pen.cy = y
}

const cubicTo = (pen: Pen, x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
  if (pen.start === null) pen.start = { x: pen.cx, y: pen.cy }
  if (pen.current.length === 0) pen.current.push({ x: pen.cx, y: pen.cy })
  flattenCubic({ x: pen.cx, y: pen.cy }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x, y }, pen.tolerance, pen.current)
  pen.cx = x
  pen.cy = y
}

const quadraticTo = (pen: Pen, x1: number, y1: number, x: number, y: number) => {
  if (pen.start === null) pen.start = { x: pen.cx, y: pen.cy }
  if (pen.current.length === 0) pen.current.push({ x: pen.cx, y: pen.cy })
  flattenQuadratic({ x: pen.cx, y: pen.cy }, { x: x1, y: y1 }, { x, y }, pen.tolerance, pen.current)
  pen.cx = x
  pen.cy = y
}

function pushPath(pen: Pen, d: string) {
  const cmds = parsePath(d)
  for (const c of cmds) {
    if (c.type === 'M') moveTo(pen, c.x, c.y)
    else if (c.type === 'L') lineTo(pen, c.x, c.y)
    else if (c.type === 'C') cubicTo(pen, c.x1, c.y1, c.x2, c.y2, c.x, c.y)
    else if (c.type === 'Q') quadraticTo(pen, c.x1, c.y1, c.x, c.y)
    else if (c.type === 'Z') closeSubpath(pen)
  }
  closeSubpath(pen)
}

function pushRect(pen: Pen, x: number, y: number, w: number, h: number, rx: number, ry: number) {
  if (rx > 0 || ry > 0) {
    if (rx === 0) rx = ry
    if (ry === 0) ry = rx
    rx = Math.min(rx, w / 2)
    ry = Math.min(ry, h / 2)
    const kx = rx * CIRCLE_KAPPA
    const ky = ry * CIRCLE_KAPPA
    moveTo(pen, x + rx, y)
    lineTo(pen, x + w - rx, y)
    cubicTo(pen, x + w - rx + kx, y, x + w, y + ry - ky, x + w, y + ry)
    lineTo(pen, x + w, y + h - ry)
    cubicTo(pen, x + w, y + h - ry + ky, x + w - rx + kx, y + h, x + w - rx, y + h)
    lineTo(pen, x + rx, y + h)
    cubicTo(pen, x + rx - kx, y + h, x, y + h - ry + ky, x, y + h - ry)
    lineTo(pen, x, y + ry)
    cubicTo(pen, x, y + ry - ky, x + rx - kx, y, x + rx, y)
    closeSubpath(pen)
  } else {
    moveTo(pen, x, y)
    lineTo(pen, x + w, y)
    lineTo(pen, x + w, y + h)
    lineTo(pen, x, y + h)
    closeSubpath(pen)
  }
}

function pushEllipse(pen: Pen, cx: number, cy: number, rx: number, ry: number) {
  const kx = rx * CIRCLE_KAPPA
  const ky = ry * CIRCLE_KAPPA
  moveTo(pen, cx + rx, cy)
  cubicTo(pen, cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry)
  cubicTo(pen, cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy)
  cubicTo(pen, cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry)
  cubicTo(pen, cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy)
  closeSubpath(pen)
}

function parsePoints(s: string): Vec2[] {
  const pts: Vec2[] = []
  const re = /-?\d*\.?\d+(?:[eE][+-]?\d+)?/g
  const nums: number[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) nums.push(parseFloat(m[0]))
  for (let i = 0; i < nums.length - 1; i += 2) pts.push({ x: nums[i], y: nums[i + 1] })
  return pts
}

function getViewBox(svg: SVGSVGElement): { minX: number; minY: number; w: number; h: number } | null {
  const vb = svg.getAttribute('viewBox')
  if (vb) {
    const parts = vb
      .trim()
      .split(/[\s,]+/)
      .map(Number)
    if (parts.length === 4 && parts.every(n => Number.isFinite(n))) {
      return { minX: parts[0], minY: parts[1], w: parts[2], h: parts[3] }
    }
  }
  const w = parseFloat(svg.getAttribute('width') ?? '')
  const h = parseFloat(svg.getAttribute('height') ?? '')
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { minX: 0, minY: 0, w, h }
  return null
}

function computeBounds(contours: Contour[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const c of contours) {
    for (const e of c.edges) {
      if (e.p0.x < minX) minX = e.p0.x
      if (e.p0.y < minY) minY = e.p0.y
      if (e.p0.x > maxX) maxX = e.p0.x
      if (e.p0.y > maxY) maxY = e.p0.y
      if (e.p1.x < minX) minX = e.p1.x
      if (e.p1.y < minY) minY = e.p1.y
      if (e.p1.x > maxX) maxX = e.p1.x
      if (e.p1.y > maxY) maxY = e.p1.y
    }
  }
  if (!Number.isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  return { minX, minY, maxX, maxY }
}

// Resolve the fill color for an element, walking inline style → fill
// attribute → inherited from parent. Returns null for `fill="none"`.
function normalizeFill(value: string): string | null {
  const v = value.trim().toLowerCase()
  if (v === 'none' || v === 'transparent') return null
  return v
}

function resolveFill(el: Element, inherited: string | null): string | null {
  const style = el.getAttribute('style')
  if (style) {
    const m = /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(style)
    if (m) return normalizeFill(m[1])
  }
  const f = el.getAttribute('fill')
  if (f) return normalizeFill(f)
  return inherited
}

function emitShapeForElement(el: Element, pen: Pen) {
  const tag = el.localName
  if (tag === 'path') {
    const d = el.getAttribute('d')
    if (d) pushPath(pen, d)
  } else if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') ?? '0')
    const y = parseFloat(el.getAttribute('y') ?? '0')
    const w = parseFloat(el.getAttribute('width') ?? '0')
    const h = parseFloat(el.getAttribute('height') ?? '0')
    const rx = parseFloat(el.getAttribute('rx') ?? '0')
    const ry = parseFloat(el.getAttribute('ry') ?? '0')
    if (w > 0 && h > 0) pushRect(pen, x, y, w, h, rx, ry)
  } else if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    const r = parseFloat(el.getAttribute('r') ?? '0')
    if (r > 0) pushEllipse(pen, cx, cy, r, r)
  } else if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    const rx = parseFloat(el.getAttribute('rx') ?? '0')
    const ry = parseFloat(el.getAttribute('ry') ?? '0')
    if (rx > 0 && ry > 0) pushEllipse(pen, cx, cy, rx, ry)
  } else if (tag === 'polygon' || tag === 'polyline') {
    const pts = parsePoints(el.getAttribute('points') ?? '')
    if (pts.length > 0) {
      moveTo(pen, pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) lineTo(pen, pts[i].x, pts[i].y)
      if (tag === 'polygon') closeSubpath(pen)
    }
  } else if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    moveTo(pen, x1, y1)
    lineTo(pen, x2, y2)
    closeSubpath(pen)
  }
}

interface VisitContext {
  layered: boolean
  layers: ShapeLayer[]
  fallbackPen: Pen
  tolerance: number
}

function visit(el: Element, ctx: VisitContext, inheritedFill: string | null) {
  const tag = el.localName
  const fill = resolveFill(el, inheritedFill)

  if (SHAPE_TAGS.has(tag)) {
    if (ctx.layered) {
      if (fill === null) return
      const pen = newPen(ctx.tolerance)
      emitShapeForElement(el, pen)
      closeSubpath(pen)
      if (pen.contours.length === 0) return
      const last = ctx.layers[ctx.layers.length - 1]
      if (last && last.fill === fill) {
        for (const c of pen.contours) last.contours.push(c)
      } else {
        ctx.layers.push({ fill, contours: pen.contours })
      }
    } else {
      emitShapeForElement(el, ctx.fallbackPen)
    }
    return
  }

  for (const child of Array.from(el.children)) visit(child, ctx, fill)
}

function loadSvg(svgText: string): SVGSVGElement {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = doc.documentElement as unknown as SVGSVGElement
  if (svg.nodeName !== 'svg') throw new Error('Root element is not <svg>')
  return svg
}

function applyViewBox(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  svg: SVGSVGElement,
): { minX: number; minY: number; maxX: number; maxY: number } {
  const vb = getViewBox(svg)
  if (!vb) return bounds
  return {
    minX: Math.min(bounds.minX, vb.minX),
    minY: Math.min(bounds.minY, vb.minY),
    maxX: Math.max(bounds.maxX, vb.minX + vb.w),
    maxY: Math.max(bounds.maxY, vb.minY + vb.h),
  }
}

export function parseSvg(svgText: string, tolerance = 0.25): Shape {
  const svg = loadSvg(svgText)
  const pen = newPen(tolerance)
  const ctx: VisitContext = { layered: false, layers: [], fallbackPen: pen, tolerance }
  visit(svg, ctx, DEFAULT_FILL)
  closeSubpath(pen)
  const bounds = applyViewBox(computeBounds(pen.contours), svg)
  return { contours: pen.contours, bounds }
}

export function parseSvgLayered(svgText: string, tolerance = 0.25): LayeredShape {
  const svg = loadSvg(svgText)
  const ctx: VisitContext = { layered: true, layers: [], fallbackPen: newPen(tolerance), tolerance }
  visit(svg, ctx, DEFAULT_FILL)
  const allContours = ctx.layers.flatMap(l => l.contours)
  const bounds = applyViewBox(computeBounds(allContours), svg)
  return { layers: ctx.layers, bounds }
}
