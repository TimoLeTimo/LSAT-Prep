import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { routeHref, type Route } from './routes'

interface AppFrameProps {
  route: Route
  title: string
  children: ReactNode
}

export function AppFrame({ route, title, children }: AppFrameProps) {
  const mainRef = useRef<HTMLElement>(null)
  const previousRoute = useRef(route)

  useEffect(() => {
    document.title = route === 'menu' ? 'LSAT Prep' : `${title} – LSAT Prep`
    if (previousRoute.current === route) return
    previousRoute.current = route
    // On a screen change, move keyboard focus to the new page heading.
    window.scrollTo(0, 0)
    mainRef.current?.querySelector('h1')?.focus()
  }, [route, title])

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <a
            href={routeHref('menu')}
            aria-current={route === 'menu' ? 'page' : undefined}
            className="rounded-md font-serif text-xl font-semibold tracking-tight"
          >
            LSAT Prep
          </a>
          <a
            href={routeHref('settings')}
            aria-label="Settings"
            title="Settings"
            aria-current={
              route === 'settings'
                ? 'page'
                : route === 'question-bank' || route === 'backup'
                  ? 'true'
                  : undefined
            }
            className="rounded-lg p-2.5 text-muted transition-colors hover:bg-blush hover:text-rose-deep aria-[current]:bg-blush aria-[current]:text-rose-deep"
          >
            <Icon name="settings" className="size-5" />
          </a>
        </div>
      </header>
      <main ref={mainRef} className="mx-auto w-full max-w-5xl flex-1 px-6 py-10 has-[[data-wide]]:max-w-[87.5rem] sm:py-14">
        {children}
      </main>
    </div>
  )
}
