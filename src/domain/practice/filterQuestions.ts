import type { Difficulty, Section } from '../content/types'

/** What is needed to choose questions, without their text. */
export interface QuestionSummary {
  id: string
  section: Section
  category_id: string
  difficulty: Difficulty
  passage_id: string | null
  /** The most recent attempt, or null if never submitted. */
  last_correct: boolean | null
  is_bookmarked: boolean
}

/** An empty list, or a missing section, means "any". */
export interface QuestionFilter {
  section: Section | null
  categoryIds: readonly string[]
  difficulties: readonly Difficulty[]
}

export const anyQuestion: QuestionFilter = { section: null, categoryIds: [], difficulties: [] }

/** Questions matching every part of the filter, in their original order. */
export function filterQuestions<T extends QuestionSummary>(
  questions: readonly T[],
  { section, categoryIds, difficulties }: QuestionFilter,
): T[] {
  return questions.filter(
    (question) =>
      (section === null || question.section === section) &&
      (categoryIds.length === 0 || categoryIds.includes(question.category_id)) &&
      (difficulties.length === 0 || difficulties.includes(question.difficulty)),
  )
}
