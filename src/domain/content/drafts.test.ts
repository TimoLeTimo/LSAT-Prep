import { describe, expect, it } from 'vitest'
import { validatePackageData } from './validatePackage'

/** Draft packages must be well formed, but must never be importable. */
const drafts = import.meta.glob<string>('../../../content/drafts/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
})

describe.each(Object.entries(drafts))('%s', (_, text) => {
  it('is refused, and names every draft question', () => {
    const data = JSON.parse(text)
    const result = validatePackageData(data)
    if (result.ok) throw new Error('A draft package must not be importable.')
    for (const { id } of data.questions) {
      expect(result.errors.some(({ code, message }) => code === 'not_approved' && message.includes(id))).toBe(true)
    }
  })

  it('has no other problems', () => {
    const data = JSON.parse(text)
    for (const item of [...data.passages, ...data.questions]) {
      item.provenance.origin = 'original_ai_assisted_human_reviewed'
    }
    for (const passage of data.passages) passage.status = 'approved'
    for (const { quality } of data.questions) {
      Object.assign(quality, {
        draft_status: 'approved',
        independent_solve: 'passed',
        ambiguity_review: 'passed',
        human_review: 'passed',
      })
    }
    expect(validatePackageData(data)).toMatchObject({ ok: true, warnings: [] })
  })
})

it('finds the draft packages', () => {
  expect(Object.keys(drafts)).not.toHaveLength(0)
})
