import * as THREE from 'three'

interface MaterialSnapshot {
  material: THREE.Material
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

const PREVIEW_MODEL_OPACITY = 0.18

export function setModelPreviewTransparency(
  model: THREE.Object3D,
  previewActive: boolean,
  snapshots: MaterialSnapshot[],
): void {
  if (previewActive) {
    snapshots.length = 0
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const material of materials) {
        snapshots.push({
          material,
          opacity: material.opacity,
          transparent: material.transparent,
          depthWrite: material.depthWrite,
        })
        material.transparent = true
        material.opacity = PREVIEW_MODEL_OPACITY
        material.depthWrite = false
        material.needsUpdate = true
      }
    })
    return
  }

  for (const snapshot of snapshots) {
    snapshot.material.opacity = snapshot.opacity
    snapshot.material.transparent = snapshot.transparent
    snapshot.material.depthWrite = snapshot.depthWrite
    snapshot.material.needsUpdate = true
  }
  snapshots.length = 0
}
