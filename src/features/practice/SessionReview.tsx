import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import { ChoiceList } from './ChoiceList'
import { ExplanationList } from './ExplanationList'
import { formatTime } from './formatTime'
import { QuestionContent } from './QuestionContent'
import { QuestionLayout } from './QuestionLayout'
import { resultText } from './resultText'
import { SaveError } from './SaveError'
import type { SessionController, SessionState } from './SessionController'
import { ToggleButton } from './ToggleButton'
import { useQuestionScroll } from './useQuestionScroll'

interface SessionReviewProps {
  controller: SessionController
  state: SessionState
  position: number
  /** The positions that Previous and Next step through, in order. */
  positions: readonly number[]
  title: string
  scrollPositions: Map<string, number>
  onGoTo: (position: number) => void
  onBack: () => void
}

/** One question from a finished session. Nothing here changes the recorded answers. */
export function SessionReview(props: SessionReviewProps) {
  const { controller, state, position, positions, title, scrollPositions, onGoTo, onBack } = props
  const { questions } = state.session
  const question = questions[position]
  const step = positions.indexOf(position)
  const previous: number | undefined = positions[step - 1]
  const next: number | undefined = step === -1 ? undefined : positions[step + 1]
  const heading = useRef<HTMLHeadingElement>(null)

  const screen = useRef<HTMLDivElement>(null)
  const questionPane = useRef<HTMLDivElement>(null)
  useQuestionScroll({ screen, questionPane, heading }, position, question.passage !== null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
      if (event.key === 'ArrowRight' && next !== undefined) onGoTo(next)
      else if (event.key === 'ArrowLeft' && previous !== undefined) onGoTo(previous)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previous, next, onGoTo])

  return (
    <QuestionLayout
      passage={question.passage}
      scrollPositions={scrollPositions}
      screen={screen}
      questionPane={questionPane}
      top={null}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
          {title}
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
        {question.is_scored === false && <span className="font-normal text-muted"> · Unscored</span>}
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
        <Button variant="secondary" onClick={() => previous !== undefined && onGoTo(previous)} disabled={previous === undefined}>
          Previous
        </Button>
        <Button variant="secondary" onClick={() => next !== undefined && onGoTo(next)} disabled={next === undefined}>
          Next
        </Button>
        <span className="grow" />
        <Button onClick={onBack}>Back to Results</Button>
      </div>
    </QuestionLayout>
  )
}
