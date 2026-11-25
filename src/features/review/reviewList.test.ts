import { describe, expect, it } from 'vitest'
import type { ReviewItem } from '../../data/records'
import { categoriesIn, filterItems, pageOf, type ReviewFilter } from './reviewListUtils'

const item = (question_id: string, changes: Partial<ReviewItem> = {}): ReviewItem => ({
  question_id, section: 'logical_reasoning', category_name: 'Flaw', difficulty: 2, passage_id: null,
  excerpt: '', times_answered: 1, last_correct: true, last_answered_at: '2026-01-01',
  is_bookmarked: false, can_retry: true, ...changes,
})

const items = [
  item('right'),
  item('wrong', { last_correct: false, category_name: 'Weaken' }),
  item('marked', { times_answered: 0, last_correct: null, is_bookmarked: true }),
  item('rc', { section: 'reading_comprehension', category_name: 'Detail', last_correct: false, is_bookmarked: true }),
]
const all: ReviewFilter = { tab: 'answered', section: null, category: '' }
const ids = (filter: Partial<ReviewFilter>) =>
  filterItems(items, { ...all, ...filter }).map(({ question_id }) => question_id)

describe('filterItems', () => {
  it.each<[string, Partial<ReviewFilter>, string[]]>([
    ['missed', { tab: 'missed' }, ['wrong', 'rc']],
    ['bookmarked', { tab: 'bookmarked' }, ['marked', 'rc']],
    ['answered', { tab: 'answered' }, ['right', 'wrong', 'rc']],
    ['a section', { tab: 'missed', section: 'reading_comprehension' }, ['rc']],
    ['a category', { category: 'Flaw' }, ['right']],
    ['nothing', { tab: 'missed', category: 'Flaw' }, []],
  ])('lists %s', (_, filter, expected) => {
    expect(ids(filter)).toEqual(expected)
  })

  it('offers only categories that would show something', () => {
    expect(categoriesIn(items, { tab: 'missed', section: null })).toEqual(['Detail', 'Weaken'])
    expect(categoriesIn(items, { tab: 'missed', section: 'logical_reasoning' })).toEqual(['Weaken'])
  })
})

it('pages through long lists', () => {
  const many = Array.from({ length: 120 }, (_, index) => index)
  expect(pageOf(many, 0)).toMatchObject({ page: 0, pages: 3 })
  expect(pageOf(many, 0).items).toHaveLength(50)
  expect(pageOf(many, 2).items).toEqual(many.slice(100))
  expect(pageOf(many, 9).page).toBe(2)
  expect(pageOf([], 4)).toEqual({ items: [], page: 0, pages: 1 })
  expect(pageOf(many.slice(0, 50), 1)).toMatchObject({ page: 0, pages: 1 })
})
