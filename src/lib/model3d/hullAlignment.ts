import * as THREE from 'three'
import { BLOCK_SIZE_M, clampGridDim, metersFromBlocks } from '../grid/stormworksDimensions'

/**
 * 3D scene convention (Stormworks hull reference):
 * - Y = up (profile depth / height)
 * - Length axis = longer horizontal model axis at import ('x' or 'z')
 * - Beam axis = the other horizontal axis
 * - Footprint origin: beam centered on 0, length runs 0 → lengthM, keel at Y = 0
 */
export type ModelLengthAxis = 'x' | 'z'

/** Which imported-model axis points up (world +Y) after reorientation. */
export type ModelUpAxis = '+y' | '-y' | '+x' | '-x' | '+z' | '-z'

export const DEFAULT_MODEL_UP_AXIS: ModelUpAxis = '+y'

export const MODEL_UP_AXIS_OPTIONS: { id: ModelUpAxis; label: string }[] = [
  { id: '+y', label: 'Y+ up (default)' },
  { id: '-y', label: 'Y− up (flip)' },
  { id: '+x', label: 'X+ up' },
  { id: '-x', label: 'X− up' },
  { id: '+z', label: 'Z+ up (CAD)' },
  { id: '-z', label: 'Z− up' },
]

const HALF_PI = Math.PI / 2

/** Rotate model so the chosen local axis becomes world +Y (keel plane at Y=0). */
export function applyModelUpAxis(model: THREE.Object3D, upAxis: ModelUpAxis): void {
  model.rotation.set(0, 0, 0)
  switch (upAxis) {
    case '+y':
      break
    case '-y':
      model.rotation.x = Math.PI
      break
    case '+x':
      model.rotation.z = HALF_PI
      break
    case '-x':
      model.rotation.z = -HALF_PI
      break
    case '+z':
      model.rotation.x = -HALF_PI
      break
    case '-z':
      model.rotation.x = HALF_PI
      break
  }
}

export interface FootprintMeters {
  length: number
  beam: number
  depth: number
}

export interface MeshAxisBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
  minZ: number
  maxZ: number
  length: number
  beam: number
  depth: number
}

const _vertex = new THREE.Vector3()

function collectMeshVertices(model: THREE.Object3D): THREE.Vector3[] {
  const vertices: THREE.Vector3[] = []
  model.updateMatrixWorld(true)
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const position = child.geometry.attributes.position
    if (!position) return
    for (let i = 0; i < position.count; i++) {
      _vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      vertices.push(_vertex.clone())
    }
  })
  return vertices
}

function boundsFromBox3(box: THREE.Box3, lengthAxis: ModelLengthAxis): MeshAxisBounds {
  const size = box.getSize(new THREE.Vector3())
  const length = lengthAxis === 'x' ? size.x : size.z
  const beam = lengthAxis === 'x' ? size.z : size.x
  return {
    minX: box.min.x,
    maxX: box.max.x,
    minY: box.min.y,
    maxY: box.max.y,
    minZ: box.min.z,
    maxZ: box.max.z,
    length,
    beam,
    depth: size.y,
  }
}

/** Tight axis-aligned bounds from mesh vertices (falls back to object box). */
export function meshAxisBounds(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): MeshAxisBounds {
  const vertices = collectMeshVertices(model)
  if (vertices.length === 0) {
    return boundsFromBox3(new THREE.Box3().setFromObject(model), lengthAxis)
  }

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity

  for (const v of vertices) {
    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minY = Math.min(minY, v.y)
    maxY = Math.max(maxY, v.y)
    minZ = Math.min(minZ, v.z)
    maxZ = Math.max(maxZ, v.z)
  }

  const length = lengthAxis === 'x' ? maxX - minX : maxZ - minZ
  const beam = lengthAxis === 'x' ? maxZ - minZ : maxX - minX
  return {
    minX,
    maxX,
    minY,
    maxY,
    minZ,
    maxZ,
    length,
    beam,
    depth: maxY - minY,
  }
}

export function metersFromStormworksBlocks(blocks: number): number {
  return metersFromBlocks(blocks)
}

export function detectModelLengthAxis(model: THREE.Object3D): ModelLengthAxis {
  const vertices = collectMeshVertices(model)
  if (vertices.length === 0) {
    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
    return size.x >= size.z ? 'x' : 'z'
  }

  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const v of vertices) {
    minX = Math.min(minX, v.x)
    maxX = Math.max(maxX, v.x)
    minZ = Math.min(minZ, v.z)
    maxZ = Math.max(maxZ, v.z)
  }
  return maxX - minX >= maxZ - minZ ? 'x' : 'z'
}

export function footprintSizeOnAxes(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): FootprintMeters {
  const { length, beam, depth } = meshAxisBounds(model, lengthAxis)
  return { length, beam, depth }
}

/** Align using mesh bounds: beam centered, length min at 0, floor at Y = 0. */
export function alignModelFootprint(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): number {
  const bounds = meshAxisBounds(model, lengthAxis)
  const beamCenter = lengthAxis === 'z' ? (bounds.minX + bounds.maxX) / 2 : (bounds.minZ + bounds.maxZ) / 2
  const lengthMin = lengthAxis === 'z' ? bounds.minZ : bounds.minX

  const offset = new THREE.Vector3(0, -bounds.minY, 0)
  if (lengthAxis === 'z') {
    offset.x = -beamCenter
    offset.z = -lengthMin
  } else {
    offset.x = -lengthMin
    offset.z = -beamCenter
  }

  model.position.add(offset)
  return footprintSizeOnAxes(model, lengthAxis).length
}

/** Capture aligned footprint (scale = 1) before Stormworks length scaling. */
export function captureBaseFootprintM(
  model: THREE.Object3D,
  upAxis: ModelUpAxis = DEFAULT_MODEL_UP_AXIS,
): { lengthAxis: ModelLengthAxis; footprint: FootprintMeters } {
  resetModelRootTransform(model)
  applyModelUpAxis(model, upAxis)
  const lengthAxis = detectModelLengthAxis(model)
  alignModelFootprint(model, lengthAxis)
  return { lengthAxis, footprint: footprintSizeOnAxes(model, lengthAxis) }
}

/** Uniform scale so the model length axis matches Stormworks length in meters. */
export function scaleModelToStormworksLength(
  model: THREE.Object3D,
  lengthBlocks: number,
  baseLengthM: number,
): void {
  const lengthM = metersFromStormworksBlocks(lengthBlocks)
  if (baseLengthM < 1e-6 || lengthM < 1e-6) return
  const s = lengthM / baseLengthM
  model.scale.set(s, s, s)
}

export function modelBeamToLengthRatio(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): number {
  const { length, beam } = footprintSizeOnAxes(model, lengthAxis)
  if (length < 1e-6) return 1
  return beam / length
}

function line(
  points: THREE.Vector3[],
  material: THREE.LineBasicMaterial,
): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.LineSegments(geometry, material)
}

function addFloorGridLines(
  group: THREE.Group,
  lengthM: number,
  beamM: number,
  lengthAxis: ModelLengthAxis,
  cellM: number,
): void {
  const cellMat = new THREE.LineBasicMaterial({ color: 0x3a3a3a })
  const meterMat = new THREE.LineBasicMaterial({ color: 0x555555 })

  const halfBeam = beamM / 2
  const cellCountBeam = Math.round(beamM / cellM)
  const cellCountLength = Math.round(lengthM / cellM)

  if (lengthAxis === 'z') {
    for (let i = 0; i <= cellCountBeam; i++) {
      const x = -halfBeam + i * cellM
      const mat = i % 4 === 0 ? meterMat : cellMat
      group.add(
        line([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, 0, lengthM)], mat),
      )
    }
    for (let j = 0; j <= cellCountLength; j++) {
      const z = j * cellM
      const mat = j % 4 === 0 ? meterMat : cellMat
      group.add(
        line(
          [new THREE.Vector3(-halfBeam, 0, z), new THREE.Vector3(halfBeam, 0, z)],
          mat,
        ),
      )
    }
  } else {
    for (let i = 0; i <= cellCountLength; i++) {
      const x = i * cellM
      const mat = i % 4 === 0 ? meterMat : cellMat
      group.add(
        line([new THREE.Vector3(x, 0, -halfBeam), new THREE.Vector3(x, 0, halfBeam)], mat),
      )
    }
    for (let j = 0; j <= cellCountBeam; j++) {
      const z = -halfBeam + j * cellM
      const mat = j % 4 === 0 ? meterMat : cellMat
      group.add(
        line([new THREE.Vector3(0, 0, z), new THREE.Vector3(lengthM, 0, z)], mat),
      )
    }
  }
}

export function buildHullEnvelopeBox(
  lengthM: number,
  beamM: number,
  depthM: number,
  lengthAxis: ModelLengthAxis,
): THREE.LineSegments {
  const geometry =
    lengthAxis === 'z'
      ? new THREE.BoxGeometry(beamM, depthM, lengthM)
      : new THREE.BoxGeometry(lengthM, depthM, beamM)

  const edges = new THREE.EdgesGeometry(geometry)
  geometry.dispose()

  const material = new THREE.LineBasicMaterial({
    color: 0x5eead4,
    transparent: true,
    opacity: 0.85,
  })

  const wire = new THREE.LineSegments(edges, material)

  if (lengthAxis === 'z') {
    wire.position.set(0, depthM / 2, lengthM / 2)
  } else {
    wire.position.set(lengthM / 2, depthM / 2, 0)
  }

  return wire
}

export function buildStormworksHullVisuals(
  lengthM: number,
  beamM: number,
  depthM: number,
  lengthAxis: ModelLengthAxis,
  cellM = BLOCK_SIZE_M,
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'stormworks-hull-visuals'

  const gridGroup = new THREE.Group()
  gridGroup.name = 'stormworks-grid'
  addFloorGridLines(gridGroup, lengthM, beamM, lengthAxis, cellM)
  group.add(gridGroup)

  group.add(buildHullEnvelopeBox(lengthM, beamM, depthM, lengthAxis))
  return group
}

export function disposeHullVisuals(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose()
      const mat = child.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat.dispose()
    }
  })
}

export interface HullMeters {
  lengthM: number
  beamM: number
  depthM: number
}

export function hullMetersFromStore(
  planLengthBlocks: number,
  planBeamBlocks: number,
  profileDepthBlocks: number,
): HullMeters {
  return {
    lengthM: metersFromStormworksBlocks(planLengthBlocks),
    beamM: metersFromStormworksBlocks(planBeamBlocks),
    depthM: metersFromStormworksBlocks(profileDepthBlocks),
  }
}

export interface StormworksEnvelopeMeters {
  lengthM: number
  beamM: number
  depthM: number
}

export interface ModelFitResult {
  /** Footprint length in meters before Stormworks scale (after align, scale=1). */
  baseLengthM: number
  lengthScale: number
  /** Extra uniform scale when beam/depth exceed envelope (≤ 1). */
  containScale: number
  appliedScale: number
  fittedHeightM: number
  fittedLengthM: number
  exceedsEnvelopeDepth: boolean
  autoAlignmentOffset: ModelAlignmentOffset
}

export interface FitModelOptions {
  /** Grow envelope for depth instead of shrinking the model (3D reference import). */
  referenceModelMode?: boolean
  upAxis?: ModelUpAxis
}

export function getModelWorldBox(model: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(model)
}

export function resetModelRootTransform(model: THREE.Object3D): void {
  model.position.set(0, 0, 0)
  model.rotation.set(0, 0, 0)
  model.scale.set(1, 1, 1)
}

function computeLengthCenterOffset(
  fittedLengthM: number,
  envelopeLengthM: number,
): number {
  const gap = envelopeLengthM - fittedLengthM
  return gap > 1e-4 ? gap / 2 : 0
}

/**
 * Fit model inside Stormworks envelope:
 * 1. Align footprint (beam centered, length from 0, floor Y=0)
 * 2. Uniform scale so length axis = lengthM
 * 3. Contain shrink if beam/depth exceed envelope (depth skipped in referenceModelMode)
 * 4. Center along length when model is shorter than envelope
 */
export function fitModelToStormworksEnvelope(
  model: THREE.Object3D,
  envelope: StormworksEnvelopeMeters,
  lengthAxis: ModelLengthAxis,
  lengthBlocks: number,
  options: FitModelOptions = {},
): ModelFitResult {
  const { referenceModelMode = false, upAxis = DEFAULT_MODEL_UP_AXIS } = options
  resetModelRootTransform(model)
  applyModelUpAxis(model, upAxis)

  const baseLengthM = alignModelFootprint(model, lengthAxis)
  const lengthM = metersFromStormworksBlocks(lengthBlocks)
  const lengthScale = baseLengthM > 1e-6 ? lengthM / baseLengthM : 1
  model.scale.set(lengthScale, lengthScale, lengthScale)

  let { length, beam, depth } = footprintSizeOnAxes(model, lengthAxis)

  let containScale = 1
  const beamExceeds = beam > envelope.beamM + 1e-6
  const depthExceeds = depth > envelope.depthM + 1e-6

  if (beamExceeds || (!referenceModelMode && depthExceeds)) {
    const beamFactor = beam > 1e-6 ? envelope.beamM / beam : 1
    const depthFactor = depth > 1e-6 ? envelope.depthM / depth : 1
    containScale = referenceModelMode
      ? Math.min(beamFactor, 1)
      : Math.min(beamFactor, depthFactor, 1)

    if (containScale < 1 - 1e-6) {
      model.scale.multiplyScalar(containScale)
      alignModelFootprint(model, lengthAxis)
      ;({ length, beam, depth } = footprintSizeOnAxes(model, lengthAxis))
    }
  }

  const appliedScale = lengthScale * containScale
  const autoAlignmentOffset: ModelAlignmentOffset = {
    length: computeLengthCenterOffset(length, envelope.lengthM),
    beam: 0,
    up: 0,
  }

  return {
    baseLengthM,
    lengthScale,
    containScale,
    appliedScale,
    fittedHeightM: depth,
    fittedLengthM: length,
    exceedsEnvelopeDepth: depth > envelope.depthM + 1e-3,
    autoAlignmentOffset,
  }
}

/** Depth blocks for envelope from base footprint and target Stormworks length. */
export function profileDepthBlocksFromBaseFootprint(
  baseFootprint: FootprintMeters,
  lengthBlocks: number,
  cellM = BLOCK_SIZE_M,
): number {
  if (baseFootprint.length < 1e-6) return 8
  const lengthScale = metersFromStormworksBlocks(lengthBlocks) / baseFootprint.length
  const depthM = baseFootprint.depth * lengthScale
  return clampGridDim(Math.ceil(depthM / cellM))
}

export interface ModelAlignmentOffset {
  /** Along hull length (bow/stern). */
  length: number
  /** Across hull (port/starboard). */
  beam: number
  /** Vertical (up). */
  up: number
}

export const ZERO_ALIGNMENT_OFFSET: ModelAlignmentOffset = { length: 0, beam: 0, up: 0 }

export interface ModelAlignmentRotation {
  /** Euler degrees, X axis (port/starboard tilt). */
  x: number
  /** Euler degrees, Y axis (yaw). */
  y: number
  /** Euler degrees, Z axis (roll). */
  z: number
}

export const ZERO_ALIGNMENT_ROTATION: ModelAlignmentRotation = { x: 0, y: 0, z: 0 }

export function alignmentOffsetToWorld(
  offset: ModelAlignmentOffset,
  lengthAxis: ModelLengthAxis,
): THREE.Vector3 {
  if (lengthAxis === 'z') {
    return new THREE.Vector3(offset.beam, offset.up, offset.length)
  }
  return new THREE.Vector3(offset.length, offset.up, offset.beam)
}

export function worldToAlignmentOffset(
  x: number,
  y: number,
  z: number,
  lengthAxis: ModelLengthAxis,
): ModelAlignmentOffset {
  if (lengthAxis === 'z') {
    return { beam: x, up: y, length: z }
  }
  return { length: x, up: y, beam: z }
}

export function applyModelWrapperTransform(
  wrapper: THREE.Object3D,
  offset: ModelAlignmentOffset,
  rotation: ModelAlignmentRotation,
  lengthAxis: ModelLengthAxis,
): void {
  wrapper.position.copy(alignmentOffsetToWorld(offset, lengthAxis))
  wrapper.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z),
    'XYZ',
  )
}
