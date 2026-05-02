// Public entry point for svg-to-msdf.
//
// Two surfaces:
//   • High-level — `bakeSvgToMsdf()` + `SvgMsdfLoader` + `MsdfMaterial`
//     for drop-in MSDF rendering in Three.js / R3F apps.
//   • Low-level  — `parseSvg`, `colorEdges` and the path/Bézier helpers
//     for callers that want to drive the pipeline themselves.

export {
  bakeSvgToMsdf,
  bakeSvgToMsdfLayered,
  type BakeOptions,
  type BakeResult,
  type LayeredBakeLayer,
  type LayeredBakeResult,
} from './bake.js'
export { SvgMsdfLoader, type SvgMsdfMetadata } from './SvgMsdfLoader.js'
export { MsdfMaterial, type MsdfMaterialParameters } from './MsdfMaterial.js'

export { parseSvg, parseSvgLayered } from './parseSvg.js'
export { parsePath, type PathCommand } from './pathParser.js'
export { flattenCubic, flattenQuadratic } from './flatten.js'
export { colorEdges } from './edgeColoring.js'
export {
  type Vec2,
  type LineEdge,
  type Contour,
  type Shape,
  type ShapeLayer,
  type LayeredShape,
  EDGE_RED,
  EDGE_GREEN,
  EDGE_BLUE,
  EDGE_YELLOW,
  EDGE_MAGENTA,
  EDGE_CYAN,
  EDGE_WHITE,
} from './types.js'
