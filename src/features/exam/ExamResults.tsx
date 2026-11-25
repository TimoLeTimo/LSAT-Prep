import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { Exam } from '../../data/exam'
import { practiceSession } from '../../data/practiceSession'
import { sectionNames } from '../../domain/content/names'
import { ResultRow } from '../practice/ResultRow'
import { SaveError } from '../practice/SaveError'
import { score } from '../practice/score'
import { SessionController } from '../practice/SessionController'
import { SessionReview } from '../practice/SessionReview'
import { useSessionState } from '../practice/useSessionState'
import {
  matchesFilter,
  reviewFilters,
  reviewGroups,
  reviewPositions,
  type ReviewFilter,
} from './examReview'

const filterNames: Record<ReviewFilter, string> = {
  all: 'All',
  incorrect: 'Incorrect',
  unanswered: 'Not answered',
  flagged: 'Flagged',
}

interface ExamResultsProps {
  exam: Exam
  onDone: () => void
}

/** Raw scores by section, and review of every question. */
export function ExamResults({ exam, onDone }: ExamResultsProps) {
  const [controller] = useState(() => new SessionController(practiceSession, exam.session))
  const state = useSessionState(controller)
  const [scrollPositions] = useState(() => new Map<string, number>())
  const [filter, setFilter] = useState<ReviewFilter>('all')
  const [openSections, setOpenSections] = useState<ReadonlySet<number>>(new Set())
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [lastReviewed, setLastReviewed] = useState<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const { questions } = state.session

  // Start at the heading, or return to the question that was being reviewed.
  useEffect(() => {
    if (reviewing !== null) return
    const row = lastReviewed === null ? null : document.getElementById(`result-${lastReviewed}`)
    if (row !== null) {
      row.focus()
      row.scrollIntoView({ block: 'center' })
    } else {
      window.scrollTo(0, 0)
      heading.current?.focus()
    }
  }, [reviewing, lastReviewed])

  if (reviewing !== null) {
    const section = questions[reviewing].exam_section ?? 0
    const first = questions.findIndex(({ exam_section }) => exam_section === section)
    return (
      <SessionReview
        controller={controller}
        state={state}
        position={reviewing}
        positions={reviewPositions(questions, filter)}
        title={`Review: Section ${section + 1}, Question ${reviewing - first + 1}`}
        scrollPositions={scrollPositions}
        onGoTo={setReviewing}
        onBack={() => {
          setLastReviewed(reviewing)
          setOpenSections(new Set(openSections).add(section))
          setReviewing(null)
        }}
      />
    )
  }

  const scored = questions.filter(({ is_scored }) => is_scored === true)
  const total = score(scored)

  function chooseFilter(next: ReviewFilter) {
    setFilter(next)
    setLastReviewed(null)
    // A filter's matches are few, so they are shown at once.
    const all = exam.sections.map(({ position }) => position)
    setOpenSections(new Set(next === 'all' ? [] : all))
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
        {exam.session.config.exam?.name ?? 'Test'}: Results
      </h2>
      <SaveError error={state.error} onDismiss={controller.dismissError} />
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="text-xl font-medium">
          Raw score: {total.correct} of {count(scored.length, 'scored question')}
        </p>
        {total.unanswered > 0 && (
          <p className="mt-1 text-muted">{count(total.unanswered, 'scored question')} not answered</p>
        )}
      </div>

      <div role="group" aria-label="Show" className="mt-6 flex flex-wrap gap-2">
        {reviewFilters.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={filter === item}
            onClick={() => chooseFilter(item)}
            className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium hover:bg-blush aria-pressed:border-rose-accent aria-pressed:bg-blush aria-pressed:text-rose-deep"
          >
            {filterNames[item]} (
            {questions.filter((question) => matchesFilter(question, item)).length})
          </button>
        ))}
      </div>
      <p className="mt-3 text-muted">Open a section, then choose a question to review it.</p>

      <div className="mt-3 space-y-4">
        {exam.sections.map(({ position, section }) => (
          <details
            key={position}
            open={openSections.has(position)}
            onToggle={(event) => {
              const next = new Set(openSections)
              if (event.currentTarget.open) next.add(position)
              else next.delete(position)
              if (next.has(position) !== openSections.has(position)) setOpenSections(next)
            }}
            className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
          >
            <summary className="cursor-pointer px-6 py-4 -outline-offset-2 hover:bg-blush">
              <SectionScore exam={exam} position={position} name={sectionNames[section]} />
            </summary>
            <div className="border-t border-line">
              {reviewGroups(questions, position, filter).map(({ label, items }) => (
                <div key={items[0].position}>
                  {label !== null && <h3 className="px-6 pt-4 pb-1 font-semibold">{label}</h3>}
                  <ol className="divide-y divide-line">
                    {items.map((item) => (
                      <li key={item.position}>
                        <ResultRow
                          id={`result-${item.position}`}
                          question={questions[item.position]}
                          number={item.number}
                          onClick={() => setReviewing(item.position)}
                        />
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
              {reviewGroups(questions, position, filter).length === 0 && (
                <p className="px-6 py-4 text-muted">No questions here match.</p>
              )}
            </div>
          </details>
        ))}
      </div>
      <div className="mt-6">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}

interface SectionScoreProps {
  exam: Exam
  position: number
  name: string
}

function SectionScore({ exam, position, name }: SectionScoreProps) {
  const inSection = exam.session.questions.filter(({ exam_section }) => exam_section === position)
  const counted = inSection.filter(({ is_scored }) => is_scored === true)
  const isUnscored = counted.length === 0
  const shown = isUnscored ? inSection : counted
  const extra = inSection.length - shown.length
  const { correct, unanswered } = score(shown)
  return (
    <span className="inline-flex w-[calc(100%-1.5rem)] flex-wrap justify-between gap-x-6 pl-2 align-top">
      <span>
        Section {position + 1}{' '}
        <span className="text-muted">
          – {name}
          {isUnscored && ' (unscored)'}
        </span>
      </span>
      <span className="font-medium">
        {correct} of {shown.length} correct
        {unanswered > 0 && `, ${unanswered} not answered`}
        {extra > 0 && <span className="font-normal text-muted"> (plus {extra} unscored)</span>}
      </span>
    </span>
  )
}
