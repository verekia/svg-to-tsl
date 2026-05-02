// Convert an SVG document into contours composed of line segments, with
// optional grouping by fill color. Curves are flattened using
// `flatten.ts`. Supports the most common shape elements + their `stroke`
// attribute; transforms, gradients and CSS are still ignored.

import { flattenCubic, flattenQuadratic } from './flatten.js'
import { parsePath } from './pathParser.js'
import { EDGE_WHITE } from './types.js'

import type { Contour, LayeredShape, LineEdge, LineLayer, Shape, ShapeLayer, Vec2 } from './types.js'

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

// Like closeSubpath but doesn't add the wrap-around edge — used for open
// shapes (`<line>`, `<polyline>`, paths without an explicit `Z`). For
// stroke / line layers the unsigned distance reads identically either way,
// but skipping the spurious edge halves the per-pixel distance work.
const finalizeOpen = (pen: Pen) => {
  if (pen.current.length >= 2) {
    const edges: LineEdge[] = []
    for (let i = 0; i < pen.current.length - 1; i++) {
      edges.push({ p0: pen.current[i], p1: pen.current[i + 1], color: EDGE_WHITE })
    }
    if (edges.length > 0) pen.contours.push({ edges })
  }
  pen.current = []
  pen.start = null
}

const moveTo = (pen: Pen, x: number, y: number) => {
  // Per SVG spec, the previous subpath stays whatever it was (an explicit
  // `Z` already closed it; no `Z` means it's open). So end-of-subpath
  // here must NOT add a wrap-around edge.
  finalizeOpen(pen)
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
  // Trailing subpath without an explicit `Z` is open.
  finalizeOpen(pen)
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

function resolveStrokeColor(el: Element, inherited: string | null): string | null {
  const style = el.getAttribute('style')
  if (style) {
    const m = /(?:^|;)\s*stroke\s*:\s*([^;]+)/i.exec(style)
    if (m) return normalizeFill(m[1])
  }
  const s = el.getAttribute('stroke')
  if (s) return normalizeFill(s)
  return inherited
}

function resolveStrokeWidth(el: Element, inherited: number): number {
  const style = el.getAttribute('style')
  if (style) {
    const m = /(?:^|;)\s*stroke-width\s*:\s*([0-9.+\-eE]+)/i.exec(style)
    if (m) {
      const w = parseFloat(m[1])
      if (Number.isFinite(w)) return w
    }
  }
  const w = el.getAttribute('stroke-width')
  if (w) {
    const parsed = parseFloat(w)
    if (Number.isFinite(parsed)) return parsed
  }
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
      else finalizeOpen(pen)
    }
  } else if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    moveTo(pen, x1, y1)
    lineTo(pen, x2, y2)
    finalizeOpen(pen)
  }
}

interface VisitContext {
  layered: boolean
  layers: ShapeLayer[]
  lineLayers: LineLayer[]
  fallbackPen: Pen
  tolerance: number
}

interface InheritedStyle {
  fill: string | null
  stroke: string | null
  strokeWidth: number
}

function visit(el: Element, ctx: VisitContext, inherited: InheritedStyle) {
  const tag = el.localName
  const fill = resolveFill(el, inherited.fill)
  const stroke = resolveStrokeColor(el, inherited.stroke)
  const strokeWidth = resolveStrokeWidth(el, inherited.strokeWidth)

  if (SHAPE_TAGS.has(tag)) {
    if (ctx.layered) {
      const hasFill = fill !== null
      const hasStroke = stroke !== null && strokeWidth > 0
      if (!hasFill && !hasStroke) return

      const pen = newPen(ctx.tolerance)
      emitShapeForElement(el, pen)
      // Each branch in `emitShapeForElement` already finalizes (closed
      // shapes via closeSubpath, open ones via finalizeOpen). Safety net
      // for any straggler state, leaving open paths open.
      finalizeOpen(pen)
      if (pen.contours.length === 0) return

      if (hasFill) {
        const existing = ctx.layers.find(l => l.fill === fill)
        if (existing) for (const c of pen.contours) existing.contours.push(c)
        else ctx.layers.push({ fill: fill as string, contours: pen.contours.map(cloneContour) })
      }
      if (hasStroke) {
        const existing = ctx.lineLayers.find(l => l.color === stroke && l.width === strokeWidth)
        if (existing) for (const c of pen.contours) existing.contours.push(c)
        else
          ctx.lineLayers.push({
            color: stroke as string,
            width: strokeWidth,
            contours: pen.contours.map(cloneContour),
          })
      }
    } else {
      emitShapeForElement(el, ctx.fallbackPen)
    }
    return
  }

  for (const child of Array.from(el.children)) visit(child, ctx, { fill, stroke, strokeWidth })
}

// Contours are mutated downstream by `colorEdges`; if the same shape is
// added to both a fill and a stroke layer, each needs its own copy so the
// channel coloring used for one mode doesn't pollute the other.
function cloneContour(c: Contour): Contour {
  return { edges: c.edges.map(e => ({ p0: e.p0, p1: e.p1, color: e.color })) }
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

const ROOT_INHERITED: InheritedStyle = { fill: DEFAULT_FILL, stroke: null, strokeWidth: 1 }

export function parseSvg(svgText: string, tolerance = 0.25): Shape {
  const svg = loadSvg(svgText)
  const pen = newPen(tolerance)
  const ctx: VisitContext = { layered: false, layers: [], lineLayers: [], fallbackPen: pen, tolerance }
  visit(svg, ctx, ROOT_INHERITED)
  finalizeOpen(pen)
  const bounds = applyViewBox(computeBounds(pen.contours), svg)
  return { contours: pen.contours, bounds }
}

export function parseSvgLayered(svgText: string, tolerance = 0.25): LayeredShape {
  const svg = loadSvg(svgText)
  const ctx: VisitContext = {
    layered: true,
    layers: [],
    lineLayers: [],
    fallbackPen: newPen(tolerance),
    tolerance,
  }
  visit(svg, ctx, ROOT_INHERITED)
  // Bounds: union of fills + lines, but expand lines by half their width
  // so the stroke band isn't clipped at the texture edge.
  const fillContours = ctx.layers.flatMap(l => l.contours)
  const fillBounds = computeBounds(fillContours)
  let bounds = fillBounds
  for (const ll of ctx.lineLayers) {
    const sb = computeBounds(ll.contours)
    const half = ll.width / 2
    bounds = {
      minX: Math.min(bounds.minX, sb.minX - half),
      minY: Math.min(bounds.minY, sb.minY - half),
      maxX: Math.max(bounds.maxX, sb.maxX + half),
      maxY: Math.max(bounds.maxY, sb.maxY + half),
    }
  }
  bounds = applyViewBox(bounds, svg)
  return { layers: ctx.layers, lineLayers: ctx.lineLayers, bounds }
}
