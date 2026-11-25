import { expect, it } from 'vitest'
import { groupByPassage } from './groupByPassage'
import { testSessionQuestion } from './testSession'

const on = (id: string | null) => ({
  ...testSessionQuestion('q'),
  passage: id === null ? null : { id, title: '', texts: [] },
})

it('groups consecutive questions by passage', () => {
  expect(groupByPassage([on('p1'), on('p1'), on('p2'), on('p3'), on('p3')])).toEqual([
    { passageId: 'p1', positions: [0, 1] },
    { passageId: 'p2', positions: [2] },
    { passageId: 'p3', positions: [3, 4] },
  ])
})

it('puts all LR questions in one group', () => {
  expect(groupByPassage([on(null), on(null)])).toEqual([{ passageId: null, positions: [0, 1] }])
  expect(groupByPassage([])).toEqual([])
})
