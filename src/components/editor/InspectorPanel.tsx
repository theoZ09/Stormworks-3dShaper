import { PropertiesInspector } from './PropertiesInspector'
import { ContinuePanel } from './ContinuePanel'
import { useUIStore } from '../../store/uiStore'

export function InspectorPanel() {
  const tab = useUIStore((s) => s.inspectorTab)
  const setTab = useUIStore((s) => s.setInspectorTab)

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-border bg-surface-panel lg:w-72">
      <div className="flex border-b border-border-subtle">
        <button
          type="button"
          onClick={() => setTab('properties')}
          className={`inspector-tab ${tab === 'properties' ? 'inspector-tab-active' : ''}`}
        >
          Egenskaper
        </button>
        <button
          type="button"
          onClick={() => setTab('continue')}
          className={`inspector-tab ${tab === 'continue' ? 'inspector-tab-active' : ''}`}
        >
          Fortsätt
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === 'properties' ? <PropertiesInspector /> : <ContinuePanel />}
      </div>
    </aside>
  )
}
