import { useCallback, useEffect, useRef, useState } from 'react'

import { LinearFilter, NoColorSpace, RepeatWrapping, Texture } from 'three'

import MaterialPicker from '../components/MaterialPicker'
import Scene, { type MaterialKind, type SceneLayer } from '../components/Scene'

interface LoadedLayer {
  id: number
  name: string
  texture: Texture
  // 'fill' = signed MSDF (the kind `bakeSvgToMsdf` produces from a fill)
  // 'line' = unsigned SDF (the kind produced from an SVG `stroke` /
  //          `<line>` / `<polyline>`). For lines the user also sets a
  //          band half-width (in normalized 0–1 texture units).
  kind: 'fill' | 'line'
  color: string
  lineHalfWidth: number
  fileSize: number
  width: number
  height: number
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const loadPngAsTexture = (file: File): Promise<{ texture: Texture; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const tex = new Texture(img)
      tex.colorSpace = NoColorSpace
      tex.minFilter = LinearFilter
      tex.magFilter = LinearFilter
      tex.wrapS = RepeatWrapping
      tex.wrapT = RepeatWrapping
      tex.generateMipmaps = false
      tex.flipY = false
      tex.needsUpdate = true
      resolve({ texture: tex, width: img.naturalWidth, height: img.naturalHeight })
      // The image element is kept alive by the Texture; revoke the URL only
      // after upload happens (next frame is fine).
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Failed to load ${file.name}`))
    }
    img.src = url
  })

const LoadPage = () => {
  const [layers, setLayers] = useState<LoadedLayer[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [materialKind, setMaterialKind] = useState<MaterialKind>('basic')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  const addFiles = useCallback(async (files: File[]) => {
    const pngs = files.filter(f => f.type === 'image/png' || /\.png$/i.test(f.name))
    if (pngs.length === 0) return
    const loaded: LoadedLayer[] = []
    for (const file of pngs) {
      try {
        const { texture, width, height } = await loadPngAsTexture(file)
        loaded.push({
          id: nextId.current++,
          name: file.name,
          texture,
          kind: 'fill',
          color: '#ffffff',
          lineHalfWidth: 0.15,
          fileSize: file.size,
          width,
          height,
        })
      } catch (err) {
        console.error('[svg-to-msdf] PNG load failed:', err)
      }
    }
    setLayers(prev => [...prev, ...loaded])
  }, [])

  const removeLayer = useCallback((id: number) => {
    setLayers(prev => {
      const target = prev.find(l => l.id === id)
      target?.texture.dispose()
      return prev.filter(l => l.id !== id)
    })
  }, [])

  const updateLayer = useCallback(<K extends keyof LoadedLayer>(id: number, patch: Pick<LoadedLayer, K>) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const clearAll = useCallback(() => {
    setLayers(prev => {
      prev.forEach(l => l.texture.dispose())
      return []
    })
  }, [])

  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }
    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.relatedTarget) return
      setIsDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) addFiles(files)
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [addFiles])

  // Dispose textures on unmount.
  useEffect(
    () => () => {
      for (const l of layers) l.texture.dispose()
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const sceneLayers: SceneLayer[] = layers.map(l =>
    l.kind === 'line'
      ? { kind: 'line' as const, texture: l.texture, color: l.color, lineHalfWidth: l.lineHalfWidth }
      : { kind: 'fill' as const, texture: l.texture, color: l.color },
  )

  return (
    <>
      <Scene layers={sceneLayers.length > 0 ? sceneLayers : null} kind={materialKind} />
      <MaterialPicker value={materialKind} onChange={setMaterialKind} />

      {/* Drop overlay tint */}
      {isDragOver && <div className="pointer-events-none fixed inset-0 z-10 bg-blue-500/10" />}

      {/* Layer controls — top-left panel, only when layers exist */}
      {layers.length > 0 && (
        <div className="fixed top-4 left-4 z-20 max-h-[calc(100vh-8rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl">
          <div className="mb-0.5 flex items-baseline justify-between gap-2">
            <h1 className="text-[15px] font-semibold text-white">svg-to-msdf · loader</h1>
            <a href="/" className="text-[11px] text-blue-400 hover:text-blue-300">
              ← baker
            </a>
          </div>
          <div className="mb-3 text-[11px] text-gray-400">
            {layers.length} layer{layers.length === 1 ? '' : 's'}
          </div>

          <div className="border-t border-white/10 pt-2 pb-3">
            <Row label="PNG total" value={formatBytes(layers.reduce((s, l) => s + l.fileSize, 0))} />
            <Row label="VRAM (RGBA8)" value={formatBytes(layers.reduce((s, l) => s + l.width * l.height * 4, 0))} />
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            {layers.map((layer, i) => (
              <div key={layer.id} className="rounded-md border border-white/10 bg-white/5 p-2">
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="truncate font-mono text-[10px] text-gray-300" title={layer.name}>
                    {i}. {layer.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLayer(layer.id)}
                    className="text-[10px] text-gray-400 hover:text-red-400"
                    title="Remove layer"
                  >
                    ✕
                  </button>
                </div>

                {/* Encoding picker — fill (signed MSDF) vs line (unsigned SDF) */}
                <div className="mb-1.5 flex gap-1">
                  {(['fill', 'line'] as const).map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => updateLayer(layer.id, { kind: k })}
                      className={`flex-1 rounded px-1.5 py-1 text-[10px] font-medium transition ${
                        layer.kind === k
                          ? k === 'fill'
                            ? 'bg-blue-600 text-white'
                            : 'bg-purple-600 text-white'
                          : 'bg-white/5 text-gray-300 hover:bg-white/10'
                      }`}
                      title={
                        k === 'fill'
                          ? 'Treat the PNG as a signed MSDF (a filled shape)'
                          : 'Treat the PNG as an unsigned SDF (a stroked / line band)'
                      }
                    >
                      {k}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHex(layer.color)}
                    onChange={e => updateLayer(layer.id, { color: e.target.value })}
                    className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                  <input
                    type="text"
                    value={layer.color}
                    onChange={e => updateLayer(layer.id, { color: e.target.value })}
                    spellCheck={false}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-gray-100 focus:border-blue-400 focus:outline-none"
                    placeholder="#ffffff"
                  />
                </div>

                {/* Line width — only relevant for line layers */}
                {layer.kind === 'line' && (
                  <div className="mt-1.5">
                    <div className="mb-0.5 flex items-baseline justify-between text-[10px]">
                      <span className="text-gray-400">Line half-width</span>
                      <span className="font-mono text-gray-200">{layer.lineHalfWidth.toFixed(3)}</span>
                    </div>
                    <input
                      type="range"
                      min={0.005}
                      max={0.5}
                      step={0.005}
                      value={layer.lineHalfWidth}
                      onChange={e => updateLayer(layer.id, { lineHalfWidth: Number(e.target.value) })}
                      className="w-full accent-purple-500"
                    />
                  </div>
                )}

                <div className="mt-1.5 flex items-baseline justify-between gap-2 font-mono text-[10px] text-gray-400">
                  <span>
                    {layer.width} × {layer.height}
                  </span>
                  <span>{formatBytes(layer.fileSize)}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={clearAll}
            className="mt-3 w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Bottom-centered drop hint / add button */}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center">
        <div className="pointer-events-auto rounded-xl border border-dashed border-white/20 bg-black/70 px-7 py-5 text-center shadow-lg backdrop-blur-md">
          <div className="mb-1 text-sm font-semibold text-white">
            {layers.length === 0 ? 'Drop MSDF PNGs' : 'Add more PNGs'}
          </div>
          <div className="text-xs text-gray-400">
            {layers.length === 0 ? 'or click to pick one or more' : 'drop anywhere or click below'}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 cursor-pointer rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10"
          >
            Open PNGs…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,.png"
            multiple
            className="hidden"
            onChange={e => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) addFiles(files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      {/* When no layers yet, show the back link as a separate floating chip */}
      {layers.length === 0 && (
        <a
          href="/"
          className="fixed top-4 left-4 z-20 rounded-md border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] text-blue-400 backdrop-blur-md hover:text-blue-300"
        >
          ← back to live SVG baker
        </a>
      )}
    </>
  )
}

// <input type="color"> only accepts #RRGGBB; coerce arbitrary text to that.
const normalizeHex = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim())
  return m && m[1] ? `#${m[1].toLowerCase()}` : '#ffffff'
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-2 py-0.5">
    <span className="text-gray-400">{label}</span>
    <span className="font-mono text-xs text-gray-200">{value}</span>
  </div>
)

export default LoadPage
