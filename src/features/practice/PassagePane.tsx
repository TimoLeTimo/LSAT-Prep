import { useLayoutEffect, useRef } from 'react'
import type { SessionQuestion } from '../../data/practiceSession'

interface PassagePaneProps {
  passage: NonNullable<SessionQuestion['passage']>
  /** Remembers how far each passage was scrolled, by passage ID. */
  scrollPositions: Map<string, number>
}

/** Give this `key={passage.id}`, so it stays in place between questions on one passage. */
export function PassagePane({ passage, scrollPositions }: PassagePaneProps) {
  const pane = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (pane.current) pane.current.scrollTop = scrollPositions.get(passage.id) ?? 0
  }, [passage.id, scrollPositions])

  const isComparative = passage.texts.length > 1
  return (
    <div
      ref={pane}
      role="region"
      aria-label="Passage"
      tabIndex={0}
      onScroll={(event) => scrollPositions.set(passage.id, event.currentTarget.scrollTop)}
      className="max-h-[45svh] overflow-y-auto rounded-2xl border border-line bg-surface px-6 py-5 shadow-card lg:h-full lg:max-h-none"
    >
      {passage.texts.map(({ label, text }) => (
        <div key={label} className="mb-8 last:mb-0">
          {isComparative && (
            <h3 className="mb-3 font-serif text-xl font-semibold">Passage {label}</h3>
          )}
          <p className="font-serif text-lg leading-relaxed whitespace-pre-line wrap-anywhere">
            {text}
          </p>
        </div>
      ))}
    </div>
  )
}
