import { useCallback, useRef, useState } from 'react'
import {
  Model3DViewport,
  type Model3DLoadState,
  type Model3DViewportHandle,
} from '../components/model3d/Model3DViewport'
import { StormworksDimensionsPanel } from '../components/model3d/StormworksDimensionsPanel'

const ACCEPT = '.glb,.gltf'

export function Model3DPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const viewportRef = useRef<Model3DViewportHandle>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<Model3DLoadState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLoadStateChange = useCallback((state: Model3DLoadState, message?: string) => {
    setLoadState(state)
    setErrorMessage(state === 'error' ? (message ?? 'Okänt fel') : null)
  }, [])

  const openFilePicker = () => inputRef.current?.click()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.glb') && !lower.endsWith('.gltf')) {
      setErrorMessage('Välj en .glb- eller .gltf-fil')
      setLoadState('error')
      return
    }

    setFileName(file.name)
    setImportFile(file)
    setErrorMessage(null)
    e.target.value = ''
  }

  const isLoading = loadState === 'loading'

  const handleExportXml = useCallback(() => {
    return viewportRef.current?.voxelizeSurface() ?? null
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-surface-panel px-3 py-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isLoading}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {isLoading ? 'Laddar modell…' : 'Importera GLB'}
        </button>

        {fileName && loadState === 'loaded' && (
          <span className="text-xs text-text-muted">
            Inläst: <span className="text-text">{fileName}</span>
          </span>
        )}

        {errorMessage && (
          <span className="text-xs text-red-500" role="alert">
            {errorMessage}
          </span>
        )}

        <span className="ml-auto hidden text-[11px] text-text-muted sm:inline">
          Rotera: vänsterdrag · Zoom: scroll · Panorera: högerdrag
        </span>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <Model3DViewport
            ref={viewportRef}
            className="absolute inset-0"
            importFile={importFile}
            onLoadStateChange={handleLoadStateChange}
          />

          {!fileName && loadState !== 'loading' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
              <div className="max-w-sm rounded-sm border border-border-subtle bg-surface-elevated/95 px-4 py-3 text-center shadow-sm backdrop-blur-sm">
                <p className="text-sm text-text">Ingen modell inläst</p>
                <p className="mt-1 text-xs text-text-muted">
                  Klicka <strong className="text-text">Importera GLB</strong> ovan, eller ange
                  Stormworks-mått i panelen till höger
                </p>
              </div>
            </div>
          )}
        </main>

        <aside className="flex w-56 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border bg-surface-panel p-3 text-xs sm:w-64 lg:w-72">
          <StormworksDimensionsPanel
            hasModel={loadState === 'loaded'}
            onExportXml={handleExportXml}
          />

          <section className="border-t border-border-subtle pt-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Referensmodell
            </p>
            <button
              type="button"
              onClick={openFilePicker}
              disabled={isLoading}
              className="w-full rounded-sm border border-accent bg-accent/10 px-2 py-2 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
            >
              {isLoading ? 'Laddar…' : 'Importera GLB…'}
            </button>
            <ul className="mt-2 list-inside list-disc space-y-1 text-[10px] text-text-muted">
              <li>GLB eller glTF (.glb rekommenderas)</li>
              <li>Modellen centreras automatiskt</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  )
}
