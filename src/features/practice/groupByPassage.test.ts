import { expect, it } from 'vitest'
import { groupByPassage } from './groupByPassage'
import { testSessionQuestion } from './testSession'

const on = (id: string | null) => ({
  ...testSessionQuestion('q'),
  passage: id === null ? null : { id, title: '', texts: [] },
})

it('groups consecutive questions by passage', () => {
  expect(groupByPassage([on('p1'), on('p1'), on('p2'), on('p3'), on('p3')])).toEqual([
    { label: 'Passage 1', positions: [0, 1] },
    { label: 'Passage 2', positions: [2] },
    { label: 'Passage 3', positions: [3, 4] },
  ])
})

it('puts all LR questions in one group', () => {
  expect(groupByPassage([on(null), on(null)])).toEqual([{ label: null, positions: [0, 1] }])
  expect(groupByPassage([])).toEqual([])
})

it('labels both kinds when they are mixed', () => {
  expect(groupByPassage([on(null), on(null), on('p1'), on('p2')])).toEqual([
    { label: 'Logical Reasoning', positions: [0, 1] },
    { label: 'Passage 1', positions: [2] },
    { label: 'Passage 2', positions: [3] },
  ])
})
