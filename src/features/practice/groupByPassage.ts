import type { SessionQuestion } from '../../data/practiceSession'

export interface QuestionGroup {
  passageId: string | null
  /** Positions in the session. */
  positions: number[]
}

/** Consecutive questions on the same passage. LR questions form one group. */
export function groupByPassage(questions: readonly SessionQuestion[]): QuestionGroup[] {
  const groups: QuestionGroup[] = []
  questions.forEach(({ passage }, position) => {
    const passageId = passage?.id ?? null
    const last = groups.at(-1)
    if (last?.passageId === passageId) last.positions.push(position)
    else groups.push({ passageId, positions: [position] })
  })
  return groups
}
