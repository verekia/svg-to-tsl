# svg-to-msdf

Bake an SVG into a Multi-channel Signed Distance Field (MSDF) texture in the browser, then render it as a sharp, infinitely scalable vector texture on any 3D mesh — perfect for cheap logos, icons and decals on Three.js / React Three Fiber meshes.

The point of MSDF: a 256×256 texture renders crisp at any zoom level, because each texel encodes the distance to the nearest edge instead of a color sample. Vector quality, raster performance.

> [!WARNING]
> This is 100% vibe-coded. The code is completely unreviewed, under-tested, it will probably crash on many SVGs, and this library is very likely to go unmaintained. Do not use for anything important.

## Install

```sh
npm install svg-to-msdf
# or
pnpm add svg-to-msdf
# or
bun add svg-to-msdf
```

`three` is a peer dependency (`>=0.170`).

## Usage

### `bakeSvgToMsdf` — direct API

```ts
import { bakeSvgToMsdf } from 'svg-to-msdf'

const svgText = await fetch('/logo.svg').then(r => r.text())

const { texture, width, height } = await bakeSvgToMsdf(svgText, {
  size: 256, // texture resolution (pixels per side)
  range: 4, // distance range (in SVG units around the edge)
})

material.map = texture
```

### `SvgMsdfLoader` — Three.js Loader

```ts
import { SvgMsdfLoader } from 'svg-to-msdf'

const loader = new SvgMsdfLoader()
loader.size = 256
loader.range = 4
const texture = await loader.loadAsync('/logo.svg')
```

### `MsdfMaterial` — drop-in Three.js material

```ts
import { MsdfMaterial, SvgMsdfLoader } from 'svg-to-msdf'

const texture = await new SvgMsdfLoader().loadAsync('/logo.svg')

const material = new MsdfMaterial({
  map: texture,
  color: 0xffffff,
  threshold: 0.5,
})

mesh.material = material
```

The shader does median-of-3 reconstruction with screen-space derivatives so edges stay sharp at any zoom level.

### React Three Fiber

```tsx
import { useLoader } from '@react-three/fiber'
import { SvgMsdfLoader, MsdfMaterial } from 'svg-to-msdf'

function Logo() {
  const texture = useLoader(SvgMsdfLoader, '/logo.svg', loader => {
    loader.size = 256
  })

  return (
    <mesh>
      <sphereGeometry args={[1, 64, 32]} />
      <primitive object={new MsdfMaterial({ map: texture })} attach="material" />
    </mesh>
  )
}
```

### `bakeSvgToMsdfLayered` — multi-color SVGs

Plain MSDF can't carry per-shape colors (the R/G/B channels are spent on
sharp-corner reconstruction). The layered baker handles colored SVGs by
grouping shapes by their `fill` attribute and producing **one MSDF
texture per color**, in document order. Render each as a stacked mesh
with its own color and you get a multi-color, infinitely scalable vector
texture from a few small MSDFs.

```ts
import { bakeSvgToMsdfLayered } from 'svg-to-msdf'

const { layers, width, height } = await bakeSvgToMsdfLayered(svgText, {
  size: 256,
  range: 4,
})

// layers: [{ fill: '#1f6feb', texture, ... }, { fill: '#facc15', texture, ... }, ...]
```

```tsx
import { MsdfMaterial } from 'svg-to-msdf'

function ColoredLogo({ layers }) {
  return (
    <>
      {layers.map((layer, i) => (
        <mesh key={i} renderOrder={i}>
          <sphereGeometry args={[1, 128, 64]} />
          <primitive
            attach="material"
            object={
              new MsdfMaterial({
                map: layer.texture,
                color: layer.fill,
                alphaOnly: true,
                transparent: true,
              })
            }
          />
        </mesh>
      ))}
    </>
  )
}
```

`fill` resolution walks `style="fill: …"` → `fill="…"` → inherited from
parent `<g>` → defaults to black. Shapes with `fill="none"` are skipped.
Consecutive shapes with the same fill are merged into one layer.

## Options

### `bakeSvgToMsdf` options

| Option      | Type      | Default | Description                                                          |
| ----------- | --------- | ------- | -------------------------------------------------------------------- |
| `size`      | `number`  | `256`   | Output texture resolution (size × size pixels)                       |
| `range`     | `number`  | `4`     | Distance range (in SVG path units) — bigger = smoother, less precise |
| `padding`   | `number`  | `8`     | Extra padding (in pixels) around the SVG bounding box                |
| `flipY`     | `boolean` | `true`  | Flip vertically (matches Three.js convention)                        |
| `tolerance` | `number`  | `0.25`  | Curve flattening tolerance (smaller = more line segments)            |

## How it works

1. Parse the SVG with `DOMParser`, walk every `<path>`, `<rect>`, `<circle>`, `<ellipse>`, `<polygon>`, `<polyline>` and `<line>`.
2. Flatten cubic / quadratic Bézier segments into straight lines via adaptive subdivision.
3. Color-code edges into R, G, B channels using Chlumský-style edge coloring (corners separate the channels, smooth tangents share them).
4. For each output pixel: take the signed distance to the nearest edge per channel, packed into [0, 1].
5. Sample with median-of-3 in the fragment shader → sharp corners, smooth edges, AA via `fwidth`.

## Limitations

- CPU baking is O(W × H × N) — fine for small icons / logos, slow for huge SVGs.
- No support for strokes (only fills), gradients, patterns, masks, clip paths, text, or `use` references.
- Self-intersecting paths and even-odd fills produce undefined results.
- Multi-color SVGs need `bakeSvgToMsdfLayered` and one draw call per unique fill color.

## Acknowledgements

The MSDF technique was introduced by [Viktor Chlumský](https://github.com/Chlumsky/msdfgen). This library is a from-scratch TypeScript port of the core idea (edge coloring + per-channel SDF + median reconstruction), implemented in pure JS so it runs in the browser without WASM.
