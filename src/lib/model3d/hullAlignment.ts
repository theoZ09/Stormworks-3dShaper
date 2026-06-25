import * as THREE from 'three'
import { BLOCK_SIZE_M, metersFromBlocks } from '../grid/stormworksDimensions'

/**
 * 3D scene convention (Stormworks hull reference):
 * - Y = up (profile depth / height)
 * - Length axis = longer horizontal model axis at import ('x' or 'z')
 * - Beam axis = the other horizontal axis
 * - Footprint origin: beam centered on 0, length runs 0 → lengthM, keel at Y = 0
 */
export type ModelLengthAxis = 'x' | 'z'

export function metersFromStormworksBlocks(blocks: number): number {
  return metersFromBlocks(blocks)
}

export function detectModelLengthAxis(model: THREE.Object3D): ModelLengthAxis {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  return size.x >= size.z ? 'x' : 'z'
}

export function footprintSizeOnAxes(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): { length: number; beam: number; depth: number } {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  const length = lengthAxis === 'x' ? size.x : size.z
  const beam = lengthAxis === 'x' ? size.z : size.x
  return { length, beam, depth: size.y }
}

/** Center beam axis, length min at 0, floor at Y = 0. Returns footprint length in meters. */
export function alignModelFootprint(
  model: THREE.Object3D,
  lengthAxis: ModelLengthAxis,
): number {
  const box = new THREE.Box3().setFromObject(model)
  const center = box.getCenter(new THREE.Vector3())

  const offset = new THREE.Vector3(0, -box.min.y, 0)

  if (lengthAxis === 'z') {
    offset.x = -center.x
    offset.z = -box.min.z
  } else {
    offset.x = -box.min.x
    offset.z = -center.z
  }

  model.position.add(offset)
  return footprintSizeOnAxes(model, lengthAxis).length
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
  exceedsEnvelopeDepth: boolean
}

export function getModelWorldBox(model: THREE.Object3D): THREE.Box3 {
  return new THREE.Box3().setFromObject(model)
}

export function resetModelRootTransform(model: THREE.Object3D): void {
  model.position.set(0, 0, 0)
  model.rotation.set(0, 0, 0)
  model.scale.set(1, 1, 1)
}

/**
 * Fit model inside Stormworks envelope:
 * 1. Align footprint (beam centered, length from 0, floor Y=0)
 * 2. Uniform scale so length axis = lengthM
 * 3. If beam or depth still exceeds envelope, uniform contain scale (may shorten length slightly)
 */
export function fitModelToStormworksEnvelope(
  model: THREE.Object3D,
  envelope: StormworksEnvelopeMeters,
  lengthAxis: ModelLengthAxis,
  lengthBlocks: number,
): ModelFitResult {
  resetModelRootTransform(model)

  const baseLengthM = alignModelFootprint(model, lengthAxis)
  const lengthM = metersFromStormworksBlocks(lengthBlocks)
  const lengthScale = baseLengthM > 1e-6 ? lengthM / baseLengthM : 1
  model.scale.set(lengthScale, lengthScale, lengthScale)

  let { beam, depth } = footprintSizeOnAxes(model, lengthAxis)

  let containScale = 1
  if (beam > envelope.beamM + 1e-6 || depth > envelope.depthM + 1e-6) {
    const beamFactor = beam > 1e-6 ? envelope.beamM / beam : 1
    const depthFactor = depth > 1e-6 ? envelope.depthM / depth : 1
    containScale = Math.min(beamFactor, depthFactor, 1)
    if (containScale < 1 - 1e-6) {
      model.scale.multiplyScalar(containScale)
      alignModelFootprint(model, lengthAxis)
      ;({ beam, depth } = footprintSizeOnAxes(model, lengthAxis))
    }
  }

  const appliedScale = lengthScale * containScale

  return {
    baseLengthM,
    lengthScale,
    containScale,
    appliedScale,
    fittedHeightM: depth,
    exceedsEnvelopeDepth: depth > envelope.depthM + 1e-3,
  }
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

export function alignmentOffsetToWorld(
  offset: ModelAlignmentOffset,
  lengthAxis: ModelLengthAxis,
): THREE.Vector3 {
  if (lengthAxis === 'z') {
    return new THREE.Vector3(offset.beam, offset.up, offset.length)
  }
  return new THREE.Vector3(offset.length, offset.up, offset.beam)
}
