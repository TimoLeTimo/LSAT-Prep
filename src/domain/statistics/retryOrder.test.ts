import { expect, it } from 'vitest'
import type { ReviewItem } from '../../data/records'
import { retryOrder } from './retryOrder'

const item = (question_id: string, passage_id: string | null, can_retry = true): ReviewItem => ({
  question_id, passage_id, can_retry, section: passage_id === null ? 'logical_reasoning' : 'reading_comprehension',
  category_name: '', difficulty: 1, excerpt: '', times_answered: 1, last_correct: false,
  last_answered_at: null, is_bookmarked: false,
})

it('puts LR first and keeps passages together, leaving out retired questions', () => {
  const items = [item('a', 'p1'), item('1', null), item('b', 'p2'), item('c', 'p1'), item('2', null, false), item('3', null)]
  expect(retryOrder(items)).toEqual(['1', '3', 'a', 'c', 'b'])
  expect(retryOrder([])).toEqual([])
})
