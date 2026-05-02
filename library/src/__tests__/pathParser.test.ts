import { describe, expect, test } from 'bun:test'

import { parsePath } from '../pathParser.ts'

describe('parsePath', () => {
  test('parses simple absolute moveto/lineto', () => {
    const cmds = parsePath('M 10 20 L 30 40 Z')
    expect(cmds).toEqual([{ type: 'M', x: 10, y: 20 }, { type: 'L', x: 30, y: 40 }, { type: 'Z' }])
  })

  test('treats subsequent coordinates after M as implicit L', () => {
    const cmds = parsePath('M 0 0 1 1 2 2')
    expect(cmds).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 1, y: 1 },
      { type: 'L', x: 2, y: 2 },
    ])
  })

  test('resolves H and V to lineto', () => {
    const cmds = parsePath('M 0 0 H 10 V 5')
    expect(cmds).toEqual([
      { type: 'M', x: 0, y: 0 },
      { type: 'L', x: 10, y: 0 },
      { type: 'L', x: 10, y: 5 },
    ])
  })

  test('resolves relative commands using the current point', () => {
    const cmds = parsePath('M 10 10 l 5 0 l 0 5')
    expect(cmds).toEqual([
      { type: 'M', x: 10, y: 10 },
      { type: 'L', x: 15, y: 10 },
      { type: 'L', x: 15, y: 15 },
    ])
  })

  test('reflects the previous control point in S', () => {
    const cmds = parsePath('M 0 0 C 10 0 10 10 20 10 S 30 0 40 0')
    expect(cmds.length).toBe(3)
    const second = cmds[2]
    expect(second.type).toBe('C')
    if (second.type === 'C') {
      // Reflection of (10, 10) around (20, 10) is (30, 10).
      expect(second.x1).toBe(30)
      expect(second.y1).toBe(10)
    }
  })
})
