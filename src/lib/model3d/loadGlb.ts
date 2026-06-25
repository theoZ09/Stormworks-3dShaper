import * as THREE from 'three'
import {
  alignModelFootprint,
  detectModelLengthAxis,
  type ModelLengthAxis,
  scaleModelToStormworksLength,
} from './hullAlignment'

export async function loadGlbFromUrl(url: string): Promise<THREE.Group> {
  const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js')
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf.scene),
      undefined,
      (err) => reject(err instanceof Error ? err : new Error('Kunde inte ladda modellen')),
    )
  })
}

export interface StormworksModelAlignment {
  lengthAxis: ModelLengthAxis
  baseLengthM: number
}

/**
 * Align footprint (beam centered, length from 0, floor at Y=0) and scale to Stormworks length.
 */
export function alignModelToStormworks(
  model: THREE.Object3D,
  lengthBlocks: number,
  lengthAxis?: ModelLengthAxis,
): StormworksModelAlignment {
  const axis = lengthAxis ?? detectModelLengthAxis(model)
  const baseLengthM = alignModelFootprint(model, axis)
  scaleModelToStormworksLength(model, lengthBlocks, baseLengthM)
  return { lengthAxis: axis, baseLengthM }
}

export function frameCameraToObject(
  camera: THREE.PerspectiveCamera,
  controls: { target: THREE.Vector3; update: () => void },
  object: THREE.Object3D,
  padding = 1.35,
): void {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 0.5)

  const fovRad = (camera.fov * Math.PI) / 180
  const distance = (maxDim / 2 / Math.tan(fovRad / 2)) * padding

  camera.position.set(
    center.x + distance * 0.55,
    center.y + distance * 0.35,
    center.z + distance * 0.85,
  )
  camera.near = Math.max(distance / 200, 0.01)
  camera.far = Math.max(distance * 50, 500)
  camera.updateProjectionMatrix()

  controls.target.copy(center)
  controls.update()
}

export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of materials) mat.dispose()
    }
  })
}

/** @deprecated Use modelBeamToLengthRatio from hullAlignment after footprint align. */
export function modelPlanFootprintRatio(model: THREE.Object3D): number {
  const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3())
  const length = Math.max(size.x, size.z)
  const beam = Math.min(size.x, size.z)
  if (length < 1e-6) return 1
  return beam / length
}
