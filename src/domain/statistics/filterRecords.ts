import type { Records } from '../../data/records'
import type { Section } from '../content/types'

export interface StatisticsFilter {
  /** Null means all time. */
  days: 30 | 90 | null
  /** Null means both. */
  section: Section | null
}

/**
 * Everything on the Statistics screen uses these. Sessions that mix sections stay in under
 * any section, because their answers are divided by section instead.
 */
export function filterRecords(records: Records, filter: StatisticsFilter, now: Date): Records {
  const { days, section } = filter
  const from = days === null ? 0 : now.getTime() - days * 24 * 60 * 60 * 1000
  const isRecent = (time: string) => days === null || new Date(time).getTime() >= from
  return {
    answers: records.answers.filter(
      (answer) => isRecent(answer.answered_at) && (section === null || answer.section === section),
    ),
    sessions: records.sessions.filter(
      (session) =>
        isRecent(session.completed_at ?? session.started_at) &&
        (section === null || session.section === null || session.section === section),
    ),
  }
}
