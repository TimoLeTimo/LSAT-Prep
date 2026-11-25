import { describe, expect, it } from 'vitest'
import { anyQuestion, filterQuestions, type QuestionFilter, type QuestionSummary } from './filterQuestions'

const lr = (id: string, category_id: string, difficulty: 1 | 2 | 3 | 4): QuestionSummary => ({
  id,
  section: 'logical_reasoning',
  category_id,
  difficulty,
  passage_id: null,
  last_correct: null,
  is_bookmarked: false,
})

const questions: QuestionSummary[] = [
  lr('a', 'lr-flaw', 1),
  lr('b', 'lr-flaw', 3),
  lr('c', 'lr-weaken', 1),
  { id: 'd', section: 'reading_comprehension', category_id: 'rc-detail', difficulty: 1, passage_id: 'p', last_correct: null, is_bookmarked: false },
]

describe('filterQuestions', () => {
  it.each<[string, Partial<QuestionFilter>, string]>([
    ['everything', {}, 'abcd'],
    ['a section', { section: 'logical_reasoning' }, 'abc'],
    ['a category', { categoryIds: ['lr-flaw'] }, 'ab'],
    ['several categories', { categoryIds: ['lr-weaken', 'rc-detail'] }, 'cd'],
    ['a difficulty', { difficulties: [1] }, 'acd'],
    ['several difficulties', { difficulties: [1, 3] }, 'abcd'],
    ['all parts together', { section: 'logical_reasoning', categoryIds: ['lr-flaw'], difficulties: [1] }, 'a'],
    ['a category from the other section', { section: 'reading_comprehension', categoryIds: ['lr-flaw'] }, ''],
    ['an unknown category', { categoryIds: ['missing'] }, ''],
    ['an unused difficulty', { difficulties: [4] }, ''],
  ])('filters by %s', (_, filter, expected) => {
    const found = filterQuestions(questions, { ...anyQuestion, ...filter })
    expect(found.map(({ id }) => id).join('')).toBe(expected)
  })

  it('does not change its input', () => {
    const before = structuredClone(questions)
    filterQuestions(questions, { ...anyQuestion, difficulties: [1] })
    expect(questions).toEqual(before)
  })
})
