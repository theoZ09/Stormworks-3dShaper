import {
  WEDGE_LEN_LABELS,
  WEDGE_ROTATION_LABELS,
  wedgeDrawGeometry,
} from '../../lib/grid/blocks'
import type { WedgeLen, WedgeRotation } from '../../lib/grid/blocks'
import { beamParityLabel, formatMetersFromBlocks } from '../../lib/grid/stormworksDimensions'
import { useHullStore } from '../../store/hullStore'
import { symmetryForStep, useUIStore } from '../../store/uiStore'

const STEP_LABELS = {
  plan: 'Plan',
  profile: 'Profil',
} as const

function toolLabel(
  tool: string,
  wedgeRotation: WedgeRotation,
  wedgeFlip: boolean,
  wedgeLen: WedgeLen,
): string {
  if (tool === 'cube') return 'Kub'
  if (tool === 'wedge') {
    const { dir } = wedgeDrawGeometry(wedgeLen, wedgeRotation)
    const tri = { ne: '↗', nw: '↖', se: '↘', sw: '↙' }[dir]
    const flipLabel = wedgeFlip ? ' ⇄' : ''
    if (wedgeLen === 1) return `Wedge ${tri}${flipLabel}`
    const rot = WEDGE_ROTATION_LABELS[wedgeRotation]
    return `Wedge ${WEDGE_LEN_LABELS[wedgeLen]} · ${rot} ${tri}${flipLabel}`
  }
  return 'Radera'
}

export function StatusBar() {
  const designStep = useUIStore((s) => s.designStep)
  const tool = useUIStore((s) => s.tool)
  const wedgeRotation = useUIStore((s) => s.wedgeRotation)
  const wedgeFlip = useUIStore((s) => s.wedgeFlip)
  const wedgeLen = useUIStore((s) => s.wedgeLen)
  const symmetryPlan = useUIStore((s) => s.symmetryPlan)
  const symmetryProfile = useUIStore((s) => s.symmetryProfile)
  const symmetry = symmetryForStep(designStep, symmetryPlan, symmetryProfile)
  const planLength = useHullStore((s) => s.plan.gridHeight)
  const planBeam = useHullStore((s) => s.plan.gridWidth)
  const beamParity = useHullStore((s) => s.beamParity)

  return (
    <footer className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-surface-elevated px-3 py-1.5 text-[11px] text-text-muted">
      <span>
        Vy: <span className="text-text">{STEP_LABELS[designStep]}</span>
      </span>
      <span>
        Skrov:{' '}
        <span className="text-text">
          {planLength} × {planBeam} block ({beamParityLabel(beamParity)}) ·{' '}
          {formatMetersFromBlocks(planLength)}
        </span>
      </span>
      <span>
        Verktyg:{' '}
        <span className="text-text">{toolLabel(tool, wedgeRotation, wedgeFlip, wedgeLen)}</span>
      </span>
      <span>
        Symmetri: <span className="text-text">{symmetry ? 'På' : 'Av'}</span>
      </span>
      <span className="hidden sm:inline">
        1 Kub · 2 Wedge · 3 Radera · R Rotera · Ctrl+Z Ångra
      </span>
    </footer>
  )
}
