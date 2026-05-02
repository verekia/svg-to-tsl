import { useCallback, useEffect, useMemo, useState } from 'react'

import { MsdfMaterial } from 'svg-to-tsl'

import { OrbitControls } from '@react-three/drei/webgpu'
import { Canvas } from '@react-three/fiber/webgpu'
import { BufferAttribute, BufferGeometry } from 'three'
import { checker, color, mix, uv } from 'three/tsl'
import { MeshBasicNodeMaterial, NoToneMapping } from 'three/webgpu'

import DropZone from '../components/DropZone'
import InfoPanel from '../components/InfoPanel'
import { useSvgMsdf, type BakedLayer } from '../hooks/useSvgMsdf'

const DEFAULT_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <circle cx="128" cy="128" r="110" fill="#1f6feb" />
  <path d="M128 56 L156 124 L228 128 L172 172 L188 232 L128 200 L68 232 L84 172 L28 128 L100 124 Z" fill="#facc15" />
  <circle cx="128" cy="148" r="22" fill="#ef4444" />
</svg>`

interface LayeredPlaneProps {
  layers: BakedLayer[]
}

const LayeredPlane = ({ layers }: LayeredPlaneProps) => {
  const materials = useMemo(() => {
    return layers.map(
      (layer, i) =>
        new MsdfMaterial({
          map: layer.texture,
          color: layer.fill,
          alphaOnly: true,
          transparent: true,
          opacity: 1,
          // Subtle forward bias per stacked layer so higher-index layers
          // win the depth fight without z-fighting artifacts.
          ...{ polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -i },
        }),
    )
  }, [layers])

  useEffect(() => () => materials.forEach(m => m.dispose()), [materials])

  return (
    <>
      {materials.map((mat, i) => (
        <mesh key={i} renderOrder={i + 1}>
          <planeGeometry args={[2, 2]} />
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
      <PlaneOutline />
    </>
  )
}

const PlaneOutline = () => {
  // 4 line segments (8 vertex pairs) tracing the MSDF plane perimeter.
  // Slight z bias keeps the outline on top of the layer planes.
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

const IndexPage = () => {
  const [file, setFile] = useState<File | null>(null)
  const [svgText, setSvgText] = useState<string | null>(DEFAULT_SVG)
  const [size, setSize] = useState(256)
  const [range, setRange] = useState(4)

  const onFileDrop = useCallback((dropped: File) => {
    setFile(dropped)
    const reader = new FileReader()
    reader.onload = () => setSvgText(reader.result as string)
    reader.readAsText(dropped)
  }, [])

  const { info, baking } = useSvgMsdf(svgText, { size, range })

  return (
    <>
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
        <Checkerboard />
        {info ? <LayeredPlane layers={info.layers} /> : null}
      </Canvas>
      <DropZone onFileDrop={onFileDrop} hasTexture={!!file} />
      <InfoPanel
        file={file}
        result={info}
        baking={baking}
        size={size}
        onSizeChange={setSize}
        range={range}
        onRangeChange={setRange}
      />
    </>
  )
}

export default IndexPage
