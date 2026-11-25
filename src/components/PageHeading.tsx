import type { ReactNode } from 'react'

/** tabIndex -1 lets the app move focus here on navigation without adding a Tab stop. */
export function PageHeading({ children }: { children: ReactNode }) {
  return (
    <h1
      tabIndex={-1}
      className="font-serif text-3xl font-semibold tracking-tight outline-none sm:text-4xl"
    >
      {children}
    </h1>
  )
}
