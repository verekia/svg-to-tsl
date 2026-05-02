import type { BakeInfo } from '../hooks/useSvgMsdf'

interface InfoPanelProps {
  file: File | null
  result: BakeInfo | null
  baking: boolean
  size: number
  onSizeChange: (value: number) => void
  range: number
  onRangeChange: (value: number) => void
}

const InfoPanel = ({ file, result, baking, size, onSizeChange, range, onRangeChange }: InfoPanelProps) => {
  const totalEdges = result?.layers.reduce((s, l) => s + l.edgeCount, 0) ?? 0

  return (
    <div className="fixed top-4 left-4 z-20 max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl">
      <h1 className="mb-0.5 text-[15px] font-semibold text-white">svg-to-tsl</h1>
      <div className="mb-3 text-[11px] text-gray-400">SVG → MSDF (per-color layer) · Three.js / R3F</div>

      <div className="border-t border-white/10 pt-2">
        <Row label="File" value={file?.name ?? '—'} />
        <Row label="Texture" value={`${size} × ${size} px`} />
        <Row label="Layers" value={result ? String(result.layers.length) : '—'} />
        <Row label="Total edges" value={result ? String(totalEdges) : '—'} />
        <Row label="Bake time" value={result ? `${result.totalBakeMs.toFixed(1)} ms` : baking ? 'Baking…' : '—'} />
      </div>

      <div className="border-t border-white/10 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-gray-400">Resolution</span>
          <span className="font-mono text-xs text-gray-200">{size}px</span>
        </div>
        <input
          type="range"
          min={32}
          max={512}
          step={16}
          value={size}
          onChange={e => onSizeChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      <div className="pt-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-gray-400">SDF range</span>
          <span className="font-mono text-xs text-gray-200">{range.toFixed(1)}</span>
        </div>
        <input
          type="range"
          min={1}
          max={16}
          step={0.5}
          value={range}
          onChange={e => onRangeChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </div>

      {result && result.layers.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-2 text-[10.5px] tracking-wider text-gray-500 uppercase">Baked layers</div>
          <div className="grid grid-cols-2 gap-2">
            {result.layers.map((layer, i) => (
              <div key={i} className="rounded-md border border-white/10 bg-white/5 p-1.5">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="inline-block size-3 rounded-sm border border-white/20"
                    style={{ background: layer.fill }}
                  />
                  <span className="truncate font-mono text-[10px] text-gray-300">{layer.fill}</span>
                </div>
                <img
                  src={layer.previewUrl}
                  alt={`Layer ${i}`}
                  className="w-full rounded-sm border border-white/10 bg-neutral-700"
                  style={{ imageRendering: 'pixelated' }}
                />
                <div className="mt-1 font-mono text-[10px] text-gray-400">
                  {layer.edgeCount} edges · {layer.bakeMs.toFixed(0)} ms
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-gray-400">{label}</span>
    <span className="font-mono text-xs text-gray-200">{value}</span>
  </div>
)

export default InfoPanel
