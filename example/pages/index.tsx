import { useCallback, useEffect, useMemo, useState } from 'react'

import { MsdfMaterial } from 'svg-to-tsl'

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'

import DropZone from '../components/DropZone'
import InfoPanel from '../components/InfoPanel'
import { useSvgMsdf } from '../hooks/useSvgMsdf'

import type { Texture } from 'three'

const DEFAULT_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <path d="M128 24
           L156 96
           L232 100
           L172 148
           L192 224
           L128 184
           L64 224
           L84 148
           L24 100
           L100 96 Z" fill="#fff" />
</svg>`

interface SphereProps {
  texture: Texture | null
}

const Sphere = ({ texture }: SphereProps) => {
  const material = useMemo(() => {
    return new MsdfMaterial({
      map: texture ?? null,
      color: 0xffffff,
      background: 0x303542,
      threshold: 0.5,
      transparent: false,
    })
  }, [texture])

  useEffect(() => () => material.dispose(), [material])

  return (
    <mesh>
      <sphereGeometry args={[1, 128, 64]} />
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

  const { texture, info, baking } = useSvgMsdf(svgText, { size, range })

  return (
    <>
      <Canvas
        camera={{ fov: 40, near: 0.1, far: 100, position: [0, 0.2, 3.4] }}
        className="fixed top-0 left-0 h-screen w-screen bg-neutral-800"
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 3, 4]} intensity={0.8} />
        <OrbitControls enableDamping dampingFactor={0.08} enablePan={false} minDistance={1.6} maxDistance={6} />
        <Sphere texture={texture} />
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
