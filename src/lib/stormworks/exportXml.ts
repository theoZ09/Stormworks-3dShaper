export interface StormworksVoxel {
  x: number
  y: number
  z: number
}

const IDENTITY_R = '1,0,0,0,1,0,0,0,1'
const HULL_CUBE_SC = '6'

function formatVp(vp: StormworksVoxel): string {
  const attrs: string[] = []
  if (vp.x !== 0) attrs.push(`x="${vp.x}"`)
  if (vp.y !== 0) attrs.push(`y="${vp.y}"`)
  if (vp.z !== 0) attrs.push(`z="${vp.z}"`)
  if (attrs.length === 0) return ''
  return `<vp ${attrs.join(' ')}/>`
}

function formatComponent(vp: StormworksVoxel): string {
  const vpTag = formatVp(vp)
  return `<c><o r="${IDENTITY_R}" sc="${HULL_CUBE_SC}">${vpTag}</o></c>`
}

export function buildVehicleXml(voxels: StormworksVoxel[]): string {
  const components = voxels.map(formatComponent).join('')
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<vehicle data_version="3" bodies_id="2">` +
    `<authors/>` +
    `<bodies><body unique_id="2"><components>${components}</components></body></bodies>` +
    `<logic_node_links/>` +
    `</vehicle>`
  )
}

export function downloadVehicleXml(voxels: StormworksVoxel[], filename = 'hull-export.xml'): void {
  const xml = buildVehicleXml(voxels)
  const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
