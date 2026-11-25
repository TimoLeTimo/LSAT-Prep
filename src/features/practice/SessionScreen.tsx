import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import { practiceSession, type Session, type SessionQuestion } from '../../data/practiceSession'
import { CHOICE_LABELS, type ChoiceLabel } from '../../domain/content/types'
import { ChoiceList } from './ChoiceList'
import { FinishDialog } from './FinishDialog'
import { QuestionNav } from './QuestionNav'
import { SessionController } from './SessionController'
import { SessionResults } from './SessionResults'
import { SessionTimer } from './SessionTimer'
import { useQuestionTime } from './useQuestionTime'
import { useSessionClock } from './useSessionClock'

interface SessionScreenProps {
  session: Session
  onDone: () => void
}

export function SessionScreen({ session: initial, onDone }: SessionScreenProps) {
  const [controller] = useState(() => new SessionController(practiceSession, initial))
  const state = useSyncExternalStore(controller.subscribe, controller.getState)
  const [isFinishing, setIsFinishing] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)

  const { session, position, unsaved, isSubmitting, error } = state
  const question = session.questions[position]
  const isActive = session.status === 'in_progress'
  useQuestionTime(controller, isActive && !question.is_submitted ? question.id : null)

  useSessionClock(controller, isActive)

  // A new question starts at the top, with keyboard focus on its heading.
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [position])

  // A–E select and the arrows move. Nothing that locks an answer has a single key.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return
      if (document.querySelector('dialog[open]') !== null) return
      if (event.target instanceof Element && event.target.closest('input, select, textarea')) return
      const key = event.key.toUpperCase()
      if ((CHOICE_LABELS as readonly string[]).includes(key)) controller.select(key as ChoiceLabel)
      else if (event.key === 'ArrowRight') controller.next()
      else if (event.key === 'ArrowLeft') controller.previous()
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [controller])

  if (!isActive) return <SessionResults session={session} onDone={onDone} />

  const checksEach = session.config.explanations === 'after_each'
  const total = session.questions.length
  const unanswered = session.questions.filter(({ selected }) => selected === null).length

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap-reverse items-start justify-between gap-x-6 gap-y-3">
        <QuestionNav questions={session.questions} position={position} onGoTo={controller.goTo} />
        {session.config.time_limit_seconds !== null && (
          <SessionTimer controller={controller} limitSeconds={session.config.time_limit_seconds} />
        )}
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2
          ref={heading}
          tabIndex={-1}
          className="font-serif text-2xl font-semibold outline-none"
        >
          Question {position + 1} of {total}
        </h2>
        <button
          type="button"
          aria-pressed={question.is_flagged}
          onClick={controller.toggleFlag}
          className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-blush aria-pressed:border-rose-accent aria-pressed:bg-blush aria-pressed:text-rose-deep"
        >
          {question.is_flagged ? 'Flagged' : 'Flag'}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">{question.category_name}</p>

      <div className="mt-5 space-y-5 text-lg leading-relaxed whitespace-pre-line wrap-anywhere">
        {question.stimulus !== null && <p>{question.stimulus}</p>}
        <p id="prompt" className="font-medium">
          {question.prompt}
        </p>
      </div>
      <ChoiceList
        question={question}
        isDisabled={question.is_submitted || isSubmitting}
        onSelect={controller.select}
      />

      <p className="mt-3 min-h-6 text-sm text-muted" role="status">
        {statusText(question, unsaved.has(question.id))}
      </p>
      {error !== null && (
        <div role="alert" className="mt-2 rounded-lg border border-rose-accent bg-blush p-4">
          <p className="font-medium">This was not saved.</p>
          <p className="mt-1 wrap-anywhere">{error.message}</p>
          <div className="mt-3 flex gap-3">
            <Button onClick={error.retry}>Try Again</Button>
            <Button variant="secondary" onClick={controller.dismissError}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-6">
        <Button variant="secondary" onClick={controller.previous} disabled={position === 0}>
          Previous
        </Button>
        <Button variant="secondary" onClick={controller.next} disabled={position === total - 1}>
          Next
        </Button>
        {checksEach && !question.is_submitted && (
          <Button onClick={controller.submit} disabled={question.selected === null || isSubmitting}>
            Check Answer
          </Button>
        )}
        <span className="grow" />
        <Button variant="secondary" onClick={() => setIsFinishing(true)} disabled={isSubmitting}>
          Finish
        </Button>
      </div>

      {isFinishing && (
        <FinishDialog
          message={
            unanswered === 0
              ? 'You have answered every question.'
              : `You have ${count(unanswered, 'unanswered question')}.`
          }
          onCancel={() => setIsFinishing(false)}
          onConfirm={() => {
            setIsFinishing(false)
            void controller.finish()
          }}
        />
      )}
    </div>
  )
}

function statusText({ outcome, selected }: SessionQuestion, isUnsaved: boolean) {
  if (outcome !== null) {
    return outcome.is_correct
      ? 'Correct. This answer is locked.'
      : `Incorrect. The correct answer is ${outcome.correct_choice}. This answer is locked.`
  }
  if (isUnsaved) return 'Saving…'
  return selected === null ? '' : 'Answer saved.'
}
