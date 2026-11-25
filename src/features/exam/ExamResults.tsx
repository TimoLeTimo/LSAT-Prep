import { useEffect, useRef } from 'react'
import { Button } from '../../components/Button'
import { count } from '../../components/count'
import type { Exam } from '../../data/exam'
import { sectionNames } from '../../domain/content/names'
import { score } from '../practice/score'

/** Raw scores only. The full review is a later part of the milestone. */
export function ExamResults({ exam, onDone }: { exam: Exam; onDone: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    window.scrollTo(0, 0)
    heading.current?.focus()
  }, [])

  const { questions } = exam.session
  const scored = questions.filter(({ is_scored }) => is_scored === true)
  const total = score(scored)
  return (
    <div className="mx-auto max-w-3xl">
      <h2 ref={heading} tabIndex={-1} className="font-serif text-2xl font-semibold outline-none">
        {exam.session.config.exam?.name ?? 'Test'}: Results
      </h2>
      <div className="mt-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
        <p className="text-xl font-medium">
          Raw score: {total.correct} of {scored.length} scored questions
        </p>
        {total.unanswered > 0 && (
          <p className="mt-1 text-muted">{count(total.unanswered, 'scored question')} not answered</p>
        )}
      </div>
      <ol className="mt-6 divide-y divide-line rounded-2xl border border-line bg-surface shadow-card">
        {exam.sections.map(({ position, section }) => {
          const inSection = questions.filter(({ exam_section }) => exam_section === position)
          const counted = inSection.filter(({ is_scored }) => is_scored === true)
          const isUnscored = counted.length === 0
          const extra = inSection.length - counted.length
          const part = score(isUnscored ? inSection : counted)
          const size = isUnscored ? inSection.length : counted.length
          return (
            <li key={position} className="flex flex-wrap justify-between gap-x-6 px-6 py-3">
              <span>
                Section {position + 1}{' '}
                <span className="text-muted">
                  – {sectionNames[section]}
                  {isUnscored && ' (unscored)'}
                </span>
              </span>
              <span className="font-medium">
                {part.correct} of {size} correct
                {part.unanswered > 0 && `, ${part.unanswered} not answered`}
                {!isUnscored && extra > 0 && (
                  <span className="font-normal text-muted"> (plus {extra} unscored)</span>
                )}
              </span>
            </li>
          )
        })}
      </ol>
      <div className="mt-6">
        <Button onClick={onDone}>Done</Button>
      </div>
    </div>
  )
}
