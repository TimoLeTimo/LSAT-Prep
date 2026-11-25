import { useSyncExternalStore } from 'react'
import type { SessionController } from './SessionController'

export function useSessionState(controller: SessionController) {
  return useSyncExternalStore(controller.subscribe, controller.getState)
}
