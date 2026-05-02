import { useEffect, useMemo } from 'react'

import { OrbitControls } from '@react-three/drei/webgpu'
import { Canvas } from '@react-three/fiber/webgpu'
import { BufferAttribute, BufferGeometry, type Texture } from 'three'
import { checker, color, mix, uv } from 'three/tsl'
import { MeshBasicNodeMaterial, NoToneMapping } from 'three/webgpu'

export type MaterialKind = 'basic' | 'lambert' | 'matcap' | 'phong' | 'physical' | 'standard' | 'toon' | 'sprite'

export const MATERIAL_KINDS: { value: MaterialKind; label: string }[] = [
  { value: 'basic', label: 'Basic' },
  { value: 'lambert', label: 'Lambert' },
  { value: 'matcap', label: 'Matcap' },
  { value: 'phong', label: 'Phong' },
  { value: 'physical', label: 'Physical' },
  { value: 'standard', label: 'Standard' },
  { value: 'toon', label: 'Toon' },
  { value: 'sprite', label: 'Sprite' },
]

// A scene layer is either a fill (signed MSDF) or a line (unsigned SDF
// produced from an SVG `stroke` attribute or `<line>` / `<polyline>`).
// The `kind` field selects which texture encoding the material expects;
// for line layers, `lineHalfWidth` is the band threshold returned by the
// baker as `halfWidthNorm`.
export type SceneLayer =
  | { kind: 'fill'; texture: Texture; color: string }
  | { kind: 'line'; texture: Texture; color: string; lineHalfWidth: number }

interface LayerMaterialProps {
  layer: SceneLayer
  kind: MaterialKind
}

const LayerMaterial = ({ layer, kind }: LayerMaterialProps) => {
  // R3F resolves the JSX tag to the constructor registered via `extend()`,
  // and prop names map straight to our setter accessors on the material.
  // For fill layers we leave threshold at its default (0.5). For line
  // layers we pass `lineHalfWidth`, which the material translates to
  // `threshold = 1 - lineHalfWidth` internally.
  const props =
    layer.kind === 'line'
      ? { map: layer.texture, color: layer.color, transparent: true, lineHalfWidth: layer.lineHalfWidth }
      : { map: layer.texture, color: layer.color, transparent: true }
  switch (kind) {
    case 'basic':
      return <msdfBasicNodeMaterial {...props} />
    case 'lambert':
      return <msdfLambertNodeMaterial {...props} />
    case 'matcap':
      return <msdfMatcapNodeMaterial {...props} />
    case 'phong':
      return <msdfPhongNodeMaterial {...props} />
    case 'physical':
      return <msdfPhysicalNodeMaterial {...props} />
    case 'standard':
      return <msdfStandardNodeMaterial {...props} />
    case 'toon':
      return <msdfToonNodeMaterial {...props} />
    case 'sprite':
      return <msdfSpriteNodeMaterial {...props} />
  }
}

interface LayeredPlaneProps {
  layers: SceneLayer[]
  kind: MaterialKind
}

const LayeredPlane = ({ layers, kind }: LayeredPlaneProps) => (
  <>
    {layers.map((layer, i) => (
      // `key` includes both the material kind AND the layer kind (fill vs
      // line) so any swap forces a fresh material — the fill/line branch
      // is hard-wired into the TSL node graph at construction.
      <mesh key={`${kind}-${layer.kind}-${i}`} renderOrder={i + 1}>
        <planeGeometry args={[2, 2]} />
        <LayerMaterial layer={layer} kind={kind} />
      </mesh>
    ))}
    <PlaneOutline />
  </>
)

const PlaneOutline = () => {
  const geometry = useMemo(() => {
    const g = new BufferGeometry()
    const z = 0.001
    g.setAttribute(
      'position',
      new BufferAttribute(
        new Float32Array([-1, -1, z, 1, -1, z, 1, -1, z, 1, 1, z, 1, 1, z, -1, 1, z, -1, 1, z, -1, -1, z]),
        3,
      ),
    )
    return g
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <lineSegments renderOrder={9999}>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="white" transparent opacity={0.6} />
    </lineSegments>
  )
}

const Checkerboard = () => {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    m.colorNode = mix(color(0x1a1d24), color(0x2a2f3a), checker(uv().mul(20)))
    return m
  }, [])
  useEffect(() => () => material.dispose(), [material])
  return (
    <mesh position={[0, 0, -0.5]}>
      <planeGeometry args={[40, 40]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}

interface SceneProps {
  layers: SceneLayer[] | null
  kind: MaterialKind
}

const Scene = ({ layers, kind }: SceneProps) => (
  <Canvas
    camera={{ fov: 40, near: 0.1, far: 100, position: [0, 0.2, 3.4] }}
    className="fixed top-0 left-0 h-screen w-screen bg-neutral-800"
    renderer={{
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false,
      toneMapping: NoToneMapping,
    }}
  >
    <OrbitControls enableDamping dampingFactor={0.08} minDistance={1.6} maxDistance={6} />
    {/* π — feeds Lambert/Phong/Standard/Physical/Toon, ignored by Basic/Matcap/Sprite. */}
    <ambientLight intensity={Math.PI} />
    <Checkerboard />
    {layers ? <LayeredPlane layers={layers} kind={kind} /> : null}
  </Canvas>
)

export default Scene
