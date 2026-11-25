import { expect, it } from 'vitest'
import { defaultFormat, examFormats } from './formats'

it.each([
  [new Date(2026, 10, 24), 'four-section'],
  [new Date(2027, 6, 31, 23, 59), 'four-section'],
  [new Date(2027, 7, 1), 'three-section'],
  [new Date(2030, 0, 1), 'three-section'],
  [new Date(2020, 0, 1), 'four-section'],
])('on %s uses the %s format', (date, expected) => {
  expect(defaultFormat(date).id).toBe(expected)
})

it('lists formats from oldest to newest, with unique IDs', () => {
  const starts = examFormats.map(({ startsOn }) => startsOn)
  expect(starts).toEqual(starts.toSorted())
  expect(new Set(examFormats.map(({ id }) => id)).size).toBe(examFormats.length)
})

it('scores 50 LR questions and 27 RC questions in every format', () => {
  for (const { sections } of examFormats) {
    const total = (kind: 'logical_reasoning' | 'reading_comprehension') =>
      sections.reduce((sum, { scored }) => sum + (scored?.[kind]?.questions.target ?? 0), 0)
    expect([total('logical_reasoning'), total('reading_comprehension')]).toEqual([50, 27])
  }
})
