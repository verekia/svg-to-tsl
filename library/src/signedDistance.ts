import type { Vec2 } from './types.js'

export function segmentClosest(p: Vec2, a: Vec2, b: Vec2): { dist: number; t: number } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len2 = dx * dx + dy * dy
  let t = 0
  if (len2 > 0) t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2
  if (t < 0) t = 0
  else if (t > 1) t = 1
  const cx = a.x + t * dx
  const cy = a.y + t * dy
  const ex = p.x - cx
  const ey = p.y - cy
  return { dist: Math.hypot(ex, ey), t }
}
