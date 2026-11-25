import type { Category, Section } from './types'

function list(section: Section, prefix: string, entries: [id: string, name: string][]): Category[] {
  return entries.map(([id, name], index) => ({
    id: `${prefix}-${id}`,
    section,
    name,
    description: '',
    sort_order: (index + 1) * 10,
  }))
}

/**
 * Starting category list, from RULES_OF_ENGAGEMENT_QUESTION_CREATION.md section 4.
 * This is seed data for the database, where categories can later be edited.
 */
export const defaultCategories: readonly Category[] = [
  ...list('logical_reasoning', 'lr', [
    ['identify-conclusion', 'Identify the conclusion'],
    ['identify-premises', 'Identify premises / evidence'],
    ['main-point', 'Main point'],
    ['role-of-statement', 'Role of a statement'],
    ['method-of-reasoning', 'Method of reasoning'],
    ['strengthen', 'Strengthen'],
    ['weaken', 'Weaken'],
    ['necessary-assumption', 'Necessary assumption'],
    ['sufficient-assumption', 'Sufficient assumption'],
    ['flaw', 'Flaw'],
    ['inference', 'Inference / must be true'],
    ['resolve-explain', 'Resolve or explain'],
    ['principle', 'Principle: application or justification'],
    ['evaluate', 'Evaluate an argument'],
    ['parallel-reasoning', 'Parallel reasoning'],
    ['parallel-flaw', 'Parallel flaw'],
  ]),
  ...list('reading_comprehension', 'rc', [
    ['main-idea', 'Main idea / primary purpose'],
    ['author-attitude', "Author's attitude or perspective"],
    ['inference', 'Inference'],
    ['detail', 'Detail / textual support'],
    ['function', 'Function of a paragraph or sentence'],
    ['structure', 'Passage organization / structure'],
    ['meaning-in-context', 'Meaning in context'],
    ['application', 'Application of a principle'],
    ['implication', 'Implication'],
    ['comparative-agreement', 'Comparative passage agreement / disagreement'],
    ['argument-relationship', "Relationship between authors' arguments"],
    ['author-response', 'How one author would respond to the other'],
  ]),
]
