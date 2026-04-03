import { useEffect, useRef } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '@/store/appStore'
import DeviceCheckScreen from '@/components/screens/DeviceCheckScreen'
import DisclaimerScreen from '@/components/screens/DisclaimerScreen'
import MainApp from '@/components/MainApp'
import { hasAcceptedDisclaimer, requestPersistentStorage } from '@/lib/storage'
import { detectDeviceCapabilities } from '@/lib/device-detect'
import { useViewportHeight } from '@/lib/useViewportHeight'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

function AppRouter() {
  const { screen, setScreen, setCapabilities, setLlmStatus, settings, updateSettings, addLog } = useAppStore()
  const autoInitDone = useRef(false)

  useViewportHeight()

  useEffect(() => {
    requestPersistentStorage()

    // If we skipped device-check (disclaimer already accepted), probe capabilities silently
    if (hasAcceptedDisclaimer()) {
      detectDeviceCapabilities()
        .then(caps => setCapabilities(caps))
        .catch(() => {})
    }
  }, [])

  // Skip disclaimer if already accepted
  useEffect(() => {
    if (screen === 'disclaimer' && hasAcceptedDisclaimer()) setScreen('app')
  }, [screen])

  // Auto-restore LLM engine from browser cache whenever we arrive at 'app'
  useEffect(() => {
    if (screen !== 'app') return
    if (autoInitDone.current) return
    if (!settings.autoLoadModel || !settings.defaultModel) return

    autoInitDone.current = true
    const modelId = settings.defaultModel
    addLog('llm', `Auto-restoring ${modelId} from cache…`)
    setLlmStatus(false, true, 0, 'Restoring from cache…')

    import('@mlc-ai/web-llm')
      .then(({ CreateMLCEngine }) =>
        CreateMLCEngine(modelId, {
          initProgressCallback: (p: any) => {
            setLlmStatus(false, true, Math.round((p.progress ?? 0) * 100), p.text ?? '')
          },
        })
      )
      .then(engine => {
        ;(window as any).__euScoutEngine = engine
        setLlmStatus(true, false, 100, 'Ready')
        addLog('success', `${modelId} ready (restored from cache)`)
      })
      .catch(err => {
        autoInitDone.current = false
        setLlmStatus(false, false, 0, '')
        updateSettings({ autoLoadModel: false })
        addLog('warn', `Auto-restore failed — load manually in Settings. ${err.message}`)
      })
  }, [screen])

  return (
    <>
      {screen === 'device-check' && <DeviceCheckScreen />}
      {screen === 'disclaimer'   && <DisclaimerScreen />}
      {screen === 'app'          && <MainApp />}
    </>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  )
}
