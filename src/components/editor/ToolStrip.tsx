import { useUIStore } from '../../store/uiStore'

function CubeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function WedgeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 5h14v14H5V5z"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.35"
      />
      <path d="M19 5L5 5 19 19Z" fill="currentColor" />
    </svg>
  )
}

function EraseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 18h14M9 5l-4 9h10l-4-9H9z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ToolStrip() {
  const tool = useUIStore((s) => s.tool)
  const setTool = useUIStore((s) => s.setTool)

  const items = [
    { id: 'cube' as const, label: 'Cube', shortcut: '1', icon: <CubeIcon /> },
    { id: 'wedge' as const, label: 'Wedge', shortcut: '2', icon: <WedgeIcon /> },
    { id: 'erase' as const, label: 'Erase', shortcut: '3', icon: <EraseIcon /> },
  ]

  return (
    <aside className="flex w-36 shrink-0 flex-col border-r border-border bg-surface-panel">
      <div className="panel-header">Tools</div>
      <nav className="flex flex-col gap-0.5 p-2" aria-label="Tools">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTool(item.id)}
            className={`tool-btn ${tool === item.id ? 'tool-btn-active' : ''}`}
          >
            {item.icon}
            <span>{item.label}</span>
            <span className="ml-auto text-[10px] text-text-muted">{item.shortcut}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
