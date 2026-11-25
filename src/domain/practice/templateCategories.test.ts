import { expect, it } from 'vitest'
import { findByName, loadTemplateCategories } from './templateCategories'

const flaw = { id: 'lr-flaw', section: 'logical_reasoning' as const, name: 'Flaw' }
const weaken = { id: 'lr-weaken', section: 'logical_reasoning' as const, name: 'Weaken' }
const detail = { id: 'rc-detail', section: 'reading_comprehension' as const, name: 'Detail' }

it('keeps available categories without comment', () => {
  expect(loadTemplateCategories([flaw, detail], [detail, weaken, flaw])).toEqual({
    ids: ['lr-flaw', 'rc-detail'],
    notes: [],
  })
  expect(loadTemplateCategories([], [flaw])).toEqual({ ids: [], notes: [] })
})

it('says which category was left out', () => {
  expect(loadTemplateCategories([flaw, weaken, detail], [flaw, detail])).toEqual({
    ids: ['lr-flaw', 'rc-detail'],
    notes: ['The category “Weaken” is no longer available and was left out.'],
  })
})

it('says when a section becomes unrestricted', () => {
  expect(loadTemplateCategories([flaw, weaken, detail], [detail])).toEqual({
    ids: ['rc-detail'],
    notes: [
      'These categories are no longer available and were left out: “Flaw”, “Weaken”.',
      'Logical Reasoning now includes all categories.',
    ],
  })
  expect(loadTemplateCategories([flaw, detail], []).notes).toHaveLength(3)
})

it('does not accept a category that changed sections', () => {
  expect(loadTemplateCategories([flaw], [{ ...flaw, section: 'reading_comprehension' }]).ids).toEqual([])
})

it('finds names ignoring capitals and spaces around them', () => {
  const templates = [{ name: 'Weak Spots' }, { name: 'Éxam' }]
  expect(findByName(templates, ' weak spots ')).toBe(templates[0])
  expect(findByName(templates, 'éXAM')).toBe(templates[1])
  expect(findByName(templates, 'weak')).toBeUndefined()
})
