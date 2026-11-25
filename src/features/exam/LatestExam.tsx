import { Button } from '../../components/Button'
import type { Exam } from '../../data/exam'
import { score } from '../practice/score'

/** Keeps the last results within reach, even if the exam ended while the user was away. */
export function LatestExam({ exam, onView }: { exam: Exam; onView: () => void }) {
  const { config, completed_at, questions } = exam.session
  const scored = questions.filter(({ is_scored }) => is_scored === true)
  return (
    <section
      aria-labelledby="latest-exam"
      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-8 py-6 shadow-card"
    >
      <div>
        <h2 id="latest-exam" className="font-semibold">
          Last finished: {config.exam?.name}
        </h2>
        <p className="text-muted">
          {score(scored).correct} of {scored.length} scored questions correct
          {completed_at !== null && `, ${new Date(completed_at).toLocaleString()}`}
        </p>
      </div>
      <Button variant="secondary" onClick={onView}>
        View Results
      </Button>
    </section>
  )
}
