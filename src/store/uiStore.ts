import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WedgeLen, WedgeRotation } from '../lib/grid/blocks'
import { legacyUiToRotation, rotateWedge90CW } from '../lib/grid/blocks'
import { useHullStore } from './hullStore'

export type Theme = 'dark' | 'light'
export type EditorTool = 'cube' | 'wedge' | 'erase'
export type InspectorTab = 'properties' | 'continue'
export type DesignStep = 'plan' | 'profile'
export type AppMode = 'grid' | 'model3d'

interface UIState {
  theme: Theme
  appMode: AppMode
  tool: EditorTool
  designStep: DesignStep
  wedgeRotation: WedgeRotation
  wedgeFlip: boolean
  wedgeLen: WedgeLen
  symmetryPlan: boolean
  symmetryProfile: boolean
  showGridLines: boolean
  showMeterLines: boolean
  inspectorTab: InspectorTab
  setTheme: (theme: Theme) => void
  setAppMode: (mode: AppMode) => void
  setTool: (tool: EditorTool) => void
  setDesignStep: (step: DesignStep) => void
  setWedgeRotation: (rotation: WedgeRotation) => void
  setWedgeFlip: (flip: boolean) => void
  toggleWedgeFlip: () => void
  setWedgeLen: (len: WedgeLen) => void
  rotateWedge: () => void
  setSymmetry: (symmetry: boolean) => void
  setShowGridLines: (show: boolean) => void
  setShowMeterLines: (show: boolean) => void
  setInspectorTab: (tab: InspectorTab) => void
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function symmetryForStep(
  step: DesignStep,
  symmetryPlan: boolean,
  symmetryProfile: boolean,
): boolean {
  return step === 'plan' ? symmetryPlan : symmetryProfile
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      appMode: 'grid',
      tool: 'cube',
      designStep: 'plan',
      wedgeRotation: 0,
      wedgeFlip: false,
      wedgeLen: 1,
      symmetryPlan: true,
      symmetryProfile: false,
      showGridLines: true,
      showMeterLines: true,
      inspectorTab: 'properties',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
      setAppMode: (appMode) => set({ appMode }),
      setTool: (tool) => set({ tool }),
      setDesignStep: (designStep) => {
        if (designStep === 'profile') {
          useHullStore.getState().initProfileGridFromPlan()
        }
        set({ designStep, inspectorTab: 'properties' })
      },
      setWedgeRotation: (wedgeRotation) => set({ wedgeRotation }),
      setWedgeFlip: (wedgeFlip) => set({ wedgeFlip }),
      toggleWedgeFlip: () => {
        set({ wedgeFlip: !get().wedgeFlip })
        if (get().tool !== 'wedge') set({ tool: 'wedge' })
      },
      setWedgeLen: (wedgeLen) => set({ wedgeLen }),
      rotateWedge: () => {
        const { wedgeRotation } = get()
        set({ wedgeRotation: rotateWedge90CW(wedgeRotation) })
        if (get().tool !== 'wedge') set({ tool: 'wedge' })
      },
      setSymmetry: (symmetry) => {
        const { designStep } = get()
        if (designStep === 'plan') {
          set({ symmetryPlan: symmetry })
        } else {
          set({ symmetryProfile: symmetry })
        }
      },
      setShowGridLines: (showGridLines) => set({ showGridLines }),
      setShowMeterLines: (showMeterLines) => set({ showMeterLines }),
      setInspectorTab: (inspectorTab) => set({ inspectorTab }),
    }),
    {
      name: 'skrovbyggaren-ui',
      merge: (persistedState, currentState) => {
        if (!persistedState || typeof persistedState !== 'object') {
          return currentState
        }
        const persisted = persistedState as Partial<UIState> & {
          tool?: string
          wedgeDir?: string
          wedgeAxis?: string
          symmetry?: boolean
        }
        const merged = { ...currentState, ...persisted }
        if ((persisted.tool as string | undefined) === 'paint') {
          merged.tool = 'cube'
        }
        if (merged.wedgeRotation === undefined) {
          merged.wedgeRotation = legacyUiToRotation(
            persisted.wedgeDir as 'ne' | 'nw' | 'se' | 'sw' | undefined,
            persisted.wedgeAxis as 'e' | 'w' | 'n' | 's' | undefined,
            merged.wedgeLen ?? 1,
          )
        }
        if (persisted.symmetry !== undefined && merged.symmetryPlan === undefined) {
          merged.symmetryPlan = persisted.symmetry
        }
        if (merged.symmetryProfile === undefined) {
          merged.symmetryProfile = false
        }
        if (merged.symmetryPlan === undefined) {
          merged.symmetryPlan = true
        }
        if (merged.designStep === undefined) {
          merged.designStep = 'plan'
        }
        if (merged.appMode === undefined) {
          merged.appMode = 'grid'
        }
        return merged
      },
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)
