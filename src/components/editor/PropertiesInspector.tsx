import {
  WEDGE_LENS,
  WEDGE_LEN_LABELS,
  WEDGE_ROTATIONS,
  WEDGE_ROTATION_LABELS,
  wedgeDrawGeometry,
} from '../../lib/grid/blocks'
import { GridDimensionInput } from '../grid/GridDimensionInput'
import { useHullStore, type HullView } from '../../store/hullStore'
import { symmetryForStep, useUIStore } from '../../store/uiStore'

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="toggle-row cursor-pointer">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-4 w-8 shrink-0 border ${
          checked ? 'border-accent bg-accent/25' : 'border-border-subtle bg-surface-inset'
        }`}
      >
        <span
          className={`absolute top-px h-2.5 w-2.5 ${
            checked ? 'left-[calc(100%-11px)] bg-accent' : 'left-px bg-text-muted'
          }`}
        />
      </button>
    </label>
  )
}

export function PropertiesInspector() {
  const designStep = useUIStore((s) => s.designStep)
  const view = designStep as HullView

  const gridWidth = useHullStore((s) => s[view].gridWidth)
  const gridHeight = useHullStore((s) => s[view].gridHeight)
  const filledCount = useHullStore((s) => s.filledCount(view))
  const setGridSizeRaw = useHullStore((s) => s.setGridSize)
  const clearBlocksRaw = useHullStore((s) => s.clearBlocks)
  const beginStrokeRaw = useHullStore((s) => s.beginStroke)
  const beginDimensionStroke = useHullStore((s) => s.beginDimensionStroke)

  const setGridSize = (w: number, h: number) => setGridSizeRaw(view, w, h)
  const clearBlocks = () => clearBlocksRaw(view)
  const beginStroke = () => beginStrokeRaw(view)

  const widthLabel = designStep === 'plan' ? 'Bredd' : 'Längd'
  const heightLabel = designStep === 'plan' ? 'Längd' : 'Djup'

  const theme = useUIStore((s) => s.theme)
  const tool = useUIStore((s) => s.tool)
  const wedgeRotation = useUIStore((s) => s.wedgeRotation)
  const wedgeFlip = useUIStore((s) => s.wedgeFlip)
  const wedgeLen = useUIStore((s) => s.wedgeLen)
  const symmetryPlan = useUIStore((s) => s.symmetryPlan)
  const symmetryProfile = useUIStore((s) => s.symmetryProfile)
  const symmetry = symmetryForStep(designStep, symmetryPlan, symmetryProfile)
  const showGridLines = useUIStore((s) => s.showGridLines)
  const showMeterLines = useUIStore((s) => s.showMeterLines)
  const setTheme = useUIStore((s) => s.setTheme)
  const setTool = useUIStore((s) => s.setTool)
  const setWedgeRotation = useUIStore((s) => s.setWedgeRotation)
  const toggleWedgeFlip = useUIStore((s) => s.toggleWedgeFlip)
  const setWedgeLen = useUIStore((s) => s.setWedgeLen)
  const rotateWedge = useUIStore((s) => s.rotateWedge)
  const setSymmetry = useUIStore((s) => s.setSymmetry)
  const setShowGridLines = useUIStore((s) => s.setShowGridLines)
  const setShowMeterLines = useUIStore((s) => s.setShowMeterLines)

  return (
    <div className="flex flex-col gap-4 p-3 text-xs">
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Rutnät
        </p>
        <div className="flex items-center gap-2">
          <label className="text-text-muted">{widthLabel}</label>
          <GridDimensionInput
            value={gridWidth}
            onCommit={(w) => {
              if (designStep === 'profile') {
                beginDimensionStroke()
              } else {
                beginStroke()
              }
              setGridSize(w, gridHeight)
            }}
          />
          <span className="text-text-muted">×</span>
          <label className="text-text-muted">{heightLabel}</label>
          <GridDimensionInput
            value={gridHeight}
            onCommit={(h) => {
              if (designStep === 'plan') {
                beginDimensionStroke()
              } else {
                beginStroke()
              }
              setGridSize(gridWidth, h)
            }}
          />
        </div>
        <p className="mt-2 text-text-muted">Fyllda celler: {filledCount}</p>
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Inställningar
        </p>
        <Toggle
          label="Mörkt tema"
          checked={theme === 'dark'}
          onChange={(on) => setTheme(on ? 'dark' : 'light')}
        />
        <Toggle label="Symmetri" checked={symmetry} onChange={setSymmetry} />
        <Toggle label="Rutnätslinjer" checked={showGridLines} onChange={setShowGridLines} />
        <Toggle label="Meterlinjer" checked={showMeterLines} onChange={setShowMeterLines} />
      </section>

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Wedge
        </p>
        <p className="mb-1 text-[10px] text-text-muted">Längd</p>
        <div className="grid grid-cols-3 gap-1">
          {WEDGE_LENS.map((len) => (
            <button
              key={len}
              type="button"
              onClick={() => {
                setWedgeLen(len)
                if (tool !== 'wedge') setTool('wedge')
              }}
              className={`rounded-sm border px-2 py-1 text-center text-xs transition-colors ${
                wedgeLen === len
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-subtle text-text-muted hover:border-border hover:text-text'
              }`}
            >
              {WEDGE_LEN_LABELS[len]}
            </button>
          ))}
        </div>
        <p className="mb-1 mt-2 text-[10px] text-text-muted">Rotation</p>
        <div className="flex items-center gap-1">
          {WEDGE_ROTATIONS.map((rot) => {
            const { dir } = wedgeDrawGeometry(wedgeLen, rot)
            const icon =
              wedgeLen === 1
                ? { ne: '↗', nw: '↖', se: '↘', sw: '↙' }[dir]
                : WEDGE_ROTATION_LABELS[rot]
            return (
            <button
              key={rot}
              type="button"
              title={`Rotation ${rot + 1}/4`}
              onClick={() => {
                setWedgeRotation(rot)
                if (tool !== 'wedge') setTool('wedge')
              }}
              className={`flex-1 rounded-sm border px-1 py-1 text-center text-sm transition-colors ${
                wedgeRotation === rot
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border-subtle text-text-muted hover:border-border hover:text-text'
              }`}
            >
              {icon}
            </button>
            )
          })}
        </div>
        <button
          type="button"
          onClick={rotateWedge}
          className="mt-2 w-full rounded-sm border border-border-subtle px-2 py-1.5 text-xs text-text-muted transition-colors hover:border-border hover:text-text"
        >
          ↻ Rotera (R) — {wedgeRotation + 1}/4
        </button>
        <button
          type="button"
          onClick={toggleWedgeFlip}
          className={`mt-1 w-full rounded-sm border px-2 py-1.5 text-xs transition-colors ${
            wedgeFlip
              ? 'border-accent bg-accent/15 text-accent'
              : 'border-border-subtle text-text-muted hover:border-border hover:text-text'
          }`}
        >
          ⇄ Spegla triangel — {wedgeFlip ? 'på' : 'av'}
        </button>
      </section>

      <section>
        <button
          type="button"
          onClick={() => {
            beginStroke()
            clearBlocks()
          }}
          className="w-full rounded-sm border border-border-subtle px-2 py-1.5 text-xs text-text-muted transition-colors hover:border-red-400 hover:text-red-500"
        >
          Rensa rutnät
        </button>
      </section>
    </div>
  )
}
