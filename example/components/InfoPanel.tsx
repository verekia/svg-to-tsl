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

const RESOLUTION_PRESETS = [64, 128, 256, 512] as const

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const layerFileName = (baseName: string, index: number, fill: string): string =>
  `${baseName}-msdf-${index}-${fill.replace('#', '')}.png`

const triggerDownload = (href: string, filename: string) => {
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

const downloadAll = (layers: { fill: string; previewUrl: string }[], baseName: string) => {
  layers.forEach((layer, i) => {
    // Stagger so the browser doesn't collapse rapid downloads.
    setTimeout(() => triggerDownload(layer.previewUrl, layerFileName(baseName, i, layer.fill)), i * 120)
  })
}

const InfoPanel = ({ file, result, baking, size, onSizeChange, range, onRangeChange }: InfoPanelProps) => {
  const totalEdges = result?.layers.reduce((s, l) => s + l.edgeCount, 0) ?? 0
  const bytesPerLayer = result ? result.width * result.height * 4 : 0
  const totalVram = result ? bytesPerLayer * result.layers.length : 0
  const baseName = (file?.name ?? 'svg').replace(/\.svg$/i, '')

  return (
    <div className="fixed top-4 left-4 z-20 max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl">
      <div className="mb-0.5 flex items-baseline justify-between gap-2">
        <h1 className="text-[15px] font-semibold text-white">svg-to-tsl</h1>
        <a href="/load" className="text-[11px] text-blue-400 hover:text-blue-300">
          load PNGs →
        </a>
      </div>
      <div className="mb-3 text-[11px] text-gray-400">SVG → MSDF (per-color layer) · Three.js / R3F</div>

      <div className="border-t border-white/10 pt-2">
        <Row label="File" value={file?.name ?? '—'} />
        <Row label="Texture" value={`${size} × ${size} px`} />
        <Row label="Layers" value={result ? String(result.layers.length) : '—'} />
        <Row label="Total edges" value={result ? String(totalEdges) : '—'} />
        <Row label="VRAM (RGBA8)" value={result ? `${formatBytes(totalVram)}` : '—'} />
        <Row label="Bake time" value={result ? `${result.totalBakeMs.toFixed(1)} ms` : baking ? 'Baking…' : '—'} />
      </div>

      {result && result.layers.length > 0 && (
        <button
          type="button"
          onClick={() => downloadAll(result.layers, baseName)}
          className="mt-3 w-full rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-500 active:bg-blue-700"
        >
          Download {result.layers.length === 1 ? 'PNG' : `${result.layers.length} PNGs`}
        </button>
      )}

      <div className="border-t border-white/10 pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-gray-400">Resolution</span>
          <span className="font-mono text-xs text-gray-200">{size}px</span>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-gray-500">
          Per-layer texture size. Higher = sharper corners and more VRAM. MSDFs scale well, so 128–256px is usually
          enough.
        </p>
        <input
          type="range"
          min={32}
          max={512}
          step={16}
          value={size}
          onChange={e => onSizeChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="mt-1.5 grid grid-cols-4 gap-1">
          {RESOLUTION_PRESETS.map(preset => (
            <button
              key={preset}
              type="button"
              onClick={() => onSizeChange(preset)}
              className={`rounded px-1.5 py-1 font-mono text-[10px] transition ${
                size === preset
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-3">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-gray-400">SDF range</span>
          <span className="font-mono text-xs text-gray-200">{range.toFixed(1)}</span>
        </div>
        <p className="mb-1.5 text-[11px] leading-snug text-gray-500">
          Distance band (in SVG units) encoded around each edge. Wider = smoother outlines and effects (glow, outline)
          but coarser corners. 4 is a sensible default.
        </p>
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
                <a
                  href={layer.previewUrl}
                  download={layerFileName(baseName, i, layer.fill)}
                  title="Download PNG"
                  className="block"
                >
                  <img
                    src={layer.previewUrl}
                    alt={`Layer ${i}`}
                    className="w-full rounded-sm border border-white/10 bg-neutral-700 transition hover:border-blue-400"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </a>
                <div className="mt-1 flex items-baseline justify-between gap-1 font-mono text-[10px] text-gray-400">
                  <span>
                    {layer.edgeCount} edges · {layer.bakeMs.toFixed(0)} ms
                  </span>
                  <a
                    href={layer.previewUrl}
                    download={layerFileName(baseName, i, layer.fill)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    PNG
                  </a>
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
