export type DestinationId =
  | 'logical-reasoning'
  | 'reading-comprehension'
  | 'custom-practice'
  | 'practice-tests'
  | 'review'
  | 'statistics'

export type Route = 'menu' | 'settings' | DestinationId

export interface Destination {
  id: DestinationId
  title: string
}

/** The six main-menu destinations, in order. Settings is deliberately separate. */
export const destinations: readonly Destination[] = [
  { id: 'logical-reasoning', title: 'Logical Reasoning' },
  { id: 'reading-comprehension', title: 'Reading Comprehension' },
  { id: 'custom-practice', title: 'Custom Practice' },
  { id: 'practice-tests', title: 'Practice Tests' },
  { id: 'review', title: 'Review' },
  { id: 'statistics', title: 'Statistics' },
]

export function routeHref(route: Route): string {
  return route === 'menu' ? '#/' : `#/${route}`
}

/** Turns the address hash into a route. Anything unknown goes to the menu. */
export function parseRoute(hash: string): Route {
  const name = hash.replace(/^#\/?/, '')
  if (name === 'settings') return 'settings'
  return destinations.find((destination) => destination.id === name)?.id ?? 'menu'
}
