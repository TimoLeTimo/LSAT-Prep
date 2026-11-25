import type { SessionQuestion } from '../../data/practiceSession'
import type { ChoiceLabel } from '../../domain/content/types'

interface ChoiceListProps {
  question: SessionQuestion
  isDisabled: boolean
  onSelect: (choice: ChoiceLabel) => void
}

export function ChoiceList({ question, isDisabled, onSelect }: ChoiceListProps) {
  const { choices, selected, outcome } = question
  return (
    <div role="group" aria-labelledby="prompt" className="mt-6 space-y-3">
      {choices.map(({ label, text }) => {
        const isSelected = selected === label
        const isCorrect = outcome?.correct_choice === label
        const note = isCorrect ? 'Correct answer' : outcome && isSelected ? 'Your answer' : null
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isSelected}
            // Not `disabled`, so a locked answer can still be reached and read by keyboard.
            aria-disabled={isDisabled}
            onClick={() => {
              if (!isDisabled) onSelect(label)
            }}
            className={`flex w-full items-start gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${
              isSelected ? 'border-rose-accent bg-blush' : 'border-line bg-surface'
            } ${isDisabled ? 'cursor-default' : 'cursor-pointer hover:border-rose-accent'}`}
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border font-semibold ${
                isSelected ? 'border-rose-accent bg-rose-accent text-white' : 'border-line text-muted'
              }`}
            >
              {label}
            </span>
            <span className="min-w-0 flex-1 pt-0.5 whitespace-pre-line wrap-anywhere">
              {text}
              {note !== null && (
                <span className="mt-1 block text-sm font-semibold text-rose-deep">
                  {isCorrect ? '✓ ' : '✗ '}
                  {note}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
