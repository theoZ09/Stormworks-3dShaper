import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BLOCK_SIZE_M } from '../../lib/grid/stormworksDimensions'
import {
  alignmentOffsetToWorld,
  buildStormworksHullVisuals,
  detectModelLengthAxis,
  disposeHullVisuals,
  fitModelToStormworksEnvelope,
  hullMetersFromStore,
  modelBeamToLengthRatio,
  type ModelLengthAxis,
} from '../../lib/model3d/hullAlignment'
import { setModelPreviewTransparency } from '../../lib/model3d/modelTransparency'
import { disposeObject3D, frameCameraToObject, loadGlbFromUrl } from '../../lib/model3d/loadGlb'
import type { StormworksVoxel } from '../../lib/stormworks/exportXml'
import { createVoxelPreviewGroup, disposeVoxelPreviewGroup } from '../../lib/stormworks/voxelPreviewVisuals'
import { voxelizeSurface, voxelPreviewCenters } from '../../lib/stormworks/voxelizeMesh'
import { useHullStore } from '../../store/hullStore'

export type Model3DLoadState = 'idle' | 'loading' | 'loaded' | 'error'

export interface Model3DViewportHandle {
  voxelizeSurface: () => StormworksVoxel[]
}

interface Model3DViewportProps {
  importFile: File | null
  onLoadStateChange?: (state: Model3DLoadState, message?: string) => void
  className?: string
}

interface SceneApi {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  frameGroup: THREE.Group
  hullVisuals: THREE.Group
  modelWrapper: THREE.Group | null
  loadedModel: THREE.Object3D | null
  voxelPreview: THREE.Group | null
  modelMaterialSnapshots: Array<{
    material: THREE.Material
    opacity: number
    transparent: boolean
    depthWrite: boolean
  }>
}

function rebuildHullVisuals(
  api: SceneApi,
  planLength: number,
  planBeam: number,
  profileDepth: number,
  lengthAxis: ModelLengthAxis,
): void {
  api.frameGroup.remove(api.hullVisuals)
  disposeHullVisuals(api.hullVisuals)

  const { lengthM, beamM, depthM } = hullMetersFromStore(planLength, planBeam, profileDepth)
  const next = buildStormworksHullVisuals(lengthM, beamM, depthM, lengthAxis)
  api.hullVisuals = next
  api.frameGroup.add(next)
}

function disposeVoxelPreview(api: SceneApi): void {
  if (!api.voxelPreview) return
  api.frameGroup.remove(api.voxelPreview)
  disposeVoxelPreviewGroup(api.voxelPreview)
  api.voxelPreview = null
  if (api.loadedModel) {
    setModelPreviewTransparency(api.loadedModel, false, api.modelMaterialSnapshots)
  }
}

function updateVoxelPreview(
  api: SceneApi,
  voxels: StormworksVoxel[],
  planBeam: number,
  planLength: number,
  profileDepth: number,
  lengthAxis: ModelLengthAxis,
): void {
  disposeVoxelPreview(api)
  if (voxels.length === 0) return

  const dims = {
    beamBlocks: planBeam,
    lengthBlocks: planLength,
    depthBlocks: profileDepth,
  }
  const centers = voxelPreviewCenters(voxels, dims, lengthAxis)
  const group = createVoxelPreviewGroup(centers, BLOCK_SIZE_M)
  api.frameGroup.add(group)
  api.voxelPreview = group

  if (api.loadedModel) {
    setModelPreviewTransparency(api.loadedModel, true, api.modelMaterialSnapshots)
  }
}

function applyWrapperOffset(api: SceneApi): void {
  if (!api.modelWrapper) return
  const { modelAlignmentOffset, modelLengthAxis } = useHullStore.getState()
  const world = alignmentOffsetToWorld(modelAlignmentOffset, modelLengthAxis)
  api.modelWrapper.position.copy(world)
}

function refitLoadedModel(api: SceneApi): void {
  if (!api.loadedModel) return

  const state = useHullStore.getState()
  const envelope = hullMetersFromStore(
    state.plan.gridHeight,
    state.plan.gridWidth,
    state.profile.gridHeight,
  )

  const fit = fitModelToStormworksEnvelope(
    api.loadedModel,
    envelope,
    state.modelLengthAxis,
    state.plan.gridHeight,
  )

  useHullStore.getState().setModelDepthExceedsEnvelope(fit.exceedsEnvelopeDepth)
  useHullStore.getState().setProfileDepthFromModel(fit.fittedHeightM)
  applyWrapperOffset(api)
}

function frameScene(api: SceneApi): void {
  frameCameraToObject(api.camera, api.controls, api.frameGroup)
}

function clearLoadedModel(api: SceneApi): void {
  if (api.loadedModel) {
    setModelPreviewTransparency(api.loadedModel, false, api.modelMaterialSnapshots)
  }
  if (api.modelWrapper) {
    api.frameGroup.remove(api.modelWrapper)
    if (api.loadedModel) disposeObject3D(api.loadedModel)
    api.modelWrapper = null
    api.loadedModel = null
  }
  disposeVoxelPreview(api)
  useHullStore.getState().setSurfaceVoxels([])
}

function mountLoadedModel(api: SceneApi, model: THREE.Object3D): void {
  clearLoadedModel(api)

  const wrapper = new THREE.Group()
  wrapper.name = 'model-wrapper'
  wrapper.add(model)
  api.frameGroup.add(wrapper)
  api.modelWrapper = wrapper
  api.loadedModel = model
}

function runVoxelize(api: SceneApi): StormworksVoxel[] {
  if (!api.modelWrapper) return []

  const state = useHullStore.getState()
  return voxelizeSurface(
    api.modelWrapper,
    {
      beamBlocks: state.plan.gridWidth,
      lengthBlocks: state.plan.gridHeight,
      depthBlocks: state.profile.gridHeight,
      lengthAxis: state.modelLengthAxis,
    },
    BLOCK_SIZE_M,
    api.frameGroup,
  )
}

export const Model3DViewport = forwardRef<Model3DViewportHandle, Model3DViewportProps>(
  function Model3DViewport({ importFile, onLoadStateChange, className = '' }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const sceneRef = useRef<SceneApi | null>(null)

    const planLength = useHullStore((s) => s.plan.gridHeight)
    const planBeam = useHullStore((s) => s.plan.gridWidth)
    const profileDepth = useHullStore((s) => s.profile.gridHeight)
    const modelLengthAxis = useHullStore((s) => s.modelLengthAxis)
    const modelAlignmentOffset = useHullStore((s) => s.modelAlignmentOffset)
    const modelFitVersion = useHullStore((s) => s.modelFitVersion)
    const surfaceVoxels = useHullStore((s) => s.surfaceVoxels)

    useImperativeHandle(ref, () => ({
      voxelizeSurface: () => {
        const api = sceneRef.current
        if (!api) return []
        return runVoxelize(api)
      },
    }))

    useEffect(() => {
      const container = containerRef.current
      if (!container) return

      const hull = useHullStore.getState()
      const { lengthM, beamM, depthM } = hullMetersFromStore(
        hull.plan.gridHeight,
        hull.plan.gridWidth,
        hull.profile.gridHeight,
      )

      const scene = new THREE.Scene()
      scene.background = new THREE.Color(0x1a1a1a)

      const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 2000)
      camera.position.set(8, 5, 10)

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.domElement.style.display = 'block'
      renderer.domElement.style.width = '100%'
      renderer.domElement.style.height = '100%'
      container.appendChild(renderer.domElement)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.dampingFactor = 0.08
      controls.minDistance = 1
      controls.maxDistance = 500

      scene.add(new THREE.AmbientLight(0xffffff, 0.5))

      const key = new THREE.DirectionalLight(0xffffff, 1.1)
      key.position.set(5, 10, 7)
      scene.add(key)

      const fill = new THREE.DirectionalLight(0x88aaff, 0.35)
      fill.position.set(-6, 2, -4)
      scene.add(fill)

      const frameGroup = new THREE.Group()
      frameGroup.name = 'frame-group'
      scene.add(frameGroup)

      const hullVisuals = buildStormworksHullVisuals(
        lengthM,
        beamM,
        depthM,
        hull.modelLengthAxis,
      )
      frameGroup.add(hullVisuals)

      const api: SceneApi = {
        scene,
        camera,
        controls,
        frameGroup,
        hullVisuals,
        modelWrapper: null,
        loadedModel: null,
        voxelPreview: null,
        modelMaterialSnapshots: [],
      }
      sceneRef.current = api
      frameScene(api)

      let frameId = 0
      const animate = () => {
        frameId = requestAnimationFrame(animate)
        controls.update()
        renderer.render(scene, camera)
      }
      animate()

      const resize = () => {
        const w = container.clientWidth
        const h = container.clientHeight
        if (w === 0 || h === 0) return
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
      }

      const observer = new ResizeObserver(resize)
      observer.observe(container)
      resize()

      return () => {
        cancelAnimationFrame(frameId)
        observer.disconnect()
        controls.dispose()
        renderer.dispose()
        clearLoadedModel(api)
        disposeHullVisuals(hullVisuals)
        sceneRef.current = null
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement)
        }
      }
    }, [])

    useEffect(() => {
      const api = sceneRef.current
      if (!api) return

      useHullStore.getState().setSurfaceVoxels([])
      rebuildHullVisuals(api, planLength, planBeam, profileDepth, modelLengthAxis)
      refitLoadedModel(api)
      frameScene(api)
    }, [planLength, planBeam, profileDepth, modelLengthAxis, modelFitVersion])

    useEffect(() => {
      const api = sceneRef.current
      if (!api) return
      applyWrapperOffset(api)
    }, [modelAlignmentOffset, modelLengthAxis])

    useEffect(() => {
      const api = sceneRef.current
      if (!api) return
      updateVoxelPreview(
        api,
        surfaceVoxels,
        planBeam,
        planLength,
        profileDepth,
        modelLengthAxis,
      )
    }, [surfaceVoxels, planBeam, planLength, profileDepth, modelLengthAxis])

    useEffect(() => {
      if (!importFile) return

      const api = sceneRef.current
      if (!api) return

      let cancelled = false
      const url = URL.createObjectURL(importFile)

      onLoadStateChange?.('loading')

      loadGlbFromUrl(url)
        .then((model) => {
          URL.revokeObjectURL(url)
          if (cancelled || !sceneRef.current) return

          const lengthAxis = detectModelLengthAxis(model)
          const ratio = modelBeamToLengthRatio(model, lengthAxis)

          useHullStore.getState().resetModelAlignment()
          useHullStore.getState().setModelLengthAxis(lengthAxis)
          useHullStore.getState().setReferenceBeamToLengthRatio(ratio)

          mountLoadedModel(sceneRef.current, model)

          const state = useHullStore.getState()
          rebuildHullVisuals(
            sceneRef.current,
            state.plan.gridHeight,
            state.plan.gridWidth,
            state.profile.gridHeight,
            lengthAxis,
          )
          refitLoadedModel(sceneRef.current)
          frameScene(sceneRef.current)
          onLoadStateChange?.('loaded')
        })
        .catch((err: unknown) => {
          URL.revokeObjectURL(url)
          if (cancelled) return
          const message = err instanceof Error ? err.message : 'Kunde inte ladda modellen'
          onLoadStateChange?.('error', message)
        })

      return () => {
        cancelled = true
        URL.revokeObjectURL(url)
      }
    }, [importFile, onLoadStateChange])

    return (
      <div
        ref={containerRef}
        className={`h-full w-full overflow-hidden bg-surface-inset ${className}`}
        aria-label="3D-referensvy"
      />
    )
  },
)
