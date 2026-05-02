// Per-base-class MSDF material variants. Each one extends the matching
// three.js NodeMaterial via the `withMsdfNodes` mixin, which runs the
// shared `applyMsdfNodes` wiring in its constructor. Pick the variant
// whose lighting model fits your scene: Basic (unlit) for icons/UI,
// Lambert/Phong/Standard/Physical/Toon for lit surfaces, Matcap for cheap
// fake-shading, Sprite for billboarded decals.

import {
  MeshBasicNodeMaterial,
  MeshLambertNodeMaterial,
  MeshMatcapNodeMaterial,
  MeshPhongNodeMaterial,
  MeshPhysicalNodeMaterial,
  MeshStandardNodeMaterial,
  MeshToonNodeMaterial,
  SpriteNodeMaterial,
} from 'three/webgpu'

import { applyMsdfNodes, type MsdfNodeMaterialParameters, type MsdfUniforms } from './msdfNodes.js'

// TS mixin classes have a hard requirement: the constructor must take
// `...args: any[]`. Subclasses below restore the public signature
// `(parameters?: MsdfNodeMaterialParameters)` by overriding the constructor.
type AnyMaterialCtor = new (...args: any[]) => object

function withMsdfNodes<T extends AnyMaterialCtor>(Base: T) {
  return class extends Base implements MsdfUniforms {
    declare mapUniform: MsdfUniforms['mapUniform']
    declare colorUniform: MsdfUniforms['colorUniform']
    declare thresholdUniform: MsdfUniforms['thresholdUniform']
    declare opacityUniform: MsdfUniforms['opacityUniform']
    declare tilingUniform: MsdfUniforms['tilingUniform']
    declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
    constructor(...args: any[]) {
      super()
      const parameters = (args[0] ?? {}) as MsdfNodeMaterialParameters
      Object.assign(this, applyMsdfNodes(this, parameters))
    }
  }
}

export class MsdfBasicNodeMaterial extends withMsdfNodes(MeshBasicNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfLambertNodeMaterial extends withMsdfNodes(MeshLambertNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfMatcapNodeMaterial extends withMsdfNodes(MeshMatcapNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfPhongNodeMaterial extends withMsdfNodes(MeshPhongNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfPhysicalNodeMaterial extends withMsdfNodes(MeshPhysicalNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfStandardNodeMaterial extends withMsdfNodes(MeshStandardNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfToonNodeMaterial extends withMsdfNodes(MeshToonNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
export class MsdfSpriteNodeMaterial extends withMsdfNodes(SpriteNodeMaterial) {
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super(parameters)
  }
}
