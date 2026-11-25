import type { Session, SessionQuestion } from '../../data/practiceSession'
import { CHOICE_LABELS } from '../../domain/content/types'

/** TEST DATA ONLY. */
export function testSessionQuestion(id: string): SessionQuestion {
  return {
    id,
    question_id: `question-${id}`,
    category_name: 'Flaw',
    difficulty: 2,
    stimulus: 'TEST DATA stimulus.',
    prompt: 'TEST DATA prompt?',
    choices: CHOICE_LABELS.map((label) => ({ label, text: `Test choice ${label}` })),
    passage: null,
    selected: null,
    is_flagged: false,
    time_spent_seconds: 0,
    is_submitted: false,
    outcome: null,
  }
}

export function testSession(ids = ['a', 'b', 'c']): Session {
  return {
    id: 'session',
    config: {
      section: 'logical_reasoning',
      category_ids: [],
      difficulties: [],
      question_count: ids.length,
      explanations: 'after_each',
    },
    status: 'in_progress',
    current_position: 0,
    created_at: '2026-11-24T12:00:00.000Z',
    completed_at: null,
    questions: ids.map(testSessionQuestion),
  }
}
