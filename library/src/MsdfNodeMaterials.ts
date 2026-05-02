// Per-base-class MSDF material variants. Each one extends the matching
// three.js NodeMaterial and runs the shared `applyMsdfNodes` wiring in its
// constructor. Pick the variant whose lighting model fits your scene:
// Basic (unlit) for icons/UI, Lambert/Phong/Standard/Physical/Toon for lit
// surfaces, Matcap for cheap fake-shading, Sprite for billboarded decals.

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

interface WithMsdfUniforms extends MsdfUniforms {}

export class MsdfBasicNodeMaterial extends MeshBasicNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfLambertNodeMaterial extends MeshLambertNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfMatcapNodeMaterial extends MeshMatcapNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfPhongNodeMaterial extends MeshPhongNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfPhysicalNodeMaterial extends MeshPhysicalNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfStandardNodeMaterial extends MeshStandardNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfToonNodeMaterial extends MeshToonNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}

export class MsdfSpriteNodeMaterial extends SpriteNodeMaterial implements WithMsdfUniforms {
  declare mapUniform: MsdfUniforms['mapUniform']
  declare colorUniform: MsdfUniforms['colorUniform']
  declare thresholdUniform: MsdfUniforms['thresholdUniform']
  declare opacityUniform: MsdfUniforms['opacityUniform']
  declare tilingUniform: MsdfUniforms['tilingUniform']
  declare uvOffsetUniform: MsdfUniforms['uvOffsetUniform']
  constructor(parameters: MsdfNodeMaterialParameters = {}) {
    super()
    Object.assign(this, applyMsdfNodes(this, parameters))
  }
}
