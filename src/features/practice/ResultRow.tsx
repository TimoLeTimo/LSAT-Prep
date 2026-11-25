import type { SessionQuestion } from '../../data/practiceSession'
import { resultText } from './resultText'

interface ResultRowProps {
  id?: string
  question: SessionQuestion
  number: number
  onClick: () => void
}

export function ResultRow({ id, question, number, onClick }: ResultRowProps) {
  const notes = [
    question.is_scored === false && 'Unscored',
    question.is_flagged && 'Flagged',
    question.is_bookmarked && 'Bookmarked',
  ].filter((note) => note !== false)
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer flex-wrap justify-between gap-x-6 px-6 py-3 text-left -outline-offset-2 hover:bg-blush"
    >
      <span>
        Question {number} <span className="text-muted">– {question.category_name}</span>
        {notes.length > 0 && <span className="text-rose-deep"> · {notes.join(' · ')}</span>}
      </span>
      <span className="font-medium">{resultText(question)}</span>
    </button>
  )
}
