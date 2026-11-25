import { expect, it } from 'vitest'
import { describePath } from './describePath'

it.each([
  ['package_id', 'Package id'],
  ['questions[0]', 'Question 1'],
  ['questions[2].choices[0].text', 'Question 3, choice 1, text'],
  ['questions[0].secondary_tags[1]', 'Question 1, tag 2'],
  ['questions[0].explanations.D', 'Question 1, explanations, D'],
  ['categories[9].sort_order', 'Category 10, sort order'],
])('describes %s', (path, expected) => {
  expect(describePath(path)).toBe(expected)
})
