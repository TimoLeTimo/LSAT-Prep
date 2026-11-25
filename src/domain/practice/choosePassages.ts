import { filterQuestions, type QuestionFilter, type QuestionSummary } from './filterQuestions'
import { pickRandom } from './shuffle'

/** A passage with every question that can be practiced, in order. */
export interface PassageSet {
  passageId: string
  questionIds: string[]
}

export type ChosenPassages =
  | { ok: true; sets: PassageSet[]; questionIds: string[] }
  | { ok: false; reason: 'invalid_count' }
  | { ok: false; reason: 'not_enough'; available: number }

/**
 * Passages with at least one question matching the filter. Each keeps all of its
 * questions, including those that do not match.
 */
export function findPassageSets(
  questions: readonly QuestionSummary[],
  filter: QuestionFilter,
): PassageSet[] {
  const matching = new Set(filterQuestions(questions, filter).map(({ passage_id }) => passage_id))
  const sets = new Map<string, PassageSet>()
  for (const { id, passage_id } of questions) {
    if (passage_id === null || !matching.has(passage_id)) continue
    const set = sets.get(passage_id) ?? { passageId: passage_id, questionIds: [] }
    set.questionIds.push(id)
    sets.set(passage_id, set)
  }
  return [...sets.values()]
}

/** Picks different passages at random. Never repeats or splits one. */
export function choosePassages(
  questions: readonly QuestionSummary[],
  filter: QuestionFilter,
  count: number,
  random: () => number = Math.random,
): ChosenPassages {
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: 'invalid_count' }
  const available = findPassageSets(questions, filter)
  if (available.length < count) {
    return { ok: false, reason: 'not_enough', available: available.length }
  }
  const sets = pickRandom(available, count, random)
  return { ok: true, sets, questionIds: sets.flatMap(({ questionIds }) => questionIds) }
}
