import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createCube,
  createWedge,
  rotateWedgeFootprint,
  wedgeFlipOf,
  wedgeRotationOf,
} from '../../lib/grid/blocks'
import type { Block } from '../../lib/grid/blocks'
import {
  drawGrid,
  getGridColorsFromCss,
  type PlacementPreview,
} from '../../lib/grid/draw'
import { planKeelLengthExtent } from '../../lib/grid/planReference'
import { useHullStore, type HullView } from '../../store/hullStore'
import { symmetryForStep, useUIStore } from '../../store/uiStore'

const BASE_CELL_PX = 20
const MIN_SCALE = 0.4
const MAX_SCALE = 3

const AXIS_LABELS: Record<HullView, { length: string; breadth: string }> = {
  plan: { length: 'Length', breadth: 'Beam' },
  profile: { length: 'Length', breadth: 'Depth' },
}

export function HullGridCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const designStep = useUIStore((s) => s.designStep)
  const view = designStep as HullView

  const gridWidth = useHullStore((s) => s[view].gridWidth)
  const gridHeight = useHullStore((s) => s[view].gridHeight)
  const blocks = useHullStore((s) => s[view].blocks)
  const planBlocks = useHullStore((s) => s.plan.blocks)
  const planGridWidth = useHullStore((s) => s.plan.gridWidth)
  const planGridHeight = useHullStore((s) => s.plan.gridHeight)
  const beginStrokeRaw = useHullStore((s) => s.beginStroke)
  const placeBlockRaw = useHullStore((s) => s.placeBlock)
  const eraseAtRaw = useHullStore((s) => s.eraseAt)
  const canPlaceBlockRaw = useHullStore((s) => s.canPlaceBlock)
  const undoRaw = useHullStore((s) => s.undo)
  const redoRaw = useHullStore((s) => s.redo)

  const beginStroke = useCallback(() => beginStrokeRaw(view), [beginStrokeRaw, view])
  const placeBlock = useCallback(
    (x: number, y: number, block: Block, symmetry: boolean) =>
      placeBlockRaw(view, x, y, block, symmetry),
    [placeBlockRaw, view],
  )
  const eraseAt = useCallback(
    (x: number, y: number, symmetry: boolean) => eraseAtRaw(view, x, y, symmetry),
    [eraseAtRaw, view],
  )
  const canPlaceBlock = useCallback(
    (x: number, y: number, block: Block, symmetry: boolean) =>
      canPlaceBlockRaw(view, x, y, block, symmetry),
    [canPlaceBlockRaw, view],
  )
  const undo = useCallback(() => undoRaw(view), [undoRaw, view])
  const redo = useCallback(() => redoRaw(view), [redoRaw, view])

  const tool = useUIStore((s) => s.tool)
  const wedgeRotation = useUIStore((s) => s.wedgeRotation)
  const wedgeFlip = useUIStore((s) => s.wedgeFlip)
  const wedgeLen = useUIStore((s) => s.wedgeLen)
  const symmetryPlan = useUIStore((s) => s.symmetryPlan)
  const symmetryProfile = useUIStore((s) => s.symmetryProfile)
  const symmetry = symmetryForStep(designStep, symmetryPlan, symmetryProfile)
  const showGridLines = useUIStore((s) => s.showGridLines)
  const showMeterLines = useUIStore((s) => s.showMeterLines)
  const theme = useUIStore((s) => s.theme)
  const setTool = useUIStore((s) => s.setTool)
  const rotateWedge = useUIStore((s) => s.rotateWedge)

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 40, y: 40 })
  const [preview, setPreview] = useState<PlacementPreview | null>(null)
  const [spaceHeld, setSpaceHeld] = useState(false)

  const paintingRef = useRef(false)
  const strokeStartedRef = useRef(false)
  const panningRef = useRef(false)
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 })
  const wedgePlacingRef = useRef(false)
  const previewRef = useRef(preview)
  previewRef.current = preview

  const cellPx = BASE_CELL_PX * scale

  const keelLengthExtent = useMemo(() => {
    if (view !== 'profile') return null
    return planKeelLengthExtent(planBlocks, planGridWidth, planGridHeight)
  }, [view, planBlocks, planGridWidth, planGridHeight])

  const blockForTool = useCallback((): Block | null => {
    if (tool === 'cube') return createCube()
    if (tool === 'wedge') return createWedge(wedgeLen, wedgeRotation, wedgeFlip)
    return null
  }, [tool, wedgeLen, wedgeRotation, wedgeFlip])

  const centerGrid = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const gridPixelW = gridWidth * BASE_CELL_PX * scale
    const gridPixelH = gridHeight * BASE_CELL_PX * scale
    setOffset({
      x: Math.max(20, (container.clientWidth - gridPixelW) / 2),
      y: Math.max(20, (container.clientHeight - gridPixelH) / 2 - 10),
    })
  }, [gridWidth, gridHeight, scale])

  useEffect(() => {
    centerGrid()
  }, [gridWidth, gridHeight, centerGrid])

  useEffect(() => {
    setPreview(null)
    centerGrid()
  }, [designStep, centerGrid])

  const gridCellAt = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const px = clientX - rect.left - offset.x
      const py = clientY - rect.top - offset.y
      const x = Math.floor(px / cellPx)
      const y = Math.floor(py / cellPx)
      if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return null
      return { x, y }
    },
    [offset, cellPx, gridWidth, gridHeight],
  )

  useEffect(() => {
    setPreview((p) => {
      if (!p) return null
      const block = blockForTool()
      if (!block) return null

      if (block.kind === 'wedge' && (block.len ?? 1) > 1) {
        const len = block.len ?? 1
        let rot = wedgeRotationOf(p.block)
        let ax = p.x
        let ay = p.y
        while (rot !== wedgeRotation) {
          const step = rotateWedgeFootprint(ax, ay, len, rot, gridWidth, gridHeight)
          ax = step.x
          ay = step.y
          rot = step.rotation
        }
        const newBlock = createWedge(len, rot, wedgeFlipOf(p.block))
        const valid = canPlaceBlock(ax, ay, newBlock, symmetry)
        return { x: ax, y: ay, block: newBlock, valid }
      }

      const valid = canPlaceBlock(p.x, p.y, block, symmetry)
      return { x: p.x, y: p.y, block, valid }
    })
  }, [
    wedgeRotation,
    wedgeFlip,
    wedgeLen,
    tool,
    symmetry,
    designStep,
    blockForTool,
    canPlaceBlock,
    gridWidth,
    gridHeight,
  ])

  const paintAt = useCallback(
    (x: number, y: number) => {
      if (tool === 'erase') {
        eraseAt(x, y, symmetry)
        return
      }
      const block = blockForTool()
      if (!block) return
      placeBlock(x, y, block, symmetry)
    },
    [tool, symmetry, blockForTool, placeBlock, eraseAt],
  )

  const render = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const dpr = window.devicePixelRatio || 1
    const w = container.clientWidth
    const h = container.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)

    drawGrid({
      ctx,
      gridWidth,
      gridHeight,
      cellPx,
      offsetX: offset.x,
      offsetY: offset.y,
      blocks,
      showGridLines,
      showMeterLines,
      symmetry,
      colors: getGridColorsFromCss(),
      preview,
      lengthLabel: AXIS_LABELS[view].length,
      breadthLabel: AXIS_LABELS[view].breadth,
      keelLengthExtent,
    })
  }, [
    gridWidth,
    gridHeight,
    cellPx,
    offset,
    blocks,
    showGridLines,
    showMeterLines,
    symmetry,
    preview,
    view,
    keelLengthExtent,
  ])

  useEffect(() => {
    render()
  }, [render, theme])

  useEffect(() => {
    const onResize = () => render()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [render])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      if (e.code === 'Space') {
        e.preventDefault()
        setSpaceHeld(true)
      }
      if (e.key === '1') setTool('cube')
      if (e.key === '2') setTool('wedge')
      if (e.key === '3') setTool('erase')
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault()
        rotateWedge()
      }
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault()
        undo()
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault()
        redo()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [setTool, rotateWedge, undo, redo])

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s + delta)))
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      panningRef.current = true
      panStartRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
      return
    }

    if (e.button === 2) {
      e.preventDefault()
      const cell = gridCellAt(e.clientX, e.clientY)
      if (!cell) return
      if (!strokeStartedRef.current) {
        beginStroke()
        strokeStartedRef.current = true
      }
      eraseAt(cell.x, cell.y, symmetry)
      paintingRef.current = true
      return
    }

    if (e.button !== 0) return

    const cell = gridCellAt(e.clientX, e.clientY)
    if (!cell) return

    if (tool === 'wedge') {
      wedgePlacingRef.current = true
      const block = blockForTool()
      if (!block) return
      const valid = canPlaceBlock(cell.x, cell.y, block, symmetry)
      setPreview({ x: cell.x, y: cell.y, block, valid })
      return
    }

    beginStroke()
    strokeStartedRef.current = true
    paintingRef.current = true
    paintAt(cell.x, cell.y)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (panningRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      setOffset({
        x: panStartRef.current.ox + dx,
        y: panStartRef.current.oy + dy,
      })
      return
    }

    const cell = gridCellAt(e.clientX, e.clientY)

    if (wedgePlacingRef.current && cell) {
      const block = blockForTool()
      if (block) {
        const valid = canPlaceBlock(cell.x, cell.y, block, symmetry)
        setPreview({ x: cell.x, y: cell.y, block, valid })
      }
      return
    }

    if (!paintingRef.current || !cell) return
    paintAt(cell.x, cell.y)
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (panningRef.current) {
      panningRef.current = false
      return
    }

    if (wedgePlacingRef.current && e.button === 0) {
      wedgePlacingRef.current = false
      const p = previewRef.current
      if (p?.valid) {
        beginStroke()
        placeBlock(p.x, p.y, p.block, symmetry)
      }
      setPreview(null)
      return
    }

    paintingRef.current = false
    strokeStartedRef.current = false
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-0 flex-1 overflow-hidden bg-surface-inset"
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 h-full w-full ${
          spaceHeld || panningRef.current ? 'cursor-grab' : 'cursor-crosshair'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="absolute bottom-3 right-3 flex gap-1">
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.2))}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle bg-surface-elevated text-sm text-text-muted hover:border-border hover:text-text"
        >
          −
        </button>
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.2))}
          className="flex h-8 w-8 items-center justify-center rounded-sm border border-border-subtle bg-surface-elevated text-sm text-text-muted hover:border-border hover:text-text"
        >
          +
        </button>
        <button
          type="button"
          aria-label="Center grid"
          onClick={centerGrid}
          className="flex h-8 items-center justify-center rounded-sm border border-border-subtle bg-surface-elevated px-2 text-xs text-text-muted hover:border-border hover:text-text"
        >
          Center
        </button>
      </div>
    </div>
  )
}
