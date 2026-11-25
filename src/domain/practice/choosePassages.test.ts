import { describe, expect, it } from 'vitest'
import { choosePassages, findPassageSets } from './choosePassages'
import { anyQuestion, type QuestionFilter, type QuestionSummary } from './filterQuestions'

const rc = (id: string, passage_id: string, category_id: string, difficulty: 1 | 2 | 3 | 4): QuestionSummary => ({
  id,
  section: 'reading_comprehension',
  category_id,
  difficulty,
  passage_id,
  last_correct: null,
  is_bookmarked: false,
})

// IDs are out of order on purpose: the list order is what counts.
const questions: QuestionSummary[] = [
  rc('z', 'p1', 'rc-detail', 1),
  { id: 'lr', section: 'logical_reasoning', category_id: 'lr-flaw', difficulty: 1, passage_id: null, last_correct: null, is_bookmarked: false },
  rc('b', 'p2', 'rc-detail', 1),
  rc('a', 'p1', 'rc-main-idea', 3),
  rc('c', 'p2', 'rc-structure', 4),
  rc('m', 'p1', 'rc-detail', 2),
  rc('k', 'p3', 'rc-inference', 2),
]
const inRc: QuestionFilter = { ...anyQuestion, section: 'reading_comprehension' }
const summary = (filter: QuestionFilter) =>
  findPassageSets(questions, filter).map(({ passageId, questionIds }) => `${passageId}:${questionIds.join('')}`)

describe('findPassageSets', () => {
  it.each<[string, Partial<QuestionFilter>, string[]]>([
    ['everything', {}, ['p1:zam', 'p2:bc', 'p3:k']],
    ['a category, keeping the other questions', { categoryIds: ['rc-main-idea'] }, ['p1:zam']],
    ['a category in several passages', { categoryIds: ['rc-detail'] }, ['p1:zam', 'p2:bc']],
    ['a difficulty', { difficulties: [4] }, ['p2:bc']],
    ['both on the same question', { categoryIds: ['rc-main-idea'], difficulties: [1] }, []],
    ['another section', { section: 'logical_reasoning' }, []],
  ])('finds passages by %s', (_, filter, expected) => {
    expect(summary({ ...inRc, ...filter })).toEqual(expected)
  })

  it('never includes LR questions', () => {
    expect(summary(anyQuestion)).toEqual(['p1:zam', 'p2:bc', 'p3:k'])
  })
})

describe('choosePassages', () => {
  const whole = ['zam', 'bc', 'k']

  it('keeps each passage whole, in order, and without repeats', () => {
    for (let run = 0; run < 200; run++) {
      const chosen = choosePassages(questions, inRc, 2)
      if (!chosen.ok) throw new Error(chosen.reason)
      const sets = chosen.sets.map(({ questionIds }) => questionIds.join(''))
      expect(new Set(sets).size).toBe(2)
      for (const set of sets) expect(whole).toContain(set)
      expect(chosen.questionIds.join('')).toBe(sets.join(''))
    }
  })

  it('varies which passages come first', () => {
    const first = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const chosen = choosePassages(questions, inRc, 3)
      if (chosen.ok) first.add(chosen.sets[0].passageId)
    }
    expect(first.size).toBe(3)
  })

  it('reports how many passages are available', () => {
    expect(choosePassages(questions, inRc, 4)).toEqual({ ok: false, reason: 'not_enough', available: 3 })
  })

  it.each([0, -1, 1.5, Number.NaN])('refuses a count of %s', (count) => {
    expect(choosePassages(questions, inRc, count)).toEqual({ ok: false, reason: 'invalid_count' })
  })

  it('does not change its input', () => {
    const before = structuredClone(questions)
    choosePassages(questions, inRc, 3)
    expect(questions).toEqual(before)
  })
})
