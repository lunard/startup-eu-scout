import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppStore } from '@/store/appStore'
import DeviceCheckScreen from '@/components/screens/DeviceCheckScreen'
import DisclaimerScreen from '@/components/screens/DisclaimerScreen'
import MainApp from '@/components/MainApp'
import { hasAcceptedDisclaimer, requestPersistentStorage } from '@/lib/storage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5 * 60 * 1000, retry: 1 } },
})

function AppRouter() {
  const { screen, setScreen } = useAppStore()

  useEffect(() => {
    requestPersistentStorage()
  }, [])

  useEffect(() => {
    if (screen === 'disclaimer' && hasAcceptedDisclaimer()) {
      setScreen('app')
    }
  }, [screen])

  return (
    <AnimatePresence mode="wait">
      {screen === 'device-check' && (
        <motion.div key="device-check" className="contents"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}>
          <DeviceCheckScreen />
        </motion.div>
      )}
      {screen === 'disclaimer' && (
        <motion.div key="disclaimer" className="contents"
          initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
          <DisclaimerScreen />
        </motion.div>
      )}
      {screen === 'app' && (
        <motion.div key="app" className="contents"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}>
          <MainApp />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  )
}
