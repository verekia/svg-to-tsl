// Adaptive subdivision of cubic / quadratic Béziers into line segments
// using the maximum-distance-from-chord criterion.

import type { Vec2 } from './types.js'

const MAX_DEPTH = 18

export function flattenQuadratic(p0: Vec2, p1: Vec2, p2: Vec2, tolerance: number, out: Vec2[], depth = 0): void {
  // Distance of control point from the chord p0->p2.
  const dx = p2.x - p0.x
  const dy = p2.y - p0.y
  const len2 = dx * dx + dy * dy
  let d: number
  if (len2 === 0) {
    const dxp = p1.x - p0.x
    const dyp = p1.y - p0.y
    d = Math.sqrt(dxp * dxp + dyp * dyp)
  } else {
    const cross = dx * (p0.y - p1.y) - dy * (p0.x - p1.x)
    d = Math.abs(cross) / Math.sqrt(len2)
  }
  if (d <= tolerance || depth >= MAX_DEPTH) {
    out.push({ x: p2.x, y: p2.y })
    return
  }
  const m01 = { x: 0.5 * (p0.x + p1.x), y: 0.5 * (p0.y + p1.y) }
  const m12 = { x: 0.5 * (p1.x + p2.x), y: 0.5 * (p1.y + p2.y) }
  const m = { x: 0.5 * (m01.x + m12.x), y: 0.5 * (m01.y + m12.y) }
  flattenQuadratic(p0, m01, m, tolerance, out, depth + 1)
  flattenQuadratic(m, m12, p2, tolerance, out, depth + 1)
}

export function flattenCubic(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, tolerance: number, out: Vec2[], depth = 0): void {
  const dx = p3.x - p0.x
  const dy = p3.y - p0.y
  const len = Math.sqrt(dx * dx + dy * dy)
  let d1: number, d2: number
  if (len === 0) {
    const a = p1.x - p0.x
    const b = p1.y - p0.y
    const c = p2.x - p0.x
    const e = p2.y - p0.y
    d1 = Math.sqrt(a * a + b * b)
    d2 = Math.sqrt(c * c + e * e)
  } else {
    d1 = Math.abs((p1.x - p0.x) * dy - (p1.y - p0.y) * dx) / len
    d2 = Math.abs((p2.x - p0.x) * dy - (p2.y - p0.y) * dx) / len
  }
  if (Math.max(d1, d2) <= tolerance || depth >= MAX_DEPTH) {
    out.push({ x: p3.x, y: p3.y })
    return
  }
  const m01 = { x: 0.5 * (p0.x + p1.x), y: 0.5 * (p0.y + p1.y) }
  const m12 = { x: 0.5 * (p1.x + p2.x), y: 0.5 * (p1.y + p2.y) }
  const m23 = { x: 0.5 * (p2.x + p3.x), y: 0.5 * (p2.y + p3.y) }
  const m012 = { x: 0.5 * (m01.x + m12.x), y: 0.5 * (m01.y + m12.y) }
  const m123 = { x: 0.5 * (m12.x + m23.x), y: 0.5 * (m12.y + m23.y) }
  const m = { x: 0.5 * (m012.x + m123.x), y: 0.5 * (m012.y + m123.y) }
  flattenCubic(p0, m01, m012, m, tolerance, out, depth + 1)
  flattenCubic(m, m123, m23, p3, tolerance, out, depth + 1)
}
