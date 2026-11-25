import type { ReactNode } from 'react'

interface CardProps {
  id: string
  title: string
  note?: string
  children: ReactNode
}

export function Card({ id, title, note, children }: CardProps) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-2xl border border-line bg-surface p-6 shadow-card"
    >
      <h2 id={id} className="font-serif text-xl font-semibold">
        {title}
      </h2>
      {note !== undefined && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}
