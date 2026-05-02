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
  return (
    <div className="fixed top-4 left-4 z-20 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-black/80 p-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl">
      <h1 className="mb-0.5 text-[15px] font-semibold text-white">svg-to-tsl</h1>
      <div className="mb-3 text-[11px] text-gray-400">SVG → MSDF in the browser · Three.js / R3F</div>

      <div className="border-t border-white/10 pt-2">
        <Row label="File" value={file?.name ?? '—'} />
        <Row label="Texture" value={`${size} × ${size} px`} />
        <Row label="Bake time" value={result ? `${result.bakeMs.toFixed(1)} ms` : baking ? 'Baking…' : '—'} />
        <Row label="Contours" value={result ? String(result.contours) : '—'} />
        <Row label="Edges" value={result ? String(result.edges) : '—'} />
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

      {result && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="mb-1 text-[10.5px] tracking-wider text-gray-500 uppercase">Baked MSDF</div>
          <img
            src={result.previewUrl}
            alt="MSDF preview"
            className="w-full rounded-md border border-white/10 bg-neutral-700"
            style={{ imageRendering: 'pixelated' }}
          />
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
