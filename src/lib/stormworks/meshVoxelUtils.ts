import * as THREE from 'three'

const _vA = new THREE.Vector3()
const _vB = new THREE.Vector3()
const _vC = new THREE.Vector3()
const _closest = new THREE.Vector3()
const _cellMin = new THREE.Vector3()
const _cellMax = new THREE.Vector3()
const _triangle = new THREE.Triangle()

/** Extract mesh triangles in world space. */
export function collectWorldTriangles(meshes: THREE.Mesh[]): THREE.Triangle[] {
  const triangles: THREE.Triangle[] = []

  for (const mesh of meshes) {
    const geometry = mesh.geometry
    const position = geometry.attributes.position
    if (!position) continue

    const index = geometry.index
    const triCount = index ? index.count / 3 : position.count / 3

    for (let t = 0; t < triCount; t++) {
      const i0 = index ? index.getX(t * 3) : t * 3
      const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
      const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

      _vA.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld)
      _vB.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld)
      _vC.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld)
      triangles.push(new THREE.Triangle(_vA.clone(), _vB.clone(), _vC.clone()))
    }
  }

  return triangles
}

export function cellWorldBox(
  localCenter: THREE.Vector3,
  cellSize: number,
  frameGroup: THREE.Object3D,
): THREE.Box3 {
  const half = cellSize / 2
  _cellMin.set(
    localCenter.x - half,
    localCenter.y - half,
    localCenter.z - half,
  )
  _cellMax.set(
    localCenter.x + half,
    localCenter.y + half,
    localCenter.z + half,
  )
  _cellMin.applyMatrix4(frameGroup.matrixWorld)
  _cellMax.applyMatrix4(frameGroup.matrixWorld)
  return new THREE.Box3(_cellMin, _cellMax)
}

export function cellIntersectsTriangles(
  cellBox: THREE.Box3,
  triangles: THREE.Triangle[],
): boolean {
  for (const tri of triangles) {
    _triangle.copy(tri)
    if (cellBox.intersectsTriangle(_triangle)) return true
  }
  return false
}

export function minDistanceToTriangles(
  point: THREE.Vector3,
  triangles: THREE.Triangle[],
): number {
  let min = Infinity
  for (const tri of triangles) {
    tri.closestPointToPoint(point, _closest)
    const d = point.distanceToSquared(_closest)
    if (d < min) min = d
  }
  return Math.sqrt(min)
}
