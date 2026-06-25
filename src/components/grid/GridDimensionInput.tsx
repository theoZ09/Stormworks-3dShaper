import { useEffect, useState } from 'react'
import { GRID_DIM_MAX, GRID_DIM_MIN } from '../../lib/grid/stormworksDimensions'

export function GridDimensionInput({
  value,
  onCommit,
  className = 'w-14',
}: {
  value: number
  onCommit: (n: number) => void
  className?: string
}) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(String(value))
  }, [value, editing])

  const commit = () => {
    const trimmed = text.trim()
    if (trimmed === '') {
      setText(String(value))
      return
    }
    const parsed = Math.round(Number(trimmed))
    if (Number.isNaN(parsed)) {
      setText(String(value))
      return
    }
    const clamped = Math.max(GRID_DIM_MIN, Math.min(GRID_DIM_MAX, parsed))
    setText(String(clamped))
    onCommit(clamped)
    setEditing(false)
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'Escape') {
          setText(String(value))
          setEditing(false)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={`rounded-sm border border-border-subtle bg-surface-inset px-2 py-1 text-xs text-text ${className}`}
    />
  )
}
