export interface Vec2 {
  x: number
  y: number
}

export interface LineEdge {
  p0: Vec2
  p1: Vec2
  color: number
}

export interface Contour {
  edges: LineEdge[]
}

export interface Shape {
  contours: Contour[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

// One fill-color group from a layered SVG parse. Contours are in
// document order so caller can render layers back-to-front.
export interface ShapeLayer {
  fill: string
  contours: Contour[]
}

// One "line" group from a layered SVG parse, keyed by (color, width).
// Width is in SVG units (the same coordinate space as `bounds`).
//
// "Line" here is the umbrella term for anything stroked: SVG `stroke`s on
// shapes, plus the natively-open `<line>` and `<polyline>` elements.
// They produce the same kind of texture (an unsigned distance field — see
// the readme for the fill-vs-line distinction).
export interface LineLayer {
  color: string
  width: number
  contours: Contour[]
}

export interface LayeredShape {
  layers: ShapeLayer[]
  lineLayers: LineLayer[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export const EDGE_RED = 0b001
export const EDGE_GREEN = 0b010
export const EDGE_BLUE = 0b100
export const EDGE_YELLOW = EDGE_RED | EDGE_GREEN
export const EDGE_MAGENTA = EDGE_RED | EDGE_BLUE
export const EDGE_CYAN = EDGE_GREEN | EDGE_BLUE
export const EDGE_WHITE = EDGE_RED | EDGE_GREEN | EDGE_BLUE
