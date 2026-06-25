export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function isInBounds(
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): boolean {
  return x >= 0 && x < gridWidth && y >= 0 && y < gridHeight
}

/** Mirror cell index across vertical hull centerline. */
export function mirrorX(x: number, gridWidth: number): number {
  return gridWidth - 1 - x
}
