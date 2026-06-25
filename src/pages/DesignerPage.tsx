import { ToolStrip } from '../components/editor/ToolStrip'
import { InspectorPanel } from '../components/editor/InspectorPanel'
import { StatusBar } from '../components/editor/StatusBar'
import { HullGridCanvas } from '../components/grid/HullGridCanvas'

export function DesignerPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <ToolStrip />
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <HullGridCanvas />
        </main>
        <InspectorPanel />
      </div>
      <StatusBar />
    </div>
  )
}
