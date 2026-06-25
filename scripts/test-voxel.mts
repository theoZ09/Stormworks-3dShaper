import * as fs from 'fs'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  detectModelLengthAxis,
  fitModelToStormworksEnvelope,
  hullMetersFromStore,
} from '../src/lib/model3d/hullAlignment.ts'
import { voxelizeSurface } from '../src/lib/stormworks/voxelizeMesh.ts'

const glbPath = process.argv[2] ?? 'c:/Users/simon/Downloads/Test_Skrov1.glb'
const buf = fs.readFileSync(glbPath)
const loader = new GLTFLoader()
const gltf = await new Promise<import('three/examples/jsm/loaders/GLTFLoader.js').GLTF>((res, rej) =>
  loader.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), '', res, rej),
)

const model = gltf.scene
const wrapper = new THREE.Group()
wrapper.add(model)
const frame = new THREE.Group()
frame.add(wrapper)

const lengthAxis = detectModelLengthAxis(model)
const depthBlocks = 9
const env = hullMetersFromStore(80, 14, depthBlocks)
fitModelToStormworksEnvelope(model, env, lengthAxis, 80)

const voxels = voxelizeSurface(
  wrapper,
  { beamBlocks: 14, lengthBlocks: 80, depthBlocks, lengthAxis },
  0.25,
  frame,
)

console.log(
  JSON.stringify({
    file: glbPath,
    lengthAxis,
    depthBlocks,
    voxelCount: voxels.length,
  }),
)
