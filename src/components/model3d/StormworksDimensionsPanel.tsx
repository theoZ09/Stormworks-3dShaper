import { useState } from 'react'
import { BLOCK_SIZE_M, beamParityLabel, formatMetersFromBlocks } from '../../lib/grid/stormworksDimensions'
import type { ModelAlignmentOffset } from '../../lib/model3d/hullAlignment'
import { downloadVehicleXml, type StormworksVoxel } from '../../lib/stormworks/exportXml'
import { GridDimensionInput } from '../grid/GridDimensionInput'
import { useHullStore } from '../../store/hullStore'

const OFFSET_STEP = BLOCK_SIZE_M

function BeamParityOption({
  parity,
  current,
  label,
  onSelect,
}: {
  parity: 'odd' | 'even'
  current: 'odd' | 'even'
  label: string
  onSelect: (parity: 'odd' | 'even') => void
}) {
  const active = current === parity
  return (
    <button
      type="button"
      onClick={() => onSelect(parity)}
      className={`flex-1 rounded-sm border px-2 py-1.5 text-center text-xs transition-colors ${
        active
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-border-subtle text-text-muted hover:border-border hover:text-text'
      }`}
    >
      {label}
    </button>
  )
}

function OffsetControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (next: number) => void
}) {
  const format = (n: number) => (n % 1 === 0 ? `${n}` : n.toFixed(2))

  return (
    <div className="flex items-center gap-1">
      <span className="w-14 shrink-0 text-[10px] text-text-muted">{label}</span>
      <button
        type="button"
        onClick={() => onChange(value - OFFSET_STEP)}
        className="w-7 rounded-sm border border-border-subtle px-1 py-0.5 text-xs text-text-muted hover:border-border hover:text-text"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <span className="w-12 text-center text-[10px] text-text">{format(value)} m</span>
      <button
        type="button"
        onClick={() => onChange(value + OFFSET_STEP)}
        className="w-7 rounded-sm border border-border-subtle px-1 py-0.5 text-xs text-text-muted hover:border-border hover:text-text"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  )
}

interface StormworksDimensionsPanelProps {
  hasModel?: boolean
  onExportXml?: () => StormworksVoxel[] | null
}

export function StormworksDimensionsPanel({
  hasModel = false,
  onExportXml,
}: StormworksDimensionsPanelProps) {
  const planGridWidth = useHullStore((s) => s.plan.gridWidth)
  const planGridHeight = useHullStore((s) => s.plan.gridHeight)
  const beamParity = useHullStore((s) => s.beamParity)
  const modelAlignmentOffset = useHullStore((s) => s.modelAlignmentOffset)
  const modelDepthExceedsEnvelope = useHullStore((s) => s.modelDepthExceedsEnvelope)
  const profileHasBlocks = useHullStore((s) => Object.keys(s.profile.blocks).length > 0)
  const setStormworksLength = useHullStore((s) => s.setStormworksLength)
  const setBeamParity = useHullStore((s) => s.setBeamParity)
  const setModelAlignmentOffset = useHullStore((s) => s.setModelAlignmentOffset)
  const resetModelAlignment = useHullStore((s) => s.resetModelAlignment)
  const beginStroke = useHullStore((s) => s.beginStroke)
  const beginDimensionStroke = useHullStore((s) => s.beginDimensionStroke)
  const setSurfaceVoxels = useHullStore((s) => s.setSurfaceVoxels)
  const surfaceVoxels = useHullStore((s) => s.surfaceVoxels)
  const [exportError, setExportError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)

  const patchOffset = (partial: Partial<ModelAlignmentOffset>) => {
    setModelAlignmentOffset(partial)
    setSurfaceVoxels([])
    setExportError(null)
  }

  const handlePreview = () => {
    if (!onExportXml) return
    setExportError(null)
    setPreviewing(true)
    try {
      const voxels = onExportXml()
      if (!voxels || voxels.length === 0) {
        setExportError('No surface voxels found. Adjust model or dimensions.')
        setSurfaceVoxels([])
        return
      }
      setSurfaceVoxels(voxels)
    } finally {
      setPreviewing(false)
    }
  }

  const handleDownload = () => {
    if (surfaceVoxels.length === 0) return
    downloadVehicleXml(surfaceVoxels)
  }

  return (
    <>
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Stormworks dimensions
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <label className="w-12 shrink-0 text-text-muted">Length</label>
            <GridDimensionInput
              value={planGridHeight}
              onCommit={(length) => {
                beginDimensionStroke()
                setStormworksLength(length)
                setSurfaceVoxels([])
                setExportError(null)
              }}
            />
            <span className="text-text-muted">block</span>
          </div>
          <p className="text-[10px] text-text-muted">
            {planGridHeight} block = {formatMetersFromBlocks(planGridHeight)}
          </p>

          <p className="text-[10px] text-text">
            Beam: {planGridWidth} blocks ({beamParityLabel(beamParity)})
          </p>
          <p className="text-[10px] leading-snug text-text-muted">
            Beam is calculated from length and reference model proportions.
          </p>
          <p className="text-[10px] text-text-muted">
            Model and grid scale to Stormworks length (0.25 m/block).
          </p>

          <p className="mt-1 text-[10px] text-text-muted">Symmetry</p>
          <div className="flex gap-1">
            <BeamParityOption
              parity="odd"
              current={beamParity}
              label="Odd"
              onSelect={(parity) => {
                beginStroke('plan')
                setBeamParity(parity)
                setSurfaceVoxels([])
                setExportError(null)
              }}
            />
            <BeamParityOption
              parity="even"
              current={beamParity}
              label="Even"
              onSelect={(parity) => {
                beginStroke('plan')
                setBeamParity(parity)
                setSurfaceVoxels([])
                setExportError(null)
              }}
            />
          </div>
          <p className="text-[10px] leading-snug text-text-muted">
            Odd = block on centerline. Even = symmetry between two center blocks.
          </p>
        </div>
      </section>

      {hasModel && (
        <section className="border-t border-border-subtle pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Model alignment
          </p>
          <p className="mb-2 text-[10px] leading-snug text-text-muted">
            Auto-placement after import. Fine-tune if the model was not centered correctly.
          </p>
          <div className="flex flex-col gap-1.5">
            <OffsetControl
              label="Fore/aft"
              value={modelAlignmentOffset.length}
              onChange={(length) => patchOffset({ length })}
            />
            <OffsetControl
              label="Beam"
              value={modelAlignmentOffset.beam}
              onChange={(beam) => patchOffset({ beam })}
            />
            <OffsetControl
              label="Up"
              value={modelAlignmentOffset.up}
              onChange={(up) => patchOffset({ up })}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              resetModelAlignment()
              setSurfaceVoxels([])
              setExportError(null)
            }}
            className="mt-3 w-full rounded-sm border border-border-subtle px-2 py-1.5 text-xs text-text-muted transition-colors hover:border-border hover:text-text"
          >
            Reset auto-fit
          </button>
          {modelDepthExceedsEnvelope && profileHasBlocks && (
            <p className="mt-2 text-[10px] text-amber-600" role="status">
              Model is taller than the profile grid. Increase depth in profile view or reset profile.
            </p>
          )}
        </section>
      )}

      {hasModel && onExportXml && (
        <section className="border-t border-border-subtle pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
            Stormworks-export
          </p>
          <p className="mb-2 text-[10px] leading-snug text-text-muted">
            Preview surface voxels (0.25 m cubes) in the 3D view before downloading XML. Full
            hull — both sides.
          </p>
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing}
            className="w-full rounded-sm border border-accent bg-accent/10 px-2 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:cursor-wait disabled:opacity-60"
          >
            {previewing ? 'Voxelizing…' : 'Preview'}
          </button>
          {surfaceVoxels.length > 0 && (
            <>
              <p className="mt-2 text-[10px] text-text-muted" role="status">
                {surfaceVoxels.length} surface voxels shown in the 3D view. Confirm it looks correct.
              </p>
              <button
                type="button"
                onClick={handleDownload}
                className="mt-2 w-full rounded-sm bg-accent px-2 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                Download XML
              </button>
            </>
          )}
          {exportError && (
            <p className="mt-2 text-[10px] text-red-500" role="alert">
              {exportError}
            </p>
          )}
        </section>
      )}
    </>
  )
}
