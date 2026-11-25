import type { SessionQuestion } from '../../data/practiceSession'
import { sectionNames } from '../../domain/content/names'

export interface QuestionGroup {
  /** Null when the session has only LR questions, which need no heading. */
  label: string | null
  /** Positions in the session. */
  positions: number[]
}

/** Consecutive questions on the same passage. LR questions form one group. */
export function groupByPassage(questions: readonly SessionQuestion[]): QuestionGroup[] {
  const groups: (QuestionGroup & { passageId: string | null })[] = []
  const hasPassages = questions.some(({ passage }) => passage !== null)
  let passages = 0
  questions.forEach(({ passage }, position) => {
    const passageId = passage?.id ?? null
    const last = groups.at(-1)
    if (last?.passageId === passageId) {
      last.positions.push(position)
      return
    }
    const lrLabel = hasPassages ? sectionNames.logical_reasoning : null
    const label = passageId === null ? lrLabel : `Passage ${++passages}`
    groups.push({ passageId, label, positions: [position] })
  })
  return groups.map(({ label, positions }) => ({ label, positions }))
}
