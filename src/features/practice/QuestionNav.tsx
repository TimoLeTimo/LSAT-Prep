import type { SessionQuestion } from '../../data/practiceSession'

interface QuestionNavProps {
  questions: readonly SessionQuestion[]
  position: number
  onGoTo: (position: number) => void
}

export function QuestionNav({ questions, position, onGoTo }: QuestionNavProps) {
  const answered = questions.filter(({ selected }) => selected !== null).length
  return (
    <nav aria-label="Questions">
      <ol className="flex flex-wrap gap-2">
        {questions.map(({ id, selected, is_flagged }, index) => {
          const isAnswered = selected !== null
          const details = [isAnswered ? 'answered' : 'not answered', ...(is_flagged ? ['flagged'] : [])]
          return (
            <li key={id}>
              <button
                type="button"
                aria-label={`Question ${index + 1}, ${details.join(', ')}`}
                aria-current={index === position ? 'step' : undefined}
                onClick={() => onGoTo(index)}
                className={`relative size-10 cursor-pointer rounded-lg border text-sm font-medium aria-[current]:ring-2 aria-[current]:ring-rose-deep ${
                  isAnswered
                    ? 'border-rose-accent bg-blush text-rose-deep'
                    : 'border-line bg-surface text-muted hover:bg-blush'
                }`}
              >
                {index + 1}
                {is_flagged && (
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1 text-rose-deep">
                    ⚑
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-sm text-muted">
        {answered} of {questions.length} answered
      </p>
    </nav>
  )
}
