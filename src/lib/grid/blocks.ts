import { cellKey, isInBounds, mirrorX } from './coords'

export type BlockKind = 'cube' | 'wedge'
export type WedgeLen = 1 | 2 | 4
/** 90° clockwise steps from reference orientation (0–3). */
export type WedgeRotation = 0 | 1 | 2 | 3

/** @internal Drawing basis — used by draw.ts */
export type WedgeAxis = 'e' | 'w' | 'n' | 's'
/** @internal Drawing basis — used by draw.ts */
export type WedgeDir = 'ne' | 'nw' | 'se' | 'sw'

export interface Block {
  kind: BlockKind
  len?: WedgeLen
  rotation?: WedgeRotation
  /** Flips triangle slope (/ ↔ \) within the same footprint. */
  flip?: boolean
  /** @deprecated Migrated to rotation */
  dir?: WedgeDir
  /** @deprecated Migrated to rotation */
  axis?: WedgeAxis
}

export type BlocksMap = Record<string, Block>

export const WEDGE_LENS: WedgeLen[] = [1, 2, 4]

export const WEDGE_LEN_LABELS: Record<WedgeLen, string> = {
  1: '1×1',
  2: '1×2',
  4: '1×4',
}

export const WEDGE_ROTATIONS: WedgeRotation[] = [0, 1, 2, 3]

export const WEDGE_DIR_LABELS: Record<WedgeDir, string> = {
  ne: '↗',
  nw: '↖',
  se: '↘',
  sw: '↙',
}

/** Footprint direction labels for multi-cell wedges. */
export const WEDGE_ROTATION_LABELS: Record<WedgeRotation, string> = {
  0: '→',
  1: '↓',
  2: '←',
  3: '↑',
}

const ROTATION_DIR_1: WedgeDir[] = ['ne', 'se', 'sw', 'nw']

const MULTI_GEOMETRY: { axis: WedgeAxis; dir: WedgeDir }[] = [
  { axis: 'e', dir: 'ne' },
  { axis: 's', dir: 'nw' },
  { axis: 'w', dir: 'nw' },
  { axis: 'n', dir: 'ne' },
]

const LEGACY_DIR_ROTATION: Record<WedgeDir, WedgeRotation> = {
  ne: 0,
  se: 1,
  sw: 2,
  nw: 3,
}

function wedgeGeometry(
  len: WedgeLen,
  rotation: WedgeRotation,
): { axis: WedgeAxis; dir: WedgeDir } {
  if (len === 1) {
    return { axis: 'e', dir: ROTATION_DIR_1[rotation]! }
  }
  return MULTI_GEOMETRY[rotation]!
}

export function wedgeRotationOf(block: Block): WedgeRotation {
  if (block.rotation !== undefined) return block.rotation
  const len = block.len ?? 1
  if (len === 1 && block.dir) {
    return LEGACY_DIR_ROTATION[block.dir] ?? 0
  }
  if (block.axis && block.dir) {
    const idx = MULTI_GEOMETRY.findIndex(
      (g) => g.axis === block.axis && g.dir === block.dir,
    )
    if (idx >= 0) return idx as WedgeRotation
  }
  return 0
}

export function wedgeFlipOf(block: Block): boolean {
  return block.flip ?? false
}

export function normalizeWedgeBlock(block: Block): Block {
  if (block.kind !== 'wedge') return block
  const len = block.len ?? 1
  const rotation = wedgeRotationOf(block)
  const flip = wedgeFlipOf(block)
  return { kind: 'wedge', len, rotation, flip: flip || undefined }
}

export function createCube(): Block {
  return { kind: 'cube' }
}

export function createWedge(
  len: WedgeLen = 1,
  rotation: WedgeRotation = 0,
  flip = false,
): Block {
  return { kind: 'wedge', len, rotation, flip: flip || undefined }
}

export function rotateWedge90CW(rotation: WedgeRotation): WedgeRotation {
  return ((rotation + 1) % 4) as WedgeRotation
}

function footprintBounds(cells: { x: number; y: number }[]) {
  const xs = cells.map((c) => c.x)
  const ys = cells.map((c) => c.y)
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  }
}

function footprintKey(cells: { x: number; y: number }[]): string {
  return cells
    .map((c) => cellKey(c.x, c.y))
    .sort()
    .join('|')
}

function rotatedAnchor(
  cells: { x: number; y: number }[],
  len: WedgeLen,
  axis: WedgeAxis,
): { x: number; y: number } {
  const { minX, maxX, minY, maxY } = footprintBounds(cells)
  const floorHalf = Math.floor((len - 1) / 2)
  const ceilHalf = Math.ceil((len - 1) / 2)

  switch (axis) {
    case 'e':
      return { x: minX + ceilHalf, y: minY - floorHalf }
    case 's':
      return { x: minX + floorHalf, y: minY + ceilHalf }
    case 'w':
      return { x: maxX - floorHalf, y: minY + floorHalf }
    case 'n':
      return { x: minX - ceilHalf, y: maxY - len + 1 + floorHalf }
  }
}

export function wedgeFootprint(
  anchorX: number,
  anchorY: number,
  len: WedgeLen,
  rotation: WedgeRotation,
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number }[] {
  const { axis } = wedgeGeometry(len, rotation)
  const cells: { x: number; y: number }[] = []
  for (let i = 0; i < len; i++) {
    let x = anchorX
    let y = anchorY
    switch (axis) {
      case 'e':
        x = anchorX + i
        break
      case 'w':
        x = anchorX - i
        break
      case 's':
        y = anchorY + i
        break
      case 'n':
        y = anchorY - i
        break
    }
    if (!isInBounds(x, y, gridWidth, gridHeight)) return []
    cells.push({ x, y })
  }
  return cells
}

export function rotateWedgeFootprint(
  anchorX: number,
  anchorY: number,
  len: WedgeLen,
  rotation: WedgeRotation,
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number; rotation: WedgeRotation } {
  const nextRotation = rotateWedge90CW(rotation)
  const geom = wedgeGeometry(len, rotation)
  const fp = wedgeFootprint(anchorX, anchorY, len, rotation, gridWidth, gridHeight)
  if (fp.length !== len) {
    return { x: anchorX, y: anchorY, rotation: nextRotation }
  }

  if (len === 1) {
    return { x: anchorX, y: anchorY, rotation: nextRotation }
  }

  const { x, y } = rotatedAnchor(fp, len, geom.axis)
  const nextFp = wedgeFootprint(x, y, len, nextRotation, gridWidth, gridHeight)
  if (nextFp.length === len) {
    return { x, y, rotation: nextRotation }
  }

  return { x: anchorX, y: anchorY, rotation: nextRotation }
}

/** Mirror wedge position across hull centerline — same rotation and flip. */
export function symmetricWedgeAnchor(
  anchorX: number,
  anchorY: number,
  len: WedgeLen,
  rotation: WedgeRotation,
  gridWidth: number,
  gridHeight: number,
): { x: number; y: number } {
  if (len === 1) {
    return { x: mirrorX(anchorX, gridWidth), y: anchorY }
  }

  const fp = wedgeFootprint(anchorX, anchorY, len, rotation, gridWidth, gridHeight)
  const mirroredFp = fp.map((c) => ({ x: mirrorX(c.x, gridWidth), y: c.y }))
  const targetKey = footprintKey(mirroredFp)

  for (const c of mirroredFp) {
    const trial = wedgeFootprint(c.x, c.y, len, rotation, gridWidth, gridHeight)
    if (footprintKey(trial) === targetKey) {
      return { x: c.x, y: c.y }
    }
  }

  return { x: mirroredFp[0]!.x, y: mirroredFp[0]!.y }
}

export function footprintKeys(
  anchorX: number,
  anchorY: number,
  len: WedgeLen,
  rotation: WedgeRotation,
  gridWidth: number,
  gridHeight: number,
): string[] {
  return wedgeFootprint(anchorX, anchorY, len, rotation, gridWidth, gridHeight).map(
    (c) => cellKey(c.x, c.y),
  )
}

export function anchorKeyAt(
  blocks: BlocksMap,
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): string | null {
  const direct = cellKey(x, y)
  if (blocks[direct]) return direct

  for (const [key, block] of Object.entries(blocks)) {
    if (block.kind !== 'wedge') continue
    const len = block.len ?? 1
    if (len === 1) continue
    const [ax, ay] = key.split(',').map(Number)
    const rotation = wedgeRotationOf(block)
    const fp = wedgeFootprint(ax, ay, len, rotation, gridWidth, gridHeight)
    if (fp.some((c) => c.x === x && c.y === y)) return key
  }
  return null
}

export function keysForErase(
  blocks: BlocksMap,
  x: number,
  y: number,
  gridWidth: number,
  gridHeight: number,
): string[] {
  const anchor = anchorKeyAt(blocks, x, y, gridWidth, gridHeight)
  return anchor ? [anchor] : []
}

export function footprintOverlapsExisting(
  blocks: BlocksMap,
  anchorX: number,
  anchorY: number,
  len: WedgeLen,
  rotation: WedgeRotation,
  gridWidth: number,
  gridHeight: number,
): boolean {
  const fp = wedgeFootprint(anchorX, anchorY, len, rotation, gridWidth, gridHeight)
  if (fp.length !== len) return true
  return fp.some(
    (c) => anchorKeyAt(blocks, c.x, c.y, gridWidth, gridHeight) !== null,
  )
}

export function cloneBlocks(blocks: BlocksMap): BlocksMap {
  return structuredClone(blocks)
}

export function wedgeDrawGeometry(
  len: WedgeLen,
  rotation: WedgeRotation,
): { axis: WedgeAxis; dir: WedgeDir } {
  return wedgeGeometry(len, rotation)
}

export function blockLabel(block: Block): string {
  if (block.kind === 'cube') return 'Cube'
  const len = block.len ?? 1
  const rotation = wedgeRotationOf(block)
  const flip = wedgeFlipOf(block)
  const { dir } = wedgeDrawGeometry(len, rotation)
  const flipSuffix = flip ? ' speglad' : ''
  if (len === 1) return `Wedge ${WEDGE_DIR_LABELS[dir]}${flipSuffix}`
  return `Wedge ${WEDGE_LEN_LABELS[len]} ${WEDGE_ROTATION_LABELS[rotation]}${flipSuffix}`
}

export function migrateCellsToBlocks(cells: string[]): BlocksMap {
  const blocks: BlocksMap = {}
  for (const key of cells) {
    blocks[key] = createCube()
  }
  return blocks
}

export function migrateBlocksMap(blocks: BlocksMap): BlocksMap {
  const next: BlocksMap = {}
  for (const [key, block] of Object.entries(blocks)) {
    next[key] = block.kind === 'wedge' ? normalizeWedgeBlock(block) : block
  }
  return next
}

/** Migrate legacy UI wedgeDir/wedgeAxis to rotation. */
export function legacyUiToRotation(
  dir: WedgeDir | undefined,
  axis: WedgeAxis | undefined,
  len: WedgeLen,
): WedgeRotation {
  if (len === 1 && dir) return LEGACY_DIR_ROTATION[dir] ?? 0
  if (axis && dir) {
    const idx = MULTI_GEOMETRY.findIndex((g) => g.axis === axis && g.dir === dir)
    if (idx >= 0) return idx as WedgeRotation
  }
  return 0
}
