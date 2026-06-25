import { BLOCK_SIZE_M } from '../grid/stormworksDimensions'
import type { ModelLengthAxis } from '../model3d/hullAlignment'

export interface GridDimensions {
  beamBlocks: number
  lengthBlocks: number
  depthBlocks: number
}

/** Cell center in frame-group space (meters), matching hullAlignment envelope. */
export function cellCenterMeters(
  ix: number,
  iy: number,
  iz: number,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
  cellM = BLOCK_SIZE_M,
): { x: number; y: number; z: number } {
  const beamM = dims.beamBlocks * cellM
  const halfBeam = beamM / 2

  if (lengthAxis === 'z') {
    return {
      x: -halfBeam + (ix + 0.5) * cellM,
      y: (iy + 0.5) * cellM,
      z: (iz + 0.5) * cellM,
    }
  }

  return {
    x: (ix + 0.5) * cellM,
    y: (iy + 0.5) * cellM,
    z: -halfBeam + (iz + 0.5) * cellM,
  }
}

/**
 * Map grid indices to Stormworks vp (block steps).
 * Stormworks: X=beam, Y=up, Z=length — origin centered on mid (length + beam).
 */
export function gridIndexToStormworksVp(
  ix: number,
  iy: number,
  iz: number,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
): { x: number; y: number; z: number } {
  const y = iy
  const lengthCenter = Math.floor((dims.lengthBlocks - 1) / 2)
  const beamCenter = Math.floor((dims.beamBlocks - 1) / 2)

  if (lengthAxis === 'z') {
    return {
      x: ix - beamCenter,
      y,
      z: iz - lengthCenter,
    }
  }

  return {
    x: iz - beamCenter,
    y,
    z: ix - lengthCenter,
  }
}

export function gridCellKey(ix: number, iy: number, iz: number): string {
  return `${ix},${iy},${iz}`
}
