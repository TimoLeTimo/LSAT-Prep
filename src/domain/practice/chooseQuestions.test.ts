import { expect, it } from 'vitest'
import { chooseQuestions } from './chooseQuestions'
import { anyQuestion, type QuestionSummary } from './filterQuestions'

const questions = Array.from({ length: 10 }, (_, index): QuestionSummary => ({
  id: `q${index}`,
  section: 'logical_reasoning',
  category_id: index < 4 ? 'lr-flaw' : 'lr-weaken',
  difficulty: 2,
  passage_id: null,
  last_correct: null,
  is_bookmarked: false,
}))
const flaws = { ...anyQuestion, categoryIds: ['lr-flaw'] }

function idsOf(result: ReturnType<typeof chooseQuestions>) {
  if (!result.ok) throw new Error(result.reason)
  return result.ids
}

it('picks the requested number without repeats', () => {
  for (let run = 0; run < 200; run++) {
    const ids = idsOf(chooseQuestions(questions, anyQuestion, 6))
    expect(new Set(ids).size).toBe(6)
  }
})

it('picks only matching questions, and can use all of them', () => {
  expect(idsOf(chooseQuestions(questions, flaws, 4)).toSorted()).toEqual(['q0', 'q1', 'q2', 'q3'])
})

it('reports how many are available instead of repeating any', () => {
  expect(chooseQuestions(questions, flaws, 5)).toEqual({ ok: false, reason: 'not_enough', available: 4 })
  expect(chooseQuestions([], anyQuestion, 1)).toEqual({ ok: false, reason: 'not_enough', available: 0 })
})

it.each([0, -1, 1.5, Number.NaN, Infinity])('refuses a count of %s', (count) => {
  expect(chooseQuestions(questions, anyQuestion, count).ok).toBe(false)
})

it('gives every question about the same chance in every position', () => {
  const runs = 20_000
  const seen = new Map<string, number>()
  for (let run = 0; run < runs; run++) {
    idsOf(chooseQuestions(questions, flaws, 2)).forEach((id, position) => {
      const key = `${id}@${position}`
      seen.set(key, (seen.get(key) ?? 0) + 1)
    })
  }
  expect(seen.size).toBe(8)
  for (const times of seen.values()) expect(Math.abs(times / runs - 0.25)).toBeLessThan(0.03)
})

it('stays in range at the edges of the random numbers', () => {
  for (const value of [0, 0.999999999]) {
    expect(new Set(idsOf(chooseQuestions(questions, anyQuestion, 10, () => value))).size).toBe(10)
  }
})

it('does not change its input', () => {
  const before = structuredClone(questions)
  chooseQuestions(questions, anyQuestion, 10)
  expect(questions).toEqual(before)
})
