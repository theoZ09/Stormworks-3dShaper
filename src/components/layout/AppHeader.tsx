import type { AppMode } from '../../store/uiStore'
import { useUIStore } from '../../store/uiStore'

const STEP_LABELS = {
  plan: 'Plan',
  profile: 'Profile (side view)',
} as const

const MODES: { id: AppMode; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'model3d', label: '3D reference' },
]

export function AppHeader() {
  const appMode = useUIStore((s) => s.appMode)
  const setAppMode = useUIStore((s) => s.setAppMode)
  const designStep = useUIStore((s) => s.designStep)

  return (
    <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-surface-elevated px-4 py-2">
      <h1 className="text-lg font-semibold text-text">Hull Builder</h1>

      <nav
        className="flex rounded-sm border border-border-subtle p-0.5"
        aria-label="Build mode"
      >
        {MODES.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => setAppMode(mode.id)}
            className={`rounded-sm px-3 py-1 text-xs transition-colors ${
              appMode === mode.id
                ? 'bg-accent text-white'
                : 'text-text-muted hover:bg-surface-inset hover:text-text'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </nav>

      {appMode === 'grid' ? (
        <>
          <span className="rounded-sm border border-border-subtle bg-surface-inset px-2 py-0.5 text-xs text-text-muted">
            {STEP_LABELS[designStep]}
          </span>
          <p className="text-sm text-text-muted">Stormworks grid · 0.25 m/block</p>
        </>
      ) : (
        <p className="text-sm text-text-muted">Reference hull from 3D model</p>
      )}
    </header>
  )
}
