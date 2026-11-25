import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { SessionQuestion } from '../../data/practiceSession'
import { groupByPassage } from './groupByPassage'
import { resultText } from './resultText'
import { SaveError } from './SaveError'
import { score } from './score'
import type { SessionController, SessionState } from './SessionController'
import { SessionReview } from './SessionReview'

interface SessionResultsProps {
  controller: SessionController
  state: SessionState
  onDone: () => void
}

export function SessionResults({ controller, state, onDone }: SessionResultsProps) {
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [scrollPositions] = useState(() => new Map<string, number>())
  if (reviewing !== null) {
    return (
      <SessionReview
        controller={controller}
        state={state}
        position={reviewing}
        scrollPositions={scrollPositions}
        onGoTo={setReviewing}
        onBack={() => setReviewing(null)}
      />
    )
  }
  return (
    <Summary controller={controller} state={state} onReview={setReviewing} onDone={onDone} />
  )
}

interface SummaryProps extends SessionResultsProps {
  onReview: (position: number) => void
}

function Summary({ controller, state, onReview, onDone }: SummaryProps) {
  const { session } = state
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [])

  const limit = session.config.time_limit_seconds
  const ranOut = limit !== null && session.active_ms >= limit * 1000
  const { correct, answered, unanswered } = score(session.questions)
  return (
    <div className="mx-auto max-w-3xl">
      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
        Session Results
      </h2>
      <SaveError error={state.error} onDismiss={controller.dismissError} />
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="text-xl font-medium">
          {answered === 0
            ? 'No questions were answered.'
            : `${correct} of ${count(answered, 'answered question')} correct`}
        </p>
        {ranOut && (
          <p className="mt-1 text-muted">Time ran out. Your saved answers were submitted.</p>
        )}
        {unanswered > 0 && answered > 0 && (
          <p className="mt-1 text-muted">{count(unanswered, 'question')} not answered</p>
        )}
      </div>
      <p className="mt-6 text-muted">Choose a question to see its explanations.</p>
      {groupByPassage(session.questions).map(({ passageId, positions }, group) => (
        <section key={positions[0]} className="mt-3">
          {passageId !== null && (
            <h3 id={`results-${group}`} className="mt-5 mb-2 font-semibold">
              Passage {group + 1}
            </h3>
          )}
          <ol
            aria-labelledby={passageId === null ? undefined : `results-${group}`}
            className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            {positions.map((index) => (
              <li key={session.questions[index].id}>
                <ResultRow
                  question={session.questions[index]}
                  number={index + 1}
                  onClick={() => onReview(index)}
                />
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div className="mt-6">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

interface ResultRowProps {
  question: SessionQuestion
  number: number
  onClick: () => void
}

function ResultRow({ question, number, onClick }: ResultRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer flex-wrap justify-between gap-x-6 px-6 py-3 text-left -outline-offset-2 hover:bg-blush"
    >
      <span>
        Question {number} <span className="text-muted">– {question.category_name}</span>
        {question.is_bookmarked && <span className="text-rose-deep"> · Bookmarked</span>}
      </span>
      <span className="font-medium">{resultText(question)}</span>
    </button>
  )
}
