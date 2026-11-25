import type { SessionQuestion } from '../../data/practiceSession'

/** Unanswered questions are counted separately and do not lower accuracy. */
export function score(questions: readonly SessionQuestion[]) {
  const answered = questions.filter(({ is_submitted }) => is_submitted)
  const correct = answered.filter(({ outcome }) => outcome?.is_correct === true)
  return {
    correct: correct.length,
    answered: answered.length,
    unanswered: questions.length - answered.length,
  }
}
