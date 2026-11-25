import { expect, it, vi } from 'vitest'
import type { ImportPlan } from '../../data/questionImport'
import { defaultCategories } from '../../domain/content/categories'
import { testPackage } from '../../domain/content/testPackage'
import { checkPackage } from './checkPackage'

const none = { new: [], skipped: [], conflicts: [] }
const plan: ImportPlan = {
  package_id: 'test-package',
  package_version: '1.0.0',
  display_name: 'TEST DATA package',
  content_hash: 'hash',
  lr_questions: 1,
  rc_questions: 1,
  questions_by_category: [],
  categories: none,
  passages: none,
  questions: none,
  problems: [],
}

function fakeApi(data: unknown, previewed = plan, passages: string[] = []) {
  return {
    bytes: vi.fn(async () => new TextEncoder().encode(JSON.stringify(data))),
    catalog: vi.fn(async () => ({
      categories: defaultCategories.map(({ id, section, name }) => ({ id, section, name })),
      approved_passage_ids: passages,
    })),
    reject: vi.fn<(summary: string) => Promise<void>>(async () => {}),
    preview: vi.fn(async () => previewed),
  }
}

const active = () => false

it('previews a valid package', async () => {
  const api = fakeApi(testPackage())
  const result = await checkPackage(api, active)
  expect(result).toMatchObject({ step: 'preview', plan, warnings: [] })
  if (result.step === 'preview') {
    expect(result.categoryNames.get('lr-flaw')).toBe('Flaw')
    expect(result.categoryNames.get('test-category')).toBe('Test')
  }
  expect(api.reject).not.toHaveBeenCalled()
})

it('rejects an invalid package without previewing it', async () => {
  const api = fakeApi({ ...testPackage(), questions: [] })
  expect(await checkPackage(api, active)).toMatchObject({ step: 'invalid', errorCount: 1 })
  expect(api.reject).toHaveBeenCalledExactlyOnceWith('The file has 1 problem.')
  expect(api.preview).not.toHaveBeenCalled()
})

it('blocks a package that the import engine has a problem with', async () => {
  const blocked = { ...plan, problems: ['Already imported.'] }
  expect(await checkPackage(fakeApi(testPackage(), blocked), active)).toEqual({
    step: 'blocked',
    plan: blocked,
  })
})

it('accepts passages that are already in the app', async () => {
  const data = { ...testPackage(), passages: [] }
  expect(await checkPackage(fakeApi(data), active)).toMatchObject({ step: 'invalid' })
  const api = fakeApi(data, plan, ['test-passage-1'])
  expect(await checkPackage(api, active)).toMatchObject({ step: 'preview' })
})

it('does not record or preview a cancelled import', async () => {
  const api = fakeApi({})
  expect(await checkPackage(api, () => true)).toEqual({ step: 'cancelled' })
  expect(api.reject).not.toHaveBeenCalled()
  expect(api.preview).not.toHaveBeenCalled()
})

it('notices cancellation during the preview', async () => {
  let cancelled = false
  const api = fakeApi(testPackage())
  api.preview.mockImplementation(async () => {
    cancelled = true
    return plan
  })
  expect(await checkPackage(api, () => cancelled)).toEqual({ step: 'cancelled' })
})

it('passes on errors', async () => {
  const api = fakeApi(testPackage())
  api.preview.mockRejectedValue('Failed.')
  await expect(checkPackage(api, active)).rejects.toBe('Failed.')
})
