import { useCallback, useEffect, useRef, useState } from 'react'

import { LinearFilter, NoColorSpace, RepeatWrapping, Texture } from 'three'

import Scene, { type SceneLayer } from '../components/Scene'

interface LoadedLayer {
  id: number
  name: string
  texture: Texture
  fill: string
}

const loadPngAsTexture = (file: File): Promise<{ texture: Texture; image: HTMLImageElement }> =>
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
      resolve({ texture: tex, image: img })
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextId = useRef(1)

  const addFiles = useCallback(async (files: File[]) => {
    const pngs = files.filter(f => f.type === 'image/png' || /\.png$/i.test(f.name))
    if (pngs.length === 0) return
    const loaded: LoadedLayer[] = []
    for (const file of pngs) {
      try {
        const { texture } = await loadPngAsTexture(file)
        loaded.push({
          id: nextId.current++,
          name: file.name,
          texture,
          fill: '#ffffff',
        })
      } catch (err) {
        console.error('[svg-to-tsl] PNG load failed:', err)
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

  const updateFill = useCallback((id: number, fill: string) => {
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, fill } : l)))
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

  const sceneLayers: SceneLayer[] = layers.map(l => ({ texture: l.texture, fill: l.fill }))

  return (
    <>
      <Scene layers={sceneLayers.length > 0 ? sceneLayers : null} />

      {/* Drop overlay tint */}
      {isDragOver && <div className="pointer-events-none fixed inset-0 z-10 bg-blue-500/10" />}

      <div className="fixed top-4 left-4 z-20 max-h-[calc(100vh-2rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/80 p-4 text-sm leading-relaxed shadow-xl backdrop-blur-xl">
        <h1 className="mb-0.5 text-[15px] font-semibold text-white">svg-to-tsl · loader</h1>
        <div className="mb-3 text-[11px] text-gray-400">Drop pre-baked MSDF PNGs and assign a color per layer</div>

        <div className="flex gap-2 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-500 active:bg-blue-700"
          >
            Add PNG{layers.length > 0 ? 's' : ''}
          </button>
          {layers.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-gray-200 transition hover:bg-white/10"
            >
              Clear
            </button>
          )}
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

        {layers.length === 0 ? (
          <p className="mt-4 text-[11px] leading-snug text-gray-400">
            Drop one or more MSDF PNGs anywhere on the page (or use the button above). Each PNG becomes one stacked
            layer; pick a fill color for each.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
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
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHex(layer.fill)}
                    onChange={e => updateFill(layer.id, e.target.value)}
                    className="h-7 w-9 cursor-pointer rounded border border-white/10 bg-transparent"
                  />
                  <input
                    type="text"
                    value={layer.fill}
                    onChange={e => updateFill(layer.id, e.target.value)}
                    spellCheck={false}
                    className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 font-mono text-[11px] text-gray-100 focus:border-blue-400 focus:outline-none"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <a href="/" className="mt-4 block text-center text-[11px] text-blue-400 hover:text-blue-300">
          ← back to live SVG baker
        </a>
      </div>
    </>
  )
}

// <input type="color"> only accepts #RRGGBB; coerce arbitrary text to that.
const normalizeHex = (hex: string): string => {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(hex.trim())
  return m && m[1] ? `#${m[1].toLowerCase()}` : '#ffffff'
}

export default LoadPage
