import { filterQuestions, type QuestionFilter, type QuestionSummary } from './filterQuestions'

export type ChosenQuestions =
  | { ok: true; ids: string[] }
  | { ok: false; reason: 'invalid_count' }
  | { ok: false; reason: 'not_enough'; available: number }

/**
 * Picks different questions at random. Never repeats a question to make up the number.
 * For Logical Reasoning only: RC questions must stay with their passage.
 */
export function chooseQuestions(
  questions: readonly QuestionSummary[],
  filter: QuestionFilter,
  count: number,
  random: () => number = Math.random,
): ChosenQuestions {
  if (!Number.isInteger(count) || count < 1) return { ok: false, reason: 'invalid_count' }
  const pool = filterQuestions(questions, filter).map(({ id }) => id)
  if (pool.length < count) return { ok: false, reason: 'not_enough', available: pool.length }
  // Fisher–Yates shuffle, stopping once enough have been picked.
  for (let index = 0; index < count; index++) {
    const other = index + Math.floor(random() * (pool.length - index))
    ;[pool[index], pool[other]] = [pool[other], pool[index]]
  }
  return { ok: true, ids: pool.slice(0, count) }
}
