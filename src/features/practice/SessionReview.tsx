import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import { ChoiceList } from './ChoiceList'
import { ExplanationList } from './ExplanationList'
import { formatTime } from './formatTime'
import { QuestionContent } from './QuestionContent'
import { resultText } from './resultText'
import { SaveError } from './SaveError'
import type { SessionController, SessionState } from './SessionController'
import { ToggleButton } from './ToggleButton'

interface SessionReviewProps {
  controller: SessionController
  state: SessionState
  position: number
  onGoTo: (position: number) => void
  onBack: () => void
}

/** One question from a finished session. Nothing here changes the recorded answers. */
export function SessionReview({ controller, state, position, onGoTo, onBack }: SessionReviewProps) {
  const { questions } = state.session
  const question = questions[position]
  const last = questions.length - 1
  const heading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [position])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (event.key === 'ArrowRight' && position < last) onGoTo(position + 1)
      else if (event.key === 'ArrowLeft' && position > 0) onGoTo(position - 1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [position, last, onGoTo])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
          Review: Question {position + 1} of {questions.length}
        </h2>
        <ToggleButton
          isOn={question.is_bookmarked}
          onLabel="Remove Bookmark"
          offLabel="Bookmark"
          onClick={() => controller.toggleBookmark(question.id)}
        />
      </div>
      <p className="mt-1 text-sm text-muted">{question.category_name}</p>
      <p className="mt-3 font-medium">
        {resultText(question)}
        <span className="font-normal text-muted">
          {' '}
          · Time: {formatTime(question.time_spent_seconds * 1000)}
        </span>
      </p>
      <SaveError error={state.error} onDismiss={controller.dismissError} />
      <QuestionContent question={question} />
      <ChoiceList question={question} isDisabled onSelect={() => {}} />
      <ExplanationList question={question} />
      <div className="mt-6 flex flex-wrap gap-3 border-t border-line pt-6">
        <Button variant="secondary" onClick={() => onGoTo(position - 1)} disabled={position === 0}>
          Previous
        </Button>
        <Button variant="secondary" onClick={() => onGoTo(position + 1)} disabled={position === last}>
          Next
        </Button>
        <span className="grow" />
        <Button onClick={onBack}>Back to Results</Button>
      </div>
    </div>
  )
}
