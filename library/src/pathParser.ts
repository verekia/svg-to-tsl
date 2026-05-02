// Parse an SVG path `d` string into a sequence of absolute commands with
// numeric arguments. Handles M/L/H/V/C/S/Q/T/A/Z (and lowercase relatives).

export type PathCommand =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Q'; x1: number; y1: number; x: number; y: number }
  | { type: 'Z' }

const COMMAND_ARG_COUNT: Record<string, number> = {
  M: 2,
  m: 2,
  L: 2,
  l: 2,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  C: 6,
  c: 6,
  S: 4,
  s: 4,
  Q: 4,
  q: 4,
  T: 2,
  t: 2,
  A: 7,
  a: 7,
  Z: 0,
  z: 0,
}

function tokenize(d: string): Array<string | number> {
  const tokens: Array<string | number> = []
  const re = /([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][+-]?\d+)?)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(d)) !== null) {
    if (match[1]) tokens.push(match[1])
    else if (match[2]) tokens.push(parseFloat(match[2]))
  }
  return tokens
}

// Convert an SVG arc to a sequence of cubic Béziers.
// Reference: https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angleDeg: number,
  largeArc: number,
  sweep: number,
  x2: number,
  y2: number,
): Array<[number, number, number, number, number, number]> {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]]
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const phi = (angleDeg * Math.PI) / 180
  const cosPhi = Math.cos(phi)
  const sinPhi = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const x1p = cosPhi * dx + sinPhi * dy
  const y1p = -sinPhi * dx + cosPhi * dy
  let lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
  if (lambda > 1) {
    const s = Math.sqrt(lambda)
    rx *= s
    ry *= s
  }
  const sign = largeArc === sweep ? -1 : 1
  let sq = (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)
  sq = sq < 0 ? 0 : sq
  const coef = sign * Math.sqrt(sq)
  const cxp = (coef * (rx * y1p)) / ry
  const cyp = (coef * -(ry * x1p)) / rx
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy
    const len = Math.sqrt((ux * ux + uy * uy) * (vx * vx + vy * vy))
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)))
    if (ux * vy - uy * vx < 0) a = -a
    return a
  }
  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
  let dTheta = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
  if (sweep === 0 && dTheta > 0) dTheta -= 2 * Math.PI
  if (sweep === 1 && dTheta < 0) dTheta += 2 * Math.PI

  const segs = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)))
  const cubics: Array<[number, number, number, number, number, number]> = []
  const dt = dTheta / segs
  const t = (4 / 3) * Math.tan(dt / 4)
  let a1 = theta1
  let cosA1 = Math.cos(a1)
  let sinA1 = Math.sin(a1)
  let px = cx + cosPhi * (rx * cosA1) - sinPhi * (ry * sinA1)
  let py = cy + sinPhi * (rx * cosA1) + cosPhi * (ry * sinA1)
  for (let i = 0; i < segs; i++) {
    const a2 = a1 + dt
    const cosA2 = Math.cos(a2)
    const sinA2 = Math.sin(a2)
    const qx = cx + cosPhi * (rx * cosA2) - sinPhi * (ry * sinA2)
    const qy = cy + sinPhi * (rx * cosA2) + cosPhi * (ry * sinA2)
    const c1x = px + cosPhi * (-rx * sinA1 * t) - sinPhi * (ry * cosA1 * t)
    const c1y = py + sinPhi * (-rx * sinA1 * t) + cosPhi * (ry * cosA1 * t)
    const c2x = qx - cosPhi * (-rx * sinA2 * t) + sinPhi * (ry * cosA2 * t)
    const c2y = qy - sinPhi * (-rx * sinA2 * t) - cosPhi * (ry * cosA2 * t)
    cubics.push([c1x, c1y, c2x, c2y, qx, qy])
    a1 = a2
    cosA1 = cosA2
    sinA1 = sinA2
    px = qx
    py = qy
  }
  return cubics
}

export function parsePath(d: string): PathCommand[] {
  const tokens = tokenize(d)
  const out: PathCommand[] = []
  let i = 0
  let cx = 0
  let cy = 0
  let startX = 0
  let startY = 0
  let prevC2x = 0
  let prevC2y = 0
  let prevQ1x = 0
  let prevQ1y = 0
  let prevCmd: string | null = null
  let lastCmd: string | null = null

  const num = () => tokens[i++] as number

  while (i < tokens.length) {
    const t = tokens[i]
    let cmd: string
    if (typeof t === 'string') {
      cmd = t
      i++
      lastCmd = cmd
    } else {
      // Repeat last command (M -> L, m -> l).
      if (lastCmd === 'M') cmd = 'L'
      else if (lastCmd === 'm') cmd = 'l'
      else cmd = lastCmd ?? 'L'
    }
    const argCount = COMMAND_ARG_COUNT[cmd] ?? 0
    if (typeof tokens[i] !== 'number' && argCount > 0) {
      i++
      continue
    }

    switch (cmd) {
      case 'M':
      case 'm': {
        const x = num()
        const y = num()
        const ax = cmd === 'm' ? cx + x : x
        const ay = cmd === 'm' ? cy + y : y
        cx = ax
        cy = ay
        startX = ax
        startY = ay
        out.push({ type: 'M', x: ax, y: ay })
        break
      }
      case 'L':
      case 'l': {
        const x = num()
        const y = num()
        const ax = cmd === 'l' ? cx + x : x
        const ay = cmd === 'l' ? cy + y : y
        cx = ax
        cy = ay
        out.push({ type: 'L', x: ax, y: ay })
        break
      }
      case 'H':
      case 'h': {
        const x = num()
        const ax = cmd === 'h' ? cx + x : x
        cx = ax
        out.push({ type: 'L', x: ax, y: cy })
        break
      }
      case 'V':
      case 'v': {
        const y = num()
        const ay = cmd === 'v' ? cy + y : y
        cy = ay
        out.push({ type: 'L', x: cx, y: ay })
        break
      }
      case 'C':
      case 'c': {
        const x1 = num()
        const y1 = num()
        const x2 = num()
        const y2 = num()
        const x = num()
        const y = num()
        const ox = cmd === 'c' ? cx : 0
        const oy = cmd === 'c' ? cy : 0
        out.push({ type: 'C', x1: ox + x1, y1: oy + y1, x2: ox + x2, y2: oy + y2, x: ox + x, y: oy + y })
        prevC2x = ox + x2
        prevC2y = oy + y2
        cx = ox + x
        cy = oy + y
        break
      }
      case 'S':
      case 's': {
        const x2 = num()
        const y2 = num()
        const x = num()
        const y = num()
        const ox = cmd === 's' ? cx : 0
        const oy = cmd === 's' ? cy : 0
        const reflectC = prevCmd === 'C' || prevCmd === 'S'
        const x1 = reflectC ? 2 * cx - prevC2x : cx
        const y1 = reflectC ? 2 * cy - prevC2y : cy
        out.push({ type: 'C', x1, y1, x2: ox + x2, y2: oy + y2, x: ox + x, y: oy + y })
        prevC2x = ox + x2
        prevC2y = oy + y2
        cx = ox + x
        cy = oy + y
        break
      }
      case 'Q':
      case 'q': {
        const x1 = num()
        const y1 = num()
        const x = num()
        const y = num()
        const ox = cmd === 'q' ? cx : 0
        const oy = cmd === 'q' ? cy : 0
        out.push({ type: 'Q', x1: ox + x1, y1: oy + y1, x: ox + x, y: oy + y })
        prevQ1x = ox + x1
        prevQ1y = oy + y1
        cx = ox + x
        cy = oy + y
        break
      }
      case 'T':
      case 't': {
        const x = num()
        const y = num()
        const ox = cmd === 't' ? cx : 0
        const oy = cmd === 't' ? cy : 0
        const reflectQ = prevCmd === 'Q' || prevCmd === 'T'
        const x1 = reflectQ ? 2 * cx - prevQ1x : cx
        const y1 = reflectQ ? 2 * cy - prevQ1y : cy
        out.push({ type: 'Q', x1, y1, x: ox + x, y: oy + y })
        prevQ1x = x1
        prevQ1y = y1
        cx = ox + x
        cy = oy + y
        break
      }
      case 'A':
      case 'a': {
        const rx = num()
        const ry = num()
        const angle = num()
        const largeArc = num()
        const sweep = num()
        const x = num()
        const y = num()
        const ox = cmd === 'a' ? cx : 0
        const oy = cmd === 'a' ? cy : 0
        const ax = ox + x
        const ay = oy + y
        const cubics = arcToCubics(cx, cy, rx, ry, angle, largeArc, sweep, ax, ay)
        for (const c of cubics) {
          out.push({ type: 'C', x1: c[0], y1: c[1], x2: c[2], y2: c[3], x: c[4], y: c[5] })
        }
        // Per the SVG spec, S/s does not reflect when the previous command
        // is A/a, so we don't update `prevC2*` here.
        cx = ax
        cy = ay
        break
      }
      case 'Z':
      case 'z': {
        out.push({ type: 'Z' })
        cx = startX
        cy = startY
        break
      }
      default:
        // Unknown — skip a token to avoid infinite loop.
        i++
        break
    }
    prevCmd = cmd.toUpperCase()
  }
  return out
}
