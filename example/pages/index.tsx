import { useCallback, useState } from 'react'

import DropZone from '../components/DropZone'
import InfoPanel from '../components/InfoPanel'
import MaterialPicker from '../components/MaterialPicker'
import Scene, { type MaterialKind } from '../components/Scene'
import { useSvgMsdf } from '../hooks/useSvgMsdf'

// 5-point star centered at (128, 128) with outer radius 100 and inner radius 40,
// so its visual center matches the surrounding circle and the central red dot.
const DEFAULT_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <circle cx="128" cy="128" r="110" fill="#1f6feb" />
  <path d="M128 28 L151.5 95.6 L223.1 97.1 L166 140.4 L186.8 208.9 L128 168 L69.2 208.9 L90 140.4 L32.9 97.1 L104.5 95.6 Z" fill="#facc15" />
  <circle cx="128" cy="128" r="22" fill="#ef4444" />
</svg>`

const IndexPage = () => {
  const [file, setFile] = useState<File | null>(null)
  const [svgText, setSvgText] = useState<string | null>(DEFAULT_SVG)
  const [size, setSize] = useState(256)
  const [range, setRange] = useState(4)
  const [materialKind, setMaterialKind] = useState<MaterialKind>('basic')

  const onFileDrop = useCallback((dropped: File) => {
    setFile(dropped)
    const reader = new FileReader()
    reader.onload = () => setSvgText(reader.result as string)
    reader.readAsText(dropped)
  }, [])

  const { info, baking } = useSvgMsdf(svgText, { size, range })

  return (
    <>
      <Scene
        layers={
          info
            ? info.layers.map(l =>
                l.kind === 'line'
                  ? { kind: 'line' as const, texture: l.texture, color: l.color, lineHalfWidth: l.halfWidthNorm }
                  : { kind: 'fill' as const, texture: l.texture, color: l.color },
              )
            : null
        }
        kind={materialKind}
      />
      <MaterialPicker value={materialKind} onChange={setMaterialKind} />
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
