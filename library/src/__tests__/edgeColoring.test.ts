import { describe, expect, test } from 'bun:test'

import { colorEdges } from '../edgeColoring.ts'
import { EDGE_WHITE } from '../types.ts'

import type { Contour } from '../types.ts'

describe('colorEdges', () => {
  test('assigns colors that share at most one channel between adjacent runs', () => {
    // Square — 4 corners, each edge a separate run.
    const contour: Contour = {
      edges: [
        { p0: { x: 0, y: 0 }, p1: { x: 1, y: 0 }, color: EDGE_WHITE },
        { p0: { x: 1, y: 0 }, p1: { x: 1, y: 1 }, color: EDGE_WHITE },
        { p0: { x: 1, y: 1 }, p1: { x: 0, y: 1 }, color: EDGE_WHITE },
        { p0: { x: 0, y: 1 }, p1: { x: 0, y: 0 }, color: EDGE_WHITE },
      ],
    }
    colorEdges([contour])
    for (let i = 0; i < contour.edges.length; i++) {
      const cur = contour.edges[i].color
      const next = contour.edges[(i + 1) % contour.edges.length].color
      const shared = cur & next
      // Adjacent runs must share at most one channel.
      const popcount = (shared & 1) + ((shared >> 1) & 1) + ((shared >> 2) & 1)
      expect(popcount).toBeLessThanOrEqual(1)
    }
  })
})
