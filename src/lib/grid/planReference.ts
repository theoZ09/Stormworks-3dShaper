import type { BlocksMap } from './blocks'
import { wedgeFootprint, wedgeRotationOf } from './blocks'
import { mirrorX } from './coords'

/** Grid columns that lie on the hull centerline (symmetry axis). */
export function symmetryLineXColumns(gridWidth: number): number[] {
  if (gridWidth % 2 === 1) {
    return [(gridWidth - 1) / 2]
  }
  const right = gridWidth / 2
  return [right - 1, right]
}

export function isOnSymmetryLine(x: number, gridWidth: number): boolean {
  if (mirrorX(x, gridWidth) === x) return true
  const cols = symmetryLineXColumns(gridWidth)
  return cols.includes(x)
}

export interface KeelLengthExtent {
  /** Along ship length in plan (grid Y → profile length). */
  minLength: number
  maxLength: number
}

/** Length span of blocks on the plan symmetry line (bow–stern). */
export function planKeelLengthExtent(
  blocks: BlocksMap,
  planGridWidth: number,
  planGridHeight: number,
): KeelLengthExtent | null {
  let minLength = Infinity
  let maxLength = -Infinity

  for (const [key, block] of Object.entries(blocks)) {
    const [ax, ay] = key.split(',').map(Number)
    const len = block.len ?? 1
    const cells =
      block.kind === 'wedge' && len > 1
        ? wedgeFootprint(ax, ay, len, wedgeRotationOf(block), planGridWidth, planGridHeight)
        : [{ x: ax, y: ay }]

    for (const { x, y } of cells) {
      if (!isOnSymmetryLine(x, planGridWidth)) continue
      minLength = Math.min(minLength, y)
      maxLength = Math.max(maxLength, y)
    }
  }

  if (minLength === Infinity) return null
  return { minLength, maxLength }
}

export function keelLengthCellCount(extent: KeelLengthExtent): number {
  return extent.maxLength - extent.minLength + 1
}

export function keelLengthMeters(extent: KeelLengthExtent, metersPerCell = 0.25): number {
  return keelLengthCellCount(extent) * metersPerCell
}
