import { useRef, useState } from 'react'
import { Button } from '../../components/Button'
import type { PastAnswer, SessionType } from '../../data/records'
import { ChoiceList } from '../practice/ChoiceList'
import { ExplanationList } from '../practice/ExplanationList'
import { formatTime } from '../practice/formatTime'
import { QuestionContent } from '../practice/QuestionContent'
import { QuestionLayout } from '../practice/QuestionLayout'
import { resultText } from '../practice/resultText'
import { useQuestionScroll } from '../practice/useQuestionScroll'

const sessionNames: Record<SessionType, string> = {
  targeted: 'Practice',
  custom: 'Custom practice',
  test: 'Custom test',
  full_simulation: 'Full simulation',
  review: 'Review',
}

/** Each answer exactly as the question was shown then, newest first. */
export function PastAnswers({ past }: { past: readonly PastAnswer[] }) {
  const [index, setIndex] = useState(0)
  const [scrollPositions] = useState(() => new Map<string, number>())
  const heading = useRef<HTMLHeadingElement>(null)
  const screen = useRef<HTMLDivElement>(null)
  const questionPane = useRef<HTMLDivElement>(null)
  useQuestionScroll({ screen, questionPane, heading }, index, true)

  const { answered_at, session_type, is_retry, question } = past[index]
  return (
    <section aria-labelledby="past-answers" className="mt-8 border-t border-line pt-8">
      <QuestionLayout
        passage={question.passage}
        scrollPositions={scrollPositions}
        screen={screen}
        questionPane={questionPane}
        top={null}
      >
        <h2
          id="past-answers"
          ref={heading}
          tabIndex={-1}
          className="font-serif text-2xl font-semibold outline-none"
        >
          Past Answer {index + 1} of {past.length}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {sessionNames[session_type]}
          {is_retry && ' (retry)'}, {new Date(answered_at).toLocaleString()}
        </p>
        <p className="mt-3 font-medium">
          {resultText(question)}
          <span className="font-normal text-muted">
            {' '}
            · Time: {formatTime(question.time_spent_seconds * 1000)}
          </span>
        </p>
        <QuestionContent question={question} />
        <ChoiceList question={question} isDisabled onSelect={() => {}} />
        <ExplanationList question={question} />
        {past.length > 1 && (
          <div className="mt-6 flex gap-3 border-t border-line pt-6">
            <Button variant="secondary" onClick={() => setIndex(index - 1)} disabled={index === 0}>
              Newer
            </Button>
            <Button
              variant="secondary"
              onClick={() => setIndex(index + 1)}
              disabled={index === past.length - 1}
            >
              Older
            </Button>
          </div>
        )}
      </QuestionLayout>
    </section>
  )
}
