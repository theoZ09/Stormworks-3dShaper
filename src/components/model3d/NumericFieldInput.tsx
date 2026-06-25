import { useEffect, useState } from 'react'

export function NumericFieldInput({
  value,
  onCommit,
  step = 0.25,
  min,
  max,
  suffix,
  className = 'w-16',
}: {
  value: number
  onCommit: (n: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
  className?: string
}) {
  const [text, setText] = useState(formatValue(value))
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!editing) setText(formatValue(value))
  }, [value, editing])

  const commit = () => {
    const trimmed = text.trim().replace(',', '.')
    if (trimmed === '' || trimmed === '-' || trimmed === '+') {
      setText(formatValue(value))
      setEditing(false)
      return
    }
    const parsed = Number(trimmed)
    if (Number.isNaN(parsed)) {
      setText(formatValue(value))
      setEditing(false)
      return
    }
    let next = parsed
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    setText(formatValue(next))
    onCommit(next)
    setEditing(false)
  }

  const nudge = (delta: number) => {
    let next = value + delta
    if (min !== undefined) next = Math.max(min, next)
    if (max !== undefined) next = Math.min(max, next)
    onCommit(next)
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => nudge(-step)}
        className="w-7 shrink-0 rounded-sm border border-border-subtle px-1 py-0.5 text-xs text-text-muted hover:border-border hover:text-text"
        aria-label="Decrease"
      >
        −
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-0.5">
        <input
          type="text"
          inputMode="decimal"
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
              setText(formatValue(value))
              setEditing(false)
              ;(e.target as HTMLInputElement).blur()
            }
          }}
          className={`min-w-0 flex-1 rounded-sm border border-border-subtle bg-surface-inset px-1.5 py-0.5 text-center text-xs text-text ${className}`}
        />
        {suffix && (
          <span className="shrink-0 text-[10px] text-text-muted">{suffix}</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => nudge(step)}
        className="w-7 shrink-0 rounded-sm border border-border-subtle px-1 py-0.5 text-xs text-text-muted hover:border-border hover:text-text"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  )
}

function formatValue(n: number): string {
  if (Number.isInteger(n)) return String(n)
  const rounded = Math.round(n * 1000) / 1000
  return String(rounded)
}
