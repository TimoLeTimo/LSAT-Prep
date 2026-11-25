import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { Session, SessionQuestion } from '../../data/practiceSession'
import { score } from './score'

export function SessionResults({ session, onDone }: { session: Session; onDone: () => void }) {
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
      <ol className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
        {session.questions.map((question, index) => (
          <li key={question.id} className="flex flex-wrap justify-between gap-x-6 px-6 py-3">
            <span>
              Question {index + 1} <span className="text-muted">– {question.category_name}</span>
            </span>
            <span className="font-medium">{resultText(question)}</span>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

function resultText({ outcome, selected }: SessionQuestion) {
  if (outcome === null || outcome.is_correct === null) return 'Not answered'
  if (outcome.is_correct) return `✓ Correct (${selected})`
  return `✗ Incorrect (${selected}; correct answer ${outcome.correct_choice})`
}
