# svg-to-msdf

Bake an SVG into a Multi-channel Signed Distance Field (MSDF) texture in the browser, then render it as a sharp, infinitely scalable vector texture on any 3D mesh — perfect for cheap logos, icons and decals on Three.js / React Three Fiber meshes.

The point of MSDF: a 256×256 texture renders crisp at any zoom level, because each texel encodes the distance to the nearest edge instead of a color sample. Vector quality, raster performance.

> [!WARNING]
> This is 100% vibe-coded. The code is completely unreviewed, under-tested, it will probably crash on many SVGs, and this library is very likely to go unmaintained. Do not use for anything important.

> [!IMPORTANT]
> **What's supported in the SVG**: shape paths (`<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>`, `<line>`), `fill`, and `stroke` / `stroke-width` (round caps + joins only). See the [feature support table](#supported-svg-features) below for the full list.
>
> **Two layer kinds**: the bake produces two arrays — `layers` (fills, signed MSDF) and `lineLayers` (anything stroked: SVG `stroke` attributes plus the natively-open `<line>` and `<polyline>` elements; unsigned SDF). They use different texture encodings and different material flags (`line: true` for the unsigned kind). Internally we use **"line"** as the umbrella term for both stroked shapes and `<line>`/`<polyline>` since they bake identically.
>
> **Cost of multiple colors**: there is no way to pack multiple colors into a single MSDF — the R/G/B channels are spent on the per-channel signed distances used for sharp-corner reconstruction. So a multi-color SVG produces **one texture and one stacked draw call per unique fill color** (and one more per unique line color + width). A 3-color logo = 3 textures and 3 draw calls. Fine for icons/logos; pathological for SVGs with hundreds of unique fills — collapse colors first if that's your case.

## Install

```sh
npm install svg-to-msdf
# or
pnpm add svg-to-msdf
# or
bun add svg-to-msdf
```

`three` is a peer dependency (`>=0.170`).

## Materials

The renderer ships as a family of **`Msdf*NodeMaterial`** classes — one per stock three.js node-material lighting model. Pick the one whose shading you want; they all share the same MSDF coverage logic and same prop API.

| Class                      | Extends                    | Use case                                  |
| -------------------------- | -------------------------- | ----------------------------------------- |
| `MsdfBasicNodeMaterial`    | `MeshBasicNodeMaterial`    | Unlit (icons, UI, decals) — **default**   |
| `MsdfLambertNodeMaterial`  | `MeshLambertNodeMaterial`  | Cheap diffuse-only lighting               |
| `MsdfMatcapNodeMaterial`   | `MeshMatcapNodeMaterial`   | Fake shading from a matcap texture        |
| `MsdfPhongNodeMaterial`    | `MeshPhongNodeMaterial`    | Classic specular highlights               |
| `MsdfPhysicalNodeMaterial` | `MeshPhysicalNodeMaterial` | Full PBR (clearcoat, sheen, transmission) |
| `MsdfStandardNodeMaterial` | `MeshStandardNodeMaterial` | PBR baseline (metalness/roughness)        |
| `MsdfToonNodeMaterial`     | `MeshToonNodeMaterial`     | Cel-shaded                                |
| `MsdfSpriteNodeMaterial`   | `SpriteNodeMaterial`       | Camera-facing billboards                  |

All of them are NodeMaterial-based, so they run natively under `WebGPURenderer` and via `WebGLRenderer`'s node fallback.

## Usage

### Bake (one-time)

```ts
import { bakeSvgToMsdfLayered } from 'svg-to-msdf'

const svg = await fetch('/logo.svg').then(r => r.text())
const { layers, lineLayers, width, height } = await bakeSvgToMsdfLayered(svg, { size: 256, range: 4 })

// layers:     [{ fill: '#1f6feb', texture, ... }, ...] — one per unique fill color (signed MSDF)
// lineLayers: [{ color: '#000', width: 2, halfWidthNorm, texture, ... }, ...]
//             — one per unique stroke (color, width); covers SVG `stroke` and `<line>`/`<polyline>`.
//             Unsigned SDF — the material needs `line: true` + `lineHalfWidth: halfWidthNorm`.
```

### Render — vanilla three.js

```ts
import { Mesh, PlaneGeometry, Scene } from 'three'
import { MsdfBasicNodeMaterial } from 'svg-to-msdf'

const scene = new Scene()

// Fills first (signed MSDF).
for (const [i, layer] of layers.entries()) {
  const mat = new MsdfBasicNodeMaterial({ map: layer.texture, color: layer.fill })
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat)
  mesh.renderOrder = i + 1
  scene.add(mesh)
}

// Then lines on top. The line texture is alpha-mask style (white on the
// path, black far from it); pass the baker's `halfWidthNorm` as
// `lineHalfWidth` and the material derives the right threshold.
for (const [i, layer] of lineLayers.entries()) {
  const mat = new MsdfBasicNodeMaterial({
    map: layer.texture,
    color: layer.color,
    lineHalfWidth: layer.halfWidthNorm,
  })
  const mesh = new Mesh(new PlaneGeometry(2, 2), mat)
  mesh.renderOrder = layers.length + i + 1
  scene.add(mesh)
}

// Lit variants (MsdfStandardNodeMaterial / MsdfPhongNodeMaterial / …)
// take the same constructor parameters.
```

### Render — React Three Fiber (declarative)

Register the materials once via R3F's `extend` so they become JSX elements:

```tsx
// _app.tsx (or your root)
import { extend } from '@react-three/fiber'
import {
  MsdfBasicNodeMaterial,
  MsdfLambertNodeMaterial,
  MsdfMatcapNodeMaterial,
  MsdfPhongNodeMaterial,
  MsdfPhysicalNodeMaterial,
  MsdfStandardNodeMaterial,
  MsdfToonNodeMaterial,
  MsdfSpriteNodeMaterial,
} from 'svg-to-msdf'

extend({
  MsdfBasicNodeMaterial,
  MsdfLambertNodeMaterial,
  MsdfMatcapNodeMaterial,
  MsdfPhongNodeMaterial,
  MsdfPhysicalNodeMaterial,
  MsdfStandardNodeMaterial,
  MsdfToonNodeMaterial,
  MsdfSpriteNodeMaterial,
})
```

Then use them like any built-in three element:

```tsx
import { Canvas } from '@react-three/fiber/webgpu'

function Logo({ layers, lineLayers }) {
  return (
    <Canvas>
      <ambientLight intensity={Math.PI} />

      {/* Fill layers — signed MSDF, the default mode. */}
      {layers.map((layer, i) => (
        <mesh key={`fill-${i}`} renderOrder={i + 1}>
          <planeGeometry args={[2, 2]} />
          <msdfBasicNodeMaterial map={layer.texture} color={layer.fill} />
        </mesh>
      ))}

      {/* Line layers — alpha-mask textures; `lineHalfWidth` derives the
          threshold so the band matches the original stroke width. */}
      {lineLayers.map((layer, i) => (
        <mesh key={`line-${i}`} renderOrder={layers.length + i + 1}>
          <planeGeometry args={[2, 2]} />
          <msdfBasicNodeMaterial map={layer.texture} color={layer.color} lineHalfWidth={layer.halfWidthNorm} />
        </mesh>
      ))}

      {/* Swap `<msdfBasicNodeMaterial>` for any of the lit variants — same props. */}
    </Canvas>
  )
}
```

For TypeScript, declare the JSX intrinsics once (e.g. in an ambient `r3f-msdf.d.ts`):

```ts
import type { ThreeElement } from '@react-three/fiber'
import type { MsdfBasicNodeMaterial /* ... and the other 7 */ } from 'svg-to-msdf'

declare module '@react-three/fiber' {
  interface ThreeElements {
    msdfBasicNodeMaterial: ThreeElement<typeof MsdfBasicNodeMaterial>
    // ...one entry per variant you use
  }
}
```

### Material props

Every variant accepts the same constructor parameters and exposes the same setters:

| Prop            | Type                  | Default    | Notes                                                                                                                                                                      |
| --------------- | --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `map`           | `Texture`             | `null`     | The MSDF / SDF texture (the per-layer `.texture`)                                                                                                                          |
| `color`         | `ColorRepresentation` | `0xffffff` | Foreground color                                                                                                                                                           |
| `opacity`       | `number`              | `1`        | Multiplied into the coverage alpha                                                                                                                                         |
| `transparent`   | `boolean`             | `true`     | Required for the soft-edge alpha to blend                                                                                                                                  |
| `threshold`     | `number`              | `0.5`      | Iso-level for the median-of-3 reconstruction. Default is right for fills. For line layers, set this to `1 - halfWidthNorm` (or use `lineHalfWidth` instead — same effect). |
| `lineHalfWidth` | `number`              | —          | Convenience: writes `1 - x` into `threshold`. Pass the baker's `halfWidthNorm` for an exact match to the original stroke width.                                            |

Both fill and line textures share the same alpha-mask convention (white = covered, black = transparent), so a single shader handles both. Pick the right threshold per layer kind and you're done — no constructor flag, no remount needed when switching modes. All props are mutable via direct assignment (`material.color = '#facc15'`, `material.lineHalfWidth = 0.05`) and propagate to the underlying TSL uniforms.

### `SvgMsdfLoader` — Three.js Loader

```ts
import { SvgMsdfLoader } from 'svg-to-msdf'

const loader = new SvgMsdfLoader()
loader.size = 256
loader.range = 4
const texture = await loader.loadAsync('/logo.svg')
```

### `rasterizeMsdf` — get raw pixels (use anywhere)

This library is three.js-focused (the renderer materials extend `Mesh*NodeMaterial`), but the **bake pipeline** doesn't depend on the renderer. If you want to PNG-encode the result, upload to a WebGPU texture yourself, ship the bytes to a non-three engine (Babylon, PlayCanvas, native renderer, …) or run it offline, drive the bake functions directly and you get a `Uint8ClampedArray` of RGBA8 back:

```ts
import { parseSvgLayered, colorEdges, rasterizeMsdf } from 'svg-to-msdf'

const svgText = await fetch('/logo.svg').then(r => r.text())
const layered = parseSvgLayered(svgText)

for (const layer of layered.layers) {
  // Required — without this every edge stays in all 3 channels and you get
  // a plain SDF, not an MSDF (no sharp-corner reconstruction).
  colorEdges(layer.contours)

  const { pixels, width, height } = rasterizeMsdf(layer.contours, layered.bounds, {
    size: 256,
    range: 4,
  })

  // pixels: Uint8ClampedArray of length width*height*4 (RGBA8).
  // Do whatever you want with it — encode as PNG, upload to a GPU texture,
  // hand off to another renderer, write to disk, etc.
  console.log(layer.fill, width, height, pixels.byteLength)
}
```

A few uses for `pixels`:

```ts
// 1. Encode to a PNG blob in the browser via <canvas>.
const canvas = new OffscreenCanvas(width, height)
const ctx = canvas.getContext('2d')!
const img = ctx.createImageData(width, height)
img.data.set(pixels)
ctx.putImageData(img, 0, 0)
const blob = await canvas.convertToBlob({ type: 'image/png' })

// 2. Upload directly to a WebGPU texture.
const tex = device.createTexture({
  size: [width, height, 1],
  format: 'rgba8unorm',
  usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
})
device.queue.writeTexture({ texture: tex }, pixels, { bytesPerRow: width * 4 }, [width, height])

// 3. Babylon.js / PlayCanvas / etc. — feed `pixels` to whichever
// "raw bytes → texture" API the engine exposes.
```

`bakeSvgToMsdfLayered` is just a convenience wrapper around the same pipeline that also wraps each layer in a three.js `CanvasTexture` with the right filter / color-space settings — so you don't have to wire that up yourself if you _are_ using three.

> three remains a peer dependency either way; you just don't have to import the materials or the loader if you only need the raw bytes.

## Bake options

| Option      | Type      | Default | Description                                                          |
| ----------- | --------- | ------- | -------------------------------------------------------------------- |
| `size`      | `number`  | `256`   | Output texture resolution (size × size pixels)                       |
| `range`     | `number`  | `4`     | Distance range (in SVG path units) — bigger = smoother, less precise |
| `padding`   | `number`  | `8`     | Extra padding (in pixels) around the SVG bounding box                |
| `flipY`     | `boolean` | `true`  | Flip vertically (matches Three.js convention)                        |
| `tolerance` | `number`  | `0.25`  | Curve flattening tolerance (smaller = more line segments)            |

`fill` resolution walks `style="fill: …"` → `fill="…"` → inherited from parent `<g>` → defaults to black. Shapes with `fill="none"` are skipped. All shapes sharing a fill across the document are merged into one layer.

## Supported SVG features

Quick reference for what the parser actually reads. Anything not in the **supported** column is silently ignored (the bake won't crash; the result just won't match what you'd see in a browser).

### Elements

| Element                                | Supported | Notes                                         |
| -------------------------------------- | :-------: | --------------------------------------------- |
| `<svg>`                                |    ✅     | `viewBox`, `width`/`height` used for bounds   |
| `<g>`                                  |    ✅     | Walked recursively; inherits `fill`/`stroke`  |
| `<path>`                               |    ✅     | M/L/C/Q/Z commands; H/V/S/T/A not supported   |
| `<rect>`                               |    ✅     | Including `rx`/`ry` rounded corners           |
| `<circle>`                             |    ✅     |                                               |
| `<ellipse>`                            |    ✅     |                                               |
| `<polygon>`                            |    ✅     |                                               |
| `<polyline>`                           |    ✅     | Useful as stroked element                     |
| `<line>`                               |    ✅     | Useful as stroked element                     |
| `<text>`, `<tspan>`                    |    ❌     | Convert text to paths in your editor first    |
| `<image>`                              |    ❌     | Bitmap SVG content                            |
| `<use>`, `<defs>`, `<symbol>`          |    ❌     | No reference resolution                       |
| `<linearGradient>`, `<radialGradient>` |    ❌     | One solid color per layer only                |
| `<pattern>`                            |    ❌     |                                               |
| `<mask>`, `<clipPath>`                 |    ❌     | And `mask`/`clip-path` attributes             |
| `<filter>`                             |    ❌     | And `filter` attribute                        |
| `<style>` (CSS)                        |    ❌     | Only inline `style="..."` attributes are read |
| Animations (SMIL / CSS)                |    ❌     |                                               |

### Style attributes

| Attribute                                     | Supported | Notes                                                       |
| --------------------------------------------- | :-------: | ----------------------------------------------------------- |
| `fill` (color)                                |    ✅     | Hex, named colors, `rgb()`. `none`/`transparent` skips fill |
| `stroke` (color)                              |    ✅     | Same as fill                                                |
| `stroke-width`                                |    ✅     | In SVG units; inherited from parent `<g>`                   |
| `style="fill: …; stroke: …"`                  |    ✅     | Inline style with `fill` / `stroke` / `stroke-width` only   |
| `transform`                                   |    ❌     | `translate`, `rotate`, `scale`, `matrix(...)` all ignored   |
| `opacity` / `fill-opacity` / `stroke-opacity` |    ❌     | Set `opacity` on the material instead                       |
| `fill-rule`                                   |    ⚠️     | Always treated as even-odd (ray-cast point-in-polygon)      |
| `stroke-linecap`                              |    ⚠️     | Always **round** (no `butt` / `square`)                     |
| `stroke-linejoin`                             |    ⚠️     | Always **round** (no `miter` / `bevel`)                     |
| `stroke-miterlimit`                           |    ❌     |                                                             |
| `stroke-dasharray` / `dashoffset`             |    ❌     | No dashed strokes                                           |
| `paint-order`                                 |    ❌     | Fill always renders before stroke                           |
| `vector-effect`                               |    ❌     | E.g. `non-scaling-stroke`                                   |
| `pathLength`                                  |    ❌     |                                                             |

### Path data (in `<path d="…">`)

| Command                                         | Supported | Notes                                               |
| ----------------------------------------------- | :-------: | --------------------------------------------------- |
| `M` / `m` (moveto)                              |    ✅     |                                                     |
| `L` / `l` (lineto)                              |    ✅     |                                                     |
| `C` / `c` (cubic Bézier)                        |    ✅     | Flattened to line segments at `tolerance` precision |
| `Q` / `q` (quadratic Bézier)                    |    ✅     | Same                                                |
| `Z` / `z` (closepath)                           |    ✅     |                                                     |
| `H` / `h`, `V` / `v` (horizontal/vertical line) |    ❌     | Use `L` instead                                     |
| `S` / `s`, `T` / `t` (smooth Bézier)            |    ❌     |                                                     |
| `A` / `a` (elliptical arc)                      |    ❌     | Convert arcs to cubic Béziers in your editor        |

### Other

| Behavior                | Notes                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| Self-intersecting paths | Undefined results — the even-odd test produces holes/inverted regions  |
| Open paths with fill    | Fill is undefined; rasterizer's point-in-polygon test isn't meaningful |
| Coordinate units        | Treated as user units (no `pt`/`mm`/`%` resolution)                    |

## vs three.js's `SVGLoader`

Both render SVGs in three.js but use opposite strategies:

- **`SVGLoader`** turns each path into a triangulated `ShapeGeometry` — real polygons in the scene.
- **`svg-to-msdf`** turns each path into an MSDF texture — applied to a single quad (or any UV'd surface).

|                                      | `SVGLoader`                           | `svg-to-msdf`                                     |
| ------------------------------------ | ------------------------------------- | ------------------------------------------------- |
| Output                               | Triangulated mesh per fill            | Texture per fill, on a quad                       |
| Vertex count                         | Scales with shape complexity          | 4 verts per layer, always                         |
| Texture VRAM                         | None                                  | `size² × 4 × layers` (e.g. 256² × 4 × 3 ≈ 768 KB) |
| Sharp at any zoom                    | Yes — real geometry                   | Yes — distance field reconstruction               |
| Anti-aliasing                        | MSAA (depends on renderer)            | Analytic, built into the shader                   |
| Map onto a 3D surface                | Awkward — mesh is a flat 2D shape     | Trivial — it's just a texture, UV any geometry    |
| Strokes                              | Supported                             | **Not supported**                                 |
| Self-intersecting / even-odd fills   | Handled                               | **Undefined / broken**                            |
| Effects (outline, glow, drop-shadow) | Need extra geometry / post-processing | One-liner in the shader from the distance value   |
| Per-frame cost                       | Lots of triangles                     | One textured quad per color                       |
| Bake cost                            | Tessellation on load (cheap)          | CPU rasterization on load (more expensive)        |

**Pick `SVGLoader`** if you need strokes / complex fill rules, you're rendering flat 2D content where the SVG basically _is_ the geometry, or you want zero texture VRAM.

**Pick `svg-to-msdf`** if you want to put a logo/icon/decal on a **3D surface**, drive **shader effects** off the distance value (animated outline, glow, dissolve), use it on **billboards/sprites/particles**, or pay a constant per-frame cost regardless of original SVG complexity.

Roughly: `SVGLoader` is a _vector-rendering_ tool; `svg-to-msdf` is a _texture-baking_ tool.

## How it works

1. Parse the SVG with `DOMParser`, walk every `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>` and `<line>`.
2. Flatten cubic / quadratic Bézier segments into straight lines via adaptive subdivision.
3. Color-code edges into R, G, B channels using Chlumský-style edge coloring (corners separate the channels, smooth tangents share them).
4. For each output pixel: take the signed distance to the nearest edge per channel, packed into [0, 1].
5. The material samples the texture, takes the median of the three channels, and computes coverage with `fwidth` for analytic AA — sharp corners, smooth edges.

## Limitations

- CPU baking is O(W × H × N) — fine for small icons / logos, slow for huge SVGs.
- Multi-color SVGs cost one MSDF texture and one stacked draw call per unique fill / unique (stroke color, width). See the [Important callout](#svg-to-msdf) and [feature table](#supported-svg-features) for the full picture.

## Acknowledgements

The MSDF technique was introduced by [Viktor Chlumský](https://github.com/Chlumsky/msdfgen). This library is a from-scratch TypeScript port of the core idea (edge coloring + per-channel SDF + median reconstruction), implemented in pure JS so it runs in the browser without WASM.
