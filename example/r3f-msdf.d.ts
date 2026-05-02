// JSX element types for the MSDF node materials. R3F's `extend()` makes them
// usable as JSX elements at runtime; this file teaches TypeScript about them.

import type {
  MsdfBasicNodeMaterial,
  MsdfLambertNodeMaterial,
  MsdfMatcapNodeMaterial,
  MsdfPhongNodeMaterial,
  MsdfPhysicalNodeMaterial,
  MsdfSpriteNodeMaterial,
  MsdfStandardNodeMaterial,
  MsdfToonNodeMaterial,
} from 'svg-to-msdf'

import type { ThreeElement } from '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements {
    msdfBasicNodeMaterial: ThreeElement<typeof MsdfBasicNodeMaterial>
    msdfLambertNodeMaterial: ThreeElement<typeof MsdfLambertNodeMaterial>
    msdfMatcapNodeMaterial: ThreeElement<typeof MsdfMatcapNodeMaterial>
    msdfPhongNodeMaterial: ThreeElement<typeof MsdfPhongNodeMaterial>
    msdfPhysicalNodeMaterial: ThreeElement<typeof MsdfPhysicalNodeMaterial>
    msdfStandardNodeMaterial: ThreeElement<typeof MsdfStandardNodeMaterial>
    msdfToonNodeMaterial: ThreeElement<typeof MsdfToonNodeMaterial>
    msdfSpriteNodeMaterial: ThreeElement<typeof MsdfSpriteNodeMaterial>
  }
}
