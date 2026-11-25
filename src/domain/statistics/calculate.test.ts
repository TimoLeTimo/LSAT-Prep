import { describe, expect, it } from 'vitest'
import type { AnswerRecord, SessionRecord } from '../../data/records'
import { byCategory, byDifficulty, bySection, byWeek, examHistory, overview, sessionHistory } from './calculate'

const answer = (changes: Partial<AnswerRecord> = {}): AnswerRecord => ({
  question_id: 'q1', section: 'logical_reasoning', category_id: 'lr-flaw', category_name: 'Flaw',
  difficulty: 2, is_correct: true, seconds: 60, answered_at: '2026-11-24T18:00:00.000Z', is_retry: false,
  ...changes,
})
const session = (changes: Partial<SessionRecord> = {}): SessionRecord => ({
  id: 's', session_type: 'targeted', section: 'logical_reasoning', name: null, status: 'completed',
  started_at: '2026-11-24T18:00:00.000Z', completed_at: '2026-11-24T19:00:00.000Z', practice_ms: 1000,
  questions: 5, answered: 4, correct: 3, scored_questions: 5, scored_correct: 3,
  ...changes,
})

describe('overview', () => {
  it('has no accuracy or average before anything is answered', () => {
    expect(overview([], [])).toEqual({
      answered: 0, correct: 0, accuracy: null, differentQuestions: 0, averageSeconds: null,
      practiceMs: 0, retries: { answered: 0, correct: 0, accuracy: null },
    })
  })

  it('counts every answer, and different questions separately', () => {
    const found = overview([answer(), answer({ is_correct: false }), answer({ question_id: 'q2' })], [])
    expect(found).toMatchObject({ answered: 3, correct: 2, accuracy: 2 / 3, differentQuestions: 2 })
  })

  it('keeps retries apart', () => {
    const found = overview(
      [answer({ is_correct: false }), answer({ is_retry: true, seconds: 999 }), answer({ is_retry: true, question_id: 'q9', is_correct: false })],
      [],
    )
    expect(found).toMatchObject({ answered: 1, accuracy: 0, differentQuestions: 1, averageSeconds: 60 })
    expect(found.retries).toEqual({ answered: 2, correct: 1, accuracy: 0.5 })
  })

  it('averages only answers with a recorded time', () => {
    expect(overview([answer({ seconds: 30 }), answer({ seconds: 0 }), answer({ seconds: 90 })], []).averageSeconds).toBe(60)
    expect(overview([answer({ seconds: 0 })], []).averageSeconds).toBeNull()
  })

  it('adds practice time from every session', () => {
    const sessions = [session(), session({ status: 'abandoned' }), session({ status: 'in_progress' }), session({ session_type: 'review' })]
    expect(overview([], sessions).practiceMs).toBe(4000)
  })
})

describe('groups', () => {
  const answers = [
    answer(),
    answer({ is_correct: false, seconds: 120 }),
    answer({ category_id: 'lr-weaken', category_name: 'Weaken', difficulty: 4 }),
    answer({ section: 'reading_comprehension', category_id: 'rc-detail', category_name: 'Detail', difficulty: 1 }),
    answer({ category_id: 'lr-flaw', is_retry: true, difficulty: 3 }),
  ]

  it('lists both sections even when one is empty', () => {
    expect(bySection(answers).map(({ key, answered, correct }) => [key, answered, correct])).toEqual([
      ['logical_reasoning', 3, 2], ['reading_comprehension', 1, 1],
    ])
    expect(bySection([]).map(({ accuracy }) => accuracy)).toEqual([null, null])
  })

  it('lists categories by section and name, without retries', () => {
    expect(byCategory(answers).map(({ label, answered, accuracy }) => [label, answered, accuracy])).toEqual([
      ['Flaw', 2, 0.5], ['Weaken', 1, 1], ['Detail', 1, 1],
    ])
    expect(byCategory(answers)[0].averageSeconds).toBe(90)
  })

  it('uses the latest name of a renamed category', () => {
    const renamed = [answer({ category_name: 'Old' }), answer({ category_name: 'New' })]
    expect(byCategory(renamed).map(({ label }) => label)).toEqual(['New'])
  })

  it('lists difficulties from easiest, without retries', () => {
    expect(byDifficulty(answers).map(({ key, answered }) => [key, answered])).toEqual([[1, 1], [2, 2], [4, 1]])
  })

  it('adds up to the overview', () => {
    const { answered, correct } = overview(answers, [])
    for (const groups of [bySection(answers), byCategory(answers), byDifficulty(answers), byWeek(answers)]) {
      expect(groups.reduce((sum, item) => sum + item.answered, 0)).toBe(answered)
      expect(groups.reduce((sum, item) => sum + item.correct, 0)).toBe(correct)
    }
  })
})

describe('byWeek', () => {
  const local = (year: number, month: number, day: number, hour = 12) =>
    answer({ answered_at: new Date(year, month - 1, day, hour).toISOString() })

  it('starts weeks on Monday in local time', () => {
    const weeks = byWeek([local(2026, 11, 22, 23), local(2026, 11, 23, 0), local(2026, 11, 29, 23)])
    expect(weeks.map(({ start, answered }) => [start, answered])).toEqual([['2026-11-16', 1], ['2026-11-23', 2]])
  })

  it('includes empty weeks, across years and daylight saving', () => {
    const weeks = byWeek([local(2026, 10, 19), local(2027, 3, 22)])
    expect(weeks).toHaveLength(23)
    expect(weeks[0].start).toBe('2026-10-19')
    expect(weeks[22].start).toBe('2027-03-22')
    expect(new Set(weeks.map(({ start }) => start)).size).toBe(23)
    expect(weeks.every(({ start }) => new Date(`${start}T12:00`).getDay() === 1)).toBe(true)
    expect(weeks[5]).toMatchObject({ answered: 0, accuracy: null })
  })

  it('has no weeks without answers', () => {
    expect(byWeek([])).toEqual([])
    expect(byWeek([answer({ is_retry: true })])).toEqual([])
  })
})

describe('history', () => {
  const sessions = [
    session({ id: 'old', completed_at: '2026-01-01' }),
    session({ id: 'open', status: 'in_progress', completed_at: null }),
    session({ id: 'left', status: 'abandoned', completed_at: '2026-03-01' }),
    session({ id: 'empty', status: 'abandoned', answered: 0, completed_at: '2026-04-01' }),
    session({ id: 'exam', session_type: 'full_simulation', completed_at: '2026-02-01' }),
    session({ id: 'quit', session_type: 'test', status: 'abandoned', answered: 0 }),
    session({ id: 'test', session_type: 'test', completed_at: '2026-05-01' }),
  ]

  it('lists finished sessions, and ended ones with answers, newest first', () => {
    expect(sessionHistory(sessions).map(({ id }) => id)).toEqual(['test', 'left', 'exam', 'old'])
  })

  it('lists completed exams', () => {
    expect(examHistory(sessions).map(({ id }) => id)).toEqual(['test', 'exam'])
  })
})

it('is quick with many answers', () => {
  const many = Array.from({ length: 50_000 }, (_, index) =>
    answer({ question_id: `q${index % 4000}`, answered_at: new Date(2024, 0, 1 + (index % 900)).toISOString() }),
  )
  const started = performance.now()
  overview(many, [])
  byCategory(many)
  byWeek(many)
  expect(performance.now() - started).toBeLessThan(1500)
})
