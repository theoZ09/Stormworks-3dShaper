import type { DesignStep } from '../../store/uiStore'
import { useUIStore } from '../../store/uiStore'

const CONTINUE_OPTIONS: {
  id: DesignStep
  label: string
  desc: string
  available: boolean
}[] = [
  {
    id: 'plan',
    label: 'Plan',
    desc: 'Draw hull shape from above',
    available: true,
  },
  {
    id: 'profile',
    label: 'Profile',
    desc: 'Side view — length and depth',
    available: true,
  },
]

export function ContinuePanel() {
  const designStep = useUIStore((s) => s.designStep)
  const setDesignStep = useUIStore((s) => s.setDesignStep)

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-xs text-text-muted">
        Choose a view in the hull builder. Plan and profile each have their own drawing.
      </p>
      {CONTINUE_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          disabled={!opt.available}
          onClick={() => setDesignStep(opt.id)}
          className={`continue-option ${designStep === opt.id ? 'continue-option-active' : ''} ${
            !opt.available ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-text">{opt.label}</span>
            {designStep === opt.id && (
              <span className="text-[9px] uppercase tracking-wide text-accent">Active</span>
            )}
          </span>
          <span className="mt-0.5 block text-[10px] text-text-muted">{opt.desc}</span>
        </button>
      ))}
    </div>
  )
}
