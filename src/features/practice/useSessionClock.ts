import { useEffect } from 'react'
import type { SessionController } from './SessionController'

const SAVE_EVERY_MS = 5000

/** Runs the session clock while the practice screen is open, whether timed or not. */
export function useSessionClock(controller: SessionController, isActive: boolean) {
  useEffect(() => {
    if (!isActive) return
    controller.startClock()
    const interval = setInterval(() => void controller.saveClock(), SAVE_EVERY_MS)
    return () => {
      clearInterval(interval)
      void controller.pauseClock()
    }
  }, [controller, isActive])
}
