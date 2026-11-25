import { expect, it } from 'vitest'
import type { SessionQuestion } from '../../data/practiceSession'
import { testSessionQuestion } from '../practice/testSession'
import { reviewGroups, reviewPositions, type ReviewFilter } from './examReview'

function question(
  exam_section: number,
  passage: string | null,
  is_correct: boolean | null,
  is_flagged = false,
): SessionQuestion {
  return {
    ...testSessionQuestion('q'),
    exam_section,
    is_flagged,
    passage: passage === null ? null : { id: passage, title: '', texts: [] },
    outcome: { correct_choice: 'C', is_correct, explanations: { A: '', B: '', C: '', D: '', E: '' } },
  }
}

const questions = [
  question(0, null, true),
  question(0, null, false, true),
  question(0, null, null),
  question(1, 'p1', true, true),
  question(1, 'p1', false),
  question(1, 'p2', true),
  question(1, 'p3', null),
]

it.each<[ReviewFilter, number[]]>([
  ['all', [0, 1, 2, 3, 4, 5, 6]],
  ['incorrect', [1, 4]],
  ['unanswered', [2, 6]],
  ['flagged', [1, 3]],
])('finds %s questions', (filter, expected) => {
  expect(reviewPositions(questions, filter)).toEqual(expected)
})

it('groups by passage, with numbers from the whole section', () => {
  expect(reviewGroups(questions, 0, 'all')).toEqual([
    { label: null, items: [{ position: 0, number: 1 }, { position: 1, number: 2 }, { position: 2, number: 3 }] },
  ])
  expect(reviewGroups(questions, 1, 'all').map(({ label, items }) => [label, items.length])).toEqual([
    ['Passage 1', 2], ['Passage 2', 1], ['Passage 3', 1],
  ])
})

it('keeps numbers and passage labels when filtering', () => {
  expect(reviewGroups(questions, 0, 'unanswered')).toEqual([
    { label: null, items: [{ position: 2, number: 3 }] },
  ])
  expect(reviewGroups(questions, 1, 'unanswered')).toEqual([
    { label: 'Passage 3', items: [{ position: 6, number: 4 }] },
  ])
  expect(reviewGroups(questions, 1, 'flagged')[0].label).toBe('Passage 1')
})

it('leaves out what is empty', () => {
  expect(reviewGroups([question(0, null, true)], 0, 'incorrect')).toEqual([])
  expect(reviewGroups(questions, 5, 'all')).toEqual([])
})
