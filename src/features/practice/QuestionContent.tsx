import type { SessionQuestion } from '../../data/practiceSession'

/** Package text is always shown as plain text. */
export function QuestionContent({ question }: { question: SessionQuestion }) {
  return (
    <div className="mt-5 space-y-5 text-lg leading-relaxed whitespace-pre-line wrap-anywhere">
      {question.stimulus !== null && <p>{question.stimulus}</p>}
      <p id="prompt" className="font-medium">
        {question.prompt}
      </p>
    </div>
  )
}
