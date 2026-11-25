import type { SessionRecord } from '../../data/records'
import { FEW_ANSWERS, percent } from '../../domain/statistics/format'

interface ExamListProps {
  exams: readonly SessionRecord[]
  onOpen: (exam: SessionRecord) => void
}

export function ExamList({ exams, onOpen }: ExamListProps) {
  if (exams.length === 0) return <p className="text-muted">No finished tests.</p>
  return (
    <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {exams.map((exam) => (
        <li key={exam.id}>
          <button
            type="button"
            onClick={() => onOpen(exam)}
            className="flex w-full cursor-pointer flex-wrap justify-between gap-x-6 px-5 py-3 text-left -outline-offset-2 hover:bg-blush"
          >
            <span className="wrap-anywhere">
              {exam.name}
              {exam.completed_at !== null && (
                <span className="block text-sm text-muted">
                  {new Date(exam.completed_at).toLocaleString()}
                </span>
              )}
            </span>
            <span className="font-medium tabular-nums">
              {exam.scored_correct} of {exam.scored_questions} (
              {percent(exam.scored_questions === 0 ? null : exam.scored_correct / exam.scored_questions)}
              )
              {exam.scored_questions < FEW_ANSWERS && (
                <span className="block text-right text-sm font-normal text-muted">Few questions</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}
