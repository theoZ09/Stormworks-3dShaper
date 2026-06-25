import { lazy, Suspense } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { DesignerPage } from './pages/DesignerPage'
import { useUIStore } from './store/uiStore'

const Model3DPage = lazy(() =>
  import('./pages/Model3DPage').then((m) => ({ default: m.Model3DPage })),
)

export default function App() {
  const appMode = useUIStore((s) => s.appMode)

  return (
    <div className="flex h-full flex-col">
      <AppHeader />
      {appMode === 'grid' ? (
        <DesignerPage />
      ) : (
        <Suspense
          fallback={
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-text-muted">
              Laddar 3D-vy…
            </div>
          }
        >
          <Model3DPage />
        </Suspense>
      )}
    </div>
  )
}
