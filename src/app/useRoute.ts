import { useSyncExternalStore } from 'react'
import { parseRoute, type Route } from './routes'

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** The current screen, kept in the address hash so Back and reload both work. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => parseRoute(window.location.hash))
}
