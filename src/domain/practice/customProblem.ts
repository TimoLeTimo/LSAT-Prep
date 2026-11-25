import type { CustomFilter, CustomPool } from './chooseCustom'

export const MAX_LR = 500
export const MAX_PASSAGES = 50
const MAX_QUESTIONS = 500

const subsetWords: Record<CustomFilter['subset'], string> = {
  any: 'matching',
  new: 'new',
  missed: 'missed',
  bookmarked: 'bookmarked',
}

const plural = (number: number, noun: string) => `${number} ${noun}${number === 1 ? '' : 's'}`

export interface CustomProblems {
  lr: string | null
  passages: string | null
  /** About the session as a whole. */
  overall: string | null
}

/** Plain-language reasons a custom session cannot start. Null counts are not numbers. */
export function customProblems(
  pool: CustomPool,
  subset: CustomFilter['subset'],
  lrCount: number | null,
  passageCount: number | null,
): CustomProblems {
  const word = subsetWords[subset]
  const check = (wanted: number | null, available: number, max: number, noun: string) => {
    if (wanted === null || wanted > max) return `Enter a number from 0 to ${max}.`
    if (wanted <= available) return null
    if (available > 0) return `Only ${plural(available, `${word} ${noun}`)} available.`
    const reading = noun === 'passage' ? 'Reading Comprehension passages' : 'Logical Reasoning questions'
    return subset === 'any'
      ? `No ${reading} match your choices.`
      : noun === 'passage'
        ? `You have no ${reading} with ${word} questions that match.`
        : `You have no ${word} ${reading} that match.`
  }
  const lr = check(lrCount, pool.lrIds.length, MAX_LR, 'question')
  const passages = check(passageCount, pool.passages.length, MAX_PASSAGES, 'passage')
  let overall: string | null = null
  if (lr === null && passages === null) {
    if (lrCount === 0 && passageCount === 0) {
      const isEmpty = pool.lrIds.length + pool.passages.length === 0
      overall = !isEmpty
        ? 'Choose at least one question or passage.'
        : subset === 'any'
          ? 'No questions match your choices.'
          : `You have no ${word} questions that match.`
    } else if (largestSize(pool, lrCount ?? 0, passageCount ?? 0) > MAX_QUESTIONS) {
      overall = `A session can have up to ${MAX_QUESTIONS} questions. Choose fewer.`
    }
  }
  return { lr, passages, overall }
}

/** The most questions this choice could produce, since passages differ in length. */
function largestSize({ passages }: CustomPool, lrCount: number, passageCount: number) {
  const longest = passages.map((ids) => ids.length).toSorted((a, b) => b - a)
  return lrCount + longest.slice(0, passageCount).reduce((sum, length) => sum + length, 0)
}
