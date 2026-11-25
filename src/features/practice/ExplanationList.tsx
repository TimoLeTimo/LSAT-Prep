import type { SessionQuestion } from '../../data/practiceSession'
import { CHOICE_LABELS } from '../../domain/content/types'

/** Opens the correct answer and the user's own; the others are one click away. */
export function ExplanationList({ question }: { question: SessionQuestion }) {
  const { outcome, selected } = question
  if (outcome === null) return null
  return (
    <section aria-labelledby="explanations" className="mt-8">
      <h3 id="explanations" className="font-serif text-xl font-semibold">
        Explanations
      </h3>
      <div className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {CHOICE_LABELS.map((label) => {
          const isCorrect = outcome.correct_choice === label
          const isSelected = selected === label
          const notes = [isCorrect && 'correct answer', isSelected && 'your answer'].filter(Boolean)
          return (
            // The key resets which ones are open when the question changes.
            <details key={`${question.id}-${label}`} open={isCorrect || isSelected} className="px-5 py-3">
              <summary className="cursor-pointer rounded-md font-medium">
                {label}
                {notes.length > 0 && (
                  <span className="font-normal text-rose-deep"> – {notes.join(', ')}</span>
                )}
              </summary>
              <p className="mt-2 leading-relaxed whitespace-pre-line wrap-anywhere">
                {outcome.explanations[label]}
              </p>
            </details>
          )
        })}
      </div>
    </section>
  )
}
