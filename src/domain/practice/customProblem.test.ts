import { expect, it } from 'vitest'
import type { CustomFilter, CustomPool } from './chooseCustom'
import { customProblems } from './customProblem'

const pool: CustomPool = { lrIds: ['1', '2', '3'], passages: [['a', 'b'], ['c']] }
const empty: CustomPool = { lrIds: [], passages: [] }
const none = { lr: null, passages: null, overall: null }

it.each<[string, CustomPool, CustomFilter['subset'], number | null, number | null, object]>([
  ['a possible session', pool, 'any', 3, 2, none],
  ['LR only', pool, 'any', 1, 0, none],
  ['RC only', pool, 'any', 0, 1, none],
  ['nothing chosen', pool, 'any', 0, 0, { ...none, overall: 'Choose at least one question or passage.' }],
  ['too many LR', pool, 'any', 4, 0, { ...none, lr: 'Only 3 matching questions available.' }],
  ['too many passages', pool, 'missed', 0, 3, { ...none, passages: 'Only 2 missed passages available.' }],
  ['not a number', pool, 'any', null, 0, { ...none, lr: 'Enter a number from 0 to 500.' }],
  ['over the limit', pool, 'any', 501, 51, { lr: 'Enter a number from 0 to 500.', passages: 'Enter a number from 0 to 50.', overall: null }],
  ['no LR match', empty, 'any', 1, 0, { ...none, lr: 'No Logical Reasoning questions match your choices.' }],
  ['no missed LR', empty, 'missed', 1, 0, { ...none, lr: 'You have no missed Logical Reasoning questions that match.' }],
  ['no bookmarked RC', empty, 'bookmarked', 0, 1, { ...none, passages: 'You have no Reading Comprehension passages with bookmarked questions that match.' }],
  ['an empty subset and nothing chosen', empty, 'new', 0, 0, { ...none, overall: 'You have no new questions that match.' }],
  ['nothing at all', empty, 'any', 0, 0, { ...none, overall: 'No questions match your choices.' }],
])('explains %s', (_, from, subset, lr, passages, expected) => {
  expect(customProblems(from, subset, lr, passages)).toEqual(expected)
})

it('limits the total, counting the longest passages', () => {
  const long: CustomPool = {
    lrIds: Array.from({ length: 500 }, (_, index) => `q${index}`),
    passages: [['a'], ['b', 'c', 'd'], ['e', 'f']],
  }
  expect(customProblems(long, 'any', 497, 1).overall).toBeNull()
  expect(customProblems(long, 'any', 498, 1).overall).toContain('up to 500')
  expect(customProblems(long, 'any', 496, 2).overall).toContain('up to 500')
})
