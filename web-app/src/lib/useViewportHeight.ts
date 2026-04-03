import { useEffect } from 'react'

/**
 * Sets --app-height CSS var to window.visualViewport.height on every resize.
 * visualViewport excludes the browser chrome (address bar + toolbar) on iOS
 * Safari, giving us the *actual* visible height regardless of scroll state.
 * Must be called once at the app root.
 */
export function useViewportHeight() {
  useEffect(() => {
    const update = () => {
      const h = window.visualViewport?.height ?? window.innerHeight
      document.documentElement.style.setProperty('--app-height', `${h}px`)
    }
    update()
    window.visualViewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    return () => {
      window.visualViewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])
}
