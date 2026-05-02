import { useCallback, useEffect, useMemo, useState } from 'react'

import { MsdfMaterial } from 'svg-to-tsl'

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { SphereGeometry } from 'three'

import DropZone from '../components/DropZone'
import InfoPanel from '../components/InfoPanel'
import { useSvgMsdf, type BakedLayer } from '../hooks/useSvgMsdf'

const DEFAULT_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <circle cx="128" cy="128" r="110" fill="#1f6feb" />
  <path d="M128 56 L156 124 L228 128 L172 172 L188 232 L128 200 L68 232 L84 172 L28 128 L100 124 Z" fill="#facc15" />
  <circle cx="128" cy="148" r="22" fill="#ef4444" />
</svg>`

interface LayeredSphereProps {
  layers: BakedLayer[]
}

const LayeredSphere = ({ layers }: LayeredSphereProps) => {
  const geometry = useMemo(() => new SphereGeometry(1, 128, 64), [])
  useEffect(() => () => geometry.dispose(), [geometry])

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
      {/* Base sphere — visible where no MSDF layer covers. */}
      <mesh geometry={geometry}>
        <meshBasicMaterial color="#303542" />
      </mesh>
      {materials.map((mat, i) => (
        <mesh key={i} geometry={geometry} renderOrder={i + 1}>
          <primitive object={mat} attach="material" />
        </mesh>
      ))}
    </>
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
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 4]} intensity={0.8} />
        <OrbitControls enableDamping dampingFactor={0.08} enablePan={false} minDistance={1.6} maxDistance={6} />
        {info ? <LayeredSphere layers={info.layers} /> : null}
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
