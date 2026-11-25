import { expect, it } from 'vitest'
import { shortfallText } from './shortfallText'

const base = { lrNeeded: 50, lrAvailable: 50, passagesNeeded: 8, passagesAvailable: 8, lengthsDoNotFit: false }

it.each([
  [{ lrAvailable: 49 }, ['1 more Logical Reasoning question (50 needed, 49 in the bank)']],
  [{ passagesAvailable: 5 }, ['3 more passages (8 needed, 5 in the bank)']],
  [
    { lrAvailable: 0, passagesAvailable: 7 },
    ['50 more Logical Reasoning questions (50 needed, 0 in the bank)', '1 more passage (8 needed, 7 in the bank)'],
  ],
])('explains %o', (changes, expected) => {
  expect(shortfallText({ ...base, ...changes })).toEqual(expected)
})

it('explains lengths that do not fit', () => {
  expect(shortfallText({ ...base, lengthsDoNotFit: true })[0]).toContain('cannot be combined')
})
