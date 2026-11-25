import { useEffect } from 'react'
import type { SessionController } from './SessionController'

const SAVE_EVERY_MS = 5000
/** A longer gap means the computer slept, so it is not counted. */
const MAX_GAP_SECONDS = 60

/** Counts time while a question is on screen and the window is visible. */
export function useQuestionTime(controller: SessionController, questionId: string | null) {
  useEffect(() => {
    if (questionId === null) return
    const id = questionId
    let since = document.hidden ? null : performance.now()

    function count() {
      if (since === null) return
      const now = performance.now()
      const seconds = (now - since) / 1000
      since = now
      if (seconds <= MAX_GAP_SECONDS) controller.addTime(id, seconds)
    }
    function countAndSave() {
      count()
      void controller.saveTime()
    }
    function visibilityChanged() {
      if (document.hidden) {
        countAndSave()
        since = null
      } else {
        since = performance.now()
      }
    }

    const interval = setInterval(countAndSave, SAVE_EVERY_MS)
    document.addEventListener('visibilitychange', visibilityChanged)
    // Counts up to the moment of submitting, before the answer locks.
    const stopCounting = controller.onBeforeSubmit(count)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', visibilityChanged)
      stopCounting()
      countAndSave()
    }
  }, [controller, questionId])
}
