import type { SessionQuestion } from '../../data/practiceSession'

/** How a question turned out, once its outcome can be shown. */
export function resultText({ outcome, selected }: SessionQuestion): string {
  if (outcome === null || outcome.is_correct === null) return 'Not answered'
  if (outcome.is_correct) return `✓ Correct (${selected})`
  return `✗ Incorrect (${selected}; correct answer ${outcome.correct_choice})`
}
