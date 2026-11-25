import type { SessionQuestion } from '../../data/practiceSession'
import { groupByPassage } from '../practice/groupByPassage'

export const reviewFilters = ['all', 'incorrect', 'unanswered', 'flagged'] as const
export type ReviewFilter = (typeof reviewFilters)[number]

export function matchesFilter(question: SessionQuestion, filter: ReviewFilter): boolean {
  const { outcome, is_flagged } = question
  switch (filter) {
    case 'all':
      return true
    case 'incorrect':
      return outcome?.is_correct === false
    case 'unanswered':
      return outcome !== null && outcome.is_correct === null
    case 'flagged':
      return is_flagged
  }
}

export interface ReviewItem {
  /** Position in the whole exam. */
  position: number
  /** Number within its section, which a filter does not change. */
  number: number
}

export interface ReviewGroup {
  /** The passage, for RC. */
  label: string | null
  items: ReviewItem[]
}

/** A section's matching questions, grouped by passage. Empty groups are left out. */
export function reviewGroups(
  questions: readonly SessionQuestion[],
  section: number,
  filter: ReviewFilter,
): ReviewGroup[] {
  const inSection = questions.flatMap((question, position) =>
    question.exam_section === section ? [{ question, position }] : [],
  )
  return groupByPassage(inSection.map(({ question }) => question))
    .map(({ label, positions }) => ({
      label,
      items: positions
        .filter((index) => matchesFilter(inSection[index].question, filter))
        .map((index) => ({ position: inSection[index].position, number: index + 1 })),
    }))
    .filter(({ items }) => items.length > 0)
}

/** Every matching position, in exam order, for stepping through the review. */
export function reviewPositions(
  questions: readonly SessionQuestion[],
  filter: ReviewFilter,
): number[] {
  return questions.flatMap((question, position) =>
    matchesFilter(question, filter) ? [position] : [],
  )
}
