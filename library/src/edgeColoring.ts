// Color flattened edges into R/G/B groups so that the median-of-3
// reconstruction in the fragment shader yields sharp corners.
//
// Strategy:
//   • Detect corners by tangent angle change (default threshold ~3°).
//   • Group consecutive non-corner edges into "smooth runs".
//   • Color runs so adjacent runs share at most one color channel —
//     the property median-of-3 exploits to keep corners sharp.

import { EDGE_CYAN, EDGE_MAGENTA, EDGE_WHITE, EDGE_YELLOW } from './types.js'

import type { Contour, LineEdge } from './types.js'

const angleThresholdCos = (deg: number) => Math.cos((deg * Math.PI) / 180)

function tangent(e: LineEdge): { x: number; y: number } {
  const dx = e.p1.x - e.p0.x
  const dy = e.p1.y - e.p0.y
  const len = Math.hypot(dx, dy)
  if (len === 0) return { x: 1, y: 0 }
  return { x: dx / len, y: dy / len }
}

function isCorner(prev: LineEdge, next: LineEdge, cosThreshold: number): boolean {
  const a = tangent(prev)
  const b = tangent(next)
  return a.x * b.x + a.y * b.y < cosThreshold
}

export function colorEdges(contours: Contour[], cornerAngleDeg = 3): void {
  const cosThreshold = angleThresholdCos(cornerAngleDeg)
  for (const contour of contours) {
    const n = contour.edges.length
    if (n === 0) continue
    if (n === 1) {
      contour.edges[0].color = EDGE_WHITE
      continue
    }

    // Find edges that begin a new run (corner from previous to current edge).
    const corners: number[] = []
    for (let i = 0; i < n; i++) {
      const prev = contour.edges[(i - 1 + n) % n]
      const cur = contour.edges[i]
      if (isCorner(prev, cur, cosThreshold)) corners.push(i)
    }

    if (corners.length === 0) {
      // Fully smooth contour (e.g. a circle). All channels carry the
      // same SDF; rendering still works, sharpness equals an SDF.
      for (let i = 0; i < n; i++) contour.edges[i].color = EDGE_WHITE
      continue
    }

    // Map each edge to a run index by walking starting at corners[0].
    const runIndex = Array.from<number>({ length: n }).fill(0)
    const cornerSet = new Set(corners)
    let curRun = 0
    for (let i = 0; i < n; i++) {
      const idx = (corners[0] + i) % n
      if (i > 0 && cornerSet.has(idx)) curRun++
      runIndex[idx] = curRun
    }
    const totalRuns = curRun + 1

    if (totalRuns === 1) {
      // Single corner / single run → just use WHITE.
      for (let i = 0; i < n; i++) contour.edges[i].color = EDGE_WHITE
      continue
    }

    // Even runs → alternate M/Y. Odd runs (≥3) → C, then alternate Y/M.
    // Both schemes guarantee adjacent runs share exactly one channel,
    // including across the wrap-around.
    for (let i = 0; i < n; i++) {
      const r = runIndex[i]
      let color: number
      if (totalRuns % 2 === 0) {
        color = r % 2 === 0 ? EDGE_MAGENTA : EDGE_YELLOW
      } else if (r === 0) {
        color = EDGE_CYAN
      } else {
        color = r % 2 === 1 ? EDGE_YELLOW : EDGE_MAGENTA
      }
      contour.edges[i].color = color
    }
  }
}
