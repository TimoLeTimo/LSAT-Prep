import type { ImportPlan, QuestionImport } from '../../data/questionImport'
import { validatePackageBytes, type Issue } from '../../domain/content/validatePackage'

export type CheckResult =
  | { step: 'cancelled' }
  | { step: 'invalid'; errors: Issue[]; errorCount: number }
  | { step: 'blocked'; plan: ImportPlan }
  | { step: 'preview'; plan: ImportPlan; warnings: Issue[]; categoryNames: Map<string, string> }

type Api = Pick<QuestionImport, 'bytes' | 'catalog' | 'reject' | 'preview'>

/**
 * Validates and previews the chosen file. Saves no content. `isCancelled` is checked
 * between steps so a cancelled import is not recorded as a rejected file.
 */
export async function checkPackage(api: Api, isCancelled: () => boolean): Promise<CheckResult> {
  const [bytes, catalog] = await Promise.all([api.bytes(), api.catalog()])
  if (isCancelled()) return { step: 'cancelled' }

  const result = validatePackageBytes(bytes, {
    categories: catalog.categories,
    approvedPassageIds: new Set(catalog.approved_passage_ids),
  })
  if (!result.ok) {
    const { errors, errorCount } = result
    await api.reject(`The file has ${errorCount} problem${errorCount === 1 ? '' : 's'}.`)
    return { step: 'invalid', errors, errorCount }
  }

  const plan = await api.preview()
  if (isCancelled()) return { step: 'cancelled' }
  if (plan.problems.length > 0) return { step: 'blocked', plan }

  const categoryNames = new Map(
    [...catalog.categories, ...result.package.categories].map(({ id, name }) => [id, name]),
  )
  return { step: 'preview', plan, warnings: result.warnings, categoryNames }
}
