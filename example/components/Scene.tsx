import { useEffect, useMemo } from 'react'

import { MsdfMaterial } from 'svg-to-msdf'

import { OrbitControls } from '@react-three/drei/webgpu'
import { Canvas } from '@react-three/fiber/webgpu'
import { BufferAttribute, BufferGeometry, type Texture } from 'three'
import { checker, color, mix, uv } from 'three/tsl'
import { MeshBasicNodeMaterial, NoToneMapping } from 'three/webgpu'

export interface SceneLayer {
  texture: Texture
  fill: string
}

interface LayeredPlaneProps {
  layers: SceneLayer[]
}

const LayeredPlane = ({ layers }: LayeredPlaneProps) => {
  const materials = useMemo(
    () =>
      layers.map(
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
      ),
    [layers],
  )

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
}

const Scene = ({ layers }: SceneProps) => (
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
    {layers ? <LayeredPlane layers={layers} /> : null}
  </Canvas>
)

export default Scene
