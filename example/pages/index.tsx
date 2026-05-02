import { useCallback, useState } from 'react'

import DropZone from '../components/DropZone'
import InfoPanel from '../components/InfoPanel'
import Scene from '../components/Scene'
import { useSvgMsdf } from '../hooks/useSvgMsdf'

const DEFAULT_SVG = `<svg viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <circle cx="128" cy="128" r="110" fill="#1f6feb" />
  <path d="M128 56 L156 124 L228 128 L172 172 L188 232 L128 200 L68 232 L84 172 L28 128 L100 124 Z" fill="#facc15" />
  <circle cx="128" cy="148" r="22" fill="#ef4444" />
</svg>`

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
      <Scene layers={info?.layers ?? null} />
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
