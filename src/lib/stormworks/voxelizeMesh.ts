import * as THREE from 'three'
import { BLOCK_SIZE_M } from '../grid/stormworksDimensions'
import type { ModelLengthAxis } from '../model3d/hullAlignment'
import {
  cellCenterMeters,
  gridCellKey,
  gridIndexToStormworksVp,
  type GridDimensions,
} from './voxelCoords'
import type { StormworksVoxel } from './exportXml'
import {
  cellIntersectsTriangles,
  cellWorldBox,
  collectWorldTriangles,
  minDistanceToTriangles,
} from './meshVoxelUtils'

export interface VoxelBounds extends GridDimensions {
  lengthAxis: ModelLengthAxis
}

function collectMeshes(root: THREE.Object3D, out: THREE.Mesh[]): void {
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) out.push(child)
  })
}

function inGrid(
  ix: number,
  iy: number,
  iz: number,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
): boolean {
  if (iy < 0 || iy >= dims.depthBlocks) return false
  if (lengthAxis === 'z') {
    return ix >= 0 && ix < dims.beamBlocks && iz >= 0 && iz < dims.lengthBlocks
  }
  return ix >= 0 && ix < dims.lengthBlocks && iz >= 0 && iz < dims.beamBlocks
}

const NEIGHBOR_OFFSETS: [number, number, number][] = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1],
]

function shellFilter(
  occupied: Set<string>,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
): void {
  for (const key of [...occupied]) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number]

    let hasEmptyNeighbor = false
    for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
      const nx = gx + dx
      const ny = gy + dy
      const nz = gz + dz
      if (!inGrid(nx, ny, nz, dims, lengthAxis) || !occupied.has(gridCellKey(nx, ny, nz))) {
        hasEmptyNeighbor = true
        break
      }
    }

    if (!hasEmptyNeighbor) occupied.delete(key)
  }
}

/**
 * Peel clearly inner layers only — neighbor must be meaningfully closer to the mesh
 * (avoids stripping alternating cells on shallow slopes).
 */
function thinToOuterLayer(
  occupied: Set<string>,
  worldCenters: Map<string, THREE.Vector3>,
  triangles: THREE.Triangle[],
  cellSize: number,
): void {
  const peelMinDelta = cellSize * 0.35
  const distances = new Map<string, number>()
  for (const key of occupied) {
    const center = worldCenters.get(key)
    if (!center) continue
    distances.set(key, minDistanceToTriangles(center, triangles))
  }

  let changed = true
  while (changed) {
    changed = false
    for (const key of [...occupied]) {
      const myDist = distances.get(key)
      if (myDist === undefined) continue

      const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number]
      for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
        const nk = gridCellKey(gx + dx, gy + dy, gz + dz)
        if (!occupied.has(nk)) continue

        const nDist = distances.get(nk)
        if (nDist !== undefined && nDist < myDist - peelMinDelta) {
          occupied.delete(key)
          distances.delete(key)
          changed = true
          break
        }
      }
    }
  }
}

function countOccupiedNeighbors(
  gx: number,
  gy: number,
  gz: number,
  occupied: Set<string>,
): number {
  let count = 0
  for (const [dx, dy, dz] of NEIGHBOR_OFFSETS) {
    if (occupied.has(gridCellKey(gx + dx, gy + dy, gz + dz))) count++
  }
  return count
}

/** Fill small holes on the shell (mesh hit + ≥2 occupied face-neighbors). Runs a few passes. */
function fillSurfaceGaps(
  occupied: Set<string>,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
  triangles: THREE.Triangle[],
  frameGroup: THREE.Object3D,
  cellSize: number,
): void {
  const localCenter = new THREE.Vector3()
  const worldCenter = new THREE.Vector3()
  const xMax = lengthAxis === 'z' ? dims.beamBlocks : dims.lengthBlocks
  const zMax = lengthAxis === 'z' ? dims.lengthBlocks : dims.beamBlocks
  const nearSurface = cellSize * 0.45
  const minNeighbors = 2
  const maxPasses = 4

  for (let pass = 0; pass < maxPasses; pass++) {
    const toAdd: string[] = []

    for (let iy = 0; iy < dims.depthBlocks; iy++) {
      for (let ix = 0; ix < xMax; ix++) {
        for (let iz = 0; iz < zMax; iz++) {
          const key = gridCellKey(ix, iy, iz)
          if (occupied.has(key)) continue
          if (countOccupiedNeighbors(ix, iy, iz, occupied) < minNeighbors) continue

          const c = cellCenterMeters(ix, iy, iz, dims, lengthAxis, cellSize)
          localCenter.set(c.x, c.y, c.z)
          worldCenter.copy(localCenter).applyMatrix4(frameGroup.matrixWorld)

          const cellBox = cellWorldBox(localCenter, cellSize, frameGroup)
          const hitsMesh =
            cellIntersectsTriangles(cellBox, triangles) ||
            minDistanceToTriangles(worldCenter, triangles) <= nearSurface
          if (!hitsMesh) continue

          toAdd.push(key)
        }
      }
    }

    if (toAdd.length === 0) break
    for (const key of toAdd) occupied.add(key)
  }
}

/**
 * Voxelize mesh **shell** (ytterhölje) at fixed cell size inside Stormworks envelope.
 *
 * Method:
 * 1. Iterate every cell; mark if cell AABB intersects any mesh triangle (world space).
 * 2. Shell filter: keep only cells with ≥1 empty 6-neighbor (no solid fill).
 * 3. Distance peel: remove clearly inner layers (neighbor ≥0.35 block closer).
 * 4. Gap-fill: restore small holes (≥2 neighbors, up to 4 passes).
 */
export function voxelizeSurface(
  mesh: THREE.Object3D,
  bounds: VoxelBounds,
  cellSize: number,
  frameGroup: THREE.Object3D,
): StormworksVoxel[] {
  mesh.updateMatrixWorld(true)
  frameGroup.updateMatrixWorld(true)

  const meshes: THREE.Mesh[] = []
  collectMeshes(mesh, meshes)
  if (meshes.length === 0) return []

  const triangles = collectWorldTriangles(meshes)
  if (triangles.length === 0) return []

  const { lengthAxis, ...dims } = bounds
  const occupied = new Set<string>()
  const worldCenters = new Map<string, THREE.Vector3>()

  const localCenter = new THREE.Vector3()
  const worldCenter = new THREE.Vector3()

  const xMax = lengthAxis === 'z' ? dims.beamBlocks : dims.lengthBlocks
  const zMax = lengthAxis === 'z' ? dims.lengthBlocks : dims.beamBlocks

  for (let iy = 0; iy < dims.depthBlocks; iy++) {
    for (let ix = 0; ix < xMax; ix++) {
      for (let iz = 0; iz < zMax; iz++) {
        const c = cellCenterMeters(ix, iy, iz, dims, lengthAxis, cellSize)
        localCenter.set(c.x, c.y, c.z)
        worldCenter.copy(localCenter).applyMatrix4(frameGroup.matrixWorld)

        const cellBox = cellWorldBox(localCenter, cellSize, frameGroup)
        if (!cellIntersectsTriangles(cellBox, triangles)) continue

        const key = gridCellKey(ix, iy, iz)
        occupied.add(key)
        worldCenters.set(key, worldCenter.clone())
      }
    }
  }

  shellFilter(occupied, dims, lengthAxis)
  thinToOuterLayer(occupied, worldCenters, triangles, cellSize)
  fillSurfaceGaps(occupied, dims, lengthAxis, triangles, frameGroup, cellSize)
  shellFilter(occupied, dims, lengthAxis)

  const voxels: StormworksVoxel[] = []
  for (const key of occupied) {
    const [gx, gy, gz] = key.split(',').map(Number) as [number, number, number]
    voxels.push(gridIndexToStormworksVp(gx, gy, gz, dims, lengthAxis))
  }

  voxels.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x)
  return voxels
}

export function voxelizeSurfaceShell(
  meshRoot: THREE.Object3D,
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
  frameGroup: THREE.Object3D,
  cellM = BLOCK_SIZE_M,
): StormworksVoxel[] {
  return voxelizeSurface(meshRoot, { ...dims, lengthAxis }, cellM, frameGroup)
}

export interface VoxelPreviewPosition {
  x: number
  y: number
  z: number
}

/** Frame-group local centers for preview cubes. */
export function voxelPreviewCenters(
  voxels: StormworksVoxel[],
  dims: GridDimensions,
  lengthAxis: ModelLengthAxis,
  cellM = BLOCK_SIZE_M,
): VoxelPreviewPosition[] {
  const lengthCenter = Math.floor((dims.lengthBlocks - 1) / 2)
  const beamCenter = Math.floor((dims.beamBlocks - 1) / 2)
  const half = cellM / 2

  return voxels.map((vp) => {
    if (lengthAxis === 'z') {
      return {
        x: (vp.x + beamCenter) * cellM + half - (dims.beamBlocks * cellM) / 2,
        y: vp.y * cellM + half,
        z: (vp.z + lengthCenter) * cellM + half,
      }
    }
    return {
      x: (vp.z + lengthCenter) * cellM + half,
      y: vp.y * cellM + half,
      z: (vp.x + beamCenter) * cellM + half - (dims.beamBlocks * cellM) / 2,
    }
  })
}
