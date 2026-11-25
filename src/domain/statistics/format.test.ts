import { describe, expect, it } from 'vitest'
import type { Records } from '../../data/records'
import { filterRecords } from './filterRecords'
import { duration, labelEvery, percent, perQuestion, shortDate } from './format'

it('formats values', () => {
  expect([null, 0, 0.666, 1].map(percent)).toEqual(['–', '0%', '67%', '100%'])
  expect([null, 0, 45.4, 59.6, 125].map(perQuestion)).toEqual(['–', '0:00', '0:45', '1:00', '2:05'])
  expect([0, 59_999, 60_000, 3_600_000, 7_500_000].map(duration)).toEqual([
    '0 min', 'under 1 min', '1 min', '1 h 0 min', '2 h 5 min',
  ])
  expect(shortDate('2026-03-01')).toMatch(/1/)
})

it('thins out axis labels', () => {
  expect(labelEvery(5, 700)).toBe(1)
  expect(labelEvery(52, 700)).toBe(5)
  expect(labelEvery(1, 0)).toBeGreaterThanOrEqual(1)
})

describe('filterRecords', () => {
  const now = new Date('2026-11-24T12:00:00Z')
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
  const answer = (id: string, days: number, section: 'logical_reasoning' | 'reading_comprehension') => ({
    question_id: id, section, category_id: '', category_name: '', difficulty: 1 as const, is_correct: true,
    seconds: 1, answered_at: ago(days), is_retry: false,
  })
  const session = (id: string, days: number, section: 'logical_reasoning' | null, done = true) => ({
    id, session_type: 'targeted' as const, section, name: null, status: 'completed' as const,
    started_at: ago(days + 5), completed_at: done ? ago(days) : null, practice_ms: 0, questions: 1,
    answered: 1, correct: 1, scored_questions: 1, scored_correct: 1,
  })
  const records: Records = {
    answers: [answer('new', 1, 'logical_reasoning'), answer('edge', 30, 'reading_comprehension'), answer('old', 60, 'logical_reasoning'), answer('ancient', 200, 'logical_reasoning')],
    sessions: [session('lr', 29, 'logical_reasoning'), session('mixed', 2, null), session('old', 50, 'logical_reasoning'), session('open', 28, null, false)],
  }
  const found = (days: 30 | 90 | null, section: 'logical_reasoning' | 'reading_comprehension' | null) => {
    const { answers, sessions } = filterRecords(records, { days, section }, now)
    return [answers.map(({ question_id }) => question_id).join(), sessions.map(({ id }) => id).join()]
  }

  it('limits everything to the period and section', () => {
    expect(found(null, null)).toEqual(['new,edge,old,ancient', 'lr,mixed,old,open'])
    expect(found(30, null)).toEqual(['new,edge', 'lr,mixed'])
    expect(found(90, null)).toEqual(['new,edge,old', 'lr,mixed,old,open'])
    expect(found(null, 'reading_comprehension')).toEqual(['edge', 'mixed,open'])
    expect(found(30, 'logical_reasoning')).toEqual(['new', 'lr,mixed'])
  })
})
