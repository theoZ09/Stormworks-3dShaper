import type { Block, WedgeAxis, WedgeDir } from './blocks'
import {
  symmetricWedgeAnchor,
  wedgeDrawGeometry,
  wedgeFlipOf,
  wedgeRotationOf,
} from './blocks'
import { keelLengthMeters, type KeelLengthExtent } from './planReference'
import { mirrorX } from './coords'

export interface GridColors {
  background: string
  line: string
  meterLine: string
  cellFill: string
  cellStroke: string
  wedgeFill: string
  wedgeStroke: string
  wedgePreviewFill: string
  wedgePreviewStroke: string
  invalidPreviewFill: string
  invalidPreviewStroke: string
  symmetryLine: string
  referenceLine: string
  axisLabel: string
}

export interface PlacementPreview {
  x: number
  y: number
  block: Block
  valid: boolean
}

export interface DrawGridOptions {
  ctx: CanvasRenderingContext2D
  gridWidth: number
  gridHeight: number
  cellPx: number
  offsetX: number
  offsetY: number
  blocks: Record<string, Block>
  showGridLines: boolean
  showMeterLines: boolean
  symmetry: boolean
  colors: GridColors
  preview?: PlacementPreview | null
  lengthLabel?: string
  breadthLabel?: string
  /** Plan keel length span — drawn as horizontal reference in profile view. */
  keelLengthExtent?: KeelLengthExtent | null
}

function wedgeBBox(
  anchorX: number,
  anchorY: number,
  cellPx: number,
  len: number,
  axis: WedgeAxis,
): { x0: number; y0: number; x1: number; y1: number } {
  const px = anchorX * cellPx
  const py = anchorY * cellPx
  const span = len * cellPx
  switch (axis) {
    case 'e':
      return {
        x0: px + 0.5,
        y0: py + 0.5,
        x1: px + span - 0.5,
        y1: py + cellPx - 0.5,
      }
    case 'w':
      return {
        x0: px - (len - 1) * cellPx + 0.5,
        y0: py + 0.5,
        x1: px + cellPx - 0.5,
        y1: py + cellPx - 0.5,
      }
    case 's':
      return {
        x0: px + 0.5,
        y0: py + 0.5,
        x1: px + cellPx - 0.5,
        y1: py + span - 0.5,
      }
    case 'n':
      return {
        x0: px + 0.5,
        y0: py - (len - 1) * cellPx + 0.5,
        x1: px + cellPx - 0.5,
        y1: py + cellPx - 0.5,
      }
    default: {
      const _exhaustive: never = axis
      return _exhaustive
    }
  }
}

function mirrorTriangleInFootprint(
  points: [number, number][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  axis: WedgeAxis,
): [number, number][] {
  // Reflect across the short axis of the footprint (true mirror, not rotation).
  if (axis === 'e' || axis === 'w') {
    const cy = (y0 + y1) / 2
    return points.map(([x, y]) => [x, 2 * cy - y])
  }
  const cx = (x0 + x1) / 2
  return points.map(([x, y]) => [2 * cx - x, y])
}

function wedgePolygon(
  anchorX: number,
  anchorY: number,
  cellPx: number,
  len: number,
  dir: WedgeDir,
  axis: WedgeAxis,
  flip: boolean,
): [number, number][] {
  const bbox = wedgeBBox(anchorX, anchorY, cellPx, len, axis)
  const { x0, y0, x1, y1 } = bbox

  let points: [number, number][]
  switch (dir) {
    case 'ne':
      points = [
        [x0, y1],
        [x1, y0],
        [x1, y1],
      ]
      break
    case 'nw':
      points = [
        [x0, y0],
        [x1, y0],
        [x0, y1],
      ]
      break
    case 'se':
      points = [
        [x0, y0],
        [x1, y1],
        [x0, y1],
      ]
      break
    case 'sw':
      points = [
        [x0, y1],
        [x1, y1],
        [x0, y0],
      ]
      break
    default: {
      const _exhaustive: never = dir
      return _exhaustive
    }
  }

  if (flip) {
    points = mirrorTriangleInFootprint(points, x0, y0, x1, y1, axis)
  }
  return points
}

function drawKeelLengthReference(
  ctx: CanvasRenderingContext2D,
  extent: KeelLengthExtent,
  cellPx: number,
  profileGridHeight: number,
  colors: GridColors,
) {
  const x0 = extent.minLength * cellPx + 0.5
  const x1 = (extent.maxLength + 1) * cellPx - 0.5
  const y = profileGridHeight * cellPx - cellPx * 0.5

  const meters = keelLengthMeters(extent)
  const label = meters % 1 === 0 ? `${meters} m` : `${meters.toFixed(2)} m`

  ctx.strokeStyle = colors.referenceLine
  ctx.fillStyle = colors.referenceLine
  ctx.lineWidth = 2
  ctx.setLineDash([])

  const tick = cellPx * 0.35
  ctx.beginPath()
  ctx.moveTo(x0, y - tick)
  ctx.lineTo(x0, y + tick)
  ctx.moveTo(x1, y - tick)
  ctx.lineTo(x1, y + tick)
  ctx.moveTo(x0, y)
  ctx.lineTo(x1, y)
  ctx.stroke()

  ctx.font = '11px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  ctx.fillText(label, (x0 + x1) / 2, y - tick - 2)
}

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  points: [number, number][],
  fill: string,
  stroke: string,
  dashed = false,
) {
  ctx.beginPath()
  ctx.moveTo(points[0]![0], points[0]![1])
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]![0], points[i]![1])
  }
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.strokeStyle = stroke
  ctx.lineWidth = 1
  if (dashed) ctx.setLineDash([4, 3])
  ctx.fill()
  ctx.stroke()
  if (dashed) ctx.setLineDash([])
}

function drawWedgeShape(
  ctx: CanvasRenderingContext2D,
  anchorX: number,
  anchorY: number,
  cellPx: number,
  dir: WedgeDir,
  len: number,
  axis: WedgeAxis,
  flip: boolean,
  fill: string,
  stroke: string,
  dashed = false,
) {
  drawPolygon(
    ctx,
    wedgePolygon(anchorX, anchorY, cellPx, len, dir, axis, flip),
    fill,
    stroke,
    dashed,
  )
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellPx: number,
  block: Block,
  colors: GridColors,
  preview = false,
) {
  const fill = preview ? colors.wedgePreviewFill : colors.cellFill
  const stroke = preview ? colors.wedgePreviewStroke : colors.cellStroke
  const wedgeFill = preview ? colors.wedgePreviewFill : colors.wedgeFill
  const wedgeStroke = preview ? colors.wedgePreviewStroke : colors.wedgeStroke

  if (block.kind === 'cube') {
    const px = x * cellPx
    const py = y * cellPx
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.fillRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1)
    ctx.strokeRect(px + 0.5, py + 0.5, cellPx - 1, cellPx - 1)
    return
  }

  const len = block.len ?? 1
  const rotation = wedgeRotationOf(block)
  const flip = wedgeFlipOf(block)
  const { axis, dir } = wedgeDrawGeometry(len, rotation)
  drawWedgeShape(ctx, x, y, cellPx, dir, len, axis, flip, wedgeFill, wedgeStroke, preview)
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  preview: PlacementPreview,
  cellPx: number,
  gridWidth: number,
  gridHeight: number,
  symmetry: boolean,
  colors: GridColors,
) {
  const { x, y, block, valid } = preview
  const fill = valid ? colors.wedgePreviewFill : colors.invalidPreviewFill
  const stroke = valid ? colors.wedgePreviewStroke : colors.invalidPreviewStroke

  if (block.kind === 'cube') {
    drawBlock(ctx, x, y, cellPx, block, { ...colors, cellFill: fill, cellStroke: stroke }, true)
  } else {
    drawBlock(ctx, x, y, cellPx, block, { ...colors, wedgePreviewFill: fill, wedgePreviewStroke: stroke }, true)
  }

  if (symmetry && block.kind === 'wedge') {
    const len = block.len ?? 1
    const rotation = wedgeRotationOf(block)
    const m = symmetricWedgeAnchor(x, y, len, rotation, gridWidth, gridHeight)
    if (m.x !== x || m.y !== y) {
      drawBlock(ctx, m.x, m.y, cellPx, block, { ...colors, wedgePreviewFill: fill, wedgePreviewStroke: stroke }, true)
    }
  } else if (symmetry && block.kind === 'cube') {
    const mx = mirrorX(x, gridWidth)
    if (mx !== x) {
      drawBlock(ctx, mx, y, cellPx, block, { ...colors, cellFill: fill, cellStroke: stroke }, true)
    }
  }
}

export function drawGrid(options: DrawGridOptions) {
  const {
    ctx,
    gridWidth,
    gridHeight,
    cellPx,
    offsetX,
    offsetY,
    blocks,
    showGridLines,
    showMeterLines,
    symmetry,
    colors,
    preview,
    lengthLabel = 'Längd',
    breadthLabel = 'Bredd',
    keelLengthExtent = null,
  } = options

  const w = gridWidth * cellPx
  const h = gridHeight * cellPx

  ctx.save()
  ctx.translate(offsetX, offsetY)

  ctx.fillStyle = colors.background
  ctx.fillRect(0, 0, w, h)

  if (showGridLines || showMeterLines) {
    for (let x = 0; x <= gridWidth; x++) {
      const isMeter = x % 4 === 0
      if (!showGridLines && !(showMeterLines && isMeter)) continue
      if (showMeterLines && isMeter) {
        ctx.strokeStyle = colors.meterLine
        ctx.lineWidth = 1.5
      } else {
        ctx.strokeStyle = colors.line
        ctx.lineWidth = 1
      }
      const px = x * cellPx
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }
    for (let y = 0; y <= gridHeight; y++) {
      const isMeter = y % 4 === 0
      if (!showGridLines && !(showMeterLines && isMeter)) continue
      if (showMeterLines && isMeter) {
        ctx.strokeStyle = colors.meterLine
        ctx.lineWidth = 1.5
      } else {
        ctx.strokeStyle = colors.line
        ctx.lineWidth = 1
      }
      const py = y * cellPx
      ctx.beginPath()
      ctx.moveTo(0, py)
      ctx.lineTo(w, py)
      ctx.stroke()
    }
  }

  if (symmetry) {
    const cx = (gridWidth / 2) * cellPx
    ctx.strokeStyle = colors.symmetryLine
    ctx.lineWidth = 1
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(cx, 0)
    ctx.lineTo(cx, h)
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const [key, block] of Object.entries(blocks)) {
    const [x, y] = key.split(',').map(Number)
    drawBlock(ctx, x, y, cellPx, block, colors)
  }

  if (preview) {
    drawPreview(ctx, preview, cellPx, gridWidth, gridHeight, symmetry, colors)
  }

  if (keelLengthExtent) {
    drawKeelLengthReference(ctx, keelLengthExtent, cellPx, gridHeight, colors)
  }

  ctx.fillStyle = colors.axisLabel
  ctx.font = '11px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(lengthLabel, w / 2, -6)
  ctx.save()
  ctx.translate(-14, h / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText(breadthLabel, 0, 0)
  ctx.restore()

  ctx.restore()
}

export function getGridColorsFromCss(): GridColors {
  const s = getComputedStyle(document.documentElement)
  return {
    background: s.getPropertyValue('--grid-bg').trim() || '#2a2a2a',
    line: s.getPropertyValue('--grid-line').trim() || '#444',
    meterLine: s.getPropertyValue('--grid-meter-line').trim() || '#666',
    cellFill: s.getPropertyValue('--grid-cell-fill').trim() || '#0d9488',
    cellStroke: s.getPropertyValue('--grid-cell-stroke').trim() || '#0f766e',
    wedgeFill: s.getPropertyValue('--grid-wedge-fill').trim() || '#14b8a6',
    wedgeStroke: s.getPropertyValue('--grid-wedge-stroke').trim() || '#0d9488',
    wedgePreviewFill: s.getPropertyValue('--grid-wedge-preview-fill').trim() || 'rgba(20,184,166,0.25)',
    wedgePreviewStroke: s.getPropertyValue('--grid-wedge-preview-stroke').trim() || '#14b8a6',
    invalidPreviewFill: s.getPropertyValue('--grid-invalid-preview-fill').trim() || 'rgba(239,68,68,0.25)',
    invalidPreviewStroke: s.getPropertyValue('--grid-invalid-preview-stroke').trim() || '#ef4444',
    symmetryLine: s.getPropertyValue('--grid-symmetry-line').trim() || '#0066cc',
    referenceLine: s.getPropertyValue('--grid-reference-line').trim() || '#e67e22',
    axisLabel: s.getPropertyValue('--grid-axis-label').trim() || '#888',
  }
}
