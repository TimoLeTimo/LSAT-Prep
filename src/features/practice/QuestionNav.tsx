import type { SessionQuestion } from '../../data/practiceSession'
import { groupByPassage } from './groupByPassage'

interface QuestionNavProps {
  questions: readonly SessionQuestion[]
  position: number
  onGoTo: (position: number) => void
}

export function QuestionNav({ questions, position, onGoTo }: QuestionNavProps) {
  const answered = questions.filter(({ selected }) => selected !== null).length
  return (
    <nav aria-label="Questions">
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {groupByPassage(questions).map(({ passageId, positions }, group) => (
          <div key={positions[0]}>
            {passageId !== null && (
              <p id={`passage-group-${group}`} className="mb-1 text-sm text-muted">
                Passage {group + 1}
              </p>
            )}
            <ol
              aria-labelledby={passageId === null ? undefined : `passage-group-${group}`}
              className="flex flex-wrap gap-2"
            >
              {positions.map((index) => (
                <li key={questions[index].id}>
                  <NumberButton
                    question={questions[index]}
                    index={index}
                    isCurrent={index === position}
                    onClick={() => onGoTo(index)}
                  />
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted">
        {answered} of {questions.length} answered
      </p>
    </nav>
  )
}

interface NumberButtonProps {
  question: SessionQuestion
  index: number
  isCurrent: boolean
  onClick: () => void
}

function NumberButton({ question, index, isCurrent, onClick }: NumberButtonProps) {
  const isAnswered = question.selected !== null
  const details = [
    isAnswered ? 'answered' : 'not answered',
    ...(question.is_flagged ? ['flagged'] : []),
  ]
  return (
    <button
      type="button"
      aria-label={`Question ${index + 1}, ${details.join(', ')}`}
      aria-current={isCurrent ? 'step' : undefined}
      onClick={onClick}
      className={`relative size-10 cursor-pointer rounded-lg border text-sm font-medium aria-[current]:ring-2 aria-[current]:ring-rose-deep ${
        isAnswered
          ? 'border-rose-accent bg-blush text-rose-deep'
          : 'border-line bg-surface text-muted hover:bg-blush'
      }`}
    >
      {index + 1}
      {question.is_flagged && (
        <span aria-hidden="true" className="absolute -top-1.5 -right-1 text-rose-deep">
          ⚑
        </span>
      )}
    </button>
  )
}
