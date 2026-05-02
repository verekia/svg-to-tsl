import { describe, expect, test } from 'bun:test'

import { flattenCubic, flattenQuadratic } from '../flatten.ts'

import type { Vec2 } from '../types.ts'

describe('flatten', () => {
  test('emits at least the endpoint for a degenerate cubic', () => {
    const out: Vec2[] = []
    flattenCubic({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 }, 0.25, out)
    expect(out.at(-1)).toEqual({ x: 1, y: 0 })
  })

  test('quadratic with collinear control point emits one segment', () => {
    const out: Vec2[] = []
    flattenQuadratic({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, 0.25, out)
    expect(out.length).toBe(1)
    expect(out[0]).toEqual({ x: 2, y: 0 })
  })

  test('curved cubic produces multiple segments', () => {
    const out: Vec2[] = []
    flattenCubic({ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }, 0.5, out)
    expect(out.length).toBeGreaterThan(2)
  })
})
