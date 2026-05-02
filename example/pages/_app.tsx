import { useEffect } from 'react'

import {
  MsdfBasicNodeMaterial,
  MsdfLambertNodeMaterial,
  MsdfMatcapNodeMaterial,
  MsdfPhongNodeMaterial,
  MsdfPhysicalNodeMaterial,
  MsdfSpriteNodeMaterial,
  MsdfStandardNodeMaterial,
  MsdfToonNodeMaterial,
} from 'svg-to-msdf'

import { extend } from '@react-three/fiber'
import '../tailwind.css'

import type { AppProps } from 'next/app'

// Register the MSDF node-material variants as JSX elements so they are usable
// declaratively: <msdfBasicNodeMaterial map={tex} color="#facc15" />, etc.
extend({
  MsdfBasicNodeMaterial,
  MsdfLambertNodeMaterial,
  MsdfMatcapNodeMaterial,
  MsdfPhongNodeMaterial,
  MsdfPhysicalNodeMaterial,
  MsdfStandardNodeMaterial,
  MsdfToonNodeMaterial,
  MsdfSpriteNodeMaterial,
})

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    const init = async () => {
      const { default: eruda } = await import('eruda')
      eruda.init()

      if (!('gpu' in navigator)) {
        console.log('[svg-to-msdf] WebGPU not available')
        return
      }
      const adapter = await navigator.gpu.requestAdapter()
      if (!adapter) {
        console.log('[svg-to-msdf] No GPU adapter found')
        return
      }

      const info = adapter.info
      console.log('[svg-to-msdf] GPU Adapter Info:', {
        vendor: info.vendor,
        architecture: info.architecture,
        device: info.device,
        description: info.description,
      })
      console.log('[svg-to-msdf] GPU Features:', [...adapter.features].sort().join(', '))
    }
    init()
  }, [])

  return <Component {...pageProps} />
}
