import type { Difficulty, Section } from '../content/types'
import type { QuestionSummary } from './filterQuestions'
import { pickRandom } from './shuffle'

export interface CustomFilter {
  /** Chosen categories apply within their own section. None chosen means any. */
  categories: readonly { id: string; section: Section }[]
  /** Empty means any. */
  difficulties: readonly Difficulty[]
  subset: 'any' | 'new' | 'missed' | 'bookmarked'
  /** Leaves out questions whose most recent attempt was right. */
  excludeCorrect: boolean
}

export interface CustomRequest {
  lrCount: number
  passageCount: number
  shuffleQuestions: boolean
}

export interface CustomPool {
  lrIds: string[]
  /** Whole passages, each with all of its questions in order. */
  passages: string[][]
}

export type ChosenCustom =
  | { ok: true; ids: string[] }
  | { ok: false; reason: 'invalid_count' }
  | { ok: false; reason: 'not_enough'; availableLr: number; availablePassages: number }

function matches(question: QuestionSummary, filter: CustomFilter): boolean {
  const { categories, difficulties, subset, excludeCorrect } = filter
  const inSection = categories.filter(({ section }) => section === question.section)
  if (inSection.length > 0 && !inSection.some(({ id }) => id === question.category_id)) return false
  if (difficulties.length > 0 && !difficulties.includes(question.difficulty)) return false
  if (excludeCorrect && question.last_correct === true) return false
  switch (subset) {
    case 'any':
      return true
    case 'new':
      return question.last_correct === null
    case 'missed':
      return question.last_correct === false
    case 'bookmarked':
      return question.is_bookmarked
  }
}

/** Everything that qualifies. A passage qualifies if any of its questions does. */
export function findCustomPool(
  questions: readonly QuestionSummary[],
  filter: CustomFilter,
): CustomPool {
  const qualifying = questions.filter((question) => matches(question, filter))
  const passageIds = new Set(qualifying.map(({ passage_id }) => passage_id))
  const passages = new Map<string, string[]>()
  for (const { id, passage_id } of questions) {
    if (passage_id === null || !passageIds.has(passage_id)) continue
    const ids = passages.get(passage_id) ?? []
    ids.push(id)
    passages.set(passage_id, ids)
  }
  return {
    lrIds: qualifying.filter(({ section }) => section === 'logical_reasoning').map(({ id }) => id),
    passages: [...passages.values()],
  }
}

/**
 * LR questions first, then whole passages. Which ones are chosen is always random;
 * `shuffleQuestions` decides whether they also appear in random order.
 */
export function chooseCustom(
  pool: CustomPool,
  { lrCount, passageCount, shuffleQuestions }: CustomRequest,
  random: () => number = Math.random,
): ChosenCustom {
  const isCount = (value: number) => Number.isInteger(value) && value >= 0
  if (!isCount(lrCount) || !isCount(passageCount) || lrCount + passageCount === 0) {
    return { ok: false, reason: 'invalid_count' }
  }
  const { lrIds, passages } = pool
  if (lrIds.length < lrCount || passages.length < passageCount) {
    return {
      ok: false,
      reason: 'not_enough',
      availableLr: lrIds.length,
      availablePassages: passages.length,
    }
  }
  const pick = <T>(items: readonly T[], count: number): T[] => {
    const picked = pickRandom(items, count, random)
    if (shuffleQuestions) return picked
    const chosen = new Set(picked)
    return items.filter((item) => chosen.has(item))
  }
  return { ok: true, ids: [...pick(lrIds, lrCount), ...pick(passages, passageCount).flat()] }
}
