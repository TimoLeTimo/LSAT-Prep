import type { AnswerRecord, SessionRecord } from '../../data/records'
import { SECTIONS, type Difficulty, type Section } from '../content/types'

/** Definitions are in docs/STATISTICS.md. */
export interface Accuracy {
  answered: number
  correct: number
  /** From 0 to 1, or null when nothing was answered. */
  accuracy: number | null
}

export interface Overview extends Accuracy {
  differentQuestions: number
  /** Null when no answer has a recorded time. */
  averageSeconds: number | null
  practiceMs: number
  /** Retries are kept apart from everything above, except practice time. */
  retries: Accuracy
}

export function accuracy(answers: readonly AnswerRecord[]): Accuracy {
  const correct = answers.filter(({ is_correct }) => is_correct).length
  return {
    answered: answers.length,
    correct,
    accuracy: answers.length === 0 ? null : correct / answers.length,
  }
}

const isOriginal = ({ is_retry }: AnswerRecord) => !is_retry

export function overview(
  answers: readonly AnswerRecord[],
  sessions: readonly SessionRecord[],
): Overview {
  const originals = answers.filter(isOriginal)
  const timed = originals.filter(({ seconds }) => seconds > 0)
  return {
    ...accuracy(originals),
    differentQuestions: new Set(originals.map(({ question_id }) => question_id)).size,
    averageSeconds:
      timed.length === 0
        ? null
        : timed.reduce((sum, { seconds }) => sum + seconds, 0) / timed.length,
    practiceMs: sessions.reduce((sum, { practice_ms }) => sum + practice_ms, 0),
    retries: accuracy(answers.filter(({ is_retry }) => is_retry)),
  }
}

export interface Group<K> extends Accuracy {
  key: K
  label: string
  averageSeconds: number | null
}

function group<K extends string | number>(
  answers: readonly AnswerRecord[],
  keyOf: (answer: AnswerRecord) => K,
  labelOf: (answer: AnswerRecord) => string,
): Group<K>[] {
  const groups = new Map<K, AnswerRecord[]>()
  for (const answer of answers.filter(isOriginal)) {
    const key = keyOf(answer)
    const found = groups.get(key)
    if (found) found.push(answer)
    else groups.set(key, [answer])
  }
  return [...groups].map(([key, found]) => ({
    key,
    // The most recent name, in case it changed.
    label: labelOf(found[found.length - 1]),
    ...accuracy(found),
    averageSeconds: overview(found, []).averageSeconds,
  }))
}

/** Both sections, in order, even with no answers. */
export function bySection(answers: readonly AnswerRecord[]): Group<Section>[] {
  const found = group(answers, ({ section }) => section, ({ section }) => section)
  return SECTIONS.map(
    (section) =>
      found.find(({ key }) => key === section) ?? {
        key: section,
        label: section,
        ...accuracy([]),
        averageSeconds: null,
      },
  )
}

/** Categories that were answered, LR first, then by name. */
export function byCategory(answers: readonly AnswerRecord[]): (Group<string> & { section: Section })[] {
  const sections = new Map(answers.map(({ category_id, section }) => [category_id, section]))
  return group(answers, ({ category_id }) => category_id, ({ category_name }) => category_name)
    .map((found) => ({ ...found, section: sections.get(found.key)! }))
    .toSorted(
      (a, b) =>
        SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section) || a.label.localeCompare(b.label),
    )
}

/** Difficulties that were answered, easiest first. */
export function byDifficulty(answers: readonly AnswerRecord[]): Group<Difficulty>[] {
  return group(answers, ({ difficulty }) => difficulty, ({ difficulty }) => String(difficulty)).toSorted(
    (a, b) => a.key - b.key,
  )
}

export interface Week extends Accuracy {
  /** The Monday it starts on, as YYYY-MM-DD in the user's own time zone. */
  start: string
}

function mondayOf(time: string): Date {
  const date = new Date(time)
  const day = (date.getDay() + 6) % 7
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day)
}

function dateText(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Every week from the first answer to the last, including weeks with none. */
export function byWeek(answers: readonly AnswerRecord[]): Week[] {
  const weeks = new Map<string, AnswerRecord[]>()
  const originals = answers.filter(isOriginal)
  for (const answer of originals) {
    const start = dateText(mondayOf(answer.answered_at))
    const found = weeks.get(start)
    if (found) found.push(answer)
    else weeks.set(start, [answer])
  }
  const starts = [...weeks.keys()].toSorted()
  if (starts.length === 0) return []
  const result: Week[] = []
  const last = starts[starts.length - 1]
  const [year, month, day] = starts[0].split('-').map(Number)
  for (let index = 0; ; index++) {
    // By calendar day, so daylight saving changes do not matter.
    const start = dateText(new Date(year, month - 1, day + index * 7))
    result.push({ start, ...accuracy(weeks.get(start) ?? []) })
    if (start >= last) return result
  }
}

/** Finished and ended sessions, newest first. */
export function sessionHistory(sessions: readonly SessionRecord[]): SessionRecord[] {
  return sessions
    .filter(({ status, answered }) => status === 'completed' || (status === 'abandoned' && answered > 0))
    .toSorted((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''))
}

/** Completed exams, newest first. */
export function examHistory(sessions: readonly SessionRecord[]): SessionRecord[] {
  return sessionHistory(sessions).filter(
    ({ session_type, status }) =>
      status === 'completed' && (session_type === 'test' || session_type === 'full_simulation'),
  )
}
