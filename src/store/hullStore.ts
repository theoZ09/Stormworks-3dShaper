import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type Block,
  type BlocksMap,
  anchorKeyAt,
  cloneBlocks,
  createCube,
  createWedge,
  footprintOverlapsExisting,
  keysForErase,
  migrateBlocksMap,
  migrateCellsToBlocks,
  symmetricWedgeAnchor,
  normalizeWedgeBlock,
  wedgeFlipOf,
  wedgeFootprint,
  wedgeRotationOf,
} from '../lib/grid/blocks'
import { cellKey, isInBounds, mirrorX } from '../lib/grid/coords'
import {
  type BeamParity,
  beamBlocksFromLength,
  clampGridDim,
  enforceParity,
  parityOf,
  syncLengthAcrossViews,
} from '../lib/grid/stormworksDimensions'
import type {
  FootprintMeters,
  ModelAlignmentOffset,
  ModelAlignmentRotation,
  ModelLengthAxis,
} from '../lib/model3d/hullAlignment'
import {
  profileDepthBlocksFromBaseFootprint,
  DEFAULT_MODEL_UP_AXIS,
  type ModelUpAxis,
  ZERO_ALIGNMENT_OFFSET,
  ZERO_ALIGNMENT_ROTATION,
} from '../lib/model3d/hullAlignment'
import { BLOCK_SIZE_M } from '../lib/grid/stormworksDimensions'
import type { StormworksVoxel } from '../lib/stormworks/exportXml'

export type HullView = 'plan' | 'profile'

const DEFAULT_WIDTH = 48
const DEFAULT_HEIGHT = 24
const DEFAULT_BEAM_TO_LENGTH_RATIO = DEFAULT_WIDTH / DEFAULT_HEIGHT
const MAX_HISTORY = 50

export interface ViewSlice {
  gridWidth: number
  gridHeight: number
  blocks: BlocksMap
  undoStack: BlocksMap[]
  redoStack: BlocksMap[]
}

function emptyViewSlice(): ViewSlice {
  return {
    gridWidth: DEFAULT_WIDTH,
    gridHeight: DEFAULT_HEIGHT,
    blocks: {},
    undoStack: [],
    redoStack: [],
  }
}

interface HullState {
  plan: ViewSlice
  profile: ViewSlice
  beamParity: BeamParity
  referenceBeamToLengthRatio: number
  modelLengthAxis: ModelLengthAxis
  modelUpAxis: ModelUpAxis
  modelAlignmentOffset: ModelAlignmentOffset
  autoModelAlignmentOffset: ModelAlignmentOffset
  modelAlignmentRotation: ModelAlignmentRotation
  autoModelAlignmentRotation: ModelAlignmentRotation
  baseFootprintM: FootprintMeters | null
  modelFitVersion: number
  modelDepthExceedsEnvelope: boolean
  surfaceVoxels: StormworksVoxel[]
  beginStroke: (view: HullView) => void
  beginDimensionStroke: () => void
  undo: (view: HullView) => void
  redo: (view: HullView) => void
  canUndo: (view: HullView) => boolean
  canRedo: (view: HullView) => boolean
  setGridSize: (view: HullView, width: number, height: number) => void
  setStormworksLength: (blocks: number) => void
  setReferenceBeamToLengthRatio: (ratio: number) => void
  setModelLengthAxis: (axis: ModelLengthAxis) => void
  setModelUpAxis: (axis: ModelUpAxis) => void
  setModelAlignmentOffset: (partial: Partial<ModelAlignmentOffset>) => void
  setModelAlignmentRotation: (partial: Partial<ModelAlignmentRotation>) => void
  resetModelAlignment: () => void
  setBaseFootprintM: (footprint: FootprintMeters | null) => void
  syncReferenceModelEnvelope: () => void
  applyAutoModelAlignment: (offset: ModelAlignmentOffset) => void
  clearReferenceModel: () => void
  setModelDepthExceedsEnvelope: (exceeds: boolean) => void
  setProfileDepthFromModel: (heightM: number) => boolean
  setSurfaceVoxels: (voxels: StormworksVoxel[]) => void
  setBeamParity: (parity: BeamParity) => void
  clearBlocks: (view: HullView) => void
  placeBlock: (
    view: HullView,
    x: number,
    y: number,
    block: Block,
    symmetry: boolean,
  ) => boolean
  eraseAt: (view: HullView, x: number, y: number, symmetry: boolean) => void
  canPlaceBlock: (
    view: HullView,
    x: number,
    y: number,
    block: Block,
    symmetry: boolean,
  ) => boolean
  filledCount: (view: HullView) => number
  initProfileGridFromPlan: () => void
}

function pushUndo(slice: ViewSlice): Partial<ViewSlice> {
  const undoStack = [...slice.undoStack, cloneBlocks(slice.blocks)].slice(-MAX_HISTORY)
  return { undoStack, redoStack: [] }
}

function placeCube(
  blocks: BlocksMap,
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): boolean {
  if (footprintOverlapsExisting(blocks, x, y, 1, 0, gridWidth, gridHeight)) {
    return false
  }
  blocks[cellKey(x, y)] = createCube()
  return true
}

function placeWedge(
  blocks: BlocksMap,
  anchorX: number,
  anchorY: number,
  block: Block,
  gridWidth: number,
  gridHeight: number,
): boolean {
  const len = block.len ?? 1
  const rotation = wedgeRotationOf(block)
  if (
    footprintOverlapsExisting(blocks, anchorX, anchorY, len, rotation, gridWidth, gridHeight)
  ) {
    return false
  }
  blocks[cellKey(anchorX, anchorY)] = createWedge(len, rotation, wedgeFlipOf(block))
  return true
}

function placeBlockOnGrid(
  blocks: BlocksMap,
  x: number,
  y: number,
  block: Block,
  symmetry: boolean,
  gridWidth: number,
  gridHeight: number,
): boolean {
  if (!isInBounds(x, y, gridWidth, gridHeight)) return false

  if (block.kind === 'cube') {
    if (!placeCube(blocks, x, y, gridWidth, gridHeight)) return false
    if (symmetry) {
      const mx = mirrorX(x, gridWidth)
      if (mx !== x && isInBounds(mx, y, gridWidth, gridHeight)) {
        if (!placeCube(blocks, mx, y, gridWidth, gridHeight)) {
          delete blocks[cellKey(x, y)]
          return false
        }
      }
    }
    return true
  }

  const len = block.len ?? 1
  if (!placeWedge(blocks, x, y, block, gridWidth, gridHeight)) return false

  if (symmetry) {
    const rotation = wedgeRotationOf(block)
    const m = symmetricWedgeAnchor(x, y, len, rotation, gridWidth, gridHeight)
    const fp = wedgeFootprint(m.x, m.y, len, rotation, gridWidth, gridHeight)
    if (fp.length !== len) {
      delete blocks[cellKey(x, y)]
      return false
    }
    const samePlacement = m.x === x && m.y === y
    if (!samePlacement && !placeWedge(blocks, m.x, m.y, block, gridWidth, gridHeight)) {
      delete blocks[cellKey(x, y)]
      return false
    }
  }

  return true
}

function canPlaceBlockOnGrid(
  blocks: BlocksMap,
  x: number,
  y: number,
  block: Block,
  symmetry: boolean,
  gridWidth: number,
  gridHeight: number,
): boolean {
  const trial = cloneBlocks(blocks)
  return placeBlockOnGrid(trial, x, y, block, symmetry, gridWidth, gridHeight)
}

function filterBlocksToGrid(blocks: BlocksMap, gridWidth: number, gridHeight: number): BlocksMap {
  const next: BlocksMap = {}
  for (const [key, block] of Object.entries(blocks)) {
    const [x, y] = key.split(',').map(Number)
    if (!isInBounds(x, y, gridWidth, gridHeight)) continue
    if (block.kind === 'wedge' && (block.len ?? 1) > 1) {
      const len = block.len!
      const rotation = wedgeRotationOf(block)
      const fp = wedgeFootprint(x, y, len, rotation, gridWidth, gridHeight)
      if (fp.length === len) next[key] = normalizeWedgeBlock(block)
    } else {
      next[key] = block.kind === 'wedge' ? normalizeWedgeBlock(block) : block
    }
  }
  return next
}

function getSlice(state: HullState, view: HullView): ViewSlice {
  return state[view]
}

function updateSlice(
  state: HullState,
  view: HullView,
  patch: Partial<ViewSlice>,
): HullState {
  return { ...state, [view]: { ...state[view], ...patch } }
}

export const useHullStore = create<HullState>()(
  persist(
    (set, get) => ({
      plan: emptyViewSlice(),
      profile: emptyViewSlice(),
      beamParity: 'even' as BeamParity,
      referenceBeamToLengthRatio: DEFAULT_BEAM_TO_LENGTH_RATIO,
      modelLengthAxis: 'z' as ModelLengthAxis,
      modelUpAxis: DEFAULT_MODEL_UP_AXIS,
      modelAlignmentOffset: { length: 0, beam: 0, up: 0 },
      autoModelAlignmentOffset: { length: 0, beam: 0, up: 0 },
      modelAlignmentRotation: { ...ZERO_ALIGNMENT_ROTATION },
      autoModelAlignmentRotation: { ...ZERO_ALIGNMENT_ROTATION },
      baseFootprintM: null,
      modelFitVersion: 0,
      modelDepthExceedsEnvelope: false,
      surfaceVoxels: [],

      beginStroke: (view) => {
        const slice = getSlice(get(), view)
        set(updateSlice(get(), view, pushUndo(slice)))
      },

      beginDimensionStroke: () => {
        const state = get()
        set({
          plan: { ...state.plan, ...pushUndo(state.plan) },
          profile: { ...state.profile, ...pushUndo(state.profile) },
        })
      },

      undo: (view) => {
        const state = get()
        const slice = getSlice(state, view)
        if (slice.undoStack.length === 0) return
        const prev = slice.undoStack[slice.undoStack.length - 1]!
        set(
          updateSlice(state, view, {
            blocks: prev,
            undoStack: slice.undoStack.slice(0, -1),
            redoStack: [...slice.redoStack, cloneBlocks(slice.blocks)],
          }),
        )
      },

      redo: (view) => {
        const state = get()
        const slice = getSlice(state, view)
        if (slice.redoStack.length === 0) return
        const next = slice.redoStack[slice.redoStack.length - 1]!
        set(
          updateSlice(state, view, {
            blocks: next,
            redoStack: slice.redoStack.slice(0, -1),
            undoStack: [...slice.undoStack, cloneBlocks(slice.blocks)],
          }),
        )
      },

      canUndo: (view) => getSlice(get(), view).undoStack.length > 0,
      canRedo: (view) => getSlice(get(), view).redoStack.length > 0,

      setGridSize: (view, width, height) => {
        const state = get()
        const { beamParity } = state
        const plan = state.plan
        const profile = state.profile

        if (view === 'plan') {
          const newH = clampGridDim(height)
          const lengthChanged = newH !== plan.gridHeight
          const widthChanged = clampGridDim(width) !== plan.gridWidth

          const newW = lengthChanged
            ? beamBlocksFromLength(newH, state.referenceBeamToLengthRatio, beamParity)
            : enforceParity(clampGridDim(width), beamParity)

          const newRatio =
            !lengthChanged && widthChanged && newH > 0 ? newW / newH : state.referenceBeamToLengthRatio

          const planPatch: Partial<ViewSlice> = {
            ...(widthChanged || lengthChanged ? pushUndo(plan) : {}),
            gridWidth: newW,
            gridHeight: newH,
            blocks: filterBlocksToGrid(plan.blocks, newW, newH),
          }

          let next: HullState = {
            ...state,
            referenceBeamToLengthRatio: newRatio,
            plan: { ...plan, ...planPatch },
          }

          if (lengthChanged) {
            let profileHeight = profile.gridHeight
            if (state.baseFootprintM && Object.keys(profile.blocks).length === 0) {
              profileHeight = clampGridDim(
                profileDepthBlocksFromBaseFootprint(state.baseFootprintM, newH),
              )
            }
            next = {
              ...next,
              profile: {
                ...profile,
                ...pushUndo(profile),
                gridWidth: newH,
                gridHeight: profileHeight,
                blocks: filterBlocksToGrid(profile.blocks, newH, profileHeight),
              },
            }
          }

          set(next)
          return
        }

        const newW = clampGridDim(width)
        const newH = clampGridDim(height)
        const lengthChanged = newW !== profile.gridWidth
        const depthChanged = newH !== profile.gridHeight

        const profilePatch: Partial<ViewSlice> = {
          ...(lengthChanged || depthChanged ? pushUndo(profile) : {}),
          gridWidth: newW,
          gridHeight: newH,
          blocks: filterBlocksToGrid(profile.blocks, newW, newH),
        }

        let next: HullState = { ...state, profile: { ...profile, ...profilePatch } }

        if (lengthChanged) {
          const planW = beamBlocksFromLength(newW, state.referenceBeamToLengthRatio, beamParity)
          next = {
            ...next,
            plan: {
              ...plan,
              ...pushUndo(plan),
              gridHeight: newW,
              gridWidth: planW,
              blocks: filterBlocksToGrid(plan.blocks, planW, newW),
            },
          }
        }

        set(next)
      },

      setStormworksLength: (blocks) => {
        const state = get()
        const { planHeight, profileWidth } = syncLengthAcrossViews(blocks)
        const newW = beamBlocksFromLength(
          planHeight,
          state.referenceBeamToLengthRatio,
          state.beamParity,
        )

        let profileHeight = state.profile.gridHeight
        if (state.baseFootprintM && Object.keys(state.profile.blocks).length === 0) {
          profileHeight = clampGridDim(
            profileDepthBlocksFromBaseFootprint(state.baseFootprintM, planHeight),
          )
        }

        if (
          planHeight === state.plan.gridHeight &&
          profileWidth === state.profile.gridWidth &&
          newW === state.plan.gridWidth &&
          profileHeight === state.profile.gridHeight
        ) {
          return
        }

        set({
          plan: {
            ...state.plan,
            gridHeight: planHeight,
            gridWidth: newW,
            blocks: filterBlocksToGrid(state.plan.blocks, newW, planHeight),
          },
          profile: {
            ...state.profile,
            gridWidth: profileWidth,
            gridHeight: profileHeight,
            blocks: filterBlocksToGrid(state.profile.blocks, profileWidth, profileHeight),
          },
        })
      },

      setReferenceBeamToLengthRatio: (ratio) => {
        const state = get()
        const clamped = Math.max(0.05, Math.min(8, ratio))
        const newW = beamBlocksFromLength(
          state.plan.gridHeight,
          clamped,
          state.beamParity,
        )
        if (clamped === state.referenceBeamToLengthRatio && newW === state.plan.gridWidth) return

        set({
          referenceBeamToLengthRatio: clamped,
          plan: {
            ...state.plan,
            gridWidth: newW,
            blocks: filterBlocksToGrid(state.plan.blocks, newW, state.plan.gridHeight),
          },
        })
      },

      setModelLengthAxis: (axis) => {
        if (get().modelLengthAxis === axis) return
        set({ modelLengthAxis: axis, modelFitVersion: get().modelFitVersion + 1 })
      },

      setModelUpAxis: (axis) => {
        if (get().modelUpAxis === axis) return
        set({ modelUpAxis: axis, modelFitVersion: get().modelFitVersion + 1 })
      },

      setModelAlignmentOffset: (partial) => {
        set({
          modelAlignmentOffset: { ...get().modelAlignmentOffset, ...partial },
        })
      },

      setModelAlignmentRotation: (partial) => {
        set({
          modelAlignmentRotation: { ...get().modelAlignmentRotation, ...partial },
        })
      },

      resetModelAlignment: () => {
        const auto = get().autoModelAlignmentOffset
        const autoRot = get().autoModelAlignmentRotation
        set({
          modelAlignmentOffset: { ...auto },
          modelAlignmentRotation: { ...autoRot },
          modelFitVersion: get().modelFitVersion + 1,
        })
      },

      setBaseFootprintM: (footprint) => {
        set({ baseFootprintM: footprint })
      },

      syncReferenceModelEnvelope: () => {
        const state = get()
        if (!state.baseFootprintM || Object.keys(state.profile.blocks).length > 0) return

        const lengthBlocks = state.plan.gridHeight
        const profileHeight = clampGridDim(
          profileDepthBlocksFromBaseFootprint(state.baseFootprintM, lengthBlocks),
        )
        const planBeam = beamBlocksFromLength(
          lengthBlocks,
          state.referenceBeamToLengthRatio,
          state.beamParity,
        )

        if (
          profileHeight === state.profile.gridHeight &&
          planBeam === state.plan.gridWidth &&
          lengthBlocks === state.profile.gridWidth
        ) {
          return
        }

        set({
          plan: {
            ...state.plan,
            gridWidth: planBeam,
            blocks: filterBlocksToGrid(state.plan.blocks, planBeam, lengthBlocks),
          },
          profile: {
            ...state.profile,
            gridWidth: lengthBlocks,
            gridHeight: profileHeight,
            blocks: filterBlocksToGrid(state.profile.blocks, lengthBlocks, profileHeight),
          },
        })
      },

      applyAutoModelAlignment: (offset) => {
        set({
          autoModelAlignmentOffset: { ...offset },
          modelAlignmentOffset: { ...offset },
        })
      },

      clearReferenceModel: () => {
        set({
          baseFootprintM: null,
          autoModelAlignmentOffset: { ...ZERO_ALIGNMENT_OFFSET },
          modelAlignmentOffset: { ...ZERO_ALIGNMENT_OFFSET },
          autoModelAlignmentRotation: { ...ZERO_ALIGNMENT_ROTATION },
          modelAlignmentRotation: { ...ZERO_ALIGNMENT_ROTATION },
          modelUpAxis: DEFAULT_MODEL_UP_AXIS,
          modelDepthExceedsEnvelope: false,
        })
      },

      setModelDepthExceedsEnvelope: (exceeds) => {
        if (get().modelDepthExceedsEnvelope === exceeds) return
        set({ modelDepthExceedsEnvelope: exceeds })
      },

      setProfileDepthFromModel: (heightM) => {
        const { profile, baseFootprintM } = get()
        if (Object.keys(profile.blocks).length > 0) return false
        if (baseFootprintM) return false
        const blocks = clampGridDim(Math.ceil(heightM / BLOCK_SIZE_M))
        if (blocks === profile.gridHeight) return true
        set({
          profile: {
            ...profile,
            gridHeight: blocks,
          },
        })
        return true
      },

      setSurfaceVoxels: (voxels) => {
        set({ surfaceVoxels: voxels })
      },

      setBeamParity: (parity) => {
        const state = get()
        const newW = beamBlocksFromLength(
          state.plan.gridHeight,
          state.referenceBeamToLengthRatio,
          parity,
        )
        if (parity === state.beamParity && newW === state.plan.gridWidth) return

        set({
          beamParity: parity,
          plan: {
            ...state.plan,
            gridWidth: newW,
            blocks: filterBlocksToGrid(state.plan.blocks, newW, state.plan.gridHeight),
          },
        })
      },

      clearBlocks: (view) => {
        const state = get()
        const slice = getSlice(state, view)
        set(updateSlice(state, view, { ...pushUndo(slice), blocks: {} }))
      },

      placeBlock: (view, x, y, block, symmetry) => {
        const slice = getSlice(get(), view)
        const blocks = cloneBlocks(slice.blocks)
        const ok = placeBlockOnGrid(
          blocks,
          x,
          y,
          block,
          symmetry,
          slice.gridWidth,
          slice.gridHeight,
        )
        if (!ok) return false
        set(updateSlice(get(), view, { blocks }))
        return true
      },

      eraseAt: (view, x, y, symmetry) => {
        const state = get()
        const slice = getSlice(state, view)
        const keys = keysForErase(slice.blocks, x, y, slice.gridWidth, slice.gridHeight)
        if (keys.length === 0) return

        const blocks = cloneBlocks(slice.blocks)
        for (const key of keys) delete blocks[key]

        if (symmetry) {
          const mx = mirrorX(x, slice.gridWidth)
          if (mx !== x) {
            const mKeys = keysForErase(blocks, mx, y, slice.gridWidth, slice.gridHeight)
            for (const key of mKeys) delete blocks[key]
          }
        }

        set(updateSlice(state, view, { blocks }))
      },

      canPlaceBlock: (view, x, y, block, symmetry) => {
        const slice = getSlice(get(), view)
        return canPlaceBlockOnGrid(
          slice.blocks,
          x,
          y,
          block,
          symmetry,
          slice.gridWidth,
          slice.gridHeight,
        )
      },

      filledCount: (view) => {
        const slice = getSlice(get(), view)
        let count = 0
        for (const key of Object.keys(slice.blocks)) {
          const [x, y] = key.split(',').map(Number)
          if (!isInBounds(x, y, slice.gridWidth, slice.gridHeight)) continue
          const block = slice.blocks[key]!
          if (block.kind === 'cube') count += 1
          else count += block.len ?? 1
        }
        return count
      },

      initProfileGridFromPlan: () => {
        const { plan, profile } = get()
        if (Object.keys(profile.blocks).length > 0) return
        set({
          profile: {
            ...profile,
            gridWidth: plan.gridHeight,
          },
        })
      },
    }),
    {
      name: 'hull-builder-hull',
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current
        const p = persisted as Record<string, unknown>

        if (p.plan && typeof p.plan === 'object') {
          const plan = p.plan as ViewSlice
          const planWidth = (plan.gridWidth as number) ?? DEFAULT_WIDTH
          const beamParity =
            typeof p.beamParity === 'string' && (p.beamParity === 'odd' || p.beamParity === 'even')
              ? (p.beamParity as BeamParity)
              : parityOf(planWidth)
          const referenceBeamToLengthRatio =
            typeof p.referenceBeamToLengthRatio === 'number' && p.referenceBeamToLengthRatio > 0
              ? (p.referenceBeamToLengthRatio as number)
              : planWidth / ((plan.gridHeight as number) || DEFAULT_HEIGHT)
          const modelLengthAxis =
            p.modelLengthAxis === 'x' || p.modelLengthAxis === 'z'
              ? (p.modelLengthAxis as ModelLengthAxis)
              : 'z'
          const modelUpAxis =
            p.modelUpAxis === '+y' ||
            p.modelUpAxis === '-y' ||
            p.modelUpAxis === '+x' ||
            p.modelUpAxis === '-x' ||
            p.modelUpAxis === '+z' ||
            p.modelUpAxis === '-z'
              ? (p.modelUpAxis as ModelUpAxis)
              : DEFAULT_MODEL_UP_AXIS
          const modelAlignmentOffset =
            p.modelAlignmentOffset &&
            typeof p.modelAlignmentOffset === 'object' &&
            typeof (p.modelAlignmentOffset as ModelAlignmentOffset).length === 'number'
              ? (p.modelAlignmentOffset as ModelAlignmentOffset)
              : { length: 0, beam: 0, up: 0 }
          const modelAlignmentRotation =
            p.modelAlignmentRotation &&
            typeof p.modelAlignmentRotation === 'object' &&
            typeof (p.modelAlignmentRotation as ModelAlignmentRotation).x === 'number'
              ? (p.modelAlignmentRotation as ModelAlignmentRotation)
              : { ...ZERO_ALIGNMENT_ROTATION }
          return {
            ...current,
            beamParity,
            referenceBeamToLengthRatio,
            modelLengthAxis,
            modelUpAxis,
            modelAlignmentOffset,
            modelAlignmentRotation,
            modelFitVersion: 0,
            modelDepthExceedsEnvelope: false,
            plan: {
              ...emptyViewSlice(),
              ...plan,
              blocks: migrateBlocksMap(plan.blocks ?? {}),
              undoStack: [],
              redoStack: [],
            },
            profile: {
              ...emptyViewSlice(),
              ...(typeof p.profile === 'object' ? (p.profile as ViewSlice) : {}),
              blocks: migrateBlocksMap(
                (typeof p.profile === 'object' ? (p.profile as ViewSlice).blocks : {}) ?? {},
              ),
              undoStack: [],
              redoStack: [],
            },
          }
        }

        let blocks: BlocksMap = {}
        if (p.blocks && typeof p.blocks === 'object') {
          blocks = migrateBlocksMap(p.blocks as BlocksMap)
        } else if (Array.isArray(p.cells)) {
          blocks = migrateCellsToBlocks(p.cells as string[])
        }

        return {
          ...current,
          plan: {
            gridWidth: (p.gridWidth as number) ?? DEFAULT_WIDTH,
            gridHeight: (p.gridHeight as number) ?? DEFAULT_HEIGHT,
            blocks,
            undoStack: [],
            redoStack: [],
          },
          profile: emptyViewSlice(),
        }
      },
      partialize: (state) => ({
        beamParity: state.beamParity,
        referenceBeamToLengthRatio: state.referenceBeamToLengthRatio,
        modelLengthAxis: state.modelLengthAxis,
        modelUpAxis: state.modelUpAxis,
        modelAlignmentOffset: state.modelAlignmentOffset,
        modelAlignmentRotation: state.modelAlignmentRotation,
        plan: {
          gridWidth: state.plan.gridWidth,
          gridHeight: state.plan.gridHeight,
          blocks: state.plan.blocks,
        },
        profile: {
          gridWidth: state.profile.gridWidth,
          gridHeight: state.profile.gridHeight,
          blocks: state.profile.blocks,
        },
      }),
    },
  ),
)

export { anchorKeyAt }
