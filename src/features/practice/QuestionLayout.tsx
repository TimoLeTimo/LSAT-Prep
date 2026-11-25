import type { ReactNode, RefObject } from 'react'
import type { SessionQuestion } from '../../data/practiceSession'
import { PassagePane } from './PassagePane'

interface QuestionLayoutProps {
  passage: SessionQuestion['passage']
  scrollPositions: Map<string, number>
  screen: RefObject<HTMLDivElement | null>
  questionPane: RefObject<HTMLDivElement | null>
  /** Shown above the passage and question. */
  top: ReactNode
  children: ReactNode
}

/** LR is one column. RC puts the passage beside the question, or above it when narrow. */
export function QuestionLayout(props: QuestionLayoutProps) {
  const { passage, scrollPositions, screen, questionPane, top, children } = props
  if (passage === null) {
    return (
      <div ref={screen} className="mx-auto max-w-3xl">
        {top}
        <div className="mt-6">{children}</div>
      </div>
    )
  }
  return (
    // AppFrame widens the page when it finds data-wide.
    <div ref={screen} data-wide className="scroll-mt-4">
      {top}
      <div className="mt-4 grid gap-6 lg:h-[calc(100svh-10rem)] lg:min-h-96 lg:grid-cols-2">
        <PassagePane key={passage.id} passage={passage} scrollPositions={scrollPositions} />
        <div ref={questionPane} className="min-w-0 lg:overflow-y-auto lg:px-2 lg:pb-2">
          {children}
        </div>
      </div>
    </div>
  )
}
