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

export const EDGE_RED = 0b001
export const EDGE_GREEN = 0b010
export const EDGE_BLUE = 0b100
export const EDGE_YELLOW = EDGE_RED | EDGE_GREEN
export const EDGE_MAGENTA = EDGE_RED | EDGE_BLUE
export const EDGE_CYAN = EDGE_GREEN | EDGE_BLUE
export const EDGE_WHITE = EDGE_RED | EDGE_GREEN | EDGE_BLUE
