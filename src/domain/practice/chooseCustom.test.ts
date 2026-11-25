import { describe, expect, it } from 'vitest'
import { chooseCustom, findCustomPool, type CustomFilter } from './chooseCustom'
import type { QuestionSummary } from './filterQuestions'

type History = Partial<Pick<QuestionSummary, 'last_correct' | 'is_bookmarked' | 'difficulty'>>

const lr = (id: string, category_id: string, history: History = {}): QuestionSummary => ({
  id,
  section: 'logical_reasoning',
  category_id,
  difficulty: 2,
  passage_id: null,
  last_correct: null,
  is_bookmarked: false,
  ...history,
})
const rc = (id: string, passage_id: string, category_id: string, history: History = {}): QuestionSummary => ({
  ...lr(id, category_id, history),
  section: 'reading_comprehension',
  passage_id,
})

const questions = [
  lr('1', 'lr-flaw', { last_correct: true }),
  lr('2', 'lr-flaw', { last_correct: false, is_bookmarked: true }),
  rc('z', 'p1', 'rc-detail', { last_correct: true }),
  rc('a', 'p1', 'rc-main', { last_correct: false }),
  lr('3', 'lr-weaken', { difficulty: 4 }),
  rc('b', 'p2', 'rc-detail', { is_bookmarked: true, last_correct: true }),
  rc('m', 'p1', 'rc-detail'),
  rc('c', 'p2', 'rc-structure', { last_correct: true }),
]
const any: CustomFilter = { categories: [], difficulties: [], subset: 'any', excludeCorrect: false }
const category = (id: string) => ({
  id,
  section: id.startsWith('lr') ? ('logical_reasoning' as const) : ('reading_comprehension' as const),
})

describe('findCustomPool', () => {
  it.each<[string, Partial<CustomFilter>, string, string[]]>([
    ['everything', {}, '123', ['zam', 'bc']],
    ['an LR category, leaving RC alone', { categories: [category('lr-flaw')] }, '12', ['zam', 'bc']],
    ['an RC category, leaving LR alone', { categories: [category('rc-main')] }, '123', ['zam']],
    ['both', { categories: [category('lr-weaken'), category('rc-structure')] }, '3', ['bc']],
    ['a difficulty', { difficulties: [4] }, '3', []],
    ['new', { subset: 'new' }, '3', ['zam']],
    ['missed', { subset: 'missed' }, '2', ['zam']],
    ['bookmarked', { subset: 'bookmarked' }, '2', ['bc']],
    ['not correct', { excludeCorrect: true }, '23', ['zam']],
    ['bookmarked and not correct', { subset: 'bookmarked', excludeCorrect: true }, '2', []],
    ['the same question must fit all', { subset: 'missed', categories: [category('rc-detail')] }, '2', []],
  ])('filters by %s', (_, filter, lrIds, passages) => {
    const pool = findCustomPool(questions, { ...any, ...filter })
    expect(pool.lrIds.join('')).toBe(lrIds)
    expect(pool.passages.map((ids) => ids.join(''))).toEqual(passages)
  })
})

describe('chooseCustom', () => {
  const pool = {
    lrIds: Array.from({ length: 10 }, (_, index) => `q${index}`),
    passages: [['z', 'a', 'm'], ['b', 'c'], ['k']],
  }
  const choose = (lrCount: number, passageCount: number, shuffleQuestions: boolean) => {
    const chosen = chooseCustom(pool, { lrCount, passageCount, shuffleQuestions })
    if (!chosen.ok) throw new Error(chosen.reason)
    return chosen.ids
  }

  it('puts LR first, keeps passages whole, and never repeats', () => {
    for (let run = 0; run < 200; run++) {
      const ids = choose(4, 2, run % 2 === 0)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ids.slice(0, 4).every((id) => id.startsWith('q'))).toBe(true)
      const rest = ids.slice(4).join('')
      expect(['zambc', 'bczam', 'zamk', 'kzam', 'bck', 'kbc']).toContain(rest)
    }
  })

  it('keeps the bank order unless shuffling, but still varies which are chosen', () => {
    const seen = new Set<string>()
    for (let run = 0; run < 100; run++) {
      const ids = choose(3, 2, false)
      expect(ids.slice(0, 3)).toEqual(ids.slice(0, 3).toSorted())
      expect(['zambc', 'zamk', 'bck']).toContain(ids.slice(3).join(''))
      seen.add(ids.join(''))
    }
    expect(seen.size).toBeGreaterThan(20)
  })

  it('shuffles LR questions and passages when chosen', () => {
    const runs = Array.from({ length: 100 }, () => choose(10, 3, true))
    expect(new Set(runs.map((ids) => ids.slice(0, 10).join(''))).size).toBeGreaterThan(90)
    expect(new Set(runs.map((ids) => ids.slice(10).join(''))).size).toBe(6)
  })

  it('works with one section only', () => {
    expect(choose(10, 0, false)).toEqual(pool.lrIds)
    expect(choose(0, 3, false).join('')).toBe('zambck')
  })

  it.each([
    [11, 0],
    [0, 4],
    [11, 4],
  ])('reports what is available for %i questions and %i passages', (lrCount, passageCount) => {
    expect(chooseCustom(pool, { lrCount, passageCount, shuffleQuestions: false })).toEqual({
      ok: false,
      reason: 'not_enough',
      availableLr: 10,
      availablePassages: 3,
    })
  })

  it.each([
    [0, 0],
    [-1, 1],
    [1.5, 0],
    [1, Number.NaN],
  ])('refuses %d questions and %d passages', (lrCount, passageCount) => {
    expect(chooseCustom(pool, { lrCount, passageCount, shuffleQuestions: false }).ok).toBe(false)
  })
})
