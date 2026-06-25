import * as THREE from 'three'

const BOX_CORNER_SIGNS: [number, number, number][] = [
  [-1, -1, -1],
  [1, -1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, 1, 1],
  [-1, 1, 1],
]

const BOX_EDGE_PAIRS: [number, number][] = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
]

function buildEdgeGeometry(
  centers: { x: number; y: number; z: number }[],
  half: number,
): THREE.BufferGeometry {
  const positions = new Float32Array(centers.length * BOX_EDGE_PAIRS.length * 2 * 3)
  let offset = 0

  for (const center of centers) {
    const corners = BOX_CORNER_SIGNS.map(
      ([sx, sy, sz]) =>
        new THREE.Vector3(
          center.x + sx * half,
          center.y + sy * half,
          center.z + sz * half,
        ),
    )

    for (const [a, b] of BOX_EDGE_PAIRS) {
      const pa = corners[a]!
      const pb = corners[b]!
      positions[offset++] = pa.x
      positions[offset++] = pa.y
      positions[offset++] = pa.z
      positions[offset++] = pb.x
      positions[offset++] = pb.y
      positions[offset++] = pb.z
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geometry
}

/** White voxel fill + thin black edge lines (Stormworks-style). */
export function createVoxelPreviewGroup(
  centers: { x: number; y: number; z: number }[],
  cellSize: number,
): THREE.Group {
  const group = new THREE.Group()
  group.name = 'voxel-preview'

  const fillGeometry = new THREE.BoxGeometry(cellSize, cellSize, cellSize)
  const fillMaterial = new THREE.MeshLambertMaterial({
    color: 0xffffff,
  })
  const fillMesh = new THREE.InstancedMesh(fillGeometry, fillMaterial, centers.length)
  fillMesh.name = 'voxel-preview-fill'
  fillMesh.renderOrder = 1

  const matrix = new THREE.Matrix4()
  const position = new THREE.Vector3()
  centers.forEach((c, i) => {
    position.set(c.x, c.y, c.z)
    matrix.makeTranslation(position.x, position.y, position.z)
    fillMesh.setMatrixAt(i, matrix)
  })
  fillMesh.instanceMatrix.needsUpdate = true
  group.add(fillMesh)

  const half = cellSize / 2
  const edgeGeometry = buildEdgeGeometry(centers, half)
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x000000,
    linewidth: 1,
  })
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial)
  edgeLines.name = 'voxel-preview-edges'
  edgeLines.renderOrder = 2
  group.add(edgeLines)

  return group
}

export function disposeVoxelPreviewGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      for (const mat of materials) mat.dispose()
    }
  })
}
