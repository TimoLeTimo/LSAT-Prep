import type { Section } from './types'

/**
 * TEST DATA ONLY. These are not practice questions and must never ship as content.
 * Values are plain objects so tests can break them in any way.
 */
// oxlint-disable-next-line typescript/no-explicit-any
type Loose = any

function provenance() {
  return {
    origin: 'original_human_written',
    source_material_used: 'None. Test data.',
    authoring_batch: 'test-batch',
    license_reference: null,
  }
}

export function testQuestion(section: Section = 'logical_reasoning', id = 'test-lr-1'): Loose {
  const isLr = section === 'logical_reasoning'
  return {
    id,
    section,
    primary_category: isLr ? 'lr-strengthen' : 'rc-detail',
    secondary_tags: ['test_tag'],
    difficulty: 2,
    stimulus: isLr ? 'TEST DATA stimulus.' : null,
    prompt: 'TEST DATA prompt?',
    choices: ['A', 'B', 'C', 'D', 'E'].map((label) => ({ label, text: `Test choice ${label}` })),
    correct_choice: 'C',
    explanations: { A: 'Test A.', B: 'Test B.', C: 'Test C.', D: 'Test D.', E: 'Test E.' },
    estimated_time_seconds: 90,
    passage_id: isLr ? null : 'test-passage-1',
    content_version: 1,
    provenance: provenance(),
    quality: {
      draft_status: 'approved',
      independent_solve: 'passed',
      ambiguity_review: 'passed',
      human_review: 'passed',
      reviewer_notes: '',
    },
  }
}

export function testPackage(): Loose {
  return {
    format: 'lsat-prep-package',
    schema_version: 1,
    package_id: 'test-package',
    package_version: '1.0.0',
    display_name: 'TEST DATA package',
    created_at: '2026-11-24T12:00:00Z',
    categories: [
      { id: 'test-category', section: 'logical_reasoning', name: 'Test', description: '', sort_order: 1 },
    ],
    passages: [
      {
        id: 'test-passage-1',
        title: 'TEST DATA passage',
        passage_type: 'comparative',
        texts: [
          { label: 'A', text: 'TEST DATA text A.' },
          { label: 'B', text: 'TEST DATA text B.' },
        ],
        content_version: 1,
        status: 'approved',
        provenance: provenance(),
      },
    ],
    questions: [testQuestion(), testQuestion('reading_comprehension', 'test-rc-1')],
  }
}
