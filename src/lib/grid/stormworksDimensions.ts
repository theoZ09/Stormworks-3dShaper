export const BLOCK_SIZE_M = 0.25
export const GRID_DIM_MIN = 8
export const GRID_DIM_MAX = 128

export type BeamParity = 'odd' | 'even'

export function clampGridDim(n: number): number {
  return Math.max(GRID_DIM_MIN, Math.min(GRID_DIM_MAX, Math.round(n)))
}

export function metersFromBlocks(blocks: number, metersPerCell = BLOCK_SIZE_M): number {
  return blocks * metersPerCell
}

export function formatMetersFromBlocks(blocks: number): string {
  const m = metersFromBlocks(blocks)
  return m % 1 === 0 ? `${m} m` : `${m.toFixed(2)} m`
}

export function parityOf(n: number): BeamParity {
  return n % 2 === 1 ? 'odd' : 'even'
}

/** Snap width to min/max and force odd or even column count. */
export function enforceParity(
  n: number,
  parity: BeamParity,
  min = GRID_DIM_MIN,
  max = GRID_DIM_MAX,
): number {
  let v = clampGridDim(n)
  if (parity === 'odd' && v % 2 === 0) v += 1
  if (parity === 'even' && v % 2 === 1) v += 1
  if (v > max) v -= 2
  if (v < min) v += 2
  return clampGridDim(v)
}

/** When switching parity, nudge to nearest valid width (±1). */
export function nearestWithParity(
  current: number,
  parity: BeamParity,
  min = GRID_DIM_MIN,
  max = GRID_DIM_MAX,
): number {
  if (parityOf(current) === parity) return clampGridDim(current)

  const candidates = [current - 1, current + 1]
    .filter((v) => v >= min && v <= max && parityOf(v) === parity)
    .map(clampGridDim)

  if (candidates.length === 0) return enforceParity(current, parity, min, max)
  return candidates.reduce((best, v) =>
    Math.abs(v - current) < Math.abs(best - current) ? v : best,
  )
}

export function beamParityLabel(parity: BeamParity): string {
  return parity === 'odd' ? 'odd beam' : 'even beam'
}

export interface LengthSyncPatch {
  planHeight: number
  profileWidth: number
}

/** Plan Y and profile X both represent hull length — keep them equal. */
export function syncLengthAcrossViews(lengthBlocks: number): LengthSyncPatch {
  const length = clampGridDim(lengthBlocks)
  return { planHeight: length, profileWidth: length }
}

/** Beam columns from hull length and reference model proportions. */
export function beamBlocksFromLength(
  lengthBlocks: number,
  beamToLengthRatio: number,
  parity: BeamParity,
): number {
  const length = clampGridDim(lengthBlocks)
  const ratio = Math.max(0.05, Math.min(8, beamToLengthRatio))
  const raw = Math.round(length * ratio)
  return enforceParity(Math.max(raw, GRID_DIM_MIN), parity)
}
